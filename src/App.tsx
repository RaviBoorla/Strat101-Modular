import React, { useState, useRef, useEffect, useCallback } from "react";

import { TYPES } from "./constants";
import { mkBlank, gId, tsNow, td } from "./utils";
import { TenantFeatures, Tenant } from "./types";
import { isAdminUser } from "./adminData";
import { supabase } from "./lib/supabase";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

import LoginScreen   from "./modules/Login/LoginScreen";
import BotPanel      from "./modules/AiAssist/BotPanel";
import WorkItemsView, { ListView } from "./modules/WorkItems/WorkItemsView";
import KanbanBoard   from "./modules/Kanban/KanbanBoard";
import ItemForm, { LinkDlg } from "./modules/Create/ItemForm";
import ReportBuilder from "./modules/Reports/ReportBuilder";
import AdminPanel    from "./modules/Admin/AdminPanel";

import TopNav         from "./components/TopNav";
import DetailPanel    from "./components/DetailPanel";
import CommandPalette from "./components/CommandPalette";

const ALL_FEATURES: TenantFeatures = {
  kanban: true, workitems: true, create: true, bot: true, reports: true,
};

// ─── SUPABASE DATA HELPERS ────────────────────────────────────────────────────

function dbRowToItem(
  row:      any,
  linkRows: any[],
  depRows:  any[],
  commRows: any[],
  attRows:  any[],
): any {
  const links = linkRows
    .filter(l => l.from_id === row.id || l.to_id === row.id)
    .map   (l => l.from_id === row.id ? l.to_id : l.from_id);
  const dependencies = depRows
    .filter(d => d.item_id === row.id)
    .map   (d => d.depends_on);
  const comments = commRows
    .filter(c => c.item_id === row.id)
    .map   (c => ({ id: c.id, text: c.text, ts: c.created_at }));
  const attachments = attRows
    .filter(a => a.item_id === row.id)
    .map   (a => ({ name: a.name, size: a.size, ext: a.ext,
                    storagePath: a.storage_path, uploadedAt: a.uploaded_at }));
  return {
    id: row.id, key: row.key, type: row.type,
    title:          row.title           ?? '',
    description:    row.description     ?? '',
    currentStatus:  row.current_status  ?? '',
    currentStatusAt:row.current_status_at ?? '',
    riskStatement:  row.risk_statement  ?? '',
    status:   row.status,   priority: row.priority,
    health:   row.health,   risk:     row.risk,
    impact:       row.impact        ?? '',
    impactType:   row.impact_type   ?? '',
    owner:        row.owner         ?? '',
    assigned:     row.assigned      ?? '',
    sponsor:      row.sponsor       ?? '',
    businessUnit: row.business_unit ?? '',
    approvedBudget: row.approved_budget ?? '',
    actualCost:     row.actual_cost     ?? '',
    startDate:  row.start_date  ?? '',
    endDate:    row.end_date    ?? '',
    progress:   row.progress    ?? 0,
    tags:       row.tags        ?? [],
    keyResult:  row.key_result  ?? '',
    updatedAt:  row.updated_at  ?? '',
    updatedBy:  row.updated_by  ?? '',
    links, dependencies, comments, attachments,
  };
}

async function loadItems(tenantId: string): Promise<any[]> {
  const [
    { data: rows  = [] }, { data: links = [] },
    { data: deps  = [] }, { data: comms = [] },
    { data: atts  = [] },
  ] = await Promise.all([
    supabase.from('work_items').select('*').eq('tenant_id', tenantId).order('created_at'),
    supabase.from('item_links').select('from_id, to_id').eq('tenant_id', tenantId),
    supabase.from('item_dependencies').select('item_id, depends_on').eq('tenant_id', tenantId),
    supabase.from('comments').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase.from('attachments').select('*').eq('tenant_id', tenantId),
  ]);
  return (rows ?? []).map((row: any) =>
    dbRowToItem(row, links ?? [], deps ?? [], comms ?? [], atts ?? [])
  );
}

async function persistItem(item: any, tenantId: string): Promise<void> {
  const { error } = await supabase.from('work_items').upsert({
    id: item.id, tenant_id: tenantId, key: item.key, type: item.type,
    title:             item.title            || '',
    description:       item.description      || null,
    current_status:    item.currentStatus    || null,
    current_status_at: item.currentStatusAt  || null,
    risk_statement:    item.riskStatement    || null,
    status: item.status, priority: item.priority,
    health: item.health, risk:     item.risk,
    impact:         item.impact        || null,
    impact_type:    item.impactType    || null,
    owner:          item.owner         || null,
    assigned:       item.assigned      || null,
    sponsor:        item.sponsor       || null,
    business_unit:  item.businessUnit  || null,
    approved_budget:item.approvedBudget|| null,
    actual_cost:    item.actualCost    || null,
    start_date:     item.startDate     || null,
    end_date:       item.endDate       || null,
    progress:       item.progress      ?? 0,
    tags:           item.tags          ?? [],
    key_result:     item.keyResult     || null,
    updated_at:     new Date().toISOString(),
    updated_by:     item.updatedBy     || null,
  });
  if (error) console.error('[DB] persistItem failed:', error.message);
}

async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('work_items').delete().eq('id', id);
  if (error) console.error('[DB] deleteItem failed:', error.message);
}

async function syncLinks(itemId: string, newLinks: string[], tenantId: string): Promise<void> {
  const { data: existing = [] } = await supabase
    .from('item_links').select('from_id, to_id')
    .or(`from_id.eq.${itemId},to_id.eq.${itemId}`)
    .eq('tenant_id', tenantId);
  const currentSet = new Set<string>(
    (existing ?? []).map((l: any) => (l.from_id === itemId ? l.to_id : l.from_id) as string)
  );
  const newSet = new Set(newLinks);
  for (const otherId of [...currentSet].filter(id => !newSet.has(id))) {
    await supabase.from('item_links').delete()
      .or(`and(from_id.eq.${itemId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${itemId})`);
  }
  const toAdd = newLinks.filter(id => !currentSet.has(id));
  if (toAdd.length > 0) {
    await supabase.from('item_links').upsert(
      toAdd.map(otherId => ({ from_id: itemId, to_id: otherId, tenant_id: tenantId }))
    );
  }
}

async function syncDeps(itemId: string, newDeps: string[], tenantId: string): Promise<void> {
  const { data: existing = [] } = await supabase
    .from('item_dependencies').select('depends_on').eq('item_id', itemId);
  const currentSet = new Set<string>((existing ?? []).map((d: any) => d.depends_on as string));
  const newSet = new Set(newDeps);
  for (const depId of [...currentSet].filter(id => !newSet.has(id))) {
    await supabase.from('item_dependencies').delete()
      .eq('item_id', itemId).eq('depends_on', depId);
  }
  const toAdd = newDeps.filter(id => !currentSet.has(id));
  if (toAdd.length > 0) {
    await supabase.from('item_dependencies').upsert(
      toAdd.map(depId => ({ item_id: itemId, depends_on: depId, tenant_id: tenantId }))
    );
  }
}

async function persistComment(itemId: string, text: string, tenantId: string, createdBy: string): Promise<void> {
  await supabase.from('comments').insert({
    id: gId(), item_id: itemId, tenant_id: tenantId, text, created_by: createdBy,
  });
}

async function deleteComment(commentId: string): Promise<void> {
  await supabase.from('comments').delete().eq('id', commentId);
}

// ─── PREVIEW BANNER ───────────────────────────────────────────────────────────

function PreviewBanner({ tenant, onExit }: { tenant: Tenant; onExit: () => void }) {
  return (
    <div style={{ background:'#fef3c7', borderBottom:'2px solid #f59e0b', padding:'6px 16px',
      display:'flex', alignItems:'center', gap:10, flexShrink:0, zIndex:50 }}>
      <span style={{ fontSize:14 }}>&#128065;&#65039;</span>
      <span style={{ fontSize:12, fontWeight:600, color:'#92400e' }}>
        Previewing: <strong>{tenant.name}</strong>
        &nbsp;&middot;&nbsp;
        {Object.entries(tenant.features).filter(([,v])=>v).map(([k])=>k).join(', ')} enabled
      </span>
      <button onClick={onExit} style={{ marginLeft:'auto', padding:'4px 12px', borderRadius:6,
        border:'1px solid #f59e0b', background:'white', color:'#92400e', fontSize:11,
        fontWeight:700, cursor:'pointer' }}>
        &larr; Back to Admin
      </button>
    </div>
  );
}

// ─── WORKSPACE ────────────────────────────────────────────────────────────────

function Workspace({
  loggedUser, isAdmin, features, previewTenant, onExitPreview, tenantId,
}: {
  loggedUser: string; isAdmin: boolean; features: TenantFeatures;
  previewTenant: Tenant | null; onExitPreview: () => void; tenantId: string | null;
}) {
  const [items,   setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState('kanban');
  const [workItemFilter, setWIF] = useState('all');
  const [sel,     setSel]   = useState<string|null>(null);
  const [dtab,    setDtab]  = useState('overview');
  const [form,    setForm]  = useState<any>(null);
  const [linkDlg, setLinkDlg] = useState<string|null>(null);
  const [linkQ,   setLinkQ]   = useState('');
  const [cmdOpen, setCmdOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected   = items.find(i => i.id === sel);
  const isListView = TYPES.includes(view);
  const isWorkItems = view === 'workitems';

  const refresh = useCallback(async () => {
    if (!tenantId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setItems(await loadItems(tenantId));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel(`ws:${tenantId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'work_items',        filter:`tenant_id=eq.${tenantId}` }, () => refresh())
      .on('postgres_changes', { event:'*', schema:'public', table:'comments',          filter:`tenant_id=eq.${tenantId}` }, () => refresh())
      .on('postgres_changes', { event:'*', schema:'public', table:'item_links',        filter:`tenant_id=eq.${tenantId}` }, () => refresh())
      .on('postgres_changes', { event:'*', schema:'public', table:'item_dependencies', filter:`tenant_id=eq.${tenantId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, refresh]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setCmdOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => { setView('kanban'); setSel(null); }, [features]);

  const LOGGED_IN = loggedUser || 'user';
  const stamp = (it: any) => ({ ...it, updatedAt: tsNow(), updatedBy: LOGGED_IN });

  const applyAndPersist = async (updated: any) => {
    setItems(p => p.some(x => x.id === updated.id)
      ? p.map(x => x.id === updated.id ? updated : x)
      : [...p, updated]);
    if (tenantId) {
      await persistItem(updated, tenantId);
      await syncLinks(updated.id, updated.links, tenantId);
      await syncDeps(updated.id, updated.dependencies, tenantId);
    }
  };

  const liveUpsert = (it: any) => {
    const s = stamp(it);
    setItems(p => p.some(x => x.id === s.id) ? p.map(x => x.id === s.id ? s : x) : [...p, s]);
  };

  const upsert = async (it: any) => {
    const s = stamp(it);
    await applyAndPersist(s);
    setForm(null); setSel(s.id);
    if (isListView || view === 'kanban') setView(s.type);
  };

  const remove = async (id: string) => {
    setItems(p => p.filter(i => i.id !== id).map(i => ({
      ...i,
      links:        i.links.filter((l: string) => l !== id),
      dependencies: i.dependencies.filter((d: string) => d !== id),
    })));
    if (sel === id) setSel(null);
    if (tenantId) await deleteItem(id);
  };

  const changeStatus = async (id: string, status: string) => {
    const item = items.find(i => i.id === id); if (!item) return;
    await applyAndPersist(stamp({ ...item, status }));
  };

  const changeField = async (id: string, field: string, value: any) => {
    const item = items.find(i => i.id === id); if (!item) return;
    await applyAndPersist(stamp({ ...item, [field]: value }));
  };

  const addLink = async (toId: string) => {
    if (!sel || toId === sel) return;
    const si = items.find(i => i.id === sel);
    const ti = items.find(i => i.id === toId);
    if (!si || !ti) return;
    setItems(p => p.map(i =>
      i.id === sel ? stamp({ ...i, links: [...new Set([...i.links, toId])] }) :
      i.id === toId ? stamp({ ...i, links: [...new Set([...i.links, sel])]  }) : i
    ));
    if (tenantId) await supabase.from('item_links').upsert({ from_id: sel, to_id: toId, tenant_id: tenantId });
    setLinkDlg(null);
  };

  const rmLink = async (lid: string) => {
    setItems(p => p.map(i => {
      if (i.id === sel) return stamp({ ...i, links: i.links.filter((l: string) => l !== lid) });
      if (i.id === lid) return stamp({ ...i, links: i.links.filter((l: string) => l !== sel) });
      return i;
    }));
    if (tenantId) await supabase.from('item_links').delete()
      .or(`and(from_id.eq.${sel},to_id.eq.${lid}),and(from_id.eq.${lid},to_id.eq.${sel})`);
  };

  const addDep = async (toId: string) => {
    if (!sel || toId === sel) return;
    const si = items.find(i => i.id === sel); if (!si) return;
    setItems(p => p.map(i => i.id === sel
      ? stamp({ ...i, dependencies: [...new Set([...i.dependencies, toId])] }) : i));
    if (tenantId) await supabase.from('item_dependencies').upsert({ item_id: sel, depends_on: toId, tenant_id: tenantId });
    setLinkDlg(null);
  };

  const rmDep = async (did: string) => {
    setItems(p => p.map(i => i.id === sel
      ? stamp({ ...i, dependencies: i.dependencies.filter((d: string) => d !== did) }) : i));
    if (tenantId) await supabase.from('item_dependencies').delete().eq('item_id', sel).eq('depends_on', did);
  };

  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  const addFile = async (f: File) => {
    if (!f || !sel) return;
    if (f.size > MAX_ATTACHMENT_BYTES) {
      const mb = (f.size / 1048576).toFixed(1);
      setItems(p => p.map(i => i.id === sel ? { ...i, _uploadError: `"${f.name}" is ${mb} MB \u2014 max 10 MB.` } : i));
      setTimeout(() => setItems(p => p.map(i => i.id === sel ? { ...i, _uploadError: undefined } : i)), 6000);
      return;
    }
    const sizeLabel = f.size < 1048576 ? Math.round(f.size / 1024) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB';
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    setItems(p => p.map(i => i.id === sel
      ? stamp({ ...i, attachments: [...i.attachments, { name: f.name, size: sizeLabel, ext, uploadedAt: td() }] }) : i));
    if (!tenantId) return;
    const storagePath = `${tenantId}/${sel}/${Date.now()}_${f.name}`;
    const { error: upErr } = await supabase.storage.from('attachments').upload(storagePath, f, { cacheControl:'3600', upsert:false });
    if (upErr) {
      console.error('Upload error:', upErr.message);
      setItems(p => p.map(i => i.id === sel
        ? { ...stamp({ ...i, attachments: i.attachments.filter((a: any) => a.name !== f.name) }), _uploadError: `Upload failed: ${upErr.message}` } : i));
      setTimeout(() => setItems(p => p.map(i => i.id === sel ? { ...i, _uploadError: undefined } : i)), 6000);
      return;
    }
    await supabase.from('attachments').insert({ item_id: sel, tenant_id: tenantId, name: f.name, size: sizeLabel, ext, storage_path: storagePath, uploaded_at: new Date().toISOString() });
  };

  const rmFile = async (idx: number) => {
    const si = items.find(i => i.id === sel); if (!si) return;
    const att = si.attachments[idx];
    setItems(p => p.map(i => i.id === sel
      ? stamp({ ...i, attachments: i.attachments.filter((_: any, j: number) => j !== idx) }) : i));
    if (!tenantId || !att) return;
    if (att.storagePath) await supabase.storage.from('attachments').remove([att.storagePath]);
    await supabase.from('attachments').delete().eq('item_id', sel).eq('tenant_id', tenantId).eq('name', att.name);
  };

  const addComment = async (text: string) => {
    if (!sel || !text.trim()) return;
    const newC = { id: gId(), text: text.trim(), ts: tsNow() };
    setItems(p => p.map(i => i.id === sel ? stamp({ ...i, comments: [newC, ...i.comments] }) : i));
    if (tenantId) await persistComment(sel, text.trim(), tenantId, LOGGED_IN);
  };

  const rmComment = async (cid: string) => {
    setItems(p => p.map(i => i.id === sel
      ? stamp({ ...i, comments: i.comments.filter((c: any) => c.id !== cid) }) : i));
    if (tenantId) await deleteComment(cid);
  };

  const nav    = (id: string) => { const it = items.find(i => i.id === id); if (it) { setView(it.type); setSel(id); setDtab('overview'); } };
  const goView = (v: string)  => { setView(v); setSel(null); };
  const createAndOpen = (type: string) => {
    const blank = mkBlank(type, items);
    setItems(p => [...p, blank]);
    setForm({ ...blank, _autoSave: true });
  };

  const disabledView =
    (view === 'kanban'  && !features.kanban)   ||
    (view === 'reports' && !features.reports)  ||
    (view === 'bot'     && !features.bot)      ||
    (isWorkItems        && !features.workitems);

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily:'system-ui,sans-serif', fontSize:'13px', background:'#f1f5f9' }}>
        {previewTenant && <PreviewBanner tenant={previewTenant} onExit={onExitPreview}/>}
        <TopNav view={view} setView={goView} items={[]} onNavItem={()=>{}} onCreateNew={()=>{}}
          workItemFilter={workItemFilter} setWorkItemFilter={setWIF} onNew={()=>{}}
          loggedUser={loggedUser} isAdmin={false} features={features}/>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>&#9203;</div>
            <div style={{ fontSize:13, color:'#64748b' }}>Loading your workspace\u2026</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily:'system-ui,sans-serif', fontSize:'13px', background:'#f1f5f9' }}>
      {previewTenant && <PreviewBanner tenant={previewTenant} onExit={onExitPreview}/>}
      <TopNav view={view} setView={goView} items={items} onNavItem={id => nav(id)}
        onCreateNew={createAndOpen} workItemFilter={workItemFilter} setWorkItemFilter={setWIF}
        onNew={() => isListView && setForm(mkBlank(view, items))}
        loggedUser={loggedUser} isAdmin={false} features={features}/>
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto">
            {!disabledView ? (
              <>
                {view === 'kanban'  && features.kanban    && <KanbanBoard items={items} sel={sel} onSel={id => { setSel(id); setDtab('overview'); }} onNew={t => setForm(mkBlank(t, items))} onStatusChange={changeStatus} onFieldChange={changeField}/>}
                {view === 'reports' && features.reports   && <ReportBuilder items={items}/>}
                {view === 'bot'     && features.bot       && <BotPanel items={items}/>}
                {isWorkItems        && features.workitems && <WorkItemsView items={items} sel={sel} onSel={id => { setSel(id); setDtab('overview'); }} filter={workItemFilter}/>}
                {isListView                               && <ListView type={view} items={items.filter(i => i.type === view)} sel={sel} onSel={id => { setSel(id); setDtab('overview'); }}/>}
              </>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:12 }}>
                <div style={{ fontSize:48 }}>&#128274;</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#374151' }}>Module Not Enabled</div>
                <div style={{ fontSize:12, color:'#94a3b8', textAlign:'center', maxWidth:300, lineHeight:1.6 }}>
                  This module is disabled for this tenant. Enable it in Admin Console \u2192 Features.
                </div>
              </div>
            )}
          </div>
        </div>
        {selected && view !== 'bot' && (
          <div style={{ position: window.innerWidth < 640 ? 'absolute' : 'relative', inset: window.innerWidth < 640 ? 0 : 'auto', zIndex: window.innerWidth < 640 ? 30 : 1, display:'flex', width: window.innerWidth < 640 ? '100%' : '420px', flexShrink:0 }}>
            <DetailPanel item={selected} allItems={items} tab={dtab} onTab={setDtab}
              onEdit={() => setForm({ ...selected })} onDelete={() => remove(selected.id)} onClose={() => setSel(null)}
              onAddLink={() => { setLinkQ(''); setLinkDlg('link'); }} onAddDep={() => { setLinkQ(''); setLinkDlg('dep'); }}
              onRmLink={rmLink} onRmDep={rmDep} onAddFile={() => fileRef.current?.click()} onRmFile={rmFile}
              onAddComment={addComment} onRmComment={rmComment} onNav={nav}/>
          </div>
        )}
      </div>
      <footer style={{ background:'#a3bbff', borderTop:'1px solid #7a9ee8', padding:'3px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:12, flexShrink:0 }}>
        <span style={{ fontSize:11, color:'#0c2d4a', letterSpacing:'0.02em' }}>
          \u00aeStrat101.com  |  \u00a9Copyright 2026. All rights Reserved.  |  Contact:{' '}
          <a href="mailto:Support@Strat101.com" style={{ color:'#0c2d4a', textDecoration:'none', fontWeight:600 }}>Support@Strat101.com</a>
        </span>
      </footer>
      <input ref={fileRef} type="file" className="hidden"
        onChange={e => { if (e.target.files?.[0]) addFile(e.target.files[0]); e.target.value = ''; }}/>
      {form && <ItemForm item={form} onSave={upsert} onClose={() => setForm(null)} onAutoSave={form._autoSave ? liveUpsert : null}/>}
      {linkDlg && selected && <LinkDlg mode={linkDlg} selected={selected} allItems={items} q={linkQ} onQ={setLinkQ} onLink={linkDlg === 'link' ? addLink : addDep} onClose={() => setLinkDlg(null)}/>}
      {cmdOpen && <CommandPalette items={items} onNav={id => { nav(id); setCmdOpen(false); }} onClose={() => setCmdOpen(false)}/>}
    </div>
  );
}

// ─── APP MAIN ─────────────────────────────────────────────────────────────────

function AppMain({ loggedUser }: { loggedUser: string }) {
  const isAdmin = isAdminUser(loggedUser);
  const [screen,        setScreen]        = useState<'admin'|'workspace'>(isAdmin ? 'admin' : 'workspace');
  const [previewTenant, setPreviewTenant] = useState<Tenant | null>(null);
  const [tenantId,      setTenantId]      = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) { setTenantId(null); return; }
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      if (!user) return;
      supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('auth_user_id', user.id)
        .eq('active', true)
        .single()
        .then(({ data }: { data: any }) => {
          if (data?.tenant_id) setTenantId(data.tenant_id as string);
        });
    });
  }, [isAdmin]);

  const handlePreview     = (tenant: Tenant) => { setPreviewTenant(tenant); setScreen('workspace'); };
  const handleExitPreview = ()                => { setPreviewTenant(null);  setScreen('admin');     };

  const features: TenantFeatures      = previewTenant ? previewTenant.features : ALL_FEATURES;
  const activeTenantId: string | null = previewTenant ? previewTenant.id : tenantId;

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  if (screen === 'admin') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ fontFamily:'system-ui,sans-serif' }}>
        <div style={{ background:'#1e293b', padding:'0 20px', height:44, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:6, background:'linear-gradient(135deg,#f59e0b,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>&#9881;&#65039;</div>
            <span style={{ fontSize:13, fontWeight:700, color:'white', letterSpacing:'-0.2px' }}>Strat101 Admin</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ fontSize:11, color:'#94a3b8' }}>
              Logged in as <strong style={{ color:'#fbbf24' }}>{loggedUser}</strong>
            </span>
            <button onClick={handleSignOut}
              style={{ fontSize:11, color:'#94a3b8', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>
              Sign out
            </button>
          </div>
        </div>
        <div style={{ flex:1, overflow:'hidden' }}>
          <AdminPanel loggedUser={loggedUser} onPreviewTenant={handlePreview}/>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Workspace
        loggedUser={loggedUser} isAdmin={isAdmin}
        features={features} previewTenant={previewTenant}
        onExitPreview={handleExitPreview} tenantId={activeTenantId}
      />
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [loggedIn,   setLoggedIn]   = useState(false);
  const [loggedUser, setLoggedUser] = useState('');
  const [checking,   setChecking]   = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        const username = await resolveUsernameFromEmail(session.user.email ?? '');
        setLoggedUser(username);
        setLoggedIn(true);
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          resolveUsernameFromEmail(session.user.email ?? '').then(username => {
            setLoggedUser(username);
            setLoggedIn(true);
          });
        } else {
          setLoggedIn(false);
          setLoggedUser('');
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div style={{ minHeight:'100vh', background:'#0e1f35', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#2563eb,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:16, margin:'0 auto 14px', boxShadow:'0 4px 16px rgba(37,99,235,0.4)' }}>SA</div>
          <div style={{ fontSize:12, color:'#475569' }}>Loading\u2026</div>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={u => { setLoggedIn(true); setLoggedUser(u); }}/>;
  }

  return <AppMain loggedUser={loggedUser}/>;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Resolve a Supabase auth email back to the username stored in tenant_users.
// Falls back to the local part of the email (e.g. "raviboorla") if not found,
// which is always correct for stratadmin since it has no tenant_users row.
async function resolveUsernameFromEmail(email: string): Promise<string> {
  const { data } = await supabase
    .from('tenant_users')
    .select('username')
    .eq('email', email.toLowerCase())
    .single();
  return data?.username ?? email.split('@')[0];
}
