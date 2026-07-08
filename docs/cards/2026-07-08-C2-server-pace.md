상태: 서버부 완료(검증대기) — UI 잔여분은 `2026-07-08-C2-ui-badge.md`(sonnet)

### 검증 로그 (2026-07-08, 페이블)
- `npm test` → 152 tests, 148 pass, 0 fail(스킵 4는 기존 통합테스트 게이트) — 신규 `pace.test.ts` 12케이스 전부 통과(등가 계약·resetHour 새벽 귀속·DST 시간대·오염 tz 폴백·weekStartKey 연도 경계·DAILY/WEEKLY ripe/early 분기·cadenceN 결측 방어)
- `npx tsc --noEmit` 0 에러 · `npm run lint` 0 에러(경고 69 기존분) · check-icons 통과
- **raw SQL 등가 실측**: 로컬 podoal-pg 실데이터 133행 전수 — 구 `+ interval '9 hours'` vs 신 `(AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul' - make_interval(hours => 0)` 날짜키 **133/133 일치**
- 응답 계약: paceState·paceDone 전부 additive(FREE면 필드 생략) — 기존 클라 무영향. strictMode 422는 현재 UI 미노출이라 도달 경로 없음(C4 방어선)

## C2-server-pace: 채움 텀 C2 — 서버 판정 + 경계 함수 통일 (FILL_CADENCE_PLAN §9 C2)

- 분류: 기능(백로그 "채움 텀" C2 슬라이스) / 배정: **페이블 직접**(경계 함수 = 스트릭 회귀 위험 — §9 배정 힌트 준수). UI(홈 배지·반짝)는 후속 sonnet 카드.
- 필독: `docs/FILL_CADENCE_PLAN.md` §4·§8·§9, `docs/PRINCIPLES.md` §3

### 설계 결정 (페이블)

**1. 경계 인스턴트를 계산하지 않는다 — 날짜키 비교로 통일.**
IANA 시간대의 "로컬 자정 인스턴트" 계산은 오프셋 프로빙(2-pass)이 필요해 복잡·오류 유발. 대신:
- `zonedDateKey(instant, tz, resetHour)` — instant를 resetHour만큼 뒤로 민 뒤 tz의 달력 날짜(YYYY-MM-DD)를 Intl.DateTimeFormat(캐시)로 추출. **기간 소속 판정은 전부 키 비교**(DAILY: 같은 키, WEEKLY: 같은 weekStartKey).
- `weekStartKey(dateKey)` — 키의 요일을 UTC 파싱으로 구해 월요일 키로 역산(순수 문자열 산술, tz 무관).
- ISO 날짜키는 사전순=시간순이라 범위 비교도 문자열로 안전.

**2. 서버 날짜키의 정본은 `src/lib/streak.ts`** (계획서의 "dayBoundary.ts 단일 유틸"에서 의도적 이탈):
- streak.ts가 이미 서버 날짜키 모듈(kstDateKey·shiftDateKey·kstDayRangeUtc·computeStreaks, 테스트 완비)이고 stats 라우트가 임포트 중. 여기에 zonedDateKey·weekStartKey를 합류시키는 것이 실질적 단일화.
- `dayBoundary.ts`(클라, 기기 로컬 인스턴트 산술)는 C1 계약대로 유지 — 클라 즉답 UI 전용. 헤더 주석으로 서버 정본 위치 명시. 한국 유저(기기=Asia/Seoul)에선 두 판정이 일치.
- 등가 계약: `zonedDateKey(d, 'Asia/Seoul', 0) === kstDateKey(d)` — 단위 테스트로 고정. 기존 유저 전원이 기본값이므로 **회귀 0**.

**3. 캡슐은 이번에 통일하지 않는다** — `capsuleTime.ts`의 개봉 판정은 이미 정밀 타임스탬프 비교(GAP-13은 H7에서 해소)라 하루 경계와 무관. 'YYYY-MM-DD' 입력의 KST 자정 해석에 resetHour를 섞는 것은 의미상 부적절(캡슐은 "그 날짜 0시 개봉" 약속). 결정 근거 기록만.

**4. 서버 paceState 판정 위치 = fillBoardGrape 트랜잭션 내부** — Serializable 안에서 기존 스티커 filledAt을 읽어 키 비교(보드 최대 60개라 부담 없음). 판정 결과:
- 소프트 모드: 200 유지 + `earlyFill = 클라 플래그 OR 서버 판정`(아너 시스템 §1.3 — 서버가 authoritative하게 기록만). 응답에 `paceState: 'ripe'|'early'` additive.
- `strictMode=true`(현재 UI 미노출, C4 대비 방어선): 익지 않은 채움 → **422** + "아직 익는 중이에요. 다 익으면 채울 수 있어요."
- FREE/미인식 타입: paceState 자체를 응답에서 생략(undefined) — 기존 클라 무영향.

### 소유 파일
- `src/lib/streak.ts` — zonedDateKey·weekStartKey 추가
- `src/lib/pace.ts` (신규) — `computeFillPace()` 순수 함수(fillBoard·boards 목록 공용)
- `src/lib/fillBoard.ts` — 트랜잭션 내 판정 + StrictPaceError + 결과에 paceState
- `src/app/api/boards/[id]/stickers/route.ts` — board select 확장(cadence·strictMode·owner tz), 422 분기
- `src/app/api/stats/route.ts` — kstDateKey 고정 → zonedDateKey(user.timezone, user.dayResetHour) 전환(기본값에서 완전 동치)
- `src/app/api/boards/route.ts` — GET 목록에 `paceDone?: boolean` additive(DAILY/WEEKLY 보드만, 홈 배지용)
- `src/lib/__tests__/pace.test.ts` (신규) + `src/lib/__tests__/streak.test.ts` (등가 테스트 추가)
- `src/lib/dayBoundary.ts` — 헤더 주석 갱신(서버 정본 위치)
- `src/types/index.ts` — BoardSummary.paceDone additive

### 제약
- `mergeServerBoard`/`applyFillResult`/낙관 큐/`isJustFilled` 무수정(§1.5).
- 기존 응답 필드 제거·rename 금지. 전부 additive.
- 기본값(Asia/Seoul·resetHour 0)에서 stats 응답이 기존과 바이트 동일해야 함(회귀 계약).

### 검증법
- `npm test`(node:test 전체) + `npx tsc --noEmit` + `npm run lint`
- 등가 테스트: zonedDateKey(Seoul,0) ≡ kstDateKey, DST 시간대(America/New_York) 케이스, resetHour=4 새벽 귀속
- pace 판정 분기표: DAILY_1/DAILY_N/WEEKLY_N × ripe/early, strict 422

### 산출
diff + 검증 로그 + FILL_CADENCE_PLAN 상태 갱신 + 후속 sonnet UI 카드(홈 배지 + 완전히 익을 때 반짝 1회) 발행. 커밋은 사용자 지시 대기.
