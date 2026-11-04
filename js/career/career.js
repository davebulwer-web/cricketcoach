// The saved career: every county's squad plus which county you manage.
// Kept in localStorage so the game carries on where you left off.
(function (root) {
  const CC = root.CC = root.CC || {};
  const KEY = 'cricketcoach.career';
  const VERSION = 1;
  const FIRST_SEASON = 2027;

  function county(id) { return CC.counties.find(c => c.id === id); }

  // Generate a fresh world: all 18 counties with invented squads. Nothing is
  // saved until you pick a county with takeCharge().
  function create(seed) {
    if (seed === undefined) seed = Math.floor(Math.random() * 1e9);
    const rng = CC.Match.makeRng(seed);
    let next = 1;
    const nextId = () => next++;
    const clubs = {};
    CC.counties.forEach(c => {
      const players = CC.Squads.generateSquad(c, rng, nextId);
      const wages = players.reduce((a, p) => a + p.wage, 0);
      // A little headroom over the current wage bill, for signings later.
      clubs[c.id] = { id: c.id, players, budget: Math.ceil(wages * 1.08 / 10) * 10 };
    });
    return { version: VERSION, seed, season: FIRST_SEASON, countyId: null, clubs, nextPlayerId: next };
  }

  const Career = {
    state: null,

    county,
    begin(seed) { this.state = create(seed); return this.state; },
    takeCharge(countyId) { this.state.countyId = countyId; this.save(); },

    club(id) { return this.state.clubs[id || this.state.countyId]; },
    myCounty() { return county(this.state.countyId); },
    wageBill(id) { return this.club(id).players.reduce((a, p) => a + p.wage, 0); },
    overseasCount(id) { return this.club(id).players.filter(p => p.overseas).length; },

    // The side a county puts out for a match, in the shape the match engine expects.
    team(id) {
      const c = county(id);
      return { id, name: c.name, short: c.short, colour: c.colour, players: CC.Squads.pickXI(this.club(id).players) };
    },

    hasSave() {
      try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); return true; } catch (e) { return false; }
    },
    load() {
      try {
        const s = JSON.parse(localStorage.getItem(KEY));
        if (!s || s.version !== VERSION || !s.countyId) return false;
        this.state = s;
        return true;
      } catch (e) { return false; }
    },
  };

  // Two random counties with freshly generated squads, for a one-off match.
  function quickMatchTeams(seed) {
    const world = create(seed);
    const ids = CC.counties.map(c => c.id);
    const a = ids.splice(Math.floor(Math.random() * ids.length), 1)[0];
    const b = ids[Math.floor(Math.random() * ids.length)];
    const team = id => {
      const c = county(id);
      return { id, name: c.name, short: c.short, colour: c.colour, players: CC.Squads.pickXI(world.clubs[id].players) };
    };
    return [team(a), team(b)];
  }

  Career.quickMatchTeams = quickMatchTeams;
  CC.Career = Career;
})(typeof window !== 'undefined' ? window : globalThis);
