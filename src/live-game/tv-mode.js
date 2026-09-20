/* SC-037 — provisional Landscape TV Mode.
 * Presentation-only overlay reading the existing canonical live game state.
 * No alternate scoring engine or persistent/backend state is introduced here.
 */
(function(){
  if (window.__sqTvModeInstalled) return;
  window.__sqTvModeInstalled = true;

  var active = false;
  var bodyObserver = null;

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function playerName(player, shortName){
    var p = player || {};
    var raw = '';
    try{
      raw = (typeof __sqPlayerPretty === 'function' ? __sqPlayerPretty(p) : '') ||
        p.name || p.displayName || p.nickname || p.initials || '';
    }catch(_){ raw = p.name || p.nickname || p.initials || ''; }
    raw = String(raw || '').trim();
    if (!shortName) return raw || 'PLAYER';
    var first = String(p.first_name || p.first || '').trim();
    if (first) return first;
    return (raw.split(/\s+/)[0] || raw || 'PLAYER');
  }

  function hasDart(entry){
    if (!entry) return false;
    var darts = Array.isArray(entry.darts) ? entry.darts : [];
    return darts.some(function(d){ return d !== null && d !== undefined; }) || entry.roundTotal != null;
  }

  function totalAt(playerIdx, roundIdx){
    var rows = (state && state.score && state.score[playerIdx]) || [];
    var total = 0;
    for (var r=0; r<=roundIdx && r<rows.length; r++){
      var e = rows[r];
      if (!hasDart(e)) continue;
      total += Number(e && e.roundTotal || 0);
    }
    return total;
  }

  function total(playerIdx){
    var upto = (typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS - 1 : 13);
    return totalAt(playerIdx, upto);
  }

  function gameAverage(playerIdx){
    var rows = (state && state.score && state.score[playerIdx]) || [];
    var points = 0, throws = 0;
    rows.forEach(function(e){
      if (!e) return;
      var darts = Array.isArray(e.darts) ? e.darts : [];
      var taken = darts.filter(function(d){ return d !== null && d !== undefined; }).length;
      if (!taken && e.roundTotal == null) return;
      points += Number(e.roundTotal || 0);
      throws += taken;
    });
    return throws ? (points / throws) * 3 : 0;
  }

  function matchAverage(playerIdx){
    try{
      if (typeof computeMatchAverages === 'function'){
        var rows = computeMatchAverages();
        var value = rows && rows[playerIdx] && Number(rows[playerIdx].avgRound);
        if (Number.isFinite(value)) return value;
      }
    }catch(_){}
    return gameAverage(playerIdx);
  }

  function dartLabel(dart){
    if (!dart) return '—';
    var kind = String(dart.kind || '').toUpperCase();
    var points = Number(dart.points || 0);
    if (kind === 'SCRATCH') return '—';
    if (kind === 'MISS' || points === 0) return 'MISS';
    if (kind === 'B') return 'B' + points;
    if (kind === 'D') return 'D' + Math.round(points / 2);
    if (kind === 'T') return 'T' + Math.round(points / 3);
    if (kind === 'S') return 'S' + points;
    return points ? String(points) : (kind || '—');
  }

  function roundLabel(roundIdx){
    try{ return String(labelForRound(ROUNDS[roundIdx]) || ''); }
    catch(_){ return String(roundIdx + 10); }
  }

  function skipState(playerIdx, roundIdx){
    try{
      return (typeof __sqSkippedRoundState === 'function')
        ? (__sqSkippedRoundState(playerIdx, roundIdx) || '')
        : '';
    }catch(_){ return ''; }
  }

  function ensureCss(){
    if (document.getElementById('sqTvModeCss')) return;
    var link = document.createElement('link');
    link.id = 'sqTvModeCss';
    link.rel = 'stylesheet';
    link.href = './src/styles/live-game/tv-mode.css';
    document.head.appendChild(link);
  }

  function ensureButton(){
    var row = document.getElementById('gameTopRow');
    if (!row) return null;
    var btn = document.getElementById('sqTvModeBtn');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'sqTvModeBtn';
    btn.className = 'btn letter-throw top-throw sq-tv-entry-btn';
    btn.type = 'button';
    btn.textContent = 'TV';
    btn.setAttribute('aria-label','TV Mode (Beta)');
    btn.title = 'TV Mode (Beta)';
    btn.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      window.__sqTvModeSet(true);
    });
    row.appendChild(btn);
    return btn;
  }

  function ensureOverlay(){
    var root = document.getElementById('sqTvModeOverlay');
    if (root) return root;
    root = document.createElement('section');
    root.id = 'sqTvModeOverlay';
    root.setAttribute('aria-label','TV Mode');
    document.body.appendChild(root);
    return root;
  }

  function requestFullscreen(){
    try{
      var el = document.documentElement;
      var promise = el.requestFullscreen ? el.requestFullscreen() : null;
      if (promise && typeof promise.then === 'function'){
        promise.then(function(){
          try{
            if (screen.orientation && screen.orientation.lock){
              screen.orientation.lock('landscape').catch(function(){});
            }
          }catch(_){}
        }).catch(function(){});
      }
    }catch(_){}
  }

  function render(){
    if (!active) return;
    if (!document.body || document.body.dataset.page !== 'game') return;
    if (typeof state === 'undefined' || !state || state.finished){
      window.__sqTvModeSet(false);
      return;
    }

    ensureCss();
    ensureButton();

    var root = ensureOverlay();
    var players = Array.isArray(state.players) ? state.players : [];
    var count = Math.max(1, players.length);
    var cp = Math.max(0, Math.min(count - 1, Number(state.currentPlayer || 0)));
    var maxRounds = (typeof MAX_ROUNDS === 'number' ? MAX_ROUNDS : 14);
    var cr = Math.max(0, Math.min(maxRounds - 1, Number(state.currentRound || 0)));
    var target = roundLabel(cr) || '—';
    var totals = players.map(function(_,i){ return total(i); });
    var leader = totals.length ? Math.max.apply(Math, totals) : 0;
    var targetWins = Number(state.match && state.match.targetWins || 1);

    var gameHigh = 0;
    try{
      if (typeof window.__sqDmdPbForPlayer === 'function'){
        players.forEach(function(p){
          var n = Number(window.__sqDmdPbForPlayer(p));
          if (Number.isFinite(n)) gameHigh = Math.max(gameHigh,n);
        });
      }
    }catch(_){}
    var raceMax = Math.max(100, leader, gameHigh || 0);

    var gameAvg = gameAverage(cp);
    var matchAvg = matchAverage(cp);
    var gaugeDeg = Math.max(0, Math.min(360, (gameAvg / 60) * 360));

    var visibleRows = Math.min(6,maxRounds);
    var rowStart = Math.max(0, Math.min(maxRounds - visibleRows, cr - 2));
    var rowIndexes = [];
    for(var rr=0; rr<visibleRows; rr++) rowIndexes.push(rowStart + rr);

    var playerCards = players.map(function(p,i){
      var diff = totals[i] - leader;
      var wins = Number(state.match && state.match.wins && state.match.wins[i] || 0);
      var status = i === cp ? 'TO THROW' : (totals[i] === leader && leader > 0 ? 'LEADER' : 'IN PLAY');
      return '<div class="sq-tv-player'+(i===cp?' is-active':'')+'" data-player-index="'+i+'">' +
        '<div class="sq-tv-player-name">'+esc(playerName(p,false))+'</div>' +
        '<div class="sq-tv-player-status">'+status+'</div>' +
        '<div class="sq-tv-player-score">'+String(totals[i] || 0)+'</div>' +
        '<div class="sq-tv-player-meta"><span>'+(diff===0?'LEAD':String(diff))+'</span><span>WINS '+wins+'/'+targetWins+'</span></div>' +
      '</div>';
    }).join('');

    var headerCells = players.map(function(p){
      return '<th>'+esc(playerName(p,true))+'</th>';
    }).join('');

    var tableRows = rowIndexes.map(function(ridx){
      var cells = players.map(function(_,pidx){
        var entry = state.score && state.score[pidx] && state.score[pidx][ridx];
        var touched = hasDart(entry);
        var skip = skipState(pidx,ridx);
        var main = '—', sub = '';
        if (skip === 'pending' && !touched){ main = '»»»'; }
        else if (skip === 'scratched' && !touched){ main = 'X'; }
        else if (touched){
          main = String(totalAt(pidx,ridx));
          sub = '+'+String(Number(entry && entry.roundTotal || 0));
        }
        return '<td class="'+(pidx===cp && ridx===cr?'sq-tv-cell-current':'')+'">'+
          main+(sub?'<span class="sq-tv-cell-sub">'+sub+'</span>':'')+'</td>';
      }).join('');
      return '<tr class="'+(ridx===cr?'is-current':'')+'"><td>'+esc(roundLabel(ridx))+'</td>'+cells+'</tr>';
    }).join('');

    var raceRows = players.map(function(p,i){
      var pct = Math.max(0,Math.min(100,(totals[i]/raceMax)*100));
      return '<div class="sq-tv-race-row'+(i===cp?' is-active':'')+'">' +
        '<div class="sq-tv-race-name">'+esc(playerName(p,true))+'</div>' +
        '<div class="sq-tv-race-track"><div class="sq-tv-race-fill" style="width:'+pct.toFixed(1)+'%"></div></div>' +
        '<div class="sq-tv-race-score">'+String(totals[i]||0)+'</div>' +
      '</div>';
    }).join('');

    var darts = [];
    try{
      var current = state.score && state.score[cp] && state.score[cp][cr];
      darts = Array.isArray(current && current.darts) ? current.darts.slice(0,3) : [];
    }catch(_){}
    while(darts.length<3) darts.push(null);
    var dartHtml = darts.map(function(d,idx){
      return '<span class="sq-tv-dart">D'+(idx+1)+' '+esc(dartLabel(d))+'</span>';
    }).join('');

    root.style.setProperty('--sq-tv-player-count',String(count));
    root.innerHTML =
      '<div class="sq-tv-top">' +
        '<div class="sq-tv-brand">SHATEKI <span>QUEST</span></div>' +
        '<div class="sq-tv-dmd"><div class="sq-tv-dmd-side">TARGET '+esc(target)+'</div><div class="sq-tv-dmd-main">'+esc(playerName(players[cp],false))+'</div><div class="sq-tv-dmd-side right">DART '+(Number(state.currentDart||0)+1)+' / 3</div></div>' +
        '<div class="sq-tv-actions"><span class="sq-tv-chip">TV MODE · BETA</span><button class="sq-tv-btn" id="sqTvFullBtn" type="button">FULLSCREEN</button><button class="sq-tv-btn" id="sqTvMenuBtn" type="button">MENU</button><button class="sq-tv-btn" id="sqTvExitBtn" type="button">EXIT</button></div>' +
      '</div>' +
      '<div class="sq-tv-rotate"><strong>ROTATE FOR TV MODE</strong><span>Landscape display is required for the provisional big-screen layout.</span></div>' +
      '<div class="sq-tv-players">'+playerCards+'</div>' +
      '<div class="sq-tv-main">' +
        '<div class="sq-tv-panel"><div class="sq-tv-panel-head"><span>LIVE SCOREBOARD</span><span>ROUND '+esc(target)+'</span></div><div class="sq-tv-table-wrap"><table class="sq-tv-table"><thead><tr><th>TARGET</th>'+headerCells+'</tr></thead><tbody>'+tableRows+'</tbody></table></div></div>' +
        '<div class="sq-tv-side">' +
          '<div class="sq-tv-panel sq-tv-averages"><div class="sq-tv-gauge" style="--pct:'+gaugeDeg.toFixed(1)+'deg"><div class="sq-tv-gauge-value">'+gameAvg.toFixed(1)+'<small>3-DART AVG</small></div></div><div class="sq-tv-avg-copy"><div><small>Current player</small><strong>'+esc(playerName(players[cp],true))+'</strong></div><div><small>Match avg</small><strong>'+matchAvg.toFixed(1)+'</strong></div></div></div>' +
          '<div class="sq-tv-panel"><div class="sq-tv-panel-head"><span>GAME RACE</span><span>'+count+' PLAYERS</span></div><div class="sq-tv-race"><div class="sq-tv-high"><span>GAME HIGH</span><strong>'+(gameHigh?Math.round(gameHigh):'—')+'</strong></div>'+raceRows+'</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="sq-tv-footer"><span>SCORING CONTROLS REMAIN LIVE BELOW</span><div class="sq-tv-darts">'+dartHtml+'</div></div>';

    var exit = document.getElementById('sqTvExitBtn');
    if (exit) exit.onclick = function(){ window.__sqTvModeSet(false); };

    var full = document.getElementById('sqTvFullBtn');
    if (full) full.onclick = requestFullscreen;

    var menu = document.getElementById('sqTvMenuBtn');
    if (menu) menu.onclick = function(){
      try{
        if (typeof window.__sqOpenGameMenu106 === 'function') window.__sqOpenGameMenu106();
      }catch(_){}
    };
  }

  function setActive(on){
    var next = !!on;
    if (next && (!document.body || document.body.dataset.page !== 'game')) return false;

    active = next;
    window.__sqTvModeActive = next;
    ensureCss();
    ensureButton();
    if (document.body) document.body.classList.toggle('sq-tv-mode',next);

    if (!next){
      var old = document.getElementById('sqTvModeOverlay');
      if (old) old.remove();
      return true;
    }

    render();
    return true;
  }

  function sync(){
    ensureCss();
    ensureButton();

    var onGame = !!(document.body && document.body.dataset.page === 'game');
    if (!onGame || (typeof state !== 'undefined' && state && state.finished)){
      if (active) setActive(false);
      return;
    }

    if (active) render();
  }

  window.__sqTvModeSet = setActive;
  window.__sqTvModeSync = sync;
  window.__sqTvModeRender = render;

  window.addEventListener('resize',function(){
    if (active) render();
  },{passive:true});

  window.addEventListener('orientationchange',function(){
    if (active) setTimeout(render,120);
  },{passive:true});

  document.addEventListener('keydown',function(ev){
    if (ev.key === 'Escape' && active) setActive(false);
  });

  function boot(){
    ensureCss();
    ensureButton();

    try{
      if (window.MutationObserver && document.body && !bodyObserver){
        bodyObserver = new MutationObserver(function(mutations){
          for(var i=0;i<mutations.length;i++){
            if (mutations[i].type === 'attributes' && mutations[i].attributeName === 'data-page'){
              sync();
              break;
            }
          }
        });
        bodyObserver.observe(document.body,{attributes:true,attributeFilter:['data-page']});
      }
    }catch(_){}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else setTimeout(boot,0);
})();
