'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import InstallPrompt from '@/components/InstallPrompt';
import Podo from '@/components/mascot/Podo';
import EmojiIcon from '@/components/EmojiIcon';
import { AVATAR_OPTIONS } from '@/types';
import { api, fetchUser } from '@/lib/api';
import { clearPageCache } from '@/lib/cachedApi';
import { useAppStore } from '@/lib/store';
import { describeAuthError } from '@/lib/authErrors';
import { track, markOAuthStart } from '@/lib/analytics';

type Mode = 'welcome' | 'login' | 'register';

// UI display labels only — the data-layer identifiers stay 'google'/'kakao'/'naver'.
const PROVIDER_KO: Record<string, string> = { google: '구글', kakao: '카카오', naver: '네이버' };

function describeOAuthError(code: string): string {
  if (code.startsWith('oauth_not_configured')) {
    const provider = code.split(':')[1] || '소셜';
    const ko = PROVIDER_KO[provider] ?? provider;
    return `${ko} 로그인이 아직 준비 중이에요. 잠시 후 다시 시도해주세요.`;
  }
  if (code.startsWith('oauth_email_taken_by_')) {
    const provider = code.replace('oauth_email_taken_by_', '');
    const ko = PROVIDER_KO[provider] ?? provider;
    return `같은 이메일이 이미 ${ko}로 가입돼 있어요. ${ko}로 로그인해주세요.`;
  }
  if (code.includes('bad_state')) return '세션이 만료됐어요. 다시 시도해주세요.';
  if (code.includes('missing_code')) return '로그인이 취소됐어요.';
  if (code.includes('token_failed') || code.includes('userinfo_failed') || code.includes('create_failed')) {
    return '소셜 로그인 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
  }
  return '로그인 중 오류가 발생했어요.';
}

export default function AuthPage() {
  // SW 등록을 (app) 레이아웃에만 두면 첫 방문(웰컴)은 Chrome PWA 설치 조건
  // (manifest+SW) 자체가 미충족 — 설치 배너가 영영 안 뜬다(2026-07-06 베타 보고).
  // 등록은 멱등이라 로그인 후 (app) 레이아웃의 재등록과 충돌 없음.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center">
        <Podo size={72} className="animate-float" />
      </div>
    }>
      <AuthPageInner />
      {/* 로그인 전에도 설치 경로 노출(안드로이드 네이티브 프롬프트/iOS 수동 안내) —
          신규 사용자 온보딩의 첫 화면이 웰컴이므로 여기가 실질적 설치 접점. */}
      <InstallPrompt />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAppStore((s) => s.setUser);
  const [mode, setMode] = useState<Mode>('welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('grape');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  type ProviderInfo = { real: boolean; ready: boolean };
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderInfo>>({
    google: { real: false, ready: true },
    kakao: { real: false, ready: true },
    naver: { real: false, ready: true },
  });

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(describeOAuthError(oauthError));
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('provider');
      window.history.replaceState({}, '', url.toString());
    }
    fetchUser().then((u) => {
      if (u) {
        setUser(u);
        router.replace('/home');
      } else {
        setChecking(false);
      }
    });
    fetch('/api/auth/providers')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.providers) setProviderStatus(data.providers); })
      .catch(() => {});
  }, [router, setUser, searchParams]);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!name.trim()) { setError('이름을 입력해주세요'); setLoading(false); return; }
        const data = await api<{ user: { id: string; name: string; email: string; avatar: string } }>('/api/auth/register', {
          method: 'POST',
          json: { name: name.trim(), email: email.trim(), password, avatar },
        });
        setUser(data.user);
        track('signup_completed', { method: 'email' });
      } else {
        const data = await api<{ user: { id: string; name: string; email: string; avatar: string } }>('/api/auth/login', {
          method: 'POST',
          json: { email: email.trim(), password },
        });
        setUser(data.user);
        track('login_completed', { method: 'email' });
      }
      // 사용자 전환 가능 지점 — 이전 계정의 페이지 캐시가 새 계정 화면에 비치지 않게 비움.
      clearPageCache();
      router.replace('/home');
    } catch (e) {
      setError(describeAuthError(e instanceof Error ? e.message : '오류가 발생했어요'));
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Podo size={88} className="animate-float" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      {/* Logo & Welcome */}
      {mode === 'welcome' && (
        <div className="text-center animate-fade-in w-full max-w-sm">
          <div className="mb-4 flex justify-center">
            <Podo size={140} className="animate-float" />
          </div>
          <h1 className="font-display text-[44px] leading-none font-bold text-grape-700 mb-2 tracking-tight">
            podoal
          </h1>
          <p className="font-display text-warm-sub mb-1 text-[15px]">한 알씩, 매일의 기록</p>
          <p className="text-sm text-warm-sub mb-8 leading-relaxed text-balance">
            포도알을 한 알씩 채우며 목표를 달성하고, 소중한 사람에게 응원과 보상을 주고받아요
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-grape-100/40 border border-grape-200/60 text-grape-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {/* OAuth start endpoints 302-redirect to the external provider, so they need a
                full browser navigation — a plain <a> (not next/link) is intentional here.
                no-html-link-for-pages misreads these /api routes as internal pages. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/auth/oauth/kakao"
              onClick={() => markOAuthStart(providerStatus.kakao?.real ? 'kakao' : 'guest')}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold transition-transform active:scale-[0.97] shadow-clay-sm relative"
              style={{ background: '#FEE500', color: '#191919' }}
            >
              <EmojiIcon emoji="💬" size={18} />
              <span>카카오로 시작</span>
              {!providerStatus.kakao?.real && (
                <span className="absolute right-3 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/10">체험</span>
              )}
            </a>

            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/auth/oauth/naver"
              onClick={() => markOAuthStart(providerStatus.naver?.real ? 'naver' : 'guest')}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-white transition-transform active:scale-[0.97] shadow-clay-sm relative"
              style={{ background: '#03C75A' }}
            >
              <span className="font-extrabold">N</span>
              <span>네이버로 시작</span>
              {!providerStatus.naver?.real && (
                <span className="absolute right-3 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/25">체험</span>
              )}
            </a>

            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/auth/oauth/google"
              onClick={() => markOAuthStart(providerStatus.google?.real ? 'google' : 'guest')}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold transition-transform active:scale-[0.97] shadow-clay-sm border border-warm-border/60 relative"
              style={{ background: '#ffffff', color: '#3c4043' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              <span>Google로 시작</span>
              {!providerStatus.google?.real && (
                <span className="absolute right-3 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">체험</span>
              )}
            </a>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-warm-border/40" />
              <span className="text-xs text-warm-sub">또는</span>
              <div className="flex-1 h-px bg-warm-border/40" />
            </div>

            <ClayButton variant="joyful" fullWidth size="lg" onClick={() => { setError(''); setMode('register'); }}>
              <EmojiIcon emoji="📧" size={16} className="mr-1" />이메일로 시작
            </ClayButton>
            <button
              onClick={() => { setError(''); setMode('login'); }}
              className="w-full text-center text-sm text-grape-700 py-3 min-h-[44px]"
            >
              이미 계정이 있나요? 이메일로 로그인
            </button>

            {process.env.NODE_ENV !== 'production' && (
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch('/api/auth/dev', { method: 'POST' });
                  const data = await res.json();
                  if (data.user) {
                    setUser(data.user);
                    clearPageCache(); // 사용자 전환 가능 지점
                    router.replace('/home');
                  }
                } catch {
                  setError('개발자 모드 진입 실패');
                }
                setLoading(false);
              }}
              disabled={loading}
              className="w-full py-2.5 min-h-[44px] rounded-2xl text-xs font-medium text-warm-sub hover:text-grape-700 transition-all"
            >
              {loading ? '진입중…' : <span className="inline-flex items-center gap-1"><EmojiIcon emoji="🛠️" size={14} /> 개발자 모드</span>}
            </button>
            )}
          </div>
        </div>
      )}

      {/* Login Form */}
      {mode === 'login' && (
        <div className="w-full max-w-sm animate-slide-up">
          <button onClick={() => { setError(''); setMode('welcome'); }} className="text-warm-sub mb-4 text-sm py-2 min-h-[44px]">
            ← 돌아가기
          </button>
          <h2 className="font-display text-3xl font-bold text-grape-700 mb-6">이메일로 로그인</h2>
          <div className="space-y-4">
            <ClayInput
              label="이메일"
              type="email"
              placeholder="hello@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <ClayInput
              label="비밀번호"
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {error && <p role="alert" className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm text-center px-3 py-2">{error}</p>}
            <ClayButton variant="joyful" fullWidth size="lg" onClick={handleSubmit} loading={loading}>
              로그인
            </ClayButton>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className="w-full text-center text-sm text-grape-700 mt-2 py-2 min-h-[44px]"
            >
              계정이 없으신가요? 새로 시작하기
            </button>
          </div>
        </div>
      )}

      {/* Register Form */}
      {mode === 'register' && (
        <div className="w-full max-w-sm animate-slide-up">
          <button onClick={() => { setError(''); setMode('welcome'); }} className="text-warm-sub mb-4 text-sm py-2 min-h-[44px]">
            ← 돌아가기
          </button>
          <h2 className="font-display text-3xl font-bold text-grape-700 mb-6">이메일로 시작하기</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
                나를 표현하는 과일
              </label>
              <div className="flex flex-wrap gap-2 justify-center">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av}
                    onClick={() => setAvatar(av)}
                    type="button"
                    aria-label={av}
                    className={`
                      w-12 h-12 rounded-2xl flex items-center justify-center transition-all
                      ${avatar === av
                        ? 'clay-pressed scale-110'
                        : 'clay-button'
                      }
                    `}
                    style={avatar === av ? { boxShadow: 'inset 0 2px 4px rgba(42,36,52,0.18), 0 0 0 2.5px var(--color-juice-500)' } : undefined}
                  >
                    <img src={`/avatars/${av}.svg`} alt="" width={30} height={30} draggable={false} />
                  </button>
                ))}
              </div>
            </div>
            <ClayInput
              label="이름"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <ClayInput
              label="이메일"
              type="email"
              placeholder="hello@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <ClayInput
              label="비밀번호"
              type="password"
              placeholder="8자리 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {error && <p role="alert" className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm text-center px-3 py-2">{error}</p>}
            <ClayButton variant="joyful" fullWidth size="lg" onClick={handleSubmit} loading={loading}>
              시작하기
            </ClayButton>
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="w-full text-center text-sm text-grape-700 mt-2 py-2 min-h-[44px]"
            >
              이미 계정이 있으신가요? 로그인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
