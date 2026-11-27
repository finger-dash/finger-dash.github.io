# Finger Dash (PoC)

Pixel-art 400 m hurdles race on an oval track, with a chase camera and five rivals,
controlled with a laptop trackpad. Vanilla JavaScript and Canvas 2D. No dependencies,
no build step.

## Race rules

- One lap, six lanes, ten hurdles (first at 45 m, then every 35 m).
- Lanes share the same distance, so everyone starts on the same line.
- Hitting a hurdle makes the runner stumble and lose speed.
- Results show the winner and standings; late rivals fill in as they finish.
- If every rival has finished, you have 25 s left before being marked DNF.
- Difficulty is chosen in the menu. Hard also hides the `JUMP!` hint.

## Menu

| Action | Mouse | Keyboard |
|---|---|---|
| Country | Click a flag | Arrow keys |
| Name (up to 8 characters) | | Type, Backspace |
| Level | Click a button | Tab |
| Start | Start button | Enter |

## Sense of speed

Field of view and camera height change with speed, plus trackside poles, ground
marks, speed lines and camera shake.

## Run

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Controls

| Action | Trackpad | Keyboard fallback |
|---|---|---|
| Charge speed | Swipe down repeatedly; alternate two fingers to charge faster | Alternate Left / Right |
| Jump | Quick upward flick, one or two fingers | Space |
| Start / retry | Buttons on screen (the pointer is captured during the race; Esc releases it) | Enter |
| Debug panel | | D |
| Invert two-finger direction | | I |
| Back to menu | Results screen button | M after a race, R during it |

## How gesture detection works

Each downward swipe adds 8% to the power bar; the bar leaks continuously and
sets the target speed.

| Gesture | Signal |
|---|---|
| One-finger swipe | Pointer movement (`movementY > 0`) under Pointer Lock |
| Two-finger swipe | `wheel` events; sign depends on the natural scrolling setting |
| New swipe | 55 ms of silence, upward movement, or re-acceleration |
| Jump flick | 60 px of upward travel within 100 ms, once per movement |

An OS momentum tail never adds swipes. All thresholds live in `DEFAULTS` in `input.js`.

## Known limitations

- Individual fingers are invisible to the browser; overlapping swipes may merge into one.
- Natural scrolling is assumed (Safari auto-detects it). Press `I` if two fingers do not charge.
- Lifting the fingers emits no event, so the jump is an upward flick instead.
- A fast hand repositioning upwards also triggers a jump.
- A physical mouse can also drive the runner.
- Tuned with synthetic events only; it still needs calibration on real hardware.

## Tests

```bash
node --test
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Page and canvas |
| `input.js` | Gesture detector (DOM-free, testable) |
| `menu.js` | Runner selection screen |
| `countries.js` | Outfits and pixel flags |
| `avatar.js` | Rotatable box model of the runner, with name on the shirt |
| `font.js` | Bitmap font and name sanitizing |
| `track.js` | Oval geometry and coordinate conversions (testable) |
| `race.js` | Simulation, rival AI and standings (testable) |
| `render.js` | Chase camera, ground, stands, hurdles and sprites |
| `game.js` | Input wiring, state machine, HUD and main loop |
| `*.test.js` | Unit tests |
