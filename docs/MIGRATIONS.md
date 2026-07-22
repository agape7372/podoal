# Prisma Migrate 운영 가이드

2026-06-11부터 이 저장소는 `prisma db push` 대신 **`prisma migrate`** 를 정식 사용한다.
`prisma/migrations/` 디렉토리가 스키마 변경의 단일 진실이며, 빌드(`npm run build`)와
CI integration 잡이 `prisma migrate deploy`로 스키마를 적용한다.

## Prisma 7 체제 (2026-06-11~)

- 연결 URL은 schema.prisma가 아니라 **`prisma.config.ts`의 `datasource.url`** 에서 읽는다.
- v7 CLI는 `.env`를 자동 로딩하지 않는다 — `prisma.config.ts` 최상단의 `import 'dotenv/config'`가
  로컬 .env를 대신 읽어준다. (Vercel/CI는 프로세스 env 주입이라 무관.)
- `migrate dev`가 **client 재생성과 seed를 자동 실행하지 않는다** — 필요 시
  `npx prisma generate` / `npx prisma db seed`(또는 `npm run db:seed`)를 명시 실행.
- 런타임 클라이언트는 드라이버 어댑터(`@prisma/adapter-pg`) 필수 — `src/lib/prisma.ts` 참고.

## 베이스라인 (0_init)

- `prisma/migrations/0_init/migration.sql` — 도입 시점(2026-06-11, 13개 모델 + NotificationSetting
  넛지 컬럼 + User 스트릭 유예 컬럼 포함)의 전체 스키마 스냅샷.
- 프로덕션(Neon)에는 2026-06-11에 이 전환이 이미 끝났다. 그 뒤 8개 마이그레이션이
  정상 적용됐으므로 이력(`_prisma_migrations`)은 살아 있다.

### ⚠ 2026-07-22 변경 — 자동 baseline 제거 (감사 H-04)

예전에는 `scripts/migrate-deploy.mjs`가 P3005를 보면 **스키마 지문 확인 없이** `0_init`을
applied로 마킹하고 재시도했다. 그 경로는 **프리뷰를 포함한 모든 Vercel 빌드**에서 돌았기 때문에

- 비어 있지 않은 엉뚱한 DB나 drift가 생긴 DB도 "과거 db push DB"로 오인할 수 있었고,
- app build가 뒤에서 실패해도 DB 변경은 이미 남았다.

이제 **P3005는 빌드를 세운다(fail-closed).** 배포는 DB를 추정으로 고치지 않는다.

### baseline이 정말 필요할 때 (일회성 운영 절차)

```bash
# 0. 백업 — Neon 콘솔에서 브랜치를 떠두거나 PITR 지점을 확인한다.
# 1. 마이그레이션을 재생해 볼 **빈** 임시 DB를 만든다 (내용이 지워진다 — 운영 DB 금지).
# 2. 승인 플래그 + 대상 DB명 재확인을 명시해 실행한다.
DATABASE_URL="<대상 DB>" \
SHADOW_DATABASE_URL="<빈 임시 DB>" \
ALLOW_BASELINE=true \
BASELINE_CONFIRM_DATABASE="<대상 DB명>" \
npx tsx scripts/baseline-init.ts
```

세 관문을 통과해야 기록한다:

1. `ALLOW_BASELINE=true` (값은 정확히 `true`)
2. `BASELINE_CONFIRM_DATABASE`가 URL에서 파싱한 실제 DB명과 일치
3. **스키마 지문 검사** — `prisma migrate diff --from-config-datasource --to-migrations`가
   비어야 한다. 즉 대상 DB의 실제 구조가 `prisma/migrations`의 최종 상태와 정확히 같아야만
   "적용됨"으로 기록하는 것이 정당하다. 한 컬럼이라도 다르면 차이를 DDL로 보여주고 중단한다.

판정 로직은 `src/lib/seedGuard.ts`(순수 함수, 단위 테스트 있음)에 있고, 스크립트는 그것을 쓴다.

- 실측 검증(2026-07-22, 로컬 Postgres 16): 빈 DB → `migrate deploy` 정상 / db push로 만든
  이력 없는 DB → P3005 fail-closed / 같은 DB에 baseline-init → 지문 일치 후 9개 기록 →
  이후 `migrate deploy` 정상 / 컬럼 하나를 지운 DB → 지문 불일치로 거부.

## Preview 환경 DB는 반드시 분리한다

`vercel.json`의 buildCommand는 `npm run build`이고 그 안에 `migrate deploy`가 있다.
**프리뷰 배포도 같은 명령을 실행한다.** 따라서 Vercel Preview 환경의 `DATABASE_URL`이
Production과 같으면, PR 프리뷰 빌드 하나가 프로덕션 스키마를 변경한다.

- Neon 브랜치를 하나 만들어 Vercel Project → Settings → Environment Variables에서
  **Preview 스코프에만** 그 URL을 지정할 것.
- 확인 방법: Vercel 대시보드에서 `DATABASE_URL`의 환경 스코프(Production / Preview /
  Development)가 각각 다른 값인지 본다.

## 스키마 변경 워크플로 (이후)

1. `prisma/schema.prisma` 수정
2. 로컬 Postgres(docker)를 띄우고: `npx prisma migrate dev --name <변경_요약>`
   → `prisma/migrations/<timestamp>_<이름>/` 생성 + 로컬 적용
   (v7: client 재생성은 자동이 아님 — 이어서 `npx prisma generate`)
3. 커밋에 마이그레이션 디렉토리 포함 → PR → CI integration 잡이 `migrate deploy`로 검증
4. 머지 → Vercel 빌드의 `migrate deploy`가 프로덕션에 적용

`npm run db:push`는 **로컬 실험 전용**으로만 남겨둔다 (이력을 남기지 않으므로
공유 DB·프로덕션에는 사용 금지).

## 오프라인 생성 예외 기록 (2026-07-08)

- `20260708000000_add_cadence_fields`는 로컬 Docker 엔진 불능(WSL docker-desktop 기동 실패) 상태에서
  `prisma migrate diff --from-schema <HEAD schema> --to-schema <신 schema> --script`로 **오프라인 생성**했다
  (순수 additive 3 ALTER — User.timezone/dayResetHour, Board.cadence*/strictMode, Sticker.isBackfill/earlyFill).
- 전제: migrations 디렉토리 == HEAD schema(drift 0 — 위 검증 기록의 규율 유지 시 안전).
  적용 검증은 CI integration 잡(`migrate deploy` on fresh PG)이 수행. 로컬 DB는 Docker 복구 후
  `npx prisma migrate dev`가 아니라 `npx prisma migrate deploy`로 따라잡을 것(이미 디렉토리가 존재하므로).

## 검증 기록 (도입 시)

- fresh Postgres 16에 `migrate deploy` → 0_init 적용 성공
- `prisma migrate diff --from-url <적용된 DB> --to-schema-datamodel schema.prisma` → **empty** (drift 0)
- 적용된 DB에서 통합테스트 5/5 통과

## 백업/복구 메모

- Neon은 브랜치/PITR을 제공 — 대형 스키마 작업 전 Neon 콘솔에서 브랜치를 떠두는 것을 권장.
- 실제 복원 리허설은 Neon 콘솔 접근이 필요해 미실시 (로드맵 M2 항목 잔여).
