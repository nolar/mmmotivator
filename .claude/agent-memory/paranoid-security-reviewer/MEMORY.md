# Security Review Memory

## Project: Life in Weeks Visualization - UPDATED 2026-02-13

### Architecture Overview
- React 19.2.0 + Vite 7.3.1 + TypeScript 5.9.3 + Tailwind CSS 4.1.18
- Client-side SPA with localStorage persistence and JSON import/export
- **USER INPUT SOURCES**: ConfigForm (birthdate, totalYears, periods), JSON file upload, localStorage
- Data flow: User input → Validation (WEAK) → State → localStorage → React rendering

### Security Posture
- **Attack Surface**: User input via form fields, JSON file uploads, localStorage manipulation
- **Data Flow**: User input → Validation (WEAK) → State → localStorage → React rendering
- **Dependencies**: All clean per npm audit (2026-02-13)
- **Critical Findings**: Insufficient validation on JSON import, potential DoS, localStorage XSS risk

### HIGH-PRIORITY VULNERABILITIES (Comprehensive Review 2026-02-13)

#### 1. HIGH - Arbitrary JSON Deserialization (CWE-502)
- **Location**: `./src/storage.ts` lines 66-80
- **Issue**: `validateConfig()` only checks primitive types, not content/format/ranges
- **Allows**: Malformed dates, negative/huge numbers, unbounded arrays, arbitrary color strings
- **Impact**: DoS via memory exhaustion, UI crashes, potential code execution if color unsanitized
- **Fix Required**: Strict regex for dates, range checks (1-150 years), array limits (100), string limits (100 chars), color whitelist

#### 2. HIGH - localStorage XSS Risk (CWE-79)
- **Location**: `storage.ts` + `WeekGrid.tsx` line 109-111
- **Issue**: Labels stored/loaded from localStorage without HTML sanitization
- **Mitigation**: React JSX auto-escaping prevents immediate exploit
- **Risk**: Future `dangerouslySetInnerHTML` would enable XSS
- **Fix Required**: Strip HTML tags via `sanitizeString()`

#### 3. MEDIUM - Missing Security Headers (CWE-1021)
- **Location**: `./index.html`
- **Issue**: No CSP, X-Frame-Options, X-Content-Type-Options
- **Fix Required**: Add meta tags or configure web server headers

#### 4. MEDIUM - DoS via Memory Allocation (CWE-770)
- **Location**: `WeekGrid.tsx` lines 32-49
- **Attack**: Import JSON with `totalYears: 10000` → 520k DOM elements → freeze
- **Fix Required**: Component-level validation guard

#### 5. MEDIUM - Unvalidated Number Input (CWE-20)
- **Location**: `ConfigForm.tsx` lines 86-94
- **Issue**: HTML5 `min`/`max` bypassed via DevTools
- **Fix Required**: JS validation in onChange

### Key Files for Security
- `./src/storage.ts` - PRIMARY ATTACK VECTOR
- `./src/components/ConfigForm.tsx` - User input
- `./src/components/WeekGrid.tsx` - Rendering
- `./index.html` - Headers

### Verified Safe
- NO `dangerouslySetInnerHTML` in codebase
- All rendering uses safe React JSX
- `getCellDate()` does NOT mutate input (CLAUDE.md was wrong)
