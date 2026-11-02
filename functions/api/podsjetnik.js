// Sends a reminder email to guests about 24 hours before a confirmed booking.
// Called hourly by a GitHub Actions schedule (see .github/workflows/podsjetnik.yml). Protected by CRON_SECRET.
import { NAMES, fmt, sarajevoNow, dayNum, priceText } from '../_lib/rules.js';
import { makeToken, esc, isEmail } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { sendMail } from '../_lib/graph.js';

const abs = (date, min) => dayNum(date) * 1440 + min;


async function sendReminder(env, b, test = false) {
  const when = `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;
  const cancel = test ? `${env.SITE_URL}/coffice.html#rezervacija` : `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, b.id, 'otkazi')}`;
  await sendMail(env, { to: b.email, subject: `${test ? '[TEST] ' : ''}Podsjetnik: tvoja rezervacija u ${fmt(b.start_min)}, SKRIPTA Coffice`, html: mail({ chip: 'Podsjetnik', tone: 'ok', accent: C.teal, title: 'Vidimo se uskoro.', lead: `Podsjećamo te na rezervaciju, ${esc(b.name)}.`, rows: [['Zona', NAMES[b.zone]], ['Termin', when], ['Ukupno', priceText(b.total)]], buttons: [{ href: cancel, label: 'Ne mogu doći, otkaži', kind: 'ghost' }], note: 'Ako ne možeš doći, otkaži da mjesto bude slobodno za nekog drugog.' }) });
}

export async function onRequestPost({ request, env }) {
  const key = (request.headers.get('x-cron-secret') || '').trim(), want = String(env.CRON_SECRET || '').trim();
  if (!want) return new Response('Forbidden', { status: 403 });
  if (key.length !== want.length || [...key].some((c, i) => c !== want[i])) return new Response('Forbidden', { status: 403 });

  const testTo = new URL(request.url).searchParams.get('test');
  if (testTo) {
    if (!isEmail(testTo)) return new Response('bad email', { status: 400 });
    const t = sarajevoNow(new Date(Date.now() + 86400000));
    await sendReminder(env, { id: 'test', email: testTo, name: 'Kamra', zone: 'ind', date: t.date, start_min: 10 * 60, dur_h: 2, total: 8 }, true);
    return new Response(JSON.stringify({ ok: true, test: testTo }), { headers: { 'content-type': 'application/json' } });
  }

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
      await sendReminder(env, b);
      await env.DB.prepare('UPDATE bookings SET reminded = 1 WHERE id = ?').bind(b.id).run(); sent++;
    } catch (e) { console.error(e); failed++; }
  }
  return new Response(JSON.stringify({ ok: true, sent, skipped, failed }), { headers: { 'content-type': 'application/json' } });
}
