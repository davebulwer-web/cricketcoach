// Entry point: shared game state, then load the art and show the title screen.
CC.game = {
  mode: null,    // 'career' or 'quick'
  home: null,    // the player's side for the current match
  away: null,    // the computer's side
  format: 'T20', // 'T20', 'OD50' or 'FC' (see CC.Match.FORMATS)
  match: null,
  fixture: null, // the competition fixture being played, if any

  // A one-off match between two random counties.
  quickMatch(format) {
    const [home, away] = CC.Career.quickMatchTeams();
    Object.assign(this, { mode: 'quick', home, away, format: format || this.format });
    CC.engine.go('teamsheet');
  },

  // Play your county's next competition match.
  playFixture() {
    const f = CC.Career.myFixture();
    if (!f) return;
    const mine = CC.Career.state.countyId;
    const opp = f.home === mine ? f.away : f.home;
    Object.assign(this, {
      mode: 'career', fixture: f, match: null,
      home: CC.Career.team(mine), away: CC.Career.team(opp),
      format: CC.Season.COMPS[f.comp].format,
    });
    CC.engine.go('teamsheet');
  },

  // Simulate your next match (or a round you're not playing in), then show the results.
  simFixture() {
    const ev = CC.Career.playNext(null);
    CC.engine.go('results', { event: ev });
  },

  // Where to go when a match is finished or abandoned.
  afterMatch() {
    if (this.fixture && this.match && this.match.result) {
      const ev = CC.Career.playNext(this.match);
      this.fixture = null;
      CC.engine.go('results', { event: ev });
    } else if (this.mode === 'career') CC.engine.go('office');
    else CC.engine.go('format');
  },
  // Quitting a competition match: the computer plays out the rest of it.
  exit() {
    if (this.fixture && this.match) {
      if (!this.match.result) this.match.simulate(null, { declare: true });
      this.afterMatch();
      return;
    }
    this.fixture = null;
    CC.engine.go(this.mode === 'career' ? 'office' : 'title');
  },
};

CC.sprites.load(() => CC.engine.start('title'));
