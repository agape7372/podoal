상태: 검증대기

## W1-auth-error-korean: 비번 변경 에러 한국어화 (GAP-10)

- 분류: 위생(제안-2 채택) / Severity Low / 배정: **haiku**
- 필독: 이 카드만. (참고: 에러 문구는 한국어 해요체 — PRINCIPLES §3)

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/lib/authErrors.ts` (신규)
- `src/app/page.tsx`
- `src/app/(app)/profile/page.tsx`

### 문제/배경
`describeAuthError`(영문 서버 메시지→한국어 매핑)가 `src/app/page.tsx:41-51`에 사설 함수로 있어 프로필의 비밀번호 변경 실패 시(`profile/page.tsx:129`) 영문 메시지(`Unauthorized`, `User not found`)가 그대로 노출된다(PERSONA_REVIEW GAP-10).

### 스펙
1. `src/lib/authErrors.ts` 신규: `export function describeAuthError(message: string): string` — `src/app/page.tsx:41-51`의 함수를 **본문 그대로 이동**하고 맵에 2행 추가:
   - `'Unauthorized'` → `'로그인이 필요해요. 다시 로그인해주세요.'`
   - `'User not found'` → `'계정을 찾을 수 없어요. 다시 로그인해주세요.'`
   기존 주석(라인 39-40)도 함께 이동.
2. `src/app/page.tsx`: 로컬 `describeAuthError` 함수 삭제, `import { describeAuthError } from '@/lib/authErrors';`로 대체. `describeOAuthError`(별개 함수)는 **건드리지 않는다**.
3. `src/app/(app)/profile/page.tsx`: catch에서 서버 메시지를 화면에 그대로 쓰는 곳을 전부 `describeAuthError(...)`로 감싼다 — 최소 `:129`(비번 변경). `:84`·`:142` 부근 catch도 서버 메시지를 노출하면 동일 처리(폴백 문자열만 쓰는 catch는 그대로 둠).

### 제약
- 함수 rename 금지, 매핑 문자열(기존 6행) 변경 금지. 로직 수정 금지 — 이동+추가+임포트만.

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- `grep -rn "describeAuthError" src/` 결과를 로그로: 정의 1곳(lib) + 사용처(page.tsx, profile).

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**

### 검증 로그 (2026-07-08)

**1. TypeScript 타입 체크**
```
npx tsc --noEmit
```
✓ 결과: 통과 (0 에러)

**2. ESLint 린팅**
```
npm run lint
```
✓ 결과: 통과 (21개 기존 warning, 새 에러 없음, check-icons 통과)

**3. 함수 정의 및 사용처 검증**
```
grep -rn "describeAuthError" src/
```
✓ 정의: 1곳 (`src/lib/authErrors.ts:3`)
✓ 사용처: 4곳
  - `src/app/page.tsx:14` (import)
  - `src/app/page.tsx:128` (login/register 폼 에러 표시)
  - `src/app/(app)/profile/page.tsx:8` (import)
  - `src/app/(app)/profile/page.tsx:86` (프로필 저장 에러)
  - `src/app/(app)/profile/page.tsx:130` (비밀번호 변경 에러)
  - `src/app/(app)/profile/page.tsx:148` (계정 삭제 에러)

**변경 요약**
- `src/lib/authErrors.ts` 신규: 기존 함수 이동 + `Unauthorized`, `User not found` 2행 추가
- `src/app/page.tsx`: 로컬 함수 삭제, lib import로 대체
- `src/app/(app)/profile/page.tsx`: import 추가, 3곳 catch 블록에 `describeAuthError()` 래핑

**검증 완료**: 스펙 준수, 타입 안전, 이동 + 추가 + 임포트만 적용 ✓
