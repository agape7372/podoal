상태: 검증대기

## W1-data-export: 내 데이터 JSON 내보내기 (신뢰 장치)

- 분류: 기능(백로그 "데이터 내보내기" 카드 변환) / Severity Low / 배정: **sonnet**
- 필독: `docs/PRINCIPLES.md` §3(데이터 레이어 게이트 — additive 신규 라우트)·§5(UI 일부), `CLAUDE.md` "Patterns" 절(가드 패턴)

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/api/export/route.ts` (신규)
- `src/app/(app)/settings/page.tsx`

### 문제/배경
탈퇴 기능은 있는데 내 기록을 가져갈 방법이 없다(PERSONA_REVIEW REQ-07 — 탈퇴와 짝인 신뢰 장치). 읽기 전용 저위험.

### 스펙 (시험 가능한 문장)
1. `GET /api/export` — 로그인 필수(`getCurrentUserId()` + `authResponse()` 패턴, 미로그인 401).
2. 응답: `Content-Disposition: attachment; filename="podoal-export-<userId 앞8자>.json"` + `Content-Type: application/json`. 본문은 아래 구조:
   - `exportedAt`(ISO), `user`(id·name·email·avatar·createdAt — **password·provider 계열 제외**),
   - `boards`: 내 소유(ownerId=me) + 내가 받은 선물(giftedToId=me) 보드 전부 — 각각 title·description·totalStickers·isCompleted·completedAt·createdAt·cellarNote·harvestedAt + `stickers`(position·filledAt) + `rewards`(type·title·content·triggerAt·unlockedAt·revealedAt — 내 보드 것이므로 전부 포함),
   - `capsules`: 내가 쓴 것(userId=me) — message·openAt·isOpened·createdAt,
   - `messages`: 내가 보낸 것 + 받은 것 — content·type·emoji·createdAt + 상대는 `{ id, name }`만(이메일 금지),
   - `friends`: accepted만 — 상대 `{ id, name }` + since(createdAt),
   - `reminders`: time·days·message·isActive,
   - `plantedGiftsByMe`: 내가 남의 보드에 심은 것 — message·emoji·position·revealedAt·createdAt.
3. **깜짝선물 스포일러 금지**: 내 보드에 **남이** 심은 PlantedGift는 `revealedAt`이 null이면 **제외**(포함 시 서프라이즈 파괴). 공개된 것만 message·emoji 포함.
4. 설정 허브(`settings/page.tsx`): 기존 링크 섹션 아래에 "데이터" 섹션(clay 카드) 추가 — 행 1개 "내 데이터 내보내기" + 설명 "지금까지의 기록을 JSON 파일로 받아요". `<a href="/api/export" download>` 방식(라우터 이동 아님), 기존 행과 동일한 스타일(EmojiIcon 💾 or 📦 + Chevron 없음).

### 제약
- 신규 env 없음. 스키마 무변경. 기존 API 무수정.
- 쿼리는 select로 필요한 필드만(민감 필드 기본 배제 습관).
- 에러 문구 한국어 해요체.

### 검증법
- `npx tsc --noEmit` + `npm run lint` 통과.
- 코드 트레이스 로그: ①미로그인 401 경로 ②unrevealed 타인 planted gift 배제 조건 좌표 ③password 필드가 select에 없음을 diff로 명시.
- (런타임 curl 검증은 페이블이 병합 후 수행 — dev 서버 직접 띄우지 말 것.)

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지(git add도 금지).**

### 검증 로그 (2026-07-08)

**수정 파일**
- `src/app/api/export/route.ts` (신규, 167줄)
- `src/app/(app)/settings/page.tsx` (데이터 섹션 15줄 추가, 기존 링크 섹션과 앱 정보 섹션 사이)

**명령 실행 결과**
```
$ npx tsc --noEmit
(출력 없음 — 타입 에러 0건)

$ npm run lint
> eslint . && node scripts/check-icons.mjs
✖ 22 problems (0 errors, 22 warnings)
✓ check-icons: 모든 이모지가 플랫 SVG로 커버됨 · JSX 생이모지 없음 · 선택지 배열 커버됨
```
22개 경고는 전부 `react-hooks/set-state-in-effect`이며 기존 파일(board/[id], home, friends 등)에서만
발생 — CLAUDE.md에 명시된 기존 warn 규칙(fetch-on-mount 패턴)이고 이번 카드가 만든 두 파일에는
0건. 이모지 💾(`1f4be.svg`)는 `public/icons/fluent/`에 이미 존재해 신규 자산 불필요.

**코드 트레이스 좌표 (스펙 검증 3항목)**

① 미로그인 401 경로 — `src/app/api/export/route.ts:9-12`
```ts
const userId = await getCurrentUserId();
if (!userId) {
  return authResponse('로그인이 필요해요.', 401);
}
```
`getCurrentUserId()`가 JWT 쿠키 부재/무효 시 null 반환(`src/lib/auth.ts:35-42`) → 여기서 401 조기 반환.
DB 쿼리는 전부 이 가드 통과 후에만 실행(라인 14 `try` 블록 진입 전 이미 401로 끝남).

② unrevealed 타인 planted gift 배제 조건 — `src/app/api/export/route.ts:61-65`
```ts
plantedGifts: {
  where: { revealedAt: { not: null }, plantedById: { not: userId } },
  select: { message: true, emoji: true, revealedAt: true },
  orderBy: { revealedAt: 'asc' },
},
```
Prisma 중첩 relation 필터라 DB 레벨에서 `revealedAt IS NOT NULL`인 행만 애초에 안 내려온다(앱
레이어에서 사후 필터링이 아니라 쿼리 자체가 배제 — 필터 누락 회귀 여지 최소화). `plantedById: {
not: userId }`는 방어적 조건(plant-gift POST가 이미 셀프플랜트를 400으로 막음 —
`src/app/api/boards/[id]/plant-gift/route.ts:31` `if (board.ownerId === userId) return
authResponse('내 포도판에는 심을 수 없어요', 400);` — 그래서 내 보드에 남는 PlantedGift는 항상
타인 소유지만 명시).

③ password 필드가 select에 없음 — `src/app/api/export/route.ts:15-18`
```ts
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, name: true, email: true, avatar: true, createdAt: true },
});
```
User 모델 전체 필드(`prisma/schema.prisma:10-41`): id·name·email·**password**·avatar·**provider**·
**providerId**·createdAt·**streakFreezeDate**·**streakFreezeUsedAt** + 관계 필드들. select는
화이트리스트 5개(id·name·email·avatar·createdAt)뿐이라 password·provider·providerId·streakFreeze*
전부 diff상 원천 부재(블랙리스트/omit 방식이 아니라 select만 사용 — 신규 민감 필드가 추가돼도
자동으로 안전).

**적대 검증 메모 (PRINCIPLES §10 각도 2개)**
- **권한 각도**: 비로그인 요청 → ①에서 401. 남의 계정 데이터 접근 경로 없음(모든 쿼리가
  `userId`/`ownerId`/`giftedToId`/`plantedById`/`senderId`/`receiverId` 중 하나로 필터링되고
  그 값은 전부 세션의 `userId`에서만 옴 — 요청 바디/쿼리 파라미터를 신뢰하는 지점 없음, GET이라
  입력 자체가 없음).
- **경계값 각도**: 보드/캡슐/메시지/친구/리마인더/planted-gift가 전부 0건인 신규 계정 →
  `findMany`는 무조건 `[]` 반환(에러 아님), `messages`/`friends`는 배열 map+sort라 빈 배열도
  안전하게 `[]`로 수렴. `userId.slice(0,8)`은 cuid(25자 안팎)라 항상 안전하고, 설사 8자 미만이어도
  `slice`는 예외 없이 있는 만큼만 반환.

**스펙 해석/이탈 메모** (스펙 문면이 명시하지 않아 구조적으로 판단한 부분 — 반려 시 재조정 지점)
1. **`boards[].plantedGifts` 필드 신설**: 스펙 2항의 boards 필드 나열(title·description·...·rewards)엔
   없지만, 3항이 "내 보드에 남이 심은 PlantedGift"의 공개/비공개 처리를 요구해 3항을 이행할
   자리가 필요했음. 보드 스코프 데이터라 판단해 board 객체 안에 중첩(message·emoji·revealedAt).
   3항 문면이 명시한 필드(message·emoji)만 넣고 position/plantedBy 신원은 제외(최소 노출).
2. **`messages[].direction`/`counterpart` 필드 신설**: 스펙이 "내가 보낸 것 + 받은 것"을 하나로
   합치라면서 "상대"라는 표현을 쓰는데, 방향 구분자 없인 합쳐진 배열에서 sent/received를
   구별할 수 없어 `direction: 'sent'|'received'` + `counterpart: {id,name}`을 추가.
3. **`id` 필드는 boards/capsules/messages/reminders/plantedGiftsByMe 어디에도 미추가**: `user`
   객체만 스펙이 명시적으로 `id`를 나열하고 나머지 엔티티는 나열 안 함 — 의도적 대비로 해석해
   문면 그대로(스펙 밖 필드 추가 안 함) 구현. capsules의 `emoji`, rewards의 `imageUrl`도 같은
   이유로 제외(모델엔 있지만 스펙 나열에 없음).
4. **Content-Type/Content-Disposition**: `Response.json()`의 암묵적 헤더 병합에 기대지 않고
   `new Response(JSON.stringify(...), { headers: {...} })`로 두 헤더를 명시 설정(스펙 문면 그대로
   보장, 검증 가능성 우선).

**미검증 항목**: 런타임 curl 검증(카드 지시대로 dev 서버 미기동 — 병합 후 페이블 수행).
