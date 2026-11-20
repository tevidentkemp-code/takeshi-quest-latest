
(function(){
  'use strict';
  if (window.__sqFix129PlayerSelectDedupe) return;
  window.__sqFix129PlayerSelectDedupe = true;

  function norm(s){ return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function displayName(p){
    if (!p) return '';
    if (typeof p === 'string') return String(p).trim();
    var n = String(p.name || p.player || p.player_name || p.display_name || '').trim();
    if (n) return n;
    var f = String(p.first_name || p.firstName || '').trim();
    var l = String(p.last_name || p.lastName || '').trim();
    return (f + (l ? ' ' + l : '')).trim();
  }
  function richness(p){
    if (!p || typeof p !== 'object') return 0;
    var score = 0;
    ['id','name','first_name','last_name','nickname','initials','created_at'].forEach(function(k){ if (p[k] != null && String(p[k]).trim()) score++; });
    return score;
  }
  function dedupePlayers(rows){
    var out = [];
    var map = new Map();
    (Array.isArray(rows) ? rows : []).forEach(function(p){
      var name = displayName(p);
      var k = norm(name);
      if (!k) return;
      var prevIdx = map.get(k);
      if (prevIdx == null){
        map.set(k, out.length);
        out.push(p);
      } else {
        // Prefer the richer cloud profile if duplicate names exist.
        if (richness(p) > richness(out[prevIdx])) out[prevIdx] = p;
      }
    });
    out.sort(function(a,b){ return displayName(a).localeCompare(displayName(b)); });
    return out;
  }
  window.__sqDedupePlayersList = dedupePlayers;

  function dedupeSelectOptions(select){
    if (!select || !select.options) return { before:0, after:0, removed:0 };
    var before = select.options.length;
    var current = select.value;
    var seen = new Set();
    Array.from(select.options).forEach(function(opt, idx){
      if (idx === 0 && !String(opt.value || '').trim()) return;
      var labelKey = norm(opt.textContent || opt.label || opt.value);
      // Visible duplicate is the bug; dedupe by rendered player label rather than id.
      var k = labelKey || norm(opt.value);
      if (!k) return;
      if (seen.has(k)) opt.remove();
      else seen.add(k);
    });
    try{ if (current && Array.from(select.options).some(function(o){ return o.value === current; })) select.value = current; }catch(_){ }
    var after = select.options.length;
    return { before:before, after:after, removed:before-after };
  }
  window.__sqDedupePlayerSelectOptions = function(){
    var selects = Array.from(document.querySelectorAll('#existingPlayerSelect,#existingPlayers,select[data-player-select],select[name*="player" i]'));
    return selects.map(function(sel){ var r = dedupeSelectOptions(sel); r.id = sel.id || sel.name || ''; return r; });
  };

  // Make cloud canonical player lists unique at source for all future consumers.
  try{
    if (typeof cloudListPlayers === 'function' && !cloudListPlayers.__sqFix129Wrapped){
      var originalCloudListPlayers = cloudListPlayers;
      cloudListPlayers = async function(){
        var rows = await originalCloudListPlayers.apply(this, arguments);
        var clean = dedupePlayers(rows);
        try{
          window.__sqPlayersList = clean;
          window.__sqActivePlayerNameSet = new Set(clean.map(function(p){ return norm(displayName(p)); }).filter(Boolean));
          window.__sqIsActivePlayerName = function(nm){ var k = norm(nm); return k ? window.__sqActivePlayerNameSet.has(k) : false; };
        }catch(_){ }
        return clean;
      };
      cloudListPlayers.__sqFix129Wrapped = true;
      try{ window.cloudListPlayers = cloudListPlayers; }catch(_){ }
    }
  }catch(e){ console.warn('[SQ] Fix129 cloudListPlayers wrap failed', e); }

  // Keep local fallback cache unique too.
  try{
    if (typeof getSavedPlayers === 'function' && !getSavedPlayers.__sqFix129Wrapped){
      var originalGetSavedPlayers = getSavedPlayers;
      getSavedPlayers = function(){ return dedupePlayers(originalGetSavedPlayers.apply(this, arguments)); };
      getSavedPlayers.__sqFix129Wrapped = true;
      try{ window.getSavedPlayers = getSavedPlayers; }catch(_){ }
    }
    if (typeof setSavedPlayers === 'function' && !setSavedPlayers.__sqFix129Wrapped){
      var originalSetSavedPlayers = setSavedPlayers;
      setSavedPlayers = function(arr){ return originalSetSavedPlayers.call(this, dedupePlayers(arr)); };
      setSavedPlayers.__sqFix129Wrapped = true;
      try{ window.setSavedPlayers = setSavedPlayers; }catch(_){ }
    }
  }catch(e){ console.warn('[SQ] Fix129 saved-player cache wrap failed', e); }

  // If older branches still populate the native select, clean it immediately after.
  try{
    if (typeof populateSavedPlayersSelects === 'function' && !populateSavedPlayersSelects.__sqFix129Wrapped){
      var originalPopulateSavedPlayersSelects = populateSavedPlayersSelects;
      populateSavedPlayersSelects = function(arr){
        var r = originalPopulateSavedPlayersSelects.call(this, dedupePlayers(arr));
        setTimeout(window.__sqDedupePlayerSelectOptions, 0);
        return r;
      };
      populateSavedPlayersSelects.__sqFix129Wrapped = true;
      try{ window.populateSavedPlayersSelects = populateSavedPlayersSelects; }catch(_){ }
    }
  }catch(e){ console.warn('[SQ] Fix129 populateSavedPlayersSelects wrap failed', e); }

  try{
    if (typeof showSelectPlayerDialog === 'function' && !showSelectPlayerDialog.__sqFix129Wrapped){
      var originalShowSelectPlayerDialog = showSelectPlayerDialog;
      showSelectPlayerDialog = async function(){
        var result = await originalShowSelectPlayerDialog.apply(this, arguments);
        [0, 40, 120].forEach(function(ms){ setTimeout(window.__sqDedupePlayerSelectOptions, ms); });
        return result;
      };
      showSelectPlayerDialog.__sqFix129Wrapped = true;
      try{ window.showSelectPlayerDialog = showSelectPlayerDialog; }catch(_){ }
    }
  }catch(e){ console.warn('[SQ] Fix129 showSelectPlayerDialog wrap failed', e); }

  // Safety net: native select menus on iOS/Safari are created from current <option>s, so keep the DOM clean.
  var guard = false;
  function scheduleDedupe(){
    if (guard) return;
    guard = true;
    setTimeout(function(){
      guard = false;
      try{ window.__sqDedupePlayerSelectOptions(); }catch(_){ }
    }, 20);
  }
  try{
    new MutationObserver(function(muts){
      for (var i=0; i<muts.length; i++){
        var t = muts[i].target;
        if (t && ((t.id === 'existingPlayerSelect') || (t.id === 'existingPlayers') || (t.closest && t.closest('#selectPlayerModal')))){
          scheduleDedupe();
          return;
        }
      }
    }).observe(document.documentElement, { childList:true, subtree:true });
  }catch(_){ }

  window.__sqPlayerSelectDedupeDebug = function(){
    var selects = Array.from(document.querySelectorAll('#existingPlayerSelect,#existingPlayers'));
    return selects.map(function(sel){
      var labels = Array.from(sel.options).map(function(o){ return o.textContent; });
      var dupes = labels.filter(function(x,i){ return x && labels.indexOf(x) !== i; });
      return { id:sel.id, count:labels.length, duplicates:Array.from(new Set(dupes)), labels:labels };
    });
  };

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(window.__sqDedupePlayerSelectOptions, 120); });
  setTimeout(window.__sqDedupePlayerSelectOptions, 250);
  try{ console.info('[SQ] Fix129 player select dedupe active'); }catch(_){ }
})();
