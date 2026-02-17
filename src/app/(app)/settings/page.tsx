'use client';

import { useAppStore } from '@/lib/store';
import { updateSettings as updateFeedbackSettings } from '@/lib/feedback';

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

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
              <div
                className={`
                  w-5 h-5 rounded-full bg-white shadow-md absolute top-1
                  transition-all duration-200
                  ${settings.soundEnabled ? 'left-6' : 'left-1'}
                `}
              />
            </button>
          </div>

          {/* Volume slider */}
          {settings.soundEnabled && (
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
          )}

          {/* Haptic toggle */}
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
              <div
                className={`
                  w-5 h-5 rounded-full bg-white shadow-md absolute top-1
                  transition-all duration-200
                  ${settings.hapticEnabled ? 'left-6' : 'left-1'}
                `}
              />
            </button>
          </div>
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
              <div
                className={`
                  w-5 h-5 rounded-full bg-white shadow-md absolute top-1
                  transition-all duration-200
                  ${settings.showMessagePopup ? 'left-6' : 'left-1'}
                `}
              />
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
              <div
                className={`
                  w-5 h-5 rounded-full bg-white shadow-md absolute top-1
                  transition-all duration-200
                  ${settings.realtimeNotifications ? 'left-6' : 'left-1'}
                `}
              />
            </button>
          </div>
        </div>
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
