상태: 검증대기

## W3-social-hide: 홈 친구 소식 숨김 설정 (ABS-14 — 접근성 팩 선행분)

- 분류: 접근성/심리 안전(제안-3 채택) / 배정: **sonnet**
- 필독: `docs/PRINCIPLES.md` §5(UI), `CLAUDE.md` "Key Libraries" store.ts 행

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/home/page.tsx`

### 선반영 완료 (페이블 — 이 카드에서 손대지 말 것)
- `src/lib/store.ts`: `AppSettings.hideFriendFeed?: boolean`(기본 false) + `updateSettings` 경유 저장 가능 상태.

### 문제/배경
홈 하단 "친구 소식" 피드(P21: 남의 완성 소식에서 비교감 — 심리 안전 이슈)는 숨길 방법이 없다. 마음건강 세그먼트의 악화 트리거(PERSONA_REVIEW ABS-14).

### 스펙
1. **설정 허브**(`settings/page.tsx`): 링크 섹션과 앱 정보 사이에 "표시" 섹션(clay 카드) 추가 — 토글 행 1개: 라벨 "홈 친구 소식", 설명 "친구의 완성 소식을 홈에 보여줘요". 토글 = `settings.hideFriendFeed`의 **반전**(표시=on) — `/settings/sound` 페이지의 기존 토글 스위치 마크업 패턴을 모방(신규 토글 컴포넌트 발명 금지, sound 페이지는 읽기만).
2. 토글 변경 시 `updateSettings({ hideFriendFeed: ... })` + `feedbackTap()`.
3. **홈**(`home/page.tsx`): 친구 소식 섹션(`:861` 부근 `aria-label="친구 소식"`) 렌더 조건에 `!settings.hideFriendFeed` 추가. 숨김이어도 `/api/activity/friends` fetch는 그대로 둬도 무방(useCachedApi 구조 유지 — 조건부 훅 호출 금지).
4. 기본값(미설정)은 표시 — 기존 사용자 화면 무변화.

### 제약
- store.ts 수정 금지(선반영됨). localStorage 키 무변경. 데이터 내보내기 카드(W1)가 settings 페이지를 먼저 수정했으므로 **최신 파일 기준으로** 작업(섹션 순서: 링크 → 표시 → 데이터 → 앱 정보).

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- 코드 트레이스 로그: ①토글→store 경로 ②홈 조건부 렌더 좌표 ③조건부 훅 호출 없음 확인.

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**

### 검증 로그 (2026-07-08)

**정적 검증**
- `npx tsc --noEmit` → 에러 0건, 통과.
- `npm run lint` → `eslint .` 에러 0건(warning 22건은 전부 기존 `react-hooks/set-state-in-effect` — CLAUDE.md에 명시된 "앱이 의도적으로 fetch-on-mount 클라 렌더"라 warn 유지 대상, 이번 수정 파일 두 곳에서 신규로 늘어난 warning 없음) + `check-icons` 통과("모든 이모지가 플랫 SVG로 커버됨").

**코드 트레이스**
1. **토글→store 경로**: `src/app/(app)/settings/page.tsx:77-81` `Toggle` 컴포넌트(17-31행, `/settings/sound` 마크업 그대로 복제) → `onToggle={handleFriendFeedToggle}` → `handleFriendFeedToggle`(38-41행)이 `feedbackTap()` 후 `updateSettings({ hideFriendFeed: !settings.hideFriendFeed })` 호출 → `src/lib/store.ts`의 기존 `updateSettings`(미수정)가 `podoal-app-settings` 키(기존, 무변경)로 영속화. 토글 표시값은 `!settings.hideFriendFeed`(표시=on)로 스펙대로 반전.
2. **홈 조건부 렌더 좌표**: `src/app/(app)/home/page.tsx:62`에 `const settings = useAppStore((s) => s.settings);` 추가 → `home/page.tsx:865` `{!settings.hideFriendFeed && friendActivities.length > 0 && (` 로 "친구 소식" `<section aria-label="친구 소식">`(866행) 렌더 게이트. 기본값(hideFriendFeed=false) 시 기존 노출 동작 무변화.
3. **조건부 훅 호출 없음 확인**: `useCachedApi('/api/activity/friends')` 호출(`home/page.tsx:664`)은 컴포넌트 최상위에 그대로 유지 — `settings.hideFriendFeed` 분기는 664행 이후 JSX 렌더 블록(865행)에만 관여하고 훅 호출 자체는 감싸지 않음. fetch는 숨김 상태에서도 계속 실행(스펙 3항 충족).

**스펙 이탈**: 없음. 소유 파일(`settings/page.tsx`, `home/page.tsx`) 외 수정 없음(`git status`로 확인 — store.ts/globals.css/ROADMAP.md 등 트리에 보이는 변경분은 본 작업 이전부터 있던 타 카드 소관이며 이번 세션에서 건드리지 않음). 커밋/dev 서버 기동 없음.

**페이블 검수 보정 (2026-07-08)**: 복제된 Toggle 마크업이 sound 페이지 레거시의 `transition-all`을 신규 코드로 반입 — REVIEW_CHECKLIST 게이트 3(신규 diff 한정) 위반이라 `transition-colors`(트랙)/`transition-[left]`(노브)로 페이블이 직접 교체. 카드 스펙("모방")과 게이트가 충돌한 지점 — 이후 카드는 "모방하되 transition-all은 속성 명시로 치환" 관례.
