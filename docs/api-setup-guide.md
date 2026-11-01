# Truck Pilot - API and service setup

How to set up every external service from scratch, and which `.env.local` value each one gives. `.env.example` at the root lists every variable; copy it to `.env.local` (never committed) and fill it in. Every service below is free and needs no card.

Values set up in Step-10 (2026-11-01) are noted with the names actually used, so they can be found again.

## 0. Local tools (Windows)
1. uv (Python): `winget install --id astral-sh.uv -e`, open a new terminal, then `uv python install 3.12`.
2. Vercel CLI: `npm i -g vercel`, then `vercel login` (finish the browser step).
3. Node 24 and git come pre-installed on this PC.

## 1. Django secret key
- `DJANGO_SECRET_KEY`: any long random string. Make one with `python -c "import secrets;print(secrets.token_urlsafe(50))"`.
- Use a different value on Vercel than locally.

## 2. Neon Postgres
1. Sign in at https://console.neon.tech.
2. **New project**: name `truckpilot`, region **AWS US East 1 (N. Virginia)** (same region as the Vercel Function), Postgres 18, only "Postgres database" switched on. Create.
3. On the project page click **Connect**. Branch `production`, database `neondb`, role `neondb_owner`.
4. With **Connection pooling on**, copy the string (host contains `-pooler`) into `DATABASE_URL`.
5. Switch **Connection pooling off** and copy the string into `DATABASE_URL_UNPOOLED` (used only from this PC for migrations).
6. Both strings end with `?sslmode=require&channel_binding=require`; keep that.

Step-10: project `truckpilot` (id `old-bar-63228283`), endpoint `ep-royal-field-b8qvhugy`.

## 3. TomTom Routing (truck routes)
1. Accounts made in 2026 sign in at https://my.tomtom.com (the old developer.tomtom.com dashboard shows only a login page for them).
2. **Keys > API & SDK Keys > Create Key**. Name `truckpilot-server`. Under Self-service APIs tick only **Routing API**. Leave "Domain whitelisting" off (the key is used only by the server). Create.
3. Click the masked key in the list to copy it, and paste it into `TOMTOM_API_KEY`.

Free tier: 20,000 Routing calls a month; about 5 calls a second per key (measured).

## 4. Geoapify (place search)
1. Sign in at https://myprojects.geoapify.com.
2. **Create project**, name `truckpilot`. A key is created with it.
3. Open **API keys**, click the eye icon, copy the key into `GEOAPIFY_API_KEY`.

Free tier: 3,000 calls a day. Attribution is required (map corner).

## 5. Open-Meteo (weather) and OpenFreeMap (map tiles)
No account and no key. Open-Meteo's free API is for non-commercial use, which v1 is. Both need attribution in the map corner.

## 6. Google sign-in (Google Identity Services)
1. https://console.cloud.google.com > project picker > **New Project**, name `truckpilot`, no organization. Create.
2. **Google Auth Platform > Get started**: app name `Truck Pilot`, user support email = your account email, audience **External**, contact email = your account email, agree to the Google API Services User Data Policy, **Create**.
3. **Clients > Create client**: type **Web application**, name `Truck Pilot web`. **Authorized JavaScript origins**: `http://localhost`, `http://localhost:5173`, `http://localhost:3000`. No redirect URIs (the button returns the ID token to our page). Create.
4. Copy the **Client ID** into both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`. The client secret is not used.
5. **Audience > Test users > Add users**: add every Google account that should sign in while the app is in Testing.
6. **At Step-13 (production):** add `https://mytruckpilot.vercel.app` to the JavaScript origins; in **Branding** fill the home page (`https://mytruckpilot.vercel.app`), the privacy policy (`https://mytruckpilot.vercel.app/privacy`) and the authorized domain `mytruckpilot.vercel.app`; then **Audience > Publish app**. Only openid, email and profile are used, so no Google review is needed.

Step-10: project id `truckpilot-513401`; publishing status Testing; test user `ahmarali2004@gmail.com`.

## 7. Sentry (errors)
1. Sign in at https://sentry.io (org `resorvoir`).
2. **Projects > Create project > Set up manually**: platform **Django**, products **Error monitoring only**, name `truckpilot-api`. Create.
3. Repeat with platform **React**, Error monitoring only (no Session Replay: it could record typed place names), name `truckpilot-web`.
4. **Settings > Projects > (project) > Client Keys**: copy the DSN of `truckpilot-api` into `SENTRY_DSN` and of `truckpilot-web` into `VITE_SENTRY_DSN`.

## 8. PostHog (analytics)
1. Sign in at https://us.posthog.com (US Cloud).
2. The free plan has one project; it is named **Truck Pilot** (Settings > Project > Customization).
3. **Settings > Project > General > Project token** (starts with `phc_`): copy into `VITE_POSTHOG_KEY`. It is public by design.
4. `VITE_POSTHOG_HOST=https://us.i.posthog.com`.

## 9. Vercel (hosting)
1. The project is **truck-pilot** in team `ahmar9`; it owns the domain `mytruckpilot.vercel.app`.
2. Link this folder once: `vercel link --yes --project truck-pilot --scope ahmar9`. (Linking adds a short-lived `VERCEL_OIDC_TOKEN` to `.env.local`; that is fine.)
3. Env vars on Vercel (Project > Settings > Environment Variables, or `vercel env add NAME preview`): `DJANGO_SECRET_KEY` (its own value), `DATABASE_URL`, `TOMTOM_API_KEY` are set for **Preview** (Step-10). Step-13 adds every server variable for **Production**, plus `ALLOWED_HOSTS=mytruckpilot.vercel.app` and `CSRF_TRUSTED_ORIGINS=https://mytruckpilot.vercel.app`, and the `VITE_` values for the build.
4. When piping a value into `vercel env add`, use Git Bash with `printf '%s'`; Windows PowerShell 5.1 mangles piped values.
5. Preview deploy: `vercel deploy` (never `--prod` before Step-13). Previews are behind Vercel sign-in; open them in a browser signed in to Vercel, or use `vercel curl <url>`.
6. Git auto-deploys are connected only at Step-13, so a push to `main` never deploys production early. `vercel git connect` failed ("Failed to connect"): the Vercel GitHub app is not installed for `Ahmar004/truckpilot`. Connect it in the browser: Vercel > project truck-pilot > Settings > Git > Connect Git Repository > GitHub > install the Vercel app for the repo > `Ahmar004/truckpilot`, production branch `main`.
7. Step-13 log: Production env vars were added with Git Bash `printf '%s' "$value" | vercel env add NAME production --sensitive` for secrets; the four `VITE_` values are public, so they use `--type config` (the CLI refuses a credential-looking `VITE_` value without an explicit type). Production deploy: `vercel deploy --prod --yes` from the root. Deployment Protection does not block `mytruckpilot.vercel.app` (checked with plain `curl`).
8. Migrations on Neon from this PC: `.env.local` values contain `&`, so do not `source` it in Git Bash. Load it with a Python script (as in the Step-13 log) or use PowerShell as in CLAUDE.md.

## 10. Local Postgres for backend tests (Step-11, user decision)
Backend tests never use Neon (each Neon query takes about 0.24 s from this PC, and tests must not touch the shared database). They run on a local PostgreSQL 18, the same major version as Neon.
1. Install it once (one admin prompt): `winget install --id PostgreSQL.PostgreSQL.18 --source winget --silent --override "--mode unattended --unattendedmodeui minimal --superpassword <random password> --serverport 5432 --disable-components pgAdmin,stackbuilder"`. It runs as the Windows service `postgresql-x64-18`, which starts with Windows.
2. Put the URL in `.env.local`: `TEST_DATABASE_URL=postgres://postgres:<password>@localhost:5432/truckpilot`. Create the empty `truckpilot` database once (`& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres -h localhost truckpilot`) so `makemigrations` can check history; pytest-django creates `test_truckpilot` itself and drops it after the run.
3. `uv run pytest` uses `truckpilot.settings_test`, which reads `TEST_DATABASE_URL` and refuses an empty value or a `neon.tech` host.
4. Run `makemigrations` against the test settings too, so it never connects to Neon: `$env:DJANGO_SETTINGS_MODULE="truckpilot.settings_test"; uv run python manage.py makemigrations`.
