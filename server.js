const fs = require('node:fs');
const path = require('node:path');

const standaloneServer = path.join(__dirname, 'output', 'server.js');

if (!fs.existsSync(standaloneServer)) {
  console.error('Missing output/server.js. Run "npm run build" before starting the app.');
  process.exit(1);
}

require(standaloneServer);
