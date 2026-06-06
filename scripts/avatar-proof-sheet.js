// Render a proof contact-sheet showing each avatar's bounding box centered in its
// viewBox with equal top/bottom/left/right margins. For visual confirmation without
// a browser. Output: scripts/avatar-proof.png
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'avatars');
const FRUITS = ['grape', 'strawberry', 'orange', 'blueberry', 'cherry', 'peach', 'apple', 'watermelon'];
const KO = { grape:'포도', strawberry:'딸기', orange:'오렌지', blueberry:'블루베리', cherry:'체리', peach:'복숭아', apple:'사과', watermelon:'수박' };

const DENSITY = 1152, ALPHA = 24, VB = 32;
const S = 6.25;                 // 32 viewBox-units → 200px frame
const FRAME = VB * S;           // 200
const PAD = 28;                 // around frame inside a cell
const LABEL = 46;               // label strip height
const CELLW = FRAME + PAD * 2;          // 256
const CELLH = FRAME + PAD * 2 + LABEL;  // 302
const COLS = 4, ROWS = 2;

async function bbox(svgBuf) {
  const { data, info } = await sharp(svgBuf, { density: DENSITY }).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let mnX = W, mxX = -1, mnY = H, mxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > ALPHA) {
      if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y;
    }
  }
  const sx = VB / W, sy = VB / H;
  return { x0: mnX * sx, x1: (mxX + 1) * sx, y0: mnY * sy, y1: (mxY + 1) * sy };
}

(async () => {
  const r = (n) => Number(n.toFixed(2));
  const W = COLS * CELLW, H = ROWS * CELLH + 56;
  let body = '';
  body += `<rect width="${W}" height="${H}" fill="#FBF7F0"/>`;
  body += `<text x="${W/2}" y="34" font-family="sans-serif" font-size="24" font-weight="700" fill="#4A3A5C" text-anchor="middle">아바타 바운딩박스 정렬 검증 — 상=하, 좌=우 여백</text>`;

  for (let i = 0; i < FRUITS.length; i++) {
    const f = FRUITS[i];
    const buf = fs.readFileSync(path.join(DIR, f + '.svg'));
    const bb = await bbox(buf);
    const inner = buf.toString('utf8').replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');

    const col = i % COLS, row = (i / COLS) | 0;
    const cx = col * CELLW, cy = row * CELLH + 56;
    const fx = cx + PAD, fy = cy + PAD;             // frame origin

    // margins (viewBox units)
    const mL = r(bb.x0), mR = r(VB - bb.x1), mT = r(bb.y0), mB = r(VB - bb.y1);
    const okX = Math.abs(mL - mR) < 0.1, okY = Math.abs(mT - mB) < 0.1;

    body += `<g>`;
    // viewBox frame (coin-cream)
    body += `<rect x="${fx}" y="${fy}" width="${FRAME}" height="${FRAME}" rx="14" fill="#F2E9DA" stroke="#D8C9B0" stroke-width="1.5"/>`;
    // the fruit, scaled into the frame
    body += `<g transform="translate(${fx} ${fy}) scale(${S})">${inner}</g>`;
    // center crosshair
    body += `<line x1="${fx + FRAME/2}" y1="${fy}" x2="${fx + FRAME/2}" y2="${fy + FRAME}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.55"/>`;
    body += `<line x1="${fx}" y1="${fy + FRAME/2}" x2="${fx + FRAME}" y2="${fy + FRAME/2}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.55"/>`;
    // bounding box rectangle (red dashed)
    body += `<rect x="${fx + bb.x0*S}" y="${fy + bb.y0*S}" width="${(bb.x1-bb.x0)*S}" height="${(bb.y1-bb.y0)*S}" fill="none" stroke="#E0466E" stroke-width="1.6" stroke-dasharray="5 3"/>`;
    // label
    const tick = (okX && okY) ? '✓' : '⚠';
    body += `<text x="${cx + CELLW/2}" y="${fy + FRAME + 26}" font-family="sans-serif" font-size="17" font-weight="700" fill="#4A3A5C" text-anchor="middle">${KO[f]} ${tick}</text>`;
    body += `<text x="${cx + CELLW/2}" y="${fy + FRAME + 44}" font-family="sans-serif" font-size="12" fill="#7A6A8C" text-anchor="middle">좌${mL}/우${mR}  상${mT}/하${mB}</text>`;
    body += `</g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  const out = path.join(__dirname, 'avatar-proof.png');
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log('wrote', out);
})();
