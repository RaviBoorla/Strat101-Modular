import React, { useState } from "react";
import { TC, SC, PC, HIC, RC, TYPES } from "../../constants";
import { sortItems } from "../../utils";

// ─── SORT HELPERS ─────────────────────────────────────────────────────────────
interface SortThProps {
  label: string;
  col: string;
  sortCol: string;
  sortDir: string;
  onSort: (col: string) => void;
  style?: React.CSSProperties;
}

export function SortTh({ label, col, sortCol, sortDir, onSort, style={} }: SortThProps) {
  const active = sortCol === col;
  return (
    <th onClick={() => onSort(col)}
      className="text-left px-2 py-1.5 text-gray-500 font-semibold uppercase whitespace-nowrap select-none"
      style={{ fontSize:10, cursor:'pointer', ...style }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
        {label}
        <span style={{ display:'inline-flex', flexDirection:'column', lineHeight:1, marginLeft:2 }}>
          <span style={{ fontSize:7, lineHeight:1, color:active&&sortDir==='asc'?'#2563eb':'#cbd5e1' }}>▲</span>
          <span style={{ fontSize:7, lineHeight:1, color:active&&sortDir==='desc'?'#2563eb':'#cbd5e1' }}>▼</span>
        </span>
      </span>
    </th>
  );
}

// ─── WORK ITEMS VIEW ──────────────────────────────────────────────────────────
interface WorkItemsViewProps {
  items: any[];
  sel: string | null;
  onSel: (id: string) => void;
  filter: string;
  enabledTypes?: string[];
}

export default function WorkItemsView({ items, sel, onSel, filter, enabledTypes }: WorkItemsViewProps) {
  const ALL_ITEM_TYPES = ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask'];
  const activeTypes = (enabledTypes && enabledTypes.length > 0) ? enabledTypes : ALL_ITEM_TYPES;
  const [sortCol, setSortCol] = useState('type');
  const [sortDir, setSortDir] = useState('asc');
  const onSort = (col: string) => { setSortDir(d => sortCol===col?(d==='asc'?'desc':'asc'):'asc'); setSortCol(col); };
  const base = filter==='all' ? items : items.filter(i => i.type===filter);
  const sorted = sortItems(base, sortCol, sortDir);
  const fmt = (v: any) => v ? `£${Number(v).toLocaleString()}` : '—';

  if (!sorted.length) return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <div style={{ fontSize:48 }}>{filter!=='all' ? TC[filter]?.i : '📦'}</div>
      <div className="font-medium text-gray-500 mt-2" style={{ fontSize:14 }}>No {filter!=='all' ? TC[filter]?.l+'s' : 'Work Items'} yet</div>
    </div>
  );

  return (
    <div className="p-2 h-full overflow-auto">
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ minWidth:'max-content' }}>
        <table className="w-full" style={{ fontSize:12 }}>
          <thead><tr className="bg-gray-50 border-b">
            <SortTh label="Work Item"      col="type"         sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Key"            col="key"          sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Title"          col="title"        sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <th className="text-left px-2 py-1.5 text-gray-500 font-semibold uppercase whitespace-nowrap" style={{ fontSize:10 }}>Current Status</th>
            <SortTh label="Status"         col="status"       sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Priority"       col="priority"     sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Health"         col="health"       sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Risk"           col="risk"         sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Impact Type"    col="impactType"   sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Owner"          col="owner"        sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Assigned"       col="assigned"     sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Sponsor"        col="sponsor"      sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Business Unit"  col="businessUnit" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Progress"       col="progress"     sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Start Date"     col="startDate"    sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Due Date"       col="endDate"      sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <th className="text-left px-2 py-1.5 text-gray-500 font-semibold uppercase whitespace-nowrap" style={{ fontSize:10 }}>Budget</th>
            <th className="text-left px-2 py-1.5 text-gray-500 font-semibold uppercase whitespace-nowrap" style={{ fontSize:10 }}>Actual Cost</th>
            <SortTh label="Updated"        col="updatedAt"    sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <th className="text-left px-2 py-1.5 text-gray-500 font-semibold uppercase whitespace-nowrap" style={{ fontSize:10 }}>Updated By</th>
          </tr></thead>
          <tbody>{sorted.map((it, idx) => {
            const c = TC[it.type];
            return (
              <tr key={it.id} onClick={() => onSel(it.id)} className={`border-b last:border-0 cursor-pointer ${sel===it.id?'bg-blue-50':idx%2===0?'hover:bg-gray-50':'bg-gray-50 hover:bg-gray-100'}`}>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <span className={c.tc} style={{ fontSize:10, fontWeight:600 }}>{c.i} {c.l}</span>
                </td>
                <td className="px-2 py-1.5 font-mono text-blue-600 whitespace-nowrap" style={{ fontSize:11 }}>{it.key}</td>
                <td className="px-2 py-1.5 font-medium text-gray-800" style={{ maxWidth:180 }}>
                  <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.title||'(Untitled)'}</div>
                  {it.tags?.length>0 && <div className="flex gap-1 mt-0.5">{it.tags.slice(0,2).map((t: string) => <span key={t} className="bg-gray-100 text-gray-500 rounded px-1" style={{ fontSize:10 }}>{t}</span>)}</div>}
                </td>
                <td className="px-2 py-1.5 text-gray-500" style={{ maxWidth:160 }}>
                  {it.currentStatus ? <div><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:150, fontSize:11 }}>{it.currentStatus}</div>{it.currentStatusAt && <div className="text-gray-400" style={{ fontSize:10 }}>🕐 {it.currentStatusAt}</div>}</div> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full font-medium ${SC[it.status]||''}`} style={{ fontSize:11 }}>{it.status}</span></td>
                <td className={`px-2 py-1.5 font-medium whitespace-nowrap ${PC[it.priority]||''}`}>{it.priority}</td>
                <td className="px-2 py-1.5"><span style={{ fontSize:14 }}>{HIC[it.health]||'⚪'}</span></td>
                <td className={`px-2 py-1.5 font-medium whitespace-nowrap ${RC[it.risk]||''}`}>{it.risk}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {it.impactType ? <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:999,
                    background:it.impactType==='Revenue'?'#dcfce7':it.impactType==='Cost'?'#fee2e2':'#dbeafe',
                    color:it.impactType==='Revenue'?'#15803d':it.impactType==='Cost'?'#dc2626':'#1d4ed8'
                  }}>{it.impactType}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap" style={{ maxWidth:100, overflow:'hidden', textOverflow:'ellipsis' }}>{it.owner||'—'}</td>
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap" style={{ maxWidth:100, overflow:'hidden', textOverflow:'ellipsis' }}>{it.assigned||'—'}</td>
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap" style={{ maxWidth:100, overflow:'hidden', textOverflow:'ellipsis' }}>{it.sponsor||'—'}</td>
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap" style={{ maxWidth:100, overflow:'hidden', textOverflow:'ellipsis' }}>{it.businessUnit||'—'}</td>
                <td className="px-2 py-1.5" style={{ minWidth:80 }}>
                  <div className="flex items-center gap-1.5"><div className="flex-1 bg-gray-200 rounded-full" style={{ height:4 }}><div className="bg-blue-500 rounded-full h-full" style={{ width:`${it.progress}%` }}/></div><span className="text-gray-500" style={{ fontSize:11, width:28 }}>{it.progress}%</span></div>
                </td>
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{it.startDate||'—'}</td>
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{it.endDate||'—'}</td>
                <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap font-mono" style={{ fontSize:11 }}>{it.approvedBudget ? fmt(it.approvedBudget) : '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap font-mono" style={{ fontSize:11,
                  color:it.approvedBudget&&it.actualCost&&Number(it.actualCost)>Number(it.approvedBudget)?'#dc2626':'#374151'
                }}>{it.actualCost ? fmt(it.actualCost) : '—'}</td>
                <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap" style={{ fontSize:10, fontFamily:'monospace' }}>{it.updatedAt||'—'}</td>
                <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap" style={{ fontSize:11 }}>{it.updatedBy||'—'}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── LIST VIEW ────────────────────────────────────────────────────────────────
interface ListViewProps {
  type: string;
  items: any[];
  sel: string | null;
  onSel: (id: string) => void;
}

export function ListView({ type, items, sel, onSel }: ListViewProps) {
  const [sortCol, setSortCol] = useState('key');
  const [sortDir, setSortDir] = useState('asc');
  const onSort = (col: string) => { setSortDir(d => sortCol===col?(d==='asc'?'desc':'asc'):'asc'); setSortCol(col); };
  const rows = sortItems(items, sortCol, sortDir);

  if (!rows.length) return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <div style={{ fontSize:48 }}>{TC[type]?.i}</div>
      <div className="font-medium text-gray-500 mt-2" style={{ fontSize:14 }}>No {TC[type]?.l}s yet</div>
    </div>
  );

  return (
    <div className="p-2 h-full overflow-auto">
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ minWidth:'max-content' }}>
        <table className="w-full" style={{ fontSize:12 }}>
          <thead><tr className="bg-gray-50 border-b">
            <SortTh label="Key"         col="key"        sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Title"       col="title"      sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <th className="text-left px-2 py-1.5 text-gray-500 font-semibold uppercase whitespace-nowrap" style={{ fontSize:10 }}>Current Status</th>
            <SortTh label="Status"      col="status"     sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Priority"    col="priority"   sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Health"      col="health"     sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Risk"        col="risk"       sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Impact Type" col="impactType" sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Owner"       col="owner"      sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Assigned"    col="assigned"   sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Progress"    col="progress"   sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Start Date"  col="startDate"  sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
            <SortTh label="Due Date"    col="endDate"    sortCol={sortCol} sortDir={sortDir} onSort={onSort}/>
          </tr></thead>
          <tbody>{rows.map((it, idx) => (
            <tr key={it.id} onClick={() => onSel(it.id)} className={`border-b last:border-0 cursor-pointer ${sel===it.id?'bg-blue-50':idx%2===0?'hover:bg-gray-50':'bg-gray-50 hover:bg-gray-100'}`}>
              <td className="px-2 py-1.5 font-mono text-blue-600 whitespace-nowrap" style={{ fontSize:11 }}>{it.key}</td>
              <td className="px-2 py-1.5 font-medium text-gray-800" style={{ maxWidth:180 }}>
                <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.title||'(Untitled)'}</div>
                {it.tags?.length>0 && <div className="flex gap-1 mt-0.5">{it.tags.slice(0,2).map((t: string) => <span key={t} className="bg-gray-100 text-gray-500 rounded px-1" style={{ fontSize:10 }}>{t}</span>)}</div>}
              </td>
              <td className="px-2 py-1.5 text-gray-500" style={{ maxWidth:160 }}>
                {it.currentStatus ? <div><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:150, fontSize:11 }}>{it.currentStatus}</div>{it.currentStatusAt && <div className="text-gray-400" style={{ fontSize:10 }}>🕐 {it.currentStatusAt}</div>}</div> : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full font-medium ${SC[it.status]||''}`} style={{ fontSize:11 }}>{it.status}</span></td>
              <td className={`px-2 py-1.5 font-medium whitespace-nowrap ${PC[it.priority]||''}`}>{it.priority}</td>
              <td className="px-2 py-1.5"><span style={{ fontSize:14 }}>{HIC[it.health]||'⚪'}</span></td>
              <td className={`px-2 py-1.5 font-medium whitespace-nowrap ${RC[it.risk]||''}`}>{it.risk}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                {it.impactType ? <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:999,
                  background:it.impactType==='Revenue'?'#dcfce7':it.impactType==='Cost'?'#fee2e2':'#dbeafe',
                  color:it.impactType==='Revenue'?'#15803d':it.impactType==='Cost'?'#dc2626':'#1d4ed8'
                }}>{it.impactType}</span> : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap" style={{ maxWidth:90, overflow:'hidden', textOverflow:'ellipsis' }}>{it.owner||'—'}</td>
              <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap" style={{ maxWidth:90, overflow:'hidden', textOverflow:'ellipsis' }}>{it.assigned||'—'}</td>
              <td className="px-2 py-1.5" style={{ minWidth:80 }}>
                <div className="flex items-center gap-1.5"><div className="flex-1 bg-gray-200 rounded-full" style={{ height:4 }}><div className="bg-blue-500 rounded-full h-full" style={{ width:`${it.progress}%` }}/></div><span className="text-gray-500" style={{ fontSize:11, width:28 }}>{it.progress}%</span></div>
              </td>
              <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{it.startDate||'—'}</td>
              <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{it.endDate||'—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
