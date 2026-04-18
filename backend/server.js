// server.js — Bandhan Matrimony API v2.0
// Pure Node.js — zero npm dependencies needed for MVP

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env file manually (no dotenv package needed)
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf-8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#') && key.trim()) {
      process.env[key.trim()] = vals.join('=').trim();
    }
  });
}

const PORT = process.env.PORT || 3000;
const apiRouter = require('./routes/api');

const server = http.createServer(async (req, res) => {
  // Log requests in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${new Date().toISOString().slice(11,19)} ${req.method} ${req.url}`);
  }

  // API routes
  if (req.url.startsWith('/api/') || req.url === '/health') {
    return apiRouter.handle(req, res);
  }

  // Root — API info
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    name: 'Bandhan Matrimony API',
    version: '2.0.0',
    status: 'running',
    docs: '/api/v2/config',
    health: '/health',
    endpoints: {
      auth: ['/api/v2/auth/register', '/api/v2/auth/login', '/api/v2/auth/logout', '/api/v2/auth/me'],
      profiles: ['/api/v2/profiles', '/api/v2/profiles/:id', '/api/v2/profiles/me'],
      matches: ['/api/v2/matches'],
      interests: ['/api/v2/interests', '/api/v2/interests/received', '/api/v2/interests/sent'],
      messages: ['/api/v2/messages/:user_id'],
      safety: ['/api/v2/safety/report', '/api/v2/safety/check', '/api/v2/safety/block/:id'],
      plans: ['/api/v2/plans', '/api/v2/plans/upgrade'],
      verify: ['/api/v2/verify/:step'],
      photos: ['/api/v2/photos/upload'],
      admin: ['/api/v2/admin/stats', '/api/v2/admin/users', '/api/v2/admin/reports'],
    }
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║      💍  BANDHAN MATRIMONY API v2.0      ║');
  console.log('  ║   बंधन — हर दिल का रिश्ता               ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  🚀  Running on http://localhost:${PORT}`);
  console.log(`  🌍  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  💾  Database: JSON files in ./data/`);
  console.log('');
  console.log('  💡  Demo login: priya@example.com / demo123');
  console.log('');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Try a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

module.exports = server;
