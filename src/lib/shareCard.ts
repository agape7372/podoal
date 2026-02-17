import type { ShareCardData } from '@/types';

export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const WIDTH = 1080;
  const HEIGHT = 1350;
  const PADDING = 60;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // ─── Background: Purple gradient ────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGrad.addColorStop(0, '#8b5cf6');
  bgGrad.addColorStop(1, '#6d28d9');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ─── Grape emoji decorations (top area) ─────────────
  ctx.font = '80px serif';
  ctx.globalAlpha = 0.15;
  ctx.fillText('🍇', 40, 100);
  ctx.fillText('🍇', 900, 150);
  ctx.fillText('🍇', 150, 1250);
  ctx.fillText('🍇', 820, 1280);
  ctx.fillText('🍇', 480, 80);
  ctx.globalAlpha = 1.0;

  // ─── White card area with rounded corners ───────────
  const cardX = PADDING;
  const cardY = 160;
  const cardW = WIDTH - PADDING * 2;
  const cardH = HEIGHT - 320;
  const cardRadius = 40;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cardX + cardRadius, cardY);
  ctx.lineTo(cardX + cardW - cardRadius, cardY);
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardRadius, cardRadius);
  ctx.lineTo(cardX + cardW, cardY + cardH - cardRadius);
  ctx.arcTo(cardX + cardW, cardY + cardH, cardX + cardW - cardRadius, cardY + cardH, cardRadius);
  ctx.lineTo(cardX + cardRadius, cardY + cardH);
  ctx.arcTo(cardX, cardY + cardH, cardX, cardY + cardH - cardRadius, cardRadius);
  ctx.lineTo(cardX, cardY + cardRadius);
  ctx.arcTo(cardX, cardY, cardX + cardRadius, cardY, cardRadius);
  ctx.closePath();
  ctx.fill();

  // Soft shadow for card
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fill();
  ctx.restore();

  // ─── Grape emoji at top center of card ──────────────
  ctx.font = '100px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🍇', WIDTH / 2, cardY + 130);

  // ─── Title ──────────────────────────────────────────
  ctx.fillStyle = '#1f1f1f';
  ctx.font = 'bold 48px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';

  // Word wrap the title
  const titleLines = wrapText(ctx, data.title, cardW - 120);
  let titleY = cardY + 220;
  for (const line of titleLines) {
    ctx.fillText(line, WIDTH / 2, titleY);
    titleY += 60;
  }

  // ─── Progress bar ──────────────────────────────────
  const barY = titleY + 40;
  const barX = cardX + 80;
  const barW = cardW - 160;
  const barH = 40;
  const barRadius = 20;

  // Bar background
  ctx.fillStyle = '#f3e8ff';
  roundRect(ctx, barX, barY, barW, barH, barRadius);
  ctx.fill();

  // Bar fill
  const fillWidth = Math.max(barH, (data.progress / 100) * barW);
  const barGrad = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
  barGrad.addColorStop(0, '#a78bfa');
  barGrad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = barGrad;
  roundRect(ctx, barX, barY, fillWidth, barH, barRadius);
  ctx.fill();

  // Progress percentage text
  ctx.fillStyle = '#6d28d9';
  ctx.font = 'bold 36px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${data.progress}%`, WIDTH / 2, barY + barH + 55);

  // ─── X/Y 포도알 text ───────────────────────────────
  const grapeTextY = barY + barH + 120;
  ctx.fillStyle = '#4c1d95';
  ctx.font = 'bold 56px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${data.filledCount} / ${data.totalStickers} 포도알`, WIDTH / 2, grapeTextY);

  // ─── Completed badge (if completed) ─────────────────
  if (data.completedAt) {
    const badgeY = grapeTextY + 60;
    ctx.fillStyle = '#7c3aed';
    ctx.font = 'bold 32px "Noto Sans KR", sans-serif';
    ctx.fillText('🎉 달성 완료!', WIDTH / 2, badgeY);

    const dateStr = new Date(data.completedAt).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    ctx.fillStyle = '#7c3aed';
    ctx.font = '26px "Noto Sans KR", sans-serif';
    ctx.fillText(dateStr, WIDTH / 2, badgeY + 45);
  }

  // ─── Username ───────────────────────────────────────
  const usernameY = cardY + cardH - 80;
  ctx.fillStyle = '#6b7280';
  ctx.font = '30px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`by ${data.userName}`, WIDTH / 2, usernameY);

  // ─── Decorative grape cluster at bottom of card ─────
  ctx.font = '40px serif';
  ctx.globalAlpha = 0.3;
  ctx.fillText('🍇🍇🍇', WIDTH / 2, cardY + cardH - 25);
  ctx.globalAlpha = 1.0;

  // ─── "포도알" watermark at bottom ───────────────────
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 32px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🍇 포도알', WIDTH / 2, HEIGHT - 50);

  // ─── Convert to Blob ───────────────────────────────
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate share card image'));
      },
      'image/png',
      1.0
    );
  });
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
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
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
