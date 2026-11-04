# Cricket Coach

A browser-based, pixel-art cricket captaincy game inspired by the classic 16-bit cricket management games of the late 1980s.

"Cricket Coach" is a working title.

## Playing

Play online at https://davebulwer-web.github.io/cricketcoach/ (GitHub Pages, deployed from `main`),
or open `index.html` in any modern browser. There is no build step and nothing to install.
On a phone it works best turned sideways.
Keyboard: Enter to continue, Escape to go back. Mouse and touch work on every button.

From the title screen:

- **New career:** pick one of the 18 first-class counties and manage it. Club names are the real
  county names, but every player is invented and generated fresh for each new career. The career
  saves in your browser, so **Continue career** picks up where you left off.
- **Quick match:** a one-off match between two random counties.

Quick matches and friendlies come in three formats:

- **T20:** 20 overs a side, at most 4 overs per bowler.
- **50 overs:** 50 overs a side, at most 10 overs per bowler.
- **Four-day:** two innings each and 96 overs a day. You can declare, the side that bats
  first can enforce the follow-on with a lead of 150, the pitch wears and helps the bowlers
  later in the game, bowlers tire in long spells, and rain can cost overs. If time runs out
  before a result, the match is drawn.

In a match you captain your side against the computer:

- **Toss:** if you win it, choose to bat or bowl.
- **Bowling:** pick a bowler before each over (keys 1-9, or C for the computer's pick). Each bowler can bowl at most 4 overs, and never two in a row. Press F to switch the field between Attack, Normal and Defend.
- **Batting:** press F to switch your batters between Attack, Normal and Defend. Attacking scores faster but loses more wickets.
- **Space** bowls the next ball, **A** turns auto-play on and off, and **S** shows the scorecard.
- **M** opens the Sim menu: let the computer play both sides to the end of the over, innings or
  match (and in four-day games, the session or day). In four-day games you declare from this menu.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | Page that loads the scripts in order |
| `js/config.js` | Title, resolution and match settings (20 overs a side by default) |
| `js/engine.js` | Canvas scaling, main loop, input and the screen manager |
| `js/ui.js`, `js/font.js`, `js/palette.js` | Buttons and panels, built-in 5x7 pixel font, colour palette |
| `js/data/counties.js` | The 18 counties: display names, colours, strength, starting division and regional group |
| `js/data/names.js` | Pools of invented surnames used to generate players |
| `js/career/squads.js` | Squad generation, county rules (squad size, overseas limit) and picking the best XI |
| `js/career/career.js` | The career save: every county's squad, your club, saving and loading |
| `js/match/engine.js` | Ball-by-ball match simulation for T20, 50-over and four-day matches, and the computer captain (no drawing) |
| `tests/sim.test.js` | Simulates thousands of matches and checks the scoring adds up |
| `js/screens/` | Title, county choice, squad, club office, format choice, team sheet, match and scorecard screens |
| `js/sprites.js` | Loads the art and draws sprites, tinting team colours |
| `assets/` | Replaceable placeholder art. See `assets/README.md` for sizes and layouts |
| `tools/make-placeholder-art.js` | Regenerates the placeholder PNGs |

## Roadmap

1. Repo and game skeleton (done)
2. Ball-by-ball match engine with captain choices: bowler, field setting, batting aggression (done)
3. Match screens and replaceable placeholder sprite sheets (done)
4. Play-test, tune scoring and publish on GitHub Pages (done)

County management mode:

1. The 18 counties with invented squads, choosing your county, saved careers (done)
2. 50-over and four-day match formats (done)
3. A season with a two-division four-day championship, a T20 competition and a 50-over cup
4. Squad management: picking the XI, overseas limits, wage budget, contracts and signing windows
5. Polish: news, end-of-season review, balancing

## Tests

Run `node tests/sim.test.js` (Node 18 or later). It generates all 18 county squads and
checks they follow the squad rules, then plays 2000 T20, 500 50-over and 250 four-day
computer-vs-computer matches between them. It checks that runs, wickets, balls and bowling
figures add up, that each format's rules hold (over limits, declarations, follow-on, innings
wins, draws only when time runs out), and that average scores and the share of draws stay in
a realistic range. It prints the averages so the balance can be tuned. GitHub Actions runs it on every
pull request.
