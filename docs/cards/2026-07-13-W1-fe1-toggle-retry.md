상태: 검증대기 (코드 완료·게이트 통과 — 눈검증: 토글 3종 동작·모션)

## FE-1: 공용 Toggle·RetryButton 신설 + 설정·알림축 정리 (F5·F4·F9·F12·F3)

- Severity: Med(일관성·a11y) / 분류: 컴포넌트 통합 / 배정: sonnet (반려 시 opus)
- 필독: CLAUDE.md 모션 규약(transition-all 금지·변하는 속성만 명시), Taste-review a11y 규약(text-warm-light 장식 전용), REVIEW_CHECKLIST 게이트 3·5

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/components/Toggle.tsx` (신규)
- `src/components/RetryButton.tsx` (신규)
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/settings/sound/page.tsx`
- `src/app/(app)/notifications/page.tsx`

### 문제/재현
1. **F5**: Toggle 컴포넌트가 3곳에 중복 정의 — `notifications/page.tsx:25`(size: 'default'|'large' 변형 보유), `settings/page.tsx:24`, `settings/sound/page.tsx:10`. sound·notifications 버전은 `transition-all` 사용(모션 규약 위반). settings 버전만 `transition-[left]`로 규약 준수.
2. **F4**: notifications:187의 "다시 불러오기" 재시도 버튼이 인라인 복붙(공용 부재). 홈(home:820)만 ClayButton 사용.
3. **F9**: `notifications/page.tsx:257` DND 구분자 "~"가 `text-warm-light`(AA 실패 토큰)로 의미 텍스트 렌더.
4. **F12**: `notifications/page.tsx:430` 리마인더 토글 `ariaLabel={\`${reminder.time} 리마인더 켜기\`}` — `type==='ripe'` 리마인더는 time이 빈값이라 스크린리더가 " 리마인더 켜기"로 읽음.
5. **F3**: settings 계열 에러 텍스트 색 확인 — 정본색과 다르면 통일.

### 스펙 (시험 가능한 문장)
- `src/components/Toggle.tsx` 신설: props `{ enabled, onToggle, size?: 'default'|'large', disabled?, ariaLabel }`. 시각 정본 = **settings/page.tsx:24의 현행 구현**(transition-[left] 등 명시 속성 — transition-all인 sound 버전 아님). 3개 페이지의 로컬 Toggle 정의 삭제 후 공용으로 치환. **onToggle 핸들러(스토어+서버 동기 로직)는 한 글자도 변경 금지 — 표현만 교체.**
- `board/[id]/page.tsx:1065`의 인라인 스위치는 **범위 외** (행 전체가 button + 내부 시각 span 구조라 공용 Toggle 치환 불가) — 건드리지 말 것.
- `settings/page.tsx:24` 부근 "신규 토글 컴포넌트 발명 금지 — W3 스펙" 주석을 "공용 `src/components/Toggle.tsx`가 정본 (2026-07-13 FE-1)"로 갱신.
- `src/components/RetryButton.tsx` 신설: `home/page.tsx:820`의 `<ClayButton variant="secondary">다시 불러오기</ClayButton>` 사용례를 정본으로 래핑. props `{ onRetry, label? }` (기본 라벨 "다시 불러오기"). notifications:187의 인라인 재시도를 이것으로 치환. (타 페이지 치환은 W3 카드 소관 — 여기서 하지 말 것.)
- F9: notifications:257 "~"를 `text-warm-sub`로.
- F12: ripe형이면 ariaLabel을 "익으면 알림 리마인더 켜기/끄기"로 분기.
- F3: 이 카드 소유 파일 내 에러 텍스트는 **rose 계열(`text-rose-500`)** 로 통일 (에러색 정본 — REVIEW-2026-07-13 §4 확정).

### 제약
- CLAUDE.md: 신규 코드 `transition-all` 금지 — Toggle 공용화 시 명시 속성만.
- 소유 파일 내 이미 재작성하는 라인의 transition-all만 치환 — 미수정 라인 drive-by 금지 (게이트 1 스코프).
- dual-store 커플링(게이트 5): 사운드 설정은 Zustand + feedback.ts 이중 저장 — 핸들러 로직 불변이면 안전.
- 리팩토링 금지 — 스펙에 명시된 변경만.

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test
git diff | grep -nE 'transition-all|text-warm-light' # 신규 0건이어야
grep -rn "function Toggle" src/app # 로컬 정의 잔존 0이어야
```

### 보고 전 자가검증
각 주장을 이 세션의 도구 결과와 대조 — 증거를 가리킬 수 있는 작업만 보고. 검증 안 된 것은 "미검증" 명시. 테스트 실패는 출력과 함께. 완료·검증된 것은 헤징 없이 완료로.

### 산출
diff + 검증 로그. **커밋 금지** (git add도 금지 — 페이블이 수행).
