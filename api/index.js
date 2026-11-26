// IM Competition dashboard — Vercel serverless version (no npm dependencies).
// Obstacle Course scores: /  (operator: /admin)   Bracket: /schedule
// Speed Track: /speed  (operator: /admin/speed)
// Data lives in Upstash Redis (free tier), added from the Vercel Marketplace.
// Team list and qualifying match-ups are read from sheets/*.xlsx on every deploy.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PASSWORD = process.env.ADMIN_PASSWORD || '';
const ON_VERCEL = !!process.env.VERCEL;
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const { loadSheets } = require('../lib/sheets');
// Each board has its own revision counter, so the speed and obstacle desks never block each other.
const NS = {
  speed: { rev: 'speed-comp:rev', state: 'speed-comp:state' },
  obstacle: { rev: 'obstacle:rev', state: 'obstacle:state' },
};

const VIEWS = path.join(__dirname, '..', 'views');
const read = f => fs.readFileSync(path.join(VIEWS, f), 'utf8');
const PAGE_FILES = { speed: 'speed.html', scores: 'scores.html', schedule: 'schedule.html' };
const PAGE_CACHE = Object.fromEntries(Object.entries(PAGE_FILES).map(([k, f]) => [k, read(f)]));
// Locally, re-read pages on every request so edits show up without a restart.
const PAGES = new Proxy(PAGE_CACHE, { get: (c, k) => (ON_VERCEL ? c[k] : read(PAGE_FILES[k])) });
const asAdmin = html => html.replace('/*__ADMIN__*/false', 'true');
const ASSET_TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const TOKEN = crypto.createHmac('sha256', 'speed-comp:' + PASSWORD).update('admin-session').digest('hex');

// ---------- storage: Upstash Redis REST, or memory when running locally without Redis ----------
const mem = { speed: { rev: 0, data: null }, obstacle: { rev: 0, data: null } };
async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || r.status));
  return j.result;
}
async function getState(ns) {
  if (!REDIS_URL) return mem[ns];
  const raw = await redis(['GET', NS[ns].state]);
  return raw ? JSON.parse(raw) : { rev: 0, data: null };
}
// Atomic compare-and-set on the revision number, so two operators can't overwrite each other.
const CAS = `local r = tonumber(redis.call('GET', KEYS[1]) or '0')
if r ~= tonumber(ARGV[1]) then return {0, redis.call('GET', KEYS[2]) or ''} end
redis.call('SET', KEYS[1], r + 1)
redis.call('SET', KEYS[2], ARGV[2])
return {1, ''}`;
async function putState(ns, expectedRev, data) {
  const next = { rev: expectedRev + 1, at: Date.now(), data };
  if (!REDIS_URL) {
    if (mem[ns].rev !== expectedRev) return { ok: false, current: mem[ns] };
    mem[ns] = next;
    return { ok: true, state: next };
  }
  const [ok, cur] = await redis(['EVAL', CAS, '2', NS[ns].rev, NS[ns].state, String(expectedRev), JSON.stringify(next)]);
  if (ok === 1) return { ok: true, state: next };
  return { ok: false, current: cur ? JSON.parse(cur) : { rev: 0, data: null } };
}

// ---------- helpers ----------
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function isAdmin(req) {
  if (!PASSWORD) return !ON_VERCEL;
  return same(cookies(req).sc_admin || '', TOKEN);
}
function send(res, code, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(body);
}
// Vercel pre-parses bodies into req.body; plain Node (local testing) leaves the stream unread.
async function readBody(req, limit = 2e6) {
  if (req.body !== undefined) return req.body;
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const asParams = b => (typeof b === 'string' ? new URLSearchParams(b) : new URLSearchParams(b || {}));
const asJson = b => (typeof b === 'string' ? JSON.parse(b) : Buffer.isBuffer(b) ? JSON.parse(b.toString('utf8')) : b);

// ---------- CSV export (same ranking as the page) ----------
const r1 = v => Math.round(v * 10) / 10;
const fL = v => (v == null ? '' : r1(v).toFixed(1));
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0] || 'th');
const q = v => { v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v) && isNaN(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function csv(state) {
  const rows = ((state.data && state.data.rows) || []).slice()
    .sort((a, b) => a.start.localeCompare(b.start) || String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
  const done = rows.filter(r => r.laps != null);
  const pos = r => (r.laps == null ? '' : ord(1 + done.filter(o => o.laps > r.laps).length));
  return '﻿' + [['Start time', 'Team no.', 'Team name', 'Laps', 'Position']]
    .concat(rows.map(r => [r.start, r.no, r.name, fL(r.laps), pos(r)]))
    .map(r => r.map(q).join(',')).join('\r\n');
}

// ---------- Obstacle Course CSV export (every run, with its match result) ----------
const Tournament = require('../views/tournament.js');
function obstacleCsv(state) {
  const sheets = loadSheets();
  const b = Tournament.compute(sheets, state.data || {});
  const team = Object.fromEntries(sheets.teams.map(t => [t.no, t]));
  const rows = [['Stage', 'Match', 'Team no.', 'Team name', 'Members', 'Start time', 'T1 distance', 'T2 distance', 'Score', 'Status', 'Result']];
  b.stages.forEach(st => st.matches.forEach(m => [m.a, m.b].filter(Boolean).forEach(t => {
    const r = ((state.data && state.data.runs) || {})[st.id]?.[t] || {};
    const res = Tournament.teamResult(st, t).res;
    rows.push([st.name, m.no, t, (team[t] || {}).name || '', (team[t] || {}).members || '', r.start || '',
      r.status === 'done' ? r.d1 : '', r.status === 'done' ? r.d2 : '', r.status === 'done' ? Tournament.score(r) : '',
      r.status || 'not run', { win: 'Won', lose: 'Lost', tie: 'Tie — moderator to decide', bye: 'Bye', pending: '' }[res] || '']);
  })));
  return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
}

// ---------- Login and notice pages (8-bit theme, shared stylesheet) ----------
const shell = (title, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><link rel="stylesheet" href="/assets/pixel.css"></head><body class="center-screen">${body}</body></html>`;
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeNext = n => (/^\/admin(\/speed)?$/.test(n || '') ? n : '/admin');
const loginPage = (err = '', next = '/admin') => shell('Operator login — IM Competition', `
<form method="post" action="/login" class="win login">
  <h1 class="win-title">Operator login</h1>
  ${err ? `<p class="msg bad" role="alert">${escHtml(err)}</p>` : ''}
  <input type="hidden" name="next" value="${escHtml(safeNext(next))}">
  <label class="field">Password<input type="password" name="password" autofocus required autocomplete="current-password"></label>
  <button type="submit" class="btn go">Press start</button>
  <p class="dim small">Just watching? <a href="/">Open the scoreboard</a></p>
</form>`);
const noticePage = msg => shell('IM Competition', `<div class="win login"><h1 class="win-title">IM Competition</h1><p>${msg}</p></div>`);

// ---------- Handler ----------
// vercel.json rewrites every public path to /api/index?r=<route>; locally the pathname is used.
const ROUTES = {
  '/': 'scores', '/admin': 'admin', '/schedule': 'schedule', '/speed': 'speed', '/admin/speed': 'admin-speed',
  '/login': 'login', '/logout': 'logout', '/healthz': 'health',
  '/api/state': 'state', '/api/export.csv': 'export',
  '/api/obstacle': 'obstacle', '/api/obstacle.csv': 'obstacle-export', '/api/sheets': 'sheets',
};
const STATE_ROUTES = { state: 'speed', obstacle: 'obstacle' };

function validData(ns, d) {
  if (!d || typeof d !== 'object') return false;
  if (ns === 'speed') return Array.isArray(d.rows);
  return typeof d.runs === 'object' && d.runs !== null && !Array.isArray(d.runs);
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let route = url.searchParams.get('r') || ROUTES[url.pathname.replace(/\/+$/, '') || '/'];
  if (!route && url.pathname.startsWith('/assets/')) route = 'asset';
  const m = req.method;
  try {
    if (m === 'GET' && route === 'asset') {
      const f = (url.searchParams.get('f') || url.pathname.slice('/assets/'.length)).replace(/\\/g, '/');
      const ext = path.extname(f);
      if (!/^[\w./-]+$/.test(f) || f.includes('..') || !ASSET_TYPES[ext]) return send(res, 404, 'Not found', 'text/plain');
      let body;
      try { body = fs.readFileSync(path.join(VIEWS, f)); } catch { return send(res, 404, 'Not found', 'text/plain'); }
      const cache = ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'public, max-age=60, s-maxage=300';
      return send(res, 200, body, ASSET_TYPES[ext], { 'Cache-Control': cache });
    }
    if (m === 'GET' && route === 'health') return send(res, 200, 'ok', 'text/plain');
    if (ON_VERCEL && !REDIS_URL) {
      return send(res, 503, noticePage('The dashboard is being set up — check back in a few minutes.'));
    }
    if (m === 'GET' && route === 'scores') return send(res, 200, PAGES.scores);
    if (m === 'GET' && route === 'schedule') return send(res, 200, isAdmin(req) ? asAdmin(PAGES.schedule) : PAGES.schedule);
    if (m === 'GET' && route === 'speed') return send(res, 200, PAGES.speed);
    if (m === 'GET' && (route === 'admin' || route === 'admin-speed')) {
      const next = route === 'admin' ? '/admin' : '/admin/speed';
      if (!PASSWORD && ON_VERCEL) return send(res, 503, loginPage('Set ADMIN_PASSWORD in Vercel → Settings → Environment Variables, then redeploy.', next));
      if (!isAdmin(req)) return send(res, 200, loginPage('', next));
      return send(res, 200, asAdmin(route === 'admin' ? PAGES.scores : PAGES.speed));
    }
    if (m === 'POST' && route === 'login') {
      const body = asParams(await readBody(req, 1e4));
      const next = safeNext(body.get('next'));
      if (PASSWORD && same(body.get('password') || '', PASSWORD)) {
        const secure = ON_VERCEL || (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
        return send(res, 303, '', 'text/plain', { Location: next, 'Set-Cookie': `sc_admin=${TOKEN}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}` });
      }
      await new Promise(r => setTimeout(r, 600));
      return send(res, 401, loginPage('Wrong password.', next));
    }
    if (m === 'POST' && route === 'logout') {
      return send(res, 303, '', 'text/plain', { Location: '/', 'Set-Cookie': 'sc_admin=; HttpOnly; Path=/; Max-Age=0' });
    }

    if (m === 'GET' && route === 'sheets') {
      return send(res, 200, JSON.stringify(loadSheets()), 'application/json', { 'Cache-Control': 'public, max-age=0, s-maxage=5, stale-while-revalidate=30' });
    }

    const ns = STATE_ROUTES[route];
    if (ns && m === 'GET') {
      // Cached at Vercel's edge for 1 s: any number of screens cost about one Redis read per second.
      const st = await getState(ns);
      const out = ns === 'obstacle' ? { ...st, sv: loadSheets().sv } : st;
      return send(res, 200, JSON.stringify(out), 'application/json', { 'Cache-Control': 'public, max-age=0, s-maxage=1, stale-while-revalidate=1' });
    }
    if (ns && m === 'PUT') {
      if (!isAdmin(req)) return send(res, 401, '{"error":"login required"}', 'application/json');
      if (!(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, '{}', 'application/json');
      const body = asJson(await readBody(req));
      if (!body || typeof body.rev !== 'number' || !validData(ns, body.data)) {
        return send(res, 400, '{"error":"bad data"}', 'application/json');
      }
      const out = await putState(ns, body.rev, body.data);
      if (!out.ok) return send(res, 409, JSON.stringify(out.current), 'application/json');
      return send(res, 200, JSON.stringify({ rev: out.state.rev }), 'application/json');
    }
    if (m === 'GET' && (route === 'export' || route === 'obstacle-export')) {
      const d = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const body = route === 'export' ? csv(await getState('speed')) : obstacleCsv(await getState('obstacle'));
      const name = route === 'export' ? 'speed-comp' : 'obstacle-course';
      return send(res, 200, body, 'text/csv; charset=utf-8', { 'Content-Disposition': `attachment; filename="${name}-${d}.csv"` });
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      if (['scores', 'schedule', 'speed', 'admin', 'admin-speed'].includes(route)) send(res, 500, noticePage('Something went wrong — refresh in a moment.'));
      else send(res, 500, '{"error":"server error"}', 'application/json');
    }
  }
};
