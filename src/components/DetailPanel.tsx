import React, { useState, useRef, useMemo } from "react";
import { TC, SC, PC, HIC, RC, SPONSOR_TYPES, TL } from "../constants";
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
              <span className={`font-semibold border rounded-full px-1.5 py-0 shrink-0 ${c.bg} ${c.tc} ${c.b}`} style={{ fontSize:9 }}>{c.l}</span>
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
  const roots = useMemo(() =>
    allItems.filter(it => {
      const linked = it.links.map((id: string) => allItems.find((i: any) => i.id===id)).filter(Boolean);
      return !linked.some((li: any) => TL[li.type] < TL[it.type]);
    }), [allItems]);

  const ancestorIds = useMemo(() => {
    const set = new Set<string>();
    function mark(id: string, vis = new Set<string>()): boolean {
      if(vis.has(id)) return false;
      vis.add(id);
      const it = allItems.find((i: any) => i.id===id);
      if(!it) return false;
      if(it.id === item.id) return true;
      const kids = it.links.map((lid: string) => allItems.find((i: any) => i.id===lid)).filter(Boolean)
        .filter((c: any) => TL[c.type] > TL[it.type]);
      const found = kids.some((c: any) => mark(c.id, new Set(vis)));
      if(found) set.add(id);
      return found;
    }
    roots.forEach(r => mark(r.id));
    return set;
  }, [allItems, item.id, roots]);

  if(!roots.length) return (
    <div className="p-2 text-center text-gray-400 py-8" style={{ fontSize:12 }}>No items in hierarchy</div>
  );

  return (
    <div className="p-3">
      <div className="flex items-center gap-3 mb-3 px-1 py-1.5 bg-gray-50 rounded-lg border">
        <span className="text-gray-400" style={{ fontSize:10 }}>
          📍 <span className="text-blue-600 font-semibold">Blue = selected item</span>
          &nbsp;·&nbsp; ▶ expand &nbsp;·&nbsp; click title to navigate
        </span>
      </div>
      <div>
        {roots.map(r => (
          <HNode key={r.id} item={r} allItems={allItems}
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
  onAddLink: () => void;
  onAddDep: () => void;
  onRmLink: (id: string) => void;
  onRmDep: (id: string) => void;
  onAddFile: () => void;
  onRmFile: (idx: number) => void;
  onAddComment: (text: string) => void;
  onRmComment: (id: string) => void;
  onNav: (id: string) => void;
}

export default function DetailPanel({ item, allItems, tab, onTab, onEdit, onDelete, onClose, onAddLink, onAddDep, onRmLink, onRmDep, onAddFile, onRmFile, onAddComment, onRmComment, onNav }: DetailPanelProps) {
  const c = TC[item.type];
  const TABS = [
    ['overview','📋','Info'],
    ['hierarchy','🌳','Tree'],
    ['links','🔗',`Links(${item.links.length})`],
    ['deps','⛓️',`Deps(${item.dependencies?.length||0})`],
    ['files','📎',`Files(${item.attachments.length})`],
    ['comments','💬',`Chat(${item.comments?.length||0})`],
  ];

  return (
    <aside className="flex flex-col bg-white border-l shadow-xl overflow-hidden" style={{ width:'100%', height:'100%' }}>
      <div className={`p-4 border-b ${c.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`rounded-full border px-2 py-0.5 font-bold ${c.bg} ${c.tc} ${c.b}`} style={{ fontSize:11 }}>{c.i} {c.l}</span>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-1 rounded hover:bg-white text-gray-400 hover:text-blue-600" style={{ fontSize:13 }}>✏️</button>
            <button onClick={onDelete} className="p-1 rounded hover:bg-white text-gray-400 hover:text-red-500" style={{ fontSize:13 }}>🗑️</button>
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

      <div className="flex border-b bg-gray-50 shrink-0 overflow-x-auto">
        {TABS.map(([t,ic,lb]) => (
          <button key={t} onClick={() => onTab(t)} className={`shrink-0 py-2 px-2 font-medium flex items-center gap-0.5 transition-colors ${tab===t?'border-b-2 border-blue-500 text-blue-600 bg-white':'text-gray-500 hover:bg-gray-100'}`} style={{ fontSize:10 }}>{ic} {lb}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab==='overview'  && <OverviewTab item={item}/>}
        {tab==='hierarchy' && <HierarchyTab item={item} allItems={allItems} onNav={onNav}/>}
        {tab==='links'     && <LinksTab ids={item.links} allItems={allItems} onAdd={onAddLink} onRm={onRmLink} onNav={onNav} label="Links"/>}
        {tab==='deps'      && <LinksTab ids={item.dependencies||[]} allItems={allItems} onAdd={onAddDep} onRm={onRmDep} onNav={onNav} label="Dependencies"/>}
        {tab==='files'     && <FilesTab item={item} onAdd={onAddFile} onRm={onRmFile}/>}
        {tab==='comments'  && <CommentsTab item={item} onAdd={onAddComment} onRm={onRmComment}/>}
      </div>
    </aside>
  );
}
