상태: 완료 (2026-07-11, sonnet 구현 + fable 라이브 검증)

## W2A-C4c-ripe-reminder: "익으면 알림" — 리마인더 대체 옵션 + cron 분기

- 분류: 기능(FILL_CADENCE_PLAN §7, C4-c) / 배정: **sonnet**(cron 판정 반려 시 opus 승격)
- 원칙: **알림 총량 불변**(ADHD 가드레일) — 신규 채널이 아니라 기존 리마인더의 **택1 대체 옵션**. 카테고리는 기존 `'reminder'` 유지(사용자 결정).
- 스키마: `Reminder.type "time"|"ripe"` W0 완료 — 스키마 무접촉.

### 스펙

1. **`src/components/ReminderModal.tsx`**: 상단 세그먼트 "시간 지정 | 익으면 알림" 택1. '익으면' 선택 시 시간 입력 숨김, 보드 select는 **cadence 보드만**(cadenceType≠FREE — FREE는 "익음" 개념 없음). 요일 선택은 유지(발송 판정에 반영). 문구 해요체(예: "포도알이 익으면 알려드려요").
2. **`api/notifications/reminders/route.ts` + `[id]/route.ts`**: `type` 수용 — 화이트리스트('time'|'ripe', 그 외 400). **ripe는 boardId 필수 + 해당 보드 소유 + cadenceType≠FREE** 검증(기존 보드 소유 검증에 추가). 응답에 `type` additive.
3. **리마인더 리스트(notifications 페이지)**: ripe 항목은 시간 대신 "익으면 🍇" 라벨 — 아이콘은 `src/lib/icons.ts` 관례 확인(생이모지 leakage 금지 — `scripts/check-icons.mjs` 가드 통과 필수).
4. **`api/cron/reminders/route.ts` 분기**:
   - `isActive && type='ripe'`만 별도 조회 — 보드 스티커(`filledAt,isBackfill`) + owner(`timezone,dayResetHour`) include. 전 보드 스캔 금지.
   - 판정: `computeFillPace`(**`src/lib/pace.ts` 서버 정본 재사용** — 이중 구현 금지) → `ripe === true` && 보드 미완료·미수확 && days에 오늘 요일(owner tz 기준) && `zonedDateKey(lastSentAt, tz, resetHour) !== 오늘 키` → 발송("포도알이 다 익었어요 🍇" — 아이콘 관례 확인) + `lastSentAt` 갱신.
   - **DND 삼킴 함정(이 카드의 핵심)**: `push.ts`의 DND 판정 함수를 export(이중 구현 금지)해 **DND 창 안이면 발송·lastSentAt 마킹 모두 스킵** → 다음 5분 틱이 자연 재시도. lastSentAt 선마킹 시 그날 알림 영구 유실.
   - 미인식 type은 'time' 취급(fail-open).
5. **재현 스크립트 `scripts/repro/ripe-reminder-cron.mjs`** 자산화(PLAYBOOK §8): cron 판정 로직을 시나리오별로 검증(익음→발송 / dedupe / 채운 뒤 미발송 / DND 스킵+미마킹).

### 금지·제약

- types/index.ts·schema.prisma 수정 금지(선반영 완료). 기존 time 리마인더 경로 회귀 0.
- 기존 cron의 KST 시각 판정(`kstNowParts` 류) 교체 금지 — ripe 분기만 추가.
- transition-all 금지. 모달 닫기는 `useModalClose`의 `requestClose` 경유.

### 검증 (완료 조건)

- tsc·lint·test 그린 + repro 스크립트 4시나리오 통과.
- 라이브(합류 후 fable): ripe 리마인더 생성(FREE 보드 지정 400) → cron curl → 발송 1 → 재발사 dedupe 0 → 오늘 몫 채운 뒤 → 미발송 → DND 창 설정 → 스킵 + lastSentAt 미갱신.

### 구현 로그 (sonnet)

**수정 파일** (소유 파일 목록 내에서만):
- `src/components/ReminderModal.tsx` — 상단 세그먼트 "시간 지정 | 익으면 알림" 추가(`type` state). 익으면 선택 시 시간 입력 숨김 + 보드 select를 cadence 보드(`cadenceType !== 'FREE'`)로 제한 + 안내문구("포도알이 익으면 알려드려요"). cadence 보드가 없으면 "익으면 알림" 버튼 비활성 + 안내. 타입 전환 시 유효하지 않은 boardId는 초기화. 저장 유효성: type='ripe'면 boardId 필수. payload에 `type` 추가.
- `src/app/api/notifications/reminders/route.ts` — POST에 `type` 화이트리스트('time'|'ripe', 그 외 400) + ripe면 boardId 필수 + 보드 소유 검증에 `cadenceType` select 추가해 FREE 보드면 400. GET/POST 응답에 `type` additive.
- `src/app/api/notifications/reminders/[id]/route.ts` — PUT `allowedKeys`에 `type` 추가 + 화이트리스트 검증. 부분 갱신이라 `effectiveType`/`effectiveBoardId`(갱신값 우선, 없으면 기존값)를 합성해 ripe 조합(보드 필수 + cadence 보드)을 재검증(예: type만 ripe로 바꾸고 boardId 안 건드리는 케이스, boardId를 null로 지우면서 type은 그대로 ripe인 케이스 모두 커버). 응답에 `type` additive.
- `src/app/(app)/notifications/page.tsx` — `boards` state에 `cadenceType` 추가해 ReminderModal에 전달(별도 API 호출 없이 기존 `/api/boards` 응답의 필드 재사용). 리마인더 리스트에서 `type==='ripe'`면 시간 대신 "익으면 🍇"(`EmojiIcon`, 관례대로 JSX 속성으로만 사용 — 생이모지 없음) 라벨.
- `src/app/api/cron/reminders/route.ts` — 기존 시간 쿼리에 `type: { not: 'ripe' }` 추가(미인식 타입은 그대로 time 취급 fail-open, 회귀 0). ripe 전용 쿼리(활성 ripe 리마인더에서 출발 — 전 보드 스캔 없음) + 판정 순서: 보드 미존재/완료/수확 스킵 → 오너 tz 기준 오늘 요일 매치 → dedupe(오너 tz 날짜키) → `computeFillPace`(서버 정본 재사용, `pace.ripe===false`면 스킵) → **DND 체크(`push.ts`에서 export한 `inDnd` 재사용) — DND 안이면 발송·`lastSentAt` 마킹 둘 다 스킵**, DND 아니면 발송 후 마킹.
- `src/lib/push.ts` — 기존 `inDnd(start, end)` 함수에 `export` 추가(로직 무변경) + cron ripe 분기가 재사용하는 이유를 설명하는 JSDoc.
- `scripts/repro/ripe-reminder-cron.mjs` (신규) — cron ripe 분기와 동일한 순서로 `computeFillPace`/`zonedDateKey`/`inDnd`를 호출하는 `decideRipeSend()`를 조립해 4시나리오 검증(DB 불필요, 실제 현재 시각 기준으로 결정적 재현).

**DND 스킵 로직 구현 방식**: cron 라우트가 `sendPushToUser` 호출 *전에* `push.ts`에서 export한 `inDnd(dndStart, dndEnd)`로 직접 선판정한다. DND 안이면 `continue`로 넘어가 `sendPushToUser` 호출 자체도, `prisma.reminder.update({ lastSentAt })` 마킹도 실행되지 않는다 — 다음 5분 cron 틱이 같은 리마인더를 재평가(그날 아직 `lastSentAt` 미마킹 상태이므로 dedupe에 안 걸림). `sendPushToUser` 내부에도 동일 DND 게이트가 있지만 그건 조용히 no-op할 뿐이라, 그 결과를 모른 채 마킹부터 했다면(기존 시간 리마인더 루프의 패턴처럼) 그날 알림이 영구 유실됐을 것 — 이게 카드가 지목한 함정이라 별도 사전 판정으로 분리했다.

**검증 결과**:
- `npx tsc --noEmit` — 통과(0 에러).
- `npm run lint` — 0 에러(경고 72건은 전부 미수정 파일의 기존 `react-hooks/set-state-in-effect` warn, 이번 변경과 무관). `check-icons` 통과(🍇는 기존 코드에서 이미 SVG 커버됨, JSX 생이모지 없음).
- `npm test` — 165 tests, 161 pass, 4 skip(Upstash env 미설정 스모크 — 기존), 0 fail.
- `npx tsx scripts/repro/ripe-reminder-cron.mjs` — 11 assertion 전부 PASS: ①익음→발송(send+mark) ②dedupe(오늘 lastSentAt 있으면 스킵, 재마킹 없음) ③채운 뒤 미발송(quota 소진 시 `pace.ripe=false`) ④DND 스킵(실제 현재 KST 분을 감싸는 창을 동적으로 만들어 `inDnd` 실측 후 스킵 확인 + lastSentAt 시뮬레이션이 null로 유지되는지 직접 검증 + 대조군으로 DND 아니었으면 발송됐을 상황임을 교차 확인).

**라이브 검증 포인트(fable 인수용)**:
1. `/notifications`에서 cadence 보드가 있는 계정으로 리마인더 추가 → "익으면 알림" 선택 → cadence 보드만 드롭다운에 뜨는지, FREE 보드는 안 보이는지.
2. `POST /api/notifications/reminders`에 `type: 'ripe'` + FREE 보드 `boardId` → 400 확인.
3. 개발 DB에서 해당 cadence 보드를 오늘 몫 미채움 상태로 두고 `GET /api/cron/reminders`(Bearer CRON_SECRET) curl → 응답 `ripeSent` 증가 + 실제 푸시(구독 있으면) 확인.
4. 같은 요청 재curl → `ripeSent` 그 리마인더분은 0(dedupe).
5. 해당 보드를 오늘 몫 채운 뒤 curl → 미발송.
6. `NotificationSetting.dndStart/dndEnd`를 현재 시각을 감싸도록 설정 후 curl → 미발송 + DB에서 `Reminder.lastSentAt`이 갱신 안 됐는지 직접 확인(가장 중요 — 이게 카드의 핵심 함정 라이브 재현).

### 라이브 검증 (fable, 2026-07-11)

- 생성 검증: FREE 보드+ripe → 400 "채우는 리듬이 설정된 보드만…" ✓ / 미지 type → 400 ✓ / 정상 ripe 201(응답 type 포함) ✓
- cron 4시나리오(로컬 CRON_SECRET): ①미채움 → `ripeSent:1` ✓ ②재발사 dedupe → 0 ✓ ③오늘 몫 채운 보드 → 0 ✓ ④DND(19–23시, 현재 19:29) → 0 + **DB `lastSentAt` NULL 확인** → DND 복원 재발사 → 1 + lastSentAt 마킹 ✓ — 카드 핵심 함정(선마킹 영구유실) 라이브 재현으로 부재 증명
- ReminderModal(Playwright): "시간 지정|익으면 알림" 세그먼트, ripe 선택 시 시간 입력 숨김, 보드 select에 FREE 보드 제외 ✓
- repro `npx tsx scripts/repro/ripe-reminder-cron.mjs`: 11 pass ✓
