# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Vite)
- **Build:** `npm run build` (runs `tsc -b && vite build`, output in `dist/`)
- **Lint:** `npm run lint` (ESLint 9 flat config with TypeScript + React hooks plugins)
- **Type-check only:** `npx tsc --noEmit`
- **Unit/component tests:** `npx vitest run` (Vitest with jsdom + React Testing Library)
- **Visual regression tests:** `npx playwright test` (requires `npm run build` first; uses Playwright with Chromium)
- **Update Playwright baselines (macOS):** `npx playwright test --update-snapshots` (baselines are platform-specific, e.g. `full-page-darwin.png` / `full-page-linux.png`)
- **Update Playwright baselines (Linux via Docker):** `npm run test:e2e:update-linux` — runs Playwright inside the official Docker image with an isolated `node_modules` volume so the host's dependencies are not overwritten
- **IMPORTANT:** When updating Playwright baselines, ALWAYS regenerate BOTH platforms (macOS and Linux). Run `npx playwright test --update-snapshots` AND `npm run test:e2e:update-linux`. CI runs on Linux, so forgetting the Linux baseline will break the pipeline.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push with two parallel jobs:
- **`test`** — lint + Vitest unit/component tests
- **`test-e2e`** — build + Playwright visual regression (Chromium browsers are cached between runs; test artifacts uploaded on failure)

## Architecture

Single-page React app that renders a "Life in Weeks" grid — a visual grid where each cell is one week of a human lifespan, colored by life periods.

**Data flow:** `App` owns all state (`birthdate`, `totalYears`, `periods`) initialized from `src/config.ts` defaults. State is passed down as props — no context or state library.

**Key modules:**
- `src/types.ts` — `LifePeriod` and `LifeConfig` interfaces (dates are ISO strings `"YYYY-MM-DD"`)
- `src/config.ts` — default config values (hardcoded)
- `src/grid.ts` — pure functions: `getCellDate()` maps (year, week) → Date; `findPeriod()` maps Date → matching period
- `src/colors.ts` — `assignColors()` assigns Tailwind bg classes from a 10-color palette to periods, returning a `Map<LifePeriod, string>`
- `src/components/ConfigForm.tsx` — sidebar form for editing config; receives state + setters as props
- `src/components/WeekGrid.tsx` — renders the 52-column CSS grid; receives `birthdate` as `Date` object (not string)
- `src/components/Legend.tsx` — color legend below the grid

**Styling:** Tailwind CSS v4 via `@tailwindcss/vite` plugin. No custom CSS beyond `@import "tailwindcss"` in `index.css`. Colors for periods are Tailwind class strings (e.g. `"bg-rose-400"`), not hex values.

## Testing Conventions

Test files under `src/` are compiled by `tsconfig.app.json`, which only includes browser types (`DOM`, `vite/client`, `vitest/globals`) — **no Node.js types**. Do not use `fs`, `path`, `__dirname`, or other Node.js APIs in these tests. Instead, use Vite-native imports: `import config from "../../vercel.json"` for JSON, or `import html from "../../index.html?raw"` for raw file contents.

## Known Issues

See `TASKS.md` for security review findings. Notable: `getCellDate()` mutates its `birthdate` argument — callers must pass a fresh `Date` or copy.
