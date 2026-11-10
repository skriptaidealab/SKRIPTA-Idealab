// Shared booking rules. Values marked TODO are owner decisions or proposals.
// Open days, hours, discounts and the booking horizon can be edited on the occupancy dashboard (tables hours_weekly,
// hours_dates, discounts, settings). The constants below are the fallback when those tables are missing or empty.
export const OPEN = 9 * 60, CLOSE = 18 * 60 + 30, STEP = 30; // Mon-Fri 09:00 to 18:30
// Dates with shortened opening hours (minutes from midnight): [open, close].
export const SPECIAL_HOURS = {};
// Dates when booking is free of charge (opening days).
export const FREE_DATES = [];
export const isFree = (date) => FREE_DATES.includes(date);
// Frozen windows: no NEW bookings can touch these (minutes from midnight). Existing confirmed bookings stay;
// pending requests can still be confirmed. Remove an entry to reopen the window.
export const FROZEN = {};
// Saturdays after this date are closed for now (booking.js has the same constant). Remove to reopen.
export const SAT_CLOSED_AFTER = '2026-11-08';
// Saturdays: bookings may only fall between 10:00 and 15:00. Existing confirmed bookings outside this window stay valid.
// Bookings open up to this date; later dates show "uskoro" with an email form (booking.js has the same constant). Far in the future = all open.
export const BOOKING_UNTIL = '2099-12-31';
export const SAT_HOURS = [10 * 60, 15 * 60];
export const LEAD_MIN = 60;        // TODO proposal: earliest booking 1 hour ahead
export const MAX_DAYS = 5;          // furthest bookable date: 5 days ahead (rolling)
export const OPEN_UNTIL = '2026-11-14'; // until then everything up to this date stays open (Mon-Fri, Sat 7.11. only)
export const BUFFER_MIN = 30;      // TODO proposal: prep time around a whole-space booking
export const PRICES = {
  ind:    { 1: 7, 2: 12, 4: 20, 6: 26 },
  lounge: { 1: 5, 2: 8, 4: 13 }
};
export const NAMES = { ind: 'Focus zona', lounge: 'Lounge zona' };
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

export const ymd = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const dowOf = (date) => new Date(dayNum(date) * 86400000).getUTCDay(); // 0 = Sunday

/* ---------- schedule: open days, hours, discounts ---------- */

// The old hard-coded rules expressed as a schedule object. Used when the database tables are missing or empty.
export function legacySchedule() {
  const weekly = {};
  for (let i = 0; i < 7; i++) weekly[i] = { closed: i === 0, open: OPEN, close: CLOSE };
  weekly[6] = { closed: true, open: SAT_HOURS[0], close: SAT_HOURS[1] };
  const dates = {};
  for (const [d, [a, z]] of Object.entries(SPECIAL_HOURS)) dates[d] = { closed: false, open: a, close: z };
  for (let n = dayNum(sarajevoNow().date) - 7; n <= dayNum(SAT_CLOSED_AFTER); n++) {
    const d = ymd(n);
    if (!dates[d] && dowOf(d) === 6) dates[d] = { closed: false, open: SAT_HOURS[0], close: SAT_HOURS[1] };
  }
  const discounts = FREE_DATES.map((d, i) => ({ id: -1 - i, label: 'Open day', percent: 100, start: 0, end: 1440, dows: null, from: d, to: d, zone: null }));
  return { weekly, dates, discounts, maxDays: MAX_DAYS, openUntil: OPEN_UNTIL, legacy: true };
}

const toNum = (v) => (v === null || v === undefined || v === '' ? null : +v);

// Reads the schedule from D1. Never throws: if the tables are missing (migration not run yet) the old rules apply.
export async function loadSchedule(env) {
  const base = legacySchedule();
  try {
    const today = sarajevoNow().date;
    const [w, d, x, s] = await env.DB.batch([
      env.DB.prepare('SELECT dow, closed, open_min, close_min FROM hours_weekly'),
      env.DB.prepare('SELECT date, closed, open_min, close_min FROM hours_dates WHERE date >= ?').bind(today),
      env.DB.prepare('SELECT id, label, percent, start_min, end_min, dows, date_from, date_to, zone FROM discounts WHERE active = 1'),
      env.DB.prepare('SELECT key, value FROM settings')
    ]);
    if (!(w.results || []).length) return base; // tables exist but were never filled
    const weekly = { ...base.weekly };
    for (const r of w.results) weekly[r.dow] = { closed: !!r.closed, open: toNum(r.open_min), close: toNum(r.close_min) };
    const dates = {};
    for (const r of d.results || []) dates[r.date] = { closed: !!r.closed, open: toNum(r.open_min), close: toNum(r.close_min) };
    const discounts = (x.results || []).map((r) => ({
      id: r.id, label: r.label || '', percent: +r.percent, start: +r.start_min, end: +r.end_min,
      dows: r.dows ? String(r.dows).split(',').filter((v) => v !== '').map(Number) : null,
      from: r.date_from || null, to: r.date_to || null, zone: r.zone || null
    }));
    const set = Object.fromEntries((s.results || []).map((r) => [r.key, r.value]));
    const maxDays = Number.isInteger(+set.max_days) && +set.max_days >= 0 && set.max_days !== '' ? +set.max_days : MAX_DAYS;
    const openUntil = /^\d{4}-\d{2}-\d{2}$/.test(set.open_until || '') ? set.open_until : OPEN_UNTIL;
    return { weekly, dates, discounts, maxDays, openUntil, legacy: false };
  } catch (e) {
    console.error('loadSchedule fallback', e);
    return base;
  }
}

// [open, close] in minutes, or null when that date is closed.
export function hoursOf(sch, date) {
  const o = sch.dates[date];
  if (o) {
    if (o.closed) return null;
    if (o.open != null && o.close != null) return [o.open, o.close];
  }
  const w = sch.weekly[dowOf(date)];
  return !w || w.closed || w.open == null || w.close == null ? null : [w.open, w.close];
}
// Kept for older callers: hours with the old fallback rules.
export const hoursFor = (date) => hoursOf(legacySchedule(), date) || [OPEN, CLOSE];

// Discount for a booking that starts at `start` (minutes) and lasts `dur` hours. Only the part of the
// booking that falls inside a discount window gets the discount, so the result is a weighted average.
export function discountFor(sch, zone, date, start, dur) {
  const dow = dowOf(date);
  const ds = (sch.discounts || []).filter((x) => (!x.zone || x.zone === zone) && (!x.from || date >= x.from) && (!x.to || date <= x.to) && (!x.dows || x.dows.includes(dow)));
  let sum = 0, steps = 0, best = null;
  for (let t = start; t < start + dur * 60; t += STEP) {
    steps++;
    let m = 0, who = null;
    for (const x of ds) if (t >= x.start && t < x.end && x.percent > m) { m = x.percent; who = x; }
    sum += m;
    if (who && (!best || who.percent > best.percent)) best = who;
  }
  return { pct: steps ? sum / steps : 0, label: best ? best.label : '' };
}
// Summary of one date for the day picker: highest discount that day and whether the whole day is free.
export function dayDeals(sch, date, open, close) {
  const dow = dowOf(date);
  let deal = 0, free = false;
  for (const x of sch.discounts || []) {
    if ((x.from && date < x.from) || (x.to && date > x.to) || (x.dows && !x.dows.includes(dow))) continue;
    if (x.start >= close || x.end <= open) continue;
    deal = Math.max(deal, x.percent);
    if (x.percent >= 100 && !x.zone && x.start <= open && x.end >= close) free = true;
  }
  return { deal, free };
}

// Total for a booking. `pct` = promo code percent. With `sch` and `start`, the schedule discount applies too and the higher of the two wins.
// Without `sch` the old rule (free dates) applies, so older callers keep working. Rounded to 0,5 KM.
export const total = (zone, dur, persons, date, pct = 0, start = null, sch = null) => {
  const base = PRICES[zone][dur] * persons;
  if (!sch) return isFree(date) ? 0 : roundHalf(base * (1 - pct / 100));
  const sp = start == null ? 0 : discountFor(sch, zone, date, start, dur).pct;
  return Math.max(0, roundHalf(base * (1 - Math.max(pct, sp) / 100)));
};

export function checkQuery(q, sch = legacySchedule()) {
  if (!['ind', 'lounge'].includes(q.zone)) return 'Nepoznata zona.';
  if (PRICES[q.zone][q.dur] === undefined) return q.zone === 'lounge' && q.dur === 6 ? 'Lounge zona se rezerviše do 4 sata.' : 'Nepoznato trajanje.';
  const maxP = MAX_PERSONS, minP = 1;
  if (!Number.isInteger(q.persons) || q.persons < minP || q.persons > maxP) return 'Neispravan broj osoba.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return 'Neispravan datum.';
  const d = dayNum(q.date), n = dayNum(sarajevoNow().date);
  if (q.date > BOOKING_UNTIL) return 'Rezervacije za taj datum još nisu otvorene.';
  if (!hoursOf(sch, q.date)) return dowOf(q.date) === 0 ? 'Nedjeljom ne radimo.' : 'Taj dan ne radimo.';
  if (d < n || d > Math.max(n + sch.maxDays, dayNum(sch.openUntil))) return 'Datum je van raspona.';
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

export function freeStarts(q, bookings, blocks, sch = legacySchedule()) {
  const out = [], now = sarajevoNow(), h = hoursOf(sch, q.date);
  if (!h) return out;
  const [open, close] = h;
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
