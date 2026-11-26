# IM Competition Dashboard: Speed Comp

A live scoreboard for the Speed Competition. There's a public display for the projector and for teams, and a password-protected operator page where the scoring team enters teams and laps and runs the auto-scheduler.

- **Public display:** https://speed-comp.vercel.app (read-only)
- **Operator page:** https://speed-comp.vercel.app/admin (needs the operator password)
- **CSV export:** use the "Download CSV" button on the operator page, or open `/api/export.csv`

A change made on the operator page shows up on every open screen within about 2 seconds. Scores are saved in a database, so refreshing a page, closing a laptop or redeploying the app loses nothing.

It runs on free plans only: Vercel Hobby, with Upstash Redis for storage. It has no npm dependencies.

---

## How it works

| Path | What it is |
|---|---|
| `api/index.js` | One Vercel serverless function that handles every route: the pages, the login, the state API and the CSV export |
| `views/index.html` | The dashboard page. The same file is used for the public view and the operator view; the server switches on operator mode |
| `vercel.json` | Rewrites `/`, `/admin`, `/login`, `/logout`, `/healthz`, `/api/state` and `/api/export.csv` to the function |
| `local.js` | A small Node server for testing on your own machine |

- **Storage:** Upstash Redis, through its REST API using `fetch`. Every save is an atomic compare-and-set on a revision number, so two operators can't silently overwrite each other. The second one gets the latest version and a warning instead.
- **Live updates:** every screen fetches `/api/state` every 1.5 seconds, and pauses while its tab is hidden. Vercel's CDN caches that response for 1 second, so any number of screens costs only about one database read per second. That keeps the app comfortably inside the free tier.
- **Login:** a single operator password, set in the `ADMIN_PASSWORD` environment variable. Logging in sets an HttpOnly session cookie that lasts 30 days. Only a logged-in operator can save.

## Environment variables

| Name | Set by | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | you, in Vercel → Settings → Environment Variables | The operator password |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | the Upstash integration, automatically | The Redis connection. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` also work |

Never commit these. `.env*` files and `.vercel/` are git-ignored.

## Deploy your own copy

1. Import this repo in Vercel (**Add New → Project**). No build settings are needed.
2. Under the project's **Storage** tab, add **Upstash for Redis** on the free plan and connect it to the project.
3. Under **Settings → Environment Variables**, add `ADMIN_PASSWORD`.
4. Redeploy. Use the production domain (`<project>.vercel.app`). Preview and deployment URLs sit behind Vercel's sign-in by default.

Or deploy from the CLI:

```
vercel link
vercel integration add upstash/upstash-kv --billing-plan free
vercel env add ADMIN_PASSWORD production
vercel deploy --prod
```

## Run it locally

You need Node 18 or newer.

```
ADMIN_PASSWORD=test node local.js
```

Then open http://localhost:3000 and http://localhost:3000/admin. Without the Redis variables, data is kept in memory and is lost when you stop the server.

---

## Event day (28 Nov: team list at 10:00, competitions from 12:00)

1. **10:00: paste the Speed Comp sign-ups.** Open **Import, save and reset**, paste one team per line as `Team no., Team name` (no times yet), and click **Import rows**.
2. **10:00–10:45: collect the other competitions' run times.** Ask each competition lead for lines in the form `Team no., Team name, Competition, Start time, Minutes`. Use the same team numbers in every competition, because that's how teams are matched.
3. **Around 10:45: auto-schedule.** In **Auto-schedule around other competitions**, paste all the other runs. Set the first slot to `12:00`, set the minutes per slot to the run length plus changeover time, and set the time the last slot must end by. Click **Build schedule** and check the colours: green is fine, yellow is under your warning gap, and red is a clash. When you're happy, click **Apply to Speed Comp**.
4. **Around 11:00: publish.** Download the CSV and share the public link. From then on, don't rebuild the schedule, because that would move everyone. Add late teams by hand in a free slot.
5. **From 12:00: run it.** Mark the team that's running as **On track**, and enter laps (one decimal place) as each run finishes.

To work out how many slots you need, multiply the number of teams by the minutes per slot. For example, 30 teams × 8 min = 4 hours, so 12:00 to 16:00.

**Before the event:** open `/admin` on a laptop and the public link on a phone. Add a test team, check that it appears on the phone, download the CSV once, then clear everything with **Import, save and reset → Reset all**.
