/**
 * Build an ArcGIS Online item URL using the org's portal hostname.
 * Falls back to www.arcgis.com for orgs without a custom domain.
 *
 * Using the org hostname (e.g. bgt-pj.maps.arcgis.com) ensures items open in
 * the user's authenticated portal context rather than the generic AGOL domain.
 */
export function buildItemUrl(portalHostname: string | null | undefined, itemId: string): string {
  const host = portalHostname ?? 'www.arcgis.com'
  return `https://${host}/home/item.html?id=${encodeURIComponent(itemId)}`
}
