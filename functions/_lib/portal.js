// Prikaz rezervacije u portalu "Moj račun". Namjerno bez telefona i bez ičega što nije potrebno gostu.
import { NAMES, fmt } from './rules.js';

export function view(b, now, extra = {}) {
  const end = b.start_min + b.dur_h * 60;
  const active = b.status === 'pending' || b.status === 'confirmed';
  const started = b.date < now.date || (b.date === now.date && b.start_min <= now.min);
  const ended = b.date < now.date || (b.date === now.date && end <= now.min);
  const faza = !active || ended || (b.status === 'pending' && started) ? 'prosla' : started ? 'trenutna' : 'nadolazeca';
  return {
    id: b.id, zona: b.zone, zonaNaziv: NAMES[b.zone] || b.zone, osoba: b.persons, datum: b.date, od: fmt(b.start_min), do: fmt(end), trajanje: b.dur_h,
    iznos: b.total, status: b.status, faza, flexi: !!b.flexi_paket_id, placeno: !!b.paid_at, kreirano: b.created_at, dosao: !!b.checked_in_at,
    mozeOtkazati: active && !b.checked_in_at && !started,
    mozeIzmijeniti: active && !b.checked_in_at && !started,
    mozeProduziti: b.status === 'confirmed' && !!b.checked_in_at && !b.left_at && !b.no_show && b.date === now.date && !ended,
    ...extra
  };
}

export async function flexiOf(env, user) {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM flexi_paketi WHERE user_id = ?1 OR lower(email) = ?2 ORDER BY created_at DESC').bind(user.id, user.email).all();
    const out = [];
    for (const p of results || []) {
      const used = (await env.DB.prepare('SELECT COUNT(*) AS n FROM flexi_posjete WHERE paket_id = ?').bind(p.id).first()).n;
      const held = (await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE flexi_paket_id = ? AND status IN ('pending','confirmed') AND checked_in_at IS NULL").bind(p.id).first()).n;
      out.push({ id: p.id, sati: p.sati, dolazaka: p.dolazaka, iskoristeno: used, rezervisano: held, preostalo: Math.max(0, p.dolazaka - used), slobodno: Math.max(0, p.dolazaka - used - held), istice: p.expires_at || '', placeno: !!p.placeno_at });
    }
    return out;
  } catch (e) { console.error('flexiOf', e); return []; }
}
