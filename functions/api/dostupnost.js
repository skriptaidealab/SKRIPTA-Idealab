import { checkQuery, freeStarts, loadDay, fmt } from '../_lib/rules.js';
import { json } from '../_lib/util.js';
import { listBlocks } from '../_lib/graph.js';

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const q = { zone: u.searchParams.get('zona'), dur: +u.searchParams.get('trajanje'), persons: +(u.searchParams.get('osobe') || 1), date: u.searchParams.get('datum') || '' };
  const err = checkQuery(q);
  if (err) return json({ ok: false, error: err, starts: [] });
  let day;
  try { day = await loadDay(env, q.date, listBlocks); } catch (e) { console.error(e); return json({ ok: false, error: 'Termini trenutno nisu dostupni. Pišite nam na info@skripta.ba.', starts: [], ...(env.TEST_MODE ? { debug: String(e && e.message || e).slice(0, 300) } : {}) }, 503); }
  const { bookings, blocks } = day;
  const starts = freeStarts(q, bookings, blocks);
  return json({ ok: true, starts, labels: starts.map(fmt), wholeSpace: blocks.length > 0 });
}
