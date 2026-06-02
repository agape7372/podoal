'use client';

import { useCallback, useState } from 'react';
import { FILL_SOUNDS } from '@/lib/sounds';
import { useAppStore } from '@/lib/store';
import { updateSettings as updateFeedbackSettings } from '@/lib/feedback';

export default function SoundTestPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [playing, setPlaying] = useState<number | null>(null);

  const play = useCallback((id: number) => {
    setPlaying(id);
    FILL_SOUNDS.find((s) => s.id === id)?.play();
    setTimeout(() => setPlaying(null), 400);
  }, []);

  const select = useCallback((id: number) => {
    updateSettings({ fillSoundId: id });
    updateFeedbackSettings({ fillSoundId: id });
    play(id);
  }, [play, updateSettings]);

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-2">효과음 테스트</h1>
      <p className="text-sm text-warm-sub mb-6">포도알 채울 때 쓸 효과음을 골라주세요</p>

      <div className="space-y-3">
        {FILL_SOUNDS.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <button
              onClick={() => play(s.id)}
              className={`
                clay-button flex-shrink-0 w-16 h-16 rounded-2xl text-2xl
                flex items-center justify-center transition-all
                ${playing === s.id ? 'scale-90 clay-pressed' : 'active:scale-90'}
                ${settings.fillSoundId === s.id ? 'ring-2 ring-grape-400 bg-gradient-to-br from-grape-100 to-grape-50' : ''}
              `}
            >
              {s.emoji}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-grape-700">{s.id + 1}. {s.name}</span>
                {settings.fillSoundId === s.id && (
                  <span className="text-xs text-grape-500 font-medium bg-grape-100 px-2 py-0.5 rounded-full">적용됨</span>
                )}
              </div>
              <p className="text-xs text-warm-sub">{s.desc}</p>
            </div>
            <button
              onClick={() => select(s.id)}
              className={`
                flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all
                ${settings.fillSoundId === s.id
                  ? 'bg-gradient-to-br from-grape-400 to-grape-500 text-white'
                  : 'clay-button text-warm-sub'
                }
              `}
            >
              {settings.fillSoundId === s.id ? '💜' : '선택'}
            </button>
          </div>
        ))}
      </div>

      {/* Rapid fire test */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-warm-sub mb-3">연타 테스트 (빠르게 눌러보세요)</h2>
        <div className="flex flex-wrap gap-2">
          {FILL_SOUNDS.map((s) => (
            <button
              key={s.id}
              onClick={() => s.play()}
              className="clay-button w-12 h-12 rounded-xl text-lg flex items-center justify-center active:scale-90 transition-transform"
            >
              {s.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
