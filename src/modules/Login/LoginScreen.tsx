import React, { useState } from "react";

// ─── LOGIN CREDENTIALS ────────────────────────────────────────────────────────
// In production these would be validated server-side via Supabase Auth / Cognito.
// For this frontend demo, credentials are checked here.
const VALID_USERS: Record<string, string> = {
  'raviboorla':  'strat101.1',
  'stratadmin':  'Admin@Strat101',
};

interface LoginScreenProps {
  onLogin: (uid: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [uid,     setUid]     = useState('raviboorla');
  const [pwd,     setPwd]     = useState('strat101.1');
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  const attempt = () => {
    setErr(''); setLoading(true);
    setTimeout(() => {
      const expected = VALID_USERS[uid.trim().toLowerCase()];
      if(expected && pwd === expected){
        onLogin(uid.trim().toLowerCase());
      } else {
        setErr('Invalid User ID or Password. Please try again.');
        setLoading(false);
      }
    }, 900);
  };

  // Switch pre-fill when the user tab-selects an admin demo
  const prefill = (user: 'raviboorla' | 'stratadmin') => {
    setUid(user);
    setPwd(VALID_USERS[user]);
    setErr('');
  };

  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 45%,#0f2744 100%)',
      fontFamily:'system-ui,sans-serif',
    }}>
      {/* Top bar */}
      <div style={{padding:'18px 32px',display:'flex',alignItems:'center',gap:10,background:'#a3bbff',borderBottom:'1px solid #7a9ee8'}}>
        <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#2563eb,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:14,boxShadow:'0 4px 12px rgba(37,99,235,0.5)'}}>SA</div>
        <div>
          <div style={{color:'#0c2040',fontWeight:900,fontSize:18,letterSpacing:'-0.3px',lineHeight:1}}>Strat101.com</div>
          <div style={{color:'#1a3a6e',fontSize:9,letterSpacing:'0.1em',marginTop:2}}>ENABLING TRANSFORMATION</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
        <div style={{display:'flex',gap:'clamp(16px,4vw,64px)',alignItems:'center',maxWidth:960,width:'100%',flexWrap:'wrap',justifyContent:'center'}}>

          {/* Left hero */}
          <div style={{flex:1,color:'white',minWidth:260}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(37,99,235,0.18)',border:'1px solid rgba(37,99,235,0.35)',borderRadius:999,padding:'5px 14px',marginBottom:24}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'#60a5fa',display:'inline-block'}}/>
              <span style={{color:'#93c5fd',fontSize:11,fontWeight:600,letterSpacing:'0.05em'}}>AI-POWERED STRATEGY MANAGEMENT</span>
            </div>
            <h1 style={{fontSize:40,fontWeight:900,lineHeight:1.1,marginBottom:16,letterSpacing:'-1px',margin:'0 0 16px'}}>
              Transform strategy<br/>into <span style={{color:'#60a5fa'}}>execution</span>
            </h1>
            <p style={{color:'#94a3b8',fontSize:14,lineHeight:1.7,maxWidth:400,marginBottom:32}}>
              Strat101.com connects vision to delivery — linking OKRs, programmes, projects and tasks in a single intelligent workspace powered by AI.
            </p>
            <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
              {[['🔭','Vision to Subtask'],['🤖','AI Assist'],['📊','Live Reports'],['🗂️','Kanban Boards']].map(([icon,label])=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>{icon}</span>
                  <span style={{color:'#cbd5e1',fontSize:12,fontWeight:500}}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right login card */}
          <div style={{background:'rgba(255,255,255,0.04)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,padding:'36px 32px',width:380,flexShrink:0,boxShadow:'0 25px 60px rgba(0,0,0,0.4)'}}>
            <div style={{marginBottom:24,textAlign:'center'}}>
              <div style={{width:52,height:52,borderRadius:14,background:'linear-gradient(135deg,#2563eb,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:20,margin:'0 auto 12px',boxShadow:'0 8px 24px rgba(37,99,235,0.45)'}}>SA</div>
              <div style={{color:'white',fontWeight:700,fontSize:18}}>Welcome back</div>
              <div style={{color:'#64748b',fontSize:12,marginTop:4}}>Sign in to your Strat101.com workspace</div>
            </div>

            {/* Demo credential quick-select */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Quick sign-in (demo)</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <button onClick={()=>prefill('raviboorla')}
                  style={{padding:'8px 10px',borderRadius:10,border:`1px solid ${uid==='raviboorla'?'#3b82f6':'rgba(255,255,255,0.15)'}`,background:uid==='raviboorla'?'rgba(37,99,235,0.25)':'rgba(255,255,255,0.06)',cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'white'}}>👤 raviboorla</div>
                  <div style={{fontSize:10,color:'#64748b',marginTop:1}}>Standard user</div>
                </button>
                <button onClick={()=>prefill('stratadmin')}
                  style={{padding:'8px 10px',borderRadius:10,border:`1px solid ${uid==='stratadmin'?'#ef4444':'rgba(255,255,255,0.15)'}`,background:uid==='stratadmin'?'rgba(239,68,68,0.2)':'rgba(255,255,255,0.06)',cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}>
                  <div style={{fontSize:11,fontWeight:700,color:uid==='stratadmin'?'#fca5a5':'white'}}>⚙️ stratadmin</div>
                  <div style={{fontSize:10,color:'#64748b',marginTop:1}}>Admin console</div>
                </button>
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{display:'block',color:'#94a3b8',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>User ID</label>
              <input value={uid} onChange={e=>setUid(e.target.value)} onKeyDown={e=>e.key==='Enter'&&attempt()}
                style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'11px 14px',color:'white',fontSize:13,outline:'none',transition:'border-color 0.15s'}}
                onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:'block',color:'#94a3b8',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Password</label>
              <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&attempt()}
                style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'11px 14px',color:'white',fontSize:13,outline:'none',transition:'border-color 0.15s'}}
                onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.15)'}/>
            </div>

            {err&&<div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'9px 12px',color:'#fca5a5',fontSize:12,marginBottom:16}}>{err}</div>}

            <button onClick={attempt} disabled={loading||!uid.trim()}
              style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:loading||!uid.trim()?'not-allowed':'pointer',background:loading?'#334155':'linear-gradient(135deg,#2563eb,#4f46e5)',color:'white',fontSize:13,fontWeight:700,boxShadow:loading?'none':'0 4px 14px rgba(37,99,235,0.45)',transition:'all 0.15s',opacity:uid.trim()?1:0.6}}>
              {loading?'Signing in…':'Sign In →'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{padding:'14px 32px',background:'#a3bbff',borderTop:'1px solid #7a9ee8',display:'flex',justifyContent:'center',alignItems:'center',gap:16}}>
        <span style={{color:'#0c2040',fontSize:11,fontWeight:600}}>®Strat101.com</span>
        <span style={{color:'#4a6a9e'}}>|</span>
        <span style={{color:'#0c2040',fontSize:11}}>©Copyright 2026. All rights Reserved.</span>
        <span style={{color:'#4a6a9e'}}>|</span>
        <a href="mailto:Support@Strat101.com" style={{color:'#0c2040',fontSize:11,textDecoration:'none',fontWeight:600}}>Support@Strat101.com</a>
      </div>
    </div>
  );
}
