# Finger Podium (PoC)

Pixel-art Olympic games (400 m hurdles, long jump, shot put,
archery, boxing and weightlifting) controlled
with a laptop trackpad or a phone touch screen. Vanilla JavaScript and Canvas 2D. No dependencies,
no build step.

## The start

The 400 m hurdles and every long jump attempt begin with a starter: "On your marks", "Set" and,
after a random wait of 1 to 2 s, "Go!", said aloud and written on screen. Power only counts from
the "go".

Swiping or jumping before it is a false start, signalled with two beeps (a swipe in the first
0.4 s is forgiven). The first one repeats the start. The second one disqualifies the runner in the
hurdles and, in the long jump, makes that attempt a foul.

## 400 m hurdles rules

- One lap, six lanes, ten hurdles (first at 45 m, then every 35 m).
- Lanes share the same distance, so everyone starts on the same line.
- Hitting a hurdle makes the runner stumble and lose speed.
- Results show the winner and standings; late rivals fill in as they finish.
- If every rival has finished, you have 25 s left before being marked DNF.
- Difficulty is chosen in the menu. Hard also hides the `JUMP!` hint.
- Android phones vibrate when you knock down a hurdle.

## Long jump

- Three attempts. The best mark wins; ties are broken by the next best one.
- Run up for 40 m, take off close to the board, then set the angle (about 22 degrees is best).
- Stepping over the board is a foul. Distance lost before the board is not recovered.
- A well-timed second swipe in the air stretches the legs and adds up to 0.5 m. Swipes in the
  first moments of the flight are ignored, so the finger may move after setting the angle.
- On a phone the angle is set with a new tap after the take-off flick; the meter waits 0.3 s
  for it. Android phones give a long vibration on landing.
- Level changes rival strength and the angle meter speed. Hard hides the cues.

| Step | Phone | Trackpad | Keyboard |
|---|---|---|---|
| Run | Swipe down, alternating fingers | Swipe down repeatedly | Alternate Left / Right |
| Take off | Flick up | Flick up | Hold Space |
| Set the angle | Tap | Click | Release Space |
| Stretch the legs | Swipe down in the air | Swipe down in the air | Down arrow |

## Shot put

- Three attempts, 8 seconds each to spin and throw. The best mark wins.
- Circles build power; an upward swipe throws. The shot leaves exactly where the athlete is
  facing at that moment, whatever the direction of the swipe: swipe while he faces the field.
- It counts inside a sector of 60 / 45 / 35 degrees to each side (easy / normal / hard) and is a
  foul outside it, or WRONG WAY beyond 90 degrees. Crooked throws lose a little distance.
- A swipe too short to throw while the finger moves throws when the finger is lifted.
- Android phones vibrate after each full turn.
- The yellow arc marks the rival distance to beat.

| Step | Phone | Trackpad | Keyboard |
|---|---|---|---|
| Spin | Draw circles with one finger | Draw circles with one finger on the pad | Arrow keys in clockwise order |
| Throw (facing the field) | Swipe straight up | Swipe straight up | Space |

## Archery

- Six arrows at 70 m. The highest total wins.
- A full draw is needed: a weak draw drops the arrow, and a very weak one cancels the shot.
- The wind drags the sight sideways all the time you aim, in gusts: keep correcting. The arrow
  lands where the sight points when you let go. At least half of the level's wind always blows
  (up to 3 / 4.5 / 6 m/s on easy / normal / hard, half as much again in gusts). It also makes
  the sight shudder and rocks the whole view downwind.
- On touch screens the wind drags and shakes the sight at 40% of that strength.
- The sign at the top shows which way the wind blows and how fast (green under 2 m/s, yellow
  under 4, red from 4), backed up by a flag and streaks on the field.
- Holding the bow drawn for long makes the aim shake.
- While aiming only the sight is in view, close to the eye. On release the camera follows the
  arrow to the target and shows the score.

| Step | Phone | Trackpad / mouse | Keyboard |
|---|---|---|---|
| Aim | Move the finger that draws | Move the pointer, no button | Arrow keys |
| Draw | Touch and pull down | Hold the click and drag back (down) | Hold Space |
| Shoot | Lift the finger | Release the click | Release Space |

With a mouse it works like a cue: while the string is held, moving sideways still corrects the
aim, and pushing forward again relaxes the string to cancel the shot.

## Boxing

- One 60 second bout, ending by knockout or on health points.
- The opponent blocks or slips most punches on guard and answers if you keep hammering him.
- A flashing glove and `!` announce a punch. It always comes down the middle, so dodging to
  either side slips it. Dodging leans and ducks your head under the punch while you stay on
  your spot.
- A late uppercut stops the opponent's punch.
- Nobody gets dazed: what a slipped punch costs is stamina. Both boxers spend it to punch,
  and extra when they miss. A tired opponent heaves, lets his guard sag, defends worse and
  needs a breath before attacking: that is the time to unload.
- Dodging when no punch is coming also costs stamina, and a tired boxer cannot dodge.

| Action | Phone | Keyboard | Mouse / trackpad |
|---|---|---|---|
| Left / right punch | Tap that half of the screen | A / D | Click that half |
| Uppercut | Swipe up on that half | Q / E | Drag up |
| Dodge | Tilt the phone, or swipe sideways | Left / Right | Drag sideways |

Android phones vibrate every time you are hit.

Tilting needs a secure context (HTTPS or `localhost`); iPhone also asks for permission.
Over plain `http://<computer-ip>:8000` use the sideways swipe.

## Weightlifting

- Clean and jerk, three attempts. The heaviest good lift wins.
- Before each lift choose the weight in 5 kg steps. It cannot go down, and after a good lift it
  must go up.
- **Pull**: tap both sides to raise the bar. Each side rises with its own taps and sags on its
  own, and one side gets weaker from time to time. A tilted bar is lost; a slow pull times out.
- The clean and the jerk play on their own.
- **Hold**: each side has a marker swinging over a bar. Stop each one inside the green zone with
  a single tap, in any order. One miss drops the bar on that side.
- Heavier bars need faster tapping and give a smaller, quicker target.

| Action | Keyboard | Phone |
|---|---|---|
| Choose the weight | F / J or arrows | `-5` and `+5` buttons |
| Start the lift | Enter or Space | `LIFT` button |
| Left / right side | F / J | Tap that half of the screen |

On a phone two arcade buttons, red on the left and blue on the right, press in with each tap,
flash on the side that is falling behind and stay down in green once a hold is timed right.
Tapping anywhere on that half of the screen works too.

Android phones vibrate with the effort. iPhone Safari and computers do not vibrate.

## Screens

1. **Title**: single player or multiplayer (multiplayer is not available yet).
2. **Events**: pick a discipline.
3. **Runner setup**: country, name and level, next to an athlete performing the event.
4. **Competition** and results.

To add a discipline: write its rules (`<name>.js`, DOM-free) and its screen (`<name>-ui.js`),
register the screen in `screens` (`game.js`), add both scripts to `index.html`, enable the event
in `EVENTS` (`home.js`), draw its card in `art.js` and give it movements for the setup screen in
`moves.js` (plus its height in `HEADROOM`, `menu.js`).

An event screen returns `{ lock, start, update, draw, key, click }` and optionally
`keyUp`, `down`, `move`, `up` (raw pointers), `flick` and `wheel` (two-finger movement).

## Sound

All sound is 8-bit and starts with the first tap, click or key press, because browsers do not
allow it earlier.

- The menu music starts and, 1 s later, an announcer shouts "Finger Podium!" while the music
  goes down to make room. The stadium cheers 1.5 s after the name, over the music turned
  almost off.
- The menu music loops in the title, event and runner screens.
  It stops when a competition starts and plays again back in the menus.
- When the final table of a competition comes up, the crowd cheers if you won and boos if you
  did not (a draw counts as not winning).
- Sound stops while the page is hidden. There is no mute button yet; use the volume of the
  device. On iPhone the silent switch may mute it.

The music (an original tune) and the false start beeps are generated in the browser by
`synth.js`. The other sounds are stored in `sounds.js`.

### Credits

| Sound | Source | License |
|---|---|---|
| Cheer | [19 Football Crowd - Reaction To Goal](https://freesound.org/s/528799/) by D.jones | CC0; trimmed to seconds 4-8, mono, filtered, limited, faded, 8-bit |
| Boo | [crowd booing](https://freesound.org/s/264378/) by HowardV | CC0; trimmed to seconds 0-4, same processing |
| Announcer and starter | "awb" voice of [CMU Flite](https://github.com/festvox/flite) | Synthesized, then stretched, re-pitched and given echoes |

## Runner setup

| Action | Mouse | Keyboard |
|---|---|---|
| Country | Click a flag | Arrow keys |
| Name (up to 8 characters) | | Type, Backspace |
| Level | Click a button | Tab |
| Start | Start button | Enter |
| Back to events | Back button | Esc |

## Phones

| Device | Orientation |
|---|---|
| Phone | Upright, full screen with no letterboxing and the camera close to the athlete (sideways also works, in 16:9) |
| Tablet | Landscape; the race pauses while held upright |

| Action | Touch |
|---|---|
| Charge speed (hurdles) | Swipe down anywhere; alternate fingers to charge faster |
| Jump (hurdles) | Quick upward flick |
| Name | Tap the name box to open the system keyboard |
| Back to menu | `MENU` button |

Android browsers switch to full screen on start. iPhone Safari does not support it;
use "Add to Home Screen" to hide the browser bars.

## Sense of speed

Field of view and camera height change with speed, plus trackside poles, ground
marks, speed lines and camera shake.

## Run

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Pause

On a computer, `Esc` pauses any competition and opens a menu with **Resume** (`Enter` or `Esc`)
and **Menu** (`M`). Losing the captured pointer, for instance by switching windows, pauses too.
Pausing lets go of held inputs, so a drawn bow relaxes without shooting. Browsers may need a
second click to capture the pointer again right after `Esc`.

## Hurdles controls

| Action | Trackpad | Keyboard fallback |
|---|---|---|
| Charge speed | Swipe down repeatedly; alternate two fingers to charge faster | Alternate Left / Right |
| Jump | Quick upward flick, one or two fingers | Space |
| Start / retry | Buttons on screen (the pointer is captured during the race) | Enter |
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

## Online version

AWS deployment (S3, CloudFront, EC2) is described in [infra/README.md](infra/README.md).
Planned features are listed in [ROADMAP.md](ROADMAP.md).

## Files

| File | Purpose |
|---|---|
| `index.html` | Page and canvas |
| `input.js` | Gesture detector (DOM-free, testable) |
| `home.js` | Title and event selection screens |
| `art.js` | Pixel illustrations: podium and events |
| `menu.js` | Runner selection screen |
| `mobile.js` | Touch gestures, system keyboard and screen changes |
| `layout.js` | Logical size and camera framing per device (testable) |
| `countries.js` | Outfits and pixel flags |
| `avatar.js` | Rotatable model of the athlete (setup preview, shot put, boxing, weightlifting) and its equipment |
| `moves.js` | Movements of the athlete on the setup screen (testable) |
| `font.js` | Bitmap font and name sanitizing |
| `track.js` | Oval geometry and coordinate conversions (testable) |
| `starter.js` | Starter's calls and false starts (testable) |
| `race.js` | Hurdles simulation, rival AI and standings (testable) |
| `longjump.js` | Long jump rules, rivals and standings (testable) |
| `longjump-ui.js` | Long jump input, HUD, angle meter and results |
| `contest.js` | Rivals, attempts and standings shared by the field events (testable) |
| `spin.js` | Circle-and-throw gesture detector (testable) |
| `shotput.js` / `shotput-ui.js` | Shot put rules (testable) and screen |
| `archery.js` / `archery-ui.js` | Archery rules (testable) and screen |
| `bow-art.js` | Archery sight art |
| `blocks.js` | Boxing gloves drawn flat on the screen, for the ones close to the camera |
| `boxing.js` / `boxing-ui.js` | Boxing rules and opponent (testable), screen and tilt input |
| `weightlifting.js` / `weightlifting-ui.js` | Weightlifting rules (testable), screen and vibration |
| `lift-art.js` | Weightlifting hall, platform, keycaps and arcade buttons |
| `scene3d.js` | Small 3D camera for the infield events |
| `fieldui.js` | HUD and results shared by the events |
| `render.js` | Chase camera, ground, stands, hurdles and sprites |
| `synth.js` | Menu music and decoding of the recorded sounds (testable) |
| `sounds.js` | Announcer, starter, cheer and boo recordings, with their credits |
| `audio.js` | Sound playback: unlocking, menu music, starter and crowd reactions (testable) |
| `game.js` | Input wiring, state machine, HUD and main loop |
| `*.test.js` | Unit tests |
