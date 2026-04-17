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
import RiDeIntel, { RecordForm as RiDeForm, RiDeRecord } from "./modules/RiDeIntel/RiDeIntel";
import ChatPanel from "./modules/Chat/ChatPanel";
import { useResponsive } from "./hooks/useResponsive";
import KanbanBoard   from "./modules/Kanban/KanbanBoard";
import ItemForm, { LinkDlg } from "./modules/Create/ItemForm";
import ReportBuilder from "./modules/Reports/ReportBuilder";
import GlobalAdminPanel from "./modules/Admin/GlobalAdminPanel";
import LocalAdminPanel from "./modules/Admin/LocalAdminPanel";
import SprintModule from "./modules/Sprint/SprintModule";
import AgentSprintModule from "./modules/AgentSprint/AgentSprintModule";

import TopNav         from "./components/TopNav";
import DetailPanel    from "./components/DetailPanel";
import CommandPalette from "./components/CommandPalette";
import LOGO_SRC from './logoData';

const ALL_FEATURES: TenantFeatures = {
  kanban: true, workitems: true, create: true, bot: true, reports: true, ride: false, chat: false, sprints: false, agentSprints: false,
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
    keyResult:           row.key_result          ?? '',
    updatedAt:           row.updated_at          ?? '',
    updatedBy:           row.updated_by          ?? '',
    storyPoints:         row.story_points        ?? null,
    acceptanceCriteria:  row.acceptance_criteria ?? '',
    backlogOrder:        row.backlog_order       ?? null,
    itemSubtype:         row.item_subtype        ?? null,
    sprintId:            row.sprint_id           ?? null,
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
    key_result:          item.keyResult          || null,
    story_points:        item.storyPoints        ?? null,
    acceptance_criteria: item.acceptanceCriteria || null,
    backlog_order:       item.backlogOrder       ?? null,
    item_subtype:        item.itemSubtype        || null,
    sprint_id:           item.sprintId           || null,
    updated_at:          new Date().toISOString(),
    updated_by:          item.updatedBy          || null,
  });
  if (error) {
    console.error('[PERSIST] FAILED:', error.message, '| code:', error.code, '| hint:', error.hint, '| details:', error.details);
  } else {
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
  loggedUser, isAdmin, features, previewTenant, onExitPreview, tenantId, onSignOut, userRole = 'editor', onSwitchToAdmin, onOpenGlobalAdmin, onOpenLocalAdmin, tenantName = '', enabledTypes,
}: {
  loggedUser: string; isAdmin: boolean; features: TenantFeatures;
  previewTenant: Tenant | null; onExitPreview: () => void; tenantId: string | null; onSignOut: () => void; userRole?: string; onSwitchToAdmin?: () => void; onOpenGlobalAdmin?: () => void; onOpenLocalAdmin?: () => void; tenantName?: string; enabledTypes?: string[];
}) {
  const ALL_ITEM_TYPES = ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask'];
  const activeTypes = (enabledTypes && enabledTypes.length > 0) ? enabledTypes : ALL_ITEM_TYPES;
  const { isMobile, isTablet } = useResponsive();

  const [items,   setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kanbanSprints, setKanbanSprints] = useState<{id:string;name:string;status:string}[]>([]);
  const [agentItems,    setAgentItems]    = useState<any[]>([]);
  const [tenantUserNames, setTenantUserNames] = useState<string[]>([]);
  const [view,    setView]    = useState('kanban');
  const [workItemFilter, setWIF] = useState('all');
  const [sel,     setSel]   = useState<string|null>(null);
  const [dtab,    setDtab]  = useState('overview');
  const [form,    setForm]  = useState<any>(null);
  const [rideForm, setRideForm] = useState<{record:Partial<RiDeRecord>|null;type:'risk'|'decision'|'issue'|'assumption'}|null>(null);
  const [linkDlg, setLinkDlg] = useState<string|null>(null);
  const [linkQ,   setLinkQ]   = useState('');
  const [cmdOpen,    setCmdOpen]    = useState(false);
  const [chatOpen,   setChatOpen]   = useState(false);
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

  useEffect(() => {
    if (!tenantId || !features.sprints) { setKanbanSprints([]); return; }
    supabase.from('sprints').select('id,name,status').eq('tenant_id', tenantId)
      .order('created_at').then(({ data }) => setKanbanSprints((data ?? []) as any));
  }, [tenantId, features.sprints]);

  useEffect(() => {
    if (!tenantId) { setTenantUserNames([]); return; }
    supabase.from('tenant_users').select('full_name,username').eq('tenant_id', tenantId).eq('active', true)
      .then(({ data }) => {
        const names = (data ?? []).map((u: any) => u.full_name || u.username).filter(Boolean);
        setTenantUserNames([...new Set(names)] as string[]);
      });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !features.agentSprints) { setAgentItems([]); return; }
    supabase.from('agent_sprint_items').select('*').eq('tenant_id', tenantId)
      .then(({ data }) => setAgentItems(data ?? []));
  }, [tenantId, features.agentSprints]);

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
    setItems(p => p.some(x => x.id === updated.id)
      ? p.map(x => x.id === updated.id ? updated : x)
      : [...p, updated]);
    if (tenantId) {
      await persistItem(updated, tenantId);
      await syncLinks(updated.id, updated.links, tenantId);
      await syncDeps(updated.id, updated.dependencies, tenantId);
    } else {
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
    if (['risk','decision','issue','assumption'].includes(type)) { setRideForm({record:null,type:type as 'risk'|'decision'|'issue'|'assumption'}); return; }
    if (isViewer) return;
    const blank = mkBlank(type, items);
    setItems(p => [...p, blank]);
    setForm({ ...blank, _autoSave: true });
  };

  const disabledView =
    (view === 'kanban'   && !features.kanban)   ||
    (view === 'reports'  && !features.reports)  ||
    (view === 'bot'      && !features.bot)      ||
    (isWorkItems         && !features.workitems)||
    (TYPES.includes(view) && !activeTypes.includes(view)) ||
    (view === 'ride'    && !features.ride)      ||
    (view === 'sprints'      && !features.sprints)      ||
    (view === 'agentSprints' && !features.agentSprints);

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily:'system-ui,sans-serif', fontSize:'13px', background:'white' }}>
        {previewTenant && <PreviewBanner tenant={previewTenant} onExit={onExitPreview}/>}
        <TopNav view={view} setView={goView} items={[]} onNavItem={()=>{}} onCreateNew={()=>{}}
          workItemFilter={workItemFilter} setWorkItemFilter={setWIF} onNew={()=>{}}
          loggedUser={loggedUser} tenantName={tenantName} isAdmin={isAdmin} features={features} onSignOut={onSignOut} isViewer={isViewer} onOpenGlobalAdmin={onOpenGlobalAdmin} onOpenLocalAdmin={onOpenLocalAdmin}
          enabledTypes={activeTypes} isGlobalAdmin={isAdmin}/>
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
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily:'system-ui,sans-serif', fontSize:'13px', background:'white', position:'relative' }}>
      {previewTenant && <PreviewBanner tenant={previewTenant} onExit={onExitPreview}/>}
      <TopNav view={view} setView={goView} items={items} onNavItem={id => nav(id)}
        onCreateNew={createAndOpen} workItemFilter={workItemFilter} setWorkItemFilter={setWIF}
        onNew={() => !isViewer && isListView && setForm(mkBlank(view, items))}
        loggedUser={loggedUser} tenantName={tenantName} isAdmin={isAdmin} features={features} onSignOut={onSignOut}
        isViewer={isViewer} onOpenGlobalAdmin={onOpenGlobalAdmin} onOpenLocalAdmin={onOpenLocalAdmin}
        enabledTypes={activeTypes} isGlobalAdmin={isAdmin}
        chatOpen={chatOpen} onToggleChat={features.chat ? () => setChatOpen(o=>!o) : undefined}/>
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── MAIN CONTENT + DETAIL PANEL ── */}
        <div style={{flex:1,display:'flex',overflow:'hidden',minWidth:0,transition:'all 0.2s'}}>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-auto">
              {!disabledView ? (
                <>
                  {view === 'kanban'  && features.kanban    && <KanbanBoard items={items} sel={sel} onSel={id => { setSel(id); setDtab('overview'); }} onNew={t => setForm(mkBlank(t, items))} onStatusChange={changeStatus} onFieldChange={changeField} enabledTypes={activeTypes} sprints={kanbanSprints}/>}
                  {view === 'reports' && features.reports   && <ReportBuilder items={items} enabledTypes={activeTypes}/>}
                  {view === 'bot'     && features.bot       && <BotPanel items={items}/>}
                  {isWorkItems        && features.workitems && <WorkItemsView items={items} sel={sel} onSel={id => { setSel(id); setDtab('overview'); }} filter={workItemFilter} enabledTypes={activeTypes}/>}
                  {isListView                               && <ListView type={view} items={items.filter(i => i.type === view)} sel={sel} onSel={id => { setSel(id); setDtab('overview'); }}/>}
                  {view === 'ride'    && features.ride    && <RiDeIntel tenantId={tenantId} loggedUser={loggedUser} isViewer={isViewer} workItems={items}/>}
                  {view === 'sprints'      && features.sprints      && tenantId && <SprintModule tenantId={tenantId} loggedUser={loggedUser} isViewer={isViewer} items={items} onItemChange={changeField}/>}
                  {view === 'agentSprints' && features.agentSprints && tenantId && <AgentSprintModule tenantId={tenantId} loggedUser={loggedUser} isViewer={isViewer} workItems={items}/>}
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
          {rideForm && tenantId && <RiDeForm record={rideForm.record} type={rideForm.type} tenantId={tenantId} loggedUser={loggedUser} workItems={items} onSave={()=>setRideForm(null)} onClose={()=>setRideForm(null)}/>}
          {selected && view !== 'bot' && (
            <div style={{ position: isMobile ? 'absolute' : 'relative', inset: isMobile ? '0' : 'auto', zIndex: isMobile ? 30 : 1, display:'flex', width: isMobile ? '100%' : isTablet ? '360px' : '420px', flexShrink:0 }}>
              <DetailPanel item={selected} allItems={items} tab={dtab} onTab={setDtab}
                onEdit={() => setForm({ ...selected })} onDelete={() => remove(selected.id)} onClose={() => setSel(null)}
                onAddLink={() => { setLinkQ(''); setLinkDlg('link'); }} onAddDep={() => { setLinkQ(''); setLinkDlg('dep'); }}
                onRmLink={rmLink} onRmDep={rmDep} onAddFile={() => fileRef.current?.click()} onRmFile={rmFile}
                onAddComment={addComment} onRmComment={rmComment} onNav={nav}
                agentOutcomes={features.agentSprints && sel ? agentItems.filter((o: any) => o.linked_work_item_id === sel) : []}/>
            </div>
          )}
        </div>
        {/* ── CHAT SIDE PANEL — 40% on desktop, full-screen on mobile ── */}
        {features.chat && tenantId && chatOpen && (
          isMobile ? (
            <div style={{position:'fixed',top:0,left:0,right:0,zIndex:120,
              bottom:'calc(env(safe-area-inset-bottom, 0px) + 48px)',
              display:'flex',flexDirection:'column'}}>
              <ChatPanel tenantId={tenantId} loggedUser={loggedUser} userRole={userRole}
                isViewer={isViewer} onClose={()=>setChatOpen(false)} embedded/>
            </div>
          ) : (
            <div style={{width:'40%',maxWidth:520,minWidth:300,flexShrink:0,
              borderLeft:'1px solid #e2e8f0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <ChatPanel tenantId={tenantId} loggedUser={loggedUser} userRole={userRole}
                isViewer={isViewer} onClose={()=>setChatOpen(false)} embedded/>
            </div>
          )
        )}
      </div>
      <footer style={{ background:'#a3bbff', borderTop:'1px solid #7a9ee8', padding:`3px 16px calc(3px + var(--sab, 0px))`, display:'flex', alignItems:'center', justifyContent:'center', gap:12, flexShrink:0 }}>
        <span style={{ fontSize:11, color:'#0c2d4a', letterSpacing:'0.02em' }}>
          ®Strat101.com  |  ©Copyright 2026. All rights Reserved.  |  Contact:{' '}
          <a href="mailto:Support@Strat101.com" style={{ color:'#0c2d4a', textDecoration:'none', fontWeight:600 }}>Support@Strat101.com</a>
        </span>
      </footer>
      <input ref={fileRef} type="file" className="hidden"
        onChange={e => { if (e.target.files?.[0]) addFile(e.target.files[0]); e.target.value = ''; }}/>
      {/* ItemForm — right-side drawer within workspace */}
      {form && (
        <div style={{ position:'absolute', top:0, bottom:0, left:0, right:0, zIndex:50, display:'flex', alignItems:'stretch', pointerEvents:'none' }}>
          {!isMobile && <div onClick={() => setForm(null)} style={{ flex:1, background:'rgba(0,0,0,0.3)', cursor:'pointer', pointerEvents:'all' }}/>}
          <div onClick={e=>e.stopPropagation()}
            style={{ width: isMobile ? '100%' : '40%', minWidth: isMobile ? 'unset' : 340,
              maxWidth: isMobile ? 'unset' : 620, height:'100%', background:'white',
              boxShadow:'-6px 0 32px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column',
              overflow:'hidden', pointerEvents:'all' }}>
            {isMobile && <div onClick={() => setForm(null)} style={{ background:'rgba(0,0,0,0.3)', height:40, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}><div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.5)' }}/></div>}
            <ItemForm item={form} onSave={upsert} onClose={() => setForm(null)} onAutoSave={form._autoSave ? liveUpsert : null} drawerMode={true} users={tenantUserNames}/>
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
  const [tenantName,     setTenantName]     = useState<string>('');
  const [enabledTypes,   setEnabledTypes]   = useState<string[]>(['vision','mission','goal','okr','kr','initiative','program','project','task','subtask']);

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

            // Helper to load + apply tenant features — called on mount and on realtime update
            const applyTenantRow = (t: any) => {
              setTenantName(t.name ?? '');
              setTenantFeatures({
                kanban:    t.feat_kanban    ?? true,
                workitems: t.feat_workitems ?? true,
                create:    t.feat_create    ?? true,
                bot:       t.feat_bot       ?? true,
                reports:   t.feat_reports   ?? true,
                ride:      t.feat_ride      ?? false,
                chat:      t.feat_chat      ?? false,
                sprints:      t.feat_sprints        ?? false,
                agentSprints: t.feat_agent_sprints  ?? false,
              });
              const et = t.enabled_item_types;
              setEnabledTypes(et && et.length > 0 ? et : ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask']);
            };

            // Load tenant features on mount
            const { data: tenant } = await supabase
              .from('tenants')
              .select('name, feat_kanban, feat_workitems, feat_create, feat_bot, feat_reports, feat_ride, feat_chat, feat_sprints, feat_agent_sprints, enabled_item_types')
              .eq('id', data.tenant_id)
              .single();

            if (tenant) applyTenantRow(tenant);

            // Realtime subscription — updates features instantly when global admin changes them
            supabase
              .channel(`tenant_features_${data.tenant_id}`)
              .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'tenants',
                filter: `id=eq.${data.tenant_id}`,
              }, (payload: any) => {
                applyTenantRow(payload.new);
              })
              .subscribe();
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
    <div className="flex flex-col overflow-hidden" style={{ height:'100dvh', position:'relative', overflow:'hidden' }}>
      <Workspace
        loggedUser={loggedUser}
        isAdmin={isAdmin}
        features={features}
        previewTenant={null}
        onExitPreview={() => {}}
        tenantId={activeTenantId}
        onSignOut={handleSignOut}
        userRole={userRole}
        tenantName={tenantName}
        enabledTypes={enabledTypes}
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
    <div style={{ position:'absolute', top:0, bottom:0, left:0, right:0, zIndex:50, display:'flex', alignItems:'stretch', pointerEvents:'none' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.35)', cursor:'pointer', pointerEvents:'all' }}/>
      <div onClick={e=>e.stopPropagation()}
        style={{ width:'min(100%, 680px)', minWidth:'min(100%, 360px)', maxWidth:680, height:'100%', background:'#f8fafc',
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
    <div style={{ position:'absolute', top:0, bottom:0, left:0, right:0, zIndex:50, display:'flex', alignItems:'stretch', pointerEvents:'none' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.35)', cursor:'pointer', pointerEvents:'all' }}/>
      <div onClick={e=>e.stopPropagation()}
        style={{ width:'min(100%, 580px)', minWidth:'min(100%, 320px)', maxWidth:580, height:'100%', background:'#f8fafc',
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

// ─── SET PASSWORD SCREEN ──────────────────────────────────────────────────────

function SetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [pwd,     setPwd]     = useState('');
  const [conf,    setConf]    = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [err,     setErr]     = useState('');
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);

  const eyeBtn = (show: boolean, toggle: () => void): React.CSSProperties => ({
    position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
    background:'none', border:'none', cursor:'pointer', color:'#64748b',
    fontSize:16, padding:0, lineHeight:1,
  });

  const submit = async () => {
    if (pwd.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pwd !== conf)   { setErr('Passwords do not match.'); return; }
    setErr(''); setSaving(true);

    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      setErr(error.message);
      setSaving(false);
    } else {
      // Clear must_change_pwd flag if set
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        await supabase.from('tenant_users')
          .update({
            must_change_pwd:    false,
            temp_password:      null,
            password_changed_at: new Date().toISOString(),
          })
          .eq('email', session.user.email.toLowerCase());
      }
      setDone(true);
      // After 2.5s show success, then clear state and sign out.
      // Order matters: clear ref first so SIGNED_OUT handler doesn't
      // misinterpret the sign-out as a mid-flow interruption.
      setTimeout(async () => {
        onDone(); // clears setPasswordMode + ref first
        await supabase.auth.signOut();
      }, 2500);
    }
  };

  const inputWrap: React.CSSProperties = { position:'relative', display:'flex', alignItems:'center' };
  const inp: React.CSSProperties = {
    width:'100%', boxSizing:'border-box', paddingRight:40,
    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)',
    borderRadius:10, padding:'12px 14px', color:'white', fontSize:16, outline:'none',
  };

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)', display:'flex', alignItems:'flex-start', justifyContent:'center', fontFamily:'system-ui,sans-serif', overflowY:'auto', padding:'24px 0' }}>
      <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'clamp(20px,5vw,40px) clamp(16px,5vw,36px)', maxWidth:400, width:'calc(100vw - 32px)', margin:'0 16px', backdropFilter:'blur(20px)' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <img src={LOGO_SRC} alt='Strat101' style={{ width:52, height:52, borderRadius:14, objectFit:'cover', margin:'0 auto 14px', boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}/>
          <div style={{ color:'white', fontWeight:700, fontSize:20, marginBottom:6 }}>
            {done ? 'Password Set!' : 'Set Your Password'}
          </div>
          <div style={{ color:'#94a3b8', fontSize:13 }}>
            {done ? 'Redirecting you to login…' : 'Choose a strong password to secure your Strat101.com account.'}
          </div>
        </div>

        {done ? (
          <div style={{ textAlign:'center', fontSize:48, margin:'20px 0' }}>✅</div>
        ) : (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', color:'#94a3b8', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
                New Password
              </label>
              <div style={inputWrap}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={pwd} onChange={e => setPwd(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={inp}
                  onFocus={e => e.target.style.borderColor='#3b82f6'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.15)'}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
                <button style={eyeBtn(showPwd, () => setShowPwd(v => !v))} onClick={() => setShowPwd(v => !v)} type="button">
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', color:'#94a3b8', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
                Confirm Password
              </label>
              <div style={inputWrap}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={conf} onChange={e => setConf(e.target.value)}
                  placeholder="Re-enter password"
                  style={inp}
                  onFocus={e => e.target.style.borderColor='#3b82f6'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.15)'}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
                <button style={eyeBtn(showPwd, () => setShowPwd(v => !v))} onClick={() => setShowPwd(v => !v)} type="button">
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
              {pwd && conf && pwd !== conf && (
                <div style={{ color:'#f87171', fontSize:11, marginTop:4 }}>Passwords do not match</div>
              )}
              {pwd.length > 0 && pwd.length < 8 && (
                <div style={{ color:'#fbbf24', fontSize:11, marginTop:4 }}>At least 8 characters required</div>
              )}
            </div>

            {/* Strength indicator */}
            {pwd.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                  {[1,2,3,4].map(i => {
                    const strength = pwd.length >= 12 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd) ? 4
                      : pwd.length >= 10 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) ? 3
                      : pwd.length >= 8 ? 2 : 1;
                    return <div key={i} style={{ flex:1, height:3, borderRadius:99, background: i <= strength ? (strength >= 4 ? '#22c55e' : strength >= 3 ? '#84cc16' : strength >= 2 ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.1)' }}/>;
                  })}
                </div>
                <div style={{ fontSize:10, color:'#64748b' }}>
                  {pwd.length >= 12 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd) ? '✓ Strong' : pwd.length >= 10 && /[A-Z]/.test(pwd) ? '✓ Good' : pwd.length >= 8 ? '⚠ Fair — add numbers or symbols' : '✗ Too short'}
                </div>
              </div>
            )}

            {err && <div style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'9px 12px', color:'#fca5a5', fontSize:12, marginBottom:14 }}>{err}</div>}

            <button onClick={submit} disabled={saving || pwd.length < 8 || pwd !== conf}
              style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', cursor: pwd.length >= 8 && pwd === conf ? 'pointer' : 'not-allowed', background: pwd.length >= 8 && pwd === conf ? 'linear-gradient(135deg,#2563eb,#4f46e5)' : '#334155', color:'white', fontSize:13, fontWeight:700, opacity: pwd.length >= 8 && pwd === conf ? 1 : 0.5 }}>
              {saving ? 'Saving…' : 'Set Password & Sign In →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [loggedIn,        setLoggedIn]        = useState(false);
  const [loggedUser,      setLoggedUser]      = useState('');
  const [checking,        setChecking]        = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [setPasswordMode, setSetPasswordMode] = useState(false); // invite/recovery token in URL
  const [tokenError,      setTokenError]      = useState('');    // expired/invalid reset link
  const setPasswordModeRef = React.useRef(false); // ref so closures see current value

  useEffect(() => {
    // resolveUsername — prefer user_metadata.username (set on login),
    // then look up tenant_users by auth_user_id to get the real username,
    // only fall back to email prefix as last resort.
    const resolveUsername = async (session: Session | null): Promise<string> => {
      if (!session?.user) return '';
      // First: trust metadata if username was explicitly stored there
      if (session.user.user_metadata?.username) return session.user.user_metadata.username;
      // Second: look up from tenant_users by auth_user_id
      const { data } = await supabase
        .from('tenant_users')
        .select('username')
        .eq('auth_user_id', session.user.id)
        .eq('active', true)
        .maybeSingle();
      if (data?.username) return data.username;
      // Last resort: email prefix (global admin with no tenant_users row)
      return (session.user.email ?? '').split('@')[0];
    };

    // ── onAuthStateChange must be registered FIRST ────────────────────────────
    // Supabase fires events synchronously when getSession() resolves.
    // If we register the listener after getSession, we miss the initial event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {

        // ── PASSWORD_RECOVERY: fired when user clicks a "Reset Password" link ──
        // Supabase exchanges the token, fires this event, session is now active.
        if (event === 'PASSWORD_RECOVERY') {
          // Clear the flag — recovery token is consumed, we are now in set-password mode
          sessionStorage.removeItem('strat101_set_password');
          setLoggedIn(false);
          setSetPasswordMode(true);
          setPasswordModeRef.current = true;
          setChecking(false);
          return;
        }

        // ── SIGNED_IN ─────────────────────────────────────────────────────────
        if (event === 'SIGNED_IN' && session?.user) {

          // Invite/magiclink token: Supabase fires SIGNED_IN (not PASSWORD_RECOVERY)
          // We detect this via sessionStorage flag set just before getSession call
          if (sessionStorage.getItem('strat101_set_password') === '1') {
            sessionStorage.removeItem('strat101_set_password');
            setLoggedIn(false);
            setSetPasswordMode(true);
            setPasswordModeRef.current = true;
            setChecking(false);
            return;
          }

          // Self-registration: LoginScreen sets this flag before signUp()
          // We must sign them out and show pending screen
          if (sessionStorage.getItem('strat101_registering') === '1') {
            sessionStorage.removeItem('strat101_registering');
            await supabase.auth.signOut();
            setPendingApproval(true);
            setChecking(false);
            return;
          }

          // If we are in set-password mode, a SIGNED_IN can fire after
          // updateUser() — ignore it, SetPasswordScreen handles completion.
          if (setPasswordModeRef.current) {
            return;
          }
          // Normal login — trust the session
          resolveUsername(session).then(u => {
            setLoggedUser(u);
            setLoggedIn(true);
            setSetPasswordMode(false);
            setChecking(false);
          });
          return;
        }

        // ── SIGNED_OUT ────────────────────────────────────────────────────────
        if (event === 'SIGNED_OUT') {
          // Reset token flow: signOut({scope:'local'}) fires SIGNED_OUT before
          // the token exchange fires PASSWORD_RECOVERY/SIGNED_IN.
          // Do NOT clear state — the next event will set it correctly.
          if (sessionStorage.getItem('strat101_set_password') === '1') {
            return;
          }
          // Registration flow sign-out — pending screen follows
          if (sessionStorage.getItem('strat101_registering') === '1') {
            return;
          }
          // SetPasswordScreen signs out after password is saved (the 2.5s delay).
          // By that time setPasswordMode is still true — onDone() handles the
          // state reset, so we must NOT let SIGNED_OUT clear it mid-flight.
          // We detect this by checking setPasswordMode via a ref (set below).
          // Simple guard: if SIGNED_OUT fires and setPasswordMode ref is true, skip.
          if (setPasswordModeRef.current) {
            return;
          }
          // Normal sign-out — reset all state
          setLoggedIn(false);
          setLoggedUser('');
          setSetPasswordMode(false);
          setPendingApproval(false);
          setChecking(false);
          return;
        }

        // ── INITIAL_SESSION / TOKEN_REFRESHED ─────────────────────────────────
        // Fired on page load if a valid session exists in localStorage.
        // If a reset token is in the URL, ignore this — the sign-out+exchange
        // cycle will fire SIGNED_IN or PASSWORD_RECOVERY shortly after.
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          if (sessionStorage.getItem('strat101_set_password') === '1') {
            // Reset token flow in progress — ignore this session restore
            return;
          }
          if (session?.user) {
            resolveUsername(session).then(u => {
              setLoggedUser(u);
              setLoggedIn(true);
            });
          }
          setChecking(false);
          return;
        }
      }
    );

    // ── Detect reset/invite token in URL hash ────────────────────────────────
    // CRITICAL: Do NOT call history.replaceState here — Supabase needs the hash
    // to exchange for a session. We detect it first, sign out any existing
    // session, then let Supabase exchange the token cleanly.
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.replace('#', ''));
    const urlTokenType = hashParams.get('type');
    const hasResetToken = urlTokenType === 'invite' || urlTokenType === 'recovery' || urlTokenType === 'magiclink';

    if (hasResetToken) {
      // Set flag so SIGNED_IN/PASSWORD_RECOVERY handler knows this is a token flow
      sessionStorage.setItem('strat101_set_password', '1');
      setPasswordModeRef.current = true;

      // CRITICAL: By the time our JS runs, Supabase has already exchanged the
      // URL hash token and stored the new session in localStorage.
      // Calling signOut() here destroys that session — causing "Auth session missing"
      // when SetPasswordScreen calls updateUser().
      //
      // The correct behaviour:
      // - For recovery links: onAuthStateChange fires PASSWORD_RECOVERY automatically.
      // - For invite/magiclink: onAuthStateChange fires SIGNED_IN automatically.
      // Both are caught by the handlers above. We just need to wait.
      //
      // The only edge case is an admin testing in the same browser with their own
      // session open. In that case Supabase still replaces their session with the
      // token session in localStorage — so we don't need to sign them out either.
      //
      // Conclusion: do NOT call signOut or getSession here.
      // Just set the flag and let onAuthStateChange do its job.
      return;
    }

    // ── Normal page load — no reset token ────────────────────────────────────
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (!session) {
        setChecking(false);
      }
      // If session exists, INITIAL_SESSION fires via onAuthStateChange above
    });

    // ── Handle expired/invalid token ─────────────────────────────────────────
    // Supabase sets error params in the hash when a token is invalid or expired:
    // #error=access_denied&error_description=Token+has+expired+or+is+invalid
    if (hash.includes('error=') && hash.includes('error_description=')) {
      const errorDesc = hashParams.get('error_description') ?? 'The link is invalid or has expired.';
      history.replaceState(null, '', window.location.pathname); // clean URL
      sessionStorage.removeItem('strat101_set_password');
      setTokenError(errorDesc.replace(/\+/g, ' '));
      setChecking(false);
    }

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div style={{ minHeight:'100vh', background:'#0e1f35', display:'flex', alignItems:'flex-start', justifyContent:'center', overflowY:'auto', padding:'40px 16px' }}>
        <div style={{ textAlign:'center' }}>
          <img src={LOGO_SRC} alt='Strat101' style={{ width:44, height:44, borderRadius:12, objectFit:'cover', margin:'0 auto 14px', boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}/>
          <div style={{ fontSize:12, color:'#475569' }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (setPasswordMode) {
    return <SetPasswordScreen onDone={() => { setSetPasswordMode(false); setPasswordModeRef.current = false; setLoggedIn(false); setChecking(false); }}/>;
  }

  if (tokenError) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)', display:'flex', alignItems:'flex-start', justifyContent:'center', fontFamily:'system-ui,sans-serif', overflowY:'auto', padding:'24px 0' }}>
        <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:'40px 36px', maxWidth:400, width:'100%', margin:'0 16px', textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>⏰</div>
          <div style={{ color:'white', fontWeight:700, fontSize:20, marginBottom:10 }}>Link Expired</div>
          <div style={{ color:'#94a3b8', fontSize:13, lineHeight:1.7, marginBottom:24 }}>
            {tokenError}
            <br/><br/>
            Password reset links expire after <strong style={{ color:'white' }}>24 hours</strong> and can only be used once.
            Please request a new reset link.
          </div>
          <button onClick={() => { setTokenError(''); }}
            style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#2563eb,#4f46e5)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (pendingApproval) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)', display:'flex', alignItems:'flex-start', justifyContent:'center', fontFamily:'system-ui,sans-serif', overflowY:'auto', padding:'24px 0' }}>
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
  return username;
}
