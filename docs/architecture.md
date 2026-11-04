# Truck Pilot - Architecture

Step-8 output. It says **how every feature is built**, backend and frontend. What the app does is in `docs/spec.md`; what it is built with is in `docs/tech-stack.md`; how the frontend looks and behaves is in `docs/design.md` (written "design x" below). This doc never restates looks or copy: it names the design section and adds only the wiring behind it.

User decisions from the Step-8 interview are marked **(user)**. Lines marked **(my call)** were approved with this doc (2026-11-01); the full list is in section 17.

---

## 0. Slice plan (Roadmap Step-11)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (Roadmap Step-11) to build this plan one slice at a time, in order. One slice per session. At the start of a slice, the main agent (Opus 5.5) turns that slice's tests below into bite-sized TDD steps for one Sonnet 5.5 subagent at a time.

**Goal:** build Truck Pilot v1 as `docs/spec.md` describes, on the stack in `docs/tech-stack.md`, with the frontend in `docs/design.md`.

**Architecture:** sections 1-17 below. Business rules are pure functions in `backend/planning/` (section 2), fed by one module per provider and the shared forecast cache. React only displays what the server decides.

**Tech stack:** Django 5.2 + Django Ninja on Python 3.12 (uv), Neon Postgres, httpx; React + TypeScript + Vite, TanStack Query, Tailwind v4, Radix, MapLibre GL JS.

**Spec:** `docs/spec.md`, with `docs/design.md` for every screen. Executors read the slice, the sections it names, and the spec sections it names. Nothing else.

**Before slice 1 (Roadmap Step-10, not a slice):** scaffold `backend/` and `frontend/` as section 2 says; Neon, `.env.local` and `.env.example` (section 14); Vercel Services proven (section 1); GitHub connected; the `CLAUDE.md` commands table; the provider checks listed in `docs/progress.md` (TomTom alternatives with Waypoints, far-future `departAt`, QPS, bundle size; Open-Meteo value precision), with their real answers saved as test fixtures. The preview deploy must also pass a CSRF-protected POST (section 9), and Google's allowed JavaScript origins get localhost plus the preview branch's stable URL. If TomTom refuses a far-future `departAt`, bring a fallback to the user before slice 5 (Step-9).

### Global constraints

- Every slice: tests first for rules, input checks, limits, endpoints and hooks; `pytest`, `vitest`, Ruff, ESLint and Prettier pass; `/code-review` at low effort; one commit with a plain-sentence message; push (CLAUDE.md Workflow).
- Words from spec 2 only (Checkpoint is never "stop" or "waypoint"). Enum-like values only from `core/constants.py` and `src/lib/constants.ts`.
- No emojis, no long dashes, no italic, no gradient text (CLAUDE.md).
- Real data only: the app never shows fixture or invented data; fixtures live in tests (Rule-10).
- Times are UTC inside; local zone only for display (spec 7.4).
- Keys stay on the server; the browser stores only `tp-units` and `tp-theme` (CLAUDE.md Secrets).
- Rules run on imperial values; metric is display only (spec 8.4).
- Every visible control works; screens checked with screenshots at 390 px and 1280 px in both themes (design 11).

### Review focus

Conditions the spec implies that are easy to miss. Each has a test in the slice named.

1. **A route that crosses time zones** (Chicago to Pittsburgh, CST into EST): each Checkpoint's local time uses its own zone, never off by one hour. Slice 2 (`test_eta_zone_per_checkpoint`) and slice 9 (`time.test.ts` "formats each zone").
2. **A very short trip** (route shorter than the interval, for example 6 mi at 10 mi): Checkpoints only at mile 0 and the destination, covered miles 3 + 3, the heatmap is one cell plus its ring. Slice 2 (`test_short_route_two_checkpoints`), slice 7 (`test_corridor_single_cell`).
3. **A departure more than 10 days ahead:** every Checkpoint has No weather data, average risk is empty, ranking falls to travel time, `heatmap` is null, and no weather call is made. Slice 3 (`test_rank_all_no_data`), slice 8 (`test_plan_beyond_window_no_weather_calls`).
4. **A double-clicked "Plan trip" or parallel requests at the limit:** at most 30 plans are recorded per hour, even with 5 requests at once. Slice 4 (`test_parallel_plans_respect_limit`).
5. **A provider answer that is malformed or has gaps** (Open-Meteo null inside the window, TomTom `progress` not rising): `provider_unavailable`, never a partial plan, and the user's plan is refunded. Slice 5 (`test_null_in_window_is_unavailable`, `test_tomtom_bad_progress`), slice 8 (`test_provider_failure_refunds_plan`).

### Slices

Each slice lists **Files**, **Produces** (the names later slices rely on), **Tests** (each must fail first, then pass) and **Commit**.

**Slice 1 - Risk engine** (section 6.9; spec 8)

- Files: `backend/core/constants.py`, `backend/planning/risk.py`, `backend/tests/planning/test_risk.py`.
- Produces: `Level` (IntEnum LOW 0 ... NO_TRAVEL 4, `.code` "low" ... "no_travel"), `Cause` ("wind", "rain", "snow"), `rate(wind_mph: Decimal, rain_in: Decimal, snow_in: Decimal, load_lb: int) -> Rating(level: Level, causes: tuple[Cause, ...], load_rule: bool)`. Band edges, load limits, scores (0-4) and interval values as constants.
- Tests: every spec 8.2 edge (wind 24.9 Low, 25.0 Moderate, 55.0 No Travel; rain 0.099 Low, 0.100 Moderate, 1.000 Severe, 1.001 No Travel; snow 3.000 Severe, 3.001 No Travel); load rules (wind 45.0 + 30,001 lb No Travel, + 30,000 lb Severe; wind 35.0 + 40,001 lb Severe, + 40,000 lb High); ties name every cause in order wind, rain, snow; `load_rule` true only when it raised wind and wind is a cause; Low has empty causes; the 5 rows of the spec 13 table.
- Commit: "Add the risk engine with spec band edges and load rules".

**Slice 2 - Tracks, Checkpoints, HOS and ETAs** (6.6, 6.7; spec 7)

- Files: `planning/geo.py`, `planning/track.py`, `planning/hos.py`, `planning/checkpoints.py`, tests for each.
- Produces: `RouteTrack(points, dist_m, drive_s, source, order)` with `length_mi`, `driving_s`, `at_distance(m) -> (lat, lon, drive_s)`, `at_drive_s(s) -> (lat, lon, m)`; `simplify(track, tol_m) -> RouteTrack`; `encode_polyline(points, precision) / decode_polyline`; `Stop(at_drive_s, duration_s, kind)`; `hos.stops(total_drive_s, hos_on) -> list[Stop]`; `hos.eta(departure_utc, drive_s, stops) -> datetime`; `hos.state_at(offset_s, stops, total_drive_s) -> (drive_s, status)`; `auto_interval(length_mi) -> int`; `place_checkpoints(track, interval_mi, departure_utc, stops) -> list[CheckpointPos(n, mile, of_mi, lat, lon, covered_mi, drive_s, eta_utc, tz)]`; `forecast_hour(eta_utc) -> datetime`; `in_window(hour_utc, now_utc) -> bool`.
- Tests: 112 mi at 25 gives miles 0, 25, 50, 75, 100, 112 (spec 7.2); covered miles 12.5, 25, 25, 25, 12.5 for 0-100 (spec 9.1) and their sum equals the length; auto interval 149.9 -> 10, 150 -> 25, 600 -> 25, 600.1 -> 50; the spec 7.3 HOS example (900 mi at 60 mph, depart 6:00 AM: break 2:00 PM, rest 5:30 PM, arrive 7:30 AM next day); no stop exactly at the destination; HOS off adds no stops; forecast hour 3:15 -> 3:00, 3:30 -> 4:00, 3:40 -> 4:00; window edge (now + 240 h in, + 241 h out); `test_eta_zone_per_checkpoint`; `test_short_route_two_checkpoints`; simplify keeps the first and last points and stays within the tolerance; polyline round trip.
- Commit: "Add route tracks, checkpoint placement, HOS timeline and ETAs".

**Slice 3 - Route numbers, ranking and recommendation** (6.10; spec 9)

- Files: `planning/ranking.py`, test.
- Produces: `route_numbers(checkpoints: list[RatedCheckpoint]) -> RouteNumbers(miles_by_level, no_data_mi, average_risk: Decimal | None)`; `rank(routes: list[RouteSummary]) -> list[RankedRoute(rank, recommendation, ...)]`, keeping the top 3, plus `do_not_travel: bool`.
- Tests: the spec 13 example (A average 1.50; order B, A, C; B Recommended, C Not recommended); a No Travel route ranks after all others; a route whose only No Travel checkpoint covers 0.02 mi is Not recommended and ranks with the No Travel routes (spec 9.3, Step-9); rounding before comparing (12.54 and 12.46 mi tie at 12.5); a full tie keeps API before detour order; every route with No Travel gives `do_not_travel` and no Recommended; `test_rank_all_no_data`.
- Commit: "Add route numbers, ranking and the recommendation".

**Slice 4 - Users, sessions, CSRF and limits** (3, 6.2, 6.3, 7, 9, 13)

- Files: `accounts/` (model, `services.sign_in`, `services.delete_account`), `providers/google.py`, `usage/` (models, `limits.py`), `api/auth.py`, `api/__init__.py` (Ninja API, error handler for 4.2), the `E2E_MODE` test sign-in and its settings guard, tests.
- Produces: `GET /api/csrf`, `POST /api/auth/google`, `POST /api/auth/sign-out`, `GET /api/me`, `POST /api/account/delete`; `google.verify(credential) -> GoogleIdentity(sub, email, name)`; `limits.record_plan(user) -> UsageEvent` (raises `RateLimited(retry_after_min)`), `limits.refund(event)`, `limits.record_update(user)` (raises `RateLimited`), `limits.record_search(user)`, `limits.reserve(provider, n)` (raises `ProviderBudget(service)`); `ApiError` mapping for every code in 4.2.
- Tests: a valid credential creates the user and sets an HttpOnly session; an unverified email or wrong audience is refused; POST without CSRF is 403; sign-out ends the session; account delete removes the user, their usage events and every session of theirs, and a second browser of the same user is signed out; the 31st plan in an hour is `rate_limited` with the right minutes; the 101st in 24 h too; the 121st update in an hour is `rate_limited`; `test_parallel_plans_respect_limit`; 301st search is `search_limited`; recording a search also clears the user's events older than 24 h; expired sessions are deleted at sign-in; `reserve` refuses at the budget and resets on a new UTC day; settings refuse `E2E_MODE` without `DEBUG`; `/api/docs` answers 404 when `DEBUG` is off.
- Commit: "Add Google sign-in, sessions, CSRF, account deletion and usage limits".

**Slice 5 - Providers and the forecast cache** (5, 6.4 main call, 6.8, 8, 10)

- Files: `providers/tomtom.py`, `providers/geoapify.py`, `providers/openmeteo.py`, `weather/` (model, `cache.py`), the fixture-replay switch for `E2E_MODE`, `tests/fixtures/*` (from Step-10), tests.
- Produces: `tomtom.routes(origin, destination, load_lb, depart_at, waypoint=None, max_alternatives=2) -> list[RouteTrack]` (raises `NoRoute`, `ProviderUnavailable`); `geoapify.autocomplete(q) -> list[GeoPlace(id, label, lat, lon)]`; `openmeteo.fetch(points) -> list[Forecast]`; `Forecast(start_utc, wind_mph, rain_in, snow_in)` with `at(hour_utc) -> (wind, rain, snow) | None`; `cache.get_forecasts(keys: list[str], now=None) -> dict[str, Forecast]` (the cache reads its own clock; `now` is for tests); `cell_key(lat, lon, deg) -> str`.
- Tests: each provider parses its saved real answer; timeout and 5xx become `ProviderUnavailable(service)`; TomTom "no route" becomes `NoRoute`; `test_tomtom_bad_progress`; rain = rain + showers as Decimal; `test_null_in_window_is_unavailable`; the cache reads fresh rows, fetches only missing ones in batches of 100, upserts each batch, and a 429 gives back its reservation; budget is reserved before any call; `test_key_never_in_error_or_log` (TomTom and Geoapify; the Sentry-event half of this check is in slice 17, where Sentry is set up).
- Commit: "Add the TomTom, Geoapify and Open-Meteo modules and the forecast cache".

**Slice 6 - Detour routes** (6.4; spec 6.2)

- Files: `planning/detours.py`, the detour round in `api` orchestration (or `planning/plan.py` caller), tests.
- Produces: `waypoints(fastest: RouteTrack, origin, destination) -> list[(lat, lon)]` (4, minus those outside the US/Canada zone list); `backtracks(track) -> bool`; `shared_share(candidate, kept) -> float`; `apply_ladder(api_routes, candidates) -> list[RouteTrack]`.
- Tests: Waypoints sit at 15% and 30% of the straight-line distance on both sides; a Waypoint in the Gulf of Mexico is dropped; a spur of 2 km into a Waypoint and back backtracks, a 300 m overpass crossing does not; share of an identical route is 1.0, of a disjoint one 0.0; ladder: a 130%/40% candidate is refused at step 1 and kept at step 2; two near-identical detours are not both kept; fewer than 3 after step 3 sets the count; the round makes at most 4 calls in parallel; the ladder works on TomTom's raw points, not the 20 m simplified tracks; speed: the ladder with 8 candidates on a 1,500 mi trip finishes in under 0.5 s (if not, the shared-road and backtrack sampling step goes from 100 m to 250 m) (Step-9).
- Commit: "Add the detour ladder for fewer than 3 routes".

**Slice 7 - Weather budget, heatmap and truck positions** (6.5, 6.11, 6.12)

- Files: `planning/weather_budget.py`, `planning/heatmap.py`, `planning/truck.py`, tests.
- Produces: `interval_choice(tracks, requested, departure_utc, now_utc, hos_on) -> IntervalChoice(used_mi, requested_mi, options)`; `heatmap_grid(c_count, shown_tracks) -> (cell_deg, ring)`; `corridor(tracks, cell_deg, ring) -> set[(i, j)]`; `heatmap(cells, forecasts, departure_utc, now_utc, load_lb, cell_deg) -> Heatmap | None` (encoded `lv`, `cz`); `truck_positions(track, stops, departure_utc) -> list[TruckPos]` (49).
- Tests: the 6.5 table cases built from straight-line tracks (Chicago-Dallas Auto at 0.5 deg; picking 10 uses 1.0 deg; LA-NY picking 10 uses 25 at 2.0 deg); 50 mi always allowed and drops the ring when over; counts don't depend on the cache; `test_corridor_single_cell`; hours past the window are "-"; `lv` and `cz` are 49 long; the truck is still during a break, `rest` during a rest, `arrived` after arrival.
- Commit: "Add the weather-location cap, heatmap grid and truck positions".

**Slice 8 - Plan, update and place endpoints** (4, 6.1, 6.13-6.15, 8)

- Files: `planning/plan.py`, `planning/bundle.py`, `api/plans.py`, `api/places.py`, `api/schemas.py`, tests, plus contract fixtures written to `frontend/src/test/fixtures/`.
- Produces: `build_plan(tracks, inputs, now_utc, get_forecasts) -> Plan` (with the injected cache function, so the rules stay free of I/O); `make_bundle / read_bundle(user_id)`; `POST /api/plans`, `POST /api/plans/update`, `GET /api/places` with the shapes in 4.1.
- Tests: input checks (bad token, same place under 0.5 km, load 80,001 lb, 36,288 kg, kg rounding 13,608 kg -> 30,000 lb, past departure beyond the 60 s grace); a plan from fixtures matches a saved golden `Plan`; plan and update with the same settings give equal numbers; a tampered or other user's bundle is `invalid_bundle`; update after the departure is `departure_passed` and doesn't count; each accepted update records an `update` event and the 121st in an hour is `rate_limited`; a kg load is sent and echoed as typed; `test_provider_failure_refunds_plan`; budget block refunds; `no_route` counts; `test_plan_beyond_window_no_weather_calls`; place tokens carry the zone; timings are logged without inputs.
- Commit: "Add the plan, update and place search endpoints".

**Slice 9 - Frontend foundation** (12.1, 12.2, 12.6; design 3, 4.1, 5, 9)

- Files: `src/styles/*`, `src/components/ui/*` (design 4.1), `src/lib/{api,constants,types,time,units,polyline,storage}.ts`, `src/app/*`, `entry-prerender.tsx`, `scripts/prerender.mjs`, `pages/NotFound`, the error boundary page, `useTheme`, `useUnits`, the header, tests.
- Produces: `request<T>(path, init) -> Promise<T>` throwing `ApiError(code, service?, retryAfterMin?, fields?)`; TS types for every 4.1 shape; `formatTime(utc, tz)`, `nowInZone(tz)`; unit formatters (design 8.7); the token CSS; the prerender pipeline run by `npm run build` (the landing content itself comes in slice 16; nothing is deployed before Step-13).
- Tests: token contrast and style guard (design 3.2, 11); `time.test.ts` "formats each zone" (CST, EST, AKST, Newfoundland); unit formats (24.6 mph, 39.6 km/h, 0.096 in/hr); polyline decode matches a backend-encoded fixture; `request` retries once on `csrf_failed`; storage access never throws when blocked; the build writes `index.html`, `sign-in/index.html` and `app.html`; axe on 404 and error pages.
- Commit: "Add the design tokens, base components, API client and prerender build".

**Slice 10 - Sign-in screens** (9, 12.3; design 7, F1, F11, F12)

- Files: `pages/SignIn`, `hooks/useSession.ts`, `useSignIn`, `useSignOut`, the account menu, the planner route guard, Playwright setup with `E2E_MODE`, tests.
- Tests (updated in Step-14): a signed-out `/` or `/plan` shows the planner under a sign-in pop-up that cannot be closed, with no message; a 401 mid-use shows "Your session ended. Sign in again."; sign-out shows the "Signed out" toast on `/`; the delete dialog (Esc cancels, failure keeps it open, success goes to `/` with "Account deleted"); e2e F1 (from `/`), F11, F12, F13 at 390 and 1280 px.
- Commit: "Add the sign-in page, session guard, sign-out and account deletion".

**Slice 11 - Planner shell and trip form** (12.3-12.5; design 8.1, 8.2, 8.6 Empty, Planning, Error, No route, Limit reached)

- Files: `pages/Planner`, `features/planner/{usePlanner,usePlanTrip,usePlaceSearch,useBottomSheet,useDepartureDefault}.ts`, `map/{PlannerMap,useMapLibre,mapTheme}.ts`, PlaceField, DepartureField, LoadField, BottomSheet, StatusMessage, tests.
- Tests: reducer transitions for every state named; PlaceField debounce, cache per query, abort, arrow keys, Enter, Esc, and its 4 list states; DepartureField disabled until an origin is picked, default next quarter hour in the origin's zone, past time refused; load limits in lb and kg; the load keeps its typed value through a units round trip (30,001 lb, to km, back to 30,001 lb); limit messages read "Try again in 25 minutes" under 60 and "Try again in 14 h 5 min" from 60; `mapTheme` matches the CSS tokens; the footer credits name OpenStreetMap, OpenFreeMap, OpenMapTiles, TomTom, Geoapify and Open-Meteo (Step-14b); the sheet handle steps peek, half, full by keyboard and drag snaps to the nearest height; the panel collapse button hides and shows the panel; the swap button swaps the places; "More options" carries interval and HOS into the request; Cancel stops waiting; the planner chunk is lazy (no MapLibre in the landing bundle); e2e F2 up to the Planning state and each error state from fixtures.
- Commit: "Add the planner shell, map and trip form".

**Slice 12 - Results: route cards and routes on the map** (12.5; design 8.3, 8.5 routes, 8.6 Results, Do not travel, Fewer than 3 routes, interval note)

- Files: RouteCard, TripSummary, the Routes tab, `map/layers/routes.ts`, route chips, fit, tests.
- Tests: card content and formats exactly as design 8.3, including "under 0.1 mi"; Recommended selected on arrival, else 1st best; radiogroup arrow keys; selecting a card, line or chip selects it everywhere; Do not travel, "Only N distinct truck routes exist" and interval-note messages; the live-region text; e2e F2 end to end, F3, F9.
- Commit: "Add route cards, route lines and route selection".

**Slice 13 - Checkpoints** (design 8.4, F4)

- Files: CheckpointRow, CheckpointDetail, the Checkpoints tab, `map/layers/checkpoints.ts`, popup and sheet detail, tests.
- Tests: the detail matches spec 8.5 line for line (38.0 mph, 0.050 in/hr); ties, the load-rule text and Low with no "set by"; the no-data detail; a marker tap and a row tap open the same detail; Esc returns focus; e2e F4.
- Commit: "Add the checkpoint list, markers and detail".

**Slice 14 - Heatmap, forecast slider, truck and legend** (12.5; design 8.5, F5)

- Files: `map/layers/heatmap.ts`, ForecastSlider, `useForecastSlider`, the truck marker, MapLegend, the cell tooltip, tests.
- Tests: the fill expression picks hour `h` from `lv`; past-window hours show no fill and "No forecast for this hour"; value text and `aria-valuetext` with the truck's state; keys (arrows, Page Up/Down, Home/End); "Show heatmap" hides only that layer; a slider move sends no request and updates within 100 ms (Playwright timing); e2e F5.
- Commit: "Add the risk heatmap, forecast slider and truck marker".

**Slice 15 - Updates, units and theme in the planner** (6.14, 12.3; design 4.2 TripSettings, 8.6 Updating, Update failed, Departure passed, F6, F7, F8)

- Files: TripSettings, `useUpdatePlan`, the toast wiring, UnitsToggle, the map style switch, tests.
- Tests: an interval or HOS change sends the bundle and shows Updating; after it, the selected route and slider hour stay (or the Recommended route when the old one left the top 3) and an open checkpoint detail closes; failure restores the old value with a Retry toast; an update over the limit restores the old value with the limit toast; metric rain and snow show 2 decimals in mm/hr (2.51, 2.54); `invalid_bundle` shows "This plan can't be updated. Plan the trip again."; a passed departure refuses with "Edit trip"; greyed options read "(too many checkpoints for this trip)"; units redraw every value at once, load included; the theme switch re-adds all layers; e2e F6, F7, F8.
- Commit: "Add interval and HOS updates, units and theme in the planner".

**Slice 16 - Landing and privacy pages** (12.2; design 6, 9.1, 12)

- Files: `pages/Landing/*` (10 sections), `pages/Privacy`, the SpriteArt illustrations (design 12), landing-only CSS, tests.
- Tests: the build also writes `privacy/index.html`, whose text matches design 9.1 with the contact mailto; the footer and sign-in page link to it; prerendered HTML holds every section's text with no JavaScript; hydration gives no warnings; reduced motion gives the static layouts; the phone menu dialog, FAQ wheel and track work by keyboard; links go to `/sign-in` and anchors; axe in both themes at 390 and 1280 px; landing JS within its 150 KB gzip budget.
- Commit: "Add the landing and privacy pages".

**Slice 17 - Monitoring, budgets and headers** (10, 11, 12.2)

- Files: Sentry setup (backend and frontend), `lib/analytics.ts`, the size check script, Vercel security headers and CSP, tests.
- Tests: `before_send` and `before_breadcrumb` strip bodies, cookies and query strings; `test_key_never_in_sentry_event` (a failing TomTom and Geoapify call leaves its key in no Sentry event); PostHog has autocapture off and only the events in section 10, with no trip inputs in properties; the size check fails on an over-budget build; the CSP allows Google sign-in, OpenFreeMap, Sentry and PostHog, MapLibre's `blob:` workers and `data:`/`blob:` images, and the inline theme script by its sha256 hash, and nothing else (Playwright run with no CSP errors in the console).
- Commit: "Add Sentry, PostHog, size budgets and security headers".

After slice 17, Roadmap Step-12 (hardening) begins.

---

## 1. System overview

```
Browser (React SPA + SSG pages)
  |  GET /, /plan, /guide, assets  ->  Vercel CDN (static files from `vite build` + prerender)
  |  /api/*  (same address, HttpOnly session cookie, X-CSRFToken header)
  v
Django 5.2 + Django Ninja  (one Vercel Function, Python 3.12, region iad1)
  |-- Neon Postgres (pooled): users, sessions, usage events, provider day counts, forecast cache
  |-- TomTom Routing    (truck routes, detours)
  |-- Geoapify          (place suggestions, US + CA)
  |-- Open-Meteo        (hourly forecasts, always through the forecast cache)
  |-- Google            (ID token check through google-auth)
  '-- Sentry            (errors; PostHog runs in the browser only)
```

- **One address** (`mytruckpilot.vercel.app`) through Vercel Services: `/api/*` to Django, everything else to the static files (tech-stack 1). Step-10 proves it; the fallback is two projects with a rewrite, which changes nothing in this doc.
- **Region (my call):** the Vercel Function and Neon both in US East (Vercel `iad1`, Neon `aws-us-east-1`), so each database round trip is about 1 ms instead of 70.
- **Function limits (my call):** max duration 30 s (a plan targets under 10 s; the extra room lets a slow provider time out cleanly instead of the function being killed). Request bodies stay far below Vercel's 4.5 MB limit and Django's default 2.5 MB upload limit (the route bundle is about 30-60 KB, measured in Step-10, section 6.13).
- **No state in memory:** every count, session and cache row is in Postgres. Nothing is written to disk at runtime.

---

## 2. Repository layout

```
/                     CLAUDE.md, README.md, vercel config (Step-10), .env.example
/docs                 all other docs
/backend              Django project (uv, pyproject.toml, Python 3.12)
  manage.py
  truckpilot/         settings.py, urls.py, wsgi.py
  core/               constants.py (risk levels, intervals, providers, error codes), errors.py
  accounts/           User model, Google sign-in, session endpoints
  usage/              UsageEvent, ProviderDay, limits.py (per-user limits, provider budgets)
  providers/          tomtom.py, geoapify.py, openmeteo.py, google.py (one module per provider)
  weather/            ForecastCell model, cache.py (the only way to get a forecast)
  planning/           pure business rules, no I/O, no Django imports (section 5)
  api/                Ninja routers: auth.py, places.py, plans.py; schemas.py (Pydantic in/out)
  tests/              mirrors the modules; fixtures/ holds saved real provider responses
/frontend             Vite + React + TypeScript
  index.html          template; also published as the CSR shell `app.html`
  scripts/prerender.mjs
  src/                section 12
```

**The `planning/` rule:** every business rule (route ladder, checkpoints, covered miles, ETAs and HOS, forecast hour, risk, ranking, heatmap, truck positions) lives in `planning/` as plain functions over plain data. It never calls a provider or the database. The API layer gathers data (providers, cache, limits), hands it to `planning/`, and returns the result. That makes every rule testable without mocks (CLAUDE.md: business rules tested first).

---

## 3. Data model (Neon Postgres)

| Table              | Columns                                                                                                          | Notes                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `accounts_user`    | id, google_sub (unique), email, name, created_at, last_login                                                     | Custom user model from day one (`AUTH_USER_MODEL`). No password (unusable). This is everything spec 4 lets us keep about a person. |
| `accounts_session` | Django's session columns + user_id (indexed, nullable)                                                           | Database sessions (tech-stack 9), extended so a user's sessions can be deleted at once (section 9, Step-9).                        |
| `usage_event`      | id, user_id (cascade delete), kind (`plan`, `update` or `search`), at (UTC)                                      | Index on (user_id, kind, at). Rows older than 24 h are deleted (section 3 clean-up).                                               |
| `provider_day`     | provider (`tomtom`, `geoapify`, `openmeteo`), day (UTC date), calls                                              | Primary key (provider, day). Rows older than 2 days are deleted.                                                                   |
| `forecast_cell`    | key (text, primary), fetched_at, start_utc, wind_mph (jsonb array), rain_in (jsonb array), snow_in (jsonb array) | Key = `"<size>:<lat index>:<lon index>"`, e.g. `"0.1:419:-877"`. Index on fetched_at. Shared by every user, tied to none.          |

- No trip inputs or results are stored (spec 4). Django admin is not installed **(my call: YAGNI)**.
- Connection: Neon's **pooled** URL, `CONN_MAX_AGE = 0`, psycopg 3 (Django's standard Postgres driver), and `DISABLE_SERVER_SIDE_CURSORS = True` (Neon's pooler runs PgBouncer in transaction mode, where Django's server-side cursors break) (Step-9).
- **Migrations (Step-9, my call):** run from this PC with `uv run python manage.py migrate` against Neon's direct URL (`DATABASE_URL_UNPOOLED`) before the deploy that needs them; never at runtime or in the Vercel build (a preview build would migrate the shared database). Step-10 and the README say how.
- Clean-up runs inside requests, no cron **(my call)**: each plan deletes `forecast_cell` rows older than 1 h; each recorded plan, update or search deletes that user's `usage_event` rows older than 24 h; each sign-in deletes expired session rows (Step-9); the first provider reservation of a UTC day deletes `provider_day` rows older than 2 days. Each is one indexed `DELETE`.

---

## 4. API

All endpoints are under `/api`, JSON in and out, built with Django Ninja. Every endpoint except `csrf`, `auth/google` and `me` needs a signed-in session (Ninja session auth). Every request that changes something (POST) needs the `X-CSRFToken` header (tech-stack 9).

| Method and path            | Body or query                      | Answer                                                                      | Counts toward                                                                                |
| -------------------------- | ---------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| GET `/api/csrf`            | -                                  | `{ csrf_token }`                                                            | -                                                                                            |
| POST `/api/auth/google`    | `{ credential }` (Google ID token) | `{ user }` + session cookie                                                 | -                                                                                            |
| POST `/api/auth/sign-out`  | -                                  | 204, session ended                                                          | -                                                                                            |
| GET `/api/me`              | -                                  | `{ user: { name, email } }` or 401                                          | -                                                                                            |
| POST `/api/account/delete` | -                                  | 204; user, usage events and all their sessions deleted, signed out (Step-9) | -                                                                                            |
| GET `/api/places?q=`       | q: 2 to 100 characters             | `{ places: Place[] }`                                                       | 300 searches/hour/user; Geoapify budget                                                      |
| POST `/api/plans`          | `PlanRequest`                      | `Plan`                                                                      | 30 plans/rolling hour and 100/rolling 24 h per user; provider budgets                        |
| POST `/api/plans/update`   | `UpdateRequest`                    | `Plan`                                                                      | 120 updates/rolling hour per user (Step-9); provider budgets; never the plan limits (spec 4) |

### 4.1 Shapes

```
Place        { label: "Chicago, IL, USA", tz: "America/Chicago", token: "<signed>" }

PlanRequest  { origin: <place token>, destination: <place token>,
               departure_local: "2026-11-03T13:00",          // wall time in the origin's zone
               load: { value: 42000, unit: "lb" | "kg" },
               interval: "auto" | 10 | 25 | 50,              // miles
               hos: bool }

UpdateRequest { bundle: "<signed>", interval: "auto" | 10 | 25 | 50, hos: bool }

Plan {
  now_utc, window_end_utc,                                   // forecast window (spec 7.6)
  trip: { origin: {label, tz}, destination: {label, tz},
          departure_utc, load_lb, load: { value, unit } (as typed), hos },
  interval: { mode: "auto" | "fixed", used_mi: 25, requested_mi: 10 | null,
              options: [ { mi: 10, allowed: false }, { mi: 25, allowed: true }, { mi: 50, allowed: true } ] },
  notices: { fewer_routes: 2 | null, do_not_travel: bool },
  routes: [ Route ],                                         // 1 to 3, in rank order
  heatmap: Heatmap | null,                                   // null when every hour is past the window
  bundle: "<signed>"
}

Route {
  id: "r0",                                                  // stable inside one bundle
  rank: 1, recommendation: "recommended" | "not_recommended" | null,
  source: "api" | "detour",
  distance_mi, driving_s, travel_s,                          // travel follows HOS (spec 7.3)
  arrival_utc, arrival_tz,
  miles: { low, moderate, high, severe, no_travel, no_data },  // 0.01 mi precision, so "under 0.1 mi" can be shown (Step-9)
  average_risk: 1.5 | null,
  line: "<encoded polyline, precision 5>",                   // the 20 m track of 6.13, so markers sit on the line
  checkpoints: [ Checkpoint ],
  truck: [ { lat, lon, mile, status: "driving" | "break" | "rest" | "arrived" } x 49 ]
}

Checkpoint {
  n: 4, mile: 75, of_mi: 412, lat, lon, covered_mi: 25.0,
  eta_utc, tz, forecast_utc,
  weather: { wind_mph: 38, rain_in: 0.05, snow_in: 0.0 } | null,   // null = No weather data
  level: "low" | "moderate" | "high" | "severe" | "no_travel" | null,
  causes: ["wind"], load_rule: true
}

Heatmap {
  cell_deg: 0.5 | 1.0 | 2.0,
  hours: [ { utc, in_window: bool } x 49 ],                   // hour 0 = departure
  cells: [ { i: 83, j: -176, lv: "0011222...", cz: [1,1,8,...] } ]
         // i, j = cell index (south-west corner = i*cell_deg, j*cell_deg)
         // lv = 49 characters, one per hour: "0".."4" = Low..No Travel, "-" = no data
         // cz = 49 cause bitmasks: 1 wind, 2 rain, 4 snow, 8 load rule raised the wind
}
```

- Every time is UTC ISO 8601 plus the IANA zone of its own place. The browser formats it with `Intl.DateTimeFormat` in that zone, `timeZoneName: "short"` (gives "CST", "EST", "AKST"; Newfoundland shows "GMT-3:30") **(my call: no zone text from the server)**.
- Numbers are imperial. Weather values are exactly the values rated (6.9); risk miles are sent at 0.01 so the browser can show "under 0.1 mi", and shown at 0.1 as spec 9.3 says (Step-9). The browser converts for metric display only (design 8.7).
- Levels and causes are the string values in `core/constants.py`, mirrored in `frontend/src/lib/constants.ts`.
- Response size: a 1,500 mi plan is about 200-400 KB before gzip (3 lines of 3-6k points, about 120 checkpoints, about 300 heatmap cells), plus the bundle.

### 4.2 Errors

One error shape: `{ code, service?, retry_after_min?, fields? }`. The **server sends codes, the browser owns the copy** (design 8.6 and spec 11), so wording lives in one place.

| code                   | HTTP | When                                                                                                                                                                                        | Plan counted?                            |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `not_signed_in`        | 401  | no session                                                                                                                                                                                  | -                                        |
| `sign_in_failed`       | 401  | `POST /api/auth/google`: Google's token was refused (signature, audience, expiry, issuer, or email not verified). The browser shows "Sign-in failed. Try again." (design 7) (Step-11, user) | -                                        |
| `csrf_failed`          | 403  | token missing or stale. The browser fetches a new token and retries **once** (the token changes at sign-in).                                                                                | -                                        |
| `invalid_input`        | 422  | a field fails a rule; `fields` maps field to code (`pick_place`, `load_range`, ...)                                                                                                         | no                                       |
| `same_place`           | 422  | spec 5                                                                                                                                                                                      | no                                       |
| `departure_passed`     | 422  | spec 11, at plan or update                                                                                                                                                                  | no                                       |
| `invalid_bundle`       | 400  | the bundle's signature fails or it belongs to another user                                                                                                                                  | -                                        |
| `rate_limited`         | 429  | 30 plans/hour, 100 plans/24 h or 120 updates/hour reached; `retry_after_min`. The browser writes 60 or more minutes as "14 h 5 min" (spec 4)                                                | no                                       |
| `search_limited`       | 429  | 300 searches/hour reached; `retry_after_min`                                                                                                                                                | -                                        |
| `provider_budget`      | 503  | a provider's daily budget is used up; `service` = `routing`, `places` or `weather`                                                                                                          | no (spec 4)                              |
| `provider_unavailable` | 502  | a provider failed, timed out or sent an invalid answer; `service`                                                                                                                           | **no (my call, same as a budget block)** |
| `no_route`             | 422  | TomTom finds no truck route                                                                                                                                                                 | yes (a real answer)                      |

---

## 5. Backend modules

| Module                       | Responsibility                                                                                                                                                                                                 | Talks to             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `core/constants.py`          | Risk levels and scores, causes, intervals (10/25/50), auto-interval thresholds, ladder steps, cell sizes, limits and budgets, error codes, provider names. No inline literals elsewhere.                       | -                    |
| `planning/geo.py`            | Distance (haversine), local flat projection, interpolation along a line, Douglas-Peucker simplify, polyline encode, point-to-line distance with a grid index, cell index of a point                            | -                    |
| `planning/track.py`          | `RouteTrack`: the normalized route (points, cumulative metres, cumulative driving seconds) built from a TomTom route or a bundle                                                                               | geo                  |
| `planning/detours.py`        | Waypoint placement, shared-road share, backtrack test, the ladder                                                                                                                                              | geo, track           |
| `planning/hos.py`            | HOS timeline: driving seconds to wall time and back (spec 7.3)                                                                                                                                                 | -                    |
| `planning/checkpoints.py`    | Auto interval, checkpoint positions, covered miles, ETAs, forecast hour, window test                                                                                                                           | track, hos           |
| `planning/risk.py`           | **The one risk engine**: `rate(wind_mph, rain_in, snow_in, load_lb) -> Rating(level, causes, load_rule)`                                                                                                       | constants            |
| `planning/ranking.py`        | Route numbers, average risk, ranking, recommendation, top 3                                                                                                                                                    | risk results         |
| `planning/heatmap.py`        | Corridor cells, cell size to fit, per-hour levels                                                                                                                                                              | geo, risk            |
| `planning/truck.py`          | Truck position for hours 0-48                                                                                                                                                                                  | track, hos           |
| `planning/weather_budget.py` | Counts weather locations per interval; decides allowed intervals and heatmap cell size (section 6.5)                                                                                                           | checkpoints, heatmap |
| `planning/plan.py`           | `build_plan(tracks, inputs, forecasts) -> Plan`: runs the rules above in order. Used by both plan and update.                                                                                                  | all of the above     |
| `providers/*.py`             | One module per provider: build the request, check the budget, call with a timeout, validate the answer with Pydantic, map it to plain data. Raise `ProviderUnavailable(service)` or `ProviderBudget(service)`. | httpx, usage         |
| `weather/cache.py`           | `get_forecasts(cell_keys, now=None) -> {key: Forecast}` (reads its own clock; `now` is for tests): read fresh rows, fetch the missing ones from Open-Meteo, upsert them                                        | openmeteo, Postgres  |
| `usage/limits.py`            | Per-user limit checks and recording, provider budget reservation                                                                                                                                               | Postgres             |
| `api/*.py`                   | Auth, input checks, orchestration, error mapping                                                                                                                                                               | everything           |

**Concurrency (my call):** views are plain sync Django (WSGI, Vercel's default). Where calls fan out (detour requests, weather batches), the provider module runs them in parallel with `httpx.AsyncClient` inside one `asyncio.run(...)`. Database reads happen before that block and writes after it, so Django's ORM is never used from async code.

**Timeouts (my call):** TomTom 6 s per call, Open-Meteo 6 s per batch, Geoapify 3 s, Google certificate fetch 5 s. No automatic retries; the driver has Retry (spec 11), and a retry is cheap because fetched forecasts are already cached.

---

## 6. The plan pipeline (`POST /api/plans`)

Steps run in this order. Steps 1-2 are in the API layer, 3 and 8 call providers, the rest are `planning/`.

### 6.1 Check the input (spec 5)

- Both place tokens must verify (`django.core.signing`, salt `place`, section 8). A missing or bad token is `invalid_input` / `pick_place`. Because only our server makes tokens, and only from Geoapify answers filtered to the US and Canada, a verified token proves the place is in the region (spec 11 "Place outside the US or Canada").
- **Same place (my call):** the same Geoapify place ID, or less than 0.5 km apart: `same_place`.
- **Load:** a whole number; lb 0 to 80,000, kg 0 to 36,287. kg is converted to lb and rounded to the nearest whole lb (half up) before anything else (spec 5).
- **Departure:** `departure_local` is read in the origin's zone with `zoneinfo` (zone from the origin token, which the server computed with timezonefinder), then turned into UTC. It must be at or after now minus 60 s (a small grace for the clock and the trip to the server) **(my call)**, else `departure_passed`. A wall time that falls in a DST gap or overlap uses `fold=0` (the earlier reading) **(my call)**.
- **Interval and HOS:** one of the allowed values, else `invalid_input`.

### 6.2 Check and record the user's limits (spec 4)

In one transaction that locks the user's row (`select_for_update`, so 30 parallel requests can't slip past):

1. Count `plan` events in the last 60 min and the last 24 h. At 30 or 100: `rate_limited` with `retry_after_min` = minutes until the oldest event in that window leaves it, rounded up.
2. Otherwise insert a `plan` event now.

If the plan later ends in `provider_budget` or `provider_unavailable`, that event is deleted, so the driver isn't charged (spec 4, and my call for failures). `no_route` keeps it. If the driver presses Cancel (design 8.6), the browser stops waiting, but the server still finishes and the plan counts **(my call: a server can't see a closed tab in time)**.

"Per day" is a rolling 24 h, like the rolling hour, so one query shape serves both **(my call)**.

### 6.3 Provider budgets (tech-stack 12a)

Before every provider call, `reserve(provider, n)` runs one atomic statement on today's `provider_day` row (UTC): add `n` only if the total stays at or under the budget (TomTom 650, Geoapify 2,900, Open-Meteo 9,500). If it can't, raise `provider_budget`. Reserved calls are not given back when a call fails, because the provider counted them too. Example: TomTom is at 648 and a plan needs 1 + 4 calls; the main call reserves 1 (649), the detour round needs 4 and is refused, so the plan ends with "Routing service daily limit reached" and the driver's plan event is deleted.

### 6.4 Routes (spec 6, user: 4 detour candidates at once)

**Main call:** TomTom Calculate Route, GET, `travelMode=truck`, `vehicleWeight` = load in kg (rounded), `maxAlternatives=2` (Step-10, user: 5 alternatives took 9.2 s on Chicago-Dallas, 2 took 3.7 s), `routeType=fastest`, `traffic=true` (default), `departAt` = departure in UTC, or `now` when the departure is less than 1 minute away (the 60 s grace in 6.1 must never send TomTom a past time) **(my call)**, `routeRepresentation=polyline`, `extendedRouteRepresentation=distance,travelTime`. TomTom then uses its typical road speeds for that day and hour **(my call: TomTom's default)**. Each route becomes a `RouteTrack`: the points of every leg joined, with cumulative metres and driving seconds from `progress`. The answer is validated (equal lengths, both series rising, at least 2 points); anything else is `provider_unavailable`. TomTom's "no route" error is `no_route`.

**Route count:**

- 3 routes (the best route plus 2 alternatives): use them; all are rated and ranked (spec 6.2).
- Fewer than 3: the detour round.

**TomTom's per-second limit (Step-10, user):** a burst of 10 calls at once got 4 HTTP 429 `TooManyRequests` (about 5 calls a second per key, no rate headers). On a 429, the call waits a random 0.3-0.6 s and retries once; a second 429 is `provider_unavailable`. Applies to the main call and each detour call.

**Detour round (user):**

1. **Waypoints.** Take the point halfway along the fastest route. From it, step at right angles to the straight origin-to-destination line, left and right, by **15% and 30%** of the straight-line trip distance: 4 Waypoints. Example: Chicago to Dallas is about 1,290 km (800 mi) in a straight line, so the Waypoints sit about 195 km and 390 km to each side of the middle of the route. The offsets are proportional on purpose: a path through a 15% or 30% offset is about 104% or 117% of the straight line on any trip, which lands inside the ladder's 125-200% time limits.
2. **Skip Waypoints outside the region (my call):** timezonefinder gives each Waypoint a zone; a Waypoint whose zone is not on the US/Canada zone list in `core/constants.py` (the sea, Mexico) is dropped before any call. This saves TomTom calls and keeps detours out of Mexico.
3. **Calls:** one parallel round, one call per remaining Waypoint, path origin, Waypoint, destination, with `maxAlternatives=1`, so each call can give 2 candidates for the same cost (TomTom's docs restrict alternatives only with `computeBestOrder`; confirmed in Step-10: a real Chicago, Waypoint, Dallas call returned 2 routes in 3.1 s). A Waypoint with no route is just dropped: this covers TomTom's `NO_ROUTE_FOUND` and any other HTTP 400, such as `MAP_MATCHING_FAILURE` for a Waypoint that landed in a lake (confirmed with a real call in Step-11: Chicago to Detroit through a point in Lake Michigan). A timeout or server error on any detour call is `provider_unavailable` **(my call: showing "Only N distinct truck routes exist" when a detour call merely failed would be false)**.
4. **Backtrack test (spec 6.2):** like the shared-road test below, it runs on TomTom's raw points; tracks are simplified to 20 m (6.13) only after the routes are kept, because two 20 m simplifications of one road can sit up to 40 m apart and hide shared road from the 25 m match (Step-9). Sample the candidate every 100 m. A sample "doubles back" when it lies within 25 m of the same route more than 1 km earlier along it. A candidate with more than 1 km of doubled-back samples in a row is dropped. (A short overpass crossing is under 1 km; a spur into a Waypoint and back is not.) **(my call: thresholds)**
5. **Shared road:** sample the candidate every 100 m; a sample is shared when it lies within 25 m of any route already kept. Share = shared samples / all samples **(my call: thresholds)**. A grid index of the kept routes' segments keeps this fast.
6. **Ladder:** with the fastest API route's driving time as the base:
   ```
   for step in [(1.25, 0.50), (1.50, 0.70), (2.00, 0.90)]:
       while fewer than 3 routes kept:
           passing = candidates with driving time <= step.time x base
                     and shared share vs ALL kept routes <= step.share
           if none: go to the next step
           keep the passing candidate with the shortest driving time
   ```
   Re-checking the share against every kept route, detours included, stops two detours from being near copies of each other.
7. Still fewer than 3: `notices.fewer_routes = N` (spec 6.2).

At most 5 TomTom calls per plan (1 + 4), so the 650 budget covers at least 130 plans a day.

**Stored order:** API routes in TomTom's order, then detours in the order they were kept. This is the tie order in ranking (spec 9.3, S-5).

### 6.5 Interval and the weather-location cap (spec 7.1, user: size to fit)

Open-Meteo counts each location as one call and allows 600 a minute per IP (tech-stack 12). **Each plan uses at most 500 weather locations (user).**

1. **Auto interval** from the fastest route's length (spec 7.1): under 150 mi 10, 150-600 mi 25, over 600 mi 50.
2. For each interval (10, 25, 50), count **C** = the distinct 0.1-degree checkpoint cells across **all kept routes** (at most 3, Step-10), counting only checkpoints whose forecast hour is inside the window. Count **H2** = the corridor cells of all kept routes at 2.0-degree cells (0 if every heatmap hour is past the window).
3. An interval is **allowed** when C + H2 <= 500. **50 mi is always allowed**, even if it doesn't fit, because nothing coarser exists (only very long trips, such as Miami to Anchorage, reach this). In that case the heatmap uses 2.0-degree cells **without the ring** **(my call)**; any small excess over 500 is accepted, since Open-Meteo's real limit is 600 a minute.
4. The requested interval (Auto's value, or the driver's choice) is used if allowed; otherwise the next larger allowed one, and `interval.requested_mi` says so (design change, section 16).
5. After ranking (6.10), the heatmap cell size is the **smallest of 0.5, 1.0, 2.0 degrees** (about 55, 110, 220 km) whose corridor around the **shown** routes fits: C + H <= 500, with C still counting all kept routes (their weather was already fetched). The ring is one cell at that size, so the corridor is about 165, 330 or 660 km wide.

Worked example (estimates from straight-line paths, 2026-11-01):

| Trip                                 | Checkpoint cells C                   | Heatmap at 0.5 / 1.0 / 2.0 deg | Interval                                        | Cell size    | Total     |
| ------------------------------------ | ------------------------------------ | ------------------------------ | ----------------------------------------------- | ------------ | --------- |
| Chicago to Dallas, 925 mi, Auto (50) | about 60                             | 260 / 102 / 46                 | 50                                              | 0.5 (55 km)  | about 320 |
| Chicago to Dallas, driver picks 10   | about 280                            | 260 / 102 / 46                 | 10                                              | 1.0 (110 km) | about 380 |
| LA to New York, 2,800 mi, Auto (50)  | about 170                            | 804 / 333 / 128                | 50                                              | 2.0 (220 km) | about 300 |
| LA to New York, driver picks 10      | about 840 (at 10), about 340 (at 25) | 804 / 333 / 128                | 10 not allowed (840 + 128 > 500), so 25 is used | 2.0 (220 km) | about 470 |

The counts are deterministic (they don't depend on what is cached), so the same trip always gets the same grid. Cached cells still cost no call.

### 6.6 Checkpoints, covered miles and ETAs (spec 7.2, 7.3, 9.1)

- Positions: mile 0, every interval, then the destination (spec 7.2). Each position is found by its distance along the `RouteTrack`; latitude, longitude and driving seconds are interpolated between the two neighbouring points by distance (tech-stack 10).
- Mile labels: `mile` = the interval mark (0, 25, 50...) and the destination's whole-mile length; `of_mi` = the route length in whole miles. Covered miles use the exact distances.
- **HOS timeline** (`hos.py`): walk the route's total driving time with two counters. When "since last rest" reaches 11 h: a 10 h rest, both counters reset. Otherwise, when "since last break" reaches 8 h: a 30 min break. A stop exactly at the destination's driving time is not taken. The result is a list of `(driving_s, duration_s, kind)`.
- **ETA** = departure + driving seconds + the durations of stops at a strictly smaller driving time (a Checkpoint at the exact spot of a stop gets its arrival time, before the stop) **(my call)**. HOS off: no stops.
- `travel_s` = ETA at the destination minus departure.
- `tz` of each Checkpoint from timezonefinder (offline), including Checkpoints past the window.

### 6.7 Forecast hour and window (spec 7.5, 7.6)

- **Forecast hour** = the ETA rounded to the nearest whole UTC hour, half past going up. Open-Meteo's hours are UTC hours. In zones with a whole-hour offset this is the same as the spec's local examples (3:15 PM CST uses 3:00 PM). Newfoundland (UTC-3:30) gets the nearest UTC hour, shown as, e.g., "3:30 PM" local **(edge reading)**.
- **Window:** `now` = the server time when "Plan trip" is handled. The bundle carries it, and an update uses the same `now`, because spec 7.6 counts the window from when the Plan is made and an interval or HOS change is not a new Plan **(edge reading)**. So toggling a setting never moves a Checkpoint in or out of "No weather data". A forecast hour after now + 240 h means "No weather data".
- **Which Open-Meteo values (edge reading):** the forecast hour's row as Open-Meteo labels it: wind at that hour; rain, showers and snowfall summed over the hour that ends at it (Open-Meteo: "preceding hour sum"). Rain = `rain` + `showers` (spec 8.1).

### 6.8 Weather fetch and the forecast cache (tech-stack 12)

- Cell keys: Checkpoints use 0.1-degree cells; heatmap cells use the size from 6.5. A cell's forecast is taken at its centre.
- `get_forecasts(keys)`: the cache reads its own clock and never uses a plan's `now` (an update reuses the bundle's old `now`, and a cached row is shared by every user); one query reads rows fresher than 1 h. For the missing keys: reserve that many Open-Meteo calls (6.3), then fetch in batches of **100 locations per request, at most 6 requests at once** **(my call)**: `hourly=wind_speed_10m,rain,showers,snowfall`, `wind_speed_unit=mph`, `precipitation_unit=inch`, `timezone=GMT`, `forecast_days=12` (covers now + 240 h plus the rounding at any time of day; still 1 call per location). Validate with Pydantic: one answer per location, equal array lengths.
- Rows are upserted (`ON CONFLICT DO UPDATE`) **as soon as each batch arrives**, even if a later batch fails. The plan then fails with "Weather service unavailable", but the Retry reuses what was fetched. This is not partial data on screen: the driver sees nothing until the whole plan succeeds.
- **A 429 from Open-Meteo** (for example two large uncached plans from different users in the same minute, or another app on our shared IP) gives back the reservation for the refused batches, since Open-Meteo did not serve them, and ends the plan with `provider_unavailable` **(my call)**. A per-minute counter of our own is not built (YAGNI); Retry is cheap because the served batches are cached.
- **A missing value (null) inside the window** is treated as `provider_unavailable` and sent to Sentry, never filled in (Rule-10) **(my call)**.
- **Phases (my call):** with 3 or fewer routes, checkpoint and heatmap cells go in one call to `get_forecasts`. With more than 3, the Checkpoints are fetched and ranked first, then the heatmap for the shown 3 (one more round, about 1 s).

### 6.9 Risk engine (spec 8)

`rate(wind_mph, rain_in, snow_in, load_lb)`:

1. **Raw values, shown in full (user):** the rules run on the values exactly as Open-Meteo sends them: wind to 0.1 mph, rain and snow to 0.001 in/hr (rain + showers is summed as decimals, so no float noise is added). The API returns these same values and the browser shows them at that precision (design 8.7), so the screen never contradicts the band: 24.6 mph is shown as "24.6 mph" and rated Low. Step-10 confirms Open-Meteo's precision on a real answer; the display uses exactly that precision.
2. Wind, rain and snow levels from the spec 8.2 bands (edges go to the higher band; rain and snow No Travel are strict ">").
3. Load rules raise the wind level only (spec 8.3, strict ">" on load).
4. Level = the highest of the three. `causes` = every condition at that level (wind, rain, snow, in that order), `load_rule` = a load rule raised the wind level and wind is a cause.
5. **Low names no cause (user):** when the level is Low every condition ties, so `causes` is empty and the UI shows only "Low" (design 8.4).

Checkpoints, heatmap cells and ranking all call this one function. The browser never rates anything.

### 6.10 Route numbers, ranking and recommendation (spec 9)

- Per route: miles per level, no-data miles, average risk over Checkpoints with data (spec 9.2).
- Sort key (spec 9.3), values rounded first (miles 0.1, average 0.01, travel time to the minute):
  `(has No Travel, No Travel miles if any else 0, Severe miles, High miles, average risk, travel minutes)`, stable, so full ties keep the stored order (6.4).
- **"has No Travel" (Step-9, user):** true when any Checkpoint with data is No Travel, tested on the raw covered miles, never the rounded ones. Example: a destination Checkpoint covering 0.02 mi at No Travel makes the route "Not recommended". The API sends miles at 0.01, and the browser shows a value between 0 and 0.1 as "under 0.1 mi" (design 8.3).
- **Empty average risk:** it is empty only when no Checkpoint has data, and since every route starts at the same departure, that happens to all routes at once. It is compared as 0, so it never decides the order **(edge reading)**.
- Keep the top 3. Rank labels 1st, 2nd, 3rd. "Recommended" on the best route with 0 No Travel miles; "Not recommended" on each route with No Travel miles; `do_not_travel` when every shown route has No Travel miles (spec 9.4).

### 6.11 Heatmap (spec 10, design 8.5)

- Corridor: sample each shown route every 1 km, take the cells those samples fall in, add one ring of cells around them (user, Step-7), at the cell size from 6.5.
- Hours: hour `h` = departure + h hours, h = 0..48; its forecast hour is rounded as in 6.7. Past the window: `in_window = false` and `lv` is `"-"` for that hour in every cell.
- Each cell and hour gets `rate(...)` with the trip's load (spec 10: load rules included). `lv` and `cz` are encoded as in 4.1 (about 45 KB for 300 cells).
- `heatmap = null` when hour 0 is already past the window.

### 6.12 Truck positions (spec S-2)

For every shown route and h = 0..48: wall time = departure + h hours; turn it into driving seconds with the HOS timeline (still during a stop), then into a position on the `RouteTrack`. `status` is `driving`, `break`, `rest` or `arrived`. 49 small objects per route; the slider only reads them.

### 6.13 Route bundle (tech-stack 12b)

- Content: version, user ID, the plan's `now` (6.7), origin and destination (label, lat, lon, tz), departure UTC, load lb, and **every kept route** (at most 3 since Step-10; an interval or HOS change can still reorder them): source, order, and the `RouteTrack` simplified with Douglas-Peucker at **20 m**, stored as an encoded polyline (precision 5) plus delta-encoded metres and seconds **(my call)**. 20 m is far finer than anything the rules need (weather cells are 11 km) and invisible on the map at route zoom.
- Signed and compressed with `signing.dumps(..., salt="route-bundle", compress=True)`. **Measured in Step-10** on the real Chicago-Dallas answer (6 routes, 972-1,197 mi, 87,920 raw points): **63 KB at 20 m** with metres and seconds for every kept point (40 KB at 50 m). With at most 3 routes a bundle is about 30-60 KB, so 20 m stays.
- **The plan itself is built from the bundle's simplified tracks**, not TomTom's raw points, so a plan and an update with the same settings give the same numbers.
- No expiry **(my call)**: routes don't go bad on their own; what does is the departure time, which 6.14 re-checks.

### 6.14 Update (`POST /api/plans/update`, spec 7.1, 7.3, design F6)

1. Verify the bundle (signature, version, user ID matches the session); else `invalid_bundle`.
2. Departure still at or after now minus 60 s; else `departure_passed`.
3. Run 6.5 to 6.13 again with the new interval and HOS on the bundle's tracks, with the bundle's `now` (6.7). The weather values come from the cache, refreshed when a row is over 1 h old, so they are always current.
4. Not counted toward the user's plan limits (spec 4). Instead, step 1 is followed by recording an `update` event under the 120-per-rolling-hour cap, with the same locked transaction as 6.2; at 120, `rate_limited` (Step-9). A `departure_passed` or `invalid_bundle` answer deletes that event. Provider budgets still apply to new weather fetches. Repeating updates within an hour costs nothing, because the cells are cached.

### 6.15 Time budget for one plan (spec 12: 10 s for 95%)

| Part                                                | Typical                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Function start (warm / cold)                        | 0.05 / 1.5 s                                                                       |
| Input, limits, DB                                   | 0.1 s                                                                              |
| TomTom main call (2 alternatives)                   | 1.5-4 s (measured from `iad1`: 3.7 s Chicago-Dallas; a 250 mi trip is about 1.5 s) |
| Detour round (only with fewer than 3 routes)        | about 3 s (measured: 3.1 s for Waypoint + 1 alternative)                           |
| Weather (uncached, batches in parallel)             | 1-2 s; cached: 0.05 s                                                              |
| Rules, bundle, JSON                                 | 0.2-0.5 s                                                                          |
| **Usual long trip**                                 | **about 6 s**                                                                      |
| **Worst usual case (detour round, nothing cached)** | **about 9.5 s**                                                                    |

Step-10 measurements (2026-11-01, Vercel `iad1` to TomTom `eastus`): 5 alternatives took 9.2 s, 2 took 3.7 s, 0 took 1.1 s. TomTom's computing time, not the download, is the cost, so `routeRepresentation` doesn't change it.

Each plan logs these timings (no trip inputs) so Step-12 can check the target.

---

## 7. Limits on place search

`GET /api/places` records a `search` event and checks 300 per rolling hour (same transaction pattern as 6.2, and the same clean-up of the user's events older than 24 h), then reserves 1 Geoapify call. The browser waits for a 250 ms pause and caches each query (design 4.2), so a typed city costs 2-4 calls.

---

## 8. Place search (`GET /api/places`)

- Geoapify Autocomplete: `text=q`, `filter=countrycode:us,ca`, `limit=5`, `lang=en`, `format=json`. Validated with Pydantic.
- For each result the server finds the zone with timezonefinder and builds `token = signing.dumps({id, label, lat, lon, tz}, salt="place")` **(my call: the signed place token)**. The browser shows `label`, uses `tz` for the departure field (design 4.2 DepartureField), and sends back only the token.
- Why a signed token: the server must reject places outside the region (spec 11) without a second Geoapify call, and it must never trust coordinates from the browser.
- Empty list = "No places found in the US or Canada" (design 8.6).
- **Choose on map (Step-14b):** `GET /api/places/reverse?lat=&lon=` checks the point is on the globe (422 otherwise, not counted), records a `search` event (the same 300 per hour), reserves 1 Geoapify call and asks Geoapify Reverse Geocoding (`lat`, `lon`, `lang=en`, `format=json`). The first result in the US or Canada with a zone becomes the same signed token as a search result: `{"place": {label, tz, token}}`, or `{"place": null}` at sea or outside the region. The browser sends the clicked point (5 decimals), never a place it made up, so the plan still trusts only the server's signature. Frontend: `usePlacePick` (lookup, Esc), `useMapPick` (crosshair, click), `MapPickBar` (prompt and states).

---

## 9. Sign-in, sessions and CSRF (tech-stack 9)

- **CSRF:** `CSRF_COOKIE_HTTPONLY = True`, `CSRF_COOKIE_SAMESITE = "Lax"`, `CSRF_COOKIE_SECURE` and `SESSION_COOKIE_SECURE` on Vercel. Behind Vercel's proxy Django must know the request was HTTPS, or its Origin check refuses every POST: `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` and `CSRF_TRUSTED_ORIGINS` from the env (Step-9). `GET /api/csrf` returns `get_token(request)`; the browser keeps it in a module variable (memory only) and sends `X-CSRFToken` on every POST.
- **Sign-in:** the sign-in pop-up on the planner (Step-14) loads Google Identity Services and renders Google's button (design 7). Its callback gets an ID token (`credential`) and POSTs it to `/api/auth/google`. The server checks it with `google.oauth2.id_token.verify_oauth2_token` against `GOOGLE_CLIENT_ID` (signature, audience, expiry, issuer) and requires `email_verified`. It then finds or creates the user by `sub` (updating name and email) and calls `login()`, which creates a new session key and a new CSRF token. **The browser fetches `/api/csrf` again after sign-in and sign-out.**
- **Session:** Django database sessions, HttpOnly, SameSite Lax, 14 days (Django's default) **(my call)**. **Step-9 (my call):** the session model adds a `user_id` column, using Django's documented "extending database-backed session engines" pattern (`AbstractBaseSession` + a `SessionStore` subclass), so "Delete my account" removes every session of the user with one `DELETE ... WHERE user_id = ?` instead of decoding every row.
- **Google certificates (Step-9, my call):** Google's public signing certificates are cached per process for the lifetime Google's cache headers give, so a sign-in doesn't fetch them each time. This is a cache of public data, not shared state; a cold process just fetches again.
- **Sign-out:** POST `/api/auth/sign-out` calls `logout()` (design F11).
- **Delete account (Step-9, user, design F13):** POST `/api/account/delete` (session + CSRF) runs in one transaction: delete the user's sessions, delete the user (their `usage_event` rows go by cascade), then `logout()`. Signing in again later creates a new user.
- **API docs (Step-9):** Django Ninja's `/api/docs` page is on only when `DEBUG` is on.
- **Guards:** `/api/me` answers 401 when signed out. The planner page calls it on load: a 401 there shows the sign-in pop-up with no message (first visit, spec 11); a 401 from any later call adds `?ended=1` to the same page, and the pop-up shows "Your session ended. Sign in again." (design F12). The pop-up cannot be closed (Step-14).
- `google-auth` does not install `requests`, so its certificate fetch goes through a small httpx-based transport in `providers/google.py` (httpx is already in the stack; Step-11 slice 4).

---

## 10. Monitoring

- **Sentry (backend):** `sentry-sdk` with `send_default_pii=False` and a `before_send` that drops request bodies, cookies, headers and query strings (spec 12). Provider failures are reported with the service name and HTTP status only.
- **Keys in provider URLs:** TomTom (`key`) and Geoapify (`apiKey`) take their keys as query parameters, and httpx puts the full URL in its exception text. So (a) each provider module catches every httpx error and raises our own `ProviderUnavailable(service, status)` with no URL in it (`raise ... from None`), (b) Sentry's `before_breadcrumb` strips the query string from every HTTP breadcrumb and `before_send` strips query strings from any URL in exception values, and (c) no code logs a provider URL. A test makes a provider call fail and checks that the key appears in no Sentry event or log line.
- **Sentry (frontend):** `@sentry/react`, error boundary (design 9) reports; `beforeSend` drops request data and URLs' query strings. DSN from `VITE_SENTRY_DSN`.
- **PostHog:** `posthog-js` with `VITE_POSTHOG_KEY`, its own anonymous ID only, autocapture off **(my call: autocapture would record typed place names)**. Events (no trip inputs in any property): `plan_requested`, `plan_succeeded` (`route_count`, `fewer_routes`, `do_not_travel`, `duration_bucket`), `plan_failed` (`code`, `service`), `plan_updated` (`what`: interval or hos), `units_changed`, `theme_changed`, `slider_used` (once per plan), `checkpoint_opened`, `signed_in`, `signed_out`.

---

## 11. Security summary

| Threat                     | Defence                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key theft from the browser | Every key is a server env variable. The browser build has only `VITE_GOOGLE_CLIENT_ID`, `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY` (public by design).                                                                                                                                                                                                                                                                                        |
| Session theft by script    | Session and CSRF cookies are HttpOnly; the CSRF token lives only in memory.                                                                                                                                                                                                                                                                                                                                                              |
| Cross-site requests        | CSRF header on every POST; SameSite Lax cookies; one address, so no CORS is enabled.                                                                                                                                                                                                                                                                                                                                                     |
| Fake places or routes      | Places and route bundles are signed by the server and checked on every use; a bundle is bound to its user.                                                                                                                                                                                                                                                                                                                               |
| Input abuse                | Pydantic plus the rules in 6.1; the server decides everything.                                                                                                                                                                                                                                                                                                                                                                           |
| Quota draining             | Per-user limits (6.2, 7) plus app-wide provider budgets (6.3).                                                                                                                                                                                                                                                                                                                                                                           |
| Provider text as HTML      | Place labels and every provider string render as React text only, never `dangerouslySetInnerHTML`, and MapLibre popups hold React components, not HTML strings.                                                                                                                                                                                                                                                                          |
| Secrets in errors          | Sentry scrubbing (10); logs carry codes and timings only.                                                                                                                                                                                                                                                                                                                                                                                |
| Security headers           | Vercel headers for the static files: `Content-Security-Policy` (self, plus the Google Identity, OpenFreeMap, Sentry and PostHog hosts; `worker-src 'self' blob:` (MapLibre's worker file, Step-14) and `img-src data: blob:` for MapLibre; the inline theme script allowed by its sha256 hash, Step-9), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`. Django's `SecurityMiddleware` with HSTS for `/api`. **(my call)** |

---

## 12. Frontend architecture

Looks, layout, copy and states are design 2-11. This section is only the wiring.

### 12.1 Source layout

```
src/
  main.tsx              client entry: hydrateRoot when #root has prerendered markup, else createRoot
  entry-prerender.tsx   render(url) with react-dom/server for "/guide" and "/privacy"
  app/                  router.tsx, AppProviders (QueryClient, Toast, theme, units), ErrorBoundary
  styles/               tokens.css (UIi 2.2 + design 3.2-3.4), base.css
  components/ui/        the UIi set (design 4.1)
  components/           app components (design 4.2), all pure: data in through props, actions out through callbacks
  pages/                Landing/, SignIn/, Planner/, NotFound/
  features/planner/     hooks and the planner reducer (12.4)
  map/                  PlannerMap.tsx, useMapLibre.ts, layers/ (routes, heatmap, checkpoints, markers), mapTheme.ts
  lib/                  api.ts, constants.ts, units.ts, time.ts, polyline.ts, storage.ts, analytics.ts
```

### 12.2 Pages, prerender and hydration (design 15)

- `vite build` makes the client bundle; `vite build --ssr src/entry-prerender.tsx` makes the prerender bundle; `scripts/prerender.mjs` calls `render("/guide")` and `render("/privacy")` and writes `dist/guide/index.html` and `dist/privacy/index.html` from the template. The untouched template stays as `dist/index.html` (the planner's CSR shell, served at `/`), with copies at `dist/plan/index.html` and `dist/app.html` (Step-14).
- Vercel routes: `/` and `/plan` serve the CSR shell; `/guide` and `/privacy` serve their prerendered files. Other paths get Vercel's plain 404 (a Vercel Services rewrite ignores `destination.path`, Step-13).
- **Whole-page hydration (my call):** the guide and privacy pages hydrate as one React tree, so their interactive parts (hue physics, FAQ wheel, track focus, phone menu) just work. No islands framework. Prerendered output must not depend on the browser: storage, `window` sizes and `matchMedia` are read in effects only.
- The theme is set by an inline `<head>` script on `<html>` before paint (design 3.5); the toggle's icon comes from the `dark:` variant, so hydration never mismatches.
- **Code splitting:** the Planner page is `React.lazy`, so MapLibre (about 230 KB gzip) loads only on the planner. Google's script is added only by the sign-in pop-up. MapLibre's worker file is bundled as an asset and set with `setWorkerUrl` (MapLibre 6 otherwise looks for it next to its own module, which the bundle does not ship; Step-14 fix).
- **Budgets (my call), checked in CI with a size check on `dist`:** the landing chunk at most 150 KB gzip on its own; the sign-in and main chunk at most 150 KB gzip; the planner chunk at most 350 KB gzip including MapLibre; CSS at most 40 KB gzip.

### 12.3 API client and server state

- `lib/api.ts`: one `request()` that adds the CSRF header to POSTs, parses the error shape (4.2), retries once on `csrf_failed` after refetching the token, and on `not_signed_in` after load adds `?ended=1` to the page, which reopens the sign-in pop-up.
- TanStack Query hooks (all in `features/` or `hooks/`, never in components):

| Hook                           | Wraps                    | Notes                                                                                                                                                  |
| ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useSession()`                 | GET `/api/me`            | `staleTime` 5 min; drives the planner guard and the account menu                                                                                       |
| `useSignIn()` / `useSignOut()` | auth POSTs               | refetch CSRF, reset the query cache on sign-out                                                                                                        |
| `usePlaceSearch(query)`        | GET `/api/places`        | enabled at 2+ characters, 250 ms debounce, `staleTime: Infinity` (cache per query), aborts outdated requests through the query's `signal` (design 4.2) |
| `usePlanTrip()`                | POST `/api/plans`        | mutation; holds an `AbortController` for Cancel                                                                                                        |
| `useUpdatePlan()`              | POST `/api/plans/update` | mutation; on error the reducer restores the old setting (design F6)                                                                                    |

### 12.4 Planner state (design 8.6)

One reducer in `features/planner/usePlanner.ts`, used by the Planner page, which passes slices down as props:

```
form:      origin {label, tz, token} | null, destination, departureLocal, load {value, unit}, interval, hos
plan:      Plan | null              // the last good answer
status:    empty | planning | results | updating | error | no_route | limited
message:   error code + service + retry_after_min, or a notice
selection: routeId, checkpointN | null
view:      hour (0-48), showHeatmap, panelOpen, sheet (peek | half | full), tab (routes | checkpoints)
```

Every design 8.6 state is a value of `status` plus `plan.notices`: Do not travel and Fewer than 3 routes are `results` with a notice; Update failed and Departure passed are `results` plus a toast or message. The reducer is unit tested per transition. Smaller hooks: `useForecastSlider` (keys, value text), `useBottomSheet` (drag, snap, keyboard), `useDepartureDefault` (next quarter hour in the origin's zone via `Intl` parts, design 4.2), `useUnits` and `useTheme` (`tp-units`, `tp-theme` in `localStorage`, try/catch on every access, design 3.5).

When a new plan arrives, `selection.routeId` is the Recommended route, else the 1st best (design 8.3), and `hour` resets to 0. When an update arrives, `routeId` and `hour` stay (route IDs are stable within a bundle) unless that route left the top 3, in which case the Recommended route (else the 1st best) is selected; `checkpointN` is cleared (design F6, Step-9).

The form keeps the load as typed (`load {value, unit}`); the units toggle changes only the shown number (design 4.2 LoadField, Step-9).

### 12.5 Map (design 8.5)

- `PlannerMap` is a component with props only (plan, routeId, checkpointN, hour, showHeatmap, theme, padding, callbacks). Inside, `useMapLibre` creates the map once; one hook per layer group syncs props to the map:
  - **routes:** one GeoJSON source with every shown route (decoded `line`); the selected one is drawn by a filter on `routeId`, so switching is one `setFilter` call.
  - **heatmap:** one GeoJSON source of cell squares built once per plan, each with its `lv` string. The fill color is a `match` on `["slice", ["get", "lv"], hour, hour + 1]`, so a slider move is one `setPaintProperty` call and no request (spec 12: 100 ms).
  - **checkpoints:** a circle + symbol layer over all shown routes' Checkpoints, filtered to the selected route.
  - **markers:** origin, destination, truck (position from `route.truck[hour]`) and route chips (HTML markers, design 8.5).
- Theme change: `setStyle` to the other OpenFreeMap style, then the layers are added again on `style.load` (design 3.5). `mapTheme.ts` holds paint colors per theme (design 3.3).
- Fit: `fitBounds` with padding for the panel or the sheet, animated except under reduced motion.
- Popups (checkpoint detail, cell tooltip) are MapLibre Popups whose content is a React root (`createRoot` into the popup's element), so provider text stays plain text.

### 12.6 Times and units in the browser

- `lib/time.ts`: format a UTC time in a given IANA zone ("Tue, Nov 3 · 3:40 PM CST") with `Intl.DateTimeFormat("en-US", …)`; "now in a zone" for the departure field's `min` and the past-time check. No date library (tech-stack 3).
- `lib/units.ts`: display conversions and formats (design 8.7), pure and unit tested. Values sent to the server stay imperial, except the load, which goes with its unit (6.1).
- `lib/polyline.ts`: decode the encoded polyline (about 20 lines, tested against backend output).

---

## 13. Testing (CLAUDE.md, tech-stack 14)

- **Backend, test first:** every `planning/` module with table tests, including the spec 13 worked example end to end (average risk 1.50, ranking B, A, C), the spec 7.3 HOS example, band edges, load rules, covered miles, the ladder, shared road and backtrack, cell sizing (6.5 table), the window edge and the half-hour rounding.
- **Providers:** saved real responses in `tests/fixtures/` (recorded in Step-10/11), served through httpx's built-in `MockTransport` (no extra library). Tests cover invalid answers, timeouts, "no route" and budget refusal.
- **API:** pytest-django tests for each endpoint: sign-in (Google check mocked at the `google.py` boundary), CSRF refusal, limits (30th and 31st plan, refunds), signed tokens and bundles (tampered, other user), update refusal after departure.
- **Contract:** backend tests write a few real-shaped `Plan` answers to `frontend/src/test/fixtures/*.json`; frontend tests read them, so a shape change on one side breaks the other's tests **(my call)**.
- **Frontend:** Vitest + Testing Library for the reducer, hooks, formatters and every component state; the token contrast and style guard tests (design 3.2, 11).
- **End to end (Playwright), every flow F1-F12 at 390 px and 1280 px, both themes, with axe (design 11):** the browser side is the production build served by `vite preview` with the `vercel.json` CSP header (Step-14: a missing MapLibre worker file broke only the build), with the analytics keys blanked. Django runs with `E2E_MODE=1`, which (a) adds `POST /api/test/sign-in` to create a session for a test user, and (b) serves providers from the saved fixtures. **Settings refuse to start with `E2E_MODE` when `DEBUG` is off or on Vercel**, so this can never reach production **(my call)**. Real-provider checks happen by hand with Claude-in-Chrome in Step-12 and Step-14.

---

## 14. Configuration (`.env.local`, listed in `.env.example`)

Server: `DJANGO_SECRET_KEY`, `DATABASE_URL` (Neon pooled), `DATABASE_URL_UNPOOLED` (Neon direct, migrations only, used from this PC), `GOOGLE_CLIENT_ID`, `TOMTOM_API_KEY`, `GEOAPIFY_API_KEY`, `SENTRY_DSN`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DEBUG`. Browser (`VITE_`): `VITE_GOOGLE_CLIENT_ID`, `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`. Open-Meteo and OpenFreeMap need no key. Setup steps go in `docs/api-setup-guide.md` as each service is added (Rule-14).

---

## 15. Feature map (where each spec item is built)

| Spec                             | Backend        | Frontend (design)     |
| -------------------------------- | -------------- | --------------------- |
| 4 Access, limits                 | 6.2, 6.3, 7, 9 | design 7, F11, F12    |
| 5 Inputs                         | 6.1, 8         | design 8.2            |
| 6 Routes                         | 6.4            | design 8.3, 8.5       |
| 7 Checkpoints, ETAs, HOS, window | 6.5-6.7        | design 8.4            |
| 8 Weather and risk               | 6.8, 6.9       | design 3.2, 8.4       |
| 9 Ranking, recommendation        | 6.10           | design 8.3            |
| 10 Map, heatmap, slider, truck   | 6.11, 6.12     | design 8.5, 12.5 here |
| 11 Errors                        | 4.2            | design 8.6            |
| 12 Speed, security               | 6.15, 11       | 12.2 budgets, 12.5    |

---

## 16. Changes this architecture made in other docs (approved and applied 2026-11-01)

1. **spec 7.1 and 10, tech-stack 12, design 8.5** (user: size to fit): each plan uses at most 500 weather locations; heatmap cells are 55 km, or 110 km or 220 km when the trip needs it, and the corridor (route cells + 1 ring) widens with them (about 165, 330 or 660 km); an interval whose Checkpoints don't fit is greyed out, and 50 mi is always allowed.
2. **design 4.2 TripSettings and 8.2 "More options":** greyed interval options carry the reason "(too many checkpoints for this trip)". When a requested interval is raised (6.5 step 4), an info StatusMessage says: "10 mi needs too many checkpoints for this trip. Using 25 mi."
3. **spec 8.4, design 8.4:** a Low Checkpoint shows only the "Low" badge, with no "set by" text (6.9 step 5).
4. **design F6:** an `invalid_bundle` answer shows the toast "This plan can't be updated. Plan the trip again."
5. **spec 8.2 and 8.5, design 8.4 and 8.7** (user: raw values, shown in full): the rules run on the forecast values as received; wind is shown to 0.1 mph (and 0.1 km/h), rain and snow to 0.001 in/hr.

---

## 16a. Step-9 changes (approved and applied 2026-11-01)

User decisions: update cap 120 per user per rolling hour (4, 6.14); long waits as "14 h 5 min" (4.2); load kept as typed (4.1, 12.4); any No Travel Checkpoint counts and miles sent at 0.01 for "under 0.1 mi" (4.1, 6.10); route and slider hour kept after an update (12.4); `/privacy` page and account deletion, with a session table that carries `user_id` (3, 4, 9, 12.2, slices 4, 10, 16); metric rain and snow at 2 decimals (slice 15). Fixes: detour tests on raw points and a speed test (6.4, slice 6); the Sentry key-leak check moved to slice 17; Django behind Vercel's proxy, Neon pooler cursors and migrations (3, 9, 14); CSP for MapLibre and the theme script (11); `/api/docs` only in `DEBUG`; clean-up on search and expired sessions (3); Step-10 checks (section 0).

## 16b. Step-10 changes (2026-11-01, from real provider calls)

User decisions: TomTom main call asks for 2 alternatives, so at most 3 routes are kept and the second weather round is gone (spec 6.1, 6.2; 6.4, 6.5, 6.13, 6.15, slice 5); one retry after 0.3-0.6 s on a TomTom 429 (6.4, 17.3). Measured facts: alternatives work with a Waypoint (6.4 step 3); a `departAt` 400 days ahead works, so no fallback is needed; TomTom's "no route" is HTTP 400 with `detailedError.code = "NO_ROUTE_FOUND"`; TomTom's `progress` has a point about every 100 route points, so seconds are filled in by distance (tech-stack 10); bundle 63 KB for 6 routes at 20 m (6.13); Open-Meteo wind 0.1 mph, rain and showers in 0.004 in steps, snowfall in 0.028 in steps, all at most 3 decimals in inches; Django sees the full `/api/...` path behind Vercel Services; TomTom timeout 8 s (17.3). Saved real answers: `backend/tests/fixtures/` (TomTom gzipped).

## 17. My calls (review these)

1. Region US East for the function and Neon; 30 s max duration.
2. Sync Django views; parallel provider calls with `httpx.AsyncClient` in one `asyncio.run`.
3. Timeouts (TomTom 8 s, Open-Meteo 6 s, Geoapify 3 s, Google 5 s), no automatic retries except the one TomTom retry on a 429 (6.4, Step-10, user). TomTom went from 6 s to 8 s in Step-10: LA to New York with 2 alternatives took 4.7 s of TomTom computing.
4. A plan that fails at a provider is not counted (like a budget block); `no_route` is counted; Cancel doesn't refund.
5. "100 per day" is a rolling 24 h.
6. Signed place tokens prove a place came from our US/Canada search.
7. Same place = same Geoapify ID or under 0.5 km apart.
8. Departure grace of 60 s; DST gaps and overlaps read with `fold=0`.
9. TomTom `departAt` with its default traffic setting (typical speeds for that day and hour); `now` when the departure is under 1 minute away.
10. Detour details: Waypoints dropped when outside the US/Canada zone list; `maxAlternatives=1` on detour calls; a failed detour call fails the plan; backtrack and shared-road thresholds (100 m samples, 25 m match, 1 km).
    10a. A 429 from Open-Meteo gives back that batch's reservation; when even 50 mi doesn't fit, the heatmap drops its ring.
11. ETA at a Checkpoint placed exactly at a stop is the arrival time before the stop.
12. Weather fetch: 100 locations per request, 6 at once, `forecast_days=12`, rows cached as each batch arrives; a null inside the window is a provider failure.
13. The route bundle carries all kept routes (at most 3, Step-10) and the plan's `now`, simplified at 20 m; the plan is built from it too, and the drawn line is the same track; no expiry.
14. Zone abbreviations come from the browser's `Intl`.
15. Whole-page hydration of the SSG pages; JS size budgets.
16. 14-day sessions; signed-out first visit to `/plan` redirects without a message.
17. PostHog autocapture off; the event list in 10.
18. Contract fixtures shared from backend tests to frontend tests.
19. `E2E_MODE` test sign-in and fixture providers, refused outside local debug.
20. Security headers and CSP (11).
21. Clean-up of old rows inside requests, no cron; no Django admin.
