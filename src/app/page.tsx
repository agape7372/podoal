'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ClayButton from '@/components/ClayButton';
import ClayInput from '@/components/ClayInput';
import { AVATAR_EMOJIS, AVATAR_OPTIONS } from '@/types';
import { api, fetchUser } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Mode = 'welcome' | 'login' | 'register';

export default function AuthPage() {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const [mode, setMode] = useState<Mode>('welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('grape');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetchUser().then((u) => {
      if (u) {
        setUser(u);
        router.replace('/home');
      } else {
        setChecking(false);
      }
    });
  }, [router, setUser]);

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
      } else {
        const data = await api<{ user: { id: string; name: string; email: string; avatar: string } }>('/api/auth/login', {
          method: 'POST',
          json: { email: email.trim(), password },
        });
        setUser(data.user);
      }
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했어요');
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-5xl animate-float">🍇</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      {/* Logo & Welcome */}
      {mode === 'welcome' && (
        <div className="text-center animate-fade-in w-full max-w-sm">
          <div className="text-7xl mb-4 animate-float">🍇</div>
          <h1 className="text-3xl font-extrabold text-grape-700 mb-2">포도알</h1>
          <p className="text-warm-sub mb-2">칭찬 스티커 보상표</p>
          <p className="text-sm text-warm-light mb-10">
            포도알을 하나씩 채우며 목표를 달성하고,<br />
            소중한 사람에게 응원과 보상을 주고받아요
          </p>
          <div className="space-y-3">
            <ClayButton fullWidth size="lg" onClick={() => setMode('login')}>
              로그인
            </ClayButton>
            <ClayButton fullWidth size="lg" variant="secondary" onClick={() => setMode('register')}>
              새로 시작하기
            </ClayButton>
            {process.env.NODE_ENV !== 'production' && (
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch('/api/auth/dev', { method: 'POST' });
                    const data = await res.json();
                    if (data.user) {
                      setUser(data.user);
                      router.replace('/home');
                    }
                  } catch {
                    setError('개발자 모드 진입 실패');
                  }
                  setLoading(false);
                }}
                disabled={loading}
                className="w-full py-3 rounded-2xl text-sm font-medium text-warm-sub border-2 border-dashed border-warm-border/60 hover:border-grape-300 hover:text-grape-500 transition-all"
              >
                {loading ? '진입중...' : '🛠 개발자 모드로 시작'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Login Form */}
      {mode === 'login' && (
        <div className="w-full max-w-sm animate-slide-up">
          <button onClick={() => setMode('welcome')} className="text-warm-sub mb-6 text-sm">
            ← 돌아가기
          </button>
          <h2 className="text-2xl font-bold text-grape-700 mb-6">로그인</h2>
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
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <ClayButton fullWidth size="lg" onClick={handleSubmit} loading={loading}>
              로그인
            </ClayButton>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className="w-full text-center text-sm text-grape-500 mt-2"
            >
              계정이 없으신가요? 새로 시작하기
            </button>
          </div>
        </div>
      )}

      {/* Register Form */}
      {mode === 'register' && (
        <div className="w-full max-w-sm animate-slide-up">
          <button onClick={() => setMode('welcome')} className="text-warm-sub mb-6 text-sm">
            ← 돌아가기
          </button>
          <h2 className="text-2xl font-bold text-grape-700 mb-6">새로 시작하기</h2>
          <div className="space-y-4">
            {/* Avatar selection */}
            <div>
              <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
                나를 표현하는 과일
              </label>
              <div className="flex flex-wrap gap-2 justify-center">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av}
                    onClick={() => setAvatar(av)}
                    className={`
                      w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all
                      ${avatar === av
                        ? 'clay-pressed ring-2 ring-grape-400 scale-110'
                        : 'clay-button'
                      }
                    `}
                  >
                    {AVATAR_EMOJIS[av]}
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
              placeholder="4자리 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <ClayButton fullWidth size="lg" onClick={handleSubmit} loading={loading}>
              시작하기 🍇
            </ClayButton>
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="w-full text-center text-sm text-grape-500 mt-2"
            >
              이미 계정이 있으신가요? 로그인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
