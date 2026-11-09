// Provjera koda s emaila. Uspjeh = prijava (novi račun ako ne postoji). Najviše 5 pokušaja po kodu.
import { json, clean } from '../../_lib/util.js';
import { guardPost, readJson, normEmail, validEmail, hmac, safeEqual, rateLimit, clientIp, nowSec, createSession, findOrCreateUser, audit } from '../../_lib/auth.js';

const FAIL = () => json({ ok: false, error: 'Kod nije ispravan ili je istekao.' }, 400);

export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  const b = await readJson(request); if (!b) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  const kod = clean(b.kod, 12).replace(/\s/g, '');
  let email = normEmail(b.email), pending = null;
  if (b.pending) {
    pending = await env.DB.prepare('SELECT * FROM oauth_pending WHERE id = ?').bind(clean(b.pending, 60)).first();
    if (!pending || nowSec() - pending.created_at > 900) return FAIL();
    email = pending.email;
  }
  if (!validEmail(email) || !/^\d{6}$/.test(kod)) return FAIL();
  if (!(await rateLimit(env, 'otp-verify-ip:' + clientIp(request), 40, 900)) || !(await rateLimit(env, 'otp-verify:' + email, 15, 900)))
    return json({ ok: false, error: 'Previše pokušaja. Pričekaj 15 minuta.' }, 429);

  const row = await env.DB.prepare("SELECT * FROM login_codes WHERE email = ? AND COALESCE(pending_id, '') = ? ORDER BY id DESC LIMIT 1").bind(email, pending ? pending.id : '').first();
  if (!row || row.expires_at < nowSec()) return FAIL();
  await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
  if (row.attempts + 1 > 5) { await env.DB.prepare('DELETE FROM login_codes WHERE id = ?').bind(row.id).run(); return FAIL(); }
  if (!safeEqual(row.code_hash, await hmac(env, 'otp', email + ':' + kod))) return FAIL();
  await env.DB.prepare('DELETE FROM login_codes WHERE id = ?').bind(row.id).run(); // jednokratno

  const user = await findOrCreateUser(env, email, pending ? pending.name : null);
  if (pending) {
    await env.DB.prepare('INSERT OR IGNORE INTO identities (provider, subject, user_id, created_at) VALUES (?,?,?,?)').bind(pending.provider, pending.subject, user.id, new Date().toISOString()).run();
    await env.DB.prepare('DELETE FROM oauth_pending WHERE id = ?').bind(pending.id).run();
  }
  await audit(env, user.id, pending ? 'prijava_' + pending.provider + '_kod' : 'prijava_kod');
  return json({ ok: true }, 200, { 'set-cookie': await createSession(env, user.id) });
}
