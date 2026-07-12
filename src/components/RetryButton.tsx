'use client';

import ClayButton from '@/components/ClayButton';

type RetryButtonProps = {
  onRetry: () => void;
  label?: string;
};

// 공용 재시도 버튼 — home/page.tsx의 ClayButton(secondary) 사용례가 정본(2026-07-13 FE-1).
export default function RetryButton({ onRetry, label = '다시 불러오기' }: RetryButtonProps) {
  return (
    <ClayButton variant="secondary" onClick={onRetry}>
      {label}
    </ClayButton>
  );
}
