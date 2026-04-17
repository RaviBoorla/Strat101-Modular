// api/on-item-changed.ts — Vercel Edge Function
// Called by the frontend (fire-and-forget POST) after any work item save.
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const resendKey      = process.env.RESEND_API_KEY;
  const appUrl         = (process.env.APP_URL ?? 'https://app.strat101.com').replace(/\/$/, '');

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'Server misconfigured.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  const { tenantId, item, prevItem, changedBy } = body;
  if (!tenantId || !item) {
    return new Response(JSON.stringify({ error: 'Missing tenantId or item.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const dbHeaders = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey':        serviceRoleKey,
  };

  console.log(`[on-item-changed] tenantId=${tenantId} item=${item.key} changedBy=${changedBy}`);

  // Fetch notification settings
  const nsRes = await fetch(
    `${supabaseUrl}/rest/v1/notification_settings?tenant_id=eq.${tenantId}&select=settings`,
    { headers: dbHeaders },
  );
  const nsData = await nsRes.json();
  console.log(`[on-item-changed] nsRes.status=${nsRes.status} nsData=`, JSON.stringify(nsData));

  const notifSettings: Record<string, { owner: boolean; assigned: boolean; sponsor: boolean }> =
    nsData?.[0]?.settings ?? null;

  if (!notifSettings) {
    console.log('[on-item-changed] No notification settings row found — exiting.');
    return new Response(JSON.stringify({ sent: 0, reason: 'No notification settings.' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
  console.log('[on-item-changed] Settings keys:', Object.keys(notifSettings));

  // Fetch active tenant users
  const usersRes = await fetch(
    `${supabaseUrl}/rest/v1/tenant_users?tenant_id=eq.${tenantId}&active=eq.true&select=full_name,email`,
    { headers: dbHeaders },
  );
  const users: { full_name: string; email: string }[] = await usersRes.json();
  console.log(`[on-item-changed] tenant_users found: ${users.length}`, users.map(u => u.full_name));

  const emailByName = (name: string | null | undefined): string | null => {
    if (!name) return null;
    const lower = name.toLowerCase();
    return users.find(u => u.full_name?.toLowerCase() === lower)?.email ?? null;
  };

  // Detect changed events
  const events: string[] = [];

  const itemSprintId    = item.sprintId ?? item.sprint_id ?? null;
  const prevSprintId    = prevItem ? (prevItem.sprintId ?? prevItem.sprint_id ?? null) : null;
  const itemEndDate     = item.endDate ?? item.end_date ?? null;
  const prevEndDate     = prevItem ? (prevItem.endDate ?? prevItem.end_date ?? null) : null;

  console.log(`[on-item-changed] assigned: prev="${prevItem?.assigned}" cur="${item.assigned}"`);
  console.log(`[on-item-changed] owner:    prev="${prevItem?.owner}"    cur="${item.owner}"`);
  console.log(`[on-item-changed] isNew:    ${prevItem === null || prevItem === undefined}`);

  if (prevItem === null || prevItem === undefined) {
    if (item.assigned) events.push('work_item_assignment');
    if (item.owner)    events.push('work_item_ownership');
  } else {
    if (item.assigned !== prevItem.assigned) events.push('work_item_assignment');
    if (item.owner    !== prevItem.owner)    events.push('work_item_ownership');
    if (item.status !== prevItem.status && item.status === 'Completed') events.push('status_completed');
    if (item.risk   !== prevItem.risk   && item.risk)                   events.push('risk_level_change');
    if (itemEndDate !== prevEndDate && itemEndDate)                      events.push('due_date_change');
    if (itemSprintId !== prevSprintId)                                  events.push('story_sprint_change');
  }

  console.log('[on-item-changed] events detected:', events);

  if (events.length === 0) {
    console.log('[on-item-changed] No events detected — exiting.');
    return new Response(JSON.stringify({ sent: 0, events }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!resendKey) {
    console.log('[on-item-changed] RESEND_API_KEY not set — cannot send emails.');
    return new Response(JSON.stringify({ sent: 0, reason: 'No RESEND_API_KEY', events }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  const changedByEmail = emailByName(changedBy);
  console.log(`[on-item-changed] changedByEmail="${changedByEmail}" (will be excluded)`);
  let sentCount = 0;

  for (const event of events) {
    const cfg = notifSettings[event];
    console.log(`[on-item-changed] event="${event}" cfg=`, JSON.stringify(cfg));
    if (!cfg) { console.log(`[on-item-changed] No config for event "${event}" — skipping.`); continue; }

    const recipientEmails = new Set<string>();
    if (cfg.owner    && item.owner)    { const e = emailByName(item.owner);    console.log(`[on-item-changed] owner "${item.owner}" → email "${e}"`);    if (e) recipientEmails.add(e); }
    if (cfg.assigned && item.assigned) { const e = emailByName(item.assigned); console.log(`[on-item-changed] assigned "${item.assigned}" → email "${e}"`); if (e) recipientEmails.add(e); }
    if (cfg.sponsor  && item.sponsor)  { const e = emailByName(item.sponsor);  console.log(`[on-item-changed] sponsor "${item.sponsor}" → email "${e}"`);  if (e) recipientEmails.add(e); }

    if (changedByEmail) {
      if (recipientEmails.has(changedByEmail)) {
        console.log(`[on-item-changed] Excluding changedBy email "${changedByEmail}" from recipients`);
      }
      recipientEmails.delete(changedByEmail);
    }

    console.log(`[on-item-changed] Final recipients for "${event}":`, [...recipientEmails]);

    for (const recipientEmail of recipientEmails) {
      const recipientName = users.find(u => u.email === recipientEmail)?.full_name ?? recipientEmail;
      const subject = buildSubject(event, item);
      const html    = buildItemEmail(event, item, recipientName, changedBy, appUrl, itemEndDate, prevItem);

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Strat101 <hola@mail.strat101.com>',
          to:      [recipientEmail],
          subject,
          html,
        }),
      });
      const emailData = await emailRes.json();
      console.log(`[on-item-changed] Resend → to="${recipientEmail}" status=${emailRes.status}`, JSON.stringify(emailData));
      if (emailRes.ok) sentCount++;
    }
  }

  console.log(`[on-item-changed] Done. sent=${sentCount}`);
  return new Response(JSON.stringify({ sent: sentCount, events }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

function buildSubject(event: string, item: any): string {
  const key   = item.key   ?? '';
  const title = item.title ?? '';
  switch (event) {
    case 'work_item_assignment': return `[${key}] You've been assigned: ${title}`;
    case 'work_item_ownership':  return `[${key}] You're now the owner of: ${title}`;
    case 'status_completed':     return `[${key}] Completed: ${title}`;
    case 'risk_level_change':    return `[${key}] Risk level changed on: ${title}`;
    case 'due_date_change':      return `[${key}] Due date updated on: ${title}`;
    case 'story_sprint_change':  return `[${key}] Sprint changed on: ${title}`;
    default:                     return `[${key}] Update on: ${title}`;
  }
}

function eventHeadline(event: string): string {
  switch (event) {
    case 'work_item_assignment': return "You've been assigned a work item";
    case 'work_item_ownership':  return "You're now the owner of a work item";
    case 'status_completed':     return 'A work item has been completed';
    case 'risk_level_change':    return 'Risk level changed on a work item';
    case 'due_date_change':      return 'Due date updated on a work item';
    case 'story_sprint_change':  return 'Sprint changed on a work item';
    default:                     return 'A work item was updated';
  }
}

function buildChangeDetail(event: string, item: any, changedBy: string, prevItem: any, endDate: string | null): string {
  switch (event) {
    case 'work_item_assignment':
      return `<tr><td style="color:#8baecf;font-size:12px;width:120px;padding-bottom:6px;">Assigned by</td><td style="color:white;font-size:12px;font-weight:600;padding-bottom:6px;">${esc(changedBy)}</td></tr>`;
    case 'work_item_ownership':
      return `<tr><td style="color:#8baecf;font-size:12px;width:120px;padding-bottom:6px;">Changed by</td><td style="color:white;font-size:12px;font-weight:600;padding-bottom:6px;">${esc(changedBy)}</td></tr>`;
    case 'risk_level_change': {
      const prevRisk = prevItem?.risk ?? '—';
      return `<tr><td style="color:#8baecf;font-size:12px;width:120px;padding-bottom:6px;">Risk level</td><td style="color:white;font-size:12px;font-weight:600;padding-bottom:6px;">${esc(String(prevRisk))} &rarr; ${esc(String(item.risk ?? ''))}</td></tr>`;
    }
    case 'due_date_change':
      return `<tr><td style="color:#8baecf;font-size:12px;width:120px;padding-bottom:6px;">New due date</td><td style="color:white;font-size:12px;font-weight:600;padding-bottom:6px;">${esc(endDate ?? '')}</td></tr>`;
    case 'story_sprint_change':
      return `<tr><td style="color:#8baecf;font-size:12px;width:120px;padding-bottom:6px;">Changed by</td><td style="color:white;font-size:12px;font-weight:600;padding-bottom:6px;">${esc(changedBy)}</td></tr>`;
    default:
      return '';
  }
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildItemEmail(
  event: string,
  item: any,
  recipientName: string,
  changedBy: string,
  appUrl: string,
  endDate: string | null,
  prevItem: any,
): string {
  const headline    = eventHeadline(event);
  const changeDetail = buildChangeDetail(event, item, changedBy, prevItem, endDate);
  const key    = esc(item.key   ?? '');
  const title  = esc(item.title ?? '');
  const type   = esc(item.type  ?? '');
  const status = esc(item.status ?? '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${headline}</title>
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
          <div style="color:#ffffff;font-weight:900;font-size:17px;line-height:1.1;">Strat101</div>
          <div style="color:#8baecf;font-size:9px;text-transform:uppercase;letter-spacing:0.12em;margin-top:2px;">Enabling Transformation Journeys</div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:32px 28px;">

      <!-- Greeting -->
      <div style="color:#0e1f35;font-size:15px;margin-bottom:20px;">Hi <strong>${esc(recipientName)}</strong>,</div>

      <!-- Event headline -->
      <div style="color:#0e1f35;font-size:18px;font-weight:700;margin-bottom:24px;line-height:1.3;">${headline}</div>

      <!-- Item info box -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
        <tr>
          <td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom:10px;">
                  <span style="background:#0e1f35;color:#93c5fd;font-family:monospace;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;">${key}</span>
                </td>
              </tr>
              <tr>
                <td style="color:#0e1f35;font-size:14px;font-weight:700;padding-bottom:8px;">${title}</td>
              </tr>
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="color:#64748b;font-size:12px;padding-right:16px;">Type: <strong style="color:#0e1f35;">${type}</strong></td>
                      <td style="color:#64748b;font-size:12px;">Status: <strong style="color:#0e1f35;">${status}</strong></td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${changeDetail ? `<tr><td style="padding-top:12px;border-top:1px solid #e2e8f0;margin-top:12px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:4px;">
                  ${changeDetail}
                </table>
              </td></tr>` : ''}
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA Button -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
        <tr>
          <td align="center">
            <a href="${appUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;text-decoration:none;font-weight:700;font-size:15px;padding:14px 44px;border-radius:10px;box-shadow:0 4px 16px rgba(37,99,235,0.35);letter-spacing:0.01em;">
              View Item &rarr;
            </a>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background-color:#1e3a5f;border-radius:0 0 16px 16px;padding:16px 28px;border-top:1px solid rgba(255,255,255,0.08);">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
        <div style="color:#8baecf;font-size:11px;">
          You are receiving this because notification settings are enabled for your tenant.
          &nbsp;&middot;&nbsp;
          <a href="https://strat101.com" style="color:#93c5fd;text-decoration:none;">Strat101.com</a>
        </div>
      </td></tr></table>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
}
