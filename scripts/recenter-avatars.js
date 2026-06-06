// Re-center avatar SVGs by BOUNDING-BOX (equal top/bottom/left/right margins).
//
// Each avatar's visible art is wrapped in <g data-centered transform="translate(dx dy)">.
// We strip any existing wrapper to recover the ORIGINAL art, rasterize it, measure the
// alpha bounding box, and re-wrap with translate = (16 - bboxCenterX, 16 - bboxCenterY).
// This guarantees the visible shape's bbox sits dead-center in the 0..32 viewBox, so all
// four margins are equal. Idempotent: re-running converges to the same result.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'avatars');
const FRUITS = ['grape', 'strawberry', 'orange', 'blueberry', 'cherry', 'peach', 'apple', 'watermelon'];

const DENSITY = 1152;      // 32 * 1152/72 = 512px raster → 0.0625 viewBox-unit precision
const ALPHA = 24;          // treat pixels above this alpha as "visible"
const VB = 32;

// Strip an existing <g data-centered ...> ... </g> wrapper to recover original art.
function stripWrapper(svg) {
  return svg
    .replace(/<g data-centered="1" transform="translate\([^)]*\)">/, '')
    .replace(/<\/g>(\s*<\/svg>)/, '$1');
}

async function measureBBox(svgString) {
  const { data, info } = await sharp(Buffer.from(svgString), { density: DENSITY })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * C + 3];
      if (a > ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // map pixel coords → viewBox units. maxX/maxY are inclusive pixel indices, so add 1
  // to get the right/bottom edge of the covered region before scaling.
  const sx = VB / W, sy = VB / H;
  const x0 = minX * sx, x1 = (maxX + 1) * sx;
  const y0 = minY * sy, y1 = (maxY + 1) * sy;
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

(async () => {
  const round = (n) => Number(n.toFixed(2));
  for (const f of FRUITS) {
    const file = path.join(DIR, f + '.svg');
    const orig = fs.readFileSync(file, 'utf8');
    const art = stripWrapper(orig);

    const bb = await measureBBox(art);
    const dx = round(VB / 2 - bb.cx);
    const dy = round(VB / 2 - bb.cy);

    // re-wrap stripped art with the bbox-centering translate, right after <svg ...>
    const wrapped = art.replace(
      /(<svg\b[^>]*>)/,
      `$1<g data-centered="1" transform="translate(${dx} ${dy})">`
    ).replace(/(\s*)<\/svg>/, `</g>$1</svg>`);

    fs.writeFileSync(file, wrapped, 'utf8');

    // verify: margins after translate
    const mL = round(bb.x0 + dx), mR = round(VB - (bb.x1 + dx));
    const mT = round(bb.y0 + dy), mB = round(VB - (bb.y1 + dy));
    console.log(
      f.padEnd(11),
      `bbox=[${round(bb.x0)}-${round(bb.x1)}, ${round(bb.y0)}-${round(bb.y1)}]`,
      `center=(${round(bb.cx)},${round(bb.cy)})`,
      `=> translate(${dx} ${dy})`,
      `margins L/R=${mL}/${mR} T/B=${mT}/${mB}`
    );
  }
})();
