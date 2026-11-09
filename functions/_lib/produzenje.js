// Provjera produženja termina: koristi je i stvarno produženje i prikaz opcija (1, 2, 4, 6 sati) u računu.
import { PRICES, fmt, hoursOf, tableFor, total, BUFFER_MIN } from './rules.js';

export const OPCIJE = [1, 2, 4, 6];

// b: rezervacija, add: sati, sch: radno vrijeme, day: { bookings, blocks } za taj datum.
export function ocijeni(b, add, sch, day, zona = b.zone) {
  const oldEnd = b.start_min + b.dur_h * 60, newEnd = oldEnd + add * 60;
  if (!['ind', 'lounge'].includes(zona) || !PRICES[zona] || PRICES[zona][add] === undefined) return { ok: false, status: 400, error: 'Produženje za ovu zonu nije moguće.' };
  const hrs = hoursOf(sch, b.date);
  if (!hrs || newEnd > hrs[1]) return { ok: false, status: 409, error: `Prostor se zatvara u ${fmt(hrs ? hrs[1] : 0)}.` };
  const others = day.bookings.filter((x) => x.id !== b.id);
  if (tableFor({ zone: zona, dur: add, persons: b.persons }, oldEnd, others) < 0) return { ok: false, status: 409, conflict: true, error: 'Nema slobodnih mjesta u sljedećem terminu. Javi se osoblju.' };
  if (day.blocks.some((x) => oldEnd < x.end_min + BUFFER_MIN && newEnd > x.start_min - BUFFER_MIN)) return { ok: false, status: 409, conflict: true, error: 'Sljedeći termin je zauzet (događaj ili najam).' };
  return { ok: true, oldEnd, newEnd, zona, extra: total(zona, add, b.persons, b.date, 0, oldEnd, sch) };
}
