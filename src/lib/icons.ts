import type { RewardType } from '@/types';

/**
 * Central icon source of truth.
 *
 * Every icon the app shows is a flat Microsoft Fluent SVG served from
 * `/public/icons/fluent/<codepoint>.svg` and rendered through `<EmojiIcon>`.
 * Emoji *characters* live here (and in a few data files like sounds/templates),
 * NEVER inside display-text strings — so a label can't accidentally print a raw
 * OS emoji. `scripts/check-icons.mjs` enforces, at build time, that (a) every
 * used emoji has its SVG and (b) no raw emoji sits in JSX text. `EmojiIcon`
 * itself never falls back to the OS glyph. Together these stop raw emoji from
 * ever leaking into the UI.
 */

/** Reward type → flat icon. Pair with `REWARD_TYPE_LABELS` (emoji-free names). */
export const REWARD_TYPE_ICON: Record<RewardType, string> = {
  letter: '💌',
  giftcard: '🎁',
  wish: '⭐',
};

/** Generic UI icons referenced by name so call sites don't hardcode raw emoji. */
export const ICON = {
  lock: '🔒',
  gift: '🎁',
  star: '⭐',
  heart: '💜',
} as const;
