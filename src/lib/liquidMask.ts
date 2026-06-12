/**
 * 포도판 완성 연출('액체 차오름 v2')의 송이 실루엣 마스크 — 순수 기하 헬퍼.
 *
 * 각 포도알 셀의 rect를 클러스터 컨테이너 rect에서 차감해 컨테이너-로컬 좌표의
 * radial-gradient circle 마스크로 합성한다. getBoundingClientRect()는 viewport
 * 기준이지만, 컨테이너와 셀이 같은 overflow-x 스크롤 박스 안에서 함께 이동하므로
 * 차감 시 스크롤 오프셋이 자연 상쇄된다 — 가로 스크롤된 60알 보드에서도 좌표가
 * 정확한 이유. (__tests__/liquidMask.test.ts 의 스크롤 불변성 테스트로 검증)
 */

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 포도알 셀 하나 → 컨테이너-로컬 radial-gradient circle 마스크 조각 */
export function maskCircle(cell: RectLike, container: RectLike): string {
  const cx = (cell.left - container.left + cell.width / 2).toFixed(1);
  const cy = (cell.top - container.top + cell.height / 2).toFixed(1);
  const radius = (cell.width / 2 + 0.5).toFixed(1); // +0.5px: 알 가장자리까지 빈틈 없이 덮기
  return `radial-gradient(circle ${radius}px at ${cx}px ${cy}px, #000 97%, transparent 100%)`;
}

/** 송이 전체 → mask-image 값(콤마 합성). 셀이 없으면 null */
export function composeBunchMask(cells: RectLike[], container: RectLike): string | null {
  if (cells.length === 0) return null;
  return cells.map((cell) => maskCircle(cell, container)).join(',');
}
