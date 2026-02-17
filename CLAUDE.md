# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Push schema changes to SQLite database
npm run db:seed      # Seed with sample data (tsx prisma/seed.ts)
npm run db:studio    # Open Prisma Studio GUI
```

Dev login: use the "개발자 모드" button on the auth page, or credentials `dev@podoal.com` / `dev1234`.

## Architecture

**Stack**: Next.js 14 (App Router) + React 18 + TypeScript + Prisma (SQLite) + Zustand + Tailwind CSS + PWA

### Route Structure

All UI pages live inside the `(app)` route group which handles auth checks, renders the bottom `Navigation`, registers the Service Worker, and shows the PWA install prompt. The root `page.tsx` is the unauthenticated login/register page.

```
src/app/(app)/
  home/              # Dashboard with board list
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

### Key Libraries

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | JWT creation/verification (jose), cookie-based auth, `getCurrentUserId()` |
| `src/lib/api.ts` | Client-side fetch wrapper with auto JSON handling |
| `src/lib/store.ts` | Zustand store: user, boards, friends, messages, relays, capsules, settings (persisted to localStorage) |
| `src/lib/feedback.ts` | Web Audio API sounds + Vibration API haptics, combined feedback functions |
| `src/lib/sounds.ts` | 30 synthesized fill sound effects, `FILL_SOUNDS` array, `playFillSoundById()` |
| `src/lib/templates.ts` | 38 Korean habit templates in 7 categories with helpers |
| `src/lib/shareCard.ts` | Canvas API share card image generator (1080x1350 Instagram ratio) |
| `src/lib/winery.ts` | 7-tier winery system, bottle size utilities |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/useSSE.ts` | SSE hook for real-time message delivery (polls `/api/messages/sse` every 3s) |
| `src/types/index.ts` | All shared TypeScript interfaces and const arrays |

### Database Models (Prisma + SQLite)

- **User** - email/password auth, fruit emoji avatar
- **Board** - grape sticker board (10/15/20/30 slots), can be gifted between users, optional `templateId`
- **Sticker** - individual filled position on a board, unique per `[boardId, position]`
- **Reward** - hidden reward unlocked at `triggerAt` sticker count, unique per `[boardId, triggerAt]`
- **Friendship** - pending/accepted status, isFavorite flag, unique per `[requesterId, receiverId]`
- **Message** - types: cheer/celebration/gift, with emoji and isRead tracking
- **TimeCapsule** - freeze-dried message on a board, opens at specified date
- **Relay** - chain challenge with ordered participants (active/completed status)
- **RelayParticipant** - participant in a relay with order and linked board
- **NotificationSetting** - per-user notification preferences (global toggle, DND hours, per-category)
- **Reminder** - scheduled reminders with day-of-week and optional board link

### Feedback System

`feedback.ts` provides combined sound+haptic functions (`feedbackFill`, `feedbackCheer`, `feedbackReward`, `feedbackComplete`, `feedbackRelay`, `feedbackCapsuleOpen`, `feedbackBottle`, etc.) used by components. The fill sound is user-configurable via `fillSoundId` in the Zustand store settings, defaulting to sound #13 (쨩!). All 30 sounds are defined in `sounds.ts` using Web Audio API oscillators.

Settings are dual-stored: Zustand store (`podoal-app-settings` key) for UI state, and `feedback.ts` (`podoal-feedback-settings` key) for the audio/haptic layer. Both must be updated together when changing sound settings.

### PWA

The app is a Progressive Web App with `public/manifest.json`, `public/sw.js` (cache-first for static, network-first for API), and `src/components/InstallPrompt.tsx` for the install banner. Service Worker is registered in the `(app)` layout. Icons are in `public/icons/`.

### Habit Templates

`src/lib/templates.ts` defines 38 Korean habit templates across 7 categories (건강, 자기계발, 생활습관, 직장/학업, 관계, 취미, 마음건강). Board creation step 0 allows template selection with auto-fill of title, description, size, and reward suggestions.

### Winery & Tier System

`src/lib/winery.ts` defines 7 tiers based on total grapes filled (0→포도알 새싹 🌱, 30→포도 수확생 🍇, 100→주스 메이커 🧃, 300→포도주 견습생 🍷, 500→소믈리에 🥂, 1000→와이너리 오너 🏰, 2000→포도 마스터 👑). Completed boards become "wine bottles" displayed in the winery cellar.

### Navigation

Bottom nav: 🏠 홈 | 🍇 만들기 | 🔗 릴레이 | 🍷 와이너리 | ☰ 더보기. The "더보기" page provides grid access to friends, messages, stats, vine, settings, notifications, and sound test.

### Styling: Claymorphism Design System

Custom Tailwind theme in `tailwind.config.ts` with `grape-*` (purple brand), `clay-*` (pastels), and `warm-*` (text) color palettes. `globals.css` defines claymorphic utility classes:

- `.clay` / `.clay-sm` / `.clay-float` - card surfaces with soft 3D shadows
- `.clay-pressed` - inset pressed state
- `.clay-button` - button with scale-on-press
- `.grape-filled` / `.grape-empty` - individual grape sticker states
- `.clay-input` - form input styling
- `.vine-line` - vertical timeline line for grape vine
- `.capsule-open` - capsule opening animation
- `.wine-bottle-shimmer` - wine bottle shimmer effect

All UI text is in Korean. Font: Noto Sans KR with `word-break: keep-all`.

## Patterns

- All page components are `'use client'` (need hooks, interactivity)
- API routes use `getCurrentUserId()` + `authResponse()` guard pattern
- Board operations use the `_count: { select: { stickers: true } }` Prisma pattern for `filledCount`
- Board responses include `rewardCount` (number of rewards) rather than full reward data in list views
- The `GrapeBoard` component uses hex-packing row layouts with vertical overlap for realistic grape bunch appearance
- Relay system uses ordered participants with baton-passing (current active → next pending)
- Statistics page uses 3 tabs: summary (overview), heatmap (90-day GitHub-style grid), analysis (charts)
- Share cards generated client-side with Canvas API, shareable via Web Share API or download
