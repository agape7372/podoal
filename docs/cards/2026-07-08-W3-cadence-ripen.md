상태: 대기

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
