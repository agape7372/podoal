# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **About this project (podoal)** — This is **podoal**, a habit-tracking PWA with a claymorphism visual redesign. Data layer (Prisma schema, all `/api/*` routes, `src/lib/auth.ts`, `src/lib/oauth.ts`, `src/lib/store.ts` keys, `src/lib/feedback.ts` function signatures, `prisma/seed.ts`, env var names) — **do not modify**. Visual layer (`tailwind.config.ts`, `src/app/globals.css`, all `src/components/**`, all page components, manifest brand strings) was redesigned.
>
> **podoal design tokens**
> - Brand purple (ACTUAL values): `tailwind grape-500` = `#B28CDC`, `--grape-primary` = `#DCC4F2`. The `#9B7ED8` accent lives only in the `grape-glow` shadow token + winery Lv gradient — NOT unified to one var (known token drift; pick one canonical if reconciling)
> - Accent palettes (now defined in `tailwind.config.ts`): `juice-*` (warm pink, CTAs/celebrations), `leaf-*` (green, stem/vine/online/success), `sunshine-*` (yellow, sparkle/reward)
> - All shadows use a single purple-warm tint `rgba(73, 50, 100, X)` instead of black — `--shadow-tint` (globals.css) and the tailwind `boxShadow` tokens are unified to this value. Filled/empty grapes use the same tint (not black)
> - Display font: **Maru Buri** (Naver, free commercial, **self-hosted in `src/app/fonts/`**) for H1/H2/big numbers; body stays Noto Sans KR. Both load via **`next/font`** (see `layout.tsx`: `--font-display` / `--font-sans` vars) — the old jsdelivr `@font-face` CDN was dead (404). Use `font-display` class on headers only — never on paragraph text
> - New `clay-puffy` shadow for floating elements (Navigation, InstallPrompt, joyful CTAs)
> - 5th button variant: `joyful` — gradient `grape-300 → grape-400 → lime-300` + `clay-puffy` shadow; reserve for welcome CTA, "보상 열기", "릴레이 시작"
> - **Taste-review a11y conventions (2026-06-03) — rely on these, do NOT re-add**: a global `:focus-visible` ring + a global `prefers-reduced-motion` backstop live in `globals.css` (never add per-element focus styles or per-animation motion guards; only remove stray `focus:outline-none`). `.clay-input::placeholder` is AA (opacity 1). Use `<ConfirmDialog>` (`src/components/ConfirmDialog.tsx`) instead of `window.confirm()`. For body/caption TEXT use `text-warm-sub`, not `text-warm-light` (the latter fails AA on white — decoration only). Add `tabular-nums` to numeric readouts. Viewport allows pinch-zoom; inputs are 16px. List pages surface a distinct error state (not a swallowed empty)
>
> **Mascot & illustrations**
> - `src/components/mascot/Podo.tsx` — minimal still-life grape SVG, props: `size`, optional `variant: 'sleeping'`, optional `decorative` (renders `aria-hidden` for purely decorative placements e.g. the InstallPrompt chip; default keeps `role="img"`+aria-label). **No facial expressions** — used decoratively only (welcome hero, empty states, InstallPrompt chip). Do not extend with cheering/surprised etc.
> - `src/components/illustrations/*.tsx` — 2 single-export SVG components (VineLeaf, Sparkle) + `GrapeStem.tsx` (used by GrapeBoard). Gradient/defs ids use `useId()` for instance-uniqueness (no cross-instance fill bleed). Unused `Star`/`Heart`/`CloudPuff`/`Ribbon`/`Sun`/`WaterDrop` were removed. Use sparingly: at most one illustration per page section.
> - `GrapeStem.tsx` is now **two flat curved leaves, no stem/tendril** — a borderless sage-green (`#74A77E`) silhouette vectorized (pixel-traced + smoothed) from a reference, `viewBox="0 0 200 117"`. Props: `size` (= rendered width; height = `size*0.585`). `GrapeBoard` sizes it from `grapeSize` and keeps a gap above the bunch (see layout invariants 6–7). Do **not** ship the original watermarked stock image — keep the redrawn vector (license-safe).
>
> **Content untouched** — `src/lib/templates.ts` (7 categories, 38 templates), `src/lib/winery.ts` (포도알 새싹 → 포도 마스터 tier names), `src/lib/sounds.ts` (30 sounds), `src/types/index.ts` (3 reward types), nav labels (홈/만들기/릴레이/와이너리/더보기) all kept verbatim. The redesign deliberately does not touch copy/naming — design carries the change.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build (runs `prisma db push --skip-generate --accept-data-loss` first, then `next build`)
npm run lint         # ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Push schema changes to DB
npm run db:seed      # Seed with sample data (tsx prisma/seed.ts)
npm run db:studio    # Open Prisma Studio GUI
```

Dev login: use the "🛠 개발자 모드" button on the auth page, or credentials `dev@podoal.com` / `dev1234`. Available in production builds too (the gate was lifted).

## Architecture

**Stack**: Next.js 14 (App Router) + React 18 + TypeScript + Prisma (**PostgreSQL on Neon**) + Zustand + Tailwind CSS + PWA

### Route Structure

All UI pages live inside the `(app)` route group which handles auth checks, renders the bottom `Navigation`, registers the Service Worker, and shows the PWA install prompt. The root `page.tsx` is the unauthenticated welcome/login/register page (4 signup options visible side-by-side).

```
src/app/(app)/
  home/              # Dashboard. Filter tabs (전체/진행중/완료) carry the counts inline —
                     #   the separate stat-pill row was merged in (no duplicate counts)
  board/create/      # Board creation form (4-step: template → info → size → reward)
  board/[id]/        # Board detail with grape cluster, share card, capsule, gift
  friends/           # Friends list
  friends/[id]/      # Friend detail + their boards
  messages/          # Message inbox
  more/              # "More" menu grid (friends, messages, stats, vine, settings, etc.)
  notifications/     # Notification & reminder settings
  relay/             # Relay challenge list
  relay/[id]/        # Relay detail with chain visualization
  relay/create/      # Create relay with friend selector
  settings/          # Sound/haptic settings
  sound-test/        # All 30 fill sounds preview
  stats/             # Statistics (summary, heatmap, analysis tabs)
  vine/              # Grape vine activity timeline
  winery/            # Wine cellar with tier progression
```

API routes mirror the resource pattern under `src/app/api/` (auth, boards, capsules, friends, messages, notifications, relays, stats, vine, winery). Every protected endpoint calls `getCurrentUserId()` from `src/lib/auth.ts` which reads the JWT from an HTTP-only cookie.

### Auth Endpoints

```
/api/auth/register         # Email signup (bcrypt + JWT cookie)
/api/auth/login            # Email login (rejects OAuth-only accounts with a guiding message)
/api/auth/me               # Current user
/api/auth/dev              # Dev mode auto-login (creates dev@podoal.com on first call)
/api/auth/oauth/[provider] # OAuth start — google/kakao/naver. Sets oauth_state CSRF cookie,
                           #   redirects to provider consent URL. If provider's CLIENT_ID is
                           #   unset, short-circuits to /callback?guest=1 instead (guest fallback).
/api/auth/oauth/[provider]/callback  # Validates state, exchanges code or generates guest
                           #   identity, upserts user (provider tag = "{provider}" for real
                           #   OAuth, "{provider}_guest" for fallback), issues JWT.
/api/auth/providers        # Returns {google: {real,ready}, kakao: ..., naver: ...} so the
                           #   welcome UI can show a "체험" badge on guest-mode buttons.
```

### Key Libraries

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | JWT creation/verification (jose), cookie-based auth, `getCurrentUserId()` |
| `src/lib/oauth.ts` | Provider configs (authorize/token/userinfo URLs, scopes, response normalizers). `isRealOAuth(p)` checks credential presence; `generateGuestIdentity(p)` returns a randomized Korean "adj + fruit" identity for the guest fallback path. |
| `src/lib/api.ts` | Client-side fetch wrapper with auto JSON handling |
| `src/lib/store.ts` | Zustand store: user, boards, friends, messages, relays, capsules, settings (persisted to localStorage) |
| `src/lib/feedback.ts` | Web Audio API sounds + Vibration API haptics, combined feedback functions |
| `src/lib/sounds.ts` | 30 synthesized fill sound effects, `FILL_SOUNDS` array, `playFillSoundById()` |
| `src/lib/templates.ts` | 38 Korean habit templates in 7 categories with helpers |
| `src/lib/shareCard.ts` | Canvas API share card image generator (1080x1350 Instagram ratio) |
| `src/lib/winery.ts` | 7-tier winery system, bottle size utilities |
| `src/lib/prisma.ts` | Prisma client singleton (single instance, no /tmp bootstrap now that we're on Neon) |
| `src/lib/useSSE.ts` | SSE hook for real-time message delivery (polls `/api/messages/sse` every 3s) |
| `src/types/index.ts` | All shared TypeScript interfaces and const arrays |

### Database Models (Prisma + PostgreSQL/Neon)

- **User** — `email` unique. `password String?` (nullable, OAuth-only users have no password). `provider String?` + `providerId String?` with `@@unique([provider, providerId])`; `provider` values: `null` (email), `"google"`/`"kakao"`/`"naver"` (real OAuth), `"google_guest"` / `"kakao_guest"` / `"naver_guest"` (guest fallback).
- **Board** — grape sticker board (10/15/20/30 slots), can be gifted between users, optional `templateId`
- **Sticker** — individual filled position on a board, unique per `[boardId, position]`
- **Reward** — hidden reward unlocked at `triggerAt` sticker count, unique per `[boardId, triggerAt]`. Single-shot via `unlockedAt`, content revealed via `revealedAt`.
- **Friendship** — pending/accepted status, isFavorite flag, unique per `[requesterId, receiverId]`
- **Message** — types: cheer/celebration/gift, with emoji and isRead tracking
- **TimeCapsule** — freeze-dried message on a board, opens at specified date
- **Relay** — chain challenge with ordered participants (active/completed status)
- **RelayParticipant** — participant in a relay with order and linked board
- **NotificationSetting** — per-user notification preferences (global toggle, DND hours, per-category)
- **Reminder** — scheduled reminders with day-of-week and optional board link

### Feedback System

`feedback.ts` provides combined sound+haptic functions (`feedbackFill`, `feedbackCheer`, `feedbackReward`, `feedbackComplete`, `feedbackRelay`, `feedbackCapsuleOpen`, `feedbackBottle`, etc.) used by components. The fill sound is user-configurable via `fillSoundId` in the Zustand store settings, defaulting to sound #13 (쨩!). All 30 sounds are defined in `sounds.ts` using Web Audio API oscillators.

Settings are dual-stored: Zustand store (`podoal-app-settings` key) for UI state, and `feedback.ts` (`podoal-feedback-settings` key) for the audio/haptic layer. **Both must be updated together** when changing sound settings.

The visual side of a fill is the hit-stop impact freeze (see Styling → grape classes), not a liquid fill.

### PWA

The app is a Progressive Web App with `public/manifest.json`, `public/sw.js`, and `src/components/InstallPrompt.tsx` for the install banner. Service Worker is registered in the `(app)` layout. Icons are in `public/icons/`.

**`sw.js` fetch strategy** (bump `CACHE_VERSION` on any caching change): hash-named `/_next/static/*` → always network; `/api/*` → network-first; **HTML navigations (`request.mode === 'navigate'`) → network-first** (so a previously-visited page like an old board URL never gets stuck on a stale cached document referencing old chunks — this was why UI updates appeared only on newly-created boards); other static (icons/manifest/images) → cache-first. A new SW must activate (reopen the app / refresh) before the fix takes effect.

**Standalone static pages in `public/`** (not Next routes): `anim-pick.html` (final grape-fill animation candidates 40·49·17, particle-free). The leaf candidate galleries (`leaf-options.html`, `leaf-options-v2.html`) were removed once the grape leaf was finalized (current trace shape, sage `#74A77E`). The earlier `anim-lab.html` (68 candidates) and the `(app)/animation-test` route were also removed.

### Habit Templates

`src/lib/templates.ts` defines 38 Korean habit templates across 7 categories (건강, 자기계발, 생활습관, 직장/학업, 관계, 취미, 마음건강). Board creation step 0 allows template selection with auto-fill of title, description, size, and reward suggestions.

### Winery & Tier System

`src/lib/winery.ts` defines 7 tiers based on total grapes filled (0→포도알 새싹 🌱, 30→포도 수확생 🍇, 100→주스 메이커 🧃, 300→포도주 견습생 🍷, 500→소믈리에 🥂, 1000→와이너리 오너 🏰, 2000→포도 마스터 👑). Completed boards become "wine bottles" displayed in the winery cellar.

### Navigation

Bottom nav: 🏠 홈 | 🍇 만들기 | 🔗 릴레이 | 🍷 와이너리 | ☰ 더보기. The "더보기" page provides grid access to friends, messages, stats, vine, settings, notifications, and sound test.

### Styling: Claymorphism Design System

Custom Tailwind theme in `tailwind.config.ts` with `grape-*` (purple brand), `clay-*` (pastels), and `warm-*` (text) color palettes. `globals.css` defines claymorphic utility classes:

- `.clay` / `.clay-sm` / `.clay-float` — card surfaces with soft 3D shadows
- `.clay-pressed` — inset pressed state
- `.clay-button` — button with `:active { transform: scale(0.97) }` (tap feedback)
- `.grape-filled` / `.grape-empty` — individual grape sticker states. `.grape-empty:hover` has `scale(1.08)`, `:active` `scale(0.93)`.
- Grape fill motion is **"히트스톱 임팩트 프리즈"** (final pick from `public/anim-pick.html`, candidate 40): `.grape-hit` (`grapeHit` keyframe — fast squash that HOLDs on the contact frame, then snaps back) + `.grape-flash` (`grapeImpactFlash` ring synced to the freeze). The old juice-fill / jelly-pop / particle-burst are **removed**. Durations are `0.6s` to match the 600ms `isJustFilled` window in `GrapeBoard`.
- `.grape-empty.grape-next` (next tappable grape) idles with `grapeNextTension` (micro 1.018↔1.015 pulse); it's paused on `:hover`/`:active` so the hover/active scale still shows.
- `.clay-input` — form input styling
- `.vine-line` — vertical timeline line for grape vine
- `.capsule-open` — capsule opening animation
- `.wine-bottle-shimmer` — wine bottle shimmer effect
- `.scrollbar-hide` — hide scrollbar utility

All UI text is in Korean. Font: Noto Sans KR with `word-break: keep-all`.

#### Layout invariants (don't violate, easy to break)

These are the rules that the codebase encodes — breaking them caused the visible UI bugs of 2026-05-25:

1. **Any container with `overflow-x-auto` must also have `py-{≥2}`.** Per CSS spec, setting `overflow-x: auto` alone makes the browser auto-promote `overflow-y` from `visible` to `auto`, which silently clips ring/scale/shadow on children. Vertical breathing room prevents the clip.
2. **A child with `ring-{n}` needs ≥ `n+1` of container padding** so the ring (2px outside the box) isn't shaved off.
3. **`(app)/layout.tsx` body bottom padding** (`pb-[160px]`) must cover both the fixed Navigation (~70px) and the InstallPrompt (~80px); changing nav/banner height needs a matching update.
4. **z-index ladder**: Navigation `z-50` > FAB `z-40` > InstallPrompt `z-30`. Modals use `z-[90]`. Don't reuse `z-40` for new bottom-edge overlays — they'd race with FAB.
5. **Scrollable modal regions** (`flex-1 overflow-y-auto` inside a modal sheet) need `pb-4` so the last item doesn't get hidden by the iOS home indicator (parent's `safe-bottom` alone isn't enough).
6. **The leaf canopy must never overlap the grape bunch.** In `GrapeBoard` the `GrapeStem` wrapper uses a **positive** `marginBottom` (a gap) — never negative. Leaves sit *above* the bunch with breathing room.
7. **The leaf canopy must not exceed 2× a grape; ~1.5× is the target.** Size it from `grapeSize` (`leafWidth = grapeSize * 1.5`), never a hardcoded px value — otherwise it dominates the bunch.

## Patterns

- All page components are `'use client'` (need hooks, interactivity)
- API routes use `getCurrentUserId()` + `authResponse()` guard pattern
- Board operations use `_count: { select: { stickers: true } }` Prisma pattern for `filledCount`
- Board responses include `rewardCount` (number of rewards) rather than full reward data in list views
- `GrapeBoard` uses hex-packing row layouts with vertical overlap for realistic grape bunch appearance
- Filling a grape is **optimistic** — `board/[id]/page.tsx` inserts a temp sticker on click, then reconciles with the POST response (which already returns `sticker + filledCount + isCompleted + unlockedReward`). Re-fetches the board only when a reward unlocks. Rolls back on failure.
- Relay system uses ordered participants with baton-passing (current active → next pending)
- Statistics page uses 3 tabs: summary (overview), heatmap (90-day GitHub-style grid), analysis (charts)
- Share cards generated client-side with Canvas API, shareable via Web Share API or download
- OAuth: the welcome screen renders all 3 social buttons unconditionally; `/api/auth/providers` decides whether to show a "체험" badge (real vs guest mode). Clicking a button always works — guest mode is the fallback when credentials are missing.
