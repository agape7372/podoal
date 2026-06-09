'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { AVATAR_OPTIONS, type UserProfile } from '@/types';
import { feedbackSuccess, feedbackTap } from '@/lib/feedback';
import Avatar from '@/components/Avatar';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import ConfirmDialog from '@/components/ConfirmDialog';

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', kakao: '카카오', naver: '네이버' };
const AVATAR_LABEL: Record<string, string> = {
  grape: '포도', strawberry: '딸기', orange: '오렌지', blueberry: '블루베리',
  cherry: '체리', peach: '복숭아', apple: '사과', watermelon: '수박',
};
// Avatar SVGs carry a baked <g data-centered transform> per fruit. These translate/scale
// values were dialed in BY THE USER via a throwaway interactive tuner (public/avatar-tuner.html,
// 2026-06-06 — removed after baking) so each fruit is centred to the user's own eye, not an
// algorithm. To re-tune, recreate a tuner, adjust, and re-bake; to reset, strip the
// <g data-centered> wrapper.

export default function ProfilePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  const [editName, setEditName] = useState(user?.name ?? '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar ?? 'grape');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!user) return null;

  const dirty = editName.trim() !== user.name || editAvatar !== user.avatar;
  const canSave = dirty && editName.trim().length > 0 && !saving;

  const base = user.provider ? user.provider.replace('_guest', '') : null;
  const isGuest = !!user.provider?.endsWith('_guest');
  const providerLabel = base ? `${PROVIDER_LABEL[base] ?? base}${isGuest ? ' 체험' : ''}` : null;

  const pickAvatar = (av: string) => { feedbackTap(); setEditAvatar(av); setSaved(false); };
  const changeName = (v: string) => { setEditName(v); setSaved(false); };

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
      setSaved(true);
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

  return (
    <div className="pb-4">
      {/* 돌아가기 버튼 제거(REQ5): 프로필은 홈 아바타로만 진입하고 하단 네비 '홈'이 항상
          /profile을 owns하여 복귀 경로를 보장 — 별도 백 버튼은 중복. */}

      {/* Identity */}
      <div className="flex items-center gap-3.5 mb-7">
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

      {/* Edit — the page's sole focus */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-warm-text mb-3 ml-0.5">프로필 수정</h2>

        <div className="flex flex-wrap gap-3 mb-5">
          {AVATAR_OPTIONS.map((av) => {
            const selected = editAvatar === av;
            return (
              <button
                key={av}
                type="button"
                onClick={() => pickAvatar(av)}
                aria-label={AVATAR_LABEL[av] ?? av}
                aria-pressed={selected}
                className={`rounded-full transition-transform ${
                  selected
                    ? 'ring-2 ring-grape-500 ring-offset-2 scale-105'
                    : 'opacity-70 hover:opacity-100 active:scale-95'
                }`}
              >
                <Avatar avatar={av} size="md" />
              </button>
            );
          })}
        </div>

        <ClayInput
          label="이름"
          value={editName}
          onChange={(e) => changeName(e.target.value)}
          maxLength={40}
          placeholder="이름"
        />

        {saveError ? (
          <p role="alert" className="text-rose-700 text-sm mt-2 ml-1">{saveError}</p>
        ) : saved && !dirty ? (
          <p className="text-grape-600 text-sm mt-2 ml-1">저장됐어요 ✓</p>
        ) : null}

        <div className="mt-4">
          <ClayButton variant="primary" fullWidth loading={saving} disabled={!canSave} onClick={handleSave}>
            저장하기
          </ClayButton>
        </div>
      </section>

      {/* Logout (account action) */}
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
