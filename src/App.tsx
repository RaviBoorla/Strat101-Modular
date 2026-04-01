import React, { useState, useRef, useEffect } from "react";

// ─── Constants & Utils ────────────────────────────────────────────────────────
import { TYPES } from "./constants";
import { mkBlank, gId, tsNow, td } from "./utils";
import { TenantFeatures, Tenant } from "./types";
import { isAdminUser, DEFAULT_TENANTS } from "./adminData";

// ─── Modules ──────────────────────────────────────────────────────────────────
import LoginScreen   from "./modules/Login/LoginScreen";
import BotPanel      from "./modules/AiAssist/BotPanel";
import WorkItemsView, { ListView } from "./modules/WorkItems/WorkItemsView";
import KanbanBoard   from "./modules/Kanban/KanbanBoard";
import ItemForm, { LinkDlg } from "./modules/Create/ItemForm";
import ReportBuilder from "./modules/Reports/ReportBuilder";
import AdminPanel    from "./modules/Admin/AdminPanel";

// ─── Components ───────────────────────────────────────────────────────────────
import TopNav         from "./components/TopNav";
import DetailPanel    from "./components/DetailPanel";
import CommandPalette from "./components/CommandPalette";

// ─── ALL FEATURES ON (default for non-admin users) ────────────────────────────
const ALL_FEATURES: TenantFeatures = {
  kanban: true, workitems: true, create: true, bot: true, reports: true,
};

// ─── TENANT APP PREVIEW BANNER ────────────────────────────────────────────────
function PreviewBanner({ tenant, onExit }: { tenant: Tenant; onExit: () => void }) {
  return (
    <div style={{ background:'#fef3c7', borderBottom:'2px solid #f59e0b', padding:'6px 16px', display:'flex', alignItems:'center', gap:10, flexShrink:0, zIndex:50 }}>
      <span style={{ fontSize:14 }}>👁️</span>
      <span style={{ fontSize:12, fontWeight:600, color:'#92400e' }}>
        Previewing: <strong>{tenant.name}</strong>
        &nbsp;·&nbsp;
        {Object.entries(tenant.features).filter(([,v])=>v).map(([k])=>k).join(', ')} enabled
      </span>
      <button onClick={onExit} style={{ marginLeft:'auto', padding:'4px 12px', borderRadius:6, border:'1px solid #f59e0b', background:'white', color:'#92400e', fontSize:11, fontWeight:700, cursor:'pointer' }}>
        ← Back to Admin
      </button>
    </div>
  );
}

// ─── WORKSPACE (the main app for any logged-in user) ─────────────────────────
function Workspace({ loggedUser, isAdmin, features, previewTenant, onExitPreview }: {
  loggedUser:     string;
  isAdmin:        boolean;
  features:       TenantFeatures;
  previewTenant:  Tenant | null;
  onExitPreview:  () => void;
}) {
  const [items, setItems]        = useState<any[]>([]);
  const [view,  setView]         = useState('kanban');
  const [workItemFilter, setWIF] = useState('all');
  const [sel,   setSel]          = useState<string|null>(null);
  const [dtab,  setDtab]         = useState('overview');
  const [form,  setForm]         = useState<any>(null);
  const [linkDlg, setLinkDlg]   = useState<string|null>(null);
  const [linkQ,   setLinkQ]     = useState('');
  const [cmdOpen, setCmdOpen]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected    = items.find(i=>i.id===sel);
  const isListView  = TYPES.includes(view);
  const isWorkItems = view==='workitems';

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{ if(e.key==='Escape') setCmdOpen(false); };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[]);

  // Reset view when features change (e.g. switching preview tenant)
  useEffect(()=>{
    setView('kanban'); setSel(null);
  },[features]);

  const LOGGED_IN  = loggedUser||'RB';
  const stamp      = (it:any)=>({...it, updatedAt:tsNow(), updatedBy:LOGGED_IN});
  const liveUpsert = (it:any)=>{ const s=stamp(it); setItems(p=>p.some(x=>x.id===s.id)?p.map(x=>x.id===s.id?s:x):[...p,s]); };
  const upsert     = (it:any)=>{ const s=stamp(it); setItems(p=>p.some(x=>x.id===s.id)?p.map(x=>x.id===s.id?s:x):[...p,s]); setForm(null); setSel(s.id); if(isListView||view==='kanban') setView(s.type); };
  const remove     = (id:string)=>{ setItems(p=>p.filter(i=>i.id!==id).map(i=>({...i,links:i.links.filter((l:string)=>l!==id),dependencies:i.dependencies.filter((d:string)=>d!==id)}))); if(sel===id) setSel(null); };
  const changeStatus = (id:string,status:string)=>setItems(p=>p.map(i=>i.id===id?stamp({...i,status}):i));
  const changeField  = (id:string,field:string,value:any)=>setItems(p=>p.map(i=>i.id===id?stamp({...i,[field]:value}):i));

  const addLink=(toId:string)=>{
    if(!sel||toId===sel) return;
    setItems(p=>p.map(i=>{
      if(i.id===sel&&!i.links.includes(toId)) return stamp({...i,links:[...i.links,toId]});
      if(i.id===toId&&!i.links.includes(sel)) return stamp({...i,links:[...i.links,sel]});
      return i;
    }));
    setLinkDlg(null);
  };
  const rmLink  = (lid:string)=>setItems(p=>p.map(i=>{ if(i.id===sel) return stamp({...i,links:i.links.filter((l:string)=>l!==lid)}); if(i.id===lid) return stamp({...i,links:i.links.filter((l:string)=>l!==sel)}); return i; }));
  const addDep  = (toId:string)=>{ if(!sel||toId===sel) return; setItems(p=>p.map(i=>i.id===sel&&!i.dependencies.includes(toId)?stamp({...i,dependencies:[...i.dependencies,toId]}):i)); setLinkDlg(null); };
  const rmDep   = (did:string)=>setItems(p=>p.map(i=>i.id===sel?stamp({...i,dependencies:i.dependencies.filter((d:string)=>d!==did)}):i));

  const MAX_ATTACHMENT_BYTES=10*1024*1024;
  const addFile=(f:File)=>{
    if(!f||!sel) return;
    if(f.size>MAX_ATTACHMENT_BYTES){
      const mb=(f.size/1048576).toFixed(1);
      setItems(p=>p.map(i=>i.id===sel?{...i,_uploadError:`"${f.name}" is ${mb} MB — max 10 MB.`}:i));
      setTimeout(()=>setItems(p=>p.map(i=>i.id===sel?{...i,_uploadError:undefined}:i)),6000);
      return;
    }
    setItems(p=>p.map(i=>i.id===sel?stamp({...i,attachments:[...i.attachments,{name:f.name,size:f.size<1048576?Math.round(f.size/1024)+' KB':(f.size/1048576).toFixed(1)+' MB',ext:f.name.split('.').pop()?.toLowerCase()||'',uploadedAt:td()}]}):i));
  };

  const rmFile     = (idx:number)=>setItems(p=>p.map(i=>i.id===sel?stamp({...i,attachments:i.attachments.filter((_:any,j:number)=>j!==idx)}):i));
  const addComment = (text:string)=>{ if(!sel||!text.trim()) return; const c={id:gId(),text:text.trim(),ts:tsNow()}; setItems(p=>p.map(i=>i.id===sel?stamp({...i,comments:[c,...i.comments]}):i)); };
  const rmComment  = (cid:string)=>setItems(p=>p.map(i=>i.id===sel?stamp({...i,comments:i.comments.filter((c:any)=>c.id!==cid)}):i));

  const nav    = (id:string)=>{ const it=items.find(i=>i.id===id); if(it){ setView(it.type); setSel(id); setDtab('overview'); } };
  const goView = (v:string)=>{ setView(v); setSel(null); };
  const createAndOpen=(type:string)=>{ const blank=mkBlank(type,items); setItems(p=>[...p,blank]); setForm({...blank,_autoSave:true}); };

  const disabledView =
    (view==='kanban'   && !features.kanban)   ||
    (view==='reports'  && !features.reports)  ||
    (view==='bot'      && !features.bot)      ||
    (isWorkItems       && !features.workitems);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{fontFamily:'system-ui,sans-serif',fontSize:'13px',background:'#f1f5f9'}}>
      {/* Preview banner shown when admin is previewing a tenant */}
      {previewTenant && <PreviewBanner tenant={previewTenant} onExit={onExitPreview}/>}

      <TopNav view={view} setView={goView} items={items} onNavItem={id=>{nav(id);}}
        onCreateNew={createAndOpen} workItemFilter={workItemFilter} setWorkItemFilter={setWIF}
        onNew={()=>isListView&&setForm(mkBlank(view,items))}
        loggedUser={loggedUser} isAdmin={false} features={features}/>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto">
            {!disabledView ? (
              <>
                {view==='kanban'  && features.kanban    && <KanbanBoard items={items} sel={sel} onSel={id=>{setSel(id);setDtab('overview');}} onNew={t=>setForm(mkBlank(t,items))} onStatusChange={changeStatus} onFieldChange={changeField}/>}
                {view==='reports' && features.reports   && <ReportBuilder items={items}/>}
                {view==='bot'     && features.bot       && <BotPanel items={items}/>}
                {isWorkItems      && features.workitems && <WorkItemsView items={items} sel={sel} onSel={id=>{setSel(id);setDtab('overview');}} filter={workItemFilter}/>}
                {isListView                             && <ListView type={view} items={items.filter(i=>i.type===view)} sel={sel} onSel={id=>{setSel(id);setDtab('overview');}}/>}
              </>
            ) : (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12}}>
                <div style={{fontSize:48}}>🔒</div>
                <div style={{fontSize:15,fontWeight:700,color:'#374151'}}>Module Not Enabled</div>
                <div style={{fontSize:12,color:'#94a3b8',textAlign:'center',maxWidth:300,lineHeight:1.6}}>
                  This module is disabled for this tenant. Enable it in the Admin Console → Features.
                </div>
              </div>
            )}
          </div>
        </div>

        {selected && view!=='bot' && (
          <div style={{position:window.innerWidth<640?'absolute':'relative',inset:window.innerWidth<640?0:'auto',zIndex:window.innerWidth<640?30:1,display:'flex',width:window.innerWidth<640?'100%':'420px',flexShrink:0}}>
            <DetailPanel item={selected} allItems={items} tab={dtab} onTab={setDtab}
              onEdit={()=>setForm({...selected})} onDelete={()=>remove(selected.id)} onClose={()=>setSel(null)}
              onAddLink={()=>{setLinkQ('');setLinkDlg('link');}} onAddDep={()=>{setLinkQ('');setLinkDlg('dep');}}
              onRmLink={rmLink} onRmDep={rmDep} onAddFile={()=>fileRef.current?.click()} onRmFile={rmFile}
              onAddComment={addComment} onRmComment={rmComment} onNav={nav}/>
          </div>
        )}
      </div>

      <footer style={{background:'#a3bbff',borderTop:'1px solid #7a9ee8',padding:'3px 16px',display:'flex',alignItems:'center',justifyContent:'center',gap:12,flexShrink:0}}>
        <span style={{fontSize:11,color:'#0c2d4a',letterSpacing:'0.02em'}}>
          ®Strat101.com  |  ©Copyright 2026. All rights Reserved.  |  Contact: <a href="mailto:Support@Strat101.com" style={{color:'#0c2d4a',textDecoration:'none',fontWeight:600}}>Support@Strat101.com</a>
        </span>
      </footer>

      <input ref={fileRef} type="file" className="hidden" onChange={e=>{if(e.target.files?.[0])addFile(e.target.files[0]);e.target.value='';}}/>
      {form&&<ItemForm item={form} onSave={upsert} onClose={()=>setForm(null)} onAutoSave={form._autoSave?liveUpsert:null}/>}
      {linkDlg&&selected&&<LinkDlg mode={linkDlg} selected={selected} allItems={items} q={linkQ} onQ={setLinkQ} onLink={linkDlg==='link'?addLink:addDep} onClose={()=>setLinkDlg(null)}/>}
      {cmdOpen&&<CommandPalette items={items} onNav={id=>{nav(id);setCmdOpen(false);}} onClose={()=>setCmdOpen(false)}/>}
    </div>
  );
}

// ─── APP MAIN (routing: admin console vs workspace vs preview) ────────────────
function AppMain({ loggedUser }: { loggedUser: string }) {
  const isAdmin = isAdminUser(loggedUser);

  // Admin starts on admin console; regular users go straight to the workspace
  const [screen, setScreen] = useState<'admin'|'workspace'>(isAdmin ? 'admin' : 'workspace');
  const [previewTenant, setPreviewTenant] = useState<Tenant|null>(null);

  // When admin previews a tenant, switch to workspace mode with that tenant's features
  const handlePreview = (tenant: Tenant) => {
    setPreviewTenant(tenant);
    setScreen('workspace');
  };

  const handleExitPreview = () => {
    setPreviewTenant(null);
    setScreen('admin');
  };

  // Feature set: preview tenant's features if in preview, else all-on for workspace
  const features: TenantFeatures = previewTenant ? previewTenant.features : ALL_FEATURES;

  if(screen==='admin') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{fontFamily:'system-ui,sans-serif'}}>
        {/* Minimal admin top bar */}
        <div style={{background:'#1e293b',padding:'0 20px',height:44,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:26,height:26,borderRadius:6,background:'linear-gradient(135deg,#f59e0b,#ef4444)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>⚙️</div>
            <span style={{fontSize:13,fontWeight:700,color:'white',letterSpacing:'-0.2px'}}>Strat101 Admin</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,color:'#94a3b8'}}>Logged in as <strong style={{color:'#fbbf24'}}>{loggedUser}</strong></span>
          </div>
        </div>
        <div style={{flex:1,overflow:'hidden'}}>
          <AdminPanel
            initialTenants={DEFAULT_TENANTS}
            loggedUser={loggedUser}
            onPreviewTenant={handlePreview}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Workspace
        loggedUser={loggedUser}
        isAdmin={isAdmin}
        features={features}
        previewTenant={previewTenant}
        onExitPreview={handleExitPreview}
      />
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn,   setLoggedIn]   = useState(false);
  const [loggedUser, setLoggedUser] = useState('');
  if(!loggedIn) return <LoginScreen onLogin={u=>{ setLoggedIn(true); setLoggedUser(u); }}/>;
  return <AppMain loggedUser={loggedUser}/>;
}
