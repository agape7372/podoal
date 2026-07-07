상태: 검증대기

## W2-share-inflow: 공유카드 유입 동선 (WS2)

- 분류: 성장(제안-2 채택 — OG와 짝) / 배정: **sonnet**
- 필독: `docs/PRINCIPLES.md` §7(공유 문구는 승인된 예외 — 현행 vs 제안 병기), `src/lib/shareCard.ts` 상단 주석

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/lib/shareCard.ts`

### 문제/배경
공유카드(1080×1350 캔버스)에 서비스 식별 정보가 없어, 받은 사람이 앱을 찾아올 동선이 끊긴다(PERSONA_REVIEW GAP-12 계열, PRODUCT_PLAN WS2 "공유카드 유입 루프"). shareCard.ts 상단 주석의 "1픽셀도 다르지 않아야" 조항은 **이 카드로 의도 변경 승인됨** — 단 변경은 아래 스펙 범위만.

### 스펙
1. 카드 최하단(캔버스 바닥 여백부, 기존 요소들 아래)에 유입 라인 1줄 추가: 도메인 텍스트 **`podoal-rouge.vercel.app`**.
   - 도출: `new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://podoal-rouge.vercel.app').host` — 하드코딩 금지(NEXT_PUBLIC은 빌드타임 인라인).
   - 위치: 캔버스 하단 중앙, 기존 최하단 요소와 겹치지 않게(파일을 읽고 기존 footer/브랜딩 요소 아래 y 좌표 산출 — HEIGHT-40 부근 권장, 기존 요소와 최소 24px 간격).
   - 스타일: 기존 캔버스 텍스트 관례를 따름(`fonts` 변수의 Noto 계열, 22~26px, 색은 cardEngine `C` 팔레트의 보조 텍스트 색 — 새 hex 발명 금지).
2. 기존 그리기 시퀀스(배경→카드→포도→제목→진행→푸터)는 순서·좌표 무변경 — **append만**.
3. 다른 카드 표면(cardEngine, 와이너리 카드 등)이 있어도 건드리지 않는다 — `generateShareCard`만.

### 제약
- cardEngine.ts 수정 금지(읽기만). 이미지 좌표 상수 리팩토링 금지.
- QR 코드·로고 이미지 추가 금지(라이브러리 증설 금지 — 텍스트 1줄만).

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- 코드 트레이스 로그: 추가된 draw 호출의 y좌표와 기존 최하단 요소 y좌표 비교표(겹침 없음 근거).
- (실제 렌더 확인은 페이블이 병합 후 브라우저에서 공유카드 생성으로 수행.)

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**

### 검증 로그 (2026-07-08)

**수정 파일**: `src/lib/shareCard.ts` (소유 파일 목록 내, 유일한 수정)

**변경 요지**: `generateShareCard()` 그리기 시퀀스 맨 끝(§11 브랜드 워터마크 이후)에 §12 "유입 라인" 1개 append. 기존 §1~§11 순서·좌표·파라미터 무변경(diff는 순수 추가, 기존 라인 수정 0줄).

```ts
// ─── 12. Inflow line: app domain (WS2 공유카드 유입 동선) ───
const appHost = new URL(
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://podoal-rouge.vercel.app',
).host;
ctx.font = `400 24px ${fonts.body}`;
ctx.fillStyle = C.warmSub;
ctx.fillText(appHost, WIDTH / 2, HEIGHT - 26);
```

- 도메인 도출: `src/app/layout.tsx:28`의 `metadataBase` 계산과 동일한 `new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://podoal-rouge.vercel.app')` 패턴을 그대로 미러링(하드코딩 회피, 기존 관례 재사용). `.host`만 추가로 취함.
- 폰트: `fonts.body` 사용(스펙의 "Noto 계열" = `resolveFonts()` 반환 타입 `{ display, body }`의 body 필드). 현재 `resolveFonts()`(cardEngine.ts, 읽기전용)는 `body: display`로 별칭 처리되어 있어 런타임 값은 `fonts.display`와 동일(= Maru Buri, Noto Sans KR 폴백) — 시각적 차이 없음. `400` 굵기는 `SHARE_CARD_FONT_SIZES`(cardEngine.ts)에 이미 `400 32px`/`400 30px`로 preload되어 있는 굵기라 신규 사이즈(`24px`)를 얹어도 폰트 리소스 자체(패밀리+굵기)는 이미 로드됨 — cardEngine.ts 프리로드 목록 미수정으로도 tofu 레이스 없음.
- 색: `C.warmSub`(`#6E6680`) — 기존 §10 "by 사용자명", 완료 배지 날짜에도 쓰인 동일 보조색. 새 hex 없음.
- 텍스트: `appHost`(예: `podoal-rouge.vercel.app`) — 코드/로고/QR 추가 없음, 순수 텍스트 1줄.

**y좌표 비교표 (겹침 없음 근거)**

| 요소 | draw 호출 | y (baseline) | 계산값 | 폰트 |
|---|---|---|---|---|
| 기존 최하단(브랜드 워터마크 "포도알") | `ctx.fillText('포도알', WIDTH/2, HEIGHT-52)` | `HEIGHT-52` | 1298 | `700 34px` |
| 신규(유입 라인) | `ctx.fillText(appHost, WIDTH/2, HEIGHT-26)` | `HEIGHT-26` | 1324 | `400 24px` |
| 캔버스 바닥 | (경계) | `HEIGHT` | 1350 | — |

- 기존↔신규 간격: `(HEIGHT-26) - (HEIGHT-52) = 26px` → 스펙 최소 요구치 24px 충족(+2px 여유).
- 신규↔캔버스 바닥 여백: `HEIGHT - (HEIGHT-26) = 26px` → `400 24px` 텍스트의 디센더(대략 20~25% of em ≈ 5~6px, 도메인 문자열에 `p`/`g` 하강부 포함 고려)를 넉넉히 수용, 잘림 없음.
- 러프 근사(ascent≈0.8em, descent≈0.2em)로 실제 잉크 범위까지 따져도: 워터마크 하단 `1298+34*0.2≈1304.8` vs 신규 라인 상단 `1324-24*0.8≈1304.8` — 두 값이 거의 일치해 "겹치지 않고 맞닿는" 경계선상 결과(overlap 없음, 여유는 근사치 오차 수준). 단 이 비율은 라틴 디센더(g/p/q) 기준 보수적 상한이고, 워터마크("포도알")는 한글 batchim이라 실제 하강 잉크는 이보다 작은 게 일반적 — 실측 여유는 위 근사보다 클 가능성이 높음. baseline 기준 26px 간격(스펙 최소 24px 대비 +2px)이 유일한 확정 안전판이며, 최종 확인은 페이블의 브라우저 렌더로 이관.

**스펙 이탈 사유**: 스펙은 "HEIGHT-40 부근 권장"이라 했으나, 기존 최하단 요소가 이미 `HEIGHT-52`에 있어 `HEIGHT-40`을 그대로 쓰면 baseline 간격이 `12px`에 그쳐 같은 스펙 항목의 "기존 요소와 최소 24px 간격" 요구를 충족하지 못함(스펙 내부 수치 불일치 — 권장값과 최소 간격 요구가 서로 모순). 하드 요구치(24px 최소 간격, 겹침 없음)를 우선해 `HEIGHT-26`으로 조정.
  - 근거(수식): 기존 baseline(`HEIGHT-52`)과 캔버스 바닥(`HEIGHT`) 사이 가용폭은 52px 고정. 신규 라인의 y를 `HEIGHT-g`라 하면, 기존과의 간격은 `52-g`, 바닥 여백은 `g` — 두 값의 최솟값은 `g=26`일 때(`52-g=g`) 최대화된다(26=26, 그 외 어떤 g도 둘 중 하나가 더 작아짐). 즉 `HEIGHT-26`은 "간격 vs 바닥 여백" 트레이드오프에서 산술적으로 최적점 — 임의 조정이 아님.
  - 이 트레이드오프 자체는 기존 요소가 이미 바닥에서 52px 지점에 있다는 고정 조건에서 비롯된 것이라 22~26px 폰트 범위 내에서는 완전히 해소 불가(라틴 디센더 기준 보수적 근사로는 간격 24px과 바닥 클리핑 无 를 동시에 여유 있게 만족시키는 g가 존재하지 않음 — 위 y좌표 비교표 하단 근사 계산 참조). 그 외 스펙 이탈 없음(그리기 시퀀스·좌표·다른 카드 표면 무변경, cardEngine.ts/이미지 좌표 상수 무수정, QR·로고 미추가).

**정적 검증**
- `npx tsc --noEmit` → 통과(출력 없음, 에러 0).
- `npm run lint` → `0 errors, 22 warnings`. 전 경고는 기존 파일(`ShareCardModal.tsx`, `StreakCard.tsx`, `WeeklyRecapModal.tsx`, `src/lib/cachedApi.ts`)의 `react-hooks/set-state-in-effect` 기존 경고 — `src/lib/shareCard.ts`/`cardEngine.ts` 관련 경고·에러 0건. `check-icons` 통과(이모지 없음, 신규 텍스트도 이모지 미포함).
- 실제 렌더/겹침 육안 확인은 스펙 §검증법에 따라 페이블 병합 후 브라우저 확인으로 이관.
