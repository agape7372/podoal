import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { advanceRelayOnBoardComplete, participantStatusForMode } from '../relay';

// advanceRelayOnBoardComplete는 포도동 진행의 단일 진실원(자동=stickers, 수동=/pass).
// 실제 버그였던 부분 2가지를 mock tx로 고정한다(DB 불필요):
//   1) 자동 진행이 status를 무시한 채 order+1만 찾아 거절(갭)·미수락(invited) 시
//      릴레이를 조기 완료하거나 미수락자에게 바통을 강제로 넘겼다.
//   2) 바통이 오기 전에 보드를 선완성(+수확)해 둔 pending 참가자를 무조건 active로
//      전환해 이미 끝난 보드가 '진행중'으로 둔갑했다(PR #79는 증상만 수정) — 이제
//      그런 참가자는 active를 건너뛰고 completed 처리, 다음 후보로 연쇄 진행한다.

type Call = { args: unknown[] };

type Candidate = { id: string; order: number; board: { isCompleted: boolean } | null };

function makeTx(opts: {
  candidates?: Candidate[]; // relay 모드에서 다음 참가자 후보 목록(order asc)
  count?: number; // group 모드에서 미완료 참가자 수
}) {
  const calls: Record<string, Call[]> = {
    participantUpdate: [],
    participantFindMany: [],
    participantCount: [],
    relayUpdate: [],
  };
  const tx = {
    relayParticipant: {
      update: mock.fn(async (arg: unknown) => { calls.participantUpdate.push({ args: [arg] }); return {}; }),
      findMany: mock.fn(async (arg: unknown) => { calls.participantFindMany.push({ args: [arg] }); return opts.candidates ?? []; }),
      count: mock.fn(async (arg: unknown) => { calls.participantCount.push({ args: [arg] }); return opts.count ?? 0; }),
    },
    relay: {
      update: mock.fn(async (arg: unknown) => { calls.relayUpdate.push({ args: [arg] }); return {}; }),
    },
  };
  return { tx, calls };
}

test('relay 모드: 다음 pending 참가자에게 바통을 넘긴다 (order gt + status pending 조건)', async () => {
  const { tx, calls } = makeTx({ candidates: [{ id: 'p-next', order: 3, board: { isCompleted: false } }] });
  const res = await advanceRelayOnBoardComplete(
    tx as never,
    { id: 'r1', mode: 'relay' },
    { id: 'p-cur', order: 1 },
  );

  // 현재 참가자는 completed로 마킹
  assert.deepEqual(calls.participantUpdate[0].args[0], { where: { id: 'p-cur' }, data: { status: 'completed' } });

  // ★ 회귀 가드: 다음 주자 후보는 'order > current' 중 status==='pending' (order+1 고정 아님)
  const findArg = calls.participantFindMany[0].args[0] as {
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

test('relay 모드: 보드 미연결(board null) pending도 종전대로 바통을 받는다', async () => {
  const { tx, calls } = makeTx({ candidates: [{ id: 'p-next', order: 2, board: null }] });
  const res = await advanceRelayOnBoardComplete(
    tx as never,
    { id: 'r1', mode: 'relay' },
    { id: 'p-cur', order: 1 },
  );
  assert.deepEqual(calls.participantUpdate[1].args[0], { where: { id: 'p-next' }, data: { status: 'active' } });
  assert.deepEqual(res, { relayCompleted: false, nextActivated: true });
});

test('relay 모드: 다음 pending이 없으면(거절 갭·미수락만 남음) 릴레이를 완료 처리', async () => {
  const { tx, calls } = makeTx({ candidates: [] });
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

test('relay 모드: 선완성 보드 보유 pending은 active를 건너뛰고 completed, 그 다음 미완성자에게 바통', async () => {
  const { tx, calls } = makeTx({
    candidates: [
      { id: 'p2', order: 2, board: { isCompleted: true } }, // 바통 오기 전에 이미 다 채움
      { id: 'p3', order: 3, board: { isCompleted: false } },
    ],
  });
  const res = await advanceRelayOnBoardComplete(
    tx as never,
    { id: 'r1', mode: 'relay' },
    { id: 'p1', order: 1 },
  );

  // p1(현재)·p2(선완성) 모두 completed, p3만 active — 끝난 보드가 '진행중'이 되지 않는다
  assert.deepEqual(calls.participantUpdate.map((c) => c.args[0]), [
    { where: { id: 'p1' }, data: { status: 'completed' } },
    { where: { id: 'p2' }, data: { status: 'completed' } },
    { where: { id: 'p3' }, data: { status: 'active' } },
  ]);
  assert.equal(calls.relayUpdate.length, 0);
  assert.deepEqual(res, { relayCompleted: false, nextActivated: true });
});

test('relay 모드: 연속 선완성 2명도 모두 건너뛰고 첫 미완성자에게 바통', async () => {
  const { tx, calls } = makeTx({
    candidates: [
      { id: 'p2', order: 2, board: { isCompleted: true } },
      { id: 'p3', order: 3, board: { isCompleted: true } },
      { id: 'p4', order: 4, board: { isCompleted: false } },
    ],
  });
  const res = await advanceRelayOnBoardComplete(
    tx as never,
    { id: 'r1', mode: 'relay' },
    { id: 'p1', order: 1 },
  );

  assert.deepEqual(calls.participantUpdate.map((c) => c.args[0]), [
    { where: { id: 'p1' }, data: { status: 'completed' } },
    { where: { id: 'p2' }, data: { status: 'completed' } },
    { where: { id: 'p3' }, data: { status: 'completed' } },
    { where: { id: 'p4' }, data: { status: 'active' } },
  ]);
  assert.equal(calls.relayUpdate.length, 0);
  assert.deepEqual(res, { relayCompleted: false, nextActivated: true });
});

test('relay 모드: 잔여 전원이 선완성이면 전원 completed 후 릴레이 완료(연쇄 마지막)', async () => {
  const { tx, calls } = makeTx({
    candidates: [
      { id: 'p2', order: 2, board: { isCompleted: true } },
      { id: 'p3', order: 3, board: { isCompleted: true } },
    ],
  });
  const res = await advanceRelayOnBoardComplete(
    tx as never,
    { id: 'r1', mode: 'relay' },
    { id: 'p1', order: 1 },
  );

  assert.deepEqual(calls.participantUpdate.map((c) => c.args[0]), [
    { where: { id: 'p1' }, data: { status: 'completed' } },
    { where: { id: 'p2' }, data: { status: 'completed' } },
    { where: { id: 'p3' }, data: { status: 'completed' } },
  ]);
  // 릴레이 완료는 정확히 1회 (기존 완료 분기 재사용 — 중복 update 없음)
  assert.equal(calls.relayUpdate.length, 1);
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
  assert.equal(remaining.calls.participantFindMany.length, 0, 'group 모드는 바통(findMany) 조회를 하지 않아야 함');
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

// participantStatusForMode — accept 라우트와 join의 'invited' 잔류 방어 가드가 공유하는
// 모드→상태 매핑(단일 진실원). join 가드는 accept 응답 전에 join이 도달한 경쟁에서만 발동한다.
test('participantStatusForMode: group=active, relay=pending', () => {
  assert.equal(participantStatusForMode('group'), 'active', 'group(동시)은 바통 없이 즉시 active');
  assert.equal(participantStatusForMode('relay'), 'pending', 'relay(순차)는 바통 대기열의 pending');
});
