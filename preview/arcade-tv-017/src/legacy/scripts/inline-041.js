
(function(){
  'use strict';
  if (window.__sqFix168ModeClassificationTurboGuard) return;
  window.__sqFix168ModeClassificationTurboGuard = true;

  function asArr(v){ return Array.isArray(v) ? v : []; }
  function low(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : null; }
  function pickState(g){
    if (!g) return {};
    if (g.state && typeof g.state === 'object') return g.state;
    if (g.raw && g.raw.state && typeof g.raw.state === 'object') return g.raw.state;
    return {};
  }
  function pickRawState(g){
    return (g && g.raw && g.raw.state && typeof g.raw.state === 'object') ? g.raw.state : {};
  }
  function playersOf(g){
    var st = pickState(g), raw = pickRawState(g);
    var ps = (g && (g.players || g.player_names)) || st.players || raw.players;
    return asArr(ps);
  }
  function boardOf(g){
    var st = pickState(g), raw = pickRawState(g);
    return (g && (g.board || g.score)) || st.board || st.score || raw.board || raw.score || [];
  }
  function rowsForPlayer(board, idx){
    if (!Array.isArray(board)) return [];
    if (Array.isArray(board[idx])) return board[idx];
    if (Array.isArray(board[0]) && board[0] && board[0][idx] != null){
      return board.map(function(r){ return Array.isArray(r) ? r[idx] : null; });
    }
    return [];
  }
  function roundHasPlayed(ent){
    if (ent == null) return false;
    if (typeof ent === 'number') return true;
    if (typeof ent === 'string') return ent.trim() !== '';
    if (Array.isArray(ent)) return ent.length > 0;
    if (typeof ent !== 'object') return false;
    var darts = Array.isArray(ent.darts) ? ent.darts : (Array.isArray(ent.throws) ? ent.throws : null);
    if (darts) return darts.some(function(d){ return d != null; });
    var scoreKeys = ['roundTotal','round_total','points','score','total','val','value'];
    for (var i=0; i<scoreKeys.length; i++){
      if (Object.prototype.hasOwnProperty.call(ent, scoreKeys[i])) {
        var n = Number(ent[scoreKeys[i]]);
        if (Number.isFinite(n) && n !== 0) return true;
      }
    }
    return Object.keys(ent).some(function(k){
      if (k === 'darts' || k === 'throws' || scoreKeys.indexOf(k) >= 0) return false;
      return ent[k] != null && ent[k] !== '';
    });
  }
  function gameLooksLikeLegacyTurboBoard(g){
    try{
      var board = boardOf(g);
      var players = playersOf(g);
      var count = Math.max(players.length || 0, Array.isArray(board) ? board.length : 0);
      if (!Array.isArray(board) || count < 1) return false;
      var earlyPlayed = false, latePlayed = false;
      for (var pi=0; pi<count; pi++){
        var rows = rowsForPlayer(board, pi);
        for (var ri=0; ri<7; ri++) if (roundHasPlayed(rows[ri])) earlyPlayed = true;
        for (var rj=7; rj<14; rj++) if (roundHasPlayed(rows[rj])) latePlayed = true;
      }
      return latePlayed && !earlyPlayed;
    }catch(_){ return false; }
  }
	  function explicitTurbo(g){
	    try{
	      var st = pickState(g), raw = pickRawState(g);
	      var isLiveState = !!(g && typeof window !== 'undefined' && (g === window.state || (typeof state !== 'undefined' && g === state)));
	      var draft = (g && g.__sqTournamentDraft) || st.__sqTournamentDraft || (isLiveState && window.__sqTournamentDraft) || {};
	      var match = (g && g.match) || st.match || raw.match || {};
      var rules = (g && g.tournamentRules) || st.tournamentRules || match.tournamentRules || draft.rules || raw.tournamentRules || {};
      var modes = [
        g && g.mode, g && g.gameMode, g && g.game_mode, g && g.type,
        st.mode, st.gameMode, st.game_mode, st.type,
        raw.mode, raw.gameMode, raw.game_mode, raw.type,
        g && g.tournamentType, g && g.tournament_type,
        st.tournamentType, st.tournament_type,
        match.tournamentType, match.tournament_type,
        raw.tournamentType, raw.tournament_type,
        draft.type
      ];
      if (modes.some(function(v){ return low(v) === 'turbo'; })) return true;
      if (st.strictTimer === true || match.strictTimer === true || rules.strictTimer === true || raw.strictTimer === true) return true;
      if (num(st.throwLimitSeconds) === 20 || num(match.throwLimitSeconds) === 20 || num(rules.throwLimitSeconds) === 20 || num(raw.throwLimitSeconds) === 20) return true;
      if (low(st.startTarget) === '17' || low(match.startTarget) === '17' || low(rules.startTarget) === '17' || low(raw.startTarget) === '17') return true;
      return false;
    }catch(_){ return false; }
  }
  function explicitPractice(g){
    try{
      var st = pickState(g), raw = pickRawState(g);
      var match = (g && g.match) || st.match || raw.match || {};
      var mode = low([g && g.mode, g && g.gameMode, g && g.game_mode, g && g.type, st.mode, st.gameMode, st.game_mode, raw.mode, raw.gameMode].filter(Boolean).join(' '));
      if (mode.indexOf('practice') >= 0 || mode.indexOf('unofficial') >= 0 || mode === 'solo' || mode === 'classic') return true;
      if ((g && (g.is_practice === true || g.isPractice === true || g.practice === true || g.single_player === true)) ||
          st.is_practice === true || st.isPractice === true || st.practice === true || st.single_player === true ||
          raw.is_practice === true || raw.isPractice === true || raw.practice === true ||
          match.forcePractice === true || low(match.mode) === 'practice') return true;
      return false;
    }catch(_){ return false; }
  }
  function isArchived(g){
    var st = pickState(g), raw = pickRawState(g);
    return !!(g && (g.archived_at || g.archivedAt || st.archived_at || st.archivedAt || raw.archived_at || raw.archivedAt));
  }
  function gameModeKey(g){
    if (!g || isArchived(g)) return 'archived';
    if (explicitTurbo(g) || gameLooksLikeLegacyTurboBoard(g)) return 'turbo';
    if (explicitPractice(g) || playersOf(g).length === 1) return 'practice';
    if (playersOf(g).length >= 2) return 'official';
    return 'unknown';
  }

  window.__sqGameLooksLikeLegacyTurboBoard = gameLooksLikeLegacyTurboBoard;
  window.__sqIsTurboRuntimeState = function(src){ return explicitTurbo(src) || gameLooksLikeLegacyTurboBoard(src); };
  window.__sqGameModeKey = gameModeKey;
  window.__sqGameIsTurbo = function(g){ return gameModeKey(g) === 'turbo'; };
  window.__sqGameBucketOf = gameModeKey;
  window.__sqIsOfficialGame = function(g){ return gameModeKey(g) === 'official'; };
  window.__sqIsPracticeGame = function(g){ return gameModeKey(g) === 'practice'; };
  window.isOfficialGame = window.__sqIsOfficialGame;
  window.isPracticeGame = window.__sqIsPracticeGame;
  try{ isOfficialGame = window.__sqIsOfficialGame; isPracticeGame = window.__sqIsPracticeGame; }catch(_){}

  async function allGames(){
    try{
      if (typeof window.__sqGetAllGamesNormalized === 'function'){
        var n = await window.__sqGetAllGamesNormalized();
        if (Array.isArray(n)) return n;
      }
    }catch(_){}
    try{
      if (typeof cloudFetchAllGamesAsLocal === 'function'){
        var c = await cloudFetchAllGamesAsLocal();
        if (Array.isArray(c)) return c;
      }
    }catch(_){}
    return [];
  }
  function parseMs(t){ var ms = Date.parse(t || ''); return Number.isFinite(ms) ? ms : 0; }

  // @MODE:CLASSIFICATION_RULES runtime owner. Official excludes Turbo before any "not practice" acceptance.
  window.getGamesForMode = async function(mode){
    var m = low(mode || 'official');
    if (m === 'classic') m = 'practice';
    if (m !== 'official' && m !== 'turbo' && m !== 'practice') m = 'official';
    var rows = await allGames();
    return rows.filter(function(g){ return gameModeKey(g) === m; }).sort(function(a,b){
      return parseMs(b && (b.ts || b.created_at || b.completed_at)) - parseMs(a && (a.ts || a.created_at || a.completed_at));
    });
  };
  try{ getGamesForMode = window.getGamesForMode; }catch(_){}

  try{ console.info('[SQ] Fix168 mode classification active: Turbo guarded out of official browser fallbacks.'); }catch(_){}
})();
