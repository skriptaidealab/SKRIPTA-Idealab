import { json, esc, isEmail, clean } from '../_lib/util.js';
import { sendMail } from '../_lib/graph.js';
import { mail, C } from '../_lib/mail.js';

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }
  if (b.web) return json({ ok: true }); // honeypot
  const f = { ime: clean(b.ime, 120), email: clean(b.email, 160), tel: clean(b.tel, 40), datum: clean(b.datum, 20), trajanje: clean(b.trajanje, 60), broj: clean(b.broj, 20), vrsta: clean(b.vrsta, 80), napomena: clean(b.napomena, 1500) };
  if (!f.ime || !isEmail(f.email) || !f.datum || !f.trajanje || !f.broj || !f.vrsta) return json({ ok: false, error: 'Popunite sva obavezna polja.' }, 400);
  const rows = [['Ime', f.ime], ['Email', f.email], ['Telefon', f.tel], ['Datum', f.datum], ['Trajanje', f.trajanje], ['Učesnika', f.broj], ['Vrsta', f.vrsta], ['Napomena', f.napomena]];
  try {
    await sendMail(env, { to: env.MAILBOX, replyTo: f.email, subject: `Upit: najam cijelog prostora (${f.ime})`, html: mail({ brand: 'SKRIPTA IdeaLab · interno', accent: C.rose, chip: 'Upit', title: 'Novi upit za cijeli prostor.', lead: 'Upit s websitea. Nije rezervacija.', rows }) });
    await sendMail(env, { to: f.email, subject: 'Primili smo tvoj upit', html: mail({ brand: 'SKRIPTA IdeaLab', accent: C.rose, chip: 'Nije rezervacija', title: 'Upit je primljen.', lead: `Hvala, ${esc(f.ime)}. Provjeravamo termin i javljamo ti se s ponudom. Ovo nije potvrđena rezervacija.`, rows }) });
  } catch (e) { console.error(e); return json({ ok: false, error: 'Slanje nije uspjelo.' }, 502); }
  return json({ ok: true });
}
