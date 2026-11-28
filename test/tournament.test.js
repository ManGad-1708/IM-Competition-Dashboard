// Simulates a whole tournament with random scores: node test/tournament.test.js
const assert = require('assert');
const T = require('../views/tournament.js');
assert.strictEqual(T.score({ status: 'done', d1: 2.5, d2: 4 }), 10, 'score is T1 × T2');
// Seeding by score is tested without Round2.xlsx; the sheet-driven round is tested at the end.
const sheets = Object.assign({}, require('../lib/sheets').loadSheets(), { round2: [], rounds: {} });
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

// Round 2 from sheets/Round2.xlsx, with a redo of qualifying match 1 played in the middle of it.
{
  const s2 = Object.assign({}, sheets, { round2: [
    { no: '1', a: '1', b: '18', seedA: 1, seedB: 15, time: '2:00 PM – 2:03 PM', start: '2:00 PM', end: '2:03 PM' },
    { no: '1', redoOf: '1', a: '47', b: '2', start: '2:04 PM', end: '2:07 PM', time: '2:04 PM – 2:07 PM' },
    { no: '2', a: '24', b: '', slotB: 'Q1', seedA: 5, seedB: 19 },
  ] });
  const d = { runs: { Q: {} }, picks: {} };
  sheets.qualifying.forEach(m => { d.runs.Q[m.a] = { status: 'done', d1: 1, d2: 1, t: 1 }; d.runs.Q[m.b] = { status: 'done', d1: 2, d2: 2 + +m.no, t: 1 }; });
  let x = T.compute(s2, d);
  assert.strictEqual(x.S.R28.matches.length, 2);
  assert.strictEqual(x.S.QR.status, 'live'); assert.ok(x.S.Q.matches[0].redo);
  assert.strictEqual(x.S.R28.matches[1].b, null, 'slot waits for the redo');
  assert.ok(!x.S.R28.matches[1].bye, 'a waiting slot is not a bye');
  assert.strictEqual(x.active.id, 'R28', 'the redo never becomes the automatic stage');
  assert.deepStrictEqual(x.S.R28.timeline.map(m => m.stage), ['R28', 'QR', 'R28']);
  assert.strictEqual(x.current.team, '1');
  d.runs.R28 = { 1: { status: 'done', d1: 1, d2: 1, t: 2 }, 18: { status: 'done', d1: 3, d2: 3, t: 2 } };
  x = T.compute(s2, d);
  assert.deepStrictEqual([x.current.stage, x.current.team], ['QR', '47'], 'redo comes up in sheet order');
  d.runs.QR = { 47: { status: 'done', d1: 9, d2: 9, t: 3 }, 2: { status: 'done', d1: 1, d2: 2, t: 3 } };
  x = T.compute(s2, d);
  assert.strictEqual(x.S.R28.matches[1].b, '2', 'redo winner takes the slot');
  assert.strictEqual(x.S.Q.matches[0].winner, '47', 'original qualifying result is untouched');
  assert.strictEqual(x.current.team, '24');
}
console.log('ok round 2');

// Round 3 … Finals sheets: a times-only row adds times to the seeded match; team numbers fix the match-up.
{
  const d = { runs: {}, picks: {} };
  const play = (sh, id) => { const st = T.compute(sh, d).S[id]; d.runs[id] = {}; st.queue.forEach((tm, i) => { d.runs[id][tm] = { status: 'done', d1: 1 + i, d2: 1 + (i * 7) % 13, t: i }; }); };
  const base = Object.assign({}, sheets, { rounds: { R14: [{ no: '1', label: '1', a: '', b: '', start: '3:00 PM', end: '3:03 PM', time: '3:00 PM – 3:03 PM' }, { no: '2', label: '2', a: '', b: '', start: '3:04 PM', end: '3:07 PM', time: '3:04 PM – 3:07 PM' }] } });
  play(base, 'Q'); play(base, 'R28');
  let x = T.compute(base, d);
  const seeded = T.compute(sheets, d).S.R14.matches;
  assert.strictEqual(x.S.R14.matches.length, 7);
  assert.deepStrictEqual(x.S.R14.matches.map(m => [m.a, m.b]), seeded.map(m => [m.a, m.b]), 'times-only sheet keeps seeded match-ups');
  assert.strictEqual(x.S.R14.matches[0].start, '3:00 PM'); assert.strictEqual(x.S.R14.matches[1].end, '3:07 PM');
  assert.strictEqual(x.S.R14.matches[2].start, undefined);
  const fixed = Object.assign({}, sheets, { rounds: { R14: seeded.map((m, i) => ({ no: String(i + 1), label: String(i + 1), a: i === 0 ? m.b : m.a, b: i === 0 ? m.a : m.b, start: '4:00 PM' })) } });
  x = T.compute(fixed, d);
  assert.ok(x.S.R14.fromSheet); assert.strictEqual(x.S.R14.matches[0].a, seeded[0].b, 'team numbers in the sheet fix the match-up');
  assert.strictEqual(x.S.R14.matches[0].start, '4:00 PM');
}
console.log('ok later rounds');
