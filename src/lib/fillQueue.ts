// ── 채움 POST 직렬화 큐 (보드 단위, 모듈 레벨) ──────────────────────────────
// 연타 시 낙관적 UI는 즉시 반영하되 서버 POST는 한 번에 1개씩 순차 발송한다.
// 동시 요청들끼리의 Serializable 자기 경합(P2034 재시도 소진 → 일부 채움 유실)을
// 원천 제거하고, 응답 도착 순서도 발사 순서와 같아진다.
//
// 컴포넌트 ref가 아닌 **모듈 레벨**인 이유(2026-06-12 진단): 큐가 인스턴스 단위면
// 이탈 후에도 잔여 POST가 계속 도는데(좀비 큐), 재진입한 새 인스턴스가 새 큐로
// 같은 보드에 병렬 POST를 쏴 직렬화 전제가 인스턴스 경계에서 무너졌다(P2034 부활,
// 같은 칸 중복 POST→409). 모듈 큐는 재진입 탭을 좀비 잔여분 *뒤에* 이어 붙인다.
// (직렬화 범위는 JS 컨텍스트 = 단일 탭 한정 — 두 탭 동시 연타는 서버 재시도와
//  클라 409 처리가 수습한다.)
//
// fillResumeAt: 항목이 (409 외로) 실패하면 그 position을 기록한다 — 그보다 높은
// position의 항목은 발사 *직전에* 폐기(낙관 스티커만 회수)된다. 실패 칸을 건너뛴
// 후속 성공이 서버에 비연속 구멍(영구 미완성 보드)을 만들기 때문이며, 서버는
// position 연속성을 검증하지 않는다(서로 다른 칸 동시 채움 허용 계약 —
// fillBoard.integration.test 참조). '카운터(epoch)'가 아닌 '재개 지점(position)'인
// 이유: 실패 직후 롤백이 화면에 그려지기 전(stale 렌더 창)에 들어온 탭은 어떤
// 카운터를 캡처해도 통과하지만, position 비교는 발사 시점 큐 이력만으로 차단된다.
// 기록은 실패 지점 이하를 다시 채우는 발사가 나타날 때 해제된다.
export const fillQueues = new Map<string, Promise<void>>();
export const fillResumeAt = new Map<string, number>();
export const fillPendingCounts = new Map<string, number>();
// 큐에 들어갔지만 아직 확정(reconcile/rollback)되지 않은 position들 — 재진입한
// 인스턴스가 이 칸들을 낙관 temp로 재주입해 '비어 보이는 in-flight 칸'을 재탭
// (→확정 409)하지 않게 한다.
export const fillPendingPositions = new Map<string, Set<number>>();

/** 특정 보드의 in-flight(아직 확정되지 않은) 채움 개수 — 없으면 0. */
export function pendingFillCount(boardId: string): number {
  return fillPendingCounts.get(boardId) ?? 0;
}

/** 특정 보드의 드레인 완료 Promise — 큐가 비어 있으면(또는 존재한 적 없으면) undefined. */
export function drainPromise(boardId: string): Promise<void> | undefined {
  return fillQueues.get(boardId);
}

/** 홈 낙관 오버레이 — in-flight 채움 의도를 서버확정 수(filledCount) 위에 겹쳐
 *  보여준다. 클램프(totalStickers 상한)가 reconcile↔pending 감소 사이의
 *  서브프레임 구간에서 과잉카운트가 잠깐 비치는 것을 막는다. */
export function applyPendingOverlay<
  T extends { id: string; filledCount: number; totalStickers: number; isCompleted: boolean },
>(board: T): T {
  const pending = pendingFillCount(board.id);
  if (pending === 0 || board.isCompleted) return board;
  const filledCount = Math.min(board.totalStickers, board.filledCount + pending);
  return { ...board, filledCount, isCompleted: filledCount >= board.totalStickers };
}
