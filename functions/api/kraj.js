// Sends the thank-you e-mail when the slot ends, or as soon as the guest is marked as left (left_at). Only guests who scanned the QR code at check-in get one.
// Called every 5 minutes by the Cloudflare Worker in workers/kraj-cron. Protected by CRON_SECRET.
import { NAMES, fmt, sarajevoNow, dayNum, zoneLabel } from '../_lib/rules.js';
import { esc, isEmail, niceName } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { sendMail } from '../_lib/graph.js';

const abs = (date, min) => dayNum(date) * 1440 + min;
const LATE = 90; // minutes after the end of the slot until a thank-you is still sent

async function send(env, b, test = false) {
  const first = esc(niceName(b.name).split(' ')[0]);
  const when = `${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;
  await sendMail(env, { to: b.email, subject: `${test ? '[TEST] ' : ''}Hvala na posjeti, SKRIPTA Coffice`, html: mail({ chip: 'Hvala', tone: 'ok', accent: C.teal, title: 'Hvala na posjeti!', lead: `Hvala ti, ${first}. Nadamo se da ti je u COFFICE-u bilo ugodno.`, rows: [['Zona', zoneLabel(b)], ['Termin', when]], buttons: [{ href: `${env.SITE_URL}/coffice.html#rezervacija`, label: 'Rezerviši ponovo' }], note: 'Vidimo se opet!<br><br><b style="color:#1A1A1A">Imaš li tri minute?</b> Reci nam šta misliš o prostoru. <a href="https://forms.cloud.microsoft/e/22pC0hMy1u" style="color:#1A1A1A;font-weight:700">Ispuni kratku anketu</a>. Anonimna je i pomaže nam da ga uredimo po tvojoj mjeri.' }) });
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
    if (!b.checked_in_at) { if (left <= 0) await done(b.id); continue; }  // never scanned the QR: no e-mail
    if (!isEmail(b.email)) { await done(b.id); continue; }                // walk-in guests have no e-mail address
    const departed = !!b.left_at;                                         // marked as left in the occupancy tracker
    if (!departed && left > 0) continue;                                  // still inside the slot
    if (!departed && left < -LATE) { await done(b.id); skipped++; continue; } // slot ended long ago (e.g. cron was down): do not send a stale thank-you
    try { await send(env, b); await done(b.id); sent++; } catch (e) { console.error(e); failed++; }
  }
  return Response.json({ ok: true, sent, skipped, failed });
}
