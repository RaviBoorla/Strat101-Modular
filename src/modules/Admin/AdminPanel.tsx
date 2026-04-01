import React, { useState } from "react";
import { Tenant, TenantUser, TenantFeatures, FeatureKey, UserRole } from "../../types";
import { gId, td } from "../../utils";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const FEATURE_DEFS: { key: FeatureKey; label: string; icon: string; desc: string }[] = [
  { key: 'kanban',    label: 'Kanban',     icon: '🗂️', desc: 'Drag-and-drop board views'      },
  { key: 'workitems', label: 'Work Items', icon: '📦', desc: 'Full work item list & hierarchy' },
  { key: 'create',    label: 'Create',     icon: '➕', desc: 'Create new work items'           },
  { key: 'bot',       label: 'AI Assist',  icon: '🤖', desc: 'Claude-powered portfolio AI'    },
  { key: 'reports',   label: 'Reports',    icon: '📈', desc: 'Report builder & exports'        },
];

const PLAN_COLOURS: Record<string, string> = {
  enterprise: '#4f46e5',
  pro:        '#0284c7',
  starter:    '#16a34a',
};
const PLAN_BG: Record<string, string> = {
  enterprise: '#eef2ff',
  pro:        '#e0f2fe',
  starter:    '#dcfce7',
};
const ROLE_COLOURS: Record<UserRole, string> = {
  admin:  '#dc2626',
  editor: '#d97706',
  viewer: '#2563eb',
};
const ROLE_BG: Record<UserRole, string> = {
  admin:  '#fef2f2',
  editor: '#fffbeb',
  viewer: '#eff6ff',
};

// ─── SMALL HELPERS ────────────────────────────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color, background: bg, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#2563eb' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        opacity: disabled ? 0.45 : 1,
      }}>
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}/>
    </button>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{title}</div>
      {action}
    </div>
  );
}

function Btn({ children, onClick, variant = 'primary', small = false, disabled = false }:
  { children: React.ReactNode; onClick?: () => void; variant?: 'primary'|'danger'|'ghost'|'success'; small?: boolean; disabled?: boolean }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: 'white', border: 'none' },
    danger:  { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
    ghost:   { background: 'white', color: '#374151', border: '1px solid #e2e8f0' },
    success: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...styles[variant], padding: small ? '4px 10px' : '7px 14px', borderRadius: 8, fontSize: small ? 11 : 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  );
}

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 480 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: width, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

// ─── TENANT FORM MODAL ────────────────────────────────────────────────────────
function TenantFormModal({ tenant, onSave, onClose }:
  { tenant?: Tenant | null; onSave: (t: Tenant) => void; onClose: () => void }) {
  const isNew = !tenant;
  const [name,    setName]    = useState(tenant?.name    ?? '');
  const [slug,    setSlug]    = useState(tenant?.slug    ?? '');
  const [plan,    setPlan]    = useState<Tenant['plan']>(tenant?.plan ?? 'starter');
  const [active,  setActive]  = useState(tenant?.active  ?? true);

  const save = () => {
    if (!name.trim() || !slug.trim()) return;
    const mkF = (o = {}) => ({ kanban: true, workitems: true, create: true, bot: true, reports: true, ...o });
    const t: Tenant = tenant
      ? { ...tenant, name: name.trim(), slug: slug.trim().toLowerCase(), plan, active }
      : { id: gId(), name: name.trim(), slug: slug.trim().toLowerCase(), plan, active, createdAt: td(), features: mkF(), users: [] };
    onSave(t);
  };

  return (
    <Modal title={isNew ? '➕ New Tenant' : `✏️ Edit — ${tenant!.name}`} onClose={onClose}>
      <Field label="Tenant Name">
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="e.g. Acme Corporation" autoFocus/>
      </Field>
      <Field label="Slug (URL-safe ID)">
        <input value={slug} onChange={e => setSlug(e.target.value.replace(/[^a-z0-9-]/g,''))} style={inputStyle} placeholder="e.g. acme-corp"/>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Lowercase letters, numbers and hyphens only</div>
      </Field>
      <Field label="Subscription Plan">
        <select value={plan} onChange={e => setPlan(e.target.value as Tenant['plan'])} style={selectStyle}>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </Field>
      <Field label="Status">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Toggle checked={active} onChange={() => setActive(a => !a)}/>
          <span style={{ fontSize: 12, color: active ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>{active ? 'Active' : 'Inactive'}</span>
        </div>
      </Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!name.trim() || !slug.trim()}>{isNew ? 'Create Tenant' : 'Save Changes'}</Btn>
      </div>
    </Modal>
  );
}

// ─── USER FORM MODAL ──────────────────────────────────────────────────────────
function UserFormModal({ user, tenantName, onSave, onClose }:
  { user?: TenantUser | null; tenantName: string; onSave: (u: TenantUser) => void; onClose: () => void }) {
  const isNew = !user;
  const [username, setUsername] = useState(user?.username ?? '');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email,    setEmail]    = useState(user?.email    ?? '');
  const [role,     setRole]     = useState<UserRole>(user?.role ?? 'viewer');
  const [active,   setActive]   = useState(user?.active   ?? true);

  const save = () => {
    if (!username.trim() || !fullName.trim()) return;
    const u: TenantUser = user
      ? { ...user, username: username.trim(), fullName: fullName.trim(), email: email.trim(), role, active }
      : { id: gId(), username: username.trim(), fullName: fullName.trim(), email: email.trim(), role, active, createdAt: td() };
    onSave(u);
  };

  return (
    <Modal title={isNew ? `➕ New User — ${tenantName}` : `✏️ Edit — ${user!.fullName}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Username">
          <input value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} placeholder="e.g. john.doe" autoFocus/>
        </Field>
        <Field label="Full Name">
          <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} placeholder="e.g. John Doe"/>
        </Field>
      </div>
      <Field label="Email">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="e.g. john@company.com"/>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Role">
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} style={selectStyle}>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </Field>
        <Field label="Status">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <Toggle checked={active} onChange={() => setActive(a => !a)}/>
            <span style={{ fontSize: 12, color: active ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>{active ? 'Active' : 'Inactive'}</span>
          </div>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!username.trim() || !fullName.trim()}>{isNew ? 'Add User' : 'Save Changes'}</Btn>
      </div>
    </Modal>
  );
}

// ─── FEATURES TAB ─────────────────────────────────────────────────────────────
function FeaturesTab({ tenant, onUpdate }: { tenant: Tenant; onUpdate: (t: Tenant) => void }) {
  const toggleFeature = (key: FeatureKey) => {
    onUpdate({ ...tenant, features: { ...tenant.features, [key]: !tenant.features[key] } });
  };

  const allOn  = FEATURE_DEFS.every(f => tenant.features[f.key]);
  const allOff = FEATURE_DEFS.every(f => !tenant.features[f.key]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Module Features</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Toggle which modules are visible to users of <strong>{tenant.name}</strong></div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="success" small onClick={() => onUpdate({ ...tenant, features: { kanban:true, workitems:true, create:true, bot:true, reports:true } })}>All On</Btn>
          <Btn variant="danger"  small onClick={() => onUpdate({ ...tenant, features: { kanban:false, workitems:false, create:false, bot:false, reports:false } })}>All Off</Btn>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FEATURE_DEFS.map(fd => {
          const enabled = tenant.features[fd.key];
          return (
            <div key={fd.key} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 16px', borderRadius: 12,
              border: `1px solid ${enabled ? '#bfdbfe' : '#e2e8f0'}`,
              background: enabled ? '#f0f9ff' : '#f8fafc',
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 22, width: 30, textAlign: 'center', flexShrink: 0 }}>{fd.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? '#1e40af' : '#374151' }}>{fd.label}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{fd.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: enabled ? '#16a34a' : '#94a3b8', minWidth: 42, textAlign: 'right' }}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
                <Toggle checked={enabled} onChange={() => toggleFeature(fd.key)}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary pill row */}
      <div style={{ marginTop: 18, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Active:</span>
        {FEATURE_DEFS.filter(f => tenant.features[f.key]).map(f => (
          <span key={f.key} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8' }}>{f.icon} {f.label}</span>
        ))}
        {FEATURE_DEFS.every(f => !tenant.features[f.key]) && <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>No features enabled</span>}
      </div>
    </div>
  );
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────
function UsersTab({ tenant, onUpdate }: { tenant: Tenant; onUpdate: (t: Tenant) => void }) {
  const [userModal, setUserModal] = useState<'new' | TenantUser | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);

  const saveUser = (u: TenantUser) => {
    const exists = tenant.users.some(x => x.id === u.id);
    onUpdate({ ...tenant, users: exists ? tenant.users.map(x => x.id === u.id ? u : x) : [...tenant.users, u] });
    setUserModal(null);
  };

  const deleteUser = (id: string) => {
    onUpdate({ ...tenant, users: tenant.users.filter(u => u.id !== id) });
    setDeleteId(null);
  };

  return (
    <div>
      <SectionHeader
        title={`Users (${tenant.users.length})`}
        action={<Btn small onClick={() => setUserModal('new')}>+ Add User</Btn>}
      />

      {!tenant.users.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>No users yet</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Click "Add User" to create the first user for this tenant</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tenant.users.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 10, border: '1px solid #e2e8f0', background: u.active ? 'white' : '#f8fafc',
              opacity: u.active ? 1 : 0.7,
            }}>
              {/* Avatar */}
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.active ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: u.active ? 'white' : '#94a3b8', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                {u.fullName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{u.fullName}</span>
                  <Badge label={u.role} color={ROLE_COLOURS[u.role]} bg={ROLE_BG[u.role]}/>
                  {!u.active && <Badge label="Inactive" color="#94a3b8" bg="#f1f5f9"/>}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  @{u.username}{u.email ? ` · ${u.email}` : ''} · Since {u.createdAt}
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Btn variant="ghost" small onClick={() => setUserModal(u)}>Edit</Btn>
                <Btn variant="danger" small onClick={() => setDeleteId(u.id)}>Remove</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role legend */}
      <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {(['admin','editor','viewer'] as UserRole[]).map(r => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Badge label={r} color={ROLE_COLOURS[r]} bg={ROLE_BG[r]}/>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              {r === 'admin' ? 'Full access + admin' : r === 'editor' ? 'Create & edit items' : 'Read-only access'}
            </span>
          </div>
        ))}
      </div>

      {/* User form modal */}
      {userModal && (
        <UserFormModal
          user={userModal === 'new' ? null : userModal}
          tenantName={tenant.name}
          onSave={saveUser}
          onClose={() => setUserModal(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <Modal title="⚠️ Remove User" onClose={() => setDeleteId(null)} width={380}>
          <p style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>
            Are you sure you want to remove <strong>{tenant.users.find(u => u.id === deleteId)?.fullName}</strong> from {tenant.name}? This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => deleteUser(deleteId)}>Remove User</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TENANT DETAIL DRAWER ─────────────────────────────────────────────────────
function TenantDrawer({ tenant, onClose, onUpdate }:
  { tenant: Tenant; onClose: () => void; onUpdate: (t: Tenant) => void }) {
  const [tab, setTab] = useState<'features' | 'users'>('features');

  const enabledCount = Object.values(tenant.features).filter(Boolean).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
      background: 'rgba(15,23,42,0.45)',
    }} onClick={onClose}>
      <div style={{ flex: 1 }}/>
      <div style={{
        width: '100%', maxWidth: 600, background: 'white',
        display: 'flex', flexDirection: 'column', height: '100%',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>

        {/* Drawer header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{tenant.name}</div>
                <Badge label={tenant.plan} color={PLAN_COLOURS[tenant.plan]} bg={PLAN_BG[tenant.plan]}/>
                <Badge label={tenant.active ? 'Active' : 'Inactive'} color={tenant.active ? '#16a34a' : '#94a3b8'} bg={tenant.active ? '#f0fdf4' : '#f1f5f9'}/>
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Slug: <code style={{ fontFamily:'monospace', background:'#f1f5f9', padding:'1px 5px', borderRadius:4 }}>{tenant.slug}</code>
                &nbsp;·&nbsp; {tenant.users.length} user{tenant.users.length !== 1 ? 's' : ''}
                &nbsp;·&nbsp; {enabledCount}/{FEATURE_DEFS.length} features enabled
                &nbsp;·&nbsp; Created {tenant.createdAt}
              </div>
            </div>
            <button onClick={onClose} style={{ border:'none', background:'none', fontSize:22, lineHeight:1, cursor:'pointer', color:'#94a3b8', flexShrink:0 }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          {([['features','🔧 Features'],['users','👥 Users']] as const).map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding:'10px 20px', border:'none', cursor:'pointer', fontSize:13, fontWeight:tab===t?700:500,
                color:tab===t?'#2563eb':'#64748b', background:'transparent',
                borderBottom: tab===t ? '2px solid #2563eb' : '2px solid transparent' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {tab === 'features' && <FeaturesTab tenant={tenant} onUpdate={onUpdate}/>}
          {tab === 'users'    && <UsersTab    tenant={tenant} onUpdate={onUpdate}/>}
        </div>
      </div>
    </div>
  );
}

// ─── TENANT LIST ──────────────────────────────────────────────────────────────
function TenantList({ tenants, onSelect, onEdit, onDelete, onToggleActive }:
  { tenants: Tenant[]; onSelect: (t: Tenant) => void; onEdit: (t: Tenant) => void; onDelete: (id: string) => void; onToggleActive: (id: string) => void }) {

  const [search, setSearch] = useState('');
  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const active   = tenants.filter(t => t.active).length;
  const totalU   = tenants.reduce((s, t) => s + t.users.length, 0);

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Tenants',   value: tenants.length,  icon: '🏢', color: '#2563eb', bg: '#eff6ff' },
          { label: 'Active Tenants',  value: active,           icon: '✅', color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Total Users',     value: totalU,           icon: '👥', color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Enterprise Plans',value: tenants.filter(t => t.plan==='enterprise').length, icon: '⭐', color: '#d97706', bg: '#fffbeb' },
        ].map(s => (
          <div key={s.label} style={{ padding:'12px 14px', borderRadius:12, border:`1px solid ${s.bg}`, background:s.bg }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <SectionHeader
        title={`Tenants (${filtered.length}${filtered.length !== tenants.length ? ` of ${tenants.length}` : ''})`}
        action={
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants…"
              style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px', fontSize:12, outline:'none', width:180 }}/>
          </div>
        }
      />

      {!filtered.length ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'#94a3b8' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🏢</div>
          <div style={{ fontSize:14, fontWeight:600 }}>No tenants found</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(t => {
            const enabledCount = Object.values(t.features).filter(Boolean).length;
            return (
              <div key={t.id} style={{
                display:'flex', alignItems:'center', gap:14, padding:'12px 16px',
                borderRadius:12, border:'1px solid #e2e8f0', background: t.active ? 'white' : '#f8fafc',
                opacity: t.active ? 1 : 0.75,
                cursor:'pointer', transition:'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}
              onClick={() => onSelect(t)}>

                {/* Icon */}
                <div style={{ width:42, height:42, borderRadius:12, background: t.active ? 'linear-gradient(135deg,#2563eb,#4f46e5)' : '#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  🏢
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap', marginBottom:3 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{t.name}</span>
                    <Badge label={t.plan} color={PLAN_COLOURS[t.plan]} bg={PLAN_BG[t.plan]}/>
                    <Badge label={t.active ? 'Active' : 'Inactive'} color={t.active ? '#16a34a' : '#94a3b8'} bg={t.active ? '#f0fdf4' : '#f1f5f9'}/>
                  </div>
                  <div style={{ fontSize:11, color:'#64748b' }}>
                    <code style={{ fontFamily:'monospace', background:'#f1f5f9', padding:'1px 4px', borderRadius:3, fontSize:10 }}>{t.slug}</code>
                    &nbsp;·&nbsp; {t.users.length} user{t.users.length !== 1 ? 's' : ''}
                    &nbsp;·&nbsp; {enabledCount}/{FEATURE_DEFS.length} modules
                    &nbsp;·&nbsp; Since {t.createdAt}
                  </div>
                </div>

                {/* Feature dots */}
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  {FEATURE_DEFS.map(fd => (
                    <span key={fd.key} title={`${fd.label}: ${t.features[fd.key] ? 'On' : 'Off'}`}
                      style={{ fontSize:14, opacity: t.features[fd.key] ? 1 : 0.22 }}>
                      {fd.icon}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                  <Btn variant="ghost" small onClick={() => onEdit(t)}>Edit</Btn>
                  <Btn variant={t.active ? 'danger' : 'success'} small onClick={() => onToggleActive(t.id)}>
                    {t.active ? 'Suspend' : 'Activate'}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN PANEL (ROOT) ───────────────────────────────────────────────────────
interface AdminPanelProps {
  initialTenants: Tenant[];
  loggedUser: string;
}

export default function AdminPanel({ initialTenants, loggedUser }: AdminPanelProps) {
  const [tenants,      setTenants]      = useState<Tenant[]>(initialTenants);
  const [selectedT,    setSelectedT]    = useState<Tenant | null>(null);
  const [tenantModal,  setTenantModal]  = useState<'new' | Tenant | null>(null);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);

  const saveTenant = (t: Tenant) => {
    setTenants(p => p.some(x => x.id === t.id) ? p.map(x => x.id === t.id ? t : x) : [...p, t]);
    setTenantModal(null);
  };

  const updateTenant = (t: Tenant) => {
    setTenants(p => p.map(x => x.id === t.id ? t : x));
    if (selectedT?.id === t.id) setSelectedT(t);
  };

  const deleteTenant = (id: string) => {
    setTenants(p => p.filter(t => t.id !== id));
    if (selectedT?.id === id) setSelectedT(null);
    setDeleteId(null);
  };

  const toggleActive = (id: string) => {
    setTenants(p => p.map(t => t.id === id ? { ...t, active: !t.active } : t));
    if (selectedT?.id === id) setSelectedT(prev => prev ? { ...prev, active: !prev.active } : null);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f1f5f9', fontFamily:'system-ui,sans-serif' }}>
      {/* Admin header bar */}
      <div style={{ background:'linear-gradient(135deg,#0f172a,#1e3a5f)', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f59e0b,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>⚙️</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'white', letterSpacing:'-0.3px' }}>Strat101 Admin Console</div>
            <div style={{ fontSize:10, color:'#94a3b8' }}>Multi-Tenant Management · Logged in as <strong style={{color:'#fbbf24'}}>{loggedUser}</strong></div>
          </div>
        </div>
        <Btn onClick={() => setTenantModal('new')}>+ New Tenant</Btn>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>
        <TenantList
          tenants={tenants}
          onSelect={t => setSelectedT(t)}
          onEdit={t => setTenantModal(t)}
          onDelete={id => setDeleteId(id)}
          onToggleActive={toggleActive}
        />
      </div>

      {/* Tenant detail drawer */}
      {selectedT && (
        <TenantDrawer
          tenant={selectedT}
          onClose={() => setSelectedT(null)}
          onUpdate={updateTenant}
        />
      )}

      {/* Tenant create/edit modal */}
      {tenantModal && (
        <TenantFormModal
          tenant={tenantModal === 'new' ? null : tenantModal}
          onSave={saveTenant}
          onClose={() => setTenantModal(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <Modal title="⚠️ Delete Tenant" onClose={() => setDeleteId(null)} width={380}>
          <p style={{ fontSize:13, color:'#374151', marginBottom:20 }}>
            Permanently delete <strong>{tenants.find(t => t.id === deleteId)?.name}</strong> and all its users and data? This cannot be undone.
          </p>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Btn variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => deleteTenant(deleteId)}>Delete Tenant</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
