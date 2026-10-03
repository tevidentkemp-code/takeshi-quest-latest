/**
 * SC-004 browser transport proposal; not wired into the production app.
 * No table/column proxy and no service credential. Existing sb remains read-only.
 * Credential cache is separate from public state/export and is never authority.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAPABILITY = /^sqmc1_[A-Za-z0-9_-]{43}$/;
const CONTROL_ACTIONS = new Set([
  'reserve_game', 'complete_game', 'cleanup_game', 'cleanup_match', 'log_go', 'list_roster',
  'update_roster', 'resume', 'renew', 'revoke_controller',
]);
const CREDENTIAL_KEY = 'sq.security.match-credentials.v1';
const PENDING_KEY = 'sq.security.pending-completions.v1';
const FORBIDDEN = new Set(['capability', 'token', 'token_hash', 'service_key',
  'service_role', 'admin_user', 'admin_session', 'user_id', 'is_admin', 'role']);

export class Sc004Error extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'Sc004Error';
    this.code = code;
    this.status = status;
  }
}
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function authorityFields(value) {
  if (Array.isArray(value)) return value.some(authorityFields);
  if (!object(value)) return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN.has(key.toLowerCase()) || authorityFields(nested));
}
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (!object(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])]));
}
const identical = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
function publicReceipt(result) {
  const { capability, ...receipt } = result;
  return receipt;
}

export function createSc004Client({
  endpoint,
  publicKey,
  fetchImpl = fetch,
  storage,
  getAdminToken = async () => null,
  newRequestId = () => crypto.randomUUID(),
  allowLocalFixture = false,
} = {}) {
  const url = new URL(endpoint);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(allowLocalFixture && local && url.protocol === 'http:'))) {
    throw new TypeError('A credential-free HTTPS endpoint is required.');
  }
  if (typeof publicKey !== 'string' || !publicKey || publicKey.startsWith('sb_secret_')) {
    throw new TypeError('Only a public API key belongs in this client.');
  }
  if (publicKey.split('.').length === 3) {
    try {
      const segment = publicKey.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
      const claim = JSON.parse(atob(segment + '='.repeat((4 - segment.length % 4) % 4)));
      if (claim.role !== 'anon') throw new Error('not_anon');
    } catch { throw new TypeError('A legacy API key must have the anon role.'); }
  } else if (!publicKey.startsWith('sb_publishable_')) {
    throw new TypeError('A publishable or legacy anon API key is required.');
  }
  if (typeof fetchImpl !== 'function' || !storage?.getItem || !storage?.setItem) {
    throw new TypeError('Transport and credential/pending cache are required.');
  }

  const load = (key) => {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '{}');
      return object(parsed) ? parsed : {};
    } catch { return {}; }
  };
  let credentials = load(CREDENTIAL_KEY);
  let pending = load(PENDING_KEY);
  const persist = (key, value) => {
    try { storage.setItem(key, JSON.stringify(value)); }
    catch { throw new Sc004Error('recovery_cache_unavailable'); }
  };
  const remember = (result, matchId) => {
    if (!CAPABILITY.test(result.capability || '') || !UUID.test(matchId || '')) {
      throw new Sc004Error('invalid_issued_controller');
    }
    credentials = { ...credentials, [matchId]: {
      capability: result.capability,
      match_id: matchId,
      expires_at: result.expires_at ?? null,
    } };
    try { persist(CREDENTIAL_KEY, credentials); return 'persistent'; }
    catch { return 'memory_only'; }
  };

  async function send(action, body, { matchId, admin = false, requestId } = {}) {
    if (!object(body) || authorityFields(body)) throw new Sc004Error('invalid_request');
    const id = requestId || newRequestId();
    if (!UUID.test(id)) throw new Sc004Error('invalid_request_id');
    const headers = { 'Content-Type': 'application/json', apikey: publicKey };
    if (matchId) {
      const cached = credentials[matchId];
      if (!UUID.test(matchId) || cached?.match_id !== matchId ||
          !CAPABILITY.test(cached?.capability || '') || body.match_id !== matchId) {
        throw new Sc004Error('controller_required');
      }
      headers['X-SQ-Match-Controller'] = cached.capability;
    }
    if (admin) {
      const jwt = await getAdminToken();
      if (typeof jwt !== 'string' || !jwt) throw new Sc004Error('admin_sign_in_required');
      headers.Authorization = 'Bearer ' + jwt;
    }
    let response;
    try {
      response = await fetchImpl(url.href, {
        method: 'POST', headers, cache: 'no-store',
        body: JSON.stringify({ action, request_id: id, body }),
      });
    } catch { throw new Sc004Error('network_unavailable'); }
    let result;
    try { result = await response.json(); }
    catch { throw new Sc004Error('invalid_server_response', response.status); }
    if (!object(result) || result.ok !== true || !response.ok) {
      throw new Sc004Error(
        typeof result?.code === 'string' ? result.code : 'invalid_server_response',
        response.status,
      );
    }
    return result;
  }

  return Object.freeze({
    async createMatch(body) {
      if (!object(body) || ['match_id', 'game_id', 'id'].some(key => key in body)) {
        throw new Sc004Error('historical_claim_denied');
      }
      const result = await send('create_match', body);
      const recovery = remember(result, result.match_id);
      // The caller must surface memory_only: refresh would lose this authority.
      return { ...publicReceipt(result), recovery };
    },
    async command(action, matchId, body = {}) {
      if (!CONTROL_ACTIONS.has(action) || action === 'complete_game') {
        throw new Sc004Error('unsupported_action');
      }
      if ('match_id' in body && body.match_id !== matchId) throw new Sc004Error('scope_denied');
      const result = await send(action, { ...body, match_id: matchId }, { matchId });
      if (action === 'renew') {
        if (result.match_id !== matchId || typeof result.expires_at !== 'string') {
          throw new Sc004Error('receipt_scope_mismatch');
        }
        // Renewal extends the existing secret. A lost response must not rotate it.
        const recovery = remember({ ...credentials[matchId], ...result }, matchId);
        return { ...publicReceipt(result), recovery };
      }
      if (action === 'revoke_controller' || action === 'cleanup_match') {
        const { [matchId]: removed, ...remaining } = credentials;
        credentials = remaining;
        persist(CREDENTIAL_KEY, credentials);
      }
      return publicReceipt(result);
    },
    async completeGame(matchId, body) {
      if (!object(body) || !UUID.test(body.game_id || '') ||
          ('match_id' in body && body.match_id !== matchId) || authorityFields(body)) {
        throw new Sc004Error('invalid_completion');
      }
      const payload = { ...body, match_id: matchId };
      const previous = pending[body.game_id];
      if (previous && !identical(previous.body, payload)) {
        throw new Sc004Error('pending_payload_conflict');
      }
      const queued = previous || { request_id: newRequestId(), body: payload };
      const queuedPending = { ...pending, [body.game_id]: queued };
      persist(PENDING_KEY, queuedPending); // Preserve before any request or lost response.
      pending = queuedPending;
      const result = await send('complete_game', queued.body, {
        matchId, requestId: queued.request_id,
      });
      if (result.game_id !== body.game_id || result.match_id !== matchId) {
        throw new Sc004Error('receipt_scope_mismatch');
      }
      const { [body.game_id]: saved, ...remaining } = pending;
      persist(PENDING_KEY, remaining); // A cache failure retains the exact retry.
      pending = remaining;
      return publicReceipt(result);
    },
    async retryCompletion(gameId) {
      const queued = pending[gameId];
      if (!queued) throw new Sc004Error('pending_completion_not_found');
      return this.completeGame(queued.body.match_id, queued.body);
    },
    pendingCompletions() {
      return Object.entries(pending).map(([gameId, entry]) => ({
        game_id: gameId, match_id: entry.body.match_id, request_id: entry.request_id,
      }));
    },
    async createPlayer(profile) {
      const result = await send('create_player', profile);
      return publicReceipt(result);
    },
    async admin(operation) {
      return publicReceipt(await send('admin_action', operation, { admin: true }));
    },
  });
}
