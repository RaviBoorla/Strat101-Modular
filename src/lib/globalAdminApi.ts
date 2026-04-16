// src/lib/globalAdminApi.ts
// Global Admin API — all functions used by GlobalAdminPanel.tsx
// to read and write tenant, user, invoice and subscription data via Supabase.

import { supabase } from './supabase';
import { Tenant, TenantUser, Subscription, Invoice, SubStatus } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// READ
// ═══════════════════════════════════════════════════════════════════════════════

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

  if (tenantErr)  console.error('[globalAdminApi] fetchTenants error:', tenantErr.message);
  if (userErr)    console.error('[globalAdminApi] fetchUsers error:', userErr.message);
  if (invoiceErr) console.error('[globalAdminApi] fetchInvoices error:', invoiceErr.message);

  return (rows ?? []).map(row => dbRowToTenant(
    row,
    (users    ?? []).filter((u: any) => u.tenant_id === row.id),
    (invoices ?? []).filter((i: any) => i.tenant_id === row.id),
  ));
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE — TENANTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveTenant(tenant: Tenant): Promise<void> {
  const sub = tenant.subscription;
  const { error } = await supabase.from('tenants').upsert({
    id:            tenant.id,
    name:          tenant.name,
    slug:          tenant.slug,
    plan:          tenant.plan,
    active:        tenant.active,
    // Do NOT include created_at — let DB manage it
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
    feat_ride:      tenant.features.ride,
    feat_chat:      tenant.features.chat,
    feat_sprints:   tenant.features.sprints,
    // Company profile
    industry:        tenant.industry      ?? null,
    sector:          tenant.sector        ?? null,
    // Password policy
    pwd_expiry_days: tenant.pwdExpiryDays ?? null,
    // Work item type activation
    enabled_item_types: tenant.enabledItemTypes ?? null,
  });
  if (error) console.error('[globalAdminApi] saveTenant FAILED:', error.message, '| code:', error.code);
}

export async function suspendTenant(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('tenants').update({ active }).eq('id', id);
  if (error) console.error('[globalAdminApi] suspendTenant FAILED:', error.message);
}

export async function deleteTenant(id: string): Promise<void> {
  const { error } = await supabase.from('tenants').delete().eq('id', id);
  if (error) console.error('[globalAdminApi] deleteTenant FAILED:', error.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE — USERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveUser(user: TenantUser, tenantId: string): Promise<void> {
  let authUserId = user.authUserId ?? null;
  const isNewUser = !authUserId && !!user.email;

  if (isNewUser) {
    try {
      const res = await fetch('/api/create-user', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:      user.email,
          username:   user.username,
          fullName:   user.fullName,
          // sendInvite defaults to true — user gets invite email to set password
          sendInvite: true,
        }),
      });
      const rawText = await res.text();
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { /* ignore */ }

      if (!res.ok) {
        console.error('[globalAdminApi] create-user failed:', data.error ?? rawText);
      } else {
        authUserId = data.id ?? null;
        // If edge fn returned no id (user already existed), find by email
        if (!authUserId) {
          const { data: linked } = await supabase
            .from('tenant_users')
            .select('auth_user_id')
            .eq('email', user.email.toLowerCase())
            .not('auth_user_id', 'is', null)
            .maybeSingle();
          authUserId = linked?.auth_user_id ?? null;
        }
      }
    } catch (e: any) {
      console.error('[globalAdminApi] create-user fetch error:', e.message);
    }
  }

  // For existing users, do a targeted update (not upsert) to avoid overwriting created_at
  // For new users, do an insert
  if (isNewUser) {
    const { error } = await supabase.from('tenant_users').insert({
      id:              user.id,
      tenant_id:       tenantId,
      auth_user_id:    authUserId,
      username:        user.username,
      full_name:       user.fullName,
      email:           user.email,
      role:            user.role,
      active:          user.active,
      approval_status: 'approved',   // admin-created users are pre-approved
    });
    if (error) console.error('[globalAdminApi] saveUser insert failed:', error.message);
  } else {
    const { error } = await supabase.from('tenant_users').update({
      auth_user_id:     authUserId,
      username:         user.username,
      full_name:        user.fullName,
      email:            user.email,
      role:             user.role,
      active:           user.active,
      temp_password:    user.tempPassword    || null,
      password_reset_at:user.passwordResetAt || null,
      must_change_pwd:  user.mustChangePwd   ?? false,
    }).eq('id', user.id);
    if (error) console.error('[globalAdminApi] saveUser update failed:', error.message);
  }
}

// Protected usernames — cannot be deleted
const PROTECTED_USERNAMES = ['raviboorla'];

export async function deleteUser(userId: string): Promise<void> {
  const { data: userRow } = await supabase
    .from('tenant_users')
    .select('auth_user_id, username')
    .eq('id', userId)
    .single();

  if (userRow?.username && PROTECTED_USERNAMES.includes(userRow.username.toLowerCase())) {
    console.error('[globalAdminApi] deleteUser BLOCKED — cannot delete protected admin:', userRow.username);
    return;
  }

  const authUserId = userRow?.auth_user_id ?? null;

  const { error } = await supabase.from('tenant_users').delete().eq('id', userId);
  if (error) { console.error('[globalAdminApi] deleteUser FAILED:', error.message); return; }

  if (authUserId) {
    try {
      const res = await fetch('/api/delete-user', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ authUserId }),
      });
      const data = await res.json();
      if (!res.ok) console.error('[globalAdminApi] delete-user auth failed:', data.error);
    } catch (e: any) {
      console.error('[globalAdminApi] delete-user fetch error:', e.message);
    }
  }
}

/**
 * Record a password reset — stores temp password in DB
 * and calls the set-password edge function to update Supabase Auth.
 */
export async function recordPasswordReset(
  userId:      string,
  tempPassword: string,
): Promise<void> {
  // First get the user's auth_user_id so we can update Supabase Auth
  const { data: userRow } = await supabase
    .from('tenant_users')
    .select('auth_user_id, email')
    .eq('id', userId)
    .single();

  // Update DB record with temp password info
  const { error } = await supabase.from('tenant_users').update({
    temp_password:     tempPassword,
    password_reset_at: new Date().toISOString(),
    must_change_pwd:   true,
  }).eq('id', userId);
  if (error) { console.error('[globalAdminApi] recordPasswordReset DB error:', error.message); return; }

  // Update Supabase Auth password via edge function
  if (userRow?.auth_user_id) {
    try {
      const res = await fetch('/api/set-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          authUserId: userRow.auth_user_id,
          password:   tempPassword,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        console.error('[globalAdminApi] set-password failed:', d.error);
      } else {
      }
    } catch (e: any) {
      console.error('[globalAdminApi] set-password fetch error:', e.message);
    }
  } else {
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE — INVOICES
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveInvoice(invoice: Invoice, tenantId: string): Promise<void> {
  const { error } = await supabase.from('invoices').upsert({
    id: invoice.id, tenant_id: tenantId,
    date: invoice.date, amount: invoice.amount,
    status: invoice.status, period: invoice.period,
  });
  if (error) console.error('[globalAdminApi] saveInvoice error:', error.message);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status:    Invoice['status'],
): Promise<void> {
  const { error } = await supabase
    .from('invoices').update({ status }).eq('id', invoiceId);
  if (error) console.error('[globalAdminApi] updateInvoiceStatus error:', error.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHAPE MAPPING — DB rows → TypeScript types
// ═══════════════════════════════════════════════════════════════════════════════

function dbRowToTenant(row: any, userRows: any[], invoiceRows: any[]): Tenant {
  const subscription: Subscription = {
    status:             (row.sub_status   as SubStatus) ?? 'trialling',
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
    plan:      row.plan        ?? 'starter',
    active:    row.active      ?? false,
    createdAt: row.created_at?.split('T')[0] ?? '',
    features: {
      kanban:    row.feat_kanban    ?? true,
      workitems: row.feat_workitems ?? true,
      create:    row.feat_create    ?? true,
      bot:       row.feat_bot       ?? true,
      reports:   row.feat_reports   ?? true,
      ride:      row.feat_ride      ?? false,
      chat:      row.feat_chat      ?? false,
      sprints:   row.feat_sprints   ?? false,
    },
    users:          userRows.map(dbRowToUser),
    subscription,
    industry:         row.industry          ?? undefined,
    sector:           row.sector            ?? undefined,
    pwdExpiryDays:    row.pwd_expiry_days   ?? null,
    enabledItemTypes: row.enabled_item_types ?? null,
  };
}

function dbRowToUser(u: any): TenantUser {
  return {
    id:              u.id,
    authUserId:      u.auth_user_id  ?? undefined,
    username:        u.username,
    fullName:        u.full_name,
    email:           u.email,
    role:            u.role,
    active:          u.active,
    createdAt:       u.created_at?.split('T')[0] ?? '',
    lastLogin:       u.last_login      ? formatTs(u.last_login)      : undefined,
    lastLoginIp:     u.last_login_ip   ?? undefined,
    tempPassword:    u.temp_password   ?? undefined,
    passwordResetAt: u.password_reset_at ? formatTs(u.password_reset_at) : undefined,
    mustChangePwd:        u.must_change_pwd     ?? false,
    passwordChangedAt:    u.password_changed_at
                            ? formatTs(u.password_changed_at) : undefined,
  };
}

function dbRowToInvoice(i: any): Invoice {
  return { id: i.id, date: i.date, amount: i.amount, status: i.status, period: i.period };
}

// ─── Plan limit helpers ───────────────────────────────────────────────────────
function planItemLimit(plan: string): number {
  return plan === 'enterprise' ? 9999 : plan === 'pro' ? 1000 : 100;
}
function planUserLimit(plan: string): number {
  return plan === 'enterprise' ? 999 : plan === 'pro' ? 25 : 5;
}
function planAiLimit(plan: string): number {
  return plan === 'enterprise' ? 9999 : plan === 'pro' ? 500 : 0;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit',
    });
  } catch { return iso; }
}

export async function recordLoginEvent(
  userId: string, ip: string, device: string,
): Promise<void> {
  const { error } = await supabase.from('login_history').insert({
    user_id: userId, ip_address: ip, device, logged_at: new Date().toISOString(),
  });
  if (error) console.error('[globalAdminApi] recordLoginEvent error:', error.message);
}
