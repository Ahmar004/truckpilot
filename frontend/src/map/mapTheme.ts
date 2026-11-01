import { RISK_LEVEL, THEME } from '../lib/constants'
import type { RiskLevel, Theme } from '../lib/constants'

// MapLibre paint values cannot read CSS variables, so the map tokens of design 3.3 are mirrored
// here per theme. The hex values must match `src/styles/tokens.css`.
export interface MapPalette {
  routeSelected: string
  routeCasing: string
  routeAlt: string
  /** Heatmap fill colors, from the risk tokens (design 3.2). */
  risk: Record<RiskLevel, string>
  /** Checkpoint circle ring, readable on both base maps. */
  checkpointRing: string
  /** Checkpoint circle with no weather data (the --risk-none token). */
  noData: string
  /** Outer ring on the selected Checkpoint. */
  checkpointSelected: string
}

/** Heatmap fill opacity per level (design 3.3), the same in both themes. */
export const HEAT_OPACITY: Record<RiskLevel, number> = {
  [RISK_LEVEL.LOW]: 0.12,
  [RISK_LEVEL.MODERATE]: 0.3,
  [RISK_LEVEL.HIGH]: 0.38,
  [RISK_LEVEL.SEVERE]: 0.45,
  [RISK_LEVEL.NO_TRAVEL]: 0.5,
}

export const MAP_PALETTE: Record<Theme, MapPalette> = {
  [THEME.LIGHT]: {
    routeSelected: '#1a5fd0',
    routeCasing: '#0e3a85',
    routeAlt: '#7187a6',
    risk: {
      [RISK_LEVEL.LOW]: '#196b30',
      [RISK_LEVEL.MODERATE]: '#8a5a00',
      [RISK_LEVEL.HIGH]: '#a63f06',
      [RISK_LEVEL.SEVERE]: '#b42318',
      [RISK_LEVEL.NO_TRAVEL]: '#6b2e9e',
    },
    checkpointRing: '#fffbf3',
    noData: '#56503f',
    checkpointSelected: '#1f2328',
  },
  [THEME.DARK]: {
    routeSelected: '#4c8df6',
    routeCasing: '#0b1f44',
    routeAlt: '#5d6e87',
    risk: {
      [RISK_LEVEL.LOW]: '#5bbf7a',
      [RISK_LEVEL.MODERATE]: '#d9a84a',
      [RISK_LEVEL.HIGH]: '#f59a5b',
      [RISK_LEVEL.SEVERE]: '#f78a82',
      [RISK_LEVEL.NO_TRAVEL]: '#b99bf2',
    },
    checkpointRing: '#181c22',
    noData: '#a5b1bd',
    checkpointSelected: '#e1e8ef',
  },
}

/** OpenFreeMap styles (design 3.5): Positron in light, Dark in dark. */
export const MAP_STYLE_URL: Record<Theme, string> = {
  [THEME.LIGHT]: 'https://tiles.openfreemap.org/styles/positron',
  [THEME.DARK]: 'https://tiles.openfreemap.org/styles/dark',
}

/** Start view: the continental US and southern Canada. [west, south, east, north] */
export const OVERVIEW_BOUNDS: [number, number, number, number] = [-128, 24, -64, 54]

/** Attribution text (design 8.5), each credit linked to its provider. */
export const MAP_ATTRIBUTION: string[] = [
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap contributors</a>',
  '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>',
  '<a href="https://openmaptiles.org" target="_blank" rel="noopener noreferrer">&copy; OpenMapTiles</a>',
  '<a href="https://www.tomtom.com" target="_blank" rel="noopener noreferrer">routes &copy; TomTom</a>',
  '<a href="https://www.geoapify.com" target="_blank" rel="noopener noreferrer">places &copy; Geoapify</a>',
  '<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">weather Open-Meteo</a>',
]
