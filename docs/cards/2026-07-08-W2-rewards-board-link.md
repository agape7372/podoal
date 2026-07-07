상태: 대기

## W2-rewards-board-link: 보상 카드 → 원본 포도판 링크 (P1 후보, UX 검토 완료)

- 분류: 연계(감사 제안 채택분) / Severity Med(기능 연계 단절 — PA-008 동계열) / 배정: **sonnet**
- 필독: `docs/PRINCIPLES.md` §5(모달 규약)

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/components/RewardRevealModal.tsx`
- `src/components/RewardList.tsx`

### 문제/배경
포도밭(rewards)에서 보상을 열어봐도 그 보상이 달렸던 포도판으로 갈 방법이 없다 — 어느 습관의 보상인지 맥락이 끊긴다. UX 검토 결론(페이블): **개봉 모달 안에 2차 어포던스**로 넣는다(카드 자체는 "보상 열기" 단일 탭 유지 — 겹탭 충돌 방지).

### 스펙
1. `RewardRevealModal`에 **optional** prop `boardId?: string` 추가.
2. `boardId`가 있을 때만, 모달 본문 하단(기존 닫기 버튼 위 또는 옆)에 보조 링크 렌더: `next/link`로 `/board/${boardId}` 이동, 문구 **"이 포도판 보러가기"**, 스타일은 보조 톤(`text-grape-600` 텍스트 링크 + Chevron 계열) — 주 버튼(닫기)보다 시각 위계 낮게.
3. 탭 시 `feedbackTap()` 호출. 모달 close 처리는 라우팅 언마운트에 맡겨도 되지만, `requestClose` 병행이 자연스러우면 사용(기존 useModalClose 훅 있음).
4. `RewardList.tsx`의 `<RewardRevealModal ...>` 호출에 `boardId={...}` 전달 — 열린 보상의 `r.board.id`. 주의: `opened` state는 `RewardInfo` 타입(보드 없음)이므로, 여는 시점에 boardId를 별도 state로 함께 보관하거나 opened를 `{ reward, boardId }`로 확장(컴포넌트 내부 state 형태는 자유).
5. 보드 페이지 등 다른 호출처는 `boardId` 미전달 → 렌더 무변화(기존과 동일)임을 diff로 보장.

### 제약
- 모달 기존 마크업/애니 구조 최소 변경. `window.confirm` 금지. `transition-all` 금지.

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- `grep -rn "RewardRevealModal" src/` 전 호출처 나열 + boardId 미전달 호출처가 컴파일·렌더 무영향임을 로그로.

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**
