// Brisanje računa. Rezervacije ostaju samo kao anonimna evidencija (bez imena, emaila i telefona).
// Najprije se moraju otkazati nadolazeće rezervacije. Gubitak neiskorištenih FLEXI posjeta mora se potvrditi.
import { json, clean } from '../../_lib/util.js';
import { guardPost, readJson, getUser, audit, normEmail, clearCookie } from '../../_lib/auth.js';
import { sarajevoNow } from '../../_lib/rules.js';
import { flexiOf } from '../../_lib/portal.js';

export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  const user = await getUser(env, request); if (!user) return json({ ok: false, error: 'Prijavi se.' }, 401);
  const b = await readJson(request); if (!b) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  if (normEmail(b.potvrda) !== user.email) return json({ ok: false, error: 'Za potvrdu upiši email računa.' }, 400);
  const now = sarajevoNow();
  const up = await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE user_id = ? AND status IN ('pending','confirmed') AND (date > ? OR (date = ? AND start_min + dur_h * 60 > ?))").bind(user.id, now.date, now.date, now.min).first();
  if (up.n > 0) return json({ ok: false, error: 'Prvo otkaži nadolazeće rezervacije, ili nam piši na info@skripta.ba.' }, 409);
  const left = (await flexiOf(env, user)).reduce((s, p) => s + p.preostalo, 0);
  if (left > 0 && b.prihvatamGubitakPaketa !== true) return json({ ok: false, potrebnaPotvrda: 'paket', error: `Imaš ${left} neiskorištenih FLEXI posjeta. Brisanjem računa gube se veza s paketom.` }, 409);

  await env.DB.prepare("UPDATE bookings SET name = 'Obrisan račun', email = 'obrisano@invalid', phone = NULL, user_id = NULL WHERE user_id = ?").bind(user.id).run();
  await env.DB.prepare("UPDATE flexi_paketi SET ime = 'Obrisan račun', email = NULL, telefon = NULL, user_id = NULL WHERE user_id = ?1 OR lower(email) = ?2").bind(user.id, user.email).run().catch(() => {});
  await env.DB.prepare('DELETE FROM subscribers WHERE lower(email) = ?').bind(user.email).run().catch(() => {});
  await env.DB.prepare('DELETE FROM identities WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(user.email).run();
  await env.DB.prepare('DELETE FROM oauth_pending WHERE email = ?').bind(user.email).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
  await audit(env, user.id, 'racun_obrisan');
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
