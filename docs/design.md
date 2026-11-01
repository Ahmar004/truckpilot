# Truck Pilot - Design (frontend)

Step-7 output. It says **how the frontend looks and behaves**: screens, pop-ups, tabs, flows, tokens and components. What the app does is in `docs/spec.md`; what it is built with is in `docs/tech-stack.md`; how each feature is wired (API shapes, hooks, server logic) goes in `docs/architecture.md` (Step-8), which refers back here.

The style comes from `docs/UIinspiration.md` (written "UIi" below, for example "UIi 6.6" = its section 6.6). Where this doc says "as UIi x", build it exactly as that section says, with the changes listed here. The map's feel comes from Google Maps (Rule-15), studied live on maps.google.com on 2026-11-01 (Chicago to Dallas directions, desktop).

User decisions from the Step-7 interview are marked **(user)**. Lines marked **(my call)** are open for review; the full list is in section 14.

---

## 1. Intent

**Who:** truck drivers in the US and Canada, planning a trip before they leave, often on a phone, sometimes at night in a cab. The product demo runs on a desktop.

**What they must get in seconds:** which of up to 3 real truck routes is safest at their departure time, why (which checkpoints are risky, and what set the risk), and how the weather along the corridor changes over the next 48 hours.

**The bar:** Google Maps for the planner (big map, panel or sheet, a bold selected route, one tap to compare), and UIinspiration's playful, image-led polish for the public pages.

| | |
|---|---|
| Goals | The recommendation is obvious at a glance. Every number on screen is real. The slider and route switching react within 100 ms. Equally polished on a 390 px phone and a 1440 px desktop. WCAG 2.1 AA in both themes. |
| Non-goals | Turn-by-turn navigation, trip history, sharing, saved places, a guided tour, celebrations (confetti). |
| Anti-goals (a failure even if it works) | A busy map where risk colors and route colors fight. Any fake or placeholder number, including in landing illustrations. A step-by-step progress list that isn't really happening. A desktop layout that is a stretched phone layout, or the reverse. |

---

## 2. Inventory: screens, pop-ups, tabs and flows

### 2.1 Screens (routes)
| Path | Screen | Rendering | Access |
|---|---|---|---|
| `/` | Landing (section 6) | SSG | Public |
| `/sign-in` | Sign-in (section 7) | SSG shell, Google button loads in the browser | Public; a signed-in visitor is sent to `/plan` |
| `/plan` | Planner (section 8) | CSR | Signed in; otherwise sent to `/sign-in` (spec 11) |
| `/privacy` | Privacy (section 9.1, Step-9) | SSG | Public |
| any other path | Not found (section 9) | CSR | Public |
| any crash | Error page (section 9) | CSR error boundary | Public |

### 2.2 Planner states (one screen, section 8.6)
Empty, Planning, Results, Updating (interval or HOS change), Error with Retry, No route, Limit reached, Do not travel now, Fewer than 3 routes.

### 2.3 Pop-ups and overlays
| Pop-up | Where | Built with |
|---|---|---|
| Account menu: name, email, theme, sign out, delete my account | Planner header | Radix DropdownMenu |
| Delete account confirm (F13) | Over the planner | Radix Dialog (Esc = Cancel) |
| Landing menu (phone): page links, theme, sign in | Landing header below 64rem | Radix Dialog sliding from the left (UIi 5.3 sidebar) |
| Place suggestions | Origin and destination fields | ARIA combobox pattern (hand-built; Radix has none) |
| Checkpoint detail | Map popup (desktop) or sheet view (phone) | MapLibre Popup holding a React component; sheet view in the panel |
| Heatmap cell tooltip | Map, on hover or tap | MapLibre Popup, no close button |
| Map legend | Map, bottom-left | Collapsible card (Radix Collapsible) |
| Toast | Bottom-right (desktop), top (phone) | Radix Toast |

### 2.4 Tabs
The planner's results area has two tabs (Radix Tabs): **Routes** (the route cards) and **Checkpoints** (the selected route's checkpoint list). No other screen has tabs.

### 2.5 Flows
| # | Flow | Steps |
|---|---|---|
| F1 | First visit | Landing, "Sign in with Google", sign-in page, Google button, `/plan` in the Empty state. |
| F2 | Plan a trip | Pick origin and destination from suggestions, set departure and load, "Plan trip" (or Enter), Planning, Results with the recommended route selected. |
| F3 | Compare routes | Tap a route card, its line or its map chip: that route is selected everywhere (card, line, chip, markers, checkpoint list, truck marker). |
| F4 | Inspect a checkpoint | Tap a marker on the map or a row in the Checkpoints tab: its detail opens (spec 8.5). Esc or close returns focus to where it came from. |
| F5 | Look ahead in time | Drag the slider (or arrow keys): the heatmap recolors, the truck marker moves, the label shows the hour. No request. |
| F6 | Change interval or HOS | Before a plan: set them under "More options" in the form; they go with "Plan trip". After a plan: change the Interval select or the HOS switch: Updating state, then new results. The selected route and the slider hour stay; an open checkpoint detail closes (its checkpoint may have moved). If the selected route is no longer in the top 3, the Recommended route (else the 1st best) is selected (Step-9). On failure the control goes back to its old value and a toast says why, with Retry (if the plan's route bundle can't be verified, the toast says "This plan can't be updated. Plan the trip again." with no Retry). If the departure time has passed, the change is refused and the driver is asked to pick a new time (8.6). |
| F7 | Change units | mi / km toggle in the header: every value redraws at once, load field included. Remembered in this browser. |
| F8 | Change theme | Account menu (planner) or theme button (landing, sign-in): light or dark, map style included. Remembered in this browser. |
| F9 | Edit and re-plan | "Edit" on the trip summary opens the form with the last inputs; "Plan trip" starts F2 again. |
| F10 | Errors and limits | Section 8.6. |
| F11 | Sign out | Account menu, "Sign out": session ends on the server, the app goes to `/` and shows a toast "Signed out". |
| F12 | Session ended | Any API call answers "not signed in": the app goes to `/sign-in`, which shows "Your session ended. Sign in again." **(my call)** |
| F13 | Delete account (Step-9, user) | Account menu, "Delete my account": dialog titled "Delete your account?", body "This removes your name, email, Google ID and usage records from Truck Pilot. You can sign in again later as a new user.", buttons "Delete account" (danger) and "Cancel". On success the app goes to `/` with a toast "Account deleted". On failure a toast "Couldn't delete your account. Try again." and the dialog stays open. |

---

## 3. Design tokens

### 3.1 Base tokens
Copy UIi 2.2 (the full token CSS) into the global CSS **as is**, with these changes:
- Rename `--ent-a`, `--ent-b`, `--ent-c` to the product's three factors: `--weather` (teal), `--load` (violet), `--time` (slate). Same values, same `-display` variants (UIi 2.4). They are used **only on the landing page** (factor tags, arc flight words, illustrations), never on the map, so they never meet the risk colors.
- Class-based dark mode stays (`.dark` on `<html>`), but without `next-themes` (not in the stack). See 3.5.
- `--success` stays the accent, as UIi says. Risk "Low" has its own green (3.2), so the app still has a real green for safety.
- Add the tokens in 3.2 to 3.4. Components use tokens only: no hex values in component code (UIi 2).

### 3.2 Risk tokens (user: traffic-light ramp)
One token per level, usable as text (4.5:1 or more on `--bg`, `--surface` and the 15% tint badge, checked 2026-11-01), plus an icon (Phosphor) that always goes with it.

| Level | Token | Light | Dark | Icon |
|---|---|---|---|---|
| Low | `--risk-low` | #196B30 | #5BBF7A | CheckCircle |
| Moderate | `--risk-moderate` | #8A5A00 | #D9A84A | Info |
| High | `--risk-high` | #A63F06 | #F59A5B | Warning |
| Severe | `--risk-severe` | #B42318 | #F78A82 | WarningOctagon |
| No Travel | `--risk-no-travel` | #6B2E9E | #B99BF2 | Prohibit |
| No weather data | `--risk-none` = `--text-muted` | | | CloudSlash |

- On a filled marker, the icon is white in light and `--bg` in dark (5.9:1 or more).
- `--risk-high` is close to the light accent. That is accepted: a risk is never shown without its label or icon, and the accent never appears on the map.
- Contrast and the "no neon on dark" limit (UIi 2.4 rule 5) are added to the token unit test (UIi 2.3).

### 3.3 Map tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| `--route-selected` | #1A5FD0 | #4C8DF6 | Selected route line, 7 px |
| `--route-casing` | #0E3A85 | #0B1F44 | 2 px outline under the selected line |
| `--route-alt` | #7187A6 | #5D6E87 | Other routes, 5 px, under the selected one (3:1 or more on the base map) |
| `--heat-opacity-*` | 0.12 / 0.30 / 0.38 / 0.45 / 0.50 | same | Heatmap fill opacity for Low / Moderate / High / Severe / No Travel |

MapLibre paint values can't read CSS variables, so one TypeScript module (`mapTheme.ts`) holds these values per theme, mirroring the CSS. A unit test checks the two agree.

### 3.4 Planner sizes
`--panel-w: 26rem` (side panel), `--header-h: 3.5rem`, `--sheet-peek: 7.5rem`, `--sheet-half: 50svh`, `--sheet-top-gap: 4.5rem` (map stays visible above a full sheet).

### 3.5 Theme (user: light and dark with a toggle, light by default)
- First visit: **light**. A tap on the toggle switches and the choice is remembered in `localStorage` under `tp-theme` (not a secret). The units choice uses `tp-units`. These are the only two things the app's own code stores in the browser (spec change in section 13).
- A tiny inline script in the `<head>` of every HTML file reads `tp-theme` and sets `.dark` before the first paint, so nothing flashes. Every read and write is wrapped in try/catch; a blocked storage just means light and imperial.
- The toggle shows a sun or moon icon through the `dark:` variant (UIi 2.5), labelled "Switch to dark theme" / "Switch to light theme".
- The map changes style with the theme: **OpenFreeMap Positron** (`https://tiles.openfreemap.org/styles/positron`) in light and **OpenFreeMap Dark** (`.../styles/dark`) in dark **(my call)**. Positron is a calm grey map, so the blue routes and the risk colors stand out, which matters more here than Google's busier colors. Our layers (heatmap, routes, markers) are added again after the style switch.

### 3.6 Typography
As UIi 3, with Fontsource instead of `next/font`: **Nunito** (body, 400/600/700/800) and **Plus Jakarta Sans 800** (headings and wordmark), self-hosted **(my call: the UIi faces)**. Landing sizes as UIi 3. Planner sizes are smaller and denser: panel headings `text-xl font-extrabold`, card titles `text-lg`, body `text-sm`/`text-base`, all numbers `tabular-nums`. No italic anywhere (style guard test, UIi 2.3).

---

## 4. Components

### 4.1 From UIinspiration (build first, UIi 6)
SectionLabel, SectionLead, SectionHeading, PageIntro, BigNumber, PillLink + RoundArrow, Button, ImageTile, Card, Badge, Input, Dialog, Toast, Skeleton, Progress, the icon wrapper (`components/ui/icons.ts`, ESLint-enforced), SpriteArt, and the floating pill header. EntityTag becomes **FactorTag** (Weather, Load, Time: icon CloudRain, Package, Clock).

Not used: confetti, the spotlight tour, Motion, the turning drum (9.2) and the impact scene (9.3).

### 4.2 App components (new)
| Component | What it is |
|---|---|
| RiskBadge | Tint badge (UIi 6.12) in the level's token: icon + label, e.g. "Severe". Sizes sm/md. The only way a level is shown in text. |
| RiskMarker | Map checkpoint marker: 22 px circle in the risk color, 2 px white (light) or `--bg` (dark) ring, risk icon 12 px inside. No-data: `--surface` fill, dashed `--border-strong` ring, CloudSlash. Selected: 30 px with a 3 px `--route-selected` halo. |
| PlaceField | Labelled combobox: type 2+ characters, suggestions after a 250 ms pause; each query's answer is cached for the session and an outdated request is cancelled, to save Geoapify calls **(my call)**; arrow keys + Enter to pick, Esc closes. Shows the picked place as "Chicago, IL, USA". Typing after a pick clears the pick. Its list shows loading, empty ("No places found in the US or Canada"), error and limit states. |
| DepartureField | Native `datetime-local` (tech-stack 3), labelled "Departure", with the origin's zone under it: "Origin time (CST)". Disabled until an origin is picked. Defaults to the next quarter hour in the origin's zone **(my call)**. |
| LoadField | Number input with a unit suffix ("lb" or "kg"), whole numbers, min 0, max 80,000 lb / 36,287 kg. It remembers the number and unit as typed (Step-9): the units toggle shows the converted whole number, switching back shows the typed number again, and editing the field in the new unit makes that the typed value. Example: type 30,001 lb, switch to km (shows 13,608 kg), switch back (shows 30,001 lb). The request sends the typed number and unit. |
| UnitsToggle | Two-option segmented control "mi" / "km" (Radix ToggleGroup, single). |
| TripSummary | One line after a plan: "Chicago, IL to Dallas, TX · Tue, Nov 3 · 1:00 PM CST · 42,000 lb" plus an "Edit" button. |
| TripSettings | Row of: Interval select ("Auto (25 mi)", "10 mi", "25 mi", "50 mi"; Radix Select) and "HOS breaks" switch (Radix Switch). An interval the plan can't fit is a disabled item reading "10 mi (too many checkpoints for this trip)" (Step-8, `docs/architecture.md` 6.5). |
| RouteCard | Section 8.3. |
| CheckpointRow / CheckpointDetail | Section 8.4. |
| StatusMessage | Inline alert: tint of `--danger`, `--warning` or `--text-muted`, icon, one sentence, optional action button (Retry, Edit trip). `role="alert"` for errors, `role="status"` for notes. |
| ForecastSlider | Section 8.5. |
| MapLegend | Section 8.5. |
| BottomSheet | Section 8.1. The panel's container below 48rem. |

Every interactive element has the UIi focus ring and `active:scale-[0.97]` (UIi 6). Forms are real `<form>`s: Enter submits, Esc cancels (closes the open list, popup or edit).

---

## 5. Shared layout

- **Breakpoints:** phone below 48rem uses the bottom sheet; 48rem and up uses the side panel **(my call)**. Landing breakpoints follow UIi (40rem, 64rem).
- **Edge margin:** `--edge` from UIi (16 / 24 / 32 px). Full width, no centred page column (UIi 1).
- **Header:** the floating pill header (UIi 5.3) on every screen, one row at every width.
  - Landing and sign-in: wordmark left; on 64rem+ page links "How it works", "Inside the planner", "FAQ"; theme button; "Sign in" pill (PillLink small). Below 64rem the links move into the menu dialog.
  - Planner: wordmark left (links to `/`); right: UnitsToggle and the round account button (the first letter of the user's name; aria-label "Account menu"). It floats over the map.
- **Hue backdrop:** UIi 4.1 glows and 4.2 hue balls on landing, sign-in, privacy, 404 and error pages. Not on the planner, where the map fills the screen.
- **Page enter:** UIi 5.2 on landing, sign-in, privacy, 404 and error.

---

## 6. Landing page `/` (user: full showcase)

One h1. Every section is CSS-first; each scene degrades to a static layout under reduced motion or without scroll timelines (UIi 8.1). Section headings lock under the header as UIi 9.7. CSS used only by this page lives in files imported by its components (UIi 12 rule 2). Copy below is final unless you change it.

| # | Section | Build | Content |
|---|---|---|---|
| 1 | Hero | UIi 8.3 (word rise, float, parallax, first-screen fit) | Label `[ FOR TRUCK DRIVERS IN THE US AND CANADA ]`. h1 "Pick the safest truck route before you roll." Lead "Truck Pilot checks the hourly forecast where your truck will be, when it will be there, and recommends one of up to 3 real truck routes." PillLink primary "Sign in with Google to plan" (to `/sign-in`), secondary "See how it works" (to `#how-it-works`). Picture: a truck on a winding road under rain and wind (sprite). |
| 2 | Word band | UIi 8.4, slides left | WEATHER · LOAD · TIME · ROUTES · CHECKPOINTS |
| 3 | Arc flight (user) | UIi 9.1, 3 scenes | Heading: `[ WHAT WE WEIGH ]` "Three things decide your route." Scenes: **WEATHER** "Sustained wind, rain and snow from the hourly forecast at each checkpoint, at the hour you get there." **LOAD** "Heavy loads raise wind risk. Over 30,000 lb in 45 mph wind is No Travel." **TIME** "Arrival times include HOS breaks: 30 min after 8 h of driving, a 10 h rest after 11 h." Each word in its factor's display token, with its picture. |
| 4 | Winding road (user) | UIi 9.5, 5 stops | Heading `[ HOW IT WORKS ]` "From your trip to one recommended route." Stops (BigNumber + title + one line + picture): 01 "Enter your trip": origin, destination, departure time and load. 02 "Get up to 3 real truck routes" from a truck routing service. 03 "Checkpoints with arrival times" every 10, 25 or 50 miles, HOS breaks included. 04 "Forecast at each arrival hour", rated Low to No Travel. 05 "One recommended route", plus a 48-hour risk heatmap. Stop 05 has the PillLink "Plan your trip" (to `/sign-in`). |
| 5 | Sideways track (user) | UIi 9.4, 5 posters, swipe row on phones | Heading `[ INSIDE THE PLANNER ]` "What you see after you plan." Posters (16:9 illustrations of the real UI, no numbers that look like results): "Route cards" ranked 1st to 3rd, with the recommendation. "Checkpoint detail": arrival time, wind, rain, snow and what set the risk. "Risk heatmap" with the 0-48 hour slider. "HOS breaks" built into every arrival time. "Your settings": units, interval and HOS. Posters are not links (a poster has nothing to open); they are `li`s with a title and one line. |
| 6 | Risk levels | Open table (UIi 10 reading pages: tables stay) | Heading `[ RISK LEVELS ]` "The same rules everywhere." The spec 8.2 table with a RiskBadge per column header, then the 3 load rules (spec 8.3) as a short list, then "Metric units are one tap away in the planner." Values in imperial. |
| 7 | Word band | UIi 8.4, slides right | LOW · MODERATE · HIGH · SEVERE · NO TRAVEL |
| 8 | FAQ wheel (user) | UIi 9.6, 8 cabins | Heading `[ FAQ ]` "Questions drivers ask." Questions and answers, all from the spec: "Where do the routes come from?" (TomTom truck routing; never made up). "Where does the weather come from?" (Open-Meteo hourly forecasts, checked at each checkpoint's arrival hour). "Why only 10 days of weather?" (forecasts run 10 days from now; later checkpoints show No weather data and the trip is still planned). "What are HOS breaks?" (spec 7.3, US rules on every road, Canada included). "Why is a route Not recommended?" (it has No Travel miles; it is still shown and ranked). "Does it work in Canada?" (US and Canada only). "How many trips can I plan?" (30 an hour, 100 a day). "What do you store?" (Google ID, name, email, and the times of plans, searches and updates for 24 h; no trips; links to `/privacy`). |
| 9 | Closing call to action | UIi 10, `.reveal` | h2 "Plan your next trip." PillLink large "Sign in with Google" (to `/sign-in`). |
| 10 | Footer | UIi 5.4 | Columns: "Product" (How it works, Inside the planner, FAQ, Sign in, Privacy) and "Data" (TomTom, Geoapify, Open-Meteo, OpenFreeMap, OpenStreetMap, each linking to the provider). Giant outlined "Truck Pilot" wordmark. |

The landing page doesn't know whether the visitor is signed in (it is static HTML). "Sign in" always goes to `/sign-in`, which forwards a signed-in visitor to `/plan` **(my call)**.

Interactive parts (hue physics, FAQ wheel drag, track focus handling, the phone menu) hydrate on the static HTML; the rest needs no JavaScript. How the SSG output is hydrated is Step-8.

---

## 7. Sign-in page `/sign-in`

- Hue backdrop and the landing header (theme button, no "Sign in" pill).
- A centred Card (`max-w-sm`): label `[ SIGN IN ]`, h1 "Sign in to plan your trip", lead "Truck Pilot uses your Google account. We keep only your name, email and Google ID, and the times of your plans and searches for the usage limits." Then Google's own button (rendered by Google Identity Services; theme `outline` in light, `filled_black` in dark; text "Sign in with Google"). Then a "Back to home" link and a "Privacy" link (to `/privacy`, Step-9).
- While Google's script loads: a skeleton the button's size (no layout shift).
- Messages under the button (StatusMessage): "Your session ended. Sign in again." (F12); "Sign-in failed. Try again." if the server rejects the token or Google's script fails to load **(my call: copy)**.
- After success: go to `/plan`.

---

## 8. Planner `/plan` (user: Google Maps style)

### 8.1 Layout
The map fills the whole window. Over it float the header (top), the panel (side panel or bottom sheet), the slider, the legend and the map controls. One component tree; only the panel's container changes.

```
DESKTOP (48rem and up)                     PHONE (below 48rem)
+--[ header pill: wordmark   mi|km  (A) ]--+   +--[ wordmark  mi|km (A) ]--+
| +-----------+                           |   |                          |
| | panel     |          MAP              |   |          MAP             |
| | 26rem     |   routes, chips,          |   |                          |
| | form or   |   markers, heatmap        |   | [legend]                 |
| | summary   |                       [+] |   | [====== slider ======]   |
| | tabs      |                       [-] |   |-----------  ===  --------|
| | cards     | [legend] [== slider ==] [fit]|  | sheet: summary, tabs,    |
| +-----------+                 attribution|   | cards...                 |
+-----------------------------------------+   +--------------------------+
```

**Side panel (48rem+):** left edge margin, below the header to the bottom margin, `--panel-w` wide, `rounded-lg`, solid `--surface`, `shadow-card-hover`, scrolls inside. A tab on its right edge (chevron button, "Hide panel" / "Show panel") collapses it, as on Google Maps. The slider and legend shift right so the panel never covers them.

**Bottom sheet (phone):** three heights: peek (`--sheet-peek`: handle + trip summary or the form's first field), half (`--sheet-half`), full (to `--sheet-top-gap` below the top). Drag the handle (pointer events, snaps to the nearest height on release, 250 ms ease) or tap it to step peek, half, full, peek. The handle is a button ("Expand panel" / "Collapse panel") so the keyboard can do the same. Content scrolls inside at half and full. The slider sits just above the sheet at peek and half; at full the sheet covers it. Hand-built, no library **(my call)**.

**Sheet height per state (my call):** Empty: half. Planning and Results: half. Checkpoint detail: half. The driver can move it at any time.

### 8.2 Panel content, top to bottom
1. **Trip form** (Empty state, or after "Edit"): PlaceField "Origin", swap button (round, ArrowsDownUp, "Swap origin and destination"), PlaceField "Destination", DepartureField, LoadField, then **"More options"** (user: interval and HOS can be set before the first plan): a Radix Collapsible, closed by default **(my call)**, whose trigger reads "More options · Interval Auto · HOS breaks on". Inside: the same Interval select and HOS switch as TripSettings (defaults Auto and on, spec 7.1 and 7.3). Here Auto shows just "Auto", because the route length isn't known yet. Then the full-width primary Button "Plan trip" (`type="submit"`). Inline errors under each field (`aria-describedby`):
   - no pick: "Pick a place from the suggestions."
   - same place: "Origin and destination are the same place." (spec 5)
   - past time: "Departure time has passed. Pick a new time." (spec 11)
   - load: "Enter a whole number from 0 to 80,000 lb." (or "0 to 36,287 kg")
   In Results, "Edit" re-opens this form filled with the last inputs; Esc closes it back to the summary.
2. **TripSummary** (after a plan): replaces the form.
3. **Messages:** at most one StatusMessage at a time, by priority: error, limit, "Do not travel now", "Only N distinct truck routes exist between these places.", then the interval note (Step-8): when the interval picked under "More options" is too fine for the trip, the plan uses the next allowed one and an info message says "10 mi needs too many checkpoints for this trip. Using 25 mi."
4. **TripSettings:** Interval select and HOS switch, shown once there are results. They hold the same values as the form's "More options" (one state, two places). Here Auto shows its real value, e.g. "Auto (25 mi)". A change here is an Update (F6), not a new plan.
5. **Tabs:** "Routes" | "Checkpoints". Both keep their scroll position.

### 8.3 Route cards (Routes tab)
Up to 3 cards in rank order, as a single-choice group (`role="radiogroup"`, arrow keys move the choice). The recommended route is selected when results arrive; when none is recommended ("Do not travel now"), the 1st best is selected **(my call)**.

```
+-----------------------------------------------------+
| 1st best                          [check Recommended]|
| 926 mi  ·  15 h 20 min                               |
| Arrives Wed, Nov 4 · 4:20 AM CST                     |
| [octagon] Severe 25.0 mi  [warn] High 50.0 mi        |
| [prohibit] No Travel 0 mi   Average risk 1.50 of 4   |
| (note) 120 mi have no weather data yet (more than    |
|        10 days ahead from now)                        |
+-----------------------------------------------------+
```

- Content is exactly spec 10: rank label, Recommended or Not recommended, distance, travel time, local arrival time, Severe, High and No Travel miles, average risk, and the no-data note when there is one. Average risk shows "None" when no checkpoint has data.
- "Recommended": `--risk-low` tint badge with CheckCircle. "Not recommended": `--risk-no-travel` tint badge with Prohibit.
- Selected card: a 4 px `--route-selected` left bar and `--surface-hover` background (Google's selected card has the same left bar). Others lift on hover (UIi 6.11).
- Formats: distance whole miles ("926 mi"); risk miles to 0.1 ("12.5 mi", spec 9.3 rounding), and a value above 0 but below 0.1 reads "under 0.1 mi" (in metric "under 0.1 km"), never "0.0" (Step-9); travel time "15 h 20 min"; average risk 2 decimals.

### 8.4 Checkpoints (tab, rows and detail)
- **Checkpoints tab:** a heading with the route ("1st best · 38 checkpoints"), then one row per checkpoint: "Checkpoint 4 · Mile 75 of 412", the local arrival time, a RiskBadge and "set by wind" (or "No weather data"). A Low checkpoint shows the badge only, with no "set by" text (Step-8, spec 8.4). Rows are buttons.
- **Detail** (spec 8.5, exact lines and wording):
  ```
  Checkpoint 4  ·  Mile 75 of 412
  Arrives:  Tue, Nov 3 · 3:40 PM CST
  Wind:     38.0 mph
  Rain:     0.050 in/hr
  Snow:     0.000 in/hr
  Risk:     [Severe] set by wind (38.0 mph with a 45,000 lb load)
  ```
  Ties name every condition ("set by wind and snow"). Low shows "Risk: [Low]" with no "set by". A no-data checkpoint shows only the first two lines and "No weather data (more than 10 days ahead from now)".
- **Opening it:** tap a marker or a row. Desktop: a MapLibre popup above the marker, styled as a Card with a round close button; the row is highlighted and scrolled into view. Phone: the sheet shows the detail with a "Back to checkpoints" button, and the map pans the marker into the visible area above the sheet. Esc closes; focus returns to the row or the map.

### 8.5 Map
**Layers, bottom to top:** base map, heatmap fill, other routes (`--route-alt`), selected route (casing + `--route-selected`), checkpoint markers (selected route only, **my call**: markers for all 3 routes would cover each other), origin marker (white circle with a dark ring), destination marker (dark pin with a flag icon; not red, which means Severe here), truck marker, route chips.

- **Route chips** (user: Google style): a small pill at each route's midpoint: "1st best · 15 h 20 min". The selected route's chip is `--surface` with `--text`; the others are `--surface` at 85% with `--text-muted`. Chips are HTML markers (3 at most), focusable buttons ("Select 2nd best route"). Tapping a chip or a line selects that route. Lines get a wider invisible hit area for fingers.
- **Fit:** when results arrive, the map fits all routes inside the visible area (not under the panel or the sheet). A "Fit routes" button (ArrowsOut) under the zoom buttons does it again.
- **Controls:** zoom in, zoom out, Fit routes, bottom-right (Google's corner). No compass, no rotation, no tilt.
- **Attribution** (CLAUDE.md, plus Open-Meteo, see section 13): MapLibre's compact attribution control, bottom-right: "© OpenStreetMap contributors, OpenFreeMap, © OpenMapTiles, routes © TomTom, places © Geoapify, weather Open-Meteo", each linked.
- **Markers:** checkpoint markers are a MapLibre layer (fast with 200+ checkpoints); the Checkpoints tab is their keyboard path. Tap target at least 32 px (an invisible wider circle).
- **Keyboard on the map:** MapLibre's own keyboard pan and zoom when the map has focus. Everything the map does is also reachable from the panel.

**Heatmap (spec 10, R-22):**
- Cells are the 0.5-degree squares (about 55 km) of tech-stack 12, or 1.0 or 2.0 degrees (about 110 or 220 km) on long trips (Step-8 size to fit, `docs/architecture.md` 6.5). **Corridor (user): every cell a route passes through plus one ring of cells around them**, about 165 km (100 mi) wide at 55 km cells, and about 330 or 660 km with the larger cells.
- Each cell is filled with its risk level's color at the slider's hour, at the `--heat-opacity-*` value (Low very faint, so the corridor's edge still shows). No cell borders. Hours past the forecast window: no fill.
- **Cell tooltip (user):** hover (desktop) or tap (phone) a cell: "Severe, set by wind · Wed, Nov 4 · 1:00 AM CST". It follows the slider. No request.
- **Legend** (bottom-left, collapsible, open by default on desktop and closed on phone **(my call)**): "Risk" heading; the 5 levels and "No weather data", each with swatch, icon and label; a "Show heatmap" switch that hides only the heatmap layer **(my call: lets drivers read the routes clearly)**.

**Forecast slider (spec 10, R-23):**
- A floating Card at the bottom centre of the map's visible area, `min(36rem, 100% - 2 edges)` wide. Hidden until there are results.
- Label "Forecast hour", Radix Slider 0 to 48 (step 1), ticks every 6 h with labels 0, 6, 12, 24, 36, 48 (12 and 36 hidden on phones).
- Value text above it: "+12 h · Wed, Nov 4 · 1:00 AM CST". Times are in the **origin's** zone, the same zone as the departure **(my call)**. `aria-valuetext` says the same, plus the truck's position: "Truck at mile 312 of 926", "Truck on a 10 h rest at mile 660" or "Truck has arrived".
- Past the window: the value text adds "No forecast for this hour" (spec 10, S-1).
- Keys: arrows 1 h, Page Up/Down 6 h, Home/End. Moving it only changes which hour the layers show (no request, 100 ms target).
- **Truck marker (S-2):** an accent circle with a Truck icon on the selected route at the slider's hour; still during HOS breaks, at the destination after arrival.

### 8.6 States
| State | Panel | Map |
|---|---|---|
| Empty | Trip form, then a small illustration and "Enter a trip to see up to 3 truck routes rated for weather risk." | US and Canada overview. No slider, no legend. |
| Planning (user: honest waiting) | Form fields disabled, the button shows a spinner and "Planning..."; under it an indeterminate Progress bar, "Planning your trip. This can take up to 10 seconds.", 3 skeleton route cards the size of real ones, and a "Cancel" text button that stops waiting. No step list. | Old plan cleared; base map only. |
| Results | Summary, messages, settings, tabs. A polite live region says "3 routes found. 1st best is recommended." (or "Do not travel now"). | Routes, chips, markers, heatmap, slider, legend; fitted. |
| Updating (interval or HOS) | Current results stay visible, dimmed (`aria-busy`), a thin indeterminate bar on top; settings disabled. | Current layers stay until the new ones arrive. |
| Update failed | Old results stay, the control returns to its old value, a toast: "Weather service unavailable." with Retry. | Unchanged. |
| Departure passed (user) | An Interval or HOS change after the departure time has passed is refused (same rule as spec 11): the control returns to its old value, results stay, and a warning StatusMessage says "Departure time has passed. Pick a new time." with "Edit trip". Re-planning counts as a new plan. | Unchanged. |
| Error (S-9) | StatusMessage (danger) naming the service, e.g. "Weather service unavailable." with Retry, plus the form. Never partial results. | Base map only. |
| No route | "No truck route found between these places." with "Edit trip". | Base map only. |
| Limit reached | "Limit reached. Try again in N minutes." or "[Service] daily limit reached. Try again tomorrow." (warning tint, no Retry). A wait of 60 minutes or more reads "Try again in 14 h 5 min." (Step-9; same rule for the search limit). An update over its limit (120 an hour) is refused like Update failed: the control returns to its old value and a toast shows the same limit text. | Unchanged. |
| Do not travel now (spec 9.4) | A danger StatusMessage at the top of the results: Prohibit icon, "Do not travel now", and "Every route has No Travel miles at this departure time." No card is Recommended. | Normal results. |
| Fewer than 3 routes | Info StatusMessage: "Only N distinct truck routes exist between these places." | 1 or 2 routes. |

Place-search states (inside the PlaceField list): loading skeleton rows; "No places found in the US or Canada"; "Place search unavailable." with Retry; "Search limit reached. Try again in N minutes." (spec 11).

### 8.7 Units (spec 10)
Imperial by default: mi, mph, in/hr, lb. Metric: km, km/h, mm/hr, kg. Switching redraws every value at once, including the load field (it shows the converted whole number but keeps the typed value, see LoadField in 4.2). The landing page's risk table stays imperial. In metric, mile labels and interval options are shown in km too, rounded to whole km **(my call)**: "Checkpoint 4 · Km 121 of 663", Interval "Auto (40 km)", "16 km", "40 km", "80 km". The values sent to the server stay in miles. Display formats (Step-8: the rated values shown in full, so a shown value always matches its band): wind 1 decimal (mph and km/h); rain and snow 3 decimals in in/hr; rain and snow **2 decimals in mm/hr** (Step-9: one 0.001 in step is 0.0254 mm, so values in different bands never look the same; e.g. 0.099 in/hr = 2.51 mm/hr Low, 0.100 in/hr = 2.54 mm/hr Moderate); distances whole; risk miles 1 decimal. The server's numbers are imperial; conversion is display only (CLAUDE.md).

---

## 9. Not found and error pages
UIi 10: illustration, bracketed label, heading, one way out.
- 404: `[ 404 ]` "This road doesn't go anywhere." PillLink "Back to home".
- Error boundary: `[ ERROR ]` "Something broke on our side." "Reload" button and a "Back to home" link. Sentry gets the error. Minimal imports (UIi 12 rule 11).

### 9.1 Privacy page `/privacy` (Step-9, user)
A reading page (UIi 10): hue backdrop, landing header, label `[ PRIVACY ]`, h1 "What Truck Pilot keeps", then short sections with h2s, plain text only, all true to spec 4 and 10:
- **What we store:** your Google ID, name and email; the times of your plans, place searches and updates, used for the usage limits and deleted after 24 hours; your sign-in session (up to 14 days). We store no trip inputs or results.
- **Services that see trip data:** TomTom gets the trip's places, departure time and load to find routes; Geoapify gets what you type in the place fields; Open-Meteo gets map points to forecast. None of them gets your name or email. Google handles sign-in.
- **Errors and usage:** Sentry receives error reports with no trip inputs, cookies or keys; PostHog receives anonymous usage events (for example "plan succeeded") with no trip inputs.
- **In your browser:** your units and theme choices, the sign-in session cookie, and Sentry's and PostHog's own anonymous IDs.
- **Deleting your account:** "Delete my account" in the planner's account menu removes everything above at once (F13).
- **Contact:** `ahmarali2004@gmail.com` (user decision), as a mailto link.
- Footer and "Back to home" as on the landing page. Copy may be tightened when built, but must not promise anything the app doesn't do.

---

## 10. Motion
- UIi 8 as is on the landing, sign-in, 404 and error pages. Global reduced-motion kill switch (UIi 8.1).
- Planner: panel collapse slides (320 ms, UIi ease), sheet snaps (250 ms), popups use `animate-pop-in`, skeletons shimmer, the selected route's line width changes over 150 ms. The map's fit animates (600 ms) and jumps under reduced motion. The slider and route switching are instant (no animation in the 100 ms path).
- No text fades in on load (UIi 12 rule 1).

---

## 11. Accessibility (WCAG 2.1 AA, both themes)
- Everything in UIi 11, plus:
- Landmarks: header, `main`, the panel as `aside` ("Trip planner"), the map as a `region` ("Route map").
- A risk level is always icon + label (RiskBadge, RiskMarker icon, legend, tooltip). Route selection is never color only: rank labels on cards and chips.
- Live regions: results (polite), errors (assertive via `role="alert"`), Updating ("Updating routes").
- Keyboard path for every pointer action: cards and rows for the map's routes and markers, slider keys, the sheet handle button, the panel collapse button, Esc for every popup and edit.
- Tests: the token contrast test and style guard test (UIi 2.3), axe through Playwright on every screen in both themes at 390 px and 1280 px.

---

## 12. Illustrations (UIi 7)
Hand-drawn SVG sprites in token colors, recoloring for both themes. They show shapes and generic labels, never numbers that look like real results.
- Hero: truck on a winding road under rain and wind.
- Factors: Weather (cloud, rain, wind lines), Load (truck with a heavy trailer), Time (clock and road with a rest stop).
- Road stops 01-05: form, three roads, road with dots, cloud over a dot, one highlighted road.
- Planner posters 1-5: route cards, checkpoint card, map with shaded squares and a slider, a clock with a pause mark, toggles.
- FAQ wheel rim and stand, planner empty state, 404, error.

---

## 13. Changes this design made in other docs (approved and applied 2026-11-01)
1. **Theme stored in the browser** (user decision): spec 3 (in v1: light and dark theme with a toggle), spec 10 Units bullet and `CLAUDE.md` Secrets line change "only the units choice" to "only the units and theme choices".
2. **Open-Meteo credit:** Open-Meteo's free data is licensed CC BY 4.0, which requires credit. Add "Open-Meteo" to the attribution line in `CLAUDE.md` UI rules and tech-stack "Attribution shown in the map corner".
3. **Past departure on an update** (user decision): spec 11's "Departure in the past at submit" row also covers an interval or HOS change.

---

## 14. My calls (review these)
1. Map styles: OpenFreeMap Positron (light) and Dark (dark), not the more colorful Liberty.
2. Panel/sheet breakpoint at 48rem; sheet heights and the starting height per state.
3. Header layout: units toggle and account button in the planner header; theme in the account menu.
4. Checkpoint markers for the selected route only.
5. Slider and tooltip times in the origin's zone.
6. Trip form collapses into a one-line summary after a plan, with Edit.
7. Swap button between origin and destination.
8. Departure defaults to the next quarter hour; disabled until an origin is picked.
9. Suggestions after 2 characters and a 250 ms pause.
10. Legend open on desktop, closed on phone; a "Show heatmap" switch.
11. Session-ended and sign-in-failed messages; "Sign in" always goes to `/sign-in`, which forwards signed-in visitors.
12. Fonts: Nunito + Plus Jakarta Sans 800 (the UIi faces).
13. No "Detour route" tag and no HOS break rows in the checkpoint list (spec 10 doesn't ask for them).
14. "More options" in the form is closed by default; its trigger shows the current interval and HOS values.
15. With no recommended route, the 1st best is selected.
16. Metric mode shows interval options and mile labels in whole km.
17. Place suggestions are cached per query and outdated requests cancelled.

---

## 14a. Step-9 changes (user decisions, applied 2026-11-01)
`/privacy` page (2.1, 9.1, footer, sign-in link, FAQ); "Delete my account" (2.3, F13); route and slider hour kept after an update (F6); LoadField keeps the typed value (4.2, 8.7); "under 0.1 mi" (8.3); long waits in hours and minutes and the update limit (8.6); metric rain and snow at 2 decimals in mm/hr (8.7).

## 15. Settled in Step-8 (`docs/architecture.md`)
API shapes (architecture 4), SSG hydration (12.2), the hooks and reducer behind every state in 8.6 (12.3, 12.4), the origin's zone from the place suggestion (8), and the JS size budgets with MapLibre on `/plan` only (12.2). Step-8 also changed this doc (approved 2026-11-01): heatmap cell size and corridor width on long trips (8.5), greyed intervals and the interval note (4.2, 8.2), Low with no "set by" (8.4), full-precision weather values (8.4, 8.7), and the bundle toast (F6).
