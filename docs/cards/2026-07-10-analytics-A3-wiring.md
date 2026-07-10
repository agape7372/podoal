상태: 완료 (2026-07-10 — tsc·lint·154 테스트 그린. 이벤트 실수신 확인은 A1 키 발급 후 PostHog Live에서)

## analytics-A3: 이벤트 사전 배선 (코어/소셜 2커밋)

- 분류: WS1 계측(ANALYTICS_PLAN §6 A3) / 배정: fable (원계획 sonnet 2카드)
- 원칙: **모든 호출부는 동기 fire-and-forget `track()` 한 줄** — board/[id] 직렬 큐(`fillQueues`/`applyFillResult`/`isJustFilled`) 구조 무접촉. 이벤트 이름은 §2 사전이 정본(래퍼의 union 타입 + 드리프트 가드 테스트가 이중 강제)

### 이벤트 → 호출부
| 이벤트 | 좌표 |
|---|---|
| install_banner_shown/accepted | `InstallPrompt.tsx` — shown은 마운트당 1회 ref 가드, iOS는 "방법 보기"=수락 대용 |
| signup/login_completed (email) | `src/app/page.tsx` 가입/로그인 성공 분기 |
| signup/login_completed (OAuth/guest) | 웰컴 앵커 onClick `markOAuthStart` → `(app)/layout.tsx` fetchUser 후 `consumeOAuthPending`(createdAt 5분 이내=가입) |
| first_board_created / first_fill | `trackFirst` — 기존 유저는 `home/page.tsx` 보드 로드 시 `markFirstDone` 비관적 시딩(미발화) |
| board_created / cadence_selected / gift_sent(생성 선물) | `board/create/page.tsx` |
| grape_filled | `board/[id]/page.tsx` handleFillSticker — 낙관 삽입 직후, 큐 밖. earlyFill은 earlyPositionsRef로 판정 |
| grape_fill_failed | postFillSticker catch 비-409(409=사실상 성공이라 제외) |
| board_completed / reward_unlocked | postFillSticker 응답(isCompleted / unlockedReward) |
| reward_revealed | openReward — `!revealedAt` 첫 열람만 |
| fill_early_override | handleRipeningOverride(RipeningSheet "그래도 채우기") |
| board_harvested | `home/page.tsx` harvestBoard — 수확 true만(되돌리기 제외) |
| push_subscribed | `src/lib/usePush.ts` subscribe POST 성공 |
| friend_accepted | `friends/page.tsx` handleAccept |
| cheer_sent | `CheerModal.tsx` onSend 성공(내용·이모지 미계측 — PII 원칙) |
| gift_sent(상세) | `board/[id]/page.tsx` handleGift |
| relay_started | `relay/create/page.tsx` 생성 성공 |

### SW 간섭 검증 (§5 — 코드 무변경, CACHE_VERSION 불변)
- `public/sw.js`: ①비-GET 조기 리턴(line 39) — PostHog capture POST 무간섭 ②cross-origin GET은 cache-first 화이트리스트의 `url.origin === self.location.origin` 조건 불일치 → respondWith 없음 = 브라우저 기본 fetch
- 라이브 확인: 동의 후 `eu-assets.i.posthog.com/array/.../config.js`·`eu.i.posthog.com/e/` 요청이 SW 개입 없이 발사됨(로컬 dev)

### 잔여
- A1(PostHog EU 키 — 사용자) 후 PostHog Live에서 이벤트 실수신 확인 → A4(퍼널 4종 + KPI 초기값)는 A3 + 2주 데이터 후
