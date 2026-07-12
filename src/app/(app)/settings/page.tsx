'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { feedbackTap } from '@/lib/feedback';
import { useAppStore } from '@/lib/store';
import { getConsent, setConsent } from '@/lib/analytics';
import { api } from '@/lib/api';
import EmojiIcon from '@/components/EmojiIcon';
import Chevron from '@/components/Chevron';
// 공용 `src/components/Toggle.tsx`가 정본 (2026-07-13 FE-1) — 이 페이지의 구현이 그 시각 정본의 원본.
import Toggle from '@/components/Toggle';

// 설정 허브 — 컨트롤은 하위 페이지가 갖는다. 사운드·진동 토글은 /settings/sound,
// 알림 관련 컨트롤은 전부 알림 설정 탭으로 통합(REQ7).
const settingLinks = [
  { path: '/settings/sound', icon: '🔊', label: '소리 및 진동', desc: '효과음·진동·포도알 소리' },
  { path: '/notifications', icon: '🔔', label: '알림', desc: '팝업·방해금지·리마인더 설정' },
];

// "하루의 시작"(FILL_CADENCE_PLAN §4, C4-b) — 0~6시 중 선택. 스트릭·통계·텀 판정의
// 날짜 경계라 알림이 아닌 여기 소속.
const DAY_RESET_HOURS = [0, 1, 2, 3, 4, 5, 6];

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  // 익명 통계 동의(ANALYTICS_PLAN §4 철회 UI) — localStorage 판정이라 effect에서 읽는다.
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [savingHour, setSavingHour] = useState(false);
  const [hourError, setHourError] = useState('');

  useEffect(() => {
    setAnalyticsOn(getConsent() === 'granted');
  }, []);

  // 표시=on 이 직관적 라벨이라 토글 상태는 hideFriendFeed의 반전으로 노출한다(ABS-14).
  const handleFriendFeedToggle = () => {
    feedbackTap();
    updateSettings({ hideFriendFeed: !settings.hideFriendFeed });
  };

  const handleAnalyticsToggle = () => {
    feedbackTap();
    const next = !analyticsOn;
    setAnalyticsOn(next);
    setConsent(next); // 끄는 즉시 수집 중단(opt_out + reset)
    api('/api/auth/consent', { method: 'PATCH', json: { granted: next } }).catch(() => {});
  };

  const dayResetHour = user?.dayResetHour ?? 0;

  // 다른 토글들과 같은 즉시반영 관례(낙관 적용 → 실패 시만 되돌림 + rose 경고).
  // setUser(data.user)로 통째로 갈아끼우지 않고 병합하는 이유: profile PATCH 응답이
  // 변경 필드만 담은 부분 객체라 그대로 덮으면 store의 analyticsConsentAt·createdAt
  // 등 다른 additive 필드가 사라진다(store.ts 무접촉 제약이라 여기서 병합으로 방어).
  const handleDayResetHourChange = async (hour: number) => {
    if (!user || hour === dayResetHour || savingHour) return;
    feedbackTap();
    setHourError('');
    setSavingHour(true);
    const prevUser = user;
    setUser({ ...user, dayResetHour: hour });
    try {
      const data = await api<{ user: { dayResetHour?: number } }>('/api/auth/profile', {
        method: 'PATCH',
        json: { dayResetHour: hour },
      });
      setUser({ ...prevUser, dayResetHour: data.user.dayResetHour ?? hour });
    } catch {
      setUser(prevUser);
      setHourError('저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      setSavingHour(false);
    }
  };

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">설정</h1>

      <section className="clay overflow-hidden mb-4">
        {settingLinks.map((item, i) => (
          // <Link>: 행이 뷰포트에 들어오는 순간 하위 설정 라우트가 프리페치됨
          <Link
            key={item.path}
            href={item.path}
            onClick={feedbackTap}
            className={`w-full flex items-center gap-3 p-4 text-left transition-transform active:scale-[0.98] ${
              i > 0 ? 'border-t border-warm-border/55' : ''
            }`}
          >
            <EmojiIcon emoji={item.icon} size={20} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-warm-text">{item.label}</span>
              <span className="block text-xs text-warm-sub mt-0.5 truncate">{item.desc}</span>
            </span>
            <Chevron />
          </Link>
        ))}
      </section>

      {/* 표시 — 홈 "친구 소식" 피드 노출 토글. 남의 완성 소식이 비교감을 유발할 수 있어
          숨길 수 있게 한다(마음건강 세그먼트 악화 트리거, ABS-14/PERSONA_REVIEW). */}
      <section className="clay p-5 mb-4">
        <h2 className="text-sm font-semibold text-warm-sub mb-3">표시</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-warm-text">홈 친구 소식</p>
            <p className="text-xs text-warm-sub">친구의 완성 소식을 홈에 보여줘요</p>
          </div>
          <Toggle
            enabled={!settings.hideFriendFeed}
            onToggle={handleFriendFeedToggle}
            ariaLabel="홈 친구 소식"
          />
        </div>
      </section>

      {/* 하루의 시작(FILL_CADENCE_PLAN §4, C4-b) — 스트릭·통계·텀 판정의 날짜 경계라
          알림 설정이 아닌 여기 소속(카드 스펙 1항). */}
      <section className="clay p-5 mb-4">
        <h2 className="text-sm font-semibold text-warm-sub mb-1">하루의 시작</h2>
        <p className="text-xs text-warm-sub mb-3 text-balance">
          새벽 활동이 많다면, 하루가 시작되는 시각을 늦춰보세요 — 새벽 2시 채움이 어제로 기록돼요
        </p>
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="하루의 시작 시각">
          {DAY_RESET_HOURS.map((hour) => (
            <button
              key={hour}
              type="button"
              onClick={() => handleDayResetHourChange(hour)}
              disabled={!user || savingHour}
              aria-pressed={dayResetHour === hour}
              className={`clay-button py-2.5 rounded-xl text-xs font-medium text-center disabled:opacity-60 ${
                dayResetHour === hour ? 'ring-2 ring-grape-400 clay-pressed text-grape-700' : 'text-warm-sub'
              }`}
            >
              {hour}시
            </button>
          ))}
        </div>
        {hourError && (
          <p role="alert" className="text-rose-500 text-xs mt-2">{hourError}</p>
        )}
      </section>

      {/* 개인정보 — 익명 통계 동의 철회(ANALYTICS_PLAN §4: "설정에서 언제든 철회"). */}
      <section className="clay p-5 mb-4">
        <h2 className="text-sm font-semibold text-warm-sub mb-3">개인정보</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-warm-text">익명 사용 통계</p>
            <p className="text-xs text-warm-sub">서비스 개선을 위한 익명 통계 수집이에요</p>
          </div>
          <Toggle
            enabled={analyticsOn}
            onToggle={handleAnalyticsToggle}
            ariaLabel="익명 사용 통계"
          />
        </div>
      </section>

      {/* 데이터 내보내기 — 탈퇴(계정 삭제)와 짝인 신뢰 장치. 라우터 이동이 아니라 파일
          다운로드라 <Link>가 아닌 <a download>를 쓴다(스펙 4항). */}
      <section className="clay overflow-hidden mb-4">
        <a
          href="/api/export"
          download
          onClick={feedbackTap}
          className="w-full flex items-center gap-3 p-4 text-left transition-transform active:scale-[0.98]"
        >
          <EmojiIcon emoji="💾" size={20} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-warm-text">내 데이터 내보내기</span>
            <span className="block text-xs text-warm-sub mt-0.5 truncate">지금까지의 기록을 JSON 파일로 받아요</span>
          </span>
        </a>
      </section>

      {/* App info */}
      <section className="clay p-5">
        <h2 className="text-sm font-semibold text-warm-sub mb-3">앱 정보</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-warm-text">버전</span>
            <span className="text-sm text-warm-sub tabular-nums">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-warm-text">포도알</span>
            <span className="text-sm text-warm-sub inline-flex items-center gap-1"><EmojiIcon emoji="🍇" size={14} /> Podoal</span>
          </div>
          <Link
            href="/settings/privacy"
            onClick={feedbackTap}
            className="flex items-center justify-between pt-1 transition-transform active:scale-[0.98]"
          >
            <span className="text-sm text-warm-text">개인정보처리방침</span>
            <Chevron />
          </Link>
        </div>
      </section>
    </div>
  );
}
