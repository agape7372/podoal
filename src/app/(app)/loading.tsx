// 라우트 전환 Suspense 폴백 — 이게 없으면 새 라우트의 RSC/청크가 도착할 때까지
// 이전 화면이 그대로 동결되어 '탭을 눌러도 무반응'으로 보인다. 프리페치된 정적
// 탭에서는 거의 안 보이고, 동적 라우트(board/[id]) 첫 진입에서 즉시 피드백을 준다.
export default function Loading() {
  return (
    <div className="pb-4">
      <div className="skeleton h-8 w-28 mb-6" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-32 w-full" />
        ))}
      </div>
    </div>
  );
}
