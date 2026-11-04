# Truck Pilot

Weather-aware truck routing: helps a truck driver choose the safest route based on weather, load weight and travel time.

> The full README (what is built, how to run it locally, how AI was used) is written in Roadmap Step-15. Trade-offs are recorded here as they are decided.

## Run it locally (foundation, Step-10)
Needs Node 24, uv (Python 3.12) and the accounts in `docs/api-setup-guide.md`.

1. Copy `.env.example` to `.env.local` and fill it in (`docs/api-setup-guide.md` says where each value comes from).
2. Backend: `cd backend`, `uv sync`, `uv run pytest`, then `uv run python manage.py runserver`. The backend tests need a local PostgreSQL 18 and `TEST_DATABASE_URL` in `.env.local` (`docs/api-setup-guide.md` section 10; pytest creates its own `test_` database and the tests refuse a Neon address). Before the first `runserver`, create the tables on Neon with the Migrations command in `CLAUDE.md` (it uses Neon's direct URL from this PC).
3. Frontend: `cd frontend`, `npm install`, `npm test`, then `npm run dev` and open http://localhost:5173 (`/api` is forwarded to Django on port 8000).
4. Or run both as Vercel does: `vercel dev --listen 3000` from the root.

## Trade-offs

### How we count "Severe miles" and "High miles"

**The problem:** the brief ranks routes by "fewest Severe miles" and "fewest High miles". But we only check the weather at **points** along the road (checkpoints, for example every 25 miles), and a point has no length. We need a rule that turns "this checkpoint is Severe" into "this many miles are Severe".

**Our choice:** each checkpoint covers the road **halfway back** to the previous checkpoint and **halfway forward** to the next one.

**Example:** a 100-mile route with checkpoints every 25 miles:

```
Mile:        0 ------- 25 ------- 50 ------- 75 ------- 100
Checkpoint:  A         B          C          D          E
Covers:     0-12.5  12.5-37.5  37.5-62.5  62.5-87.5  87.5-100
Miles:      12.5       25         25         25        12.5
```

If C is **Severe** and D is **High**, the route has **25 Severe miles** and **25 High miles**. All five checkpoints together cover the full 100 miles, so nothing is counted twice or left out.

The first and last checkpoints (the origin and destination) only cover half a stretch, because there's no road before the start or after the end.

### Wind risk uses sustained wind, not gusts

**The problem:** weather forecasts give two wind numbers: **sustained wind** (the steady speed) and **gusts** (short bursts, often much stronger). The brief's wind table (<25 / 25-34 / 35-44 / 45-54 / ≥55 mph) and its load rules don't say which one to use.

**Our choice:** use **sustained wind**, because that is the plain reading of the brief and we follow the brief as written.

**Example:** a checkpoint forecast of 30 mph sustained wind with 48 mph gusts, and a 35,000 lb load:

```
Using sustained (30 mph):  Moderate
Using gusts     (48 mph):  Severe band + load over 30,000 lb  →  No Travel
```

**What we give up:** gusts are what push high-sided trucks over, so a gust-based rule would be more cautious. We accept that to stay faithful to the brief's rules.

### Routes with No Travel miles are never recommended

**The problem:** the brief's recommendation order is fewest Severe miles, then fewest High miles, then lowest average risk, then shortest travel time. It never mentions **No Travel** miles, even though the brief defines No Travel as the worst level. If we followed the list literally, a route with No Travel miles but zero Severe miles could beat a route with a few Severe miles.

**Our choice:** a route with **any** No Travel miles is **never recommended**. It is still shown and ranked, marked **"Not recommended"**. If every route has No Travel miles, no route is recommended and the app shows a clear **"Do not travel now"** warning.

**Example:**

```
Route A:  12.5 No Travel miles,  0 Severe miles,  fastest
Route B:   0 No Travel miles,   25 Severe miles,  20 min slower
```

Following the brief's list literally picks A (0 Severe miles). We recommend **B**, because "No Travel" means the truck should not drive there at all.

**Ranking among No Travel routes:** routes without No Travel miles always rank above routes with them. Routes that do have No Travel miles are ordered by fewest No Travel miles, then by the brief's normal order.

### ETAs include Hours-of-Service breaks by default

**The problem:** the weather at each checkpoint is taken at the time the truck **arrives** there, so the ETA decides which forecast hour we use. By US law (Hours of Service, HOS), a trucker must take a **30-minute break after 8 hours** of driving and a **10-hour rest after 11 hours** of driving. If we ignore those stops, the ETAs on long trips are wrong, and so is the weather we check.

**Our choice:** ETAs **include HOS breaks by default**. A **toggle** turns them off for when the driver only wants the pure driving time between two points.

**Example:** a 900-mile trip at about 60 mph is 15 hours of driving, leaving at 6:00 AM:

```
HOS off:  drive 15 h straight                              →  arrive 9:00 PM same day
HOS on:   drive 8 h       →  2:00 PM   30-min break
          drive 3 h       →  5:30 PM   10-h rest (11 h driven)
          drive 4 h       →  7:30 AM next day                arrive
```

With HOS on, the last checkpoints are checked against the next morning's forecast, not the evening's. If a snowstorm arrives overnight, only the HOS-on plan sees it.

**What we leave out:** the 14-hour on-duty window and the 70-hour/8-day limit. They matter for multi-day planning but not for a single trip's weather timing.

### Each checkpoint uses the forecast for the nearest whole hour

**The problem:** weather forecasts come in whole hours (3:00 PM, 4:00 PM and so on), but the truck reaches a checkpoint at an exact minute, for example 3:40 PM. We need a rule for which forecast hour to use.

**Our choice:** use the **nearest whole hour**. Exactly half past rounds up to the next hour.

**Example:**

```
Truck arrives 3:20 PM  ->  uses the 3:00 PM forecast
Truck arrives 3:40 PM  ->  uses the 4:00 PM forecast
Truck arrives 3:30 PM  ->  uses the 4:00 PM forecast
```

**Why not the alternatives:** taking the hour the ETA falls in (3:40 PM uses 3:00 PM) can be up to 59 minutes off, while the nearest hour is never more than 30 minutes off. Blending the two hours (3:40 PM = 1/3 of 3 PM + 2/3 of 4 PM) would show computed numbers that no forecast actually gave, so the driver could not check them.

### Weather is forecast up to 10 days from now

**The problem:** weather forecasts only reach a limited time ahead, and they count from **now**, not from the trip's departure. A driver can still pick any future departure, and a long trip with Hours-of-Service rests can take several days. Some checkpoints will be reached after the forecast ends.

**Our choice:** we use hourly forecasts up to **10 days from now**. A checkpoint the truck reaches after that shows **"No weather data (more than 10 days ahead from now)"**. Those miles are left out of the Severe, High and average-risk counts, and the route card says how many miles have no data. Trips are never blocked: a departure more than 10 days ahead still gets routes, ETAs and a ranking by travel time, just without weather.

**Example:** today is Nov 1, so forecasts reach Nov 11. A driver departs Nov 9 on a 3-day trip that ends Nov 12:

```
Checkpoints reached Nov 9 - Nov 11   ->  real forecast, risk levels as usual
Checkpoints reached Nov 12           ->  "No weather data", not counted in risk
Route card                           ->  "180 mi have no weather data yet (more than 10 days ahead from now)"
```

**What we give up:** a route whose risky stretch falls after day 10 can rank higher than it would with full data. The route card's warning makes that visible instead of hiding it.

### Why I chose Neon over Supabase for the database:

1) It’s plain Postgres, which is all Django needs. Supabase’s extras (auth, storage, realtime) would go unused because Django already handles that (because the brief asked to use Django.)

2) Free Supabase projects get paused after a week or so of inactivity, which could break the hosted app due to inactivity for some days. Neon just sleeps for a moment and wakes up on the next request (the first one can be a bit slow).

### The app runs on free tiers, so v1 is non-commercial

**The problem:** the budget is small, and Truck Pilot is public, so monthly bills would never stop. Vercel's free Hobby plan and Open-Meteo's free weather API are both for non-commercial use only.

**Our choice:** v1 is **non-commercial** (no ads, subscriptions or paid features), and every service runs on its free tier.

**Example:**

```
Non-commercial:  Vercel Hobby + free Open-Meteo + free TomTom, Geoapify, Neon  ->  $0 a month
Commercial:      Vercel Pro ($20 a month) + paid Open-Meteo                    ->  budget gone in 1-2 months
```

**What we give up:** free tiers have hard limits, so usage is capped (see "Guards that protect the free quotas" below).

### React and Django share one Vercel project and one address

**The problem:** the brief requires React and Django, and sign-in uses an HttpOnly cookie that JavaScript can't read. If the frontend and the API sat on two different `*.vercel.app` addresses, browsers like Safari would treat the cookie as cross-site and block it.

**Our choice:** one Vercel project using **Vercel Services**. The React files come from Vercel's CDN, and every `/api/...` request goes to Django, which runs as one Vercel Function, all on `mytruckpilot.vercel.app`.

**Example:**

```
mytruckpilot.vercel.app/            ->  React (static files from the CDN)
mytruckpilot.vercel.app/api/plans   ->  Django
```

**Why not the alternatives:** Django on Render or Railway sleeps on the free tier, and Render takes about 50 s to wake, which breaks our 10-second target. Two Vercel projects joined by a rewrite also work, but there are two things to deploy.

**What we give up:** Vercel Services is in Beta. We test it first in Step-10, and the two-project rewrite is the fallback.

### Static landing page, browser-rendered planner (no Next.js)

**The problem:** the landing page is public and should load instantly and be findable on Google. The planner sits behind sign-in, is mostly a live map, and every result is personal and fresh.

**Our choice:** React with **Vite**. The guide (landing) and privacy pages are pre-built into plain HTML at build time (SSG). The planner, which opens at `/`, renders in the browser (CSR) and asks Django for JSON.

**Example:** a visitor opening the home page gets one cached HTML file from the CDN with no server work. A signed-in driver loads the planner's JavaScript once, and each "Plan trip" is a single call to `/api`.

**Why not Next.js (SSR):** it adds a second server (Node) next to Django, so there would be two backends to secure and deploy. It could not render the map on the server anyway, because the map needs a browser.

### Map: MapLibre with free OpenFreeMap tiles instead of Google Maps

**The problem:** the map should feel like Google Maps, but every API key must stay on our server, and Google's map key has to sit in the browser. Google Maps also needs a credit card, and its free use is limited to about 10,000 map loads a month.

**Our choice:** **MapLibre GL JS** (open source) with **OpenFreeMap** tiles, which need no key at all. We style the map light and clean, like Google Maps.

**Example:**

```
Google Maps JS:           key in the browser, card on file, ~10,000 free loads a month
MapLibre + OpenFreeMap:   no key, no card, no load limit
```

**What we give up:** it is not Google's own map data, and OpenFreeMap is a community service with no uptime promise. The tile address is a single setting, so switching providers takes a one-line change.

### Truck routes come from TomTom

**The problem:** we need real truck routes in the US and Canada that use the load weight, with alternative routes and detours through waypoints, on a free plan.

**Our choice:** **TomTom Routing API**: truck mode, load weight in kg, up to 5 alternative routes in one call, and travel times along the route for ETAs. 20,000 free calls a month, no card.

**Example:**

```
TomTom:           20,000 free calls a month, no card     ->  about 5,000-20,000 plans a month
HERE:              5,000 free truck calls a month, card   ->  about 1,250-5,000 plans a month
openrouteservice:  alternatives only under ~100 km        ->  can't give 3 routes on a real trip
```

**What we give up:** HERE's truck routing is arguably the strongest, but its free allowance is a quarter of TomTom's and it needs a card.

### Place search comes from Geoapify, not TomTom

**The problem:** suggestions appear while the driver types, so one plan uses about 8 search calls. Using the same vendor as routing would be simpler, but TomTom's free suggest allowance is small.

**Our choice:** **Geoapify** autocomplete, limited to the US and Canada. 3,000 free calls a day, no card, with an attribution link on the map.

**Example:**

```
TomTom Search:  10,000 calls a month   ->  about 1,200 plans a month
Geoapify:        3,000 calls a day     ->  about 11,000 plans a month
```

**What we give up:** one more account and key to manage. OpenStreetMap's Nominatim is free too, but its rules forbid search-as-you-type.

### Weather comes from Open-Meteo, through a shared 1-hour cache

**The problem:** Open-Meteo is the only free provider with 10-day hourly wind, rain and snowfall for both the US and Canada. Its free limit is 10,000 calls a day and 600 a minute, counted per server IP, and every location counts as a call. One plan needs hundreds of locations.

**Our choice:** each weather point snaps to a fixed grid cell (about 11 km for checkpoints). The cell's forecast is kept in Postgres for 1 hour and shared by every user. The data is still real: the forecast models themselves work at 3-13 km.

**Example:** two drivers plan Chicago to Dallas 20 minutes apart. The second plan reuses the first plan's cells and makes almost no weather calls.

**Why we can't forward the driver's IP:** Open-Meteo counts the IP that connects, which is our server's. Its free API has no key, so it has no way to trust a forwarded-IP header, and faking one would break its terms. Calling Open-Meteo from the browser would let a user send us fake weather, and only the server may decide risk.

**What we give up:** other Vercel apps share our server IP, so the limit can run out early. Drivers then see "Weather service unavailable. Retry", never partial results. Open-Meteo's paid plan, with our own key, is the upgrade if usage grows.

### Heatmap cells are about 55 km wide, larger on long trips

**The problem:** the heatmap covers a corridor around all 3 routes, and every cell is one weather call. Fine cells look sharper but cost far more calls. Open-Meteo's free limit is 600 calls a minute, and one plan sends all of its calls within a few seconds.

**Our choice:** heatmap cells about **55 km** (0.5 degrees) wide. Checkpoints keep the finer 11 km cells, because they decide the risk and ranking. Each plan uses **at most 500 weather locations**: on long trips the heatmap cells grow to about 110 or 220 km until the plan fits, and an interval whose checkpoints don't fit is greyed out (50 mi is always allowed).

**Example:** plans with 3 routes, nothing cached:

```
1,500 mi trip, 11 km heatmap cells:   ~2,000 calls + 90 checkpoints  ->  breaks the 600-a-minute cap on the first plan
1,500 mi trip, 55 km heatmap cells:     ~300 calls + 90 checkpoints  ->  fits; about 25 such plans a day, more with the cache
LA to New York (2,800 mi), 55 km cells: ~800 calls + 170 checkpoints ->  would always fail
LA to New York, 220 km cells:           ~130 calls + 170 checkpoints ->  fits (about 300)
```

**What we give up:** a coarser heatmap. A small storm can paint a whole 55 km cell, or a 220 km cell on a coast-to-coast trip. The heatmap shows the area's risk, and the exact risk is on each checkpoint.

### Guards that protect the free quotas

**The problem:** the 30-plans-per-hour limit still lets one user make 720 plans a day. At about 4 TomTom calls each, one user could use up TomTom's 20,000 free monthly calls in about a week and break the app for everyone. Place search had no limit at all.

**Our choice:** per-user caps plus a daily budget for each provider, all counted in Postgres:

```
Per user:      30 plans an hour, 100 plans a day, 300 place searches an hour
Per provider:  TomTom 650 a day, Geoapify 2,900 a day, Open-Meteo 9,500 a day (reset at midnight UTC)
```

**Example:** on a busy day, the 650th TomTom call goes through. The next "Plan trip" shows "Routing service daily limit reached. Try again tomorrow.", and it does not count against that driver's own limits.

**What we give up:** on a very busy day, some drivers are turned away until midnight UTC. That beats one heavy user silently using up the month's quota for everyone.

### Routes travel as a signed bundle instead of being stored

**The problem:** changing the interval or the HOS toggle must reuse the plan's routes without a new routing call, but v1 stores no trip data. The server also can't trust routes the browser sends back, because they could be edited.

**Our choice:** the plan response carries the routes compressed and **signed** with Django's built-in signing. On a change, the browser sends the bundle back, and the server checks the signature before using it.

**Example:** a driver switches the interval from Auto to 10 mi. The browser re-sends about 50-150 KB, the server verifies the signature in a few ms, and only the new checkpoints get weather calls. An edited bundle fails the check and is rejected.

**Why not the alternatives:** keeping the routes in the database for 2 hours would break the "no trip data stored" promise. A new TomTom call on every change would spend routing quota.

**What we give up:** a slightly bigger request on each change.

### Sign-in: Google's button plus Django's own session

**The problem:** we need Google sign-in, but no token may live where JavaScript can read it.

**Our choice:** Google's official **Sign in with Google** button returns a one-time ID token. Django checks it with Google's `google-auth` library and then sets its own **HttpOnly** session cookie.

**Example:** after sign-in, the browser holds only a session cookie that JavaScript cannot read. A malicious script injected into the page could not copy it.

**Why not the alternatives:** django-allauth works well but is much larger than we need. Hosted services like Clerk keep their tokens in browser JavaScript.

### The API layer is Django Ninja, not Django REST Framework

**The problem:** every driver input must be checked on the server, and every provider response must be validated before use.

**Our choice:** **Django Ninja**, which uses Pydantic models. One tool checks inputs, validates TomTom, Geoapify and Open-Meteo responses, and generates the API docs.

**Example:** a request with a 90,000 lb load is rejected by the input model before any code runs. A TomTom response missing its route points fails validation and shows "Routing service unavailable. Retry" instead of a broken map.

**What we give up:** Django REST Framework is more widely known, but it is heavier, built around database models we mostly don't have, and has no Pydantic validation.

### The heatmap is drawn with MapLibre's own layers, all 49 hours at once

**The problem:** moving the 0-48 h slider must update the heatmap within 100 ms.

**Our choice:** the plan response carries all 49 hours of heatmap cells at once. Moving the slider only changes which hour the map colors by. There is no new request and no extra library.

**Example:** dragging from hour 3 to hour 4 recolors the cells in one frame.

**What we give up:** a bigger plan response up front. deck.gl could draw fancier effects, but it adds about 400 KB of JavaScript for something MapLibre already does.

### Time zones are looked up offline

**The problem:** every ETA is shown in the local time of its own place, including checkpoints past the 10-day forecast window, for which we make no weather call.

**Our choice:** **timezonefinder**, an offline Python lookup from map position to time zone, plus Python's built-in `zoneinfo`. All times are computed in UTC and converted only for display.

**Example:** a route from Chicago (CST) to Indianapolis (EST) shows each checkpoint in its own zone, and none is ever off by an hour.

**Why not the alternatives:** Open-Meteo's time zone answer only covers points we fetch weather for, and Google's Time Zone API needs a card.

### Forged requests are blocked with a CSRF token kept only in memory

**The problem:** the sign-in session is a cookie, and the browser sends it with every request to our address, even one fired by another website. A malicious page could make a signed-in driver's browser send "Plan trip" requests, using up their 30 plans an hour and our free provider quotas. Django blocks this with a CSRF token, but by default it puts that token in a cookie JavaScript can read, which our secrets rule bans.

**Our choice:** Django's CSRF check stays on, with the CSRF cookie set to **HttpOnly** too. The React app asks `/api/csrf` for the token once, keeps it only in memory, and sends it in an `X-CSRFToken` header on every request that changes something.

**Example:** a fake site posts to `/api/plans` while the driver is signed in. The session cookie goes along, but the fake site has no token, so Django answers 403 and no plan runs.

**What we give up:** one small extra call when the planner loads, and about 10 lines of code. Relying only on the browser's SameSite cookie rule would be simpler, but it would switch Django's own check off and leave the app depending on browser behaviour alone.

### The free database runs only part of the day

**The problem:** Neon's free plan gives 100 compute-hours a month. At its smallest size that is about 400 hours awake. The database sleeps after 5 idle minutes, but if visits keep it awake all day (about 720 hours a month), the hours run out and Neon suspends it until next month, which takes the app down.

**Our choice:** keep Neon Free, size the app so it sleeps between visits, and watch its usage page after launch (Step-14). If real traffic grows, Neon's paid Launch plan is the upgrade, with the owner's approval.

**Example:** 30 visits an hour from 7 AM to 8 PM, with quiet nights, keeps the database awake about 13 hours a day, which is about 400 hours a month: right at the limit. A quieter day uses far less.

**What we give up:** an always-awake database. In exchange v1 costs nothing, and the switch to a paid plan changes no code.

### TomTom is asked for 2 alternative routes, not 5

**The problem:** a plan must show results within 10 seconds. TomTom can return up to 5 alternative routes in one call, but its computing time grows with each one. Measured from our Vercel region on Chicago to Dallas (973 mi), 5 alternatives took 9.2 s, before any weather was fetched.

**Our choice:** ask for **2 alternatives**, so TomTom returns exactly the 3 routes the app shows. When it finds fewer, our detour round fills the gap as before.

**Example:**

```
Chicago -> Dallas, truck, 30,000 lb      TomTom time   Whole plan (approx.)
5 alternatives (6 routes)                 9.2 s         about 11 s  -> misses 10 s
2 alternatives (3 routes)                 3.7 s         about 6 s
LA -> New York, 2 alternatives            4.7 s         about 7 s
```

**What we give up:** we rank 3 candidate routes instead of up to 6, so a much longer 4th to 6th route is never considered. On Chicago to Dallas those were 1,145-1,197 mi against 973 mi for the fastest, so they would rarely win. It also means fewer weather calls per plan.

### "Choose on map" asks the server for the address

**The problem:** drivers want to tap a spot on the map instead of typing a city. But the server only trusts places it looked up and signed itself; if the browser could send raw coordinates, anyone could plan from a made-up point outside the US and Canada.

**Our choice:** the browser sends only the tapped point. The server checks it, asks Geoapify for the address (reverse geocoding, same free key), keeps it only if it is in the US or Canada, and returns the same signed place token that a typed search gives. Each tap counts as one place search toward the 300-an-hour limit and the Geoapify daily budget.

**Example:**

```
Tap near Joliet, IL       -> "1 West Jefferson Street, Joliet, IL 60432, USA"  (signed, plannable)
Tap in the Atlantic       -> no place: "Pick a point in the US or Canada."
Tap 301 in one hour       -> the place-search limit message, no Geoapify call
```
