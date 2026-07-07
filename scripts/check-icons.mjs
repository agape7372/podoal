// Build-time guard against raw OS emoji leaking into the UI.
//
// The app renders every emoji as a flat Fluent SVG via <EmojiIcon>. Three ways
// a raw OS emoji can sneak in, all caught here (exit 1 fails `npm run lint`/CI):
//
//   1) An emoji used in code has no /public/icons/fluent/<cp>.svg — <EmojiIcon>
//      would have to fall back (it no longer does, so it'd show a placeholder).
//      → COVERAGE check: every emoji in src/ must have its SVG.
//   2) An emoji typed directly as JSX text (e.g. <button>💌 편지</button>) renders
//      as the OS glyph because it never goes through <EmojiIcon>.
//      → RAW-TEXT check: no emoji outside a string literal in .tsx.
//   3) An emoji offered as a user-facing *pick list* (e.g. CheerModal's emoji
//      palette, CapsuleModal's) has no SVG — the same failure mode as (1), but
//      worth surfacing separately by array name/file so it's traceable to the
//      exact picker a user tapped (2026-07-06 walkthrough: a 🏋️ in a seed
//      message with no SVG showed a console warning + missing icon).
//      → CHOICE-ARRAY check: every emoji in a `const *EMOJI(S)* = [...]` array
//        literal must have its SVG. This scans the same superset as (1), so
//        any hit here would already be reported by the coverage check above —
//        entries already in `missing` are NOT repeated (see dedup below).
//
// Emoji inside string literals (emoji="🎁", icon: '🎁', data arrays) are fine —
// they flow through <EmojiIcon> and are coverage-checked.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = 'src';
const ICONS = 'public/icons/fluent';
const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
const PICTO = /\p{Extended_Pictographic}/u;
// Matches `const FOO_EMOJIS = [...]` / `export const FOO_EMOJI = [...]` style
// pick-list declarations (naming convention already in use: CHEER_EMOJIS,
// CAPSULE_EMOJIS). Non-greedy body capture stops at the first `]`, which is
// fine for the flat string-literal arrays this codebase uses for emoji lists.
const CHOICE_ARRAY_RE = /(?:export\s+)?const\s+([A-Za-z0-9_]*EMOJIS?)\s*=\s*\[([\s\S]*?)\]/g;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

// Strip comments so emoji in explanatory comments don't count.
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Same codepoint rule as src/components/EmojiIcon.tsx.
function codepoint(grapheme) {
  return Array.from(grapheme)
    .map((ch) => ch.codePointAt(0).toString(16))
    .filter((h) => h !== 'fe0f' && h !== '200d')
    .join('-');
}

function emojiGraphemes(text) {
  const found = [];
  for (const { segment } of seg.segment(text)) {
    if (PICTO.test(segment)) found.push(segment);
  }
  return found;
}

const missing = new Map(); // cp -> { emoji, files:Set }
const rawText = [];        // { file, line, emoji }
const choiceMissing = new Map(); // cp -> { emoji, arrays:Set } — subset of `missing`, separate section

for (const file of walk(SRC)) {
  const code = stripComments(readFileSync(file, 'utf8'));

  // 1) Coverage — every emoji (quoted or not) must have an SVG.
  for (const g of emojiGraphemes(code)) {
    const cp = codepoint(g);
    if (!cp) continue;
    if (!existsSync(join(ICONS, `${cp}.svg`))) {
      if (!missing.has(cp)) missing.set(cp, { emoji: g, files: new Set() });
      missing.get(cp).files.add(file);
    }
  }

  // 2) Raw-as-JSX-text — emoji left after removing string literals is unquoted.
  if (file.endsWith('.tsx')) {
    code.split('\n').forEach((line, i) => {
      const noStrings = line
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/`(?:[^`\\]|\\.)*`/g, '``');
      for (const g of emojiGraphemes(noStrings)) rawText.push({ file, line: i + 1, emoji: g });
    });
  }

  // 3) Choice-array — emoji pick-list literals (e.g. CHEER_EMOJIS), reported
  // by array name so a missing icon is traceable to the picker, not just the
  // file. Skips entries already caught by (1) above to avoid double-reporting
  // the same missing codepoint.
  CHOICE_ARRAY_RE.lastIndex = 0;
  let m;
  while ((m = CHOICE_ARRAY_RE.exec(code))) {
    const [, arrayName, body] = m;
    for (const g of emojiGraphemes(body)) {
      const cp = codepoint(g);
      if (!cp || existsSync(join(ICONS, `${cp}.svg`))) continue;
      if (missing.has(cp)) continue; // already reported in section (1)
      if (!choiceMissing.has(cp)) choiceMissing.set(cp, { emoji: g, arrays: new Set() });
      choiceMissing.get(cp).arrays.add(`${arrayName} (${file})`);
    }
  }
}

let failed = false;
if (missing.size) {
  failed = true;
  console.error('\n✖ 누락된 Fluent SVG — public/icons/fluent/ 에 추가하세요:');
  for (const [cp, { emoji, files }] of missing) {
    console.error(`  ${emoji}  ${cp}.svg   ← ${[...files].join(', ')}`);
  }
}
if (rawText.length) {
  failed = true;
  console.error('\n✖ JSX 생(raw) 이모지 — <EmojiIcon emoji="..."/> 로 렌더하세요:');
  for (const { file, line, emoji } of rawText) console.error(`  ${file}:${line}  ${emoji}`);
}
if (choiceMissing.size) {
  failed = true;
  console.error('\n✖ 이모지 선택지 배열 누락 — public/icons/fluent/ 에 추가하세요:');
  for (const [cp, { emoji, arrays }] of choiceMissing) {
    console.error(`  ${emoji}  ${cp}.svg   ← ${[...arrays].join(', ')}`);
  }
}

if (failed) {
  console.error('\n아이콘 규칙 위반. 위 항목을 고친 뒤 다시 실행하세요.\n');
  process.exit(1);
}
console.log('✓ check-icons: 모든 이모지가 플랫 SVG로 커버됨 · JSX 생이모지 없음 · 선택지 배열 커버됨');
