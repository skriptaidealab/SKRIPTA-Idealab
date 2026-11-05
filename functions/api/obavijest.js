// "Obavijesti me": a visitor leaves an email to hear when bookings open for dates that are not bookable yet.
import { json, esc, isEmail, clean } from '../_lib/util.js';
import { sendMail } from '../_lib/graph.js';

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'Neispravan zahtjev.' }, 400); }
  if (b.web) return json({ ok: true }); // honeypot
  const email = clean(b.email, 160).toLowerCase();
  if (!isEmail(email)) return json({ ok: false, error: 'Upiši ispravan email.' }, 400);
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, created_at TEXT NOT NULL, note TEXT)').run();
    await env.DB.prepare('INSERT OR IGNORE INTO waitlist (email, created_at, note) VALUES (?,?,?)').bind(email, new Date().toISOString(), clean(b.datum, 10) || null).run();
  } catch (e) { console.error(e); return json({ ok: false, error: 'Spremanje nije uspjelo. Piši nam na info@skripta.ba.' }, 500); }
  try {
    await sendMail(env, { to: env.MAILBOX, replyTo: email, subject: 'Lista čekanja: ' + email, html: `<p>Nova adresa za obavijest o otvaranju rezervacija:</p><p><b>${esc(email)}</b></p><p>Spremljeno u tabelu <code>waitlist</code>.</p>` });
  } catch (e) { console.error(e); } // saving is what matters
  return json({ ok: true });
}
