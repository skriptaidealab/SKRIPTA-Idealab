// Otkazivanje vlastite rezervacije iz portala (prije početka termina). Isto kao link iz emaila.
import { json, clean, esc } from '../../_lib/util.js';
import { guardPost, readJson, getUser, audit } from '../../_lib/auth.js';
import { NAMES, fmt, sarajevoNow, zoneLabel } from '../../_lib/rules.js';
import { sendMail, deleteEvent } from '../../_lib/graph.js';
import { mail, C } from '../../_lib/mail.js';

export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  const user = await getUser(env, request); if (!user) return json({ ok: false, error: 'Prijavi se.' }, 401);
  const body = await readJson(request); if (!body) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  const b = await env.DB.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').bind(clean(body.id, 60), user.id).first();
  if (!b) return json({ ok: false, error: 'Rezervacija nije pronađena.' }, 404);
  if (!['confirmed', 'pending'].includes(b.status)) return json({ ok: false, error: 'Rezervacija nije aktivna.' }, 409);
  const now = sarajevoNow();
  if (b.checked_in_at || b.date < now.date || (b.date === now.date && b.start_min <= now.min)) return json({ ok: false, error: 'Termin je već počeo. Javi nam se na info@skripta.ba.' }, 400);
  const r = await env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status IN ('pending','confirmed')").bind(b.id, user.id).run();
  if (!r.meta || !r.meta.changes) return json({ ok: false, error: 'Rezervacija nije aktivna.' }, 409);
  if (b.event_id && b.event_id !== 'walkin') { try { await deleteEvent(env, b.event_id); } catch (e) { console.error(e); } }
  await audit(env, user.id, 'rezervacija_otkazana', b.id);
  const when = `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;
  try {
    await sendMail(env, { to: env.MAILBOX, subject: `Otkazano: ${NAMES[b.zone]}, ${when}`, html: mail({ brand: 'SKRIPTA Coffice · interno', chip: 'Otkazano', tone: 'no', accent: C.rose, title: 'Gost je otkazao iz računa.', rows: [['Zona', zoneLabel(b)], ['Termin', when], ['Ime', b.name], ['Email', b.email]] }) });
  } catch (e) { console.error(e); }
  return json({ ok: true });
}
