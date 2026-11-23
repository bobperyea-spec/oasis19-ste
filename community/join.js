(function () {
'use strict';
var SB_URL = 'https://qcsnxchphbtgumdazbpq.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjc254Y2hwaGJ0Z3VtZGF6YnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNzc0NDQsImV4cCI6MjEwODk1MzQ0NH0.9iTTsSe09SQR_I3RGaYWrPUv8wR3H0pGyYJIFc-abgQ';
var COMMON = ['password','password1','1234567890','qwertyuiop','iloveyou123','letmein123','welcome123','admin12345','1q2w3e4r5t'];
function $(id) { return document.getElementById(id); }
function setErr(id, t) { $(id).textContent = t || ''; }
function normUrl(v) { v = (v || '').trim(); if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v; return v; }
function okUrl(v) { try { var u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.indexOf('.') > 0; } catch (e) { return false; } }
function done(title, text) { $('done-title').textContent = title; $('done-text').textContent = text; $('join-form-card').hidden = true; $('join-done').hidden = false; window.scrollTo(0, 0); }

if (typeof supabase === 'undefined' || !supabase.createClient) { $('j-msg').textContent = 'This page could not load a required component. Please refresh.'; return; }
var sb = supabase.createClient(SB_URL, SB_KEY);

$('join-form').addEventListener('submit', async function (ev) {
  ev.preventDefault();
  ['j-name','j-company','j-url','j-email','j-pass','j-agree'].forEach(function (k) { setErr('err-' + k, ''); });
  $('j-msg').textContent = '';
  var name = $('j-name').value.trim(), company = $('j-company').value.trim(), url = normUrl($('j-url').value);
  var email = $('j-email').value.trim(), pass = $('j-pass').value, bad = false;
  if (name.length < 2) { setErr('err-j-name', 'Please enter your name.'); bad = true; }
  if (company.length < 2 || company.length > 120) { setErr('err-j-company', 'Please enter your company name.'); bad = true; }
  if (!okUrl(url)) { setErr('err-j-url', 'Please enter a valid website address, like example.com.'); bad = true; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('err-j-email', 'Please enter a valid email address.'); bad = true; }
  if (pass.length < 10) { setErr('err-j-pass', 'Please use at least 10 characters.'); bad = true; }
  else if (COMMON.indexOf(pass.toLowerCase()) >= 0 || /^(.)\1+$/.test(pass)) { setErr('err-j-pass', 'That password is too easy to guess. Please pick another.'); bad = true; }
  if (!$('j-agree').checked) { setErr('err-j-agree', 'Please agree to continue.'); bad = true; }
  if (bad) return;
  $('j-submit').disabled = true;
  try {
    var username = name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    var r = await sb.auth.signUp({ email: email, password: pass, options: {
      emailRedirectTo: location.origin + '/community/business.html',
      data: { username: username, display_name: name.slice(0, 40), company_name: company, website_url: url }
    } });
    if (r.error) {
      var m = /already|registered/i.test(r.error.message || '') ? 'That email already has an Oasis19 account. Sign in at the link below the form, then open your business page.' : (r.error.message || 'We could not create your account. Please try again.');
      $('j-msg').textContent = m; return;
    }
    if (r.data && r.data.session) {
      var q = await sb.rpc('request_business', { p_name: company, p_url: url });
      if (q.error) { done('Welcome to Oasis19', 'Your account is ready. Open your business page to finish your request: https://oasis19.com/community/business.html'); return; }
      done('Thank you for joining the Oasis19 team!', 'We are building your page from your website now. We will email you a link when it is ready to review.');
    } else {
      done('Almost there: check your email', 'We sent a confirmation link to ' + email + '. Click it to confirm your account and your request goes straight in. Then we build your page and email you when it is ready.');
    }
  } catch (e) {
    $('j-msg').textContent = 'Something went wrong. Please try again.';
  } finally {
    $('j-submit').disabled = false;
  }
});
})();
