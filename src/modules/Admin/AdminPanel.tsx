import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { Tenant, TenantUser, TenantFeatures, FeatureKey, UserRole, Subscription, Invoice, SubStatus } from "../../types";
import { gId, td, tsNow } from "../../utils";
import { PLAN_LIMITS, PLAN_PRICE } from "../../adminData";
import {
  fetchTenants,
  saveTenant    as apiSaveTenant,
  suspendTenant as apiSuspendTenant,
  deleteTenant  as apiDeleteTenant,
  saveUser      as apiSaveUser,
  deleteUser    as apiDeleteUser,
  recordPasswordReset as apiRecordPasswordReset,
  saveInvoice   as apiSaveInvoice,
  updateInvoiceStatus as apiUpdateInvoiceStatus,
} from "../../lib/adminApi";

const FEATURE_DEFS: { key: FeatureKey; label: string; icon: string }[] = [
  { key:'kanban',    label:'Kanban',     icon:'Kanban'    },
  { key:'workitems', label:'Work Items', icon:'WorkItems' },
  { key:'create',    label:'Create',     icon:'Create'    },
  { key:'bot',       label:'AI Assist',  icon:'AIAssist'  },
  { key:'reports',   label:'Reports',    icon:'Reports'   },
];

const FEATURE_EMOJI: Record<FeatureKey, string> = {
  kanban:'🗂️', workitems:'📦', create:'➕', bot:'🤖', reports:'📈',
};

const PLAN_STYLE: Record<string, {color:string;bg:string}> = {
  enterprise: {color:'#4f46e5',bg:'#eef2ff'},
  pro:        {color:'#0284c7',bg:'#e0f2fe'},
  starter:    {color:'#16a34a',bg:'#dcfce7'},
};
const ROLE_STYLE: Record<UserRole,{color:string;bg:string}> = {
  admin:        {color:'#dc2626',bg:'#fef2f2'},
  tenant_admin: {color:'#ea580c',bg:'#fff7ed'},
  editor:       {color:'#d97706',bg:'#fffbeb'},
  viewer:       {color:'#2563eb',bg:'#eff6ff'},
};
const SUB_STATUS_STYLE: Record<SubStatus,{color:string;bg:string;label:string}> = {
  active:    {color:'#16a34a',bg:'#f0fdf4',label:'Active'},
  trialling: {color:'#d97706',bg:'#fffbeb',label:'Trial'},
  past_due:  {color:'#dc2626',bg:'#fef2f2',label:'Past Due'},
  cancelled: {color:'#94a3b8',bg:'#f1f5f9',label:'Cancelled'},
  suspended: {color:'#7c3aed',bg:'#f5f3ff',label:'Suspended'},
};
const INV_STATUS_STYLE: Record<string,{color:string;bg:string}> = {
  paid:    {color:'#16a34a',bg:'#f0fdf4'},
  unpaid:  {color:'#d97706',bg:'#fffbeb'},
  overdue: {color:'#dc2626',bg:'#fef2f2'},
};

// Format pence as GBP string
const fmtGBP = (pence: number) => `\u00a3${(pence/100).toFixed(2)}`;

// ── MICRO COMPONENTS ─────────────────────────────────────────────────────────
function Pill({label,color,bg}:{label:string;color:string;bg:string}){
  return <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:999,color,background:bg,whiteSpace:'nowrap',textTransform:'capitalize'}}>{label}</span>;
}
function Toggle({on,onToggle}:{on:boolean;onToggle:()=>void}){
  return(
    <button onClick={onToggle} style={{width:36,height:20,borderRadius:10,border:'none',cursor:'pointer',background:on?'#2563eb':'#cbd5e1',position:'relative',transition:'background 0.18s',flexShrink:0}}>
      <span style={{position:'absolute',top:2,left:on?18:2,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.18s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
    </button>
  );
}
function UsageBar({label,used,limit,warn=0.8}:{label:string;used:number;limit:number;warn?:number}){
  const pct=limit>0?Math.min(used/limit,1):0;
  const over=pct>=1; const caution=!over&&pct>=warn;
  const barColor=over?'#dc2626':caution?'#f59e0b':'#2563eb';
  return(
    <div style={{marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:11,color:'#374151',fontWeight:500}}>{label}</span>
        <span style={{fontSize:11,fontWeight:700,color:over?'#dc2626':caution?'#d97706':'#374151'}}>
          {limit===9999?`${used} / \u221e`:`${used} / ${limit}`}{over&&' \u26a0 Over limit'}
        </span>
      </div>
      <div style={{height:6,background:'#e2e8f0',borderRadius:99,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct*100}%`,background:barColor,borderRadius:99,transition:'width 0.3s'}}/>
      </div>
    </div>
  );
}
const inp: React.CSSProperties = {width:'100%',boxSizing:'border-box',border:'1px solid #e2e8f0',borderRadius:7,padding:'7px 10px',fontSize:12,outline:'none',fontFamily:'system-ui,sans-serif'};
const sel: React.CSSProperties = {...inp,cursor:'pointer'};
function FL({label,children}:{label:string;children:React.ReactNode}){
  return(
    <div style={{marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{label}</div>
      {children}
    </div>
  );
}

// ── MODAL ────────────────────────────────────────────────────────────────────
function Modal({title,onClose,children,width=460}:{title:string;onClose:()=>void;children:React.ReactNode;width?:number}){
  return(
    <div style={{position:'fixed',inset:0,zIndex:80,background:'rgba(15,23,42,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'white',borderRadius:12,width:'100%',maxWidth:width,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:13,fontWeight:700,color:'#111827'}}>{title}</span>
          <button onClick={onClose} style={{border:'none',background:'none',fontSize:18,cursor:'pointer',color:'#94a3b8',lineHeight:1}}>&times;</button>
        </div>
        <div style={{padding:16,overflowY:'auto',flex:1}}>{children}</div>
      </div>
    </div>
  );
}

// ── PASSWORD RESET MODAL ─────────────────────────────────────────────────────
function PasswordResetModal({user,onReset,onClose}:{user:TenantUser;onReset:(u:TenantUser)=>void;onClose:()=>void}){
  const tempPwd=`Temp${Math.random().toString(36).slice(2,7).toUpperCase()}!1`;
  const [copied,setCopied]=useState(false);
  const doReset=()=>onReset({...user,tempPassword:tempPwd,passwordResetAt:tsNow(),mustChangePwd:true});
  const copy=()=>{navigator.clipboard.writeText(tempPwd).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};
  const alreadyReset=!!user.tempPassword;
  return(
    <Modal title={`Reset Password - ${user.fullName}`} onClose={onClose} width={420}>
      {alreadyReset?(
        <div style={{marginBottom:14,padding:12,background:'#fffbeb',borderRadius:8,border:'1px solid #fde68a'}}>
          <div style={{fontSize:11,fontWeight:600,color:'#92400e',marginBottom:4}}>Pending reset already issued</div>
          <div style={{fontSize:11,color:'#78350f'}}>Issued: {user.passwordResetAt}<br/>User has not yet changed their password.</div>
        </div>
      ):(
        <div style={{marginBottom:14,padding:12,background:'#f0fdf4',borderRadius:8,border:'1px solid #bbf7d0'}}>
          <div style={{fontSize:11,color:'#166534'}}>A temporary password will be generated. The user must change it on next login.</div>
        </div>
      )}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:6}}>Generated temporary password:</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <code style={{flex:1,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:7,padding:'8px 12px',fontSize:13,fontWeight:700,color:'#1e293b',letterSpacing:'0.05em',fontFamily:'monospace'}}>{tempPwd}</code>
          <button onClick={copy} style={{padding:'8px 12px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:11,cursor:'pointer',color:'#374151',whiteSpace:'nowrap',fontWeight:600}}>{copied?'Copied':'Copy'}</button>
        </div>
      </div>
      <div style={{fontSize:10,color:'#94a3b8',marginBottom:16,lineHeight:1.5}}>
        Share this password with <strong>{user.fullName}</strong> via a secure channel. It expires after first use.
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button onClick={onClose} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
        <button onClick={doReset} style={{padding:'7px 14px',borderRadius:7,border:'none',background:'#2563eb',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>
          {alreadyReset?'Re-issue Reset':'Issue Reset'}
        </button>
      </div>
    </Modal>
  );
}

// ── LOGIN HISTORY MODAL ──────────────────────────────────────────────────────
function LoginHistoryModal({user,onClose}:{user:TenantUser;onClose:()=>void}){
  const history=user.loginHistory||[];
  return(
    <Modal title={`Login History - ${user.fullName}`} onClose={onClose} width={480}>
      {!history.length?(
        <div style={{textAlign:'center',padding:'24px 0',color:'#94a3b8',fontSize:12}}>No login history recorded</div>
      ):(
        <>
          <div style={{marginBottom:12,padding:10,background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0',display:'flex',gap:16}}>
            <div>
              <div style={{fontSize:10,color:'#64748b',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em'}}>Last Login</div>
              <div style={{fontSize:12,fontWeight:600,color:'#111827',marginTop:2}}>{user.lastLogin||'-'}</div>
            </div>
            <div>
              <div style={{fontSize:10,color:'#64748b',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em'}}>Last IP</div>
              <div style={{fontSize:12,fontWeight:600,color:'#111827',marginTop:2,fontFamily:'monospace'}}>{user.lastLoginIp||'-'}</div>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {history.map((e,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,background:i===0?'#eff6ff':'#f8fafc',border:'1px solid',borderColor:i===0?'#bfdbfe':'#e2e8f0'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:i===0?'#22c55e':'#cbd5e1',flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:i===0?600:400,color:'#111827'}}>{e.ts}</div>
                  <div style={{fontSize:10,color:'#64748b',marginTop:1}}>{e.device}</div>
                </div>
                <code style={{fontSize:10,color:'#64748b',fontFamily:'monospace'}}>{e.ip}</code>
                {i===0&&<span style={{fontSize:10,color:'#1d4ed8',fontWeight:700}}>Latest</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

// ── USER FORM ────────────────────────────────────────────────────────────────
function UserForm({user,tenantName,onSave,onClose}:{user:TenantUser|null;tenantName:string;onSave:(u:TenantUser)=>void;onClose:()=>void}){
  const isNew = !user;
  const [username,    setUsername]    = useState(user?.username??'');
  const [fullName,    setFullName]    = useState(user?.fullName??'');
  const [email,       setEmail]       = useState(user?.email??'');
  const [password,    setPassword]    = useState('');
  const [sendInvite,  setSendInvite]  = useState(true);
  const [role,        setRole]        = useState<UserRole>(user?.role??'viewer');
  const [active,      setActive]      = useState(user?.active??true);

  const canSave = username.trim() && fullName.trim() && email.trim()
    && (!isNew || sendInvite || password.length >= 8);

  const save = () => {
    if (!canSave) return;
    const u: TenantUser = user
      ? { ...user, username:username.trim(), fullName:fullName.trim(), email:email.trim(), role, active }
      : {
          id: gId(), username:username.trim(), fullName:fullName.trim(),
          email:email.trim(), role, active, createdAt:td(),
          tempPassword:  sendInvite ? undefined : password,
          mustChangePwd: !sendInvite,
          sendInvite,
        };
    onSave(u);
  };

  return(
    <Modal title={user?`Edit - ${user.fullName}`:`New User | ${tenantName}`} onClose={onClose}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <FL label="Username"><input value={username} onChange={e=>setUsername(e.target.value)} style={inp} autoFocus placeholder="e.g. john.doe"/></FL>
        <FL label="Full Name"><input value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} placeholder="e.g. John Doe"/></FL>
      </div>
      <FL label="Email Address"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} placeholder="e.g. john@company.com"/></FL>

      {isNew && (
        <>
          {/* Invite toggle */}
          <div style={{padding:'12px 14px',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0',marginTop:4}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:sendInvite?0:10}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'#111827'}}>Send invitation email</div>
                <div style={{fontSize:11,color:'#64748b',marginTop:2}}>
                  {sendInvite
                    ? 'User receives an email with a link to set their own password.'
                    : 'Set a temporary password and share it with the user manually.'}
                </div>
              </div>
              <Toggle on={sendInvite} onToggle={()=>setSendInvite((v:boolean)=>!v)}/>
            </div>
            {!sendInvite && (
              <div style={{marginTop:10}}>
                <FL label="Temporary Password">
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                    style={inp} placeholder="Min. 8 characters"/>
                </FL>
              </div>
            )}
          </div>
        </>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:4}}>
        <FL label="Role"><select value={role} onChange={e=>setRole(e.target.value as UserRole)} style={sel}>
          <option value="admin">Admin</option>
          <option value="tenant_admin">Tenant Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select></FL>
        <FL label="Status"><div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
          <Toggle on={active} onToggle={()=>setActive((a:boolean)=>!a)}/>
          <span style={{fontSize:12,color:active?'#16a34a':'#94a3b8',fontWeight:600}}>{active?'Active':'Inactive'}</span>
        </div></FL>
      </div>

      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
        <button onClick={onClose} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
        <button onClick={save} disabled={!canSave} style={{padding:'7px 14px',borderRadius:7,border:'none',background:'#2563eb',color:'white',fontSize:12,fontWeight:600,cursor:'pointer',opacity:canSave?1:0.4}}>
          {user ? 'Save Changes' : sendInvite ? 'Add User & Send Invite' : 'Add User & Set Password'}
        </button>
      </div>
    </Modal>
  );
}

// ── USERS TAB ────────────────────────────────────────────────────────────────
function UsersTab({tenant,onUpdate}:{tenant:Tenant;onUpdate:(t:Tenant)=>void}){
  const [userModal,  setUserModal]  = useState<TenantUser|null|'new'>(null);
  const [resetModal, setResetModal] = useState<TenantUser|null>(null);
  const [histModal,  setHistModal]  = useState<TenantUser|null>(null);
  const [confirmDel, setConfirmDel] = useState<string|null>(null);
  const saveUser=async(u:TenantUser)=>{
    const updated={...tenant,users:tenant.users.some(x=>x.id===u.id)?tenant.users.map(x=>x.id===u.id?u:x):[...tenant.users,u]};
    onUpdate(updated);
    setUserModal(null);
    await apiSaveUser(u, tenant.id);
  };
  const applyReset=async(u:TenantUser)=>{
    const updated={...tenant,users:tenant.users.map(x=>x.id===u.id?u:x)};
    onUpdate(updated);
    setResetModal(null);
    if(u.tempPassword) await apiRecordPasswordReset(u.id, u.tempPassword);
  };
  const delUser=async(id:string)=>{
    onUpdate({...tenant,users:tenant.users.filter(u=>u.id!==id)});
    setConfirmDel(null);
    await apiDeleteUser(id);
  };
  return(
    <>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
        <button onClick={()=>setUserModal('new')} style={{padding:'6px 12px',borderRadius:7,border:'none',background:'#2563eb',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>+ Add User</button>
      </div>
      {!tenant.users.length
        ?<div style={{textAlign:'center',padding:'32px 0',color:'#94a3b8',fontSize:12}}>No users yet</div>
        :tenant.users.map(u=>{
          const rs=ROLE_STYLE[u.role];
          return(
            <div key={u.id} style={{marginBottom:8,borderRadius:10,border:'1px solid #e2e8f0',background:u.active?'white':'#f8fafc',overflow:'hidden',opacity:u.active?1:0.7}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <div style={{width:34,height:34,borderRadius:'50%',background:u.active?'linear-gradient(135deg,#2563eb,#7c3aed)':'#e2e8f0',display:'flex',alignItems:'center',justifyContent:'center',color:u.active?'white':'#94a3b8',fontWeight:700,fontSize:11,flexShrink:0}}>
                  {u.fullName.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,fontWeight:600,color:'#111827'}}>{u.fullName}</span>
                    <Pill label={u.role} color={rs.color} bg={rs.bg}/>
                    {!u.active&&<Pill label="Inactive" color="#94a3b8" bg="#f1f5f9"/>}
                    {u.mustChangePwd&&<Pill label="Pwd Reset Pending" color="#d97706" bg="#fffbeb"/>}
                  </div>
                  <div style={{fontSize:10,color:'#94a3b8'}}>
                    @{u.username}{u.email?` | ${u.email}`:''}
                    {u.lastLogin&&<span> | Last login: {u.lastLogin}</span>}
                    {!u.lastLogin&&<span style={{color:'#fca5a5'}}> | Never logged in</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:5,flexShrink:0}}>
                  <button onClick={()=>setHistModal(u)}  style={{padding:'4px 8px',borderRadius:5,border:'1px solid #e2e8f0',background:'white',fontSize:10,cursor:'pointer',color:'#374151'}}>History</button>
                  <button onClick={()=>setResetModal(u)} style={{padding:'4px 8px',borderRadius:5,border:'1px solid #fde68a',background:'#fffbeb',fontSize:10,cursor:'pointer',color:'#92400e'}}>Reset Pwd</button>
                  <button onClick={()=>setUserModal(u)}  style={{padding:'4px 8px',borderRadius:5,border:'1px solid #e2e8f0',background:'white',fontSize:10,cursor:'pointer',color:'#374151'}}>Edit</button>
                  {!['raviboorla'].includes(u.username?.toLowerCase()??'') &&
                  <button onClick={()=>setConfirmDel(u.id)} style={{padding:'4px 8px',borderRadius:5,border:'1px solid #fecaca',background:'#fef2f2',fontSize:10,cursor:'pointer',color:'#dc2626'}}>&times;</button>}
                </div>
              </div>
              {u.mustChangePwd&&u.passwordResetAt&&(
                <div style={{padding:'6px 12px',background:'#fffbeb',borderTop:'1px solid #fde68a',fontSize:10,color:'#92400e'}}>
                  Temporary password issued on {u.passwordResetAt}. Awaiting user login.
                </div>
              )}
            </div>
          );
        })
      }
      <div style={{marginTop:14,display:'flex',gap:12,flexWrap:'wrap'}}>
        {(['admin','editor','viewer'] as UserRole[]).map(r=>(
          <div key={r} style={{display:'flex',alignItems:'center',gap:4}}>
            <Pill label={r} color={ROLE_STYLE[r].color} bg={ROLE_STYLE[r].bg}/>
            <span style={{fontSize:10,color:'#94a3b8'}}>{r==='admin'?'Full access':r==='editor'?'Create & edit':'Read-only'}</span>
          </div>
        ))}
      </div>
      {userModal  &&<UserForm user={userModal==='new'?null:userModal} tenantName={tenant.name} onSave={saveUser} onClose={()=>setUserModal(null)}/>}
      {resetModal &&<PasswordResetModal user={resetModal} onReset={applyReset} onClose={()=>setResetModal(null)}/>}
      {histModal  &&<LoginHistoryModal  user={histModal}  onClose={()=>setHistModal(null)}/>}
      {confirmDel &&(
        <Modal title="Remove User" onClose={()=>setConfirmDel(null)} width={360}>
          <p style={{fontSize:12,color:'#374151',marginBottom:16}}>Remove <strong>{tenant.users.find(u=>u.id===confirmDel)?.fullName}</strong> from {tenant.name}?</p>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setConfirmDel(null)} style={{padding:'6px 12px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
            <button onClick={()=>delUser(confirmDel)} style={{padding:'6px 12px',borderRadius:7,border:'none',background:'#dc2626',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>Remove</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── FEATURES TAB ─────────────────────────────────────────────────────────────
function FeaturesTab({tenant,onUpdate}:{tenant:Tenant;onUpdate:(t:Tenant)=>void}){
  const toggleFeature=(key:FeatureKey)=>onUpdate({...tenant,features:{...tenant.features,[key]:!tenant.features[key]}});
  return(
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginBottom:14}}>
        <button onClick={()=>onUpdate({...tenant,features:{kanban:true,workitems:true,create:true,bot:true,reports:true}})} style={{padding:'4px 10px',borderRadius:6,border:'1px solid #bbf7d0',background:'#f0fdf4',color:'#16a34a',fontSize:11,fontWeight:600,cursor:'pointer'}}>All On</button>
        <button onClick={()=>onUpdate({...tenant,features:{kanban:false,workitems:false,create:false,bot:false,reports:false}})} style={{padding:'4px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',fontSize:11,fontWeight:600,cursor:'pointer'}}>All Off</button>
      </div>
      {FEATURE_DEFS.map(fd=>{
        const on=tenant.features[fd.key];
        const emoji=FEATURE_EMOJI[fd.key];
        return(
          <div key={fd.key} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:9,border:`1px solid ${on?'#bfdbfe':'#e2e8f0'}`,background:on?'#f0f9ff':'#f8fafc',marginBottom:8}}>
            <span style={{fontSize:18,width:26,textAlign:'center'}}>{emoji}</span>
            <span style={{flex:1,fontSize:13,fontWeight:500,color:on?'#1e40af':'#374151'}}>{fd.label}</span>
            <span style={{fontSize:11,color:on?'#16a34a':'#94a3b8',fontWeight:600,minWidth:52,textAlign:'right'}}>{on?'Enabled':'Disabled'}</span>
            <Toggle on={on} onToggle={()=>toggleFeature(fd.key)}/>
          </div>
        );
      })}
    </div>
  );
}

// ── SUBSCRIPTION TAB ─────────────────────────────────────────────────────────
function SubscriptionTab({tenant,onUpdate}:{tenant:Tenant;onUpdate:(t:Tenant)=>void}){
  const sub=tenant.subscription;
  const ss=SUB_STATUS_STYLE[sub.status];
  const [editing,    setEditing]    =useState(false);
  const [billingName,setBillingName]=useState(sub.billingName);
  const [billingEmail,setBillingEmail]=useState(sub.billingEmail);
  const [vatId,      setVatId]      =useState(sub.vatId||'');
  const [cardLast4,  setCardLast4]  =useState(sub.cardLast4||'');
  const [cardExpiry, setCardExpiry] =useState(sub.cardExpiry||'');
  const [autoRenew,  setAutoRenew]  =useState(sub.autoRenew);
  const [status,     setStatus]     =useState<SubStatus>(sub.status);
  const [planLocal,  setPlanLocal]  =useState<Tenant['plan']>(tenant.plan);
  const [trialEnd,   setTrialEnd]   =useState(sub.trialEnd||'');

  const saveSub=async()=>{
    const lim=PLAN_LIMITS[planLocal];
    const updatedTenant={...tenant,plan:planLocal,subscription:{...sub,status,billingName:billingName.trim(),billingEmail:billingEmail.trim(),vatId:vatId.trim(),cardLast4:cardLast4.slice(-4),cardExpiry:cardExpiry.trim(),autoRenew,trialEnd:trialEnd||sub.trialEnd,itemLimit:lim.items,userLimit:lim.users,aiCallLimit:lim.aiCalls}};
    onUpdate(updatedTenant);
    setEditing(false);
    await apiSaveTenant(updatedTenant);
  };

  const monthlyPrice=PLAN_PRICE[tenant.plan];
  const statusIcon=sub.status==='active'?'\u2705':sub.status==='trialling'?'\u{1f9ea}':sub.status==='past_due'?'\u26a0\ufe0f':sub.status==='cancelled'?'\u274c':'\u{1f512}';

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:9,background:ss.bg,border:`1px solid ${ss.color}33`,marginBottom:16}}>
        <span style={{fontSize:20}}>{statusIcon}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:ss.color}}>{ss.label}</div>
          <div style={{fontSize:11,color:'#64748b',marginTop:1}}>
            {sub.status==='trialling'&&sub.trialEnd?`Trial ends ${sub.trialEnd}`:''}
            {sub.status==='active'?`Renews ${sub.currentPeriodEnd} | ${fmtGBP(monthlyPrice)}/mo`:''}
            {sub.status==='past_due'?'Payment failed - action required':''}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:18,fontWeight:800,color:PLAN_STYLE[tenant.plan].color}}>{fmtGBP(monthlyPrice)}</div>
          <div style={{fontSize:10,color:'#94a3b8'}}>per month</div>
        </div>
      </div>

      <div style={{padding:'12px 14px',borderRadius:9,border:'1px solid #e2e8f0',background:'#f8fafc',marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:'#374151',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.04em'}}>Usage This Period</div>
        <UsageBar label="Work Items" used={sub.itemCount} limit={sub.itemLimit}/>
        <UsageBar label="Users"      used={sub.userCount} limit={sub.userLimit}/>
        <UsageBar label="AI Calls"   used={sub.aiCalls}   limit={sub.aiCallLimit}/>
      </div>

      {!editing?(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
            {[
              ['Plan',          tenant.plan.charAt(0).toUpperCase()+tenant.plan.slice(1)],
              ['Status',        ss.label],
              ['Billing Name',  sub.billingName||'-'],
              ['Billing Email', sub.billingEmail||'-'],
              ['VAT / Tax ID',  sub.vatId||'-'],
              ['Card on File',  sub.cardLast4?`\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${sub.cardLast4}  exp ${sub.cardExpiry}`:'-'],
              ['Auto Renew',    sub.autoRenew?'Yes':'No'],
              ['Period',        `${sub.currentPeriodStart} \u2192 ${sub.currentPeriodEnd}`],
            ].map(([l,v])=>(
              <div key={l} style={{padding:'8px 10px',borderRadius:7,background:'white',border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>{l}</div>
                <div style={{fontSize:12,color:'#111827',fontWeight:500}}>{v}</div>
              </div>
            ))}
          </div>
          <button onClick={()=>setEditing(true)} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer',color:'#374151',fontWeight:600}}>Edit Subscription</button>
        </div>
      ):(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <FL label="Plan">
              <select value={planLocal} onChange={e=>setPlanLocal(e.target.value as Tenant['plan'])} style={sel}>
                <option value="starter">Starter - {fmtGBP(PLAN_PRICE.starter)}/mo</option>
                <option value="pro">Pro - {fmtGBP(PLAN_PRICE.pro)}/mo</option>
                <option value="enterprise">Enterprise - {fmtGBP(PLAN_PRICE.enterprise)}/mo</option>
              </select>
            </FL>
            <FL label="Subscription Status">
              <select value={status} onChange={e=>setStatus(e.target.value as SubStatus)} style={sel}>
                <option value="trialling">Trialling</option>
                <option value="active">Active</option>
                <option value="past_due">Past Due</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </FL>
            <FL label="Billing Name"><input value={billingName} onChange={e=>setBillingName(e.target.value)} style={inp} placeholder="Company name"/></FL>
            <FL label="Billing Email"><input value={billingEmail} onChange={e=>setBillingEmail(e.target.value)} style={inp} placeholder="finance@company.com"/></FL>
            <FL label="VAT / Tax ID"><input value={vatId} onChange={e=>setVatId(e.target.value)} style={inp} placeholder="e.g. GB123456789"/></FL>
            <FL label="Trial End Date"><input type="date" value={trialEnd} onChange={e=>setTrialEnd(e.target.value)} style={inp}/></FL>
            <FL label="Card Last 4 Digits"><input value={cardLast4} onChange={e=>setCardLast4(e.target.value.slice(-4))} style={inp} placeholder="4242" maxLength={4}/></FL>
            <FL label="Card Expiry MM/YY"><input value={cardExpiry} onChange={e=>setCardExpiry(e.target.value)} style={inp} placeholder="08/27"/></FL>
          </div>
          <FL label="Auto Renew">
            <div style={{display:'flex',alignItems:'center',gap:8}}><Toggle on={autoRenew} onToggle={()=>setAutoRenew((a:boolean)=>!a)}/><span style={{fontSize:12,color:autoRenew?'#16a34a':'#94a3b8',fontWeight:600}}>{autoRenew?'On':'Off'}</span></div>
          </FL>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button onClick={()=>setEditing(false)} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
            <button onClick={saveSub} style={{padding:'7px 14px',borderRadius:7,border:'none',background:'#2563eb',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── INVOICES TAB ─────────────────────────────────────────────────────────────
function InvoicesTab({tenant,onUpdate}:{tenant:Tenant;onUpdate:(t:Tenant)=>void}){
  const invoices=tenant.subscription.invoices;
  const [adding,setAdding]=useState(false);
  const [iDate, setIDate]=useState(td());
  const [iAmt,  setIAmt] =useState('');
  const [iPer,  setIPer] =useState('');
  const [iSt,   setISt]  =useState<Invoice['status']>('unpaid');

  const addInvoice=async()=>{
    if(!iDate||!iAmt||!iPer) return;
    const inv:Invoice={id:gId(),date:iDate,amount:Math.round(parseFloat(iAmt)*100),status:iSt,period:iPer};
    onUpdate({...tenant,subscription:{...tenant.subscription,invoices:[inv,...invoices]}});
    setAdding(false);setIDate(td());setIAmt('');setIPer('');setISt('unpaid');
    await apiSaveInvoice(inv, tenant.id);
  };

  const updateStatus=async(id:string,status:Invoice['status'])=>{
    onUpdate({...tenant,subscription:{...tenant.subscription,invoices:invoices.map(i=>i.id===id?{...i,status}:i)}});
    await apiUpdateInvoiceStatus(id, status);
  };

  const totalPaid=invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.amount,0);
  const totalDue =invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+i.amount,0);

  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
        {[
          {label:'Invoices',    value:String(invoices.length),color:'#374151'},
          {label:'Total Paid',  value:fmtGBP(totalPaid),      color:'#16a34a'},
          {label:'Outstanding', value:fmtGBP(totalDue),       color:totalDue>0?'#dc2626':'#94a3b8'},
        ].map(s=>(
          <div key={s.label} style={{padding:'10px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'white'}}>
            <div style={{fontSize:16,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em',marginTop:1}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
        <button onClick={()=>setAdding(a=>!a)} style={{padding:'6px 12px',borderRadius:7,border:'none',background:'#2563eb',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>+ Add Invoice</button>
      </div>
      {adding&&(
        <div style={{padding:14,borderRadius:9,border:'1px solid #bfdbfe',background:'#eff6ff',marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:'#1e40af',marginBottom:10}}>New Invoice</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <FL label="Invoice Date"><input type="date" value={iDate} onChange={e=>setIDate(e.target.value)} style={inp}/></FL>
            <FL label="Period (e.g. Apr 2026)"><input value={iPer} onChange={e=>setIPer(e.target.value)} style={inp} placeholder="Apr 2026"/></FL>
            <FL label="Amount (GBP)"><input type="number" min="0" step="0.01" value={iAmt} onChange={e=>setIAmt(e.target.value)} style={inp} placeholder="0.00"/></FL>
            <FL label="Status"><select value={iSt} onChange={e=>setISt(e.target.value as Invoice['status'])} style={sel}><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></FL>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setAdding(false)} style={{padding:'6px 12px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
            <button onClick={addInvoice} disabled={!iAmt||!iPer} style={{padding:'6px 12px',borderRadius:7,border:'none',background:'#2563eb',color:'white',fontSize:12,fontWeight:600,cursor:'pointer',opacity:iAmt&&iPer?1:0.4}}>Add Invoice</button>
          </div>
        </div>
      )}
      {!invoices.length
        ?<div style={{textAlign:'center',padding:'32px 0',color:'#94a3b8',fontSize:12}}>No invoices yet</div>
        :invoices.map(inv=>{
          const is=INV_STATUS_STYLE[inv.status];
          return(
            <div key={inv.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:9,border:'1px solid #e2e8f0',background:'white',marginBottom:7}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:2}}>
                  <span style={{fontSize:12,fontWeight:700,color:'#111827',fontFamily:'monospace'}}>{fmtGBP(inv.amount)}</span>
                  <Pill label={inv.status} color={is.color} bg={is.bg}/>
                </div>
                <div style={{fontSize:10,color:'#94a3b8'}}>{inv.period} | Issued {inv.date} | #{inv.id.slice(-6).toUpperCase()}</div>
              </div>
              <select value={inv.status} onChange={e=>updateStatus(inv.id,e.target.value as Invoice['status'])}
                style={{...sel,width:'auto',fontSize:11,padding:'4px 8px',color:is.color,background:is.bg,border:`1px solid ${is.color}44`}}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          );
        })
      }
    </div>
  );
}

// ── MANAGE DRAWER ────────────────────────────────────────────────────────────
function ManageDrawer({tenant,onClose,onUpdate}:{tenant:Tenant;onClose:()=>void;onUpdate:(t:Tenant)=>void}){
  const [tab,setTab]=useState<'users'|'features'|'subscription'|'invoices'>('users');
  const TABS=[
    {id:'users'        as const, label:'Users'},
    {id:'features'     as const, label:'Features'},
    {id:'subscription' as const, label:'Subscription'},
    {id:'invoices'     as const, label:'Invoices'},
  ];
  return(
    <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',background:'rgba(15,23,42,0.35)'}} onClick={onClose}>
      <div style={{flex:1}}/>
      <div style={{width:'100%',maxWidth:580,background:'white',height:'100%',display:'flex',flexDirection:'column',boxShadow:'-4px 0 24px rgba(0,0,0,0.12)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#111827'}}>{tenant.name}</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>
              {tenant.users.length} users | {FEATURE_DEFS.filter(f=>tenant.features[f.key]).length}/{FEATURE_DEFS.length} modules |{' '}
              <span style={{color:SUB_STATUS_STYLE[tenant.subscription.status].color,fontWeight:600}}>
                {SUB_STATUS_STYLE[tenant.subscription.status].label}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{border:'none',background:'none',fontSize:20,cursor:'pointer',color:'#94a3b8',lineHeight:1}}>&times;</button>
        </div>
        <div style={{display:'flex',borderBottom:'1px solid #f1f5f9',flexShrink:0,overflowX:'auto'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'10px 16px',border:'none',cursor:'pointer',fontSize:12,fontWeight:tab===t.id?700:400,color:tab===t.id?'#2563eb':'#64748b',background:'transparent',borderBottom:tab===t.id?'2px solid #2563eb':'2px solid transparent',whiteSpace:'nowrap'}}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:18}}>
          {tab==='users'        &&<UsersTab        tenant={tenant} onUpdate={onUpdate}/>}
          {tab==='features'     &&<FeaturesTab     tenant={tenant} onUpdate={onUpdate}/>}
          {tab==='subscription' &&<SubscriptionTab tenant={tenant} onUpdate={onUpdate}/>}
          {tab==='invoices'     &&<InvoicesTab     tenant={tenant} onUpdate={onUpdate}/>}
        </div>
      </div>
    </div>
  );
}

// ── TENANT FORM ──────────────────────────────────────────────────────────────
function TenantForm({tenant,onSave,onClose}:{tenant:Tenant|null;onSave:(t:Tenant)=>void;onClose:()=>void}){
  const [name,  setName]  =useState(tenant?.name??'');
  const [slug,  setSlug]  =useState(tenant?.slug??'');
  const [plan,  setPlan]  =useState<Tenant['plan']>(tenant?.plan??'starter');
  const [active,setActive]=useState(tenant?.active??true);
  const save=()=>{
    if(!name.trim()||!slug.trim()) return;
    const lim=PLAN_LIMITS[plan];
    const base={kanban:true,workitems:true,create:true,bot:true,reports:true};
    const baseSub:Subscription={
      status:'trialling',trialStart:td(),trialEnd:'',currentPeriodStart:td(),currentPeriodEnd:'',
      autoRenew:true,billingEmail:'',billingName:'',
      itemCount:0,itemLimit:lim.items,userCount:0,userLimit:lim.users,aiCalls:0,aiCallLimit:lim.aiCalls,invoices:[],
    };
    const t:Tenant=tenant
      ?{...tenant,name:name.trim(),slug:slug.trim().toLowerCase(),plan,active}
      :{id:gId(),name:name.trim(),slug:slug.trim().toLowerCase(),plan,active,createdAt:td(),features:base,users:[],subscription:baseSub};
    onSave(t);
  };
  return(
    <Modal title={tenant?`Edit - ${tenant.name}`:'New Tenant'} onClose={onClose}>
      <FL label="Tenant Name"><input value={name} onChange={e=>setName(e.target.value)} style={inp} autoFocus placeholder="e.g. Acme Corporation"/></FL>
      <FL label="Slug">
        <input value={slug} onChange={e=>setSlug(e.target.value.replace(/[^a-z0-9-]/g,''))} style={inp} placeholder="e.g. acme-corp"/>
        <div style={{fontSize:10,color:'#94a3b8',marginTop:3}}>Lowercase, numbers and hyphens only</div>
      </FL>
      <FL label="Plan">
        <select value={plan} onChange={e=>setPlan(e.target.value as Tenant['plan'])} style={sel}>
          <option value="starter">Starter - {fmtGBP(PLAN_PRICE.starter)}/mo</option>
          <option value="pro">Pro - {fmtGBP(PLAN_PRICE.pro)}/mo</option>
          <option value="enterprise">Enterprise - {fmtGBP(PLAN_PRICE.enterprise)}/mo</option>
        </select>
      </FL>
      <FL label="Status">
        <div style={{display:'flex',alignItems:'center',gap:8}}><Toggle on={active} onToggle={()=>setActive((a:boolean)=>!a)}/><span style={{fontSize:12,color:active?'#16a34a':'#94a3b8',fontWeight:600}}>{active?'Active':'Inactive'}</span></div>
      </FL>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:4}}>
        <button onClick={onClose} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
        <button onClick={save} disabled={!name.trim()||!slug.trim()} style={{padding:'7px 14px',borderRadius:7,border:'none',background:'#2563eb',color:'white',fontSize:12,fontWeight:600,cursor:'pointer',opacity:name.trim()&&slug.trim()?1:0.4}}>{tenant?'Save':'Create Tenant'}</button>
      </div>
    </Modal>
  );
}

// ── TENANT ROW ───────────────────────────────────────────────────────────────
function TenantRow({tenant,onEdit,onToggleActive,onPreview,onManage}:{tenant:Tenant;onEdit:()=>void;onToggleActive:()=>void;onPreview:()=>void;onManage:()=>void}){
  const ps=PLAN_STYLE[tenant.plan];
  const ss=SUB_STATUS_STYLE[tenant.subscription.status];
  const enabledCount=FEATURE_DEFS.filter(f=>tenant.features[f.key]).length;
  const hasOverdue=tenant.subscription.invoices.some(i=>i.status==='overdue');
  return(
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,border:`1px solid ${hasOverdue?'#fecaca':'#e2e8f0'}`,background:tenant.active?'white':'#f8fafc',opacity:tenant.active?1:0.72}}>
      <div style={{width:8,height:8,borderRadius:'50%',background:tenant.active?'#22c55e':'#cbd5e1',flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2,flexWrap:'wrap'}}>
          <span style={{fontSize:13,fontWeight:600,color:'#111827'}}>{tenant.name}</span>
          <Pill label={tenant.plan} color={ps.color} bg={ps.bg}/>
          <Pill label={ss.label}   color={ss.color} bg={ss.bg}/>
          {!tenant.active&&<Pill label="Suspended" color="#94a3b8" bg="#f1f5f9"/>}
          {hasOverdue&&<Pill label="Overdue Invoice" color="#dc2626" bg="#fef2f2"/>}
        </div>
        <div style={{fontSize:11,color:'#94a3b8'}}>
          <code style={{fontFamily:'monospace',background:'#f1f5f9',padding:'0 4px',borderRadius:3,fontSize:10}}>{tenant.slug}</code>
          &nbsp;|&nbsp;{tenant.users.length} user{tenant.users.length!==1?'s':''}
          &nbsp;|&nbsp;{enabledCount}/{FEATURE_DEFS.length} modules
          &nbsp;|&nbsp;{tenant.subscription.itemCount} items
        </div>
      </div>
      <div style={{display:'flex',gap:3,flexShrink:0}}>
        {FEATURE_DEFS.map(fd=>(
          <span key={fd.key} title={`${fd.label}: ${tenant.features[fd.key]?'On':'Off'}`} style={{fontSize:13,opacity:tenant.features[fd.key]?1:0.18}}>
            {FEATURE_EMOJI[fd.key]}
          </span>
        ))}
      </div>
      <div style={{display:'flex',gap:6,flexShrink:0}}>
        <button onClick={onPreview} style={{padding:'5px 10px',borderRadius:6,border:'1px solid #bfdbfe',background:'#eff6ff',color:'#1d4ed8',fontSize:11,fontWeight:600,cursor:'pointer'}}>Preview</button>
        <button onClick={onManage}  style={{padding:'5px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'white',color:'#374151',fontSize:11,fontWeight:600,cursor:'pointer'}}>Manage</button>
        <button onClick={onEdit}    style={{padding:'5px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'white',color:'#374151',fontSize:11,fontWeight:600,cursor:'pointer'}}>Edit</button>
        {tenant.slug!=='strat101'&&<button onClick={onToggleActive} style={{padding:'5px 10px',borderRadius:6,border:'none',background:tenant.active?'#fef2f2':'#f0fdf4',color:tenant.active?'#dc2626':'#16a34a',fontSize:11,fontWeight:600,cursor:'pointer'}}>{tenant.active?'Suspend':'Activate'}</button>}
      </div>
    </div>
  );
}

export interface AdminPanelProps {
  loggedUser:      string;
  onPreviewTenant: (tenant: Tenant) => void;
}

export default function AdminPanel({loggedUser,onPreviewTenant}:AdminPanelProps){
  const [tenants,    setTenants]    = useState<Tenant[]>([]);
  const [managing,   setManaging]   = useState<Tenant|null>(null);
  const [editing,    setEditing]    = useState<Tenant|null|'new'>(null);
  const [confirmDel, setConfirmDel] = useState<string|null>(null);
  const [search,     setSearch]     = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterSub,  setFilterSub]  = useState('all');
  const [dbLoading,  setDbLoading]  = useState(true);
  const [dbError,    setDbError]    = useState<string|null>(null);
  const [activeTab,  setActiveTab]  = useState<'tenants'|'approvals'>('tenants');
  // ── Load live data from Supabase on mount ──────────────────────────────────
  const reload = useCallback(async () => {
    setDbLoading(true); setDbError(null);
    try {
      const live = await fetchTenants();
      setTenants(live);
    } catch(e:any) {
      console.error('[AdminPanel] fetchTenants failed:', e.message);
      setDbError(e.message);
      // Do NOT fall back to seed data - show the real error
    } finally {
      setDbLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Pending approvals ──────────────────────────────────────────────────────
  const [pending,     setPending]     = useState<any[]>([]);
  const [pendingLoad, setPendingLoad] = useState(false);

  const loadPending = useCallback(async () => {
    setPendingLoad(true);
    try {
      const { data: users } = await supabase
        .from('tenant_users')
        .select('id, username, full_name, email, role, approval_requested_at, tenant_id, tenants(name,slug)')
        .eq('approval_status', 'pending')
        .order('approval_requested_at', { ascending: true });
      const { data: newTenants } = await supabase
        .from('tenants')
        .select('id, name, slug, approval_requested_at, requested_by')
        .eq('approval_status', 'pending')
        .order('approval_requested_at', { ascending: true });
      const { data: featReqs, error: featErr } = await supabase
        .from('feature_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (featErr) console.error('[AdminPanel] feature_requests query failed:', featErr.message);
      else console.log('[AdminPanel] feature_requests pending:', featReqs?.length ?? 0);
      setPending([
        ...(users    ?? []).map((u:any) => ({ ...u, _type:'user'    })),
        ...(newTenants ?? []).map((t:any) => ({ ...t, _type:'tenant'  })),
        ...(featReqs  ?? []).map((f:any) => ({ ...f, _type:'feature' })),
      ]);
    } finally { setPendingLoad(false); }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const approveUser = async (userId: string) => {
    const now = new Date().toISOString();
    const user = pending.find((p:any) => p.id === userId && p._type === 'user');
    await supabase.from('tenant_users').update({
      approval_status:'approved', active:true,
      approval_actioned_at:now, approval_actioned_by:loggedUser,
    }).eq('id', userId);
    if (user?.tenant_id) {
      const { data:t } = await supabase.from('tenants').select('approval_status').eq('id',user.tenant_id).single();
      if (t?.approval_status === 'pending') {
        await supabase.from('tenants').update({ approval_status:'approved', active:true }).eq('id', user.tenant_id);
      }
    }
    await Promise.all([loadPending(), reload()]);
  };

  const rejectUser = async (userId: string) => {
    await supabase.from('tenant_users').update({
      approval_status:'rejected', active:false,
      approval_actioned_at:new Date().toISOString(), approval_actioned_by:loggedUser,
    }).eq('id', userId);
    await loadPending();
  };

  const approveTenant = async (tenantId: string) => {
    await supabase.from('tenants').update({ approval_status:'approved', active:true }).eq('id', tenantId);
    await Promise.all([loadPending(), reload()]);
  };

  const approveFeatureRequest = async (req: any) => {
    // 1. Activate the feature on the tenant
    const featCol = `feat_${req.feature_key}`;
    await supabase.from('tenants').update({ [featCol]: true }).eq('id', req.tenant_id);
    // 2. Mark request as approved
    await supabase.from('feature_requests').update({
      status:'approved', actioned_by:loggedUser, actioned_at:new Date().toISOString(),
    }).eq('id', req.id);
    await Promise.all([loadPending(), reload()]);
  };

  const rejectFeatureRequest = async (req: any) => {
    await supabase.from('feature_requests').update({
      status:'rejected', actioned_by:loggedUser, actioned_at:new Date().toISOString(),
    }).eq('id', req.id);
    await loadPending();
  };

  // ── Optimistic update helper ───────────────────────────────────────────────
  const applyUpdate = (t:Tenant) => {
    setTenants(p=>p.map(x=>x.id===t.id?t:x));
    if(managing?.id===t.id) setManaging(t);
  };

  // ── Tenant mutations - write to DB then update local state ─────────────────
  const updateTenant = async (t:Tenant) => {
    applyUpdate(t);
    await apiSaveTenant(t);
  };

  const saveTenant = async (t:Tenant) => {
    setTenants(p=>p.some(x=>x.id===t.id)?p.map(x=>x.id===t.id?t:x):[...p,t]);
    setEditing(null);
    await apiSaveTenant(t);
  };

  const deleteTenant = async (id:string) => {
    setTenants(p=>p.filter(t=>t.id!==id));
    if(managing?.id===id) setManaging(null);
    setConfirmDel(null);
    await apiDeleteTenant(id);
  };

  // ── Toggle active / suspend - dedicated API call ───────────────────────────
  const toggleActive = async (t:Tenant) => {
    const updated = {...t, active:!t.active};
    applyUpdate(updated);
    await apiSuspendTenant(t.id, !t.active);
  };

  const filtered=tenants.filter(t=>{
    const ms=t.name.toLowerCase().includes(search.toLowerCase())||t.slug.includes(search.toLowerCase());
    const mp=filterPlan==='all'||t.plan===filterPlan;
    const ms2=filterSub==='all'||t.subscription.status===filterSub;
    return ms&&mp&&ms2;
  });

  const active=tenants.filter(t=>t.active).length;
  const totalUsers=tenants.reduce((s,t)=>s+t.users.length,0);
  const mrr=tenants.filter(t=>t.active&&t.subscription.status==='active').reduce((s,t)=>s+PLAN_PRICE[t.plan],0);
  const overdueCount=tenants.filter(t=>t.subscription.invoices.some(i=>i.status==='overdue')).length;

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#f8fafc',fontFamily:'system-ui,sans-serif',fontSize:13}}>
      {/* ── Loading / error banner ── */}
      {dbLoading && (
        <div style={{padding:'8px 20px',background:'#eff6ff',borderBottom:'1px solid #bfdbfe',fontSize:12,color:'#1d4ed8',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span>⏳</span> Loading tenants from database…
        </div>
      )}
      {dbError && (
        <div style={{padding:'8px 20px',background:'#fef2f2',borderBottom:'1px solid #fecaca',fontSize:12,color:'#dc2626',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span>⚠</span> {dbError} - showing cached data.
          <button onClick={reload} style={{marginLeft:8,padding:'2px 10px',borderRadius:5,border:'1px solid #fca5a5',background:'white',color:'#dc2626',fontSize:11,cursor:'pointer'}}>Retry</button>
        </div>
      )}

      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:'#111827'}}>Super Admin Console</div>
          <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>Logged in as <strong style={{color:'#374151'}}>{loggedUser}</strong> | {tenants.length} tenants | {totalUsers} users</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>setActiveTab('tenants')}
            style={{padding:'6px 12px',borderRadius:7,border:'none',background:activeTab==='tenants'?'#2563eb':'rgba(37,99,235,0.1)',color:activeTab==='tenants'?'white':'#2563eb',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            Tenants
          </button>
          <button onClick={()=>setActiveTab('approvals')}
            style={{padding:'6px 12px',borderRadius:7,border:'none',background:activeTab==='approvals'?'#dc2626':'rgba(220,38,38,0.1)',color:activeTab==='approvals'?'white':'#dc2626',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            Approvals
            {pending.length>0&&<span style={{background:'white',color:'#dc2626',borderRadius:99,padding:'1px 6px',fontSize:10,fontWeight:700}}>{pending.length}</span>}
          </button>
          {activeTab==='tenants'&&<button onClick={()=>setEditing('new')} style={{padding:'6px 12px',borderRadius:7,border:'none',background:'#2563eb',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>+ New Tenant</button>}
        </div>
      </div>

      {activeTab==='tenants'&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,padding:'14px 20px 0',flexShrink:0}}>
        {[
          {label:'Tenants',     value:String(tenants.length), color:'#2563eb'},
          {label:'Active',      value:String(active),          color:'#16a34a'},
          {label:'MRR',         value:fmtGBP(mrr),             color:'#7c3aed'},
          {label:'Total Users', value:String(totalUsers),      color:'#0284c7'},
          {label:'Overdue',     value:String(overdueCount),    color:overdueCount>0?'#dc2626':'#94a3b8'},
        ].map(s=>(
          <div key={s.label} style={{background:'white',borderRadius:9,border:'1px solid #e2e8f0',padding:'10px 14px'}}>
            <div style={{fontSize:18,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em',marginTop:1}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'14px 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <div style={{fontSize:12,fontWeight:600,color:'#374151',flex:1}}>Tenants ({filtered.length})</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
            style={{border:'1px solid #e2e8f0',borderRadius:7,padding:'5px 10px',fontSize:12,outline:'none',width:140}}/>
          <select value={filterPlan} onChange={e=>setFilterPlan(e.target.value)} style={{...sel,width:'auto',fontSize:11,padding:'5px 8px'}}>
            <option value="all">All Plans</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select value={filterSub} onChange={e=>setFilterSub(e.target.value)} style={{...sel,width:'auto',fontSize:11,padding:'5px 8px'}}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trialling">Trialling</option>
            <option value="past_due">Past Due</option>
            <option value="cancelled">Cancelled</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        {!filtered.length
          ?<div style={{textAlign:'center',padding:'48px 0',color:'#94a3b8',fontSize:12}}>No tenants found</div>
          :<div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(t=>(
              <TenantRow key={t.id} tenant={t}
                onEdit={()=>setEditing(t)}
                onToggleActive={()=>toggleActive(t)}
                onPreview={()=>onPreviewTenant(t)}
                onManage={()=>setManaging(t)}
              />
            ))}
          </div>
        }
      </div>
      </>
      }

      {activeTab==='approvals'&&(
        <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
          {pendingLoad?(
            <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>Loading…</div>
          ):pending.length===0?(
            <div style={{textAlign:'center',padding:60}}>
              <div style={{fontSize:40,marginBottom:12}}>✅</div>
              <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:6}}>No pending approvals</div>
              <div style={{fontSize:12,color:'#94a3b8'}}>All account requests have been reviewed.</div>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:720}}>
              {pending.map((item:any)=>(
                <div key={item.id} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:10,padding:'14px 16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                        <span style={{fontSize:18}}>{item._type==='user'?'👤':item._type==='tenant'?'🏢':'✨'}</span>
                        <span style={{fontSize:13,fontWeight:700,color:'#111827'}}>
                          {item._type==='user'?`${item.full_name} (@${item.username})`:item._type==='tenant'?`New Company: ${item.name}`:`Feature Request: ${item.feature_key}`}
                        </span>
                        <span style={{padding:'2px 8px',borderRadius:999,background:'#fef3c7',color:'#92400e',fontSize:10,fontWeight:700}}>PENDING</span>
                      </div>
                      {item._type==='feature'&&(
                        <div style={{fontSize:12,color:'#64748b',display:'flex',flexDirection:'column',gap:3}}>
                          <span>🏢 Company: {item.tenant_name}</span>
                          <span>👤 Requested by: {item.requested_by}</span>
                          <span>💬 Reason: {item.reason}</span>
                          <span>📅 Requested: {item.created_at?new Date(item.created_at).toLocaleString():'Unknown'}</span>
                        </div>
                      )}
                      {item._type==='user'&&(
                        <div style={{fontSize:12,color:'#64748b',display:'flex',flexDirection:'column',gap:3}}>
                          <span>📧 {item.email}</span>
                          <span>🏢 Company: {item.tenants?.name??'Unknown'}</span>
                          <span>📅 Requested: {item.approval_requested_at?new Date(item.approval_requested_at).toLocaleString():'Unknown'}</span>
                        </div>
                      )}
                      {item._type==='tenant'&&(
                        <div style={{fontSize:12,color:'#64748b',display:'flex',flexDirection:'column',gap:3}}>
                          <span>👤 Requested by: {item.requested_by}</span>
                          <span>📅 Requested: {item.approval_requested_at?new Date(item.approval_requested_at).toLocaleString():'Unknown'}</span>
                        </div>
                      )}
                    </div>
                    <div style={{display:'flex',gap:8,flexShrink:0,marginTop:4}}>
                      {item._type==='user'&&<>
                        <button onClick={()=>approveUser(item.id)}
                          style={{padding:'6px 14px',borderRadius:7,border:'none',background:'#16a34a',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                          ✔ Approve
                        </button>
                        <button onClick={()=>rejectUser(item.id)}
                          style={{padding:'6px 14px',borderRadius:7,border:'1px solid #fca5a5',background:'white',color:'#dc2626',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                          ✘ Reject
                        </button>
                      </>}
                      {item._type==='tenant'&&(
                        <button onClick={()=>approveTenant(item.id)}
                          style={{padding:'6px 14px',borderRadius:7,border:'none',background:'#16a34a',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                          ✔ Approve Company
                        </button>
                      )}
                      {item._type==='feature'&&<>
                        <button onClick={()=>approveFeatureRequest(item)}
                          style={{padding:'6px 14px',borderRadius:7,border:'none',background:'#16a34a',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                          ✔ Approve &amp; Activate
                        </button>
                        <button onClick={()=>rejectFeatureRequest(item)}
                          style={{padding:'6px 14px',borderRadius:7,border:'1px solid #fca5a5',background:'white',color:'#dc2626',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                          ✘ Reject
                        </button>
                      </>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {managing   &&<ManageDrawer tenant={managing} onClose={()=>setManaging(null)} onUpdate={updateTenant}/>}
      {editing    &&<TenantForm tenant={editing==='new'?null:editing} onSave={saveTenant} onClose={()=>setEditing(null)}/>}
      {confirmDel &&(
        <Modal title="Delete Tenant" onClose={()=>setConfirmDel(null)} width={360}>
          <p style={{fontSize:12,color:'#374151',marginBottom:16}}>
            Permanently delete <strong>{tenants.find(t=>t.id===confirmDel)?.name}</strong>? This cannot be undone.
          </p>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setConfirmDel(null)} style={{padding:'6px 12px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
            <button onClick={()=>deleteTenant(confirmDel)} style={{padding:'6px 12px',borderRadius:7,border:'none',background:'#dc2626',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
