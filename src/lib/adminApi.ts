// src/lib/adminApi.ts
// ─── Phase 10: Admin Panel Live Data via Supabase ────────────────────────────
// All functions used by AdminPanel.tsx to read and write tenant, user,
// invoice, and subscription data from Supabase instead of seed data.
//
// HOW TO WIRE UP AdminPanel.tsx:
//   1. Replace useState(initialTenants) with a useEffect that calls fetchTenants()
//   2. Replace every updateTenant / saveTenant / delTenant call with the
//      corresponding function from this file
//   3. Pass onPreviewTenant through unchanged — it only touches local state

import { supabase } from './supabase';
import { Tenant, TenantUser, Subscription, Invoice, SubStatus } from '../types';

// ═════════════════════════════════════════════════════════════════════════════
// READ
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all tenants with their users and invoices in a single batched call.
 * Returns an array shaped identically to DEFAULT_TENANTS so AdminPanel
 * needs zero changes to its rendering logic.
 */
export async function fetchTenants(): Promise<Tenant[]> {
  const [
    { data: rows,     error: tenantErr  },
    { data: users,    error: userErr    },
    { data: invoices, error: invoiceErr },
  ] = await Promise.all([
    supabase.from('tenants').select('*').order('created_at'),
    supabase.from('tenant_users').select('*').order('created_at'),
    supabase.from('invoices').select('*').order('date', { ascending: false }),
  ]);

  if (tenantErr)  console.error('fetchTenants error:',  tenantErr.message);
  if (userErr)    console.error('fetchUsers error:',    userErr.message);
  if (invoiceErr) console.error('fetchInvoices error:', invoiceErr.message);

  return (rows ?? []).map(row => dbRowToTenant(
    row,
    (users    ?? []).filter((u: any) => u.tenant_id === row.id),
    (invoices ?? []).filter((i: any) => i.tenant_id === row.id),
  ));
}

// ═════════════════════════════════════════════════════════════════════════════
// WRITE — TENANTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Insert a new tenant or update an existing one.
 * Handles both the tenants table columns and the nested subscription fields.
 */
export async function saveTenant(tenant: Tenant): Promise<void> {
  const sub = tenant.subscription;
  const { error } = await supabase.from('tenants').upsert({
    id:            tenant.id,
    name:          tenant.name,
    slug:          tenant.slug,
    plan:          tenant.plan,
    active:        tenant.active,
    created_at:    tenant.createdAt,
    // Subscription columns
    sub_status:    sub.status,
    trial_start:   sub.trialStart   || null,
    trial_end:     sub.trialEnd     || null,
    period_start:  sub.currentPeriodStart || null,
    period_end:    sub.currentPeriodEnd   || null,
    auto_renew:    sub.autoRenew,
    billing_name:  sub.billingName  || null,
    billing_email: sub.billingEmail || null,
    vat_id:        sub.vatId        || null,
    card_last4:    sub.cardLast4    || null,
    card_expiry:   sub.cardExpiry   || null,
    item_count:    sub.itemCount,
    ai_calls:      sub.aiCalls,
    // Feature flags
    feat_kanban:    tenant.features.kanban,
    feat_workitems: tenant.features.workitems,
    feat_create:    tenant.features.create,
    feat_bot:       tenant.features.bot,
    feat_reports:   tenant.features.reports,
  });

  if (error) console.error('[adminApi] saveTenant FAILED:', error.message, '| code:', error.code, '| hint:', error.hint);
  else console.log('[adminApi] saveTenant SUCCESS — id:', tenant.id);
}

/** Soft-delete: set active = false rather than hard-deleting */
export async function suspendTenant(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('tenants').update({ active }).eq('id', id);
  if (error) console.error('[adminApi] suspendTenant FAILED:', error.message);
  else console.log('[adminApi] suspendTenant SUCCESS — id:', id, 'active:', active);
}

/** Hard-delete a tenant (cascades to users, items, invoices via FK) */
export async function deleteTenant(id: string): Promise<void> {
  const { error } = await supabase.from('tenants').delete().eq('id', id);
  if (error) console.error('[adminApi] deleteTenant FAILED:', error.message);
  else console.log('[adminApi] deleteTenant SUCCESS — id:', id);
}

// ═════════════════════════════════════════════════════════════════════════════
// WRITE — USERS
// ═════════════════════════════════════════════════════════════════════════════

/** Upsert a tenant user record */
export async function saveUser(user: TenantUser, tenantId: string): Promise<void> {
  // If this is a new user (no auth_user_id yet), create the Supabase auth account
  // via the server-side Edge Function which holds the service role key.
  let authUserId = user.authUserId ?? null;

  const isNewUser = !authUserId && !!user.email;
  if (isNewUser) {
    try {
      const res = await fetch('/api/create-user', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:      user.email,
          password:   user.tempPassword ?? undefined,
          username:   user.username,
          fullName:   user.fullName,
          sendInvite: user.sendInvite ?? true,
        }),
      });
      const rawText = await res.text();
      console.log('[adminApi] create-user raw response:', res.status, rawText);
      let data: any = {};
      try { data = JSON.parse(rawText); } catch(e) { console.error('[adminApi] JSON parse failed'); }
      if (!res.ok) {
        console.error('[adminApi] create-user failed:', data.error ?? rawText);
      } else {
        if (data.id) {
          // New auth user created — use the returned UUID
          authUserId = data.id;
        } else {
          // User already existed in auth.users (id came back null from edge fn).
          // Look up their UUID directly from auth.users via the service-role RPC.
          // The DB trigger will have already linked it by the time we query.
          const { data: linked } = await supabase
            .from('tenant_users')
            .select('auth_user_id')
            .eq('email', user.email.toLowerCase())
            .not('auth_user_id', 'is', null)
            .maybeSingle();
          if (linked?.auth_user_id) {
            authUserId = linked.auth_user_id;
            console.log('[adminApi] resolved existing auth_user_id by email:', authUserId);
          } else {
            // Trigger not yet in place — edge function now returns the UUID directly
            // so this path should not be reached after the trigger is installed
            console.warn('[adminApi] auth_user_id could not be resolved — ensure DB trigger is installed');
          }
        }
        console.log('[adminApi] auth user — id:', authUserId,
          '| invite sent:', data.inviteSent, '| full response:', data);
        if (data.message) console.log('[adminApi]', data.message);
      }
    } catch (e: any) {
      console.error('[adminApi] create-user fetch error:', e.message);
    }
  }

  const { error } = await supabase.from('tenant_users').upsert({
    id:               user.id,
    tenant_id:        tenantId,
    auth_user_id:     authUserId,
    username:         user.username,
    full_name:        user.fullName,
    email:            user.email,
    role:             user.role,
    active:           user.active,
    created_at:       user.createdAt,
    last_login:       user.lastLogin       || null,
    last_login_ip:    user.lastLoginIp     || null,
    temp_password:    user.tempPassword    || null,
    password_reset_at:user.passwordResetAt || null,
    must_change_pwd:  user.mustChangePwd   ?? false,
  });
  if (error) console.error('[adminApi] saveUser FAILED:', error.message, '| code:', error.code);
  else console.log('[adminApi] saveUser SUCCESS — username:', user.username, '| auth_user_id:', authUserId);
}

// Usernames that can never be deleted through the admin panel
const PROTECTED_USERNAMES = ['raviboorla'];

/** Hard-delete a user from a tenant + removes their Supabase auth account */
export async function deleteUser(userId: string): Promise<void> {
  // 1. Get the auth_user_id before deleting the tenant_users row
  const { data: userRow } = await supabase
    .from('tenant_users')
    .select('auth_user_id, username')
    .eq('id', userId)
    .single();

  // Hard block — platform admins cannot be deleted
  if (userRow?.username && PROTECTED_USERNAMES.includes(userRow.username.toLowerCase())) {
    console.error('[adminApi] deleteUser BLOCKED — cannot delete protected admin:', userRow.username);
    return;
  }

  const authUserId = userRow?.auth_user_id ?? null;

  // 2. Delete from tenant_users
  const { error } = await supabase.from('tenant_users').delete().eq('id', userId);
  if (error) {
    console.error('[adminApi] deleteUser FAILED:', error.message);
    return;
  }

  // 3. Delete from Supabase Auth via edge function (requires service role key)
  if (authUserId) {
    try {
      const res = await fetch('/api/delete-user', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ authUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[adminApi] delete-user auth failed:', data.error);
      } else {
        console.log('[adminApi] auth user deleted — id:', authUserId);
      }
    } catch (e: any) {
      console.error('[adminApi] delete-user fetch error:', e.message);
    }
  } else {
    console.warn('[adminApi] deleteUser — no auth_user_id found, only tenant_users row removed');
  }

  console.log('[adminApi] deleteUser SUCCESS — username:', userRow?.username);
}

/**
 * Record a password reset event.
 * In production this would also trigger a Supabase Auth password reset email.
 * Here we just write the temp password and reset timestamp to the DB row so
 * the admin console can display the pending status.
 */
export async function recordPasswordReset(
  userId:      string,
  tempPassword: string,
): Promise<void> {
  const { error } = await supabase.from('tenant_users').update({
    temp_password:     tempPassword,
    password_reset_at: new Date().toISOString(),
    must_change_pwd:   true,
  }).eq('id', userId);
  if (error) console.error('recordPasswordReset error:', error.message);
}

/** Append a login history record for a user */
export async function recordLoginEvent(
  userId:    string,
  ip:        string,
  device:    string,
): Promise<void> {
  const { error } = await supabase.from('login_history').insert({
    user_id:    userId,
    ip_address: ip,
    device,
    logged_at:  new Date().toISOString(),
  });
  if (error) console.error('recordLoginEvent error:', error.message);
}

// ═════════════════════════════════════════════════════════════════════════════
// WRITE — INVOICES
// ═════════════════════════════════════════════════════════════════════════════

/** Upsert a single invoice */
export async function saveInvoice(invoice: Invoice, tenantId: string): Promise<void> {
  const { error } = await supabase.from('invoices').upsert({
    id:         invoice.id,
    tenant_id:  tenantId,
    date:       invoice.date,
    amount:     invoice.amount,
    status:     invoice.status,
    period:     invoice.period,
  });
  if (error) console.error('saveInvoice error:', error.message);
}

/** Update just the status field of an invoice */
export async function updateInvoiceStatus(
  invoiceId: string,
  status:    Invoice['status'],
): Promise<void> {
  const { error } = await supabase
    .from('invoices').update({ status }).eq('id', invoiceId);
  if (error) console.error('updateInvoiceStatus error:', error.message);
}

// ═════════════════════════════════════════════════════════════════════════════
// SHAPE MAPPING — DB rows → Tenant type
// ═════════════════════════════════════════════════════════════════════════════

function dbRowToTenant(row: any, userRows: any[], invoiceRows: any[]): Tenant {
  const subscription: Subscription = {
    status:             (row.sub_status   as SubStatus) ?? 'active',
    trialStart:         row.trial_start   ?? undefined,
    trialEnd:           row.trial_end     ?? undefined,
    currentPeriodStart: row.period_start  ?? '',
    currentPeriodEnd:   row.period_end    ?? '',
    autoRenew:          row.auto_renew    ?? true,
    billingName:        row.billing_name  ?? '',
    billingEmail:       row.billing_email ?? '',
    vatId:              row.vat_id        ?? undefined,
    cardLast4:          row.card_last4    ?? undefined,
    cardExpiry:         row.card_expiry   ?? undefined,
    itemCount:          row.item_count    ?? 0,
    itemLimit:          planItemLimit(row.plan),
    userCount:          userRows.filter((u: any) => u.active).length,
    userLimit:          planUserLimit(row.plan),
    aiCalls:            row.ai_calls      ?? 0,
    aiCallLimit:        planAiLimit(row.plan),
    invoices:           invoiceRows.map(dbRowToInvoice),
  };

  return {
    id:        row.id,
    name:      row.name,
    slug:      row.slug,
    plan:      row.plan,
    active:    row.active,
    createdAt: row.created_at?.split('T')[0] ?? '',
    features: {
      kanban:    row.feat_kanban    ?? true,
      workitems: row.feat_workitems ?? true,
      create:    row.feat_create    ?? true,
      bot:       row.feat_bot       ?? true,
      reports:   row.feat_reports   ?? true,
      ride:      row.feat_ride      ?? false,
    },
    users: userRows.map(dbRowToUser),
    subscription,
  };
}

function dbRowToUser(u: any): TenantUser {
  return {
    id:             u.id,
    username:       u.username,
    fullName:       u.full_name,
    email:          u.email,
    role:           u.role,
    active:         u.active,
    createdAt:      u.created_at?.split('T')[0] ?? '',
    lastLogin:      u.last_login     ? formatTs(u.last_login)  : undefined,
    lastLoginIp:    u.last_login_ip  ?? undefined,
    tempPassword:   u.temp_password  ?? undefined,
    passwordResetAt:u.password_reset_at ? formatTs(u.password_reset_at) : undefined,
    mustChangePwd:  u.must_change_pwd ?? false,
  };
}

function dbRowToInvoice(i: any): Invoice {
  return {
    id:     i.id,
    date:   i.date,
    amount: i.amount,
    status: i.status,
    period: i.period,
  };
}

// ─── Plan limit helpers (mirrors PLAN_LIMITS in adminData.ts) ─────────────────
function planItemLimit(plan: string): number {
  return plan === 'enterprise' ? 9999 : plan === 'pro' ? 1000 : 100;
}
function planUserLimit(plan: string): number {
  return plan === 'enterprise' ? 999 : plan === 'pro' ? 25 : 5;
}
function planAiLimit(plan: string): number {
  return plan === 'enterprise' ? 9999 : plan === 'pro' ? 500 : 0;
}

/** Format an ISO timestamp as "01 Apr 2026 14:32" */
function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── APPROVAL REQUESTS ────────────────────────────────────────────────────────

export async function fetchApprovals(): Promise<any[]> {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });
  if (error) console.error('[adminApi] fetchApprovals failed:', error.message);
  return data ?? [];
}

export async function approveRequest(
  requestId: string,
  reviewedBy: string
): Promise<void> {
  // Get the request details
  const { data: req, error: fetchErr } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchErr || !req) {
    console.error('[adminApi] approveRequest: could not fetch request');
    return;
  }

  // Activate the user
  await supabase
    .from('tenant_users')
    .update({ active: true })
    .eq('id', req.user_id);

  // Activate the tenant if it was a new_tenant request
  if (req.type === 'new_tenant') {
    await supabase
      .from('tenants')
      .update({ active: true, sub_status: 'trialling' })
      .eq('id', req.tenant_id);
  }

  // Mark the request as approved
  await supabase
    .from('approval_requests')
    .update({
      status:      'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq('id', requestId);

  console.log('[adminApi] approveRequest SUCCESS — id:', requestId);
}

export async function rejectRequest(
  requestId: string,
  reviewedBy: string,
  notes?: string
): Promise<void> {
  const { data: req } = await supabase
    .from('approval_requests')
    .select('user_id, tenant_id, type')
    .eq('id', requestId)
    .single();

  if (req) {
    // Deactivate the user
    await supabase
      .from('tenant_users')
      .update({ active: false })
      .eq('id', req.user_id);

    // Delete the tenant if it was new (nothing to preserve)
    if (req.type === 'new_tenant') {
      await supabase.from('tenants').delete().eq('id', req.tenant_id);
    }
  }

  await supabase
    .from('approval_requests')
    .update({
      status:      'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      notes:       notes ?? null,
    })
    .eq('id', requestId);

  console.log('[adminApi] rejectRequest SUCCESS — id:', requestId);
}
