import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const RISK_STATUSES     = ['Open','In Treatment','Escalated','Mitigated','Accepted','Closed'];
const DECISION_STATUSES = ['Proposed','Under Review','Approved','Implemented','Deferred','Reversed','Superseded'];
const RISK_LEVELS       = ['Critical','High','Medium','Low'];
const PROBABILITIES     = ['High','Medium','Low'];
const IMPACTS           = ['High','Medium','Low'];
const RISK_CATEGORIES   = ['Strategic','Operational','Financial','Compliance','Technical','Reputational','Legal','Environmental'];
const RISK_RESPONSES    = ['Avoid','Mitigate','Transfer','Accept'];
const DECISION_TYPES    = ['Strategic','Operational','Technical','Financial','HR','Procurement'];
const OUTCOME_STATUSES  = ['Pending','Implemented','Deferred','Reversed','Superseded'];

const ITEM_TYPES = ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask'];
const ITEM_ICONS: Record<string,string> = {
  vision:'🔭',mission:'🎯',goal:'🏆',okr:'📊',kr:'🔑',
  initiative:'🚀',program:'📁',project:'📋',task:'✅',subtask:'🔸',
};

export function computeRiskLevel(prob: string, imp: string): string {
  if (prob==='High'   && imp==='High')   return 'Critical';
  if (prob==='High'   && imp==='Medium') return 'High';
  if (prob==='High'   && imp==='Low')    return 'Medium';
  if (prob==='Medium' && imp==='High')   return 'High';
  if (prob==='Medium' && imp==='Medium') return 'Medium';
  if (prob==='Medium' && imp==='Low')    return 'Low';
  if (prob==='Low'    && imp==='High')   return 'Medium';
  return 'Low';
}

export const RISK_LEVEL_STYLE: Record<string,{bg:string;text:string;border:string;dot:string}> = {
  Critical: { bg:'#fef2f2', text:'#dc2626', border:'#fecaca', dot:'#dc2626' },
  High:     { bg:'#fffbeb', text:'#d97706', border:'#fde68a', dot:'#f59e0b' },
  Medium:   { bg:'#eff6ff', text:'#2563eb', border:'#bfdbfe', dot:'#3b82f6' },
  Low:      { bg:'#f0fdf4', text:'#16a34a', border:'#bbf7d0', dot:'#22c55e' },
};

export const RISK_STATUS_COLOR: Record<string,string> = {
  Open:'#dc2626','In Treatment':'#f59e0b',Escalated:'#8b5cf6',
  Mitigated:'#2563eb',Accepted:'#64748b',Closed:'#16a34a',
};

export const DEC_STATUS_COLOR: Record<string,string> = {
  Proposed:'#64748b','Under Review':'#f59e0b',Approved:'#16a34a',
  Implemented:'#2563eb',Deferred:'#8b5cf6',Reversed:'#dc2626',Superseded:'#94a3b8',
};

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface RiDeRecord {
  id: string;
  record_type: 'risk'|'decision';
  ref_key?: string;
  title: string;
  description?: string;
  status: string;
  owner?: string;
  raised_by?: string;
  raised_date?: string;
  due_date?: string;
  linked_item_id?: string;
  linked_item_title?: string;
  linked_item_type?: string;
  notes?: string;
  risk_category?: string;
  probability?: string;
  impact?: string;
  risk_level?: string;
  risk_response?: string;
  mitigation?: string;
  contingency?: string;
  residual_risk?: string;
  review_date?: string;
  decision_type?: string;
  options_considered?: string;
  rationale?: string;
  decision_made?: string;
  decided_by?: string;
  decision_date?: string;
  review_trigger?: string;
  outcome_status?: string;
  outcome_notes?: string;
}

// ─── SHARED FIELD HELPERS ─────────────────────────────────────────────────────

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ display:'block',fontSize:11,fontWeight:600,color:'#64748b',
        textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4 }}>{label}</label>
      {children}
    </div>
  );
}
const inp = { width:'100%',boxSizing:'border-box' as const,border:'1px solid #e2e8f0',
  borderRadius:7,padding:'7px 10px',fontSize:16,color:'#374151',outline:'none' };
const sel = { ...inp };
const ta  = { ...inp,resize:'none' as const,lineHeight:1.6 };

// ─── RECORD FORM ─────────────────────────────────────────────────────────────

export function RecordForm({
  record, type, tenantId, loggedUser, workItems, onSave, onClose,
}: {
  record: Partial<RiDeRecord>|null; type:'risk'|'decision';
  tenantId:string; loggedUser:string; workItems:any[];
  onSave:(r:RiDeRecord)=>void; onClose:()=>void;
}) {
  const isEdit = !!record?.id;
  const [f, setF] = useState<Partial<RiDeRecord>>({
    record_type:type, status:type==='risk'?'Open':'Proposed',
    probability:'Medium', impact:'Medium', risk_level:'Medium',
    outcome_status:'Pending', raised_by:loggedUser,
    raised_date: new Date().toISOString().slice(0,10), ...record,
  });
  const [saving,  setSaving]  = useState(false);
  const [itemQ,   setItemQ]   = useState(record?.linked_item_title||'');

  const s = (k: keyof RiDeRecord, v: any) => setF(p => {
    const next = { ...p, [k]: v };
    if (k==='probability'||k==='impact') {
      next.risk_level = computeRiskLevel(
        k==='probability'?v:(p.probability||'Medium'),
        k==='impact'?v:(p.impact||'Medium'),
      );
    }
    return next;
  });

  const filteredItems = workItems.filter(i =>
    !itemQ.trim() || i.title?.toLowerCase().includes(itemQ.toLowerCase())
  ).slice(0,8);

  const save = async () => {
    if (!f.title?.trim()) return;
    setSaving(true);
    const payload: any = {
      record_type:type, title:f.title.trim(),
      description:f.description||null, status:f.status,
      owner:f.owner||null, raised_by:f.raised_by||loggedUser,
      raised_date:f.raised_date||null, due_date:f.due_date||null,
      notes:f.notes||null, linked_item_id:f.linked_item_id||null,
      risk_category:f.risk_category||null, probability:f.probability||null,
      impact:f.impact||null, risk_level:f.risk_level||null,
      risk_response:f.risk_response||null, mitigation:f.mitigation||null,
      contingency:f.contingency||null, residual_risk:f.residual_risk||null,
      review_date:f.review_date||null,
      decision_type:f.decision_type||null, options_considered:f.options_considered||null,
      rationale:f.rationale||null, decision_made:f.decision_made||null,
      decided_by:f.decided_by||null, decision_date:f.decision_date||null,
      review_trigger:f.review_trigger||null, outcome_status:f.outcome_status||null,
      outcome_notes:f.outcome_notes||null, updated_at:new Date().toISOString(),
    };
    if (!isEdit) payload.tenant_id = tenantId;

    let data: any, error: any;
    if (isEdit && record?.id) {
      ({data,error} = await supabase.from('ride_intel').update(payload).eq('id',record.id).select().single());
    } else {
      ({data,error} = await supabase.from('ride_intel').insert({...payload,tenant_id:tenantId}).select().single());
    }
    setSaving(false);
    if (!error && data) onSave(data as RiDeRecord);
  };

  const rl = f.risk_level ? RISK_LEVEL_STYLE[f.risk_level] : null;

  return (
    <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',background:'rgba(15,23,42,0.4)',overflowY:'auto',WebkitOverflowScrolling:'touch'}} onClick={onClose}>
      <div style={{flex:1}}/>
      <div style={{width:'100%',maxWidth:560,background:'white',height:'100%',display:'flex',
        flexDirection:'column',boxShadow:'-4px 0 24px rgba(0,0,0,0.15)'}} onClick={e=>e.stopPropagation()}>

        <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',
          alignItems:'center',justifyContent:'space-between',flexShrink:0,
          background:type==='risk'?'#fef2f2':'#eef2ff'}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#111827'}}>
              {isEdit?'Edit':'New'} {type==='risk'?'⚡ Risk':'🎯 Decision'}
            </div>
            <div style={{fontSize:11,color:'#64748b',marginTop:2}}>
              {type==='risk'?'Risk Register — ISO 31000 aligned':'Decision Log — PMI PMBOK aligned'}
            </div>
          </div>
          <button onClick={onClose} style={{border:'none',background:'none',fontSize:20,cursor:'pointer',color:'#94a3b8'}}>×</button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:18}}>
          <FL label="Title *">
            <input value={f.title||''} onChange={e=>s('title',e.target.value)} style={inp} autoFocus
              placeholder={type==='risk'?'e.g. Budget overrun due to vendor delays':'e.g. Select cloud platform vendor'}/>
          </FL>
          <FL label="Description">
            <textarea value={f.description||''} onChange={e=>s('description',e.target.value)} rows={2} style={ta}/>
          </FL>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:4}}>
            <FL label="Owner">
              <input value={f.owner||''} onChange={e=>s('owner',e.target.value)} style={inp} placeholder="Name or team"/>
            </FL>
            <FL label="Raised By">
              <input value={f.raised_by||loggedUser} onChange={e=>s('raised_by',e.target.value)} style={inp}/>
            </FL>
            <FL label="Raised Date">
              <input type="date" value={f.raised_date||''} onChange={e=>s('raised_date',e.target.value)} style={inp}/>
            </FL>
            <FL label="Due / Review Date">
              <input type="date" value={f.due_date||''} onChange={e=>s('due_date',e.target.value)} style={inp}/>
            </FL>
          </div>

          <FL label="Status">
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {(type==='risk'?RISK_STATUSES:DECISION_STATUSES).map(st => {
                const c = type==='risk'?RISK_STATUS_COLOR[st]:DEC_STATUS_COLOR[st];
                const active = f.status===st;
                return (
                  <button key={st} onClick={()=>s('status',st)}
                    style={{padding:'4px 10px',borderRadius:7,border:`1px solid ${active?c:'#e2e8f0'}`,
                      background:active?c:'white',color:active?'white':'#374151',
                      fontSize:11,fontWeight:active?700:400,cursor:'pointer'}}>
                    {st}
                  </button>
                );
              })}
            </div>
          </FL>

          <FL label="Linked Work Item (optional)">
            <input value={itemQ} onChange={e=>setItemQ(e.target.value)} style={inp} placeholder="Search work items…"/>
            {itemQ.trim() && filteredItems.length>0 && (
              <div style={{border:'1px solid #e2e8f0',borderRadius:7,marginTop:4,background:'white',maxHeight:160,overflowY:'auto'}}>
                {filteredItems.map(it=>(
                  <button key={it.id} onClick={()=>{
                    s('linked_item_id',it.id); s('linked_item_title',it.title); s('linked_item_type',it.type);
                    setItemQ(it.title);
                  }} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'8px 12px',
                    border:'none',background:'transparent',cursor:'pointer',textAlign:'left',
                    borderBottom:'1px solid #f1f5f9',fontSize:12,color:'#374151'}}>
                    <span>{ITEM_ICONS[it.type]||'📄'}</span>
                    <span style={{flex:1}}>{it.title}</span>
                    <span style={{fontSize:10,color:'#94a3b8',textTransform:'capitalize'}}>{it.type}</span>
                  </button>
                ))}
              </div>
            )}
            {f.linked_item_id && (
              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6,padding:'6px 10px',
                background:'#f0f9ff',borderRadius:7,border:'1px solid #bae6fd'}}>
                <span>{ITEM_ICONS[f.linked_item_type||'']||'📄'}</span>
                <span style={{fontSize:12,color:'#0369a1',flex:1}}>{f.linked_item_title}</span>
                <button onClick={()=>{s('linked_item_id','');s('linked_item_title','');s('linked_item_type','');setItemQ('');}}
                  style={{border:'none',background:'none',cursor:'pointer',color:'#94a3b8',fontSize:14}}>×</button>
              </div>
            )}
          </FL>

          {type==='risk' && (<>
            <div style={{margin:'12px 0 10px',padding:'8px 12px',background:'#fef2f2',borderRadius:8,
              borderLeft:'3px solid #dc2626',fontSize:11,fontWeight:600,color:'#dc2626'}}>
              ⚡ Risk Assessment
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <FL label="Risk Category">
                <select value={f.risk_category||''} onChange={e=>s('risk_category',e.target.value)} style={sel}>
                  <option value="">— Select —</option>
                  {RISK_CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </FL>
              <FL label="Risk Response">
                <select value={f.risk_response||''} onChange={e=>s('risk_response',e.target.value)} style={sel}>
                  <option value="">— Select —</option>
                  {RISK_RESPONSES.map(r=><option key={r}>{r}</option>)}
                </select>
              </FL>
              <FL label="Probability">
                <select value={f.probability||'Medium'} onChange={e=>s('probability',e.target.value)} style={sel}>
                  {PROBABILITIES.map(p=><option key={p}>{p}</option>)}
                </select>
              </FL>
              <FL label="Impact">
                <select value={f.impact||'Medium'} onChange={e=>s('impact',e.target.value)} style={sel}>
                  {IMPACTS.map(i=><option key={i}>{i}</option>)}
                </select>
              </FL>
            </div>
            {rl && (
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                background:rl.bg,border:`1px solid ${rl.border}`,borderRadius:9,marginBottom:10}}>
                <span style={{fontSize:11,color:rl.text}}>Computed Risk Level:</span>
                <span style={{fontWeight:800,fontSize:14,color:rl.text}}>{f.risk_level}</span>
                <span style={{fontSize:10,color:'#94a3b8',marginLeft:'auto'}}>
                  {f.probability} probability × {f.impact} impact
                </span>
              </div>
            )}
            <FL label="Mitigation Plan">
              <textarea value={f.mitigation||''} onChange={e=>s('mitigation',e.target.value)} rows={2} style={ta}
                placeholder="Actions to reduce probability or impact…"/>
            </FL>
            <FL label="Contingency Plan">
              <textarea value={f.contingency||''} onChange={e=>s('contingency',e.target.value)} rows={2} style={ta}
                placeholder="What to do if the risk materialises…"/>
            </FL>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <FL label="Residual Risk (after mitigation)">
                <select value={f.residual_risk||''} onChange={e=>s('residual_risk',e.target.value)} style={sel}>
                  <option value="">— Select —</option>
                  {RISK_LEVELS.map(r=><option key={r}>{r}</option>)}
                </select>
              </FL>
              <FL label="Next Review Date">
                <input type="date" value={f.review_date||''} onChange={e=>s('review_date',e.target.value)} style={inp}/>
              </FL>
            </div>
          </>)}

          {type==='decision' && (<>
            <div style={{margin:'12px 0 10px',padding:'8px 12px',background:'#eef2ff',borderRadius:8,
              borderLeft:'3px solid #6366f1',fontSize:11,fontWeight:600,color:'#6366f1'}}>
              🎯 Decision Details
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <FL label="Decision Type">
                <select value={f.decision_type||''} onChange={e=>s('decision_type',e.target.value)} style={sel}>
                  <option value="">— Select —</option>
                  {DECISION_TYPES.map(d=><option key={d}>{d}</option>)}
                </select>
              </FL>
              <FL label="Decided By">
                <input value={f.decided_by||''} onChange={e=>s('decided_by',e.target.value)} style={inp} placeholder="Name or role"/>
              </FL>
              <FL label="Decision Date">
                <input type="date" value={f.decision_date||''} onChange={e=>s('decision_date',e.target.value)} style={inp}/>
              </FL>
              <FL label="Outcome Status">
                <select value={f.outcome_status||'Pending'} onChange={e=>s('outcome_status',e.target.value)} style={sel}>
                  {OUTCOME_STATUSES.map(o=><option key={o}>{o}</option>)}
                </select>
              </FL>
            </div>
            <FL label="Options Considered">
              <textarea value={f.options_considered||''} onChange={e=>s('options_considered',e.target.value)} rows={2} style={ta}
                placeholder="List the alternatives that were considered…"/>
            </FL>
            <FL label="Rationale">
              <textarea value={f.rationale||''} onChange={e=>s('rationale',e.target.value)} rows={2} style={ta}
                placeholder="Why this decision was taken…"/>
            </FL>
            <FL label="Decision Summary">
              <textarea value={f.decision_made||''} onChange={e=>s('decision_made',e.target.value)} rows={2} style={ta}
                placeholder="The specific decision that was made…"/>
            </FL>
            <FL label="Review Trigger">
              <input value={f.review_trigger||''} onChange={e=>s('review_trigger',e.target.value)} style={inp}
                placeholder="What would trigger a review of this decision?"/>
            </FL>
            <FL label="Outcome Notes">
              <textarea value={f.outcome_notes||''} onChange={e=>s('outcome_notes',e.target.value)} rows={2} style={ta}
                placeholder="Notes on how this decision played out…"/>
            </FL>
          </>)}

          <FL label="Notes">
            <textarea value={f.notes||''} onChange={e=>s('notes',e.target.value)} rows={2} style={ta}/>
          </FL>
        </div>

        <div style={{padding:'12px 18px',borderTop:'1px solid #f1f5f9',display:'flex',
          gap:8,justifyContent:'flex-end',flexShrink:0}}>
          <button onClick={onClose} style={{padding:'7px 16px',borderRadius:7,border:'1px solid #e2e8f0',
            background:'white',fontSize:12,cursor:'pointer',color:'#374151'}}>Cancel</button>
          <button onClick={save} disabled={saving||!f.title?.trim()}
            style={{padding:'7px 16px',borderRadius:7,border:'none',
              background:type==='risk'?'#dc2626':'#6366f1',
              color:'white',fontSize:12,fontWeight:600,cursor:'pointer',
              opacity:(saving||!f.title?.trim())?0.5:1}}>
            {saving?'Saving…':isEdit?'Save Changes':`Add ${type==='risk'?'Risk':'Decision'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RIDE BOARD ───────────────────────────────────────────────────────────────

function RiDeBoard({ records, tab, workItems, onEdit }:
  { records:RiDeRecord[]; tab:'risk'|'decision'; workItems:any[]; onEdit:(r:RiDeRecord)=>void }) {
  const [groupBy, setGroupBy] = useState<'item_type'|'level'|'category'|'owner'>('item_type');
  const statusList = tab==='risk'?RISK_STATUSES:DECISION_STATUSES;
  const filtered   = records.filter(r=>r.record_type===tab);

  const rowKeys: string[] = (() => {
    if (groupBy==='item_type') {
      const linked = ITEM_TYPES.filter(t=>filtered.some(r=>r.linked_item_type===t));
      return [...linked, ...(filtered.some(r=>!r.linked_item_type)?['—']:[])];
    }
    if (groupBy==='level') return RISK_LEVELS.filter(l=>filtered.some(r=>r.risk_level===l));
    if (groupBy==='category') {
      return [...RISK_CATEGORIES.filter(c=>filtered.some(r=>r.risk_category===c)),
               ...(filtered.some(r=>!r.risk_category)?['Uncategorised']:[])];
    }
    return [...new Set(filtered.map(r=>r.owner||'Unassigned'))];
  })();

  const getRow = (key: string) => {
    if (groupBy==='item_type') return filtered.filter(r=>key==='—'?!r.linked_item_type:r.linked_item_type===key);
    if (groupBy==='level')     return filtered.filter(r=>r.risk_level===key);
    if (groupBy==='category')  return filtered.filter(r=>key==='Uncategorised'?!r.risk_category:r.risk_category===key);
    return filtered.filter(r=>(r.owner||'Unassigned')===key);
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',
        borderBottom:'1px solid #f1f5f9',flexShrink:0,background:'#fafafa'}}>
        <span style={{fontSize:11,color:'#94a3b8',fontWeight:600}}>Group by:</span>
        {([['item_type','Work Item Type'],['level','Risk Level'],['category','Category'],['owner','Owner']] as const)
          .map(([k,l])=>(
          <button key={k} onClick={()=>setGroupBy(k)}
            style={{padding:'3px 10px',borderRadius:6,border:`1px solid ${groupBy===k?'#2563eb':'#e2e8f0'}`,
              background:groupBy===k?'#eff6ff':'white',color:groupBy===k?'#2563eb':'#64748b',
              fontSize:11,fontWeight:groupBy===k?600:400,cursor:'pointer'}}>
            {l}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflowX:'auto',overflowY:'auto'}}>
        <table style={{borderCollapse:'collapse',width:'100%',minWidth:160+statusList.length*190}}>
          <thead>
            <tr>
              <th style={{width:160,padding:'10px 14px',background:'#f8fafc',borderBottom:'2px solid #e2e8f0',
                fontSize:11,fontWeight:700,color:'#94a3b8',textAlign:'left',position:'sticky',left:0,zIndex:2}}>
                {groupBy==='item_type'?'Work Item Type':groupBy==='level'?'Risk Level':groupBy==='category'?'Category':'Owner'}
              </th>
              {statusList.map(st=>{
                const col=tab==='risk'?RISK_STATUS_COLOR[st]:DEC_STATUS_COLOR[st];
                return (
                  <th key={st} style={{padding:'10px 12px',
                    borderBottom:`2px solid ${col}`,fontSize:11,fontWeight:700,
                    color:col,textAlign:'left',minWidth:180,position:'sticky',top:0,background:'white',zIndex:2}}>
                    {st}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowKeys.length===0 && (
              <tr><td colSpan={statusList.length+1} style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:12}}>
                No records yet
              </td></tr>
            )}
            {rowKeys.map((rowKey,ri)=>{
              const rowRecs = getRow(rowKey);
              const rowLabel = groupBy==='item_type'
                ? (rowKey==='—'?'Not linked':rowKey.charAt(0).toUpperCase()+rowKey.slice(1))
                : rowKey;
              const rowIcon = groupBy==='item_type'?ITEM_ICONS[rowKey]||'🔗':'';
              return (
                <tr key={rowKey} style={{background:ri%2===0?'white':'#fafafa'}}>
                  <td style={{padding:'10px 14px',borderBottom:'1px solid #f1f5f9',
                    position:'sticky',left:0,background:ri%2===0?'white':'#fafafa',
                    zIndex:1,borderRight:'1px solid #e2e8f0'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:16}}>{rowIcon}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:'#374151'}}>{rowLabel}</div>
                        <div style={{fontSize:10,color:'#94a3b8'}}>{rowRecs.length} record{rowRecs.length!==1?'s':''}</div>
                      </div>
                    </div>
                  </td>
                  {statusList.map(st=>{
                    const cellRecs = rowRecs.filter(r=>r.status===st);
                    const col = tab==='risk'?RISK_STATUS_COLOR[st]:DEC_STATUS_COLOR[st];
                    return (
                      <td key={st} style={{padding:8,borderBottom:'1px solid #f1f5f9',verticalAlign:'top',minWidth:180}}>
                        <div style={{display:'flex',flexDirection:'column',gap:5}}>
                          {cellRecs.map(r=>{
                            const rl = r.risk_level?RISK_LEVEL_STYLE[r.risk_level]:null;
                            return (
                              <div key={r.id} onClick={()=>onEdit(r)}
                                style={{background:'white',border:`1px solid ${rl?.border||'#e2e8f0'}`,
                                  borderLeft:`3px solid ${rl?.dot||col}`,borderRadius:7,
                                  padding:'7px 9px',cursor:'pointer'}}
                                onMouseEnter={e=>(e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)')}
                                onMouseLeave={e=>(e.currentTarget.style.boxShadow='none')}>
                                {r.risk_level&&(
                                  <div style={{fontSize:9,fontWeight:700,color:rl?.text,
                                    textTransform:'uppercase',marginBottom:3,letterSpacing:'0.05em'}}>
                                    {r.risk_level}
                                  </div>
                                )}
                                <div style={{fontSize:11,fontWeight:600,color:'#111827',marginBottom:3,lineHeight:1.3}}>
                                  {r.title}
                                </div>
                                {r.linked_item_title&&groupBy!=='item_type'&&(
                                  <div style={{fontSize:9,color:'#94a3b8'}}>
                                    {ITEM_ICONS[r.linked_item_type||'']||'→'} {r.linked_item_title}
                                  </div>
                                )}
                                {r.owner&&<div style={{fontSize:9,color:'#94a3b8',marginTop:2}}>👤 {r.owner}</div>}
                              </div>
                            );
                          })}
                          {cellRecs.length===0&&(
                            <div style={{height:36,border:'1px dashed #e2e8f0',borderRadius:6}}/>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── LIST VIEW ────────────────────────────────────────────────────────────────

function RiDeList({ records, tab, onEdit, onDelete }:
  { records:RiDeRecord[]; tab:'risk'|'decision'; onEdit:(r:RiDeRecord)=>void; onDelete:(id:string)=>void }) {
  const [sortCol,setSortCol]         = useState('raised_date');
  const [sortDir,setSortDir]         = useState<'asc'|'desc'>('desc');
  const [filterStatus,setFilterStatus] = useState('');
  const [filterLevel, setFilterLevel]  = useState('');

  const filtered = records.filter(r=>r.record_type===tab)
    .filter(r=>!filterStatus||r.status===filterStatus)
    .filter(r=>!filterLevel||r.risk_level===filterLevel);
  const sorted = [...filtered].sort((a,b)=>{
    const av=(a as any)[sortCol]||''; const bv=(b as any)[sortCol]||'';
    return sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av);
  });
  const toggleSort=(col:string)=>{
    if(sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc');
    else {setSortCol(col);setSortDir('asc');}
  };
  const Th=({col,label}:{col:string;label:string})=>(
    <th onClick={()=>toggleSort(col)} style={{padding:'8px 12px',background:'#f8fafc',
      borderBottom:'2px solid #e2e8f0',fontSize:11,fontWeight:700,
      color:sortCol===col?'#2563eb':'#64748b',textAlign:'left',
      cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}}>
      {label}{sortCol===col?(sortDir==='asc'?' ↑':' ↓'):''}
    </th>
  );

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',gap:8,padding:'8px 16px',borderBottom:'1px solid #f1f5f9',
        flexShrink:0,background:'#fafafa',flexWrap:'wrap',alignItems:'center'}}>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          style={{border:'1px solid #e2e8f0',borderRadius:6,padding:'4px 8px',fontSize:12,color:'#374151',background:'white'}}>
          <option value="">All Statuses</option>
          {(tab==='risk'?RISK_STATUSES:DECISION_STATUSES).map(s=><option key={s}>{s}</option>)}
        </select>
        {tab==='risk'&&(
          <select value={filterLevel} onChange={e=>setFilterLevel(e.target.value)}
            style={{border:'1px solid #e2e8f0',borderRadius:6,padding:'4px 8px',fontSize:12,color:'#374151',background:'white'}}>
            <option value="">All Risk Levels</option>
            {RISK_LEVELS.map(l=><option key={l}>{l}</option>)}
          </select>
        )}
        <span style={{marginLeft:'auto',fontSize:11,color:'#94a3b8'}}>
          {sorted.length} record{sorted.length!==1?'s':''}
        </span>
      </div>
      <div style={{flex:1,overflowX:'auto',overflowY:'auto'}}>
        <table style={{borderCollapse:'collapse',width:'100%',minWidth:700}}>
          <thead>
            <tr>
              <Th col="ref_key" label="Ref"/>
              <Th col="title"   label="Title"/>
              {tab==='risk'&&<Th col="risk_level"    label="Risk Level"/>}
              {tab==='risk'&&<Th col="risk_category"  label="Category"/>}
              {tab==='decision'&&<Th col="decision_type" label="Type"/>}
              <Th col="status"  label="Status"/>
              <Th col="owner"   label="Owner"/>
              <Th col="due_date" label="Due"/>
              <th style={{padding:'8px 12px',background:'#f8fafc',borderBottom:'2px solid #e2e8f0',width:50}}/>
            </tr>
          </thead>
          <tbody>
            {sorted.length===0&&(
              <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:12}}>
                No {tab==='risk'?'risks':'decisions'} yet — click + New to add one.
              </td></tr>
            )}
            {sorted.map((r,i)=>{
              const rl=r.risk_level?RISK_LEVEL_STYLE[r.risk_level]:null;
              const sc=tab==='risk'?RISK_STATUS_COLOR[r.status]:DEC_STATUS_COLOR[r.status];
              return (
                <tr key={r.id} onClick={()=>onEdit(r)}
                  style={{background:i%2===0?'white':'#fafafa',cursor:'pointer'}}
                  onMouseEnter={e=>(e.currentTarget.style.background='#eff6ff')}
                  onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?'white':'#fafafa')}>
                  <td style={{padding:'9px 12px',fontSize:11,color:'#94a3b8',borderBottom:'1px solid #f1f5f9',fontFamily:'monospace'}}>{r.ref_key||'—'}</td>
                  <td style={{padding:'9px 12px',fontSize:12,fontWeight:600,color:'#111827',borderBottom:'1px solid #f1f5f9',maxWidth:260}}>
                    <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</div>
                    {r.linked_item_title&&(
                      <div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>
                        {ITEM_ICONS[r.linked_item_type||'']||'→'} {r.linked_item_title}
                      </div>
                    )}
                  </td>
                  {tab==='risk'&&(
                    <td style={{padding:'9px 12px',borderBottom:'1px solid #f1f5f9'}}>
                      {rl&&<span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:999,
                        background:rl.bg,color:rl.text,border:`1px solid ${rl.border}`}}>{r.risk_level}</span>}
                    </td>
                  )}
                  {tab==='risk'&&(
                    <td style={{padding:'9px 12px',fontSize:11,color:'#64748b',borderBottom:'1px solid #f1f5f9'}}>{r.risk_category||'—'}</td>
                  )}
                  {tab==='decision'&&(
                    <td style={{padding:'9px 12px',fontSize:11,color:'#64748b',borderBottom:'1px solid #f1f5f9'}}>{r.decision_type||'—'}</td>
                  )}
                  <td style={{padding:'9px 12px',borderBottom:'1px solid #f1f5f9'}}>
                    <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:999,
                      background:`${sc}18`,color:sc,border:`1px solid ${sc}44`}}>{r.status}</span>
                  </td>
                  <td style={{padding:'9px 12px',fontSize:12,color:'#374151',borderBottom:'1px solid #f1f5f9'}}>{r.owner||'—'}</td>
                  <td style={{padding:'9px 12px',fontSize:11,color:'#94a3b8',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap'}}>{r.due_date||'—'}</td>
                  <td style={{padding:'9px 12px',borderBottom:'1px solid #f1f5f9'}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>onDelete(r.id)}
                      style={{border:'none',background:'none',cursor:'pointer',color:'#94a3b8',fontSize:13}}
                      title="Delete">🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SUMMARY BAR ─────────────────────────────────────────────────────────────

function SummaryBar({ records }: { records:RiDeRecord[] }) {
  const risks = records.filter(r=>r.record_type==='risk');
  const decs  = records.filter(r=>r.record_type==='decision');
  return (
    <div style={{display:'flex',gap:8,padding:'8px 16px',background:'#f8fafc',
      borderBottom:'1px solid #e2e8f0',flexShrink:0,flexWrap:'wrap',alignItems:'center'}}>
      {RISK_LEVELS.map(l=>{
        const st=RISK_LEVEL_STYLE[l];
        const cnt=risks.filter(r=>r.risk_level===l).length;
        return (
          <div key={l} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',
            background:st.bg,border:`1px solid ${st.border}`,borderRadius:7}}>
            <span style={{width:7,height:7,borderRadius:'50%',background:st.dot,display:'inline-block'}}/>
            <span style={{fontSize:11,fontWeight:600,color:st.text}}>{l}</span>
            <span style={{fontSize:13,fontWeight:800,color:st.text}}>{cnt}</span>
          </div>
        );
      })}
      <div style={{width:1,background:'#e2e8f0',margin:'0 4px'}}/>
      <span style={{fontSize:11,color:'#64748b'}}>
        <span style={{fontWeight:700,color:'#dc2626'}}>{risks.filter(r=>['Open','In Treatment','Escalated'].includes(r.status)).length}</span> open risks
      </span>
      <span style={{fontSize:11,color:'#64748b'}}>
        <span style={{fontWeight:700,color:'#f59e0b'}}>{decs.filter(r=>['Proposed','Under Review'].includes(r.status)).length}</span> pending decisions
      </span>
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function RiDeIntel({ tenantId, loggedUser, isViewer=false, workItems=[] }: {
  tenantId:string|null; loggedUser:string; isViewer?:boolean; workItems?:any[];
}) {
  const [records, setRecords] = useState<RiDeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'risk'|'decision'>('risk');
  const [viewMode,setViewMode]= useState<'list'|'board'>('list');
  const [form,    setForm]    = useState<{record:Partial<RiDeRecord>|null;type:'risk'|'decision'}|null>(null);
  const [delId,   setDelId]   = useState<string|null>(null);

  const load = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('ride_intel')
      .select('*').eq('tenant_id',tenantId).order('created_at',{ascending:false});
    const enriched = (data||[]).map((r:any) => {
      const wi = workItems.find(i=>i.id===r.linked_item_id);
      if (wi) { r.linked_item_title=wi.title; r.linked_item_type=wi.type; }
      return r as RiDeRecord;
    });
    setRecords(enriched);
    setLoading(false);
  }, [tenantId, workItems]);

  useEffect(()=>{ load(); },[load]);

  const handleSave=(r:RiDeRecord)=>{
    const wi = workItems.find(i=>i.id===r.linked_item_id);
    const enriched = {...r, linked_item_title:wi?.title, linked_item_type:wi?.type};
    setRecords(p=>p.find(x=>x.id===r.id)?p.map(x=>x.id===r.id?enriched:x):[enriched,...p]);
    setForm(null);
  };

  const handleDelete=async(id:string)=>{
    await supabase.from('ride_intel').delete().eq('id',id);
    setRecords(p=>p.filter(r=>r.id!==id));
    setDelId(null);
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',
      fontFamily:'system-ui,sans-serif',fontSize:13}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',
        borderBottom:'1px solid #e2e8f0',flexShrink:0,background:'white',flexWrap:'wrap'}}>
        {/* Tabs */}
        <div style={{display:'flex',background:'#f1f5f9',borderRadius:8,padding:2,gap:1}}>
          {(['risk','decision'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{padding:'5px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,
                fontWeight:tab===t?700:400,background:tab===t?'white':'transparent',
                color:tab===t?(t==='risk'?'#dc2626':'#6366f1'):'#64748b',
                boxShadow:tab===t?'0 1px 3px rgba(0,0,0,0.1)':'none'}}>
              {t==='risk'?'⚡ Risk Register':'🎯 Decision Log'}
              <span style={{marginLeft:5,fontSize:10,fontWeight:700,
                background:tab===t?(t==='risk'?'#fef2f2':'#eef2ff'):'#e2e8f0',
                color:tab===t?(t==='risk'?'#dc2626':'#6366f1'):'#94a3b8',
                padding:'1px 5px',borderRadius:999}}>
                {records.filter(r=>r.record_type===t).length}
              </span>
            </button>
          ))}
        </div>
        {/* View mode */}
        <div style={{display:'flex',background:'#f1f5f9',borderRadius:7,padding:2,gap:1}}>
          {([['list','📋 List'],['board','🗂️ Board']] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setViewMode(v)}
              style={{padding:'4px 10px',borderRadius:5,border:'none',cursor:'pointer',fontSize:11,
                fontWeight:viewMode===v?700:400,background:viewMode===v?'white':'transparent',
                color:viewMode===v?'#2563eb':'#64748b',
                boxShadow:viewMode===v?'0 1px 3px rgba(0,0,0,0.1)':'none'}}>
              {l}
            </button>
          ))}
        </div>
        {!isViewer&&(
          <button onClick={()=>setForm({record:null,type:tab})}
            style={{marginLeft:'auto',padding:'6px 14px',borderRadius:8,border:'none',
              background:tab==='risk'?'#dc2626':'#6366f1',
              color:'white',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            + New {tab==='risk'?'Risk':'Decision'}
          </button>
        )}
      </div>

      <SummaryBar records={records}/>

      {loading?(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8'}}>Loading…</div>
      ):viewMode==='list'?(
        <RiDeList records={records} tab={tab}
          onEdit={r=>setForm({record:r,type:r.record_type})}
          onDelete={id=>setDelId(id)}/>
      ):(
        <RiDeBoard records={records} tab={tab} workItems={workItems}
          onEdit={r=>setForm({record:r,type:r.record_type})}/>
      )}

      {form&&tenantId&&(
        <RecordForm record={form.record} type={form.type}
          tenantId={tenantId} loggedUser={loggedUser} workItems={workItems}
          onSave={handleSave} onClose={()=>setForm(null)}/>
      )}

      {delId&&(
        <div style={{position:'fixed',inset:0,zIndex:70,display:'flex',alignItems:'center',
          justifyContent:'center',background:'rgba(0,0,0,0.4)'}} onClick={()=>setDelId(null)}>
          <div style={{background:'white',borderRadius:14,padding:24,maxWidth:360,width:'90%'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>Delete Record?</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:18}}>This cannot be undone.</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setDelId(null)}
                style={{padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',fontSize:12,cursor:'pointer'}}>Cancel</button>
              <button onClick={()=>handleDelete(delId)}
                style={{padding:'7px 14px',borderRadius:7,border:'none',background:'#dc2626',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
