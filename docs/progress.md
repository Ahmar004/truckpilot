# Truck Pilot - Progress

Read this file and `docs/Roadmap.md` at the start of every session. Update it whenever any work is done.

## Where to resume from

**Step-11 in progress. Slices 1-3 are done and pushed (2026-11-01, session 1).** Next: **Step-11, slice 4 (users, sessions, CSRF and limits)** in `docs/architecture.md` section 0, with `superpowers:subagent-driven-development`. Read the "For the next Step-11 sessions" notes at the end of the Step-11 log and the "For Step-11" notes at the end of the Step-10 log first (slice 4 must ask the user how tests get a database).

## Status by step

| Step | Status | Notes |
|---|---|---|
| 1 Requirements | Done (approved 2026-11-01) | `docs/requirements.md`, now an archive |
| 2 Spec | Done (approved 2026-11-01) | `docs/spec.md` is the single source of truth |
| 3 CLAUDE.md review | Done (approved 2026-11-01) | `CLAUDE.md` at the root; `inspiration-CLAUDE.md` no longer exists |
| 4 Doc cross-check | Done (approved 2026-11-01) | Fixes listed in the Step-4 log below |
| 5 Tech stack | Done (approved 2026-11-01) | `docs/tech-stack.md`; spec 4, 10, 11, 14 updated |
| 6 CLAUDE.md + Roadmap revisit | Done (approved 2026-11-01) | Changes listed in the Step-6 log below |
| 7 Design | Done (approved 2026-11-01) | `docs/design.md`; spec 3, 10, 11, 14, CLAUDE.md and tech-stack updated |
| 8 Architecture | Done (approved 2026-11-01, slice plan included) | `docs/architecture.md`; spec 7.1, 8.2, 8.4, 8.5, 10, tech-stack 12, design and README updated |
| 9 Doc validation | Done (approved 2026-11-01) | spec 3, 4, 5, 9.3, 11, 14; tech-stack 8, 10, 12a, 12b, limits table; design 2, 4.2, 5, 6, 7, 8.3, 8.6, 8.7, 9.1, 14a; architecture 0, 3, 4, 6.4, 6.10, 6.14, 7, 9, 11, 12, 14, 16a; CLAUDE.md (update cap); README (Neon trade-off) |
| 10 Foundation | Done (2026-11-01) | Scaffold, services, proofs, GitHub; spec 6.1, 6.2, 14; architecture 1, 6.4, 6.5, 6.13, 6.15, 16b, 17; tech-stack 10, 12b; CLAUDE.md commands + pitfalls; api-setup-guide; README (run locally + 1 trade-off) |
| 11 Slices | In progress | Slices 1-3 done (`ab3507f`, `98ed683`, `47a7d9b`, hardening `964a334`); next slice 4 |
| 12-15 | Not started | 13 = Vercel deploy, 14 = post-deploy testing, 15 = README |
| 16 (v2) Trip history | Not started | v2 only |

## Log

### 2026-11-01 - Step-1 (requirements)
- The `/superpowers:brainstorming` skill was not loading in this session, so its process was followed by hand: read the brief, interview the user, then write the doc. Cause: `~/.claude/plugins/known_marketplaces.json` was corrupted (all zero bytes). It was rebuilt on 2026-11-01 and the corrupt copy kept as `known_marketplaces.json.corrupt.bak`. `superpowers@claude-plugins-official` 6.3.0 is now enabled. From Step-2 onward, use the real `superpowers:*` skills.
- Read `fs-assessment-spotter.pdf`, the user's earlier notes in `requirements.md` (UIinspiration, Sentry, PostHog) and the Roadmap.
- Ran a 6-round interview. All decisions are in `requirements.md` section 3 (R-1 to R-25). Key decisions:
  - React + Django is mandatory.
  - Region: US + Canada.
  - Google sign-in required; no trip history in v1.
  - Fully responsive; imperial units with a metric toggle.
  - Always exactly 3 real routes. Fill from waypoint routes with progressively relaxed "sensible" rules; show the top 3 when there are more.
  - Sampling interval is auto-picked by length (under 150 mi → 10, 150-600 mi → 25, over 600 mi → 50), with a dropdown override.
  - HOS breaks on by default, with a toggle.
  - Sustained wind, not gusts. A value on a band edge goes to the higher band.
  - Routes with No Travel miles are never recommended.
  - Truck routing profile.
  - Departure from now to +5 days, in local times.
  - Heatmap shows combined risk; the slider's hour 0 is the departure time.
- The README trade-offs the user asked for are collected in `requirements.md` section 5. Use them in Step-13.
- The user had already updated the Roadmap themselves: new intro, a new Rule-11 for the Google-Maps-inspired map UI, and v2 Step-14 for trip history.
- The user renumbered the duplicate Roadmap rules themselves.
- The user approved all of section 4 (P-1 to P-6). P-1 and P-5 were rewritten in plain words with examples.
- `README.md` was created at the root with a Trade-offs section holding the P-1 explanation, which the user asked to keep at that exact length and detail.
- Missed request, now fixed: in the interview the user asked for the wind, No Travel and HOS trade-offs to go into the README. I first parked them in `requirements.md` section 5 instead. All three are now in `README.md` Trade-offs, each written as problem → choice → example. Step-13 must keep every existing Trade-offs entry as it is.
- **Rule for future sessions:** when the user says "save this in the README", write it into `README.md` immediately, even before Step-13.

### 2026-11-01 - Step-2 (spec)
- The real `superpowers:brainstorming` skill loaded and was used (architectural path; the spec goes to `docs/spec.md` as the Roadmap says, not the skill's default path).
- The user approved `requirements.md` as is, so Step-1 is done. `requirements.md` now has a "Superseded by spec.md" line at the top.
- The user added **Roadmap Rule-0.01: keep things simple, YAGNI.** Prefer the simplest option in every proposal.
- Decisions taken in the interview (all in `spec.md`; the last line of section 14 lists what changed from `requirements.md`):
  - The routing API gets **only the load weight** as the truck weight. R-9 stays 0-80,000 lb.
  - Forecast hour = the **nearest whole hour** (3:15 → 3:00, 3:40 → 4:00; exactly :30 goes to the next hour).
  - Rain = liquid rain per hour; snow = new snow depth per hour.
  - Fewer than 3 routes after the 3-step ladder (125%/50%, 150%/70%, 200%/90%, no backtracking) → show the real ones with "Only N distinct truck routes exist".
  - Heatmap covers a corridor around **all** routes and uses the same risk rules as checkpoints, load rules included.
  - Travel time follows the HOS toggle (on by default) everywhere, ranking included.
  - US HOS rules apply in Canada too.
  - 30 plans per user per rolling hour; only "Plan trip" counts.
  - **Forecast window = now + 10 days.** Departure can be **any future date** (R-8 changed). Checkpoints after the window show "No weather data (more than 10 days ahead from now)"; their miles are left out of the risk numbers, and the ranking order is unchanged.
  - S-1 to S-10 (small details) approved as proposed: see `spec.md` section 14.
- README Trade-offs: added "nearest whole hour" and "10-day forecast window", both at the user's request. The user did not ask for the other Step-2 decisions to go there. "Band edges" and "Fewer than 3 routes" are still not in the README.
- The user approved `spec.md` as written, including the three self-decided details (3:30 goes to 4:00, the heatmap uses the load rules, a rolling-hour rate limit).
- The user is frustrated by repeated questions: never re-ask something already answered; check this log first.

### 2026-11-01 - Step-3 (CLAUDE.md)
- Rewrote `inspiration-CLAUDE.md` for Truck Pilot (101 lines). Dropped everything specific to Next.js, Supabase, Prisma, Jev, `AGENTS.md`/`docs/rules`, the old skills, the old pitfalls and the old rendering rules. The stack section only says React + Django; commands get added in Step-10, and the rest of the stack in Step-6.
- Decisions taken in the interview:
  - Writing rules: keep "no emojis", "no long dashes" and "spec section 2 words only". The "no doc bloat" rule was dropped.
  - Layout: one fluid layout for any screen size, phone-first and equally polished on desktop (the demo is on desktop, and Google Maps is the bar). Never mention tablet.
  - Accessibility: WCAG 2.1 AA.
  - Session transcript logs (`.claude-logs/`): dropped.
  - Guardrails added: one server-side risk engine, UTC inside and local time only for display, test fixtures in tests only, no state in one process's memory.
  - Before each slice commit: tests + lint, then `/code-review` at low effort. Commit messages are plain sentences, not Conventional Commits.
- `spec.md` section 12 changed (approved): Devices now reads "any screen or window size, phone-first, equally polished on desktop"; a new line adds WCAG 2.1 AA.
- Carried over without asking, then approved by the user: enum-like values come from one constants module; Enter submits and Esc cancels; Rule of Three; every provider call gets a timeout and a validated response; no file writes at runtime.
- The user approved the draft, and it was renamed to `CLAUDE.md`. Step-3 is done.

### 2026-11-01 - Step-4 (doc cross-check)
- The Roadmap names no skill for Step-4, so the check was done by hand. Read `docs/Roadmap.md`, `CLAUDE.md`, `docs/spec.md` and the README trade-offs. All worked examples (HOS timeline, ETAs, covered miles, average risk 1.50) re-checked and correct.
- The user edited the Roadmap themselves during this session: new **Step-13 Vercel deploy** (URL `mytruckpilot.vercel.app`, GitHub repo `https://github.com/Ahmar004/truckpilot`), **Step-14 post-deploy testing** with Claude-in-Chrome, **Step-15 README**, and v2 trip history renumbered to **Step-16**. Step-12 now says to test on localhost. Deploying happens only at Step-13 (the user's choice; don't re-ask).
- Approved and applied:
  - Roadmap: every file reference now uses its real path (`docs/Roadmap.md`, `docs/spec.md`, `docs/progress.md`, `docs/design.md`, `docs/architecture.md`, `docs/UIinspiration.md`). No meaning changed.
  - Roadmap skills: Steps 5 and 7 use `superpowers:brainstorming`. Step-8 uses `superpowers:brainstorming` for `architecture.md`, then `superpowers:writing-plans` for the slice plan.
  - spec 2 + `CLAUDE.md` word list: added **Waypoint** (a point the routing API passes through to build a detour; never a Checkpoint) and **Detour route**.
  - spec 4: **Sign-out** on every signed-in screen. **What we store:** only the Google account ID, name, email and plan times (for the rate limit); no trip inputs or results in v1.
  - spec 4 and 7.1: changing the interval or HOS reuses the plan's **routes** (no new routing call), may fetch weather for new checkpoints, and does not count toward the 30-plan limit.
  - spec 5: a kg load is converted to lb and **rounded to the nearest whole lb** before the rules run.
  - spec 8.3: load thresholds stay **strict ">"** (exactly 30,000 or 40,000 lb is not raised). The band-edge rule is for weather values only.
  - spec 10 and 12 + `CLAUDE.md`: the app's own code stores **only the units choice** in the browser. The sign-in session is an HttpOnly cookie. Sentry and PostHog may keep their own anonymous IDs (so PostHog's default persistence is fine), never a key, token or trip input.
  - spec 7.4 and 8.5: example zone label CDT -> **CST** (US daylight time ends Nov 1, 2026).
  - spec: "colour" -> "color"; section 3 R-5 points to section 12; Step references updated (trip history Step-16, README Step-15). A "Step-4 clarifications" line was added at the end of spec 14.
  - README: Step-13 -> Step-15 in the note; 2 en dashes replaced with hyphens; "If all 3 routes" -> "If every route" in the No Travel trade-off. Nothing else in the trade-offs changed.

### 2026-11-01 - Step-5 (tech stack)
- Used `superpowers:brainstorming`. Checked current provider docs on the web (Vercel Django, TomTom, HERE, Open-Meteo, Neon, Geoapify) before proposing.
- User decisions (3 interview rounds, all picked the recommended option):
  - **v1 is non-commercial** (no ads, subscriptions or paid features). This is why Vercel Hobby and free Open-Meteo are allowed. Cost $0/month.
  - Map: **MapLibre GL JS + OpenFreeMap** tiles (no key in the browser).
  - Routing: **TomTom** (truck mode, kg weight, up to 5 alternatives, 20k free calls/month, no card). HERE rejected (5k/month, card); ORS rejected (alternatives only under ~100 km).
  - Place search: **Geoapify** autocomplete (3,000/day free, no card, attribution required).
  - Frontend: **Vite + React SPA**; rendering = **SSG landing + CSR planner**. Next.js rejected (second server).
  - Hosting: **one Vercel project with Vercel Services** (`/api` -> Django, rest -> React; same address for the HttpOnly cookie). Services is Beta; fallback = two Vercel projects + rewrite. Step-10 must prove this first.
  - DB: **Neon Postgres** (pooled connection). Supabase rejected (pauses after 7 idle days).
  - Sign-in: **Google Identity Services button + `google-auth` check + Django HttpOnly session**.
  - Weather: **Open-Meteo** with a **shared 1-hour forecast cache in Postgres, points snapped to ~11 km grid cells**. Upgrade path: Open-Meteo "API Standard" (paid, needs approval).
  - API layer: **Django Ninja**. Heatmap: **MapLibre built-in layers** (all 49 hours sent once). UI kit: **Tailwind v4 + Radix + cva + Phosphor + Fontsource** (UIinspiration set; Motion only if needed, ask first).
- The user asked whether Open-Meteo allows IP forwarding (like Supabase). Answer given: no. Its limit counts the connecting IP (our server), the free API has no key to trust a forwarded header, faking one breaks its terms, and calling from the browser breaks "server decides". Written into tech-stack.md section 12.
- "My call" items in tech-stack.md, **approved by the user with the doc**: React Router, TanStack Query, native `datetime-local` + `Intl`, Django 5.2 LTS, httpx, timezonefinder, no geometry library at first, uv, pytest/Vitest/Playwright, Ruff/ESLint/Prettier, npm.
- A reviewer subagent (Sonnet) read the doc as a builder. That led to 3 more user decisions, all the recommended option:
  - **Heatmap cells ~55 km (0.5 deg)**, checkpoint cells ~11 km. Open-Meteo counts each location as a call; 11 km heatmap cells would need ~2,000 calls for one long plan (breaks 600/min). With 55 km cells: ~400 calls per uncached long plan, ~25 a day.
  - **Quota guards:** per user 100 plans/day and 300 place searches/hour (on top of 30 plans/hour); app-wide daily provider budgets TomTom 650, Geoapify 2,900, Open-Meteo 9,500, reset at midnight UTC; messages "[Service] daily limit reached. Try again tomorrow." A plan blocked by a provider budget isn't counted against the user.
  - **Signed route bundle** (`django.core.signing`, compressed) carries the routes between "Plan trip" and an interval or HOS change; nothing is stored.
- Settled without asking (in the doc): TomTom ETAs come from `extendedRouteRepresentation=travelTime`, filled in by distance between points; `vehicleWeight` 0 means no weight limits, so a 0 lb load needs no special case (spec 6.1 unchanged); the landing and sign-in pages are pre-built with `react-dom/server` after `vite build`, with no plugin.
- **spec.md changed** with these approvals: section 4 (what we store + quota guards), 10 (55 km heatmap cells), 11 (2 new message rows), 14 ("Step-5 additions" line).
- **For Step-6:** `CLAUDE.md` guardrails mention only the 30-plans/hour limit; add the new caps, the stack, and the "Stack and commands" section. Step-10 must first prove Vercel Services (one address, cookie works) and make one real TomTom truck call (`maxAlternatives=5`, time points, per-second limit).
- At the user's request, **every tech-stack trade-off is now in `README.md` Trade-offs** (14 new entries after the user's own Neon entry, which is kept as it is): non-commercial free tiers, one Vercel project, SSG + CSR, MapLibre + OpenFreeMap, TomTom, Geoapify, Open-Meteo cache (with the IP-forwarding answer), 55 km heatmap cells, quota guards, signed route bundle, Google button + session, Django Ninja, MapLibre heatmap layers, timezonefinder.
- Facts to remember: Vercel's Python runtime is **3.12** (this PC has 3.13; install 3.12 through uv in Step-10). Open-Meteo `snowfall` is in cm (or inch with `precipitation_unit=inch`); rain = `rain` + `showers`. TomTom wants kg.

### 2026-11-01 - Step-6 (CLAUDE.md and Roadmap revisit)
- The Roadmap names no skill for Step-6, so it was done by hand. The user added "after approval" to the Roadmap's Step-6 text this session: every `CLAUDE.md` change is shown and approved before it is applied.
- **Roadmap Step-10 (approved, Rule-6):** the user's text is kept, plus "Do these first": (1) prove Vercel Services (React + Django `/api` on one address, HttpOnly session cookie working) locally **and with one Vercel preview deploy** (temporary URL, not production), else the two-project fallback; (2) one real TomTom truck call (US route, `maxAlternatives=5`); (3) connect the local folder to the GitHub repo. Production deploy stays at Step-13.
- **CSRF (new user decision):** Django's CSRF check stays on with `CSRF_COOKIE_HTTPONLY = True`; React gets the token from `/api/csrf`, keeps it only in memory, sends `X-CSRFToken` on every request that changes something. Written into `CLAUDE.md` Secrets, `docs/tech-stack.md` 9, spec 12 Security and spec 14, and, at the user's request, as a new **README Trade-offs** entry (the last one).
- **`CLAUDE.md` changes (all approved):** "Stack and commands" lists the whole stack (frontend, backend, hosting and data, providers, rendering, tools); the commands table still comes in Step-10. Guardrails: the cache is real data; time zones from timezonefinder; only public-by-design values in `VITE_` variables (Google client ID, Sentry DSN, PostHog key); every spec 4 limit and provider budget; a new signed-route-bundle line; shared state lives in Neon Postgres. UI rules: the slider never sends a request (all 49 hours come with the plan); map attribution (OpenStreetMap / OpenFreeMap, TomTom, Geoapify). Architecture: providers named, weather always through the cache, budget check before each provider call. Workflow: the Step-10 preview deploy is the one exception to "production deploys come at Step-13". This machine: run backend work on uv's Python 3.12. Known pitfalls: the corrupted `known_marketplaces.json` from Step-1.
- **Budget (user decision):** the user had removed the budget lines, so the PKR/credit mentions are gone from `CLAUDE.md` (section renamed "Right-sizing and cost"; it keeps "every dependency must be free; ask before anything paid"), spec 12 and this file. At the user's request, the 13,000 PKR figure was also removed from the README "free tiers, so v1 is non-commercial" trade-off (now "the budget is small"); nothing else in that entry changed.
- **Declined:** no non-commercial line in `CLAUDE.md` or the Roadmap (the user called it clutter). Don't propose it again.
- Spec 12: the outdated "decided in Step-5" and "Step-5 picks providers" lines now point to `docs/tech-stack.md`.
- **For Step-7:** design must include the map-corner attribution (OpenStreetMap / OpenFreeMap, TomTom, Geoapify), the error and limit messages in spec 11 (including the 2 Step-5 rows), the heatmap color scale and corridor width (tech-stack 12: within the 55 km cell budget), and fonts through Fontsource. Motion is not in the stack; ask before adding it. `docs/design.md` does not exist yet.

### 2026-11-01 - Step-7 (design.md)
- Used `superpowers:brainstorming`. Read spec, tech-stack and UIinspiration (sections 0-8, 9.1, 9.2, 9.4-9.7, 10-15).
- Rule-15: studied maps.google.com live with Claude-in-Chrome (desktop, Chicago to Dallas): floating left panel, bold blue selected route with a dark casing, lighter alternates, time/distance chips on the map, zoom bottom-right. Chrome would not shrink below desktop width, so phone uses Google's known bottom-sheet pattern.
- User decisions (interview, 3 rounds):
  - Planner: **Google Maps style**: full-screen map, side panel on desktop, bottom sheet (peek/half/full) on phone.
  - Theme: **light and dark with a toggle, light by default**. Needs a spec/CLAUDE.md change (theme is a second stored browser item) - proposed in design.md 13, not yet applied.
  - Landing: **full showcase**: arc flight (Weather, Load, Time), winding road (how it works, 5 stops), FAQ wheel, and **sideways scroll** = UIi 9.4 track "Inside the planner" (5 posters). Word bands, risk table, closing CTA, wordmark footer too.
  - Routes on map: **Google style** (selected blue, others muted, rank/time chips).
  - Risk colors: **traffic-light ramp** (green, amber, orange, red, purple), each with an icon; Low very faint on the heatmap.
  - Plan progress: **honest waiting state** (indeterminate bar, skeletons, Cancel); no fake step list.
  - Heatmap corridor: **route cells + 1 ring** (~165 km wide, ~300 calls for 1,500 mi, as tech-stack budgeted).
  - Heatmap cell **tooltip** (hover/tap) with level and cause.
- Facts checked: OpenFreeMap styles positron, dark, fiord, liberty all answer 200 at `https://tiles.openfreemap.org/styles/<name>`. Risk and route token colors pass WCAG (values in design.md 3.2, 3.3; checked with a script).
- Open-Meteo's free data is CC BY 4.0, so the design adds it to the attribution (proposal in design.md 13).
- Builder check (Sonnet subagent) done. Two more user decisions: an Interval/HOS change after the departure time has passed is **refused** ("Departure time has passed. Pick a new time." + Edit trip); Interval and HOS can also be set **in the form** ("More options") before the first plan. My calls added: 1st best selected when nothing is recommended; metric shows interval and mile labels in km; place suggestions cached per query.
- The user approved `design.md` as written, including its 17 "my calls" (section 14), and the section 13 doc edits, now applied: spec 3 (theme in v1), spec 10 (units and theme are the only browser-stored items), spec 11 (past departure also blocks an interval or HOS change), spec 14 ("Step-7 additions"), `CLAUDE.md` Secrets (units and theme) and UI rules (Open-Meteo added to attribution), tech-stack attribution line.
- Nothing was added to the README this step (the user did not ask).
- **For Step-8 (architecture.md):**
  - design.md 15 lists what Step-8 must settle: API shapes for routes, checkpoints and the 49-hour heatmap; SSG hydration of the landing's interactive parts (hue physics, FAQ wheel, track focus, phone menu); hooks behind every planner state (design 8.6); where the origin's time zone comes from before a plan (needed by the departure field); MapLibre bundle loaded on `/plan` only.
  - The Update call (interval/HOS change) must refuse a past departure with the spec 11 message, and the plan request carries interval and HOS from the form.
  - Heatmap corridor = route cells + 1 ring of 0.5-degree cells; the tooltip needs each cell's level and cause per hour. Checkpoint markers are a MapLibre layer (not HTML markers); route chips are HTML markers.
  - Map styles: `https://tiles.openfreemap.org/styles/positron` (light) and `.../styles/dark` (dark); map paint colors live in `mapTheme.ts`, mirrored from CSS tokens and tested.
  - Browser storage keys: `tp-units`, `tp-theme` (try/catch every access; an inline head script sets `.dark` before paint).
  - Step-8 must not change frontend behavior on its own: ask the user, then edit design.md (Roadmap Step-8).

### 2026-11-01 - Step-8 (architecture.md)
- Used `superpowers:brainstorming`. Read spec, tech-stack and design in full.
- Provider facts checked on the web: Open-Meteo rain, showers and snowfall at hour T are the sum over the preceding hour, and wind is the value at T. Its pages don't say how a request with several locations is counted, so we keep the cautious "each location = 1 call". 600/min, 5,000/h and 10,000/day per IP. TomTom: `maxAlternatives` (0-5) works with waypoints; `departAt` with default `traffic=true` uses typical speeds; no QPS figure is published (Step-10 measures it); POST exists.
- Found: a coast-to-coast plan with nothing cached needs about 970 Open-Meteo locations (800 heatmap cells at 0.5 deg + 1 ring, plus checkpoints), more than the 600/min limit. Estimates from `cells.py` in the session scratchpad: Chicago-Dallas 260 cells at 0.5 deg, LA-NY 804 / 333 / 128 at 0.5 / 1 / 2 deg.
- User decisions:
  - **Size to fit:** at most 500 weather locations per plan; heatmap cells 0.5 deg, growing to 1 or 2 deg to fit; intervals that don't fit are greyed out (50 mi always allowed). Needs spec 7.1/10, tech-stack 12 and design edits (architecture.md 16).
  - **Detours: 4 Waypoints in one parallel round** (left and right of the fastest route's midpoint at 15% and 30% of the straight-line distance), ladder applied to the candidates; at most 5 TomTom calls per plan.
- Builder check (Sonnet subagent) done. Fixed without asking: detour example distances (Chicago-Dallas is about 1,290 km in a straight line); bundle simplified at 20 m (about 150-400 KB, Step-10 measures; 50 m if over 1 MB); provider keys sit in URLs, so httpx errors are re-raised without the URL and Sentry breadcrumbs are scrubbed; `departAt=now` when the departure is under 1 min away; an update uses the plan's own `now` (spec 7.6 reading); a 429 from Open-Meteo gives back its reservation; when even 50 mi doesn't fit, the heatmap drops its ring.
- More user decisions: **rules run on raw forecast values, shown in full** (wind 0.1 mph, rain and snow 0.001 in/hr; I applied the same rule to snow as to rain, so tell the user if that is questioned); **a Low checkpoint shows just "Low"**; new copy approved: greyed option "10 mi (too many checkpoints for this trip)", note "10 mi needs too many checkpoints for this trip. Using 25 mi.", toast "This plan can't be updated. Plan the trip again."
- Applied (approved): spec 7.1, 8.2, 8.4, 8.5, 10, 14 ("Step-8 additions"); tech-stack 12; design 4.2, 8.2, 8.4, 8.5, 8.7, F6, 15. architecture.md 16 lists them.
- README: at the user's request, the "Heatmap cells are about 55 km wide" trade-off was **edited in place** (now "...larger on long trips", with the 500-location cap and the LA-New York example). This is the one approved exception to "keep every Trade-offs entry as it is".
- The user approved architecture.md as written, including all section 17 calls (after the builder-check fixes).
- Slice plan written with `superpowers:writing-plans`, adapted per the Roadmap: placed in architecture.md section 0 (not `docs/superpowers/plans/`), one slice per Step-11 session, each with files, produced interfaces, tests and commit message; a "Review focus" list of 5 easy-to-miss cases, each pinned to a slice test. Order: 1 risk engine, 2 tracks/checkpoints/HOS, 3 ranking, 4 sign-in/limits, 5 providers + cache, 6 detours, 7 weather cap/heatmap/truck, 8 endpoints, 9 frontend foundation, 10 sign-in screens, 11 planner shell + form, 12 results, 13 checkpoints, 14 heatmap/slider, 15 updates/units/theme, 16 landing, 17 monitoring/budgets/headers.
- Each Step-11 session: the main agent turns its slice's tests into TDD steps for one Sonnet subagent.
- Step-10 checks added by this step: TomTom alternatives with waypoints, far-future `departAt`, bundle size on a real answer, Open-Meteo value precision.

### 2026-11-01 - Step-9 (doc validation)
- Used `superpowers:brainstorming` (as a validation pass: read, find conflicts and gaps, interview). Read spec, tech-stack, design, architecture in full, plus CLAUDE.md and the Roadmap. No builder-check subagent (Rule-5); the review was done by hand. The docs agreed with each other; what was found were gaps and build-time traps, listed below.
- Checked live (2026-11-01): Vercel Hobby = 1M invocations, **4 Active CPU-hours/month**, 360 GB-hrs, 4.5 MB request and response bodies; over a limit the feature is blocked until 30 days pass. Neon Free = **100 CU-hours/month** (about 400 h awake at 0.25 CU), scale to zero after 5 min, 1 GB storage; when the hours run out, compute is suspended until next month.
- **User decisions (3 rounds, all the recommended option unless noted):**
  1. **Update cap: 120 updates (interval or HOS changes) per user per rolling hour**, stored as `update` usage events, code `rate_limited`, same "Limit reached" message. Reason: Vercel's 4 CPU-hours a month could be burned by a script. Also in CLAUDE.md guardrails.
  2. **Load field keeps the typed value and unit**; the units toggle only shows a converted number (30,001 lb -> km -> back = 30,001 lb). The request and `Plan.trip.load` carry the typed value and unit.
  3. **Any No Travel Checkpoint counts** (raw covered miles, not rounded): the route is Not recommended. Risk miles above 0 and below 0.1 show "under 0.1 mi"; the API sends risk miles at 0.01.
  4. **`/privacy` page (SSG) + "Delete my account"** (account menu, Radix Dialog, copy in design F13; `POST /api/account/delete`). Contact on the privacy page: **`ahmarali2004@gmail.com`** (the user typed this; not the GitHub link). Content in design 9.1.
  5. **Metric rain and snow: 2 decimals in mm/hr** (one 0.001 in step = 0.0254 mm, so values in different bands never look the same).
  6. **Waits of 60 min or more read "Try again in 14 h 5 min."** for every limit message.
  7. **After an update, the selected route and slider hour stay**; an open checkpoint detail closes; if the route left the top 3, select Recommended (else 1st best).
  8. **Neon free hours: accept, document, watch.** tech-stack 8 now states the risk honestly; README got a new trade-off "The free database runs only part of the day" (approved with the option). Step-14 checks Neon's usage page.
- **9 smaller fixes, approved as a batch:** detour backtrack and shared-road tests run on TomTom's raw points, with simplifying to 20 m only after routes are kept; slice 6 speed test (ladder under 0.5 s, sampling may go 100 -> 250 m); slice 5 key-leak test covers errors and logs, and the Sentry half moves to slice 17; Django behind Vercel's proxy (`SECURE_PROXY_SSL_HEADER`, `CSRF_TRUSTED_ORIGINS`), `DISABLE_SERVER_SIDE_CURSORS = True` for Neon's pooler, migrations from this PC on `DATABASE_URL_UNPOOLED` (never in the Vercel build: a preview would migrate the shared DB); CSP adds MapLibre `blob:` workers, `data:`/`blob:` images and a sha256 hash for the inline theme script; `/api/docs` only with `DEBUG`; clean-up of old usage rows on every recorded event, expired sessions at sign-in; number fixes in tech-stack (1-5 TomTom calls, 130-650 plans a day, bundle 150-400 KB, real Vercel Hobby limits) and copy ("plans and searches"); Step-10 notes below.
- **My calls added (in architecture.md):** the session table carries a `user_id` column (Django's documented `AbstractBaseSession` pattern) so account deletion removes all of a user's sessions with one DELETE; Google's public certificates are cached per process; `usage_event.user_id` deletes by cascade; an update refused for `departure_passed` or `invalid_bundle` deletes its update event.
- **Not changed:** README entry "Routes travel as a signed bundle" still says "about 50-150 KB" (the real estimate is 150-400 KB). It was left alone under the "keep every Trade-offs entry as it is" rule; ask the user in Step-15 whether to correct it.
- **For Step-10:**
  - The preview deploy must pass a **CSRF-protected POST**, not only the cookie check.
  - Google sign-in's allowed JavaScript origins: `http://localhost:<port>` and the preview **branch's stable URL** (Google allows no wildcards); production URL at Step-13.
  - If TomTom refuses a far-future `departAt`, bring a fallback to the user before slice 5.
  - `.env.example` gets `DATABASE_URL_UNPOOLED` and `CSRF_TRUSTED_ORIGINS` too (architecture 14).
  - The other provider checks are unchanged (architecture 0 "Before slice 1").

### 2026-11-01 - Step-10 (foundation)
- No skill is named by the Roadmap for Step-10; done by hand. Services set up with Claude-in-Chrome (Rule-0); every step is in `docs/api-setup-guide.md` (Rule-14).
- **Tools:** uv 0.13.6 (winget) with Python 3.12.16; Vercel CLI 65.9.0 (npm global, signed in as `ahmarali2004-7574`, team `ahmar9`).
- **Scaffold:**
  - `backend/`: uv project (`package = false`), Django 5.2.18, django-ninja 1.7.3, httpx, psycopg 3 (binary); dev: pytest, pytest-django, ruff. `truckpilot/settings.py` reads the root `.env.local` (stdlib loader in `truckpilot/env.py`, tested), parses `DATABASE_URL` with the stdlib (no `dj-database-url`), `CONN_MAX_AGE=0`, `DISABLE_SERVER_SIDE_CURSORS`, HttpOnly + Lax cookies, `SECURE_PROXY_SSL_HEADER`, Secure cookies and HSTS only when `VERCEL_ENV` is preview or production. `INSTALLED_APPS` is empty and `urls.py` has no routes yet: slice 4 adds auth, the custom user, the DB session store and the Ninja API at `api/`. **Sessions are temporarily `signed_cookies`** (only for the proof); slice 4 switches to the database session model. No migrations have run on Neon; the database is empty.
  - `frontend/`: Vite 8 react-ts template, React 19, React Router 8, TanStack Query 5, Tailwind v4 (`@tailwindcss/vite`), Vitest 5 + Testing Library + jsdom, ESLint 10 + typescript-eslint (strict) + react-hooks + Prettier. TypeScript `strict` on. `envDir: '..'` (one root `.env.local`), dev proxy `/api` -> `127.0.0.1:8000`. `App.tsx` shows only the name; slices 9-16 build the pages. Radix, cva, Phosphor, Fontsource, MapLibre, Sentry, PostHog, Playwright, google-auth, timezonefinder, sentry-sdk are added by the slices that use them.
  - Root: `vercel.json` (services `frontend` + `backend` with `framework: "django"`, rewrites `/api/(.*)` then `/(.*)`), `.vercelignore`, `.gitignore`, `.gitattributes` (LF), `.env.example`.
- **User decisions this step:**
  1. Install uv with winget and the Vercel CLI with npm.
  2. GitHub: **replace the remote history** (the remote had 1 commit with a 150-byte README); force-push the local folder as the first commit.
  3. Preview deploy with the **Vercel CLI only**; Git auto-deploys are connected at Step-13 (so pushes to `main` never deploy production early). Google origins: localhost now, production URL at Step-13.
  4. **Keep ESLint and pin TypeScript 6.0.x** (typescript-eslint supports only < 6.1; Vite's template now ships TS 7 + oxlint).
  5. Google: a **new Cloud project `truckpilot`** (id `truckpilot-513401`), External audience. Publishing needs a home page, a privacy-policy URL and an authorized domain, which exist only at Step-13, so it stays **Testing** with test user `ahmarali2004@gmail.com`; **publish at Step-13** (steps in api-setup-guide 6).
  6. PostHog: the free plan has one project; renamed "Default project" to **Truck Pilot**.
  7. **TomTom main call asks for 2 alternatives** (at most 3 routes; "more than 3" case removed). Applied to spec 6.1, 6.2, 14; architecture 6.4, 6.5, 6.13, 6.15, 16b, slice 5.
  8. **TomTom 429: wait a random 0.3-0.6 s and retry once**, then `provider_unavailable` (architecture 6.4, 17.3).
  9. Keep `docs/fs-assessment-spotter.pdf` **out of git** (public repo); it is in `.gitignore`.
  10. README: new trade-off "TomTom is asked for 2 alternative routes, not 5" (the user asked). "Run it locally (foundation, Step-10)" section added; no existing trade-off changed.
- **My calls (tell the user if questioned):** existing Vercel project **truck-pilot** (already owns `mytruckpilot.vercel.app`) is used, not a new one; Sentry has two projects, `truckpilot-api` (Django) and `truckpilot-web` (React), error monitoring only, no Session Replay; TomTom server key `truckpilot-server` limited to the Routing API; Google origins `http://localhost`, `:5173`, `:3000`; TomTom timeout 6 s -> **8 s** (architecture 17.3); `asgi.py` deleted (WSGI only).
- **Services and where values live** (all in `.env.local`, gitignored; names in `.env.example`): Neon project `truckpilot` (US East 1, Postgres 18, endpoint `ep-royal-field-b8qvhugy`), Geoapify project `truckpilot`, TomTom key `truckpilot-server` (my.tomtom.com), Google client "Truck Pilot web", Sentry DSNs, PostHog token + host. Vercel **Preview** env: `DJANGO_SECRET_KEY` (own value), `DATABASE_URL`, `TOMTOM_API_KEY`. Production env vars come at Step-13.
- **Proofs (Roadmap Step-10 "do these first"):**
  1. **Vercel Services works, so no two-project fallback.** Locally (`vercel dev`) and on preview `truck-pilot-pv7u30e9c-ahmar9.vercel.app` (Vercel sign-in protected), from the real browser: React and `/api` on one address; `document.cookie` is empty (CSRF and session cookies HttpOnly); POST without `X-CSRFToken` = 403; POST with it = 200 twice, then GET shows the session count 2; Django sees `secure: true` and the real host, so `CSRF_TRUSTED_ORIGINS` is not needed for same-origin requests; Django receives the full `/api/...` path. Neon from `iad1`: 1.4 s on a cold start, then 31 ms per request including a new connection. The temporary proof endpoints and the `PROOF_TOKEN` env var were deleted afterwards.
  2. **TomTom (real calls):** Chicago-Dallas truck 30,000 lb, `maxAlternatives=5` gave 6 routes (972-1,197 mi); `progress` has `pointIndex`, `distanceInMeters`, `travelTimeInSeconds` about every 100 points; alternatives work with a Waypoint (2 legs per route); `departAt` 11, 30, 180 and 400 days ahead all work (no fallback needed); "no route" = HTTP 400, `detailedError.code` `NO_ROUTE_FOUND`; about **5 calls/second per key** (10 at once gave 4 HTTP 429 `TooManyRequests`, no rate headers). **Speed** from `iad1` (TomTom `eastus`): 5 alternatives 9.2 s, 2 alternatives 3.7 s, 0 alternatives 1.1 s, Waypoint + 1 alternative 3.1 s; LA-New York with 2 alternatives 4.7 s of TomTom compute. Computing time, not download size, is the cost.
  3. **Open-Meteo:** wind 0.1 mph; rain and showers in 0.004 in steps; snowfall in 0.028 in steps (native 0.07 cm); at most 3 decimals in inches; `forecast_days=11` gives 264 hours; no nulls; units string for wind is `mp/h`.
  4. **Bundle size:** 63 KB at 20 m for 6 real routes with metres and seconds for every kept point (40 KB at 50 m); with at most 3 routes about 30-60 KB. 20 m stays.
  5. **GitHub:** local folder is a git repo on `main`, remote `origin` = `https://github.com/Ahmar004/truckpilot`. First commit `65c76c4` "Set up the project foundation with Django, React and Vercel Services" was force-pushed over the old remote commit (user decision 2); `/code-review` at low effort found nothing. Line endings are LF (`.gitattributes`).
- **Fixtures saved** (real answers, for slice 5 tests): `backend/tests/fixtures/tomtom_chicago_dallas_truck_alt5.json.gz`, `tomtom_chicago_dallas_waypoint_alt5.json.gz` (gzipped; 3.9 and 4.9 MB raw), `tomtom_no_route.json`, `openmeteo_3_locations.json` (Chicago, Tulsa, Dallas), `openmeteo_snow_3_locations.json` (Fairbanks, Yellowknife, Iqaluit). The TomTom fixtures were made with `maxAlternatives=5`; they still parse the same, and slice 5 can trim to 3 routes in the test if needed.
- **Problems that cost time (one line each in CLAUDE.md Known pitfalls):** `vercel dev` ran the system Python 3.13 (fix: `backend\.venv\Scripts` first on PATH) and then failed to run uv because the user folder `C:\Users\Ahmar Ali` has a space the CLI doesn't quote (fix: put uv's folder on PATH by its short name, e.g. `(New-Object -ComObject Scripting.FileSystemObject).GetFolder("<uv folder>").ShortPath`); piping values into `vercel env add` from PowerShell 5.1 mangled them (fix: Git Bash `printf '%s'`); `vercel link` appended `.env*` to `.gitignore` (removed: it hid `.env.example`); Ruff scanned `backend/.vercel/` before git existed (now `extend-exclude`); new shells don't see uv until PATH is refreshed (`$env:Path = Machine + User`).
- **Checks at the end:** backend Ruff clean, 4 pytest tests pass, `manage.py check` clean; frontend ESLint, Prettier, 1 Vitest test and `vite build` pass. `npm audit`: 0 in production deps; 13 moderate in dev-only lint tooling (minimatch via typescript-eslint), left as is.
- **For Step-11:**
  - Slice 4 must: add `django.contrib.contenttypes`, `django.contrib.auth` and the apps; set `AUTH_USER_MODEL` before the first migration; replace `SESSION_ENGINE` (`signed_cookies`) with the custom DB session store; mount the Ninja API at `api/`; run the first migration from this PC with `DATABASE_URL_UNPOOLED`. pytest-django will need a test database: decide then whether tests use a Neon branch or a local Postgres (ask the user; Neon's free plan allows branches).
  - Slice 5: TomTom `maxAlternatives=2` on the main call, `1` on detour calls, 8 s timeout, one retry on 429; parse `detailedError.code == "NO_ROUTE_FOUND"`; use the fixtures above.
  - Run backend commands with `uv run` from `backend/`; frontend from `frontend/`. Commands table is in CLAUDE.md.
  - Google sign-in on localhost works only for the test user until Step-13 publishing.

### 2026-11-01 - Step-11 (slices, session 1)
- Skill: `superpowers:subagent-driven-development`. Per slice: one Sonnet implementer (TDD, local commit) -> one Sonnet task reviewer -> fix loop if needed -> tests + Ruff -> `/code-review` low -> push. One subagent at a time.
- User decisions: **this session builds slices 1-3**; **commits go straight to `main`** and are pushed (Git auto-deploys stay off until Step-13).
- **Slice 1 done** (`ab3507f`, "Add the risk engine with spec band edges and load rules"): `core/constants.py` (`Level` IntEnum 0-4 = score, `.code`; `Cause` StrEnum; band edges as Decimal, rain/snow No Travel named `*_NO_TRAVEL_ABOVE_IN_HR` for the strict ">"; load limits; interval values and auto thresholds), `planning/risk.py` (`Rating`, `rate()`), 44 tests. Review approved; `/code-review` low clean.
- **Slice 2 done** (`98ed683`, "Add route tracks, checkpoint placement, HOS timeline and ETAs"): `planning/geo.py` (haversine, Douglas-Peucker indices, polyline encode/decode), `track.py` (`RouteTrack` validated on build, `at_distance`, `at_drive_s`, `simplify` keeps original metres/seconds), `hos.py` (`Stop`, `stops`, `eta`, `state_at`), `checkpoints.py` (`auto_interval`, `CheckpointPos`, `place_checkpoints`, `forecast_hour`, `in_window`); new constants `METERS_PER_MILE`, HOS seconds, `StopKind`, `TruckStatus`, `RouteSource`, `FORECAST_WINDOW_H`. Test helper `tests/planning/synthetic.py` builds straight 60 mph tracks. Added **timezonefinder 9.2.0** (pulls numpy + timezonefinder-data, about 78 MB installed; check the Vercel function size at Step-13). 107 tests.
- **Slice 3 done** (`47a7d9b`, "Add route numbers, ranking and the recommendation"): `planning/ranking.py` with `RatedCheckpoint(covered_mi, rating | None)`, `RouteNumbers(miles_by_level, no_data_mi, average_risk, has_no_travel)`, `RouteSummary(source, order, numbers, travel_s)`, `RankedRoute(rank, recommendation, route)`, `Ranking(routes, do_not_travel)`, `route_numbers()`, `rank()`; constants `Recommendation`, `TOP_ROUTES`, rounding precisions, `SECONDS_PER_MINUTE`. One review fix round (a test that couldn't fail); the two local commits were squashed into one before the push.
- **Whole-branch review of slices 1-3** (Sonnet): no Critical or Important issues. Chaining all three on the spec 13 example gives A = 1.50 and order B, A, C. One hardening commit `964a334` "Guard the planning rules against bad inputs": naive datetimes refused, `interval_mi <= 0` refused (it looped forever), `RouteTrack` refuses NaN/inf, `decode_polyline` raises `ValueError` on bad input, plus 2 ranking tests proving High miles come before average and average before travel time. **134 tests**, Ruff clean, `/code-review` low clean on every commit.
- **Calls I made (rulings; tell the user if questioned):**
  - Wind of 55 mph or more is No Travel from the band itself, so `load_rule` is False there (spec 8.3 says "any load").
  - Interval marks are placed strictly before the route length; a route of exactly 100.0 mi at 25 ends with the destination at 100, never a duplicate. A 100.04 mi route gets an extra destination Checkpoint covering 0.02 mi and both last labels read "Mile 100" (architecture 6.6 mandates whole-mile labels; check this in the UI slice 13).
  - The destination `mile` and `of_mi` round half up to a whole mile.
  - Rest wins if a break and rest fall due together (never happens with 8/11 h).
  - timezonefinder returning no zone raises an error.
  - Ranking compares values rounded half up through `Decimal`, never float `round()`. Full ties use an explicit key (API routes before Detour routes, then `order`).
  - **When no Checkpoint has weather data** (departure more than 10 days ahead), the 1st route by travel time is still "Recommended" (spec 9.4 read literally). **The user confirmed this (2026-11-01); don't re-ask.**
  - An empty average risk compares as 0. `/code-review` flagged it; it stays, because all routes share the departure, so either every route has data at mile 0 or none does (spec 9.2 "counts as a tie").
- **Process note:** one small re-review ran on Haiku by mistake; every other subagent ran on Sonnet, as the Roadmap says.
- **For the next Step-11 sessions:**
  - Slice 5 (Open-Meteo): turn every weather value into `Decimal(str(x))` (or parse JSON with `parse_float=Decimal`) before `rate()`; floats can land on the wrong side of a band edge.
  - Slice 8 (plan builder): `RouteSummary.travel_s` = ETA at the destination minus departure **including HOS stops**; `auto_interval()` gets the **fastest route's** length (pure driving time), not the selected route's.
  - Slice 7: `hos.state_at` does not clamp a negative offset; clamp in the caller.
  - Step-13: measure the Django function bundle (timezonefinder + numpy about 78 MB installed).
  - Briefs, reports and the review ledger lived in the gitignored `.superpowers/sdd/architecture/` and were deleted at the end of this session; git history and this log are the record.

## Context given to Step-5 (kept for reference)
- Skill: `superpowers:brainstorming`. Output: `docs/tech-stack.md` with 3 options for each part (and why picked or not), a rendering-strategy choice with reasons, and a 4-5 line summary. Keep it short. **Stop until the user approves it.**
- What the providers must do (spec 12 "Budget"): truck routing with alternatives and waypoints in the US and Canada; geocoding limited to the US and Canada; hourly forecasts of sustained wind, rain and snowfall depth for at least 10 days; Google sign-in. Also Sentry and PostHog (free tiers).
- Load on providers: one plan = routing (plus detour calls when fewer than 3 routes) + weather for every checkpoint + a 49-hour heatmap corridor, within 10 s for 95% of plans. Interval changes fetch weather again for new checkpoints.
- Rate-limit counts and shared state must live in a database or cache, never in process memory (`CLAUDE.md`).
- Django on Vercel is the riskiest choice, and the first deploy only comes at Step-13. So Step-5 should pick a Django-on-Vercel setup with current docs showing it works, and Step-10 can check it locally.
- GitHub repo already exists: `https://github.com/Ahmar004/truckpilot`. The local folder is not a git repo yet; connect it in Step-10.
- Docs live in `docs/`: `Roadmap.md`, `spec.md`, `progress.md`, `requirements.md` (archive), `UIinspiration.md`, `api-setup-guide.md` (empty).
- Python 3.13, Node 24 and git 2.53 are installed.
