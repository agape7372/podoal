상태: 검증대기

## W2-cadence-create: 채움 텀 C1 — 생성 플로우 텀 선택 + 템플릿 권장값

- 분류: 기능(백로그 "채움 텀" C1 슬라이스 1/2) / 배정: **sonnet**
- 필독: `docs/FILL_CADENCE_PLAN.md` §0~§2·§8, `docs/PRINCIPLES.md` §3(데이터 레이어 게이트)·§5(UI)

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/(app)/board/create/page.tsx`
- `src/components/create/CadencePicker.tsx` (신규)
- `src/lib/templates.ts`
- `src/app/api/boards/route.ts`
- `src/app/api/boards/[id]/route.ts` (GET 응답 필드 추가만)

### 선반영 완료 (페이블 — 이 카드에서 손대지 말 것)
- Prisma 스키마: `Board.cadenceType String @default("FREE")`, `Board.cadenceN Int?`, `Board.strictMode Boolean @default(false)` — 마이그레이션 적용·client 재생성 완료.
- `src/types/index.ts`: `BoardSummary`에 `cadenceType?: string; cadenceN?: number | null;` 및 `CadenceType` 타입·`CADENCE_TYPES` 상수 추가 완료.

### 문제/배경
30알 보드를 1분 만에 다 채울 수 있어 습관 은유가 붕괴(요청 1위 REQ-03). C1은 생성 시 "채우는 리듬"을 고르게 하고 저장까지만 — 숙성 연출·탭 판정은 다음 카드(W3-cadence-ripen).

### 스펙
1. **템플릿 권장값** (`templates.ts`): `HabitTemplate`에 optional `recommendedCadence?: { type: 'DAILY_1' | 'DAILY_N' | 'WEEKLY_N'; n?: number }` 추가. 기존 필드·카피 무변경. 명백한 것만 부여(애매하면 생략=FREE):
   - `DAILY_N`: 물 마시기(n=8), 스트레칭(n=2 — "아침저녁")
   - `DAILY_1`: 운동하기·걷기·수면 관리·명상하기 등 "매일/하루" 계열 전부
   - `WEEKLY_N`: 설명이 "주 N회" 계열이면 해당 n — 없으면 부여하지 않음
   - 판단 기준은 각 템플릿 description 문구. 전 38개를 훑고 부여 목록을 검증 로그에 표로 남길 것.
2. **CadencePicker** (신규 컴포넌트): 생성 4스텝 중 **step 2(크기 스텝)** 하단에 "채우는 리듬" 서브 섹션(스텝 수 불변 — 5스텝 확장 금지).
   - 선택지 4개(세그먼트/카드형, clay 스타일): 자유롭게(FREE) · 하루 한 알(DAILY_1) · 하루 여러 알(DAILY_N) · 일주일 목표(WEEKLY_N).
   - DAILY_N 선택 시 N 스테퍼(2~10, 기본 3), WEEKLY_N 선택 시 N 스테퍼(1~7, 기본 3) — 기존 `NumberStepper` 재사용.
   - 보조 설명 1줄: "포도는 하루아침에 익지 않아요 · 리듬을 정하면 다음 알이 익을 때까지 기다렸다 채워요" (FREE 선택 시엔 "언제든 자유롭게 채워요").
   - 기본값: 선택한 템플릿의 `recommendedCadence`가 있으면 그것, 없으면 FREE. 직접 입력(템플릿 스킵)도 FREE.
   - `giftTo` 모드(선물 생성)면 섹션 **숨김 + FREE 고정**(FILL_CADENCE §2 — 선물 보드 v1 FREE).
3. **POST /api/boards**: body에 `cadenceType`·`cadenceN` 수용(additive). 검증:
   - `cadenceType`: undefined 허용(→"FREE") 또는 `'FREE'|'DAILY_1'|'DAILY_N'|'WEEKLY_N'` 외엔 400 "채우는 리듬 값이 올바르지 않아요."
   - `cadenceN`: DAILY_N이면 정수 2~10 필수, WEEKLY_N이면 정수 1~7 필수(아니면 400 "리듬 횟수가 올바르지 않아요."), FREE/DAILY_1이면 무시하고 null 저장.
   - create data에 cadenceType·cadenceN 저장. 응답 result에 `cadenceType`·`cadenceN` 포함(additive). GET 목록 응답에도 두 필드 추가.
4. **GET /api/boards/[id]**: 응답 객체에 `cadenceType`·`cadenceN` 필드 추가만(기존 필드 무변경 — W3 카드가 소비).

### 제약
- 기존 응답 필드 제거·rename 금지. `strictMode`는 이번에 UI 미노출(C4) — API도 미수용.
- 신규 카피는 위 문구 그대로. `transition-all` 금지. step 푸터 버튼 로직 무수정.

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- 검증 로그: ①템플릿 부여 표(id→cadence) ②POST 검증 분기표(입력→기대 응답코드) ③giftTo 모드에서 FREE 고정 근거 좌표.

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**

### 검증 로그 (2026-07-08)

**수정/신규 파일**
- `src/lib/templates.ts` — `HabitTemplate.recommendedCadence?` 추가 + 38개 중 26개에 부여
- `src/components/create/CadencePicker.tsx` (신규)
- `src/app/(app)/board/create/page.tsx` — state 2개 + step2 서브섹션 + payload 확장
- `src/app/api/boards/route.ts` — POST 검증/저장/응답, GET 목록 응답 additive
- `src/app/api/boards/[id]/route.ts` — GET 응답 필드 추가만

**빌드 검증**
- `npx tsc --noEmit` → 에러 0 (exit 0)
- `npm run lint` → `0 errors, 22 warnings`(전부 기존 파일의 `react-hooks/set-state-in-effect`, 이번 카드 파일과 무관) + `check-icons.mjs` 통과("모든 이모지가 플랫 SVG로 커버됨 · JSX 생이모지 없음 · 선택지 배열 커버됨"). CadencePicker는 신규 이모지를 쓰지 않아 아이콘 가드 리스크 자체를 회피.

**① 템플릿 부여 표 (38개 전수, description 문구 기준)**

| id | description 핵심 문구 | 부여 | 근거 |
|---|---|---|---|
| health-water | "하루 8잔" | `DAILY_N n=8` | 카드 명시 |
| health-exercise | "매일 30분 이상" | `DAILY_1` | 카드 명시(운동하기)+"매일" |
| health-stretch | "아침저녁 10분" | `DAILY_N n=2` | 카드 명시 |
| health-walk | "하루 만보" | `DAILY_1` | 카드 명시(걷기)+"하루" |
| health-sleep | "규칙적인 수면 습관" | `DAILY_1` | 카드 명시(수면 관리) |
| health-meditation | "하루 10분" | `DAILY_1` | 카드 명시(명상하기)+"하루" |
| health-vitamin | "매일 영양제" | `DAILY_1` | "매일" |
| health-weight | "매일 체중" | `DAILY_1` | "매일" |
| growth-reading | "하루 30분" | `DAILY_1` | "하루" |
| growth-study | "매일 꾸준히" | `DAILY_1` | "매일" |
| growth-diary | "하루를 돌아보며" | `DAILY_1` | "하루" |
| growth-english | "매일 영어 단어 10개 또는 문장 5개" | `DAILY_1` | "매일"(N이 10/5 이중값이라 DAILY_N 미부여 — 애매) |
| growth-news | "매일 뉴스" | `DAILY_1` | "매일" |
| growth-lecture | "꾸준히 수강" | — (FREE) | cadence 문구 없음("꾸준히"만) |
| lifestyle-wakeup | "매일 아침 같은 시간" | `DAILY_1` | "매일" |
| lifestyle-clean | "매일 10분" | `DAILY_1` | "매일" |
| lifestyle-cook | "직접 요리해서" | — (FREE) | cadence 문구 없음 |
| lifestyle-saving | "지출을 줄이고" | — (FREE) | cadence 문구 없음 |
| lifestyle-organize | "제자리에 놓는" | — (FREE) | cadence 문구 없음 |
| lifestyle-skincare | "아침저녁 꼼꼼한" | `DAILY_N n=2` | **판단 확장**(아래 참고) |
| work-morning | "여유롭게 아침을" | — (FREE) | "아침"만, "매일/하루" 없음 |
| work-plan | "하루 시작 전" | `DAILY_1` | "하루" |
| work-meeting | "회의 후" | — (FREE) | 이벤트 트리거, cadence 문구 없음 |
| work-cert | "매일 공부해요" | `DAILY_1` | "매일" |
| work-portfolio | "꾸준히 만들어요" | — (FREE) | cadence 문구 없음 |
| social-contact | "먼저 연락하는" | — (FREE) | cadence 문구 없음 |
| social-compliment | "하루에 한 번" | `DAILY_1` | "하루"+"한 번"(=1, DAILY_N 범위 2~10 미달) |
| social-gratitude | "3가지를 매일 기록" | `DAILY_1` | "매일"(3가지=한 세션 내 항목 수라 DAILY_N n=3 미부여 — 물마시기처럼 하루 중 분산 행동이 아님) |
| hobby-drawing | "매일 조금씩" | `DAILY_1` | "매일" |
| hobby-music | "매일 연습해요" | `DAILY_1` | "매일" |
| hobby-photo | "일상의 아름다운 순간" | — (FREE) | "일상"만, "매일/하루" 없음 |
| hobby-blog | "나만의 이야기" | — (FREE) | cadence 문구 없음 |
| hobby-coding | "매일 코드를" | `DAILY_1` | "매일" |
| mental-emotion | "오늘의 감정" | — (FREE) | "오늘"만, "매일/하루" 없음(growth-diary의 "하루를"과 구분) |
| mental-sns | "하루 30분 이내" | `DAILY_1` | "하루" |
| mental-detox | "취침 1시간 전" | — (FREE) | cadence 문구 없음 |
| mental-affirmation | "매일 아침" | `DAILY_1` | "매일" |
| mental-alone | "하루 30분" | `DAILY_1` | "하루" |

집계: `DAILY_N`=3(물마시기·스트레칭·스킨케어), `DAILY_1`=23, FREE(미부여)=12, `WEEKLY_N`=0(38개 중 "주 N회" 계열 문구 없음 — 스펙의 "없으면 부여하지 않음" 그대로 적용).

**스펙 이탈/판단 확장 1건**: `lifestyle-skincare`(아침저녁 스킨케어)에 `DAILY_N n=2`를 부여한 것은 카드가 명시한 2개 예시(물마시기·스트레칭) 밖의 확장이다. 근거: description이 스트레칭과 똑같은 "아침저녁"(하루 중 물리적으로 분리된 2회 세션) 문구를 그대로 쓰고 있어, 카드가 스트레칭에 n=2를 부여한 것과 동일 근거(아침 세션+저녁 세션)가 문자 그대로 재현된다. "감사하기(3가지)"·"영어공부(10개/5개)"는 항목 수(하나의 세션 안에서 여러 개를 처리)라 이 패턴과 달라 DAILY_1에 머물렀다 — 위 표의 해당 행에 구분 근거 명시. 과설계로 판단되면 `lifestyle-skincare`의 `recommendedCadence` 한 줄만 제거하면 된다(`src/lib/templates.ts:244`).

**② POST /api/boards 검증 분기표**

| cadenceType 입력 | cadenceN 입력 | 기대 응답 |
|---|---|---|
| undefined | (무관) | 201 · 서버가 FREE로 취급 · cadenceN=null 저장 |
| `'FREE'` | 임의값/undefined | 201 · cadenceN 무시 → null 저장 |
| `'DAILY_1'` | 임의값/undefined | 201 · cadenceN 무시 → null 저장 |
| `'DAILY_N'` | `5` (정수, 2~10) | 201 · cadenceN=5 저장 |
| `'DAILY_N'` | undefined | 400 "리듬 횟수가 올바르지 않아요." |
| `'DAILY_N'` | `1` (범위 미만) | 400 "리듬 횟수가 올바르지 않아요." |
| `'DAILY_N'` | `11` (범위 초과) | 400 "리듬 횟수가 올바르지 않아요." |
| `'DAILY_N'` | `3.5` (비정수) | 400 "리듬 횟수가 올바르지 않아요." |
| `'DAILY_N'` | `"5"` (문자열) | 400 "리듬 횟수가 올바르지 않아요."(`Number.isInteger("5")===false`) |
| `'WEEKLY_N'` | `3` (정수, 1~7) | 201 · cadenceN=3 저장 |
| `'WEEKLY_N'` | `0` (범위 미만) | 400 "리듬 횟수가 올바르지 않아요." |
| `'WEEKLY_N'` | `8` (범위 초과) | 400 "리듬 횟수가 올바르지 않아요." |
| `'BOGUS'`(미정의 타입) | 아무값 | 400 "채우는 리듬 값이 올바르지 않아요." |
| `123`(문자열 아님) | 아무값 | 400 "채우는 리듬 값이 올바르지 않아요." |
| `null` | 아무값 | 400 "채우는 리듬 값이 올바르지 않아요."(`null !== undefined`라 FREE로 안 봐줌 → `typeof null !== 'string'`에 걸림) |

코드 좌표: `src/app/api/boards/route.ts:85-103`(검증 블록), `:118-119`(create data 저장), `:165-166`(응답 additive). GET 목록 additive는 `:52-53`. 실제 curl/dev-server 실행 검증은 카드 제약(dev 서버 기동 금지)에 따라 수행하지 않음 — 코드 정독 + 분기별 수동 트레이스로 대체(위 표의 각 행을 로직에 대입해 확인).

**③ giftTo 모드 FREE 고정 근거 좌표** (3중 방어)
1. `src/app/(app)/board/create/page.tsx` `handleSelectTemplate` 내 `const rec = !giftTo ? template.recommendedCadence : undefined;` — 템플릿이 권장 리듬을 갖고 있어도 giftTo면 애초에 state에 반영 안 함.
2. 같은 파일 Step2 렌더 `{!giftTo && <CadencePicker ... />}` — UI 자체를 숨겨 사용자가 수동 변경 불가.
3. `handleCreate` 내 `const effectiveCadenceType: CadenceType = giftTo ? 'FREE' : cadenceType;` / `const effectiveCadenceN = !giftTo && (cadenceType === 'DAILY_N' || cadenceType === 'WEEKLY_N') ? cadenceN : undefined;` — 위 두 방어가 뚫려도 제출 payload에서 최종적으로 강제. 서버는 이 값을 `'FREE'`로 받아 `cadenceN`을 저장하지 않음(undefined → 서버가 FREE로 취급).

**기타 판단 메모**
- `NumberStepper` 재사용 시 내부 `aria-label`이 "포도알 개수 N개…"로 고정돼 있어(컴포넌트 소유 파일 아님, 수정 불가) 리듬 스텝퍼에서도 동일 문구가 읽힌다 — 이 앱 맥락상("알" 단위) 뜻은 통하지만 "하루/주" 구간 명시는 없음. 기능 결함은 아니고 컴포넌트 재사용의 알려진 한계.
- CadencePicker의 세그먼트 선택 시 FREE/DAILY_1으로 이동해도 이전 N을 0으로 밀지 않고 보존(`src/components/create/CadencePicker.tsx:41-45`) — 템플릿 권장 N(예: 물마시기 8)이 사용자가 잠깐 다른 옵션을 눌렀다가 돌아와도 유지되도록 한 방어적 설계(스펙에 명시되진 않았으나 스펙의 "기본값" 취지를 사용자 조작 이후에도 지키기 위함).
