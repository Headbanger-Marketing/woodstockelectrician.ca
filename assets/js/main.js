/* Enquiry contract matches the established lead-intake field IDs. */
(() => {
  'use strict';
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('open', open);
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    toggle?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const wasOpen = nav?.classList.contains('open');
      toggle?.setAttribute('aria-expanded', 'false');
      nav?.classList.remove('open');
      if (wasOpen) toggle?.focus();
    }
  });
})();

/* Receipt-confirmed enquiries. Keep field IDs compatible with the intake workflow. */
(function () {
  "use strict";
  var d = document;
  // A live site posts to its own forms.<domain> intake. Previews and local servers use the shared intake.
  var sharedIntake = "https://bc-turf-agent-pilot.tien-228.workers.dev/intake/hvac-form";
  function intakeUrl(form) {
    var domain = String(form.dataset.domain || "").toLowerCase();
    return domain && location.hostname.toLowerCase().replace(/^www\./, "") === domain ? "https://forms." + domain + "/" : sharedIntake;
  }
  var forms = d.querySelectorAll("form[data-quote-form], form[data-enquiry-form]");
  function sourceUrl(path, search) {
    var url = new URL(path || window.location.pathname, window.location.origin);
    var query = new URLSearchParams(search === undefined ? window.location.search : search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "fbclid"].forEach(function (key) {
      if (query.has(key)) url.searchParams.set(key, query.get(key).slice(0, 512));
    });
    return url.href;
  }


  function focusQuote() {
    if (window.location.hash !== "#quote") return;
    var form = d.getElementById("quote");
    if (!form) return;
    var header = d.querySelector(".site-header");
    form.style.scrollMarginTop = Math.max(24, (header ? header.getBoundingClientRect().bottom : 0) + 24) + "px";
    form.scrollIntoView({ block: "start", behavior: "instant" });
    var first = form.querySelector('input[name="name"]');
    if (first) first.focus({ preventScroll: true });
  }
  d.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var destination = new URL(link.href, window.location.href);
    if (destination.origin === window.location.origin && destination.hash === "#quote" && d.getElementById("quote")) {
      event.preventDefault();
      window.location.hash = "quote";
      requestAnimationFrame(focusQuote);
    }
  });
  window.addEventListener("hashchange", focusQuote);
  window.addEventListener("load", focusQuote, { once: true });
  if (window.location.hash === "#quote") requestAnimationFrame(focusQuote);

  forms.forEach(function (form) {
    if (form.dataset.leadSubmitBound === "true") return;
    var busy = false;
    var received = false;
    var status = form.querySelector(".form-status");
    var button = form.querySelector('button[type="submit"]');
    var preferred = form.querySelector('[name="preferred_contact"]');
    function contactChoice() {
      var choice = preferred ? preferred.value : "email";
      ["email", "phone"].forEach(function (name) {
        var input = form.querySelector('[name="' + name + '"]');
        if (!input) return;
        input.disabled = preferred ? name !== choice : false;
        input.required = preferred ? name === choice : true;
        var field = input.closest("[data-contact-field]");
        if (field) { field.hidden = preferred ? name !== choice : false; field.classList.remove("invalid"); }
        input.removeAttribute("aria-invalid");
      });
    }
    if (preferred) preferred.addEventListener("change", contactChoice);
    contactChoice();

    function fieldFor(input) { return input.closest("[data-field], .field > div, .field, label"); }
    function validInput(input) {
      if (input.disabled) return true;
      var value = input.value.trim();
      if (input.type === "checkbox") return !input.required || input.checked;
      if (input.required && !value) return false;
      if (!value) return true;
      if (input.type === "email") return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && input.checkValidity();
      if (input.type === "tel") return /^[+()\d\s.\-]+$/.test(value) && value.replace(/\D/g, "").length >= 10 && value.replace(/\D/g, "").length <= 15;
      if (input.name === "postal") return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ][ -]?\d[ABCEGHJ-NPRSTVWXYZ]\d$/i.test(value);
      return input.checkValidity();
    }
    form.querySelectorAll("input, textarea, select").forEach(function (input) {
      input.addEventListener("input", function () {
        var field = fieldFor(input);
        if (field) field.classList.remove("invalid");
        input.removeAttribute("aria-invalid");
      });
    });
    function showStatus(ok, text) {
      if (!status) return;
      status.className = "form-status " + (ok ? "ok" : "err error");
      status.textContent = text;
    }
    function accepted(ack) {
      if (!ack || typeof ack !== "object" || Array.isArray(ack)) return false;
      var negative = ack.accepted === false || ack.success === false || ack.ok === false || ack.failed === true || ack.rejected === true || ack.receipt === "not_confirmed"
        || Boolean(ack.error) || (Array.isArray(ack.errors) ? ack.errors.length > 0 : Boolean(ack.errors))
        || /^(error|failed|failure|rejected|denied)$/i.test(String(ack.status || ""));
      return !negative && (ack.accepted === true || ack.success === true);
    }
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (busy || received) return;
      var firstInvalid = null;
      form.querySelectorAll("input, textarea, select").forEach(function (input) {
        if (input.disabled || input.name === "website") return;
        var ok = validInput(input);
        var field = fieldFor(input);
        if (field) field.classList.toggle("invalid", !ok);
        input.setAttribute("aria-invalid", String(!ok));
        if (!ok && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) {
        showStatus(false, "Please check the highlighted details before sending your request.");
        var details = firstInvalid.closest("details");
        if (details) details.open = true;
        firstInvalid.focus();
        return;
      }
      var value = function (name) {
        var input = form.querySelector('[name="' + name + '"]');
        return input && !input.disabled ? input.value.trim() : "";
      };
      if (value("website")) return;
      var now = new Date();
      var pad = function (x) { return String(x).padStart(2, "0"); };
      var stamp = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
      var message = value("message");
      var electrical = form.hasAttribute("data-enquiry-form");
      var service = value("service");
      if (electrical && service) message = "Electrical project: " + service + "\n" + message;
      var submittedChannel = value("preferred_contact") || "email";
      var payload = new URLSearchParams({
        "1.3": value("name"), "2": value("email"), "3": message, "4": value("phone"),
        "5.1": value("address"), "5.3": value("city"), "5.5": value("postal"),
        source_url: sourceUrl(), date_created: stamp, preferred_contact: submittedChannel
      });
      if (form.querySelector('[name="consent"]')) payload.append("consent", "contact_and_provider_assessment_agreed");
      if (electrical) { payload.append("source_domain", form.dataset.domain); payload.append("trade", "Electrical"); payload.append("service", service); }
      busy = true;
      if (button) button.disabled = true;
      form.setAttribute("aria-busy", "true");
      showStatus(true, "Sending your request. Please wait for receipt confirmation.");
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 90000);
      try {
        var response = await fetch(intakeUrl(form), {
          method: "POST", mode: "cors", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: payload.toString(), signal: controller.signal
        });
        if (!response.ok) throw new Error("Receipt unconfirmed");
        var ack = await response.json();
        if (!accepted(ack)) throw new Error("Receipt unconfirmed");
        received = true;
        form.dataset.receiptConfirmed = "true";
        showStatus(true, "Thank you. Your request has been received for review. Coverage, availability and any appointment require separate confirmation. " + (submittedChannel === "phone" ? "Watch for a phone call using the number you provided." : "Check the email address you provided for follow-up."));
        if (form.dataset.redirectOnSuccess) window.location.href = form.dataset.redirectOnSuccess;
      } catch (error) {
        showStatus(false, "We could not confirm receipt. Your request may already have reached intake. Your details are still here. Email contact@" + (form.dataset.domain || window.location.hostname) + " to confirm before sending again.");
      } finally {
        clearTimeout(timer);
        busy = false;
        form.removeAttribute("aria-busy");
        if (button) button.disabled = received;
        if (status && !form.dataset.redirectOnSuccess) status.focus({ preventScroll: true });
        else if (status && !received) status.focus({ preventScroll: true });
      }
    });
    form.dataset.leadSubmitBound = "true";
    if (button) button.disabled = false;
    var fallback = form.querySelector("[data-form-fallback]");
    if (fallback) fallback.hidden = true;
  });
})();
