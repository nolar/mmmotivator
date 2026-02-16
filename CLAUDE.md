# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Vite)
- **Build:** `npm run build` (runs `tsc -b && vite build`, output in `dist/`)
- **Lint:** `npm run lint` (ESLint 9 flat config with TypeScript + React hooks plugins)
- **Type-check only:** `npx tsc --noEmit`
- No test framework is configured.

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

## Known Issues

See `TASKS.md` for security review findings. Notable: `getCellDate()` mutates its `birthdate` argument — callers must pass a fresh `Date` or copy.
