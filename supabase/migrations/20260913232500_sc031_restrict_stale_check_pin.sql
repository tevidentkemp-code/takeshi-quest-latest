-- SC-031 security hardening: the legacy check_pin RPC references the removed
-- players.password_hash column and has no current application caller.
-- Preserve the function for rollback/history, but remove public API execution.

begin;

revoke execute on function public.check_pin(text, text) from public, anon, authenticated;
grant execute on function public.check_pin(text, text) to service_role;

commit;
