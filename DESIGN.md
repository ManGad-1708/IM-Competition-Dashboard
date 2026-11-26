---
name: IM Competition Dashboard
description: FM214 Intelligent Machines competition day, played out as a light-mode 8-bit RPG menu and battle HUD.
colors:
  frame-navy: "#1b2142"
  ink-dusk: "#4a5280"
  ink-haze: "#6c74a0"
  periwinkle-ground: "#dfe6ff"
  dither-dot: "#cfd9fc"
  window-white: "#ffffff"
  window-well: "#eef2ff"
  dotted-rule: "#c6d0f3"
  frame-bevel: "#8ea5ef"
  button-lip: "#b9c5ee"
  button-pressed: "#e3e9ff"
  p1-red: "#d93a4a"
  p1-red-lip: "#9c2230"
  p1-red-pressed: "#bf2f3e"
  p1-tint: "#ffe4e6"
  p2-blue: "#2f62d6"
  p2-tint: "#e1e9ff"
  coin-gold: "#f5b324"
  coin-gold-lip: "#c2850a"
  coin-gold-pressed: "#e0a114"
  coin-gold-tint: "#fff1c4"
  coin-gold-ink: "#6e4a00"
  medal-silver: "#aab3cf"
  medal-bronze: "#d08a4c"
  hp-green: "#23924d"
  fault-red: "#c42f3d"
typography:
  display:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0em"
  headline:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0em"
  title:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0em"
  score:
    fontFamily: "Press Start 2P, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0em"
  name:
    fontFamily: "DotGothic16, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0em"
  body:
    fontFamily: "DotGothic16, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0em"
  label:
    fontFamily: "DotGothic16, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.08em"
  button:
    fontFamily: "DotGothic16, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.06em"
  field:
    fontFamily: "DotGothic16, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0em"
rounded:
  none: "0px"
spacing:
  row: "4px"
  tight: "8px"
  gap: "12px"
  page: "16px"
  frame-window: "8px"
  frame-control: "6px"
  frame-tag: "3px"
components:
  button:
    backgroundColor: "{colors.window-white}"
    textColor: "{colors.frame-navy}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "44px"
  button-pressed:
    backgroundColor: "{colors.button-pressed}"
    textColor: "{colors.frame-navy}"
  button-go:
    backgroundColor: "{colors.coin-gold}"
    textColor: "{colors.frame-navy}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "44px"
  button-go-pressed:
    backgroundColor: "{colors.coin-gold-pressed}"
  button-red:
    backgroundColor: "{colors.p1-red}"
    textColor: "{colors.window-white}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "44px"
  button-red-pressed:
    backgroundColor: "{colors.p1-red-pressed}"
  button-sm:
    padding: "0 8px"
    height: "36px"
  field:
    backgroundColor: "{colors.window-white}"
    textColor: "{colors.frame-navy}"
    typography: "{typography.field}"
    rounded: "{rounded.none}"
    padding: "4px 8px"
    height: "48px"
  window:
    backgroundColor: "{colors.window-white}"
    textColor: "{colors.frame-navy}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
  window-well-row:
    backgroundColor: "{colors.window-well}"
    textColor: "{colors.frame-navy}"
    rounded: "{rounded.none}"
    padding: "6px 8px"
  tag:
    backgroundColor: "{colors.frame-navy}"
    textColor: "{colors.window-white}"
    rounded: "{rounded.none}"
    padding: "2px 6px"
  tag-gold:
    backgroundColor: "{colors.coin-gold}"
    textColor: "{colors.frame-navy}"
  tag-red:
    backgroundColor: "{colors.p1-red}"
    textColor: "{colors.window-white}"
  tag-blue:
    backgroundColor: "{colors.p2-blue}"
    textColor: "{colors.window-white}"
  tag-green:
    backgroundColor: "{colors.hp-green}"
    textColor: "{colors.window-white}"
  tag-ghost:
    backgroundColor: "{colors.button-pressed}"
    textColor: "{colors.ink-dusk}"
  vs-chip:
    backgroundColor: "{colors.frame-navy}"
    textColor: "{colors.window-white}"
    typography: "{typography.headline}"
    rounded: "{rounded.none}"
    padding: "8px"
---

# Design System: IM Competition Dashboard

## Overview

**Creative North Star: "The Tournament Cartridge"**

Every screen is a console menu from a 16-bit RPG, lit for daytime: a pale periwinkle field with a 2px dither, and on it white dialog windows drawn with a navy pixel frame and a periwinkle inner bevel. The competition reads as a game in progress. The team on stage is a battle window with a blinking pixel cursor; each match is a VS card; winners get coin gold; the knockout stages are pins on a dotted world-map route. Nothing is a rounded web card wearing a pixel font: the frames, buttons, fields and tags are 9-slice pixel art (`border-image` SVGs at 5x5 or 3x3 source pixels), so every corner is a real stepped notch.

Density is HUD-like and compact: windows stack in a single 1320px column with 16px gaps, rows inside windows sit on a pale well tint 4px apart, and numbers carry the weight in the pixel display face. Light mode is a binding brand commitment; there is no dark theme, and `color-scheme` is pinned to light.

Motion is console motion: everything moves in `steps()`, never eased. Cursors and the live dot blink at 1s/1.2s steps(1); a fresh score rises into place in six steps; a re-flowed bracket card flashes gold in four steps. Reduced motion turns all of it off.

**Key Characteristics:**
- 9-slice pixel frames on every container and control; zero border-radius anywhere.
- Two-sided colour logic: P1 red is the current player / top seed, P2 blue is the opponent / bottom seed.
- Coin gold means "won", "1st", or "primary action"; HP green means "live / good"; navy is the frame and the ink.
- Press Start 2P for numbers, titles and the VS chip; DotGothic16 for names, body and labels.
- Stepped, frame-by-frame motion only.

## Colors

A cool periwinkle-and-navy console palette with three saturated game signals (red, blue, gold) and one status green.

### Primary
- **Frame Navy** (frame-navy): the outer pixel ring of every window, button, field and tag; all primary text; the VS chip fill; the default tag fill; the progress-bar and timeline outline.
- **P1 Red** (p1-red): the current player and the top seed. Fills the blinking cursor, the big team number in Now Playing, the score stat, the red action button, the P1 window bevel, the active map pin, the selected stage underline and the input caret.

### Secondary
- **P2 Blue** (p2-blue): the opponent and the B side. Opponent team number in the face-off, blue seed tags, "On now" and "On track" badges, and links.
- **P1 Tint / P2 Tint** (p1-tint, p2-tint): the two fighter panels of the face-off. P2 tint also marks the current team's row in the leaderboard, bracket and speed sheet.

### Tertiary
- **Coin Gold** (coin-gold): winners, first place, and the single primary "go" button (save, confirm). Also the focus ring and text-selection colour, the gold window bevel for decisions and champions, and the done map pin.
- **Gold Tint** (coin-gold-tint) and **Gold Ink** (coin-gold-ink): winning bracket sides, first-place rows, the just-saved result row, callouts and decisions. Gold ink is the readable text colour on gold tint.
- **Medal Silver / Medal Bronze** (medal-silver, medal-bronze): podium trophies for 2nd and 3rd only.
- **HP Green** (hp-green): the Live indicator, the stage-progress bar fill, "Stage clear", wildcard tags, OK messages.
- **Fault Red** (fault-red): offline state, invalid-field outline, error messages. Distinct from P1 red, which is a side, not an error.

### Neutral
- **Periwinkle Ground** (periwinkle-ground) with **Dither Dot** (dither-dot): the page background, a 4x4 two-dot SVG tile scaled to 8px and rendered pixelated.
- **Window White** (window-white): window, field and button fill.
- **Window Well** (window-well): inset rows inside windows (results, queue, leaderboard cells, bracket sides).
- **Dotted Rule** (dotted-rule): the dashed 8px/2px rule above disclosure blocks on the Speed Track desk.
- **Ink Dusk** (ink-dusk): secondary text, labels, meta (7:1 on white).
- **Ink Haze** (ink-haze): placeholders and locked states only; large text only.
- **Frame Bevel, Button Lip, Button Pressed, Gold Lip, Red Lip** (frame-bevel, button-lip, button-pressed, coin-gold-lip, p1-red-lip): pixel-art shading inside the 9-slice frames. They live only inside frame SVGs, never as surface fills of their own (button-pressed doubles as the ghost tag fill).

### Named Rules
**The Two Sides Rule.** Red and blue are teams, not semantics. Red is always the current player / top seed and blue is always the opponent; never use either to mean "error" or "info". Errors use fault red.

**The Coin Rule.** Gold is earned: a win, first place, a decision that needs the moderator, or the one primary button in a row. One gold button per action row.

## Typography

**Display Font:** Press Start 2P (with ui-monospace, monospace)
**Body Font:** DotGothic16 (with ui-sans-serif, system-ui, sans-serif)

**Character:** Press Start 2P is the cartridge's numerals and headers: blocky but anti-aliased for readability, used sparingly at 11 to 40px. DotGothic16 is a legible dot-matrix face for everything a person must read fast: team names, members, labels, body. Both are self-hosted woff2 with latin and latin-ext subsets, and `font-synthesis:none` is set globally.

### Hierarchy
- **Display** (400, 40px, 1): the on-stage team number in Now Playing (26px on mobile; 24px for the opponent side).
- **Headline** (400, 20px, 1.2): the HUD logo, page titles, the big VS chip, the Champion headline.
- **Title** (400, 16px, 1.3): window titles (14px under 720px, 14px in bracket columns). Map pin names and sub-headings drop to 12px.
- **Score** (400, 16px, 1): every score, lap count and rank number; tabular. Stat values in Now Playing scale to 24px (20px mobile), speed laps to 22px.
- **Name** (DotGothic16, 34px, 1.1): the on-stage team name; list names run 17 to 20px.
- **Body** (DotGothic16, 18px, 1.45; 17px under 720px): running text and table cells.
- **Label** (DotGothic16, 14px, 0.08em, uppercase): stat labels, table headers, field labels, window-title meta, match headers.
- **Button** (DotGothic16, 16px, 0.06em, uppercase; 14px small).
- **Field** (DotGothic16, 22px, 1.1, tabular): numbers typed by the moderator.

DotGothic16 ships one weight. Source declares 600 and 700 on names, buttons and labels, but with `font-synthesis:none` these render at 400; hierarchy is carried by size, case and tracking, not weight.

### Named Rules
**The Pixel Numbers Rule.** Scores, ranks, team numbers, times and lap counts are set in Press Start 2P; names and words are DotGothic16. A number a student scans from the back of the room is always pixel type.

**The Smooth Text Rule.** All text renders anti-aliased (`-webkit-font-smoothing:antialiased`) with 0.02em tracking on DotGothic16; Press Start 2P keeps letter-spacing 0. Readability on phones and projectors beats hard pixel edges in type; the pixel character lives in the frames and icons.

## Layout

A single centred column, max 1320px, 16px side padding and 16px gaps between windows (10px padding and 12px gaps under 720px). The HUD (logo, menu window, live status, admin bar) wraps above it.

The scores page stacks: a full-width "Last battles" log window, then a stage row split 1.9fr / 1fr (Now Playing face-off beside the Up Next queue), then the leaderboard. Under 1000px the stage row collapses to one column. The face-off is a three-column grid (P1 fighter 1.5fr, VS chip, P2 fighter 1fr); under 720px it evens out to 1fr / auto / 1fr. Stats run four across, two on mobile.

The bracket is a horizontally scrolling row of stage columns (min 264px, scroll-snap) under a world-map route of stage pins; edge masks fade 56px when more columns hide off-screen. Under 720px the bracket shows one selected column at a time, chosen from the map.

Row rhythm inside windows: 4px between well rows, 6 to 10px row padding, 12px column gaps. Leaderboard tables use `border-spacing:0 4px` so each row is a separate well strip. Columns that do not fit on mobile are hidden (`d-only`) and folded into the name cell (`m-only`).

## Elevation & Depth

Flat, no shadows. Depth comes only from the pixel art itself: a 1px (rendered 2px) periwinkle bevel inside each window frame, a darker bottom lip inside buttons, and a pressed state that swaps the frame to a flat fill and drops the button 2px. Inset rows read as recessed through the well tint, not through shadow.

### Named Rules
**The No Soft Shadow Rule.** No `box-shadow`, blur or gradient lighting. If something needs to lift, draw it into the frame SVG as pixels.

**The Press Down Rule.** A pressed button moves `translateY(2px)` in one step (60ms steps(1)) and loses its lip; that is the only elevation change in the system.

## Shapes

Zero radius everywhere. Every corner is a notched pixel corner produced by a 9-slice `border-image`: windows use a 5x5 source sliced at 2 and drawn as an 8px border; buttons, fields and map pins use the same 5x5 geometry at 6px; tags use a 3x3 plus-shape source at 3px, giving a one-pixel notch. Frames are coloured per role by swapping the SVG (`.win.p1` red bevel, `.win.gold` gold bevel, `.win.flat` no bevel). Rules are dotted, not solid: 8px dash period at 2px (title underline) or 4px (map route). Progress bars and timelines are hard 3px navy boxes with square fills. Icons are pixel SVGs drawn on a 7 or 8 unit grid with `shape-rendering:crispEdges`, sized to 1em.

## Components

### Buttons
Chunky, tactile, uppercase cartridge buttons.
- **Shape:** notched 9-slice frame, 6px border, no radius; min height 44px (36px small).
- **Default:** white face with a periwinkle lip, navy text, 16px uppercase DotGothic16 at 0.06em.
- **Go (primary):** coin-gold face with a darker gold lip; used for Save and confirm actions.
- **Red:** P1-red face with a dark red lip and white text; for destructive or P1-side actions.
- **Hover / Active / Focus:** hover brightens 4%; active and `aria-pressed=true` swap to a flat pressed fill and drop 2px; focus is a 3px coin-gold outline at 3px offset. Disabled is 45% opacity with no drop.
- **Tabs:** stage tabs above the leaderboard are small buttons (38px) using `aria-pressed` for the selected tab.

### Chips (Tags)
- **Style:** 3px plus-notched frame, 2px 6px padding, 13px uppercase DotGothic16 at 0.08em.
- **Variants:** navy default; gold for Win, Bye and rank 1; silver and bronze for ranks 2 and 3; red for the M-side seed, Tie and No-show; blue for the B-side seed and On now; green for Wildcard; ghost (pale fill, dusk text) for Out, Waiting, Later and unscored seeds.

### Cards / Containers (Windows)
- **Corner Style:** notched pixel frame, no radius. Default windows are a plain navy 6px outline with a white fill (no bevel), so the page stays quiet.
- **Accent variants:** `p1` (8px, red inner band) marks the one live window (Now playing / On course); `gold` (8px, gold band) marks decisions. Nothing else gets a coloured band.
- **Title bar:** Press Start 2P 16px title on the left, uppercase label meta on the right (real data: stage, counts). No rule under it; 14px of space separates title and body.
- **Internal Padding:** 14px 16px (10px on mobile); accent windows 12px 14px.
- **Rows inside windows:** separated by a 2px well-coloured line, not filled boxes. Fills are reserved for meaning (gold tint = 1st, P2 tint = current).

### Inputs / Fields
- **Style:** 9-slice frame with an inset top-left periwinkle shadow line and white well, 6px border, 48px min height, 22px tabular DotGothic16, red caret. Labels above in the label style.
- **Focus:** 3px coin-gold outline at 1px offset.
- **Error:** `aria-invalid` swaps the outline to fault red.

### Navigation
- **Style:** the HUD menu is a plain window holding uppercase 16px links. A red pixel cursor icon sits before the current page's link (`aria-current=page`) and appears on hover. Under 720px the menu spans full width at 14px, the cursor gives way to a red underline, and links never wrap.
- **Audiences:** students get Scores / Bracket / Speed track; a logged-in moderator gets Desk / Scoreboard / Bracket / Speed track. The moderator desk (`/admin`) is its own page, not the scoreboard with controls switched on.
- **Status:** a steady 8px HP-green square plus "Live" in ink dusk; both turn fault red when offline.

### Face-off (Now Playing)
The signature battle window. A red-framed window holding two fighter panels on P1 and P2 tints split by a navy VS chip. The P1 side carries the blinking cursor, a 40px red team number and the 34px name; the P2 side shows the opponent in blue at 24px/22px with their score to beat. On the public scoreboard one quiet line follows (start time, up next, coming back later). On the moderator desk the same face-off is compact and sits above the entry fields (Start + stamp, T1, T2, live T1 × T2 preview) and one action row.

### Match Card (Bracket)
A flat window with an uppercase match header, two well-strip sides (seed tag, number, name, score) and an 11px VS chip overlapping between them. The name sits on its own line under the seed tag, number and score, so it wraps instead of truncating. Won side gets gold tint and gold-ink score; lost side goes white with dusk text; the current side gets P2 tint. A re-flowed card flashes gold twice in four steps.

### World Map
Stage pins (56px notched frames with a pixel icon) linked by a dotted navy route. Done pins fill gold, the live pin fills red with white icon, locked pins show a lock in ink haze. The selected stage name gets a 4px red underline.

## Do's and Don'ts

### Do:
- **Do** draw every new container, control and badge as a 9-slice pixel `border-image` with notched corners, reusing the 5x5 (window/control) or 3x3 (tag) geometry.
- **Do** keep red for the current player / top seed and blue for the opponent across every screen. Never show the staff-only M/B groups.
- **Do** reserve coin gold for wins, first place, decisions and the single primary action in a row.
- **Do** set every score, rank, team number and time in Press Start 2P (anti-aliased, for readability).
- **Do** animate with `steps()` timing only, and let `prefers-reduced-motion` switch it off.
- **Do** use the pixel SVG icon set (cursor, lock, star, trophy, clock, skip, pencil) at 1em with crisp edges; draw new icons on the same 7 to 8 unit grid.
- **Do** keep the page light: periwinkle dithered ground, white windows, navy ink.

### Don't:
- **Don't** use `border-radius`, `box-shadow`, blur, or smooth gradients for depth.
- **Don't** use eased or springy transitions; nothing glides.
- **Don't** use P1 red to signal an error; errors are fault red.
- **Don't** add a dark theme; light mode is a brand commitment.
- **Don't** set long text in Press Start 2P; it is for numbers, titles and short labels only.
- **Don't** use emoji or Unicode glyphs as icons; icons are pixel SVG paths.
