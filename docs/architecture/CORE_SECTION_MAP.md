# SC-031 Core Section & Ownership Map

> Generated deterministically from the verified Phase 1 split. This is an engineering map, not product authority. Suggested ownership is heuristic and must be reviewed before moving code.

Generated from manifest schema 2; 47 JS blocks and 51 CSS blocks.

## Largest extracted assets

| File | Type | Bytes | Lines | Suggested owner | Original marker/id |
|---|---:|---:|---:|---|---|
| `src/legacy/scripts/inline-005.js` | JS | 1456428 | 34241 | live-game | — |
| `src/legacy/styles/inline-002.css` | CSS | 284342 | 7724 | live-game | — |
| `src/legacy/scripts/inline-007.js` | JS | 125007 | 1175 | live-game | — |
| `src/legacy/scripts/inline-039.js` | JS | 59451 | 956 | live-game | id="sq-fix166-top50-names-target-hit-heatmap-js" |
| `src/legacy/scripts/inline-008.js` | JS | 51497 | 1416 | league | — |
| `src/legacy/scripts/inline-026.js` | JS | 40294 | 672 | tournament | id="sq-fix97-league-ranks-turbo-tabs-js" |
| `src/legacy/scripts/inline-009.js` | JS | 29731 | 705 | player-stats | — |
| `src/legacy/scripts/inline-046.js` | JS | 28255 | 498 | tournament | — |
| `src/legacy/scripts/inline-014.js` | JS | 19632 | 399 | tournament | — |
| `src/legacy/styles/inline-003.css` | CSS | 18822 | 710 | live-game | — |
| `src/legacy/scripts/inline-044.js` | JS | 17991 | 342 | league | id="sq-fix169-power-rankings-current-clean-source-js" |
| `src/legacy/scripts/inline-028.js` | JS | 17942 | 190 | tournament | id="sq-fix100-league-ranks-format-js" |
| `src/legacy/styles/inline-013.css` | CSS | 16666 | 471 | live-game | id="sq-live-classic-stage1-css" |
| `src/legacy/scripts/inline-034.js` | JS | 13645 | 150 | tournament | id="sq-fix132-power-rankings-js" |
| `src/legacy/styles/inline-049.css` | CSS | 12257 | 138 | live-game | id="sq-training-css" |
| `src/legacy/scripts/inline-042.js` | JS | 11923 | 288 | league | id="sq-rankings-turbo-routing-fix-js" |
| `src/legacy/scripts/inline-035.js` | JS | 11693 | 66 | league | id="sq-fix136-premier-league-js" |
| `src/legacy/scripts/inline-018.js` | JS | 11648 | 35 | tournament | id="sq-fix83-tournament-bracket-js" |
| `src/legacy/scripts/inline-030.js` | JS | 11333 | 148 | live-game | id="sq-fix106-home-menu-stats-reset-js" |
| `src/legacy/styles/inline-048.css` | CSS | 9823 | 363 | tournament | id="sq-game-complete-arcade-css" |

## Core JavaScript (`inline-005.js`)

Size: **1,456,428 bytes**, **34,241 lines**.

### Section markers

| Line | Marker |
|---:|---|
| 2 | `@SEC:JS:BOOT` |
| 899 | `@SEC:JS:UTIL` |
| 4923 | `@SEC:JS:STATE` |
| 6213 | `@SEC:JS:UI:ROUTER` |
| 12873 | `@SEC:JS:GAME:LIVEV2` |
| 16714 | `@SEC:JS:GAME:ENGINE` |
| 20100 | `@SEC:JS:CLOUD` |
| 21735 | `@SEC:JS:LEGACY:QUARANTINE` |
| 24723 | `@SEC:JS:MODALS` |
| 32624 | `@SEC:JS:LEGACY:QUARANTINE` |

### Critical runtime anchors

| Line | Anchor |
|---:|---|
| 1089 | `const { data, error } = await sb.from(TABLE_GAMES).select('state').eq('id', gameId).single();` |
| 1114 | `.from(TABLE_GAMES)` |
| 1328 | `const { data: gRows, error: gErr } = await sb.from(TABLE_GAMES)` |
| 1385 | `await sb.from(TABLE_GAMES).update({` |
| 2812 | `.from(TABLE_GAMES)` |
| 2838 | `const { error: uErr } = await sb.from(TABLE_GAMES).update({ state: nextState }).eq('id', row.id);` |
| 4240 | `sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);` |
| 4289 | `const TABLE_GAMES   = "games";` |
| 4290 | `const TABLE_MATCHES = "matches";` |
| 4551 | `.from(TABLE_GAMES)` |
| 5829 | `try{ window.sqDmdShowZones?.({ z2:'MISS' },{type:'flash',ms:650}); }catch(_){ }` |
| 5832 | `try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); }catch(_){ }` |
| 5878 | `try{ window.sqDmdShowZones?.({ z2:'MISS' },{type:'flash',ms:650}); }catch(_){ }` |
| 5882 | `try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); }catch(_){ }` |
| 6026 | `try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); }catch(_){ }` |
| 6048 | `try{ window.sqDmdShowZones?.({ z2:'SKIP' },{type:'flash',ms:650}); }catch(_){ }` |
| 6236 | `function show(id){` |
| 6999 | `* One-time backfill: rebuild high-score rows from TABLE_GAMES.` |
| 7025 | `.from(TABLE_GAMES)` |
| 7396 | `const { error } = await sb.from(TABLE_MATCHES).upsert(payload);` |
| 7501 | `.from(TABLE_GAMES)` |
| 7524 | `.from(TABLE_GAMES)` |
| 7716 | `.from(TABLE_MATCHES)` |
| 8940 | `try{ window.sqDmdShowZones?.({ z2:'SHADOW PAUSED', z3:'PHASE 2C' }, { type:'flash', ms:900, fx:'impact', z3Small:true }); }catch(_){ }` |
| 9465 | `window.sqDmdShowZones?.({ z2:realName, z3:'' }, { type:'hold', ms:1 });` |
| 9644 | `if (!window.sqDmdShowZones) return false;` |
| 9654 | `window.sqDmdShowZones({ z2:'', z3:'' }, { type:o.imageType, ms:Number(o.imageMs \|\| 900), amp:Number(o.amp \|\| 3.0) });` |
| 9657 | `window.sqDmdShowZones({ z2:words[0], z3:'' }, { type:'flash', ms:finalHoldMs, fx:'impact' });` |
| 9659 | `window.sqDmdShowZones({ z2:words[0], z3:'' }, { type:'flash', ms:stepMs, fx:'impact' });` |
| 9660 | `window.sqDmdShowZones({ z2:words[0], z3:words[1] }, { type:'flash', ms:finalHoldMs, fx:'impact' });` |
| 9662 | `window.sqDmdShowZones({ z2:words[0], z3:'' }, { type:'flash', ms:stepMs, fx:'impact' });` |
| 9663 | `window.sqDmdShowZones({ z2:words.slice(0, -1).join(' '), z3:'' }, { type:'flash', ms:stepMs, fx:'impact' });` |
| 9664 | `window.sqDmdShowZones({ z2:words.slice(0, -1).join(' '), z3:words[words.length - 1] }, { type:'flash', ms:finalHoldMs, fx:'impact' });` |
| 9666 | `window.sqDmdShowZones({ z2:restoreZ2, z3:restoreZ3 }, { type:'hold', ms:1 });` |
| 9739 | `if (!window.sqDmdShowZones) return;` |
| 9752 | `window.sqDmdShowZones({ z1, z2:(callout && callout.z2) \|\| 'SINGLE', z3:seq }, (callout && callout.fx) \|\| { type:'flash', ms:650, fx:'impact' });` |
| 9808 | `if (!window.sqDmdShowZones) return;` |
| 9810 | `window.sqDmdShowZones({ z2:'ROUND SCORE', z3:String(Number(roundTotal \|\| 0)), z3Small:true, type:'roll' }, { type:'flash', ms:650, fx:'impact' });` |
| 9819 | `window.sqDmdShowZones?.({ z2:realName, z3:'' }, { type:'hold', ms:1 });` |
| 10182 | `try{ window.sqDmdShowZones?.({ z2:'UNDO', z3:'REAL DART 3' }, { type:'wipe', dir:'rev', ms:420, revealMs:120, z3Small:true }); }catch(_){ }` |
| 10340 | `const table = (typeof TABLE_GAMES !== 'undefined' && TABLE_GAMES) ? TABLE_GAMES : 'games';` |
| 10403 | `const table = (typeof TABLE_GAMES !== 'undefined' && TABLE_GAMES) ? TABLE_GAMES : 'games';` |
| 13807 | `function buildPad(){` |
| 13911 | `window.sqDmdShowZones?.({ z2: label, z3, z3Small:true }, { type:'flash', ms:260, fx:'impact' });` |
| 14032 | `window.sqDmdShowZones?.({ z2: label, z3, z3Small:true }, { type:'flash', ms:260, fx:'impact' });` |
| 14088 | `actions.appendChild(mkAct('undo', '◀◀', 'UNDO', () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400` |
| 14092 | `try{ window.sqDmdShowZones?.({ z2:'SKIP GO', z3:'>>>' }, { type:'flash', ms:500, fx:'impact' }); }catch(_){ }` |
| 14190 | `actions.appendChild(mkAct('undo', '◀◀', 'UNDO', () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400` |
| 14194 | `try{ window.sqDmdShowZones?.({ z2:'SKIP GO', z3:'>>>' }, { type:'flash', ms:500, fx:'impact' }); }catch(_){ }` |
| 14282 | `actions.appendChild(mkAct('undo', '◀◀', 'UNDO', () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } try{ window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400` |
| 14286 | `try{ window.sqDmdShowZones?.({ z2:'SKIP GO', z3:'>>>' }, { type:'flash', ms:500, fx:'impact' }); }catch(_){ }` |
| 16716 | `function recordThrow(spec){` |
| 16946 | `if (!window.sqDmdShowZones) return false;` |
| 16962 | `window.sqDmdShowZones({ z2:'', z3:'' }, { type: opts.imageType, ms: Number(opts.imageMs \|\| 900), amp: Number(opts.amp \|\| 3.0) });` |
| 16966 | `window.sqDmdShowZones({ z2: words[0], z3:'' }, { type:'flash', ms: finalHoldMs, fx:'impact' });` |
| 16968 | `window.sqDmdShowZones({ z2: words[0], z3:'' }, { type:'flash', ms: stepMs, fx:'impact' });` |
| 16969 | `window.sqDmdShowZones({ z2: words[0], z3: words[1] }, { type:'flash', ms: finalHoldMs, fx:'impact' });` |
| 16971 | `window.sqDmdShowZones({ z2: words[0], z3:'' }, { type:'flash', ms: stepMs, fx:'impact' });` |
| 16972 | `window.sqDmdShowZones({ z2: words.slice(0, -1).join(' '), z3:'' }, { type:'flash', ms: stepMs, fx:'impact' });` |
| 16973 | `window.sqDmdShowZones({ z2: words.slice(0, -1).join(' '), z3: words[words.length - 1] }, { type:'flash', ms: finalHoldMs, fx:'impact' });` |
| 16977 | `window.sqDmdShowZones({ z2: rz2, z3: rz3 }, { type:'hold', ms: 1 });` |
| 17090 | `if (window.sqDmdShowZones) {` |
| 17098 | `window.sqDmdShowZones({ z1, z2, z3: (window.__sqDmdBulkMiss ? '' : seq) }, fx);` |
| 17231 | `window.sqDmdShowZones?.({ z2: 'ROUND SCORE', z3: String(roundTotal), z3Small:true, type:'roll' }, { type:'flash', ms:650, fx:'impact' });` |
| 17239 | `window.sqDmdShowZones?.({ z2: `ROUND ${currLbl}`, z3:'COMPLETE', z3Small:true, type:'roll' }, { type:'flash', ms:720, fx:'smear' });` |
| 17245 | `window.sqDmdShowZones?.({ z2: `NEXT UP.. ${nextLbl}`, z3:'' }, { type:'flash', ms:760, fx:'smear' });` |
| 17251 | `window.sqDmdShowZones?.({ z2: nextName, z3:'TO THROW FIRST' }, { type:'wipe', ms:820, fx:'impact', z3Small:true });` |
| 17257 | `window.sqDmdShowZones?.({ z2: nextName, z3:'' }, { type:'hold', ms:1 });` |
| 17264 | `window.sqDmdShowZones?.({ z2: 'NEXT UP', z3:'' }, { type:'flash', ms:620, fx:'smear' });` |
| 17270 | `window.sqDmdShowZones?.({ z2: nextName, z3:'' }, { type:'hold', ms:1 });` |
| 17279 | `} else if (window.sqDmdShow) {` |
| 17280 | `window.sqDmdShow(z2, seq, fx);` |
| 17331 | `try { window.sqDmdSetIdle && window.sqDmdSetIdle(""); } catch(_){}` |
| 17336 | `window.sqDmdShowZones?.({ z2: _name, z3: first }, { type:'hold', ms:1, z3Small:true });` |
| 17352 | `try{ window.sqDmdShowZones?.({ z2: (_showNick ? _nick : _full) \|\| _name }, { type:'hold', ms:1 }); }catch(_){ }` |
| 17355 | `window.sqDmdShowZones?.({ z3: _lines[_i] }, { type:'roll', ms:520, z3Small:true });` |
| 17588 | `try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'' }, {type:'flash', ms:180, fx:'pop'}); }catch(_){}` |
| 17589 | `setTimeout(()=>{ try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'X' }, {type:'flash', ms:140, fx:'pop'}); }catch(_){ } }, 90);` |
| 17590 | `setTimeout(()=>{ try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'X / X' }, {type:'flash', ms:160, fx:'pop'}); }catch(_){ } }, 170);` |
| 17591 | `setTimeout(()=>{ try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'X / X / X' }, {type:'flash', ms:200, fx:'pop'}); }catch(_){ } }, 260);` |
| 17599 | `try{ window.sqDmdShowZones?.({ z2:'MISS', z3:'' }, { type:'flash', ms:220, fx:'pop' }); }catch(_){ }` |
| 17790 | `await sb.from(TABLE_MATCHES).upsert(practiceMatchPayload);` |
| 17828 | `const { data: _gRow, error } = await sb.from(TABLE_GAMES).insert(payload).select('id, created_at').single();` |
| 17850 | `const cleanup = await sb.from(TABLE_MATCHES).delete().eq('id', __sqVsShadowPracticeMatchCleanupId);` |
| 17938 | `try{ window.sqDmdShowZones?.({ z2:'SAVE FAILED', z3:'RETRY FINISH' }, { type:'flash', ms:1200, fx:'impact', z3Small:true }); }catch(_){ }` |
| 19246 | `.from(TABLE_GAMES)` |
| 19932 | `// Practice tab must reflect actual games only (TABLE_GAMES):` |
| 20054 | `const { error } = await sb.from(TABLE_GAMES).delete().eq('id', gameId);` |
| 20059 | `const { error } = await sb.from(TABLE_GAMES).delete().eq('created_at', ts);` |
| 20065 | `const { error } = await sb.from(TABLE_GAMES).delete().gte('created_at', fromIso).lte('created_at', toIso);` |
| 20121 | `window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);` |
| 20163 | `{ name: T('TABLE_GAMES', 'games'), kind: 'table', usedBy: ['cloudFetch*Games', 'getGamesForMode', 'de-dupe'] },` |
| 20164 | `{ name: T('TABLE_MATCHES', 'matches'), kind: 'table', usedBy: ['cloudFetchAllMatchesAsLocal', 'getMatchesOfficial'] },` |
| 20326 | `const { error } = await sb.from(TABLE_GAMES).update({ archived_at: new Date().toISOString() }).eq('id', gid);` |
| 20340 | `const { error } = await sb.from(TABLE_GAMES).update({ archived_at: null }).eq('id', gid);` |
| 20373 | `const { error: delErr } = await sb.from(TABLE_GAMES).delete().eq('id', gid);` |
| 20388 | `{ kind:'table', name: (typeof TABLE_GAMES!=='undefined'?TABLE_GAMES:'games'), usedBy:['cloudFetch*','getGamesForMode'], required:true },` |
| 20389 | `{ kind:'table', name: (typeof TABLE_MATCHES!=='undefined'?TABLE_MATCHES:'matches'), usedBy:['cloudFetchAllMatchesAsLocal','getMatchesOfficial'], required:true },` |
| 21192 | `.from(TABLE_GAMES)` |
| 21251 | `if (typeof TABLE_GAMES !== 'undefined') {` |
| 21260 | `const { error } = await sb.from(TABLE_GAMES).insert(payload);` |
| 21265 | `const { error } = await sb.from(TABLE_GAMES).upsert(payload);` |
| 21311 | `if (typeof TABLE_MATCHES === 'undefined') return { inserted: 0, scanned: matches.length };` |
| 21324 | `const { error } = await sb.from(TABLE_MATCHES).insert(payload);` |
| 21328 | `const { error } = await sb.from(TABLE_MATCHES).upsert(payload);` |
| 22352 | `const gTable = (typeof TABLE_GAMES !== 'undefined' ? TABLE_GAMES : 'games');` |
| 23151 | `const table = (typeof TABLE_MATCHES !== 'undefined' && TABLE_MATCHES) ? TABLE_MATCHES : 'matches';` |
| 24988 | `const SB = (typeof window !== 'undefined') ? (window.sb \|\| window.__sb \|\| window.supabase \|\| window.supabaseClient \|\| null) : null;` |
| 25291 | `\|\| typeof TABLE_GAMES === 'undefined'` |
| 25383 | `.from(TABLE_GAMES)` |
| 26981 | `const SB = window.sb \|\| window.__sb \|\| null;` |
| 27127 | `const SB = window.sb \|\| window.__sb \|\| null;` |
| 27171 | `const SB = window.sb \|\| window.__sb \|\| null;` |
| 27192 | `const SB = window.sb \|\| window.__sb \|\| null;` |
| 27227 | `const SB = window.sb \|\| window.__sb \|\| null;` |
| 27330 | `const SB = window.sb \|\| window.__sb \|\| null;` |
| 27373 | `const SB = window.sb \|\| window.__sb \|\| null;` |
| 27488 | `const SB = window.sb \|\| window.__sb \|\| null;` |
| 27939 | `const SB = (typeof window !== 'undefined') ? (window.sb \|\| window.__sb \|\| window.supabase \|\| window.supabaseClient \|\| null) : null;` |
| 29324 | `const table = (typeof TABLE_GAMES !== 'undefined' ? TABLE_GAMES : 'games');` |
| 29736 | `const gTable = (typeof TABLE_GAMES !== 'undefined' ? TABLE_GAMES : 'games');` |
| 29760 | `// 2) Fallback: derive from games table (TABLE_GAMES) so UI still works during migrations.` |
| 29763 | `const table = (typeof TABLE_GAMES !== 'undefined' ? TABLE_GAMES : 'games');` |
| 32804 | `.from(TABLE_GAMES)` |
| 32823 | `.from(TABLE_GAMES)` |

## Core CSS (`inline-002.css`)

Size: **284,342 bytes**, **7,724 lines**.

### Section markers

_No @SEC markers found._

## Extracted JavaScript ownership inventory

| Order | File | Bytes | Lines | Suggested owner | Original marker/id | @SEC markers |
|---:|---|---:|---:|---|---|---|
| 1 | `src/legacy/scripts/inline-001.js` | 8619 | 267 | live-game | — | — |
| 2 | `src/legacy/scripts/inline-002.js` | 190 | 6 | review-required | — | — |
| 3 | `src/legacy/scripts/inline-003.js` | 2205 | 67 | live-game | id="sq-fix16-b3-dots-race-padfx-js" | — |
| 4 | `src/legacy/scripts/inline-004.js` | 2072 | 48 | live-game | id="sq-fix17-padfx-stronger-js" | — |
| 5 | `src/legacy/scripts/inline-005.js` | 1456428 | 34241 | live-game | — | @SEC:JS:BOOT, @SEC:JS:UTIL, @SEC:JS:STATE, @SEC:JS:UI:ROUTER, @SEC:JS:GAME:LIVEV2, @SEC:JS:GAME:ENGINE, @SEC:JS:CLOUD, @SEC:JS:LEGACY:QUARANTINE, @SEC:JS:MODALS, @SEC:JS:LEGACY:QUARANTINE |
| 6 | `src/legacy/scripts/inline-006.js` | 8209 | 217 | live-game | — | — |
| 7 | `src/legacy/scripts/inline-007.js` | 125007 | 1175 | live-game | — | @SEC:JS:LEGACY:QUARANTINE |
| 8 | `src/legacy/scripts/inline-008.js` | 51497 | 1416 | league | — | — |
| 9 | `src/legacy/scripts/inline-009.js` | 29731 | 705 | player-stats | — | — |
| 10 | `src/legacy/scripts/inline-010.js` | 1582 | 45 | league | — | — |
| 11 | `src/legacy/scripts/inline-011.js` | 3811 | 38 | review-required | — | — |
| 12 | `src/legacy/scripts/inline-012.js` | 654 | 15 | review-required | — | — |
| 13 | `src/legacy/scripts/inline-013.js` | 2925 | 30 | review-required | — | — |
| 14 | `src/legacy/scripts/inline-014.js` | 19632 | 399 | tournament | — | — |
| 15 | `src/legacy/scripts/inline-015.js` | 2396 | 45 | live-game | — | — |
| 16 | `src/legacy/scripts/inline-016.js` | 7663 | 139 | live-game | id="sq-fix76-turbo-20sec-timer-js" | — |
| 17 | `src/legacy/scripts/inline-017.js` | 3727 | 17 | live-game | id="sq-fix77-turbo-timer-race-rows-js" | — |
| 18 | `src/legacy/scripts/inline-018.js` | 11648 | 35 | tournament | id="sq-fix83-tournament-bracket-js" | — |
| 19 | `src/legacy/scripts/inline-019.js` | 1400 | 33 | live-game | — | — |
| 20 | `src/legacy/scripts/inline-020.js` | 3742 | 90 | review-required | — | — |
| 21 | `src/legacy/scripts/inline-021.js` | 680 | 13 | review-required | — | — |
| 22 | `src/legacy/scripts/inline-022.js` | 8893 | 131 | live-game | id="sq-fix78-turbo-hs-startrows-js" | — |
| 23 | `src/legacy/scripts/inline-023.js` | 4313 | 66 | tournament | — | — |
| 24 | `src/legacy/scripts/inline-024.js` | 6346 | 20 | live-game | id="sq-fix90-tournament-ui-js" | — |
| 25 | `src/legacy/scripts/inline-025.js` | 4831 | 22 | live-game | id="sq-fix95-missx3-js" | — |
| 26 | `src/legacy/scripts/inline-026.js` | 40294 | 672 | tournament | id="sq-fix97-league-ranks-turbo-tabs-js" | — |
| 27 | `src/legacy/scripts/inline-027.js` | 8587 | 61 | tournament | id="sq-fix99-top50-practice-js" | — |
| 28 | `src/legacy/scripts/inline-028.js` | 17942 | 190 | tournament | id="sq-fix100-league-ranks-format-js" | — |
| 29 | `src/legacy/scripts/inline-029.js` | 5071 | 79 | league | — | — |
| 30 | `src/legacy/scripts/inline-030.js` | 11333 | 148 | live-game | id="sq-fix106-home-menu-stats-reset-js" | — |
| 31 | `src/legacy/scripts/inline-031.js` | 3920 | 103 | practice | id="sq-fix120-practice-pb-compare-force-style-js" | — |
| 32 | `src/legacy/scripts/inline-032.js` | 7087 | 163 | live-game | id="sq-fix126-practice-geometry-lock-js" | — |
| 33 | `src/legacy/scripts/inline-033.js` | 7426 | 164 | setup | id="sq-fix129-player-select-dedupe-js" | — |
| 34 | `src/legacy/scripts/inline-034.js` | 13645 | 150 | tournament | id="sq-fix132-power-rankings-js" | — |
| 35 | `src/legacy/scripts/inline-035.js` | 11693 | 66 | league | id="sq-fix136-premier-league-js" | — |
| 36 | `src/legacy/scripts/inline-036.js` | 7723 | 39 | tournament | id="sq-fix146-pl-fast-top50-tabs-canonical-js" | — |
| 37 | `src/legacy/scripts/inline-037.js` | 4559 | 121 | league | id="sq-fix153-mot-cache-modal-guard-js" | — |
| 38 | `src/legacy/scripts/inline-038.js` | 4974 | 131 | league | — | — |
| 39 | `src/legacy/scripts/inline-039.js` | 59451 | 956 | live-game | id="sq-fix166-top50-names-target-hit-heatmap-js" | — |
| 40 | `src/legacy/scripts/inline-040.js` | 6237 | 163 | live-game | id="sq-fix167-gameplay-perf-mot-js" | — |
| 41 | `src/legacy/scripts/inline-041.js` | 8027 | 162 | tournament | id="sq-fix168-mode-classification-turbo-guard-js" | — |
| 42 | `src/legacy/scripts/inline-042.js` | 11923 | 288 | league | id="sq-rankings-turbo-routing-fix-js" | — |
| 43 | `src/legacy/scripts/inline-043.js` | 1370 | 37 | tournament | id="sq-start-tournament-route-blocker-guard-v2" | — |
| 44 | `src/legacy/scripts/inline-044.js` | 17991 | 342 | league | id="sq-fix169-power-rankings-current-clean-source-js" | — |
| 45 | `src/legacy/scripts/inline-045.js` | 5048 | 107 | tournament | id="sq-fix170-decider-leaderboard-confirm-js" | — |
| 46 | `src/legacy/scripts/inline-046.js` | 28255 | 498 | tournament | — | — |
| 47 | `src/legacy/scripts/inline-047.js` | 1720 | 28 | live-game | — | — |

## Extracted CSS ownership inventory

| Order | File | Bytes | Lines | Suggested owner | Original marker/id | @SEC markers |
|---:|---|---:|---:|---|---|---|
| 1 | `src/legacy/styles/inline-001.css` | 7607 | 264 | live-game | id="sq-critical-css" | — |
| 2 | `src/legacy/styles/inline-002.css` | 284342 | 7724 | live-game | — | — |
| 3 | `src/legacy/styles/inline-003.css` | 18822 | 710 | live-game | — | — |
| 4 | `src/legacy/styles/inline-004.css` | 4017 | 150 | ui | — | — |
| 5 | `src/legacy/styles/inline-005.css` | 398 | 12 | review-required | — | — |
| 6 | `src/legacy/styles/inline-006.css` | 208 | 6 | live-game | id="sq-hotfix-v53" | — |
| 7 | `src/legacy/styles/inline-007.css` | 4805 | 152 | live-game | id="sq-mot-stage4-layout-v1" | — |
| 8 | `src/legacy/styles/inline-008.css` | 4077 | 81 | live-game | id="sq-fix16-b3-dots-race-padfx-css" | — |
| 9 | `src/legacy/styles/inline-009.css` | 2305 | 30 | live-game | id="sq-fix17-padfx-stronger-css" | — |
| 10 | `src/legacy/styles/inline-010.css` | 565 | 18 | live-game | id="sq-fix19-race-single-box-css" | — |
| 11 | `src/legacy/styles/inline-011.css` | 384 | 12 | live-game | id="sq-fix21-race-chart-geometry-css" | — |
| 12 | `src/legacy/styles/inline-012.css` | 597 | 10 | practice | id="sq-fix71-practice-game-type-menu" | — |
| 13 | `src/legacy/styles/inline-013.css` | 16666 | 471 | live-game | id="sq-live-classic-stage1-css" | — |
| 14 | `src/legacy/styles/inline-014.css` | 191 | 8 | league | id="sq-fix48-h2h-single-sorted-league-css" | — |
| 15 | `src/legacy/styles/inline-015.css` | 3531 | 32 | tournament | id="sq-fix85-tournament-shared-styles" | — |
| 16 | `src/legacy/styles/inline-016.css` | 1178 | 13 | live-game | id="sq-fix76-turbo-20sec-timer-css" | — |
| 17 | `src/legacy/styles/inline-017.css` | 1570 | 11 | live-game | id="sq-fix77-turbo-timer-race-rows-css" | — |
| 18 | `src/legacy/styles/inline-018.css` | 2204 | 32 | live-game | id="sq-fix83-tournament-bracket-css" | — |
| 19 | `src/legacy/styles/inline-019.css` | 562 | 15 | live-game | id="sq-fix40-b3-page-order-css" | — |
| 20 | `src/legacy/styles/inline-020.css` | 1344 | 32 | live-game | id="sq-fix41-evening-css" | — |
| 21 | `src/legacy/styles/inline-021.css` | 2008 | 42 | live-game | id="sq-fix42-pad-format-layout-clearance" | — |
| 22 | `src/legacy/styles/inline-022.css` | 819 | 13 | live-game | id="sq-fix78-turbo-hs-startrows-css" | — |
| 23 | `src/legacy/styles/inline-023.css` | 2703 | 23 | tournament | id="sq-fix86-tournament-tree-decider-back-css" | — |
| 24 | `src/legacy/styles/inline-024.css` | 622 | 8 | tournament | id="sq-fix90-tournament-ui-css" | — |
| 25 | `src/legacy/styles/inline-025.css` | 1901 | 8 | live-game | id="sq-fix95-missx3-css" | — |
| 26 | `src/legacy/styles/inline-026.css` | 1383 | 13 | league | id="sq-fix97-league-turbo-tabs-css" | — |
| 27 | `src/legacy/styles/inline-027.css` | 180 | 3 | league | id="sq-fix99-top50-practice-css" | — |
| 28 | `src/legacy/styles/inline-028.css` | 3582 | 31 | league | id="sq-fix100-league-ranks-format-css" | — |
| 29 | `src/legacy/styles/inline-029.css` | 7659 | 59 | live-game | id="sq-fix106-home-menu-stats-reset-css" | — |
| 30 | `src/legacy/styles/inline-030.css` | 1483 | 33 | live-game | id="sq-fix112-practice-round-pb-cell-grey-css" | — |
| 31 | `src/legacy/styles/inline-031.css` | 274 | 8 | live-game | id="sq-fix114-practice-pb-score-smaller-css" | — |
| 32 | `src/legacy/styles/inline-032.css` | 1749 | 32 | live-game | id="sq-fix115-practice-score-beats-pb-green-text-css" | — |
| 33 | `src/legacy/styles/inline-033.css` | 2520 | 22 | live-game | id="sq-fix118-practice-pb-compare-safe-css" | — |
| 34 | `src/legacy/styles/inline-034.css` | 501 | 14 | practice | id="sq-fix120-practice-pb-compare-force-style-css" | — |
| 35 | `src/legacy/styles/inline-035.css` | 188 | 4 | live-game | id="sq-fix122-practice-start-row-anchor-css" | — |
| 36 | `src/legacy/styles/inline-036.css` | 2916 | 83 | live-game | id="sq-fix126-practice-geometry-lock-css" | — |
| 37 | `src/legacy/styles/inline-037.css` | 762 | 22 | live-game | id="sq-fix127-practice-live-row-separator-css" | — |
| 38 | `src/legacy/styles/inline-038.css` | 1968 | 42 | live-game | id="sq-fix130-practice-completed-pill-room-css" | — |
| 39 | `src/legacy/styles/inline-039.css` | 188 | 4 | live-game | id="sq-fix131-matchplay-start-row-anchor-css" | — |
| 40 | `src/legacy/styles/inline-040.css` | 3688 | 26 | league | id="sq-fix132-power-rankings-css" | — |
| 41 | `src/legacy/styles/inline-041.css` | 2675 | 3 | league | id="sq-fix136-premier-league-css" | — |
| 42 | `src/legacy/styles/inline-042.css` | 117 | 3 | league | id="sq-fix146-pl-top50-css" | — |
| 43 | `src/legacy/styles/inline-043.css` | 3218 | 57 | league | id="sq-fix168-top50-hit-ownership-css" | — |
| 44 | `src/legacy/styles/inline-044.css` | 1667 | 28 | tournament | id="sq-fix170-match-leaderboard-actions-css" | — |
| 45 | `src/legacy/styles/inline-045.css` | 5965 | 154 | tournament | id="sq-fix171-leaderboard-bracket-visual-css" | — |
| 46 | `src/legacy/styles/inline-046.css` | 5006 | 128 | tournament | id="sq-fix172-tournament-mode-card-css" | — |
| 47 | `src/legacy/styles/inline-047.css` | 4591 | 166 | league | id="sq-home-arcade-start-hero-css" | — |
| 48 | `src/legacy/styles/inline-048.css` | 9823 | 363 | tournament | id="sq-game-complete-arcade-css" | — |
| 49 | `src/legacy/styles/inline-049.css` | 12257 | 138 | live-game | id="sq-training-css" | — |
| 50 | `src/legacy/styles/inline-050.css` | 518 | 16 | live-game | id="sq-live-classic-stage2-b3-css" | — |
| 51 | `src/legacy/styles/inline-051.css` | 374 | 12 | live-game | id="sq-classic-viewport-fit" | — |

## Phase 2 rules derived from this map

- Preserve current document/script order until an explicit module boundary has regression proof.
- Do not merge unrelated patch fragments merely because their suggested owner matches.
- Split the two core assets only at verified section boundaries; inspect cross-boundary globals before each move.
- Keep current public/global function names and DOM/CSS hooks until all callers have migrated.
- Run the full applicable smoke/regression gate after every material domain slice.
- The target is semantic ownership with a small number of durable files, not one file per historic hotfix.

