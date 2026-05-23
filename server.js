const { createServer } = require('node:http');
const next = require('next');

const port = Number.parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '0.0.0.0';
const dev = process.env.NODE_ENV === 'development';
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, hostname, () => {
    console.log(`Server listening at http://${hostname}:${port} in ${dev ? 'development' : 'production'} mode`);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
