// Izmjena vlastite rezervacije iz računa (datum, početak, trajanje, zona, broj osoba). Sve podliježe dostupnosti.
// Koriste je prikaz slobodnih termina i stvarna izmjena, da se pravila ne razilaze.
import { checkQuery, freeStarts, loadDay, loadSchedule, total, PROMOS, sarajevoNow } from './rules.js';
import { listBlocks } from './graph.js';
import { clean } from './util.js';

export const aktivna = (b) => ['pending', 'confirmed'].includes(b.status);
export function pocela(b, now) { return !!b.checked_in_at || b.date < now.date || (b.date === now.date && b.start_min <= now.min); }

// FLEXI rezervacija: zona, trajanje i broj osoba su određeni paketom, mijenjaju se samo datum i početak.
export function upit(b, body) {
  const flexi = !!b.flexi_paket_id;
  return {
    flexi,
    q: {
      zone: flexi ? b.zone : clean(body.zona, 10),
      dur: flexi ? b.dur_h : +body.trajanje,
      persons: flexi ? b.persons : (+body.osobe || b.persons),
      date: clean(body.datum, 10)
    }
  };
}

// Popust iz promo koda ostaje samo ako i dalje važi za novi termin.
export function pctZa(b, q) {
  const p = b.promo && PROMOS[b.promo];
  if (!p) return { pct: 0, promo: null };
  const ok = !((p.from && q.date < p.from) || (p.until && q.date > p.until) || (p.maxDur && q.dur > p.maxDur) || (p.zones && !p.zones.includes(q.zone)));
  return ok ? { pct: p.pct, promo: b.promo } : { pct: 0, promo: null };
}

// Učita sve što treba za provjeru: radno vrijeme, zauzeće tog dana bez ove rezervacije i slobodne početke.
export async function slobodno(env, b, q) {
  const sch = await loadSchedule(env);
  const err = checkQuery(q, sch);
  if (err) return { ok: false, status: 400, error: err };
  let day;
  try { day = await loadDay(env, q.date, listBlocks); } catch (e) { console.error(e); return { ok: false, status: 503, error: 'Termini trenutno nisu dostupni. Pokušaj ponovo.' }; }
  const others = day.bookings.filter((x) => x.id !== b.id);
  return { ok: true, sch, starts: freeStarts(q, others, day.blocks, sch) };
}
export const cijena = (b, q, start, sch) => (b.flexi_paket_id ? 0 : total(q.zone, q.dur, q.persons, q.date, pctZa(b, q).pct, start, sch));
export { sarajevoNow };
