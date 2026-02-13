# Security Review Findings (2026-02-13)

Overall risk: **Low** — static frontend with no user input, no backend, no external API calls.

## MEDIUM

- [ ] **Missing security headers** — `index.html` lacks CSP, X-Frame-Options, X-Content-Type-Options. Add meta tags or configure HTTP headers at the deployment layer.

## LOW

- [ ] **Date object mutation** — `getCellDate()` in `src/grid.ts` mutates the input `birthdate` via `setDate()`. Use `new Date(birthdate.getTime())` to avoid side effects.

## INFO

- [ ] **Locale-dependent date formatting** — `toLocaleDateString()` in `WeekGrid.tsx` tooltips produces inconsistent formats across browsers/locales. Consider ISO format or `Intl.DateTimeFormat`.
- [ ] **No input validation on config** — `src/config.ts` has no validation. Add validation if config ever becomes user-editable or externally loaded.
- [ ] **No SRI policy** — No subresource integrity hashes. Document a policy requiring SRI for any future CDN-loaded resources.
- [x] **TypeScript strict mode enabled** — Positive finding; maintain this setting.
