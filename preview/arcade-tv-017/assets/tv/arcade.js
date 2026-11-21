'use strict';
const screen=document.querySelector('#screen');
const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
let motion=!systemMotion.matches;
let state, names, targets;
let presentationInterrupted=false;
let frameRequest, raceRequest, cueTimer, holdTimer, exitTimer, padTimer, flipSwapTimer, flipEndTimer, boardLightTimer;
const pressCounts={Single:0,Double:0,Treble:0};
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const boardNumbers=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const traceColours=['#ff9f67','#ffe17d','#66ffe6','#d0a2ff','#6fb7ff','#ff8bb0'];
function dart(label,points){return {label,points};}
function playerIdentity(index){
  if(state.identities?.[index])return state.identities[index];
  // Older scorer windows send only their formatted display name.
  const display=String(names[index]??('PLAYER '+(index+1)));
  const nickname=display.match(/["“]([^"”]+)["”]/)?.[1]??'';
  const name=display.replace(/["“][^"”]+["”]/g,'').replace(/\s+/g,' ').trim()||display;
  const [first,...last]=name.split(' ');
  return {name,nickname,shortName:first+(last.length?' '+[...last[0]][0]:'')};
}
function nameMarkup(index){
  const identity=playerIdentity(index);
  const length=[...identity.shortName].length;
  return `<span class="name ${length>10?'long extended':length>8?'long':''}" title="${esc(identity.name)}">${esc(identity.shortName)}</span>`;
}
function hitCode(entry){
  if(!entry.points)return {label:'X',kind:'X',spoken:entry.label==='BO'?'Bounce-out':'Miss'};
  if(entry.label==='Outer'||entry.label==='Inner'){
    return {label:entry.label==='Outer'?'OB':'IB',kind:'bull',spoken:entry.label+' bull'};
  }
  const kind=entry.label[0];
  const label=typeof targets[Math.min(state.round,targets.length-1)]==='number'?kind:entry.label;
  return {label,kind,spoken:entry.label};
}
function roundPanel(finished,effect){
  const currentRound=Math.min(state.round+1,targets.length);
  return `<section class="panel round-card" aria-labelledby="roundTitle">
    <header class="panel-head"><h2 id="roundTitle">Round ${currentRound}</h2></header>
    <div class="table-body">
      <table class="round-table">
        <caption class="sr-only">Hits and round totals in throwing order</caption>
        <colgroup><col class="col-name"><col><col><col><col class="col-round-total"></colgroup>
        <thead><tr><th scope="col"><span class="sr-only">Player</span></th>${[1,2,3].map(n=>`<th scope="col"><span class="sr-only">Dart </span>${n}</th>`).join('')}<th scope="col">Total</th></tr></thead>
        <tbody>${state.rows.map((row,index)=>{
          const active=!finished&&!state.paused&&index===state.thrower;
          const visit=active?state.darts:state.visits[index]??[];
          const roundTotal=row[currentRound-1]??null;
          return `<tr class="${active?'active':''}"><th scope="row">${nameMarkup(index)}</th>
            ${Array.from({length:3},(_,dartIndex)=>{
              const entry=visit[dartIndex];
              if(!entry)return '<td class="dart-score pending"><span class="sr-only">No dart</span></td>';
              const {label,kind,spoken}=hitCode(entry);
              const newHit=effect?.player===index&&effect.dart===dartIndex;
              return `<td class="dart-score"><span class="hit-code ${newHit?'new-hit':''} ${label.length>2?'long':''}" data-kind="${kind}" aria-label="${spoken}">${label}</span></td>`;
            }).join('')}
            <td class="round-total ${roundTotal===null?'pending':''}">${roundTotal===0&&visit.length===3?'<span aria-hidden="true">–</span><span class="sr-only">Scratch</span>':roundTotal??''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  </section>`;
}
function liveTotals(){return state.totals;}
function standings(){
  return liveTotals().map((points,index)=>({index,points})).sort((a,b)=>b.points-a.points||a.index-b.index);
}
function roundScoreCell(points,round,player,roundHigh,records){
  if(points==null)return '<td class="previous"></td>';
  if(points===0)return '<td class="previous"><span aria-hidden="true">–</span><span class="sr-only">Scratch</span></td>';
  const top=points===roundHigh;
  const world=records?.world?.[round];
  const personal=records?.personal?.[player]?.[round];
  // The shared high includes every completed visit in this round. A higher
  // score by another player supersedes a would-be WR before the column appears.
  const wr=top&&Number.isFinite(world)&&world>0&&points>=world;
  const pb=Number.isFinite(personal)&&personal>0&&points>=personal;
  const mark=wr?'WR':pb?'PB':'';
  const badge=mark?`<span class="record-mark ${mark.toLowerCase()}" title="${wr?'All-games round record':'Personal round best'}">${mark}</span>`:'';
  return `<td class="previous ${top?'round-high':''}"><span class="round-points">${points}</span>${badge}${top?'<span class="sr-only">, round high</span>':''}</td>`;
}
function leaderboard(){
  const last=Array.from({length:3},(_,i)=>Math.max(0,state.completedRounds-3)+i);
  const leaders=standings();
  const highest=leaders[0].points;
  const roundHighs=last.map(turn=>Math.max(...state.rows.map(row=>row[turn]??0)));
  const headings=last.map(index=>{
    if(index>=state.completedRounds)return '<th scope="col"></th>';
    const target=targets[index];
    return `<th scope="col">${typeof target==='number'?target+'s':target}</th>`;
  }).join('');
  return `<section class="panel leaderboard" aria-labelledby="leaderboardTitle">
    <header class="panel-head"><h2 id="leaderboardTitle">Leaderboard</h2>${controls?'<button class="tv-settings" type="button" data-action="settings" aria-haspopup="dialog"><i aria-hidden="true">⚙︎</i>Settings</button>':''}</header>
    <div class="table-body">
      <table class="standings${highest>=1000?' four-figures':''}">
        <caption class="sr-only">Live totals including the current visit, and points from the last three completed rounds</caption>
        <colgroup><col class="col-name">${last.map(()=>'<col>').join('')}<col class="col-total"></colgroup>
        <thead><tr><th scope="col"><span class="sr-only">Player</span></th>${headings}<th scope="col">Total</th></tr></thead>
        <tbody>${leaders.map(({index,points})=>{
          const row=state.rows[index];
          const {heat}=state.forms[index];
          const form=heat>=80?'hot':heat>=52?'warm':heat<28?'cold':'neutral';
          const place=leaders.findIndex(entry=>entry.points===points)+1;
          const tied=leaders[place]?.points===points;
          return `<tr data-player="${index}" data-form="${form}" data-heat="${heat}" style="--beat:${(2.3-(heat/100)*1.5).toFixed(2)}s" class="${points>0&&points===highest?'leading':''}">
            <th scope="row"><span class="identity"><span class="position" style="--trace:${traceColours[index]}" aria-hidden="true">${tied?'=':''}${place}</span><span class="sr-only">${tied?'Tied in position':'Position'} ${place}, </span>${nameMarkup(index)}<span class="sr-only">, ${form} form</span></span></th>
            ${last.map((turn,i)=>roundScoreCell(turn<state.completedRounds?row[turn]:null,turn,index,roundHighs[i],state.records)).join('')}
            <td class="total"><span class="running-total">${points}</span>${points<highest?`<span class="deficit" title="${highest-points} points behind first">(−${highest-points})</span>`:''}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  </section>`;
}
function centrePanel(target,finished,effect){
  const leaders=finished?standings():null;
  const decided=finished&&Number.isInteger(state.deciderWinner);
  const tied=finished&&!decided&&leaders[0].points===leaders[1].points;
  const winner=finished?(decided?state.deciderWinner:leaders[0].index):null;
  const identity=playerIdentity(state.thrower);
  const heading=finished?(tied?'Tied for first':'Game winner'):state.paused?'Interval':identity.name;
  const sub=finished?(tied?'Shootout required':''):state.paused?'':'To throw';
  const title=finished?(tied?'Level':esc(names[winner])):typeof target==='number'?`${target}<small>s</small>`:target.toUpperCase();
  const timer=state.returnSeconds!==null;
  const cue=timer?{title:'First dart'}:state.cue;
  const outgoing=effect?.closedDarts;
  const displayed=outgoing??state.darts;
  const hits=Array.from({length:3},(_,index)=>displayed[index]).map((item,index)=>{
    const spoken=item?(item.label==='BO'?'Bounce-out':item.label):'No dart';
    const stamped=effect?.dart===index&&(outgoing||effect.player===state.thrower);
    return `<span class="hit-tile ${stamped?'new-hit':''} ${!item?'pending':item.points?'':'miss'}" aria-label="Dart ${index+1}, ${spoken}">${item?`<span class="tile-value"><span class="scored-number">${item.label}</span></span>`:''}</span>`;
  }).join('');
  return `<section class="panel centre ${finished?'finished':''}" aria-label="Dartboard and current thrower">
    <header class="centre-head">${!finished&&!state.paused?`<div class="name-slot"><div class="thrower-identity"><h2>${esc(heading)}</h2>${identity.nickname?`<p class="nickname" title="${esc(identity.nickname)}">${esc(identity.nickname)}</p>`:''}</div></div>`:`<h2>${esc(heading)}</h2>`}${sub?`<p class="sub">${sub}</p>`:''}</header>
    <div class="board-face ${timer?'timer':''}">
      <canvas id="dartboard" aria-hidden="true"></canvas>
      ${effect?.hit?`<canvas id="hitSpot" data-hit="${effect.hit}" ${effect.misses?`data-misses="${effect.misses}" style="--miss-count:${effect.misses}"`:''} aria-hidden="true"></canvas>`:''}
      <p class="target-word ${finished&&!tied?'victor':''} ${finished&&!tied&&title.length>8?'long-name':''} ${typeof target==='string'&&target.length>5?'long':''}"><span class="scored-number">${title}</span></p>
      ${timer?`<span class="timer-value" id="returnSeconds">00:${String(state.returnSeconds).padStart(2,'0')}</span>`:''}
    </div>
    ${(outgoing||!finished&&!state.paused)?`<div class="hits-area">
      <div class="hits ${outgoing?'outgoing':''}" aria-label="${outgoing?esc(names[effect.player])+'’s completed visit':'Hits this visit'}">${hits}</div>
      ${outgoing?`<p class="last-visit">${esc(names[effect.player])} · Last visit</p>`:''}
      ${cue?`<p class="event">${cue.points?`<strong>+${cue.points}</strong>`:''}${cue.title}</p>`:''}
    </div>`:''}
  </section>`;
}
function sidePanel(){
  const active=!state.paused&&state.round<targets.length;
  return `<aside class="side">
    ${leaderboard()}
    <section class="panel race-card" aria-labelledby="raceTitle">
      <header class="panel-head"><h2 id="raceTitle">Game Race</h2><span class="axis-note">${state.pace?'High score':''}</span></header>
      <div class="race-area"><div class="race-plot"><canvas id="race" role="img" aria-label="Targets 10 through 20, doubles, triples and bull. Cumulative points by round.${active?' '+esc(playerIdentity(state.thrower).name)+' to throw.':''}"></canvas><canvas id="raceActive" ${active?`data-player="${state.thrower}"`:''} aria-hidden="true"></canvas></div></div>
    </section>
  </aside>`;
}
function scoreKey({label,points,spoken},utility=false){
  return `<button class="pad-key ${utility?'utility':'segment'}" type="button" data-dart="${label}" data-points="${points}" ${spoken?`aria-label="${spoken}"`:''}>${label}</button>`;
}
function scorePad(target,finished){
  const undo=`<button class="pad-key utility" type="button" data-action="undo" ${state.canUndo?'':'disabled'}>Undo</button>`;
  if(finished)return state.canUndo?`<div class="scorepad finished" aria-label="Scoring controls">${undo}</div>`:'';
  const numbered=target==='Doubles'||target==='Triples';
  let keys;
  if(typeof target==='number'){
    keys=[dart('Single',target),dart('Double',2*target),dart('Treble',3*target)];
  }else if(numbered){
    const prefix=target==='Doubles'?'D':'T';
    const spoken=target==='Doubles'?'Double':'Treble';
    keys=Array.from({length:20},(_,i)=>({...dart(prefix+(i+1),(prefix==='D'?2:3)*(i+1)),spoken:`${spoken} ${i+1}`}));
  }else{
    keys=[dart('Outer 25',25),dart('Inner 50',50)];
  }
  const utility=`<button class="pad-key utility" type="button" data-dart="Miss" data-points="0" title="Tap for Miss · Hold for Bounce Out">Miss</button>
    <button class="pad-key utility" type="button" data-action="skip" ${state.canSkip?'':'disabled'}>Skip Go</button>`;
  return `<div class="scorepad ${numbered?'numbered-pad':''}" aria-label="Scoring controls">
    <div class="hit-buttons ${numbered?'numbered':''}">${keys.map(key=>scoreKey(key)).join('')}${numbered?'':utility}</div>
    <div class="fix-buttons">${numbered?utility:''}${undo}</div>
  </div>`;
}
function getCanvas(id){
  const canvas=document.getElementById(id);
  if(!canvas)return null;
  const {width,height}=canvas.getBoundingClientRect();
  if(!width||!height)return null;
  const scale=window.devicePixelRatio||1;
  const pixelsWide=Math.round(width*scale), pixelsHigh=Math.round(height*scale);
  if(canvas.width!==pixelsWide||canvas.height!==pixelsHigh){
    canvas.width=pixelsWide;
    canvas.height=pixelsHigh;
  }
  const context=canvas.getContext('2d');
  context.setTransform(scale,0,0,scale,0,0);
  context.clearRect(0,0,width,height);
  return {context,width,height};
}
function drawBoard(){
  const surface=getCanvas('dartboard');
  if(!surface)return;
  const {context:ctx,width,height}=surface;
  const radius=Math.min(width*.48,height*.495);
  const flip=screen.querySelector('.round-flip');
  const target=targets[flip?.dataset.previous==='yes'?state.round-1:state.round];
  ctx.translate(width/2,height/2);
  function disc(r,fill,edge,width=1){
    ctx.beginPath();ctx.arc(0,0,r*radius,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
    if(edge){ctx.strokeStyle=edge;ctx.lineWidth=width;ctx.stroke();}
  }
  function segment(inner,outer,start,end,fill){
    ctx.beginPath();ctx.arc(0,0,outer*radius,start,end);
    ctx.arc(0,0,inner*radius,end,start,true);ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#0b1534';ctx.lineWidth=Math.max(.8,radius*.0035);ctx.stroke();
  }
  ctx.save();
  ctx.shadowColor='#438cff';ctx.shadowBlur=radius*.085;
  disc(.995,'#0b1744','#6896f3',radius*.009);
  ctx.restore();
  disc(.857,'#17254b','#6a9bde',radius*.005);
  boardNumbers.forEach((number,index)=>{
    const angle=-Math.PI/2+index*Math.PI/10;
    const start=angle-Math.PI/20;
    const end=angle+Math.PI/20;
    const hot=number===target;
    const alternating=index%2===0;
    const background=hot?'#c68e62':alternating?'#526c99':'#243452';
    const wire=hot?'#ffc77c':alternating?'#d45a83':'#4cb9bd';
    segment(.059,.423,start,end,background);
    segment(.423,.471,start,end,target==='Triples'?'#44e4e8':wire);
    segment(.471,.763,start,end,background);
    segment(.763,.814,start,end,target==='Doubles'?'#44e4e8':wire);
    if(hot){
      segment(.828,.985,start,end,'#735185');
    }
    ctx.fillStyle=hot?'#fff0c6':'#e0efff';
    ctx.font=`${hot?'800':'600'} ${radius*.096}px Barlow Condensed, Arial`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(number,.911*radius*Math.cos(angle),.911*radius*Math.sin(angle));
  });
  disc(.061,target==='Bull'?'#ff719a':'#41acb5','#08152b');
  disc(.026,target==='Bull'?'#ffc467':'#be497b','#08152b');
  const centre=ctx.createRadialGradient(0,0,radius*.22,0,0,radius*.76);
  centre.addColorStop(0,'#0c1748dc');centre.addColorStop(.48,'#0c174894');centre.addColorStop(1,'#0c174800');
  disc(.76,centre);
  const overlay=document.getElementById('hitSpot');
  if(!overlay)return;
  const hit=overlay.dataset.hit;
  const light=getCanvas('hitSpot');
  if(!light)return;
  const pen=light.context;
  pen.translate(width/2,height/2);
  function arc(r,thickness,from,to,colour,glow=0){
    pen.beginPath();pen.arc(0,0,r*radius,from,to);
    pen.lineWidth=thickness*radius;pen.strokeStyle=colour;pen.shadowBlur=glow*radius;pen.stroke();
  }
  const circle=Math.PI*2;
  if(hit==='Miss'||hit==='BO'){
    pen.shadowColor='#ff314f';
    const wash=pen.createRadialGradient(0,0,.58*radius,0,0,radius);
    wash.addColorStop(0,'#ff244000');wash.addColorStop(.87,'#ff24403a');wash.addColorStop(1,'#ff2440a0');
    pen.fillStyle=wash;pen.beginPath();pen.arc(0,0,.99*radius,0,circle);pen.fill();
    arc(.979,.035,0,circle,'#ff4861',.035);
    return;
  }
  const bull=hit==='Inner'||hit==='Outer';
  pen.shadowColor='#74f7ff';
  if(bull){
    arc(hit==='Inner'?.028:.055,.025,0,circle,'#fff8d9',.045);
    arc(.976,.021,0,circle,'#81f8ed',.025);
    return;
  }
  const number=Number(hit.slice(1)),sector=boardNumbers.indexOf(number);
  if(sector<0)return;
  const angle=-Math.PI/2+sector*Math.PI/10;
  const from=angle-Math.PI/20,to=angle+Math.PI/20;
  // The number cap locates the sector at TV distance. Only the recorded bed is lit.
  arc(.909,.159,from,to,'#83f7ed',.025);
  if(hit[0]!=='S'){
    const r=hit[0]==='T'?.447:.7885;
    arc(r,.067,from,to,'#061832');
    arc(r,.048,from,to,'#eaffff',.04);
  }
  pen.shadowBlur=0;pen.fillStyle='#071a32';pen.textAlign='center';pen.textBaseline='middle';
  pen.font=`800 ${radius*.10}px Barlow Condensed, Arial`;
  pen.fillText(number,.911*radius*Math.cos(angle),.911*radius*Math.sin(angle));
}
function drawRace(racePlayer=-1,progress=1,addedSteps=1){
  const surface=getCanvas('race');
  if(!surface)return;
  const {context:ctx,width,height}=surface;
  const pulse=getCanvas('raceActive')?.context;
  const rounds=targets.length;
  const leaders=standings();
  const played=Math.max(0,...state.traces.map(points=>Math.ceil(points.length/3)));
  const reference=state.pace?.[Math.min(rounds,played+1)]??0;
  const maxTotal=Math.max(100,Math.ceil(Math.max(reference,leaders[0].points)/50)*50);
  const em=Math.max(11,width*.026);
  const right=em*.85, top=em*.8, bottom=em*1.65;
  const spacing=(height-top-bottom)*50/maxTotal;
  // Stagger neighbouring values horizontally when all 50-point labels
  // would otherwise crowd together at late-game scores.
  const lanes=spacing<em?2:1;
  const axisSize=Math.min(em,spacing*lanes*.88);
  const column=axisSize*(String(maxTotal).length*.62+.45);
  const left=column*lanes+em*.35;
  const graphWidth=width-left-right, graphHeight=height-top-bottom;
  if(graphWidth<=0||graphHeight<=0)return;
  const x=round=>left+graphWidth*round/rounds;
  const y=points=>top+graphHeight*(1-points/maxTotal);
  ctx.font=`500 ${axisSize}px "IBM Plex Mono", monospace`;
  ctx.fillStyle='#bbd3ff';ctx.textBaseline='middle';ctx.textAlign='right';
  for(let value=0;value<=maxTotal;value+=50){
    const lane=(value/50)%lanes;
    ctx.fillText(value,left-em*.35-lane*column,y(value));
    ctx.beginPath();ctx.moveTo(left,y(value));ctx.lineTo(x(rounds),y(value));
    ctx.strokeStyle=value%100===0?'#385795':'#253d6b';ctx.lineWidth=1;ctx.stroke();
  }
  ctx.textAlign='center';ctx.textBaseline='top';
  const labelSize=Math.min(em,.72*graphWidth/rounds);
  ctx.font=`500 ${labelSize}px "IBM Plex Mono", monospace`;
  targets.forEach((target,i)=>{
    const label=typeof target==='number'?String(target):target[0];
    ctx.fillText(label,x(i+1),height-bottom+em*.43);
  });
  ctx.save();
  ctx.beginPath();ctx.rect(left,top,graphWidth,graphHeight);ctx.clip();
  ctx.beginPath();
  for(let round=1;round<=rounds;round++){
    ctx.moveTo(x(round),top);ctx.lineTo(x(round),y(0));
  }
  ctx.lineWidth=1;ctx.strokeStyle='rgba(161,189,244,.22)';ctx.stroke();
  ctx.beginPath();ctx.moveTo(x(0),y(0));
  state.pace?.slice(1).forEach((score,i)=>ctx.lineTo(x(i+1),y(score)));
  ctx.strokeStyle='#ffd67a';ctx.lineWidth=Math.max(1.5,em*.15);
  ctx.setLineDash([em*.48,em*.35]);ctx.stroke();
  ctx.restore();
  for(const {index} of [...leaders].reverse()){
    const data=state.traces[index];
    let cumulative=0;
    const front=state.totals[index]===leaders[0].points;
    const active=!state.paused&&state.round<targets.length&&index===state.thrower;
    ctx.globalAlpha=active?1:(front?0.9:0.68);
    ctx.strokeStyle=traceColours[index];ctx.fillStyle=traceColours[index];
    ctx.lineWidth=active?Math.max(3,width*.006):front?Math.max(2.7,width*.005):Math.max(1.55,width*.0035);
    ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x(0),y(0));
    if(active&&pulse){pulse.beginPath();pulse.moveTo(x(0),y(0));}
    let endpoint=0;
    const visible=index===racePlayer?Math.max(0,data.length-addedSteps*(1-progress)):data.length;
    for(let step=0;step<Math.ceil(visible);step++){
      const portion=Math.min(1,visible-step);
      endpoint=(step+portion)/3;
      cumulative+=data[step]*portion;
      ctx.lineTo(x(endpoint),y(cumulative));
      if(active&&pulse)pulse.lineTo(x(endpoint),y(cumulative));
    }
    ctx.stroke();
    if(active&&pulse){
      pulse.strokeStyle=traceColours[index];pulse.fillStyle=traceColours[index];
      pulse.lineWidth=Math.max(4,width*.009);pulse.lineJoin='round';pulse.lineCap='round';
      pulse.shadowColor=traceColours[index];pulse.shadowBlur=width*.018;pulse.stroke();
      pulse.beginPath();pulse.arc(x(endpoint),y(cumulative),Math.max(3,width*.008),0,Math.PI*2);pulse.fill();
      pulse.shadowBlur=0;
    }
    if(data.length){
      if(front){ctx.shadowColor=traceColours[index];ctx.shadowBlur=width*.015;}
      ctx.beginPath();ctx.arc(x(endpoint),y(cumulative),front?width*.007:width*.005,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
    }
  }
  ctx.globalAlpha=1;
}
function stopGraphics(){
  cancelAnimationFrame(frameRequest);
  cancelAnimationFrame(raceRequest);
  frameRequest=raceRequest=0;
}
function stopPresentation(){
  stopGraphics();
  for(const timer of [cueTimer,holdTimer,exitTimer,padTimer,flipSwapTimer,flipEndTimer,boardLightTimer])clearTimeout(timer);
}
function settleThrower(){
  const slot=screen.querySelector('.name-slot');
  slot?.querySelector('.departing-name')?.remove();
  slot?.querySelector('.arriving-name')?.classList.remove('arriving-name');
  slot?.classList.remove('handover');
}
function resumePresentation(){
  if(!state||screen.hidden||document.hidden)return;
  // Restore a settled board even when the scorer has not sent a new frame yet.
  render(false,null,false,true);
  const miss=screen.querySelector('[data-dart="Miss"]');
  if(miss&&controls)controls.bindMiss(miss);
}
function drawGraphics(racePlayer=-1,addedSteps=1){
  stopGraphics();
  if(!state||screen.hidden||document.hidden)return;
  frameRequest=requestAnimationFrame(()=>{
    if(!state||screen.hidden||document.hidden)return;
    drawBoard();
    if(!motion||racePlayer<0){drawRace();return;}
    let began;
    function update(time){
      if(!state||screen.hidden||document.hidden)return;
      began??=time;
      const elapsed=Math.min((time-began)/350,1);
      const progress=1-(1-elapsed)**3;
      drawRace(racePlayer,progress,addedSteps);
      if(elapsed<1)raceRequest=requestAnimationFrame(update);
    }
    raceRequest=requestAnimationFrame(update);
  });
}
// Each column stores seven LED rows, top bit at the least-significant end.
const letterColumns={
  A:[126,9,9,9,126],B:[127,73,73,73,54],C:[62,65,65,65,34],D:[127,65,65,34,28],
  E:[127,73,73,73,65],F:[127,9,9,9,1],G:[62,65,73,73,122],H:[127,8,8,8,127],
  I:[65,65,127,65,65],J:[32,64,65,63,1],K:[127,8,20,34,65],L:[127,64,64,64,64],
  M:[127,2,12,2,127],N:[127,4,8,16,127],O:[62,65,65,65,62],P:[127,9,9,9,6],
  Q:[62,65,81,33,94],R:[127,9,25,41,70],S:[38,73,73,73,50],T:[1,1,127,1,1],
  U:[63,64,64,64,63],V:[31,32,64,32,31],W:[127,32,24,32,127],X:[99,20,8,20,99],
  Y:[3,4,120,4,3],Z:[97,81,73,69,67], ' ':[0,0,0], '-':[8,8,8], "'":[3]
};
function drawNameDisplay(name){
  const letters=[...name.toUpperCase()].map(letter=>letterColumns[letter]);
  if(letters.some(letter=>!letter))return;
  const columns=letters.flatMap(letter=>[...letter,0]).slice(0,-1);
  const title=screen.querySelector('.centre-head h2');
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-hidden','true');
  canvas.width=columns.length*12;canvas.height=84;
  const pen=canvas.getContext('2d');
  if(!pen)return;
  const text=document.createElement('span');
  text.className='sr-only';text.textContent=name;
  title.replaceChildren(text,canvas);
  title.classList.add('matrix-name');
  title.style.setProperty('--columns',columns.length);
  columns.forEach((bits,x)=>{
    for(let y=0;y<7;y++){
      const on=bits&(1<<y);
      pen.fillStyle=on?(y<2?'#f4ffff':y<5?'#b4f4ff':'#89dfff'):'#23345a';
      pen.beginPath();pen.arc(6+12*x,6+12*y,on?5.1:2.8,0,Math.PI*2);pen.fill();
    }
  });
}
function slideThrower(previous){
  const slot=screen.querySelector('.name-slot');
  const outgoing=previous;
  outgoing.classList.remove('arriving-name');
  outgoing.classList.add('departing-name');
  outgoing.setAttribute('aria-hidden','true');
  slot.style.setProperty('--half-track',slot.clientWidth/2+'px');
  const incoming=slot.querySelector('.thrower-identity');
  incoming.classList.add('arriving-name');
  slot.append(outgoing);
  slot.classList.add('handover');
  outgoing.addEventListener('animationend',event=>{
    if(event.animationName==='name-depart')outgoing.remove();
  });
  incoming.addEventListener('animationend',event=>{
    if(event.animationName!=='name-arrive')return;
    outgoing.remove();incoming.classList.remove('arriving-name');slot.classList.remove('handover');
  });
}
function showRoundFlip(){
  const board=screen.querySelector('.board-face');
  const target=board.querySelector('.target-word');
  const previous=targets[state.round-1];
  const flip=document.createElement('div');
  flip.className='round-flip';flip.dataset.previous='yes';flip.setAttribute('aria-hidden','true');
  flip.innerHTML='<div class="round-rotor"><div class="round-front"></div><div class="round-back"><span>Round</span><strong>Complete</strong></div></div>';
  const front=flip.querySelector('.round-front');
  function copyFace(element){
    front.innerHTML=element.innerHTML;
    front.style.fontSize=getComputedStyle(element).fontSize;
  }
  board.append(flip);
  copyFace(target);
  front.innerHTML=typeof previous==='number'?`${previous}<small>s</small>`:previous.toUpperCase();
  if(typeof previous==='string')front.style.fontSize='min(7cqw,110px)';
  board.classList.add('flipping');
  flipSwapTimer=setTimeout(()=>{
    flip.dataset.previous='no';
    board.querySelector('#hitSpot:not([data-misses])')?.remove();
    copyFace(target);
    drawBoard();
  },420);
  flipEndTimer=setTimeout(()=>{
    board.classList.remove('flipping');flip.remove();drawBoard();
  },1750);
}
function render(focusKey=false,effect=null,handover=false,resetName=false){
  clearFeedback();
  stopPresentation();
  const target=targets[state.round];
  const finished=target===undefined;
  const control=document.activeElement.closest?.('.scorepad button');
  const focus=focusKey&&control?{dart:control.dataset.dart,action:control.dataset.action}:null;
  const effectName=effect?.kind??'';
  const identity=playerIdentity(state.thrower);
  const identityKey=JSON.stringify([state.thrower,identity.name,identity.nickname]);
  const oldSlot=screen.querySelector('.name-slot');
  const previousName=motion&&handover&&!finished?oldSlot?.querySelector('.thrower-identity:not(.departing-name)'):null;
  const retainedSlot=!resetName&&!finished&&!state.paused&&oldSlot?.dataset.identity===identityKey?oldSlot:null;
  const phases=retainedSlot?.getAnimations({subtree:true}).filter(animation=>
    animation.animationName==='name-arrive'||animation.animationName==='name-depart').map(animation=>({
    target:animation.effect.target,name:animation.animationName,start:animation.startTime,time:animation.currentTime
  }))??[];
  const oldRows=motion&&effect?new Map([...screen.querySelectorAll('.standings tr[data-player]')].map(row=>[
    row.dataset.player,row.getBoundingClientRect().top
  ])):null;
  // Replacing the panels on a throw must not restart their background motion.
  screen.style.setProperty('--ambient-phase',`-${document.timeline.currentTime??0}ms`);
  screen.dataset.motion=motion&&!document.hidden?'on':'off';
  screen.innerHTML=`<div class="tv ${state.returnSeconds!==null?'timer-active':''} ${state.returnSeconds!==null&&state.returnSeconds<=10?'timer-urgent':''}" data-effect="${effectName}" data-handover="${Boolean(handover&&!finished)}">
    <div class="field">${roundPanel(finished,effect)}${centrePanel(target,finished,effect)}${sidePanel()}</div>
    ${controls?scorePad(target,finished):''}
  </div>`;
  if(motion){
    for(const name of screen.querySelectorAll('.standings [data-player] .name')){
      for(const pulse of name.getAnimations()){
        if(pulse.animationName==='form-glow')pulse.startTime=Number(name.closest('tr').dataset.player)*-170;
      }
    }
  }
  if(!finished&&!state.paused){
    const slot=screen.querySelector('.name-slot');
    if(retainedSlot){
      slot.replaceWith(retainedSlot);
      // DOM reinsertion can restart CSS animations. Restore their original phase
      // so record/timer refreshes do not replay or interrupt a turn handover.
      for(const phase of phases){
        const animation=phase.target.getAnimations().find(item=>item.animationName===phase.name);
        if(!animation)continue;
        if(phase.start!==null)animation.startTime=phase.start;
        else if(phase.time!==null)animation.currentTime=phase.time;
      }
    }else{
      slot.dataset.identity=identityKey;
      drawNameDisplay(identity.name);
      if(previousName)slideThrower(previousName);
    }
  }
  if(motion&&effect?.roundComplete&&!finished&&!state.returnSeconds)showRoundFlip();
  if(effect?.hit)boardLightTimer=setTimeout(()=>{
    screen.querySelector('#hitSpot')?.remove();
  },effect.misses?420*effect.misses:580);
  if(oldRows){
    for(const row of screen.querySelectorAll('.standings tr[data-player]')){
      const shift=oldRows.get(row.dataset.player)-row.getBoundingClientRect().top;
      if(Number.isFinite(shift)&&Math.abs(shift)>2){
        row.animate([{transform:`translateY(${shift}px)`},{transform:'none'}],{duration:290,easing:'cubic-bezier(.19,.74,.25,1)'});
      }
    }
  }
  if(focus){
    const buttons=[...screen.querySelectorAll('.scorepad button:not(:disabled)')];
    const next=buttons.find(key=>focus.dart===key.dataset.dart&&focus.action===key.dataset.action)??buttons[0];
    next?.focus({preventScroll:true});
  }
  drawGraphics(effect?.hit||effect?.committed?effect.player:-1,effect?.addedSteps??3);
}
function soleLeader(scores){
  const highest=Math.max(...scores);
  const first=scores.indexOf(highest);
  return first===scores.lastIndexOf(highest)?first:null;
}
function clearFeedback(){
  clearTimeout(cueTimer);
  screen.querySelector('.feedback')?.remove();
}
function showFeedback(kind,player){
  clearFeedback();
  const lead=kind==='lead';
  const host=lead?screen.querySelector(`.standings tr[data-player="${player}"] th`):screen.querySelector('.round-card .panel-head');
  const badge=document.createElement('span');
  badge.className='feedback '+kind;
  badge.textContent=lead?'New leader':names[player]+' · Scratch';
  host.append(badge);
  cueTimer=setTimeout(()=>badge.remove(),lead?950:850);
}
function holdCompletedVisit(misses){
  const strip=screen.querySelector('.hits.outgoing');
  if(!strip)return;
  const settle=()=>{
    if(!state||screen.hidden||!strip.isConnected)return;
    if(state.round===targets.length){strip.parentElement.remove();drawGraphics();return;}
    strip.parentElement.querySelector('.last-visit')?.remove();
    strip.className='hits';
    strip.setAttribute('aria-label','Hits this visit');
    [...strip.children].forEach((tile,index)=>{
      tile.className='hit-tile pending';
      tile.textContent='';
      tile.setAttribute('aria-label',`Dart ${index+1}, No dart`);
    });
  };
  holdTimer=setTimeout(()=>{
    if(!motion){settle();return;}
    strip.classList.add('retiring');
    exitTimer=setTimeout(settle,270);
  },motion?Math.max(590,misses*420):590);
}
const numberShake={
  Double:[['dShakeUltra','.18s'],['dShakeLow','.26s'],['dShakeMed','.34s']],
  Treble:[['tShakeLow','.22s'],['tShakeMed','.34s'],['tShakeHigh','.50s']]
};
const pressLevels={Single:['sfx','flash-xxl','flash-ultra','flash-low'],Double:['dfx','flash-ultra','flash-low','flash-med'],Treble:['tfx','flash-low','flash-med','flash-high']};
function animatePad(label){
  const pad=screen.querySelector('.scorepad');
  if(!pad)return;
  if(label==='Bounce-out'){
    pad.classList.add('bounce-alert');
    padTimer=setTimeout(()=>pad.classList.remove('bounce-alert'),520);
    return;
  }
  const key=label==='Undo'?pad.querySelector('[data-action="undo"]'):pad.querySelector(`[data-dart="${label}"]`);
  const kind=/^D\d+$/.test(label)?'Double':/^T\d+$/.test(label)?'Treble':label;
  const levels=pressLevels[kind];
  if(levels){
    const step=pressCounts[kind]%3+1;
    pressCounts[kind]=step;
    if(!motion)return;
    key?.classList.add(levels[0],levels[step]);
    if(numberShake[kind]){
      const number=screen.querySelector('.board-face:not(.flipping) .target-word small')?.closest('.scored-number')
        ?? screen.querySelector('.new-hit .tile-value .scored-number');
      if(number){
        const [shake,duration]=numberShake[kind][step-1];
        number.style.setProperty('--shake',shake);
        number.style.setProperty('--shake-time',duration);
        number.classList.add('vibrating');
      }
    }
  }else if(key&&motion&&(label==='Miss'||label==='Undo')){
    key.classList.add(label==='Miss'?'miss-pulse':'undo-pulse');
  }
}

let controls=null;
window.setTvControls = handlers=>{controls=handlers;};
window.showTvFrame = function(next) {
  const old=presentationInterrupted?null:state;
  presentationInterrupted=false;
  state=next; names=next.names.map((name,index)=>next.identities?.[index]?.name||name); targets=next.targets;
  document.querySelector('#connection').hidden=true;
  screen.hidden=false;
  const last=next.last;
  const delta=old?next.historyLength-old.historyLength:0;
  let effect=null;
  if(delta>0 && last){
    const committed=next.thrower!==last.player || next.round!==last.round;
    effect={...last,committed,closedDarts:committed?last.visit:null,addedSteps:delta,
      roundComplete:next.round===last.round+1,misses:last.hit==='Miss'||last.hit==='BO'?Math.min(delta,3):0};
    effect.kind=next.round===targets.length?(soleLeader(next.totals)===null?'tie':'win'):
      effect.roundComplete?'round':'';
  }
  const handover=Boolean(motion&&!document.hidden&&old&&delta>=0&&next.thrower!==old.thrower&&
    old.round<old.targets.length&&next.round<targets.length&&!old.paused&&!next.paused);
  render(true,effect,handover,!old||!motion||document.hidden||delta<0);
  const miss=screen.querySelector('[data-dart="Miss"]');
  if(miss && controls) controls.bindMiss(miss);
  if(effect){
    let key=effect.hit;
    if(typeof targets[last.round]==='number')key=({S:'Single',D:'Double',T:'Treble'})[key[0]]||key;
    animatePad(key==='BO'?'Bounce-out':key);
    if(effect.committed)holdCompletedVisit(effect.misses);
    if(soleLeader(state.totals)===last.player && soleLeader(old.totals)!==last.player)showFeedback('lead',last.player);
    else if(effect.committed && last.visit.every(d=>!d.points))showFeedback('scratch',last.player);
  }else if(delta<0)animatePad('Undo');
};
screen.addEventListener('click',event=>{
  if(event.target.closest('.tv-settings')) { controls?.settings(); return; }
  const button=event.target.closest('.scorepad button');
  if(button && !button.disabled)controls?.score(button.dataset.action||button.dataset.dart);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')controls?.exit();});
window.addEventListener('resize',()=>{if(state)drawGraphics();});
systemMotion.addEventListener('change',()=>{motion=!systemMotion.matches;if(state)window.showTvFrame(state);});
document.fonts.ready.then(()=>{if(state)drawGraphics();});
document.addEventListener('visibilitychange',()=>{
  screen.dataset.motion=motion&&!document.hidden?'on':'off';
  if(document.hidden){presentationInterrupted=true;stopPresentation();settleThrower();}
  else resumePresentation();
});
window.addEventListener('pagehide',()=>{
  presentationInterrupted=true;stopPresentation();if(state)settleThrower();screen.dataset.motion='off';
});
window.addEventListener('pageshow',()=>{
  screen.dataset.motion=motion&&!document.hidden?'on':'off';
  resumePresentation();
});
if(window===window.top && /^[a-f\d-]{36}$/i.test(location.hash.slice(1)) && typeof BroadcastChannel==='function'){
  const channelName='sq-tv-'+location.hash.slice(1);
  let channel=null;
  const receive=event=>{
    if(event.data?.frame)window.showTvFrame(event.data.frame);
    else if(event.data?.closed){
      stopPresentation();
      screen.hidden=true;
      const status=document.querySelector('#connection');
      status.textContent='Waiting for the scorer to reopen TV mode';status.hidden=false;
      state=null;
    }
  };
  function connect(){
    if(!channel){
      channel=new BroadcastChannel(channelName);
      channel.onmessage=receive;
    }
    channel.postMessage('ready');
  }
  function disconnect(){
    if(!channel)return;
    channel.onmessage=null;
    channel.close();
    channel=null;
  }
  connect();
  // A bfcache restore resumes this script instance with its old channel closed.
  window.addEventListener('pageshow',connect);
  window.addEventListener('pagehide',disconnect);
}
