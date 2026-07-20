'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { clearPageCache } from '@/lib/cachedApi';
import { resetConsent } from '@/lib/analytics';
import { AVATAR_OPTIONS, type UserProfile } from '@/types';
import { feedbackError, feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { describeAuthError } from '@/lib/authErrors';
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
  const user = useAppStore((s) => s.user);
  // 인증이 자식 렌더와 병렬로 진행되므로(레이아웃이 user 로딩을 기다리지 않음)
  // user가 아직 없을 때 폼이 마운트되면 useState 초기값이 빈값으로 굳는다 →
  // user가 준비된 뒤에 폼 컴포넌트를 마운트해 초기값을 보장한다. auth 리다이렉트는
  // 레이아웃이 담당 — 여기서는 그 사이의 blank 화면만 헤더+아바타 스켈레톤으로 메운다.
  if (!user) {
    return (
      <div className="pb-4">
        <div className="flex items-center gap-3.5 mb-7">
          <div className="skeleton w-20 h-20 rounded-full shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-6 w-32" />
            <div className="skeleton h-4 w-44" />
          </div>
        </div>
      </div>
    );
  }
  return <ProfileView user={user} />;
}

function ProfileView({ user }: { user: UserProfile }) {
  const setUser = useAppStore((s) => s.setUser);
  const resetEphemeral = useAppStore((s) => s.resetEphemeral);

  const [editName, setEditName] = useState(user.name);
  const [editAvatar, setEditAvatar] = useState(user.avatar);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // ── 계정 섹션(W1-D-UI): 로그아웃 · 비밀번호 변경 · 회원탈퇴 ──
  const isEmailAccount = user.provider == null;

  const [loggingOut, setLoggingOut] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const [confirmDeleteStep1, setConfirmDeleteStep1] = useState(false);
  const [confirmDeleteStep2, setConfirmDeleteStep2] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      setSaveError(describeAuthError(e instanceof Error ? e.message : '저장에 실패했어요'));
    } finally {
      setSaving(false);
    }
  };

  // 하드 이동(window.location.href) — router.push/replace는 클라 상태(Zustand 등)를
  // 리셋하지 않는다. 로그아웃/탈퇴는 다음 사용자를 위해 전부 리셋되어야 한다(카드 스펙).
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // 네트워크 실패해도 클라에서 나가는 흐름은 유지 — 쿠키가 안 지워졌을 가능성은
      // 있으나, 사용자를 로그아웃 시트에 무한정 가둬두는 것보다 안전한 폴백.
    } finally {
      // 하드 이동은 메모리만 리셋한다 — localStorage 영속(user 스냅샷·페이지 캐시)은
      // 명시적으로 비워야 다음 사용자에게 이전 계정 데이터가 비치지 않는다.
      setUser(null);
      clearPageCache();
      // 휘발 슬라이스 잔재 제거 + 분석 동의를 미응답으로 되돌림(기기 전역 키가 다음
      // 계정에 이전 사용자의 동의/거부를 상속하지 않도록) — 2026-07-19 결함 수정.
      resetEphemeral();
      resetConsent();
      window.location.href = '/';
    }
  };

  const handleChangePassword = async () => {
    if (pwSaving) return;
    setPwError('');
    if (newPassword.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 해요');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('새 비밀번호가 일치하지 않아요');
      return;
    }
    setPwSaving(true);
    try {
      await api('/api/auth/password', {
        method: 'PATCH',
        json: { currentPassword, newPassword },
      });
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      feedbackSuccess();
    } catch (e) {
      setPwError(describeAuthError(e instanceof Error ? e.message : '비밀번호 변경에 실패했어요'));
      feedbackError();
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api('/api/auth/me', { method: 'DELETE' });
      // 로그아웃과 동일 — localStorage 영속(user 스냅샷·페이지 캐시)까지 비운다.
      setUser(null);
      clearPageCache();
      // 휘발 슬라이스 잔재 제거 + 분석 동의를 미응답으로 되돌림(로그아웃과 동일 사유).
      resetEphemeral();
      resetConsent();
      window.location.href = '/';
    } catch (e) {
      setDeleting(false);
      setConfirmDeleteStep2(false);
      feedbackError();
      // 이 페이지에 남아 안내 — ConfirmDialog는 이미 닫혔으므로 별도 배너로 알린다.
      setDeleteError(describeAuthError(e instanceof Error ? e.message : '탈퇴에 실패했어요'));
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

      {/* Account (W1-D-UI): 로그아웃 · 비밀번호 변경 · 회원탈퇴 */}
      <section className="mb-4">
        <h2 className="text-sm font-bold text-warm-text mb-3 ml-0.5">계정</h2>

        <div className="clay overflow-hidden">
          {/* 로그아웃 */}
          <button
            type="button"
            onClick={() => { feedbackTap(); setConfirmLogout(true); }}
            disabled={loggingOut}
            className="w-full flex items-center justify-between p-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <span className="text-sm font-medium text-warm-text">로그아웃</span>
            {loggingOut && (
              <span className="w-4 h-4 border-2 border-warm-sub/40 border-t-warm-sub rounded-full animate-spin" aria-hidden="true" />
            )}
          </button>

          {/* 비밀번호 변경 (이메일 계정만) */}
          {isEmailAccount ? (
            <div className="border-t border-warm-border/55">
              <button
                type="button"
                onClick={() => {
                  feedbackTap();
                  setPwOpen((v) => !v);
                  setPwError('');
                  setPwSuccess(false);
                }}
                aria-expanded={pwOpen}
                className="w-full flex items-center justify-between p-4 text-left transition-transform active:scale-[0.98]"
              >
                <span className="text-sm font-medium text-warm-text">비밀번호 변경</span>
                <span className={`text-warm-sub transition-transform ${pwOpen ? 'rotate-90' : ''}`} aria-hidden="true">›</span>
              </button>

              {pwOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <ClayInput
                    type="password"
                    label="현재 비밀번호"
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setPwSuccess(false); }}
                    autoComplete="current-password"
                  />
                  <ClayInput
                    type="password"
                    label="새 비밀번호"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPwSuccess(false); }}
                    autoComplete="new-password"
                  />
                  <ClayInput
                    type="password"
                    label="새 비밀번호 확인"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPwSuccess(false); }}
                    autoComplete="new-password"
                  />

                  {pwError ? (
                    <p role="alert" className="text-rose-700 text-sm ml-1">{pwError}</p>
                  ) : pwSuccess ? (
                    <p className="text-grape-600 text-sm ml-1">비밀번호를 바꿨어요</p>
                  ) : null}

                  <ClayButton
                    variant="primary"
                    fullWidth
                    loading={pwSaving}
                    disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
                    onClick={handleChangePassword}
                  >
                    변경하기
                  </ClayButton>
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-warm-border/55 p-4">
              <p className="text-xs text-warm-sub">소셜 계정은 비밀번호가 없어요</p>
            </div>
          )}

          {/* 회원탈퇴 */}
          <button
            type="button"
            onClick={() => { feedbackTap(); setConfirmDeleteStep1(true); }}
            disabled={deleting}
            className="w-full flex items-center justify-between p-4 text-left transition-transform active:scale-[0.98] border-t border-warm-border/55 disabled:opacity-60"
          >
            <span className="text-sm font-medium text-juice-700">회원탈퇴</span>
            {deleting && (
              <span className="w-4 h-4 border-2 border-juice-300 border-t-juice-700 rounded-full animate-spin" aria-hidden="true" />
            )}
          </button>
        </div>

        {deleteError && (
          <p role="alert" className="text-rose-700 text-sm mt-2 ml-1">{deleteError}</p>
        )}
      </section>

      <ConfirmDialog
        open={confirmLogout}
        title="로그아웃 할까요?"
        description="다시 로그인하면 포도판은 그대로 있어요."
        confirmLabel="로그아웃"
        cancelLabel="취소"
        destructive
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />

      <ConfirmDialog
        open={confirmDeleteStep1}
        title="정말 떠나시나요?"
        description="포도판·친구·기록이 모두 사라져요"
        confirmLabel="계속"
        cancelLabel="취소"
        destructive
        onConfirm={() => { setConfirmDeleteStep1(false); setConfirmDeleteStep2(true); }}
        onCancel={() => setConfirmDeleteStep1(false)}
      />

      <ConfirmDialog
        open={confirmDeleteStep2}
        title="되돌릴 수 없어요"
        description="정말 삭제할까요?"
        confirmLabel="삭제하기"
        cancelLabel="취소"
        destructive
        loading={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDeleteStep2(false)}
      />
    </div>
  );
}
