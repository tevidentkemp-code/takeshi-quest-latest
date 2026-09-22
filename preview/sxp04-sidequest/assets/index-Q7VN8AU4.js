//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
//#endregion
//#region src/live-game/tv-mode.js
(function() {
	"use strict";
	var ROOT_ID = "sqTvModeOverlay";
	var timer = 0;
	function esc(v) {
		return String(v == null ? "" : v).replace(/[&<>"']/g, function(ch) {
			return {
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				"\"": "&quot;",
				"'": "&#39;"
			}[ch];
		});
	}
	function gameState() {
		try {
			return typeof state !== "undefined" && state ? state : null;
		} catch (_) {
			return null;
		}
	}
	function playerName(p, i) {
		try {
			if (typeof __sqPlayerPretty === "function") {
				var pretty = __sqPlayerPretty(p);
				if (pretty) return pretty;
			}
		} catch (_) {}
		return String(p && (p.nickname || p.name || p.displayName || p.initials) || "PLAYER " + (i + 1)).trim();
	}
	function modeUnsupported(s) {
		if (!s || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 6) return "TV Mode currently supports 2–6 player games.";
		var m = s.match || {};
		var bag = [
			s.mode,
			s.gameMode,
			m.mode,
			m.gameMode,
			m.practiceType,
			m.gameVariant
		].map(function(v) {
			return String(v || "").toLowerCase();
		}).join(" ");
		if (m.forcePractice || m.isPractice || s.isPractice || bag.indexOf("practice") >= 0 || bag.indexOf("training") >= 0) return "TV Mode beta is currently Match Play only.";
		if (bag.indexOf("turbo") >= 0) return "TV Mode beta is currently Classic Match Play only.";
		return "";
	}
	function totalFor(s, p) {
		try {
			if (typeof totalScoreForPlayer === "function") return Number(totalScoreForPlayer(p) || 0);
		} catch (_) {}
		var rows = s.score && s.score[p] || [], t = 0;
		rows.forEach(function(e) {
			t += Number(e && e.roundTotal || 0);
		});
		return t;
	}
	function roundLabel(r) {
		try {
			var d = typeof ROUNDS !== "undefined" && ROUNDS ? ROUNDS[r] : null;
			if (!d) return String(r + 1);
			if (d.type === "number") return String(d.target);
			if (d.type === "doubles") return "D";
			if (d.type === "triples") return "T";
			if (d.type === "bull") return "B";
			return String(d.target || d.label || r + 1);
		} catch (_) {
			return String(r + 1);
		}
	}
	function hasDarts(e) {
		return !!(e && Array.isArray(e.darts) && e.darts.some(function(d) {
			return !!d;
		}));
	}
	function cumulative(s, p, r) {
		var rows = s.score && s.score[p] || [], t = 0, any = false;
		for (var i = 0; i <= r; i++) {
			var e = rows[i];
			if (hasDarts(e)) {
				any = true;
				t += Number(e.roundTotal || 0);
			}
		}
		return {
			value: t,
			any
		};
	}
	function roundScore(s, p, r) {
		var e = s.score && s.score[p] && s.score[p][r];
		return hasDarts(e) ? Number(e.roundTotal || 0) : null;
	}
	function avgPair(s, p) {
		var rows = s.score && s.score[p] || [], vals = [];
		rows.forEach(function(e) {
			if (hasDarts(e)) vals.push(Number(e.roundTotal || 0));
		});
		var game = vals.length ? vals.reduce(function(a, b) {
			return a + b;
		}, 0) / vals.length : 0;
		var last = vals.slice(-3);
		return {
			a3: last.length ? last.reduce(function(a, b) {
				return a + b;
			}, 0) / last.length : 0,
			game
		};
	}
	function dartToken(d) {
		if (!d) return "—";
		var k = String(d.kind || "").toUpperCase();
		if (k === "MISS") return "MISS";
		if (k === "B") return Number(d.points || d.score || d.value || 0) >= 50 ? "BULL 50" : "BULL 25";
		var sec = d.sector != null ? d.sector : "";
		if (k === "DOUBLE") k = "D";
		if (k === "TRIPLE") k = "T";
		if (k === "S" || k === "D" || k === "T") return k + sec;
		var pts = Number(d.points || d.score || d.value);
		return Number.isFinite(pts) ? String(pts) : k || "—";
	}
	function shell() {
		var root = document.getElementById(ROOT_ID);
		if (root) return root;
		root = document.createElement("section");
		root.id = ROOT_ID;
		root.className = "sq-tv-mode";
		root.setAttribute("aria-label", "Shateki Quest TV Mode");
		root.innerHTML = "<div class=\"sq-tv-rotate\">ROTATE DEVICE FOR TV MODE</div><header class=\"sq-tv-head\"><div class=\"sq-tv-brand\">SHATEKI<span>QUEST</span></div><div class=\"sq-tv-dmd\"><div id=\"sqTvDmdTop\"></div><strong id=\"sqTvDmdMain\"></strong><div id=\"sqTvDmdBottom\"></div></div><div class=\"sq-tv-avg\"><div><span>3R AVG</span><strong id=\"sqTvAvg3\">0.0</strong></div><div><span>GAME AVG</span><strong id=\"sqTvAvgGame\">0.0</strong></div></div><button class=\"sq-tv-exit\" id=\"sqTvExit\" type=\"button\">EXIT TV MODE</button></header><div class=\"sq-tv-players\" id=\"sqTvPlayers\"></div><main class=\"sq-tv-main\"><section class=\"sq-tv-table-card\"><div class=\"sq-tv-section-title\"><span>SCOREBOARD</span><span id=\"sqTvRoundMeta\"></span></div><div class=\"sq-tv-table-wrap\"><table class=\"sq-tv-table\"><thead id=\"sqTvThead\"></thead><tbody id=\"sqTvTbody\"></tbody></table></div></section><aside class=\"sq-tv-race-card\"><div class=\"sq-tv-section-title\"><span>GAME RACE</span><span id=\"sqTvRaceMeta\"></span></div><div class=\"sq-tv-race\" id=\"sqTvRace\"></div></aside></main><footer class=\"sq-tv-rail\"><div class=\"sq-tv-darts\" id=\"sqTvDarts\"></div><button class=\"sq-tv-action\" id=\"sqTvMenu\" type=\"button\">MENU</button><button class=\"sq-tv-action\" id=\"sqTvFull\" type=\"button\">FULLSCREEN</button></footer>";
		document.body.appendChild(root);
		root.querySelector("#sqTvExit").onclick = function() {
			disable();
		};
		root.querySelector("#sqTvMenu").onclick = function() {
			try {
				if (window.__sqOpenGameMenu106) window.__sqOpenGameMenu106();
			} catch (_) {}
		};
		root.querySelector("#sqTvFull").onclick = function() {
			try {
				if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
				else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
			} catch (_) {}
		};
		return root;
	}
	function syncPadClearance() {
		try {
			var pad = document.getElementById("padBar");
			var clearance = 0;
			if (pad) {
				var style = window.getComputedStyle(pad);
				var rect = pad.getBoundingClientRect();
				if (style.display !== "none" && style.visibility !== "hidden" && rect.height > 0 && rect.bottom > 0) clearance = Math.max(0, Math.ceil(window.innerHeight - rect.top));
			}
			document.documentElement.style.setProperty("--sq-tv-pad-h", clearance + "px");
			var root = document.getElementById(ROOT_ID);
			if (root) root.style.bottom = clearance + "px";
		} catch (_) {}
	}
	function render() {
		if (!document.body || document.body.dataset.page !== "game") {
			if (active()) disable();
			return;
		}
		syncPadClearance();
		var s = gameState();
		if (!s || !Array.isArray(s.players)) return;
		var root = document.getElementById(ROOT_ID);
		if (!root || !active()) return;
		var players = s.players, cp = Math.max(0, Math.min(players.length - 1, Number(s.currentPlayer) || 0));
		root.style.setProperty("--sq-tv-count", String(Math.max(2, Math.min(6, players.length))));
		var cr = Math.max(0, Number(s.currentRound) || 0), cd = Math.max(0, Math.min(2, Number(s.currentDart) || 0));
		var totals = players.map(function(_, i) {
			return totalFor(s, i);
		}), lead = totals.length ? Math.max.apply(null, totals) : 0;
		var wins = s.match && Array.isArray(s.match.wins) ? s.match.wins : [];
		var targetWins = Math.max(1, Number(s.match && s.match.targetWins) || 1);
		var roundCount = typeof MAX_ROUNDS === "number" && MAX_ROUNDS > 0 ? MAX_ROUNDS : 14;
		var curName = playerName(players[cp], cp).toUpperCase();
		var av = avgPair(s, cp);
		root.querySelector("#sqTvDmdTop").textContent = "ROUND " + roundLabel(cr) + "  •  DART " + (cd + 1) + " OF 3";
		root.querySelector("#sqTvDmdMain").textContent = curName + " TO THROW";
		root.querySelector("#sqTvDmdBottom").textContent = "CLASSIC MATCH PLAY  •  FIRST TO " + targetWins;
		root.querySelector("#sqTvAvg3").textContent = av.a3.toFixed(1);
		root.querySelector("#sqTvAvgGame").textContent = av.game.toFixed(1);
		root.querySelector("#sqTvRoundMeta").textContent = "ROUND " + (cr + 1) + " / " + roundCount;
		root.querySelector("#sqTvRaceMeta").textContent = "LEADER " + lead;
		root.querySelector("#sqTvPlayers").innerHTML = players.map(function(p, i) {
			var diff = totals[i] - lead, w = Math.max(0, Number(wins[i] || 0));
			return "<article class=\"sq-tv-player" + (i === cp ? " active" : "") + "\"><div class=\"sq-tv-player-name\">" + esc(playerName(p, i)) + "</div><div class=\"sq-tv-player-status\">" + (i === cp ? "NOW THROWING" : "WAITING") + "</div><div class=\"sq-tv-player-score\">" + totals[i] + " <small>" + (diff === 0 ? "LEAD" : diff) + "</small></div><div class=\"sq-tv-player-wins\">WINS " + w + "/" + targetWins + "</div></article>";
		}).join("");
		var visible = 6, start = Math.max(0, Math.min(Math.max(0, roundCount - visible), cr - 3));
		if (cr < 3) start = 0;
		var end = Math.min(roundCount, start + visible);
		var thead = "<tr><th>TARGET</th>" + players.map(function(p) {
			return "<th>" + esc(playerName(p, 0)) + "</th>";
		}).join("") + "</tr>";
		var body = "";
		for (var r = start; r < end; r++) {
			body += "<tr class=\"" + (r === cr ? "active" : "") + "\"><th>" + esc(roundLabel(r)) + "</th>";
			for (var p = 0; p < players.length; p++) {
				var cum = cumulative(s, p, r), rs = roundScore(s, p, r), skip = "";
				try {
					if (typeof __sqSkippedRoundState === "function") {
						var st = __sqSkippedRoundState(p, r);
						if (st === "pending") skip = "»»»";
						else if (st === "scratched") skip = "X";
					}
				} catch (_) {}
				var futureRound = r > cr;
				var main = futureRound ? "—" : skip || (cum.any ? String(cum.value) : "—");
				var sub = futureRound || skip ? "" : rs == null ? "" : "(" + rs + ")";
				body += "<td class=\"" + (p === cp ? "current-player" : "") + "\"><strong>" + main + "</strong><small>" + sub + "</small></td>";
			}
			body += "</tr>";
		}
		root.querySelector("#sqTvThead").innerHTML = thead;
		root.querySelector("#sqTvTbody").innerHTML = body;
		var denom = Math.max(lead, 100);
		root.querySelector("#sqTvRace").innerHTML = players.map(function(p, i) {
			var pct = Math.max(2, Math.min(100, totals[i] / denom * 100));
			return "<div class=\"sq-tv-race-row" + (i === cp ? " active" : "") + "\"><span class=\"sq-tv-race-name\">" + esc(playerName(p, i)) + "</span><div class=\"sq-tv-race-track\"><i style=\"width:" + pct.toFixed(1) + "%\"></i></div><strong>" + totals[i] + "</strong></div>";
		}).join("");
		var entry = s.score && s.score[cp] && s.score[cp][cr], darts = entry && Array.isArray(entry.darts) ? entry.darts : [];
		root.querySelector("#sqTvDarts").innerHTML = [
			0,
			1,
			2
		].map(function(i) {
			return "<div class=\"sq-tv-dart " + (i === cd && !s.finished ? "next" : "") + "\"><span>DART " + (i + 1) + "</span><strong>" + esc(dartToken(darts[i])) + "</strong></div>";
		}).join("");
		if (s.finished) disable();
	}
	function active() {
		return !!(document.body && document.body.classList.contains("sq-tv-mode-on"));
	}
	function enable() {
		var reason = modeUnsupported(gameState());
		if (document.body.dataset.page !== "game") {
			try {
				if (typeof toast === "function") toast("Start a game before opening TV Mode");
			} catch (_) {}
			return false;
		}
		if (reason) {
			try {
				if (typeof toast === "function") toast(reason);
			} catch (_) {}
			return false;
		}
		shell();
		document.body.classList.add("sq-tv-mode-on");
		render();
		if (timer) clearInterval(timer);
		timer = setInterval(render, 250);
		try {
			window.dispatchEvent(new Event("resize"));
		} catch (_) {}
		return true;
	}
	function disable() {
		if (timer) {
			clearInterval(timer);
			timer = 0;
		}
		document.body && document.body.classList.remove("sq-tv-mode-on");
		try {
			document.documentElement.style.removeProperty("--sq-tv-pad-h");
		} catch (_) {}
		var root = document.getElementById(ROOT_ID);
		if (root) root.remove();
		try {
			if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
		} catch (_) {}
	}
	window.__sqTvModeIsActive = active;
	window.__sqTvModeSync = render;
	window.__sqTvModeToggle = function(on) {
		return on === false ? (disable(), false) : enable();
	};
	window.addEventListener("pagehide", disable);
	document.addEventListener("keydown", function(e) {
		if (e.key === "Escape" && active() && !document.querySelector(".modal-backdrop:not(.hidden)")) disable();
	});
})();
//#endregion
//#region src/live-game/postgame-flow.mjs
var STYLE_ID$3 = "sq-sc038-postgame-styles";
var WR_VIEW = "v_player_best_official_ranked";
function esc$1(v) {
	return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function playerDisplayParts(player, fallback = "") {
	const p = player || {};
	const rawName = String(p.name || p.player || fallback || "").trim();
	const split = rawName.split(/\s+/).filter(Boolean);
	const first = String(p.first_name || p.first || "").trim() || split[0] || "";
	const last = String(p.last_name || p.last || "").trim() || split.slice(1).join(" ");
	const nickname = String(p.nickname || p.nick || "").trim();
	return {
		main: [first, last].filter(Boolean).join(" ").trim() || rawName || fallback,
		nickname,
		rawName
	};
}
function bestRoundSummary(scoreRows) {
	const rows = Array.isArray(scoreRows) ? scoreRows : [];
	let bestScore = -Infinity;
	let bestIndex = -1;
	rows.forEach((row, index) => {
		const n = Number(row && row.roundTotal || 0);
		if (Number.isFinite(n) && n > bestScore) {
			bestScore = n;
			bestIndex = index;
		}
	});
	if (bestIndex < 0) return {
		roundNumber: 1,
		score: 0,
		label: "R1 / 0"
	};
	return {
		roundNumber: bestIndex + 1,
		score: Math.max(0, bestScore),
		label: `R${bestIndex + 1} / ${Math.max(0, bestScore)}`
	};
}
function completedRoundCount(scoreRows) {
	const rows = Array.isArray(scoreRows) ? scoreRows : [];
	const count = rows.reduce((n, row) => {
		return n + ((row && Array.isArray(row.darts) ? row.darts : []).some((d) => d != null) || row && row.roundTotal != null ? 1 : 0);
	}, 0);
	return Math.max(1, count || rows.length || 1);
}
function normalizeName(v) {
	return String(v == null ? "" : v).trim().toLowerCase();
}
function recordFlagsFromSnapshot(snapshotRows, player, score, currentGameBest = null) {
	const rows = Array.isArray(snapshotRows) ? snapshotRows : [];
	const p = player || {};
	const playerId = String(p.player_id || p.id || "").trim();
	const playerName = normalizeName(p.name || p.player || "");
	const current = Number(score || 0);
	if (!(current > 0) || !rows.length) return {
		pb: false,
		wr: false,
		previousBest: null,
		worldBest: null
	};
	let previous = null;
	for (const row of rows) {
		const rowId = String(row && row.player_id || "").trim();
		const rowName = normalizeName(row && row.player_name);
		if (playerId && rowId === playerId || !playerId && playerName && rowName === playerName || playerName && rowName === playerName) {
			previous = row;
			break;
		}
	}
	const worldBest = rows.reduce((m, row) => Math.max(m, Number(row && row.best_score || 0)), 0);
	const previousBest = previous ? Number(previous.best_score || 0) : 0;
	const gameBest = Number(currentGameBest || 0);
	return {
		pb: previousBest > 0 && current > previousBest,
		wr: worldBest > 0 && current > worldBest && (!(gameBest > 0) || current >= gameBest),
		previousBest: previousBest || null,
		worldBest: worldBest || null
	};
}
function getState$1() {
	try {
		return state;
	} catch (_) {
		return null;
	}
}
function getMode() {
	try {
		if (typeof window.__sqComputeGameMode === "function") return String(window.__sqComputeGameMode() || "").toLowerCase();
	} catch (_) {}
	const st = getState$1();
	return String(st && (st.gameMode || st.mode || st.match?.mode || st.match?.gameMode) || "").toLowerCase();
}
function scoreForPlayer(st, index) {
	const rows = st && st.score && st.score[index];
	return (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(row && row.roundTotal || 0), 0);
}
function currentGameWinnerIndex(st) {
	const players = Array.isArray(st?.players) ? st.players : [];
	if (!players.length) return -1;
	const totals = players.map((_, i) => scoreForPlayer(st, i));
	const max = totals.length ? Math.max(...totals) : 0;
	const leaders = totals.map((value, index) => value === max ? index : -1).filter((index) => index >= 0);
	let winnerIndex = leaders.length === 1 ? leaders[0] : -1;
	try {
		if (st?._decider?.resolved && st._decider.gameToken === (st.__gameToken || 0) && Number.isInteger(st._decider.winner) && players[st._decider.winner]) winnerIndex = st._decider.winner;
	} catch (_) {}
	return winnerIndex;
}
function projectedMatchCompletion(st, modeOverride = "") {
	const players = Array.isArray(st?.players) ? st.players : [];
	const match = st?.match || {};
	const mode = String(modeOverride || st?.gameMode || st?.mode || match?.gameMode || match?.mode || "").toLowerCase();
	const targetWins = Math.max(1, Number(match.targetWins) || 1);
	const projectedWins = Array.from({ length: players.length }, (_, index) => Math.max(0, Number(match.wins?.[index]) || 0)).slice();
	const gameWinnerIndex = currentGameWinnerIndex(st);
	const nonMatchWinMode = /practice|training|shadow/.test(mode) || st?.forcePractice === true || st?.isPractice === true;
	if (!nonMatchWinMode && !st?.gameAwarded && gameWinnerIndex >= 0) projectedWins[gameWinnerIndex] = (projectedWins[gameWinnerIndex] || 0) + 1;
	const maxWins = projectedWins.length ? Math.max(...projectedWins) : 0;
	const leaders = projectedWins.map((value, index) => value === maxWins ? index : -1).filter((index) => index >= 0);
	const winnerIndex = leaders.length === 1 ? leaders[0] : -1;
	return {
		complete: !nonMatchWinMode && winnerIndex >= 0 && maxWins >= targetWins,
		targetWins,
		winnerIndex,
		projectedWins,
		gameWinnerIndex,
		mode
	};
}
function scorecardRows(st) {
	const players = Array.isArray(st && st.players) ? st.players : [];
	const totals = players.map((_, index) => scoreForPlayer(st, index));
	const max = totals.length ? Math.max(...totals) : 0;
	return players.map((player, index) => {
		const rows = Array.isArray(st.score?.[index]) ? st.score[index] : [];
		const parts = playerDisplayParts(player, `Player ${index + 1}`);
		const rounds = completedRoundCount(rows);
		return {
			index,
			player,
			parts,
			score: totals[index] || 0,
			average: (totals[index] || 0) / rounds,
			best: bestRoundSummary(rows),
			winner: (totals[index] || 0) === max
		};
	}).sort((a, b) => b.score - a.score || a.parts.main.localeCompare(b.parts.main));
}
function injectStyles$1() {
	if (typeof document === "undefined" || document.getElementById(STYLE_ID$3)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID$3;
	style.textContent = `
/* SC-038: preserve the current dark arcade cabinet; presentation only. */
body.livev2-on[data-page="game"] #pad .dtBullRow .dtBullBtn[data-bull="Outer"],
body .modal-decider .dtBullRow .dtBullBtn[data-bull="Outer"]{
  background:linear-gradient(180deg,rgba(18,92,52,.90),rgba(8,48,29,.98)) !important;
  border-color:rgba(72,224,124,.86) !important;
  color:#bcffd2 !important;
  box-shadow:0 0 0 1px rgba(47,208,107,.12),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(220,255,232,.10),0 0 18px rgba(47,208,107,.12) !important;
}
body.livev2-on[data-page="game"] #pad .dtBullRow .dtBullBtn.inner[data-bull="Inner"],
body .modal-decider .dtBullRow .dtBullBtn.inner[data-bull="Inner"]{
  background:linear-gradient(180deg,rgba(126,27,42,.92),rgba(62,10,23,.98)) !important;
  border-color:rgba(255,77,94,.88) !important;
  color:#ffc1c8 !important;
  box-shadow:0 0 0 1px rgba(255,77,94,.11),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,225,229,.10),0 0 18px rgba(255,77,94,.11) !important;
}
.modal-gamecomplete.sq-gc-arcade .gc-arcade-visual .sq-gc-celebration-sprite{
  position:absolute;
  top:0;
  right:0;
  height:100%;
  aspect-ratio:4 / 5;
  background-repeat:no-repeat;
  background-size:600% 500%;
  filter:saturate(1.04) contrast(1.04);
}
.modal-gamecomplete.sq-gc-arcade .gc-winnerName.sq-pg-winner-name{
  margin-bottom:18px;
  max-width:min(440px,92vw);
  line-height:1;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-mainname{
  display:block;
  font-size:clamp(27px,6.2vw,42px);
  line-height:.98;
  font-weight:950;
  letter-spacing:.005em;
  color:var(--shatekiOrange,#ff7a00);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-nickname{
  display:block;
  margin-top:7px;
  font-size:clamp(14px,3.8vw,20px);
  line-height:1.05;
  font-weight:850;
  letter-spacing:.08em;
  color:rgba(255,186,104,.92);
}
.modal-gamecomplete.sq-gc-arcade .gc-statRow .gc-statValue{ white-space:nowrap; }
.modal-gamecomplete.sq-gc-arcade .gc-arcade-actions{ display:none !important; }
.modal-gamecomplete.sq-gc-arcade .gc-ranks{ display:none !important; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-screen[hidden]{ display:none !important; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-scorecard,
.modal-gamecomplete.sq-gc-arcade .sq-pg-xp-screen{
  position:relative;
  z-index:4;
  width:100%;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-scorecard-title,
.modal-gamecomplete.sq-gc-arcade .sq-pg-xp-heading{
  margin:0 0 16px;
  color:rgba(238,241,255,.94);
  font-size:clamp(22px,5.4vw,34px);
  line-height:1;
  font-weight:950;
  letter-spacing:.10em;
  text-transform:uppercase;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-head,
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) 48px 48px 82px;
  gap:6px;
  align-items:center;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-head{
  padding:0 10px 7px;
  color:rgba(238,241,255,.50);
  font-size:9px;
  font-weight:950;
  letter-spacing:.06em;
  text-transform:uppercase;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-list{
  display:flex;
  flex-direction:column;
  gap:8px;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-row{
  min-height:54px;
  padding:8px 10px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:12px;
  background:linear-gradient(180deg,rgba(18,25,38,.88),rgba(8,13,22,.94));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 18px rgba(0,0,0,.20);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-score-row.is-winner{
  border-color:rgba(255,122,0,.34);
  box-shadow:inset 3px 0 0 var(--shatekiOrange,#ff7a00),inset 0 1px 0 rgba(255,255,255,.04),0 8px 18px rgba(0,0,0,.20);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-player-main{
  min-width:0;
  font-size:13px;
  line-height:1.05;
  font-weight:950;
  color:rgba(248,249,255,.96);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-player-nick{
  display:block;
  margin-top:3px;
  color:rgba(255,174,86,.72);
  font-size:9px;
  font-weight:800;
  letter-spacing:.05em;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-num{
  text-align:right;
  color:rgba(244,247,255,.94);
  font-size:13px;
  font-weight:950;
  font-variant-numeric:tabular-nums;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-best{ font-size:11px; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-records{
  grid-column:1 / -1;
  display:flex;
  gap:6px;
  min-height:0;
  margin-top:-1px;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-records:empty{ display:none; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-badge{
  display:inline-flex;
  align-items:center;
  min-height:22px;
  padding:3px 8px;
  border-radius:999px;
  font-size:9px;
  line-height:1;
  font-weight:950;
  letter-spacing:.07em;
  text-transform:uppercase;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-badge.pb{
  color:#b8ffd0;
  border:1px solid rgba(47,208,107,.46);
  background:rgba(47,208,107,.11);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-badge.wr{
  color:#e1c3ff;
  border:1px solid rgba(176,107,255,.54);
  background:rgba(176,107,255,.13);
  box-shadow:0 0 14px rgba(176,107,255,.10);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-nav{
  position:relative;
  z-index:5;
  width:100%;
  margin-top:16px;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-next{
  width:100%;
  min-height:58px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.12);
  background:linear-gradient(180deg,rgba(28,35,48,.98),rgba(12,17,26,.99));
  color:#eef3ff;
  font-size:13px;
  font-weight:950;
  letter-spacing:.10em;
  text-transform:uppercase;
  box-shadow:0 12px 28px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.07);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-next:not(:disabled):active{ transform:translateY(1px); filter:brightness(1.10); }
.modal-gamecomplete.sq-gc-arcade .sq-pg-next:disabled{ opacity:.48; }
.modal-gamecomplete.sq-gc-arcade .sq-pg-xp-screen .gc-xp-reveal{
  width:100%;
  margin:0;
}
.modal-gamecomplete.sq-gc-arcade.sq-pg-history-modal{
  width:min(94vw,620px);
  max-width:620px;
  max-height:min(88vh,820px);
  padding:0;
  overflow:hidden;
  border:1px solid rgba(255,122,0,.24);
  border-radius:22px;
  background:linear-gradient(165deg,#151b28 0%,#090d14 100%);
  box-shadow:0 24px 60px rgba(0,0,0,.56),inset 0 1px 0 rgba(255,255,255,.05);
}
.modal-gamecomplete.sq-gc-arcade.sq-pg-history-modal .modal-body.sq-pg-history-body{
  display:flex;
  flex-direction:column;
  gap:14px;
  max-height:72vh;
  padding:18px;
  overflow-y:auto;
}
.modal-gamecomplete.sq-gc-arcade.sq-pg-history-modal .sq-pg-history-scorecard{
  display:block;
  padding:15px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:16px;
  background:linear-gradient(180deg,rgba(18,25,38,.94),rgba(8,13,22,.98));
  box-shadow:inset 3px 0 0 rgba(255,122,0,.70),0 10px 24px rgba(0,0,0,.24);
}
.modal-gamecomplete.sq-gc-arcade.sq-pg-history-modal .sq-pg-history-scorecard .sq-pg-scorecard-title{
  margin-bottom:14px;
  font-size:clamp(18px,4.8vw,28px);
}


.modal-gamecomplete.sq-gc-arcade .sq-pg-match-win{
  position:relative;
  z-index:4;
  width:100%;
  min-height:390px;
  overflow:hidden;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-stage{
  position:relative;
  min-height:390px;
  border:1px solid rgba(255,122,0,.26);
  border-radius:18px;
  overflow:hidden;
  background:radial-gradient(circle at 78% 20%,rgba(255,122,0,.18),transparent 38%),linear-gradient(150deg,rgba(25,31,45,.98),rgba(7,11,18,.99));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 16px 34px rgba(0,0,0,.30);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-copy{
  position:relative;
  z-index:4;
  width:min(58%,330px);
  padding:28px 0 0 22px;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-kicker{
  color:rgba(255,184,101,.88);
  font-size:11px;
  font-weight:950;
  letter-spacing:.18em;
  text-transform:uppercase;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-name{
  margin-top:9px;
  color:var(--shatekiOrange,#ff7a00);
  font-size:clamp(30px,7vw,46px);
  line-height:.95;
  font-weight:950;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-nick{
  margin-top:8px;
  color:rgba(255,211,158,.92);
  font-size:clamp(13px,3.6vw,19px);
  font-weight:850;
  letter-spacing:.07em;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-score{
  display:inline-flex;
  align-items:center;
  min-height:34px;
  margin-top:18px;
  padding:7px 11px;
  border:1px solid rgba(255,122,0,.34);
  border-radius:999px;
  color:#fff2df;
  background:rgba(255,122,0,.10);
  font-size:15px;
  font-weight:950;
  letter-spacing:.07em;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-match-celebration{
  position:absolute;
  z-index:2;
  top:0;
  right:-4%;
  height:100%;
  aspect-ratio:4 / 5;
  background-repeat:no-repeat;
  background-size:600% 500%;
  filter:saturate(1.10) contrast(1.06);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-opponent-rail{
  position:absolute;
  z-index:5;
  left:18px;
  right:18px;
  bottom:16px;
  display:flex;
  align-items:flex-end;
  gap:8px;
  pointer-events:none;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-opponent{
  position:relative;
  width:44px;
  height:44px;
  flex:0 0 44px;
  border:1px solid rgba(255,255,255,.18);
  border-radius:50%;
  overflow:visible;
  background-color:#101723;
  box-shadow:0 8px 18px rgba(0,0,0,.38);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-opponent-avatar{
  position:absolute;
  inset:0;
  border-radius:inherit;
  background-repeat:no-repeat;
  background-size:600% 500%;
  filter:saturate(.76) brightness(.78);
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-opponent-reaction{
  position:absolute;
  right:-5px;
  bottom:-7px;
  display:grid;
  place-items:center;
  width:21px;
  height:21px;
  border-radius:50%;
  border:1px solid rgba(255,255,255,.18);
  background:#0b1018;
  font-size:12px;
  line-height:1;
}

@media (max-width:560px){
  .modal-gamecomplete.sq-gc-arcade .gc-arcade-shell{ min-height:0; padding:28px 18px 20px; }
  .modal-gamecomplete.sq-gc-arcade .gc-arcade-content{ min-height:360px; }
  .modal-gamecomplete.sq-gc-arcade .gc-winnerName.sq-pg-winner-name{ max-width:75%; }
  .modal-gamecomplete.sq-gc-arcade .gc-statPanel{ width:min(310px,82%); }
  .modal-gamecomplete.sq-gc-arcade .sq-pg-score-head,
  .modal-gamecomplete.sq-gc-arcade .sq-pg-score-row{ grid-template-columns:minmax(0,1fr) 44px 44px 76px; gap:5px; }
}
`;
	document.head.appendChild(style);
}
function updateHero(modal, st) {
	const winnerIndex = currentGameWinnerIndex(st);
	if (winnerIndex < 0) return;
	const player = st.players[winnerIndex] || {};
	const parts = playerDisplayParts(player, "Player " + (winnerIndex + 1));
	const visual = modal.querySelector(".gc-arcade-visual");
	if (visual && typeof window !== "undefined" && typeof window.__sqAvatarSpritePosition === "function") {
		const id = typeof window.__sqAvatarIdForPlayer === "function" ? window.__sqAvatarIdForPlayer(player) : 1;
		const pos = window.__sqAvatarSpritePosition(id);
		visual.style.background = "none";
		visual.innerHTML = "";
		const art = document.createElement("div");
		art.className = "sq-gc-celebration-sprite sq-pg-game-win-art";
		art.dataset.avatarId = String(pos.id);
		art.style.backgroundImage = "url(\"./assets/avatars/celebration-sprite.webp\")";
		art.style.backgroundPosition = pos.x.toFixed(4) + "% " + pos.y.toFixed(4) + "%";
		visual.appendChild(art);
	}
	const winnerEl = modal.querySelector(".gc-winnerName");
	if (winnerEl) {
		winnerEl.classList.add("sq-pg-winner-name");
		winnerEl.innerHTML = "<span class=\"sq-pg-mainname\">" + esc$1(parts.main) + "</span>" + (parts.nickname ? "<span class=\"sq-pg-nickname\">&ldquo;" + esc$1(parts.nickname) + "&rdquo;</span>" : "");
		winnerEl.setAttribute("title", [parts.main, parts.nickname ? "\"" + parts.nickname + "\"" : ""].filter(Boolean).join(" "));
	}
	const kicker = modal.querySelector(".gc-arcade-kicker");
	if (kicker) kicker.textContent = "GAME WINNER";
	const best = bestRoundSummary(st.score?.[winnerIndex] || []);
	Array.from(modal.querySelectorAll(".gc-statRow")).forEach((row) => {
		const label = String(row.querySelector(".gc-statLabel")?.textContent || "").trim().toLowerCase();
		const value = row.querySelector(".gc-statValue");
		if (!value) return;
		if (label === "best round") value.textContent = best.label;
	});
}
function buildScorecard(modal, st, opts = {}) {
	const screen = document.createElement("section");
	screen.className = "sq-pg-screen sq-pg-scorecard";
	screen.hidden = true;
	screen.innerHTML = `
    <h2 class="sq-pg-scorecard-title">${esc$1(opts.title || "GAME SCORECARD")}</h2>
    <div class="sq-pg-score-head" aria-hidden="true">
      <span>Name</span><span>Score</span><span>Avg</span><span>Best Round</span>
    </div>
    <div class="sq-pg-score-list"></div>
  `;
	const list = screen.querySelector(".sq-pg-score-list");
	const rows = scorecardRows(st);
	rows.forEach((row) => {
		const el = document.createElement("div");
		el.className = "sq-pg-score-row" + (row.winner ? " is-winner" : "");
		el.dataset.playerIndex = String(row.index);
		el.innerHTML = `
      <div class="sq-pg-player-main">${esc$1(row.parts.main)}${row.parts.nickname ? `<span class="sq-pg-player-nick">&ldquo;${esc$1(row.parts.nickname)}&rdquo;</span>` : ""}</div>
      <div class="sq-pg-num">${esc$1(row.score)}</div>
      <div class="sq-pg-num">${esc$1(row.average.toFixed(1))}</div>
      <div class="sq-pg-num sq-pg-best">${esc$1(row.best.label)}</div>
      <div class="sq-pg-records" data-records-for="${row.index}"></div>
    `;
		list.appendChild(el);
	});
	return {
		screen,
		rows
	};
}
function openMatchGameScores(st = getState$1()) {
	const history = Array.isArray(st?.match?.history) ? st.match.history : [];
	const players = Array.isArray(st?.players) ? st.players : [];
	if (!history.length || !players.length) return false;
	if (typeof window.sqModal !== "function") return false;
	injectStyles$1();
	const m = window.sqModal({
		title: "GAME SCORES",
		closeButton: "CLOSE",
		modalClass: "modal-gamecomplete sq-gc-arcade sq-pg-history-modal",
		maxWidth: "620px",
		width: "94vw"
	});
	m.body.classList.add("sq-pg-history-body");
	history.forEach((game, index) => {
		const board = Array.isArray(game?.board) ? game.board : [];
		const pseudo = {
			players,
			score: board
		};
		const built = buildScorecard(m.modal, pseudo, { title: `GAME ${index + 1} SCORECARD` });
		built.screen.hidden = false;
		built.screen.classList.add("sq-pg-history-scorecard");
		m.body.appendChild(built.screen);
	});
	return true;
}
async function hydrateRecordBadges(st, rows, scorecard) {
	if (getMode() !== "official") return;
	const client = window.sb;
	if (!client || typeof client.from !== "function") return;
	try {
		const { data, error } = await client.from(WR_VIEW).select("player_id,player_name,best_score,best_score_pos");
		if (error || !Array.isArray(data) || !data.length) return;
		const currentGameBest = rows.reduce((m, row) => Math.max(m, Number(row && row.score || 0)), 0);
		rows.forEach((row) => {
			const flags = recordFlagsFromSnapshot(data, row.player, row.score, currentGameBest);
			if (!flags.pb && !flags.wr) return;
			const host = scorecard.querySelector(`[data-records-for="${row.index}"]`);
			if (!host) return;
			if (flags.pb) host.insertAdjacentHTML("beforeend", "<span class=\"sq-pg-badge pb\">PB</span>");
			if (flags.wr) host.insertAdjacentHTML("beforeend", "<span class=\"sq-pg-badge wr\">WR</span>");
		});
	} catch (err) {
		try {
			console.warn("[SC-038] PB/WR scorecard read unavailable", err);
		} catch (_) {}
	}
}
function buildXpScreen() {
	const screen = document.createElement("section");
	screen.className = "sq-pg-screen sq-pg-xp-screen";
	screen.hidden = true;
	screen.innerHTML = "<div class=\"gc-xp-reveal sq-pg-xp-host\"></div>";
	return screen;
}
function buildMatchWinScreen(st, matchState) {
	if (!matchState?.complete || matchState.winnerIndex < 0) return null;
	const winnerIndex = matchState.winnerIndex;
	const player = st.players?.[winnerIndex] || {};
	const parts = playerDisplayParts(player, "Player " + (winnerIndex + 1));
	const projectedWins = matchState.projectedWins || [];
	const scoreText = projectedWins.length === 2 ? Number(projectedWins[0] || 0) + "–" + Number(projectedWins[1] || 0) : Number(projectedWins[winnerIndex] || 0) + " WINS";
	const screen = document.createElement("section");
	screen.className = "sq-pg-screen sq-pg-match-win";
	screen.hidden = true;
	screen.innerHTML = "<div class=\"sq-pg-match-stage\"><div class=\"sq-pg-match-copy\"><div class=\"sq-pg-match-kicker\">MATCH WINNER</div><div class=\"sq-pg-match-name\">" + esc$1(parts.main) + "</div>" + (parts.nickname ? "<div class=\"sq-pg-match-nick\">&ldquo;" + esc$1(parts.nickname) + "&rdquo;</div>" : "") + "<div class=\"sq-pg-match-score\">" + esc$1(scoreText) + "</div></div><div class=\"sq-pg-opponent-rail\" aria-label=\"Other match players\"></div></div>";
	const stage = screen.querySelector(".sq-pg-match-stage");
	if (stage && typeof window !== "undefined" && typeof window.__sqAvatarSpritePosition === "function") {
		const winnerId = typeof window.__sqAvatarIdForPlayer === "function" ? window.__sqAvatarIdForPlayer(player) : 1;
		const winnerPos = window.__sqAvatarSpritePosition(winnerId);
		const art = document.createElement("div");
		art.className = "sq-pg-match-celebration";
		art.dataset.avatarId = String(winnerPos.id);
		art.style.backgroundImage = "url(\"./assets/avatars/celebration-sprite.webp\")";
		art.style.backgroundPosition = winnerPos.x.toFixed(4) + "% " + winnerPos.y.toFixed(4) + "%";
		stage.appendChild(art);
		const rail = screen.querySelector(".sq-pg-opponent-rail");
		(st.players || []).forEach((opponent, index) => {
			if (index === winnerIndex || !rail) return;
			const id = typeof window.__sqAvatarIdForPlayer === "function" ? window.__sqAvatarIdForPlayer(opponent) : 1;
			const pos = window.__sqAvatarSpritePosition(id);
			const chip = document.createElement("div");
			chip.className = "sq-pg-opponent";
			chip.setAttribute("aria-label", playerDisplayParts(opponent, "Player " + (index + 1)).main);
			chip.innerHTML = "<div class=\"sq-pg-opponent-avatar\"></div><span class=\"sq-pg-opponent-reaction\" aria-hidden=\"true\"></span>";
			const avatar = chip.querySelector(".sq-pg-opponent-avatar");
			avatar.style.backgroundImage = "url(\"./assets/avatars/avatar-sprite.webp\")";
			avatar.style.backgroundPosition = pos.x.toFixed(4) + "% " + pos.y.toFixed(4) + "%";
			chip.querySelector(".sq-pg-opponent-reaction").textContent = (index + winnerIndex) % 2 === 0 ? "👏" : "😤";
			rail.appendChild(chip);
		});
	}
	return screen;
}
function isUnresolvedDecider(modal) {
	return !!modal.querySelector("[data-action=\"startDecider\"]");
}
function upgradePostGameOverlay(overlay) {
	if (!overlay || overlay.dataset.sqSc038 === "1") return;
	const modal = overlay.querySelector(".modal-gamecomplete.sq-gc-arcade");
	if (!modal || isUnresolvedDecider(modal)) return;
	const st = getState$1();
	if (!st || !Array.isArray(st.players) || !st.players.length) return;
	try {
		window.__sqSc038StartXpPrefetch?.(st);
	} catch (_) {}
	overlay.dataset.sqSc038 = "1";
	const advanceBtn = modal.querySelector("[data-action=\"advanceMatch\"]");
	if (!advanceBtn) return;
	const matchState = projectedMatchCompletion(st, getMode());
	const isMatchComplete = !!matchState.complete;
	overlay.dataset.sqSc055MatchComplete = isMatchComplete ? "1" : "0";
	updateHero(modal, st);
	Array.from(modal.querySelectorAll(".gc-actions.gc-arcade-actions")).forEach((group) => {
		group.style.setProperty("display", "none", "important");
		group.setAttribute("aria-hidden", "true");
	});
	const oldXpHost = modal.querySelector(".gc-xp-reveal:not(.sq-pg-xp-host)");
	if (oldXpHost) oldXpHost.style.display = "none";
	const ranks = modal.querySelector(".gc-ranks");
	if (ranks) {
		ranks.style.setProperty("display", "none", "important");
		ranks.setAttribute("aria-hidden", "true");
	}
	const shell = modal.querySelector(".gc-arcade-shell") || modal;
	const hero = modal.querySelector(".gc-arcade-content");
	if (!hero) return;
	hero.classList.add("sq-pg-screen", "sq-pg-result");
	const built = buildScorecard(modal, st);
	const scorecard = built.screen;
	const rows = built.rows;
	const xpScreen = buildXpScreen();
	const matchWinScreen = isMatchComplete ? buildMatchWinScreen(st, matchState) : null;
	const nav = document.createElement("div");
	nav.className = "sq-pg-nav";
	const next = document.createElement("button");
	next.type = "button";
	next.className = "sq-pg-next";
	next.textContent = "NEXT ▶";
	nav.appendChild(next);
	shell.appendChild(scorecard);
	shell.appendChild(xpScreen);
	if (matchWinScreen) shell.appendChild(matchWinScreen);
	shell.appendChild(nav);
	hydrateRecordBadges(st, rows, scorecard);
	let xpStarted = false;
	let xpReady = false;
	let xpSafety = null;
	const show = (n) => {
		next.dataset.pgStep = String(n);
		hero.hidden = n !== 0;
		scorecard.hidden = n !== 1;
		xpScreen.hidden = n !== 2;
		if (matchWinScreen) matchWinScreen.hidden = n !== 3;
		const visual = modal.querySelector(".gc-arcade-visual");
		const confetti = modal.querySelector(".gc-arcade-confetti");
		if (visual) visual.style.display = n === 0 ? "" : "none";
		if (confetti) confetti.style.display = n === 0 || isMatchComplete && n === 3 ? "" : "none";
	};
	const enableFinalAdvance = () => {
		if (xpReady) return;
		xpReady = true;
		if (xpSafety) clearTimeout(xpSafety);
		next.disabled = false;
		next.textContent = isMatchComplete ? "MATCH WIN ▶" : "MATCH LEADERBOARD";
	};
	const startXp = () => {
		if (xpStarted) return;
		xpStarted = true;
		next.disabled = true;
		next.textContent = "XP…";
		const host = xpScreen.querySelector(".sq-pg-xp-host");
		try {
			if (typeof window.__sqGcXpEnsureStyles === "function") window.__sqGcXpEnsureStyles();
		} catch (_) {}
		if (typeof window.__sqGcXpReveal === "function") {
			window.__sqGcXpReveal(host, enableFinalAdvance);
			xpSafety = setTimeout(enableFinalAdvance, 9e3);
		} else {
			if (host) host.innerHTML = "<div class=\"gc-xp-title\">XP SUMMARY UNAVAILABLE</div>";
			enableFinalAdvance();
		}
	};
	next.onclick = (event) => {
		try {
			event?.preventDefault?.();
			event?.stopPropagation?.();
		} catch (_) {}
		const current = Number(next.dataset.pgStep || 0);
		if (current === 0 || !hero.hidden) {
			show(1);
			next.textContent = "NEXT ▶";
			return;
		}
		if (current === 1 || !scorecard.hidden) {
			show(2);
			startXp();
			return;
		}
		if ((current === 2 || !xpScreen.hidden) && xpReady) {
			if (isMatchComplete && matchWinScreen) {
				show(3);
				next.textContent = "MATCH LEADERBOARD";
				return;
			}
			advanceBtn.click();
			return;
		}
		if (current === 3 && matchWinScreen && !matchWinScreen.hidden) advanceBtn.click();
	};
	show(0);
}
function installPostGameFlow() {
	injectStyles$1();
	if (typeof window === "undefined") return false;
	const original = window.openGameCompleteDialog;
	if (typeof original !== "function") return false;
	if (original.__sqSc038Wrapped) return true;
	function wrappedOpenGameCompleteDialog(...args) {
		const out = original.apply(this, args);
		queueMicrotask(() => {
			try {
				const overlays = document.querySelectorAll(".sq-gamecomplete-backdrop");
				upgradePostGameOverlay(overlays[overlays.length - 1]);
			} catch (err) {
				try {
					console.warn("[SC-038] post-game presentation upgrade failed", err);
				} catch (_) {}
			}
		});
		return out;
	}
	wrappedOpenGameCompleteDialog.__sqSc038Wrapped = true;
	wrappedOpenGameCompleteDialog.__sqSc038Original = original;
	window.openGameCompleteDialog = wrappedOpenGameCompleteDialog;
	window.__sqOpenMatchGameScores = function() {
		return openMatchGameScores(getState$1());
	};
	return true;
}
function boot$2() {
	injectStyles$1();
	let tries = 0;
	const attempt = () => {
		tries += 1;
		if (installPostGameFlow() || tries >= 120) return;
		setTimeout(attempt, 50);
	};
	attempt();
}
if (typeof window !== "undefined" && typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot$2, { once: true });
	else boot$2();
}
//#endregion
//#region src/live-game/postgame-hotfix.mjs
var PATCH_FLAG = "__sqSc038XpLeaderboardHotfix";
var MATCH_LEADERBOARD_LABEL = "MATCH LEADERBOARD";
function scoreRowsTotal$1(rows) {
	return (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(row && row.roundTotal || 0), 0);
}
function qualifiesUntouchable(board, playerIndex) {
	if (!Array.isArray(board) || board.length < 2) return false;
	const totals = board.map(scoreRowsTotal$1);
	const maxTotal = Math.max(0, ...totals);
	if (!(maxTotal > 0) || totals[playerIndex] !== maxTotal) return false;
	if (totals.filter((total) => total === maxTotal).length !== 1) return false;
	const running = Array(board.length).fill(0);
	const roundCount = Math.max(0, ...board.map((rows) => Array.isArray(rows) ? rows.length : 0));
	for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
		for (let player = 0; player < board.length; player += 1) running[player] += Number(board[player]?.[roundIndex]?.roundTotal || 0);
		const lead = Math.max(0, ...running);
		if (running[playerIndex] < lead) return false;
	}
	return true;
}
function patchAchievementDetector(host = globalThis) {
	const ach = host && host.SQ_ACH;
	if (!ach || typeof ach.detectGame !== "function") return false;
	if (ach.detectGame.__sqSc038UntouchableFixed) return true;
	const original = ach.detectGame;
	function fixedDetectGame(board, opts) {
		opts = opts || {};
		const players = opts.players || [];
		const norm = (d) => {
			const k = d && d.kind || "Miss";
			if (k === "S") return "single";
			if (k === "D" || k === "Double") return "double";
			if (k === "T" || k === "Triple") return "treble";
			if (k === "B" || k === "Bull") return "bull";
			return "miss";
		};
		if (!Array.isArray(board) || !board.length) return [];
		const totals = board.map((rs) => (rs || []).reduce((s, r) => s + (Number(r && r.roundTotal) || 0), 0));
		const maxTotal = Math.max.apply(null, totals.concat([0]));
		const out = [];
		for (let p = 0; p < board.length; p++) {
			const rounds = board[p] || [];
			const earned = {};
			const add = (c, n) => {
				earned[c] = (earned[c] || 0) + (n || 1);
			};
			let totMiss = 0, totDarts = 0, centuryRounds = 0, scoredRounds = 0, best = 0, run = 0;
			let finalFh = false;
			for (let ri = 0; ri < rounds.length; ri++) {
				const r = rounds[ri] || {};
				const darts = r.darts || [];
				let tre = 0, dou = 0, sin = 0, b50 = 0, bany = 0;
				darts.forEach((d) => {
					const nk = norm(d);
					if (nk === "treble") tre++;
					else if (nk === "double") dou++;
					else if (nk === "single") sin++;
					else if (nk === "bull") {
						bany++;
						if ((Number(d.points) || 0) === 50) b50++;
					}
				});
				const mis = darts.filter((d) => norm(d) === "miss" || (Number(d && d.points) || 0) === 0).length;
				const rtot = Number(r.roundTotal) || 0;
				const target = ri <= 10 ? 10 + ri : null;
				const rmax = ri <= 10 ? 9 * (10 + ri) : ri === 11 ? 120 : ri === 12 ? 180 : 150;
				totMiss += mis;
				totDarts += darts.length;
				if (rtot > 0) scoredRounds++;
				const fh = mis === 0 && darts.length === 3;
				run = fh ? run + 1 : 0;
				if (run > best) best = run;
				if (ri === 13) finalFh = fh;
				if (rtot === 180) add("the_180");
				else if (rtot === rmax && darts.length === 3) add("maximum");
				if (ri <= 10 && tre === 3) add("treble_trouble");
				if (ri <= 10 && dou === 3) add("double_down");
				if (fh) add("full_house");
				if (rtot >= 100 && rtot < 180) {
					add("century");
					centuryRounds++;
				}
				if (target != null && sin === 1 && dou === 1 && tre === 1) add("shanghai");
				if (target != null && sin === 2 && dou === 1 && tre === 0 && mis === 0) add("desmond");
				if (target != null && tre >= 2) add("robin_hood");
				if (b50 > 0) add("dead_centre", b50);
				if (ri === 12 && tre === 3) add("triple_threat");
				if (ri === 11 && dou === 3) add("double_trouble");
				if (ri === 13 && bany === 3) add("bull_run");
				if (ri === 0 && fh) add("perfect_start");
				if (ri === 13 && rtot >= 100) add("strong_finish");
			}
			const won = totals[p] === maxTotal && maxTotal > 0;
			const topCount = totals.filter((t) => t === maxTotal).length;
			const uniqueWon = won && topCount === 1;
			const running = Array(board.length).fill(0);
			let neverBehind = true;
			const roundN = Math.max.apply(null, board.map((rs) => (rs || []).length).concat([0]));
			for (let ri = 0; ri < roundN; ri++) {
				for (let q = 0; q < board.length; q++) running[q] += Number(((board[q] || [])[ri] || {}).roundTotal || 0);
				const lead = Math.max.apply(null, running.concat([0]));
				if (running[p] < lead) {
					neverBehind = false;
					break;
				}
			}
			if (totMiss === 0 && totDarts > 0) add("flawless_game");
			if (scoredRounds >= 14) add("full_board");
			if (centuryRounds >= 3) add("ton_machine");
			if (best >= 5) add("inferno");
			else if (best >= 3) add("hot_streak");
			if (!opts.is_tiebreak && board.length >= 2 && uniqueWon && neverBehind) add("untouchable");
			if (opts.is_tiebreak && won) add("iceman");
			if (won && finalFh) add("clutch");
			if (board.length === 2) {
				const oppRounds = board[1 - p] || [];
				let wonEvery = true, ca = 0, cb = 0, n = Math.max(rounds.length, oppRounds.length);
				for (let ri = 0; ri < n; ri++) {
					const a = Number((rounds[ri] || {}).roundTotal) || 0, b = Number((oppRounds[ri] || {}).roundTotal) || 0;
					if (!(a > b)) wonEvery = false;
					if (ri <= 6) {
						ca += a;
						cb += b;
					}
				}
				if (won && wonEvery) add("whitewash");
				if (won && ca < cb) add("comeback_kid");
			}
			const list = Object.keys(earned).map((c) => ({
				code: c,
				count: earned[c]
			})).sort((a, b) => (ach.meta(b.code).xp || 0) - (ach.meta(a.code).xp || 0));
			if (list.length) out.push({
				player: p,
				name: players[p] && (players[p].name || players[p]) || "Player " + (p + 1),
				earned: list
			});
		}
		return out;
	}
	fixedDetectGame.__sqSc038UntouchableFixed = true;
	fixedDetectGame.__sqSc038Original = original;
	ach.detectGame = fixedDetectGame;
	return true;
}
function patchPostGameOverlay(overlay, host = globalThis) {
	if (!overlay || overlay.dataset.sqSc038LeaderboardHotfix === "1") return false;
	const next = overlay.querySelector(".sq-pg-next");
	const xpScreen = overlay.querySelector(".sq-pg-xp-screen");
	const matchWinScreen = overlay.querySelector(".sq-pg-match-win");
	if (!next || !xpScreen) return false;
	overlay.dataset.sqSc038LeaderboardHotfix = "1";
	const isMatchComplete = () => overlay.dataset.sqSc055MatchComplete === "1";
	const xpVisible = () => !xpScreen.hidden;
	const matchWinVisible = () => !!matchWinScreen && !matchWinScreen.hidden;
	const syncLabel = () => {
		if (next.disabled) return;
		let wanted = "";
		if (xpVisible() && isMatchComplete()) wanted = "MATCH WIN ▶";
		else if (xpVisible() && !isMatchComplete() || matchWinVisible()) wanted = MATCH_LEADERBOARD_LABEL;
		if (wanted && String(next.textContent || "").trim() !== wanted) next.textContent = wanted;
	};
	const buttonObserver = new MutationObserver(syncLabel);
	buttonObserver.observe(next, {
		attributes: true,
		childList: true,
		subtree: true
	});
	next.addEventListener("click", async (event) => {
		const onXp = xpVisible();
		const onMatchWin = matchWinVisible();
		if (!onXp && !onMatchWin || next.disabled) return;
		if (onXp && isMatchComplete()) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		next.disabled = true;
		next.textContent = "SAVING…";
		try {
			const awardAndShow = host.awardAndShowLeaderboard;
			if (typeof awardAndShow !== "function") throw new Error("Match leaderboard handoff is unavailable.");
			await awardAndShow();
			if (document.body?.getAttribute("data-page") !== "leaderboard") throw new Error("Match leaderboard did not open.");
			buttonObserver.disconnect();
			overlay.remove();
		} catch (error) {
			next.disabled = false;
			next.textContent = onMatchWin ? MATCH_LEADERBOARD_LABEL : isMatchComplete() ? "MATCH WIN ▶" : MATCH_LEADERBOARD_LABEL;
			try {
				console.error("[SC-038] Match leaderboard handoff failed", error);
			} catch (_) {}
			try {
				if (typeof host.toast === "function") host.toast("Could not open Match Leaderboard. Please retry.");
			} catch (_) {}
		}
	}, true);
	syncLabel();
	return true;
}
function patchExistingOverlays(host = globalThis) {
	document.querySelectorAll(".sq-gamecomplete-backdrop[data-sq-sc038=\"1\"]").forEach((overlay) => {
		patchPostGameOverlay(overlay, host);
	});
}
function installSc038Hotfix(host = globalThis) {
	if (!host || typeof document === "undefined") return false;
	if (host[PATCH_FLAG]) return true;
	host[PATCH_FLAG] = true;
	let tries = 0;
	const patchDetector = () => {
		tries += 1;
		if (patchAchievementDetector(host) || tries >= 120) return;
		setTimeout(patchDetector, 50);
	};
	patchDetector();
	patchExistingOverlays(host);
	const observer = new MutationObserver(() => patchExistingOverlays(host));
	const start = () => {
		const root = document.body || document.documentElement;
		if (root) observer.observe(root, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-sq-sc038"]
		});
	};
	if (document.body) start();
	else document.addEventListener("DOMContentLoaded", start, { once: true });
	host.__sqSc038Hotfix = {
		patchAchievementDetector: () => patchAchievementDetector(host),
		patchPostGameOverlay: (overlay) => patchPostGameOverlay(overlay, host),
		qualifiesUntouchable
	};
	return true;
}
if (typeof window !== "undefined" && typeof document !== "undefined") installSc038Hotfix(window);
//#endregion
//#region src/live-game/xp-breakdown.mjs
var STYLE_ID$2 = "sq-sc038-xp-breakdown-styles";
var INSTALL_FLAG = "__sqSc038XpBreakdownInstalled";
var ORIGINAL_KEY = "__sqSc038XpBreakdownOriginal";
var MISFIRE_META = Object.freeze({
	cold_start: {
		name: "Cold Start",
		penalty: -1
	},
	ghost_town: {
		name: "Ghost Town",
		penalty: -2
	},
	deep_freeze: {
		name: "Deep Freeze",
		penalty: -3
	},
	sub_ton: {
		name: "Sub-Ton",
		penalty: -2
	},
	special_delivery_failed: {
		name: "Special Delivery Failed",
		penalty: -2
	},
	bull_blind: {
		name: "Bull Blind",
		penalty: -1
	},
	century_drought: {
		name: "Century Drought",
		penalty: -2
	},
	wooden_spoon: {
		name: "Wooden Spoon",
		penalty: -3
	},
	volde_deux: {
		name: "Volde-D’eux",
		penalty: -2
	},
	volde_trois: {
		name: "Volde-Trois",
		penalty: -2
	}
});
var SCORE_MILESTONES = Object.freeze([
	100,
	200,
	300,
	400,
	500,
	600,
	700
]);
function esc(value) {
	return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function getState() {
	try {
		return state;
	} catch (_) {
		return null;
	}
}
function xpPrefetchKey(st) {
	const token = Number(st && st.__gameToken || 0);
	const names = (Array.isArray(st && st.players) ? st.players : []).map((player) => rawPlayerName(player).toLowerCase());
	return token + "|" + names.join("|");
}
function existingXpRows(host, st) {
	try {
		const pref = host && host.__sqGcXpPrefetch;
		if (!pref || pref.key !== xpPrefetchKey(st)) return null;
		if (Array.isArray(pref.resolved)) return Promise.resolve(pref.resolved);
		if (pref.promise && typeof pref.promise.then === "function") return pref.promise;
	} catch (_) {}
	return null;
}
function modeKey(st) {
	try {
		if (typeof window.__sqComputeGameMode === "function") return String(window.__sqComputeGameMode() || "").toLowerCase();
	} catch (_) {}
	return String(st && (st.gameMode || st.mode || st.match?.mode || st.match?.gameMode) || "").toLowerCase();
}
function isRankedXpMode(st) {
	try {
		if (typeof window.__sqIsVsShadowRuntime === "function" && window.__sqIsVsShadowRuntime()) return false;
	} catch (_) {}
	const mode = modeKey(st);
	if (mode === "training" || mode === "turbo" || mode === "practice") return false;
	if (st && (st.isPractice === true || st.is_practice === true)) return false;
	return true;
}
function norm$1(value) {
	return String(value == null ? "" : value).trim().toLowerCase();
}
function rawPlayerName(player) {
	return String(player && (player.name || player.player) || "").trim();
}
function prettyPlayerName(player, index) {
	try {
		if (typeof window.__sqPlayerPretty === "function") {
			const pretty = window.__sqPlayerPretty(player);
			if (pretty) return String(pretty);
		}
	} catch (_) {}
	return rawPlayerName(player) || `Player ${index + 1}`;
}
function scoreRowsTotal(rows) {
	return (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(row && row.roundTotal || 0), 0);
}
function roundTotals$1(rows) {
	return (Array.isArray(rows) ? rows : []).map((row) => Number(row && row.roundTotal || 0));
}
function maxRun(values, predicate) {
	let best = 0;
	let run = 0;
	values.forEach((value) => {
		if (predicate(value)) {
			run += 1;
			best = Math.max(best, run);
		} else run = 0;
	});
	return best;
}
function voldeHitCount(rows, roundIndex, expectedKind) {
	const row = Array.isArray(rows) ? rows[roundIndex] : null;
	return (row && Array.isArray(row.darts) ? row.darts : []).filter((dart) => {
		const kind = String(dart && (dart.kind || dart.type) || "").trim().toLowerCase();
		const sector = Number(dart && dart.sector);
		return (expectedKind === "double" ? kind === "d" || kind === "double" : kind === "t" || kind === "triple") && Number.isInteger(sector) && sector >= 1 && sector <= 5;
	}).length;
}
function isVoldeCode(code) {
	return code === "volde_deux" || code === "volde_trois";
}
function detectImmediateMisfires(rows, total) {
	const values = roundTotals$1(rows);
	const events = [];
	const add = (code) => {
		if (events.some((event) => event.code === code)) return;
		const meta = MISFIRE_META[code];
		if (meta) events.push({
			code,
			name: meta.name,
			penalty: meta.penalty,
			count: 1
		});
	};
	const addVolde = (code, count) => {
		const meta = MISFIRE_META[code];
		if (!meta || !(count > 0)) return;
		events.push({
			code,
			name: meta.name,
			count,
			unitPenalty: meta.penalty,
			penalty: meta.penalty * count,
			stacking: true
		});
	};
	if (values.length >= 3 && values.slice(0, 3).every((value) => value === 0)) add("cold_start");
	const zeroRun = maxRun(values, (value) => value === 0);
	if (zeroRun >= 3) add("ghost_town");
	if (zeroRun >= 5) add("deep_freeze");
	if (Number(total || 0) < 100) add("sub_ton");
	if (values.length >= 14 && values[11] === 0 && values[12] === 0 && values[13] === 0) add("special_delivery_failed");
	if (values.length >= 14 && values[13] === 0) add("bull_blind");
	addVolde("volde_deux", voldeHitCount(rows, 11, "double"));
	addVolde("volde_trois", voldeHitCount(rows, 12, "triple"));
	return events;
}
function appliedMisfirePenalty(events) {
	const source = Array.isArray(events) ? events : [];
	const normal = source.filter((event) => !isVoldeCode(event && event.code)).map((event) => Number(event && event.penalty || 0)).filter((value) => value < 0);
	return (normal.length ? Math.max(-5, Math.min(...normal)) : 0) + source.filter((event) => isVoldeCode(event && event.code)).reduce((sum, event) => sum + Math.min(0, Number(event && event.penalty || 0)), 0);
}
function injectStyles() {
	if (document.getElementById(STYLE_ID$2)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID$2;
	style.textContent = `
.gc-xp-row.sq-xp-detailed{ padding:11px 12px 11px 15px; }
.gc-xp-row.sq-xp-detailed .gc-xp-head{
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  align-items:start;
  gap:8px 12px;
  flex-wrap:initial;
}
.gc-xp-row.sq-xp-detailed .gc-xp-name{
  min-width:0;
  display:block;
  padding-top:2px;
  padding-right:4px;
  font-size:15px;
  line-height:1.16;
  font-weight:900;
}
.gc-xp-row.sq-xp-detailed .gc-xp-name .nm{
  display:block;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.gc-xp-rankstack{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  justify-content:flex-start;
  gap:5px;
  min-width:102px;
}
.gc-xp-rankstack .gc-xp-lvholder{ display:flex; justify-content:flex-end; }
.gc-xp-row.sq-xp-detailed .gc-xp-lvup{
  display:block;
  margin:0 2px 0 0;
  font-size:10px;
  line-height:1;
  text-align:right;
  white-space:nowrap;
}
.gc-xp-row.sq-xp-detailed .gc-xp-gain{
  margin-top:7px;
  font-size:15px;
  line-height:1;
}
.gc-xp-breakdown{
  display:flex;
  flex-direction:column;
  gap:6px;
  margin-top:10px;
  min-width:0;
}
.gc-xp-source-line{
  display:grid;
  grid-template-columns:58px minmax(0,1fr);
  align-items:center;
  gap:7px;
  min-width:0;
}
.gc-xp-source-label{
  color:rgba(235,240,250,.48);
  font-size:8px;
  line-height:1;
  font-weight:950;
  letter-spacing:.12em;
  text-transform:uppercase;
  white-space:nowrap;
}
.gc-xp-source-chips{
  display:flex;
  flex-wrap:nowrap;
  gap:6px;
  min-width:0;
  overflow-x:auto;
  overflow-y:hidden;
  padding:1px 2px 3px 0;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
  overscroll-behavior-inline:contain;
}
.gc-xp-source-chips::-webkit-scrollbar{ display:none; }
.gc-xp-source-chip{
  flex:0 0 auto;
  display:inline-flex;
  align-items:center;
  gap:5px;
  min-height:25px;
  padding:4px 9px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.11);
  background:rgba(255,255,255,.045);
  color:rgba(246,248,255,.9);
  font-size:10px;
  line-height:1;
  font-weight:850;
  white-space:nowrap;
}
.gc-xp-source-chip.base{ border-color:rgba(255,148,64,.28); background:rgba(255,122,0,.08); color:#ffd0aa; }
.gc-xp-source-chip.positive{ border-color:rgba(177,111,255,.35); background:rgba(141,84,218,.12); color:#ebd8ff; }
.gc-xp-source-chip.milestone{ border-color:rgba(255,201,74,.38); background:rgba(255,190,58,.10); color:#ffe2a0; }
.gc-xp-source-chip.negative{ border-color:rgba(255,88,106,.36); background:rgba(150,28,48,.15); color:#ffbcc5; }
.gc-xp-source-chip.applied{ box-shadow:inset 0 0 0 1px rgba(255,88,106,.17); }
.gc-xp-source-chip.empty{ color:rgba(235,240,250,.38); border-color:rgba(255,255,255,.06); background:rgba(255,255,255,.025); }
@media(max-width:560px){
  .gc-xp-row.sq-xp-detailed .gc-xp-name{ font-size:14px; }
  .gc-xp-rankstack{ min-width:96px; }
  .gc-xp-source-line{ grid-template-columns:52px minmax(0,1fr); gap:5px; }
  .gc-xp-source-label{ font-size:7px; }
  .gc-xp-source-chip{ font-size:9px; padding:4px 8px; }
}
@media(prefers-reduced-motion:reduce){
  .gc-xp-row.sq-xp-detailed,.gc-xp-row.sq-xp-detailed .gc-xp-fill,.gc-xp-row.sq-xp-detailed .gc-xp-lvup{ transition:none!important; animation:none!important; }
}
`;
	document.head.appendChild(style);
}
function playerKey(playerRow) {
	const id = String(playerRow && playerRow.playerId || "").trim();
	return id ? `id:${id}` : `nm:${norm$1(playerRow && playerRow.rawName)}`;
}
function keyFromHistoryRow(row) {
	const id = String(row && row.player_id || "").trim();
	return id ? `id:${id}` : `nm:${norm$1(row && row.player_name)}`;
}
async function fetchCloudContext(host, playerRows) {
	const context = {
		previousBest: /* @__PURE__ */ new Map(),
		priorGames: /* @__PURE__ */ new Map(),
		allRowsByGame: /* @__PURE__ */ new Map(),
		historyAvailable: false
	};
	const client = host && host.sb;
	if (!client || typeof client.from !== "function") return context;
	try {
		const bestRes = await client.from("v_player_best_official_ranked").select("player_id,player_name,best_score");
		if (!bestRes?.error && Array.isArray(bestRes?.data)) bestRes.data.forEach((row) => {
			const id = String(row && row.player_id || "").trim();
			const name = norm$1(row && row.player_name);
			const value = Number(row && row.best_score || 0);
			if (id) context.previousBest.set(`id:${id}`, value);
			if (name) context.previousBest.set(`nm:${name}`, value);
		});
	} catch (_) {}
	try {
		const ids = playerRows.map((row) => row.playerId).filter(Boolean);
		const names = playerRows.map((row) => row.rawName).filter(Boolean);
		let query = client.from("v_player_game_scores_official_clean").select("game_id,ts,player_id,player_name,score").order("ts", { ascending: false }).limit(Math.max(120, playerRows.length * 24));
		if (ids.length === playerRows.length && typeof query.in === "function") query = query.in("player_id", ids);
		else if (names.length && typeof query.in === "function") query = query.in("player_name", names);
		const histRes = await query;
		if (histRes?.error || !Array.isArray(histRes?.data)) return context;
		const grouped = /* @__PURE__ */ new Map();
		histRes.data.forEach((row) => {
			const key = keyFromHistoryRow(row);
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key).push(row);
		});
		const neededGameIds = /* @__PURE__ */ new Set();
		playerRows.forEach((playerRow) => {
			const key = playerKey(playerRow);
			const rows = grouped.get(key) || grouped.get(`nm:${norm$1(playerRow.rawName)}`) || [];
			const seen = /* @__PURE__ */ new Set();
			const prior = [];
			rows.forEach((row) => {
				const gameId = String(row && row.game_id || "");
				if (!gameId || seen.has(gameId) || prior.length >= 10) return;
				seen.add(gameId);
				prior.push({
					gameId,
					score: Number(row && row.score || 0),
					ts: row && row.ts || null,
					playerId: String(row && row.player_id || ""),
					playerName: String(row && row.player_name || "")
				});
				neededGameIds.add(gameId);
			});
			context.priorGames.set(key, prior);
		});
		const gameIds = Array.from(neededGameIds);
		if (gameIds.length) {
			let allQuery = client.from("v_player_game_scores_official_clean").select("game_id,player_id,player_name,score");
			if (typeof allQuery.in === "function") allQuery = allQuery.in("game_id", gameIds);
			const allRes = await allQuery;
			if (!allRes?.error && Array.isArray(allRes?.data)) allRes.data.forEach((row) => {
				const gameId = String(row && row.game_id || "");
				if (!gameId) return;
				if (!context.allRowsByGame.has(gameId)) context.allRowsByGame.set(gameId, []);
				context.allRowsByGame.get(gameId).push(row);
			});
		}
		context.historyAvailable = true;
	} catch (err) {
		try {
			console.warn("[SC-038] XP breakdown history unavailable", err);
		} catch (_) {}
	}
	return context;
}
function previousBestFor(context, row) {
	const byId = row.playerId ? context.previousBest.get(`id:${row.playerId}`) : null;
	if (Number.isFinite(Number(byId))) return Number(byId);
	const byName = context.previousBest.get(`nm:${norm$1(row.rawName)}`);
	return Number.isFinite(Number(byName)) ? Number(byName) : 0;
}
function isUniqueLastInSavedGame(context, priorGame, row) {
	const rows = context.allRowsByGame.get(priorGame.gameId) || [];
	if (!rows.length) return false;
	const scores = rows.map((item) => Number(item && item.score || 0));
	const min = Math.min(...scores);
	if (scores.filter((score) => score === min).length !== 1) return false;
	const mine = rows.find((item) => {
		const id = String(item && item.player_id || "");
		if (row.playerId && id) return id === row.playerId;
		return norm$1(item && item.player_name) === norm$1(row.rawName);
	});
	return !!mine && Number(mine.score || 0) === min;
}
function addStreakMisfires(events, context, row, currentTotal, currentUniqueLast) {
	const prior = context.priorGames.get(playerKey(row)) || context.priorGames.get(`nm:${norm$1(row.rawName)}`) || [];
	if (prior.length >= 4 && Number(currentTotal || 0) < 100) {
		const previousFour = prior.slice(0, 4).every((game) => Number(game.score || 0) < 100);
		const previousFiveAlready = prior.length >= 5 && Number(prior[4].score || 0) < 100;
		if (previousFour && !previousFiveAlready) {
			const meta = MISFIRE_META.century_drought;
			events.push({
				code: "century_drought",
				name: meta.name,
				penalty: meta.penalty
			});
		}
	}
	if (prior.length >= 4 && currentUniqueLast) {
		const previousFour = prior.slice(0, 4).every((game) => isUniqueLastInSavedGame(context, game, row));
		const previousFiveAlready = prior.length >= 5 && isUniqueLastInSavedGame(context, prior[4], row);
		if (previousFour && !previousFiveAlready) {
			const meta = MISFIRE_META.wooden_spoon;
			events.push({
				code: "wooden_spoon",
				name: meta.name,
				penalty: meta.penalty
			});
		}
	}
}
function awardMapFromRuntime(host, board, players, st) {
	const byPlayer = /* @__PURE__ */ new Map();
	try {
		(host.SQ_ACH.detectGame(board, {
			players,
			is_tiebreak: !!(st.is_tiebreak || st.currentGameIsTiebreak)
		}) || []).forEach((result) => {
			const map = /* @__PURE__ */ new Map();
			(result && Array.isArray(result.earned) ? result.earned : []).forEach((event) => {
				map.set(event.code, Math.max(1, Number(event.count || 1)));
			});
			byPlayer.set(Number(result.player), map);
		});
	} catch (err) {
		try {
			console.warn("[SC-038] XP award detector unavailable", err);
		} catch (_) {}
	}
	return byPlayer;
}
function addAwardIfKnown(host, map, code, count = 1) {
	if (!code || map.has(code)) return;
	try {
		const meta = host.SQ_ACH.meta(code);
		if (meta && Number(meta.xp || 0) > 0) map.set(code, Math.max(1, Number(count || 1)));
	} catch (_) {}
}
function supplementCurrentGameAwards(host, map, playerIndex, rows, totals, st, context, playerRow) {
	const total = Number(totals[playerIndex] || 0);
	const maxTotal = Math.max(0, ...totals);
	const topCount = totals.filter((value) => value === maxTotal).length;
	const uniqueWin = maxTotal > 0 && total === maxTotal && topCount === 1;
	const prevBest = previousBestFor(context, playerRow);
	SCORE_MILESTONES.forEach((threshold) => {
		if (total >= threshold && prevBest < threshold) addAwardIfKnown(host, map, `score_${threshold}`);
	});
	if (uniqueWin) {
		const runners = totals.filter((_, index) => index !== playerIndex);
		const margin = total - (runners.length ? Math.max(...runners) : 0);
		if (margin >= 1 && margin <= 10) addAwardIfKnown(host, map, "photo_finish");
		if (margin >= 200) addAwardIfKnown(host, map, "runaway");
		const running = totals.map(() => 0);
		for (let roundIndex = 0; roundIndex <= 11; roundIndex += 1) totals.forEach((_, p) => {
			running[p] += Number(st.score?.[p]?.[roundIndex]?.roundTotal || 0);
		});
		if (running[playerIndex] < Math.max(...running)) addAwardIfKnown(host, map, "last_gasp");
	}
	const values = roundTotals$1(rows);
	if (maxRun(values, (value) => value > 0) >= 10) addAwardIfKnown(host, map, "steady_eddie");
	if (maxRun(values, (value) => value >= 100) >= 2) addAwardIfKnown(host, map, "century_streak");
	if (prevBest > 0 && total >= prevBest + 100) addAwardIfKnown(host, map, "pb_smasher");
	if (map.has("double_trouble") && map.has("triple_threat") && map.has("bull_run")) addAwardIfKnown(host, map, "special_forces");
	if (uniqueWin) {
		const myPrior = context.priorGames.get(playerKey(playerRow)) || context.priorGames.get(`nm:${norm$1(playerRow.rawName)}`) || [];
		if (myPrior.length >= 10) {
			const myAvg = myPrior.slice(0, 10).reduce((sum, game) => sum + Number(game.score || 0), 0) / 10;
			if (playerRow.allPlayerRows.some((other, otherIndex) => {
				if (otherIndex === playerIndex) return false;
				const prior = context.priorGames.get(playerKey(other)) || context.priorGames.get(`nm:${norm$1(other.rawName)}`) || [];
				if (prior.length < 10) return false;
				return prior.slice(0, 10).reduce((sum, game) => sum + Number(game.score || 0), 0) / 10 - myAvg >= 200;
			})) addAwardIfKnown(host, map, "david_and_goliath");
		}
	}
	const matchGameTotals = (Array.isArray(st.match?.history) ? st.match.history : []).map((game) => Array.isArray(game?.totals) ? game.totals.map(Number) : []);
	matchGameTotals.push(totals.map(Number));
	const results = matchGameTotals.map((gameTotals) => {
		const max = Math.max(0, ...gameTotals);
		const count = gameTotals.filter((value) => value === max).length;
		return max > 0 && count === 1 && Number(gameTotals[playerIndex] || 0) === max;
	});
	const targetWins = Number(st.match?.targetWins || 1);
	const winsAfter = results.filter(Boolean).length;
	if (uniqueWin && winsAfter >= targetWins && targetWins >= 3) {
		addAwardIfKnown(host, map, "champion");
		if (results.length === targetWins && results.every(Boolean)) addAwardIfKnown(host, map, "clean_sweep");
		if (targetWins === 3 && results.length >= 5) {
			const tail = results.slice(-5);
			if (!tail[0] && !tail[1] && tail[2] && tail[3] && tail[4]) addAwardIfKnown(host, map, "reverse_sweep");
		}
	}
}
function awardDetails(host, map) {
	const details = [];
	map.forEach((count, code) => {
		try {
			const meta = host.SQ_ACH.meta(code);
			const each = Number(meta && meta.xp || 0);
			if (!(each > 0)) return;
			details.push({
				code,
				count,
				xp: each * count,
				name: String(meta.name || code),
				icon: String(meta.icon || "★"),
				tier: meta.tier,
				milestone: !!(host.SQ_ACH.isMilestone && host.SQ_ACH.isMilestone(code))
			});
		} catch (_) {}
	});
	return details.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
}
function matchWinBaseXp(st, playerIndex, totals) {
	const targetWins = Number(st.match?.targetWins || 1);
	if (targetWins < 2) return 0;
	const max = Math.max(0, ...totals);
	if (!(max > 0 && totals.filter((value) => value === max).length === 1) || Number(totals[playerIndex] || 0) !== max) return 0;
	if (Number(st.match?.wins?.[playerIndex] || 0) + 1 < targetWins) return 0;
	return 150;
}
function makeChip(text, kind, extraClass = "") {
	const chip = document.createElement("span");
	chip.className = `gc-xp-source-chip ${kind}${extraClass ? ` ${extraClass}` : ""}`;
	chip.textContent = text;
	return chip;
}
function makeSourceLine(label) {
	const line = document.createElement("div");
	line.className = "gc-xp-source-line";
	const lab = document.createElement("div");
	lab.className = "gc-xp-source-label";
	lab.textContent = label;
	const chips = document.createElement("div");
	chips.className = "gc-xp-source-chips";
	line.append(lab, chips);
	return {
		line,
		chips
	};
}
function rankChip(host, holder, progress) {
	holder.replaceChildren();
	try {
		if (typeof host.__sqXpChip === "function") {
			holder.appendChild(host.__sqXpChip(progress));
			return;
		}
	} catch (_) {}
	const fallback = document.createElement("span");
	fallback.className = "gc-xp-source-chip base";
	fallback.textContent = `LV ${Number(progress && progress.level || 1)}`;
	holder.appendChild(fallback);
}
function buildDetailedRow(host, data) {
	const pre = host.SQ_XP.progress(data.pre);
	const post = host.SQ_XP.progress(data.post);
	const el = document.createElement("div");
	el.className = `gc-xp-row sq-xp-detailed${data.won ? " won" : ""}`;
	el.innerHTML = `
    <div class="gc-xp-head">
      <span class="gc-xp-name"><span class="nm">${esc(data.name)}</span></span>
      <span class="gc-xp-rankstack"><span class="gc-xp-lvholder"></span><span class="gc-xp-lvup">LEVEL UP!</span></span>
    </div>
    <div class="gc-xp-gain">${data.netXp >= 0 ? "+" : ""}${data.netXp} XP</div>
    <div class="gc-xp-bar"><div class="gc-xp-fill"></div></div>
    <div class="gc-xp-breakdown"></div>
  `;
	const rankHolder = el.querySelector(".gc-xp-lvholder");
	rankChip(host, rankHolder, pre);
	const breakdown = el.querySelector(".gc-xp-breakdown");
	const base = makeSourceLine("BASE XP");
	data.base.forEach((item) => base.chips.appendChild(makeChip(`${item.label} +${item.xp} XP`, "base")));
	if (!data.base.length) base.chips.appendChild(makeChip("NONE", "empty"));
	breakdown.appendChild(base.line);
	const positive = makeSourceLine("POSITIVE");
	data.positive.forEach((item) => {
		const countText = item.count > 1 ? ` ×${item.count}` : "";
		const chip = makeChip(`${item.icon} ${item.name}${countText} +${item.xp} XP`, item.milestone ? "milestone" : "positive");
		positive.chips.appendChild(chip);
	});
	if (!data.positive.length) positive.chips.appendChild(makeChip("NO NEW AWARDS", "empty"));
	breakdown.appendChild(positive.line);
	const negative = makeSourceLine("NEGATIVE");
	if (data.negative.length) data.negative.forEach((item) => {
		const applied = !!item.applied;
		const countText = Number(item.count || 1) > 1 ? ` ×${Number(item.count)}` : "";
		negative.chips.appendChild(makeChip(`${item.name}${countText} ${item.penalty} XP${applied ? " · APPLIED" : ""}`, "negative", applied ? "applied" : ""));
	});
	else negative.chips.appendChild(makeChip("NO MISFIRES", "empty"));
	breakdown.appendChild(negative.line);
	return {
		el,
		pre,
		post,
		rankHolder
	};
}
function animateCount(el, from, to, duration) {
	const start = performance.now();
	const format = (value) => `${value >= 0 ? "+" : ""}${value} XP`;
	function tick(now) {
		const k = Math.min(1, (now - start) / duration);
		const eased = 1 - Math.pow(1 - k, 2);
		const value = Math.round(from + (to - from) * eased);
		el.textContent = format(value);
		if (k < 1) requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
}
async function animateDetailedRow(host, built, data, reduced) {
	const { el, pre, post, rankHolder } = built;
	const gain = el.querySelector(".gc-xp-gain");
	const fill = el.querySelector(".gc-xp-fill");
	const levelUp = el.querySelector(".gc-xp-lvup");
	const didLevel = Number(post.level || 0) > Number(pre.level || 0);
	if (reduced) {
		el.classList.add("in");
		fill.style.transition = "none";
		fill.style.width = `${Math.max(0, Math.min(1, Number(post.pct || 0))) * 100}%`;
		if (didLevel) {
			rankChip(host, rankHolder, post);
			levelUp.classList.add("in");
		}
		return;
	}
	gain.textContent = "+0 XP";
	await new Promise((resolve) => setTimeout(resolve, 70));
	el.classList.add("in");
	animateCount(gain, 0, data.netXp, 600);
	fill.style.width = `${Math.max(0, Math.min(1, Number(pre.pct || 0))) * 100}%`;
	await new Promise((resolve) => requestAnimationFrame(() => resolve()));
	if (didLevel) {
		fill.style.width = "100%";
		await new Promise((resolve) => setTimeout(resolve, 460));
		rankChip(host, rankHolder, post);
		levelUp.classList.add("in");
		el.classList.add("gc-levelup");
		try {
			if (typeof host.__sqV3SndGame === "function") host.__sqV3SndGame();
		} catch (_) {}
		fill.style.transition = "none";
		fill.style.width = "0%";
		await new Promise((resolve) => requestAnimationFrame(() => resolve()));
		fill.style.transition = "";
		fill.style.width = `${Math.max(0, Math.min(1, Number(post.pct || 0))) * 100}%`;
	} else fill.style.width = `${Math.max(0, Math.min(1, Number(post.pct || 0))) * 100}%`;
	await new Promise((resolve) => setTimeout(resolve, didLevel ? 450 : 300));
}
async function buildPlayerData(host, st) {
	const board = Array.isArray(st.score) ? st.score : [];
	const statePlayers = Array.isArray(st.players) ? st.players : [];
	const totals = statePlayers.map((_, index) => scoreRowsTotal(board[index]));
	const maxTotal = Math.max(0, ...totals);
	const deciderWinner = st._decider && st._decider.resolved && Number.isInteger(st._decider.winner) ? st._decider.winner : null;
	let prefetchedXp = null;
	try {
		const existing = existingXpRows(host, st);
		if (existing) prefetchedXp = await existing;
	} catch (_) {}
	const playerRows = await Promise.all(statePlayers.map(async (player, index) => {
		const rawName = rawPlayerName(player);
		let xpRow = Array.isArray(prefetchedXp) ? prefetchedXp[index] : null;
		if (!xpRow) try {
			xpRow = await host.SQ_XP.forName(rawName);
		} catch (_) {}
		return {
			index,
			player,
			rawName,
			name: prettyPlayerName(player, index),
			playerId: String(xpRow && xpRow.player_id || player && (player.player_id || player.id) || "").trim(),
			pre: Number(xpRow && xpRow.total_xp || 0),
			allPlayerRows: null
		};
	}));
	playerRows.forEach((row) => {
		row.allPlayerRows = playerRows;
	});
	const context = await fetchCloudContext(host, playerRows);
	const runtimeAwards = awardMapFromRuntime(host, board, playerRows.map((row) => ({
		name: row.name,
		rawName: row.rawName
	})), st);
	const minTotal = Math.min(...totals);
	const bottomCount = totals.filter((value) => value === minTotal).length;
	return playerRows.map((row) => {
		const p = row.index;
		const won = deciderWinner != null ? p === deciderWinner : maxTotal > 0 && totals[p] === maxTotal;
		const awardMap = runtimeAwards.get(p) || /* @__PURE__ */ new Map();
		supplementCurrentGameAwards(host, awardMap, p, board[p] || [], totals, st, context, row);
		const positive = awardDetails(host, awardMap);
		const negative = detectImmediateMisfires(board[p] || [], totals[p]);
		addStreakMisfires(negative, context, row, totals[p], bottomCount === 1 && totals[p] === minTotal);
		const normalWorst = negative.filter((item) => !isVoldeCode(item && item.code)).reduce((worst, item) => Math.min(worst, Number(item && item.penalty || 0)), 0);
		negative.forEach((item) => {
			item.applied = isVoldeCode(item && item.code) ? Number(item && item.penalty || 0) < 0 : normalWorst < 0 && Number(item && item.penalty || 0) === normalWorst;
		});
		const penalty = appliedMisfirePenalty(negative);
		const scoreXp = Math.round(Number(totals[p] || 0) * Number(host.SQ_XP.W.point || 0));
		const gameXp = Number(host.SQ_XP.W.game || 0);
		const winXp = won ? Number(host.SQ_XP.W.gameWin || 0) : 0;
		const matchXp = matchWinBaseXp(st, p, totals);
		const base = [{
			label: "SCORE",
			xp: scoreXp
		}, {
			label: "GAME",
			xp: gameXp
		}];
		if (winXp) base.push({
			label: "WIN",
			xp: winXp
		});
		if (matchXp) base.push({
			label: "MATCH WIN",
			xp: matchXp
		});
		const positiveXp = positive.reduce((sum, item) => sum + Number(item.xp || 0), 0);
		const netXp = base.reduce((sum, item) => sum + Number(item.xp || 0), 0) + positiveXp + penalty;
		return {
			...row,
			won,
			total: totals[p],
			base,
			positive,
			negative,
			penalty,
			netXp,
			post: Math.max(0, row.pre + netXp)
		};
	}).sort((a, b) => Number(b.won) - Number(a.won) || b.netXp - a.netXp);
}
function startDetailedXpPrefetch(host, st = getState()) {
	try {
		if (!host || !st || !host.SQ_XP || !host.SQ_ACH || !isRankedXpMode(st)) return Promise.resolve(null);
		const key = xpPrefetchKey(st);
		const existing = host.__sqSc038XpPrefetch;
		if (existing && existing.key === key && existing.promise) return existing.promise;
		const promise = buildPlayerData(host, st).then((data) => {
			try {
				if (host.__sqSc038XpPrefetch && host.__sqSc038XpPrefetch.key === key) {
					host.__sqSc038XpPrefetch.resolved = data;
					host.__sqSc038XpPrefetch.resolvedAt = performance.now();
				}
			} catch (_) {}
			return data;
		});
		host.__sqSc038XpPrefetch = {
			key,
			promise,
			resolved: null,
			startedAt: performance.now()
		};
		return promise;
	} catch (_) {
		return Promise.resolve(null);
	}
}
async function detailedReveal(hostEl, onComplete, original, host) {
	const st = getState();
	if (!st || !Array.isArray(st.score) || !host.SQ_XP || !host.SQ_ACH || !isRankedXpMode(st)) return original(hostEl, onComplete);
	try {
		injectStyles();
		const data = await startDetailedXpPrefetch(host, st);
		const reduced = typeof host.__sqV3Reduced === "function" ? !!host.__sqV3Reduced() : false;
		const panel = document.createElement("div");
		panel.className = "gc-xp-panel sq-xp-detailed-panel";
		const title = document.createElement("div");
		title.className = "gc-xp-title";
		title.textContent = "XP EARNED";
		panel.appendChild(title);
		hostEl.replaceChildren(panel);
		const builtRows = data.map((row) => ({
			row,
			built: buildDetailedRow(host, row)
		}));
		builtRows.forEach(({ built }) => panel.appendChild(built.el));
		await Promise.all(builtRows.map(({ row, built }) => animateDetailedRow(host, built, row, reduced)));
		try {
			host.SQ_XP._cache = null;
			host.SQ_ACH._cache = {};
		} catch (_) {}
		if (typeof onComplete === "function") onComplete();
	} catch (err) {
		try {
			console.error("[SC-038] detailed XP breakdown failed; restoring canonical renderer", err);
		} catch (_) {}
		try {
			hostEl.replaceChildren();
		} catch (_) {}
		return original(hostEl, onComplete);
	}
}
function installXpBreakdown(host = globalThis) {
	if (!host || typeof document === "undefined") return false;
	if (host[INSTALL_FLAG]) return true;
	const original = host.__sqGcXpReveal;
	if (typeof original !== "function") return false;
	if (original.__sqSc038DetailedBreakdown) {
		host[INSTALL_FLAG] = true;
		return true;
	}
	const detailed = function(hostEl, onComplete) {
		return detailedReveal(hostEl, onComplete, original, host);
	};
	detailed.__sqSc038DetailedBreakdown = true;
	detailed[ORIGINAL_KEY] = original;
	host.__sqGcXpReveal = detailed;
	host[INSTALL_FLAG] = true;
	host.__sqSc038StartXpPrefetch = (st) => startDetailedXpPrefetch(host, st || getState());
	host.__sqSc038XpBreakdown = {
		detectImmediateMisfires,
		appliedMisfirePenalty
	};
	injectStyles();
	return true;
}
function boot$1() {
	let tries = 0;
	const attempt = () => {
		tries += 1;
		if (installXpBreakdown(window) || tries >= 120) return;
		setTimeout(attempt, 50);
	};
	attempt();
}
if (typeof window !== "undefined" && typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot$1, { once: true });
	else boot$1();
}
//#endregion
//#region src/live-game/postgame-release-guard.mjs
var STYLE_ID$1 = "sq-sc038-result-stat-polish";
function ensureReleasePolish() {
	if (document.getElementById(STYLE_ID$1)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID$1;
	style.textContent = `
.modal-gamecomplete.sq-gc-arcade .gc-statRow .gc-statValue{
  font-size:clamp(18px,4.8vw,24px) !important;
  font-weight:500 !important;
  line-height:1.05 !important;
  white-space:nowrap !important;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-xp-screen:not([hidden]){
  min-height:120px;
}
`;
	document.head.appendChild(style);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureReleasePolish, { once: true });
else ensureReleasePolish();
//#endregion
//#region src/live-game/bull-colours.mjs
var STYLE_ID = "sq-sc038-bull-colours";
function installBullColours() {
	if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
/* Canonical Bull round row has no data-bull attributes; target the Bull-only
   row structurally so number-round S/D/T controls remain untouched. */
body.livev2-on[data-page="game"] #pad .dtBullRow:not(.dtScoreRow) .dtBullBtn:first-child:not(.inner),
body .modal-decider .dtBullRow .dtBullBtn[data-bull="Outer"]{
  background:linear-gradient(180deg,rgba(18,92,52,.90),rgba(8,48,29,.98)) !important;
  border-color:rgba(72,224,124,.86) !important;
  color:#bcffd2 !important;
  box-shadow:0 0 0 1px rgba(47,208,107,.12),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(220,255,232,.10),0 0 18px rgba(47,208,107,.12) !important;
}
body.livev2-on[data-page="game"] #pad .dtBullRow:not(.dtScoreRow) .dtBullBtn.inner,
body .modal-decider .dtBullRow .dtBullBtn.inner[data-bull="Inner"]{
  background:linear-gradient(180deg,rgba(126,27,42,.92),rgba(62,10,23,.98)) !important;
  border-color:rgba(255,77,94,.88) !important;
  color:#ffc1c8 !important;
  box-shadow:0 0 0 1px rgba(255,77,94,.11),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,225,229,.10),0 0 18px rgba(255,77,94,.11) !important;
}
`;
	document.head.appendChild(style);
}
if (typeof document !== "undefined") installBullColours();
//#endregion
//#region src/live-game/dmd/controller.mjs
var VERSION$1 = "2.1.0-sc030-modular";
var PRIORITY = Object.freeze({
	IDLE: 0,
	THROW: 10,
	VISIT: 20,
	COMPETITIVE: 30,
	ACHIEVEMENT: 40,
	RECORD: 50,
	GAME: 60
});
var DEFAULT_DURATION = Object.freeze({
	[PRIORITY.THROW]: 500,
	[PRIORITY.VISIT]: 700,
	[PRIORITY.COMPETITIVE]: 850,
	[PRIORITY.ACHIEVEMENT]: 950,
	[PRIORITY.RECORD]: 1150,
	[PRIORITY.GAME]: 1400
});
var HAPTIC_PATTERNS = Object.freeze({
	tap: 8,
	hit: 10,
	double: [
		10,
		24,
		10
	],
	treble: [
		10,
		20,
		10,
		20,
		12
	],
	miss: 6,
	visit: 12,
	competitive: [
		12,
		24,
		18
	],
	major: [
		16,
		28,
		24
	]
});
function clean$1(value, max = 24) {
	return String(value == null ? "" : value).replace(/\s+/g, " ").trim().toUpperCase().slice(0, max);
}
function finite$1(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}
function signed(value) {
	const n = finite$1(value, 0);
	return `${n >= 0 ? "+" : ""}${Math.round(n)}`;
}
function targetLabel(target) {
	const raw = clean$1(target, 16);
	if (!raw) return "";
	if (raw === "D" || raw === "DOUBLE" || raw === "DOUBLES") return "DOUBLES";
	if (raw === "T" || raw === "TRIPLE" || raw === "TRIPLES" || raw === "TREBLE" || raw === "TREBLES") return "TREBLES";
	if (raw === "B" || raw === "BULL" || raw === "BULLS") return "BULL";
	return raw;
}
function makeMessage(event = {}) {
	const kind = clean$1(event.kind, 40);
	const total = Number.isFinite(Number(event.total)) ? `TOTAL ${Math.round(Number(event.total))}` : "";
	const player = clean$1(event.player, 14);
	const target = targetLabel(event.target);
	const dart = Math.min(3, Math.max(1, Math.round(finite$1(event.dart, 1))));
	const score = Math.round(finite$1(event.points, 0));
	const visit = Math.round(finite$1(event.visitPoints, 0));
	const margin = Math.round(finite$1(event.margin, 0));
	const gameScore = Math.round(finite$1(event.gameScore, finite$1(event.total, 0)));
	const matchScore = clean$1(event.matchScore, 12);
	const achievement = clean$1(event.achievement, 22);
	switch (kind) {
		case "PLAYER_UP": return {
			priority: PRIORITY.IDLE,
			headline: player ? `${player} UP` : "TO THROW",
			subline: target ? `TARGET ${target}` : "",
			type: "hold",
			duration: 0,
			haptic: null
		};
		case "TARGET": return {
			priority: PRIORITY.IDLE,
			headline: target ? `TARGET ${target}` : "TARGET",
			subline: player ? `${player} UP` : "",
			type: "hold",
			duration: 0,
			haptic: null
		};
		case "HIT_SINGLE": return {
			priority: PRIORITY.THROW,
			headline: `SINGLE +${score}`,
			subline: total,
			type: "hold",
			haptic: "hit"
		};
		case "HIT_DOUBLE": return {
			priority: PRIORITY.THROW,
			headline: `DOUBLE +${score}`,
			subline: total,
			type: "hold",
			haptic: "double"
		};
		case "HIT_TREBLE": return {
			priority: PRIORITY.THROW,
			headline: `TREBLE +${score}`,
			subline: total,
			type: "hold",
			haptic: "treble"
		};
		case "OUTER_BULL": return {
			priority: PRIORITY.THROW,
			headline: "OUTER BULL +25",
			subline: total,
			type: "hold",
			haptic: "double"
		};
		case "BULLSEYE": return {
			priority: PRIORITY.VISIT,
			headline: "BULLSEYE +50",
			subline: total,
			type: "hold",
			haptic: "major"
		};
		case "MISS": return {
			priority: PRIORITY.THROW,
			headline: "MISS",
			subline: `DART ${dart} OF 3`,
			type: "hold",
			haptic: "miss"
		};
		case "SCRATCH":
		case "MISS_X3": return {
			priority: PRIORITY.VISIT,
			headline: "SCRATCH",
			subline: "NO SCORE",
			type: "hold",
			haptic: "miss"
		};
		case "VISIT_COMPLETE": return {
			priority: PRIORITY.VISIT,
			headline: `VISIT +${visit}`,
			subline: total,
			type: "hold",
			haptic: "visit"
		};
		case "NEW_LEADER": return {
			priority: PRIORITY.COMPETITIVE,
			headline: "NEW LEADER",
			subline: player ? `${player} ${signed(margin)}` : signed(margin),
			type: "hold",
			haptic: "competitive"
		};
		case "LEVEL": return {
			priority: PRIORITY.COMPETITIVE,
			headline: "LEVEL",
			subline: clean$1(event.scoreLine || event.totalLine || "", 18),
			type: "hold",
			haptic: "competitive"
		};
		case "ROUND_DOUBLES": return {
			priority: PRIORITY.COMPETITIVE,
			headline: "DOUBLES",
			subline: clean$1(event.roundLabel || "ROUND 12", 16),
			type: "hold",
			haptic: "competitive"
		};
		case "ROUND_TREBLES": return {
			priority: PRIORITY.COMPETITIVE,
			headline: "TREBLES",
			subline: clean$1(event.roundLabel || "ROUND 13", 16),
			type: "hold",
			haptic: "competitive"
		};
		case "ROUND_BULL": return {
			priority: PRIORITY.COMPETITIVE,
			headline: "BULL",
			subline: clean$1(event.roundLabel || "FINAL ROUND", 16),
			type: "hold",
			haptic: "major"
		};
		case "UNDO": return {
			priority: PRIORITY.VISIT,
			headline: "THROW UNDONE",
			subline: clean$1(event.subline || "SCORE RESTORED", 20),
			type: "hold",
			haptic: "tap"
		};
		case "SKIP": return {
			priority: PRIORITY.VISIT,
			headline: "TURN SKIPPED",
			subline: player ? `${player} UP` : "",
			type: "hold",
			haptic: "tap"
		};
		case "PERSONAL_BEST": return {
			priority: PRIORITY.RECORD,
			headline: "PERSONAL BEST!",
			subline: String(gameScore),
			type: "hold",
			haptic: "major"
		};
		case "SHATEKI_RECORD": return {
			priority: PRIORITY.RECORD,
			headline: "NEW SHATEKI RECORD",
			subline: String(gameScore),
			type: "hold",
			haptic: "major"
		};
		case "ACHIEVEMENT": return {
			priority: PRIORITY.ACHIEVEMENT,
			headline: "TROPHY UNLOCKED",
			subline: achievement,
			type: "hold",
			haptic: "major"
		};
		case "GAME_WON": return {
			priority: PRIORITY.GAME,
			headline: "GAME WON",
			subline: player ? `${player} · ${gameScore}` : String(gameScore),
			type: "hold",
			haptic: "major"
		};
		case "MATCH_WON": return {
			priority: PRIORITY.GAME,
			headline: "MATCH WON",
			subline: player ? `${player}${matchScore ? ` · ${matchScore}` : ""}` : matchScore,
			type: "hold",
			haptic: "major"
		};
		case "LAST_DART_HERO": return {
			priority: PRIORITY.ACHIEVEMENT,
			headline: "LAST DART HERO",
			subline: total,
			type: "lastDartImg",
			duration: 900,
			haptic: "major"
		};
		case "DESMOND_DELIGHT": return {
			priority: PRIORITY.ACHIEVEMENT,
			headline: "DESMOND DELIGHT",
			subline: total,
			type: "desmondImg",
			duration: 900,
			haptic: "major"
		};
		case "VOLDY": return {
			priority: PRIORITY.ACHIEVEMENT,
			headline: clean$1(event.headline || "VOLDY", 22),
			subline: total,
			type: "voldyImg",
			duration: 900,
			haptic: "major"
		};
		default: return {
			priority: Number.isFinite(Number(event.priority)) ? Number(event.priority) : PRIORITY.THROW,
			headline: clean$1(event.headline || kind, 24),
			subline: clean$1(event.subline || "", 24),
			type: clean$1(event.type || "hold", 24).toLowerCase(),
			duration: Number.isFinite(Number(event.duration)) ? Math.max(0, Number(event.duration)) : void 0,
			haptic: event.haptic || null
		};
	}
}
function supportsHaptics(nav) {
	return !!(nav && typeof nav.vibrate === "function");
}
function createHaptics(options = {}) {
	const nav = options.navigator || globalThis.navigator;
	let enabled = options.enabled === true;
	return {
		supported: () => supportsHaptics(nav),
		enabled: () => enabled,
		setEnabled(value) {
			enabled = !!value;
		},
		pulse(kind) {
			if (!enabled || !supportsHaptics(nav)) return false;
			const pattern = HAPTIC_PATTERNS[kind] || HAPTIC_PATTERNS.tap;
			try {
				return nav.vibrate(pattern) !== false;
			} catch (_) {
				return false;
			}
		},
		cancel() {
			if (!supportsHaptics(nav)) return false;
			try {
				return nav.vibrate(0) !== false;
			} catch (_) {
				return false;
			}
		}
	};
}
function defaultScheduler() {
	return {
		set(fn, ms) {
			return setTimeout(fn, ms);
		},
		clear(id) {
			clearTimeout(id);
		}
	};
}
function createController(options = {}) {
	const scheduler = options.scheduler || defaultScheduler();
	const now = typeof options.now === "function" ? options.now : () => Date.now();
	const render = typeof options.render === "function" ? options.render : () => {};
	const clearBackend = typeof options.clear === "function" ? options.clear : () => {};
	const restoreIdle = typeof options.restoreIdle === "function" ? options.restoreIdle : () => {};
	const haptics = options.haptics || createHaptics({ enabled: false });
	const maxQueue = Math.max(0, Math.min(4, finite$1(options.maxQueue, 2)));
	const staleLowPriorityMs = Math.max(250, finite$1(options.staleLowPriorityMs, 900));
	const queue = [];
	let active = null;
	let idleBaseline = null;
	let timer = null;
	let generation = 0;
	let suspended = false;
	let seq = 0;
	function durationFor(msg) {
		if (Number.isFinite(Number(msg.duration))) return Math.max(0, Number(msg.duration));
		return DEFAULT_DURATION[msg.priority] || 600;
	}
	function renderMessage(msg) {
		if (!msg || suspended) return;
		const ms = durationFor(msg);
		try {
			render({
				z2: clean$1(msg.headline, 24),
				z3: clean$1(msg.subline, 24)
			}, {
				type: msg.type || "hold",
				ms: ms || 2e3,
				amp: Number.isFinite(Number(msg.amp)) ? Number(msg.amp) : 3.2
			});
		} catch (_) {}
		if (msg.haptic) haptics.pulse(msg.haptic);
	}
	function cancelTimer() {
		if (timer != null) scheduler.clear(timer);
		timer = null;
	}
	function isStale(msg) {
		if (!msg || msg.priority > PRIORITY.VISIT || !Number.isFinite(msg.__queuedAt)) return false;
		return now() - msg.__queuedAt > staleLowPriorityMs;
	}
	function nextQueued() {
		queue.sort((a, b) => b.priority - a.priority || a.__seq - b.__seq);
		while (queue.length) {
			const candidate = queue.shift();
			if (!isStale(candidate)) return candidate;
		}
		return null;
	}
	function restore() {
		active = null;
		cancelTimer();
		const next = nextQueued();
		if (next) {
			showNow(next);
			return;
		}
		try {
			restoreIdle(idleBaseline);
		} catch (_) {}
	}
	function showNow(msg) {
		generation += 1;
		const token = generation;
		cancelTimer();
		try {
			clearBackend();
		} catch (_) {}
		active = msg;
		renderMessage(msg);
		const ms = durationFor(msg);
		if (ms > 0) timer = scheduler.set(() => {
			if (token !== generation) return;
			restore();
		}, ms);
	}
	function enqueue(msg) {
		if (maxQueue === 0) return;
		msg.__seq = ++seq;
		msg.__queuedAt = now();
		queue.push(msg);
		queue.sort((a, b) => b.priority - a.priority || a.__seq - b.__seq);
		while (queue.length > maxQueue) queue.pop();
	}
	function emit(event) {
		const msg = makeMessage(event);
		msg.priority = finite$1(msg.priority, PRIORITY.THROW);
		if (msg.priority === PRIORITY.IDLE) {
			idleBaseline = msg;
			if (!active) renderMessage(msg);
			return msg;
		}
		if (!active || msg.priority >= active.priority) showNow(msg);
		else enqueue(msg);
		return msg;
	}
	function hardClear({ restore: shouldRestore = true } = {}) {
		generation += 1;
		cancelTimer();
		queue.length = 0;
		active = null;
		try {
			clearBackend();
		} catch (_) {}
		haptics.cancel();
		if (shouldRestore) try {
			restoreIdle(idleBaseline);
		} catch (_) {}
	}
	function setSuspended(value) {
		const next = !!value;
		if (next === suspended) return;
		suspended = next;
		if (suspended) {
			generation += 1;
			cancelTimer();
			queue.splice(0, queue.length, ...queue.filter((item) => item.priority > PRIORITY.VISIT));
			if (active && active.priority <= PRIORITY.VISIT) active = null;
			haptics.cancel();
			try {
				clearBackend();
			} catch (_) {}
			return;
		}
		if (active && !isStale(active)) showNow(active);
		else restore();
	}
	return {
		emit,
		clear: hardClear,
		suspend: setSuspended,
		snapshot() {
			return {
				active: active ? { ...active } : null,
				idle: idleBaseline ? { ...idleBaseline } : null,
				queue: queue.map((item) => ({ ...item })),
				suspended,
				version: VERSION$1
			};
		},
		priorities: PRIORITY,
		haptics
	};
}
function detectExistingBackend(host = globalThis) {
	const hasTransientChannel = !!(host && typeof host.__sqDmdShowTransientZones === "function" && typeof host.__sqDmdCancelTransientScenes === "function");
	return {
		render(zones, opts) {
			if (hasTransientChannel) return host.__sqDmdShowTransientZones(zones, opts);
			if (typeof host.sqDmdShowZones === "function") return host.sqDmdShowZones(zones, opts);
		},
		clear() {
			if (hasTransientChannel) return host.__sqDmdCancelTransientScenes();
			if (typeof host.__sqDmdHardClearQueue === "function") return host.__sqDmdHardClearQueue();
			if (typeof host.sqDmdStop === "function") return host.sqDmdStop();
		},
		restoreIdle() {
			if (hasTransientChannel) return host.__sqDmdCancelTransientScenes();
			if (typeof host.sqDmdSetIdle === "function") return host.sqDmdSetIdle("");
		},
		transient: hasTransientChannel
	};
}
function bindVisibility(controller, doc = globalThis.document) {
	if (!controller || !doc || typeof doc.addEventListener !== "function") return () => {};
	const onVisibility = () => controller.suspend(!!doc.hidden);
	doc.addEventListener("visibilitychange", onVisibility, { passive: true });
	onVisibility();
	return () => {
		try {
			doc.removeEventListener("visibilitychange", onVisibility);
		} catch (_) {}
	};
}
function install(options = {}) {
	const host = options.host || globalThis;
	const doc = options.document || host.document || globalThis.document;
	const backend = options.backend || detectExistingBackend(host);
	const haptics = options.haptics || createHaptics({
		navigator: options.navigator || host.navigator,
		enabled: options.hapticsEnabled === true
	});
	const controller = createController({
		...backend,
		haptics,
		maxQueue: options.maxQueue ?? 2,
		staleLowPriorityMs: options.staleLowPriorityMs ?? 900
	});
	const unbindVisibility = bindVisibility(controller, doc);
	controller.dispose = () => {
		unbindVisibility();
		controller.clear({ restore: false });
	};
	if (host && typeof host === "object") host.__sqDmdV2 = controller;
	return controller;
}
//#endregion
//#region src/live-game/dmd/motion.mjs
function prefersReducedMotion(host = globalThis) {
	try {
		return !!(host && typeof host.matchMedia === "function" && host.matchMedia("(prefers-reduced-motion: reduce)").matches);
	} catch (_) {
		return false;
	}
}
function createMotionSafeBackend(base, host = globalThis) {
	if (!base || typeof base.render !== "function") return base;
	return {
		...base,
		render(zones, opts = {}) {
			if (!prefersReducedMotion(host)) return base.render(zones, opts);
			return base.render(zones, {
				...opts,
				type: "hold",
				amp: 0
			});
		}
	};
}
//#endregion
//#region src/live-game/dmd/commentary.mjs
var VERSION = "1.0.0-sc052";
var MODES = Object.freeze({
	OFF: "off",
	BANTER: "banter",
	BRUTAL: "brutal"
});
var LINES = Object.freeze({
	miss6: [
		["SIX MISSES, SUNSHINE.", "THE BOARD REMAINS SAFE."],
		["SIX DARTS. FUCK ALL.", "AIMING IS STILL OPTIONAL."],
		["THAT IS SIX.", "START WORRYING."],
		["SIX MISSES.", "THE BOARD IS OVER THERE."]
	],
	miss9: [
		["NINE.", "THIS IS NOT BAD LUCK."],
		["NINE MISSES.", "WE ARE INVESTIGATING FRAUD."],
		["THREE VISITS. NOTHING.", "YOU ARE TAKING THE PISS."],
		["NINE.", "THE WALL IS GETTING NERVOUS."]
	],
	miss12: [
		["TWELVE.", "PACK IT UP, CHIEF."],
		["TWELVE MISSES.", "PUBLIC HUMILIATION."],
		["TWELVE.", "THE JOB IS FUCKED."],
		["EVEN THE BOARD", "LOOKS EMBARRASSED."]
	],
	miss15: [
		["FIFTEEN.", "THIS IS PERFORMANCE ART."],
		["FIFTEEN FUCKING MISSES.", "WE HAVE SEEN ENOUGH."],
		["STOP THROWING.", "THINK ABOUT YOUR LIFE."]
	],
	miss18: [
		["EIGHTEEN.", "RIGHT. EVERYONE OUT."],
		["THE EXPERIMENT", "HAS FAILED."],
		["THIS IS NO LONGER", "A DARTS MATCH."]
	],
	twoMisses: [
		["TWO GONE.", "ONE TO SAVE FACE."],
		["TWO MISSES.", "LOVELY START."],
		["TWO DOWN.", "MAKE THE LAST ONE COUNT."]
	],
	behindMiss: [
		["BOLD STRATEGY.", "NOT FROM BACK THERE."],
		["GOOD TIME TO MISS.", "VERY CLEVER."],
		["THAT WILL HELP.", "OH, WAIT."],
		["LOVELY.", "EXACTLY WHAT YOU NEEDED."]
	],
	behindHit: [
		["THAT HELPS.", "KEEP DIGGING."],
		["SIGNS OF LIFE.", "DO NOT GET EXCITED."],
		["ONE BACK.", "PLENTY MORE REQUIRED."]
	],
	zeroVisit: [
		["THREE DARTS.", "ZERO CONTRIBUTION."],
		["NOTHING.", "A COMPLETE WASTE OF TIME."],
		["THE BOARD WON", "THAT VISIT."],
		["ZERO.", "VERY PROFESSIONAL."]
	],
	repeatedZero: [
		["ANOTHER DONUT.", "WE DID NOT NEED AN ENCORE."],
		["ZERO. AGAIN.", "YOUR SIGNATURE MOVE."],
		["AT LEAST", "YOU ARE CONSISTENT."],
		["PLEASE STOP", "MAKING US WATCH THIS."]
	],
	zeroBehind: [
		["THREE DARTS. NOTHING.", "PERFECT FOR A COMEBACK."],
		["ZERO CONTRIBUTION.", "WHILE MILES BEHIND."],
		["THAT WAS USEFUL.", "IF YOU ARE THE LEADER."]
	],
	oneHit3: [
		["ONE DART WORKING.", "TWO CLAIMING EXPENSES."],
		["JUST THE ONE AGAIN.", "WHY CHANGE THE SYSTEM?"],
		["ONE GOOD DART.", "TWO COMPLETE WASTES."]
	],
	oneHit4: [
		["THE ONE-DART SYSTEM", "CONTINUES."],
		["ONE EMPLOYEE.", "TWO PASSENGERS."],
		["YOU DO KNOW", "YOU GET THREE?"]
	],
	oneHit5: [
		["ONE-DART FRAUD", "CONTINUES."],
		["TWO DARTS", "FOR DECORATION."],
		["CONSISTENTLY SHIT.", "IMPRESSIVE, REALLY."],
		["ONE DART PLAYER.", "THREE DART GAME."]
	],
	behind50: [
		["BIT OF A GAP, SUNSHINE.", "YOU MIGHT JOIN IN SOON."],
		["STILL IN THE SAME GAME.", "TECHNICALLY."],
		["GETTING AWAY FROM YOU.", "CHIEF."],
		["MOSTLY IRRELEVANT.", "BUT STILL PRESENT."]
	],
	behind75: [
		["BINOCULARS, PLEASE.", "HE IS GETTING SMALLER."],
		["YOU ARE NOT CHASING HIM.", "YOU ARE READING ABOUT HIM."],
		["YOU CAN STILL SEE HIM.", "JUST."],
		["PLAYING FOR DIGNITY.", "CURRENTLY LOSING THAT TOO."]
	],
	behind100: [
		["A HUNDRED BACK.", "LOVELY DAY FOR A FUNERAL."],
		["NOT YOUR OPPONENT NOW.", "HE IS YOUR LANDLORD."],
		["LOST RADIO CONTACT.", "TRY WAVING."],
		["NOT A COMEBACK.", "AN EVACUATION."]
	],
	behind125: [
		["RIGHT.", "WE ARE WATCHING A CRIME."],
		["ABSOLUTELY BURIED.", "NO FLOWERS, PLEASE."],
		["THE GAP NEEDS", "PLANNING PERMISSION."],
		["BACKGROUND SCENERY.", "THAT IS YOU NOW."]
	],
	falseComeback: [
		["THAT HELPED.", "YOU ARE STILL GETTING BATTERED."],
		["SIGNS OF LIFE.", "NOT ENOUGH LIFE."],
		["DO NOT CALL IT", "A COMEBACK."],
		["GAP IMPROVED.", "CATASTROPHIC TO TERRIBLE."]
	],
	runaway: [
		["DAYLIGHT.", "HE IS LEAVING THEM."],
		["ONE PLAYER.", "SEVERAL WITNESSES."],
		["THIS IS BECOMING", "A DEMONSTRATION."],
		["THE REST", "ARE PROVIDING ATMOSPHERE."]
	],
	h2hRepeat: [
		["HIM AGAIN.", "SAME PROBLEM."],
		["HE IS DOING IT", "TO YOU AGAIN."],
		["YOU SHOULD STOP", "BOOKING THIS FIXTURE."],
		["SAME BULLY.", "SAME VICTIM."]
	],
	leadChange: [
		["NEW LEADER.", "OLD PROBLEM."],
		["MOVE OVER, CHAMP.", "NEW BOSS."],
		["THAT LEAD", "AGED WELL."],
		["YOU WERE WINNING", "A MINUTE AGO."]
	],
	closeRound: [
		["NOW WE HAVE", "A FUCKING GAME."],
		["GETTING TIGHT.", "SOMEONE WILL BOTTLE IT."],
		["WELCOME TO", "THE CHOKE ZONE."],
		["ONE OF YOU", "WILL LOOK VERY STUPID."]
	],
	collapsingLead: [
		["DO NOT LOOK", "BEHIND YOU."],
		["WHERE IS YOUR", "LEAD GOING, BIG MAN?"],
		["THE COLLAR", "IS GETTING TIGHT."],
		["HERE WE", "FUCKING GO."]
	],
	roundMassacre: [
		["THE BOARD WON", "THAT ROUND."],
		["GENTLEMEN.", "THAT WAS FUCKING TERRIBLE."],
		["A FESTIVAL", "OF MEDIOCRITY."],
		["ZERO DIGNITY.", "ROUND COMPLETE."]
	],
	roundDominant: [
		["ONE MAN WORKING.", "THE REST: DECORATION."],
		["THAT ROUND", "WAS NOT A CONTEST."],
		["ONE PLAYER TURNED UP.", "NOTED."]
	],
	historyRepeat: [
		["WE HAVE SEEN", "THIS FILM BEFORE."],
		["NICE TO SEE", "YOU LEARNED FUCK ALL."],
		["SAME SCRIPT.", "SAME PROBLEM."],
		["I REMEMBER YOU.", "UNFORTUNATELY."]
	]
});
function clean(value) {
	return String(value == null ? "" : value).trim();
}
function norm(value) {
	return clean(value).toLowerCase().replace(/\s+/g, " ");
}
function finite(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}
function hash(value) {
	let h = 2166136261;
	const s = String(value || "");
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function choose(pool, key) {
	if (!Array.isArray(pool) || !pool.length) return null;
	return pool[hash(key) % pool.length];
}
function beat(pair, reason, priority = 20, extra = {}) {
	if (!pair) return null;
	return {
		headline: pair[0] || "",
		subline: pair[1] || "",
		reason,
		priority,
		...extra
	};
}
function playerName(player, index = 0) {
	if (typeof player === "string") return clean(player) || "P" + (index + 1);
	return clean(player && (player.name || player.full || player.nickname || player.code || player.initials)) || "P" + (index + 1);
}
function dartPoints(d) {
	return finite(d && (d.points ?? d.pts ?? d.score), 0);
}
function scoreTotals(score, maxRound = Infinity) {
	if (!Array.isArray(score)) return [];
	return score.map((board) => {
		if (!Array.isArray(board)) return 0;
		let total = 0;
		for (let r = 0; r < board.length && r <= maxRound; r++) total += finite(board[r] && board[r].roundTotal, 0);
		return total;
	});
}
function roundTotals(score, round) {
	if (!Array.isArray(score)) return [];
	return score.map((board) => finite(board && board[round] && board[round].roundTotal, 0));
}
function currentEvent(ctx) {
	return {
		player: finite(ctx.pIndex, 0),
		round: finite(ctx.rIndex, 0),
		dartIndex: finite(ctx.dartIndex, 0),
		throw: ctx.dart || null
	};
}
function chronologicalForPlayer(ctx) {
	const p = finite(ctx.pIndex, 0);
	const arr = Array.isArray(ctx.history) ? ctx.history.filter((x) => x && finite(x.player, -1) === p).map((x) => ({
		player: p,
		round: finite(x.round, 0),
		dartIndex: finite(x.dartIndex, 0),
		throw: x.throw || null
	})) : [];
	if (ctx.dart) arr.push(currentEvent(ctx));
	return arr;
}
function trailingMisses(ctx) {
	const arr = chronologicalForPlayer(ctx);
	let count = 0;
	for (let i = arr.length - 1; i >= 0; i--) {
		if (dartPoints(arr[i].throw) > 0) break;
		count++;
	}
	return count;
}
function completedVisits(ctx) {
	const arr = chronologicalForPlayer(ctx);
	const visits = [];
	let current = [];
	let lastRound = null;
	for (const ev of arr) {
		if (lastRound !== null && ev.dartIndex === 0 && current.length) current = [];
		lastRound = ev.round;
		current.push(ev);
		if (ev.dartIndex === 2) {
			const darts = current.slice(-3).map((x) => x.throw);
			visits.push({
				round: ev.round,
				darts,
				hits: darts.filter((d) => dartPoints(d) > 0).length,
				points: darts.reduce((a, d) => a + dartPoints(d), 0)
			});
			current = [];
		}
	}
	return visits;
}
function trailingVisitStreak(ctx, hits) {
	const visits = completedVisits(ctx);
	let n = 0;
	for (let i = visits.length - 1; i >= 0; i--) {
		if (visits[i].hits !== hits) break;
		n++;
	}
	return n;
}
function gapInfo(ctx) {
	const totals = scoreTotals(ctx.score);
	const own = finite(totals[finite(ctx.pIndex, 0)], 0);
	const leader = totals.length ? Math.max(...totals) : own;
	const sorted = [...totals].sort((a, b) => b - a);
	const second = sorted.length > 1 ? finite(sorted[1], leader) : leader;
	return {
		totals,
		own,
		leader,
		behind: Math.max(0, leader - own),
		lead: own === leader ? Math.max(0, leader - second) : 0,
		leaderIndex: totals.indexOf(leader)
	};
}
function gapPool(gap) {
	if (gap >= 125) return LINES.behind125;
	if (gap >= 100) return LINES.behind100;
	if (gap >= 75) return LINES.behind75;
	return LINES.behind50;
}
function isProtectedMode(mode) {
	return /(practice|shadow|training)/i.test(String(mode || ""));
}
function groupHistory(rows) {
	const games = /* @__PURE__ */ new Map();
	(Array.isArray(rows) ? rows : []).forEach((row) => {
		const id = clean(row && row.game_id);
		const name = norm(row && row.player_name);
		if (!id || !name) return;
		if (!games.has(id)) games.set(id, {
			id,
			ts: row.ts || null,
			rows: []
		});
		games.get(id).rows.push({
			name,
			score: finite(row.score, 0),
			raw: row
		});
	});
	return [...games.values()].sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));
}
function h2hFromGames(games, a, b) {
	const an = norm(a), bn = norm(b);
	if (!an || !bn || an === bn) return {
		games: 0,
		aWins: 0,
		bWins: 0,
		draws: 0,
		lastWinner: ""
	};
	let out = {
		games: 0,
		aWins: 0,
		bWins: 0,
		draws: 0,
		lastWinner: ""
	};
	for (const g of games) {
		const ar = g.rows.find((r) => r.name === an), br = g.rows.find((r) => r.name === bn);
		if (!ar || !br) continue;
		out.games++;
		let winner = "";
		if (ar.score > br.score) {
			out.aWins++;
			winner = an;
		} else if (br.score > ar.score) {
			out.bWins++;
			winner = bn;
		} else out.draws++;
		if (!out.lastWinner && winner) out.lastWinner = winner;
	}
	return out;
}
function matchH2H(matchHistory, aIndex, bIndex) {
	const out = {
		games: 0,
		aWins: 0,
		bWins: 0,
		draws: 0,
		lastWinnerIndex: null
	};
	(Array.isArray(matchHistory) ? matchHistory : []).forEach((g) => {
		const totals = Array.isArray(g && g.totals) ? g.totals : [];
		if (!Number.isFinite(Number(totals[aIndex])) || !Number.isFinite(Number(totals[bIndex]))) return;
		const a = Number(totals[aIndex]), b = Number(totals[bIndex]);
		out.games++;
		if (a > b) {
			out.aWins++;
			out.lastWinnerIndex = aIndex;
		} else if (b > a) {
			out.bWins++;
			out.lastWinnerIndex = bIndex;
		} else out.draws++;
	});
	return out;
}
function createCommentaryEngine(options = {}) {
	const host = options.host || globalThis;
	let mode = String(options.mode || MODES.BRUTAL).toLowerCase();
	let historyRows = Array.isArray(options.historyRows) ? options.historyRows.slice() : [];
	let historyGames = groupHistory(historyRows);
	let warmKey = "";
	let warmResolvedKey = "";
	let warmPromise = null;
	function enabled(ctx) {
		if (mode === MODES.OFF) return false;
		if (ctx && ctx.suppress === true) return false;
		return true;
	}
	async function warmHistory(players, currentMode = "") {
		if (isProtectedMode(currentMode)) return [];
		const names = (Array.isArray(players) ? players : []).map(playerName).filter(Boolean);
		const key = names.map(norm).sort().join("|");
		if (!key) return [];
		if (key === warmResolvedKey) return historyRows;
		if (key === warmKey && warmPromise) return warmPromise;
		warmKey = key;
		warmPromise = (async () => {
			try {
				let client = null;
				try {
					client = host && host.sb && typeof host.sb.from === "function" ? host.sb : null;
				} catch (_) {}
				if (!client) return historyRows;
				const q = await client.from("v_player_game_scores_official_clean").select("game_id,ts,player_index,player_name,score").order("ts", { ascending: false }).limit(260);
				if (q && q.error) throw q.error;
				const wanted = new Set(names.map(norm));
				const allRows = Array.isArray(q && q.data) ? q.data : [];
				historyRows = allRows.filter((r) => wanted.has(norm(r && r.player_name)));
				historyGames = groupHistory(allRows);
				warmResolvedKey = key;
				return historyRows;
			} catch (_) {
				warmResolvedKey = key;
				return historyRows;
			} finally {
				warmPromise = null;
			}
		})();
		return warmPromise;
	}
	function historyDominance(ctx, trailingIndex, leaderIndex) {
		const players = Array.isArray(ctx.players) ? ctx.players : [];
		const a = playerName(players[trailingIndex], trailingIndex);
		const b = playerName(players[leaderIndex], leaderIndex);
		const withinMatch = matchH2H(ctx.matchHistory, trailingIndex, leaderIndex);
		if (withinMatch.bWins >= 1 && withinMatch.bWins > withinMatch.aWins) return true;
		const all = h2hFromGames(historyGames, a, b);
		return all.bWins >= 2 && all.bWins > all.aWins;
	}
	function dart(ctx = {}) {
		if (!enabled(ctx) || !ctx.dart) return null;
		const pts = dartPoints(ctx.dart);
		const miss = pts <= 0;
		const streak = miss ? trailingMisses(ctx) : 0;
		const gap = gapInfo(ctx);
		const key = [
			"dart",
			ctx.pIndex,
			ctx.rIndex,
			ctx.dartIndex,
			pts,
			streak,
			gap.behind
		].join("|");
		if (miss) {
			if (streak >= 18 && streak % 3 === 0) return beat(choose(LINES.miss18, key), "miss_18_plus", 55, { streak });
			if (streak === 15) return beat(choose(LINES.miss15, key), "miss_15", 52, { streak });
			if (streak === 12) return beat(choose(LINES.miss12, key), "miss_12", 50, { streak });
			if (streak === 9) return beat(choose(LINES.miss9, key), "miss_9", 48, { streak });
			if (streak === 6) return beat(choose(LINES.miss6, key), "miss_6", 45, { streak });
			const visit = ctx.score && ctx.score[ctx.pIndex] && ctx.score[ctx.pIndex][ctx.rIndex];
			const darts = Array.isArray(visit && visit.darts) ? visit.darts.slice(0, Number(ctx.dartIndex) + 1) : [];
			if (Number(ctx.dartIndex) === 1 && darts.length >= 2 && darts.every((d) => dartPoints(d) <= 0)) return beat(choose(LINES.twoMisses, key), "two_misses", 22, { streak });
			if (gap.behind >= 50 && Number(ctx.dartIndex) < 2) return beat(choose(LINES.behindMiss, key), "behind_miss", 24, { gap: gap.behind });
			return null;
		}
		if (gap.behind >= 50 && Number(ctx.dartIndex) < 2) return beat(choose(LINES.behindHit, key), "behind_hit", 18, { gap: gap.behind });
		return null;
	}
	function visit(ctx = {}) {
		if (!enabled(ctx) || Number(ctx.dartIndex) !== 2) return null;
		const board = ctx.score && ctx.score[ctx.pIndex];
		const entry = board && board[ctx.rIndex];
		const darts = Array.isArray(entry && entry.darts) ? entry.darts.slice(0, 3) : [];
		const hits = darts.filter((d) => dartPoints(d) > 0).length;
		const points = darts.reduce((a, d) => a + dartPoints(d), 0);
		const gap = gapInfo(ctx);
		const key = [
			"visit",
			ctx.pIndex,
			ctx.rIndex,
			hits,
			points,
			gap.behind,
			gap.lead
		].join("|");
		if (hits === 0) {
			const zs = trailingVisitStreak(ctx, 0);
			if (gap.behind >= 50) {
				const b = beat(choose(LINES.zeroBehind, key), "zero_visit_behind", 42, {
					gap: gap.behind,
					zeroVisitStreak: zs
				});
				b.subline = (gap.behind + " BACK. LOVELY.").slice(0, 32);
				return b;
			}
			if (zs >= 2) return beat(choose(LINES.repeatedZero, key), "repeated_zero_visit", 38, { zeroVisitStreak: zs });
			return beat(choose(LINES.zeroVisit, key), "zero_visit", 32);
		}
		const one = trailingVisitStreak(ctx, 1);
		if (one >= 5) return beat(choose(LINES.oneHit5, key), "one_hit_streak_5", 36, { oneHitStreak: one });
		if (one === 4) return beat(choose(LINES.oneHit4, key), "one_hit_streak_4", 34, { oneHitStreak: one });
		if (one === 3) return beat(choose(LINES.oneHit3, key), "one_hit_streak_3", 32, { oneHitStreak: one });
		if (gap.behind >= 50) {
			const beforeOwn = gap.own - points;
			const otherLeader = Math.max(0, ...gap.totals.filter((_, i) => i !== Number(ctx.pIndex)));
			const beforeGap = Math.max(0, otherLeader - beforeOwn);
			const recovered = Math.max(0, beforeGap - gap.behind);
			if (recovered >= 20 && gap.behind >= 50) {
				const b = beat(choose(LINES.falseComeback, key), "false_comeback", 33, {
					gap: gap.behind,
					recovered
				});
				b.subline = (gap.behind + " BACK. STILL.").slice(0, 32);
				return b;
			}
			if (historyDominance(ctx, Number(ctx.pIndex), gap.leaderIndex)) {
				const b = beat(choose(LINES.h2hRepeat, key), "history_h2h_repeat", 40, { gap: gap.behind });
				b.subline = (gap.behind + " BACK. HIM AGAIN.").slice(0, 32);
				return b;
			}
			const b = beat(choose(gapPool(gap.behind), key), "far_behind", 30, { gap: gap.behind });
			b.subline = (gap.behind + " BACK.").slice(0, 32);
			return b;
		}
		if (gap.lead >= 50) {
			const b = beat(choose(LINES.runaway, key), "runaway_leader", 28, { lead: gap.lead });
			b.subline = ("+" + gap.lead + " CLEAR.").slice(0, 32);
			return b;
		}
		return null;
	}
	function round(ctx = {}) {
		if (!enabled(ctx)) return null;
		const r = Number(ctx.rIndex);
		if (!Number.isFinite(r) || r < 0) return null;
		const totals = scoreTotals(ctx.score, r);
		const prev = scoreTotals(ctx.score, r - 1);
		const rt = roundTotals(ctx.score, r);
		if (!totals.length) return null;
		const leader = Math.max(...totals);
		const leaderIndex = totals.indexOf(leader);
		const sorted = [...totals].sort((a, b) => b - a);
		const margin = sorted.length > 1 ? leader - sorted[1] : 0;
		const prevLeader = Math.max(...prev);
		const prevLeaderIndex = prev.indexOf(prevLeader);
		const prevSorted = [...prev].sort((a, b) => b - a);
		const prevMargin = prevSorted.length > 1 ? prevLeader - prevSorted[1] : 0;
		const worst = Math.min(...totals);
		const worstIndex = totals.indexOf(worst);
		const worstGap = leader - worst;
		const key = [
			"round",
			r,
			totals.join(","),
			rt.join(",")
		].join("|");
		if (rt.every((v) => v === 0)) return beat(choose(LINES.roundMassacre, key), "round_all_zero", 52);
		if (r > 0 && leaderIndex !== prevLeaderIndex && leader > 0) {
			const b = beat(choose(LINES.leadChange, key), "round_lead_change", 44, {
				leaderIndex,
				margin
			});
			b.subline = (playerName(ctx.players && ctx.players[leaderIndex], leaderIndex) + " LEADS").slice(0, 32);
			return b;
		}
		if (leaderIndex === prevLeaderIndex && prevMargin - margin >= 25 && margin <= 25 && r >= 2) return beat(choose(LINES.collapsingLead, key), "round_lead_collapse", 43, {
			margin,
			previousMargin: prevMargin
		});
		if (worstGap >= 50) {
			if (historyDominance(ctx, worstIndex, leaderIndex)) {
				const b = beat(choose(LINES.h2hRepeat, key), "round_history_h2h", 42, {
					gap: worstGap,
					worstIndex,
					leaderIndex
				});
				b.subline = (playerName(ctx.players && ctx.players[worstIndex], worstIndex) + " " + worstGap + " BACK").slice(0, 32);
				return b;
			}
			const b = beat(choose(gapPool(worstGap), key), "round_far_behind", 38, {
				gap: worstGap,
				worstIndex,
				leaderIndex
			});
			b.subline = (playerName(ctx.players && ctx.players[worstIndex], worstIndex) + " " + worstGap + " BACK").slice(0, 32);
			return b;
		}
		if (margin >= 50) {
			const b = beat(choose(LINES.runaway, key), "round_runaway", 37, {
				lead: margin,
				leaderIndex
			});
			b.subline = (playerName(ctx.players && ctx.players[leaderIndex], leaderIndex) + " +" + margin).slice(0, 32);
			return b;
		}
		if (r >= 4 && sorted.length > 1 && margin <= 10) return beat(choose(LINES.closeRound, key), "round_close", 34, { margin });
		const ranked = rt.map((v, i) => ({
			v,
			i
		})).sort((a, b) => b.v - a.v);
		if (ranked.length > 1 && ranked[0].v - ranked[1].v >= 30 && ranked[0].v > 0) {
			const b = beat(choose(LINES.roundDominant, key), "round_domination", 30, { winnerIndex: ranked[0].i });
			b.subline = (playerName(ctx.players && ctx.players[ranked[0].i], ranked[0].i) + " OWNED THAT").slice(0, 32);
			return b;
		}
		return null;
	}
	function setMode(next) {
		const v = String(next || "").toLowerCase();
		if (Object.values(MODES).includes(v)) mode = v;
		return mode;
	}
	function setHistoryRows(rows) {
		historyRows = Array.isArray(rows) ? rows.slice() : [];
		historyGames = groupHistory(historyRows);
		return historyRows.length;
	}
	return {
		version: VERSION,
		gapMockStart: 50,
		mode: () => mode,
		setMode,
		warmHistory,
		setHistoryRows,
		dart,
		visit,
		round,
		snapshot: () => ({
			mode,
			historyRows: historyRows.length,
			historyGames: historyGames.length,
			version: VERSION
		})
	};
}
function installCommentary(host = globalThis) {
	const saved = (() => {
		try {
			return String(host.localStorage && host.localStorage.getItem("sq_dmd_commentary_mode") || "").toLowerCase();
		} catch (_) {
			return "";
		}
	})();
	const engine = createCommentaryEngine({
		host,
		mode: Object.values(MODES).includes(saved) ? saved : MODES.BRUTAL
	});
	try {
		host.__sqDmdCommentary = engine;
		host.__sqDmdCommentaryDart = (ctx) => engine.dart(ctx);
		host.__sqDmdCommentaryVisit = (ctx) => engine.visit(ctx);
		host.__sqDmdCommentaryRound = (ctx) => engine.round(ctx);
		host.__sqDmdCommentaryWarmHistory = (players, mode) => engine.warmHistory(players, mode);
		host.__sqDmdCommentarySetMode = (next) => {
			const mode = engine.setMode(next);
			try {
				host.localStorage && host.localStorage.setItem("sq_dmd_commentary_mode", mode);
			} catch (_) {}
			return mode;
		};
	} catch (_) {}
	return engine;
}
//#endregion
//#region src/live-game/dmd/bootstrap.mjs
var MAX_ATTEMPTS = 120;
var RETRY_MS = 50;
var attempts = 0;
var timer = null;
if (!window.__sqDmdCommentary) installCommentary(window);
function backendReady(host) {
	return !!(host && typeof host.sqDmdShowZones === "function" && typeof host.__sqDmdShowTransientZones === "function" && typeof host.__sqDmdCancelTransientScenes === "function" && typeof host.sqDmdSetIdle === "function");
}
function boot() {
	if (window.__sqDmdV2) return true;
	if (!backendReady(window)) {
		attempts += 1;
		if (attempts >= MAX_ATTEMPTS) {
			console.warn("[SC-030] DMD V2 bootstrap skipped: existing DMD backend was not ready.");
			return false;
		}
		timer = window.setTimeout(boot, RETRY_MS);
		return false;
	}
	if (timer != null) {
		window.clearTimeout(timer);
		timer = null;
	}
	const backend = createMotionSafeBackend(detectExistingBackend(window), window);
	window.__sqDmdV2 = install({
		host: window,
		document,
		backend,
		maxQueue: 2,
		hapticsEnabled: false
	});
	window.__sqDmdV2Ready = true;
	return true;
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
//#endregion

//# sourceMappingURL=index-Q7VN8AU4.js.map