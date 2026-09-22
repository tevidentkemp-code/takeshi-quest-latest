
(function(){
  if(window.__sqFix86TournamentTreeDeciderBack)return;
  window.__sqFix86TournamentTreeDeciderBack=true;

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function body(){return document.getElementById('startGameModalBody');}
  function modal(){return document.getElementById('startGameModal');}
  function isTournamentFlow(){const b=body();return !!(b&&b.querySelector('.sg-tournament-intro'));}
  function updateOuterBack(){const m=modal();if(!m)return; if(isTournamentFlow())m.classList.add('sqTournamentFlowActive'); else m.classList.remove('sqTournamentFlowActive');}

  function draftPairs(){
    const d=window.__sqTournamentDraft;
    if(!d||!Array.isArray(d.bracket))return null;
    return {draft:d,pairs:d.bracket.map(function(m){return [m&&m.a,m&&m.b];}).filter(function(p){return p[0]&&p[1];})};
  }
  function teamHtml(p){return '<div class="sq-fix86-team"><span class="sq-fix86-seed">#'+esc(p.seed||'')+'</span>'+esc(p.name||'TBC')+'</div>';}
  function matchHtml(pair){return '<div class="sq-fix86-match">'+teamHtml(pair[0])+'<div class="sq-fix86-vs">VS</div>'+teamHtml(pair[1])+'</div>';}
  function buildClassicStartTree(){
    const got=draftPairs(); if(!got||!got.pairs.length)return '';
    const d=got.draft, pairs=got.pairs;
    const title=(String(d.type||'').toUpperCase()||'TOURNAMENT')+' / '+d.size+' PLAYERS';
    const semiSlots = d.size===8 ? '<div class="sq-fix86-final-slot">Semi-final 1</div><div class="sq-fix86-final-slot">Semi-final 2</div>' : '';
    const finalSlots = d.size===4 ? 'Semi winners progress right' : 'Semi-final winners progress right';
    return '<div class="sq-fix86-start-bracket" data-sq-fix86-start-tree="1">'+
      '<div class="sq-fix86-start-bracket-title">'+esc(title)+'</div>'+ 
      '<div class="sq-fix86-bracket-grid sq-fix86-ltr-bracket">'+
        '<div class="sq-fix86-col sq-fix86-left">'+pairs.map(matchHtml).join('')+'</div>'+ 
        (semiSlots ? '<div class="sq-fix86-center"><div class="sq-fix86-final-card"><div class="sq-fix86-final-label">SEMI-FINALS</div>'+semiSlots+'</div></div>' : '')+
        '<div class="sq-fix86-center"><div class="sq-fix86-final-card"><div class="sq-fix86-final-label">FINAL</div><div class="sq-fix86-final-slot">TBC</div><div class="sq-fix86-final-slot">TBC</div><div class="sg-tournament-note" style="margin-top:8px">'+esc(finalSlots)+'</div></div></div>'+ 
        '<div class="sq-fix86-center"><div class="sq-fix86-final-card"><div class="sq-fix86-final-label">WINNER</div><div class="sq-fix86-final-slot">TBC</div></div></div>'+ 
      '</div>'+ 
    '</div>';
  }
  function patchInitialTree(){
    const b=body(); if(!b)return;
    updateOuterBack();
    const title=b.textContent||'';
    if(!/RANDOMISED KNOCKOUT TREE/i.test(title))return;
    const br=b.querySelector('.sg-tournament-bracket');
    if(!br||br.dataset.sqFix86Patched==='1')return;
    const html=buildClassicStartTree();
    if(!html)return;
    br.outerHTML=html;
    const nb=body().querySelector('[data-sq-fix86-start-tree]'); if(nb)nb.dataset.sqFix86Patched='1';
  }

  const obs=new MutationObserver(function(){setTimeout(patchInitialTree,0);setTimeout(updateOuterBack,0);});
  document.addEventListener('DOMContentLoaded',function(){const b=body(); if(b)obs.observe(b,{childList:true,subtree:true}); updateOuterBack(); patchInitialTree();});
  setTimeout(function(){const b=body(); if(b)obs.observe(b,{childList:true,subtree:true}); updateOuterBack(); patchInitialTree();},80);

  // Decider safety: keep click/touch input alive above tournament overlays.
  document.addEventListener('pointerdown',function(e){
    const d=e.target&&e.target.closest&&e.target.closest('.modal-decider button');
    if(!d)return;
    try{d.style.pointerEvents='auto';d.disabled=false;}catch(_){ }
  },true);
  document.addEventListener('click',function(e){
    const btn=e.target&&e.target.closest&&e.target.closest('.modal-decider button');
    if(!btn)return;
    try{btn.disabled=false;}catch(_){ }
  },true);

  window.__sqFix86PatchTournamentSetupNow=function(){updateOuterBack();patchInitialTree();return {tournamentFlow:isTournamentFlow(), treePatched:!!document.querySelector('[data-sq-fix86-start-tree]')};};
})();
