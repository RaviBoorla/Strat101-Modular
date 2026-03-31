// ─── SHARED CONSTANTS ────────────────────────────────────────────────────────
// All variable names and definitions preserved exactly from strat101App_v24.tsx

export const AI_ENDPOINT = "https://api.anthropic.com/v1/messages";

export const SUGGESTED = [
  "Summarise the overall portfolio health and highlight any Red or Amber items",
  "Which items are at Critical priority and still In Progress?",
  "What are the top risks across the portfolio and which items carry them?",
];

export const TYPES = ['vision','mission','goal','okr','kr','initiative','program','project','task','subtask'];

export const TL: Record<string,number> = {
  vision:0,mission:1,goal:2,okr:3,kr:4,initiative:5,program:6,project:7,task:8,subtask:9,
};

export const TC: Record<string,{l:string;i:string;bg:string;tc:string;b:string;p:string}> = {
  vision:    {l:'Vision',    i:'🔭',bg:'bg-purple-50',tc:'text-purple-700',b:'border-purple-300',p:'V'  },
  mission:   {l:'Mission',   i:'🎯',bg:'bg-indigo-50',tc:'text-indigo-700',b:'border-indigo-300',p:'M'  },
  goal:      {l:'Goal',      i:'🏆',bg:'bg-violet-50',tc:'text-violet-700',b:'border-violet-300',p:'G'  },
  okr:       {l:'OKR',       i:'📊',bg:'bg-blue-50',  tc:'text-blue-700',  b:'border-blue-300',  p:'O'  },
  kr:        {l:'Key Result',i:'🔑',bg:'bg-sky-50',   tc:'text-sky-700',   b:'border-sky-300',   p:'KR' },
  initiative:{l:'Initiative',i:'🚀',bg:'bg-cyan-50',  tc:'text-cyan-700',  b:'border-cyan-300',  p:'I'  },
  program:   {l:'Program',   i:'📁',bg:'bg-teal-50',  tc:'text-teal-700',  b:'border-teal-300',  p:'PR' },
  project:   {l:'Project',   i:'📋',bg:'bg-green-50', tc:'text-green-700', b:'border-green-300', p:'PJ' },
  task:      {l:'Task',      i:'✅',bg:'bg-amber-50', tc:'text-amber-700', b:'border-amber-300', p:'T'  },
  subtask:   {l:'Subtask',   i:'🔸',bg:'bg-orange-50',tc:'text-orange-700',b:'border-orange-300',p:'ST' },
};

export const STATS  = ['Draft','In Progress','On Hold','Completed','Cancelled'];
export const PRIS   = ['Critical','High','Medium','Low'];
export const HLTHS  = ['Green','Amber','Red'];
export const RSKS   = ['High','Medium','Low'];
export const IMPACT_TYPES = ['','Revenue','Cost','Risk Mitigation'];
export const SPONSOR_TYPES = new Set(['vision','mission','goal','initiative','program','project']);

export const SC: Record<string,string> = {
  'Draft':'bg-gray-100 text-gray-600',
  'In Progress':'bg-yellow-100 text-yellow-700',
  'On Hold':'bg-orange-100 text-orange-700',
  'Completed':'bg-green-100 text-green-700',
  'Cancelled':'bg-red-100 text-red-600',
};
export const PC: Record<string,string> = {
  'Critical':'text-red-600','High':'text-orange-500','Medium':'text-yellow-600','Low':'text-green-600',
};
export const HIC: Record<string,string> = {'Green':'🟢','Amber':'🟡','Red':'🔴'};
export const RC: Record<string,string>  = {'High':'text-red-600','Medium':'text-amber-600','Low':'text-green-600'};

export const ALL_FIELDS = [
  {k:'key',l:'Key'},{k:'title',l:'Title'},{k:'type',l:'Work Item'},{k:'status',l:'Status'},
  {k:'priority',l:'Priority'},{k:'health',l:'Health'},{k:'risk',l:'Risk'},
  {k:'description',l:'Description'},
  {k:'riskStatement',l:'Risk Statement'},{k:'impact',l:'Impact'},{k:'impactType',l:'Impact Type'},
  {k:'currentStatus',l:'Current Status'},{k:'currentStatusAt',l:'Status Updated'},
  {k:'keyResult',l:'Key Results'},
  {k:'owner',l:'Owner'},{k:'assigned',l:'Assigned'},
  {k:'sponsor',l:'Sponsor'},{k:'businessUnit',l:'Business Unit'},
  {k:'approvedBudget',l:'Approved Budget'},{k:'actualCost',l:'Actual Cost'},
  {k:'startDate',l:'Start Date'},{k:'endDate',l:'End Date'},{k:'progress',l:'Progress'},{k:'tags',l:'Tags'},
  {k:'updatedAt',l:'Updated'},{k:'updatedBy',l:'Updated By'},
];

export const FIELD_DEFS = [
  {k:'badge',l:'Type Badge'},{k:'key',l:'Item Key'},{k:'status',l:'Status'},
  {k:'currentStatus',l:'Current Status'},{k:'description',l:'Description'},
  {k:'health',l:'Health'},{k:'priority',l:'Priority'},{k:'risk',l:'Risk'},
  {k:'riskStatement',l:'Risk Statement'},{k:'keyResult',l:'Key Results'},
  {k:'impact',l:'Impact'},{k:'impactType',l:'Impact Type'},
  {k:'owner',l:'Owner'},{k:'assigned',l:'Assigned'},
  {k:'sponsor',l:'Sponsor'},{k:'businessUnit',l:'Business Unit'},
  {k:'approvedBudget',l:'Budget (£)'},{k:'actualCost',l:'Actual Cost (£)'},
  {k:'startDate',l:'Start Date'},{k:'endDate',l:'Due Date'},
  {k:'progress',l:'Progress'},{k:'tags',l:'Tags'},
];

export const ALL_VIS_FIELDS     = new Set(FIELD_DEFS.map(f=>f.k));
export const DEFAULT_VIS_FIELDS = new Set([
  'badge','key','status','currentStatus','health','priority','risk','endDate','owner','tags'
]);

// Work item types for Create+ and Work Items nav (spec: Vision,Mission,Goal,Program,Project,Task,Subtask)
export const WORK_ITEM_TYPES = ['vision','mission','goal','okr','initiative','program','project','task','subtask'];

export const SEED: any[] = [];
