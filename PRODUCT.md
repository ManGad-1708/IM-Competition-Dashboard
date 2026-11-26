# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Moderators (TAs)** run the FM214 Intelligent Machines competition on a laptop at the course: they call teams up, stamp start times, type the two measured distances, skip absent teams and come back to them, and fix results afterwards.
- **Students** (54 teams of 3–5) watch on their phones and on a projector: who is on now, who is next, the leaderboard and the bracket.

## Product Purpose
A live dashboard for the competition day. The Obstacle Course is the main event (score = distance of dropped object to T1 + distance of robot to T2; lower wins), run as a knockout: Qualifying (27 sheet-defined matches, winners + best loser) → Best of 28 → Best of 14 (best winner gets a bye to the Semis) → Quarter-Finals → Semi-Finals → 3rd place play-off and Finals. Match-ups after Qualifying are re-seeded by score each stage (seed i vs seed i + n/2). The optional Speed Track (laps in 30 s) is a separate bonus logger.

Success: the moderator never does bracket maths by hand, and every screen agrees within seconds.

## Operating Context
- Team list and qualifying match-ups live in `sheets/Teams.xlsx` and `sheets/QualifyingPlayoffs.xlsx`; the app reads them directly, so editing the sheets (and redeploying) changes the app.
- Hosted on Vercel Hobby with Upstash Redis; one operator password.
- Used in a lit lab/hall: projector and phones, daytime light.

## Capabilities and Constraints
- Public pages are read-only; admin controls only behind the operator login.
- Ties inside a match are decided by the moderator (explicit tie rule still to be supplied by the course staff).
- Seeding ties currently break by team number (placeholder until the staff rule arrives).
- No npm dependencies.

## Brand Commitments
- 8-bit / 16-bit retro console UI (SNES / Game Boy / NES RPG menus and HUDs), light mode — binding, from CLAUDE.md. It must feel like a playable console screen, not a web app with a pixel skin.

## Evidence on Hand
- Real team numbers and members in `sheets/Teams.xlsx`; only a few teams have names (others show as "Team NN").
- No scores exist yet; never invent results.

## Product Principles
1. The moderator's next action is always one tap away.
2. Derived, not typed: brackets, seeds and advancement are computed from scores.
3. Every result stays editable; edits re-flow the bracket.
4. Readable at a glance on a phone and from the back of a room.
