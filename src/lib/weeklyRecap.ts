import type { EnhancedStats } from '@/types';
import {
  WIDTH,
  HEIGHT,
  C,
  resolveFonts,
  drawBackground,
  drawGrapeBunch,
  drawMiniGrapes,
  roundRect,
  canvasToBlob,
} from './cardEngine';

// 주간 회고 카드 (1080×1350) — "이번 주 포도 농사" 결산.
// 보드 공유카드와 같은 시각 언어(파스텔 배경+blob, 클레이 카드 패널, 포도송이
// 프리미티브, Maru Buri)로 그린다. 데이터는 /api/stats 응답(EnhancedStats)에서
// buildWeeklyRecapData()로 변환해 받는다.

export interface WeeklyRecapData {
  userName: string;
  /** 예: "6월 5일 ~ 6월 11일" — daily의 첫/마지막 날짜로 계산. */
  weekLabel: string;
  /** 이번 주(최근 7일) 채운 포도알 합계. */
  weekCount: number;
  currentStreak: number;
  /** 최근 7일, 과거→오늘 순(stats.dailyStickers 순서 그대로). */
  daily: { date: string; count: number }[];
  mostActiveDay: string;
  averageDaily: number;
}

// 이 카드가 그리는 모든 weight/size — resolveFonts 프리로드 목록.
const RECAP_FONT_SIZES = ['700 96px', '700 60px', '700 38px', '700 34px', '600 44px', '600 38px', '400 32px', '400 30px', '400 28px'];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 미니 주간 히트맵 색상 — Heatmap.tsx의 레벨 매핑과 동일해야 한다(앱과 카드의
// 색 언어 일치): 0→회색(warm-border/40), 1→grape300, ≤3→grape400, ≤6→grape500, 그 외→grape700.
export function heatColor(count: number): string {
  if (count === 0) return 'rgba(236, 224, 243, 0.4)'; // warm-border #ECE0F3 @ 40%
  if (count === 1) return C.grape300;
  if (count <= 3) return C.grape400;
  if (count <= 6) return C.grape500;
  return C.grape700;
}

/** 'YYYY-MM-DD' → 'M월 D일' (순수 문자열 연산 — 타임존 무관). */
export function formatKoreanDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}

/** daily 배열(과거→오늘)의 첫/마지막 날짜로 주간 레이블 생성. */
export function formatWeekLabel(daily: { date: string }[]): string {
  if (daily.length === 0) return '';
  const first = formatKoreanDate(daily[0].date);
  const last = formatKoreanDate(daily[daily.length - 1].date);
  return `${first} ~ ${last}`;
}

/** 'YYYY-MM-DD'의 요일 한 글자. 날짜 전용 문자열은 UTC 자정으로 파싱되므로 getUTCDay 사용. */
export function dayShortName(dateStr: string): string {
  return DAY_NAMES[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

/** /api/stats 응답을 주간 회고 카드 데이터로 변환(순수 함수 — 단위 테스트 대상). */
export function buildWeeklyRecapData(stats: EnhancedStats, userName: string): WeeklyRecapData {
  const daily = stats.dailyStickers;
  return {
    userName,
    weekLabel: formatWeekLabel(daily),
    weekCount: daily.reduce((sum, d) => sum + d.count, 0),
    currentStreak: stats.currentStreak,
    daily,
    mostActiveDay: stats.mostActiveDay,
    averageDaily: stats.averageDaily,
  };
}

/** 이미지 로드(실패 시 null) — 🔥 Fluent SVG를 캔버스에 래스터화할 때 사용. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function generateWeeklyRecapCard(data: WeeklyRecapData): Promise<Blob> {
  const fonts = await resolveFonts(RECAP_FONT_SIZES);
  // 스트릭 불꽃은 앱과 동일한 Fluent flat SVG — Canvas에 raw OS 이모지를 그리면
  // OS마다 모양이 달라지므로(보드 카드가 이모지를 전부 strip하는 이유) 이미지로 그린다.
  const flame = await loadImage('/icons/fluent/1f525.svg');

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available on this device.');
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // ─── 1. Background: 공용 엔진(그라디언트 + blob) ─────────────
  drawBackground(ctx);

  // ─── 2. Main white card panel ───────────────────────────────
  const cardX = 70;
  const cardY = 140;
  const cardW = WIDTH - 140;
  const cardH = 1060;
  const cardR = 48;
  ctx.save();
  ctx.shadowColor = C.shadow(0.16);
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.restore();

  // ─── 3. Grape bunch (보드 카드보다 한 단계 작게) ────────────
  const bunchR = 26;
  const bunchTopY = cardY + 100;
  drawGrapeBunch(ctx, WIDTH / 2, bunchTopY, bunchR);
  const bunchBottomY = bunchTopY + 4 * (bunchR * 1.4) + bunchR;

  // ─── 4. Title + week label ──────────────────────────────────
  ctx.fillStyle = C.grape800;
  ctx.font = `700 60px ${fonts.display}`;
  ctx.fillText('이번 주 포도 농사', WIDTH / 2, bunchBottomY + 86);

  ctx.fillStyle = C.warmSub;
  ctx.font = `400 32px ${fonts.display}`;
  ctx.fillText(data.weekLabel, WIDTH / 2, bunchBottomY + 140);

  // ─── 5. Big number: 이번 주 N알 ─────────────────────────────
  ctx.fillStyle = C.grape600;
  ctx.font = `700 96px ${fonts.display}`;
  ctx.fillText(`${data.weekCount}알`, WIDTH / 2, bunchBottomY + 262);

  // ─── 6. Mini weekly heatmap (7 cells, Heatmap.tsx 색상) ─────
  const cellSize = 88;
  const cellGap = 16;
  const gridW = 7 * cellSize + 6 * cellGap;
  const gridX = (WIDTH - gridW) / 2;
  const gridY = bunchBottomY + 318;
  for (let i = 0; i < data.daily.length && i < 7; i++) {
    const d = data.daily[i];
    const x = gridX + i * (cellSize + cellGap);
    ctx.fillStyle = heatColor(d.count);
    roundRect(ctx, x, gridY, cellSize, cellSize, 20);
    ctx.fill();
    if (d.count > 0) {
      // 밝은 셀(grape300/400)은 진보라, 짙은 셀(grape500/700)은 흰색 — 대비 확보.
      ctx.fillStyle = d.count <= 3 ? C.grape800 : C.white;
      ctx.font = `700 34px ${fonts.display}`;
      ctx.fillText(`${d.count}`, x + cellSize / 2, gridY + cellSize / 2 + 12);
    }
    // 요일 레이블 (셀 아래)
    ctx.fillStyle = C.warmSub;
    ctx.font = `400 28px ${fonts.display}`;
    ctx.fillText(dayShortName(d.date), x + cellSize / 2, gridY + cellSize + 44);
  }

  // ─── 7. Streak: 🔥(Fluent SVG) 연속 N일 ─────────────────────
  const streakY = gridY + cellSize + 136;
  const streakLabel = `연속 ${data.currentStreak}일`;
  ctx.font = `600 44px ${fonts.display}`;
  const flameSize = 52;
  const flameGap = 14;
  const labelW = ctx.measureText(streakLabel).width;
  const groupW = flame ? flameSize + flameGap + labelW : labelW;
  const groupX = WIDTH / 2 - groupW / 2;
  if (flame) {
    ctx.drawImage(flame, groupX, streakY - 40, flameSize, flameSize);
  }
  ctx.fillStyle = C.grape700;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillText(streakLabel, flame ? groupX + flameSize + flameGap : groupX, streakY);
  ctx.restore();

  // ─── 8. Sub stats: 활발한 요일 · 하루 평균 ──────────────────
  ctx.fillStyle = C.warmSub;
  ctx.font = `400 30px ${fonts.display}`;
  ctx.fillText(
    `가장 활발한 요일 ${data.mostActiveDay}요일 · 하루 평균 ${data.averageDaily}알`,
    WIDTH / 2,
    streakY + 58,
  );

  // ─── 9. 부드러운 마무리 카피 ────────────────────────────────
  ctx.fillStyle = C.grape700;
  ctx.font = `600 38px ${fonts.display}`;
  ctx.fillText(
    data.weekCount > 0 ? '이번 주도 잘 익었어요' : '다음 주, 한 알부터 함께해요',
    WIDTH / 2,
    streakY + 128,
  );

  // ─── 10. by username (near card bottom) ─────────────────────
  ctx.fillStyle = C.warmSub;
  ctx.font = `400 30px ${fonts.display}`;
  ctx.fillText(`by ${data.userName}`, WIDTH / 2, cardY + cardH - 64);

  // ─── 11. Brand watermark (below card, on background) ────────
  drawMiniGrapes(ctx, WIDTH / 2, HEIGHT - 110, 13);
  ctx.font = `700 34px ${fonts.display}`;
  ctx.fillStyle = C.grape600;
  ctx.fillText('포도알', WIDTH / 2, HEIGHT - 52);

  return canvasToBlob(canvas);
}
