# podoal 일러스트 스타일 가이드 & AI 생성 카탈로그

> **상태 (2026-07-23)**: 빈상태 11종(8+F11 갭 3종: 알림함·포도밭·통계) + 티어 배지 7종 +
> 와인 품종 라벨 7종 **생성·배선 완료**(하단 자산 대장). 스타일은 아래 v2(플랫 이모지)로
> 확정 — 구 클레이 3D 프리앰블은 실기기 대조에서 앱과 괴리(사용자 판정)로 폐기. 앱 아이콘은
> 기존 Podo SVG 유지(AI 교체 안 함 — 마스코트=아이콘 일관성이 우선), OG AI 배경은 2회 구도
> 실패로 보류(코드 생성 OG 유지, P1). **07-23 추가 확정(§G)**: z_image가 "집·책·팔레트·달"류
> 개별 사물 소재에서 3D/글로시로 회귀하는 편향 확인 — **포도송이(+작은 액센트) 모티프로
> 통일하면 회피됨**(과일류는 flat emoji 사전학습이 강함). 신규 생성은 이 모티프 우선 채택.

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

## v3 보정 노트 (2026-07-23, 라벨 7종 + 빈상태 갭 3종 생성 시 발견)

- **색 채도 캘리브레이션**: 1차 시도(프리앰블 그대로)가 사용자 판정 "칙칙함"(sage
  green·warm brown·dark plum 위주 배색 + 진한 그림자/받침 요소가 원인) → 2차로
  "HIGHLY SATURATED VIVID" 문구를 넣었더니 이번엔 네온/캔디톤으로 과보정(사용자
  판정 "채도만 강함") → 3차 "soft light pastel... NOT neon... but also NOT
  muted/dusty" 문구로 정착. **핵심은 문구보다 배색 선택**: 팔레트 8색 중 밝은
  절반(soft pink/soft yellow/pastel blue/lavender/lime)을 주색으로, 어두운 절반
  (warm brown/dark plum #5C4482/sage green)은 보조 액센트로만 — 여러 요소를 갈색
  받침(mound/shelf/cushion)으로 깔면 팔레트가 맞아도 전체 인상이 흙빛으로 처짐.
- **배경 색은 신경 쓸 필요 없음**: z_image가 "plain white/cream" 지시를 자주
  무시하고 회색·그라디언트·subject 색조 배경을 냄 — 하지만 어차피 rembg가
  버리는 레이어라 실무 영향 0. 검수는 전경 색상/형태에만 집중.
- **3D/글로시 편향 (모델 한계, 재현 다수)**: "house", "book", "artist's palette
  +easel", "crescent moon" 같은 개별 사물 소재는 "no 3D, no outline, no shine"을
  아무리 강조해도 z_image가 종종(≥50%) 아이소메트릭 3D·광택 렌더로 회귀 —
  recraft_v4_1(1.25cr)로 바꿔도 이번엔 얇은 그라디언트 아이콘 톤으로 이탈(스타일
  불일치). **해결책 = 소재 자체를 포도송이(+작은 색 액센트: 리본/반짝임/잎)로
  통일** — 과일류는 flat-emoji 사전학습이 강해 거의 항상(9/9) 성공. 향후 신규
  카테고리 아이콘/빈상태도 이 모티프를 기본값으로 우선 시도할 것.
- **프롬프트에 비유(simile) 금지**: "like spring macarons" 같은 스타일 비유
  문구를 넣었더니 마카롱 실물 오브젝트가 장면에 literal하게 등장한 사례 발생 —
  스타일 형용사는 색/질감 묘사로만 쓰고 구체 명사 비유는 피할 것.

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

### A. 빈 상태 씬 11종 — `public/illustrations/empty/` (1:1, 480×480 목표)

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
| `empty-inbox-v1.webp` | notifications/inbox/page.tsx (F11 갭, 2026-07-23 해소) | a small plump grape cluster in soft pastel leaf-green, two leaves, one tiny sparkle beside it |
| `empty-rewards-v1.webp` | RewardList.tsx (F11 갭, 2026-07-23 해소) | a small plump grape cluster in soft pastel pink, two leaves, tied with a small lavender ribbon bow |
| `empty-stats-v1.webp` | stats/page.tsx CategoryBreakdown (F11 갭, 2026-07-23 해소) | a small plump grape cluster in soft pastel blue, two leaves, one tiny sparkle beside it |

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

### C. 와인 품종 라벨 7종 — `public/illustrations/labels/` (1:1, 96×96) ✅ 완료 (2026-07-23)

winery/page.tsx `LABEL_ART`/`LabelBadge`(TIER_ART/TierBadge와 동일 아트↔EmojiIcon
폴백 패턴)로 배선 완료 — WineBottle 상세패널 48px 아이콘 자리, 카테고리는
`selectedBottle.templateId?.split('-')[0]`(WineBottle.tsx `VARIETAL_FOIL`과 동일 규칙).
**모티프를 §당초 계획한 개별 사물(집/책/팔레트/달 등)에서 포도송이 통일로 변경**
(v3 보정 노트 참조 — 개별 사물이 z_image에서 3D로 회귀). 색만 품종별로 다르고
형태는 공통 "포도송이+잎 2장"이라 브랜드 일관성도 더 높음.

| 파일명 | 카테고리 | 프롬프트 (프리앰블 뒤에) |
|---|---|---|
| `label-health-v1.webp` | health | a small plump grape cluster silhouette in soft pastel leaf-green #6fb050, with two small pastel green leaves on top, floating alone |
| `label-growth-v1.webp` | growth | a small plump grape cluster silhouette in soft pastel sunshine-yellow #f2c94c, with two small pastel green leaves on top, floating alone |
| `label-lifestyle-v1.webp` | lifestyle | a small plump grape cluster silhouette in soft pastel lime #cfdc78, with two small pastel leaf-green leaves on top, floating alone |
| `label-work-v1.webp` | work | a small plump grape cluster silhouette in soft pastel grape-purple #b28cdc, with two small pastel green leaves on top, floating alone |
| `label-social-v1.webp` | social | a small plump grape cluster silhouette in soft pastel pink #f58bae, with two small pastel green leaves on top, floating alone |
| `label-hobby-v1.webp` | hobby | a small plump grape cluster silhouette in soft pastel orange #f2a25c, with two small pastel green leaves on top, floating alone |
| `label-mental-v1.webp` | mental | a small plump grape cluster silhouette in soft pastel blue #9fbfe8, with two small pastel green leaves on top, floating alone |

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
| empty/empty-reminders-v2.webp | 잎 위 알람시계 (notifications/page.tsx:354 배선 완료, 2026-07-07 `ca9f537`) | z_image | 2026-07-06 | 상동 | |
| tiers/tier-1~7-v2.webp | 새싹/포도/주스팩/와인잔/샴페인/샤토/왕관 | z_image | 2026-07-06 | 상동 | |
| src/app/opengraph-image.png | OG: 비네트(트렐리스·포도·언덕)+MaruBuri 타이포 합성(§E) | z_image | 2026-07-07 | 상동 | |
| labels/label-health~mental-v1.webp (7) | 포도송이+잎, 품종색 7종(§C) | z_image | 2026-07-23 | 상동 | |
| empty/empty-inbox-v1.webp | 포도송이(leaf-green)+반짝임 (F11 갭) | z_image | 2026-07-23 | 상동 | |
| empty/empty-rewards-v1.webp | 포도송이(pink)+리본 (F11 갭) | z_image | 2026-07-23 | 상동 | |
| empty/empty-stats-v1.webp | 포도송이(blue)+반짝임 (F11 갭) | z_image | 2026-07-23 | 상동 | |

- 총 소요(2026-07-06): 생성 29회(재생성 포함) + API 배경제거 시험 1회 ≈ 5.45cr.
- 재생성 사유 기록(07-06): 물뿌리개 중복·찬 선반·배지 프레임 3회·왕관 얼굴 1회·OG 와이드 구도 2회(→ §E 비네트 방식으로 해결).
- 총 소요(2026-07-23, 라벨 7+빈상태 3): z_image 약 45회(재생성·recraft 비교 시도 포함) + recraft_v4_1 시험 4회(1.25cr×4=5cr) ≈ 12cr. 잔여 100cr+ — v3 보정 노트(위) 참조.

## 교체 규칙

- **같은 URL에 내용 교체 금지** — sw.js가 이미지 cache-first라 설치된 PWA에 영원히
  구버전이 남는다. 반드시 파일명 버전 접미를 올려(`-v1` → `-v2`) 참조를 갱신할 것.
- 아이콘(경로가 manifest에 고정)만 예외적으로 CACHE_VERSION 범프로 무효화.
- APP_SHELL 프리캐시에 일러스트를 추가하지 말 것(셸 최소 유지).
