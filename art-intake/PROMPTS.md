# 힉스필드 생성 프롬프트 팩 (W2-B — 복붙용)

> 정본: `docs/ILLUSTRATION_STYLE.md`. 이 파일은 웹 UI에서 복붙하기 좋게 펼친 것.
> **설정**: 모델 `recraft_v4_1` · style `standard`(티어 배지는 `vector`도 시도 가능) ·
> `background_color: #FBF7FE` · colors 파라미터에 아래 팔레트 8색 지정 · 1:1.
> 생성 순서: ① empty-home 먼저 1장 → 마음에 들 때까지 재생성(이게 앵커) → ② 나머지.
> 각 장 생성 후 **배경 제거**까지 힉스필드에서 실행 → 투명 PNG 다운로드 →
> 아래 파일명으로 이 폴더(`art-intake/`)에 저장 → 완료 후 Claude에게 알리기.

팔레트: `#B28CDC #DCC4F2 #7D58A8 #8FC972 #F9E082 #F58BAE #CFDC78 #F2A25C`

## 공통 프리앰블 (모든 프롬프트 맨 앞에 붙이기)

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

## ① 빈 상태 8종 → `empty-*.png`

| 저장 파일명 | 프리앰블 뒤에 붙일 프롬프트 |
|---|---|
| `empty-home.png` | a cozy miniature grape vineyard plot with one small empty wooden trellis and a tiny watering can, waiting to be planted |
| `empty-winery.png` | a small clay wine cellar shelf with empty bottle slots and one corked empty bottle, warm and inviting |
| `empty-messages.png` | a pastel clay mailbox with its flag down and a single grape leaf resting on top |
| `empty-vine.png` | a young grape vine sprout in a clay pot with a small support stick, just beginning to grow |
| `empty-podong.png` | three clay grape clusters connected by a soft ribbon loop, resting together |
| `empty-friends.png` | two empty clay picnic cushions facing each other with a tiny grape juice pitcher between them |
| `empty-favorites.png` | a small clay star-shaped dish holding a single grape |
| `empty-reminders.png` | a round pastel clay alarm clock lying asleep on a grape leaf |

## ② 와이너리 티어 배지 7종 → `tier-N.png`

| 저장 파일명 | 프롬프트 |
|---|---|
| `tier-1.png` | a tiny clay grape seedling sprout badge, leaf green accents |
| `tier-2.png` | a plump clay grape bunch badge, lavender purple |
| `tier-3.png` | a cute clay grape juice box badge with a straw, lime accents |
| `tier-4.png` | a small clay wine glass badge with grape motif |
| `tier-5.png` | two clinking clay champagne glasses badge, sunshine sparkle dots |
| `tier-6.png` | a miniature clay winery chateau badge with grape vines |
| `tier-7.png` | a royal clay crown badge adorned with tiny grapes |

## ③ 앱 아이콘 마스터 → `icon-master.png` (1024×1024, 배경 제거 **하지 말 것** — 불투명)

```
(프리앰블) + app icon of a plump claymorphism grape bunch with two leaves,
centered, filling 70% of frame, solid lavender gradient background #DCC4F2 to #B28CDC
```

## ④ OG 배경 → `og-bg.png` (1200×630, 불투명, 텍스트 없음 — 한글은 코드로 합성)

```
(프리앰블) + wide banner scene of a pastel clay vineyard with grape bunches
and rolling hills, generous empty space on the right half for text overlay
```

## 완료 후

1. 이 폴더에 파일이 다 모이면: `node scripts/art-convert.mjs` (빈상태·티어 자동 변환+검사)
2. 아이콘·OG는 Claude가 후처리(gen-brand-assets + CACHE_VERSION 범프 / 타이포 합성)
3. 검수 7항(docs/ILLUSTRATION_STYLE.md)과 배선(EmptyState art·TIER_ART 주석 해제)도 Claude 담당
