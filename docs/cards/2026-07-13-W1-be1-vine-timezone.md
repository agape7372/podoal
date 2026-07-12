상태: 완료 (2026-07-13 — 통합 테스트 2건 통과: 비Seoul 경계·dayResetHour 귀속, vine==stats 날짜키)

## BE-1: vine 날짜 그룹핑 시간대 정합 (B1 — 정확성 버그)

- Severity: High(정합성) / 분류: 버그 / 배정: opus
- 필독: PRINCIPLES §3 데이터 레이어 게이트(이 카드는 응답 계약 불변이라 게이트 통과 — 재현 필수), CLAUDE.md `dayBoundary.ts` 절(이중 구현 금지), REVIEW_CHECKLIST 게이트 4

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/api/vine/route.ts`
- `tests/integration/vine.integration.test.ts` (신규)

### 문제/재현
`vine/route.ts:146`의 날짜 그룹핑이 `toDateString()`(서버 로컬 = Vercel **UTC**) 기준. 반면 stats/heatmap/streak은 유저 타임존 `zonedDateKey`(`stats/route.ts:63-64` — `User.timezone`+`dayResetHour` 반영) 기준. 재현: KST 사용자가 06-13 07:00 KST(=06-12 22:00 UTC)에 채움 → 통계·히트맵은 06-13, 포도덩굴은 06-12로 표시. **같은 활동이 화면마다 다른 날짜.**

### 원인
`vine/route.ts:146` (및 동일 패턴의 나머지 버킷) — 스티커·완성 보드·캡슐 3개 버킷 모두 서버 로컬 날짜 사용.

### 스펙 (시험 가능한 문장)
- `stats/route.ts:46-50` 패턴 모방: 라우트 시작에서 유저의 `timezone`/`dayResetHour` 조회 → 3개 버킷(스티커 채움·보드 완성·캡슐) **전부** `zonedDateKey`(기존 lib — `src/lib/streak.ts` 쪽 구현 재사용, 신규 구현 금지)로 치환. **하나라도 남기면 화면 내 자기모순 — 전부.**
- 응답 계약 불변: date 키 포맷(YYYY-MM-DD 형태) 동일, 필드 추가·삭제 없음. 비Seoul/경계시간 사용자만 값이 이동.
- `dayResetHour`도 stats와 동일하게 적용.
- 통합 테스트 신설 `tests/integration/vine.integration.test.ts`: 비Seoul timezone(예: America/New_York) 사용자로 UTC 경계 근처 스티커 생성 → vine의 날짜 키 == stats 히트맵의 날짜 키 단언. 기존 `tests/integration/fillBoard.integration.test.ts`의 셋업 패턴 모방.

### 제약
- `dayBoundary.ts`/`streak.ts`의 기존 유틸 사용 — 날짜 경계 이중 구현 금지 (CLAUDE.md 명문).
- 라우트 시그니처·쿼리 형태 최소 변경. 리팩토링 금지.

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test
# 통합(로컬 Docker PG 필요): npm run test:integration -- --test-name-pattern vine
```

### 보고 전 자가검증
각 주장을 이 세션의 도구 결과와 대조 — 증거를 가리킬 수 있는 작업만 보고. 검증 안 된 것은 "미검증" 명시. 테스트 실패는 출력과 함께. 완료·검증된 것은 헤징 없이 완료로.

### 산출
diff + 검증 로그. **커밋 금지** (git add도 금지 — 페이블이 수행).
