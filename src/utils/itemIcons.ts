// Map ArcGIS item type names (including resolved display types) to Calcite icon names.
// Raw API type → icon is used for treemap group tiles and chip legend.
// Resolved display type → icon is used in table pills and treemap hover tooltips.
export const TYPE_ICONS: Record<string, string> = {
  // --- Feature Services ---
  'Feature Service':      'feature-layer',
  'Feature Layer':        'feature-layer',
  'Feature Table':        'table',         // Feature Service + "Table" typeKeyword
  'Route Layer':          'route-layer',
  'Utility Network':      'network-diagram',

  // --- Map Services ---
  'Map Service':          'map-service',   // generic fallback (dynamic map image layer)
  'Map Image Layer':      'map-service',   // resolved: Map Service without Tiled keyword
  'Tile Layer':           'layer-basemap', // resolved: Map Service + "Tiled" typeKeyword
  'WMS':                  'map',
  'WFS':                  'map',
  'WMTS':                 'map',

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
  'Form':                 'form',

  // --- Data / Documents ---
  'Notebook':             'code',
  'Survey123 Form':       'survey',
  'Table':                'table',
  'CSV':                  'table',
  'Microsoft Excel':      'table',
  'GeoJSON':              'polygon',
  'KML':                  'globe',
  'Shapefile':            'data-file',
  'File Geodatabase':     'data-file',
  'Service Definition':   'services',
  'Code Attachment':      'code',

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
    if (typeKeywords.includes('Tiled')) return 'Tile Layer'
    return 'Map Image Layer'
  }
  if (type === 'Feature Service') {
    if (typeKeywords.includes('Table')) return 'Feature Table'
    if (typeKeywords.includes('Route Layer')) return 'Route Layer'
    if (typeKeywords.includes('Utility Network')) return 'Utility Network'
  }
  if (type === 'Web Mapping Application') return 'Web App'
  if (type === 'Web Experience') return 'Web Experience'
  return type
}

export function iconFor(typeName: string): string {
  return TYPE_ICONS[typeName] ?? 'apps'
}
