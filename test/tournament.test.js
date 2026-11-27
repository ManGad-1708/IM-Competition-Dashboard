// Simulates a whole tournament with random scores: node test/tournament.test.js
const assert = require('assert');
const T = require('../views/tournament.js');
assert.strictEqual(T.score({ status: 'done', d1: 2.5, d2: 4 }), 10, 'score is T1 × T2');
const sheets = require('../lib/sheets').loadSheets();
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = { runs: {}, picks: {} };
let t = 0;
function playStage(id) {
  const b = T.compute(sheets, data);
  const st = b.S[id];
  assert.strictEqual(st.status, 'live', id + ' should be live');
  data.runs[id] = data.runs[id] || {};
  st.queue.forEach(team => { data.runs[id][team] = { status: 'done', d1: Math.round(rnd() * 500) / 10, d2: Math.round(rnd() * 500) / 10, t: ++t }; });
  return T.compute(sheets, data);
}
let b = T.compute(sheets, data);
// Queue order follows the schedule: both teams of match 1, then match 2, and so on.
const qOrder = sheets.qualifying.flatMap(m => [m.a, m.b]).filter(Boolean);
assert.strictEqual(b.active.id, 'Q'); assert.strictEqual(b.S.Q.queue.length, 54);
assert.strictEqual(b.current.team, qOrder[0]); assert.deepStrictEqual(b.next.map(x => x.team), [qOrder[1], qOrder[2]]);
// skip the first team -> goes to the end
data.runs.Q = { [qOrder[0]]: { status: 'skip', skipT: 1 } };
b = T.compute(sheets, data);
assert.strictEqual(b.current.team, qOrder[1]); assert.strictEqual(b.S.Q.queue.at(-1), qOrder[0]);
b = playStage('Q');
assert.strictEqual(b.S.Q.status, 'done');
assert.strictEqual(b.S.Q.advance.length, 28); assert.ok(b.wildcard);
const r28 = b.S.R28; assert.strictEqual(r28.matches.length, 14);
assert.strictEqual(r28.matches[0].a, r28.seeds[0].team); assert.strictEqual(r28.matches[0].b, r28.seeds[14].team);
b = playStage('R28'); assert.strictEqual(b.S.R14.matches.length, 7);
b = playStage('R14'); assert.ok(b.S.R14.bye); assert.strictEqual(b.S.QF.matches.length, 3);
assert.ok(!b.S.QF.entrants.includes(b.S.R14.bye));
b = playStage('QF'); assert.strictEqual(b.S.SF.matches.length, 2); assert.ok(b.S.SF.entrants.includes(b.S.R14.bye));
b = playStage('SF'); assert.strictEqual(b.S.F.status, 'live'); assert.strictEqual(b.S.P3.status, 'live');
// a tie in the final needs a moderator pick (score = T1 × T2: 1×2 = 2×1)
const f = b.S.F.matches[0];
data.runs.F = { [f.a]: { status: 'done', d1: 1, d2: 2, t: ++t }, [f.b]: { status: 'done', d1: 2, d2: 1, t: ++t } };
b = T.compute(sheets, data); assert.ok(b.S.F.matches[0].tie); assert.strictEqual(b.S.F.status, 'live');
data.picks[b.S.F.matches[0].key] = f.b;
b = playStage('P3');
assert.strictEqual(b.podium.first, f.b); assert.strictEqual(b.podium.second, f.a); assert.ok(b.podium.third);
// forfeit loses
const q0 = b.S.Q.matches.find(m => b.S.R28.entrants.includes(m.winner) && m.winner !== b.wildcard);
const loser = q0.loser;
data.runs.Q[q0.winner] = { status: 'forfeit', t: ++t };
b = T.compute(sheets, data); assert.strictEqual(b.S.Q.matches.find(m => m.key === q0.key).winner, loser);
assert.strictEqual(b.podium, null, 'editing qualifying re-flows later rounds');
console.log('ok');
