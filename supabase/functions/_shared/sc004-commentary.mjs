import { hashCapability, verifyAdminIdentity } from './sc004-handler.mjs';

export function createCommentaryHandler({ server, getUser, expectedAuthIssuer, allowedOrigins, writesEnabled, generate }) {
  const origins = new Set(allowedOrigins);
  return async function handle(request) {
    const origin = request.headers.get('origin');
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin' });
    if (origin && origins.has(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization, X-SQ-Match-Controller');
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    const response = (body, status = 200) => Response.json(body, { status, headers });
    if (origin && !origins.has(origin)) return response({ ok: false, code: 'origin_denied' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return response({ ok: false, code: 'method_not_allowed' }, 405);
    if (!writesEnabled()) return response({ ok: false, code: 'writes_held' }, 503);
    // Bound the stream itself; Content-Length may be absent or forged.
    const reader = request.body?.getReader();
    if (!reader || !request.headers.get('content-type')?.startsWith('application/json')) return response({ ok: false, code: 'invalid_request' }, 400);
    let body;
    try {
      const parts = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 8192) { await reader.cancel(); return response({ ok: false, code: 'request_too_large' }, 413); }
        parts.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
      body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch { return response({ ok: false, code: 'invalid_request' }, 400); }
    finally { reader.releaseLock(); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['game_id', 'mode', 'event_id'].includes(k)) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.game_id || '') ||
        !['studio_intro', 'studio_outro'].includes(body.mode)) return response({ ok: false, code: 'invalid_request' }, 400);
    let tokenHash = null; let identity = null;
    try {
      const token = request.headers.get('x-sq-match-controller');
      if (token) {
        if (!/^sqmc1_[A-Za-z0-9_-]{43}$/.test(token)) return response({ ok: false, code: 'invalid_controller' }, 401);
        tokenHash = await hashCapability(token);
      } else {
        const jwt = request.headers.get('authorization')?.match(/^Bearer ([^ ]+)$/i)?.[1];
        identity = await verifyAdminIdentity(jwt, getUser, expectedAuthIssuer);
        if (!identity) return response({ ok: false, code: 'invalid_credentials' }, 401);
      }
      // This is the first service request. SQL verifies exact game scope plus
      // live registry/session/allowlist, then claims one generation per kind.
      const { data: claim, error } = await server.rpc('sq_sc004_commentary_claim', {
        p_hash: tokenHash, p_game: body.game_id, p_kind: body.mode,
        p_admin_user: identity?.userId || null, p_admin_session: identity?.sessionId || null,
      });
      if (error) throw Object.assign(new Error('authority_failed'), { code: error.code });
      if (!claim?.ok) return response({ ok: false, code: 'permission_denied' }, 403);
      if (claim.skipped) return response({ ok: true, skipped: true });
      const events = await server.from('game_events').select('player_name,created_at,round_label,round_index,dart_index,kind,points')
        .eq('game_id', body.game_id).order('created_at', { ascending: true }).limit(250);
      const previous = await server.from('game_commentary').select('line,created_at').eq('game_id', body.game_id)
        .order('created_at', { ascending: false }).limit(10);
      if (events.error || previous.error) throw new Error('context_failed');
      const context = {
        game_id: body.game_id,
        players: (claim.roster || []).map(p => p.name).filter(Boolean),
        last_lines: (previous.data || []).map(r => r.line).reverse(),
        last_events: (events.data || []).slice(-12).map(r => ({ player: r.player_name, round: r.round_label, dart: r.dart_index, kind: r.kind, points: r.points })),
      };
      const generated = await generate(body.mode, context);
      if (!generated || !Array.isArray(generated.lines)) throw new Error('invalid_model_response');
      const lines = generated.lines.map(l => ({ ...l, text: String(l.text || '').replace(/\s+/g, ' ').trim().slice(0, 180) }));
      const committed = await server.rpc('sq_sc004_commentary_commit', { p_claim: claim.claim_id, p_lines: lines });
      if (committed.error) throw Object.assign(new Error('commit_failed'), { code: committed.error.code });
      return response(committed.data);
    } catch (error) {
      if (error?.code === '42501') return response({ ok: false, code: 'permission_denied' }, 403);
      if (error?.code === '55000') return response({ ok: false, code: 'writes_held' }, 503);
      if (['22023', '22P02', '23514'].includes(error?.code)) return response({ ok: false, code: 'invalid_request' }, 400);
      // Never expose SDK/model errors, body, credentials or context in logs.
      return response({ ok: false, code: 'operation_failed' }, 500);
    }
  };
}
