// GET /api/kalendar?t=<token>: .ics file for a confirmed booking (signed link from the confirmation mail).
import { readToken, makeToken } from '../_lib/util.js';
import { icsFile } from '../_lib/cal.js';

export async function onRequestGet({ request, env }) {
  const k = await readToken(env, new URL(request.url).searchParams.get('t'), ['kalendar']);
  const b = k && await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(k.id).first();
  if (!b || b.status !== 'confirmed') return new Response('Rezervacija nije aktivna.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const cancel = `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, b.id, 'otkazi')}`;
  return new Response(icsFile(b, cancel), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="skripta-coffice.ics"', 'cache-control': 'no-store' } });
}
