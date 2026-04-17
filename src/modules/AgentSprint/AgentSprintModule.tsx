import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { gId, td } from '../../utils';
import { TC } from '../../constants';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type AgentSprintStatus = 'planning' | 'active' | 'review' | 'shipped' | 'cancelled';
export type AgentItemSubtype  = 'outcome' | 'constraint' | 'decision' | 'experiment';
export type ValidationStatus  = 'pending' | 'generated' | 'tests_passing' | 'in_review' | 'approved' | 'shipped';
export type AgentToolId       = 'claude-code' | 'cursor' | 'copilot' | 'gemini' | 'human' | 'other';

export interface AgentSprint {
  id:         string;
  tenant_id:  string;
  name:       string;
  goal:       string;
  start_date: string | null;
  end_date:   string | null;
  status:     AgentSprintStatus;
  created_at: string;
  created_by: string;
}

export interface AgentSprintItem {
  id:                  string;
  tenant_id:           string;
  agent_sprint_id:     string | null;
  linked_work_item_id: string | null;
  title:               string;
  outcome_description: string;
  acceptance_criteria: string;
  item_subtype:        AgentItemSubtype;
  agent_id:            AgentToolId;
  agent_confidence:    number | null;
  pr_url:              string | null;
  test_coverage:       number | null;
  human_reviewer:      string | null;
  review_status:       ValidationStatus;
  reviewer_notes:      string | null;
  priority:            string;
  backlog_order:       number | null;
  created_at:          string;
  created_by:          string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const VALIDATION_STATUSES: ValidationStatus[] = [
  'pending', 'generated', 'tests_passing', 'in_review', 'approved', 'shipped',
];

export const VALIDATION_META: Record<ValidationStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pending:       { label: 'Pending',       color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', icon: '⏳' },
  generated:     { label: 'Generated',     color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: '🤖' },
  tests_passing: { label: 'Tests Passing', color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd', icon: '✅' },
  in_review:     { label: 'In Review',     color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '👁️' },
  approved:      { label: 'Approved',      color: '#15803d', bg: '#f0fdf4', border: '#86efac', icon: '✓'  },
  shipped:       { label: 'Shipped',       color: '#0f172a', bg: '#f8fafc', border: '#cbd5e1', icon: '🚀' },
};

export const AGENT_META: Record<AgentToolId, { label: string; icon: string; color: string }> = {
  'claude-code': { label: 'Claude Code', icon: '🟠', color: '#c2410c' },
  'cursor':      { label: 'Cursor',      icon: '🔵', color: '#1d4ed8' },
  'copilot':     { label: 'Copilot',     icon: '🟣', color: '#7c3aed' },
  'gemini':      { label: 'Gemini',      icon: '🔷', color: '#0369a1' },
  'human':       { label: 'Human',       icon: '👤', color: '#374151' },
  'other':       { label: 'Other',       icon: '⚙️', color: '#64748b' },
};

export const SUBTYPE_META: Record<AgentItemSubtype, { label: string; icon: string; color: string }> = {
  outcome:    { label: 'Outcome',    icon: '🎯', color: '#15803d' },
  constraint: { label: 'Constraint', icon: '🚧', color: '#dc2626' },
  decision:   { label: 'Decision',   icon: '⚡', color: '#d97706' },
  experiment: { label: 'Experiment', icon: '🧪', color: '#7c3aed' },
};

const SPRINT_STATUS_META: Record<AgentSprintStatus, { label: string; bg: string; color: string; border: string }> = {
  planning:  { label: 'Planning',  bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  active:    { label: 'Active',    bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  review:    { label: 'In Review', bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  shipped:   { label: 'Shipped',   bg: '#f8fafc', color: '#475569', border: '#cbd5e1' },
  cancelled: { label: 'Cancelled', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────

async function fetchAgentSprints(tenantId: string): Promise<AgentSprint[]> {
  const { data, error } = await supabase
    .from('agent_sprints').select('*').eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) console.error('[AgentSprint] fetchSprints:', error.message);
  return (data ?? []) as AgentSprint[];
}

async function saveAgentSprint(
  sprint: Partial<AgentSprint> & { tenant_id: string },
): Promise<AgentSprint | null> {
  const { data, error } = await supabase.from('agent_sprints').upsert({
    id:         sprint.id ?? gId(),
    tenant_id:  sprint.tenant_id,
    name:       sprint.name       ?? '',
    goal:       sprint.goal       ?? '',
    start_date: sprint.start_date ?? null,
    end_date:   sprint.end_date   ?? null,
    status:     sprint.status     ?? 'planning',
    created_by: sprint.created_by ?? '',
  }, { onConflict: 'id' }).select().single();
  if (error) console.error('[AgentSprint] saveSprint:', error.code, error.message);
  return error ? null : data as AgentSprint;
}

async function deleteAgentSprint(id: string): Promise<void> {
  const { error } = await supabase.from('agent_sprints').delete().eq('id', id);
  if (error) console.error('[AgentSprint] deleteSprint:', error.message);
}

async function fetchAgentSprintItems(tenantId: string): Promise<AgentSprintItem[]> {
  const { data, error } = await supabase
    .from('agent_sprint_items').select('*').eq('tenant_id', tenantId)
    .order('backlog_order', { ascending: true, nullsFirst: false });
  if (error) console.error('[AgentSprint] fetchItems:', error.message);
  return (data ?? []) as AgentSprintItem[];
}

async function saveAgentSprintItem(
  item: Partial<AgentSprintItem> & { tenant_id: string },
): Promise<AgentSprintItem | null> {
  const { data, error } = await supabase.from('agent_sprint_items').upsert({
    id:                  item.id ?? gId(),
    tenant_id:           item.tenant_id,
    agent_sprint_id:     item.agent_sprint_id     ?? null,
    linked_work_item_id: item.linked_work_item_id ?? null,
    title:               item.title               ?? '',
    outcome_description: item.outcome_description ?? '',
    acceptance_criteria: item.acceptance_criteria ?? '',
    item_subtype:        item.item_subtype         ?? 'outcome',
    agent_id:            item.agent_id             ?? 'claude-code',
    agent_confidence:    item.agent_confidence     ?? null,
    pr_url:              item.pr_url               ?? null,
    test_coverage:       item.test_coverage        ?? null,
    human_reviewer:      item.human_reviewer       ?? null,
    review_status:       item.review_status        ?? 'pending',
    reviewer_notes:      item.reviewer_notes       ?? null,
    priority:            item.priority             ?? 'Medium',
    backlog_order:       item.backlog_order        ?? null,
    created_by:          item.created_by           ?? '',
  }, { onConflict: 'id' }).select().single();
  if (error) console.error('[AgentSprint] saveItem:', error.code, error.message);
  return error ? null : data as AgentSprintItem;
}

async function deleteAgentSprintItem(id: string): Promise<void> {
  const { error } = await supabase.from('agent_sprint_items').delete().eq('id', id);
  if (error) console.error('[AgentSprint] deleteItem:', error.message);
}

// ─── BADGE COMPONENTS ─────────────────────────────────────────────────────────

export function ValidationBadge({ status }: { status: ValidationStatus }) {
  const m = VALIDATION_META[status] ?? VALIDATION_META.pending;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>
      {m.icon} {m.label}
    </span>
  );
}

export function AgentBadge({ agentId }: { agentId: AgentToolId }) {
  const m = AGENT_META[agentId] ?? AGENT_META.other;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
      background: '#f8fafc', color: m.color, border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
      {m.icon} {m.label}
    </span>
  );
}

function SubtypeBadge({ subtype }: { subtype: AgentItemSubtype }) {
  const m = SUBTYPE_META[subtype] ?? SUBTYPE_META.outcome;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
      background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}38`, whiteSpace: 'nowrap' }}>
      {m.icon} {m.label}
    </span>
  );
}

export function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#15803d' : score >= 60 ? '#d97706' : '#dc2626';
  const bg    = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      background: bg, color, border: `1px solid ${color}40`, whiteSpace: 'nowrap' }}>
      {score}% conf
    </span>
  );
}

function SprintStatusBadge({ status }: { status: AgentSprintStatus }) {
  const m = SPRINT_STATUS_META[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
      background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      {m.label}
    </span>
  );
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 7,
  fontSize: 12, outline: 'none', boxSizing: 'border-box', background: 'white', ...extra,
});
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 3, display: 'block',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

// ─── AGENT SPRINT FORM ────────────────────────────────────────────────────────

function AgentSprintForm({ initial, tenantId, loggedUser, onSave, onClose }: {
  initial: Partial<AgentSprint> | null;
  tenantId: string;
  loggedUser: string;
  onSave: (s: AgentSprint) => void;
  onClose: () => void;
}) {
  const isEdit = !!initial?.id;
  const [name,      setName]   = useState(initial?.name       ?? '');
  const [goal,      setGoal]   = useState(initial?.goal       ?? '');
  const [startDate, setStart]  = useState(initial?.start_date ?? td());
  const [endDate,   setEnd]    = useState(initial?.end_date   ?? '');
  const [status,    setStatus] = useState<AgentSprintStatus>(initial?.status ?? 'planning');
  const [saving,    setSaving] = useState(false);
  const [err,       setErr]    = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Sprint name is required.'); return; }
    setErr('');
    setSaving(true);
    const saved = await saveAgentSprint({
      id: initial?.id, tenant_id: tenantId,
      name: name.trim(), goal: goal.trim(),
      start_date: startDate || null,
      end_date:   endDate   || null,
      status,
      created_by: initial?.created_by ?? loggedUser,
    });
    setSaving(false);
    if (saved) onSave(saved);
    else setErr('Failed to save. Check browser console for the error — likely a missing RLS policy.');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 480, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
            {isEdit ? '✏️ Edit Agent Sprint' : '🤖 New Agent Sprint'}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ ...lbl, fontSize: 11 }}>Sprint Name *</label>
            <input style={inp({ fontSize: 13 })} value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Agent Sprint 1 — Auth Flows"/>
          </div>
          <div>
            <label style={{ ...lbl, fontSize: 11 }}>Release Goal</label>
            <textarea style={{ ...inp({ resize: 'vertical', minHeight: 60, fontFamily: 'inherit', fontSize: 13 }) }} value={goal} onChange={e => setGoal(e.target.value)} placeholder="What outcomes must be delivered for this release gate to pass?"/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ ...lbl, fontSize: 11 }}>Start Date</label>
              <input type="date" style={inp()} value={startDate} onChange={e => setStart(e.target.value)}/>
            </div>
            <div>
              <label style={{ ...lbl, fontSize: 11 }}>End Date</label>
              <input type="date" style={inp()} value={endDate} onChange={e => setEnd(e.target.value)}/>
            </div>
            <div>
              <label style={{ ...lbl, fontSize: 11 }}>Status</label>
              <select style={inp({ cursor: 'pointer' })} value={status} onChange={e => setStatus(e.target.value as AgentSprintStatus)}>
                {(Object.entries(SPRINT_STATUS_META) as [AgentSprintStatus, any][]).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          {err && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '6px 10px', borderRadius: 6 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '7px 22px', borderRadius: 7, border: 'none', background: saving ? '#a78bfa' : '#7c3aed', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── OUTCOME FORM ─────────────────────────────────────────────────────────────

function OutcomeForm({ initial, tenantId, loggedUser, sprints, workItems, onSave, onClose }: {
  initial: Partial<AgentSprintItem> | null;
  tenantId: string;
  loggedUser: string;
  sprints: AgentSprint[];
  workItems: any[];
  onSave: (item: AgentSprintItem) => void;
  onClose: () => void;
}) {
  const isEdit = !!initial?.id;
  const [title,       setTitle]     = useState(initial?.title               ?? '');
  const [outcome,     setOutcome]   = useState(initial?.outcome_description ?? '');
  const [criteria,    setCriteria]  = useState(initial?.acceptance_criteria ?? '');
  const [subtype,     setSubtype]   = useState<AgentItemSubtype>(initial?.item_subtype   ?? 'outcome');
  const [agentId,     setAgentId]   = useState<AgentToolId>(initial?.agent_id       ?? 'claude-code');
  const [confidence,  setConf]      = useState(String(initial?.agent_confidence ?? ''));
  const [prUrl,       setPrUrl]     = useState(initial?.pr_url               ?? '');
  const [coverage,    setCoverage]  = useState(String(initial?.test_coverage  ?? ''));
  const [reviewer,    setReviewer]  = useState(initial?.human_reviewer       ?? '');
  const [revStatus,   setRevStatus] = useState<ValidationStatus>(initial?.review_status  ?? 'pending');
  const [revNotes,    setRevNotes]  = useState(initial?.reviewer_notes       ?? '');
  const [priority,    setPriority]  = useState(initial?.priority             ?? 'Medium');
  const [sprintId,    setSprintId]  = useState(initial?.agent_sprint_id      ?? '');
  const [linkedWI,    setLinkedWI]  = useState(initial?.linked_work_item_id  ?? '');
  const [saving,      setSaving]    = useState(false);
  const [err,         setErr]       = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required.'); return; }
    setErr('');
    setSaving(true);
    const saved = await saveAgentSprintItem({
      id:                  initial?.id,
      tenant_id:           tenantId,
      agent_sprint_id:     sprintId  || null,
      linked_work_item_id: linkedWI  || null,
      title:               title.trim(),
      outcome_description: outcome.trim(),
      acceptance_criteria: criteria.trim(),
      item_subtype:        subtype,
      agent_id:            agentId,
      agent_confidence:    confidence ? parseInt(confidence, 10) : null,
      pr_url:              prUrl.trim()     || null,
      test_coverage:       coverage  ? parseInt(coverage, 10)    : null,
      human_reviewer:      reviewer.trim()  || null,
      review_status:       revStatus,
      reviewer_notes:      revNotes.trim()  || null,
      priority,
      backlog_order:       initial?.backlog_order ?? null,
      created_by:          initial?.created_by    ?? loggedUser,
    });
    setSaving(false);
    if (saved) onSave(saved);
    else setErr('Failed to save. Check browser console.');
  };

  const linkable = workItems.filter(i => ['project','task','subtask'].includes(i.type));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{isEdit ? '✏️ Edit Outcome' : '🎯 New Agent Outcome'}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}>×</button>
        </div>

        <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Outcome Title *</label>
            <input style={inp({ fontSize: 13 })} value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="e.g. Users can authenticate via OAuth in < 2s"/>
          </div>
          <div>
            <label style={lbl}>Outcome Description</label>
            <textarea style={inp({ resize: 'vertical', minHeight: 56, fontFamily: 'inherit' })} value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="What must be true when this outcome is delivered?"/>
          </div>
          <div>
            <label style={lbl}>Acceptance Criteria</label>
            <textarea style={inp({ resize: 'vertical', minHeight: 56, fontFamily: 'inherit' })} value={criteria} onChange={e => setCriteria(e.target.value)} placeholder={'Given…\nWhen…\nThen…'}/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Item Type</label>
              <select style={inp({ cursor: 'pointer' })} value={subtype} onChange={e => setSubtype(e.target.value as AgentItemSubtype)}>
                {(Object.entries(SUBTYPE_META) as [AgentItemSubtype, any][]).map(([k, m]) => (
                  <option key={k} value={k}>{m.icon} {m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <select style={inp({ cursor: 'pointer' })} value={priority} onChange={e => setPriority(e.target.value)}>
                {['Critical','High','Medium','Low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Agent / Tool</label>
              <select style={inp({ cursor: 'pointer' })} value={agentId} onChange={e => setAgentId(e.target.value as AgentToolId)}>
                {(Object.entries(AGENT_META) as [AgentToolId, any][]).map(([k, m]) => (
                  <option key={k} value={k}>{m.icon} {m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Confidence (0–100)</label>
              <input type="number" min={0} max={100} style={inp()} value={confidence} onChange={e => setConf(e.target.value)} placeholder="e.g. 85"/>
            </div>
            <div>
              <label style={lbl}>Test Coverage %</label>
              <input type="number" min={0} max={100} style={inp()} value={coverage} onChange={e => setCoverage(e.target.value)} placeholder="e.g. 92"/>
            </div>
            <div>
              <label style={lbl}>Review Status</label>
              <select style={inp({ cursor: 'pointer' })} value={revStatus} onChange={e => setRevStatus(e.target.value as ValidationStatus)}>
                {VALIDATION_STATUSES.map(s => <option key={s} value={s}>{VALIDATION_META[s].icon} {VALIDATION_META[s].label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>PR / Branch URL</label>
            <input style={inp()} value={prUrl} onChange={e => setPrUrl(e.target.value)} placeholder="https://github.com/…/pull/123"/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Human Reviewer</label>
              <input style={inp()} value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="reviewer@company.com"/>
            </div>
            <div>
              <label style={lbl}>Agent Sprint</label>
              <select style={inp({ cursor: 'pointer' })} value={sprintId} onChange={e => setSprintId(e.target.value)}>
                <option value="">— Backlog —</option>
                {sprints.filter(s => s.status !== 'cancelled').map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Reviewer Notes</label>
            <textarea style={inp({ resize: 'vertical', minHeight: 48, fontFamily: 'inherit' })} value={revNotes} onChange={e => setRevNotes(e.target.value)} placeholder="Feedback, clarification requests, blockers…"/>
          </div>

          {linkable.length > 0 && (
            <div>
              <label style={lbl}>Linked Work Item (traceability)</label>
              <select style={inp({ cursor: 'pointer' })} value={linkedWI} onChange={e => setLinkedWI(e.target.value)}>
                <option value="">— None —</option>
                {linkable.map(i => (
                  <option key={i.id} value={i.id}>{TC[i.type]?.p ?? i.type.toUpperCase()} · {i.key} — {i.title}</option>
                ))}
              </select>
            </div>
          )}

          {err && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '6px 10px', borderRadius: 6 }}>{err}</div>}
        </form>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 22px', borderRadius: 7, border: 'none', background: saving ? '#a78bfa' : '#7c3aed', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Outcome'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OUTCOME CARD ─────────────────────────────────────────────────────────────

function OutcomeCard({ item, workItems, onEdit, onDelete, onStatusChange, isViewer, compact = false }: {
  item: AgentSprintItem;
  workItems: any[];
  onEdit: (i: AgentSprintItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ValidationStatus) => void;
  isViewer: boolean;
  compact?: boolean;
}) {
  const linkedWI = item.linked_work_item_id ? workItems.find(w => w.id === item.linked_work_item_id) : null;
  const prDomain = item.pr_url ? (() => { try { return new URL(item.pr_url!).hostname.replace('www.',''); } catch { return item.pr_url; } })() : null;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: 'white', padding: compact ? '10px 12px' : '14px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 5, lineHeight: 1.4 }}>{item.title || '(Untitled)'}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
            <SubtypeBadge subtype={item.item_subtype}/>
            <AgentBadge agentId={item.agent_id}/>
            <ValidationBadge status={item.review_status}/>
            {item.agent_confidence != null && <ConfidenceBadge score={item.agent_confidence}/>}
            {item.test_coverage != null && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }}>
                {item.test_coverage}% cov
              </span>
            )}
          </div>
          {!compact && item.outcome_description && (
            <p style={{ fontSize: 11, color: '#64748b', marginBottom: 5, lineHeight: 1.5 }}>
              {item.outcome_description.slice(0, 100)}{item.outcome_description.length > 100 ? '…' : ''}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {linkedWI && (
              <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>
                🔗 {linkedWI.key}
              </span>
            )}
            {item.pr_url && (
              <a href={item.pr_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                🔀 {prDomain}
              </a>
            )}
            {item.human_reviewer && (
              <span style={{ fontSize: 10, color: '#64748b' }}>👤 {item.human_reviewer}</span>
            )}
          </div>
        </div>
        {!isViewer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <select
              value={item.review_status}
              onChange={e => onStatusChange(item.id, e.target.value as ValidationStatus)}
              style={{ padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 10, cursor: 'pointer', outline: 'none', maxWidth: 130 }}>
              {VALIDATION_STATUSES.map(s => <option key={s} value={s}>{VALIDATION_META[s].icon} {VALIDATION_META[s].label}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onEdit(item)} style={{ flex: 1, padding: '3px 6px', borderRadius: 5, border: '1px solid #e2e8f0', background: 'white', fontSize: 10, cursor: 'pointer' }}>Edit</button>
              <button onClick={() => onDelete(item.id)} style={{ flex: 1, padding: '3px 6px', borderRadius: 5, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 10, cursor: 'pointer', color: '#dc2626' }}>Del</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AGENT SPRINT LIST ────────────────────────────────────────────────────────

function AgentSprintList({ sprints, items, isViewer, onSelect, onNew, onEdit, onDelete }: {
  sprints: AgentSprint[];
  items: AgentSprintItem[];
  isViewer: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (s: AgentSprint) => void;
  onDelete: (id: string) => void;
}) {
  const stats = (s: AgentSprint) => {
    const si       = items.filter(i => i.agent_sprint_id === s.id);
    const approved = si.filter(i => i.review_status === 'approved' || i.review_status === 'shipped').length;
    const withConf = si.filter(i => i.agent_confidence != null);
    const avgConf  = withConf.length > 0 ? Math.round(withConf.reduce((a, i) => a + (i.agent_confidence ?? 0), 0) / withConf.length) : null;
    return { count: si.length, approved, acceptRate: si.length > 0 ? Math.round(approved / si.length * 100) : 0, avgConf };
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>🤖 Agent Sprints</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {sprints.length} release gate{sprints.length !== 1 ? 's' : ''} · {sprints.filter(s => s.status === 'active').length} active
          </div>
        </div>
        {!isViewer && (
          <button onClick={onNew} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7c3aed', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New Agent Sprint
          </button>
        )}
      </div>

      {sprints.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>No agent sprints yet</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>Create your first release gate to start tracking AI-generated outcomes.</div>
          {!isViewer && (
            <button onClick={onNew} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Create Agent Sprint</button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sprints.map(s => {
          const { count, approved, acceptRate, avgConf } = stats(s);
          return (
            <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: 'white', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{s.name}</span>
                    <SprintStatusBadge status={s.status}/>
                  </div>
                  {s.goal && <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 8px', lineHeight: 1.5 }}>{s.goal}</p>}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#64748b' }}>
                    <span>📦 {count} outcome{count !== 1 ? 's' : ''}</span>
                    <span>✓ {approved} approved</span>
                    <span style={{ color: acceptRate >= 80 ? '#15803d' : acceptRate >= 50 ? '#d97706' : '#dc2626', fontWeight: 600 }}>
                      {acceptRate}% acceptance
                    </span>
                    {avgConf != null && <span>🎯 avg {avgConf}% confidence</span>}
                    {s.start_date && <span>📅 {s.start_date}{s.end_date ? ` → ${s.end_date}` : ''}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => onSelect(s.id)} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #7c3aed', background: '#faf5ff', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Pipeline →
                  </button>
                  {!isViewer && (
                    <>
                      <button onClick={() => onEdit(s)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', fontSize: 11, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => onDelete(s.id)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 11, cursor: 'pointer', color: '#dc2626' }}>Delete</button>
                    </>
                  )}
                </div>
              </div>
              {count > 0 && (
                <div style={{ height: 3, background: '#f1f5f9' }}>
                  <div style={{ height: '100%', width: `${acceptRate}%`, background: acceptRate >= 80 ? '#16a34a' : acceptRate >= 50 ? '#d97706' : '#7c3aed', transition: 'width 0.3s ease' }}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── OUTCOME BACKLOG ──────────────────────────────────────────────────────────

function OutcomeBacklog({ items, sprints, workItems, isViewer, onEdit, onDelete, onAddToSprint }: {
  items: AgentSprintItem[];
  sprints: AgentSprint[];
  workItems: any[];
  isViewer: boolean;
  onEdit: (item: AgentSprintItem) => void;
  onDelete: (id: string) => void;
  onAddToSprint: (itemId: string, sprintId: string) => void;
}) {
  const backlogItems = items.filter(i => !i.agent_sprint_id);
  const activeSprints = sprints.filter(s => s.status !== 'cancelled' && s.status !== 'shipped');

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>📋 Outcome Backlog</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{backlogItems.length} unassigned</div>
      </div>
      {backlogItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 12 }}>
          All outcomes are assigned to a sprint. Add new outcomes using the + button.
        </div>
      ) : (
        backlogItems.map(item => {
          const linkedWI = item.linked_work_item_id ? workItems.find(w => w.id === item.linked_work_item_id) : null;
          return (
            <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: 'white', padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>{item.title || '(Untitled)'}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                  <SubtypeBadge subtype={item.item_subtype}/>
                  <AgentBadge agentId={item.agent_id}/>
                  <ValidationBadge status={item.review_status}/>
                  {item.agent_confidence != null && <ConfidenceBadge score={item.agent_confidence}/>}
                </div>
                {item.outcome_description && (
                  <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                    {item.outcome_description.slice(0, 120)}{item.outcome_description.length > 120 ? '…' : ''}
                  </p>
                )}
                {linkedWI && (
                  <div style={{ marginTop: 4, fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>
                    🔗 {linkedWI.key} — {linkedWI.title}
                  </div>
                )}
              </div>
              {!isViewer && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                  {activeSprints.length > 0 && (
                    <select value="" onChange={e => { if (e.target.value) onAddToSprint(item.id, e.target.value); }}
                      style={{ padding: '4px 8px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 11, color: '#7c3aed', background: '#faf5ff', cursor: 'pointer', outline: 'none' }}>
                      <option value="">→ Add to sprint</option>
                      {activeSprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => onEdit(item)} style={{ flex: 1, padding: '4px 8px', borderRadius: 5, border: '1px solid #e2e8f0', background: 'white', fontSize: 11, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => onDelete(item.id)} style={{ flex: 1, padding: '4px 8px', borderRadius: 5, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 11, cursor: 'pointer', color: '#dc2626' }}>Del</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── VALIDATION PIPELINE ──────────────────────────────────────────────────────

function ValidationPipeline({ sprint, items, workItems, isViewer, onBack, onEdit, onDelete, onStatusChange, onStartSprint, onShipSprint }: {
  sprint: AgentSprint;
  items: AgentSprintItem[];
  workItems: any[];
  isViewer: boolean;
  onBack: () => void;
  onEdit: (item: AgentSprintItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ValidationStatus) => void;
  onStartSprint: (id: string) => void;
  onShipSprint: (id: string) => void;
}) {
  const sprintItems = items.filter(i => i.agent_sprint_id === sprint.id);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ValidationStatus | null>(null);

  const getColItems = (s: ValidationStatus) => sprintItems.filter(i => i.review_status === s);

  const totalCount    = sprintItems.length;
  const approvedCount = sprintItems.filter(i => i.review_status === 'approved' || i.review_status === 'shipped').length;
  const acceptRate    = totalCount > 0 ? Math.round(approvedCount / totalCount * 100) : 0;

  const handleDrop = (col: ValidationStatus) => {
    if (!dragId) return;
    onStatusChange(dragId, col);
    setDragId(null); setDragOver(null);
  };

  const COL_DOT: Record<ValidationStatus, string> = {
    pending: '#94a3b8', generated: '#7c3aed', tests_passing: '#0369a1',
    in_review: '#d97706', approved: '#15803d', shipped: '#475569',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#374151' }}>← Back</button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{sprint.name}</div>
          {sprint.goal && <div style={{ fontSize: 11, color: '#64748b' }}>{sprint.goal}</div>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {totalCount} outcomes · <span style={{ color: acceptRate >= 80 ? '#15803d' : '#d97706', fontWeight: 600 }}>{acceptRate}% accepted</span>
          </div>
          <SprintStatusBadge status={sprint.status}/>
          {!isViewer && sprint.status === 'planning' && (
            <button onClick={() => onStartSprint(sprint.id)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#15803d', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Start Sprint
            </button>
          )}
          {!isViewer && sprint.status === 'active' && (
            <button onClick={() => onShipSprint(sprint.id)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#7c3aed', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Mark Shipped
            </button>
          )}
        </div>
      </div>

      {/* Kanban columns */}
      <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: 12, padding: '16px 20px' }}>
        {VALIDATION_STATUSES.map(col => {
          const colItems = getColItems(col);
          const isOver   = dragOver === col;
          const m        = VALIDATION_META[col];
          return (
            <div key={col}
              onDragOver={e => { e.preventDefault(); setDragOver(col); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
              onDrop={() => handleDrop(col)}
              style={{ flexShrink: 0, width: 220, borderRadius: 12, background: isOver ? '#f5f3ff' : '#f8fafc',
                border: `1px solid ${isOver ? '#a78bfa' : '#e2e8f0'}`, padding: '10px 10px', minHeight: 200,
                boxShadow: isOver ? '0 0 0 2px #a78bfa40' : 'none', transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 2px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COL_DOT[col], flexShrink: 0 }}/>
                <span style={{ fontSize: 11, fontWeight: 700, color: m.color, flex: 1 }}>{m.icon} {m.label}</span>
                <span style={{ fontSize: 10, color: '#94a3b8', background: 'white', border: '1px solid #e2e8f0', borderRadius: 999, padding: '1px 7px' }}>{colItems.length}</span>
              </div>
              {isOver && (
                <div style={{ border: '2px dashed #a78bfa', borderRadius: 8, padding: '8px', textAlign: 'center', color: '#7c3aed', fontSize: 11, marginBottom: 8 }}>Drop here</div>
              )}
              <div>
                {colItems.map(item => (
                  <div key={item.id} draggable
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    style={{ opacity: dragId === item.id ? 0.4 : 1, cursor: 'grab' }}>
                    <OutcomeCard item={item} workItems={workItems} onEdit={onEdit} onDelete={onDelete}
                      onStatusChange={onStatusChange} isViewer={isViewer} compact/>
                  </div>
                ))}
                {colItems.length === 0 && !isOver && (
                  <div style={{ border: '2px dashed #e2e8f0', borderRadius: 8, padding: '24px 8px', textAlign: 'center', color: '#cbd5e1', fontSize: 11 }}>Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TRACEABILITY VIEW ────────────────────────────────────────────────────────

function TraceabilityView({ items, workItems }: { items: AgentSprintItem[]; workItems: any[] }) {
  const linked     = items.filter(i => i.linked_work_item_id);
  const unlinked   = items.filter(i => !i.linked_work_item_id);
  const wiIds      = [...new Set(linked.map(i => i.linked_work_item_id as string))];
  const groups     = wiIds.map(wid => ({
    wi:       workItems.find(w => w.id === wid),
    outcomes: linked.filter(i => i.linked_work_item_id === wid),
  })).filter(g => g.wi);

  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>🔗</div>
      <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>No outcomes yet</div>
    </div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>🔗 Traceability</div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
        Outcomes linked to work items — from strategic goal down to agent-generated PR.
      </div>

      {groups.map(({ wi, outcomes }) => {
        const c = TC[wi.type];
        const approved = outcomes.filter(o => o.review_status === 'approved' || o.review_status === 'shipped').length;
        return (
          <div key={wi.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: 'white', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{c?.i}</span>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: c?.tc ?? '#374151' }}>{c?.l} · {wi.key}</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{wi.title}</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
                {approved}/{outcomes.length} approved
              </span>
            </div>
            <div style={{ padding: '10px 16px' }}>
              {outcomes.map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <SubtypeBadge subtype={o.item_subtype}/>
                  <span style={{ flex: 1, fontSize: 12, color: '#1e293b', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</span>
                  <AgentBadge agentId={o.agent_id}/>
                  <ValidationBadge status={o.review_status}/>
                  {o.agent_confidence != null && <ConfidenceBadge score={o.agent_confidence}/>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {unlinked.length > 0 && (
        <div style={{ border: '1px solid #fde68a', borderRadius: 12, background: '#fffbeb', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #fde68a', fontSize: 12, fontWeight: 600, color: '#d97706' }}>
            ⚠️ {unlinked.length} outcome{unlinked.length !== 1 ? 's' : ''} not linked to a work item
          </div>
          <div style={{ padding: '10px 16px' }}>
            {unlinked.map(o => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #fef3c7' }}>
                <SubtypeBadge subtype={o.item_subtype}/>
                <span style={{ flex: 1, fontSize: 12, color: '#1e293b' }}>{o.title}</span>
                <AgentBadge agentId={o.agent_id}/>
                <ValidationBadge status={o.review_status}/>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AGENT ANALYTICS ─────────────────────────────────────────────────────────

function AgentAnalytics({ sprints, items }: { sprints: AgentSprint[]; items: AgentSprintItem[] }) {
  const completed = sprints.filter(s => s.status === 'shipped' || s.status === 'review');
  const allItems  = items;

  // Acceptance rate per sprint
  const sprintStats = sprints
    .filter(s => items.some(i => i.agent_sprint_id === s.id))
    .map(s => {
      const si       = items.filter(i => i.agent_sprint_id === s.id);
      const approved = si.filter(i => i.review_status === 'approved' || i.review_status === 'shipped').length;
      return { name: s.name, total: si.length, approved, rate: si.length > 0 ? Math.round(approved / si.length * 100) : 0 };
    });

  // Items by agent
  const byAgent = Object.entries(AGENT_META).map(([k, m]) => ({
    id: k as AgentToolId, label: m.label, icon: m.icon, color: m.color,
    count: allItems.filter(i => i.agent_id === k).length,
  })).filter(a => a.count > 0).sort((a, b) => b.count - a.count);
  const maxAgent = Math.max(...byAgent.map(a => a.count), 1);

  // Average confidence by agent
  const confidenceByAgent = byAgent.map(a => {
    const wi = allItems.filter(i => i.agent_id === a.id && i.agent_confidence != null);
    return { ...a, avgConf: wi.length > 0 ? Math.round(wi.reduce((s, i) => s + (i.agent_confidence ?? 0), 0) / wi.length) : null };
  });

  // Validation status distribution
  const byStatus = VALIDATION_STATUSES.map(s => ({
    s, count: allItems.filter(i => i.review_status === s).length,
  }));
  const maxStatus = Math.max(...byStatus.map(b => b.count), 1);

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', background: 'white', ...style }}>{children}</div>
  );

  if (allItems.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>No data yet</div>
      <div style={{ fontSize: 12 }}>Add outcomes and run agent sprints to see analytics.</div>
    </div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 24 }}>📊 Analytics</div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Outcomes',  val: allItems.length,   color: '#374151' },
          { label: 'Approved',        val: allItems.filter(i => i.review_status === 'approved' || i.review_status === 'shipped').length, color: '#15803d' },
          { label: 'Acceptance Rate', val: allItems.length > 0 ? `${Math.round(allItems.filter(i => i.review_status === 'approved' || i.review_status === 'shipped').length / allItems.length * 100)}%` : '—', color: '#7c3aed' },
          { label: 'Avg Confidence',  val: (() => { const w = allItems.filter(i => i.agent_confidence != null); return w.length > 0 ? `${Math.round(w.reduce((s, i) => s + (i.agent_confidence ?? 0), 0) / w.length)}%` : '—'; })(), color: '#d97706' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', background: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Items by agent */}
        {card(
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>🤖 Items by Agent</div>
            {byAgent.map(a => (
              <div key={a.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                  <span style={{ color: a.color, fontWeight: 600 }}>{a.icon} {a.label}</span>
                  <span style={{ color: '#64748b' }}>{a.count}</span>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(a.count / maxAgent) * 100}%`, background: a.color, borderRadius: 3 }}/>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Validation pipeline distribution */}
        {card(
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>⚡ Pipeline Distribution</div>
            {byStatus.filter(b => b.count > 0).map(b => {
              const m = VALIDATION_META[b.s];
              return (
                <div key={b.s} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                    <span style={{ color: m.color, fontWeight: 600 }}>{m.icon} {m.label}</span>
                    <span style={{ color: '#64748b' }}>{b.count}</span>
                  </div>
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(b.count / maxStatus) * 100}%`, background: m.color, borderRadius: 3 }}/>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Acceptance rate per sprint */}
      {sprintStats.length > 0 && card(
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>✓ Acceptance Rate by Sprint</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Sprint', 'Outcomes', 'Approved', 'Acceptance'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sprintStats.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                  <td style={{ padding: '9px 12px', color: '#64748b' }}>{s.total}</td>
                  <td style={{ padding: '9px 12px', color: '#15803d', fontWeight: 600 }}>{s.approved}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.rate}%`, background: s.rate >= 80 ? '#16a34a' : s.rate >= 50 ? '#d97706' : '#7c3aed', borderRadius: 3 }}/>
                      </div>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{s.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>,
        { marginBottom: 16 }
      )}

      {/* Confidence by agent */}
      {confidenceByAgent.some(a => a.avgConf != null) && card(
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>🎯 Avg Confidence by Agent</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {confidenceByAgent.filter(a => a.avgConf != null).map(a => (
              <div key={a.id} style={{ textAlign: 'center', minWidth: 80 }}>
                <ConfidenceBadge score={a.avgConf!}/>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{a.icon} {a.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── AGENT SPRINT MODULE (MAIN EXPORT) ────────────────────────────────────────

type SubView = 'list' | 'backlog' | 'pipeline' | 'traceability' | 'analytics';

interface AgentSprintModuleProps {
  tenantId:   string;
  loggedUser: string;
  isViewer:   boolean;
  workItems:  any[];
}

export default function AgentSprintModule({ tenantId, loggedUser, isViewer, workItems }: AgentSprintModuleProps) {
  const [sprints,       setSprints]       = useState<AgentSprint[]>([]);
  const [items,         setItems]         = useState<AgentSprintItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [subView,       setSubView]       = useState<SubView>('list');
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [formSprint,    setFormSprint]    = useState<Partial<AgentSprint> | null | false>(false);
  const [formOutcome,   setFormOutcome]   = useState<Partial<AgentSprintItem> | null | false>(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, i] = await Promise.all([fetchAgentSprints(tenantId), fetchAgentSprintItems(tenantId)]);
    setSprints(s); setItems(i);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`agent_sprints:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_sprints',      filter: `tenant_id=eq.${tenantId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_sprint_items', filter: `tenant_id=eq.${tenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, load]);

  const handleSaveSprint = (saved: AgentSprint) => {
    setSprints(p => p.some(s => s.id === saved.id) ? p.map(s => s.id === saved.id ? saved : s) : [saved, ...p]);
    setFormSprint(false);
  };

  const handleDeleteSprint = async (id: string) => {
    if (!window.confirm('Delete this agent sprint? Outcomes will be moved to the backlog.')) return;
    await Promise.all(items.filter(i => i.agent_sprint_id === id).map(i =>
      saveAgentSprintItem({ ...i, tenant_id: tenantId, agent_sprint_id: null })
    ));
    await deleteAgentSprint(id);
    setSprints(p => p.filter(s => s.id !== id));
    setItems(p => p.map(i => i.agent_sprint_id === id ? { ...i, agent_sprint_id: null } : i));
    if (selectedId === id) { setSelectedId(null); setSubView('list'); }
  };

  const handleSaveOutcome = (saved: AgentSprintItem) => {
    setItems(p => p.some(i => i.id === saved.id) ? p.map(i => i.id === saved.id ? saved : i) : [saved, ...p]);
    setFormOutcome(false);
  };

  const handleDeleteOutcome = async (id: string) => {
    if (!window.confirm('Delete this outcome?')) return;
    await deleteAgentSprintItem(id);
    setItems(p => p.filter(i => i.id !== id));
  };

  const handleStatusChange = async (id: string, status: ValidationStatus) => {
    const saved = await saveAgentSprintItem({ ...items.find(i => i.id === id)!, tenant_id: tenantId, review_status: status });
    if (saved) setItems(p => p.map(i => i.id === id ? saved : i));
  };

  const handleAddToSprint = async (itemId: string, sprintId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const saved = await saveAgentSprintItem({ ...item, tenant_id: tenantId, agent_sprint_id: sprintId });
    if (saved) setItems(p => p.map(i => i.id === itemId ? saved : i));
  };

  const handleStartSprint = async (id: string) => {
    const sprint = sprints.find(s => s.id === id);
    if (!sprint) return;
    const saved = await saveAgentSprint({ ...sprint, tenant_id: tenantId, status: 'active' });
    if (saved) { setSprints(p => p.map(s => s.id === id ? saved : s)); }
  };

  const handleShipSprint = async (id: string) => {
    const sprint = sprints.find(s => s.id === id);
    if (!sprint) return;
    const saved = await saveAgentSprint({ ...sprint, tenant_id: tenantId, status: 'shipped' });
    if (saved) { setSprints(p => p.map(s => s.id === id ? saved : s)); }
  };

  const selectedSprint = sprints.find(s => s.id === selectedId) ?? null;

  const TAB = (v: SubView, label: string): React.CSSProperties => ({
    padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: subView === v ? 700 : 400, background: subView === v ? 'white' : 'transparent',
    color: subView === v ? '#1e293b' : '#64748b',
    boxShadow: subView === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>
      Loading agent sprints…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'system-ui,sans-serif', fontSize: 13 }}>
      {/* Tab bar */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', flexShrink: 0, flexWrap: 'wrap' }}>
        <button style={TAB('list', '🤖 Sprints')} onClick={() => { setSubView('list'); setSelectedId(null); }}>🤖 Sprints</button>
        <button style={TAB('backlog', '📋 Backlog')} onClick={() => { setSubView('backlog'); setSelectedId(null); }}>📋 Backlog</button>
        <button style={TAB('traceability', '🔗 Traceability')} onClick={() => { setSubView('traceability'); setSelectedId(null); }}>🔗 Traceability</button>
        <button style={TAB('analytics', '📊 Analytics')} onClick={() => { setSubView('analytics'); setSelectedId(null); }}>📊 Analytics</button>
        {selectedSprint && subView === 'pipeline' && (
          <>
            <span style={{ color: '#e2e8f0', margin: '0 4px' }}>|</span>
            <button style={TAB('pipeline', '⚡ Pipeline')} onClick={() => setSubView('pipeline')}>⚡ Pipeline — {selectedSprint.name}</button>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!isViewer && (
            <button onClick={() => setFormOutcome({})}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #ddd6fe', background: '#faf5ff', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + Outcome
            </button>
          )}
          {!isViewer && (
            <button onClick={() => setFormSprint({})}
              style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#7c3aed', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + Sprint
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subView === 'list' && (
          <AgentSprintList sprints={sprints} items={items} isViewer={isViewer}
            onSelect={id => { setSelectedId(id); setSubView('pipeline'); }}
            onNew={() => setFormSprint({})}
            onEdit={s => setFormSprint(s)}
            onDelete={handleDeleteSprint}/>
        )}
        {subView === 'backlog' && (
          <OutcomeBacklog items={items} sprints={sprints} workItems={workItems} isViewer={isViewer}
            onEdit={i => setFormOutcome(i)}
            onDelete={handleDeleteOutcome}
            onAddToSprint={handleAddToSprint}/>
        )}
        {subView === 'pipeline' && selectedSprint && (
          <ValidationPipeline
            sprint={sprints.find(s => s.id === selectedId) ?? selectedSprint}
            items={items} workItems={workItems} isViewer={isViewer}
            onBack={() => { setSubView('list'); setSelectedId(null); }}
            onEdit={i => setFormOutcome(i)}
            onDelete={handleDeleteOutcome}
            onStatusChange={handleStatusChange}
            onStartSprint={handleStartSprint}
            onShipSprint={handleShipSprint}/>
        )}
        {subView === 'traceability' && (
          <TraceabilityView items={items} workItems={workItems}/>
        )}
        {subView === 'analytics' && (
          <AgentAnalytics sprints={sprints} items={items}/>
        )}
      </div>

      {/* Sprint form modal */}
      {formSprint !== false && (
        <AgentSprintForm
          initial={formSprint || null}
          tenantId={tenantId}
          loggedUser={loggedUser}
          onSave={handleSaveSprint}
          onClose={() => setFormSprint(false)}/>
      )}

      {/* Outcome form modal */}
      {formOutcome !== false && (
        <OutcomeForm
          initial={formOutcome || null}
          tenantId={tenantId}
          loggedUser={loggedUser}
          sprints={sprints}
          workItems={workItems}
          onSave={handleSaveOutcome}
          onClose={() => setFormOutcome(false)}/>
      )}
    </div>
  );
}
