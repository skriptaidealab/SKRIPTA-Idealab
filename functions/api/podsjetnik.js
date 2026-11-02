// Sends a reminder email to guests about 24 hours before a confirmed booking.
// Called hourly by a GitHub Actions schedule (see .github/workflows/podsjetnik.yml). Protected by CRON_SECRET.
import { NAMES, fmt, sarajevoNow, dayNum, priceText } from '../_lib/rules.js';
import { makeToken, esc } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { sendMail } from '../_lib/graph.js';

const abs = (date, min) => dayNum(date) * 1440 + min;

export async function onRequestPost({ request, env }) {
  const key = request.headers.get('x-cron-secret') || '';
  if (!env.CRON_SECRET || key.length !== env.CRON_SECRET.length || [...key].some((c, i) => c !== env.CRON_SECRET[i])) return new Response('Forbidden', { status: 403 });

  const now = sarajevoNow(), nowAbs = abs(now.date, now.min);
  const today = now.date, until = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const rows = (await env.DB.prepare("SELECT * FROM bookings WHERE status = 'confirmed' AND reminded = 0 AND date >= ? AND date <= ?").bind(today, until).all()).results || [];

  let sent = 0, skipped = 0, failed = 0;
  for (const b of rows) {
    const startAbs = abs(b.date, b.start_min), left = startAbs - nowAbs;
    if (left <= 0 || left > 1440) continue;                       // only the last 24 hours before the start
    const c = sarajevoNow(new Date(b.created_at));
    if (startAbs - abs(c.date, c.min) < 1440 + 60) {              // booked less than ~25h ahead: no reminder needed
      await env.DB.prepare('UPDATE bookings SET reminded = 1 WHERE id = ?').bind(b.id).run(); skipped++; continue;
    }
    try {
      const when = `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;
      const cancel = `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, b.id, 'otkazi')}`;
      await sendMail(env, { to: b.email, subject: `Podsjetnik: tvoja rezervacija u ${fmt(b.start_min)}, SKRIPTA Coffice`, html: mail({ chip: 'Podsjetnik', tone: 'ok', accent: C.teal, title: 'Vidimo se uskoro.', lead: `Podsjećamo te na rezervaciju, ${esc(b.name)}.`, rows: [['Zona', NAMES[b.zone]], ['Termin', when], ['Ukupno', priceText(b.total)]], buttons: [{ href: cancel, label: 'Ne mogu doći, otkaži', kind: 'ghost' }], note: 'Ako ne možeš doći, otkaži da mjesto bude slobodno za nekog drugog.' }) });
      await env.DB.prepare('UPDATE bookings SET reminded = 1 WHERE id = ?').bind(b.id).run(); sent++;
    } catch (e) { console.error(e); failed++; }
  }
  return new Response(JSON.stringify({ ok: true, sent, skipped, failed }), { headers: { 'content-type': 'application/json' } });
}
