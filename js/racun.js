/* Stranica "Moj račun": rezervacije (prošle i buduće), produženje, FLEXI, profil, privatnost. */
(function () {
  var root = document.getElementById('racun-app');
  if (!root || !window.SkriptaAuth) return;
  var A = window.SkriptaAuth, el = A.el;

  function dmy(d) { return d.split('-').reverse().join('.'); }
  function km(n) { return String(n).replace('.', ','); }
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
        root.appendChild(el('h1', { text: 'Moj račun' }));
        var box = el('div', { class: 'rc-card' });
        root.appendChild(box);
        A.mountLogin(box, { pending: params.get('potvrda') || null, onDone: function () { history.replaceState(null, '', location.pathname.split('/').pop() || 'racun.html'); params = new URLSearchParams(''); render(); } });
        return;
      }
      draw(d);
    });
  }

  function bookingCard(b, d) {
    var chips = el('div', { class: 'rc-chips' }, el('span', { class: 'rc-chip s-' + b.status, text: b.faza === 'trenutna' && b.status === 'confirmed' ? 'U toku' : STATUS[b.status] || b.status }));
    if (b.flexi) chips.appendChild(el('span', { class: 'rc-chip flexi', text: 'FLEXI' }));
    var price = b.flexi ? 'FLEXI paket' : (b.iznos === 0 ? 'Besplatno' : km(b.iznos) + ' KM');
    var msg = el('p', { class: 'rc-msg', role: 'alert', hidden: '' });
    var actions = el('div', { class: 'rc-actions' });
    var card = el('article', { class: 'rc-booking' },
      el('div', { class: 'rc-b-main' },
        el('h3', { text: dmy(b.datum) + ', ' + b.od + ' do ' + b.do }),
        el('p', { text: b.zonaNaziv + (b.osoba > 1 ? ', ' + b.osoba + ' osobe' : '') + ' · ' + b.trajanje + ' h · ' + price }),
        chips),
      actions, msg);
    function say(t, good) { msg.textContent = t || ''; msg.hidden = !t; msg.className = 'rc-msg' + (good ? ' ok' : ''); }

    if (b.mozeProduziti) {
      var pr = b.produziCijena === 0 ? 'besplatno' : (b.produziCijena != null ? km(b.produziCijena) + ' KM' : '');
      var ext = el('button', { type: 'button', class: 'btn btn-solid', text: 'Produži za 1 sat' + (pr ? ' (' + pr + ')' : '') });
      ext.addEventListener('click', function () {
        ext.disabled = true; say('');
        A.api('/api/racun/produzi', { id: b.id, sati: 1, kraj: b.do }).then(function (j) {
          if (j.ok) { say('Ostaješ do ' + j.do + '.', true); setTimeout(render, 1200); } else { ext.disabled = false; say(j.error || 'Produženje nije uspjelo.'); }
        });
      });
      actions.appendChild(ext);
      actions.appendChild(el('p', { class: 'rc-fine', text: 'Produženje se plaća po dolasku, kao i ostalo.' }));
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

  function flexiSection(d) {
    if (!d.flexi.length) return null;
    var sec = el('section', { class: 'rc-sec' }, el('h2', { text: 'FLEXI paketi' }));
    d.flexi.forEach(function (p) {
      var kraj = p.istice ? 'Važi do ' + dmy(p.istice) + '.' : 'Rok od mjesec dana počinje prvom rezervacijom.';
      sec.appendChild(el('div', { class: 'rc-flexi' },
        el('h3', { text: p.dolazaka + ' posjeta po ' + p.sati + ' h' }),
        el('p', { class: 'rc-big', text: p.preostalo + ' od ' + p.dolazaka + ' preostalo' }),
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
      el('div', {}, el('h1', { text: 'Moj račun' }), el('p', { class: 'rc-fine', text: d.user.name ? d.user.name + ' · ' + d.user.email : d.user.email })),
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
