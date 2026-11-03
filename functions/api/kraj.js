// Sends "15 minutes left" e-mails. Only guests who scanned the QR code at check-in get one.
// Called every 5 minutes by the Cloudflare Worker in workers/kraj-cron. Protected by CRON_SECRET.
import { NAMES, fmt, sarajevoNow, dayNum } from '../_lib/rules.js';
import { esc, isEmail, niceName } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { sendMail } from '../_lib/graph.js';

const abs = (date, min) => dayNum(date) * 1440 + min;
const LEAD = 15;

async function send(env, b, test = false) {
  const end = fmt(b.start_min + b.dur_h * 60);
  await sendMail(env, { to: b.email, subject: `${test ? '[TEST] ' : ''}Još 15 minuta, SKRIPTA Coffice`, html: mail({ chip: 'Podsjetnik', tone: 'ok', accent: C.teal, title: 'Hvala vam što ste posjetili COFFICE!', lead: 'Vaš rezervisani termin ističe za 15 minuta.', rows: [['Zona', NAMES[b.zone]], ['Završetak', end]], note: 'Ukoliko želite produžiti boravak, molimo vas da se obratite našem osoblju.<br><br>Hvala na razumijevanju i radujemo se vašoj ponovnoj posjeti!' }) });
}

export async function onRequestPost({ request, env }) {
  const key = (request.headers.get('x-cron-secret') || '').trim(), want = String(env.CRON_SECRET || '').trim();
  if (!want || key.length !== want.length || [...key].some((c, i) => c !== want[i])) return new Response('Forbidden', { status: 403 });

  const testTo = new URL(request.url).searchParams.get('test');
  if (testTo) {
    if (!isEmail(testTo)) return new Response('bad email', { status: 400 });
    await send(env, { email: testTo, name: 'Kamra', zone: 'ind', start_min: 12 * 60, dur_h: 2 }, true);
    return Response.json({ ok: true, test: testTo });
  }

  const now = sarajevoNow(), nowAbs = abs(now.date, now.min);
  const rows = (await env.DB.prepare("SELECT * FROM bookings WHERE status = 'confirmed' AND date = ? AND end_reminded = 0").bind(now.date).all()).results || [];
  let sent = 0, skipped = 0, failed = 0;
  const done = (id) => env.DB.prepare('UPDATE bookings SET end_reminded = 1 WHERE id = ?').bind(id).run();
  for (const b of rows) {
    const endAbs = abs(b.date, b.start_min + b.dur_h * 60), left = endAbs - nowAbs;
    if (left > LEAD) continue;                                   // too early
    if (left <= 0 || !b.checked_in_at) {                         // slot over, or the guest never scanned
      if (left <= 0) { await done(b.id); if (b.checked_in_at) skipped++; }
      continue;                                                  // not scanned yet: they can still scan until the end
    }
    const ci = sarajevoNow(new Date(b.checked_in_at));
    if (abs(ci.date, ci.min) > endAbs - LEAD) { await done(b.id); skipped++; continue; } // scanned inside the last 15 minutes
    try { await send(env, b); await done(b.id); sent++; } catch (e) { console.error(e); failed++; }
  }
  return Response.json({ ok: true, sent, skipped, failed });
}
