# podoal 일러스트 스타일 가이드 & AI 생성 카탈로그

> **상태 (2026-07-03)**: AI 생성은 크레딧 사정으로 **연기**(사용자 결정). 코드는 이미
> 아트를 수용할 준비가 되어 있다 — `EmptyState`의 `art` prop, winery의 `TIER_ART`
> 레코드, OG 파일 컨벤션. 크레딧 확보 후 아래 카탈로그대로 생성해 파일만 떨어뜨리면
> 즉시 교체된다. 생성 전까지는 기존 EmojiIcon 폴백이 그대로 렌더된다.

## 스타일 프리앰블 (모든 생성 프롬프트 앞에 고정)

```
claymorphism soft-3D illustration, matte clay texture, soft pastel palette,
lavender grape theme (#B28CDC primary, #DCC4F2 light, #7D58A8 deep),
accents only from: leaf green #8FC972, sunshine yellow #F9E082,
juice pink #F58BAE, lime #CFDC78, cream #FBFCEE, ember orange #F2A25C,
mist blue #9FBFE8. single centered subject, rounded plump forms,
top-left soft lighting, subtle purple-tinted contact shadow,
plain solid light background (#FBF7FE) for clean removal,
no text, no letters, no outlines, no faces, no characters with expressions,
no photorealism, no glossy render
```

- **모델 권장**: Higgsfield `recraft_v4_1`(1.25cr/장) — `colors` 파라미터에 위 hex
  팔레트 지정 + `background_color: "#FBF7FE"` 지정 가능(배경 제거 정밀도↑).
  `model_type: "standard"`(질감 표현) 또는 아이콘류는 `"vector"`.
- **파이프라인**: `generate_image` → 검수 → `remove_background`(media_type: image)
  → (필요시 `upscale_image`) → cwebp/sharp로 투명 WebP q82 변환 → 크기 확인(≤60KB)
  → `public/illustrations/<분류>/<이름>-v1.webp` 로 저장.
- **앵커 전략**: 1호(empty-home)를 먼저 생성·승인 → 이후 전 생성에 reference image로
  투입(`medias` role: image_references — recraft는 미지원이므로 recraft 사용 시엔
  프리앰블 고정 + colors 파라미터로 일관성 확보).

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
| `empty-home-v1.webp` | home/page.tsx 빈 상태 (EmptyState art) | a cozy miniature grape vineyard plot with one small empty wooden trellis and a tiny watering can, waiting to be planted |
| `empty-winery-v1.webp` | winery/page.tsx | a small clay wine cellar shelf with empty bottle slots and one corked empty bottle, warm and inviting |
| `empty-messages-v1.webp` | messages/page.tsx | a pastel clay mailbox with its flag down and a single grape leaf resting on top |
| `empty-vine-v1.webp` | vine/page.tsx | a young grape vine sprout in a clay pot with a small support stick, just beginning to grow |
| `empty-podong-v1.webp` | PodongList.tsx | three clay grape clusters connected by a soft ribbon loop, resting together |
| `empty-friends-v1.webp` | friends/page.tsx (친구 없음) | two empty clay picnic cushions facing each other with a tiny grape juice pitcher between them |
| `empty-favorites-v1.webp` | friends/page.tsx (즐겨찾기 없음) | a small clay star-shaped dish holding a single grape |
| `empty-reminders-v1.webp` | notifications/page.tsx | a round pastel clay alarm clock lying asleep on a grape leaf |

### B. 와이너리 티어 배지 7종 — `public/illustrations/tiers/` (1:1, 216×216 목표)

winery/page.tsx `TIER_ART` 레코드의 주석 해제 + 경로 기입으로 활성화.
(레벨별 현행 이모지: 1 🌱 새싹 → 2 🍇 수확생 → 3 🧃 주스 → 4 🍷 견습생 → 5 🥂 소믈리에 → 6 🏰 오너 → 7 👑 마스터)

| 파일명 | 프롬프트 (프리앰블 뒤에) |
|---|---|
| `tier-1-v1.webp` | a tiny clay grape seedling sprout badge, leaf green accents |
| `tier-2-v1.webp` | a plump clay grape bunch badge, lavender purple |
| `tier-3-v1.webp` | a cute clay grape juice box badge with a straw, lime accents |
| `tier-4-v1.webp` | a small clay wine glass badge with grape motif |
| `tier-5-v1.webp` | two clinking clay champagne glasses badge, sunshine sparkle dots |
| `tier-6-v1.webp` | a miniature clay winery chateau badge with grape vines |
| `tier-7-v1.webp` | a royal clay crown badge adorned with tiny grapes |

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

### E. OG 배경 — 1200×630 (PNG)

- 프롬프트: 프리앰블 + `wide banner scene of a pastel clay vineyard with grape bunches
  and rolling hills, generous empty space on the right half for text overlay`
- **한글 텍스트는 생성 금지** — 배경만 생성 후 sharp/Canvas로 "포도알 — 한 알씩,
  매일의 기록" 타이포 합성. 현재는 코드 생성 OG(스크립트)가 자리를 지킨다 —
  같은 경로(`src/app/opengraph-image.png`)에 덮어쓰면 교체 완료.

### F. iOS 스플래시 6종 — `public/splash/` (P2, AI 생성 아님)

아이콘 마스터를 단색 배경(#FBF7FE) 중앙에 합성하는 결정적 작업.
크기: 1170×2532, 1179×2556, 1290×2796, 1125×2436, 828×1792, 1620×2160.
layout.tsx head의 apple-touch-startup-image 링크는 이미 준비됨(주석 참조).

## 자산 대장 (생성 시 기록)

| 파일 | 프롬프트 요약 | 모델 | 생성일 | 라이선스 확인 | 앵커 |
|---|---|---|---|---|---|
| (생성 시 추가) | | | | Higgsfield ToS 상업적 이용 확인 필요 | |

## 교체 규칙

- **같은 URL에 내용 교체 금지** — sw.js가 이미지 cache-first라 설치된 PWA에 영원히
  구버전이 남는다. 반드시 파일명 버전 접미를 올려(`-v1` → `-v2`) 참조를 갱신할 것.
- 아이콘(경로가 manifest에 고정)만 예외적으로 CACHE_VERSION 범프로 무효화.
- APP_SHELL 프리캐시에 일러스트를 추가하지 말 것(셸 최소 유지).
