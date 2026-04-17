// api/notifications-cron.ts — Vercel Cron Job
// Runs daily at 09:00 UTC.
// Sends time-based notification emails for:
//   due_date_3d, due_date_1d, due_date_today
//   overdue_3d, overdue_7d
//   sprint_start, sprint_end

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // Vercel cron sends a GET with an Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey      = process.env.RESEND_API_KEY;
  const appUrl         = (process.env.APP_URL ?? 'https://app.strat101.com').replace(/\/$/, '');

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
  }

  const adminHeaders = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey':        serviceRoleKey,
  };

  // Today as YYYY-MM-DD string (UTC)
  const todayStr = new Date().toISOString().slice(0, 10);

  // Positive = future (days until due), negative = past (days overdue)
  function daysDiff(dateStr: string): number {
    const today  = new Date(todayStr);
    const target = new Date(dateStr);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  // ── 1. Fetch all active tenants ───────────────────────────────────────────
  const tenantsRes = await fetch(
    `${supabaseUrl}/rest/v1/tenants?active=eq.true&select=id,name`,
    { headers: adminHeaders }
  );
  const tenants: { id: string; name: string }[] = await tenantsRes.json();

  const results: string[] = [];
  let totalSent = 0;

  for (const tenant of tenants) {
    // ── 2. Load notification settings ──────────────────────────────────────
    const nsRes  = await fetch(
      `${supabaseUrl}/rest/v1/notification_settings?tenant_id=eq.${tenant.id}&select=settings`,
      { headers: adminHeaders }
    );
    const nsRows = await nsRes.json() as any[];
    const notifSettings: Record<string, { owner: boolean; assigned: boolean; sponsor: boolean }> =
      nsRows?.[0]?.settings ?? {};

    if (!Object.keys(notifSettings).length) continue;

    // ── 3. Load tenant users (name → email map) ─────────────────────────────
    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/tenant_users?tenant_id=eq.${tenant.id}&active=eq.true&select=full_name,email,role`,
      { headers: adminHeaders }
    );
    const tenantUsers: { full_name: string; email: string; role: string }[] = await usersRes.json();

    const emailByName = (name: string | null): string | null => {
      if (!name?.trim()) return null;
      return tenantUsers.find(u =>
        u.full_name?.toLowerCase() === name.trim().toLowerCase()
      )?.email ?? null;
    };

    // ── 4. Due-date & overdue alerts ────────────────────────────────────────
    // Fetch items with a due date that are not complete/cancelled
    const itemsRes = await fetch(
      `${supabaseUrl}/rest/v1/work_items?tenant_id=eq.${tenant.id}&end_date=not.is.null&status=not.in.(Completed,Cancelled)&select=id,key,type,title,status,owner,assigned,sponsor,end_date`,
      { headers: adminHeaders }
    );
    const workItems: any[] = await itemsRes.json();

    const dueEvent = (diff: number): string | null => {
      if (diff ===  3) return 'due_date_3d';
      if (diff ===  1) return 'due_date_1d';
      if (diff ===  0) return 'due_date_today';
      if (diff === -3) return 'overdue_3d';
      if (diff === -7) return 'overdue_7d';
      return null;
    };

    for (const item of workItems) {
      if (!item.end_date) continue;
      const diff  = daysDiff(item.end_date);
      const event = dueEvent(diff);
      if (!event) continue;

      const cfg = notifSettings[event];
      if (!cfg) continue;

      const recipients = new Set<string>();
      if (cfg.owner    && item.owner)    { const e = emailByName(item.owner);    if (e) recipients.add(e); }
      if (cfg.assigned && item.assigned) { const e = emailByName(item.assigned); if (e) recipients.add(e); }
      if (cfg.sponsor  && item.sponsor)  { const e = emailByName(item.sponsor);  if (e) recipients.add(e); }

      for (const toEmail of recipients) {
        const recipientName = tenantUsers.find(u => u.email === toEmail)?.full_name ?? toEmail;
        const subject = buildDueSubject(event, item.key, item.title);
        const html    = buildDueEmail({
          recipientName, event, item, tenantName: tenant.name, appUrl,
        });
        await sendEmail(toEmail, subject, html, resendKey);
        totalSent++;
        results.push(`${event} → ${toEmail} (${item.key})`);
      }
    }

    // ── 5. Sprint start / end alerts ────────────────────────────────────────
    const cfg_start = notifSettings['sprint_start'];
    const cfg_end   = notifSettings['sprint_end'];
    if (!cfg_start && !cfg_end) continue;

    const sprintsRes = await fetch(
      `${supabaseUrl}/rest/v1/sprints?tenant_id=eq.${tenant.id}&status=eq.active&select=id,name,start_date,end_date`,
      { headers: adminHeaders }
    );
    const sprints: any[] = await sprintsRes.json();

    for (const sprint of sprints) {
      const startDiff = sprint.start_date ? daysDiff(sprint.start_date) : null;
      const endDiff   = sprint.end_date   ? daysDiff(sprint.end_date)   : null;

      const isStartToday = startDiff === 0 && cfg_start;
      const isEndToday   = endDiff   === 0 && cfg_end;

      if (!isStartToday && !isEndToday) continue;

      const event = isStartToday ? 'sprint_start' : 'sprint_end';
      const cfg   = isStartToday ? cfg_start       : cfg_end;

      // For sprint events, notify all active users when owner flag is set
      // (sprints don't have an individual owner/assigned/sponsor — broadcast to team)
      if (!cfg!.owner) continue;

      const allEmails = tenantUsers.map(u => u.email).filter(Boolean);
      for (const toEmail of allEmails) {
        const recipientName = tenantUsers.find(u => u.email === toEmail)?.full_name ?? toEmail;
        const subject = event === 'sprint_start'
          ? `Sprint started: ${sprint.name}`
          : `Sprint ending today: ${sprint.name}`;
        const html = buildSprintEmail({
          recipientName, event, sprint, tenantName: tenant.name, appUrl,
        });
        await sendEmail(toEmail, subject, html, resendKey);
        totalSent++;
        results.push(`${event} → ${toEmail} (${sprint.name})`);
      }
    }
  }

  return new Response(
    JSON.stringify({ ran: new Date().toISOString(), sent: totalSent, actions: results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// ─── Resend helper ────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string, resendKey: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Strat101 <hola@mail.strat101.com>',
      to:      [to],
      subject,
      html,
    }),
  });
}

// ─── Subject builders ─────────────────────────────────────────────────────────
function buildDueSubject(event: string, key: string, title: string): string {
  const k = key ? `[${key}] ` : '';
  switch (event) {
    case 'due_date_3d':    return `${k}Due in 3 days: ${title}`;
    case 'due_date_1d':    return `${k}Due tomorrow: ${title}`;
    case 'due_date_today': return `${k}Due today: ${title}`;
    case 'overdue_3d':     return `${k}3 days overdue: ${title}`;
    case 'overdue_7d':     return `${k}7 days overdue ⚠️: ${title}`;
    default:               return `${k}Reminder: ${title}`;
  }
}

function dueHeadline(event: string): string {
  switch (event) {
    case 'due_date_3d':    return 'A work item is due in 3 days';
    case 'due_date_1d':    return 'A work item is due tomorrow';
    case 'due_date_today': return 'A work item is due today';
    case 'overdue_3d':     return 'A work item is 3 days overdue';
    case 'overdue_7d':     return 'A work item is 7 days overdue';
    default:               return 'Work item reminder';
  }
}

function dueAccent(event: string): string {
  if (event === 'overdue_7d') return '#dc2626';
  if (event === 'overdue_3d') return '#f97316';
  if (event === 'due_date_today') return '#f59e0b';
  return '#2563eb';
}

// ─── Email shells (matching existing brand) ───────────────────────────────────
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
<div style="color:#8baecf;font-size:11px;text-align:center;">
  You are receiving this because notifications are enabled for your workspace.
  &nbsp;&middot;&nbsp;
  <a href="https://strat101.com" style="color:#93c5fd;text-decoration:none;">Strat101.com</a>
</div>
</td></tr></table></td></tr></table></body></html>`;
}

function buildDueEmail(opts: {
  recipientName: string; event: string; item: any; tenantName: string; appUrl: string;
}): string {
  const { recipientName, event, item, appUrl } = opts;
  const accent   = dueAccent(event);
  const headline = dueHeadline(event);
  const typeLabel = item.type
    ? item.type.charAt(0).toUpperCase() + item.type.slice(1)
    : 'Item';

  const urgencyBadge = ['overdue_3d', 'overdue_7d'].includes(event)
    ? `<div style="background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.35);border-radius:6px;padding:10px 14px;margin-bottom:16px;">
        <div style="color:#f87171;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;">&#9888; Action Required</div>
        <div style="color:#fca5a5;font-size:12px;margin-top:4px;line-height:1.6;">This item is past its due date. Please review and take action or update the timeline.</div>
       </div>`
    : '';

  return emailShell(`
<div style="display:inline-block;background:${accent}22;border:1px solid ${accent}55;border-radius:6px;padding:3px 10px;margin-bottom:14px;">
  <span style="color:${accent};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">${event.replace(/_/g,' ')}</span>
</div>
<div style="color:white;font-size:20px;font-weight:900;line-height:1.25;margin-bottom:8px;">${headline}</div>
<div style="color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:18px;">
  Hi <strong style="color:white;">${recipientName}</strong>, here's a reminder about a work item that needs your attention.
</div>
${urgencyBadge}
<div style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.25);border-radius:10px;padding:16px 18px;margin-bottom:20px;">
  <div style="color:#93c5fd;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">📦 Work Item</div>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td style="padding-bottom:6px;">
        <span style="background:rgba(255,255,255,0.08);color:#e2e8f0;font-family:monospace;font-size:12px;font-weight:700;padding:2px 8px;border-radius:4px;">${item.key || '—'}</span>
      </td>
    </tr>
    <tr>
      <td style="color:white;font-size:13px;font-weight:600;padding-bottom:8px;">${item.title || '—'}</td>
    </tr>
    <tr>
      <td>
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="color:#8baecf;font-size:11px;padding-right:18px;">Type: <strong style="color:#e2e8f0;">${typeLabel}</strong></td>
            <td style="color:#8baecf;font-size:11px;padding-right:18px;">Status: <strong style="color:#e2e8f0;">${item.status || '—'}</strong></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding-top:10px;border-top:1px solid rgba(255,255,255,0.07);margin-top:8px;">
        <div style="color:#8baecf;font-size:11px;margin-top:8px;">
          Due date: <strong style="color:${accent};font-size:13px;">${item.end_date || '—'}</strong>
          ${item.owner ? `&nbsp;&nbsp;·&nbsp;&nbsp; Owner: <strong style="color:#e2e8f0;">${item.owner}</strong>` : ''}
        </div>
      </td>
    </tr>
  </table>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
<tr><td align="center">
  <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;text-decoration:none;font-weight:700;font-size:14px;padding:12px 36px;border-radius:9px;letter-spacing:0.01em;">
    View Item in Strat101 &rarr;
  </a>
</td></tr></table>`);
}

function buildSprintEmail(opts: {
  recipientName: string; event: string; sprint: any; tenantName: string; appUrl: string;
}): string {
  const { recipientName, event, sprint, appUrl } = opts;
  const isStart  = event === 'sprint_start';
  const accent   = isStart ? '#16a34a' : '#f59e0b';
  const headline = isStart ? `Sprint started: ${sprint.name}` : `Sprint ending today: ${sprint.name}`;
  const icon     = isStart ? '🏃' : '🏁';

  return emailShell(`
<div style="display:inline-block;background:${accent}22;border:1px solid ${accent}55;border-radius:6px;padding:3px 10px;margin-bottom:14px;">
  <span style="color:${accent};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">${event.replace('_', ' ')}</span>
</div>
<div style="color:white;font-size:20px;font-weight:900;line-height:1.25;margin-bottom:8px;">${icon} ${headline}</div>
<div style="color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:18px;">
  Hi <strong style="color:white;">${recipientName}</strong>,
  ${isStart
    ? 'a new sprint has started. Check your backlog and get to work!'
    : 'the current sprint ends today. Make sure all tasks are updated before the sprint closes.'}
</div>
<div style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.25);border-radius:10px;padding:16px 18px;margin-bottom:20px;">
  <div style="color:#93c5fd;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">🏃 Sprint Details</div>
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td style="color:#8baecf;font-size:12px;width:96px;padding-bottom:7px;">Sprint</td>
      <td style="color:white;font-size:13px;font-weight:600;padding-bottom:7px;">${sprint.name}</td>
    </tr>
    ${sprint.start_date ? `<tr>
      <td style="color:#8baecf;font-size:12px;padding-bottom:7px;">Start date</td>
      <td style="color:#e2e8f0;font-size:12px;padding-bottom:7px;">${sprint.start_date}</td>
    </tr>` : ''}
    ${sprint.end_date ? `<tr>
      <td style="color:#8baecf;font-size:12px;">End date</td>
      <td style="color:${accent};font-size:12px;font-weight:700;">${sprint.end_date}</td>
    </tr>` : ''}
  </table>
</div>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
  <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;text-decoration:none;font-weight:700;font-size:14px;padding:12px 36px;border-radius:9px;">
    Open Strat101 &rarr;
  </a>
</td></tr></table>`);
}
