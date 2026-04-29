export interface ArcGISItem {
  id: string
  title: string
  type: string        // "Feature Service", "Web Map", "Notebook", etc.
  size: number        // bytes (−1 means unknown for some item types)
  modified: number    // epoch ms
  thumbnail: string | null
  snippet: string
  url: string
  access: 'public' | 'org' | 'private'
  owner: string
  numViews: number
  lastViewed?: number  // epoch ms — absent for items never viewed
}

export interface UserInfo {
  username: string
  fullName: string
  thumbnail: string | null
  role: string           // 'org_admin' | 'org_publisher' | 'org_user' | etc.
  orgId: string
  privileges: string[]   // e.g. ['portal:admin:viewUsers', ...]
}

export interface OwnerInfo {
  email: string | null
  fullName: string
  disabled: boolean    // true if the account is deactivated in the org
}

export interface RelatedItemRef {
  id: string
  title: string
  type: string
}

export interface UsageWindows {
  views30d: number   // total views in last 30 days (extracted from 60D response)
  views60d: number   // total views in last 60 days
}

export interface ServiceInfo {
  name: string       // service name extracted from URL (e.g. "bushfire")
  stype: 'features' | 'maps' | 'image' | 'vector' | 'scene' | 'geometry' | 'gpserver'
}

export interface DependencyCounts {
  upstream: number          // items this item depends on (e.g. services a web map uses)
  downstream: number        // items that depend on this item (e.g. maps using this service)
  upstreamItems: RelatedItemRef[]
  downstreamItems: RelatedItemRef[]
}
