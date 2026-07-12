상태: 대기

## BE-3: 핫패스 인덱스 마이그레이션 (B5 — additive-only, 단독 웨이브)

- Severity: Med(성능·확장성) / 분류: 스키마 / 배정: **fable 직접** (schema.prisma는 페이블 전담 파일)
- 필독: docs/MIGRATIONS.md 전체(단독 웨이브·PR·CI integration 검증), PRINCIPLES §3 데이터 레이어 게이트

### 소유 파일
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_hot_path_indexes/` (신규)

### 문제/재현
인덱스 0개 테이블 3종 + FK 1건 (쿼리 실측 기반):
- `Reminder`(schema:233-248): cron/reminders가 **5분마다** `{isActive, time:{lte}, type}` 조건 풀스캔 (reminders/route.ts:55)
- `TimeCapsule`(schema:164-176): `boardId`(capsules 라우트:34)·`userId,openAt`(vine:58, export:69) 조회 풀스캔
- `Relay`(schema:178-190): relays GET의 `creatorId` OR 좌항(relays/route.ts:14) 무인덱스
- `Message.boardId`(schema:148): `onDelete: SetNull` — 보드 삭제·계정 삭제 캐스케이드(auth/me:105)가 스캔

### 스펙
additive 인덱스만 (기존 인덱스·유니크·필드 불변):
- `Reminder`: `@@index([isActive, time])` + `@@index([userId])`
- `TimeCapsule`: `@@index([boardId])` + `@@index([userId, openAt])`
- `Relay`: `@@index([creatorId])`
- `Message`: `@@index([boardId])`
- 부수: `RelayParticipant.status` 주석에 `invited` 값 추가 (relays/route.ts:185 실사용 — 코드 정상, 주석만 불완전)

### 제약
- MIGRATIONS.md 절차: 로컬 Docker PG(`docker start podoal-pg`)에서 `npx prisma migrate dev --name add_hot_path_indexes` → 생성된 마이그레이션 디렉토리 커밋. Docker 불능 시 `prisma migrate diff` 오프라인 생성 예외 절차.
- **단독 PR** — 다른 카드와 커밋 섞기 금지. CI integration 잡(fresh PG `migrate deploy`) 녹색 확인 후 머지. W3는 머지 후 착수.
- CREATE INDEX CONCURRENTLY 사용 안 함(트랜잭션 분리 필요·현 데이터량에서 짧은 쓰기 락 무해).

### 검증법
```bash
npx prisma migrate status        # drift 0
npm run test:integration         # fillBoard·giftBoard 회귀
# CI integration 잡 녹색 = fresh PG에 migrate deploy 성공 증명
```

### 산출
schema.prisma diff + 마이그레이션 SQL + 검증 로그. 페이블 직접 수행이므로 커밋 포함.
