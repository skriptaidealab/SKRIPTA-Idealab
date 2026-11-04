import { checkQuery, freeStarts, loadDay, tableFor, priceText, NAMES, fmt, zoneLabel } from '../_lib/rules.js';
import { page, esc, makeToken, readToken } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { subscribeIfOptedIn } from '../_lib/newsletter.js';
import { listBlocks, sendMail, createEvent, deleteEvent } from '../_lib/graph.js';
import { googleUrl } from '../_lib/cal.js';

const load = (env, id) => env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;
const summary = (b) => `<dl><dt>Zona</dt><dd>${esc(NAMES[b.zone])}, ${b.persons} ${b.persons === 1 ? 'osoba' : 'osobe'}</dd><dt>Termin</dt><dd>${esc(whenOf(b))}</dd><dt>Ukupno</dt><dd>${priceText(b.total)}</dd><dt>Gost</dt><dd>${esc(b.name)}, ${esc(b.email)}${b.phone ? ', ' + esc(b.phone) : ''}</dd></dl>`;

// GET only shows a page. Mail scanners that pre-open links therefore cannot confirm anything.
export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get('t');
  const k = await readToken(env, t, ['potvrdi', 'odbij', 'otkazi-mi']);
  if (!k) return page('Link nije ispravan', '<h1>Link nije ispravan</h1>', 400);
  const b = await load(env, k.id);
  if (!b) return page('Nije pronađeno', '<h1>Rezervacija nije pronađena</h1>', 404);
  if (k.action === 'otkazi-mi') {
    if (!['confirmed', 'pending'].includes(b.status)) return page('Već obrađeno', `<h1>Rezervacija nije aktivna</h1><p>Status: ${esc(b.status)}</p>${summary(b)}`);
    return page('Otkaži rezervaciju', `<h1>Otkazati rezervaciju gosta?</h1>${summary(b)}<p>Gost dobija email da je rezervacija otkazana s naše strane, a događaj se briše iz kalendara.</p><form method="post"><input type="hidden" name="t" value="${esc(t)}"><button>Otkaži rezervaciju</button></form>`);
  }
  if (b.status !== 'pending') return page('Već obrađeno', `<h1>Već obrađeno</h1><p>Status: ${esc(b.status)}</p>${summary(b)}`);
  const label = k.action === 'potvrdi' ? 'Potvrdi i dodaj u kalendar' : 'Odbij zahtjev';
  return page(label, `<h1>${esc(label)}</h1>${summary(b)}<form method="post"><input type="hidden" name="t" value="${esc(t)}"><button>${esc(label)}</button></form>`);
}

export async function onRequestPost({ request, env }) {
  const t = (await request.formData()).get('t');
  const k = await readToken(env, t, ['potvrdi', 'odbij', 'otkazi-mi']);
  if (!k) return page('Link nije ispravan', '<h1>Link nije ispravan</h1>', 400);
  const b = await load(env, k.id);
  if (!b) return page('Nije pronađeno', '<h1>Rezervacija nije pronađena</h1>', 404);

  if (k.action === 'otkazi-mi') {
    if (!['confirmed', 'pending'].includes(b.status)) return page('Već obrađeno', `<h1>Rezervacija nije aktivna</h1><p>Status: ${esc(b.status)}</p>`);
    await env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").bind(b.id).run();
    let calNote = '';
    if (b.event_id) { try { await deleteEvent(env, b.event_id); } catch (e) { console.error(e); calNote = '<p><b>Upozorenje:</b> događaj nije obrisan iz kalendara. Obrišite ga ručno.</p>'; } }
    await sendMail(env, { to: b.email, subject: 'Otkazana rezervacija: SKRIPTA Coffice', html: mail({ chip: 'Otkazano', tone: 'no', accent: C.rose, title: 'Moramo otkazati tvoju rezervaciju.', lead: `Žao nam je, ${esc(b.name)}. Nažalost moramo otkazati tvoju rezervaciju. Ispričavamo se zbog neugodnosti.`, rows: [['Zona', zoneLabel(b)], ['Termin', whenOf(b)]], buttons: [{ href: `${env.SITE_URL}/coffice.html#rezervacija`, label: 'Odaberi novi termin' }], note: 'Ako imaš pitanja, odgovori na ovaj email ili nam piši na info@skripta.ba.' }) });
    return page('Otkazano', `<h1>Rezervacija otkazana</h1><p>Gost je obaviješten emailom.${b.event_id && !calNote ? ' Događaj je uklonjen iz kalendara.' : ''}</p>${calNote}${summary(b)}`);
  }

  if (b.status !== 'pending') return page('Već obrađeno', `<h1>Već obrađeno</h1><p>Status: ${esc(b.status)}</p>`);

  if (k.action === 'odbij') {
    await env.DB.prepare("UPDATE bookings SET status = 'rejected' WHERE id = ?").bind(b.id).run();
    await sendMail(env, { to: b.email, subject: 'Tvoj zahtjev za rezervaciju', html: mail({ chip: 'Nije potvrđeno', tone: 'no', accent: C.rose, title: 'Termin nije slobodan.', lead: `Nažalost ne možemo potvrditi traženi termin. Odaberi drugi na skripta.ba ili nam se javi na info@skripta.ba.`, rows: [['Zona', zoneLabel(b)], ['Termin', whenOf(b)]], buttons: [{ href: `${env.SITE_URL}/coffice.html#rezervacija`, label: 'Odaberi drugi termin' }] }) });
    return page('Odbijeno', '<h1>Zahtjev odbijen</h1><p>Gost je obaviješten emailom.</p>');
  }

  // confirm: re-check availability (another request may have been confirmed meanwhile)
  const q = { zone: b.zone, dur: b.dur_h, persons: b.persons, date: b.date };
  const day = await loadDay(env, b.date, listBlocks);
  const tbl = tableFor(q, b.start_min, day.bookings);
  const blocked = day.blocks.some((x) => b.start_min < x.end_min && b.start_min + b.dur_h * 60 > x.start_min);
  if (tbl < 0 || blocked) return page('Termin nije slobodan', `<h1>Termin više nije slobodan</h1><p>Drugi potvrđeni termin ili najam cijelog prostora se preklapa. Odbijte zahtjev ili se javite gostu.</p>${summary(b)}`, 409);

  let eventId = null, calendarNote = '';
  const cancelUs = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, b.id, 'otkazi-mi')}`;
  try {
    eventId = await createEvent(env, { subject: `Coffice: ${NAMES[b.zone]}, ${b.persons} os. (${b.name})`, html: `<p>${esc(b.name)}, ${esc(b.email)}${b.phone ? ', ' + esc(b.phone) : ''}<br>${priceText(b.total)}</p><p><a href="${cancelUs}">Otkaži ovu rezervaciju (mi otkazujemo)</a></p>`, date: b.date, startMin: b.start_min, endMin: b.start_min + b.dur_h * 60 });
  } catch (e) { console.error(e); calendarNote = '<p><b>Upozorenje:</b> događaj nije upisan u kalendar. Dodajte ga ručno.</p>'; }
  await env.DB.prepare("UPDATE bookings SET status = 'confirmed', table_idx = ?, event_id = ? WHERE id = ?").bind(q.zone === 'cafe' ? tbl : null, eventId, b.id).run();
  await subscribeIfOptedIn(env, b);
  const cancel = `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, b.id, 'otkazi')}`;
  const icsUrl = `${env.SITE_URL}/api/kalendar?t=${await makeToken(env, b.id, 'kalendar')}`;
  await sendMail(env, { to: b.email, subject: 'Rezervacija potvrđena: SKRIPTA Coffice', html: mail({ chip: 'Potvrđeno', tone: 'ok', accent: C.teal, title: 'Vidimo se.', lead: `Tvoja rezervacija je potvrđena, ${esc(b.name)}.`, rows: [['Zona', zoneLabel(b)], ['Termin', whenOf(b)], ['Ukupno', priceText(b.total)]], buttons: [{ href: googleUrl(b), label: 'Dodaj u Google kalendar' }, { href: icsUrl, label: 'Apple / Outlook', kind: 'ghost' }, { href: cancel, label: 'Otkaži rezervaciju', kind: 'ghost' }], note: b.total === 0 ? 'Kafa ili čaj su besplatni.' : 'Plaćanje je po dolasku, gotovinom ili karticom. Kafa ili čaj su besplatni.' }) });
  // Internal notification so the team sees every confirmation in the inbox, not only in the calendar.
  try {
    await sendMail(env, { to: env.MAILBOX, subject: `Potvrđeno: ${b.name}, ${NAMES[b.zone]}, ${whenOf(b)}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: 'Potvrđeno', tone: 'ok', accent: C.teal, title: 'Rezervacija je potvrđena.', lead: 'Gost je obaviješten emailom.', rows: [['Zona', zoneLabel(b)], ['Termin', whenOf(b)], ['Ukupno', priceText(b.total)], ['Ime', b.name], ['Email', b.email], ['Telefon', b.phone || '']], buttons: [{ href: cancelUs, label: 'Otkaži rezervaciju (mi otkazujemo)', kind: 'ghost' }], note: eventId ? 'Događaj je dodan u kalendar.' : 'Događaj NIJE dodan u kalendar. Dodajte ga ručno.' }) });
  } catch (e) { console.error(e); }
  return page('Potvrđeno', `<h1>Potvrđeno</h1><p>Gost je obaviješten emailom.${eventId ? ' Događaj je u kalendaru.' : ''}</p>${calendarNote}${summary(b)}`);
}
