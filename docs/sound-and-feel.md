# Sound and feel

After the forest itself, these are the two things the owner cares about most: sound that is light and pleasant, and an interface where every touch answers back. Both are part of "done" in every milestone. Neither is a polish pass at the end.

## Part 1: Sound

### Principles

- **No audio files.** Every sound is synthesized with Web Audio. The sound engine adds code, not downloads.
- **Sound follows the simulation.** The wind you hear is the gust value at the wanderer. Rustle comes from the trees a gust is touching. Nothing loops on a timer.
- **Quiet and never tiring.** This is a game to leave open. Nothing harsh, nothing that repeats exactly, no constant music.
- **Never the same twice.** Every one-shot sound varies a little in pitch (about 3 percent) and in level.

### The mix

    master      volume, mute, limiter
      ambience  wind bed, canopy rustle, birds, dusk voices
      world     footsteps, leaves, landmarks (later: fire, creatures)
      interface hover, press, release, toggle, slider, open, close
      music     sparse notes only

The base has one volume slider and one mute switch. The four buses exist from the start so later features have a place to go.

### Voices

| Sound | How it is made | Driven by |
|---|---|---|
| Wind bed | Filtered noise. The filter opens as the wind rises | `breeze()` and `gust()` at the wanderer |
| Canopy rustle | Short bright noise swells, panned left or right | Gusts on trees near the wanderer |
| Birds, by day | Sine chirps in short random phrases, far apart | Time of day. Quiet during a strong gust |
| Dusk voices | Soft pulsed tones like crickets, a rare low call | Time of day |
| Footsteps | Tiny filtered noise ticks, two alternating pitches | `step` events. Different on grass, trail and leaves |
| Press | Soft wooden knock | `ui-press` |
| Release | Two plucked notes, rising to confirm, falling to go back | `ui-release` |
| Hover | Very quiet tick, rate limited | Pointer devices only |
| Discovery | Three plucked notes with a long tail | `landmark-found` |
| Music | A few plucked notes in a modal scale, a soft drone at dusk | Rarely, and never over another phrase |

The plucked string is the game's signature instrument. By day it reads as a lute. At dusk, with a long echo, it reads as something stranger. That is the mood blend in sound.

### Rules

- The audio context starts on the first press, because browsers require a user action. Sound fades in over about 1.5 s. It never pops in.
- Under a menu the world sound is turned down and muffled, not cut.
- Sound pauses with the tab.
- Interface sounds are shorter than 150 ms. Hover ticks are limited to one every 60 ms.
- Keep headroom: no clipping when a gust, a discovery and a button happen together.
- About 16 voices at most at the same time.
- Volume and mute are saved. Mute is one key (M) and one visible control.

## Part 2: Feel

### Principles

- **Answer in the same frame.** Every input shows something at once, even if the action itself takes longer.
- **Three channels.** Motion, sound, and a tiny vibration on phones that support it. Never rely on one alone.
- **Small, fast, physical.** Things press in, spring back, settle. Nothing bounces for show.
- **The forest never stops.** Menus float over a living world. The wind keeps moving behind every screen.

### Timing

| Name | Duration | Use |
|---|---|---|
| instant | 0 to 60 ms | Press down, hover |
| quick | 120 to 160 ms | Release, toggles, toasts arriving |
| calm | 240 to 320 ms | Screens opening, camera settling |
| slow | 600 to 1500 ms | Fading into the world, sound fading in |

Things that enter ease out. Things that leave ease in, and leave faster than they entered. A release uses a light spring with one small overshoot.

### Buttons

Every button has all of these states: rest, hover, pressed, released, keyboard focus, disabled.

- **Press:** moves down 1 px and scales to about 98 percent within 60 ms. The border darkens, the knock plays, the phone gives a short vibration where supported.
- **Release:** springs back in about 140 ms with the pluck. The action fires on release, as on a real button. Sliding off before release cancels it, silently.
- **Hover**, pointer devices only: the border brightens, with a very quiet tick.
- **Focus:** a clear ring for keyboard users. Every menu works with the keyboard alone.
- **Size:** 44 px tall or more on touch screens.
- **Destructive actions**, such as resetting the save: press and hold for about a second while a line fills. No confirm dialogs.

### Screens

- **Title:** the live forest, the name, one button: Begin. That first press also starts the sound. The wind fades in as the camera settles on the wanderer.
- **Pause:** the world dims a little and keeps moving. The panel rises 8 px while it fades in.
- **Settings:** volume (moving it plays a tick at the new level), mute, reduced motion, show wind, the seed with a copy button, reset.
- **Toasts:** a discovery slides in at the top, holds, and leaves on its own. One at a time.

### In the world

- The wanderer speeds up and slows down over a few frames. No instant starts or stops.
- A footstep lands on a contact frame of the walk animation: the sound and a faint puff of dust or leaves together.
- Walking through a bush or tall flowers nudges them one pixel and makes them rustle.
- Near something that can be interacted with: a soft highlight and a small hint. The hint shows the right input for the device in use.
- Finding a landmark: the camera eases toward it slightly, the discovery phrase plays, the name appears. Control never leaves the player.

### Look of the shell

The interface uses Vercel's Geist design system: Geist Sans for text, Geist Mono for labels and numbers, Geist Pixel for the title and landmark names, near-black panels with a hairline border, Geist's spacing and corner radii. It stays quiet so the forest carries the colour. Fonts are hosted in the repo, cut down to the characters used, and never block the first frame.

### Accessibility

- Reduced motion, from the system setting or the game's own switch: no camera easing, no interface movement, fades only. The wind stays. It is the game.
- Text contrast at WCAG AA or better over any part of the forest.
- No flashing. No information carried by sound alone or by colour alone.
- The game pauses when the tab loses focus.
