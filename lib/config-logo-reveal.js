/**
 * Config for the LOGO REVEAL preview.
 *
 * The choreography is inspired by the live sovstac.com loader — brackets wipe in,
 * the mark reveals outward from the centre, then the wordmark expands and spells
 * itself out — but every asset and rule here comes from OUR brand guidelines, not
 * from the site. So:
 *
 *   - the mark is the guidelines' S[]VSTAC, not the site's wave glyph
 *   - the caps are Michroma; the inserted lowercase is Ubuntu (the site uses a
 *     handwriting face, which is not one of our three licensed typefaces)
 *   - the field is #00251C with #08E1AC accent — the approved dark pairing
 *
 * THE MOVE: our "O" IS the bracket frame. So the word can grow out of it —
 * S[]VSTAC becomes S[]Vereign STACk — with the frame sitting perfectly still while
 * the letters part around it. The logo explains its own name.
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
    { ch: 'S', x0: 0,    x1: 299 },  // 0  — the "S" of SOV, left of the frame
    { ch: 'V', x0: 524,  x1: 826 },  // 1  — the "V" of SOV, right of the frame
    { ch: 'S', x0: 835,  x1: 1134 }, // 2  ┐
    { ch: 'T', x0: 1145, x1: 1418 }, // 3  │ STAC — these shift right when the
    { ch: 'A', x0: 1370, x1: 1693 }, // 4  │ word expands
    { ch: 'C', x0: 1701, x1: 1999 }, // 5  ┘
  ],
  // "SOV" ends at the V (826). "STAC" runs 835..1999. The insert goes between them.
  sovEnd: 826,
  stacStart: 835,
  stacEnd: 1999,
  stacIndices: [2, 3, 4, 5],
};

export const DEFAULTS = {
  palette: {
    bg: BRAND.mintDeep,
    bracket: BRAND.mint,      // the frame — the hero of the mark
    caps: BRAND.mint,         // S[]V ... STAC
    insert: BRAND.mintLight,  // the "ereign" / "k" written into the gaps
    rule: BRAND.mint,
  },

  content: {
    // The word the mark is hiding. Caps are Michroma; these are set in Ubuntu.
    insertMid: 'ereign',   // goes after SOV
    insertEnd: 'k',        // goes after STAC
    insertFont: 'Ubuntu',
    insertSize: 150,       // wordmark units
    insertGap: 14,         // clear space either side of an insert
    showRule: true,
  },

  geometry: {
    logoWidth: 620,        // px — width of the wordmark BEFORE it expands
    wipeOvershoot: 30,     // how far past the ink the reveal wipes travel
  },

  timing: {
    speed: 1,              // global multiplier — 0.5 = half speed, for tuning
    bracketWipe: 760,      // the frame drawing itself in, top to bottom
    coreWipe: 900,         // letters revealing outward from the frame
    coreOverlap: 300,      // how early the letters start, relative to the frame
    holdMark: 900,         // the beat on the finished S[]VSTAC
    expand: 1000,          // the word parting to make room
    insertDur: 520,        // each inserted letter
    insertStagger: 55,     // between inserted letters
    insertLead: 260,       // how far into the expansion the letters start arriving
    holdWord: 1200,        // the beat on S[]Vereign STACk
    ruleIn: 500,
    loopDelay: 1400,
    loop: false,
  },

  easing: {
    bracketWipe: 'power3.out',
    coreWipe: 'power4.out',
    expand: 'power4.inOut',
    insert: 'expo.out',
  },

  effects: {
    glow: 0,
    vignette: 0,
    grain: 0,
    grid: 0,        // the live site sits on a faint grid — off by default here
    gridSize: 48,
  },
};

const EASES = [
  'power2.out', 'power3.out', 'power4.out', 'expo.out',
  'power2.inOut', 'power3.inOut', 'power4.inOut', 'expo.inOut',
  'power2.in', 'power4.in', 'none',
];

export const SCHEMA = [
  {
    group: 'Word',
    icon: '✎',
    controls: [
      { path: 'content.insertMid', label: 'Insert after SOV', type: 'text' },
      { path: 'content.insertEnd', label: 'Insert after STAC', type: 'text' },
      { path: 'content.insertFont', label: 'Insert Font', type: 'select', options: ['Ubuntu', 'Ubuntu Mono', 'Michroma'] },
      { path: 'content.insertSize', label: 'Insert Size', type: 'range', min: 60, max: 260, step: 2 },
      { path: 'content.insertGap', label: 'Insert Gap', type: 'range', min: 0, max: 80, step: 1 },
      { path: 'content.showRule', label: 'Hairline Rule', type: 'toggle' },
    ],
  },
  {
    group: 'Palette',
    icon: '◉',
    controls: [
      { path: 'palette.bg', label: 'Background', type: 'color' },
      { path: 'palette.bracket', label: 'Bracket Frame', type: 'color' },
      { path: 'palette.caps', label: 'Caps (Michroma)', type: 'color' },
      { path: 'palette.insert', label: 'Insert (Ubuntu)', type: 'color' },
      { path: 'palette.rule', label: 'Hairline Rule', type: 'color' },
    ],
  },
  {
    group: 'Geometry',
    icon: '▦',
    controls: [
      { path: 'geometry.logoWidth', label: 'Logo Width', type: 'range', min: 240, max: 1400, step: 10, unit: 'px' },
      { path: 'geometry.wipeOvershoot', label: 'Wipe Overshoot', type: 'range', min: 0, max: 200, step: 2 },
    ],
  },
  {
    group: 'Timing',
    icon: '⏱',
    controls: [
      { path: 'timing.speed', label: 'Speed', type: 'range', min: 0.2, max: 3, step: 0.05, unit: '×' },
      { path: 'timing.bracketWipe', label: 'Bracket Wipe', type: 'range', min: 100, max: 2500, step: 20, unit: 'ms' },
      { path: 'timing.coreWipe', label: 'Letters Wipe', type: 'range', min: 100, max: 2500, step: 20, unit: 'ms' },
      { path: 'timing.coreOverlap', label: 'Letters Lead', type: 'range', min: 0, max: 1500, step: 20, unit: 'ms' },
      { path: 'timing.holdMark', label: 'Hold (mark)', type: 'range', min: 0, max: 3000, step: 20, unit: 'ms' },
      { path: 'timing.expand', label: 'Expand', type: 'range', min: 200, max: 3000, step: 20, unit: 'ms' },
      { path: 'timing.insertLead', label: 'Insert Lead', type: 'range', min: 0, max: 1500, step: 20, unit: 'ms' },
      { path: 'timing.insertDur', label: 'Insert Duration', type: 'range', min: 100, max: 1500, step: 20, unit: 'ms' },
      { path: 'timing.insertStagger', label: 'Insert Stagger', type: 'range', min: 0, max: 250, step: 5, unit: 'ms' },
      { path: 'timing.holdWord', label: 'Hold (word)', type: 'range', min: 0, max: 4000, step: 20, unit: 'ms' },
      { path: 'timing.ruleIn', label: 'Rule In', type: 'range', min: 0, max: 1500, step: 20, unit: 'ms' },
      { path: 'timing.loop', label: 'Loop', type: 'toggle' },
      { path: 'timing.loopDelay', label: 'Loop Delay', type: 'range', min: 0, max: 5000, step: 50, unit: 'ms' },
    ],
  },
  {
    group: 'Easing',
    icon: '⇝',
    controls: [
      { path: 'easing.bracketWipe', label: 'Bracket Wipe', type: 'select', options: EASES },
      { path: 'easing.coreWipe', label: 'Letters Wipe', type: 'select', options: EASES },
      { path: 'easing.expand', label: 'Expand', type: 'select', options: EASES },
      { path: 'easing.insert', label: 'Insert', type: 'select', options: EASES },
    ],
  },
  {
    group: 'Effects',
    icon: '▨',
    controls: [
      { path: 'effects.grid', label: 'Grid', type: 'range', min: 0, max: 0.4, step: 0.005 },
      { path: 'effects.gridSize', label: 'Grid Size', type: 'range', min: 16, max: 160, step: 2, unit: 'px' },
      { path: 'effects.glow', label: 'Accent Glow', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'effects.vignette', label: 'Vignette', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'effects.grain', label: 'Grain', type: 'range', min: 0, max: 0.3, step: 0.005 },
    ],
  },
];

export const PRESETS = {
  'Signal (default)': {},
  'Taut': {
    timing: { speed: 1.4, holdMark: 500, holdWord: 800 },
    easing: { coreWipe: 'expo.out', expand: 'expo.inOut' },
  },
  'Slow burn': {
    timing: { speed: 0.75, holdMark: 1600, holdWord: 2200, insertStagger: 90 },
  },
  'Terminal': {
    palette: { bg: BRAND.black, insert: BRAND.mintLight },
    content: { insertFont: 'Ubuntu Mono' },
    effects: { grid: 0.08, glow: 0.3 },
  },
  'Daylight': {
    palette: {
      bg: BRAND.mintLight,
      bracket: BRAND.mintDeep,
      caps: BRAND.mintDeep,
      insert: '#5C7A6E',
      rule: BRAND.mintDeep,
    },
  },
};
