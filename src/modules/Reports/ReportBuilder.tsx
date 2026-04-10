import React, { useState } from "react";
import { useResponsive } from "../../hooks/useResponsive";
import { TC, SC, PC, HIC, RC, TYPES, ALL_FIELDS } from "../../constants";
import { td } from "../../utils";

// ─── EXPORT HELPERS ───────────────────────────────────────────────────────────
export function downloadCSV(result: any, grpBy: string) {
  let csv = '';
  if(result.type==='list'){
    csv = result.cols.map((c: any) => `"${c.l}"`).join(',') + '\n';
    csv += result.rows.map((row: any) => result.cols.map((c: any) => {
      const v = c.k==='type' ? (TC[row.type]?.l||row.type) : c.k==='tags' ? (row.tags||[]).join(';') : (row[c.k]??'');
      return `"${String(v).replace(/"/g,'""')}"`;
    }).join(',')).join('\n');
  } else {
    csv = `"${grpBy}","Count","Percentage"\n`;
    csv += Object.entries(result.data).sort(([,a]: any,[,b]: any) => (b as number)-(a as number)).map(([k,v]: any) => `"${k}",${v},"${Math.round(v/result.total*100)}%"`).join('\n');
  }
  const encoded = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  const a = document.createElement('a');
  a.href = encoded;
  a.download = `strataglin-report-${td()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function openPDF(result: any, rtype: string, grpBy: string) {
  let bodyHtml = '';
  if(result.type==='list'){
    const hdr = result.cols.map((c: any) => `<th>${c.l}</th>`).join('');
    const rows = result.rows.map((row: any) => `<tr>${result.cols.map((c: any) => {
      const v = c.k==='type' ? (TC[row.type]?.l||row.type)
        : c.k==='health' ? `${HIC[row.health]||''} ${row.health||''}`
        : c.k==='tags' ? (row.tags||[]).join(', ')
        : c.k==='approvedBudget'||c.k==='actualCost' ? (row[c.k] ? `£${Number(row[c.k]).toLocaleString()}` : '—')
        : c.k==='description'||(c.k==='riskStatement')||(c.k==='keyResult') ? (row[c.k]||'—')
        : (row[c.k]??'—');
      return `<td>${v}</td>`;
    }).join('')}</tr>`).join('');
    bodyHtml = `<table><thead><tr>${hdr}</tr></thead><tbody>${rows}</tbody></table>`;
  } else {
    const bclr = (k: string) => k==='Red'||k==='High'||k==='Critical'||k==='Cancelled' ? '#ef4444'
      : k==='Amber'||k==='Medium'||k==='On Hold' ? '#f59e0b'
      : k==='Green'||k==='Low'||k==='Completed' ? '#22c55e' : '#3b82f6';
    const maxV = Math.max(...Object.values(result.data) as number[], 1);
    const bars = Object.entries(result.data).sort(([,a]: any,[,b]: any) => (b as number)-(a as number)).map(([k,v]: any) =>
      `<tr><td style="text-align:right;padding-right:12px;font-weight:600;white-space:nowrap">${k}</td><td style="width:100%"><div style="display:flex;align-items:center;gap:8px"><div style="background:#e5e7eb;border-radius:4px;flex:1;height:22px;overflow:hidden"><div style="width:${Math.max(v/maxV*100,5)}%;background:${bclr(k)};height:100%;border-radius:4px;display:flex;align-items:center;padding-left:8px;color:white;font-size:12px;font-weight:700">${v}</div></div><span style="white-space:nowrap;font-size:12px;color:#6b7280">${Math.round(v/result.total*100)}%</span></div></td></tr>`
    ).join('');
    bodyHtml = `<h3 style="margin-bottom:16px;color:#374151">Grouped by: <em>${grpBy}</em> | Total: <strong>${result.total}</strong></h3><table style="width:100%"><tbody>${bars}</tbody></table>`;
  }
  const rtypeLabel = rtype==='list' ? '📋 List Report' : rtype==='count' ? '🔢 Count Report' : '📊 Histogram Report';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Strat101.com Report</title><style>*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;padding:32px;color:#1f2937}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #87ceeb;padding-bottom:16px;margin-bottom:24px}.logo{font-size:22px;font-weight:900;color:#0c2d4a}.subtitle{font-size:13px;color:#6b7280;margin-top:4px}.meta{text-align:right;font-size:12px;color:#6b7280}.rtype{font-size:16px;font-weight:700;color:#111827;margin-bottom:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left;font-size:12px}th{background:#f0f9ff;font-weight:600;color:#0c2d4a;text-transform:uppercase;font-size:11px;letter-spacing:.04em}tr:nth-child(even)td{background:#f9fafb}.no-print{margin-top:24px;text-align:center}button{background:#0c2d4a;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600}button:hover{background:#1a5276}@media print{.no-print{display:none}body{padding:16px}}</style></head><body><div class="header"><div><div class="logo">SA Strat101.com</div><div class="subtitle">Strategy Execution · Report Export</div></div><div class="meta">Generated: ${new Date().toLocaleString()}</div></div><div class="rtype">${rtypeLabel}</div>${bodyHtml}<div class="no-print"><button onclick="window.print()">🖨️ Print / Save as PDF</button></div></body></html>`;
  const w = window.open('','_blank');
  if(w){ w.document.write(html); w.document.close(); }
  else {
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    window.open(url,'_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

// ─── REPORT RESULTS ───────────────────────────────────────────────────────────
interface ReportResultsProps {
  result: any;
  grpBy: string;
}

export function ReportResults({ result, grpBy }: ReportResultsProps) {
  const PASTEL = ['#f9a8d4','#fca5a5','#fdba74','#fde68a','#bbf7d0','#a7f3d0','#6ee7b7','#93c5fd','#c4b5fd','#f0abfc','#86efac','#fcd34d'];
  const pastelFor = (k: string, idx: number) => {
    if(k==='Red'||k==='Critical'||k==='Cancelled') return '#fca5a5';
    if(k==='Amber'||k==='On Hold') return '#fde68a';
    if(k==='Green'||k==='Completed') return '#bbf7d0';
    if(k==='High') return '#fdba74';
    if(k==='Medium') return '#fde68a';
    if(k==='Low') return '#a7f3d0';
    if(k==='In Progress') return '#93c5fd';
    if(k==='Draft') return '#e9d5ff';
    if(k==='Revenue') return '#bbf7d0';
    if(k==='Cost') return '#fca5a5';
    if(k==='Risk Mitigation') return '#93c5fd';
    return PASTEL[idx % PASTEL.length];
  };
  const darkText = (hex: string) => {
    const m = hex.match(/[\da-f]{2}/gi);
    if(!m) return '#374151';
    const [r,g,b] = m.map(x => parseInt(x,16));
    return (0.299*r + 0.587*g + 0.114*b)/255 > 0.6 ? '#374151' : '#1f2937';
  };

  if(result.type==='list') return (
    <div style={{ background:'white', borderRadius:10, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.05)', overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ fontSize:11, borderCollapse:'collapse', width:'100%', minWidth:'max-content' }}>
          <thead><tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
            {result.cols.map((c: any) => <th key={c.k} style={{ padding:'8px 12px', textAlign:'left', color:'#374151', fontWeight:600, textTransform:'uppercase', fontSize:10, whiteSpace:'nowrap' }}>{c.l}</th>)}
          </tr></thead>
          <tbody>{result.rows.map((row: any, i: number) => (
            <tr key={row.id} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'white':'#f8fafc' }}>
              {result.cols.map((c: any) => (
                <td key={c.k} style={{ padding:'7px 12px', color:'#374151', maxWidth:160 }}>
                  {c.k==='type' ? <span>{TC[row.type]?.i} {TC[row.type]?.l}</span>
                  : c.k==='status' ? <span className={`px-1.5 py-0.5 rounded-full ${SC[row.status]||''}`} style={{ fontSize:10 }}>{row.status}</span>
                  : c.k==='health' ? <span>{HIC[row.health]} {row.health}</span>
                  : c.k==='priority' ? <span className={`font-semibold ${PC[row.priority]||''}`}>{row.priority||'—'}</span>
                  : c.k==='risk' ? <span className={`font-semibold ${RC[row.risk]||''}`}>{row.risk||'—'}</span>
                  : c.k==='impactType' ? <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:999, background:row.impactType==='Revenue'?'#dcfce7':row.impactType==='Cost'?'#fee2e2':row.impactType?'#dbeafe':'#f1f5f9', color:row.impactType==='Revenue'?'#15803d':row.impactType==='Cost'?'#dc2626':row.impactType?'#1d4ed8':'#9ca3af' }}>{row.impactType||'—'}</span>
                  : c.k==='approvedBudget'||c.k==='actualCost' ? <span style={{ fontFamily:'monospace' }}>{row[c.k] ? `£${Number(row[c.k]).toLocaleString()}` : '—'}</span>
                  : c.k==='progress' ? <div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ background:'#e2e8f0', borderRadius:999, width:50, height:4 }}><div style={{ background:'#60a5fa', borderRadius:999, height:'100%', width:`${row.progress}%` }}/></div><span>{row.progress}%</span></div>
                  : c.k==='tags' ? <span>{(row.tags||[]).join(', ')||'—'}</span>
                  : c.k==='currentStatus' ? <div><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>{row.currentStatus||'—'}</div>{row.currentStatusAt && <div style={{ fontSize:9, color:'#9ca3af' }}>{row.currentStatusAt}</div>}</div>
                  : c.k==='currentStatusAt' ? <span style={{ fontFamily:'monospace', fontSize:10 }}>{row.currentStatusAt||'—'}</span>
                  : c.k==='description' ? <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', maxWidth:200 }}>{row.description||'—'}</span>
                  : c.k==='keyResult' ? <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', maxWidth:200 }}>{row.keyResult||'—'}</span>
                  : c.k==='updatedAt' ? <span style={{ fontFamily:'monospace', fontSize:10 }}>{row.updatedAt||'—'}</span>
                  : <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', maxWidth:160 }}>{row[c.k]||'—'}</span>}
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );

  if(result.type==='count') return (
    <div style={{ background:'white', borderRadius:10, border:'1px solid #e2e8f0', padding:12, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {Object.entries(result.data).sort(([,a]: any,[,b]: any) => (b as number)-(a as number)).map(([k,v]: any, i: number) => {
          const bg = pastelFor(k, i);
          return (
            <div key={k} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:10, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', background:bg }}>
              <div style={{ fontWeight:900, color:darkText(bg), fontSize:26 }}>{v}</div>
              <div style={{ fontWeight:600, color:darkText(bg), fontSize:11, marginTop:2 }}>{k}</div>
              <div style={{ color:darkText(bg), opacity:0.65, fontSize:10, marginTop:1 }}>{Math.round(v/result.total*100)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if(result.type==='histogram') return (
    <div style={{ background:'white', borderRadius:10, border:'1px solid #e2e8f0', padding:14, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {Object.entries(result.data).sort(([,a]: any,[,b]: any) => (b as number)-(a as number)).map(([k,v]: any, i: number) => {
          const bg = pastelFor(k, i);
          return (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#374151', textAlign:'right', width:100, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k}</div>
              <div style={{ flex:1, background:'#f1f5f9', borderRadius:99, overflow:'hidden', height:26 }}>
                <div style={{ width:`${Math.max(v/result.max*100,5)}%`, background:bg, height:'100%', borderRadius:99, display:'flex', alignItems:'center', paddingLeft:10, transition:'width 0.3s' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:darkText(bg) }}>{v}</span>
                </div>
              </div>
              <div style={{ fontSize:11, fontWeight:600, color:'#64748b', width:36, textAlign:'right', flexShrink:0 }}>{Math.round(v/result.total*100)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return null;
}

// ─── REPORT BUILDER ───────────────────────────────────────────────────────────
interface ReportBuilderProps {
  items: any[];
  enabledTypes?: string[];
}

export default function ReportBuilder({ items, enabledTypes }: ReportBuilderProps) {
  const ALL_ITEM_TYPES = ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask'];
  const activeTypes = (enabledTypes && enabledTypes.length > 0) ? enabledTypes : ALL_ITEM_TYPES;
  const { isMobile } = useResponsive();
  const [rtype, setRtype] = useState('histogram');
  const [types, setTypes] = useState(new Set(activeTypes));
  const [flds, setFlds] = useState(new Set(['key','title','type','status','priority','health','risk','riskStatement','owner','progress','currentStatus']));
  const [grpBy, setGrpBy] = useState('status');
  const [result, setResult] = useState<any>(null);

  const togT = (t: string) => { setTypes(s => { const n=new Set(s); n.has(t)?n.delete(t):n.add(t); return n; }); setResult(null); };
  const togF = (f: string) => { setFlds(s => { const n=new Set(s); n.has(f)?n.delete(f):n.add(f); return n; }); setResult(null); };

  const run = () => {
    const filtered = items.filter(i => types.has(i.type));
    if(rtype==='list'){ setResult({type:'list', cols:ALL_FIELDS.filter(f => flds.has(f.k)), rows:filtered}); }
    else {
      const grp: Record<string,number> = {};
      filtered.forEach(i => {
        const val = grpBy==='type' ? (TC[i.type]?.l||i.type)
          : grpBy==='impactType' ? (i.impactType||'Not Set')
          : (i[grpBy]||'Unknown');
        grp[val] = (grp[val]||0) + 1;
      });
      setResult({type:rtype, data:grp, max:Math.max(...Object.values(grp), 1), total:filtered.length});
    }
  };

  const SLbl = ({children}: {children: React.ReactNode}) => (
    <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#111827', marginBottom:4 }}>{children}</div>
  );

  return (
    <div style={{ display:'flex', flexDirection:isMobile?'column':'row', height:'100%', overflow:isMobile?'auto':'hidden', background:'#f1f5f9' }}>
      {/* LEFT CONFIG PANEL */}
      <div style={{ width:isMobile?'100%':264, flexShrink:0, borderRight:isMobile?'none':'1px solid #e2e8f0', borderBottom:isMobile?'1px solid #e2e8f0':'none', background:'white', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'9px 11px', borderBottom:'1px solid #e2e8f0', background:'#a3bbff', flexShrink:0 }}>
          <div style={{ fontWeight:700, fontSize:12, color:'#0c2040' }}>📈 Report Builder</div>
          <div style={{ fontSize:10, color:'#1a3a6e', marginTop:1 }}>Configure and generate</div>
        </div>
        <div style={{ flex:isMobile?'none':1, maxHeight:isMobile?220:undefined, overflowY:'auto', padding:'9px 11px', display:'flex', flexDirection:'column', gap:9 }}>
          {/* Report Type */}
          <div>
            <SLbl>Report Type</SLbl>
            <div style={{ display:'flex', gap:4 }}>
              {[['list','📋','List'],['count','🔢','Count'],['histogram','📊','Histogram']].map(([v,ico,l]) => (
                <button key={v} onClick={() => { setRtype(v); setResult(null); }}
                  style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1, padding:'5px 2px', borderRadius:6, border:'1px solid', cursor:'pointer', transition:'all 0.12s',
                    borderColor:rtype===v?'#818cf8':'#e2e8f0', background:rtype===v?'#eef2ff':'#f8fafc' }}>
                  <span style={{ fontSize:14 }}>{ico}</span>
                  <span style={{ fontSize:10, fontWeight:600, color:rtype===v?'#4338ca':'#374151' }}>{l}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Work Items */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
              <SLbl>Work Items</SLbl>
              <button onClick={() => { setTypes(new Set(activeTypes)); setResult(null); }} style={{ fontSize:10, color:'#2563eb', background:'none', border:'none', cursor:'pointer', fontWeight:600, padding:0 }}>All</button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
              {activeTypes.map(t => (
                <button key={t} onClick={() => togT(t)}
                  style={{ padding:'2px 6px', borderRadius:5, border:'1px solid', fontSize:10, cursor:'pointer', fontWeight:500, transition:'all 0.1s',
                    ...(types.has(t) ? {background:'#eff6ff',borderColor:'#93c5fd',color:'#1d4ed8'} : {background:'#f8fafc',borderColor:'#e2e8f0',color:'#94a3b8'}) }}>
                  {TC[t].i} {TC[t].l}
                </button>
              ))}
            </div>
          </div>
          {/* Columns to Show */}
          {rtype==='list' && (
            <div>
              <SLbl>Columns to Show</SLbl>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                {ALL_FIELDS.map(f => (
                  <button key={f.k} onClick={() => togF(f.k)}
                    style={{ padding:'2px 6px', borderRadius:5, border:'1px solid', fontSize:10, cursor:'pointer', fontWeight:500, transition:'all 0.1s',
                      ...(flds.has(f.k) ? {background:'#eff6ff',borderColor:'#93c5fd',color:'#1d4ed8'} : {background:'#f8fafc',borderColor:'#e2e8f0',color:'#94a3b8'}) }}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Group By */}
          {rtype!=='list' && (
            <div>
              <SLbl>Group By</SLbl>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                {['status','priority','health','risk','type','impactType','businessUnit','assigned','owner'].map(g => (
                  <button key={g} onClick={() => { setGrpBy(g); setResult(null); }}
                    style={{ padding:'2px 6px', borderRadius:5, border:'1px solid', fontSize:10, cursor:'pointer', fontWeight:500, transition:'all 0.1s',
                      ...(grpBy===g ? {background:'#eff6ff',borderColor:'#93c5fd',color:'#1d4ed8'} : {background:'#f8fafc',borderColor:'#e2e8f0',color:'#94a3b8'}) }}>
                    {g==='type'?'Work Item':g==='impactType'?'Impact Type':g==='businessUnit'?'Biz Unit':g.charAt(0).toUpperCase()+g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:'9px 11px', borderTop:'1px solid #e2e8f0', background:'white', flexShrink:0 }}>
          <button onClick={run}
            style={{ width:'100%', padding:'8px', borderRadius:7, border:'none', cursor:'pointer', background:'linear-gradient(135deg,#4338ca,#2563eb)', color:'white', fontSize:12, fontWeight:700, boxShadow:'0 2px 5px rgba(67,56,202,0.3)' }}>
            ▶ Generate Report
          </button>
        </div>
      </div>

      {/* RIGHT RESULTS PANEL */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:isMobile?'visible':'hidden', minWidth:0 }}>
        <div style={{ padding:'8px 14px', borderBottom:'1px solid #e2e8f0', background:'white', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#374151' }}>
            {result
              ? result.type==='list'
                ? `📋 ${result.rows.length} items`
                : `${result.type==='count'?'🔢':'📊'} ${result.total} items · grouped by ${grpBy==='type'?'Work Item':grpBy==='impactType'?'Impact Type':grpBy}`
              : <span style={{ color:'#94a3b8' }}>Configure options and click Generate Report →</span>}
          </div>
          {result && (
            <div style={{ display:'flex', gap:7 }}>
              <button onClick={() => downloadCSV(result, grpBy)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', background:'#16a34a', color:'white', border:'none', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                ⬇ CSV
              </button>
              <button onClick={() => openPDF(result, rtype, grpBy)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', background:'#dc2626', color:'white', border:'none', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                🖨 PDF
              </button>
            </div>
          )}
        </div>
        <div style={{ flex:1, overflow:'auto', padding:result?'12px 14px':'0', minWidth:0 }}>
          {!result ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%' }}>
              <div style={{ fontSize:52, marginBottom:14 }}>📊</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#64748b', marginBottom:6 }}>No report generated yet</div>
              <div style={{ fontSize:12, color:'#94a3b8', textAlign:'center', maxWidth:300, lineHeight:1.6 }}>Configure report type, work items, and grouping on the left, then click Generate Report.</div>
            </div>
          ) : (
            <ReportResults result={result} grpBy={grpBy}/>
          )}
        </div>
      </div>
    </div>
  );
}
