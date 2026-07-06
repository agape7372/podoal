// W2-B 아트 파이프라인: art-intake PNG → 중앙 크롭 → 리사이즈 → 라운드 모서리 마스크
// → public/illustrations/<분류>/<이름>-v1.webp
//
// 왜 배경 제거가 아니라 라운드 타일인가(2026-07-06 실측): 이 세트는 무외곽선 플랫
// 스타일이라 크림 벽·연보라 유리 같은 피사체 색이 배경색과 거의 같다 — 에지 연결
// 플러드필이 피사체를 침식했고(시트 검수로 확인), API 매팅은 장당 ~1.15cr로 세트에
// 못 쓴다. 원본 배경을 그대로 두고 모서리만 둥글리면 픽셀 수술 없이 '일러스트
// 카드' 타일이 되고, 앱의 클레이 카드 문법과도 정합한다.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INTAKE = path.join(ROOT, 'art-intake');
const JOBS = [
  ...['home', 'winery', 'messages', 'vine', 'podong', 'friends', 'favorites', 'reminders']
    .map((n) => [`empty-${n}`, 'public/illustrations/empty', 480]),
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => [`tier-${n}`, 'public/illustrations/tiers', 216]),
];

async function processOne(name, destDir, size) {
  const src = path.join(INTAKE, `${name}.png`);
  const radius = Math.round(size * 0.22); // 클레이 카드(28px/카드폭)와 유사한 둥글기
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
  const dest = path.join(ROOT, destDir);
  mkdirSync(dest, { recursive: true });
  const out = path.join(dest, `${name}-v1.webp`);
  await sharp(src)
    .resize(size, size, { fit: 'cover', position: 'attention' }) // 피사체 중심 크롭
    .composite([{ input: mask, blend: 'dest-in' }])
    .webp({ quality: 82 })
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`${name} → ${out} (${meta.width}×${meta.height})`);
}

for (const [name, dir, size] of JOBS) await processOne(name, dir, size);
console.log('PIPELINE_DONE');
