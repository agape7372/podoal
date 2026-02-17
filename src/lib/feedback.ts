'use client';

// ─── Settings ──────────────────────────────────────────────

interface FeedbackSettings {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  soundVolume: number; // 0-1
  fillSoundId?: number;
}

const DEFAULT_SETTINGS: FeedbackSettings = {
  soundEnabled: true,
  hapticEnabled: true,
  soundVolume: 0.5,
};

const STORAGE_KEY = 'podoal-feedback-settings';

export function getSettings(): FeedbackSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateSettings(partial: Partial<FeedbackSettings>): FeedbackSettings {
  const current = getSettings();
  const updated = { ...current, ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable
  }
  return updated;
}

// ─── AudioContext singleton ────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Resume suspended context (autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ─── Sound helper ──────────────────────────────────────────

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volumeMultiplier: number = 1,
  startTime?: number,
): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = startTime ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);

    const vol = settings.soundVolume * volumeMultiplier;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  } catch {
    // Web Audio API not available
  }
}

function playToneRamp(
  freqStart: number,
  freqEnd: number,
  duration: number,
  type: OscillatorType = 'sine',
  volumeMultiplier: number = 1,
  startTime?: number,
): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = startTime ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.linearRampToValueAtTime(freqEnd, t + duration);

    const vol = settings.soundVolume * volumeMultiplier;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  } catch {
    // Web Audio API not available
  }
}

// ─── Sound effects ─────────────────────────────────────────

/** Play the user's selected fill sound */
export function playFill(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;
  try {
    const { playFillSoundById, DEFAULT_FILL_SOUND_ID } = require('@/lib/sounds');
    playFillSoundById(settings.fillSoundId ?? DEFAULT_FILL_SOUND_ID);
  } catch {
    // sounds module not available
  }
}

/** Celebration jingle for sending cheer - 3-note ascending */
export function playCheer(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, i) => {
      playTone(freq, 0.2, 'sine', 0.35, t + i * 0.12);
    });
  } catch {
    // Web Audio API not available
  }
}

/** Reward unlock fanfare - sparkly ascending with shimmer */
export function playReward(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    // Magical ascending: C5, E5, G5, B5, C6
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    notes.forEach((freq, i) => {
      playTone(freq, 0.3, 'sine', 0.35, t + i * 0.09);
      // Sparkle shimmer overtone
      playTone(freq * 2, 0.2, 'sine', 0.1, t + i * 0.09 + 0.02);
    });
    // Final sparkle chord
    [1046.5, 1318.5, 1568].forEach((freq) => {
      playTone(freq, 0.6, 'sine', 0.15, t + 0.5);
    });
  } catch {
    // Web Audio API not available
  }
}

/** Board completion celebration - grand fanfare with rising chord */
export function playComplete(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // Drum-like kick
    const kick = ctx.createOscillator(); const kg = ctx.createGain();
    kick.type = 'sine'; kick.frequency.setValueAtTime(200, t);
    kick.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    kg.gain.setValueAtTime(settings.soundVolume * 0.5, t);
    kg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    kick.connect(kg); kg.connect(ctx.destination);
    kick.start(t); kick.stop(t + 0.12);

    // Rising fanfare: G4, B4, D5, G5
    const fanfare = [392, 494, 587, 784];
    fanfare.forEach((freq, i) => {
      playTone(freq, 0.35, 'sine', 0.35, t + 0.05 + i * 0.08);
      playTone(freq * 1.5, 0.2, 'sine', 0.08, t + 0.05 + i * 0.08);
    });

    // Grand major chord: C5, E5, G5, C6
    const grand = [523.25, 659.25, 783.99, 1046.5];
    grand.forEach((freq) => {
      playTone(freq, 0.8, 'sine', 0.2, t + 0.4);
      playTone(freq, 0.6, 'triangle', 0.06, t + 0.4);
    });

    // Sparkle top
    [1568, 2093, 2637].forEach((freq, i) => {
      playTone(freq, 0.3, 'sine', 0.08, t + 0.55 + i * 0.1);
    });
  } catch {
    // Web Audio API not available
  }
}

/** Subtle UI click for buttons */
export function playClick(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.03);

    const vol = settings.soundVolume * 0.15;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.03);
  } catch {
    // Web Audio API not available
  }
}

/** Success feedback - 2-note positive */
export function playSuccess(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    playTone(523.25, 0.15, 'sine', 0.35, t);       // C5
    playTone(783.99, 0.25, 'sine', 0.35, t + 0.12); // G5
  } catch {
    // Web Audio API not available
  }
}

/** Gentle error tone - descending */
export function playError(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    playTone(440, 0.15, 'sine', 0.25, t);       // A4
    playTone(330, 0.25, 'sine', 0.25, t + 0.12); // E4
  } catch {
    // Web Audio API not available
  }
}

// ─── Haptic patterns ──────────────────────────────────────

function vibrate(pattern: number | number[]): void {
  const settings = getSettings();
  if (!settings.hapticEnabled) return;

  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration API not available
  }
}

/** Short 10ms vibration */
export function hapticTap(): void {
  vibrate(10);
}

/** Fill pattern [30, 50, 30] */
export function hapticFill(): void {
  vibrate([30, 50, 30]);
}

/** Success pattern [50, 30, 100] */
export function hapticSuccess(): void {
  vibrate([50, 30, 100]);
}

/** Reward pattern [100, 50, 100, 50, 200] */
export function hapticReward(): void {
  vibrate([100, 50, 100, 50, 200]);
}

// ─── Combined feedback functions ──────────────────────────

/** Click + tap - for UI button taps */
export function feedbackTap(): void {
  playClick();
  hapticTap();
}

/** Fill sound + fill haptic - when a grape is filled */
export function feedbackFill(): void {
  playFill();
  hapticFill();
}

/** Cheer jingle + success haptic - for sending cheers */
export function feedbackCheer(): void {
  playCheer();
  hapticSuccess();
}

/** Reward fanfare + reward haptic - when reward is unlocked */
export function feedbackReward(): void {
  playReward();
  hapticReward();
}

/** Completion celebration + reward haptic - when board is completed */
export function feedbackComplete(): void {
  playComplete();
  hapticReward();
}

/** Success tones + success haptic */
export function feedbackSuccess(): void {
  playSuccess();
  hapticSuccess();
}

/** Error tone + tap haptic */
export function feedbackError(): void {
  playError();
  hapticTap();
}

/** Relay baton pass - chain link sound */
export function playRelay(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    // Ascending chain: E5, A5, C#6
    playTone(659.25, 0.15, 'triangle', 0.3, t);
    playTone(880, 0.15, 'triangle', 0.3, t + 0.1);
    playTone(1108.73, 0.25, 'sine', 0.35, t + 0.2);
    // Sparkle
    playTone(2217.46, 0.15, 'sine', 0.08, t + 0.25);
  } catch {
    // Web Audio API not available
  }
}

/** Capsule open - crystalline thaw sound */
export function playCapsuleOpen(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    // Ice crack: descending noise-like
    playToneRamp(2000, 800, 0.1, 'sawtooth', 0.1, t);
    // Thaw shimmer: ascending
    playToneRamp(400, 1200, 0.4, 'sine', 0.25, t + 0.08);
    // Reveal chime
    playTone(1046.5, 0.3, 'sine', 0.2, t + 0.2);
    playTone(1318.5, 0.3, 'sine', 0.15, t + 0.25);
  } catch {
    // Web Audio API not available
  }
}

/** Wine bottling - cork pop + pour */
export function playBottle(): void {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    // Cork pop
    playToneRamp(300, 1500, 0.05, 'square', 0.15, t);
    // Pour glug
    playTone(220, 0.15, 'sine', 0.2, t + 0.08);
    playTone(260, 0.12, 'sine', 0.15, t + 0.18);
    // Satisfaction chime
    playTone(523.25, 0.3, 'sine', 0.25, t + 0.3);
    playTone(659.25, 0.3, 'sine', 0.2, t + 0.35);
    playTone(783.99, 0.4, 'sine', 0.25, t + 0.4);
  } catch {
    // Web Audio API not available
  }
}

/** Relay baton pass feedback */
export function feedbackRelay(): void {
  playRelay();
  hapticSuccess();
}

/** Capsule open feedback */
export function feedbackCapsuleOpen(): void {
  playCapsuleOpen();
  hapticReward();
}

/** Wine bottling feedback */
export function feedbackBottle(): void {
  playBottle();
  hapticSuccess();
}
