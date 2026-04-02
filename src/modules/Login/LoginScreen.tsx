import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

interface LoginScreenProps {
  onLogin: (uid: string) => void;
}

type Mode = 'login' | 'register';

// ─── HERO FEATURES ────────────────────────────────────────────────────────────
const FEATURES: [string, string][] = [
  ['🔭', 'Vision to Subtask'],
  ['🤖', 'AI Assist'],
  ['📊', 'Live Reports'],
  ['🗂️', 'Kanban Boards'],
];

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10, padding: '11px 14px',
  color: 'white', fontSize: 13, outline: 'none',
  transition: 'border-color 0.15s',
};
const labelStyle: React.CSSProperties = {
  display: 'block', color: '#94a3b8', fontSize: 11,
  fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: 6,
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>('login');

  // ── Login state ──────────────────────────────────────────────────────────────
  const [uid,     setUid]     = useState('');
  const [pwd,     setPwd]     = useState('');

  // ── Register state ───────────────────────────────────────────────────────────
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPwd,      setRegPwd]      = useState('');
  const [regPwdConf,  setRegPwdConf]  = useState('');

  // ── Shared state ─────────────────────────────────────────────────────────────
  const [err,     setErr]     = useState('');
  const [info,    setInfo]    = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m); setErr(''); setInfo('');
    setUid(''); setPwd('');
    setRegUsername(''); setRegFullName('');
    setRegEmail(''); setRegPwd(''); setRegPwdConf('');
  };

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  const attemptLogin = async () => {
    const username = uid.trim().toLowerCase();
    if (!username || !pwd.trim()) return;
    setErr(''); setInfo(''); setLoading(true);

    // Look up email from tenant_users by username
    const { data: userRow, error: lookupErr } = await supabase
      .from('tenant_users')
      .select('email, active')
      .eq('username', username)
      .single();

    if (lookupErr || !userRow) {
      setErr('Username not found. Please check your User ID or register a new account.');
      setLoading(false); return;
    }
    if (!userRow.active) {
      setErr('This account is inactive. Please contact your administrator.');
      setLoading(false); return;
    }

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: userRow.email, password: pwd,
    });

    if (authErr) {
      if (authErr.message?.toLowerCase().includes('email not confirmed')) {
        setErr('Account not yet confirmed. Please contact your administrator.');
      } else if (authErr.message?.toLowerCase().includes('invalid login credentials')) {
        setErr('Incorrect password. Please try again.');
      } else {
        setErr(authErr.message);
      }
      setLoading(false);
    } else {
      onLogin(username);
    }
  };

  // ── REGISTER ─────────────────────────────────────────────────────────────────
  const attemptRegister = async () => {
    const username  = regUsername.trim().toLowerCase();
    const fullName  = regFullName.trim();
    const email     = regEmail.trim().toLowerCase();
    const password  = regPwd;
    const passwordC = regPwdConf;

    // Validate
    if (!username || !fullName || !email || !password || !passwordC) {
      setErr('Please fill in all fields.'); return;
    }
    if (username.length < 3) {
      setErr('Username must be at least 3 characters.'); return;
    }
    if (!/^[a-z0-9._-]+$/.test(username)) {
      setErr('Username can only contain letters, numbers, dots, hyphens and underscores.'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('Please enter a valid email address.'); return;
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.'); return;
    }
    if (password !== passwordC) {
      setErr('Passwords do not match.'); return;
    }

    setErr(''); setInfo(''); setLoading(true);

    // Check username is not already taken
    const { data: existing } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      setErr(`Username "${username}" is already taken. Please choose another.`);
      setLoading(false); return;
    }

    // Get the default tenant (strat101)
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', 'strat101')
      .single();

    if (tenantErr || !tenant) {
      setErr('Registration is currently unavailable. Please contact your administrator.');
      setLoading(false); return;
    }

    // Create Supabase auth user
    const { data: authData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: fullName } },
    });

    if (signUpErr) {
      if (signUpErr.message?.toLowerCase().includes('already registered')) {
        setErr('An account with this email already exists. Please log in instead.');
      } else {
        setErr(signUpErr.message);
      }
      setLoading(false); return;
    }

    const authUser = authData.user;
    if (!authUser) {
      setErr('Registration failed — no user returned. Please try again.');
      setLoading(false); return;
    }

    // Insert tenant_users row linking auth user to the strat101 tenant
    const { error: tuErr } = await supabase.from('tenant_users').insert({
      auth_user_id: authUser.id,
      tenant_id:    tenant.id,
      username,
      full_name:    fullName,
      email,
      role:         'editor',   // default role for self-registered users
      active:       true,
    });

    if (tuErr) {
      console.error('tenant_users insert failed:', tuErr.message);
      setErr('Account created but profile setup failed. Please contact your administrator.');
      setLoading(false); return;
    }

    // Auto sign-in after successful registration
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    if (signInErr) {
      // Registration succeeded but auto-login failed — prompt manual login
      setInfo('Account created successfully! Please log in with your new credentials.');
      switchMode('login');
      setUid(username);
    } else {
      onLogin(username);
    }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 45%,#0f2744 100%)',fontFamily:'system-ui,sans-serif'}}>

      {/* Top bar */}
      <div style={{padding:'18px 32px',display:'flex',alignItems:'center',gap:10,background:'#a3bbff',borderBottom:'1px solid #7a9ee8'}}>
        <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#2563eb,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:14,boxShadow:'0 4px 12px rgba(37,99,235,0.5)'}}>SA</div>
        <div>
          <div style={{color:'#0c2040',fontWeight:900,fontSize:18,letterSpacing:'-0.3px',lineHeight:1}}>Strat101.com</div>
          <div style={{color:'#1a3a6e',fontSize:9,letterSpacing:'0.1em',marginTop:2}}>ENABLING TRANSFORMATION</div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
        <div style={{display:'flex',gap:'clamp(16px,4vw,64px)',alignItems:'center',maxWidth:960,width:'100%',flexWrap:'wrap',justifyContent:'center'}}>

          {/* Left hero — hide on small screens when registering */}
          <div style={{flex:1,color:'white',minWidth:260}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(37,99,235,0.18)',border:'1px solid rgba(37,99,235,0.35)',borderRadius:999,padding:'5px 14px',marginBottom:24}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'#60a5fa',display:'inline-block'}}/>
              <span style={{color:'#93c5fd',fontSize:11,fontWeight:600,letterSpacing:'0.05em'}}>AI-POWERED STRATEGY MANAGEMENT</span>
            </div>
            <h1 style={{fontSize:40,fontWeight:900,lineHeight:1.1,margin:'0 0 16px',letterSpacing:'-1px'}}>
              Transform strategy<br/>into <span style={{color:'#60a5fa'}}>execution</span>
            </h1>
            <p style={{color:'#94a3b8',fontSize:14,lineHeight:1.7,maxWidth:400,marginBottom:32}}>
              Strat101.com connects vision to delivery \u2014 linking OKRs, programs, projects and tasks in a single intelligent workspace powered by AI.
            </p>
            <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
              {FEATURES.map(([icon,label])=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>{icon}</span>
                  <span style={{color:'#cbd5e1',fontSize:12,fontWeight:500}}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right card */}
          <div style={{background:'rgba(255,255,255,0.04)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,padding:'36px 32px',width:mode==='register'?420:380,flexShrink:0,boxShadow:'0 25px 60px rgba(0,0,0,0.4)',transition:'width 0.2s'}}>

            {/* Card header */}
            <div style={{marginBottom:24,textAlign:'center'}}>
              <div style={{width:52,height:52,borderRadius:14,background:'linear-gradient(135deg,#2563eb,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:20,margin:'0 auto 12px',boxShadow:'0 8px 24px rgba(37,99,235,0.45)'}}>SA</div>
              <div style={{color:'white',fontWeight:700,fontSize:18}}>
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </div>
              <div style={{color:'#64748b',fontSize:12,marginTop:4}}>
                {mode === 'login' ? 'Sign in to your Strat101.com workspace' : 'Join Strat101.com and start transforming'}
              </div>
            </div>

            {/* ── LOGIN FORM ── */}
            {mode === 'login' && (
              <>
                <div style={{marginBottom:14}}>
                  <label style={labelStyle}>User ID</label>
                  <input value={uid} onChange={e=>setUid(e.target.value)} onKeyDown={e=>e.key==='Enter'&&attemptLogin()}
                    autoFocus placeholder="Enter your username" style={inputStyle}
                    onFocus={e=>e.target.style.borderColor='#3b82f6'}
                    onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                </div>
                <div style={{marginBottom:20}}>
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&attemptLogin()}
                    style={inputStyle}
                    onFocus={e=>e.target.style.borderColor='#3b82f6'}
                    onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                </div>
                {info && <div style={{background:'rgba(59,130,246,0.12)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:8,padding:'9px 12px',color:'#93c5fd',fontSize:12,marginBottom:14}}>{info}</div>}
                {err  && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'9px 12px',color:'#fca5a5',fontSize:12,marginBottom:14}}>{err}</div>}
                <button onClick={attemptLogin} disabled={loading||!uid.trim()||!pwd.trim()}
                  style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:loading||!uid.trim()||!pwd.trim()?'not-allowed':'pointer',background:loading?'#334155':'linear-gradient(135deg,#2563eb,#4f46e5)',color:'white',fontSize:13,fontWeight:700,boxShadow:loading?'none':'0 4px 14px rgba(37,99,235,0.45)',transition:'all 0.15s',opacity:uid.trim()&&pwd.trim()?1:0.5,marginBottom:16}}>
                  {loading ? 'Signing in\u2026' : 'Sign In \u2192'}
                </button>
                <div style={{textAlign:'center',fontSize:12,color:'#64748b'}}>
                  Don\u2019t have an account?{' '}
                  <button onClick={()=>switchMode('register')} style={{background:'none',border:'none',color:'#60a5fa',fontWeight:600,cursor:'pointer',fontSize:12,padding:0}}>
                    Create one
                  </button>
                </div>
              </>
            )}

            {/* ── REGISTER FORM ── */}
            {mode === 'register' && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div>
                    <label style={labelStyle}>Username</label>
                    <input value={regUsername} onChange={e=>setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g,''))}
                      autoFocus placeholder="e.g. john.doe" style={inputStyle}
                      onFocus={e=>e.target.style.borderColor='#3b82f6'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                    <div style={{fontSize:9,color:'#475569',marginTop:3}}>Used to log in</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input value={regFullName} onChange={e=>setRegFullName(e.target.value)}
                      placeholder="e.g. John Doe" style={inputStyle}
                      onFocus={e=>e.target.style.borderColor='#3b82f6'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={regEmail} onChange={e=>setRegEmail(e.target.value)}
                    placeholder="you@company.com" style={inputStyle}
                    onFocus={e=>e.target.style.borderColor='#3b82f6'}
                    onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                  <div>
                    <label style={labelStyle}>Password</label>
                    <input type="password" value={regPwd} onChange={e=>setRegPwd(e.target.value)}
                      placeholder="Min. 8 characters" style={inputStyle}
                      onFocus={e=>e.target.style.borderColor='#3b82f6'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <input type="password" value={regPwdConf} onChange={e=>setRegPwdConf(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&attemptRegister()}
                      placeholder="Re-enter password" style={inputStyle}
                      onFocus={e=>e.target.style.borderColor='#3b82f6'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                  </div>
                </div>

                {/* Password strength indicator */}
                {regPwd && (
                  <div style={{marginBottom:14}}>
                    <div style={{display:'flex',gap:4,marginBottom:4}}>
                      {[
                        regPwd.length >= 8,
                        /[A-Z]/.test(regPwd),
                        /[0-9]/.test(regPwd),
                        /[^A-Za-z0-9]/.test(regPwd),
                      ].map((met,i) => (
                        <div key={i} style={{flex:1,height:3,borderRadius:99,background:met?'#22c55e':'rgba(255,255,255,0.15)',transition:'background 0.2s'}}/>
                      ))}
                    </div>
                    <div style={{fontSize:10,color:'#64748b'}}>
                      {regPwd.length < 8 ? '8+ chars required' : /[A-Z]/.test(regPwd) && /[0-9]/.test(regPwd) && /[^A-Za-z0-9]/.test(regPwd) ? '\u2713 Strong password' : 'Add uppercase, numbers and symbols for a stronger password'}
                    </div>
                  </div>
                )}

                {err  && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'9px 12px',color:'#fca5a5',fontSize:12,marginBottom:14}}>{err}</div>}

                <button onClick={attemptRegister}
                  disabled={loading||!regUsername||!regFullName||!regEmail||!regPwd||!regPwdConf}
                  style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:loading?'not-allowed':'pointer',background:loading?'#334155':'linear-gradient(135deg,#16a34a,#15803d)',color:'white',fontSize:13,fontWeight:700,boxShadow:loading?'none':'0 4px 14px rgba(22,163,74,0.45)',transition:'all 0.15s',marginBottom:16,opacity:regUsername&&regFullName&&regEmail&&regPwd&&regPwdConf?1:0.5}}>
                  {loading ? 'Creating account\u2026' : 'Create Account \u2192'}
                </button>

                <div style={{textAlign:'center',fontSize:12,color:'#64748b'}}>
                  Already have an account?{' '}
                  <button onClick={()=>switchMode('login')} style={{background:'none',border:'none',color:'#60a5fa',fontWeight:600,cursor:'pointer',fontSize:12,padding:0}}>
                    Sign in
                  </button>
                </div>

                <div style={{marginTop:14,padding:'10px 12px',background:'rgba(255,255,255,0.04)',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)'}}>
                  <div style={{fontSize:10,color:'#475569',lineHeight:1.5}}>
                    By creating an account you will be added to the <strong style={{color:'#64748b'}}>Strat101.com</strong> workspace as an <strong style={{color:'#64748b'}}>editor</strong>. Contact your administrator to change your access level.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{padding:'14px 32px',background:'#a3bbff',borderTop:'1px solid #7a9ee8',display:'flex',justifyContent:'center',alignItems:'center',gap:16}}>
        <span style={{color:'#0c2040',fontSize:11,fontWeight:600}}>\u00aeStrat101.com</span>
        <span style={{color:'#4a6a9e'}}>|</span>
        <span style={{color:'#0c2040',fontSize:11}}>\u00a9Copyright 2026. All rights Reserved.</span>
        <span style={{color:'#4a6a9e'}}>|</span>
        <a href="mailto:Support@Strat101.com" style={{color:'#0c2040',fontSize:11,textDecoration:'none',fontWeight:600}}>Support@Strat101.com</a>
      </div>
    </div>
  );
}
