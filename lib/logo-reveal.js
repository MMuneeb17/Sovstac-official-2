/**
 * Sovstac logo reveal — a cinematic bracket sequence.
 *
 * The sequence: the frame boots sealed → unseals → opens, revealing your custom
 * line inside → closes, squeezing the line out of existence → seals (one hard
 * colour cut) → opens again and the six Michroma letters assemble around it,
 * revealing S[]VSTAC.
 *
 * THE IDEA: the brackets you watch the whole time ARE the "[]" in the wordmark.
 * They never become the logo — they are revealed to have been it all along.
 *
 * Three things are load-bearing, all established by measuring the real artwork:
 *
 * 1. THE BRACKET IS NOT A STROKED RECT. Its spine (27u) and arms (22u) are
 *    deliberately different weights. A stroked rect gives uniform weight, and a
 *    scaleX would thin the spines while stretching the arms. So each bracket is
 *    drawn as three filled rects — one spine, two arms — and the arm length is a
 *    driven variable. Nothing is ever scaled non-uniformly.
 *
 * 2. THE LETTERS ARE REAL MICHROMA. The wordmark's letters were verified to be
 *    unmodified Michroma Regular (pixel overlay against the asset, IoU > 0.97 per
 *    glyph), so they are typeset as live text rather than shipped as an image.
 *    Each letter is positioned by measuring its own rendered ink box and nudging
 *    it onto the exact x it occupies in the artwork — which sidesteps side
 *    bearings and kerning entirely, and gives us per-letter animation handles.
 *
 * 3. THE PAYOFF IS ONE TWEEN. The stage scales about the bracket pair's own
 *    centre. Because the brackets sit left of the wordmark's centre (x=415.5 of
 *    2000), a pure scale would leave the finished logo hanging off-centre, so the
 *    same tween also slides the stage left by (1000 - 415.5) × finalScale. Scale
 *    and slide run together, so it reads as one move: the frame settling into
 *    the wordmark that assembles around it.
 */

import gsap from 'gsap';
import { WORDMARK as W } from './config-logo-reveal.js';

const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

export function createLogoReveal(container, config, { onProgress } = {}) {
  let cfg = config;

  /* ---------------- DOM ---------------- */

  const svg = svgEl('svg', {
    width: '100%',
    height: '100%',
    xmlns: 'http://www.w3.org/2000/svg',
  });
  Object.assign(svg.style, { display: 'block', position: 'absolute', inset: '0' });

  // Everything lives in wordmark coordinates inside this group. The group's
  // transform is what moves/scales the whole film.
  const stage = svgEl('g');

  // The custom line is clipped to the chamber interior, so when the frame closes
  // the text is physically squeezed out of existence rather than fading — the
  // boundary destroys it. (Stolen from the "Containment" direction.)
  const clipId = `sv-chamber-${Math.floor(performance.now())}`;
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: clipId });
  const clipRect = svgEl('rect');
  clip.appendChild(clipRect);
  defs.appendChild(clip);

  const textGroup = svgEl('g', { id: 'sv-text', 'clip-path': `url(#${clipId})` });
  const customText = svgEl('text', {
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
  });
  textGroup.appendChild(customText);

  const lettersGroup = svgEl('g', { id: 'sv-letters' });
  const letterNodes = W.letters.map(({ ch }) => {
    const t = svgEl('text', { x: 0, y: W.baseline });
    t.textContent = ch;
    lettersGroup.appendChild(t);
    return t;
  });

  // Each bracket: spine + top arm + bottom arm. Never scaled, only re-laid-out.
  const mk = side => ({
    spine: svgEl('rect', { class: `sv-spine sv-${side}` }),
    top: svgEl('rect', { class: `sv-arm sv-${side}` }),
    bottom: svgEl('rect', { class: `sv-arm sv-${side}` }),
  });
  const L = mk('l');
  const R = mk('r');
  const bracketGroup = svgEl('g', { id: 'sv-brackets' });
  [L, R].forEach(b => bracketGroup.append(b.spine, b.top, b.bottom));

  const rule = svgEl('rect', { height: 1 });

  // Z-ORDER IS LOAD-BEARING: brackets go BEHIND the letters.
  //
  // The pair is centred at x=415.5 of a 2000-wide wordmark — left of centre — so any
  // symmetric opening sends the right bracket straight across V-S-T-A-C. There is no
  // width at which both brackets clear the letters. Painted on top, the spines slice
  // through the glyphs and it reads as a rendering bug.
  //
  // Behind them, the letters occlude the spines, and the frame appears to travel BEHIND
  // the wordmark and surface in the one place nothing covers it: the empty slot it
  // belongs in. The collision becomes the effect.
  stage.append(defs, textGroup, bracketGroup, lettersGroup, rule);
  svg.appendChild(stage);
  container.appendChild(svg);

  /* ---------------- animated state ----------------
     GSAP tweens this plain object; every tick re-draws the geometry from it.
     That's what makes the parametric bracket possible. */

  const S = {
    chamber: W.restChamber,   // clear width between the spines' inner faces
    armReach: W.restArmReach, // how far each arm reaches in from its spine
    scale: 1,
    px: 0,                    // where the pair centre lands on screen, x
    py: 0,
    frameOpacity: 0,
    textOpacity: 0,
    ruleScale: 0,
    // 0 = working (pale), 1 = sealed (accent), 2 = final lockup.
    // This is a STATE value, not a callback, so that scrubbing backwards through
    // the seal correctly un-does the colour. A gsap .call() would not reverse.
    fillPhase: 0,
  };

  let vw = 0;
  let vh = 0;
  // How wide the frame opens for the current text. Set in build(), read in draw()
  // to derive the text's scale from the chamber.
  let openTo = W.restChamber;

  const heroScale = () => cfg.geometry.heroBracketHeight / (W.bracketBottom - W.bracketTop);
  const finalScale = () => cfg.geometry.logoWidth / W.viewBox[2];

  /** Where the pair centre must sit so the FINISHED wordmark is centred. */
  const finalPx = () => vw / 2 - (W.viewBox[2] / 2 - W.pairCx) * finalScale();

  /**
   * How wide the frame opens: as wide as your line needs, and no wider.
   *
   * Measures the text as actually rendered (so it responds to the font, size and
   * tracking you pick), then adds padding each side. Clamped at the top so a long
   * line can't push the frame off the edges of the screen, and at the bottom so a
   * short line still opens to something worth looking at.
   */
  function openChamberFor() {
    const g = cfg.geometry;
    // Always start from the nominal size — otherwise a previous shrink compounds.
    customText.setAttribute('font-size', cfg.content.textSize);

    if (!g.autoFit) return g.openChamber;

    let textW = 0;
    try {
      textW = customText.getBBox().width;
    } catch {
      textW = 0; // not laid out yet — fall back to the manual width
    }
    if (!textW) return g.openChamber;

    // The widest the frame can be and still fit on screen at hero scale.
    const maxOnScreen = vw / heroScale() - W.spine * 2 - 48;
    const maxTextW = maxOnScreen - g.textPadding * 2;

    // A line too long to fit on screen shrinks to fit rather than being clipped by
    // its own frame — the chamber is capped by the viewport, so without this the
    // text would just run under the brackets and get cut off.
    if (textW > maxTextW && maxTextW > 0) {
      customText.setAttribute('font-size', cfg.content.textSize * (maxTextW / textW));
      textW = maxTextW;
    }

    const min = W.restChamber + 60;
    return Math.max(min, Math.min(textW + g.textPadding * 2, maxOnScreen));
  }

  function draw() {
    const { spine, armThickness: at, bracketTop: y0, bracketBottom: y1, pairCx } = W;
    const half = S.chamber / 2;
    const armLen = Math.max(0, S.armReach);

    // Left bracket: spine sits outside the chamber, arms reach in.
    const lSpineX = pairCx - half - spine;
    L.spine.setAttribute('x', lSpineX);
    L.spine.setAttribute('y', y0);
    L.spine.setAttribute('width', spine);
    L.spine.setAttribute('height', y1 - y0);

    for (const [arm, ay] of [[L.top, y0], [L.bottom, y1 - at]]) {
      arm.setAttribute('x', lSpineX);
      arm.setAttribute('y', ay);
      arm.setAttribute('width', spine + armLen);
      arm.setAttribute('height', at);
    }

    // Right bracket: mirror.
    const rSpineX = pairCx + half;
    R.spine.setAttribute('x', rSpineX);
    R.spine.setAttribute('y', y0);
    R.spine.setAttribute('width', spine);
    R.spine.setAttribute('height', y1 - y0);

    for (const [arm, ay] of [[R.top, y0], [R.bottom, y1 - at]]) {
      arm.setAttribute('x', rSpineX - armLen);
      arm.setAttribute('y', ay);
      arm.setAttribute('width', spine + armLen);
      arm.setAttribute('height', at);
    }

    // The chamber interior — what the custom text is clipped to. Insetting by the
    // arm thickness keeps a glyph from ever poking through an arm.
    clipRect.setAttribute('x', pairCx - half);
    clipRect.setAttribute('y', y0 + at);
    clipRect.setAttribute('width', S.chamber);
    clipRect.setAttribute('height', y1 - y0 - at * 2);

    customText.setAttribute('x', pairCx);
    customText.setAttribute('y', (y0 + y1) / 2);

    // The text is CARRIED by the frame, not merely revealed inside it. Its scale is
    // derived from the chamber width rather than tweened separately, so it is exactly
    // as open as the brackets are: it grows as they part, and as they close it is
    // drawn in with them and crushed to nothing at the seal. Deriving it (instead of
    // running a parallel tween) means the two can never drift out of sync.
    const span = openTo - W.restChamber;
    const ts = span > 0 ? Math.max(0, Math.min(1, (S.chamber - W.restChamber) / span)) : 1;
    const midY = (y0 + y1) / 2;
    textGroup.setAttribute(
      'transform',
      `translate(${pairCx} ${midY}) scale(${ts}) translate(${-pairCx} ${-midY})`
    );

    // Stage transform: scale about the pair centre, land it at (px, py).
    stage.setAttribute(
      'transform',
      `translate(${S.px} ${S.py}) scale(${S.scale}) translate(${-pairCx} ${-(y0 + y1) / 2})`
    );

    // Derived, not commanded — so it survives a reverse scrub.
    const p = cfg.palette;
    setBracketFill(
      S.fillPhase >= 2 ? p.bracketFinal : S.fillPhase >= 1 ? p.bracketSealed : p.bracketIdle
    );

    bracketGroup.style.opacity = S.frameOpacity;
    textGroup.style.opacity = S.textOpacity;

    rule.setAttribute('x', 0);
    rule.setAttribute('y', W.baseline + 46);
    rule.setAttribute('width', W.viewBox[2] * S.ruleScale);
    rule.setAttribute('height', 1.5);
    rule.style.opacity = cfg.content.showRule ? 0.28 : 0;
  }

  /** Position each letter by measuring its ink box and nudging it onto target x. */
  function layoutLetters() {
    const size = W.capHeight * 1.3333; // Michroma cap height is 1536/2048 em
    letterNodes.forEach((node, i) => {
      const spec = W.letters[i];
      node.setAttribute('font-family', 'Michroma');
      node.setAttribute('font-size', size);
      node.setAttribute('fill', cfg.palette.letters);
      node.setAttribute('x', 0);
      node.style.transform = 'none';

      let box;
      try {
        box = node.getBBox();
      } catch {
        return; // not rendered yet
      }
      // Shift so the glyph's ink lands exactly where it does in the artwork.
      node.dataset.finalX = String(spec.x0 - box.x);
      node.setAttribute('x', spec.x0 - box.x);
    });
  }

  function applyStyle() {
    const p = cfg.palette;
    [L, R].forEach(b => [b.spine, b.top, b.bottom].forEach(r => r.setAttribute('fill', p.bracketIdle)));
    letterNodes.forEach(n => n.setAttribute('fill', p.letters));

    customText.setAttribute('fill', p.text);
    customText.setAttribute('font-family', cfg.content.textFont);
    customText.setAttribute('font-size', cfg.content.textSize);
    customText.setAttribute('letter-spacing', `${cfg.content.textTracking}em`);
    customText.textContent = cfg.content.text;

    rule.setAttribute('fill', p.rule);
  }

  function setBracketFill(color) {
    [L, R].forEach(b => [b.spine, b.top, b.bottom].forEach(r => r.setAttribute('fill', color)));
  }

  function resize() {
    vw = container.clientWidth || 1;
    vh = container.clientHeight || 1;
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    draw();
  }

  /* ---------------- the timeline ---------------- */

  let tl = null;

  function build() {
    tl?.kill();

    const { timing: t, easing: e, geometry: g, palette: p } = cfg;
    const ms = n => n / 1000; // GSAP works in seconds

    // Reset to the sealed hero state.
    Object.assign(S, {
      chamber: W.restChamber,
      armReach: g.armRest,
      scale: heroScale(),
      px: vw / 2,
      py: vh / 2,
      frameOpacity: 0,
      textOpacity: 0,
      ruleScale: 0,
      fillPhase: 0,
    });
    lettersGroup.style.opacity = 1;
    letterNodes.forEach(n => gsap.set(n, { opacity: 0, y: 0 }));
    draw();

    tl = gsap.timeline({
      paused: true,
      defaults: { onUpdate: draw },
      repeat: t.loop ? -1 : 0,
      repeatDelay: ms(t.loopDelay),
      // Redraw on every tick, including seeks — so scrubbing repaints correctly.
      onUpdate: () => {
        draw();
        onProgress?.(tl.progress(), tl.duration());
      },
      onComplete: () => onProgress?.(1, tl.duration()),
    });
    tl.timeScale(t.speed);

    // How far the frame opens — sized to the text unless you've turned autoFit off.
    openTo = openChamberFor();

    // ACT 1 — the sealed frame exists.
    tl.addLabel('boot', 0)
      .to(S, { frameOpacity: 1, duration: ms(t.bootIn), ease: 'expo.out' }, 'boot');

    tl.addLabel('unseal1', `+=${ms(t.hold1)}`)
      // The seal breaks before the walls move: arms retract, then the frame parts.
      .to(S, { armReach: g.armOpen, duration: ms(t.unseal1), ease: e.unseal }, 'unseal1')
      .to(S, { chamber: openTo, duration: ms(t.open1), ease: e.open }, `unseal1+=${ms(t.unseal1 * 0.6)}`);

    // ACT 2 — your line, held inside the open frame.
    tl.addLabel('textIn', '>-0.15')
      .to(S, { textOpacity: 1, duration: ms(t.textIn), ease: e.text }, 'textIn');

    tl.addLabel('close', `+=${ms(t.holdText)}`)
      // The text needs no fade of its own: its scale is derived from the chamber, so
      // the closing frame drags it inward and crushes it out of existence. It goes
      // with the brackets.
      .to(S, { chamber: W.restChamber, duration: ms(t.close1), ease: e.close }, 'close')
      .to(S, { armReach: g.armRest, duration: ms(t.seal1), ease: 'power2.out' }, `close+=${ms(t.close1 - t.seal1 * 0.55)}`)
      // Belt and braces: kill the opacity in the last sliver of travel so a 1px shard
      // of glyph can't strobe at the seal.
      .to(S, { textOpacity: 0, duration: 0.12, ease: 'power2.in' }, `close+=${ms(t.close1 - 120)}`);

    // THE SEAL — the only highlight in the film, and it is a CUT, not a fade.
    // A machine latches instantaneously; it does not cross-dissolve.
    // A zero-duration .set (not .call) so a reverse scrub restores the pale state.
    tl.addLabel('engage')
      .set(S, { fillPhase: 1 }, 'engage')
      // A 5-unit compression and release. Felt, not seen — the door meeting its stop.
      .to(S, { chamber: W.restChamber - 5, duration: 0.1, ease: 'power2.in' }, 'engage')
      .to(S, { chamber: W.restChamber, duration: 0.1, ease: 'power2.out' }, '>');

    // ACT 3 — controlled disclosure, in a deliberate order:
    //
    //   1. the frame swings WIDE and the whole stage scales down into logo position
    //   2. the six letters assemble — leaving the bracket slot EMPTY. For a beat you
    //      are looking at "S[ ]VSTAC" with nothing in the brackets' place: a hole.
    //   3. the brackets FLY IN and seat into that hole, completing the wordmark.
    //
    // That's the whole thesis made literal. The logo is incomplete without the frame,
    // and the frame you've been watching is the piece that completes it.
    //
    // Times are computed absolutely from here on, because the beats have to be
    // sequenced against each other rather than appended.
    const payoffAt = tl.duration() + ms(t.holdSealed);

    tl.addLabel('payoff', payoffAt)
      .set(S, { fillPhase: 2 }, payoffAt)
      .to(S, { armReach: g.armOpen, duration: ms(t.unseal1), ease: e.unseal }, payoffAt)
      // Swings wider than the slot, so when the letters land the hole is unmistakable.
      .to(S, { chamber: g.apertureOpen, duration: ms(t.release), ease: e.release }, payoffAt)
      // The payoff transform: scale down AND slide left, together, as one move.
      .to(S, {
        scale: finalScale(),
        px: finalPx(),
        duration: ms(t.payoff),
        ease: e.payoff,
      }, payoffAt);

    // The letters assemble OUTWARD from the brackets, not left-to-right — so the empty
    // slot reads as the origin of the wordmark. A goes last: its box overlaps T's by 49
    // units (Michroma's own T/A kern), so it must settle INTO the T rather than travel
    // across it. Everything moves on y + opacity, never on x.
    const order = [0, 1, 2, 3, 5, 4]; // S V S T C A — A last
    const lettersAt = payoffAt + ms(t.payoff) * 0.45;

    order.forEach((idx, n) => {
      tl.fromTo(
        letterNodes[idx],
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: ms(t.letterDur), ease: e.letters },
        lettersAt + ms(n * t.letterStagger)
      );
    });

    const lettersEnd = lettersAt + ms((order.length - 1) * t.letterStagger + t.letterDur);

    // THE ARRIVAL. The wordmark now sits there with a hole in it. Hold on that, then
    // the brackets sweep in over the letters and seat into their slot. They are drawn
    // last, so they pass over the letterforms like a closing shutter.
    const arriveAt = lettersEnd + ms(t.holdEmpty);

    tl.addLabel('arrive', arriveAt)
      .to(S, { chamber: W.restChamber, duration: ms(t.collapse), ease: e.close }, arriveAt)
      // The arms re-arm as the spines touch down — the slit narrows to its true 15u.
      .to(
        S,
        { armReach: g.armRest, duration: ms(t.seal1), ease: 'power3.out' },
        arriveAt + ms(t.collapse - t.seal1 * 0.55)
      );

    // The one ornament, and it is the brand's own: a 1px hairline rule.
    tl.addLabel('rule', arriveAt + ms(t.collapse) - 0.1)
      .to(S, { ruleScale: 1, duration: ms(t.ruleIn), ease: 'power4.inOut' }, arriveAt + ms(t.collapse) - 0.1);

    return tl;
  }

  /* ---------------- init ---------------- */

  const ro = new ResizeObserver(() => {
    resize();
    // finalPx depends on viewport width, so the payoff has to be re-derived.
    const p = tl?.progress() ?? 0;
    const wasPlaying = tl && !tl.paused();
    build();
    tl.progress(p);
    if (wasPlaying) tl.play();
  });
  ro.observe(container);

  applyStyle();
  resize();
  build();

  // Fonts must land before getBBox() means anything — it's what positions the Michroma
  // letters AND what measures the text to size the opening. So rebuild once they're in,
  // or the first play would use fallback-font metrics.
  document.fonts.ready.then(() => {
    layoutLetters();
    build();
    draw();
    onProgress?.(0, tl.duration());
  });

  const api = {
    play: () => tl.play(),
    pause: () => tl.pause(),
    toggle: () => (tl.paused() ? tl.play() : tl.pause()),
    restart: () => tl.restart(),
    seek: p => tl.progress(p),
    isPaused: () => tl.paused(),
    duration: () => tl.duration(),
    progress: () => tl.progress(),

    /** Re-apply config. Rebuilds the timeline and holds your place in it. */
    update(next) {
      cfg = next;
      applyStyle();
      layoutLetters();
      const p = tl?.progress() ?? 0;
      const wasPlaying = tl && !tl.paused();
      build();
      tl.progress(p);
      if (wasPlaying) tl.play();
      draw();
    },

    dispose() {
      tl?.kill();
      ro.disconnect();
      svg.remove();
    },
  };

  return api;
}
