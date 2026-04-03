import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

interface LoginScreenProps {
  onLogin: (uid: string) => void;
}

type Mode = 'login' | 'register';
type RegStep = 'credentials' | 'tenant' | 'pending';

const inputStyle: React.CSSProperties = {
  width:'100%', boxSizing:'border-box',
  background:'rgba(255,255,255,0.06)',
  border:'1px solid rgba(255,255,255,0.15)',
  borderRadius:10, padding:'11px 14px',
  color:'white', fontSize:13, outline:'none',
  transition:'border-color 0.15s',
};
const labelStyle: React.CSSProperties = {
  display:'block', color:'#94a3b8', fontSize:11,
  fontWeight:600, textTransform:'uppercase',
  letterSpacing:'0.06em', marginBottom:6,
};

const FEATURES: [string,string][] = [
  ['🔭','Vision to Subtask'],['🤖','AI Assist'],
  ['📊','Live Reports'],['🗂️','Kanban Boards'],
];

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode,    setMode]    = useState<Mode>('login');
  const [regStep, setRegStep] = useState<RegStep>('credentials');

  // Login
  const [uid, setUid] = useState('');
  const [pwd, setPwd] = useState('');

  // Register — step 1: credentials
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPwd,      setRegPwd]      = useState('');
  const [regPwdConf,  setRegPwdConf]  = useState('');

  // Register — step 2: tenant
  const [companyName,   setCompanyName]   = useState('');
  const [tenantFound,   setTenantFound]   = useState<any>(null);   // existing tenant row
  const [tenantChecked, setTenantChecked] = useState(false);
  const [isNewTenant,   setIsNewTenant]   = useState(false);

  // Shared
  const [err,     setErr]     = useState('');
  const [info,    setInfo]    = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m); setErr(''); setInfo('');
    setRegStep('credentials');
    setUid(''); setPwd('');
    setRegUsername(''); setRegFullName('');
    setRegEmail(''); setRegPwd(''); setRegPwdConf('');
    setCompanyName(''); setTenantFound(null);
    setTenantChecked(false); setIsNewTenant(false);
  };

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const attemptLogin = async () => {
    const username = uid.trim().toLowerCase();
    if (!username || !pwd.trim()) return;
    setErr(''); setLoading(true);

    const { data: userRow, error: lookupErr } = await supabase
      .from('tenant_users')
      .select('email, active, approval_status')
      .eq('username', username)
      .single();

    if (lookupErr || !userRow) {
      setErr('Username not found. Please check your User ID or register a new account.');
      setLoading(false); return;
    }
    if (userRow.approval_status === 'pending') {
      setErr('Your account is awaiting administrator approval. You will be notified once approved.');
      setLoading(false); return;
    }
    if (userRow.approval_status === 'rejected') {
      setErr('Your account request was not approved. Please contact your administrator.');
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

  // ── REGISTER STEP 1: validate credentials ────────────────────────────────
  const validateCredentials = async () => {
    const username = regUsername.trim().toLowerCase();
    if (!username || !regFullName.trim() || !regEmail.trim() || !regPwd || !regPwdConf) {
      setErr('Please fill in all fields.'); return;
    }
    if (username.length < 3) { setErr('Username must be at least 3 characters.'); return; }
    if (!/^[a-z0-9._-]+$/.test(username)) { setErr('Username can only contain letters, numbers, dots, hyphens and underscores.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) { setErr('Please enter a valid email address.'); return; }
    if (regPwd.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (regPwd !== regPwdConf) { setErr('Passwords do not match.'); return; }

    setErr(''); setLoading(true);

    // Check username not taken
    const { data: existing } = await supabase
      .from('tenant_users').select('id').eq('username', username).maybeSingle();
    if (existing) {
      setErr(`Username "${username}" is already taken.`);
      setLoading(false); return;
    }

    setLoading(false);
    setRegStep('tenant');
  };

  // ── REGISTER STEP 2: look up company ─────────────────────────────────────
  const lookupTenant = async () => {
    const name = companyName.trim();
    if (!name) { setErr('Please enter your company name.'); return; }
    setErr(''); setLoading(true); setTenantChecked(false); setTenantFound(null);

    const { data } = await supabase
      .from('tenants')
      .select('id, name, slug, active, approval_status')
      .ilike('name', name)
      .maybeSingle();

    setTenantChecked(true);
    setTenantFound(data ?? null);
    setIsNewTenant(!data);
    setLoading(false);

    if (data) {
      setInfo(`Found "${data.name}". You will be added as a pending user awaiting admin approval.`);
    } else {
      setInfo(`"${name}" was not found. A new tenant will be created pending admin approval.`);
    }
  };

  // ── REGISTER STEP 2: submit ───────────────────────────────────────────────
  const submitRegistration = async () => {
    if (!tenantChecked) { setErr('Please look up your company first.'); return; }
    setErr(''); setLoading(true);

    const username = regUsername.trim().toLowerCase();
    const email    = regEmail.trim().toLowerCase();
    const now      = new Date().toISOString();

    // 1. Create Supabase auth user
    const { data: authData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password: regPwd,
      options: { data: { username, full_name: regFullName.trim() } },
    });

    if (signUpErr) {
      setErr(signUpErr.message.includes('already registered')
        ? 'An account with this email already exists. Please log in instead.'
        : signUpErr.message);
      setLoading(false); return;
    }

    const authUser = authData.user;
    if (!authUser) {
      setErr('Registration failed. Please try again.');
      setLoading(false); return;
    }

    let tenantId: string;

    if (tenantFound) {
      // 2a. Join existing tenant as pending
      tenantId = tenantFound.id;
    } else {
      // 2b. Create new tenant as pending
      const slug = companyName.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const { data: newTenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({
          name:             companyName.trim(),
          slug:             slug + '-' + Math.random().toString(36).slice(2,6),
          plan:             'starter',
          active:           false,
          sub_status:       'trialling',
          approval_status:  'pending',
          requested_by:     username,
          approval_requested_at: now,
          feat_kanban: true, feat_workitems: true,
          feat_create: true, feat_bot: true, feat_reports: true,
        })
        .select('id')
        .single();

      if (tenantErr || !newTenant) {
        setErr('Failed to create company profile. Please try again.');
        setLoading(false); return;
      }
      tenantId = newTenant.id;
    }

    // 3. Insert tenant_users as pending + inactive
    const { error: tuErr } = await supabase.from('tenant_users').insert({
      auth_user_id:          authUser.id,
      tenant_id:             tenantId,
      username,
      full_name:             regFullName.trim(),
      email,
      role:                  'editor',
      active:                false,          // not active until approved
      approval_status:       'pending',
      approval_requested_at: now,
    });

    if (tuErr) {
      setErr('Account setup failed. Please try again.');
      setLoading(false); return;
    }

    // 4. Sign out immediately — they can't use the app until approved
    await supabase.auth.signOut();

    setLoading(false);
    setRegStep('pending');
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  const cardWidth = mode === 'register' && regStep !== 'pending' ? 440 : 380;

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 45%,#0f2744 100%)',fontFamily:'system-ui,sans-serif'}}>

      {/* Top bar */}
      <div style={{padding:'18px 32px',display:'flex',alignItems:'center',gap:10,background:'#a3bbff',borderBottom:'1px solid #7a9ee8'}}>
        <img src='/logo.jpg' alt='Strat101' style={{width:36,height:36,borderRadius:10,objectFit:'cover',boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}/>
        <div>
          <div style={{color:'#0c2040',fontWeight:900,fontSize:18,letterSpacing:'-0.3px',lineHeight:1}}>Strat101.com</div>
          <div style={{color:'#1a3a6e',fontSize:9,letterSpacing:'0.1em',marginTop:2}}>ENABLING TRANSFORMATION JOURNEYS</div>
        </div>
      </div>

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
        <div style={{display:'flex',gap:'clamp(16px,4vw,64px)',alignItems:'center',maxWidth:960,width:'100%',flexWrap:'wrap',justifyContent:'center'}}>

          {/* Left hero */}
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
          <div style={{background:'rgba(255,255,255,0.04)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,padding:'36px 32px',width:cardWidth,flexShrink:0,boxShadow:'0 25px 60px rgba(0,0,0,0.4)',transition:'width 0.2s'}}>

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <>
                <div style={{marginBottom:24,textAlign:'center'}}>
                  <img src='/logo.jpg' alt='Strat101' style={{width:52,height:52,borderRadius:14,objectFit:'cover',margin:'0 auto 12px',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}/>
                  <div style={{color:'white',fontWeight:700,fontSize:18}}>Welcome back</div>
                  <div style={{color:'#64748b',fontSize:12,marginTop:4}}>Sign in to your Strat101.com workspace</div>
                </div>
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
                {err && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'9px 12px',color:'#fca5a5',fontSize:12,marginBottom:14}}>{err}</div>}
                <button onClick={attemptLogin} disabled={loading||!uid.trim()||!pwd.trim()}
                  style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:'pointer',background:loading?'#334155':'linear-gradient(135deg,#2563eb,#4f46e5)',color:'white',fontSize:13,fontWeight:700,marginBottom:16,opacity:uid.trim()&&pwd.trim()?1:0.5}}>
                  {loading ? 'Signing in\u2026' : 'Sign In \u2192'}
                </button>
                <div style={{textAlign:'center',fontSize:12,color:'#64748b'}}>
                  Don\u2019t have an account?{' '}
                  <button onClick={()=>switchMode('register')} style={{background:'none',border:'none',color:'#60a5fa',fontWeight:600,cursor:'pointer',fontSize:12,padding:0}}>Create one</button>
                </div>
              </>
            )}

            {/* ── REGISTER STEP 1: credentials ── */}
            {mode === 'register' && regStep === 'credentials' && (
              <>
                <div style={{marginBottom:20,textAlign:'center'}}>
                  <img src='/logo.jpg' alt='Strat101' style={{width:52,height:52,borderRadius:14,objectFit:'cover',margin:'0 auto 12px',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}/>
                  <div style={{color:'white',fontWeight:700,fontSize:18}}>Create your account</div>
                  <div style={{color:'#64748b',fontSize:12,marginTop:4}}>Step 1 of 2 \u2014 Your details</div>
                </div>
                {/* Step indicator */}
                <div style={{display:'flex',gap:6,marginBottom:20}}>
                  {['Your Details','Company'].map((s,i)=>(
                    <div key={s} style={{flex:1,height:3,borderRadius:99,background:i===0?'#3b82f6':'rgba(255,255,255,0.15)'}}/>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
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
                    <input value={regFullName} onChange={e=>setRegFullName(e.target.value)} placeholder="e.g. John Doe"
                      style={inputStyle}
                      onFocus={e=>e.target.style.borderColor='#3b82f6'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={regEmail} onChange={e=>setRegEmail(e.target.value)} placeholder="you@company.com"
                    style={inputStyle}
                    onFocus={e=>e.target.style.borderColor='#3b82f6'}
                    onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div>
                    <label style={labelStyle}>Password</label>
                    <input type="password" value={regPwd} onChange={e=>setRegPwd(e.target.value)} placeholder="Min. 8 characters"
                      style={inputStyle}
                      onFocus={e=>e.target.style.borderColor='#3b82f6'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <input type="password" value={regPwdConf} onChange={e=>setRegPwdConf(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&validateCredentials()}
                      placeholder="Re-enter password" style={inputStyle}
                      onFocus={e=>e.target.style.borderColor='#3b82f6'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                  </div>
                </div>
                {/* Password strength */}
                {regPwd && (
                  <div style={{marginBottom:12}}>
                    <div style={{display:'flex',gap:4,marginBottom:3}}>
                      {[regPwd.length>=8,/[A-Z]/.test(regPwd),/[0-9]/.test(regPwd),/[^A-Za-z0-9]/.test(regPwd)].map((met,i)=>(
                        <div key={i} style={{flex:1,height:3,borderRadius:99,background:met?'#22c55e':'rgba(255,255,255,0.15)',transition:'background 0.2s'}}/>
                      ))}
                    </div>
                    <div style={{fontSize:10,color:'#64748b'}}>
                      {regPwd.length<8?'8+ chars required':/[A-Z]/.test(regPwd)&&/[0-9]/.test(regPwd)&&/[^A-Za-z0-9]/.test(regPwd)?'\u2713 Strong password':'Add uppercase, numbers and symbols'}
                    </div>
                  </div>
                )}
                {err && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'9px 12px',color:'#fca5a5',fontSize:12,marginBottom:12}}>{err}</div>}
                <button onClick={validateCredentials} disabled={loading||!regUsername||!regFullName||!regEmail||!regPwd||!regPwdConf}
                  style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:'pointer',background:'linear-gradient(135deg,#2563eb,#4f46e5)',color:'white',fontSize:13,fontWeight:700,marginBottom:14,opacity:regUsername&&regFullName&&regEmail&&regPwd&&regPwdConf?1:0.5}}>
                  {loading ? 'Checking\u2026' : 'Continue \u2192'}
                </button>
                <div style={{textAlign:'center',fontSize:12,color:'#64748b'}}>
                  Already have an account?{' '}
                  <button onClick={()=>switchMode('login')} style={{background:'none',border:'none',color:'#60a5fa',fontWeight:600,cursor:'pointer',fontSize:12,padding:0}}>Sign in</button>
                </div>
              </>
            )}

            {/* ── REGISTER STEP 2: tenant ── */}
            {mode === 'register' && regStep === 'tenant' && (
              <>
                <div style={{marginBottom:20,textAlign:'center'}}>
                  <img src='/logo.jpg' alt='Strat101' style={{width:52,height:52,borderRadius:14,objectFit:'cover',margin:'0 auto 12px',boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}/>
                  <div style={{color:'white',fontWeight:700,fontSize:18}}>Your company</div>
                  <div style={{color:'#64748b',fontSize:12,marginTop:4}}>Step 2 of 2 \u2014 Company details</div>
                </div>
                {/* Step indicator */}
                <div style={{display:'flex',gap:6,marginBottom:20}}>
                  {['Your Details','Company'].map((s,i)=>(
                    <div key={s} style={{flex:1,height:3,borderRadius:99,background:'#3b82f6'}}/>
                  ))}
                </div>
                <div style={{marginBottom:10}}>
                  <label style={labelStyle}>Company Name</label>
                  <div style={{display:'flex',gap:8}}>
                    <input value={companyName} onChange={e=>{setCompanyName(e.target.value);setTenantChecked(false);setTenantFound(null);setInfo('');setIsNewTenant(false);}}
                      onKeyDown={e=>e.key==='Enter'&&lookupTenant()}
                      placeholder="e.g. Acme Corporation" style={{...inputStyle,flex:1}}
                      onFocus={e=>e.target.style.borderColor='#3b82f6'}
                      onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
                    <button onClick={lookupTenant} disabled={loading||!companyName.trim()}
                      style={{padding:'0 16px',borderRadius:10,border:'none',background:'#334155',color:'#93c5fd',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
                      {loading?'...':'Look up'}
                    </button>
                  </div>
                </div>

                {/* Result box */}
                {tenantChecked && (
                  <div style={{padding:'12px 14px',borderRadius:10,marginBottom:14,
                    background: tenantFound ? 'rgba(22,163,74,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${tenantFound ? 'rgba(22,163,74,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  }}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                      <span style={{fontSize:18,flexShrink:0}}>{tenantFound ? '✅' : '🏢'}</span>
                      <div>
                        {tenantFound ? (
                          <>
                            <div style={{color:'#86efac',fontSize:12,fontWeight:700,marginBottom:4}}>Company found: {tenantFound.name}</div>
                            <div style={{color:'#94a3b8',fontSize:11,lineHeight:1.5}}>
                              Your account will be created as <strong style={{color:'white'}}>pending</strong> and must be approved by the {tenantFound.name} administrator before you can log in.
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{color:'#fcd34d',fontSize:12,fontWeight:700,marginBottom:4}}>New company: {companyName}</div>
                            <div style={{color:'#94a3b8',fontSize:11,lineHeight:1.5}}>
                              A new workspace will be created for <strong style={{color:'white'}}>{companyName}</strong>. Your account and company will be <strong style={{color:'white'}}>pending approval</strong> from the Strat101.com platform administrator before activation.
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {err && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'9px 12px',color:'#fca5a5',fontSize:12,marginBottom:12}}>{err}</div>}

                <button onClick={submitRegistration} disabled={loading||!tenantChecked}
                  style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:'pointer',background:loading?'#334155':'linear-gradient(135deg,#16a34a,#15803d)',color:'white',fontSize:13,fontWeight:700,marginBottom:12,opacity:tenantChecked?1:0.5}}>
                  {loading ? 'Creating account\u2026' : 'Submit Registration \u2192'}
                </button>
                <button onClick={()=>{setRegStep('credentials');setErr('');setInfo('');}}
                  style={{width:'100%',padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'#94a3b8',fontSize:12,cursor:'pointer'}}>
                  \u2190 Back
                </button>
              </>
            )}

            {/* ── REGISTER STEP 3: pending confirmation ── */}
            {mode === 'register' && regStep === 'pending' && (
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontSize:56,marginBottom:16}}>⏳</div>
                <div style={{color:'white',fontWeight:700,fontSize:20,marginBottom:10}}>Request submitted!</div>
                <div style={{color:'#94a3b8',fontSize:13,lineHeight:1.7,marginBottom:24}}>
                  Your account request has been submitted successfully. You will receive an email once your account has been reviewed and approved by the administrator.
                </div>
                <div style={{padding:'14px 16px',background:'rgba(37,99,235,0.1)',border:'1px solid rgba(37,99,235,0.25)',borderRadius:10,marginBottom:24,textAlign:'left'}}>
                  <div style={{color:'#93c5fd',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>What happens next</div>
                  {['The platform administrator reviews your request','Your company workspace is set up if new','Your account is activated','You receive confirmation to log in'].map((s,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:6}}>
                      <div style={{width:18,height:18,borderRadius:'50%',background:'rgba(37,99,235,0.3)',border:'1px solid rgba(37,99,235,0.5)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                        <span style={{color:'#93c5fd',fontSize:10,fontWeight:700}}>{i+1}</span>
                      </div>
                      <span style={{color:'#cbd5e1',fontSize:12,lineHeight:1.5}}>{s}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>switchMode('login')}
                  style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#2563eb,#4f46e5)',color:'white',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                  Back to Sign In
                </button>
              </div>
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
