// W2-B 아트 파이프라인 v2: art-intake/removed/*.png(rembg 투명본) → 트림 → 리사이즈
// → public/illustrations/<분류>/<이름>-v2.webp (투명 유지)
//
// 배경 제거는 로컬 rembg(isnet-general-use) 사용: `pip install rembg onnxruntime` 후
//   python -c "from rembg import remove,new_session; ..." (docs/ILLUSTRATION_STYLE.md v2 참조)
// 색 기반 플러드필은 무외곽선 플랫 스타일에서 피사체를 침식(2026-07-06 실측) — 금지.
// Higgsfield remove_background API는 장당 ~1.15cr — 세트에 부적합.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'art-intake', 'removed');
const JOBS = [
  ...['home', 'winery', 'messages', 'vine', 'podong', 'friends', 'favorites', 'reminders']
    .map((n) => [`empty-${n}`, 'public/illustrations/empty', 480]),
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => [`tier-${n}`, 'public/illustrations/tiers', 216]),
];

for (const [name, destDir, size] of JOBS) {
  const dest = path.join(ROOT, destDir);
  mkdirSync(dest, { recursive: true });
  const out = path.join(dest, `${name}-v2.webp`);
  await sharp(path.join(SRC, `${name}.png`))
    .trim()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 82 })
    .toFile(out);
  console.log(`${name} → ${out}`);
}
console.log('PIPELINE_DONE');
