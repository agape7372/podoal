상태: 완료 (2026-07-10 sonnet 구현·검증 로그 완비 — 2026-07-11 fable 최종 확인, 실기기 항목은 device-checklist로 이관)

## C3-backfill-ui: "어제 몫 채우기" — RipeningSheet 선택지 + 채움 배관

- 분류: 기능(FILL_CADENCE_PLAN §5 보충 채우기, C3) / 배정: **sonnet**
- 필독: `docs/FILL_CADENCE_PLAN.md` §5·§8, CLAUDE.md 패턴 절(낙관 채움·직렬 큐 무접촉), `src/components/RipeningSheet.tsx`(수정 대상 — 현재 구조·주석), board/[id]의 earlyFill ref 배관(`earlyPositionsRef`, 2026-07-08 C1 선례)
- **선반영(fable — 손대지 말 것)**: 서버 전량 — `pace.ts`(PaceFill·computeBackfillEligibility), `fillBoard.ts`(opts.backfill → 서버 재판정 → isBackfill 기록·paceState 'backfill'), stickers 라우트(body.backfill 수용), 보드 상세 GET `backfillAvailable` additive, stats 귀속, analytics 사전 `fill_backfill`.

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/components/RipeningSheet.tsx`
- `src/app/(app)/board/[id]/page.tsx`
- `src/types/index.ts` (additive 필드 1~2개만)
- `src/lib/cadence.ts` (입력 확장만 — 판정 산식 무변경)

### 스펙

1. **타입(additive)**: `BoardDetail`(또는 상세 응답 타입)에 `backfillAvailable?: boolean`. 스티커 타입에 `isBackfill?: boolean`이 없으면 추가(서버는 이미 내려줌).
2. **RipeningSheet 선택지**: props에 `backfillAvailable?: boolean`, `onBackfill?: () => void` 추가. `backfillAvailable`일 때 "기다릴게요"(주 버튼) 아래·"그래도 채우기" 위에 **보조 버튼 "어제 몫 채우기"** 추가 — ClayButton `variant="ghost"` fullWidth(기존 variant 재사용, 신규 스타일 발명 금지). 캡션 한 줄(버튼 위 또는 아래): "어제 한 알이 비어 있어요 — 지금 채우면 어제로 기록돼요" (해요체, 질책 금지). onBackfill도 onOverride와 같은 패턴(이탈 애니 없이 직접 호출 — 부모가 즉시 언마운트).
3. **배관(board/[id]/page.tsx)**: `earlyPositionsRef` 선례 그대로 — `backfillPositionsRef = useRef(new Set<number>())`, id 변경 시 clear. `handleRipeningBackfill`: 시트 닫고 `position = board.stickers.length`를 ref에 넣고 `track('fill_backfill', { boardId: id })` 후 `grapeBoardRef.current?.fillNow(position)`. `postFillSticker` 전송 직전에 ref에 있으면 body에 `backfill: true`를 얹고 제거(earlyFill 코드 블록과 대칭 — **직렬 큐·applyFillResult·isJustFilled 절대 무수정**). 한 요청에 earlyFill과 backfill이 동시에 실리는 일은 없다(시트에서 한 버튼만 택함) — 하지만 방어적으로 backfill이 있으면 earlyFill은 싣지 않는다.
4. **소비 후 로컬 갱신**: backfill 채움 발사 직후 `setBoard`로 `backfillAvailable: false` 낙관 반영(보충은 1알 한정 — 시트 재진입 시 재노출 방지). 서버 재판정이 정본이므로 실패 롤백까지 신경 쓰지 않는다(다음 보드 fetch가 수렴).
5. **클라 판정 정합(cadence.ts)**: `computePaceState`의 `stickerTimes: Date[]`를 `fills: { filledAt: Date; isBackfill?: boolean }[]`로 확장 — isBackfill이면 `filledAt - 24h`로 평가(전날 귀속 근사·서버 pace.ts와 같은 취지, 판정 산식 자체는 무변경). 호출부(스티커 배열을 만드는 곳 — board/[id] 또는 GrapeBoard)를 grep해서 새 형태로 전달. **이걸 빼먹으면 backfill 채움 직후 클라가 오늘 몫을 잠식한 것으로 오판해 UI가 unripe로 보인다(서버는 ripe) — 이 카드의 회귀 포인트.**
6. **track 이벤트**: `fill_backfill`은 사전에 이미 있음(analytics.ts) — `track('fill_backfill', { boardId: id })` 한 줄, 다른 이벤트 추가 금지.

### 검증법
- `npx tsc --noEmit` + `npm run lint` 0 에러 + `npm test` 전체 pass
- 검증 로그에: ①시트 버튼 3개 우선순위 구조(기다릴게요 > 어제 몫 채우기 > 그래도 채우기) ②backfill ref 배관 좌표와 "직렬 큐 무수정" 근거(diff에 fillQueues/applyFillResult 라인 0) ③cadence.ts 확장 좌표 + 호출부 갱신 좌표 ④backfillAvailable 낙관 소거 좌표

### 검증 로그

**커맨드**: `npx tsc --noEmit` 0 에러 / `npm run lint` 0 에러(경고 72개 — 수정 전과 동일 baseline, 전부 기존 `react-hooks/set-state-in-effect` 워닝이며 이 카드가 건드린 파일과 무관) / `npm test` 164개 중 pass 160·skipped 4·fail 0(기준치 그대로).

① **시트 버튼 3개 우선순위 구조** — `src/components/RipeningSheet.tsx:85-102`.
   - `86-88`: "기다릴게요" — `ClayButton variant="primary"` (주 버튼, 기존 그대로).
   - `89-98`: "어제 몫 채우기" — `backfillAvailable && onBackfill`일 때만 렌더. 캡션(`91-93`, "어제 한 알이 비어 있어요 — 지금 채우면 어제로 기록돼요") + `ClayButton variant="ghost" fullWidth`(`94-96`, 신규 스타일 없이 기존 variant 재사용).
   - `99-101`: "그래도 채우기" — 기존 텍스트 링크 그대로(최하단 유지).
   - onBackfill은 onOverride와 동일 패턴으로 이탈 애니 없이 직접 호출(`handleRipeningBackfill`이 `setShowRipeningSheet(false)`를 직접 부름 — `requestClose` 미사용).

② **backfill ref 배관 좌표 + 직렬 큐 무수정 근거** — `src/app/(app)/board/[id]/page.tsx`.
   - `371-373`: `backfillPositionsRef = useRef(new Set<number>())` 선언(earlyPositionsRef 바로 아래, 대칭 주석 포함).
   - `374-377`: id 변경 effect에 `backfillPositionsRef.current.clear()` 추가(기존 earlyPositionsRef clear와 같은 effect, 교차오염 방지 동일 근거).
   - `391-402`: `handleRipeningBackfill` — 시트 닫기 → `position = board.stickers.length` → `backfillPositionsRef.current.add(position)` → `track('fill_backfill', { boardId: id })` → `grapeBoardRef.current?.fillNow(position)` → `setBoard`로 `backfillAvailable: false` 낙관 소거(④ 참조, 같은 함수 안).
   - `433-434`: `postFillSticker` 전송 직전 — `isBackfill = backfillPositionsRef.current.has(position)` 확인 후 소거. `435-436`: `isEarlyFill = !isBackfill && earlyPositionsRef.current.has(position)` — backfill이 있으면 earlyFill 쪽은 아예 검사하지 않는 방어적 상호배타(스펙 3번 "한 요청에 동시에 실리는 일은 없다"의 방어벽).
   - body 분기(`454-458`): `isBackfill ? { position, backfill: true } : isEarlyFill ? { position, earlyFill: true } : { position }`. 서버 `src/app/api/boards/[id]/stickers/route.ts:19`(`body.backfill === true`)와 필드명 일치 확인.
   - **직렬 큐 무수정 근거**: 이번 diff에서 `fillQueues`·`applyFillResult`·`fillPendingPositions`·`isJustFilled` 심볼이 나오는 줄은 전부 기존 코드를 그대로 읽기만 했고 수정한 줄이 0이다(수정은 `postFillSticker` 최상단의 `isBackfill`/`isEarlyFill` 판정과 body 조립 부분에만 국한 — 큐 체이닝(`fillQueues.get(id) ?? Promise.resolve()`), reconcile(`applyFillResult`), rollback(`rollbackFill`) 로직은 한 글자도 건드리지 않음).

③ **cadence.ts 확장 좌표 + 호출부 갱신 좌표**.
   - `src/lib/cadence.ts:7-14`: `PaceFill` 인터페이스(`filledAt: Date; isBackfill?: boolean`) + `ONE_DAY_MS` 상수 추가.
   - `src/lib/cadence.ts:43-47`: `computePaceState` 시그니처를 `stickerTimes: Date[]` → `fills: PaceFill[]`로 변경(판정 산식은 무변경).
   - `src/lib/cadence.ts:75-80`: `effectiveMs(f)` 헬퍼로 `isBackfill`이면 `-ONE_DAY_MS` 이동한 시각을 기간 필터링(`inPeriod`)에 사용 — 스펙 5번 요구 그대로.
   - `src/lib/cadence.ts:90`: `progress` 계산의 `lastFillMs`도 같은 `effectiveMs`로 통일(원래 `t.getTime()`을 쓰던 곳 — backfill 채움이 마지막 채움이었을 때도 귀속 이동이 일관되게 반영되도록).
   - 호출부(유일한 호출 지점, repo 전체 grep 확인 — `computePaceState` 참조는 `page.tsx` 1곳뿐): `src/app/(app)/board/[id]/page.tsx:356,358` — `const fills = board.stickers.map((s) => ({ filledAt: new Date(s.filledAt), isBackfill: s.isBackfill }))` 후 `computePaceState(..., fills, now)`.

④ **backfillAvailable 낙관 소거 좌표** — `src/app/(app)/board/[id]/page.tsx:401`, `handleRipeningBackfill` 내부 `grapeBoardRef.current?.fillNow(position)` 직후 `setBoard((b) => (b ? { ...b, backfillAvailable: false } : b))`. 실패 롤백은 스펙 4번 지시대로 구현하지 않음(다음 `fetchBoard`가 서버 판정으로 수렴).

**타입/서버 정합 확인**: `src/types/index.ts` — `StickerInfo.isBackfill?: boolean` 추가(서버 GET이 raw `board.stickers`를 그대로 내려주므로 Prisma 필드가 이미 실려 옴), `BoardDetail.backfillAvailable?: boolean` 추가(서버 GET `src/app/api/boards/[id]/route.ts:173`이 이미 내려주는 필드와 이름 일치 확인).

**스펙 대비 판단 지점**:
- 스펙 3번 "earlyFill 코드 블록과 대칭" — `earlyPositionsRef`/`handleRipeningOverride`와 구조를 1:1로 맞춤(선언 위치·clear effect·useCallback 패턴·postFillSticker 삽입 지점 전부 동일 형태).
- 스펙 2번 "onBackfill도 onOverride와 같은 패턴" — `RipeningSheet`에서 `onBackfill`을 `onClick`에 직접 연결(별도 `requestClose` 래핑 없음), 부모(`handleRipeningBackfill`)가 `setShowRipeningSheet(false)`를 직접 호출해 즉시 언마운트시키는 것도 `handleRipeningOverride`와 동일.
- 스펙 6번 "다른 이벤트 추가 금지" — `track` 호출은 `fill_backfill` 한 줄만 추가(`fill_early_override`와 나란히, 기존 이벤트 사전에 이미 등재된 이름 재사용).
- 소유 파일 4개 외 수정 없음(서버부 `pace.ts`/`fillBoard.ts`/stickers route/보드 GET route는 읽기만 하고 손대지 않음 — fable 선반영분 그대로).
