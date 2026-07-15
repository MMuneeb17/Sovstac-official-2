/**
 * Config for the LOGO REVEAL preview — the "Own your stack" sequence.
 *
 * The frame boots sealed → unseals → opens on your custom line → closes,
 * squeezing the line out of existence → seals → opens again, and the six
 * Michroma letters assemble around it (with the bracket slot briefly empty)
 * before the frame flies into place, revealing S[]VSTAC.
 *
 * All geometry is in WORDMARK UNITS — the coordinate space of the official
 * S[]VSTAC asset, viewBox "0 0 2000 254", measured from the real artwork:
 *
 *   cap line      y = 5      baseline  y = 248.1     cap height = 243.1
 *   left "["      x 328..408          right "]"      x 423..503
 *   pair centre   x = 415.5           bracket height 247 (y 6..253)
 *   spine weight  27                  arm thickness  22   <- deliberately unequal
 *   arm reach     53 beyond the spine gap (tip..tip)  15
 *
 * The unequal spine/arm weights are why the brackets are drawn as separate rects
 * and never scaled — a scaleX would thin the spines and fatten the arms.
 */

import { BRAND } from './brand.js';

export const WORDMARK = {
  viewBox: [0, 0, 2000, 254],
  capLine: 5,
  baseline: 248.1,
  capHeight: 243.1,
  pairCx: 415.5,
  bracketTop: 6,
  bracketBottom: 253,
  spine: 27,
  armThickness: 22,
  restChamber: 121,
  restArmReach: 53,
  restGap: 15,
  // Measured ink extents of each glyph. T and A overlap by 49 units — that is
  // Michroma's own T/A kern, and it is why letters never animate on x individually.
  letters: [
    { ch: 'S', x0: 0,    x1: 299 },
    { ch: 'V', x0: 524,  x1: 826 },
    { ch: 'S', x0: 835,  x1: 1134 },
    { ch: 'T', x0: 1145, x1: 1418 },
    { ch: 'A', x0: 1370, x1: 1693 },
    { ch: 'C', x0: 1701, x1: 1999 },
  ],
};

export const DEFAULTS = {
  palette: {
    bg: BRAND.mintDeep,
    bracketIdle: BRAND.mintLight,   // the frame while it is working
    bracketSealed: BRAND.mint,      // the one highlight: a hard cut on the seal
    bracketFinal: BRAND.mint,       // accent bracket + light letters = approved dark triad
    text: BRAND.mintLight,          // the custom line inside the chamber
    letters: BRAND.mintLight,       // the wordmark letters
    rule: BRAND.mint,
  },

  content: {
    // Your line. It is clipped by the chamber, so keep it short enough to fit.
    text: 'Own your stack.',
    textFont: 'Ubuntu Mono',
    textSize: 78,          // wordmark units
    textTracking: 0.08,    // em
    showRule: true,
  },

  geometry: {
    heroBracketHeight: 300, // px — how tall the frame is at hero scale
    logoWidth: 660,         // px — final wordmark width
    // The frame opens to fit your line: chamber = measured text width + 2 × padding,
    // clamped so it never opens wider than the viewport. Turn autoFit off to drive
    // the opening manually with openChamber instead.
    autoFit: true,
    textPadding: 90,        // wordmark units of clear space each side of the text
    openChamber: 1180,      // used only when autoFit is off
    apertureOpen: 900,      // how wide the frame swings before it flies into the logo
    armRest: 53,            // arm reach when sealed (the wordmark's true value)
    armOpen: 18,            // arm reach while open — arms retract so walls read as walls
    gap: 15,                // tip-to-tip slit at rest
  },

  timing: {
    speed: 1,               // global multiplier — 0.5 = half speed, for tuning
    bootIn: 420,
    hold1: 260,
    unseal1: 380,
    open1: 900,
    textIn: 600,
    holdText: 900,
    close1: 860,
    seal1: 400,
    holdSealed: 340,
    release: 560,
    payoff: 1400,           // scale + recentre into the final lockup
    letterDur: 620,
    letterStagger: 60,
    // The beat where the wordmark sits there with a HOLE in it, before the brackets
    // fly in. This pause is the whole point — don't set it to 0.
    holdEmpty: 420,
    collapse: 760,          // the brackets flying into the empty slot
    ruleIn: 500,
    loopDelay: 1200,        // pause before looping, if loop is on
    loop: false,
  },

  easing: {
    open: 'power4.inOut',
    close: 'power4.inOut',
    unseal: 'power3.inOut',
    text: 'expo.out',
    release: 'power4.out',
    payoff: 'power4.inOut',
    letters: 'expo.out',
  },

  effects: {
    glow: 0,
    vignette: 0,
    grain: 0,
  },
};

const EASES = [
  'power2.inOut', 'power3.inOut', 'power4.inOut', 'expo.inOut',
  'power2.out', 'power3.out', 'power4.out', 'expo.out',
  'power2.in', 'power4.in', 'expo.in', 'none',
];

export const SCHEMA = [
  {
    group: 'Content',
    icon: '✎',
    controls: [
      { path: 'content.text', label: 'Your Text', type: 'text' },
      { path: 'content.textFont', label: 'Text Font', type: 'select', options: ['Ubuntu Mono', 'Ubuntu', 'Michroma'] },
      { path: 'content.textSize', label: 'Text Size', type: 'range', min: 20, max: 180, step: 1 },
      { path: 'content.textTracking', label: 'Text Tracking', type: 'range', min: -0.05, max: 0.4, step: 0.005, unit: 'em' },
      { path: 'content.showRule', label: 'Hairline Rule', type: 'toggle' },
    ],
  },
  {
    group: 'Palette',
    icon: '◉',
    controls: [
      { path: 'palette.bg', label: 'Background', type: 'color' },
      { path: 'palette.bracketIdle', label: 'Bracket (working)', type: 'color' },
      { path: 'palette.bracketSealed', label: 'Bracket (sealed)', type: 'color' },
      { path: 'palette.bracketFinal', label: 'Bracket (logo)', type: 'color' },
      { path: 'palette.text', label: 'Your Text', type: 'color' },
      { path: 'palette.letters', label: 'Wordmark Letters', type: 'color' },
      { path: 'palette.rule', label: 'Hairline Rule', type: 'color' },
    ],
  },
  {
    group: 'Geometry',
    icon: '▦',
    controls: [
      { path: 'geometry.heroBracketHeight', label: 'Hero Frame Height', type: 'range', min: 80, max: 700, step: 5, unit: 'px' },
      { path: 'geometry.logoWidth', label: 'Final Logo Width', type: 'range', min: 240, max: 1400, step: 10, unit: 'px' },
      { path: 'geometry.autoFit', label: 'Open To Fit Text', type: 'toggle' },
      { path: 'geometry.textPadding', label: 'Text Padding', type: 'range', min: 0, max: 400, step: 5 },
      { path: 'geometry.openChamber', label: 'Open Width (manual)', type: 'range', min: 200, max: 1900, step: 10 },
      { path: 'geometry.apertureOpen', label: 'Fly-In Width', type: 'range', min: 130, max: 1600, step: 10 },
      { path: 'geometry.armRest', label: 'Arm Reach (sealed)', type: 'range', min: 0, max: 90, step: 1 },
      { path: 'geometry.armOpen', label: 'Arm Reach (open)', type: 'range', min: 0, max: 90, step: 1 },
      { path: 'geometry.gap', label: 'Slit Gap', type: 'range', min: 0, max: 120, step: 1 },
    ],
  },
  {
    group: 'Timing',
    icon: '⏱',
    controls: [
      { path: 'timing.speed', label: 'Speed', type: 'range', min: 0.2, max: 3, step: 0.05, unit: '×' },
      { path: 'timing.bootIn', label: 'Boot In', type: 'range', min: 0, max: 1500, step: 20, unit: 'ms' },
      { path: 'timing.hold1', label: 'Hold (closed)', type: 'range', min: 0, max: 2000, step: 20, unit: 'ms' },
      { path: 'timing.unseal1', label: 'Unseal', type: 'range', min: 0, max: 1200, step: 20, unit: 'ms' },
      { path: 'timing.open1', label: 'Open 1', type: 'range', min: 100, max: 2500, step: 20, unit: 'ms' },
      { path: 'timing.textIn', label: 'Text In', type: 'range', min: 0, max: 2000, step: 20, unit: 'ms' },
      { path: 'timing.holdText', label: 'Hold (text)', type: 'range', min: 0, max: 4000, step: 20, unit: 'ms' },
      { path: 'timing.close1', label: 'Close', type: 'range', min: 100, max: 2500, step: 20, unit: 'ms' },
      { path: 'timing.seal1', label: 'Seal', type: 'range', min: 0, max: 1200, step: 20, unit: 'ms' },
      { path: 'timing.holdSealed', label: 'Hold (sealed)', type: 'range', min: 0, max: 3000, step: 20, unit: 'ms' },
      { path: 'timing.release', label: 'Release', type: 'range', min: 100, max: 2000, step: 20, unit: 'ms' },
      { path: 'timing.payoff', label: 'Payoff (scale)', type: 'range', min: 200, max: 3500, step: 20, unit: 'ms' },
      { path: 'timing.letterDur', label: 'Letter Duration', type: 'range', min: 100, max: 2000, step: 20, unit: 'ms' },
      { path: 'timing.letterStagger', label: 'Letter Stagger', type: 'range', min: 0, max: 300, step: 5, unit: 'ms' },
      { path: 'timing.holdEmpty', label: 'Hold (empty slot)', type: 'range', min: 0, max: 2500, step: 20, unit: 'ms' },
      { path: 'timing.collapse', label: 'Brackets Fly In', type: 'range', min: 100, max: 2000, step: 20, unit: 'ms' },
      { path: 'timing.ruleIn', label: 'Rule In', type: 'range', min: 0, max: 1500, step: 20, unit: 'ms' },
      { path: 'timing.loop', label: 'Loop', type: 'toggle' },
      { path: 'timing.loopDelay', label: 'Loop Delay', type: 'range', min: 0, max: 5000, step: 50, unit: 'ms' },
    ],
  },
  {
    group: 'Easing',
    icon: '⇝',
    controls: [
      { path: 'easing.open', label: 'Open', type: 'select', options: EASES },
      { path: 'easing.close', label: 'Close', type: 'select', options: EASES },
      { path: 'easing.unseal', label: 'Unseal', type: 'select', options: EASES },
      { path: 'easing.text', label: 'Text', type: 'select', options: EASES },
      { path: 'easing.release', label: 'Release', type: 'select', options: EASES },
      { path: 'easing.payoff', label: 'Payoff', type: 'select', options: EASES },
      { path: 'easing.letters', label: 'Letters', type: 'select', options: EASES },
    ],
  },
  {
    group: 'Effects',
    icon: '▨',
    controls: [
      { path: 'effects.glow', label: 'Accent Glow', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'effects.vignette', label: 'Vignette', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'effects.grain', label: 'Grain', type: 'range', min: 0, max: 0.3, step: 0.005 },
    ],
  },
];

export const PRESETS = {
  'Vault (default)': {},
  'Taut': {
    timing: { speed: 1.35, holdText: 600, hold1: 160, holdSealed: 220 },
    easing: { open: 'expo.inOut', close: 'expo.inOut' },
  },
  'Slow burn': {
    timing: { speed: 0.75, holdText: 1600, holdSealed: 700, hold1: 500 },
  },
  'Monochrome': {
    palette: { bracketFinal: BRAND.mintLight, bracketSealed: BRAND.mintLight },
  },
  'Daylight': {
    palette: {
      bg: BRAND.mintLight,
      bracketIdle: BRAND.mintDeep,
      bracketSealed: BRAND.mintDeep,
      bracketFinal: BRAND.mintDeep,
      text: BRAND.mintDeep,
      letters: BRAND.mintDeep,
      rule: BRAND.mintDeep,
    },
  },
};
