import { ART } from '../../lib/art'

// Final copy for landing sections 3, 4, 5 and 8 (design 6).

export const FACTORS = [
  {
    word: 'WEATHER',
    tone: 'text-weather-display',
    art: ART.FACTOR_WEATHER,
    text: 'Sustained wind, rain and snow from the hourly forecast at each checkpoint, at the hour you get there.',
  },
  {
    word: 'LOAD',
    tone: 'text-load-display',
    art: ART.FACTOR_LOAD,
    text: 'Heavy loads raise wind risk. Over 30,000 lb in 45 mph wind is No Travel.',
  },
  {
    word: 'TIME',
    tone: 'text-time-display',
    art: ART.FACTOR_TIME,
    text: 'Arrival times include HOS breaks: 30 min after 8 h of driving, a 10 h rest after 11 h.',
  },
] as const

export const STOPS = [
  {
    title: 'Enter your trip',
    line: 'Origin, destination, departure time and load.',
    art: ART.STOP_1,
  },
  {
    title: 'Get up to 3 real truck routes',
    line: 'From a truck routing service.',
    art: ART.STOP_2,
  },
  {
    title: 'Checkpoints with arrival times',
    line: 'Every 10, 25 or 50 miles, HOS breaks included.',
    art: ART.STOP_3,
  },
  { title: 'Forecast at each arrival hour', line: 'Rated Low to No Travel.', art: ART.STOP_4 },
  { title: 'One recommended route', line: 'Plus a 48-hour risk heatmap.', art: ART.STOP_5 },
] as const

export const POSTERS = [
  { title: 'Route cards', line: 'Ranked 1st to 3rd, with the recommendation.', art: ART.POSTER_1 },
  {
    title: 'Checkpoint detail',
    line: 'Arrival time, wind, rain, snow and what set the risk.',
    art: ART.POSTER_2,
  },
  { title: 'Risk heatmap', line: 'With the 0-48 hour slider.', art: ART.POSTER_3 },
  { title: 'HOS breaks', line: 'Built into every arrival time.', art: ART.POSTER_4 },
  { title: 'Your settings', line: 'Units, interval and HOS.', art: ART.POSTER_5 },
] as const

/** `privacy: true` adds the link to the Privacy page after the answer. */
export const FAQ_ITEMS: readonly { q: string; a: string; privacy?: boolean }[] = [
  {
    q: 'Where do the routes come from?',
    a: 'From TomTom truck routing. Routes are never made up.',
  },
  {
    q: 'Where does the weather come from?',
    a: "From Open-Meteo hourly forecasts, checked at each Checkpoint's arrival hour.",
  },
  {
    q: 'Why only 10 days of weather?',
    a: 'Forecasts run 10 days from now. Later Checkpoints show No weather data, and the trip is still planned.',
  },
  {
    q: 'What are HOS breaks?',
    a: 'Hours of Service breaks: 30 min after 8 h of driving, and a 10 h rest after 11 h. US rules apply on every road, Canada included.',
  },
  {
    q: 'Why is a route Not recommended?',
    a: 'It has No Travel miles. It is still shown and ranked.',
  },
  { q: 'Does it work in Canada?', a: 'Yes. Truck Pilot covers the US and Canada only.' },
  { q: 'How many trips can I plan?', a: '30 an hour and 100 a day.' },
  {
    q: 'What do you store?',
    a: 'Your Google ID, name and email, and the times of your plans, searches and updates for 24 h. We keep no trips.',
    privacy: true,
  },
]
