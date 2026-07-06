// AI 아트 인테이크 변환기(W2-B) — art-intake/ 에 떨어뜨린 원본 PNG(투명 배경)를
// docs/ILLUSTRATION_STYLE.md 파이프라인대로 WebP q82로 변환해 public/illustrations/
// 아래 카탈로그 경로(-v1)로 저장한다. sharp는 next 번들 의존성(gen-brand-assets와 동일).
//
// 사용: node scripts/art-convert.mjs            — 인식된 전 파일 변환+검사 리포트
//      node scripts/art-convert.mjs --check     — 변환 없이 대상/누락만 표시
//
// 파일명 규약(인테이크): 카탈로그 이름 그대로(버전 접미 없이) —
//   empty-home.png, empty-winery.png, ..., tier-1.png ... tier-7.png
// 앱 아이콘(icon-master.png)·OG(og-bg.png)는 크기만 검사해 두고 배선은 별도
// (아이콘: gen-brand-assets.mjs + CACHE_VERSION 범프 / OG: 타이포 합성 후 교체).
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const INTAKE = 'art-intake';
const MAX_KB = 60;

/** 인테이크 이름 → [목적지 디렉토리, 목표 정사각 크기(px)] */
const CATALOG = {
  'empty-home': ['public/illustrations/empty', 480],
  'empty-winery': ['public/illustrations/empty', 480],
  'empty-messages': ['public/illustrations/empty', 480],
  'empty-vine': ['public/illustrations/empty', 480],
  'empty-podong': ['public/illustrations/empty', 480],
  'empty-friends': ['public/illustrations/empty', 480],
  'empty-favorites': ['public/illustrations/empty', 480],
  'empty-reminders': ['public/illustrations/empty', 480],
  'tier-1': ['public/illustrations/tiers', 216],
  'tier-2': ['public/illustrations/tiers', 216],
  'tier-3': ['public/illustrations/tiers', 216],
  'tier-4': ['public/illustrations/tiers', 216],
  'tier-5': ['public/illustrations/tiers', 216],
  'tier-6': ['public/illustrations/tiers', 216],
  'tier-7': ['public/illustrations/tiers', 216],
};

const checkOnly = process.argv.includes('--check');

if (!existsSync(INTAKE)) {
  console.log(`'${INTAKE}/' 폴더가 없습니다 — art-intake/PROMPTS.md 절차로 생성하세요.`);
  process.exit(1);
}

const files = readdirSync(INTAKE).filter((f) => /\.(png|webp|jpg|jpeg)$/i.test(f));
const known = files.filter((f) => CATALOG[path.parse(f).name]);
const unknown = files.filter((f) => !CATALOG[path.parse(f).name] && !/^(icon-master|og-bg)\./.test(f));
const missing = Object.keys(CATALOG).filter((k) => !files.some((f) => path.parse(f).name === k));

console.log(`인테이크: 인식 ${known.length} · 미인식 ${unknown.length} · 카탈로그 잔여 ${missing.length}`);
if (unknown.length) console.log('  미인식(무시):', unknown.join(', '));
if (missing.length) console.log('  아직 없음:', missing.join(', '));
if (checkOnly) process.exit(0);

let fail = 0;
for (const f of known) {
  const name = path.parse(f).name;
  const [destDir, size] = CATALOG[name];
  mkdirSync(destDir, { recursive: true });
  const out = path.join(destDir, `${name}-v1.webp`);
  const img = sharp(path.join(INTAKE, f)).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const meta = await sharp(path.join(INTAKE, f)).metadata();
  await img.webp({ quality: 82 }).toFile(out);
  const kb = Math.round(statSync(out).size / 1024);
  const alpha = meta.hasAlpha ? '투명' : '⚠ 불투명(배경 제거 안 됨?)';
  const sizeOk = kb <= MAX_KB ? 'OK' : `⚠ ${MAX_KB}KB 초과`;
  if (!meta.hasAlpha || kb > MAX_KB) fail += 1;
  console.log(`  ${f} → ${out} · ${kb}KB(${sizeOk}) · ${alpha} · 원본 ${meta.width}×${meta.height}`);
}
console.log(fail === 0 ? '전 파일 통과 — 다음: 검수 7항(육안) 후 배선 주석 해제' : `⚠ ${fail}건 재작업 필요`);
