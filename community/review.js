(function () {
  "use strict";

  var API_URL = "https://qcsnxchphbtgumdazbpq.supabase.co/functions/v1/business-review";
  var TOKEN_PATTERN = /^[0-9a-f]{48}$/;
  var LIMITS = {
    name: 120,
    tagline: 160,
    about: 1900,
    serviceLines: 12,
    serviceLength: 80
  };
  var MSG = {
    invalidLink: "This link isn't valid. Please use the button in your email.",
    network: "We couldn't reach the server. Check your internet connection and try again.",
    generic: "Something went wrong. Please try again in a moment.",
    loading: "Loading your page...",
    saving: "Saving your changes...",
    saved: "Changes saved.",
    publishing: "Saving and publishing your page...",
    needName: "Please add your company name."
  };

  var token = "";
  var pageUrl = "";
  var el = {};

  function $(id) {
    return document.getElementById(id);
  }

  function isHttpsUrl(value) {
    if (typeof value !== "string" || value === "") {
      return false;
    }
    try {
      var parsed = new URL(value);
      return parsed.protocol === "https:" && parsed.hostname !== "";
    } catch (err) {
      return false;
    }
  }

  function asText(value) {
    return typeof value === "string" ? value : "";
  }

  function showStatus(message) {
    el.status.textContent = message;
    if (message) {
      el.status.scrollIntoView({ block: "nearest" });
    }
  }

  function showError(message) {
    el.alert.textContent = message;
    if (message) {
      el.alert.scrollIntoView({ block: "nearest" });
    }
  }

  function setBusy(isBusy) {
    el.saveBtn.disabled = isBusy;
    el.approveBtn.disabled = isBusy;
    el.form.setAttribute("aria-busy", isBusy ? "true" : "false");
  }

  function splitServices(raw) {
    return raw
      .split(/\r\n|\r|\n/)
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; });
  }

  function readFields() {
    return {
      name: el.name.value.trim(),
      tagline: el.tagline.value.trim(),
      about: el.about.value.trim(),
      services: splitServices(el.services.value),
      website: el.website.value.trim(),
      phone: el.phone.value.trim(),
      email: el.email.value.trim(),
      hours: el.hours.value.trim(),
      address: el.address.value.trim(),
      logo_url: el.logoUrl.value.trim()
    };
  }

  function findProblem(f) {
    if (f.name === "") {
      return MSG.needName;
    }
    if (f.name.length > LIMITS.name) {
      return "Company name can be up to " + LIMITS.name + " characters.";
    }
    if (f.tagline.length > LIMITS.tagline) {
      return "Tagline can be up to " + LIMITS.tagline + " characters.";
    }
    if (f.about.length > LIMITS.about) {
      return "About can be up to " + LIMITS.about + " characters.";
    }
    if (f.services.length > LIMITS.serviceLines) {
      return "Services can have up to " + LIMITS.serviceLines + " lines. Please remove " +
        (f.services.length - LIMITS.serviceLines) + " to continue.";
    }
    for (var i = 0; i < f.services.length; i++) {
      if (f.services[i].length > LIMITS.serviceLength) {
        return "Service " + (i + 1) + " is longer than " + LIMITS.serviceLength +
          " characters. Please shorten it.";
      }
    }
    if (f.website !== "" && !isHttpsUrl(f.website)) {
      return "Website must be a full web address that starts with https://";
    }
    if (f.logo_url !== "" && !isHttpsUrl(f.logo_url)) {
      return "Logo image link must be a full web address that starts with https://";
    }
    return "";
  }

  function refreshCounts() {
    el.taglineCount.textContent = el.tagline.value.length + " of " + LIMITS.tagline + " characters used";
    el.aboutCount.textContent = el.about.value.length + " of " + LIMITS.about + " characters used";
  }

  function updatePreview() {
    var url = el.logoUrl.value.trim();
    if (isHttpsUrl(url)) {
      if (el.logoPreview.getAttribute("src") !== url) {
        el.logoPreview.setAttribute("src", url);
      }
    } else {
      el.logoPreview.hidden = true;
      el.logoPreview.removeAttribute("src");
    }
  }

  function rememberPageUrl(url) {
    if (isHttpsUrl(url)) {
      pageUrl = url;
    }
  }

  function setLive(isLive) {
    el.liveBox.hidden = !isLive;
    if (pageUrl !== "") {
      el.liveLink.href = pageUrl;
      el.liveLink.hidden = false;
    } else {
      el.liveLink.hidden = true;
    }
  }

  function showLiveSuccess() {
    el.status.textContent = "";

    var heading = document.createElement("strong");
    heading.textContent = "Your page is live!";
    el.status.appendChild(heading);

    if (pageUrl !== "") {
      el.status.appendChild(document.createTextNode(" See it here: "));
      var link = document.createElement("a");
      link.href = pageUrl;
      link.textContent = pageUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      el.status.appendChild(link);
      el.status.appendChild(document.createTextNode("."));
    }

    var note = document.createElement("p");
    note.textContent = "You can reopen the email link any time to make changes.";
    el.status.appendChild(note);

    el.status.scrollIntoView({ block: "nearest" });
  }

  async function callApi(action, fields) {
    var body = { t: token, action: action };
    if (fields) {
      body.fields = fields;
    }

    var res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer"
      });
    } catch (netErr) {
      throw new Error(MSG.network);
    }

    var data = null;
    try {
      data = await res.json();
    } catch (parseErr) {
      data = null;
    }

    if (!data || typeof data !== "object" || typeof data.ok !== "boolean") {
      throw new Error(MSG.generic);
    }
    if (!data.ok) {
      throw new Error(asText(data.error) || MSG.generic);
    }
    return data;
  }

  function applyBusiness(business) {
    var b = business || {};
    el.name.value = asText(b.name);
    el.tagline.value = asText(b.tagline);
    el.about.value = asText(b.about);
    el.services.value = Array.isArray(b.services)
      ? b.services.filter(function (s) { return typeof s === "string"; }).join("\n")
      : "";
    el.website.value = asText(b.website);
    el.phone.value = asText(b.phone);
    el.email.value = asText(b.email);
    el.hours.value = asText(b.hours);
    el.address.value = asText(b.address);
    el.logoUrl.value = asText(b.logo_url);

    refreshCounts();
    updatePreview();
    setLive(b.status === "published");
  }

  async function loadPage() {
    showStatus(MSG.loading);
    try {
      var data = await callApi("get");
      rememberPageUrl(data.page_url);
      applyBusiness(data.business);
      showStatus("");
      el.intro.hidden = false;
      el.card.hidden = false;
    } catch (err) {
      showStatus("");
      showError(err.message);
    }
  }

  async function handleSave() {
    showError("");
    var fields = readFields();
    var problem = findProblem(fields);
    if (problem) {
      showError(problem);
      return;
    }

    setBusy(true);
    showStatus(MSG.saving);
    try {
      var data = await callApi("save", fields);
      showStatus(MSG.saved);
      if (data.business) {
        setLive(data.business.status === "published");
      }
    } catch (err) {
      showStatus("");
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    showError("");
    var fields = readFields();
    var problem = findProblem(fields);
    if (problem) {
      showError(problem);
      return;
    }

    setBusy(true);
    showStatus(MSG.publishing);
    try {
      await callApi("save", fields);
      var data = await callApi("approve");
      rememberPageUrl(data.page_url);
      setLive(true);
      showLiveSuccess();
    } catch (err) {
      showStatus("");
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function init() {
    el.form = $("review-form");
    el.saveBtn = $("save-btn");
    el.approveBtn = $("approve-btn");
    el.intro = $("intro");
    el.card = $("card");
    el.status = $("status");
    el.alert = $("alert");
    el.liveBox = $("live-box");
    el.liveLink = $("live-link");
    el.name = $("name");
    el.tagline = $("tagline");
    el.taglineCount = $("tagline-count");
    el.about = $("about");
    el.aboutCount = $("about-count");
    el.services = $("services");
    el.website = $("website");
    el.phone = $("phone");
    el.email = $("email");
    el.hours = $("hours");
    el.address = $("address");
    el.logoUrl = $("logo-url");
    el.logoPreview = $("logo-preview");

    var params = new URLSearchParams(window.location.search);
    token = params.get("t") || "";
    if (!TOKEN_PATTERN.test(token)) {
      showError(MSG.invalidLink);
      return;
    }

    el.form.addEventListener("submit", function (event) {
      event.preventDefault();
      handleSave();
    });
    el.approveBtn.addEventListener("click", function () {
      handleApprove();
    });
    el.tagline.addEventListener("input", refreshCounts);
    el.about.addEventListener("input", refreshCounts);
    el.logoUrl.addEventListener("input", updatePreview);
    el.logoPreview.addEventListener("load", function () {
      el.logoPreview.hidden = false;
    });
    el.logoPreview.addEventListener("error", function () {
      el.logoPreview.hidden = true;
      el.logoPreview.removeAttribute("src");
    });

    loadPage();
  }

  init();
})();
