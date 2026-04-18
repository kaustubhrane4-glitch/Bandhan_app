// api.js — Bandhan API client
// All calls to your Railway backend go through here

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function getToken() {
  return localStorage.getItem('bandhan_token') || '';
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['x-session-token'] = token;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  // Auto-logout on 401
  if (res.status === 401) {
    localStorage.removeItem('bandhan_token');
    window.location.reload();
  }

  return { ok: res.ok, status: res.status, data };
}

const api = {
  // Auth
  register:   (body) => request('POST', '/api/v2/auth/register', body),
  login:      (body) => request('POST', '/api/v2/auth/login', body),
  logout:     ()     => request('POST', '/api/v2/auth/logout'),
  me:         ()     => request('GET',  '/api/v2/auth/me'),

  // Profiles
  getProfiles: (params='') => request('GET', `/api/v2/profiles${params}`),
  getProfile:  (id)        => request('GET', `/api/v2/profiles/${id}`),
  updateMe:    (body)      => request('PUT', '/api/v2/profiles/me', body),

  // Matches
  getMatches: () => request('GET', '/api/v2/matches'),

  // Interests
  sendInterest:      (body) => request('POST', '/api/v2/interests', body),
  getReceivedInterests: () => request('GET', '/api/v2/interests/received'),
  getSentInterests:     () => request('GET', '/api/v2/interests/sent'),
  respondInterest: (id, status) => request('PUT', `/api/v2/interests/${id}`, { status }),

  // Messages
  getMessages:  (userId) => request('GET',  `/api/v2/messages/${userId}`),
  sendMessage:  (body)   => request('POST', '/api/v2/messages', body),

  // Verification
  verify: (step) => request('POST', `/api/v2/verify/${step}`),

  // Photos
  uploadPhoto: (photo) => request('POST', '/api/v2/photos/upload', { photo }),

  // Safety
  reportUser:   (body) => request('POST', '/api/v2/safety/report', body),
  checkMessage: (text) => request('POST', '/api/v2/safety/check', { text }),
  blockUser:    (id)   => request('POST', `/api/v2/safety/block/${id}`),

  // Plans
  getPlans:   ()     => request('GET',  '/api/v2/plans'),
  upgradePlan:(plan) => request('POST', '/api/v2/plans/upgrade', { plan }),

  // Quiz
  submitQuiz: (answers) => request('POST', '/api/v2/quiz/submit', { answers }),

  // Stats
  getStats:  () => request('GET', '/api/v2/stats'),
  getConfig: () => request('GET', '/api/v2/config'),
};

export default api;
