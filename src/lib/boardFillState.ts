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

/** POST 실패(또는 선행 실패로 인한 발사 포기) — 해당 낙관 스티커만 회수. */
export function rollbackFill(prev: BoardDetail, tempId: string): BoardDetail {
  const stickers = prev.stickers.filter((s) => s.id !== tempId);
  return { ...prev, stickers, filledCount: stickers.length };
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
  if (!prev) return server;
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
