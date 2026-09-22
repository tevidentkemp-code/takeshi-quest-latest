
(function(){
  if (window.__sqFix160HomePowerFirstPlusNickname) return;
  window.__sqFix160HomePowerFirstPlusNickname = true;

  function escText(s){
    try { return (typeof escHtml === 'function') ? escHtml(s) : String(s == null ? '' : s); }
    catch(_) { return String(s == null ? '' : s); }
  }

  function playerDir(){
    try { if (typeof _sqPlayerDir !== 'undefined' && _sqPlayerDir) return _sqPlayerDir; } catch(_) {}
    return { byId:{}, byName:{}, list:[] };
  }

  function profileFor(raw){
    var key = String(raw == null ? '' : raw).trim();
    if (!key) return null;
    var lc = key.toLowerCase();
    var dir = playerDir();
    var p = (dir.byId && dir.byId[key]) || (dir.byName && dir.byName[lc]) || null;
    if (p) return p;

    var list = Array.isArray(dir.list) ? dir.list : [];
    var found = [];
    list.forEach(function(x){
      if (!x) return;
      var firstWord = String(x.name || '').split(/\s+/)[0];
      var vals = [x.id, x.name, x.first_name, x.last_name, x.nickname, x.initials, firstWord]
        .map(function(v){ return String(v || '').trim().toLowerCase(); })
        .filter(Boolean);
      if (vals.indexOf(lc) !== -1) found.push(x);
    });
    return found.length === 1 ? found[0] : null;
  }

  function displayName(raw){
    var p = profileFor(raw);
    if (p){
      var nick = String(p.nickname || '').trim();
      var first = String(p.first_name || '').trim();
      var name = String(p.name || '').trim();
      if (!first && name) first = name.split(/\s+/)[0] || '';

      // Home Power Rankings display rule: first name + nickname.
      // Example: Chris \"The Inevitable\".
      if (first && nick && first.toLowerCase() !== nick.toLowerCase()) return first + ' \"' + nick + '\"';
      if (first) return first;
      if (nick) return nick;
      if (name) return name;
    }
    try { if (typeof sqDisplayNameForPlayerField === 'function') return sqDisplayNameForPlayerField(raw); } catch(_) {}
    return String(raw == null ? '' : raw).trim();
  }

  async function refreshPlayers(){
    try { if (typeof cloudRefreshPlayerDirectory === 'function') await cloudRefreshPlayerDirectory(false); } catch(_) {}
  }

  async function refreshPowerFast(){
    var body = document.getElementById('homePowerLeagueRows');
    if (!body) return;
    try{
      await refreshPlayers();
      var rows = [];
      if (typeof getOfficialPowerRows === 'function') rows = await getOfficialPowerRows();
      rows = (rows || []).filter(function(r){
        return r && r.player && r.active !== false && r.qualifiesRecent !== false && r.qualifiesRounds !== false;
      }).slice(0, 5);
      if (!rows.length) return;

      var wrap = body.closest ? body.closest('.home-mini-printer') : null;
      if (wrap){
        var mid = wrap.querySelector('.lp-mid');
        if (mid) mid.classList.remove('lp-mid-hold');
        var ov = wrap.querySelector('.home-hold-overlay');
        if (ov) ov.style.display = 'none';
      }

      body.innerHTML = rows.map(function(r, i){
        var avg = Number(r.avgRound != null ? r.avgRound : (r.avg != null ? r.avg : (r.avg_per_round != null ? r.avg_per_round : 0)));
        if (!Number.isFinite(avg)) avg = 0;
        return '<tr><td class="mini-rank">' + (i + 1) + '</td><td class="mini-name">' + escText(displayName(r.player)) + '</td><td class="mini-val">' + avg.toFixed(2) + '</td></tr>';
      }).join('');
    }catch(e){
      try { console.warn('[SQ] Fix160 power fast refresh failed:', e && e.message ? e.message : e); } catch(_) {}
    }
  }

  function renderLiveImmediately(){
    // >>> PATCH:VIDE_EMPTY_FIRST_LOAD START
    // Keep START SCREEN > LIVE UPDATES VIDE empty on load.
    // The normal printer loop will then scroll/type fresh lines up from the bottom.
    // This prevents a prefilled table duplicating the first typed feed line.
    try{
      var st = window.__homeLivePrinterState;
      var body = document.getElementById('homeLivePrinterRows');
      if (st && !st.__sqVideInitialBlanked){
        st.__sqVideInitialBlanked = true;
        st.lpStarted = false;
        st.displayLines = Array.from({ length: 9 }, function(){ return ''; });
        if (body){
          body.innerHTML = '';
          for (var i=0;i<9;i++){
            body.insertAdjacentHTML('beforeend','<tr class="lp-row"><td class="lp-line"><span class="lp-ellipsis"></span></td></tr>');
          }
        }
      }
    }catch(_){ }
    return false;
    // <<< PATCH:VIDE_EMPTY_FIRST_LOAD END
  }

  function boot(){
    setTimeout(refreshPowerFast, 80);
    setTimeout(refreshPowerFast, 800);
    setTimeout(refreshPowerFast, 2000);

    var tries = 0;
    var id = setInterval(function(){
      tries += 1;
      if (renderLiveImmediately() || tries > 24) clearInterval(id);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.sqFix160RefreshHomePowerFast = refreshPowerFast;
})();
