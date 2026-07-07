상태: 검증대기

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

### 검증 로그 (2026-07-08)

**구현 요지**
- `RewardRevealModal.tsx`: optional prop `boardId?: string` 추가. 있을 때만 "확인" 버튼 아래 보조 링크(`next/link` → `/board/${boardId}`, 문구 "이 포도판 보러가기", `text-sm text-grape-600` + `›` 챕터런 형태 chevron, `aria-hidden` span) 렌더. 탭 시 `feedbackTap()` + `requestClose()` 병행(라우팅 언마운트로도 안전 — Modal의 이탈 타이머는 cleanup에서 clearTimeout).
- `RewardList.tsx`: `opened` state를 `RewardInfo | null` → `{ reward: RewardInfo; boardId: string } | null`로 확장(스펙 5번 항목의 자유 선택지 중 "opened를 `{reward, boardId}`로 확장" 채택). `openReward`의 3개 분기(즉시 열람/reveal 성공/reveal 실패 폴백) 모두에서 `r.board.id`를 함께 저장. 렌더부에서 `boardId={opened.boardId}` 전달.
- 보드 상세 페이지(`src/app/(app)/board/[id]/page.tsx:1187`) 호출부는 소유 파일 밖이라 무수정 — `boardId` 미전달로 optional prop이 `undefined`가 되어 `{boardId && (...)}`가 `false` 렌더(기존과 동일 출력).

**호출처 전수 (grep -rn "RewardRevealModal" src/, 수정 후 기준)**
```
src\components\RewardRevealModal.tsx:13:interface RewardRevealModalProps {
src\components\RewardRevealModal.tsx:36:export default function RewardRevealModal({ reward, loading = false, loadingNote, boardId, onClose }: RewardRevealModalProps) {
src\components\RewardList.tsx:7:import RewardRevealModal from './RewardRevealModal';
src\components\RewardList.tsx:139:        <RewardRevealModal reward={opened.reward} boardId={opened.boardId} onClose={() => setOpened(null)} />
src\app\(app)\board\[id]\page.tsx:14:import RewardRevealModal from '@/components/RewardRevealModal';
src\app\(app)\board\[id]\page.tsx:20:// (RewardRevealModal·SurpriseRevealModal·GiftUnboxModal)는 청크 fetch 지연을 피해 정적 유지(#89).
src\app\(app)\board\[id]\page.tsx:1187:        <RewardRevealModal
```
렌더 호출처는 2곳: `RewardList.tsx`(boardId 전달 — 이번 스펙 대상) / `board/[id]/page.tsx`(boardId 미전달, 무수정). 후자는 `boardId?: string` optional이라 타입 에러 없음 — `npx tsc --noEmit` 결과가 이를 증명(아래).

**검증 실행 결과**
- `npx tsc --noEmit` → 출력 없음(에러 0). `board/[id]/page.tsx`의 미전달 호출처 포함 전체 컴파일 통과.
- `npm run lint` → `✖ 22 problems (0 errors, 22 warnings)` + `✓ check-icons: 모든 이모지가 플랫 SVG로 커버됨 · JSX 생이모지 없음 · 선택지 배열 커버됨`. 22개 경고는 전부 `react-hooks/set-state-in-effect`(프로젝트 컨벤션상 warn 등급, CLAUDE.md에 명시된 기존 패턴)이며 `MessagePopup.tsx`/`OfflineBanner.tsx`/`PodongList.tsx`/`ShareCardModal.tsx`/`StreakCard.tsx`/`WeeklyRecapModal.tsx`/`cachedApi.ts`에 위치 — `RewardRevealModal.tsx`·`RewardList.tsx`와는 무관(grep으로 확인, 두 파일명 매치 0건). `›` 챕터런 문자는 `\p{Extended_Pictographic}` 미매치라 check-icons의 "JSX 생이모지" 검사 대상이 아님(이모지가 아닌 구두점) — 실제로 통과 로그가 이를 확인.

**스펙 이탈**: 없음. 제약 준수 — `window.confirm` 미사용, `transition-all` 미추가, 모달 기존 마크업(진입 애니·프리셋) 무변경, 소유 파일 밖 수정 없음(읽기만: `Modal.tsx`, `ClayButton.tsx`, `icons.ts`, `types/index.ts`, `feedback.ts`, `board/[id]/page.tsx`, `GiftUnboxModal.tsx`(보조 링크 스타일 선례 확인용), `check-icons.mjs`).
