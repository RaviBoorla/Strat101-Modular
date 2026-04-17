import React, { useState, useRef, useEffect } from "react";
import { TC, SC, STATS, PRIS, HLTHS, RSKS, IMPACT_TYPES, SPONSOR_TYPES, ITEM_SUBTYPE_META } from "../../constants";
import { tsNow } from "../../utils";
import { FG } from "../../components/shared";

// ─── USER PICKER ──────────────────────────────────────────────────────────────
function UserPicker({ value, onChange, users, placeholder, className }: {
  value: string; onChange: (v: string) => void;
  users: string[]; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => { setQ(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = users.filter(u => !q.trim() || u.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const showList = open && (filtered.length > 0 || q.trim() === '');

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        style={{ fontSize:13 }}
        autoComplete="off"
      />
      {showList && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50,
          background:'white', border:'1px solid #e2e8f0', borderRadius:8,
          boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:200, overflowY:'auto', marginTop:2 }}>
          {filtered.map(u => (
            <button key={u} type="button"
              onMouseDown={() => { onChange(u); setQ(u); setOpen(false); }}
              style={{ width:'100%', textAlign:'left', padding:'8px 12px',
                border:'none', background:'transparent', cursor:'pointer',
                fontSize:13, color:'#374151', display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ width:24, height:24, borderRadius:'50%', background:'#e0e7ff',
                color:'#4f46e5', fontSize:10, fontWeight:700, display:'flex',
                alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {u.charAt(0).toUpperCase()}
              </span>
              {u}
            </button>
          ))}
          {q.trim() && !filtered.includes(q.trim()) && (
            <div style={{ padding:'6px 12px', fontSize:11, color:'#94a3b8', borderTop:'1px solid #f1f5f9' }}>
              Press Enter to use "{q.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sprint fields section — shown only for task / subtask
function SprintFields({ f, s }: { f: any; s: (k: string, v: any) => void }) {
  if (f.type !== 'task' && f.type !== 'subtask') return null;
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="text-violet-700 font-bold uppercase mb-2" style={{ fontSize:10, letterSpacing:'0.06em' }}>🏃 Sprint Fields</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FG label="Item Type">
          <select value={f.itemSubtype || ''} onChange={e => s('itemSubtype', e.target.value || null)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" style={{ fontSize:13 }}>
            <option value="">— Select type —</option>
            {Object.entries(ITEM_SUBTYPE_META).map(([k, m]) => (
              <option key={k} value={k}>{m.icon} {m.label}</option>
            ))}
          </select>
        </FG>
        <FG label="Story Points">
          <input type="number" min={0} max={999}
            value={f.storyPoints ?? ''}
            onChange={e => s('storyPoints', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
            style={{ fontSize:13 }} placeholder="e.g. 3"/>
        </FG>
      </div>
      <div className="mt-2">
        <FG label="Acceptance Criteria">
          <textarea value={f.acceptanceCriteria || ''} onChange={e => s('acceptanceCriteria', e.target.value)}
            rows={3} className="w-full border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
            style={{ fontSize:12 }} placeholder={"Given…\nWhen…\nThen…"}/>
        </FG>
      </div>
    </div>
  );
}

// ─── ITEM FORM ────────────────────────────────────────────────────────────────
interface ItemFormProps {
  item: any;
  onSave: (item: any) => void;
  onClose: () => void;
  onAutoSave?: ((item: any) => void) | null;
  drawerMode?: boolean;
  users?: string[];
}

export default function ItemForm({ item, onSave, onClose, onAutoSave, drawerMode = false, users = [] }: ItemFormProps) {
  const [f, setF] = useState({...item});
  const [tin, setTin] = useState('');
  const [saved, setSaved] = useState(false);
  const orig = useRef(item);
  const isAutoSave = !!onAutoSave;

  const s = (k: string, v: any) => {
    if(k==='currentStatus'){
      setF((p: any) => ({...p, currentStatus:v, currentStatusAt:v.trim()!==orig.current.currentStatus ? tsNow() : p.currentStatusAt}));
    } else {
      setF((p: any) => ({...p, [k]:v}));
    }
  };

  useEffect(() => {
    if(!onAutoSave || !f.title.trim()) return;
    const t = setTimeout(() => { onAutoSave(f); setSaved(true); setTimeout(() => setSaved(false), 1500); }, 700);
    return () => clearTimeout(t);
  }, [f]);

  const addTag = () => { const t=tin.trim(); if(t && !f.tags.includes(t)) s('tags',[...f.tags,t]); setTin(''); };
  const c = TC[f.type];

  if (drawerMode) {
    return (
      <div className="bg-white flex flex-col" style={{ height:'100%', overflow:'hidden' }}>
        {/* Header */}
        <div className={`px-4 py-3 rounded-t-2xl border-b ${c.bg} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ fontSize:18, flexShrink:0 }}>{c.i}</span>
            <span className={`font-bold ${c.tc}`} style={{ fontSize:14 }}>{item.title?'Edit':'New'} {c.l}</span>
            {f.key && <span className="font-mono text-gray-400 ml-1" style={{ fontSize:11 }}>{f.key}</span>}
            {isAutoSave && <span className={`ml-2 px-2 py-0.5 rounded-full font-medium ${saved?'bg-green-100 text-green-700':'bg-blue-100 text-blue-600'}`} style={{ fontSize:10 }}>{saved?'✓ Saved':f.title.trim()?'Auto-saving…':'Enter title to autosave'}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gray-500 font-semibold" style={{ fontSize:11 }}>Status:</span>
            <select value={f.status} onChange={e => s('status', e.target.value)}
              className="border rounded-lg px-2 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
              style={{ fontSize:16, cursor:'pointer' }}>
              {STATS.map(st => <option key={st}>{st}</option>)}
            </select>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold ml-1" style={{ fontSize:20, lineHeight:1 }}>×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Title */}
          <FG label="Title *"><input value={f.title} onChange={e => s('title', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }} placeholder={`${c.l} title…`}/></FG>
          {/* Description */}
          <FG label="Description"><textarea value={f.description} onChange={e => s('description', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }}/></FG>
          {/* Current Status */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-blue-700 font-bold uppercase" style={{ fontSize:10, letterSpacing:'0.06em' }}>📡 Current Status</div>
              {f.currentStatusAt && <div className="text-blue-400 font-mono" style={{ fontSize:10 }}>🕐 Auto-stamped: {f.currentStatusAt}</div>}
            </div>
            <textarea value={f.currentStatus||''} onChange={e => s('currentStatus', e.target.value)} rows={2}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" style={{ fontSize:16 }}
              placeholder="Describe current progress, blockers, or key updates…"/>
            <div className="text-blue-400 mt-1" style={{ fontSize:10 }}>Timestamp is captured automatically when you change this field.</div>
          </div>
          {/* Sprint fields — task & subtask */}
          <SprintFields f={f} s={s}/>
          {/* Priority / Health / Risk */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FG label="Priority"><select value={f.priority} onChange={e => s('priority', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }}>{PRIS.map(p => <option key={p}>{p}</option>)}</select></FG>
            <FG label="Health"><select value={f.health||'Green'} onChange={e => s('health', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }}>{HLTHS.map(h => <option key={h}>{h}</option>)}</select></FG>
            <FG label="Risk Level"><select value={f.risk||'Low'} onChange={e => s('risk', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }}>{RSKS.map(r => <option key={r}>{r}</option>)}</select></FG>
          </div>
          {/* Risk Statement */}
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="text-red-700 font-bold uppercase mb-1.5" style={{ fontSize:10, letterSpacing:'0.06em' }}>⚠️ Risk Statement</div>
            <textarea value={f.riskStatement||''} onChange={e => s('riskStatement', e.target.value)} rows={2}
              className="w-full border border-red-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" style={{ fontSize:16 }}
              placeholder="Describe key risks, threats, or concerns for this item…"/>
          </div>
          {f.type==='okr' && <FG label="Key Results (Summary)"><textarea value={f.keyResult||''} onChange={e => s('keyResult', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }} placeholder={"KR1: …\nKR2: …\nKR3: …"}/></FG>}
          {f.type==='kr' && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <div className="text-sky-700 font-bold uppercase mb-1.5" style={{ fontSize:10, letterSpacing:'0.06em' }}>🔑 Key Result Definition</div>
              <textarea value={f.keyResult||''} onChange={e => s('keyResult', e.target.value)} rows={3}
                className="w-full border border-sky-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white" style={{ fontSize:16 }}
                placeholder="Define the measurable outcome. e.g. Increase deployment frequency from 2x/week to daily by Q4…"/>
              <div className="text-sky-400 mt-1" style={{ fontSize:10 }}>Describe the specific, measurable result this Key Result tracks.</div>
            </div>
          )}
          {/* People */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FG label="Owner"><UserPicker value={f.owner} onChange={v => s('owner', v)} users={users} placeholder="Owner…" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"/></FG>
            <FG label="Assigned To"><UserPicker value={f.assigned||''} onChange={v => s('assigned', v)} users={users} placeholder="Assigned person…" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"/></FG>
            {SPONSOR_TYPES.has(f.type)
              ? <FG label="Sponsor"><UserPicker value={f.sponsor||''} onChange={v => s('sponsor', v)} users={users} placeholder="Executive sponsor…" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"/></FG>
              : <FG label="Business Unit"><input value={f.businessUnit||''} onChange={e => s('businessUnit', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="Business unit…"/></FG>
            }
          </div>
          {SPONSOR_TYPES.has(f.type) && <FG label="Business Unit"><input value={f.businessUnit||''} onChange={e => s('businessUnit', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="Owning business unit…"/></FG>}
          {/* Impact & Finance */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FG label="Impact Type"><select value={f.impactType||''} onChange={e => s('impactType', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:12 }}>{IMPACT_TYPES.map(it => <option key={it} value={it}>{it||'— Select —'}</option>)}</select></FG>
            <FG label="Approved Budget (£)"><input type="number" min="0" value={f.approvedBudget||''} onChange={e => s('approvedBudget', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="0"/></FG>
            <FG label="Actual Cost (£)"><input type="number" min="0" value={f.actualCost||''} onChange={e => s('actualCost', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="0"/></FG>
          </div>
          <FG label="Impact Description"><input value={f.impact||''} onChange={e => s('impact', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="Expected impact…"/></FG>
          {/* Dates + Progress */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FG label="Start Date"><input type="date" value={f.startDate} onChange={e => s('startDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:12 }}/></FG>
            <FG label="End Date"><input type="date" value={f.endDate} onChange={e => s('endDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:12 }}/></FG>
            <FG label={`Progress: ${f.progress}%`}><input type="range" min="0" max="100" value={f.progress} onChange={e => s('progress', +e.target.value)} className="w-full accent-blue-500 mt-2"/></FG>
          </div>
          {/* Tags */}
          <FG label="Tags">
            <div className="flex gap-2">
              <input value={tin} onChange={e => setTin(e.target.value)} onKeyDown={e => e.key==='Enter' && addTag()} className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:12 }} placeholder="Add tag, press Enter…"/>
              <button onClick={addTag} className="px-3 bg-gray-100 hover:bg-gray-200 rounded-lg" style={{ fontSize:12 }}>Add</button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {f.tags.map((t: string) => <span key={t} className="flex items-center gap-1 bg-blue-50 text-blue-600 rounded-full px-2 py-0.5" style={{ fontSize:11 }}>{t}<button onClick={() => s('tags', f.tags.filter((x: string) => x!==t))} className="hover:text-red-500 font-bold" style={{ fontSize:13, lineHeight:1 }}>×</button></span>)}
            </div>
          </FG>
          {/* Audit */}
          {(f.updatedAt||f.updatedBy) && <div className="rounded-lg border bg-gray-50 px-3 py-2 flex items-center gap-4"><span style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Last Updated</span>{f.updatedBy && <span style={{ fontSize:11, color:'#475569' }}>👤 {f.updatedBy}</span>}{f.updatedAt && <span style={{ fontSize:11, color:'#64748b', fontFamily:'monospace' }}>🕐 {f.updatedAt}</span>}</div>}
        </div>

        <div className="px-4 py-2 border-t flex items-center justify-between">
          {isAutoSave && <span className="text-gray-400" style={{ fontSize:11 }}>💾 {f.title.trim()?'Auto-saving draft…':'Enter a title to begin auto-saving'}</span>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" style={{ fontSize:12 }}>{isAutoSave?'Close':'Cancel'}</button>
            <button onClick={() => f.title.trim() && onSave(f)} disabled={!f.title.trim()} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-semibold" style={{ fontSize:12 }}>Save {c.l}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background:'rgba(0,0,0,0.55)', padding:'clamp(0px, 2vw, 16px)' }}>
      <div className="bg-white shadow-2xl flex flex-col" style={{ width:'100%', maxWidth:870, maxHeight:'100dvh', borderRadius:'clamp(0px, 2vw, 16px)' }}>
        {/* Header */}
        <div className={`px-4 py-3 rounded-t-2xl border-b ${c.bg} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ fontSize:18, flexShrink:0 }}>{c.i}</span>
            <span className={`font-bold ${c.tc}`} style={{ fontSize:14 }}>{item.title?'Edit':'New'} {c.l}</span>
            {f.key && <span className="font-mono text-gray-400 ml-1" style={{ fontSize:11 }}>{f.key}</span>}
            {isAutoSave && <span className={`ml-2 px-2 py-0.5 rounded-full font-medium ${saved?'bg-green-100 text-green-700':'bg-blue-100 text-blue-600'}`} style={{ fontSize:10 }}>{saved?'✓ Saved':f.title.trim()?'Auto-saving…':'Enter title to autosave'}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gray-500 font-semibold" style={{ fontSize:11 }}>Status:</span>
            <select value={f.status} onChange={e => s('status', e.target.value)}
              className="border rounded-lg px-2 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300"
              style={{ fontSize:16, cursor:'pointer' }}>
              {STATS.map(st => <option key={st}>{st}</option>)}
            </select>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold ml-1" style={{ fontSize:20, lineHeight:1 }}>×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Title */}
          <FG label="Title *"><input value={f.title} onChange={e => s('title', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }} placeholder={`${c.l} title…`}/></FG>
          {/* Description */}
          <FG label="Description"><textarea value={f.description} onChange={e => s('description', e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }}/></FG>
          {/* Current Status */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-blue-700 font-bold uppercase" style={{ fontSize:10, letterSpacing:'0.06em' }}>📡 Current Status</div>
              {f.currentStatusAt && <div className="text-blue-400 font-mono" style={{ fontSize:10 }}>🕐 Auto-stamped: {f.currentStatusAt}</div>}
            </div>
            <textarea value={f.currentStatus||''} onChange={e => s('currentStatus', e.target.value)} rows={2}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" style={{ fontSize:16 }}
              placeholder="Describe current progress, blockers, or key updates…"/>
            <div className="text-blue-400 mt-1" style={{ fontSize:10 }}>Timestamp is captured automatically when you change this field.</div>
          </div>
          {/* Sprint fields — task & subtask */}
          <SprintFields f={f} s={s}/>
          {/* Priority / Health / Risk */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FG label="Priority"><select value={f.priority} onChange={e => s('priority', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }}>{PRIS.map(p => <option key={p}>{p}</option>)}</select></FG>
            <FG label="Health"><select value={f.health||'Green'} onChange={e => s('health', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }}>{HLTHS.map(h => <option key={h}>{h}</option>)}</select></FG>
            <FG label="Risk Level"><select value={f.risk||'Low'} onChange={e => s('risk', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }}>{RSKS.map(r => <option key={r}>{r}</option>)}</select></FG>
          </div>
          {/* Risk Statement */}
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="text-red-700 font-bold uppercase mb-1.5" style={{ fontSize:10, letterSpacing:'0.06em' }}>⚠️ Risk Statement</div>
            <textarea value={f.riskStatement||''} onChange={e => s('riskStatement', e.target.value)} rows={2}
              className="w-full border border-red-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" style={{ fontSize:16 }}
              placeholder="Describe key risks, threats, or concerns for this item…"/>
          </div>
          {f.type==='okr' && <FG label="Key Results (Summary)"><textarea value={f.keyResult||''} onChange={e => s('keyResult', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:16 }} placeholder={"KR1: …\nKR2: …\nKR3: …"}/></FG>}
          {f.type==='kr' && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <div className="text-sky-700 font-bold uppercase mb-1.5" style={{ fontSize:10, letterSpacing:'0.06em' }}>🔑 Key Result Definition</div>
              <textarea value={f.keyResult||''} onChange={e => s('keyResult', e.target.value)} rows={3}
                className="w-full border border-sky-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white" style={{ fontSize:16 }}
                placeholder="Define the measurable outcome. e.g. Increase deployment frequency from 2x/week to daily by Q4…"/>
              <div className="text-sky-400 mt-1" style={{ fontSize:10 }}>Describe the specific, measurable result this Key Result tracks.</div>
            </div>
          )}
          {/* People */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FG label="Owner"><UserPicker value={f.owner} onChange={v => s('owner', v)} users={users} placeholder="Owner…" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"/></FG>
            <FG label="Assigned To"><UserPicker value={f.assigned||''} onChange={v => s('assigned', v)} users={users} placeholder="Assigned person…" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"/></FG>
            {SPONSOR_TYPES.has(f.type)
              ? <FG label="Sponsor"><UserPicker value={f.sponsor||''} onChange={v => s('sponsor', v)} users={users} placeholder="Executive sponsor…" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"/></FG>
              : <FG label="Business Unit"><input value={f.businessUnit||''} onChange={e => s('businessUnit', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="Business unit…"/></FG>
            }
          </div>
          {SPONSOR_TYPES.has(f.type) && <FG label="Business Unit"><input value={f.businessUnit||''} onChange={e => s('businessUnit', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="Owning business unit…"/></FG>}
          {/* Impact & Finance */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FG label="Impact Type"><select value={f.impactType||''} onChange={e => s('impactType', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:12 }}>{IMPACT_TYPES.map(it => <option key={it} value={it}>{it||'— Select —'}</option>)}</select></FG>
            <FG label="Approved Budget (£)"><input type="number" min="0" value={f.approvedBudget||''} onChange={e => s('approvedBudget', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="0"/></FG>
            <FG label="Actual Cost (£)"><input type="number" min="0" value={f.actualCost||''} onChange={e => s('actualCost', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="0"/></FG>
          </div>
          <FG label="Impact Description"><input value={f.impact||''} onChange={e => s('impact', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:13 }} placeholder="Expected impact…"/></FG>
          {/* Dates + Progress */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FG label="Start Date"><input type="date" value={f.startDate} onChange={e => s('startDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:12 }}/></FG>
            <FG label="End Date"><input type="date" value={f.endDate} onChange={e => s('endDate', e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:12 }}/></FG>
            <FG label={`Progress: ${f.progress}%`}><input type="range" min="0" max="100" value={f.progress} onChange={e => s('progress', +e.target.value)} className="w-full accent-blue-500 mt-2"/></FG>
          </div>
          {/* Tags */}
          <FG label="Tags">
            <div className="flex gap-2">
              <input value={tin} onChange={e => setTin(e.target.value)} onKeyDown={e => e.key==='Enter' && addTag()} className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:12 }} placeholder="Add tag, press Enter…"/>
              <button onClick={addTag} className="px-3 bg-gray-100 hover:bg-gray-200 rounded-lg" style={{ fontSize:12 }}>Add</button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {f.tags.map((t: string) => <span key={t} className="flex items-center gap-1 bg-blue-50 text-blue-600 rounded-full px-2 py-0.5" style={{ fontSize:11 }}>{t}<button onClick={() => s('tags', f.tags.filter((x: string) => x!==t))} className="hover:text-red-500 font-bold" style={{ fontSize:13, lineHeight:1 }}>×</button></span>)}
            </div>
          </FG>
          {/* Audit */}
          {(f.updatedAt||f.updatedBy) && <div className="rounded-lg border bg-gray-50 px-3 py-2 flex items-center gap-4"><span style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Last Updated</span>{f.updatedBy && <span style={{ fontSize:11, color:'#475569' }}>👤 {f.updatedBy}</span>}{f.updatedAt && <span style={{ fontSize:11, color:'#64748b', fontFamily:'monospace' }}>🕐 {f.updatedAt}</span>}</div>}
        </div>

        <div className="px-4 py-2 border-t flex items-center justify-between">
          {isAutoSave && <span className="text-gray-400" style={{ fontSize:11 }}>💾 {f.title.trim()?'Auto-saving draft…':'Enter a title to begin auto-saving'}</span>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" style={{ fontSize:12 }}>{isAutoSave?'Close':'Cancel'}</button>
            <button onClick={() => f.title.trim() && onSave(f)} disabled={!f.title.trim()} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-semibold" style={{ fontSize:12 }}>Save {c.l}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LINK DIALOG ──────────────────────────────────────────────────────────────
interface LinkDlgProps {
  mode: string;
  selected: any;
  allItems: any[];
  q: string;
  onQ: (q: string) => void;
  onLink: (id: string) => void;
  onClose: () => void;
}

export function LinkDlg({ mode, selected, allItems, q, onQ, onLink, onClose }: LinkDlgProps) {
  const existing = new Set([selected.id, ...(mode==='dep' ? selected.dependencies||[] : selected.links)]);
  const res = allItems.filter(i => !existing.has(i.id) && (q==='' || i.title.toLowerCase().includes(q.toLowerCase()) || TC[i.type].l.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background:'rgba(0,0,0,0.55)', padding:'clamp(0px, 2vw, 16px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl" style={{ width:'100%', maxWidth:420 }}>
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <span className="font-bold text-gray-800" style={{ fontSize:13 }}>{mode==='dep'?'⛓️ Add Dependency':'🔗 Add Link'}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold" style={{ fontSize:18, lineHeight:1 }}>×</button>
        </div>
        <div className="p-3"><input value={q} onChange={e => onQ(e.target.value)} autoFocus className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" style={{ fontSize:12 }} placeholder="Search items…"/></div>
        <div className="px-3 pb-3 space-y-1 overflow-y-auto" style={{ maxHeight:300 }}>
          {!res.length ? <p className="text-gray-400 text-center py-6" style={{ fontSize:12 }}>No items found</p> : res.map(i => {
            const cc = TC[i.type];
            return (
              <button key={i.id} onClick={() => onLink(i.id)} className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-gray-50 border border-transparent hover:border-gray-200">
                <span style={{ fontSize:14 }}>{cc.i}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold ${cc.tc}`} style={{ fontSize:10 }}>{cc.l} · {i.key}</div>
                  <div className="text-gray-700" style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.title||'(Untitled)'}</div>
                </div>
                <span className={`px-1.5 py-0.5 rounded-full whitespace-nowrap ${SC[i.status]||''}`} style={{ fontSize:10 }}>{i.status}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
