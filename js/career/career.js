// The saved career: every county's squad, which county you manage, the
// championship divisions and the current season's fixtures and results.
// Kept in localStorage so the game carries on where you left off.
(function (root) {
  const CC = root.CC = root.CC || {};
  const KEY = 'cricketcoach.career';
  const VERSION = 3;
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
      // Some headroom over the current wage bill, for signings.
      clubs[c.id] = { id: c.id, players, budget: Math.ceil(wages * 1.15 / 10) * 10, selection: null, deadWages: 0 };
    });
    const divisions = {
      1: CC.counties.filter(c => c.div === 1).map(c => c.id),
      2: CC.counties.filter(c => c.div === 2).map(c => c.id),
    };
    const state = {
      version: VERSION, seed, season: FIRST_SEASON, countyId: null, clubs, nextPlayerId: next,
      schedule: CC.Season.create(FIRST_SEASON, divisions),
      history: [],     // one entry per finished season
      inbox: [],       // news items: { date, text, read }
      freeAgents: [],  // players without a county, who can be signed
      news: null,      // what happened at your county in the last close season
    };
    CC.Market.topUpFreeAgents(state, rng);
    return state;
  }

  const Career = {
    state: null,

    county,
    begin(seed) { this.state = create(seed); return this.state; },
    takeCharge(countyId) { this.state.countyId = countyId; this.save(); },

    club(id) { return this.state.clubs[id || this.state.countyId]; },
    division(id) { return this.state.schedule.divisions[1].indexOf(id || this.state.countyId) >= 0 ? 1 : 2; },

    // --- The season ---------------------------------------------------------
    nextEvent() { return CC.Season.nextEvent(this.state.schedule); },
    myFixture() { return CC.Season.myFixture(this.nextEvent(), this.state.countyId); },
    seasonOver() { return CC.Season.isOver(this.state.schedule); },

    // Play the next event: `myMatch` is your finished match, or null to simulate it.
    playNext(myMatch) {
      const windowBefore = this.transferWindow().open;
      const ev = CC.Season.playEvent(this.state.schedule, this.state.countyId, myMatch, this.state.seed);
      if (ev) this.eventNews(ev, windowBefore);
      this.save();
      return ev;
    },

    // --- News -----------------------------------------------------------------
    addNews(text, date) {
      const inbox = this.state.inbox = this.state.inbox || [];
      inbox.unshift({ date: date || '', text, read: false });
      if (inbox.length > 80) inbox.length = 80;
    },
    unreadNews() { return (this.state.inbox || []).filter(n => !n.read).length; },

    eventNews(ev, windowBefore) {
      const mine = this.state.countyId, sched = this.state.schedule;
      const comp = CC.Season.COMPS[ev.comp];
      const name = id => county(id).name;
      const add = t => this.addNews(t, ev.date);
      const f = CC.Season.myFixture(ev, mine);
      if (f) {
        const r = f.result, opp = name(f.home === mine ? f.away : f.home);
        let t;
        if (r.by === 'draw') t = 'DREW WITH ' + opp;
        else if (r.winner === null) t = 'TIED WITH ' + opp;
        else if (r.winner === mine) t = 'BEAT ' + opp + r.text.replace(/^.* WON/, '');
        else t = 'LOST TO ' + opp + r.text.replace(/^.* WON/, '');
        add(comp.short + ': ' + t);
        if (ev.stage === 'F') add(r.winner === mine ? 'CHAMPIONS! ' + county(mine).name + ' WIN THE ' + comp.name : 'BEATEN IN THE ' + comp.name + ' FINAL');
        else if (ev.stage === 'QF' || ev.stage === 'SF') add(r.winner === mine ? 'THROUGH TO THE NEXT ROUND OF THE ' + comp.name : 'KNOCKED OUT OF THE ' + comp.name);
      }
      (ev.feats || []).filter(x => x.team === mine).forEach(x => add(x.name + ': ' + x.text));
      // End of a group stage: did we qualify?
      if (ev.stage === 'group' && !sched.events.some(e => e.comp === ev.comp && e.stage === 'group' && !e.done)) {
        const group = county(mine).group;
        const pos = CC.Season.table(sched, ev.comp, group).findIndex(r => r.id === mine) + 1;
        const places = ev.comp === 'T20' ? 4 : 2;
        const round = ev.comp === 'T20' ? 'QUARTER-FINALS' : 'SEMI-FINALS';
        add(pos <= places ? 'QUALIFIED FOR THE ' + comp.short + ' ' + round + ' IN ' + CC.ordinal(pos) + ' PLACE'
          : 'OUT OF THE ' + comp.short + ': FINISHED ' + CC.ordinal(pos) + ' IN THE GROUP');
      }
      const windowNow = this.transferWindow();
      if (windowNow.open !== windowBefore) {
        add('TRANSFER WINDOW ' + (windowNow.open ? 'NOW OPEN' : 'NOW CLOSED'));
        const ending = this.club().players.filter(p => p.contract === 1).length;
        if (windowNow.open && ending) add(ending + ' OF YOUR PLAYERS ARE IN THE LAST YEAR OF THEIR CONTRACTS');
      }
      if (this.seasonOver()) {
        const s = CC.Season.summary(sched);
        add('SEASON OVER. ' + county(s.champions).name + ' ARE COUNTY CHAMPIONS');
      }
    },

    // Record the season, apply promotion and relegation, and set up the next one.
    startNextSeason() {
      const sched = this.state.schedule;
      this.state.history.push({
        year: sched.year,
        summary: CC.Season.summary(sched),
        mine: CC.Season.standing(sched, this.state.countyId),
      });
      const top = comp => {
        const l = CC.Season.leaders(this.state.clubs, comp, 1);
        const pick = (x, k) => x ? { name: x.p.name, county: x.id, value: x.s[k] } : null;
        return { runs: pick(l.runs[0], 'runs'), wkts: pick(l.wkts[0], 'wkts') };
      };
      this.state.history[this.state.history.length - 1].leaders = { CC: top('CC'), T20: top('T20'), OD: top('OD') };
      this.state.season += 1;
      this.state.news = CC.Market.closeSeason(this.state);
      this.addNews('WELCOME TO THE ' + this.state.season + ' SEASON. THE TRANSFER WINDOW IS OPEN', '');
      this.state.schedule = CC.Season.create(this.state.season, CC.Season.nextDivisions(sched));
      this.save();
    },

    // --- Squad management (rules in js/career/market.js) --------------------
    transferWindow() { return CC.Market.windowState(this.state); },
    sign(pid) { const e = CC.Market.sign(this.state, pid); if (!e) this.save(); return e; },
    release(pid) { const e = CC.Market.release(this.state, pid); if (!e) this.save(); return e; },
    renew(pid) { const e = CC.Market.renew(this.state, pid); if (!e) this.save(); return e; },
    toggleXI(pid) { const e = CC.Market.toggleXI(this.state, pid); this.save(); return e; },
    autoXI() { this.club().selection = null; this.save(); },
    currentXI() { return CC.Market.currentXI(this.state); },
    myCounty() { return county(this.state.countyId); },
    wageBill(id) { return CC.Market.wageBill(this.club(id)); },
    overseasCount(id) { return this.club(id).players.filter(p => p.overseas).length; },

    // The side a county puts out for a match, in the shape the match engine expects.
    team(id) {
      const c = county(id);
      const players = id === this.state.countyId ? this.currentXI() : CC.Squads.pickXI(this.club(id).players);
      return { id, name: c.name, short: c.short, colour: c.colour, players };
    },

    hasSave() { return this.saveStatus() === 'ok'; },
    // 'none', 'ok', or 'old' (saved by an earlier version that can't be loaded).
    saveStatus() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return 'none';
        const s = JSON.parse(raw);
        return s && s.version === VERSION && s.countyId ? 'ok' : 'old';
      } catch (e) { return 'none'; }
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); return true; } catch (e) { return false; }
    },
    load() {
      try {
        const s = JSON.parse(localStorage.getItem(KEY));
        if (!s || s.version !== VERSION || !s.countyId) return false;
        s.inbox = s.inbox || [];
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
