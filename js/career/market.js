// Squad management rules: choosing your XI, signing and releasing players,
// contracts, transfer windows, and the close season (ageing, development,
// retirements, contracts ending, youth players and computer clubs signing).
// Pure logic with no drawing; the functions take the career state.
(function (root) {
  const CC = root.CC = root.CC || {};
  const S = () => CC.Squads;

  // Transfer windows, as days of the year (1 Jan = 1). Pre-season counts as open.
  const WINDOWS = [
    { from: 0, to: 151, text: 'PRE-SEASON TO 31 MAY' },
    { from: 182, to: 212, text: '1 JUL TO 31 JUL' },
  ];
  const FREE_AGENTS = 30;        // size of the pool kept topped up each close season
  const OVERSEAS_FREE_AGENTS = 10;
  const MAX_FREE_AGENTS = 45;

  function nextId(state) { return state.nextPlayerId++; }
  function rngFor(state, salt) { return CC.Match.makeRng((state.seed + state.season * 7919 + salt) >>> 0); }

  // --- Free agents --------------------------------------------------------

  // A player looking for a county. Their wage is what they ask for.
  function newFreeAgent(state, rng, overseas) {
    const [role, style] = S().randomRole(rng);
    const nations = Object.keys(CC.names.overseas);
    const p = S().makePlayer(rng, {
      id: nextId(state), role, style, strength: S().randInt(rng, -4, 2),
      nation: overseas ? S().choose(rng, nations) : null,
    }, {});
    p.contract = S().randInt(rng, 1, 3);
    return p;
  }

  function topUpFreeAgents(state, rng) {
    const pool = state.freeAgents;
    while (pool.filter(p => p.overseas).length < OVERSEAS_FREE_AGENTS) pool.push(newFreeAgent(state, rng, true));
    while (pool.length < FREE_AGENTS) pool.push(newFreeAgent(state, rng, false));
    S().sortSquad(pool);
  }

  // --- Windows ------------------------------------------------------------

  function windowState(state) {
    const ev = CC.Season.nextEvent(state.schedule);
    const day = ev ? ev.day : 400;   // season over: the close season counts as pre-season
    if (!ev) return { open: true, text: 'OPEN UNTIL THE SEASON STARTS' };
    const w = WINDOWS.find(x => day >= x.from && day <= x.to);
    if (w) return { open: true, text: 'OPEN ' + w.text };
    const next = WINDOWS.find(x => x.from > day);
    return { open: false, text: next ? 'CLOSED, REOPENS ' + CC.Season.dateText(next.from) : 'CLOSED UNTIL THE CLOSE SEASON' };
  }

  // --- Your county --------------------------------------------------------

  function club(state) { return state.clubs[state.countyId]; }
  function wageBill(c) { return c.players.reduce((a, p) => a + p.wage, 0) + (c.deadWages || 0); }

  // Why a player can't be signed, or null if they can.
  function signProblem(state, p) {
    const c = club(state), R = S().RULES;
    if (!windowState(state).open) return 'THE TRANSFER WINDOW IS CLOSED';
    if (c.players.length >= R.squadMax) return 'SQUAD IS FULL (' + R.squadMax + ' PLAYERS)';
    if (p.overseas && c.players.filter(x => x.overseas).length >= R.maxOverseasSquad) return 'ONLY ' + R.maxOverseasSquad + ' OVERSEAS PLAYERS ALLOWED';
    if (wageBill(c) + p.wage > c.budget) return 'NOT ENOUGH WAGE BUDGET';
    return null;
  }

  function sign(state, pid) {
    const i = state.freeAgents.findIndex(p => p.id === pid);
    if (i < 0) return 'PLAYER NOT FOUND';
    const p = state.freeAgents[i];
    const problem = signProblem(state, p);
    if (problem) return problem;
    state.freeAgents.splice(i, 1);
    club(state).players.push(p);
    S().sortSquad(club(state).players);
    return null;
  }

  // Release a player. Their wage still counts until the end of the season.
  function release(state, pid) {
    const c = club(state);
    if (c.players.length <= S().RULES.squadMin) return 'SQUAD CAN\'T GO BELOW ' + S().RULES.squadMin;
    const i = c.players.findIndex(p => p.id === pid);
    if (i < 0) return 'PLAYER NOT FOUND';
    const p = c.players.splice(i, 1)[0];
    c.deadWages = (c.deadWages || 0) + p.wage;
    if (c.selection) c.selection = c.selection.filter(id => id !== pid);
    p.contract = S().randInt(rngFor(state, pid), 1, 2);
    state.freeAgents.push(p);
    return null;
  }

  // Offer a player in the last year of his contract a new deal.
  function renewTerms(p) {
    return { years: p.age >= 33 ? 1 : 2, wage: Math.max(p.wage, Math.round(S().wageFor(p) * (p.age < 30 ? 1.1 : 1))) };
  }
  function renewProblem(state, p) {
    if (p.contract > 1) return 'CONTRACT HAS ' + p.contract + ' SEASONS LEFT';
    const t = renewTerms(p), c = club(state);
    if (wageBill(c) - p.wage + t.wage > c.budget) return 'NOT ENOUGH WAGE BUDGET';
    return null;
  }
  function renew(state, pid) {
    const p = club(state).players.find(x => x.id === pid);
    if (!p) return 'PLAYER NOT FOUND';
    const problem = renewProblem(state, p);
    if (problem) return problem;
    const t = renewTerms(p);
    p.contract = t.years + 1;   // +1: this season still counts
    p.wage = t.wage;
    return null;
  }

  // --- Choosing the XI ----------------------------------------------------

  // Your chosen XI (players), or null if it isn't a valid XI (auto-pick is used then).
  function chosenXI(state) {
    const c = club(state);
    if (!c.selection || c.selection.length !== 11) return null;
    const xi = c.selection.map(id => c.players.find(p => p.id === id));
    if (xi.some(p => !p)) return null;
    if (xi.filter(p => p.overseas).length > S().RULES.maxOverseasXI) return null;
    return S().battingOrder(xi);
  }

  function currentXI(state) { return chosenXI(state) || S().pickXI(club(state).players); }

  // Put a player in or out of the XI. Starts from the current XI.
  function toggleXI(state, pid) {
    const c = club(state);
    if (!c.selection) c.selection = currentXI(state).map(p => p.id);
    const i = c.selection.indexOf(pid);
    if (i >= 0) { c.selection.splice(i, 1); return null; }
    if (c.selection.length >= 11) return 'XI IS FULL: LEAVE SOMEONE OUT FIRST';
    const p = c.players.find(x => x.id === pid);
    const os = c.selection.filter(id => c.players.find(x => x.id === id).overseas).length;
    if (p.overseas && os >= S().RULES.maxOverseasXI) return 'ONLY ' + S().RULES.maxOverseasXI + ' OVERSEAS PLAYERS IN AN XI';
    c.selection.push(pid);
    return null;
  }

  // Warnings about a chosen XI (it can still be used).
  function xiWarnings(state) {
    const c = club(state);
    if (!c.selection) return [];
    if (c.selection.length !== 11) return ['XI HAS ' + c.selection.length + ' PLAYERS: AUTO-PICK WILL BE USED'];
    const xi = chosenXI(state);
    if (!xi) return ['XI IS NOT VALID: AUTO-PICK WILL BE USED'];
    const w = [];
    if (!xi.some(p => p.role === 'WK')) w.push('NO WICKET-KEEPER');
    if (xi.filter(p => p.style).length < 5) w.push('FEWER THAN FIVE BOWLERS');
    return w;
  }

  // --- Close season -------------------------------------------------------

  // Ratings change with age: young players grow towards their potential,
  // players in their thirties slowly decline.
  function develop(p, rng) {
    const R = S();
    const skillKeys = p.role === 'BOWL' ? ['bowl'] : p.role === 'ALL' ? ['bat', 'bowl'] : ['bat'];
    skillKeys.forEach(k => {
      let d;
      if (p.age <= 23) d = R.randInt(rng, 0, 4);
      else if (p.age <= 28) d = R.randInt(rng, -1, 2);
      else if (p.age <= 31) d = R.randInt(rng, -2, 1);
      else if (p.age <= 34) d = R.randInt(rng, -3, 0);
      else d = R.randInt(rng, -5, -1);
      if (d > 0) d = Math.min(d, Math.max(0, p.potential - p[k]));
      p[k] = R.clamp(p[k] + d, 1, 95);
    });
    p.age += 1;
  }

  function retires(p, rng) {
    if (p.age >= 38) return true;
    if (p.age >= 35) return rng() < 0.25 + (p.age - 35) * 0.2;
    return false;
  }

  function youthPlayer(state, rng, strength) {
    const [role, style] = S().randomRole(rng);
    const p = S().makePlayer(rng, { id: nextId(state), role, style, strength: strength - 2, age: S().randInt(rng, 18, 19) }, {});
    p.potential = S().clamp(Math.max(p.bat, p.bowl) + S().randInt(rng, 10, 25), 1, 95);
    p.contract = 3;
    p.wage = 12;
    return p;
  }

  // Run the close season for every county. Returns what happened at your county.
  function closeSeason(state) {
    const rng = rngFor(state, 1);
    const R = S().RULES;
    const news = { retired: [], left: [], youth: [], kept: [] };
    const mine = state.countyId;

    // Free agents age too; old ones retire. Season figures start again.
    state.freeAgents.forEach(p => { develop(p, rng); p.stats = {}; });
    state.freeAgents = state.freeAgents.filter(p => !retires(p, rng));

    CC.counties.forEach(county => {
      const c = state.clubs[county.id];
      const isMine = county.id === mine;
      const stay = [], expiring = [];
      c.players.forEach(p => {
        develop(p, rng);
        p.stats = {};
        if (retires(p, rng)) { if (isMine) news.retired.push(p.name); return; }
        p.contract -= 1;
        if (p.contract <= 0) expiring.push(p); else stay.push(p);
      });
      // Computer clubs keep useful players; yours leave unless you renewed them,
      // except that the squad never drops below the minimum (best players kept).
      expiring.sort((a, b) => Math.max(b.bat, b.bowl) - Math.max(a.bat, a.bowl));
      expiring.forEach(p => {
        const keep = isMine ? stay.length < R.squadMin
          : p.age <= 33 && Math.max(p.bat, p.bowl) >= 55 && rng() < 0.85;
        p.wage = S().wageFor(p);
        if (keep) {
          p.contract = p.age >= 32 ? 1 : S().randInt(rng, 2, 3);
          if (isMine) { p.contract = 1; news.kept.push(p.name); }
          stay.push(p);
        } else {
          if (isMine) news.left.push(p.name);
          p.contract = S().randInt(rng, 1, 2);
          state.freeAgents.push(p);
        }
      });
      c.players = stay;
      c.deadWages = 0;
      if (c.selection) c.selection = c.selection.filter(id => stay.some(p => p.id === id));

      // Two academy players come through if there's room.
      for (let k = 0; k < 2 && c.players.length < R.squadMax; k++) {
        const y = youthPlayer(state, rng, county.strength);
        c.players.push(y);
        if (isMine) news.youth.push(y.name);
      }
    });

    topUpFreeAgents(state, rng);

    // Computer clubs sign the best free agents they can afford to fill their squads.
    CC.counties.forEach(county => {
      if (county.id === mine) return;
      const c = state.clubs[county.id];
      while (c.players.length < 21) {
        const os = c.players.filter(p => p.overseas).length;
        const options = state.freeAgents
          .filter(p => (!p.overseas || os < 2) && wageBill(c) + p.wage <= c.budget)
          .sort((a, b) => Math.max(b.bat, b.bowl) - Math.max(a.bat, a.bowl));
        if (!options.length) break;
        const p = options[Math.floor(rng() * Math.min(3, options.length))];
        state.freeAgents.splice(state.freeAgents.indexOf(p), 1);
        c.players.push(p);
      }
      // Wages must fit the budget; it grows a little if the squad needs it.
      c.budget = Math.max(c.budget, Math.ceil(wageBill(c) / 10) * 10);
      S().sortSquad(c.players);
    });
    S().sortSquad(club(state).players);
    // Unwanted older free agents drift out of the game.
    state.freeAgents.sort((a, b) => a.age - b.age);
    state.freeAgents.length = Math.min(state.freeAgents.length, MAX_FREE_AGENTS);
    topUpFreeAgents(state, rng);
    return news;
  }

  CC.Market = {
    WINDOWS, windowState, wageBill, topUpFreeAgents,
    signProblem, sign, release, renewTerms, renewProblem, renew,
    chosenXI, currentXI, toggleXI, xiWarnings, closeSeason, develop,
  };
})(typeof window !== 'undefined' ? window : globalThis);
