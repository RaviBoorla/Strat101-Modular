// api/password-expiry-cron.ts — Vercel Cron Job
// Runs daily at 08:00 UTC. Checks each tenant's password policy and:
// - Day (expiry - 10), (expiry - 3), (expiry - 1): sends reminder emails
// - Day expiry + 1: forces a password reset (sends reset link)
// - Day expiry + 3: forces another reset if still not done
// - Day expiry + 5: deactivates the user account

export const config = { runtime: 'edge' };

const WARN_DAYS = [10, 3, 1]; // days before expiry to send reminder

export default async function handler(req: Request): Promise<Response> {
  // Vercel cron sends a GET with Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey      = process.env.RESEND_API_KEY;
  const appUrl         = (process.env.APP_URL ?? 'https://strat101.com').replace(/\/$/, '');

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
  }

  const adminHeaders = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey':        serviceRoleKey,
  };

  // 1. Fetch all tenants with a password policy set
  const tenantsRes = await fetch(
    `${supabaseUrl}/rest/v1/tenants?pwd_expiry_days=not.is.null&active=eq.true&select=id,name,pwd_expiry_days`,
    { headers: adminHeaders }
  );
  const tenants: any[] = await tenantsRes.json();

  const results: string[] = [];
  const now = Date.now();

  for (const tenant of tenants) {
    const expiryDays: number = tenant.pwd_expiry_days;
    const expiryMs = expiryDays * 86400000;

    // Fetch active users for this tenant
    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/tenant_users?tenant_id=eq.${tenant.id}&active=eq.true&approval_status=eq.approved&select=id,auth_user_id,username,full_name,email,password_changed_at,role`,
      { headers: adminHeaders }
    );
    const users: any[] = await usersRes.json();

    for (const user of users) {
      if (!user.email) continue;

      const changedAt = user.password_changed_at
        ? new Date(user.password_changed_at).getTime()
        : null;

      // If password has never been set, treat created_at as the reference
      // (they got an invite — they should set a password)
      if (!changedAt) continue;

      const ageMs     = now - changedAt;
      const ageDays   = Math.floor(ageMs / 86400000);
      const daysLeft  = expiryDays - ageDays;

      // ── Warning reminders ─────────────────────────────────────────────────
      if (WARN_DAYS.includes(daysLeft)) {
        await sendExpiryWarning(user, tenant.name, daysLeft, resendKey, appUrl);
        results.push(`WARN d${daysLeft} → ${user.email}`);
      }

      // ── Day 0 / expired — force reset (day 1 and day 3 after expiry) ─────
      if (ageDays === expiryDays + 1 || ageDays === expiryDays + 3) {
        await sendForceReset(user, tenant.name, resendKey, appUrl, supabaseUrl, adminHeaders);
        results.push(`FORCE_RESET d+${ageDays - expiryDays} → ${user.email}`);
      }

      // ── Day 5 after expiry — deactivate account ───────────────────────────
      if (ageDays === expiryDays + 5) {
        await fetch(
          `${supabaseUrl}/rest/v1/tenant_users?id=eq.${user.id}`,
          { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ active: false }) }
        );
        await sendDeactivatedNotice(user, tenant.name, resendKey, appUrl);
        results.push(`DEACTIVATED → ${user.email}`);
      }
    }
  }

  return new Response(
    JSON.stringify({ ran: new Date().toISOString(), actions: results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// ── Email helpers ─────────────────────────────────────────────────────────────

async function sendExpiryWarning(
  user: any, tenantName: string, daysLeft: number,
  resendKey: string, appUrl: string
) {
  const html = buildWarningEmail(user.full_name, user.username, daysLeft, appUrl, tenantName);
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Strat101.com <hola@mail.strat101.com>',
      to:      [user.email],
      subject: `Your Strat101.com password expires in ${daysLeft} day${daysLeft===1?'':'s'}`,
      html,
    }),
  });
}

async function sendForceReset(
  user: any, tenantName: string, resendKey: string,
  appUrl: string, supabaseUrl: string, adminHeaders: Record<string,string>
) {
  // Generate a reset link
  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ type: 'recovery', email: user.email, options: { redirect_to: appUrl } }),
  });
  if (!linkRes.ok) return;
  const linkData = await linkRes.json();
  const resetUrl = linkData?.action_link ?? '';
  if (!resetUrl) return;

  const html = buildForceResetEmail(user.full_name, user.username, resetUrl, appUrl, tenantName);
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Strat101.com <hola@mail.strat101.com>',
      to:      [user.email],
      subject: 'Action required: Reset your Strat101.com password',
      html,
    }),
  });
}

async function sendDeactivatedNotice(
  user: any, tenantName: string, resendKey: string, appUrl: string
) {
  const html = buildDeactivatedEmail(user.full_name, user.username, appUrl, tenantName);
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Strat101.com <hola@mail.strat101.com>',
      to:      [user.email],
      subject: 'Your Strat101.com account has been deactivated',
      html,
    }),
  });
}

// ── Email templates ───────────────────────────────────────────────────────────

function emailShell(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0e1f35;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="background:#1e3a5f;border-radius:16px 16px 0 0;padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.1);">
<table cellpadding="0" cellspacing="0"><tr>
<td><img src="https://strat101.com/logo.jpg" width="32" height="32" style="border-radius:7px;display:block;"/></td>
<td style="padding-left:10px;"><div style="color:#fff;font-weight:900;font-size:15px;">Strat101.com</div>
<div style="color:#8baecf;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;">Enabling Transformation Journeys</div></td>
</tr></table></td></tr>
<tr><td style="background:#0f1f35;border-left:1px solid rgba(255,255,255,0.07);border-right:1px solid rgba(255,255,255,0.07);padding:28px 24px;">${body}</td></tr>
<tr><td style="background:#162d4a;border-radius:0 0 16px 16px;padding:14px 24px;border-top:1px solid rgba(255,255,255,0.07);">
<div style="color:#8baecf;font-size:11px;text-align:center;">&reg;Strat101.com &nbsp;|&nbsp; &copy;2026 All rights Reserved &nbsp;|&nbsp;
<a href="mailto:Support@Strat101.com" style="color:#93c5fd;text-decoration:none;">Support@Strat101.com</a></div>
</td></tr></table></td></tr></table></body></html>`;
}

function buildWarningEmail(fullName: string, username: string, daysLeft: number, appUrl: string, tenantName: string): string {
  const urgency = daysLeft === 1 ? '#dc2626' : daysLeft === 3 ? '#f59e0b' : '#2563eb';
  return emailShell(`
<div style="color:white;font-size:22px;font-weight:900;margin-bottom:12px;">Password expiring in ${daysLeft} day${daysLeft===1?'':'s'}</div>
<div style="color:#94a3b8;font-size:13px;line-height:1.7;margin-bottom:20px;">
  Hi ${fullName}, your <strong style="color:white;">${tenantName}</strong> password will expire in
  <strong style="color:${urgency};">${daysLeft} day${daysLeft===1?'':'s'}</strong>.
  Reset it now to avoid losing access.
</div>
<div style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.25);border-radius:10px;padding:14px 18px;margin-bottom:20px;">
  <div style="color:#93c5fd;font-size:11px;font-weight:700;margin-bottom:6px;">YOUR ACCOUNT</div>
  <div style="color:#cbd5e1;font-size:12px;">Username: <strong style="color:white;">${username}</strong></div>
</div>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
  <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;text-decoration:none;font-weight:700;font-size:14px;padding:13px 40px;border-radius:10px;">
    Reset My Password →
  </a>
</td></tr></table>
<div style="color:#475569;font-size:11px;text-align:center;margin-top:16px;">
  Log in at <strong style="color:white;">${appUrl}</strong> and use "Forgot password?" to reset.
</div>`);
}

function buildForceResetEmail(fullName: string, username: string, resetUrl: string, appUrl: string, tenantName: string): string {
  return emailShell(`
<div style="background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.3);border-radius:10px;padding:14px 18px;margin-bottom:20px;">
  <div style="color:#f87171;font-size:11px;font-weight:700;margin-bottom:4px;">&#9888; ACTION REQUIRED</div>
  <div style="color:#fca5a5;font-size:12px;line-height:1.6;">Your <strong>${tenantName}</strong> password has expired. Click below to set a new one immediately.</div>
</div>
<div style="color:white;font-size:22px;font-weight:900;margin-bottom:12px;">Password Reset Required</div>
<div style="color:#94a3b8;font-size:13px;line-height:1.7;margin-bottom:20px;">
  Hi ${fullName}, your password expired and must be reset to continue accessing Strat101.com.
  Username: <strong style="color:white;">${username}</strong>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
<tr><td align="center">
  <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#dc2626,#991b1b);color:white;text-decoration:none;font-weight:700;font-size:14px;padding:13px 40px;border-radius:10px;">
    Reset Password Now →
  </a>
</td></tr></table>
<div style="color:#475569;font-size:10px;text-align:center;">Link valid for 24 hours · <a href="${resetUrl}" style="color:#60a5fa;word-break:break-all;">${resetUrl}</a></div>
<div style="color:#f87171;font-size:11px;text-align:center;margin-top:14px;">
  If not reset within 5 days your account will be deactivated.
</div>`);
}

function buildDeactivatedEmail(fullName: string, username: string, appUrl: string, tenantName: string): string {
  return emailShell(`
<div style="color:white;font-size:22px;font-weight:900;margin-bottom:12px;">Account Deactivated</div>
<div style="color:#94a3b8;font-size:13px;line-height:1.7;margin-bottom:20px;">
  Hi ${fullName}, your <strong style="color:white;">${tenantName}</strong> account (@${username}) has been deactivated
  because the password was not reset within the required period.
</div>
<div style="background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.3);border-radius:10px;padding:14px 18px;margin-bottom:20px;">
  <div style="color:#f87171;font-size:12px;line-height:1.6;">
    To regain access, contact your Local Administrator who can request account reactivation.
    Alternatively contact <a href="mailto:Support@Strat101.com" style="color:#60a5fa;">Support@Strat101.com</a>.
  </div>
</div>`);
}
