// Microsoft Graph with app-only credentials. Sends mail from and writes to the info@skripta.ba mailbox.
let cached = null;
async function token(env) {
  if (cached && cached.exp > Date.now() + 60000) return cached.v;
  const r = await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.MS_CLIENT_ID, client_secret: env.MS_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' })
  });
  if (!r.ok) throw new Error('Graph token ' + r.status);
  const j = await r.json(); cached = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 }; return cached.v;
}
async function call(env, method, path, body) {
  const r = await fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(env.MAILBOX) + path, {
    method, headers: { authorization: 'Bearer ' + await token(env), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok && !(method === 'DELETE' && r.status === 404)) throw new Error(`Graph ${method} ${path} ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.headers.get('content-type')?.includes('json') ? r.json() : null;
}
export function sendMail(env, { to, subject, html, replyTo }) {
  // TEST_MODE: nothing reaches real guests. Everything goes to TEST_RECIPIENT with a [TEST] prefix.
  if (env.TEST_MODE) { html = `<p style="color:#B5542F"><b>[TEST] originalni primalac: ${to}</b></p>` + html; subject = '[TEST] ' + subject; to = env.TEST_RECIPIENT || env.MAILBOX; }
  return call(env, 'POST', '/sendMail', { message: { subject, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: to } }], ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}) }, saveToSentItems: true });
}
const local = (date, min) => `${date}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;
export async function createEvent(env, { subject, html, date, startMin, endMin }) {
  const tz = 'Central European Standard Time';
  if (env.TEST_MODE) subject = '[TEST] ' + subject;
  const ev = await call(env, 'POST', '/events', { subject, body: { contentType: 'HTML', content: html }, start: { dateTime: local(date, startMin), timeZone: tz }, end: { dateTime: local(date, endMin), timeZone: tz }, location: { displayName: 'SKRIPTA, Emerika Bluma 9, Sarajevo' } });
  return ev.id;
}
export const deleteEvent = (env, id) => call(env, 'DELETE', '/events/' + encodeURIComponent(id));

// Admin blocks live in the Outlook calendar: any event whose subject starts with "BLOK" closes the space.
// All-day events close the whole day. Times are read in Sarajevo local time.
const cache = new Map();
export async function listBlocks(env, date) {
  const hit = cache.get(date);
  if (hit && hit.exp > Date.now()) return hit.v;
  const day = (n) => new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const tz = 'Central European Standard Time';
  const r = await fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(env.MAILBOX) + '/calendarView?startDateTime=' + day(-1) + 'T00:00:00Z&endDateTime=' + day(2) + 'T00:00:00Z&$select=subject,start,end,isAllDay&$top=100', {
    headers: { authorization: 'Bearer ' + await token(env), prefer: 'outlook.timezone="' + tz + '"' }
  });
  if (!r.ok) throw new Error('Graph calendarView ' + r.status + ' ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 220));
  const j = await r.json();
  const toMin = (s) => { const d = s.slice(0, 10), m = +s.slice(11, 13) * 60 + +s.slice(14, 16); return d < date ? 0 : d > date ? 1440 : m; };
  const v = (j.value || []).filter((e) => /^\s*blok/i.test(e.subject || '')).map((e) => {
    const ds = e.start.dateTime.slice(0, 10), de = e.end.dateTime.slice(0, 10);
    const s = e.isAllDay ? (ds <= date ? 0 : 1440) : toMin(e.start.dateTime);
    const en = e.isAllDay ? (de > date ? 1440 : 0) : toMin(e.end.dateTime);
    return { start_min: s, end_min: en, note: e.subject };
  }).filter((b) => b.end_min > b.start_min);
  cache.set(date, { v, exp: Date.now() + 60000 });
  return v;
}
