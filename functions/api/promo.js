import { checkQuery, applyPromo } from '../_lib/rules.js';
import { json, clean } from '../_lib/util.js';

// GET /api/promo?kod=&zona=&trajanje=&osobe=&datum= : preview of the discounted price. The booking POST checks the code again.
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url).searchParams;
  const q = { zone: clean(u.get('zona'), 10), dur: +u.get('trajanje'), persons: +u.get('osobe') || 1, date: clean(u.get('datum'), 10) };
  const err = checkQuery(q);
  if (err) return json({ ok: false, error: err }, 400);
  let r;
  try { r = await applyPromo(env, clean(u.get('kod'), 30), q); } catch (e) { console.error(e); return json({ ok: false, error: 'Provjera nije uspjela. Pokušaj opet.' }, 503); }
  return json(r, r.ok ? 200 : 400);
}
