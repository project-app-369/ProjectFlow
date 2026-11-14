// Optional local preview. The demo also opens directly from index.html.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = { '/':'index.html', '/index.html':'index.html', '/styles.css':'styles.css', '/app.js':'app.js' };
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8' };
const server = http.createServer((req,res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, {'Content-Type':types[path.extname(file)], 'Cache-Control':'no-store'});
  fs.createReadStream(path.join(__dirname,file)).pipe(res);
});
server.listen(5182,'127.0.0.1',()=>console.log('Project Flow v2_codex: http://127.0.0.1:5182'));
