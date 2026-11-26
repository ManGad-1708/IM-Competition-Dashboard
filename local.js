// Local test runner: `ADMIN_PASSWORD=test node local.js`, then open http://localhost:3000 and /admin.
// Without Redis env vars, data is kept in memory.
const http = require('http');
const handler = require('./api/index.js');
const PORT = process.env.PORT || 3000;
http.createServer(handler).listen(PORT, () => console.log(`Speed Comp (local) on http://localhost:${PORT}`));
