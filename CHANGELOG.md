# Changelog

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
