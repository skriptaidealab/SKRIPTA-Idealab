// Šalje jednokratni kod na email. Odgovor je uvijek isti, da se ne može saznati ko ima račun.
import { json, clean } from '../../_lib/util.js';
import { tr, langOf, cofficePage } from '../../_lib/i18n.js';
import { guardPost, readJson, normEmail, validEmail, otpCode, hmac, rateLimit, clientIp, nowSec } from '../../_lib/auth.js';
import { sendMail } from '../../_lib/graph.js';
import { mail } from '../../_lib/mail.js';

export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  const b = await readJson(request); if (!b) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  const lang = b.lang === 'en' ? 'en' : 'bs';
  let email = normEmail(b.email), pending = null;
  if (b.pending) {
    pending = await env.DB.prepare('SELECT * FROM oauth_pending WHERE id = ?').bind(clean(b.pending, 60)).first();
    if (!pending || nowSec() - pending.created_at > 900) return json({ ok: false, error: 'Prijava je istekla. Pokušaj ponovo.' }, 400);
    email = pending.email; // adresu određuje server, ne klijent
  }
  if (!validEmail(email)) return json({ ok: false, error: 'Upiši ispravan email.' }, 400);

  const ip = clientIp(request);
  if (!(await rateLimit(env, 'otp-ip:' + ip, 20, 3600)) || !(await rateLimit(env, 'otp-mail:' + email, 5, 3600)))
    return json({ ok: false, error: 'Previše pokušaja. Pokušaj opet za sat vremena.' }, 429);

  const code = otpCode(), now = nowSec(), pid = pending ? pending.id : '';
  await env.DB.prepare("DELETE FROM login_codes WHERE email = ? AND COALESCE(pending_id, '') = ?").bind(email, pid).run();
  await env.DB.prepare('INSERT INTO login_codes (email, pending_id, code_hash, expires_at, attempts, created_at) VALUES (?,?,?,?,0,?)')
    .bind(email, pending ? pending.id : null, await hmac(env, 'otp', email + ':' + code), now + 600, now).run();
  try {
    await sendMail(env, {
      to: email, subject: tr(lang, `Tvoj kod za prijavu: ${code}`),
      html: mail({ lang, brand: 'SKRIPTA Coffice', chip: 'Prijava', tone: 'info', title: `Tvoj kod: ${code}`, lead: 'Upiši ga na stranici za prijavu. Vrijedi 10 minuta i može se iskoristiti jednom.', note: 'Ako se nisi pokušao/la prijaviti, slobodno zanemari ovaj email. Nikome ne govori kod: mi te nikada nećemo tražiti da ga pošalješ.' })
    });
  } catch (e) { console.error('kod-posalji', e); return json({ ok: false, error: 'Slanje nije uspjelo. Pokušaj ponovo ili nam piši na info@skripta.ba.' }, 502); }
  return json({ ok: true });
}
