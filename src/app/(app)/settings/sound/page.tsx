'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { feedbackTap } from '@/lib/feedback';
import EmojiIcon from '@/components/EmojiIcon';
import Chevron from '@/components/Chevron';

function Toggle({ enabled, onToggle, ariaLabel }: { enabled: boolean; onToggle: () => void; ariaLabel: string }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={`w-12 h-7 shrink-0 rounded-full transition-all duration-200 relative ${
        enabled ? 'bg-linear-to-r from-grape-400 to-grape-500' : 'bg-warm-border'
      }`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all duration-200 ${enabled ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export default function SoundSettingsPage() {
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
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => { feedbackTap(); router.push('/settings'); }}
          aria-label="설정"
          className="clay-button w-9 h-9 rounded-full flex items-center justify-center text-warm-sub shrink-0"
        >
          ←
        </button>
        <h1 className="font-display text-2xl font-bold text-grape-700">소리 및 진동</h1>
      </div>

      <section className="clay p-5">
        <div className="space-y-4">
          {/* Haptic toggle — 진동 피드백이 상단(REQ6) */}
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

          {/* 포도알 소리 고르기 — 30종 미리듣기·선택은 /sound-test 가 갖는다 */}
          <Link
            href="/sound-test"
            onClick={feedbackTap}
            className="w-full clay-button p-3 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <span className="flex items-center gap-3">
              <EmojiIcon emoji="🍇" size={20} />
              <span className="text-left">
                <span className="block text-sm font-medium text-warm-text">포도알 소리 고르기</span>
                <span className="block text-xs text-warm-sub">포도알 채울 때 나는 효과음 선택</span>
              </span>
            </span>
            <Chevron />
          </Link>
        </div>
      </section>
    </div>
  );
}
