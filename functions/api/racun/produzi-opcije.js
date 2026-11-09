// Koliko sati gost može produžiti trenutni termin (1, 2, 4, 6): za svaku opciju cijena i je li slobodno.
import { json, clean } from '../../_lib/util.js';
import { guardPost, readJson, getUser, rateLimit } from '../../_lib/auth.js';
import { fmt, sarajevoNow, loadDay, loadSchedule } from '../../_lib/rules.js';
import { listBlocks } from '../../_lib/graph.js';
import { OPCIJE, ocijeni } from '../../_lib/produzenje.js';

export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  const user = await getUser(env, request); if (!user) return json({ ok: false, error: 'Prijavi se.' }, 401);
  if (!(await rateLimit(env, 'produzi-opcije:' + user.id, 60, 3600))) return json({ ok: false, error: 'Previše pokušaja.' }, 429);
  const body = await readJson(request); if (!body) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  const b = await env.DB.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').bind(clean(body.id, 60), user.id).first();
  if (!b || b.status !== 'confirmed') return json({ ok: false, error: 'Rezervacija nije pronađena.' }, 404);
  const now = sarajevoNow(), oldEnd = b.start_min + b.dur_h * 60;
  if (!b.checked_in_at || b.left_at || b.no_show) return json({ ok: false, error: 'Produženje je moguće kad te osoblje označi kao stigao/la.' }, 400);
  if (b.date !== now.date || oldEnd <= now.min) return json({ ok: false, error: 'Moguće je produžiti samo termin koji je u toku.' }, 400);
  const sch = await loadSchedule(env);
  let day;
  try { day = await loadDay(env, b.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Termini trenutno nisu dostupni. Javi se osoblju.' }, 503); }
  const opcije = OPCIJE.map((sati) => {
    const o = ocijeni(b, sati, sch, day);
    return o.ok ? { sati, ok: true, cijena: o.extra, do: fmt(o.newEnd) } : { sati, ok: false, razlog: o.error };
  }).filter((o) => o.ok || !/ovu zonu/.test(o.razlog)); // opcije koje zona uopće nema (npr. Lounge 6 h) se ne prikazuju
  return json({ ok: true, kraj: fmt(oldEnd), opcije });
}
