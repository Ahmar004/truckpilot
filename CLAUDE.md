# Truck Pilot - Claude Code rules

Follow `docs/Roadmap.md` at all costs. At the start of every session, read the "Where to resume from" block of `docs/progress.md` and the Roadmap step it names.

Keep sessions short: one Roadmap step per session. Save progress and hand-off context to `docs/progress.md` whenever work is done, and always before the session ends (Rule-8). Long sessions fill the context window and quality drops.

This file and `docs/Roadmap.md` must say the same thing (Rule-7). If they disagree, stop and ask the user.

## What this project is

Truck Pilot is a web app for truck drivers in the US and Canada. The driver enters origin, destination, departure time and load weight. The app returns up to 3 real truck routes, checks the hourly forecast at checkpoints along each route at the time the truck will be there, rates the risk (load rules included), and recommends one route. A map shows the routes, the checkpoints and a 0-48 h risk heatmap. It is deployed publicly at `mytruckpilot.vercel.app` for real users, so it must be fast, scalable, reliable, easy to use and secure (Rule-3).

Priorities follow the brief's grading weights (spec 1): 40% route, weather, risk and recommendation logic; 40% UI, map and heatmap smoothness; 15% code quality; 5% docs.

## Stack and commands

React frontend and Django backend. This is a hard requirement (spec R-1). The rest was picked in `docs/tech-stack.md` (Step-5), which gives the reasons and the rejected options. Ask before adding a library or service it doesn't name.

- Frontend: React + TypeScript built with Vite, React Router, TanStack Query, Tailwind v4, Radix, cva (with clsx and tailwind-merge), Phosphor icons and Fontsource fonts. Map and heatmap: MapLibre GL JS with OpenFreeMap tiles.
- Backend: Django 5.2 LTS + Django Ninja (Pydantic) on Python 3.12, httpx for provider calls, timezonefinder + `zoneinfo` for time zones, `google-auth` for sign-in.
- Hosting and data: one Vercel project with Vercel Services: `/api` goes to Django (one Vercel Function), everything else to the React files, on one address. Neon Postgres (pooled connection) holds users, sessions, usage counts and the forecast cache. No Redis.
- Providers: TomTom (truck routing), Geoapify (place search), Open-Meteo (hourly forecasts), Google Identity Services (sign-in), Sentry (errors), PostHog (analytics).
- Rendering: the guide (landing, `/guide`) and privacy pages are pre-built to static HTML (SSG, `react-dom/server` after `vite build`); the planner, at `/` and `/plan`, is CSR with a sign-in pop-up for signed-out visitors. No SSR and no Node server.
- Tools: uv (Python), npm (JS), pytest + pytest-django, Vitest + Testing Library, Playwright, Ruff, ESLint + Prettier.

Commands (Windows; open a new terminal after installing uv so it is on PATH):

| What | Run in | Command |
|---|---|---|
| Install backend deps | `backend/` | `uv sync` |
| Backend tests | `backend/` | `uv run pytest` |
| Backend lint and format | `backend/` | `uv run ruff check .` and `uv run ruff format .` |
| Django checks | `backend/` | `uv run python manage.py check` |
| Migrations (Neon direct URL, from this PC only) | `backend/` | `$env:DATABASE_URL=$env:DATABASE_URL_UNPOOLED; uv run python manage.py migrate` |
| Django dev server | `backend/` | `uv run python manage.py runserver` (port 8000) |
| Install frontend deps | `frontend/` | `npm install` |
| Frontend dev server | `frontend/` | `npm run dev` (port 5173, proxies `/api` to 8000) |
| Frontend tests, lint, format, build | `frontend/` | `npm test`, `npm run lint`, `npm run format:check`, `npm run build` |
| End-to-end tests (starts Django with `E2E_MODE` on the local DB `truckpilot_e2e`, builds, and serves the build with `vite preview` and the `vercel.json` CSP) | `frontend/` | `npm run e2e` |
| Both services as on Vercel | root | `vercel dev --listen 3000` (see the pitfall below) |
| Preview deploy (Step-10 and Step-13 only) | root | `vercel deploy` |

## Source of truth

- Follow the Roadmap order: one step at a time, unless the user asks for several at once. Don't edit `docs/Roadmap.md` without the user's approval of the exact change (Rule-6). A change of plan goes into the Roadmap first, after approval, and only then is worked on (Rule-9).
- Which doc answers what. Read the relevant section before starting a task.
  - `docs/spec.md`: what we build, with `R-x`, `P-x` and `S-x` IDs. It replaces `docs/requirements.md` (archive) and `docs/fs-assessment-spotter.pdf` (the brief); don't read those two.
  - `docs/tech-stack.md`: what we build it with (Step-5).
  - `docs/design.md`: the frontend: screens, pop-ups, tabs, flows and design tokens (Step-7). Its style comes from `docs/UIinspiration.md`, and the map's feel from Google Maps (Rule-15).
  - `docs/architecture.md`: how each feature is built, frontend and backend, and the slice plan (Step-8).
  - `docs/progress.md`: what is done, where to resume from, and hand-off context.
  - `docs/api-setup-guide.md`: step-by-step setup for every external API and service, and which `.env.local` values each gives. Add a service's section in the same step that adds the service (Rule-14).
  - `README.md`: what is built, how to run it, the trade-offs, and how AI was used.
- Don't invent requirements. A decision these docs don't settle is an open question for the user.
- Keep `docs/Roadmap.md`, this file, `docs/spec.md`, `docs/tech-stack.md`, `docs/design.md` and `docs/architecture.md` consistent (Rule-7). When one changes, check the others.
- Only `CLAUDE.md` and `README.md` live at the root. Every other doc goes in `docs/`.

## Right-sizing and cost

- Keep things simple and avoid over-engineering (YAGNI, Rule-0.01). Size each solution to its problem: when a simple solution fully solves it, use that, and don't build for needs we only foresee. When no simple solution solves it, build what the problem actually needs. A simple fix that leaves the problem unsolved, or solves it the wrong way, is not simpler.
- Save tokens (Rule-5): read only the doc sections the task needs, find headings with grep before reading a whole file, and don't re-read a file already in context.
- Every dependency and service must be free. Ask before adding anything that needs a paid plan or billing details.
- No custom domain is bought. The app is served at its free `vercel.app` URL, so nothing may depend on owning a domain (for example, sending email from our own domain).

## Writing rules (code, UI copy, commits and docs)

- No emojis anywhere: not in code, comments, commit messages, docs or UI.
- No long dashes. Use a single hyphen "-" wherever a dash is needed.
- Use the words defined in spec section 2 (Route, Checkpoint, Interval, Covered miles, ETA, HOS, Risk level, No weather data, Forecast window, Plan, Waypoint, Detour route) and never invent synonyms. For example, a Checkpoint is never called a "waypoint" or a "stop". Enum-like values (risk levels, units, interval choices) come from one constants module on each side, never inline literals.
- Explain proposals and decisions in plain language: the problem, the choice, then a small worked example (numbers, a table or a sample card).

## Product guardrails

These restate spec rules that code can break without anyone noticing. The spec section holds the full rule.

- Real data only (Rule-10): every route comes from the routing API and every weather value from the forecast API. Never invent, duplicate or fill in either. When a provider fails, show the error with Retry and never partial or made-up results (spec 11). A forecast from the shared 1-hour cache is still real data (`docs/tech-stack.md` 12).
- Test fixtures: tests may use saved real provider responses so they are repeatable. The app itself never shows fixture or made-up data.
- One risk engine: checkpoint risk, the heatmap and the ranking all use one server-side module, so they can never disagree. The UI only displays results; it never computes risk or ranking.
- The risk rules always run on imperial values. The metric toggle changes display only (spec 8.4).
- Times: compute every time in UTC and convert to the location's local zone only for display (spec 7.4). A route that crosses from CST into EST must never be off by one hour. A point's zone comes from timezonefinder, offline.
- Secrets (Rule-12, spec 12): every third-party API key stays on the server. Never put a key or token in local storage, session storage, a JavaScript-readable cookie, a URL, a log, a Sentry event or a PostHog property. The app's own code stores only the units and theme choices in the browser; the sign-in session is an HttpOnly cookie, and Sentry and PostHog may keep only their own anonymous IDs (spec 10). Only values public by design go into the browser build (`VITE_` variables): the Google client ID, the Sentry DSN and the PostHog key. The CSRF cookie is HttpOnly too: the app gets the token from `/api/csrf`, keeps it only in memory, and sends it as the `X-CSRFToken` header on every request that changes something.
- The server decides: it re-checks every input (spec 5), requires a signed-in session for the planner and place-search APIs, and enforces every limit in spec 4: per user 30 plans per rolling hour, 100 plans per day, 120 updates (interval or HOS changes) per hour and 300 place searches per hour; per provider a daily budget for the whole app (TomTom 650, Geoapify 2,900, Open-Meteo 9,500 calls, reset at midnight UTC). A plan blocked by a provider budget is not counted against the user.
- An interval or HOS change reuses the plan's routes through the signed route bundle (`django.core.signing`, `docs/tech-stack.md` 12b). The server rejects a bundle whose signature fails and never uses routes the browser sends unsigned. Nothing is stored.
- Place names and any provider text render only as plain text, never as HTML.
- No state in one server process's memory. Usage counts, sessions, the forecast cache and anything else shared live in Neon Postgres, because Vercel runs many short-lived copies of the server. No file writes at runtime.

## UI rules

- Build screens from the tokens and components in `docs/design.md` before adding anything new.
- Every visible control works. No dead links, placeholder buttons or fake states, and no UI copy that promises something the app doesn't do.
- Layout: one fluid layout for any screen or window size, designed phone-first and equally polished on desktop, which is used for the product demo. Google Maps (maps.google.com) is the bar: great on a phone and great on a desktop. No separate mobile component trees.
- Speed (spec 12): results within 10 s for 95% of plans; the slider and route switching respond within 100 ms. A plan in progress shows progress so the app never looks frozen, and data that loads in shows a skeleton. The plan response carries all 49 heatmap hours, so moving the slider only changes which hour MapLibre colors by and never sends a request.
- Forms and dialogs: Enter submits, Esc cancels.
- Data credits: the credits (OpenStreetMap, OpenFreeMap, OpenMapTiles, TomTom, Geoapify and Open-Meteo, each linked) are in the guide page's footer; the map itself shows none (Step-14b, user decision).
- Visual bans (Rule-4): no italic font, no gradient-filled text, no rainbow gradients, and no colors that "explode" or leave yellowish edges (`docs/UIinspiration.md` 2.4).
- Accessibility: WCAG 2.1 AA. Contrast that passes, visible focus states, labelled inputs, keyboard alternatives to every pointer action, and animations that respect reduced motion. Color is never the only signal: a risk level always shows its label or icon too. Every screen has meaningful empty, loading and error states.

## Architecture

- No data fetching, timers or business logic inside UI components. Put them in hooks, keep components pure (data in through props, actions out through callbacks), and lift shared state to the nearest common parent.
- Business rules (route ladder, checkpoints, covered miles, ETAs and HOS, forecast hour, risk, ranking) live once, on the Django side, and are tested first.
- Every user-owned read or write is authorized on the server against the session. The UI alone never authorizes.
- Each external provider is reached through one module: TomTom (routing), Geoapify (place search), Open-Meteo (weather, always through the shared forecast cache) and Google (sign-in). Shapes match the real API payloads. Validate every response before using it, give every call a timeout, and check the provider's daily budget before each call.
- Shared code follows the Rule of Three: extract a helper on the third copy, not the first.

## Workflow

- Ask, don't assume (Rule-1, Rule-2). On any confusion or decision point, ask through the AskUserQuestion tool, put the recommended option first with "(Recommended)", and keep asking follow-up rounds until every open point is resolved. Don't end a turn with questions asked only in prose.
- Never re-ask a decision already made. Check `docs/progress.md` and the docs first.
- Ask questions with full context: say exactly where to look (our app on localhost, or an external site with its URL and click path), what to look for, and what each answer means.
- Invoke the skill a Roadmap step names before starting that step, and say which skill is in use.
- Testing: write tests first (TDD) for the business rules, input checks, the rate limit, API endpoints and hooks. Every user flow gets an end-to-end test. Check screens with screenshots at phone and desktop widths.
- Subagents (Step-11): Opus 5.5 for the main agent, Sonnet 5.5 for subagents, at most one subagent at a time.
- Git: one commit per finished slice, with a plain-sentence message (for example, "Add detour ladder for fewer than 3 routes"). Before each commit, all tests and the linter must pass, then run the `/code-review` skill at low effort and fix what it finds. Then push a branch and merge it through a pull request once CI is green: ruleset `ci-setup` on `main` requires the 3 CI checks and rejects direct pushes. Never commit `.env.local` or any secret. CI (`.github/workflows/ci.yml`) runs backend tests, frontend tests, lint, format check, build and Playwright e2e on every push and pull request; a push to `main` deploys to production only after it passes (Vercel's own Git deploys are off in `vercel.json`).
- README: when the user says "save this in the README", write it into `README.md` at once, never in another doc first. Write each trade-off as problem, choice, example. Keep every existing Trade-offs entry as it is. When a step changes what is built or how to run it, update `README.md` in the same step.
- Use current docs, not memory: fetch the current docs of any library or API before using it.
- Use the Claude-in-Chrome extension to check, debug and verify work on localhost, and to set up external services (Rule-0).
- Deploy only when the user asks, and only to Vercel at `mytruckpilot.vercel.app` (Rule-13). Production deploys come at Step-13 and, after it, from CI on a green push to `main`; the one exception is the Step-10 preview deploy that proves Vercel Services.

## This machine (Windows)

- Use `python`, not `python3` (`python3` opens the Microsoft Store).
- Python `open(..., 'w')` writes CRLF on Windows; pass `newline=''` when a script edits files.
- Python 3.13 is installed, but Vercel runs 3.12. Run backend work on uv's Python 3.12 (`uv run ...`).

## Known pitfalls

Add each problem that cost a session time here, in one line, with the details in `docs/progress.md`.

- If the `superpowers:*` skills don't load, check `~/.claude/plugins/known_marketplaces.json` for corruption (Step-1 log).
- `vercel dev` fails on Django unless `backend\.venv\Scripts` is first on PATH and uv is reached by its short path (the user folder has a space the CLI doesn't quote) (Step-10 log).
- Pipe values into `vercel env add` from Git Bash with `printf '%s'`; PowerShell 5.1 mangles them (Step-10 log).
- TypeScript stays on 6.0.x until typescript-eslint supports 7 (Step-10 log).
- When another session shares this folder, commit with `git commit --only <paths>`; a plain commit also takes the other session's staged files (Step-13 session 22 log).
- Local sign-in failing with 401 ("Sign in failed") was this PC's clock running about 7 s slow; the token check now allows 10 s of skew, and Windows "Sync now" fixes the clock (Step-14b log).
