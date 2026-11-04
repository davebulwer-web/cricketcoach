// Simulates many computer-vs-computer matches and checks the engine's
// bookkeeping and scoring balance. Run with: node tests/sim.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = { console, Math };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/config.js', 'js/data/counties.js', 'js/data/names.js', 'js/match/engine.js', 'js/career/squads.js', 'js/career/season.js', 'js/career/market.js', 'js/career/career.js']) {
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
// --- A whole season ----------------------------------------------------------

CC.Career.begin(4242);
CC.Career.takeCharge('KEN');
const sched = CC.Career.state.schedule;
const count = {};
sched.events.forEach(ev => {
  const seen = {};
  ev.fixtures.forEach(f => {
    assert(!seen[f.home] && !seen[f.away] && f.home !== f.away, 'nobody plays twice on one day');
    seen[f.home] = seen[f.away] = true;
    [f.home, f.away].forEach(id => { const k = id + ev.comp; count[k] = (count[k] || 0) + 1; });
  });
});
ids.forEach(id => {
  assert.strictEqual(count[id + 'CC'], 14, 'fourteen championship matches');
  assert.strictEqual(count[id + 'T20'], 16, 'sixteen T20 group matches');
  assert.strictEqual(count[id + 'OD'], 8, 'eight 50-over group matches');
});
const started = Date.now();
while (!CC.Career.seasonOver()) CC.Career.playNext(null);
const seasonMs = Date.now() - started;
sched.events.forEach(ev => {
  assert(ev.done && ev.fixtures.length, 'every event played');
  ev.fixtures.forEach(f => assert(f.result, 'every fixture has a result'));
  if (ev.stage !== 'league' && ev.stage !== 'group') {
    ev.fixtures.forEach(f => assert([f.home, f.away].indexOf(f.result.winner) >= 0, 'knockouts have a winner'));
  }
});
const koCount = { T20: [4, 2, 1], OD: [2, 1] };
Object.keys(koCount).forEach(comp => {
  const evs = sched.events.filter(e => e.comp === comp && e.stage !== 'group');
  assert.strictEqual(JSON.stringify(evs.map(e => e.fixtures.length)), JSON.stringify(koCount[comp]), comp + ' knockout shape');
});
// Table points add up: every championship match hands out 16 (win) or 16 (two draws) plus bonuses.
[1, 2].forEach(div => {
  const t = CC.Season.table(sched, 'CC', div);
  t.forEach(r => {
    assert.strictEqual(r.p, 14, 'played 14');
    assert.strictEqual(r.w + r.d + r.l + r.t, r.p, 'W+D+L+T = P');
    assert(r.bat <= 5 * 14 && r.bowl <= 3 * 14, 'bonus point limits');
    assert.strictEqual(r.pts, r.w * 16 + (r.d + r.t) * 8 + r.bat + r.bowl, 'championship points');
  });
});
['NORTH', 'SOUTH'].forEach(g => {
  const t = CC.Season.table(sched, 'T20', g);
  assert.strictEqual(t.reduce((a, r) => a + r.w, 0), t.reduce((a, r) => a + r.l, 0), 'T20 wins = losses');
  t.forEach(r => assert.strictEqual(r.pts, r.w * 2 + r.t, 'T20 points'));
});
// Player figures: matches never exceed fixtures, and totals add up.
let ccRuns = 0, ccResultRuns = 0;
ids.forEach(id => CC.Career.club(id).players.forEach(p => {
  const s = p.stats || {};
  if (s.CC) { assert(s.CC.m <= 14 && s.CC.inns <= s.CC.m * 2 && s.CC.no <= s.CC.inns, 'championship figures'); ccRuns += s.CC.runs; }
  if (s.T20) assert(s.T20.m <= 19 && s.T20.balls <= s.T20.m * 24, 'T20 figures');
}));
sched.events.filter(e => e.comp === 'CC').forEach(e => e.fixtures.forEach(f => f.result.innings.forEach(i => { ccResultRuns += i.runs; })));
assert(ccRuns > ccResultRuns * 0.9 && ccRuns <= ccResultRuns, 'batting figures account for the runs, less extras');
const lead = CC.Season.leaders(CC.Career.state.clubs, 'CC', 3);
assert(lead.runs.length === 3 && lead.runs[0].s.runs >= lead.runs[1].s.runs, 'leaders sorted');
assert(CC.Career.state.inbox.length > 10, 'news items for the season');
assert(CC.Career.state.inbox.some(n => /^CHAMP: (BEAT|LOST TO|DREW WITH|TIED WITH)/.test(n.text)), 'result news');
console.log('leading championship run scorer', lead.runs[0].p.name, lead.runs[0].s.runs, '- wicket taker', lead.wkts[0].p.name, lead.wkts[0].s.wkts);

const summary = CC.Season.summary(sched);
const nextDivs = CC.Season.nextDivisions(sched);
assert.strictEqual(nextDivs[1].length, 10, 'ten in Division 1');
assert.strictEqual(nextDivs[2].length, 8, 'eight in Division 2');
assert.strictEqual(new Set(nextDivs[1].concat(nextDivs[2])).size, 18, 'every county in one division');
summary.promoted.forEach(id => assert(nextDivs[1].indexOf(id) >= 0, 'promoted sides go up'));
summary.relegated.forEach(id => assert(nextDivs[2].indexOf(id) >= 0, 'relegated sides go down'));
CC.Career.startNextSeason();
assert.strictEqual(CC.Career.state.season, 2028, 'next season');
assert.strictEqual(JSON.stringify(CC.Career.state.schedule.divisions), JSON.stringify(nextDivs), 'new season uses the new divisions');
assert.strictEqual(CC.Career.state.history.length, 1, 'season recorded in history');
assert(CC.Career.state.history[0].leaders.CC.runs.value > 0, 'season leaders kept in history');
ids.forEach(id => CC.Career.club(id).players.forEach(p => assert(!p.stats || !p.stats.CC, 'figures reset for the new season')));
// --- Squad rules -------------------------------------------------------------

const st = CC.Career.state;
const M = CC.Market, R = CC.Squads.RULES;
const myClub = CC.Career.club();
assert(CC.Career.transferWindow().open, 'window open pre-season');
// Overseas limits.
const fa = st.freeAgents;
assert(fa.length >= 30 && fa.some(p => p.overseas), 'free agent pool');
myClub.budget = 99999;
while (myClub.players.filter(p => p.overseas).length < R.maxOverseasSquad) {
  assert.strictEqual(CC.Career.sign(fa.find(p => p.overseas).id), null, 'sign overseas player');
}
assert(/OVERSEAS/.test(M.signProblem(st, fa.find(p => p.overseas))), 'overseas squad limit');
myClub.selection = null;
const xi = CC.Career.currentXI();
assert(xi.filter(p => p.overseas).length <= R.maxOverseasXI, 'auto XI overseas limit');
const outsider = myClub.players.find(p => p.overseas && xi.indexOf(p) < 0);
const firstNonOverseas = xi.find(p => !p.overseas);
assert.strictEqual(CC.Career.toggleXI(firstNonOverseas.id), null, 'leave a player out');
if (outsider && xi.filter(p => p.overseas).length === R.maxOverseasXI) {
  assert(/OVERSEAS/.test(CC.Career.toggleXI(outsider.id)), 'overseas XI limit when picking');
}
assert.strictEqual(M.chosenXI(st), null, '10 players is not an XI');
assert.strictEqual(CC.Career.team(st.countyId).players.length, 11, 'auto-pick covers an incomplete XI');
CC.Career.autoXI();
// Squad size limits.
while (myClub.players.length < R.squadMax) assert.strictEqual(CC.Career.sign(fa.find(p => !p.overseas).id), null, 'sign');
assert(/FULL/.test(M.signProblem(st, fa.find(p => !p.overseas))), 'squad maximum');
const before = M.wageBill(myClub);
const gone = myClub.players[myClub.players.length - 1];
assert.strictEqual(CC.Career.release(gone.id), null, 'release');
assert.strictEqual(M.wageBill(myClub), before, 'released wages still count this season');
while (myClub.players.length > R.squadMin) CC.Career.release(myClub.players[myClub.players.length - 1].id);
assert(/BELOW/.test(CC.Career.release(myClub.players[0].id)), 'squad minimum');
// Contracts.
const long = myClub.players.find(p => p.contract > 1);
if (long) assert(/LEFT/.test(CC.Career.renew(long.id)), 'renew only in the last year');
const last = myClub.players.find(p => p.contract === 1);
if (last) { assert.strictEqual(CC.Career.renew(last.id), null, 'renew'); assert(last.contract > 1, 'renewed'); }
// Windows close mid-season.
const sched2 = st.schedule;
const savedNext = sched2.next;
sched2.next = sched2.events.findIndex(e => e.day > 151 && e.day < 182);
assert(!CC.Career.transferWindow().open, 'window closed in June');
assert(/WINDOW/.test(M.signProblem(st, fa[0])), 'no signings while closed');
sched2.next = savedNext;

console.log('\nseason: champions', summary.champions, 'promoted', summary.promoted.join(' '), 'relegated',
  summary.relegated.join(' '), 'T20', summary.t20, '50 cup', summary.od, '(' + seasonMs + ' ms)');

// --- Close seasons ------------------------------------------------------------

const ages = {};
CC.counties.forEach(c => CC.Career.club(c.id).players.forEach(p => { ages[p.id] = p.age; }));
for (let y = 0; y < 2; y++) {
  while (!CC.Career.seasonOver()) CC.Career.playNext(null);
  CC.Career.startNextSeason();
  const seen = {};
  CC.counties.forEach(c => {
    const club = CC.Career.club(c.id);
    assert(club.players.length >= R.squadMin && club.players.length <= R.squadMax, 'squad size after close season: ' + club.players.length);
    assert(club.players.filter(p => p.overseas).length <= R.maxOverseasSquad, 'overseas registrations');
    if (c.id !== st.countyId) assert(M.wageBill(club) <= club.budget, 'computer clubs within budget');
    assert.strictEqual(club.deadWages, 0, 'released wages cleared');
    club.players.forEach(p => {
      assert(!seen[p.id], 'a player is at one county only'); seen[p.id] = true;
      assert(p.contract >= 1, 'everyone has a contract');
      assert(p.age >= 18 && p.age <= 38, 'ages');
      if (ages[p.id] !== undefined && y === 0) assert.strictEqual(p.age, ages[p.id] + 1, 'players age a year');
    });
    assert.strictEqual(CC.Squads.pickXI(club.players).length, 11, 'can still pick an XI');
  });
  st.freeAgents.forEach(p => assert(!seen[p.id], 'free agents are not at a county'));
  assert(st.news && st.news.youth.length <= 2, 'close season news');
}
console.log('two more seasons: my county news', JSON.stringify(st.news));

console.log('\nall checks passed');
