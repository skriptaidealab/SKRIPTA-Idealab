import { checkQuery, freeStarts, loadDay, total, NAMES, fmt } from '../_lib/rules.js';
import { json, esc, makeToken, newId, isEmail, clean } from '../_lib/util.js';
import { mail } from '../_lib/mail.js';
import { listBlocks, sendMail } from '../_lib/graph.js';

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }
  if (b.web) return json({ ok: true }); // honeypot: bots fill this hidden field
  const q = { zone: clean(b.zona, 10), dur: +b.trajanje, persons: +b.osobe || 1, date: clean(b.datum, 10) };
  const start = +b.pocetak, name = clean(b.ime, 100), email = clean(b.email, 160), phone = clean(b.telefon, 40);
  const err = checkQuery(q) || (name.split(/\s+/).length < 2 ? 'Upiši ime i prezime.' : !isEmail(email) ? 'Upiši ispravan email.' : null);
  if (err) return json({ ok: false, error: err }, 400);
  let day;
  try { day = await loadDay(env, q.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Termini trenutno nisu dostupni. Pišite nam na info@skripta.ba.' }, 503); }
  const { bookings, blocks } = day;
  if (!freeStarts(q, bookings, blocks).includes(start)) return json({ ok: false, error: 'Taj termin više nije slobodan. Odaberite drugi.' }, 409);

  const id = newId(), sum = total(q.zone, q.dur, q.persons);
  await env.DB.prepare('INSERT INTO bookings (id, created_at, status, zone, persons, date, start_min, dur_h, total, name, email, phone) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, new Date().toISOString(), 'pending', q.zone, q.persons, q.date, start, q.dur, sum, name, email, phone || null).run();

  const when = `${q.date.split('-').reverse().join('.')} ${fmt(start)} do ${fmt(start + q.dur * 60)}`;
  const yes = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, id, 'potvrdi')}`;
  const no = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, id, 'odbij')}`;
  const rows = [['Zona', NAMES[q.zone]], ['Termin', when], ['Ukupno', `${sum} KM, plaćanje po dolasku`]];
  const guest = [['Ime', name], ['Email', email], ['Telefon', phone]];
  try {
    await sendMail(env, { to: env.MAILBOX, replyTo: email, subject: `Zahtjev za rezervaciju: ${NAMES[q.zone]}, ${when}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: 'Čeka odluku', tone: 'wait', title: 'Novi zahtjev za rezervaciju.', lead: 'Termin je zauzet tek kad potvrdiš. Klik otvara stranicu na kojoj potvrđuješ odluku.', rows: [...rows, ...guest], buttons: [{ href: yes, label: 'Potvrdi i dodaj u kalendar' }, { href: no, label: 'Odbij', kind: 'ghost' }] }) });
    await sendMail(env, { to: email, subject: 'Primili smo tvoj zahtjev za rezervaciju', html: mail({ chip: 'Još nije potvrđeno', tone: 'wait', title: 'Zahtjev je primljen.', lead: `Hvala, ${esc(name)}. Termin je tvoj tek kad ti potvrdimo emailom.`, rows, note: 'Kafa ili čaj su uključeni u cijenu. Ako se predomisliš ili trebaš promjenu, odgovori na ovaj email.' }) });
  } catch (e) {
    console.error(e);
    await env.DB.prepare("UPDATE bookings SET status = 'rejected' WHERE id = ?").bind(id).run();
    return json({ ok: false, error: 'Slanje nije uspjelo. Pošaljite nam email na info@skripta.ba.' }, 502);
  }
  return json({ ok: true });
}
