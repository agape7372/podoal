상태: 완료 (2026-07-13 — 게이트 7항 + 라이브: 오인증 401 계약 확인(.env.local 시크릿 존재 환경). timingSafeEqual은 sha256 고정길이 해시 후 비교(길이 비노출). 배치·쿼리 dedupe 의미 불변 코드 리뷰 완료)

## BE-2: cron 경화 — timingSafeEqual·푸시 배치·쿼리측 dedupe (B2·B6·B9)

- Severity: Med(신뢰성·보안) / 분류: 백엔드 / 배정: opus
- 필독: PLAYBOOK §4 cron 운영(503/401 계약·GitHub Actions 호출), CLAUDE.md dayBoundary 절, REVIEW_CHECKLIST 게이트 4

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/api/cron/reminders/route.ts`
- `src/app/api/cron/daily-nudge/route.ts`
- `src/app/api/cron/weekly-recap/route.ts`
- `src/lib/cronAuth.ts` (신규)

### 문제/재현
1. **B2**: 3개 cron 라우트가 `authHeader !== \`Bearer ${secret}\``로 비상수시간 비교 (reminders:43 · daily-nudge:19 · weekly-recap:21) — 타이밍 사이드채널.
2. **B6**: 푸시 발송이 순차 `for … await sendPushToUser` (reminders:61-77 · daily-nudge:46-70 · weekly-recap:47-60) — 각 호출이 자체 DB 쿼리 2회. 대상 증가 시 서버리스 타임아웃 위험. (`sendPushToUser`는 내부 try/catch로 절대 throw 안 함 — push.ts:100-127 — 배치화 안전.)
3. **B9**: reminders:55의 `findMany`가 당일 발송분까지 전부 로드 후 `lastSentAt` dedupe를 JS에서 수행(:62-64) — W2의 `@@index([isActive, time])` 인덱스를 활용해 쿼리측 이관 가능.

### 스펙 (시험 가능한 문장)
- B2: `src/lib/cronAuth.ts` 신설 — `verifyCronAuth(request): boolean`이 `crypto.timingSafeEqual` 사용(**양측을 해시 후 비교하거나 길이 가드** — timingSafeEqual은 길이 불일치 시 throw). 3개 라우트가 이것 경유. **미설정 503 / 불일치 401 응답 계약 불변** (GitHub Actions 호출자 계약).
- B6: 발송 루프를 청크(예: 10) 단위 `Promise.allSettled` 배치로. 개별 실패 격리 의미 불변(현행 try/catch와 동등). 발송 후 `lastSentAt`/`lastNudgeSentAt` 마킹 로직의 순서·의미 불변.
- B9: reminders 쿼리 where에 `OR: [{lastSentAt: null}, {lastSentAt: {lt: <KST 당일 경계>}}]` 추가 — JS측 당일 dedupe 제거. **요일(dow CSV) 필터는 JS 잔류가 정당**(스키마가 CSV 문자열). DND 사전판정·ripe 분기(:83)·weeklyRecapEnabled 필터 의미 불변.

### 제약
- 응답 JSON 형태(sent 카운트 등) 불변.
- `src/lib/push.ts` 접근 금지 (소유 밖).
- KST 경계 계산은 기존 코드의 방식 재사용 — 신규 시간대 로직 발명 금지.

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test
# 수동(dev 서버):
# curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders  → 200
# curl -H "Authorization: Bearer wrong" …  → 401 / 시크릿 미설정 → 503
```

### 보고 전 자가검증
각 주장을 이 세션의 도구 결과와 대조 — 증거를 가리킬 수 있는 작업만 보고. 검증 안 된 것은 "미검증" 명시. 테스트 실패는 출력과 함께.

### 산출
diff + 검증 로그. **커밋 금지** (git add도 금지 — 페이블이 수행).
