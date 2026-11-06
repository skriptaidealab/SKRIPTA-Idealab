// GET /api/cijena?zona=&trajanje=&osobe=&datum=&pocetak=: price for one chosen start time, discount included.
// The same calculation runs again on the server when the request is sent, so this is only for display.
import { checkQuery, loadSchedule, discountFor, roundHalf, PRICES } from '../_lib/rules.js';
import { json } from '../_lib/util.js';

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const q = { zone: u.searchParams.get('zona'), dur: +u.searchParams.get('trajanje'), persons: +(u.searchParams.get('osobe') || 1), date: u.searchParams.get('datum') || '' };
  const start = +u.searchParams.get('pocetak');
  const sch = await loadSchedule(env);
  const err = checkQuery(q, sch);
  if (err) return json({ ok: false, error: err });
  if (!Number.isInteger(start) || start < 0 || start >= 1440) return json({ ok: false, error: 'Neispravno vrijeme.' });
  const base = PRICES[q.zone][q.dur] * q.persons, d = discountFor(sch, q.zone, q.date, start, q.dur);
  return json({ ok: true, base, pct: d.pct, label: d.label, total: Math.max(0, roundHalf(base * (1 - d.pct / 100))) });
}
