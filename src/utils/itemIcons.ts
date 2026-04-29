// Map ArcGIS item type names to Calcite icon names
export const TYPE_ICONS: Record<string, string> = {
  'Feature Service': 'feature-layer',
  'Feature Layer': 'feature-layer',
  'Map Service': 'map',
  'Web Map': 'map',
  'Image Service': 'image-layer',
  'Service Definition': 'services',
  'Scene Service': 'layer-3d',
  'Web Scene': 'layer-3d',
  'Dashboard': 'dashboard',
  'Notebook': 'code',
  'Survey123 Form': 'survey',
  'StoryMaps': 'article',
  'Table': 'table',
  'CSV': 'table',
  'GeoJSON': 'polygon',
  'KML': 'globe',
  'Vector Tile Service': 'layer-vector-tile',
  'Other': 'apps',
}

export function iconFor(typeName: string): string {
  return TYPE_ICONS[typeName] ?? 'apps'
}
