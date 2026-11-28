# IM Competition Dashboard (FM214)

Live dashboards for the FM214 Intelligent Machines competition, styled like an 8-bit console RPG.

| Page | Public (students, projector) | Operator (password) |
|---|---|---|
| **Obstacle Course** — scoreboard (last results, now playing, leaderboard) / moderator desk (entry, queue, results, ties) | `/` | `/admin` |
| **Bracket** — every stage from Qualifying to the Finals | `/schedule` | same page |
| **Speed Track** — laps in 30 s, bonus logger + auto-scheduler | `/speed` | `/admin/speed` |
| CSV exports | `/api/obstacle.csv`, `/api/export.csv` (speed) | |

Every open screen picks up changes within about 2 seconds. Scores live in Upstash Redis, so refreshing, closing a laptop or redeploying loses nothing.

## The sheets drive the app

`sheets/Teams.xlsx`, `sheets/QualifyingPlayoffs.xlsx`, `sheets/Round2.xlsx` and the later-round sheets are read directly by the app (no conversion step):

- **Teams.xlsx** — a header row with `Group No`, `Group Members Names`, `Group Name`, and the M/B letter in the next column. Fill in a team's *Group Name* and it shows up everywhere; empty names show as "Team 07".
- **QualifyingPlayoffs.xlsx** — a header row with `Match No` and two team-number columns (`M Group No`, `B Group No`). Each row is one qualifying match.
- **Round2.xlsx** — the Best-of-28 match-ups, set by hand (when it has rows, the app uses them instead of seeding by score). Type the first match's **Start Time**; every row below starts after the one above (match length and gap are at the top). Typing a time over any Start Time moves that match and everything after it; delete it to go back to automatic. A team cell can be `W-Q1` (winner of the qualifying match 1 redo). A row whose Match No is `Redo Q1` is that redo, played where it sits in the list: it is scored as its own stage ("Qualifying Redo"), the original qualifying result is kept, and its winner fills the `W-Q1` slot.
  To rebuild it from the live qualifying scores (seeded the same way the app does): `python3 scripts/round2_from_live.py --force --redo 1` (add `--start "2:00 PM"` to set the first time). It replaces hand edits, so run it before editing.
- **Round3.xlsx, QuarterFinals.xlsx, SemiFinals.xlsx, Finals.xlsx** — the same layout for the later rounds. Type the first match's **Start Time** (and override any row) exactly as in Round2.xlsx. Leave the Team No columns blank: the app still pairs teams by score and the sheet only sets the times (and arenas) of match 1, 2, … Fill in team numbers on every row only to fix the match-ups by hand (then score corrections in the round before no longer re-pair them). Finals.xlsx has a `3rd Place` row and a `Final` row.
  To make a fresh one: `python3 scripts/round_sheet.py 3|qf|sf|final --start "3:00 PM"` (`--force` to replace an existing sheet, `--teams` to fill in the match-ups from the live scores).

Columns are found by their header text, so reordering columns or adding rows is fine. After editing a sheet, **commit and push (or redeploy)** — the new deploy reads the new sheets and every open screen reloads them automatically. Locally (`node local.js`) changes are picked up on save, no restart. Problems (a team in a match but not in the team list, a team in two matches, …) are listed under **Sheet check** on the operator page.

## How the tournament is computed

Nothing about the bracket is typed in — it's derived from the scores (`views/tournament.js`):

1. **Qualifying** — the 27 sheet matches. Lower score (T1 distance × T2 distance) wins. Winners advance, plus the best-scoring non-winner (wildcard) to make 28.
2. **Best of 28** — sorted by qualifying score; seed 1 plays seed 15, 2 plays 16 … 14 plays 28. If `sheets/Round2.xlsx` has rows, those match-ups are used instead.
3. **Best of 14** — same, by Best-of-28 score (1 v 8 … 7 v 14). The best winner goes straight to the Semis.
4. **Quarter-Finals** — the other 6 winners, by Best-of-14 score (1 v 4, 2 v 5, 3 v 6).
5. **Semi-Finals** — 3 QF winners (QF score) + the bye team (its Best-of-14 score): 1 v 3, 2 v 4.
6. **3rd place play-off** (SF losers) and **Finals** (SF winners) can run in either order.

**Ties** inside a match show as *Tie* and appear under **Needs a decision** on the operator page, where the moderator picks the winner. Seeding ties fall back to lower T2 distance, then team number (placeholder until the staff rule is set — change `seedCompare` in `views/tournament.js`). A **no-show** loses its match. Editing an earlier result re-flows every later round, and the page warns you when that can happen.

## Running the Obstacle Course (moderator desk, `/admin`)

The desk is a separate page from the public scoreboard: students never see its controls.

- **On course** is always the next team in match order. Press the clock to stamp the start time, type T1, **Enter**, T2, **Enter**. The score (T1 × T2) is saved and the next team comes up with the cursor back in T1.
- **Skip for now** puts a team in the "Come back later" list. **Call up** in the queue or results brings any team forward.
- **Edit** on any results row reopens that result. **Undo** reverts your last change.
- The **stage menu** in the top bar normally says *Auto* (earliest unfinished stage); pick a stage to run it explicitly (e.g. the Final before the 3rd-place play-off).
- Distances are in cm, with decimals.

## How it works

| Path | What it is |
|---|---|
| `api/index.js` | One Vercel serverless function: pages, login, state APIs, CSV exports, static assets |
| `lib/sheets.js`, `lib/xlsx.js` | Reads the .xlsx sheets (dependency-free unzip + XML) |
| `views/tournament.js` | Bracket logic, shared by browser and server (CSV) |
| `views/scores.html`, `admin.html`, `schedule.html`, `speed.html` | Public scoreboard, moderator desk, bracket, speed track |
| `views/obstacle.js` | Helpers shared by the scoreboard and the desk |
| `views/pixel.css`, `views/app.js`, `views/fonts/` | Shared 8-bit theme, live-sync client, self-hosted pixel fonts |
| `test/tournament.test.js` | Simulates a whole tournament: `node test/tournament.test.js` |

- **Storage:** Upstash Redis via its REST API. Obstacle Course and Speed Track are separate keys, each saved with an atomic compare-and-set on a revision number, so two operators can't silently overwrite each other.
- **Live updates:** screens poll every 1.5 s (paused in hidden tabs); responses are cached at Vercel's edge for 1 s.
- **Login:** one moderator password in `ADMIN_PASSWORD`. A successful login sets a signed, HttpOnly, SameSite=Strict session cookie that expires after 12 hours (`SESSION_HOURS`). Five wrong passwords from one address lock it out for 10 minutes. Changing the password (or `SESSION_SECRET`) logs everyone out. Every save is checked on the server, so the public pages can never write.
- No npm dependencies.

## Environment variables

| Name | Set by | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | you, in Vercel → Settings → Environment Variables | The operator password |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | the Upstash integration, automatically | The Redis connection. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` also work |

Never commit these. `.env*` files and `.vercel/` are git-ignored.

## Deploy

1. Import this repo in Vercel (**Add New → Project**). No build settings are needed.
2. Under **Storage**, add **Upstash for Redis** (free plan) and connect it.
3. Under **Settings → Environment Variables**, add `ADMIN_PASSWORD`.
4. Redeploy and use the production domain (`<project>.vercel.app`).

## Run it locally

Node 18 or newer:

```
echo 'ADMIN_PASSWORD=pick-a-password' > .env.local
node local.js
```

Open http://localhost:3000. Without the Redis variables, data is kept in memory and lost when you stop the server. The moderator pages always need the password, locally too; with no `ADMIN_PASSWORD` set they stay locked.

## Speed Track event day

The Speed Track page (`/admin/speed`) keeps its import, auto-scheduler and CSV tools: paste sign-ups under **Import, save and reset**, paste other competitions' run times into **Auto-schedule around other competitions**, build and apply, then mark **On track** and enter laps as teams run.
