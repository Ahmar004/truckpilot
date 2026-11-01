import { RISK_LEVEL } from '../../lib/constants'

// The risk bands and load rules shown on the landing page (spec 8.2, 8.3), in imperial values.
// Mirrors backend core/constants.py. The risk engine itself runs only on the server.

export const RISK_TABLE_COLUMNS = [
  RISK_LEVEL.LOW,
  RISK_LEVEL.MODERATE,
  RISK_LEVEL.HIGH,
  RISK_LEVEL.SEVERE,
  RISK_LEVEL.NO_TRAVEL,
] as const

export const RISK_TABLE_ROWS = [
  {
    condition: 'Wind (mph)',
    bands: ['under 25', '25 to under 35', '35 to under 45', '45 to under 55', '55 or more'],
  },
  {
    condition: 'Rain (in/hr)',
    bands: ['under 0.10', '0.10 to under 0.25', '0.25 to under 0.50', '0.50 to 1.00', 'over 1.00'],
  },
  {
    condition: 'Snow (in/hr)',
    bands: ['under 0.5', '0.5 to under 1.0', '1.0 to under 2.0', '2.0 to 3.0', 'over 3.0'],
  },
] as const

export const LOAD_RULES = [
  'Wind of 55 mph or more is No Travel for any load.',
  'Wind from 45 to under 55 mph with a load over 30,000 lb is No Travel.',
  'Wind from 35 to under 45 mph with a load over 40,000 lb is Severe.',
] as const
