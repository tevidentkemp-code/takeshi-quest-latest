// Explicit offline UI transport fixture. No production authorization bypass is
// added to application source. Never use this helper for SEC-05 evidence.
async function installSecurityFixture(context) {
  await context.addInitScript(() => {
    const endpoint='https://sc004-ui-fixture.invalid/functions/v1/sq-match-control';
    window.SQ_SECURITY_CONFIG={...(window.SQ_SECURITY_CONFIG||{}),endpoint};
    const originalFetch=window.fetch.bind(window),cacheKey='sc004.offline-ui-fixture.server.v1';
    let cached={};try{cached=JSON.parse(localStorage.getItem(cacheKey)||'{}');}catch(_){}
    const matches=new Map((cached.matches||[]).map(([id,m])=>[id,{...m,slots:new Map(m.slots||[])}]));
    const training=new Map(cached.training||[]),requests=new Map(cached.requests||[]);
    const persist=()=>localStorage.setItem(cacheKey,JSON.stringify({matches:[...matches].map(([id,m])=>[id,{...m,slots:[...m.slots]}]),training:[...training],requests:[...requests]}));
    const cap=()=> 'sqmc1_'+btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    const now=()=>new Date().toISOString(),expiry=()=>new Date(Date.now()+86400000).toISOString();
    const publicRoster=rows=>(rows||[]).map(p=>({...p,id:p.id||null,name:p.name||'Fixture player'}));
    window.fetch=async function(target,options={}){
      if(String(target)!==endpoint)return originalFetch(target,options);
      const request=JSON.parse(options.body||'{}'),{action,body={},request_id}=request;
      const headers=options.headers||{},secret=headers['X-SQ-Match-Controller'];let result,status=200;
      const match=matches.get(body.match_id),session=training.get(body.training_id);
      const deny=()=>{status=403;result={ok:false,code:'permission_denied'};};
      if(action==='create_match'){
        if(requests.has(request_id))result=requests.get(request_id);
        else{const id=crypto.randomUUID(),capability=cap();result={ok:true,match_id:id,roster:publicRoster(body.roster),mode:body.mode,match_format:body.match_format||'series',rules:body.rules||{},expires_at:expiry(),capability};matches.set(id,{...result,slots:new Map()});requests.set(request_id,result);}
      }else if(action==='create_training'){
        if(requests.has(request_id))result=requests.get(request_id);
        else{const id=crypto.randomUUID();result={ok:true,training_id:id,expires_at:expiry(),capability:cap()};training.set(id,result);requests.set(request_id,result);}
      }else if(action==='complete_training'){
        if(!session||session.capability!==secret)deny();
        else{if(!session.accepted){session.accepted=true;session.payload=body.payload;
          if(window.__trCapture)await window.__trCapture({table:'training_sessions',row:body.payload});
          if(Array.isArray(window.__trStore))window.__trStore.push(body.payload);
        }result={ok:true,training_id:body.training_id,id:body.training_id,created_at:now()};}
      }else if(action==='resume_training'||action==='renew_training'){
        if(!session||session.capability!==secret)deny();else result={ok:true,training_id:body.training_id,expires_at:expiry()};
      }else if(action==='visit')result={ok:true};
      else if(action==='create_player'){result={ok:true,...body,id:crypto.randomUUID()};}
      else if(action==='admin_action'){
        if(headers.Authorization!=='Bearer sc004-ui-fixture-admin')deny();else result={ok:true,operation:body.operation};
      }else if(!match||match.capability!==secret)deny();
      else if(action==='renew')result={ok:true,match_id:body.match_id,expires_at:expiry()};
      else if(action==='resume')result={ok:true,match_id:body.match_id,roster:match.roster,games:[...match.slots.values()]};
      else if(action==='update_roster'){match.roster=publicRoster(body.roster);if(match.mode==='official'&&(match.roster.length<2||match.roster.some(p=>!p.id)))match.mode='practice';result={ok:true,match_id:body.match_id,roster:match.roster,mode:match.mode};}
      else if(action==='reserve_game'){if(!match.slots.has(body.game_number))match.slots.set(body.game_number,{game_id:crypto.randomUUID(),match_id:body.match_id,game_number:body.game_number,status:'pending'});result={ok:true,...match.slots.get(body.game_number)};}
      else if(action==='complete_game'){
        const slot=[...match.slots.values()].find(s=>s.game_id===body.game_id);
        if(!slot)deny();else{slot.status='completed';slot.receipt??={ok:true,id:slot.game_id,game_id:slot.game_id,match_id:body.match_id,created_at:now()};result=slot.receipt;}
      }else if(action==='cleanup_game'){const slot=[...match.slots.values()].find(s=>s.game_id===body.game_id);if(!slot||slot.status==='completed')deny();else{slot.status='cleaned';result={ok:true,game_id:slot.game_id};}}
      else if(action==='cleanup_match'){if([...match.slots.values()].some(s=>s.status==='completed'))deny();else{matches.delete(body.match_id);result={ok:true,match_id:body.match_id};}}
      else if(action==='log_go'||action==='revoke_controller')result={ok:true};
      else{status=400;result={ok:false,code:'unsupported_action'};}
      persist();
      return new Response(JSON.stringify(result),{status,headers:{'Content-Type':'application/json'}});
    };
  });
}
module.exports={installSecurityFixture};
