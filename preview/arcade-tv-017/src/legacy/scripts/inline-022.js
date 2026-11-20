
(function(){
  if(window.__sqFix78TurboHsStartRows) return;
  window.__sqFix78TurboHsStartRows = true;

  function isTurbo(){
    try{
      const m=window.state?.match||{}, d=window.__sqTournamentDraft||window.state?.__sqTournamentDraft||null;
      const t=String(m.tournamentType||m.type||d?.type||window.state?.tournamentType||'').toLowerCase();
      return !!(t==='turbo'||m.strictTimer===true||m.throwLimitSeconds===20||window.state?.strictTimer===true||window.state?.throwLimitSeconds===20);
    }catch(_){return false;}
  }
  function startIdx(){
    try{
      const r=window.state?.match?.tournamentRules||window.state?.__sqTournamentDraft?.rules||window.__sqTournamentDraft?.rules||{};
      const n=Number(r.startRoundIndex ?? 7);
      return Number.isFinite(n)?Math.max(0,n):7;
    }catch(_){return 7;}
  }
  function markTurboPreStartRows(){
    try{
      const panel=document.querySelector('.livev2panel');
      const rows=document.getElementById('v2Rows');
      const wrap=document.querySelector('.livev2panel .v2RowsWrap');
      if(!panel||!rows||!isTurbo()) return;
      panel.classList.add('sqTurboClampActive');
      const cutoff=startIdx();
      const pCount=Array.isArray(window.state?.players)?window.state.players.length:2;
      const kids=Array.from(rows.children);
      let firstStartBadge=null;
      for(let i=0;i<kids.length;i++){
        const badge=kids[i];
        if(!badge.classList||!badge.classList.contains('v2Badge')) continue;
        const txt=String(badge.textContent||'').trim();
        const n=Number(txt);
        const idx=Number.isFinite(n)?(n-10):-1;
        if(idx>=0 && idx<cutoff){
          badge.textContent='';
          badge.classList.add('sqTurboPreStartBadge');
          for(let j=1;j<=pCount;j++){
            const cell=kids[i+j];
            if(cell&&cell.classList&&cell.classList.contains('v2Cell')){
              cell.classList.add('sqTurboPreStartCell');
              cell.querySelectorAll('.v2CellNum,.v2SoloScore').forEach(el=>{el.textContent='';});
            }
          }
        } else if(idx===cutoff && !firstStartBadge){
          firstStartBadge=badge;
        }
      }
      // Prevent manual scroll back into pre-start Turbo rounds once the game is at/after the Turbo start.
      if(wrap && firstStartBadge && Number(window.state?.currentRound||0) >= cutoff){
        const minTop=Math.max(0, firstStartBadge.offsetTop-8);
        if(wrap.scrollTop < minTop) wrap.scrollTop = minTop;
        if(!wrap.__sqTurboClampBound){
          wrap.__sqTurboClampBound=true;
          wrap.addEventListener('scroll', function(){
            try{
              if(!isTurbo()) return;
              const b=document.querySelector('.v2Badge:not(.sqTurboPreStartBadge)');
              const min=b?Math.max(0,b.offsetTop-8):minTop;
              if(wrap.scrollTop < min) wrap.scrollTop = min;
            }catch(_){ }
          }, {passive:true});
        }
      }
    }catch(_){ }
  }
  const oldUpdate=window.updateUI||(typeof updateUI==='function'?updateUI:null);
  if(oldUpdate && !oldUpdate.__sqFix78Wrapped){
    const wrapped=function(){const ret=oldUpdate.apply(this,arguments);setTimeout(markTurboPreStartRows,0);return ret;};
    wrapped.__sqFix78Wrapped=true; window.updateUI=wrapped; try{updateUI=wrapped;}catch(_){ }
  }
  setInterval(markTurboPreStartRows,250);

  function esc(s){try{return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}catch(_){return '';}}
  function parseTime(t){const n=Date.parse(t||'');return Number.isFinite(n)?n:0;}
  function fmtWhen(ts){try{const d=new Date(ts);if(!Number.isFinite(d.getTime()))return '—';return d.toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',', '');}catch(_){return '—';}}
  function gameIsTurbo(g){
    try{
      const st=g?.state||g?.raw?.state||{};
      const m=st.match||g?.match||{};
      const type=String(st.tournamentType||st.tournament_type||m.tournamentType||m.type||m.tournament_type||st.__sqTournamentDraft?.type||g?.tournamentType||'').toLowerCase();
      return !!(type==='turbo'||st.strictTimer===true||st.throwLimitSeconds===20||m.strictTimer===true||m.throwLimitSeconds===20||st.mode==='turbo');
    }catch(_){return false;}
  }
  function norm(s){return String(s||'').trim().toLowerCase();}
  async function savedSet(){
    try{const rows=(typeof cloudListPlayers==='function')?await cloudListPlayers():[];return new Set((rows||[]).map(p=>norm(p?.name||p?.player_name||p?.display_name||p)).filter(Boolean));}catch(_){return new Set();}
  }
  async function getRows(kind){
    const rows=(typeof window.__sqComputeOfficialPlayerGameRows==='function')?await window.__sqComputeOfficialPlayerGameRows():[];
    return (rows||[]).filter(r=>kind==='turbo'?gameIsTurbo(r.game):!gameIsTurbo(r.game));
  }

  window.openHighScoreLeagueDialog = async function openHighScoreLeagueDialog(mode){
    let hsMode = (mode==='turbo')?'turbo':'classic';
    document.querySelectorAll('.sq-hs-league-backdrop').forEach(n=>n.remove());
    const overlay=document.createElement('div'); overlay.className='modal-backdrop sq-hs-league-backdrop';
    const modal=document.createElement('div'); modal.className='modal sq-wide-modal'; modal.style.maxHeight='90vh'; modal.style.overflow='hidden';
    const title=document.createElement('h3'); title.textContent='High Score League';
    const body=document.createElement('div'); body.className='modal-body';
    body.innerHTML='<div class="sq-hs-mode-toggle"><button id="sqHsClassic" class="btn">Classic</button><button id="sqHsTurbo" class="btn">Turbo</button></div><div id="sqHsHint" class="tag" style="margin:6px 0 10px;"></div><div class="table-wrap"><table class="hs-table hs-league-table"><thead><tr><th style="width:56px;">#</th><th>PLAYER</th><th style="width:140px;text-align:right;">HIGH SCORE</th><th style="width:180px;">WHEN</th></tr></thead><tbody id="hsLeagueBody"><tr><td colspan="4" style="opacity:.8;padding:14px;">Loading…</td></tr></tbody></table></div>';
    const footer=document.createElement('div'); footer.className='modal-footer';
    const backBtn=document.createElement('button'); backBtn.className='btn'; backBtn.textContent='Back';
    const closeBtn=document.createElement('button'); closeBtn.className='btn sq-pill'; closeBtn.textContent='Close';
    footer.append(backBtn,closeBtn); modal.append(title,body,footer); overlay.appendChild(modal); document.body.appendChild(overlay);
    function close(){overlay.remove();}
    backBtn.onclick=function(){close();try{if(typeof openLeagueRankingsDialog==='function')openLeagueRankingsDialog();}catch(_){}};
    closeBtn.onclick=close; overlay.addEventListener('click',e=>{if(e.target===overlay)close();}); overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close();}); modal.tabIndex=0; modal.focus();
    const tbody=modal.querySelector('#hsLeagueBody'), hint=modal.querySelector('#sqHsHint'), bClassic=modal.querySelector('#sqHsClassic'), bTurbo=modal.querySelector('#sqHsTurbo');
    async function render(){
      bClassic.classList.toggle('active',hsMode==='classic'); bTurbo.classList.toggle('active',hsMode==='turbo');
      hint.textContent = hsMode==='turbo'
        ? 'Turbo Match Play and Tournament games. Turbo records are separated from Classic because Turbo starts at 17s.'
        : 'Classic official games only. Turbo scores are stored separately under Turbo.';
      tbody.innerHTML='<tr><td colspan="4" style="opacity:.8;padding:14px;">Loading…</td></tr>';
      try{
        const saved=await savedSet();
        const rows=await getRows(hsMode);
        const best=new Map();
        rows.forEach(r=>{if(saved.size && !saved.has(r.playerKey))return;const prev=best.get(r.playerKey);if(!prev||r.score>prev.score||(r.score===prev.score&&parseTime(r.ts)>parseTime(prev.ts)))best.set(r.playerKey,r);});
        const out=Array.from(best.values()).sort((a,b)=>(b.score-a.score)||(parseTime(b.ts)-parseTime(a.ts))||String(a.player).localeCompare(String(b.player)));
        if(!out.length){tbody.innerHTML='<tr><td colspan="4" style="opacity:.85;padding:14px;">No '+(hsMode==='turbo'?'Turbo':'Classic')+' high scores found in saved game history.</td></tr>';return;}
        tbody.innerHTML=out.map((r,i)=>'<tr><td style="color:#ff8a00;font-weight:800;">'+(i+1)+'</td><td>'+esc(r.player)+'</td><td style="text-align:right;font-weight:800;">'+Math.round(r.score)+'</td><td style="opacity:.85;">'+esc(fmtWhen(r.ts))+'</td></tr>').join('');
      }catch(e){console.error('[SQ] High Score League mode render failed',e);tbody.innerHTML='<tr><td colspan="4" style="opacity:.85;padding:14px;">Failed to load high score league.</td></tr>';}
    }
    bClassic.onclick=function(){hsMode='classic';render();}; bTurbo.onclick=function(){hsMode='turbo';render();}; render();
  };
})();
