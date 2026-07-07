'use client';

import NumberStepper from '@/components/NumberStepper';
import { feedbackTap } from '@/lib/feedback';
import type { CadenceType } from '@/types';

interface CadencePickerProps {
  cadenceType: CadenceType;
  /** DAILY_N/WEEKLY_N일 때만 의미 있음 — FREE/DAILY_1에서는 부모가 무시하고 null로 저장. */
  cadenceN: number;
  onChange: (type: CadenceType, n: number) => void;
}

const OPTIONS: { type: CadenceType; label: string }[] = [
  { type: 'FREE', label: '자유롭게' },
  { type: 'DAILY_1', label: '하루 한 알' },
  { type: 'DAILY_N', label: '하루 여러 알' },
  { type: 'WEEKLY_N', label: '일주일 목표' },
];

// 스텝퍼를 처음 여는 순간(=이전 값이 그 타입 범위 밖일 때)의 기본값. FILL_CADENCE_PLAN §2 기본 3.
const DEFAULT_N: Record<'DAILY_N' | 'WEEKLY_N', number> = { DAILY_N: 3, WEEKLY_N: 3 };
const N_RANGE: Record<'DAILY_N' | 'WEEKLY_N', { min: number; max: number }> = {
  DAILY_N: { min: 2, max: 10 },
  WEEKLY_N: { min: 1, max: 7 },
};

/**
 * 생성 스텝2(크기) 하단 서브 섹션 — "채우는 리듬"(FILL_CADENCE_PLAN §2 C1).
 * giftTo(선물 생성) 플로우에서는 부모가 이 컴포넌트를 아예 렌더하지 않고 FREE로 고정한다
 * (board/create/page.tsx: `{!giftTo && <CadencePicker .../>}` + 제출 payload 이중 고정).
 */
export default function CadencePicker({ cadenceType, cadenceN, onChange }: CadencePickerProps) {
  const select = (type: CadenceType) => {
    feedbackTap();
    if (type === 'DAILY_N' || type === 'WEEKLY_N') {
      const { min, max } = N_RANGE[type];
      const n = cadenceN >= min && cadenceN <= max ? cadenceN : DEFAULT_N[type];
      onChange(type, n);
    } else {
      // FREE/DAILY_1은 N을 안 쓰므로(부모가 제출 시 무시) 그대로 흘려보낸다 — 여기서
      // 0으로 밀어버리면 다시 DAILY_N/WEEKLY_N으로 돌아왔을 때 템플릿이 제안한 N(예:
      // 물마시기 8)이 사라지고 매번 기본값 3으로 리셋되는 회귀가 생긴다.
      onChange(type, cadenceN);
    }
  };

  return (
    <div className="space-y-3 pt-4 mt-1 border-t border-warm-border/55">
      <p className="text-sm text-warm-sub">채우는 리듬</p>

      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => select(opt.type)}
            aria-pressed={cadenceType === opt.type}
            className={`clay-button px-3 py-2.5 rounded-xl text-sm font-medium text-center ${
              cadenceType === opt.type ? 'ring-2 ring-grape-400 clay-pressed text-grape-700' : 'text-warm-sub'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {(cadenceType === 'DAILY_N' || cadenceType === 'WEEKLY_N') && (
        <div className="clay-sm p-4 flex flex-col items-center">
          <NumberStepper
            value={cadenceN}
            onChange={(n) => onChange(cadenceType, n)}
            min={N_RANGE[cadenceType].min}
            max={N_RANGE[cadenceType].max}
            unit="알"
          />
        </div>
      )}

      <p className="text-xs text-warm-sub text-center text-balance">
        {cadenceType === 'FREE'
          ? '언제든 자유롭게 채워요'
          : '포도는 하루아침에 익지 않아요 · 리듬을 정하면 다음 알이 익을 때까지 기다렸다 채워요'}
      </p>
    </div>
  );
}
