// Refer a friend. Tko preporuči dobija 1 sat besplatno na idućem dolasku (kad prijatelj stvarno dođe),
// preporučeni gost dobija 30% na drugu rezervaciju (kad već ima prvu). Evidenciju vodi osoblje na nadzornoj ploči.
// Tabela se pravi sama; ista definicija je u schema.sql i migrations/2026-11-16-preporuke.sql.
export const PRIJATELJ_PCT = 30;
export const ensurePreporuke = (env) => env.DB.prepare(
  'CREATE TABLE IF NOT EXISTS preporuke (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, referrer_ime TEXT NOT NULL, referrer_email TEXT NOT NULL, friend_ime TEXT NOT NULL, friend_email TEXT NOT NULL, friend_telefon TEXT, napomena TEXT, referrer_used_at TEXT, referrer_booking_id TEXT, friend_used_at TEXT, friend_booking_id TEXT)'
).run();

// Nagrada je iskorištena samo dok rezervacija na kojoj je iskorištena nije otkazana (otkazivanjem se nagrada vraća).
const USED_REF = "(p.referrer_used_at IS NOT NULL AND (p.referrer_booking_id IS NULL OR rb.status IN ('pending','confirmed')))";
const USED_FR = "(p.friend_used_at IS NOT NULL AND (p.friend_booking_id IS NULL OR fb.status IN ('pending','confirmed')))";
const JOINS = 'FROM preporuke p LEFT JOIN bookings rb ON rb.id = p.referrer_booking_id LEFT JOIN bookings fb ON fb.id = p.friend_booking_id';

// Koje nagrade gost s tim e-mailom sada može iskoristiti.
export async function dostupne(env, email) {
  const e = String(email || '').trim().toLowerCase();
  const out = { friend: null, referrer: [] };
  if (!e) return out;
  try { await ensurePreporuke(env); } catch (x) { console.error(x); return out; }
  const fr = (await env.DB.prepare(`SELECT p.* ${JOINS} WHERE lower(p.friend_email) = ?1 AND NOT ${USED_FR} ORDER BY p.id`).bind(e).all()).results || [];
  if (fr.length) {
    const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE lower(email) = ?1 AND status = 'confirmed'").bind(e).first())?.n || 0;
    if (n >= 1) out.friend = fr[0]; // prva rezervacija već postoji, ova je druga
  }
  const rf = (await env.DB.prepare(`SELECT p.* ${JOINS} WHERE lower(p.referrer_email) = ?1 AND NOT ${USED_REF} ORDER BY p.id`).bind(e).all()).results || [];
  for (const r of rf) {
    const c = (await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE lower(email) = ?1 AND status = 'confirmed' AND checked_in_at IS NOT NULL").bind(String(r.friend_email).toLowerCase()).first())?.n || 0;
    if (c >= 1) out.referrer.push(r); // prijatelj je stvarno došao
  }
  return out;
}

export async function iskoristi(env, id, strana, bookingId) {
  const col = strana === 'friend' ? 'friend' : 'referrer';
  await env.DB.prepare(`UPDATE preporuke SET ${col}_used_at = ?1, ${col}_booking_id = ?2 WHERE id = ?3`).bind(new Date().toISOString(), bookingId, id).run();
}
