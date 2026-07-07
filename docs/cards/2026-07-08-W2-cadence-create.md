상태: 대기

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
