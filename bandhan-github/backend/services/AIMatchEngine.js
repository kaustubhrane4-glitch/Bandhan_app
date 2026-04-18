// services/AIMatchEngine.js — AI Compatibility Engine

const SCAM_PATTERNS = [
  { pattern: /send\s+money|transfer\s+money|wire\s+transfer/i, risk:'HIGH', type:'financial_request' },
  { pattern: /bank\s+account|account\s+number|ifsc/i, risk:'HIGH', type:'banking_info' },
  { pattern: /western\s+union|moneygram|money\s+gram/i, risk:'CRITICAL', type:'money_transfer' },
  { pattern: /bitcoin|crypto|usdt|binance|ethereum/i, risk:'HIGH', type:'crypto_scam' },
  { pattern: /customs\s+duty|customs\s+officer|clearance\s+fee/i, risk:'CRITICAL', type:'gift_scam' },
  { pattern: /gift\s+card|amazon\s+card|itunes\s+card/i, risk:'HIGH', type:'gift_card' },
  { pattern: /stuck\s+at\s+airport|medical\s+emergency|urgent\s+help/i, risk:'MEDIUM', type:'emergency_scam' },
  { pattern: /visa\s+fee|immigration\s+fee|processing\s+fee/i, risk:'HIGH', type:'fee_scam' },
  { pattern: /upi\s+id|paytm\s+number|gpay\s+number/i, risk:'HIGH', type:'payment_request' },
  { pattern: /lottery|you\s+have\s+won|selected\s+for\s+prize/i, risk:'HIGH', type:'lottery_scam' },
];

const QUIZ_DIMENSIONS = [
  { id:'family_orientation', weight:0.18, question:'How central is family to your life decisions?' },
  { id:'career_ambition', weight:0.12, question:'How important is career growth to you?' },
  { id:'religious_practice', weight:0.14, question:'How often do you engage in religious practice?' },
  { id:'social_personality', weight:0.10, question:'How would you describe your social style?' },
  { id:'lifestyle_pace', weight:0.10, question:'How do you prefer to spend your free time?' },
  { id:'financial_values', weight:0.08, question:'Your financial philosophy?' },
  { id:'parenting_views', weight:0.12, question:'Your views on raising children?' },
  { id:'communication_style', weight:0.08, question:'How do you handle disagreements?' },
  { id:'independence_level', weight:0.10, question:'How much personal space do you need?' },
  { id:'tradition_vs_modern', weight:0.08, question:'Traditional or modern lifestyle?' },
];

class AIMatchEngine {
  static calculateCompatibility(u1, u2) {
    // Hard filters first
    const hard = this.checkHardFilters(u1, u2);
    if (!hard.passed) return { score:0, grade:'F', reason: hard.reason, highlights:[], cautions:[hard.reason] };

    const scores = {
      demographic: this.demographicScore(u1, u2),
      personality: this.personalityScore(u1, u2),
      lifestyle: this.lifestyleScore(u1, u2),
      behavioral: this.behavioralScore(u1, u2),
    };

    const weights = { demographic:0.35, personality:0.30, lifestyle:0.20, behavioral:0.15 };
    const total = Object.keys(scores).reduce((sum, k) => sum + scores[k] * weights[k], 0);
    const score = Math.round(Math.min(99, Math.max(1, total)));

    return {
      score,
      grade: this.grade(score),
      breakdown: scores,
      highlights: this.highlights(u1, u2, scores),
      cautions: this.cautions(u1, u2),
    };
  }

  static checkHardFilters(u1, u2) {
    const pref = u1.partner_preference || {};
    const age2 = u2.age || 25;
    if (pref.age_min && age2 < pref.age_min) return { passed:false, reason:`Partner age ${age2} below min ${pref.age_min}` };
    if (pref.age_max && age2 > pref.age_max) return { passed:false, reason:`Partner age ${age2} above max ${pref.age_max}` };
    if (pref.religions?.length && !pref.religions.includes('Any') && !pref.religions.includes(u2.religion)) {
      return { passed:false, reason:'Religion mismatch' };
    }
    const db = pref.deal_breakers || [];
    if (db.includes('no_smoking') && u2.smoking === 'Regularly') return { passed:false, reason:'Smoking deal-breaker' };
    if (db.includes('no_drinking') && u2.drinking === 'Regularly') return { passed:false, reason:'Drinking deal-breaker' };
    return { passed:true };
  }

  static demographicScore(u1, u2) {
    let s = 0;
    // Religion (25pts)
    s += u1.religion === u2.religion ? 25 : 5;
    // Age diff (20pts)
    const ad = Math.abs((u1.age||27) - (u2.age||27));
    s += ad <= 2 ? 20 : ad <= 4 ? 15 : ad <= 6 ? 10 : ad <= 8 ? 5 : 2;
    // Language (15pts)
    const l1 = u1.languages || [u1.mother_tongue], l2 = u2.languages || [u2.mother_tongue];
    s += l1.some(l => l2.includes(l)) ? 15 : 3;
    // Location (15pts)
    s += u1.city === u2.city ? 15 : u1.state === u2.state ? 10 : u1.country === u2.country ? 5 : 2;
    // Education (15pts)
    const el = {'High School':1,'Diploma':2,'Graduate':3,'Post Graduate':4,'Doctorate':5};
    const ed = Math.abs((el[u1.education_level]||3) - (el[u2.education_level]||3));
    s += ed === 0 ? 15 : ed === 1 ? 11 : ed === 2 ? 7 : 3;
    // Caste optional (10pts)
    if (u1.caste && u2.caste) s += u1.caste === u2.caste ? 10 : 2;
    else s += 5;
    return Math.round(Math.min(100, s));
  }

  static personalityScore(u1, u2) {
    if (u1.personality_vector?.length && u2.personality_vector?.length) {
      return Math.round(this.cosine(u1.personality_vector, u2.personality_vector) * 100);
    }
    const v1 = u1.values || [], v2 = u2.values || [];
    if (!v1.length || !v2.length) return 55;
    const overlap = v1.filter(v => v2.includes(v)).length;
    return Math.round((overlap / Math.max(v1.length, v2.length)) * 100);
  }

  static lifestyleScore(u1, u2) {
    let s = 0, max = 0;
    const add = (pts, match) => { max += pts; if (match) s += pts; };
    if (u1.diet && u2.diet) {
      max += 25;
      if (u1.diet === u2.diet) s += 25;
      else if (['Vegetarian','Vegan','Jain'].includes(u1.diet) === ['Vegetarian','Vegan','Jain'].includes(u2.diet)) s += 15;
      else s += 5;
    }
    if (u1.smoking && u2.smoking) { max+=20; if(u1.smoking===u2.smoking) s+=20; else if(u1.smoking!=='Never'||u2.smoking!=='Never') s+=8; }
    if (u1.drinking && u2.drinking) { max+=20; if(u1.drinking===u2.drinking) s+=20; else if(u1.drinking!=='Never'||u2.drinking!=='Never') s+=8; }
    if (u1.family_values && u2.family_values) {
      const fv = ['Orthodox','Traditional','Moderate','Liberal'];
      max+=20; const d=Math.abs(fv.indexOf(u1.family_values)-fv.indexOf(u2.family_values));
      s += d===0?20:d===1?14:d===2?8:3;
    }
    const h1=u1.hobbies||[], h2=u2.hobbies||[];
    if (h1.length&&h2.length) { max+=15; s+=Math.round((h1.filter(h=>h2.includes(h)).length/Math.max(h1.length,h2.length))*15); }
    return max>0 ? Math.round((s/max)*100) : 55;
  }

  static behavioralScore(u1, u2) {
    let s = 50;
    s += ((u1.trust_score||50)+(u2.trust_score||50))/2 > 70 ? 15 : 0;
    s += ((u1.profile_complete_pct||50)+(u2.profile_complete_pct||50))/2 > 70 ? 10 : 0;
    if (u1.verified && u2.verified) s += 15;
    else if (u1.verified || u2.verified) s += 7;
    return Math.round(Math.min(100, Math.max(0, s)));
  }

  static cosine(v1, v2) {
    const dot = v1.reduce((s,v,i) => s + v*(v2[i]||0), 0);
    const m1 = Math.sqrt(v1.reduce((s,v) => s+v*v, 0));
    const m2 = Math.sqrt(v2.reduce((s,v) => s+v*v, 0));
    return (!m1||!m2) ? 0 : Math.max(0, Math.min(1, dot/(m1*m2)));
  }

  static grade(s) {
    return s>=90?'A+':s>=80?'A':s>=70?'B+':s>=60?'B':s>=50?'C':'D';
  }

  static highlights(u1, u2, scores) {
    const h = [];
    if (u1.religion===u2.religion) h.push(`Same religion (${u1.religion})`);
    const l1=u1.languages||[u1.mother_tongue], l2=u2.languages||[u2.mother_tongue];
    const cl=l1.filter(l=>l2.includes(l))[0];
    if (cl) h.push(`Both speak ${cl}`);
    if (u1.diet===u2.diet) h.push(`Same diet (${u1.diet})`);
    if (scores.personality>=70) h.push('Strong personality match');
    if (u1.city===u2.city) h.push(`Both in ${u1.city}`);
    if (u1.family_values===u2.family_values) h.push(`Matching family values`);
    return h.slice(0,3);
  }

  static cautions(u1, u2) {
    const c = [];
    if (u1.diet!==u2.diet) c.push('Different dietary preferences');
    const ad=Math.abs((u1.age||27)-(u2.age||27));
    if (ad>6) c.push(`${ad} year age difference`);
    return c.slice(0,2);
  }

  static analyzeMessage(text) {
    if (!text) return { flagged:false, risk:'SAFE', findings:[], should_block:false };
    const findings = SCAM_PATTERNS
      .filter(p => p.pattern.test(text))
      .map(p => ({ risk:p.risk, type:p.type }));
    const critical = findings.some(f=>f.risk==='CRITICAL');
    const high = findings.some(f=>f.risk==='HIGH');
    return {
      flagged: findings.length>0,
      risk: critical?'CRITICAL':high?'HIGH':findings.length?'MEDIUM':'SAFE',
      findings,
      should_block: critical||high,
      warning: findings.length>0
        ? '🚨 Safety Shield: This message contains suspicious content. Never send money to anyone on Bandhan.'
        : null,
    };
  }

  static processQuizAnswers(answers) {
    return QUIZ_DIMENSIONS.map(d => ((answers[d.id] ?? 2) / 4));
  }

  static getSmartFeed(user, candidates) {
    return candidates
      .map(c => ({ ...this.calculateCompatibility(user, c), user: c }))
      .filter(m => m.score > 0)
      .sort((a,b) => {
        const boost = u => (u.verified?5:0)+(u.trust_score>80?3:0)+((Date.now()-new Date(u.last_active||0))<3*86400000?4:0);
        return (b.score+boost(b.user)) - (a.score+boost(a.user));
      });
  }

  static get QUIZ_DIMENSIONS() { return QUIZ_DIMENSIONS; }
}

module.exports = AIMatchEngine;
