/* SKRIPTA Coffice booking widget.
   Live mode: talks to /api/dostupnost, /api/raspored, /api/cijena and /api/rezervacija (Cloudflare Pages Functions).
   Open days, hours and discounts come from /api/raspored (edited on the occupancy dashboard).
   Demo mode (API not reachable, e.g. local preview): simulated availability, nothing is sent. */
(function () {
  var root = document.getElementById('rezervacija');
  if (!root) return;

  var PRICES = { ind: { 1: 7, 2: 12, 4: 20, 6: 26 }, lounge: { 1: 6, 2: 10, 4: 15 } };
  var NAMES = { ind: 'Quiet zona', lounge: 'Lounge zona' };
  var OPEN = 9 * 60, CLOSE = 18 * 60 + 30, STEP = 30, LEAD_MIN = 60;

  var $ = function (s) { return root.querySelector(s); };
  var el = {
    flag: $('#b-flag'), date: $('#b-date'), slots: $('#b-slots'), slotHint: $('#b-slot-hint'), persons: $('#b-persons'),
    personsWrap: $('#b-persons-wrap'), dayMsg: $('#b-day-msg'),
    sZone: $('#s-zone'), sWhen: $('#s-when'), sPeople: $('#s-people'), sDur: $('#s-dur'),
    total: $('#s-total'), totalSub: $('#s-total-sub'), btn: $('#b-confirm'),
    need: $('#b-need'), pOut: $('#b-persons-out'), minus: $('#b-minus'), plus: $('#b-plus'),
    promoWrap: $('#b-promo-wrap'), promo: $('#b-promo'), promoBtn: $('#b-promo-btn'), promoErr: $('#e-promo'), promoOk: $('#o-promo'),
    name: $('#b-name'), email: $('#b-email'), phone: $('#b-phone'), web: $('#b-web'), news: $('#b-news'), out: $('#b-out'), err: $('#b-err')
  };
  var state = { zone: 'ind', dur: 1, start: null, live: false, seq: 0, promo: null, promoSig: '', sched: null, quote: null, quoting: '' };
  function km(n) { return String(n).replace('.', ','); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function parseDate(v) { var p = v.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function persons() { return +el.persons.value || 1; }

  /* ---------- demo availability (simulated) ---------- */
  function demoWholeDay(v) { return hash('full' + v) % 11 === 0; }
  function demoBusy(v, zone, group) {
    var h = hash(v + zone + group);
    if ((h >> 8) % 2 === 0) return [0, 0];
    var start = OPEN + (h % 16) * STEP, len = (2 + (h >> 4) % 4) * STEP;
    return [start, start + len];
  }
  function demoFree(v, zone, group, a, b) { var w = demoBusy(v, zone, group); return b <= w[0] || a >= w[1]; }
  function demoSlot(v, a, b, n) {
    if (demoWholeDay(v)) return false;
    if (state.zone === 'cafe') return (n <= 3 && demoFree(v, 'cafe', 'A', a, b)) || (n <= 2 && demoFree(v, 'cafe', 'B', a, b));
    return demoFree(v, state.zone, 'x', a, b);
  }
  function demoStarts(v, dur, n) {
    var now = new Date(), out = [];
    for (var t = OPEN; t + dur <= CLOSE; t += STEP) {
      var ok = demoSlot(v, t, t + dur, n);
      if (iso(now) === v && t < now.getHours() * 60 + now.getMinutes() + LEAD_MIN) ok = false;
      if (ok) out.push(t);
    }
    return out;
  }

  /* ---------- rendering ---------- */
  function drawSlots(allowed, dur, open, close, deals) {
    open = open == null ? OPEN : open; close = close == null ? CLOSE : close; deals = deals || {};
    var anyDeal = false;
    el.slots.innerHTML = '';
    for (var t = open; t < close; t += STEP) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'slot'; b.textContent = fmt(t); b.dataset.t = t;
      b.disabled = allowed.indexOf(t) < 0;
      if (!b.disabled && deals[t]) {
        anyDeal = true;
        var sm = document.createElement('small'); sm.textContent = '-' + deals[t] + '%';
        sm.style.cssText = 'display:block;font-size:11px;font-weight:700;line-height:1.1;margin-top:2px';
        b.appendChild(sm);
      }
      if (t + dur > close) b.title = 'Nema dovoljno vremena do zatvaranja';
      b.setAttribute('aria-pressed', String(state.start === t));
      el.slots.appendChild(b);
    }
    if (state.start !== null && allowed.indexOf(state.start) < 0) state.start = null;
    el.slotHint.textContent = allowed.length ? 'Prikazani su slobodni termini. Precrtani su zauzeti ili prekasni.' + (anyDeal ? ' Oznaka -% znači popust u tom terminu.' : '') : 'Nema slobodnih termina za ovaj izbor. Probajte drugi datum ili kraće trajanje.';
    update();
  }
  function message(text) { el.dayMsg.textContent = text; el.dayMsg.hidden = false; el.slots.innerHTML = ''; el.slotHint.textContent = ''; state.start = null; update(); }

  // Saturdays after this date are closed for now (same rule as functions/_lib/rules.js).
  var SAT_CLOSED_AFTER = '2026-11-08';
  // Dates after this are not bookable yet: show "uskoro" and collect an email (same constant as functions/_lib/rules.js).
  var BOOKING_UNTIL = '2099-12-31';
  // With the schedule from the server a day is open only if the schedule says so; without it (demo) the old rules apply.
  function closedDay(d) {
    if (state.sched) { var x = state.sched.days[iso(d)]; return !x || !!x.closed; }
    return d.getDay() === 0 || (d.getDay() === 6 && iso(d) > SAT_CLOSED_AFTER);
  }
  function dayInfo(v) { return state.sched ? (state.sched.days[v] || null) : null; }
  function renderSlots() {
    var v = el.date.value;
    el.dayMsg.hidden = true;
    if (!v) return message('Trenutno nema dana otvorenih za rezervaciju. Piši nam na info@skripta.ba.');
    var d = parseDate(v);
    if (closedDay(d)) return message(d.getDay() === 0 ? 'Nedjeljom ne radimo.' : 'Taj dan ne radimo. Odaberi drugi dan.');
    if (v > BOOKING_UNTIL) return message('Rezervacije za taj datum još nisu otvorene.');
    var dur = state.dur * 60, n = persons();
    if (!state.live) {
      if (demoWholeDay(v)) return message('Taj dan je cijeli prostor rezervisan za grupu (primjer povezanosti s najmom cijelog prostora).');
      return drawSlots(demoStarts(v, dur, n), dur);
    }
    var seq = ++state.seq;
    el.slotHint.textContent = 'Učitavam termine...';
    fetch('/api/dostupnost?zona=' + state.zone + '&trajanje=' + state.dur + '&osobe=' + n + '&datum=' + v, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (seq !== state.seq) return;
        if (!j.ok) return message(j.error || 'Termini trenutno nisu dostupni.');
        if (j.wholeSpace && !j.starts.length) return message('Taj dan je prostor zauzet. Probajte drugi datum.');
        drawSlots(j.starts, dur, j.open, j.close, j.popusti);
      })
      .catch(function () { if (seq === state.seq) message('Ne možemo učitati termine. Pokušaj ponovo ili nam piši na info@skripta.ba.'); });
  }

  /* ---------- form fields: inline validation ---------- */
  var TYPOS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gnail.com': 'gmail.com', 'gamil.com': 'gmail.com',
    'hotmial.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'outlok.com': 'outlook.com', 'outllook.com': 'outlook.com' };
  var CHECKS = {
    name: function (v) { return v.split(/\s+/).filter(Boolean).length < 2 ? 'Upiši ime i prezime.' : ''; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Upiši ispravan email, na njega šaljemo potvrdu.'; },
    phone: function (v) { var d = v.replace(/\D/g, ''); return /^\+?[\d\s().\/-]{6,}$/.test(v) && d.length >= 8 && d.length <= 15 ? '' : 'Upiši broj telefona, npr. +387 62 123 456.'; }
  };
  function fieldErr(key) { return root.querySelector('#e-' + key); }
  function showErr(key, msg, html) {
    var f = el[key], e = fieldErr(key); if (!f || !e) return;
    if (msg) { if (html) e.innerHTML = msg; else e.textContent = msg; e.hidden = false; f.setAttribute('aria-invalid', 'true'); f.classList.add('bad'); }
    else { e.hidden = true; e.textContent = ''; f.removeAttribute('aria-invalid'); f.classList.remove('bad'); }
  }
  function validate(key, loud) {
    var v = el[key].value.trim(), msg = CHECKS[key](v);
    if (key === 'email' && !msg) {
      var dom = v.slice(v.lastIndexOf('@') + 1).toLowerCase();
      if (TYPOS[dom]) { showErr(key, 'Misliš li <button type="button" class="fix" data-fix="' + esc(v.slice(0, v.lastIndexOf('@') + 1) + TYPOS[dom]) + '">' + esc(v.slice(0, v.lastIndexOf('@') + 1) + TYPOS[dom]) + '</button>?', true); return 'typo'; }
    }
    if (!v && !loud) { showErr(key, ''); return msg; }
    showErr(key, msg);
    return msg;
  }
  ['name', 'email', 'phone'].forEach(function (k) {
    el[k].addEventListener('blur', function () { validate(k, false); needUpdate(); });
    el[k].addEventListener('input', function () { if (el[k].classList.contains('bad')) validate(k, true); needUpdate(); });
  });
  root.addEventListener('click', function (e) {
    var fx = e.target.closest && e.target.closest('.fix');
    if (fx) { el.email.value = fx.dataset.fix; showErr('email', ''); needUpdate(); el.email.focus(); }
  });
  function needUpdate() {
    if (!el.need) return;
    var miss = [];
    if (state.start === null) miss.push('vrijeme početka');
    if (CHECKS.name(el.name.value.trim())) miss.push('ime i prezime');
    if (CHECKS.email(el.email.value.trim())) miss.push('email');
    if (CHECKS.phone(el.phone.value.trim())) miss.push('telefon');
    el.need.hidden = miss.length === 0;
    el.need.textContent = miss.length ? 'Još fali: ' + miss.join(', ') + '.' : '';
  }

  /* ---------- persons stepper (keeps the hidden select in sync) ---------- */
  function setPersons(n) {
    n = Math.max(1, Math.min(4, n));
    if (+el.persons.value === n) { syncPersons(); return; }
    el.persons.value = String(n);
    el.persons.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function syncPersons() {
    var n = persons();
    if (el.pOut) el.pOut.textContent = n + (n === 1 ? ' osoba' : ' osobe');
    if (el.minus) el.minus.disabled = n <= 1;
    if (el.plus) el.plus.disabled = n >= 4;
  }
  if (el.minus) el.minus.addEventListener('click', function () { setPersons(persons() - 1); });
  if (el.plus) el.plus.addEventListener('click', function () { setPersons(persons() + 1); });

  var FREE_DATES = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
  function isFree() {
    var v = el.date.value, x = dayInfo(v);
    return x ? !!x.free : (!state.sched && FREE_DATES.indexOf(v) >= 0);
  }
  /* Server quote for the chosen start time (discount aware). Display only: the server calculates the price again on submit. */
  function quoteKey() { return [state.zone, state.dur, persons(), el.date.value, state.start].join('|'); }
  function currentQuote() { return state.quote && state.quote.key === quoteKey() ? state.quote : null; }
  function requestQuote() {
    if (!state.live || state.start === null || currentQuote()) return;
    var key = quoteKey(); if (state.quoting === key) return;
    state.quoting = key;
    var base = PRICES[state.zone][state.dur] * persons(), none = { key: key, base: base, pct: 0, label: '' };
    fetch('/api/cijena?zona=' + state.zone + '&trajanje=' + state.dur + '&osobe=' + persons() + '&datum=' + el.date.value + '&pocetak=' + state.start, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { state.quote = j && j.ok ? { key: key, base: j.base, pct: j.pct, label: j.label } : none; })
      .catch(function () { state.quote = none; })
      .then(function () { state.quoting = ''; update(); });
  }
  /* Price for the current choice, with the promo discount when a code is applied (server rounds the same way, to 0,5 KM). */
  function curTotal() {
    if (isFree()) return 0;
    var q = currentQuote(), pct = Math.max(state.promo ? state.promo.pct : 0, q ? q.pct : 0); // the better of promo code and schedule discount
    return Math.max(0, Math.round(PRICES[state.zone][state.dur] * persons() * (1 - pct / 100) * 2) / 2);
  }
  function promoSig() { return [state.zone, state.dur, persons(), el.date.value].join('|'); }
  function promoMsg(err, ok) {
    if (el.promoErr) { el.promoErr.textContent = err || ''; el.promoErr.hidden = !err; }
    if (el.promoOk) { el.promoOk.textContent = ok || ''; el.promoOk.hidden = !ok; }
  }
  function checkPromo(manual) {
    var code = el.promo.value.trim();
    if (!code) { state.promo = null; promoMsg(manual ? 'Upiši promo kod.' : '', ''); update(); return; }
    var sig = promoSig(); state.promoSig = sig;
    el.promoBtn.disabled = true;
    fetch('/api/promo?kod=' + encodeURIComponent(code) + '&zona=' + state.zone + '&trajanje=' + state.dur + '&osobe=' + persons() + '&datum=' + el.date.value + '&email=' + encodeURIComponent(el.email.value.trim()) + '&telefon=' + encodeURIComponent(el.phone.value.trim()), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        el.promoBtn.disabled = false;
        if (sig !== promoSig()) return;
        if (j && j.ok) { state.promo = { code: j.code, pct: j.pct }; el.promo.value = j.code; promoMsg('', 'Kod primijenjen: ' + j.pct + '% popusta.'); }
        else { state.promo = null; promoMsg((j && j.error) || 'Promo kod nije ispravan.', ''); }
        update();
      })
      .catch(function () { el.promoBtn.disabled = false; state.promo = null; promoMsg('Provjera nije uspjela. Pokušaj opet.', ''); update(); });
  }
  if (el.promoBtn) {
    el.promoBtn.addEventListener('click', function () { checkPromo(true); });
    /* the one-per-guest limit depends on e-mail and phone, so check again when they change */
    [el.email, el.phone].forEach(function (f) { f.addEventListener('change', function () { if (el.promo.value.trim()) checkPromo(false); }); });
    el.promo.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); checkPromo(true); } });
    el.promo.addEventListener('input', function () { if (state.promo && el.promo.value.trim().toUpperCase() !== state.promo.code) { state.promo = null; promoMsg('', ''); update(); } });
  }
  function update() {
    var n = persons(), p = PRICES[state.zone][state.dur], total = curTotal();
    if (state.promo && state.promoSig !== promoSig() && state.promoSig) checkPromo(false); // zone, date or length changed: check the code again
    el.sZone.textContent = NAMES[state.zone];
    el.sDur.textContent = state.dur + (state.dur === 1 ? ' sat' : (state.dur < 5 ? ' sata' : ' sati'));
    el.sPeople.textContent = n + (n === 1 ? ' osoba' : ' osobe');
    if (state.start !== null && el.date.value) {
      var d = parseDate(el.date.value);
      el.sWhen.textContent = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. u ' + fmt(state.start) + ' do ' + fmt(state.start + state.dur * 60);
    } else el.sWhen.textContent = 'Odaberi termin';
    var q = currentQuote(), tail = state.live ? ' Rezervacija je potvrđena tek kad ti potvrdimo emailom.' : '';
    var dealWins = q && q.pct > 0 && q.pct >= (state.promo ? state.promo.pct : 0);
    el.total.textContent = total === 0 ? 'Besplatno' : km(total) + ' KM';
    if (total === 0) el.totalSub.textContent = 'Jedva čekamo da dođeš!' + tail;
    else if (dealWins) el.totalSub.textContent = 'Popust ' + (Math.round(q.pct * 10) / 10) + '%' + (q.label ? ' (' + q.label + ')' : '') + ' je uračunat, redovna cijena je ' + km(q.base) + ' KM. PDV uključen. Kafa ili čaj su besplatni. Plaćanje po dolasku.' + tail;
    else el.totalSub.textContent = (state.promo ? 'Promo kod ' + state.promo.code + ': ' + state.promo.pct + '% popusta. ' : '') + (n > 1 ? n + ' × ' + p + ' KM po osobi. ' : '') + 'PDV uključen. Kafa ili čaj su besplatni. Plaćanje po dolasku.' + (state.live ? ' Rezervacija je potvrđena tek kad ti potvrdimo emailom.' : '');
    el.btn.disabled = state.start === null;
    syncPersons(); needUpdate();
    el.out.hidden = true; el.err.hidden = true;
    requestQuote();
  }

  /* Lounge is bookable up to 4 hours only: hide 6 h there and step back to 4 h if it was selected. */
  function syncDur() {
    var six = root.querySelector('input[name=dur][value="6"]'); if (!six) return;
    var lounge = state.zone === 'lounge';
    six.parentNode.style.display = lounge ? 'none' : '';
    if (lounge && state.dur === 6) { state.dur = 4; var r4 = root.querySelector('input[name=dur][value="4"]'); if (r4) r4.checked = true; }
  }

  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'zone') { state.zone = t.value; syncDur(); renderSlots(); }
    else if (t.name === 'dur') { state.dur = +t.value; renderSlots(); }
    else if (t === el.date || t === el.persons) renderSlots();
  });
  el.slots.addEventListener('click', function (e) {
    var b = e.target.closest('.slot'); if (!b || b.disabled) return;
    state.start = +b.dataset.t;
    Array.prototype.forEach.call(el.slots.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); });
    update();
  });

  function fail(text, field) { el.err.textContent = text; el.err.hidden = false; el.out.hidden = true; if (field) field.focus(); }
  el.btn.addEventListener('click', function () {
    if (state.start === null) return;
    var name = el.name.value.trim(), email = el.email.value.trim(), phone = el.phone.value.trim();
    var bad = ['name', 'email', 'phone'].filter(function (k) { return validate(k, true); });
    if (bad.length) { el[bad[0]].focus(); return fail(bad.length > 1 ? 'Dopuni označena polja.' : fieldErr(bad[0]).textContent); }
    el.err.hidden = true;
    var n = persons(), total = curTotal();
    if (!state.live) {
      el.out.innerHTML = '<span class="stamp">DEMO · NIJE STVARNA REZERVACIJA</span><p><b>Primjer</b></p><p>' + esc(NAMES[state.zone]) + ', ' + esc(el.sWhen.textContent) + ', ' + esc(el.sPeople.textContent) + '.</p><p>' + (total === 0 ? 'Besplatno' : 'Ukupno ' + total + ' KM, plaćanje po dolasku') + '. Ništa nije poslano niti spremljeno.</p>';
      el.out.hidden = false; return;
    }
    el.btn.disabled = true; el.btn.textContent = 'Šaljem...';
    fetch('/api/rezervacija', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ zona: state.zone, trajanje: state.dur, osobe: n, datum: el.date.value, pocetak: state.start, ime: name, email: email, telefon: phone, novosti: !!(el.news && el.news.checked), kod: el.promo ? el.promo.value.trim() : '', web: el.web.value })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
      .then(function (res) {
        el.btn.textContent = 'Pošalji zahtjev';
        if (!res.ok) { el.btn.disabled = false; if (res.j && /slobodan/.test(res.j.error || '')) renderSlots(); if (res.j && res.j.promo) { state.promo = null; promoMsg(res.j.error, ''); update(); el.promo.focus(); return fail('Provjeri promo kod.'); } return fail((res.j && res.j.error) || 'Slanje nije uspjelo.'); }
        el.out.innerHTML = '<p><b>Zahtjev je poslan.</b></p><p>' + esc(NAMES[state.zone]) + ', ' + esc(el.sWhen.textContent) + ', ' + (total === 0 ? 'besplatno. Jedva čekamo da dođeš!' : 'ukupno ' + km(total) + ' KM.') + '</p><p>Rezervacija <b>nije potvrđena</b> dok ti ne potvrdimo emailom na ' + esc(email) + '. Provjeri i spam.</p>';
        el.out.hidden = false; el.btn.hidden = true; if (el.need) el.need.hidden = true;
        try { el.out.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      })
      .catch(function () { el.btn.disabled = false; el.btn.textContent = 'Pošalji zahtjev'; fail('Slanje nije uspjelo. Piši nam na info@skripta.ba.'); });
  });

  /* ---------- init: date range ---------- */
  /* ---------- day picker: Sundays are shown but cannot be clicked ---------- */
  var WD = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
  function drawDays() {
    var box = document.getElementById('b-days'); if (!box) return;
    box.innerHTML = '';
    if (!el.date.min || !el.date.max) return;
    var d = parseDate(el.date.min), end = parseDate(el.date.max), anySoon = false;
    for (; d <= end; d.setDate(d.getDate() + 1)) {
      if (!state.sched && d.getDay() === 6 && closedDay(d)) continue; // demo: closed Saturdays are not shown at all
      var v = iso(d), b = document.createElement('button'), x = dayInfo(v), chip = '';
      b.type = 'button'; b.className = 'day'; b.dataset.d = v;
      var notYet = v > BOOKING_UNTIL && !closedDay(d);
      if (notYet) { anySoon = true; b.className = 'day soon'; }
      b.disabled = closedDay(d) || notYet;
      b.setAttribute('aria-pressed', String(el.date.value === v));
      b.innerHTML = '<small>' + WD[d.getDay()] + '</small><b>' + d.getDate() + '.' + (d.getMonth() + 1) + '.</b>' + (x && !x.closed && x.free ? '<i>besplatno</i>' : (x && !x.closed && x.deal > 0 ? '<i>popust</i>' : (!state.sched && FREE_DATES.indexOf(v) >= 0 ? '<i>besplatno</i>' : (notYet ? '<i class="soon">uskoro</i>' : ''))));
      box.appendChild(b);
    }
    var sb = document.getElementById('b-soon'); if (sb) sb.hidden = !anySoon;
    box.onclick = function (e) {
      var b = e.target.closest('.day'); if (!b || b.disabled) return;
      el.date.value = b.dataset.d;
      Array.prototype.forEach.call(box.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      el.date.dispatchEvent(new Event('change', { bubbles: true }));
    };
  }

  // Date range and first open day. With a schedule from the server the range comes from there; otherwise the old rules apply.
  function initDates(keep) {
    var cur = keep ? el.date.value : '';
    if (state.sched) { el.date.min = state.sched.from; el.date.max = state.sched.to; }
    else {
      var d0 = new Date(), min = new Date(d0);
      if (d0.getHours() >= 19) min.setDate(min.getDate() + 1);
      while (closedDay(min)) min.setDate(min.getDate() + 1);
      var max = new Date(d0); max.setDate(max.getDate() + 5);
      var openUntil = parseDate('2026-11-14'); if (openUntil > max) max = openUntil;
      el.date.min = iso(min); el.date.max = iso(max);
    }
    if (!(cur && cur >= el.date.min && cur <= el.date.max && cur <= BOOKING_UNTIL && !closedDay(parseDate(cur)))) {
      cur = '';
      for (var d = parseDate(el.date.min), end = parseDate(el.date.max); d <= end; d.setDate(d.getDate() + 1)) {
        if (closedDay(d)) continue;
        if (iso(d) === iso(new Date()) && new Date().getHours() >= 19) continue; // after 19:00 start with tomorrow
        cur = iso(d); break;
      }
      var dm = /[?&]datum=(\d{4}-\d{2}-\d{2})/.exec(location.search);
      if (dm && dm[1] >= el.date.min && dm[1] <= el.date.max && dm[1] <= BOOKING_UNTIL && !closedDay(parseDate(dm[1]))) cur = dm[1];
    }
    el.date.value = cur;
    drawDays();
  }
  initDates(false);

  function setMode(live) {
    state.live = live;
    if (el.flag) el.flag.hidden = live;
    el.btn.textContent = live ? 'Pošalji zahtjev' : 'Prikaži primjer';
    if (el.promoWrap) el.promoWrap.hidden = !live;
    state.start = null; state.quote = null;
    renderSlots();
  }
  /* detect API: live only if it answers with JSON */
  fetch('/api/dostupnost?zona=ind&trajanje=1&osobe=1&datum=' + (el.date.value || iso(new Date())), { cache: 'no-store' })
    .then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : Promise.reject(); })
    .then(function (j) {
      if (typeof j.ok !== 'boolean') return setMode(false);
      return fetch('/api/raspored', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (sc) { if (sc && sc.ok && sc.days) { state.sched = sc; initDates(true); } })
        .catch(function () {})
        .then(function () { setMode(true); });
    })
    .catch(function () { setMode(false); });
  setMode(false);

  var m = /[?&]zona=(ind|lounge)/.exec(location.search);
  if (m) { var r = root.querySelector('input[name=zone][value=' + m[1] + ']'); if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } }
})();

/* whole-space inquiry: posts to /api/upit, falls back to a prepared email if the API is unavailable */
(function () {
  var f = document.getElementById('upit-form');
  if (!f) return;
  var ok = document.getElementById('upit-ok'), btn = f.querySelector('button[type=submit]');
  function mailto() {
    var g = function (n) { return (f.elements[n].value || '').trim(); };
    var lines = ['Upit za najam cijelog prostora', '', 'Ime i organizacija: ' + g('ime'), 'Email: ' + g('email'), 'Telefon: ' + g('tel'), 'Datum: ' + g('datum'), 'Trajanje: ' + g('trajanje'), 'Broj učesnika: ' + g('broj'), 'Vrsta korištenja: ' + g('vrsta'), '', 'Napomena: ' + g('napomena')];
    window.location.href = 'mailto:info@skripta.ba?subject=' + encodeURIComponent('Upit: najam cijelog prostora') + '&body=' + encodeURIComponent(lines.join('\n'));
  }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {}; Array.prototype.forEach.call(f.elements, function (x) { if (x.name) data[x.name] = x.value; });
    btn.disabled = true; var label = btn.textContent; btn.textContent = 'Šaljem...';
    fetch('/api/upit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
      .then(function (res) {
        if (!res.r.ok || !res.j.ok) throw new Error(res.j.error || 'fail');
        ok.textContent = 'Upit je poslan. Poslali smo potvrdu primitka na tvoj email. Ovo nije potvrđena rezervacija, javljamo ti se s ponudom.';
        ok.hidden = false; f.reset(); btn.textContent = label; btn.disabled = false;
      })
      .catch(function () {
        btn.textContent = label; btn.disabled = false;
        ok.textContent = 'Slanje preko websitea nije uspjelo. Otvaramo ti email s pripremljenim upitom, ili nam piši na info@skripta.ba.';
        ok.hidden = false; mailto();
      });
  });
})();

/* ---------- "obavijesti me" for dates that are not open yet ---------- */
(function () {
  var f = document.getElementById('b-soon-form'); if (!f) return;
  var inp = document.getElementById('b-soon-email'), msg = document.getElementById('b-soon-msg'), btn = f.querySelector('button');
  function say(t, bad) { msg.textContent = t; msg.hidden = !t; msg.className = 'hint' + (bad ? ' warn' : ''); }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = inp.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { say('Upiši ispravan email.', true); inp.focus(); return; }
    btn.disabled = true; say('');
    fetch('/api/obavijest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: v, datum: (document.getElementById('b-date') || {}).value || '', web: (document.getElementById('b-soon-web') || {}).value || '' }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { btn.disabled = false; return say((res.j && res.j.error) || 'Slanje nije uspjelo.', true); }
        f.hidden = true; say('Hvala! Javit ćemo ti čim otvorimo rezervacije.');
      })
      .catch(function () { btn.disabled = false; say('Slanje nije uspjelo. Piši nam na info@skripta.ba.', true); });
  });
})();
