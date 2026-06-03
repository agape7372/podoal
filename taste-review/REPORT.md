# 포도알(newal) 앱 전체 Taste 리뷰 리포트

> **방법론**: [taste-skill v2](https://github.com/Leonxlnx/taste-skill) (`design-taste-frontend` + `redesign-existing-projects` + `high-end-visual-design`)
> **범위**: 앱 전체 시각/UX 레이어 9개 표면, ~90개 컴포넌트·페이지 파일 (데이터 레이어 `/api`·prisma·auth 제외 — 시각 리뷰)
> **방식**: 9개 병렬 audit 에이전트 → 의도된 결정(`CLAUDE.md`) 대조 자기검증 → 오케스트레이터 교차검증·중복제거
> **중요**: 본 리뷰는 **보고 전용**입니다. 코드는 한 줄도 수정하지 않았습니다.
> **생성일**: 2026-06-03

---

## 0. 한 줄 결론

> **포도알은 "AI가 안 만드는" 디테일(보라-웜 그림자·포도알 인터랙션·Maru Buri 타이포)이 살아있는, 의도가 분명한 잘 만든 리디자인입니다.** raw 90개 지적은 실제로는 **~12개 고유 이슈**로 수렴하고, 그중 **7개가 "기반에서 한 번 고치면 전 화면에 적용되는" 시스템 이슈**입니다. 미적 방향을 바꿀 필요는 없고, **접근성(포커스 링·대비·줌)과 상태 사이클(에러)·토큰 정합성**만 메우면 완성도가 한 단계 올라갑니다.

**앱의 다이얼 프로필** (taste-skill 기준, 9개 표면 평균):
`DESIGN_VARIANCE ≈ 5 · MOTION_INTENSITY ≈ 6 · VISUAL_DENSITY ≈ 5`
→ 차분하고 적당히 살아있는 중밀도 소비자 제품 앱. 습관 트래커로서 적합한 균형. (랜딩처럼 과한 variance/motion이 필요 없음)

**집계**: 총 90건 (🔴 high 32 · 🟡 medium 33 · 🟢 low 25) · 이 중 11건은 `CLAUDE.md`의 의도된 결정에 닿아 있어 "토큰/문서 드리프트 또는 톤 제안"으로 약하게 분류.

---

## 1. 먼저, 잘 하고 있는 것 (Strengths)

taste-skill이 "보상해야 한다"고 명시한 항목들을 이 앱은 이미 실천하고 있습니다. 리뷰의 목적은 이 강점을 무너뜨리지 않으면서 구멍을 메우는 것입니다.

| 강점 | 근거 |
|------|------|
| **보라-웜 그림자 틴트** (`rgba(73,50,100,X)` / `--shadow-tint`) — "AI가 안 만드는" 최대 시그니처 | clay-* 토큰·boxShadow 스케일 전반에서 검정 그림자 회피 |
| **포도알 인터랙션 시스템** | jelly-pop+juice-rise+flash가 transform/opacity만 사용 + **전용 reduced-motion** + 옵티미스틱 채움(temp→서버 reconcile→롤백) + 차분한 인라인 에러 |
| **진짜 타이포 위계** | Maru Buri(`font-display`)를 H1/H2/큰 숫자에만 한정, 본문 Noto Sans KR, weight 500/600/700 활용, 음수 트래킹 |
| **shape-matched 스켈레톤** | 소셜/게임화/모달 리스트는 최종 카드 형태에 맞춘 스켈레톤(맨 스피너 아님) |
| **연출된 빈 상태** | Podo 마스코트 + "어떻게 채우는지" CTA가 있는 empty state |
| **concentric radii + double-bezel 깊이** | 컨테이너보다 안쪽이 타이트(clay 24 → input 14), inset 흰 하이라이트 코어 |
| **spring 이징** | `cubic-bezier(0.16,1,0.3,1)` / `(0.34,1.56,0.64,1)` — linear/ease-in-out 회피, CSS에 출처까지 주석 |
| **일러스트 a11y 위생** | 장식 SVG는 `aria-hidden`, 의미있는 Podo는 `role=img`+한글 aria-label로 정확히 분리 |
| **z-index 사다리 준수** | Nav 50 > FAB 40 > Install 30, modal 90 — 코드에서 실제 지켜짐 |
| **board `error.tsx` 경계** | 마스코트+차분한 카피+복구 버튼 2개(다시 시도/홈으로) — AI가 흔히 빠뜨리는 것 |

---

## 2. 근본 원인 (Root Causes) — 우선순위순

90개 중복을 제거하면 아래 12개로 수렴합니다. **P0 4개 + P1 5개는 대부분 `globals.css`/`tailwind.config.ts`/`layout.tsx` 한 곳 수정으로 전 화면이 해결됩니다.**

### 🔴 P0 — 기반 한 곳 수정 = 앱 전체 해결

#### R1. 키보드 포커스 표시(`:focus-visible`)가 어디에도 없음 — **8개 표면**
- **근본**: `globals.css`의 `.clay-button`(L142–160)에 `:hover`/`:active`만 있고 `:focus-visible` 없음. 전역 규칙도 없음. `.clay-input`은 `outline:none`(L233) 후 :focus에서 border-color만 살짝 바꿈(거의 안 보임).
- **영향**: ClayButton, 하단 Navigation 탭, 홈 FAB, 필터 칩, WineBottle(`focus:outline-none`로 명시 제거), 모달의 모든 이모지/요일/탭 버튼, 토글, 카드 — 키보드/스위치 사용자는 "지금 어디에 포커스가 있는지" 전혀 볼 수 없음.
- **한 곳 수정**: `globals.css`에 전역 `:focus-visible` 규칙 1개 추가. 이미 있는 `grape-glow` 토큰(`0 0 0 4px rgba(155,126,216,0.15)`)을 포커스 링으로 재사용하면 브랜드 톤도 유지.

#### R2. `prefers-reduced-motion`이 grape-* 에만 적용됨 — **9개 표면 전부**
- **근본**: `globals.css` L404–413 reduced-motion 블록이 `.grape-next/.grape-jelly-pop/.grape-juice/.grape-flash`만 정지. 나머지 무한·진입 애니는 무방비: `.animate-float`(L590), `.reward-glow`(L506, 무한), `.wine-bottle-shimmer`(L578, 무한), `.skeleton` shimmer(L528, 무한), `.confetti-particle`(L481), `.popup-enter`, `.capsule-open`, `.animate-fade-in`, Tailwind `animate-pulse/bounce-in/spin`.
- **영향**: 환영 화면 마스코트가 무한히 까딱거림, 리워드 글로우·스켈레톤·진행바 shimmer·릴레이 펄스·로딩 스피너 모두 모션 민감 사용자에게 계속 재생.
- **한 곳 수정**: L404 블록에 위 클래스들을 추가하거나, `motion-safe:` 프리픽스 전략 + 전역 `@media (prefers-reduced-motion: reduce){ *,*::before,*::after{ animation-iteration-count:1 } }` 백스톱.

#### R3. 기반 텍스트 토큰의 대비(WCAG AA) 미달 — **8개 표면**
- **근본 (토큰 레벨)**:
  - `.clay-input::placeholder` = `--warm-sub #6E6680` + `opacity:0.5` → 합성 ≈ `#B6B2BF` ≈ **2.1:1** (기준 4.5:1). 회원가입의 "8자리 이상" 같은 정보성 힌트가 placeholder에만 있음.
  - `warm-light #A89FB8`를 본문/캡션/타임스탬프에 사용 → 흰 배경 ≈ **2.6:1**. (messages/friends/vine/settings/notifications/winery 전반)
  - `grape-400 #C9A8E8`(템플릿 "N알"), `grape-500 #B28CDC`(홈 FAB의 흰 "+", ≈ **2.1:1**)를 흰 위 텍스트/아이콘으로 사용 → 3:1 미달.
  - 부수: `green-500` 성공 텍스트(~2:1), capsule `blue-300/400` on blue-50, GrapeSticker 인덱스 `warm-light/40`(≈1.2:1, 사실상 안 보임).
- **한 곳 수정**: placeholder의 `opacity:0.5` 제거 + 전용 placeholder 토큰(≥4.5:1, 예 `#8A8298`), `warm-light`는 **비텍스트 장식 전용**으로 강등하고 캡션용 어두운 토큰 신설. 컬러형 전경(FAB)은 `grape-600 #9970C8`(~3.0:1) 이상으로.

#### R4. 핀치 줌 차단 (`userScalable:false`, `maximumScale:1`) — **앱 전체**
- **근본**: `src/app/layout.tsx` viewport(L10–16). 저시력 사용자가 텍스트를 확대할 수 없음 → **WCAG 1.4.4 (Resize Text) 직접 위반**. R3의 얇은 대비와 곱해져 가독성 악화.
- **한 곳 수정**: `userScalable:false` 제거, `maximumScale ≥5`. iOS 입력 포커스 줌이 목적이라면 입력 `font-size`를 15→**16px**로 올리는 정공법으로 대체(이미 clay-input 15px).

### 🟡 P1 — 상태 사이클 · 시맨틱 · 퍼포먼스

#### R5. 파괴적 액션에 네이티브 `window.confirm()` 사용
- board 삭제(`board/[id]/page.tsx` L145), 친구 삭제/거절(`friends/page.tsx` L61). taste-skill이 `window.alert`과 함께 금지하는 OS 블로킹 다이얼로그 — claymorphism 톤·포커스 트랩·스타일링 전부 깨짐. 이미 in-app 모달 시스템(z-[90])이 있으므로 그걸 재사용.

#### R6. 에러 상태 누락 — 에러가 "빈 상태"로 위장
- `home/friends/messages/relay/vine/winery/stats`가 fetch 실패를 `catch(()=>{})`로 삼키고 빈 배열 렌더 → **네트워크 실패와 진짜 빈 목록이 구별 불가, 재시도 없음**.
- `CheerModal`/`GiftBoardModal`은 `handleSend`에 try/catch/finally 없음 → 전송 실패 시 모달이 **'잠시만요…' 로딩에 멈춤**. (반대로 `friends/[id]`·notifications·CapsuleModal은 에러 처리를 제대로 함 → 내부 비일관)
- **수정**: `friends/[id]`의 에러 패턴(차분한 인라인 패널 + "다시 불러오기")을 누락 화면에 이식, 모달 send를 try/finally로 감싸기.

#### R7. 로딩이 이모지/맨 막대 — 최종 형태에 맞는 스켈레톤 아님
- board 상세 로딩 = 떠다니는 🍇(`board/[id]/page.tsx` L157–166), 홈/와이너리 = 균일 막대. `.skeleton` 유틸은 있는데 핵심 화면에서 미사용 → 데이터 도착 시 레이아웃 점프. (소셜/모달은 잘함)

#### R8. 비시맨틱 인터랙티브 요소 (div-soup) — **공유 프리미티브에서 전파**
- `ClayCard` onClick 시 `<div>` + onClick (role/tabIndex/keydown 없음) — **공유 컴포넌트라 카드-as-버튼 전체에 전파**. (BoardCard는 `<button>`으로 올바름 → 내부 비일관)
- settings 토글: `role=switch`/`aria-checked` 없음, on/off가 색·위치로만 표현.
- stats 탭: `role=tablist/tab` 없음. Heatmap 셀: `<div title>`만 → 90일 데이터가 키보드/SR에 안 보임.
- 페이지 루트가 `<main>/<header>` 없는 `<div>` (스킵-투-콘텐츠 타깃 부재), 제목 이모지(💌/👥/🌿/🔗) `aria-hidden` 없이 SR이 읽음, 아이콘 버튼 `aria-label` 누락(FriendCard는 `title=`만).

#### R9. 비-compositor 속성 애니메이션 (퍼포먼스)
- `.reward-glow`가 **box-shadow를 무한 애니**(L493, taste-skill 명시 금지 — 매 프레임 repaint). 릴레이 진행바가 `width`(`transition-all`) 애니. `.skeleton`이 `background-position` 애니. → `transform`/`opacity`로 재구현(글로우는 블러 의사요소 opacity, 진행바는 `scaleX`).

#### R10. 폰트를 CSS `@import` + jsdelivr CDN으로 로드 (퍼포먼스)
- `globals.css` L5 Noto Sans KR `@import`(렌더 블로킹, 6 weight CJK 대용량) + L8–28 MaruBuri를 `cdn.jsdelivr.net/gh/...`에서 로드. `next/font` 미사용 → 자가호스팅·size-adjust·서브셋 없음 → LCP/CLS 리스크 + 핵심 브랜드 자산이 외부 CDN 의존. (덤: `@import`가 `@tailwind` **뒤**에 있어 사양상 무시될 위험 → 검증 필요)

### 🟢 P2 — 토큰 정합성 & 코드 위생 (대부분 "문서/토큰 드리프트", 미적 오류 아님)

#### R11. 컬러 토큰 드리프트 (단일 진실원천 부재)
- **그림자 틴트 2종 공존**: `globals.css --shadow-tint: 47,42,63`(=warm-text RGB) vs `tailwind.config boxShadow rgba(73,50,100,X)`. `.clay` 클래스와 `shadow-clay*` 유틸을 섞으면 미묘하게 다른 보라. 시그니처 디테일이라 더 아쉬움.
- **"브랜드 퍼플" 3종**: 문서 `#9B7ED8` ≠ `grape-500 #B28CDC` ≠ `--grape-primary #DCC4F2`. 게다가 `winery/page.tsx` L91이 `#9B7ED8`을 인라인 하드코딩(3번째 값).
- **문서상 juice/leaf/sunshine 팔레트가 토큰에 실재하지 않음** (legacy `lime-*`만 잔존). 이걸 참조하는 클래스는 조용히 undefined가 됨.
- **ad-hoc 색**: `gray-100/200/300`, `green-500`, `blue-400/50`, `amber-50`, capsule `blue/cyan` — 따뜻한 role 팔레트(grape/juice/leaf/sunshine) 밖. `joyful` 그라데가 3곳에서 제각각(`grape-300→lime-300` vs `grape-500→lime-300` vs 문서 `grape-500→juice-400`).
- **검정 그림자 잔재**: `.grape-empty`·mini 변형(`rgba(0,0,0,X)`), ReminderModal 선택 요일 `shadow-md`, winery `bg-gray-100` 미래 노드.
- **방향**: 미적 결정이 아니라 **문서·토큰을 한 진실원천으로 정렬**하는 작업. `CLAUDE.md`도 함께 갱신해야 함(현재 stale).

#### R12. 코드 위생 & 마감
- `.grape-filled` **중복 정의**(L179, L264) — 두 번째가 box-shadow/background를 덮어써 첫 블록의 검정 그림자는 dead code, border-radius는 소스 순서에 의존(취약).
- **Podo/일러스트 SVG 그라데이션 ID 충돌** — `uid`가 `variant`에만 의존. 같은 화면에 default Podo 2개(환영 hero + InstallPrompt 칩) 마운트 시 `podo-grape-default` 중복 ID → 브라우저가 첫 정의로 해석해 **fill이 깨질 수 있는 실제 버그**. `useId()`로 인스턴스 고유화 필요. (CloudPuff/Sun/VineLeaf/WaterDrop/GrapeStem 동일)
- **dead code**: `Star.tsx/Heart.tsx/Sun.tsx` 어디서도 import 안 됨(문서 인벤토리에도 Star/Heart 없음).
- `BoardCard` 진행률 `filled/total`이 total=0 시 `NaN%` (가드 없음).
- **tabular-nums 미적용** — 카운터·진행 분수(`3/5`)가 비례숫자라 값 변동 시 흔들림.
- **카드 남용** — stats 8개 동일 가중 clay-sm 타일, board "최근 활동" 로그 행마다 clay-sm 카드(elevation이 위계를 전달 안 함 → divide/여백으로).
- **탭 타깃 <44px** — 환영 모드전환/뒤로 버튼(`py-1`), MessagePopup 닫기(`p-1`).
- **성공/빈 카피의 느낌표 과다**(톤 제안, 의도된 브랜드 카피는 불변) — '친구 요청을 보냈어요!', '최고 등급 달성!' 등.
- **Heatmap level-0 vs level-1** 거의 구별 불가(`gray-100` vs `grape-100 #F4ECFB`), 색에만 의존.

---

## 3. 표면별 요약

| # | 표면 | 다이얼 (V/M/D) | 🔴 | 🟡 | 🟢 | 가장 큰 이슈 |
|---|------|:---:|:--:|:--:|:--:|------|
| 1 | 디자인 시스템 기반 | 5/7/4 | 4 | 3 | 3 | focus-visible·placeholder 대비·reduced-motion·줌차단 (전부 전파원) |
| 2 | 환영/로그인 (랜딩성) | 4/5/5 | 3 | 4 | 2 | 마스코트 float reduced-motion, placeholder 대비, 포커스 링, 로그인 에러 시맨틱 |
| 3 | 핵심 컴포넌트 | 5/4/6 | 4 | 3 | 3 | ClayCard div-onClick(전파), 포커스 링, placeholder, InstallPrompt reduced-motion |
| 4 | 포도알 핵심 경험 | 5/7/6 | 4 | 4 | 2 | reward-glow box-shadow, 로딩=이모지, board 삭제 confirm(), WineBottle 포커스 |
| 5 | 소셜 | 6/5/5 | 5 | 4 | 2 | warm-light 캡션 대비, fetch 에러 삼킴, 친구삭제 confirm(), FAB 대비, 포커스 |
| 6 | 게임화/설정 | 5/6/6 | 4 | 3 | 4 | 토글 시맨틱(role=switch), 포커스 링, warm-light 대비, winery/stats 에러 백지 |
| 7 | 모달/리워드 | 5/7/5 | 4 | 4 | 3 | Cheer/Gift 에러 시 멈춤, 포커스, reduced-motion, placeholder, capsule blue 대비 |
| 8 | 마스코트/일러스트 | 4/3/3 | 2 | 3 | 2 | **SVG 그라데 ID 충돌(실버그)**, 마스코트 float reduced-motion, dead code |
| 9 | 전역 일관성 | 5/7/5 | 2 | 5 | 4 | 그림자 틴트 2종, 브랜드 퍼플 3종, 중복 .grape-filled, ClayCard div |

---

## 4. 권장 처리 순서 (적용 시 — 지금은 보고만)

taste-skill의 "fix priority"(낮은 리스크·높은 임팩트 순)에 맞춘 제안:

1. **`globals.css`에 전역 `:focus-visible` 링 1개 추가** → R1 (8개 표면 한 번에)
2. **reduced-motion 블록 확장** (또는 `motion-safe:` 전환) → R2 (9개 표면)
3. **텍스트 토큰 대비 교정** (placeholder opacity, warm-light 강등, FAB/grape 텍스트 단계 상향) → R3
4. **viewport 줌 허용** → R4 (1줄)
5. **에러 상태 패턴 이식** (`friends/[id]` 패턴 + 모달 try/finally) + `confirm()` → in-app 시트 → R5·R6
6. **컬러/그림자 토큰을 단일 진실원천으로 정렬 + `CLAUDE.md` 갱신** → R11
7. **SVG ID `useId()` 고유화, 중복/dead code 정리, NaN 가드, tabular-nums** → R12
8. **로딩 스켈레톤 shape 매칭, 카드 남용 완화, 시맨틱(toggle/tab/heatmap/landmark)** → R7·R8

> 1–4는 거의 전부 기반 파일 소규모 수정이고 미적 변화가 없습니다(리스크 최소·임팩트 최대). 5–8은 화면별 작업이지만 패턴이 이미 앱 안에 존재(friends/[id], BoardCard 버튼, CapsuleModal 에러)하므로 "복제 적용"에 가깝습니다.

---

## 5. 방법론 & 한계 (정직 고지)

- **taste-skill은 본래 랜딩/포트폴리오용**이고 대시보드·멀티스텝 제품 UI는 대상 아님이라고 스스로 명시합니다. 그래서 본 리뷰는 **redesign-skill의 audit 체크리스트 + soft-skill 원칙 + taste-skill의 보편 하드룰(대비/모션/상태/그림자/일관성)**을 주축으로 적용하고, **랜딩 전용 룰(hero 스택·eyebrow 카운트·로고월)은 환영/로그인 화면에만** 적용했습니다.
- `CLAUDE.md`의 **의도된 결정(보라-웜 그림자·이모지 내비·Maru Buri·한글 카피 불변·claymorphism·수제 일러스트)은 문제로 잡지 않았습니다.** 다만 의도에 닿는 11건(느낌표 톤, ad-hoc 색, joyful 그라데, 브랜드 퍼플)은 "토큰/문서 드리프트 또는 톤 제안"으로 약하게 표시했습니다 — 채택은 선택.
- **대비 수치(2.1:1 등)는 에이전트의 추정치**입니다. 적용 전 실제 렌더 색으로 contrast checker 재측정을 권장합니다(특히 그라데이션·반투명 배경 위).
- **자동 정적 분석**이라 동적 상태(실데이터 로딩·키보드 탭 순서·실제 SR 출력)는 미검증입니다. 상위 항목은 적용 시 실제 기기/AT로 확인 필요.
- 데이터 레이어는 의도적으로 보지 않았습니다(시각 리뷰 한정).

---

*전체 90개 항목의 인터랙티브 필터링 버전은 같은 폴더의 `preview.html`을 브라우저로 열어 확인하세요.*
