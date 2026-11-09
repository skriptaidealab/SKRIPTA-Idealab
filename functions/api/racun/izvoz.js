// "Preuzmi moje podatke": sve što imamo o računu, kao JSON.
import { json } from '../../_lib/util.js';
import { getUser, audit } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const user = await getUser(env, request); if (!user) return json({ ok: false, error: 'Prijavi se.' }, 401);
  const q = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
  const data = {
    izvezeno: new Date().toISOString(),
    racun: { email: user.email, ime: user.name, telefon: user.phone, napravljen: user.created_at },
    nacini_prijave: (await q('SELECT provider, created_at FROM identities WHERE user_id = ?', user.id)).map((i) => ({ pruzalac: i.provider, od: i.created_at })),
    rezervacije: await q('SELECT id, created_at, status, zone, persons, date, start_min, dur_h, total, name, email, phone, promo, checked_in_at, paid_at, flexi_paket_id FROM bookings WHERE user_id = ? ORDER BY date', user.id),
    flexi_paketi: await q('SELECT id, created_at, sati, dolazaka, cijena, placeno_at, expires_at FROM flexi_paketi WHERE user_id = ?1 OR lower(email) = ?2', user.id, user.email),
    pretplata_na_novosti: (await q('SELECT email, created_at FROM subscribers WHERE lower(email) = ?', user.email))
  };
  await audit(env, user.id, 'izvoz_podataka');
  return new Response(JSON.stringify(data, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="moji-podaci-skripta.json"', 'cache-control': 'no-store' } });
}
