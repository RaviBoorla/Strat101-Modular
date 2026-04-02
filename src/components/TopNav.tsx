import React, { useState, useRef, useEffect, useMemo } from "react";
import { TC, TYPES, WORK_ITEM_TYPES } from "../constants";
import { fuzzyScore } from "../utils";
import { TenantFeatures } from "../types";

// ─── INLINE SEARCH ────────────────────────────────────────────────────────────
interface InlineSearchProps {
  items: any[];
  onNav: (id: string) => void;
}

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
      <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 8px',background:'rgba(255,255,255,0.72)',border:'1px solid rgba(0,0,0,0.12)',borderRadius:6,width:200,boxShadow:open?'0 0 0 2px #93c5fd':'none',transition:'box-shadow 0.15s'}}>
        <span style={{fontSize:12,color:'#64748b',flexShrink:0}}>🔍</span>
        <input ref={inputRef} value={q} onChange={e=>{setQ(e.target.value);setCursor(0);setOpen(true);}} onFocus={()=>setOpen(true)} onKeyDown={onKey} placeholder="Search…"
          style={{flex:1,border:'none',outline:'none',background:'transparent',fontSize:12,color:'#1e293b'}}/>
        {q
          ? <button onClick={()=>{setQ('');setOpen(false);}} style={{border:'none',background:'none',cursor:'pointer',color:'#94a3b8',fontSize:13,lineHeight:1,padding:0}}>×</button>
          : <kbd style={{background:'rgba(0,0,0,0.07)',borderRadius:3,padding:'1px 4px',fontSize:9,color:'#64748b',fontFamily:'monospace',flexShrink:0}}>⌘K</kbd>
        }
      </div>
      {open&&results.length>0&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,background:'white',borderRadius:8,border:'1px solid #e2e8f0',boxShadow:'0 6px 20px rgba(0,0,0,0.1)',zIndex:100,overflow:'hidden',minWidth:280}}>
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
  isAdmin:           boolean;   // kept for API compatibility — not used in nav
  features:          TenantFeatures;
  onSignOut:         () => void;
}

export default function TopNav({
  view, setView, items, onNavItem, onCreateNew,
  workItemFilter, setWorkItemFilter, onNew,
  loggedUser, features, onSignOut,
}: TopNavProps) {
  const [wiOpen,     setWiOpen]   = useState(false);
  const [createOpen, setCreate]   = useState(false);
  const [mobileMenuOpen, setMobileMenu] = useState(false);
  const isWI = view==='workitems';
  const isLV = TYPES.includes(view);

  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<640);
  const [isTablet, setIsTablet] = useState(()=>window.innerWidth<900);
  useEffect(()=>{
    const onResize=()=>{ setIsMobile(window.innerWidth<640); setIsTablet(window.innerWidth<900); };
    window.addEventListener('resize',onResize);
    return ()=>window.removeEventListener('resize',onResize);
  },[]);

  const dateStr = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

  const navRef = useRef<HTMLElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(navRef.current&&!navRef.current.contains(e.target as Node)){ setWiOpen(false); setCreate(false); setMobileMenu(false); } };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);

  // Only show enabled feature modules — no Admin button here
  const NAV_ITEMS = [
    ...(features.kanban    ? [{id:'kanban',    label:'Kanban',     icon:'🗂️'}] : []),
    ...(features.workitems ? [{id:'workitems', label:'Work Items', icon:'📦'}] : []),
    ...(features.create    ? [{id:'create',    label:'Create',     icon:'➕'}] : []),
    ...(features.bot       ? [{id:'bot',       label:'AI Assist',  icon:'🤖'}] : []),
    ...(features.reports   ? [{id:'reports',   label:'Reports',    icon:'📈'}] : []),
  ];

  const handleNavClick=(id:string)=>{
    if(id==='kanban'||id==='bot'||id==='reports'){ setWiOpen(false); setCreate(false); setView(id); }
    else if(id==='workitems'){ setCreate(false); setWiOpen((o:boolean)=>!o); setView('workitems'); setWorkItemFilter('all'); }
    else if(id==='create'){ setWiOpen(false); setCreate((o:boolean)=>!o); }
  };

  const isActive=(id:string)=>{
    if(id==='workitems') return isWI;
    if(id==='create')    return createOpen;
    return view===id;
  };

  const initials = loggedUser.slice(0,2).toUpperCase();

  return (
    <header ref={navRef} style={{background:'#a3bbff',borderBottom:'1px solid #7a9ee8',boxShadow:'0 1px 4px rgba(0,80,140,0.12)',flexShrink:0,zIndex:40,position:'relative'}}>
      <div style={{display:'flex',alignItems:'center',padding:'0 12px',height:44,gap:2}}>

        {/* Brand */}
        <div style={{display:'flex',alignItems:'center',gap:7,marginRight:isMobile?6:12,paddingRight:isMobile?6:12,borderRight:'1px solid rgba(0,60,120,0.2)'}}>
          <div style={{width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#2563eb,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:11,letterSpacing:'-0.5px',flexShrink:0,boxShadow:'0 2px 6px rgba(37,99,235,0.3)'}}>SA</div>
          {!isMobile&&<div>
            <div style={{fontWeight:900,fontSize:14,color:'#0c2d4a',letterSpacing:'-0.3px',lineHeight:1}}>Strat101.com</div>
            <div style={{fontSize:8,color:'#1a5276',letterSpacing:'0.04em',marginTop:1}}>ENABLING TRANSFORMATION JOURNEYS</div>
          </div>}
        </div>

        {/* Desktop nav */}
        {!isMobile&&<nav style={{display:'flex',alignItems:'center',gap:2,flex:1}}>
          {NAV_ITEMS.map(n=>(
            <div key={n.id} style={{position:'relative'}}>
              <button onClick={()=>handleNavClick(n.id)} style={{
                display:'flex',alignItems:'center',gap:4,padding:'5px 8px',borderRadius:6,border:'none',cursor:'pointer',
                fontSize:isTablet?11:13,fontWeight:isActive(n.id)?700:500,
                background:isActive(n.id)?'rgba(255,255,255,0.45)':'transparent',
                color:isActive(n.id)?'#0c2d4a':'#0e4166',
                transition:'all 0.15s',
                borderBottom:isActive(n.id)&&n.id!=='create'?'2px solid #0c3d6e':'2px solid transparent',
                borderBottomLeftRadius:0,borderBottomRightRadius:0,
                ...(n.id==='create'?{background:createOpen?'rgba(255,255,255,0.55)':'rgba(255,255,255,0.3)',color:createOpen?'#0a3d1f':'#0c2d4a',border:'1px solid',borderColor:createOpen?'rgba(0,100,40,0.35)':'rgba(0,60,120,0.2)',borderRadius:6,marginLeft:4}:{}),
              }}>
                <span style={{fontSize:13}}>{n.icon}</span>
                {!isTablet&&<span>{n.label}</span>}
                {isTablet&&<span style={{fontSize:10,fontWeight:600}}>{n.label.split(' ')[0]}</span>}
                {(n.id==='workitems'||n.id==='create')&&(
                  <span style={{fontSize:22,opacity:0.85,marginLeft:2,lineHeight:1}}>
                    {n.id==='workitems'?wiOpen?'▴':'▾':createOpen?'▴':'▾'}
                  </span>
                )}
              </button>

              {/* Work Items dropdown */}
              {n.id==='workitems'&&wiOpen&&(
                <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,background:'white',borderRadius:12,border:'1px solid #e2e8f0',boxShadow:'0 8px 24px rgba(0,0,0,0.1)',padding:8,minWidth:210,zIndex:50}}>
                  <div style={{padding:'4px 8px 6px',fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'0.06em',textTransform:'uppercase'}}>Filter by type</div>
                  <button onClick={()=>{setWorkItemFilter('all');setWiOpen(false);setView('workitems');}} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,border:'none',cursor:'pointer',textAlign:'left',background:workItemFilter==='all'&&isWI?'#eff6ff':'transparent',color:workItemFilter==='all'&&isWI?'#1d4ed8':'#374151',fontSize:12,fontWeight:workItemFilter==='all'&&isWI?600:400}}>
                    <span style={{fontSize:14}}>📦</span><span style={{flex:1}}>All Work Items</span>
                    <span style={{fontSize:10,background:'#f1f5f9',borderRadius:999,padding:'1px 6px',color:'#64748b'}}>{items.length}</span>
                  </button>
                  <div style={{height:1,background:'#f1f5f9',margin:'4px 0'}}/>
                  {WORK_ITEM_TYPES.map(t=>(
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
              {n.id==='create'&&createOpen&&(
                <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,background:'white',borderRadius:12,border:'1px solid #e2e8f0',boxShadow:'0 8px 24px rgba(0,0,0,0.1)',padding:8,minWidth:200,zIndex:50}}>
                  <div style={{padding:'4px 8px 6px',fontSize:10,fontWeight:700,color:'#94a3b8',letterSpacing:'0.06em',textTransform:'uppercase'}}>Create new</div>
                  {WORK_ITEM_TYPES.map(t=>(
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
                </div>
              )}
            </div>
          ))}
        </nav>}

        {/* Mobile nav */}
        {isMobile&&<nav style={{display:'flex',alignItems:'center',gap:1,flex:1}}>
          {NAV_ITEMS.map(n=>(
            <div key={n.id} style={{position:'relative'}}>
              <button onClick={()=>{handleNavClick(n.id);setMobileMenu(false);}} style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'4px 8px',borderRadius:6,border:'none',cursor:'pointer',gap:2,background:isActive(n.id)?'rgba(255,255,255,0.45)':'transparent',transition:'all 0.15s'}}>
                <span style={{fontSize:16}}>{n.icon}</span>
                <span style={{fontSize:8,fontWeight:isActive(n.id)?700:500,color:isActive(n.id)?'#0c2d4a':'#0e4166',lineHeight:1}}>{n.label.split(' ')[0]}</span>
              </button>
            </div>
          ))}
        </nav>}

        {/* Right controls */}
        <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto',paddingLeft:10,borderLeft:'1px solid rgba(0,60,120,0.2)'}}>
          <InlineSearch items={items} onNav={onNavItem}/>
          {!isTablet&&<div style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',background:'rgba(255,255,255,0.45)',border:'1px solid rgba(0,60,120,0.18)',borderRadius:6,fontSize:11,color:'#0c2d4a',fontWeight:600,whiteSpace:'nowrap'}}>
            <span style={{fontSize:11}}>📅</span>{dateStr}
          </div>}
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <button
              onClick={onSignOut}
              title="Sign out"
              style={{display:'flex',alignItems:'center',gap:5,padding:'3px 8px 3px 4px',background:'rgba(255,255,255,0.45)',border:'1px solid rgba(0,60,120,0.18)',borderRadius:14,cursor:'pointer',transition:'background 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.7)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.45)';}}>
              <div style={{width:22,height:22,borderRadius:'50%',background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:10,letterSpacing:'0.5px',flexShrink:0}}>
                {initials}
              </div>
              <div style={{lineHeight:1}}>
                <div style={{fontSize:11,fontWeight:700,color:'#0c2d4a'}}>{loggedUser}</div>
                <div style={{fontSize:9,color:'#dc2626',fontWeight:600}}>Sign out</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb strip */}
      <div style={{background:'#8ca8f0',borderTop:'1px solid #7a9ee8',padding:'3px 14px',display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:11,color:'#0c3d6e'}}>Strat101.com</span>
        <span style={{fontSize:11,color:'#0e5280'}}>›</span>
        <span style={{fontSize:11,fontWeight:600,color:'#051e36'}}>
          {view==='kanban'?'🗂️ Kanban Board':view==='reports'?'📈 Report Builder':view==='bot'?'🤖 AI Assist':isWI?(workItemFilter==='all'?'📦 All Work Items':`${TC[workItemFilter]?.i} ${TC[workItemFilter]?.l}s`):`${TC[view]?.i} ${TC[view]?.l}s`}
        </span>
        {(isLV||isWI)&&(
          <>
            <span style={{fontSize:11,color:'#0e5280'}}>·</span>
            <span style={{fontSize:11,color:'#0c3d6e',fontWeight:500}}>
              {isLV?items.filter(i=>i.type===view).length:workItemFilter==='all'?items.length:items.filter(i=>i.type===workItemFilter).length} items
            </span>
          </>
        )}
        {isLV&&(
          <button onClick={onNew} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:4,padding:'3px 10px',background:'#1a5276',color:'white',border:'none',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:600}}>
            + New {TC[view]?.l}
          </button>
        )}
      </div>
    </header>
  );
}
