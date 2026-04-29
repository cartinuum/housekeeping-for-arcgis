/**
 * Estimates ArcGIS Online storage credits per month for an item.
 * Rates sourced from: https://doc.arcgis.com/en/arcgis-online/administer/credits.htm
 *
 * Feature Service  2.4 cr / 10 MB / mo  (240 cr/GB — hosted feature layers only;
 *                                         feature layer views share parent storage, not double-counted)
 * Notebook         12 cr / GB / mo       (ArcGIS Notebook workspace scratch storage;
 *                                         individual .ipynb files may be standard rate —
 *                                         treating as 12 cr/GB is a conservative over-estimate)
 * Image Service    1.2 cr / GB / mo      (tiled imagery; dynamic imagery also has per-image fees)
 * Everything else  1.2 cr / GB / mo      (standard file storage — Vector Tile Service, Scene Service,
 *                                         tile packages, web maps, CSVs, PDFs, etc.)
 *
 * Items with size <= 0 (e.g. Web Map, Dashboard — size = -1 in the API) return 0 credits.
 */
export function calcCreditsPerMonth(type: string, sizeBytes: number): number {
  const effectiveBytes = Math.max(0, sizeBytes)
  const mb = effectiveBytes / 1_048_576
  const gb = effectiveBytes / 1_073_741_824

  switch (type) {
    case 'Feature Service':
      return (mb / 10) * 2.4        // 240 cr/GB/mo

    case 'Notebook':
      return gb * 12                 // 12 cr/GB/mo

    case 'Image Service':
    case 'Vector Tile Service':
    case 'Scene Service':
    case 'Scene Layer':
    default:
      return gb * 1.2               // 1.2 cr/GB/mo
  }
}
