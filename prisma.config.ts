// Prisma 7 CLI 설정 — v7부터 .env 자동 로딩이 사라져 dotenv를 직접 import해야
// 로컬에서 migrate/generate/seed가 .env의 DATABASE_URL을 읽는다.
// (Vercel/CI는 프로세스 env에 이미 주입되어 있어 dotenv 없이도 동작.)
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // v7: migrate dev가 seed를 자동 실행하지 않음 — `prisma db seed`로 명시 실행.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // CLI(migrate deploy/dev, db push)가 쓰는 URL. 런타임 클라이언트는
    // src/lib/prisma.ts의 PrismaPg 어댑터가 같은 env를 별도로 읽는다.
    url: env('DATABASE_URL'),
    // 섀도 DB는 **설정됐을 때만** 넘긴다. v7의 `migrate diff --to-migrations`가
    // 마이그레이션을 재생하려면 이 값을 요구하는데(scripts/baseline-init.ts의 지문 검사),
    // 평소 배포·개발 경로에는 필요 없다. 무조건 넣으면 값이 없는 환경에서 CLI 전체가 깨진다.
    ...(process.env.SHADOW_DATABASE_URL ? { shadowDatabaseUrl: env('SHADOW_DATABASE_URL') } : {}),
  },
});
