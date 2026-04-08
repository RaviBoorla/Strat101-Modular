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
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Welcome to Strat101.com</title>
</head>
<body style="margin:0;padding:0;background-color:#0e1f35;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0e1f35;min-height:100vh;">
<tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

  <!-- TOP BAR -->
  <tr>
    <td style="background-color:#1e3a5f;border-radius:16px 16px 0 0;padding:16px 28px;border-bottom:1px solid rgba(255,255,255,0.1);">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="40" valign="middle">
          <img src="https://strat101.com/logo.jpg" alt="Strat101" width="36" height="36"
               style="width:36px;height:36px;border-radius:8px;display:block;"/>
        </td>
        <td style="padding-left:10px;" valign="middle">
          <div style="color:#ffffff;font-weight:900;font-size:17px;line-height:1.1;">Strat101.com</div>
          <div style="color:#8baecf;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;margin-top:2px;">Enabling Transformation Journeys</div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- HERO -->
  <tr>
    <td style="background:linear-gradient(160deg,#0f172a 0%,#1e3a5f 60%,#0f2744 100%);padding:36px 28px 28px;">
      <div style="color:white;font-size:25px;font-weight:900;line-height:1.2;letter-spacing:-0.4px;margin-bottom:12px;">
        Hi ${fullName},<br/>welcome to <span style="color:#60a5fa;">Strat101.com</span>
      </div>
      <div style="color:#94a3b8;font-size:14px;line-height:1.7;">
        Your account has been created. Click the button below to
        <strong style="color:white;">set your own password</strong>
        and start using your workspace.
      </div>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#0f1f35;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);padding:32px 28px;">

      <!-- Account details -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.28);border-radius:10px;padding:16px 20px;">
            <div style="color:#93c5fd;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
              &#128274; Your Account Details
            </div>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="color:#8baecf;font-size:12px;width:76px;padding-bottom:5px;">Username</td>
                <td style="color:white;font-size:12px;font-weight:700;padding-bottom:5px;">${username}</td>
              </tr>
              <tr>
                <td style="color:#8baecf;font-size:12px;">Email</td>
                <td style="color:white;font-size:12px;font-weight:700;">${email}</td>
              </tr>
            </table>
            <div style="color:#475569;font-size:11px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.07);">
              This link is valid for <strong style="color:#93c5fd;">24 hours</strong> and can only be used once.
              After setting your password, log in with your <strong style="color:#93c5fd;">username</strong>.
            </div>
          </td>
        </tr>
      </table>

      <!-- Steps -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr><td style="color:#475569;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:14px;">How to get started</td></tr>
        <tr><td>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="28" valign="top" style="padding-top:1px;">
                <div style="width:22px;height:22px;border-radius:50%;background:rgba(37,99,235,0.3);border:1px solid rgba(37,99,235,0.5);text-align:center;line-height:22px;color:#93c5fd;font-size:11px;font-weight:700;">1</div>
              </td>
              <td style="padding-left:10px;padding-bottom:10px;color:#cbd5e1;font-size:13px;line-height:1.5;">
                Click <strong style="color:white;">Set My Password</strong> below
              </td>
            </tr>
            <tr>
              <td width="28" valign="top" style="padding-top:1px;">
                <div style="width:22px;height:22px;border-radius:50%;background:rgba(37,99,235,0.3);border:1px solid rgba(37,99,235,0.5);text-align:center;line-height:22px;color:#93c5fd;font-size:11px;font-weight:700;">2</div>
              </td>
              <td style="padding-left:10px;padding-bottom:10px;color:#cbd5e1;font-size:13px;line-height:1.5;">
                Choose a strong password (min. 8 characters)
              </td>
            </tr>
            <tr>
              <td width="28" valign="top" style="padding-top:1px;">
                <div style="width:22px;height:22px;border-radius:50%;background:rgba(37,99,235,0.3);border:1px solid rgba(37,99,235,0.5);text-align:center;line-height:22px;color:#93c5fd;font-size:11px;font-weight:700;">3</div>
              </td>
              <td style="padding-left:10px;color:#cbd5e1;font-size:13px;line-height:1.5;">
                Log in at <strong style="color:white;">${appUrl}</strong> using your username: <strong style="color:white;">${username}</strong>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

      <!-- CTA Button — confirmUrl is the Supabase action_link which verifies the
           token and redirects to strat101.com/#access_token=...&type=invite
           The app detects type=invite on load and shows the SetPasswordScreen -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
        <tr>
          <td align="center">
            <a href="${confirmUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;text-decoration:none;font-weight:700;font-size:15px;padding:15px 48px;border-radius:10px;box-shadow:0 4px 16px rgba(37,99,235,0.45);letter-spacing:0.01em;">
              Set My Password &#8594;
            </a>
          </td>
        </tr>
      </table>

      <!-- Fallback link -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
        <tr>
          <td align="center">
            <div style="color:#475569;font-size:11px;margin-bottom:4px;">Button not working? Copy and paste this link into your browser:</div>
            <div style="color:#60a5fa;font-size:10px;word-break:break-all;">${confirmUrl}</div>
          </td>
        </tr>
      </table>

      <!-- Divider -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
        <tr><td style="border-top:1px solid rgba(255,255,255,0.07);font-size:1px;">&nbsp;</td></tr>
      </table>

      <!-- Features -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="color:#475569;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:14px;">
            What you can do with Strat101.com
          </td>
        </tr>
        <tr><td>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" style="padding:5px 8px 5px 0;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="font-size:15px;">&#128301;</td>
                  <td style="padding-left:8px;color:#94a3b8;font-size:12px;">Vision to Subtask hierarchy</td>
                </tr></table>
              </td>
              <td width="50%" style="padding:5px 0 5px 8px;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="font-size:15px;">&#129302;</td>
                  <td style="padding-left:8px;color:#94a3b8;font-size:12px;">AI-powered strategy assist</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding:5px 8px 5px 0;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="font-size:15px;">&#128202;</td>
                  <td style="padding-left:8px;color:#94a3b8;font-size:12px;">Live reports &amp; dashboards</td>
                </tr></table>
              </td>
              <td width="50%" style="padding:5px 0 5px 8px;">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="font-size:15px;">&#128193;</td>
                  <td style="padding-left:8px;color:#94a3b8;font-size:12px;">Kanban boards &amp; workflows</td>
                </tr></table>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background-color:#162d4a;border-radius:0 0 16px 16px;padding:16px 28px;border-top:1px solid rgba(255,255,255,0.08);">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
        <div style="color:#8baecf;font-size:11px;font-weight:600;">
          &reg;Strat101.com &nbsp;|&nbsp; &copy;Copyright 2026. All rights Reserved. &nbsp;|&nbsp;
          <a href="mailto:Support@Strat101.com" style="color:#93c5fd;text-decoration:none;font-weight:600;">Support@Strat101.com</a>
        </div>
        <div style="color:#475569;font-size:10px;margin-top:8px;line-height:1.6;">
          You received this because an administrator created an account for you on Strat101.com.<br/>
          If you did not expect this, please contact
          <a href="mailto:Support@Strat101.com" style="color:#60a5fa;text-decoration:none;">Support@Strat101.com</a>.
        </div>
      </td></tr></table>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
}
