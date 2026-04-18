// middleware/auth.js — Session auth + password hashing
const crypto = require('crypto');
const db = require('../db');

// In-memory session store (survives server restarts if you add file persistence)
const sessions = new Map();

// Hash password with SHA-256 + salt
function hashPassword(password) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'bandhan_default_secret')
    .update(password)
    .digest('hex');
}

// Create a new session token
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  });
  return token;
}

// Get session data from token
function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

// Destroy session (logout)
function destroySession(token) {
  sessions.delete(token);
}

// Middleware: require authenticated user
function requireAuth(req, res) {
  const token = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ', '');
  const session = getSession(token);

  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized. Please login.', code: 'AUTH_REQUIRED' }));
    return null;
  }

  const user = db.findById('users', session.userId);
  if (!user) {
    sessions.delete(token);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'User not found.', code: 'USER_NOT_FOUND' }));
    return null;
  }

  if (user.is_suspended) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Account suspended. Contact support@bandhan.app', reason: user.suspension_reason }));
    return null;
  }

  return user;
}

// Middleware: require admin
function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!user.is_admin) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Admin access required.' }));
    return null;
  }
  return user;
}

// Middleware: require minimum plan
function requirePlan(minPlan, req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  const order = { free: 0, plus: 1, parivar: 2, elite: 3 };
  const userPlan = user.subscription?.plan || user.plan || 'free';
  if ((order[userPlan] || 0) < (order[minPlan] || 0)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: `This feature requires ${minPlan} plan or higher.`,
      current_plan: userPlan,
      upgrade_url: '/api/v2/plans'
    }));
    return null;
  }
  return user;
}

module.exports = { hashPassword, createSession, getSession, destroySession, requireAuth, requireAdmin, requirePlan };
