import { useState, useRef, useEffect } from "react";
import api from "./api";

/* ─── HELPERS ─── */
function calcCompat(u1, u2) {
  let s = 0;
  if (u1.religion === u2.religion) s += 25; else s += 5;
  if ((u1.languages||[]).some(l => (u2.languages||[]).includes(l))) s += 18; else s += 3;
  const v1=u1.values||[], v2=u2.values||[];
  if (v1.length&&v2.length) s += Math.round((v1.filter(v=>v2.includes(v)).length/Math.max(v1.length,v2.length))*28);
  if (u1.verified&&u2.verified) s += 12;
  s += Math.abs((u1.age||27)-(u2.age||27))<=3?17:8;
  return Math.min(Math.round(s),99);
}

const hue = (u) => ({ u001:24,u002:195,u003:260,u004:152,u005:330,u006:45,u007:10,u008:210 }[u?.id] || parseInt(u?.id?.slice(-3)||"180")%360);
const planColor = { free:"rgba(255,255,255,.3)", plus:"#C8A96E", parivar:"#74B9FF" };

/* ─── SCAM WORDS ─── */
const SCAM = ["send money","bank account","upi transfer","western union","gift card","customs duty","bitcoin","crypto","emergency funds","wire transfer","visa fee","paytm send"];

/* ─── GLOBAL CSS ─── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600&family=DM+Sans:wght@300;400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  body{background:#07060D;font-family:'DM Sans',sans-serif;color:#fff;overflow-x:hidden}
  input,select,textarea{color:#fff !important;font-family:'DM Sans',sans-serif}
  input::placeholder,textarea::placeholder{color:rgba(255,255,255,.25)!important}
  select option{background:#1A1626;color:#fff}
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pop{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
  .shimmer{background:linear-gradient(90deg,#C8A96E,#F0D080,#C8A96E);background-size:300% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4s linear infinite}
  .fade-up{animation:fadeUp .4s cubic-bezier(.16,1,.3,1) both}
  .spin{animation:spin 1s linear infinite}
`;

/* ═══════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════ */
export default function App() {
  // inject CSS
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  const [screen, setScreen] = useState("auth"); // auth | app
  const [user, setUser]     = useState(null);
  const [page, setPage]     = useState("home");
  const [modal, setModal]   = useState(null);
  const [loading, setLoading] = useState(false);

  // Auth state
  const [authTab, setAuthTab] = useState("login");
  const [loginEmail, setLoginEmail] = useState("priya@example.com");
  const [loginPass,  setLoginPass]  = useState("demo123");
  const [reg, setReg] = useState({ name:"", email:"", password:"", phone:"", gender:"Female", religion:"Hindu", city:"" });

  // App state
  const [matches,   setMatches]   = useState([]);
  const [received,  setReceived]  = useState([]);
  const [sent,      setSent]      = useState([]);
  const [convos,    setConvos]    = useState([]);
  const [messages,  setMessages]  = useState([]);
  const [chatWith,  setChatWith]  = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [scamWarn,  setScamWarn]  = useState(false);
  const [filter,    setFilter]    = useState("All");
  const [intTab,    setIntTab]    = useState("received");
  const [toast,     setToast]     = useState({ show:false, msg:"", ok:true });
  const [vStep,     setVStep]     = useState(0);
  const [scamText,  setScamText]  = useState("");
  const [scamResult,setScamResult]= useState(null);
  const [swipeIdx,  setSwipeIdx]  = useState(0);
  const chatRef = useRef(null);

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages, chatWith]);

  /* ── Check saved token on load ── */
  useEffect(() => {
    const token = localStorage.getItem("bandhan_token");
    if (token) {
      api.me().then(r => {
        if (r.ok) { setUser(r.data.user); setScreen("app"); loadAppData(r.data.user); }
        else localStorage.removeItem("bandhan_token");
      });
    }
  }, []);

  const showToast = (msg, ok=true) => {
    setToast({ show:true, msg, ok });
    setTimeout(() => setToast(p=>({...p,show:false})), 2800);
  };

  /* ── Load app data ── */
  const loadAppData = async (u) => {
    const [mRes, rRes, sRes] = await Promise.all([api.getMatches(), api.getReceivedInterests(), api.getSentInterests()]);
    if (mRes.ok) setMatches(mRes.data.matches || []);
    if (rRes.ok) setReceived(rRes.data.interests || []);
    if (sRes.ok) setSent(sRes.data.interests || []);
  };

  /* ── AUTH ── */
  const doLogin = async () => {
    setLoading(true);
    const r = await api.login({ email:loginEmail, password:loginPass });
    setLoading(false);
    if (!r.ok) { showToast(r.data.error || "Login failed", false); return; }
    localStorage.setItem("bandhan_token", r.data.token);
    setUser(r.data.user);
    setScreen("app");
    loadAppData(r.data.user);
    showToast(`Welcome back, ${r.data.user.name.split(" ")[0]}! 💍`);
  };

  const doRegister = async () => {
    if (!reg.name||!reg.email||!reg.password||!reg.phone) { showToast("Fill all required fields", false); return; }
    if (reg.password.length < 8) { showToast("Password must be 8+ characters", false); return; }
    setLoading(true);
    const r = await api.register({ ...reg, dob:"1997-01-01" });
    setLoading(false);
    if (!r.ok) { showToast(r.data.error || "Registration failed", false); return; }
    localStorage.setItem("bandhan_token", r.data.token);
    setUser(r.data.user);
    setScreen("app");
    showToast(`Welcome to Bandhan, ${r.data.user.name.split(" ")[0]}! 💍`);
  };

  const doLogout = async () => {
    await api.logout();
    localStorage.removeItem("bandhan_token");
    setUser(null); setScreen("auth"); setPage("home");
    setMatches([]); setReceived([]); setSent([]);
    showToast("See you soon! 👋");
  };

  /* ── INTERESTS ── */
  const sendInterest = async (toId, toName) => {
    if (sent.find(i=>i.to_user===toId)) { showToast("Already sent to "+toName.split(" ")[0]); return; }
    const r = await api.sendInterest({ to_user_id:toId, message:"Hi! I am interested in connecting." });
    if (!r.ok) { showToast(r.data.error||"Failed", false); return; }
    setSent(p=>[...p, r.data.interest]);
    showToast(`💌 Interest sent to ${toName.split(" ")[0]}!`);
  };

  const respondInterest = async (id, status) => {
    const r = await api.respondInterest(id, status);
    if (!r.ok) return;
    setReceived(p=>p.map(i=>i.id===id?{...i,status}:i));
    showToast(status==="accepted"?"🎉 Accepted!":"Declined.");
  };

  /* ── MESSAGES ── */
  const openChat = async (partner) => {
    if (user?.subscription?.plan==="free" || user?.plan==="free") { showToast("🔒 Upgrade to Plus to message", false); return; }
    setChatWith(partner);
    const r = await api.getMessages(partner.id);
    if (r.ok) setMessages(r.data.messages||[]);
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const lo = chatInput.toLowerCase();
    if (SCAM.some(k=>lo.includes(k))) { setScamWarn(true); setChatInput(""); showToast("🚨 Scam message blocked", false); return; }
    setScamWarn(false);
    const r = await api.sendMessage({ to_user_id:chatWith.id, text:chatInput.trim() });
    setChatInput("");
    if (r.ok && r.data.sent) {
      setMessages(p=>[...p, r.data.message]);
      // Simulate reply
      setTimeout(async () => {
        const replies=["That's lovely! 😊","Tell me more!","I agree completely!","Sounds wonderful!","I'd love to know more!"];
        const fakeReply = { id:"fr_"+Date.now(), from_user:chatWith.id, to_user:user.id, text:replies[Math.floor(Math.random()*replies.length)], created_at:new Date().toISOString() };
        setMessages(p=>[...p, fakeReply]);
      }, 1500);
    } else if (!r.data?.sent) {
      showToast(r.data?.message || "Message blocked by Safety Shield", false);
    }
  };

  /* ── VERIFY ── */
  const doVerify = async () => {
    const steps = ["phone_otp","email_otp","aadhaar","selfie","live_photo"];
    const step = steps[vStep];
    const r = await api.verify(step);
    if (!r.ok) { showToast(r.data.error||"Failed", false); return; }
    const nv = vStep+1;
    setVStep(nv);
    if (nv>=5) { setUser(p=>({...p,verified:true,trust_score:100})); showToast("🎉 Fully Verified! Trust: 100"); }
    else { setUser(p=>({...p,trust_score:r.data.trust_score})); showToast(r.data.message); }
  };

  /* ── UPGRADE ── */
  const upgradePlan = async (plan) => {
    const r = await api.upgradePlan(plan);
    if (!r.ok) { showToast(r.data.error||"Failed", false); return; }
    setUser(p=>({...p,plan,subscription:{...p.subscription,plan}}));
    setModal(null);
    showToast({plus:"⭐ Upgraded to Plus!",parivar:"👨‍👩‍👧 Upgraded to Parivar!"}[plan]||"Upgraded!");
  };

  const swipe = async (dir) => {
    if (dir==="right" && matches[swipeIdx]) await sendInterest(matches[swipeIdx].id, matches[swipeIdx].name);
    setSwipeIdx(p=>Math.min(p+1, matches.length-1));
  };

  const userPlan = user?.subscription?.plan || user?.plan || "free";
  const h = (u) => hue(u);

  /* ─────────────────────────────────────
     AUTH SCREEN
  ───────────────────────────────────── */
  if (screen === "auth") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0D0A18,#1A0A02,#0D1020)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20, position:"relative", overflow:"hidden" }}>
      {/* BG orbs */}
      {[["#D4601A","-80px","-60px","350px"],["#7B2FBE","auto","-50px","280px","0"],["#1A6B8B","0","auto","240px"]].map(([c,t,r,s,l],i)=>(
        <div key={i} style={{ position:"absolute", width:s, height:s, borderRadius:"50%", background:c, filter:"blur(90px)", opacity:.15, top:t, right:r, left:l, pointerEvents:"none" }} />
      ))}
      <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)", backgroundSize:"44px 44px", pointerEvents:"none" }} />

      <div style={{ position:"relative", zIndex:2, width:"100%", maxWidth:380 }} className="fade-up">
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:56, fontWeight:900, letterSpacing:-2, color:"#fff", lineHeight:1 }}>
            Band<span className="shimmer" style={{ fontStyle:"italic" }}>han</span>
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,.35)", marginTop:6, letterSpacing:3 }}>बंधन • हर दिल का रिश्ता</div>
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:12, flexWrap:"wrap" }}>
            {["✓ Verified","🛡️ Safe","💍 Trusted","📞 No Calls"].map(b=>(
              <span key={b} style={{ padding:"3px 10px", borderRadius:100, background:"rgba(200,169,110,.08)", border:"1px solid rgba(200,169,110,.2)", color:"rgba(200,169,110,.7)", fontSize:10, fontWeight:600 }}>{b}</span>
            ))}
          </div>
        </div>

        {/* Card */}
        <div style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.09)", borderRadius:24, padding:24, backdropFilter:"blur(24px)", boxShadow:"0 32px 80px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.08)" }}>
          {/* Tabs */}
          <div style={{ display:"flex", background:"rgba(0,0,0,.3)", borderRadius:13, padding:3, marginBottom:20, gap:3 }}>
            {["login","register"].map(t=>(
              <button key={t} onClick={()=>setAuthTab(t)} style={{ flex:1, padding:"9px 0", borderRadius:10, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit", background:authTab===t?"linear-gradient(135deg,#C8A96E,#A8882E)":"transparent", color:authTab===t?"#1A1208":"rgba(255,255,255,.4)", boxShadow:authTab===t?"0 4px 14px rgba(200,169,110,.3)":"none", transition:"all .2s" }}>
                {t==="login"?"Sign In":"Register"}
              </button>
            ))}
          </div>

          {authTab==="login" ? (<>
            {[["Email","email","email",loginEmail,setLoginEmail],["Password","password","password",loginPass,setLoginPass]].map(([l,t,p,v,sv])=>(
              <div key={l} style={{ marginBottom:13 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(200,169,110,.6)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:5 }}>{l}</div>
                <input type={t} value={v} onChange={e=>sv(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder={p==="email"?"your@email.com":"••••••••"} style={{ width:"100%", padding:"11px 14px", borderRadius:11, border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.05)", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color .2s" }} onFocus={e=>e.target.style.borderColor="rgba(200,169,110,.4)"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.1)"} />
              </div>
            ))}
            <button onClick={doLogin} disabled={loading} style={{ width:"100%", padding:14, borderRadius:12, border:"none", cursor:"pointer", background:"linear-gradient(135deg,#C8A96E,#A8882E)", color:"#1A1208", fontSize:15, fontWeight:800, fontFamily:"inherit", boxShadow:"0 8px 24px rgba(200,169,110,.35),inset 0 1px 0 rgba(255,255,255,.25)", marginBottom:16 }}>
              {loading ? "..." : "Sign In 💍"}
            </button>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.25)", textAlign:"center", marginBottom:10 }}>Quick demo accounts:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
              {[["priya@example.com","👩‍💻 Priya","Plus"],["arjun@example.com","👨‍💼 Arjun","Plus"],["meera@example.com","👩‍🎓 Meera","Free"],["rahul@example.com","👨‍⚕️ Rahul","Parivar"]].map(([e,n,p])=>(
                <button key={e} onClick={()=>{setLoginEmail(e);setLoginPass("demo123");setTimeout(doLogin,100);}} style={{ padding:"8px 6px", borderRadius:11, border:"1px solid rgba(255,255,255,.09)", background:"rgba(255,255,255,.03)", color:"rgba(255,255,255,.65)", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit", lineHeight:1.5 }}>
                  {n}<br/><span style={{ fontSize:9, color:"rgba(200,169,110,.5)" }}>{p}</span>
                </button>
              ))}
            </div>
          </>) : (<>
            {[["Name","name","text"],["Email","email","email"],["Password (8+)","password","password"],["Phone","phone","tel"],["City","city","text"]].map(([l,k,t])=>(
              <div key={k} style={{ marginBottom:11 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(200,169,110,.6)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>{l}</div>
                <input type={t} value={reg[k]} onChange={e=>setReg(p=>({...p,[k]:e.target.value}))} placeholder={l} style={{ width:"100%", padding:"10px 13px", borderRadius:10, border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.05)", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>
            ))}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
              {[["gender","Gender",["Male","Female","Other"]],["religion","Religion",["Hindu","Muslim","Christian","Sikh","Jain"]]].map(([k,l,opts])=>(
                <div key={k}>
                  <div style={{ fontSize:10, fontWeight:700, color:"rgba(200,169,110,.6)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>{l}</div>
                  <select value={reg[k]} onChange={e=>setReg(p=>({...p,[k]:e.target.value}))} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid rgba(255,255,255,.1)", background:"#1A1626", fontSize:13, outline:"none" }}>
                    {opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button onClick={doRegister} disabled={loading} style={{ width:"100%", padding:14, borderRadius:12, border:"none", cursor:"pointer", background:"linear-gradient(135deg,#C8A96E,#A8882E)", color:"#1A1208", fontSize:15, fontWeight:800, fontFamily:"inherit", boxShadow:"0 8px 24px rgba(200,169,110,.35)" }}>
              {loading ? "..." : "Create Account ✨"}
            </button>
          </>)}
        </div>
      </div>

      {/* Toast */}
      <Toast toast={toast} />
    </div>
  );

  /* ─────────────────────────────────────
     MAIN APP
  ───────────────────────────────────── */
  const curMatch = matches[swipeIdx];

  return (
    <div style={{ background:"#07060D", minHeight:"100vh", maxWidth:430, margin:"0 auto", color:"#fff", fontFamily:"'DM Sans',sans-serif", position:"relative" }}>

      {/* ── TOP NAV ── */}
      <div style={{ background:"rgba(10,8,16,.93)", backdropFilter:"blur(24px)", borderBottom:"1px solid rgba(255,255,255,.06)", padding:"0 16px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 12px rgba(0,0,0,.3)" }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:900, letterSpacing:-1 }}>
          Band<span className="shimmer" style={{ fontStyle:"italic" }}>han</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{user?.name?.split(" ")[0]}</div>
            <div style={{ fontSize:9, padding:"1px 7px", borderRadius:100, background: userPlan==="plus"?"rgba(200,169,110,.2)":userPlan==="parivar"?"rgba(116,185,255,.15)":"rgba(255,255,255,.08)", color: planColor[userPlan]||"#888", fontWeight:800, display:"inline-block", marginTop:1 }}>
              {userPlan.toUpperCase()}
            </div>
          </div>
          <div style={{ width:36, height:36, borderRadius:11, background:`linear-gradient(135deg,hsl(${h(user)},70%,45%),hsl(${h(user)},60%,30%))`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, boxShadow:`0 4px 12px hsla(${h(user)},70%,45%,.4)` }}>
            {user?.gender==="Female"?"👩":"👨"}
          </div>
          <button onClick={doLogout} style={{ padding:"5px 11px", borderRadius:8, border:"1px solid rgba(255,255,255,.08)", background:"rgba(255,255,255,.03)", color:"rgba(255,255,255,.4)", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Exit</button>
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{ paddingBottom:72 }}>

        {/* ═══ HOME ═══ */}
        {page==="home" && (
          <div>
            {/* Hero */}
            <div style={{ background:`linear-gradient(160deg,hsla(${h(user)},40%,12%,.7),transparent)`, padding:"20px 18px 24px", borderBottom:"1px solid rgba(255,255,255,.05)" }}>
              <div style={{ fontSize:12, color:"rgba(255,255,255,.35)", marginBottom:2 }}>Namaste 🙏</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, marginBottom:10 }}>
                {user?.name?.split(" ")[0]}, <span className="shimmer" style={{ fontStyle:"italic" }}>your match awaits</span>
              </div>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                <span style={{ padding:"3px 10px", borderRadius:100, background:"rgba(85,239,196,.12)", border:"1px solid rgba(85,239,196,.25)", color:"#55EFC4", fontSize:10, fontWeight:700 }}>{user?.verified?"✓ Verified":"⚠ Unverified"}</span>
                <span style={{ padding:"3px 10px", borderRadius:100, background:`hsla(${h(user)},50%,50%,.12)`, border:`1px solid hsla(${h(user)},50%,50%,.2)`, color:`hsl(${h(user)},65%,65%)`, fontSize:10, fontWeight:700 }}>Trust {user?.trust_score||30}</span>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:1, background:"rgba(255,255,255,.04)", margin:"14px 16px", borderRadius:16, overflow:"hidden", border:"1px solid rgba(255,255,255,.06)" }}>
              {[[matches.length,"Matches","💕"],[received.filter(i=>i.status==="pending").length,"Interests","💌"],[user?.trust_score||30,"Trust","🛡️"]].map(([n,l,ic])=>(
                <div key={l} style={{ background:"#0F0F1A", padding:"13px 8px", textAlign:"center" }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#C8A96E" }}>{n}</div>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,.3)", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginTop:2 }}>{ic} {l}</div>
                </div>
              ))}
            </div>

            {/* Swipe Card */}
            <div style={{ padding:"0 16px 8px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700 }}>Top Match Today</div>
                <div onClick={()=>setPage("browse")} style={{ fontSize:12, color:"#C8A96E", fontWeight:700, cursor:"pointer" }}>See all →</div>
              </div>
              {curMatch ? (
                <div>
                  <div onClick={()=>setModal(curMatch)} style={{ background:`linear-gradient(160deg,hsla(${h(curMatch)},40%,12%,.8),rgba(13,11,18,.9))`, border:`1px solid hsla(${h(curMatch)},40%,40%,.15)`, borderRadius:24, overflow:"hidden", cursor:"pointer", boxShadow:`0 16px 48px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06)` }}>
                    <div style={{ height:200, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at 50% 40%,hsla(${h(curMatch)},60%,40%,.25),transparent 65%)` }} />
                      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"50%", background:`linear-gradient(to top,hsla(${h(curMatch)},40%,8%,.9),transparent)` }} />
                      <span style={{ fontSize:88, position:"relative", zIndex:1, filter:`drop-shadow(0 10px 24px hsla(${h(curMatch)},70%,50%,.5))` }}>{curMatch.gender==="Female"?"👩‍💻":"👨‍💼"}</span>
                      <div style={{ position:"absolute", top:12, right:12, background:"rgba(0,0,0,.55)", backdropFilter:"blur(10px)", borderRadius:100, padding:"4px 10px", fontSize:11, fontWeight:800, color:`hsl(${h(curMatch)},65%,65%)` }}>{curMatch.compatibility||calcCompat(user,curMatch)}% match</div>
                      {curMatch.verified && <div style={{ position:"absolute", top:12, left:12, background:"rgba(85,239,196,.2)", border:"1px solid rgba(85,239,196,.4)", borderRadius:100, padding:"3px 9px", fontSize:9, fontWeight:800, color:"#55EFC4" }}>✓ VERIFIED</div>}
                    </div>
                    <div style={{ padding:"14px 16px 16px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <div>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, fontWeight:700 }}>{curMatch.name.split(" ")[0]}, {curMatch.age||27}</div>
                          <div style={{ color:"rgba(255,255,255,.4)", fontSize:12, marginTop:2 }}>{curMatch.profession} · {curMatch.city}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,.25)" }}>Trust</div>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, color:`hsl(${h(curMatch)},65%,65%)` }}>{curMatch.trust_score||90}</div>
                        </div>
                      </div>
                      <div style={{ height:4, background:"rgba(255,255,255,.06)", borderRadius:2, overflow:"hidden", marginBottom:10 }}>
                        <div style={{ height:"100%", width:`${curMatch.compatibility||calcCompat(user,curMatch)}%`, background:`linear-gradient(90deg,hsl(${h(curMatch)},65%,50%),hsl(${h(curMatch)},65%,70%))`, borderRadius:2 }} />
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {(curMatch.values||[]).slice(0,3).map(v=>(
                          <span key={v} style={{ padding:"4px 10px", borderRadius:100, background:`hsla(${h(curMatch)},50%,40%,.12)`, border:`1px solid hsla(${h(curMatch)},50%,40%,.2)`, color:`hsl(${h(curMatch)},65%,65%)`, fontSize:11 }}>{v}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"center", gap:14, marginTop:14 }}>
                    <button onClick={()=>swipe("left")} style={{ width:50, height:50, borderRadius:"50%", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.1)", fontSize:20, cursor:"pointer" }}>✕</button>
                    <button onClick={()=>setModal(curMatch)} style={{ padding:"0 20px", height:50, borderRadius:100, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.1)", fontSize:12, fontWeight:700, color:"rgba(255,255,255,.5)", cursor:"pointer", fontFamily:"inherit" }}>View</button>
                    <button onClick={()=>swipe("right")} style={{ width:50, height:50, borderRadius:"50%", background:`linear-gradient(135deg,hsl(${h(curMatch)},70%,50%),hsl(${h(curMatch)},65%,35%))`, border:"none", fontSize:20, cursor:"pointer", boxShadow:`0 6px 20px hsla(${h(curMatch)},70%,45%,.5)` }}>💌</button>
                  </div>
                </div>
              ) : (
                <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:20, padding:"36px 20px", textAlign:"center" }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>🎉</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700 }}>You've seen everyone!</div>
                  <div style={{ color:"rgba(255,255,255,.35)", fontSize:13, marginTop:4 }}>Check back tomorrow for new profiles</div>
                </div>
              )}
            </div>

            {/* Interests preview */}
            <div style={{ padding:"14px 16px 0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700 }}>New Interests 💌</div>
                <div onClick={()=>setPage("interests")} style={{ fontSize:12, color:"#C8A96E", fontWeight:700, cursor:"pointer" }}>View all →</div>
              </div>
              {received.filter(i=>i.status==="pending").slice(0,2).map(i => (
                <InterestRow key={i.id} interest={i} person={i.sender||{}} isReceived onAccept={()=>respondInterest(i.id,"accepted")} onReject={()=>respondInterest(i.id,"rejected")} />
              ))}
              {received.filter(i=>i.status==="pending").length===0 && (
                <div style={{ textAlign:"center", padding:"16px 0", color:"rgba(255,255,255,.25)", fontSize:13 }}>No pending interests — browse and find yours!</div>
              )}
            </div>
          </div>
        )}

        {/* ═══ BROWSE ═══ */}
        {page==="browse" && (
          <div>
            <div style={{ padding:"16px 16px 8px" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700 }}>Browse Profiles</div>
              <div style={{ color:"rgba(255,255,255,.35)", fontSize:13, marginTop:2 }}>{matches.length} verified matches</div>
            </div>
            <div style={{ display:"flex", gap:7, padding:"0 14px 12px", overflowX:"auto", scrollbarWidth:"none" }}>
              {["All","Hindu","Muslim","Christian","NRI","2nd Marriage"].map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ flexShrink:0, padding:"6px 14px", borderRadius:100, border: filter===f?"none":"1px solid rgba(255,255,255,.09)", background: filter===f?"linear-gradient(135deg,#C8A96E,#A8882E)":"rgba(255,255,255,.03)", color: filter===f?"#1A1208":"rgba(255,255,255,.5)", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", boxShadow: filter===f?"0 4px 12px rgba(200,169,110,.3)":"none" }}>{f}</button>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, padding:"0 14px" }}>
              {matches.filter(m => filter==="All"?true:filter==="NRI"?m.state==="NRI":filter==="2nd Marriage"?m.marital_status!=="Never Married":m.religion===filter).map((m,i)=>(
                <div key={m.id} onClick={()=>setModal(m)} style={{ background:`linear-gradient(145deg,hsla(${h(m)},30%,12%,.7),rgba(13,11,18,.8))`, border:`1px solid hsla(${h(m)},40%,40%,.12)`, borderRadius:18, overflow:"hidden", cursor:"pointer" }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 14px 36px rgba(0,0,0,.4)`;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                  <div style={{ height:86, display:"flex", alignItems:"center", justifyContent:"center", fontSize:38, position:"relative", background:`radial-gradient(circle,hsla(${h(m)},60%,40%,.2),transparent 70%)` }}>
                    <span style={{ filter:`drop-shadow(0 6px 14px hsla(${h(m)},70%,50%,.4))` }}>{m.gender==="Female"?"👩":"👨"}</span>
                    {m.verified&&<div style={{ position:"absolute", bottom:5, right:5, width:16, height:16, background:"#2A7A4F", borderRadius:"50%", border:"2px solid #0D0B12", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#fff" }}>✓</div>}
                    <div style={{ position:"absolute", top:6, left:6, background:"rgba(0,0,0,.6)", backdropFilter:"blur(8px)", borderRadius:100, padding:"2px 7px", fontSize:9, fontWeight:800, color:`hsl(${h(m)},65%,65%)` }}>{m.compatibility||calcCompat(user,m)}%</div>
                  </div>
                  <div style={{ padding:"9px 11px 12px" }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{m.name.split(" ")[0]}, {m.age||27}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,.35)", marginTop:2, lineHeight:1.4 }}>{m.profession}<br/>{m.city}</div>
                    <div style={{ height:3, background:"rgba(255,255,255,.06)", borderRadius:2, overflow:"hidden", marginTop:8 }}>
                      <div style={{ height:"100%", width:`${m.compatibility||calcCompat(user,m)}%`, background:`linear-gradient(90deg,hsl(${h(m)},65%,50%),hsl(${h(m)},65%,70%))`, borderRadius:2 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ INTERESTS ═══ */}
        {page==="interests" && (
          <div>
            <div style={{ padding:"16px 16px 0" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, marginBottom:14 }}>Interests</div>
              <div style={{ display:"flex", background:"rgba(0,0,0,.3)", borderRadius:13, padding:3, marginBottom:16 }}>
                {[["received","Received 📥"],["sent","Sent 📤"]].map(([t,l])=>(
                  <button key={t} onClick={()=>setIntTab(t)} style={{ flex:1, padding:"9px 0", borderRadius:10, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, fontFamily:"inherit", background:intTab===t?"linear-gradient(135deg,#C8A96E,#A8882E)":"transparent", color:intTab===t?"#1A1208":"rgba(255,255,255,.4)", transition:"all .2s" }}>
                    {l} ({intTab==="received"?received.length:sent.length})
                  </button>
                ))}
              </div>
            </div>
            {(intTab==="received"?received:sent).length===0 ? (
              <div style={{ textAlign:"center", padding:"56px 20px" }}>
                <div style={{ fontSize:48 }}>{intTab==="received"?"💌":"📤"}</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, marginTop:10 }}>No interests {intTab==="received"?"received":"sent"} yet</div>
                <div style={{ color:"rgba(255,255,255,.3)", fontSize:13, marginTop:4 }}>Browse profiles to get started!</div>
              </div>
            ) : (intTab==="received"?received:sent).map(i=>{
              const p = intTab==="received" ? i.sender : i.receiver;
              if (!p) return null;
              return <InterestRow key={i.id} interest={i} person={p} isReceived={intTab==="received"} onAccept={()=>respondInterest(i.id,"accepted")} onReject={()=>respondInterest(i.id,"rejected")} />;
            })}
          </div>
        )}

        {/* ═══ MESSAGES ═══ */}
        {page==="messages" && (
          <div>
            {chatWith ? (
              <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 130px)" }}>
                <div style={{ background:"rgba(10,8,16,.95)", backdropFilter:"blur(20px)", padding:"11px 14px", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", alignItems:"center", gap:10, position:"sticky", top:58 }}>
                  <button onClick={()=>{setChatWith(null);setScamWarn(false);}} style={{ background:"none", border:"none", color:"rgba(255,255,255,.4)", fontSize:20, cursor:"pointer" }}>←</button>
                  <div style={{ width:38, height:38, borderRadius:10, background:`linear-gradient(135deg,hsl(${h(chatWith)},70%,45%),hsl(${h(chatWith)},60%,30%))`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{chatWith.gender==="Female"?"👩":"👨"}</div>
                  <div><div style={{ fontWeight:700, fontSize:14 }}>{chatWith.name}</div><div style={{ fontSize:11, color:"#55EFC4" }}>● Online</div></div>
                  <div style={{ marginLeft:"auto", fontSize:10, color:"rgba(200,169,110,.4)" }}>🔒 Safe</div>
                </div>
                <div ref={chatRef} style={{ flex:1, overflowY:"auto", padding:"13px 14px", display:"flex", flexDirection:"column", gap:8, background:"#0A0812" }}>
                  {messages.length===0 && <div style={{ textAlign:"center", color:"rgba(255,255,255,.25)", fontSize:13, marginTop:40 }}>Start the conversation! Say hello 👋</div>}
                  {messages.map(m=>(
                    <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems:m.from_user===user?.id?"flex-end":"flex-start" }}>
                      <div style={{ maxWidth:"76%", padding:"10px 13px", borderRadius:16, fontSize:13, lineHeight:1.5, background:m.from_user===user?.id?"linear-gradient(135deg,#C8A96E,#A8882E)":"rgba(255,255,255,.06)", border:m.from_user===user?.id?"none":"1px solid rgba(255,255,255,.08)", color:m.from_user===user?.id?"#1A1208":"rgba(255,255,255,.88)", borderBottomRightRadius:m.from_user===user?.id?4:16, borderBottomLeftRadius:m.from_user===user?.id?16:4 }}>
                        {m.text}
                      </div>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,.2)", marginTop:3 }}>{new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                  ))}
                </div>
                {scamWarn && <div style={{ margin:"0 13px 8px", padding:"10px 13px", background:"rgba(212,96,26,.08)", border:"1px solid rgba(212,96,26,.25)", borderRadius:11, fontSize:12, color:"#FF8C4B" }}>🚨 <strong>Safety Shield:</strong> Message blocked — financial keywords detected. Never send money on Bandhan.</div>}
                <div style={{ padding:"9px 13px", background:"rgba(10,8,16,.95)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(255,255,255,.06)", display:"flex", gap:8 }}>
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Type a message..." style={{ flex:1, padding:"10px 14px", borderRadius:100, border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.05)", fontSize:13, outline:"none" }} />
                  <button onClick={sendMessage} style={{ width:42, height:42, borderRadius:"50%", background:"linear-gradient(135deg,#C8A96E,#A8882E)", border:"none", cursor:"pointer", fontSize:16, color:"#1A1208", boxShadow:"0 4px 14px rgba(200,169,110,.4)" }}>➤</button>
                </div>
              </div>
            ) : userPlan==="free" ? (
              <div style={{ textAlign:"center", padding:"60px 24px" }}>
                <div style={{ fontSize:52, marginBottom:12 }}>🔒</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700 }}>Messaging Locked</div>
                <div style={{ color:"rgba(255,255,255,.4)", fontSize:14, marginTop:6, marginBottom:24, lineHeight:1.7 }}>Upgrade to Bandhan Plus to chat with all your matches</div>
                <button onClick={()=>setModal("upgrade")} style={{ padding:"12px 28px", background:"linear-gradient(135deg,#C8A96E,#A8882E)", border:"none", borderRadius:100, color:"#1A1208", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 8px 24px rgba(200,169,110,.4)" }}>Upgrade Now ↗</button>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, padding:"16px 16px 12px" }}>Messages</div>
                {received.filter(i=>i.status==="accepted").length===0 ? (
                  <div style={{ textAlign:"center", padding:"56px 24px" }}>
                    <div style={{ fontSize:48, marginBottom:12 }}>💬</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700 }}>No conversations yet</div>
                    <div style={{ color:"rgba(255,255,255,.35)", fontSize:13, marginTop:4 }}>Accept interests to start chatting!</div>
                  </div>
                ) : received.filter(i=>i.status==="accepted").map(i=>{
                  const p = i.sender;
                  if (!p) return null;
                  return (
                    <div key={i.id} onClick={()=>openChat(p)} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,.04)", cursor:"pointer" }}>
                      <div style={{ width:48, height:48, borderRadius:13, background:`linear-gradient(135deg,hsl(${h(p)},70%,45%),hsl(${h(p)},60%,30%))`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{p.gender==="Female"?"👩":"👨"}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14 }}>{p.name}</div>
                        <div style={{ fontSize:12, color:"rgba(255,255,255,.35)", marginTop:2 }}>{p.profession} · {p.city}</div>
                      </div>
                      <div style={{ fontSize:18, color:"rgba(255,255,255,.2)" }}>›</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ PROFILE ═══ */}
        {page==="profile" && (
          <div>
            <div style={{ background:`linear-gradient(160deg,hsla(${h(user)},40%,12%,.5),transparent)`, padding:"22px 18px 20px", borderBottom:"1px solid rgba(255,255,255,.05)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:80, height:80, borderRadius:22, background:`linear-gradient(145deg,hsl(${h(user)},70%,45%),hsl(${h(user)},60%,28%))`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, boxShadow:`0 10px 30px hsla(${h(user)},70%,45%,.4),inset 0 2px 0 rgba(255,255,255,.2)` }}>
                  {user?.gender==="Female"?"👩":"👨"}
                </div>
                <div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700 }}>{user?.name}</div>
                  <div style={{ color:"rgba(255,255,255,.4)", fontSize:13, marginTop:3 }}>{user?.profession||"—"} · {user?.city||"—"}</div>
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <span style={{ padding:"3px 10px", borderRadius:100, background:"rgba(85,239,196,.1)", border:"1px solid rgba(85,239,196,.25)", color:"#55EFC4", fontSize:10, fontWeight:700 }}>{user?.verified?"✓ Verified":"Not Verified"}</span>
                    <span style={{ padding:"3px 10px", borderRadius:100, background:`hsla(${h(user)},50%,50%,.1)`, border:`1px solid hsla(${h(user)},50%,50%,.2)`, color:`hsl(${h(user)},65%,65%)`, fontSize:10, fontWeight:700 }}>Trust {user?.trust_score||30}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <GlassSection title="Personal Details" style={{ margin:"14px 16px 0" }}>
              {[["Age",(user?.age||"—")+" yrs"],["City",user?.city||"—"],["Religion",user?.religion||"—"],["Education",user?.education_level||"—"],["Profession",user?.profession||"—"],["Income",user?.income_range||"—"],["Status",user?.marital_status||"Never Married"],["Language",user?.mother_tongue||"—"]].map(([l,v])=>(
                <div key={l} style={{ display:"flex", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,.04)", alignItems:"center" }}>
                  <span style={{ width:110, fontSize:12, color:"rgba(255,255,255,.3)", flexShrink:0 }}>{l}</span>
                  <span style={{ fontSize:13, fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </GlassSection>

            {/* Plan */}
            <GlassSection title="Current Plan" style={{ margin:"12px 16px 0" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 0" }}>
                <span style={{ padding:"5px 13px", borderRadius:100, background: userPlan==="plus"?"rgba(200,169,110,.15)":userPlan==="parivar"?"rgba(116,185,255,.1)":"rgba(255,255,255,.07)", color:planColor[userPlan]||"rgba(255,255,255,.4)", fontSize:13, fontWeight:800, border:`1px solid ${userPlan==="plus"?"rgba(200,169,110,.25)":userPlan==="parivar"?"rgba(116,185,255,.2)":"rgba(255,255,255,.1)"}` }}>
                  {{"free":"🆓 Free","plus":"⭐ Bandhan Plus","parivar":"👨‍👩‍👧 Parivar"}[userPlan]||userPlan}
                </span>
                <button onClick={()=>setModal("upgrade")} style={{ padding:"8px 18px", background:"linear-gradient(135deg,#C8A96E,#A8882E)", color:"#1A1208", border:"none", borderRadius:10, fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 14px rgba(200,169,110,.3)" }}>Upgrade ↗</button>
              </div>
            </GlassSection>

            {/* Verification */}
            <GlassSection title={`Verification (${vStep+1}/5 steps)`} style={{ margin:"12px 16px 14px" }}>
              {[["Phone OTP","📱",true],["Email OTP","📧",vStep>=1],["Aadhaar Scan","🪪",vStep>=2],["Live Selfie","🤳",vStep>=3],["Live Photo","📸",vStep>=4]].map(([t,ic,done],i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 11px", borderRadius:11, background:done?"rgba(85,239,196,.07)":"rgba(255,255,255,.02)", border:done?"1px solid rgba(85,239,196,.2)":"1px solid rgba(255,255,255,.05)", marginBottom:7 }}>
                  <div style={{ width:30, height:30, borderRadius:"50%", background:done?"rgba(85,239,196,.2)":"rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:done?14:16, color:done?"#55EFC4":"rgba(255,255,255,.25)", boxShadow:done?"0 3px 10px rgba(85,239,196,.25)":"none" }}>{done?"✓":ic}</div>
                  <div><div style={{ fontWeight:700, fontSize:13, color:done?"#55EFC4":"rgba(255,255,255,.65)" }}>{t}</div><div style={{ fontSize:10, color:"rgba(255,255,255,.25)", marginTop:1 }}>{done?"Verified":"Pending"}</div></div>
                </div>
              ))}
              {vStep<5 && <button onClick={doVerify} style={{ marginTop:6, width:"100%", padding:12, background:"linear-gradient(135deg,#2A7A4F,#1A5C38)", color:"#fff", border:"none", borderRadius:12, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 6px 18px rgba(42,122,79,.3)" }}>Continue Verification →</button>}
            </GlassSection>
          </div>
        )}

        {/* ═══ SAFETY ═══ */}
        {page==="safety" && (
          <div>
            <div style={{ padding:"22px 18px 18px", textAlign:"center", background:"radial-gradient(ellipse at 50% 0%,rgba(42,122,79,.12),transparent 60%)" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, marginBottom:3 }}>Safety Shield 🛡️</div>
              <div style={{ color:"rgba(255,255,255,.35)", fontSize:13 }}>Real-time protection, always on</div>
              <div style={{ width:88, height:88, borderRadius:"50%", background:"linear-gradient(135deg,#2A7A4F,#1A5C38)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", margin:"16px auto 10px", boxShadow:"0 0 0 8px rgba(42,122,79,.1),0 12px 36px rgba(42,122,79,.4)" }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700 }}>{user?.trust_score||30}</div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,.6)", letterSpacing:1 }}>TRUST</div>
              </div>
            </div>
            {[["152","✅","Profile Status",user?.verified?"ID verified. Trust score: "+(user?.trust_score||30)+"/100":"Complete verification to boost trust."],["45","⚠️","Inactive Profiles","Profiles inactive 90+ days are auto-removed from your feed."],["210","🔒","Masked Calls","Your phone number is never directly shared."],["0","🚨","Scam Detector: ON","AI monitors all chats for financial keywords & fraud patterns."]].map(([c,ic,t,d])=>(
              <div key={t} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"13px 16px", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                <div style={{ width:38, height:38, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0, background:`hsla(${c},50%,50%,.1)`, border:`1px solid hsla(${c},50%,50%,.15)` }}>{ic}</div>
                <div><div style={{ fontWeight:700, fontSize:13 }}>{t}</div><div style={{ fontSize:12, color:"rgba(255,255,255,.4)", marginTop:2, lineHeight:1.5 }}>{d}</div></div>
              </div>
            ))}
            <div style={{ padding:"16px" }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"rgba(255,255,255,.3)", marginBottom:10 }}>Check a Message for Scams</div>
              <textarea value={scamText} onChange={e=>setScamText(e.target.value)} placeholder="Paste a suspicious message here..." style={{ width:"100%", padding:"12px 14px", borderRadius:13, border:"1px solid rgba(255,255,255,.09)", background:"rgba(255,255,255,.04)", fontSize:13, resize:"none", height:80, outline:"none", boxSizing:"border-box" }} />
              <button onClick={async()=>{const r=await api.checkMessage(scamText);setScamResult(r.data);}} style={{ marginTop:8, width:"100%", padding:12, background:"linear-gradient(135deg,#0A1A2A,#1A3050)", color:"#74B9FF", border:"1px solid rgba(116,185,255,.15)", borderRadius:12, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>🛡️ Analyze Message</button>
              {scamResult && (
                <div style={{ marginTop:12, padding:14, borderRadius:13, background:scamResult.flagged?"rgba(201,64,64,.06)":"rgba(42,122,79,.07)", border:`1px solid ${scamResult.flagged?"rgba(201,64,64,.25)":"rgba(42,122,79,.25)"}` }}>
                  <div style={{ fontWeight:800, color:scamResult.flagged?"#FF8C8C":"#55EFC4", marginBottom:5 }}>{scamResult.flagged?"🚨 HIGH RISK — Scam Detected":"✅ SAFE — No Suspicious Keywords"}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,.4)", lineHeight:1.5 }}>Never share financial details with anyone on a matrimony platform.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:"rgba(10,8,16,.94)", backdropFilter:"blur(24px)", borderTop:"1px solid rgba(255,255,255,.06)", display:"flex", zIndex:100, boxShadow:"0 -4px 20px rgba(0,0,0,.4)" }}>
        {[["home","🏠","Home"],["browse","🔍","Browse"],["interests","💌","Interests"],["messages","💬","Chat"],["profile","👤","Profile"],["safety","🛡️","Safety"]].map(([id,ic,lb])=>(
          <button key={id} onClick={()=>{setPage(id);setChatWith(null);window.scrollTo(0,0);}} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 2px 8px", border:"none", background:"none", cursor:"pointer", gap:3, position:"relative" }}>
            {id==="interests"&&received.filter(i=>i.status==="pending").length>0&&<div style={{ position:"absolute", top:8, right:"calc(50%-12px)", width:7, height:7, borderRadius:"50%", background:"#C8A96E", boxShadow:"0 0 6px rgba(200,169,110,.8)" }} />}
            <span style={{ fontSize:19, filter:page===id?"none":"grayscale(1) opacity(.35)", transition:"filter .2s", transform:page===id?"scale(1.1)":"scale(1)" }}>{ic}</span>
            <span style={{ fontSize:9, fontWeight:700, color:page===id?"#C8A96E":"rgba(255,255,255,.25)", letterSpacing:.3 }}>{lb}</span>
            {page===id&&<div style={{ position:"absolute", top:0, left:"22%", right:"22%", height:2, background:"linear-gradient(90deg,transparent,#C8A96E,transparent)", borderRadius:1 }} />}
          </button>
        ))}
      </div>

      {/* ── PROFILE DETAIL MODAL ── */}
      {modal && modal!=="upgrade" && (
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:200, display:"flex", alignItems:"flex-end", backdropFilter:"blur(10px)" }}>
          <div style={{ background:"linear-gradient(160deg,#16121F,#0D0B12)", borderRadius:"24px 24px 0 0", width:"100%", maxHeight:"90vh", overflowY:"auto", border:"1px solid rgba(255,255,255,.08)", borderBottom:"none", animation:"slideSheet .35s cubic-bezier(.16,1,.3,1)", boxShadow:"0 -20px 80px rgba(0,0,0,.5)" }}>
            <div style={{ width:36, height:4, background:"rgba(255,255,255,.1)", borderRadius:2, margin:"12px auto 0" }} />
            <div style={{ background:`linear-gradient(160deg,hsla(${h(modal)},50%,15%,.6),transparent)`, padding:"20px 18px 16px", position:"relative" }}>
              <button onClick={()=>setModal(null)} style={{ position:"absolute", top:14, right:14, width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.1)", color:"rgba(255,255,255,.5)", fontSize:15, cursor:"pointer" }}>✕</button>
              <div style={{ fontSize:52, marginBottom:10 }}>{modal.gender==="Female"?"👩":"👨"}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700 }}>{modal.name}</div>
              <div style={{ color:"rgba(255,255,255,.45)", fontSize:13, marginTop:3 }}>{modal.age||27} yrs · {modal.religion} · {modal.city}</div>
              <div style={{ display:"flex", gap:7, marginTop:9, flexWrap:"wrap" }}>
                {modal.verified&&<span style={{ padding:"2px 9px", borderRadius:100, background:"rgba(85,239,196,.15)", border:"1px solid rgba(85,239,196,.3)", color:"#55EFC4", fontSize:10, fontWeight:700 }}>✓ Verified</span>}
                <span style={{ padding:"2px 9px", borderRadius:100, background:`hsla(${h(modal)},50%,50%,.12)`, border:`1px solid hsla(${h(modal)},50%,50%,.2)`, color:`hsl(${h(modal)},65%,65%)`, fontSize:10, fontWeight:700 }}>Trust {modal.trust_score||90}</span>
              </div>
            </div>
            <div style={{ padding:"16px 18px 24px" }}>
              {/* Compat */}
              <div style={{ background:`linear-gradient(145deg,hsla(${h(modal)},50%,15%,.4),hsla(${h(modal)},50%,10%,.2))`, border:`1px solid hsla(${h(modal)},50%,40%,.2)`, borderRadius:16, padding:16, display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
                <div><div style={{ fontFamily:"'Playfair Display',serif", fontSize:44, fontWeight:700, color:`hsl(${h(modal)},65%,60%)`, lineHeight:1 }}>{modal.compatibility||calcCompat(user,modal)}%</div><div style={{ fontSize:11, color:"rgba(255,255,255,.3)", marginTop:2 }}>Compatibility</div></div>
                <div style={{ flex:1 }}>
                  <div style={{ height:5, background:"rgba(255,255,255,.06)", borderRadius:3, overflow:"hidden", marginBottom:7 }}>
                    <div style={{ height:"100%", width:`${modal.compatibility||calcCompat(user,modal)}%`, background:`linear-gradient(90deg,hsl(${h(modal)},65%,55%),hsl(${h(modal)},65%,70%))`, borderRadius:3 }} />
                  </div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,.35)", lineHeight:1.5 }}>{(modal.highlights||[]).join(" · ") || "Based on religion, values, language & lifestyle"}</div>
                </div>
              </div>
              {/* Info grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
                {[["Education",modal.education_level],["Profession",modal.profession],["Income",modal.income_range||"—"],["Height",modal.height_cm?(modal.height_cm+"cm"):"—"],["Language",modal.mother_tongue],["Status",modal.marital_status]].map(([l,v])=>(
                  <div key={l} style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.06)", borderRadius:11, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,.3)", marginBottom:3 }}>{l}</div>
                    <div style={{ fontSize:13, fontWeight:700 }}>{v||"—"}</div>
                  </div>
                ))}
              </div>
              {/* About */}
              <div style={{ background:"rgba(255,255,255,.03)", border:`1px solid hsla(${h(modal)},40%,40%,.15)`, borderLeft:`3px solid hsl(${h(modal)},60%,50%)`, borderRadius:13, padding:"11px 13px", fontSize:13, lineHeight:1.8, color:"rgba(255,255,255,.75)", marginBottom:16, fontStyle:"italic" }}>"{modal.about||"No bio yet."}"</div>
              {/* Values */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:18 }}>
                {(modal.values||[]).map(v=>(
                  <span key={v} style={{ padding:"5px 12px", borderRadius:100, background:`hsla(${h(modal)},50%,40%,.12)`, border:`1px solid hsla(${h(modal)},50%,40%,.2)`, color:`hsl(${h(modal)},65%,65%)`, fontSize:12, fontWeight:600 }}>{v}</span>
                ))}
              </div>
              {/* Actions */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <button onClick={()=>{sendInterest(modal.id,modal.name);setModal(null);}} style={{ padding:14, borderRadius:13, border:"none", cursor:"pointer", background:`linear-gradient(135deg,hsl(${h(modal)},70%,50%),hsl(${h(modal)},65%,35%))`, color:"#fff", fontSize:14, fontWeight:800, fontFamily:"inherit", boxShadow:`0 6px 18px hsla(${h(modal)},70%,45%,.4)` }}>💌 Send Interest</button>
                <button onClick={()=>{if(userPlan==="free"){showToast("🔒 Upgrade to Plus to message",false);return;}openChat(modal);setPage("messages");setModal(null);}} style={{ padding:14, borderRadius:13, border:"1px solid rgba(255,255,255,.1)", cursor:"pointer", background:"rgba(255,255,255,.04)", color:"#fff", fontSize:14, fontWeight:700, fontFamily:"inherit" }}>
                  {userPlan==="free"?"🔒 Message":"💬 Message"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── UPGRADE MODAL ── */}
      {modal==="upgrade" && (
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", zIndex:200, display:"flex", alignItems:"flex-end", backdropFilter:"blur(10px)" }}>
          <div style={{ background:"linear-gradient(160deg,#16121F,#0D0B12)", borderRadius:"24px 24px 0 0", width:"100%", border:"1px solid rgba(255,255,255,.08)", borderBottom:"none", animation:"slideSheet .35s cubic-bezier(.16,1,.3,1)" }}>
            <div style={{ width:36, height:4, background:"rgba(255,255,255,.1)", borderRadius:2, margin:"12px auto 0" }} />
            <div style={{ padding:"20px 18px 28px" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, marginBottom:4 }}>Upgrade Your Plan</div>
              <div style={{ color:"rgba(255,255,255,.35)", fontSize:13, marginBottom:20 }}>No hidden charges · No sales calls · 15-day refund</div>
              {[["plus","⭐ Bandhan Plus","₹499",["Unlimited matches","Messaging","See who liked you","Priority visibility","Kundli","7-day free trial"],"linear-gradient(135deg,#C8A96E,#A8882E)","rgba(200,169,110,.25)","#1A1208"],["parivar","👨‍👩‍👧 Parivar Plan","₹799",["Everything in Plus","Parent + child accounts","Family dashboard","Priority 24hr support"],"linear-gradient(135deg,#1A3A6B,#0A2050)","rgba(116,185,255,.2)","#74B9FF"]].map(([plan,name,price,features,bg,border,textColor])=>(
                <div key={plan} onClick={()=>upgradePlan(plan)} style={{ border:`1px solid ${border}`, borderRadius:18, padding:"16px 18px", marginBottom:12, background:plan==="plus"?"rgba(200,169,110,.06)":"rgba(116,185,255,.04)", cursor:"pointer" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={{ fontWeight:800, fontSize:16 }}>{name}</div>
                    <div><span style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:plan==="plus"?"#C8A96E":"#74B9FF" }}>{price}</span><span style={{ fontSize:12, color:"rgba(255,255,255,.3)" }}>/mo</span></div>
                  </div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,.45)", lineHeight:1.9 }}>{features.map(f=>`✓ ${f}`).join("  ")}</div>
                  <button style={{ marginTop:12, width:"100%", padding:12, background:bg, color:textColor, border:"none", borderRadius:11, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>Choose {name.split(" ").slice(-1)[0]}</button>
                </div>
              ))}
              <div style={{ textAlign:"center", fontSize:11, color:"rgba(255,255,255,.25)" }}>🔒 Secure · 15-day refund · No auto-renewal</div>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}

/* ─── SUB-COMPONENTS ─── */
function InterestRow({ interest, person, isReceived, onAccept, onReject }) {
  const h = ({ id }) => ({ u001:24,u002:195,u003:260,u004:152,u005:330,u006:45,u007:10,u008:210 }[id] || 180);
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"13px 16px", borderBottom:"1px solid rgba(255,255,255,.04)" }}>
      <div style={{ width:48, height:48, borderRadius:13, background:`linear-gradient(135deg,hsl(${h(person)},70%,45%),hsl(${h(person)},60%,30%))`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0, boxShadow:`0 4px 12px hsla(${h(person)},70%,45%,.3)` }}>{person.gender==="Female"?"👩":"👨"}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:14 }}>{person.name||"Unknown"}</div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,.35)", marginTop:1 }}>{person.profession} · {person.city}</div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,.6)", marginTop:5, fontStyle:"italic", background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.06)", borderRadius:8, padding:"5px 9px", lineHeight:1.5 }}>"{interest.message}"</div>
        {interest.status==="pending" && isReceived && (
          <div style={{ display:"flex", gap:7, marginTop:8 }}>
            <button onClick={onAccept} style={{ padding:"5px 14px", background:"rgba(42,122,79,.15)", color:"#55EFC4", border:"1px solid rgba(42,122,79,.3)", borderRadius:9, fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>✓ Accept</button>
            <button onClick={onReject} style={{ padding:"5px 14px", background:"rgba(201,64,64,.08)", color:"#FF8C8C", border:"1px solid rgba(201,64,64,.2)", borderRadius:9, fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>✗ Decline</button>
          </div>
        )}
      </div>
      <span style={{ padding:"3px 9px", borderRadius:100, fontSize:10, fontWeight:800, flexShrink:0, marginTop:2, background:interest.status==="accepted"?"rgba(42,122,79,.15)":interest.status==="rejected"?"rgba(201,64,64,.1)":"rgba(200,169,110,.08)", color:interest.status==="accepted"?"#55EFC4":interest.status==="rejected"?"#FF8C8C":"#C8A96E", border:`1px solid ${interest.status==="accepted"?"rgba(42,122,79,.25)":interest.status==="rejected"?"rgba(201,64,64,.2)":"rgba(200,169,110,.15)"}` }}>
        {interest.status}
      </span>
    </div>
  );
}

function GlassSection({ title, children, style={} }) {
  return (
    <div style={{ background:"linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.015))", border:"1px solid rgba(255,255,255,.07)", borderRadius:18, overflow:"hidden", ...style }}>
      <div style={{ padding:"10px 15px", borderBottom:"1px solid rgba(255,255,255,.05)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1.2, color:"rgba(200,169,110,.5)" }}>{title}</div>
      <div style={{ padding:"4px 15px 12px" }}>{children}</div>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div style={{ position:"fixed", bottom:80, left:"50%", transform:`translateX(-50%) translateY(${toast.show?0:8}px)`, background:toast.ok?"rgba(18,16,26,.97)":"rgba(38,10,10,.97)", backdropFilter:"blur(24px)", border:`1px solid ${toast.ok?"rgba(200,169,110,.2)":"rgba(201,64,64,.3)"}`, color:"#fff", padding:"9px 18px", borderRadius:100, fontSize:13, fontWeight:600, opacity:toast.show?1:0, transition:"all .3s cubic-bezier(.16,1,.3,1)", zIndex:999, whiteSpace:"nowrap", pointerEvents:"none", boxShadow:"0 8px 28px rgba(0,0,0,.45)" }}>
      {toast.msg}
    </div>
  );
}
