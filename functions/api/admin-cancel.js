import { fmt, zoneLabel } from '../_lib/rules.js';
import { esc } from '../_lib/util.js';
import { sendMail, deleteEvent } from '../_lib/graph.js';
import { mail, C } from '../_lib/mail.js';

// Otkazivanje s nadzorne ploče popunjenosti. Isto što radi dugme „Otkaži rezervaciju (mi otkazujemo)” u mailu:
// status cancelled, brisanje događaja iz kalendara, mail gostu.
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;

export async function onRequestPost({ request, env }) {
  const key = (request.headers.get('x-cron-secret') || '').trim(), want = String(env.CRON_SECRET || '').trim();
  if (!want || key.length !== want.length || [...key].some((c, i) => c !== want[i])) return new Response('Forbidden', { status: 403 });
  const body = await request.json().catch(() => ({}));
  const b = body.id && await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(String(body.id)).first();
  if (!b) return json({ ok: false, error: 'Rezervacija nije pronađena.' }, 404);
  if (!['confirmed', 'pending'].includes(b.status)) return json({ ok: false, error: 'Rezervacija nije aktivna (' + b.status + ').' }, 409);
  await env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").bind(b.id).run();
  let calendar = true, mailed = true;
  if (b.event_id && b.event_id !== 'walkin') {
    try { await deleteEvent(env, b.event_id); } catch (e) { console.error(e); calendar = String(e.message || e); }
  }
  if (b.email) {
    try {
      await sendMail(env, { to: b.email, subject: 'Otkazana rezervacija: SKRIPTA Coffice', html: mail({ chip: 'Otkazano', tone: 'no', accent: C.rose, title: 'Moramo otkazati tvoju rezervaciju.', lead: `Žao nam je, ${esc(b.name)}. Nažalost moramo otkazati tvoju rezervaciju. Ispričavamo se zbog neugodnosti.`, rows: [['Zona', zoneLabel(b)], ['Termin', whenOf(b)]], buttons: [{ href: `${env.SITE_URL}/coffice.html#rezervacija`, label: 'Odaberi novi termin' }], note: 'Ako imaš pitanja, odgovori na ovaj email ili nam piši na info@skripta.ba.' }) });
    } catch (e) { console.error(e); mailed = String(e.message || e); }
  } else mailed = 'gost nema e-mail';
  return json({ ok: true, calendar, mail: mailed });
}
