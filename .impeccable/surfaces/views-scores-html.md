---
version: 1
slug: "views-scores-html"
primary_target: "views/scores.html"
related_targets: ["views/schedule.html","views/speed.html"]
---

Scope: all competition dashboards (scores `/` + `/admin`, schedule `/schedule`, speed `/speed` + `/admin/speed`). Mode: Operate.
Audience/job: moderator enters runs fast on a laptop; students follow on phones and a projector.
Constraints: light mode; 8-bit RPG menu/HUD world pinned by CLAUDE.md; mobile friendly; no npm deps.

## Direction contract
THESIS: The competition is a console tournament. Every screen is an RPG menu/battle HUD: framed dialog windows, a blinking pixel cursor on the active team, VS cards per match. Refuses the SaaS card-grid dashboard with a pixel font pasted on.
OWN-WORLD: Pale sky-periwinkle ground with a faint 2px dither; white windows with a navy (#1b2142) 9-slice pixel frame and light bevel; P1 red (M side) vs P2 blue (B side); coin gold for winners and 1st; HP green for good; Press Start 2P for labels/headings, Pixelify Sans for names and numbers.
STORY: Students see who just played, who is ON STAGE, who is next, and where everyone ranks; moderator stamps time, types T1/T2, presses SAVE, and the bracket re-flows.
FIRST VIEWPORT: Scores: top strip of last 3 results, centre the big NOW PLAYING battle window (team no., name, members, opponent, T1/T2/score fields for admin), next-2 queue beside/below, leaderboard below the fold.
FORM: pinned by brief. seed: none (pinned) — "Build the interface to feel like a tactile, playable 16-bit/8-bit console screen (SNES / Game Boy / NES RPG menus and HUDs)... Keep a light mode design."
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
