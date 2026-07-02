// 브랜드 래스터 자산 생성기 — public/icons/icon.svg(마스터)에서 PNG 아이콘 세트와
// iOS 스플래시를 결정적으로 재생성한다. 아이콘 마스터를 교체(예: AI 리마스터,
// docs/ILLUSTRATION_STYLE.md §D)한 뒤 실행: `node scripts/gen-brand-assets.mjs`
// ⚠ 아이콘 파일 경로는 manifest에 고정이라, 재생성 후 sw.js CACHE_VERSION 범프 필수.
// sharp는 next의 번들 의존성을 사용(별도 설치 불필요 — check-icons와 같은 dev 전용).
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';

const BRAND_BG = '#fbf7fe'; // grape-50 — 불투명이 필요한 자산(180/스플래시)의 바탕
const svg = readFileSync('public/icons/icon.svg');
// 마스터의 내부 콘텐츠(outer <svg> 제거) — maskable 합성용
const inner = svg
  .toString()
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');

// maskable: 풀블리드 브랜드 그라디언트 + 모티프를 중앙 80% safe zone에 축소 배치
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="maskbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#dcc4f2"/>
      <stop offset="100%" stop-color="#b28cdc"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#maskbg)"/>
  <g transform="translate(51.2,51.2) scale(0.8)">${inner}</g>
</svg>`;

const DENSITY = 300; // 512px 래스터가 선명하도록 SVG 렌더 밀도 상향

async function png(input, size, out, { flatten = false } = {}) {
  let img = sharp(input, { density: DENSITY }).resize(size, size);
  if (flatten) img = img.flatten({ background: BRAND_BG });
  await img.png().toFile(out);
  console.log('✓', out);
}

// iOS 스플래시 — 단색 바탕 중앙에 아이콘(짧은 변의 ~32%)
async function splash(w, h, out) {
  const iconSize = Math.round(Math.min(w, h) * 0.32);
  const icon = await sharp(svg, { density: DENSITY }).resize(iconSize, iconSize).png().toBuffer();
  await sharp({
    create: { width: w, height: h, channels: 3, background: BRAND_BG },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log('✓', out);
}

mkdirSync('public/splash', { recursive: true });

await png(svg, 512, 'public/icons/icon-512.png');
await png(svg, 192, 'public/icons/icon-192.png');
await png(svg, 180, 'public/icons/icon-180.png', { flatten: true }); // apple-touch: 불투명 필수
await png(Buffer.from(maskable), 512, 'public/icons/icon-maskable-512.png');
await png(Buffer.from(maskable), 192, 'public/icons/icon-maskable-192.png');

// 대표 6종(세로 전용 PWA) — layout.tsx의 media query와 쌍
await splash(1170, 2532, 'public/splash/splash-1170x2532.png'); // iPhone 12/13/14
await splash(1179, 2556, 'public/splash/splash-1179x2556.png'); // 14 Pro/15/16
await splash(1290, 2796, 'public/splash/splash-1290x2796.png'); // Pro Max/Plus
await splash(1125, 2436, 'public/splash/splash-1125x2436.png'); // X/XS/11 Pro
await splash(828, 1792, 'public/splash/splash-828x1792.png'); // XR/11
await splash(1620, 2160, 'public/splash/splash-1620x2160.png'); // iPad 10세대

console.log('done');
