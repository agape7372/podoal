상태: 완료 (2026-07-10 — 사용자 승인·시행, 로컬 Playwright 렌더 확인. 프로드 확인은 PR 머지 후)

## privacy-publish: 개인정보처리방침 게시 — /settings/privacy

- 분류: 계측 선결(ANALYTICS_PLAN §4 결정 2) / 배정: fable
- 확정값: 책임자 "운영자" / zaballgam@gmail.com / 시행일 2026-07-10 (사용자 답변 2026-07-10)

### 변경 파일
- `src/app/(app)/settings/privacy/page.tsx` (신규) — DRAFT §1~10 전사 정적 페이지, /settings/sound 하위 페이지 패턴(← 백버튼 + font-display h1), clay 섹션·Row/Section 헬퍼, 생이모지 0
- `src/app/(app)/settings/page.tsx` — 앱 정보 섹션에 방침 링크 행
- `docs/PRIVACY_POLICY_DRAFT.md` — 상태 "게시 완료"·빈칸 기입·체크리스트 갱신 (문서가 정본, 개정 시 문서 → 페이지 → 앱 공지 순)
- `docs/ANALYTICS_PLAN.md` §4 결정 2 — 게시 완료 표기

### 검증 로그 (2026-07-10, fable)
- tsc 0 에러 · lint 0 에러(check-icons 통과) · 로컬 dev에서 전 조항 렌더 스크린샷 확인
- 잔여(문서에 이미 기록): 미성년자 결제 조항은 P3 수익화 착수 시 추가
