상태: 완료 (2026-07-11, fable — migrate dev 적용·drift 0·tsc 그린)

## W0-schema-ripe-recap: 스키마 additive 2필드 — 익으면 알림 + 주간 결산 opt-in

- 분류: 스키마(마이그레이션 단독 웨이브, PRINCIPLES §4) / 배정: **fable 직접**(schema.prisma·types는 핫파일)
- 배경: 잔여작업 스윕(2026-07-11) Wave 0. 두 필드 모두 additive+default라 1회 마이그레이션으로 합침(C1 선례).
- 사용자 결정(2026-07-11): 주간 결산 기본값 = **켜짐**(기존 reminder 편승 수신자 행동 무변화, opt-out 방식).

### 변경 좌표

- `prisma/schema.prisma`
  - `Reminder.type String @default("time")` — `"time"` | `"ripe"`(C4-c). 미인식 값은 cron이 time 취급(fail-open).
  - `NotificationSetting.weeklyRecapEnabled Boolean @default(true)` — 주간 결산 전용 opt-in.
- `prisma/migrations/20260711095449_add_ripe_reminder_and_weekly_recap_optin/` — ALTER TABLE 2건.
- `src/types/index.ts` optional 선반영(후속 카드가 핫파일 무소유하도록): `ReminderInfo.type?`, `NotificationSettingInfo.weeklyRecapEnabled?`, `BoardSummary.strictMode?`, `UserProfile.dayResetHour?`.

### 검증 (2026-07-11)

- `npx prisma migrate dev` 적용 → `migrate status` "up to date"(drift 0) → `npx prisma generate`(v7 수동) 완료.
- `npx tsc --noEmit` 0 — optional 필드라 소비자 없이 통과.
- 기존 행: 두 필드 모두 default 채움(ALTER ... NOT NULL DEFAULT), 응답 계약 불변.

### 후속 소비자

- W1-A(strictMode UI — 스키마 무접촉, 기존 필드), W1-C(weeklyRecapEnabled), W2-A(Reminder.type), W2-B(dayResetHour — 기존 필드).
