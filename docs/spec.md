# Truck Pilot - Spec

This is the single source of truth for **what** Truck Pilot does. It replaces `docs/requirements.md` (kept as an archive) and `docs/fs-assessment-spotter.pdf` (the brief). Later docs decide **how**: `tech-stack.md` (Step-5), `design.md` (Step-7, frontend), `architecture.md` (Step-8).

IDs: `R-x` and `P-x` come from `requirements.md` and keep their numbers. `S-x` were decided in Step-2 (2026-11-01). Section 14 maps every ID to its section here.

---

## 1. Purpose and priorities

Truck Pilot helps a truck driver in the US or Canada choose the safest route for a trip, based on **weather, load weight and travel time**. The driver enters origin, destination, departure time and load weight. The app returns up to 3 real truck routes, checks the forecast at checkpoints along each route at the time the truck will be there, rates the risk, and recommends one route.

**Grading weights from the brief, used to set priorities:**

| Weight | Area |
|---|---|
| 40% | Routes, weather, risk and recommendation logic |
| 40% | UI, map and heatmap smoothness and performance |
| 15% | Code quality |
| 5% | Documentation and walkthrough |

**Ground rules:**
- Correctness and clarity come before extra features (brief). Keep things simple, no over-engineering, YAGNI (Roadmap Rule-0.01).
- Everything is real and working: real routes, real forecasts, no dummy data (R-U6).
- Built for real public users: fast, scalable, reliable, easy to use and secure (R-U8).

---

## 2. Words we use

| Word | Meaning |
|---|---|
| Route | One drivable truck route from origin to destination, returned by the routing API. Never invented. |
| Checkpoint | A point on a route where the weather is checked. |
| Interval | The spacing between checkpoints: 10, 25 or 50 miles. |
| Covered miles | The stretch of road one checkpoint stands for (section 8.1). |
| ETA | The time the truck reaches a point, including HOS breaks when HOS is on. |
| HOS | US Hours-of-Service breaks: 30 min after 8 h of driving, 10 h rest after 11 h of driving. |
| Risk level | Low, Moderate, High, Severe or No Travel. |
| No weather data | The state of a checkpoint reached after the forecast window ends. It is not a risk level. |
| Forecast window | From the moment the plan is made ("now") to now + 10 days (240 h). |
| Plan | One run of "Plan trip": the routes, checkpoints, risk and ranking for one set of inputs. |
| Waypoint | A point the routing API is asked to pass through to build a detour route (6.2). Never a Checkpoint. |
| Detour route | A Route built through a Waypoint when the routing API returns fewer than 3 routes (6.2). |

---

## 3. Scope

**In v1:**
- Everything in the brief: inputs, 3 route options, checkpoint weather at ETA, risk and load rules, recommendation, map with routes, checkpoints, risk, ETAs and summaries, a corridor heatmap with a 0-48 h slider.
- Public landing page and Google sign-in (R-4, P-6).
- Light and dark theme with a toggle, light by default (Step-7).
- Imperial units with a metric toggle (R-6), fully responsive for any screen size (R-5, section 12).
- Sentry for errors, PostHog for product analytics (R-U2).
- A public privacy page and "Delete my account" (Step-9, section 4).

**Out of v1:**
- Trip history and saved trips (v2, Roadmap Step-16). v1 stores no trips.
- Sign-in methods other than Google.
- Routes outside the US and Canada.
- Gust-based risk; the 14-hour on-duty window and the 70-hour/8-day HOS limit; Canadian HOS rules.
- Truck attributes other than load weight (height, length, axles, hazmat).
- Anything not in the brief: alerts, truck-stop suggestions, sharing.

---

## 4. Access

- **Public pages:** a landing page and a sign-in page (P-6). Everything else needs sign-in.
- **Sign-in:** Google sign-in is the only method (R-4).
- **Sign-out:** available on every signed-in screen (Step-4 decision).
- **What we store (Step-4 decision, Step-5 and Step-9 additions):** only the Google account ID, name and email, the times of the user's plans, place searches and updates (for the limits below, kept 24 h), the app-wide daily call counts per provider, and a shared 1-hour forecast cache that is not tied to any user. No trip inputs or results are stored in v1. A plan's routes travel back and forth as a signed bundle (`docs/tech-stack.md` 12b), never stored.
- **Rate limit (S-6):** each user gets **30 plans per rolling hour**. Only "Plan trip" counts. Changing the interval or the HOS toggle reuses the plan's routes (no new routing call); it may fetch weather for new checkpoints, and it does not count. An update that fails because a provider fails or its budget is used up is not counted either, and a plan more than 2 hours old cannot be updated: the driver plans again (Step-12 decision). Changing units is display only. Plan 31 gets: "Limit reached. Try again in N minutes." The server enforces the limit. A wait of 60 minutes or more is written in hours and minutes, for every limit message: "Try again in 14 h 5 min." (Step-9 decision).
- **Update cap (Step-9 decision):** each user gets at most **120 updates (interval or HOS changes) per rolling hour**, so a script can't use up the app's free server time. Update 121 gets the same "Limit reached. Try again in N minutes." Example: 30 plans with 4 changes each is 120, still allowed.
- **Quota guards (Step-5 decision):** each user also gets at most **100 plans per day** and **300 place searches per hour**. Each provider has an app-wide daily budget (TomTom 650, Geoapify 2,900, Open-Meteo 9,500 calls), reset at midnight UTC, so one user can't use up the free tiers for everyone. Messages are in section 11. A plan blocked by a provider budget is not counted against the user.
- **Privacy and deletion (Step-9 decision):** a public privacy page says what we store and why, which services are used, what the browser keeps, and gives the contact email `ahmarali2004@gmail.com`. A signed-in user can delete their account from the account menu; this removes the user, their usage records and all their sessions at once. Signing in again later creates a new user. Details: `docs/design.md` 9.1 and F13.

---

## 5. Inputs

All inputs are checked in the browser for quick feedback and checked again on the server, which is the one that decides.

| Input | Rule |
|---|---|
| Origin, destination (R-2, R-7) | Place search with suggestions, limited to the US and Canada. The driver must pick a suggestion. Both must be in the US or Canada. |
| Same place (S-3) | If origin and destination resolve to the same place, block with: "Origin and destination are the same place." |
| Departure date and time (R-8) | **Any time from now onward**, with no upper limit (Step-2 change; the 5-day cap in `requirements.md` R-8 is gone). Past times are blocked, checked again on submit. Entered in the **origin's local time zone**, with the zone label shown. |
| Load weight (R-9) | Cargo weight, whole numbers, **0 to 80,000 lb**. In metric mode it is entered in kg (0 to 36,287 kg), converted to lb and rounded to the nearest whole lb before any rule runs (Step-4 decision). Example: 13,608 kg = 30,000.5 lb → 30,001 lb (half rounds up). The server gets the number and unit exactly as the driver typed them; the units toggle never changes the typed load (Step-9 decision, `docs/design.md` 8.7). |

---

## 6. Routes

### 6.1 Asking the routing API
- Use a **truck routing profile** (R-10).
- The only truck attribute sent is the **load weight** in lb, as the truck's weight (Step-2 decision, Rule-0.01). For every other attribute the provider's truck defaults apply.
- Ask for **2 alternative routes** in the same request, so at most 3 routes come back (Step-10 decision: TomTom took 9.2 s to compute 5 alternatives on a 973 mi trip, against 3.7 s for 2, which broke the 10 s target in section 12).

### 6.2 Getting to 3 routes (R-11)
- **3 returned:** use them; risk and ranking (section 9) pick the order.
- **Fewer than 3:** ask the routing API for detour routes through waypoints, and accept a detour only if it passes the current step of this ladder:

| Step | Max driving time vs the fastest route | Max shared road |
|---|---|---|
| 1 | 125% | 50% |
| 2 | 150% | 70% |
| 3 | 200% | 90% |

  - "Shared road" = the share of the detour's length that runs on roads already used by a route we kept.
  - In every step the detour must not backtrack (it never doubles back on itself).
  - Driving time here is the routing API's pure driving time, with no HOS breaks.
  - Go to the next step only while there are still fewer than 3 routes. How waypoints are chosen is decided in `architecture.md`.
- **Still fewer than 3 after step 3:** show the 1 or 2 real routes, ranked as usual, with: "Only N distinct truck routes exist between these places."
- Every route comes from the routing API. Routes are never invented or duplicated.

---

## 7. Checkpoints, ETAs and forecasts

### 7.1 Interval (R-13, P-4)
- **Auto (default):** chosen from the length of the **fastest route** (shortest pure driving time), and used for all routes so they are compared fairly:
  - under 150 mi → 10 mi
  - 150 mi to 600 mi (both ends included) → 25 mi
  - over 600 mi → 50 mi
- **Override:** a dropdown (Auto, 10, 25, 50 mi). Changing it recomputes checkpoints, weather, risk and ranking for all routes. It reuses the plan's routes (no new routing call) and fetches weather for any new checkpoints.
- **Weather-location cap (Step-8 decision):** each plan uses at most 500 weather locations, to stay inside the free forecast limit of 600 a minute. An interval whose checkpoints don't fit is greyed out; if one is picked before the plan, the next allowed interval is used and the driver is told. 50 mi is always allowed. Details: `docs/architecture.md` 6.5.

### 7.2 Where checkpoints go (S-4)
Mile 0 (the origin), then every interval, then the destination, even if the last gap is shorter.
Example: a 112-mi route at 25 mi has checkpoints at 0, 25, 50, 75, 100 and 112.

### 7.3 ETAs and HOS (R-14, R-15)
- Driving time between points comes from the routing API.
- **HOS toggle, on by default:**
  - The app keeps two counters of driving time: "since last break" and "since last rest".
  - When "since last rest" reaches **11 h**, the truck takes a **10 h rest** and both counters reset.
  - Otherwise, when "since last break" reaches **8 h**, the truck takes a **30 min break** and that counter resets.
  - A break or rest happens at the exact point on the route where the limit is hit. None is taken if the destination is reached first.
  - US rules apply on every road, including Canada (Step-2 decision).
- **ETA at a point** = departure + driving time to that point + every break and rest taken before it.
- **HOS off:** ETA = departure + pure driving time.
- **Travel time** = ETA at the destination minus departure. It follows the HOS toggle everywhere: route cards and ranking.
- Turning the toggle recomputes ETAs, weather, risk and ranking.

Example (HOS on, about 60 mph, 900 mi, depart 6:00 AM): drive 8 h, then a 30 min break at 2:00 PM; drive 3 h, then a 10 h rest at 5:30 PM; drive 4 h, arriving 7:30 AM the next day.

### 7.4 Local times (R-16)
Every ETA is shown in the local time of its own location, with the zone label, for example "Tue, Nov 3 · 3:40 PM CST".

### 7.5 Which forecast hour
- Use the forecast hour **nearest** the ETA. Exactly half past goes to the next hour.
- Examples: 3:15 PM uses 3:00 PM, 3:40 PM uses 4:00 PM, 3:30 PM uses 4:00 PM.

### 7.6 Forecast window (Step-2 decision)
- Hourly forecasts are used from now to **now + 10 days** (240 h), counted from when the plan is made, not from the departure.
- A checkpoint whose forecast hour falls after the window shows **"No weather data (more than 10 days ahead from now)"**.
- Trips are never blocked for this. A departure more than 10 days ahead still gets routes, ETAs and a ranking, but with no weather.

---

## 8. Weather and risk

### 8.1 Weather values used
| Value | Meaning | Unit used by the rules |
|---|---|---|
| Wind | **Sustained** wind speed, not gusts | mph |
| Rain | Liquid rain (including showers) that falls in that forecast hour | in/hr |
| Snow | New snow depth that falls in that forecast hour (not melted water) | in/hr |

### 8.2 Risk bands (R-17)
A value exactly on a band edge goes to the higher band. The rain and snow No Travel edges stay strict ">", as the brief writes them. The rules run on the forecast values as received (wind to 0.1 mph, rain and snow to 0.001 in/hr), and the app shows them at that same precision, so a shown value always matches its band (Step-8 decision).

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind (mph) | w < 25 | 25 ≤ w < 35 | 35 ≤ w < 45 | 45 ≤ w < 55 | w ≥ 55 |
| Rain (in/hr) | r < 0.10 | 0.10 ≤ r < 0.25 | 0.25 ≤ r < 0.50 | 0.50 ≤ r ≤ 1.00 | r > 1.00 |
| Snow (in/hr) | s < 0.5 | 0.5 ≤ s < 1.0 | 1.0 ≤ s < 2.0 | 2.0 ≤ s ≤ 3.0 | s > 3.0 |

### 8.3 Load rules (R-18)
These apply to the wind level and can only raise it:
- w ≥ 55 mph → No Travel for any load.
- 45 ≤ w < 55 mph and load > 30,000 lb → No Travel.
- 35 ≤ w < 45 mph and load > 40,000 lb → Severe.

The load thresholds stay strict ">", as the brief writes them: a load of exactly 30,000 lb or 40,000 lb is not raised. The band-edge rule in 8.2 applies to weather values only (Step-4 decision).

### 8.4 Checkpoint risk
- **Checkpoint risk** = the highest of the wind level (after the load rules), the rain level and the snow level.
- The app shows **which condition set the level**. If two or more tie, it names all of them. If a load rule raised the wind level, it says so. A Low checkpoint names no condition; it shows just "Low" (Step-8 decision).
- The rules always run on imperial values. The metric toggle changes display only (R-6).

### 8.5 What a checkpoint shows (P-5)
```
Checkpoint 4  ·  Mile 75 of 412
Arrives:  Tue, Nov 3 · 3:40 PM CST
Wind:     38.0 mph
Rain:     0.050 in/hr
Snow:     0.000 in/hr
Risk:     SEVERE, set by wind (38.0 mph with a 45,000 lb load)
```
For a no-data checkpoint, the weather lines and risk are replaced by "No weather data (more than 10 days ahead from now)".

---

## 9. Route numbers, ranking and recommendation

### 9.1 Covered miles (P-1)
Each checkpoint covers the road halfway back to the previous checkpoint and halfway forward to the next one. The origin and the destination cover only half a stretch. Together, the checkpoints cover the whole route exactly once.

Example: checkpoints at 0, 25, 50, 75, 100 cover 12.5, 25, 25, 25 and 12.5 miles.

### 9.2 Route numbers
For each route:
- **Low, Moderate, High, Severe and No Travel miles** = the covered miles of the checkpoints at that level.
- **No-data miles** = the covered miles of the no-data checkpoints. They are left out of every risk number.
- **Average risk (P-2):** scores are Low 0, Moderate 1, High 2, Severe 3, No Travel 4. Average = sum of (score × covered miles) / sum of covered miles, over checkpoints that have data. If no checkpoint has data, average risk is empty and counts as a tie.

### 9.3 Ranking (R-19, P-3)
1. Routes with **0 No Travel miles** rank first, in this order:
   1. fewest Severe miles
   2. fewest High miles
   3. lowest average risk
   4. shortest travel time
2. Routes **with No Travel miles** come after them, ordered by fewest No Travel miles and then by the 4 keys above.
- Values are compared rounded: miles to 0.1 mi, average risk to 0.01, travel time to the minute.
- **Any No Travel counts (Step-9 decision):** a route "has No Travel miles" when any checkpoint with data is No Travel, however short its covered miles. Example: a 100.04 mi route at 25 mi whose destination checkpoint (covering 0.02 mi) is No Travel ranks with the No Travel routes and is "Not recommended". Risk miles above 0 and below 0.1 are shown as "under 0.1 mi", never "0.0 mi".
- A full tie on every key keeps the routing API's order, with the API's own routes before detour routes (S-5).
- Ranking is the same whether units are imperial or metric.

### 9.4 Recommendation (R-12, R-20)
- Routes are labelled by rank: "1st best", "2nd best", "3rd best".
- The best route with 0 No Travel miles is marked **"Recommended"**.
- Every route with No Travel miles is marked **"Not recommended"**. It is still shown and ranked.
- If every route has No Travel miles, no route is recommended and the app shows a clear warning: **"Do not travel now"**.
- A route with no-data miles keeps its rank, and its card says: "N mi have no weather data yet (more than 10 days ahead from now)".

---

## 10. Results screen: what it must do

This lists behaviour only. Looks, layout and flows are defined in `design.md` (Step-7). The UI takes its style from `docs/UIinspiration.md` (R-U1), and the map takes its feel from Google Maps (R-U3).

- **Map (R-21):** shows all routes, with the selected one highlighted. Tapping a route or its card selects it.
- **Checkpoints:** markers on the map show each checkpoint's risk level. Tapping one opens its detail (8.5). The selected route also has a checkpoint list.
- **Route card (summary)** for each route: rank label, Recommended or Not recommended, distance, travel time, arrival time (local), Severe, High and No Travel miles, average risk, and the no-data note when there is one.
- **Heatmap (R-22):** shows combined risk (Low to No Travel, using the same rules as checkpoints, load rules included) across a corridor around **all** shown routes, for the slider's hour. Heatmap cells are about 55 km (0.5 degrees) wide to fit the free weather limit (Step-5 decision, `docs/tech-stack.md` 12). On long trips they grow to about 110 or 220 km so the plan fits its 500 weather locations (7.1, Step-8 decision). The corridor is the route cells plus one ring (`docs/design.md` 8.5); the color scale is in `docs/design.md` 3.2.
- **Forecast slider (R-23):** whole hours 0 to 48, where hour 0 = the chosen departure time. Moving it updates the heatmap to that forecast hour (nearest hour, 7.5).
  - **Truck marker (S-2):** shows where the truck is on the selected route at that hour. It stays still during HOS breaks and sits at the destination after arrival.
  - **Past the window (S-1):** hours past the forecast window show no heatmap and the label "No forecast for this hour".
- **Controls:** the units toggle (display only), the HOS toggle (7.3) and the interval dropdown (7.1).
- **Messages:** "Do not travel now" (9.4), "Only N distinct truck routes exist" (6.2), the no-data note (9.4) and the rate limit (4).
- **Units (R-6, S-7):** imperial by default (mi, mph, in/hr, lb), metric on toggle (km, km/h, mm/hr, kg). The choice is remembered in this browser. It is not a secret, so Rule-12 doesn't apply. Units and the light/dark theme choice are the only things the app's own code stores in the browser (Step-7 decision). The sign-in session is an HttpOnly cookie, and Sentry and PostHog may keep their own anonymous IDs, never a key, token or trip input (Step-4 decision).
- **Visual bans (R-U4):** no italic font, no gradient text, no rainbow gradients, no colors that "explode" or leave yellowish edges.

---

## 11. Errors and edge cases

| Case | Behaviour |
|---|---|
| A provider fails or times out (S-9) | A clear message naming the service, with a Retry button: "Weather service unavailable. Retry". Never show partial or made-up results. |
| No truck route at all | "No truck route found between these places." |
| Place outside the US or Canada | Not offered in suggestions. If sent to the server, rejected. |
| Same origin and destination | Blocked (5). |
| Departure in the past at submit, or at an interval or HOS change | Blocked: "Departure time has passed. Pick a new time." |
| Fewer than 3 routes exist | 6.2 |
| Checkpoints past the forecast window | 7.6, 9.4 |
| Every route has No Travel miles | 9.4 |
| Rate limit reached (plans or updates) | 4 |
| Place-search limit reached (Step-5) | "Search limit reached. Try again in N minutes." |
| A provider's daily budget is used up (Step-5) | "[Service] daily limit reached. Try again tomorrow.", for example "Routing service daily limit reached. Try again tomorrow." No partial results. |
| Signed-out user opens the planner | Sent to sign-in. |

---

## 12. Quality targets

- **Speed (S-8):** results appear within **10 s for 95% of plans**. Moving the slider and switching routes respond within **100 ms**, because all 49 heatmap hours load with the plan.
- **Devices (R-5):** fully responsive for any screen or window size, designed phone-first, and equally polished on desktop, which is used for the product demo.
- **Accessibility (Step-3 decision):** WCAG 2.1 AA.
- **Security (R-U7):** every third-party API key stays on the server. Secrets are never put in browser local storage (Rule-12). What the browser keeps is listed in 10. The planner's API needs a signed-in session, and every request that changes something needs a CSRF token (Step-6 decision, `docs/tech-stack.md` 9). The server re-checks every input and enforces the rate limit.
- **Reliability:** provider failures are shown (11), never hidden. No dummy data (R-U6).
- **Monitoring (R-U2):** Sentry for errors, PostHog for product analytics.
- **Stack and hosting (R-1, R-U5):** React frontend and Django backend (a hard requirement), deployed publicly on Vercel at `mytruckpilot.vercel.app`. How Django runs alongside Vercel is set in `docs/tech-stack.md` section 1.
- **Budget:** every provider must fit its free tier. The providers in `docs/tech-stack.md` cover: truck routing with alternatives and waypoints in the US and Canada; geocoding limited to the US and Canada; hourly forecasts of sustained wind, rain and snowfall depth for at least 10 days; Google sign-in.
- **Setup guide (R-U9):** every API and service gets step-by-step setup in `docs/api-setup-guide.md`.

**Deliverables (R-25):** GitHub repository, hosted app, and README (Step-15). The user records the 5-10 min Loom walkthrough.

---

## 13. Worked example

Inputs: load 42,000 lb, HOS on, departure Tue, Nov 3, 1:00 PM CST, the driver sets the interval to 25 mi. Route A is 100 mi at 60 mph (1 h 40 min, so no HOS break).

| Checkpoint | Mile | ETA | Forecast hour | Weather | Level | Covered |
|---|---|---|---|---|---|---|
| A1 | 0 | 1:00 PM | 1:00 PM | wind 20, rain 0, snow 0 | Low | 12.5 |
| A2 | 25 | 1:25 PM | 1:00 PM | wind 38 (High), load > 40,000 lb | Severe (wind, load rule) | 25 |
| A3 | 50 | 1:50 PM | 2:00 PM | wind 22, rain 0.30 | High (rain) | 25 |
| A4 | 75 | 2:15 PM | 2:00 PM | snow 0.6 | Moderate (snow) | 25 |
| A5 | 100 | 2:40 PM | 3:00 PM | calm | Low | 12.5 |

Route A: 25 Severe mi, 25 High mi, 0 No Travel mi. Average risk = (0×12.5 + 3×25 + 2×25 + 1×25 + 0×12.5) / 100 = **1.50**.

Say Route B (110 mi) has 0 Severe and 50 High miles, and Route C has 12.5 No Travel miles. Then:
- B is "1st best, Recommended", because it has the fewest Severe miles.
- A is "2nd best".
- C is "3rd best, Not recommended", because it has No Travel miles.

---

## 14. Traceability

| ID | Section | ID | Section |
|---|---|---|---|
| R-1 | 12 | R-14 | 7.3 |
| R-2 | 5 | R-15 | 7.3 |
| R-3 | 3 | R-16 | 7.4 |
| R-4 | 4 | R-17 | 8.1, 8.2 |
| R-5 | 12 | R-18 | 8.3, 8.4 |
| R-6 | 8.4, 10 | R-19 | 9.3 |
| R-7 | 5 | R-20 | 9.4 |
| R-8 | 5 (changed) | R-21 | 10 |
| R-9 | 5 | R-22 | 10 |
| R-10 | 6.1 | R-23 | 10 |
| R-11 | 6.2 | R-24 | 12 |
| R-12 | 9.4 | R-25 | 12 |
| R-13 | 7.1 | P-1 | 9.1 |
| P-2 | 9.2 | P-3 | 9.3 |
| P-4 | 7.1 | P-5 | 8.5 |
| P-6 | 4 | R-U1, R-U3, R-U4 | 10 |
| R-U2, R-U5, R-U7 to R-U9 | 12 | R-U6 | 1, 12 |
| S-1, S-2 | 10 | S-3 | 5 |
| S-4 | 7.2 | S-5 | 9.3 |
| S-6 | 4 | S-7 | 10 |
| S-8 | 12 | S-9 | 11 |
| S-10 | `requirements.md` header | | |

**Step-2 changes to `requirements.md`:** R-8 now allows any future departure; the routing API gets only the load weight (6.1); forecasts cover 10 days from now, and later checkpoints show no data (7.6); when fewer than 3 routes exist, those are shown with a note (6.2); US HOS rules apply in Canada (7.3); rain and snow measures (8.1); forecast hour rounding (7.5); the 30-plan limit (4).

**Step-4 clarifications (2026-11-01):** Waypoint and Detour route added to the word list (2); sign-out and what we store (4); interval and HOS changes reuse routes and may fetch weather (4, 7.1); kg loads round to whole lb (5); load thresholds are strict (8.3); browser storage (10); example zone labels corrected to CST (7.4, 8.5).

**Step-5 additions (2026-11-01):** quota guards (100 plans a day and 300 place searches an hour per user, plus app-wide daily provider budgets) and what we store (4, 11); heatmap cells about 55 km wide (10). See `docs/tech-stack.md` 12, 12a, 12b.

**Step-6 additions (2026-11-01):** CSRF token on every request that changes something (12, `docs/tech-stack.md` 9); the Step-5 pointers in 12 now point to `docs/tech-stack.md`; the budget figure is no longer referenced (12).

**Step-7 additions (2026-11-01):** light and dark theme with a toggle, light by default, and the theme choice stored in the browser (3, 10); a past departure also blocks an interval or HOS change (11). Looks, layout and flows are in `docs/design.md`.

**Step-8 additions (2026-11-01):** at most 500 weather locations per plan, with greyed-out intervals and larger heatmap cells on long trips (7.1, 10); rules run on raw forecast values shown at full precision (8.2, 8.5); a Low checkpoint names no condition (8.4). How each feature is built is in `docs/architecture.md`.

**Step-9 additions (2026-11-01):** privacy page and "Delete my account" (3, 4); updates stored and capped at 120 per user per rolling hour (4, 11); long waits written in hours and minutes (4); the typed load is never changed by the units toggle (5); any No Travel checkpoint counts, and tiny risk miles show as "under 0.1 mi" (9.3).

**Step-10 changes (2026-11-01, measured on real TomTom calls):** the routing request asks for 2 alternatives, so at most 3 routes come back and the "more than 3" case is gone (6.1, 6.2).
