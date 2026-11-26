// Speed Comp live dashboard — Vercel serverless version (no npm dependencies).
// Public display: /     Operator (password): /admin
// Data lives in Upstash Redis (free tier), added from the Vercel Marketplace.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PASSWORD = process.env.ADMIN_PASSWORD || '';
const ON_VERCEL = !!process.env.VERCEL;
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const K_REV = 'speed-comp:rev';
const K_STATE = 'speed-comp:state';

const PAGE = fs.readFileSync(path.join(__dirname, '..', 'views', 'index.html'), 'utf8');
const ADMIN_PAGE = PAGE.replace('/*__ADMIN__*/false', 'true');
const TOKEN = crypto.createHmac('sha256', 'speed-comp:' + PASSWORD).update('admin-session').digest('hex');

// ---------- storage: Upstash Redis REST, or memory when running locally without Redis ----------
let mem = { rev: 0, data: null };
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
async function getState() {
  if (!REDIS_URL) return mem;
  const raw = await redis(['GET', K_STATE]);
  return raw ? JSON.parse(raw) : { rev: 0, data: null };
}
// Atomic compare-and-set on the revision number, so two operators can't overwrite each other.
const CAS = `local r = tonumber(redis.call('GET', KEYS[1]) or '0')
if r ~= tonumber(ARGV[1]) then return {0, redis.call('GET', KEYS[2]) or ''} end
redis.call('SET', KEYS[1], r + 1)
redis.call('SET', KEYS[2], ARGV[2])
return {1, ''}`;
async function putState(expectedRev, data) {
  const next = { rev: expectedRev + 1, at: Date.now(), data };
  if (!REDIS_URL) {
    if (mem.rev !== expectedRev) return { ok: false, current: mem };
    mem = next;
    return { ok: true, state: next };
  }
  const [ok, cur] = await redis(['EVAL', CAS, '2', K_REV, K_STATE, String(expectedRev), JSON.stringify(next)]);
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

// ---------- Login page ----------
const loginPage = (err = '') => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Speed Comp — operator login</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0d10;color:#f4f4f1;font:16px/1.5 system-ui,sans-serif}
form{width:min(360px,90vw);background:#15171c;border:1px solid #262931;border-top:4px solid #e8202a;border-radius:14px;padding:24px}
h1{margin:0 0 16px;font-size:26px}label{display:block;color:#9a9ea8;font-size:14px}
input{display:block;width:100%;box-sizing:border-box;margin:6px 0 16px;min-height:44px;padding:8px 12px;border-radius:8px;border:1px solid #262931;background:#0f1115;color:#f4f4f1;font-size:16px}
button{width:100%;min-height:44px;border:0;border-radius:8px;background:#e8202a;color:#fff;font-weight:600;font-size:16px;cursor:pointer}
p{color:#ff6b6b;margin:0 0 12px}a{color:#9a9ea8}</style></head><body>
<form method="post" action="/login"><h1>Speed Comp operator</h1>${err ? `<p>${err}</p>` : ''}
<label>Password<input type="password" name="password" autofocus required autocomplete="current-password"></label>
<button type="submit">Log in</button><p style="color:#9a9ea8;margin:14px 0 0;font-size:14px">Just watching? <a href="/">Open the public display</a></p></form></body></html>`;

// Plain notice page (no password box) for setup problems, so the public display never looks locked.
const noticePage = msg => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Speed Comp</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0d10;color:#f4f4f1;font:18px/1.5 system-ui,sans-serif;text-align:center;padding:16px}</style></head>
<body><div><h1 style="margin:0 0 8px">Speed Comp</h1><p style="color:#9a9ea8;margin:0">${msg}</p></div></body></html>`;

// ---------- Handler ----------
// vercel.json rewrites every public path to /api/index?r=<route>; locally the pathname is used.
const ROUTES = { '/': 'page', '/admin': 'admin', '/login': 'login', '/logout': 'logout', '/healthz': 'health', '/api/state': 'state', '/api/export.csv': 'export' };

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const route = url.searchParams.get('r') || ROUTES[url.pathname];
  const m = req.method;
  try {
    if (ON_VERCEL && !REDIS_URL && route !== 'health') {
      return send(res, 503, noticePage('The dashboard is being set up — check back in a few minutes.'));
    }
    if (m === 'GET' && route === 'page') return send(res, 200, PAGE);
    if (m === 'GET' && route === 'health') return send(res, 200, 'ok', 'text/plain');

    if (m === 'GET' && route === 'admin') {
      if (!PASSWORD && ON_VERCEL) return send(res, 503, loginPage('Set ADMIN_PASSWORD in Vercel → Settings → Environment Variables, then redeploy.'));
      return isAdmin(req) ? send(res, 200, ADMIN_PAGE) : send(res, 200, loginPage());
    }
    if (m === 'POST' && route === 'login') {
      const body = asParams(await readBody(req, 1e4));
      if (PASSWORD && same(body.get('password') || '', PASSWORD)) {
        const secure = ON_VERCEL || (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
        return send(res, 303, '', 'text/plain', { Location: '/admin', 'Set-Cookie': `sc_admin=${TOKEN}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}` });
      }
      await new Promise(r => setTimeout(r, 600));
      return send(res, 401, loginPage('Wrong password.'));
    }
    if (m === 'POST' && route === 'logout') {
      return send(res, 303, '', 'text/plain', { Location: '/', 'Set-Cookie': 'sc_admin=; HttpOnly; Path=/; Max-Age=0' });
    }

    if (m === 'GET' && route === 'state') {
      // Cached at Vercel's edge for 1 s: any number of screens cost about one Redis read per second.
      const st = await getState();
      return send(res, 200, JSON.stringify(st), 'application/json', { 'Cache-Control': 'public, max-age=0, s-maxage=1, stale-while-revalidate=1' });
    }
    if (m === 'PUT' && route === 'state') {
      if (!isAdmin(req)) return send(res, 401, '{"error":"login required"}', 'application/json');
      if (!(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, '{}', 'application/json');
      const body = asJson(await readBody(req));
      if (!body || typeof body.data !== 'object' || !body.data || !Array.isArray(body.data.rows) || typeof body.rev !== 'number') {
        return send(res, 400, '{"error":"bad data"}', 'application/json');
      }
      const out = await putState(body.rev, body.data);
      if (!out.ok) return send(res, 409, JSON.stringify(out.current), 'application/json');
      return send(res, 200, JSON.stringify({ rev: out.state.rev }), 'application/json');
    }
    if (m === 'GET' && route === 'export') {
      const d = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16).replace(/[:T]/g, '-');
      return send(res, 200, csv(await getState()), 'text/csv; charset=utf-8', { 'Content-Disposition': `attachment; filename="speed-comp-${d}.csv"` });
    }
    send(res, 404, 'Not found', 'text/plain');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      if (route === 'page' || route === 'admin') send(res, 500, noticePage('Something went wrong — refresh in a moment.'));
      else send(res, 500, '{"error":"server error"}', 'application/json');
    }
  }
};
