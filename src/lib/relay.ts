import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export interface RelayAdvanceResult {
  /** The whole relay reached completion (no participant left to act). */
  relayCompleted: boolean;
  /** A next participant was activated (relay mode baton handed over). */
  nextActivated: boolean;
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
 *   (declined rows are deleted). If none remain, the relay itself completes.
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
  const next = await tx.relayParticipant.findFirst({
    where: { relayId: relay.id, order: { gt: participant.order }, status: 'pending' },
    orderBy: { order: 'asc' },
  });
  if (next) {
    await tx.relayParticipant.update({ where: { id: next.id }, data: { status: 'active' } });
    return { relayCompleted: false, nextActivated: true };
  }
  await tx.relay.update({ where: { id: relay.id }, data: { status: 'completed' } });
  return { relayCompleted: true, nextActivated: false };
}
