/** Shared semantic cases. The caller supplies the isolated real Supabase transport.
 * This module contains no credentials and no Auth mocks. */
import assert from 'node:assert/strict';
const ql=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function runAdminCases({admin,sql,check,run='admin-'+crypto.randomUUID().slice(0,8)}){
  const ids=Array.from({length:8},()=>crypto.randomUUID());
  const [A,B,C,D,E,F,M,G]=ids;
  const names=['A','B','C','D','E','F'].map(s=>`SC004_ADMIN_${run}_${s}`);
  const [na,nb,nc,nd,ne,nf]=names;
  const at=new Date().toISOString();
  const players=[{id:A,name:na},{id:B,name:nb}];
  const board=players.map(()=>Array.from({length:14},()=>({darts:[{kind:'S',points:10},{kind:'Miss',points:0},{kind:'Miss',points:0}],roundTotal:10})));
  const state={players,board,mode:'official',names:[na,nb],playerIds:[A,B]};
  const j=v=>ql(JSON.stringify(v))+'::jsonb';
  await sql(`INSERT INTO public.players(id,name,initials,avatar_id) VALUES ${[A,B,C,D,E,F].map((id,i)=>`(${ql(id)},${ql(names[i])},'OLD',1)`).join(',')}; INSERT INTO public.matches(id,total_games,players,wins,history) VALUES(${ql(M)},3,${j(players)},'[1,0]',${j([{game_number:1,players,totals:[140,0]}])}); INSERT INTO public.games(id,match_id,game_number,state,stats,totals,finished,mode,is_practice,created_at) VALUES(${ql(G)},${ql(M)},1,${j(state)},${j({players:[{name:na,id:A},{name:nb,id:B}],perPlayer:[{darts:42},{darts:42}]})},ARRAY[140,0],true,'official',false,${ql(at)}); INSERT INTO public.match_players(match_id,player_index,player_id,player_name) VALUES(${ql(M)},0,${ql(A)},${ql(na)}),(${ql(M)},1,${ql(B)},${ql(nb)});`);
  const scalar=async(query)=>String(await sql(query)).trim();
  const json=async(query)=>JSON.parse(await scalar(query));
  const rejects=async(body)=>assert.rejects(()=>admin(body));
  await check('Admin profile update changes only allowlisted fields and returns server row',async()=>{
    const r=await admin({operation:'update_player',player_id:A,profile:{initials:'NEW',nickname:'Alias',first_name:'First',last_name:'Last',avatar_id:29}});
    assert.equal(r.player.id,A);assert.equal(r.player.initials,'NEW');assert.equal(r.player.avatar_id,29);
    await rejects({operation:'update_player',player_id:A,profile:{id:B}});
    assert.equal(await scalar(`SELECT initials FROM public.players WHERE id=${ql(B)}`),'OLD');
  });
  await check('Admin stable UUID rename updates structural game/match/score identity',async()=>{
    const renamed=na+'_RENAMED';
    await admin({operation:'ensure_score',game_id:G,scope:'league',player_id:A});
    const r=await admin({operation:'rename_merge',player_id:A,new_name:renamed});assert.equal(r.player_id,A);
    assert.equal(await scalar(`SELECT name FROM public.players WHERE id=${ql(A)}`),renamed);
    const row=await json(`SELECT jsonb_build_object('state',state,'stats',stats) FROM public.games WHERE id=${ql(G)}`);
    assert.equal(row.state.players[0].name,renamed);assert.equal(row.state.playerIds[0],A);assert.equal(row.stats.players[0].name,renamed);
    assert.equal(await scalar(`SELECT players->0->>'name' FROM public.matches WHERE id=${ql(M)}`),renamed);
    assert.equal(await scalar(`SELECT name FROM public.high_scores_sp WHERE game_id=${ql(G)} AND player_id=${ql(A)}`),renamed);
    await rejects({operation:'rename_merge',player_id:A,new_name:nb});
  });
  await check('Admin merging disjoint profiles preserves target UUID and archives source',async()=>{
    const r=await admin({operation:'rename_merge',player_id:C,new_name:nd});assert.equal(r.player_id,D);
    assert.equal(await scalar(`SELECT (deleted_at IS NOT NULL)::text FROM public.players WHERE id=${ql(C)}`),'true');
    assert.equal(await scalar(`SELECT count(*) FROM public.players_archive WHERE player_id=${ql(C)} AND reason='admin_merge'`),'1');
    assert.equal(await scalar(`SELECT count(*) FROM public.player_aliases WHERE saved_player_id=${ql(D)} AND alias=${ql(nc)}`),'1');
  });
  await check('Admin server snapshot and soft delete retain history and audit records',async()=>{
    await admin({operation:'archive_player',player_id:E,reason:'semantic_test'});
    await admin({operation:'delete_player',player_id:E});
    assert.equal(await scalar(`SELECT count(*) FROM public.players WHERE id=${ql(E)} AND deleted_at IS NOT NULL`),'1');
    assert.equal(await scalar(`SELECT count(*) FROM public.players_archive WHERE player_id=${ql(E)} AND payload->>'id'=${ql(E)}`),'2');
  });
  await check('Admin high-score repair derives positive saved totals; guest and zero remain excluded',async()=>{
    await sql(`DELETE FROM public.high_scores_sp WHERE game_id=${ql(G)}`);
    const r=await admin({operation:'ensure_score',game_id:G,scope:'league'});assert.equal(r.inserted,1);
    assert.equal(await scalar(`SELECT count(*) FROM public.high_scores_sp WHERE game_id=${ql(G)}`),'1');
    const guestG=crypto.randomUUID(),guestM=crypto.randomUUID();
    await sql(`INSERT INTO public.matches(id,total_games,players,wins,history) VALUES(${ql(guestM)},1,'[]','[]','[]'); INSERT INTO public.games(id,match_id,game_number,state,totals,finished,mode,is_practice) VALUES(${ql(guestG)},${ql(guestM)},1,${j({players:[{name:nf},{id:F,name:nf}],mode:'practice'})},ARRAY[50,30],true,'practice',true);`);
    assert.equal((await admin({operation:'ensure_score',game_id:guestG,scope:'practice'})).inserted,1);
    assert.deepEqual(await json(`SELECT jsonb_agg(score ORDER BY score) FROM public.high_scores WHERE game_id=${ql(guestG)}`),[30]);
    await rejects({operation:'ensure_score',player_name:'NOT_SAVED',score:999});
  });
  await check('Admin exact high-score delete and dedupe never use a timestamp window',async()=>{
    const n=na+'_RENAMED';
    const row=await json(`SELECT to_jsonb(h) FROM public.high_scores_sp h WHERE game_id=${ql(G)} AND player_id=${ql(A)}`);
    await sql(`INSERT INTO public.high_scores_sp(name,score,ts,player_id) VALUES(${ql(n)},140,'2026-10-03T00:02:00Z',${ql(A)});`);
    const del=await admin({operation:'delete_score',scope:'league',name:row.name,score:row.score,timestamp:row.ts});assert.equal(del.deleted,1);
    assert.equal(await scalar(`SELECT count(*) FROM public.high_scores_sp WHERE name=${ql(n)} AND score=140`),'1');
    await admin({operation:'ensure_score',game_id:G,scope:'league',player_id:A});
    assert.equal((await admin({operation:'dedupe_scores',scope:'league'})).deleted>=1,true);
    assert.equal(await scalar(`SELECT count(*) FROM public.high_scores_sp WHERE name=${ql(n)} AND score=140`),'1');
    const retained=await json(`SELECT to_jsonb(h) FROM public.high_scores_sp h WHERE name=${ql(n)} AND score=140 LIMIT 1`);
    assert.equal((await admin({operation:'delete_score',scope:'league',score_id:retained.id})).deleted,1);
    await admin({operation:'rebuild_scores',scope:'league',max_games:250});
    await admin({operation:'recover_scores',hours:8760});
  });
  await check('Admin removing one historical player keeps board, totals and stats aligned',async()=>{
    await admin({operation:'remove_game_player',game_id:G,player_id:B,player_name:nb});
    const r=await json(`SELECT jsonb_build_object('state',state,'totals',totals,'stats',stats) FROM public.games WHERE id=${ql(G)}`);
    assert.equal(r.state.players.length,1);assert.equal(r.state.board.length,1);assert.equal(r.state.playerIds.length,1);assert.deepEqual(r.totals,[140]);assert.equal(r.stats.perPlayer.length,1);
  });
  await check('Admin archive, reinstate and purge target one exact historical game',async()=>{
    await admin({operation:'archive',game_id:G});assert.equal(await scalar(`SELECT (archived_at IS NOT NULL)::text FROM public.games WHERE id=${ql(G)}`),'true');
    await admin({operation:'reinstate',game_id:G});assert.equal(await scalar(`SELECT (archived_at IS NULL)::text FROM public.games WHERE id=${ql(G)}`),'true');
    await admin({operation:'purge',timestamp:at});assert.equal(await scalar(`SELECT count(*) FROM public.games WHERE id=${ql(G)}`),'0');
    assert.equal(await scalar(`SELECT count(*) FROM public.high_scores_sp WHERE game_id=${ql(G)}`),'0');
  });
  await check('Admin historical imports are create-only and retry without overwriting saved truth',async()=>{
    const id=crypto.randomUUID(),match={id,players:[{id:F,name:nf}],wins:[1],total_games:1,history:[]};
    assert.equal((await admin({operation:'import_match',match})).inserted,1);assert.equal((await admin({operation:'import_match',match})).inserted,0);
    await rejects({operation:'import_match',match:{...match,wins:[99]}});
    const game={match_id:id,game_number:1,created_at:'2026-10-03T00:10:00Z',state:{players:[{id:F,name:nf}],board:[board[0]],mode:'practice'},totals:[140]};
    const r=await admin({operation:'import_game',game});assert.equal(r.inserted,1);assert.equal(r.high_scores,1);
    assert.equal((await admin({operation:'import_game',game})).inserted,0);
    assert.deepEqual(await json(`SELECT to_jsonb(totals) FROM public.games WHERE id=${ql(r.game_id)}`),[140]);
  });
}

export async function seedLegacyBrowserCase({sql,run='legacy-ui-'+crypto.randomUUID().slice(0,8)}){
  const ql=v=>"'"+String(v).replaceAll("'","''")+"'",j=v=>ql(JSON.stringify(v))+'::jsonb';
  const [a,b,match_id,game_id]=Array.from({length:4},()=>crypto.randomUUID());
  const roster=[{id:a,name:`LEGACY_${run}_A`},{id:b,name:`LEGACY_${run}_B`}],wins=[1,0],history=[{totals:[240,0]}],rules={gameFormat:'match_play',gameVariant:'classic'};
  const board=roster.map((_,pi)=>Array.from({length:14},(_,ri)=>{const points=pi?0:ri<11?ri+10:ri===11?20:ri===12?30:25;
    const hit=pi?{kind:'Miss',points:0}:ri<11?{kind:'S',points}:ri===11?{kind:'Double',sector:10,points}:ri===12?{kind:'Triple',sector:10,points}:{kind:'B',bull:'Outer',points};
    return{darts:[hit,{kind:'Miss',points:0},{kind:'Miss',points:0}],roundTotal:points};}));
  await sql(`INSERT INTO public.players(id,name) VALUES(${ql(a)},${ql(roster[0].name)}),(${ql(b)},${ql(roster[1].name)}); INSERT INTO public.matches(id,total_games,players,wins,history,target_wins,mode,is_practice) VALUES(${ql(match_id)},1,${j(roster.map(p=>({name:p.name})))},${j(wins)},${j(history)},NULL,'official',false); INSERT INTO public.games(id,match_id,game_number,state,totals,finished,mode,is_practice) VALUES(${ql(game_id)},${ql(match_id)},1,${j({players:roster,board,mode:'official',...rules})},ARRAY[240,0],true,'official',false);`);
  return{match_id,accepted_game_id:game_id,roster,wins,db_history:history,cache_history:[{totals:[240,0],board,gameToken:'legacy-ui-accepted'}],target_wins:3,match_format:'series',mode:'official',rules};
}

export async function runLegacyRecoveryCases({recover,command,complete,sql,check,run='legacy-'+crypto.randomUUID().slice(0,8)}){
  const ql=v=>"'"+String(v).replaceAll("'","''")+"'",j=v=>ql(JSON.stringify(v))+'::jsonb';
  const [a,b,mid,gid]=Array.from({length:4},()=>crypto.randomUUID()),na=`LEGACY_${run}_A`,nb=`LEGACY_${run}_B`;
  const roster=[{id:a,name:na},{id:b,name:nb}],past=[{totals:[240,0]}],wins=[1,0];
  const board=roster.map((_,pi)=>Array.from({length:14},(_,ri)=>{const points=pi?0:ri<11?ri+10:ri===11?20:ri===12?30:25;return{darts:[{kind:pi?'Miss':ri<11?'S':ri===11?'Double':ri===12?'Triple':'B',points},{kind:'Miss',points:0},{kind:'Miss',points:0}],roundTotal:points};}));
  await sql(`INSERT INTO public.players(id,name) VALUES(${ql(a)},${ql(na)}),(${ql(b)},${ql(nb)}); INSERT INTO public.matches(id,total_games,players,wins,history,target_wins,mode,is_practice) VALUES(${ql(mid)},1,${j([{name:na},{name:nb}])},${j(wins)},${j(past)},NULL,'official',false); INSERT INTO public.games(id,match_id,game_number,state,totals,finished,mode,is_practice) VALUES(${ql(gid)},${ql(mid)},1,${j({players:roster,board,mode:'official'})},ARRAY[240,0],true,'official',false);`);
  await check('Owner recovery preserves legacy DB history/wins and mints only next pending game',async()=>{
    const r=await recover(mid,{target_wins:3,match_format:'series'});assert.equal(r.match_id,mid);assert.equal(r.game_number,2);assert.equal(r.recovered,true);assert.equal(r.target_wins,3);assert.equal(r.match_format,'series');assert.deepEqual(r.roster,roster);assert.deepEqual(r.wins,wins);assert.deepEqual(r.history,past);assert.notEqual(r.game_id,gid);assert.equal('capability'in r,false);
    const saved=JSON.parse(String(await sql(`SELECT jsonb_build_object('history',history,'wins',wins,'players',players) FROM public.matches WHERE id=${ql(mid)}`)));
    assert.deepEqual(saved.history,past);assert.deepEqual(saved.wins,wins);assert.deepEqual(saved.players,[{name:na},{name:nb}]);
    if(command){const resumed=await command('resume',mid);assert.equal(resumed.match_id,mid);assert.equal(resumed.games.filter(g=>g.status==='pending').length,1);assert.equal(resumed.games.find(g=>g.status==='pending').game_id,r.game_id);}
    assert.equal(String(await sql(`SELECT count(*) FROM public.games WHERE match_id=${ql(mid)}`)).trim(),'1');
  });
  await check('Legacy guest Practice recovery uses owner-confirmed unsaved settings and retains guest identity',async()=>{
    const mid=crypto.randomUUID(),roster=[{name:`GUEST_${run}`}];await sql(`INSERT INTO public.matches(id,total_games,players,wins,history,target_wins,mode,is_practice) VALUES(${ql(mid)},1,${j(roster)},'[0]','[]',NULL,'practice',true);`);
    const r=await recover(mid,{target_wins:1,mode:'practice',match_format:'single',rules:{}});assert.equal(r.mode,'practice');assert.equal(r.match_format,'single');assert.equal(r.game_number,1);assert.deepEqual(r.roster,[{id:null,name:roster[0].name}]);assert.deepEqual(r.wins,[0]);
  });
  await check('Legacy recovery rejects a saved history total that disagrees with the same numbered game',async()=>{
    const bad=crypto.randomUUID(),game=crypto.randomUUID();
    await sql(`INSERT INTO public.matches(id,total_games,players,wins,history,target_wins,mode,is_practice) VALUES(${ql(bad)},1,${j([{name:na},{name:nb}])},'[1,0]',${j([{totals:[140,0]}])},3,'official',false); INSERT INTO public.games(id,match_id,game_number,state,totals,finished,mode,is_practice) VALUES(${ql(game)},${ql(bad)},1,${j({players:roster,board,mode:'official'})},ARRAY[240,0],true,'official',false);`);
    await assert.rejects(()=>recover(bad,{target_wins:3,match_format:'series'}));
    assert.equal(String(await sql(`SELECT count(*) FROM private.sc004_controllers WHERE match_id=${ql(bad)}`)).trim(),'0');
  });
  await check('First-to-one legacy series retains series accounting after a recovered completion',async()=>{
    const first=crypto.randomUUID();await sql(`INSERT INTO public.matches(id,total_games,players,wins,history,target_wins,mode,is_practice) VALUES(${ql(first)},1,${j([{name:na},{name:nb}])},'[0,0]','[]',1,'official',false);`);
    const settings={target_wins:1,match_format:'series',mode:'official',rules:{}};
    const r=await recover(first,settings);assert.equal(r.match_format,'series');assert.equal(r.game_number,1);
    assert.equal(String(await sql(`SELECT single_game::text FROM private.sc004_controllers WHERE match_id=${ql(first)}`)).trim(),'false');
    if(complete){
      const board=roster.map((_,pi)=>Array.from({length:14},()=>({darts:[{kind:pi?'Miss':'S',points:pi?0:10},{kind:'Miss',points:0},{kind:'Miss',points:0}],roundTotal:pi?0:10})));
      const receipt=await complete(first,{game_id:r.game_id,state:{players:r.roster,board,mode:'official'},totals:[140,0]});assert.equal(receipt.game_id,r.game_id);
      const saved=JSON.parse(String(await sql(`SELECT wins FROM public.matches WHERE id=${ql(first)}`)));assert.deepEqual(saved,[1,0]);
    }
  });
}
