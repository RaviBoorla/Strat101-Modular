import { supabase } from './supabase';

// Map flat DB row ↔ app item shape
export function dbToItem(row: any, links: string[], deps: string[], 
                          comments: any[], attachments: any[]) {
  return {
    id:             row.id,
    key:            row.key,
    type:           row.type,
    title:          row.title,
    description:    row.description   || '',
    currentStatus:  row.current_status || '',
    currentStatusAt:row.current_status_at || '',
    riskStatement:  row.risk_statement || '',
    status:         row.status,
    priority:       row.priority,
    health:         row.health,
    risk:           row.risk,
    impact:         row.impact         || '',
    impactType:     row.impact_type    || '',
    owner:          row.owner          || '',
    assigned:       row.assigned       || '',
    sponsor:        row.sponsor        || '',
    businessUnit:   row.business_unit  || '',
    approvedBudget: row.approved_budget || '',
    actualCost:     row.actual_cost    || '',
    startDate:      row.start_date     || '',
    endDate:        row.end_date       || '',
    progress:       row.progress,
    tags:           row.tags           || [],
    keyResult:      row.key_result     || '',
    updatedAt:      row.updated_at,
    updatedBy:      row.updated_by     || '',
    links,
    dependencies:   deps,
    comments,
    attachments,
  };
}

export async function fetchAllItems(tenantId: string) {
  const [
    { data: rows },
    { data: linkRows },
    { data: depRows },
    { data: commentRows },
    { data: attachRows },
  ] = await Promise.all([
    supabase.from('work_items').select('*').eq('tenant_id', tenantId).order('created_at'),
    supabase.from('item_links').select('from_id, to_id').eq('tenant_id', tenantId),
    supabase.from('item_dependencies').select('item_id, depends_on').eq('tenant_id', tenantId),
    supabase.from('comments').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase.from('attachments').select('*').eq('tenant_id', tenantId),
  ]);

  return (rows || []).map(row => {
    const links = (linkRows || [])
      .filter(l => l.from_id === row.id || l.to_id === row.id)
      .map(l => l.from_id === row.id ? l.to_id : l.from_id);
    const deps  = (depRows  || []).filter(d => d.item_id === row.id).map(d => d.depends_on);
    const comms = (commentRows || []).filter(c => c.item_id === row.id)
      .map(c => ({ id: c.id, text: c.text, ts: c.created_at }));
    const atts  = (attachRows || []).filter(a => a.item_id === row.id)
      .map(a => ({ name: a.name, size: a.size, ext: a.ext, uploadedAt: a.uploaded_at }));
    return dbToItem(row, links, deps, comms, atts);
  });
}

export async function upsertItem(item: any, tenantId: string) {
  const { error } = await supabase.from('work_items').upsert({
    id:               item.id,
    tenant_id:        tenantId,
    key:              item.key,
    type:             item.type,
    title:            item.title,
    description:      item.description     || null,
    current_status:   item.currentStatus   || null,
    current_status_at:item.currentStatusAt || null,
    risk_statement:   item.riskStatement   || null,
    status:           item.status,
    priority:         item.priority,
    health:           item.health,
    risk:             item.risk,
    impact:           item.impact          || null,
    impact_type:      item.impactType      || null,
    owner:            item.owner           || null,
    assigned:         item.assigned        || null,
    sponsor:          item.sponsor         || null,
    business_unit:    item.businessUnit    || null,
    approved_budget:  item.approvedBudget  || null,
    actual_cost:      item.actualCost      || null,
    start_date:       item.startDate       || null,
    end_date:         item.endDate         || null,
    progress:         item.progress,
    tags:             item.tags,
    key_result:       item.keyResult       || null,
    updated_at:       new Date().toISOString(),
    updated_by:       item.updatedBy,
  });
  return error;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('work_items').delete().eq('id', id);
  return error;
}
