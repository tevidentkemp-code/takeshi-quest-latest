/** Test-only local Edge entrypoint. Never deploy to production.
 * Real Auth, controller registry, SQL claims, service reads and SQL writes are
 * unchanged. Only the upstream paid model response is deterministic.
 */
import { allowedOrigins, expectedAuthIssuer, getUser, server, writesEnabled } from '../../supabase/functions/_shared/sc004-runtime.ts';
import { createCommentaryHandler } from '../../supabase/functions/_shared/sc004-commentary.mjs';
const url = new URL(Deno.env.get('SUPABASE_URL') || '');
if (Deno.env.get('SQ_SC004_FIXTURE_STACK_ID') !== 'sc004-supabase-local' ||
    !['127.0.0.1', 'localhost', 'kong'].includes(url.hostname) || url.protocol !== 'http:') {
  throw new Error('Commentary fixture only accepts the isolated SC004 local stack.');
}
const delay = Number(Deno.env.get('SQ_SC004_FIXTURE_DELAY_MS') || 0);
if (!Number.isInteger(delay) || delay < 0 || delay > 3000) throw new Error('Invalid local fixture delay.');
Deno.serve(createCommentaryHandler({ server, getUser, expectedAuthIssuer, allowedOrigins, writesEnabled,
  generate: async () => {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    return { lines: [
      { speaker: 'SARAH', text: 'SC004 isolated security fixture.', intensity: 1 },
      { speaker: 'WADE', text: 'Authorized current game.', intensity: 1 },
      { speaker: 'MICKY', text: 'No paid model request.', intensity: 1 },
    ] };
  },
}));
