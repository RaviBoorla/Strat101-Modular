// api/reset-password.ts — Vercel Edge Function
// Sends a password reset link to a user email via Supabase Admin API + Resend.
// Called by GlobalAdminPanel when admin clicks "Reset Password" on a user.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const resendKey      = process.env.RESEND_API_KEY;
  const appUrl         = (process.env.APP_URL ?? process.env.VITE_APP_URL ?? 'https://strat101.com').replace(/\/$/, '');

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'Server misconfigured.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { email, adminInitiated } = body;
  if (!email) {
    return new Response(JSON.stringify({ error: 'Missing email.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const adminHeaders = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey':        serviceRoleKey,
  };

  // Generate a recovery link via Supabase Admin API
  // type=recovery fires PASSWORD_RECOVERY event in the app when user clicks it
  // redirect_to must be the exact app URL — Supabase appends the token as a hash
  // so the app receives #access_token=...&type=recovery
  const redirectTo = appUrl.replace(/\/$/, '');

  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      type:  'recovery',
      email,
      options: { redirect_to: redirectTo },
    }),
  });

  const linkData = await linkRes.json();

  if (!linkRes.ok) {
    console.error('[reset-password] generate_link failed:', JSON.stringify(linkData));
    return new Response(
      JSON.stringify({ error: linkData.msg ?? linkData.message ?? 'Failed to generate reset link.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const resetUrl = linkData?.action_link ?? linkData?.properties?.action_link ?? '';

  if (!resetUrl) {
    return new Response(JSON.stringify({ error: 'No reset URL returned from Supabase.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Send branded email via Resend
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Email service not configured.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const emailHtml = buildResetEmail(resetUrl, appUrl, !!adminInitiated);
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Strat101.com <hola@mail.strat101.com>',
      to:      [email],
      subject: 'Reset your Strat101.com password',
      html:    emailHtml,
    }),
  });

  const emailData = await emailRes.json();

  if (!emailRes.ok) {
    console.error('[reset-password] Resend failed:', JSON.stringify(emailData));
    return new Response(
      JSON.stringify({ error: `Email failed: ${emailData?.message ?? 'Unknown error'}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: `Password reset link sent to ${email}` }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function buildResetEmail(resetUrl: string, appUrl: string, adminInitiated = false): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Reset your Strat101.com password</title></head>
<body style="margin:0;padding:0;background-color:#0e1f35;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0e1f35;min-height:100vh;">
<tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

  <!-- TOP BAR -->
  <tr><td style="background-color:#1e3a5f;border-radius:16px 16px 0 0;padding:16px 28px;border-bottom:1px solid rgba(255,255,255,0.1);">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="40" valign="middle"><img src="https://strat101.com/logo.jpg" alt="Strat101" width="36" height="36" style="width:36px;height:36px;border-radius:8px;display:block;"/></td>
      <td style="padding-left:10px;" valign="middle">
        <div style="color:#ffffff;font-weight:900;font-size:17px;line-height:1.1;">Strat101.com</div>
        <div style="color:#8baecf;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;margin-top:2px;">Enabling Transformation Journeys</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- HERO -->
  <tr><td style="background:linear-gradient(160deg,#0f172a 0%,#1e3a5f 60%,#0f2744 100%);padding:36px 28px 28px;">
    <div style="color:white;font-size:25px;font-weight:900;line-height:1.2;margin-bottom:12px;">
      Reset your password
    </div>
    <div style="color:#94a3b8;font-size:14px;line-height:1.7;">
      ${adminInitiated
        ? 'Your administrator has requested a password reset for your account.'
        : 'We received a request to reset your password.'
      }
      Click the button below to set a new password.
    </div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#0f1f35;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);padding:32px 28px;">

    ${adminInitiated ? `
    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:14px 18px;margin-bottom:24px;">
      <div style="color:#fbbf24;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">&#9888; Security Notice</div>
      <div style="color:#fde68a;font-size:12px;line-height:1.6;">
        This reset was initiated by your platform administrator.
        If you did not expect this, contact <a href="mailto:Support@Strat101.com" style="color:#60a5fa;text-decoration:none;">Support@Strat101.com</a> immediately.
      </div>
    </div>` : `
    <div style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);border-radius:10px;padding:14px 18px;margin-bottom:24px;">
      <div style="color:#93c5fd;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">&#128274; Password Reset Requested</div>
      <div style="color:#bfdbfe;font-size:12px;line-height:1.6;">
        If you didn't request this reset, you can safely ignore this email.
        Your password will not change until you click the link below.
      </div>
    </div>`}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr><td align="center">
        <a href="${resetUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;text-decoration:none;font-weight:700;font-size:15px;padding:15px 48px;border-radius:10px;box-shadow:0 4px 16px rgba(37,99,235,0.45);">
          Reset My Password &#8594;
        </a>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr><td align="center">
        <div style="color:#475569;font-size:11px;margin-bottom:4px;">Button not working? Copy and paste this link:</div>
        <div style="color:#60a5fa;font-size:10px;word-break:break-all;">${resetUrl}</div>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="border-top:1px solid rgba(255,255,255,0.07);font-size:1px;">&nbsp;</td></tr>
    </table>
    <div style="color:#475569;font-size:11px;text-align:center;margin-top:16px;line-height:1.6;">
      This link expires in <strong style="color:#93c5fd;">24 hours</strong> and can only be used once.<br/>
      Open the link in a browser — do not forward this email.<br/>
      After resetting, log in at <strong style="color:white;">${appUrl}</strong>
    </div>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background-color:#162d4a;border-radius:0 0 16px 16px;padding:16px 28px;border-top:1px solid rgba(255,255,255,0.08);">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
      <div style="color:#8baecf;font-size:11px;font-weight:600;">
        &reg;Strat101.com &nbsp;|&nbsp; &copy;Copyright 2026. All rights Reserved. &nbsp;|&nbsp;
        <a href="mailto:Support@Strat101.com" style="color:#93c5fd;text-decoration:none;font-weight:600;">Support@Strat101.com</a>
      </div>
      <div style="color:#475569;font-size:10px;margin-top:8px;line-height:1.6;">
        ${adminInitiated
          ? 'This reset was requested by your platform administrator.'
          : 'You requested this password reset from the Strat101.com login screen.'
        }<br/>
        If unexpected, contact <a href="mailto:Support@Strat101.com" style="color:#60a5fa;text-decoration:none;">Support@Strat101.com</a>.
      </div>
    </td></tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
