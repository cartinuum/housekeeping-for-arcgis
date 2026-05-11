// Map ArcGIS item type names (including resolved display types) to Calcite icon names.
// All icon names have been validated against @esri/calcite-ui-icons icon registry.
// Raw API type → icon is used for treemap group tiles and chip legend.
// Resolved display type → icon is used in table pills and treemap hover tooltips.
export const TYPE_ICONS: Record<string, string> = {
  // --- Feature Services ---
  'Feature Service':      'feature-layer',
  'Feature Layer':        'feature-layer',
  'Feature Table':        'table',            // Feature Service + "Table" typeKeyword
  'Route Layer':          'layer-route',
  'Utility Network':      'layers',

  // --- Map Services ---
  'Map Service':          'layer-map-service', // generic (group tiles in treemap)
  'Map Image Layer':      'layer-map-service', // resolved: Map Service without Tiled keyword
  'Tile Layer':           'layer-basemap',     // resolved: Map Service + "Tiled" typeKeyword
  'WMS':                  'layer-wms',
  'WFS':                  'layer-wfs',
  'WMTS':                 'layer-wms',         // closest available

  // --- Image / Raster ---
  'Image Service':        'image-layer',
  'Raster Layer':         'image-layer',
  'Oriented Imagery':     'image-layer',

  // --- Vector Tiles ---
  'Vector Tile Service':  'layer-vector-tile',

  // --- Scene / 3D ---
  'Scene Service':        'layer-3d',
  'Web Scene':            'layer-3d',
  'Point Cloud Layer':    'layer-3d',

  // --- Maps & Apps ---
  'Web Map':              'map',
  'Dashboard':            'dashboard',
  'StoryMaps':            'article',
  'Web Experience':       'apps',
  'Web AppBuilder':       'apps',
  'Instant App':          'apps',
  'Web Mapping Application': 'apps',

  // --- Data / Documents ---
  'Notebook':             'code',
  'Survey123 Form':       'survey',
  'Table':                'table',
  'CSV':                  'file-csv',
  'Microsoft Excel':      'file-excel',
  'GeoJSON':              'layer-geojson',
  'KML':                  'layer-kml',
  'Shapefile':            'file-shape',
  'File Geodatabase':     'file-data',
  'SQLite Geodatabase':   'file-sqlite',
  'Service Definition':   'file-archive',
  'Code Attachment':      'file-code',

  // --- Fallback ---
  'Other':                'apps',
}

/**
 * Derive a human-readable display type from the raw API `type` + `typeKeywords`.
 * The returned string is used in the table pill and treemap hover tooltip.
 * Treemap grouping always uses the raw `type` — this does not change group membership.
 */
export function resolveDisplayType(type: string, typeKeywords: string[]): string {
  if (type === 'Map Service') {
    // Hosted tile layers use 'WMTS' keyword; on-prem cached services use 'Tiled'
    if (typeKeywords.includes('Tiled') || typeKeywords.includes('WMTS')) return 'Tile Layer'
    return 'Map Image Layer'
  }
  if (type === 'Feature Service') {
    if (typeKeywords.includes('Table')) return 'Feature Table'
    if (typeKeywords.includes('Route Layer')) return 'Route Layer'
    if (typeKeywords.includes('Utility Network')) return 'Utility Network'
  }
  if (type === 'Web Mapping Application') return 'Web App'
  return type
}

export function iconFor(typeName: string): string {
  return TYPE_ICONS[typeName] ?? 'apps'
}
