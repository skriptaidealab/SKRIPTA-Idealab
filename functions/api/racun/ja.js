// Podaci prijavljenog korisnika: profil, sve njegove rezervacije (prošle i buduće) i FLEXI paketi.
// Svaki upit je vezan za user_id iz sesije: tuđe rezervacije se ne mogu vidjeti ni pogoditi.
import { json } from '../../_lib/util.js';
import { getUser } from '../../_lib/auth.js';
import { sarajevoNow, loadSchedule, total, PRICES } from '../../_lib/rules.js';
import { view, flexiOf } from '../../_lib/portal.js';

export async function onRequestGet({ request, env }) {
  const user = await getUser(env, request);
  if (!user) return json({ ok: true, user: null });
  const now = sarajevoNow(), sch = await loadSchedule(env);
  const { results } = await env.DB.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY date DESC, start_min DESC LIMIT 300').bind(user.id).all();
  const bookings = (results || []).map((b) => {
    const v = view(b, now);
    if (v.mozeProduziti && PRICES[b.zone]?.[1]) v.produziCijena = total(b.zone, 1, b.persons, b.date, 0, b.start_min + b.dur_h * 60, sch);
    return v;
  });
  const ids = (await env.DB.prepare('SELECT provider FROM identities WHERE user_id = ?').bind(user.id).all()).results || [];
  return json({ ok: true, user: { email: user.email, name: user.name || '', phone: user.phone || '', created: user.created_at, nacini: ['email', ...ids.map((i) => i.provider)] }, bookings, flexi: await flexiOf(env, user) });
}
