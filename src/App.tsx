import React, { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants & Utils ────────────────────────────────────────────────────────
import { TYPES } from "./constants";
import { mkBlank, gId, tsNow, td } from "./utils";
import { TenantFeatures, Tenant } from "./types";
import { isAdminUser, DEFAULT_TENANTS } from "./adminData";
import { supabase } from "./lib/supabase";

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

// ─── Default feature set (all on) ─────────────────────────────────────────────
const ALL_FEATURES: TenantFeatures = {
  kanban: true, workitems: true, create: true, bot: true, reports: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE DATA HELPERS
// These functions translate between the flat DB row shape and the app's item shape.
// ═══════════════════════════════════════════════════════════════════════════════

// Build one app-item from a DB row plus pre-fetched related data
function dbRowToItem(
  row:       any,
  linkRows:  any[],
  depRows:   any[],
  commRows:  any[],
  attRows:   any[],
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
    .map   (a => ({ name: a.name, size: a.size, ext: a.ext, uploadedAt: a.uploaded_at }));

  return {
    id:             row.id,
    key:            row.key,
    type:           row.type,
    title:          row.title          ?? '',
    description:    row.description    ?? '',
    currentStatus:  row.current_status ?? '',
    currentStatusAt:row.current_status_at ?? '',
    riskStatement:  row.risk_statement ?? '',
    status:         row.status,
    priority:       row.priority,
    health:         row.health,
    risk:           row.risk,
    impact:         row.impact         ?? '',
    impactType:     row.impact_type    ?? '',
    owner:          row.owner          ?? '',
    assigned:       row.assigned       ?? '',
    sponsor:        row.sponsor        ?? '',
    businessUnit:   row.business_unit  ?? '',
    approvedBudget: row.approved_budget ?? '',
    actualCost:     row.actual_cost    ?? '',
    startDate:      row.start_date     ?? '',
    endDate:        row.end_date       ?? '',
    progress:       row.progress       ?? 0,
    tags:           row.tags           ?? [],
    keyResult:      row.key_result     ?? '',
    updatedAt:      row.updated_at     ?? '',
    updatedBy:      row.updated_by     ?? '',
    links,
    dependencies,
    comments,
    attachments,
  };
}

// Load all items for a tenant from Supabase in one parallel batch
async function loadItems(tenantId: string): Promise<any[]> {
  const [
    { data: rows   = [] },
    { data: links  = [] },
    { data: deps   = [] },
    { data: comms  = [] },
    { data: atts   = [] },
  ] = await Promise.all([
    supabase.from('work_items')
      .select('*').eq('tenant_id', tenantId).order('created_at'),
    supabase.from('item_links')
      .select('from_id, to_id').eq('tenant_id', tenantId),
    supabase.from('item_dependencies')
      .select('item_id, depends_on').eq('tenant_id', tenantId),
    supabase.from('comments')
      .select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase.from('attachments')
      .select('*').eq('tenant_id', tenantId),
  ]);

  return (rows ?? []).map((row: any) =>
    dbRowToItem(row, links ?? [], deps ?? [], comms ?? [], atts ?? [])
  );
}

// Write one item to Supabase (insert or update)
async function persistItem(item: any, tenantId: string): Promise<void> {
  const { error } = await supabase.from('work_items').upsert({
    id:               item.id,
    tenant_id:        tenantId,
    key:              item.key,
    type:             item.type,
    title:            item.title            || '',
    description:      item.description      || null,
    current_status:   item.currentStatus    || null,
    current_status_at:item.currentStatusAt  || null,
    risk_statement:   item.riskStatement    || null,
    status:           item.status,
    priority:         item.priority,
    health:           item.health,
    risk:             item.risk,
    impact:           item.impact           || null,
    impact_type:      item.impactType       || null,
    owner:            item.owner            || null,
    assigned:         item.assigned         || null,
    sponsor:          item.sponsor          || null,
    business_unit:    item.businessUnit     || null,
    approved_budget:  item.approvedBudget   || null,
    actual_cost:      item.actualCost       || null,
    start_date:       item.startDate        || null,
    end_date:         item.endDate          || null,
    progress:         item.progress         ?? 0,
    tags:             item.tags             ?? [],
    key_result:       item.keyResult        || null,
    updated_at:       new Date().toISOString(),
    updated_by:       item.updatedBy        || null,
  });
  if (error) console.error('persistItem error:', error.message);
}

// Hard-delete one item (links/deps/attachments/comments cascade in the DB)
async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('work_items').delete().eq('id', id);
  if (error) console.error('deleteItem error:', error.message);
}

// Sync link changes: remove old links not in the new set, add new ones
async function syncLinks(itemId: string, newLinks: string[], tenantId: string): Promise<void> {
  // Fetch current links for this item
  const { data: existing = [] } = await supabase
    .from('item_links')
    .select('from_id, to_id')
    .or(`from_id.eq.${itemId},to_id.eq.${itemId}`)
    .eq('tenant_id', tenantId);

  const currentSet = new Set(
    (existing ?? []).map((l: any) => l.from_id === itemId ? l.to_id : l.from_id)
  );
  const newSet = new Set(newLinks);

  // Delete removed links
  const toRemove = [...currentSet].filter(id => !newSet.has(id));
  for (const otherId of toRemove) {
    await supabase.from('item_links').delete()
      .or(`and(from_id.eq.${itemId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${itemId})`);
  }

  // Insert added links
  const toAdd = newLinks.filter(id => !currentSet.has(id));
  if (toAdd.length > 0) {
    await supabase.from('item_links').upsert(
      toAdd.map(otherId => ({ from_id: itemId, to_id: otherId, tenant_id: tenantId }))
    );
  }
}

// Sync dependency changes
async function syncDeps(itemId: string, newDeps: string[], tenantId: string): Promise<void> {
  const { data: existing = [] } = await supabase
    .from('item_dependencies')
    .select('depends_on')
    .eq('item_id', itemId);

  const currentSet = new Set((existing ?? []).map((d: any) => d.depends_on));
  const newSet     = new Set(newDeps);

  const toRemove = [...currentSet].filter(id => !newSet.has(id));
  for (const depId of toRemove) {
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

// Persist a new comment
async function persistComment(itemId: string, text: string, tenantId: string, createdBy: string): Promise<string> {
  const id = gId();
  await supabase.from('comments').insert({
    id, item_id: itemId, tenant_id: tenantId, text, created_by: createdBy,
  });
  return id;
}

// Delete a comment
async function deleteComment(commentId: string): Promise<void> {
  await supabase.from('comments').delete().eq('id', commentId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW BANNER
// ═══════════════════════════════════════════════════════════════════════════════
function PreviewBanner({ tenant, onExit }: { tenant: Tenant; onExit: () => void }) {
  return (
    <div style={{ background:'#fef3c7', borderBottom:'2px solid #f59e0b', padding:'6px 16px', display:'flex', alignItems:'center', gap:10, flexShrink:0, zIndex:50 }}>
      <span style={{ fontSize:14 }}>👁️</span>
      <span style={{ fontSize:12, fontWeight:600, color:'#92400e' }}>
        Previewing: <strong>{tenant.name}</strong>
        &nbsp;&middot;&nbsp;
        {Object.entries(tenant.features).filter(([,v])=>v).map(([k])=>k).join(', ')} enabled
      </span>
      <button onClick={onExit} style={{ marginLeft:'auto', padding:'4px 12px', borderRadius:6, border:'1px solid #f59e0b', background:'white', color:'#92400e', fontSize:11, fontWeight:700, cursor:'pointer' }}>
        &larr; Back to Admin
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE — now accepts tenantId and syncs with Supabase
// ═══════════════════════════════════════════════════════════════════════════════
function Workspace({
  loggedUser, isAdmin, features, previewTenant, onExitPreview, tenantId,
}: {
  loggedUser:    string;
  isAdmin:       boolean;
  features:      TenantFeatures;
  previewTenant: Tenant | null;
  onExitPreview: () => void;
  tenantId:      string | null;
}) {
  const [items,   setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState('kanban');
  const [workItemFilter, setWIF] = useState('all');
  const [sel,     setSel]     = useState<string|null>(null);
  const [dtab,    setDtab]    = useState('overview');
  const [form,    setForm]    = useState<any>(null);
  const [linkDlg, setLinkDlg] = useState<string|null>(null);
  const [linkQ,   setLinkQ]   = useState('');
  const [cmdOpen, setCmdOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected    = items.find(i => i.id === sel);
  const isListView  = TYPES.includes(view);
  const isWorkItems = view === 'workitems';

  // ── Load items from Supabase on mount / tenantId change ─────────────────────
  const refresh = useCallback(async () => {
    if (!tenantId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const loaded = await loadItems(tenantId);
    setItems(loaded);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Realtime subscription — re-fetch on any change ──────────────────────────
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`workspace:${tenantId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'work_items',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => refresh())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'comments',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => refresh())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'item_links',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => refresh())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'item_dependencies',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => refresh())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, refresh]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setCmdOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ── Reset view when tenant's feature set changes ─────────────────────────────
  useEffect(() => { setView('kanban'); setSel(null); }, [features]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const LOGGED_IN = loggedUser || 'RB';
  const stamp = (it: any) => ({ ...it, updatedAt: tsNow(), updatedBy: LOGGED_IN });

  // Optimistic local update + DB write
  const applyAndPersist = async (updated: any) => {
    setItems(p => p.some(x => x.id === updated.id)
      ? p.map(x => x.id === updated.id ? updated : x)
      : [...p, updated]
    );
    if (tenantId) {
      await persistItem(updated, tenantId);
      await syncLinks(updated.id, updated.links, tenantId);
      await syncDeps (updated.id, updated.dependencies, tenantId);
    }
  };

  // ── liveUpsert: auto-save in form (local only until Save) ───────────────────
  const liveUpsert = (it: any) => {
    const s = stamp(it);
    setItems(p => p.some(x => x.id === s.id) ? p.map(x => x.id === s.id ? s : x) : [...p, s]);
  };

  // ── upsert: called on Save button ────────────────────────────────────────────
  const upsert = async (it: any) => {
    const s = stamp(it);
    await applyAndPersist(s);
    setForm(null);
    setSel(s.id);
    if (isListView || view === 'kanban') setView(s.type);
  };

  // ── remove ───────────────────────────────────────────────────────────────────
  const remove = async (id: string) => {
    setItems(p => p.filter(i => i.id !== id).map(i => ({
      ...i,
      links:        i.links.filter((l: string) => l !== id),
      dependencies: i.dependencies.filter((d: string) => d !== id),
    })));
    if (sel === id) setSel(null);
    if (tenantId) await deleteItem(id);
  };

  // ── changeStatus / changeField (Kanban drag) ─────────────────────────────────
  const changeStatus = async (id: string, status: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const updated = stamp({ ...item, status });
    await applyAndPersist(updated);
  };

  const changeField = async (id: string, field: string, value: any) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const updated = stamp({ ...item, [field]: value });
    await applyAndPersist(updated);
  };

  // ── addLink ───────────────────────────────────────────────────────────────────
  const addLink = async (toId: string) => {
    if (!sel || toId === sel) return;
    const selItem = items.find(i => i.id === sel);
    const toItem  = items.find(i => i.id === toId);
    if (!selItem || !toItem) return;

    const updatedSel = stamp({ ...selItem, links: [...new Set([...selItem.links, toId])] });
    const updatedTo  = stamp({ ...toItem,  links: [...new Set([...toItem.links,  sel])] });

    setItems(p => p.map(i =>
      i.id === sel ? updatedSel : i.id === toId ? updatedTo : i
    ));

    if (tenantId) {
      await supabase.from('item_links').upsert({
        from_id: sel, to_id: toId, tenant_id: tenantId,
      });
    }
    setLinkDlg(null);
  };

  // ── rmLink ────────────────────────────────────────────────────────────────────
  const rmLink = async (lid: string) => {
    const selItem = items.find(i => i.id === sel);
    const lidItem = items.find(i => i.id === lid);
    if (!selItem) return;

    setItems(p => p.map(i => {
      if (i.id === sel) return stamp({ ...i, links: i.links.filter((l: string) => l !== lid) });
      if (i.id === lid && lidItem) return stamp({ ...i, links: i.links.filter((l: string) => l !== sel) });
      return i;
    }));

    if (tenantId) {
      await supabase.from('item_links').delete()
        .or(`and(from_id.eq.${sel},to_id.eq.${lid}),and(from_id.eq.${lid},to_id.eq.${sel})`);
    }
  };

  // ── addDep ────────────────────────────────────────────────────────────────────
  const addDep = async (toId: string) => {
    if (!sel || toId === sel) return;
    const selItem = items.find(i => i.id === sel);
    if (!selItem) return;

    const updated = stamp({ ...selItem, dependencies: [...new Set([...selItem.dependencies, toId])] });
    setItems(p => p.map(i => i.id === sel ? updated : i));

    if (tenantId) {
      await supabase.from('item_dependencies').upsert({
        item_id: sel, depends_on: toId, tenant_id: tenantId,
      });
    }
    setLinkDlg(null);
  };

  // ── rmDep ─────────────────────────────────────────────────────────────────────
  const rmDep = async (did: string) => {
    const selItem = items.find(i => i.id === sel);
    if (!selItem) return;
    const updated = stamp({ ...selItem, dependencies: selItem.dependencies.filter((d: string) => d !== did) });
    setItems(p => p.map(i => i.id === sel ? updated : i));
    if (tenantId) {
      await supabase.from('item_dependencies').delete()
        .eq('item_id', sel).eq('depends_on', did);
    }
  };

  // ── File attachment — Phase 9: Supabase Storage ──────────────────────────────
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;   // 10 MB hard limit

  const addFile = async (f: File) => {
    if (!f || !sel) return;

    // Size guard — show inline error on the item card
    if (f.size > MAX_ATTACHMENT_BYTES) {
      const mb = (f.size / 1048576).toFixed(1);
      setItems(p => p.map(i =>
        i.id === sel ? { ...i, _uploadError: `"${f.name}" is ${mb} MB — max 10 MB.` } : i
      ));
      setTimeout(() =>
        setItems(p => p.map(i =>
          i.id === sel ? { ...i, _uploadError: undefined } : i
        )), 6000);
      return;
    }

    const sizeLabel = f.size < 1048576
      ? Math.round(f.size / 1024) + ' KB'
      : (f.size / 1048576).toFixed(1) + ' MB';
    const ext    = f.name.split('.').pop()?.toLowerCase() ?? '';
    const newAtt = { name: f.name, size: sizeLabel, ext, uploadedAt: td() };

    // 1. Optimistic local update so the UI feels instant
    setItems(p => p.map(i =>
      i.id === sel ? stamp({ ...i, attachments: [...i.attachments, newAtt] }) : i
    ));

    if (!tenantId) return;   // no DB operations in preview mode

    // 2. Upload file bytes to Supabase Storage bucket "attachments"
    //    Path format: {tenantId}/{itemId}/{timestamp}_{filename}
    //    Row-level security on the bucket restricts access to the owning tenant.
    const storagePath = `${tenantId}/${sel}/${Date.now()}_${f.name}`;

    const { error: uploadErr } = await supabase.storage
      .from('attachments')
      .upload(storagePath, f, {
        cacheControl: '3600',
        upsert:       false,   // never silently overwrite
      });

    if (uploadErr) {
      // Roll back optimistic update and surface the error
      console.error('Storage upload error:', uploadErr.message);
      setItems(p => p.map(i =>
        i.id === sel
          ? {
              ...stamp({ ...i, attachments: i.attachments.filter((a: any) => a.name !== f.name) }),
              _uploadError: `Upload failed: ${uploadErr.message}`,
            }
          : i
      ));
      setTimeout(() =>
        setItems(p => p.map(i =>
          i.id === sel ? { ...i, _uploadError: undefined } : i
        )), 6000);
      return;
    }

    // 3. Record metadata in the attachments table so it survives a page reload
    const { error: dbErr } = await supabase.from('attachments').insert({
      item_id:      sel,
      tenant_id:    tenantId,
      name:         f.name,
      size:         sizeLabel,
      ext,
      storage_path: storagePath,
      uploaded_at:  new Date().toISOString(),
    });

    if (dbErr) {
      console.error('Attachment DB insert error:', dbErr.message);
      // File is in Storage but metadata failed — log and continue.
      // The next full refresh() will pick it up or it can be re-linked manually.
    }
  };

  // rmFile — removes from local state, Storage bucket, and attachments table
  const rmFile = async (idx: number) => {
    const selItem = items.find(i => i.id === sel);
    if (!selItem) return;

    const att = selItem.attachments[idx];

    // Optimistic removal
    setItems(p => p.map(i =>
      i.id === sel
        ? stamp({ ...i, attachments: i.attachments.filter((_: any, j: number) => j !== idx) })
        : i
    ));

    if (!tenantId || !att) return;

    // Delete from Storage if we have a path
    if (att.storagePath) {
      await supabase.storage.from('attachments').remove([att.storagePath]);
    }

    // Delete metadata row — match by item_id + name since we may not have the row id
    await supabase.from('attachments')
      .delete()
      .eq('item_id',   sel)
      .eq('tenant_id', tenantId)
      .eq('name',      att.name);
  };


  // ── Comments ──────────────────────────────────────────────────────────────────
  const addComment = async (text: string) => {
    if (!sel || !text.trim()) return;
    const id  = gId();
    const ts  = tsNow();
    const newC = { id, text: text.trim(), ts };

    // Optimistic update
    setItems(p => p.map(i => i.id === sel
      ? stamp({ ...i, comments: [newC, ...i.comments] }) : i));

    if (tenantId) {
      await persistComment(sel, text.trim(), tenantId, LOGGED_IN);
    }
  };

  const rmComment = async (cid: string) => {
    setItems(p => p.map(i => i.id === sel
      ? stamp({ ...i, comments: i.comments.filter((c: any) => c.id !== cid) }) : i));
    if (tenantId) await deleteComment(cid);
  };

  // ── Navigation helpers ────────────────────────────────────────────────────────
  const nav    = (id: string) => { const it = items.find(i => i.id === id); if (it) { setView(it.type); setSel(id); setDtab('overview'); } };
  const goView = (v: string)  => { setView(v); setSel(null); };
  const createAndOpen = (type: string) => {
    const blank = mkBlank(type, items);
    setItems(p => [...p, blank]);
    setForm({ ...blank, _autoSave: true });
  };

  const disabledView =
    (view === 'kanban'   && !features.kanban)   ||
    (view === 'reports'  && !features.reports)  ||
    (view === 'bot'      && !features.bot)      ||
    (isWorkItems         && !features.workitems);

  // ── Loading splash ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily:'system-ui,sans-serif', fontSize:'13px', background:'#f1f5f9' }}>
        {previewTenant && <PreviewBanner tenant={previewTenant} onExit={onExitPreview}/>}
        <TopNav view={view} setView={goView} items={[]} onNavItem={()=>{}}
          onCreateNew={()=>{}} workItemFilter={workItemFilter} setWorkItemFilter={setWIF}
          onNew={()=>{}} loggedUser={loggedUser} isAdmin={false} features={features}/>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
            <div style={{ fontSize:13, color:'#64748b' }}>Loading your workspace\u2026</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
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
                <div style={{ fontSize:48 }}>🔒</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#374151' }}>Module Not Enabled</div>
                <div style={{ fontSize:12, color:'#94a3b8', textAlign:'center', maxWidth:300, lineHeight:1.6 }}>
                  This module is disabled for this tenant. Enable it in the Admin Console \u2192 Features.
                </div>
              </div>
            )}
          </div>
        </div>

        {selected && view !== 'bot' && (
          <div style={{ position: window.innerWidth < 640 ? 'absolute' : 'relative', inset: window.innerWidth < 640 ? 0 : 'auto', zIndex: window.innerWidth < 640 ? 30 : 1, display:'flex', width: window.innerWidth < 640 ? '100%' : '420px', flexShrink:0 }}>
            <DetailPanel item={selected} allItems={items} tab={dtab} onTab={setDtab}
              onEdit={() => setForm({ ...selected })} onDelete={() => remove(selected.id)} onClose={() => setSel(null)}
              onAddLink={() => { setLinkQ(''); setLinkDlg('link'); }}
              onAddDep={() => { setLinkQ(''); setLinkDlg('dep'); }}
              onRmLink={rmLink} onRmDep={rmDep}
              onAddFile={() => fileRef.current?.click()} onRmFile={rmFile}
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

// ═══════════════════════════════════════════════════════════════════════════════
// APP MAIN — resolves tenant ID from Supabase, then renders admin or workspace
// ═══════════════════════════════════════════════════════════════════════════════
function AppMain({ loggedUser }: { loggedUser: string }) {
  const isAdmin = isAdminUser(loggedUser);

  const [screen,        setScreen]        = useState<'admin'|'workspace'>(isAdmin ? 'admin' : 'workspace');
  const [previewTenant, setPreviewTenant] = useState<Tenant | null>(null);
  const [tenantId,      setTenantId]      = useState<string | null>(null);

  // ── Resolve the tenant ID for this user from Supabase ───────────────────────
  // stratadmin has no tenant — they operate across all tenants.
  // Regular users are linked to exactly one tenant in tenant_users.
  useEffect(() => {
    if (isAdmin) { setTenantId(null); return; }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('auth_user_id', user.id)
        .eq('active', true)
        .single()
        .then(({ data }) => {
          if (data?.tenant_id) setTenantId(data.tenant_id);
        });
    });
  }, [isAdmin]);

  const handlePreview     = (tenant: Tenant) => { setPreviewTenant(tenant); setScreen('workspace'); };
  const handleExitPreview = ()                => { setPreviewTenant(null);  setScreen('admin');     };

  // When admin previews a tenant, use that tenant's features and its real tenant_id
  const features: TenantFeatures  = previewTenant ? previewTenant.features : ALL_FEATURES;
  const activeTenantId: string | null = previewTenant ? previewTenant.id : tenantId;

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  if (screen === 'admin') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ fontFamily:'system-ui,sans-serif' }}>
        <div style={{ background:'#1e293b', padding:'0 20px', height:44, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:6, background:'linear-gradient(135deg,#f59e0b,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>⚙️</div>
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
        tenantId={activeTenantId}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT — session management (unchanged from Phase 6)
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [loggedIn,   setLoggedIn]   = useState(false);
  const [loggedUser, setLoggedUser] = useState('');
  const [checking,   setChecking]   = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setLoggedUser(resolveUsername(session.user.email ?? ''));
        setLoggedIn(true);
      }
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setLoggedUser(resolveUsername(session.user.email ?? ''));
        setLoggedIn(true);
      } else {
        setLoggedIn(false);
        setLoggedUser('');
      }
    });

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
function resolveUsername(email: string): string {
  const map: Record<string, string> = {
    'stratadmin@strat101.com': 'stratadmin',
    'raviboorla@strat101.com': 'raviboorla',
  };
  return map[email.toLowerCase()] ?? email.split('@')[0];
}
