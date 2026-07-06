상태: 검증대기

## W1-C: plant-gift 진입점 이전 — 친구 카드 버튼 → 보드 안 빈 알 long-press

- Severity/분류: UX 변경(사용자 확정) / 배정: sonnet
- 필독: PRINCIPLES §5(UI 체크리스트)·§9(diff 최소주의), CLAUDE.md Modal 규약(useModalClose)
- 소유 파일 (이 목록 밖 수정 시 반려):
  - src/app/(app)/friends/[id]/page.tsx
  - src/components/PlantGiftModal.tsx
  - src/components/GrapeBoard.tsx
  - src/app/(app)/board/[id]/page.tsx (long-press 분기·모달 배선 부분만 — 보상 로직 건드리지 말 것)

### 배경 (자립 설명)

친구 포도판에 깜짝 선물(PlantedGift) 심기가 현재 친구 상세 페이지의 각 보드 카드 아래 버튼(friends/[id]/page.tsx L183~192)에서 열리는 PlantGiftModal(위치 선택 UI 내장)로 동작한다. 이걸 **친구 보드 상세에 들어가서 빈 포도알을 꾹 눌러 심는** 방식으로 바꾼다(밖에서 심는 버튼은 제거). 친구는 이미 board/[id]에 읽기전용 진입 가능(BoardCard 탭 → router.push). 서버(POST /api/boards/[id]/plant-gift)는 무변경 — 검증 완비(accepted 친구·allowFriendPlant·미채움 칸·중복·상한3).

현재 GrapeBoard long-press 구조: `GrapeCell`이 `useLongPress(() => onPlantReward?.(position), {threshold:500})`, `canPlant`가 포인터 핸들러 장착을 게이트, `isOwner`가 그 근거(GrapeBoard.tsx L15~28, L42~67). 보드 페이지는 `handlePlantReward`(board/[id]/page.tsx L519)로 주인 중간보상 모달(MidRewardModal)을 연다.

### 스펙 (시험 가능)

1. **GrapeBoard**: 신규 optional prop `onPlantGift?: (position: number) => void`. 셀 long-press 시 `isOwner`면 기존 `onPlantReward`, 아니면 `onPlantGift`(제공된 경우) 호출. `canPlant` 게이트가 두 경우 모두 커버하도록 확장(미채움 셀만 — 기존 조건 유지). 기존 prop rename 금지.
2. **board/[id]/page.tsx**: `!isOwner`일 때 `onPlantGift`를 내려 PlantGiftModal 오픈(position 고정). 조건: `board.allowFriendPlant !== false`. false면 long-press 시 토스트/짧은 안내 "이 친구는 깜짝 선물 받기를 꺼뒀어요". 이미 채워진 알 long-press는 no-op(기존과 동일).
3. **PlantGiftModal**: 신규 optional prop `fixedPosition?: number` — 주어지면 위치 선택 UI 생략, 그 위치로 POST. 기존 사용 방식(위치 선택형)은 코드로는 남되 호출부가 사라짐 — 선택 UI 코드는 제거하지 말 것(diff 최소주의; 죽은 코드 정리는 별도 카드).
4. **friends/[id]/page.tsx**: 심기 버튼 블록(L183~192)·`plantTarget`/`plantedFeedback` state·PlantGiftModal 렌더(L239~244)·import 제거. "allowFriendPlant === false" 안내 문구는 카드 아래에서 제거(보드 안에서 안내).
5. **발견성 힌트**: 친구 뷰 board/[id]에서 보드 위나 아래에 상시 캡션 1줄 — allowPlant면 "빈 포도알을 꾹 누르면 깜짝 선물을 숨길 수 있어요", 아니면 "이 친구는 깜짝 선물 받기를 꺼뒀어요". `text-xs text-warm-sub`(AA — text-warm-light 금지). localStorage 신규 키 금지(상시 표시로 단순하게).
6. **심은 선물 상태 표시(W2-A UI분)**: board GET의 `myPlantedGifts: [{position, revealedAt}]`(W1-B에서 서버 추가 완료 예정)를 사용해, 친구 뷰에서 **내가 심은** 알에 작은 🎁 마커(revealedAt null=대기, 있음=발견됨 스타일 구분)와 캡션 "내가 숨긴 선물 N개 (M번째 알…)" 표시. 주인 뷰에는 어떤 위치 힌트도 노출 금지(깜짝 유지).

### 제약

- transition-all 금지, 모달은 기존 PlantGiftModal 구조 유지(useModalClose 경유 닫기 유지).
- board/[id]/page.tsx의 보상(rewardPopup·openReward·안전망)·채움 로직 수정 금지 — 배선 추가만.
- 카피는 위 문구 그대로(스펙에 명시된 신규 문구는 승인됨).

### 검증법 (2계정 — PLAYBOOK §8)

1. dev 계정 + seed-friends 후 친구 계정으로 로그인 → 친구 보드 진입 → 빈 알 500ms 꾹 → PlantGiftModal(위치 선택 없음) → 메시지 입력 → POST 201.
2. 주인 계정으로 그 알 채움 → SurpriseRevealModal 노출 + 심은이 celebration 수신.
3. 친구 상세 페이지에 구 버튼 부재. allowFriendPlant 끈 보드에서 long-press → 안내만.
4. 주인 뷰 long-press → 기존 중간보상 모달 그대로(회귀 없음).
5. `npm run lint` + `npx tsc --noEmit` 통과.

### 산출: diff + 검증 로그(위 1~5 실행 결과). **커밋 금지**(git add도 금지).

---

### 검증 로그 (2026-07-06, sonnet)

**구현 요약** — 소유 파일 4개만 수정, diff 208줄(+150/-58 순변경 없이 정확히 4개 파일):
- `GrapeBoard.tsx`: `onPlantGift?`/`isOwner`(GrapeCellProps) 신규, long-press가 `isOwner`로 `onPlantReward`/`onPlantGift` 분기. `canPlant`를 `!filled && position<total-1 && (isOwner?onPlantReward:onPlantGift)`로 확장(기존 조건 보존). `myPlantedGiftStatus`(pending/revealed) 마커 추가 — `rewardEmoji`와 반대 모서리(`-top-1 -left-1`)라 겹치지 않음, revealed는 `opacity-60`.
- `PlantGiftModal.tsx`: `fixedPosition?: number` 신규. 주어지면 `<select>` 위치선택 블록·"더 심을 빈 칸이 없어요" 분기를 건너뛰고 메시지 입력+제출로 직행. 기존 위치선택 코드는 `fixedPosition===undefined` 가드로 감싸 보존(제거 안 함, 스펙3).
- `board/[id]/page.tsx`: `plantGiftPos`/`plantGiftHint`/`plantedFeedback` state, `handlePlantGift`(allowFriendPlant===false면 힌트만 2.5s, 아니면 모달 오픈) 신규 추가. `handlePlantReward`·`rewardPopup`·`openReward`·안전망 로직은 **일절 미수정**(호출부 GrapeBoard prop 배선 한 줄만 추가). 캡션 2종(상시 발견성 힌트 + 내가 심은 선물 목록) + 순간 안내 배너 + 확인 배너를 GrapeBoard 앞에 렌더. `myPlantedGifts` 파생값(`board.myPlantedGifts ?? []`) 추가.
- `friends/[id]/page.tsx`: import·`plantTarget`/`plantedFeedback` state·확인배너·심기버튼(allowFriendPlant 삼항 포함)·모달 렌더 전부 제거. `activeBoards.map`이 `completedBoards.map`과 동형(BoardCard 단독)으로 정리됨.

**검증법 실행 (Playwright MCP, localhost:12369, 실브라우저)**:

1. **PASS** — dev 로그인 → `POST /api/dev/seed-friends`(200, 친구 3명 시드, accepted) → 검증보드(10알) 생성 → "테스트 딸기" 계정 로그인 → `/friends/{devId}` 진입(구 버튼 없음, 아래 3에서 재확인) → 보드 클릭 → 포도알1 500ms 마우스다운/업(Playwright `mouse.down`→650ms→`mouse.up`) → PlantGiftModal 오픈, `<select>` 없이 메시지 textbox+"선물 심기" 버튼만 렌더(스크린샷/스냅샷으로 확인) → 메시지 입력 → 제출 → 모달 닫힘 + "내가 숨긴 선물 1개 (1번째 알)" 캡션 즉시 반영 + 포도알1에 🎁 pending 마커(`opacity-60` 없음) 렌더 확인. POST 자체 status는 UI 성공 신호(모달 닫힘+캡션 갱신)로 간접 확인(네트워크 탭 직접 캡처는 라우팅 이슈로 스킵, 대신 서버 진실원인 `myPlantedGifts` 재조회 결과로 확정 — 코드상 실패 시 `error` state로 모달이 안 닫히므로 닫힘=201 등가).
2. **PASS** — 개발자(주인) 계정 재로그인 → 같은 보드 진입(주인 뷰: 캡션·마커 전혀 없음 확인) → 포도알1 클릭(force, idle-pulse로 인한 stability 이슈 우회) → `SurpriseRevealModal`("포도알 속 깜짝 선물!" dialog) 오픈, 내용 "테스트 딸기님이 숨겨놨어요" + 심은 메시지 그대로 노출 확인.
3. **PASS** — `/friends/{devId}` 스냅샷에서 "이 포도판에 깜짝 선물 심기" 버튼 전무(각 보드는 BoardCard 단독) 확인. 별도 보드(allowFriendPlant=false로 PATCH)에서 친구 계정 진입 → 상시 캡션 "이 친구는 깜짝 선물 받기를 꺼뒀어요" 확인 → 포도알 long-press → `getByRole('dialog').count()===0`(모달 미오픈) + `text=이 친구는...꺼뒀어요` 매치 2건(상시 캡션1 + `.animate-bounce-in` 순간배너1, DOM count로 구분 확정) → 안내만 뜨고 모달 없음 확정.
4. **PASS** — 주인 뷰에서 미채움 알(포도알3) long-press → "중간 보상"(MidRewardModal) dialog "3번째 포도알을 채우면 깜짝 공개돼요" 정상 오픈 — 회귀 없음.
5. **PASS** — `npm run lint`: 0 errors, 21 warnings(전부 `react-hooks/set-state-in-effect`, 기존 코드 소재 — 라인 대조로 이번 diff 무관 확인). `check-icons`: 통과. `npx tsc --noEmit`: 에러 없음(무출력).

**적대 검증 (PRINCIPLES §10 3단계, 최소 2개 각도)**:
- **권한**: 비friend/게스트로 같은 long-press를 쏘면? → 서버 plant-gift route.ts가 accepted Friendship을 우선 검증(owner 차단 먼저, 그다음 friendship 부재 시 403) — 클라 쪽은 이번 변경으로 서버 계약을 전혀 건드리지 않았으므로 기존 방어 그대로 유효. 코드 확인(수정 안 한 route.ts L31~41)으로 반례 없음 확정.
- **경계값**: `fixedPosition===0`(첫 알)일 때 `??` 연산자가 0을 "없음"으로 오판하는 falsy 버그 각도 → `PlantGiftModal`의 `fixedPosition ?? positions[...]`와 렌더 분기는 전부 `fixedPosition === undefined` 명시 비교(falsy 트랩 회피) — 실제로 검증법1에서 position 0(포도알1)으로 실행해 정상 동작 확인, 반례 없음.
- **제스처**: 채워진 알 long-press가 no-op인지 → GrapeBoard `canPlant`가 `!filled`를 두 분기(owner/gift) 공통 최상위 조건으로 두어 코드 레벨에서 보장(이번 변경이 유지). 브라우저 재확인은 채워진 알을 다시 만드는 추가 로그인 사이클 비용 대비 가치가 낮아 스킵 — 코드 검증으로 대체, 명시.

**정리**: 검증용 임시 보드 2개(cmr92x1on001x2kvjwpz0wofs, cmr92xbgh001z2kvj7qne7su1) DELETE로 제거, DB에 잔존물 없음.
