'use client';

import { useEffect, useState } from 'react';
import EmojiIcon from './EmojiIcon';
import Confetti from './Confetti';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

interface StreakCardProps {
  /** 서버(/api/stats) 판정 그대로 표시 — 클라에서 스트릭을 재계산하지 않는다(KST 어긋남 방지). */
  streak: StreakInfo;
}

const MILESTONE_KEY = 'podoal-streak-milestone';
// 큰 것 우선 — 도달한 가장 높은 마일스톤만 1회 축하하고 기록한다.
const MILESTONES = [100, 30, 7];

/**
 * 홈 헤더 아래 고정 스트릭 카드 — '처벌 없는 정서 톤'.
 * 항상 1줄(불꽃 + 연속 일수 + 최장 칩).
 */
export default function StreakCard({ streak }: StreakCardProps) {
  const { currentStreak, longestStreak } = streak;
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  // 마일스톤(7/30/100) 도달 시 1회 축하 — localStorage 기록으로 같은 마일스톤 재발동 금지.
  // localStorage 접근은 렌더 중 금지(react-hooks/purity) → effect 안에서만.
  useEffect(() => {
    const milestone = MILESTONES.find((m) => currentStreak >= m);
    if (!milestone) return;
    try {
      const recorded = Number(localStorage.getItem(MILESTONE_KEY) || '0');
      if (recorded >= milestone) return;
      localStorage.setItem(MILESTONE_KEY, String(milestone));
      setConfettiTrigger((t) => t + 1);
    } catch {
      /* localStorage 불가 환경 — 축하만 생략 */
    }
  }, [currentStreak]);

  return (
    <div className="clay-float px-4 py-3 mb-4 bg-grape-50/80">
      {/* min-h-9: 유예 칩(10px 2줄, 36px) 제거 후에도 행 높이를 36px로 고정 —
          홈의 로딩 스켈레톤 h-[62px](py-3 24px + 36px + 보더 2.6px)과 정합 유지. */}
      <div className="flex min-h-9 items-center gap-2.5">
        <EmojiIcon emoji="🔥" size={26} label="연속 기록" />
        {currentStreak > 0 ? (
          <p className="min-w-0 flex-1 text-sm text-warm-text">
            연속{' '}
            <span className="font-display text-xl font-extrabold text-grape-600 tabular-nums align-[-1px]">
              {currentStreak}
            </span>
            일째 모으고 있어요
          </p>
        ) : (
          // 스트릭 0 — 협박/경고색 없이 다시 시작을 권하는 톤.
          <p className="min-w-0 flex-1 text-sm text-warm-text inline-flex items-center gap-1">
            오늘 한 알부터 다시 시작해요 <EmojiIcon emoji="🍇" size={16} />
          </p>
        )}
        <p className="shrink-0 text-[10px] text-warm-sub">
          최장 <span className="tabular-nums">{longestStreak}</span>일
        </p>
      </div>

      <Confetti trigger={confettiTrigger} />
    </div>
  );
}
