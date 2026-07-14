/**
 * Sovstac control panel.
 *
 * Schema-driven: it reads SCHEMA from config.js and builds a control for every
 * entry, so adding a knob to the config automatically adds it here.
 *
 * Save model — two separate states:
 *
 *   config   what you see right now. Every slider move updates this and repaints
 *            the preview immediately, but touches nothing on disk.
 *   applied  what was last SAVED. Only "Apply & Save" copies config -> applied
 *            and writes it to localStorage.
 *
 * So you can explore freely and only commit what you actually want. The panel
 * shows "● unsaved changes" whenever the two differ, Revert throws away the
 * exploration and returns to the last saved state, and Reset goes back to the
 * brand defaults.
 *
 * Press "C" to hide/show the panel (for clean screenshots).
 */

import { BRAND_SWATCHES, clone, deepMerge, getPath, setPath } from './brand.js';

const CSS = `
.sv-panel {
  --p-bg: #0B0F0E;
  --p-surface: #141A18;
  --p-border: #24302C;
  --p-text: #DFFFE8;
  --p-muted: #7C918A;
  --p-accent: #08E1AC;
  --p-warn: #FFD166;
  position: fixed; top: 0; right: 0; z-index: 9999;
  width: 336px; height: 100vh;
  display: flex; flex-direction: column;
  background: var(--p-bg);
  border-left: 1px solid var(--p-border);
  color: var(--p-text);
  font-family: "Ubuntu Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  box-shadow: -20px 0 60px rgba(0,0,0,.45);
  transition: transform .32s cubic-bezier(.16,1,.3,1);
}
.sv-panel[data-hidden="true"] { transform: translateX(100%); }

.sv-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--p-border); flex: 0 0 auto;
}
.sv-title { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--p-accent); }
.sv-sub { font-size: 10px; color: var(--p-muted); margin-top: 3px; }
.sv-close {
  background: none; border: 1px solid var(--p-border); color: var(--p-muted);
  width: 26px; height: 26px; border-radius: 4px; cursor: pointer; line-height: 1;
}
.sv-close:hover { color: var(--p-accent); border-color: var(--p-accent); }

.sv-body { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; }
.sv-body::-webkit-scrollbar { width: 8px; }
.sv-body::-webkit-scrollbar-thumb { background: var(--p-border); border-radius: 4px; }

.sv-presets { padding: 12px 16px; border-bottom: 1px solid var(--p-border); display: grid; gap: 8px; }
.sv-presets label { font-size: 10px; color: var(--p-muted); text-transform: uppercase; letter-spacing: 1px; }
.sv-presets select {
  width: 100%; background: var(--p-surface); color: var(--p-text);
  border: 1px solid var(--p-border); border-radius: 4px; padding: 7px 8px;
  font-family: inherit; font-size: 12px; cursor: pointer;
}

.sv-group { border-bottom: 1px solid var(--p-border); }
.sv-group-head {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 11px 16px; background: none; border: none; cursor: pointer;
  color: var(--p-text); font-family: inherit; font-size: 11px;
  letter-spacing: 1.2px; text-transform: uppercase; text-align: left;
}
.sv-group-head:hover { background: var(--p-surface); }
.sv-group-head .sv-icon { color: var(--p-accent); width: 16px; }
.sv-group-head .sv-caret { margin-left: auto; color: var(--p-muted); transition: transform .2s; }
.sv-group[data-open="false"] .sv-caret { transform: rotate(-90deg); }
.sv-group[data-open="false"] .sv-group-body { display: none; }
.sv-group-body { padding: 4px 16px 14px; display: grid; gap: 11px; }

.sv-ctrl { display: grid; gap: 5px; }
.sv-ctrl-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sv-ctrl-label { color: var(--p-muted); font-size: 11px; }
.sv-ctrl-value { color: var(--p-accent); font-size: 11px; font-variant-numeric: tabular-nums; }

.sv-ctrl input[type="range"] {
  -webkit-appearance: none; appearance: none; width: 100%; height: 3px;
  background: var(--p-border); border-radius: 2px; outline: none; cursor: pointer;
}
.sv-ctrl input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 13px; height: 13px;
  border-radius: 50%; background: var(--p-accent); cursor: pointer;
  border: 2px solid var(--p-bg); box-shadow: 0 0 0 1px var(--p-accent);
}
.sv-ctrl input[type="text"], .sv-ctrl textarea, .sv-ctrl select {
  width: 100%; background: var(--p-surface); color: var(--p-text);
  border: 1px solid var(--p-border); border-radius: 4px; padding: 7px 8px;
  font-family: inherit; font-size: 12px; resize: vertical;
}
.sv-ctrl textarea { min-height: 62px; line-height: 1.5; }
.sv-ctrl input:focus, .sv-ctrl textarea:focus, .sv-ctrl select:focus {
  outline: none; border-color: var(--p-accent);
}

.sv-color { display: flex; align-items: center; gap: 8px; }
.sv-color input[type="color"] {
  -webkit-appearance: none; appearance: none;
  width: 30px; height: 26px; padding: 0; border: 1px solid var(--p-border);
  border-radius: 4px; background: none; cursor: pointer; flex: 0 0 auto;
}
.sv-color input[type="color"]::-webkit-color-swatch-wrapper { padding: 2px; }
.sv-color input[type="color"]::-webkit-color-swatch { border: none; border-radius: 2px; }
.sv-color input[type="text"] { flex: 1 1 auto; text-transform: uppercase; }

.sv-swatches { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.sv-swatch { width: 16px; height: 16px; border-radius: 3px; cursor: pointer; border: 1px solid rgba(255,255,255,.18); }
.sv-swatch:hover { transform: scale(1.15); }

.sv-toggle { display: flex; align-items: center; justify-content: space-between; }
.sv-switch {
  position: relative; width: 34px; height: 18px; border-radius: 9px;
  background: var(--p-border); border: none; cursor: pointer; transition: background .2s; flex: 0 0 auto;
}
.sv-switch::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%; background: var(--p-muted); transition: all .2s;
}
.sv-switch[data-on="true"] { background: rgba(8,225,172,.25); }
.sv-switch[data-on="true"]::after { left: 18px; background: var(--p-accent); }

.sv-foot {
  flex: 0 0 auto; padding: 12px 16px; border-top: 1px solid var(--p-border);
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.sv-btn {
  padding: 10px 8px; border-radius: 4px; cursor: pointer;
  font-family: inherit; font-size: 11px; letter-spacing: .6px; text-transform: uppercase;
  background: var(--p-surface); color: var(--p-text); border: 1px solid var(--p-border);
}
.sv-btn:hover { border-color: var(--p-accent); color: var(--p-accent); }
.sv-btn--wide { grid-column: 1 / -1; }
.sv-btn--apply {
  background: var(--p-accent); color: #00251C; border-color: var(--p-accent);
  font-weight: 700; letter-spacing: 1px; padding: 12px 8px;
}
.sv-btn--apply:hover { color: #00251C; filter: brightness(1.12); }
/* Dimmed when there is nothing to save. */
.sv-btn--apply[data-dirty="false"] { opacity: .38; cursor: default; filter: none; }

.sv-dirty {
  grid-column: 1 / -1; min-height: 13px; text-align: center;
  font-size: 10px; letter-spacing: .5px; color: var(--p-warn);
}

.sv-fab {
  position: fixed; top: 16px; right: 16px; z-index: 9998;
  width: 40px; height: 40px; border-radius: 8px; cursor: pointer;
  background: #0B0F0E; color: #08E1AC; border: 1px solid #24302C;
  font-size: 16px; display: none; place-items: center;
}
.sv-fab[data-show="true"] { display: grid; }
.sv-fab:hover { border-color: #08E1AC; }

.sv-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
  z-index: 10000; padding: 10px 18px; border-radius: 6px;
  background: #08E1AC; color: #00251C; font-family: "Ubuntu Mono", monospace;
  font-size: 12px; font-weight: 700; letter-spacing: .5px;
  opacity: 0; pointer-events: none; transition: all .25s cubic-bezier(.16,1,.3,1);
}
.sv-toast[data-show="true"] { opacity: 1; transform: translateX(-50%) translateY(0); }
`;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * @param {object}   o
 * @param {object}   o.defaults    the config object this preview starts from
 * @param {Array}    o.schema      control descriptors (groups of controls)
 * @param {object}   [o.presets]   named partial configs, deep-merged over defaults
 * @param {string}   o.storageKey  localStorage key for the saved config
 * @param {function} o.onChange    called with the live config on every edit
 * @param {string}   [o.subtitle]  small text under the panel title
 * @param {string}   [o.exportName] filename for Export JSON
 * @param {Array}    [o.actions]   extra footer buttons: [{ label, onClick }]
 */
export function createControlPanel({
  defaults: DEFAULTS,
  schema: SCHEMA,
  presets: PRESETS = {},
  storageKey,
  onChange,
  subtitle = '',
  exportName = 'sovstac.config.json',
  actions = [],
}) {
  const style = el('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // `applied` = last saved. `config` = live, possibly unsaved.
  let applied = clone(DEFAULTS);
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) applied = deepMerge(DEFAULTS, JSON.parse(saved));
  } catch {
    /* corrupt storage — fall back to brand defaults */
  }
  let config = clone(applied);

  const panel = el('div', 'sv-panel');
  const fab = el('button', 'sv-fab', '☰');
  const toast = el('div', 'sv-toast');

  /* header */
  const head = el('div', 'sv-head');
  const titleWrap = el('div');
  titleWrap.appendChild(el('div', 'sv-title', 'Sovstac Control'));
  titleWrap.appendChild(el('div', 'sv-sub', subtitle));
  const closeBtn = el('button', 'sv-close', '✕');
  head.append(titleWrap, closeBtn);

  const body = el('div', 'sv-body');
  const foot = el('div', 'sv-foot');

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.dataset.show = 'true';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.dataset.show = 'false'), 1800);
  }

  const isDirty = () => JSON.stringify(config) !== JSON.stringify(applied);

  const dirtyNote = el('div', 'sv-dirty');
  const applyBtn = el('button', 'sv-btn sv-btn--apply sv-btn--wide', 'Apply & Save');

  function refreshDirty() {
    const dirty = isDirty();
    applyBtn.dataset.dirty = String(dirty);
    dirtyNote.textContent = dirty ? '● unsaved changes' : '';
  }

  /** Live preview only — nothing is persisted until Apply. */
  function commit() {
    onChange(config);
    refreshDirty();
  }

  applyBtn.onclick = () => {
    if (!isDirty()) return;
    applied = clone(config);
    try {
      localStorage.setItem(storageKey, JSON.stringify(applied));
      showToast('Applied & saved');
    } catch {
      showToast('Applied (storage unavailable)');
    }
    refreshDirty();
  };

  const exportBtn = el('button', 'sv-btn', 'Export JSON');
  exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportName;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`Exported ${exportName}`);
  };

  const revertBtn = el('button', 'sv-btn', 'Revert');
  revertBtn.onclick = () => {
    config = clone(applied);
    rebuild();
    commit();
    showToast('Reverted to last saved');
  };

  const resetBtn = el('button', 'sv-btn sv-btn--wide', 'Reset to brand defaults');
  resetBtn.onclick = () => {
    config = clone(DEFAULTS);
    applied = clone(DEFAULTS);
    localStorage.removeItem(storageKey);
    rebuild();
    commit();
    showToast('Reset to brand defaults');
  };

  /* presets — only shown if this preview defines any */
  if (Object.keys(PRESETS).length) {
    const presets = el('div', 'sv-presets');
    presets.appendChild(el('label', null, 'Preset'));
    const presetSel = el('select');
    Object.keys(PRESETS).forEach(k => presetSel.appendChild(new Option(k, k)));
    presetSel.onchange = () => {
      config = deepMerge(DEFAULTS, PRESETS[presetSel.value]);
      rebuild();
      commit();
      showToast(`${presetSel.value} — press Apply to save`);
    };
    presets.appendChild(presetSel);
    body.appendChild(presets);
  }

  const groupsWrap = el('div');
  body.appendChild(groupsWrap);

  const openState = {};

  function buildControl(c) {
    const wrap = el('div', 'sv-ctrl');
    const value = getPath(config, c.path);

    if (c.type === 'toggle') {
      const row = el('div', 'sv-toggle');
      row.appendChild(el('span', 'sv-ctrl-label', c.label));
      const sw = el('button', 'sv-switch');
      sw.dataset.on = String(!!value);
      sw.onclick = () => {
        const next = !getPath(config, c.path);
        setPath(config, c.path, next);
        sw.dataset.on = String(next);
        commit();
      };
      row.appendChild(sw);
      wrap.appendChild(row);
      return wrap;
    }

    const top = el('div', 'sv-ctrl-top');
    top.appendChild(el('span', 'sv-ctrl-label', c.label));
    const valOut = el('span', 'sv-ctrl-value');
    if (c.type === 'range') valOut.textContent = `${value}${c.unit || ''}`;
    top.appendChild(valOut);
    wrap.appendChild(top);

    if (c.type === 'range') {
      const input = el('input');
      input.type = 'range';
      input.min = c.min; input.max = c.max; input.step = c.step; input.value = value;
      input.oninput = () => {
        const n = parseFloat(input.value);
        setPath(config, c.path, n);
        valOut.textContent = `${n}${c.unit || ''}`;
        commit();
      };
      wrap.appendChild(input);
    } else if (c.type === 'color') {
      const row = el('div', 'sv-color');
      const picker = el('input');
      picker.type = 'color';
      picker.value = value;
      const hex = el('input');
      hex.type = 'text';
      hex.value = value;

      const set = v => {
        setPath(config, c.path, v);
        picker.value = v;
        hex.value = v;
        commit();
      };
      picker.oninput = () => set(picker.value);
      hex.onchange = () => {
        // Only a full 6-digit hex is accepted; anything else snaps back.
        if (/^#[0-9a-f]{6}$/i.test(hex.value.trim())) set(hex.value.trim());
        else hex.value = getPath(config, c.path);
      };

      row.append(picker, hex);
      wrap.appendChild(row);

      const sw = el('div', 'sv-swatches');
      BRAND_SWATCHES.forEach(s => {
        const b = el('button', 'sv-swatch');
        b.style.background = s;
        b.title = s;
        b.onclick = () => set(s);
        sw.appendChild(b);
      });
      wrap.appendChild(sw);
    } else if (c.type === 'select') {
      const sel = el('select');
      c.options.forEach(o => sel.appendChild(new Option(o, o)));
      sel.value = value;
      sel.onchange = () => {
        setPath(config, c.path, sel.value);
        commit();
      };
      wrap.appendChild(sel);
    } else if (c.type === 'textarea') {
      const ta = el('textarea');
      ta.value = value;
      ta.oninput = () => {
        setPath(config, c.path, ta.value);
        commit();
      };
      wrap.appendChild(ta);
    } else {
      const input = el('input');
      input.type = 'text';
      input.value = value;
      input.oninput = () => {
        setPath(config, c.path, input.value);
        commit();
      };
      wrap.appendChild(input);
    }

    return wrap;
  }

  function rebuild() {
    groupsWrap.innerHTML = '';
    SCHEMA.forEach((g, i) => {
      const group = el('div', 'sv-group');
      if (openState[g.group] === undefined) openState[g.group] = i < 2;
      group.dataset.open = String(openState[g.group]);

      const gh = el('button', 'sv-group-head');
      gh.appendChild(el('span', 'sv-icon', g.icon));
      gh.appendChild(el('span', null, g.group));
      gh.appendChild(el('span', 'sv-caret', '▾'));
      gh.onclick = () => {
        openState[g.group] = !openState[g.group];
        group.dataset.open = String(openState[g.group]);
      };

      const gb = el('div', 'sv-group-body');
      g.controls.forEach(c => gb.appendChild(buildControl(c)));

      group.append(gh, gb);
      groupsWrap.appendChild(group);
    });
  }

  // Preview-specific buttons (e.g. "Replay" on an animation) go above the save row.
  const actionBtns = actions.map(a => {
    const b = el('button', 'sv-btn sv-btn--wide', a.label);
    b.onclick = () => a.onClick(config);
    return b;
  });

  foot.append(...actionBtns, dirtyNote, applyBtn, exportBtn, revertBtn, resetBtn);
  panel.append(head, body, foot);
  document.body.append(panel, fab, toast);

  const setHidden = h => {
    panel.dataset.hidden = String(h);
    fab.dataset.show = String(h);
  };
  closeBtn.onclick = () => setHidden(true);
  fab.onclick = () => setHidden(false);

  window.addEventListener('keydown', e => {
    // Ignore the shortcut while typing into a field.
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    if (e.key === 'c' || e.key === 'C') setHidden(panel.dataset.hidden !== 'true');
  });

  // Don't let unsaved tuning vanish on a reload.
  window.addEventListener('beforeunload', e => {
    if (isDirty()) e.preventDefault();
  });

  rebuild();
  commit();

  return { getConfig: () => config, showToast };
}
