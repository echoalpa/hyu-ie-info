// 로컬 미리보기: http://localhost:8080/hyu-ie-info/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { site } from '../schema.mjs';
const BASE = new URL(site.url).pathname.replace(/\/$/, '');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml', '.png': 'image/png', '.yml': 'text/yaml; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(BASE)) { res.writeHead(302, { location: BASE + '/' }); return res.end(); }
  p = path.join('_site', p.slice(BASE.length));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404, { 'content-type': types['.html'] }); return res.end(fs.readFileSync('_site/404.html')); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  res.end(fs.readFileSync(p));
}).listen(8080, () => console.log(`http://localhost:8080${BASE}/`));
