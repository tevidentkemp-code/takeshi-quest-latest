(function(window){
'use strict';
/**
 * SC-004 production browser transport.
 * No table/column proxy and no service credential. Existing sb remains read-only.
 * Credential cache is separate from public state/export and is never authority.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAPABILITY = /^sqmc1_[A-Za-z0-9_-]{43}$/;
const CONTROL_ACTIONS = new Set([
  'reserve_game', 'complete_game', 'cleanup_game', 'cleanup_match', 'log_go', 'list_roster',
  'update_roster', 'resume', 'renew', 'revoke_controller', 'reset_game', 'resume_training', 'renew_training',
]);
const CREDENTIAL_KEY = 'sq.security.match-credentials.v1';
const PENDING_KEY = 'sq.security.pending-completions.v1';
const START_KEY = 'sq.security.pending-starts.v1';
const GO_KEY = 'sq.security.pending-go.v1';
const FORBIDDEN = new Set(['capability', 'token', 'token_hash', 'service_key',
  'service_role', 'admin_user', 'admin_session', 'user_id', 'is_admin', 'role']);

class Sc004Error extends Error {
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
const storageLocks=new WeakMap();
const cloneJson=value=>JSON.parse(JSON.stringify(value));
const identical = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
function publicReceipt(result) {
  const { capability, ...receipt } = result;
  return receipt;
}

function createSc004Client({
  endpoint,
  publicKey,
  fetchImpl = fetch,
  storage,
  getAdminToken = async () => null,
  newRequestId = () => crypto.randomUUID(),
  allowLocalFixture = false,
  requestTimeoutMs = 20000,
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
  let starts = load(START_KEY);
  let goQueue = load(GO_KEY);
  const persist = (key, value) => {
    try { storage.setItem(key, JSON.stringify(value)); }
    catch { throw new Sc004Error('recovery_cache_unavailable'); }
  };
  const strictLoad=key=>{try{const value=JSON.parse(storage.getItem(key)||'{}');if(!object(value))throw new Error();return value;}catch{throw new Sc004Error('recovery_cache_unavailable');}};
  async function locked(job){
    if(window.document&&window.navigator){
      if(!window.navigator.locks?.request)throw new Sc004Error('recovery_lock_unavailable');
      return window.navigator.locks.request('sq.sc004.persistence.v1',{mode:'exclusive'},job);
    }
    // Explicit Node/local VM fixtures share this storage object. Browsers require
    // the real origin-wide Web Lock above before any durable mutation.
    const previous=storageLocks.get(storage)||Promise.resolve();
    const task=previous.then(job);storageLocks.set(storage,task.catch(()=>{}));return task;
  }
  async function changeCache(key,update){return locked(()=>{
    const {next,value}=update(strictLoad(key));persist(key,next);
    if(key===PENDING_KEY)pending=next;else if(key===START_KEY)starts=next;else if(key===GO_KEY)goQueue=next;else credentials={...credentials,...next};
    return value;
  });}
  async function enqueue(key,id,body,action,conflict='pending_payload_conflict'){
    return changeCache(key,current=>{
      const entryKey=typeof id==='function'?id(current):id,prior=current[entryKey];
      if(prior&&!identical(prior.body,body))throw new Sc004Error(conflict);
      const queued=prior||{request_id:newRequestId(),body:cloneJson(body),...(action?{action}:{})};
      return {next:{...current,[entryKey]:queued},value:{key:entryKey,queued}};
    });
  }
  async function forget(key,id,requestId){return changeCache(key,current=>{
    const next={...current};if(next[id]?.request_id===requestId)delete next[id];return{next};
  });}
  const refreshPending=()=>{try{pending=strictLoad(PENDING_KEY);}catch(_){}return pending;};
  const refreshCredentials=()=>{try{credentials={...credentials,...strictLoad(CREDENTIAL_KEY)};}catch(_){}return credentials;};
  const remember = async (result, matchId) => {
    if (!CAPABILITY.test(result.capability || '') || !UUID.test(matchId || ''))throw new Sc004Error('invalid_issued_controller');
    const issued={capability:result.capability,match_id:matchId,expires_at:result.expires_at??null};
    credentials={...credentials,[matchId]:issued};
    try{await changeCache(CREDENTIAL_KEY,current=>({next:{...current,[matchId]:issued}}));return 'persistent';}
    catch{return 'memory_only';}
  };

  async function send(action, body, { matchId, scopeKey = 'match_id', admin = false, requestId } = {}) {
    if (!object(body) || authorityFields(body)) throw new Sc004Error('invalid_request');
    const id = requestId || newRequestId();
    if (!UUID.test(id)) throw new Sc004Error('invalid_request_id');
    const headers = { 'Content-Type': 'application/json', apikey: publicKey };
    if (matchId) {
      const cached = refreshCredentials()[matchId];
      if (!UUID.test(matchId) || cached?.match_id !== matchId ||
          !CAPABILITY.test(cached?.capability || '') || body[scopeKey] !== matchId) {
        throw new Sc004Error('controller_required');
      }
      headers['X-SQ-Match-Controller'] = cached.capability;
    }
    if (admin) {
      const jwt = await getAdminToken();
      if (typeof jwt !== 'string' || !jwt) throw new Sc004Error('admin_sign_in_required');
      headers.Authorization = 'Bearer ' + jwt;
    }
    let response;const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),requestTimeoutMs);
    try {
      response = await fetchImpl(url.href, {
        method: 'POST', headers, cache: 'no-store', signal:abort.signal,
        body: JSON.stringify({ action, request_id: id, body }),
      });
    } catch { throw new Sc004Error('network_unavailable'); }
    finally{clearTimeout(timer);}
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
    async createMatch(body, initiationKey) {
      if (!object(body) || ['match_id', 'game_id', 'id'].some(key => key in body)) {
        throw new Sc004Error('historical_claim_denied');
      }
      const {key,queued}=await enqueue(START_KEY,current=>initiationKey||Object.keys(current).find(k=>!k.startsWith('training:')&&!k.startsWith('legacy:')&&identical(current[k].body,body))||newRequestId(),body,null,'pending_start_conflict');
      const result = await send('create_match',queued.body,{requestId:queued.request_id});
      const recovery = await remember(result, result.match_id);
      await forget(START_KEY,key,queued.request_id);
      // The caller must surface memory_only: refresh would lose this authority.
      return { ...publicReceipt(result), recovery };
    },
    async recoverLegacyMatch(matchId,settings={}) {
      if(!UUID.test(matchId||'')||!object(settings)||Object.keys(settings).some(k=>!['target_wins','match_format','mode','rules'].includes(k)))throw new Sc004Error('invalid_recovery');
      const body=cloneJson({operation:'recover_legacy',match_id:matchId,...settings});
      const {key,queued}=await enqueue(START_KEY,'legacy:'+matchId,body,null,'pending_start_conflict');
      const result=await send('admin_action',queued.body,{admin:true,requestId:queued.request_id});
      if(result.match_id!==matchId||!UUID.test(result.game_id||'')||result.recovered!==true)throw new Sc004Error('receipt_scope_mismatch');
      const recovery=await remember(result,matchId);
      await forget(START_KEY,key,queued.request_id);
      return {...publicReceipt(result),recovery};
    },
    async command(action, matchId, body = {}) {
      if (!CONTROL_ACTIONS.has(action) || action === 'complete_game') {
        throw new Sc004Error('unsupported_action');
      }
      if(['resume_training','renew_training'].includes(action)){
        if('training_id'in body&&body.training_id!==matchId)throw new Sc004Error('scope_denied');
        const result=await send(action,{...body,training_id:matchId},{matchId,scopeKey:'training_id'});
        if(action==='renew_training')await remember({...credentials[matchId],...result},matchId);
        return publicReceipt(result);
      }
      if ('match_id' in body && body.match_id !== matchId) throw new Sc004Error('scope_denied');
      const result = await send(action, { ...body, match_id: matchId }, { matchId });
      if (action === 'renew') {
        if (result.match_id !== matchId || typeof result.expires_at !== 'string') {
          throw new Sc004Error('receipt_scope_mismatch');
        }
        // Renewal extends the existing secret. A lost response must not rotate it.
        const recovery = await remember({ ...credentials[matchId], ...result }, matchId);
        return { ...publicReceipt(result), recovery };
      }
      if (action === 'revoke_controller' || action === 'cleanup_match') {
        await changeCache(CREDENTIAL_KEY,current=>{const next={...current};delete next[matchId];return{next};});
        delete credentials[matchId];
      }
      return publicReceipt(result);
    },
    async completeGame(matchId, body) {
      if (!object(body) || !UUID.test(body.game_id || '') ||
          ('match_id' in body && body.match_id !== matchId) || authorityFields(body)) {
        throw new Sc004Error('invalid_completion');
      }
      const payload = cloneJson({ ...body, match_id: matchId });
      const {queued}=await enqueue(PENDING_KEY,body.game_id,payload);
      const result = await send('complete_game', queued.body, {
        matchId, requestId: queued.request_id,
      });
      if (result.game_id !== body.game_id || result.match_id !== matchId) {
        throw new Sc004Error('receipt_scope_mismatch');
      }
      await forget(PENDING_KEY,body.game_id,queued.request_id); // Removes only this accepted envelope.
      return publicReceipt(result);
    },
    async retryCompletion(gameId) {
      const queued = refreshPending()[gameId];
      if (!queued) throw new Sc004Error('pending_completion_not_found');
      return this.completeGame(queued.body.match_id, queued.body);
    },
    pendingCompletions() {
      return Object.entries(refreshPending()).filter(([,entry])=>!entry.action).map(([gameId, entry]) => ({
        game_id: gameId, match_id: entry.body.match_id, request_id: entry.request_id,
      }));
    },
    hasController(matchId) {return UUID.test(matchId||'') && CAPABILITY.test(refreshCredentials()[matchId]?.capability||'');},
    controllerExpiry(matchId) {return refreshCredentials()[matchId]?.expires_at||null;},
    async logGo(matchId, body) {
      const key=[body.game_id,body.player_id,body.round_number,body.go_number].join(':');
      const payload=cloneJson({...body,match_id:matchId});
      const {queued}=await enqueue(GO_KEY,key,payload,null,'pending_go_conflict');
      const result=await send('log_go',queued.body,{matchId,requestId:queued.request_id});
      await forget(GO_KEY,key,queued.request_id);
      return publicReceipt(result);
    },
    async retryGoEvents() {
      const results=[];try{goQueue=strictLoad(GO_KEY);}catch(_){}
      for(const item of Object.values(goQueue)) results.push(await this.logGo(item.body.match_id,item.body));
      return results;
    },
    async createTraining(body,initiationKey) {
      const {key,queued}=await enqueue(START_KEY,current=>initiationKey?'training:'+initiationKey:Object.keys(current).find(k=>k.startsWith('training:')&&identical(current[k].body,body))||'training:'+newRequestId(),body,null,'pending_start_conflict');
      const result=await send('create_training',queued.body,{requestId:queued.request_id});
      const recovery=await remember(result,result.training_id);
      await forget(START_KEY,key,queued.request_id);
      return {...publicReceipt(result),recovery};
    },
    async completeTraining(trainingId,payload) {
      const key='training:'+trainingId,body=cloneJson({training_id:trainingId,payload});
      const {queued}=await enqueue(PENDING_KEY,key,body,'complete_training');
      const result=await send('complete_training',queued.body,{matchId:trainingId,scopeKey:'training_id',requestId:queued.request_id});
      if(result.training_id!==trainingId)throw new Sc004Error('receipt_scope_mismatch');
      await forget(PENDING_KEY,key,queued.request_id);
      return publicReceipt(result);
    },
    pendingTraining() {return Object.values(refreshPending()).filter(x=>x.action==='complete_training').map(x=>({training_id:x.body.training_id,request_id:x.request_id}));},
    async retryTraining(trainingId) {const item=refreshPending()['training:'+trainingId];if(!item)throw new Sc004Error('pending_completion_not_found');return this.completeTraining(trainingId,item.body.payload);},
    async visit(body) {return publicReceipt(await send('visit',body));},
    async createPlayer(profile) {
      const result = await send('create_player', profile);
      return publicReceipt(result);
    },
    async admin(operation) {
      return publicReceipt(await send('admin_action', operation, { admin: true }));
    },
  });
}

window.createSc004Client=createSc004Client;
window.Sc004Error=Sc004Error;
})(typeof window!=='undefined'?window:globalThis);
