상태: 대기

## FE-2a: 에러 서피스 일관화 — 입력·생성축 (F3·F9·F10·F4)

- Severity: Med(일관성) / 분류: UX / 배정: sonnet
- 필독: CLAUDE.md a11y 규약(text-warm-light 장식 전용·해요체), 모션 규약, REVIEW_CHECKLIST 게이트 3

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/(app)/board/create/page.tsx`
- `src/app/(app)/relay/create/page.tsx`
- `src/app/page.tsx`
- `src/app/(app)/friends/page.tsx`

### 문제/재현
1. **F3**: 검증 에러 텍스트가 grape-700(보라) — board/create:211,268 · relay/create:203,247,331 · friends:197. 보라 브랜드 앱에서 보라 에러는 에러로 안 읽힘. **정본색 = rose (`text-rose-500`) — REVIEW-2026-07-13 §4 확정.** (welcome page.tsx:283,351은 이미 rose — 확인만.)
2. **F9**: relay/create:308,315 비활성 ▲▼ 버튼이 `text-warm-light`(AA 실패 토큰)로 의미 요소 렌더.
3. **F10**: relay/create:47 친구 목록 fetch 실패를 `catch`로 무음 삼킴 → "친구가 없어요"류 빈상태와 구별 불가.
4. **F4**: friends:306 "다시 불러오기" 인라인 복붙 → 공용 `RetryButton`(W1 FE-1이 신설, `src/components/RetryButton.tsx`)으로 치환.

### 스펙 (시험 가능한 문장)
- F3: 소유 파일 내 에러 텍스트 `text-grape-700` → `text-rose-500`. 에러 의미가 아닌 grape 사용처는 불변.
- F9: `text-warm-light` → `text-warm-sub` + 비활성은 `disabled` 속성/opacity로 (최소 변경).
- F10: catch에서 에러 상태를 세워 사용자에게 "친구 목록을 불러오지 못했어요" + 재시도 노출 (기존 페이지 에러 상태 패턴 모방). 낙관 흐름 비침범.
- F4: friends:306 인라인 → `<RetryButton onRetry={...} />`.

### 제약
- 문구는 한국어 해요체. 리팩토링 금지. transition-all 신규 금지.
- 소유 파일 내 이미 재작성하는 라인의 transition-all만 자연 치환 허용.

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test
git diff | grep -nE 'transition-all|text-warm-light' # 신규 0건
```

### 보고 전 자가검증
각 주장을 이 세션의 도구 결과와 대조 — 증거를 가리킬 수 있는 작업만 보고. 검증 안 된 것은 "미검증" 명시. 테스트 실패는 출력과 함께.

### 산출
diff + 검증 로그. **커밋 금지** (git add도 금지 — 페이블이 수행).
