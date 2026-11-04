// Entry point: shared game state, then load the art and show the title screen.
CC.game = {
  mode: null,    // 'career' or 'quick'
  home: null,    // the player's side for the current match
  away: null,    // the computer's side
  match: null,

  // A one-off match between two random counties.
  quickMatch() {
    const [home, away] = CC.Career.quickMatchTeams();
    Object.assign(this, { mode: 'quick', home, away });
    CC.engine.go('teamsheet');
  },

  // A friendly for your county against a random other county.
  friendly() {
    const mine = CC.Career.state.countyId;
    const others = CC.counties.filter(c => c.id !== mine);
    const opp = others[Math.floor(Math.random() * others.length)];
    Object.assign(this, { mode: 'career', home: CC.Career.team(mine), away: CC.Career.team(opp.id) });
    CC.engine.go('teamsheet');
  },

  // Where to go when a match is finished or abandoned.
  afterMatch() { if (this.mode === 'career') CC.engine.go('office'); else this.quickMatch(); },
  exit() { CC.engine.go(this.mode === 'career' ? 'office' : 'title'); },
};

CC.sprites.load(() => CC.engine.start('title'));
