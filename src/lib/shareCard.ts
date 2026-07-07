import type { ShareCardData } from '@/types';
import {
  WIDTH,
  HEIGHT,
  C,
  resolveFonts,
  drawBackground,
  drawGrapeBunch,
  drawMiniGrapes,
  wrapText,
  roundRect,
  canvasToBlob,
} from './cardEngine';

// 보드 진행 공유카드 (1080×1350, Instagram 비율).
// 그리기 프리미티브는 src/lib/cardEngine.ts 공용 엔진으로 추출됨 — 이 파일은
// 보드 카드의 레이아웃(그리기 순서·좌표·파라미터)만 보유한다. 기존 시각 출력과
// 1픽셀도 다르지 않아야 하므로 아래 시퀀스를 함부로 바꾸지 말 것.

export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const fonts = await resolveFonts();

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available on this device.');
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // ─── 1+2. Background: gradient + decorative blobs (engine) ──
  drawBackground(ctx);

  // ─── 3. Main white card with soft puffy shadow ─────────────
  const cardX = 70;
  const cardY = 150;
  const cardW = WIDTH - 140;
  const cardH = 1045;
  const cardR = 48;
  ctx.save();
  ctx.shadowColor = C.shadow(0.16);
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.restore();

  // ─── 4. Grape bunch (drawn, not emoji) at top center ───────
  const bunchR = 38;
  const bunchTopY = cardY + 130;
  drawGrapeBunch(ctx, WIDTH / 2, bunchTopY, bunchR);
  const bunchBottomY = bunchTopY + 4 * (bunchR * 1.4) + bunchR;

  // ─── 5. Title (Maru Buri) ──────────────────────────────────
  // Strip ALL emoji — the drawn grape bunch already carries the visual, and
  // Canvas emoji render inconsistently across OSes.
  const cleanTitle =
    data.title
      .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️⃣]/gu, '')
      .replace(/\s+/g, ' ')
      .trim() || data.title;
  ctx.fillStyle = C.grape800;
  ctx.font = `700 60px ${fonts.display}`;
  const titleLines = wrapText(ctx, cleanTitle, cardW - 170);
  let y = bunchBottomY + 96;
  for (const line of titleLines) {
    ctx.fillText(line, WIDTH / 2, y);
    y += 76;
  }

  // ─── 6. Progress bar (app's grape→lime gradient) ───────────
  y += 28;
  const barX = cardX + 90;
  const barW = cardW - 180;
  const barH = 38;
  const barR = barH / 2;
  ctx.fillStyle = C.grape100;
  roundRect(ctx, barX, y, barW, barH, barR);
  ctx.fill();
  const fillW = Math.max(barH, (data.progress / 100) * barW);
  const fg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  fg.addColorStop(0, C.grape500);
  fg.addColorStop(1, C.lime500);
  ctx.fillStyle = fg;
  roundRect(ctx, barX, y, fillW, barH, barR);
  ctx.fill();
  y += barH;

  // ─── 7. Big percentage (Maru Buri) ─────────────────────────
  y += 84;
  ctx.fillStyle = C.grape600;
  ctx.font = `700 90px ${fonts.display}`;
  ctx.fillText(`${data.progress}%`, WIDTH / 2, y);

  // ─── 8. X / Y 포도알 ───────────────────────────────────────
  y += 68;
  ctx.fillStyle = C.grape700;
  ctx.font = `600 46px ${fonts.display}`;
  ctx.fillText(`${data.filledCount} / ${data.totalStickers} 포도알`, WIDTH / 2, y);

  // ─── 9. Completed badge (pill) ─────────────────────────────
  if (data.completedAt) {
    y += 86;
    const label = '달성 완료!';
    ctx.font = `700 38px ${fonts.display}`;
    const tw = ctx.measureText(label).width;
    const pillW = tw + 90;
    const pillH = 70;
    const pillX = WIDTH / 2 - pillW / 2;
    const pillY = y - 50;
    const pg = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
    pg.addColorStop(0, C.lime300);
    pg.addColorStop(1, C.lime500);
    ctx.fillStyle = pg;
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = C.leaf700;
    ctx.fillText(label, WIDTH / 2, y);

    const dateStr = new Date(data.completedAt).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    ctx.font = `400 30px ${fonts.display}`;
    ctx.fillStyle = C.warmSub;
    ctx.fillText(dateStr, WIDTH / 2, y + 58);
  }

  // ─── 10. by username (near card bottom) ────────────────────
  ctx.font = `400 32px ${fonts.display}`;
  ctx.fillStyle = C.warmSub;
  ctx.fillText(`by ${data.userName}`, WIDTH / 2, cardY + cardH - 72);

  // ─── 11. Brand watermark (below card, on background) ───────
  drawMiniGrapes(ctx, WIDTH / 2, HEIGHT - 110, 13);
  ctx.font = `700 34px ${fonts.display}`;
  ctx.fillStyle = C.grape600;
  ctx.fillText('포도알', WIDTH / 2, HEIGHT - 52);

  // ─── 12. Inflow line: app domain (WS2 공유카드 유입 동선) ───
  // NEXT_PUBLIC_*은 빌드타임 인라인 — layout.tsx의 metadataBase와 동일한
  // fallback 패턴(하드코딩 금지). 워터마크(y=HEIGHT-52) 아래 24px 이상
  // 떨어뜨려 겹치지 않게 배치.
  const appHost = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://podoal-rouge.vercel.app',
  ).host;
  ctx.font = `400 24px ${fonts.body}`;
  ctx.fillStyle = C.warmSub;
  ctx.fillText(appHost, WIDTH / 2, HEIGHT - 26);

  // ─── Convert to Blob ───────────────────────────────────────
  return canvasToBlob(canvas);
}
