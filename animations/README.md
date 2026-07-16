# Sovstac — Animation Storyboards

ASCII storyboards for every animation in the Sovstac site. One file per animation.
Each is a plain-text flipbook: the key beats drawn as frames, with timings and the
easing, so anyone can grasp the motion without opening the code or the browser.

This is the map. The code lives in `../lib/`, the tunable previews in `../previews/`.

## Index

| Animation | Storyboard | Code | Preview | Status |
|---|---|---|---|---|
| Intro background (antigravity) | [intro-background.txt](intro-background.txt) | `lib/antigravity.js` | `previews/intro-background.html` | ✅ built |
| Logo reveal ("Own your stack") | [logo-reveal.txt](logo-reveal.txt) | `previews/logo-reveal.html` (lib port pending) | `previews/logo-reveal.html` | ✅ built |
| Work / case studies | — | — | — | ⬜ planned |
| How we build | — | — | — | ⬜ planned |
| Contact / audit | — | — | — | ⬜ planned |

## Legend

```
  [  ]        the bracket frame — our logo's "O", a secure perimeter
  ·  ˙        a particle at rest / drifting
  ●  ○        a particle pulled onto the ring (bright / dim)
  (+)         the cursor / focal point
  ───▶        motion, in the arrow's direction
  ▓▓▓         a solid stroke (bracket spine or arm)
  │ ┐ └       box-drawing, used to sketch letterforms
  ·····▶      a clip/wipe edge travelling
  ⟨t⟩         a timestamp on the master timeline
  ~~~         a hairline rule
```

Each frame is captioned with its beat name and the config key that drives it, so a
storyboard frame maps straight to a knob in the control panel.

## Adding a future animation

1. Copy the shape of an existing storyboard: a header block, then frames in order,
   each with `beat name`, `⟨time⟩`, `ease`, and the config keys it reads.
2. Keep frames a consistent width (60 cols) so the flipbook reads cleanly.
3. Add a row to the Index table above.
4. If it's driven by a preview, name the `lib/` module and the `previews/` file.

Storyboard first, then build — the ASCII is cheap to iterate and settles the beats
before any code is written.
