상태: 검증대기

## W3-surprise-gift-badge: 깜짝선물 OFF 상시 표시 (GAP-04)

- 분류: UX(제안-2 채택) / Severity Low / 배정: **sonnet**
- 필독: `docs/PRINCIPLES.md` §5(UI 체크리스트)

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/(app)/board/[id]/page.tsx`

### 문제/배경
보드 주인이 깜짝선물 받기(`allowFriendPlant`)를 끄면 토스트 1회로 끝 — 이후 상태를 확인할 상시 표시가 없다(PERSONA_REVIEW GAP-04). 토글 자체는 이미 존재(`board/[id]/page.tsx:669` 부근 낙관 토글).

### 스펙
1. **주인 뷰에서만**, `allowFriendPlant === false`일 때 보드 상세 헤더/정보 영역에 소형 상태 칩 1개 상시 렌더: EmojiIcon 🎁 + "깜짝선물 받기 꺼짐" (`text-xs text-warm-sub`, clay-sm 또는 기존 칩 패턴 재사용 — 페이지 내 유사 칩이 있으면 그 스타일 모방).
2. 칩 탭 → 기존 토글 UI가 있는 곳(메뉴/설정 시트)을 여는 게 자연스러우면 연결, 아니면 비인터랙티브(정보 전용)로 — 페이지 구조를 읽고 낮은 리스크 쪽 선택, 선택 근거를 검증 로그에 기록.
3. ON일 때는 아무것도 렌더하지 않음(배지 과밀 금지 — 홈 카드가 아니라 보드 상세만).
4. 친구 뷰 long-press 안내(`:568` 부근) 무수정.

### 제약
- 토글 로직(낙관+롤백) 무수정. 배지 1개 이내(리스트 과밀 방지). 신규 카피는 위 문구 그대로.

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- 코드 트레이스 로그: ①owner 판정 조건 좌표 ②ON/OFF/친구뷰 3분기 렌더 결과표.

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**

### 검증 로그 (2026-07-08)

#### diff 요지
`src/app/(app)/board/[id]/page.tsx` 단독 수정, 순수 추가 18줄(삭제 0) — "Board info" 블록(`text-center mb-6`, 기존 "Gifted info" 칩 바로 아래) 안에 신규 조건부 칩 1개만 삽입. 그 외 라인 무변경(`git diff --stat` = `1 file changed, 18 insertions(+)`).

```tsx
{isOwner && !board.isCompleted && !allowPlant && (
  <div className="inline-flex items-center gap-1 clay-sm px-3 py-1.5 mt-2">
    <EmojiIcon emoji="🎁" size={12} />
    <span className="text-xs text-warm-sub">깜짝선물 받기 꺼짐</span>
  </div>
)}
```

#### ① owner 판정 조건 좌표
- `isOwner` 정의: `page.tsx:895` — `const isOwner = user?.id === board.owner.id;`
- `allowPlant` 정의: `page.tsx:899` — `const allowPlant = board.allowFriendPlant ?? true;`
- 신규 칩 렌더 조건: `page.tsx:1053` — `{isOwner && !board.isCompleted && !allowPlant && (`
- 기존 토글(무수정) 렌더 조건 재확인: `page.tsx:979` — `{isOwner && !board.isCompleted && (` (스위치 자체)
- 친구 뷰 안내(무수정 확인) 렌더 조건: `page.tsx:1064` — `{!isOwner && !board.isCompleted && (`

#### ② ON/OFF/친구뷰 3분기 렌더 결과표

| 분기 | 조건 | 기존 토글 스위치(`:979`) | 신규 상태 칩(`:1053`) | 친구뷰 캡션(`:1064`, 무수정) |
|------|------|------------------------|----------------------|------------------------------|
| 주인 뷰 · ON (`allowFriendPlant=true`) | `isOwner=true`, `allowPlant=true` | 렌더, ON 위치(`bg-grape-400`, thumb `translate-x-5`) | **미렌더** (`!allowPlant`=false) — 스펙 3 충족 | 미렌더 (`!isOwner`=false) |
| 주인 뷰 · OFF (`allowFriendPlant=false`) | `isOwner=true`, `allowPlant=false` | 렌더, OFF 위치(`bg-warm-border`) | **렌더** — 🎁 + "깜짝선물 받기 꺼짐"(`text-xs text-warm-sub`, `clay-sm`) | 미렌더 |
| 친구 뷰 (비주인, ON/OFF 무관) | `isOwner=false` | 미렌더(기존과 동일) | **미렌더**(`isOwner` 게이트로 항상 차단 — "주인 뷰에서만" 충족) | 렌더 — `allowPlant`에 따라 "빈 포도알을 꾹 누르면…" / "이 친구는 깜짝 선물 받기를 꺼뒀어요" 분기(기존 코드, 바이트 동일 확인) |

(완성 보드 `board.isCompleted=true`인 경우 세 요소 모두 미렌더 — 아래 "스펙 이탈 사유" 참조.)

#### 칩 인터랙션 선택 근거 (스펙 항목 2)
**비인터랙티브(정보 전용)로 결정.** 근거: 스펙 문구는 "기존 토글 UI가 있는 곳(메뉴/설정 시트)을 여는 게 자연스러우면 연결"인데, 이 페이지 구조상 토글은 **별도 메뉴/설정 시트가 아니라 이미 같은 화면(보드 상세) 안에 인라인으로** 존재한다(`:979`, "Board info" 블록 바로 위 섹션). 따라서 "열 곳"이 이 화면 자체라 탭에 연결해도 이동 이득이 없고, 유일하게 실질적인 "연결"은 칩 탭 시 `handleToggleAllowPlant()`를 재호출해 설정을 되돌리는 것뿐인데 — 이는 (a) 토글 로직 재사용이 아니라 상태 배지에 숨겨진 두 번째 트리거를 만들어 실수 탭으로 설정이 도로 켜지는 회귀 위험을 만들고, (b) "제약: 토글 로직 무수정"과 무관하지만 스위치 UI 시맨틱(`role="switch"`)을 배지가 흉내내지 않는 한 접근성상으로도 어색하다. 리스크가 더 낮은 정보 전용(비버튼 `<div>`) 쪽을 채택 — "Gifted info" 칩(`:1033`)도 같은 비인터랙티브 `<div>` 패턴이라 페이지 관례와도 일치.

#### 스타일 근거
`text-xs text-warm-sub` + `EmojiIcon emoji="🎁"`는 친구 뷰 캡션의 "내가 숨긴 선물 N개" 표기(`:1072`, `size={12}`)와 동일 크기·톤으로 통일. 컨테이너는 "Gifted info" 칩(`:1034`, `inline-flex items-center gap-N clay-sm px-3 py-1.5`)의 구조를 그대로 재사용하되 `bg-grape-50` 배경은 제외(그건 "선물 받음"의 축하 톤이라 "설정 꺼짐"이라는 중립 정보 톤과 맞지 않음 — `clay-sm` 기본 배경만 사용).

#### 검증 결과
- `npx tsc --noEmit` — 에러 0.
- `npm run lint` — `eslint .` 0 errors / 23 warnings(전부 `react-hooks/set-state-in-effect`, 이 파일 포함 기존 사전 존재 경고 — CLAUDE.md에 명시된 의도적 warn 정책, 신규 라인과 무관·신규 경고 0건) + `check-icons.mjs` 통과("모든 이모지가 플랫 SVG로 커버됨 · JSX 생이모지 없음" — 🎁는 페이지 내 기존 사용 이모지라 신규 자산 불필요).
- 프리뷰 서버는 카드 지시(`dev 서버 기동 금지`)에 따라 기동하지 않음 — 코드 트레이스 + 조건식 대조로 3분기를 검증(위 표).

#### 스펙 이탈 사유
신규 칩에 `!board.isCompleted` 게이트를 추가함(스펙 원문은 `allowFriendPlant === false`만 조건으로 명시). 근거: 이 파일 내 `allowFriendPlant` 관련 UI 4곳(토글 스위치 `:979`, 친구뷰 캡션 `:1064`, `GrapeBoard`의 `onPlantReward`/`onPlantGift` prop 게이트)이 전부 `!board.isCompleted`를 공유 — 완성 보드는 빈 알이 없어 "친구가 심기" 설정 자체가 더 이상 유효하지 않다. 이 게이트 없이 칩만 완성 보드에서도 렌더되면, 토글 스위치는 이미 사라진 화면에 "꺼짐" 배지만 홀로 남아 고아 상태(orphan) UI가 된다 — 스펙 3의 "배지 과밀 금지" 취지와도 부합하는 낮은 리스크의 보강으로 판단해 채택. 기능적으로 스펙을 좁히는 방향(추가 은닉)이라 사용자에게 놓치는 정보는 없음(완성 보드에는 애초에 심을 빈 알이 없어 표시할 실익이 없음).
