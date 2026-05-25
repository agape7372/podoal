'use client';

// ─── AudioContext singleton ─────────────────────────────────
let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ─── Sound definitions ──────────────────────────────────────

function sound_tong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = 'sine'; o1.frequency.setValueAtTime(1400, t);
  o1.frequency.exponentialRampToValueAtTime(880, t + 0.03);
  g1.gain.setValueAtTime(0.6, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o1.connect(g1); g1.connect(ctx.destination); o1.start(t); o1.stop(t + 0.22);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(1760, t + 0.01);
  g2.gain.setValueAtTime(0.15, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.01); o2.stop(t + 0.18);
}

function sound_ttoing() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(400, t);
  o.frequency.exponentialRampToValueAtTime(1600, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.2);
  o.frequency.exponentialRampToValueAtTime(1100, t + 0.28);
  o.frequency.exponentialRampToValueAtTime(700, t + 0.4);
  g.gain.setValueAtTime(0.5, t); g.gain.setValueAtTime(0.45, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.4);
}

function sound_ttoong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(800, t + 0.06);
  o.frequency.exponentialRampToValueAtTime(500, t + 0.15);
  o.frequency.exponentialRampToValueAtTime(600, t + 0.25);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.4);
  g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.45);
  const ob = ctx.createOscillator(); const gb = ctx.createGain();
  ob.type = 'sine'; ob.frequency.setValueAtTime(150, t);
  ob.frequency.exponentialRampToValueAtTime(60, t + 0.1);
  gb.gain.setValueAtTime(0.35, t); gb.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  ob.connect(gb); gb.connect(ctx.destination); ob.start(t); ob.stop(t + 0.12);
}

function sound_ppyong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(2200, t);
  o.frequency.exponentialRampToValueAtTime(500, t + 0.06);
  o.frequency.exponentialRampToValueAtTime(800, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.2);
  g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.2);
}

function sound_tting() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = 'sine'; o1.frequency.setValueAtTime(1568, t);
  g1.gain.setValueAtTime(0.5, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o1.connect(g1); g1.connect(ctx.destination); o1.start(t); o1.stop(t + 0.5);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(3136, t);
  g2.gain.setValueAtTime(0.12, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t); o2.stop(t + 0.35);
  const o3 = ctx.createOscillator(); const g3 = ctx.createGain();
  o3.type = 'sine'; o3.frequency.setValueAtTime(2349, t);
  g3.gain.setValueAtTime(0.06, t); g3.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o3.connect(g3); g3.connect(ctx.destination); o3.start(t); o3.stop(t + 0.3);
}

function sound_pong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1200, t);
  o.frequency.exponentialRampToValueAtTime(500, t + 0.05);
  g.gain.setValueAtTime(0.5, t); g.gain.setValueAtTime(0.35, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.3);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(1000, t + 0.04);
  o2.frequency.exponentialRampToValueAtTime(600, t + 0.08);
  g2.gain.setValueAtTime(0.1, t + 0.04); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.04); o2.stop(t + 0.25);
}

function sound_ttuwung() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(660, t);
  o.frequency.exponentialRampToValueAtTime(440, t + 0.05);
  g.gain.setValueAtTime(0.6, t); g.gain.setValueAtTime(0.4, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.35);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(880, t);
  g2.gain.setValueAtTime(0.2, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t); o2.stop(t + 0.2);
  const ob = ctx.createOscillator(); const gb = ctx.createGain();
  ob.type = 'sine'; ob.frequency.setValueAtTime(180, t);
  ob.frequency.exponentialRampToValueAtTime(60, t + 0.06);
  gb.gain.setValueAtTime(0.3, t); gb.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  ob.connect(gb); gb.connect(ctx.destination); ob.start(t); ob.stop(t + 0.08);
}

function sound_bbiyong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(600, t);
  o.frequency.exponentialRampToValueAtTime(2000, t + 0.05);
  o.frequency.exponentialRampToValueAtTime(800, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(1500, t + 0.18);
  o.frequency.exponentialRampToValueAtTime(600, t + 0.3);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.35);
  g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.38);
}

function sound_tok() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.02);
  g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.08);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(1200, t + 0.015);
  g2.gain.setValueAtTime(0.15, t + 0.015); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.015); o2.stop(t + 0.1);
}

function sound_ppoing() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = 'sine'; o1.frequency.setValueAtTime(1600, t);
  o1.frequency.exponentialRampToValueAtTime(700, t + 0.04);
  g1.gain.setValueAtTime(0.55, t); g1.gain.exponentialRampToValueAtTime(0.05, t + 0.06);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o1.connect(g1); g1.connect(ctx.destination); o1.start(t); o1.stop(t + 0.1);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(500, t + 0.08);
  o2.frequency.exponentialRampToValueAtTime(1200, t + 0.14);
  o2.frequency.exponentialRampToValueAtTime(800, t + 0.25);
  o2.frequency.exponentialRampToValueAtTime(900, t + 0.32);
  o2.frequency.exponentialRampToValueAtTime(600, t + 0.42);
  g2.gain.setValueAtTime(0.45, t + 0.08); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.08); o2.stop(t + 0.42);
}

function sound_ppyorong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(800, t);
  o.frequency.exponentialRampToValueAtTime(2400, t + 0.06);
  o.frequency.exponentialRampToValueAtTime(1800, t + 0.15);
  o.frequency.exponentialRampToValueAtTime(2200, t + 0.22);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.35);
  g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.38);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(3600, t + 0.04);
  g2.gain.setValueAtTime(0.08, t + 0.04); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.04); o2.stop(t + 0.2);
}

function sound_dingdong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = 'sine'; o1.frequency.setValueAtTime(1319, t);
  g1.gain.setValueAtTime(0.5, t); g1.gain.exponentialRampToValueAtTime(0.05, t + 0.15);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o1.connect(g1); g1.connect(ctx.destination); o1.start(t); o1.stop(t + 0.2);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(988, t + 0.15);
  g2.gain.setValueAtTime(0.5, t + 0.15); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.15); o2.stop(t + 0.5);
}

function sound_poong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(500, t);
  o.frequency.exponentialRampToValueAtTime(350, t + 0.08);
  g.gain.setValueAtTime(0.5, t); g.gain.linearRampToValueAtTime(0.3, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.45);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(700, t);
  o2.frequency.exponentialRampToValueAtTime(500, t + 0.06);
  g2.gain.setValueAtTime(0.2, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t); o2.stop(t + 0.3);
}

function sound_jjang() {
  const ctx = getCtx(); const t = ctx.currentTime;
  [2093, 2637, 3136].forEach((f, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3 - i * 0.03);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.3);
  });
}

function sound_ppuing() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(800, t);
  o.frequency.exponentialRampToValueAtTime(1600, t + 0.05);
  o.frequency.exponentialRampToValueAtTime(1000, t + 0.15);
  o.frequency.exponentialRampToValueAtTime(1300, t + 0.22);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.32);
  g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.35);
}

function sound_dudung() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = 'sine'; o1.frequency.setValueAtTime(250, t);
  o1.frequency.exponentialRampToValueAtTime(100, t + 0.06);
  g1.gain.setValueAtTime(0.6, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o1.connect(g1); g1.connect(ctx.destination); o1.start(t); o1.stop(t + 0.1);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(350, t + 0.08);
  o2.frequency.exponentialRampToValueAtTime(120, t + 0.16);
  g2.gain.setValueAtTime(0.55, t + 0.08); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.08); o2.stop(t + 0.25);
  const o3 = ctx.createOscillator(); const g3 = ctx.createGain();
  o3.type = 'sine'; o3.frequency.setValueAtTime(880, t + 0.08);
  g3.gain.setValueAtTime(0.15, t + 0.08); g3.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o3.connect(g3); g3.connect(ctx.destination); o3.start(t + 0.08); o3.stop(t + 0.2);
}

function sound_jjing() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(3000, t);
  o.frequency.exponentialRampToValueAtTime(1500, t + 0.02);
  g.gain.setValueAtTime(0.4, t); g.gain.setValueAtTime(0.35, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.4);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(2250, t + 0.01);
  g2.gain.setValueAtTime(0.1, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.01); o2.stop(t + 0.3);
}

function sound_ppok() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1000, t);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.04);
  g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.12);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'triangle'; o2.frequency.setValueAtTime(4000, t + 0.01);
  o2.frequency.exponentialRampToValueAtTime(2000, t + 0.06);
  g2.gain.setValueAtTime(0.08, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.01); o2.stop(t + 0.08);
}

function sound_ttiring() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const notes = [
    { f: 1047, d: 0, dur: 0.12 },
    { f: 1319, d: 0.08, dur: 0.12 },
    { f: 1568, d: 0.16, dur: 0.39 },
  ];
  notes.forEach(({ f, d, dur }) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t + d);
    g.gain.setValueAtTime(0.43, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t + d); o.stop(t + d + dur);
  });
}

function sound_pongdang() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = 'sine'; o1.frequency.setValueAtTime(900, t);
  o1.frequency.exponentialRampToValueAtTime(300, t + 0.05);
  g1.gain.setValueAtTime(0.55, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o1.connect(g1); g1.connect(ctx.destination); o1.start(t); o1.stop(t + 0.12);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(400, t + 0.08);
  o2.frequency.exponentialRampToValueAtTime(250, t + 0.5);
  g2.gain.setValueAtTime(0.35, t + 0.08); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.08); o2.stop(t + 0.55);
  const o3 = ctx.createOscillator(); const g3 = ctx.createGain();
  o3.type = 'sine'; o3.frequency.setValueAtTime(600, t + 0.1);
  o3.frequency.exponentialRampToValueAtTime(350, t + 0.45);
  g3.gain.setValueAtTime(0.1, t + 0.1); g3.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o3.connect(g3); g3.connect(ctx.destination); o3.start(t + 0.1); o3.stop(t + 0.5);
}

function sound_ppabam() {
  const ctx = getCtx(); const t = ctx.currentTime;
  [784, 988, 1175, 1568].forEach((f, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t + i * 0.06);
    g.gain.setValueAtTime(0.35, t + i * 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.2);
    o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.2);
  });
}

function sound_kungddak() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = 'sine'; o1.frequency.setValueAtTime(200, t);
  o1.frequency.exponentialRampToValueAtTime(80, t + 0.06);
  g1.gain.setValueAtTime(0.6, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o1.connect(g1); g1.connect(ctx.destination); o1.start(t); o1.stop(t + 0.1);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(2500, t + 0.1);
  o2.frequency.exponentialRampToValueAtTime(1200, t + 0.12);
  g2.gain.setValueAtTime(0.45, t + 0.1); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.1); o2.stop(t + 0.18);
}

function sound_ttorureuk() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1800, t);
  o.frequency.exponentialRampToValueAtTime(600, t + 0.35);
  const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
  lfo.type = 'sine'; lfo.frequency.setValueAtTime(25, t); lfoG.gain.setValueAtTime(80, t);
  lfo.connect(lfoG); lfoG.connect(o.frequency);
  g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g); g.connect(ctx.destination); o.start(t); lfo.start(t);
  o.stop(t + 0.4); lfo.stop(t + 0.4);
}

function sound_ppung() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(400, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.2);
  g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.22);
}

function sound_taeng() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(600, t);
  o.frequency.exponentialRampToValueAtTime(1800, t + 0.02);
  o.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.14);
  o.frequency.exponentialRampToValueAtTime(1000, t + 0.3);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.35);
}

function sound_jjook() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1500, t);
  o.frequency.exponentialRampToValueAtTime(800, t + 0.03);
  o.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(600, t + 0.15);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.18);
}

function sound_ttororong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  [1047, 1319, 1568, 1319, 1047].forEach((f, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t + i * 0.07);
    g.gain.setValueAtTime(0.3, t + i * 0.07); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.18);
    o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.18);
  });
}

function sound_teong() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1100, t);
  o.frequency.exponentialRampToValueAtTime(550, t + 0.02);
  g.gain.setValueAtTime(0.55, t); g.gain.setValueAtTime(0.4, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.4);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(1650, t);
  g2.gain.setValueAtTime(0.12, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t); o2.stop(t + 0.25);
}

function sound_ddalkkak() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
  o1.type = 'square'; o1.frequency.setValueAtTime(3000, t);
  o1.frequency.exponentialRampToValueAtTime(1500, t + 0.01);
  g1.gain.setValueAtTime(0.15, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  o1.connect(g1); g1.connect(ctx.destination); o1.start(t); o1.stop(t + 0.02);
  const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(1200, t + 0.015);
  o2.frequency.exponentialRampToValueAtTime(800, t + 0.03);
  g2.gain.setValueAtTime(0.4, t + 0.015); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o2.connect(g2); g2.connect(ctx.destination); o2.start(t + 0.015); o2.stop(t + 0.1);
}

function sound_popping() {
  const ctx = getCtx(); const t = ctx.currentTime;
  [{ f: 1600, d: 0, v: 0.45 }, { f: 2000, d: 0.06, v: 0.35 }, { f: 2400, d: 0.11, v: 0.25 }].forEach(({ f, d, v }) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t + d);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t + d + 0.04);
    g.gain.setValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.08);
    o.connect(g); g.connect(ctx.destination); o.start(t + d); o.stop(t + d + 0.08);
  });
}

// ─── Exported sound catalog ─────────────────────────────────

export interface FillSound {
  id: number;
  name: string;
  desc: string;
  emoji: string;
  play: () => void;
}

export const FILL_SOUNDS: FillSound[] = [
  { id: 0,  name: '통!',     desc: '실로폰 한 방. 짧고 경쾌한 타격감',      emoji: '🔔', play: sound_tong },
  { id: 1,  name: '또잉~',   desc: '스프링 바운스. 위로 튀어오르는 느낌',    emoji: '🫧', play: sound_ttoing },
  { id: 2,  name: '또옹~',   desc: '둥글고 깊은 바운스. 묵직한 귀여움',     emoji: '🍇', play: sound_ttoong },
  { id: 3,  name: '뿅!',     desc: '팝콘 팝. 터지고 살짝 되튀는 소리',      emoji: '🍿', play: sound_ppyong },
  { id: 4,  name: '띵~',     desc: '맑은 종소리. 영롱한 하모닉 울림',       emoji: '✨', play: sound_tting },
  { id: 5,  name: '퐁~',     desc: '물방울. 떨어지며 잔잔히 퍼지는 느낌',    emoji: '💧', play: sound_pong },
  { id: 6,  name: '뚜웅~',   desc: '마림바 히트. 따뜻하고 통통한 소리',     emoji: '🪇', play: sound_ttuwung },
  { id: 7,  name: '삐용~',   desc: '코믹 스프링. 만화 효과음 느낌',        emoji: '🌀', play: sound_bbiyong },
  { id: 8,  name: '톡!',     desc: '짧고 깔끔. 가벼운 터치 피드백',        emoji: '👆', play: sound_tok },
  { id: 9,  name: '뽀잉~',   desc: '더블 바운스. 뽀+잉 두 번 튀는 느낌',    emoji: '🎀', play: sound_ppoing },
  { id: 10, name: '뾰롱~',   desc: '요정 마법봉. 반짝이며 올라가는 느낌',    emoji: '🪄', play: sound_ppyorong },
  { id: 11, name: '딩동~',   desc: '초인종 2음. 클래식한 알림',            emoji: '🚪', play: sound_dingdong },
  { id: 12, name: '포옹~',   desc: '부드럽고 포근한 안아주는 소리',         emoji: '🤗', play: sound_poong },
  { id: 13, name: '쨩!',     desc: '트라이앵글 화음. 반짝이는 등장',        emoji: '⭐', play: sound_jjang },
  { id: 14, name: '뿌잉~',   desc: '아기 장난감. 트라이앵글파 통통',        emoji: '🧸', play: sound_ppuing },
  { id: 15, name: '두둥!',   desc: '작은 북 2연타. 리듬감 있는 임팩트',     emoji: '🥁', play: sound_dudung },
  { id: 16, name: '찡~',     desc: '동전 투입. 높은 금속 울림',            emoji: '🪙', play: sound_jjing },
  { id: 17, name: '뽁!',     desc: '버블 터짐. 짧고 확실한 팝',           emoji: '🫧', play: sound_ppok },
  { id: 18, name: '띠링~',   desc: '3음 알림. 도미솔 상승 벨',            emoji: '🔔', play: sound_ttiring },
  { id: 19, name: '퐁당~',   desc: '연못에 돌 던지기. 물결 퍼지는 여운',     emoji: '🪨', play: sound_pongdang },
  { id: 20, name: '빠밤~',   desc: '미니 팡파레. 4음 상승 축하',           emoji: '🎺', play: sound_ppabam },
  { id: 21, name: '쿵딱!',   desc: '2비트 리듬. 저음 쿵 + 고음 딱',       emoji: '🪘', play: sound_kungddak },
  { id: 22, name: '또르륵~',  desc: '구슬 굴러가기. 비브라토 하강',         emoji: '🔮', play: sound_ttorureuk },
  { id: 23, name: '뿡!',     desc: '코믹 저음. 귀여운 방귀 느낌',          emoji: '💨', play: sound_ppung },
  { id: 24, name: '탱~',     desc: '고무줄 튕기기. 탄력있는 바운스',        emoji: '🎯', play: sound_taeng },
  { id: 25, name: '쪼옥~',   desc: '뽀뽀 소리. 짧고 사랑스러운 터치',      emoji: '💋', play: sound_jjook },
  { id: 26, name: '또로롱~',  desc: '오르골 한 소절. 도미솔미도 5음',       emoji: '🎵', play: sound_ttororong },
  { id: 27, name: '텅~',     desc: '빈 캔 두드리기. 금속 울림',            emoji: '🥫', play: sound_teong },
  { id: 28, name: '딸깍!',   desc: '스위치 온. 딱딱한 클릭감',            emoji: '🔘', play: sound_ddalkkak },
  { id: 29, name: '팝핑~',   desc: '물방울 3연속. 작→큰 팝팝팝',          emoji: '🎈', play: sound_popping },
];

export const DEFAULT_FILL_SOUND_ID = 13; // 쨩!

export function playFillSoundById(id: number): void {
  const sound = FILL_SOUNDS.find((s) => s.id === id);
  if (sound) sound.play();
}
