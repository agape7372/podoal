'use client';

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
  return (
    <div role="group" aria-label={`${current + 1}/${total} 단계`} className="flex gap-1 mb-6">
      {Array.from({ length: total }, (_, s) => (
        <button
          key={s}
          type="button"
          disabled={s >= current}
          aria-label={`${s + 1}단계로 돌아가기`}
          onClick={() => { feedbackTap(); onJump(s); }}
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
