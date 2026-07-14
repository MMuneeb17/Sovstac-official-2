# Sovstac — Preview Lab

HTML previews for the Sovstac official site. Tune the design here first; we port
the tuned result into a Next.js component library afterwards.

## The files here are standalone

**`previews/*.html` are fully self-contained.** Double-click one, mail it, drop it on
a USB stick, open it on a plane — it works. Each file makes **zero network requests**:
the library code, three.js, GSAP and the fonts (Michroma, Ubuntu, Ubuntu Mono) are all
inlined, the fonts as base64.

That's why they're **generated**. Don't edit `previews/*.html` by hand — your changes
will be overwritten on the next build.

```
templates/*.html  +  lib/*.js  +  vendor/   ──build.mjs──>   previews/*.html
   (author here)     (author here)            (cache)          (generated)
```

## Layout

```
lib/                      ← source of truth. The Next.js port will be built from this.
  brand.js                palette, fonts, config helpers — imported by everything
  control-panel.js        schema-driven control panel (takes its schema as a param)
  antigravity.js          vanilla Three.js port of React Bits <Antigravity />
  config-welcome.js       defaults + schema + presets for the intro background
  logo-reveal.js          GSAP bracket reveal — draws the wordmark live
  config-logo-reveal.js   defaults + schema + presets + measured wordmark geometry
templates/                ← the HTML you edit (uses ES module imports from ../lib/)
previews/                 ← GENERATED standalone HTML. Do not edit.
vendor/                   ← build cache: three, gsap, fonts. Gitignored, re-fetched.
build.mjs                 ← the inliner
```

## Workflow

Edit `templates/` or `lib/`, then:

```bash
npm run build     # regenerates previews/*.html
```

Then just open `previews/index.html` — no server needed.

To develop with live reload instead, serve from the project root and open the
**templates** (they use ES modules, so they do need a server):

```bash
npm run serve     # http://localhost:4321/templates/
```

## Why a build step at all?

A browser fetches relative module imports on a `file://` page with origin `null`, and
CORS blocks them — so `import '../lib/x.js'` gives you a blank page and no control
panel. A CDN doesn't save you either: three ships **no UMD build** any more (ESM only),
and a CDN means the file dies without internet. Inlining everything is the only way the
files are genuinely portable.

Two traps in the build, both real, both fixed — leave the fixes alone:

- **`String.replace` with a string replacement treats `$&`, `` $` ``, `$'` as special.**
  Minified three is full of `$` sequences, so injecting the bundle that way silently
  corrupts it into a syntax error. Every injection uses a replacer *function*.
- **three is split into two independently-minified chunks** (`three.module` imports from
  `three.core`), and `three.module` contains a **re-export** — `export{...}from"./three.core.min.js"`.
  A naive `/export\{...\}/` match hits that clause, slices out its `export{...}` half and
  orphans the `from"..."` tail. Re-exports are stripped wholesale first. The two chunks
  also each get their own IIFE scope, because both minify to short names (`e`, `t`, `n`)
  that would otherwise collide.

## Control panel

| Key | Action |
|---|---|
| `C` | Hide / show the panel |
| `Space` | Play / pause (logo reveal) |
| `R` | Replay (logo reveal) |

Each preview supplies its own schema, so the panel's groups differ per page.
The logo reveal also has a **scrubber** at the bottom — park on any frame and tune it.

### Saving — how Apply works

Two separate states:

- **live** — every slider move repaints the preview immediately, but writes nothing.
- **saved** — only **Apply & Save** commits the live state to `localStorage`.

So you can explore freely and only keep what you want. The panel shows
"● unsaved changes" whenever the two differ, and warns you before a reload would
discard them.

| Button | Does |
|---|---|
| **Apply & Save** | Commits current settings. Dimmed when there's nothing to save. |
| **Export JSON** | Downloads the config — the handoff artifact for the Next.js port. |
| **Revert** | Throws away unsaved changes, back to the last Apply. |
| **Reset to brand defaults** | Back to the brand defaults, clears storage. |

Export is what makes the port mechanical: the Next.js components will accept this
exact object shape, so tuning carries over verbatim instead of being rebuilt by hand.

## Brand rules encoded here

From the official Brand Guidelines (`../Sovstac (Copy)/`):

- **Colors** — primary `#08E1AC`, dark `#00251C`, light `#DFFFE8`; blue `#08458C` /
  `#B0CFF3`; red `#99120B` / `#FAD3D1`; neutrals black → white. The deck approves
  exactly two pairings: dark (`#00251C` field, `#08E1AC` accent) and light
  (`#DFFFE8` field, `#00251C` ink) — the **Signal** and **Daylight** presets.
- **Fonts** (for when content lands) — Michroma (titles only; very wide, so
  headlines must be short), Ubuntu (body), Ubuntu Mono (code/labels).
- **Graphic language** — strictly typographic plus 1px hairline rules on flat
  color. No photography, no gradients, no texture.
- **Values** — Ownership, Precision, Independence, Privacy.
- **The logo is the concept** — the `[]` replaces the "O" to signify "a secure
  perimeter, a dedicated private server, an isolated cloud environment." The
  antigravity ring — particles repelled into a boundary around a protected void —
  is that mark in motion.

## Logo reveal

The sequence: the frame boots sealed → unseals → opens on your custom line → closes,
squeezing the line out of existence → **seals** (the one hard colour cut) → opens
again, and the six Michroma letters assemble around it, revealing **S[]VSTAC**.

**The idea:** the brackets you watch the whole time *are* the "[]" in the wordmark.
They never turn into the logo — they're revealed to have been it all along.

Three facts, measured from the real artwork, are load-bearing. Carry them into the
Next.js port:

1. **The bracket is not a stroked rect.** Its spine (27u) and arms (22u) are
   deliberately *different* weights. A stroked rect gives uniform weight; a `scaleX`
   would thin the spines while stretching the arms. So each bracket is three filled
   rects — spine, top arm, bottom arm — and the arm length is a driven variable.
   Nothing is ever scaled non-uniformly.

2. **The letters are real Michroma.** The wordmark's letters were verified to be
   unmodified Michroma Regular (pixel overlay against the asset, IoU > 0.97 per
   glyph), so they're typeset as live text, not shipped as an image. Each letter is
   placed by measuring its own rendered ink box and nudging it onto the exact x it
   occupies in the artwork — which sidesteps side bearings and kerning entirely.
   That matters: Michroma's native **T/A kern is -0.159em**, and the T and A ink
   boxes physically **overlap by 49 units**. Letters therefore animate on y +
   opacity, never on x, and **A goes last** so it settles into the T instead of
   crossing through it.

3. **The payoff is one tween.** The stage scales about the bracket pair's own centre.
   Because the brackets sit left of the wordmark's centre (x=415.5 of 2000), a pure
   scale would leave the finished logo hanging off-centre — so the same tween also
   slides the stage left by `(1000 - 415.5) × finalScale`. Scale and slide run
   together, so it reads as one move.

Measured geometry lives in `WORDMARK` in `lib/config-logo-reveal.js`.

**A GSAP gotcha worth remembering:** the bracket colour is driven by a state value and
a zero-duration `.set()`, **not** a `.call()`. Callbacks don't reverse when you scrub
backwards, so a `.call()` left the brackets stuck accent-coloured after the first
playthrough. `.set()` reverts correctly on reverse-seek.

## Antigravity port note

`lib/antigravity.js` is a line-for-line port of the React Bits component. Only the
framework scaffolding changed:

| React Three Fiber | Vanilla |
|---|---|
| `<Canvas camera={...}>` | `WebGLRenderer` + `PerspectiveCamera` |
| `useThree().viewport` | computed from fov + camera distance |
| `useFrame` | `requestAnimationFrame` |
| `state.pointer` | pointer in NDC from `pointermove` |
| `<instancedMesh>` | `new THREE.InstancedMesh(...)` |

The simulation itself is untouched, so the Next.js version will look and behave
exactly like what you tune here.

Two inherited behaviors worth knowing:

- Mouse movement below `0.001` in normalized device coords doesn't count as
  movement, so it won't reset the idle timer.
- With `autoAnimate` on, the ring wanders on its own after 2s of no movement.
  Turn it off to pin the ring to the cursor.

`three` is pinned to `0.185.1` via CDN import map — the same version we'll pin in
the Next.js app.
