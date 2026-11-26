// Local test runner: `ADMIN_PASSWORD=test node local.js`, then open http://localhost:3000 (scores), /admin, /schedule, /speed, /admin/speed.
// Without Redis env vars, data is kept in memory.
const http = require('http');
const handler = require('./api/index.js');
const PORT = process.env.PORT || 3000;
http.createServer(handler).listen(PORT, () => console.log(`IM Competition dashboard (local) on http://localhost:${PORT}`));
