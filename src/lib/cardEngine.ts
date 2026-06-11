// 공유카드 Canvas 공용 엔진 — shareCard.ts(보드 진행 카드)와 weeklyRecap.ts(주간
// 회고 카드)가 함께 쓰는 프리미티브 모음. 배경·포도송이·클레이 도형·폰트 로딩을
// 한 곳에서 관리해 카드 변종 간 시각 언어를 통일한다.
//
// ⚠️ 이 파일의 함수/상수는 shareCard.ts에서 그대로 이동한 것 — 기존 공유카드의
// 시각 출력이 1픽셀도 달라지면 안 되므로 파라미터·그리기 순서를 바꾸지 말 것.

export const WIDTH = 1080;
export const HEIGHT = 1350;

// Brand tokens — mirror tailwind.config.ts so the card matches the claymorphism app.
export const C = {
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
  warmBorder: '#ECE0F3',
  white: '#FFFFFF',
  shadow: (a: number) => `rgba(73, 50, 100, ${a})`,
};

// 기존 공유카드가 그리는 모든 weight/size — shareCard.ts의 기본 프리로드 목록.
const SHARE_CARD_FONT_SIZES = ['700 90px', '700 60px', '700 34px', '600 46px', '400 32px', '400 30px'];

/**
 * Resolve the app's display font (Maru Buri, injected by next/font as a hashed
 * family on the `--font-display` CSS var) so Canvas text matches the app headers.
 * Falls back to Noto Sans KR if the var/font isn't available.
 *
 * @param sizes 카드가 그리는 모든 `"<weight> <size>px"` 목록 — 전부 프리로드해야
 *   첫 사용 글리프가 tofu로 그려지는 레이스가 없다. 기본값은 보드 공유카드 목록.
 */
export async function resolveFonts(
  sizes: string[] = SHARE_CARD_FONT_SIZES,
): Promise<{ display: string; body: string }> {
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
        sizes.map((s) =>
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

/**
 * Card backdrop: soft lavender → cream diagonal gradient + 4 decorative blobs.
 * Positions/alpha are the exact values the original share card used.
 */
export function drawBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, C.grape200);
  bg.addColorStop(1, C.cream);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawBlob(ctx, 110, 170, 110, C.grape300, 0.22);
  drawBlob(ctx, 980, 250, 78, C.lime500, 0.20);
  drawBlob(ctx, 120, 1200, 92, C.grape300, 0.20);
  drawBlob(ctx, 975, 1130, 120, C.grape200, 0.45);
}

/** A single claymorphic grape: radial highlight → grape gradient + soft shadow. */
export function drawGrape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
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
export function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number) {
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
export function drawGrapeBunch(ctx: CanvasRenderingContext2D, cx: number, topY: number, r: number) {
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
export function drawMiniGrapes(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
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

export function drawBlob(
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

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

export function roundRect(
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

/** Canvas toBlob은 콜백 기반 — Promise로 래핑 (PNG, 최고 품질). */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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
