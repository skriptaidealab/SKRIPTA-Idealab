import { json, esc, isEmail, clean, emailDomainBad } from '../_lib/util.js';
import { sendMail } from '../_lib/graph.js';
import { mail, C } from '../_lib/mail.js';

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }
  if (b.web) return json({ ok: true }); // honeypot
  const f = { ime: clean(b.ime, 120), email: clean(b.email, 160), tel: clean(b.tel, 40), datum: clean(b.datum, 20), trajanje: clean(b.trajanje, 60), broj: clean(b.broj, 20), vrsta: clean(b.vrsta, 80), napomena: clean(b.napomena, 1500) };
  if (!f.ime || !isEmail(f.email) || !f.datum || !f.trajanje || !f.broj || !f.vrsta) return json({ ok: false, error: 'Popunite sva obavezna polja.' }, 400);
  if (await emailDomainBad(f.email)) return json({ ok: false, error: 'Provjeri email, domena izgleda pogrešno.' }, 400);
  const rows = [['Ime', f.ime], ['Email', f.email], ['Telefon', f.tel], ['Datum', f.datum], ['Trajanje', f.trajanje], ['Učesnika', f.broj], ['Vrsta', f.vrsta], ['Napomena', f.napomena]];
  // Upit se sprema i u bazu, da ga nadzorna ploča pokaže (Upiti). Ako tabela ne postoji, pravi se sama; mail ide svejedno.
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS inquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, ime TEXT, email TEXT, tel TEXT, datum TEXT, trajanje TEXT, broj TEXT, vrsta TEXT, napomena TEXT, status TEXT NOT NULL DEFAULT 'novo', biljeska TEXT)").run();
    await env.DB.prepare('INSERT INTO inquiries (created_at, ime, email, tel, datum, trajanje, broj, vrsta, napomena) VALUES (?,?,?,?,?,?,?,?,?)').bind(new Date().toISOString(), f.ime, f.email, f.tel || null, f.datum, f.trajanje, f.broj, f.vrsta, f.napomena || null).run();
  } catch (e) { console.error(e); }
  try {
    await sendMail(env, { to: env.MAILBOX, replyTo: f.email, subject: `Upit: najam cijelog prostora (${f.ime})`, html: mail({ brand: 'SKRIPTA IdeaLab · interno', accent: C.rose, chip: 'Upit', title: 'Novi upit za cijeli prostor.', lead: 'Upit s websitea. Nije rezervacija.', rows }) });
    await sendMail(env, { to: f.email, subject: 'Primili smo tvoj upit', html: mail({ brand: 'SKRIPTA IdeaLab', accent: C.rose, chip: 'Nije rezervacija', title: 'Upit je primljen.', lead: `Hvala, ${esc(f.ime)}. Provjeravamo termin i javljamo ti se s ponudom. Ovo nije potvrđena rezervacija.`, rows }) });
  } catch (e) { console.error(e); return json({ ok: false, error: 'Slanje nije uspjelo.' }, 502); }
  return json({ ok: true });
}
