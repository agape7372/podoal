/**
 * 일회성 운영 스크립트 — 스키마는 이미 있으나 마이그레이션 이력이 없는 DB를
 * 마이그레이션 이력에 편입(baseline)한다. 실행: `npx tsx scripts/baseline-init.ts`
 *
 * 빌드 경로(scripts/migrate-deploy.mjs)에서 분리된 이유는 감사 H-04 — 자동 baseline은
 * 배포마다 돌면서 스키마 지문 확인 없이 이력을 조작할 수 있었다. 여기서는 세 관문을 둔다:
 *
 *   1. 승인 플래그        ALLOW_BASELINE=true
 *   2. 대상 DB명 재확인    BASELINE_CONFIRM_DATABASE=<실제 DB명>
 *   3. 스키마 지문 검사    migrate diff 결과가 비어 있을 것 (SHADOW_DATABASE_URL 필요)
 *
 * 3번이 핵심이다. "비어 있지 않은 DB"라는 사실만으로는 그 DB가 우리 스키마인지 알 수 없다.
 * 지문이 비어야만 = 이 DB의 실제 구조가 prisma/migrations의 최종 상태와 정확히 같아야만
 * 이력을 "적용됨"으로 기록하는 것이 정당하다.
 *
 * SHADOW_DATABASE_URL: 마이그레이션을 재생해 볼 **비어 있는** 임시 DB. 내용이 지워지므로
 * 절대 운영 DB를 가리키지 말 것. 로컬 docker Postgres에 빈 DB 하나를 만들어 쓰면 된다.
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { assertBaselineAllowed, describeTarget, parseDbTarget } from '../src/lib/seedGuard';

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations');

function fail(msg: string): never {
  console.error(`\n[baseline] 중단 — ${msg}\n`);
  process.exit(1);
}

// 연결값(DATABASE_URL·SHADOW_DATABASE_URL)은 argv가 아니라 env로만 전달한다 —
// prisma.config.ts가 읽어간다. 덕분에 셸 인용/확장이 URL의 '?', '&', '$'를 건드릴
// 여지가 없어 migrate-deploy.mjs와 같은 shell:true 실행을 그대로 쓸 수 있다.
function prisma(args: string[], { capture = false } = {}) {
  const res = spawnSync('npx', ['prisma', ...args], {
    shell: true,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (res.error) fail(`prisma ${args.join(' ')} 실행 실패: ${res.error.message}`);
  return res;
}

// ─── 관문 1·2: 승인 플래그 + 대상 DB명 재확인 ────────────────────
const url = process.env.DATABASE_URL;
const verdict = assertBaselineAllowed(url, process.env);
console.log(`[baseline] 대상: ${describeTarget(verdict.target ?? parseDbTarget(url))}`);
if (!verdict.allowed) fail(verdict.reason);
// 도달 불가(위 판정이 URL 부재를 이미 거른다) — 타입 좁히기용.
if (!url) fail('DATABASE_URL이 없습니다.');

// ─── 관문 3: 스키마 지문 검사 ────────────────────────────────────
const shadow = process.env.SHADOW_DATABASE_URL;
if (!shadow) {
  fail(
    'SHADOW_DATABASE_URL이 필요합니다 — 마이그레이션을 재생해 대상 DB와 대조할 **빈** 임시 DB.\n' +
      '           운영 DB를 지정하면 내용이 지워집니다. 로컬 docker Postgres의 빈 DB를 쓰세요.'
  );
}
if (parseDbTarget(shadow)?.database === verdict.target.database) {
  fail('SHADOW_DATABASE_URL이 대상 DB와 같습니다 — 섀도 DB는 내용이 지워지므로 반드시 별도 DB여야 합니다.');
}

if (!existsSync(MIGRATIONS_DIR)) fail(`prisma/migrations 디렉터리를 찾을 수 없습니다: ${MIGRATIONS_DIR}`);

console.log('[baseline] 스키마 지문 검사 중 (migrate diff)...');
// v7 CLI에는 --from-url/--shadow-database-url이 없다. 연결값은 prisma.config.ts가
// env에서 읽으므로(--from-config-datasource), URL을 argv가 아니라 env로 넘긴다.
// --exit-code: 0=차이 없음, 2=차이 있음, 1=오류. 텍스트 파싱보다 신뢰할 수 있다.
const diff = prisma(['migrate', 'diff', '--from-config-datasource', '--to-migrations', 'prisma/migrations', '--script', '--exit-code'], {
  capture: true,
});

if (diff.status === 2) {
  console.error('\n[baseline] 지문 불일치 — 대상 DB가 prisma/migrations의 최종 상태와 다릅니다.');
  console.error('[baseline] 아래 DDL만큼의 차이가 있습니다:\n');
  console.error((diff.stdout ?? '').trim());
  fail('이 DB는 baseline 대상이 아닙니다. 정말 이관해야 한다면 차이를 먼저 해소하세요.');
}
if (diff.status !== 0) {
  process.stdout.write(diff.stdout ?? '');
  process.stderr.write(diff.stderr ?? '');
  fail('migrate diff 실행 실패 — 지문을 확인할 수 없으므로 baseline을 진행하지 않습니다.');
}
console.log('[baseline] 지문 일치 — 대상 DB가 마이그레이션 최종 상태와 동일합니다.');

// ─── 이력 기록 ───────────────────────────────────────────────────
const names = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (names.length === 0) fail('마이그레이션 디렉터리가 비어 있습니다.');

console.log(`[baseline] ${names.length}개 마이그레이션을 applied로 기록합니다.`);
for (const name of names) {
  const res = prisma(['migrate', 'resolve', '--applied', name], { capture: true });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  if (res.status === 0) {
    console.log(`  ✓ ${name}`);
  } else if (out.includes('P3008') || out.includes('already recorded as applied')) {
    console.log(`  · ${name} (이미 기록됨 — 건너뜀)`);
  } else {
    process.stderr.write(out);
    fail(`${name} 기록 실패 — 중단합니다.`);
  }
}

console.log('\n[baseline] 완료. 이제 npm run build / migrate deploy가 정상 동작합니다.\n');
