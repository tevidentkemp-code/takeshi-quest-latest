/**
 * SC-004 representative Edge boundary prototype. NOT a deployed handler.
 *
 * `command` must call the service-only sq_sc004_command RPC with the exact
 * argument object supplied here and return its JSON object. `getUser` must
 * verify the exact supplied JWT against this project's Supabase Auth service.
 * SQL independently checks capability scope and live admin enrollment/session.
 * Passing a local fixture proves only this proposal's tested contract; it does
 * not certify production Edge/PostgREST/Auth/Realtime or cutover acceptance.
 */

const PUBLIC_ACTIONS = new Set(['create_match', 'create_player', 'create_training', 'visit']);
const ISSUE_ACTIONS = new Set(['create_match', 'create_training']);
const CONTROLLER_ACTIONS = new Set([
  'reserve_game', 'complete_game', 'cleanup_game', 'cleanup_match', 'log_go', 'list_roster',
  'update_roster', 'resume', 'renew', 'revoke_controller', 'complete_training',
]);
const ADMIN_ACTIONS = new Set(['admin_action']);
const REGISTER_FIELDS = new Set([
  'name', 'initials', 'first_name', 'last_name', 'nickname', 'avatar_id',
]);
const FORBIDDEN_AUTHORITY_FIELDS = new Set([
  'capability', 'capability_hash', 'controller_token', 'token', 'token_hash',
  'p_token_hash', 'issue_hash', 'p_issue_hash', 'admin_user', 'p_admin_user',
  'admin_session', 'p_admin_session', 'user_id', 'role', 'is_admin',
  'service_role', 'service_key', '__sqadminauthed', 'request_id',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAPABILITY = /^sqmc1_[A-Za-z0-9_-]{43}$/;
const ADMIN_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function parseClaims(token) {
  const segment = token.split('.')[1];
  const raw = segment.replaceAll('-', '+').replaceAll('_', '/');
  const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
  const bytes = Uint8Array.from(atob(padded), value => value.charCodeAt(0));
  const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!object(result)) throw new Error('invalid_claims');
  return result;
}

function forbiddenAuthority(value) {
  if (Array.isArray(value)) return value.some(forbiddenAuthority);
  if (!object(value)) return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_AUTHORITY_FIELDS.has(key.toLowerCase()) || forbiddenAuthority(nested));
}

function freshBytes() {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function hashCapability(capability) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(capability));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function boundedJson(request, maximumBytes) {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader !== null && Number(lengthHeader) > maximumBytes) {
    return { error: 'request_too_large', status: 413 };
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return { error: 'json_required', status: 415 };
  }
  if (!request.body) return { error: 'invalid_request', status: 400 };
  const reader = request.body.getReader();
  const parts = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel();
        return { error: 'request_too_large', status: 413 };
      }
      parts.push(value);
    }
    const all = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { all.set(part, offset); offset += part.length; }
    return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all)) };
  } catch {
    return { error: 'invalid_request', status: 400 };
  } finally {
    reader.releaseLock();
  }
}

function statusFor(code) {
  if (['unauthorized', 'invalid_controller', 'invalid_credentials', 'controller_expired', 'controller_revoked'].includes(code)) return 401;
  if (['forbidden', 'scope_denied', 'admin_required', 'not_admin', 'invalid_admin_session', 'permission_denied', '42501'].includes(code)) return 403;
  if (code === 'not_found') return 404;
  if (['conflict', 'already_complete', 'payload_conflict', 'name_exists', 'roster_conflict'].includes(code)) return 409;
  if (['rate_limited', 'quota_exceeded'].includes(code)) return 429;
  if (['writes_held', 'server_not_configured'].includes(code)) return 503;
  if (['invalid_request', 'invalid_payload', 'unsupported_action', 'invalid_roster'].includes(code)) return 400;
  return 500;
}

export function createSc004Handler({
  command,
  getUser,
  expectedAuthIssuer,
  allowedOrigins = [],
  randomBytes = freshBytes,
  digest = hashCapability,
  now = () => Date.now(),
  maximumBodyBytes = 512 * 1024,
  mutationsEnabled = () => true,
} = {}) {
  if (typeof command !== 'function') throw new TypeError('A service-only RPC adapter is required.');
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.every(origin => typeof origin === 'string' && origin !== '*')) {
    throw new TypeError('Origins must be explicit strings.');
  }
  if (!Number.isSafeInteger(maximumBodyBytes) || maximumBodyBytes < 1) {
    throw new TypeError('A finite positive request limit is required.');
  }
  const origins = new Set(allowedOrigins);

  return async function handle(request) {
    const origin = request.headers.get('origin');
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin' });
    if (origin && origins.has(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization, X-SQ-Match-Controller');
    }
    const response = (payload, status = 200) => Response.json(payload, { status, headers });
    if (origin && !origins.has(origin)) return response({ ok: false, code: 'origin_denied' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return response({ ok: false, code: 'method_not_allowed' }, 405);

    const parsed = await boundedJson(request, maximumBodyBytes);
    if (parsed.error) return response({ ok: false, code: parsed.error }, parsed.status);
    const envelope = parsed.value;
    if (!object(envelope) || Object.keys(envelope).some(key => !['action', 'request_id', 'body'].includes(key)) ||
        typeof envelope.action !== 'string' || !UUID.test(envelope.request_id || '') || !object(envelope.body) ||
        forbiddenAuthority(envelope.body)) {
      return response({ ok: false, code: 'invalid_request' }, 400);
    }
    const { action, body, request_id: requestId } = envelope;
    if (!PUBLIC_ACTIONS.has(action) && !CONTROLLER_ACTIONS.has(action) && !ADMIN_ACTIONS.has(action)) {
      return response({ ok: false, code: 'unsupported_action' }, 400);
    }
    if (action === 'create_player' && Object.keys(body).some(key => !REGISTER_FIELDS.has(key))) {
      return response({ ok: false, code: 'invalid_request' }, 400);
    }
    if (ISSUE_ACTIONS.has(action) && ['match_id', 'game_id', 'id', 'game_number'].some(key => key in body)) {
      return response({ ok: false, code: 'historical_claim_denied' }, 403);
    }
    if (!mutationsEnabled() && !['resume', 'list_roster'].includes(action)) {
      return response({ ok: false, code: 'writes_held' }, 503);
    }

    let tokenHash = null;
    let issuedCapability = null;
    let issueHash = null;
    let adminUser = null;
    let adminSession = null;
    try {
      if (CONTROLLER_ACTIONS.has(action)) {
        const token = request.headers.get('x-sq-match-controller');
        if (!token || !CAPABILITY.test(token)) return response({ ok: false, code: 'invalid_controller' }, 401);
        tokenHash = await digest(token);
      }
      if (ADMIN_ACTIONS.has(action)) {
        if (typeof getUser !== 'function') return response({ ok: false, code: 'server_not_configured' }, 503);
        const bearer = request.headers.get('authorization')?.match(/^Bearer ([^ ]+)$/i)?.[1];
        if (!bearer || !ADMIN_TOKEN.test(bearer)) return response({ ok: false, code: 'invalid_credentials' }, 401);
        // Verify this exact JWT before trusting any decoded claims.
        const verified = await getUser(bearer);
        const user = verified?.data?.user;
        if (verified?.error || !user || !UUID.test(user.id || '') || user.is_anonymous !== false ||
            !user.email_confirmed_at || user.deleted_at) {
          return response({ ok: false, code: 'invalid_credentials' }, 401);
        }
        const claims = parseClaims(bearer);
        if (claims.sub !== user.id || claims.role !== 'authenticated' || claims.is_anonymous === true ||
            !UUID.test(claims.session_id || '') || typeof claims.exp !== 'number' || claims.exp * 1000 <= now() ||
            (expectedAuthIssuer && claims.iss !== expectedAuthIssuer)) {
          return response({ ok: false, code: 'invalid_credentials' }, 401);
        }
        adminUser = user.id;
        adminSession = claims.session_id;
      }
      if (ISSUE_ACTIONS.has(action)) {
        const bytes = await randomBytes();
        if (!(bytes instanceof Uint8Array) || bytes.length !== 32) throw new Error('invalid_random_source');
        issuedCapability = 'sqmc1_' + base64url(bytes);
        issueHash = await digest(issuedCapability);
      }
      const result = await command({
        p_action: action,
        p_token_hash: tokenHash,
        p_body: { ...body, request_id: requestId },
        p_issue_hash: issueHash,
        p_admin_user: adminUser,
        p_admin_session: adminSession,
      });
      if (!object(result) || typeof result.ok !== 'boolean') {
        return response({ ok: false, code: 'invalid_server_response' }, 500);
      }
      if (!result.ok) return response(result, statusFor(result.code));
      return response(issuedCapability ? { ...result, capability: issuedCapability } : result);
    } catch (error) {
      // Error messages/SQL/request fields can contain credentials. Return only
      // a fixed code; the deployed adapter needs separately redacted logging.
      const sqlCode = error?.code;
      if (sqlCode === '42501') return response({ ok: false, code: 'permission_denied' }, 403);
      if (sqlCode === '23505') return response({ ok: false, code: 'conflict' }, 409);
      if (sqlCode === '55000') return response({ ok: false, code: 'writes_held' }, 503);
      if (['22023', '22P02', '23503', '23514'].includes(sqlCode)) {
        return response({ ok: false, code: 'invalid_request' }, 400);
      }
      return response({ ok: false, code: 'operation_failed' }, 500);
    }
  };
}
