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

### The season

Each season has three competitions (the names are invented):

- **County Championship:** four-day matches in two divisions (10 and 8 counties), 14 matches
  each. 16 points for a win, 8 for a draw, plus bonus points in the first 110 overs of each
  first innings: 1 batting point at 250, 300, 350, 400 and 450 runs, and 1 bowling point at
  3, 6 and 9 wickets. The top side in Division 1 are champions; two go down and two come up.
- **Shires T20 Trophy:** North and South groups of nine, home and away (16 matches each).
  The top four in each group reach the quarter-finals, then Finals Day (semi-finals and final).
- **Counties 50 Cup:** the same groups, each side playing the others once. The top two in
  each group reach the semi-finals, then the final.

From the club office you play your next match or simulate it; every other fixture is
simulated. After each round you see all the results. Tables (with net run rate for the
one-day competitions) and your fixture list are a button away. Quitting a competition
match part-way through lets the computer play out the rest. At the end of the season you
get a review, then promotion and relegation are applied and the next season begins.

The **News** button in the office lists your results, your players' hundreds and
five-wicket hauls, qualification for the knockouts, and transfer windows opening and
closing. Every player's season figures (matches, runs, top score, averages, wickets and
economy) are kept for each competition: press **Stats** on the squad screen to see them,
and the last page of the tables shows the leading run scorers and wicket takers.

### Your squad

Simplified versions of the real county rules:

- **Squad size:** at most 24 registered players, and you can't release below 16.
- **Overseas players:** at most 3 registered, and at most 2 in any XI.
- **Wages:** your wage bill must fit the club's budget. A released player's wage still
  counts until the end of the season.
- **Transfer windows:** you can sign free agents from the transfer market pre-season until
  31 May, and again during July. Players ask for a wage and a contract length.
- **Contracts:** a player in the last year of his contract can be offered a new one
  (the Renew button). Anyone you don't renew leaves at the end of the season, unless your
  squad would drop below 16, in which case your best ones stay on a one-year deal.
- **Choosing the XI:** on the squad screen, pick a player (click or arrow keys) and press
  Pick to put them in or out of the XI. Auto XI goes back to the computer's choice. If your
  XI isn't a full eleven, the computer picks it for you.

In the close season everyone gets a year older: young players improve towards their
potential and older ones slowly decline. Players of 35 and over may retire, two academy
players join each county, and the computer counties renew contracts and sign free agents.

### Match formats

Matches come in three formats:

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
| `js/career/season.js` | Fixtures, results, league tables, bonus points, knockouts, promotion and relegation |
| `js/career/market.js` | Squad rules: choosing the XI, signing, releasing, contracts, transfer windows and the close season |
| `js/career/career.js` | The career save: every county's squad, your club, the season, saving and loading |
| `js/match/engine.js` | Ball-by-ball match simulation for T20, 50-over and four-day matches, and the computer captain (no drawing) |
| `tests/sim.test.js` | Simulates thousands of matches and checks the scoring adds up |
| `js/screens/` | Title, county choice, squad, transfer market, club office, news, results, tables, fixtures, season review, close season, format choice, team sheet, match and scorecard screens |
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
3. A season with a two-division four-day championship, a T20 competition and a 50-over cup (done)
4. Squad management: picking the XI, overseas limits, wage budget, contracts and signing windows (done)
5. Polish: news, player figures and season leaders, balancing (done)

## Tests

Run `node tests/sim.test.js` (Node 18 or later). It generates all 18 county squads and
checks they follow the squad rules, then plays 2000 T20, 500 50-over and 250 four-day
computer-vs-computer matches between them. It checks that runs, wickets, balls and bowling
figures add up, that each format's rules hold (over limits, declarations, follow-on, innings
wins, draws only when time runs out), and that average scores and the share of draws stay in
a realistic range. Finally it plays a whole season and checks every county has the right
number of fixtures, the tables and points add up, the knockouts have winners, and promotion
and relegation carry into the next season. It then tests the squad rules (overseas,
squad size, wages, windows, contracts, choosing the XI) and runs two more close seasons,
checking squads stay legal and players age. It prints the averages so the balance can be tuned. GitHub Actions runs it on every
pull request.
