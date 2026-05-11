# Dependency Licences

Generated via `npx license-checker --summary --excludePrivatePackages` on 2026-05-06. Regenerate when dependencies change materially.

## Summary

| Licence | Count | Notes |
|---------|-------|-------|
| MIT | 233 | Permissive |
| Apache-2.0 | 23 | Permissive. |
| ISC | 13 | Permissive |
| BSD-3-Clause | 12 | Permissive |
| BSD-2-Clause | 8 | Permissive |
| Custom | 4 | Identified below as Esri / stray vendor strings packaged with upstream metadata. |
| MIT-0 | 2 | Permissive (no attribution required) |
| MPL-2.0 | 2 | `lightningcss` — Vite’s CSS processor. Build tool, not bundled into app output. MPL-2.0 requires source availability of changes to MPL-covered files only. |
| BlueOak-1.0.0 | 2 | Permissive |
| 0BSD | 2 | Permissive |
| CC-BY-4.0 | 1 | `caniuse-lite` — browserslist data. Dev dependency. |
| CC0-1.0 | 1 | Public domain |
| (MIT OR CC0-1.0) | 1 | Permissive |

### Custom licences (four rows from `license-checker`)

Two packages declare `Custom: https://developers.arcgis.com/javascript` (Esri ecosystem). One declares `Custom: https://developers.arcgis.com/calcite-design-system/icons/` (Esri Calcite icons). One declares `Custom: https://img.shields.io/badge/Built:` from a shields.io badge embedded in upstream metadata — treat as build-time metadata noise, not an application licence term.

Treat the Esri items as governed by Esri terms for ArcGIS/JavaScript APIs and Calcite as for your `@esri/*` npm packages (Esri Master License Agreement or equivalent for your deployment).

## Runtime scripts (not in npm tree)

Hosted builds may load **Cloudflare Web Analytics** from `static.cloudflareinsights.com` (`beacon.min.js`). That script is governed by [Cloudflare’s terms](https://www.cloudflare.com/privacypolicy/) / product documentation for Web Analytics — it is **not** listed by `license-checker` because it is not an npm dependency.

## Assessment

No licence conflicts among npm dependencies surfaced by this audit. Dependencies are permissive or limited to build tooling. No GPL or AGPL dependencies in the checker output.

The prior `Python-2.0` transitive entry (historically `argparse` via ESLint) no longer appears in this dependency tree revision.
