import React, { useState, useRef } from "react";
import { TC, SC, PC, HIC, RC, TYPES } from "../../constants";
import { sortItems, gId } from "../../utils";

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

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const results: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (line.trim() === '') continue;
    const row: string[] = [];
    let inQuotes = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(cur); cur = ''; }
        else { cur += ch; }
      }
    }
    row.push(cur);
    results.push(row);
  }
  return results;
}

// ─── IMPORT MODAL ─────────────────────────────────────────────────────────────
const VALID_TYPES = ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask'];
const VALID_STATUSES = ['Draft','In Progress','On Hold','Completed','Cancelled'];
const VALID_PRIORITIES = ['Critical','High','Medium','Low'];
const VALID_HEALTHS = ['Green','Amber','Red'];
const VALID_RISKS = ['High','Medium','Low'];

interface ImportModalProps {
  items: any[];
  loggedUser?: string;
  onImport: (items: any[]) => Promise<void>;
  onClose: () => void;
}

function ImportModal({ items, loggedUser, onImport, onClose }: ImportModalProps) {
  const [step, setStep] = useState<'upload'|'preview'|'done'>('upload');
  const [dragging, setDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<{ row: number; data: Record<string,string>; errors: string[] }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csv = [
      'type,title,description,status,priority,health,risk,impact_type,owner,assigned,sponsor,business_unit,progress,start_date,end_date,approved_budget,actual_cost',
      'project,Example Project,This is a sample,In Progress,High,Green,Low,Revenue,John Smith,Jane Doe,,Technology,25,2025-01-01,2025-12-31,100000,25000'
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'work-items-template.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) return;
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows.slice(1);
      const parsed = dataRows.map((row, idx) => {
        const data: Record<string,string> = {};
        headers.forEach((h, i) => { data[h] = (row[i] ?? '').trim(); });
        const errors: string[] = [];
        if (!data['type'] || !VALID_TYPES.includes(data['type'].toLowerCase())) {
          errors.push(`Type "${data['type']}" not recognised`);
        }
        if (!data['title'] || data['title'].trim() === '') {
          errors.push('Title is required');
        }
        return { row: idx + 2, data, errors };
      });
      setParsedRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const validRows = parsedRows.filter(r => r.errors.length === 0);
  const errorCount = parsedRows.filter(r => r.errors.length > 0).length;

  const handleImport = async () => {
    setImporting(true);
    const typeCounts: Record<string, number> = {};
    VALID_TYPES.forEach(t => { typeCounts[t] = items.filter(i => i.type === t).length; });
    const typeNewIdx: Record<string, number> = {};
    VALID_TYPES.forEach(t => { typeNewIdx[t] = 0; });

    const now = new Date().toISOString();
    const built = validRows.map(r => {
      const d = r.data;
      const type = d['type'].toLowerCase().trim();
      const prefix = TC[type]?.p ?? type.toUpperCase();
      const idx = typeCounts[type] + typeNewIdx[type];
      typeNewIdx[type]++;
      const prog = Math.min(100, Math.max(0, parseInt(d['progress'] ?? '0') || 0));
      const status = VALID_STATUSES.includes(d['status']) ? d['status'] : 'Draft';
      const priority = VALID_PRIORITIES.includes(d['priority']) ? d['priority'] : 'Medium';
      const health = VALID_HEALTHS.includes(d['health']) ? d['health'] : 'Green';
      const risk = VALID_RISKS.includes(d['risk']) ? d['risk'] : 'Low';
      return {
        id: gId(),
        key: `${prefix}-${String(idx).padStart(4,'0')}`,
        type,
        title: d['title'],
        description: d['description'] ?? '',
        status,
        priority,
        health,
        risk,
        impactType: d['impact_type'] ?? '',
        owner: d['owner'] ?? '',
        assigned: d['assigned'] ?? '',
        sponsor: d['sponsor'] ?? '',
        businessUnit: d['business_unit'] ?? '',
        progress: prog,
        startDate: d['start_date'] ?? '',
        endDate: d['end_date'] ?? '',
        approvedBudget: d['approved_budget'] ?? '',
        actualCost: d['actual_cost'] ?? '',
        tags: [],
        links: [],
        dependencies: [],
        comments: [],
        attachments: [],
        keyResult: '',
        riskStatement: '',
        currentStatus: '',
        currentStatusAt: '',
        impact: '',
        updatedBy: loggedUser ?? '',
        updatedAt: now,
        storyPoints: null,
        acceptanceCriteria: '',
        itemSubtype: null,
        sprintId: null,
      };
    });

    await onImport(built);
    setImportedCount(built.length);
    setImporting(false);
    setStep('done');
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  };
  const panelStyle: React.CSSProperties = {
    background: 'white', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    width: '100%', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  };
  const headerStyle: React.CSSProperties = {
    padding: '18px 24px', borderBottom: '1px solid #f1f5f9',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };
  const bodyStyle: React.CSSProperties = { padding: '20px 24px', flex: 1, overflowY: 'auto' };
  const footerStyle: React.CSSProperties = {
    padding: '14px 24px', borderTop: '1px solid #f1f5f9',
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
  };

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>📥 Import Work Items</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af', lineHeight: 1 }}>✕</button>
        </div>

        {step === 'upload' && (
          <>
            <div style={bodyStyle}>
              <div style={{ marginBottom: 16 }}>
                <button onClick={downloadTemplate}
                  style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white',
                    fontSize: 12, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  ⬇ Download Template
                </button>
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8, lineHeight: 1.5 }}>
                  Download the template CSV, fill it in, then upload it here.
                </p>
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragging ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: 10, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
                  background: dragging ? '#eff6ff' : '#f9fafb', transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Click to upload or drag & drop
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>.csv files only</div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange}/>
              </div>
            </div>
            <div style={footerStyle}>
              <button onClick={onClose}
                style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white',
                  fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div style={bodyStyle}>
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8,
                background: errorCount > 0 ? '#fff7ed' : '#f0fdf4',
                border: `1px solid ${errorCount > 0 ? '#fed7aa' : '#bbf7d0'}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: errorCount > 0 ? '#c2410c' : '#15803d' }}>
                  {validRows.length} row{validRows.length !== 1 ? 's' : ''} ready to import
                  {errorCount > 0 ? `, ${errorCount} error${errorCount !== 1 ? 's' : ''}` : ''}
                </span>
              </div>
              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 320, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Row','Type','Title','Status','Priority','Owner','Start Date','End Date'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 10, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, idx) => {
                      const hasErr = r.errors.length > 0;
                      const bg = hasErr ? '#fef2f2' : idx % 2 === 0 ? 'white' : '#f9fafb';
                      return (
                        <tr key={r.row} style={{ background: bg, borderBottom: '1px solid #f3f4f6' }}
                          title={hasErr ? r.errors.join('; ') : ''}>
                          <td style={{ padding: '5px 10px', color: hasErr ? '#dc2626' : '#6b7280', fontWeight: hasErr ? 600 : 400 }}>{r.row}</td>
                          <td style={{ padding: '5px 10px', color: hasErr ? '#dc2626' : '#374151' }}>{r.data['type'] || '—'}</td>
                          <td style={{ padding: '5px 10px', color: hasErr ? '#dc2626' : '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.data['title'] || '—'}</td>
                          <td style={{ padding: '5px 10px', color: '#374151' }}>{r.data['status'] || '—'}</td>
                          <td style={{ padding: '5px 10px', color: '#374151' }}>{r.data['priority'] || '—'}</td>
                          <td style={{ padding: '5px 10px', color: '#374151' }}>{r.data['owner'] || '—'}</td>
                          <td style={{ padding: '5px 10px', color: '#374151' }}>{r.data['start_date'] || '—'}</td>
                          <td style={{ padding: '5px 10px', color: '#374151' }}>{r.data['end_date'] || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {errorCount > 0 && (
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                  Rows highlighted in red have errors and will be skipped. Hover a row to see the error details.
                </p>
              )}
            </div>
            <div style={footerStyle}>
              <button onClick={() => setStep('upload')}
                style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white',
                  fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                ← Back
              </button>
              <button onClick={handleImport} disabled={validRows.length === 0 || importing}
                style={{ padding: '7px 18px', borderRadius: 7, border: 'none',
                  background: validRows.length === 0 ? '#93c5fd' : '#2563eb',
                  color: 'white', fontSize: 12, fontWeight: 600, cursor: validRows.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {importing ? (
                  <>
                    <span style={{ display:'inline-block', width:12, height:12, borderRadius:'50%',
                      border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white',
                      animation:'spin 0.7s linear infinite' }}/>
                    Importing…
                  </>
                ) : `Import ${validRows.length} item${validRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={{ ...bodyStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 180 }}>
              <div style={{ fontSize: 44 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#15803d' }}>
                {importedCount} item{importedCount !== 1 ? 's' : ''} imported successfully
              </div>
            </div>
            <div style={footerStyle}>
              <button onClick={onClose}
                style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#2563eb',
                  color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── WORK ITEMS VIEW ──────────────────────────────────────────────────────────
interface WorkItemsViewProps {
  items: any[];
  sel: string | null;
  onSel: (id: string) => void;
  filter: string;
  enabledTypes?: string[];
  onImport?: (items: any[]) => Promise<void>;
  loggedUser?: string;
}

export default function WorkItemsView({ items, sel, onSel, filter, enabledTypes, onImport, loggedUser }: WorkItemsViewProps) {
  const ALL_ITEM_TYPES = ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask'];
  const activeTypes = (enabledTypes && enabledTypes.length > 0) ? enabledTypes : ALL_ITEM_TYPES;
  const [sortCol, setSortCol] = useState('type');
  const [sortDir, setSortDir] = useState('asc');
  const [showImport, setShowImport] = useState(false);
  const onSort = (col: string) => { setSortDir(d => sortCol===col?(d==='asc'?'desc':'asc'):'asc'); setSortCol(col); };
  const base = filter==='all' ? items : items.filter(i => i.type===filter);
  const sorted = sortItems(base, sortCol, sortDir);
  const fmt = (v: any) => v ? `£${Number(v).toLocaleString()}` : '—';

  const exportCSV = () => {
    const headers = ['Key','Type','Title','Status','Priority','Health','Risk','Impact Type','Owner','Assigned','Sponsor','Business Unit','Progress','Start Date','Due Date','Budget','Actual Cost','Updated At','Updated By'];
    const rows = sorted.map(it => [
      it.key, it.type, it.title, it.status, it.priority, it.health, it.risk,
      it.impactType, it.owner, it.assigned, it.sponsor, it.businessUnit,
      `${it.progress}%`, it.startDate, it.endDate,
      it.approvedBudget ? `£${Number(it.approvedBudget).toLocaleString()}` : '',
      it.actualCost ? `£${Number(it.actualCost).toLocaleString()}` : '',
      it.updatedAt, it.updatedBy,
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${(v??'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `work-items-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const btnStyle: React.CSSProperties = {
    padding:'5px 14px', borderRadius:7, border:'1px solid #e2e8f0', background:'white',
    fontSize:12, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', gap:5,
    boxShadow:'0 1px 2px rgba(0,0,0,0.05)',
  };

  if (!sorted.length) return (
    <>
      {showImport && onImport && (
        <ImportModal items={items} loggedUser={loggedUser} onImport={onImport} onClose={() => setShowImport(false)}/>
      )}
      <div className="flex flex-col items-center justify-center h-full text-gray-400" style={{ position:'relative' }}>
        {onImport && (
          <div style={{ position:'absolute', top:8, right:12 }}>
            <button onClick={() => setShowImport(true)} style={{ ...btnStyle, color:'#2563eb', borderColor:'#bfdbfe' }}>
              ⬆ Import
            </button>
          </div>
        )}
        <div style={{ fontSize:48 }}>{filter!=='all' ? TC[filter]?.i : '📦'}</div>
        <div className="font-medium text-gray-500 mt-2" style={{ fontSize:14 }}>No {filter!=='all' ? TC[filter]?.l+'s' : 'Work Items'} yet</div>
      </div>
    </>
  );

  return (
    <>
      {showImport && onImport && (
        <ImportModal items={items} loggedUser={loggedUser} onImport={onImport} onClose={() => setShowImport(false)}/>
      )}
    <div className="p-2 h-full overflow-auto" style={{ WebkitOverflowScrolling:'touch' }}>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:6, gap:8 }}>
        {onImport && (
          <button onClick={() => setShowImport(true)} style={{ ...btnStyle, color:'#2563eb', borderColor:'#bfdbfe' }}>
            ⬆ Import
          </button>
        )}
        <button onClick={exportCSV} style={btnStyle}>
          ⬇ Export CSV
        </button>
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ minWidth:'max-content', width:'max-content', maxWidth:'none' }}>
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
    </>
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
    <div className="p-2 h-full overflow-auto" style={{ WebkitOverflowScrolling:'touch' }}>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ minWidth:'max-content', width:'max-content', maxWidth:'none' }}>
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
