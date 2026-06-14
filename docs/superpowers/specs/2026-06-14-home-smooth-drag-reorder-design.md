# 홈 카드 부드러운 드래그 정렬 (smooth drag-to-reorder)

- 날짜: 2026-06-14
- 브랜치: `feat/home-reorder-smooth-drag`
- 범위: `src/app/(app)/home/page.tsx`, 신규 `src/lib/reorder.ts` (+테스트). 보조: `src/components/SwipeableBoardCard.tsx`(필요 시 최소 변경).

## 문제

홈에서 포도판 카드를 **꾹 눌러(롱프레스 450ms) 위·아래로 정렬**할 때, 두 가지 이유로 "휙휙 점프"한다.

1. **들어올린 카드가 손가락을 따라오지 않는다.** `onMove`의 리프트 분기는 `reorderMove(clientY)`로 *순서 데이터만* 바꾸고, 카드 자체에는 `translateY`를 주지 않는다.
2. **이웃 카드가 전환 없이 순간이동한다.** `reorderMove`가 행을 넘을 때마다 `mutateBoards`로 각 보드 `order`를 갱신 → `displayBoards`가 즉시 재정렬 → React가 `<li>` DOM 노드를 애니메이션 없이 재배치한다.

목표: **꾹 누르면 카드가 살짝 떠오르고 손가락을 따라 움직이며, 이웃 카드는 자리를 부드럽게 비켜주고, 손을 떼면 제자리에 부드럽게 안착**한다. 라이브러리 추가 없음(번들 0KB), 옆으로 밀어 수확(스와이프)·탭 열기·네이티브 스크롤 차단 제스처는 전부 보존.

## 핵심 아이디어 — 드래그 중 순서를 바꾸지 않는다

기존 코드의 jank 근원은 "포인터가 움직일 때마다 실제 배열 순서를 바꾸는" 것이다. 대신:

- **드래그 동안 DOM 행 순서는 고정.** 시각만 transform으로 바꾼다.
  - **들어올린 카드**: `translateY(손가락Δ)`를 outer 요소에 **직접(imperative)** 기록 — 매 픽셀, 리렌더 없음.
  - **이웃 카드**: 삽입 지점에 드래그 카드 크기만큼 빈자리를 열기 위해 `translateY(±footprint)`. 삽입 인덱스(`targetIndex`)가 **미드포인트를 넘을 때만** 갱신되므로, 그 순간에만 CSS transition으로 스르륵 미끄러진다.
- **실제 순서는 손을 뗄 때 한 번만 커밋**(`arrayMove`)하고, 그 전이를 **FLIP**(First-Last-Invert-Play)으로 애니메이션해 모두 최종 슬롯으로 활주시킨다.

이는 `@dnd-kit/sortable`·sortablejs가 내부적으로 하는 "gap을 열고 transform으로 미끄러뜨린 뒤 드롭 때 커밋" 모델과 동일하다. 다만 기존의 정교한 포인터 파이프라인(축 잠금, `setPointerCapture`, non-passive `touchmove` 차단)을 그대로 재사용하므로 스와이프/스크롤 회귀 위험이 가장 낮다.

### 레이어 분리(중요)

가로 스와이프 transform이 걸리는 move 레이어는 `overflow-hidden` 래퍼 **안**이라, 세로 정렬 translate를 거기 주면 **클립된다**. 그래서:

- 세로 정렬 `translateY` → **클립 바깥의 outer 요소**(`SwipeableBoardCard`의 `innerRef`, 리프트 시 `z-20`). 부모는 이미 이 outer를 `cardRefs`로 들고 있다.
- 가로 스와이프 `translateX` → 기존대로 inner move 레이어(`moveLayerRefs`).

둘은 축 잠금으로 동시에 활성화되지 않고, 서로 다른 요소에 기록되므로 충돌하지 않는다. React는 outer의 `transform`을 소유하지 않으므로(인라인 style 없음) imperative 기록이 리렌더에도 보존된다.

## 모듈 경계

### `src/lib/reorder.ts` (순수, 프레임워크 무관, 단위 테스트)

- `arrayMove(arr, from, to)` — 불변 배열 이동(범위초과/no-op은 얕은 복사).
- `computeTargetIndex(snap, sourceIndex, dy)` — 정적 스냅샷(리프트 시점 top/height) + 포인터 Δ로 삽입 인덱스. 미드포인트 교차 기준, 가변 높이 안전, 끝에서 클램프.
- `shiftFor(index, sourceIndex, targetIndex, footprint)` — 행 `index`가 드래그 슬롯을 열기 위해 받을 ±transform(px). 드래그 행/범위 밖은 0.
- `rowFootprint(snap, sourceIndex, gap)` — 드래그 행 높이 + 행 간격.
- `inferRowGap(snap, fallback=12)` — 스냅샷의 첫 합리적 간격(=`space-y-3`=12px)에서 행 간격 추론.

### `home/page.tsx` (얇은 DOM 조작)

- `doLift`: 정적 스냅샷(모든 보이는 카드 outer의 top/height), `liftRef`에 보관, `setLiftedId`(드래그 통틀어 1회 setState), 스크롤 차단.
- `onMove`(lifted): `dy = clientY - startY` → dragged outer에 `translateY(dy)` 직접 기록. `computeTargetIndex`가 바뀌면 이웃에 `shiftFor` transform(+transition) 기록.
- `onUp`/`onCancel`(lifted) → `endLift(persist)`: `arrayMove`로 finalIds 산출, FLIP First(현재 화면 top) 기록 → `mutateBoards`로 order 커밋 + `setLiftedId(null)` → `useLayoutEffect`가 Last 측정·Invert·Play. `persist && 이동발생` 시에만 `PATCH /api/boards/reorder`.

## 상태/성능

- 드래그 중 setState 0회(스와이프와 동일 철학). 리프트/드롭에서만 각 1회.
- onMove 픽셀당 쓰기 = dragged 1개. 교차 시에만 이웃 N개 1회.
- FLIP은 `useLayoutEffect`에서 paint 전 동기 처리(중간 깜빡임 없음). 동기 forced-reflow로 invert→play.

## 접근성 / 감속 모션

- 모션은 전부 **CSS transition**(인라인) → `globals.css`의 `prefers-reduced-motion` 백스톱(`* { transition-duration: 0.001ms !important }`)이 자동 무력화 → 감속 사용자는 즉시 스냅(올바른 계약). 손가락 추적은 `transition:none`이라 영향 없음.
- 키보드 정렬은 현행처럼 **범위 밖**(롱프레스/스와이프는 포인터 전용 — 기존 문서화된 트레이드오프). 키보드는 카드 열기만 유지.

## 비목표 (YAGNI)

- 드래그 핸들·dnd-kit·framer-motion 도입 안 함(사용자 결정: 인하우스).
- 키보드 정렬, 자동 스크롤(목록 끝 넘어서 드래그 시 스크롤)은 v1 제외 — 필요 시 후속.
- 교차 시 햅틱 틱은 제외(`feedback.ts`는 동결 데이터 레이어 — 시그니처 수정 금지, 사운드 동반 `feedbackTap`은 시끄러움).

## 테스트 / 검증

- `reorder.ts` 순수 함수 node:test(이동방향·가변높이·클램프·범위밖·간격추론).
- `npm run lint` / `tsc --noEmit` / `npm test` / `next build` 그린.
- 멀티에이전트 적대적 리뷰(제스처 회귀·FLIP 정확성·perf·a11y).
- dev 서버 + Playwright로 정렬 모션 스모크(콘솔 0 에러, 순서 영속).
