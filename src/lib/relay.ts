import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export interface RelayAdvanceResult {
  /** The whole relay reached completion (no participant left to act). */
  relayCompleted: boolean;
  /** A next participant was activated (relay mode baton handed over). */
  nextActivated: boolean;
}

/**
 * 초대 수락(accept) 또는 보드 연결(join) 시 'invited' 참가자에게 부여할 참가 상태.
 * group(동시) 모드는 바통이 없어 즉시 active, relay(순차) 모드는 바통 대기열의 pending.
 * accept 라우트와 join 가드가 같은 매핑을 쓰도록 단일 진실원으로 둔다.
 */
export function participantStatusForMode(mode: string): 'active' | 'pending' {
  return mode === 'group' ? 'active' : 'pending';
}

/**
 * Single source of truth for advancing a relay (포도동) when a participant
 * finishes their board. Used by both the automatic path (filling the last
 * grape — see boards/[id]/stickers) and the manual /pass button so the two
 * can never drift apart.
 *
 * - relay (sequential) mode: mark the current participant completed, then hand
 *   the baton to the next *accepted* participant — the lowest `order` greater
 *   than the current whose status is `pending`. This deliberately skips both
 *   unaccepted invitees (`invited`) and the order gaps left by declines
 *   (declined rows are deleted). A pending participant whose linked board is
 *   ALREADY completed (filled before the baton arrived) is marked completed
 *   and skipped — activating them would show a finished board as 진행중.
 *   If none remain, the relay itself completes.
 * - group (parallel) mode: there is no baton — mark this participant completed
 *   and complete the relay only once no participant remains incomplete.
 *
 * The caller is responsible for the eligibility guard (relay active, this
 * participant is the acting one). `participant.order`/`id` must be current.
 */
export async function advanceRelayOnBoardComplete(
  tx: Tx,
  relay: { id: string; mode: string },
  participant: { id: string; order: number }
): Promise<RelayAdvanceResult> {
  await tx.relayParticipant.update({
    where: { id: participant.id },
    data: { status: 'completed' },
  });

  if (relay.mode === 'group') {
    const remaining = await tx.relayParticipant.count({
      where: { relayId: relay.id, status: { not: 'completed' } },
    });
    const relayCompleted = remaining === 0;
    if (relayCompleted) {
      await tx.relay.update({ where: { id: relay.id }, data: { status: 'completed' } });
    }
    return { relayCompleted, nextActivated: false };
  }

  // relay (sequential) mode — next accepted participant, skipping invited + gaps.
  // 후보를 order 순으로 한 번에 가져와 유한 루프(참가자 수 상한)로 훑는다: 바통이
  // 오기 전에 보드를 선완성해 둔 pending 참가자를 active로 만들면 이미 끝난 보드가
  // '진행중'으로 둔갑하므로(#79는 배지 겹침 증상만 수정), completed로 마킹하고
  // 다음 후보로 넘어간다. 보드 미연결(board null)은 종전대로 바통을 받는다.
  const candidates = await tx.relayParticipant.findMany({
    where: { relayId: relay.id, order: { gt: participant.order }, status: 'pending' },
    orderBy: { order: 'asc' },
    include: { board: { select: { isCompleted: true } } },
  });
  for (const next of candidates) {
    if (!next.board?.isCompleted) {
      await tx.relayParticipant.update({ where: { id: next.id }, data: { status: 'active' } });
      return { relayCompleted: false, nextActivated: true };
    }
    await tx.relayParticipant.update({ where: { id: next.id }, data: { status: 'completed' } });
  }
  // 활성화할 후보가 없음(빈 목록이거나 전원 선완성) — 릴레이 완료(유일한 완료 분기).
  await tx.relay.update({ where: { id: relay.id }, data: { status: 'completed' } });
  return { relayCompleted: true, nextActivated: false };
}
