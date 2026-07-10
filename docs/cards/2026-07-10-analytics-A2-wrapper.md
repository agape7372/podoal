상태: 완료 (2026-07-10 — 로컬 라이브 검증 그린. 실 키(A1)는 미발급 — 키 없인 전면 no-op라 머지 안전)

## analytics-A2: 계측 래퍼 + 동의 배너 + 설정 철회 UI

- 분류: WS1 계측(ANALYTICS_PLAN §6 A2) / 배정: fable (원계획 sonnet)
- 선행: §4 결정 3건 확정(2026-07-08) + 방침 게시(privacy-publish 카드) + 스키마 `User.analyticsConsentAt DateTime?` additive(단독 커밋, migration `20260710074543_add_analytics_consent`)

### 구현 좌표
- `src/lib/analytics.ts` (신규) — 단일 진입. `ANALYTICS_EVENTS` 20종 상수(§2 19종 + grape_fill_failed)를 타입으로 강제. no-op 게이트 = 서버사이드/키 없음/동의≠granted. posthog-js는 **동의 후 첫 track에서 dynamic import**(미동의 사용자는 네트워크·번들 0). init: EU 호스트(기본 `https://eu.i.posthog.com`), autocapture·pageview·pageleave·세션리플레이 전부 off, `opt_out_capturing_by_default: true`. `setConsent(false)` = opt_out + reset. `markOAuthStart/consumeOAuthPending`(sessionStorage, createdAt 5분 창), `markFirstDone/trackFirst`(유저별 localStorage 플래그, 스토어 주입 가능 — 테스트용)
- `src/app/api/auth/consent/route.ts` (신규) — PATCH, boolean 검증 400 해요체, `analyticsConsentAt = granted ? now : null`
- `src/app/api/auth/me/route.ts` — 응답에 `analyticsConsentAt`·`createdAt` additive
- `src/components/AnalyticsConsentBanner.tsx` (신규) — InstallPrompt 슬롯 상호 배타(`(app)/layout`이 consentPending로 분기, z-30 한 층에 배너 1장 원칙). 확정 문구 + [좋아요]/[안 할래요] + 방침 링크
- `src/app/(app)/settings/page.tsx` — "개인정보 > 익명 사용 통계" Toggle(기존 in-file Toggle 재사용)
- `.env.example`·`docs/PLAYBOOK.md` env 원장 — `NEXT_PUBLIC_POSTHOG_KEY/HOST` 동시 갱신

### 검증 로그 (2026-07-10, fable — 로컬 dev + 더미 키)
- 유닛 6종(`src/lib/__tests__/analytics.test.ts`): 사전 드리프트 가드(20종 정확 일치)·동의값 오염 파싱→unset·shouldTrack 진리표·first 플래그 멱등/격리 — 전체 154 pass
- 라이브: 배너 렌더(InstallPrompt 대체) → 좋아요 → localStorage granted + 서버 analyticsConsentAt 기록 + **posthog-js 청크가 이 시점에야 로드** + eu.i.posthog.com capture 시도 확인 → 설정 토글 off → localStorage denied + 서버 null + 이후 PostHog 서버 요청 0
- 채움 회귀: 새 보드 채움 낙관 UI·서버 커밋 정상(직렬 큐 무접촉 — track은 큐 밖 동기 한 줄)
- lockfile: posthog-js 추가로 @emnapi 삭제 재발 → node:24 컨테이너 재생성으로 순수 추가만 남김([[project-podoal-ci-lockfile]] 절차)
