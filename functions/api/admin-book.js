import { checkQuery, tableFor, loadDay, loadSchedule, total, priceText, NAMES, fmt, zoneLabel, sarajevoNow, BUFFER_MIN } from '../_lib/rules.js';
import { tr, langOf, cofficePage } from '../_lib/i18n.js';
import { esc, makeToken, newId, isEmail, clean } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { listBlocks, sendMail, createEvent } from '../_lib/graph.js';
import { googleUrl } from '../_lib/cal.js';
import { markOptIn, subscribeIfOptedIn } from '../_lib/newsletter.js';

// Ručno dodavanje rezervacije s nadzorne ploče popunjenosti. Rezervacija je odmah potvrđena (nema koraka odobravanja),
// termin ide u Outlook, a gost dobija isti mail potvrde kao nakon klika na „Potvrdi” u mailu zahtjeva.
// Pravila kao na sajtu: kapacitet zone, cijelo-prostorni najmi, trajanja 1/2/4/6/8 h, do 4 osobe, cijena po datumu.
// Radno vrijeme, rok unaprijed i raspon datuma se ne provjeravaju (osoblje odlučuje). Preklapanje se uvijek odbija (409), bez izuzetka.
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;

export async function onRequestPost({ request, env }) {
  const key = (request.headers.get('x-cron-secret') || '').trim(), want = String(env.CRON_SECRET || '').trim();
  if (!want || key.length !== want.length || [...key].some((c, i) => c !== want[i])) return new Response('Forbidden', { status: 403 });
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }

  const q = { zone: clean(b.zona, 10), dur: +b.trajanje, persons: +b.osobe || 1, date: clean(b.datum, 10) };
  if (b.provjera) { // slobodni počeci za formu (08:00 do 21:00, korak 30 min), isti kriterij kao pri upisu
    const bad = checkQuery({ ...q, date: sarajevoNow().date });
    if ((bad && /^(Nepoznata zona|Nepoznato trajanje|Neispravan broj osoba)/.test(bad)) || !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return json({ ok: false, error: 'Neispravan upit.', starts: [] }, 400);
    let d; try { d = await loadDay(env, q.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Kalendar trenutno nije dostupan.', starts: [] }, 503); }
    const n = sarajevoNow(), starts = [];
    if (q.date >= n.date) for (let s = 8 * 60; s + q.dur * 60 <= 21 * 60; s += 30) {
      const e = s + q.dur * 60;
      if (q.date === n.date && s + 30 <= n.min) continue;
      if (tableFor(q, s, d.bookings) < 0) continue;
      if (d.blocks.some((x) => s < x.end_min + BUFFER_MIN && e > x.start_min - BUFFER_MIN)) continue;
      starts.push(s);
    }
    return json({ ok: true, starts });
  }
  const start = +b.pocetak, name = clean(b.ime, 100), email = clean(b.email, 160).toLowerCase(), phone = clean(b.telefon, 40);
  const now = sarajevoNow();
  let err = null;
  if (!name) err = 'Upiši ime.';
  else if (!isEmail(email)) err = 'Upiši ispravan e-mail.';
  else if (phone && (!/^\+?[\d\s().\/-]{6,}$/.test(phone) || phone.replace(/\D/g, '').length < 8 || phone.replace(/\D/g, '').length > 15)) err = 'Telefon nije ispravan.';
  else if (!Number.isInteger(start) || start < 0 || start >= 24 * 60 || start % 15) err = 'Neispravno vrijeme početka.';
  else {
    // Isto što i na sajtu (zona, trajanje, broj osoba, datum), ali bez ograničenja radnog vremena i raspona datuma.
    // checkQuery vraća i greške o datumu (nedjelja, raspon): za datum se zato provjeravaju samo zona, trajanje i broj osoba, a preko današnjeg datuma.
    err = checkQuery({ ...q, date: now.date });
    if (err && !/^(Nepoznata zona|Nepoznato trajanje|Neispravan broj osoba)/.test(err)) err = null;
    if (!err && !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) err = 'Neispravan datum.';
    if (!err && (q.date < now.date || (q.date === now.date && start + q.dur * 60 <= now.min))) err = 'Termin je već prošao.';
  }
  if (err) return json({ ok: false, error: err }, 400);

  let day;
  try { day = await loadDay(env, q.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Kalendar trenutno nije dostupan. Pokušaj ponovo.' }, 503); }
  const end = start + q.dur * 60, issues = [];
  if (tableFor(q, start, day.bookings) < 0) issues.push(`${NAMES[q.zone]} nema dovoljno slobodnih mjesta u tom terminu`);
  if (day.blocks.some((x) => start < x.end_min + BUFFER_MIN && end > x.start_min - BUFFER_MIN)) issues.push('cijeli prostor je zauzet (najam)');
  if (issues.length) return json({ ok: false, conflict: true, error: issues.join('; ') }, 409);

  const id = newId(), sum = total(q.zone, q.dur, q.persons, q.date, 0, start, await loadSchedule(env)); // schedule discounts apply to staff bookings too
  await env.DB.prepare("INSERT INTO bookings (id, created_at, status, zone, persons, date, start_min, dur_h, total, name, email, phone) VALUES (?,?,'confirmed',?,?,?,?,?,?,?,?,?)")
    .bind(id, new Date().toISOString(), q.zone, q.persons, q.date, start, q.dur, sum, name, email, phone || null).run();
  const r = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
  if (b.newsletter === true) { await markOptIn(env, id); await subscribeIfOptedIn(env, r); } // samo ako je osoblje označilo da je gost pristao

  let calendar = true, mailed = true, eventId = null;
  const cancelUs = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, id, 'otkazi-mi')}`;
  try {
    eventId = await createEvent(env, { subject: `Coffice: ${NAMES[r.zone]}, ${r.persons} os. (${r.name})`, html: `<p>${esc(r.name)}, ${esc(r.email)}${r.phone ? ', ' + esc(r.phone) : ''}<br>${priceText(r.total)}</p><p>Dodano ručno sa nadzorne ploče.</p><p><a href="${cancelUs}">Otkaži ovu rezervaciju (mi otkazujemo)</a></p>`, date: r.date, startMin: r.start_min, endMin: r.start_min + r.dur_h * 60 });
    await env.DB.prepare('UPDATE bookings SET event_id = ? WHERE id = ?').bind(eventId, id).run();
  } catch (e) { console.error(e); calendar = String(e.message || e); }

  try {
    const cancel = `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, id, 'otkazi')}`;
    const icsUrl = `${env.SITE_URL}/api/kalendar?t=${await makeToken(env, id, 'kalendar')}`;
    await sendMail(env, { to: r.email, subject: tr(langOf(r), 'Rezervacija potvrđena: SKRIPTA Coffice'), html: mail({ lang: langOf(r), chip: 'Potvrđeno', tone: 'ok', accent: C.teal, title: 'Vidimo se.', lead: `Tvoja rezervacija je potvrđena, ${esc(r.name)}.`, rows: [['Zona', zoneLabel(r)], ['Termin', whenOf(r)], ['Ukupno', priceText(r.total)]], buttons: [{ href: googleUrl(r), label: 'Dodaj u Google kalendar' }, { href: icsUrl, label: 'Apple / Outlook', kind: 'ghost' }, { href: cancel, label: 'Otkaži rezervaciju', kind: 'ghost' }], note: r.total === 0 ? 'Kafa ili čaj su besplatni.' : 'Plaćanje je po dolasku, gotovinom ili karticom. Kafa ili čaj su besplatni.' }) });
  } catch (e) { console.error(e); mailed = String(e.message || e); }
  return json({ ok: true, id, calendar, mail: mailed });
}
