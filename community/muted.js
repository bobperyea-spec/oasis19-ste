(function () {
  var URL_ = 'https://qcsnxchphbtgumdazbpq.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjc254Y2hwaGJ0Z3VtZGF6YnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNzc0NDQsImV4cCI6MjEwODk1MzQ0NH0.9iTTsSe09SQR_I3RGaYWrPUv8wR3H0pGyYJIFc-abgQ';
  var statusEl = document.getElementById('status');
  function say(t) { statusEl.textContent = t; }
  function row(list, label, href, onUndo) {
    var li = document.createElement('li');
    var left = document.createElement(href ? 'a' : 'span');
    left.textContent = label;
    if (href) left.href = href;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Follow again';
    btn.addEventListener('click', function () {
      btn.disabled = true;
      onUndo().then(function (ok) {
        if (ok) { li.remove(); say('Following again.'); } else { btn.disabled = false; say('Could not update. Please try again.'); }
      });
    });
    li.appendChild(left); li.appendChild(btn); list.appendChild(li);
  }
  async function main() {
    if (typeof supabase === 'undefined') { say('This page could not load. Please refresh.'); return; }
    var sb = supabase.createClient(URL_, KEY);
    var s = await sb.auth.getSession();
    var user = s.data && s.data.session && s.data.session.user;
    if (!user) { say('Please sign in at oasis19.com/community first, then come back.'); return; }
    var m1 = await sb.from('feed_mutes').select('muted_user_id');
    var m2 = await sb.from('feed_business_mutes').select('business_id');
    var ids = (m1.data || []).map(function (r) { return r.muted_user_id; });
    var bids = (m2.data || []).map(function (r) { return r.business_id; });
    var shown = 0;
    if (ids.length) {
      var pr = await sb.from('profiles').select('id, username, display_name').in('id', ids);
      var byId = {}; (pr.data || []).forEach(function (p) { byId[p.id] = p; });
      var pl = document.getElementById('peopleList');
      ids.forEach(function (id) {
        var p = byId[id]; var label = p ? (p.display_name || p.username || 'Member') : 'Member';
        row(pl, label, null, async function () { var r = await sb.from('feed_mutes').delete().eq('user_id', user.id).eq('muted_user_id', id); return !r.error; });
        shown++;
      });
      document.getElementById('people').hidden = false;
    }
    if (bids.length) {
      var br = await sb.from('businesses').select('id, name, slug').in('id', bids);
      var bl = document.getElementById('bizList');
      (br.data || []).forEach(function (b) {
        row(bl, b.name, '/b/' + b.slug, async function () { var r = await sb.from('feed_business_mutes').delete().eq('user_id', user.id).eq('business_id', b.id); return !r.error; });
        shown++;
      });
      document.getElementById('businesses').hidden = false;
    }
    say(shown ? '' : 'You haven’t unfollowed anyone.');
  }
  main().catch(function () { say('Something went wrong. Please refresh.'); });
})();
