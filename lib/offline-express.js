'use strict';
/* Tiny offline preview adapter for environments where npm is unavailable.
   Production/full internship deployment should install real Express.js. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function express() {
  const stack = [];
  function app(req, res) {
    const url = new URL(req.url, 'http://localhost');
    req.path = url.pathname;
    req.query = Object.fromEntries(url.searchParams);
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { if (res.writableEnded) return res; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); return res; };
    res.sendFile = filename => { const stream = fs.createReadStream(filename); res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream'); stream.on('error', () => { if (!res.writableEnded) res.status(404).end(); }); stream.pipe(res); return res; };
    let index = -1;
    function next(err) {
      if (res.writableEnded) return;
      if (err) return res.status(500).json({ error: 'Request could not be processed.' });
      index++;
      if (index >= stack.length) return res.status(404).json({ error: 'Not found.' });
      const item = stack[index];
      if (item.method && item.method !== req.method && !(item.method === 'GET' && req.method === 'HEAD')) return next();
      if (item.route) {
        const match = item.route.regex.exec(req.path);
        if (!match) return next();
        req.params = {};
        item.route.keys.forEach((k, i) => { req.params[k] = decodeURIComponent(match[i + 1]); });
      }
      try {
        const result = item.handler(req, res, next);
        if (result?.catch) result.catch(next);
      } catch (error) { next(error); }
    }
    next();
  }
  app.disable = () => app;
  app.use = fn => { stack.push({ handler: fn }); return app; };
  for (const method of ['get', 'post', 'put', 'delete']) app[method] = (route, ...handlers) => {
    const keys = [];
    const regex = route === '*' ? /^.*$/ : new RegExp('^' + route.split('/').map(s => s.startsWith(':') ? (keys.push(s.slice(1)), '([^/]+)') : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '/?$');
    handlers.forEach(handler => stack.push({ method: method.toUpperCase(), route: { regex, keys }, handler }));
    return app;
  };
  app.listen = (port, cb) => http.createServer(app).listen(port, cb);
  return app;
}
express.json = ({ limit='32kb' } = {}) => (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  if (!(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'Expected application/json.' });
  let data = '', max = Number.parseInt(limit) * 1024;
  req.on('data', chunk => { data += chunk; if (data.length > max) { res.status(413).json({ error: 'Request too large.' }); req.destroy(); } });
  req.on('end', () => { if (res.writableEnded) return; try { req.body = data ? JSON.parse(data) : {}; next(); } catch { res.status(400).json({ error: 'Invalid JSON.' }); } });
  req.on('error', () => { if (!res.writableEnded) res.status(400).json({ error: 'Invalid request.' }); });
};
express.static = root => (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  let requestPath;
  try { requestPath = decodeURIComponent(req.path); } catch { return res.status(400).end(); }
  if (requestPath.endsWith('/')) requestPath += 'index.html';
  const filepath = path.resolve(root, '.' + requestPath);
  if (!filepath.startsWith(root + path.sep) && filepath !== root) return next();
  fs.stat(filepath, (err, stat) => {
    if (err || !stat.isFile()) return next();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filepath);
  });
};
module.exports = express;
