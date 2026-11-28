# Finger Podium (PoC)

Pixel-art Olympic games in 24 events, controlled with a phone (touch and motion sensors) or a
computer (trackpad, mouse and keyboard). Vanilla JavaScript and Canvas 2D. No dependencies,
no build step.

| Group | Events |
|---|---|
| Classics | 400 m hurdles, long jump, shot put, archery, boxing, weightlifting |
| Track and field | 100 m dash, javelin, high jump, pole vault, discus, hammer |
| Water and wheels | 100 m freestyle, diving, rowing, canoe slalom, surfing, track cycling |
| Skill and duels | Speed climbing, balance beam, trap shooting, table tennis, penalty kicks, fencing |

The goal of the career is a gold medal in every event, which opens the final.

## The start

The 400 m hurdles, the timed races and every long jump attempt begin with a starter: "On your marks", "Set" and,
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

## Track and field

All of them are one attempt at a time; throws have three and heights end after three misses.

| Event | Phone | Computer |
|---|---|---|
| 100 m dash | Alternate thumbs down; flick up at the line to dip | Alternate Left / Right; Space dips |
| Javelin | Swipe down to run; hold a finger still to draw the arm back; tilt for the angle; lift to throw | Arrows run; hold and release Space; Up / Down for the angle |
| High jump | Run; tilt along the curve; flick up; tilt back or tap to arch | A / D run; arrows for the curve; Space jumps, then arches |
| Pole vault | Run; hold a finger to plant; lift it in the green; tilt or tap to clear | Arrows run; hold and release Space; Space again |
| Discus | Twist the wrist or draw circles; flick up while facing the sector | Alternate arrows; Space |
| Hammer | Roll the phone or draw circles; tap while facing the sector | Alternate arrows; Space |

## Water and wheels

| Event | Phone | Computer |
|---|---|---|
| 100 m freestyle | Swipe or circle, left and right; tilt to breathe; flick up at the wall | A / L stroke; arrows breathe; Space turns |
| Diving | Flick up; swipe to somersault; hold to open; tilt to straighten | Space; Up somersaults; Down opens; Left / Right adjust |
| Rowing | Swipe down with two fingers on the beat | Space on the beat |
| Canoe slalom | Tap left and right to paddle; tilt to steer through the gates | A / L paddle; arrows steer |
| Surfing | Tilt to ride; flick up at the lip; circles spin in the air | Arrows ride; Space jumps; A / L spin |
| Track cycling | Draw circles to pedal; tilt to change lane; ride in a slipstream to rest | A / L pedal; arrows steer |

## Skill and duels

| Event | Phone | Computer |
|---|---|---|
| Speed climbing | Tap the side of the lit hold; both sides for red holds | A / L; Space for both |
| Balance beam | Tilt to balance; swipe where the arrow points | A / D balance; arrows for the moves |
| Trap shooting | Move the phone to aim; tap to shoot | Mouse or arrows aim; click or Space |
| Table tennis | Swipe up as the ball arrives, sideways to place it; tilt for spin | Space; arrows place it |
| Penalty kicks | Swipe to shoot, curved if wanted; tilt or swipe sideways to save | Arrows and Space shoot; Left / Right save |
| Fencing | Tilt or tap to parry high or low; flick up to lunge | Up / Down guard; Space lunges |

Without a motion sensor (or without permission to use it), dragging a finger tilts instead; trap
shooting aims by tapping. These controls were checked with emulated touches and have yet to be
tuned on real phones.

## Medals

- Individual events: 1st is gold, 2nd silver and 3rd bronze. An athlete without a mark gets none.
- Duels (table tennis, penalties, fencing): winning is gold, losing by 1 silver, by 2 or 3 bronze.
- Boxing: winning is gold, a draw silver, losing on points bronze.
- Any level counts. The best medal of each event shows on its card and on the runner setup.
- Gold in all 24 events opens the final: the champion's podium.

## Training and form

The athlete has seven bars, from 0 to 100 (new athletes start at 50). Each event leans on a main
bar (70%) and a second one (30%); the runner setup shows both.

| Bar | Main bar of |
|---|---|
| Speed | 100 m, speed climbing |
| Strength | Shot put, weightlifting, javelin, discus, hammer |
| Jump | Long jump, high jump, pole vault |
| Stamina | 400 m hurdles, swimming, rowing, canoe, cycling |
| Aim | Archery, trap, penalty kicks |
| Balance | Diving, surfing, balance beam |
| Reflexes | Boxing, table tennis, fencing |

**An event is locked while either of its two bars is below 50.** Its card shows a padlock and the
missing bars; choosing it explains what it needs and leads to training. Athletes saved before this
rule had their lower bars raised to 50 once.

The resulting form changes the strength of the rivals (from 10% stronger with empty bars to 10%
weaker with full ones) and, in most events, how forgiving the controls are. It does not change the
player's own marks. Tables live in `career.js`.

Training is free: run, jump rope, lift weights, box jumps, target shooting, yoga, juggling, eat
and rest. **Doping** fills one random bar and takes 5 points from every other. After any session
the athlete rests for **1 hour**: a see-through window with a countdown covers the buttons. A
session that changes nothing (the bar is already full) needs no rest.

Bars, medals and the time of the last session are stored in the browser (`localStorage`):
clearing it also loses the progress. The rest relies on the clock of the device.

## Screens

1. **Title**: single player, my athlete, training and the final (multiplayer is not available
   yet). Keys: Enter, A, T and F.
2. **Events**: four groups of six; arrows at the bottom or Page Up / Page Down change group.
3. **Runner setup**: country, name and level, next to an athlete performing the event.
4. **Competition** and results.

To add a discipline in the shared engine: define its rules in a `rules-*.js` file (see
`events.js`), draw it in `scenes.js`, describe its controls in `GUIDES` (`event-ui.js`), add it
to `EVENTS` (`home.js`) and `career.js`, draw its card (`art-more.js`) and its setup movements
(`poses.js`).

To add a discipline with its own screen: write its rules (`<name>.js`, DOM-free) and its screen (`<name>-ui.js`),
register the screen in `screens` (`game.js`), add both scripts to `index.html`, enable the event
in `EVENTS` (`home.js`), draw its card in `art.js` and give it movements for the setup screen in
`moves.js` (plus its height in `HEADROOM`, `menu.js`).

An event screen returns `{ lock, start, update, draw, key, click }` and optionally
`keyUp`, `down`, `move`, `up` (raw pointers), `flick` and `wheel` (two-finger movement).

## Sound

All sound is 8-bit. The game asks for it as soon as the page loads. Browsers that do not allow
sound before a gesture (the usual case on phones) show **Tap to start** over the title; that first
tap, click or key press only starts the sound.

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

- Motion sensors need HTTPS (or `localhost`); iPhone asks for permission on the first tap.
- Rotating or twisting events can make a phone slip: hold it tight.

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
| `career.js` / `career-ui.js` | Medals, training bars (testable), athlete, training and champion screens |
| `events.js` | Matches, attempts and standings of the shared engine (testable) |
| `rules-race.js`, `rules-field.js`, `rules-skill.js` | Rules and a test bot for 18 events |
| `event-ui.js` | Touch, tilt and keyboard input, HUD and results of those events |
| `scenes.js` | Their drawings |
| `touch.js` / `motion.js` | Gestures and tilt (testable) |
| `poses.js` | Athlete poses of those events |
| `art-more.js` | Their event cards |
| `game.js` | Input wiring, state machine, HUD and main loop |
| `*.test.js` | Unit tests |
