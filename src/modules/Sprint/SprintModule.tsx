import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { gId, td } from '../../utils';
import { Sprint, SprintStatus, ItemSubtype } from '../../types';
import { ITEM_SUBTYPE_META, SPRINT_STATUS_COLORS } from '../../constants';

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────

async function fetchSprints(tenantId: string): Promise<Sprint[]> {
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) console.error('[SprintModule] fetchSprints:', error.message);
  return (data ?? []) as Sprint[];
}

async function saveSprint(sprint: Partial<Sprint> & { tenant_id: string }): Promise<Sprint | null> {
  const { data, error } = await supabase
    .from('sprints')
    .upsert({
      id:              sprint.id ?? gId(),
      tenant_id:       sprint.tenant_id,
      project_id:      sprint.project_id  ?? null,
      name:            sprint.name        ?? '',
      goal:            sprint.goal        ?? '',
      start_date:      sprint.start_date  ?? null,
      end_date:        sprint.end_date    ?? null,
      status:          sprint.status      ?? 'planning',
      capacity_points: sprint.capacity_points ?? 0,
      velocity_points: sprint.velocity_points ?? 0,
      created_by:      sprint.created_by  ?? '',
    })
    .select()
    .single();
  if (error) console.error('[SprintModule] saveSprint:', error.message);
  return data as Sprint | null;
}

async function deleteSprint(id: string): Promise<void> {
  const { error } = await supabase.from('sprints').delete().eq('id', id);
  if (error) console.error('[SprintModule] deleteSprint:', error.message);
}

async function setItemSprint(
  itemId: string, sprintId: string | null, tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from('work_items')
    .update({ sprint_id: sprintId })
    .eq('id', itemId)
    .eq('tenant_id', tenantId);
  if (error) console.error('[SprintModule] setItemSprint:', error.message);
}

async function setItemBacklogOrder(
  itemId: string, order: number, tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from('work_items')
    .update({ backlog_order: order })
    .eq('id', itemId)
    .eq('tenant_id', tenantId);
  if (error) console.error('[SprintModule] setItemBacklogOrder:', error.message);
}

async function setItemStoryPoints(
  itemId: string, points: number | null, tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from('work_items')
    .update({ story_points: points })
    .eq('id', itemId)
    .eq('tenant_id', tenantId);
  if (error) console.error('[SprintModule] setItemStoryPoints:', error.message);
}

async function setItemSubtype(
  itemId: string, subtype: ItemSubtype | null, tenantId: string,
): Promise<void> {
  const { error } = await supabase
    .from('work_items')
    .update({ item_subtype: subtype })
    .eq('id', itemId)
    .eq('tenant_id', tenantId);
  if (error) console.error('[SprintModule] setItemSubtype:', error.message);
}

// ─── SMALL UI HELPERS ─────────────────────────────────────────────────────────

function SprintStatusBadge({ status }: { status: SprintStatus }) {
  const labels: Record<SprintStatus, string> = {
    planning: 'Planning', active: 'Active', completed: 'Completed', cancelled: 'Cancelled',
  };
  const colors: Record<SprintStatus, { bg: string; color: string; border: string }> = {
    planning:  { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    active:    { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
    completed: { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' },
    cancelled: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  };
  const c = colors[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {labels[status]}
    </span>
  );
}

function SubtypeBadge({ subtype }: { subtype: ItemSubtype | null }) {
  if (!subtype) return null;
  const m = ITEM_SUBTYPE_META[subtype];
  if (!m) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
      background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}40`, whiteSpace: 'nowrap' }}>
      {m.icon} {m.label}
    </span>
  );
}

function PointsBadge({ points }: { points: number | null }) {
  if (points === null || points === undefined) return (
    <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>–</span>
  );
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
      background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>
      {points} pt{points !== 1 ? 's' : ''}
    </span>
  );
}

function ProgressBar({ done, total, color = '#2563eb' }: { done: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }}/>
      </div>
      <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ─── SPRINT FORM MODAL ────────────────────────────────────────────────────────

function SprintForm({
  initial, tenantId, loggedUser, onSave, onClose,
}: {
  initial: Partial<Sprint> | null;
  tenantId: string;
  loggedUser: string;
  onSave: (s: Sprint) => void;
  onClose: () => void;
}) {
  const isEdit = !!initial?.id;
  const [name,     setName]     = useState(initial?.name       ?? '');
  const [goal,     setGoal]     = useState(initial?.goal       ?? '');
  const [startDate,setStart]    = useState(initial?.start_date ?? td());
  const [endDate,  setEnd]      = useState(initial?.end_date   ?? '');
  const [capacity, setCap]      = useState(String(initial?.capacity_points ?? ''));
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Sprint name is required.'); return; }
    if (endDate && startDate && endDate < startDate) { setErr('End date must be after start date.'); return; }
    setSaving(true);
    const saved = await saveSprint({
      id:              initial?.id,
      tenant_id:       tenantId,
      project_id:      initial?.project_id ?? null,
      name:            name.trim(),
      goal:            goal.trim(),
      start_date:      startDate || null as any,
      end_date:        endDate   || null as any,
      status:          initial?.status ?? 'planning',
      capacity_points: capacity ? parseInt(capacity, 10) : 0,
      velocity_points: initial?.velocity_points ?? 0,
      created_by:      initial?.created_by ?? loggedUser,
    });
    setSaving(false);
    if (saved) onSave(saved);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7,
    fontSize: 13, outline: 'none', background: 'white', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 480, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
            {isEdit ? '✏️ Edit Sprint' : '🏃 New Sprint'}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer', padding: '2px 6px' }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Sprint Name *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sprint 1, Q2 Sprint 3" autoFocus/>
          </div>
          <div>
            <label style={labelStyle}>Sprint Goal</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 64, fontFamily: 'inherit' }}
              value={goal} onChange={e => setGoal(e.target.value)} placeholder="What is the team trying to achieve this sprint?"/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" style={inputStyle} value={startDate} onChange={e => setStart(e.target.value)}/>
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" style={inputStyle} value={endDate} onChange={e => setEnd(e.target.value)}/>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Capacity (story points)</label>
            <input type="number" min={0} style={{ ...inputStyle, width: 140 }} value={capacity} onChange={e => setCap(e.target.value)} placeholder="e.g. 40"/>
          </div>
          {err && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '6px 10px', borderRadius: 6 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: '7px 22px', borderRadius: 7, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── SPRINT LIST VIEW ─────────────────────────────────────────────────────────

function SprintList({
  sprints, items, isViewer,
  onSelectSprint, onNewSprint, onEditSprint, onDeleteSprint,
}: {
  sprints: Sprint[];
  items: any[];
  isViewer: boolean;
  onSelectSprint: (id: string, view: 'board' | 'planning') => void;
  onNewSprint: () => void;
  onEditSprint: (s: Sprint) => void;
  onDeleteSprint: (id: string) => void;
}) {
  const activeSprint = sprints.find(s => s.status === 'active');

  const sprintStats = (sprint: Sprint) => {
    const sprintItems = items.filter(i => i.sprintId === sprint.id);
    const totalPts    = sprintItems.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0);
    const donePts     = sprintItems.filter((i: any) => i.status === 'Completed').reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0);
    return { count: sprintItems.length, totalPts, donePts };
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>🏃 Sprints</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} · {sprints.filter(s => s.status === 'active').length} active
          </div>
        </div>
        {!isViewer && (
          <button onClick={onNewSprint}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            + New Sprint
          </button>
        )}
      </div>

      {/* Active sprint callout */}
      {activeSprint && (() => {
        const stats = sprintStats(activeSprint);
        const daysLeft = activeSprint.end_date
          ? Math.ceil((new Date(activeSprint.end_date).getTime() - Date.now()) / 86400000)
          : null;
        return (
          <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '2px solid #86efac', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <SprintStatusBadge status="active"/>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{activeSprint.name}</span>
                  {daysLeft !== null && (
                    <span style={{ fontSize: 11, color: daysLeft <= 2 ? '#dc2626' : '#64748b' }}>
                      {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : daysLeft === 0 ? 'Ends today' : 'Overdue'}
                    </span>
                  )}
                </div>
                {activeSprint.goal && <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>{activeSprint.goal}</div>}
                <ProgressBar done={stats.donePts} total={stats.totalPts || activeSprint.capacity_points} color="#16a34a"/>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  {stats.donePts} / {stats.totalPts || activeSprint.capacity_points} pts · {stats.count} items
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => onSelectSprint(activeSprint.id, 'board')}
                  style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#16a34a', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Open Board
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* All sprints table */}
      {sprints.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏁</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>No sprints yet</div>
          <div style={{ fontSize: 12 }}>Create your first sprint to start planning your backlog.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Sprint', 'Status', 'Dates', 'Items', 'Progress', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sprints.map((sprint, idx) => {
                const stats = sprintStats(sprint);
                return (
                  <tr key={sprint.id}
                    style={{ borderBottom: idx < sprints.length - 1 ? '1px solid #f1f5f9' : 'none', background: 'white', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{sprint.name}</div>
                      {sprint.goal && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sprint.goal}</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}><SprintStatusBadge status={sprint.status}/></td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {sprint.start_date && <span>{sprint.start_date}</span>}
                      {sprint.start_date && sprint.end_date && <span style={{ margin: '0 4px' }}>→</span>}
                      {sprint.end_date && <span>{sprint.end_date}</span>}
                      {!sprint.start_date && !sprint.end_date && <span style={{ color: '#cbd5e1' }}>–</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b' }}>
                      {stats.count} <span style={{ color: '#cbd5e1' }}>·</span> {stats.totalPts || sprint.capacity_points} pts
                    </td>
                    <td style={{ padding: '12px 14px', minWidth: 120 }}>
                      <ProgressBar done={stats.donePts} total={stats.totalPts || sprint.capacity_points}/>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {sprint.status === 'planning' && (
                          <button onClick={() => onSelectSprint(sprint.id, 'planning')}
                            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #2563eb', background: 'white', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Plan
                          </button>
                        )}
                        {sprint.status === 'active' && (
                          <button onClick={() => onSelectSprint(sprint.id, 'board')}
                            style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#16a34a', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Board
                          </button>
                        )}
                        {(sprint.status === 'completed' || sprint.status === 'cancelled') && (
                          <button onClick={() => onSelectSprint(sprint.id, 'board')}
                            style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            View
                          </button>
                        )}
                        {!isViewer && (
                          <>
                            <button onClick={() => onEditSprint(sprint)}
                              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>
                              Edit
                            </button>
                            <button onClick={() => onDeleteSprint(sprint.id)}
                              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: 'white', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── BACKLOG VIEW ─────────────────────────────────────────────────────────────

function BacklogView({
  tenantId, items, sprints, isViewer, onItemChange,
}: {
  tenantId: string;
  items: any[];
  sprints: Sprint[];
  isViewer: boolean;
  onItemChange: (id: string, field: string, value: any) => void;
}) {
  const [filterType,  setFilterType]  = useState<string>('all');
  const [editingPts,  setEditingPts]  = useState<string | null>(null);
  const [ptsInput,    setPtsInput]    = useState('');
  const [dragOverId,  setDragOverId]  = useState<string | null>(null);

  const BACKLOG_TYPES = ['task', 'subtask'];
  const backlogItems = items
    .filter(i => !i.sprintId && BACKLOG_TYPES.includes(i.type))
    .filter(i => filterType === 'all' || i.type === filterType)
    .sort((a: any, b: any) => {
      const ao = a.backlogOrder ?? 9999;
      const bo = b.backlogOrder ?? 9999;
      return ao - bo;
    });

  const activeSprint = sprints.find(s => s.status === 'active');

  const handleAssignToSprint = async (itemId: string, sprintId: string) => {
    onItemChange(itemId, 'sprintId', sprintId);
    await setItemSprint(itemId, sprintId, tenantId);
  };

  const handleSavePoints = async (itemId: string) => {
    const pts = ptsInput === '' ? null : parseInt(ptsInput, 10);
    onItemChange(itemId, 'storyPoints', pts);
    await setItemStoryPoints(itemId, isNaN(pts as number) ? null : pts, tenantId);
    setEditingPts(null);
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) { setDragOverId(null); return; }

    const orderedIds = backlogItems.map((i: any) => i.id);
    const fromIdx = orderedIds.indexOf(draggedId);
    const toIdx   = orderedIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { setDragOverId(null); return; }

    const newOrder = [...orderedIds];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedId);

    await Promise.all(
      newOrder.map((id, idx) => {
        onItemChange(id, 'backlogOrder', idx);
        return setItemBacklogOrder(id, idx, tenantId);
      })
    );
    setDragOverId(null);
  };

  const STATUS_COLOR: Record<string, string> = {
    'Draft': '#94a3b8', 'In Progress': '#d97706', 'On Hold': '#ea580c',
    'Completed': '#16a34a', 'Cancelled': '#dc2626',
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>📋 Product Backlog</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{backlogItems.length} items · drag to reprioritise</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'task', 'subtask'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${filterType === t ? '#2563eb' : '#e2e8f0'}`,
                background: filterType === t ? '#eff6ff' : 'white', color: filterType === t ? '#2563eb' : '#64748b',
                fontSize: 12, fontWeight: filterType === t ? 600 : 400, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {backlogItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Backlog is empty</div>
          <div style={{ fontSize: 12 }}>Tasks and subtasks not assigned to a sprint appear here.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          {backlogItems.map((item: any, idx: number) => (
            <div key={item.id}
              draggable={!isViewer}
              onDragStart={e => handleDragStart(e, item.id)}
              onDragOver={e => { e.preventDefault(); setDragOverId(item.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={e => handleDrop(e, item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderBottom: idx < backlogItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                background: dragOverId === item.id ? '#eff6ff' : idx % 2 === 0 ? 'white' : '#fafafa',
                cursor: isViewer ? 'default' : 'grab', transition: 'background 0.1s',
                borderLeft: dragOverId === item.id ? '3px solid #2563eb' : '3px solid transparent',
              }}>
              {/* Drag handle */}
              {!isViewer && (
                <span style={{ color: '#cbd5e1', fontSize: 14, flexShrink: 0, cursor: 'grab' }}>⠿</span>
              )}

              {/* Rank */}
              <span style={{ fontSize: 11, color: '#cbd5e1', minWidth: 22, textAlign: 'right', flexShrink: 0 }}>
                {idx + 1}
              </span>

              {/* Subtype badge */}
              <SubtypeBadge subtype={item.itemSubtype}/>

              {/* Title */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title || '(Untitled)'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>{item.key}</span>
                  <span style={{ fontSize: 10, color: STATUS_COLOR[item.status] ?? '#94a3b8', fontWeight: 600 }}>● {item.status}</span>
                  {item.assigned && <span style={{ fontSize: 10, color: '#64748b' }}>@{item.assigned}</span>}
                </div>
              </div>

              {/* Story points — inline edit */}
              <div style={{ flexShrink: 0 }}>
                {editingPts === item.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input autoFocus type="number" min={0} value={ptsInput}
                      onChange={e => setPtsInput(e.target.value)}
                      onBlur={() => handleSavePoints(item.id)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSavePoints(item.id); if (e.key === 'Escape') setEditingPts(null); }}
                      style={{ width: 52, padding: '3px 6px', border: '1px solid #93c5fd', borderRadius: 5, fontSize: 12, outline: 'none', textAlign: 'center' }}/>
                  </div>
                ) : (
                  <div onClick={() => !isViewer && (setEditingPts(item.id), setPtsInput(item.storyPoints != null ? String(item.storyPoints) : ''))}
                    style={{ cursor: isViewer ? 'default' : 'pointer' }} title={isViewer ? '' : 'Click to set story points'}>
                    <PointsBadge points={item.storyPoints}/>
                  </div>
                )}
              </div>

              {/* Assign to sprint button */}
              {!isViewer && sprints.filter(s => s.status === 'planning' || s.status === 'active').length > 0 && (
                <div style={{ flexShrink: 0, position: 'relative' }}>
                  <SprintAssignDropdown
                    sprints={sprints.filter(s => s.status === 'planning' || s.status === 'active')}
                    activeSprint={activeSprint}
                    onAssign={sprintId => handleAssignToSprint(item.id, sprintId)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SprintAssignDropdown({
  sprints, activeSprint, onAssign,
}: {
  sprints: Sprint[];
  activeSprint?: Sprint;
  onAssign: (sprintId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        + Sprint ▾
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }}/>
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 180, overflow: 'hidden' }}>
            {sprints.map(s => (
              <button key={s.id} onClick={() => { onAssign(s.id); setOpen(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: '#374151' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <SprintStatusBadge status={s.status}/>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── SPRINT BOARD ─────────────────────────────────────────────────────────────

function SprintBoard({
  sprint, items, tenantId, isViewer, onBack, onItemChange, onStartSprint, onCompleteSprint,
}: {
  sprint: Sprint;
  items: any[];
  tenantId: string;
  isViewer: boolean;
  onBack: () => void;
  onItemChange: (id: string, field: string, value: any) => void;
  onStartSprint: (id: string) => void;
  onCompleteSprint: (id: string) => void;
}) {
  const COLUMNS = ['Draft', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
  const COL_COLORS: Record<string, { header: string; bg: string; border: string }> = {
    'Draft':       { header: '#f1f5f9', bg: '#f8fafc',  border: '#e2e8f0' },
    'In Progress': { header: '#fef3c7', bg: '#fffbeb',  border: '#fde68a' },
    'On Hold':     { header: '#ffedd5', bg: '#fff7ed',  border: '#fed7aa' },
    'Completed':   { header: '#dcfce7', bg: '#f0fdf4',  border: '#86efac' },
    'Cancelled':   { header: '#fee2e2', bg: '#fef2f2',  border: '#fecaca' },
  };

  const sprintItems = items.filter(i => i.sprintId === sprint.id);
  const totalPts    = sprintItems.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0);
  const donePts     = sprintItems.filter((i: any) => i.status === 'Completed').reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0);

  const daysLeft = sprint.end_date
    ? Math.ceil((new Date(sprint.end_date).getTime() - Date.now()) / 86400000)
    : null;

  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;
    onItemChange(itemId, 'status', status);
    await supabase.from('work_items').update({ status }).eq('id', itemId).eq('tenant_id', tenantId);
    setDragOver(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sprint header */}
      <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onBack}
            style={{ border: 'none', background: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Sprints
          </button>
          <div style={{ width: 1, height: 16, background: '#e2e8f0' }}/>
          <SprintStatusBadge status={sprint.status}/>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{sprint.name}</span>
          {daysLeft !== null && (
            <span style={{ fontSize: 12, color: daysLeft <= 2 ? '#dc2626' : '#64748b', background: daysLeft <= 2 ? '#fef2f2' : '#f1f5f9', padding: '2px 8px', borderRadius: 999 }}>
              {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Ends today' : `${Math.abs(daysLeft)}d overdue`}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Progress</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{donePts} / {totalPts || sprint.capacity_points} pts</div>
            </div>
            <div style={{ width: 100 }}>
              <ProgressBar done={donePts} total={totalPts || sprint.capacity_points} color="#16a34a"/>
            </div>
            {!isViewer && sprint.status === 'planning' && (
              <button onClick={() => onStartSprint(sprint.id)}
                style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#16a34a', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ▶ Start Sprint
              </button>
            )}
            {!isViewer && sprint.status === 'active' && (
              <button onClick={() => onCompleteSprint(sprint.id)}
                style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ✓ Complete Sprint
              </button>
            )}
          </div>
        </div>
        {sprint.goal && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
            Goal: {sprint.goal}
          </div>
        )}
      </div>

      {/* Kanban columns */}
      <div style={{ flex: 1, display: 'flex', gap: 12, padding: '16px', overflowX: 'auto', overflowY: 'hidden', alignItems: 'flex-start' }}>
        {COLUMNS.map(col => {
          const colItems = sprintItems.filter((i: any) => i.status === col);
          const colPts   = colItems.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0);
          const c        = COL_COLORS[col];
          return (
            <div key={col}
              onDragOver={e => { e.preventDefault(); setDragOver(col); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, col)}
              style={{ minWidth: 220, flex: '1 1 220px', display: 'flex', flexDirection: 'column', borderRadius: 10,
                border: `1px solid ${dragOver === col ? '#2563eb' : c.border}`,
                background: dragOver === col ? '#eff6ff' : c.bg, overflow: 'hidden', maxHeight: '100%' }}>
              {/* Column header */}
              <div style={{ padding: '10px 12px', background: c.header, borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{col}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {colPts > 0 && <span style={{ fontSize: 10, color: '#64748b' }}>{colPts} pts</span>}
                  <span style={{ fontSize: 11, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 999, padding: '1px 7px', color: '#374151', fontWeight: 600 }}>{colItems.length}</span>
                </div>
              </div>
              {/* Cards */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {colItems.map((item: any) => (
                  <div key={item.id}
                    draggable={!isViewer}
                    onDragStart={e => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; }}
                    style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px',
                      cursor: isViewer ? 'default' : 'grab', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'box-shadow 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <SubtypeBadge subtype={item.itemSubtype}/>
                      <PointsBadge points={item.storyPoints}/>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', lineHeight: 1.4 }}>
                      {item.title || '(Untitled)'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>{item.key}</span>
                      {item.assigned && (
                        <span style={{ marginLeft: 'auto', fontSize: 10, background: '#f1f5f9', borderRadius: 999, padding: '1px 6px', color: '#64748b' }}>
                          @{item.assigned}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {colItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 8px', color: '#cbd5e1', fontSize: 12 }}>Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SPRINT PLANNING VIEW ─────────────────────────────────────────────────────

function SprintPlanning({
  sprint, items, tenantId, isViewer, onBack, onItemChange, onStartSprint,
}: {
  sprint: Sprint;
  items: any[];
  tenantId: string;
  isViewer: boolean;
  onBack: () => void;
  onItemChange: (id: string, field: string, value: any) => void;
  onStartSprint: (id: string) => void;
}) {
  const BACKLOG_TYPES = ['task', 'subtask'];

  const backlogItems = items
    .filter(i => !i.sprintId && BACKLOG_TYPES.includes(i.type))
    .sort((a: any, b: any) => (a.backlogOrder ?? 9999) - (b.backlogOrder ?? 9999));

  const sprintItems = items.filter(i => i.sprintId === sprint.id);

  const totalPts    = sprintItems.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0);
  const capacityPct = sprint.capacity_points > 0 ? Math.min(100, Math.round((totalPts / sprint.capacity_points) * 100)) : 0;

  const handleMoveToSprint = async (itemId: string) => {
    onItemChange(itemId, 'sprintId', sprint.id);
    await setItemSprint(itemId, sprint.id, tenantId);
  };

  const handleMoveToBacklog = async (itemId: string) => {
    onItemChange(itemId, 'sprintId', null);
    await setItemSprint(itemId, null, tenantId);
  };

  const paneStyle: React.CSSProperties = {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
    border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: 'white',
  };
  const paneHeaderStyle: React.CSSProperties = {
    padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
    fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', flexShrink: 0,
  };

  const ItemRow = ({ item, action, actionLabel, actionColor }: { item: any; action: () => void; actionLabel: string; actionColor: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
      borderBottom: '1px solid #f1f5f9', background: 'white', transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
      <SubtypeBadge subtype={item.itemSubtype}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title || '(Untitled)'}
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>{item.key}</span>
      </div>
      <PointsBadge points={item.storyPoints}/>
      {!isViewer && (
        <button onClick={action}
          style={{ padding: '3px 10px', borderRadius: 5, border: `1px solid ${actionColor}`, background: 'white', color: actionColor, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{ border: 'none', background: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Sprints
          </button>
          <div style={{ width: 1, height: 16, background: '#e2e8f0' }}/>
          <SprintStatusBadge status={sprint.status}/>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{sprint.name} — Planning</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Capacity meter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Capacity</span>
              <div style={{ width: 80, height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${capacityPct}%`, borderRadius: 3, transition: 'width 0.3s',
                  background: capacityPct >= 100 ? '#dc2626' : capacityPct >= 80 ? '#f59e0b' : '#16a34a' }}/>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: capacityPct >= 100 ? '#dc2626' : '#1e293b' }}>
                {totalPts} / {sprint.capacity_points} pts
              </span>
            </div>
            {!isViewer && sprint.status === 'planning' && (
              <button onClick={() => onStartSprint(sprint.id)}
                style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: '#16a34a', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ▶ Start Sprint
              </button>
            )}
          </div>
        </div>
        {sprint.goal && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#475569', fontStyle: 'italic' }}>Goal: {sprint.goal}</div>
        )}
      </div>

      {/* Split pane */}
      <div style={{ flex: 1, display: 'flex', gap: 16, padding: '16px', overflow: 'hidden' }}>
        {/* Backlog pane */}
        <div style={paneStyle}>
          <div style={paneHeaderStyle}>
            <span>📋 Backlog</span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{backlogItems.length} items</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {backlogItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: 12 }}>
                Backlog is empty
              </div>
            ) : (
              backlogItems.map((item: any) => (
                <ItemRow key={item.id} item={item}
                  action={() => handleMoveToSprint(item.id)}
                  actionLabel="→ Add" actionColor="#2563eb"/>
              ))
            )}
          </div>
        </div>

        {/* Sprint pane */}
        <div style={paneStyle}>
          <div style={paneHeaderStyle}>
            <span>🏃 {sprint.name}</span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>
              {sprintItems.length} items · {totalPts} pts
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sprintItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: 12 }}>
                No items yet. Add from backlog →
              </div>
            ) : (
              sprintItems.map((item: any) => (
                <ItemRow key={item.id} item={item}
                  action={() => handleMoveToBacklog(item.id)}
                  actionLabel="← Remove" actionColor="#dc2626"/>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SPRINT MODULE (MAIN EXPORT) ──────────────────────────────────────────────

interface SprintModuleProps {
  tenantId:     string;
  loggedUser:   string;
  isViewer:     boolean;
  items:        any[];
  onItemChange: (id: string, field: string, value: any) => void;
}

type SubView = 'list' | 'backlog' | 'board' | 'planning';

export default function SprintModule({ tenantId, loggedUser, isViewer, items, onItemChange }: SprintModuleProps) {
  const [sprints,         setSprints]         = useState<Sprint[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [subView,         setSubView]         = useState<SubView>('list');
  const [selectedSprint,  setSelectedSprint]  = useState<Sprint | null>(null);
  const [formSprint,      setFormSprint]      = useState<Partial<Sprint> | null | false>(false); // false = closed

  const load = useCallback(async () => {
    setLoading(true);
    setSprints(await fetchSprints(tenantId));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Real-time subscription
  useEffect(() => {
    const ch = supabase.channel(`sprints:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints', filter: `tenant_id=eq.${tenantId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, load]);

  const handleSaveSprint = (saved: Sprint) => {
    setSprints(p => p.some(s => s.id === saved.id) ? p.map(s => s.id === saved.id ? saved : s) : [saved, ...p]);
    setFormSprint(false);
  };

  const handleDeleteSprint = async (id: string) => {
    if (!window.confirm('Delete this sprint? Items will be moved back to the backlog.')) return;
    // Move items back to backlog
    const affected = items.filter(i => i.sprintId === id);
    await Promise.all(affected.map(i => {
      onItemChange(i.id, 'sprintId', null);
      return setItemSprint(i.id, null, tenantId);
    }));
    await deleteSprint(id);
    setSprints(p => p.filter(s => s.id !== id));
    if (selectedSprint?.id === id) { setSelectedSprint(null); setSubView('list'); }
  };

  const handleSelectSprint = (id: string, view: 'board' | 'planning') => {
    const sprint = sprints.find(s => s.id === id);
    if (!sprint) return;
    setSelectedSprint(sprint);
    setSubView(view);
  };

  const handleStartSprint = async (id: string) => {
    // Only one sprint can be active
    const current = sprints.find(s => s.status === 'active');
    if (current) {
      alert(`"${current.name}" is already active. Complete it before starting a new sprint.`);
      return;
    }
    const sprint = sprints.find(s => s.id === id);
    if (!sprint) return;
    const updated = { ...sprint, status: 'active' as SprintStatus };
    const saved = await saveSprint({ ...updated, tenant_id: tenantId });
    if (saved) {
      setSprints(p => p.map(s => s.id === id ? saved : s));
      setSelectedSprint(saved);
      setSubView('board');
    }
  };

  const handleCompleteSprint = async (id: string) => {
    if (!window.confirm('Mark this sprint as completed? Incomplete items will remain assigned to it.')) return;
    const sprint = sprints.find(s => s.id === id);
    if (!sprint) return;
    const sprintItems = items.filter(i => i.sprintId === id);
    const donePts = sprintItems.filter((i: any) => i.status === 'Completed').reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0);
    const updated = { ...sprint, status: 'completed' as SprintStatus, velocity_points: donePts };
    const saved = await saveSprint({ ...updated, tenant_id: tenantId });
    if (saved) {
      setSprints(p => p.map(s => s.id === id ? saved : s));
      setSelectedSprint(saved);
    }
  };

  // Sub-view tabs
  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: active ? 700 : 400, background: active ? 'white' : 'transparent',
    color: active ? '#1e293b' : '#64748b',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>
        Loading sprints…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'system-ui,sans-serif', fontSize: 13 }}>
      {/* Module tab bar */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', flexShrink: 0 }}>
        <button style={TAB_STYLE(subView === 'list')} onClick={() => { setSubView('list'); setSelectedSprint(null); }}>
          🏁 Sprints
        </button>
        <button style={TAB_STYLE(subView === 'backlog')} onClick={() => { setSubView('backlog'); setSelectedSprint(null); }}>
          📋 Backlog
        </button>
        {selectedSprint && (subView === 'board' || subView === 'planning') && (
          <>
            <span style={{ color: '#e2e8f0', margin: '0 4px' }}>|</span>
            <button style={TAB_STYLE(subView === 'planning')} onClick={() => setSubView('planning')} disabled={selectedSprint.status !== 'planning'}>
              📌 Planning
            </button>
            <button style={TAB_STYLE(subView === 'board')} onClick={() => setSubView('board')}>
              🗂️ Board
            </button>
          </>
        )}
        {!isViewer && (
          <button onClick={() => setFormSprint({})}
            style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + New Sprint
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subView === 'list' && (
          <SprintList
            sprints={sprints}
            items={items}
            isViewer={isViewer}
            onSelectSprint={handleSelectSprint}
            onNewSprint={() => setFormSprint({})}
            onEditSprint={s => setFormSprint(s)}
            onDeleteSprint={handleDeleteSprint}
          />
        )}

        {subView === 'backlog' && (
          <BacklogView
            tenantId={tenantId}
            items={items}
            sprints={sprints}
            isViewer={isViewer}
            onItemChange={onItemChange}
          />
        )}

        {subView === 'board' && selectedSprint && (
          <SprintBoard
            sprint={sprints.find(s => s.id === selectedSprint.id) ?? selectedSprint}
            items={items}
            tenantId={tenantId}
            isViewer={isViewer}
            onBack={() => { setSubView('list'); setSelectedSprint(null); }}
            onItemChange={onItemChange}
            onStartSprint={handleStartSprint}
            onCompleteSprint={handleCompleteSprint}
          />
        )}

        {subView === 'planning' && selectedSprint && (
          <SprintPlanning
            sprint={sprints.find(s => s.id === selectedSprint.id) ?? selectedSprint}
            items={items}
            tenantId={tenantId}
            isViewer={isViewer}
            onBack={() => { setSubView('list'); setSelectedSprint(null); }}
            onItemChange={onItemChange}
            onStartSprint={handleStartSprint}
          />
        )}
      </div>

      {/* Sprint form modal */}
      {formSprint !== false && (
        <SprintForm
          initial={formSprint || null}
          tenantId={tenantId}
          loggedUser={loggedUser}
          onSave={handleSaveSprint}
          onClose={() => setFormSprint(false)}
        />
      )}
    </div>
  );
}
