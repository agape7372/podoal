// Render each fruit placed by several candidate "centers" inside a real round coin,
// so we can SEE which definition looks most dead-center. Output: scripts/center-compare.png
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'avatars');
const FRUITS = ['grape', 'strawberry', 'orange', 'blueberry', 'cherry', 'peach', 'apple', 'watermelon'];
const KO = { grape:'포도', strawberry:'딸기', orange:'오렌지', blueberry:'블루베리', cherry:'체리', peach:'복숭아', apple:'사과', watermelon:'수박' };
const DENSITY = 576, ALPHA = 24, VB = 32;

function stripWrapper(svg){
  return svg.replace(/<g data-centered="1" transform="translate\([^)]*\)">/, '').replace(/<\/g>(\s*<\/svg>)/, '$1');
}
async function shape(svgString){
  const { data, info } = await sharp(Buffer.from(svgString), { density: DENSITY }).raw().ensureAlpha().toBuffer({ resolveWithObject:true });
  const { width:W, height:H, channels:C } = info;
  const xs=[], ys=[]; const sx=VB/W, sy=VB/H;
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(data[(y*W+x)*C+3]>ALPHA){ const vx=(x+0.5)*sx, vy=(y+0.5)*sy; xs.push(vx); ys.push(vy); if(vx<x0)x0=vx;if(vx>x1)x1=vx;if(vy<y0)y0=vy;if(vy>y1)y1=vy; } }
  return { xs, ys, x0, x1, y0, y1 };
}
// Ritter approximate minimum enclosing circle
function ritter(xs, ys){
  let cx=xs[0], cy=ys[0];
  // farthest from p0
  let bi=0,bd=-1; for(let i=0;i<xs.length;i++){const d=(xs[i]-cx)**2+(ys[i]-cy)**2; if(d>bd){bd=d;bi=i;}}
  let px=xs[bi],py=ys[bi]; bd=-1; let ci=0;
  for(let i=0;i<xs.length;i++){const d=(xs[i]-px)**2+(ys[i]-py)**2; if(d>bd){bd=d;ci=i;}}
  let qx=xs[ci],qy=ys[ci];
  cx=(px+qx)/2; cy=(py+qy)/2; let r=Math.sqrt((px-cx)**2+(py-cy)**2);
  for(let pass=0;pass<2;pass++) for(let i=0;i<xs.length;i++){
    const d=Math.sqrt((xs[i]-cx)**2+(ys[i]-cy)**2);
    if(d>r){ const nr=(r+d)/2, k=(d-r)/(2*d); cx+=(xs[i]-cx)*k; cy+=(ys[i]-cy)*k; r=nr; }
  }
  return { x:cx, y:cy };
}
// 8-direction (edges + nearest-corner) least-squares balance over translate grid
function diag8(s){
  const corners=[[0,0],[32,0],[32,32],[0,32]]; // TL TR BR BL
  const cost=(tx,ty)=>{
    const x0=s.x0+tx,x1=s.x1+tx,y0=s.y0+ty,y1=s.y1+ty;
    const eTopBot=(y0)-(32-y1), eLeftRight=(x0)-(32-x1);
    // nearest pixel to each corner
    const n=[Infinity,Infinity,Infinity,Infinity];
    for(let i=0;i<s.xs.length;i++){ const px=s.xs[i]+tx, py=s.ys[i]+ty;
      for(let c=0;c<4;c++){ const d=(px-corners[c][0])**2+(py-corners[c][1])**2; if(d<n[c])n[c]=d; } }
    const nTL=Math.sqrt(n[0]),nTR=Math.sqrt(n[1]),nBR=Math.sqrt(n[2]),nBL=Math.sqrt(n[3]);
    const dDiag1=nTL-nBR, dDiag2=nTR-nBL;
    return eTopBot*eTopBot + eLeftRight*eLeftRight + dDiag1*dDiag1 + dDiag2*dDiag2;
  };
  const bx=(s.x0+s.x1)/2, by=(s.y0+s.y1)/2;
  let best={c:Infinity,tx:16-bx,ty:16-by};
  const sweep=(tx0,ty0,rad,st)=>{ for(let tx=tx0-rad;tx<=tx0+rad+1e-9;tx+=st)for(let ty=ty0-rad;ty<=ty0+rad+1e-9;ty+=st){const c=cost(tx,ty); if(c<best.c)best={c,tx,ty};} };
  sweep(16-bx,16-by,3,0.25); sweep(best.tx,best.ty,0.4,0.05);
  return { x:16-best.tx, y:16-best.ty };
}

const CAND = ['bbox','centroid','blend','diag8','MEC'];
const CELL = 118, PADTOP = 64, LABELW = 92;

(async()=>{
  const r=(n)=>Number(n.toFixed(2));
  // transposed: rows = candidates, cols = fruits (landscape, reads crisply)
  const W = LABELW + FRUITS.length*CELL, H = PADTOP + CAND.length*CELL;
  let body = `<rect width="${W}" height="${H}" fill="#FBF7F0"/>`;
  body += `<text x="${W/2}" y="30" font-family="sans-serif" font-size="22" font-weight="700" fill="#4A3A5C" text-anchor="middle">중심 정의 비교 — 둥근 코인 안 정렬 (십자=코인 중심)</text>`;
  FRUITS.forEach((f,j)=>{ body += `<text x="${LABELW+j*CELL+CELL/2}" y="56" font-family="sans-serif" font-size="13" font-weight="700" fill="#4A3A5C" text-anchor="middle">${KO[f]}</text>`; });

  // precompute centers per fruit
  const data = [];
  for(const f of FRUITS){
    const raw=fs.readFileSync(path.join(DIR,f+'.svg'),'utf8');
    const art=stripWrapper(raw);
    const inner=art.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');
    const s=await shape(art);
    const bbox={ x:(s.x0+s.x1)/2, y:(s.y0+s.y1)/2 };
    let mx=0,my=0; for(let k=0;k<s.xs.length;k++){mx+=s.xs[k];my+=s.ys[k];} const cen={ x:mx/s.xs.length, y:my/s.ys.length };
    const blend={ x:(bbox.x+cen.x)/2, y:(bbox.y+cen.y)/2 };
    data.push({ inner, centers:{ bbox, centroid:cen, blend, diag8:diag8(s), MEC:ritter(s.xs,s.ys) } });
  }

  CAND.forEach((cname,ci)=>{
    const cy0 = PADTOP + ci*CELL;
    body += `<text x="${LABELW/2}" y="${cy0+CELL/2}" font-family="sans-serif" font-size="13" font-weight="700" fill="#7A5BA8" text-anchor="middle">${cname}</text>`;
    data.forEach((d,j)=>{
      const C=d.centers[cname];
      const cxc = LABELW + j*CELL + CELL/2, cyc = cy0 + CELL/2;
      const Rc = CELL*0.43;
      const sScale = (0.70*2*Rc)/32;
      body += `<circle cx="${cxc}" cy="${cyc}" r="${Rc}" fill="#F2E9DA" stroke="#E0D3BC" stroke-width="1.5"/>`;
      const tx = cxc - sScale*C.x, ty = cyc - sScale*C.y;
      body += `<g transform="translate(${r(tx)} ${r(ty)}) scale(${r(sScale)})">${d.inner}</g>`;
      body += `<line x1="${cxc-Rc}" y1="${cyc}" x2="${cxc+Rc}" y2="${cyc}" stroke="#9B7ED8" stroke-width="0.7" stroke-dasharray="3 3" opacity="0.55"/>`;
      body += `<line x1="${cxc}" y1="${cyc-Rc}" x2="${cxc}" y2="${cyc+Rc}" stroke="#9B7ED8" stroke-width="0.7" stroke-dasharray="3 3" opacity="0.55"/>`;
    });
  });
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  await sharp(Buffer.from(svg),{density:144}).png().toFile(path.join(__dirname,'center-compare.png'));
  console.log('wrote scripts/center-compare.png', W+'x'+H);

  // per-fruit large strips (one PNG each) for reliable visual judging
  const SC = 300, SPAD = 70, SLAB = 30;
  for(let i=0;i<FRUITS.length;i++){
    const d=data[i], f=FRUITS[i];
    const sw = CAND.length*SC, sh = SPAD + SC + SLAB;
    let b = `<rect width="${sw}" height="${sh}" fill="#FBF7F0"/>`;
    b += `<text x="${sw/2}" y="34" font-family="sans-serif" font-size="26" font-weight="700" fill="#4A3A5C" text-anchor="middle">${KO[f]} — 어느 중심이 코인 정중앙으로 보이나</text>`;
    CAND.forEach((cname,j)=>{
      const C=d.centers[cname];
      const cxc=j*SC+SC/2, cyc=SPAD+SC/2, Rc=SC*0.42, sScale=(0.70*2*Rc)/32;
      b += `<circle cx="${cxc}" cy="${cyc}" r="${Rc}" fill="#F2E9DA" stroke="#E0D3BC" stroke-width="2"/>`;
      const tx=cxc - sScale*C.x, ty=cyc - sScale*C.y;
      b += `<g transform="translate(${r(tx)} ${r(ty)}) scale(${r(sScale)})">${d.inner}</g>`;
      b += `<line x1="${cxc-Rc}" y1="${cyc}" x2="${cxc+Rc}" y2="${cyc}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/>`;
      b += `<line x1="${cxc}" y1="${cyc-Rc}" x2="${cxc}" y2="${cyc+Rc}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/>`;
      b += `<text x="${cxc}" y="${SPAD+SC+22}" font-family="sans-serif" font-size="18" font-weight="700" fill="#7A5BA8" text-anchor="middle">${cname}</text>`;
    });
    const ssvg=`<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}">${b}</svg>`;
    await sharp(Buffer.from(ssvg)).png().toFile(path.join(__dirname,`cmp_${f}.png`));
  }
  console.log('wrote scripts/cmp_<fruit>.png x8');
})();
