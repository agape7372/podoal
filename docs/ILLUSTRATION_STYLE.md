# podoal 일러스트 스타일 가이드 & AI 생성 카탈로그

> **상태 (2026-07-06)**: 빈상태 8종 + 티어 배지 7종 **생성·배선 완료**(하단 자산 대장).
> 스타일은 아래 v2(플랫 이모지)로 확정 — 구 클레이 3D 프리앰블은 실기기 대조에서
> 앱과 괴리(사용자 판정)로 폐기. 앱 아이콘은 기존 Podo SVG 유지(AI 교체 안 함 —
> 마스코트=아이콘 일관성이 우선), OG AI 배경은 2회 구도 실패로 보류(코드 생성 OG 유지, P1).

## 스타일 프리앰블 v2 — 플랫 이모지 (2026-07-06 확정, 모든 생성 프롬프트 앞에 고정)

앱의 실제 그래픽 언어(플랫 Podo 마스코트·fluent 플랫 이모지·플랫 벡터 와인병)와
정합하도록 실화면 대조로 도출. **클레이 3D 아님.**

```
simple flat 2D vector illustration in modern flat emoji style, cute and kitsch,
minimal composition with very few elements, simple rounded geometric shapes,
flat solid colors with exactly one subtle darker flat tone per shape for shading,
no outlines, no gradients, no 3D render, no clay texture, no realistic lighting,
no photorealism, no text, no faces.
color palette: deep plum purple #7B5FB8 and #5C4482, light lavender #DCC4F2,
sage green #74A77E, warm brown #A97C50, pastel blue #9FBFE8,
soft yellow #F9E082, soft pink #F58BAE.
plain solid very light background #FBF7FE. subject: <소재>
```

- **모델 (2026-07-06 실측)**: Higgsfield `z_image` **0.15cr/장** — recraft_v4_1은
  유료 플랜 전용(`job_minimum_basic_plan_required`)이고 8배 비쌈. z_image가 이
  플랫 스타일에 충분. 프롬프트 준수 약점: "sticker/puffy" 단어는 다이컷 테두리를
  부르고, 배지류는 배지 프레임을 멋대로 두름("no frame, no rounded rectangle
  behind it" 명시로 억제), 개수 지정은 "exactly one" 강조.
- **파이프라인 (투명 추출 — 2026-07-06 최종)**: ① 로컬 rembg(`pip install rembg
  onnxruntime`, 모델 `isnet-general-use`)로 배경 제거 → ② **알파 재합성**: RGB는
  원본에서(rembg는 반투명 픽셀 색을 희석시킴), 알파는 rembg 마스크에 두 규칙 보정 —
  (a) a≥30이고 원본색이 배경 대표색과 dist>25면 255(색 있는 반투명 = 기둥·잎 복원)
  (b) 에지 비연결 내부이고 배경색 아니면 255(내부 구멍 봉합; 배경색 구멍=리본 고리
  안쪽은 유지) → ③ `node scripts/art-tile.mjs`(트림 → contain 리사이즈 → 투명 WebP q82).
  **하지 말 것(전부 실측 실패)**: 색 기반 플러드필(무외곽선 플랫에서 피사체 침식),
  Higgsfield `remove_background`(장당 ~1.15cr — 세트 부적합), 라운드 불투명 타일
  (사용자 판정: "이미지 가져다 쓴 것 같다").
- **앵커 전략**: 1호(empty-home)를 먼저 생성·사용자 승인 후 동일 프리앰블로 세트
  진행. 생성은 동시 1장 제한(free) — 직렬 제출(장당 ~10초).

## 검수 체크리스트 (자산별 통과 필수)

1. 배경 제거 후 흰색 **및** grape-100(#F4ECFB) 배경 위에서 엣지 헤일로 없음
2. 지배색이 grape/라벤더 계열, 보조색은 팔레트 8색 이내, 고채도 원색 없음
3. 매트 클레이 질감 — 광택 3D/실사 룩 배제
4. 96px과 40px 축소에서 실루엣 판독 가능
5. 문자/글자 없음, **얼굴/표정 없음** (repo CLAUDE.md 제약: Podo는 표정 금지,
   빈 상태는 정물 씬 — 사용자 재확인 2026-07-02)
6. WebP 변환 후 ≤60KB
7. 광원 방향 좌상단 통일(클레이 그림자 시스템과 정합)

## 생성 카탈로그

### A. 빈 상태 씬 8종 — `public/illustrations/empty/` (1:1, 480×480 목표)

| 파일명 | 삽입 위치 | 프롬프트 (프리앰블 뒤에) |
|---|---|---|
| `empty-home-v2.webp` | home/page.tsx 빈 상태 (EmptyState art) | a cozy miniature grape vineyard plot with one small empty wooden trellis and a tiny watering can, waiting to be planted |
| `empty-winery-v2.webp` | winery/page.tsx | a small clay wine cellar shelf with empty bottle slots and one corked empty bottle, warm and inviting |
| `empty-messages-v2.webp` | messages/page.tsx | a pastel clay mailbox with its flag down and a single grape leaf resting on top |
| `empty-vine-v2.webp` | vine/page.tsx | a young grape vine sprout in a clay pot with a small support stick, just beginning to grow |
| `empty-podong-v2.webp` | PodongList.tsx | three clay grape clusters connected by a soft ribbon loop, resting together |
| `empty-friends-v2.webp` | friends/page.tsx (친구 없음) | two empty clay picnic cushions facing each other with a tiny grape juice pitcher between them |
| `empty-favorites-v2.webp` | friends/page.tsx (즐겨찾기 없음) | a small clay star-shaped dish holding a single grape |
| `empty-reminders-v2.webp` | notifications/page.tsx | a round pastel clay alarm clock lying asleep on a grape leaf |

### B. 와이너리 티어 배지 7종 — `public/illustrations/tiers/` (1:1, 216×216 목표)

winery/page.tsx `TIER_ART` 레코드의 주석 해제 + 경로 기입으로 활성화.
(레벨별 현행 이모지: 1 🌱 새싹 → 2 🍇 수확생 → 3 🧃 주스 → 4 🍷 견습생 → 5 🥂 소믈리에 → 6 🏰 오너 → 7 👑 마스터)

| 파일명 | 프롬프트 (프리앰블 뒤에) |
|---|---|
| `tier-1-v2.webp` | a tiny clay grape seedling sprout badge, leaf green accents |
| `tier-2-v2.webp` | a plump clay grape bunch badge, lavender purple |
| `tier-3-v2.webp` | a cute clay grape juice box badge with a straw, lime accents |
| `tier-4-v2.webp` | a small clay wine glass badge with grape motif |
| `tier-5-v2.webp` | two clinking clay champagne glasses badge, sunshine sparkle dots |
| `tier-6-v2.webp` | a miniature clay winery chateau badge with grape vines |
| `tier-7-v2.webp` | a royal clay crown badge adorned with tiny grapes |

### C. 와인 품종 라벨 7종 — `public/illustrations/labels/` (1:1, 96×96 목표, P2)

WineBottle 디테일 패널(winery/page.tsx 선택 패널의 🍷 아이콘 자리, 48px)이 주 삽입점.
품종 = templateId 접두: health(leaf)/growth(sunshine)/lifestyle(lime)/work(grape)/social(juice)/hobby(ember)/mental(mist).
프롬프트: `a minimal clay emblem for a wine varietal, {품종 색} tinted, {모티프}` —
모티프: health=심장 새싹, growth=떠오르는 해, lifestyle=집, work=책, social=꽃다발, hobby=팔레트, mental=구름과 달.

### D. 앱 아이콘 마스터 — 1024×1024 (불투명)

- 프롬프트: 프리앰블 + `app icon of a plump claymorphism grape bunch with two leaves,
  centered, filling 70% of frame, solid lavender gradient background #DCC4F2 to #B28CDC`
- 처리: 512/192 리사이즈(`any`), 180은 불투명 유지(apple-touch), maskable은 모티프를
  중앙 80% 안에 재배치 + 풀블리드 배경. maskable.app에서 크롭 미리보기 검증.
- 갱신 시 **`public/sw.js` CACHE_VERSION 범프 필수** (아이콘은 cache-first).
- `public/icons/icon.svg`는 이미 브랜드 hex로 정정됨(코드 작업) — AI 마스터는 PNG 세트만 담당.

### E. OG 배경 — 1200×630 (PNG) ✅ 완료 (2026-07-07)

- **채택된 방법(와이드 배너 직접 생성은 2회 구도 실패 — 금지)**: 1:1 비네트 1장만
  생성(v2 프리앰블 + 트렐리스·포도·언덕) → 배경 제거 없이 **비네트의 배경색(#fcf5eb)을
  캔버스 전체 색으로 통일**(이음새 제거) → `art-intake/og-compose.html`(MaruBuri
  Bold 118px "포도알" + SemiBold 40px 부제, 로컬 woff2)을 playwright로 1200×630
  스크린샷 → `src/app/opengraph-image.png` 같은 경로 교체.
- 같은 경로 교체는 교체 규칙의 **의도된 예외** — OG는 SNS 크롤러 대상이라 sw.js
  이미지 캐시와 무관. 문구·아트 변경 시 og-compose.html 수정 후 재스크린샷.

### F. iOS 스플래시 6종 — `public/splash/` (P2, AI 생성 아님)

아이콘 마스터를 단색 배경(#FBF7FE) 중앙에 합성하는 결정적 작업.
크기: 1170×2532, 1179×2556, 1290×2796, 1125×2436, 828×1792, 1620×2160.
layout.tsx head의 apple-touch-startup-image 링크는 이미 준비됨(주석 참조).

## 자산 대장 (생성 시 기록)

| 파일 | 프롬프트 요약 | 모델 | 생성일 | 라이선스 확인 | 앵커 |
|---|---|---|---|---|---|
| empty/empty-home-v2.webp | 트렐리스+포도+물뿌리개 1개 | z_image | 2026-07-06 | Higgsfield 유료 크레딧 생성물 — ToS상 상업 이용 가(구독/크레딧 생성물 소유권 사용자 귀속; 재확인 권장) | ✅ (세트 앵커) |
| empty/empty-winery-v2.webp | 빈 와인 랙+병 1 | z_image | 2026-07-06 | 상동 | |
| empty/empty-messages-v2.webp | 라벤더 우체통+잎 | z_image | 2026-07-06 | 상동 | |
| empty/empty-vine-v2.webp | 화분 새싹+지지대 | z_image | 2026-07-06 | 상동 | |
| empty/empty-podong-v2.webp | 포도 3송이+리본 고리 | z_image | 2026-07-06 | 상동 | |
| empty/empty-friends-v2.webp | 방석 2+주스 주전자 | z_image | 2026-07-06 | 상동 | |
| empty/empty-favorites-v2.webp | 별 접시+포도 1알 | z_image | 2026-07-06 | 상동 | |
| empty/empty-reminders-v2.webp | 잎 위 알람시계 (수용부 미배선 — notifications는 EmptyState 미사용, P1) | z_image | 2026-07-06 | 상동 | |
| tiers/tier-1~7-v2.webp | 새싹/포도/주스팩/와인잔/샴페인/샤토/왕관 | z_image | 2026-07-06 | 상동 | |
| src/app/opengraph-image.png | OG: 비네트(트렐리스·포도·언덕)+MaruBuri 타이포 합성(§E) | z_image | 2026-07-07 | 상동 | |

- 총 소요: 생성 29회(재생성 포함) + API 배경제거 시험 1회 ≈ 5.45cr (잔여 ~4.65cr).
- 재생성 사유 기록: 물뿌리개 중복·찬 선반·배지 프레임 3회·왕관 얼굴 1회·OG 와이드 구도 2회(→ §E 비네트 방식으로 해결).

## 교체 규칙

- **같은 URL에 내용 교체 금지** — sw.js가 이미지 cache-first라 설치된 PWA에 영원히
  구버전이 남는다. 반드시 파일명 버전 접미를 올려(`-v1` → `-v2`) 참조를 갱신할 것.
- 아이콘(경로가 manifest에 고정)만 예외적으로 CACHE_VERSION 범프로 무효화.
- APP_SHELL 프리캐시에 일러스트를 추가하지 말 것(셸 최소 유지).
