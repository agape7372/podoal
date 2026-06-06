'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { AVATAR_OPTIONS, type UserProfile } from '@/types';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';
import Avatar from '@/components/Avatar';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmojiIcon from '@/components/EmojiIcon';

interface WineryResp {
  totalGrapes: number;
  currentTier: { level: number; name: string; icon: string };
  nextTier: { minGrapes: number; name: string; icon: string } | null;
  tierProgress: number;
}
interface StatsResp {
  stats: { completedBoards: number; currentStreak: number; friendsCount: number };
}
interface Summary {
  totalGrapes: number;
  tierName: string;
  tierIcon: string;
  tierLevel: number;
  tierProgress: number;
  nextTierName: string | null;
  nextTierGap: number | null;
  completedBoards: number;
  currentStreak: number;
  friendsCount: number;
}

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', kakao: '카카오', naver: '네이버' };
const AVATAR_LABEL: Record<string, string> = {
  grape: '포도', strawberry: '딸기', orange: '오렌지', blueberry: '블루베리',
  cherry: '체리', peach: '복숭아', apple: '사과', watermelon: '수박',
};

const SHORTCUTS = [
  { label: '설정', emoji: '⚙️', path: '/settings' },
  { label: '알림 설정', emoji: '🔔', path: '/notifications' },
  { label: '통계', emoji: '📊', path: '/stats' },
  { label: '와이너리', emoji: '🍷', path: '/winery' },
] as const;

export default function ProfilePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  const [editName, setEditName] = useState(user?.name ?? '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar ?? 'grape');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);

  const [confirmLogout, setConfirmLogout] = useState(false);

  // Lazy-load the growth summary. Guarded against unmount (navigation away).
  useEffect(() => {
    let cancelled = false;
    Promise.all([api<WineryResp>('/api/winery'), api<StatsResp>('/api/stats')])
      .then(([w, s]) => {
        if (cancelled) return;
        setSummary({
          totalGrapes: w.totalGrapes,
          tierName: w.currentTier.name,
          tierIcon: w.currentTier.icon,
          tierLevel: w.currentTier.level,
          tierProgress: w.tierProgress,
          nextTierName: w.nextTier?.name ?? null,
          nextTierGap: w.nextTier ? Math.max(0, w.nextTier.minGrapes - w.totalGrapes) : null,
          completedBoards: s.stats.completedBoards,
          currentStreak: s.stats.currentStreak,
          friendsCount: s.stats.friendsCount,
        });
      })
      .catch(() => { if (!cancelled) setSummaryError(true); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!user) return null;

  const dirty = editName.trim() !== user.name || editAvatar !== user.avatar;
  const canSave = dirty && editName.trim().length > 0 && !saving;

  const base = user.provider ? user.provider.replace('_guest', '') : null;
  const isGuest = !!user.provider?.endsWith('_guest');
  const providerLabel = base ? `${PROVIDER_LABEL[base] ?? base}${isGuest ? ' 체험' : ''}` : null;

  const handleSave = async () => {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    setSaveError('');
    try {
      const data = await api<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PATCH',
        json: { name, avatar: editAvatar },
      });
      setUser(data.user);
      feedbackSuccess();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/me', { method: 'POST' });
    } finally {
      useAppStore.getState().setUser(null);
      router.replace('/');
    }
  };

  const go = (path: string) => {
    feedbackTap();
    router.push(path);
  };

  const stats: { label: string; value: number; suffix?: string }[] = [
    { label: '총 포도알', value: summary?.totalGrapes ?? 0 },
    { label: '연속', value: summary?.currentStreak ?? 0, suffix: '일' },
    { label: '완료 포도판', value: summary?.completedBoards ?? 0 },
    { label: '친구', value: summary?.friendsCount ?? 0 },
  ];

  return (
    <div className="pb-4">
      {/* Back */}
      <button
        onClick={() => router.push('/home')}
        className="clay-button px-3 py-2 rounded-xl text-sm text-warm-sub mb-5"
      >
        ← 돌아가기
      </button>

      {/* Identity */}
      <div className="flex items-center gap-3.5 mb-6">
        <Avatar avatar={editAvatar} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-warm-text truncate leading-tight">
            {user.name}
            <span className="text-warm-sub font-normal text-lg">님</span>
          </h1>
          <p className="text-sm text-warm-sub truncate mt-0.5">{user.email}</p>
          {providerLabel && (
            <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full bg-grape-50 text-grape-600 text-[11px] font-medium">
              {providerLabel} 로그인
            </span>
          )}
        </div>
      </div>

      {/* Growth summary */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-warm-text mb-2.5 ml-0.5">내 성장</h2>

        {summaryLoading ? (
          <div className="space-y-2.5">
            <div className="skeleton h-[88px] w-full rounded-3xl" />
            <div className="grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
            </div>
          </div>
        ) : (
          <>
            <div className="clay-sm bg-grape-50 rounded-3xl p-4">
              <div className="flex items-center gap-2.5">
                <EmojiIcon emoji={summary?.tierIcon ?? '🍇'} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-grape-700 truncate leading-tight">
                    {summaryError ? '—' : summary?.tierName}
                  </p>
                  {!summaryError && (
                    <p className="text-[11px] text-warm-sub leading-none mt-0.5 tabular-nums">
                      Lv.{summary?.tierLevel}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-grape-300 to-grape-500 transition-all duration-500"
                  style={{ width: `${summaryError ? 0 : summary?.tierProgress ?? 0}%` }}
                />
              </div>
              <p className="text-[11px] text-warm-sub mt-1.5 ml-0.5 tabular-nums">
                {summaryError
                  ? '성장 정보를 불러오지 못했어요'
                  : summary?.nextTierName
                    ? `${summary.nextTierName}까지 ${summary.nextTierGap}알`
                    : '최고 등급 달성! 🎉'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-2.5">
              {stats.map((s) => (
                <div key={s.label} className="clay-sm rounded-2xl p-3 flex flex-col items-center justify-center">
                  <span className="font-display text-xl font-bold text-grape-700 tabular-nums leading-none">
                    {summaryError ? '—' : s.value.toLocaleString()}
                    {!summaryError && s.suffix && (
                      <span className="text-sm font-normal text-warm-sub ml-0.5">{s.suffix}</span>
                    )}
                  </span>
                  <span className="text-[11px] text-warm-sub mt-1.5 leading-none">{s.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Edit */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-warm-text mb-2.5 ml-0.5">프로필 수정</h2>

        <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">나를 표현하는 과일</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {AVATAR_OPTIONS.map((av) => {
            const selected = editAvatar === av;
            return (
              <button
                key={av}
                type="button"
                onClick={() => { feedbackTap(); setEditAvatar(av); }}
                aria-label={AVATAR_LABEL[av] ?? av}
                aria-pressed={selected}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  selected ? 'clay-pressed ring-2 ring-grape-400' : 'clay-button'
                }`}
              >
                <img src={`/avatars/${av}.svg`} alt="" width={30} height={30} draggable={false} />
              </button>
            );
          })}
        </div>

        <ClayInput
          label="이름"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          maxLength={40}
          placeholder="이름"
        />

        {saveError && (
          <p role="alert" className="text-rose-700 text-sm mt-2 ml-1">{saveError}</p>
        )}

        <div className="mt-3">
          <ClayButton variant="primary" fullWidth loading={saving} disabled={!canSave} onClick={handleSave}>
            저장하기
          </ClayButton>
        </div>
      </section>

      {/* Shortcuts */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-warm-text mb-2.5 ml-0.5">바로가기</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {SHORTCUTS.map((s) => (
            <button
              key={s.path}
              onClick={() => go(s.path)}
              className="clay-button rounded-2xl px-3.5 py-3 flex items-center gap-2.5 text-sm font-medium text-warm-text"
            >
              <EmojiIcon emoji={s.emoji} size={20} />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Logout */}
      <ClayButton
        variant="ghost"
        fullWidth
        onClick={() => { feedbackTap(); setConfirmLogout(true); }}
        className="text-rose-600 hover:bg-rose-50"
      >
        로그아웃
      </ClayButton>

      <ConfirmDialog
        open={confirmLogout}
        title="로그아웃 할까요?"
        description="다시 로그인하면 포도판은 그대로 있어요."
        confirmLabel="로그아웃"
        cancelLabel="취소"
        destructive
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
