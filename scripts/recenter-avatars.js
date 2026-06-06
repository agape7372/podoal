// Re-center avatar SVGs so each fruit's VISIBLE MASS sits dead-center in the round coin.
//
// What the eye reads as "centered" is the centre of the visible blob, not the bounding
// box: e.g. blueberry's berries crowd the upper-right while a stray edge balances the
// bbox at (16,16), so bbox-centering (and even a bbox/centroid blend) leaves the cluster
// looking pushed up-right. We therefore place each fruit at its SILHOUETTE AREA CENTROID
// (mass centre) — this evens out the empty margin all the way around the blob, including
// the diagonals. A clamp keeps the art inside the 0..32 viewBox (the app clips the SVG
// as an <img>). Verified by clipped coin renders (scripts/tune-blob.js, compare-centers.js).
//
// We strip any prior <g data-centered> wrapper first, so re-running is idempotent.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'avatars');
const FRUITS = ['grape', 'strawberry', 'orange', 'blueberry', 'cherry', 'peach', 'apple', 'watermelon'];

const DENSITY = 576;   // 256px raster
const ALPHA = 24;      // visible-pixel threshold
const VB = 32;

function stripWrapper(svg) {
  return svg
    .replace(/<g data-centered="1" transform="translate\([^)]*\)">/, '')
    .replace(/<\/g>(\s*<\/svg>)/, '$1');
}

// No per-fruit nudges: the mass centroid centres every fruit's visible blob on its own.
const NUDGE = {};

async function measure(svgString) {
  const { data, info } = await sharp(Buffer.from(svgString), { density: DENSITY })
    .raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const sx = VB / W, sy = VB / H;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  let n = 0, sxv = 0, syv = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * C + 3] > ALPHA) {
        const vx = (x + 0.5) * sx, vy = (y + 0.5) * sy;
        if (vx < x0) x0 = vx; if (vx > x1) x1 = vx;
        if (vy < y0) y0 = vy; if (vy > y1) y1 = vy;
        n++; sxv += vx; syv += vy;
      }
    }
  }
  return {
    bboxC: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
    centroid: { x: sxv / n, y: syv / n },
    bbox: { x0, x1, y0, y1 },
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

(async () => {
  const r = (v) => Number(v.toFixed(2));
  for (const f of FRUITS) {
    const file = path.join(DIR, f + '.svg');
    const orig = fs.readFileSync(file, 'utf8');
    const art = stripWrapper(orig);

    const { centroid, bbox } = await measure(art);
    const cx = centroid.x;                    // mass centre = visible-blob centre
    const cy = centroid.y;
    const nd = NUDGE[f] || { dx: 0, dy: 0 };
    let dx = VB / 2 - cx + nd.dx;
    let dy = VB / 2 - cy + nd.dy;
    // clamp so the silhouette never leaves the 0..32 viewBox (the app clips it as an <img>)
    dx = clamp(dx, -bbox.x0, VB - bbox.x1);
    dy = clamp(dy, -bbox.y0, VB - bbox.y1);
    dx = r(dx); dy = r(dy);

    const wrapped = art
      .replace(/(<svg\b[^>]*>)/, `$1<g data-centered="1" transform="translate(${dx} ${dy})">`)
      .replace(/(\s*)<\/svg>/, `</g>$1</svg>`);
    fs.writeFileSync(file, wrapped, 'utf8');

    console.log(
      f.padEnd(11),
      `centroid=(${r(cx)},${r(cy)})`,
      `=> translate(${dx} ${dy})`
    );
  }
})();
