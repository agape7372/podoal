상태: 완료 (2026-07-11, sonnet 구현 + fable 라이브 검증)

## W1C-weekly-recap-optin: 주간 결산 푸시 전용 opt-in 토글

- 분류: 기능(ROADMAP 백로그 "주간 리포트 푸시") / 배정: **sonnet**
- 현황: `api/cron/weekly-recap/route.ts`가 category `'reminder'` 편승 — 7일 활동자 전원 발송. 전용 필드로 분리.
- 사용자 결정: 기본 **켜짐**(`weeklyRecapEnabled @default(true)` — W0 마이그레이션 완료, Prisma client 생성됨).

### 스펙

1. **`src/lib/push.ts`**: PushCategory에 `'weeklyRecap'` 추가 + `categoryAllowed` 분기(`weeklyRecapEnabled` 검사). 기존 카테고리 로직 무변경.
2. **`src/app/api/cron/weekly-recap/route.ts`**: 후보 산출 시 `weeklyRecapEnabled: false` 사용자 제외 — daily-nudge cron의 배치 필터 패턴(`notificationSetting` 조회) 모방. 발송 category를 `'weeklyRecap'`으로 교체. 응답 카운트(candidates/sent)는 유지·정합.
3. **`src/app/api/notifications/settings/route.ts`**: boolKeys/기본값/응답에 `weeklyRecapEnabled` 추가(기존 dailyNudgeEnabled 패턴 모방).
4. **`src/app/(app)/notifications/page.tsx`**: "주간 결산" 토글 섹션 — 데일리 넛지 섹션 마크업 모방. 문구 해요체(예: "일요일 저녁, 이번 주 포도 농사 결산을 보내드려요"). 사용자 대면 문구에 시스템 용어 금지.

### 금지·제약

- `transition-all` 신규 반입 금지 — 기존 레거시 토글에 있어도 복붙 금지(변하는 속성만 명시).
- types/index.ts 수정 금지(`weeklyRecapEnabled?` W0 선반영 완료).
- 스키마 무접촉(W0 완료). 기존 설정 키 제거·개명 금지.
- NotificationSetting 없는 사용자(row 미생성) 처리: 기존 라우트의 기본값 관례 따름 — 기본 켜짐이므로 row 없음 = 수신.

### 검증 (완료 조건)

- `npx tsc --noEmit` 0, `npm run lint` 0 에러, `npm test` pass.
- 라이브(dev): 토글 off 저장 → cron curl(`Authorization: Bearer $CRON_SECRET`) → sent에서 제외 확인 → on → 포함 확인(게이팅 증명 = cron 응답 카운트; 로컬 VAPID 없으면 push는 no-op이라 카운트로 증명).
- 설정 GET/PUT 왕복에 weeklyRecapEnabled 반영 확인.
- 검증 로그를 이 카드에 추기.

### 구현 로그 (sonnet)

- **`src/lib/push.ts`**: `PushCategory`에 `'weeklyRecap'` 추가. `ToggleSetting`에 `weeklyRecapEnabled: boolean` 필드 추가. `categoryAllowed`에 `case 'weeklyRecap': return setting.weeklyRecapEnabled;` 분기 추가(기존 카테고리 로직 무변경, `setting === null`이면 기존처럼 all-on 유지 — 기본 켜짐과 정합).
- **`src/app/api/cron/weekly-recap/route.ts`**: 발송 category를 `'reminder'` → `'weeklyRecap'`으로 교체. 후보(`weekly` groupBy 결과) 중 `NotificationSetting.weeklyRecapEnabled: false`인 사용자만 배치 조회해 `Set`으로 만들고 발송 루프에서 스킵. 응답에 `optedOut` 카운트 추가(candidates/sent 유지).
  - **게이팅 방식 = 쿼리 필터(후보 산출 단계), 발송 시 검사 아님.** 이유: `sendPushToUser`는 fire-and-forget이라 내부에서 `categoryAllowed`로 걸러도 반환값이 없어 호출부의 `sent++`가 실제 발송 여부를 반영하지 못한다(현재도 다른 카테고리들이 이 구조). 카드의 라이브 검증이 "cron 응답 카운트로 게이팅 증명"을 요구하므로, `sent` 카운트가 실제로 걸러진 결과를 반영하려면 후보 단계에서 사전 필터링이 필수. `push.ts`의 `categoryAllowed` 분기는 방어적 이중 게이트로 유지(다른 발신 경로 재사용 대비).
  - daily-nudge와 필터 방향이 반대: daily-nudge는 opt-in(기본 꺼짐)이라 `dailyNudgeEnabled: true`인 행만 포함. weekly-recap은 opt-out(기본 켜짐)이라 `weeklyRecapEnabled: false`인 행만 배제(행이 없는 사용자는 자동 포함).
- **`src/app/api/notifications/settings/route.ts`**: `defaultSettings`에 `weeklyRecapEnabled: true` 추가. `boolKeys`에 추가. GET/PUT 응답 객체 양쪽에 `weeklyRecapEnabled: settings.weeklyRecapEnabled` 추가.
- **`src/app/(app)/notifications/page.tsx`**: 데일리 넛지 섹션 바로 다음, 리마인더 섹션 앞에 "주간 결산" 섹션 추가(동일 마크업 패턴 — `clay p-5 mb-4`, `EmojiIcon` + 라벨/설명 + `Toggle`). 문구: "일요일 저녁 포도 농사 결산" / "이번 주 채운 포도알을 정리해서 알려드려요"(해요체, 시스템 용어 없음). `enabled={settings.weeklyRecapEnabled !== false}`로 하위호환(필드 없으면 켜짐 취급, types/index.ts의 주석과 정합). 기존 `Toggle` 컴포넌트 재사용 — `transition-all` 신규 반입 없음.

### 검증 로그 (sonnet)

- `npx tsc --noEmit` → 0 에러.
- `npm run lint` → 0 에러(72 warning, 전부 본 작업과 무관한 기존 `react-hooks/set-state-in-effect` 경고 + icon-check 통과).
- `npm test` → tests 165, pass 161, fail 0, skipped 4(기존 skip, 무관).
- 라이브 검증(dev 서버 curl/토글 왕복)은 카드 규약상 미수행 — 상위 모델 수행 대기.

### 라이브 검증 (fable, 2026-07-11)

- 설정 GET: `weeklyRecapEnabled: true` 기본 반영 ✓ / PUT false → 응답 false 왕복 ✓
- cron 게이팅(로컬 CRON_SECRET 주입): 토글 off → `{"candidates":8,"optedOut":1,"sent":7}` / 토글 on → `{"candidates":8,"optedOut":0,"sent":8}` — **후보 필터가 sent 카운트에 반영됨을 응답으로 증명** ✓
- 참고: 로컬 검증용 `CRON_SECRET`을 `.env.local`에 추가(dev 전용, gitignore 대상).
