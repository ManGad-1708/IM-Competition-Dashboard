// Reads the competition sheets in /sheets and turns them into plain JSON.
//   Teams.xlsx              — a sheet with a "Group No" (or "Team No") header row,
//                              members, team name and the M/B group letter.
//   QualifyingPlayoffs.xlsx — a sheet with a "Match No" header and two team-number columns.
//   Round2.xlsx             — Best-of-28 match-ups typed by hand (same layout, plus seeds and
//                              start/end times). A team cell can be "W-Q1" (winner of the redo of
//                              qualifying match 1); a row whose Match No is "Redo Q1" is that redo.
//   Round3.xlsx, QuarterFinals.xlsx, SemiFinals.xlsx, Finals.xlsx — the same layout for the later rounds.
//                              Rows with only a Match No and times set the times of the match-ups the
//                              app seeds by score; rows with team numbers fix the match-ups too.
//                              Finals.xlsx has a "3rd Place" row and a "Final" row.
// Columns are found by their header text, so adding/reordering columns or rows is fine.
// Files are re-read whenever they change on disk (locally) or on each new deploy (Vercel).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readXlsx } = require('./xlsx');

const DIR = path.join(__dirname, '..', 'sheets');
// Static paths so Vercel's file tracing bundles them with the function.
const TEAMS_FILE = path.join(__dirname, '..', 'sheets', 'Teams.xlsx');
const PLAYOFF_FILE = path.join(__dirname, '..', 'sheets', 'QualifyingPlayoffs.xlsx');
const ROUND2_FILE = path.join(__dirname, '..', 'sheets', 'Round2.xlsx');
const LATER = [
  { id: 'R14', file: path.join(__dirname, '..', 'sheets', 'Round3.xlsx'), re: /round\s*3|best.?of.?14/i, label: 'Round 3' },
  { id: 'QF', file: path.join(__dirname, '..', 'sheets', 'QuarterFinals.xlsx'), re: /quarter/i, label: 'Quarter-finals' },
  { id: 'SF', file: path.join(__dirname, '..', 'sheets', 'SemiFinals.xlsx'), re: /semi/i, label: 'Semi-finals' },
  { id: 'F', file: path.join(__dirname, '..', 'sheets', 'Finals.xlsx'), re: /^finals?\b/i, label: 'Finals' },
];

const norm = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const teamKey = v => { const s = norm(v); return /^\d+(\.0+)?$/.test(s) ? String(parseInt(s, 10)) : s; };

function findFile(preferred, re) {
  if (fs.existsSync(preferred)) return preferred;
  try {
    const f = fs.readdirSync(DIR).find(n => re.test(n) && /\.xlsx$/i.test(n) && !n.startsWith('~$'));
    return f ? path.join(DIR, f) : null;
  } catch { return null; }
}

function findHeader(sheets, test) {
  for (const s of sheets) {
    for (let r = 0; r < Math.min(s.rows.length, 30); r++) {
      const row = s.rows[r].map(norm);
      if (test(row)) return { sheet: s, r, head: row };
    }
  }
  return null;
}

function parseTeams(buf, warn) {
  const sheets = readXlsx(buf);
  const isNo = h => /^(group|team)\s*(no\.?|number|#)$/i.test(h);
  const h = findHeader(sheets, row => row.some(isNo));
  if (!h) { warn('Teams sheet: no "Group No" header row found.'); return []; }
  const cNo = h.head.findIndex(isNo);
  const cMem = h.head.findIndex(x => /member/i.test(x));
  const cName = h.head.findIndex(x => /(group|team)\s*name/i.test(x));
  let cGrp = h.head.findIndex((x, i) => i !== cNo && /^(group|section|batch|side|division)$/i.test(x));
  const teams = [], seen = new Set();
  for (let r = h.r + 1; r < h.sheet.rows.length; r++) {
    const row = h.sheet.rows[r] || [];
    const no = teamKey(row[cNo]);
    if (!no || !/^\d+$/.test(no)) continue;
    if (seen.has(no)) { warn(`Teams sheet: team ${no} is listed twice; using the first row.`); continue; }
    seen.add(no);
    // The M/B letter sits in an unlabeled column after the name in the current sheet.
    let group = cGrp >= 0 ? norm(row[cGrp]) : '';
    if (!group) {
      const c = row.findIndex((v, i) => i > Math.max(cNo, cMem, cName) && /^[A-Za-z]$/.test(norm(v)));
      group = c >= 0 ? norm(row[c]) : '';
    }
    teams.push({
      no,
      name: cName >= 0 ? norm(row[cName]) : '',
      members: cMem >= 0 ? norm(row[cMem]) : '',
      group: group.toUpperCase(),
    });
  }
  if (!teams.length) warn('Teams sheet: no team rows found under the header.');
  return teams;
}


// ---------- times ----------
// Minutes since midnight <-> "h:mm AM". Excel stores a time as a fraction of a day.
const clock = min => { min = ((Math.round(min) % 1440) + 1440) % 1440; const h = Math.floor(min / 60), m = min % 60; return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };
function toMinutes(v) {
  if (typeof v === 'number' && isFinite(v)) return Math.round((v - Math.floor(v)) * 1440);
  const m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap])?\.?m?\.?$/i.exec(norm(v));
  if (!m) return null;
  let h = +m[1] % 24; const ap = (m[3] || '').toLowerCase();
  if (ap === 'p' && h < 12) h += 12; if (ap === 'a' && h === 12) h = 0;
  return h * 60 + +m[2];
}
/** "10:30 AM – 10:33 AM" -> { start, end } in display form. */
function splitRange(t) {
  const [a, b] = norm(t).split(/\s*[–—-]\s*/);
  const s = toMinutes(a), e = toMinutes(b);
  return { start: s == null ? '' : clock(s), end: e == null ? '' : clock(e) };
}

function parsePlayoffs(buf, warn) {
  const sheets = readXlsx(buf);
  const h = findHeader(sheets, row => row.some(x => /^match\s*(no\.?|number|#)?$/i.test(x)));
  if (!h) { warn('Qualifying sheet: no "Match No" header row found.'); return { matches: [], sides: ['A', 'B'] }; }
  const cMatch = h.head.findIndex(x => /^match/i.test(x));
  const teamCols = h.head.map((x, i) => (/(group|team)\s*(no\.?|number|#)/i.test(x) ? i : -1)).filter(i => i >= 0);
  if (teamCols.length < 2) { warn('Qualifying sheet: need two team-number columns (e.g. "M Group No", "B Group No").'); return { matches: [], sides: ['A', 'B'] }; }
  const [ca, cb] = teamCols;
  const side = i => (h.head[i].match(/^(\w+)\s+(group|team)/i) || [])[1] || '';
  // Arena (Red/Blue) and competition time are optional extra columns on the schedule.
  const arenaCols = h.head.map((x, i) => (/arena/i.test(x) ? i : -1)).filter(i => i >= 0);
  const arenaFor = (teamCol, sideLetter) => {
    const bySide = sideLetter && arenaCols.find(i => new RegExp('^' + sideLetter + '\\b', 'i').test(h.head[i]));
    if (bySide != null && bySide !== false) return bySide;
    const left = arenaCols.filter(i => i < teamCol); // else the arena column just before this team
    return left.length ? left[left.length - 1] : (arenaCols.length ? arenaCols[0] : -1);
  };
  const cArenaA = arenaFor(ca, side(ca)), cArenaB = arenaFor(cb, side(cb));
  const cTime = h.head.findIndex(x => /competition\s*time|^time$/i.test(x));
  const arena = v => { const s = norm(v).toLowerCase(); return s === 'red' || s === 'blue' ? s : ''; };
  const matches = [];
  for (let r = h.r + 1; r < h.sheet.rows.length; r++) {
    const row = h.sheet.rows[r] || [];
    const a = teamKey(row[ca]), b = teamKey(row[cb]);
    if (!a && !b) continue;
    const no = teamKey(row[cMatch]) || String(matches.length + 1);
    matches.push({
      no, a, b,
      arenaA: cArenaA >= 0 ? arena(row[cArenaA]) : '',
      arenaB: cArenaB >= 0 ? arena(row[cArenaB]) : '',
      time: cTime >= 0 ? norm(row[cTime]) : '',
      ...splitRange(cTime >= 0 ? row[cTime] : ''),
    });
  }
  return { matches, sides: [side(ca) || 'A', side(cb) || 'B'] };
}


// Team cell in Round2.xlsx: a team number, or a placeholder for a redo winner ("W-Q1", "Winner Q1").
const SLOT_RE = /^(?:w|win|winner)\W*(?:of\W*)?(?:q|qual\w*)\W*(?:match\W*)?(\d+)(?:\W*redo)?$/i;
function parseRound2(buf, warn, sheetName = 'Round 2', later = false) {
  const sheets = readXlsx(buf);
  const h = findHeader(sheets, row => row.some(x => /^match\s*(no\.?|number|#)?$/i.test(x)));
  if (!h) { warn(sheetName + ' sheet: no "Match No" header row found.'); return []; }
  const col = re => h.head.findIndex(x => re.test(x));
  const cMatch = col(/^match/i);
  const teamCols = h.head.map((x, i) => (/(group|team)\s*(no\.?|number|#)/i.test(x) ? i : -1)).filter(i => i >= 0);
  if (teamCols.length < 2) { warn(sheetName + ' sheet: need two team-number columns (e.g. "A Team No", "B Team No").'); return []; }
  const [ca, cb] = teamCols;
  const sideOf = i => (h.head[i].match(/^(\w+)\s+(group|team)/i) || [])[1] || '';
  const bySide = (re, sideLetter, fallbackLeftOf) => {
    const cols = h.head.map((x, i) => (re.test(x) ? i : -1)).filter(i => i >= 0);
    const s = sideLetter && cols.find(i => new RegExp('^' + sideLetter + '\\b', 'i').test(h.head[i]));
    if (s != null) return s;
    const left = cols.filter(i => i < fallbackLeftOf);
    return left.length ? left[left.length - 1] : -1;
  };
  const cSeedA = bySide(/seed/i, sideOf(ca), ca), cSeedB = bySide(/seed/i, sideOf(cb), cb);
  const cArenaA = bySide(/arena/i, sideOf(ca), ca + 3), cArenaB = bySide(/arena/i, sideOf(cb), cb + 3);
  const cStart = col(/^start/i), cEnd = col(/^end/i);
  // Settings above the header: "Match length (min)" and "Gap between matches (min)".
  const setting = re => { for (let r = 0; r < h.r; r++) { const row = h.sheet.rows[r] || []; const i = row.findIndex(v => re.test(norm(v))); if (i >= 0) { const n = row.slice(i + 1).find(v => typeof v === 'number' || /^\d+(\.\d+)?$/.test(norm(v))); if (n != null) return +n; } } return null; };
  const len = setting(/match\s*length|duration/i) ?? 3, gap = setting(/gap/i) ?? 1;
  const arena = v => { const s = norm(v).toLowerCase(); return s === 'red' || s === 'blue' ? s : ''; };
  const seed = v => { const n = parseInt(norm(v), 10); return n > 0 ? n : null; };
  const team = (v, where) => {
    const s = teamKey(v);
    if (!s) return { no: '' };
    if (/^\d+$/.test(s)) return { no: s };
    const m = !later && SLOT_RE.exec(s);
    if (m) return { no: '', slot: 'Q' + parseInt(m[1], 10) };
    warn(`${sheetName} sheet: "${s}" (${where}) is not a team number${later ? '' : ' or a placeholder like W-Q1'}.`);
    return { no: '' };
  };
  const out = [];
  let prevEnd = null;
  for (let r = h.r + 1; r < h.sheet.rows.length; r++) {
    const row = h.sheet.rows[r] || [];
    const label = norm(row[cMatch]);
    const a = team(row[ca], 'match ' + label), b = team(row[cb], 'match ' + label);
    // Later rounds: a row with just a Match No sets the time of the match the app seeds by score.
    if (!a.no && !b.no && !a.slot && !b.slot && !(later && label)) continue;
    const redo = !later && /redo\D*(\d+)/i.exec(label);
    // Times: use the sheet's value; a formula Excel hasn't calculated yet is worked out the same way here.
    let start = cStart >= 0 ? toMinutes(row[cStart]) : null;
    if (start == null && prevEnd != null) start = prevEnd + gap;
    let end = cEnd >= 0 ? toMinutes(row[cEnd]) : null;
    if (end == null && start != null) end = start + len;
    prevEnd = end;
    out.push({
      no: redo ? String(parseInt(redo[1], 10)) : (teamKey(row[cMatch]) || String(out.filter(x => !x.redoOf).length + 1)),
      redoOf: redo ? String(parseInt(redo[1], 10)) : null, label,
      a: a.no, b: b.no, slotA: a.slot || null, slotB: b.slot || null,
      seedA: cSeedA >= 0 ? seed(row[cSeedA]) : null, seedB: cSeedB >= 0 ? seed(row[cSeedB]) : null,
      arenaA: cArenaA >= 0 ? arena(row[cArenaA]) : '', arenaB: cArenaB >= 0 ? arena(row[cArenaB]) : '',
      start: start == null ? '' : clock(start), end: end == null ? '' : clock(end),
      time: start == null ? '' : clock(start) + (end == null ? '' : ' – ' + clock(end)),
    });
  }
  return out;
}

let cache = { key: '', data: null };
function stamp(f) { try { const s = fs.statSync(f); return f + ':' + s.mtimeMs + ':' + s.size; } catch { return f + ':missing'; } }

function loadSheets() {
  const tf = findFile(TEAMS_FILE, /team/i);
  const pf = findFile(PLAYOFF_FILE, /qualif|playoff/i);
  const rf = findFile(ROUND2_FILE, /round\s*2|best.?of.?28/i);
  const lf = LATER.map(x => findFile(x.file, x.re));
  const key = [stamp(tf || 'teams'), stamp(pf || 'playoffs'), stamp(rf || 'round2'), ...lf.map((f, i) => stamp(f || LATER[i].id))].join('|');
  if (cache.key === key && cache.data) return cache.data;
  const warnings = [];
  const warn = m => warnings.push(m);
  let teams = [], q = { matches: [], sides: ['A', 'B'] };
  const hash = crypto.createHash('sha1');
  try {
    if (!tf) throw new Error('missing');
    const buf = fs.readFileSync(tf); hash.update(buf); teams = parseTeams(buf, warn);
  } catch (e) { warn('Could not read sheets/Teams.xlsx' + (e.message === 'missing' ? ' (file not found).' : ': ' + e.message)); }
  try {
    if (!pf) throw new Error('missing');
    const buf = fs.readFileSync(pf); hash.update(buf); q = parsePlayoffs(buf, warn);
  } catch (e) { warn('Could not read sheets/QualifyingPlayoffs.xlsx' + (e.message === 'missing' ? ' (file not found).' : ': ' + e.message)); }

  let round2 = [];
  if (rf) {
    try { const buf = fs.readFileSync(rf); hash.update(buf); round2 = parseRound2(buf, warn); }
    catch (e) { warn('Could not read sheets/Round2.xlsx: ' + e.message); }
  }

  // Later rounds (Round 3 … Finals): times, and optionally fixed match-ups.
  const rounds = {};
  LATER.forEach((x, i) => {
    if (!lf[i]) return;
    let rows = [];
    try { const buf = fs.readFileSync(lf[i]); hash.update(buf); rows = parseRound2(buf, warn, x.label, true); }
    catch (e) { warn(`Could not read sheets/${path.basename(x.file)}: ` + e.message); return; }
    if (x.id !== 'F') { rounds[x.id] = rows; return; }
    // Finals.xlsx: a "3rd Place" row and a "Final" row.
    rows.forEach(r => {
      const p3 = /3|third|place|play.?off/i.test(r.label);
      const id = p3 ? 'P3' : 'F';
      if (rounds[id]) warn(`Finals sheet: more than one ${p3 ? '3rd place' : 'final'} row; using the first.`);
      else rounds[id] = [Object.assign(r, { no: '1' })];
    });
  });

  const known = new Set(teams.map(t => t.no));
  const used = new Map();
  q.matches.forEach(m => [m.a, m.b].forEach(t => {
    if (!t) return;
    if (!known.has(t)) { warn(`Qualifying match ${m.no}: team ${t} is not in the Teams sheet.`); teams.push({ no: t, name: '', members: '', group: '' }); known.add(t); }
    if (used.has(t)) warn(`Team ${t} appears in qualifying matches ${used.get(t)} and ${m.no}.`);
    else used.set(t, m.no);
  }));
  teams.forEach(t => { if (!used.has(t.no)) warn(`Team ${t.no} is not in any qualifying match.`); });
  const used2 = new Map();
  round2.forEach(m => {
    const where = m.redoOf ? 'the redo of qualifying match ' + m.redoOf : 'Round 2 match ' + m.no;
    [m.a, m.b].forEach(t => {
      if (!t) return;
      if (!known.has(t)) warn(`${where}: team ${t} is not in the Teams sheet.`);
      if (m.redoOf) return;
      if (used2.has(t)) warn(`Team ${t} appears in Round 2 matches ${used2.get(t)} and ${m.no}.`); else used2.set(t, m.no);
    });
    [m.slotA, m.slotB].forEach(s => { if (s && !round2.some(x => x.redoOf === s.slice(1)) && !q.matches.some(x => x.no === s.slice(1))) warn(`${where}: W-${s} points at qualifying match ${s.slice(1)}, which doesn't exist.`); });
    if (m.redoOf && !q.matches.some(x => x.no === m.redoOf)) warn(`Redo row: qualifying match ${m.redoOf} doesn't exist.`);
  });

  Object.entries(rounds).forEach(([id, rows]) => rows.forEach(m => [m.a, m.b].forEach(t => {
    if (t && !known.has(t)) warn(`${id} sheet, match ${m.label || m.no}: team ${t} is not in the Teams sheet.`);
  })));

  const data = {
    sv: hash.digest('hex').slice(0, 12),
    teams: teams.sort((x, y) => +x.no - +y.no),
    qualifying: q.matches,
    sides: q.sides,
    round2,
    rounds,
    warnings,
  };
  cache = { key, data };
  return data;
}

module.exports = { loadSheets, parseRound2 };
