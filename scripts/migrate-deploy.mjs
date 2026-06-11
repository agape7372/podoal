// prisma migrate deploy 래퍼 — 기존 DB의 1회 베이스라인 전환을 자동 처리한다.
//
// 배경: 이 저장소는 `prisma db push` 운영에서 `prisma migrate`로 전환했다(docs/MIGRATIONS.md).
// 프로덕션(Neon)에는 스키마가 이미 db push로 적용돼 있으므로, 첫 `migrate deploy`는
// P3005("database schema is not empty")로 실패한다. 그 한 경우에만 베이스라인(0_init)을
// `migrate resolve --applied`로 마킹하고 다시 deploy한다 — Prisma 공식 baseline 절차.
//
// - 빈 새 DB(CI postgres 서비스, 로컬 docker): P3005가 나지 않고 0_init이 정상 적용된다.
// - 이력 있는 DB(전환 후의 모든 배포): pending만 적용하는 평소 동작.
// - resolve는 비파괴(_prisma_migrations에 행 1개 기록)이며 스키마/데이터를 건드리지 않는다.
import { spawnSync } from 'node:child_process';

const BASELINE = '0_init';

function run(args, { capture = false } = {}) {
  const res = spawnSync('npx', ['prisma', ...args], {
    shell: true,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  return res;
}

const first = run(['migrate', 'deploy'], { capture: true });
process.stdout.write(first.stdout ?? '');
process.stderr.write(first.stderr ?? '');

if (first.status === 0) process.exit(0);

const out = `${first.stdout ?? ''}${first.stderr ?? ''}`;
if (!out.includes('P3005')) process.exit(first.status ?? 1);

console.log(`\n[migrate-deploy] P3005 감지 — db push로 운영되던 기존 DB. 베이스라인 ${BASELINE}을 적용됨으로 마킹합니다.`);
const resolve = run(['migrate', 'resolve', '--applied', BASELINE]);
if (resolve.status !== 0) process.exit(resolve.status ?? 1);

console.log('[migrate-deploy] 베이스라인 마킹 완료 — migrate deploy 재시도.');
const second = run(['migrate', 'deploy']);
process.exit(second.status ?? 1);
