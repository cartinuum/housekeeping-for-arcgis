# Changelog

## [0.2.1] - 2026-05-06

### Fixed
- Organisation inventory ranking now reflects real credit consumption. The portal users API does not honour `storageusage` (and similar) sort fields; sampling by that ordering produced misleading mixes. Org mode now uses the same analytics source as ArcGIS Online credit overview (`/portals/self/analytics/topn`), with automatic fallback to the previous per-user content sampling if analytics is unavailable.

### Added
- `analyticsCredits` on items when sourced from analytics, and credit displays prefer this measured figure over the heuristic when present.
- Playwright scripts (`test:e2e`, `test:e2e:ui`, `test:e2e:headed`) for automated browser tests.
- Cloudflare Web Analytics beacon on the static site (hosted script only; not bundled as an npm dependency).

### Changed
- Sign-in layout improvements on narrow viewports.
- Welcome overlay messaging for signed-in standard (non-admin) users.
- Review basket clears and filters reset when switching between Own and organisation scope.

### Technical
- New `src/api/orgAnalytics.ts`; `orgContent.ts` simplified to orchestrate analytics-first then fallback.
- `itemCreditsPerMonth()` and treemap/filter utilities consume optional analytics-backed credits consistently.

## [0.2.0] - 2026-04-20

### Added
- Rebrand to "Housekeeping for ArcGIS"
- Review basket — select items from the inventory for triage
- Triage review panel (`/review`) — 60-day views sparkline, dependency counts, owner details, modification age per item
- Batch notification composer (`/action`) — grouped by owner, pre-filled `mailto:` drafts, clipboard fallback for long drafts
- Emulation Mode context banner — warning notice on `/review` and `/action` reminding admins whose content they are reviewing
- Apache-2.0 licence

### Changed
- "Ghost Mode" renamed to "Emulation Mode" throughout
- OAuth client ID now configurable via `VITE_ARCGIS_CLIENT_ID` environment variable

### Technical
- HashRouter URL-backed workflow state (`/#/`, `/#/review?ids=...`, `/#/action?ids=...`)
- TanStack Query `useQueries` for parallel owner info fetching
- Zustand store extended with `selectedIds`, `isAdmin`, `orgId`, `adminFullName`, `viewingUserFullName`
