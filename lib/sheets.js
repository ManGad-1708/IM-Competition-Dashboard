// Reads the competition sheets in /sheets and turns them into plain JSON.
//   Teams.xlsx              — a sheet with a "Group No" (or "Team No") header row,
//                              members, team name and the M/B group letter.
//   QualifyingPlayoffs.xlsx — a sheet with a "Match No" header and two team-number columns.
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

function parsePlayoffs(buf, warn) {
  const sheets = readXlsx(buf);
  const h = findHeader(sheets, row => row.some(x => /^match\s*(no\.?|number|#)?$/i.test(x)));
  if (!h) { warn('Qualifying sheet: no "Match No" header row found.'); return { matches: [], sides: ['A', 'B'] }; }
  const cMatch = h.head.findIndex(x => /^match/i.test(x));
  const teamCols = h.head.map((x, i) => (/(group|team)\s*(no\.?|number|#)/i.test(x) ? i : -1)).filter(i => i >= 0);
  if (teamCols.length < 2) { warn('Qualifying sheet: need two team-number columns (e.g. "M Group No", "B Group No").'); return { matches: [], sides: ['A', 'B'] }; }
  const [ca, cb] = teamCols;
  const side = i => (h.head[i].match(/^(\w+)\s+(group|team)/i) || [])[1] || '';
  const matches = [];
  for (let r = h.r + 1; r < h.sheet.rows.length; r++) {
    const row = h.sheet.rows[r] || [];
    const a = teamKey(row[ca]), b = teamKey(row[cb]);
    if (!a && !b) continue;
    const no = teamKey(row[cMatch]) || String(matches.length + 1);
    matches.push({ no, a, b });
  }
  return { matches, sides: [side(ca) || 'A', side(cb) || 'B'] };
}

let cache = { key: '', data: null };
function stamp(f) { try { const s = fs.statSync(f); return f + ':' + s.mtimeMs + ':' + s.size; } catch { return f + ':missing'; } }

function loadSheets() {
  const tf = findFile(TEAMS_FILE, /team/i);
  const pf = findFile(PLAYOFF_FILE, /qualif|playoff/i);
  const key = stamp(tf || 'teams') + '|' + stamp(pf || 'playoffs');
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

  const known = new Set(teams.map(t => t.no));
  const used = new Map();
  q.matches.forEach(m => [m.a, m.b].forEach(t => {
    if (!t) return;
    if (!known.has(t)) { warn(`Qualifying match ${m.no}: team ${t} is not in the Teams sheet.`); teams.push({ no: t, name: '', members: '', group: '' }); known.add(t); }
    if (used.has(t)) warn(`Team ${t} appears in qualifying matches ${used.get(t)} and ${m.no}.`);
    else used.set(t, m.no);
  }));
  teams.forEach(t => { if (!used.has(t.no)) warn(`Team ${t.no} is not in any qualifying match.`); });

  const data = {
    sv: hash.digest('hex').slice(0, 12),
    teams: teams.sort((x, y) => +x.no - +y.no),
    qualifying: q.matches,
    sides: q.sides,
    warnings,
  };
  cache = { key, data };
  return data;
}

module.exports = { loadSheets };
