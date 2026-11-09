/* Prijava i pomoćne funkcije za račun. Koristi ih stranica "Moj račun" i forma za rezervaciju.
   Sav tekst iz servera ide kroz textContent: nikad innerHTML. Nema lozinki: Google, Microsoft, Apple ili kod s emaila. */
(function () {
  var cache = null;

  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }
  function api(path, body) {
    var opt = body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Greška. Pokušaj ponovo.' }; }).then(function (j) { j.status = r.status; return j; });
    }).catch(function () { return { ok: false, error: 'Nema veze. Pokušaj ponovo.' }; });
  }
  function me(force) {
    if (!cache || force) cache = api('/api/racun/ja');
    return cache;
  }

  var LABEL = { google: 'Google', microsoft: 'Microsoft', apple: 'Apple' };

  /* opts: { nazad: function () -> { zona, datum } | null, pending: id | null, onDone: function (), kompaktno: bool } */
  function mountLogin(box, opts) {
    opts = opts || {};
    var email = '';
    box.textContent = '';
    var msg = el('p', { class: 'rc-msg', role: 'alert', hidden: '' });
    function say(text, good) { msg.textContent = text || ''; msg.hidden = !text; msg.className = 'rc-msg' + (good ? ' ok' : ''); }

    function stepStart(providers) {
      box.textContent = '';
      var wrap = el('div', { class: 'rc-login' });
      if (!opts.kompaktno) wrap.appendChild(el('h2', { text: 'Prijavi se ili napravi račun' }));
      wrap.appendChild(el('p', { class: 'rc-lead', text: 'Bez lozinke. Prvi put? Račun se napravi sam kad potvrdiš email.' }));
      if (providers.length) {
        var row = el('div', { class: 'rc-providers' });
        providers.forEach(function (p) {
          row.appendChild(el('a', { class: 'btn btn-outline rc-prov', href: '/api/racun/oauth/' + p + '/start', text: 'Nastavi s ' + (LABEL[p] || p), onclick: function (e) {
            var n = opts.nazad && opts.nazad();
            if (n) { e.preventDefault(); location.href = '/api/racun/oauth/' + p + '/start?nazad=coffice&zona=' + encodeURIComponent(n.zona || '') + '&datum=' + encodeURIComponent(n.datum || ''); }
          } }));
        });
        wrap.appendChild(row);
        wrap.appendChild(el('p', { class: 'rc-or', text: 'ili emailom' }));
      }
      var input = el('input', { type: 'email', id: 'rc-email' + (opts.kompaktno ? '-k' : ''), autocomplete: 'email', inputmode: 'email', autocapitalize: 'off', spellcheck: 'false', placeholder: 'ime@primjer.ba', required: '' });
      var btn = el('button', { type: 'submit', class: 'btn btn-solid', text: 'Pošalji kod' });
      var form = el('form', { class: 'rc-form', novalidate: '' },
        el('label', { class: 'lab', for: input.id, text: 'Email' }), input, btn);
      form.addEventListener('submit', function (e) {
        e.preventDefault(); say('');
        email = input.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return say('Upiši ispravan email.');
        btn.disabled = true; btn.textContent = 'Šaljem...';
        api('/api/racun/kod-posalji', { email: email }).then(function (j) {
          btn.disabled = false; btn.textContent = 'Pošalji kod';
          if (!j.ok) return say(j.error || 'Slanje nije uspjelo.');
          stepKod();
        });
      });
      wrap.appendChild(form);
      wrap.appendChild(msg);
      wrap.appendChild(el('p', { class: 'rc-fine', text: 'Koristimo samo kolač potreban za prijavu. Ništa ne pratimo.' }));
      box.appendChild(wrap);
    }

    function stepKod() {
      box.textContent = '';
      var wrap = el('div', { class: 'rc-login' });
      if (!opts.kompaktno) wrap.appendChild(el('h2', { text: 'Upiši kod' }));
      wrap.appendChild(el('p', { class: 'rc-lead', text: opts.pending ? 'Poslali smo šestocifreni kod na email iz tvog naloga. Vrijedi 10 minuta.' : 'Poslali smo šestocifreni kod na ' + email + '. Vrijedi 10 minuta. Provjeri i neželjenu poštu.' }));
      var input = el('input', { type: 'text', id: 'rc-kod' + (opts.kompaktno ? '-k' : ''), inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', pattern: '[0-9]*', placeholder: '123456', class: 'rc-code', required: '' });
      var btn = el('button', { type: 'submit', class: 'btn btn-solid', text: 'Prijavi se' });
      var form = el('form', { class: 'rc-form', novalidate: '' }, el('label', { class: 'lab', for: input.id, text: 'Kod' }), input, btn);
      form.addEventListener('submit', function (e) {
        e.preventDefault(); say('');
        var kod = input.value.replace(/\s/g, '');
        if (!/^\d{6}$/.test(kod)) return say('Kod ima šest cifara.');
        btn.disabled = true; btn.textContent = 'Provjeravam...';
        api('/api/racun/kod-provjeri', opts.pending ? { pending: opts.pending, kod: kod } : { email: email, kod: kod }).then(function (j) {
          btn.disabled = false; btn.textContent = 'Prijavi se';
          if (!j.ok) return say(j.error || 'Kod nije ispravan.');
          me(true).then(function () { if (opts.onDone) opts.onDone(); });
        });
      });
      wrap.appendChild(form);
      wrap.appendChild(msg);
      var again = el('button', { type: 'button', class: 'rc-link', text: 'Pošalji novi kod', onclick: function () {
        say('');
        api('/api/racun/kod-posalji', opts.pending ? { pending: opts.pending } : { email: email }).then(function (j) { say(j.ok ? 'Poslali smo novi kod.' : (j.error || 'Slanje nije uspjelo.'), !!j.ok); });
      } });
      wrap.appendChild(el('p', { class: 'rc-fine' }, again, opts.pending ? null : ' · ', opts.pending ? null : el('button', { type: 'button', class: 'rc-link', text: 'Promijeni email', onclick: function () { say(''); boot(); } })));
      box.appendChild(wrap);
      input.focus();
    }

    function boot() {
      if (opts.pending) {
        api('/api/racun/kod-posalji', { pending: opts.pending }).then(function (j) { if (!j.ok) { stepStart([]); say(j.error || 'Prijava je istekla. Pokušaj ponovo.'); } else stepKod(); });
        return;
      }
      api('/api/racun/pruzaoci').then(function (j) { stepStart(j.ok ? j.pruzaoci : []); });
    }
    boot();
  }

  window.SkriptaAuth = { el: el, api: api, me: me, mountLogin: mountLogin };
})();
