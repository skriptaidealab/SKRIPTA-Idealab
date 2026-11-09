import { json, clean } from '../../_lib/util.js';
import { guardPost, readJson, getUser, audit } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  const user = await getUser(env, request); if (!user) return json({ ok: false, error: 'Prijavi se.' }, 401);
  const b = await readJson(request); if (!b) return json({ ok: false, error: 'Neispravan zahtjev.' }, 400);
  const name = clean(b.ime, 100), phone = clean(b.telefon, 40), d = phone.replace(/\D/g, '');
  if (name && name.split(/\s+/).length < 2) return json({ ok: false, error: 'Upiši ime i prezime.' }, 400);
  if (phone && (!/^\+?[\d\s().\/-]{6,}$/.test(phone) || d.length < 8 || d.length > 15)) return json({ ok: false, error: 'Upiši ispravan broj telefona.' }, 400);
  await env.DB.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').bind(name || null, phone || null, user.id).run();
  await audit(env, user.id, 'profil_izmijenjen');
  return json({ ok: true });
}
