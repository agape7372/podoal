'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { updateSettings as updateFeedbackSettings } from '@/lib/feedback';
import { FILL_SOUNDS } from '@/lib/sounds';

export default function SettingsPage() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const handleToggle = (key: 'soundEnabled' | 'hapticEnabled' | 'showMessagePopup' | 'realtimeNotifications') => {
    const newValue = !settings[key];
    updateSettings({ [key]: newValue });
    if (key === 'soundEnabled' || key === 'hapticEnabled') {
      updateFeedbackSettings({ [key]: newValue });
    }
  };

  const handleVolumeChange = (value: number) => {
    updateSettings({ soundVolume: value });
    updateFeedbackSettings({ soundVolume: value });
  };

  const handleSelectSound = (id: number) => {
    updateSettings({ fillSoundId: id });
    updateFeedbackSettings({ fillSoundId: id });
    playSound(id);
  };

  const playSound = (id: number) => {
    setPlayingId(id);
    const sound = FILL_SOUNDS.find((s) => s.id === id);
    if (sound) sound.play();
    setTimeout(() => setPlayingId(null), 400);
  };

  const currentSound = FILL_SOUNDS.find((s) => s.id === settings.fillSoundId) || FILL_SOUNDS[13];

  return (
    <div className="pb-4">
      <h1 className="text-2xl font-bold text-grape-700 mb-6">설정</h1>

      {/* Sound & Haptic */}
      <section className="clay p-5 mb-4 bg-gradient-to-br from-white to-clay-lavender/20">
        <h2 className="text-sm font-semibold text-warm-sub mb-4">사운드 & 진동</h2>

        <div className="space-y-4">
          {/* Sound toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-text">효과음</p>
              <p className="text-xs text-warm-light">포도알 채우기, 응원 등 효과음</p>
            </div>
            <button
              onClick={() => handleToggle('soundEnabled')}
              className={`
                w-12 h-7 rounded-full transition-all duration-200 relative
                ${settings.soundEnabled
                  ? 'bg-gradient-to-r from-grape-400 to-grape-500'
                  : 'bg-gray-200'
                }
              `}
            >
              <div className={`
                w-5 h-5 rounded-full bg-white shadow-md absolute top-1
                transition-all duration-200
                ${settings.soundEnabled ? 'left-6' : 'left-1'}
              `} />
            </button>
          </div>

          {settings.soundEnabled && (
            <>
              {/* Volume slider */}
              <div className="pl-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-warm-light">볼륨</span>
                  <span className="text-xs text-grape-500 font-medium">
                    {Math.round(settings.soundVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(settings.soundVolume * 100)}
                  onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
                  className="w-full h-2 rounded-full appearance-none bg-grape-100 accent-grape-500"
                />
              </div>

              {/* Fill sound picker button */}
              <button
                onClick={() => setShowSoundPicker(!showSoundPicker)}
                className="w-full clay-button p-3 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{currentSound.emoji}</span>
                  <div className="text-left">
                    <p className="text-sm font-medium text-warm-text">포도알 소리 설정</p>
                    <p className="text-xs text-warm-light">{currentSound.name} - {currentSound.desc}</p>
                  </div>
                </div>
                <span className="text-warm-light text-sm">{showSoundPicker ? '▲' : '▼'}</span>
              </button>
            </>
          )}
        </div>
      </section>

      {/* Sound picker panel */}
      {showSoundPicker && settings.soundEnabled && (
        <section className="clay p-4 mb-4 bg-gradient-to-br from-clay-cream/30 to-clay-lavender/20">
          <h2 className="text-sm font-semibold text-grape-600 mb-3">🍇 포도알 소리 선택</h2>
          <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
            {FILL_SOUNDS.map((s) => {
              const isSelected = settings.fillSoundId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSelectSound(s.id)}
                  className={`
                    p-3 rounded-xl text-left transition-all active:scale-95
                    ${isSelected
                      ? 'bg-gradient-to-br from-grape-400 to-grape-500 text-white shadow-md'
                      : 'clay-button'
                    }
                    ${playingId === s.id ? 'scale-95' : ''}
                  `}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-lg">{s.emoji}</span>
                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-grape-700'}`}>
                      {s.name}
                    </span>
                  </div>
                  <p className={`text-[10px] leading-tight ${isSelected ? 'text-white/80' : 'text-warm-light'}`}>
                    {s.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Haptic toggle */}
      <section className="clay p-5 mb-4 bg-gradient-to-br from-white to-clay-lavender/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-warm-text">진동 피드백</p>
            <p className="text-xs text-warm-light">터치 시 진동 반응</p>
          </div>
          <button
            onClick={() => handleToggle('hapticEnabled')}
            className={`
              w-12 h-7 rounded-full transition-all duration-200 relative
              ${settings.hapticEnabled
                ? 'bg-gradient-to-r from-grape-400 to-grape-500'
                : 'bg-gray-200'
              }
            `}
          >
            <div className={`
              w-5 h-5 rounded-full bg-white shadow-md absolute top-1
              transition-all duration-200
              ${settings.hapticEnabled ? 'left-6' : 'left-1'}
            `} />
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="clay p-5 mb-4 bg-gradient-to-br from-white to-clay-pink/10">
        <h2 className="text-sm font-semibold text-warm-sub mb-4">알림</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-text">메시지 팝업</p>
              <p className="text-xs text-warm-light">새 응원 메시지 팝업 표시</p>
            </div>
            <button
              onClick={() => handleToggle('showMessagePopup')}
              className={`
                w-12 h-7 rounded-full transition-all duration-200 relative
                ${settings.showMessagePopup
                  ? 'bg-gradient-to-r from-grape-400 to-grape-500'
                  : 'bg-gray-200'
                }
              `}
            >
              <div className={`
                w-5 h-5 rounded-full bg-white shadow-md absolute top-1
                transition-all duration-200
                ${settings.showMessagePopup ? 'left-6' : 'left-1'}
              `} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-text">실시간 알림</p>
              <p className="text-xs text-warm-light">실시간으로 메시지 수신</p>
            </div>
            <button
              onClick={() => handleToggle('realtimeNotifications')}
              className={`
                w-12 h-7 rounded-full transition-all duration-200 relative
                ${settings.realtimeNotifications
                  ? 'bg-gradient-to-r from-grape-400 to-grape-500'
                  : 'bg-gray-200'
                }
              `}
            >
              <div className={`
                w-5 h-5 rounded-full bg-white shadow-md absolute top-1
                transition-all duration-200
                ${settings.realtimeNotifications ? 'left-6' : 'left-1'}
              `} />
            </button>
          </div>
        </div>
      </section>

      {/* Notification settings link */}
      <section className="mb-4">
        <button
          onClick={() => router.push('/notifications')}
          className="clay w-full p-4 text-left bg-gradient-to-br from-white to-grape-50/30 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔔</span>
              <div>
                <p className="text-sm font-medium text-warm-text">알림 설정</p>
                <p className="text-xs text-warm-sub">방해금지, 리마인더, 카테고리별 설정</p>
              </div>
            </div>
            <span className="text-warm-light text-sm">{'>'}</span>
          </div>
        </button>
      </section>

      {/* App info */}
      <section className="clay p-5 bg-gradient-to-br from-white to-clay-cream/20">
        <h2 className="text-sm font-semibold text-warm-sub mb-3">앱 정보</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-warm-text">버전</span>
            <span className="text-sm text-warm-light">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-warm-text">포도알</span>
            <span className="text-sm text-warm-light">🍇 Podoal</span>
          </div>
        </div>
      </section>
    </div>
  );
}
