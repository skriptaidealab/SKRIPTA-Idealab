import { json } from '../../_lib/util.js';
import { guardPost, destroySession, clearCookie } from '../../_lib/auth.js';
export async function onRequestPost({ request, env }) {
  const bad = guardPost(request); if (bad) return bad;
  await destroySession(env, request);
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
