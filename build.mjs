/**
 * Build the previews into fully standalone HTML files.
 *
 * WHY: previews/*.html must open by double-clicking, from anywhere — a Slack DM,
 * a USB stick, a folder on a client's desktop. On a file:// page a browser fetches
 * relative module imports with origin "null" and CORS blocks them, so `import
 * '../lib/x.js'` yields a blank page with no control panel. Nor can we lean on a
 * CDN: three ships no UMD build any more, and a CDN means the file dies offline.
 *
 * SO: this inlines EVERYTHING — the lib modules, three, gsap, and the fonts as
 * base64 — into a single file that makes zero network requests. lib/ stays the
 * source of truth (it's what the Next.js port will be built from); previews/ is
 * generated output.
 *
 *   templates/*.html  +  lib/*.js  +  vendor/  ->  previews/*.html
 *
 * Run:  node build.mjs
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const LIB = join(ROOT, 'lib');
const TEMPLATES = join(ROOT, 'templates');
const OUT = join(ROOT, 'previews');
const VENDOR = join(ROOT, 'vendor');

const VENDOR_FILES = {
  // three ships ESM only, split across two chunks: `module` imports from `core`.
  'three.core.min.js': 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.core.min.js',
  'three.module.min.js': 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js',
  'gsap.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js',
};

/** Fonts we embed. Michroma is non-negotiable: the logo reveal measures its glyphs. */
const FONTS = [
  { family: 'Michroma', weight: 400, css: 'Michroma' },
  { family: 'Ubuntu Mono', weight: 400, css: 'Ubuntu+Mono' },
  { family: 'Ubuntu Mono', weight: 700, css: 'Ubuntu+Mono:wght@700' },
  { family: 'Ubuntu', weight: 300, css: 'Ubuntu:wght@300' },
  { family: 'Ubuntu', weight: 400, css: 'Ubuntu:wght@400' },
  { family: 'Ubuntu', weight: 700, css: 'Ubuntu:wght@700' },
];

// A modern UA makes Google Fonts serve woff2 rather than legacy formats.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function cached(name, url, opts) {
  const path = join(VENDOR, name);
  if (existsSync(path)) return readFile(path);
  process.stdout.write(`  fetching ${name}… `);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buf);
  console.log(`${(buf.length / 1024).toFixed(0)}kb`);
  return buf;
}

/** Build the @font-face CSS with every font embedded as a data: URI. */
async function buildFontCss() {
  const faces = [];
  for (const f of FONTS) {
    const name = `${f.family.replace(/\s+/g, '-')}-${f.weight}.woff2`;
    const cssPath = join(VENDOR, `${name}.css`);

    let woff2Url;
    if (existsSync(cssPath)) {
      woff2Url = (await readFile(cssPath, 'utf8')).trim();
    } else {
      const css = await (
        await fetch(`https://fonts.googleapis.com/css2?family=${f.css}&display=swap`, {
          headers: { 'User-Agent': UA },
        })
      ).text();
      // Take the last src url — that's the latin subset in Google's ordering.
      const urls = [...css.matchAll(/url\((https:[^)]+\.woff2)\)/g)].map(m => m[1]);
      woff2Url = urls[urls.length - 1];
      if (!woff2Url) throw new Error(`no woff2 found for ${f.family} ${f.weight}`);
      await writeFile(cssPath, woff2Url);
    }

    const buf = await cached(name, woff2Url);
    faces.push(
      `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:swap;` +
        `src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');}`
    );
  }
  return faces.join('\n');
}

const splitClause = c => c.split(',').map(s => s.trim()).filter(Boolean);

/** `export{ st as ACESFilmicToneMapping }` -> `ACESFilmicToneMapping:st` (public:local) */
const exportPairs = c =>
  splitClause(c).map(s => {
    const p = s.split(/\s+as\s+/);
    return p.length === 2 ? `${p[1].trim()}:${p[0].trim()}` : s;
  });

/** `import{ Matrix3 as e }` -> `Matrix3:e` (destructuring key is the public name) */
const importPairs = c =>
  splitClause(c).map(s => {
    const p = s.split(/\s+as\s+/);
    return p.length === 2 ? `${p[0].trim()}:${p[1].trim()}` : s;
  });

const lastMatch = (src, re) => [...src.matchAll(re)].pop();

/**
 * Build a self-contained `THREE` namespace from three's two ESM chunks.
 *
 * three is ESM-only (no UMD since r160) and split in two: `three.module` imports
 * from `three.core`. The chunks are minified INDEPENDENTLY, so both use short
 * top-level names (e, t, n…) — concatenating them into one scope would collide.
 *
 * So each chunk gets its own IIFE scope. core returns its exports as an object;
 * module destructures those in and returns its own. THREE is the merge.
 */
function buildThreeNamespace(core, mod) {
  const coreExp = lastMatch(core, /export\s*\{([^}]*)\}\s*;?/g);
  if (!coreExp) throw new Error('three.core: no export clause');
  const coreBody = core.slice(0, coreExp.index) + core.slice(coreExp.index + coreExp[0].length);

  const modImp = mod.match(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*['"]\s*;?/);
  if (!modImp) throw new Error('three.module: no import clause');

  // three.module contains THREE statements, and the middle one is the trap: a
  // RE-EXPORT (`export{...}from"./three.core.min.js"`) that forwards core's names.
  // Matching a bare /export\{...\}/ hits that clause and slices out only its
  // `export{...}` half, orphaning the `from"..."` tail into a syntax error. So
  // strip re-exports wholesale FIRST — core's names are merged in anyway — and
  // only then look for the module's own export clause.
  let modBody = mod
    .replace(modImp[0], '')
    .replace(/export\s*\{[^}]*\}\s*from\s*['"][^'"]*['"]\s*;?/g, '');

  const modExp = lastMatch(modBody, /export\s*\{([^}]*)\}\s*;?/g);
  if (!modExp) throw new Error('three.module: no export clause');
  modBody = modBody.slice(0, modExp.index) + modBody.slice(modExp.index + modExp[0].length);

  return `
const __threeCore = (() => {
${coreBody}
return {${exportPairs(coreExp[1]).join(',')}};
})();
const __threeMod = ((__c) => {
const {${importPairs(modImp[1]).join(',')}} = __c;
${modBody}
return {${exportPairs(modExp[1]).join(',')}};
})(__threeCore);
const THREE = { ...__threeCore, ...__threeMod };
`;
}

/** Strip ESM syntax from a lib module so it can be concatenated into one scope. */
function stripModule(src) {
  const aliases = [];

  const out = src.replace(
    /^\s*import\s+([^'"]+?)\s+from\s*['"][^'"]+['"]\s*;?\s*$/gm,
    (_, clause) => {
      clause = clause.trim();

      // `import * as THREE from 'three'` / `import gsap from 'gsap'` — the inlined
      // vendor already provides these names, so the import just disappears.
      if (clause.startsWith('*') || !clause.startsWith('{')) return '';

      // `import { WORDMARK as W } from ...` — after inlining, W doesn't exist, so
      // re-create the alias as a local const.
      for (const part of clause.replace(/[{}]/g, '').split(',')) {
        const [orig, alias] = part.split(/\s+as\s+/).map(s => s.trim());
        if (alias && alias !== orig) aliases.push(`const ${alias} = ${orig};`);
      }
      return '';
    }
  );

  return (
    out
      // `export const X` -> `const X`, `export function f` -> `function f`
      .replace(/^\s*export\s+(const|let|var|function|class)\s/gm, '$1 ')
      .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '') + '\n' + aliases.join('\n')
  );
}

/** Follow a module's imports depth-first so dependencies land before dependents. */
async function collectLibs(entryNames, seen = new Set(), order = []) {
  for (const name of entryNames) {
    if (seen.has(name)) continue;
    seen.add(name);

    const src = await readFile(join(LIB, name), 'utf8');
    const deps = [...src.matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)].map(m => m[1]);

    await collectLibs(deps, seen, order);
    order.push({ name, src });
  }
  return order;
}

async function buildPage(file, { fontCss, threeNs, gsap }) {
  let html = await readFile(join(TEMPLATES, file), 'utf8');

  const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    // index.html has no script — just embed the fonts and copy it through.
    html = html
      .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
      .replace(/<link[^>]+fonts\.googleapis[^>]*>\s*/g, '')
      .replace('</style>', () => `</style>\n<style>${fontCss}</style>`);
    await writeFile(join(OUT, file), html);
    return { file, bytes: Buffer.byteLength(html) };
  }

  const pageScript = scriptMatch[1];
  const entries = [...pageScript.matchAll(/from\s*['"]\.\.\/lib\/([^'"]+)['"]/g)].map(m => m[1]);
  const libs = await collectLibs(entries);

  const usesThree = libs.some(l => /from\s*['"]three['"]/.test(l.src));
  const usesGsap =
    libs.some(l => /from\s*['"]gsap['"]/.test(l.src)) || /from\s*['"]gsap['"]/.test(pageScript);

  const bundle = [
    usesThree ? threeNs : '',
    ...libs.map(l => `\n/* ===== lib/${l.name} ===== */\n${stripModule(l.src)}`),
    `\n/* ===== page ===== */\n${stripModule(pageScript)}`,
  ].join('\n');

  // gsap is a classic UMD script, so it goes in its own tag and lands on window.
  const gsapTag = usesGsap ? `<script>${gsap}</script>\n` : '';
  const gsapShim = usesGsap ? 'const gsap = window.gsap;\n' : '';

  // NOTE: every injection below uses a REPLACER FUNCTION, never a string. In
  // String.replace a string replacement treats `$&`, `$'`, `` $` `` as special —
  // and minified three is full of `$` sequences, which silently corrupts the
  // bundle into a syntax error. A function replacement does no substitution.
  html = html
    // No importmap, no CDN, no Google Fonts link. Zero network requests.
    .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
    .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
    .replace(/<link[^>]+fonts\.googleapis[^>]*>\s*/g, '')
    .replace('</style>', () => `</style>\n<style>${fontCss}</style>`)
    .replace(
      /<script type="module">[\s\S]*?<\/script>/,
      () => `${gsapTag}<script type="module">\n${gsapShim}${bundle}\n</script>`
    )
    .replace(
      '<head>',
      () => '<head>\n<!-- GENERATED by build.mjs — do not edit. Edit templates/ + lib/, then: node build.mjs -->'
    );

  await writeFile(join(OUT, file), html);
  return { file, bytes: Buffer.byteLength(html) };
}

/* ---------------- run ---------------- */

await mkdir(VENDOR, { recursive: true });
await mkdir(OUT, { recursive: true });

console.log('vendor:');
const threeCore = (await cached('three.core.min.js', VENDOR_FILES['three.core.min.js'])).toString('utf8');
const threeMod = (await cached('three.module.min.js', VENDOR_FILES['three.module.min.js'])).toString('utf8');
const gsap = (await cached('gsap.min.js', VENDOR_FILES['gsap.min.js'])).toString('utf8');
const threeNs = buildThreeNamespace(threeCore, threeMod);

console.log('fonts:');
const fontCss = await buildFontCss();

console.log('pages:');
const files = (await readdir(TEMPLATES)).filter(f => f.endsWith('.html'));
for (const f of files) {
  const r = await buildPage(f, { fontCss, threeNs, gsap });
  console.log(`  previews/${r.file}  ${(r.bytes / 1024).toFixed(0)}kb  (standalone, 0 requests)`);
}
console.log('\ndone — previews/*.html open straight from the filesystem.');
