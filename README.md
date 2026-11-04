# Cricket Coach

A browser-based, pixel-art cricket captaincy game inspired by the classic 16-bit cricket management games of the late 1980s.

"Cricket Coach" is a working title.

## Playing

Open `index.html` in any modern browser. There is no build step and nothing to install.
Keyboard: Enter to continue, Escape to go back. Mouse and touch work on every button.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | Page that loads the scripts in order |
| `js/config.js` | Title, resolution and match settings (20 overs a side by default) |
| `js/engine.js` | Canvas scaling, main loop, input and the screen manager |
| `js/ui.js`, `js/font.js`, `js/palette.js` | Buttons and panels, built-in 5x7 pixel font, colour palette |
| `js/data/teams.js` | The two invented teams and their player ratings |
| `js/screens/` | Title, team sheet, match and scorecard screens |
| `assets/` | Replaceable placeholder art (from step 3) |

## Roadmap

1. Repo and game skeleton (this step)
2. Ball-by-ball match engine with captain choices: bowler, field setting, batting aggression
3. Match screens and replaceable placeholder sprite sheets
4. Play-test, tune scoring and publish on GitHub Pages
