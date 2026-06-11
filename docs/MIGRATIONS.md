# Prisma Migrate 운영 가이드

2026-06-11부터 이 저장소는 `prisma db push` 대신 **`prisma migrate`** 를 정식 사용한다.
`prisma/migrations/` 디렉토리가 스키마 변경의 단일 진실이며, 빌드(`npm run build`)와
CI integration 잡이 `prisma migrate deploy`로 스키마를 적용한다.

## 베이스라인 (0_init)

- `prisma/migrations/0_init/migration.sql` — 도입 시점(2026-06-11, 13개 모델 + NotificationSetting
  넛지 컬럼 + User 스트릭 유예 컬럼 포함)의 전체 스키마 스냅샷.
- **프로덕션(Neon)에는 이 스키마가 이미 db push로 적용돼 있으므로**, 전환 시 1회만
  아래 명령으로 "이미 적용됨" 마킹이 필요하다 (비파괴 — `_prisma_migrations` 테이블에 행 1개 기록):

  ```bash
  DATABASE_URL=<프로덕션 Neon URL> npx prisma migrate resolve --applied 0_init
  ```

  ⚠️ 이 마킹 **전에** 이 변경이 배포되면 빌드의 `migrate deploy`가 0_init을 새로 적용하려다
  "table already exists"로 실패한다. 반드시 resolve 먼저 → 머지 순서.

## 스키마 변경 워크플로 (이후)

1. `prisma/schema.prisma` 수정
2. 로컬 Postgres(docker)를 띄우고: `npx prisma migrate dev --name <변경_요약>`
   → `prisma/migrations/<timestamp>_<이름>/` 생성 + 로컬 적용 + client 재생성
3. 커밋에 마이그레이션 디렉토리 포함 → PR → CI integration 잡이 `migrate deploy`로 검증
4. 머지 → Vercel 빌드의 `migrate deploy`가 프로덕션에 적용

`npm run db:push`는 **로컬 실험 전용**으로만 남겨둔다 (이력을 남기지 않으므로
공유 DB·프로덕션에는 사용 금지).

## 검증 기록 (도입 시)

- fresh Postgres 16에 `migrate deploy` → 0_init 적용 성공
- `prisma migrate diff --from-url <적용된 DB> --to-schema-datamodel schema.prisma` → **empty** (drift 0)
- 적용된 DB에서 통합테스트 5/5 통과

## 백업/복구 메모

- Neon은 브랜치/PITR을 제공 — 대형 스키마 작업 전 Neon 콘솔에서 브랜치를 떠두는 것을 권장.
- 실제 복원 리허설은 Neon 콘솔 접근이 필요해 미실시 (로드맵 M2 항목 잔여).
