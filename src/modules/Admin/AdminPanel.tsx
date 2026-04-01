import React, { useState } from "react";
import { Tenant, TenantUser, TenantFeatures, FeatureKey, UserRole } from "../../types";
import { gId, td } from "../../utils";

// ─── FEATURE DEFINITIONS ──────────────────────────────────────────────────────
const FEATURE_DEFS: { key: FeatureKey; label: string; icon: string }[] = [
  { key: 'kanban',    label: 'Kanban',     icon: '🗂️' },
  { key: 'workitems', label: 'Work Items', icon: '📦' },
  { key: 'create',    label: 'Create',     icon: '➕' },
  { key: 'bot',       label: 'AI Assist',  icon: '🤖' },
  { key: 'reports',   label: 'Reports',    icon: '📈' },
];

const PLAN_STYLE: Record<string, { color: string; bg: string }> = {
  enterprise: { color: '#4f46e5', bg: '#eef2ff' },
  pro:        { color: '#0284c7', bg: '#e0f2fe' },
  starter:    { color: '#16a34a', bg: '#dcfce7' },
};

const ROLE_STYLE: Record<UserRole, { color: string; bg: string }> = {
  admin:  { color: '#dc2626', bg: '#fef2f2' },
  editor: { color: '#d97706', bg: '#fffbeb' },
  viewer: { color: '#2563eb', bg: '#eff6ff' },
};

// ─── TINY HELPERS ─────────────────────────────────────────────────────────────
function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999, color, background:bg, whiteSpace:'nowrap', textTransform:'capitalize' }}>{label}</span>;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', background:on?'#2563eb':'#cbd5e1', position:'relative', transition:'background 0.18s', flexShrink:0 }}>
      <span style={{ position:'absolute', top:2, left:on?18:2, width:16, height:16, borderRadius:'50%', background:'white', transition:'left 0.18s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  );
}

const inp: React.CSSProperties = { width:'100%', boxSizing:'border-box', border:'1px solid #e2e8f0', borderRadius:7, padding:'7px 10px', fontSize:12, outline:'none', fontFamily:'system-ui,sans-serif' };
const sel: React.CSSProperties = { ...inp, cursor:'pointer' };

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 460 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:70, background:'rgba(15,23,42,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'white', borderRadius:12, width:'100%', maxWidth:width, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{title}</span>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:18, cursor:'pointer', color:'#94a3b8', lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:16, overflowY:'auto', flex:1 }}>{children}</div>
      </div>
    </div>
  );
}

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── TENANT FORM ──────────────────────────────────────────────────────────────
function TenantForm({ tenant, onSave, onClose }: { tenant: Tenant | null; onSave: (t: Tenant) => void; onClose: () => void }) {
  const [name,   setName]   = useState(tenant?.name   ?? '');
  const [slug,   setSlug]   = useState(tenant?.slug   ?? '');
  const [plan,   setPlan]   = useState<Tenant['plan']>(tenant?.plan ?? 'starter');
  const [active, setActive] = useState(tenant?.active ?? true);

  const save = () => {
    if(!name.trim() || !slug.trim()) return;
    const base = { kanban:true, workitems:true, create:true, bot:true, reports:true };
    const t: Tenant = tenant
      ? { ...tenant, name:name.trim(), slug:slug.trim().toLowerCase(), plan, active }
      : { id:gId(), name:name.trim(), slug:slug.trim().toLowerCase(), plan, active, createdAt:td(), features:base, users:[] };
    onSave(t);
  };

  return (
    <Modal title={tenant ? `Edit — ${tenant.name}` : 'New Tenant'} onClose={onClose}>
      <FL label="Tenant Name"><input value={name} onChange={e=>setName(e.target.value)} style={inp} autoFocus placeholder="e.g. Acme Corporation"/></FL>
      <FL label="Slug">
        <input value={slug} onChange={e=>setSlug(e.target.value.replace(/[^a-z0-9-]/g,''))} style={inp} placeholder="e.g. acme-corp"/>
        <div style={{ fontSize:10, color:'#94a3b8', marginTop:3 }}>Lowercase, numbers and hyphens only</div>
      </FL>
      <FL label="Plan">
        <select value={plan} onChange={e=>setPlan(e.target.value as Tenant['plan'])} style={sel}>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </FL>
      <FL label="Status">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Toggle on={active} onToggle={()=>setActive(a=>!a)}/>
          <span style={{ fontSize:12, color:active?'#16a34a':'#94a3b8', fontWeight:600 }}>{active?'Active':'Inactive'}</span>
        </div>
      </FL>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
        <button onClick={onClose} style={{ padding:'7px 14px', borderRadius:7, border:'1px solid #e2e8f0', background:'white', fontSize:12, cursor:'pointer', color:'#374151' }}>Cancel</button>
        <button onClick={save} disabled={!name.trim()||!slug.trim()} style={{ padding:'7px 14px', borderRadius:7, border:'none', background:'#2563eb', color:'white', fontSize:12, fontWeight:600, cursor:'pointer', opacity:name.trim()&&slug.trim()?1:0.4 }}>
          {tenant ? 'Save' : 'Create Tenant'}
        </button>
      </div>
    </Modal>
  );
}

// ─── USER FORM ────────────────────────────────────────────────────────────────
function UserForm({ user, tenantName, onSave, onClose }: { user: TenantUser | null; tenantName: string; onSave: (u: TenantUser) => void; onClose: () => void }) {
  const [username, setUsername] = useState(user?.username ?? '');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email,    setEmail]    = useState(user?.email    ?? '');
  const [role,     setRole]     = useState<UserRole>(user?.role ?? 'viewer');
  const [active,   setActive]   = useState(user?.active   ?? true);

  const save = () => {
    if(!username.trim()||!fullName.trim()) return;
    const u: TenantUser = user
      ? { ...user, username:username.trim(), fullName:fullName.trim(), email:email.trim(), role, active }
      : { id:gId(), username:username.trim(), fullName:fullName.trim(), email:email.trim(), role, active, createdAt:td() };
    onSave(u);
  };

  return (
    <Modal title={user ? `Edit — ${user.fullName}` : `New User · ${tenantName}`} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <FL label="Username"><input value={username} onChange={e=>setUsername(e.target.value)} style={inp} autoFocus placeholder="e.g. john.doe"/></FL>
        <FL label="Full Name"><input value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} placeholder="e.g. John Doe"/></FL>
      </div>
      <FL label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} placeholder="e.g. john@company.com"/></FL>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <FL label="Role">
          <select value={role} onChange={e=>setRole(e.target.value as UserRole)} style={sel}>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </FL>
        <FL label="Status">
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
            <Toggle on={active} onToggle={()=>setActive(a=>!a)}/>
            <span style={{ fontSize:12, color:active?'#16a34a':'#94a3b8', fontWeight:600 }}>{active?'Active':'Inactive'}</span>
          </div>
        </FL>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
        <button onClick={onClose} style={{ padding:'7px 14px', borderRadius:7, border:'1px solid #e2e8f0', background:'white', fontSize:12, cursor:'pointer', color:'#374151' }}>Cancel</button>
        <button onClick={save} disabled={!username.trim()||!fullName.trim()} style={{ padding:'7px 14px', borderRadius:7, border:'none', background:'#2563eb', color:'white', fontSize:12, fontWeight:600, cursor:'pointer', opacity:username.trim()&&fullName.trim()?1:0.4 }}>
          {user ? 'Save' : 'Add User'}
        </button>
      </div>
    </Modal>
  );
}

// ─── TENANT ROW ───────────────────────────────────────────────────────────────
function TenantRow({ tenant, onEdit, onToggleActive, onPreview, onManage }:
  { tenant: Tenant; onEdit: () => void; onToggleActive: () => void; onPreview: () => void; onManage: () => void }) {
  const ps = PLAN_STYLE[tenant.plan];
  const enabledCount = FEATURE_DEFS.filter(f => tenant.features[f.key]).length;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:10, border:'1px solid #e2e8f0', background:tenant.active?'white':'#f8fafc', opacity:tenant.active?1:0.72 }}>
      {/* Status dot */}
      <div style={{ width:8, height:8, borderRadius:'50%', background:tenant.active?'#22c55e':'#cbd5e1', flexShrink:0 }}/>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{tenant.name}</span>
          <Pill label={tenant.plan} color={ps.color} bg={ps.bg}/>
          {!tenant.active && <Pill label="Suspended" color="#94a3b8" bg="#f1f5f9"/>}
        </div>
        <div style={{ fontSize:11, color:'#94a3b8' }}>
          <code style={{ fontFamily:'monospace', background:'#f1f5f9', padding:'0px 4px', borderRadius:3, fontSize:10 }}>{tenant.slug}</code>
          &nbsp;·&nbsp;{tenant.users.length} user{tenant.users.length!==1?'s':''}
          &nbsp;·&nbsp;{enabledCount}/{FEATURE_DEFS.length} modules on
          &nbsp;·&nbsp;since {tenant.createdAt}
        </div>
      </div>

      {/* Feature dots */}
      <div style={{ display:'flex', gap:3, flexShrink:0 }}>
        {FEATURE_DEFS.map(fd => (
          <span key={fd.key} title={`${fd.label}: ${tenant.features[fd.key]?'On':'Off'}`}
            style={{ fontSize:13, opacity:tenant.features[fd.key]?1:0.18 }}>
            {fd.icon}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button onClick={onPreview} title="Preview this tenant's app" style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #bfdbfe', background:'#eff6ff', color:'#1d4ed8', fontSize:11, fontWeight:600, cursor:'pointer' }}>Preview</button>
        <button onClick={onManage} style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #e2e8f0', background:'white', color:'#374151', fontSize:11, fontWeight:600, cursor:'pointer' }}>Manage</button>
        <button onClick={onEdit}   style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #e2e8f0', background:'white', color:'#374151', fontSize:11, fontWeight:600, cursor:'pointer' }}>Edit</button>
        <button onClick={onToggleActive} style={{ padding:'5px 10px', borderRadius:6, border:'none', background:tenant.active?'#fef2f2':'#f0fdf4', color:tenant.active?'#dc2626':'#16a34a', fontSize:11, fontWeight:600, cursor:'pointer' }}>
          {tenant.active?'Suspend':'Activate'}
        </button>
      </div>
    </div>
  );
}

// ─── MANAGE DRAWER (Features + Users) ────────────────────────────────────────
function ManageDrawer({ tenant, onClose, onUpdate }: { tenant: Tenant; onClose: () => void; onUpdate: (t: Tenant) => void }) {
  const [tab,       setTab]       = useState<'features'|'users'>('features');
  const [userModal, setUserModal] = useState<TenantUser | null | 'new'>(null);
  const [confirmDel, setConfirmDel] = useState<string|null>(null);

  const toggleFeature = (key: FeatureKey) =>
    onUpdate({ ...tenant, features: { ...tenant.features, [key]: !tenant.features[key] } });

  const saveUser = (u: TenantUser) => {
    onUpdate({ ...tenant, users: tenant.users.some(x=>x.id===u.id) ? tenant.users.map(x=>x.id===u.id?u:x) : [...tenant.users,u] });
    setUserModal(null);
  };

  const delUser = (id: string) => {
    onUpdate({ ...tenant, users: tenant.users.filter(u=>u.id!==id) });
    setConfirmDel(null);
  };

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', background:'rgba(15,23,42,0.35)' }} onClick={onClose}>
        <div style={{ flex:1 }}/>
        <div style={{ width:'100%', maxWidth:520, background:'white', height:'100%', display:'flex', flexDirection:'column', boxShadow:'-4px 0 24px rgba(0,0,0,0.12)' }} onClick={e=>e.stopPropagation()}>

          {/* Drawer header */}
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{tenant.name}</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{tenant.users.length} users · {FEATURE_DEFS.filter(f=>tenant.features[f.key]).length}/{FEATURE_DEFS.length} modules</div>
            </div>
            <button onClick={onClose} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:'#94a3b8', lineHeight:1 }}>×</button>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid #f1f5f9', flexShrink:0 }}>
            {(['features','users'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ padding:'10px 18px', border:'none', cursor:'pointer', fontSize:12, fontWeight:tab===t?700:400, color:tab===t?'#2563eb':'#64748b', background:'transparent', borderBottom:tab===t?'2px solid #2563eb':'2px solid transparent', textTransform:'capitalize' }}>
                {t==='features'?'🔧 Features':'👥 Users'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', padding:18 }}>

            {tab==='features' && (
              <div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:6, marginBottom:14 }}>
                  <button onClick={()=>onUpdate({...tenant,features:{kanban:true,workitems:true,create:true,bot:true,reports:true}})}
                    style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #bbf7d0', background:'#f0fdf4', color:'#16a34a', fontSize:11, fontWeight:600, cursor:'pointer' }}>All On</button>
                  <button onClick={()=>onUpdate({...tenant,features:{kanban:false,workitems:false,create:false,bot:false,reports:false}})}
                    style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', fontSize:11, fontWeight:600, cursor:'pointer' }}>All Off</button>
                </div>
                {FEATURE_DEFS.map(fd=>{
                  const on = tenant.features[fd.key];
                  return (
                    <div key={fd.key} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:9, border:`1px solid ${on?'#bfdbfe':'#e2e8f0'}`, background:on?'#f0f9ff':'#f8fafc', marginBottom:8 }}>
                      <span style={{ fontSize:18, width:26, textAlign:'center' }}>{fd.icon}</span>
                      <span style={{ flex:1, fontSize:13, fontWeight:500, color:on?'#1e40af':'#374151' }}>{fd.label}</span>
                      <span style={{ fontSize:11, color:on?'#16a34a':'#94a3b8', fontWeight:600, minWidth:52, textAlign:'right' }}>{on?'Enabled':'Disabled'}</span>
                      <Toggle on={on} onToggle={()=>toggleFeature(fd.key)}/>
                    </div>
                  );
                })}
              </div>
            )}

            {tab==='users' && (
              <div>
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
                  <button onClick={()=>setUserModal('new')} style={{ padding:'6px 12px', borderRadius:7, border:'none', background:'#2563eb', color:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ Add User</button>
                </div>
                {!tenant.users.length
                  ? <div style={{ textAlign:'center', padding:'32px 0', color:'#94a3b8', fontSize:12 }}>No users yet</div>
                  : tenant.users.map(u=>{
                    const rs = ROLE_STYLE[u.role];
                    return (
                      <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, border:'1px solid #f1f5f9', background:u.active?'white':'#f8fafc', marginBottom:7, opacity:u.active?1:0.65 }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:u.active?'linear-gradient(135deg,#2563eb,#7c3aed)':'#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', color:u.active?'white':'#94a3b8', fontWeight:700, fontSize:11, flexShrink:0 }}>
                          {u.fullName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:1 }}>
                            <span style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{u.fullName}</span>
                            <Pill label={u.role} color={rs.color} bg={rs.bg}/>
                            {!u.active&&<Pill label="Inactive" color="#94a3b8" bg="#f1f5f9"/>}
                          </div>
                          <div style={{ fontSize:10, color:'#94a3b8' }}>@{u.username}{u.email?` · ${u.email}`:''}</div>
                        </div>
                        <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                          <button onClick={()=>setUserModal(u)} style={{ padding:'4px 8px', borderRadius:5, border:'1px solid #e2e8f0', background:'white', fontSize:10, cursor:'pointer', color:'#374151' }}>Edit</button>
                          <button onClick={()=>setConfirmDel(u.id)} style={{ padding:'4px 8px', borderRadius:5, border:'1px solid #fecaca', background:'#fef2f2', fontSize:10, cursor:'pointer', color:'#dc2626' }}>×</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {userModal && (
        <UserForm
          user={userModal==='new'?null:userModal}
          tenantName={tenant.name}
          onSave={saveUser}
          onClose={()=>setUserModal(null)}
        />
      )}

      {confirmDel && (
        <Modal title="Remove User" onClose={()=>setConfirmDel(null)} width={360}>
          <p style={{ fontSize:12, color:'#374151', marginBottom:16 }}>
            Remove <strong>{tenant.users.find(u=>u.id===confirmDel)?.fullName}</strong> from {tenant.name}?
          </p>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={()=>setConfirmDel(null)} style={{ padding:'6px 12px', borderRadius:7, border:'1px solid #e2e8f0', background:'white', fontSize:12, cursor:'pointer', color:'#374151' }}>Cancel</button>
            <button onClick={()=>delUser(confirmDel)} style={{ padding:'6px 12px', borderRadius:7, border:'none', background:'#dc2626', color:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>Remove</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── ADMIN PANEL (ROOT) ───────────────────────────────────────────────────────
export interface AdminPanelProps {
  initialTenants: Tenant[];
  loggedUser: string;
  onPreviewTenant: (tenant: Tenant) => void;
}

export default function AdminPanel({ initialTenants, loggedUser, onPreviewTenant }: AdminPanelProps) {
  const [tenants,    setTenants]    = useState<Tenant[]>(initialTenants);
  const [managing,   setManaging]   = useState<Tenant | null>(null);
  const [editing,    setEditing]    = useState<Tenant | null | 'new'>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  const updateTenant = (t: Tenant) => {
    setTenants(p => p.map(x => x.id===t.id ? t : x));
    if(managing?.id===t.id) setManaging(t);
  };

  const saveTenant = (t: Tenant) => {
    setTenants(p => p.some(x=>x.id===t.id) ? p.map(x=>x.id===t.id?t:x) : [...p,t]);
    setEditing(null);
  };

  const deleteTenant = (id: string) => {
    setTenants(p => p.filter(t=>t.id!==id));
    if(managing?.id===id) setManaging(null);
    setConfirmDel(null);
  };

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.includes(search.toLowerCase())
  );

  const active = tenants.filter(t=>t.active).length;
  const totalUsers = tenants.reduce((s,t)=>s+t.users.length,0);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f8fafc', fontFamily:'system-ui,sans-serif', fontSize:13 }}>

      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #e2e8f0', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#111827' }}>Admin Console</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>Logged in as <strong style={{ color:'#374151' }}>{loggedUser}</strong> · {tenants.length} tenants · {totalUsers} users</div>
        </div>
        <button onClick={()=>setEditing('new')} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#2563eb', color:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ New Tenant</button>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, padding:'14px 20px 0', flexShrink:0 }}>
        {[
          { label:'Tenants',    value:tenants.length, color:'#2563eb' },
          { label:'Active',     value:active,          color:'#16a34a' },
          { label:'Suspended',  value:tenants.length-active, color:'#dc2626' },
          { label:'Total Users',value:totalUsers,      color:'#7c3aed' },
        ].map(s=>(
          <div key={s.label} style={{ background:'white', borderRadius:9, border:'1px solid #e2e8f0', padding:'10px 14px' }}>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', marginTop:1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + list */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Tenants ({filtered.length})</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
            style={{ border:'1px solid #e2e8f0', borderRadius:7, padding:'5px 10px', fontSize:12, outline:'none', width:160 }}/>
        </div>

        {!filtered.length
          ? <div style={{ textAlign:'center', padding:'48px 0', color:'#94a3b8', fontSize:12 }}>No tenants found</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filtered.map(t=>(
                <TenantRow key={t.id} tenant={t}
                  onEdit={()=>setEditing(t)}
                  onToggleActive={()=>updateTenant({...t,active:!t.active})}
                  onPreview={()=>onPreviewTenant(t)}
                  onManage={()=>setManaging(t)}
                />
              ))}
            </div>
        }
      </div>

      {/* Manage drawer */}
      {managing && <ManageDrawer tenant={managing} onClose={()=>setManaging(null)} onUpdate={updateTenant}/>}

      {/* Tenant form */}
      {editing && <TenantForm tenant={editing==='new'?null:editing} onSave={saveTenant} onClose={()=>setEditing(null)}/>}

      {/* Delete confirm */}
      {confirmDel && (
        <Modal title="Delete Tenant" onClose={()=>setConfirmDel(null)} width={360}>
          <p style={{ fontSize:12, color:'#374151', marginBottom:16 }}>
            Permanently delete <strong>{tenants.find(t=>t.id===confirmDel)?.name}</strong>? This cannot be undone.
          </p>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={()=>setConfirmDel(null)} style={{ padding:'6px 12px', borderRadius:7, border:'1px solid #e2e8f0', background:'white', fontSize:12, cursor:'pointer', color:'#374151' }}>Cancel</button>
            <button onClick={()=>deleteTenant(confirmDel)} style={{ padding:'6px 12px', borderRadius:7, border:'none', background:'#dc2626', color:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
