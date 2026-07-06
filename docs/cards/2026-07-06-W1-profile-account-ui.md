상태: 검증대기

## W1-D-UI: 프로필 계정 관리 섹션 (로그아웃·비밀번호 변경·회원탈퇴)

- Severity/분류: 기능 추가(사용자 확정) / 배정: sonnet
- 필독: PRINCIPLES §5(UI 체크리스트), CLAUDE.md ConfirmDialog·clay 유틸 규약
- 소유 파일 (이 목록 밖 수정 시 반려):
  - src/app/(app)/profile/page.tsx

### 배경 (자립 설명)

/profile은 현재 name+avatar 편집만 있다. 하단에 "계정" 섹션을 추가한다. **API는 병렬로 별도 작업 중** — 아래 컨트랙트 기준으로 구현하고, 실호출 통합 검증은 상위 모델이 수행한다. 사용자 정보는 기존 페이지가 쓰는 현재 유저 상태(GET /api/auth/me 응답: `user.provider` 포함)를 재사용.

**API 컨트랙트 (확정)**:
- `POST /api/auth/logout` → 200 `{ok:true}` (쿠키 클리어)
- `PATCH /api/auth/password` body `{currentPassword, newPassword}` → 200 `{ok:true}` | 400(형식: "새 비밀번호는 6자 이상이어야 해요" 등 서버 문구 표시) | 403(현재 비밀번호 불일치)
- `DELETE /api/auth/me` → 200 `{ok:true}` (계정·데이터 삭제 + 쿠키 클리어)

### 스펙 (시험 가능)

1. 페이지 하단 "계정" 섹션(clay 카드, 기존 페이지 스타일 모방):
   - **로그아웃** 행: 탭 → POST logout → 성공 시 `window.location.href = '/'` (하드 이동 — 클라 상태 전부 리셋 목적. router.push 금지).
   - **비밀번호 변경** 행: `user.provider`가 null(이메일 계정)일 때만 렌더. 탭 → 인라인 폼 또는 시트: 현재 비밀번호·새 비밀번호(6자 이상)·확인 3필드, `.clay-input`, 제출 → PATCH. 성공 토스트/문구 "비밀번호를 바꿨어요", 실패 시 서버 메시지 그대로 표시. 입력은 16px(줌 방지 — 기존 input 관례 따름).
   - **회원탈퇴** 행(붉은 계열 경고 톤, 단 juice 팔레트 사용): 탭 → `<ConfirmDialog>` 1차("정말 떠나시나요? 포도판·친구·기록이 모두 사라져요") → 확인 시 2차 ConfirmDialog("되돌릴 수 없어요. 정말 삭제할까요?") → DELETE → 성공 시 `window.location.href = '/'`.
2. 모든 비동기 버튼 disabled/진행 상태 처리(이중 제출 방지).
3. OAuth 계정(provider non-null)은 비밀번호 행 대신 캡션 "소셜 계정은 비밀번호가 없어요" 1줄.

### 제약

- `window.confirm` 금지(ConfirmDialog만). transition-all 금지. `src/lib/store.ts` 수정 금지(하드 리다이렉트가 리셋을 담당). 새 라우트 파일 생성 금지(API는 타 작업 소유).
- 문구는 위 스펙 그대로(승인됨). 그 외 카피 창작 금지.

### 검증법

- API 미가동 상태에서도: `npm run lint` + `npx tsc --noEmit` 통과 + /profile 렌더에서 3행 노출(이메일 계정), OAuth 모킹(user.provider 값 임시 콘솔 조작 아님 — dev 계정은 이메일 계정이므로 3행 전부 보임)확인.
- 통합(상위 모델): 비번 변경 후 재로그인, 탈퇴 후 로그인 불가.

### 산출: diff + 검증 로그. **커밋 금지**(git add도 금지).
