// api/create-user.ts — Vercel Edge Function
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const resendKey      = process.env.RESEND_API_KEY;
  const appUrl         = (process.env.APP_URL ?? process.env.VITE_APP_URL ?? 'https://strat101.com').replace(/\/$/, '');

  // Log env state — visible in Vercel function logs
  console.log('ENV:', { hasServiceKey: !!serviceRoleKey, hasUrl: !!supabaseUrl, hasResend: !!resendKey, appUrl });

  if (!serviceRoleKey || !supabaseUrl) {
    console.error('MISSING ENV VARS — serviceRoleKey:', !!serviceRoleKey, 'supabaseUrl:', !!supabaseUrl);
    return new Response(JSON.stringify({ error: 'Server misconfigured.', hasServiceKey: !!serviceRoleKey, hasUrl: !!supabaseUrl }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  const { email, username, fullName, sendInvite } = body;
  if (!email || !username || !fullName) {
    return new Response(JSON.stringify({ error: 'Missing email, username or fullName.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const adminHeaders = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey':        serviceRoleKey,
  };

  // Find existing user by email
  const findUser = async (): Promise<string | null> => {
    const r = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, { headers: adminHeaders });
    if (!r.ok) return null;
    const d = await r.json();
    return (d?.users ?? []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
  };

  let authUserId: string | null = null;
  let confirmUrl = '';

  if (sendInvite !== false) {
    // Generate invite link
    console.log('Calling generate_link for:', email);
    const invRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({
        type: 'invite', email,
        options: { data: { username, full_name: fullName }, redirect_to: `${appUrl}/` },
      }),
    });

    const invData = await invRes.json();
    console.log('generate_link status:', invRes.status, 'ok:', invRes.ok);
    console.log('generate_link response keys:', Object.keys(invData));

    if (invRes.ok) {
      authUserId = invData?.user?.id ?? invData?.id ?? null;
      confirmUrl = invData?.action_link ?? invData?.properties?.action_link ?? '';
      console.log('authUserId:', authUserId, 'confirmUrl length:', confirmUrl.length, 'confirmUrl prefix:', confirmUrl.substring(0, 60));
      if (!authUserId) authUserId = await findUser();
    } else {
      console.log('generate_link failed:', JSON.stringify(invData));
      // User may already exist — find them and send magiclink
      if (invData.code === 'email_exists' || JSON.stringify(invData).includes('already')) {
        authUserId = await findUser();
        if (authUserId) {
          const mlRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
            method: 'POST', headers: adminHeaders,
            body: JSON.stringify({ type: 'magiclink', email, options: { redirect_to: `${appUrl}/` } }),
          });
          const mlData = await mlRes.json();
          confirmUrl = mlData?.action_link ?? mlData?.properties?.action_link ?? '';
          console.log('magiclink status:', mlRes.status, 'confirmUrl length:', confirmUrl.length);
        }
      }
    }

    // Send email via Resend API
    if (confirmUrl && resendKey) {
      console.log('Sending email via Resend to:', email);
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Strat101.com <hola@mail.strat101.com>',
          to:      [email],
          subject: "You've been invited to Strat101.com",
          html:    buildEmail(fullName, username, email, confirmUrl, appUrl),
        }),
      });
      const emailData = await emailRes.json();
      console.log('Resend status:', emailRes.status, 'response:', JSON.stringify(emailData));

      return new Response(JSON.stringify({
        id: authUserId, email, inviteSent: emailRes.ok,
        message: emailRes.ok ? `Invitation sent to ${email}` : `Email failed: ${JSON.stringify(emailData)}`,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (!resendKey) console.warn('No RESEND_API_KEY — cannot send email');
    if (!confirmUrl) console.warn('No confirmUrl generated');

    return new Response(JSON.stringify({
      id: authUserId, email, inviteSent: false,
      message: !resendKey ? 'RESEND_API_KEY missing' : !confirmUrl ? 'No confirmation URL generated' : 'Unknown error',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // No invite — create with password
  const pwd = body.password ?? (Math.random().toString(36).slice(2,10) + 'A1!');
  const cr = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ email, password: pwd, email_confirm: true, user_metadata: { username, full_name: fullName } }),
  });
  const cd = await cr.json();
  if (cr.ok) authUserId = cd.id;
  else if (JSON.stringify(cd).includes('already')) authUserId = await findUser();
  else return new Response(JSON.stringify({ error: cd.msg ?? cd.message ?? 'Create failed' }), { status: cr.status, headers: { 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ id: authUserId, email, inviteSent: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function buildEmail(fullName: string, username: string, email: string, confirmUrl: string, appUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Welcome to Strat101.com</title></head>
<body style="margin:0;padding:0;background:#0e1f35;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0e1f35;min-height:100vh;">
<tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="background:#1e3a5f;border-radius:16px 16px 0 0;padding:16px 28px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="40"><img src="https://strat101.com/logo.jpg" width="36" height="36" style="border-radius:8px;display:block;" alt="S"/></td>
<td style="padding-left:10px;"><div style="color:#fff;font-weight:900;font-size:16px;">Strat101.com</div>
<div style="color:#8baecf;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;">Enabling Transformation Journeys</div></td>
</tr></table></td></tr>
<tr><td style="background:linear-gradient(160deg,#0f172a,#1e3a5f);padding:36px 28px;">
<div style="color:#fff;font-size:24px;font-weight:900;margin-bottom:12px;">Hi ${fullName},<br/>welcome to <span style="color:#60a5fa;">Strat101.com</span></div>
<div style="color:#94a3b8;font-size:14px;line-height:1.7;">Your account is ready. Click below to <strong style="color:#fff;">set your own password</strong> and get started.</div>
</td></tr>
<tr><td style="background:#0f1f35;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);padding:32px 28px;">
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr><td style="background:rgba(37,99,235,0.12);border:1px solid rgba(37,99,235,0.3);border-radius:10px;padding:16px 18px;">
<div style="color:#93c5fd;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:10px;">Your Account</div>
<table cellpadding="0" cellspacing="0" width="100%">
<tr><td style="color:#8baecf;font-size:12px;width:80px;padding-bottom:4px;">Username</td><td style="color:#fff;font-size:12px;font-weight:700;padding-bottom:4px;">${username}</td></tr>
<tr><td style="color:#8baecf;font-size:12px;">Email</td><td style="color:#fff;font-size:12px;font-weight:700;">${email}</td></tr>
</table>
<div style="color:#64748b;font-size:11px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">Link valid for <strong style="color:#93c5fd;">24 hours</strong>, single use only.</div>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr><td align="center">
<a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 40px;border-radius:10px;">
Set My Password &rarr;</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
<tr><td align="center">
<div style="color:#475569;font-size:11px;">Button not working? Copy this link:</div>
<div style="color:#60a5fa;font-size:11px;word-break:break-all;margin-top:4px;">${confirmUrl}</div>
</td></tr></table>
<div style="color:#64748b;font-size:12px;text-align:center;">After setting your password, log in at <strong style="color:#fff;">${appUrl}</strong> with username: <strong style="color:#fff;">${username}</strong></div>
</td></tr>
<tr><td style="background:#162d4a;border-radius:0 0 16px 16px;padding:14px 28px;border-top:1px solid rgba(255,255,255,0.08);">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<div style="color:#8baecf;font-size:11px;">&reg;Strat101.com | &copy;2026 All rights Reserved | <a href="mailto:Support@Strat101.com" style="color:#93c5fd;text-decoration:none;">Support@Strat101.com</a></div>
<div style="color:#475569;font-size:10px;margin-top:6px;">You received this because an admin created an account for you. If unexpected, contact <a href="mailto:Support@Strat101.com" style="color:#60a5fa;text-decoration:none;">support</a>.</div>
</td></tr></table></td></tr>
</table></td></tr></table>
</body></html>`;
}
