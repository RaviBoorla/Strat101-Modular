import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { gId, td } from "../../utils";

interface LocalGlobalAdminPanelProps {
  loggedUser:          string;
  tenantId:            string;
  onSignOut:           () => void;
  onSwitchToWorkspace: () => void;
  embedded?:           boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  kanban:    'Kanban Boards',
  workitems: 'Work Items',
  create:    'Create Items',
  bot:       'AI Assist',
  reports:   'Reports',
};

const FEATURE_ICONS: Record<string, string> = {
  kanban:    '🗂️',
  workitems: '📦',
  create:    '✏️',
  bot:       '🤖',
  reports:   '📊',
};

type Tab = 'users' | 'features' | 'subscription' | 'notifications';

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width:'100%', border:'1px solid #e2e8f0', borderRadius:7,
  padding:'7px 10px', fontSize:12, outline:'none', boxSizing:'border-box',
};
const sel: React.CSSProperties = {
  ...inp, background:'white', cursor:'pointer',
};
const btn = (color='#2563eb'): React.CSSProperties => ({
  padding:'6px 14px', borderRadius:7, border:'none',
  background:color, color:'white', fontSize:12,
  fontWeight:600, cursor:'pointer',
});

export default function LocalGlobalAdminPanel({ loggedUser, tenantId, onSignOut, onSwitchToWorkspace, embedded = false }: LocalGlobalAdminPanelProps) {
  const [tab,     setTab]     = useState<Tab>('users');
  const [tenant,  setTenant]  = useState<any>(null);
  const [users,   setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load tenant data ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: u }] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tenantId).single(),
      supabase.from('tenant_users')
        .select('*').eq('tenant_id', tenantId).order('created_at'),
    ]);
    setTenant(t);
    setUsers(u ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const pendingCount = users.filter(u => u.approval_status === 'pending').length;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#f8fafc',fontFamily:'system-ui,sans-serif',fontSize:13}}>

      {/* ── Top bar -- hidden when embedded ── */}
      {!embedded&&<div style={{background:'#1e293b',padding:'0 20px',height:48,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,borderRadius:7,background:'linear-gradient(135deg,#2563eb,#4f46e5)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:12}}>TA</div>
          <div>
            <span style={{color:'white',fontWeight:700,fontSize:13}}>{tenant?.name ?? '...'}</span>
            <span style={{color:'#64748b',fontSize:11,marginLeft:8}}>Local Admin Console</span>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:11,color:'#94a3b8'}}>
            Logged in as <strong style={{color:'#fbbf24'}}>{loggedUser}</strong>
          </span>
          <button onClick={onSwitchToWorkspace}
            style={{fontSize:11,color:'#93c5fd',background:'rgba(37,99,235,0.2)',border:'1px solid rgba(37,99,235,0.4)',borderRadius:6,padding:'4px 10px',cursor:'pointer'}}>
            Go to Workspace
          </button>
          <button onClick={onSignOut}
            style={{fontSize:11,color:'#94a3b8',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,padding:'4px 10px',cursor:'pointer'}}>
            Sign out
          </button>
        </div>
      </div>}

      {/* ── Tab bar ── */}
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'0 20px',display:'flex',gap:0,flexShrink:0}}>
        {([
          {key:'users',         label:'Users',         badge:pendingCount},
          {key:'features',      label:'Features',      badge:0},
          {key:'subscription',  label:'Subscription',  badge:0},
          {key:'notifications', label:'🔔 Notifications', badge:0},
        ] as {key:Tab,label:string,badge:number}[]).map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{padding:'12px 18px',border:'none',borderBottom:tab===t.key?'2px solid #2563eb':'2px solid transparent',background:'transparent',fontSize:12,fontWeight:tab===t.key?700:500,color:tab===t.key?'#2563eb':'#64748b',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            {t.label}
            {t.badge>0&&<span style={{background:'#dc2626',color:'white',borderRadius:999,fontSize:10,fontWeight:700,padding:'1px 6px'}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8'}}>Loading…</div>
      ) : (
        <div style={{flex:1,overflow:'auto'}}>
          {tab === 'users'         && <UsersTab         users={users} tenantId={tenantId} tenantName={tenant?.name??''} loggedUser={loggedUser} onRefresh={loadAll}/>}
          {tab === 'features'      && <FeaturesTab      tenant={tenant} tenantId={tenantId} loggedUser={loggedUser} onRefresh={loadAll}/>}
          {tab === 'subscription'  && <SubscriptionTab  tenant={tenant} loggedUser={loggedUser}/>}
          {tab === 'notifications' && <NotificationsTab tenantId={tenantId}/>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USERS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function UsersTab({ users, tenantId, tenantName, loggedUser, onRefresh }:
  { users:any[], tenantId:string, tenantName:string, loggedUser:string, onRefresh:()=>void }) {

  const [showAdd,   setShowAdd]   = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [filter,    setFilter]    = useState<'all'|'pending'|'active'|'inactive'>('all');

  const approve = async (userId: string) => {
    await supabase.from('tenant_users').update({
      approval_status:'approved', active:true,
      approval_actioned_at:new Date().toISOString(),
      approval_actioned_by:loggedUser,
    }).eq('id', userId);
    onRefresh();
  };

  const reject = async (userId: string) => {
    await supabase.from('tenant_users').update({
      approval_status:'rejected', active:false,
      approval_actioned_at:new Date().toISOString(),
      approval_actioned_by:loggedUser,
    }).eq('id', userId);
    onRefresh();
  };

  const deactivate = async (userId: string, active: boolean) => {
    await supabase.from('tenant_users').update({ active }).eq('id', userId);
    onRefresh();
  };

  const remove = async (userId: string, authUserId: string | null) => {
    await supabase.from('tenant_users').delete().eq('id', userId);
    if (authUserId) {
      await fetch('/api/delete-user', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ authUserId }),
      });
    }
    setConfirmDel(null);
    onRefresh();
  };

  const PROTECTED = ['raviboorla'];
  const filtered = users.filter(u => {
    if (filter === 'pending')  return u.approval_status === 'pending';
    if (filter === 'active')   return u.active && u.approval_status !== 'pending';
    if (filter === 'inactive') return !u.active && u.approval_status !== 'pending';
    return true;
  });

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#111827',flex:1}}>{tenantName} Users ({users.length})</div>
        <div style={{display:'flex',gap:4}}>
          {(['all','pending','active','inactive'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:11,fontWeight:600,cursor:'pointer',
                background:filter===f?'#2563eb':'white',color:filter===f?'white':'#64748b'}}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={()=>setShowAdd(true)} style={btn()}>+ Add User</button>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.map(u=>{
          const isSelf = u.username?.toLowerCase() === loggedUser?.toLowerCase();
          return (<div key={u.id} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:16}}>{u.role==='local_admin'?'👑':u.role==='editor'?'✏️':'👁️'}</span>
                  <span style={{fontWeight:700,color:'#111827',fontSize:13}}>{u.full_name}</span>
                  <span style={{color:'#94a3b8',fontSize:11}}>@{u.username}</span>
                  <span style={{padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:700,
                    background:u.approval_status==='pending'?'#fef3c7':u.active?'#f0fdf4':'#fef2f2',
                    color:u.approval_status==='pending'?'#92400e':u.active?'#16a34a':'#dc2626'}}>
                    {u.approval_status==='pending'?'PENDING':u.active?'ACTIVE':'INACTIVE'}
                  </span>
                  <span style={{padding:'2px 8px',borderRadius:999,fontSize:10,background:'#f1f5f9',color:'#475569',fontWeight:600}}>
                    {u.role}
                  </span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
                  <span style={{fontSize:11,color:'#64748b'}}>{u.email}</span>
                  {u.approval_status!=='pending'&&!PROTECTED.includes(u.username)&&(
                    <select
                      defaultValue={u.role}
                      onChange={async e=>{
                        if(isSelf && e.target.value==='local_admin') return;
                        await supabase.from('tenant_users').update({role:e.target.value}).eq('id',u.id);
                        onRefresh();
                      }}
                      disabled={isSelf}
                      style={{fontSize:10,border:'1px solid #e2e8f0',borderRadius:5,padding:'2px 6px',color:'#374151',cursor:isSelf?'not-allowed':'pointer',background:'white',opacity:isSelf?0.5:1}}>
                      <option value="local_admin">Local Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                {u.approval_status==='pending'&&<>
                  <button onClick={()=>approve(u.id)} style={btn('#16a34a')}>✔ Approve</button>
                  <button onClick={()=>reject(u.id)} style={{...btn(),...{background:'white',color:'#dc2626',border:'1px solid #fca5a5'}}}>✘ Reject</button>
                </>}
                {u.approval_status!=='pending'&&!PROTECTED.includes(u.username)&&!isSelf&&<>
                  <button onClick={()=>deactivate(u.id,!u.active)}
                    style={{padding:'5px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'white',fontSize:11,fontWeight:600,cursor:'pointer',color:u.active?'#dc2626':'#16a34a'}}>
                    {u.active?'Deactivate':'Activate'}
                  </button>
                  <button onClick={()=>setConfirmDel(u)}
                    style={{padding:'5px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fef2f2',fontSize:11,cursor:'pointer',color:'#dc2626'}}>
                    Remove
                  </button>
                </>}
              </div>
            </div>
          </div>
          );
        })}
        {!filtered.length&&<div style={{textAlign:'center',padding:'48px 0',color:'#94a3b8',fontSize:12}}>No users found</div>}
      </div>

      {showAdd&&<AddUserModal tenantId={tenantId} tenantName={tenantName} onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);onRefresh();}}/>}

      {confirmDel&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'white',borderRadius:12,padding:24,maxWidth:360,width:'100%',margin:'0 16px'}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>Remove User</div>
            <p style={{fontSize:12,color:'#374151',marginBottom:16}}>
              Remove <strong>{confirmDel.full_name}</strong> from {tenantName}? This will also delete their login account.
            </p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmDel(null)} style={{padding:'6px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer'}}>Cancel</button>
              <button onClick={()=>remove(confirmDel.id, confirmDel.auth_user_id)} style={btn('#dc2626')}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add User Modal ─────────────────────────────────────────────────────────────
function AddUserModal({ tenantId, tenantName, onClose, onSaved }:
  { tenantId:string, tenantName:string, onClose:()=>void, onSaved:()=>void }) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [role,     setRole]     = useState<'local_admin'|'editor'|'viewer'>('editor');
  const [sendInv,  setSendInv]  = useState(true);
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');

  const save = async () => {
    if (!username.trim()||!fullName.trim()||!email.trim()) { setErr('All fields required.'); return; }
    if (!sendInv && password.length<8) { setErr('Password must be at least 8 characters.'); return; }
    setErr(''); setLoading(true);

    // Create auth user via edge function
    const res = await fetch('/api/create-user', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ email:email.trim(), password:sendInv?undefined:password,
        username:username.trim().toLowerCase(), fullName:fullName.trim(), sendInvite:sendInv }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error ?? 'Failed to create user.'); setLoading(false); return; }

    // Insert tenant_users row
    const { error } = await supabase.from('tenant_users').insert({
      auth_user_id:    data.id,
      tenant_id:       tenantId,
      username:        username.trim().toLowerCase(),
      full_name:       fullName.trim(),
      email:           email.trim().toLowerCase(),
      role,
      active:          true,
      approval_status: 'approved',
    });

    if (error) { setErr(error.message); setLoading(false); return; }
    onSaved();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
      <div style={{background:'white',borderRadius:14,padding:24,maxWidth:420,width:'100%',margin:'0 16px'}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:16}}>Add User · {tenantName}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div><label style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em'}}>Username</label>
            <input value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g,''))} style={inp} placeholder="e.g. john.doe"/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em'}}>Full Name</label>
            <input value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} placeholder="e.g. John Doe"/></div>
        </div>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em'}}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} placeholder="john@company.com"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em'}}>Role</label>
            <select value={role} onChange={e=>setRole(e.target.value as any)} style={sel}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <div style={{fontSize:9,color:'#94a3b8',marginTop:3}}>Use Global Admin panel to assign Local Admin role</div></div>
          <div><label style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em'}}>Onboarding</label>
            <select value={sendInv?'invite':'password'} onChange={e=>setSendInv(e.target.value==='invite')} style={sel}>
              <option value="invite">Send Invite Email</option>
              <option value="password">Set Password</option>
            </select></div>
        </div>
        {!sendInv&&(
          <div style={{marginBottom:12}}>
            <label style={{fontSize:10,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em'}}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inp} placeholder="Min. 8 characters"/>
          </div>
        )}
        {err&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:7,padding:'8px 10px',fontSize:11,color:'#dc2626',marginBottom:10}}>{err}</div>}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
          <button onClick={save} disabled={loading} style={btn()}>{loading?'Adding…':'Add User'}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function FeaturesTab({ tenant, tenantId, loggedUser, onRefresh }:
  { tenant:any, tenantId:string, loggedUser:string, onRefresh:()=>void }) {

  const [requests,   setRequests]   = useState<any[]>([]);
  const [requesting, setRequesting] = useState<string|null>(null);
  const [reason,     setReason]     = useState('');
  const [loading,    setLoading]    = useState(false);

  const loadRequests = useCallback(async () => {
    const { data } = await supabase
      .from('feature_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    setRequests(data ?? []);
  }, [tenantId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const submitRequest = async (featureKey: string) => {
    if (!reason.trim()) return;
    setLoading(true);
    await supabase.from('feature_requests').insert({
      tenant_id:    tenantId,
      tenant_name:  tenant?.name ?? '',
      requested_by: loggedUser,
      feature_key:  featureKey,
      reason:       reason.trim(),
    });
    setRequesting(null);
    setReason('');
    setLoading(false);
    loadRequests();
  };

  const FEATURES = ['kanban','workitems','create','bot','reports','ride','chat'];

  return (
    <div style={{padding:20,maxWidth:640}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:'#111827',marginBottom:4}}>Feature Access</div>
        <div style={{fontSize:11,color:'#64748b'}}>Features are controlled by the platform administrator. You can request activation for disabled features.</div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
        {FEATURES.map(key=>{
          const enabled = tenant?.[`feat_${key}`] ?? false;
          const pending = requests.find(r=>r.feature_key===key&&r.status==='pending');
          const approved = requests.find(r=>r.feature_key===key&&r.status==='approved');
          return(
            <div key={key} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:22}}>{FEATURE_ICONS[key]}</span>
                <div>
                  <div style={{fontWeight:600,color:'#111827',fontSize:13}}>{FEATURE_LABELS[key]}</div>
                  <div style={{fontSize:11,color:enabled?'#16a34a':'#94a3b8',fontWeight:600,marginTop:2}}>
                    {enabled?'✓ Enabled':'✗ Disabled'}
                  </div>
                </div>
              </div>
              <div>
                {enabled?(
                  <span style={{padding:'4px 12px',borderRadius:999,background:'#f0fdf4',color:'#16a34a',fontSize:11,fontWeight:700}}>✓ ACTIVE</span>
                ):pending?(
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
                    <span style={{padding:'4px 12px',borderRadius:999,background:'#fef3c7',color:'#92400e',fontSize:11,fontWeight:700}}>⏳ REQUEST PENDING</span>
                    <span style={{fontSize:9,color:'#94a3b8'}}>Awaiting Global Admin approval</span>
                  </div>
                ):(
                  // Feature is disabled — always allow requesting, even if previously approved
                  // (global admin may have disabled it after approval)
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
                    <button onClick={()=>{setRequesting(key);setReason('');}}
                      style={{padding:'5px 12px',borderRadius:7,border:'1px solid #bfdbfe',background:'#eff6ff',color:'#2563eb',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                      Request Access
                    </button>
                    {approved&&<span style={{fontSize:9,color:'#f87171'}}>Previously approved — re-request needed</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Request history */}
      {requests.length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:8}}>Request History</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {requests.map(r=>(
              <div key={r.id} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:12,marginBottom:3}}>{FEATURE_ICONS[r.feature_key]} {FEATURE_LABELS[r.feature_key]}</div>
                  <div style={{color:'#64748b',fontSize:11,marginBottom:3}}>{r.reason}</div>
                  <div style={{fontSize:10,color:'#94a3b8'}}>
                    Requested: {r.created_at?new Date(r.created_at).toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}):'—'}
                    {r.actioned_at&&<span style={{marginLeft:8}}>· {r.status==='approved'?'Approved':'Rejected'}: {new Date(r.actioned_at).toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}{r.actioned_by&&` by ${r.actioned_by}`}</span>}
                    {r.status==='rejected'&&r.rejection_reason&&<div style={{marginTop:3,color:'#f87171',fontSize:10}}>Reason: {r.rejection_reason}</div>}
                  </div>
                </div>
                <span style={{padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:700,flexShrink:0,
                  background:r.status==='pending'?'#fef3c7':r.status==='approved'?'#f0fdf4':'#fef2f2',
                  color:r.status==='pending'?'#92400e':r.status==='approved'?'#16a34a':'#dc2626'}}>
                  {r.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request modal */}
      {requesting&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'white',borderRadius:12,padding:24,maxWidth:380,width:'100%',margin:'0 16px'}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Request {FEATURE_LABELS[requesting]}</div>
            <div style={{fontSize:11,color:'#64748b',marginBottom:14}}>Explain why your team needs this feature. The platform administrator will review your request.</div>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={4}
              style={{...inp,resize:'none',marginBottom:12} as React.CSSProperties}
              placeholder="e.g. Our team needs AI Assist to accelerate strategy planning sessions…"/>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setRequesting(null)} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer'}}>Cancel</button>
              <button onClick={()=>submitRequest(requesting)} disabled={loading||!reason.trim()} style={btn()}>
                {loading?'Submitting…':'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION TAB (read-only)
// ═══════════════════════════════════════════════════════════════════════════════
function SubscriptionTab({ tenant, loggedUser }: { tenant: any; loggedUser: string }) {
  if (!tenant) return null;

  const [reason,       setReason]       = React.useState('');
  const [submitting,   setSubmitting]   = React.useState(false);
  const [submitted,    setSubmitted]    = React.useState(false);
  const [hasPending,   setHasPending]   = React.useState(false);
  const [err,          setErr]          = React.useState('');

  const isSuspended = tenant.sub_status === 'suspended' || tenant.sub_status === 'cancelled' || !tenant.active;

  React.useEffect(() => {
    if (!isSuspended) return;
    supabase.from('suspension_requests')
      .select('id').eq('tenant_id', tenant.id).eq('status', 'pending').maybeSingle()
      .then(({ data }) => setHasPending(!!data));
  }, [tenant.id, isSuspended]);

  const submitReinstate = async () => {
    if (!reason.trim()) { setErr('Please provide a reason for the reinstatement request.'); return; }
    setSubmitting(true); setErr('');
    const { error } = await supabase.from('suspension_requests').insert({
      tenant_id:    tenant.id,
      tenant_name:  tenant.name,
      requested_by: loggedUser,
      reason:       reason.trim(),
      status:       'pending',
    });
    if (error) { setErr(error.message); }
    else { setSubmitted(true); setHasPending(true); }
    setSubmitting(false);
  };

  const STATUS_COLOR: Record<string,string|undefined> = {
    active:'#16a34a', trialling:'#2563eb', past_due:'#dc2626',
    cancelled:'#6b7280', suspended:'#dc2626',
  };

  const rows = [
    { label:'Plan',          value: (tenant.plan ? tenant.plan.charAt(0).toUpperCase()+tenant.plan.slice(1) : '—') },
    { label:'Status',        value: (tenant.sub_status as string) || '—', color: STATUS_COLOR[tenant.sub_status as string] },
    { label:'Billing Name',  value: tenant.billing_name  || '—' },
    { label:'Billing Email', value: tenant.billing_email || '—' },
    { label:'Auto Renew',    value: tenant.auto_renew ? 'Yes' : 'No' },
  ];

  return (
    <div style={{padding:20,maxWidth:520}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:'#111827',marginBottom:4}}>Subscription Details</div>
        <div style={{fontSize:11,color:'#64748b'}}>Contact the platform administrator to make changes to your subscription.</div>
      </div>

      <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:12}}>
        {rows.map((r,i)=>(
          <div key={r.label} style={{display:'flex',padding:'12px 16px',borderBottom:i<rows.length-1?'1px solid #f1f5f9':'none'}}>
            <div style={{width:140,fontSize:12,color:'#64748b',fontWeight:600}}>{r.label}</div>
            <div style={{fontSize:12,color:r.color??'#111827',fontWeight:r.color?700:400}}>{r.value}</div>
          </div>
        ))}
      </div>

      {/* Suspension reinstatement request section */}
      {isSuspended && (
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:16,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:'#dc2626',marginBottom:6}}>⛔ Account Suspended</div>
          <div style={{fontSize:12,color:'#7f1d1d',marginBottom:14,lineHeight:1.6}}>
            Your account has been suspended by the platform administrator. All user access has been revoked. As the Local Admin, you can request reinstatement.
          </div>
          {submitted || hasPending ? (
            <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#92400e',marginBottom:2}}>⏳ Reinstatement Request Pending</div>
              <div style={{fontSize:11,color:'#78350f'}}>Your request has been sent to the Global Admin for review. You will be notified once a decision is made.</div>
            </div>
          ) : (
            <>
              <div style={{marginBottom:8}}>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>
                  Reason for Reinstatement Request
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why the account should be reinstated..."
                  style={{width:'100%',boxSizing:'border-box',border:'1px solid #e2e8f0',borderRadius:7,padding:'8px 10px',fontSize:12,resize:'none',outline:'none'}}
                />
              </div>
              {err && <div style={{color:'#dc2626',fontSize:11,marginBottom:8}}>{err}</div>}
              <button onClick={submitReinstate} disabled={submitting||!reason.trim()}
                style={{padding:'8px 16px',borderRadius:7,border:'none',background:'#2563eb',color:'white',fontSize:12,fontWeight:600,cursor:reason.trim()?'pointer':'not-allowed',opacity:reason.trim()?1:0.5}}>
                {submitting?'Submitting…':'Request Reinstatement'}
              </button>
            </>
          )}
        </div>
      )}

      {!isSuspended && (
        <div style={{padding:'10px 14px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,fontSize:11,color:'#64748b'}}>
          🔒 Subscription details are read-only. To upgrade your plan or update billing information, contact <strong>Support@Strat101.com</strong>.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS TAB (read-only for local admin)
// ═══════════════════════════════════════════════════════════════════════════════
type NotifCols = { owner: boolean; assigned: boolean; sponsor: boolean };
type NotifSettings = Record<string, NotifCols>;

const NOTIF_EVENTS_LOCAL: { id: string; label: string; group: string }[] = [
  { id:'work_item_assignment', label:'Work item assigned to user',      group:'Work Items' },
  { id:'work_item_ownership',  label:'Work item ownership changed',     group:'Work Items' },
  { id:'status_completed',     label:'Item marked as complete',         group:'Work Items' },
  { id:'risk_level_change',    label:'Risk level changed',              group:'Work Items' },
  { id:'due_date_change',      label:'Due date changed',                group:'Work Items' },
  { id:'due_date_3d',          label:'Due in 3 days',                   group:'Due Date Alerts' },
  { id:'due_date_1d',          label:'Due tomorrow',                    group:'Due Date Alerts' },
  { id:'due_date_today',       label:'Due today',                       group:'Due Date Alerts' },
  { id:'overdue_3d',           label:'3 days overdue',                  group:'Due Date Alerts' },
  { id:'overdue_7d',           label:'7 days overdue',                  group:'Due Date Alerts' },
  { id:'sla_breach',           label:'SLA breached',                    group:'Due Date Alerts' },
  { id:'mention',              label:'Mentioned in a comment',          group:'Collaboration' },
  { id:'approval_request',     label:'Approval requested',              group:'Collaboration' },
  { id:'escalation',           label:'Item escalated',                  group:'Collaboration' },
  { id:'sprint_start',         label:'Sprint started',                  group:'Sprint & Planning' },
  { id:'sprint_end',           label:'Sprint ended',                    group:'Sprint & Planning' },
  { id:'backlog_update',       label:'Backlog updated',                 group:'Sprint & Planning' },
  { id:'story_sprint_change',  label:'Story moved between sprints',     group:'Sprint & Planning' },
  { id:'velocity_alert',       label:'Velocity alert triggered',        group:'Sprint & Planning' },
  { id:'user_project_change',  label:'Added/removed from project',      group:'People & Access' },
  { id:'role_change',          label:'Role changed',                    group:'People & Access' },
];

const NOTIF_DEFAULT_LOCAL: NotifSettings = Object.fromEntries(
  NOTIF_EVENTS_LOCAL.map(e => [e.id, { owner: false, assigned: false, sponsor: false }])
);

const NOTIF_GROUPS_LOCAL = Array.from(new Set(NOTIF_EVENTS_LOCAL.map(e => e.group)));

const GROUP_ICON_LOCAL: Record<string, string> = {
  'Work Items':        '📦',
  'Due Date Alerts':   '📅',
  'Collaboration':     '💬',
  'Sprint & Planning': '🏃',
  'People & Access':   '👤',
};

function NotificationsTab({ tenantId }: { tenantId: string }) {
  const [settings, setSettings] = React.useState<NotifSettings>(NOTIF_DEFAULT_LOCAL);
  const [loading,  setLoading]  = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('notification_settings')
        .select('settings')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data?.settings) setSettings({ ...NOTIF_DEFAULT_LOCAL, ...data.settings });
      setLoading(false);
    })();
  }, [tenantId]);

  if (loading) return <div style={{padding:20,color:'#94a3b8',fontSize:12}}>Loading notification settings…</div>;

  const colStyle = (active: boolean): React.CSSProperties => ({
    width:28, height:28, borderRadius:6,
    border: active ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
    background: active ? '#eff6ff' : '#f8fafc',
    display:'flex', alignItems:'center', justifyContent:'center',
    color: active ? '#2563eb' : '#cbd5e1', fontSize:13,
    cursor: 'default', flexShrink:0,
  });

  return (
    <div style={{ padding:20, maxWidth:640 }}>
      <div style={{ padding:'8px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, marginBottom:16, fontSize:11, color:'#92400e' }}>
        🔒 Notification settings are managed by Global Admin. These are the current email triggers for your tenant. Contact your admin to change them.
      </div>

      {NOTIF_GROUPS_LOCAL.map(group => {
        const events = NOTIF_EVENTS_LOCAL.filter(e => e.group === group);
        return (
          <div key={group} style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <span>{GROUP_ICON_LOCAL[group]}</span> {group}
            </div>
            <div style={{ border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                <div style={{ padding:'7px 12px', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Event</div>
                {(['Owner','Assigned','Sponsor'] as const).map(col => (
                  <div key={col} style={{ padding:'7px 0', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', textAlign:'center' }}>{col}</div>
                ))}
              </div>
              {events.map((ev, i) => {
                const s = settings[ev.id] ?? { owner:false, assigned:false, sponsor:false };
                return (
                  <div key={ev.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px', borderTop: i > 0 ? '1px solid #f1f5f9' : undefined, alignItems:'center' }}>
                    <div style={{ padding:'9px 12px', fontSize:12, color:'#374151' }}>{ev.label}</div>
                    {(['owner','assigned','sponsor'] as const).map(col => (
                      <div key={col} style={{ display:'flex', justifyContent:'center', alignItems:'center', padding:'6px 0' }}>
                        <div style={colStyle(s[col])}>{s[col] ? '✓' : ''}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
