/*
  SC-038 — Post-game presentation flow.
  Presentation-only wrapper around the existing completion/save/advance path.
  Scoring, Supabase persistence, XP calculation and match advancement remain
  owned by the existing runtime.
*/
(function(){
  'use strict';

  var STYLE_ID = 'sq-sc038-postgame-style';

  function esc(v){
    var s = String(v == null ? '' : v);
    return s.replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch] || ch;
    });
  }

  function injectStyles(){
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      /* SC-038 — bull colours: outer green, inner red. */
      body.livev2-on[data-page="game"] #pad .dtBullRow .dtBullBtn[data-bull="Outer"],
      body.livev2-on[data-page="game"] #pad .dtBullRow .dtBullBtn:first-child:not(.inner){
        background:linear-gradient(180deg,rgba(18,78,44,.86),rgba(9,45,27,.96)) !important;
        border-color:rgba(47,208,107,.82) !important;
        color:#baf7cd !important;
        box-shadow:0 0 0 1px rgba(47,208,107,.10),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(225,255,234,.10) !important;
      }
      body.livev2-on[data-page="game"] #pad .dtBullRow .dtBullBtn[data-bull="Inner"],
      body.livev2-on[data-page="game"] #pad .dtBullRow .dtBullBtn.inner{
        background:linear-gradient(180deg,rgba(112,25,39,.88),rgba(55,10,22,.97)) !important;
        border-color:rgba(255,77,94,.82) !important;
        color:#ffc0c7 !important;
        box-shadow:0 0 0 1px rgba(255,77,94,.10),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,225,229,.10) !important;
      }

      /* Result screen keeps the current dark/orange arcade treatment. */
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-winnerName{
        display:flex;
        flex-direction:column;
        align-items:flex-start;
        gap:5px;
        max-width:min(430px,92vw);
        margin-bottom:18px;
        line-height:1;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-winnerMain{
        display:block;
        font-size:clamp(28px,6vw,40px);
        line-height:.98;
        font-weight:950;
        letter-spacing:.01em;
        color:var(--shatekiOrange,#ff7a00);
        text-transform:uppercase;
        text-wrap:balance;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-winnerNick{
        display:block;
        font-size:clamp(15px,3.8vw,20px);
        line-height:1.05;
        font-weight:900;
        letter-spacing:.08em;
        color:#ffad63;
        text-transform:uppercase;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-statPanel{
        width:min(300px,100%);
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-statValue{
        white-space:nowrap;
      }

      /* Screen 2 — all-player scorecard. */
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-scorecard{
        position:relative;
        z-index:4;
        display:none;
        width:100%;
        padding:4px 0 8px;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-title{
        margin:2px 0 18px;
        font-size:clamp(22px,5vw,30px);
        line-height:1;
        font-weight:950;
        letter-spacing:.11em;
        color:rgba(238,241,255,.94);
        text-transform:uppercase;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-table{
        border:1px solid rgba(139,166,210,.18);
        border-radius:16px;
        overflow:hidden;
        background:linear-gradient(180deg,rgba(14,22,36,.94),rgba(7,12,21,.98));
        box-shadow:0 16px 38px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.045);
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-head,
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-grid{
        display:grid;
        grid-template-columns:minmax(0,1.6fr) minmax(52px,.55fr) minmax(52px,.62fr) minmax(82px,.95fr);
        align-items:center;
        gap:8px;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-head{
        padding:10px 12px;
        background:rgba(255,255,255,.035);
        border-bottom:1px solid rgba(255,255,255,.07);
        color:rgba(218,226,244,.56);
        font-size:10px;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-player{
        padding:12px;
        border-bottom:1px solid rgba(255,255,255,.06);
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-player:last-child{
        border-bottom:0;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-player.isWinner{
        background:linear-gradient(90deg,rgba(255,122,0,.11),rgba(255,122,0,.02) 70%,transparent);
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-name{
        min-width:0;
        color:#f3f6ff;
        font-size:14px;
        font-weight:900;
        overflow-wrap:anywhere;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-player.isWinner .gc-sc038-name{
        color:#ff9a3d;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-num{
        color:#eef3ff;
        font-size:14px;
        font-weight:900;
        font-variant-numeric:tabular-nums;
        white-space:nowrap;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-records{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:8px;
        padding-left:0;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-record{
        display:inline-flex;
        align-items:center;
        min-height:24px;
        padding:3px 8px;
        border-radius:999px;
        font-size:10px;
        line-height:1;
        font-weight:950;
        letter-spacing:.06em;
        text-transform:uppercase;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-record.pb{
        color:#ffe2a8;
        border:1px solid rgba(255,176,46,.48);
        background:rgba(92,63,14,.58);
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-record.wr{
        color:#c7f6ff;
        border:1px solid rgba(74,184,255,.55);
        background:rgba(16,52,86,.62);
        box-shadow:0 0 13px rgba(74,184,255,.12);
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-next{
        margin-top:14px;
      }

      /* XP screen: only the match/game continuation action remains. */
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-actions [data-action="breakdown"],
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-actions [data-action="scorecard"]{
        display:none !important;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-actions{
        grid-template-columns:1fr !important;
      }
      .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-actions [data-action="advanceMatch"]{
        min-height:60px;
        color:#fff;
        background:linear-gradient(180deg,rgba(255,143,27,.98),rgba(241,82,0,.98));
        border-color:rgba(255,196,100,.46);
        box-shadow:0 16px 34px rgba(255,91,0,.20),inset 0 1px 0 rgba(255,255,255,.20);
      }

      @media (max-width:560px){
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-arcade-shell{
          min-height:520px;
          padding:26px 18px 20px;
        }
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-winnerMain{
          font-size:clamp(26px,8vw,34px);
        }
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-winnerNick{
          font-size:clamp(14px,4.4vw,18px);
        }
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-statPanel{
          width:min(285px,72%);
        }
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-head,
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-grid{
          grid-template-columns:minmax(0,1.45fr) 52px 52px minmax(72px,.9fr);
          gap:6px;
        }
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-head{
          padding:9px 8px;
          font-size:8px;
        }
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-player{
          padding:11px 8px;
        }
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-name,
        .modal-gamecomplete.sq-gc-arcade.sq-sc038-flow .gc-sc038-num{
          font-size:12px;
        }
      }
    `;
    document.head.appendChild(st);
  }

  function playerMainAndNick(p, fallback){
    p = p || {};
    var first = String(p.first_name || '').trim();
    var last = String(p.last_name || '').trim();
    var main = [first, last].filter(Boolean).join(' ').trim();
    if (!main) main = String(p.name || fallback || '').trim();
    var nick = String(p.nickname || '').trim();
    return { main: main || String(fallback || 'Player'), nick: nick };
  }

  function roundLabel(idx){
    if (idx >= 0 && idx <= 10) return String(10 + idx);
    if (idx === 11) return 'D';
    if (idx === 12) return 'T';
    if (idx === 13) return 'B';
    return String(idx + 1);
  }

  function playerRows(i){
    try { return Array.isArray(state && state.score && state.score[i]) ? state.score[i] : []; }
    catch(_) { return []; }
  }

  function totalFor(i){
    return playerRows(i).reduce(function(sum,row){ return sum + (Number(row && row.roundTotal) || 0); }, 0);
  }

  function bestRoundFor(i){
    var rows = playerRows(i);
    var best = { index:0, score:0 };
    rows.forEach(function(row, idx){
      var n = Number(row && row.roundTotal) || 0;
      if (n > best.score) best = { index:idx, score:n };
    });
    return best;
  }

  function averageFor(i){
    var denom = 14;
    try {
      if (Array.isArray(window.ROUNDS) && window.ROUNDS.length) denom = window.ROUNDS.length;
      else if (typeof MAX_ROUNDS === 'number' && MAX_ROUNDS > 0) denom = MAX_ROUNDS;
    } catch(_) {}
    return totalFor(i) / Math.max(1, denom);
  }

  function recordFlagsFor(i){
    var out = [];
    try {
      var snap = window.__v2PBWRSnapshot || null;
      if (!snap || !snap.wrByRound || !snap.pbByBucket) return out;
      var bucket = null;
      try {
        if (typeof __sqResolveBucketKeyForPlayer === 'function') bucket = __sqResolveBucketKeyForPlayer(i);
      } catch(_) {}
      var pbMap = null;
      try { pbMap = bucket && snap.pbByBucket.get ? snap.pbByBucket.get(String(bucket)) : null; } catch(_) {}
      playerRows(i).forEach(function(row, r){
        var val = Number(row && row.roundTotal) || 0;
        if (val <= 0) return;
        var rk = null;
        try {
          if (typeof __sqRoundKeyForIdx === 'function') rk = __sqRoundKeyForIdx(r);
        } catch(_) {}
        if (!rk) return;
        var wr = 0, pb = 0;
        try { wr = Number(snap.wrByRound.get ? (snap.wrByRound.get(rk) || 0) : 0); } catch(_) {}
        try { pb = Number(pbMap && pbMap.get ? (pbMap.get(rk) || 0) : 0); } catch(_) {}
        if (wr > 0 && val > wr) out.push({ type:'wr', label:'WR ' + roundLabel(r) + ' / ' + val });
        else if (pb > 0 && val > pb) out.push({ type:'pb', label:'PB ' + roundLabel(r) + ' / ' + val });
      });
    } catch(_) {}
    return out;
  }

  function buildScorecard(winnerScore){
    var host = document.createElement('div');
    host.className = 'gc-sc038-scorecard';
    host.setAttribute('aria-label','Game scorecard');

    var players = [];
    try { players = Array.isArray(state && state.players) ? state.players : []; } catch(_) {}
    var rows = players.map(function(p,i){
      var total = totalFor(i);
      var best = bestRoundFor(i);
      var display = playerMainAndNick(p, 'Player ' + (i + 1));
      var pretty = display.main + (display.nick ? ' "' + display.nick + '"' : '');
      return {
        index:i,
        name:pretty,
        total:total,
        average:averageFor(i),
        best:best,
        records:recordFlagsFor(i),
        winner:total === winnerScore
      };
    });

    host.innerHTML = '<div class="gc-sc038-title">GAME SCORECARD</div>' +
      '<div class="gc-sc038-table">' +
        '<div class="gc-sc038-head"><span>Name</span><span>Score</span><span>Avg</span><span>Best Round</span></div>' +
        rows.map(function(row){
          var records = row.records.length ? '<div class="gc-sc038-records">' + row.records.map(function(rec){
            return '<span class="gc-sc038-record ' + rec.type + '">' + esc(rec.label) + '</span>';
          }).join('') + '</div>' : '';
          return '<div class="gc-sc038-player' + (row.winner ? ' isWinner' : '') + '">' +
            '<div class="gc-sc038-grid">' +
              '<span class="gc-sc038-name">' + esc(row.name) + '</span>' +
              '<span class="gc-sc038-num">' + esc(row.total) + '</span>' +
              '<span class="gc-sc038-num">' + esc(row.average.toFixed(1)) + '</span>' +
              '<span class="gc-sc038-num">' + esc(roundLabel(row.best.index) + ' / ' + row.best.score) + '</span>' +
            '</div>' + records +
          '</div>';
        }).join('') +
      '</div>';
    return host;
  }

  function enhanceLatestComplete(){
    injectStyles();
    var overlays = document.querySelectorAll('.sq-gamecomplete-backdrop');
    var overlay = overlays.length ? overlays[overlays.length - 1] : null;
    var modal = overlay && overlay.querySelector('.modal-gamecomplete.sq-gc-arcade');
    if (!modal || modal.dataset.sc038Enhanced === '1') return;
    modal.dataset.sc038Enhanced = '1';
    modal.classList.add('sq-sc038-flow');

    var players = [];
    try { players = Array.isArray(state && state.players) ? state.players : []; } catch(_) {}
    var totals = players.map(function(_,i){ return totalFor(i); });
    if (!totals.length) return;
    var max = Math.max.apply(Math, totals);
    var winners = [];
    totals.forEach(function(v,i){ if (v === max) winners.push(i); });

    var advanceBtn = modal.querySelector('[data-action="advanceMatch"]');
    var isMatchComplete = !!(advanceBtn && /end\s*match/i.test(advanceBtn.textContent || ''));
    var kicker = modal.querySelector('.gc-arcade-kicker');
    if (kicker) kicker.textContent = isMatchComplete ? 'MATCH COMPLETE' : 'GAME COMPLETE';

    // Decider flow is a protected existing path. Keep its controls intact until
    // the tie has been resolved; only apply the visual colour/typography skin.
    var deciderBtn = modal.querySelector('[data-action="startDecider"]');
    var deciderResolved = !!(state && state._decider && state._decider.resolved);

    if (winners.length === 1 || deciderResolved){
      var winnerIndex = deciderResolved && typeof state._decider.winner === 'number' ? state._decider.winner : winners[0];
      var nameEl = modal.querySelector('.gc-winnerName');
      if (nameEl){
        var bits = playerMainAndNick(players[winnerIndex], nameEl.textContent || ('Player ' + (winnerIndex + 1)));
        nameEl.innerHTML = '<span class="gc-winnerMain">' + esc(bits.main) + '</span>' +
          (bits.nick ? '<span class="gc-winnerNick">“' + esc(bits.nick) + '”</span>' : '');
        nameEl.title = bits.main + (bits.nick ? ' "' + bits.nick + '"' : '');
      }

      var statRows = modal.querySelectorAll('.gc-statRow');
      statRows.forEach(function(row){
        var lab = row.querySelector('.gc-statLabel');
        var val = row.querySelector('.gc-statValue');
        if (!lab || !val) return;
        var label = String(lab.textContent || '').trim().toLowerCase();
        if (label === 'best round'){
          var br = bestRoundFor(winnerIndex);
          val.textContent = roundLabel(br.index) + ' / ' + br.score;
        } else if (label === 'average'){
          val.textContent = averageFor(winnerIndex).toFixed(1);
        }
      });
    }

    if (deciderBtn && !deciderResolved) return;

    var actionsEl = modal.querySelector('.gc-actions');
    var contentEl = modal.querySelector('.gc-arcade-content');
    var visualEl = modal.querySelector('.gc-arcade-visual');
    var confettiEl = modal.querySelector('.gc-arcade-confetti');
    var xpHost = modal.querySelector('.gc-xp-reveal');
    var nextBtn = modal.querySelector('.gc-next-match:not([data-action])');
    var nextWrap = nextBtn && nextBtn.closest('.gc-arcade-actions');
    if (!actionsEl || !contentEl || !nextBtn || !nextWrap) return;

    var originalRewards = nextBtn.onclick;
    var scorecard = buildScorecard(max);
    nextWrap.parentNode.insertBefore(scorecard, nextWrap);

    var screen = 1;
    nextBtn.onclick = function(){
      if (screen === 1){
        screen = 2;
        contentEl.style.display = 'none';
        if (visualEl) visualEl.style.display = 'none';
        if (confettiEl) confettiEl.style.display = 'none';
        if (xpHost) xpHost.style.display = 'none';
        scorecard.style.display = 'block';
        nextBtn.textContent = 'NEXT ▶';
        try { modal.scrollTop = 0; } catch(_) {}
        return;
      }
      if (screen === 2){
        screen = 3;
        scorecard.style.display = 'none';
        if (typeof originalRewards === 'function') originalRewards.call(nextBtn);
        if (advanceBtn){
          advanceBtn.textContent = isMatchComplete ? 'FINISH MATCH' : 'NEXT GAME';
        }
        try { modal.scrollTop = 0; } catch(_) {}
      }
    };

    if (advanceBtn){
      advanceBtn.textContent = isMatchComplete ? 'FINISH MATCH' : 'NEXT GAME';
    }
  }

  function install(){
    injectStyles();
    if (window.__sqSc038Installed) return;
    window.__sqSc038Installed = true;

    var tries = 0;
    (function bind(){
      tries += 1;
      var original = window.openGameCompleteDialog;
      if (typeof original !== 'function'){
        if (tries < 80) window.setTimeout(bind, 50);
        return;
      }
      if (original.__sqSc038Wrapped) return;
      function wrapped(){
        var result = original.apply(this, arguments);
        window.setTimeout(enhanceLatestComplete, 0);
        return result;
      }
      wrapped.__sqSc038Wrapped = true;
      wrapped.__sqSc038Original = original;
      window.openGameCompleteDialog = wrapped;
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
