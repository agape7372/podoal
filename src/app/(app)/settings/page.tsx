'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import EmojiIcon from '@/components/EmojiIcon';

function Toggle({ enabled, onToggle, ariaLabel }: { enabled: boolean; onToggle: () => void; ariaLabel: string }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={`w-12 h-7 rounded-full transition-all duration-200 relative ${
        enabled ? 'bg-gradient-to-r from-grape-400 to-grape-500' : 'bg-warm-border'
      }`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all duration-200 ${enabled ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const handleToggle = (key: 'soundEnabled' | 'hapticEnabled') => {
    updateSettings({ [key]: !settings[key] });
  };

  const handleVolumeChange = (value: number) => {
    updateSettings({ soundVolume: value });
  };

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">설정</h1>

      {/* Sound & Haptic — 진동 피드백을 상단으로(REQ6) */}
      <section className="clay p-5 mb-4">
        <h2 className="text-sm font-semibold text-warm-sub mb-4">사운드 & 진동</h2>

        <div className="space-y-4">
          {/* Haptic toggle (top) */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-text">진동 피드백</p>
              <p className="text-xs text-warm-sub">터치 시 진동 반응</p>
            </div>
            <Toggle enabled={settings.hapticEnabled} onToggle={() => handleToggle('hapticEnabled')} ariaLabel="진동 피드백" />
          </div>

          {/* Sound toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-text">효과음</p>
              <p className="text-xs text-warm-sub">포도알 채우기, 응원 등 효과음</p>
            </div>
            <Toggle enabled={settings.soundEnabled} onToggle={() => handleToggle('soundEnabled')} ariaLabel="효과음" />
          </div>

          {settings.soundEnabled && (
            <div className="pl-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-warm-sub">볼륨</span>
                <span className="text-xs text-grape-700 font-medium tabular-nums">{Math.round(settings.soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(settings.soundVolume * 100)}
                onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
                className="w-full h-2 rounded-full appearance-none bg-grape-100 accent-grape-500"
                aria-label="볼륨"
              />
            </div>
          )}

          {/* 포도알 소리 설정 — 접기 대신 테스트 페이지로 이동하는 버튼(REQ6) */}
          <button
            onClick={() => router.push('/sound-test')}
            className="w-full clay-button p-3 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <EmojiIcon emoji="🍇" size={20} />
              <div className="text-left">
                <p className="text-sm font-medium text-warm-text">포도알 소리 설정</p>
                <p className="text-xs text-warm-sub">포도알 소리 테스트에서 골라요</p>
              </div>
            </div>
            <span className="text-warm-sub text-sm">{'>'}</span>
          </button>
        </div>
      </section>

      {/* 알림 설정 link — 알림 관련 컨트롤은 전부 알림 설정 탭으로 통합(REQ7) */}
      <section className="mb-4">
        <button
          onClick={() => router.push('/notifications')}
          className="clay w-full p-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <EmojiIcon emoji="🔔" size={20} />
              <div>
                <p className="text-sm font-medium text-warm-text">알림 설정</p>
                <p className="text-xs text-warm-sub">메시지 팝업, 방해금지, 리마인더, 카테고리별 설정</p>
              </div>
            </div>
            <span className="text-warm-sub text-sm">{'>'}</span>
          </div>
        </button>
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
        </div>
      </section>
    </div>
  );
}
