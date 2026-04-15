import React, { useState, useRef } from "react";
import { useResponsive } from "../../hooks/useResponsive";
import { TC, SC, PC, HIC, RC, TYPES, STATS, PRIS, HLTHS, RSKS, IMPACT_TYPES } from "../../constants";
import { gId } from "../../utils";

// ─── KANBAN CONSTANTS ─────────────────────────────────────────────────────────
export const FIELD_DEFS = [
  {k:'badge',l:'Type Badge'},{k:'key',l:'Item Key'},{k:'status',l:'Status'},
  {k:'currentStatus',l:'Current Status'},
  {k:'description',l:'Description'},
  {k:'health',l:'Health'},{k:'priority',l:'Priority'},{k:'risk',l:'Risk'},
  {k:'riskStatement',l:'Risk Statement'},
  {k:'keyResult',l:'Key Results'},
  {k:'impact',l:'Impact'},
  {k:'impactType',l:'Impact Type'},
  {k:'owner',l:'Owner'},{k:'assigned',l:'Assigned'},
  {k:'sponsor',l:'Sponsor'},{k:'businessUnit',l:'Business Unit'},
  {k:'approvedBudget',l:'Budget (£)'},{k:'actualCost',l:'Actual Cost (£)'},
  {k:'startDate',l:'Start Date'},{k:'endDate',l:'Due Date'},
  {k:'progress',l:'Progress'},{k:'tags',l:'Tags'},
];

export const ALL_VIS_FIELDS = new Set(FIELD_DEFS.map(f => f.k));
export const DEFAULT_VIS_FIELDS = new Set([
  'badge','key','status','currentStatus','health','priority','risk','endDate','owner','tags'
]);

// ─── FCHIP ────────────────────────────────────────────────────────────────────
interface FChipProps {
  label: string;
  icon?: string;
  active: boolean;
  cnt: number;
  onClick: () => void;
}

export function FChip({ label, icon, active, cnt, onClick }: FChipProps) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 px-3 py-1 rounded-full border transition-all ${active?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`} style={{ fontSize:11, fontWeight:active?600:400 }}>
      {icon && <span>{icon}</span>}{label}
      <span className={`ml-1 rounded-full px-1.5 ${active?'bg-blue-500 text-white':'bg-gray-100 text-gray-500'}`} style={{ fontSize:10 }}>{cnt}</span>
    </button>
  );
}

// ─── KCARD ────────────────────────────────────────────────────────────────────
interface KCardProps {
  item: any;
  selected: boolean;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  visFields: Set<string>;
}

export function KCard({ item, selected, isDragging, onClick, onDragStart, onDragEnd, visFields }: KCardProps) {
  const c = TC[item.type];
  const vf = visFields || ALL_VIS_FIELDS;
  const showMeta = vf.has('health')||vf.has('priority')||vf.has('risk')||vf.has('endDate');
  const fmt = (v: any) => v ? `£${Number(v).toLocaleString()}` : '—';
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick}
      className={`rounded-xl border p-3 transition-all shadow-sm select-none ${isDragging?'opacity-40 scale-95 rotate-1':''}${selected?'border-blue-400 bg-blue-50 shadow-md':'bg-white hover:shadow-md border-gray-200 hover:border-blue-200'}`}
      style={{ cursor:isDragging?'grabbing':'grab', touchAction:'none' }}>
      {(vf.has('badge')||vf.has('key')) && (
        <div className="flex items-center justify-between mb-1.5">
          {vf.has('badge') && <span className={c.tc} style={{ fontSize:10, fontWeight:600 }}>{c.i} {c.l}</span>}
          {vf.has('key') && <span className="text-gray-400 font-mono ml-auto" style={{ fontSize:10 }}>{item.key}</span>}
        </div>
      )}
      <div className="font-semibold text-gray-800 mb-1.5 leading-snug" style={{ fontSize:12 }}>{item.title||'(Untitled)'}</div>
      {vf.has('status') && (
        <div className="mb-1.5">
          <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${SC[item.status]||'bg-gray-100 text-gray-500'}`} style={{ fontSize:10 }}>{item.status}</span>
        </div>
      )}
      {vf.has('description') && item.description && <div className="text-gray-500 mb-1.5 leading-snug" style={{ fontSize:11 }}>{item.description.slice(0,80)}{item.description.length>80?'…':''}</div>}
      {vf.has('currentStatus') && item.currentStatus && <div className="text-gray-500 mb-1.5 leading-snug" style={{ fontSize:11, borderLeft:'2px solid #d1d5db', paddingLeft:6 }}>{item.currentStatus.slice(0,80)}{item.currentStatus.length>80?'…':''}</div>}
      {showMeta && (
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {vf.has('health') && <span style={{ fontSize:13 }}>{HIC[item.health]||'⚪'}</span>}
          {vf.has('priority') && <span className={`font-semibold ${PC[item.priority]||''}`} style={{ fontSize:11 }}>{item.priority}</span>}
          {vf.has('risk') && <span className={`font-medium ${RC[item.risk]||''}`} style={{ fontSize:10 }}>⚠ {item.risk}</span>}
          {vf.has('endDate') && item.endDate && <span className="text-gray-400 ml-auto" style={{ fontSize:10 }}>📅 {item.endDate}</span>}
        </div>
      )}
      {vf.has('riskStatement') && item.riskStatement && <div className="text-red-400 mb-1.5 leading-snug" style={{ fontSize:11, borderLeft:'2px solid #fca5a5', paddingLeft:6 }}>⚠️ {item.riskStatement.slice(0,80)}{item.riskStatement.length>80?'…':''}</div>}
      {vf.has('keyResult') && item.keyResult && <div className="text-sky-600 mb-1.5 leading-snug" style={{ fontSize:11, borderLeft:'2px solid #7dd3fc', paddingLeft:6 }}>🔑 {item.keyResult.slice(0,80)}{item.keyResult.length>80?'…':''}</div>}
      {vf.has('impact') && item.impact && <div className="text-green-600 mb-1.5" style={{ fontSize:11 }}>🎯 {item.impact.slice(0,60)}{item.impact.length>60?'…':''}</div>}
      {vf.has('impactType') && item.impactType && <div className="mb-1.5">
        <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:999,
          background:item.impactType==='Revenue'?'#dcfce7':item.impactType==='Cost'?'#fee2e2':'#dbeafe',
          color:item.impactType==='Revenue'?'#15803d':item.impactType==='Cost'?'#dc2626':'#1d4ed8'
        }}>{item.impactType}</span>
      </div>}
      {vf.has('owner') && item.owner && <div className="text-gray-500 mb-1" style={{ fontSize:11 }}>👤 {item.owner}</div>}
      {vf.has('assigned') && item.assigned && <div className="text-gray-500 mb-1" style={{ fontSize:11 }}>🙋 {item.assigned}</div>}
      {vf.has('sponsor') && item.sponsor && <div className="text-gray-500 mb-1" style={{ fontSize:11 }}>🏅 {item.sponsor}</div>}
      {vf.has('businessUnit') && item.businessUnit && <div className="text-gray-500 mb-1" style={{ fontSize:11 }}>🏢 {item.businessUnit}</div>}
      {(vf.has('approvedBudget')||vf.has('actualCost')) && (item.approvedBudget||item.actualCost) && (
        <div className="flex gap-3 mb-1.5 flex-wrap">
          {vf.has('approvedBudget') && item.approvedBudget && <span className="text-gray-500" style={{ fontSize:10 }}>💰 {fmt(item.approvedBudget)}</span>}
          {vf.has('actualCost') && item.actualCost && <span className="text-gray-500" style={{ fontSize:10 }}>🧾 {fmt(item.actualCost)}</span>}
        </div>
      )}
      {vf.has('startDate') && item.startDate && <div className="text-gray-400 mb-1" style={{ fontSize:10 }}>🚀 {item.startDate}</div>}
      {vf.has('progress') && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="flex-1 bg-gray-200 rounded-full" style={{ height:4 }}>
            <div className="bg-blue-500 rounded-full h-full" style={{ width:`${item.progress}%` }}/>
          </div>
          <span className="text-gray-500" style={{ fontSize:10, width:28 }}>{item.progress}%</span>
        </div>
      )}
      {vf.has('tags') && item.tags?.length>0 && <div className="flex gap-1 mt-1 flex-wrap">{item.tags.slice(0,3).map((t: string) => <span key={t} className="bg-gray-100 text-gray-500 rounded px-1.5 py-0.5" style={{ fontSize:10 }}>{t}</span>)}{item.tags.length>3 && <span className="text-gray-400" style={{ fontSize:10 }}>+{item.tags.length-3}</span>}</div>}
    </div>
  );
}

// ─── KANBAN BOARD ─────────────────────────────────────────────────────────────
interface KanbanBoardProps {
  items: any[];
  sel: string | null;
  onSel: (id: string) => void;
  onNew: (type: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onFieldChange: (id: string, field: string, value: string) => void;
  enabledTypes?: string[];
}

export default function KanbanBoard({ items, sel, onSel, onNew, onStatusChange, onFieldChange, enabledTypes }: KanbanBoardProps) {
  const ALL_ITEM_TYPES = ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask'];
  const activeTypes = (enabledTypes && enabledTypes.length > 0) ? enabledTypes : ALL_ITEM_TYPES;
  const [tf, setTf] = useState('all');
  const [dragId, setDragId] = useState<string|null>(null);
  const [dragOver, setDragOver] = useState<string|null>(null);
  const [boards, setBoards] = useState([{id:'b1', name:'Main Board', swimlane:'status'}]);
  const [activeBoardId, setActiveBoardId] = useState('b1');
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardSwim, setNewBoardSwim] = useState('status');
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [visFields, setVisFields] = useState(DEFAULT_VIS_FIELDS);
  const fieldBtnRef = useRef<HTMLButtonElement>(null);

  const activeBoard = boards.find(b => b.id===activeBoardId) || boards[0];
  const swimlane = activeBoard?.swimlane || 'status';

  const SWIM_COLS: Record<string, string[]> = {
    status:     STATS,
    component:  TYPES.filter(t => t!=='kr' && activeTypes.includes(t)),
    priority:   PRIS,
    risk:       RSKS,
    health:     HLTHS,
    impactType: IMPACT_TYPES.filter(Boolean),
  };
  const cols = SWIM_COLS[swimlane] || STATS;

  const applyFilters = (base: any[]) => tf==='all' ? base : base.filter(i => i.type===tf);

  const getColItems = (col: string) => {
    const base = applyFilters(items);
    if(swimlane==='status')     return base.filter(i => i.status===col);
    if(swimlane==='component')  return base.filter(i => i.type===col);
    if(swimlane==='priority')   return base.filter(i => i.priority===col);
    if(swimlane==='risk')       return base.filter(i => i.risk===col);
    if(swimlane==='health')     return base.filter(i => i.health===col);
    if(swimlane==='impactType') return base.filter(i => (i.impactType||'')=== col);
    return [];
  };

  const handleDrop = (col: string) => {
    if(!dragId) return;
    if(swimlane==='status')      onStatusChange(dragId, col);
    else if(swimlane==='priority')   onFieldChange(dragId, 'priority', col);
    else if(swimlane==='risk')       onFieldChange(dragId, 'risk', col);
    else if(swimlane==='health')     onFieldChange(dragId, 'health', col);
    else if(swimlane==='impactType') onFieldChange(dragId, 'impactType', col);
    setDragId(null); setDragOver(null);
  };

  const createBoard = () => {
    if(!newBoardName.trim()) return;
    const nb = {id:gId(), name:newBoardName.trim(), swimlane:newBoardSwim};
    setBoards(p => [...p, nb]); setActiveBoardId(nb.id); setNewBoardName(''); setShowNewBoard(false);
  };

  const toggleField = (k: string) => setVisFields(s => { const n=new Set(s); n.has(k)?n.delete(k):n.add(k); return n; });

  const colDot: Record<string, string> = {
    Draft:'bg-gray-400','In Progress':'bg-yellow-400','On Hold':'bg-orange-400',
    Completed:'bg-green-500',Cancelled:'bg-red-400',
    Critical:'bg-red-500',High:'bg-orange-400',Medium:'bg-yellow-400',Low:'bg-green-400',
    Green:'bg-green-500',Amber:'bg-amber-400',Red:'bg-red-500',
    Revenue:'bg-emerald-500',Cost:'bg-rose-500','Risk Mitigation':'bg-blue-500',
  };

  const getColLabel = (col: string) => {
    if(swimlane==='component')  return TC[col] ? `${TC[col].i} ${TC[col].l}` : col;
    if(swimlane==='health')     return col==='Green'?'🟢 Green':col==='Amber'?'🟡 Amber':'🔴 Red';
    if(swimlane==='impactType') return col==='Revenue'?'💹 Revenue':col==='Cost'?'💰 Cost':'🛡️ Risk Mitigation';
    return col;
  };

  const getSwimDragLabel = () => {
    if(swimlane==='status')     return 'status';
    if(swimlane==='priority')   return 'priority';
    if(swimlane==='risk')       return 'risk level';
    if(swimlane==='health')     return 'health';
    if(swimlane==='impactType') return 'impact type';
    return 'column';
  };

  const SWIM_DEFS: [string, string][] = [
    ['status','📊 Status'],
    ['component','🧩 Work Item'],
    ['priority','🎯 Priority'],
    ['risk','⚠️ Risk'],
    ['health','🏥 Health'],
    ['impactType','💹 Impact'],
  ];

  const WORK_ITEM_TYPES_KANBAN = ['vision','mission','goal','okr','initiative','program','project','task','subtask'].filter(t => activeTypes.includes(t));

  const { isMobile } = useResponsive();
  if (isMobile) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', height:'100%', gap:12, padding:24, textAlign:'center' }}>
        <div style={{ fontSize:36 }}>🗂️</div>
        <div style={{ fontSize:14, fontWeight:700, color:'#374151' }}>Kanban Board</div>
        <div style={{ fontSize:12, color:'#64748b', maxWidth:280, lineHeight:1.7 }}>
          The Kanban board is optimised for desktop use. Switch to
          <strong> Work Items</strong> view for a mobile-friendly list.
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 flex flex-col h-full overflow-hidden">
      {/* Board tabs + controls row */}
      <div className="flex items-center gap-2 mb-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto" style={{ flexShrink:0 }}>
          {boards.map(b => (
            <button key={b.id} onClick={() => setActiveBoardId(b.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${activeBoardId===b.id?'bg-blue-600 text-white':'bg-white border text-gray-600 hover:border-blue-300'}`}
              style={{ fontSize:12 }}>
              {b.name}
              {activeBoardId===b.id && <span className="ml-1.5 opacity-60" style={{ fontSize:10 }}>·{SWIM_DEFS.find(([s]) => s===b.swimlane)?.[1]?.replace(/[^\w ]/g,'').trim()||b.swimlane}</span>}
            </button>
          ))}
          <button onClick={() => setShowNewBoard(true)}
            className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-200 text-gray-500 border font-semibold" style={{ fontSize:12 }} title="Create new board">＋</button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200 flex-wrap gap-0.5">
            {SWIM_DEFS.map(([s,l]) => (
              <button key={s}
                onClick={() => setBoards(bs => bs.map(b => b.id===activeBoardId ? {...b, swimlane:s} : b))}
                className={`px-2.5 py-1 rounded-md transition-all ${swimlane===s?'bg-white shadow text-blue-600 font-semibold':'text-gray-500 hover:text-gray-700'}`}
                style={{ fontSize:11 }}>
                {l}
              </button>
            ))}
          </div>

          <div className="relative">
            <button ref={fieldBtnRef} onClick={() => setShowFieldConfig((o: boolean) => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${showFieldConfig?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
              style={{ fontSize:12 }}>
              ⚙️ Fields <span className={`text-xs rounded-full px-1 ${showFieldConfig?'bg-blue-500':'bg-gray-100 text-gray-500'}`}>{visFields.size}/{FIELD_DEFS.length}</span>
            </button>
            {showFieldConfig && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl border shadow-xl p-3" style={{ width:210 }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-700" style={{ fontSize:11 }}>Card Fields</div>
                  <div className="flex gap-2">
                    <button onClick={() => setVisFields(ALL_VIS_FIELDS)} className="text-blue-600 hover:underline" style={{ fontSize:10 }}>All</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => setVisFields(new Set())} className="text-blue-600 hover:underline" style={{ fontSize:10 }}>None</button>
                  </div>
                </div>
                {FIELD_DEFS.map(fd => (
                  <label key={fd.k} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1">
                    <input type="checkbox" checked={visFields.has(fd.k)} onChange={() => toggleField(fd.k)} className="accent-blue-600"/>
                    <span style={{ fontSize:12 }}>{fd.l}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cross-filter chips */}
      <div className="flex items-center gap-2 mb-3 flex-wrap shrink-0">
        <span className="text-gray-400 font-semibold shrink-0" style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>Work Item:</span>
        <FChip label="All" active={tf==='all'} cnt={applyFilters(items).length} onClick={() => setTf('all')}/>
        {WORK_ITEM_TYPES_KANBAN.filter(t => t!=='kr').map(t => <FChip key={t} label={TC[t].l} icon={TC[t].i} active={tf===t} cnt={applyFilters(items).filter(i => i.type===t).length} onClick={() => setTf(t)}/>)}
        {tf!=='all' && <button onClick={() => onNew(tf)} className="ml-auto bg-blue-600 text-white rounded-lg px-3 py-1 font-semibold shrink-0" style={{ fontSize:12 }}>+ New {TC[tf]?.l}</button>}
      </div>

      {dragId && swimlane!=='component' && <div className="mb-2 flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg shrink-0" style={{ fontSize:12 }}>
        <span>↔️</span><span className="text-blue-700 font-medium">Drag to a column to change {getSwimDragLabel()}</span>
        <button onClick={() => {setDragId(null);setDragOver(null);}} className="ml-auto text-blue-400 hover:text-blue-600 font-bold" style={{ fontSize:14 }}>×</button>
      </div>}

      {/* Kanban columns */}
      <div className="flex gap-3 flex-1 overflow-x-auto pb-2">
        {cols.map(col => {
          const colItems = getColItems(col);
          const isOver = dragOver===col;
          const disableDrop = swimlane==='component';
          return (
            <div key={col}
              onDragOver={e => {if(!disableDrop){e.preventDefault();setDragOver(col);}}}
              onDragLeave={e => {if(!e.currentTarget.contains(e.relatedTarget as Node))setDragOver(null);}}
              onDrop={() => !disableDrop && handleDrop(col)}
              className={`flex flex-col shrink-0 rounded-xl p-2 transition-all ${isOver?'bg-blue-100 ring-2 ring-blue-400 ring-offset-1':'bg-gray-100'}`}
              style={{ width:'clamp(180px, 45vw, 228px)', minHeight:200 }}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`w-2 h-2 rounded-full ${colDot[col]||'bg-gray-400'}`}/>
                <span className="font-semibold text-gray-700 truncate flex-1" style={{ fontSize:12 }}>{getColLabel(col)}</span>
                <span className="bg-white text-gray-500 rounded-full px-2 py-0.5 border shrink-0" style={{ fontSize:10 }}>{colItems.length}</span>
              </div>
              {isOver && <div className="border-2 border-dashed border-blue-400 rounded-xl py-2 text-center text-blue-400 font-medium mb-2" style={{ fontSize:11 }}>Drop here</div>}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {colItems.map(it => <KCard key={it.id} item={it} selected={sel===it.id} isDragging={dragId===it.id}
                  onClick={() => onSel(it.id)} onDragStart={() => setDragId(it.id)} onDragEnd={() => {setDragId(null);setDragOver(null);}}
                  visFields={visFields}/>)}
                {!colItems.length && !isOver && <div className="rounded-xl border-2 border-dashed border-gray-200 text-gray-300 text-center py-8" style={{ fontSize:11 }}>Empty</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Board Modal */}
      {showNewBoard && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background:'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6" style={{ width:380 }}>
            <div className="font-bold text-gray-800 mb-2" style={{ fontSize:14 }}>🗂️ Create New Board</div>
            <div className="mb-3">
              <label className="block text-gray-500 font-semibold mb-1" style={{ fontSize:11 }}>Board Name</label>
              <input value={newBoardName} onChange={e => setNewBoardName(e.target.value)} autoFocus
                onKeyDown={e => e.key==='Enter' && createBoard()}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                style={{ fontSize:13 }} placeholder="e.g. Sprint Board, Risk View…"/>
            </div>
            <div className="mb-3">
              <label className="block text-gray-500 font-semibold mb-2" style={{ fontSize:11 }}>Swim Lanes By</label>
              <div className="grid grid-cols-2 gap-2">
                {[['status','📊 Status','By workflow status'],['component','🧩 Work Item','By item type'],['priority','🎯 Priority','By priority level'],['risk','⚠️ Risk','By risk level'],['health','🏥 Health','By RAG health'],['impactType','💹 Impact','By impact type']].map(([v,l,d]) => (
                  <button key={v} onClick={() => setNewBoardSwim(v)}
                    className={`p-3 rounded-xl border text-left transition-all ${newBoardSwim===v?'bg-blue-50 border-blue-400 text-blue-700':'border-gray-200 text-gray-600 hover:border-blue-200'}`}
                    style={{ fontSize:12 }}>
                    <div className="font-semibold">{l}</div>
                    <div className="text-gray-400 mt-0.5" style={{ fontSize:10 }}>{d}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewBoard(false)} className="px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" style={{ fontSize:12 }}>Cancel</button>
              <button onClick={createBoard} disabled={!newBoardName.trim()} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-semibold" style={{ fontSize:12 }}>Create Board</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
