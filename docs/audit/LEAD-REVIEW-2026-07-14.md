# 포도알 리드 개발자·제품 오너 리뷰 — 2026-07-14

> 성격: 2026-07-14 시점의 코드·제품 스냅샷이자 의견 있는 실행 제안서.  
> 기준 문서: `CLAUDE.md`, `docs/ROADMAP.md`, `docs/PRODUCT_PLAN.md`, `docs/PRINCIPLES.md`, `docs/VISION_2026-07-14.md`, `docs/audit/REVIEW-2026-07-13.md`, `docs/audit/REVIEW-2026-07-14.md`.  
> 직접 확인 범위: `package.json`, `prisma/schema.prisma`, `src/app/**`, `src/components/**`, `src/lib/**`, 기존 계획·감사 문서와 카드 목록.  
> 표기 규칙: **현재**는 코드나 정본 문서로 확인한 사실, **제안**은 아직 구현하지 않은 판단이다. 이 문서는 앱 코드를 변경하지 않는다.

---

## 1) Executive snapshot — 무엇이며, 어디까지 왔나

### 한 문장 진단

포도알은 “습관을 체크한다”보다 **한 알을 눌러 채우는 손맛, 기다려 익는 리듬, 관계가 남기는 선물**을 제품 정체성으로 삼은 모바일 우선 PWA다. 코어 기능은 이미 넓고 깊다. 지금의 문제는 더 많은 기능이 아니라 **실사용자가 핵심 루프를 이해하고 반복하는지 측정할 신호가 아직 부족하고, 이미 커진 클라이언트 표면을 계속 안전하게 운영할 구조가 필요한 것**이다.

### 현재 실제로 배송된 범위

`docs/ROADMAP.md`의 2026-07-14 스냅샷과 실제 라우트·컴포넌트를 대조하면 다음이 존재한다.

- 계정: 이메일 가입/로그인, Google·Kakao·Naver OAuth 및 개발용 게스트 경로, 프로필/비밀번호/탈퇴, 분석 동의.
- 개인 습관: 4단계 보드 생성, 10/15/20/30칸, 템플릿 38종, 채움·취소, 낙관적 업데이트, 보드 정렬, 스와이프 수확, 보드 정보·사진 수정.
- 리듬: `FREE`, `DAILY_1`, `DAILY_N`, `WEEKLY_N`, 숙성 상태, 이른 채움 확인, 엄격 모드, 보충 기록, 사용자 시간대와 새벽 리셋.
- 감정적 보상: 중간 보상, 완성 보상, 완주 애니메이션, 시간 캡슐, 와이너리 7티어, 셀러 노트, 공유 카드.
- 관계: 친구 검색/요청, 응원 메시지, 보드 선물, 특정 알에 숨기는 깜짝선물, 순차·그룹 릴레이, 친구 활동.
- 회고: 요약·90일 히트맵·분석 차트·주간 회고, 바인 타임라인, 보상 갤러리, 와이너리.
- 플랫폼: 설치형 PWA, 서비스 워커, 오프라인 배너, iOS 설치 안내, Web Push, 시간/숙성/주간 회고 cron, 위젯용 웹 API groundwork.
- 신뢰: 내보내기, 프라이버시 화면, 통합 알림함, 알림별 opt-in, DND, 동의 전 no-op 분석 래퍼.

따라서 “리마인더를 만들자”, “보상을 넣자”, “친구가 응원하게 하자”, “주간 통계를 만들자” 같은 아이디어는 신규 제안이 아니다. 이미 구현되어 있다. 다음 제안은 기존 자산을 더 잘 연결하거나, 명시된 백로그를 우선순위화하는 데 초점을 둔다.

### 배송되지 않았거나 외부 게이트에 묶인 것

- **현재 대기:** 친구 베타 1라운드, iOS/Android 실기기 코어 저니 QA, PostHog EU 키 주입 후 실제 수신 확인, OAuth 실제 키 등록.
- **계획만 존재:** 네이티브 셸과 홈 위젯(P2), 무료 스킨부터 시작하는 꾸미기/수익화(P3), 다크 모드, 오프라인 채움 큐, 공개 보드 링크, 저장형 사용자 템플릿, 보상 이미지 업로드, 글자 크기 설정.
- **의도적 보류:** CSP nonce enforce, 구조화 로깅/에러 트래킹 도구, SSE 공유 채널 전환, 대규모용 바인 DB 집계·페이지네이션, i18n, B2B 관리 기능.
- **명시적 비목표:** 진행·보상·릴레이 유료 게이트, 가챠, 만료 압박, 강제 광고, 랭킹·벌금 중심 동기부여.

### 솔직한 제품 평가

기능 수로는 MVP를 오래전에 넘었다. 오히려 첫 사용자가 홈·보드·보상·숙성·친구·릴레이·바인·와이너리의 관계를 한 번에 이해하기 어렵다는 위험이 있다. 이 앱의 해자는 기능 목록이 아니라 다음 세 순간이다.

1. 첫 알을 눌렀을 때의 촉각적 만족.
2. 며칠 뒤 포도송이가 형태를 갖추는 소유감.
3. 친구의 응원·숨은 선물·캡슐이 “혼자 체크한 기록”을 “관계의 기억”으로 바꾸는 순간.

향후 작업은 이 세 순간까지의 시간과 실패율을 줄이는가로 평가해야 한다.

---

## 2) Code review findings — 실제 코드의 강점과 약점

### 강점: 지켜야 할 설계

#### 채움 정합성과 체감이 같은 파이프라인에 있다

`src/app/(app)/board/[id]/page.tsx`, `src/lib/boardFillState.ts`, `src/lib/fillBoard.ts`, `src/components/GrapeBoard.tsx`는 이 앱의 가장 가치 있는 코드다.

- 클라이언트는 임시 스티커를 먼저 넣고 서버 결과로 reconcile한다.
- 보드별 직렬 큐가 빠른 연속 탭을 순서대로 처리한다.
- 서버는 Serializable 트랜잭션 충돌을 `isSerializationConflict()`로 원인 체인까지 판별한다.
- 보상 unlock과 완료 상태가 채움 응답에 함께 돌아오고, 600ms `isJustFilled`와 `CELEBRATION_PEAK_MS`가 시각적 결과를 조율한다.
- `GrapeBoard`의 WAAPI 완주 연출은 CSS reduced-motion 전역 규칙 밖이라는 점을 인지하고 별도 가드를 둔다.

이는 단순 CRUD가 아니라 제품 감각과 데이터 정합성을 같이 설계한 좋은 사례다. **제안:** 오프라인 큐나 위젯 원탭 채움을 만들 때 이 파이프라인을 우회하지 말고, 동일한 명령/결과 계약을 재사용해야 한다.

#### 접근성과 공용 인터랙션 기반이 예상보다 성숙하다

- `src/components/Modal.tsx`: `role="dialog"`, `aria-modal`, Escape, 포커스 트랩, 중첩 스택, 초기 포커스, 복원, 스크롤 잠금, 종료 애니메이션 후 언마운트.
- `src/components/ClayButton.tsx`: 버튼과 링크를 구분하고 버튼 기본 `type="button"`, loading/disabled 처리와 variant를 중앙화한다.
- `src/components/ConfirmDialog.tsx`: `window.confirm()` 대체.
- `src/components/Toggle.tsx`, `RetryButton.tsx`, `EmptyState.tsx`: 7월 13일 감사에서 발견된 중복을 공용화했다.
- `src/app/globals.css`: 전역 focus-visible, reduced-motion, AA placeholder, 디자인 토큰.
- `src/app/(app)/stats/page.tsx`: 요일/월별 차트와 완료율에 요약 `aria-label`이 있다. `Heatmap`은 색뿐 아니라 도트 크기도 사용한다.

#### 보안과 실패 경계가 문서화되어 있다

- 보호 API는 `src/lib/auth.ts`의 `getCurrentUserId()`를 공통 사용한다.
- `src/proxy.ts`는 변이 API에 같은 출처 CSRF 검사를 적용한다.
- OAuth state, cron 상수시간 인증(`src/lib/cronAuth.ts`), 로그인 타이밍 완화, dev endpoint production gate가 존재한다.
- 최근 감사에서 malformed JSON 변이 요청을 400으로 바꾸고 OAuth 비밀번호 계정 자동 병합을 거부하도록 경화했다.
- `src/lib/analytics.ts`는 동의 전 no-op, `src/lib/push.ts`는 설정 부재 시 no-op 및 죽은 endpoint 정리를 의도적으로 수행한다.

#### 순수 도메인 로직을 테스트할 수 있게 분리했다

`src/lib/dayBoundary.ts`, `cadence.ts`, `pace.ts`, `streak.ts`, `boardFillState.ts`, `rewardValidation.ts`, `relay.ts`, `latestGuard.ts` 등은 페이지 밖의 순수 로직으로 빠져 있고 `src/lib/__tests__/`에 대응 테스트가 있다. 현재 저장소에는 `.test.ts` 파일 26개가 확인된다. 복잡한 날짜·리듬·동시성 규칙을 JSX 안에만 두지 않은 점이 좋다.

### 약점: 이제 비용을 치르기 시작한 부분

#### 페이지 컴포넌트가 제품 전체의 복잡도를 흡수한다

`src/app/(app)/home/page.tsx`는 필터, 캐시 프리패치, 정렬 FLIP, long-press, 스와이프 축 잠금, 자동 스크롤, 수확/삭제, 온보딩, 스트릭, 친구 활동, 응원을 한 파일에서 조율한다. `src/app/(app)/board/[id]/page.tsx`도 상세 조회, 낙관 채움, 보상/캡슐/선물/사진/공유/리마인더/여러 모달을 소유한다. 코드가 작동한다는 사실과 변경하기 쉽다는 사실은 다르다.

**제안:** 시각 컴포넌트 쪼개기가 아니라 “행동 단위 훅”을 먼저 추출한다.

- 홈: `useBoardReorderGesture`, `useBoardHarvest`, `useFriendActivity`.
- 상세: `useBoardFillQueue`, `useBoardCelebration`, `useBoardActions`.
- 각 훅은 네트워크 호출까지 숨기지 말고 명시적인 상태 머신과 이벤트를 반환한다.

잘못 쪼개면 props만 늘어난다. 목표는 파일 길이가 아니라 **동시 상태 전이의 수를 줄이는 것**이다.

#### 전 페이지 client rendering은 제품 속도와 구조의 상한이 된다

`CLAUDE.md`가 모든 페이지를 `'use client'`로 운영하는 현재 규칙을 명시하며, 실제 소스에서 client marker가 광범위하게 확인된다. `src/lib/cachedApi.ts`가 메모리 캐시·포커스 재검증·최신 요청 가드를 제공해 전환 체감은 보완하지만 다음 비용이 남는다.

- 초기 JS와 hydration 비용.
- 데이터 fetch/에러/로딩 패턴의 반복.
- 서버 컴포넌트가 줄 수 있는 초기 HTML, streaming, 인증 후 선조회 이점을 사용하지 못함.
- 앱이 커질수록 Zustand, module cache, 페이지 local state 사이의 권위가 흐려질 수 있음.

**제안:** 전면 전환은 금지한다. `/settings/privacy`, `/more`, 정적 설명 표면부터 server-first 후보를 측정하고, 홈·보드 상세은 인터랙션 섬을 유지한다. PWA 캐시와 인증 redirect가 얽혀 있으므로 실제 Web Vitals 전후 비교 없이 구조 개편하지 않는다.

#### 상태 관리의 책임선이 불명확하다

`src/lib/store.ts`는 user, unread count, settings 등을 Zustand/localStorage로 유지한다. 서버 데이터는 `useCachedApi`의 module `Map`, 일부 화면 local state, mutation 후 수동 invalidate가 함께 담당한다. 지금은 경량이고 의존성이 적다는 장점이 있지만, “어느 값이 authoritative한가”를 신규 개발자가 추론해야 한다.

**제안:** 새 라이브러리 도입 전에 상태 소유권 표를 정본화한다.

| 종류 | 권위 | 예시 |
|---|---|---|
| 계정·서버 리소스 | API/DB | boards, friends, rewards |
| 짧은 화면 전이 | page/hook local state | 열린 모달, drag 상태 |
| 기기 선호 | Zustand persisted | sound/haptic, home filter |
| 파생값 | selector/useMemo | filtered boards, counts |
| 전환 캐시 | `cachedApi` | GET snapshot, invalidate 필수 |

TanStack Query 도입은 캐시 무효화 실수가 실제 베타 결함으로 나타날 때 판단한다. 지금 교체는 가치보다 회귀 범위가 크다.

#### 테스트의 중심이 순수 함수에 치우쳐 있다

순수 도메인 테스트는 강하지만 `docs/ROADMAP.md`가 인정하듯 route handler 직접 테스트, cron 3종, OAuth callback, proxy CSRF, 권한 경계의 통합 팩은 남아 있다. 홈 gesture와 보드 낙관 채움도 실제 브라우저 상호작용 회귀가 문서/수동 절차에 많이 의존한다.

**제안:** 다음 테스트 투자는 단위 테스트 개수 확대가 아니라 세 층으로 한다.

1. API 계약: 인증 없음/타인 소유/잘못된 JSON/중복 요청.
2. 코어 브라우저 여정: 가입 또는 dev login → 첫 보드 → 첫 알 → 완료/수확.
3. 제스처 실기기: 세로 스크롤과 가로 수확 충돌, long-press 정렬, iOS safe area.

#### 오류 관측성이 사용자 메시지 수준에 머문다

화면 에러와 재시도는 많이 개선됐지만 서버는 여전히 프레임워크 기본 500과 산발적 `console.error`에 의존한다. `rateLimit.ts`처럼 의도적 fail-open 로그가 있는 곳과, 실제 장애가 같은 채널에 섞일 수 있다.

**제안:** Sentry를 즉시 박는 대신 에러 분류 계약부터 만든다: `requestId`, route, userId hash, error class, safe context, retryable. 베타에서 실패율을 얻은 뒤 공급자를 결정한다. 개인 메시지·보상 내용·이메일은 로그 금지다.

### 현재 결함으로 오인하면 안 되는 과거 지적

7월 13일 리뷰의 Toggle 3중 정의, 재시도 복붙, 에러 색, 빈 홈 데드엔드, vine 시간대 불일치, cron 인증·배치·인덱스, 생이모지, 공용 버튼 submit 문제, `useCachedApi` 역순 응답은 7월 14일 정본에서 완료로 기록되어 있다. 본 문서는 이를 신규 버그로 재등록하지 않는다. `transition-all`도 검색상 남은 1건은 규칙 설명/문맥을 포함해 확인해야 하며, 로드맵은 실제 49개 사용처 스윕 완료를 정본으로 둔다.

---

## 3) UX/UI critique + concrete polish ideas

### 웰컴·로그인 (`src/app/page.tsx`)

**현재:** 이메일 로그인/가입과 3개 소셜 진입, provider readiness 조회, 게스트 체험 fallback, 설치 안내와 분석 동의 흐름이 있다.

**비평:** 선택지가 넓어 신뢰는 주지만 첫 화면의 제품 약속보다 인증 방식이 더 강하게 보일 위험이 있다. 실제 OAuth 키가 없을 때의 “체험”은 진입을 열지만, 나중에 계정 연속성에 대한 기대를 혼동시킬 수 있다.

**제안:**

- 첫 CTA 위에 8초짜리 가치 시퀀스: 빈 알 → 한 알 채움 → 친구 선물 발견. 설명 슬라이드가 아니라 실제 제품 모션의 축약본.
- provider가 guest fallback이면 버튼 클릭 직전 “체험 계정이며 기기 변경 시 이어지지 않을 수 있음”을 짧게 알린다.
- PostHog 활성화 후 `welcome_view → auth_start → auth_success → first_board_created → first_fill`의 중앙값 시간을 기준으로 카피/배치를 판단한다.

### 온보딩·첫 보드 (`OnboardingWelcome.tsx`, `board/create/page.tsx`, `create/*`)

**현재:** 온보딩 후 4단계 생성, 38개 템플릿/7개 카테고리, 제목·크기·리듬·보상 설정이 있다. 템플릿의 `recommendedCadence`도 기본 제안에 활용된다.

**비평:** 강력하지만 첫 성공 전에 결정해야 할 것이 많다. “보상을 잘 설계해야 시작할 수 있다”는 부담을 줄 수 있다.

**제안:**

- **빠른 시작:** 템플릿 카드 한 장을 길게 설정하지 않고 “이대로 시작”하면 10칸 + 추천 리듬 + 보상 없음으로 생성. “자세히 꾸미기”가 기존 4단계로 간다.
- 단계마다 저장되는 초안은 사용자가 이탈할 때만 가치가 있다. 먼저 단계별 이탈 계측 후 도입한다.
- 리듬 용어는 설정값보다 경험으로 미리 보여준다. 예: `매일 1알` 선택 시 7일 미니 포도 예시.
- 보상 단계에는 “나중에 추가 가능”을 명확히 표시해 완벽주의 마찰을 줄인다.

### 홈 (`src/app/(app)/home/page.tsx`, `BoardCard.tsx`, `SwipeableBoardCard.tsx`)

**현재:** 시간대 인사, 스트릭, 필터별 개수, 보드 카드, long-press 정렬, 가로 스와이프 수확, 친구 활동/응원, 생성 FAB, 빈 상태가 있다.

**비평:** 앱의 핵심이지만 제스처 밀도가 높다. 카드 탭, long-press, 수평 swipe, 수직 scroll이 같은 표면에 있다. 숙련자에게는 좋고 초보자에게는 기능이 숨는다. 필터 기억은 편리하지만 “왜 보드가 안 보이지?”를 만들 수 있다.

**제안:**

- 첫 3회에만 카드 아래 contextual hint: “길게 눌러 순서 변경 · 끝까지 밀어 수확”. 한 번 수행하면 영구 숨김.
- 필터가 `all`이 아니고 결과가 0이면 “전체에는 N개 있어요” + 한 탭 복귀 버튼.
- 오늘 익은 보드가 있으면 스트릭 아래 단 하나의 우선 행동 카드로 제시. 모든 보드를 같은 시각 무게로 두지 않는다.
- 친구 활동은 개인 루프 다음에 둔다. 홈 상단에서 소셜이 과해지면 비교 압박이 생기므로 기존 숨김 설정을 존중한다.
- 수확은 되돌리기 가능한 toast를 5초 제공하는 방향을 검토한다. 서버 계약 변경 전, 실제 오수확 빈도부터 계측한다.

### 보드 상세 (`src/app/(app)/board/[id]/page.tsx`, `GrapeBoard.tsx`)

**현재:** 포도송이 채움, pace/ripening, 이른 채움 확인 sheet, 보상, 캡슐, 공유, 선물, 커스텀 이미지, 리마인더 등 가장 많은 가치가 모인다.

**비평:** 포도송이가 영웅이어야 하는데 부가 기능이 늘며 상세 화면이 도구함이 될 위험이 있다. 핵심 탭의 즉시성은 뛰어나지만 “왜 지금 이 알이 덜 익었는지”, “엄격/소프트 차이가 무엇인지”는 사용자가 설정을 기억해야 한다.

**제안:**

- 상단은 제목/리듬/진행률, 중앙은 송이, 하단은 **오늘의 한 행동**을 기본 정보 계층으로 고정한다.
- 공유·선물·사진·편집·리마인더는 overflow/action sheet로 묶되, 보상과 캡슐은 감정적 콘텐츠이므로 송이 가까이에 유지한다.
- 숙성 알을 탭했을 때 숫자 계산 대신 “내일 오전 6시에 가장 맛있어져요”처럼 사용자 timezone/dayResetHour로 절대 시점을 보여준다.
- 완료 애니메이션은 브랜드 자산이지만 반복 완주자에게 2.4초가 길 수 있다. 첫 완주 full, 이후 “빠르게 보기” 선호를 실험한다. reduced-motion은 계속 강제 존중한다.
- custom grape photo가 기본 아트와 섞일 때 정보 대비가 무너지지 않는지 밝은/어두운 사진으로 실기기 QA한다.

### 친구·메시지·릴레이 (`friends/**`, `messages`, `relay/**`)

**현재:** 검색/요청, 친구 보드 열람, 응원, 선물, 깜짝선물, 메시지 SSE, 순차/그룹 릴레이가 있다.

**비평:** 이것이 차별점이지만 관계 모델이 여러 화면으로 흩어진다. “친구에게 무엇을 할 수 있는가”를 친구 상세에서 한눈에 이해하기 어렵고, 메시지와 통합 알림함의 역할도 사용자에게 중복처럼 느껴질 수 있다.

**제안:**

- 친구 상세에 관계 행동 3개만 고정: 응원하기, 보드 선물하기, 함께 릴레이. 깜짝선물은 친구 보드의 맥락 행동으로 유지한다.
- 메시지는 대화/감정, 알림함은 시스템 사건이라는 카피·아이콘 규칙을 명확히 한다.
- 릴레이 상세에는 “현재 누구 차례 / 내가 할 수 있는 것 / 다음 사람”을 첫 viewport에 둔다.
- 경쟁 랭킹 대신 함께 만든 결과물을 강화한다. 완주 릴레이의 참여자 이름·기간·한 줄 메모가 담긴 기념 카드는 제품 철학과 맞는다.
- 발신자 프로필 링크(P4)는 작은 비용으로 관계 연속성을 높인다. 다만 친구 해제 후 접근 정책을 API에서 재검증한다.

### 통계·바인·와이너리 (`stats`, `vine`, `winery`)

**현재:** 통계 3탭, 90일 히트맵, 주간 recap modal, 활동 타임라인, 7티어 와이너리와 병/노트가 있다.

**비평:** 데이터가 풍부하지만 회고의 질문이 분산된다. 통계는 “얼마나”, 바인은 “무엇을”, 와이너리는 “무엇이 남았나”인데, 사용자가 이 관계를 스스로 조립해야 한다.

**제안:**

- 통계 첫 화면에 숫자보다 한 문장: “이번 주는 화요일 저녁에 가장 잘 채웠어요.” 이미 집계한 데이터를 설명형 insight로 바꾼다.
- 히트맵 드릴다운(P4)은 새 화면보다 bottom sheet로 시작: 날짜, 채운 보드, 보충/이른 채움 여부.
- 바인은 무한 기록장이 아니라 90일 회고임을 명시하고, 병목이 확인될 때 cursor pagination과 DB aggregation을 함께 설계한다.
- 와이너리는 티어 도달만이 아니라 완성 보드의 개인 메모가 핵심이다. 셀러 노트 작성률을 계측하고 낮다면 완료 직후 한 줄 prompt를 더 자연스럽게 연결한다.

### 설정·알림·프로필 (`settings/**`, `notifications/**`, `profile`)

**현재:** 소리/진동/볼륨, fill sound, 알림 종류/DND/리마인더, privacy, 내보내기, 프로필/비밀번호/탈퇴가 있다.

**비평:** 기능은 충분하다. 과제는 제어 가능하다는 신뢰다. 특히 푸시는 브라우저 권한, 앱 설정, DND, 개별 토글, cron 상태가 겹친다.

**제안:**

- 알림 상단에 상태 요약: “이 기기: 허용됨 / 앱: 켜짐 / 방해금지: 22:00~08:00”. 실패 원인을 한 화면에서 찾게 한다.
- Web Push가 불가능한 iOS 설치 상태라면 일반적인 실패 문구 대신 설치/권한 절차로 연결한다.
- 데이터 내보내기는 “무엇이 포함/제외되는가”를 다운로드 전에 명시한다. 특히 미공개 깜짝선물 제외 정책.
- 탈퇴는 파괴적이되 죄책감 카피를 쓰지 않는다. 데이터 삭제 범위와 취소 불가만 정확히 말한다.

---

## 4) Frontend notes — 구조, 상태, 성능, 접근성

### 컴포넌트 구조

공용 primitives(`ClayButton`, `Modal`, `Toggle`, `EmptyState`, `RetryButton`)와 도메인 컴포넌트(`GrapeBoard`, `BoardCard`, `RewardList`)의 구분은 좋다. 다음 단계는 더 많은 primitive가 아니라 **도메인 흐름의 경계**다.

**제안 순서:**

1. 홈/상세의 이벤트와 상태를 목록화한다.
2. 서로 함께 바뀌는 상태를 reducer 또는 전용 훅으로 묶는다.
3. 네트워크 mutation의 optimistic/rollback 계약을 테스트한다.
4. 그 뒤에만 뷰를 분리한다.

`GrapeBoard.tsx`의 imperative animation DOM 생성은 성능상 타당하지만 시각 토큰(hex)이 TS에도 일부 존재한다. CSS token과 주석으로 연결되어 있으나 향후 테마/다크모드에서는 이중 소스가 된다. **제안:** 다크 모드 착수 때 `getComputedStyle` 기반 CSS custom property 또는 theme-aware animation palette로 이동한다. 지금 단독 변경할 이유는 없다.

### 상태 관리

`useCachedApi`의 최신 세대 가드는 stale state를 막지만 AbortController는 네트워크 자원 절약과 별개다. 현재 구현은 cache key별 데이터 보존을 위해 이전 응답의 cache write는 허용하고 현재 화면 state write만 막는 설계다. 이 의도를 주석/테스트로 유지해야 한다.

Mutation 후 invalidate 규칙을 문서화할 필요가 있다. 예:

- 보드 채움: 상세 snapshot + 홈 목록 + stats/vine/winery 잠재 영향.
- 친구 응원: messages/notifications/unread 영향.
- 알림 읽음: inbox + global badge 영향.

모든 것을 즉시 refetch하면 느리고, 일부만 갱신하면 stale UX가 된다. **제안:** 리소스별 invalidation matrix를 `cachedApi.ts` 인접 문서에 둔다.

### 성능

- 홈은 첫 8개 보드 상세 prefetch를 수행한다. 데이터/기기 조건에서 이 수가 적절한지 계측이 없다. Save-Data, 느린 네트워크, 보드 수에 따라 2~4개로 줄이는 실험이 가능하다.
- 메시지 SSE는 서버가 10초 DB polling, 4분 cap, backoff reconnect를 사용한다. 소규모 베타에는 단순하고 충분하나 동접이 늘면 함수 점유와 Neon query가 선형 증가한다.
- 바인은 90일 raw sticker를 JS에서 묶고 stats는 DB 집계를 사용한다. 실제 heavy-user latency가 임계치를 넘을 때만 바꾼다는 현재 판단이 합리적이다.
- 모든 페이지 client-side fetch 구조에서 로딩 skeleton 품질은 좋지만 LCP/INP/JS bundle을 아직 실제 사용자 기준으로 보지 못했다.

**제안 성능 예산:** 중급 Android 4G에서 home route interactive 2.5초 이내, grape tap 피드백 100ms 이내, mutation rollback 사용자 통지 1초 이내. PostHog와 Web Vitals 수집이 가동된 뒤 현실 값으로 조정한다.

### 접근성

기반은 좋지만 남은 위험은 “큰 글자와 복합 제스처”다.

- long-press reorder와 swipe harvest에는 반드시 메뉴/버튼 대체 경로가 유지되어야 한다. `BoardCardMenu.tsx`가 그 역할을 하는지 실기기 스크린리더로 검증한다.
- 포도 알은 작은 화면에서 최소 44px target을 지키는지 30칸과 큰 글자 설정 양쪽에서 확인한다.
- 차트 `role="img"` 요약은 유용하지만 상세 값을 탐색하지 못한다. 드릴다운 구현 시 날짜별 텍스트 목록 대체를 제공한다.
- 브라우저 200% zoom, iOS Dynamic Type 유사 조건, 한국어 줄바꿈, modal safe area를 device checklist에 포함한다.
- 앱 전체 글자 크기 옵션은 단순 root scale이 아니다. 네비, 카드, 30알 송이, sheet 높이의 overflow를 함께 검증해야 한다.

---

## 5) Backend/data notes — 스키마, API, 보안, 확장

### 데이터 모델 평가

`prisma/schema.prisma`는 현재 제품 기능을 놀라울 만큼 직접적으로 표현한다.

- `Board`가 소유/수신/발신 선물 관계, 수확, 셀러 노트, 사진, cadence를 소유한다.
- `Sticker`는 위치 unique, filler, `isBackfill`, `earlyFill`을 보존한다.
- `Reward`는 trigger unique, unlock과 reveal을 분리한다.
- `RelayParticipant`는 relay/user와 relay/order 양쪽 unique로 순서를 보호한다.
- `NotificationSetting`, `Reminder`, `PushSubscription`이 전달 설정과 디바이스 endpoint를 분리한다.
- 주요 조회축에 7월 13일 추가된 인덱스가 있다.

강점은 기능과 데이터가 투명하다는 것, 약점은 다수의 상태/type이 `String`이라는 것이다. `cadenceType`, reward type, message type, relay status/mode, participant status, reminder type은 애플리케이션 검증에 의존한다.

**제안:** 지금 enum migration을 일괄 수행하지 않는다. 새 상태가 추가될 때 API validator와 DB check/Prisma enum의 장단점을 정리하고 한 도메인부터 적용한다. PostgreSQL enum은 제거/변경 비용이 있으므로 빠르게 변하는 제품 상태에는 check constraint가 더 유연할 수 있다.

### API 계약

현재 protected route auth guard, validation helpers, response shaping이 상당히 일관되다. 다만 route 수가 많아지며 mutation의 공통 계약이 더 중요하다.

**제안 표준:**

```text
성공: { data/resource-specific fields }
실패: { error: 사용자 안전 메시지, code: 안정적 기계 코드, requestId? }
상태: 400 validation / 401 auth / 403 ownership-policy / 404 concealment / 409 conflict / 429 rate limit
```

현재 클라이언트가 `ApiError` status를 사용하므로 안정적 `code`를 더하면 한국어 카피와 복구 행동을 HTTP 문구에서 분리할 수 있다. 단, 기존 response field 제거/rename은 `PRINCIPLES.md`의 데이터 레이어 gate 대상이다.

### 보안·개인정보

- OAuth 실제 키 등록 전 callback/redirect URI allowlist와 provider별 verified email semantics를 다시 확인한다. 자동 병합 거부 경화는 좋은 기본값이다.
- 공개 보드 링크를 만들 경우 순차 ID가 아니라 충분한 entropy의 revoke 가능한 token, 기본 OFF, 검색엔진 noindex가 필요하다.
- custom image/reward image 업로드는 MIME signature, 픽셀/용량 제한, EXIF 제거, orphan cleanup, 소유권 검사가 필요하다.
- 데이터 내보내기와 탈퇴 cascade는 통합 테스트 대상이다. 깜짝선물처럼 “타인의 아직 공개되지 않은 정보”는 export에서 계속 제외한다.
- CSP Report-Only에서 enforce로 갈 때 Next inline script, PostHog, VAPID, Blob image origin을 inventory한 뒤 nonce를 설계한다.

### 동시성·확장

- 채움의 Serializable retry는 핵심 자산이다. 위젯/오프라인/다중 디바이스가 들어오면 idempotency key가 필요해질 수 있다.
- `PlantedGift`는 `[boardId, position]` unique가 없다. 여러 친구가 같은 알에 선물을 심을 수 있는 것이 의도인지 UI/도메인 정책을 명시해야 한다. 의도하지 않았다면 migration 전 실제 데이터와 요구를 확인한다.
- `Friendship`의 방향 unique는 A→B와 B→A 두 row를 DB 수준에서 동시에 막지 않는다. API가 역방향 요청을 막는 현재 계약이 동시 요청에서도 안전한지 route 통합 테스트로 고정한다.
- cron batch는 개선됐지만 전달 보장은 best effort다. 규모가 커지면 job table/outbox, retry count, last error가 필요하다. 베타 단계에는 과설계다.
- SSE 전환 트리거를 숫자로 정한다: 동시 연결, 분당 query, 함수 실행 시간/비용, 메시지 지연 p95.

### 백업·운영

Neon/Prisma migration 절차는 `docs/MIGRATIONS.md`에 정리되어 있다. 여기에 제품 운영 관점의 복구 훈련이 더 필요하다.

**제안:** 분기 1회 staging restore drill, migration deploy 전 snapshot 확인, cron dry-run/관찰 모드, 주요 데이터 정합 query(완료 보드 filled count, dangling participant, unrevealed gift)를 운영 체크리스트로 둔다.

---

## 6) Button/interaction/micro-behavior audit

### 공용 버튼 (`src/components/ClayButton.tsx`)

**현재:** primary, secondary, ghost, danger, joyful variant와 sm/md/lg, fullWidth, loading, anchor/button 분기가 있다. button 기본 type은 `button`으로 수정되어 폼 내부 우발 submit을 막는다.

**제안:**

- loading 시 폭이 변하지 않도록 label 공간을 유지하고, `aria-busy`와 보조기술용 진행 문구를 확인한다.
- disabled는 “왜 안 되는지”가 필요한 경우 버튼 아래 이유를 제공한다. opacity만으로 설명하지 않는다.
- `joyful`은 완료/보상/첫 시작에만 사용한다. 모든 주요 CTA에 쓰면 감정적 고점이 평평해진다.
- destructive action은 danger + 명확한 명사형 문구(“보드 삭제”)를 사용하고, confirm의 기본 포커스는 취소에 둔다.

### 포도 알 (`GrapeBoard.tsx`, `GrapeSticker.tsx`, `RipeningSheet.tsx`)

**현재:** 다음 알, 숙성 진행, reward marker, planted gift marker, filling/just-filled state, soft override가 있다.

**제안:**

- double tap 방지와 rapid queue가 작동해도 시각적으로 “입력 접수됨”이 즉시 보여야 한다. filling state가 네트워크 latency 동안 유지되는지 3G throttle로 확인한다.
- 이미 채운 알 취소는 탭 한 번보다 명시적 secondary action이 안전할 수 있다. 실제 오취소 빈도를 베타에서 본다.
- strict mode에서 막힌 알은 disabled semantics와 다음 가능 시점을 함께 읽어준다.
- reward marker와 surprise marker가 색만으로 구별되지 않도록 모양/accessible label을 유지한다.

### 홈 카드 제스처 (`home/page.tsx`, `SwipeableBoardCard.tsx`, `BoardCardMenu.tsx`)

**현재:** 10px 이동 허용치, 축 판정, 450ms lift, edge auto-scroll, full swipe commit threshold 등 세밀한 상수가 존재한다.

**제안:**

- 실기기에서 thumb velocity와 viewport width에 따라 threshold가 지나치게 민감하지 않은지 확인한다. 상수를 감으로 재조정하지 않는다.
- long-press 성공 순간 짧은 haptic과 lift shadow, drop 성공 haptic을 구분한다.
- swipe tray의 버튼은 카드가 열린 동안 포커스 가능해야 하고, Escape/외부 탭으로 닫혀야 한다.
- 수확/삭제/정렬의 실패 rollback은 각각 다른 toast 문구와 복구 행동을 제공한다.

### 모달·시트 (`Modal.tsx`와 각 `*Modal.tsx`)

**현재:** 공용 close animation과 접근성 기반이 있다.

**제안:**

- async submit 중 backdrop/Escape 닫기를 허용할지 각 작업별 정책을 명시한다. 업로드·선물 전송 중 닫으면 취소인지 background completion인지 불명확하면 안 된다.
- sheet 내 마지막 action이 iOS home indicator에 가리지 않는 `pb-4` invariant를 신규 modal 리뷰 체크리스트로 유지한다.
- 성공 직후 자동 닫힘은 toast가 화면 전환 뒤에도 남아야 한다. 실패는 자동 닫지 않는다.
- 중첩 modal은 가능한 한 피하고, 선택 sheet → 결과 modal은 순차적으로 교체한다.

### 토글·알림 (`Toggle.tsx`, `notifications/page.tsx`, `settings/sound/page.tsx`)

**현재:** 공용 Toggle로 통합되었고 optimistic 변경 실패 시 rollback/retry가 보강됐다.

**제안:**

- 토글은 즉시 저장되는지 별도 저장 버튼이 필요한지 화면 전체에서 동일하게 한다.
- Web Push browser permission이 denied이면 app toggle을 켜는 척하지 말고 OS/browser 설정 안내 상태를 보여준다.
- DND 시간 변경은 저장 성공 전 local UI와 server truth가 어긋나지 않도록 pending 표시한다.

### 피드백 체계 (`src/lib/feedback.ts`, `src/lib/sounds.ts`)

30개 fill sound와 sound/haptic/volume 설정은 커스터마이징 강점이다. 다만 모든 상호작용에 소리를 붙이면 피로해진다.

**제안 감정 곡선:** 탐색은 무음 또는 약한 haptic, 알 채움은 선택 sound, 중간 보상은 한 단계 상승, 완주는 가장 풍부, 오류는 짧고 비징벌적. DND는 push뿐 아니라 앱 내 소리와 별개라는 점을 설정에서 분명히 한다.

---

## 7) Feature & customization ideas

아래는 모두 **제안**이다. 기존 기능과 겹치지 않도록 연결 지점을 명시한다.

### A. 가장 먼저: “오늘의 한 알” 집중 모드

홈에 오늘 pace상 채울 수 있는 보드만 한 장씩 보여주는 선택형 집중 모드. 새 습관 엔진이 아니라 기존 `paceState`와 board list의 새로운 presentation이다.

- 가치: 많은 보드를 가진 사용자의 결정 피로 감소.
- 안전장치: 기본 홈을 대체하지 않고 기기 선호로 opt-in.
- 측정: 집중 모드 진입 대비 fill 완료율, 기존 홈 대비 이탈.

### B. 관계 기억 카드

릴레이 완주, 보드 선물 완성, 깜짝선물 발견을 한 장의 저장 가능한 “함께 만든 포도” 카드로 만든다. 기존 share card, messages, winery 데이터를 재사용한다.

- 경쟁/랭킹 없이 소셜 해자를 강화한다.
- 공개는 항상 사용자 동작으로만, 상대 이름 포함 여부를 선택한다.
- P4의 relay 완주 기념물을 더 넓은 관계 기록물로 정의할 수 있다.

### C. 개인 테마는 스킨보다 작은 단계부터

P3 `GrapeSkin` 전에 무료로 검증할 수 있는 기기 로컬 커스터마이징:

- 홈 배경 톤 3종(밝은 종이/라벤더/세이지).
- 포도 채움 sound 즐겨찾기 3개 및 보드별 sound 선택.
- 카드 밀도(편안함/컴팩트).

리텐션 반응이 없으면 복잡한 상점 스키마를 서두르지 않는다. 진행 기능은 계속 무료다.

### D. 보상 이미지 업로드의 안전한 버전

`Reward.imageUrl`이 이미 있으므로 “사진 보상”은 자연스럽다. 처음부터 범용 파일 업로드보다 모바일 camera/photo 1장, 자동 리사이즈, EXIF 제거, 용량 제한으로 좁힌다. 가족/양육 사용례에 특히 강하다.

### E. 회고 질문 커스터마이징

완료 시 `cellarNote` 한 줄 외에 선택형 prompt를 제공한다: “무엇이 쉬웠나요?”, “다음에는 무엇을 바꿀까요?”. 답은 여전히 단일 note에 저장하거나, 실제 수요가 확인될 때 구조화 필드를 추가한다. 먼저 데이터 모델을 늘리지 않는다.

### F. 스트릭 유예의 재해석

`User.streakFreezeDate/UsedAt` 필드는 존재하지만 UI는 보류다. 벌점 면제권처럼 게임화하지 말고 “쉬어도 이어지는 하루”로 표현한다. 채움 리듬 데이터에서 중단 후 복귀율이 낮을 때만 노출을 검토한다.

### G. 공개 보드 링크

친구가 아닌 사람에게 읽기 전용 진행을 공유하는 opt-in token link. 유입 루프가 되지만 프라이버시 위험이 크다.

- 기본 OFF, 만료/폐기 가능.
- 보상 내용, 캡슐, 숨은 선물, 친구 신원은 절대 노출하지 않음.
- 비로그인 CTA는 “나도 포도판 만들기” 하나만.

### H. 저장형 커스텀 템플릿

같은 보드를 반복 생성하는 사용자에게 유용하다. 하지만 38개 템플릿과 빠른 시작의 발견성이 먼저다. 생성 로그에서 동일 제목/리듬 반복이 유의미할 때 신규 table을 정당화한다.

### I. 다크 모드

단순 색 반전이 아니라 clay shadow, warm text, grape/ripening, custom image overlay, illustration background의 새 미술 체계다. 야간 습관 사용과 OLED 가치가 크지만 별도 디자인 마라톤이어야 한다. system/light/dark 3상태와 splash/manifest theme-color까지 포함한다.

### J. 피해야 할 게임화

- 리더보드, 친구보다 뒤처졌다는 알림, streak 상실 압박.
- mystery box/확률 보상.
- 보상을 보기 위한 광고 또는 결제.
- 엄격 모드의 도덕적 우월감 카피.

포도알의 감정은 성취보다 **돌봄과 숙성**에 가깝다. 게임화는 그 세계관을 보강할 때만 쓴다.

---

## 8) Prioritized roadmap — 노력/영향 기준

노력은 1인 숙련 개발자 기준의 거친 범위이며 외부 심사·베타 대기 시간은 별도다.

### Near-term: 0~4주 — 코드보다 증거를 만든다

| 우선 | 작업 | 노력 | 영향 | 완료 기준 |
|---:|---|---:|---:|---|
| 1 | 친구 베타 1라운드 + `BETA_GUIDE` 기반 관찰 | 1~2일 운영 + 1주 관찰 | 매우 큼 | 최소 5명, 첫 보드/첫 채움/3일 복귀 정성 기록, 제보 카드화 |
| 2 | 실기기 코어 저니 QA | 1~2일 | 매우 큼 | iOS Safari/PWA + Android Chrome/PWA에서 생성·채움·숙성·정렬·수확·보상 |
| 3 | PostHog EU 키 주입·수신 검증 | 0.5일 + 2주 데이터 | 매우 큼 | 동의 전 0건, 동의 후 핵심 20 이벤트, PII 없음, funnel baseline |
| 4 | OAuth 실제 키 등록·3 provider 검증 | 1~3일 + 심사 | 큼 | state/redirect/account collision/logout/relogin 실계정 테스트 |
| 5 | route/API 보안 통합 테스트 팩 | 3~5일 | 큼 | cron, OAuth callback, CSRF, ownership, malformed input, duplicate mutation |
| 6 | 홈·상세 복합 제스처 접근성/큰 글자 QA | 2~3일 | 큼 | 대체 버튼 경로, 200% zoom, screen reader, 30알 보드 무결 |
| 7 | 첫 보드 TTV 분석 후 빠른 시작 A/B | 2~4일 | 큼 | 측정 근거가 있을 때만 구현, 첫 fill 시간/생성 완료율 비교 |

**리드 판단:** 1~4가 끝나기 전 다크 모드나 스킨에 들어가면 무엇을 개선했는지 알 수 없다. 단, 테스트 팩은 외부 키 대기와 병렬로 할 수 있다.

### Mid-term: 1~3개월 — 리텐션과 신뢰를 강화한다

| 우선 | 작업 | 노력 | 영향 | 착수 조건 |
|---:|---|---:|---:|---|
| 1 | “오늘의 한 알” 집중 모드 | 4~7일 | 큼 | 다보드 사용자의 선택 피로가 베타/데이터에서 확인 |
| 2 | 글자 크기 설정 | 5~8일 + QA | 큼 | 실기기 layout matrix 확정 |
| 3 | 히트맵 드릴다운 sheet | 4~6일 | 중~큼 | 회고 화면 사용/요청 신호 |
| 4 | 관계 기억 카드/릴레이 완주 기념물 | 5~8일 | 큼 | 소셜 사용률과 공유 의향 확인 |
| 5 | 보상 사진 업로드 | 5~10일 | 중~큼 | Blob 비용·retention·moderation/EXIF 정책 결정 |
| 6 | 관측성 v1 | 3~5일 | 큼 | 베타 오류량 확인, 공급자/비용 결정 |
| 7 | server-first 소규모 실험 | 3~5일 | 중간 | Web Vitals baseline, PWA/auth 회귀 테스트 확보 |
| 8 | 공개 보드 링크 설계/보안 리뷰 | 설계 3~5일 | 획득에 큼 | privacy 기본 OFF와 token lifecycle 승인 |

### Long-term: 3~12개월 — 플랫폼과 사업을 확장한다

| 순서 | 작업 | 노력 | 영향 | 게이트 |
|---:|---|---:|---:|---|
| 1 | P2 Capacitor 셸 + iOS/Android 위젯 | 6~10주 | 매우 큼 | D30 리텐션 신호, 개발자 계정, 위젯 fill 계약 |
| 2 | 다크 모드 디자인 마라톤 | 3~5주 | 큼 | 토큰/illustration/custom image 전면 QA 여력 |
| 3 | 오프라인 채움 outbox/idempotency | 4~8주 | 매우 큼 | 충돌 UX 설계, 다중 디바이스 테스트, telemetry |
| 4 | P3 무료 스킨 R1 | 3~5주 | 중~큼 | 계측 가동, 커스터마이징 수요 확인 |
| 5 | 유료 지갑/구독 | 6~12주+ | 사업 영향 큼 | R1 반응, 사업자/PG/IAP 정책, 환불·CS 체계 |
| 6 | SSE → managed realtime/shared channel | 2~5주 | 규모 대응 | 현재 방식의 동접·비용 임계치 초과 |
| 7 | i18n 또는 B2B 파일럿 | 각각 별도 quarter | 불확실/큼 | `PRODUCT_PLAN.md`의 go/no-go 충족 |

### 우선순위 산식

각 카드에 다음 점수를 붙인다.

```text
Priority = (첫 가치 도달 개선 + 반복 사용 개선 + 신뢰/안전 + 학습 가치) / 노력·회귀 위험
```

“예뻐 보인다”만으로는 낮고, 첫 알까지 시간을 줄이거나 반복 채움을 늘리거나 관계 기억을 강화하면 높다. Critical/High 안전 문제는 산식 밖에서 즉시 처리한다.

---

## 9) Risks & open questions

### 제품 리스크

1. **기능 풍부함이 첫 가치 도달을 늦출 수 있다.** 첫 세션에 리듬·보상·친구·릴레이를 모두 설명하지 말아야 한다.
2. **숙성이 동기 또는 마찰인지 아직 데이터가 없다.** `earlyFill`, strict 선택률, 리듬별 D7/D30을 봐야 한다.
3. **소셜 기능이 관계적 따뜻함과 비교 압박 사이를 오간다.** 친구 활동 숨김 설정을 유지하고 랭킹은 피한다.
4. **와이너리/바인/통계의 회고 가치가 중복될 수 있다.** 각각의 대표 질문을 명확히 해야 한다.
5. **게스트 OAuth가 체험과 계정의 경계를 흐릴 수 있다.** 실OAuth가 준비되면 fallback 정책을 재검토한다.

### 기술 리스크

1. **대형 client pages:** 홈/상세의 상태 결합도가 신규 기능의 회귀 반경을 키운다.
2. **다중 캐시 권위:** Zustand, module cache, page state, DB 사이 invalidate 누락 가능성.
3. **통합 테스트 공백:** authZ/cron/OAuth/CSRF는 단위 테스트만으로 충분하지 않다.
4. **서버리스 realtime:** SSE polling은 소규모에는 좋지만 성장 시 비용이 선형 증가한다.
5. **오프라인/위젯 동시성:** 현재 채움 pipeline을 우회하면 중복 스티커·보상 unlock 경쟁이 생긴다.
6. **문자열 상태:** 잘못된 상태가 DB에 들어갈 최종 방어선이 약한 도메인이 있다.
7. **업로드 개인정보:** 사진은 위치/기기 EXIF와 부적절 콘텐츠/비용 문제를 동시에 연다.
8. **운영 관측성:** 사용자가 “안 됐다”고 말했을 때 request 단위로 추적할 도구가 부족하다.

### 열린 질문 — 멈추지 않되 반드시 검증할 것

- 첫 사용자가 포도알의 핵심을 “습관 체크”, “귀여운 성취”, “친구와 함께” 중 무엇으로 설명하는가?
- 가입 후 첫 알까지 중앙값은 얼마이며 어느 생성 단계에서 이탈하는가?
- 숙성 override는 자유를 준다는 안도인가, 규칙이 귀찮다는 신호인가?
- 사용자는 완성 보드를 수확하는 의미와 와이너리로 이동하는 관계를 이해하는가?
- 메시지와 통합 알림함을 서로 다른 용도로 인식하는가?
- 한 사용자가 보통 몇 개 보드를 동시에 운영하며 홈 제스처를 발견하는가?
- `PlantedGift` 동일 position 다중 허용은 의도인가?
- 친구 A↔B 동시 요청의 DB/API 최종 정책은 무엇인가?
- 실제 OAuth provider가 이메일을 보장하지 않거나 기존 이메일과 충돌할 때 지원 정책은 무엇인가?
- PostHog, 오류 추적, push provider에서 허용할 데이터 최소 집합은 무엇인가?
- 네이티브 위젯의 원탭 채움은 soft cadence override를 어떻게 표현할 것인가?
- 유료 스킨이 없더라도 사용자가 계속 돌아오는가? 아니라면 수익화보다 코어 루프를 먼저 고쳐야 한다.

### 최종 오너 결론

포도알은 “무엇을 더 넣을까” 단계보다 “이미 만든 좋은 것 중 무엇이 사람을 돌아오게 하는가”를 증명할 단계다. 다음 한 달의 성공은 커밋 수가 아니라 다음 네 가지로 정의한다.

1. 실제 친구 베타가 돌았다.
2. 실제 기기에서 핵심 제스처와 완주가 깨지지 않았다.
3. 동의 기반 퍼널 데이터가 들어오기 시작했다.
4. 첫 알까지의 가장 큰 마찰 하나를 근거 있게 제거했다.

그 이후에야 위젯, 다크 모드, 스킨, 오프라인이라는 큰 투자에 순서를 매길 수 있다. 이 앱의 감정적 중심은 이미 좋다. 앞으로의 개발은 그 중심을 기능으로 덮지 않고, 더 빨리 발견되고 더 오래 기억되게 만드는 일이어야 한다.

