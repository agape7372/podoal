/**
 * 홈 "꾹 눌러 → 드래그 정렬" 제스처의 순수 기하 계산.
 *
 * 홈 목록은 손가락이 닿아 있는 동안 행 순서를 바꾸지 않는다 — 바꾸면 React가 재정렬해
 * DOM 행이 순간이동했다(예전의 "휙휙" 점프). 대신 드래그는 순수 시각 처리다: 들어올린
 * 카드는 손가락을 따라가고(translateY = 포인터 Δ), 나머지 행은 고정 "footprint"만큼
 * 미끄러져 삽입 지점에 빈자리를 연다. 실제 배열 순서는 손을 뗄 때 한 번만 커밋하고,
 * 그 전이를 FLIP으로 애니메이션한다. 이 모듈은 그 뒤의 프레임워크 무관 산수다 —
 * DOM 없이 단위 테스트할 수 있도록 여기 둔다.
 */

export interface SlotSnapshot {
  /** 보이는 각 행 outer 박스의 뷰포트 기준 top(px), 표시 순서. */
  tops: number[];
  /** 보이는 각 행 outer 박스의 높이(px), 표시 순서. */
  heights: number[];
}

/** `arr[from]`을 `to` 위치로 불변 이동. 범위 밖/no-op은 얕은 복사본. */
export function arrayMove<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = arr.slice();
  if (
    from < 0 ||
    from >= next.length ||
    to < 0 ||
    to >= next.length ||
    from === to
  ) {
    return next;
  }
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * 라이브 포인터 Δ로 드래그 행의 삽입 인덱스(0..n-1)를 구한다.
 * 리프트 시점에 굳힌 정적 스냅샷(드래그 중 행은 DOM에서 움직이지 않는다)을 쓰므로,
 * 이웃에 건 시각 transform에 오염되지 않는다. 미드포인트 교차(inclusive) 기준,
 * 가변 높이 안전, 양 끝에서 클램프.
 */
export function computeTargetIndex(
  snap: SlotSnapshot,
  sourceIndex: number,
  dy: number,
): number {
  const { tops, heights } = snap;
  const n = tops.length;
  if (sourceIndex < 0 || sourceIndex >= n) return sourceIndex;

  const draggedCenter = tops[sourceIndex] + heights[sourceIndex] / 2 + dy;
  let target = sourceIndex;

  if (dy > 0) {
    // 아래로: 중앙선을 넘은 아래쪽 행까지 전진(연속)
    for (let i = sourceIndex + 1; i < n; i++) {
      if (draggedCenter >= tops[i] + heights[i] / 2) target = i;
      else break;
    }
  } else if (dy < 0) {
    // 위로: 중앙선을 넘은 위쪽 행까지 후퇴(연속)
    for (let i = sourceIndex - 1; i >= 0; i--) {
      if (draggedCenter <= tops[i] + heights[i] / 2) target = i;
      else break;
    }
  }

  return target;
}

/**
 * 드래그가 `targetIndex`에 열려 있을 때 행 `index`가 받을 세로 transform(px).
 * 드래그 행은 0(손가락이 직접 구동). source와 target 사이 행은 ±`footprint`만큼
 * 미끄러져 드래그 행의 빈자리를 연다. 그 외는 0.
 */
export function shiftFor(
  index: number,
  sourceIndex: number,
  targetIndex: number,
  footprint: number,
): number {
  if (index === sourceIndex) return 0;
  if (targetIndex > sourceIndex) {
    // 드래그 행이 아래로 → (source, target] 행이 위로 올라와 빈자리 채움
    if (index > sourceIndex && index <= targetIndex) return -footprint;
  } else if (targetIndex < sourceIndex) {
    // 드래그 행이 위로 → [target, source) 행이 아래로 내려감
    if (index >= targetIndex && index < sourceIndex) return footprint;
  }
  return 0;
}

/** 드래그 행의 footprint = 자기 높이 + 행 간격(px). */
export function rowFootprint(
  snap: SlotSnapshot,
  sourceIndex: number,
  gap: number,
): number {
  return (snap.heights[sourceIndex] ?? 0) + gap;
}

/**
 * 스냅샷에서 행 간격(px)을 추론한다(= `space-y-3` = 12px). 첫 번째 합리적 간격을
 * 채택해 향후 간격 토큰이 바뀌어도 따라간다. 합리적 범위가 없으면 fallback.
 */
export function inferRowGap(snap: SlotSnapshot, fallback = 12): number {
  const { tops, heights } = snap;
  for (let i = 0; i + 1 < tops.length; i++) {
    const g = tops[i + 1] - (tops[i] + heights[i]);
    if (g >= 0 && g < 200) return g;
  }
  return fallback;
}

/**
 * 리프트 드래그 중 손가락이 화면 위/아래 가장자리에 닿았을 때의 자동 스크롤 속도(px/frame).
 *
 * @param clientY        현재 포인터의 뷰포트 기준 Y
 * @param viewportHeight 자동 스크롤 판정에 쓰는 높이. 하단 고정 네비가 가리는 만큼 줄여
 *                       전달하면(예: innerHeight - NAV_INSET) 하단 트리거가 네비 위로 올라온다.
 * @param zone           위/아래 가장자리에서 스크롤이 시작되는 영역 두께(px)
 * @param maxSpeed       가장자리 최내곽에서의 최대 속도(px/frame)
 * @returns 위쪽 엣지존이면 음수(위로 스크롤), 아래쪽이면 양수(아래로), 엣지존 밖이면 0
 */
export function edgeScrollVelocity(
  clientY: number,
  viewportHeight: number,
  zone = 96,
  maxSpeed = 16,
): number {
  // 가장자리 침투 비율(0=경계, 1=맨 끝)을 제곱한 ease-in 곡선: 살짝 닿으면 느릿느릿
  // (정밀 제어), 끝으로 갈수록 maxSpeed까지 급가속. 부호로 스크롤 방향을 준다.
  // ratio는 1로 클램프 — 손가락이 엣지 '너머'(clientY<0, 또는 viewportHeight 초과:
  // 하단 NAV_INSET 영역은 정상 사용 중에도 닿는다)로 가도 maxSpeed를 넘지 않게 한다.
  const fromTop = clientY;
  const fromBottom = viewportHeight - clientY;
  if (fromTop < zone) {
    const ratio = Math.min(1, (zone - fromTop) / zone);
    return -maxSpeed * ratio * ratio; // 위 엣지존 → 위로(음수)
  }
  if (fromBottom < zone) {
    const ratio = Math.min(1, (zone - fromBottom) / zone);
    return maxSpeed * ratio * ratio;  // 아래 엣지존 → 아래로(양수)
  }
  return 0;
}
