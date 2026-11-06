// Newsletter opt-in helpers. The opt-in is stored with the booking request and only acted on once the booking is confirmed.
export async function markOptIn(env, id) {
  try { await env.DB.prepare('UPDATE bookings SET newsletter = 1 WHERE id = ?').bind(id).run(); } catch (e) { console.error('newsletter column missing?', e); }
}

// Called when a booking is confirmed. Never throws, never blocks the confirmation.
export async function subscribeIfOptedIn(env, b) {
  try {
    const row = await env.DB.prepare('SELECT newsletter FROM bookings WHERE id = ?').bind(b.id).first();
    if (!row || row.newsletter !== 1) return;
  } catch (e) { console.error(e); return; }
  const email = String(b.email).toLowerCase();
  try { await env.DB.prepare('INSERT OR IGNORE INTO subscribers (email, name, created_at, source) VALUES (?,?,?,?)').bind(email, b.name, new Date().toISOString(), 'rezervacija').run(); } catch (e) { console.error(e); }
  // Brevo (preferirano): kontakt ide na listu BREVO_LIST_ID. updateEnabled = bez greške ako kontakt već postoji.
  if (env.BREVO_API_KEY && env.BREVO_LIST_ID) {
    try {
      const parts = String(b.name).split(/\s+/), last = parts.length > 1 ? parts.pop() : '';
      const r = await fetch('https://api.brevo.com/v3/contacts', { method: 'POST', headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ email, attributes: { FIRSTNAME: parts.join(' '), LASTNAME: last }, listIds: [Number(env.BREVO_LIST_ID)], updateEnabled: true }) });
      if (!r.ok) console.error('Brevo contacts', r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.error(e); }
    return;
  }
  if (!env.MAILERLITE_API_KEY) return; // stari put (MailerLite), koristi se dok Brevo nije postavljen
  try {
    const parts = String(b.name).split(/\s+/), last = parts.length > 1 ? parts.pop() : '';
    const body = { email, fields: { name: parts.join(' '), last_name: last } };
    if (env.MAILERLITE_GROUP_ID) body.groups = [env.MAILERLITE_GROUP_ID];
    const r = await fetch('https://connect.mailerlite.com/api/subscribers', { method: 'POST', headers: { authorization: 'Bearer ' + env.MAILERLITE_API_KEY, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) console.error('MailerLite', r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.error(e); }
}
