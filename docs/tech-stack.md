# Truck Pilot - Tech stack

Step-5 output. It says **what we build Truck Pilot with**. What the app does is in `docs/spec.md`; how each feature is built goes in `docs/architecture.md` (Step-8). Every pick below was made with the user on 2026-11-01, except the lines marked "my call", which are open for review.

## Summary

- **Frontend:** React + TypeScript built with Vite. Tailwind v4, Radix, cva and Phosphor icons (the `docs/UIinspiration.md` set). TanStack Query for server data. MapLibre GL JS with free OpenFreeMap tiles for the map and heatmap.
- **Backend:** Django 5.2 LTS + Django Ninja (Pydantic) on Python 3.12, calling providers with httpx.
- **Hosting and data:** one Vercel project (Vercel Services): React files from the CDN, Django as one Vercel Function under `/api`, on one address `mytruckpilot.vercel.app`. Neon Postgres for users, sessions, usage counts (rate limits and provider daily budgets) and the shared forecast cache. No trip data is stored; routes travel as a signed bundle.
- **Providers:** TomTom (truck routing), Geoapify (place search), Open-Meteo (hourly forecasts), Google Identity Services (sign-in), Sentry (errors), PostHog (analytics).
- **Rendering:** SSG for the public landing page, CSR for the signed-in planner, JSON from Django.

**Cost: $0 per month.** Every service runs on its free tier. This is allowed because Truck Pilot v1 is **non-commercial**: no ads, subscriptions or paid features (user decision). Vercel Hobby and the free Open-Meteo API both require that.

---

## Rendering strategy

| Page | Strategy | Why |
|---|---|---|
| Landing (`/`) | **SSG**: built once into plain HTML at build time, served from Vercel's CDN | Public and must load instantly and be findable on Google. Its content is the same for everyone, so there is nothing to compute per request. |
| Sign-in | SSG shell; the Google button loads in the browser | Same as above. The Google button is a browser script by design. |
| Planner (`/plan`) | **CSR**: React runs in the browser and fetches JSON from `/api` | Behind sign-in, so search ranking doesn't matter. It is a live WebGL map, which only runs in a browser. Every result is per user and per moment. |
| API (`/api/...`) | Django JSON, never cached by the CDN | Results depend on the user, the time and live forecasts. |

**How the landing page is pre-built (my call):** Vite has no built-in SSG, so a small build step renders the landing and sign-in pages with React's own `react-dom/server` pre-render into static HTML after `vite build`. No plugin is needed.

**Why not SSR or ISR:** SSR needs a Node server next to Django, so there would be two backends to secure, deploy and keep fast. It would also render nothing useful for the planner, because the map can't render on a server. ISR is for public pages that change now and then; we have none.

Example: a driver opens `mytruckpilot.vercel.app`. The landing HTML comes straight from the CDN with no server work. After sign-in, `/plan` loads the JavaScript once, then each "Plan trip" is one call to `/api/plans`.

---

## Choices, with the 3 best options each

Each table shows the pick first.

### 1. Hosting: how React and Django share Vercel
| Option | Verdict |
|---|---|
| **One project with Vercel Services** | **Picked.** Vercel's documented setup for "a Django backend and a frontend in one project". `/api/*` goes to Django and everything else to the React files. With one address, the HttpOnly session cookie needs no cross-site setup or CORS. Note: Services is marked **Beta**. Step-10 proves it locally and with a preview deploy before any slice is built. |
| Two Vercel projects + rewrite | **Fallback** if Services fails. The frontend project forwards `/api/*` to a separate Django project, so the browser still sees one address. Stable, but two projects to deploy. |
| Django on Render or Railway | Rejected. Free tiers sleep when idle (Render takes about 50 s to wake), which breaks the 10-second target (spec 12). |

Django on Vercel facts (Vercel docs, 2026): Django runs as **one Vercel Function** on Fluid compute. Vercel finds it through `manage.py`. The bundle limit is 500 MB. The Python runtime is **3.12**, so local work uses 3.12 too (this PC has 3.13; Step-10 installs 3.12 through uv).

### 2. Frontend framework
| Option | Verdict |
|---|---|
| **React + TypeScript + Vite** | **Picked.** React is required (R-1). Vite builds fast and outputs static files for the CDN. TypeScript catches shape errors between the API and the UI. |
| Next.js | Rejected. Adds a Node server next to Django (see Rendering). |
| React Router v7 framework mode | Rejected. Can pre-render too, but brings server conventions we don't need. |

Client-side page routing: **React Router** in its plain library mode (my call). We have 3 pages: landing, sign-in, planner.

### 3. UI toolkit
| Option | Verdict |
|---|---|
| **The `UIinspiration.md` set:** Tailwind v4, Radix primitives, class-variance-authority (cva) with clsx + tailwind-merge, Phosphor icons, fonts self-hosted through Fontsource | **Picked.** Matches the inspiration almost one to one. Radix gives accessible dialogs, menus, switches and the slider (WCAG 2.1 AA). Fontsource replaces `next/font` (fonts ship with the app; no request to Google at runtime). Motion is added only if a data-driven animation needs it, and the user is asked first. `next-themes` and `canvas-confetti` are not used. |
| shadcn/ui | Rejected. Faster start, but a generic look we would restyle anyway. |
| MUI | Rejected. Heavy, and its Material look fights the inspiration. |

Dates: the departure picker is the browser's native `datetime-local` input, and display uses the built-in `Intl.DateTimeFormat` with the zone name the server sends (my call; no date library).

### 4. Server data in the frontend
| Option | Verdict |
|---|---|
| **TanStack Query** | **Picked (my call).** Gives the loading, error and Retry states that spec 11 needs. It caches place suggestions and lives in hooks, so components stay pure (CLAUDE.md). |
| SWR | Rejected. Similar, but weaker for mutations like "Plan trip". |
| Hand-written fetch hooks | Rejected. We would rewrite retries, cancellation and caching. |

### 5. Map
| Option | Verdict |
|---|---|
| **MapLibre GL JS + OpenFreeMap tiles** | **Picked.** Free and open source, with unlimited map loads and **no key**, so nothing secret reaches the browser (Rule-12). A light, clean style tuned toward Google Maps (Rule-15). Downside: OpenFreeMap is a community service with no uptime promise; the tile URL sits in one config value, so a switch is one line. |
| Google Maps JavaScript API | Rejected. Real Google look, but needs a card and about 10,000 free loads a month, and its key must sit in the browser. |
| MapLibre + MapTiler | Rejected. Polished tiles, but a key in the browser and a non-commercial free plan. |

### 6. Heatmap drawing
| Option | Verdict |
|---|---|
| **MapLibre's built-in layers** | **Picked.** The plan response carries all 49 hours of grid cells once. Moving the slider only changes which hour's value the layer colors by, so there is no new data and no extra library. This meets the 100 ms target (spec 12). |
| deck.gl | Rejected. About 400 KB more JavaScript for what MapLibre already does. |
| Custom canvas overlay | Rejected. We would hand-write pan, zoom and redraw. |

### 7. Backend and API layer
| Option | Verdict |
|---|---|
| **Django 5.2 LTS + Django Ninja** | **Picked.** Django is required (R-1); 5.2 is the long-term release, supported to April 2028 (my call on the version). Ninja uses Pydantic models, so one tool checks every driver input and validates every provider response (CLAUDE.md). It also generates API docs. |
| Django REST Framework | Rejected. Heavier, built around database models we mostly don't have (no trips stored), no Pydantic. |
| Plain Django views | Rejected. We would hand-write all checks. |

Backend libraries (my calls):
- **httpx:** calls providers with a timeout on every call, running the 4 detour calls and the weather batches in parallel. `requests` is rejected (no async, so slow fan-out); `aiohttp` is rejected (heavier, no sync mode for tests).
- **timezonefinder + Python's `zoneinfo`:** finds the time zone of any point offline, including checkpoints past the forecast window that get no weather call (spec 7.4, 7.6). Rejected: Open-Meteo's `timezone=auto` (only covers points we fetch weather for) and Google's Time Zone API (paid, needs a card).
- **No geometry library at first:** the corridor grid, "shared road" share and checkpoint placement are plain distance math in one module. Shapely is the fallback if Step-8 finds a real need.
- **Packaging: uv** with `pyproject.toml` and a lock file. It also installs Python 3.12. pip with `requirements.txt` and Poetry are rejected (slower, or more setup).

### 8. Database and shared state
| Option | Verdict |
|---|---|
| **Neon Postgres** | **Picked.** Free: 1 GB and 100 compute-hours (CU-hours) a month, which is about 400 hours awake at the smallest size (0.25 CU). It sleeps after 5 idle minutes and wakes in under a second, and connects through Vercel's Marketplace. It holds users, Django sessions, usage counts (section 12a) and the forecast cache. Django uses Neon's **pooled** connection string with no kept-open connections, which suits short-lived functions. |
| Supabase Postgres | Rejected. Free projects pause after 7 days without traffic, which takes the app down. |
| Upstash Redis | Rejected. Django's users and sessions still need SQL, so it would be a second store. |

**Known risk (Step-9, user: accept, document, watch):** the free hours last only while the database sleeps between visits, about 13 busy hours a day on average. If visits keep it awake all day (about 720 h a month), the hours run out and Neon suspends the database until next month, which takes the app down. Step-14 checks Neon's usage page; if real traffic grows, Neon's paid Launch plan is the upgrade (needs the user's approval). Example: 30 visits an hour from 7 AM to 8 PM, with quiet nights, uses about 13 h a day = about 400 h a month, right at the limit.

No Redis anywhere: the rate limit is a count of the user's plan times in the last hour, read from Postgres (CLAUDE.md: no state in one process's memory).

### 9. Sign-in
| Option | Verdict |
|---|---|
| **Google Identity Services button + Django session** | **Picked.** Google's official button returns a one-time ID token. Django checks it with Google's `google-auth` library (signature, audience, expiry), then sets its own **HttpOnly** session cookie. The Google client ID is public by design, so it is not a secret. |
| django-allauth | Rejected. Battle-tested, but much larger, with features we won't use. |
| Clerk or another hosted service | Rejected. Its tokens live in browser JavaScript, which breaks the HttpOnly-only rule. |

**CSRF (Step-6 decision):** Django's CSRF check stays on, with `CSRF_COOKIE_HTTPONLY = True`. The React app gets the token from `/api/csrf`, keeps it only in memory, and sends it as the `X-CSRFToken` header on every request that changes something. Example: a fake site posts to `/api/plans` while the driver is signed in; it has no token, so Django answers 403.

### 10. Truck routing
| Option | Verdict |
|---|---|
| **TomTom Routing API** | **Picked.** `travelMode=truck`, `vehicleWeight` in kg (the server converts the lb load), up to 5 alternative routes in one call, waypoints for detour routes, and travel time at points along the route for ETAs. **20,000 free calls a month, no card** (TomTom pricing page, per API). At 1-5 calls per plan (1 main call, plus 4 detour calls when fewer than 3 routes come back), that is about 4,000-20,000 plans a month. |
| HERE Routing v8 | Rejected. Strong truck routing, but 5,000 free truck calls a month and a card at sign-up. |
| openrouteservice (`driving-hgv`) | Rejected. Alternatives only for routes under about 100 km, so it can't meet the 3-route rule (spec 6.2). |

TomTom notes:
- **ETAs:** with `extendedRouteRepresentation=travelTime`, TomTom returns the travel time from the start at points along the route. A checkpoint's driving time is filled in by distance between the two nearest points (my call).
- **Weight:** spec 6.1 sends only the load weight. TomTom ignores weight limits when `vehicleWeight` is 0, so a 0 lb load needs no special case. Example: 30,000 lb is sent as 13,608 kg.
- **Step-10 results (2026-11-01, real calls):** alternatives and travel-time points work (a time point about every 100 route points), also with a Waypoint. TomTom's computing time grows with the alternatives asked for: Chicago-Dallas took 9.2 s with 5 and 3.7 s with 2, so **the main call asks for 2** (user decision, spec 6.1). The per-second limit is about 5 calls per key (HTTP 429 `TooManyRequests` beyond it); the server retries a 429 once after a short random wait (`docs/architecture.md` 6.4). Keys are now made at my.tomtom.com (TomTom's new dashboard); the server key is limited to the Routing API.

### 11. Place search (origin and destination suggestions)
| Option | Verdict |
|---|---|
| **Geoapify Autocomplete** | **Picked.** Limited to the US and Canada by a country filter. **3,000 free calls a day (about 90,000 a month), no card**, with an attribution link required. At about 8 calls per plan, that is about 11,000 plans a month. Calls go through Django, so the key stays on the server. |
| TomTom Search | Rejected. Same vendor as routing, but only 10,000 free suggest calls a month (about 1,200 plans). |
| OSM Nominatim | Rejected. Its usage policy forbids search-as-you-type. |

### 12. Weather
| Option | Verdict |
|---|---|
| **Open-Meteo Forecast API** | **Picked.** Hourly forecasts up to 16 days (we need 10) for the US and Canada. `wind_speed_10m` is sustained wind in mph; `rain` + `showers` give the liquid rain per hour; `snowfall` is the new snow depth per hour (spec 8.1). Many points go in one request. Free for non-commercial use: 600 calls a minute, 5,000 an hour, 10,000 a day, **counted per server IP**. |
| Tomorrow.io | Rejected. The free plan's hourly forecast is too short for the 10-day window. |
| US National Weather Service | Rejected. US only (no Canada), about 7 days. |

**Staying inside the free limit (user decisions):**
- **Shared 1-hour forecast cache.** Each weather point snaps to a fixed grid cell. The cell's hourly forecast is kept in Postgres for 1 hour and shared by every user. Snapped points still get real forecasts; the forecast models themselves work at 3-13 km.
- **Two cell sizes.** Checkpoints snap to cells about **11 km** (0.1 degrees) wide. Heatmap cells are about **55 km** (0.5 degrees) wide, larger on long trips (size to fit, below). Open-Meteo counts every location as one call, so heatmap size drives the cost.

Example, a 1,500-mile trip with 3 routes and nothing cached:

| Heatmap cell | Weather calls | Fits the free limit? |
|---|---|---|
| 11 km | about 2,000 + 90 checkpoints | No. It breaks the 600-per-minute cap on the first plan. |
| **55 km** | **about 300 + 90 checkpoints** | **Yes. About 25 such plans a day, and more when routes overlap and reuse the cache.** |

A second driver planning Chicago to Dallas 20 minutes after another reuses the first plan's cells and makes almost no weather calls.

**Size to fit (Step-8 user decision):** a coast-to-coast plan with nothing cached would need about 970 locations at 55 km cells, more than 600 a minute. So each plan uses at most 500 weather locations: the heatmap cells grow to about 110 or 220 km on long trips, and intervals whose checkpoints don't fit are greyed out (50 mi always allowed). Example: Los Angeles to New York at Auto (50 mi) = about 170 checkpoint cells + 128 heatmap cells of 220 km. Details: `docs/architecture.md` 6.5.

**Why not forward the driver's IP:** Open-Meteo counts the IP that connects, which is our server's, shared with other Vercel apps. Its free API has no key, so it has no way to trust a forwarded-IP header, and faking one to dodge the limit would break its terms. Calling Open-Meteo from the browser is rejected too: the browser would then hand weather to our server, which could be faked, and only the server may decide risk.

**Upgrade path:** if real usage outgrows the cache, Open-Meteo's paid "API Standard" plan (commercial use, 1M calls a month, its own key, no shared-IP limits) is a one-setting switch. Price on request; it needs the user's approval and budget.

**Known risk:** other Vercel apps on the same outbound IP also count toward Open-Meteo's per-IP limit, so a 429 can arrive before our own budget runs out. The app then shows "Weather service unavailable. Retry" (spec 11), never partial results.

### 12a. Protecting the free quotas (user decision)
**Problem:** the 30 plans/hour limit still lets one user make 720 plans a day. At about 4 TomTom calls per plan, one user could use up TomTom's 20,000 free monthly calls in about a week, and place search had no limit.
**Choice:** per-user caps plus a daily budget per provider. All counts live in Postgres.

| Guard | Limit | What the driver sees when it is reached |
|---|---|---|
| Plans per user | 30 per rolling hour (spec 4) and **100 per day** | "Limit reached. Try again in N minutes." |
| Place searches per user | **300 per hour** | "Search limit reached. Try again in N minutes." |
| Updates per user (Step-9) | **120 per rolling hour** (interval or HOS changes; protects Vercel's 4 CPU-hours a month) | "Limit reached. Try again in N minutes." |
| TomTom per day (all users) | **650** calls (20,000 / 31 days) | "Routing service daily limit reached. Try again tomorrow." |
| Geoapify per day (all users) | **2,900** calls | "Place search daily limit reached. Try again tomorrow." |
| Open-Meteo per day (all users) | **9,500** calls | "Weather service daily limit reached. Try again tomorrow." |

Provider days reset at midnight UTC. Example: on a busy day the 650th TomTom call goes through; the next "Plan trip" gets the routing message, and no Plan is counted against the user.

### 12b. Reusing routes on an interval or HOS change (user decision)
**Problem:** spec 7.1 reuses the plan's routes with no new routing call, but spec 4 stores no trip data, and the server can't trust routes the browser sends back.
**Choice:** a **signed route bundle**. The plan response carries the routes compressed and signed with Django's built-in `django.core.signing`. On an interval or HOS change the browser sends the bundle back, and the server checks the signature before using it. Nothing is stored, and an edited bundle is rejected. A bundle is also refused once its plan is more than 2 hours old (`BUNDLE_MAX_AGE`, Step-12 decision), so an old tab asks the driver to plan again instead of mixing old routes with a new forecast.
Example: a driver switches the interval from Auto to 10 mi. The browser re-sends about 30-60 KB (measured in Step-10, `docs/architecture.md` 6.13), the server verifies it in a few ms, then fetches weather only for the new checkpoints.

### 13. Monitoring (fixed by spec R-U2)
- **Sentry** (`sentry-sdk` for Django, `@sentry/react`), free Developer plan. Events strip request bodies, cookies and query strings, so no key, token or trip input is sent (spec 12).
- **PostHog** (`posthog-js`), free tier. Only its own anonymous ID; no trip inputs in properties.

### 14. Testing and code quality (my calls)
| Area | Pick | Rejected |
|---|---|---|
| Backend tests | **pytest + pytest-django**; saved real provider responses as test fixtures | Django's unittest runner (more boilerplate) |
| Frontend tests | **Vitest + Testing Library** (shares Vite's config) | Jest (separate config for Vite) |
| End-to-end and screenshots | **Playwright** (phone and desktop widths) | Cypress (weaker multi-viewport and WebKit) |
| Lint and format | **Ruff** (Python), **ESLint + Prettier** (TypeScript, strict mode) | Black + Flake8 (two tools where Ruff is one) |
| Package manager (JS) | **npm** (ships with Node 24) | pnpm, Yarn (one more tool to install) |

---

## Free-tier limits at a glance

| Service | Free limit | Rough plans it allows |
|---|---|---|
| Vercel Hobby | 1M function calls, **4 Active CPU-hours**, 360 GB-hours a month; 4.5 MB request and response bodies; non-commercial. Over a limit, the feature is blocked until the 30 days pass (checked 2026-11-01) | about 0.5 s of CPU per plan or update, so roughly 25,000 a month; the per-user caps (12a) stop one user from using it up |
| TomTom Routing | 20,000 calls a month (guard: 650 a day) | about 130-650 plans a day |
| Geoapify | 3,000 calls a day (guard: 2,900) | about 360 plans a day |
| Open-Meteo | 10,000 calls a day, 600 a minute, per IP (guard: 9,500) | about 25 long uncached plans a day; many more with cache reuse and shorter trips |
| Neon | 1 GB, 100 CU-hours a month (about 400 h awake), sleeps after 5 idle min | enough while it sleeps between visits; see the known risk in section 8 |
| OpenFreeMap | no limit, no key | - |
| Sentry, PostHog | free tiers | - |

Attribution shown in the map corner: OpenStreetMap / OpenFreeMap, TomTom, Geoapify and Open-Meteo, as their terms require.

## For Step-6 and Step-10
- Step-6 adds this stack to `CLAUDE.md` "Stack and commands", and adds the TomTom, Geoapify, Open-Meteo, Neon, Google, Sentry and PostHog sections to `docs/api-setup-guide.md` when each is set up (Rule-14).
- Step-10's first task: prove Vercel Services serves the React files and Django `/api` on one address, with the session cookie working, before building any slice. If it fails, use the two-project rewrite fallback (section 1).
