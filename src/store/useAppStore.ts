import { create } from 'zustand'

export type ActiveView = 'treemap' | 'table'
export type ActiveMetric = 'credits' | 'views' | 'size'
export type ViewScope = 'own' | 'org'

export interface Filters {
  types: string[]
  minSizeBytes: number | null
  maxSizeBytes: number | null   // null = no upper bound
  modifiedDaysAgo: number | null
  minCredits: number | null
  maxCredits: number | null     // null = no upper bound
}

interface AppStore {
  viewingUser: string | null
  setViewingUser: (username: string | null) => void

  viewScope: ViewScope
  setViewScope: (scope: ViewScope) => void

  activeView: ActiveView
  setActiveView: (view: ActiveView) => void

  activeMetric: ActiveMetric
  setActiveMetric: (metric: ActiveMetric) => void

  filters: Filters
  setFilters: (filters: Partial<Filters>) => void
  resetFilters: () => void

  // Role — set once after sign-in from signedInUserInfo.role === 'org_admin'.
  // Default false until fetched. Stored here so route components don't need props.
  isAdmin: boolean
  setIsAdmin: (isAdmin: boolean) => void

  // Set once after sign-in from signedInUserInfo.orgId.
  orgId: string | null
  setOrgId: (orgId: string) => void

  // Portal hostname for the signed-in user's org (e.g. bgt-pj.maps.arcgis.com).
  // Used to build item URLs in the user's authenticated portal context.
  // Fetched from /portals/self on sign-in; null until resolved.
  portalHostname: string | null
  setPortalHostname: (hostname: string) => void

  // adminFullName — set once after sign-in from signedInUserInfo.fullName.
  // Needed for email sign-off in batch notification workflow.
  adminFullName: string | null
  setAdminFullName: (name: string) => void

  // viewingUserFullName — display name of the emulated user, set when viewingUser is non-null.
  // Used by EmulationBanner to name the emulated user in the warning notice.
  viewingUserFullName: string | null
  setViewingUserFullName: (name: string | null) => void

  // Sidebar open/collapsed state — persists across treemap/table toggle.
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Review basket — IDs of items selected for triage.
  // Persists across / ↔ /review navigation. Synced to URL on /review.
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  toggleSelectedId: (id: string) => void

  // Reason tags set per item on the /review page, carried forward to /action email body.
  reasonMap: Record<string, string>
  setReasonMap: (map: Record<string, string>) => void
}

const DEFAULT_FILTERS: Filters = {
  types: [],
  minSizeBytes: 10_485_760,  // 10 MB — hides small/zero-size items on load
  maxSizeBytes: null,        // no upper bound by default
  modifiedDaysAgo: null,
  minCredits: null,          // no credit filter by default — size filter handles zero-value items
  maxCredits: null,          // no upper bound by default
}

export const useAppStore = create<AppStore>((set) => ({
  viewingUser: null,
  // Emulation mode resets scope to 'own' — you're viewing a specific user, not the whole org
  // Switching emulation context (start or stop) clears the basket — items from a
  // previous user's content have no meaning in the new context.
  setViewingUser: (username) => set({ viewingUser: username, viewScope: 'own', filters: DEFAULT_FILTERS, selectedIds: [] }),

  viewScope: 'own',
  // Switching to org scope auto-selects Views — numViews is always accurate from the
  // /search API, whereas size=-1 for hosted services makes storage/credits unreliable.
  setViewScope: (scope) => set({ viewScope: scope }),

  activeView: 'treemap',
  setActiveView: (view) => set({ activeView: view }),

  activeMetric: 'credits',
  setActiveMetric: (metric) => set((state) => ({
    activeMetric: metric,
    // Clear credits filter when leaving credits mode — it has no meaning in other modes
    filters: metric !== 'credits'
      ? { ...state.filters, minCredits: null }
      : state.filters,
  })),

  filters: DEFAULT_FILTERS,
  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  isAdmin: false,
  setIsAdmin: (isAdmin) => set({ isAdmin }),

  orgId: null,
  setOrgId: (orgId) => set({ orgId }),

  portalHostname: null,
  setPortalHostname: (portalHostname) => set({ portalHostname }),

  adminFullName: null,
  setAdminFullName: (adminFullName) => set({ adminFullName }),

  viewingUserFullName: null,
  setViewingUserFullName: (viewingUserFullName) => set({ viewingUserFullName }),

  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  selectedIds: [],
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  toggleSelectedId: (id) => set((state) => ({
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter(x => x !== id)
      : [...state.selectedIds, id],
  })),

  reasonMap: {},
  setReasonMap: (map) => set({ reasonMap: map }),
}))
