import { checkQuery, freeStarts, loadDay, tableFor, priceText, promoLine, NAMES, fmt, zoneLabel } from '../_lib/rules.js';
import { tr, langOf, cofficePage } from '../_lib/i18n.js';
import { page, esc, clean, makeToken, readToken } from '../_lib/util.js';
import { mail, C } from '../_lib/mail.js';
import { subscribeIfOptedIn } from '../_lib/newsletter.js';
import { listBlocks, sendMail, createEvent, deleteEvent } from '../_lib/graph.js';
import { googleUrl } from '../_lib/cal.js';

const load = (env, id) => env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
const payText = (b) => (b.flexi_paket_id ? 'FLEXI paket, bez doplate' : priceText(b.total));
const whenOf = (b) => `${b.date.split('-').reverse().join('.')} ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}`;
const summary = (b) => `<dl><dt>Zona</dt><dd>${esc(NAMES[b.zone])}, ${b.persons} ${b.persons === 1 ? 'osoba' : 'osobe'}</dd><dt>Termin</dt><dd>${esc(whenOf(b))}</dd>${b.promo ? `<dt>Promo kod</dt><dd>${esc(promoLine(b))}</dd>` : ''}<dt>Ukupno</dt><dd>${payText(b)}</dd><dt>Gost</dt><dd>${esc(b.name)}, ${esc(b.email)}${b.phone ? ', ' + esc(b.phone) : ''}</dd></dl>`;

// Reasons the owner can pick when she rejects a request or cancels a confirmed booking. The text goes to the guest in the e-mail.
const REASONS = {
  odbij: [['zauzeto', 'Taj termin je već zauzet.'], ['zatvoreno', 'Prostor je tada zatvoren ili rezervisan za događaj.'], ['popunjeno', 'Odabrana zona je u tom terminu popunjena.']],
  'otkazi-mi': [['zatvoreno', 'Prostor je tog dana zatvoren ili rezervisan za događaj.'], ['tehnicki', 'Imamo tehnički problem u prostoru.'], ['preklapanje', 'Došlo je do preklapanja termina.']]
};
function reasonForm(t, action, label, { err = '', sel = '', text = '' } = {}) {
  const opts = REASONS[action].concat([['drugo', 'Drugo (upiši razlog ispod)']]).map(([k, v]) => `<label class="opt"><input type="radio" name="razlog" value="${k}"${sel === k ? ' checked' : ''}><span>${esc(v)}</span></label>`).join('');
  return `<form method="post"><input type="hidden" name="t" value="${esc(t)}"><fieldset><legend>Razlog (gost ga dobija u emailu)</legend>${opts}<textarea name="drugo" rows="3" maxlength="300" placeholder="Tvoj razlog ili dodatna napomena gostu">${esc(text)}</textarea></fieldset>${err ? `<p class="err">${esc(err)}</p>` : ''}<button>${esc(label)}</button></form>`;
}
// Preset (optionally plus a note), or the custom text when "Drugo" is chosen. null when nothing usable was given.
function pickReason(action, f) {
  const key = String(f.get('razlog') || ''), text = clean(f.get('drugo'), 300);
  const preset = (REASONS[action].find(([k]) => k === key) || [])[1];
  if (preset) return { key, text: preset + (text ? ' ' + text : '') };
  if (text) return { key: 'drugo', text };
  return null;
}

// GET only shows a page. Mail scanners that pre-open links therefore cannot confirm anything.
export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get('t');
  const k = await readToken(env, t, ['potvrdi', 'odbij', 'otkazi-mi']);
  if (!k) return page('Link nije ispravan', '<h1>Link nije ispravan</h1>', 400);
  const b = await load(env, k.id);
  if (!b) return page('Nije pronađeno', '<h1>Rezervacija nije pronađena</h1>', 404);
  if (k.action === 'otkazi-mi') {
    if (!['confirmed', 'pending'].includes(b.status)) return page('Već obrađeno', `<h1>Rezervacija nije aktivna</h1><p>Status: ${esc(b.status)}</p>${summary(b)}`);
    return page('Otkaži rezervaciju', `<h1>Otkazati rezervaciju gosta?</h1>${summary(b)}<p>Gost dobija email da je rezervacija otkazana s naše strane, a događaj se briše iz kalendara.</p>${reasonForm(t, 'otkazi-mi', 'Otkaži rezervaciju')}`);
  }
  if (b.status !== 'pending') return page('Već obrađeno', `<h1>Već obrađeno</h1><p>Status: ${esc(b.status)}</p>${summary(b)}`);
  const label = k.action === 'potvrdi' ? 'Potvrdi i dodaj u kalendar' : 'Odbij zahtjev';
  if (k.action === 'odbij') return page(label, `<h1>${esc(label)}</h1>${summary(b)}${reasonForm(t, 'odbij', label)}`);
  return page(label, `<h1>${esc(label)}</h1>${summary(b)}<form method="post"><input type="hidden" name="t" value="${esc(t)}"><button>${esc(label)}</button></form>`);
}

export async function onRequestPost({ request, env }) {
  const f = await request.formData(), t = f.get('t');
  const k = await readToken(env, t, ['potvrdi', 'odbij', 'otkazi-mi']);
  if (!k) return page('Link nije ispravan', '<h1>Link nije ispravan</h1>', 400);
  const b = await load(env, k.id);
  if (!b) return page('Nije pronađeno', '<h1>Rezervacija nije pronađena</h1>', 404);

  if (k.action === 'otkazi-mi') {
    if (!['confirmed', 'pending'].includes(b.status)) return page('Već obrađeno', `<h1>Rezervacija nije aktivna</h1><p>Status: ${esc(b.status)}</p>`);
    const why = pickReason('otkazi-mi', f);
    if (!why) return page('Navedi razlog', `<h1>Navedi razlog otkazivanja</h1>${summary(b)}${reasonForm(t, 'otkazi-mi', 'Otkaži rezervaciju', { err: 'Odaberi razlog ili upiši svoj.' })}`, 400);
    await env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").bind(b.id).run();
    let calNote = '';
    if (b.event_id) { try { await deleteEvent(env, b.event_id); } catch (e) { console.error(e); calNote = '<p><b>Upozorenje:</b> događaj nije obrisan iz kalendara. Obrišite ga ručno.</p>'; } }
    await sendMail(env, { to: b.email, subject: tr(langOf(b), 'Otkazana rezervacija: SKRIPTA Coffice'), html: mail({ lang: langOf(b), chip: 'Otkazano', tone: 'no', accent: C.rose, title: 'Moramo otkazati tvoju rezervaciju.', lead: `Žao nam je, ${esc(b.name)}. Nažalost moramo otkazati tvoju rezervaciju. Ispričavamo se zbog neugodnosti.`, rows: [['Zona', zoneLabel(b)], ['Termin', whenOf(b)], ['Razlog', why.text]], buttons: [{ href: `${env.SITE_URL}/${cofficePage(langOf(b))}#rezervacija`, label: 'Odaberi novi termin' }], note: 'Ako imaš pitanja, odgovori na ovaj email ili nam piši na info@skripta.ba.' }) });
    return page('Otkazano', `<h1>Rezervacija otkazana</h1><p>Gost je obaviješten emailom. Razlog: ${esc(why.text)}${b.event_id && !calNote ? ' Događaj je uklonjen iz kalendara.' : ''}</p>${calNote}${summary(b)}`);
  }

  if (b.status !== 'pending') return page('Već obrađeno', `<h1>Već obrađeno</h1><p>Status: ${esc(b.status)}</p>`);

  if (k.action === 'odbij') {
    const why = pickReason('odbij', f);
    if (!why) return page('Navedi razlog', `<h1>Navedi razlog odbijanja</h1>${summary(b)}${reasonForm(t, 'odbij', 'Odbij zahtjev', { err: 'Odaberi razlog ili upiši svoj.' })}`, 400);
    await env.DB.prepare("UPDATE bookings SET status = 'rejected' WHERE id = ?").bind(b.id).run();
    await sendMail(env, { to: b.email, subject: tr(langOf(b), 'Tvoj zahtjev za rezervaciju'), html: mail({ lang: langOf(b), chip: 'Nije potvrđeno', tone: 'no', accent: C.rose, title: 'Ne možemo potvrditi termin.', lead: `Nažalost ne možemo potvrditi traženi termin. Odaberi drugi na skripta.ba ili nam se javi na info@skripta.ba.`, rows: [['Zona', zoneLabel(b)], ['Termin', whenOf(b)], ['Razlog', why.text]], buttons: [{ href: `${env.SITE_URL}/${cofficePage(langOf(b))}#rezervacija`, label: 'Odaberi drugi termin' }] }) });
    return page('Odbijeno', `<h1>Zahtjev odbijen</h1><p>Gost je obaviješten emailom. Razlog: ${esc(why.text)}</p>`);
  }

  // confirm: re-check availability (another request may have been confirmed meanwhile)
  const q = { zone: b.zone, dur: b.dur_h, persons: b.persons, date: b.date };
  const day = await loadDay(env, b.date, listBlocks);
  const tbl = tableFor(q, b.start_min, day.bookings);
  const blocked = day.blocks.some((x) => b.start_min < x.end_min && b.start_min + b.dur_h * 60 > x.start_min);
  if (tbl < 0 || blocked) return page('Termin nije slobodan', `<h1>Termin više nije slobodan</h1><p>Drugi potvrđeni termin ili najam cijelog prostora se preklapa. Odbijte zahtjev ili se javite gostu.</p>${summary(b)}`, 409);

  let eventId = null, calendarNote = '';
  const cancelUs = `${env.SITE_URL}/api/odluka?t=${await makeToken(env, b.id, 'otkazi-mi')}`;
  try {
    eventId = await createEvent(env, { subject: `Coffice: ${NAMES[b.zone]}, ${b.persons} os. (${b.name})`, html: `<p>${esc(b.name)}, ${esc(b.email)}${b.phone ? ', ' + esc(b.phone) : ''}<br>${payText(b)}</p><p><a href="${cancelUs}">Otkaži ovu rezervaciju (mi otkazujemo)</a></p>`, date: b.date, startMin: b.start_min, endMin: b.start_min + b.dur_h * 60 });
  } catch (e) { console.error(e); calendarNote = '<p><b>Upozorenje:</b> događaj nije upisan u kalendar. Dodajte ga ručno.</p>'; }
  await env.DB.prepare("UPDATE bookings SET status = 'confirmed', table_idx = ?, event_id = ? WHERE id = ?").bind(q.zone === 'cafe' ? tbl : null, eventId, b.id).run();
  await subscribeIfOptedIn(env, b);
  const cancel = `${env.SITE_URL}/api/otkazi?t=${await makeToken(env, b.id, 'otkazi')}`;
  const icsUrl = `${env.SITE_URL}/api/kalendar?t=${await makeToken(env, b.id, 'kalendar')}`;
  await sendMail(env, { to: b.email, subject: tr(langOf(b), 'Rezervacija potvrđena: SKRIPTA Coffice'), html: mail({ lang: langOf(b), chip: 'Potvrđeno', tone: 'ok', accent: C.teal, title: 'Vidimo se.', lead: `Tvoja rezervacija je potvrđena, ${esc(b.name)}.`, rows: [['Zona', zoneLabel(b)], ['Termin', whenOf(b)], ...(b.promo ? [['Promo kod', promoLine(b)]] : []), ['Ukupno', payText(b)]], buttons: [{ href: googleUrl(b), label: 'Dodaj u Google kalendar' }, { href: icsUrl, label: 'Apple / Outlook', kind: 'ghost' }, { href: cancel, label: 'Otkaži rezervaciju', kind: 'ghost' }], note: b.total === 0 ? 'Kafa ili čaj su besplatni.' : 'Plaćanje je po dolasku, gotovinom ili karticom. Kafa ili čaj su besplatni.' }) });
  return page('Potvrđeno', `<h1>Potvrđeno</h1><p>Gost je obaviješten emailom.${eventId ? ' Događaj je u kalendaru.' : ''}</p>${calendarNote}${summary(b)}`);
}
