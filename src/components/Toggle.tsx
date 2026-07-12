'use client';

type ToggleProps = {
  enabled: boolean;
  onToggle: () => void;
  size?: 'default' | 'large';
  disabled?: boolean;
  ariaLabel: string;
};

// 공용 토글 스위치 — 시각 정본은 settings/page.tsx 구현(2026-07-13 FE-1).
// transition-[left]로 실제 변하는 속성만 명시(모션 규약, transition-all 금지).
// size='large' 변형(notifications 전역 알림 토글용)을 함께 지원한다.
export default function Toggle({ enabled, onToggle, size = 'default', disabled = false, ariaLabel }: ToggleProps) {
  const isLarge = size === 'large';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      onClick={onToggle}
      disabled={disabled}
      className={`${isLarge ? 'w-14 h-8' : 'w-12 h-7'} shrink-0 rounded-full transition-colors duration-200 relative disabled:opacity-60 ${
        enabled ? 'bg-linear-to-r from-grape-400 to-grape-500' : 'bg-warm-border'
      }`}
    >
      <div
        className={`${isLarge ? 'w-6 h-6' : 'w-5 h-5'} rounded-full bg-white shadow-md absolute top-1 transition-[left] duration-200 ${
          enabled ? (isLarge ? 'left-7' : 'left-6') : 'left-1'
        }`}
      />
    </button>
  );
}
