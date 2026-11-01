import { NAMES, fmt, sarajevoNow } from '../_lib/rules.js';
import { page, esc, readToken } from '../_lib/util.js';
import { sendMail, deleteEvent } from '../_lib/graph.js';
import { mail, C } from '../_lib/mail.js';

const load = (env, id) => env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;

export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get('t');
  const k = await readToken(env, t, ['otkazi']);
  const b = k && await load(env, k.id);
  if (!b) return page('Link nije ispravan', '<h1>Link nije ispravan</h1>', 400);
  if (!['confirmed', 'pending'].includes(b.status)) return page('Već otkazano', '<h1>Rezervacija nije aktivna</h1>');
  const pend = b.status === 'pending';
  return page(pend ? 'Povlačenje zahtjeva' : 'Otkazivanje', `<h1>${pend ? 'Povući zahtjev za rezervaciju?' : 'Otkazati rezervaciju?'}</h1><p>${esc(NAMES[b.zone])}, ${esc(whenOf(b))}</p><form method="post"><input type="hidden" name="t" value="${esc(t)}"><button>${pend ? 'Povuci zahtjev' : 'Otkaži rezervaciju'}</button></form>`);
}

export async function onRequestPost({ request, env }) {
  const t = (await request.formData()).get('t');
  const k = await readToken(env, t, ['otkazi']);
  const b = k && await load(env, k.id);
  if (!b || !['confirmed', 'pending'].includes(b.status)) return page('Nije moguće', '<h1>Rezervacija nije aktivna</h1>', 400);
  const now = sarajevoNow();
  if (b.date < now.date || (b.date === now.date && b.start_min <= now.min)) return page('Prekasno', '<h1>Termin je već počeo</h1><p>Javi nam se na info@skripta.ba.</p>', 400);
  const pend = b.status === 'pending';
  await env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").bind(b.id).run();
  if (b.event_id) { try { await deleteEvent(env, b.event_id); } catch (e) { console.error(e); } }
  await sendMail(env, { to: env.MAILBOX, subject: `${pend ? 'Zahtjev povučen' : 'Otkazano'}: ${NAMES[b.zone]}, ${whenOf(b)}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: pend ? 'Povučeno' : 'Otkazano', tone: 'no', accent: C.rose, title: pend ? 'Gost je povukao zahtjev.' : 'Gost je otkazao.', rows: [['Zona', NAMES[b.zone]], ['Termin', whenOf(b)], ['Ime', b.name], ['Email', b.email]], note: pend ? 'Nije potrebna nikakva radnja. Dugmad u ranijem mailu s ovim zahtjevom više ne rade.' : (b.event_id ? 'Događaj je uklonjen iz kalendara.' : '') }) });
  return page(pend ? 'Zahtjev povučen' : 'Otkazano', pend ? '<h1>Zahtjev povučen</h1><p>Hvala što si nam javio/la.</p>' : '<h1>Rezervacija otkazana</h1><p>Hvala što si nam javio/la.</p>');
}
