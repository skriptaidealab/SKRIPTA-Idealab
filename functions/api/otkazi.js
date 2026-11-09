import { NAMES, fmt, sarajevoNow, zoneLabel } from '../_lib/rules.js';
import { page, esc, readToken } from '../_lib/util.js';
import { sendMail, deleteEvent } from '../_lib/graph.js';
import { mail, C } from '../_lib/mail.js';
import { langOf, tr } from '../_lib/i18n.js';

const load = (env, id) => env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;

export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get('t');
  const k = await readToken(env, t, ['otkazi']);
  const b = k && await load(env, k.id);
  if (!b) return page('Link nije ispravan', '<h1>Link nije ispravan</h1>', 400);
  const L = langOf(b), en = L === 'en';
  if (!['confirmed', 'pending'].includes(b.status)) return en ? page('Already cancelled', '<h1>This booking is no longer active</h1>', 200, L) : page('Već otkazano', '<h1>Rezervacija nije aktivna</h1>');
  const pend = b.status === 'pending';
  if (en) return page(pend ? 'Cancel request' : 'Cancel booking', `<h1>${pend ? 'Cancel your booking request?' : 'Cancel your booking?'}</h1><p>${esc(tr(L, zoneLabel(b)))}, ${esc(tr(L, whenOf(b)))}</p><form method="post"><input type="hidden" name="t" value="${esc(t)}"><button>${pend ? 'Cancel request' : 'Cancel booking'}</button></form>`, 200, L);
  return page(pend ? 'Otkazivanje zahtjeva' : 'Otkazivanje', `<h1>${pend ? 'Otkazati zahtjev za rezervaciju?' : 'Otkazati rezervaciju?'}</h1><p>${esc(NAMES[b.zone])}, ${esc(whenOf(b))}</p><form method="post"><input type="hidden" name="t" value="${esc(t)}"><button>${pend ? 'Otkaži zahtjev' : 'Otkaži rezervaciju'}</button></form>`);
}

export async function onRequestPost({ request, env }) {
  const t = (await request.formData()).get('t');
  const k = await readToken(env, t, ['otkazi']);
  const b = k && await load(env, k.id);
  const L = langOf(b), en = L === 'en';
  if (!b || !['confirmed', 'pending'].includes(b.status)) return en ? page('Not possible', '<h1>This booking is no longer active</h1>', 400, L) : page('Nije moguće', '<h1>Rezervacija nije aktivna</h1>', 400);
  const now = sarajevoNow();
  if (b.date < now.date || (b.date === now.date && b.start_min <= now.min)) return en ? page('Too late', '<h1>The booking has already started</h1><p>Please write to info@skripta.ba.</p>', 400, L) : page('Prekasno', '<h1>Termin je već počeo</h1><p>Javi nam se na info@skripta.ba.</p>', 400);
  const pend = b.status === 'pending';
  await env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").bind(b.id).run();
  if (b.event_id) { try { await deleteEvent(env, b.event_id); } catch (e) { console.error(e); } }
  await sendMail(env, { to: env.MAILBOX, subject: `${pend ? 'Zahtjev otkazan' : 'Otkazano'}: ${NAMES[b.zone]}, ${whenOf(b)}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: pend ? 'Otkazano' : 'Otkazano', tone: 'no', accent: C.rose, title: pend ? 'Gost je otkazao zahtjev.' : 'Gost je otkazao.', rows: [['Zona', zoneLabel(b)], ['Termin', whenOf(b)], ['Ime', b.name], ['Email', b.email]], note: pend ? 'Nije potrebna nikakva radnja. Dugmad u ranijem mailu s ovim zahtjevom više ne rade.' : (b.event_id ? 'Događaj je uklonjen iz kalendara.' : '') }) });
  if (en) return page('Cancelled', pend ? '<h1>Request cancelled</h1><p>Thanks for letting us know.</p>' : '<h1>Booking cancelled</h1><p>Thanks for letting us know.</p>', 200, L);
  return page(pend ? 'Zahtjev otkazan' : 'Otkazano', pend ? '<h1>Zahtjev otkazan</h1><p>Hvala što si nam javio/la.</p>' : '<h1>Rezervacija otkazana</h1><p>Hvala što si nam javio/la.</p>');
}
