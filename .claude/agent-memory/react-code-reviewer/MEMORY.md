# React Code Reviewer Memory

## Codebase Architecture (2026-02-13)

**Project:** Life-in-Weeks visualization SPA (Vite + React + TypeScript + Tailwind v4)

**Architecture pattern:** Props-down data flow, no context/state library. App owns all state, passes down as props.

**Key conventions:**
- Dates: ISO strings in interfaces, Date objects when passed to components
- Colors: Tailwind class strings (e.g., `"bg-rose-400"`), not hex
- No test framework configured

**Module structure:**
- `types.ts` — Core interfaces (LifePeriod, LifeConfig)
- `config.ts` — Default hardcoded values
- `grid.ts` — Pure utility functions (getCellDate, findPeriod)
- `colors.ts` — Color palette + assignment logic
- `storage.ts` — localStorage persistence with validation
- `components/` — Presentational components (WeekGrid, ConfigForm, Legend)

## Common Issues Found

### Single Responsibility violations in components
**Pattern:** Components mixing data computation with presentation (e.g., WeekGrid computing `labelRows` inline).
**Fix:** Extract computation to pure functions in utility modules (grid.ts, colors.ts).

### Duplicate constants across files
**Pattern:** Color mappings (BG_TO_TEXT) hardcoded in multiple places instead of derived from PALETTE.
**Fix:** Derive programmatically in colors.ts, export as single source of truth.

### Anti-patterns masking timing issues
**Pattern:** `useRef` + `useEffect` + `setTimeout` to work around render-phase save calls.
**Example:** App.tsx `configRef` pattern (lines 16-26).
**Fix:** Use straightforward `useCallback` with proper dependency array.

### Performance: Redundant object creation in hot paths
**Pattern:** Creating Date objects from ISO strings inside loops (e.g., `findPeriod()` called 4,680× per render).
**Fix:** Pre-parse dates once in useMemo, pass parsed objects down.

## Known Bugs

### Date mutation in getCellDate() (TASKS.md)
**Location:** `grid.ts` line 5
**Issue:** `new Date(birthdate)` then `setDate()` mutates the original Date object.
**Fix:** Use `new Date(birthdate.getTime())` to create true copy.

## Architectural Decisions

### No global state library
Deliberate choice for simplicity. State lives in App component, passed down as props. Works well for single-page app with limited state.

### ISO string dates in storage, Date objects in runtime
Clean separation: storage format (JSON-compatible strings) vs. runtime format (Date objects for calculations). Conversion happens at App boundary.

## Review Patterns

### What to prioritize:
1. Single Responsibility violations (high impact on maintainability)
2. Duplicate logic/constants (DRY violations)
3. Performance issues in hot paths (useMemo/useCallback targets)
4. Known bugs from TASKS.md

### What to accept as pragmatic:
- Direct localStorage calls (no need for abstraction until multiple backends needed)
- Tightly coupled ConfigForm props (single-use component, not a library)
- Inline styles where Tailwind config overhead isn't justified

## Files to Watch

**High complexity:**
- `src/components/WeekGrid.tsx` — Largest component, mixing concerns
- `src/App.tsx` — State orchestration

**Pure utilities (should stay pure):**
- `src/grid.ts`
- `src/colors.ts`
- `src/storage.ts`
