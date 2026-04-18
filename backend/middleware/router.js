// middleware/router.js — Lightweight HTTP router (no Express needed)

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  try { return Object.fromEntries(new URLSearchParams(url.slice(idx + 1))); }
  catch { return {}; }
}

function matchRoute(pattern, pathname) {
  const pp = pattern.split('/');
  const qp = pathname.split('/');
  if (pp.length !== qp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(qp[i]);
    else if (pp[i] !== qp[i]) return null;
  }
  return params;
}

function json(res, status, data) {
  const origin = '*'; // set to your frontend URL in production
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || origin,
    'Access-Control-Allow-Headers': 'Content-Type, x-session-token, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  });
  res.end(JSON.stringify(data, null, 2));
}

class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler) { this.routes.push({ method, pattern, handler }); }
  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  put(p, h) { this.add('PUT', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }

  async handle(req, res) {
    const pathname = req.url.split('?')[0];

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-session-token, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    req.query = parseQuery(req.url);

    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const params = matchRoute(route.pattern, pathname);
      if (params !== null) {
        req.params = params;
        if (req.method !== 'GET') req.body = await parseBody(req);
        try { await route.handler(req, res); }
        catch (err) {
          console.error('Route error:', err);
          json(res, 500, { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
        }
        return;
      }
    }
    json(res, 404, { error: 'Route not found', path: pathname });
  }
}

module.exports = { Router, json };
