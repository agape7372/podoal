// prisma migrate deploy 래퍼 — 빌드가 쓰는 **유일한** 마이그레이션 경로.
//
// 이 스크립트는 pending 마이그레이션을 적용하는 일만 한다. 스키마 이력(_prisma_migrations)을
// 추정으로 조작하지 않는다.
//
// 2026-07-22 변경(감사 H-04): 예전에는 P3005("database schema is not empty")가 보이면
// 스키마 지문 확인 없이 baseline(0_init)을 applied로 마킹한 뒤 재시도했다. 그 경로는
// **모든 Vercel 빌드(프리뷰 포함)** 에서 돌았기 때문에, 비어 있지 않은 엉뚱한 DB나 drift가
// 생긴 DB도 "과거 db push DB"로 오인해 이력에 거짓 기록을 남길 수 있었다. 게다가 app build가
// 뒤에서 실패해도 DB 변경은 이미 남았다.
//
// 이제 P3005는 **fail-closed** 다 — 빌드를 세우고 사람이 판단하게 한다.
// 진짜 baseline이 필요한 경우의 절차: `npx tsx scripts/baseline-init.ts`
// (승인 플래그 + 대상 DB명 재확인 + 스키마 지문 검사를 요구하는 일회성 운영 스크립트).
// 상세: docs/MIGRATIONS.md §베이스라인.
import { spawnSync } from 'node:child_process';

const res = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  shell: true,
  encoding: 'utf8',
  stdio: 'pipe',
});

process.stdout.write(res.stdout ?? '');
process.stderr.write(res.stderr ?? '');

if (res.status === 0) process.exit(0);

const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
if (out.includes('P3005')) {
  console.error(`
[migrate-deploy] P3005 — 대상 DB에 스키마는 있는데 마이그레이션 이력이 없습니다.

자동 baseline은 제거됐습니다(감사 H-04). 이력 없는 DB를 자동으로 "적용됨"이라고
기록하면, 실제로는 다른 스키마를 가진 DB에 이후 마이그레이션이 그대로 실행됩니다.

다음 중 무엇인지 먼저 확인하세요:
  1. 배포 대상 DATABASE_URL이 의도한 DB가 맞는가 (프리뷰/운영 혼선?)
  2. 정말 db push로 운영되던 기존 DB를 이관하는 상황인가
     → 백업/Neon 브랜치를 확보한 뒤 npx tsx scripts/baseline-init.ts
  3. 그 밖이면 이 DB에 배포하면 안 됩니다.

상세: docs/MIGRATIONS.md §베이스라인
`);
}

process.exit(res.status ?? 1);
