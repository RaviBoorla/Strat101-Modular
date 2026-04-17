import React, { useState, useRef, useMemo } from "react";
import { TC, SC, PC, HIC, RC, SPONSOR_TYPES, TL, ITEM_SUBTYPE_META } from "../constants";
import { Lbl } from "./shared";

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ item }: { item: any }) {
  const fmt = (v: any) => v ? `£${Number(v).toLocaleString()}` : '—';
  return (
    <div className="p-2 space-y-2">
      {item.currentStatus && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-blue-700 font-bold uppercase" style={{ fontSize:10, letterSpacing:'0.06em' }}>📡 Current Status</div>
            {item.currentStatusAt && <div className="text-blue-400 font-mono" style={{ fontSize:10 }}>🕐 {item.currentStatusAt}</div>}
          </div>
          <p className="text-blue-800 leading-relaxed" style={{ fontSize:12 }}>{item.currentStatus}</p>
        </div>
      )}
      {item.description && <div><Lbl>Description</Lbl><p className="text-gray-700 whitespace-pre-line leading-relaxed" style={{ fontSize:12 }}>{item.description}</p></div>}
      {item.type==='okr' && item.keyResult && <div><Lbl>Key Results (Summary)</Lbl><p className="text-gray-700 whitespace-pre-line bg-blue-50 rounded-lg p-2" style={{ fontSize:12 }}>{item.keyResult}</p></div>}
      {item.type==='kr' && item.keyResult && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <div className="text-sky-700 font-bold uppercase mb-1.5" style={{ fontSize:10, letterSpacing:'0.06em' }}>🔑 Key Result Definition</div>
          <p className="text-sky-800 leading-relaxed" style={{ fontSize:12 }}>{item.keyResult}</p>
        </div>
      )}
      {/* Sprint fields — always shown for task / subtask */}
      {(item.type === 'task' || item.type === 'subtask') && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
          <div className="text-violet-700 font-bold uppercase mb-2" style={{ fontSize:10, letterSpacing:'0.06em' }}>🏃 Sprint</div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {item.itemSubtype && ITEM_SUBTYPE_META[item.itemSubtype] && (
              <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:4,
                background:`${ITEM_SUBTYPE_META[item.itemSubtype].color}18`,
                color: ITEM_SUBTYPE_META[item.itemSubtype].color,
                border:`1px solid ${ITEM_SUBTYPE_META[item.itemSubtype].color}40` }}>
                {ITEM_SUBTYPE_META[item.itemSubtype].icon} {ITEM_SUBTYPE_META[item.itemSubtype].label}
              </span>
            )}
            {item.storyPoints != null && (
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999,
                background:'#f0f9ff', color:'#0369a1', border:'1px solid #bae6fd' }}>
                {item.storyPoints} pt{item.storyPoints !== 1 ? 's' : ''}
              </span>
            )}
            {item.sprintId && (
              <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:999,
                background:'#f0fdf4', color:'#15803d', border:'1px solid #86efac' }}>
                In Sprint
              </span>
            )}
          </div>
          <div>
            <div className="text-violet-600 font-semibold uppercase mb-1 mt-1" style={{ fontSize:9, letterSpacing:'0.05em' }}>Acceptance Criteria</div>
            {item.acceptanceCriteria
              ? <p className="text-violet-900 whitespace-pre-line leading-relaxed" style={{ fontSize:12 }}>{item.acceptanceCriteria}</p>
              : <p className="text-violet-400 italic" style={{ fontSize:12 }}>Not set — edit item to add acceptance criteria</p>
            }
          </div>
        </div>
      )}
      {item.riskStatement && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="text-red-700 font-bold uppercase mb-1.5" style={{ fontSize:10, letterSpacing:'0.06em' }}>⚠️ Risk Statement</div>
          <p className="text-red-800 leading-relaxed" style={{ fontSize:12 }}>{item.riskStatement}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><Lbl>Owner</Lbl><p className="text-gray-700" style={{ fontSize:12 }}>{item.owner||'—'}</p></div>
        <div><Lbl>Assigned To</Lbl><p className="text-gray-700" style={{ fontSize:12 }}>{item.assigned||'—'}</p></div>
      </div>
      {SPONSOR_TYPES.has(item.type) && (
        <div><Lbl>Sponsor</Lbl><p className="text-gray-700" style={{ fontSize:12 }}>{item.sponsor||'—'}</p></div>
      )}
      {item.businessUnit && <div><Lbl>Business Unit</Lbl><p className="text-gray-700" style={{ fontSize:12 }}>{item.businessUnit}</p></div>}
      <div className="grid grid-cols-2 gap-2">
        {item.impactType && <div><Lbl>Impact Type</Lbl>
          <span style={{
            fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:999,
            background:item.impactType==='Revenue'?'#dcfce7':item.impactType==='Cost'?'#fee2e2':'#dbeafe',
            color:item.impactType==='Revenue'?'#15803d':item.impactType==='Cost'?'#dc2626':'#1d4ed8',
          }}>{item.impactType}</span>
        </div>}
        {item.impact && <div><Lbl>Impact</Lbl><p className="text-gray-700" style={{ fontSize:12 }}>{item.impact}</p></div>}
      </div>
      {(item.approvedBudget||item.actualCost) && (
        <div className="rounded-lg border bg-gray-50 p-2">
          <div className="text-gray-500 font-semibold uppercase mb-1.5" style={{ fontSize:10, letterSpacing:'0.05em' }}>💰 Financials</div>
          <div className="grid grid-cols-2 gap-2">
            <div><Lbl>Approved Budget</Lbl><p className="text-gray-700 font-semibold" style={{ fontSize:12 }}>{fmt(item.approvedBudget)}</p></div>
            <div>
              <Lbl>Actual Cost</Lbl>
              <p style={{ fontSize:12, fontWeight:600, color:
                item.approvedBudget&&item.actualCost&&Number(item.actualCost)>Number(item.approvedBudget)?'#dc2626':'#15803d'
              }}>{fmt(item.actualCost)}</p>
            </div>
          </div>
          {item.approvedBudget && item.actualCost && (
            <div className="mt-1.5">
              <div className="flex justify-between mb-0.5" style={{ fontSize:9, color:'#94a3b8' }}>
                <span>Spend</span>
                <span>{Math.round(Number(item.actualCost)/Number(item.approvedBudget)*100)}% of budget</span>
              </div>
              <div className="bg-gray-200 rounded-full" style={{ height:4 }}>
                <div className={`rounded-full h-full ${Number(item.actualCost)>Number(item.approvedBudget)?'bg-red-500':'bg-green-500'}`}
                  style={{ width:`${Math.min(Number(item.actualCost)/Number(item.approvedBudget)*100,100)}%` }}/>
              </div>
            </div>
          )}
        </div>
      )}
      <div><Lbl>Progress</Lbl>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex-1 bg-gray-200 rounded-full" style={{ height:5 }}><div className="bg-blue-500 rounded-full h-full" style={{ width:`${item.progress}%` }}/></div>
          <span className="text-gray-600 font-semibold" style={{ fontSize:11 }}>{item.progress}%</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Lbl>Start</Lbl><p className="text-gray-700" style={{ fontSize:12 }}>{item.startDate||'—'}</p></div>
        <div><Lbl>End</Lbl><p className="text-gray-700" style={{ fontSize:12 }}>{item.endDate||'—'}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Lbl>Health</Lbl><p style={{ fontSize:13 }}>{HIC[item.health]} {item.health}</p></div>
        <div><Lbl>Risk Level</Lbl><p className={`font-semibold ${RC[item.risk]||''}`} style={{ fontSize:12 }}>{item.risk}</p></div>
      </div>
      {item.tags?.length>0 && <div><Lbl>Tags</Lbl><div className="flex flex-wrap gap-1 mt-1">{item.tags.map((t: string) => <span key={t} className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5" style={{ fontSize:11 }}>{t}</span>)}</div></div>}
      {(item.updatedAt||item.updatedBy) && (
        <div className="border-t pt-2 flex items-center gap-3" style={{ fontSize:10, color:'#94a3b8' }}>
          <span style={{ fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Last Updated</span>
          {item.updatedBy && <span>👤 {item.updatedBy}</span>}
          {item.updatedAt && <span style={{ fontFamily:'monospace' }}>🕐 {item.updatedAt}</span>}
        </div>
      )}
    </div>
  );
}

// ─── COMMENTS TAB ─────────────────────────────────────────────────────────────
function CommentsTab({ item, onAdd, onRm }: { item: any; onAdd: (text: string) => void; onRm: (id: string) => void }) {
  const [txt, setTxt] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const submit = () => { if(txt.trim()){ onAdd(txt); setTxt(''); } };
  const onKey = (e: React.KeyboardEvent) => { if(e.key==='Enter' && (e.metaKey||e.ctrlKey)) submit(); };
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-gray-50 shrink-0">
        <textarea ref={textRef} value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={onKey} rows={3}
          className="w-full border rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" style={{ fontSize:12 }}
          placeholder="Add a comment… (⌘+Enter to post)"/>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-gray-400" style={{ fontSize:10 }}>⌘+Enter to post</span>
          <button onClick={submit} disabled={!txt.trim()} className="px-4 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-semibold" style={{ fontSize:12 }}>Post</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!item.comments?.length
          ? <div className="text-center text-gray-400 py-10" style={{ fontSize:12 }}>No comments yet.<br/>Be the first to add one!</div>
          : item.comments.map((c: any, idx: number) => (
            <div key={c.id} className="group relative bg-white rounded-xl border p-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold" style={{ fontSize:10 }}>U</div>
                  {idx===0 && <span className="bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5 font-semibold" style={{ fontSize:10 }}>Latest</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 font-mono" style={{ fontSize:10 }}>🕐 {c.ts}</span>
                  <button onClick={() => onRm(c.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 font-bold transition-opacity" style={{ fontSize:16, lineHeight:1 }}>×</button>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap" style={{ fontSize:12 }}>{c.text}</p>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── HIERARCHY TAB ────────────────────────────────────────────────────────────
function HNode({ item, allItems, selectedId, ancestorIds, onNav, depth, visited }: any) {
  const isSel = item.id === selectedId;
  const isAnc = ancestorIds.has(item.id);
  const [open, setOpen] = useState(isSel || isAnc);
  const c = TC[item.type];

  const children = item.links
    .map((id: string) => allItems.find((i: any) => i.id===id))
    .filter(Boolean)
    .filter((li: any) => TL[li.type] > TL[item.type] && !visited.has(li.id))
    .filter((li: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.id===li.id)===idx);

  const nextVisited = new Set([...visited, ...children.map((c: any) => c.id)]);
  const rowBg = isSel ? 'bg-blue-50 border border-blue-300 shadow-sm' : isAnc ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent';
  const titleCl = isSel ? 'text-blue-700 font-bold' : 'text-gray-700 hover:text-blue-600 hover:underline';
  const indent = depth * 18;
  const hasKids = children.length > 0;

  return (
    <div>
      <div className="flex items-stretch">
        {depth > 0 && (
          <div className="shrink-0 flex" style={{ width: indent }}>
            {Array.from({length: depth}).map((_,i) => (
              <div key={i} className="shrink-0" style={{ width:18, borderLeft: i===depth-1 ? '1.5px solid #cbd5e1' : '1.5px solid #e2e8f0' }} />
            ))}
          </div>
        )}
        <div className={`flex-1 flex items-start gap-1.5 px-2 py-1.5 rounded-lg my-0.5 transition-colors ${rowBg}`}>
          <div className="shrink-0 mt-0.5" style={{ width:14, textAlign:'center' }}>
            {hasKids
              ? <button onClick={() => setOpen((o: boolean) => !o)} className="text-gray-400 hover:text-blue-500 font-bold transition-colors" style={{ fontSize:10, lineHeight:1 }}>{open?'▼':'▶'}</button>
              : <span className={`${isSel?'text-blue-400':'text-gray-300'}`} style={{ fontSize:8 }}>●</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className={`font-bold shrink-0 ${c.tc}`} style={{ fontSize:11 }}>{c.i}</span>
              <span className={`font-semibold shrink-0 ${c.tc}`} style={{ fontSize:9 }}>{c.l}</span>
              <span className={`font-mono shrink-0 ${isSel?'text-blue-600 font-bold':'text-gray-400'}`} style={{ fontSize:10 }}>{item.key}</span>
              <span className={`px-1.5 rounded-full shrink-0 ${SC[item.status]||''}`} style={{ fontSize:9 }}>{item.status}</span>
              <span style={{ fontSize:11 }}>{HIC[item.health]}</span>
              {isSel && <span className="bg-blue-600 text-white rounded-full px-1.5 py-0 font-semibold shrink-0" style={{ fontSize:9 }}>YOU ARE HERE</span>}
            </div>
            <button onClick={() => onNav(item.id)}
              className={`text-left block w-full leading-snug ${titleCl}`}
              style={{ fontSize: isSel?12:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {item.title||'(Untitled)'}
            </button>
            {item.progress > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <div className="bg-gray-200 rounded-full" style={{ width:50, height:3 }}>
                  <div className={`rounded-full h-full ${item.progress===100?'bg-green-500':'bg-blue-400'}`} style={{ width:`${item.progress}%` }}/>
                </div>
                <span className="text-gray-400" style={{ fontSize:9 }}>{item.progress}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {open && children.map((ch: any) => (
        <HNode key={ch.id} item={ch} allItems={allItems}
          selectedId={selectedId} ancestorIds={ancestorIds}
          onNav={onNav} depth={depth+1} visited={nextVisited} />
      ))}
    </div>
  );
}

function HierarchyTab({ item, allItems, onNav }: { item: any; allItems: any[]; onNav: (id: string) => void }) {
  // Collect only items connected to the selected item (ancestors + self + descendants)
  const { connectedItems, roots, ancestorIds } = useMemo(() => {
    const connected = new Set<string>();

    // Walk UP — find all ancestors of item
    function findAncestors(id: string, vis = new Set<string>()) {
      if (vis.has(id)) return;
      vis.add(id);
      connected.add(id);
      allItems.forEach(it => {
        if (it.links?.includes(id) && TL[it.type] < TL[allItems.find((i:any)=>i.id===id)?.type??'']) {
          findAncestors(it.id, new Set(vis));
        }
      });
    }

    // Walk DOWN — find all descendants of item
    function findDescendants(id: string, vis = new Set<string>()) {
      if (vis.has(id)) return;
      vis.add(id);
      connected.add(id);
      const it = allItems.find((i:any) => i.id === id);
      if (!it) return;
      (it.links ?? []).forEach((lid: string) => {
        const child = allItems.find((i:any) => i.id === lid);
        if (child && TL[child.type] > TL[it.type]) findDescendants(lid, new Set(vis));
      });
    }

    connected.add(item.id);
    // Find ancestors — items that link TO this item and are higher in hierarchy
    allItems.forEach(it => {
      if (it.links?.includes(item.id) && TL[it.type] < TL[item.type]) {
        findAncestors(it.id);
      }
    });
    findDescendants(item.id);

    // Subset of allItems that are connected
    const subset = allItems.filter(i => connected.has(i.id));

    // Roots = connected items with no parent in the connected set
    const subsetRoots = subset.filter(it => {
      return !subset.some(other =>
        other.links?.includes(it.id) && TL[other.type] < TL[it.type]
      );
    });

    // Ancestor set for highlighting
    const ancSet = new Set<string>();
    function markAnc(id: string, vis = new Set<string>()): boolean {
      if(vis.has(id)) return false;
      vis.add(id);
      const it = subset.find((i:any) => i.id===id);
      if(!it) return false;
      if(it.id === item.id) return true;
      const kids = (it.links??[]).map((lid:string) => subset.find((i:any)=>i.id===lid)).filter(Boolean)
        .filter((c:any) => TL[c.type] > TL[it.type]);
      const found = kids.some((c:any) => markAnc(c.id, new Set(vis)));
      if(found) ancSet.add(id);
      return found;
    }
    subsetRoots.forEach(r => markAnc(r.id));

    return { connectedItems: subset, roots: subsetRoots, ancestorIds: ancSet };
  }, [allItems, item.id, item.type, item.links]);

  if(!roots.length) return (
    <div className="p-2 text-center text-gray-400 py-8" style={{ fontSize:12 }}>No linked items in hierarchy</div>
  );

  return (
    <div className="p-3">
      <div className="flex items-center gap-3 mb-3 px-1 py-1.5 bg-gray-50 rounded-lg border">
        <span className="text-gray-400" style={{ fontSize:10 }}>
          📍 <span className="text-blue-600 font-semibold">Blue = selected</span>
          &nbsp;·&nbsp; showing linked hierarchy only &nbsp;·&nbsp; click to navigate
        </span>
      </div>
      <div>
        {roots.map(r => (
          <HNode key={r.id} item={r} allItems={connectedItems}
            selectedId={item.id} ancestorIds={ancestorIds}
            onNav={onNav} depth={0} visited={new Set([r.id])} />
        ))}
      </div>
    </div>
  );
}

// ─── LINKS TAB ────────────────────────────────────────────────────────────────
function LinksTab({ ids, allItems, onAdd, onRm, onNav, label }: any) {
  const linked = (ids||[]).map((id: string) => allItems.find((i: any) => i.id===id)).filter(Boolean);
  return (
    <div className="p-2">
      <button onClick={onAdd} className="w-full mb-3 py-2 rounded-lg border-2 border-dashed border-blue-200 text-blue-500 font-medium hover:bg-blue-50" style={{ fontSize:12 }}>+ Add {label}</button>
      {!linked.length ? <p className="text-gray-400 text-center py-6" style={{ fontSize:12 }}>No {label.toLowerCase()} yet</p> : linked.map((li: any) => {
        const cc = TC[li.type];
        return (
          <div key={li.id} className="group flex items-start gap-2 p-2 rounded-lg border bg-gray-50 hover:bg-white mb-2">
            <span style={{ fontSize:14, marginTop:1 }}>{cc.i}</span>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold ${cc.tc}`} style={{ fontSize:10 }}>{cc.l} · {li.key}</div>
              <button onClick={() => onNav(li.id)} className="text-gray-700 hover:text-blue-600 hover:underline text-left block w-full" style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{li.title||'(Untitled)'}</button>
              <span className={`inline-block mt-0.5 px-1.5 rounded-full ${SC[li.status]||''}`} style={{ fontSize:10 }}>{li.status}</span>
            </div>
            <button onClick={() => onRm(li.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 font-bold" style={{ fontSize:16, lineHeight:1 }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── FILES TAB ────────────────────────────────────────────────────────────────
function FilesTab({ item, onAdd, onRm }: { item: any; onAdd: () => void; onRm: (idx: number) => void }) {
  const ico = (e: string) => ({pdf:'📄',xlsx:'📊',xls:'📊',docx:'📝',doc:'📝',png:'🖼️',jpg:'🖼️',csv:'📊',zip:'🗜️'} as Record<string,string>)[e]||'📎';
  return (
    <div className="p-2">
      {item._uploadError && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'8px 12px', marginBottom:10, display:'flex', alignItems:'flex-start', gap:8 }}>
          <span style={{ fontSize:16, lineHeight:1, flexShrink:0 }}>⚠️</span>
          <span style={{ fontSize:12, color:'#dc2626', lineHeight:1.4 }}>{item._uploadError}</span>
        </div>
      )}
      <button onClick={onAdd} className="w-full mb-1 py-2 rounded-lg border-2 border-dashed border-blue-200 text-blue-500 font-medium hover:bg-blue-50" style={{ fontSize:12 }}>
        + Upload Attachment
      </button>
      <div style={{ fontSize:10, color:'#94a3b8', textAlign:'center', marginBottom:10 }}>Max file size: 10 MB</div>
      {!item.attachments.length ? <p className="text-gray-400 text-center py-6" style={{ fontSize:12 }}>No attachments yet</p> : item.attachments.map((a: any, i: number) => (
        <div key={i} className="group flex items-center gap-2 p-2 rounded-lg border bg-gray-50 hover:bg-white mb-2">
          <span style={{ fontSize:18 }}>{ico(a.ext)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-gray-700 font-medium" style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
            <div className="text-gray-400" style={{ fontSize:10 }}>{a.size} · {a.uploadedAt}</div>
          </div>
          <button onClick={() => onRm(i)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 font-bold" style={{ fontSize:16, lineHeight:1 }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
interface DetailPanelProps {
  item: any;
  allItems: any[];
  tab: string;
  onTab: (tab: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  isViewer?: boolean;
  onAddLink: () => void;
  onAddDep: () => void;
  onRmLink: (id: string) => void;
  onRmDep: (id: string) => void;
  onAddFile: () => void;
  onRmFile: (idx: number) => void;
  onAddComment: (text: string) => void;
  onRmComment: (id: string) => void;
  onNav: (id: string) => void;
  onTreeMap?: () => void;
  agentOutcomes?: any[];
}

export default function DetailPanel({ item, allItems, tab, onTab, onEdit, onDelete, onClose, isViewer = false, onAddLink, onAddDep, onRmLink, onRmDep, onAddFile, onRmFile, onAddComment, onRmComment, onNav, onTreeMap, agentOutcomes = [] }: DetailPanelProps) {
  const c = TC[item.type];
  const TABS = [
    ['overview','📋','Info'],
    ['hierarchy','🌳','Tree'],
    ['links','🔗',`Links(${item.links.length})`],
    ['deps','⛓️',`Deps(${item.dependencies?.length||0})`],
    ['files','📎',`Files(${item.attachments.length})`],
    ['comments','💬',`Chat(${item.comments?.length||0})`],
    ...(agentOutcomes.length > 0 ? [['agent','🤖',`Agent(${agentOutcomes.length})`]] : []),
  ];

  return (
    <aside className="flex flex-col bg-white border-l shadow-xl overflow-hidden" style={{ width:'100%', height:'100%' }}>
      <div className={`p-4 border-b ${c.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`font-bold ${c.tc}`} style={{ fontSize:11 }}>{c.i} {c.l}</span>
          <div className="flex items-center gap-1">
            {!isViewer&&<button onClick={onEdit} className="p-1 rounded hover:bg-white text-gray-400 hover:text-blue-600" style={{ fontSize:13 }}>✏️</button>}
            {!isViewer&&<button onClick={onDelete} className="p-1 rounded hover:bg-white text-gray-400 hover:text-red-500" style={{ fontSize:13 }}>🗑️</button>}
            <button onClick={onClose} className="p-1 rounded hover:bg-white text-gray-400 hover:text-gray-700 font-bold" style={{ fontSize:20, lineHeight:1 }}>×</button>
          </div>
        </div>
        <div className="font-mono text-gray-500 mb-0.5" style={{ fontSize:11 }}>{item.key}</div>
        <div className="font-bold text-gray-800 leading-snug" style={{ fontSize:13 }}>{item.title||'(Untitled)'}</div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full font-medium ${SC[item.status]||''}`} style={{ fontSize:11 }}>{item.status}</span>
          <span className={`font-semibold ${PC[item.priority]||''}`} style={{ fontSize:11 }}>{item.priority}</span>
          <span style={{ fontSize:13 }}>{HIC[item.health]}</span>
          <span className={`font-semibold ${RC[item.risk]||''}`} style={{ fontSize:11 }}>⚠ {item.risk}</span>
        </div>
      </div>

      <div className="flex border-b bg-gray-50 shrink-0 overflow-x-auto" style={{ WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
        {TABS.map(([t,ic,lb]) => (
          <button key={t}
            onClick={() => t === 'hierarchy' && onTreeMap ? onTreeMap() : onTab(t)}
            className={`shrink-0 py-2 px-2 font-medium flex items-center gap-0.5 transition-colors ${tab===t?'border-b-2 border-blue-500 text-blue-600 bg-white':'text-gray-500 hover:bg-gray-100'}`}
            style={{ fontSize:10 }}>{ic} {lb}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab==='overview'  && <OverviewTab item={item}/>}
        {tab==='hierarchy' && <HierarchyTab item={item} allItems={allItems} onNav={onNav}/>}
        {tab==='links'     && <LinksTab ids={item.links} allItems={allItems} onAdd={onAddLink} onRm={onRmLink} onNav={onNav} label="Links"/>}
        {tab==='deps'      && <LinksTab ids={item.dependencies||[]} allItems={allItems} onAdd={onAddDep} onRm={onRmDep} onNav={onNav} label="Dependencies"/>}
        {tab==='files'     && <FilesTab item={item} onAdd={onAddFile} onRm={onRmFile}/>}
        {tab==='comments'  && <CommentsTab item={item} onAdd={onAddComment} onRm={onRmComment}/>}
        {tab==='agent'     && (
          <div className="p-3 space-y-2">
            {agentOutcomes.map((o: any) => {
              const VSTATUS: Record<string,{label:string;color:string;bg:string;icon:string}> = {
                pending:       {label:'Pending',       color:'#64748b',bg:'#f1f5f9',icon:'⏳'},
                generated:     {label:'Generated',     color:'#7c3aed',bg:'#f5f3ff',icon:'🤖'},
                tests_passing: {label:'Tests Passing', color:'#0369a1',bg:'#e0f2fe',icon:'✅'},
                in_review:     {label:'In Review',     color:'#d97706',bg:'#fffbeb',icon:'👁️'},
                approved:      {label:'Approved',      color:'#15803d',bg:'#f0fdf4',icon:'✓'},
                shipped:       {label:'Shipped',       color:'#475569',bg:'#f8fafc',icon:'🚀'},
              };
              const vs = VSTATUS[o.review_status] ?? VSTATUS.pending;
              return (
                <div key={o.id} className="rounded-xl border p-3 bg-white">
                  <div className="font-semibold text-gray-800 mb-1.5 leading-snug" style={{fontSize:12}}>{o.title||'(Untitled)'}</div>
                  <div className="flex gap-1.5 flex-wrap mb-1.5">
                    <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:999,background:vs.bg,color:vs.color,border:`1px solid ${vs.color}30`}}>{vs.icon} {vs.label}</span>
                    {o.agent_confidence!=null&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:999,background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac'}}>{o.agent_confidence}% conf</span>}
                    {o.test_coverage!=null&&<span style={{fontSize:10,padding:'2px 7px',borderRadius:999,background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe'}}>{o.test_coverage}% cov</span>}
                  </div>
                  {o.outcome_description&&<p className="text-gray-500 leading-relaxed" style={{fontSize:11}}>{o.outcome_description.slice(0,120)}{o.outcome_description.length>120?'…':''}</p>}
                  {o.pr_url&&<a href={o.pr_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" style={{fontSize:10,display:'block',marginTop:4}}>🔀 {o.pr_url}</a>}
                  {o.human_reviewer&&<div className="text-gray-400 mt-1" style={{fontSize:10}}>👤 {o.human_reviewer}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
