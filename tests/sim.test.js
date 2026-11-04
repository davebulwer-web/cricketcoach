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

const teamWins = {};
let firstRuns = 0, firstWkts = 0, wins = [0, 0], ties = 0, chaseWins = 0;
const totals = [];
for (let s = 0; s < N; s++) {
  const a = s % 18, b = (a + 1 + (s * 7) % 17) % 18;
  const m = CC.Match.create({ home: teams[a], away: teams[b], overs: 20, humanSide: 2, seed: s + 1 });
  m.doToss();
  m.chooseToss();
  let guard = 0;
  while (!m.result) {
    m.bowlBall();
    assert(++guard < 1000, 'match did not finish');
  }
  m.innings.forEach((inn, i) => {
    const ex = inn.extras.wides + inn.extras.noballs + inn.extras.byes;
    const batRuns = inn.batters.reduce((a, b) => a + b.runs, 0);
    assert.strictEqual(batRuns + ex, inn.runs, 'batting runs + extras = total');
    const bowlRuns = inn.bowlers.reduce((a, b) => a + b.runs, 0);
    assert.strictEqual(bowlRuns, inn.runs - inn.extras.byes, 'bowler runs');
    const outs = inn.batters.filter(b => b.out).length;
    assert.strictEqual(outs, inn.wkts, 'dismissals = wickets');
    assert(inn.wkts <= 10 && inn.balls <= 120, 'limits');
    inn.bowlers.forEach(b => assert(b.balls <= 24, 'max 4 overs per bowler'));
    assert.strictEqual(inn.bowlers.reduce((a, b) => a + b.balls, 0), inn.balls, 'balls add up');
    if (i === 1) assert(inn.runs < inn.target + 7, 'chase stops at target');
  });
  // No bowler bowls consecutive overs.
  let prev = null, over = -1, inn = -1;
  m.log.forEach(e => {
    if (e.innings !== inn) { inn = e.innings; prev = null; over = -1; }
    if (e.over !== over) { assert(e.bowler !== prev || e.over === over, 'consecutive overs'); prev = e.bowler; over = e.over; }
  });
  firstRuns += m.innings[0].runs;
  firstWkts += m.innings[0].wkts;
  totals.push(m.innings[0].runs);
  if (m.result.winner === null) ties++; else { wins[m.result.winner]++; teamWins[m.teams[m.result.winner].id] = (teamWins[m.teams[m.result.winner].id] || 0) + 1; }
  if (m.result.by === 'wickets') chaseWins++;
}
totals.sort((a, b) => a - b);
console.log('matches', N);
console.log('avg 1st innings', (firstRuns / N).toFixed(1), 'for', (firstWkts / N).toFixed(1));
console.log('1st innings 10th/50th/90th pct', totals[Math.floor(N * .1)], totals[Math.floor(N * .5)], totals[Math.floor(N * .9)]);
console.log('wins home', wins[0], 'away', wins[1], 'ties', ties, 'chasing wins', chaseWins);
console.log('wins by county', ids.map(id => id + ' ' + (teamWins[id] || 0)).join(', '));
console.log('all checks passed');
