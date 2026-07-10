상태: 완료 (2026-07-10, fable — 유닛 160 pass·tsc·lint 그린. 통합·라이브 검증은 UI 카드 합류 후 일괄)

## C3-backfill-server: 보충 채우기 서버부 — 자격 판정·전날 귀속·paceState 'backfill'

- 분류: 기능(FILL_CADENCE_PLAN §5, C3) / 배정: **fable**(스트릭·귀속 회귀 위험 — §9 배정 힌트의 "경계 함수는 상위 모델" 연장)
- 사용자 결정(2026-07-10): C3 = **보충만**. 스트릭 유예 부활은 보류(보충 사용률 데이터 후 재검토), 와이너리 빈티지 서사는 제외.

### 설계 요지

- **귀속 규칙 단일화**: 채움의 귀속일 = `zonedDateKey(filledAt)`, 단 `isBackfill`이면 **전날**(`shiftDateKey -1`). `pace.ts fillDateKey()` 한 함수가 텀 판정·자격 판정을 커버, 통계는 SQL(`stats` 라우트)에서 같은 산식(하루 시프트) — 이중 구현 지점 2곳뿐이며 서로 주석으로 상호 참조.
- **자격(computeBackfillEligibility)**: DAILY 계열만(아니면 null). ①어제 귀속 채움 < quota ②어제 귀속 backfill 없음(1알 한정) ③그저께+그그저께 연속 backfill이면 미제공(§5 남용 방어). 48h 창은 "어제 시작으로부터 48시간" 해석 = 어제 몫은 오늘이 끝나기 전까지.
- **관대 수용**: 클라 backfill 요청이 서버 재판정에서 탈락해도 **절대 안 막음** — 일반 채움으로 폴백(early 판정 경로). 자격 통과 시에만 `isBackfill=true`·`paceState='backfill'`, strict 검사 스킵(보충은 관대 장치).
- **오늘 quota 무잠식**: backfill 스티커는 전날 귀속이라 computeFillPace의 오늘 used에 안 세어짐 — 보충 직후에도 오늘 몫은 그대로 남는다(홈 paceDone 판정 동일).

### 변경 좌표
- `src/lib/pace.ts` — `PaceFill` 입력 타입(+isBackfill), `fillDateKey`, `computeBackfillEligibility` 신규. computeFillPace 산식 무변경(귀속 키만 교체)
- `src/lib/fillBoard.ts` — `opts.backfill` + 트랜잭션 내 자격 재판정 + `isBackfill` 기록 + paceState 'backfill'
- `src/app/api/boards/[id]/stickers/route.ts` — `body.backfill === true` 수용
- `src/app/api/boards/[id]/route.ts` — 상세 GET `backfillAvailable` additive(DAILY·미완성만 판정, 경계는 보드 주인 시간대)
- `src/app/api/boards/route.ts` — 홈 paceDone 입력에 isBackfill 반영
- `src/app/api/stats/route.ts` — 날짜 버킷 SQL에 `CASE WHEN "isBackfill" THEN interval '1 day'` 시프트(스트릭·히트맵·요일 파생 전부 이 키)
- `src/lib/analytics.ts` + 드리프트 테스트 + `docs/ANALYTICS_PLAN.md` §2 — `fill_backfill` 사전 등재
- `src/lib/__tests__/pace.test.ts` — 귀속·자격 6케이스 추가(기존 케이스는 PaceFill 형태로 이행)

### 추가 결정 (UI 검수 중 발견)
- **자격 조건 4**: 보드가 어제 이미 존재했어야 함(`createdAt` 귀속키 ≤ 어제) — 없으면 오늘 만든 DAILY 보드가 생성 첫날부터 "어제 몫 채우기"를 노출(보드가 어제 없었는데). createdAt 미전달 호출은 관대 통과(실패 열림).

### 검증 (2026-07-10)
- `npx tsc --noEmit` 0 · `npm test` 161 pass(신규 7 포함) · lint 0 에러 · 통합 8/8(실 DB — backfill 자격·관대 폴백·FREE 무시 3케이스 포함)
- **라이브 E2E(로컬 dev + Playwright)**: DAILY_1 보드(createdAt 백데이트) → 오늘 몫 채움 → 다음 알 탭 → RipeningSheet에 "어제 몫 채우기" 노출 → 실행 → `isBackfill=true` 기록·`backfillAvailable` false 소진·히트맵 어제 귀속(+1)·스트릭 연결 전부 확인
- 스키마 변경 없음(isBackfill은 C1 기존 필드) — 마이그레이션 불필요
- UI 짝: `2026-07-10-C3-backfill-ui.md` (sonnet)
