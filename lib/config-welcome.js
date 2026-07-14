/**
 * Config for the WELCOME preview (antigravity background).
 *
 * DEFAULTS holds every tunable value. SCHEMA describes how to render a control
 * for each one, so the control panel generates itself: add a knob here and it
 * appears in the panel automatically.
 *
 * "Export JSON" in the panel dumps the tuned object back out. That file is the
 * handoff artifact — the Next.js components will accept this exact shape, so
 * whatever gets tuned in the previews carries over verbatim.
 */

import { BRAND } from './brand.js';

export const DEFAULTS = {
  background: {
    bg: BRAND.mintDeep,   // the guidelines' approved dark pairing
    bgDeep: BRAND.black,  // vignette falloff colour
  },

  antigravity: {
    count: 700,
    // The viewport is ~50 world units across, so a small magnetRadius captures
    // too few particles for the ring to read as a perimeter.
    magnetRadius: 15,
    ringRadius: 7,
    fieldStrength: 10,
    waveSpeed: 0.4,
    waveAmplitude: 1,
    particleSize: 1.5,
    particleVariance: 1,
    pulseSpeed: 3,
    lerpSpeed: 0.05,
    rotationSpeed: 0.05,
    depthFactor: 1,
    color: BRAND.mint,
    opacity: 0.9,
    autoAnimate: true,
    particleShape: 'capsule',
  },

  effects: {
    glow: 0,
    vignette: 0,
    grain: 0,
  },
};

export const SCHEMA = [
  {
    group: 'Background',
    icon: '◉',
    controls: [
      { path: 'background.bg', label: 'Background', type: 'color' },
      { path: 'background.bgDeep', label: 'Vignette Colour', type: 'color' },
    ],
  },
  {
    group: 'Antigravity',
    icon: '✵',
    controls: [
      { path: 'antigravity.color', label: 'Particle Colour', type: 'color' },
      { path: 'antigravity.count', label: 'Count', type: 'range', min: 20, max: 2000, step: 10 },
      { path: 'antigravity.magnetRadius', label: 'Magnet Radius', type: 'range', min: 0, max: 30, step: 0.5 },
      { path: 'antigravity.ringRadius', label: 'Ring Radius', type: 'range', min: 0, max: 30, step: 0.5 },
      { path: 'antigravity.fieldStrength', label: 'Field Strength', type: 'range', min: 0.1, max: 30, step: 0.1 },
      { path: 'antigravity.waveSpeed', label: 'Wave Speed', type: 'range', min: 0, max: 5, step: 0.05 },
      { path: 'antigravity.waveAmplitude', label: 'Wave Amplitude', type: 'range', min: 0, max: 5, step: 0.05 },
      { path: 'antigravity.particleSize', label: 'Particle Size', type: 'range', min: 0.1, max: 8, step: 0.1 },
      { path: 'antigravity.particleVariance', label: 'Size Variance', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'antigravity.pulseSpeed', label: 'Pulse Speed', type: 'range', min: 0, max: 12, step: 0.1 },
      { path: 'antigravity.lerpSpeed', label: 'Lerp Speed', type: 'range', min: 0.005, max: 0.5, step: 0.005 },
      { path: 'antigravity.rotationSpeed', label: 'Rotation Speed', type: 'range', min: -2, max: 2, step: 0.01 },
      { path: 'antigravity.depthFactor', label: 'Depth Factor', type: 'range', min: 0, max: 5, step: 0.05 },
      { path: 'antigravity.opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01 },
      { path: 'antigravity.autoAnimate', label: 'Auto Animate (idle)', type: 'toggle' },
      // 'bracket' is the brand mark itself — the "[ ]" frame from the logo.
      // 'bracket-single' scatters lone brackets, randomly opening or closing.
      {
        path: 'antigravity.particleShape',
        label: 'Shape',
        type: 'select',
        options: ['capsule', 'sphere', 'box', 'tetrahedron', 'bracket', 'bracket-single'],
      },
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

/** Named starting points. Each is a partial config, deep-merged over DEFAULTS. */
export const PRESETS = {
  'Signal (default)': {},
  'Deep Space': {
    background: { bg: BRAND.black, bgDeep: BRAND.black },
    antigravity: { count: 900, particleShape: 'sphere', particleSize: 1.1, ringRadius: 9, rotationSpeed: 0.12 },
    effects: { vignette: 0.7, glow: 0.45 },
  },
  'Blueprint': {
    background: { bg: BRAND.blue, bgDeep: '#04234A' },
    antigravity: { color: BRAND.blueLight, particleShape: 'box', count: 400 },
  },
  'Daylight': {
    background: { bg: BRAND.mintLight, bgDeep: BRAND.white },
    antigravity: { color: BRAND.mintDeep, opacity: 0.75 },
    effects: { vignette: 0.12, glow: 0 },
  },
  'Overdrive': {
    antigravity: {
      count: 1400, particleSize: 2.4, waveAmplitude: 2.2, waveSpeed: 1.2,
      rotationSpeed: 0.4, lerpSpeed: 0.12, magnetRadius: 20, ringRadius: 9,
    },
    effects: { glow: 0.7, vignette: 0.5 },
  },
  'Still (reduced motion)': {
    antigravity: { autoAnimate: false, waveSpeed: 0, waveAmplitude: 0, rotationSpeed: 0, pulseSpeed: 0, lerpSpeed: 0.08 },
  },
};
