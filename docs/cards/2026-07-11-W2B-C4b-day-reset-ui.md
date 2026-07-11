상태: 완료 (2026-07-11, sonnet 구현 + fable 라이브 검증)

## W2B-C4b-day-reset-ui: "하루의 시작" 설정 UI + 클라 판정 배선

- 분류: 기능(FILL_CADENCE_PLAN §9, C4-b) / 배정: **sonnet**
- 서버 소비는 **이미 완성**(`User.dayResetHour` — stats·boards·stickers·fillBoard 전부 owner 경계 사용). 잔여 = 쓰기 경로 + 노출 + 클라 판정 배선.

### 스펙

1. **`src/app/(app)/settings/page.tsx`**: "하루의 시작" 선택(0~6시) — 설정 허브에 섹션 추가(알림 아님 — 스트릭·통계·텀 판정 경계 설정이라 /settings 소속). 문구 해요체(예: "새벽 활동이 많다면, 하루가 시작되는 시각을 늦춰보세요 — 새벽 2시 채움이 어제로 기록돼요"). P14(새벽형)·P22(교대근무) 대응.
2. **`src/app/api/auth/profile/route.ts` PATCH**: `dayResetHour` 수용 — 정수 0~6 검증(-1·7·비정수·문자열 → 400).
3. **`src/app/api/auth/me/route.ts`**: 응답에 `dayResetHour` additive.
4. **`src/lib/cadence.ts`**: `computePaceState`에 `resetHour` 인자 additive(**기본 0 = 회귀 0 계약** — 미전달 호출부 동작 불변). 내부 dayBoundary 호출에 전달.
5. **`src/app/(app)/board/[id]/page.tsx`**: me 응답(또는 스토어의 user)에서 dayResetHour를 computePaceState에 전달 — 클라 탭 허용 판정이 서버 판정과 동일 경계 사용.
6. **단위 검증 스크립트 `scripts/repro/day-reset-pace.mjs`**: resetHour=4일 때 새벽 2시 채움이 전날 귀속(paceState 판정)되는지 등 경계 케이스 검증(실시간 대기 불가하므로 자산화).

### 금지·제약

- types/index.ts 수정 금지(`UserProfile.dayResetHour?` 선반영 완료). 스키마 무접촉.
- **store.ts 무접촉** — 서버 저장 설계(dual-store 회피). Zustand user 객체에 이미 me 응답이 흐르면 그대로 소비.
- 서버 경계 유틸(`dayBoundary.ts`·`pace.ts`) 수정 금지 — 클라 `cadence.ts`만 배선.
- transition-all 금지(settings/page.tsx:31 주석이 모방 정본).

### 검증 (완료 조건)

- tsc·lint·test 그린 + repro 스크립트 통과.
- 라이브(합류 후 fable): 설정 4시 저장 → /api/auth/me 반영 확인. PATCH 경계값 -1/7/2.5/"abc" → 400.

### 구현 로그 (sonnet)

- **cadence.ts**: `computePaceState`에 `resetHour: number = 0` additive 4번째 인자 추가. `DAILY_1`/`DAILY_N`/`WEEKLY_N` 세 분기의 `dayStart`/`nextDayStart`/`weekStart`/`nextWeekStart` 호출에 그대로 전달(dayBoundary.ts는 원래 resetHour 매개변수를 이미 갖고 있어 배선만). 기본값 0 = 미전달 호출부(cadence-check.mjs 등) 회귀 0.
- **board/[id]/page.tsx**: `computePaceState` 호출부에 `user?.dayResetHour ?? 0` 전달(store의 user는 layout이 `/api/auth/me` 응답으로 채움). paceState effect의 deps에 `user?.dayResetHour` 추가(설정 변경 후 재계산 위해).
- **api/auth/me/route.ts**: 응답 `user` 객체에 `dayResetHour: user.dayResetHour` additive.
- **api/auth/profile/route.ts** PATCH: `dayResetHour` 수용 — `typeof === 'number' && Number.isInteger && 0~6` 아니면 400(`-1`/`7`/`2.5`/`"abc"` 전부 이 가드 하나로 걸러짐). 응답 `user`에 `dayResetHour` additive(설정 UI가 저장 확인용).
- **settings/page.tsx**: "하루의 시작" 섹션 신설(표시 섹션과 개인정보 섹션 사이) — 0~6시 7개 필(pill) 버튼(`grid-cols-7`), `CadencePicker.tsx`와 동일한 `aria-pressed` + `ring-2 ring-grape-400 clay-pressed` 선택 표시 관례 재사용. 카드 지정 문구 그대로 사용("새벽 활동이 많다면…"). 클릭 시 낙관 반영(`setUser({...user, dayResetHour})`) → PATCH `/api/auth/profile` → 실패 시 롤백 + `text-rose-700 role="alert"` 에러(profile/page.tsx 관례 재사용). **`setUser(data.user)`로 통째로 덮지 않고 `{...prevUser, dayResetHour: ...}`로 병합** — profile PATCH 응답이 `analyticsConsentAt`/`createdAt`을 포함하지 않는 부분 객체라, 그대로 덮으면 저장할 때마다 store에서 그 필드들이 사라지는 회귀가 생김(store.ts 무접촉 제약이라 settings 쪽에서 병합으로 방어). `transition-all` 미사용(`clay-button`이 기존 transition 처리, 신규 transition 없음).
- **scripts/repro/day-reset-pace.mjs**(신규): computePaceState의 resetHour 경계 6케이스 — ①resetHour=4에서 새벽 2시 채움이 전날 귀속(오늘 몫 여전히 ripe) ②같은 채움이 resetHour=0이면 오늘 몫으로 소진(대비) ③3-인자 호출(resetHour 미전달) = resetHour=0과 동일(회귀 0) ④nextRipeAt이 resetHour 경계(04:00)로 이동 ⑤resetHour 정각(04:00:00.000) 자체는 "오늘" 귀속 ⑥WEEKLY_N도 동일 경계 이동. `npx tsx scripts/repro/day-reset-pace.mjs` → 14 passed, 0 failed.

**검증 결과**: `npx tsc --noEmit` 클린. `npm run lint` 0 errors(72 warnings — 전부 기존 `react-hooks/set-state-in-effect`류, 내 변경분 아님·CLAUDE.md상 warn 허용). `npm test` 165 tests(161 pass, 4 skip, 0 fail). `day-reset-pace.mjs` 14/14 PASS.

**참고(내 스코프 밖, 별도 확인 필요)**: 기존 `scripts/repro/cadence-check.mjs`가 내 변경과 무관하게 이미 깨져 있음(TypeError at effectiveMs) — `git stash`로 `cadence.ts`만 격리해 재현, 원인은 C3 보충채우기 커밋(`7bb92a7`)이 `PaceFill`을 `{filledAt, isBackfill}` 객체로 바꿨는데 그 스크립트는 여전히 raw `Date[]`를 넘김(C1 시절 작성, 갱신 안 됨). 내 카드 소유 파일이 아니라 손대지 않았음 — 팀장 판단으로 별도 정리 필요.
- 라이브 검증 포인트(상위 모델): 설정 페이지에서 4시 선택 → `/api/auth/me` 응답에 `dayResetHour: 4` 반영 확인. curl로 PATCH 경계값(`-1`, `7`, `2.5`, `"abc"`) → 400 확인. 보드 상세에서 익는 중 알 판정이 새 resetHour를 반영하는지(자정 대신 설정 시각 기준으로 색 전이/탭 가드).

### 라이브 검증 (fable, 2026-07-11)

- PATCH: `dayResetHour:4` → 응답·`/api/auth/me` 4 반영 ✓ / 경계값 -1·7·2.5·"abc" → 전부 400 ✓ / 0 복원 200 ✓
- 설정 UI(Playwright): "하루의 시작" 섹션 노출, 4시 클릭 → me 반영 → 0시 복원 ✓
- repro `npx tsx scripts/repro/day-reset-pace.mjs`: 14 pass ✓ (resetHour=4 새벽 2시 채움 전날 귀속 포함)
- 스코프 밖 발견(sonnet): `scripts/repro/cadence-check.mjs` 기존 파손(C3의 PaceFill 객체화 미반영) — W3에서 수선.
