/* Oasis19 table extras: Campaign files (folders + documents) and Initiative. Needs tables.js (window.TblX). */
(function () {
'use strict';
var X = window.TblX;
if (!X) return;

var st = document.createElement('style');
st.textContent =
'.tx-wrap{padding:4px 0 24px}.tx-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}' +
'.tx-crumbs{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:14px;margin:8px 0}' +
'.tx-crumbs button{background:none;border:0;color:#5B2FBE;font:inherit;cursor:pointer;padding:4px 6px;border-radius:6px}' +
'.tx-crumbs button:hover{background:rgba(91,47,190,.1)}.tx-crumbs .cur{font-weight:700;padding:4px 6px}' +
'.tx-list{display:flex;flex-direction:column;gap:6px}' +
'.tx-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(124,85,217,.35);border-radius:12px;background:rgba(124,85,217,.08);cursor:pointer;min-height:44px}' +
'.tx-row:hover{background:rgba(124,85,217,.16)}.tx-ico{font-size:22px;width:28px;text-align:center;flex:none}' +
'.tx-main{flex:1;min-width:0}.tx-t{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tx-s{font-size:12px;opacity:.7}' +
'.tx-mini{background:none;border:1px solid rgba(124,85,217,.4);border-radius:8px;padding:6px 9px;cursor:pointer;color:inherit;font-size:14px;min-height:34px}' +
'.tx-empty{padding:22px;text-align:center;opacity:.75;border:1px dashed rgba(124,85,217,.4);border-radius:12px}' +
'.tx-body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;max-height:55vh;overflow:auto;margin:10px 0}' +
'.tx-modal-in{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(124,85,217,.5);font:inherit;margin:4px 0 10px;background:inherit;color:inherit}' +
'.tx-img{max-width:100%;border-radius:10px;margin:8px 0}' +
'.ini-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(124,85,217,.35);border-radius:12px;margin:6px 0;flex-wrap:wrap}' +
'.ini-row.now{background:rgba(255,211,107,.28);border-color:#E8620A;box-shadow:0 0 0 2px #E8620A inset}' +
'.ini-slot{width:34px;height:34px;border-radius:50%;background:#5B2FBE;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}' +
'.ini-slot.none{background:transparent;color:inherit;border:1px dashed rgba(124,85,217,.6);opacity:.7}' +
'.ini-name{flex:1;min-width:110px;font-weight:600}.ini-tot{font-size:20px;font-weight:800;min-width:36px;text-align:right}' +
'.ini-tag{display:flex;gap:4px;flex-wrap:wrap}.ini-tag button{width:34px;height:34px;border-radius:8px;border:1px solid rgba(124,85,217,.5);background:none;color:inherit;cursor:pointer;font-weight:700}' +
'.ini-tag button.on{background:#5B2FBE;color:#fff}.ini-mod{width:70px;padding:8px;border-radius:8px;border:1px solid rgba(124,85,217,.5);font:inherit;background:inherit;color:inherit}';
document.head.appendChild(st);

function modal(card) {
  clear($('modalRoot')).appendChild(h('div', { class: 'o-modal', onclick: function (e) { if (e.target.classList.contains('o-modal')) closeModal(); } }, card));
}
// fields: [{label, value, big, max}] -> onOk(valuesArray)
function ask(title, fields, okText, onOk) {
  var card = h('div', { class: 'modal-card' }, h('h3', { text: title }));
  var inputs = fields.map(function (f) {
    var el = f.big ? h('textarea', { class: 'tx-modal-in', rows: '9' }) : h('input', { class: 'tx-modal-in', type: 'text' });
    el.value = f.value || ''; if (f.max) el.maxLength = f.max;
    if (f.label) card.appendChild(h('div', { class: 'tx-s', text: f.label }));
    card.appendChild(el); return el;
  });
  var go = h('button', { class: 'btn-primary', type: 'button', text: okText || 'Save' });
  go.onclick = async function () { go.disabled = true; var ok = await onOk(inputs.map(function (i) { return i.value; })); if (ok === false) go.disabled = false; };
  card.appendChild(h('div', { class: 'modal-foot' }, h('button', { type: 'button', class: 'linkbtn', text: 'Cancel', onclick: closeModal }), go));
  modal(card);
  if (inputs[0]) inputs[0].focus();
}

// ---------------- Campaign files ----------------
X.files = function () {
  var S = X.S(), o = S.o, dm = S.isDM;
  var root = h('div', { class: 'tx-wrap' });
  var d = { folders: [], docs: [], cur: null };

  function byId(id) { return d.folders.find(function (f) { return f.id === id; }); }
  function pathOf(id) { var p = [], g = 0; while (id && g++ < 30) { var f = byId(id); if (!f) break; p.unshift(f); id = f.parent_id; } return p; }
  function label(id) { return pathOf(id).map(function (f) { return f.name; }).join(' / ') || 'Top level'; }
  function descendants(id) { var out = [id]; d.folders.forEach(function (f) { if (f.parent_id === id) out = out.concat(descendants(f.id)); }); return out; }

  async function load() {
    var r = await Promise.all([
      sb.from('table_folders').select('*').eq('oasis_id', o.id).order('name'),
      sb.from('table_docs').select('*').eq('oasis_id', o.id).order('title')]);
    if (r[0].error || r[1].error) { toast((r[0].error || r[1].error).message); return; }
    d.folders = r[0].data || []; d.docs = r[1].data || [];
    if (d.cur && !byId(d.cur)) d.cur = null;
    render();
  }
  async function run(p, ok) { var r = await p; if (r.error) { toast(r.error.message); return false; } if (ok) toast(ok); closeModal(); await load(); return true; }

  function newFolder() {
    ask('New folder', [{ label: 'Folder name', max: 60 }], 'Create', function (v) {
      var n = v[0].trim(); if (!n) return false;
      return run(sb.from('table_folders').insert({ oasis_id: o.id, parent_id: d.cur, name: n }), 'Folder created.');
    });
  }
  function newNote() {
    ask('New note', [{ label: 'Title', max: 120 }, { label: 'Text (session notes, lore, handouts...)', big: true, max: 60000 }], 'Save', function (v) {
      var t = v[0].trim(); if (!t) return false;
      return run(sb.from('table_docs').insert({ oasis_id: o.id, folder_id: d.cur, title: t, body: v[1] }), 'Note saved.');
    });
  }
  function upload() {
    var inp = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,application/pdf', class: 'hidden' });
    inp.onchange = async function () {
      var f = inp.files[0]; if (!f) return;
      if (!/^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(f.type)) { toast('Please choose a PNG, JPG, WebP, GIF or PDF.'); return; }
      if (f.size > 10 * 1024 * 1024) { toast('That file is over 10 MB.'); return; }
      toast('Uploading...');
      var ext = f.type === 'application/pdf' ? 'pdf' : f.type.split('/')[1].replace('jpeg', 'jpg');
      var path = me.id + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + '.' + ext;
      var up = await sb.storage.from('table-files').upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) { toast(up.error.message); return; }
      var url = sb.storage.from('table-files').getPublicUrl(path).data.publicUrl;
      var title = f.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'File';
      await run(sb.from('table_docs').insert({ oasis_id: o.id, folder_id: d.cur, title: title, body: '', file_url: url, file_name: f.name.slice(0, 120) }), 'File added.');
    };
    inp.click();
  }
  function moveDlg(kind, item) {
    var sel = h('select', { class: 'tx-modal-in' });
    var bad = kind === 'folder' ? descendants(item.id) : [];
    sel.appendChild(h('option', { value: '', text: 'Top level' }));
    d.folders.forEach(function (f) { if (bad.indexOf(f.id) < 0) sel.appendChild(h('option', { value: String(f.id), text: label(f.id) })); });
    var curv = kind === 'folder' ? item.parent_id : item.folder_id; sel.value = curv ? String(curv) : '';
    var go = h('button', { class: 'btn-primary', type: 'button', text: 'Move here' });
    go.onclick = function () {
      var to = sel.value ? parseInt(sel.value, 10) : null;
      if (kind === 'folder') run(sb.from('table_folders').update({ parent_id: to }).eq('id', item.id), 'Moved.');
      else run(sb.from('table_docs').update({ folder_id: to }).eq('id', item.id), 'Moved.');
    };
    modal(h('div', { class: 'modal-card' }, h('h3', { text: 'Move "' + (item.name || item.title) + '"' }), sel,
      h('div', { class: 'modal-foot' }, h('button', { type: 'button', class: 'linkbtn', text: 'Cancel', onclick: closeModal }), go)));
  }
  function renameFolder(f) {
    ask('Rename folder', [{ label: 'Folder name', value: f.name, max: 60 }], 'Save', function (v) {
      var n = v[0].trim(); if (!n) return false;
      return run(sb.from('table_folders').update({ name: n }).eq('id', f.id), 'Renamed.');
    });
  }
  function delFolder(f) {
    if (confirm('Delete the folder "' + f.name + '" and everything inside it?')) run(sb.from('table_folders').delete().eq('id', f.id), 'Folder deleted.');
  }
  function editDoc(doc) {
    ask('Edit note', [{ label: 'Title', value: doc.title, max: 120 }, { label: 'Text', value: doc.body, big: true, max: 60000 }], 'Save', function (v) {
      var t = v[0].trim(); if (!t) return false;
      return run(sb.from('table_docs').update({ title: t, body: v[1] }).eq('id', doc.id), 'Saved.');
    });
  }
  function delDoc(doc) {
    if (confirm('Delete "' + doc.title + '"?')) run(sb.from('table_docs').delete().eq('id', doc.id), 'Deleted.');
  }
  function openDoc(doc) {
    var card = h('div', { class: 'modal-card' }, h('h3', { text: doc.title }));
    if (doc.file_url) {
      if (/\.pdf(\?|$)/i.test(doc.file_url)) card.appendChild(h('a', { class: 'btn-outline', href: doc.file_url, target: '_blank', rel: 'noopener', text: 'Open PDF', style: 'display:inline-block;margin:8px 0;text-decoration:none' }));
      else card.appendChild(h('a', { href: doc.file_url, target: '_blank', rel: 'noopener' }, h('img', { class: 'tx-img', src: doc.file_url, alt: doc.title })));
    }
    if (doc.body) card.appendChild(h('div', { class: 'tx-body', text: doc.body }));
    var foot = h('div', { class: 'modal-foot' });
    if (dm) {
      if (!doc.file_url) foot.appendChild(h('button', { class: 'btn-outline', type: 'button', text: 'Edit', onclick: function () { editDoc(doc); } }));
      foot.appendChild(h('button', { class: 'btn-outline', type: 'button', text: 'Move', onclick: function () { moveDlg('doc', doc); } }));
      foot.appendChild(h('button', { class: 'linkbtn danger', type: 'button', text: 'Delete', onclick: function () { delDoc(doc); } }));
    }
    foot.appendChild(h('button', { type: 'button', class: 'linkbtn', text: 'Close', onclick: closeModal }));
    card.appendChild(foot);
    modal(card);
  }
  function mini(txt, title, fn) { var b = h('button', { class: 'tx-mini', type: 'button', title: title, text: txt }); b.onclick = function (e) { e.stopPropagation(); fn(); }; return b; }

  function render() {
    clear(root);
    var crumbs = h('div', { class: 'tx-crumbs' });
    var p = pathOf(d.cur);
    if (!p.length) crumbs.appendChild(h('span', { class: 'cur', text: '\u{1F4C2} All files' }));
    else {
      crumbs.appendChild(h('button', { type: 'button', text: '\u{1F4C2} All files', onclick: function () { d.cur = null; render(); } }));
      p.forEach(function (f, i) {
        crumbs.appendChild(h('span', { text: '/' }));
        if (i === p.length - 1) crumbs.appendChild(h('span', { class: 'cur', text: f.name }));
        else crumbs.appendChild(h('button', { type: 'button', text: f.name, onclick: function () { d.cur = f.id; render(); } }));
      });
    }
    root.appendChild(crumbs);
    var bar = h('div', { class: 'tx-bar' });
    if (dm) {
      bar.appendChild(h('button', { class: 'btn-primary', type: 'button', text: '\u{1F4C1} New folder', onclick: newFolder }));
      bar.appendChild(h('button', { class: 'btn-outline', type: 'button', text: '\u{1F4DD} New note', onclick: newNote }));
      bar.appendChild(h('button', { class: 'btn-outline', type: 'button', text: '⬆ Upload file', onclick: upload }));
    } else bar.appendChild(h('span', { class: 'tx-s', text: 'The DM keeps the campaign files. Everyone at the table can read them.' }));
    root.appendChild(bar);

    var list = h('div', { class: 'tx-list' });
    var fs = d.folders.filter(function (f) { return (f.parent_id || null) === d.cur; });
    var ds = d.docs.filter(function (x) { return (x.folder_id || null) === d.cur; });
    fs.forEach(function (f) {
      var n = d.docs.filter(function (x) { return x.folder_id === f.id; }).length + d.folders.filter(function (x) { return x.parent_id === f.id; }).length;
      var row = h('div', { class: 'tx-row', onclick: function () { d.cur = f.id; render(); } },
        h('div', { class: 'tx-ico', text: '\u{1F4C1}' }),
        h('div', { class: 'tx-main' }, h('div', { class: 'tx-t', text: f.name }), h('div', { class: 'tx-s', text: n + (n === 1 ? ' item' : ' items') })));
      if (dm) { row.appendChild(mini('✏', 'Rename', function () { renameFolder(f); })); row.appendChild(mini('↗', 'Move', function () { moveDlg('folder', f); })); row.appendChild(mini('\u{1F5D1}', 'Delete', function () { delFolder(f); })); }
      list.appendChild(row);
    });
    ds.forEach(function (x) {
      var ico = x.file_url ? (/\.pdf(\?|$)/i.test(x.file_url) ? '\u{1F4D5}' : '\u{1F5BC}') : '\u{1F4C4}';
      var row = h('div', { class: 'tx-row', onclick: function () { openDoc(x); } },
        h('div', { class: 'tx-ico', text: ico }),
        h('div', { class: 'tx-main' }, h('div', { class: 'tx-t', text: x.title }), h('div', { class: 'tx-s', text: x.file_url ? (x.file_name || 'File') : 'Note' })));
      if (dm) { row.appendChild(mini('↗', 'Move', function () { moveDlg('doc', x); })); row.appendChild(mini('\u{1F5D1}', 'Delete', function () { delDoc(x); })); }
      list.appendChild(row);
    });
    if (!fs.length && !ds.length) list.appendChild(h('div', { class: 'tx-empty', text: dm ? 'This folder is empty. Add a folder, a note, or upload a file.' : 'Nothing here yet.' }));
    root.appendChild(list);
  }

  root.appendChild(h('div', { class: 'empty', text: 'Opening the files...' }));
  load();
  return root;
};

// ---------------- Initiative ----------------
X.init = function () {
  var S = X.S(), o = S.o, dm = S.isDM, canRoll = S.role === 'owner' || S.role === 'player';
  var root = h('div', { class: 'tx-wrap' });
  var d = { rows: [], turn: null };
  var key = 'o19-initmod-' + o.id, saved = 0;
  try { saved = parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (e) { saved = 0; }
  var modIn = h('input', { class: 'ini-mod', type: 'number', min: '-10', max: '20' });
  modIn.value = String(saved);
  var busy = false;

  function sorted() {
    return d.rows.slice().sort(function (a, b) {
      var sa = a.slot || 99, sb2 = b.slot || 99;
      return sa - sb2 || b.total - a.total || b.modifier - a.modifier || a.id - b.id;
    });
  }
  async function load() {
    var r = await Promise.all([
      sb.from('table_initiative').select('*').eq('oasis_id', o.id),
      sb.from('table_turn').select('*').eq('oasis_id', o.id).maybeSingle()]);
    if (r[0].error) { toast(r[0].error.message); return; }
    d.rows = r[0].data || []; d.turn = r[1].data || null;
    if (!document.body.contains(root) && root.parentNode) return;
    render();
  }
  async function call(p, ok) {
    if (busy) return; busy = true;
    var r = await p; busy = false;
    if (r.error) { toast(r.error.message); return; }
    if (ok) toast(ok); load();
  }
  function rollIt() {
    var m = parseInt(modIn.value, 10) || 0;
    try { localStorage.setItem(key, String(m)); } catch (e) { /* ignore */ }
    call(sb.rpc('roll_initiative', { p_oasis: o.id, p_mod: m }), 'Initiative rolled!');
  }
  function addNpc() {
    ask('Add a monster or NPC', [{ label: 'Name', max: 40 }, { label: 'Initiative modifier (number, like 2 or -1)', value: '0', max: 3 }], 'Roll for it', async function (v) {
      var n = v[0].trim(); if (!n) return false;
      var r = await sb.rpc('add_npc_initiative', { p_oasis: o.id, p_name: n, p_mod: parseInt(v[1], 10) || 0 });
      if (r.error) { toast(r.error.message); return false; }
      closeModal(); load();
    });
  }
  function tag(row, n) {
    call(sb.from('table_initiative').update({ slot: row.slot === n ? null : n }).eq('id', row.id));
  }
  function render() {
    clear(root);
    var top = h('div', { class: 'tx-bar' });
    if (canRoll) {
      top.appendChild(h('span', { class: 'tx-s', text: 'Modifier' })); top.appendChild(modIn);
      top.appendChild(h('button', { class: 'btn-primary', type: 'button', text: '\u{1F3B2} Roll initiative', onclick: rollIt }));
    } else top.appendChild(h('span', { class: 'tx-s', text: 'Only the DM and seated players roll initiative.' }));
    root.appendChild(top);
    if (dm) {
      root.appendChild(h('div', { class: 'tx-bar' },
        h('button', { class: 'btn-outline', type: 'button', text: '+ Monster / NPC', onclick: addNpc }),
        h('button', { class: 'btn-outline', type: 'button', text: '✨ Auto-tag 1 to 5', onclick: function () { call(sb.rpc('auto_tag_initiative', { p_oasis: o.id }), 'Tagged by roll.'); } }),
        h('button', { class: 'btn-primary', type: 'button', text: '▶ Next turn', onclick: function () { call(sb.rpc('next_turn', { p_oasis: o.id })); } }),
        h('button', { class: 'linkbtn danger', type: 'button', text: 'Clear all', onclick: function () { if (confirm('Clear the whole initiative list?')) call(sb.rpc('clear_initiative', { p_oasis: o.id }), 'Cleared.'); } })));
    }
    if (d.turn && d.turn.current_id) root.appendChild(h('div', { class: 'tx-s', text: 'Round ' + d.turn.round }));
    var rows = sorted();
    if (!rows.length) { root.appendChild(h('div', { class: 'tx-empty', text: canRoll ? 'Nobody has rolled yet. Tap Roll initiative.' : 'Nobody has rolled yet.' })); return; }
    rows.forEach(function (r) {
      var nowTurn = d.turn && d.turn.current_id === r.id;
      var row = h('div', { class: 'ini-row' + (nowTurn ? ' now' : '') },
        h('div', { class: 'ini-slot' + (r.slot ? '' : ' none'), text: r.slot ? String(r.slot) : '–' }),
        h('div', { class: 'ini-name', text: r.name + (r.is_npc ? ' (NPC)' : '') + (nowTurn ? '  ◀ up now' : '') }),
        h('div', { class: 'tx-s', text: r.roll + (r.modifier >= 0 ? ' + ' : ' - ') + Math.abs(r.modifier) }),
        h('div', { class: 'ini-tot', text: String(r.total) }));
      if (dm) {
        var tg = h('div', { class: 'ini-tag' });
        [1, 2, 3, 4, 5].forEach(function (n) { tg.appendChild(h('button', { type: 'button', class: r.slot === n ? 'on' : '', text: String(n), onclick: function () { tag(r, n); } })); });
        row.appendChild(tg);
        row.appendChild(mini('✕', 'Remove', function () { call(sb.from('table_initiative').delete().eq('id', r.id)); }));
      }
      root.appendChild(row);
    });
  }
  function mini(txt, title, fn) { var b = h('button', { class: 'tx-mini', type: 'button', title: title, text: txt }); b.onclick = fn; return b; }

  var t = setInterval(function () {
    if (!document.body.contains(root)) { clearInterval(t); return; }
    if (document.activeElement === modIn) return;
    load();
  }, 5000);
  root.appendChild(h('div', { class: 'empty', text: 'Gathering the party...' }));
  load();
  return root;
};
})();
