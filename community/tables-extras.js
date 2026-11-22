/* Oasis19 table extras: Campaign files (folders + documents) and Initiative. Needs tables.js (window.TblX). */ /* deploy-test 2026-11-22 */
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
// ---------------- Edit your own posts ----------------
(function () {
  if (typeof window.renderPost !== 'function' || window.__o19EditPatched) return;
  window.__o19EditPatched = true;
  var orig = window.renderPost;
  var cards = {}, queue = [], timer = null;
  function flush() {
    timer = null;
    var ids = queue.splice(0, queue.length);
    if (!ids.length) return;
    sb.from('posts').select('id, edited_at').in('id', ids).not('edited_at', 'is', null).then(function (r) {
      (r.data || []).forEach(function (row) {
        var c = cards[row.id]; if (!c || c.querySelector('.post-edited')) return;
        var t = c.querySelector('.post-time'); if (t) t.parentNode.appendChild(h('span', { class: 'post-edited', style: 'opacity:.65;font-size:12px', text: 'edited' }));
      });
    });
  }
  function editDlg(p, opts) {
    ask('Edit your post', [{ label: 'Post text', value: p.body, big: true, max: 3500 }], 'Save', async function (v) {
      var b = v[0].trim(); if (!b) return false;
      if (b === (p.body || '').trim()) { closeModal(); return true; }
      var r = await sb.rpc('edit_post', { p_id: p.id, p_body: b });
      if (r.error) { toast(r.error.message); return false; }
      closeModal(); toast('Post updated.');
      if (opts && opts.reload) opts.reload(); else loadFeed(opts);
    });
  }
  async function delPost(p, opts) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    var r = await sb.from('posts').delete().eq('id', p.id);
    if (r.error) { toast(r.error.message); return; }
    if (p.video_url) { var k = p.video_url.split('/object/public/videos/')[1]; if (k) sb.storage.from('videos').remove([k]); }
    toast('Post deleted.');
    if (opts && opts.reload) opts.reload(); else loadFeed(opts);
  }
  window.renderPost = function (p, opts) {
    var card = orig.apply(this, arguments);
    try {
      if (card && p && p.id) {
        cards[p.id] = card; queue.push(p.id); if (!timer) timer = setTimeout(flush, 200);
        if (p.user_id === me.id) {
          var bar = card.querySelector('.post-actions');
          if (bar) bar.appendChild(h('button', { class: 'post-action', type: 'button', title: 'Edit your post', text: '✏️ Edit', onclick: function () { editDlg(p, opts); } }));
          if (bar) bar.appendChild(h('button', { class: 'post-action', type: 'button', title: 'Delete your post', text: '🗑️ Delete', onclick: function () { delPost(p, opts); } }));
          var oldBtn = card.querySelector('button.post-menu[title="Delete post"]'); if (oldBtn) oldBtn.remove();
        }
      }
    } catch (e) { /* never break the feed */ }
    return card;
  };
})();
})();

/* ===== Social: follow, direct messages, block, report, admin tools ===== */
(function () {
  'use strict';
  var REPORT_EMAIL = 'Oasis19admin@proton.me';
  var isAdmin = false, lastTotal = -1, btn = null, badge = null;

  function fail(e) { toast((e && e.message) || 'Something went wrong'); }
  function showModal(card) {
    clear($('modalRoot')).appendChild(h('div', { class: 'o-modal', onclick: function (e) { if (e.target.classList.contains('o-modal')) closeModal(); } }, card));
  }
  function foot(btns) { return h('div', { class: 'modal-foot', style: 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px' }, btns); }
  function closeBtn(t) { return h('button', { type: 'button', class: 'linkbtn', text: t || 'Close', onclick: closeModal }); }
  function stillOpen(node) { return document.body.contains(node); }
  async function getProfiles(ids) {
    var map = {};
    if (!ids.length) return map;
    var r = await sb.from('profiles').select('id, username, display_name, avatar_url').in('id', ids);
    (r.data || []).forEach(function (p) { map[p.id] = p; });
    return map;
  }
  function who(map, id) { return map[id] || { id: id, username: 'member', display_name: 'Member' }; }

  /* ---------- profile bar: Follow, Message, Block ---------- */
  async function addBar() {
    var scr = $('screen-profile'); if (!scr) return;
    var old = $('socialBar'); if (old) old.remove();
    var uid = viewUserId;
    if (!uid || !me || uid === me.id) return;
    var bar = h('div', { id: 'socialBar', style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0' });
    scr.insertBefore(bar, scr.firstChild);
    var pm = await getProfiles([uid]); var p = who(pm, uid);
    var fr = await sb.from('follows').select('follower').eq('follower', me.id).eq('followee', uid).limit(1);
    var following = !!(fr.data && fr.data.length);
    var cnt = await sb.from('follows').select('follower', { count: 'exact', head: true }).eq('followee', uid);
    var count = cnt.count || 0;
    if (!stillOpen(bar)) return;
    var fb = h('button', { class: following ? 'btn-outline' : 'join-btn', text: following ? 'Following' : 'Follow' });
    var cl = h('span', { style: 'color:var(--ink3);font-size:.85rem', text: count + (count === 1 ? ' follower' : ' followers') });
    fb.onclick = async function () {
      fb.disabled = true;
      var res = following
        ? await sb.from('follows').delete().eq('follower', me.id).eq('followee', uid)
        : await sb.from('follows').insert({ follower: me.id, followee: uid });
      if (res.error) { fb.disabled = false; return fail(res.error); }
      addBar();
    };
    var mb = h('button', { class: 'btn-outline', text: '💬 Message', onclick: function () { openCompose(uid, p); } });
    var more = h('button', { class: 'linkbtn', text: 'Block', onclick: function () { blockFlow(uid, p); } });
    bar.append(fb, mb, cl, more);
    if (isAdmin) bar.appendChild(h('button', { class: 'linkbtn', style: 'color:#c0392b', text: 'Delete profile permanently', onclick: function () { adminDelete(uid, p); } }));
  }

  /* ---------- compose a first message ---------- */
  function openCompose(uid, p) {
    var ta = h('textarea', { rows: '4', maxlength: '2000', placeholder: 'Write your message…', style: 'width:100%;box-sizing:border-box' });
    var send = h('button', { class: 'join-btn', text: 'Send' });
    var info = h('div', { style: 'color:var(--ink3);font-size:.85rem;margin-bottom:8px', text: isAdmin ? 'You can message anyone as an admin.' : nameOf(p) + ' will get a request and can accept or decline it. You can send one message until they accept.' });
    send.onclick = async function () {
      var body = ta.value.trim(); if (!body) return;
      send.disabled = true;
      var r = await sb.rpc('send_dm', { p_to: uid, p_body: body });
      if (r.error) { send.disabled = false; return fail(r.error); }
      toast(isAdmin ? 'Message sent' : 'Request sent');
      closeModal(); poll();
    };
    showModal(h('div', { class: 'modal-card' }, h('h3', { text: 'Message ' + nameOf(p) }), info, ta, foot([closeBtn('Cancel'), send])));
    ta.focus();
  }

  /* ---------- block, then offer to report ---------- */
  function blockFlow(uid, p) {
    var go1 = h('button', { class: 'join-btn', text: 'Block' });
    go1.onclick = async function () {
      var r = await sb.rpc('block_user', { p: uid });
      if (r.error) return fail(r.error);
      await sb.from('follows').delete().eq('follower', me.id).eq('followee', uid);
      reportPrompt(uid, p);
      poll(); addBar();
    };
    showModal(h('div', { class: 'modal-card' }, h('h3', { text: 'Block ' + nameOf(p) + '?' }),
      h('p', { text: 'They won\'t be able to message or follow you. You can unblock anyone later from your Messages.' }), foot([closeBtn('Cancel'), go1])));
  }
  function reportPrompt(uid, p) {
    var ta = h('textarea', { rows: '3', maxlength: '800', placeholder: 'What happened? (optional)', style: 'width:100%;box-sizing:border-box' });
    var rep = h('button', { class: 'join-btn', text: 'Report profile' });
    rep.onclick = async function () {
      var reason = ta.value.trim();
      await sb.rpc('report_user', { p: uid, p_reason: reason });
      var subj = 'Oasis19 report: @' + (p.username || uid);
      var body = 'I\'d like to report this profile on Oasis19.\n\nProfile: ' + nameOf(p) + ' (@' + (p.username || '') + ')\nProfile ID: ' + uid + '\nReason: ' + reason + '\n';
      var a = document.createElement('a');
      a.href = 'mailto:' + REPORT_EMAIL + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
      document.body.appendChild(a); a.click(); a.remove();
      toast('Report saved. Your email app will open so you can send it.');
      closeModal();
    };
    showModal(h('div', { class: 'modal-card' }, h('h3', { text: 'Blocked. Report this profile?' }),
      h('p', { text: 'Reports go to the Oasis19 admin. You can add a note below.' }), ta, foot([closeBtn('No thanks'), rep])));
  }

  /* ---------- admin: delete a profile ---------- */
  function adminDelete(uid, p) {
    var del = h('button', { class: 'join-btn', style: 'background:#c0392b', text: 'Delete permanently' });
    del.onclick = async function () {
      var r = await sb.rpc('admin_delete_user', { p: uid });
      if (r.error) return fail(r.error);
      toast('Profile deleted'); closeModal(); go('discover');
    };
    showModal(h('div', { class: 'modal-card' }, h('h3', { text: 'Delete ' + nameOf(p) + ' permanently?' }),
      h('p', { text: 'This removes the profile, posts, comments and messages. It can\'t be undone.' }), foot([closeBtn('Cancel'), del])));
  }

  /* ---------- inbox ---------- */
  async function openInbox() {
    var list = h('div', { style: 'display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow:auto' });
    var card = h('div', { class: 'modal-card' }, h('h3', { text: 'Messages' }), list,
      foot([h('button', { class: 'linkbtn', text: 'Blocked people', onclick: openBlocked }),
        isAdmin ? h('button', { class: 'linkbtn', text: 'Reports', onclick: openReports }) : null, closeBtn()]));
    showModal(card);
    list.appendChild(h('div', { class: 'empty', text: 'Loading…' }));
    var tr = await sb.from('dm_threads').select('*').order('last_at', { ascending: false }).limit(60);
    if (tr.error) { clear(list).appendChild(h('div', { class: 'empty', text: tr.error.message })); return; }
    var threads = tr.data || [];
    var ids = threads.map(function (t) { return t.id; });
    var others = threads.map(function (t) { return t.user_a === me.id ? t.user_b : t.user_a; });
    var pm = await getProfiles(others);
    var last = {}, unread = {};
    if (ids.length) {
      var mr = await sb.from('dm_messages').select('thread_id, body, sender, created_at, read_at').in('thread_id', ids).order('created_at', { ascending: false }).limit(300);
      (mr.data || []).forEach(function (m) {
        if (!last[m.thread_id]) last[m.thread_id] = m;
        if (m.sender !== me.id && !m.read_at) unread[m.thread_id] = (unread[m.thread_id] || 0) + 1;
      });
    }
    clear(list);
    function section(title, arr) {
      if (!arr.length) return;
      list.appendChild(h('div', { style: 'font-weight:700;font-size:.8rem;color:var(--ink3);margin-top:6px', text: title }));
      arr.forEach(function (t) {
        var oid = t.user_a === me.id ? t.user_b : t.user_a, p = who(pm, oid), lm = last[t.id], n = unread[t.id] || 0;
        list.appendChild(h('div', { style: 'display:flex;gap:10px;align-items:center;cursor:pointer;padding:6px;border-radius:10px', onclick: function () { openThread(t, p); } },
          personAvatar(p, 'av-sm'),
          h('div', { style: 'flex:1;min-width:0' },
            h('div', { style: 'font-weight:' + (n ? '700' : '600'), text: nameOf(p) }),
            h('div', { style: 'color:var(--ink3);font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: lm ? (lm.sender === me.id ? 'You: ' : '') + lm.body : '' })),
          n ? h('span', { class: 'oc-unread', text: String(n) }) : null));
      });
    }
    var vis = threads.filter(function (t) { return t.status !== 'declined'; });
    section('Message requests', vis.filter(function (t) { return t.status === 'pending' && t.requester !== me.id; }));
    section('Conversations', vis.filter(function (t) { return t.status === 'accepted'; }));
    section('Waiting for a reply', vis.filter(function (t) { return t.status === 'pending' && t.requester === me.id; }));
    if (!vis.length) list.appendChild(h('div', { class: 'empty', text: 'No messages yet. Open someone\'s profile and tap Message.' }));
  }

  /* ---------- one conversation ---------- */
  async function openThread(t, p) {
    var box = h('div', { style: 'display:flex;flex-direction:column;gap:6px;max-height:42vh;overflow:auto;padding:4px' });
    var top = h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
      h('button', { class: 'linkbtn', text: '← Back', onclick: openInbox }),
      h('h3', { style: 'margin:0;flex:1', text: nameOf(p) }),
      h('button', { class: 'linkbtn', text: 'Delete conversation', onclick: async function () {
        if (!confirm('Delete this conversation from your side?')) return;
        var r = await sb.rpc('delete_dm_thread', { p_thread: t.id }); if (r.error) return fail(r.error); poll(); openInbox(); } }),
      h('button', { class: 'linkbtn', text: 'Block', onclick: function () { blockFlow(p.id, p); } }));
    var actions = h('div', { style: 'margin-top:8px' });
    var card = h('div', { class: 'modal-card' }, top, box, actions);
    showModal(card);
    var status = t.status;
    async function load() {
      var r = await sb.from('dm_messages').select('id, sender, body, created_at').eq('thread_id', t.id).order('created_at', { ascending: true }).limit(200);
      if (r.error) return;
      var atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
      clear(box);
      (r.data || []).forEach(function (m) {
        var mine = m.sender === me.id;
        box.appendChild(h('div', { style: 'align-self:' + (mine ? 'flex-end' : 'flex-start') + ';max-width:80%;background:' + (mine ? 'var(--purple-tint)' : 'var(--bg2, #f1f1f1)') + ';padding:8px 10px;border-radius:12px' },
          h('div', { style: 'white-space:pre-wrap;word-break:break-word', text: m.body }),
          h('div', { style: 'font-size:.72rem;color:var(--ink3);margin-top:2px' }, ago(m.created_at) + ' ',
            h('a', { href: '#', text: 'delete', onclick: async function (e) { e.preventDefault(); var d = await sb.rpc('delete_dm_message', { p_id: m.id }); if (d.error) return fail(d.error); load(); } }))));
      });
      if (atEnd || true) box.scrollTop = box.scrollHeight;
      if (status === 'accepted') { await sb.rpc('mark_thread_read', { p_thread: t.id }); poll(); }
    }
    function drawActions() {
      clear(actions);
      if (status === 'pending' && t.requester !== me.id) {
        actions.append(h('div', { style: 'color:var(--ink3);font-size:.85rem;margin-bottom:6px', text: nameOf(p) + ' wants to message you. Nothing is marked read until you accept.' }),
          foot([
            h('button', { class: 'btn-outline', text: 'Decline', onclick: async function () { var r = await sb.rpc('respond_dm', { p_thread: t.id, p_accept: false }); if (r.error) return fail(r.error); poll(); openInbox(); } }),
            h('button', { class: 'join-btn', text: 'Accept', onclick: async function () { var r = await sb.rpc('respond_dm', { p_thread: t.id, p_accept: true }); if (r.error) return fail(r.error); status = 'accepted'; drawActions(); load(); } })]));
      } else if (status === 'pending' && !isAdmin) {
        actions.appendChild(h('div', { style: 'color:var(--ink3);font-size:.85rem', text: 'Waiting for ' + nameOf(p) + ' to accept your request.' }));
      } else {
        var ta = h('textarea', { rows: '2', maxlength: '2000', placeholder: 'Write a message…', style: 'width:100%;box-sizing:border-box' });
        var s = h('button', { class: 'join-btn', text: 'Send' });
        s.onclick = async function () {
          var body = ta.value.trim(); if (!body) return; s.disabled = true;
          var r = await sb.rpc('send_dm', { p_to: p.id, p_body: body }); s.disabled = false;
          if (r.error) return fail(r.error); ta.value = ''; status = 'accepted'; load();
        };
        actions.append(ta, foot([s]));
      }
    }
    drawActions(); await load();
    var timer = setInterval(function () { if (!stillOpen(box)) { clearInterval(timer); return; } load(); }, 8000);
  }

  /* ---------- blocked list and admin reports ---------- */
  async function openBlocked() {
    var list = h('div', { style: 'display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow:auto' });
    showModal(h('div', { class: 'modal-card' }, h('h3', { text: 'Blocked people' }), list, foot([h('button', { class: 'linkbtn', text: '← Back', onclick: openInbox }), closeBtn()])));
    var r = await sb.from('blocks').select('blocked').eq('blocker', me.id);
    var ids = (r.data || []).map(function (x) { return x.blocked; });
    var pm = await getProfiles(ids);
    if (!ids.length) { list.appendChild(h('div', { class: 'empty', text: 'You haven\'t blocked anyone.' })); return; }
    ids.forEach(function (id) {
      var p = who(pm, id);
      list.appendChild(h('div', { style: 'display:flex;gap:10px;align-items:center' }, personAvatar(p, 'av-sm'),
        h('div', { style: 'flex:1', text: nameOf(p) }),
        h('button', { class: 'btn-outline', text: 'Unblock', onclick: async function (e) { var u = await sb.rpc('unblock_user', { p: id }); if (u.error) return fail(u.error); e.target.parentNode.remove(); } })));
    });
  }
  async function openReports() {
    var list = h('div', { style: 'display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow:auto' });
    showModal(h('div', { class: 'modal-card' }, h('h3', { text: 'Reports' }), list, foot([h('button', { class: 'linkbtn', text: '← Back', onclick: openInbox }), closeBtn()])));
    var r = await sb.from('reports').select('*').order('created_at', { ascending: false }).limit(50);
    var rows = r.data || [];
    var pm = await getProfiles(rows.map(function (x) { return x.reported; }).filter(Boolean));
    if (!rows.length) { list.appendChild(h('div', { class: 'empty', text: 'No reports.' })); return; }
    rows.forEach(function (x) {
      var p = who(pm, x.reported);
      list.appendChild(h('div', { style: 'padding:8px;border:1px solid var(--line, #ddd);border-radius:10px;cursor:pointer', onclick: function () { closeModal(); go('profile', x.reported); } },
        h('div', { style: 'font-weight:600', text: nameOf(p) + ' (@' + p.username + ')' }),
        h('div', { style: 'font-size:.85rem', text: x.reason || 'No note' }),
        h('div', { style: 'font-size:.75rem;color:var(--ink3)', text: ago(x.created_at) })));
    });
  }

  /* ---------- sidebar button, unread badge, polling ---------- */
  async function poll() {
    if (!me || !btn) return;
    var r = await sb.rpc('dm_unread');
    if (r.error || !r.data) return;
    var row = Array.isArray(r.data) ? r.data[0] : r.data; if (!row) return;
    var total = Number(row.unread || 0) + Number(row.requests || 0);
    badge.textContent = total ? String(total) : ''; badge.style.display = total ? 'inline-block' : 'none';
    if (lastTotal >= 0 && total > lastTotal) toast('💬 You have a new message');
    lastTotal = total;
  }
  function init() {
    if (btn || !me || !$('newOasisSide') || !$('newOasisSide').parentNode) return;
    badge = h('span', { class: 'oc-unread', style: 'display:none;margin-left:8px' });
    btn = h('button', { class: 'btn-outline', style: 'width:100%;margin-bottom:8px', onclick: openInbox }, '💬 Messages', badge);
    $('newOasisSide').parentNode.insertBefore(btn, $('newOasisSide'));
    sb.rpc('is_admin').then(function (r) { isAdmin = r.data === true; });
    poll(); setInterval(poll, 30000);
  }
  setInterval(init, 1000);

  /* wrap profile rendering to add the Follow / Message bar */
  if (typeof window.renderProfile === 'function') {
    var orig = window.renderProfile;
    window.renderProfile = function () {
      var r = orig.apply(this, arguments);
      Promise.resolve(r).then(function () { return addBar(); }).catch(function () {});
      return r;
    };
  }
})();

/* ===== Following feed tab ===== */
(function () {
  'use strict';
  var origLoad = window.loadFeed;
  if (typeof origLoad !== 'function') return;
  window.loadFeed = async function (opts) {
    if (!(opts && opts.mode === 'home' && feedFilter === 'following')) return origLoad.apply(this, arguments);
    var box = clear(opts.box);
    box.appendChild(h('div', { class: 'empty', text: 'Loading…' }));
    var f = await sb.from('follows').select('followee').eq('follower', me.id);
    var ids = (f.data || []).map(function (r) { return r.followee; });
    if (!ids.length) { clear(box).appendChild(h('div', { class: 'empty', text: 'Follow people from their profile and their posts will show up here.' })); return; }
    var r = await sb.from('posts').select(POST_SEL).in('user_id', ids).order('created_at', { ascending: false }).limit(50);
    clear(box);
    if (r.error) { box.appendChild(h('div', { class: 'empty', text: r.error.message })); return; }
    var rows = (r.data || []).filter(function (p) { return !(p.oases && (p.oases.is_private || p.oases.kind === 'table')); });
    if (!rows.length) { box.appendChild(h('div', { class: 'empty', text: 'No posts from people you follow yet.' })); return; }
    rows.forEach(function (p) { box.appendChild(renderPost(p, opts)); });
  };
  var t = setInterval(function () {
    var bar = document.getElementById('feedFilter');
    if (!bar) return;
    clearInterval(t);
    var b = h('button', { class: 'filter-btn', 'data-f': 'following', text: 'Following' });
    b.onclick = function () {
      feedFilter = 'following';
      bar.querySelectorAll('.filter-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
      window.loadFeed({ box: $('feedPosts'), mode: 'home' });
    };
    bar.appendChild(b);
  }, 500);
})();

/* ===== Prominent "Pick up dice" button on the table ===== */
(function () {
  'use strict';
  setInterval(function () {
    var z = document.getElementById('diceZone');
    if (!z || !window.TblX || !window.TblX.S) return;
    var S = window.TblX.S(); if (!S || !S.o) return;
    var seated = S.role === 'owner' || S.role === 'player';
    var btn = document.getElementById('pickDiceBtn');
    var has = z.querySelector('.die');
    if (!seated || !has) { if (btn) btn.remove(); return; }
    if (btn) return;
    btn = h('button', { id: 'pickDiceBtn', type: 'button', class: 'btn-outline', style: 'margin-top:6px;font-size:.8rem;padding:4px 12px;background:#fff', text: '✋ Pick up dice' });
    btn.onclick = async function () {
      btn.disabled = true;
      var r = await sb.rpc('pick_up_dice', { p_oasis: S.o.id });
      if (r.error) { btn.disabled = false; return toast(r.error.message); }
      clear(z); btn.remove(); toast('Dice picked up');
    };
    z.parentNode.appendChild(btn);
  }, 700);
})();
