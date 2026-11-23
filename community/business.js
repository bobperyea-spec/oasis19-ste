(function () {
'use strict';

var SB_URL = 'https://qcsnxchphbtgumdazbpq.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjc254Y2hwaGJ0Z3VtZGF6YnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNzc0NDQsImV4cCI6MjEwODk1MzQ0NH0.9iTTsSe09SQR_I3RGaYWrPUv8wR3H0pGyYJIFc-abgQ';
var sb = null;

var state = { user: null, biz: null, pendingAction: null, reviewSeq: 0 };

/* ---------- helpers ---------- */
function $(id) { return document.getElementById(id); }

function el(tag, attrs, kids) {
  var n = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
  }
  (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
  return n;
}

function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
function setMsg(id, text, ok) {
  var n = $(id);
  n.textContent = text || '';
  n.className = 'msg' + (text ? (ok ? ' ok' : ' bad') : '');
}
function setErr(id, text) {
  var n = $(id);
  if (n) n.textContent = text || '';
}
function clearErrors(root) {
  root.querySelectorAll('.err').forEach(function (n) { n.textContent = ''; });
  root.querySelectorAll('[aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
}
function markInvalid(inputId) {
  var n = $(inputId);
  if (n) n.setAttribute('aria-invalid', 'true');
}
function busy(btnIds, on) {
  btnIds.forEach(function (id) { $(id).disabled = on; });
}
function showView(name) {
  ['loading', 'signedout', 'request', 'pending', 'editor'].forEach(function (v) {
    $('view-' + v).hidden = (v !== name);
  });
}
function fatal(text) {
  var f = $('fatal');
  f.textContent = text;
  f.hidden = false;
  showView('none');
}

/* ---------- validation ---------- */
function normalizeUrl(v) {
  v = (v || '').trim();
  if (!v) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v.replace(/^\/+/, '');
  return v;
}
function isHttps(v) {
  try {
    var u = new URL(v);
    return u.protocol === 'https:' && u.hostname.indexOf('.') > 0;
  } catch (e) { return false; }
}
function isHttpOrHttps(v) {
  try {
    var u = new URL(v);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.indexOf('.') > 0;
  } catch (e) { return false; }
}
function safeHttps(v) { return v && isHttps(v) ? v : ''; }

function friendlyError(err, fallback) {
  var msg = (err && err.message) || '';
  var code = err && err.code;
  if (code === '23505') return 'You already have an open request. We will let you know when it is ready.';
  if (code === '42501' || /row-level security|permission denied|not allowed/i.test(msg)) {
    return 'That is not allowed right now. If your page is not published, it cannot post yet.';
  }
  if (/jwt|not authenticated|auth/i.test(msg) && /expired|invalid|missing|session/i.test(msg)) {
    return 'Your sign-in has expired. Please go back to Oasis19, sign in again, then return here.';
  }
  if (/failed to fetch|network|load failed/i.test(msg)) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  return fallback || 'Something went wrong. Please try again.';
}

function relTime(iso) {
  var t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  var s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  var m = Math.round(s / 60);
  if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
  var h = Math.round(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  var d = Math.round(h / 24);
  if (d < 30) return d + (d === 1 ? ' day ago' : ' days ago');
  return new Date(t).toLocaleDateString();
}

function bindCounter(inputId, counterId, max) {
  var inp = $(inputId), out = $(counterId);
  function upd() { out.textContent = inp.value.length + ' / ' + max; }
  inp.addEventListener('input', upd);
  upd();
  return upd;
}

/* ---------- boot ---------- */
async function init() {
  try {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      fatal('The page could not load a required component (vendor-supabase.js). Please refresh. If this keeps happening, contact Oasis19.');
      return;
    }
    sb = supabase.createClient(SB_URL, SB_KEY);
    wireStatic();
    var res = await sb.auth.getSession();
    var session = res && res.data && res.data.session;
    if (!session || !session.user) { showView('signedout'); return; }
    state.user = session.user;
    await route();
  } catch (e) {
    fatal('Something went wrong while loading this page. Please refresh and try again.');
  }
}

async function route() {
  showView('loading');
  var bRes = await sb.from('businesses').select('*').eq('owner_id', state.user.id).order('created_at', { ascending: true });
  if (bRes.error) { fatal(friendlyError(bRes.error, 'We could not load your business page. Please refresh.')); return; }
  var mine = bRes.data || [];
  if (mine.length) {
    var want = new URLSearchParams(location.search).get('b');
    var pick = mine[0];
    mine.forEach(function (x) { if (want && x.slug === want) pick = x; });
    state.biz = pick;
    if (mine.length > 1) {
      var bar = document.createElement('nav');
      bar.setAttribute('aria-label', 'Your business pages');
      bar.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin:0 0 12px;font-size:.95rem;';
      mine.forEach(function (x) {
        var a = document.createElement('a');
        a.href = '/community/business.html?b=' + encodeURIComponent(x.slug);
        a.textContent = x.name;
        if (x.id === pick.id) { a.style.fontWeight = '700'; a.setAttribute('aria-current', 'page'); }
        bar.appendChild(a);
      });
      var ed = $('view-editor');
      ed.parentNode.insertBefore(bar, ed);
    }
    openEditor(); return;
  }
  var rRes = await sb.from('business_requests').select('*').eq('user_id', state.user.id)
    .order('created_at', { ascending: false }).limit(1);
  if (rRes.error) { fatal(friendlyError(rRes.error, 'We could not load your request. Please refresh.')); return; }
  var req = rRes.data && rRes.data[0];
  if (req && req.status !== 'done') { showPending(req); return; }
  showView('request');
}

/* ---------- request + pending ---------- */
function showPending(req) {
  var declined = req.status === 'declined';
  $('pending-title').textContent = declined ? 'We could not build your page' : "We're building your page.";
  $('pending-text').textContent = declined
    ? 'Sorry, we were not able to set up a page for this request. Please contact Oasis19 if you would like us to take another look.'
    : 'We will let you know when it is ready to review. You can close this page and come back later.';
  $('pending-name').textContent = req.company_name || '';
  $('pending-url').textContent = req.website_url || '';
  showView('pending');
}

async function submitRequest(ev) {
  ev.preventDefault();
  var form = $('request-form');
  clearErrors(form);
  setMsg('req-msg', '');
  var name = $('req-name').value.trim();
  var url = normalizeUrl($('req-url').value);
  var bad = false;
  if (name.length < 2 || name.length > 120) {
    setErr('req-name-err', 'Please enter your company name (2 to 120 characters).');
    markInvalid('req-name'); bad = true;
  }
  if (!isHttpOrHttps(url)) {
    setErr('req-url-err', 'Please enter a valid website address, like example.com.');
    markInvalid('req-url'); bad = true;
  }
  if (bad) return;
  $('req-url').value = url;
  busy(['req-submit'], true);
  try {
    var r = await sb.rpc('request_business', { p_name: name, p_url: url });
    if (r.error) { setMsg('req-msg', friendlyError(r.error, 'We could not send your request. Please try again.'), false); return; }
    setMsg('req-msg', "Request received. We'll build your page and let you know when it's ready to review.", true);
    form.reset();
  } catch (e) {
    setMsg('req-msg', 'We could not send your request. Please try again.', false);
  } finally {
    busy(['req-submit'], false);
  }
}

/* ---------- editor: fill + collect ---------- */
function openEditor() {
  var b = state.biz;
  $('f-name').value = b.name || '';
  $('f-slug').value = 'https://oasis19.com/b/' + (b.slug || '');
  $('f-tagline').value = b.tagline || '';
  $('f-about').value = b.about || '';
  $('f-logo-url').value = b.logo_url || '';
  $('f-phone').value = b.phone || '';
  $('f-email').value = b.email || '';
  $('f-website').value = b.website || '';
  $('f-address').value = b.address || '';
  $('f-hours').value = b.hours || '';
  $('f-google').value = b.google_url || '';
  $('f-lat').value = b.lat == null ? '' : b.lat;
  $('f-lng').value = b.lng == null ? '' : b.lng;
  $('f-services').value = (Array.isArray(b.services) ? b.services : []).join('\n');
  clear($('reviews-list'));
  (Array.isArray(b.reviews) ? b.reviews : []).slice(0, 5).forEach(addReviewRow);
  updateCounters();
  syncStatusUI();
  renderPreview();
  showView('editor');
  if (b.status === 'published') loadPosts();
}

var counterUpdaters = [];
function updateCounters() { counterUpdaters.forEach(function (f) { f(); }); }

function syncStatusUI() {
  var st = state.biz.status;
  var chip = $('status-chip');
  chip.className = 'chip' + (st === 'review' ? ' review' : st === 'published' ? ' published' : '');
  chip.textContent = st === 'published' ? 'Published' : st === 'review' ? 'Ready for your review' : 'Draft';
  $('review-banner').hidden = st !== 'review';
  $('live-note').hidden = st !== 'published';
  $('public-link').href = '/b/' + encodeURIComponent(state.biz.slug || '');
  var shareUrl = 'https://oasis19.com/b/' + encodeURIComponent(state.biz.slug || '');
  var enc = encodeURIComponent(shareUrl);
  $('share-li').href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc;
  $('share-fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + enc;
  $('share-x').href = 'https://twitter.com/intent/tweet?url=' + enc + '&text=' + encodeURIComponent(state.biz.name || '');
  $('share-note').textContent = st === 'published'
    ? 'Paste this link anywhere. Other sites will show your logo, name and tagline as a preview.'
    : 'This link works once you publish your page.';
  $('btn-publish').hidden = st === 'published';
  $('btn-unpublish').hidden = st !== 'published';
  $('composer').hidden = st !== 'published';
  hideConfirm();
}

function addReviewRow(data) {
  var list = $('reviews-list');
  if (list.children.length >= 5) return;
  data = (data && data.nodeType === undefined && !data.target) ? data : {};
  var n = ++state.reviewSeq;
  var q = el('textarea', { id: 'rv-q-' + n, rows: '3', maxlength: '600', 'data-k': 'quote' });
  var a = el('input', { id: 'rv-a-' + n, type: 'text', maxlength: '120', 'data-k': 'author' });
  var s = el('input', { id: 'rv-s-' + n, type: 'text', inputmode: 'url', placeholder: 'https://', 'data-k': 'source_url' });
  q.value = data.quote || '';
  a.value = data.author || '';
  s.value = data.source_url || '';
  var err = el('p', { class: 'err', 'aria-live': 'polite', 'data-k': 'err' });
  var rm = el('button', { type: 'button', class: 'btn ghost small', 'data-act': 'rm-review', text: 'Remove this review' });
  var row = el('div', { class: 'review-row' }, [
    el('label', { for: q.id, text: 'Quote' }), q,
    el('label', { for: a.id, text: 'Author' }), a,
    el('label', { for: s.id, text: 'Source link (optional)' }), s,
    err, rm
  ]);
  list.appendChild(row);
  $('add-review').disabled = list.children.length >= 5;
}

function collectReviews() {
  var out = [], ok = true;
  $('reviews-list').querySelectorAll('.review-row').forEach(function (row) {
    var q = row.querySelector('[data-k=quote]').value.trim();
    var a = row.querySelector('[data-k=author]').value.trim();
    var sRaw = row.querySelector('[data-k=source_url]');
    var s = normalizeUrl(sRaw.value);
    var err = row.querySelector('[data-k=err]');
    err.textContent = '';
    if (!q && !a && !s) return;
    if (!q || !a) { err.textContent = 'Each review needs both a quote and the author name.'; ok = false; return; }
    if (s && !isHttps(s)) { err.textContent = 'The source link must start with https://'; ok = false; return; }
    sRaw.value = s;
    out.push({ quote: q, author: a, source_url: s || null });
  });
  return { ok: ok, list: out };
}

function parseServices() {
  return $('f-services').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
}

function checkUrlField(id, errId, label, required) {
  var v = normalizeUrl($(id).value);
  if (!v && !required) return '';
  if (!isHttps(v)) {
    setErr(errId, label + ' must be a full https:// web address.');
    markInvalid(id);
    return null;
  }
  $(id).value = v;
  return v;
}

function collectForm() {
  clearErrors($('biz-form'));
  var bad = false;
  function fail(errId, msg, inputId) { setErr(errId, msg); if (inputId) markInvalid(inputId); bad = true; }

  var name = $('f-name').value.trim();
  if (name.length < 2 || name.length > 120) fail('err-name', 'Company name must be 2 to 120 characters.', 'f-name');
  var tagline = $('f-tagline').value.trim();
  if (tagline.length > 160) fail('err-tagline', 'Tagline can be at most 160 characters.', 'f-tagline');
  var about = $('f-about').value.trim();
  if (about.length > 2000) fail('err-about', 'About can be at most 2000 characters.', 'f-about');

  var logo = checkUrlField('f-logo-url', 'err-logo-url', 'The logo link', false);
  var website = checkUrlField('f-website', 'err-website', 'The website', false);
  var google = checkUrlField('f-google', 'err-google', 'The Google reviews link', false);
  if (logo === null || website === null || google === null) bad = true;

  var phone = $('f-phone').value.trim();
  if (phone.length > 40) fail('err-phone', 'Phone number is too long.', 'f-phone');
  var email = $('f-email').value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('err-email', 'Please enter a valid email address.', 'f-email');
  var address = $('f-address').value.trim();
  if (address.length > 200) fail('err-address', 'Street address is too long (200 characters max).', 'f-address');
  var hours = $('f-hours').value.trim();
  if (hours.length > 600) fail('err-hours', 'Hours text is too long (600 characters max).', 'f-hours');

  var latRaw = $('f-lat').value.trim(), lngRaw = $('f-lng').value.trim();
  var lat = null, lng = null;
  if (latRaw || lngRaw) {
    lat = Number(latRaw); lng = Number(lngRaw);
    if (!latRaw || !lngRaw || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      fail('err-geo', 'Enter both a latitude (-90 to 90) and a longitude (-180 to 180), or leave both blank.', 'f-lat');
      markInvalid('f-lng'); lat = lng = null;
    }
  }

  var services = parseServices();
  if (services.length > 20) fail('err-services', 'Please list at most 20 services.', 'f-services');
  else if (services.some(function (s) { return s.length > 200; })) fail('err-services', 'Each service line can be at most 200 characters.', 'f-services');

  var rv = collectReviews();
  if (!rv.ok) { setErr('err-reviews', 'Please fix the highlighted review.'); bad = true; }

  if (bad) return null;
  return {
    name: name, tagline: tagline || null, about: about || null, logo_url: logo || null,
    phone: phone || null, email: email || null, website: website || null,
    address: address || null, hours: hours || null, google_url: google || null,
    lat: lat, lng: lng, services: services, reviews: rv.list
  };
}

/* ---------- save / publish ---------- */
async function saveBusiness(extra) {
  var data = collectForm();
  if (!data) { setMsg('save-msg', 'Please fix the problems marked above.', false); return false; }
  Object.keys(extra || {}).forEach(function (k) { data[k] = extra[k]; });
  var ids = ['btn-save', 'btn-publish', 'btn-unpublish', 'confirm-yes', 'confirm-no'];
  busy(ids, true);
  setMsg('save-msg', 'Saving...', true);
  try {
    var r = await sb.from('businesses').update(data).eq('id', state.biz.id).select('*').maybeSingle();
    if (r.error || !r.data) {
      setMsg('save-msg', friendlyError(r.error, 'We could not save your changes. Please try again.'), false);
      return false;
    }
    var wasPublished = state.biz.status === 'published';
    state.biz = r.data;
    syncStatusUI();
    renderPreview();
    if (!wasPublished && r.data.status === 'published') loadPosts();
    return true;
  } catch (e) {
    setMsg('save-msg', 'We could not save your changes. Please try again.', false);
    return false;
  } finally {
    busy(ids, false);
  }
}

async function onSave(ev) {
  ev.preventDefault();
  hideConfirm();
  var ok = await saveBusiness();
  if (ok) setMsg('save-msg', state.biz.status === 'published' ? 'Saved. Your changes are live.' : 'Saved.', true);
}

function askConfirm(kind) {
  state.pendingAction = kind;
  $('confirm-text').textContent = kind === 'publish'
    ? 'Publish your page so everyone can see it?'
    : 'Unpublish your page? It will no longer be visible to the public.';
  $('confirm-yes').textContent = kind === 'publish' ? 'Yes, publish' : 'Yes, unpublish';
  $('confirm-bar').hidden = false;
  $('confirm-yes').focus();
}
function hideConfirm() {
  state.pendingAction = null;
  $('confirm-bar').hidden = true;
}
async function doConfirm() {
  var kind = state.pendingAction;
  if (!kind) return;
  var ok = await saveBusiness({ status: kind === 'publish' ? 'published' : 'draft' });
  if (ok) {
    hideConfirm();
    setMsg('save-msg', kind === 'publish' ? 'Your page is published.' : 'Your page is unpublished and saved as a draft.', true);
  }
}

/* ---------- logo upload ---------- */
async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file); } catch (e) { /* fall through */ }
  }
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}
function squareBlob(src) {
  var w = src.width, h = src.height, side = Math.min(w, h);
  var c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise(function (resolve, reject) {
    c.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', 0.9);
  });
}
async function onLogoFile(ev) {
  var input = ev.target;
  var file = input.files && input.files[0];
  setErr('err-logo-file', '');
  if (!file) return;
  if (!/^image\//.test(file.type)) { setErr('err-logo-file', 'Please choose an image file.'); input.value = ''; return; }
  if (file.size > 8 * 1024 * 1024) { setErr('err-logo-file', 'That image is larger than 8 MB. Please choose a smaller one.'); input.value = ''; return; }
  input.disabled = true;
  setErr('err-logo-file', 'Uploading...');
  try {
    var blob = await squareBlob(await loadBitmap(file));
    var path = state.user.id + '/' + crypto.randomUUID() + '.jpg';
    var up = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) { setErr('err-logo-file', friendlyError(up.error, 'The upload failed. Please try again.')); return; }
    $('f-logo-url').value = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    setErr('err-logo-file', '');
    setMsg('save-msg', 'Logo uploaded. Press Save changes to keep it.', true);
    renderPreview();
  } catch (e) {
    setErr('err-logo-file', 'We could not read that image. Try a different file.');
  } finally {
    input.disabled = false;
    input.value = '';
  }
}

/* ---------- live preview ---------- */
function renderPreview() {
  var box = $('preview');
  clear(box);
  var logo = safeHttps(normalizeUrl($('f-logo-url').value));
  var thumb = $('logo-thumb');
  if (logo) { thumb.src = logo; thumb.hidden = false; } else { thumb.hidden = true; thumb.removeAttribute('src'); }

  var top = el('div', { class: 'pv-top' });
  if (logo) top.appendChild(el('img', { class: 'pv-logo', src: logo, alt: '' }));
  var main = el('div', { class: 'pv-main' }, [
    el('h1', { text: $('f-name').value.trim() || 'Your company name' })
  ]);
  var tag = $('f-tagline').value.trim();
  if (tag) main.appendChild(el('h2', { text: tag }));
  var about = $('f-about').value.trim();
  if (about) main.appendChild(el('p', { text: about }));
  top.appendChild(main);

  var contact = el('div', { class: 'pv-contact' }, [el('h3', { text: 'Contact' })]);
  var any = false;
  [['f-phone', 'Phone: '], ['f-email', 'Email: '], ['f-website', 'Web: '], ['f-address', ''], ['f-hours', 'Hours:\n']]
    .forEach(function (p) {
      var v = $(p[0]).value.trim();
      if (v) { contact.appendChild(el('p', { text: p[1] + v })); any = true; }
    });
  var g = safeHttps(normalizeUrl($('f-google').value));
  if (g) {
    contact.appendChild(el('p', {}, [el('a', { href: g, target: '_blank', rel: 'noopener noreferrer', text: 'Google reviews' })]));
    any = true;
  }
  if (any) top.appendChild(contact);
  box.appendChild(top);

  var revs = [];
  $('reviews-list').querySelectorAll('.review-row').forEach(function (row) {
    var q = row.querySelector('[data-k=quote]').value.trim();
    var a = row.querySelector('[data-k=author]').value.trim();
    var s = safeHttps(normalizeUrl(row.querySelector('[data-k=source_url]').value));
    if (q) revs.push({ q: q, a: a, s: s });
  });
  if (revs.length) {
    var strip = el('div', { class: 'pv-reviews' });
    revs.forEach(function (r) {
      var bq = el('blockquote', {}, [el('p', { text: '“' + r.q + '”' })]);
      var who = el('cite', { text: r.a ? '— ' + r.a : '' });
      bq.appendChild(who);
      if (r.s) bq.appendChild(el('p', {}, [el('a', { href: r.s, target: '_blank', rel: 'noopener noreferrer', text: ' Source' })]));
      strip.appendChild(bq);
    });
    box.appendChild(el('div', { class: 'pv-sec' }, [el('h3', { text: 'What customers say' }), strip]));
  }

  var svc = parseServices().slice(0, 20);
  if (svc.length) {
    var ul = el('ul', { class: 'pv-services' });
    svc.forEach(function (line) {
      var i = line.indexOf('|');
      var li = el('li');
      if (i > 0) {
        li.appendChild(el('strong', { text: line.slice(0, i).trim() }));
        var d = line.slice(i + 1).trim();
        if (d) li.appendChild(document.createTextNode(' – ' + d));
      } else li.textContent = line;
      ul.appendChild(li);
    });
    box.appendChild(el('div', { class: 'pv-sec' }, [el('h3', { text: 'Services' }), ul]));
  }
}

/* ---------- posts ---------- */
async function loadPosts() {
  var list = $('post-list');
  try {
    var r = await sb.from('posts').select('id, body, created_at').eq('business_id', state.biz.id)
      .order('created_at', { ascending: false }).limit(20);
    if (r.error) { setMsg('post-msg', friendlyError(r.error, 'We could not load your posts.'), false); return; }
    clear(list);
    var rows = r.data || [];
    $('post-empty').hidden = rows.length > 0;
    rows.forEach(function (p) { list.appendChild(postItem(p)); });
  } catch (e) {
    setMsg('post-msg', 'We could not load your posts.', false);
  }
}

function postItem(p) {
  var actions = el('div', { class: 'row-actions' });
  var li = el('li', { 'data-id': p.id }, [
    el('div', { class: 'when', text: relTime(p.created_at) }),
    el('div', { class: 'body', text: p.body || '' }),
    actions
  ]);
  showDeleteButton(actions, p.id);
  return li;
}
function showDeleteButton(actions, id) {
  clear(actions);
  var b = el('button', { type: 'button', class: 'btn danger small', text: 'Delete' });
  b.addEventListener('click', function () { showDeleteConfirm(actions, id); });
  actions.appendChild(b);
}
function showDeleteConfirm(actions, id) {
  clear(actions);
  var yes = el('button', { type: 'button', class: 'btn danger small', text: 'Yes, delete' });
  var no = el('button', { type: 'button', class: 'btn ghost small', text: 'Cancel' });
  no.addEventListener('click', function () { showDeleteButton(actions, id); });
  yes.addEventListener('click', async function () {
    yes.disabled = true; no.disabled = true;
    try {
      var r = await sb.from('posts').delete().eq('id', id);
      if (r.error) { setMsg('post-msg', friendlyError(r.error, 'We could not delete that post.'), false); showDeleteButton(actions, id); return; }
      setMsg('post-msg', 'Post deleted.', true);
      loadPosts();
    } catch (e) {
      setMsg('post-msg', 'We could not delete that post.', false);
      showDeleteButton(actions, id);
    }
  });
  actions.appendChild(el('span', { text: 'Delete this post?' }));
  actions.appendChild(yes);
  actions.appendChild(no);
  no.focus();
}

async function submitPost(ev) {
  ev.preventDefault();
  setErr('err-post', '');
  setMsg('post-msg', '');
  $('post-body').removeAttribute('aria-invalid');
  var body = $('post-body').value.trim();
  if (body.length < 1 || body.length > 1000) {
    setErr('err-post', 'Please write between 1 and 1000 characters.');
    markInvalid('post-body');
    return;
  }
  if (state.biz.status !== 'published') { setErr('err-post', 'Publish your page before posting.'); return; }
  busy(['post-submit'], true);
  try {
    var r = await sb.from('posts').insert({ user_id: state.user.id, body: body, business_id: state.biz.id });
    if (r.error) { setMsg('post-msg', friendlyError(r.error, 'We could not publish your post. Please try again.'), false); return; }
    $('post-body').value = '';
    updateCounters();
    setMsg('post-msg', 'Posted. It is now on your page and in the Oasis19 feed.', true);
    loadPosts();
  } catch (e) {
    setMsg('post-msg', 'We could not publish your post. Please try again.', false);
  } finally {
    busy(['post-submit'], false);
  }
}

/* ---------- wiring ---------- */
function wireStatic() {
  $('request-form').addEventListener('submit', submitRequest);
  $('biz-form').addEventListener('submit', onSave);
  $('post-form').addEventListener('submit', submitPost);
  $('f-logo-file').addEventListener('change', onLogoFile);
  $('btn-copy-link').addEventListener('click', function () {
    var u = 'https://oasis19.com/b/' + (state.biz && state.biz.slug || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(u).then(function () { setMsg('save-msg', 'Link copied.', true); }, function () { setMsg('save-msg', 'Could not copy. Select the page address and copy it.', false); });
    } else { $('f-slug').select(); setMsg('save-msg', 'Press Ctrl+C to copy the selected address.', true); }
  });
  $('btn-publish').addEventListener('click', function () {
    if (collectForm()) askConfirm('publish'); else setMsg('save-msg', 'Please fix the problems marked above.', false);
  });
  $('btn-unpublish').addEventListener('click', function () { askConfirm('unpublish'); });
  $('confirm-yes').addEventListener('click', doConfirm);
  $('confirm-no').addEventListener('click', hideConfirm);
  $('add-review').addEventListener('click', function () {
    addReviewRow({});
    var rows = $('reviews-list').querySelectorAll('.review-row');
    var last = rows[rows.length - 1];
    if (last) last.querySelector('textarea').focus();
    renderPreview();
  });
  $('reviews-list').addEventListener('click', function (ev) {
    var t = ev.target;
    if (t && t.getAttribute && t.getAttribute('data-act') === 'rm-review') {
      var row = t.closest('.review-row');
      if (row) row.parentNode.removeChild(row);
      $('add-review').disabled = false;
      $('add-review').focus();
      renderPreview();
    }
  });
  $('biz-form').addEventListener('input', function () { renderPreview(); });
  counterUpdaters.push(bindCounter('f-tagline', 'cnt-tagline', 160));
  counterUpdaters.push(bindCounter('f-about', 'cnt-about', 2000));
  counterUpdaters.push(bindCounter('post-body', 'cnt-post', 1000));
}

init();
})();
