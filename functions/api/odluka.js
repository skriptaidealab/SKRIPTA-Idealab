import { checkQuery, freeStarts, loadDay, tableFor, NAMES, fmt } from '../_lib/rules.js';
import { page, esc, makeToken, readToken } from '../_lib/util.js';
import { listBlocks, sendMail, createEvent } from '../_lib/graph.js';

const load = (env, id) => env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;
const summary = (b) => `<dl><dt>Zona</dt><dd>${esc(NAMES[b.zone])}, ${b.persons} ${b.persons === 1 ? 'osoba' : 'osobe'}</dd><dt>Termin</dt><dd>${esc(whenOf(b))}</dd><dt>Ukupno</dt><dd>${b.total} KM, plaćanje po dolasku</dd><dt>Gost</dt><dd>${esc(b.name)}, ${esc(b.email)}${b.phone ? ', ' + esc(b.phone) : ''}</dd></dl>`;

// GET only shows a page. Mail scanners that pre-open links therefore cannot confirm anything.
export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get('t');
  const k = await readToken(env, t, ['potvrdi', 'odbij']);
  if (!k) return page('Link nije ispravan', '<h1>Link nije ispravan</h1>', 400);
  const b = await load(env, k.id);
  if (!b) return page('Nije pronađeno', '<h1>Rezervacija nije pronađena</h1>', 404);
  if (b.status !== 'pending') return page('Već obrađeno', `<h1>Već obrađeno</h1><p>Status: ${esc(b.status)}</p>${summary(b)}`);
  const label = k.action === 'potvrdi' ? 'Potvrdi i dodaj u kalendar' : 'Odbij zahtjev';
  return page(label, `<h1>${esc(label)}</h1>${summary(b)}<form method="post"><input type="hidden" name="t" value="${esc(t)}"><button>${esc(label)}</button></form>`);
}

export async function onRequestPost({ request, env }) {
  const t = (await request.formData()).get('t');
  const k = await readToken(env, t, ['potvrdi', 'odbij']);
  if (!k) return page('Link nije ispravan', '<h1>Link nije ispravan</h1>', 400);
  const b = await load(env, k.id);
  if (!b) return page('Nije pronađeno', '<h1>Rezervacija nije pronađena</h1>', 404);
  if (b.status !== 'pending') return page('Već obrađeno', `<h1>Već obrađeno</h1><p>Status: ${esc(b.status)}</p>`);

  if (k.action === 'odbij') {
    await env.DB.prepare("UPDATE bookings SET status = 'rejected' WHERE id = ?").bind(b.id).run();
    await sendMail(env, { to: b.email, subject: 'Vaš zahtjev za rezervaciju', html: `<p>Poštovani/a ${esc(b.name)},</p><p>nažalost ne možemo potvrditi traženi termin (${esc(NAMES[b.zone])}, ${esc(whenOf(b))}). Slobodno odaberite drugi termin na skripta.ba ili nam se javite na info@skripta.ba.</p>` });
    return page('Odbijeno', '<h1>Zahtjev odbijen</h1><p>Gost je obaviješten emailom.</p>');
  }

  // confirm: re-check availability (another request may have been confirmed meanwhile)
  const q = { zone: b.zone, dur: b.dur_h, persons: b.persons, date: b.date };
  const day = await loadDay(env, b.date, listBlocks);
  const tbl = tableFor(q, b.start_min, day.bookings);
  const blocked = day.blocks.some((x) => b.start_min < x.end_min && b.start_min + b.dur_h * 60 > x.start_min);
  if (tbl < 0 || blocked) return page('Termin nije slobodan', `<h1>Termin više nije slobodan</h1><p>Drugi potvrđeni termin ili najam cijelog prostora se preklapa. Odbijte zahtjev ili se javite gostu.</p>${summary(b)}`, 409);

  let eventId = null, calendarNote = '';
  try {
    eventId = await createEvent(env, { subject: `Coffice: ${NAMES[b.zone]}, ${b.persons} os. (${b.name})`, html: `<p>${esc(b.name)}, ${esc(b.email)}${b.phone ? ', ' + esc(b.phone) : ''}<br>${b.total} KM, plaćanje po dolasku</p>`, date: b.date, startMin: b.start_min, endMin: b.start_min + b.dur_h * 60 });
  } catch (e) { console.error(e); calendarNote = '<p><b>Upozorenje:</b> događaj nije upisan u kalendar. Dodajte ga ručno.</p>'; }
  await env.DB.prepare("UPDATE bookings SET status = 'confirmed', table_idx = ?, event_id = ? WHERE id = ?").bind(q.zone === 'cafe' ? tbl : null, eventId, b.id).run();
  const cancel = `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, b.id, 'otkazi')}`;
  await sendMail(env, { to: b.email, subject: 'Rezervacija potvrđena: SKRIPTA Coffice', html: `<p>Poštovani/a ${esc(b.name)},</p><p>vaša rezervacija je <b>potvrđena</b>.</p>${summary(b)}<p>Plaćanje po dolasku, gotovinom ili karticom. Emerika Bluma 9, Sarajevo.</p><p>Ako ne možete doći: <a href="${cancel}">otkažite rezervaciju</a>.</p>` });
  return page('Potvrđeno', `<h1>Potvrđeno</h1><p>Gost je obaviješten emailom.${eventId ? ' Događaj je u kalendaru.' : ''}</p>${calendarNote}${summary(b)}`);
}
