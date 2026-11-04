// Entry point: set up the match-up, load the art, then show the title screen.
CC.game = {
  home: CC.teams[0],   // The player's team.
  away: CC.teams[1],   // The computer's team.
};

CC.sprites.load(() => CC.engine.start('title'));
