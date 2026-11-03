// Morning e-mail with the link to today's print-ready welcome sheets. Called once a day by workers/kraj-cron. Protected by CRON_SECRET.
// Needs env LETCI_TO (recipient). Sends nothing if there are no confirmed bookings today.
import { sarajevoNow, fmt } from '../_lib/rules.js';
import { makeToken, isEmail } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { sendMail } from '../_lib/graph.js';

export async function onRequestPost({ request, env }) {
  const key = (request.headers.get('x-cron-secret') || '').trim(), want = String(env.CRON_SECRET || '').trim();
  if (!want || key.length !== want.length || [...key].some((c, i) => c !== want[i])) return new Response('Forbidden', { status: 403 });
  if (!isEmail(env.LETCI_TO || '')) return Response.json({ ok: false, error: 'LETCI_TO nije postavljen' }, { status: 500 });

  const url = new URL(request.url), date = url.searchParams.get('d') || sarajevoNow().date;
  const rows = (await env.DB.prepare("SELECT start_min FROM bookings WHERE date = ? AND status = 'confirmed' ORDER BY start_min").bind(date).all()).results || [];
  if (!rows.length) return Response.json({ ok: true, sent: 0, note: 'nema rezervacija' });

  const link = `${env.SITE_URL}/api/letci?d=${date}&t=${await makeToken(env, 'letci-' + date, 'letci')}`;
  const nice = date.split('-').reverse().join('.');
  await sendMail(env, { to: env.LETCI_TO, subject: `Letci za ${nice}: ${rows.length} ${rows.length === 1 ? 'gost' : 'gostiju'}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: 'Letci', tone: 'info', accent: C.mustard, title: 'Letci za danas.', lead: 'Rezervacije za danas su spremne za printanje.', rows: [['Datum', nice], ['Gostiju', String(rows.length)], ['Prvi termin', fmt(rows[0].start_min)]], buttons: [{ href: link, label: 'Otvori letke' }], note: 'Otvori link, pritisni Cmd+P ili Ctrl+P, izaberi A4 i dvostrano printanje. Svaki list ima dva letka. Izreži po isprekidanoj liniji.' }) });
  return Response.json({ ok: true, sent: 1, gostiju: rows.length });
}
