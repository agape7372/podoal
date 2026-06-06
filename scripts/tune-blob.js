// Focused check: render blueberry & watermelon at bbox / blend / centroid / centroid+
// extra, in real clipped coins, to confirm the visible fruit BLOB sits dead-center
// (mass-centered) with even margin all around. Output: scripts/blob_<fruit>.png
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'avatars');
const DENSITY = 576, ALPHA = 24, VB = 32;

function strip(svg){ return svg.replace(/<g data-centered="1" transform="translate\([^)]*\)">/, '').replace(/<\/g>(\s*<\/svg>)/, '$1'); }
function inner(svg){ return svg.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,''); }

async function measure(art){
  const { data, info } = await sharp(Buffer.from(art), { density: DENSITY }).raw().ensureAlpha().toBuffer({ resolveWithObject:true });
  const { width:W, height:H, channels:C } = info; const sx=VB/W, sy=VB/H;
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,n=0,mx=0,my=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(data[(y*W+x)*C+3]>ALPHA){ const vx=(x+0.5)*sx, vy=(y+0.5)*sy; if(vx<x0)x0=vx;if(vx>x1)x1=vx;if(vy<y0)y0=vy;if(vy>y1)y1=vy; n++;mx+=vx;my+=vy; } }
  return { bbox:{x:(x0+x1)/2,y:(y0+y1)/2}, centroid:{x:mx/n,y:my/n}, ext:{x0,x1,y0,y1} };
}

// faithful coin (clips to viewBox like <img>)
function coin(cx, cy, Rc, art, C, cross){
  const size=0.70*2*Rc, x=cx-size/2, y=cy-size/2;
  const Tx=(16-C.x).toFixed(2), Ty=(16-C.y).toFixed(2);
  let b=`<circle cx="${cx}" cy="${cy}" r="${Rc}" fill="#F2E9DA" stroke="#E0D3BC" stroke-width="2"/>`;
  b+=`<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" viewBox="0 0 32 32"><g transform="translate(${Tx} ${Ty})">${art}</g></svg>`;
  if(cross){ b+=`<line x1="${cx-Rc}" y1="${cy}" x2="${cx+Rc}" y2="${cy}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/>`;
             b+=`<line x1="${cx}" y1="${cy-Rc}" x2="${cx}" y2="${cy+Rc}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/>`; }
  return b;
}

async function run(fruit, title){
  const art=inner(strip(fs.readFileSync(path.join(DIR,fruit+'.svg'),'utf8')));
  const m=await measure(strip(fs.readFileSync(path.join(DIR,fruit+'.svg'),'utf8')));
  const blend={ x:(m.bbox.x+m.centroid.x)/2, y:(m.bbox.y+m.centroid.y)/2 };
  // centroid + extra down-left (toward where the user pointed): push further past centroid
  const dir = { x: m.centroid.x - m.bbox.x, y: m.centroid.y - m.bbox.y }; // bbox->centroid vector
  const beyond = { x: m.centroid.x + dir.x*0.5, y: m.centroid.y + dir.y*0.5 };
  const opts=[
    { name:'bbox', C:m.bbox },
    { name:'blend(현재)', C:blend },
    { name:'centroid', C:m.centroid },
    { name:'centroid+50%', C:beyond },
  ];
  const SC=320, PADTOP=64, LAB=34; const W=opts.length*SC, H=PADTOP+SC+LAB;
  let b=`<rect width="${W}" height="${H}" fill="#FBF7F0"/>`;
  b+=`<text x="${W/2}" y="36" font-family="sans-serif" font-size="24" font-weight="700" fill="#4A3A5C" text-anchor="middle">${title}</text>`;
  opts.forEach((o,j)=>{
    const cx=j*SC+SC/2, cy=PADTOP+SC*0.45, Rc=SC*0.40;
    b+=coin(cx,cy,Rc,art,o.C,true);
    b+=`<text x="${cx}" y="${PADTOP+SC*0.45+Rc+30}" font-family="sans-serif" font-size="18" font-weight="700" fill="#7A5BA8" text-anchor="middle">${o.name}</text>`;
  });
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${b}</svg>`)).png().toFile(path.join(__dirname,`blob_${fruit}.png`));
  console.log(fruit, 'bbox=('+m.bbox.x.toFixed(2)+','+m.bbox.y.toFixed(2)+') centroid=('+m.centroid.x.toFixed(2)+','+m.centroid.y.toFixed(2)+')');
}

(async()=>{
  await run('blueberry', '블루베리 — 어느 것이 열매 덩어리 정중앙? (십자=코인 중심)');
  await run('watermelon', '수박 — 어느 것이 정중앙?');
})();
