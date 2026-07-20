import type { BoardDetail, StickerInfo } from '@/types';

// 포도알 채움의 클라이언트 상태 전이(낙관 삽입 → reconcile/rollback → 서버 병합).
// board/[id]/page.tsx의 setBoard 콜백들이 쓰는 산식을 순수 함수로 추출 — 연타/이탈
// 경합 버그(2026-06-12 진단)의 회귀를 단위 테스트로 고정한다.
//
// 핵심 불변식: **filledCount ≡ stickers.length.** 서버 GET도 stickers.length로
// 계산하므로(boards/[id]/route.ts) 양립한다. 예전엔 낙관 +1·reconcile 서버값
// 교체·캐시 스냅샷 −temps 산식이 제각각이라, 연타 중 reconcile이 끼면 캐시
// filledCount가 temp 수만큼 이중 차감돼 홈 카드가 과소 카운트로 후퇴했다.

/** 낙관(미확정) 스티커 식별 — postFillSticker가 reconcile/rollback으로 회수한다. */
export const isTempSticker = (s: { id: string }) => s.id.startsWith('temp-');

/** 탭 즉시 낙관 스티커 삽입. */
export function applyOptimisticFill(prev: BoardDetail, sticker: StickerInfo): BoardDetail {
  const stickers = [...prev.stickers, sticker];
  return { ...prev, stickers, filledCount: stickers.length };
}

/** POST 성공 reconcile — temp를 서버 확정 스티커로 교체.
 *  같은 position의 기존 항목도 함께 제거한다: stale fetchBoard 병합이 실 스티커를
 *  먼저 들여온 뒤 늦은 reconcile이 도착하면 동일 스티커가 중복 삽입되던 문제 방지.
 *  isCompleted는 단조(한 번 완성되면 되돌아가지 않음) — 큐 드레인 중간의 응답이
 *  이미 확정된 완성을 덮지 않는다. */
export function applyFillResult(
  prev: BoardDetail,
  tempId: string,
  result: { sticker: StickerInfo; isCompleted: boolean },
): BoardDetail {
  const stickers = [
    ...prev.stickers.filter((s) => s.id !== tempId && s.position !== result.sticker.position),
    result.sticker,
  ];
  return {
    ...prev,
    stickers,
    filledCount: stickers.length,
    isCompleted: prev.isCompleted || result.isCompleted,
  };
}

/** POST 실패(또는 선행 실패로 인한 발사 포기) — 해당 낙관 스티커만 회수.
 *  id뿐 아니라 같은 position의 temp도 함께 제거한다: 재진입 인스턴스가 좀비 큐의
 *  in-flight 칸을 다른 id(`temp-N-reseed`)로 재주입하므로, 좀비 항목의 롤백이
 *  자기 tempId만 지우면 재주입 temp가 유령으로 남는다. 같은 position의 *실*
 *  스티커는 보존(409 후 재동기화로 먼저 병합된 서버 확정분을 지우면 안 됨). */
export function rollbackFill(prev: BoardDetail, tempId: string, position?: number): BoardDetail {
  const stickers = prev.stickers.filter(
    (s) => s.id !== tempId && !(position !== undefined && s.position === position && isTempSticker(s)),
  );
  return { ...prev, stickers, filledCount: stickers.length };
}

/** 배치 채움 한 묶음의 최대 칸 수 — 서버 캡(60)의 절반, 한 세그먼트 왕복이 과대해지지 않게. */
export const FILL_BATCH_MAX = 30;

/** 코얼레싱된 연타 칸들을 배치 POST 단위로 분할하는 순수 플래너.
 *  보상은 filledCount가 triggerAt에 "도달"하는 순간 해제되므로, 누적 확정 카운트
 *  (serverFilledCount + 배치 소비분)가 triggerAt에 닿는 칸에서 세그먼트를 끊는다 —
 *  응답당 unlockedRewards가 ≤1개로 유지돼 기존 단일 보상 팝업 흐름을 배치마다
 *  재사용할 수 있다. 완성 칸(누적 == totalStickers)과 길이 캡도 경계.
 *  pendingPositions는 오름차순(순차 채움 계약). serverFilledCount = 첫 칸 발사
 *  직전의 확정 카운트(연속 채움에선 첫 칸의 position과 같다). */
export function planFillBatches(
  pendingPositions: number[],
  rewardTriggerAts: number[],
  serverFilledCount: number,
  totalStickers: number,
  cap: number = FILL_BATCH_MAX,
): number[][] {
  const triggers = new Set(rewardTriggerAts);
  const segments: number[][] = [];
  let seg: number[] = [];
  for (let i = 0; i < pendingPositions.length; i++) {
    seg.push(pendingPositions[i]);
    const cum = serverFilledCount + i + 1;
    if (triggers.has(cum) || cum >= totalStickers || seg.length >= cap) {
      segments.push(seg);
      seg = [];
    }
  }
  if (seg.length > 0) segments.push(seg);
  return segments;
}

/** 배치 POST 성공 reconcile — 응답의 스티커 전체를 applyFillResult 규칙으로 fold.
 *  서버는 요청 칸 "전체"(이미 차 있던 칸 포함)를 돌려주므로, temp가 없는 position의
 *  스티커도 온다 — applyFillResult의 position 매칭이 중복 없이 흡수한다(tempId '').
 *  불변식(filledCount ≡ stickers.length)은 fold가 보존하고, isCompleted/completedAt은
 *  단조 병합(mergeServerBoard와 동일 철학). completedAt은 배치 응답의 additive win —
 *  단건 POST엔 없어 write-through가 못 채우던 값이다. */
export function applyBatchFillResult(
  prev: BoardDetail,
  temps: { tempId: string; position: number }[],
  result: { stickers: StickerInfo[]; isCompleted: boolean; completedAt?: string | null },
): BoardDetail {
  const tempByPos = new Map(temps.map((t) => [t.position, t.tempId]));
  let next = prev;
  for (const s of result.stickers) {
    next = applyFillResult(next, tempByPos.get(s.position) ?? '', {
      sticker: s,
      isCompleted: false, // 완성 병합은 아래에서 한 번에(단조)
    });
  }
  return {
    ...next,
    isCompleted: prev.isCompleted || result.isCompleted,
    completedAt: next.completedAt ?? result.completedAt ?? null,
  };
}

/** fetchBoard 응답을 로컬 상태에 병합.
 *  서버 스냅샷에 없는 position의 로컬 스티커는 **전부** 보존한다:
 *  - temp(큐 대기/in-flight 낙관분) — 통째 교체하면 진행바 역행 + grape-next가
 *    이미 전송한 칸을 가리켜 중복 POST→409가 났다(#66, 적대적 리뷰 B1).
 *  - 실 스티커(GET의 DB 읽기 시점 *이후* reconcile로 확정된 분) — temp만 보존하면
 *    중간 보상 unlock 등으로 큐 드레인 도중 발사된 stale GET이 확정 스티커를
 *    지워 화면이 되감기고, GrapeBoard의 filledCount 하락 감시가 진행 중인 완성
 *    연출을 오취소했다(2026-06-12 진단 Gap 1).
 *  isCompleted/completedAt도 단조 병합 — stale GET의 false가 reconcile로 이미
 *  확정된 완성을 덮지 않는다. (채움 취소 기능이 없는 현 스키마에서 안전.) */
export function mergeServerBoard(prev: BoardDetail | null, server: BoardDetail): BoardDetail {
  // 교차 보드 가드 — App Router는 /board/A → /board/B 전환에서 인스턴스를 재사용할
  // 수 있어(page.tsx summary 메모와 같은 방어 철학), 다른 보드의 잔여 상태에 병합하면
  // A의 스티커가 B에 영구 보존된다. id가 다르면 서버 스냅샷 그대로.
  if (!prev || prev.id !== server.id) return server;
  const serverPositions = new Set(server.stickers.map((s) => s.position));
  const localExtras = prev.stickers.filter((s) => !serverPositions.has(s.position));
  if (localExtras.length === 0 && !prev.isCompleted) return server;
  const stickers = [...server.stickers, ...localExtras];
  return {
    ...server,
    stickers,
    filledCount: stickers.length,
    isCompleted: server.isCompleted || prev.isCompleted,
    completedAt: server.completedAt ?? prev.completedAt,
  };
}

/** 캐시 스냅샷용 — temp 제외, 카운트는 남는 스티커 수로 직접 유도.
 *  캐시는 '서버가 확인한 마지막 상태'만 담는다(#74: temp를 캐시에 남기면 POST
 *  실패+이탈 조합에서 유령 포도알이 영구 고착). 산식을 빼기(−temps.length)가
 *  아닌 필터 후 길이로 두어, filledCount가 어떤 경로로 들어왔든 이중 차감이
 *  불가능하다. */
export function stripTempsForCache(board: BoardDetail): BoardDetail {
  const stickers = board.stickers.filter((s) => !isTempSticker(s));
  if (stickers.length === board.stickers.length) return board;
  return { ...board, stickers, filledCount: stickers.length };
}
