// routes/api.js — All Bandhan API endpoints
const db = require('../db');
const { Router, json } = require('../middleware/router');
const { hashPassword, createSession, destroySession, requireAuth, requireAdmin, requirePlan } = require('../middleware/auth');
const AIMatchEngine = require('../services/AIMatchEngine');

const router = new Router();
const BASE = '/api/v2';

// ═══════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════
router.get('/health', (req, res) => {
  json(res, 200, { status:'healthy', version:'2.0.0', timestamp: new Date().toISOString() });
});

router.get(`${BASE}/stats`, (req, res) => {
  const users = db.read('users');
  const interests = db.read('interests');
  const messages = db.read('messages');
  json(res, 200, {
    app:'Bandhan Matrimony', version:'2.0.0',
    stats: {
      total_users: users.filter(u=>!u.deleted).length,
      verified_users: users.filter(u=>u.verified).length,
      active_users: users.filter(u=>u.active&&!u.deleted).length,
      interests_sent: interests.length,
      matches_accepted: interests.filter(i=>i.status==='accepted').length,
      messages_exchanged: messages.length,
    }
  });
});

router.get(`${BASE}/config`, (req, res) => {
  const config = db.readConfig();
  json(res, 200, {
    languages: config.languages || [],
    religions: config.religions || [],
    marital_statuses: config.marital_statuses || [],
    income_ranges: config.income_ranges || [],
    education_levels: config.education_levels || [],
    quiz_dimensions: AIMatchEngine.QUIZ_DIMENSIONS,
  });
});

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
router.post(`${BASE}/auth/register`, (req, res) => {
  const { name, email, password, phone, dob, gender, religion, city, state, language } = req.body;

  if (!name?.trim()) return json(res, 400, { error:'Name is required.' });
  if (!email?.trim()) return json(res, 400, { error:'Email is required.' });
  if (!password || password.length < 8) return json(res, 400, { error:'Password must be at least 8 characters.' });
  if (!phone?.trim()) return json(res, 400, { error:'Phone number is required.' });
  if (!gender) return json(res, 400, { error:'Gender is required.' });
  if (!religion) return json(res, 400, { error:'Religion is required.' });

  if (db.findOne('users', { email: email.toLowerCase() })) {
    return json(res, 409, { error:'Email already registered. Please login.' });
  }
  if (db.findOne('users', { phone })) {
    return json(res, 409, { error:'Phone number already registered.' });
  }

  const user = db.insert('users', {
    id: db.generateId('u'),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashPassword(password),
    phone: phone.trim(),
    dob: dob || null,
    gender,
    religion,
    caste: '', city: city||'', state: state||'', country:'India',
    mother_tongue: language||'Hindi', languages: [language||'Hindi'],
    marital_status:'Never Married',
    education_level:'', profession:'', income_range:'',
    about:'', values:[], hobbies:[], photos:[],
    partner_preference: {},
    subscription: { plan:'free', status:'active' },
    verification: {},
    verified: false, trust_score:30, profile_complete_pct:20,
    active:true, deleted:false, is_suspended:false, is_admin:false,
    last_active: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  const token = createSession(user.id);
  const { password:_, ...safe } = user;
  json(res, 201, {
    message:`Welcome to Bandhan, ${name.split(' ')[0]}! 💍`,
    token, user: safe
  });
});

router.post(`${BASE}/auth/login`, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return json(res, 400, { error:'Email and password are required.' });

  const user = db.findOne('users', { email: email.toLowerCase(), deleted:false });
  if (!user || user.password !== hashPassword(password)) {
    return json(res, 401, { error:'Invalid email or password.' });
  }
  if (user.is_suspended) {
    return json(res, 403, { error:'Account suspended. Contact support@bandhan.app', reason: user.suspension_reason });
  }

  db.update('users', user.id, { last_active: new Date().toISOString() });
  const token = createSession(user.id);
  const { password:_, ...safe } = user;
  json(res, 200, { message:`Welcome back, ${user.name.split(' ')[0]}! 💍`, token, user: safe });
});

router.post(`${BASE}/auth/logout`, (req, res) => {
  const token = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ','');
  if (token) destroySession(token);
  json(res, 200, { message:'Logged out successfully.' });
});

router.get(`${BASE}/auth/me`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { password:_, ...safe } = user;
  json(res, 200, { user: safe });
});

// ═══════════════════════════════════════
// PROFILES
// ═══════════════════════════════════════
router.get(`${BASE}/profiles`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { religion, city, min_age, max_age, marital_status, language, verified_only, page=1, limit=20 } = req.query;
  const plan = user.subscription?.plan || user.plan || 'free';

  let profiles = db.read('users').filter(u =>
    u.id !== user.id && u.active && !u.deleted && !u.is_suspended && u.gender !== user.gender
  );

  if (religion && religion !== 'Any') profiles = profiles.filter(u => u.religion === religion);
  if (city) profiles = profiles.filter(u => u.city?.toLowerCase().includes(city.toLowerCase()));
  if (marital_status) profiles = profiles.filter(u => u.marital_status === marital_status);
  if (language) profiles = profiles.filter(u => u.languages?.includes(language) || u.mother_tongue === language);
  if (verified_only === 'true') profiles = profiles.filter(u => u.verified);
  if (min_age) profiles = profiles.filter(u => (u.age||0) >= parseInt(min_age));
  if (max_age) profiles = profiles.filter(u => (u.age||99) <= parseInt(max_age));

  // Plan limits
  if (plan === 'free') profiles = profiles.slice(0, 5);

  // AI scoring + sort
  const scored = profiles.map(u => {
    const compat = AIMatchEngine.calculateCompatibility(user, u);
    const { password:_, ...safe } = u;
    return { ...safe, compatibility: compat.score, grade: compat.grade, highlights: compat.highlights, cautions: compat.cautions };
  }).sort((a,b) => b.compatibility - a.compatibility);

  // Pagination
  const p = parseInt(page), l = Math.min(parseInt(limit), 50);
  json(res, 200, {
    total: scored.length, page: p, limit: l, plan,
    upgrade_note: plan==='free' ? 'Upgrade to Plus for unlimited profiles' : null,
    profiles: scored.slice((p-1)*l, p*l)
  });
});

router.get(`${BASE}/profiles/:id`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const profile = db.findById('users', req.params.id);
  if (!profile || !profile.active || profile.deleted) return json(res, 404, { error:'Profile not found.' });
  db.update('users', profile.id, { profile_views: (profile.profile_views||0)+1 });
  const compat = AIMatchEngine.calculateCompatibility(user, profile);
  const { password:_, ...safe } = profile;
  json(res, 200, { profile: { ...safe, ...compat } });
});

router.put(`${BASE}/profiles/me`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const allowed = ['name','about','city','state','education_level','education_field','profession','company','income_range','diet','smoking','drinking','height_cm','family_type','family_values','hobbies','values','mother_tongue','languages','partner_preference','religion','caste','marital_status','photo_visibility','notification_prefs'];
  const updates = {};
  for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
  if (!Object.keys(updates).length) return json(res, 400, { error:'No valid fields to update.' });
  const updated = db.update('users', user.id, updates);
  const { password:_, ...safe } = updated;
  json(res, 200, { message:'Profile updated.', user: safe });
});

// ═══════════════════════════════════════
// MATCHES (AI Feed)
// ═══════════════════════════════════════
router.get(`${BASE}/matches`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const plan = user.subscription?.plan || user.plan || 'free';
  const all = db.read('users').filter(u => u.id!==user.id && u.active && !u.deleted && !u.is_suspended && u.gender!==user.gender);
  const feed = AIMatchEngine.getSmartFeed(user, all);
  const limited = plan === 'free' ? feed.slice(0,5) : feed;
  json(res, 200, {
    total: limited.length, plan,
    limit_note: plan==='free' ? 'Upgrade to Plus for unlimited matches' : null,
    matches: limited.map(m => {
      const { password:_, ...safe } = m.user;
      return { ...safe, compatibility:m.score, grade:m.grade, highlights:m.highlights, cautions:m.cautions };
    })
  });
});

// ═══════════════════════════════════════
// QUIZ
// ═══════════════════════════════════════
router.post(`${BASE}/quiz/submit`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { answers } = req.body;
  if (!answers || typeof answers !== 'object') return json(res, 400, { error:'Quiz answers required.' });
  const vector = AIMatchEngine.processQuizAnswers(answers);
  db.update('users', user.id, { quiz_completed:true, quiz_answers:answers, personality_vector:vector });
  json(res, 200, { message:'Personality profile created! Your matches are now more accurate. ✨' });
});

// ═══════════════════════════════════════
// INTERESTS
// ═══════════════════════════════════════
router.post(`${BASE}/interests`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { to_user_id, message } = req.body;
  if (!to_user_id) return json(res, 400, { error:'to_user_id is required.' });
  const toUser = db.findById('users', to_user_id);
  if (!toUser || toUser.deleted) return json(res, 404, { error:'Profile not found.' });
  if (db.read('interests').find(i => i.from_user===user.id && i.to_user===to_user_id)) {
    return json(res, 409, { error:'Interest already sent to this profile.' });
  }
  const interest = db.insert('interests', {
    id: db.generateId('i'), from_user:user.id, to_user:to_user_id,
    status:'pending', message: message||'I am interested in connecting with you.',
    created_at: new Date().toISOString()
  });
  json(res, 201, { message:`💌 Interest sent to ${toUser.name.split(' ')[0]}!`, interest });
});

router.get(`${BASE}/interests/received`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const interests = db.findMany('interests', { to_user:user.id })
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    .map(i => {
      const sender = db.findById('users', i.from_user);
      const { password:_, ...safe } = sender||{};
      const compat = sender ? AIMatchEngine.calculateCompatibility(user, sender) : {};
      return { ...i, sender:{ ...safe, compatibility: compat.score||0 } };
    });
  json(res, 200, { total:interests.length, interests });
});

router.get(`${BASE}/interests/sent`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const interests = db.findMany('interests', { from_user:user.id })
    .map(i => {
      const r = db.findById('users', i.to_user);
      const { password:_, ...safe } = r||{};
      return { ...i, receiver:safe };
    });
  json(res, 200, { total:interests.length, interests });
});

router.put(`${BASE}/interests/:id`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { status } = req.body;
  if (!['accepted','rejected'].includes(status)) return json(res, 400, { error:'Status must be accepted or rejected.' });
  const interest = db.findById('interests', req.params.id);
  if (!interest) return json(res, 404, { error:'Interest not found.' });
  if (interest.to_user !== user.id) return json(res, 403, { error:'Forbidden.' });
  const updated = db.update('interests', req.params.id, { status });
  json(res, 200, { message: status==='accepted'?'🎉 Accepted! You can now chat.':'Interest declined.', interest:updated });
});

// ═══════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════
router.get(`${BASE}/messages/:with_user_id`, (req, res) => {
  const user = requirePlan('plus', req, res);
  if (!user) return;
  const other = req.params.with_user_id;
  const msgs = db.read('messages').filter(m =>
    (m.from_user===user.id&&m.to_user===other)||(m.from_user===other&&m.to_user===user.id)
  ).sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
  json(res, 200, { conversation_with:other, total:msgs.length, messages:msgs });
});

router.post(`${BASE}/messages`, (req, res) => {
  const user = requirePlan('plus', req, res);
  if (!user) return;
  const { to_user_id, text } = req.body;
  if (!to_user_id || !text?.trim()) return json(res, 400, { error:'to_user_id and text are required.' });

  // Safety check
  const safety = AIMatchEngine.analyzeMessage(text);
  if (safety.should_block) {
    return json(res, 200, {
      warning:'🚨 Safety Shield Alert', risk:safety.risk,
      message: safety.warning, sent:false,
    });
  }

  const msg = db.insert('messages', {
    id: db.generateId('m'), from_user:user.id, to_user:to_user_id,
    text: text.trim(), type:'text', read:false, flagged:safety.flagged,
    created_at: new Date().toISOString()
  });
  json(res, 201, { sent:true, message:msg });
});

// ═══════════════════════════════════════
// VERIFICATION
// ═══════════════════════════════════════
router.post(`${BASE}/verify/:step`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const valid = ['phone_otp','email_otp','aadhaar','selfie','live_photo'];
  const { step } = req.params;
  if (!valid.includes(step)) return json(res, 400, { error:`Invalid step. Valid: ${valid.join(', ')}` });

  const updates = {};
  updates[`verification.${step}`] = { done:true, at:new Date().toISOString() };

  const current = { ...user.verification, [step]:{ done:true } };
  const allDone = valid.every(s => current[s]?.done);
  const trust = Math.min(100,
    (current.phone_otp?.done?10:0)+(current.email_otp?.done?10:0)+
    (current.aadhaar?.done?30:0)+(current.selfie?.done?25:0)+(current.live_photo?.done?25:0)
  );

  db.update('users', user.id, { ...updates, trust_score:trust, verified:allDone });
  json(res, 200, {
    message:`✅ ${step.replace('_',' ')} verified!`,
    trust_score:trust, verified:allDone,
    next_step: valid[valid.indexOf(step)+1] || null
  });
});

// ═══════════════════════════════════════
// PHOTOS
// ═══════════════════════════════════════
router.post(`${BASE}/photos/upload`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { photo } = req.body; // base64 data URL
  if (!photo) return json(res, 400, { error:'photo is required.' });

  // Validate it's a real image
  if (!photo.startsWith('data:image/')) return json(res, 400, { error:'Invalid image format. Must be a base64 data URL.' });

  const photos = user.photos || [];
  if (photos.length >= 6) return json(res, 400, { error:'Maximum 6 photos allowed.' });

  const newPhoto = {
    id: db.generateId('ph'),
    url: photo,
    is_primary: photos.length === 0,
    is_live: req.body.is_live || false,
    uploaded_at: new Date().toISOString(),
    method: 'base64',
  };

  photos.push(newPhoto);
  db.update('users', user.id, { photos });

  // Increase trust score for having photos
  const newTrust = Math.min(100, (user.trust_score||30) + (photos.length===1?15:5));
  db.update('users', user.id, { trust_score: newTrust });

  json(res, 201, { message:'Photo uploaded!', photo:newPhoto, total_photos:photos.length, trust_score:newTrust });
});

router.delete(`${BASE}/photos/:photo_id`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const photos = (user.photos||[]).filter(p => p.id !== req.params.photo_id);
  if (photos.length>0 && !photos.some(p=>p.is_primary)) photos[0].is_primary=true;
  db.update('users', user.id, { photos });
  json(res, 200, { message:'Photo removed.', total_photos:photos.length });
});

// ═══════════════════════════════════════
// PLANS & PAYMENTS
// ═══════════════════════════════════════
router.get(`${BASE}/plans`, (req, res) => {
  json(res, 200, {
    plans: {
      free:    { name:'Muft', price:0, currency:'INR', features:['5 matches/day','Express interest','Safety Shield','20+ languages'], limits:{ matches_per_day:5, messaging:false } },
      plus:    { name:'Bandhan Plus', price:499, currency:'INR', trial_days:7, refund_days:15, features:['Unlimited matches','Messaging','See who liked you','Priority visibility','Kundli','15-day refund'] },
      parivar: { name:'Parivar Plan', price:799, currency:'INR', trial_days:7, refund_days:15, features:['Everything in Plus','Parent + child accounts','Family dashboard','Priority 24hr support'] },
    }
  });
});

router.post(`${BASE}/plans/upgrade`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { plan } = req.body;
  const valid = ['free','plus','parivar','elite'];
  if (!valid.includes(plan)) return json(res, 400, { error:`Invalid plan. Choose: ${valid.join(', ')}` });
  const prices = { plus:499, parivar:799, elite:4999, free:0 };
  db.update('users', user.id, {
    'subscription.plan': plan,
    'subscription.status': plan==='free'?'active':'active',
    'subscription.started_at': new Date().toISOString(),
    'subscription.auto_renew': false,
  });
  json(res, 200, {
    message:`✅ Upgraded to ${plan}! Enjoy your features.`,
    plan, price: prices[plan],
    note:'15-day money-back guarantee. No auto-renewal by default. No sales calls, ever.'
  });
});

// ═══════════════════════════════════════
// SAFETY
// ═══════════════════════════════════════
router.post(`${BASE}/safety/report`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { reported_user_id, reason } = req.body;
  if (!reported_user_id || !reason) return json(res, 400, { error:'reported_user_id and reason required.' });
  const report = db.insert('reports', {
    id:db.generateId('r'), reported_by:user.id, reported_user:reported_user_id,
    reason, status:'pending', created_at:new Date().toISOString()
  });
  const reported = db.findById('users', reported_user_id);
  if (reported) db.update('users', reported_user_id, { reports_received:(reported.reports_received||0)+1 });
  json(res, 201, { message:'✅ Report submitted. Safety team reviews within 24 hours.', report_id:report.id });
});

router.post(`${BASE}/safety/check`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { text } = req.body;
  if (!text) return json(res, 400, { error:'text is required.' });
  json(res, 200, AIMatchEngine.analyzeMessage(text));
});

router.post(`${BASE}/safety/block/:user_id`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const blocked = [...(user.blocked_users||[])];
  if (!blocked.includes(req.params.user_id)) blocked.push(req.params.user_id);
  db.update('users', user.id, { blocked_users:blocked });
  json(res, 200, { message:'User blocked.' });
});

// ═══════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════
router.get(`${BASE}/admin/stats`, (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const users = db.read('users');
  const interests = db.read('interests');
  const messages = db.read('messages');
  const reports = db.read('reports');
  const revenue = { plus:499, parivar:799, elite:4999 };
  const mrr = users.filter(u=>u.subscription?.plan&&u.subscription.plan!=='free').reduce((s,u)=>s+(revenue[u.subscription.plan]||0),0);
  json(res, 200, {
    users: {
      total: users.filter(u=>!u.deleted).length,
      verified: users.filter(u=>u.verified).length,
      suspended: users.filter(u=>u.is_suspended).length,
      by_plan: { free:users.filter(u=>(u.subscription?.plan||'free')==='free').length, plus:users.filter(u=>u.subscription?.plan==='plus').length, parivar:users.filter(u=>u.subscription?.plan==='parivar').length },
    },
    revenue: { mrr, arr:mrr*12 },
    engagement: { interests:interests.length, messages:messages.length, match_rate: interests.length ? Math.round((interests.filter(i=>i.status==='accepted').length/interests.length)*100):0 },
    safety: { pending_reports:reports.filter(r=>r.status==='pending').length },
  });
});

router.get(`${BASE}/admin/users`, (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const { search, plan, page=1, limit=50 } = req.query;
  let users = db.read('users').filter(u=>!u.deleted);
  if (search) { const q=search.toLowerCase(); users=users.filter(u=>u.name?.toLowerCase().includes(q)||u.email?.toLowerCase().includes(q)); }
  if (plan) users = users.filter(u=>(u.subscription?.plan||'free')===plan);
  const p=parseInt(page),l=Math.min(parseInt(limit),100);
  json(res, 200, { total:users.length, page:p, users:users.slice((p-1)*l,p*l).map(u=>{const{password:_,...s}=u;return s;}) });
});

router.put(`${BASE}/admin/users/:id/suspend`, (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  db.update('users', req.params.id, { is_suspended:true, suspension_reason:req.body.reason||'Policy violation', suspended_at:new Date().toISOString() });
  json(res, 200, { message:'User suspended.' });
});

router.put(`${BASE}/admin/users/:id/reinstate`, (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  db.update('users', req.params.id, { is_suspended:false, suspension_reason:null });
  json(res, 200, { message:'User reinstated.' });
});

router.get(`${BASE}/admin/reports`, (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  json(res, 200, { reports: db.read('reports') });
});

router.put(`${BASE}/admin/reports/:id`, (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  db.update('reports', req.params.id, { status:req.body.status, action_taken:req.body.action, updated_at:new Date().toISOString() });
  json(res, 200, { message:`Report ${req.body.status}.` });
});

// ═══════════════════════════════════════
// DELETE ACCOUNT
// ═══════════════════════════════════════
router.delete(`${BASE}/users/me`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  db.update('users', user.id, { deleted:true, deleted_at:new Date().toISOString(), active:false, name:'Deleted User', email:`deleted_${user.id}@bandhan.app`, phone:`deleted_${user.id}`, photos:[], about:'' });
  json(res, 200, { message:'Account deleted. All data will be permanently removed within 30 days.' });
});

module.exports = router;
