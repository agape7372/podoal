import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Flat config (ESLint 10). Replaces the legacy .eslintrc.json removed in the
// Next 16 migration (next lint → ESLint CLI).
export default defineConfig([
  {
    extends: [...nextCoreWebVitals],
    rules: {
      // App intentionally renders <img> for the emoji-image design system
      // (EmojiIcon), generated blob-URL share-card previews, and small preset
      // SVG/avatar assets — none of which next/image can optimize. Disabled
      // project-wide instead of scattering per-line disables.
      "@next/next/no-img-element": "off",
      // React-Compiler-readiness rules newly enabled by eslint-config-next@16.
      // This app is deliberately client-rendered (all pages are 'use client'
      // with fetch-on-mount), so set-state-in-effect fires app-wide on a valid
      // pattern. Surface these as warnings (future React Compiler adoption)
      // rather than failing the build on a brand-new opinionated rule set.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
]);
