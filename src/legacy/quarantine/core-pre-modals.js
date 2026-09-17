// [MOVED] Vertical Game Ticker module moved to @SEC:JS:LEGACY:QUARANTINE (Stage 4A ticker dedupe)

// Simple High Scores picker for start screen: Match vs Round
window.openStartHighScoresMenu = function openStartHighScoresMenu(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const modal  = document.createElement('div');
  modal.className = 'modal';

  const title  = document.createElement('h3');
  title.textContent = 'High Scores';

  const body   = document.createElement('div');
  body.className = 'modal-body';

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  // Buttons for existing High Scores views
  const matchBtn = document.createElement('button');
  matchBtn.className = 'btn';
  matchBtn.type = 'button';
  matchBtn.textContent = 'High Scores (Match)';

  const roundBtn = document.createElement('button');
  roundBtn.className = 'btn';
  roundBtn.type = 'button';
  roundBtn.textContent = 'High Scores (Round)';

  // Stack vertically with a small gap
  const row1 = document.createElement('div');
  row1.className = 'row';
  row1.style.cssText = 'justify-content:center; gap:8px; flex-wrap:wrap; margin-top:4px;';
  row1.appendChild(matchBtn);

  const row2 = document.createElement('div');
  row2.className = 'row';
  row2.style.cssText = 'justify-content:center; gap:8px; flex-wrap:wrap; margin-top:8px;';
  row2.appendChild(roundBtn);

  body.append(row1, row2);

  // Footer actions
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn sq-pill';
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => overlay.remove();
  footer.appendChild(closeBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Wire through to existing dialogs, preserving previous behaviour
  matchBtn.onclick = () => {
    overlay.remove();
    if (typeof window.openHighScoresMenuDialog === 'function') {
      window.openHighScoresMenuDialog();
    }
  };

  roundBtn.onclick = () => {
    overlay.remove();
    if (typeof window.openRoundHighScoresDialog === 'function') {
      window.openRoundHighScoresDialog();
    }
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.remove();
  });

  modal.tabIndex = 0;
  modal.focus();
};

// --- Global modal helpers (some parts of the file define modal helpers in inner scopes) ---
// Keep these on window so start-screen / global handlers can always open/close modals safely.
window.openModal = window.openModal || function(id){
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};
window.closeModal = window.closeModal || function(id){
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

// === Start screen layout arranger (non-destructive; rebuilds start-actions) ===

function arrangeStartActions(){
  try{
    const host = document.querySelector('#details .start-actions.column') || document.querySelector('.start-actions.column');
    if (host){ host.style.alignItems = 'center'; host.style.textAlign = 'center'; }
    if (!host) return;
    try{ host.style.alignItems='center'; host.style.textAlign='center'; host.style.width='100%'; }catch(_){ }
    const doc = document;

    // helpers
    const mkRow = (btn) => {
      const row = doc.createElement('div');
      row.className = 'row';
      row.style.cssText = 'justify-content:center; gap:8px; flex-wrap:wrap; margin-top:8px;';
      row.appendChild(btn);
      return row;
    };
    const mkSpacer = (h) => {
      const d = doc.createElement('div');
      d.style.height = (h || 16) + 'px';
      return d;
    };
    const setSquareLabel = (btn, lines) => {
      const txt = (lines || []).join('\n');
      btn.textContent = txt;
      btn.style.whiteSpace = 'pre-line';
    };

    // ensure / find buttons
    const newBtn = document.getElementById('questBtn');
    if (newBtn) newBtn.textContent = 'NEW GAME';

    // New Home button: opens the Start Game modal
    let startGameBtn = document.getElementById('startGameBtn');
    if (!startGameBtn){
      startGameBtn = doc.createElement('button');
      startGameBtn.id = 'startGameBtn';
      startGameBtn.className = 'btn primary big';
      startGameBtn.type = 'button';
    }
    startGameBtn.innerHTML = '<span class="btnIcon">▶</span><span class="btnLabel">START GAME</span>';
    startGameBtn.onclick = () => openModal('startGameModal');

    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn) resumeBtn.textContent = 'Resume Game';

    // Latest Scores
    let latest = document.getElementById('latestScoresBtn');
    if (!latest){
      latest = doc.createElement('button');
      latest.id = 'latestScoresBtn';
      latest.className = 'btn';
      latest.type = 'button';
      latest.textContent = 'Latest Scores';
    }

    // League / Rankings -> footer square
    let league = document.getElementById('leagueRankingsBtn');
    if (!league){
      league = doc.createElement('button');
      league.id = 'leagueRankingsBtn';
      league.className = 'btn';
      league.type = 'button';
    }

    // Player Stats -> footer square
    let stats = document.getElementById('playerStatsBtn');
    if (!stats){
      stats = doc.createElement('button');
      stats.id = 'playerStatsBtn';
      stats.className = 'btn';
      stats.type = 'button';
    }

    // Admin
    let admin = document.getElementById('adminBtn') ||
                document.getElementById('adminCodeBtn') ||
                Array.from(document.querySelectorAll('#details button, button'))
                  .find(b => /admin code|^admin$/i.test((b.textContent || b.innerText || '').trim()));
    if (!admin){
      admin = doc.createElement('button');
      admin.id = 'adminBtn';
      admin.className = 'btn small';
      admin.type = 'button';
      admin.textContent = 'Admin';
    } else {
      admin.textContent = 'Admin';
    }
    // wire handlers (idempotent, safe if functions missing)
    if (typeof window.openLatestScoresDialog === 'function') latest.onclick = window.openLatestScoresDialog;
    if (typeof window.openLeagueRankingsDialog === 'function') league.onclick = window.openLeagueRankingsDialog;

    // STATS opens the Player Stats hub directly; player changes happen in the hub header.
    if (typeof window.openPlayerStatsHub === 'function') {
      stats.onclick = () => (window.openPlayerStatsSelect || window.openPlayerStatsHub)();
    } else if (typeof openPlayerStatsSelectDialog === 'function') {
      stats.onclick = () => openPlayerStatsSelectDialog();
    } else if (typeof window.openPlayerStatsLookupDialog === 'function') {
      stats.onclick = window.openPlayerStatsLookupDialog;
    } else if (typeof window.openStatsHubDialog === 'function') {
      stats.onclick = window.openStatsHubDialog;
    }

    if (typeof window.openAdminPasswordModal === 'function') {
      admin.onclick = window.openAdminPasswordModal;
    } else if (typeof window.openAdminHub === 'function') {
      admin.onclick = window.openAdminHub;
    }

    // ===== START GAME MODAL OPTIONS =====
    const startGameBody = document.getElementById('startGameModalBody');
    if (startGameBody){
            const ICONS = {
        match: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='8.5' cy='7' r='3'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a3 3 0 0 1 0 5.74'/></svg>",
        tournament: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M8 21h8'/><path d='M12 17v4'/><path d='M7 4h10v3a5 5 0 0 1-10 0V4z'/><path d='M5 6h2v2a4 4 0 0 1-2-2z'/><path d='M19 6h-2v2a4 4 0 0 0 2-2z'/></svg>",
        turbo: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M13 2L4 14h7l-1 8 10-13h-7l0-7z'/></svg>",
        practice: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='8'/><circle cx='12' cy='12' r='4'/><path d='M12 2v2'/><path d='M22 12h-2'/><path d='M12 22v-2'/><path d='M2 12h2'/></svg>",
        training: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M2 12h2'/><path d='M20 12h2'/><path d='M6 9v6'/><path d='M18 9v6'/><path d='M6 12h12'/><path d='M4 10v4'/><path d='M20 10v4'/></svg>"
      };

      const makeOpt = (id, mode, title, desc, soon, enabled) => {
        let b = document.getElementById(id);
        if (!b){
          b = doc.createElement('button');
          b.id = id;
          b.type = 'button';
        }
        b.className = 'sg-opt sg-opt--' + mode + (enabled ? '' : ' disabled');
        b.disabled = false; // keep clickable for feedback
        b.setAttribute('aria-disabled', enabled ? 'false' : 'true');
        b.innerHTML =
          '<div class="sg-ico">' + (ICONS[mode] || '') + '</div>' +
          '<div class="sg-copy">' +
            '<div class="sg-opt-top">'+
              '<div class="sg-opt-title">'+ title +'</div>'+
              (soon ? '<div class="sg-opt-soon">'+ soon +'</div>' : '')+
            '</div>'+
            '<div class="sg-opt-desc">'+ desc +'</div>' +
          '</div>';
        if (!enabled){
          b.onclick = (e) => { e.preventDefault(); toast('Coming soon!'); };
        }
        return b;
      };

      // MATCH PLAY = existing NEW GAME logic.
      // Fix72: Practice submenu clears startGameBody, removing original questBtn.
      // Recreate/bind it here so Back from Practice always restores MATCH PLAY.
      const oldMatchPlay = document.getElementById("questBtn");
      if (oldMatchPlay && oldMatchPlay.parentNode) {
        try{ oldMatchPlay.parentNode.removeChild(oldMatchPlay); }catch(_){}
      }
      let matchPlay = doc.createElement("button");
      matchPlay.id = "questBtn";
      matchPlay.type = "button";
      matchPlay.className = "sg-opt sg-opt--match";
      matchPlay.disabled = false;
      matchPlay.setAttribute("aria-disabled","false");
      matchPlay.innerHTML =
        '<div class="sg-ico">' + (ICONS.match || '') + '</div>' +
        '<div class="sg-copy">' +
          '<div class="sg-opt-top">'+
            '<div class="sg-opt-title">MATCH PLAY</div>'+
          '</div>'+
          '<div class="sg-opt-desc">GAMES BETWEEN 2 AND 6 PEOPLE</div>' +
        '</div>';
      const openMatchVariantMenu = () => {
        startGameBody.innerHTML = '';

        const intro = doc.createElement('div');
        intro.className = 'sg-practice-intro';
        intro.innerHTML = '<div class="sg-practice-title">MATCH PLAY</div><div class="sg-practice-sub">Choose Classic or Turbo.</div>';

        const classic = makeOpt('matchClassicBtn', 'match', 'CLASSIC', 'STANDARD MATCH PLAY GAME', '', true);
        classic.onclick = (e)=>{
          e.preventDefault();
          window.__sqSelectedMode = 'match';
          window.__sqSelectedMatchVariant = 'classic';
          if (typeof __msResetSetupForMode === "function") __msResetSetupForMode("match");
          closeModal("startGameModal");
          show("players");
        };

        const turbo = makeOpt('matchTurboBtn', 'turbo', 'TURBO', 'STARTS AT 17S WITH STRICT 20 SECOND TURNS', '', true);
        turbo.onclick = (e)=>{
          e.preventDefault();
          window.__sqSelectedMode = 'match';
          window.__sqSelectedMatchVariant = 'turbo';
          if (typeof __msResetSetupForMode === "function") __msResetSetupForMode("match");
          closeModal("startGameModal");
          show("players");
        };

        const footer = doc.createElement('div');
        footer.className = 'modal-footer sg-practice-footer';
        const back = doc.createElement('button');
        back.type = 'button';
        back.className = 'btn ms2-back';
        back.innerHTML = '<span class="ms2-back-ar" aria-hidden="true">&#8592;</span><span class="ms2-back-txt">BACK</span>';
        back.onclick = (e)=>{
          e.preventDefault();
          arrangeStartActions();
        };
        footer.append(back);

        startGameBody.append(intro, classic, turbo, footer);
      };

      matchPlay.onclick = (e)=>{
        e.preventDefault();
        openMatchVariantMenu();
      };

      const openPracticeTypeMenu = () => {
        startGameBody.innerHTML = '';

        const intro = doc.createElement('div');
        intro.className = 'sg-practice-intro';
        intro.innerHTML = '<div class="sg-practice-title">PRACTICE MODE</div><div class="sg-practice-sub">Choose how you want to train.</div>';

        const classic = makeOpt('practiceClassicBtn', 'practice', 'CLASSIC', 'STANDARD SOLO PRACTICE GAME', '', true);
        classic.onclick = (e)=>{
          e.preventDefault();
          window.__sqPracticeGameType = 'classic';
          if (typeof __msResetSetupForMode === 'function') __msResetSetupForMode('practice');
          else window.__sqSelectedMode = 'practice';
          closeModal('startGameModal');
          show('players');
        };

        const vsAi = makeOpt('practiceVsAiBtn', 'practice', 'VS AI', 'COMING SOON - AI OPPONENT ENGINE NOT WIRED YET', 'COMING SOON', false);
        vsAi.onclick = (e)=>{
          e.preventDefault();
          toast('VS AI coming soon - needs the AI opponent engine first.');
        };

        const vsShadow = makeOpt('practiceVsShadowBtn', 'practice', 'VS SHADOW', 'PICK A PLAYER AND A HIGH SCORE TO BATTLE AGAINST', '', true);
        vsShadow.onclick = (e)=>{
          e.preventDefault();
          window.__sqPracticeGameType = 'vsShadow';
          if (typeof __msResetSetupForMode === 'function') __msResetSetupForMode('practice');
          else window.__sqSelectedMode = 'practice';
          closeModal('startGameModal');
          show('players');
        };

        const footer = doc.createElement('div');
        footer.className = 'modal-footer sg-practice-footer';
        const back = doc.createElement('button');
        back.type = 'button';
        back.className = 'btn ms2-back';
        back.innerHTML = '<span class="ms2-back-ar" aria-hidden="true">&#8592;</span><span class="ms2-back-txt">BACK</span>';
        back.onclick = (e)=>{
          e.preventDefault();
          arrangeStartActions();
        };
        footer.append(back);

        startGameBody.append(intro, classic, vsAi, vsShadow, footer);
      };

      const tournament = makeOpt('tournamentBtn', 'tournament', 'TOURNAMENT (BETA)', 'CLASSIC / TURBO KNOCKOUT', 'LIVE', true);
      // >>> PATCH:START_TOURNAMENT_ROUTE_RESTORE_V1 START
      // arrangeStartActions() rebuilds this button after the later tournament patches bind it.
      // Re-bind to the canonical stepped tournament setup here so TOURNAMENT does not fall
      // through to an unrelated/old modal route such as Power Rankings.
      tournament.onclick = function(e){
        if (e){
          e.preventDefault && e.preventDefault();
          e.stopPropagation && e.stopPropagation();
          e.stopImmediatePropagation && e.stopImmediatePropagation();
        }
        if (typeof window.__sqOpenTournamentSteppedSetup === 'function') return window.__sqOpenTournamentSteppedSetup();
        if (typeof openTournamentSteppedSetup === 'function') return openTournamentSteppedSetup();
        try { if (typeof toast === 'function') toast('Tournament setup is still loading. Try again in a moment.'); } catch(_) {}
        return false;
      };
      // <<< PATCH:START_TOURNAMENT_ROUTE_RESTORE_V1 END
      const practice  = makeOpt('practiceBtn', 'practice', 'PRACTICE', 'CLASSIC / VS AI / VS SHADOW', '', true);
      practice.onclick = (e)=>{
        e.preventDefault();
        openPracticeTypeMenu();
      };
      const training  = makeOpt('trainingBtn', 'training', 'TRAINING', 'HONE AND PRACTICE SPECIFIC SKILLS', 'COMING SOON', false);

      startGameBody.innerHTML = '';
      if (matchPlay) startGameBody.appendChild(matchPlay);
      startGameBody.appendChild(tournament);
      startGameBody.appendChild(practice);
      startGameBody.appendChild(training);
    }
// Close button in modal
    const closeStart = document.getElementById('closeStartGameModalBtn');
    // Back = one screen back: always the home screen (the only screen before
    // SELECT GAME MODE), even if the modal was reopened from the match card.
    if (closeStart) closeStart.onclick = () => { closeModal('startGameModal'); try{ show('details'); }catch(_){} };

    // Backdrop + Esc close (bind once)
    const startGameModal = document.getElementById('startGameModal');
    if (startGameModal && !startGameModal.dataset.bound){
      startGameModal.dataset.bound = '1';
      startGameModal.addEventListener('click', (e)=>{
        if (e.target === startGameModal) closeModal('startGameModal');
      });
      document.addEventListener('keydown', (e)=>{
        if (e.key === 'Escape' && !startGameModal.classList.contains('hidden')) closeModal('startGameModal');
      });
    }

    // Close modal when choosing an option (without overwriting existing handlers)
    if (newBtn && !newBtn.dataset.sgClose){
      newBtn.dataset.sgClose = '1';
      newBtn.addEventListener('click', () => closeModal('startGameModal'));
    }
// ===== HOME MAIN COLUMN =====
    // START GAME > (big)
    // Resume Game (big)
    // GAP
    // Latest Scores
    const frag = doc.createDocumentFragment();
    const hasSaved = (typeof getSavedState === 'function' && !!getSavedState());

    if (startGameBtn) frag.appendChild(startGameBtn);

    if (resumeBtn) {
      resumeBtn.innerHTML = '<span class="btnIcon">↺</span><span class="btnLabel">RESUME GAME</span>';
      resumeBtn.classList.add('secondary');
      resumeBtn.style.display = hasSaved ? '' : 'none';
      if (hasSaved) frag.appendChild(resumeBtn);
    }

    // Latest Scores moved into League & Rankings
    // ===== HOME LIVE PRINTER =====
    let printer = document.getElementById('homeLivePrinter');
    if (!printer){
      printer = doc.createElement('div');
      printer.id = 'homeLivePrinter';
      printer.className = 'home-live-printer';
      printer.innerHTML = ''+
        '<div class="lp-top">'+
          '<span id="homeLpTopLine" class="lp-title">LIVE UPDATES</span>'+
        '</div>'+
        '<div class="lp-mid lp-mid-hold">'+
          '<div class="home-hold-overlay" aria-hidden="true">'+
            '<div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div>'+
          '</div>'+
          '<table class="lp-table" aria-label="Latest games">'+
            '<tbody id="homeLivePrinterRows"></tbody>'+
          '</table>'+
        '</div>';
    }
    try {
      const liveTopRule = printer.querySelector('.lp-top + .lp-rule');
      if (liveTopRule) liveTopRule.remove();
      printer.querySelectorAll('.lp-bottom').forEach(n => {
        const prev = n.previousElementSibling;
        n.remove();
        if (prev && prev.classList && prev.classList.contains('lp-rule')) prev.remove();
      });
    } catch(_e) {}
    frag.appendChild(printer);

    // (removed) NEW PLAYERS ticker in VIDE

    // POWER RANKINGS mini panel removed from the home screen; drop any
    // instance an older layout pass may have left behind.
    try { document.getElementById('homeMiniLeagues')?.remove(); } catch(_e) {}

    host.innerHTML = '';
    host.appendChild(frag);

// >>> PATCH:home-mini-leagues-live START
async function __sqRefreshHomeMiniLeagues(){
  try{
    if (typeof ensureCloudInit === 'function') await ensureCloudInit();
  }catch(_e){}
  const sb = window.sb;
  if (!sb) return;

  // High Score League (Top 5)
  try{
    const tbody = document.getElementById('homeHsLeagueRows');
    if (tbody && (typeof cloudIsTableMissing !== 'function' || !cloudIsTableMissing('high_score_league_official'))){
      const { data, error } = await sb
        .from('high_score_league_official')
        .select('player,best_score,best_ts')
        .order('best_score', { ascending:false })
        .limit(5);
      if (error) throw error;

      // Remove "unavailable" UI chrome if present
      const card = tbody.closest('.home-mini-printer');
      if (card){
        card.querySelectorAll('.lp-badge').forEach(n=>n.remove());
        card.querySelectorAll('.home-hold-overlay').forEach(n=>n.remove());
        const mid = card.querySelector('.lp-mid');
        if (mid) mid.classList.remove('lp-mid-hold');
      }

      if (!data || !data.length){
        tbody.innerHTML = `<tr><td colspan="3" class="home-mini-muted"><em>No data yet</em></td></tr>`;
      }else{
        tbody.innerHTML = data.map((r,i)=>{
          const name = (r.player||'').trim();
          const score = Number(r.best_score||0);
          return `<tr>
            <td class="mini-rank">${i+1}</td>
            <td class="mini-name">${(window.escapeHtml? window.escapeHtml(name): name)}</td>
            <td class="mini-val">${score}</td>
          </tr>`;
        }).join('');
      }
    }
  }catch(e){
    // silent: start screen still usable
  }

  // Power Rankings (Top 5, Current)
  try{
    const tbody = document.getElementById('homePowerLeagueRows');
    if (tbody){
      const card = tbody.closest('.home-mini-printer');
      if (card){
        card.querySelectorAll('.lp-badge').forEach(n=>n.remove());
        card.querySelectorAll('.home-hold-overlay').forEach(n=>n.remove());
        const mid = card.querySelector('.lp-mid');
        if (mid) mid.classList.remove('lp-mid-hold');
      }

      const rows = (typeof getOfficialPowerRows === 'function') ? (await getOfficialPowerRows()) : [];
      // @MODE:HOME_POWER_RANKINGS_ACTIVE_ONLY
      // VIDE/start-screen mini Power Rankings should show current active players only.
      // Full League & Rankings popup can still show inactive players greyed at the bottom.
      const activeRows = (rows || []).filter(r => r && r.player && r.active !== false && r.qualifiesRecent !== false && r.qualifiesRounds !== false);
      const prRows = activeRows.slice(0,5);

      if (!prRows.length){
        tbody.innerHTML = `<tr><td colspan="3" class="home-mini-muted"><em>No data yet</em></td></tr>`;
      }else{
        tbody.innerHTML = prRows.map((r,i)=>{
          const name = (r.player||'').trim();
          const avg = Number(r.avgRound ?? r.powerRank ?? r.avg_per_round ?? 0).toFixed(2);
          return `<tr>
            <td class="mini-rank">${i+1}</td>
            <td class="mini-name">${(window.escapeHtml? window.escapeHtml(name): name)}</td>
            <td class="mini-val">${avg}</td>
          </tr>`;
        }).join('');
      }
    }
  }catch(e){
    // silent
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  // Give cloud init a beat, then refresh.
  setTimeout(__sqRefreshHomeMiniLeagues, 250);
});
// >>> PATCH:home-mini-leagues-live END

    // Push footer buttons (Player Hub / Stats / League / Admin) to the bottom of the screen
    try{
      const details = document.getElementById('details');
      const sr = document.querySelector('.start-secondary-row');
      if (details && sr){
        details.style.display = 'flex';
        details.style.flexDirection = 'column';
        details.style.minHeight = '100vh';
        let sp = document.getElementById('homeFlexSpacer');
        if (!sp){
          sp = doc.createElement('div');
          sp.id = 'homeFlexSpacer';
          sp.style.flex = '1';
          details.insertBefore(sp, sr);
        }
      }
    }catch(_e){}

    

async function updateHomeMiniLeagues(){
  await cloudRefreshPlayerDirectory(false);
  const hsBody = document.getElementById('homeHsLeagueRows');
  const prBody = document.getElementById('homePowerLeagueRows');
  if(!hsBody && !prBody) return;

  const esc = (typeof escHtml === 'function') ? escHtml : (s)=>String(s||'');
  const setMsg = (body, msg)=>{ if(body) body.innerHTML = `<tr class="mini-loading"><td colspan="3" class="home-mini-muted"><em>${esc(msg)}</em></td></tr>`; };

  if(hsBody) setMsg(hsBody,'Loading…');
  if(prBody) setMsg(prBody,'Loading…');

  try{
    // High Score League (best match score per player name)
if(hsBody){
  const unhold = (body)=>{
    try{
      const wrap = body?.closest?.('.home-mini-printer');
      if(!wrap) return;
      const mid = wrap.querySelector('.lp-mid');
      if(mid) mid.classList.remove('lp-mid-hold');
      const ov = wrap.querySelector('.home-hold-overlay');
      if(ov) ov.style.display = 'none';
      const badge = wrap.querySelector('.lp-badge');
      if(badge) badge.style.display = 'none';
    }catch(_e){}
  };

  let rows = [];
  try{
    rows = (typeof cloudListHighScores === 'function') ? (await cloudListHighScoresWithBackfill(false, 500)) : [];
  }catch(e){
    rows = [];
  }

  // If the query executed (even if empty), this panel is no longer "testing".
  unhold(hsBody);

  // >>> PATCH:HOME_HSLEAGUE_FILTER_ORPHANS START
  // Filter out orphan HS rows on the home panel too (deleted game left HS rows).
  try{
    if (typeof ensureCloudInit === 'function' && ensureCloudInit()){
      const gTable = (typeof TABLE_GAMES !== 'undefined' ? TABLE_GAMES : 'games');
      const { data: gData } = await sb
        .from(gTable)
        // NOTE: games table columns are (match_id, game_number, created_at, state, stats, finished, totals, id)
        // Selecting non-existent columns causes PostgREST 400 and breaks the home screen.
        .select('id, created_at, state, totals')
        .order('created_at', { ascending: false })
        .limit(5000);
      const games = gData || [];
      const scoreIndex = new Map();
      (games || []).forEach(g=>{
        const rawPlayers = g?.players ?? (g?.state && g.state.players) ?? [];
        const players = (rawPlayers || []).map(p => (p && p.name) ? p.name : String(p || ''));
        const totals  = Array.isArray(g?.totals) ? g.totals : (Array.isArray(g?.state?.totals) ? g.state.totals : []);
        players.forEach((nm,i)=>{
          const nameLC = String(nm||'').trim().toLowerCase();
          if(!nameLC) return;
          const sc = Number(totals?.[i] ?? 0);
          if(!Number.isFinite(sc)) return;
          let set = scoreIndex.get(nameLC);
          if(!set){ set = new Set(); scoreIndex.set(nameLC,set); }
          set.add(sc);
        });
      });
      // Only filter (do NOT auto-delete). We never want client-side cleanup to mutate cloud data.
      rows = (rows||[]).filter(r=>{
        const nameLC = String(r.name||'').trim().toLowerCase();
        const sc = Number(r.score||0);
        const set = scoreIndex.get(nameLC);
        return !!(set && set.has(sc));
      });
    }
  }catch(_e){}
  // <<< PATCH:HOME_HSLEAGUE_FILTER_ORPHANS END

  const best = new Map(); // key: name lower
  for(const r of (rows || [])){
    if(!r) continue;
    const name = String(r.name || r.player || r.player_name || '—').trim() || '—';
    const key  = name.toLowerCase();
    const score = Number(r.score);
    if(!Number.isFinite(score)) continue;
    const ts = r.ts || r.created_at || r.event_ts || '';
    const prev = best.get(key);
    if(!prev || score > prev.score || (score === prev.score && String(ts) > String(prev.ts))){
      best.set(key, { name, score, ts });
    }
  }

  const list = Array.from(best.values())
    .sort((a,b)=> (b.score - a.score) || String(a.name).localeCompare(String(b.name)) );

  try{ const st = window.__homeLivePrinterState; if(st && list.length) st.globalMaxScore = Number(list[0].score)||0; }catch(_e){}

  const top = list.slice(0,5);
  if(!top.length){
    setMsg(hsBody,'No data');
  }else{
    hsBody.innerHTML = top.map((x,i)=>
      `<tr><td class="mini-rank">${i+1}</td><td class="mini-name">${esc(sqDisplayNameForPlayerField(x.name))}</td><td class="mini-val">${x.score}</td></tr>`
    ).join('');
  }
}

// Power Rankings (official; last 56 rounds; >=28 rounds (2 games); active in last 14 days)
    if(prBody){
      const unhold = (body)=>{
        try{
          const wrap = body?.closest?.('.home-mini-printer');
          if(!wrap) return;
          const mid = wrap.querySelector('.lp-mid');
          if(mid) mid.classList.remove('lp-mid-hold');
          const ov = wrap.querySelector('.home-hold-overlay');
          if(ov) ov.style.display = 'none';
          const badge = wrap.querySelector('.lp-badge');
          if(badge) badge.style.display = 'none';
        }catch(_e){}
      };

      let rows = [];
      try{ rows = (typeof getOfficialPowerRows === 'function') ? (await getOfficialPowerRows()) : []; }catch(e){ rows = []; }

      // If the query executed (even if empty), this panel is no longer "testing".
      unhold(prBody);

      // @MODE:HOME_POWER_RANKINGS_ACTIVE_ONLY
      // VIDE/start-screen mini Power Rankings should show current active players only.
      // Full League & Rankings popup can still show inactive players greyed at the bottom.
      const list = (rows || []).filter(r => r && r.player && r.active !== false && r.qualifiesRecent !== false && r.qualifiesRounds !== false);
      const top = list.slice(0,5);

      if(!top.length){
        setMsg(prBody,'No data');
      }else{
        prBody.innerHTML = top.map((r,i)=>{
          const avg = Number(r.powerRank ?? r.avgRound ?? r.avg_per_round ?? r.avg ?? 0);
          return `<tr><td class="mini-rank">${i+1}</td><td class="mini-name">${esc(sqDisplayNameForPlayerField(r.player))}</td><td class="mini-val">${(Number.isFinite(avg) ? avg : 0).toFixed(2)}</td></tr>`;
        }).join('');
      }
    }
  }catch(e){
    if(hsBody) setMsg(hsBody,'Unavailable');
    if(prBody) setMsg(prBody,'Unavailable');
  }
}

// Kick mini leagues once on home render
    try{ updateHomeMiniLeagues && updateHomeMiniLeagues(); }catch(_e){}

    // Live-printer updater (bind once)
    try{
      if (!window.__homeLivePrinterState){
        window.__homeLivePrinterState = {
          dots: 0,
          lastSig: null,
          tick: 0,
          lastSyncMs: 0,
          syncing: false,
          forceFullEvery: 6, // every N syncs, hard refresh rows
          syncCount: 0
        };
      }
      const lpSig = (g) => {
        if (!g) return '';
        const ts = String(g.event_ts ?? g.ts ?? g.created_at ?? g.createdAt ?? '');
        const id = String(g.event_id ?? g.match_id ?? g.game_id ?? '');
        if (id && ts) return `${ts}::${id}`;
        if (id) return id;
        if (ts) return ts;
        return '';
      };

      const LP_BUFFER = 30;
      const LP_VISIBLE = 15;
      const LP_SYNC_MS = Math.max(15000, (typeof SQ_GAMES_VISIBLE_MIN_POLL_MS !== 'undefined' ? SQ_GAMES_VISIBLE_MIN_POLL_MS : 15000));
      // Cloud availability helper (avoid ReferenceError on older builds)
      const lpCloudOK = () => {
        try {
          if (typeof ensureCloudInit === 'function') return !!ensureCloudInit();
          return !!window.sb;
        } catch(_e) { return !!window.sb; }
      };

      // >>> PATCH:VIDE_TURBO_SUFFIX_SOURCE_FIX START
      // Live Updates VIDE uses normalized fallback rows, so Turbo can be lost if we only inspect
      // the final rendered line. Detect Turbo from the original game/state before formatting.
      const lpIsTurboGame = (g) => {
        try{
          if (!g) return false;
          if (typeof window.__sqGameModeKey === 'function' && window.__sqGameModeKey(g) === 'turbo') return true;
          if (typeof window.__sqGameIsTurbo === 'function' && window.__sqGameIsTurbo(g)) return true;
          const st = g.state || g.game_state || {};
          const match = g.match || st.match || {};
          const rules = g.rules || st.rules || match.rules || match.tournamentRules || {};
          const vals = [
            g.mode, g.gameMode, g.game_mode, g.type, g.tournamentType,
            st.mode, st.gameMode, st.game_mode, st.type, st.tournamentType,
            match.mode, match.gameMode, match.game_mode, match.type, match.tournamentType,
            rules.mode, rules.gameMode, rules.game_mode, rules.type, rules.tournamentType
          ].map(v => String(v || '').toLowerCase());
          if (vals.some(v => v === 'turbo' || v.indexOf('turbo') >= 0)) return true;
          if (g.strictTimer === true || st.strictTimer === true || match.strictTimer === true || rules.strictTimer === true) return true;
          if (Number(g.throwLimitSeconds || st.throwLimitSeconds || match.throwLimitSeconds || rules.throwLimitSeconds || 0) === 20) return true;
          if (String(g.startTarget || st.startTarget || match.startTarget || rules.startTarget || '') === '17') return true;
        }catch(_e){}
        return false;
      };
      // >>> PATCH:VIDE_CLASSIC_SUFFIX_AND_FIRST_BLANK_V1 START
      const lpModeSuffix = (g) => {
        if (g && (g.isPractice || g.is_practice || g.practice)) return ' - PRACTICE';
        if (lpIsTurboGame(g) || (g && g.isTurbo)) return ' - TURBO';
        return ' - CLASSIC';
      };
      const lpAppendModeSuffix = (line, g) => {
        let out = String(line || '').trim();
        const suffix = lpModeSuffix(g);
        if (!suffix) return out;
        if (/\s-\s(PRACTICE|TURBO|CLASSIC)\s*$/i.test(out)) return out;
        return out + suffix;
      };
      // <<< PATCH:VIDE_CLASSIC_SUFFIX_AND_FIRST_BLANK_V1 END
      // <<< PATCH:VIDE_TURBO_SUFFIX_SOURCE_FIX END

      const lpPad2 = (n) => String(Number(n) || 0).padStart(2, '0');
      const lpFmtDT = (g) => {
        const ts = g.event_ts || g.ts || g.created_at || g.createdAt;
        const d = ts ? new Date(ts) : null;
        if (!d || isNaN(d.getTime())) return '--/-- / --:--';
        return `${lpPad2(d.getDate())}/${lpPad2(d.getMonth()+1)} / ${lpPad2(d.getHours())}:${lpPad2(d.getMinutes())}`;
      };
      const lpNormalizeBull = (s) => String(s || '')
        .replace(/\bSB(\d+)\b/g, 'OB$1')
        .replace(/\bDB(\d+)\b/g, 'IB$1')
        .replace(/\bB(\d+)\b/g, 'OB$1')
        .trim();

      const lpFmtRoundPB = (rest) => {
        // Expected source examples:
        // "ROUND PB / 18s — James (90) — S2 / D0 / T1"
        // "ROUND PB / T - James (84) - S0 / D0 / T2"
        // "ROUND PB / D - James (68) - S0 / D2 / T0"
        // "ROUND PB / B - James (75) - S0 / D0 / T0 / OB1 / IB1"
        const r = String(rest || '').replace(/\s*_\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
        const m = r.match(/ROUND\s*PB\s*\/\s*((?:\d+\s*s?)|[TDB])\s*[–—-]\s*([^()–—-]+?)\s*\((\d+)\)\s*[–—-]\s*(.+)$/i);
        if (!m) return null;

        let roundKey = String(m[1] || '').trim().toUpperCase();
        const name = String(m[2] || '').trim();
        const score = m[3];
        const countsRaw = String(m[4] || '').trim();

        if (/^\d+$/.test(roundKey)) roundKey = `${roundKey}s`;
        roundKey = roundKey.replace(/\s+/g, '');

        const rawParts = lpNormalizeBull(countsRaw)
          .split(/\s*\/\s*/)
          .map(x => x.trim().toUpperCase())
          .filter(Boolean);

        let counts = rawParts.join(' / ');

        if (/^\d+s$/i.test(roundKey)) {
          const target = Number(String(roundKey).replace(/\D+/g, '')) || 0;
          counts = rawParts.map(x => {
            const token = String(x || '').trim().toUpperCase();
            if (!token || token === 'X' || token === 'MISS' || token === 'M') return 'X';
            if (token === 'IB' || token === 'OB' || token === 'B' || token === 'SB' || token === 'DB') return 'B';
            if (token === 'S' || /^S\d+$/.test(token) || /SINGLE/.test(token)) return 'S';
            if (token === 'D' || /^D\d+$/.test(token) || /DOUBLE/.test(token)) return 'D';
            if (token === 'T' || /^T\d+$/.test(token) || /TREB(?:LE)?/.test(token) || /TRIPLE/.test(token)) return 'T';
            const n = Number(token);
            if (Number.isFinite(n) && target > 0) {
              if (n === target) return 'S';
              if (n === target * 2) return 'D';
              if (n === target * 3) return 'T';
              if (n === 25 || n === 50) return 'B';
              if (n === 0) return 'X';
            }
            return 'X';
          }).join(' / ');
        } else if (/^T$/i.test(roundKey)) {
          counts = rawParts.map(x => (x === 'X' ? 'X' : (/^T\d+$/.test(x) ? x : 'X'))).join(' / ');
        } else if (/^D$/i.test(roundKey)) {
          counts = rawParts.map(x => (x === 'X' ? 'X' : (/^D\d+$/.test(x) ? x : 'X'))).join(' / ');
        } else if (/^B$/i.test(roundKey)) {
          counts = rawParts.map(x => ((x === 'X' || x === 'IB' || x === 'OB') ? x : 'X')).join(' / ');
        }

        return (`ROUND PB / ${name} - ${roundKey} (${score}) ${counts}`.trim()).trim();
      };

      const lpMaybeGameRecord = (rest) => {
        // If a GAME PB equals the current league-high score, treat it as a game record.
        try{
          const st = window.__homeLivePrinterState;
          const max = Number(st && st.globalMaxScore);
          if (!Number.isFinite(max) || max <= 0) return null;

          const r = String(rest || '').replace(/\s{2,}/g,' ').trim();
          if (!/^GAME\s*PB\b/i.test(r)) return null;

          const m = r.match(/^GAME\s*PB\s*(?:[\/\-–—]|—|–|-)+\s*([^()]+?)\s*\((\d+)\)/i);
          if (!m) return null;

          const name = String(m[1] || '').trim();
          const score = Number(m[2]);
          if (!Number.isFinite(score)) return null;

          if (score === max) {
            return `NEW GAME RECORD SCORE - ${name} - ${score} 🥇`;
          }
        }catch(_e){}
        return null;
      };

      const lpIsBeerScore = (score) => {
        const n = Number(score);
        return Number.isFinite(n) && n < 100;
      };
      const lpPlayerScoreText = (name, score) => `${String(name || '?').trim() || '?'} (${score ?? '?'})`;
      const lpUnder100Names = (rows) => {
        return (Array.isArray(rows) ? rows : [])
          .filter(r => r && String(r.name || '').trim() && String(r.name || '').trim() !== '?' && lpIsBeerScore(r.score))
          .map(r => String(r.name || '').trim());
      };
      const lpBuildBeerAlertLine = (names) => {
        const list = (Array.isArray(names) ? names : []).map(n => String(n || '').trim()).filter(Boolean);
        if (!list.length) return '';
        const quoted = list.map(n => `"${n}"`).join(', ');
        return `( ALERT ) ${quoted} ${list.length === 1 ? 'scores' : 'score'} under 100 - GET THE BEERS IN!`;
      };
      const lpIsClassicOfficialGame = (g) => {
        if (!g || g.event_kind) return false;
        const practice = !!(g.isPractice || g.is_practice || g.practice ||
          String(g.mode || g.gameMode || '').toLowerCase() === 'practice' ||
          String(g.state?.mode || g.state?.gameMode || '').toLowerCase() === 'practice' ||
          g.state?.is_practice === true || g.state?.isPractice === true);
        if (practice) return false;
        if (g.isTurbo || lpIsTurboGame(g)) return false;
        return true;
      };
      const lpBeerAlertLineForGame = (g) => {
        if (!lpIsClassicOfficialGame(g)) return '';
        const players = Array.isArray(g.beer_alert_players) ? g.beer_alert_players : [];
        if (players.length) return lpBuildBeerAlertLine(players);
        const ps = Array.isArray(g.players) ? g.players : [];
        const totals = Array.isArray(g.totals) ? g.totals : [];
        if (!ps.length || !totals.length) return '';
        const rows = ps.map((p,i) => ({
          name: (p && p.name) ? String(p.name).trim() : (typeof p === 'string' ? p.trim() : '?'),
          score: Number(totals[i])
        })).filter(r => Number.isFinite(r.score))
          .sort((a,b) => (b.score - a.score) || String(a.name).localeCompare(String(b.name)));
        return lpBuildBeerAlertLine(lpUnder100Names(rows));
      };

      const lpFmtLine = (g) => {
        // Prefer server-provided line_text, but normalize formatting for UI.
        const raw = String((g && g.line_text) ? g.line_text : '').trim() || null;

        const buildFallback = () => {
          const dt = lpFmtDT(g);
          const winnerName = g.winner_name || '?';
          const winnerScore = (g.winner_score ?? '?');
          const opp = g.opponents_text || '';
          const isPractice = !!(g && (g.isPractice || g.is_practice || g.practice ||
            String(g.mode || g.gameMode || '').toLowerCase() === 'practice' ||
            String(g.state?.mode || g.state?.gameMode || '').toLowerCase() === 'practice' ||
            g.state?.is_practice === true || g.state?.isPractice === true));
          const base = `${dt} ${lpPlayerScoreText(winnerName, winnerScore)}${opp ? ' bts ' + opp : ''}`;
          return base + (isPractice ? ' - PRACTICE' : (lpIsTurboGame(g) ? ' - TURBO' : ' - CLASSIC'));
        };

        const src = raw || buildFallback();
        if (raw && (/^\(\s*(CLA|TBO)\s+RESULT\s*\)\s*\/\s*/i.test(src) || /^(CLA|TBO)\s+RESULT\s*\/\s*/i.test(src))) return src.replace(/\s+/g, ' ').trim();

        // Expect legacy format: "DD/MM _ HH:MM _ rest"
        const m = src.match(/^(\d{2}\/\d{2})\s*[_\-–—]\s*(\d{2}:\d{2})\s*[_\-–—]\s*(.+)$/);
        if (m) {
          const ddmm = m[1];
          const hhmm = m[2];
          let rest = String(m[3] || '').trim();

          // Normalize separators
          rest = rest.replace(/\s*_\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

                    // ALERT (under 100 etc) should not show date/time.
          const isUnder100 = (/under\s*100/i.test(rest) || /^ALERT\b/i.test(rest));
          if (isUnder100) {
            // Ensure it starts with ALERT, then prefix 🚨
            if (!/^ALERT\b/i.test(rest)) rest = `ALERT - ${rest}`;
            rest = rest.replace(/^ALERT\s*[-–—]\s*/i, 'ALERT - ');
            return (`🚨 ${rest}`.trim());
          }

          // ROUND WR (highest round ever) should be highlighted.
          if (/\bROUND\s*(WR|WORLD\s*RECORD|RECORD)\b/i.test(rest)) {
            rest = rest.replace(/^\s*🚨\s*/,'');
            return (`🚨 ${rest}`.trim());
          }

// PB/WR lines should not show date/time, and need custom formatting.
          if (/(^|\b)(NEW\s*PB|ROUND\s*PB|PB|WR|WORLD\s*RECORD)\b/i.test(rest)) {
            // "NEW PB" -> "GAME PB"
            rest = rest.replace(/\bNEW\s*PB\b/i, 'GAME PB');

            const rec = lpMaybeGameRecord(rest);
            if (rec) return (`🚨 ${rec}`.replace(/^🚨\s*🚨\s*/,'🚨 ').trim());

            // Round PB reformat
            const roundPB = lpFmtRoundPB(rest);
            if (roundPB) return (`🚨 ${roundPB}`.trim());

            if (/^GAME PB\b/i.test(rest)) return (`🚨 ${rest}`.trim());

            // World record / WR etc: just return line without timestamp
            return (`🚨 ${rest}`.replace(/^🚨\s*🚨\s*/,'🚨 ').trim());
          }

          // Normal match line: "DD/MM / HH:MM ..."
          return lpAppendModeSuffix(`${ddmm} / ${hhmm} ${rest}`, g);
        }

        // If it contains underscores but not the full pattern, clean them.
        let cleaned = src.replace(/\s*_\s*/g, ' ').replace(/\s{2,}/g,' ').trim();

        // PB/WR lines: strip any leading timestamp if present and normalize wording
        // ALERT (under 100 etc): strip timestamp and prefix 🚨
        if (/under\s*100/i.test(cleaned) || /^ALERT\b/i.test(cleaned)) {
          cleaned = cleaned.replace(/^\d{2}\/\d{2}\s*\/\s*\d{2}:\d{2}\s*/,'').trim() || cleaned;
          if (!/^ALERT\b/i.test(cleaned)) cleaned = `ALERT - ${cleaned}`;
          cleaned = cleaned.replace(/^ALERT\s*[-–—]\s*/i, 'ALERT - ');
          return (`🚨 ${cleaned}`.trim());
        }

        // ROUND WR: highlight
        if (/\bROUND\s*(WR|WORLD\s*RECORD|RECORD)\b/i.test(cleaned)) {
          cleaned = cleaned.replace(/^\d{2}\/\d{2}\s*\/\s*\d{2}:\d{2}\s*/,'').trim() || cleaned;
          return (`🚨 ${cleaned.replace(/^\s*🚨\s*/,'')}`.trim());
        }

        if (/(^|\b)(NEW\s*PB|ROUND\s*PB|PB|WR|WORLD\s*RECORD)\b/i.test(cleaned)) {
          cleaned = cleaned.replace(/^\d{2}\/\d{2}\s*\/\s*\d{2}:\d{2}\s*/,'').trim() || cleaned;
          cleaned = cleaned.replace(/\bNEW\s*PB\b/i, 'GAME PB');
          const rec = lpMaybeGameRecord(cleaned);
          if (rec) return (`🚨 ${rec}`.replace(/^🚨\s*🚨\s*/,'🚨 ').trim());
          const roundPB = lpFmtRoundPB(cleaned);
          if (roundPB) return (`🚨 ${roundPB}`.trim());
          if (/^GAME PB\b/i.test(cleaned)) return (`🚨 ${cleaned}`.trim());
          return cleaned;
        }

	        return lpAppendModeSuffix(cleaned, g);
	      };

	      const lpModeDisplayFromLine = (line) => {
	        let text = String(line == null ? '' : line).replace(/\s+/g, ' ').trim();
	        if (!text) return { mode: '', abbr: '', core: '' };
	        const pref = text.match(/^(CLA|TBO|PRA)\s*\/\s*/i);
	        if (pref) {
	          const abbr = pref[1].toUpperCase();
	          const mode = abbr === 'PRA' ? 'practice' : (abbr === 'TBO' ? 'turbo' : 'classic');
	          return { mode, abbr, core: text.slice(pref[0].length).trim() };
	        }
	        const m = text.match(/\s-\s(CLASSIC|TURBO|PRACTICE)\s*$/i);
	        if (!m) return { mode: '', abbr: '', core: text };
	        const rawMode = String(m[1] || '').toLowerCase();
	        const mode = rawMode === 'practice' ? 'practice' : (rawMode === 'turbo' ? 'turbo' : 'classic');
	        const abbr = mode === 'practice' ? 'PRA' : (mode === 'turbo' ? 'TBO' : 'CLA');
	        return { mode, abbr, core: text.slice(0, m.index).trim() };
	      };

	      const lpParseResultLine = (line) => {
	        const info = lpModeDisplayFromLine(line);
	        if (!info.mode || !info.core) return null;
	        const m = info.core.match(/^(\d{2}:\d{2})\s+(.+)$/);
	        if (!m) return null;
	        return {
	          mode: info.mode,
	          abbr: info.abbr,
	          time: m[1],
	          scoreline: String(m[2] || '').trim()
	        };
	      };

	      const lpParseMatchResultLine = (line) => {
	        const text = String(line == null ? '' : line).replace(/\s+/g, ' ').trim();
	        const m = text.match(/^\(\s*(CLA|TBO)\s+RESULT\s*\)\s*\/\s*(.+)$/i) ||
	          text.match(/^(CLA|TBO)\s+RESULT\s*\/\s*(.+)$/i);
	        if (!m) return null;
	        const abbr = m[1].toUpperCase();
	        const rawParts = String(m[2] || '').split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
	        const placements = rawParts.map(part => {
	          let pm = part.match(/^(.+?)\s*\((Gold|SILV|BRNZ|SILVER|BRONZE)\)$/i);
	          if (pm) {
	            const medalRaw = pm[2].toUpperCase();
	            const medal = medalRaw === 'SILV' || medalRaw === 'SILVER' ? 'silver' : (medalRaw === 'BRNZ' || medalRaw === 'BRONZE' ? 'bronze' : 'gold');
	            const label = medal === 'silver' ? 'SILV' : (medal === 'bronze' ? 'BRNZ' : 'Gold');
	            return { medal, label, name: String(pm[1] || '').trim() };
	          }
	          pm = part.match(/^(GOLD|SILVER|BRONZE)\s+(.+)$/i);
	          if (!pm) return null;
	          const medal = pm[1].toLowerCase();
	          const label = medal === 'silver' ? 'SILV' : (medal === 'bronze' ? 'BRNZ' : 'Gold');
	          return { medal, label, name: String(pm[2] || '').trim() };
	        }).filter(x => x && x.name);
	        if (!placements.length) return null;
	        return { abbr, label: `( ${abbr} RESULT )`, placements };
	      };

	      const lpParseBeerAlertLine = (line) => {
	        const text = String(line == null ? '' : line).replace(/\s+/g, ' ').trim();
	        const m = text.match(/^\(\s*ALERT\s*\)\s*(.+)$/i);
	        if (!m) return null;
	        return { label: '( ALERT )', copy: String(m[1] || '').trim(), original: text };
	      };

	      const lpParseRecordLine = (line) => {
	        const original = String(line == null ? '' : line).replace(/\s+/g, ' ').trim();
	        if (!original) return null;
	        const text = original.replace(/^🚨\s*/, '').trim();
	        const specs = [
	          { label: 'NEW GAME RECORD SCORE', re: /^NEW\s+GAME\s+RECORD\s+SCORE\b/i },
	          { label: 'ROUND WR', re: /^ROUND\s+WR\b/i },
	          { label: 'ROUND PB', re: /^ROUND\s+PB\b/i },
	          { label: 'GAME PB', re: /^GAME\s+PB\b/i },
	          { label: 'WR', re: /^(?:WR|WORLD\s+RECORD)\b/i }
	        ];
	        const spec = specs.find(x => x.re.test(text));
	        if (!spec) return null;
	        const hit = text.match(spec.re);
	        const rest = text.slice(hit ? hit[0].length : 0)
	          .replace(/^\s*(?:\/|[-–—])\s*/, '')
	          .trim();
	        return { label: spec.label, value: rest, original };
	      };

	      const lpDisplayText = (line) => {
	        const parsed = lpParseResultLine(line);
	        if (parsed) return `${parsed.abbr} / ${parsed.time} ${parsed.scoreline}`.trim();
	        const match = lpParseMatchResultLine(line);
	        if (match) {
	          const parts = match.placements.map(p => `${p.medal.toUpperCase()} ${p.name}`);
	          return `${match.label} / ${parts.join(', ')}`;
	        }
	        const alert = lpParseBeerAlertLine(line);
	        if (alert) return `${alert.label} ${alert.copy}`.trim();
	        return String(line == null ? '' : line);
	      };

	      const lpAppendTextSpan = (parent, className, text) => {
	        const span = document.createElement('span');
	        span.className = className;
	        span.textContent = String(text == null ? '' : text);
	        parent.appendChild(span);
	        return span;
	      };

	      const lpSetLineContent = (el, line) => {
	        if (!el) return;
	        const parsed = lpParseResultLine(line);
	        const match = parsed ? null : lpParseMatchResultLine(line);
	        const alert = (!parsed && !match) ? lpParseBeerAlertLine(line) : null;
	        const record = (!parsed && !match && !alert) ? lpParseRecordLine(line) : null;
	        el.textContent = '';
	        try{ el.removeAttribute('aria-label'); }catch(_e){}
	        el.classList.toggle('lp-structured', !!(parsed || match || alert || record));
	        el.classList.toggle('lp-matchline', !!match);
	        el.classList.toggle('lp-alertline', !!alert);
	        el.classList.toggle('lp-recordline', !!record);
	        if (match) {
	          el.setAttribute('aria-label', lpDisplayText(line));
	          lpAppendTextSpan(el, 'lp-result-chip', match.label);
	          lpAppendTextSpan(el, 'lp-mode-sep', '/');
	          const wrap = lpAppendTextSpan(el, 'lp-medal-list', '');
	          match.placements.forEach((p, idx) => {
	            if (idx) wrap.appendChild(document.createTextNode(', '));
	            lpAppendTextSpan(wrap, 'lp-medal-name', p.name);
	            wrap.appendChild(document.createTextNode(' '));
	            lpAppendTextSpan(wrap, `lp-medal-chip lp-medal-${p.medal}`, p.label || p.medal.toUpperCase());
	          });
	          return;
	        }
	        if (alert) {
	          el.setAttribute('aria-label', alert.original);
	          lpAppendTextSpan(el, 'lp-alert-chip', alert.label);
	          lpAppendTextSpan(el, 'lp-alert-copy', alert.copy);
	          return;
	        }
	        if (record) {
	          el.setAttribute('aria-label', record.original);
	          lpAppendTextSpan(el, 'lp-record-chip', record.label);
	          if (record.value) lpAppendTextSpan(el, 'lp-record-value', record.value);
	          return;
	        }
	        if (!parsed) {
	          el.textContent = lpDisplayText(line);
	          return;
	        }
	        el.setAttribute('aria-label', lpDisplayText(line));
	        lpAppendTextSpan(el, 'lp-mode', parsed.abbr);
	        lpAppendTextSpan(el, 'lp-mode-sep', '/');
	        lpAppendTextSpan(el, 'lp-time', parsed.time);
	        const result = lpAppendTextSpan(el, 'lp-result', '');
	        lpAppendTextSpan(result, 'lp-scoreline', parsed.scoreline);
	      };

	const lpUpdateMeta = async (games) => {

        // VIDE: hide HIGH SCORES meta row
        return;
        const st = window.__homeLivePrinterState;
        if (!st) return;
        const hsEl = document.getElementById('homeLpHS');
        // High Scores Top 3 (League)
        try {
          const now = Date.now();
          if (!st.hsFetchedAt || (now - st.hsFetchedAt) > 30000) {
            if (typeof cloudListHighScores === 'function') {
              const top3 = await cloudListHighScoresWithBackfill(false, 3);
              st.hsTop3 = (top3 || []).slice(0, 3);
              st.hsFetchedAt = now;
            }
          }
          if (hsEl) {
            const t = Array.isArray(st.hsTop3) ? st.hsTop3 : [];
            if (t.length) {
              const parts = t.map((r, i)=>`#${i+1} ${r.name} (${Number(r.score)||0})`);
              hsEl.textContent = parts.join('  |  ');
            } else {
              hsEl.textContent = '—';
            }
          }
        } catch (_) {
          if (hsEl) hsEl.textContent = '—';
        }
      };
	      const lpType = (el, text, speedMs = 28, onDone = null) => {
	        if (!el) return;
	        try{ el.classList.remove('lp-structured', 'lp-matchline', 'lp-alertline', 'lp-recordline'); el.removeAttribute('aria-label'); }catch(_e){}
	        el.textContent = '';
	        let i = 0;
	        const t = String(text || '');
	        const max = Math.min(t.length, 240);
	        if (!max) {
	          if (typeof onDone === 'function') requestAnimationFrame(onDone);
	          return;
	        }
	        const timer = setInterval(()=>{
	          i++;
	          el.textContent = t.slice(0, i);
	          if (i >= max) {
	            clearInterval(timer);
	            if (typeof onDone === 'function') setTimeout(onDone, Math.max(0, speedMs));
	          }
	        }, speedMs);
	      };

      const lpStripBang = (s) => String(s || '').replace(/^🚨\s*/,'').trim();
      const lpIsRecordLine = (line) => /^NEW GAME RECORD SCORE\b/i.test(lpStripBang(line));
      const lpIsRoundPBLine = (line) => /^ROUND PB\b/i.test(lpStripBang(line));
      const lpIsGamePBLine  = (line) => /^GAME PB\b/i.test(lpStripBang(line));
      const lpIsMatchResultLine = (line) => /^\(\s*(CLA|TBO)\s+RESULT\s*\)\s*\/\s*/i.test(String(line || '').replace(/\s+/g,' ').trim()) ||
        /^(CLA|TBO)\s+RESULT\s*\/\s*/i.test(String(line || '').replace(/\s+/g,' ').trim());
      const lpIsBeerAlertLine = (line) => /^\(\s*ALERT\s*\)\s*/i.test(String(line || '').replace(/\s+/g,' ').trim());
      const lpIsAlertLine   = (line) => /^🚨\s*/.test(String(line || '').trim());

	      const lpIsDateHdrLine = (line) => {
	        const s = String(line||'').trim();
	        return /^[A-Z]{3}\s+\d{1,2}\s+[A-Z]{3}\s+\d{4}$/.test(s) ||
	          /^[A-Z]+\s+\d{1,2}(?:st|nd|rd|th)\s+[A-Z]{3}\s+\d{2}\s+>>>\s*$/.test(s);
	      };

      const lpCollapseRoundPBOverflow = (inputLines) => {
        const linesIn = Array.isArray(inputLines) ? inputLines : [];
        const out = [];
        let group = [];
        const playerFromRoundPB = (line) => {
          const s = lpStripBang(line);
          const m = s.match(/^ROUND\s*PB\s*\/\s*([^–—-]+?)\s*[–—-]\s*/i);
          return m ? String(m[1] || '').trim() : '';
        };
        const flush = () => {
          if (!group.length) return;
          if (group.length <= 2) { out.push(...group.map(x => x.line)); }
          else {
            out.push(group[0].line, group[1].line);
            out.push(`+ ${group.length - 2} more PBs.`);
          }
          group = [];
        };
        linesIn.forEach(line => {
          const txt = String(line ?? '');
          const player = playerFromRoundPB(txt);
          if (!player) { flush(); out.push(txt); return; }
          if (!group.length || group[0].player.toLowerCase() === player.toLowerCase()) group.push({ player, line: txt });
          else { flush(); group.push({ player, line: txt }); }
        });
        flush();
        return out;
      };

      const lpApplyRowClasses = (tr, line) => {
        if (!tr) return;
        const isRecord = lpIsRecordLine(line);
        const isRoundPB = !isRecord && lpIsRoundPBLine(line);
	        const isGamePB = !isRecord && lpIsGamePBLine(line);
	        const isMatchResult = lpIsMatchResultLine(line);
	        const isBeerAlert = lpIsBeerAlertLine(line);
	        const isAlert = lpIsAlertLine(line);
	        const isDateHdr = lpIsDateHdrLine(line);
	        const modeInfo = (!isAlert && !isDateHdr) ? lpModeDisplayFromLine(line) : { mode: '' };
	        tr.classList.toggle('lp-record', isRecord);
	        tr.classList.toggle('lp-roundpb', isRoundPB);
	        tr.classList.toggle('lp-gamepb', isGamePB);
	        tr.classList.toggle('lp-match-result', isMatchResult);
	        tr.classList.toggle('lp-alert-row', isBeerAlert);
	        tr.classList.toggle('lp-alert', isAlert);
	        tr.classList.toggle('lp-datehdr', isDateHdr);
	        tr.classList.toggle('lp-practice', modeInfo.mode === 'practice');
	        tr.classList.toggle('lp-turbo', modeInfo.mode === 'turbo');
	        tr.classList.toggle('lp-classic', modeInfo.mode === 'classic');
	        const td = tr.querySelector('.lp-line');
	        const sp = tr.querySelector('.lp-ellipsis');
	        try{
	          if (td) {
	            td.style.color = '';
	            td.style.fontWeight = '';
	          }
	          if (sp) {
	            sp.style.color = '';
	            sp.style.fontWeight = '';
	          }
	        }catch(_e){}
	      };

      const lpRoundKey = (roundIndex) => {
        const r = Number(roundIndex);
        if (r >= 0 && r <= 10) return `${10 + r}s`;
        if (r === 11) return 'D';
        if (r === 12) return 'T';
        if (r === 13) return 'B';
        return String(r);
      };

      const lpExtractDarts = (cell) => {
        if (!cell) return [];
        if (Array.isArray(cell)) return cell;
        if (Array.isArray(cell.darts)) return cell.darts;
        if (Array.isArray(cell.throws)) return cell.throws;
        return [];
      };

      const lpCountSummary = (cell, roundIndex) => {
        const darts = lpExtractDarts(cell);
        const ri = Number(roundIndex);
        const target = (ri >= 0 && ri <= 10) ? (10 + ri) : 0;

        const tokenForDart = (d) => {
          if (!d) return 'X';

          const rawKind  = String(d.kind || d.type || d.segment || d.ring || '').trim().toUpperCase();
          const rawLabel = String(d.label || d.code || d.target || d.token || '').trim().toUpperCase();
          const pts = Number(d.points ?? d.pts ?? d.score ?? 0);
          const sector = Number(d.sector ?? d.value ?? d.number ?? d.hit ?? d.n ?? 0);

          if (rawKind === 'MISS' || rawLabel === 'MISS' || pts === 0) return 'X';

          if (rawKind === 'B' || rawKind === 'BULL' || rawLabel === 'BULL' || rawLabel === 'SB' || rawLabel === 'DB' || rawLabel === 'OB' || rawLabel === 'IB') {
            if (pts >= 50 || rawLabel === 'DB' || rawLabel === 'IB') return 'IB';
            if (pts >= 25 || rawLabel === 'SB' || rawLabel === 'OB') return 'OB';
            return 'X';
          }

          if (ri >= 0 && ri <= 10) {
            if (rawKind === 'S' || rawKind === 'SINGLE') return 'S';
            if (rawKind === 'D' || rawKind === 'DOUBLE') return 'D';
            if (rawKind === 'T' || rawKind === 'TREBLE' || rawKind === 'TRIPLE') return 'T';

            if (sector > 0 && target > 0) {
              if (sector === target) return 'S';
              return 'X';
            }
            if (Number.isFinite(pts) && target > 0) {
              if (pts === target) return 'S';
              if (pts === target * 2) return 'D';
              if (pts === target * 3) return 'T';
              if (pts === 25 || pts === 50) return 'B';
            }
            return 'X';
          }

          if (rawKind === 'D' || rawKind === 'DOUBLE') {
            if (sector > 0) return `D${sector}`;
            if (Number.isFinite(pts) && pts > 0 && pts % 2 === 0) return `D${pts / 2}`;
            return 'X';
          }
          if (rawKind === 'T' || rawKind === 'TREBLE' || rawKind === 'TRIPLE') {
            if (sector > 0) return `T${sector}`;
            if (Number.isFinite(pts) && pts > 0 && pts % 3 === 0) return `T${pts / 3}`;
            return 'X';
          }

          if (sector > 0) {
            if (ri === 11) return pts > 0 ? `D${sector}` : 'X';
            if (ri === 12) return pts > 0 ? `T${sector}` : 'X';
            return `S${sector}`;
          }

          if (ri === 11 && Number.isFinite(pts) && pts > 0 && pts % 2 === 0) return `D${pts / 2}`;
          if (ri === 12 && Number.isFinite(pts) && pts > 0 && pts % 3 === 0) return `T${pts / 3}`;

          return 'X';
        };

        const parts = darts.map(tokenForDart).filter(Boolean);

        while (parts.length < 3) parts.push('X');

        return parts.slice(0, 3).join(' / ');
      };

      const lpRoundTotal = (cell) => {
        if (!cell) return 0;
        const direct = Number(cell.roundTotal ?? cell.total ?? cell.score ?? NaN);
        if (Number.isFinite(direct)) return direct;
        return lpExtractDarts(cell).reduce((sum, d) => sum + Number(d && (d.points ?? d.pts ?? d.score) || 0), 0);
      };

      const lpFetchRelevantMatchRows = async (games) => {
        const list = Array.isArray(games) ? games : [];
        const ids = Array.from(new Set(list.map(g => String(g && (g.match_id || g.matchId || g.state?.match_id || g.state?.matchId) || '').trim()).filter(Boolean))).slice(0, 20);
        const st = window.__homeLivePrinterState || {};
        const key = ids.slice().sort().join('|');
        const now = Date.now();
        let rows = [];
        if (key && st.matchRowsCache && st.matchRowsCache.key === key && st.matchRowsCache.at && (now - st.matchRowsCache.at) < 60000) {
          rows = Array.isArray(st.matchRowsCache.rows) ? st.matchRowsCache.rows.slice() : [];
        } else if (key && lpCloudOK() && window.sb) {
          const table = (typeof TABLE_MATCHES !== 'undefined' && TABLE_MATCHES) ? TABLE_MATCHES : 'matches';
          try {
            let res = await window.sb
              .from(table)
              .select('id,created_at,players,wins,history,total_games,targetWins,target_wins')
              .in('id', ids);
            if (res && res.error) {
              res = await window.sb
                .from(table)
                .select('id,created_at,players,wins,history,total_games')
                .in('id', ids);
            }
            rows = (res && !res.error && Array.isArray(res.data)) ? res.data.slice() : [];
          } catch(_e) {
            rows = [];
          }
          st.matchRowsCache = { key, at: now, rows: rows.slice() };
        }
        try {
          const localMatches = (typeof getMatchLog === 'function') ? (getMatchLog() || []) : [];
          (Array.isArray(localMatches) ? localMatches : []).forEach(m => {
            const id = String(m && m.id || '').trim();
            if (id && ids.includes(id)) rows.push(m);
          });
        } catch(_e) {}
        try {
          const current = (typeof state !== 'undefined' && state && state.match) ? state.match : null;
          const id = String(current && current.id || '').trim();
          if (id && ids.includes(id)) rows.push(current);
        } catch(_e) {}
        return rows;
      };

      const lpBuildCompletedMatchResultItems = (games, matchRows) => {
        const list = Array.isArray(games) ? games : [];
        const groups = new Map();
        const metaById = new Map();
        const diag = {
          checked_at: new Date().toISOString(),
          visible_game_rows: list.length,
          match_rows_seen: Array.isArray(matchRows) ? matchRows.length : 0,
          visible_match_ids: [],
          rendered: 0,
          skipped: [],
          read_scope: 'visible-match-ids-only'
        };
        const publishDiag = () => {
          try { window.__homeLivePrinterMatchDiag = diag; } catch(_e) {}
        };
        const skip = (matchId, reason, extra) => {
          try {
            diag.skipped.push(Object.assign({ match_id: matchId || '', reason: reason || 'unknown' }, extra || {}));
          } catch(_e) {}
        };
        const nameOf = (p) => {
          if (!p) return '';
          if (typeof p === 'string') return p.trim();
          return String(p.name || p.nickname || p.first_name || p.player_name || p.id || '').trim();
        };
        const absorbMeta = (m) => {
          if (!m) return;
          const id = String(m.id || m.match_id || m.matchId || '').trim();
          if (!id) return;
          const prev = metaById.get(id) || {};
          const next = Object.assign({}, prev, m);
          if (!next.targetWins && !next.target_wins && (prev.targetWins || prev.target_wins)) next.targetWins = prev.targetWins || prev.target_wins;
          if ((!Array.isArray(next.history) || !next.history.length) && Array.isArray(prev.history)) next.history = prev.history;
          if ((!Array.isArray(next.wins) || !next.wins.length) && Array.isArray(prev.wins)) next.wins = prev.wins;
          if ((!Array.isArray(next.players) || !next.players.length) && Array.isArray(prev.players)) next.players = prev.players;
          metaById.set(id, next);
        };
        (Array.isArray(matchRows) ? matchRows : []).forEach(absorbMeta);
        list.forEach(g => {
          if (!g) return;
          if (g.isPractice || g.is_practice || g.practice) return;
          const id = String(g.match_id || g.matchId || g.state?.match_id || g.state?.matchId || '').trim();
          if (!id) return;
          if (!groups.has(id)) groups.set(id, []);
          groups.get(id).push(g);
          const m = g.match_state || g.state?.match || g.match || null;
          if (m) absorbMeta(Object.assign({ id }, m));
        });
        const out = [];
        diag.visible_match_ids = Array.from(groups.keys());
        groups.forEach((group, matchId) => {
          try{
            const meta = metaById.get(matchId) || {};
            const wins = Array.isArray(meta.wins) ? meta.wins.map(v => Number(v) || 0) : [];
            const history = Array.isArray(meta.history) ? meta.history : [];
            const targetWins = Number(meta.targetWins || meta.target_wins || 0);
            const maxWins = wins.length ? Math.max.apply(null, wins) : 0;
            if (!targetWins) {
              skip(matchId, 'missing_target_wins', {
                wins_count: wins.length,
                max_wins: maxWins,
                history_length: history.length,
                total_games: Number(meta.total_games || meta.totalGames || 0) || null
              });
              return;
            }
            if (maxWins < targetWins) {
              skip(matchId, 'match_incomplete', { target_wins: targetWins, max_wins: maxWins });
              return;
            }
            if (!history.length) {
              skip(matchId, 'missing_history', { target_wins: targetWins, max_wins: maxWins });
              return;
            }
            if (history.length < maxWins) {
              skip(matchId, 'history_shorter_than_wins', { history_length: history.length, max_wins: maxWins });
              return;
            }
            const playersRaw = Array.isArray(meta.players) && meta.players.length ? meta.players : (Array.isArray(group[0]?.players) ? group[0].players : []);
            const names = playersRaw.map(nameOf);
            if (names.filter(Boolean).length < 2) {
              skip(matchId, 'missing_players', { players_count: names.filter(Boolean).length });
              return;
            }
            const matchTotals = Array.from({ length: names.length }, (_, idx) => {
              if (Array.isArray(meta.matchTotals) && Number.isFinite(Number(meta.matchTotals[idx]))) return Number(meta.matchTotals[idx]);
              return history.reduce((sum, h) => sum + Number((h && Array.isArray(h.totals)) ? (h.totals[idx] || 0) : 0), 0);
            });
            const order = names.map((name, idx) => ({ name: name || '?', idx, wins: wins[idx] || 0, total: matchTotals[idx] || 0 }))
              .sort((a,b) => (b.wins - a.wins) || (b.total - a.total) || String(a.name).localeCompare(String(b.name)));
            if (!order.length || order[0].wins < targetWins) {
              skip(matchId, 'winner_not_provable', { target_wins: targetWins, top_wins: order.length ? order[0].wins : 0 });
              return;
            }
            const medals = ['Gold', 'SILV', 'BRNZ'];
            const parts = order.slice(0, Math.min(3, order.length)).map((p, i) => `${p.name} (${medals[i]})`);
            if (!parts.length) {
              skip(matchId, 'placements_empty');
              return;
            }
            const finalTs = group.map(g => g.event_ts || g.ts || g.created_at || g.createdAt).filter(Boolean)
              .sort((a,b) => new Date(b).getTime() - new Date(a).getTime())[0] || meta.ts || meta.created_at || null;
            if (!finalTs) {
              skip(matchId, 'missing_final_timestamp');
              return;
            }
            const abbr = group.some(g => lpIsTurboGame(g) || g.isTurbo) ? 'TBO' : 'CLA';
            out.push({
              event_ts: finalTs,
              ts: finalTs,
              event_id: `match_result:${matchId}`,
              match_id: matchId,
              event_kind: 'match_result',
              line_text: `( ${abbr} RESULT ) / ${parts.join(', ')}`
            });
            diag.rendered++;
          }catch(_e){
            skip(matchId, 'exception');
          }
        });
        publishDiag();
        return out;
      };

      const lpBuildDerivedPrinterItems = async () => {
        const st = window.__homeLivePrinterState || {};
        const now = Date.now();
        const derivedTtlMs = Math.max(5 * 60 * 1000, Number(window.__sqAllGamesFetchTtlMs) || 0);
        if (Array.isArray(st.derivedItems) && st.derivedItems.length && st.derivedFetchedAt && (now - st.derivedFetchedAt) < derivedTtlMs) {
          return st.derivedItems;
        }
        let events = [];
        try{
          if (typeof __fetchOfficialGames !== 'function' || typeof __normalizeGame !== 'function') {
            st.derivedItems = [];
            st.derivedFetchedAt = now;
            return [];
          }
          const allGames = (await __fetchOfficialGames(1000)).map(__normalizeGame).filter(Boolean);
          allGames.sort((a,b)=> new Date(a.ts || 0).getTime() - new Date(b.ts || 0).getTime());
          const bestGameByPlayer = new Map();
          const bestRoundByPlayer = new Map();
          const bestRoundGlobal = new Map();
          let globalGameBest = 0;
          const seen = new Set();
          const pushEvent = (ts, line_text, event_kind) => {
            const tsv = String(ts || '');
            const txt = String(line_text || '').trim();
            if (!tsv || !txt) return;
            const sig = `${tsv}::${event_kind || ''}::${txt}`;
            if (seen.has(sig)) return;
            seen.add(sig);
            events.push({ event_ts: tsv, ts: tsv, line_text: txt, event_kind: event_kind || 'derived' });
          };
          allGames.forEach(g => {
            const ts = g.ts || (g.raw && (g.raw.created_at || g.raw.ts)) || null;
            const board = Array.isArray(g.board) ? g.board : [];
            (g.players || []).forEach((name, idx) => {
              const nm = String(name || '').trim();
              if (!nm) return;
              const score = Number((g.totals || [])[idx] || 0);
              const nameKey = nm.toLowerCase();
              const priorGameBest = Number(bestGameByPlayer.get(nameKey) || 0);
              const isGamePB = score > 0 && score > priorGameBest;
              const isGameRecord = score > 0 && score > globalGameBest;
              // A record is also a PB, but only print the higher-priority record event.
              if (isGameRecord) pushEvent(ts, `NEW GAME RECORD SCORE - ${nm} - ${score} 🥇`, 'game_record');
              else if (isGamePB) pushEvent(ts, `GAME PB - ${nm} (${score})`, 'game_pb');
              if (isGamePB) bestGameByPlayer.set(nameKey, score);
              if (isGameRecord) globalGameBest = score;
              const playerRounds = Array.isArray(board[idx]) ? board[idx] : [];
              for (let r = 0; r < Math.min(14, playerRounds.length || 0); r++) {
                const cell = playerRounds[r];
                const total = Number(lpRoundTotal(cell) || 0);
                if (!Number.isFinite(total) || total <= 0) continue;
                const roundKey = lpRoundKey(r);
                const counts = lpCountSummary(cell, r);
                const playerRoundKey = `${nameKey}|${roundKey}`;
                const priorRoundPB = Number(bestRoundByPlayer.get(playerRoundKey) || 0);
                const priorRoundWR = Number(bestRoundGlobal.get(roundKey) || 0);
                const isRoundPB = total > priorRoundPB;
                const isRoundRecord = total > priorRoundWR;
                // A round record is also a PB, but only print the higher-priority record event.
                if (isRoundRecord) pushEvent(ts, `ROUND WR / ${roundKey} - ${nm} (${total}) - ${counts}`, 'round_wr');
                else if (isRoundPB) pushEvent(ts, `ROUND PB / ${roundKey} - ${nm} (${total}) - ${counts}`, 'round_pb');
                if (isRoundPB) bestRoundByPlayer.set(playerRoundKey, total);
                if (isRoundRecord) bestRoundGlobal.set(roundKey, total);
              }
            });
          });
          events.sort((a,b)=> new Date(b.event_ts || b.ts || 0).getTime() - new Date(a.event_ts || a.ts || 0).getTime());
          events = events.slice(0, 200);
        }catch(_e){
          events = [];
        }
        st.derivedItems = events;
        st.derivedFetchedAt = now;
        return events;
      };

      const lpSmoothShiftUp = (tbody, rowH, durationMs, onDone) => {
        if (!tbody) {
          if (onDone) onDone();
          return;
        }
        let doneCalled = false;
        const finish = () => {
          if (doneCalled) return;
          doneCalled = true;
          try {
            // Reset first (no transition), then update content next frame.
            tbody.style.transition = '';
            tbody.style.transform = 'translateY(0)';
            tbody.style.willChange = '';
          } catch (_) {}
          if (onDone) requestAnimationFrame(onDone);
        };
        try {
          tbody.style.willChange = 'transform';
          tbody.style.transition = `transform ${durationMs}ms ease`;
          void tbody.offsetHeight;
          tbody.style.transform = `translateY(-${rowH}px)`;
          tbody.addEventListener('transitionend', (e) => {
            if (e && e.propertyName && e.propertyName !== 'transform') return;
            finish();
          }, { once: true });
          setTimeout(finish, durationMs + 120);
        } catch (_) {
          finish();
        }
      };

      const lpEnsureRows = (lines) => {
        const tbody = document.getElementById('homeLivePrinterRows');
        if (!tbody) return;
        tbody.innerHTML = '';
        (lines || []).slice(0, LP_VISIBLE).forEach((line) => {
          const tr = document.createElement('tr');
          tr.className = 'lp-row';
	          const td = document.createElement('td');
	          td.className = 'lp-line';
	          const sp = document.createElement('span');
	          sp.className = 'lp-ellipsis';
	          lpApplyRowClasses(tr, line);
	          lpSetLineContent(sp, line);
	          td.appendChild(sp);
	          tr.appendChild(td);
	          tbody.appendChild(tr);
        });
        // pad to exactly LP_VISIBLE rows
        while (tbody.querySelectorAll('tr.lp-row').length < LP_VISIBLE) {
          const tr = document.createElement('tr');
          tr.className = 'lp-row';
          const td = document.createElement('td');
          td.className = 'lp-line';
          const sp = document.createElement('span');
          sp.className = 'lp-ellipsis';
          sp.textContent = '';
          td.appendChild(sp);
          tr.appendChild(td);
          tbody.appendChild(tr);
        }
      };

      // Allow other parts of the app to inject a one-off LIVE UPDATES line (e.g., NEW PLAYER)
      // Usage: window.__homeLivePrinterInjectLine('🚨 NEW PLAYER - Name - Welcome...')
      try{
        window.__homeLivePrinterInjectLine = (line) => {
          const st = window.__homeLivePrinterState;
          const l = String(line || '').replace(/\s+/g,' ').trim();
          if (!st || !l) return;
          // push into buffer
          st.bufLines = [l].concat(Array.isArray(st.bufLines) ? st.bufLines : []);
          st.bufLines = st.bufLines.slice(0, LP_BUFFER);
          // show immediately by shifting the visible window
          st.displayLines = Array.isArray(st.displayLines) ? st.displayLines : Array.from({ length: LP_VISIBLE }, () => '');
          st.displayLines = st.displayLines.slice(1).concat([l]);
          lpEnsureRows(st.displayLines);
        };
      }catch(_e){}

      const lpRenderWindow = (opts = {}) => {
        const st = window.__homeLivePrinterState;
        const tbody = document.getElementById('homeLivePrinterRows');
        if (!tbody || !st) return;
        const buf = Array.isArray(st.bufLines) ? st.bufLines : [];
        const start = Number(st.viewStart || 0) || 0;
        const win = buf.slice(start, start + LP_VISIBLE);
        const winDisp = win;
        const rows = Array.from(tbody.querySelectorAll('tr.lp-row'));
        if (rows.length !== LP_VISIBLE) { lpEnsureRows(win); return; }
        rows.forEach((tr, i) => {
	          const sp = tr.querySelector('.lp-ellipsis');
	          if (!sp) return;
	          const line = winDisp[i] ?? '—';
	          if (!opts.skipLastType || i < LP_VISIBLE - 1) {
	            lpApplyRowClasses(tr, line);
	            lpSetLineContent(sp, line);
	          }
	        });
	      };
      const lpScrollStep = () => {
        const st = window.__homeLivePrinterState;
        const tbody = document.getElementById('homeLivePrinterRows');
        if (!st || !tbody) return;

        const buf = Array.isArray(st.bufLines) ? st.bufLines : [];
        if (!buf.length) return;

        // Ensure display model exists
        if (!st.lpStarted || !Array.isArray(st.displayLines) || st.displayLines.length !== LP_VISIBLE) {
          st.lpStarted = true;
          st.lpCursor = (Number.isFinite(st.lpCursor) ? st.lpCursor : 0) || 0;
          st.displayLines = Array.from({ length: LP_VISIBLE }, () => '');
          lpEnsureRows(st.displayLines);
        }

        const rows = Array.from(tbody.querySelectorAll('tr.lp-row'));
        const rowH = (rows[0] ? (rows[0].getBoundingClientRect().height || 20) : 20);

        // Pull next line (circular)
        const nextIdx = st.lpCursor % buf.length;
        const nextLine = String(buf[nextIdx] ?? '').trim();
        st.lpCursor = (st.lpCursor + 1) % buf.length;
        // Pace the pause that follows this line by looking at what comes next: a
        // record/PB/alert belongs to the game printed above it, so it should land
        // almost immediately, while a fresh game result gets the fuller beat.
        try{
          const upcoming = String(buf[st.lpCursor % buf.length] ?? '').trim();
          const follower = lpIsRecordLine(upcoming) || lpIsRoundPBLine(upcoming)
                        || lpIsGamePBLine(upcoming) || lpIsAlertLine(upcoming) || lpIsBeerAlertLine(upcoming);
          st.nextHold = follower ? 0 : 2;
        }catch(_e){ st.nextHold = 2; }

        // Shift window (top drops, new line appears at bottom)
        try { st.displayLines.shift(); } catch(_e){ st.displayLines = st.displayLines.slice(1); }
        st.displayLines.push(nextLine);

        // Animate the physical shift, then repaint + type last line
        lpSmoothShiftUp(tbody, rowH, 520, () => {
          const rows2 = Array.from(tbody.querySelectorAll('tr.lp-row'));
          if (rows2.length !== LP_VISIBLE) {
            lpEnsureRows(st.displayLines);
            return;
          }

          // Reset non-last rows + text
	          for (let i = 0; i < LP_VISIBLE - 1; i++) {
	            rows2[i].classList.remove('lp-new');
	            const sp = rows2[i].querySelector('.lp-ellipsis');
	            lpApplyRowClasses(rows2[i], st.displayLines[i]);
	            if (sp) lpSetLineContent(sp, st.displayLines[i]);
	          }

          // Last row stays dark green until it moves up (next step)
          const lastRow = rows2[LP_VISIBLE - 1];
          if (!lastRow) return;
          lastRow.classList.add('lp-new');
          lpApplyRowClasses(lastRow, st.displayLines[LP_VISIBLE - 1]);
	          const lastSp = lastRow.querySelector('.lp-ellipsis');
	          if (lastSp) {
	            lastSp.textContent = '';
	            // slower typing
	            const lastLine = st.displayLines[LP_VISIBLE - 1];
	            const fast = (()=>{ try{ return lpIsRecordLine(lastLine) || lpIsRoundPBLine(lastLine)
              || lpIsGamePBLine(lastLine) || lpIsAlertLine(lastLine) || lpIsBeerAlertLine(lastLine); }catch(_e){ return false; } })();
	            lpType(lastSp, lpDisplayText(lastLine), fast ? 8 : 22, () => lpSetLineContent(lastSp, lastLine));
	          }
	        });
	      };
      const lpAnimateNewBottom = (bufLines) => {
        const tbody = document.getElementById('homeLivePrinterRows');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr.lp-row'));
        const rowH = (rows[0] ? (rows[0].getBoundingClientRect().height || 22) : 22);

        const buf = Array.isArray(bufLines) ? bufLines : [];
        const winNew = buf.slice(0, LP_VISIBLE);

        lpSmoothShiftUp(tbody, rowH, 460, () => {
          const rows2 = Array.from(tbody.querySelectorAll('tr.lp-row'));
          if (rows2.length !== LP_VISIBLE) {
            lpEnsureRows(winNew);
            return;
          }

	          for (let i = 0; i < LP_VISIBLE - 1; i++) {
	            const sp = rows2[i].querySelector('.lp-ellipsis');
	            lpApplyRowClasses(rows2[i], winNew[i]);
	            if (sp) lpSetLineContent(sp, winNew[i] ?? '—');
	            rows2[i].classList.remove('lp-new');
	          }

          const lastRow = rows2[LP_VISIBLE - 1];
          const lastSp = lastRow ? lastRow.querySelector('.lp-ellipsis') : null;
          if (lastSp) {
	            lastRow.classList.add('lp-new');
	            lpApplyRowClasses(lastRow, winNew[LP_VISIBLE - 1]);
	            lastSp.textContent = '';
	            const lastLine = winNew[LP_VISIBLE - 1] ?? '—';
	            lpType(lastSp, lpDisplayText(lastLine), 20, () => lpSetLineContent(lastSp, lastLine));
	            setTimeout(() => {
	              try { lastRow.classList.remove('lp-new'); } catch (_) {}
	            }, 900);
          }
        });
      };
      const lpSync = async (forceFull = false) => {
        const st = window.__homeLivePrinterState;
        if (!st || st.syncing) return;
        st.syncing = true;
        try {
          // >>> PATCH:disable-printer-events-v-all START
          // printer_events_v_all currently fails with access-control/500; do not let it impact UI init.
          // Use the existing fallback (recent games) without attempting this endpoint.
          let items = [];
          const DISABLE_PRINTER_EVENTS_V_ALL = true;
          // >>> PATCH:disable-printer-events-v-all END
          // 2) Fallback: recent games (existing behaviour)
          if (!items.length) {
            let games = [];
            if (lpCloudOK()) {
              try { if (typeof cloudFetchLatestVisibleGamesAsLocal === 'function') {
                  games = await cloudFetchLatestVisibleGamesAsLocal(LP_BUFFER);
                } else {
                  games = await cloudFetchLatestGamesAsLocal(LP_BUFFER);
                } } catch (_e) { games = []; }
            // Normalize game rows for live printer formatting (avoid "?(?)" when winner fields are absent)
            if (Array.isArray(games) && games.length) {
              games = games.map(g => {
                try{
                  const ps = Array.isArray(g.players) ? g.players : [];
                  const ts = g.ts || g.created_at || g.createdAt || g.created_at || null;
                  const totals = Array.isArray(g.totals) ? g.totals : [];
                  const rows = ps.map((p,i)=>({
                    name: (p && p.name) ? String(p.name).trim() : '?',
                    score: Number(totals[i] ?? 0)
                  })).sort((a,b)=> (b.score - a.score) || String(a.name).localeCompare(String(b.name)));
                  const winner = rows[0] || { name:'?', score:'?' };
                  const opp = rows.slice(1).map(r => lpPlayerScoreText(r.name, r.score)).join(', ');
                  const isPractice = !!(g && (g.isPractice || g.is_practice || g.practice ||
                    String(g.mode || g.gameMode || '').toLowerCase() === 'practice' ||
                    String(g.state?.mode || g.state?.gameMode || '').toLowerCase() === 'practice' ||
                    g.state?.is_practice === true || g.state?.isPractice === true));
                  const isTurbo = !isPractice && lpIsTurboGame(g);
                  const beerPlayers = (!isPractice && !isTurbo) ? lpUnder100Names(rows) : [];
                  return { ts, winner_name: winner.name, winner_score: winner.score, opponents_text: opp, isPractice, isTurbo, mode: isPractice ? 'practice' : (isTurbo ? 'turbo' : (g.mode || g.state?.mode || '')), match_id: g.match_id || g.matchId || g.state?.match_id || g.state?.matchId || null, game_number: g.game_number || g.gameNumber || g.state?.game_number || g.state?.gameNumber || null, players: ps, totals, state: g.state || null, match_state: g.state?.match || null, beer_alert_players: beerPlayers };
                }catch(_e){
                  return { ts: g.ts || null, winner_name: '?', winner_score: '?', opponents_text: '', isPractice:false };
                }
              }).filter(Boolean);
            }
}
            // If cloud is unavailable, fall back to local game log cache (cloud->local sync writes here).
            if (!games || !games.length) {
              try {
                const gl = (typeof getGameLog === 'function') ? getGameLog() : [];
                if (Array.isArray(gl) && gl.length) {
                  const slice = gl.slice(-LP_BUFFER).reverse();
                  games = slice.map(row => {
                    try {
                      const ts = row.created_at || row.createdAt || row.ts || row.updated_at || null;
                      const state = row.state || row.State || row.game_state || null;
                      const ps0 = (state && Array.isArray(state.players)) ? state.players : (Array.isArray(row.players) ? row.players : []);
                      const totals0 = (state && state.totals && Array.isArray(state.totals)) ? state.totals : (Array.isArray(row.totals) ? row.totals : []);
                      const nameOf = (p) => {
                        if (!p) return '?';
                        if (typeof p === 'string') return p.trim() || '?';
                        return String(p.name || p.nickname || p.first_name || p.player_name || p.initials || p.player_id || '?').trim() || '?';
                      };
                      const rows = ps0.map((p,i)=>({ name: nameOf(p), score: Number(totals0[i] ?? 0) }))
                        .sort((a,b)=> (b.score - a.score) || String(a.name).localeCompare(String(b.name)));
                      const winner = rows[0] || { name:'?', score:'?' };
                      const opp = rows.slice(1).map(r => lpPlayerScoreText(r.name, r.score)).join(', ');
                      const isPractice = !!(row && (row.isPractice || row.is_practice || row.practice ||
                        String(row.mode || row.gameMode || '').toLowerCase() === 'practice' ||
                        String(state?.mode || state?.gameMode || '').toLowerCase() === 'practice' ||
                        state?.is_practice === true || state?.isPractice === true));
                      const isTurbo = !isPractice && lpIsTurboGame(Object.assign({}, row || {}, { state }));
                      const beerPlayers = (!isPractice && !isTurbo) ? lpUnder100Names(rows) : [];
                      return { ts, winner_name: winner.name, winner_score: winner.score, opponents_text: opp, isPractice, isTurbo, mode: isPractice ? 'practice' : (isTurbo ? 'turbo' : (row.mode || state?.mode || '')), match_id: row.match_id || row.matchId || state?.match_id || state?.matchId || state?.match?.id || null, game_number: row.game_number || row.gameNumber || state?.game_number || state?.gameNumber || null, players: ps0, totals: totals0, state, match_state: state?.match || null, beer_alert_players: beerPlayers };
                    } catch(_e) {
                      return null;
                    }
                  }).filter(Boolean);
                }
              } catch(_e) {}
            }

            if (!games || !games.length) {
              const ids = getSavedMatchIdsSorted();
              games = ids.slice(-LP_BUFFER).reverse().map(id => {
                const mm = getMatchState(id);
                if (!mm) return null;
                const rows = (mm.players || []).map(p => ({ name: p.name || '?', score: (p.totalScore ?? 0) }))
                  .sort((a,b)=> b.score - a.score || String(a.name).localeCompare(String(b.name)));
                const winner = rows[0] || { name: '?', score: '?' };
                const opp = rows.slice(1).map(r => lpPlayerScoreText(r.name, r.score)).join(', ');
                const isTurbo = lpIsTurboGame(mm);
                return {
                  match_id: id,
                  ts: mm.ts || mm.createdAt || mm.created_at || mm.updatedAt || mm.updated_at,
                  winner_name: winner.name,
                  winner_score: winner.score,
                  opponents_text: opp,
                  isTurbo,
                  mode: isTurbo ? 'turbo' : (mm.mode || mm.gameMode || ''),
                  players: mm.players || [],
                  totals: rows.map(r => r.score),
                  state: mm,
                  match_state: mm.match || mm,
                  beer_alert_players: []
                };
              }).filter(Boolean);
            }
            try {
              const matchRows = await lpFetchRelevantMatchRows(games);
              const matchResults = lpBuildCompletedMatchResultItems(games, matchRows);
              if (Array.isArray(matchResults) && matchResults.length) {
                games = ([]).concat(games || [], matchResults);
              }
            } catch(_e) {}
            items = games;
          }

          try{
            const derived = await lpBuildDerivedPrinterItems();
            if (Array.isArray(derived) && derived.length){
              items = ([]).concat(items || [], derived);
            }
          }catch(_e){}

          const mid = document.querySelector('#homeLivePrinter .lp-mid');
          const hold = document.querySelector('#homeLivePrinter .home-hold-overlay');

          if (!items.length) {
            // Keep the hold overlay visible; show empty rows.
            try { if (mid) mid.classList.add('lp-mid-hold'); } catch(_e){}
            try { const p = document.getElementById('homeLivePrinter'); if (p) p.classList.remove('is-live'); } catch(_e){}
            lpEnsureRows(Array.from({length: LP_VISIBLE}, ()=>'—'));
            return;
          }

          // We have data — turn the printer "live" (hide the overlay).
          try { if (mid) mid.classList.remove('lp-mid-hold'); } catch(_e){}
          try { const p = document.getElementById('homeLivePrinter'); if (p) p.classList.add('is-live'); } catch(_e){}
          try { if (hold) hold.style.display = 'none'; } catch(_e){}

          const _lpGetTs = (g) => g.event_ts || g.ts || g.created_at || g.createdAt;
          const sorted = items.slice().sort((a,b) => (new Date(_lpGetTs(b))).getTime() - (new Date(_lpGetTs(a))).getTime());
          const HIDE_KINDS = new Set();
          const filtered = sorted.filter(it => !(it && it.event_kind && HIDE_KINDS.has(it.event_kind)));
          // >>> PATCH:LIVE_PRINTER_DATE_HEADERS START
	          // Group lines by date: add a compact date header line when the day changes.
	          // Then list the match lines with time preserved (no leading DD/MM).
	          const _lpDays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
	          const _lpMons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
	          const _lpFmtHeader = (d)=>{
	            const wd = (_lpDays[d.getDay()]||"").slice(0, 3).toUpperCase();
	            const dd = d.getDate();
	            const mon = (_lpMons[d.getMonth()]||"").toUpperCase();
	            const yyyy = String(d.getFullYear());
	            return (wd + ' ' + dd + ' ' + mon + ' ' + yyyy).trim();
	          };
          const _lpStripDate = (line)=>{
            const s = String(line||"").trim();
            // "DD/MM / HH:MM rest" -> "HH:MM rest"
            let m = s.match(/^(\d{2}\/\d{2})\s*\/\s*(\d{2}:\d{2})\s*(.*)$/);
            if(m) return (m[2] + ' ' + (m[3]||'')).trim();
            // "DD/MM _ HH:MM _ rest" -> "HH:MM rest"
            m = s.match(/^(\d{2}\/\d{2})\s*[_\-–—]\s*(\d{2}:\d{2})\s*[_\-–—]\s*(.*)$/);
            if(m) return (m[2] + ' ' + (m[3]||'')).trim();
            return s;
          };

          const lines = [];
          let _lpLastKey = null;
          filtered.forEach(it=>{
            const ts = _lpGetTs(it);
            const d = ts ? new Date(ts) : null;
            const key = d ? (d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate()) : null;
            if(key && key !== _lpLastKey){
              if (_lpLastKey === null) lines.push('');
              else lines.push('');
              lines.push(_lpFmtHeader(d));
              _lpLastKey = key;
            }
            lines.push(_lpStripDate(lpFmtLine(it)));
            const beerAlert = lpBeerAlertLineForGame(it);
            if (beerAlert) lines.push(beerAlert);
          });
          // <<< PATCH:LIVE_PRINTER_DATE_HEADERS END

          const collapsedLines = lpCollapseRoundPBOverflow(lines);
          const sig0 = sorted[0] ? lpSig(sorted[0]) : '';
          const shouldRefresh = forceFull || (sig0 && sig0 !== st.lastSig) || !Array.isArray(st.bufLines);

          // Always keep the buffer for scrolling
          st.bufLines = collapsedLines.slice(0, LP_BUFFER);
          if (shouldRefresh) {
            st.lastSig = sig0 || st.lastSig;
          }

          // Start empty on first load; events scroll in from bottom one-by-one.
          if (!st.lpStarted) {
            st.lpStarted = true;
            st.lpCursor = 0;
            st.displayLines = Array.from({ length: LP_VISIBLE }, () => '');
            lpEnsureRows(st.displayLines);
          } else if (!Array.isArray(st.displayLines) || st.displayLines.length !== LP_VISIBLE) {
            st.displayLines = Array.from({ length: LP_VISIBLE }, () => '');
          }
        } finally {
          st.syncing = false;
        }
      };

if (!window.__homeLivePrinterInterval){
        window.__homeLivePrinterInterval = setInterval(()=>{
          const st = window.__homeLivePrinterState;
          if (!st) return;
          st.tick++;

          // Top animation
          const topLine = document.getElementById('homeLpTopLine');
          if (topLine){
            topLine.textContent = 'LIVE UPDATES';
          }

          
          // Continuous feed: scroll through last 20 even when nothing new arrives
          try {
            if (!Number.isFinite(st.hold)) st.hold = 0;
            if (st.hold > 0) st.hold--;
            else { lpScrollStep(); const h = Number(st.nextHold); st.hold = Number.isFinite(h) ? h : 2; }
          } catch (_) {}
          // Sync cloud rows at most every 15s; animation still ticks every second.
          if (!st.lastSyncMs || (Date.now() - st.lastSyncMs) >= LP_SYNC_MS) {
            st.lastSyncMs = Date.now();
            st.syncCount++;
            const force = (st.syncCount % st.forceFullEvery) === 0;
            lpSync(force);
          }
        }, 1000);
        // initial fill
        try { const st0 = window.__homeLivePrinterState; if (st0) st0.lastSyncMs = Date.now(); } catch (_) {}
        lpSync(true);
      }
    }catch(_){ }

    // ===== HOME FOOTER NAV (above tickers) =====
    let footer = document.getElementById('homeFooterNav');
    const tickerTop = document.getElementById('psTickerTop') || document.getElementById('psTicker');
    if (!footer){
      footer = doc.createElement('div');
      footer.id = 'homeFooterNav';
      footer.className = 'home-footer-nav';
      // insert right before the ticker(s)
      if (tickerTop && tickerTop.parentNode) {
        tickerTop.parentNode.insertBefore(footer, tickerTop);
      } else {
        // fallback: append to details section
        const details = document.getElementById('details');
        if (details) details.appendChild(footer);
      }
    }
    // Footer is not fixed; keep in normal document flow
    try{ footer.style.bottom=''; footer.style.left=''; footer.style.right=''; }catch(_){}

    // Build 3x squares + Admin row
    footer.innerHTML = '';

    // Player HUB (coming soon)
    let hub = document.getElementById('playerHubBtn');
    if (!hub){
      hub = doc.createElement('button');
      hub.id = 'playerHubBtn';
      hub.type = 'button';
      hub.className = 'btn home-square-btn';
      hub.onclick = () => toast('Player HUB - Coming soon!');
    }

    // Square styling + labels
    
// Nav buttons (PLAYER HUB / STATS / LEAGUE & RANKS) — match main button styling
hub.className = 'btn secondary big navBtn navGreen';
stats.className = 'btn secondary big navBtn navBlue';
league.className = 'btn secondary big navBtn navOrange';

// Inline SVG icons (no external deps)
const svgUsers = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const svgBar = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"/><path d="M10 19V9"/><path d="M16 19V13"/><path d="M22 19V7"/></svg>';
const svgTrophy = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v3a5 5 0 0 1-10 0V4Z"/><path d="M5 7H3V5h4"/><path d="M19 7h2V5h-4"/><path d="M5 7a5 5 0 0 0 5 5"/><path d="M19 7a5 5 0 0 1-5 5"/></svg>';
const svgLock = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

hub.innerHTML   = `<span class="navIcon">${svgUsers}</span><span class="navLabel">PLAYER HUB</span>`;
stats.innerHTML = `<span class="navIcon">${svgBar}</span><span class="navLabel">STATS</span>`;
league.innerHTML= `<span class="navIcon">${svgTrophy}</span><span class="navLabel">LEAGUE</span>`;

// Admin: clickable text + lock (no big button)
admin.className = 'adminLink';
admin.type = 'button';
admin.innerHTML = `<span class="adminLock">${svgLock}</span><span class="adminText">ADMIN</span>`;

// Row: 3 buttons aligned to the same outer edges as the 2 league boxes above
const navRow = doc.createElement('div');
navRow.className = 'home-nav-row';
navRow.appendChild(hub);
navRow.appendChild(stats);
navRow.appendChild(league);

const adminRow = doc.createElement('div');
adminRow.className = 'home-admin-row';
adminRow.appendChild(admin);

footer.appendChild(navRow);
footer.appendChild(adminRow);

  } catch(e){
    console.error('arrangeStartActions failed', e);
  }
}

/*****************
 * BOOT
 *****************/
document.addEventListener('DOMContentLoaded', () => {
  // Start on details screen
  show('details');
  updatePadSpacer();
  setupStartMenuButtons();
  initSetupSteppers();

  // Kick off initial cloud connectivity check
  if (ensureCloudInit()) initialCloudCheck();

// Restart buttons (Player Select + Game + Leaderboard)
  ['restartGameBtn', 'restartGameBtnLB', 'restartGameBtnGame'].forEach(id => {
    document.querySelectorAll('#' + id).forEach(btn => {
      btn.onclick = restartGame;
    });
  });

  // Stats buttons in top rows (game + final leaderboard)
  const statsHubBtnGame  = byId('statsHubBtnGame');    // game screen
  const statsHubBtnFinal = byId('statsHubBtnFinal');   // leaderboard screen

  if (statsHubBtnGame)  statsHubBtnGame.onclick  = openStatsHubDialog;
  if (statsHubBtnFinal) statsHubBtnFinal.onclick = openStatsHubDialog;
  const hsFinalBtn = byId('highScoresMenuBtnLB');
  if (hsFinalBtn) hsFinalBtn.onclick = openHighScoresMenuDialog;
  // Leaderboard buttons (guarded lookups)
  (function(){
    const map = [
      ['lbGameStatsBtn',   'openGameStatsDialog'],
      ['lbMatchStatsBtn',  'openMatchStatsDialog'],
      ['lbGameRaceBtn',    'openGameRaceDialog']
    ];
    map.forEach(([id, fn])=>{
      const el = byId(id);
      const handler = (typeof window[fn] === 'function') ? window[fn] : null;
      if (el && handler) el.onclick = handler;
    });
  })();

  // Global ESC/click-outside for add/select/admin modals
  document.addEventListener('click', function(event) {
    const addPlayerModal      = byId('addPlayerModal');
    const selectPlayerModal   = byId('selectPlayerModal');
    const adminHub            = byId('adminHubModal');
    const savedPlayersAdmin   = byId('savedPlayersAdminModal');

    if (addPlayerModal &&
        !addPlayerModal.classList.contains('hidden') &&
        event.target === addPlayerModal) {
      addPlayerModal.classList.add('hidden');
    }

    if (selectPlayerModal &&
        !selectPlayerModal.classList.contains('hidden') &&
        event.target === selectPlayerModal) {
      selectPlayerModal.classList.add('hidden');
    }

    if (adminHub &&
        !adminHub.classList.contains('hidden') &&
        event.target === adminHub) {
      adminHub.classList.add('hidden');
    }

    if (savedPlayersAdmin &&
        !savedPlayersAdmin.classList.contains('hidden') &&
        event.target === savedPlayersAdmin) {
      savedPlayersAdmin.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;

    const addPlayerModal    = byId('addPlayerModal');
    const selectPlayerModal = byId('selectPlayerModal');
    const adminHub          = byId('adminHubModal');
    const savedPlayersAdmin = byId('savedPlayersAdminModal');

    if (addPlayerModal &&
        !addPlayerModal.classList.contains('hidden')) {
      addPlayerModal.classList.add('hidden');
    }

    if (selectPlayerModal &&
        !selectPlayerModal.classList.contains('hidden')) {
      selectPlayerModal.classList.add('hidden');
    }

    if (adminHub &&
        !adminHub.classList.contains('hidden')) {
      adminHub.classList.add('hidden');
    }

    if (savedPlayersAdmin &&
        !savedPlayersAdmin.classList.contains('hidden')) {
      savedPlayersAdmin.classList.add('hidden');
    }
  });
  

  try { arrangeStartActions(); } catch(_) {}
});

// ===== FINAL OVERRIDE: Cloud pill — dot-only indicator =====
// Replaces any previous setCloudStatus to remove text and show a single coloured dot.

// >>> PATCH:SQ_BOOT_SPLASH_HIDE_V1 START
function __sqHideBootSplash(){
  try{
    const el = document.getElementById('bootSplash');
    if (!el) return;
    if (el.classList.contains('sq-hide')) return;
    // allow one paint so we don't fight initial render
    requestAnimationFrame(()=>{ try{ el.classList.add('sq-hide'); }catch(_){ } });
    // fully remove later to free memory / hit-testing
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 450);
  }catch(_){}
}
// <<< PATCH:SQ_BOOT_SPLASH_HIDE_V1 END
// >>> PATCH:SQ_BOOT_SPLASH_FAILSAFE_V1 START
// Safety: never let the boot splash trap the UI if cloud status never resolves.
// (Cloud check continues in background; start screen should still be usable.)
try{
  setTimeout(()=>{ try{ __sqHideBootSplash(); }catch(_){ } }, 2000);
}catch(_){}
// <<< PATCH:SQ_BOOT_SPLASH_FAILSAFE_V1 END

// >>> PATCH:SQ_GAME_LOAD_OVERLAY_JS_V1 START
function __sqAfterPaint(fn){
  try{ requestAnimationFrame(()=>setTimeout(fn,0)); }catch(_){ try{ setTimeout(fn,0); }catch(__){ } }
}
function __sqShowGameLoadOverlay(msg){
  try{
    const ov = document.getElementById('gameLoadOverlay');
    const el = document.getElementById('gameLoadMsg');
    if (!ov) return;

    if (typeof msg === 'string' && el) el.textContent = msg;

    // record show time for minimum display
    window.__sqGameLoadShownAt = (performance && performance.now) ? performance.now() : Date.now();
    if (window.__sqGameLoadHideT) { clearTimeout(window.__sqGameLoadHideT); window.__sqGameLoadHideT = null; }

    ov.classList.remove('sq-hide');
    ov.setAttribute('aria-hidden','false');
    // Appear instantly (no fade-in) so the underlying setup page can never show
    // through a semi-transparent overlay; the fade-out on hide is preserved.
    ov.style.transition = 'none';
    ov.classList.add('isOn');
    void ov.offsetWidth; // force the opaque state to apply before restoring transition
    ov.style.transition = '';
  }catch(_){}
}
function __sqHideGameLoadOverlay(){
  try{
    const ov = document.getElementById('gameLoadOverlay');
    if (!ov) return;

    const now = (performance && performance.now) ? performance.now() : Date.now();
    const t0 = window.__sqGameLoadShownAt || 0;
    const elapsed = now - t0;
    // Floor only long enough to avoid a jarring instant flash — the overlay is
    // always held until buildEverythingChunked() finishes anyway, so this is a
    // minimum, not a fixed wait. (Was 3000ms, which made the live game appear to
    // "open a couple of seconds later" even though it was ready almost at once.)
    const minMs = 450;
    const wait = Math.max(0, minMs - elapsed);

    if (window.__sqGameLoadHideT) { clearTimeout(window.__sqGameLoadHideT); window.__sqGameLoadHideT = null; }

    const doHide = ()=>{
      try{
        ov.classList.remove('isOn');
        ov.setAttribute('aria-hidden','true');
        // after fade, remove from flow for taps
        setTimeout(()=>{ ov.classList.add('sq-hide'); }, 240);
      }catch(_){}
    };

    if (wait > 0){
      window.__sqGameLoadHideT = setTimeout(doHide, wait);
    } else {
      doHide();
    }
  }catch(_){}
}
// <<< PATCH:SQ_GAME_LOAD_OVERLAY_JS_V1 END

window.setCloudStatus = function setCloudStatus(state, msg){
  try{ if (state && state !== 'checking') __sqHideBootSplash(); }catch(_){ }

  var el = document.getElementById('cloudStatusPill') ||
           document.getElementById('cloudStatus') ||
           document.querySelector('.cloud-pill');
  if (!el) return;

  // Decide colour
  var root = getComputedStyle(document.documentElement);
  function pick(varName, fallback){ 
    try { 
      var v = root.getPropertyValue(varName); 
      return (v && v.trim()) ? v.trim() : fallback; 
    } catch(_) { return fallback; } 
  }
  var colour = pick('--muted', '#8a8fa6'); // default/checking
  if (state === 'ok' || state === 'connected' || state === 'online') {
    colour = pick('--good', '#7fffd4');
  } else if (state === 'warn' || state === 'checking') {
    colour = pick('--warn', '#ffcc66');
  } else if (state === 'error' || state === 'offline') {
    colour = pick('--danger', '#ff6b6b');
  }

  // Strip pill styling & content → dot only
  el.innerHTML = '';
  el.style.padding = '0';
  el.style.minWidth = '0';
  el.style.background = 'transparent';
  el.style.boxShadow = 'none';
  el.style.border = 'none';
  el.style.display = 'inline-block';

  var dot = document.createElement('span');
  dot.style.display = 'inline-block';
  dot.style.width = '12px';
  dot.style.height = '12px';
  dot.style.borderRadius = '50%';
  dot.style.background = colour;
  dot.title = msg || (state || '');
  dot.setAttribute('aria-hidden', 'true');
  el.appendChild(dot);

  // V-12: the dot alone is colour-only information — mirror the status as
  // visually-hidden text and announce changes politely.
  el.setAttribute('role', 'status');
  var sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = msg || ('Cloud status: ' + (state || 'unknown'));
  el.appendChild(sr);
};

// ===== Match Stats helpers (avg throw/round + perfect rounds) =====
(function(){
  if (window.__matchStatsHelpers) return; // prevent double insert
  window.__matchStatsHelpers = true;

  // Gather all rounds (completed games + current in‑progress) for a player index
  function __iterateAllRoundsForPlayer(playerIdx){
    const acc = [];

    // Completed games in the current match
    const hist = (state && state.match && Array.isArray(state.match.history)) ? state.match.history : [];
    hist.forEach(g => {
      const board = g && g.board && g.board[playerIdx];
      if (!board) return;
      for (let r = 0; r < MAX_ROUNDS; r++){
        const ent = board[r];
        const rd  = ROUNDS[r];
        if (!ent || !rd) continue;
        const darts = Array.isArray(ent.darts) ? ent.darts : [];
        // If roundTotal missing, compute from darts
        const rt = Number(ent.roundTotal ?? darts.reduce((s,d)=> s + Number(d && d.points || 0), 0));
        acc.push({ rd, darts, roundTotal: rt });
      }
    });

    // Current (in‑progress) game
    const curRows = (state && state.score && state.score[playerIdx]) ? state.score[playerIdx] : [];
    for (let r = 0; r < (curRows ? curRows.length : 0); r++){
      const ent = curRows[r];
      const rd  = ROUNDS[r];
      if (!ent || !rd) continue;
      const darts = Array.isArray(ent.darts) ? ent.darts : [];
      const rt = Number(ent.roundTotal ?? darts.reduce((s,d)=> s + Number(d && d.points || 0), 0));
      acc.push({ rd, darts, roundTotal: rt });
    }

    return acc;
  }

  // Public API used by the modal fixer
  window.computeMatchAverages = function computeMatchAverages(){
    const players = (state && Array.isArray(state.players)) ? state.players : [];
    return players.map((_, i) => {
      const rounds = __iterateAllRoundsForPlayer(i);
      let points = 0, throws = 0, perfect = 0;

      rounds.forEach(({ rd, darts, roundTotal }) => {
        const rt = Number(roundTotal || 0);
        points += rt;

        // Count darts actually thrown (includes misses)
        const taken = (darts || []).filter(d => d !== null).length;
        throws += taken;

        // Perfect round = 3 darts, all on the intended target for that round
        // number/doubles/triples: any scoring hit (points > 0) counts
        // bull: only darts with kind === 'B' count
        if (taken === 3){
          let allHit = false;
          if (rd.type === 'number' || rd.type === 'doubles' || rd.type === 'triples'){
            allHit = darts.every(d => d && Number(d.points || 0) > 0);
          } else if (rd.type === 'bull') {
            allHit = darts.every(d => d && d.kind === 'B');
          }
          if (allHit) perfect++;
        }
      });

      const avgThrow = throws ? (points / throws) : 0;
      const avgRound = avgThrow * 3;
      return { points, throws, avgThrow, avgRound, perfect };
    });
  };
})();
  
// ===== Match Stats modal fixer (remove Avg Last 9, fix avgs, add Perfect Rounds) =====
(function(){
  if (window.__matchStatsModalFixer) return;
  window.__matchStatsModalFixer = true;

  function applyMatchStatsFix(root){
    try{
      // Find a modal with title "Match Stats"
      const modal = root.querySelector('.modal');
      if (!modal) return;
      const h3 = modal.querySelector('h3');
      if (!h3 || !/match stats/i.test((h3.textContent || '').trim())) return;

      const table = modal.querySelector('table');
      const tbody = table && table.querySelector('tbody');
      if (!tbody) return;

      const players = (state && Array.isArray(state.players)) ? state.players : [];
      const P = players.length;
      const stats = (typeof computeMatchAverages === 'function') ? computeMatchAverages() : players.map(()=>({avgThrow:0,avgRound:0,perfect:0}));

      // helpers
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const getRow = (label) => rows.find(tr => (tr.firstElementChild && (tr.firstElementChild.textContent || '').trim().toLowerCase()) === label.toLowerCase());
      const setRowVals = (tr, values, fmt = (v)=>String(v)) => {
        if (!tr) return;
        for (let i = 0; i < P; i++){
          const td = tr.children[1 + i]; // first col is label
          if (td) td.textContent = fmt(values[i] ?? 0);
        }
      };

      // Remove "Avg Last 9" (keep it in Game Stats only)
      const avg9 = getRow('Avg Last 9');
      if (avg9) avg9.remove();

      // Update Avg Throw / Avg Round from computed values
      const rAvgT = getRow('Avg Throw');
      const rAvgR = getRow('Avg Round');
      setRowVals(rAvgT, stats.map(s => s.avgThrow), v => (Number(v)||0).toFixed(1));
      setRowVals(rAvgR, stats.map(s => s.avgRound), v => (Number(v)||0).toFixed(1));

      // Insert "Perfect Rounds" after "Round Streak" (or at the end if not found)
      const afterRow = getRow('Round Streak') || rows[rows.length - 1];
      const existingPR = getRow('Perfect Rounds');
      const valuesPR = stats.map(s => s.perfect);

      if (existingPR) {
        // just update values if it already exists
        setRowVals(existingPR, valuesPR);
      } else {
        // create the row
        const tr = document.createElement('tr');
        const tdLabel = document.createElement('td');
        tdLabel.textContent = 'Perfect Rounds';
        tr.appendChild(tdLabel);
        for (let i = 0; i < P; i++){
          const td = document.createElement('td');
          td.textContent = String(valuesPR[i] || 0);
          tr.appendChild(td);
        }
        if (afterRow && afterRow.parentElement) {
          afterRow.insertAdjacentElement('afterend', tr);
        } else {
          tbody.appendChild(tr);
        }
      }
    } catch(e){
      console.error('applyMatchStatsFix error', e);
    }
  }

  // Observe for modal creation; patch when Match Stats dialog appears (via shared UI mutation bus)
  try {
    window.__sqUIMutationBus?.on((muts) => {
      for (const m of (muts || [])){
        for (const n of (m.addedNodes || [])){
          if (n.nodeType === 1 && n.classList.contains('modal-backdrop')){
            // let the dialog render, then patch
            setTimeout(() => applyMatchStatsFix(n), 0);
          }
        }
      }
    });
  } catch(_) {}
})();

// ===== High Scores modals: force compact style (League / Practice / Match / Round) =====
(function(){
  if (window.__hsCompactModalFixer) return;
  window.__hsCompactModalFixer = true;

  function applyHsCompact(root){
    try{
      const modal = root.querySelector('.modal');
      if (!modal) return;
      const h3 = modal.querySelector('h3');
      if (!h3) return;
      const title = (h3.textContent || '').trim().toLowerCase();

      // Any modal titled "High Scores" → compact
      if (title.includes('high scores')) {
        modal.classList.add('compact');
      }
    } catch(e){
      console.error('applyHsCompact error', e);
    }
  }

  try {
    window.__sqUIMutationBus?.on((muts) => {
      for (const m of (muts || [])){
        for (const n of (m.addedNodes || [])){
          if (n.nodeType === 1 && n.classList.contains('modal-backdrop')){
            // Let the dialog render, then patch
            setTimeout(() => applyHsCompact(n), 0);
          }
        }
      }
    });
  } catch(_) {}
})();

// ===== PB/GR snapshot + refresh (cloud-first; saved players, official-only) =====
// >>> PATCH:pbgr-delegate-to-views START
// NOTE: legacy getPBGRSnapshot previously depended on a per-dart table (game_throws).
// This project now exposes runtime PB/WR via clean app views:
//   - v_pb_by_player_round_clean_app (bucket_key, round_key, pb_points)
//   - v_wr_by_round_clean_app        (round_key, wr_points)
// To prevent schema-dependent crashes, we delegate legacy callers to the view snapshot.
(function(){
  window.getPBGRSnapshot = async function getPBGRSnapshot(){
    try{
      const snap = (typeof getV2PBWRSnapshot === 'function') ? await getV2PBWRSnapshot() : null;
      if (!snap || !snap.wrByRound || !snap.pbByBucket) return { byTargetMeta: {}, byPlayerMeta: new Map() };

      // byTargetMeta: round_key -> { val }
      const byTargetMeta = {};
      try{
        for (const [rk, v] of snap.wrByRound.entries()){
          const k = String(rk || '').trim();
          if (!k) continue;
          byTargetMeta[k] = { val: Number(v || 0) };
          const m = k.match(/^N(\d+)$/i);
          if (m){
            const friendly = String(Number(m[1]) + 9);
            byTargetMeta[friendly] = { val: Number(v || 0) };
          } else if (k === 'D_ANY') byTargetMeta.D = { val: Number(v || 0) };
          else if (k === 'T_ANY') byTargetMeta.T = { val: Number(v || 0) };
          else if (k === 'BULL_ANY') byTargetMeta.B = { val: Number(v || 0) };
        }
      }catch(_){}

      // Enrich global WR rows from the canonical modal view when available.
      // This gives Admin the holder + darts fields, not just the numeric WR.
      try{
        if (typeof sb !== 'undefined' && sb && sb.from){
          const { data, error } = await sb
            .from('v_round_high_scores_modal')
            .select('round_key,wr,darts,holder,tie_idx')
            .limit(50000);
          if (!error && Array.isArray(data)){
            const bestSeen = new Set();
            const rows = data.slice().sort((a,b)=>(Number(a.tie_idx||1)-Number(b.tie_idx||1)));
            for (const r of rows){
              const raw = String(r.round_key ?? '').trim().toUpperCase();
              if (!raw || bestSeen.has(raw)) continue;
              bestSeen.add(raw);
              const val = Number(r.wr ?? r.wr_points ?? 0) || 0;
              const meta = { val, player: String(r.holder || ''), darts: String(r.darts || ''), game_id:null, ridx:null, ts:null };
              byTargetMeta[raw] = meta;
              if (/^\d+$/.test(raw)) byTargetMeta[raw] = meta;
              else if (raw === 'D') byTargetMeta.D = meta;
              else if (raw === 'T') byTargetMeta.T = meta;
              else if (raw === 'B') byTargetMeta.B = meta;
            }
          }
        }
      }catch(_){ }

      // byPlayerMeta: nameKey (lower) -> { round_key -> { val } }
      const byPlayerMeta = new Map();
      const nameToBucket = (window.__v2PBWRNameToBucket instanceof Map) ? window.__v2PBWRNameToBucket : new Map();

      for (const [nm, bk] of nameToBucket.entries()){
        const nameKey = String(nm || '').trim().toLowerCase();
        const bucket  = String(bk ?? '').trim();
        if (!nameKey || !bucket) continue;

        const pbMap = snap.pbByBucket.get(bucket);
        if (!pbMap) continue;

        const obj = {};
        for (const [rk, v] of pbMap.entries()){
          const k = String(rk || '').trim();
          if (!k) continue;
          obj[k] = { val: Number(v || 0) };
          const m = k.match(/^N(\d+)$/i);
          if (m){
            const friendly = String(Number(m[1]) + 9);
            obj[friendly] = { val: Number(v || 0) };
          } else if (k === 'D_ANY') obj.D = { val: Number(v || 0) };
          else if (k === 'T_ANY') obj.T = { val: Number(v || 0) };
          else if (k === 'BULL_ANY') obj.B = { val: Number(v || 0) };
        }
        byPlayerMeta.set(nameKey, obj);
      }

      return { byTargetMeta, byPlayerMeta };
    }catch(e){
      console.warn('[SQ] getPBGRSnapshot delegate failed:', e?.message || e);
      return { byTargetMeta: {}, byPlayerMeta: new Map() };
    }
  };

  // Legacy helper: force refresh
  window.refreshPBGRCloud = async function refreshPBGRCloud(){
    try{
      window.__v2PBWRSnapshot = null;
      window.__v2PBWRSnapshotPromise = null;
      if (typeof getV2PBWRSnapshot === 'function') await getV2PBWRSnapshot();
      if (typeof window.updatePBGRBadges === 'function') await window.updatePBGRBadges();
      return true;
    }catch(e){
      console.warn('[SQ] refreshPBGRCloud failed:', e?.message || e);
      return false;
    }
  };
})();
// >>> PATCH:PBGR_ADMIN_SCHEMA_FALLBACK_V2 START
// Admin PB/GR must not assume one view schema. Older builds expose:
//   v_pb_by_player_round: player, cat, val, game_id, ridx, ts
//   v_wr_by_round:        cat, val, player, game_id, ridx, ts
// Newer builds may expose:
//   bucket_key, round_key, pb_points / wr_points
// This override reads explicit clean app columns and normalises both shapes for the Admin modal.
(function(){
  function normName(v){ return String(v || '').trim().toLowerCase(); }
  function readNum(row, keys){
    for (const k of keys){
      if (row && row[k] != null && row[k] !== ''){
        const n = Number(row[k]);
        if (Number.isFinite(n)) return n;
      }
    }
    return 0;
  }
  function readText(row, keys){
    for (const k of keys){
      if (row && row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
    }
    return '';
  }
  function normaliseRoundKey(raw, ridx){
    let k = String(raw ?? '').trim().toUpperCase();
    if (!k && ridx != null && ridx !== ''){
      const r = Number(ridx);
      if (Number.isFinite(r)){
        if (r >= 0 && r <= 10) k = String(10 + r);
        else if (r === 11) k = 'D';
        else if (r === 12) k = 'T';
        else if (r === 13) k = 'B';
      }
    }
    if (/^N(\d+)$/i.test(k)){
      const n = Number(k.replace(/^N/i,''));
      if (Number.isFinite(n)) return String(n + 9);
    }
    if (k === 'D_ANY' || k === 'DOUBLE' || k === 'DOUBLES') return 'D';
    if (k === 'T_ANY' || k === 'TREBLE' || k === 'TREBLES' || k === 'TRIPLE') return 'T';
    if (k === 'BULL_ANY' || k === 'BULL' || k === 'BULLS') return 'B';
    if (/^\d+$/.test(k)) return String(Number(k));
    return k;
  }
  function setRoundAliases(obj, friendly, meta){
    if (!friendly) return;
    obj[friendly] = meta;
    const n = Number(friendly);
    if (Number.isFinite(n) && n >= 10 && n <= 20) obj['N' + String(n - 9)] = meta;
    if (friendly === 'D') obj.D_ANY = meta;
    if (friendly === 'T') obj.T_ANY = meta;
    if (friendly === 'B') obj.BULL_ANY = meta;
  }
  async function savedPlayers(){
    try{ return (typeof cloudListPlayers === 'function') ? await cloudListPlayers() : []; }
    catch(_){ return []; }
  }

  window.getPBGRSnapshot = async function getPBGRSnapshot(){
    try{
      if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) return { byTargetMeta:{}, byPlayerMeta:new Map() };
      if (typeof sb === 'undefined' || !sb || !sb.from) return { byTargetMeta:{}, byPlayerMeta:new Map() };

      const players = await savedPlayers();
      const idToName = new Map();
      const nameToId = new Map();
      for (const p of (players || [])){
        const name = String(p?.name || '').trim();
        const id = String(p?.id ?? p?.player_id ?? p?.bucket_key ?? p?.bucketKey ?? '').trim();
        if (name && id){ idToName.set(id, name); nameToId.set(normName(name), id); }
      }
      window.__v2PBWRNameToBucket = nameToId;

      const cleanRows = (typeof __sqGetPBWRCleanRowsFromSnapshot === 'function') ? await __sqGetPBWRCleanRowsFromSnapshot() : { wrRows:[], pbRows:[], error:'Clean PB/WR helper unavailable' };
      const wrRes = { data: cleanRows.wrRows || [], error: cleanRows.error || null };
      const pbRes = { data: cleanRows.pbRows || [], error: cleanRows.error || null };
      if (wrRes?.error) throw wrRes.error;
      if (pbRes?.error) throw pbRes.error;

      const byTargetMeta = {};
      for (const row of (wrRes.data || [])){
        const friendly = normaliseRoundKey(readText(row, ['round_key','cat','round','target','bucket','key']), row?.ridx ?? row?.round_index);
        if (!friendly) continue;
        const val = readNum(row, ['wr_points','wr','val','points','score','round_total']);
        const meta = {
          val,
          player: readText(row, ['player','holder','name','player_name']) || idToName.get(readText(row, ['bucket_key','player_id'])) || '',
          darts: readText(row, ['darts','throws','dart_count']),
          game_id: row?.game_id || row?.game || null,
          ridx: row?.ridx ?? row?.round_index ?? null,
          ts: row?.ts || row?.created_at || row?.date || null
        };
        const prev = byTargetMeta[friendly];
        if (!prev || val > Number(prev.val || 0)) setRoundAliases(byTargetMeta, friendly, meta);
      }

      const byPlayerMeta = new Map();
      for (const row of (pbRes.data || [])){
        const friendly = normaliseRoundKey(readText(row, ['round_key','cat','round','target','bucket','key']), row?.ridx ?? row?.round_index);
        if (!friendly) continue;
        const val = readNum(row, ['pb_points','pb','val','points','score','round_total']);
        const rawPlayer = readText(row, ['player','name','player_name','holder']);
        const bucket = readText(row, ['bucket_key','player_id','id']);
        const playerName = rawPlayer || idToName.get(bucket) || bucket;
        const nameKey = normName(playerName);
        if (!nameKey) continue;
        const meta = {
          val,
          player: playerName,
          darts: readText(row, ['darts','throws','dart_count']),
          game_id: row?.game_id || row?.game || null,
          ridx: row?.ridx ?? row?.round_index ?? null,
          ts: row?.ts || row?.created_at || row?.date || null
        };
        if (!byPlayerMeta.has(nameKey)) byPlayerMeta.set(nameKey, {});
        const obj = byPlayerMeta.get(nameKey);
        const prev = obj[friendly];
        if (!prev || val > Number(prev.val || 0)) setRoundAliases(obj, friendly, meta);

        // Also index by bucket/id so dropdown values can use either name or id later.
        if (bucket){
          const bk = normName(bucket);
          if (!byPlayerMeta.has(bk)) byPlayerMeta.set(bk, {});
          const bObj = byPlayerMeta.get(bk);
          const bPrev = bObj[friendly];
          if (!bPrev || val > Number(bPrev.val || 0)) setRoundAliases(bObj, friendly, meta);
        }
      }

      try{
        window.__sqPBGRAdminLastCounts = {
          wrRows: (wrRes.data || []).length,
          pbRows: (pbRes.data || []).length,
          playerKeys: byPlayerMeta.size
        };
      }catch(_){ }

      return { byTargetMeta, byPlayerMeta };
    }catch(e){
      console.warn('[SQ] PBGR Admin schema fallback failed:', e?.message || e);
      try{ window.__sqPBGRAdminLastError = e?.message || String(e); }catch(_){ }
      return { byTargetMeta:{}, byPlayerMeta:new Map() };
    }
  };

  window.refreshPBGRCloud = async function refreshPBGRCloud(){
    try{
      window.__v2PBWRSnapshot = null;
      window.__v2PBWRSnapshotPromise = null;
      window.__pbgrSnapshot = null;
      window.__pbgrSnapshotPromise = null;
      await window.getPBGRSnapshot();
      if (typeof window.updatePBGRBadges === 'function') await window.updatePBGRBadges();
      return true;
    }catch(e){
      console.warn('[SQ] refreshPBGRCloud failed:', e?.message || e);
      return false;
    }
  };
})();
// <<< PATCH:PBGR_ADMIN_SCHEMA_FALLBACK_V2 END
;


// >>> PATCH:PBGR_ADMIN_ALWAYS_MERGE_GAMES_V1 START
// Admin PB/GR: views can be partial (observed: only B=125 returned), so always merge
// Supabase games.state.board as the authoritative fallback instead of stopping at the first view value.
(function(){
  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function text(row, keys){ for (const k of keys){ const v = row && row[k]; if (v != null && String(v).trim() !== '') return String(v).trim(); } return ''; }
  function num(row, keys){ for (const k of keys){ const v = row && row[k]; if (v != null && v !== ''){ const n = Number(v); if (Number.isFinite(n)) return n; } } return 0; }
  function roundFromIndex(i){ const n = Number(i); if (!Number.isFinite(n)) return ''; if (n >= 0 && n <= 10) return String(10 + n); if (n === 11) return 'D'; if (n === 12) return 'T'; if (n === 13) return 'B'; return ''; }
  function roundKey(raw, ridx){ let k = String(raw ?? '').trim().toUpperCase(); if (!k) return roundFromIndex(ridx); const m = k.match(/^N(\d+)$/i); if (m) return String(Number(m[1]) + 9); if (k === 'D_ANY' || k === 'DOUBLE' || k === 'DOUBLES') return 'D'; if (k === 'T_ANY' || k === 'TREBLE' || k === 'TREBLES' || k === 'TRIPLE') return 'T'; if (k === 'BULL_ANY' || k === 'BULL' || k === 'BULLS') return 'B'; if (/^\d+$/.test(k)) return String(Number(k)); return k; }
  function addAliases(obj, k, meta){ if (!obj || !k) return; obj[k] = meta; const n = Number(k); if (Number.isFinite(n) && n >= 10 && n <= 20) obj['N' + String(n - 9)] = meta; if (k === 'D') obj.D_ANY = meta; if (k === 'T') obj.T_ANY = meta; if (k === 'B') obj.BULL_ANY = meta; }
  function maybeSet(obj, k, meta){ if (!obj || !k || !meta || !(Number(meta.val) > 0)) return; const prev = obj[k]; if (!prev || Number(meta.val || 0) > Number(prev.val || 0)) addAliases(obj, k, meta); }
  function maybeSetPlayer(map, playerKey, k, meta){ if (!playerKey || !k || !meta || !(Number(meta.val) > 0)) return; if (!map.has(playerKey)) map.set(playerKey, {}); maybeSet(map.get(playerKey), k, meta); }
  function roundTotal(ent){ if (!ent) return 0; if (typeof ent === 'number') return Number(ent) || 0; for (const k of ['roundTotal','round_total','score','points','total','val']){ if (ent[k] != null && ent[k] !== ''){ const n = Number(ent[k]); if (Number.isFinite(n)) return n; } } if (Array.isArray(ent.darts)) return ent.darts.reduce((a,d)=> a + (Number(d && (d.points ?? d.score ?? d.val) || 0) || 0), 0); return 0; }
  function darts(ent){ try{ if (!ent) return ''; if (typeof ent.dartsText === 'string') return ent.dartsText; if (typeof ent.darts === 'string') return ent.darts; if (!Array.isArray(ent.darts)) return ''; return ent.darts.slice(0,3).map(d => { if (!d) return 'x'; const kind = String(d.kind || d.multiplier || d.type || '').toLowerCase(); const bull = String(d.bull || '').toLowerCase(); const pts = Number(d.points ?? d.score ?? d.val ?? 0) || 0; if (kind.startsWith('tr') || kind === 't' || kind === '3') return pts > 0 ? 'T' : 'x'; if (kind.startsWith('do') || kind === 'd' || kind === '2') return pts > 0 ? 'D' : 'x'; if (kind.startsWith('b') || bull || kind === 'ib' || kind === 'ob') return pts > 0 ? 'B' : 'x'; if (kind.startsWith('s') || kind === '1') return pts > 0 ? 'S' : 'x'; return pts > 0 ? 'S' : 'x'; }).join('/'); }catch(_){ return ''; } }
  function normalisePlayers(g){ const ps = g && (g.players || (g.state && g.state.players)); return Array.isArray(ps) ? ps.map(p => typeof p === 'string' ? { name:p } : (p || {})) : []; }
  function normaliseBoard(g){ return g && (g.board || (g.state && g.state.board)); }
  function rowsForPlayer(board, pi){ if (!Array.isArray(board)) return []; if (Array.isArray(board[pi])) return board[pi]; if (Array.isArray(board[0]) && board[0][pi] != null) return board.map(r => Array.isArray(r) ? r[pi] : null); return []; }
  async function getSavedPlayersSafe(){ try{ return (typeof cloudListPlayers === 'function') ? (await cloudListPlayers()) : []; }catch(_){ return []; } }
  async function getGamesSafe(){ try{ if (typeof cloudFetchAllGamesAsLocal === 'function') return await cloudFetchAllGamesAsLocal(); }catch(e){ console.warn('[SQ] PBGR cloudFetchAllGamesAsLocal failed:', e && (e.message || e)); } const client = window.sb || (typeof sb !== 'undefined' ? sb : null); if (!client || !client.from) return []; const { data, error } = await client.from('games').select('id,created_at,state,totals,match_id,game_number,finished').order('created_at', { ascending:true }).limit(100000); if (error) throw error; return (data || []).map(r => ({ id:r.id, ts:r.created_at, created_at:r.created_at, players:r.state && r.state.players, board:r.state && r.state.board, match_id:r.match_id, finished:r.finished, raw:r })); }
  async function mergeViews(byTargetMeta, byPlayerMeta, idToName){
    const counts = { wrRows:0, pbRows:0, wrError:'', pbError:'' };
    let snap = null;
    try{
      snap = (typeof __sqEnsureV2PBWR === 'function') ? await __sqEnsureV2PBWR() : null;
    }catch(e){
      const msg = String(e && (e.message || e) || '');
      counts.wrError = msg;
      counts.pbError = msg;
    }
    if (!snap || !snap.wrByRound || !snap.pbByBucket){
      const msg = counts.wrError || 'Clean PB/WR snapshot unavailable';
      counts.wrError = msg;
      counts.pbError = counts.pbError || msg;
      return counts;
    }
    try{
      snap.wrByRound.forEach((value, rawKey) => {
        const k = roundKey(rawKey, null);
        const val = Number(value || 0);
        if (!k || !(val > 0)) return;
        counts.wrRows++;
        maybeSet(byTargetMeta, k, { val, player:'', darts:'', game_id:null, ridx:null, ts:null });
      });
    }catch(e){
      counts.wrError = String(e && (e.message || e) || '');
    }
    try{
      snap.pbByBucket.forEach((roundMap, bucketRaw) => {
        const bucket = String(bucketRaw || '').trim();
        if (!roundMap || typeof roundMap.forEach !== 'function') return;
        roundMap.forEach((value, rawKey) => {
          const k = roundKey(rawKey, null);
          const val = Number(value || 0);
          if (!k || !(val > 0)) return;
          counts.pbRows++;
          const name = idToName.get(bucket) || bucket;
          const meta = { val, player:name, darts:'', game_id:null, ridx:null, ts:null };
          maybeSetPlayer(byPlayerMeta, norm(name), k, meta);
          if (bucket) maybeSetPlayer(byPlayerMeta, norm(bucket), k, meta);
        });
      });
    }catch(e){
      counts.pbError = String(e && (e.message || e) || '');
    }
    return counts;
  }
  async function mergeGames(byTargetMeta, byPlayerMeta, savedPlayers){ const savedNames = new Set((savedPlayers || []).map(p => norm(p && p.name)).filter(Boolean)); const games = await getGamesSafe(); let usedGames = 0, usedRows = 0; for (const g of (games || [])){ const ps = normalisePlayers(g); const board = normaliseBoard(g); if (!Array.isArray(ps) || ps.length < 1 || !Array.isArray(board)) continue; if (!(g.match_id || ps.length >= 2)) continue; usedGames++; for (let pi=0; pi<ps.length; pi++){ const name = String(ps[pi]?.name || ps[pi]?.player || ps[pi]?.display_name || '').trim(); if (!name) continue; const nk = norm(name); if (savedNames.size && !savedNames.has(nk)) continue; const rounds = rowsForPlayer(board, pi); if (!Array.isArray(rounds)) continue; for (let ri=0; ri<14; ri++){ const k = roundFromIndex(ri); const ent = rounds[ri]; const val = roundTotal(ent); if (!k || !(val > 0)) continue; usedRows++; const meta = { val, player:name, darts:darts(ent), game_id:g.id || g.game_id || null, ridx:ri, ts:g.ts || g.created_at || null }; maybeSet(byTargetMeta, k, meta); maybeSetPlayer(byPlayerMeta, nk, k, meta); } } } return { games:(games || []).length, usedGames, usedRows, playerKeys:byPlayerMeta.size }; }
  window.getPBGRSnapshot = async function getPBGRSnapshot(){ try{ if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) return { byTargetMeta:{}, byPlayerMeta:new Map() }; const savedPlayers = await getSavedPlayersSafe(); const idToName = new Map(); const nameToId = new Map(); for (const p of (savedPlayers || [])){ const name = String(p && p.name || '').trim(); const id = String((p && (p.id || p.player_id || p.bucket_key || p.bucketKey)) || '').trim(); if (name && id){ idToName.set(id, name); nameToId.set(norm(name), id); } } window.__v2PBWRNameToBucket = nameToId; const byTargetMeta = {}; const byPlayerMeta = new Map(); const viewCounts = await mergeViews(byTargetMeta, byPlayerMeta, idToName).catch(e => ({ wrRows:0, pbRows:0, wrError:String(e && (e.message || e)), pbError:String(e && (e.message || e)) })); const gameCounts = await mergeGames(byTargetMeta, byPlayerMeta, savedPlayers).catch(e => ({ games:0, usedGames:0, usedRows:0, error:String(e && (e.message || e)) })); try{ window.__sqPBGRAdminLastCounts = Object.assign({}, viewCounts, { playerKeys:byPlayerMeta.size }); }catch(_){} try{ window.__sqPBGRAdminLastFallback = gameCounts; }catch(_){} return { byTargetMeta, byPlayerMeta }; }catch(e){ console.warn('[SQ] PBGR Admin merged snapshot failed:', e && (e.message || e)); try{ window.__sqPBGRAdminLastError = e && (e.message || String(e)); }catch(_){} return { byTargetMeta:{}, byPlayerMeta:new Map() }; } };
  window.refreshPBGRCloud = async function refreshPBGRCloud(){ window.__v2PBWRSnapshot = null; window.__v2PBWRSnapshotPromise = null; window.__pbgrSnapshot = null; window.__pbgrSnapshotPromise = null; await window.getPBGRSnapshot(); try{ if (typeof window.updatePBGRBadges === 'function') await window.updatePBGRBadges(); }catch(_){} return true; };
})();
// <<< PATCH:PBGR_ADMIN_ALWAYS_MERGE_GAMES_V1 END
function __sqCleanupLeagueRankingsOverlays(){
  // Remove EVERY league sub-dialog backdrop before a new one opens, so a
  // lingering previous dialog can never flash under the incoming one.
  [
    '.sq-league-rankings-backdrop',
    '.sq-top50-backdrop',
    '.sq-top50-fix98-backdrop',
    '.sq-top50-fix99-backdrop',
    '.sq-fix100-top50',
    '.sq-fix166-top50',
    '.sq-hs-league-backdrop',
    '.sq-fix100-hsl',
    '.sq-streak-league-backdrop',
    '.sq132-bd',
    '.sq108-bd',
    '.sq136-pl-bd',
    '.sq-rhs-fix97-backdrop',
    '.sq-latest-scores-backdrop',
    '.sq-fix100-backdrop',
    '.sq-latest-matches-backdrop'
  ].forEach(function(sel){
    document.querySelectorAll(sel).forEach(function(n){ try{ n.remove(); }catch(_){} });
  });
}
try{ window.__sqCleanupLeagueRankingsOverlays = __sqCleanupLeagueRankingsOverlays; }catch(_){}

// High Score League — per-player best match score, rows clickable to open game
