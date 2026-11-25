// Signed-in members go straight to the app; everyone else (including search engines) sees the page.
(function () {
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k)) { location.replace('/community/'); return; }
    }
  } catch (e) {}
})();
