상태: 완료 (2026-07-10 sonnet 구현·검증 로그 완비 — 2026-07-11 fable 최종 확인, 실기기 항목은 device-checklist로 이관)

## blob-orphan-cleanup: 보드 삭제·회원 탈퇴 시 커스텀 사진 blob 정리

- 분류: 버그 후속(비용 방어) / 배정: **sonnet**
- 배경: 업로드 라우트(`boards/[id]/custom-image`)는 교체 시 이전 blob을 `del`로 지워 "고아 스토리지 누적 방지"를 명시했는데, **보드 삭제**와 **회원 탈퇴** 경로는 blob을 안 지운다 — 지워진 보드/계정의 사진이 스토리지에 영구 잔존.
- 필독: `docs/PRINCIPLES.md` §3(데이터층 게이트 — 이 카드는 additive 아님·응답 계약 무변경이라 통과), `src/app/api/boards/[id]/custom-image/route.ts`(기존 del 패턴)

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/api/boards/[id]/route.ts` — DELETE 핸들러
- `src/app/api/auth/me/route.ts` — DELETE(탈퇴) 핸들러

### 스펙

1. **보드 삭제**: DELETE 핸들러에서 삭제 전에 `customImageUrl`을 확보(기존 board 조회에 select 추가 또는 기존 조회 재사용 — 핸들러 구조 보고 판단). **DB 삭제 성공 후** `if (url) await del(url).catch(() => {})` — blob 삭제 실패는 무시(이미 지워졌거나 토큰 문제여도 보드 삭제 자체는 성공으로).
2. **회원 탈퇴**: 트랜잭션이 내 소유 보드를 전부 지우기 **전에** `prisma.board.findMany({ where: { ownerId: userId, customImageUrl: { not: null } }, select: { customImageUrl: true } })`로 URL 목록 수집 → **트랜잭션 성공 후** `del(urls).catch(() => {})` (`@vercel/blob` `del`은 배열 수용). 트랜잭션 실패 시 blob은 건드리지 않는다.
3. **순서 불변**: 반드시 DB 먼저, blob 나중 — blob을 먼저 지우고 DB가 실패하면 살아있는 보드의 사진이 깨진다(더 나쁜 상태). DB 성공 후 blob 실패는 고아 1건 잔존(수용).
4. **응답 계약 무변경** — 두 핸들러의 상태코드·본문 그대로. del은 응답에 영향 주지 않는 fire-and-forget이되 핸들러 안에서 await(서버리스 함수가 응답 후 백그라운드 작업을 보장하지 않음).
5. import는 `import { del } from '@vercel/blob'` — 기존 custom-image 라우트와 동일.

### 검증법
- `npx tsc --noEmit` + `npm run lint` 0 에러
- 검증 로그에: ①두 핸들러의 del 삽입 좌표와 "DB 성공 후" 순서 근거 ②탈퇴 쪽 URL 수집이 트랜잭션 **밖**(전)임을 확인 ③실패 무시 경로(catch) 좌표

### 검증 로그

**① del 삽입 좌표 + "DB 성공 후" 순서 근거**
- `src/app/api/boards/[id]/route.ts:247-256` — `await prisma.board.delete(...)` (247행)이 완료된 **다음 문장**으로 `if (board.customImageUrl) { await del(board.customImageUrl).catch(() => {}); }` (253-255행)을 배치. `board`는 245행 이전 `findUnique`에서 이미 `customImageUrl`을 select해 확보해둔 값(삭제 전 조회이므로 DB 삭제 자체보다 먼저 읽되, blob 삭제 호출 자체는 DB 삭제 완료 이후에 실행).
- `src/app/api/auth/me/route.ts:130-137` — `await prisma.$transaction(...)`이 예외 없이 반환된 **다음 코드**(catch 블록 밖, 130행부터)에서 `imageUrls` 필터링 후 137행 `await del(imageUrls).catch(() => {})` 호출. 트랜잭션 안에서 예외가 나면 130행 이후 코드 자체가 실행되지 않으므로(catch에서 바로 500 응답 후 return) blob 삭제가 절대 실행되지 않음 — 순서 보장.

**② 탈퇴 쪽 URL 수집이 트랜잭션 밖(전)인지 확인**
- `src/app/api/auth/me/route.ts:86-90` — `boardsWithImage`를 `prisma.board.findMany(...)`로 수집하는 코드가 `try { await prisma.$transaction(...) }` 블록(92행부터) **앞**에 위치. 트랜잭션이 보드를 지우기 전에 URL을 확보해두는 구조 그대로.

**③ 실패 무시 경로(catch) 좌표**
- `src/app/api/boards/[id]/route.ts:255` — `await del(board.customImageUrl).catch(() => {});`
- `src/app/api/auth/me/route.ts:137` — `await del(imageUrls).catch(() => {});`
- 둘 다 빈 catch로 예외를 삼켜 blob 삭제 실패가 DELETE 응답(상태코드·본문)에 영향을 주지 않음 — 응답 계약 무변경 확인.

**tsc / lint 결과**
- `npx tsc --noEmit` → 출력 없음(0 에러)
- `npm run lint` → `72 problems (0 errors, 72 warnings)` — 스펙에 명시된 기존 경고 72개 그대로, 신규 에러 0. 수정한 두 파일 관련 경고도 없음.

**스펙 대비 판단 지점**
- 탈퇴 쪽 `del()` 호출은 `imageUrls.length > 0`일 때만 실행하도록 가드 추가(스펙엔 명시 없었으나, 커스텀 사진이 없는 보드만 있는 계정에서 `del([])` 같은 불필요한 빈 배열 호출을 피하기 위한 판단 — `@vercel/blob`의 `del`은 빈 배열도 no-op으로 처리하지만 호출 자체를 생략하는 편이 명확).
- `boards/[id]/route.ts`의 `findUnique` select에 `customImageUrl: true`를 `ownerId: true`와 함께 추가(스펙 항목1 "기존 조회 재사용"에 해당 — 별도 조회를 새로 만들지 않고 기존 소유자 확인 쿼리에 필드만 추가).
