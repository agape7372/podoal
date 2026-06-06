import type { ShareCardData } from '@/types';

const WIDTH = 1080;
const HEIGHT = 1350;

// Brand tokens — mirror tailwind.config.ts so the card matches the claymorphism app.
const C = {
  grape50: '#FBF7FE',
  grape100: '#F4ECFB',
  grape200: '#EBE0F6',
  grape300: '#DCC4F2',
  grape400: '#C9A8E8',
  grape500: '#B28CDC',
  grape600: '#9970C8',
  grape700: '#7D58A8',
  grape800: '#5E3F80',
  lime300: '#EFF5BB',
  lime500: '#CFDC78',
  leaf400: '#8FC972',
  leaf700: '#3F6A2C',
  cream: '#FBFCEE',
  warmSub: '#6E6680',
  white: '#FFFFFF',
  shadow: (a: number) => `rgba(73, 50, 100, ${a})`,
};

/**
 * Resolve the app's display font (Maru Buri, injected by next/font as a hashed
 * family on the `--font-display` CSS var) so Canvas text matches the app headers.
 * Falls back to Noto Sans KR if the var/font isn't available.
 */
async function resolveFonts(): Promise<{ display: string; body: string }> {
  let display = '"Noto Sans KR", sans-serif';
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      // Maru Buri (self-hosted woff2 on --font-display) covers Hangul fully.
      // The next/font Noto Sans KR is latin-subset, so in Canvas its Korean
      // glyphs are missing → tofu (◆). CSS hides this via per-glyph fallback,
      // but Canvas does not — so we draw EVERY text in Maru Buri.
      const dv = getComputedStyle(document.documentElement)
        .getPropertyValue('--font-display')
        .trim();
      if (dv) display = `${dv}, "Noto Sans KR", sans-serif`;
      // Load EVERY weight/size the card draws with so no first-use glyph races
      // to tofu mid-render (the woff2 for an as-yet-unused weight is lazy).
      await Promise.all(
        ['700 90px', '700 60px', '700 34px', '600 46px', '400 32px', '400 30px'].map((s) =>
          document.fonts.load(`${s} ${display}`).catch(() => undefined),
        ),
      );
      await document.fonts.ready;
    } catch {
      // Fonts API unavailable — system fallback is fine.
    }
  }
  return { display, body: display };
}

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

  // ─── 1. Background: soft lavender → cream diagonal ──────────
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, C.grape200);
  bg.addColorStop(1, C.cream);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ─── 2. Decorative soft blobs (subtle, behind card edges) ──
  drawBlob(ctx, 110, 170, 110, C.grape300, 0.22);
  drawBlob(ctx, 980, 250, 78, C.lime500, 0.20);
  drawBlob(ctx, 120, 1200, 92, C.grape300, 0.20);
  drawBlob(ctx, 975, 1130, 120, C.grape200, 0.45);

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

  // ─── Convert to Blob ───────────────────────────────────────
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate share card image'));
      },
      'image/png',
      1.0,
    );
  });
}

// ─── Drawing helpers ─────────────────────────────────────────

/** A single claymorphic grape: radial highlight → grape gradient + soft shadow. */
function drawGrape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.shadowColor = C.shadow(0.18);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.34, r * 0.12, x, y, r);
  g.addColorStop(0, '#EFE6FA');
  g.addColorStop(0.55, C.grape400);
  g.addColorStop(1, C.grape600);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // glossy highlight dot
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.36, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Two flat sage leaves above the bunch (echoes GrapeStem). */
function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = C.leaf400;
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 0.5, len * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Grape bunch: wide top → narrow bottom, leaves on top. */
function drawGrapeBunch(ctx: CanvasRenderingContext2D, cx: number, topY: number, r: number) {
  const rows = [3, 4, 3, 2, 1];
  const dx = r * 1.92;
  const dy = r * 1.4;
  // leaves first (sit above the bunch)
  drawLeaf(ctx, cx - r * 0.7, topY - r * 0.95, r * 1.7, -0.55);
  drawLeaf(ctx, cx + r * 0.7, topY - r * 0.95, r * 1.7, 0.55);
  let rowY = topY;
  for (const count of rows) {
    const rowW = (count - 1) * dx;
    let x = cx - rowW / 2;
    for (let i = 0; i < count; i++) {
      drawGrape(ctx, x, rowY, r);
      x += dx;
    }
    rowY += dy;
  }
}

/** Tiny 3-grape cluster used in the watermark. */
function drawMiniGrapes(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = C.grape500;
  const pts = [
    [cx - r * 1.05, cy - r * 0.5],
    [cx + r * 1.05, cy - r * 0.5],
    [cx, cy + r * 0.7],
  ];
  for (const [px, py] of pts) {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = '';
  for (const char of text) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  // Keep the card tidy: cap at 2 lines, ellipsize the rest.
  if (lines.length > 2) {
    return [lines[0], lines[1].replace(/.$/, '…')];
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
