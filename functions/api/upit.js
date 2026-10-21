import { json, esc, isEmail, clean } from '../_lib/util.js';
import { sendMail } from '../_lib/graph.js';

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }
  if (b.web) return json({ ok: true }); // honeypot
  const f = { ime: clean(b.ime, 120), email: clean(b.email, 160), tel: clean(b.tel, 40), datum: clean(b.datum, 20), trajanje: clean(b.trajanje, 60), broj: clean(b.broj, 20), vrsta: clean(b.vrsta, 80), napomena: clean(b.napomena, 1500) };
  if (!f.ime || !isEmail(f.email) || !f.datum || !f.trajanje || !f.broj || !f.vrsta) return json({ ok: false, error: 'Popunite sva obavezna polja.' }, 400);
  const row = (l, v) => `<tr><td style="padding:4px 12px 4px 0"><b>${l}</b></td><td>${esc(v) || '-'}</td></tr>`;
  const table = `<table>${row('Ime i organizacija', f.ime)}${row('Email', f.email)}${row('Telefon', f.tel)}${row('Datum', f.datum)}${row('Trajanje', f.trajanje)}${row('Broj učesnika', f.broj)}${row('Vrsta korištenja', f.vrsta)}${row('Napomena', f.napomena)}</table>`;
  try {
    await sendMail(env, { to: env.MAILBOX, replyTo: f.email, subject: `Upit: najam cijelog prostora (${f.ime})`, html: `<p>Novi upit s websitea. Nije rezervacija.</p>${table}` });
    await sendMail(env, { to: f.email, subject: 'Primili smo vaš upit', html: `<p>Poštovani/a,</p><p>primili smo vaš upit za najam cijelog prostora. Provjeravamo termin i javljamo vam se s ponudom. Ovo nije potvrđena rezervacija.</p>${table}<p>SKRIPTA, info@skripta.ba, +387 62 307 885</p>` });
  } catch (e) { console.error(e); return json({ ok: false, error: 'Slanje nije uspjelo.' }, 502); }
  return json({ ok: true });
}
