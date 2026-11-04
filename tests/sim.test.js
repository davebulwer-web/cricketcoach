// Simulates many computer-vs-computer matches and checks the engine's
// bookkeeping and scoring balance. Run with: node tests/sim.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = { console, Math };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/config.js', 'js/data/teams.js', 'js/match/engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const CC = ctx.CC;
const N = Number(process.argv[2]) || 2000;

let firstRuns = 0, firstWkts = 0, wins = [0, 0], ties = 0, chaseWins = 0;
const totals = [];
for (let s = 0; s < N; s++) {
  const m = CC.Match.create({ home: CC.teams[0], away: CC.teams[1], overs: 20, humanSide: 2, seed: s + 1 });
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
  if (m.result.winner === null) ties++; else wins[m.result.winner]++;
  if (m.result.by === 'wickets') chaseWins++;
}
totals.sort((a, b) => a - b);
console.log('matches', N);
console.log('avg 1st innings', (firstRuns / N).toFixed(1), 'for', (firstWkts / N).toFixed(1));
console.log('1st innings 10th/50th/90th pct', totals[Math.floor(N * .1)], totals[Math.floor(N * .5)], totals[Math.floor(N * .9)]);
console.log('wins', CC.teams[0].name, wins[0], CC.teams[1].name, wins[1], 'ties', ties, 'chasing wins', chaseWins);
console.log('all checks passed');
