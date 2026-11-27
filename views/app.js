// Shared client helpers: escaping, pixel icons, the HUD menu, and the live store
// (poll every 1.5 s; operators save with an atomic revision check).
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICONS = {
    cursor: ['0 0 4 7', 'M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z'],
    lock: ['0 0 7 8', 'M2 0h3v1H2zM1 1h1v2H1zM5 1h1v2H5zM0 3h7v5H0z', 'M3 5h1v2H3z'],
    star: ['0 0 7 7', 'M3 0h1v2H3zM0 2h7v1H0zM1 3h5v1H1zM2 4h3v1H2zM1 5h2v1H1zM4 5h2v1H4zM0 6h2v1H0zM5 6h2v1H5z'],
    trophy: ['0 0 8 8', 'M1 0h6v4H1zM0 1h1v2H0zM7 1h1v2H7zM2 4h4v1H2zM3 5h2v1H3zM2 6h4v2H2z'],
    clock: ['0 0 7 7', 'M2 0h3v1H2zM1 1h1v1H1zM5 1h1v1H5zM0 2h1v3H0zM6 2h1v3H6zM1 5h1v1H1zM5 5h1v1H5zM2 6h3v1H2zM3 2h1v2H3zM4 3h1v1H4z'],
    skip: ['0 0 8 7', 'M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3zM4 0h1v7H4zM5 1h1v5H5zM6 2h1v3H6zM7 3h1v1H7z'],
    pencil: ['0 0 7 7', 'M5 0h1v1H5zM4 1h3v1H4zM3 2h3v1H3zM2 3h3v1H2zM1 4h3v1H1zM0 5h2v2H0zM2 5h1v1H2z'],
    expand: ['0 0 8 8', 'M0 0h3v1H0zM0 1h1v2H0zM5 0h3v1H5zM7 1h1v2H7zM0 5h1v2H0zM0 7h3v1H0zM7 5h1v2H7zM5 7h3v1H5z'],
    compress: ['0 0 8 8', 'M2 2h2v1H2zM2 2h1v2H2zM4 2h2v1H4zM5 2h1v2H5zM2 5h2v1H2zM2 4h1v2H2zM4 5h2v1H4zM5 4h1v2H5z'],
  };
  const icon = (n, cls = '') => {
    const [vb, d, hole] = ICONS[n];
    const [, , w, h] = vb.split(' ').map(Number);
    return `<svg class="ico ${cls}" viewBox="${vb}" width="${w}" height="${h}" style="aspect-ratio:${w} / ${h}" aria-hidden="true" focusable="false"><path d="${d}"/>${hole ? `<path d="${hole}" fill="#fff"/>` : ''}</svg>`;
  };
  const fmt = v => (v == null || v === '' || !isFinite(v) ? '--' : String(Math.round(v * 100) / 100));
  const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const ADMIN = window.__ADMIN__ === true;

  // HUD menu: highlight the current page and point links at the operator versions when logged in.
  // Moderators edit the speed board from the Speed track tab (the /admin/speed desk), the same way
  // the Bracket tab carries edit controls for them; logged-out students always get the /speed viewer.
  function hud(active) {
    const items = ADMIN
      ? [['desk', '/admin', 'Moderator desk'], ['|'], ['scores', '/', 'Live scores'], ['schedule', '/schedule', 'Bracket'], ['speed', '/admin/speed', 'Speed track']]
      : [['scores', '/', 'Live scores'], ['schedule', '/schedule', 'Bracket'], ['speed', '/speed', 'Speed track']];
    const nav = document.querySelector('.menu');
    if (nav) nav.innerHTML = items.map(([k, href, label]) => k === '|' ? '<span class="sep" aria-hidden="true"></span>' :
      `<a href="${href}"${k === active ? ' aria-current="page"' : ''}>${label}</a>`).join('');
    mountFullscreen();
  }

  // Fullscreen toggle for showcasing a board on a big screen. Uses the native
  // Fullscreen API (with the WebKit-prefixed fallback for older Safari).
  //
  // A full page load always drops fullscreen and can't silently re-enter, so
  // switching dashboards would normally kick you out. We remember a "present"
  // flag across pages (sessionStorage) and re-enter on the next page: silently
  // if the browser allows it, otherwise on the viewer's first click or keypress.
  const FS_KEY = 'im-present';
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fsSupported = () => { const e = document.documentElement; return !!(e.requestFullscreen || e.webkitRequestFullscreen || e.webkitRequestFullScreen); };
  const wantsFs = () => { try { return sessionStorage.getItem(FS_KEY) === '1'; } catch (e) { return false; } };
  const setWantsFs = on => { try { on ? sessionStorage.setItem(FS_KEY, '1') : sessionStorage.removeItem(FS_KEY); } catch (e) {} };
  const enterFs = () => { const e = document.documentElement; return (e.requestFullscreen || e.webkitRequestFullscreen || e.webkitRequestFullScreen).call(e); };
  const exitFs = () => (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  let navigating = false; // set while following a same-site link, so leaving fullscreen to navigate doesn't look like the viewer pressing Esc
  let reentryArmed = false;
  function toggleFullscreen() {
    try {
      if (fsElement()) { setWantsFs(false); exitFs(); }
      else { setWantsFs(true); enterFs(); }
    } catch (err) { /* a blocked request just leaves the page as it is */ }
  }
  function armReentry() {
    if (reentryArmed) return; reentryArmed = true;
    const go = () => { try { if (!fsElement() && wantsFs()) enterFs(); } catch (e) {} finally { cleanup(); } };
    const cleanup = () => { reentryArmed = false; document.removeEventListener('pointerdown', go, true); document.removeEventListener('keydown', go, true); };
    document.addEventListener('pointerdown', go, true);
    document.addEventListener('keydown', go, true);
  }
  function reenterIfWanted() {
    if (!fsSupported() || !wantsFs() || fsElement()) return;
    try {
      const p = enterFs();
      if (p && p.catch) p.catch(armReentry); // silent re-entry blocked (no gesture) → wait for the first interaction
      else if (!fsElement()) armReentry();
    } catch (e) { armReentry(); }
  }
  // Mark same-site link clicks as navigation so the fullscreen we drop on the way
  // out isn't mistaken for the viewer leaving presentation mode.
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a && a.origin === location.origin && !a.target) navigating = true;
  }, true);
  let fsKeyWired = false;
  function mountFullscreen() {
    const status = document.querySelector('.status');
    if (!status || !fsSupported() || status.querySelector('.fs-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn sm fs-btn';
    btn.innerHTML = icon('expand', 'ic-expand') + icon('compress', 'ic-compress') + '<span class="fs-label">Fullscreen</span>';
    btn.addEventListener('click', toggleFullscreen);
    status.appendChild(btn);
    // paint() only reflects the current state in the button; it must not touch the
    // presentation flag, or the initial call on load would wipe it before re-entry.
    const paint = () => {
      const on = !!fsElement();
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
      btn.title = on ? 'Exit fullscreen (F)' : 'Go fullscreen (F)';
      btn.querySelector('.fs-label').textContent = on ? 'Exit' : 'Fullscreen';
      document.body.classList.toggle('is-fs', on);
    };
    const onFsChange = () => {
      paint();
      // Leaving fullscreen in place (viewer pressed Esc / the OS exited) ends
      // presentation mode; leaving it to follow a tab link does not.
      if (!fsElement() && !navigating) setWantsFs(false);
    };
    paint();
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    // Press F to toggle on the public showcase screens — not while typing, and
    // not on the moderator desk where F is a normal keystroke in the score fields.
    if (!fsKeyWired && !ADMIN) {
      fsKeyWired = true;
      document.addEventListener('keydown', e => {
        if (e.key !== 'f' && e.key !== 'F') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target;
        if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
        e.preventDefault();
        toggleFullscreen();
      });
    }
    reenterIfWanted();
  }

  function setLive(ok, text) {
    const l = document.querySelector('.live');
    if (!l) return;
    l.classList.toggle('off', !ok);
    const t = l.querySelector('span');
    if (t) t.textContent = text || (ok ? 'Live' : 'Offline');
  }

  /**
   * createStore({ url, blank, onChange, onSheets }) — polling + CAS saves.
   * store.data is the working copy; call store.save() after changing it.
   */
  function createStore(opt) {
    const st = { rev: 0, data: opt.blank(), sv: null, sheets: null, dirty: false, inflight: false, hist: [], fut: [], timer: null, loaded: false };
    async function loadSheets() {
      const r = await fetch('/api/sheets', { cache: 'no-store' });
      st.sheets = await r.json();
      st.sv = st.sheets.sv;
      opt.onSheets && opt.onSheets(st.sheets);
    }
    function adopt(s) {
      st.rev = s.rev || 0;
      st.data = Object.assign(opt.blank(), s.data || {});
      st.loaded = true;
      if (s.sv && st.sv && s.sv !== st.sv) loadSheets().then(() => opt.onChange('sheets'));
      opt.onChange('remote');
    }
    async function flush() {
      if (st.inflight || !st.dirty) return;
      st.inflight = true; st.dirty = false;
      try {
        const r = await fetch(opt.url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rev: st.rev, data: st.data }) });
        if (r.status === 409) { adopt(await r.json()); opt.onConflict && opt.onConflict(); }
        else if (r.status === 401) { opt.onAuth && opt.onAuth(); }
        else if (!r.ok) throw new Error(r.status);
        else { st.rev = (await r.json()).rev; setLive(true); }
      } catch (e) { st.dirty = true; setLive(false, 'Not saved — retrying'); setTimeout(flush, 2000); }
      finally { st.inflight = false; if (st.dirty) flush(); }
    }
    // History of this browser's own changes. Each entry is the state before an action plus a label
    // describing the action, so Undo/Redo can say what they did. A new action clears the redo stack.
    st.snap = label => { st.hist.push({ s: JSON.stringify(st.data), label: label || 'last change' }); if (st.hist.length > 60) st.hist.shift(); st.fut = []; };
    st.undo = () => {
      const p = st.hist.pop(); if (!p) return null;
      st.fut.push({ s: JSON.stringify(st.data), label: p.label });
      st.data = JSON.parse(p.s); st.save(); opt.onChange('local'); return p.label;
    };
    st.redo = () => {
      const n = st.fut.pop(); if (!n) return null;
      st.hist.push({ s: JSON.stringify(st.data), label: n.label });
      st.data = JSON.parse(n.s); st.save(); opt.onChange('local'); return n.label;
    };
    st.peek = () => ({ undo: st.hist.length ? st.hist[st.hist.length - 1].label : null, redo: st.fut.length ? st.fut[st.fut.length - 1].label : null });
    st.save = () => { if (!ADMIN) return; st.dirty = true; clearTimeout(st.timer); st.timer = setTimeout(flush, 150); };
    st.start = async () => {
      try { await loadSheets(); } catch (e) { setLive(false, 'Could not load sheets'); }
      let busy = false;
      const tick = async () => {
        if (busy || document.hidden) return; busy = true;
        try {
          const r = await fetch(opt.url, { cache: 'no-store' });
          if (!r.ok) throw new Error(r.status);
          const s = await r.json(); setLive(true);
          if (ADMIN && (st.dirty || st.inflight)) return;
          if (st.loaded && (s.rev || 0) <= st.rev && !(s.sv && s.sv !== st.sv)) return;
          adopt(s);
        } catch (e) { setLive(false, 'Reconnecting'); }
        finally { busy = false; }
      };
      await tick();
      setInterval(tick, 1500);
      document.addEventListener('visibilitychange', tick);
    };
    return st;
  }

  window.UI = { $, esc, icon, fmt, hhmm, ADMIN, hud, setLive, createStore };
})();
