// Obstacle Course tournament logic. Pure functions: (sheets, saved results) -> bracket.
// Runs in the browser (window.Tournament) and in Node (require) for tests.
//
// Saved data shape (what the moderator edits):
//   runs:  { [stageId]: { [teamNo]: { start:'HH:MM', d1:Number, d2:Number, status:'done'|'skip'|'forfeit', t:ms, skipT:ms } } }
//   picks: { [matchKey]: winnerTeamNo }   // tie decisions by the moderator
//   current: { stage, team } | null      // team called up by the moderator
//   focus: stageId | null                 // stage the moderator is running (else the earliest live one)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tournament = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const STAGES = [
    { id: 'Q', name: 'Qualifying', short: 'QUAL' },
    { id: 'R28', name: 'Best of 28', short: 'TOP 28' },
    { id: 'R14', name: 'Best of 14', short: 'TOP 14' },
    { id: 'QF', name: 'Quarter-Finals', short: 'QF' },
    { id: 'SF', name: 'Semi-Finals', short: 'SEMI' },
    { id: 'P3', name: '3rd Place Play-off', short: '3RD' },
    { id: 'F', name: 'Finals', short: 'FINAL' },
  ];
  const byId = Object.fromEntries(STAGES.map(s => [s.id, s]));

  const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
  /** Score of a run: number, Infinity for a forfeit, null when not run yet. */
  function score(run) {
    if (!run) return null;
    if (run.status === 'forfeit') return Infinity;
    if (run.status !== 'done') return null;
    const a = num(run.d1), b = num(run.d2);
    return a == null || b == null ? null : Math.round((a + b) * 100) / 100;
  }
  // Placeholder seeding tie-break (staff rule pending): lower score, then lower T2 distance, then team number.
  function seedCompare(x, y) {
    const sx = x.score == null ? Infinity : x.score, sy = y.score == null ? Infinity : y.score;
    if (sx !== sy) return sx - sy;
    const tx = x.d2 == null ? Infinity : x.d2, ty = y.d2 == null ? Infinity : y.d2;
    if (tx !== ty) return tx - ty;
    return +x.team - +y.team;
  }
  const keyOf = (stage, a, b) => stage + ':' + [a || '-', b || '-'].join('v');

  function decide(stage, m, runs, picks) {
    const ra = runs[m.a], rb = runs[m.b];
    m.sa = score(ra); m.sb = score(rb);
    m.key = keyOf(stage, m.a, m.b);
    m.winner = m.loser = null; m.tie = false;
    if (!m.b) { if (m.a) { m.winner = m.a; m.bye = true; } return m; }
    if (m.sa == null || m.sb == null) return m;
    if (m.sa < m.sb) { m.winner = m.a; m.loser = m.b; }
    else if (m.sb < m.sa) { m.winner = m.b; m.loser = m.a; }
    else {
      m.tie = true;
      const p = picks[m.key];
      if (p === m.a || p === m.b) { m.winner = p; m.loser = p === m.a ? m.b : m.a; m.picked = true; }
    }
    return m;
  }

  /** Seed i plays seed i + n/2 (1v15, 2v16, ... for 28 teams). */
  function pairBySeed(stage, seeded) {
    const half = Math.ceil(seeded.length / 2);
    const out = [];
    for (let i = 0; i < half; i++) {
      const a = seeded[i], b = seeded[i + half];
      out.push({ no: String(i + 1), a: a.team, b: b ? b.team : null, seedA: i + 1, seedB: b ? i + 1 + half : null });
    }
    return out;
  }

  function entrantInfo(team, stageId, runs) {
    const r = (runs[stageId] || {})[team];
    return { team, score: score(r), d2: r && r.status === 'done' ? num(r.d2) : null, from: stageId };
  }

  function compute(sheets, data) {
    data = data || {};
    const runs = data.runs || {}, picks = data.picks || {};
    const stages = STAGES.map(s => ({ ...s, status: 'locked', matches: [], entrants: [], notes: [] }));
    const S = Object.fromEntries(stages.map(s => [s.id, s]));
    const R = id => runs[id] || {};

    const finish = (st, matches) => {
      st.matches = matches.map(m => decide(st.id, m, R(st.id), picks));
      st.entrants = st.matches.flatMap(m => [m.a, m.b]).filter(Boolean);
      st.status = st.matches.length && st.matches.every(m => m.winner) ? 'done' : 'live';
      st.ties = st.matches.filter(m => m.tie && !m.picked);
    };
    const winners = st => st.matches.map(m => m.winner).filter(Boolean);
    const losers = st => st.matches.map(m => m.loser).filter(Boolean);
    const seedFrom = (teams, stageOf) => teams.map(t => entrantInfo(t, stageOf(t), runs)).sort(seedCompare);

    // 1. Qualifying — straight from the sheet.
    const q = S.Q;
    finish(q, (sheets.qualifying || []).map(m => ({ no: m.no, a: m.a, b: m.b, sideA: (sheets.sides || [])[0], sideB: (sheets.sides || [])[1] })));
    if (!q.matches.length) q.status = 'locked';

    // Qualifying winners, plus the best non-winner when needed for an even field.
    let wildcard = null;
    if (q.status === 'done') {
      const adv = winners(q);
      if (adv.length % 2 === 1) {
        const pool = seedFrom(losers(q), () => 'Q').filter(x => x.score !== Infinity && x.score != null);
        if (pool.length) {
          const best = pool[0];
          const tied = pool.filter(x => x.score === best.score);
          const wk = 'Q:wildcard';
          if (tied.length > 1 && !tied.some(x => x.team === picks[wk])) {
            q.wildcardTie = { key: wk, teams: tied.map(x => x.team) };
            q.status = 'live';
          } else {
            wildcard = tied.length > 1 ? picks[wk] : best.team;
            q.wildcardPicked = tied.length > 1;
          }
        }
      }
      q.advance = wildcard ? adv.concat(wildcard) : adv;
    }
    q.wildcard = wildcard;

    // 2. Best of 28, seeded by qualifying score.
    let prev = q;
    const seededStage = (st, teams, stageOf) => {
      const seeded = seedFrom(teams, stageOf);
      st.seeds = seeded;
      finish(st, pairBySeed(st.id, seeded));
    };
    if (q.status === 'done') seededStage(S.R28, q.advance, () => 'Q');
    if (S.R28.status === 'done') seededStage(S.R14, winners(S.R28), () => 'R28');

    // 4. Quarter-finals: best Best-of-14 winner skips straight to the semis.
    let bye = null;
    if (S.R14.status === 'done') {
      const w = seedFrom(winners(S.R14), () => 'R14');
      bye = w[0] ? w[0].team : null;
      S.R14.bye = bye;
      seededStage(S.QF, w.slice(1).map(x => x.team), () => 'R14');
    }
    if (S.QF.status === 'done') {
      const pool = winners(S.QF).map(t => entrantInfo(t, 'QF', runs));
      if (bye) pool.push(entrantInfo(bye, 'R14', runs));
      const seeded = pool.sort(seedCompare);
      S.SF.seeds = seeded;
      finish(S.SF, pairBySeed('SF', seeded));
    }
    if (S.SF.status === 'done') {
      const sfSeed = ts => seedFrom(ts, () => 'SF');
      const l = sfSeed(losers(S.SF)), w = sfSeed(winners(S.SF));
      finish(S.P3, [{ no: '1', a: l[0] && l[0].team, b: l[1] && l[1].team }]);
      finish(S.F, [{ no: '1', a: w[0] && w[0].team, b: w[1] && w[1].team }]);
    }

    // Queues: team order inside a stage = match order, both teams of a match back to back.
    stages.forEach(st => {
      if (st.status === 'locked') { st.queue = []; st.skipped = []; return; }
      const rs = R(st.id);
      const order = st.matches.flatMap(m => [m.a, m.b]).filter(Boolean);
      const pending = order.filter(t => !rs[t] || (rs[t].status !== 'done' && rs[t].status !== 'forfeit'));
      st.skipped = pending.filter(t => rs[t] && rs[t].status === 'skip').sort((a, b) => (rs[a].skipT || 0) - (rs[b].skipT || 0));
      st.queue = pending.filter(t => !st.skipped.includes(t)).concat(st.skipped);
      st.done = order.length - pending.length;
      st.total = order.length;
    });

    const live = stages.filter(s => s.status === 'live');
    let active = (data.focus && S[data.focus] && S[data.focus].status !== 'locked') ? S[data.focus] : (live[0] || null);
    if (!active) active = [...stages].reverse().find(s => s.status === 'done') || stages[0];

    // Current team: the one the moderator called up (if still in that stage), else head of the queue.
    let current = null;
    const c = data.current;
    if (c && S[c.stage] && S[c.stage].status !== 'locked' && S[c.stage].entrants.includes(c.team)) current = { stage: c.stage, team: c.team, pinned: true };
    else if (active.queue && active.queue.length) current = { stage: active.id, team: active.queue[0], pinned: false };
    const curStage = current ? S[current.stage] : active;
    const next = (curStage.queue || []).filter(t => !current || t !== current.team).slice(0, 2).map(team => ({ stage: curStage.id, team }));

    // Recent results across every stage.
    const recent = [];
    Object.keys(runs).forEach(sid => Object.entries(runs[sid] || {}).forEach(([team, r]) => {
      if (S[sid] && S[sid].entrants.includes(team) && (r.status === 'done' || r.status === 'forfeit')) recent.push({ stage: sid, team, run: r, score: score(r) });
    }));
    recent.sort((a, b) => (b.run.t || 0) - (a.run.t || 0));

    const podium = S.F.status === 'done' ? { first: S.F.matches[0].winner, second: S.F.matches[0].loser, third: S.P3.status === 'done' ? S.P3.matches[0].winner : null } : null;
    return { stages, S, active, current, next, recent, podium, wildcard };
  }

  /** Where a team stands in a stage: 'win' | 'lose' | 'tie' | 'pending' | 'bye'. */
  function teamResult(st, team) {
    const m = st.matches.find(x => x.a === team || x.b === team);
    if (!m) return { m: null, res: 'none' };
    const opp = m.a === team ? m.b : m.a;
    if (m.bye) return { m, opp, res: 'bye' };
    if (m.winner) return { m, opp, res: m.winner === team ? 'win' : 'lose' };
    if (m.tie) return { m, opp, res: 'tie' };
    return { m, opp, res: 'pending' };
  }

  return { STAGES, byId, score, compute, teamResult, seedCompare };
});
