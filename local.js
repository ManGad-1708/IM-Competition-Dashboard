// Local test runner: put ADMIN_PASSWORD=… in .env.local (or export it), then `node local.js`, then open http://localhost:3000 (scores), /admin, /schedule, /speed, /admin/speed.
// Without Redis env vars, data is kept in memory.
const http = require('http');
const fs = require('fs');
// Load .env.local (git-ignored) so ADMIN_PASSWORD etc. can be set without exporting them.
try {
  for (const line of fs.readFileSync(__dirname + '/.env.local', 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const handler = require('./api/index.js');
const PORT = process.env.PORT || 3000;
http.createServer(handler).listen(PORT, () => console.log(`IM Competition dashboard (local) on http://localhost:${PORT}`));
