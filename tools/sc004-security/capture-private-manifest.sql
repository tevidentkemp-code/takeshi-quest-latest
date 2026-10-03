-- Read-only capture after the reviewed additive schema and final functions refresh.
-- No credential hashes, request bodies, receipts, Auth rows or sequence values.
SELECT jsonb_build_object(
  'schema', (SELECT jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),
    'acl',(SELECT jsonb_agg(a::text ORDER BY a::text COLLATE "C") FROM unnest(n.nspacl) a))
    FROM pg_namespace n WHERE n.nspname='private'),
  'relations', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind::text,
    'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'options',to_jsonb(c.reloptions),'acl',(SELECT jsonb_agg(a::text ORDER BY a::text COLLATE "C") FROM unnest(c.relacl) a))
    ORDER BY c.relname::text COLLATE "C"),'[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='private' AND left(c.relname,6)='sc004_' AND c.relkind IN ('r','p','v','m','S')),
  'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'position',a.attnum,
    'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),
    'identity',a.attidentity::text,'generated',a.attgenerated::text,
    'acl',(SELECT jsonb_agg(x::text ORDER BY x::text COLLATE "C") FROM unnest(a.attacl) x))
    ORDER BY c.relname::text COLLATE "C",a.attnum),'[]'::jsonb)
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='private' AND left(c.relname,6)='sc004_' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),
  'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',co.conname,'type',co.contype::text,
    'definition',pg_get_constraintdef(co.oid,true),'validated',co.convalidated)
    ORDER BY c.relname::text COLLATE "C",co.conname::text COLLATE "C"),'[]'::jsonb)
    FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='private' AND left(c.relname,6)='sc004_'),
  'indexes', (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.tablename::text COLLATE "C",i.indexname::text COLLATE "C"),'[]'::jsonb)
    FROM pg_indexes i WHERE i.schemaname='private' AND left(i.tablename,6)='sc004_'),
  'functions', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.proname,
    'identity_arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),
    'security_definer',p.prosecdef,'config',to_jsonb(p.proconfig),
    'acl',(SELECT jsonb_agg(a::text ORDER BY a::text COLLATE "C") FROM unnest(p.proacl) a),
    'definition_md5',md5(pg_get_functiondef(p.oid)))
    ORDER BY p.proname::text COLLATE "C",pg_get_function_identity_arguments(p.oid) COLLATE "C"),'[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND left(p.proname,6)='sc004_'),
  'policies', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.tablename::text COLLATE "C",p.policyname::text COLLATE "C"),'[]'::jsonb)
    FROM pg_policies p WHERE p.schemaname='private' AND left(p.tablename,6)='sc004_'),
  'triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,
    'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled::text)
    ORDER BY c.relname::text COLLATE "C",t.tgname::text COLLATE "C"),'[]'::jsonb)
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='private' AND left(c.relname,6)='sc004_' AND NOT t.tgisinternal),
  'sequences', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.relname,
    'type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,
    'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle) ORDER BY c.relname::text COLLATE "C"),'[]'::jsonb)
    FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='private' AND left(c.relname,6)='sc004_')
);
