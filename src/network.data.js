// Sample network-device inventory — illustrative, not a real asset register.
// Same right-sizing/TCO logic as the GPU modules, applied to switches/routers.

export const REFERENCE_YEAR = 2026 // fixed "as of" year, not Date.now(), so age math doesn't silently drift

export const NET_DEVICES = [
  { id: 'd1', name: 'core-sw-01', type: 'switch', site: 'DC-East', purchaseYear: 2020, capex: 180000, refreshCycleYears: 6, opexYr: 12000, capacityGbps: 800, avgUtilPct: 71, peakUtilPct: 88 },
  { id: 'd2', name: 'core-sw-02', type: 'switch', site: 'DC-East', purchaseYear: 2019, capex: 165000, refreshCycleYears: 6, opexYr: 11500, capacityGbps: 800, avgUtilPct: 26, peakUtilPct: 41 },
  { id: 'd3', name: 'edge-sw-01', type: 'switch', site: 'DC-East', purchaseYear: 2022, capex: 38000, refreshCycleYears: 5, opexYr: 4200, capacityGbps: 100, avgUtilPct: 54, peakUtilPct: 70 },
  { id: 'd4', name: 'edge-sw-02', type: 'switch', site: 'DC-West', purchaseYear: 2018, capex: 32000, refreshCycleYears: 5, opexYr: 4000, capacityGbps: 100, avgUtilPct: 19, peakUtilPct: 33 },
  { id: 'd5', name: 'edge-rtr-01', type: 'router', site: 'DC-West', purchaseYear: 2021, capex: 95000, refreshCycleYears: 7, opexYr: 8500, capacityGbps: 400, avgUtilPct: 63, peakUtilPct: 79 },
  { id: 'd6', name: 'edge-rtr-02', type: 'router', site: 'DC-West', purchaseYear: 2017, capex: 88000, refreshCycleYears: 7, opexYr: 9200, capacityGbps: 400, avgUtilPct: 22, peakUtilPct: 35 },
  { id: 'd7', name: 'wan-rtr-01', type: 'router', site: 'HQ', purchaseYear: 2023, capex: 145000, refreshCycleYears: 7, opexYr: 13000, capacityGbps: 400, avgUtilPct: 58, peakUtilPct: 82 },
  { id: 'd8', name: 'access-sw-01', type: 'switch', site: 'HQ', purchaseYear: 2022, capex: 18000, refreshCycleYears: 4, opexYr: 2200, capacityGbps: 40, avgUtilPct: 47, peakUtilPct: 66 },
  { id: 'd9', name: 'access-sw-02', type: 'switch', site: 'HQ', purchaseYear: 2019, capex: 16000, refreshCycleYears: 4, opexYr: 2000, capacityGbps: 40, avgUtilPct: 15, peakUtilPct: 28 },
  { id: 'd10', name: 'dc-rtr-01', type: 'router', site: 'DC-East', purchaseYear: 2024, capex: 172000, refreshCycleYears: 7, opexYr: 14500, capacityGbps: 800, avgUtilPct: 69, peakUtilPct: 85 },
]

export const SITES = ['All', 'DC-East', 'DC-West', 'HQ']
export const CONSOLIDATION_UTIL_THRESHOLD_DEFAULT = 30
