'use client';

import { CSSProperties, ReactNode, useCallback, useState } from 'react';

/**
 * 애니메이션 리스트업 — 앱에서 쓰는 모든 모션을 한 곳에서 미리보기.
 * 효과음 테스트(sound-test) 페이지와 같은 결의 "카탈로그" 페이지.
 * 1회성 모션은 카드를 누르면 다시 재생되고, 반복 모션은 계속 돌아간다.
 */

type AnimItem = {
  /** 미리보기 안에 그릴 내용. nonce 가 바뀌면 re-mount 되어 1회성 모션이 재생된다. */
  render: (nonce: number) => ReactNode;
  name: string;
  /** 실제 코드에서 쓰는 클래스 / 유틸 이름 */
  token: string;
  desc: string;
  /** 계속 도는 모션이면 true (재생 버튼 숨김) */
  loop?: boolean;
};

type AnimGroup = {
  title: string;
  emoji: string;
  items: AnimItem[];
};

// 12입자 버스트용 좌표 (GrapeSticker 와 동일한 방사형 배치)
const BURST_DOTS = Array.from({ length: 12 }, (_, i) => ({
  a: (360 / 12) * i,
  d: 16 + (i % 3) * 4,
  delay: (i % 4) * 20,
}));

const GROUPS: AnimGroup[] = [
  {
    title: '포도알 채우기',
    emoji: '🍇',
    items: [
      {
        name: '젤리 팝',
        token: 'grape-jelly-pop',
        desc: '포도알을 채운 직후 통통 튀는 팝',
        render: (n) => (
          <div key={n} className="grape-filled grape-jelly-pop w-12 h-12 rounded-full" />
        ),
      },
      {
        name: '과즙 채움',
        token: 'grape-juice',
        desc: '아래에서 차오르는 과즙 + 물결',
        render: (n) => (
          <div key={n} className="grape-filled w-12 h-12 rounded-full relative overflow-hidden">
            <span className="grape-juice" aria-hidden="true">
              <span className="grape-juice__below" />
              <span className="grape-juice__wave">
                <i className="w-a" />
                <i className="w-b" />
              </span>
            </span>
          </div>
        ),
      },
      {
        name: '플래시 링',
        token: 'grape-flash',
        desc: '채움 순간 2겹으로 번지는 빛',
        render: (n) => (
          <div key={n} className="grape-filled w-12 h-12 rounded-full relative">
            <span className="grape-flash" aria-hidden="true" />
          </div>
        ),
      },
      {
        name: '입자 버스트',
        token: 'burst-dot',
        desc: '사방으로 튀는 12개의 입자',
        render: (n) => (
          <div key={n} className="grape-filled w-12 h-12 rounded-full relative">
            <span className="burst-layer" aria-hidden="true">
              {BURST_DOTS.map((p, i) => (
                <span
                  key={i}
                  className="burst-dot"
                  style={{
                    '--a': `${p.a}deg`,
                    '--d': `${p.d}px`,
                    '--delay': `${p.delay}ms`,
                  } as CSSProperties}
                />
              ))}
            </span>
          </div>
        ),
      },
      {
        name: '다음 포도알 숨쉬기',
        token: 'grape-empty.grape-next',
        desc: '다음에 채울 칸이 은은하게 숨쉬는 힌트',
        loop: true,
        render: () => (
          <div className="grape-empty grape-next w-12 h-12 rounded-full" />
        ),
      },
    ],
  },
  {
    title: 'UI 전환',
    emoji: '✨',
    items: [
      {
        name: '바운스 인',
        token: 'animate-bounce-in',
        desc: '살짝 커졌다 자리잡는 등장',
        render: (n) => (
          <div key={n} className="animate-bounce-in clay-sm w-12 h-12 rounded-2xl bg-grape-100" />
        ),
      },
      {
        name: '팝',
        token: 'animate-pop',
        desc: '한 번 뿅 하고 커졌다 돌아옴',
        render: (n) => (
          <div key={n} className="animate-pop clay-sm w-12 h-12 rounded-2xl bg-pink-100" />
        ),
      },
      {
        name: '셰이크',
        token: 'animate-shake',
        desc: '좌우로 흔드는 오류/거절 피드백',
        render: (n) => (
          <div key={n} className="animate-shake clay-sm w-12 h-12 rounded-2xl bg-red-100" />
        ),
      },
      {
        name: '슬라이드 업',
        token: 'animate-slide-up',
        desc: '아래에서 올라오는 시트/카드',
        render: (n) => (
          <div className="w-full h-full overflow-hidden flex items-end justify-center">
            <div key={n} className="animate-slide-up clay-sm w-16 h-10 rounded-xl bg-grape-100" />
          </div>
        ),
      },
      {
        name: '슬라이드 다운',
        token: 'animate-slide-down',
        desc: '위에서 내려오는 알림/배너',
        render: (n) => (
          <div className="w-full h-full overflow-hidden flex items-start justify-center">
            <div key={n} className="animate-slide-down clay-sm w-16 h-10 rounded-xl bg-grape-100" />
          </div>
        ),
      },
      {
        name: '페이드 인',
        token: 'animate-fade-in',
        desc: '부드럽게 떠오르는 등장',
        render: (n) => (
          <div key={n} className="animate-fade-in clay-sm w-12 h-12 rounded-2xl bg-emerald-100" />
        ),
      },
      {
        name: '위글',
        token: 'animate-wiggle / animate-wiggle-once',
        desc: '잠깐 갸웃거리는 주의 환기',
        render: (n) => (
          <div key={n} className="animate-wiggle-once text-3xl">🔔</div>
        ),
      },
      {
        name: '팝업 등장',
        token: 'popup-enter',
        desc: '메시지 토스트가 튕기며 등장',
        render: (n) => (
          <div key={n} className="popup-enter clay-sm w-full max-w-[140px] h-10 rounded-2xl bg-white flex items-center px-3 text-xs text-warm-sub">
            💌 새 메시지
          </div>
        ),
      },
    ],
  },
  {
    title: '보상 · 축하',
    emoji: '🎉',
    items: [
      {
        name: '포도알 등장(채움)',
        token: 'animate-grape-fill',
        desc: '작게 터지며 등장하는 포도알',
        render: (n) => (
          <div key={n} className="animate-grape-fill w-12 h-12 rounded-full bg-gradient-to-br from-grape-400 to-grape-600" />
        ),
      },
      {
        name: '보상 공개',
        token: 'animate-reward-reveal',
        desc: '보상이 펼쳐지며 드러남',
        render: (n) => (
          <div key={n} className="animate-reward-reveal text-3xl">🎁</div>
        ),
      },
      {
        name: '스파클',
        token: 'animate-sparkle',
        desc: '반짝하고 회전하는 별',
        render: (n) => (
          <div key={n} className="animate-sparkle text-3xl">✨</div>
        ),
      },
      {
        name: '컨페티',
        token: 'confetti-particle / animate-confetti',
        desc: '위에서 떨어지는 축하 조각들',
        render: (n) => (
          <div key={n} className="relative w-full h-full overflow-hidden">
            {['#9B7ED8', '#F7A1B4', '#7FCB8E', '#F6D365'].map((c, i) => (
              <span
                key={i}
                className="confetti-particle"
                style={{
                  left: `${20 + i * 18}%`,
                  background: c,
                  animationDelay: `${i * 120}ms`,
                } as CSSProperties}
              />
            ))}
          </div>
        ),
      },
      {
        name: '보상 글로우',
        token: 'reward-glow',
        desc: '완성된 보상이 은은하게 빛남',
        loop: true,
        render: () => (
          <div className="reward-glow clay-sm w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl">
            🎁
          </div>
        ),
      },
    ],
  },
  {
    title: '분위기 · 로딩',
    emoji: '🌿',
    items: [
      {
        name: '플로트',
        token: 'animate-float',
        desc: '둥실둥실 떠다니는 마스코트/요소',
        loop: true,
        render: () => <div className="animate-float text-3xl">🍇</div>,
      },
      {
        name: '스켈레톤',
        token: 'skeleton / animate-shimmer',
        desc: '로딩 중 흐르는 반짝임',
        loop: true,
        render: () => <div className="skeleton w-full max-w-[120px] h-8 rounded-xl" />,
      },
      {
        name: '캡슐 열기',
        token: 'capsule-open',
        desc: '타임캡슐이 열리는 모션',
        render: (n) => (
          <div key={n} className="capsule-open text-3xl">⏳</div>
        ),
      },
      {
        name: '와인병 반짝임',
        token: 'wine-bottle-shimmer',
        desc: '와이너리 와인병 위로 흐르는 빛',
        loop: true,
        render: () => (
          <div className="wine-bottle-shimmer clay-sm w-10 h-16 rounded-[40%_40%_30%_30%] bg-gradient-to-b from-grape-400 to-grape-700" />
        ),
      },
    ],
  },
];

export default function AnimationTestPage() {
  // 각 항목별 재생 카운터 (key 로 쓰여 re-mount → 1회성 모션 재생)
  const [nonces, setNonces] = useState<Record<string, number>>({});

  const replay = useCallback((id: string) => {
    setNonces((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const replayAll = useCallback(() => {
    setNonces((prev) => {
      const next: Record<string, number> = {};
      GROUPS.forEach((g) =>
        g.items.forEach((it) => {
          const id = it.token;
          next[id] = (prev[id] ?? 0) + 1;
        }),
      );
      return next;
    });
  }, []);

  const total = GROUPS.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-2">애니메이션 리스트업</h1>
      <p className="text-sm text-warm-sub mb-4">
        앱에서 쓰는 모션 {total}종을 한눈에. 카드를 누르면 다시 재생돼요.
      </p>

      <button
        onClick={replayAll}
        className="clay-button mb-6 px-4 py-2 rounded-xl text-sm font-medium text-grape-700 bg-gradient-to-br from-grape-100 to-grape-50"
      >
        ▶ 전체 다시 재생
      </button>

      <div className="space-y-8">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="font-display text-lg font-bold text-grape-700 mb-3">
              {group.emoji} {group.title}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {group.items.map((item) => {
                const id = item.token;
                const nonce = nonces[id] ?? 0;
                const cardClass = `clay-sm p-3 text-left transition-all ${
                  item.loop ? 'cursor-default' : 'active:scale-[0.97] cursor-pointer'
                }`;
                const inner = (
                  <>
                    <div className="h-20 rounded-xl bg-grape-50/50 flex items-center justify-center mb-2 overflow-hidden px-2">
                      {item.render(nonce)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-sm font-bold text-grape-700">{item.name}</span>
                      {item.loop ? (
                        <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">반복</span>
                      ) : (
                        <span className="text-[10px] text-grape-500">↻ 탭</span>
                      )}
                    </div>
                    <p className="text-xs text-warm-sub mt-0.5 leading-snug">{item.desc}</p>
                    <code className="text-[10px] text-warm-light block mt-1 truncate">{item.token}</code>
                  </>
                );
                // 반복 모션은 상호작용이 없으므로 비활성 div 로 — 스크린리더/탭 포커스 제외
                return item.loop ? (
                  <div key={id} className={cardClass}>
                    {inner}
                  </div>
                ) : (
                  <button key={id} type="button" onClick={() => replay(id)} className={cardClass}>
                    {inner}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
