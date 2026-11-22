// Load macOS / iOS text replacements from a .plist file.
//
// Files can arrive three ways:
//   1. Dropped on the installed app's Dock icon (manifest "file_handlers" + launchQueue;
//      supported by Chromium-installed web apps, not yet by Safari).
//   2. Dragged onto the open window.
//   3. Picked with the "Choose .plist…" button.
(() => {
  const STORE = 'duck-text-replacements';
  const $ = id => document.getElementById(id);
  const fileInput = $('tr-file'), status = $('tr-status'), search = $('tr-search');
  const table = $('tr-table'), tbody = table.querySelector('tbody'), clearBtn = $('tr-clear');
  let entries = [];

  // ---------- plist parsing ----------

  function parseXmlPlist(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Not valid XML.');
    const root = doc.querySelector('plist > *');
    if (!root) throw new Error('No <plist> content found.');
    const read = el => {
      switch (el.tagName) {
        case 'dict': {
          const o = {}, kids = [...el.children];
          for (let i = 0; i < kids.length; i += 2) o[kids[i].textContent] = read(kids[i + 1]);
          return o;
        }
        case 'array': return [...el.children].map(read);
        case 'string': return el.textContent;
        case 'integer': return parseInt(el.textContent, 10);
        case 'real': return parseFloat(el.textContent);
        case 'true': return true;
        case 'false': return false;
        case 'date': return new Date(el.textContent);
        case 'data': return el.textContent.replace(/\s+/g, '');
        default: return null;
      }
    };
    return read(root);
  }

  function parseBinaryPlist(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), len = buf.byteLength;
    const t = len - 32;
    const offSize = u8[t + 6], refSize = u8[t + 7];
    const numObjects = Number(dv.getBigUint64(t + 8));
    const topObject = Number(dv.getBigUint64(t + 16));
    const tableOffset = Number(dv.getBigUint64(t + 24));
    const uint = (pos, size) => { let v = 0; for (let i = 0; i < size; i++) v = v * 256 + u8[pos + i]; return v; };
    const offsets = [];
    for (let i = 0; i < numObjects; i++) offsets.push(uint(tableOffset + i * offSize, offSize));

    const readObj = idx => {
      let pos = offsets[idx];
      const marker = u8[pos], type = marker >> 4, info = marker & 0xf;
      const length = () => {
        if (info !== 0xf) { pos += 1; return info; }
        const sz = 1 << (u8[pos + 1] & 0xf);
        const n = uint(pos + 2, sz); pos += 2 + sz; return n;
      };
      switch (type) {
        case 0x0: return info === 0x8 ? false : info === 0x9 ? true : null;
        case 0x1: return uint(pos + 1, 1 << info);
        case 0x2: return info === 2 ? dv.getFloat32(pos + 1) : dv.getFloat64(pos + 1);
        case 0x3: return new Date((978307200 + dv.getFloat64(pos + 1)) * 1000);
        case 0x4: { const n = length(); return btoa(String.fromCharCode(...u8.subarray(pos, pos + n))); }
        case 0x5: { const n = length(); return String.fromCharCode(...u8.subarray(pos, pos + n)); }
        case 0x6: {
          const n = length(); let s = '';
          for (let i = 0; i < n; i++) s += String.fromCharCode(dv.getUint16(pos + i * 2));
          return s;
        }
        case 0x8: return uint(pos + 1, info + 1);
        case 0xa: {
          const n = length(), out = [];
          for (let i = 0; i < n; i++) out.push(readObj(uint(pos + i * refSize, refSize)));
          return out;
        }
        case 0xd: {
          const n = length(), o = {};
          for (let i = 0; i < n; i++) {
            const k = readObj(uint(pos + i * refSize, refSize));
            o[k] = readObj(uint(pos + (n + i) * refSize, refSize));
          }
          return o;
        }
        default: return null;
      }
    };
    return readObj(topObject);
  }

  function parsePlist(buf) {
    const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(8, buf.byteLength)));
    if (head.startsWith('bplist0')) return parseBinaryPlist(buf);
    return parseXmlPlist(new TextDecoder().decode(buf));
  }

  // Text replacement exports are an array of { shortcut, phrase } dicts.
  function extractReplacements(value) {
    const found = [];
    const walk = v => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        if (typeof v.shortcut === 'string' && typeof v.phrase === 'string') {
          found.push({ shortcut: v.shortcut, phrase: v.phrase });
        } else Object.values(v).forEach(walk);
      }
    };
    walk(value);
    return found;
  }

  // ---------- UI ----------

  function setStatus(msg, isErr) {
    status.textContent = msg;
    status.classList.toggle('err', !!isErr);
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    tbody.replaceChildren(...entries
      .filter(e => !q || e.shortcut.toLowerCase().includes(q) || e.phrase.toLowerCase().includes(q))
      .map(e => {
        const tr = document.createElement('tr');
        tr.title = 'Click to copy the phrase';
        const a = document.createElement('td'), code = document.createElement('code');
        code.textContent = e.shortcut; a.append(code);
        const b = document.createElement('td'); b.textContent = e.phrase;
        tr.append(a, b);
        tr.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(e.phrase); setStatus(`Copied “${e.shortcut}” phrase.`); }
          catch { setStatus('Copy not allowed here.', true); }
        });
        return tr;
      }));
    const has = entries.length > 0;
    table.hidden = search.hidden = clearBtn.hidden = !has;
  }

  function show(list, source) {
    entries = list.sort((x, y) => x.shortcut.localeCompare(y.shortcut));
    search.value = '';
    render();
    try { localStorage.setItem(STORE, JSON.stringify(entries)); } catch {}
    if (source) setStatus(`Loaded ${entries.length} replacement${entries.length === 1 ? '' : 's'} from ${source}.`);
  }

  async function loadFile(file) {
    if (!file) return;
    try {
      const list = extractReplacements(parsePlist(await file.arrayBuffer()));
      if (!list.length) throw new Error('No text replacements (shortcut/phrase pairs) found in this plist.');
      show(list, file.name);
    } catch (err) {
      setStatus(`Couldn't read ${file.name}: ${err.message}`, true);
    }
  }

  // Restore the last loaded set.
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || '[]');
    if (saved.length) { show(saved); setStatus(`${saved.length} saved replacements.`); }
  } catch {}

  // 3. File picker
  $('tr-pick').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { loadFile(fileInput.files[0]); fileInput.value = ''; });
  search.addEventListener('input', render);
  clearBtn.addEventListener('click', () => {
    entries = []; render(); setStatus('');
    try { localStorage.removeItem(STORE); } catch {}
  });

  // 2. Drag and drop onto the window
  let depth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  addEventListener('dragenter', e => { if (hasFiles(e)) { depth++; document.body.classList.add('dragging'); } });
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('dragging'); } });
  addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  addEventListener('drop', e => {
    e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
    loadFile(e.dataTransfer.files[0]);
  });

  // 1. Dropped on the Dock / app icon (File Handling API)
  if ('launchQueue' in window) {
    launchQueue.setConsumer(async params => {
      for (const handle of params.files || []) loadFile(await handle.getFile());
    });
  }
})();
