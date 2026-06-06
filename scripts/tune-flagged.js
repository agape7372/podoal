// Fine-nudge tuning strips for the two flagged fruits (cherry: pushed down → try up;
// watermelon: pushed right → try left). Renders blend + a range of extra nudges in
// real coins so we can pick the most centered. Output: scripts/tune_<fruit>.png
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'avatars');
const DENSITY = 576, ALPHA = 24, VB = 32;

function strip(svg){ return svg.replace(/<g data-centered="1" transform="translate\([^)]*\)">/, '').replace(/<\/g>(\s*<\/svg>)/, '$1'); }
function inner(svg){ return svg.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,''); }

async function blendCenter(art){
  const { data, info } = await sharp(Buffer.from(art), { density: DENSITY }).raw().ensureAlpha().toBuffer({ resolveWithObject:true });
  const { width:W, height:H, channels:C } = info; const sx=VB/W, sy=VB/H;
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,n=0,sxv=0,syv=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(data[(y*W+x)*C+3]>ALPHA){ const vx=(x+0.5)*sx, vy=(y+0.5)*sy; if(vx<x0)x0=vx;if(vx>x1)x1=vx;if(vy<y0)y0=vy;if(vy>y1)y1=vy; n++;sxv+=vx;syv+=vy; } }
  return { x:((x0+x1)/2 + sxv/n)/2, y:((y0+y1)/2 + syv/n)/2 };
}

// Faithful to the real app: nest an <svg viewBox="0 0 32 32"> so content outside the
// viewBox is CLIPPED exactly like <img src=avatar.svg>. C is the fruit point placed at
// coin center → baked translate = (16-C.x, 16-C.y).
function coin(cx, cy, Rc, art, C, cross){
  const size = 0.70 * 2 * Rc;            // sprite = 70% of coin diameter
  const x = cx - size/2, y = cy - size/2;
  const Tx = (16 - C.x).toFixed(2), Ty = (16 - C.y).toFixed(2);
  let b=`<circle cx="${cx}" cy="${cy}" r="${Rc}" fill="#F2E9DA" stroke="#E0D3BC" stroke-width="2"/>`;
  b+=`<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" viewBox="0 0 32 32"><g transform="translate(${Tx} ${Ty})">${art}</g></svg>`;
  if(cross){ b+=`<line x1="${cx-Rc}" y1="${cy}" x2="${cx+Rc}" y2="${cy}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.55"/>`;
             b+=`<line x1="${cx}" y1="${cy-Rc}" x2="${cx}" y2="${cy+Rc}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.55"/>`; }
  return b;
}

async function strip5(fruit, title, nudges){
  const raw=fs.readFileSync(path.join(DIR,fruit+'.svg'),'utf8');
  const art=inner(strip(raw)); const bc=await blendCenter(strip(raw));
  const SC=300, PADTOP=64, LAB=34; const W=nudges.length*SC, H=PADTOP+SC+LAB;
  let b=`<rect width="${W}" height="${H}" fill="#FBF7F0"/>`;
  b+=`<text x="${W/2}" y="36" font-family="sans-serif" font-size="24" font-weight="700" fill="#4A3A5C" text-anchor="middle">${title}</text>`;
  nudges.forEach((nd,j)=>{
    // shipped translate would be (16-bc.x + ndx, 16-bc.y + ndy); equivalently center used:
    const C={ x: bc.x - nd.dx, y: bc.y - nd.dy };
    const cx=j*SC+SC/2, cy=PADTOP+SC*0.45, Rc=SC*0.40;
    b+=coin(cx,cy,Rc,art,C,true);
    b+=`<text x="${cx}" y="${PADTOP+SC*0.45+Rc+30}" font-family="sans-serif" font-size="17" font-weight="700" fill="#7A5BA8" text-anchor="middle">${nd.label}</text>`;
  });
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${b}</svg>`)).png().toFile(path.join(__dirname,`tune_${fruit}.png`));
  console.log('wrote scripts/tune_'+fruit+'.png  blendCenter=('+bc.x.toFixed(2)+','+bc.y.toFixed(2)+')');
}

(async()=>{
  // cherry: flagged "down" → nudge UP (negative dy moves art up). label by extra-up amount.
  await strip5('cherry', '체리 — 위로 보정 (viewBox 클립, 십자=코인 중심)', [
    { dx:0, dy:0,    label:'blend' },
    { dx:0, dy:-0.7, label:'위 +0.7' },
    { dx:0, dy:-1.0, label:'위 +1.0' },
    { dx:0, dy:-1.3, label:'위 +1.3(한계)' },
    { dx:0, dy:-1.8, label:'위 +1.8(클립)' },
  ]);
  // watermelon: flagged "right" → nudge LEFT (negative dx moves art left).
  await strip5('watermelon', '수박 — 왼쪽 보정 (십자=코인 중심)', [
    { dx:0,    dy:0, label:'blend' },
    { dx:-0.7, dy:0, label:'왼 +0.7' },
    { dx:-1.4, dy:0, label:'왼 +1.4' },
    { dx:-2.1, dy:0, label:'왼 +2.1' },
    { dx:-2.8, dy:0, label:'왼 +2.8' },
  ]);
})();
