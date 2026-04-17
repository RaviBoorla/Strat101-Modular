// api/save-notification-settings.ts — Vercel Edge Function
// Called by GlobalAdminPanel to save notification settings using the service
// role key, bypassing RLS (which blocks global admins writing other tenants).

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { tenantId, settings, updatedBy } = body ?? {};
  if (!tenantId || !settings) {
    return new Response(JSON.stringify({ error: 'Missing tenantId or settings.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const adminHeaders = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey':        serviceRoleKey,
    'Prefer':        'resolution=merge-duplicates',
  };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/notification_settings`,
    {
      method:  'POST',   // upsert via Prefer: resolution=merge-duplicates
      headers: adminHeaders,
      body: JSON.stringify({
        tenant_id:  tenantId,
        settings,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy ?? 'global_admin',
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('[save-notification-settings] Supabase error:', err);
    return new Response(JSON.stringify({ error: 'Failed to save settings.', detail: err }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
