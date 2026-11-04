// A county season: fixtures, results, league tables and knockouts for the
// three competitions. Pure logic with no drawing, so tests can run whole
// seasons in Node.
//
// The schedule is a list of events (a round of fixtures on one date). Each
// event is played in turn: your county's match (if it has one) is played or
// simulated, and every other fixture is simulated.
(function (root) {
  const CC = root.CC = root.CC || {};

  const COMPS = {
    CC:  { id: 'CC',  name: 'COUNTY CHAMPIONSHIP', short: 'CHAMP', format: 'FC' },
    T20: { id: 'T20', name: 'SHIRES T20 TROPHY',   short: 'T20',   format: 'T20' },
    OD:  { id: 'OD',  name: 'COUNTIES 50 CUP',     short: '50 CUP', format: 'OD50' },
  };

  // Championship points (a simplified version of the real system).
  const POINTS = {
    CC: { win: 16, draw: 8, tie: 8, loss: 0 },
    LO: { win: 2, tie: 1, loss: 0 },
  };
  const BAT_BONUS = [250, 300, 350, 400, 450];   // 1 point at each, first 110 overs
  const BOWL_BONUS = [3, 6, 9];                 // wickets taken, first 110 overs
  const PROMOTED = 2;                           // up from Division 2, down from Division 1

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT'];
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31];
  function dateText(dayOfYear) {
    let d = dayOfYear, m = 0;
    while (d > MONTH_DAYS[m]) { d -= MONTH_DAYS[m]; m++; }
    return d + ' ' + MONTHS[m];
  }

  // Round-robin pairings by the circle method. Returns rounds of [home, away];
  // with an odd number of teams one team rests each round. `double` adds the
  // return fixtures with home and away swapped.
  function roundRobin(ids, double) {
    const t = ids.slice();
    if (t.length % 2) t.push(null);
    const n = t.length, rounds = [];
    const homes = {}, last = {};   // home games so far, and whether each side was at home last time
    ids.forEach(id => { homes[id] = 0; last[id] = null; });
    for (let r = 0; r < n - 1; r++) {
      const round = [];
      for (let i = 0; i < n / 2; i++) {
        const a = t[i], b = t[n - 1 - i];
        if (!a || !b) continue;
        // Keep home and away games even, and avoid long runs of either.
        let aHome;
        if (homes[a] !== homes[b]) aHome = homes[a] < homes[b];
        else if (last[a] !== last[b]) aHome = last[a] === false || last[b] === true;
        else aHome = (r + i) % 2 === 0;
        const [h, w] = aHome ? [a, b] : [b, a];
        homes[h]++;
        last[h] = true; last[w] = false;
        round.push([h, w]);
      }
      rounds.push(round);
      t.splice(1, 0, t.pop());   // rotate everyone but the first team
    }
    if (double) rounds.slice().forEach(rd => rounds.push(rd.map(([h, a]) => [a, h])));
    return rounds;
  }

  function fixture(comp, home, away, group) {
    return { comp, home, away, group, result: null };
  }

  // Build the season's schedule from the current divisions and the counties' groups.
  function create(year, divisions) {
    const north = CC.counties.filter(c => c.group === 'NORTH').map(c => c.id);
    const south = CC.counties.filter(c => c.group === 'SOUTH').map(c => c.id);

    // Championship: 14 rounds in each division.
    const d1 = roundRobin(divisions[1], true).slice(0, 14);
    const d2 = roundRobin(divisions[2], true).slice(0, 14);
    const cc = d1.map((rd, i) => rd.map(([h, a]) => fixture('CC', h, a, 1))
      .concat((d2[i] || []).map(([h, a]) => fixture('CC', h, a, 2))));
    // T20: home and away against everyone in the regional group (16 games each).
    const tn = roundRobin(north, true), ts = roundRobin(south, true);
    const t20 = tn.map((rd, i) => rd.map(([h, a]) => fixture('T20', h, a, 'NORTH'))
      .concat(ts[i].map(([h, a]) => fixture('T20', h, a, 'SOUTH'))));
    // 50 Cup: everyone in the group once (8 games each).
    const on = roundRobin(north, false), os = roundRobin(south, false);
    const od = on.map((rd, i) => rd.map(([h, a]) => fixture('OD', h, a, 'NORTH'))
      .concat(os[i].map(([h, a]) => fixture('OD', h, a, 'SOUTH'))));

    const events = [];
    let day = 93; // 3 April
    const add = (comp, stage, fixtures, label, gap) => {
      events.push({ comp, stage, fixtures, label, day, date: dateText(day), done: false });
      day += gap;
    };
    const ccRound = (i) => add('CC', 'league', cc[i], 'ROUND ' + (i + 1), 7);
    for (let i = 0; i < 8; i++) ccRound(i);                                   // April - May
    t20.forEach((rd, i) => add('T20', 'group', rd, 'GROUP GAME ' + (i + 1), 3)); // June - July
    ccRound(8); ccRound(9);                                                   // July
    od.forEach((rd, i) => {                                                   // August
      add('OD', 'group', rd, 'GROUP GAME ' + (i + 1), 3);
      if (i === 4) add('T20', 'QF', [], 'QUARTER-FINALS', 3);
    });
    add('OD', 'SF', [], 'SEMI-FINALS', 4);
    add('T20', 'SF', [], 'FINALS DAY: SEMI-FINALS', 0);
    add('T20', 'F', [], 'FINALS DAY: FINAL', 5);
    add('OD', 'F', [], 'FINAL', 5);
    for (let i = 10; i < 14; i++) ccRound(i);                                 // September
    return { year, divisions: { 1: divisions[1].slice(), 2: divisions[2].slice() }, events, next: 0, matchCount: 0 };
  }

  // --- Tables -------------------------------------------------------------

  // Bonus points for one side in a four-day result.
  function bonus(result, side) {
    const own = result.innings.find(i => i.side === side);
    const opp = result.innings.find(i => i.side !== side);
    const bat = own && own.at110 ? BAT_BONUS.filter(r => own.at110.runs >= r).length : 0;
    const bowl = opp && opp.at110 ? BOWL_BONUS.filter(w => opp.at110.wkts >= w).length : 0;
    return { bat, bowl };
  }

  // League table for a competition group (CC: 1 or 2; T20/OD: 'NORTH' or 'SOUTH').
  function table(season, comp, group) {
    const ids = comp === 'CC' ? season.divisions[group]
      : CC.counties.filter(c => c.group === group).map(c => c.id);
    const rows = {};
    ids.forEach(id => { rows[id] = { id, p: 0, w: 0, l: 0, d: 0, t: 0, bat: 0, bowl: 0, pts: 0, rf: 0, bf: 0, ra: 0, ba: 0 }; });
    const stage = comp === 'CC' ? 'league' : 'group';
    season.events.forEach(ev => {
      if (ev.comp !== comp || ev.stage !== stage) return;
      ev.fixtures.forEach(f => {
        if (f.group !== group || !f.result) return;
        const r = f.result;
        [f.home, f.away].forEach(id => {
          const row = rows[id];
          row.p++;
          if (r.winner === id) row.w++;
          else if (r.by === 'draw') row.d++;
          else if (r.by === 'tie') row.t++;
          else row.l++;
          if (comp === 'CC') {
            const b = bonus(r, id);
            row.bat += b.bat; row.bowl += b.bowl;
            const P = POINTS.CC;
            row.pts += b.bat + b.bowl + (r.winner === id ? P.win : r.by === 'draw' ? P.draw : r.by === 'tie' ? P.tie : P.loss);
          } else {
            const P = POINTS.LO;
            row.pts += r.winner === id ? P.win : r.by === 'tie' ? P.tie : P.loss;
            // Net run rate: a side bowled out counts as having faced its full overs.
            const quota = CC.Match.FORMATS[COMPS[comp].format].overs * 6;
            r.innings.forEach(inn => {
              const balls = inn.wkts >= 10 ? quota : inn.balls;
              if (inn.side === id) { row.rf += inn.runs; row.bf += balls; } else { row.ra += inn.runs; row.ba += balls; }
            });
          }
        });
      });
    });
    const list = ids.map(id => rows[id]);
    list.forEach(r => { r.nrr = (r.bf ? r.rf * 6 / r.bf : 0) - (r.ba ? r.ra * 6 / r.ba : 0); });
    return list.sort((a, b) => b.pts - a.pts || (comp === 'CC' ? b.w - a.w : b.nrr - a.nrr) || a.id.localeCompare(b.id));
  }

  // --- Knockouts ----------------------------------------------------------

  function winnerOf(f) { return f.result && f.result.winner; }
  function findEvent(season, comp, stage) { return season.events.find(e => e.comp === comp && e.stage === stage); }

  // Fill in a knockout event's fixtures from the group tables or earlier rounds.
  function drawKnockout(season, ev) {
    const n = table(season, ev.comp, 'NORTH').map(r => r.id);
    const s = table(season, ev.comp, 'SOUTH').map(r => r.id);
    if (ev.comp === 'T20' && ev.stage === 'QF') {
      ev.fixtures = [[n[0], s[3]], [s[1], n[2]], [s[0], n[3]], [n[1], s[2]]].map(([h, a]) => fixture('T20', h, a, null));
    } else if (ev.comp === 'OD' && ev.stage === 'SF') {
      ev.fixtures = [[n[0], s[1]], [s[0], n[1]]].map(([h, a]) => fixture('OD', h, a, null));
    } else if (ev.stage === 'SF') {
      const qf = findEvent(season, ev.comp, 'QF').fixtures.map(winnerOf);
      ev.fixtures = [fixture(ev.comp, qf[0], qf[1], null), fixture(ev.comp, qf[2], qf[3], null)];
    } else if (ev.stage === 'F') {
      const sf = findEvent(season, ev.comp, 'SF').fixtures.map(winnerOf);
      ev.fixtures = [fixture(ev.comp, sf[0], sf[1], null)];
    }
  }

  // --- Playing ------------------------------------------------------------

  // The next event to play, with knockout fixtures drawn if needed.
  function nextEvent(season) {
    const ev = season.events[season.next];
    if (ev && ev.stage !== 'league' && ev.stage !== 'group' && !ev.fixtures.length) drawKnockout(season, ev);
    return ev || null;
  }

  function myFixture(ev, countyId) {
    return ev ? ev.fixtures.find(f => f.home === countyId || f.away === countyId) || null : null;
  }

  // Create the match for a fixture. `humanId` is the county the player controls
  // (it becomes side 0); leave it out for a computer-only match.
  function makeMatch(season, f, humanId, seed) {
    const mineAway = humanId && f.away === humanId;
    const home = CC.Career.team(mineAway ? f.away : f.home);
    const away = CC.Career.team(mineAway ? f.home : f.away);
    return CC.Match.create({
      home, away, format: COMPS[f.comp].format,
      humanSide: humanId ? 0 : 2, seed,
    });
  }

  // Turn a finished match into the result stored on the fixture.
  function resultOf(m, f) {
    const r = m.result;
    const res = {
      winner: r.winner === null ? null : m.teams[r.winner].id,
      by: r.by, margin: r.margin, text: r.text,
      innings: m.innings.map(i => ({
        side: m.teams[i.battingSide].id, runs: i.runs, wkts: i.wkts, balls: i.balls,
        declared: i.declared, at110: i.at110,
      })),
    };
    // Knockouts need a winner: a tie goes to the side that lost fewer wickets,
    // then to a bowl-out (decided at random).
    if (f.group === null && res.winner === null) {
      const [a, b] = m.innings;
      const pick = a.wkts !== b.wkts ? (a.wkts < b.wkts ? a : b).battingSide : (m.totalBalls + a.runs) % 2;
      res.winner = m.teams[pick].id;
      res.text = 'TIED. ' + m.teams[pick].name + ' WIN ON ' + (a.wkts !== b.wkts ? 'FEWER WICKETS LOST' : 'A BOWL-OUT');
    }
    return res;
  }

  // Simulate one fixture between computer sides.
  function simFixture(season, f, seed) {
    const m = makeMatch(season, f, null, seed);
    m.doToss();
    m.chooseToss();
    m.simulate();
    f.result = resultOf(m, f);
    return m;
  }

  // Finish the next event: record the player's match (if given) and simulate
  // the rest. `myMatch` is a finished CC.Match for the player's fixture.
  function playEvent(season, countyId, myMatch, baseSeed) {
    const ev = nextEvent(season);
    if (!ev) return null;
    const mine = myFixture(ev, countyId);
    ev.fixtures.forEach(f => {
      if (f.result) return;
      if (f === mine && myMatch) f.result = resultOf(myMatch, f);
      else simFixture(season, f, (baseSeed || 0) + ++season.matchCount);
    });
    ev.done = true;
    season.next++;
    return ev;
  }

  function isOver(season) { return season.next >= season.events.length; }

  // Who won what, once the season is over.
  function summary(season) {
    const d1 = table(season, 'CC', 1), d2 = table(season, 'CC', 2);
    const finalWinner = comp => winnerOf(findEvent(season, comp, 'F').fixtures[0]);
    return {
      champions: d1[0].id,
      promoted: d2.slice(0, PROMOTED).map(r => r.id),
      relegated: d1.slice(-PROMOTED).map(r => r.id),
      t20: finalWinner('T20'),
      od: finalWinner('OD'),
    };
  }

  // Divisions for next season after promotion and relegation.
  function nextDivisions(season) {
    const s = summary(season);
    return {
      1: season.divisions[1].filter(id => s.relegated.indexOf(id) < 0).concat(s.promoted),
      2: season.divisions[2].filter(id => s.promoted.indexOf(id) < 0).concat(s.relegated),
    };
  }

  // Where a county finished (or stands) in each competition, for the office screen.
  function standing(season, countyId) {
    const c = CC.counties.find(x => x.id === countyId);
    const div = season.divisions[1].indexOf(countyId) >= 0 ? 1 : 2;
    const pos = (comp, group) => table(season, comp, group).findIndex(r => r.id === countyId) + 1;
    return { div, cc: pos('CC', div), t20: pos('T20', c.group), od: pos('OD', c.group) };
  }

  CC.Season = {
    COMPS, POINTS, BAT_BONUS, BOWL_BONUS, PROMOTED,
    create, dateText, table, nextEvent, myFixture, makeMatch, resultOf, playEvent, isOver,
    summary, nextDivisions, standing, bonus, roundRobin,
  };
})(typeof window !== 'undefined' ? window : globalThis);
