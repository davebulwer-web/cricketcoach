// Generates invented county squads and picks a playing XI from a squad.
// Pure logic with no drawing, so tests can run it in Node.
(function (root) {
  const CC = root.CC = root.CC || {};

  // Simplified versions of the real county registration rules.
  // Step 4 (squad management) builds on these.
  const RULES = {
    squadMax: 24,          // registered players per county
    squadMin: 16,          // you can't release players below this
    maxOverseasXI: 2,      // overseas players allowed in a playing XI
    maxOverseasSquad: 3,   // overseas players a county may have registered at once
  };

  // Shape of a generated squad (22 players).
  const TEMPLATE = [
    ['BAT', null], ['BAT', null], ['BAT', null], ['BAT', null], ['BAT', null], ['BAT', null],
    ['WK', null], ['WK', null],
    ['ALL', 'MED'], ['ALL', 'PACE'], ['ALL', 'SPIN'], ['ALL', 'MED'],
    ['BOWL', 'PACE'], ['BOWL', 'PACE'], ['BOWL', 'PACE'], ['BOWL', 'PACE'], ['BOWL', 'PACE'],
    ['BOWL', 'MED'], ['BOWL', 'MED'],
    ['BOWL', 'SPIN'], ['BOWL', 'SPIN'], ['BOWL', 'SPIN'],
  ];
  const ROLE_ORDER = { BAT: 0, WK: 1, ALL: 2, BOWL: 3 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))); }
  function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
  function gauss(rng) { return (rng() + rng() + rng() + rng() - 2) * 1.7; } // roughly mean 0, sd 1
  function choose(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  // Wage in thousands of pounds a year, from the player's best skill.
  function wageFor(p) {
    const best = Math.max(p.bat, p.bowl);
    return Math.max(12, Math.round(12 + Math.max(0, best - 45) * 1.6 + (p.overseas ? 30 : 0)));
  }

  function ageAdjust(age) {
    if (age < 21) return -7;
    if (age < 24) return -3;
    if (age > 34) return -3;
    return 0;
  }

  // Make one player. `used` stops a squad having two players with the same name.
  // opts: { id, role, style, strength, nation (overseas only), age (optional) }
  function makePlayer(rng, opts, used) {
    const overseas = !!opts.nation;
    const pool = overseas ? CC.names.overseas[opts.nation] : CC.names.home;
    let name;
    do {
      name = choose(rng, CC.names.initials.split('')) + '. ' + choose(rng, pool);
    } while (used[name]);
    used[name] = true;

    const age = opts.age || (overseas ? randInt(rng, 24, 33) : randInt(rng, 18, 36));
    const level = 56 + opts.strength * 0.9 + gauss(rng) * 7 + ageAdjust(age) + (overseas ? 11 : 0);
    const p = {
      id: opts.id, name, age, role: opts.role, style: opts.style,
      bat: 0, bowl: 0,
      overseas, nation: opts.nation || 'ENG',
      contract: randInt(rng, 1, 3),   // seasons left on the contract
      wage: 0,
      potential: 0,
    };
    switch (opts.role) {
      case 'BAT':
        p.bat = level + 9;
        p.bowl = randInt(rng, 5, 25);
        if (rng() < 0.35) { p.style = rng() < 0.5 ? 'MED' : 'SPIN'; p.bowl = randInt(rng, 25, 42); }
        break;
      case 'WK':
        p.bat = level + 1;
        p.bowl = randInt(rng, 2, 8);
        break;
      case 'ALL':
        p.bat = level - 2;
        p.bowl = level;
        break;
      default:
        p.bat = randInt(rng, 10, 36);
        p.bowl = level + 9;
    }
    p.bat = clamp(p.bat, 1, 95);
    p.bowl = clamp(p.bowl, 1, 95);
    // Young players still have room to improve (used by season-end development).
    const best = Math.max(p.bat, p.bowl);
    p.potential = clamp(age < 24 ? best + randInt(rng, 4, 16) : age < 29 ? best + randInt(rng, 0, 5) : best, 1, 97);
    p.wage = wageFor(p);
    return p;
  }

  // Build a whole squad for a county. `nextId` is a function returning unique ids.
  function generateSquad(county, rng, nextId) {
    const strength = county.strength || 0;
    // Stronger counties tend to afford two overseas players, weaker ones one.
    const overseasCount = rng() < 0.45 + strength * 0.08 ? 2 : 1;
    const nations = Object.keys(CC.names.overseas);
    // Overseas players take a batting slot and/or a bowling slot.
    const overseasSlots = overseasCount === 2 ? [0, choose(rng, [12, 19])] : [choose(rng, [0, 12, 19])];
    const used = {};
    const players = TEMPLATE.map(([role, style], i) => makePlayer(rng, {
      id: nextId(), role, style, strength,
      nation: overseasSlots.indexOf(i) >= 0 ? choose(rng, nations) : null,
    }, used));
    return sortSquad(players);
  }

  function sortSquad(players) {
    return players.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      Math.max(b.bat, b.bowl) - Math.max(a.bat, a.bowl));
  }

  // Pick the strongest XI the rules allow: 5 specialist batters, a keeper,
  // 2 all-rounders and 3 bowlers (so 5 bowling options), at most
  // RULES.maxOverseasXI overseas players. Returned in batting order.
  function pickXI(squad) {
    const chosen = [];
    let overseas = 0;
    const ok = p => chosen.indexOf(p) < 0 && (!p.overseas || overseas < RULES.maxOverseasXI);
    const take = p => { chosen.push(p); if (p.overseas) overseas++; };
    const best = (filter, score, n) => {
      for (let k = 0; k < n; k++) {
        const pool = squad.filter(p => ok(p) && filter(p)).sort((a, b) => score(b) - score(a));
        if (pool.length) take(pool[0]);
      }
    };
    const bat = p => p.bat, bowl = p => p.bowl, both = p => p.bat + p.bowl;
    best(p => p.role === 'WK', bat, 1);
    best(p => p.role === 'BAT', bat, 5);
    best(p => p.role === 'ALL', both, 2);
    best(p => p.role === 'BOWL', bowl, 3);
    // Fill any gaps (e.g. a thin squad) with the best remaining players.
    best(() => true, p => Math.max(p.bat, p.bowl), 11 - chosen.length);

    return battingOrder(chosen);
  }

  // Batting order: specialists by batting, then keeper and all-rounders, then bowlers.
  function battingOrder(players) {
    const order = { BAT: 0, WK: 1, ALL: 1, BOWL: 2 };
    return players.slice().sort((a, b) => order[a.role] - order[b.role] || b.bat - a.bat);
  }

  // A random role and bowling style, in roughly the mix of a real squad.
  function randomRole(rng) {
    return choose(rng, TEMPLATE);
  }

  CC.Squads = { RULES, TEMPLATE, generateSquad, makePlayer, pickXI, battingOrder, sortSquad, wageFor, randomRole, randInt, choose, clamp };
})(typeof window !== 'undefined' ? window : globalThis);
