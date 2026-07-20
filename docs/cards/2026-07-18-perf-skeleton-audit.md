상태: 완료 (2026-07-18 — 게이트 7항 통과. 멀티에이전트 감사(3방향 스캔 + 청구별 적대 검증)에서 확정된 원인만 수정. 서버 라우트 변경은 전부 응답 계약 불변 재구성 — §3 게이트의 재현 근거는 본 카드 '문제/재현'의 file:line)

## PERF-SKEL: 앱 전역 로딩 스켈레톤 장시간 노출 — 원인 감사 + 일괄 완화

- Severity: High(사용자 직접 체감 — "실행할 때마다 전 페이지 스켈레톤") / 분류: 성능 / 배정: fable(메인 루프)
- 필독: PRINCIPLES §3(데이터 레이어 게이트)·§6(SW 캐시), PLAYBOOK 버그 클래스 3(SW stale), REVIEW_CHECKLIST 게이트 7, LEAD-REVIEW-2026-07-14 §상태관리(cachedApi 확장 우선, TanStack 유예)

### 소유 파일
- `src/lib/cachedApi.ts` · `src/lib/store.ts` · `src/lib/api.ts`
- `src/app/(app)/layout.tsx` · `src/app/page.tsx` · `src/app/(app)/profile/page.tsx`
- `src/components/UnreadSync.tsx` · `src/lib/useSSE.ts` · `src/lib/useReminderScheduler.ts`
- `src/app/(app)/notifications/inbox/page.tsx` · `src/app/(app)/relay/create/page.tsx`
- `src/app/api/vine/route.ts` · `src/app/api/stats/route.ts` · `src/app/api/friends/route.ts` · `src/app/api/auth/me/route.ts`
- `src/lib/prisma.ts` · `.env.example` · `public/sw.js`

### 문제/재현 (검증 verdict 포함 — 전부 코드 file:line으로 적대 검증됨)
1. **[HIGH·CONFIRMED] 실행마다 전 페이지 스켈레톤 보장** — cachedApi의 SWR 캐시가 메모리 Map뿐(구 cachedApi.ts:11 "의도적으로 persist 안 함"), store는 설정만 영속 → PWA 재실행/탭 복귀 시 캐시 전멸, 코드 자체 측정 웜 0.2~0.5s·콜드 2s+(cachedApi.ts:7)를 매 실행 재지불. 스켈레톤 게이트 `data===undefined && !fetched`(cachedApi.ts:131)가 10개 페이지 공통.
2. **[HIGH·CONFIRMED] DB 연결 churn** — prisma.ts가 pg 기본값(idle 10s 폐기·keepAlive off) 방치 → 10초 유휴 후 요청마다 TCP+TLS+SCRAM 재핸드셰이크. `.env.example` 템플릿 호스트에 `-pooler` 누락(직결 엔드포인트 유도). Neon autosuspend 콜드까지 겹치면 5s connect cap에 걸려 500.
3. **[HIGH·CONFIRMED] 실행 폭주** — t0에 auth/me + notifications 5쿼리 집계 + 홈 3fetch, auth 후 SSE/reminders/settings 3건 추가 — 스켈레톤을 여는 건 /api/boards 1건뿐인데 나머지가 콜드 자원 경쟁으로 그걸 늘림. reminders fetch는 알림 권한 확인 **전** 발사(순수 낭비).
4. **[MED·CONFIRMED] '/' 진입 이중 워터폴** — 스플래시가 auth/me 완주까지 전체 차단(page.tsx:79,139) 후 이동, 이동 후에야 데이터 fetch. 레이아웃이 auth/me를 중복 발사(dedupe 없음).
5. **[MED·CONFIRMED] 서버 직렬 왕복** — vine 4연속(전부 독립, route.ts:28~70), stats 3단계 중 3단째가 무의존(147), friends 2연속(11,43). auth/me는 select 없이 전 컬럼(bcrypt 해시 포함) 인출.
6. **[MED·CONFIRMED] SW 내비 무한 대기** — network-first에 타임아웃 없음(sw.js:73~) → 느린-비오프라인 회선에서 스켈레톤 이전 흰 화면 수십 초.
7. **[MED·PARTIAL] fetch 레이어에 dedupe/TTL 없음** — 홈↔통계 왕복마다 같은 키 재발사, in-flight 병합 없음. 인박스 1방문 = 같은 5쿼리 집계 3중 fetch(inbox:34,59,60). relay/create는 '/api/friends' 캐시 우회.

### 스펙 (적용된 변경)
- **cachedApi 영속**(1): localStorage `podoal-page-cache-v1` write-through(debounce 800ms + pagehide 플러시, 300K 예산·상세 키 우선 탈락) + 부팅 시드. 소유자 대조 `setPageCacheOwner`(레이아웃 auth 성공 시) — 타 계정 스냅샷 전량 폐기. `clearPageCache`가 영속층 포함 전소(로그인/로그아웃/탈퇴/dev 로그인 경로 배선). 구 "persist 안 함" 결정은 본 감사로 명시적 반전(신선도는 기존 재검증 불변이 보장).
- **user 스냅샷**(1,4): store.ts `podoal-user-snapshot-v1`(additive 신규 키 — 기존 키 불변), setUser write-through. 레이아웃 auth 실패 시 스냅샷+캐시 전소 후 `/` 복귀(낙관 리다이렉트와의 무한 왕복 차단). 레이아웃 setUser 생략 비교에 provider/analyticsConsentAt/createdAt/dayResetHour 추가(스냅샷 구 세션 값 갱신 보장).
- **'/' 낙관 리다이렉트**(4): 스냅샷 있으면 auth/me 대기 없이 즉시 /home(OAuth 에러 복귀는 제외), 없으면 `/home` prefetch. fetchUser 성공 10초 메모(api.ts).
- **폭주 완화**(3): UnreadSync 첫 동기화 +2.5s, SSE 첫 연결 +3s, reminders 첫 refresh +4s + 권한 없으면 fetch 스킵. 복귀(visibility/focus) 경로는 전부 불변.
- **서버 병렬화**(5): vine 4쿼리·friends 2쿼리 Promise.all, stats 카테고리 findMany를 첫 배치로 — **셋 다 응답 byte-동일 재구성**(쿼리 내용·정렬·매핑 불변). auth/me는 select 8필드(응답 profile 계약 그대로).
- **prisma 풀**(2): `idleTimeoutMillis: 60_000, keepAlive: true` 추가(connect 5s cap 유지). `.env.example` 호스트에 `-pooler` 명시.
- **SW 내비 3s 레이스**(6): 3초 내 문서 미도착 시 런타임 캐시 문서 서빙(최악 한 배포 전 = 기존 오프라인 폴백과 동일 계약 — network-first 근거인 stale-chunk 클래스 불변). 캐시 없으면 종전대로 무한정 대기. `CACHE_VERSION='2026-07-18-nav-timeout'` 범프.
- **fetch 레이어**(7): in-flight 공유(fetchShared) + mount 재검증 TTL 5s(복귀 스로틀과 동일 감각). 인박스 read-all 후 refresh+force 재조회 2건 → mutate 로컬 반영 + countUnread 파생. relay/create를 useCachedApi('/api/friends')로 전환.

### 제약 (준수 확인)
- §3 게이트: 라우트 rename/필드 제거 없음. 응답 계약 전부 불변. `getCurrentUserId`+`authResponse` 가드 불변. store.ts 기존 키(`podoal-app-settings`·`podoal-feedback-settings`) 불변 — 신규 키 2개는 additive.
- 낙관 채움 파이프라인·`isJustFilled` 600ms·mergeServerBoard 무접촉. SSE lastCheck 로직 무접촉(연결 시점만 지연).
- 계정 전환 대비: 로그인·로그아웃·탈퇴·dev 로그인·auth 실패 5경로 전부 전소 배선 + 소유자 대조 백스톱.

### 리뷰 라운드 (PR #132 — Gemini 봇 + 4렌즈 적대 워크플로, 확정분만 반영)
- **fetchUser 3-상태화**: 일시 장애(오프라인/5xx/SW 503)를 확정 미인증(401/404)과 구분 — 구분 없인 비행기 모드 실행이 로그아웃+캐시 전소로 이어졌다(치명 회귀). 레이아웃은 미확정 동안 online/복귀 리스너로 재검증(계정 전환 직후 일시 장애 1회로 이전 스냅샷이 세션 내내 남던 창 폐쇄).
- **캐시 epoch + 무소유 봉투 차단**: clearPageCache가 epoch를 올려 뒤늦은 미중단 응답의 재오염 차단, persistNow는 소유자 미확정(null) 시 no-op(로그아웃 후 pagehide 부활 + userId:null 봉투 입양 사슬 절단), 부팅 시드는 소유자 있는 봉투만 신뢰.
- **하이드레이션 정합**: module-load 시드를 초기 state로 직접 쓰면 서버 프리렌더 HTML과 어긋나 React 19가 루트 전체를 recoverable 에러로 재렌더 — `hydrated` 게이트(useCachedApi 초기값·readCachedApi)와 `hydrateUserSnapshot()`(레이아웃·웰컴 effect)로 시드를 첫 커밋 이후로 이동. SPA 마운트는 동기 캐시 그대로.
- **인박스 read-all 역전 경쟁**: 느린 mount GET(커밋 전 스냅샷)이 빠른 POST+mutate를 되덮던 것 — 피드 도착 후 POST 발사로 해소(콜드 캐시 mutate no-op도 함께).
- **useCachedApi TTL 경로**: latestGuard.begin() 미호출로 직전 url의 늦은 응답이 새 화면을 덮던 역순 응답 클래스 재발 — begin()+에러 리셋 추가. url 전환 시 화면 state 캐시 동기화 + fetched 리셋(빈 상태 오분류 방지).
- **SW 타임아웃 경로**: '/home' 폴백을 오프라인 분기 전용으로 격리(느린 회선의 첫 방문 딥링크에 오문서 서빙 방지 — 타임아웃은 같은 URL 캐시만), waitUntil이 put '완주'까지 수명 연장(putDone 체인), put에 catch. 미채택: 레이스 패배 응답 body?.cancel()(위생 수준 — 수용).
- 미채택(아키텍처 제안): 세션 동반 쿠키(비-HttpOnly has-session)로 부팅 시드 게이트 — 인증 쿠키 발급 경로(§3 승인 영역) 변경이라 별도 결정 필요. 현 방어로 교차 계정 노출은 차단, 잔여 창은 '본인 세션 만료 후 본인 데이터 일시 표시'뿐.

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test && npx next build
# 수동(배포 후): PWA 재실행 → 홈이 마지막 데이터로 즉시 페인트 + 무음 재검증 확인.
# DevTools Application → 신 CACHE_VERSION 등록·구 캐시 삭제 확인.
# 로그아웃 → localStorage에 podoal-page-cache-v1/podoal-user-snapshot-v1 부재 확인.
# Network 슬로틀(Slow 3G) → 내비 3초 후 캐시 문서 서빙 확인.
```
