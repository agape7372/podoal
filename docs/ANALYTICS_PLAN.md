# podoal 계측 설계 — WS1 측정·실험 인프라 (ANALYTICS_PLAN)

> 상태: **설계(구현 전)** — WS1(PRODUCT_PLAN §4)의 실행 정본. 코드 0줄.
> 게이트: **개인정보 동의 선결**(아래 §4 — 사용자 결정 3건 전까지 배선 착수 금지).
> 근거: 계측 0건(리뷰 ABS-06) × P3 R1 완료 정의("리텐션 반응 측정") 모순 — KPI 전 행이 WS1 이후(PRODUCT_PLAN §5).

## 1. 도구 선정 (권고: PostHog Cloud EU)

| 축 | PostHog Cloud (EU) | PostHog self-host | GA4 |
|----|--------------------|-------------------|-----|
| 비용 | 무료 1M events/월 — 현 규모 여유 | 서버비 + 운영 인력 | 무료 |
| 개인정보 | 국외 이전 **고지 필요**(EU 리전) | 국내 보관 가능 | 국외 이전 + 구글 결합 |
| 운영 부담 | 0 | 1인 운영에 정면 충돌(PRODUCT_PLAN §7 리스크) | 0 |
| 기능 적합 | 퍼널·리텐션·플래그·세션 리플레이(끔) | 동일 | 퍼널 빈약, 이벤트 스키마 경직 |

**권고**: PostHog Cloud EU + 최소 수집(§3 원칙). self-host는 운영 대역폭 리스크로 반대. GA4는 퍼널·리텐션 분석력 미달.

## 2. 이벤트 사전 (v1 — 18개, 좁게 시작)

> 공통 원칙: 속성에 **PII 금지**(이메일·이름·메시지 content류 절대 금지). id는 내부 cuid만. 시각은 SDK 기본.

| 영역 | 이벤트 | 핵심 속성 |
|------|--------|----------|
| 획득 | `install_banner_shown` / `install_banner_accepted` | mode(prompt/ios) |
| 인증 | `signup_completed` / `login_completed` | method(email/google/kakao/naver/guest) |
| 활성화 | `first_board_created` | templateId, size, cadenceType |
| 활성화 | `first_fill` | (가입→첫 알 TTV의 종점) |
| 코어 | `board_created` | templateId, size, cadenceType, cadenceN |
| 코어 | `grape_filled` | boardId, position, earlyFill, cadenceType |
| 코어 | `board_completed` / `board_harvested` | boardId, totalStickers |
| 보상 | `reward_unlocked` / `reward_revealed` | type, isMid |
| 소셜 | `friend_accepted` / `cheer_sent` / `gift_sent` / `relay_started` | (관계 이벤트 — 소셜 KPI) |
| 알림 | `push_subscribed` | — |
| 텀(§11 연동) | `cadence_selected` | type, n (FILL_CADENCE §11) |
| 텀 | `fill_early_override` | boardId (오버라이드율 — 텀 적정성 역지표) |

- C3 도입 시 `fill_backfill` 추가. 스킨(P3 R1) 시 `skin_applied` 추가 — **v1에 선반영하지 않는다**(좁게 시작, 스키마 재작업 비용 절감).

## 3. 퍼널·지표 매핑 (PRODUCT_PLAN §5 KPI와 1:1)

1. **획득→활성화**: install_banner_shown → signup_completed → first_board_created → first_fill (24h 도달률 60% 가설)
2. **리텐션**: grape_filled 기반 D7/D30 + **텀 준수군 vs 자유군 D30 비교**(노스스타 선행 지표 가설)
3. **소셜**: signup 14일 내 friend_accepted ≥1 (30% 가설)
4. **품질**: grape_filled 실패율(<1%) — 클라 롤백 발생 시 `grape_fill_failed` 이벤트로 측정(사전 외 유일한 에러 이벤트)

## 4. 동의·개인정보 설계 (사용자 결정 필요 — 배선 전 선결)

- **방식(권고)**: 최초 실행 1회 동의 배너 — "서비스 개선을 위해 익명 사용 통계를 수집해요" + [좋아요]/[안 할래요]. 거절·미응답 = **no-op**(수집 0). 설정에서 언제든 철회.
- **저장**: 동의 상태는 localStorage + User 테이블 additive 필드(`analyticsConsentAt DateTime?`) — 기기 간 일관성. 스키마 변경은 §4 단독 웨이브 규칙.
- **사용자 결정 3건 — ✅ 전부 확정(2026-07-08)**:
  1. 리전: **PostHog Cloud EU 확정** — 개인정보처리방침에 국외 이전(EU) 고지 포함.
  2. 개인정보처리방침: `docs/PRIVACY_POLICY_DRAFT.md` — **게시 완료(2026-07-10 승인·시행)**, 앱 내 `/settings/privacy`.
  3. 동의 UX 문구: 권고안 그대로 확정 — "서비스 개선을 위해 익명 사용 통계를 수집해요" + [좋아요]/[안 할래요].
- 잔여 게이트: A1(PostHog 계정·키 발급 — 사용자) + 방침 초안 최종 승인 → 이후 A2 배선 가능.

## 5. 기술 노트 (podoal 특이사항)

- **SW 간섭**(PRODUCT_PLAN WS1 항목): `public/sw.js` fetch 핸들러가 same-origin 외 요청을 그대로 통과시키는지 확인 — PostHog는 외부 도메인이라 원칙적으로 무간섭이어야 하나, 배선 카드에서 오프라인 큐(posthog-js 기본 재시도)와 SW의 상호작용을 검증 로그로 남길 것. 캐싱 변경 없으면 CACHE_VERSION 불변.
- **래퍼 단일화**: `src/lib/analytics.ts` 단일 진입(가칭 `track(event, props)`) — 키 없음/동의 없음/서버사이드 = no-op. 컴포넌트가 posthog-js를 직접 import 금지(교체 가능성 보존).
- **이벤트 이름은 위 사전이 정본** — 배선 카드가 임의 추가 금지(추가는 이 문서 개정으로만).

## 6. 롤아웃 슬라이스 (카드 후보)

| 단계 | 내용 | 선행 | 배정 |
|------|------|------|------|
| A1 | PostHog 계정·프로젝트 키 발급 + Vercel env(`NEXT_PUBLIC_POSTHOG_KEY/HOST`) | §4 결정 3건 | **사용자** |
| A2 | 동의 배너·설정 철회 UI + analytics.ts 래퍼(no-op 게이트) | A1 | sonnet |
| A3 | §2 사전 18개 배선 + SW 간섭 검증 | A2 | sonnet 2카드(코어/소셜 분할) |
| A4 | PostHog 대시보드 4퍼널 구성 + KPI 초기값 기록 | A3 + 2주 데이터 | fable |
