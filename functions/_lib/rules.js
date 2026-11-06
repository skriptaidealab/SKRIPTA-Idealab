// Shared booking rules. Values marked TODO are owner decisions or proposals.
export const OPEN = 9 * 60, CLOSE = 18 * 60 + 30, STEP = 30; // Mon-Fri 09:00 to 18:30
// Dates with shortened opening hours (minutes from midnight): [open, close].
export const SPECIAL_HOURS = {
  '2026-11-04': [10 * 60, 21 * 60],
  '2026-11-05': [10 * 60, 18 * 60 + 30], // closed after 18:30 (new bookings only)
  '2026-11-06': [10 * 60, 18 * 60 + 30]
};
// Dates when booking is free of charge (opening days).
export const FREE_DATES = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
export const isFree = (date) => FREE_DATES.includes(date);
// Frozen windows: no NEW bookings can touch these (minutes from midnight). Existing confirmed bookings stay;
// pending requests can still be confirmed. Remove an entry to reopen the window.
export const FROZEN = { '2026-11-04': [[11 * 60, 14 * 60]] };
// Saturdays after this date are closed for now (booking.js has the same constant). Remove to reopen.
export const SAT_CLOSED_AFTER = '2026-11-08';
// Saturdays: bookings may only fall between 10:00 and 15:00. Existing confirmed bookings outside this window stay valid.
// Bookings open up to this date; later dates show "uskoro" with an email form (booking.js has the same constant). Far in the future = all open.
export const BOOKING_UNTIL = '2099-12-31';
export const SAT_HOURS = [10 * 60, 15 * 60];
export const hoursFor = (date) => SPECIAL_HOURS[date] || (new Date(dayNum(date) * 86400000).getUTCDay() === 6 ? SAT_HOURS : [OPEN, CLOSE]);
export const LEAD_MIN = 60;        // TODO proposal: earliest booking 1 hour ahead
export const MAX_DAYS = 5;          // furthest bookable date: 5 days ahead (rolling)
export const OPEN_UNTIL = '2026-11-14'; // until then everything up to this date stays open (Mon-Fri, Sat 7.11. only)
export const BUFFER_MIN = 30;      // TODO proposal: prep time around a whole-space booking
export const PRICES = {
  ind:    { 1: 7, 2: 12, 4: 20, 6: 26 },
  lounge: { 1: 6, 2: 10, 4: 15 }
};
export const NAMES = { ind: 'Quiet zona', lounge: 'Lounge zona' };
export const MAX_PERSONS = 4; // most people in one booking
export const zoneLabel = (b) => NAMES[b.zone] + (b.persons > 1 ? `, ${b.persons} osobe` : '');
// Seats per zone (confirmed by owner). A slot is free while confirmed bookings overlapping it use fewer seats than this.
export const CAPACITY = { ind: 15, lounge: 9 };

export const fmt = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
// Promo codes. Key = code in CAPITAL letters. Fields: pct (percent off, 1-100), from / until (first and last booking DATE it applies to, optional),
// maxDur (longest booking in hours, optional), perGuest (most active bookings per guest, matched by e-mail or phone, optional), zones (['ind'] or ['lounge'], optional), max (most bookings that may use it, optional), note (internal).
export const PROMOS = {
  OPENDAYS: { pct: 50, from: '2026-11-09', until: '2026-11-13', maxDur: 4, perGuest: 1, note: 'Open days: 50% na rezervacije do 4 h, termini 9. do 13.11., jedna rezervacija po gostu.' },
  // 'PRIMJER10': { pct: 10, until: '2026-12-31', zones: ['ind'], max: 50, note: 'primjer' },
};
// Same guest = same e-mail (Gmail dots and +tags ignored) or same phone (last 8 digits).
const mailKey = (e) => { let [u, d] = String(e || '').toLowerCase().trim().split('@'); u = (u || '').split('+')[0]; if (d === 'gmail.com' || d === 'googlemail.com') { u = u.replace(/\./g, ''); d = 'gmail.com'; } return `${u}@${d}`; };
const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-8);
const dm = (d) => `${+d.slice(8)}.${+d.slice(5, 7)}.`;
export const roundHalf = (n) => Math.round(n * 2) / 2; // prices are rounded to 0,5 KM
export const kmNum = (n) => String(n).replace('.', ',');
export const total = (zone, dur, persons, date, pct = 0) => (isFree(date) ? 0 : roundHalf(PRICES[zone][dur] * persons * (1 - pct / 100)));
export const priceText = (sum) => (sum === 0 ? 'Besplatno. Jedva čekamo da dođeš!' : `${kmNum(sum)} KM, plaćanje po dolasku`);
// Checks a promo code for a booking query. Returns { ok, code, pct, base, total } or { ok: false, error }.
export async function applyPromo(env, raw, q) {
  const code = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  const p = PROMOS[code];
  const bad = { ok: false, error: 'Promo kod nije ispravan.' };
  if (!code || !Object.prototype.hasOwnProperty.call(PROMOS, code)) return bad;
  if (isFree(q.date)) return { ok: false, error: 'Tog dana je rezervacija besplatna, promo kod nije potreban.' };
  if ((p.from && q.date < p.from) || (p.until && q.date > p.until)) return { ok: false, error: p.from && p.until ? `Promo kod važi za rezervacije od ${dm(p.from)} do ${dm(p.until)}.` : 'Promo kod ne važi za taj datum.' };
  if (p.maxDur && q.dur > p.maxDur) return { ok: false, error: `Promo kod važi za rezervacije do ${p.maxDur} sata.` };
  if (p.zones && !p.zones.includes(q.zone)) return { ok: false, error: `Promo kod važi samo za ${p.zones.map((z) => NAMES[z]).join(' i ')}.` };
  if (p.max) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE promo = ? AND status IN ('pending','confirmed')").bind(code).first();
    if ((n?.n || 0) >= p.max) return { ok: false, error: 'Promo kod je iskorišten.' };
  }
  if (p.perGuest && (q.email || q.phone)) {
    const { results } = await env.DB.prepare("SELECT email, phone FROM bookings WHERE promo = ? AND status IN ('pending','confirmed')").bind(code).all();
    const mk = q.email ? mailKey(q.email) : null, pk = q.phone && phoneKey(q.phone).length >= 8 ? phoneKey(q.phone) : null;
    const used = (results || []).filter((r) => (mk && mailKey(r.email) === mk) || (pk && phoneKey(r.phone) === pk)).length;
    if (used >= p.perGuest) return { ok: false, error: 'Promo kod važi za jednu rezervaciju po gostu, a već je iskorišten s tim emailom ili telefonom.' };
  }
  return { ok: true, code, pct: p.pct, base: total(q.zone, q.dur, q.persons, q.date), total: total(q.zone, q.dur, q.persons, q.date, p.pct) };
}
// Discount percent of a stored booking (code lookup, else derived from the stored price), so rescheduling keeps it.
export function promoPctOf(b) {
  if (!b.promo) return 0;
  if (PROMOS[b.promo]) return PROMOS[b.promo].pct;
  const base = PRICES[b.zone]?.[b.dur_h] * b.persons;
  return base && b.total < base ? Math.round((1 - b.total / base) * 100) : 0;
}
export const promoLine = (b) => (b.promo ? `${b.promo}, ${promoPctOf(b)}% popusta` : '');

export function sarajevoNow(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sarajevo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, min: +g('hour') * 60 + +g('minute') };
}
export const dayNum = (d) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000);

export function checkQuery(q) {
  if (!['ind', 'lounge'].includes(q.zone)) return 'Nepoznata zona.';
  if (PRICES[q.zone][q.dur] === undefined) return q.zone === 'lounge' && q.dur === 6 ? 'Lounge zona se rezerviše do 4 sata.' : 'Nepoznato trajanje.';
  const maxP = MAX_PERSONS, minP = 1;
  if (!Number.isInteger(q.persons) || q.persons < minP || q.persons > maxP) return 'Neispravan broj osoba.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return 'Neispravan datum.';
  const d = dayNum(q.date), n = dayNum(sarajevoNow().date);
  if (new Date(d * 86400000).getUTCDay() === 0) return 'Nedjeljom ne radimo.';
  if (q.date > BOOKING_UNTIL) return 'Rezervacije za taj datum još nisu otvorene.';
  if (new Date(d * 86400000).getUTCDay() === 6 && q.date > SAT_CLOSED_AFTER) return 'Subotom zasad ne radimo.';
  if (d < n || d > Math.max(n + MAX_DAYS, dayNum(OPEN_UNTIL))) return 'Datum je van raspona.';
  if (q.zone === 'lounge' && !CAPACITY.lounge) return 'Lounge zona još nije dostupna za online rezervaciju.';
  return null;
}

// bookings: confirmed bookings for that date. blocks: whole-space blocks for that date.
export function tableFor(q, start, bookings) {
  const steps = [];
  for (let t = start; t < start + q.dur * 60; t += STEP) steps.push(t);
  const used = (t, pred) => bookings.filter((b) => pred(b) && b.start_min <= t && t < b.start_min + b.dur_h * 60).reduce((s, b) => s + b.persons, 0);
  const cap = CAPACITY[q.zone];
  return steps.every((t) => used(t, (b) => b.zone === q.zone) + q.persons <= cap) ? 0 : -1;
}

export function freeStarts(q, bookings, blocks) {
  const out = [], now = sarajevoNow(), [open, close] = hoursFor(q.date);
  for (let s = open; s + q.dur * 60 <= close; s += STEP) {
    const e = s + q.dur * 60;
    if (q.date === now.date && s < now.min + LEAD_MIN) continue;
    if ((FROZEN[q.date] || []).some(([a, z]) => s < z && e > a)) continue;
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
