-- SC-031 cleanup: remove the unused private session table created during
-- the rejected token-session prototype. It is empty and has no external
-- dependencies. The active additive admin foundation does not use it.

drop table if exists private.sq_admin_sessions;
