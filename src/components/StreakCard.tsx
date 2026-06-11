'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { feedbackTap } from '@/lib/feedback';
import EmojiIcon from './EmojiIcon';
import ConfirmDialog from './ConfirmDialog';
import Confetti from './Confetti';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  freezeAvailable: boolean;
  freezeSuggestion: boolean;
}

interface StreakCardProps {
  /** 서버(/api/stats) 판정 그대로 표시 — 클라에서 스트릭을 재계산하지 않는다(KST 어긋남 방지). */
  streak: StreakInfo;
  /** 유예 사용 직후 stats 재조회(서버 응답이 단일 진실). */
  onRefresh: () => void;
  /** 실패 안내(해요체) — 홈 토스트로 띄운다. */
  onError: (msg: string) => void;
}

const MILESTONE_KEY = 'podoal-streak-milestone';
// 큰 것 우선 — 도달한 가장 높은 마일스톤만 1회 축하하고 기록한다.
const MILESTONES = [100, 30, 7];

/**
 * 홈 헤더 아래 고정 스트릭 카드 — '처벌 없는 정서 톤'.
 * 평소 1줄(불꽃 + 연속 일수 + 최장/유예 칩), 유예 제안 시에만 CTA 1줄 추가.
 */
export default function StreakCard({ streak, onRefresh, onError }: StreakCardProps) {
  const { currentStreak, longestStreak, freezeAvailable, freezeSuggestion } = streak;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [freezing, setFreezing] = useState(false);
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

  const useFreeze = async () => {
    if (freezing) return;
    setFreezing(true);
    try {
      await api('/api/streak/freeze', { method: 'POST' });
      setConfirmOpen(false);
      setConfettiTrigger((t) => t + 1);
      onRefresh();
    } catch (e) {
      setConfirmOpen(false);
      onError(e instanceof Error ? e.message : '유예를 사용하지 못했어요. 잠시 후 다시 시도해주세요.');
      onRefresh(); // 서버 상태와 어긋났을 수 있으니 재동기화(제안 버튼 노출 여부 갱신)
    } finally {
      setFreezing(false);
    }
  };

  return (
    <div className="clay-float px-4 py-3 mb-4 bg-grape-50/80">
      <div className="flex items-center gap-2.5">
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
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-warm-sub">
            최장 <span className="tabular-nums">{longestStreak}</span>일
          </p>
          <p className="text-[10px] text-warm-sub mt-0.5">
            {freezeAvailable ? '유예 1회 보유' : '유예 사용함'}
          </p>
        </div>
      </div>

      {freezeSuggestion && (
        <button
          onClick={() => {
            feedbackTap();
            setConfirmOpen(true);
          }}
          className="clay-button mt-2.5 w-full py-2 rounded-2xl text-sm font-semibold text-grape-700"
        >
          유예 1회로 이어붙이기
        </button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="유예로 이어붙일까요?"
        description="비어 있는 어제 하루를 유예로 채워서 스트릭을 이어가요. 유예는 딱 한 번만 쓸 수 있어요."
        confirmLabel="이어붙이기"
        loading={freezing}
        onConfirm={useFreeze}
        onCancel={() => {
          if (!freezing) setConfirmOpen(false);
        }}
      />

      <Confetti trigger={confettiTrigger} />
    </div>
  );
}
