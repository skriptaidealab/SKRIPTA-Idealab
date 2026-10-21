import { checkQuery, freeStarts, loadDay, total, NAMES, fmt } from '../_lib/rules.js';
import { json, esc, makeToken, newId, isEmail, clean } from '../_lib/util.js';
import { listBlocks, sendMail } from '../_lib/graph.js';

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }
  if (b.web) return json({ ok: true }); // honeypot: bots fill this hidden field
  const q = { zone: clean(b.zona, 10), dur: +b.trajanje, persons: +b.osobe || 1, date: clean(b.datum, 10) };
  const start = +b.pocetak, name = clean(b.ime, 100), email = clean(b.email, 160), phone = clean(b.telefon, 40);
  const err = checkQuery(q) || (!name ? 'Upišite ime.' : !isEmail(email) ? 'Upišite ispravan email.' : null);
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
  const rows = `<p><b>${esc(NAMES[q.zone])}</b>, ${esc(when)}<br>${q.persons} ${q.persons === 1 ? 'osoba' : 'osobe'}, ukupno <b>${sum} KM</b> (plaćanje po dolasku)<br>${esc(name)}, ${esc(email)}${phone ? ', ' + esc(phone) : ''}</p>`;
  try {
    await sendMail(env, { to: env.MAILBOX, replyTo: email, subject: `Zahtjev za rezervaciju: ${NAMES[q.zone]}, ${when}`, html: `<p>Novi zahtjev za rezervaciju. Nije potvrđen.</p>${rows}<p><a href="${yes}">Potvrdi i dodaj u kalendar</a> &nbsp;|&nbsp; <a href="${no}">Odbij</a></p><p style="color:#666">Klik otvara stranicu na kojoj potvrđujete odluku.</p>` });
    await sendMail(env, { to: email, subject: 'Primili smo vaš zahtjev za rezervaciju', html: `<p>Poštovani/a ${esc(name)},</p><p>primili smo vaš zahtjev. <b>Rezervacija nije potvrđena</b> dok vam ne potvrdimo emailom.</p>${rows}<p>SKRIPTA, Emerika Bluma 9, Sarajevo<br>info@skripta.ba, +387 62 307 885</p>` });
  } catch (e) {
    console.error(e);
    await env.DB.prepare("UPDATE bookings SET status = 'rejected' WHERE id = ?").bind(id).run();
    return json({ ok: false, error: 'Slanje nije uspjelo. Pošaljite nam email na info@skripta.ba.' }, 502);
  }
  return json({ ok: true });
}
