// FLEXI paketi vezani za račun. Posjeta se skida tek pri check-inu (nadzorna ploča), ovdje se samo rezerviše.
// Rok važenja: mjesec dana od datuma prve rezervacije s tim paketom.
export function addMonth(date) {
  const y = +date.slice(0, 4), m = +date.slice(5, 7), d = +date.slice(8, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // zadnji dan sljedećeg mjeseca
  const t = new Date(Date.UTC(y, m, Math.min(d, last)));
  return t.toISOString().slice(0, 10);
}
const dmy = (d) => d.split('-').reverse().join('.');

// Provjerava može li korisnik iskoristiti paket za ovu rezervaciju. Vraća { ok, paket } ili { ok: false, error }.
export async function checkFlexi(env, user, id, q) {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Paket nije ispravan.' };
  const p = await env.DB.prepare('SELECT * FROM flexi_paketi WHERE id = ?1 AND (user_id = ?2 OR lower(email) = ?3)').bind(id, user.id, user.email).first();
  if (!p) return { ok: false, error: 'Paket nije pronađen na tvom računu.' };
  if (q.zone !== 'ind') return { ok: false, error: 'FLEXI paketi važe samo za Focus zonu.' };
  if (p.sati !== q.dur) return { ok: false, error: `Ovaj paket je za posjete od ${p.sati} sata.` };
  if (q.persons !== 1) return { ok: false, error: 'FLEXI posjeta važi za jednu osobu.' };
  if (p.expires_at && q.date > p.expires_at) return { ok: false, error: `Paket važi do ${dmy(p.expires_at)}.` };
  const used = (await env.DB.prepare('SELECT COUNT(*) AS n FROM flexi_posjete WHERE paket_id = ?').bind(p.id).first()).n;
  const held = (await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE flexi_paket_id = ? AND status IN ('pending','confirmed') AND checked_in_at IS NULL").bind(p.id).first()).n;
  if (used + held >= p.dolazaka) return { ok: false, error: 'Nema slobodnih posjeta u paketu.' };
  return { ok: true, paket: p, left: p.dolazaka - used - held - 1 };
}
