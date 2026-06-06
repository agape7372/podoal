// Compare centering candidates in clipped coins to find ONE rule that gives even margins
// around the visible shape for BOTH solid wedges (watermelon → equal top/bottom) and
// sparse clusters (blueberry → blob centered). Candidates: bbox / centroid / density-
// trimmed bbox (trim 5% & 10% of projected mass per side). Output: scripts/trim_<fruit>.png
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'avatars');
const FRUITS = ['grape','strawberry','orange','blueberry','cherry','peach','apple','watermelon'];
const KO = { grape:'포도', strawberry:'딸기', orange:'오렌지', blueberry:'블루베리', cherry:'체리', peach:'복숭아', apple:'사과', watermelon:'수박' };
const DENSITY = 576, ALPHA = 24, VB = 32;

function strip(svg){ return svg.replace(/<g data-centered="1" transform="translate\([^)]*\)">/, '').replace(/<\/g>(\s*<\/svg>)/, '$1'); }
function inner(svg){ return svg.replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,''); }

function trimExtent(sum, total, trim){
  let acc=0, lo=0, hi=sum.length-1;
  for(let i=0;i<sum.length;i++){ acc+=sum[i]; if(acc>=trim*total){ lo=i; break; } }
  acc=0;
  for(let i=sum.length-1;i>=0;i--){ acc+=sum[i]; if(acc>=trim*total){ hi=i; break; } }
  return [lo,hi];
}

async function centers(art){
  const { data, info } = await sharp(Buffer.from(art), { density: DENSITY }).raw().ensureAlpha().toBuffer({ resolveWithObject:true });
  const { width:W, height:H, channels:C } = info; const sx=VB/W, sy=VB/H;
  const colSum=new Float64Array(W), rowSum=new Float64Array(H);
  let x0=W,x1=-1,y0=H,y1=-1,n=0,mx=0,my=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(data[(y*W+x)*C+3]>ALPHA){ colSum[x]++; rowSum[y]++; if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y; n++; mx+=x; my+=y; } }
  const bbox={ x:((x0+x1+1)/2)*sx, y:((y0+y1+1)/2)*sy };
  const centroid={ x:(mx/n+0.5)*sx, y:(my/n+0.5)*sy };
  const trim=(t)=>{ const [xl,xh]=trimExtent(colSum,n,t), [yl,yh]=trimExtent(rowSum,n,t); return { x:((xl+xh+1)/2)*sx, y:((yl+yh+1)/2)*sy }; };
  return { bbox, centroid, trim5:trim(0.05), trim10:trim(0.10) };
}

function coin(cx, cy, Rc, art, C, cross){
  const size=0.70*2*Rc, x=cx-size/2, y=cy-size/2;
  const Tx=(16-C.x).toFixed(2), Ty=(16-C.y).toFixed(2);
  let b=`<circle cx="${cx}" cy="${cy}" r="${Rc}" fill="#F2E9DA" stroke="#E0D3BC" stroke-width="2"/>`;
  b+=`<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" viewBox="0 0 32 32"><g transform="translate(${Tx} ${Ty})">${art}</g></svg>`;
  if(cross){ b+=`<line x1="${cx-Rc}" y1="${cy}" x2="${cx+Rc}" y2="${cy}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/>`;
             b+=`<line x1="${cx}" y1="${cy-Rc}" x2="${cx}" y2="${cy+Rc}" stroke="#9B7ED8" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/>`; }
  return b;
}

const CAND=['bbox','centroid','trim5','trim10'];
(async()=>{
  const SC=300, PADTOP=64, LAB=30;
  for(const f of FRUITS){
    const art=inner(strip(fs.readFileSync(path.join(DIR,f+'.svg'),'utf8')));
    const c=await centers(strip(fs.readFileSync(path.join(DIR,f+'.svg'),'utf8')));
    const W=CAND.length*SC, H=PADTOP+SC+LAB;
    let b=`<rect width="${W}" height="${H}" fill="#FBF7F0"/>`;
    b+=`<text x="${W/2}" y="36" font-family="sans-serif" font-size="24" font-weight="700" fill="#4A3A5C" text-anchor="middle">${KO[f]} — 후보 비교 (십자=코인 중심)</text>`;
    CAND.forEach((name,j)=>{
      const cx=j*SC+SC/2, cy=PADTOP+SC*0.45, Rc=SC*0.40;
      b+=coin(cx,cy,Rc,art,c[name],true);
      b+=`<text x="${cx}" y="${PADTOP+SC*0.45+Rc+28}" font-family="sans-serif" font-size="17" font-weight="700" fill="#7A5BA8" text-anchor="middle">${name}</text>`;
    });
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${b}</svg>`)).png().toFile(path.join(__dirname,`trim_${f}.png`));
    console.log(f.padEnd(11), 'bbox=('+c.bbox.x.toFixed(2)+','+c.bbox.y.toFixed(2)+') centroid=('+c.centroid.x.toFixed(2)+','+c.centroid.y.toFixed(2)+') trim5=('+c.trim5.x.toFixed(2)+','+c.trim5.y.toFixed(2)+') trim10=('+c.trim10.x.toFixed(2)+','+c.trim10.y.toFixed(2)+')');
  }
})();
