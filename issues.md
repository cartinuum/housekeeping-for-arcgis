# Issues & Enhancements

> **How to use:** Add new items under Open with a priority tag. Move to Closed when resolved (one row in the table).
> Priority guide: **P1** = broken or misleading, fix now. **P2** = polish or UX improvement, fix soon. **Backlog** = valid but not urgent.

---

## Open

[ ] Update readme.md that will sit int github.

### P1 — Fix now


### P2 — Polish & improvements

- [ ] **Ctrl+click on treemap tiles.** Tile click already toggles basket. Add `ctrlKey` check so Ctrl+click skips the tooltip timer and fast-toggles for power-user multi-select. Low priority — current single-click pattern is already functional.

### Backlog

- [ ] **Phase 3: ownership transfer.** Requires careful UX guardrails and destination-user validation. Do not start until Phase 2 is validated with real users.

- [ ] **Accessibility audit.** Run axe DevTools on each route. Zero critical/serious violations target.

- [ ] **mailto: URL length test.** Document practical per-client limits (Outlook desktop/web, Gmail, Apple Mail, Thunderbird) in a comment at the top of the notify composer.

---

## Closed

| Date | Issue | How resolved |
|------|-------|--------------|
| 2026-04-27 | Treemap group labels missing during emulation (all leaf labels below threshold) | `TreemapView.tsx` — added `upperLabel` config to group level; ECharts treemap uses `upperLabel` (not `label`) for parent nodes when leafDepth is set |
| 2026-04-27 | Reason for review tooltip not firing on hover | `TriageStrip.tsx` — moved `id` from `calcite-icon` (pointer-events:none) to a wrapper `<span>`; tooltip message shortened to "Optional: used for notification" |
| 2026-04-27 | Treemap tile labels invisible on lighter-coloured groups (yellow rank-3 type) | `TreemapView.tsx` — `textBorderColor: rgba(0,0,0,0.55)` + `textBorderWidth: 1.5` ensures white text is legible on any tile colour |
| 2026-04-27 | No dependencies state showed nothing — unhelpful for services with zero deps | `TriageStrip.tsx` — inline "No dependencies detected" chip when scan completes with zero count; Phase 3 "Search Entire Org" button also shown in this state |
| 2026-04-27 | Stopping emulation left basket items from previous user | `Navigation.tsx` — added `viewingUser` to `useEffect` deps so `calciteNoticeClose` listener is re-registered when notice mounts on emulation start |
| 2026-04-26 | Reason-for-review tooltip too vague | `TriageStrip.tsx` — reworded to explain it goes into the notification email and helps owners decide: delete, update, transfer, or keep |
| 2026-04-26 | 30/60-day usage label confusing — "(service usage)" opaque | `UsageSignal.tsx` — "Last 30 days / Last 60 days"; info icon + tooltip explaining API requests vs portal views |
| 2026-04-26 | Sidebar toggle icon unclear | `Toolbar.tsx` — `dock-left` icon; `calcite-action` with active state; sidebar state in Zustand (`sidebarOpen`) |
| 2026-04-26 | Sidebar collapsible toggle | `useAppStore.ts` — `sidebarOpen`/`setSidebarOpen`; `Toolbar.tsx` — toggle action; `App.tsx` — Sidebar gated on `sidebarOpen` |
| 2026-04-26 | Usage stats limited to Feature/Map Services | `triageSignals.ts` — `extractServiceInfo` extended to SceneServer, GeometryServer, GPServer; `ServiceInfo.stype` union updated |
| 2026-04-26 | Credits/mo chip on review page hard to read | `TriageStrip.tsx` — font size 11→13, weight 600→700, padding 2px→3px |
| 2026-04-26 | Copy icon missing from notify page helper text | `ActionPanel.tsx` — inline `<calcite-icon icon="copy">` in footer hint |
| 2026-04-26 | "Email all owners" disabled with no explanation | `ActionPanel.tsx` — `<span>` wrapper so tooltip fires on disabled button; context-aware message |
| 2026-04-26 | Reason dropdown in review stage had no context | `TriageStrip.tsx` — `<calcite-label>` + info icon + tooltip; `suggestReason()` auto-populates on mount |
| 2026-04-26 | Emulation capability gated on role not privilege | `App.tsx` — `canEmulate = privileges.includes('portal:admin:viewUsers')` |
| 2026-04-26 | Dual-ended range sliders (Credits/mo and Storage) | `Sidebar.tsx` — `minValue`/`maxValue`; `useAppStore.ts` — `maxCredits`/`maxSizeBytes`; `filters.ts` + `Dashboard.tsx` — upper-bound filtering |
| 2026-04-26 | Table view Credits/mo traffic light matched review stage | `TableView.tsx` — three-tier green/orange/red |
| 2026-04-26 | Item size in review stage | File size chip already in TriageStrip; size column in table confirmed sufficient |
| 2026-04-26 | Owner full name in treemap tooltip | Out of scope — search API returns username only; full name needs /community/users call per hover |
| 2026-04-26 | GitHub Pages auto-deploy firing on every push | `deploy.yml` — removed `push` trigger; manual `workflow_dispatch` only |
| 2026-04-26 | Logo in header did not navigate home | `Navigation.tsx` — `div[role=button]` wrapping logo; `useNavigate('/')` |
| 2026-04-26 | Dependency depth showed 0 with no caveat | `triageSignals.ts` — 1-level only (AGOL API limitation); `TriageStrip.tsx` — "direct only" sublabel |
| 2026-04-26 | Treemap cap too low on large screens (2736×1824) | `Dashboard.tsx` — divisor 7 000→6 500; own cap 500→800 |
| 2026-04-26 | Welcome dialog had no explicit "never show again" | `WelcomeOverlay.tsx` — pre-ticked checkbox; "Got it" persists if checked |
| 2026-04-26 | Basket panel shifted treemap/table layout | `BasketPanel.tsx` — `display-mode="overlay"` via `setAttribute` imperatively |
| 2026-04-26 | Basket had no credits subtotal | `BasketPanel.tsx` — "Potential saving" row |
| 2026-04-26 | Basket had no minimise/collapse | `BasketPanel.tsx` — pull-tab portalled to `document.body`; auto-expands on add |
| 2026-04-26 | Favicon was placeholder SVG | `index.html` + `public/favicon.ico` |
| 2026-04-26 | Logo used generic house icon | `public/logo.svg` + `SignInPage.tsx` + `Navigation.tsx` |
| 2026-04-26 | Profile trigger div had blue browser focus ring | `Navigation.tsx` — `outline: none` |
| 2026-04-26 | Non-admin "Done reviewing" button was unstyled (white) | `ReviewPanel.tsx` — removed `appearance="outline"` |
| 2026-04-26 | Non-admin users saw reason dropdown in review stage | `ReviewPanel.tsx` — `onReasonChange` passed as `undefined` for non-admins |
| 2026-04-26 | Stopping emulation left previous user's items in basket | `useAppStore.ts` — `setViewingUser` clears `selectedIds` |
| 2026-04-26 | Table Credits/mo column used single hardcoded threshold | `TableView.tsx` — three-tier traffic light (green < 5, orange 5–40, red ≥ 40) |
| 2026-04-26 | Admin reason dropdown had no context on why it matters | `TriageStrip.tsx` — tooltip explains email usage; `suggestReason()` auto-populates |
| 2026-04-25 | Usage signal loading state blank | `UsageSignal.tsx` — neutral `calcite-notice` with inline loader |
| 2026-04-25 | UsageSignal URL double /sharing/rest | `triageSignals.ts` — removed duplicate path segment |
| 2026-04-25 | Usage API using wrong filter (resourceId) | `triageSignals.ts` — `groupby=name&name={serviceName}&stype={stype}` |
| 2026-04-25 | Credits display plain text, no visual weight | `TriageStrip.tsx` — traffic-light chip |
| 2026-04-25 | File size missing from review stage | `TriageStrip.tsx` — neutral chip with KB/MB/GB |
| 2026-04-25 | Welcome overlay missing | `WelcomeOverlay.tsx` — first-visit modal; localStorage dismissed per username |
| 2026-04-25 | Self-notification in Action stage | `ActionPanel.tsx` — self-owned groups excluded from email flow |
| 2026-04-25 | Remove-from-review icon confused with delete | Icon changed to `minus-circle`; tooltip clarifies no deletion |
| 2026-04-25 | Type column in table view had no colour coding | `typeColourMap` passed from Dashboard; coloured dot-badge |
| 2026-04-25 | Small tile labels losing unit on truncation | Formatter returns `''` below threshold |
| 2026-04-25 | Dependency graph keyboard navigation | `keydown` on graph nodes; Enter/Space opens item link |
| 2026-04-25 | Graph nodes had no item type icons | `<foreignObject>` + `<calcite-icon>` in `DependencyGraph.tsx` |
| 2026-04-25 | Treemap tile click opened AGOL instead of toggling basket | Tile click toggles basket; tooltip "↗ Open" remains the AGOL path |
| 2026-04-25 | Dependency chip UX — floating overlay, confusing labels | Inline expandable `DepSection` cards with item lists and type icons |
| 2026-04-25 | Credits note not appearing on page load | Condition: `treemapGroups.some(g => g.name === 'Feature Service')` |
| 2026-04-25 | Phase 3 dependency graph modal | Force-directed SVG graph in `DependencyGraphModal`; drag/zoom/pan |
| 2026-04-24 | Sparkline unreliable for admins | Replaced with ActivityBadge — staleness tier from `lastViewed` + `numViews` |
| 2026-04-24 | Non-admin users locked out of Review stage | "Done reviewing" footer for non-admins; "Notify owners" stays admin-only |
| 2026-04-24 | Dep chips confusing — no deletion risk signal | Downstream reframed as "X items rely on this" |
| 2026-04-24 | Credits/mo treemap only shows Feature Services | Expected; contextual note added directing users to Storage mode |
| 2026-04-24 | Treemap item cap too low | Divisor 10,000→7,000; own cap raised to 500 |
| 2026-04-24 | Treemap white gap on right side (Chrome/Edge) | Explicit `{ width, height }` from `getBoundingClientRect()` to `resize()` |
| 2026-04-24 | Dep chip counts showing 0 for all items | Coverage extended: `MobileMap2Service`, `WMASetting2Code`, `Map2FeatureCollection` |
| 2026-04-24 | Treemap tile labels showed item title | ECharts label formatter: cr/mo or filesize on leaf tiles |
| 2026-04-24 | "Click type groups to drill in" hint confusing | Removed from tooltip footer |
| 2026-04-24 | Dynamic treemap cap based on screenspace | `treemapCap()` using viewport area, clamped 75–500 own / 75–200 org |
| 2026-04-24 | Basket items not visible in treemap | Teal border on selected tiles |
| 2026-04-24 | Treemap tooltip flashed on fast mouse movement | 250ms open delay |
| 2026-04-24 | Treemap white gap on initial load (Edge/Chrome) | Cascading resize at 100/400/800/1500ms in `onChartReady` |
| 2026-04-21 | Sparklines all identical | Admin callers get org-wide data; "No activity" shown correctly |
| 2026-04-21 | Review page thumbnail 404s | Removed `?token=`; type-icon fallback |
| 2026-04-21 | Dep chips — click to see related items | Custom overlay with item links |
| 2026-04-21 | Type icon missing on review stage type chip | `iconFor()` extracted to `src/utils/itemIcons.ts` |
| 2026-04-21 | Sharing chip icons didn't match AGOL | globe/organization/lock |
| 2026-04-21 | Email buttons not launching mail client | Hidden anchor click; `@` no longer encoded as `%40` |
| 2026-04-21 | Credits filter hidden in storage view | Shows regardless of active metric |
| 2026-04-21 | Zero-credit items (Web Maps etc.) missing from treemap | MIN_VALUE 0.01 floor |
| 2026-04-21 | Modified date missing from treemap tooltip | `formatStaleness()` added |
| 2026-04-21 | Role detection Zustand race condition | `isAdmin` computed in AppShell, passed as prop |
| 2026-04-21 | Emulation Mode context banner | `calcite-notice kind="warning"`, dismiss-per-route |
| 2026-04-21 | Notification email not grouping by owner | `buildBatchEmailBody` + `groupItemsByOwner` |
| 2026-04-21 | Treemap breadcrumb always visible | Hidden at root; shown after drill-in via `isDrilled` |
| 2026-04-21 | Credits/month slider had no effect | `activeMetric` added to `useEffect` deps |
| 2026-04-21 | Last Modified filter direction | Flipped to staleness — "Not modified in" |
| 2026-04-21 | Emulation Mode renamed from Ghost Mode | Renamed throughout |
| 2026-04-21 | Org treemap default metric was wrong | Changed to Credits/mo |
| 2026-04-21 | Emulated user profile photo with dashed border | Warning-colour dashed ring in sidebar card |
| 2026-04-21 | Nav avatar token fix | Private org thumbnails now load for admins |
| 2026-04-21 | Emulate user dropdown clipped by shell-panel | Portalled to `document.body` |
| 2026-04-21 | Segmented controls wrong state on init | `checked` props on each item |
| 2026-04-21 | Metric toggle visible in table view | Hidden when `activeView === 'table'` |
| 2026-04-21 | Nav subtitle "ArcGIS Online credit optimiser" | Removed |
| 2026-04-21 | Org mode treemap empty state | Fixed fetch + sort |
