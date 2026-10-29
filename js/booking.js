/* SKRIPTA Coffice booking widget.
   Live mode: talks to /api/dostupnost and /api/rezervacija (Cloudflare Pages Functions).
   Demo mode (API not reachable, e.g. local preview): simulated availability, nothing is sent. */
(function () {
  var root = document.getElementById('rezervacija');
  if (!root) return;

  var PRICES = { ind: { 1: 7, 2: 12, 4: 20, 8: 28 }, lounge: { 1: 5, 2: 8, 4: 13, 8: 18 } };
  var NAMES = { ind: 'Individualna zona', lounge: 'Lounge zona' };
  var OPEN = 8 * 60, CLOSE = 21 * 60, STEP = 30, LEAD_MIN = 60;

  var $ = function (s) { return root.querySelector(s); };
  var el = {
    flag: $('#b-flag'), date: $('#b-date'), slots: $('#b-slots'), slotHint: $('#b-slot-hint'), persons: $('#b-persons'),
    personsWrap: $('#b-persons-wrap'), dayMsg: $('#b-day-msg'),
    sZone: $('#s-zone'), sWhen: $('#s-when'), sPeople: $('#s-people'), sDur: $('#s-dur'),
    total: $('#s-total'), totalSub: $('#s-total-sub'), btn: $('#b-confirm'),
    name: $('#b-name'), email: $('#b-email'), phone: $('#b-phone'), web: $('#b-web'), out: $('#b-out'), err: $('#b-err')
  };
  var state = { zone: 'ind', dur: 1, start: null, live: false, seq: 0 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function parseDate(v) { var p = v.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function persons() { return state.zone === 'cafe' ? +el.persons.value : 1; }

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
  function drawSlots(allowed, dur) {
    el.slots.innerHTML = '';
    for (var t = OPEN; t < CLOSE; t += STEP) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'slot'; b.textContent = fmt(t); b.dataset.t = t;
      b.disabled = allowed.indexOf(t) < 0;
      if (t + dur > CLOSE) b.title = 'Nema dovoljno vremena do zatvaranja';
      b.setAttribute('aria-pressed', String(state.start === t));
      el.slots.appendChild(b);
    }
    if (state.start !== null && allowed.indexOf(state.start) < 0) state.start = null;
    el.slotHint.textContent = state.dur === 8
      ? 'Dnevna tarifa traje osam sati. Početak je moguć najkasnije u ' + fmt(CLOSE - 480) + '.'
      : (allowed.length ? 'Prikazani su slobodni termini. Precrtani su zauzeti ili prekasni.' : 'Nema slobodnih termina za ovaj izbor. Probajte drugi datum ili kraće trajanje.');
    update();
  }
  function message(text) { el.dayMsg.textContent = text; el.dayMsg.hidden = false; el.slots.innerHTML = ''; el.slotHint.textContent = ''; state.start = null; update(); }

  function renderSlots() {
    var v = el.date.value;
    el.dayMsg.hidden = true;
    if (!v) return;
    var d = parseDate(v);
    if (d.getDay() === 0) return message('Nedjeljom ne radimo (radno vrijeme je ponedjeljak do subota).');
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
        drawSlots(j.starts, dur);
      })
      .catch(function () { if (seq === state.seq) message('Ne možemo učitati termine. Pokušaj ponovo ili nam piši na info@skripta.ba.'); });
  }

  function update() {
    var n = persons(), p = PRICES[state.zone][state.dur], total = p * n;
    el.sZone.textContent = NAMES[state.zone];
    el.sDur.textContent = state.dur === 8 ? 'Dnevna tarifa (8 sati)' : state.dur + (state.dur === 1 ? ' sat' : (state.dur < 5 ? ' sata' : ' sati'));
    el.sPeople.textContent = n + (n === 1 ? ' osoba' : ' osobe');
    if (state.start !== null && el.date.value) {
      var d = parseDate(el.date.value);
      el.sWhen.textContent = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. u ' + fmt(state.start) + ' do ' + fmt(state.start + state.dur * 60);
    } else el.sWhen.textContent = 'Odaberi termin';
    el.total.textContent = total + ' KM';
    el.totalSub.textContent = (n > 1 ? n + ' × ' + p + ' KM po osobi. ' : '') + 'PDV i jedna kafa ili čaj po dolasku uključeni. Plaćanje po dolasku.' + (state.live ? ' Rezervacija je potvrđena tek kad ti potvrdimo emailom.' : '');
    el.btn.disabled = state.start === null;
    el.out.hidden = true; el.err.hidden = true;
  }

  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'zone') { state.zone = t.value; el.personsWrap.hidden = state.zone !== 'cafe'; renderSlots(); }
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
    if (name.split(/\s+/).length < 2) return fail('Upiši ime i prezime.', el.name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Upiši ispravan email, na njega šaljemo potvrdu.', el.email);
    el.err.hidden = true;
    var n = persons(), total = PRICES[state.zone][state.dur] * n;
    if (!state.live) {
      el.out.innerHTML = '<span class="stamp">DEMO · NIJE STVARNA REZERVACIJA</span><p><b>Primjer</b></p><p>' + esc(NAMES[state.zone]) + ', ' + esc(el.sWhen.textContent) + ', ' + esc(el.sPeople.textContent) + '.</p><p>Ukupno ' + total + ' KM, plaćanje po dolasku. Ništa nije poslano niti spremljeno.</p>';
      el.out.hidden = false; return;
    }
    el.btn.disabled = true; el.btn.textContent = 'Šaljem...';
    fetch('/api/rezervacija', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ zona: state.zone, trajanje: state.dur, osobe: n, datum: el.date.value, pocetak: state.start, ime: name, email: email, telefon: phone, web: el.web.value })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
      .then(function (res) {
        el.btn.textContent = 'Pošalji zahtjev';
        if (!res.ok) { el.btn.disabled = false; if (res.j && /slobodan/.test(res.j.error || '')) renderSlots(); return fail((res.j && res.j.error) || 'Slanje nije uspjelo.'); }
        el.out.innerHTML = '<p><b>Zahtjev je poslan.</b></p><p>' + esc(NAMES[state.zone]) + ', ' + esc(el.sWhen.textContent) + ', ukupno ' + total + ' KM.</p><p>Rezervacija <b>nije potvrđena</b> dok ti ne potvrdimo emailom na ' + esc(email) + '. Provjeri i spam.</p>';
        el.out.hidden = false; el.btn.hidden = true;
      })
      .catch(function () { el.btn.disabled = false; el.btn.textContent = 'Pošalji zahtjev'; fail('Slanje nije uspjelo. Piši nam na info@skripta.ba.'); });
  });

  /* ---------- init ---------- */
  var d0 = new Date(), min = new Date(d0);
  if (d0.getHours() >= 19) min.setDate(min.getDate() + 1);
  if (min.getDay() === 0) min.setDate(min.getDate() + 1);
  var max = new Date(d0); max.setDate(max.getDate() + 7);
  el.date.min = iso(min); el.date.max = iso(max); el.date.value = iso(min);
  el.personsWrap.hidden = true;

  function setMode(live) {
    state.live = live;
    if (el.flag) el.flag.hidden = live;
    el.btn.textContent = live ? 'Pošalji zahtjev' : 'Prikaži primjer';
    renderSlots();
  }
  /* detect API: live only if it answers with JSON */
  fetch('/api/dostupnost?zona=ind&trajanje=1&osobe=1&datum=' + el.date.value, { cache: 'no-store' })
    .then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : Promise.reject(); })
    .then(function (j) { setMode(typeof j.ok === 'boolean'); })
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
