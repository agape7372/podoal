상태: 완료 (2026-07-11, sonnet 구현 + fable 라이브 검증)

## W1A-C4a-strict-ui: 엄격 모드 토글 UI + boards API additive

- 분류: 기능(FILL_CADENCE_PLAN §3, C4-a) / 배정: **sonnet**
- 서버 판정은 **이미 완성**: `src/lib/fillBoard.ts:129` — `!pace.ripe && strictMode`면 `StrictPaceError`, `stickers/route.ts`가 422 매핑. 이 카드는 토글 UI + API 수용/노출만.

### 스펙

1. **CadencePicker(`src/components/create/CadencePicker.tsx`)**: `cadenceType !== 'FREE'`일 때만 보이는 "엄격 모드" 서브 토글(기본 OFF). 설명 문구(해요체, 신규 표면 신규 카피 허용): 켬 = "익기 전엔 채울 수 없어요", 끔 = 현행 소프트 가드. props additive(`strictMode`, `onStrictModeChange`) — 기존 호출부 계약 불변.
2. **생성 페이지(`src/app/(app)/board/create/page.tsx`)**: strictMode 상태 + POST body 포함. **gift/FREE 시 false 강제**(기존 이중 방어 패턴 모방 — cadence 관련 기존 강제 로직 위치 참조). 릴레이·선물 보드는 FREE 고정이라 자동 배제.
3. **`src/app/api/boards/route.ts` POST**: `strictMode` 수용 — boolean 검증(기존 검증 헬퍼 스타일), cadenceType FREE면 무시(false 저장). 목록 GET 응답에 `strictMode` additive.
4. **`src/app/api/boards/[id]/route.ts` GET**: 상세 응답에 `strictMode` additive.
5. **`src/app/(app)/board/[id]/page.tsx`**: board 응답의 strictMode를 RipeningSheet에 전달.
6. **`src/components/RipeningSheet.tsx`**: `strictMode` prop(additive, 기본 false). true면 "그래도 채우기" 오버라이드 버튼 **제거** + 대기 안내 문구(예: "엄격 모드예요 — 익을 때까지 기다려요"). **"어제 몫 채우기"(backfill) 버튼은 strict에서도 유지**(서버가 backfill엔 strict 검사 스킵 — fillBoard.ts "보충은 관대 장치").

### 금지·제약 (CLAUDE.md/PRINCIPLES)

- 낙관 채움 파이프라인 무접촉: `mergeServerBoard`/`applyFillResult`/600ms `isJustFilled`/직렬 큐 절대 건드리지 않기.
- `transition-all` 신규 반입 금지 — 변하는 속성만 명시.
- types/index.ts 수정 금지(`BoardSummary.strictMode?` W0 선반영 완료 — 그대로 소비).
- 스키마 무접촉(strictMode는 C1 기존 필드).
- 응답 필드 제거·개명 금지 — additive만.

### 검증 (완료 조건)

- `npx tsc --noEmit` 0, `npm run lint` 0 에러, `npm test` 전건 pass.
- 라이브(dev): 엄격 DAILY_1 보드 생성 → 오늘 몫 채움 → 다음 알 탭 → 시트에 "그래도 채우기" 부재·대기 문구 확인. 회귀: 소프트 보드 오버라이드 정상, FREE 보드 채움 무변화.
- curl로 stickers POST 강제 → 422 + 한국어 문구(서버 방어선 확인).
- 검증 로그를 이 카드에 추기.

### 구현 로그 (sonnet)

**변경 파일**

1. `src/components/create/CadencePicker.tsx` — `strictMode?`/`onStrictModeChange?` props를 additive(둘 다 optional)로 추가. `cadenceType !== 'FREE'`이고 `onStrictModeChange`가 전달된 경우에만 서브 토글을 렌더(생략 시 기존 호출부와 동일하게 무렌더). 토글은 보드 상세의 "친구가 깜짝 선물 심기" 스위치와 동일한 pill 패턴(`w-11 h-6` + `translate-x-5`)을 그대로 모방 — `transition-colors`/`transition-transform`만 사용해 신규 `transition-all` 반입 없음. 아이콘은 `src/lib/icons.ts`의 `ICON.lock`(`EmojiIcon`)을 재사용(신규 이모지 배열 아님 — check-icons 영향 없음). 설명 문구는 카드 스펙 그대로 "익기 전엔 채울 수 없어요"(ON) / "현행 소프트 가드 — 그래도 채울 수 있어요"(OFF).
2. `src/app/(app)/board/create/page.tsx` — `strictMode` state 추가(기본 `false`). 템플릿 선택(`handleSelectTemplate`)·건너뛰기(`handleSkipTemplate`) 양쪽에서 `cadenceType`/`cadenceN`과 함께 `false`로 리셋. `handleCreate`에서 기존 `effectiveCadenceType`(giftTo→FREE 강제) 바로 아래에 `effectiveStrictMode = !giftTo && effectiveCadenceType !== 'FREE' ? strictMode : false`를 추가해 동일한 이중 방어 패턴을 모방, POST body에 `strictMode: effectiveStrictMode`로 실어 보냄. CadencePicker 호출부(`!giftTo` 블록)에 `strictMode`/`onStrictModeChange={setStrictMode}` 연결 — 별도 `feedbackTap()` 호출은 추가하지 않음(CadencePicker 토글 버튼 내부에서 이미 처리해 중복 피드백 방지).
3. `src/app/api/boards/route.ts` — POST: body에서 `strictMode` 구조분해, `strictMode !== undefined && typeof !== 'boolean'`이면 400(`엄격 모드 값이 올바르지 않아요.`). `resolvedStrictMode = resolvedCadenceType !== 'FREE' && strictMode === true`로 FREE는 항상 false 강제. `tx.board.create` data에 `strictMode: resolvedStrictMode` 추가, 응답 `result`에도 additive로 포함. GET(목록): 각 board 매핑에 `strictMode: board.strictMode` additive 추가(스키마 기본값 `false`라 항상 존재).
4. `src/app/api/boards/[id]/route.ts` — GET 상세 응답 `result`에 `strictMode: board.strictMode` additive 추가(cadenceType/cadenceN 옆).
5. `src/app/(app)/board/[id]/page.tsx` — RipeningSheet 호출부(1346행 부근)에 `strictMode={board.strictMode}` prop 연결 한 줄만 추가. 낙관 채움 파이프라인·큐·`handleRipeningOverride`/`handleRipeningBackfill` 등은 무접촉.
6. `src/components/RipeningSheet.tsx` — `strictMode?: boolean` prop 추가(additive, 기본 미지정=falsy). true면 하단의 "그래도 채우기" 텍스트 링크 대신 `"엄격 모드예요 — 익을 때까지 기다려요"` 안내 문구를 렌더. "어제 몫 채우기"(backfillAvailable/onBackfill) 블록은 조건 분기 밖이라 strictMode 여부와 무관하게 그대로 유지(서버가 backfill엔 strict 검사를 스킵하는 것과 UI가 일치). "기다릴게요" 주 버튼도 무변경.

**타입/스키마**: `types/index.ts`의 `BoardSummary.strictMode?`는 이미 선반영되어 있어 무수정(확인만 함). `prisma/schema.prisma`도 무접촉(카드 명시대로 C1 기존 필드 그대로 소비).

**검증 결과**

- `npx tsc --noEmit` → 에러 0.
- `npm run lint` → 에러 0(warning 72건은 전부 이번 변경과 무관한 기존 파일의 `react-hooks/set-state-in-effect` warn, `check-icons`도 통과 — "모든 이모지가 플랫 SVG로 커버됨 · JSX 생이모지 없음 · 선택지 배열 커버됨").
- `npm test` → 165 tests, 161 pass, 0 fail, 4 skipped(기존 UPSTASH env 미설정 스모크 3~4건, 이번 변경과 무관). strictMode 관련 별도 유닛테스트는 이번 카드 스펙에 없어 추가하지 않음(순수 UI+additive 배선이라 fillBoard.ts의 기존 `StrictPaceError` 테스트 커버리지에 이미 의존).

**라이브 검증(dev) 시 상위 모델이 확인할 포인트** — 카드 스펙 그대로, 아직 미실행:

1. 엄격 DAILY_1 보드 생성(생성 스텝2에서 "하루 한 알" 선택 → 엄격 모드 토글 ON 확인 후 생성) → 오늘 몫 채움 → 다음 알 탭 → RipeningSheet에 "그래도 채우기" 링크가 없고 "엄격 모드예요 — 익을 때까지 기다려요" 문구가 보이는지.
2. 회귀: 같은 시나리오를 엄격 모드 OFF(소프트)로 하면 기존처럼 "그래도 채우기"가 보이고 정상 오버라이드되는지.
3. FREE 보드는 CadencePicker에 엄격 모드 서브 토글 자체가 안 보이는지(cadenceType==='FREE' 조건).
4. giftTo(선물 생성) 플로우는 CadencePicker 자체가 안 보이므로 strictMode가 무조건 false로 저장되는지(서버 응답 확인 or DB 확인).
5. curl로 엄격 보드에 `POST /api/boards/{id}/stickers`를 익지 않은 상태로 강제 호출 → 422 + `아직 익는 중이에요. 다 익으면 채울 수 있어요.` 확인(이 경로 자체는 서버가 이미 완성돼 있던 부분이라 회귀만 재확인하면 됨).
6. "어제 몫 채우기" 회귀: 엄격 보드에서 backfillAvailable 조건을 만들어(어제 미채움 상태) RipeningSheet를 열었을 때 "어제 몫 채우기" 버튼이 strict 문구와 함께 정상 노출·동작하는지.

### 라이브 검증 (fable, 2026-07-11)

- 엄격 DAILY_1 보드 생성 → 응답 `strictMode: true` ✓ → 오늘 몫 채움 201 → 미숙성 강제 POST → **422 "아직 익는 중이에요. 다 익으면 채울 수 있어요."** ✓
- RipeningSheet(Playwright): 엄격 보드 — "그래도 채우기" **부재**, "엄격 모드예요 — 익을 때까지 기다려요" 문구 ✓ / 소프트 보드 — "그래도 채우기" 정상 노출·earlyFill 201 ✓
- 생성 플로: FREE에서 토글 미노출 → 하루 한 알 선택 시 노출 → 켬(aria-checked true, "익기 전엔 채울 수 없어요") → FREE 복귀 시 숨김 ✓
- 경계: `strictMode:"yes"` → 400 "엄격 모드 값이 올바르지 않아요." ✓ / FREE+`strictMode:true` → `FREE, false` 저장 ✓
- 문구 수정 1건(fable): 토글 OFF 설명 "현행 소프트 가드 — …" → "익기 전에도 원하면 채울 수 있어요"(사용자 대면 문구 시스템어 금지).
