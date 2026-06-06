// Render the FINAL avatars (blend-centered, as they'll ship) inside round coins,
// matching the real <Avatar> look (sprite = 70% of coin). Crosshair = coin center.
// Output: scripts/avatar-final.png (4x2 grid) + scripts/final_<fruit>.png (per fruit).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'avatars');
const FRUITS = ['grape', 'strawberry', 'orange', 'blueberry', 'cherry', 'peach', 'apple', 'watermelon'];
const KO = { grape:'포도', strawberry:'딸기', orange:'오렌지', blueberry:'블루베리', cherry:'체리', peach:'복숭아', apple:'사과', watermelon:'수박' };

function inner(svg){ return svg.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,''); }

function coin(cx, cy, Rc, art, withCross){
  // nested <svg viewBox> clips outside-viewBox content exactly like <img src=avatar.svg>
  const size = 0.70 * 2 * Rc;            // sprite = 70% of coin diameter
  const x = cx - size/2, y = cy - size/2;
  let b = `<circle cx="${cx}" cy="${cy}" r="${Rc}" fill="#F2E9DA" stroke="#E0D3BC" stroke-width="2"/>`;
  b += `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" viewBox="0 0 32 32">${art}</svg>`;
  if (withCross){
    b += `<line x1="${cx-Rc}" y1="${cy}" x2="${cx+Rc}" y2="${cy}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.55"/>`;
    b += `<line x1="${cx}" y1="${cy-Rc}" x2="${cx}" y2="${cy+Rc}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.55"/>`;
  }
  return b;
}

(async () => {
  const arts = FRUITS.map((f) => inner(fs.readFileSync(path.join(DIR, f + '.svg'), 'utf8')));

  // grid 4x2
  const CELL = 200, PADTOP = 56, COLS = 4, ROWS = 2;
  const W = COLS * CELL, H = PADTOP + ROWS * CELL;
  let g = `<rect width="${W}" height="${H}" fill="#FBF7F0"/>`;
  g += `<text x="${W/2}" y="34" font-family="sans-serif" font-size="22" font-weight="700" fill="#4A3A5C" text-anchor="middle">최종 아바타 — 과일별 시각중심 정렬 (십자=코인 중심)</text>`;
  FRUITS.forEach((f, i) => {
    const col = i % COLS, row = (i / COLS) | 0;
    const cx = col*CELL + CELL/2, cy = PADTOP + row*CELL + CELL/2;
    g += coin(cx, cy, CELL*0.40, arts[i], true);
    g += `<text x="${cx}" y="${PADTOP + row*CELL + CELL - 12}" font-family="sans-serif" font-size="15" font-weight="700" fill="#4A3A5C" text-anchor="middle">${KO[f]}</text>`;
  });
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`), { density: 144 }).png().toFile(path.join(__dirname, 'avatar-final.png'));

  // per-fruit (no crosshair = how the user actually sees it; with crosshair pair)
  for (let i = 0; i < FRUITS.length; i++){
    const sw = 460, sh = 300, Rc = 120;
    let b = `<rect width="${sw}" height="${sh}" fill="#FBF7F0"/>`;
    b += `<text x="${sw/2}" y="34" font-family="sans-serif" font-size="22" font-weight="700" fill="#4A3A5C" text-anchor="middle">${KO[FRUITS[i]]} — 최종</text>`;
    b += coin(sw*0.30, 170, Rc, arts[i], false);   // plain (real look)
    b += coin(sw*0.70, 170, Rc, arts[i], true);    // with center crosshair
    b += `<text x="${sw*0.30}" y="290" font-family="sans-serif" font-size="13" fill="#7A6A8C" text-anchor="middle">실제 모습</text>`;
    b += `<text x="${sw*0.70}" y="290" font-family="sans-serif" font-size="13" fill="#7A6A8C" text-anchor="middle">중심 십자선</text>`;
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}">${b}</svg>`)).png().toFile(path.join(__dirname, `final_${FRUITS[i]}.png`));
  }
  console.log('wrote scripts/avatar-final.png + final_<fruit>.png x8');
})();
