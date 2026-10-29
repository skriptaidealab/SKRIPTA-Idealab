// Shared booking rules. Values marked TODO are owner decisions or proposals.
export const OPEN = 8 * 60, CLOSE = 21 * 60, STEP = 30;
export const LEAD_MIN = 60;        // TODO proposal: earliest booking 1 hour ahead
export const MAX_DAYS = 60;
export const BUFFER_MIN = 30;      // TODO proposal: prep time around a whole-space booking
export const PRICES = {
  ind:    { 1: 7, 2: 12, 4: 20, 8: 28 },
  lounge: { 1: 5, 2: 8,  4: 13, 8: 18 }
};
export const NAMES = { ind: 'Individualna zona', lounge: 'Lounge zona' };
// TODO owner: confirm real numbers. lounge = 0 keeps lounge unavailable until set.
export const CAPACITY = { ind: 10, lounge: 0, cafeTables: [3, 2] };

export const fmt = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const total = (zone, dur, persons) => PRICES[zone][dur] * persons;

export function sarajevoNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sarajevo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, min: +g('hour') * 60 + +g('minute') };
}
const dayNum = (d) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);

export function checkQuery(q) {
  if (!['ind', 'lounge'].includes(q.zone)) return 'Nepoznata zona.';
  if (![1, 2, 4, 8].includes(q.dur)) return 'Nepoznato trajanje.';
  const maxP = q.zone === 'cafe' ? 3 : 1, minP = q.zone === 'cafe' ? 2 : 1;
  if (!Number.isInteger(q.persons) || q.persons < minP || q.persons > maxP) return 'Neispravan broj osoba.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return 'Neispravan datum.';
  const d = dayNum(q.date), n = dayNum(sarajevoNow().date);
  if (new Date(d * 86400000).getUTCDay() === 0) return 'Nedjeljom ne radimo.';
  if (d < n || d > n + MAX_DAYS) return 'Datum je van raspona.';
  if (q.zone === 'lounge' && !CAPACITY.lounge) return 'Lounge zona još nije dostupna za online rezervaciju.';
  return null;
}

// bookings: confirmed bookings for that date. blocks: whole-space blocks for that date.
export function tableFor(q, start, bookings) {
  const steps = [];
  for (let t = start; t < start + q.dur * 60; t += STEP) steps.push(t);
  const used = (t, pred) => bookings.filter((b) => pred(b) && b.start_min <= t && t < b.start_min + b.dur_h * 60).reduce((s, b) => s + b.persons, 0);
  if (q.zone === 'cafe') {
    for (let i = 0; i < CAPACITY.cafeTables.length; i++) {
      const cap = CAPACITY.cafeTables[i];
      if (q.persons <= cap && steps.every((t) => used(t, (b) => b.zone === 'cafe' && b.table_idx === i) + q.persons <= cap)) return i;
    }
    return -1;
  }
  const cap = CAPACITY[q.zone];
  return steps.every((t) => used(t, (b) => b.zone === q.zone) + q.persons <= cap) ? 0 : -1;
}

export function freeStarts(q, bookings, blocks) {
  const out = [], now = sarajevoNow();
  for (let s = OPEN; s + q.dur * 60 <= CLOSE; s += STEP) {
    const e = s + q.dur * 60;
    if (q.date === now.date && s < now.min + LEAD_MIN) continue;
    if (blocks.some((b) => s < b.end_min + BUFFER_MIN && e > b.start_min - BUFFER_MIN)) continue;
    if (tableFor(q, s, bookings) < 0) continue;
    out.push(s);
  }
  return out;
}

export async function loadDay(env, date, listBlocks) {
  const b = await env.DB.prepare("SELECT * FROM bookings WHERE date = ? AND status = 'confirmed'").bind(date).all();
  const k = await env.DB.prepare('SELECT * FROM blocks WHERE date = ?').bind(date).all();
  const cal = listBlocks ? await listBlocks(env, date) : []; // throws if the calendar cannot be read: fail closed
  return { bookings: b.results || [], blocks: [...(k.results || []), ...cal] };
}
