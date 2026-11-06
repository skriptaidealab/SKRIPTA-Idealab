import { checkQuery, freeStarts, loadDay, loadSchedule, hoursOf, discountFor, fmt } from '../_lib/rules.js';
import { json } from '../_lib/util.js';
import { listBlocks } from '../_lib/graph.js';

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const q = { zone: u.searchParams.get('zona'), dur: +u.searchParams.get('trajanje'), persons: +(u.searchParams.get('osobe') || 1), date: u.searchParams.get('datum') || '' };
  const sch = await loadSchedule(env);
  const err = checkQuery(q, sch);
  if (err) return json({ ok: false, error: err, starts: [] });
  let day;
  try { day = await loadDay(env, q.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Termini trenutno nisu dostupni. Pišite nam na info@skripta.ba.', starts: [], ...(env.TEST_MODE ? { debug: String(e && e.message || e).slice(0, 300) } : {}) }, 503); }
  const { bookings, blocks } = day;
  const starts = freeStarts(q, bookings, blocks, sch);
  const [open, close] = hoursOf(sch, q.date);
  // Discount per start time (whole percent), only for starts that actually get one.
  const popusti = {};
  for (const s of starts) { const p = Math.round(discountFor(sch, q.zone, q.date, s, q.dur).pct); if (p > 0) popusti[s] = p; }
  return json({ ok: true, starts, labels: starts.map(fmt), popusti, open, close, wholeSpace: blocks.length > 0 });
}
