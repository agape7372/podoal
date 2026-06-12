'use client';

import { useRef } from 'react';
import { feedbackTap } from '@/lib/feedback';

interface StepProgressProps {
  total: number;
  current: number;
  onJump: (step: number) => void;
}

/**
 * 포도판/포도동 만들기 공용 슬림 진행 바.
 * 완료된 이전 단계(s < current)만 탭으로 점프 가능 — 미래 단계는 disabled로
 * 막아 각 step의 '다음' 검증을 우회할 수 없게 한다.
 */
export default function StepProgress({ total, current, onJump }: StepProgressProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  return (
    // tabIndex=-1: 점프 직후 방금 누른 버튼이 disabled로 바뀌며 포커스가 body로
    // 떨어지므로 컨테이너로 회수한다 — aria-label('N/M 단계')이 재낭독되고 Tab이
    // 인디케이터부터 재개. 프로그래매틱 포커스는 :focus-visible 미발동(링 없음).
    <div ref={groupRef} tabIndex={-1} role="group" aria-label={`${current + 1}/${total} 단계`} className="flex gap-1 mb-6">
      {Array.from({ length: total }, (_, s) => (
        <button
          key={s}
          type="button"
          disabled={s >= current}
          aria-label={`${s + 1}단계로 돌아가기`}
          onClick={() => {
            feedbackTap();
            onJump(s);
            // rAF: disabled 전환이 커밋돼 포커스가 유실된 다음 프레임에 회수.
            requestAnimationFrame(() => groupRef.current?.focus());
          }}
          // py-2/-my-2: 1.5px 바를 시각 변화 없이 ~22px 히트영역으로 확장
          className="flex-1 py-2 -my-2"
        >
          <span
            className={`block h-1.5 rounded-full transition-colors ${s <= current ? 'bg-grape-400' : 'bg-grape-100'}`}
          />
        </button>
      ))}
    </div>
  );
}
