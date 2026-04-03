import React, { useState, useRef, useEffect, useCallback } from "react";

import { TYPES } from "./constants";
import { mkBlank, gId, tsNow, td } from "./utils";
import { TenantFeatures, Tenant } from "./types";
import { isGlobalAdminUser } from "./globalAdminData";
import { supabase } from "./lib/supabase";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

import LoginScreen   from "./modules/Login/LoginScreen";
import BotPanel      from "./modules/AiAssist/BotPanel";
import WorkItemsView, { ListView } from "./modules/WorkItems/WorkItemsView";
import KanbanBoard   from "./modules/Kanban/KanbanBoard";
import ItemForm, { LinkDlg } from "./modules/Create/ItemForm";
import ReportBuilder from "./modules/Reports/ReportBuilder";
import GlobalAdminPanel from "./modules/Admin/GlobalAdminPanel";
import LocalAdminPanel from "./modules/Admin/LocalAdminPanel";

import TopNav         from "./components/TopNav";
import DetailPanel    from "./components/DetailPanel";
import CommandPalette from "./components/CommandPalette";
import LOGO_SRC from './logoData';

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
  console.log('[PERSIST] called — tenantId:', tenantId, '| id:', item.id, '| type:', item.type, '| title:', item.title);
  const { data, error, status, statusText } = await supabase.from('work_items').upsert({
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
  console.log('[PERSIST] result — status:', status, statusText, '| error:', error, '| data:', data);
  if (error) {
    console.error('[PERSIST] FAILED:', error.message, '| code:', error.code, '| hint:', error.hint, '| details:', error.details);
  } else {
    console.log('[PERSIST] SUCCESS — rows saved:', data);
  }
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
  loggedUser, isAdmin, features, previewTenant, onExitPreview, tenantId, onSignOut, userRole = 'editor', onSwitchToAdmin, onOpenGlobalAdmin, onOpenLocalAdmin,
}: {
  loggedUser: string; isAdmin: boolean; features: TenantFeatures;
  previewTenant: Tenant | null; onExitPreview: () => void; tenantId: string | null; onSignOut: () => void; userRole?: string; onSwitchToAdmin?: () => void; onOpenGlobalAdmin?: () => void; onOpenLocalAdmin?: () => void;
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
  const isViewer  = userRole === 'viewer';
  const stamp = (it: any) => ({ ...it, updatedAt: tsNow(), updatedBy: LOGGED_IN });

  const applyAndPersist = async (updated: any) => {
    console.log('[APPLY] tenantId at save time:', tenantId, '| loggedUser:', loggedUser, '| isAdmin:', isAdmin);
    setItems(p => p.some(x => x.id === updated.id)
      ? p.map(x => x.id === updated.id ? updated : x)
      : [...p, updated]);
    if (tenantId) {
      console.log('[APPLY] tenantId is set — calling persistItem');
      await persistItem(updated, tenantId);
      await syncLinks(updated.id, updated.links, tenantId);
      await syncDeps(updated.id, updated.dependencies, tenantId);
    } else {
      console.warn('[APPLY] tenantId is NULL — item saved locally only, NOT written to Supabase');
    }
  };

  const liveUpsert = (it: any) => {
    const s = stamp(it);
    setItems(p => p.some(x => x.id === s.id) ? p.map(x => x.id === s.id ? s : x) : [...p, s]);
  };

  const upsert = async (it: any) => {
    if (isViewer) return;
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
      setItems(p => p.map(i => i.id === sel ? { ...i, _uploadError: `"${f.name}" is ${mb} MB — max 10 MB.` } : i));
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
    if (isViewer) return;
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
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily:'system-ui,sans-serif', fontSize:'13px', background:'#f2f2f2' }}>
        {previewTenant && <PreviewBanner tenant={previewTenant} onExit={onExitPreview}/>}
        <TopNav view={view} setView={goView} items={[]} onNavItem={()=>{}} onCreateNew={()=>{}}
          workItemFilter={workItemFilter} setWorkItemFilter={setWIF} onNew={()=>{}}
          loggedUser={loggedUser} isAdmin={isAdmin} features={features} onSignOut={onSignOut} isViewer={isViewer} onOpenGlobalAdmin={onOpenGlobalAdmin} onOpenLocalAdmin={onOpenLocalAdmin}/>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>&#9203;</div>
            <div style={{ fontSize:13, color:'#64748b' }}>Loading your workspace…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily:'system-ui,sans-serif', fontSize:'13px', background:'#f2f2f2', position:'relative' }}>
      {previewTenant && <PreviewBanner tenant={previewTenant} onExit={onExitPreview}/>}
      <TopNav view={view} setView={goView} items={items} onNavItem={id => nav(id)}
        onCreateNew={createAndOpen} workItemFilter={workItemFilter} setWorkItemFilter={setWIF}
        onNew={() => !isViewer && isListView && setForm(mkBlank(view, items))}
        loggedUser={loggedUser} isAdmin={isAdmin} features={features} onSignOut={onSignOut}
        isViewer={isViewer} onOpenGlobalAdmin={onOpenGlobalAdmin} onOpenLocalAdmin={onOpenLocalAdmin}/>
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
                  This module is disabled for this tenant. Enable it in Global Admin Console → Features.
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
          ®Strat101.com  |  ©Copyright 2026. All rights Reserved.  |  Contact:{' '}
          <a href="mailto:Support@Strat101.com" style={{ color:'#0c2d4a', textDecoration:'none', fontWeight:600 }}>Support@Strat101.com</a>
        </span>
      </footer>
      <input ref={fileRef} type="file" className="hidden"
        onChange={e => { if (e.target.files?.[0]) addFile(e.target.files[0]); e.target.value = ''; }}/>
      {/* ItemForm — right-side drawer within workspace */}
      {form && (
        <div style={{ position:'absolute', top:68, bottom:24, left:0, right:0, zIndex:50, display:'flex', alignItems:'stretch', pointerEvents:'none' }}>
          <div onClick={() => setForm(null)} style={{ flex:1, background:'rgba(0,0,0,0.3)', cursor:'pointer', pointerEvents:'all' }}/>
          <div onClick={e=>e.stopPropagation()}
            style={{ width:'40%', minWidth:340, maxWidth:620, height:'100%', background:'white',
              boxShadow:'-6px 0 32px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column',
              overflow:'hidden', pointerEvents:'all' }}>
            <ItemForm item={form} onSave={upsert} onClose={() => setForm(null)} onAutoSave={form._autoSave ? liveUpsert : null} drawerMode={true}/>
          </div>
        </div>
      )}
      {linkDlg && selected && <LinkDlg mode={linkDlg} selected={selected} allItems={items} q={linkQ} onQ={setLinkQ} onLink={linkDlg === 'link' ? addLink : addDep} onClose={() => setLinkDlg(null)}/>}
      {cmdOpen && <CommandPalette items={items} onNav={id => { nav(id); setCmdOpen(false); }} onClose={() => setCmdOpen(false)}/>}
    </div>
  );
}

// ─── APP MAIN ─────────────────────────────────────────────────────────────────

function AppMain({ loggedUser }: { loggedUser: string }) {
  const isAdmin = isGlobalAdminUser(loggedUser);
  const [screen,         setScreen]         = useState<'admin'|'workspace'>(isAdmin ? 'admin' : 'workspace');
  const [previewTenant,  setPreviewTenant]  = useState<Tenant | null>(null);
  const [tenantId,       setTenantId]       = useState<string | null>(null);
  const [tenantFeatures, setTenantFeatures] = useState<TenantFeatures>(ALL_FEATURES);
  const [userRole,       setUserRole]       = useState<string>('editor');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      if (!user) return;
      supabase
        .from('tenant_users')
        .select('tenant_id, role')
        .eq('auth_user_id', user.id)
        .eq('active', true)
        .single()
        .then(async ({ data }: { data: any }) => {
          if (data?.tenant_id) {
            setTenantId(data.tenant_id as string);
            setUserRole(data.role ?? 'editor');

            // Load tenant features
            const { data: tenant } = await supabase
              .from('tenants')
              .select('feat_kanban, feat_workitems, feat_create, feat_bot, feat_reports')
              .eq('id', data.tenant_id)
              .single();

            if (tenant) {
              setTenantFeatures({
                kanban:    tenant.feat_kanban    ?? true,
                workitems: tenant.feat_workitems ?? true,
                create:    tenant.feat_create    ?? true,
                bot:       tenant.feat_bot       ?? true,
                reports:   tenant.feat_reports   ?? true,
              });
            }
          }
        });
    });
  }, [isAdmin]);

  const [globalAdminDrawerOpen,        setGlobalAdminDrawerOpen]        = useState(false);
  const [localAdminDrawerOpen,         setLocalAdminDrawerOpen]         = useState(false);

  const features: TenantFeatures      = tenantFeatures;
  const activeTenantId: string | null = tenantId;
  const handleSignOut = async () => { await supabase.auth.signOut(); };

  // Everyone defaults to workspace — admin panels are drawers
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ position:'relative', overflow:'hidden' }}>
      <Workspace
        loggedUser={loggedUser}
        isAdmin={isAdmin}
        features={features}
        previewTenant={null}
        onExitPreview={() => {}}
        tenantId={activeTenantId}
        onSignOut={handleSignOut}
        userRole={userRole}
        onOpenGlobalAdmin={isAdmin ? () => setGlobalAdminDrawerOpen(true) : undefined}
        onOpenLocalAdmin={(userRole === 'local_admin' || isAdmin) && tenantId
          ? () => setLocalAdminDrawerOpen(true) : undefined}
      />

      {/* Global Admin Drawer */}
      {isAdmin && globalAdminDrawerOpen && (
        <GlobalAdminDrawer
          loggedUser={loggedUser}
          onClose={() => setGlobalAdminDrawerOpen(false)}
        />
      )}

      {/* Local Admin Drawer */}
      {(userRole === 'local_admin' || isAdmin) && localAdminDrawerOpen && tenantId && (
        <LocalAdminDrawer
          loggedUser={loggedUser}
          tenantId={tenantId}
          onClose={() => setLocalAdminDrawerOpen(false)}
        />
      )}
    </div>
  );
}

// ── Thin wrapper components for the drawers ───────────────────────────────────
function GlobalAdminDrawer({ loggedUser, onClose }: { loggedUser: string; onClose: () => void }) {
  return (
    <div style={{ position:'absolute', top:68, bottom:24, left:0, right:0, zIndex:50, display:'flex', alignItems:'stretch', pointerEvents:'none' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.35)', cursor:'pointer', pointerEvents:'all' }}/>
      <div onClick={e=>e.stopPropagation()}
        style={{ width:'40%', minWidth:360, maxWidth:680, height:'100%', background:'#f8fafc',
          boxShadow:'-6px 0 32px rgba(0,0,0,0.25)', display:'flex', flexDirection:'column',
          overflow:'hidden', pointerEvents:'all' }}>
        <div style={{ background:'#0f172a', padding:'0 14px', height:38, display:'flex',
          alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <img src={LOGO_SRC} alt='logo' style={{ width:20, height:20, borderRadius:4, objectFit:'cover' }}/>
            <span style={{ fontSize:12, fontWeight:700, color:'white' }}>Global Admin</span>
          </div>
          <button onClick={onClose} style={{ color:'#94a3b8', background:'rgba(255,255,255,0.1)',
            border:'none', fontSize:12, cursor:'pointer', padding:'3px 10px', borderRadius:5, fontWeight:600 }}>✕ Close</button>
        </div>
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <GlobalAdminPanel loggedUser={loggedUser} onPreviewTenant={() => {}} embedded={true}/>
        </div>
      </div>
    </div>
  );
}

function LocalAdminDrawer({ loggedUser, tenantId, onClose }:
  { loggedUser: string; tenantId: string; onClose: () => void }) {
  return (
    <div style={{ position:'absolute', top:68, bottom:24, left:0, right:0, zIndex:50, display:'flex', alignItems:'stretch', pointerEvents:'none' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.35)', cursor:'pointer', pointerEvents:'all' }}/>
      <div onClick={e=>e.stopPropagation()}
        style={{ width:'40%', minWidth:320, maxWidth:580, height:'100%', background:'#f8fafc',
          boxShadow:'-6px 0 32px rgba(0,0,0,0.25)', display:'flex', flexDirection:'column',
          overflow:'hidden', pointerEvents:'all' }}>
        <div style={{ background:'#0f172a', padding:'0 16px', height:44, display:'flex',
          alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14 }}>🏢</span>
            <span style={{ fontSize:13, fontWeight:700, color:'white' }}>Local Admin</span>
          </div>
          <button onClick={onClose} style={{ color:'#94a3b8', background:'none', border:'none',
            fontSize:20, cursor:'pointer', lineHeight:1, padding:'4px 8px' }}>×</button>
        </div>
        <div style={{ flex:1, overflow:'hidden' }}>
          <LocalAdminPanel loggedUser={loggedUser} tenantId={tenantId}
            onSignOut={async () => {}} onSwitchToWorkspace={onClose} embedded={true}/>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [loggedIn,   setLoggedIn]   = useState(false);
  const [loggedUser, setLoggedUser] = useState('');
  const [checking,   setChecking]   = useState(true);

  const [pendingApproval, setPendingApproval] = useState(false);

  // Check if user's account is approved before allowing access
  const checkAndLogin = async (email: string): Promise<boolean> => {
    try {
      // 5 second timeout — if RLS or network fails, fall through to login screen
      const queryPromise = supabase
        .from('tenant_users')
        .select('username, active, approval_status')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      const timeoutPromise = new Promise<{data:null,error:{message:string}}>(resolve =>
        setTimeout(() => resolve({data:null, error:{message:'timeout'}}), 5000)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) {
        console.warn('[Auth] tenant_users lookup failed:', error.message);
        // On error, sign out and show login screen — don't get stuck
        await supabase.auth.signOut();
        return false;
      }

      if (!data) {
        // No matching user row — could be mid-registration race condition
        // Sign out and show login
        await supabase.auth.signOut();
        return false;
      }

      if (data.approval_status === 'pending') {
        await supabase.auth.signOut();
        setPendingApproval(true);
        return false;
      }

      if (data.approval_status === 'rejected' || !data.active) {
        await supabase.auth.signOut();
        return false;
      }

      setLoggedUser(data.username);
      setLoggedIn(true);
      return true;

    } catch (e: any) {
      console.warn('[Auth] checkAndLogin error:', e.message);
      // Network error or timeout — sign out and show login screen
      await supabase.auth.signOut();
      return false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        await checkAndLogin(session.user.email ?? '');
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          await checkAndLogin(session.user.email ?? '');
        } else {
          setLoggedIn(false);
          setLoggedUser('');
          setPendingApproval(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div style={{ minHeight:'100vh', background:'#0e1f35', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <img src={LOGO_SRC} alt='Strat101' style={{ width:44, height:44, borderRadius:12, objectFit:'cover', margin:'0 auto 14px', boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}/>
          <div style={{ fontSize:12, color:'#475569' }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (pendingApproval) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
        <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'48px 40px', maxWidth:420, width:'100%', margin:'0 16px', textAlign:'center', backdropFilter:'blur(20px)' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>⏳</div>
          <div style={{ color:'white', fontWeight:700, fontSize:22, marginBottom:12 }}>Awaiting Approval</div>
          <div style={{ color:'#94a3b8', fontSize:14, lineHeight:1.7, marginBottom:28 }}>
            Your account is pending review by an administrator. You will be notified once your access has been approved.
          </div>
          <div style={{ background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.25)', borderRadius:12, padding:'16px', marginBottom:24, textAlign:'left' }}>
            <div style={{ color:'#93c5fd', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>What happens next</div>
            {['An administrator reviews your request', 'Your account is activated', 'You receive confirmation to log in'].map((s, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:i < 2 ? 8 : 0 }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(37,99,235,0.3)', border:'1px solid rgba(37,99,235,0.5)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ color:'#93c5fd', fontSize:10, fontWeight:700 }}>{i + 1}</span>
                </div>
                <span style={{ color:'#cbd5e1', fontSize:12 }}>{s}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { setPendingApproval(false); }}
            style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#2563eb,#4f46e5)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={u => { setLoggedIn(true); setLoggedUser(u); setPendingApproval(false); }}/>;
  }

  return <AppMain loggedUser={loggedUser}/>;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Resolve a Supabase auth email back to the username stored in tenant_users.
// Falls back to the local part of the email (e.g. "raviboorla") if not found,
// which is always correct for stratadmin since it has no tenant_users row.
async function resolveUsernameFromEmail(email: string): Promise<string> {
  // Use maybeSingle to avoid throwing on RLS-filtered empty results
  const { data, error } = await supabase
    .from('tenant_users')
    .select('username')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) console.warn('[AUTH] resolveUsernameFromEmail error:', error.message);
  const username = data?.username ?? email.split('@')[0];
  console.log('[AUTH] resolved username:', username, 'from email:', email);
  return username;
}
