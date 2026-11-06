import { checkQuery, tableFor, loadDay, loadSchedule, total, priceText, promoPctOf, NAMES, fmt, zoneLabel, sarajevoNow, BUFFER_MIN } from '../_lib/rules.js';
import { esc, makeToken, clean } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { listBlocks, sendMail, createEvent, deleteEvent } from '../_lib/graph.js';
import { googleUrl } from '../_lib/cal.js';

// Izmjena termina (datum, početak, trajanje) potvrđene rezervacije s nadzorne ploče. Zona i broj osoba ostaju isti.
// Provjerava kapacitet i blokade (rezervacija koja se mijenja ne računa se sama protiv sebe), upisuje u bazu i šalje gostu mail „Rezervacija izmijenjena”.
// Radno vrijeme se ne provjerava (osoblje odlučuje), kao ni kod ručnog unosa.
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;

export async function onRequestPost({ request, env }) {
  const key = (request.headers.get('x-cron-secret') || '').trim(), want = String(env.CRON_SECRET || '').trim();
  if (!want || key.length !== want.length || [...key].some((c, i) => c !== want[i])) return new Response('Forbidden', { status: 403 });
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }

  const b = body.id && await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(String(body.id)).first();
  if (!b || b.status !== 'confirmed' || b.event_id === 'walkin') return json({ ok: false, error: 'Rezervacija nije pronađena ili nije aktivna.' }, 404);
  const now = sarajevoNow();
  if (b.checked_in_at || b.date < now.date || (b.date === now.date && b.start_min <= now.min)) return json({ ok: false, error: 'Termin je već počeo. Za produžavanje koristi Produži na pregledu.' }, 400);

  const q = { zone: b.zone, dur: +body.trajanje, persons: b.persons, date: clean(body.datum, 10) };
  const bad = checkQuery({ ...q, date: now.date });
  if (bad && /^(Nepoznata zona|Nepoznato trajanje|Neispravan broj osoba)/.test(bad)) return json({ ok: false, error: bad, starts: [] }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return json({ ok: false, error: 'Neispravan datum.', starts: [] }, 400);
  if (q.date < now.date) return json({ ok: false, error: 'Datum je u prošlosti.', starts: [] }, 400);

  let day;
  try { day = await loadDay(env, q.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Baza trenutno nije dostupna. Pokušaj ponovo.' }, 503); }
  const others = day.bookings.filter((x) => x.id !== b.id);
  const free = (s) => {
    const e = s + q.dur * 60;
    if (tableFor(q, s, others) < 0) return 'nema dovoljno slobodnih mjesta u ' + NAMES[q.zone];
    if (day.blocks.some((x) => s < x.end_min + BUFFER_MIN && e > x.start_min - BUFFER_MIN)) return 'prostor je blokiran (najam ili event)';
    return null;
  };

  if (body.provjera) {
    const starts = [];
    for (let s = 8 * 60; s + q.dur * 60 <= 21 * 60; s += 30) {
      if (q.date === now.date && s + 30 <= now.min) continue;
      if (!free(s)) starts.push(s);
    }
    return json({ ok: true, starts });
  }

  const start = +body.pocetak;
  if (!Number.isInteger(start) || start < 0 || start >= 24 * 60 || start % 15) return json({ ok: false, error: 'Neispravno vrijeme početka.' }, 400);
  if (q.date === now.date && start + q.dur * 60 <= now.min) return json({ ok: false, error: 'Termin je već prošao.' }, 400);
  if (q.date === b.date && start === b.start_min && q.dur === b.dur_h) return json({ ok: false, error: 'Nema promjene: termin je isti.' }, 400);
  const issue = free(start);
  if (issue) return json({ ok: false, conflict: true, error: 'Nije moguće: ' + issue + '.' }, 409);

  const old = { ...b };
  const sum = total(b.zone, q.dur, b.persons, q.date, promoPctOf(b), start, await loadSchedule(env)); // a booking keeps its promo discount
  await env.DB.prepare('UPDATE bookings SET date = ?, start_min = ?, dur_h = ?, total = ?, reminded = 0 WHERE id = ?').bind(q.date, start, q.dur, sum, b.id).run();
  const r = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(b.id).first();

  let calendar = true, mailed = true;
  try {
    if (b.event_id) await deleteEvent(env, b.event_id);
    const cancelUs = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, r.id, 'otkazi-mi')}`;
    const eventId = await createEvent(env, { subject: `Coffice: ${NAMES[r.zone]}, ${r.persons} os. (${r.name})`, html: `<p>${esc(r.name)}, ${esc(r.email)}${r.phone ? ', ' + esc(r.phone) : ''}<br>${priceText(r.total)}</p><p>Termin izmijenjen sa nadzorne ploče.</p><p><a href="${cancelUs}">Otkaži ovu rezervaciju (mi otkazujemo)</a></p>`, date: r.date, startMin: r.start_min, endMin: r.start_min + r.dur_h * 60 });
    await env.DB.prepare('UPDATE bookings SET event_id = ? WHERE id = ?').bind(eventId, r.id).run();
  } catch (e) { console.error(e); calendar = String(e.message || e); }

  if (!r.email) mailed = 'gost nema e-mail';
  else {
    try {
      const cancel = `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, r.id, 'otkazi')}`;
      const icsUrl = `${env.SITE_URL}/api/kalendar?t=${await makeToken(env, r.id, 'kalendar')}`;
      await sendMail(env, { to: r.email, subject: 'Rezervacija izmijenjena: SKRIPTA Coffice', html: mail({ chip: 'Izmijenjeno', tone: 'ok', accent: C.teal, title: 'Termin je promijenjen.', lead: `${esc(r.name)}, tvoja rezervacija je izmijenjena. Novi termin je ispod. Ako ti ne odgovara, otkaži je ili nam se javi na info@skripta.ba.`, rows: [['Zona', zoneLabel(r)], ['Prije', whenOf(old)], ['Novi termin', whenOf(r)], ['Ukupno', priceText(r.total)]], buttons: [{ href: googleUrl(r), label: 'Dodaj u Google kalendar' }, { href: icsUrl, label: 'Apple / Outlook', kind: 'ghost' }, { href: cancel, label: 'Otkaži rezervaciju', kind: 'ghost' }] }) });
    } catch (e) { console.error(e); mailed = String(e.message || e); }
  }
  return json({ ok: true, calendar, mail: mailed });
}
