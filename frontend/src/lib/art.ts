import type { ArtRef } from '../components/ui/SpriteArt'

// Sprite files live in public/sprites (UIi 7). Each picture is one <symbol> inside its file.
const SPRITE = {
  HERO: '/sprites/hero.svg',
  FACTORS: '/sprites/factors.svg',
  STOPS: '/sprites/stops.svg',
  POSTERS: '/sprites/posters.svg',
  FAQ: '/sprites/faq.svg',
  STATES: '/sprites/states.svg',
} as const

const BOARD = { width: 560, height: 400 } as const
const CARD = { width: 480, height: 360 } as const
const STOP = { width: 480, height: 320 } as const
const POSTER = { width: 640, height: 360 } as const

function art(sprite: string, id: string, size: { width: number; height: number }): ArtRef {
  return { sprite, id, ...size }
}

/** Every picture the app draws, by name. Sizes match each symbol's viewBox. */
export const ART = {
  HERO: art(SPRITE.HERO, 'hero-truck-road', BOARD),
  FACTOR_WEATHER: art(SPRITE.FACTORS, 'factor-weather', CARD),
  FACTOR_LOAD: art(SPRITE.FACTORS, 'factor-load', CARD),
  FACTOR_TIME: art(SPRITE.FACTORS, 'factor-time', CARD),
  STOP_1: art(SPRITE.STOPS, 'stop-1', STOP),
  STOP_2: art(SPRITE.STOPS, 'stop-2', STOP),
  STOP_3: art(SPRITE.STOPS, 'stop-3', STOP),
  STOP_4: art(SPRITE.STOPS, 'stop-4', STOP),
  STOP_5: art(SPRITE.STOPS, 'stop-5', STOP),
  POSTER_1: art(SPRITE.POSTERS, 'poster-1', POSTER),
  POSTER_2: art(SPRITE.POSTERS, 'poster-2', POSTER),
  POSTER_3: art(SPRITE.POSTERS, 'poster-3', POSTER),
  POSTER_4: art(SPRITE.POSTERS, 'poster-4', POSTER),
  POSTER_5: art(SPRITE.POSTERS, 'poster-5', POSTER),
  FAQ_RIM: art(SPRITE.FAQ, 'faq-rim', { width: 400, height: 400 }),
  FAQ_STAND: art(SPRITE.FAQ, 'faq-stand', { width: 240, height: 320 }),
  EMPTY: art(SPRITE.STATES, 'state-empty', BOARD),
  NOT_FOUND: art(SPRITE.STATES, 'state-not-found', BOARD),
  ERROR: art(SPRITE.STATES, 'state-error', BOARD),
} as const
