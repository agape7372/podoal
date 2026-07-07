상태: 대기

## W3-social-hide: 홈 친구 소식 숨김 설정 (ABS-14 — 접근성 팩 선행분)

- 분류: 접근성/심리 안전(제안-3 채택) / 배정: **sonnet**
- 필독: `docs/PRINCIPLES.md` §5(UI), `CLAUDE.md` "Key Libraries" store.ts 행

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/home/page.tsx`

### 선반영 완료 (페이블 — 이 카드에서 손대지 말 것)
- `src/lib/store.ts`: `AppSettings.hideFriendFeed?: boolean`(기본 false) + `updateSettings` 경유 저장 가능 상태.

### 문제/배경
홈 하단 "친구 소식" 피드(P21: 남의 완성 소식에서 비교감 — 심리 안전 이슈)는 숨길 방법이 없다. 마음건강 세그먼트의 악화 트리거(PERSONA_REVIEW ABS-14).

### 스펙
1. **설정 허브**(`settings/page.tsx`): 링크 섹션과 앱 정보 사이에 "표시" 섹션(clay 카드) 추가 — 토글 행 1개: 라벨 "홈 친구 소식", 설명 "친구의 완성 소식을 홈에 보여줘요". 토글 = `settings.hideFriendFeed`의 **반전**(표시=on) — `/settings/sound` 페이지의 기존 토글 스위치 마크업 패턴을 모방(신규 토글 컴포넌트 발명 금지, sound 페이지는 읽기만).
2. 토글 변경 시 `updateSettings({ hideFriendFeed: ... })` + `feedbackTap()`.
3. **홈**(`home/page.tsx`): 친구 소식 섹션(`:861` 부근 `aria-label="친구 소식"`) 렌더 조건에 `!settings.hideFriendFeed` 추가. 숨김이어도 `/api/activity/friends` fetch는 그대로 둬도 무방(useCachedApi 구조 유지 — 조건부 훅 호출 금지).
4. 기본값(미설정)은 표시 — 기존 사용자 화면 무변화.

### 제약
- store.ts 수정 금지(선반영됨). localStorage 키 무변경. 데이터 내보내기 카드(W1)가 settings 페이지를 먼저 수정했으므로 **최신 파일 기준으로** 작업(섹션 순서: 링크 → 표시 → 데이터 → 앱 정보).

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- 코드 트레이스 로그: ①토글→store 경로 ②홈 조건부 렌더 좌표 ③조건부 훅 호출 없음 확인.

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**
