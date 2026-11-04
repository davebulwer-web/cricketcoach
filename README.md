# Cricket Coach

A browser-based, pixel-art cricket captaincy game inspired by the classic 16-bit cricket management games of the late 1980s.

"Cricket Coach" is a working title.

## Playing

Open `index.html` in any modern browser. There is no build step and nothing to install.
Keyboard: Enter to continue, Escape to go back. Mouse and touch work on every button.

In a match you captain Ashby Vale against the computer:

- **Toss:** if you win it, choose to bat or bowl.
- **Bowling:** pick a bowler before each over (keys 1-9, or C for the computer's pick). Each bowler can bowl at most 4 overs, and never two in a row. Press F to switch the field between Attack, Normal and Defend.
- **Batting:** press F to switch your batters between Attack, Normal and Defend. Attacking scores faster but loses more wickets.
- **Space** bowls the next ball, **A** turns auto-play on and off, and **S** shows the scorecard.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | Page that loads the scripts in order |
| `js/config.js` | Title, resolution and match settings (20 overs a side by default) |
| `js/engine.js` | Canvas scaling, main loop, input and the screen manager |
| `js/ui.js`, `js/font.js`, `js/palette.js` | Buttons and panels, built-in 5x7 pixel font, colour palette |
| `js/data/teams.js` | The two invented teams and their player ratings |
| `js/match/engine.js` | Ball-by-ball match simulation and the computer captain (no drawing) |
| `tests/sim.test.js` | Simulates thousands of matches and checks the scoring adds up |
| `js/screens/` | Title, team sheet, match and scorecard screens |
| `js/sprites.js` | Loads the art and draws sprites, tinting team colours |
| `assets/` | Replaceable placeholder art. See `assets/README.md` for sizes and layouts |
| `tools/make-placeholder-art.js` | Regenerates the placeholder PNGs |

## Roadmap

1. Repo and game skeleton (done)
2. Ball-by-ball match engine with captain choices: bowler, field setting, batting aggression (done)
3. Match screens and replaceable placeholder sprite sheets (done)
4. Play-test, tune scoring and publish on GitHub Pages

## Tests

Run `node tests/sim.test.js` (Node 18 or later). It plays 2000 computer-vs-computer
matches and checks that runs, wickets, balls and bowling figures all add up, and
prints average scores so the balance can be tuned.
