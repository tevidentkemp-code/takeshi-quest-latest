/*
 * Shateki Quest — SC-052 DMD Brutal Commentary
 *
 * Read-only presentation intelligence. It observes canonical game state/history and
 * returns commentary beats; it never writes scoring, ranking, XP, match, Supabase or
 * persistence state.
 */

export const VERSION = '1.0.0-sc052';
export const GAP_MOCK_START = 50;
export const MODES = Object.freeze({ OFF:'off', BANTER:'banter', BRUTAL:'brutal' });

const LINES = Object.freeze({
  miss6: [
    ['SIX MISSES, SUNSHINE.','THE BOARD REMAINS SAFE.'],
    ['SIX DARTS. FUCK ALL.','AIMING IS STILL OPTIONAL.'],
    ['THAT IS SIX.','START WORRYING.'],
    ['SIX MISSES.','THE BOARD IS OVER THERE.']
  ],
  miss9: [
    ['NINE.','THIS IS NOT BAD LUCK.'],
    ['NINE MISSES.','WE ARE INVESTIGATING FRAUD.'],
    ['THREE VISITS. NOTHING.','YOU ARE TAKING THE PISS.'],
    ['NINE.','THE WALL IS GETTING NERVOUS.']
  ],
  miss12: [
    ['TWELVE.','PACK IT UP, CHIEF.'],
    ['TWELVE MISSES.','PUBLIC HUMILIATION.'],
    ['TWELVE.','THE JOB IS FUCKED.'],
    ['EVEN THE BOARD','LOOKS EMBARRASSED.']
  ],
  miss15: [
    ['FIFTEEN.','THIS IS PERFORMANCE ART.'],
    ['FIFTEEN FUCKING MISSES.','WE HAVE SEEN ENOUGH.'],
    ['STOP THROWING.','THINK ABOUT YOUR LIFE.']
  ],
  miss18: [
    ['EIGHTEEN.','RIGHT. EVERYONE OUT.'],
    ['THE EXPERIMENT','HAS FAILED.'],
    ['THIS IS NO LONGER','A DARTS MATCH.']
  ],
  twoMisses: [
    ['TWO GONE.','ONE TO SAVE FACE.'],
    ['TWO MISSES.','LOVELY START.'],
    ['TWO DOWN.','MAKE THE LAST ONE COUNT.']
  ],
  behindMiss: [
    ['BOLD STRATEGY.','NOT FROM BACK THERE.'],
    ['GOOD TIME TO MISS.','VERY CLEVER.'],
    ['THAT WILL HELP.','OH, WAIT.'],
    ['LOVELY.','EXACTLY WHAT YOU NEEDED.']
  ],
  behindHit: [
    ['THAT HELPS.','KEEP DIGGING.'],
    ['SIGNS OF LIFE.','DO NOT GET EXCITED.'],
    ['ONE BACK.','PLENTY MORE REQUIRED.']
  ],
  zeroVisit: [
    ['THREE DARTS.','ZERO CONTRIBUTION.'],
    ['NOTHING.','A COMPLETE WASTE OF TIME.'],
    ['THE BOARD WON','THAT VISIT.'],
    ['ZERO.','VERY PROFESSIONAL.']
  ],
  repeatedZero: [
    ['ANOTHER DONUT.','WE DID NOT NEED AN ENCORE.'],
    ['ZERO. AGAIN.','YOUR SIGNATURE MOVE.'],
    ['AT LEAST','YOU ARE CONSISTENT.'],
    ['PLEASE STOP','MAKING US WATCH THIS.']
  ],
  zeroBehind: [
    ['THREE DARTS. NOTHING.','PERFECT FOR A COMEBACK.'],
    ['ZERO CONTRIBUTION.','WHILE MILES BEHIND.'],
    ['THAT WAS USEFUL.','IF YOU ARE THE LEADER.']
  ],
  oneHit3: [
    ['ONE DART WORKING.','TWO CLAIMING EXPENSES.'],
    ['JUST THE ONE AGAIN.','WHY CHANGE THE SYSTEM?'],
    ['ONE GOOD DART.','TWO COMPLETE WASTES.']
  ],
  oneHit4: [
    ['THE ONE-DART SYSTEM','CONTINUES.'],
    ['ONE EMPLOYEE.','TWO PASSENGERS.'],
    ['YOU DO KNOW','YOU GET THREE?']
  ],
  oneHit5: [
    ['ONE-DART FRAUD','CONTINUES.'],
    ['TWO DARTS','FOR DECORATION.'],
    ['CONSISTENTLY SHIT.','IMPRESSIVE, REALLY.'],
    ['ONE DART PLAYER.','THREE DART GAME.']
  ],
  behind50: [
    ['BIT OF A GAP, SUNSHINE.','YOU MIGHT JOIN IN SOON.'],
    ['STILL IN THE SAME GAME.','TECHNICALLY.'],
    ['GETTING AWAY FROM YOU.','CHIEF.'],
    ['MOSTLY IRRELEVANT.','BUT STILL PRESENT.']
  ],
  behind75: [
    ['BINOCULARS, PLEASE.','HE IS GETTING SMALLER.'],
    ['YOU ARE NOT CHASING HIM.','YOU ARE READING ABOUT HIM.'],
    ['YOU CAN STILL SEE HIM.','JUST.'],
    ['PLAYING FOR DIGNITY.','CURRENTLY LOSING THAT TOO.']
  ],
  behind100: [
    ['A HUNDRED BACK.','LOVELY DAY FOR A FUNERAL.'],
    ['NOT YOUR OPPONENT NOW.','HE IS YOUR LANDLORD.'],
    ['LOST RADIO CONTACT.','TRY WAVING.'],
    ['NOT A COMEBACK.','AN EVACUATION.']
  ],
  behind125: [
    ['RIGHT.','WE ARE WATCHING A CRIME.'],
    ['ABSOLUTELY BURIED.','NO FLOWERS, PLEASE.'],
    ['THE GAP NEEDS','PLANNING PERMISSION.'],
    ['BACKGROUND SCENERY.','THAT IS YOU NOW.']
  ],
  falseComeback: [
    ['THAT HELPED.','YOU ARE STILL GETTING BATTERED.'],
    ['SIGNS OF LIFE.','NOT ENOUGH LIFE.'],
    ['DO NOT CALL IT','A COMEBACK.'],
    ['GAP IMPROVED.','CATASTROPHIC TO TERRIBLE.']
  ],
  runaway: [
    ['DAYLIGHT.','HE IS LEAVING THEM.'],
    ['ONE PLAYER.','SEVERAL WITNESSES.'],
    ['THIS IS BECOMING','A DEMONSTRATION.'],
    ['THE REST','ARE PROVIDING ATMOSPHERE.']
  ],
  h2hRepeat: [
    ['HIM AGAIN.','SAME PROBLEM.'],
    ['HE IS DOING IT','TO YOU AGAIN.'],
    ['YOU SHOULD STOP','BOOKING THIS FIXTURE.'],
    ['SAME BULLY.','SAME VICTIM.']
  ],
  leadChange: [
    ['NEW LEADER.','OLD PROBLEM.'],
    ['MOVE OVER, CHAMP.','NEW BOSS.'],
    ['THAT LEAD','AGED WELL.'],
    ['YOU WERE WINNING','A MINUTE AGO.']
  ],
  closeRound: [
    ['NOW WE HAVE','A FUCKING GAME.'],
    ['GETTING TIGHT.','SOMEONE WILL BOTTLE IT.'],
    ['WELCOME TO','THE CHOKE ZONE.'],
    ['ONE OF YOU','WILL LOOK VERY STUPID.']
  ],
  collapsingLead: [
    ['DO NOT LOOK','BEHIND YOU.'],
    ['WHERE IS YOUR','LEAD GOING, BIG MAN?'],
    ['THE COLLAR','IS GETTING TIGHT.'],
    ['HERE WE','FUCKING GO.']
  ],
  roundMassacre: [
    ['THE BOARD WON','THAT ROUND.'],
    ['GENTLEMEN.','THAT WAS FUCKING TERRIBLE.'],
    ['A FESTIVAL','OF MEDIOCRITY.'],
    ['ZERO DIGNITY.','ROUND COMPLETE.']
  ],
  roundDominant: [
    ['ONE MAN WORKING.','THE REST: DECORATION.'],
    ['THAT ROUND','WAS NOT A CONTEST.'],
    ['ONE PLAYER TURNED UP.','NOTED.']
  ],
  historyRepeat: [
    ['WE HAVE SEEN','THIS FILM BEFORE.'],
    ['NICE TO SEE','YOU LEARNED FUCK ALL.'],
    ['SAME SCRIPT.','SAME PROBLEM.'],
    ['I REMEMBER YOU.','UNFORTUNATELY.']
  ]
});

function clean(value) {
  return String(value == null ? '' : value).trim();
}
function norm(value) {
  return clean(value).toLowerCase().replace(/\s+/g,' ');
}
function finite(value, fallback=0) {
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function hash(value) {
  let h=2166136261;
  const s=String(value||'');
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
function choose(pool,key) {
  if(!Array.isArray(pool)||!pool.length) return null;
  return pool[hash(key)%pool.length];
}
function beat(pair, reason, priority=20, extra={}) {
  if(!pair) return null;
  return { headline:pair[0]||'', subline:pair[1]||'', reason, priority, ...extra };
}
function playerName(player,index=0) {
  if(typeof player==='string') return clean(player)||('P'+(index+1));
  return clean(player && (player.name||player.full||player.nickname||player.code||player.initials)) || ('P'+(index+1));
}
function dartPoints(d) {
  return finite(d && (d.points ?? d.pts ?? d.score),0);
}
function scoreTotals(score, maxRound=Infinity) {
  if(!Array.isArray(score)) return [];
  return score.map(board=>{
    if(!Array.isArray(board)) return 0;
    let total=0;
    for(let r=0;r<board.length && r<=maxRound;r++) total+=finite(board[r]&&board[r].roundTotal,0);
    return total;
  });
}
function roundTotals(score, round) {
  if(!Array.isArray(score)) return [];
  return score.map(board=>finite(board&&board[round]&&board[round].roundTotal,0));
}
function currentEvent(ctx) {
  return {
    player:finite(ctx.pIndex,0),
    round:finite(ctx.rIndex,0),
    dartIndex:finite(ctx.dartIndex,0),
    throw:ctx.dart||null
  };
}
function chronologicalForPlayer(ctx) {
  const p=finite(ctx.pIndex,0);
  const arr=Array.isArray(ctx.history)?ctx.history.filter(x=>x&&finite(x.player,-1)===p).map(x=>({
    player:p,round:finite(x.round,0),dartIndex:finite(x.dartIndex,0),throw:x.throw||null
  })):[];
  if(ctx.dart) arr.push(currentEvent(ctx));
  return arr;
}
function trailingMisses(ctx) {
  const arr=chronologicalForPlayer(ctx);
  let count=0;
  for(let i=arr.length-1;i>=0;i--){
    if(dartPoints(arr[i].throw)>0) break;
    count++;
  }
  return count;
}
function completedVisits(ctx) {
  const arr=chronologicalForPlayer(ctx);
  const visits=[];
  let current=[];
  let lastRound=null;
  for(const ev of arr){
    if(lastRound!==null && ev.dartIndex===0 && current.length) current=[];
    lastRound=ev.round;
    current.push(ev);
    if(ev.dartIndex===2){
      const darts=current.slice(-3).map(x=>x.throw);
      visits.push({
        round:ev.round,
        darts,
        hits:darts.filter(d=>dartPoints(d)>0).length,
        points:darts.reduce((a,d)=>a+dartPoints(d),0)
      });
      current=[];
    }
  }
  return visits;
}
function trailingVisitStreak(ctx, hits) {
  const visits=completedVisits(ctx);
  let n=0;
  for(let i=visits.length-1;i>=0;i--){
    if(visits[i].hits!==hits) break;
    n++;
  }
  return n;
}
function gapInfo(ctx) {
  const totals=scoreTotals(ctx.score);
  const p=finite(ctx.pIndex,0);
  const own=finite(totals[p],0);
  const leader=totals.length?Math.max(...totals):own;
  const sorted=[...totals].sort((a,b)=>b-a);
  const second=sorted.length>1?finite(sorted[1],leader):leader;
  return {
    totals, own, leader,
    behind:Math.max(0,leader-own),
    lead:own===leader?Math.max(0,leader-second):0,
    leaderIndex:totals.indexOf(leader)
  };
}
function gapPool(gap) {
  if(gap>=125) return LINES.behind125;
  if(gap>=100) return LINES.behind100;
  if(gap>=75) return LINES.behind75;
  return LINES.behind50;
}
function isProtectedMode(mode) {
  return /(practice|shadow|training)/i.test(String(mode||''));
}
function modeFromCtx(ctx) {
  return clean(ctx.mode || ctx.gameMode || ctx.matchMode || '');
}
function groupHistory(rows) {
  const games=new Map();
  (Array.isArray(rows)?rows:[]).forEach(row=>{
    const id=clean(row&&row.game_id);
    const name=norm(row&&row.player_name);
    if(!id||!name) return;
    if(!games.has(id)) games.set(id,{id,ts:row.ts||null,rows:[]});
    games.get(id).rows.push({name,score:finite(row.score,0),raw:row});
  });
  return [...games.values()].sort((a,b)=>String(b.ts||'').localeCompare(String(a.ts||'')));
}
function h2hFromGames(games,a,b) {
  const an=norm(a), bn=norm(b);
  if(!an||!bn||an===bn) return {games:0,aWins:0,bWins:0,draws:0,lastWinner:''};
  let out={games:0,aWins:0,bWins:0,draws:0,lastWinner:''};
  for(const g of games){
    const ar=g.rows.find(r=>r.name===an), br=g.rows.find(r=>r.name===bn);
    if(!ar||!br) continue;
    out.games++;
    let winner='';
    if(ar.score>br.score){out.aWins++;winner=an;}
    else if(br.score>ar.score){out.bWins++;winner=bn;}
    else out.draws++;
    if(!out.lastWinner&&winner) out.lastWinner=winner;
  }
  return out;
}
function matchH2H(matchHistory,aIndex,bIndex) {
  const out={games:0,aWins:0,bWins:0,draws:0,lastWinnerIndex:null};
  (Array.isArray(matchHistory)?matchHistory:[]).forEach(g=>{
    const totals=Array.isArray(g&&g.totals)?g.totals:[];
    if(!Number.isFinite(Number(totals[aIndex]))||!Number.isFinite(Number(totals[bIndex]))) return;
    const a=Number(totals[aIndex]), b=Number(totals[bIndex]);
    out.games++;
    if(a>b){out.aWins++;out.lastWinnerIndex=aIndex;}
    else if(b>a){out.bWins++;out.lastWinnerIndex=bIndex;}
    else out.draws++;
  });
  return out;
}

export function createCommentaryEngine(options={}) {
  const host=options.host || globalThis;
  let mode=String(options.mode||MODES.BRUTAL).toLowerCase();
  let historyRows=Array.isArray(options.historyRows)?options.historyRows.slice():[];
  let historyGames=groupHistory(historyRows);
  let warmKey='';
  let warmPromise=null;

  function enabled(ctx) {
    if(mode===MODES.OFF) return false;
    if(ctx && ctx.suppress===true) return false;
    return true;
  }

  async function warmHistory(players, currentMode='') {
    if(isProtectedMode(currentMode)) return [];
    const names=(Array.isArray(players)?players:[]).map(playerName).filter(Boolean);
    const key=names.map(norm).sort().join('|');
    if(!key) return [];
    if(key===warmKey && historyRows.length) return historyRows;
    if(key===warmKey && warmPromise) return warmPromise;
    warmKey=key;
    warmPromise=(async()=>{
      try{
        let client=null;
        try{client=host&&host.sb&&typeof host.sb.from==='function'?host.sb:null;}catch(_){}
        if(!client) return historyRows;
        const q=await client.from('v_player_game_scores_official_clean')
          .select('game_id,ts,player_index,player_name,score')
          .order('ts',{ascending:false})
          .limit(260);
        if(q&&q.error) throw q.error;
        const wanted=new Set(names.map(norm));
        historyRows=(Array.isArray(q&&q.data)?q.data:[]).filter(r=>wanted.has(norm(r&&r.player_name)));
        historyGames=groupHistory(Array.isArray(q&&q.data)?q.data:[]);
        return historyRows;
      }catch(_){ return historyRows; }
      finally{ warmPromise=null; }
    })();
    return warmPromise;
  }

  function historyDominance(ctx, trailingIndex, leaderIndex) {
    const players=Array.isArray(ctx.players)?ctx.players:[];
    const a=playerName(players[trailingIndex],trailingIndex);
    const b=playerName(players[leaderIndex],leaderIndex);
    const withinMatch=matchH2H(ctx.matchHistory,trailingIndex,leaderIndex);
    if(withinMatch.bWins>=1 && withinMatch.bWins>withinMatch.aWins) return true;
    const all=h2hFromGames(historyGames,a,b);
    return all.bWins>=2 && all.bWins>all.aWins;
  }

  function dart(ctx={}) {
    if(!enabled(ctx)||!ctx.dart) return null;
    const pts=dartPoints(ctx.dart);
    const miss=pts<=0;
    const streak=miss?trailingMisses(ctx):0;
    const gap=gapInfo(ctx);
    const key=['dart',ctx.pIndex,ctx.rIndex,ctx.dartIndex,pts,streak,gap.behind].join('|');

    if(miss){
      if(streak>=18 && streak%3===0) return beat(choose(LINES.miss18,key),'miss_18_plus',55,{streak});
      if(streak===15) return beat(choose(LINES.miss15,key),'miss_15',52,{streak});
      if(streak===12) return beat(choose(LINES.miss12,key),'miss_12',50,{streak});
      if(streak===9) return beat(choose(LINES.miss9,key),'miss_9',48,{streak});
      if(streak===6) return beat(choose(LINES.miss6,key),'miss_6',45,{streak});
      const visit=ctx.score&&ctx.score[ctx.pIndex]&&ctx.score[ctx.pIndex][ctx.rIndex];
      const darts=Array.isArray(visit&&visit.darts)?visit.darts.slice(0,Number(ctx.dartIndex)+1):[];
      if(Number(ctx.dartIndex)===1 && darts.length>=2 && darts.every(d=>dartPoints(d)<=0)){
        return beat(choose(LINES.twoMisses,key),'two_misses',22,{streak});
      }
      if(gap.behind>=GAP_MOCK_START && Number(ctx.dartIndex)<2){
        return beat(choose(LINES.behindMiss,key),'behind_miss',24,{gap:gap.behind});
      }
      return null;
    }

    if(gap.behind>=GAP_MOCK_START && Number(ctx.dartIndex)<2){
      return beat(choose(LINES.behindHit,key),'behind_hit',18,{gap:gap.behind});
    }
    return null;
  }

  function visit(ctx={}) {
    if(!enabled(ctx)||Number(ctx.dartIndex)!==2) return null;
    const board=ctx.score&&ctx.score[ctx.pIndex];
    const entry=board&&board[ctx.rIndex];
    const darts=Array.isArray(entry&&entry.darts)?entry.darts.slice(0,3):[];
    const hits=darts.filter(d=>dartPoints(d)>0).length;
    const points=darts.reduce((a,d)=>a+dartPoints(d),0);
    const gap=gapInfo(ctx);
    const key=['visit',ctx.pIndex,ctx.rIndex,hits,points,gap.behind,gap.lead].join('|');

    if(hits===0){
      const zs=trailingVisitStreak(ctx,0);
      if(gap.behind>=GAP_MOCK_START){
        const b=beat(choose(LINES.zeroBehind,key),'zero_visit_behind',42,{gap:gap.behind,zeroVisitStreak:zs});
        b.subline=(gap.behind+' BACK. LOVELY.').slice(0,32);
        return b;
      }
      if(zs>=2) return beat(choose(LINES.repeatedZero,key),'repeated_zero_visit',38,{zeroVisitStreak:zs});
      return beat(choose(LINES.zeroVisit,key),'zero_visit',32);
    }

    const one=trailingVisitStreak(ctx,1);
    if(one>=5) return beat(choose(LINES.oneHit5,key),'one_hit_streak_5',36,{oneHitStreak:one});
    if(one===4) return beat(choose(LINES.oneHit4,key),'one_hit_streak_4',34,{oneHitStreak:one});
    if(one===3) return beat(choose(LINES.oneHit3,key),'one_hit_streak_3',32,{oneHitStreak:one});

    if(gap.behind>=GAP_MOCK_START){
      const beforeOwn=gap.own-points;
      const otherLeader=Math.max(0,...gap.totals.filter((_,i)=>i!==Number(ctx.pIndex)));
      const beforeGap=Math.max(0,otherLeader-beforeOwn);
      const recovered=Math.max(0,beforeGap-gap.behind);
      if(recovered>=20 && gap.behind>=GAP_MOCK_START){
        const b=beat(choose(LINES.falseComeback,key),'false_comeback',33,{gap:gap.behind,recovered});
        b.subline=(gap.behind+' BACK. STILL.').slice(0,32);
        return b;
      }
      if(historyDominance(ctx,Number(ctx.pIndex),gap.leaderIndex)){
        const b=beat(choose(LINES.h2hRepeat,key),'history_h2h_repeat',40,{gap:gap.behind});
        b.subline=(gap.behind+' BACK. HIM AGAIN.').slice(0,32);
        return b;
      }
      const b=beat(choose(gapPool(gap.behind),key),'far_behind',30,{gap:gap.behind});
      b.subline=(gap.behind+' BACK.').slice(0,32);
      return b;
    }

    if(gap.lead>=GAP_MOCK_START){
      const b=beat(choose(LINES.runaway,key),'runaway_leader',28,{lead:gap.lead});
      b.subline=('+'+gap.lead+' CLEAR.').slice(0,32);
      return b;
    }
    return null;
  }

  function round(ctx={}) {
    if(!enabled(ctx)) return null;
    const r=Number(ctx.rIndex);
    if(!Number.isFinite(r)||r<0) return null;
    const totals=scoreTotals(ctx.score,r);
    const prev=scoreTotals(ctx.score,r-1);
    const rt=roundTotals(ctx.score,r);
    if(!totals.length) return null;
    const leader=Math.max(...totals);
    const leaderIndex=totals.indexOf(leader);
    const sorted=[...totals].sort((a,b)=>b-a);
    const margin=sorted.length>1?leader-sorted[1]:0;
    const prevLeader=Math.max(...prev);
    const prevLeaderIndex=prev.indexOf(prevLeader);
    const prevSorted=[...prev].sort((a,b)=>b-a);
    const prevMargin=prevSorted.length>1?prevLeader-prevSorted[1]:0;
    const worst=Math.min(...totals);
    const worstIndex=totals.indexOf(worst);
    const worstGap=leader-worst;
    const key=['round',r,totals.join(','),rt.join(',')].join('|');

    if(rt.every(v=>v===0)) return beat(choose(LINES.roundMassacre,key),'round_all_zero',52);

    if(r>0 && leaderIndex!==prevLeaderIndex && leader>0){
      const b=beat(choose(LINES.leadChange,key),'round_lead_change',44,{leaderIndex,margin});
      b.subline=(playerName(ctx.players&&ctx.players[leaderIndex],leaderIndex)+' LEADS').slice(0,32);
      return b;
    }

    if(leaderIndex===prevLeaderIndex && prevMargin-margin>=25 && margin<=25 && r>=2){
      return beat(choose(LINES.collapsingLead,key),'round_lead_collapse',43,{margin,previousMargin:prevMargin});
    }

    if(worstGap>=GAP_MOCK_START){
      if(historyDominance(ctx,worstIndex,leaderIndex)){
        const b=beat(choose(LINES.h2hRepeat,key),'round_history_h2h',42,{gap:worstGap,worstIndex,leaderIndex});
        b.subline=(playerName(ctx.players&&ctx.players[worstIndex],worstIndex)+' '+worstGap+' BACK').slice(0,32);
        return b;
      }
      const b=beat(choose(gapPool(worstGap),key),'round_far_behind',38,{gap:worstGap,worstIndex,leaderIndex});
      b.subline=(playerName(ctx.players&&ctx.players[worstIndex],worstIndex)+' '+worstGap+' BACK').slice(0,32);
      return b;
    }

    if(margin>=GAP_MOCK_START){
      const b=beat(choose(LINES.runaway,key),'round_runaway',37,{lead:margin,leaderIndex});
      b.subline=(playerName(ctx.players&&ctx.players[leaderIndex],leaderIndex)+' +'+margin).slice(0,32);
      return b;
    }

    if(r>=4 && sorted.length>1 && margin<=10){
      return beat(choose(LINES.closeRound,key),'round_close',34,{margin});
    }

    const ranked=rt.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
    if(ranked.length>1 && ranked[0].v-ranked[1].v>=30 && ranked[0].v>0){
      const b=beat(choose(LINES.roundDominant,key),'round_domination',30,{winnerIndex:ranked[0].i});
      b.subline=(playerName(ctx.players&&ctx.players[ranked[0].i],ranked[0].i)+' OWNED THAT').slice(0,32);
      return b;
    }
    return null;
  }

  function setMode(next){
    const v=String(next||'').toLowerCase();
    if(Object.values(MODES).includes(v)) mode=v;
    return mode;
  }
  function setHistoryRows(rows){
    historyRows=Array.isArray(rows)?rows.slice():[];
    historyGames=groupHistory(historyRows);
    return historyRows.length;
  }

  return {
    version:VERSION,
    gapMockStart:GAP_MOCK_START,
    mode:()=>mode,
    setMode,
    warmHistory,
    setHistoryRows,
    dart,
    visit,
    round,
    snapshot:()=>({mode,historyRows:historyRows.length,historyGames:historyGames.length,version:VERSION})
  };
}

export function installCommentary(host=globalThis) {
  const saved=(()=>{
    try{return String(host.localStorage&&host.localStorage.getItem('sq_dmd_commentary_mode')||'').toLowerCase();}catch(_){return '';}
  })();
  const engine=createCommentaryEngine({host,mode:Object.values(MODES).includes(saved)?saved:MODES.BRUTAL});
  try{
    host.__sqDmdCommentary=engine;
    host.__sqDmdCommentaryDart=(ctx)=>engine.dart(ctx);
    host.__sqDmdCommentaryVisit=(ctx)=>engine.visit(ctx);
    host.__sqDmdCommentaryRound=(ctx)=>engine.round(ctx);
    host.__sqDmdCommentaryWarmHistory=(players,mode)=>engine.warmHistory(players,mode);
    host.__sqDmdCommentarySetMode=(next)=>{
      const mode=engine.setMode(next);
      try{host.localStorage&&host.localStorage.setItem('sq_dmd_commentary_mode',mode);}catch(_){}
      return mode;
    };
  }catch(_){}
  return engine;
}
