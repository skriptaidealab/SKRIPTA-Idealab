/* Stranica "Moj račun": rezervacije (prošle i buduće), produženje, FLEXI, profil, privatnost. */
(function () {
  // trajanje u satima i minutama (3 h 47 min), ne decimalno
  function hm(h) { var m = Math.round((+h || 0) * 60), a = Math.floor(m / 60), b = m % 60; return m < 60 ? m + ' min' : (b ? a + ' h ' + b + ' min' : a + ' h'); }
  var root = document.getElementById('racun-app');
  if (!root || !window.SkriptaAuth) return;
  var A = window.SkriptaAuth, el = A.el;

  function dmy(d) { return d.split('-').reverse().join('.'); }
  function km(n) { return String(n).replace('.', ','); }
  var EN = document.documentElement.lang === 'en';
  var MON = EN ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var STATUS = { pending: 'Čeka potvrdu', confirmed: 'Potvrđeno', cancelled: 'Otkazano', rejected: 'Odbijeno' };
  var params = new URLSearchParams(location.search);

  function banner(text, kind) { return el('p', { class: 'rc-banner' + (kind ? ' ' + kind : ''), role: 'status', text: text }); }

  function render() {
    A.me(true).then(function (d) {
      root.textContent = '';
      var greska = params.get('greska');
      if (greska) root.appendChild(banner(greska === 'email' ? 'Pružalac prijave nam nije dao email adresu. Prijavi se kodom s emaila.' : 'Prijava nije uspjela. Pokušaj ponovo ili koristi kod s emaila.', 'warn'));
      if (!d.ok) { root.appendChild(el('h1', { text: 'Moj račun' })); root.appendChild(banner(d.error || 'Ne možemo učitati podatke. Pokušaj ponovo.', 'warn')); return; }
      if (!d.user) {
        root.appendChild(el('span', { class: 'eyebrow', text: 'SKRIPTA Coffice' }));
        root.appendChild(el('h1', { text: 'Moj račun' }));
        root.appendChild(el('p', { class: 'rc-intro', text: 'Rezervacije, produženje termina i FLEXI paketi na jednom mjestu.' }));
        var box = el('div', { class: 'rc-card' });
        var perks = el('ul', { class: 'rc-perks' },
          el('li', {}, el('span', {}, 'Sve rezervacije na jednom mjestu', el('small', { text: 'Nadolazeće i prošle, s jasnim statusom.' }))),
          el('li', {}, el('span', {}, 'Produži termin jednim klikom', el('small', { text: 'Kad ti treba još sat vremena, ako je mjesto slobodno.' }))),
          el('li', {}, el('span', {}, 'Prati FLEXI posjete', el('small', { text: 'Vidiš koliko ti je posjeta ostalo i do kad važe.' }))));
        root.appendChild(el('div', { class: 'rc-split' }, box, perks));
        A.mountLogin(box, { pending: params.get('potvrda') || null, onDone: function () { history.replaceState(null, '', location.pathname.split('/').pop() || 'racun.html'); params = new URLSearchParams(''); render(); } });
        return;
      }
      draw(d);
    });
  }

  function bookingCard(b, d) {
    var live = b.faza === 'trenutna' && b.status === 'confirmed';
    var chips = el('div', { class: 'rc-chips' }, el('span', { class: 'rc-chip s-' + b.status + (live ? ' live' : ''), text: b.faza === 'trenutna' && b.status === 'confirmed' ? 'U toku' : STATUS[b.status] || b.status }));
    if (b.flexi) chips.appendChild(el('span', { class: 'rc-chip flexi', text: 'FLEXI' }));
    var price = b.flexi ? 'FLEXI paket' : (b.iznos === 0 ? 'Besplatno' : km(b.iznos) + ' KM');
    var msg = el('p', { class: 'rc-msg', role: 'alert', hidden: '' });
    var actions = el('div', { class: 'rc-actions' });
    var dp = b.datum.split('-');
    var card = el('article', { class: 'rc-booking f-' + b.faza + (b.status === 'cancelled' || b.status === 'rejected' ? ' is-off' : '') },
      el('div', { class: 'rc-date', 'aria-hidden': 'true' }, el('span', { class: 'd', text: String(+dp[2]) }), el('span', { class: 'm', text: MON[+dp[1] - 1] })),
      el('div', { class: 'rc-b-main' },
        el('h3', { text: dmy(b.datum) + ', ' + b.od + ' do ' + b.do }),
        el('p', { text: b.zonaNaziv + (b.osoba > 1 ? ', ' + b.osoba + ' osobe' : '') + ' · ' + hm(b.trajanje) + ' · ' + price }),
        chips),
      actions, msg);
    function say(t, good) { msg.textContent = t || ''; msg.hidden = !t; msg.className = 'rc-msg' + (good ? ' ok' : ''); }

    if (b.mozeProduziti) {
      var ext = el('button', { type: 'button', class: 'btn btn-solid', text: 'Produži termin' });
      var panel = el('div', { class: 'rc-ext', hidden: '' });
      var ZN = { ind: 'Focus zona', lounge: 'Lounge zona' };
      function openOpts(zona) {
        panel.textContent = ''; say('');
        var zrow = el('div', { class: 'rc-opts rc-zones' });
        ['ind', 'lounge'].forEach(function (z) {
          zrow.appendChild(el('button', { type: 'button', class: 'rc-opt', 'aria-pressed': String(z === zona), onclick: function () { if (z !== zona) openOpts(z); } },
            el('b', { text: ZN[z] }), el('small', { text: z === b.zona ? 'trenutna zona' : 'preći u ovu zonu' })));
        });
        panel.appendChild(el('p', { class: 'rc-ask', text: 'Zona' }));
        panel.appendChild(zrow);
        var body = el('div', { class: 'rc-ext-body' }, el('p', { class: 'rc-fine', text: 'Provjeravam dostupnost...' }));
        panel.appendChild(body);
        A.api('/api/racun/produzi-opcije', { id: b.id, zona: zona }).then(function (j) {
          body.textContent = '';
          if (!j.ok) { panel.hidden = true; return say(j.error || 'Provjera nije uspjela. Pokušaj opet.'); }
          var other = zona !== b.zona;
          body.appendChild(el('p', { class: 'rc-ask', text: 'Za koliko želiš produžiti?' }));
          if (other) body.appendChild(el('p', { class: 'rc-fine', text: 'Do ' + j.kraj + ' ostaješ u ' + ZN[b.zona] + ', a od ' + j.kraj + ' prelaziš u ' + ZN[zona] + '.' }));
          var picked = null, row = el('div', { class: 'rc-opts' });
          var go = el('button', { type: 'button', class: 'btn btn-solid', text: 'Potvrdi produženje', disabled: '' });
          if (!j.opcije.length) body.appendChild(el('p', { class: 'rc-fine', text: 'Za ovu zonu nema dostupnih opcija.' }));
          j.opcije.forEach(function (o) {
            var label = o.sati + (o.sati === 1 ? ' sat' : (o.sati < 5 ? ' sata' : ' sati'));
            var price = o.cijena === 0 ? 'besplatno' : km(o.cijena) + ' KM';
            var btn = el('button', { type: 'button', class: 'rc-opt', 'aria-pressed': 'false', disabled: o.ok ? false : '', title: o.ok ? false : o.razlog },
              el('b', { text: label }), el('small', { text: o.ok ? price : 'Nije slobodno' }));
            btn.addEventListener('click', function () {
              picked = o; say('');
              Array.prototype.forEach.call(row.children, function (c) { c.setAttribute('aria-pressed', c === btn ? 'true' : 'false'); });
              go.disabled = false; go.textContent = 'Potvrdi: ' + (other ? ZN[zona] + ' ' : '') + 'do ' + o.do;
            });
            row.appendChild(btn);
          });
          body.appendChild(row);
          if (j.opcije.some(function (o) { return !o.ok; })) body.appendChild(el('p', { class: 'rc-fine', text: 'Opcije koje nisu slobodne su zauzete drugim terminom ili prelaze radno vrijeme.' }));
          go.addEventListener('click', function () {
            if (!picked) return;
            go.disabled = true; say('');
            A.api('/api/racun/produzi', { id: b.id, sati: picked.sati, zona: zona, kraj: j.kraj }).then(function (r) {
              if (r.ok) { say(other ? 'Od ' + j.kraj + ' si u ' + ZN[zona] + ', do ' + r.do + '.' : 'Ostaješ do ' + r.do + '.', true); setTimeout(render, 1400); } else { go.disabled = false; say(r.error || 'Produženje nije uspjelo.'); }
            });
          });
          body.appendChild(go);
          body.appendChild(el('p', { class: 'rc-fine', text: 'Produženje se plaća po dolasku, kao i ostalo.' }));
        });
      }
      ext.addEventListener('click', function () {
        if (!panel.hidden) { panel.hidden = true; return; }
        panel.hidden = false; openOpts(b.zona);
      });
      actions.appendChild(ext);
      actions.appendChild(panel);
    }
    if (b.mozeIzmijeniti) {
      var edit = el('button', { type: 'button', class: 'btn btn-outline', text: 'Izmijeni' });
      var epanel = el('div', { class: 'rc-ext rc-edit', hidden: '' });
      var ZN2 = { ind: 'Focus zona', lounge: 'Lounge zona' };
      var DUR = { ind: [1, 2, 4, 6], lounge: [1, 2, 4] };
      var st = { zona: b.zona, trajanje: b.trajanje, osobe: b.osoba, datum: b.datum, pocetak: null };
      function satiTxt(n) { return n + (n === 1 ? ' sat' : (n < 5 ? ' sata' : ' sati')); }
      function drawEdit() {
        epanel.textContent = ''; say('');
        if (!b.flexi) {
          var zrow = el('div', { class: 'rc-opts rc-zones' });
          ['ind', 'lounge'].forEach(function (z) {
            zrow.appendChild(el('button', { type: 'button', class: 'rc-opt', 'aria-pressed': String(z === st.zona), onclick: function () { st.zona = z; if (DUR[z].indexOf(st.trajanje) < 0) st.trajanje = DUR[z][DUR[z].length - 1]; st.pocetak = null; drawEdit(); } }, el('b', { text: ZN2[z] })));
          });
          epanel.appendChild(el('p', { class: 'rc-ask', text: 'Zona' })); epanel.appendChild(zrow);
          var drow = el('div', { class: 'rc-opts' });
          DUR[st.zona].forEach(function (h) {
            drow.appendChild(el('button', { type: 'button', class: 'rc-opt', 'aria-pressed': String(h === st.trajanje), onclick: function () { st.trajanje = h; st.pocetak = null; drawEdit(); } }, el('b', { text: satiTxt(h) })));
          });
          epanel.appendChild(el('p', { class: 'rc-ask', text: 'Trajanje' })); epanel.appendChild(drow);
          var prow = el('div', { class: 'rc-opts' });
          [1, 2, 3, 4].forEach(function (n) {
            prow.appendChild(el('button', { type: 'button', class: 'rc-opt', 'aria-pressed': String(n === st.osobe), onclick: function () { st.osobe = n; st.pocetak = null; drawEdit(); } }, el('b', { text: String(n) })));
          });
          epanel.appendChild(el('p', { class: 'rc-ask', text: 'Broj osoba' })); epanel.appendChild(prow);
        } else {
          epanel.appendChild(el('p', { class: 'rc-fine', text: 'FLEXI rezervaciji se mijenja samo datum i vrijeme početka.' }));
        }
        var today = new Date(), mm = String(today.getMonth() + 1).padStart(2, '0'), dd = String(today.getDate()).padStart(2, '0');
        var din = el('input', { type: 'date', id: 'rc-edit-d-' + b.id, value: st.datum, min: today.getFullYear() + '-' + mm + '-' + dd });
        din.addEventListener('change', function () { if (din.value) { st.datum = din.value; st.pocetak = null; drawEdit(); } });
        epanel.appendChild(el('p', { class: 'rc-ask', text: 'Datum' })); epanel.appendChild(din);
        var body = el('div', { class: 'rc-ext-body' }, el('p', { class: 'rc-fine', text: 'Provjeravam dostupnost...' }));
        epanel.appendChild(body);
        A.api('/api/racun/izmijeni-opcije', { id: b.id, zona: st.zona, trajanje: st.trajanje, osobe: st.osobe, datum: st.datum }).then(function (j) {
          body.textContent = '';
          if (!j.ok) { body.appendChild(el('p', { class: 'rc-fine', text: j.error || 'Provjera nije uspjela. Pokušaj opet.' })); return; }
          body.appendChild(el('p', { class: 'rc-ask', text: 'Slobodni počeci' }));
          if (!j.starts.length) { body.appendChild(el('p', { class: 'rc-fine', text: 'Za ovaj izbor nema slobodnih termina. Probaj drugi datum ili kraće trajanje.' })); return; }
          var row = el('div', { class: 'rc-opts' }), go = el('button', { type: 'button', class: 'btn btn-solid', text: 'Spremi izmjenu', disabled: '' });
          j.starts.forEach(function (o) {
            var btn = el('button', { type: 'button', class: 'rc-opt', 'aria-pressed': String(st.pocetak === o.od) },
              el('b', { text: o.oznaka }), el('small', { text: 'do ' + o.do + ' · ' + (b.flexi ? 'FLEXI' : (o.cijena === 0 ? 'besplatno' : km(o.cijena) + ' KM')) }));
            btn.addEventListener('click', function () {
              st.pocetak = o.od; say('');
              Array.prototype.forEach.call(row.children, function (c) { c.setAttribute('aria-pressed', c === btn ? 'true' : 'false'); });
              go.disabled = false; go.textContent = 'Spremi: ' + dmy(st.datum) + ', ' + o.oznaka + ' do ' + o.do;
            });
            row.appendChild(btn);
          });
          body.appendChild(row);
          go.addEventListener('click', function () {
            if (st.pocetak == null) return;
            go.disabled = true; say('');
            A.api('/api/racun/izmijeni', { id: b.id, zona: st.zona, trajanje: st.trajanje, osobe: st.osobe, datum: st.datum, pocetak: st.pocetak }).then(function (r) {
              if (r.ok) { say('Izmjena je spremljena: ' + dmy(r.datum) + ', ' + r.od + ' do ' + r.do + '.' + (r.potvrdjena ? '' : ' Čeka potvrdu.'), true); setTimeout(render, 1400); }
              else { go.disabled = false; say(r.error || 'Izmjena nije uspjela.'); if (r.conflict) drawEdit(); }
            });
          });
          body.appendChild(go);
          body.appendChild(el('p', { class: 'rc-fine', text: 'Izmjena važi samo ako je izabrani termin slobodan. Cijena se računa za novi termin.' }));
        });
      }
      edit.addEventListener('click', function () {
        if (!epanel.hidden) { epanel.hidden = true; return; }
        epanel.hidden = false; drawEdit();
      });
      actions.appendChild(edit);
      actions.appendChild(epanel);
    }
    if (b.mozeOtkazati) {
      var cancel = el('button', { type: 'button', class: 'btn btn-outline', text: 'Otkaži' });
      cancel.addEventListener('click', function () {
        actions.textContent = '';
        actions.appendChild(el('span', { class: 'rc-ask', text: 'Sigurno otkazati?' }));
        actions.appendChild(el('button', { type: 'button', class: 'btn btn-solid', text: 'Da, otkaži', onclick: function (e) {
          e.target.disabled = true;
          A.api('/api/racun/otkazi', { id: b.id }).then(function (j) { if (j.ok) render(); else { e.target.disabled = false; say(j.error || 'Otkazivanje nije uspjelo.'); } });
        } }));
        actions.appendChild(el('button', { type: 'button', class: 'btn btn-outline', text: 'Ne', onclick: render }));
      });
      actions.appendChild(cancel);
    }
    return card;
  }

  function list(title, items, empty, d) {
    var sec = el('section', { class: 'rc-sec' }, el('h2', { text: title }));
    if (!items.length) sec.appendChild(el('p', { class: 'rc-empty', text: empty }));
    items.forEach(function (b) { sec.appendChild(bookingCard(b, d)); });
    return sec;
  }

  function visits(p) {
    var w = el('div', { class: 'rc-visits', 'aria-hidden': 'true' });
    for (var i = 0; i < p.dolazaka && i < 30; i++) w.appendChild(el('i', { class: i < p.preostalo ? 'on' : '' }));
    return w;
  }

  function flexiSection(d) {
    if (!d.flexi.length) return null;
    var sec = el('section', { class: 'rc-sec' }, el('h2', { text: 'FLEXI paketi' }));
    d.flexi.forEach(function (p) {
      var kraj = p.istice ? 'Važi do ' + dmy(p.istice) + '.' : 'Rok od 30 dana počinje prvom rezervacijom.';
      sec.appendChild(el('div', { class: 'rc-flexi' },
        el('h3', { text: p.dolazaka + ' posjeta po ' + p.sati + ' h' }),
        el('p', { class: 'rc-big', text: p.preostalo + ' od ' + p.dolazaka + ' preostalo' }),
        visits(p),
        el('p', { text: (p.rezervisano ? p.rezervisano + ' već rezervisano. ' : '') + kraj + ' Posjeta se skida kad te osoblje označi kao stigao/la.' }),
        p.slobodno > 0 ? el('a', { class: 'btn btn-solid', href: 'coffice.html#rezervacija', text: 'Rezerviši posjetu' }) : null));
    });
    return sec;
  }

  function profileSection(d) {
    var ime = el('input', { type: 'text', id: 'rc-ime', autocomplete: 'name', value: d.user.name || '', placeholder: 'Ime Prezime' });
    var tel = el('input', { type: 'tel', id: 'rc-tel', autocomplete: 'tel', value: d.user.phone || '', placeholder: '+387 6x xxx xxx' });
    var msg = el('p', { class: 'rc-msg', role: 'alert', hidden: '' });
    var form = el('form', { class: 'rc-form', novalidate: '' },
      el('div', { class: 'fld' }, el('label', { class: 'lab', for: 'rc-ime', text: 'Ime i prezime' }), ime),
      el('div', { class: 'fld' }, el('label', { class: 'lab', for: 'rc-tel', text: 'Telefon' }), tel),
      el('button', { type: 'submit', class: 'btn btn-solid', text: 'Spremi' }), msg);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      A.api('/api/racun/profil', { ime: ime.value, telefon: tel.value }).then(function (j) { msg.hidden = false; msg.className = 'rc-msg' + (j.ok ? ' ok' : ''); msg.textContent = j.ok ? 'Spremljeno.' : (j.error || 'Nije spremljeno.'); });
    });
    var nacini = d.user.nacini.map(function (n) { return n === 'email' ? 'Kod s emaila' : n.charAt(0).toUpperCase() + n.slice(1); }).join(', ');
    return el('section', { class: 'rc-sec' }, el('h2', { text: 'Profil' }),
      el('p', { class: 'rc-fine', text: 'Email: ' + d.user.email + '. Načini prijave: ' + nacini + '.' }),
      form,
      el('p', { class: 'rc-fine', text: 'Ime i telefon koristimo samo za tvoje rezervacije.' }));
  }

  function privacySection(d) {
    var sec = el('section', { class: 'rc-sec' }, el('h2', { text: 'Privatnost' }),
      el('p', { text: 'Možeš preuzeti sve što imamo o tebi ili obrisati račun. Politika privatnosti: ' }));
    sec.lastChild.appendChild(el('a', { href: 'privatnost.html', text: 'privatnost.html' }));
    sec.appendChild(el('p', { class: 'rc-actions' }, el('a', { class: 'btn btn-outline', href: '/api/racun/izvoz', download: 'moji-podaci-skripta.json', text: 'Preuzmi moje podatke' })));
    var del = el('div', { class: 'rc-del', hidden: '' });
    var left = d.flexi.reduce(function (s, p) { return s + p.preostalo; }, 0);
    var conf = el('input', { type: 'email', id: 'rc-del-mail', autocomplete: 'off', placeholder: d.user.email });
    var chk = left > 0 ? el('input', { type: 'checkbox', id: 'rc-del-flexi' }) : null;
    var msg = el('p', { class: 'rc-msg', role: 'alert', hidden: '' });
    var go = el('button', { type: 'button', class: 'btn btn-solid', text: 'Trajno obriši račun' });
    del.appendChild(el('p', { text: 'Briše se račun i prijava. Rezervacije ostaju samo kao anonimna evidencija, bez imena, emaila i telefona. Ovo se ne može poništiti.' }));
    del.appendChild(el('label', { class: 'lab', for: 'rc-del-mail', text: 'Za potvrdu upiši svoj email' }));
    del.appendChild(conf);
    if (chk) del.appendChild(el('label', { class: 'rc-check' }, chk, ' Razumijem da gubim ' + left + ' neiskorištenih FLEXI posjeta.'));
    del.appendChild(go); del.appendChild(msg);
    go.addEventListener('click', function () {
      go.disabled = true;
      A.api('/api/racun/obrisi', { potvrda: conf.value, prihvatamGubitakPaketa: !!(chk && chk.checked) }).then(function (j) {
        if (j.ok) { A.me(true); root.textContent = ''; root.appendChild(el('h1', { text: 'Račun je obrisan.' })); root.appendChild(el('p', { text: 'Hvala što si bio/la s nama.' })); }
        else { go.disabled = false; msg.hidden = false; msg.className = 'rc-msg'; msg.textContent = j.error || 'Brisanje nije uspjelo.'; }
      });
    });
    sec.appendChild(el('button', { type: 'button', class: 'btn btn-outline', text: 'Obriši račun', onclick: function () { del.hidden = !del.hidden; } }));
    sec.appendChild(del);
    return sec;
  }

  function draw(d) {
    var cur = d.bookings.filter(function (b) { return b.faza === 'trenutna'; });
    var up = d.bookings.filter(function (b) { return b.faza === 'nadolazeca'; }).sort(function (a, b) { return (a.datum + a.od) < (b.datum + b.od) ? -1 : 1; });
    var past = d.bookings.filter(function (b) { return b.faza === 'prosla'; });
    root.appendChild(el('div', { class: 'rc-head' },
      el('div', {}, el('span', { class: 'eyebrow', text: 'SKRIPTA Coffice' }), el('h1', { text: 'Moj račun' }), el('p', { class: 'rc-who', text: d.user.name ? d.user.name + ' · ' + d.user.email : d.user.email })),
      el('button', { type: 'button', class: 'btn btn-outline', text: 'Odjavi se', onclick: function () { A.api('/api/racun/odjava', {}).then(function () { A.me(true); render(); }); } })));
    if (cur.length) root.appendChild(list('Trenutni termin', cur, '', d));
    root.appendChild(list('Nadolazeće rezervacije', up, 'Nemaš nadolazećih rezervacija.', d));
    if (!up.length) root.lastChild.appendChild(el('a', { class: 'btn btn-solid', href: 'coffice.html#rezervacija', text: 'Rezerviši mjesto' }));
    var fx = flexiSection(d); if (fx) root.appendChild(fx);
    root.appendChild(list('Prošle rezervacije', past, 'Još nema prošlih rezervacija.', d));
    root.appendChild(profileSection(d));
    root.appendChild(privacySection(d));
  }

  render();
})();
