import React, { useState, useRef, useEffect, useMemo } from "react";
import { TC, TYPES, WORK_ITEM_TYPES } from "../constants";
import { fuzzyScore } from "../utils";
import { TenantFeatures } from "../types";
import LOGO_SRC from '../logoData';
import { useResponsive } from '../hooks/useResponsive';

// ─── INLINE SEARCH ────────────────────────────────────────────────────────────
interface InlineSearchProps { items: any[]; onNav: (id: string) => void; }

function InlineSearch({ items, onNav }: InlineSearchProps) {
  const [q,      setQ]      = useState('');
  const [open,   setOpen]   = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  const results = useMemo(()=>{
    if(!q.trim()) return items.slice(0,12);
    return items.map(i=>({...i,_s:fuzzyScore(i,q)})).filter(i=>i._s>0).sort((a,b)=>b._s-a._s).slice(0,14);
  },[q,items]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(wrapRef.current&&!wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if((e.metaKey||e.ctrlKey)&&e.key==='k'){ e.preventDefault(); inputRef.current?.focus(); setOpen(true); } };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[]);

  const pick=(id:string)=>{ onNav(id); setQ(''); setOpen(false); };
  const onKey=(e:React.KeyboardEvent)=>{
    if(!open) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); setCursor(c=>Math.min(c+1,results.length-1)); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); setCursor(c=>Math.max(c-1,0)); }
    else if(e.key==='Enter'&&results[cursor]) pick(results[cursor].id);
    else if(e.key==='Escape'){ setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={wrapRef} style={{position:'relative'}}>
      <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 8px',background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:6,width:180,boxShadow:open?'0 0 0 2px rgba(147,197,253,0.5)':'none',transition:'box-shadow 0.15s'}}>
        <input ref={inputRef} value={q} onChange={e=>{setQ(e.target.value);setCursor(0);setOpen(true);}} onFocus={()=>setOpen(true)} onKeyDown={onKey} placeholder="Search…"
          style={{flex:1,border:'none',outline:'none',background:'transparent',fontSize:12,color:'#e2eaf4'}}/>
        {q
          ? <button onClick={()=>{setQ('');setOpen(false);}} style={{border:'none',background:'none',cursor:'pointer',color:'#8baecf',fontSize:13,lineHeight:1,padding:0}}>×</button>
          : <kbd style={{background:'rgba(255,255,255,0.1)',borderRadius:3,padding:'1px 4px',fontSize:9,color:'#8baecf',fontFamily:'monospace',flexShrink:0}}>⌘K</kbd>
        }
      </div>
      {open&&results.length>0&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,background:'white',borderRadius:8,border:'1px solid #e2e8f0',boxShadow:'0 6px 20px rgba(0,0,0,0.15)',zIndex:100,overflow:'hidden',minWidth:280}}>
          <div style={{maxHeight:320,overflowY:'auto'}}>
            {results.map((it,idx)=>(
              <button key={it.id} onClick={()=>pick(it.id)} onMouseEnter={()=>setCursor(idx)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'6px 10px',border:'none',cursor:'pointer',textAlign:'left',background:idx===cursor?'#eff6ff':'transparent',borderBottom:'1px solid #f8fafc'}}>
                <span style={{fontFamily:'monospace',fontSize:11,fontWeight:700,color:'#2563eb',flexShrink:0,minWidth:62}}>{it.key}</span>
                <span style={{fontSize:11,color:'#94a3b8',flexShrink:0}}>–</span>
                <span style={{fontSize:12,color:'#1e293b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.title||'(Untitled)'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOP NAV BAR ─────────────────────────────────────────────────────────────
interface TopNavProps {
  view:              string;
  setView:           (view: string) => void;
  items:             any[];
  onNavItem:         (id: string) => void;
  onCreateNew:       (type: string) => void;
  workItemFilter:    string;
  setWorkItemFilter: (filter: string) => void;
  onNew:             () => void;
  loggedUser:        string;
  tenantName?:       string;
  isAdmin:           boolean;
  features:          TenantFeatures;
  onSignOut:         () => void;
  isViewer?:          boolean;
  onSwitchToAdmin?:   () => void;
  onOpenGlobalAdmin?:  () => void;
  onOpenLocalAdmin?: () => void;
  enabledTypes?:     string[];
  chatOpen?:         boolean;
  onToggleChat?:     () => void;
}

export default function TopNav({
  view, setView, items, onNavItem, onCreateNew,
  workItemFilter, setWorkItemFilter, onNew,
  loggedUser, tenantName, isAdmin, features, onSignOut, isViewer = false, onSwitchToAdmin,
  onOpenGlobalAdmin, onOpenLocalAdmin, enabledTypes, chatOpen = false, onToggleChat,
}: TopNavProps) {
  const ALL_ITEM_TYPES = ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask'];
  const activeTypes = (enabledTypes && enabledTypes.length > 0) ? enabledTypes : ALL_ITEM_TYPES;
  const [wiOpen,     setWiOpen]   = useState(false);
  const [createOpen, setCreate]   = useState(false);
  const [mobileMenuOpen, setMobileMenu] = useState(false);
  const [mobileCreateOpen, setMobileCreate] = useState(false);
  const isWI = view==='workitems';
  const isLV = TYPES.includes(view);

  const { isMobile, w: _rw } = useResponsive();
  const isTablet = _rw < 900;

  const dateStr = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  const navRef = useRef<HTMLElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(navRef.current&&!navRef.current.contains(e.target as Node)){ setWiOpen(false); setCreate(false); setMobileMenu(false); setMobileCreate(false); } };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);

  const NAV_ITEMS = [
    ...(features.kanban    ? [{id:'kanban',    label:'Kanban',     icon:'🗂️'}] : []),
    ...(features.workitems ? [{id:'workitems', label:'Work Items', icon:'📦'}] : []),
    ...(features.create    ? [{id:'create',    label:'Create',     icon:'➕'}] : []),
    ...(features.bot       ? [{id:'bot',       label:'AI Assist',  icon:'🤖'}] : []),
    ...(features.reports   ? [{id:'reports',   label:'Reports',    icon:'📈'}] : []),
    ...(features.ride      ? [{id:'ride',      label:'RiDe Intel', icon:'⚡'}] : []),
  ];

  // FIX: Work Items click → go to workitems view directly (no dropdown)
  // Work Items ARROW click → toggle dropdown
  // Create click → toggle dropdown (unchanged)
  const handleNavClick=(id:string)=>{
    if(id==='kanban'||id==='bot'||id==='reports'||id==='ride'){ setWiOpen(false); setCreate(false); setMobileCreate(false); setView(id); }
    else if(id==='workitems'){ setCreate(false); setMobileCreate(false); setWiOpen(false); setView('workitems'); setWorkItemFilter('all'); }
    else if(id==='create'){ setWiOpen(false); if(!isViewer) setCreate((o:boolean)=>!o); }
  };

  const handleWiArrow=(e:React.MouseEvent)=>{
    e.stopPropagation();
    setCreate(false);
    setWiOpen((o:boolean)=>!o);
  };

  // FIX: Create is never "active" — it's a dropdown trigger only
  const isActive=(id:string)=>{
    if(id==='workitems') return isWI || wiOpen;
    if(id==='create')    return false;   // never highlighted
    return view===id;
  };

  // Colour palette — dark navy
  const NAV_BG        = '#1e3a5f';
  const BREADCRUMB_BG = '#162d4a';
  const TEXT_MAIN     = '#e2eaf4';
  const TEXT_MUTED    = '#8baecf';
  const TEXT_ACTIVE   = '#ffffff';
  const ACTIVE_BG     = 'rgba(255,255,255,0.18)';

  // Avatar for mobile menu button
  const initials = loggedUser.slice(0, 2).toUpperCase();
  const AVATAR_COLORS = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626'];
  let _h = 0; for (let i = 0; i < loggedUser.length; i++) _h = (_h * 31 + loggedUser.charCodeAt(i)) & 0xfffffff;
  const avatarBg = AVATAR_COLORS[_h % AVATAR_COLORS.length];

  return (
    <header ref={navRef} style={{background:NAV_BG,borderBottom:'1px solid #152d4a',boxShadow:'0 2px 8px rgba(0,0,0,0.25)',flexShrink:0,zIndex:40,position:'relative'}}>
      <div style={{display:'flex',alignItems:'center',padding:'0 8px',height:44,gap:2,minWidth:0}}>

        {/* Brand */}
        <div style={{display:'flex',alignItems:'center',gap:7,marginRight:isMobile?4:12,paddingRight:isMobile?4:12,borderRight:`1px solid rgba(255,255,255,0.12)`,flexShrink:0}}>
          <img src={LOGO_SRC} alt='Strat101' style={{width:28,height:28,borderRadius:8,objectFit:'cover',flexShrink:0,boxShadow:'0 2px 6px rgba(0,0,0,0.3)'}}/>
          {!isMobile&&<div>
            <div style={{fontWeight:900,fontSize:14,color:TEXT_ACTIVE,letterSpacing:'-0.3px',lineHeight:1}}>Strat101.com</div>
            <div style={{fontSize:8,color:TEXT_MUTED,letterSpacing:'0.04em',marginTop:1}}>ENABLING TRANSFORMATION JOURNEYS</div>
          </div>}
        </div>

        {/* Desktop nav */}
        {!isMobile&&<nav style={{display:'flex',alignItems:'center',gap:1,flex:1,minWidth:0,overflow:'visible'}}>
          {NAV_ITEMS.map(n=>(
            <div key={n.id} style={{position:'relative',flexShrink:0}}>
              <button
                onClick={()=>handleNavClick(n.id)}
                style={{
                  display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:6,border:'none',cursor:'pointer',
                  fontSize:isTablet?11:12,fontWeight:isActive(n.id)?700:500,
                  background:isActive(n.id)?ACTIVE_BG:'transparent',
                  color:isActive(n.id)?TEXT_ACTIVE:TEXT_MAIN,
                  transition:'all 0.15s',whiteSpace:'nowrap',
                  borderBottom:isActive(n.id)?`2px solid rgba(255,255,255,0.6)`:'2px solid transparent',
                  borderBottomLeftRadius:0,borderBottomRightRadius:0,
                }}>
                <span style={{fontSize:13}}>{n.icon}</span>
                {!isTablet&&<span>{n.label}</span>}
                {isTablet&&<span style={{fontSize:10,fontWeight:600}}>{n.label.split(' ')[0]}</span>}
                {n.id==='workitems'&&(
                  <span onClick={handleWiArrow} title="Filter by type"
                    style={{fontSize:10,opacity:0.7,marginLeft:1,lineHeight:1,padding:'1px 2px',borderRadius:3,cursor:'pointer'}}
                    onMouseEnter={e=>(e.currentTarget.style.opacity='1')}
                    onMouseLeave={e=>(e.currentTarget.style.opacity='0.7')}>
                    {wiOpen?'▴':'▾'}
                  </span>
                )}
                {n.id==='create'&&(
                  <span style={{fontSize:10,opacity:0.7,marginLeft:1}}>{createOpen?'▴':'▾'}</span>
                )}
              </button>

              {/* Work Items dropdown */}
              {n.id==='workitems'&&wiOpen&&(
                <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,background:'white',borderRadius:12,border:'1px solid #e2e8f0',boxShadow:'0 8px 24px rgba(0,0,0,0.12)',padding:8,minWidth:210,zIndex:50}}>
                  <div style={{padding:'4px 8px 6px',fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'0.06em',textTransform:'uppercase'}}>Filter by type</div>
                  <button onClick={()=>{setWorkItemFilter('all');setWiOpen(false);setView('workitems');}} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',background:workItemFilter==='all'&&isWI?'#eff6ff':'transparent',color:workItemFilter==='all'&&isWI?'#1d4ed8':'#374151',fontSize:12,fontWeight:workItemFilter==='all'&&isWI?600:400}}>
                    <span style={{fontSize:14}}>📦</span><span style={{flex:1}}>All Work Items</span>
                    <span style={{fontSize:10,background:'#f1f5f9',borderRadius:999,padding:'1px 6px',color:'#64748b'}}>{items.length}</span>
                  </button>
                  <div style={{height:1,background:'#f1f5f9',margin:'4px 0'}}/>
                  {WORK_ITEM_TYPES.filter(t => activeTypes.includes(t)).map(t=>(
                    <React.Fragment key={t}>
                      {t==='kr'&&<div style={{height:1,background:'#e2e8f0',margin:'4px 8px'}}/>}
                      <button onClick={()=>{setWorkItemFilter(t);setWiOpen(false);setView('workitems');}} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',background:workItemFilter===t&&isWI?'#eff6ff':'transparent',color:workItemFilter===t&&isWI?'#1d4ed8':'#374151',fontSize:12,fontWeight:workItemFilter===t&&isWI?600:400}}>
                        <span style={{fontSize:14}}>{TC[t].i}</span><span style={{flex:1}}>{TC[t].l}</span>
                        <span style={{fontSize:10,background:'#f1f5f9',borderRadius:999,padding:'1px 6px',color:'#64748b'}}>{items.filter(i=>i.type===t).length}</span>
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Create dropdown */}
              {n.id==='create'&&createOpen&&!isViewer&&(
                <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,background:'white',borderRadius:12,border:'1px solid #e2e8f0',boxShadow:'0 8px 24px rgba(0,0,0,0.12)',padding:8,minWidth:200,zIndex:50}}>
                  <div style={{padding:'4px 8px 6px',fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'0.06em',textTransform:'uppercase'}}>Create new</div>
                  {WORK_ITEM_TYPES.filter(t => activeTypes.includes(t)).map(t=>(
                    <React.Fragment key={t}>
                      {t==='kr'&&<div style={{height:1,background:'#e2e8f0',margin:'4px 8px'}}/>}
                      <button onClick={()=>{onCreateNew(t);setCreate(false);}} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',background:'transparent',color:'#374151',fontSize:12,fontWeight:400,transition:'background 0.1s'}}
                        onMouseEnter={e=>e.currentTarget.style.background=t==='kr'?'#f0f9ff':'#f0fdf4'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <span style={{fontSize:14}}>{TC[t].i}</span><span style={{flex:1}}>{TC[t].l}</span>
                        <span style={{fontSize:13,color:t==='kr'?'#0284c7':'#16a34a',fontWeight:700}}>＋</span>
                      </button>
                    </React.Fragment>
                  ))}
                  {features.ride&&(<>
                    <div style={{height:1,background:'#e2e8f0',margin:'6px 4px'}}/>
                    <div style={{padding:'3px 8px 4px',fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'0.06em',textTransform:'uppercase'}}>RiDe Intel</div>
                    {([['risk','⚡','Risk','#fef2f2','#dc2626'],['decision','🎯','Decision','#eef2ff','#6366f1']] as const).map(([t,ic,lb,bg,col])=>(
                      <button key={t} onClick={()=>{onCreateNew(t);setCreate(false);}}
                        style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',background:'transparent',color:'#374151',fontSize:12,fontWeight:400,transition:'background 0.1s'}}
                        onMouseEnter={e=>e.currentTarget.style.background=bg}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <span style={{fontSize:14}}>{ic}</span>
                        <span style={{flex:1}}>{lb}</span>
                        <span style={{fontSize:13,color:col,fontWeight:700}}>＋</span>
                      </button>
                    ))}
                  </>)}
                </div>
              )}
            </div>
          ))}
        </nav>}

        {/* ── MOBILE NAV: icon tabs ── */}
        {isMobile&&(
          <nav style={{display:'flex',alignItems:'center',flex:1,minWidth:0,overflowX:'auto',gap:0}}>
            {NAV_ITEMS.map(n=>(
              <button key={n.id}
                onClick={()=>{ if(n.id==='create'){if(!isViewer){setMobileCreate(o=>!o);setMobileMenu(false);}}else{handleNavClick(n.id);setMobileMenu(false);setMobileCreate(false);} }}
                style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                  padding:'4px 10px',borderRadius:6,border:'none',cursor:'pointer',gap:1,flexShrink:0,
                  background:isActive(n.id)?ACTIVE_BG:'transparent',transition:'all 0.15s',
                  minWidth:44,minHeight:40}}>
                <span style={{fontSize:18}}>{n.icon}</span>
                <span style={{fontSize:8,fontWeight:isActive(n.id)?700:500,color:isActive(n.id)?TEXT_ACTIVE:TEXT_MAIN,lineHeight:1,whiteSpace:'nowrap'}}>{n.label.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
        )}

        {/* ── RIGHT CONTROLS — desktop/tablet ── */}
        {!isMobile&&(
          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0,paddingLeft:8,borderLeft:'1px solid rgba(255,255,255,0.12)'}}>
            {features.chat&&onToggleChat&&(
              <button onClick={onToggleChat} title={chatOpen?'Close Chat':'Open Chat'}
                style={{display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:6,border:'none',
                  background:chatOpen?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.1)',
                  color:chatOpen?'white':'rgba(255,255,255,0.75)',fontSize:11,fontWeight:600,cursor:'pointer',
                  outline:chatOpen?'1px solid rgba(255,255,255,0.3)':'none',transition:'all 0.15s',whiteSpace:'nowrap'}}>
                💬 {chatOpen?'Close':'Chat'}
              </button>
            )}
            <InlineSearch items={items} onNav={onNavItem}/>
            {!isTablet&&<div style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,fontSize:11,color:TEXT_MAIN,fontWeight:500,whiteSpace:'nowrap'}}>
              <span style={{fontSize:11}}>📅</span>{dateStr}
            </div>}
            {onOpenGlobalAdmin&&(
              <button onClick={onOpenGlobalAdmin} title="Global Admin"
                style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#2563eb,#4f46e5)',color:'white',fontSize:11,fontWeight:700,cursor:'pointer',boxShadow:'0 2px 6px rgba(37,99,235,0.5)',whiteSpace:'nowrap'}}>
                ⚡ {!isTablet&&'Global '}Admin
              </button>
            )}
            {onOpenLocalAdmin&&(
              <button onClick={onOpenLocalAdmin} title="Local Admin"
                style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#0284c7,#0369a1)',color:'white',fontSize:11,fontWeight:700,cursor:'pointer',boxShadow:'0 2px 6px rgba(2,132,199,0.5)',whiteSpace:'nowrap'}}>
                🏢 {!isTablet&&'Local '}Admin
              </button>
            )}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
              <span style={{fontSize:10,color:TEXT_MUTED,fontWeight:600}}>{loggedUser}</span>
              <button onClick={onSignOut} title="Sign out"
                style={{display:'flex',alignItems:'center',padding:'3px 10px',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:5,cursor:'pointer',fontSize:10,fontWeight:700,color:'#f87171',transition:'background 0.15s',whiteSpace:'nowrap'}}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.2)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.1)';}}>
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* ── RIGHT CONTROLS — mobile: avatar → dropdown ── */}
        {isMobile&&(
          <div style={{position:'relative',flexShrink:0}}>
            <button onClick={()=>{setMobileMenu(o=>!o);setMobileCreate(false);}}
              style={{width:34,height:34,borderRadius:17,background:avatarBg,border:'2px solid rgba(255,255,255,0.25)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>
              {initials}
            </button>
            {mobileMenuOpen&&(
              <div style={{position:'fixed',top:'calc(44px + env(safe-area-inset-top, 0px))',right:8,background:'white',borderRadius:14,border:'1px solid #e2e8f0',boxShadow:'0 8px 32px rgba(0,0,0,0.18)',padding:8,minWidth:220,zIndex:100,maxHeight:'80vh',overflowY:'auto'}}>
                {/* User info */}
                <div style={{padding:'6px 12px 10px',display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,borderRadius:18,background:avatarBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'white',flexShrink:0}}>{initials}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'#1e293b'}}>{loggedUser}</div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>{tenantName||'Strat101.com'}</div>
                  </div>
                </div>
                <div style={{height:1,background:'#f1f5f9',margin:'0 0 6px'}}/>
                {/* Chat toggle — shown when feat_chat enabled */}
                {features.chat&&onToggleChat&&(
                  <button onClick={()=>{onToggleChat();setMobileMenu(false);}}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'11px 12px',border:'none',
                      background:chatOpen?'#eff6ff':'transparent',cursor:'pointer',borderRadius:8,textAlign:'left'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='#eff6ff')}
                    onMouseLeave={e=>(e.currentTarget.style.background=chatOpen?'#eff6ff':'transparent')}>
                    <span style={{fontSize:18}}>💬</span>
                    <span style={{fontSize:13,fontWeight:600,color:'#0F2744'}}>{chatOpen?'Close Chat':'Team Chat'}</span>
                  </button>
                )}
                {/* Admin options — shown only to admins */}
                {onOpenGlobalAdmin&&(
                  <button onClick={()=>{onOpenGlobalAdmin!();setMobileMenu(false);}}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'11px 12px',border:'none',background:'transparent',cursor:'pointer',borderRadius:8,textAlign:'left'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='#eff6ff')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <span style={{fontSize:18}}>⚡</span>
                    <span style={{fontSize:13,fontWeight:600,color:'#2563eb'}}>Global Admin</span>
                  </button>
                )}
                {onOpenLocalAdmin&&(
                  <button onClick={()=>{onOpenLocalAdmin!();setMobileMenu(false);}}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'11px 12px',border:'none',background:'transparent',cursor:'pointer',borderRadius:8,textAlign:'left'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='#f0f9ff')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <span style={{fontSize:18}}>🏢</span>
                    <span style={{fontSize:13,fontWeight:600,color:'#0284c7'}}>Local Admin</span>
                  </button>
                )}
                {(onOpenGlobalAdmin||onOpenLocalAdmin)&&<div style={{height:1,background:'#f1f5f9',margin:'6px 0'}}/>}
                {/* Sign out — all roles */}
                <button onClick={()=>{setMobileMenu(false);onSignOut();}}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'11px 12px',border:'none',background:'transparent',cursor:'pointer',borderRadius:8,textAlign:'left'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='#fef2f2')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <span style={{fontSize:18}}>🚪</span>
                  <span style={{fontSize:13,fontWeight:600,color:'#dc2626'}}>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MOBILE CREATE SHEET — bottom sheet, separate from avatar menu ── */}
        {isMobile&&mobileCreateOpen&&!isViewer&&(
          <>
            {/* Backdrop */}
            <div onClick={()=>setMobileCreate(false)}
              style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:90}}/>
            {/* Sheet */}
            <div style={{position:'fixed',bottom:0,left:0,right:0,background:'white',
              borderRadius:'16px 16px 0 0',zIndex:91,
              maxHeight:'70vh',display:'flex',flexDirection:'column',overflow:'hidden',
              boxShadow:'0 -4px 32px rgba(0,0,0,0.2)'}}>
              {/* Handle */}
              <div style={{display:'flex',justifyContent:'center',padding:'10px 0 4px'}}>
                <div style={{width:36,height:4,borderRadius:2,background:'#e2e8f0'}}/>
              </div>
              <div style={{padding:'4px 16px 10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontSize:14,fontWeight:700,color:'#0F2744'}}>➕ Create new</div>
                <button onClick={()=>setMobileCreate(false)}
                  style={{background:'none',border:'none',fontSize:18,color:'#94a3b8',cursor:'pointer',padding:'4px 8px'}}>×</button>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'0 8px',paddingBottom:'calc(env(safe-area-inset-bottom, 0px) + 24px)'}}>
                {WORK_ITEM_TYPES.filter((t:string)=>activeTypes.includes(t)).map((t:string)=>(
                  <button key={t} onClick={()=>{onCreateNew(t);setMobileCreate(false);}}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:12,
                      padding:'13px 12px',border:'none',background:'transparent',
                      cursor:'pointer',borderRadius:10,textAlign:'left'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='#f0fdf4')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <span style={{fontSize:22,width:32,textAlign:'center',flexShrink:0}}>{TC[t].i}</span>
                    <span style={{fontSize:14,fontWeight:500,color:'#1e293b',flex:1}}>{TC[t].l}</span>
                    <span style={{fontSize:18,color:'#16a34a',fontWeight:700}}>＋</span>
                  </button>
                ))}
                {features.ride&&(<>
                  <div style={{height:1,background:'#f1f5f9',margin:'6px 8px'}}/>
                  <div style={{padding:'4px 12px 6px',fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em'}}>RiDe Intel</div>
                  {([['risk','⚡','Risk','#dc2626'],['decision','🎯','Decision','#6366f1']] as const).map(([t,ic,lb,col])=>(
                    <button key={t} onClick={()=>{onCreateNew(t);setMobileCreate(false);}}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:12,
                        padding:'13px 12px',border:'none',background:'transparent',
                        cursor:'pointer',borderRadius:10,textAlign:'left'}}
                      onMouseEnter={e=>(e.currentTarget.style.background='#f8f7ff')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <span style={{fontSize:22,width:32,textAlign:'center',flexShrink:0}}>{ic}</span>
                      <span style={{fontSize:14,fontWeight:500,color:'#1e293b',flex:1}}>{lb}</span>
                      <span style={{fontSize:18,color:col,fontWeight:700}}>＋</span>
                    </button>
                  ))}
                </>)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Breadcrumb strip */}
      <div style={{background:BREADCRUMB_BG,borderTop:'1px solid rgba(255,255,255,0.06)',padding:'3px 14px',display:'flex',alignItems:'center',gap:6,minWidth:0,overflow:'hidden'}}>
        {!isMobile&&<><span style={{fontSize:11,color:TEXT_MUTED,flexShrink:0}}>{tenantName||'Strat101.com'}</span>
        <span style={{fontSize:11,color:TEXT_MUTED,flexShrink:0}}>›</span></>}
        <span style={{fontSize:11,fontWeight:600,color:TEXT_ACTIVE,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {view==='kanban'?'🗂️ Kanban Board':view==='reports'?'📈 Report Builder':view==='bot'?'🤖 AI Assist':view==='ride'?'⚡ RiDe Intel':isWI?(workItemFilter==='all'?'📦 All Work Items':`${TC[workItemFilter]?.i||''} ${TC[workItemFilter]?.l||''}s`.trim()):(TC[view]?.i&&TC[view]?.l)?`${TC[view].i} ${TC[view].l}s`:view}
        </span>
        {(isLV||isWI)&&!isMobile&&(
          <>
            <span style={{fontSize:11,color:TEXT_MUTED,flexShrink:0}}>|</span>
            <span style={{fontSize:11,color:TEXT_MUTED,fontWeight:500,flexShrink:0}}>
              {isLV?items.filter(i=>i.type===view).length:workItemFilter==='all'?items.length:items.filter(i=>i.type===workItemFilter).length} items
            </span>
          </>
        )}
        {isLV&&(
          <button onClick={onNew} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:4,padding:'3px 10px',background:'rgba(37,99,235,0.7)',color:'white',border:'1px solid rgba(255,255,255,0.2)',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:600,flexShrink:0,whiteSpace:'nowrap'}}>
            + New {TC[view]?.l}
          </button>
        )}
      </div>
    </header>
  );
}
