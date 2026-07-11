상태: 완료 (2026-07-11, sonnet 구현 + fable 라이브 검증)

## W1B-a11y-heatmap-dots: 히트맵 색각 이중 부호화 — 도트 크기 병행

- 분류: 접근성(A11Y_PLAN §3, REQ-09) / 배정: **sonnet** / 소유 파일: `src/components/Heatmap.tsx` **단독**
- 현황: 90일 히트맵이 활동량을 초록 5단계 **색 단독**으로 부호화 — 색각 이상 사용자는 단계 구분 불가.

### 스펙

- 셀 내부에 활동량 비례 **도트(원) 크기** 병행: count 단계별 반지름 단조 증가(0 = 도트 없음). 색 단계와 같은 버킷 사용 — 이중 부호화이지 신규 스케일 아님.
- 도트는 셀 중앙, 셀 배경색과 AA 대비(진한 단계 위엔 밝은 도트 등 — 실제 팔레트 확인 후 결정).
- 기존 유지: ring-inset(0 vs 1+ 구분), `transition-colors`, 셀 크기·간격·레이아웃.
- 범례 동반 갱신: 색+도트 조합으로.
- P4 "히트맵 드릴다운"과 **비병합** — 셀 탭 핸들러 추가 금지(후속을 막지만 않으면 됨).

### 금지·제약

- `transition-all` 금지. 레이아웃 불변식 ①②(overflow 클립) — 도트는 셀 내부 요소라 침해 없음 유지.
- 신규 키프레임 불필요(정적 표현). 애니메이션 추가 금지.
- Heatmap.tsx 외 파일 수정 금지.

### 검증 (완료 조건)

- `npx tsc --noEmit` 0, `npm run lint` 0 에러.
- 라이브(dev): /stats 히트맵 — 도트 크기 단조 증가 목시, 범례 정합.
- 그레이스케일 스크린샷 1장으로 색 제거 시 판독 가능 확인(Playwright `filter: grayscale(1)` 주입 등).
- 검증 로그를 이 카드에 추기.

### 구현 로그 (sonnet)

수정 파일: `src/components/Heatmap.tsx` 단독.

**버킷·도트 크기·색 대응표** (`getColorClass` 버킷을 그대로 재사용, 신규 스케일 아님):

| count | 배경(`getColorClass`) | 도트 지름 | 도트 색 | 대비비(WCAG 1.4.11, 3:1 기준) |
|---|---|---|---|---|
| 0 | `bg-warm-border/40` | 없음 | — | — |
| 1 | `grape-300` (#dcc4f2) | 3px | `grape-900` (#3d2a56) | 7.9:1 |
| 2–3 | `grape-400` (#c9a8e8) | 5px | `grape-900` | 6.2:1 |
| 4–6 | `grape-500` (#b28cdc) | 7px | `grape-900` | 4.6:1 |
| 7+ | `grape-700` (#7d58a8) | 9px | `white` (#ffffff) | 5.5:1 |

**색 대비 선택 근거**: 실제 `globals.css` grape 팔레트 값으로 상대휘도(WCAG 상대 luminance 공식)를 계산한 결과, 단일 도트 색으로는 4개 버킷 전부에서 3:1을 못 넘긴다 — `grape-900` 단일 사용 시 grape-700 배경에서 2.3:1로 미달, 흰색 단일 사용 시 grape-300/400/500 배경에서 1.6~2.7:1로 미달. 그래서 카드 스펙이 시사한 대로 **가장 진한 버킷(grape-700)만 흰 도트, 나머지 3버킷은 짙은 grape-900 도트**로 나눠 전 버킷 3:1 이상을 확보했다(구현 근거 주석은 `Heatmap.tsx` 상단 `getDotSpec` 바로 위에 남김).

**구현 방식**:
- `getDotSpec(count)` 헬퍼가 `getColorClass`와 동일한 5-버킷 경계(0/1/2-3/4-6/7+)를 재사용해 `{size, colorClass}` 반환(0은 `null` = 도트 없음).
- `HeatmapDot` 소형 컴포넌트가 셀 중앙에 `absolute inset-0 m-auto rounded-full` 원(`aria-hidden`)을 렌더 — 셀 div에 `relative`만 추가(레이아웃 불변식 무침해, 셀 내부 요소라 `overflow-x-auto` 클립 리스크 없음).
- 셀 렌더링에서 기존 `title` 툴팁(호버 시 날짜+개수)·`ring-inset`(0 vs 1+ 구분)·`transition-colors` 그대로 유지, `transition-all`·신규 애니메이션·셀 탭 핸들러 추가 없음.
- 범례를 하드코딩 5개 div에서 대표 count 배열 `[0, 1, 2, 4, 7]` (버킷 0~4 각 1개) 매핑으로 리팩터 — `getColorClass`/`getDotSpec`을 그대로 재사용해 그리드와 범례가 항상 같은 로직으로 그려지도록(드리프트 방지).

**검증 결과**:
- `npx tsc --noEmit` — 에러 0.
- `npm run lint` — 0 errors, 72 warnings(전부 Heatmap.tsx와 무관한 기존 파일들의 `react-hooks/set-state-in-effect` 경고 — CLAUDE.md에 명시된 대로 warn 레벨로 의도된 규칙). `check-icons` 통과.
- 라이브 dev 검증·그레이스케일 스크린샷은 지시에 따라 미실행(상위 모델이 일괄 수행 예정).

**diff 요지**: `getDotSpec`/`HeatmapDot` 헬퍼 추가(24줄), 그리드 셀 div에 `relative` + `<HeatmapDot>` 자식 1줄 추가, 범례 블록을 배열 `.map()`으로 교체(하드코딩 5div → 동일 헬퍼 재사용). 순증가 약 +35줄, 삭제 없음(범례는 재작성).

### 라이브 검증 (fable, 2026-07-11)

- /stats 히트맵 탭(Playwright): 도트 렌더 확인(활동 셀 + 범례). 범례 색+도트 조합 정합 ✓
- 그레이스케일 스크린샷(`filter: grayscale(1)`): 색 제거 상태에서 범례 5단계가 도트 크기·명도만으로 판독 가능 ✓
