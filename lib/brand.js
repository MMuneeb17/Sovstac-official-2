/**
 * Sovstac brand constants + shared config helpers.
 *
 * Palette values come from the official Brand Guidelines (slide 20).
 * Every preview's config module imports from here, so the palette is defined once.
 */

export const BRAND = {
  // Primary
  mint: '#08E1AC',
  mintDeep: '#00251C',
  mintLight: '#DFFFE8',
  // Blue
  blue: '#08458C',
  blueLight: '#B0CFF3',
  // Red / alert
  red: '#99120B',
  redLight: '#FAD3D1',
  // Neutrals
  black: '#000000',
  grayDark: '#2B2B2B',
  grayMid: '#808080',
  grayLight: '#E8E8E8',
  white: '#FFFFFF',
};

/** Offered as quick-swatches under every colour control in the panel. */
export const BRAND_SWATCHES = [
  BRAND.mint, BRAND.mintDeep, BRAND.mintLight,
  BRAND.blue, BRAND.blueLight,
  BRAND.red, BRAND.redLight,
  BRAND.black, BRAND.grayDark, BRAND.grayMid, BRAND.grayLight, BRAND.white,
];

/** Brand typefaces. Michroma is titles-only — it is very wide, so keep titles short. */
export const FONTS = {
  title: 'Michroma',
  body: 'Ubuntu',
  mono: 'Ubuntu Mono',
};

/* ---------- config helpers ---------- */

export const clone = o => JSON.parse(JSON.stringify(o));

export function deepMerge(base, patch) {
  const out = clone(base);
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(out[k] || {}, v) : v;
  }
  return out;
}

export const getPath = (o, p) =>
  p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

export function setPath(o, p, v) {
  const keys = p.split('.');
  const last = keys.pop();
  keys.reduce((a, k) => (a[k] = a[k] || {}), o)[last] = v;
  return o;
}
