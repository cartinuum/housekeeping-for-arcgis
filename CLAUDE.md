# Project: Housekeeping for ArcGIS

## Intent

Build a content intelligence and review tool for ArcGIS Online users and administrators.

The purpose of this app is to help people understand ArcGIS Online content at scale, identify items that may be consuming credits or creating management burden, and decide what action to take next. The experience should feel like WinDirStat for ArcGIS Online: a visual, at-a-glance way to see where the "weight" is, who owns it, how content is distributed, and which items deserve attention first.

The app supports three stages in a single workflow:

1. **Inventory** — a visual, organisation-wide or user-scoped overview of content, with the treemap as the primary metaphor. This is where patterns and outliers become obvious.
2. **Triage** — the user selects a subset of items (typically 3–30) for deeper review. For selected items the app fetches additional signals: item usage over the last 60 days, dependency counts, owner context, staleness, and other triage indicators.
3. **Action** — the user acts on the triaged subset. Phase 2 supports notifying owners via a pre-filled email. Phase 3 may add ownership transfer and recycle-bin deletion, with strong UX guardrails.

The tool is designed for informed action, not passive reporting. It answers: *what content exists, who owns it, what depends on it, what looks stale, and what should be reviewed first?* The ideal outcome is not a prettier inventory view — it is a practical tool that helps reduce clutter, manage risk, communicate with content owners, and make better decisions about what to keep, move, or remove.

---

## Personas

The app serves two personas from the same codebase. Role is detected from `/portal/self` after sign-in.

### Standard user

A content owner who signs in to review their own content. Scope is fixed to their own items — there is no org-wide view, no Emulation Mode, and no user emulation. The scope toggle and admin-only controls are structurally absent from their UI, not disabled. The inventory → triage → action workflow is identical; only the data scope differs.

### Organisation administrator

An admin who can view their own content, view the entire organisation's content, or emulate another user via Emulation Mode. All three workflow stages are available. Emulation Mode always shows the emulated user's identity in the sidebar with a dashed warning-colour ring, while the signed-in admin's identity remains in the top-right navigation. This dual identity display is non-negotiable.

## Non-goals

These are the things this tool explicitly does not do. Claude CLI should push back on any suggestion that blurs these lines.

- **Not a replacement for ArcGIS Online administration.** Item editing, group management, and sharing changes stay in AGOL.
- **Not a generic inventory browser.** If the user wants a flat list with filters, AGOL already has that.
- **Not a credits calculator.** Credits are a lens on content, not the product. Credit estimation is heuristic and flagged as such in the UI.
- **Not an automated clean-up tool.** Every destructive action requires an authenticated, deliberate human step. No "suggest deletions" buttons.
- **Not an auto-notifier.** The app prepares messages; the user sends them from their own email client.
- **Not ArcGIS Enterprise.** ArcGIS Online only. No on-prem, no hybrid.

---

## Stack

| Concern | Choice |
|---|---|
| Build | Vite + React 18 + TypeScript |
| Server state | TanStack Query (React Query) v5 |
| UI state | Zustand |
| UI components | Calcite Design System 5 Web Components (`<calcite-*>`) |
| Charts | Apache ECharts v5 (`echarts-for-react`) — treemap |
| Auth | `@esri/arcgis-rest-request` v4 — `ArcGISIdentityManager`, PKCE OAuth2 |
| Styles | `sass` (Dart Sass) |
| Target | ArcGIS Online only. No Enterprise. |

---

## Design Standards

- **Icons:** `<calcite-icon>` always. No emoji, no custom SVG unless Calcite has no equivalent.
- **Font:** Avenir Next via `--calcite-font-family` — never override. Calcite 5 provides it automatically.
- **Spelling:** Australian English (optimisation, organisation, colour, visualisation).
- **Feel:** Must match ArcGIS Online. When in doubt, check how ArcGIS Online does it.
- **Colour identifiers:** Use AU spelling — `typeColourMap`, `OTHER_COLOUR`, `buildTypeColourMap`.

---

## Architecture

### Shell structure

```
<calcite-shell>
  <calcite-navigation slot="header">   ← logo, emulation mode notice, signed-in user + popover
  <calcite-shell-panel slot="panel-start" displayMode="float">
    ← profile card (target user), credit/storage stats, scope toggle, emulation search, filters
  <div style="height:100%">            ← toolbar + chip legend + treemap/table + review basket
```

### Workflow navigation

The three workflow stages (inventory, triage, action) are URL-backed routes, not modal overlays:

- `/` — inventory (treemap + table, default)
- `/review?ids=<comma-separated-item-ids>` — triage panel for selected items
- `/action?ids=<...>&type=notify` — action composition (Phase 2+)

The review basket is a **persistent right-side panel** (using `calcite-shell-panel slot="panel-end"`) that shows selected items across the inventory view. Clicking "Review these items →" navigates to `/review?ids=...` without losing the basket. The back button returns the user to inventory with selections intact.

**Rationale:** breadcrumbs imply hierarchical navigation. This workflow is sequential, not hierarchical. The pattern follows Gmail's bulk-selection bar, Jira's bulk-edit, and GitHub's PR file review.

### Key decisions

1. **Treemap metrics:** Credits/month (default) and Storage. Credits/month surfaces the highest-cost items. Storage sizes tiles by bytes — useful when credit rate distortion (Feature Services at 240 cr/GB) would otherwise drown out other types.
2. **Credit rates:**
   - Feature Service: 2.4 cr / 10 MB/mo (≈ 240 cr/GB — highest cost by far)
   - Notebook: 12 cr / GB/mo
   - Everything else: 1.2 cr / GB/mo
   - Source: `https://doc.arcgis.com/en/arcgis-online/administer/credits.htm` (validated 2026-04-11)
3. **Emulation Mode:** Admin views another user's content. The signed-in admin's identity is always shown in the top-right nav; the emulated user's identity shows in the sidebar card with a dashed warning-colour ring. Emulation Mode resets scope to 'own' and clears filters. Destructive UI is absent (not disabled) in Emulation Mode.
4. **Delete:** Phase 2 only. Phase 1 contains zero destructive API calls.
5. **Auth:** Single public `clientId`. PKCE redirect flow (`popup: false`). No token in localStorage.
6. **Hosting:** AWS S3 + CloudFront or Azure Static Web Apps. Custom domain. Public tool.
7. **Org scope — user-sampling strategy:** `/search` returns `size: -1` for all hosted services (Feature Services, Map Services). Org mode uses `/portals/{orgId}/users?sortField=storageusage&sortOrder=desc` (admin endpoint) to find the top 50 storage users, then fetches each user's full content via `/content/users/{username}` which returns accurate sizes. Results are sorted by credits/mo descending, capped at 500.

---

## Triage Signals Catalogue

Each signal has a known source, API cost, and phase. Signals are fetched lazily — only when an item enters the review basket — using TanStack Query. Individual signals can be in states `loading | loaded | failed | unavailable` and must render independently; a slow dependency lookup must not block the views sparkline.

| Signal | Source | Cost per item | Failure mode | Phase |
|---|---|---|---|---|
| Cumulative views | `numViews` (in `/search` response) | Free | Always available | 1 |
| Last viewed date | `lastViewed` (in `/search` response) | Free | May be missing for unused items | 1 |
| Days since modified | computed from `modified` | Free | Always available | 1 |
| Sharing level | `access` (in `/search` response) | Free | Always available | 1 |
| Owner email + status | `/community/users/{username}` | 1 call per owner (cache) | May return no email; user may be inactive | 2 |
| **60-day views sparkline** | `/sharing/rest/portals/{orgId}/usage?vars=num&resourceId={itemId}&startTime={ms}&endTime={ms}&period=1d` | 1 call per item | Returns zeros for items never viewed; may error for certain item types | 2 |
| Dependency counts (upstream + downstream) | `arcgis-rest-request` wrapper around `/relationships` + `/data` inspection | 1–3 calls per item | Slow for deep chains; cap at 1 level in triage | 2 |
| Metadata completeness | `scoreCompleteness` (in `/search` response) | Free | Always available | 2 |
| Content status | `contentStatus` (in `/search` response) | Free | Often null | 2 |
| Full dependency graph | `ItemGraph` equivalent — recursive traversal | Variable, can be slow | Network/timeout possible | 3 (secondary action only) |

### Sparkline details

The 60-day window is the sweet spot: ArcGIS Online's server-side usage endpoint has a documented 60-day block limit, so `60D` maps to a single request per item with no pagination. The Python SDK supports `"7D"`, `"14D"`, `"30D"`, `"60D"`, `"6M"`, `"1Y"`, but longer ranges require multiple requests stitched together. Start with 60D fixed; do not expose range as a user control in Phase 2.

Granularity is daily. A 60-day sparkline = 60 data points. Render with ECharts `sparkline` config, no axes, ~80px wide, beneath the view count in the review panel.

### Dependency depth

Phase 2 fetches **upstream and downstream counts only** (1 level deep). This is a count, not a graph. A secondary action "View as graph" opens a modal knowledge-graph view in Phase 3. Do not build the graph visualisation in Phase 2 — counts are sufficient to inform the triage decision.

---

## Phase 1 — Complete

**Scope:** Sign-in → fetch content → ECharts treemap (credits + storage) → pinned tooltip with Open button → chip legend with type filters → table view with sortable columns → Emulation Mode (admin user emulation).

| # | Component | Key files |
|---|---|---|
| 1 | Scaffold | `package.json`, `vite.config.ts` |
| 2 | Types + Zustand store | `src/types/arcgis.ts`, `src/store/useAppStore.ts` |
| 3 | Credit utility | `src/utils/credits.ts`, `src/__tests__/credits.test.ts` |
| 4 | Treemap data transform | `src/utils/treemap.ts`, `src/__tests__/treemap.test.ts` |
| 5 | Config + Auth entry | `src/config.ts`, `src/main.tsx`, `src/styles/main.scss` |
| 6 | Auth hook + SignInPage | `src/auth/useAuth.tsx`, `src/auth/SignInPage.tsx`, `src/App.tsx` |
| 7 | API hooks | `src/api/userInfo.ts`, `src/api/userContent.ts`, `src/api/mapItem.ts` |
| 8 | Navigation | `src/components/Navigation.tsx` |
| 9 | Sidebar | `src/components/Sidebar.tsx` |
| 10 | Toolbar + ChipLegend | `src/components/Toolbar.tsx`, `src/components/ChipLegend.tsx` |
| 11 | TreemapView | `src/components/TreemapView.tsx` |
| 12 | TableView | `src/components/TableView.tsx` |
| 13 | Dashboard + App wiring | `src/components/Dashboard.tsx`, `src/App.tsx` |
| 14 | Emulation Mode | `src/api/orgUsers.ts`, `src/components/Sidebar.tsx` |
| 15 | Org scope | `src/api/orgContent.ts`, `src/store/useAppStore.ts` |

## Phase 2 — In progress

**Scope:** Item selection → review panel → triage signals → notify owner workflow. Also needs Emulation Mode context banner design (indicating whose content is being viewed).

### Phase 2 completed so far

| # | What | Key files |
|---|---|---|
| Routing | `HashRouter` in `main.tsx`; routes `/#/`, `/#/review`, `/#/action` | `src/main.tsx`, `src/App.tsx` |
| Role detection (#9) | `isAdmin` computed synchronously in AppShell, passed as prop to Sidebar (not read from Zustand — avoids one-render race); non-admins see no scope toggle, no emulation search, no "Notify owners →" button | `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/ReviewPanel.tsx` |
| Sidebar gating | Hidden on `/review` and `/action`; `location.pathname === '/'` check in `AppShell` | `src/App.tsx` |
| Placeholder routes | `ReviewPanel.tsx` (URL hydration + back button), `ActionPanel.tsx` (back button) | `src/components/ReviewPanel.tsx`, `src/components/ActionPanel.tsx` |
| `selectedIds` in Zustand | Basket IDs with `setSelectedIds` + `toggleSelectedId` | `src/store/useAppStore.ts` |
| URL hydration | `ReviewPanel` reads `?ids=` on mount, writes back on change (debounced 300ms); uses `useState` for hydration guard — see Technical Discoveries | `src/components/ReviewPanel.tsx` |
| Review basket UI | Checkbox column in table, `+ Review` button in treemap tooltip, `BasketPanel` (`panel-end`) with item list + "Review these items →" nav | `src/components/TableView.tsx`, `src/components/TreemapView.tsx`, `src/components/BasketPanel.tsx`, `src/App.tsx` |
| `orgId` in Zustand | Set once from `signedInUserInfo.orgId` in AppShell; read by BasketPanel + ReviewPanel for sparkline queries | `src/store/useAppStore.ts`, `src/App.tsx` |
| Triage signals (#3–#6) | `useOwnerInfo`, `useUsageSparkline`, `useDependencyCounts` hooks + `useTriageSignals` facade; prefetch in BasketPanel; 25-item basket cap with `BASKET_LIMIT = 25` exported from BasketPanel | `src/api/triageSignals.ts`, `src/components/BasketPanel.tsx` |
| Sparkline (#4) | `Sparkline.tsx` — 80×24px ECharts line, no axes, SVG renderer, "No activity" empty state | `src/components/Sparkline.tsx` |
| TriageStrip (#5–#6) | Horizontal strip: left (title/type/access/credits), centre (owner+email/modified/views/sparkline), right (dep chips/launch/remove) | `src/components/TriageStrip.tsx` |
| ReviewPanel (#6) | Full implementation — scrollable strip list sorted by credits desc, sticky header + footer ("Notify owners →" → `/action`) | `src/components/ReviewPanel.tsx` |

### Phase 2 remaining (priority order)

1. ~~**#7 Batch notification composer**~~ — **COMPLETE** ✓ (commit 63b3d60)
   - `src/utils/notify.ts` — buildEmailBody, buildBatchEmailBody, buildMailtoUrl, isMailtoTooLong, groupItemsByOwner
   - `src/components/ActionPanel.tsx` — grouped-by-owner table, per-owner + batch mailto:, useQueries, clipboard fallback
   - `src/components/TriageStrip.tsx` — reason tag calcite-select (internal, not in email)
   - `src/components/ReviewPanel.tsx` — reasonMap state passed to TriageStrip
   - `src/store/useAppStore.ts` + `src/App.tsx` — adminFullName in Zustand
2. ~~**#8 Emulation Mode context banner**~~ — **COMPLETE** ✓ (commits cc1da18, 452b2ec, 2c1dbac)
   - `src/store/useAppStore.ts` — `viewingUserFullName: string | null` + `setViewingUserFullName`
   - `src/App.tsx` — `useEffect` syncs from `userInfo.fullName` when emulating; clears on exit
   - `src/components/EmulationBanner.tsx` — `calcite-notice kind="warning"`, dismiss-per-route, event listener re-attached after route-change reset

**Phase 2 COMPLETE. Hardening in progress — see open items in `issues.md`.**

### 2026-04-25 session (post-Phase 2 hardening)

| What | Key files |
|---|---|
| Dependency graph modal | `src/components/DependencyGraph.tsx` (new), `src/components/DependencyGraphModal.tsx` (new) — custom RAF physics, drag/zoom/pan, imperative SVG; "View as graph →" added to dep overlay in TriageStrip |
| ActivityBadge | `src/components/ActivityBadge.tsx` — replaces sparkline; staleness tier (Active/Recent/Quiet/Dormant) from `lastViewed` + `numViews`, 4-segment bar |
| Non-admin Done reviewing | `src/components/ReviewPanel.tsx` — footer shows "Done reviewing" for non-admins; "Notify owners →" stays admin-only |
| Dep chip UX redesign | `src/components/TriageStrip.tsx` — replaced floating DepOverlay + chips with inline expandable `DepSection` cards: "Dependencies" (downstream) and "Data sources" (upstream); type icons via `<foreignObject>` in graph nodes; "View graph →" at section level |
| Credits note fix | `src/components/Dashboard.tsx` — condition changed from `treemapGroups.length === 1` to `treemapGroups.some(g => g.name === 'Feature Service')` so note shows on initial load |
| Treemap tile click → basket toggle | `src/components/TreemapView.tsx` — tile click now toggles basket; tooltip "Open" is the AGOL path; basket-full guard preserved |
| Graph node type icons | `src/components/DependencyGraph.tsx` — `<foreignObject>` + `<calcite-icon>` inside each node circle; uses `iconFor()` from `itemIcons.ts` |

### 2026-04-26 session (UX hardening + P1 fixes)

| What | Key files |
|---|---|
| Basket overlay (not dock) | `src/components/BasketPanel.tsx` — `display-mode="overlay"` set via `setAttribute` imperatively (React does not serialise camelCase JSX props to kebab-case attrs on custom elements); panel floats over treemap/table |
| Basket minimise/pull-tab | `src/components/BasketPanel.tsx` — collapse to brand-coloured vertical pull-tab portalled to `document.body`; auto-expands on basket add |
| Basket credits subtotal | `src/components/BasketPanel.tsx` — "Potential saving" row, `calcCreditsPerMonth` sum, bold, no traffic-light colour |
| Welcome "don't show again" | `src/components/WelcomeOverlay.tsx` — pre-ticked checkbox in footer; "Got it" persists if checked, session-only dismiss if unchecked |
| Org portal URL everywhere | `src/utils/portalUrl.ts` (new) `buildItemUrl(hostname, itemId)`; `src/api/userInfo.ts` `usePortalSelf()`; used across 7 call sites; `portalHostname` in Zustand |
| Stale `cartinum` refs removed | `package.json`, `index.html`, `README.md`, `PRE_RELEASE_PLAN.md` — all URLs updated to `simongis/housekeeping` |

### 2026-04-26 session (Polish + release prep)

| What | Key files |
|---|---|
| Sidebar collapsible toggle | `useAppStore.ts` — `sidebarOpen`/`setSidebarOpen`; `Toolbar.tsx` — `dock-left` `calcite-action` with `active` state; `App.tsx` — Sidebar conditionally rendered on `sidebarOpen` |
| Emulation gating on privilege | `src/types/arcgis.ts` — `privileges: string[]` in `UserInfo`; `src/api/userInfo.ts` — populated from API; `src/App.tsx` — `canEmulate = privileges.includes('portal:admin:viewUsers')`; passed to `WelcomeOverlay` + `Sidebar` |
| Reason dropdown UX | `src/components/TriageStrip.tsx` — `<calcite-label>` wrapper + info icon + tooltip on purpose; `suggestReason()` auto-populates on mount |
| Credits chip legibility | `src/components/TriageStrip.tsx` — font 11→13px, weight 600→700, padding 2→3px |
| Disabled email tooltip | `src/components/ActionPanel.tsx` — `<span>` wrapper for disabled button; contextual message (self-owned vs no emails) |
| Usage service type coverage | `src/api/triageSignals.ts` — SceneServer/GeometryServer/GPServer added to `extractServiceInfo`; `stype` union extended |
| Deploy base path fix | `.github/workflows/deploy.yml` — `GITHUB_PAGES_BASE` corrected to `/housekeeping/` |
| Dep fetch kept at 1 level | `src/api/triageSignals.ts` — 2-level expansion reverted; "direct only" sublabel added to DepSection in TriageStrip |
| Dual-ended range sliders | `src/components/Sidebar.tsx` — `minValue`/`maxValue` on both sliders; `useAppStore.ts` — `maxCredits`/`maxSizeBytes` in Filters; `filters.ts` + `Dashboard.tsx` — upper-bound filtering added |

---

## Technical Discoveries

These are non-obvious behaviours discovered during implementation. Read before touching the relevant areas.

### Calcite web components

- **Package name:** `@esri/calcite-components` (not `@arcgis/calcite-components`).
- **Registration:** `import '@esri/calcite-components'` registers nothing. Always use `import { defineCustomElements } from '@esri/calcite-components/loader'` + `defineCustomElements(window)` before rendering.
- **CSS import:** `@esri/calcite-components/main.css` (not `dist/calcite/calcite.css` — not in package exports).
- **JSX props:** camelCase — `displayMode` not `display-mode`. `calcite-shell-panel` has no `collapsible` attribute. **Exception:** `calcite-shell-panel displayMode` does NOT reach the DOM as a camelCase prop — use `ref` + `setAttribute('display-mode', 'overlay')` imperatively in a `useEffect`.
- **Events:** Use `ref` + `addEventListener` for all Calcite events. JSX inline `onCalcite*` props do not work reliably with Calcite 5 TypeScript types.
- **Segmented control init state:** Set `checked={value === 'x' || undefined}` on each `<calcite-segmented-control-item>`. The parent `value` prop is not reliable on first render.
- **`calcite-shell` layout:** Uses CSS grid internally, not flexbox. Use `height: 100%` on children to fill grid cells — `flex: 1 1 0` has no effect.
- **`calcite-popover` inside `calcite-navigation`:** Floating-UI gets a 0×0 bounding rect. Always portal to `document.body` with `createPortal`.
- **`calcite-block` overflow:** Clips slotted children. Use `position: absolute; z-index: 999` on dropdowns — or portal to `document.body`.
- **`calcite-shell-panel` stacking context:** Creates `z-index: 2`. Any absolute dropdown inside it is capped at that stacking context. Fix: portal the dropdown to `document.body` using `position: fixed` + `getBoundingClientRect()`.
- **Calcite click-outside vs toggle:** On the same click that opens a popover, Calcite's internal handler fires `close`. Fix: capture open state before the event, defer `popover.open = !wasOpen` with `setTimeout(0)`.
- **`calcite-input-text` events:** `calciteInputTextInput` may not fire reliably — also listen to native `input` and `keyup`. Read value via `el.value` or `el.shadowRoot?.querySelector('input')?.value`.
- **Non-linear slider:** Use an index-mapped array (e.g. `SIZE_STEPS_MB`) — slider value is the index, mapped to actual bytes for filtering and display.
- **`calcite-chip` valid `kind` values:** Only `neutral | brand | inverse`. `"warning"` and `"danger"` are not valid — TypeScript will error. Use `kind="neutral"` with an icon for error/warning states in chips.
- **Icon naming:** Use `"circle-disallowed"` (not `"circle-disallow"` or `"x-circle"`). Always verify icon names against the Calcite icon set — guessing leads to TypeScript errors at build time.
- **Calcite icons inside SVG:** `<calcite-icon>` cannot be used as SVG children directly. Embed via `<foreignObject>` + a plain `<div>` wrapper created with `document.createElement` (not `createElementNS`). Set `overflow: visible` on the `<foreignObject>` and explicit `display: block` on the icon element. This works in all modern browsers and allows icon size/colour styling via inline style on the `calcite-icon` element.
- **`calcite-tooltip` referenceElement string ID is unreliable** when the anchor element is slotted inside a Calcite web component (e.g. inside `calcite-label`). Calcite tooltip's string ID lookup finds the element in the DOM but the hover listeners never attach correctly. Fix: always wire imperatively — use `ref` on both the tooltip and anchor, then set `tooltip.referenceElement = anchorEl` in a `useEffect`. Never rely on the string ID form for tooltips in this codebase.
- **`calcite-icon` has `pointer-events: none`** in its shadow CSS. Do not put a `calcite-tooltip` referenceElement ID directly on a `calcite-icon` — hover events will never fire. Wrap the icon in a `<span>` and put the ref/ID on the span instead.
- **ECharts treemap `label` vs `upperLabel`:** With `leafDepth` set, ECharts uses `upperLabel` for parent/group nodes (the coloured header strip) and `label` only for leaf nodes. Without an explicit `upperLabel` config on the group level, type-name labels never render on group tiles. Always configure both.

### Triage signals — FIXED (2026-04-20)

Owner info, sparkline, and dependency counts all resolve correctly on `/review`. Root cause of the original indefinite-spin bug was a wrong response shape assumption in `fetchSparkline`.

**Portal usage endpoint — confirmed response shape:**
```
{ data: [{ etype, task, stype, hostOrgId, num: [[epochMsStr, countStr], ...] }] }
```
`response.data` is an array of objects, not `[number, number][]`. Destructuring each object as `[, count]` threw `TypeError: object is not iterable`.

**Portal usage endpoint — resourceId does not filter for admin callers.** Calling `/portals/{orgId}/usage` as an org admin returns ~37k rows of org-wide usage data regardless of the `resourceId` param — both GET and POST. This is a server-side behaviour, not a client bug. The sparkline correctly shows "No activity" when all `num` values are zero (which is typical for Feature Services — they are accessed programmatically, not viewed in the portal sense).

**Must use `httpMethod: 'GET'`** in the `request()` call for this endpoint — POST body params are silently ignored. See `src/api/triageSignals.ts:fetchSparkline`.

### React Router + Zustand

- **HashRouter required:** No server config exists yet — hash routing (`/#/review`) avoids 404s on direct load. `HashRouter` wraps the whole app in `main.tsx`. All `navigate()` calls and `<Link>` use paths without the hash (e.g. `'/review'`) — the hash prefix is transparent to the router.
- **OAuth redirect compatibility:** `?code=` from the PKCE redirect is processed by `@esri/arcgis-rest-request` before React mounts. HashRouter does not interfere because the OAuth redirect lands on `/?code=...` not `/#/?code=...`.
- **URL hydration race condition:** `ReviewPanel` hydrates `selectedIds` from `?ids=` on mount and also writes `selectedIds` back to the URL on change. Using `useRef(false)` as a hydration guard doesn't work — the write-back effect fires a 300ms timer before the ref-gated setSelectedIds re-render completes, wiping the query string. Fix: use `useState(false)` for `hydrated`. Because `setHydrated(true)` triggers a re-render, the write-back effect (which lists `hydrated` in its deps) won't execute until after hydration is complete. See `src/components/ReviewPanel.tsx`.
- **Sidebar/basket panel visibility:** `const showSidebar = location.pathname === '/'` in `AppShell` gates both the `<Sidebar>` and `<BasketPanel>`. Both components are only mounted on the inventory route.

### OAuth / Auth

- **`popup: false` required:** Default popup mode stores the session in the popup window's `sessionStorage` — the main app never receives it. Always pass `popup: false` to `beginOAuth2` to use redirect flow.
- **`SESSION_KEY`:** Exported from `src/config.ts` — single source of truth.
- **`useAuth`:** React context (`AuthProvider` in `main.tsx`) — not a plain hook. Avoids auth state divergence across consumers.

### ArcGIS API behaviour

- **`/search` sizes:** Returns `size: -1` for all hosted services (Feature Services, Map Services, Web Maps, Dashboards). Only file-backed items return accurate sizes. Do not use `/search` for credit or storage analysis at org scope.
- **`/content/users/{username}`:** Returns accurate sizes for all item types including hosted Feature Services. This is the correct endpoint for credit analysis. Fetches root + folders; see `userContent.ts` for the folder-iteration pattern.
- **Org user listing (admin):** Use `/portals/{orgId}/users` with `pnum` (not `num`), supports `sortField=storageusage`. Returns `.users` array. Do NOT use `/community/users` for this — that is a text search API, returns `.results`, and does not support storage sorting.
- **Org user text search:** `/community/users?q=orgid:{orgId} {searchTerm}` — freetext within org. Field-specific wildcard (`fullname:ben*`) is not reliably supported.
- **Org content — user-sampling strategy:** Fetch top 50 users by `storageusage` desc, then fetch each user's full content via `/content/users/{username}`. Throttle at 5 concurrent user fetches. Flatten, sort by credits/mo desc, cap at 500. See `src/api/orgContent.ts`.
- **Pagination:** Use `nextStart` cursor — loop until `nextStart === -1`.
- **Item usage endpoint:** `/sharing/rest/portals/{orgId}/usage` with `vars=num`, `startTime`/`endTime` as epoch ms, `period=1d`, `resourceId={itemId}`. 60-day maximum block per request. Returns `[[timestamp, count], ...]` rows.
- **Related items:** `/content/items/{id}/relatedItems?relationshipType=<type>&direction=forward|reverse`. Use `Map2Service`, `WMA2Code`, `Survey2Service` etc. for common dependencies.
- **User thumbnail auth:** Append `?token={session.token}` to `/community/users/{username}/info/{thumbnail}` — private org thumbnails require auth.

### React + ECharts

- **ECharts tile minimum area:** Tiles below a threshold pixel size are not rendered. In credits mode with Feature Services, other types may occupy <0.2% of area. Storage mode resolves this.
- **Stable type colours:** `buildTypeColourMap(items, metric)` in `treemap.ts` builds a stable `Map<string, string>` from the full unfiltered set. Pass to `buildTreemapData` so colours never shift when filters are applied.
- **Treemap item cap:** `TREEMAP_ITEM_LIMIT_OWN = 200`, `TREEMAP_ITEM_LIMIT_ORG = 100` in `Dashboard.tsx`. Items sorted by active metric before slicing.
- **`mapItem` shared:** `src/api/mapItem.ts` — both `orgContent.ts` and `userContent.ts` import from here.
- **Sparkline rendering:** Use ECharts `line` series with `showSymbol: false`, no axes, no grid padding, `animation: false`. Target width ~80px, height ~24px. Render empty state (dashed horizontal line + "No activity") when all values are 0.
- **Treemap container sizing:** `calcite-shell` CSS grid settles ~100ms after page load; chip legend and toolbar also shift layout as AGOL content loads (~7s). Do NOT use `onChartReady` alone for initial resize — ECharts initialises at the wrong width. Fix: wrap `ReactECharts` in a `ref`'d div and observe it with `ResizeObserver` (fires on every layout shift); also call `resize()` in a 400ms `onChartReady` timeout as a fallback. Do NOT observe `instance.getDom()` — ECharts holds that element at a fixed size and the observer never re-fires.
- **Item thumbnails:** `/sharing/rest/content/items/{id}/info/{thumbnail}` serves thumbnails without auth (no `?token=` needed). Always handle `onError` with a visible fallback (type icon in a neutral box) — some items have a `thumbnail` field set but the file does not exist on the server.

---

## Running the app

```bash
npm run dev        # dev server at http://localhost:5173
npm run build      # production build (type-check + vite build)
npm test           # vitest (35 tests)
```

**Dev server must run on port 5173** — the OAuth redirect URI is registered to that port. If Vite reports "Port 5173 is in use", kill the blocking process before starting:

```bash
# Find and kill whatever is on 5173 (PowerShell — works reliably on Windows)
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"
npm run dev
```

**Client ID:** `WJqGeYvEa2XQEZ9Q` (set in `src/config.ts`)
Redirect URI `http://localhost:5173` must be registered at https://developers.arcgis.com/applications

**Sign-in flow:** Click "Sign in with ArcGIS Online" → full tab redirect (not popup) → approve → redirected back → dashboard loads.

---

## Legacy Reference

The `master` branch contains the original app (React 16, deprecated libraries). Useful for reference only.

| What to look up | Where |
|---|---|
| Credit formula | `src/utils/profile.js:95` |
| Treemap data transform | `src/utils/chart.js:51` |
| Item type list | `src/constants/items.js` |
| ArcGIS API patterns | `src/services/argis.js` |
| Folder flattening | `src/middlewares/profile.js:42` |

Legacy start: `npm start` from repo root (runs on `http://localhost:3000`).

---

## Working with Claude CLI

When continuing this project in a new Claude CLI session, this file is the entry point. Expect Claude CLI to:

1. Read this file fully before making architectural suggestions.
2. Challenge additions that blur the non-goals list.
3. Respect the three-phase boundary — no Phase 3 work until Phase 2 is validated.
4. Prefer primary sources (ArcGIS REST API docs, Calcite docs) over assertions from training data when making claims about API behaviour.
5. Use Australian English spelling in all generated code, comments, and UI copy.
6. Avoid marketing language, hype, or emoji in any output.

For reference: the related personal project `decluttering` (https://github.com/simongis/decluttering) contains a `declutter_publish.ipynb` that demonstrates `item.usage(date_range="60D", as_df=True)` — useful as a reference for the Python-equivalent signal calls we're translating to REST in this app. The `arcgis-python-api` repo's Admin Insights notebook is another reference for governance signal extraction patterns.
