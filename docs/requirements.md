# Truck Pilot - Requirements

> Superseded by `docs/spec.md` (2026-11-01). Kept as an archive; read the spec instead.

This doc holds every requirement for Truck Pilot: the verbatim brief (`fs-assessment-spotter.pdf`), the user's own requirements, and the decisions taken in the Step-1 requirements interview (2026-10-31). Step-2 turns this into `spec.md`, which then becomes the single source of truth.

Requirement IDs (R-x) are stable so later docs can reference them.

---

## 1. The brief (verbatim from fs-assessment-spotter.pdf)

**Full Stack Developer - Weather-Aware Truck Routing**

Build a **React + Django** web app that helps a truck driver choose the safest route based on **weather, load weight, and travel time**.

**The user enters:**
- Origin & destination
- Departure date/time
- Load weight

**The app should:**
- Generate **3 route options** using a routing API.
- Sample weather every **10 / 25 / 50 miles**, using the truck's **estimated arrival time** at each checkpoint.
- Calculate weather risk using the provided risk/load rules.
- Recommend the best route, balancing **weather risk and travel time**.
- Show all routes, checkpoints, risk levels, ETAs, and route summaries on a map.
- Show a **weather heatmap along the trip corridor** with a **0-48 hour forecast slider**.

You may use third-party APIs for routing, geocoding, and weather. You do not need to build a routing engine.

**Risk rules** - thresholds to classify weather at each checkpoint:

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind | <25 mph | 25-34 | 35-44 | 45-54 | ≥55 mph |
| Rain | <0.10 in/hr | 0.10-0.25 | 0.25-0.50 | 0.50-1.00 | >1.00 |
| Snow | <0.5 in/hr | 0.5-1.0 | 1.0-2.0 | 2.0-3.0 | >3.0 |

**Load rules:**
- ≥55 mph → **No Travel** for any load
- 45-54 mph + >30,000 lb → **No Travel**
- 35-44 mph + >40,000 lb → **Severe**

**Route recommendation** - prefer:
1. Fewest Severe miles
2. Fewest High miles
3. Lowest average risk
4. Shortest travel times

**Deliverables:** GitHub repository, hosted application, 5-10 min Loom walkthrough.

**Evaluation:** 40% routes, weather, risk & recommendation logic; 40% UI, map & heatmap smoothness and performance; 15% code quality; 5% documentation & walkthrough.

**Prioritize correctness and clarity over extra features.**

---

## 2. User's own requirements

- **R-U1 UI inspiration:** take the UI from `docs/UIinspiration.md`. That template came from a product with a really great UI, and Truck Pilot should have the same kind of UI.
- **R-U2 Monitoring and analytics:** use **Sentry** (errors) and **PostHog** (product analytics).
- **R-U3 Map UI:** the map experience is inspired by Google Maps (Roadmap Rule-11; study maps.google.com with Claude-in-Chrome during Step-7 design).
- **R-U4 Visual bans:** no italic font, no gradient text, no rainbow gradients, no colors that "explode" or give yellowish boundaries (Roadmap Rule-4).
- **R-U5 Hosting:** deploy publicly on Vercel at `mytruckpilot.vercel.app` (Roadmap Rules 3, 9).
- **R-U6 Real, not fake:** no dummy or fake data or architecture; everything is functional (Roadmap Rule-10).
- **R-U7 Secrets:** API keys and secrets never stored in browser localStorage (Roadmap Rule-8, second one); third-party API keys stay server-side.
- **R-U8 Quality bar:** fast, scalable, reliable, easy to use and secure, built for real users (Roadmap Rule-3).
- **R-U9 Setup guide:** every API and external service gets step-by-step setup instructions in `docs/api-setup-guide.md` (Roadmap Rule-10, second one).

---

## 3. Decisions from the Step-1 interview

### 3.1 Scope and platform
- **R-1 Stack:** React frontend + Django backend is a **hard requirement**. How Django is hosted alongside Vercel is decided in Step-5.
- **R-2 Region:** routes in the **US and Canada** road network. Origin and destination must both be in the US or Canada.
- **R-3 v1 scope:** the brief's features plus R-U1 to R-U9, nothing more. Polish, correctness and performance come before extras. Trip history is a v2 item (Roadmap Step-14).
- **R-4 Accounts:** sign-in is **required** to use the route planner. The only sign-in method is **Google sign-in**. v1 stores no trip history.
- **R-5 Devices:** **fully responsive**, with equal quality on phone, tablet and desktop.
- **R-6 Units:** **imperial by default** (mi, mph, in/hr, lb) with a **metric toggle** (km, km/h, mm/hr, kg). The risk logic always runs in imperial, so the toggle changes display only.

### 3.2 Inputs
- **R-7 Origin & destination:** place search with geocoding, limited to the US and Canada.
- **R-8 Departure date/time:** from **now up to now + 5 days**. Past times are blocked. Entered in the **origin's local time zone**.
- **R-9 Load weight:** the cargo weight, **0 to 80,000 lb** (entered in kg when the metric toggle is on, converted to lb for the rules).

### 3.3 Routes
- **R-10 Truck profile:** routing uses a **truck-specific profile** (truck-legal roads, bridge heights, weight limits). Step-5 must pick a routing API that supports this within budget.
- **R-11 Always exactly 3 routes:** the app always shows exactly 3 real, drivable routes.
  - If the routing API returns 3, use them.
  - If it returns more than 3, rank all of them (R-19) and show the **top 3**.
  - If it returns fewer than 3, add routes by asking the routing API for routes through detour waypoints. Start with strict "sensible" rules (at most 25% longer in travel time than the fastest route, mostly different roads, no backtracking or U-turns), then relax them step by step until there are 3 routes.
  - Every route comes from the routing API. Routes are never invented.
- **R-12 Route ranking display:** the 3 routes are labelled with their rank (1st best, 2nd best, 3rd best). The user can select any of them to view.

### 3.4 Checkpoints, ETAs and sampling
- **R-13 Sampling interval:** checkpoints are spaced every **10, 25 or 50 miles** along each route.
  - The app **auto-picks** the interval by route length: **under 150 mi → 10 mi**, **150 to 600 mi → 25 mi**, **over 600 mi → 50 mi**.
  - The user can **override** it with a dropdown (10 / 25 / 50 mi), which recomputes the results.
- **R-14 ETA at each checkpoint:** weather at each checkpoint is taken from the forecast hour matching the truck's **estimated arrival time** there.
- **R-15 Hours-of-Service (HOS):** ETAs **include HOS breaks by default**: a 30-minute break after 8 hours of cumulative driving, and a 10-hour rest after 11 hours of driving. A **toggle** turns HOS off, so ETAs show pure driving time between two points.
- **R-16 Time zones:** each checkpoint ETA is shown in **that checkpoint's local time** with its zone label (for example 3:40 PM CDT).

### 3.5 Risk classification
- **R-17 Weather risk per checkpoint.** Uses **sustained wind speed** (not gusts), rain rate and snowfall rate. When a value falls exactly on a band edge it takes the higher band, except at the No Travel edges, which the brief writes as strict ">" for rain and snow:

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind (mph) | w < 25 | 25 ≤ w < 35 | 35 ≤ w < 45 | 45 ≤ w < 55 | w ≥ 55 |
| Rain (in/hr) | r < 0.10 | 0.10 ≤ r < 0.25 | 0.25 ≤ r < 0.50 | 0.50 ≤ r ≤ 1.00 | r > 1.00 |
| Snow (in/hr) | s < 0.5 | 0.5 ≤ s < 1.0 | 1.0 ≤ s < 2.0 | 2.0 ≤ s ≤ 3.0 | s > 3.0 |

- **R-18 Load rules** (applied to the wind level and can only raise it):
  - w ≥ 55 mph → No Travel for any load.
  - 45 ≤ w < 55 mph and load > 30,000 lb → No Travel.
  - 35 ≤ w < 45 mph and load > 40,000 lb → Severe.
  - **Checkpoint risk** = the highest of the wind level (after load rules), the rain level and the snow level. The UI shows which factor set the level.

### 3.6 Recommendation
- **R-19 Ranking order:** routes are ranked by fewest Severe miles, then fewest High miles, then lowest average risk, then shortest travel time.
- **R-20 No Travel routes:** a route with **any No Travel miles is never recommended**. It is still shown and ranked, marked **"Not recommended"**. If all 3 routes have No Travel miles, **no route is recommended** and a clear **"Do not travel now"** warning is shown.

### 3.7 Map, heatmap and summaries
- **R-21 Map:** shows all 3 routes, their checkpoints with risk levels and ETAs, and a summary for each route.
- **R-22 Heatmap:** a weather heatmap along the trip corridor showing **combined risk level** (Low to No Travel colors).
- **R-23 Forecast slider:** 0 to 48 hours, where **hour 0 = the chosen departure time**. Moving it updates the heatmap to that forecast hour. A marker shows where the truck is on the selected route at that hour.
- **R-24 Smoothness:** map and heatmap interaction must be smooth and fast. This is 40% of the evaluation.

### 3.8 Deliverables
- **R-25** GitHub repository, hosted app at `mytruckpilot.vercel.app`, and a README (Roadmap Step-13). The 5-10 min Loom walkthrough is recorded by the user.

---

## 4. Further details (approved by the user, 2026-11-01)

These details were not covered in the interview. They were proposed afterwards and the user approved all of them.

- **P-1 How we count "Severe miles" and "High miles":** weather is only checked at points (checkpoints), and a point has no length. So each checkpoint covers the road **halfway back** to the previous checkpoint and **halfway forward** to the next one.
  - Example: a 100-mile route with checkpoints at miles 0, 25, 50, 75 and 100. The checkpoint at mile 50 covers miles 37.5 to 62.5, which is 25 miles. If it is Severe, the route has 25 Severe miles.
  - The origin (mile 0) and the destination are always checkpoints. They cover only half a stretch, because there is no road before the start or after the end.
  - Together, all checkpoints cover the whole route exactly once. Full explanation in the README Trade-offs section.
- **P-2 Average risk:** each level gets a score: Low = 0, Moderate = 1, High = 2, Severe = 3, No Travel = 4. A route's average risk is the average score over all its miles, using the miles each checkpoint covers (P-1).
- **P-3 Ranking No Travel routes:** routes without No Travel miles rank first, by R-19. Routes with No Travel miles rank after them, by fewest No Travel miles and then by R-19.
- **P-4 Auto interval basis:** the auto-pick in R-13 uses the length of the fastest route, and all 3 routes use the same interval so they are compared fairly.
- **P-5 What the app shows for each checkpoint:** when the driver taps a checkpoint on the map, or looks at the checkpoint list, they see:
  ```
  Checkpoint 4  ·  Mile 75 of 412
  Arrives:  Tue, Nov 3 · 3:40 PM CDT
  Wind:     38 mph
  Rain:     0.05 in/hr
  Snow:     0.0 in/hr
  Risk:     SEVERE, set by wind (38 mph with a 45,000 lb load)
  ```
  - **Mile:** how far along the route the checkpoint is.
  - **Arrives:** when the truck reaches it, in that place's local time.
  - **Wind, rain, snow:** the forecast at that exact arrival time.
  - **Risk:** the final level plus the condition that caused it. In the example, 38 mph wind alone is High, but the load rule raises 35-44 mph with more than 40,000 lb to Severe.
- **P-6 Public pages:** a public landing and sign-in page. The planner requires sign-in (R-4).

---

## 5. Trade-offs to record in the README (Step-13)

| Decision | Choice | Reason (user's words, condensed) |
|---|---|---|
| Wind measure | Sustained wind, not gusts | Follows the brief as written. |
| No Travel routes | Never recommended; shown and marked "Not recommended" | The brief clearly defines No Travel. |
| HOS in ETAs | On by default, user can toggle off | Realistic ETAs for weather timing; toggle off shows the pure driving time between two points. |
| Fewer than 3 routes from API | Fill to 3 with waypoint-based real routes, relaxing "sensible" rules step by step | The brief requires 3 route options. |
| Band edges | Value on an edge goes to the higher band; No Travel edges stay strict ">" | Safer reading of overlapping ranges in the brief. |
| Severe/High miles (P-1) | Each checkpoint covers halfway back and halfway forward | Already written into README.md Trade-offs, in full with the example. Keep it as is in Step-13. |

**Status (2026-11-01):** the rows the user asked to save to the README are now written in full in `README.md` Trade-offs: wind, No Travel routes, HOS in ETAs, and Severe/High miles. "Fewer than 3 routes" and "Band edges" are not in the README yet; they wait for the user's decision.

---

## 6. Out of scope for v1
- Trip history and saved trips (v2, Roadmap Step-14).
- Sign-in methods other than Google.
- Routes outside the US and Canada.
- Gust-based risk, the 70-hour/8-day HOS cycle and the 14-hour on-duty window.
- Extra features not in the brief (alerts, truck-stop suggestions, sharing).

---

## 7. Notes for later steps
- **Step-5 (tech stack):** pick providers for these needs.
  - Routing: truck profile, alternative routes, waypoint routing, US and Canada coverage.
  - Geocoding: limited to the US and Canada.
  - Weather: hourly forecasts of sustained wind, precipitation rate and snowfall rate, covering departure + 5 days + the full trip with HOS + 48 h.
  - Google OAuth, and Django hosting next to Vercel.
  - Everything must fit the budget (13,000 PKR remaining).
- **Step-7 (design):** study maps.google.com with Claude-in-Chrome (R-U3). Define the heatmap corridor width and the risk color scale within the Rule-4 color bans.
