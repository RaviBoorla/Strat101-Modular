// ─── SHARED UTILITIES ────────────────────────────────────────────────────────
// All variable names and definitions preserved exactly from strat101App_v24.tsx

import { TC, TL } from '../constants';

export const gId   = () => Math.random().toString(36).slice(2,9);
export const td    = () => new Date().toISOString().split('T')[0];
export const tsNow = () => new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
export const gKey  = (t: string, items: any[]) => `${TC[t].p}-${String(items.filter((i:any)=>i.type===t).length+1).padStart(4,'0')}`;

export const mkBlank = (t: string, items: any[]) => ({
  id:gId(), key:gKey(t,items), type:t, title:'', description:'',
  currentStatus:'', currentStatusAt:'',
  riskStatement:'',
  status:'Draft', priority:'Medium', health:'Green', risk:'Low', impact:'', impactType:'',
  owner:'', assigned:'', sponsor:'', businessUnit:'',
  approvedBudget:'', actualCost:'',
  startDate:td(), endDate:'', progress:0, tags:[],
  links:[], dependencies:[], attachments:[], keyResult:'',
  comments:[],
  updatedAt:tsNow(), updatedBy:'RB',
});

export function fuzzyScore(item: any, q: string): number {
  if(!q.trim()) return 1;
  q=q.toLowerCase().trim();
  const hay=[item.title,item.key,item.owner,TC[item.type]?.l,...(item.tags||[])].filter(Boolean).join(' ').toLowerCase();
  let qi=0,score=0;
  for(let i=0;i<hay.length&&qi<q.length;i++){if(hay[i]===q[qi]){score+=qi===0?4:1;qi++;}}
  if(qi<q.length) return 0;
  if(item.title?.toLowerCase().startsWith(q)) score+=12;
  if(item.key?.toLowerCase()===q) score+=20;
  return score;
}

export const PRIORITY_ORDER: Record<string,number> = {Critical:0,High:1,Medium:2,Low:3};
export const HEALTH_ORDER:   Record<string,number> = {Red:0,Amber:1,Green:2};
export const RISK_ORDER:     Record<string,number> = {High:0,Medium:1,Low:2};
export const STATUS_ORDER:   Record<string,number> = {'In Progress':0,Draft:1,'On Hold':2,Completed:3,Cancelled:4};

export function sortItems(rows: any[], col: string, dir: string): any[] {
  const m=dir==='asc'?1:-1;
  return [...rows].sort((a,b)=>{
    let av: any, bv: any;
    if(col==='key'){av=a.key||'';bv=b.key||'';}
    else if(col==='title'){av=a.title||'';bv=b.title||'';}
    else if(col==='status'){av=STATUS_ORDER[a.status]??99;bv=STATUS_ORDER[b.status]??99;return m*(av-bv);}
    else if(col==='priority'){av=PRIORITY_ORDER[a.priority]??99;bv=PRIORITY_ORDER[b.priority]??99;return m*(av-bv);}
    else if(col==='health'){av=HEALTH_ORDER[a.health]??99;bv=HEALTH_ORDER[b.health]??99;return m*(av-bv);}
    else if(col==='risk'){av=RISK_ORDER[a.risk]??99;bv=RISK_ORDER[b.risk]??99;return m*(av-bv);}
    else if(col==='progress'){av=a.progress??0;bv=b.progress??0;return m*(av-bv);}
    else if(col==='endDate'){av=a.endDate||'9999';bv=b.endDate||'9999';}
    else if(col==='owner'){av=a.owner||'';bv=b.owner||'';}
    else if(col==='type'){av=TL[a.type]??99;bv=TL[b.type]??99;return m*(av-bv);}
    else{av='';bv='';}
    return m*av.localeCompare(bv);
  });
}
