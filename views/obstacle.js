// Obstacle Course helpers shared by the public scoreboard (scores.html) and the
// moderator desk (admin.html): team naming, result labels and the live store.
(function () {
  const { esc, fmt } = UI;
  const T = Tournament;
  const ctx = { B: null, teams: {}, sheets: { teams: [], qualifying: [], sides: [], warnings: [] } };

  const pad = n => String(n).padStart(2, '0');
  ctx.tag = t => '#' + pad(t);
  ctx.tname = t => (ctx.teams[t] && ctx.teams[t].name) || 'Team ' + pad(t);
  ctx.members = t => (ctx.teams[t] && ctx.teams[t].members) || '';
  ctx.runOf = (sid, t) => ((ctx.store.data.runs || {})[sid] || {})[t];

  /** Seed tag for knockout stages. Qualifying M/B groups stay staff-only, so nothing there. */
  ctx.seedTag = (st, m, team) => {
    if (!m || st.id === 'Q') return '';
    const first = m.a === team, seed = first ? m.seedA : m.seedB;
    return seed ? `<span class="tag ${first ? 'red' : 'blue'}">Seed ${seed}</span>` : '';
  };

  /** Qualifying arena (Red/Blue) a team plays its match on, and the match's scheduled time. */
  ctx.arenaOf = (m, team) => (!m ? '' : m.a === team ? (m.arenaA || '') : m.b === team ? (m.arenaB || '') : '');
  ctx.arenaTag = (m, team) => { const a = ctx.arenaOf(m, team); return a ? `<span class="tag ${a}" title="${a[0].toUpperCase() + a.slice(1)} arena">${a.toUpperCase()}</span>` : ''; };
  ctx.matchTime = m => (m && m.time) || '';

  /** A Round 2 slot still waiting for a redo winner ("W-Q1"). */
  ctx.slotName = slot => 'Winner of Qual. match ' + String(slot).slice(1) + ' redo';
  /** Matches in the order they are played: Round 2 interleaves the qualifying redo. */
  ctx.lineFor = st => (st.host && ctx.B.S[st.host].status !== 'locked' ? ctx.B.S[st.host] : st);
  ctx.matchTitle = m => 'Match ' + m.no;
  ctx.matchShort = m => (m.stage === 'QR' ? 'Q' + m.no : 'M' + m.no);
  /** Names of both sides of a match, with a placeholder for a slot not filled yet. */
  ctx.sides = (m, sep) => [['a', 'A'], ['b', 'B']].map(([k, K]) => m[k]
    ? `<span class="qn">${ctx.tag(m[k])} ${esc(ctx.tname(m[k]))}${ctx.arenaTag(m, m[k]) ? ' ' + ctx.arenaTag(m, m[k]) : ''}</span>`
    : m['slot' + K] ? `<i class="slot">${esc(ctx.slotName(m['slot' + K]))}</i>` : '').filter(Boolean).join(sep);

  /** One short status word per team in a stage. */
  ctx.result = (st, team) => {
    const r = ctx.runOf(st.id, team);
    const { res } = T.teamResult(st, team);
    if (st.id === 'Q' && ctx.B.wildcard === team) return { cls: 'green', label: 'Wildcard' };
    if (res === 'win') return { cls: 'gold', label: 'Win' };
    if (res === 'bye') return { cls: 'gold', label: 'Bye' };
    if (res === 'tie') return { cls: 'red', label: 'Tie' };
    if (r && r.status === 'forfeit') return { cls: 'red', label: 'No-show' };
    if (res === 'lose') return { cls: 'out', label: 'Out' };
    if (ctx.B.current && ctx.B.current.stage === st.id && ctx.B.current.team === team) return { cls: 'blue', label: 'On now' };
    if (r && r.status === 'done') return { cls: 'out', label: 'Waiting' };
    if (r && r.status === 'skip') return { cls: 'out', label: 'Later' };
    return null;
  };
  ctx.resultTag = (st, team) => {
    const r = ctx.result(st, team);
    if (!r) return '';
    return r.cls === 'out' ? `<span class="res-out">${r.label}</span>` : `<span class="tag ${r.cls}">${r.label}</span>`;
  };
  ctx.scoreText = r => (!r ? '--' : r.status === 'forfeit' ? 'DNS' : r.status === 'done' ? fmt(T.score(r)) : '--');
  ctx.formula = r => (r && r.status === 'done' ? `${fmt(r.d1)} × ${fmt(r.d2)}` : r && r.status === 'forfeit' ? 'Did not start' : '');

  /** Start the live store; render() runs after every change with ctx.B computed. */
  ctx.start = opts => {
    ctx.store = UI.createStore({
      url: '/api/obstacle',
      blank: () => ({ runs: {}, picks: {}, current: null, focus: null }),
      onSheets: s => { ctx.sheets = s; ctx.teams = Object.fromEntries(s.teams.map(t => [t.no, t])); },
      onChange: () => { ctx.B = T.compute(ctx.sheets, ctx.store.data); opts.render(); },
      onConflict: opts.onConflict,
      onAuth: opts.onAuth,
    });
    ctx.B = T.compute(ctx.sheets, ctx.store.data);
    opts.render();
    ctx.store.start();
    return ctx.store;
  };
  ctx.recompute = () => { ctx.B = T.compute(ctx.sheets, ctx.store.data); };
  ctx.esc = esc;
  window.Obstacle = ctx;
})();
