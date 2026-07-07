상태: 대기

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
