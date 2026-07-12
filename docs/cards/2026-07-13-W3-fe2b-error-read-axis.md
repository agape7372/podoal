상태: 대기

## FE-2b: 에러·빈상태 일관화 — 조회축 (F6·F4·F8·F11·F14·F3·F10)

- Severity: Med(일관성·a11y) / 분류: UX / 배정: sonnet (7파일이나 패턴 모방 위주)
- 필독: CLAUDE.md 모션 규약(auto-dismiss는 모션 토큰), react-hooks/purity(렌더 중 Date.now 금지), REVIEW_CHECKLIST 게이트 3·5

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/(app)/relay/[id]/page.tsx`
- `src/app/(app)/stats/page.tsx`
- `src/app/(app)/vine/page.tsx`
- `src/app/(app)/winery/page.tsx`
- `src/app/(app)/messages/page.tsx`
- `src/app/(app)/notifications/inbox/page.tsx`
- `src/components/RewardList.tsx`

### 문제/재현
1. **F6** relay/[id]:397-401 + 89,91: 성공("포도동에 참여했어요")과 실패("수락에 실패했어요")가 같은 무채색 `clay-sm` 배너 — 색·아이콘 구분 0, 자동소멸 없음.
2. **F4**: "다시 불러오기" 인라인 복붙 — messages:133 · winery:295 · vine:79 · stats:76 · inbox:83 · RewardList:99 → 공용 `RetryButton`(W1 FE-1 신설) 치환.
3. **F8**: messages:88 `formatTime`·inbox:15 `timeAgo`가 렌더 중 `new Date()`/`Date.now()` 호출 — purity 규약 이탈 + 화면 열어둔 동안 시간 미갱신. 정본 패턴 = home/page.tsx:680-683(`activityFetchedAt` effect 캡처).
4. **F11**: inbox:85-90 · RewardList:101-106 · stats:365(CategoryBreakdown) 자체 인라인 빈상태 — 공용 `EmptyState` 미사용, 일러스트 트리트먼트 누락.
5. **F14**: stats:288(CircularProgress)·267(DayOfWeek)·337(Monthly) 차트에 role/aria 없음. 모범 = winery/page.tsx:409 (`role="progressbar"`+aria-*).
6. **F3**: 소유 파일 내 에러 텍스트 rose(`text-rose-500`) 통일 (winery:650·RewardList:89는 이미 rose — 확인만).
7. **F10**: relay/[id]:133 `openAttach`의 `catch { /* 빈 목록 */ }` — fetch 실패가 "불러올 진행중인 포도판이 없어요"(452)와 구별 불가 → 에러 노출+재시도.

### 스펙 (시험 가능한 문장)
- F6: 성공 배너 = leaf 계열, 실패 배너 = rose 계열 + 4초 auto-dismiss(모션 토큰 사용, setTimeout cleanup 포함). 메시지 세터 호출부 시그니처 유지(타입에 kind 추가 허용).
- F4: 6곳 인라인 → `<RetryButton onRetry={refresh|fetchX} />`. 기존 onClick 핸들러 로직 불변.
- F8: fetch 완료 시각을 state로 캡처(`fetchedAt`)해 상대시간 계산의 기준으로 사용 — home:680 패턴 모방. SSE 병합 시에도 갱신.
- F11: 3곳을 `<EmptyState>`로 (props: icon 또는 art·title·description — 기존 사용례 vine/page.tsx 모방). 기존 문구 유지.
- F14: 각 차트 래퍼에 `role="img"` + 요약 `aria-label`(예: "이번 주 달성률 72%"). 시각 변화 0.
- F10: catch에서 에러 상태 세워 시트 내 에러+재시도 표시.

### 제약
- 문구 한국어 해요체. 리팩토링 금지. transition-all 신규 금지.
- messages의 SSE 병합·읽음 낙관 처리 로직 불변 (게이트 5 커플링).
- inbox의 mount-시 read-all 발사 로직 불변.

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test
git diff | grep -nE 'transition-all|text-warm-light' # 신규 0건
# 수동: relay 수락 성공/실패 배너 색+자동소멸, 6페이지 재시도 버튼, inbox/rewards/stats 빈상태 일러스트
```

### 보고 전 자가검증
각 주장을 이 세션의 도구 결과와 대조 — 증거를 가리킬 수 있는 작업만 보고. 검증 안 된 것은 "미검증" 명시. 테스트 실패는 출력과 함께.

### 산출
diff + 검증 로그. **커밋 금지** (git add도 금지 — 페이블이 수행).
