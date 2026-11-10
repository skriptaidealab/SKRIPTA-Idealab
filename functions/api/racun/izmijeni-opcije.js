// Slobodni počeci za izmjenu vlastite rezervacije (za odabrani datum, trajanje, zonu i broj osoba). Rezervacija koja se mijenja ne računa se sama protiv sebe.
import { json, clean } from '../../_lib/util.js';
import { guardPost, readJson, getUser } from '../../_lib/auth.js';
import { fmt, hoursOf } from '../../_lib/rules.js';
import { aktivna, pocela, upit, slobodno, cijena, sarajevoNow } from '../../_lib/izmjena.js';

export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  const user = await getUser(env, request); if (!user) return json({ ok: false, error: 'Prijavi se.' }, 401);
  const body = await readJson(request); if (!body) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  const b = await env.DB.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').bind(clean(body.id, 60), user.id).first();
  if (!b || !aktivna(b)) return json({ ok: false, error: 'Rezervacija nije pronađena ili nije aktivna.' }, 404);
  if (pocela(b, sarajevoNow())) return json({ ok: false, error: 'Termin je već počeo. Javi nam se na info@skripta.ba.' }, 400);
  const { q, flexi } = upit(b, body);
  const r = await slobodno(env, b, q);
  if (!r.ok) return json({ ok: false, error: r.error, starts: [] }, r.status);
  const [open, close] = hoursOf(r.sch, q.date) || [0, 0];
  return json({ ok: true, flexi, open: fmt(open), close: fmt(close), starts: r.starts.map((s) => ({ od: s, oznaka: fmt(s), do: fmt(s + q.dur * 60), cijena: cijena(b, q, s, r.sch) })) });
}
