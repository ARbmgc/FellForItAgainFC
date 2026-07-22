(() => {
  const STORAGE_KEY = "fell-for-it-again-fc:v1";

  const defaultState = () => ({
    players: [
      { id: uid(), name: "", club: "", stars: "" },
      { id: uid(), name: "", club: "", stars: "" },
      { id: uid(), name: "", club: "", stars: "" },
      { id: uid(), name: "", club: "", stars: "" },
      { id: uid(), name: "", club: "", stars: "" },
    ],
    fixtures: [], // { id, round, homeId, awayId, homeScore, awayScore } homeId/awayId null = bye
    bracket: null, // { rounds: [ [ {id, p1, p2, s1, s2} ... ], ... ] }
  });

  function uid() {
    return Math.random().toString(36).slice(2, 9);
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed.players || !parsed.players.length) return defaultState();
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function playerById(id) {
    return state.players.find((p) => p.id === id);
  }

  function displayName(p) {
    if (!p) return "—";
    return p.name.trim() || "Unnamed manager";
  }

  // ---------------- Tabs ----------------

  function initTabs() {
    const btns = document.querySelectorAll(".tab-btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        btns.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
        document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
      });
    });
  }

  // ---------------- Roster ----------------

  function renderRoster() {
    const list = document.getElementById("rosterList");
    list.innerHTML = "";
    state.players.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "roster-row";
      row.innerHTML = `
        <span class="num">${i + 1}</span>
        <input type="text" placeholder="Manager name" value="${escapeAttr(p.name)}" data-field="name" data-id="${p.id}">
        <input type="text" placeholder="Club team" value="${escapeAttr(p.club)}" data-field="club" data-id="${p.id}">
        <input type="text" class="stars" placeholder="★★★★★" value="${escapeAttr(p.stars)}" data-field="stars" data-id="${p.id}">
      `;
      list.appendChild(row);
    });

    list.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const p = playerById(e.target.dataset.id);
        if (p) p[e.target.dataset.field] = e.target.value;
        save();
        renderTicker();
      });
    });
  }

  function addPlayer() {
    state.players.push({ id: uid(), name: "", club: "", stars: "" });
    save();
    renderRoster();
  }

  function escapeAttr(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // ---------------- Fixtures (round robin) ----------------

  function generateFixtures() {
    const named = state.players.filter((p) => p.name.trim());
    if (named.length < 2) {
      alert("Add at least 2 named managers before generating fixtures.");
      return;
    }
    if (!confirm("This clears any scores already entered. Continue?")) return;

    let ids = state.players.map((p) => p.id);
    if (ids.length % 2 !== 0) ids.push(null); // bye slot

    const n = ids.length;
    const rounds = n - 1;
    const half = n / 2;
    let arr = ids.slice();
    const fixtures = [];

    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < half; i++) {
        const home = arr[i];
        const away = arr[n - 1 - i];
        if (home !== null && away !== null) {
          fixtures.push({
            id: uid(),
            round: r + 1,
            homeId: home,
            awayId: away,
            homeScore: "",
            awayScore: "",
          });
        }
      }
      // rotate, keep first fixed
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [fixed, ...rest];
    }

    state.fixtures = fixtures;
    state.bracket = null;
    save();
    renderFixtures();
    renderTable();
    renderBracket();
    renderTicker();
    document.querySelector('.tab-btn[data-tab="fixtures"]').click();
  }

  function renderFixtures() {
    const wrap = document.getElementById("fixturesList");
    if (!state.fixtures.length) {
      wrap.innerHTML = '<p class="empty">No fixtures yet — set your roster and generate the season first.</p>';
      return;
    }
    const byRound = {};
    state.fixtures.forEach((f) => {
      byRound[f.round] = byRound[f.round] || [];
      byRound[f.round].push(f);
    });

    wrap.innerHTML = "";
    Object.keys(byRound)
      .sort((a, b) => a - b)
      .forEach((r) => {
        const day = document.createElement("div");
        day.className = "matchday";
        day.innerHTML = `<p class="matchday__label">Matchday ${r}</p>`;
        byRound[r].forEach((f) => {
          const home = playerById(f.homeId);
          const away = playerById(f.awayId);
          const row = document.createElement("div");
          row.className = "fixture";
          row.innerHTML = `
            <span class="p1">${displayName(home)}</span>
            <input type="number" min="0" data-id="${f.id}" data-side="home" value="${f.homeScore}">
            <span class="dash">–</span>
            <input type="number" min="0" data-id="${f.id}" data-side="away" value="${f.awayScore}">
            <span class="p2">${displayName(away)}</span>
          `;
          day.appendChild(row);
        });
        wrap.appendChild(day);
      });

    wrap.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const f = state.fixtures.find((x) => x.id === e.target.dataset.id);
        if (!f) return;
        const field = e.target.dataset.side === "home" ? "homeScore" : "awayScore";
        f[field] = e.target.value;
        save();
        renderTable();
        renderTicker();
      });
    });
  }

  // ---------------- Standings ----------------

  function computeStandings() {
    const stats = {};
    state.players.forEach((p) => {
      stats[p.id] = { id: p.id, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    });

    state.fixtures.forEach((f) => {
      if (f.homeScore === "" || f.awayScore === "" || f.homeScore == null || f.awayScore == null) return;
      const hs = parseInt(f.homeScore, 10);
      const as = parseInt(f.awayScore, 10);
      if (Number.isNaN(hs) || Number.isNaN(as)) return;
      const h = stats[f.homeId];
      const a = stats[f.awayId];
      if (!h || !a) return;
      h.played++; a.played++;
      h.gf += hs; h.ga += as;
      a.gf += as; a.ga += hs;
      if (hs > as) { h.w++; a.l++; h.pts += 3; }
      else if (hs < as) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts += 1; a.pts += 1; }
    });

    const rows = Object.values(stats).filter((s) => playerById(s.id) && playerById(s.id).name.trim());
    rows.forEach((r) => (r.gd = r.gf - r.ga));
    rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    return rows;
  }

  function renderTable() {
    const wrap = document.getElementById("tableWrap");
    const rows = computeStandings();
    if (!rows.length) {
      wrap.innerHTML = '<p class="empty">No standings yet.</p>';
      return;
    }
    let html = `<table>
      <thead><tr>
        <th>#</th><th>Manager</th><th class="center">P</th><th class="center">W</th>
        <th class="center">D</th><th class="center">L</th><th class="center">GF</th>
        <th class="center">GA</th><th class="center">GD</th><th class="center">Pts</th>
      </tr></thead><tbody>`;
    rows.forEach((r, i) => {
      const p = playerById(r.id);
      html += `<tr>
        <td>${i + 1}</td>
        <td class="name">${displayName(p)}</td>
        <td class="center">${r.played}</td>
        <td class="center">${r.w}</td>
        <td class="center">${r.d}</td>
        <td class="center">${r.l}</td>
        <td class="center">${r.gf}</td>
        <td class="center">${r.ga}</td>
        <td class="center">${r.gd > 0 ? "+" + r.gd : r.gd}</td>
        <td class="center">${r.pts}</td>
      </tr>`;
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

  // ---------------- Knockout bracket ----------------

  function seedBracket() {
    const rows = computeStandings();
    if (rows.length < 2) {
      alert("Need at least 2 managers with results (or names set) to seed a bracket.");
      return;
    }
    const seeds = rows.slice(0, 4).map((r) => r.id);
    while (seeds.length < 4 && seeds.length < state.players.filter(p => p.name.trim()).length) {
      // pad with remaining named players if table is empty (no matches played yet)
      const remaining = state.players.filter((p) => p.name.trim() && !seeds.includes(p.id));
      if (!remaining.length) break;
      seeds.push(remaining[0].id);
    }

    if (seeds.length < 2) {
      alert("Add named managers first.");
      return;
    }

    let rounds;
    if (seeds.length >= 4) {
      // Semis: 1v4, 2v3
      rounds = [
        [
          { id: uid(), p1: seeds[0], p2: seeds[3] ?? null, s1: "", s2: "" },
          { id: uid(), p1: seeds[1], p2: seeds[2] ?? null, s1: "", s2: "" },
        ],
        [{ id: uid(), p1: null, p2: null, s1: "", s2: "" }],
      ];
    } else {
      // straight final for 2-3 players
      rounds = [[{ id: uid(), p1: seeds[0], p2: seeds[1] ?? null, s1: "", s2: "" }]];
    }

    state.bracket = { rounds };
    save();
    renderBracket();
  }

  function matchWinner(m) {
    if (m.p1 == null || m.p2 == null) return null;
    if (m.s1 === "" || m.s2 === "" || m.s1 == null || m.s2 == null) return null;
    const s1 = parseInt(m.s1, 10);
    const s2 = parseInt(m.s2, 10);
    if (Number.isNaN(s1) || Number.isNaN(s2) || s1 === s2) return null;
    return s1 > s2 ? m.p1 : m.p2;
  }

  function propagateBracket() {
    if (!state.bracket) return;
    const { rounds } = state.bracket;
    for (let r = 0; r < rounds.length - 1; r++) {
      rounds[r].forEach((m, i) => {
        const winner = matchWinner(m);
        const nextMatch = rounds[r + 1][Math.floor(i / 2)];
        const slot = i % 2 === 0 ? "p1" : "p2";
        if (nextMatch[slot] !== winner) {
          nextMatch[slot] = winner;
          // reset downstream score if participant changed
          nextMatch.s1 = "";
          nextMatch.s2 = "";
        }
      });
    }
  }

  function renderBracket() {
    const wrap = document.getElementById("bracketWrap");
    if (!state.bracket) {
      wrap.innerHTML = '<p class="empty">No bracket yet — seed it from the current table.</p>';
      return;
    }
    propagateBracket();
    const { rounds } = state.bracket;
    const labels = rounds.length === 2 ? ["Semifinals", "Final"] : ["Final"];

    let html = '<div class="bracket">';
    rounds.forEach((round, ri) => {
      html += `<div class="bracket__round"><p class="bracket__round-label">${labels[ri] || "Round " + (ri + 1)}</p>`;
      round.forEach((m) => {
        const p1 = playerById(m.p1);
        const p2 = playerById(m.p2);
        const winner = matchWinner(m);
        html += `<div class="bracket-match">
          <div class="slot">
            <span>${p1 ? displayName(p1) : "TBD"}</span>
            <input type="number" min="0" data-match="${m.id}" data-side="s1" value="${m.s1}" ${p1 && p2 ? "" : "disabled"}>
          </div>
          <div class="vs"></div>
          <div class="slot">
            <span>${p2 ? displayName(p2) : "TBD"}</span>
            <input type="number" min="0" data-match="${m.id}" data-side="s2" value="${m.s2}" ${p1 && p2 ? "" : "disabled"}>
          </div>
          ${winner ? `<p class="winner-tag">Winner: ${displayName(playerById(winner))}</p>` : ""}
        </div>`;
      });
      html += "</div>";
    });
    html += "</div>";

    if (rounds.length === 2) {
      const champ = matchWinner(rounds[1][0]);
      if (champ) {
        html = `<p class="matchday__label" style="color: var(--gold); font-size:14px; margin-bottom:14px;">🏆 Champion: ${displayName(playerById(champ))}</p>` + html;
      }
    } else if (rounds.length === 1) {
      const champ = matchWinner(rounds[0][0]);
      if (champ) {
        html = `<p class="matchday__label" style="color: var(--gold); font-size:14px; margin-bottom:14px;">🏆 Champion: ${displayName(playerById(champ))}</p>` + html;
      }
    }

    wrap.innerHTML = html;

    wrap.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const allMatches = state.bracket.rounds.flat();
        const m = allMatches.find((x) => x.id === e.target.dataset.match);
        if (!m) return;
        m[e.target.dataset.side] = e.target.value;
        save();
        renderBracket();
      });
    });
  }

  // ---------------- Ticker ----------------

  function renderTicker() {
    const named = state.players.filter((p) => p.name.trim());
    document.getElementById("tickerPlayers").textContent = named.length;
    const played = state.fixtures.filter((f) => f.homeScore !== "" && f.awayScore !== "").length;
    document.getElementById("tickerPlayed").textContent = played;
    document.getElementById("tickerTotal").textContent = state.fixtures.length;
    const standings = computeStandings();
    document.getElementById("tickerLeader").textContent = standings.length && standings[0].played
      ? displayName(playerById(standings[0].id))
      : "—";
  }

  // ---------------- Data export/import ----------------

  function exportData() {
    document.getElementById("dataBox").value = JSON.stringify(state, null, 2);
  }

  function importData() {
    const raw = document.getElementById("dataBox").value.trim();
    if (!raw) { alert("Paste exported JSON into the box first."); return; }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.players) throw new Error("bad shape");
      state = parsed;
      save();
      renderAll();
      alert("Imported.");
    } catch (e) {
      alert("That doesn't look like valid exported data.");
    }
  }

  function resetAll() {
    if (!confirm("This wipes the roster, fixtures, and bracket on this device. Continue?")) return;
    state = defaultState();
    save();
    renderAll();
  }

  function renderAll() {
    renderRoster();
    renderFixtures();
    renderTable();
    renderBracket();
    renderTicker();
  }

  // ---------------- Init ----------------

  document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    renderAll();
    document.getElementById("addPlayerBtn").addEventListener("click", addPlayer);
    document.getElementById("generateBtn").addEventListener("click", generateFixtures);
    document.getElementById("seedBracketBtn").addEventListener("click", seedBracket);
    document.getElementById("exportBtn").addEventListener("click", exportData);
    document.getElementById("importBtn").addEventListener("click", importData);
    document.getElementById("resetBtn").addEventListener("click", resetAll);
  });
})();
