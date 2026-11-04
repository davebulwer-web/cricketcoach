// Simulates many computer-vs-computer matches and checks the engine's
// bookkeeping and scoring balance. Run with: node tests/sim.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = { console, Math };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/config.js', 'js/data/counties.js', 'js/data/names.js', 'js/match/engine.js', 'js/career/squads.js', 'js/career/career.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const CC = ctx.CC;
const N = Number(process.argv[2]) || 2000;

// --- Generated counties -----------------------------------------------------
const world = CC.Career.begin(12345);
const ids = CC.counties.map(c => c.id);
assert.strictEqual(ids.length, 18, '18 counties');
const seenIds = {};
ids.forEach(id => {
  const squad = world.clubs[id].players;
  assert(squad.length >= 20 && squad.length <= CC.Squads.RULES.squadMax, 'squad size');
  const names = squad.map(p => p.name);
  assert.strictEqual(new Set(names).size, names.length, 'unique names in a squad');
  squad.forEach(p => {
    assert(!seenIds[p.id], 'unique player ids'); seenIds[p.id] = true;
    assert(p.bat >= 1 && p.bat <= 99 && p.bowl >= 1 && p.bowl <= 99, 'ratings in range');
    assert(p.name.length <= 12, 'name fits the screen: ' + p.name);
  });
  const os = squad.filter(p => p.overseas).length;
  assert(os >= 1 && os <= 2, 'one or two overseas players');
  const xi = CC.Squads.pickXI(squad);
  assert.strictEqual(xi.length, 11, 'XI has 11');
  assert(xi.filter(p => p.overseas).length <= CC.Squads.RULES.maxOverseasXI, 'overseas limit in XI');
  assert(xi.some(p => p.role === 'WK'), 'XI has a keeper');
  assert(xi.filter(p => p.style).length >= 5, 'XI has five bowling options');
  assert(CC.Career.wageBill(id) <= world.clubs[id].budget, 'wages within budget');
});
// Same seed, same world.
assert.strictEqual(JSON.stringify(CC.Career.begin(12345)), JSON.stringify(world), 'generation is repeatable');
const teams = ids.map(id => CC.Career.team(id));

// --- Matches in every format ---------------------------------------------

// Checks that apply to any finished match.
function checkMatch(m) {
  const fmt = CC.Match.FORMATS[m.format];
  m.innings.forEach((inn, i) => {
    const ex = inn.extras.wides + inn.extras.noballs + inn.extras.byes;
    const batRuns = inn.batters.reduce((a, b) => a + b.runs, 0);
    assert.strictEqual(batRuns + ex, inn.runs, 'batting runs + extras = total');
    const bowlRuns = inn.bowlers.reduce((a, b) => a + b.runs, 0);
    assert.strictEqual(bowlRuns, inn.runs - inn.extras.byes, 'bowler runs');
    const outs = inn.batters.filter(b => b.out).length;
    assert.strictEqual(outs, inn.wkts, 'dismissals = wickets');
    assert(inn.wkts <= 10, 'at most 10 wickets');
    assert.strictEqual(inn.bowlers.reduce((a, b) => a + b.balls, 0), inn.balls, 'balls add up');
    if (inn.target) assert(inn.runs < inn.target + 7, 'chase stops at target');
    for (let k = 1; k < inn.overBowlers.length; k++) assert(inn.overBowlers[k] !== inn.overBowlers[k - 1], 'consecutive overs');
    if (m.limited) {
      assert(inn.balls <= m.overs * 6, 'innings within its overs');
      inn.bowlers.forEach(b => assert(b.balls <= m.maxOversPerBowler * 6, 'bowler over limit'));
      assert(!inn.declared, 'no declarations in limited overs');
    } else {
      assert(inn.at110, 'score at 110 overs recorded for bonus points');
      assert(inn.at110.runs <= inn.runs, 'bonus snapshot not above the total');
      if (inn.declared) assert(inn.wkts < 10 && i < 3, 'only declare with wickets left, not in the 4th innings');
    }
  });
  assert(m.innings.length <= (m.limited ? 2 : 4), 'number of innings');
  const r = m.result;
  if (m.limited) {
    assert(m.innings.length === 2 && r.by !== 'draw' && r.by !== 'innings', 'limited-overs result');
  } else {
    const days = m.rainOvers.reduce((a, lost) => a + (fmt.oversPerDay - lost) * 6, 0);
    assert(m.totalBalls <= days, 'not past the end of day four');
    assert.strictEqual(m.totalBalls, m.innings.reduce((a, i) => a + i.balls, 0), 'match clock');
    if (r.by === 'draw') assert(m.totalBalls === days || m.innings.length === 4, 'draws only when time runs out');
    if (r.by === 'innings') {
      assert.strictEqual(m.innings.length, 3, 'innings win after three innings');
      assert.strictEqual(r.margin, m.totalFor(r.winner) - m.totalFor(1 - r.winner), 'innings margin');
    }
    if (m.followOn) assert.strictEqual(m.innings[1].battingSide, m.innings[2].battingSide, 'follow-on bats again');
    if (r.by === 'runs') assert.strictEqual(r.margin, m.totalFor(r.winner) - m.totalFor(1 - r.winner), 'runs margin');
  }
  if (r.by === 'wickets') assert(m.current().runs >= m.current().target, 'chase reached target');
}

function play(format, n, overs) {
  const stats = { n, runs: 0, wkts: 0, overs: 0, totals: [], by: {}, wins: {}, followOn: 0, declared: 0 };
  for (let s = 0; s < n; s++) {
    const a = s % 18, b = (a + 1 + (s * 7) % 17) % 18;
    const m = CC.Match.create({ home: teams[a], away: teams[b], format, overs, humanSide: 2, seed: s + 1 });
    m.doToss();
    m.chooseToss();
    let guard = 0;
    while (!m.result) {
      m.bowlBall();
      assert(++guard < 5000, 'match did not finish');
    }
    checkMatch(m);
    const first = m.innings[0];
    stats.runs += first.runs; stats.wkts += first.wkts; stats.overs += first.balls / 6;
    stats.totals.push(first.runs);
    stats.by[m.result.by] = (stats.by[m.result.by] || 0) + 1;
    if (m.result.winner !== null) { const id = m.teams[m.result.winner].id; stats.wins[id] = (stats.wins[id] || 0) + 1; }
    if (m.followOn) stats.followOn++;
    stats.declared += m.innings.filter(i => i.declared).length;
  }
  const t = stats.totals.sort((x, y) => x - y);
  console.log('\n' + format + ': ' + n + ' matches');
  console.log('  avg 1st innings', (stats.runs / n).toFixed(1), 'for', (stats.wkts / n).toFixed(1), 'in', (stats.overs / n).toFixed(1), 'overs');
  console.log('  1st innings 10th/50th/90th pct', t[Math.floor(n * .1)], t[Math.floor(n * .5)], t[Math.floor(n * .9)]);
  console.log('  results', JSON.stringify(stats.by) + (format === 'FC' ? '  follow-ons ' + stats.followOn + '  declarations ' + stats.declared : ''));
  console.log('  wins by county', ids.map(id => id + ' ' + (stats.wins[id] || 0)).join(', '));
  return stats;
}

const t20 = play('T20', N);
const od = play('OD50', Math.ceil(N / 4));
const fc = play('FC', Math.ceil(N / 8));

// Broad balance checks, so a tuning change that breaks a format fails CI.
const avg = st => st.runs / st.n;
assert(avg(t20) > 130 && avg(t20) < 180, 'T20 scores look like T20');
assert(avg(od) > 230 && avg(od) < 300, '50-over scores look like 50-over cricket');
assert(avg(fc) > 270 && avg(fc) < 400, 'four-day first innings totals');
const draws = (fc.by.draw || 0) / fc.n;
assert(draws > 0.1 && draws < 0.45, 'a sensible share of four-day draws');

// Simulating hands every choice to the computer, including the follow-on.
const sim = CC.Match.create({ home: teams[0], away: teams[1], format: 'FC', humanSide: 0, seed: 99 });
sim.doToss();
sim.chooseToss(true);
sim.simulate(mm => mm.cur === 1);
assert(sim.innings.length === 2 && !sim.result, 'simulate stops when asked');
sim.simulate();
assert(sim.result, 'simulate plays to the end');
checkMatch(sim);

// A human declaration and follow-on choice.
const h = CC.Match.create({ home: teams[0], away: teams[1], format: 'FC', humanSide: 0, seed: 7, noRain: true });
h.doToss();
h.chooseToss(h.tossWinner === 0);
while (h.current().battingSide !== 0 || h.current().balls < 30) {
  if (h.needsBowler()) h.setBowler(h.suggestBowler());
  h.bowlBall();
}
assert(h.canDeclare(), 'can declare while batting');
h.declare();
assert(h.innings[h.innings.length - 2].declared, 'declared innings closed');
console.log('\nall checks passed');
