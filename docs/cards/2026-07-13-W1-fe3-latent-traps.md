상태: 대기

## FE-3: 잠복 트랩 픽스 — 생이모지·danger·빈홈 데드엔드·스켈레톤 (F1·F2·F7·F9·F13·F3)

- Severity: Med~High(잠복 함정) / 분류: 버그·UX / 배정: sonnet
- 필독: CLAUDE.md 아이콘 규약(EmojiIcon 경유·생이모지 금지), 레이아웃 불변식 4(z-index 사다리), REVIEW_CHECKLIST 게이트 3·5·6

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/components/MessagePopup.tsx`
- `src/components/ClayButton.tsx`
- `src/app/(app)/home/page.tsx`
- `src/components/SwipeableBoardCard.tsx`
- `src/app/(app)/profile/page.tsx`

### 문제/재현
1. **F1** `MessagePopup.tsx:35`: `<span className="mr-1">{popupMessage.emoji}</span>` — 데이터 이모지를 EmojiIcon 미경유 생렌더. 같은 데이터를 쓰는 messages/inbox/FriendActivityCard는 전부 `<EmojiIcon>` 경유. check-icons.mjs는 런타임 문자열이라 못 잡음.
2. **F2** `ClayButton.tsx:26-33`: `danger` variant 클래스가 `primary`와 동일(`bg-grape-700 hover:bg-grape-800 text-white`). 현재 콜러 0 — 쓰는 순간 위험 신호 없는 파괴 버튼 탄생.
3. **F7** `home/page.tsx:829,897`: EmptyState의 "포도판 만들기" CTA는 `filter==='all'`일 때만, FAB는 `boards.length>0`일 때만 렌더. 필터는 localStorage 영속(233-238) — 완료/수확 탭을 보던 사용자가 보드 전삭제 시 생성 진입점이 화면에서 소실.
4. **F9** `SwipeableBoardCard.tsx:109`: 미완성 보드 트레이의 비활성 "수확" 라벨이 `text-warm-light`(AA 실패 토큰).
5. **F13** `profile/page.tsx:30`: `if (!user) return null` — 인증 확인 중 완전 blank 화면 (타 페이지는 스켈레톤 예약).

### 스펙 (시험 가능한 문장)
- F1: `<EmojiIcon emoji={popupMessage.emoji} size={16} />`로 교체 (messages/page.tsx:170 사용례 모방).
- F2: danger를 rose 계열로 차별화 — `bg-rose-500 hover:bg-rose-600 text-white` (시각 정의만; 콜러 0이므로 행동 변화 없음).
- F7: `boards.length === 0`이면 **filter 값과 무관하게** "포도판 만들기" CTA를 렌더 (필터별 빈상태 문구는 유지하되 CTA 추가). FAB 조건은 그대로 두어도 CTA 경로가 항상 존재하면 스펙 충족. z-index 사다리(nav 50 > FAB 40 > InstallPrompt 30) 불변.
- F9: `text-warm-light` → `text-warm-sub` (비활성 의미는 opacity로 표현 가능하나 최소 변경 우선 — 색 토큰만 교체).
- F13: user 없을 때 헤더+아바타 영역 스켈레톤 렌더 (기존 페이지 스켈레톤 패턴 모방 — 예: home/page.tsx StreakCard 자리예약). auth 리다이렉트 로직 불변.
- F3(부수): profile:209 에러 텍스트가 rose가 아니면 rose로 (정본색 rose — REVIEW-2026-07-13 §4).

### 제약
- 홈 페이지는 포인터 제스처(드래그 정렬·스와이프) 핫존 — 829,897 부근 렌더 조건만 수정, 제스처 코드(273-626) 접근 금지.
- 리팩토링 금지. transition-all 신규 금지.

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test
# 수동: dev 서버에서 ①메시지 팝업 이모지가 Fluent SVG로 렌더 ②홈 필터 '완료' 상태에서 보드 0개 → CTA 표시 ③프로필 새로고침 직후 스켈레톤
```

### 보고 전 자가검증
각 주장을 이 세션의 도구 결과와 대조 — 증거를 가리킬 수 있는 작업만 보고. 검증 안 된 것은 "미검증" 명시. 테스트 실패는 출력과 함께. 완료·검증된 것은 헤징 없이 완료로.

### 산출
diff + 검증 로그. **커밋 금지** (git add도 금지 — 페이블이 수행).
