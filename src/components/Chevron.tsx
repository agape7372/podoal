interface ChevronProps {
  /** 렌더 크기(px). 설정류 링크 행의 글리프 기준 18. */
  size?: number;
}

// 설정 허브·더보기 링크 행 끝의 우향 화살표. 텍스트 글리프('>')와 inline SVG가
// 혼재하던 것을 단일 컴포넌트로 통일 — 장식 요소라 항상 aria-hidden.
export default function Chevron({ size = 18 }: ChevronProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-warm-sub shrink-0"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
