// Entry point: set up the match-up and show the title screen.
CC.game = {
  home: CC.teams[0],   // The player's team.
  away: CC.teams[1],   // The computer's team.
};

CC.engine.start('title');
