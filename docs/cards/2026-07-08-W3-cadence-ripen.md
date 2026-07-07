상태: 검증대기

## W3-cadence-ripen: 채움 텀 C1 — 숙성 연출 + 소프트 가드 (탭 앞단 판정)

- 분류: 기능(백로그 "채움 텀" C1 슬라이스 2/2) / 배정: **sonnet**
- 필독: `docs/FILL_CADENCE_PLAN.md` §1·§3·§4·§8·§10, `docs/PRINCIPLES.md` §5·§6(낙관적 채우기 행), `CLAUDE.md` Motion·Modal 규약

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/lib/dayBoundary.ts` (신규)
- `src/lib/cadence.ts` (신규)
- `src/components/GrapeBoard.tsx`
- `src/components/GrapeSticker.tsx`
- `src/components/RipeningSheet.tsx` (신규)
- `src/app/(app)/board/[id]/page.tsx`

### 선반영 완료 (페이블 — 이 카드에서 손대지 말 것)
- `globals.css`: `.grape-ripening` 클래스(청록→보라 전이는 CSS 변수 `--ripen-p` 0~1 소비) + 키프레임 준비 완료 — 클래스와 변수만 쓰면 된다.
- 서버: `POST /api/boards/[id]/stickers`가 body `earlyFill: true`를 수용해 Sticker.earlyFill로 기록(200 정상 채움 — 403/409 아님).
- W2-cadence-create 카드로 board GET 응답에 `cadenceType`·`cadenceN` 존재.

### 문제/배경
C1 핵심 장치: 텀이 있는 보드에서 오늘 몫을 다 채우면 다음 알이 "익는 중"이 된다. 잠그지 않는다 — 탭하면 안내 시트가 뜨고 "그래도 채우기"로 오버라이드 가능(earlyFill 기록만). FILL_CADENCE §1.5: **판정은 탭 허용 앞단에서만** — `mergeServerBoard`·`applyFillResult`·낙관 큐·`isJustFilled` 600ms 창은 절대 무수정.

### 스펙
1. **`src/lib/dayBoundary.ts`** (신규, 순수 함수 — 경계 함수의 단일 유틸, 이중 구현 금지의 기점):
   - `dayStart(now: Date, resetHour?: number): Date` — 로컬 자정+resetHour(기본 0). now가 resetHour 이전이면 전날 귀속.
   - `nextDayStart(now, resetHour?)`, `weekStart(now, resetHour?)`(월요일 시작, 로컬), `nextWeekStart(now, resetHour?)`.
   - C1은 기기 로컬 시간 사용(User.timezone 서버 판정은 C2). 전 함수 JSDoc에 "C2에서 서버 판정과 통일 예정" 명시.
2. **`src/lib/cadence.ts`** (신규): `computePaceState(board: { cadenceType?: string; cadenceN?: number | null }, stickerTimes: Date[], now: Date)` →
   `{ ripe: boolean; quota: number; used: number; nextRipeAt: Date | null; progress: number } | null`
   - cadenceType 없음/`'FREE'` → **null** (호출측은 null이면 현행 동작 그대로 — 회귀 0의 계약).
   - DAILY_1: quota=1, 기간=오늘(dayStart~nextDayStart). DAILY_N: quota=n. WEEKLY_N: quota=n, 기간=이번 주.
   - used = 기간 내 stickerTimes 개수. ripe = used < quota. nextRipeAt = ripe면 null, 아니면 다음 경계.
   - progress(익음 정도 0~1) = ripe면 1. 아니면 `(now - lastFillInPeriod) / (nextRipeAt - lastFillInPeriod)` clamp 0~1 (lastFillInPeriod = 기간 내 마지막 채움 시각).
3. **GrapeSticker**: optional props `ripening?: boolean; ripenProgress?: number` — ripening이면 클래스 `grape-ripening` 추가 + `style={{ '--ripen-p': ripenProgress }}`. 기존 클래스 조합 무변경.
4. **GrapeBoard**: optional props `paceState?: { ripe: boolean; progress: number } | null; onRipeningTap?: () => void` + **imperative 오버라이드 핸들**.
   - `handleFill` 최상단(낙관 반영·연출·onFill 이전)에 가드: 탭한 칸이 nextPosition이고 `paceState && !paceState.ripe`면 `onRipeningTap?.()` 호출 후 즉시 return (사운드·히트스톱 미발동).
   - **오버라이드 경로**: `forwardRef` + `useImperativeHandle`로 `fillNow(position: number)` 노출 — pace 게이트만 우회하고 나머지(연출·onFill 호출)는 `handleFill`과 동일 경로. 페이지가 시트의 "그래도 채우기"에서 호출한다(연출이 GrapeBoard 내부에 있으므로 우회 진입점이 필요).
   - isNext 칸에 `ripening={paceState ? !paceState.ripe : false}` `ripenProgress={paceState?.progress ?? 1}` 전달.
   - paceState 미전달(친구 뷰·기존 호출처) → 전부 기존 동작. ref 미사용 호출처 무영향.
5. **RipeningSheet** (신규, 공용 Modal sheet variant + `useModalClose`):
   - 제목: "아직 익는 중이에요" + 본문: nextRipeAt 기반 문구 — 같은 날이면 "오늘 몫은 다 채웠어요 · {시각}에 다시 익어요", 다음날이면 "내일 {아침/시각}이면 제철이에요", 주간이면 "다음 주가 되면 다시 익어요". 시각 포맷은 `toLocaleTimeString('ko-KR', { hour: 'numeric' })` 계열.
   - 버튼 2개: 주 버튼 "기다릴게요"(requestClose) + 보조 텍스트 버튼 "그래도 채우기"(onOverride 콜백). 질책 문구 금지(§1 처벌 금지).
6. **board/[id]/page.tsx**:
   - board 데이터에서 `computePaceState` 계산(스티커 filledAt 사용, now는 탭/렌더 시점 — react-hooks/purity 위반 없게 이벤트 핸들러/메모 시점에서 취득).
   - GrapeBoard에 paceState·onRipeningTap 전달(**owner 뷰에서만** — canFill과 동일 조건).
   - onRipeningTap → RipeningSheet 오픈. "그래도 채우기" → 시트 닫고 ①페이지의 `earlyPositionsRef`(Set)에 해당 position 기록 ②GrapeBoard ref의 `fillNow(position)` 호출. `postFillSticker`는 전송 직전 `earlyPositionsRef`에 있으면 POST body에 `earlyFill: true` 동봉 후 해당 position 제거 — 함수 시그니처 변경 없이 ref로 배관(낙관 큐 코드 무수정 원칙).
   - 오버라이드 채움도 정상 채움과 동일 연출·낙관 경로(차이는 body 플래그뿐).
7. 채움 성공 후 paceState 재계산으로 다음 알이 즉시 "익는 중"으로 전환되는 흐름 확인(quota 소진 시).

### 제약
- `src/lib/boardFillState.ts` 수정 금지(소유 밖). `mergeServerBoard`·`applyFillResult`·롤백 경로·`isJustFilled` 창 무수정.
- 신규 키프레임 추가 금지(선반영 CSS만 소비). `transition-all` 금지. `window.confirm` 금지.
- 신규 카피는 위 문구 그대로. 릴레이/선물 보드는 cadenceType이 FREE라 자동 비활성 — 별도 분기 금지.

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- `scripts/repro/cadence-check.mjs` 신규 작성(소유 허용): dayBoundary·computePaceState 경계 케이스 assert — ①DAILY_1 오늘 1알 채움→ripe false·nextRipeAt=내일 0시 ②자정 직전/직후 ③WEEKLY_N 주 경계 ④FREE→null ⑤progress 단조증가. `node scripts/repro/cadence-check.mjs` 통과 로그 첨부. (tsx 임포트가 필요하면 npx tsx 사용.)
- 적대 검증 각도 2개 이상 기록(PRINCIPLES §10 — 권장: 경합[시트 열린 채 큐 드레인]·경계값[totalStickers 마지막 알]).

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**

### 검증 로그 (2026-07-08)

**수정/신규 파일**
- `src/lib/dayBoundary.ts` (신규) — `dayStart`/`nextDayStart`/`weekStart`/`nextWeekStart`, 전 함수 JSDoc에 "C2에서 서버 판정과 통일 예정" 명시.
- `src/lib/cadence.ts` (신규) — `computePaceState` + `PaceState` export. FREE/미지정/인식 못하는 cadenceType 전부 null(실패 열림).
- `src/components/GrapeSticker.tsx` — `ripening?`/`ripenProgress?` 추가, `isNext && ripening`일 때만 `grape-ripening` 클래스 + `--ripen-p` 인라인 스타일. 기존 클래스 조합 무변경.
- `src/components/GrapeBoard.tsx` — `forwardRef<GrapeBoardHandle, GrapeBoardProps>`로 전환, `paceState`/`onRipeningTap` props 추가, `handleFill` 최상단에 pace 가드(`opts.bypassPaceGate`로만 우회), `useImperativeHandle`로 `fillNow` 노출, isNext 셀에 ripening/ripenProgress 배선.
- `src/components/RipeningSheet.tsx` (신규) — 시트 UI. "기다릴게요"는 `requestClose`(이탈 애니), "그래도 채우기"는 `onOverride` 직접 호출(ConfirmDialog 확인 버튼과 동일 패턴 — 부모가 즉시 언마운트).
- `src/app/(app)/board/[id]/page.tsx` — `paceState`/`paceNow` state(effect에서 계산, `new Date()`는 effect 안에서만), `grapeBoardRef`/`earlyPositionsRef`/`showRipeningSheet` 추가, `handleRipeningTap`/`handleRipeningOverride`, `postFillSticker`가 전송 직전 `earlyPositionsRef` 확인 후 body에 `earlyFill:true` 동봉, `canFill` 로컬 상수 도입(GrapeBoard prop과 paceState 게이팅에 공용), RipeningSheet 조건부 렌더.
- `scripts/repro/cadence-check.mjs` (신규, 소유 허용) — dayBoundary/computePaceState 순수 함수 단위검증(서버 불필요, 날짜 전부 하드코딩이라 결정적).

**diff 요지**: 총 4파일 수정 + 4파일 신규(스크립트 포함). `globals.css`·`prisma/schema.prisma`·`src/lib/boardFillState.ts`는 `git diff --stat` 확인 결과 완전 무변경(0 diff). 신규 `transition-all`/`window.confirm`/`@keyframes` 0건(grep 확인).

**cadence-check.mjs 실행 결과**
```
$ npx tsx scripts/repro/cadence-check.mjs
① DAILY_1 — 오늘 몫 소진 (6 PASS)
② 자정 직전/직후 경계 (7 PASS, resetHour=4 새벽 리셋 포함)
③ WEEKLY_N 주 경계 (9 PASS, 월요일 시작·일요일 귀속·기간 밖 배제 포함)
④ FREE → null (3 PASS, FREE·미지정·인식불가 cadenceType 포함)
⑤ progress 단조증가 (5 PASS)

30 passed, 0 failed
RESULT: PASS
```

**정적 검증**
```
$ npx tsc --noEmit
EXIT_CODE=0 (에러 0건)

$ npm run lint
✖ 23 problems (0 errors, 23 warnings)
✓ check-icons: 모든 이모지가 플랫 SVG로 커버됨 · JSX 생이모지 없음 · 선택지 배열 커버됨
```
23개 warning은 전부 이 카드가 건드리지 않은 기존 파일(MessagePopup/OfflineBanner/PodongList/ShareCardModal/StreakCard/WeeklyRecapModal/cachedApi.ts)의 `react-hooks/set-state-in-effect`(warn 등급, CLAUDE.md에 문서화된 기존 정책) — 이 카드가 만지거나 새로 발생시킨 warning/error 0건(파일별 grep으로 확인).

**적대 검증 (PRINCIPLES §10, 2개 이상)**

1. **경합 — 시트가 열린 채 낙관 큐가 드레인되는 동안**: `handleRipeningOverride`가 오버라이드 대상 position을 시트가 *열릴 때*가 아니라 "그래도 채우기"를 *누르는 순간* `board.stickers.length`에서 새로 읽는다(클로저가 아니라 최신 렌더의 `board` 상태 참조). 따라서 시트가 떠 있는 동안 다른 경로(재검증·좀비 큐 reconcile 등)로 next position이 앞서가도, override는 항상 "지금" 실제 next인 칸을 겨눈다. 이중 방어로 `GrapeBoard.handleFill`이 `bypassPaceGate:true`에서도 `position !== nextPosition`이면 그대로 return(no-op)하므로, 혹시 어긋난 값이 들어와도 실채움·잘못된 POST로 새지 않는다(둘 다 같은 `board` prop을 공유하므로 실제로 어긋날 수도 없음을 코드로 확인). "그래도 채우기" 버튼은 `onOverride`를 직접 호출하고 페이지가 `setShowRipeningSheet(false)`를 동기로 먼저 실행하므로(ConfirmDialog 확인 버튼과 동일 패턴), 물리적 더블탭이 버튼을 두 번 맞힐 수 없다(두 번째 실제 클릭 이벤트 도달 전에 이미 언마운트).
   - 부가 발견: `earlyPositionsRef`가 인스턴스 단위 ref라 `/board/A`→`/board/B` 재사용 시 잔여 플래그가 샐 수 있는 이론적 틈을 찾아 `useEffect(() => earlyPositionsRef.current.clear(), [id])`로 막음(1줄, 기존 파일의 교차보드 방어 관례와 동일 축).
2. **경계값 — `totalStickers`의 마지막 알**: `filledCount = totalStickers - 1`인 보드에서 마지막 칸이 ripening 상태일 때 오버라이드 채움을 추적. `handleFill(N-1, {bypassPaceGate:true})`는 pace 체크만 건너뛰고 `newFilledCount >= board.totalStickers` 분기(완성 연출 `playCompletionSequence`)는 그대로 타므로 일반 채움과 동일한 액체 차오름 연출이 재생됨을 코드 경로로 확인. 서버 `fillBoardGrape`도 `earlyFill`이 `Sticker.earlyFill` 필드 세팅에만 관여하고 완성/보상 로직과는 완전히 독립(코드 확인). 완성 후 `canFill`이 false로 떨어져 `paceState`/`onRipeningTap`이 GrapeBoard에 `null`/`undefined`로 전달되므로 텀 UI가 자연 소거됨. 추가로 "override 대상이 이미 꽉 찬 보드"(동시에 다른 곳에서 마지막 칸까지 채워짐) 레이스를 상정하면 `board.stickers.length`가 `totalStickers`가 되어 `nextPosition`이 `-1`을 반환 → `position !== nextPosition` 가드가 즉시 no-op시켜 범위 밖 POST가 나가지 않음을 확인.

**스펙 이탈**: 없음. RipeningSheet에 `now: Date` prop을 추가로 도입(카드 스펙엔 명시 없음) — `nextRipeAt`의 같은 날/다음날 분기(§3 문구)에 필요한 "판정 시각"을 컴포넌트 렌더 중 `new Date()`로 직접 읽으면 `react-hooks/purity`(CLAUDE.md 명시 error 등급) 위반이라, 페이지의 effect가 캡처해 내려주는 값으로 배관했다(캡슐 티저와 동일한 기존 관례). 문구·버튼 2개·오버라이드 배관 등 스펙 문면은 그대로 구현.
