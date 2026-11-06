// GET /api/raspored: which dates can be booked, with opening hours and discount hints. Public, no personal data.
import { loadSchedule, hoursOf, dayDeals, sarajevoNow, dayNum, ymd } from '../_lib/rules.js';
import { json } from '../_lib/util.js';

export async function onRequestGet({ env }) {
  const sch = await loadSchedule(env);
  const from = sarajevoNow().date, n = dayNum(from);
  const last = Math.min(Math.max(n + sch.maxDays, dayNum(sch.openUntil)), n + 120);
  const days = {};
  for (let k = n; k <= last; k++) {
    const date = ymd(k), h = hoursOf(sch, date);
    days[date] = h ? { closed: false, open: h[0], close: h[1], ...dayDeals(sch, date, h[0], h[1]) } : { closed: true };
  }
  return json({ ok: true, from, to: ymd(last), days });
}
