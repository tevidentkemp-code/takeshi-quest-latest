// Retired PIN endpoint. Admin actions now use verified permanent Supabase Auth
// via sq-match-control/admin_action. No PIN/service RPC restoration bypass.
Deno.serve(() => Response.json({ ok: false, code: 'legacy_admin_route_retired' }, {
  status: 410, headers: { 'Cache-Control': 'no-store' },
}));
