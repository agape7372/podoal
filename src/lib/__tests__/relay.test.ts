import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { advanceRelayOnBoardComplete } from '../relay';

// advanceRelayOnBoardComplete는 포도동 진행의 단일 진실원(자동=stickers, 수동=/pass).
// 실제 버그였던 부분: 자동 진행이 status를 무시한 채 order+1만 찾아 거절(갭)·미수락(invited)
// 시 릴레이를 조기 완료하거나 미수락자에게 바통을 강제로 넘겼다. 아래 테스트는 mock tx로
// 헬퍼가 발행하는 쿼리를 직접 검증해 그 회귀를 고정한다(DB 불필요).

type Call = { args: unknown[] };

function makeTx(opts: {
  findFirst?: unknown; // relay 모드에서 다음 참가자 조회 결과
  count?: number; // group 모드에서 미완료 참가자 수
}) {
  const calls: Record<string, Call[]> = {
    participantUpdate: [],
    participantFindFirst: [],
    participantCount: [],
    relayUpdate: [],
  };
  const tx = {
    relayParticipant: {
      update: mock.fn(async (arg: unknown) => { calls.participantUpdate.push({ args: [arg] }); return {}; }),
      findFirst: mock.fn(async (arg: unknown) => { calls.participantFindFirst.push({ args: [arg] }); return opts.findFirst ?? null; }),
      count: mock.fn(async (arg: unknown) => { calls.participantCount.push({ args: [arg] }); return opts.count ?? 0; }),
    },
    relay: {
      update: mock.fn(async (arg: unknown) => { calls.relayUpdate.push({ args: [arg] }); return {}; }),
    },
  };
  return { tx, calls };
}

test('relay 모드: 다음 pending 참가자에게 바통을 넘긴다 (order gt + status pending 조건)', async () => {
  const { tx, calls } = makeTx({ findFirst: { id: 'p-next', order: 3 } });
  const res = await advanceRelayOnBoardComplete(
    tx as never,
    { id: 'r1', mode: 'relay' },
    { id: 'p-cur', order: 1 },
  );

  // 현재 참가자는 completed로 마킹
  assert.deepEqual(calls.participantUpdate[0].args[0], { where: { id: 'p-cur' }, data: { status: 'completed' } });

  // ★ 회귀 가드: 다음 주자 조회는 'order > current' 중 status==='pending' (order+1 고정 아님)
  const findArg = calls.participantFindFirst[0].args[0] as {
    where: { relayId: string; order: { gt: number }; status: string };
    orderBy: { order: string };
  };
  assert.equal(findArg.where.relayId, 'r1');
  assert.equal(findArg.where.order.gt, 1);
  assert.equal(findArg.where.status, 'pending');
  assert.equal(findArg.orderBy.order, 'asc');

  // 다음 참가자를 active로 승격, 릴레이는 미완료
  assert.deepEqual(calls.participantUpdate[1].args[0], { where: { id: 'p-next' }, data: { status: 'active' } });
  assert.equal(calls.relayUpdate.length, 0);
  assert.deepEqual(res, { relayCompleted: false, nextActivated: true });
});

test('relay 모드: 다음 pending이 없으면(거절 갭·미수락만 남음) 릴레이를 완료 처리', async () => {
  const { tx, calls } = makeTx({ findFirst: null });
  const res = await advanceRelayOnBoardComplete(
    tx as never,
    { id: 'r1', mode: 'relay' },
    { id: 'p-cur', order: 2 },
  );

  // 다음 참가자 승격은 없고, 릴레이만 completed
  assert.equal(calls.participantUpdate.length, 1); // 현재만 completed
  assert.deepEqual(calls.relayUpdate[0].args[0], { where: { id: 'r1' }, data: { status: 'completed' } });
  assert.deepEqual(res, { relayCompleted: true, nextActivated: false });
});

test('group 모드: 본인만 완료, 전원 완료 시에만 릴레이 완료 (바통 없음)', async () => {
  // 미완료 참가자 2명 남음 → 릴레이 미완료
  const remaining = makeTx({ count: 2 });
  const res1 = await advanceRelayOnBoardComplete(
    remaining.tx as never,
    { id: 'r1', mode: 'group' },
    { id: 'p-cur', order: 0 },
  );
  assert.deepEqual(remaining.calls.participantUpdate[0].args[0], { where: { id: 'p-cur' }, data: { status: 'completed' } });
  assert.equal(remaining.calls.participantFindFirst.length, 0, 'group 모드는 바통(findFirst) 조회를 하지 않아야 함');
  assert.equal(remaining.calls.relayUpdate.length, 0);
  assert.deepEqual(res1, { relayCompleted: false, nextActivated: false });

  // 미완료 0명 → 릴레이 완료
  const done = makeTx({ count: 0 });
  const res2 = await advanceRelayOnBoardComplete(
    done.tx as never,
    { id: 'r1', mode: 'group' },
    { id: 'p-last', order: 5 },
  );
  assert.deepEqual(done.calls.relayUpdate[0].args[0], { where: { id: 'r1' }, data: { status: 'completed' } });
  assert.deepEqual(res2, { relayCompleted: true, nextActivated: false });
});
