-- Read-only additive function identity. No rows, credentials or environment values.
SELECT jsonb_agg(jsonb_build_object(
  'schema',n.nspname,'name',p.proname,
  'identity_arguments',pg_get_function_identity_arguments(p.oid),
  'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,
  'config',to_jsonb(p.proconfig),
  'acl',(SELECT jsonb_agg(a::text ORDER BY a::text COLLATE "C") FROM unnest(p.proacl) a),
  'definition_md5',md5(pg_get_functiondef(p.oid)))
  ORDER BY p.proname::text COLLATE "C",pg_get_function_identity_arguments(p.oid) COLLATE "C")
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND left(p.proname,9)='sq_sc004_';
