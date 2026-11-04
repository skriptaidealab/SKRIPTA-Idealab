// QR check-in. The QR code on the printed welcome sheet opens this URL; the first scan is stored.
// Only a confirmed booking can check in, from 30 minutes before the start until the end of the slot.
import { NAMES, fmt, sarajevoNow, dayNum } from '../_lib/rules.js';
import { page, esc, readToken, niceName } from '../_lib/util.js';

const abs = (date, min) => dayNum(date) * 1440 + min;

export async function onRequestGet({ request, env }) {
  const k = await readToken(env, new URL(request.url).searchParams.get('t'), ['checkin']);
  const b = k && await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(k.id).first();
  if (!b) return page('Link nije ispravan', '<h1>Link nije ispravan</h1><p>Javi se osoblju na ulazu.</p>', 400);
  if (b.status !== 'confirmed') return page('Rezervacija nije aktivna', '<h1>Rezervacija nije aktivna</h1><p>Javi se osoblju na ulazu.</p>', 400);

  const now = sarajevoNow(), nowAbs = abs(now.date, now.min);
  const startAbs = abs(b.date, b.start_min), endAbs = startAbs + b.dur_h * 60;
  const when = `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;
  const info = `<dl><dt>Zona</dt><dd>${esc(NAMES[b.zone])}</dd><dt>Termin</dt><dd>${esc(when)}</dd></dl>`;
  if (nowAbs < startAbs - 30) return page('Prerano', `<h1>Još je rano</h1><p>Tvoj termin počinje u ${fmt(b.start_min)}. Skeniraj kod kad stigneš.</p>${info}`);
  if (nowAbs >= endAbs) return page('Termin je završen', `<h1>Termin je završen</h1>${info}`);

  await env.DB.prepare('UPDATE bookings SET checked_in_at = ? WHERE id = ? AND checked_in_at IS NULL').bind(new Date().toISOString(), b.id).run();
  const first = esc(niceName(b.name).split(' ')[0]);
  return page('Potvrđeno', `<h1>Dobro došao/la, ${first}.</h1><p>Dolazak je zabilježen. Tvoj termin završava u ${fmt(b.start_min + b.dur_h * 60)}. Nakon termina ti šaljemo kratku zahvalu emailom.</p>${info}`);
}
