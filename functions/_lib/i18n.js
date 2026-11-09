// English for guest-facing e-mails, calendar files and pages. Bosnian stays the source text in the code:
// tr('en', bosnianText) returns the English version. Anything unknown is returned unchanged, and tests/racuni.test.mjs
// fails when an English e-mail still contains Bosnian text, so a missing entry is caught before it ships.
export const langOf = (x) => (x === 'en' || (x && typeof x === 'object' && x.lang === 'en') ? 'en' : 'bs');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = (d, m, y) => `${+d} ${MONTHS[+m - 1]} ${y}`;

const EXACT = {
  // subjects
  'Primili smo tvoj zahtjev za rezervaciju': 'We received your booking request',
  'Rezervacija potvrđena: SKRIPTA Coffice': 'Booking confirmed: SKRIPTA Coffice',
  'Otkazana rezervacija: SKRIPTA Coffice': 'Booking cancelled: SKRIPTA Coffice',
  'Tvoj zahtjev za rezervaciju': 'Your booking request',
  'Rezervacija izmijenjena: SKRIPTA Coffice': 'Booking changed: SKRIPTA Coffice',
  'Termin produžen: SKRIPTA Coffice': 'Booking extended: SKRIPTA Coffice',
  // chips
  'Još nije potvrđeno': 'Not confirmed yet', 'Potvrđeno': 'Confirmed', 'Otkazano': 'Cancelled', 'Nije potvrđeno': 'Not confirmed',
  'Izmijenjeno': 'Changed', 'Hvala': 'Thanks', 'Podsjetnik': 'Reminder', 'Produženo': 'Extended', 'Prijava': 'Sign-in',
  // titles
  'Zahtjev je primljen.': 'Request received.', 'Vidimo se.': 'See you soon.', 'Moramo otkazati tvoju rezervaciju.': 'We have to cancel your booking.',
  'Ne možemo potvrditi termin.': 'We cannot confirm this slot.', 'Termin je promijenjen.': 'Your booking has changed.',
  'Hvala na posjeti!': 'Thanks for visiting!', 'Vidimo se uskoro.': 'See you soon.',
  // leads and notes
  'Nažalost ne možemo potvrditi traženi termin. Odaberi drugi na skripta.ba ili nam se javi na info@skripta.ba.': 'Unfortunately we cannot confirm the requested slot. Please pick another one on skripta.ba or write to info@skripta.ba.',
  'Upiši ga na stranici za prijavu. Vrijedi 10 minuta i može se iskoristiti jednom.': 'Enter it on the sign-in page. It is valid for 10 minutes and can be used once.',
  'Kafa ili čaj su besplatni. Ako trebaš promjenu, odgovori na ovaj email.': 'Coffee or tea is free. If you need a change, reply to this email.',
  'Kafa ili čaj su besplatni.': 'Coffee or tea is free.',
  'Plaćanje je po dolasku, gotovinom ili karticom. Kafa ili čaj su besplatni.': 'Pay on arrival, by cash or card. Coffee or tea is free.',
  'Ako imaš pitanja, odgovori na ovaj email ili nam piši na info@skripta.ba.': 'If you have any questions, reply to this email or write to info@skripta.ba.',
  'Vidimo se opet!': 'See you again!',
  'Ako ne možeš doći, otkaži da mjesto bude slobodno za nekog drugog.': 'If you cannot make it, please cancel so the spot is free for someone else.',
  'Ako se nisi pokušao/la prijaviti, slobodno zanemari ovaj email. Nikome ne govori kod: mi te nikada nećemo tražiti da ga pošalješ.': 'If you did not try to sign in, you can ignore this email. Never share the code with anyone: we will never ask you to send it.',
  // row labels
  'Zona': 'Zone', 'Termin': 'Time', 'Ukupno': 'Total', 'Promo kod': 'Promo code', 'Razlog': 'Reason', 'Prije': 'Before',
  'Novi termin': 'New time', 'Novi kraj': 'New end', 'Dodatno': 'Extra',
  // row values
  'Besplatno. Jedva čekamo da dođeš!': 'Free. We cannot wait to see you!', 'Besplatno.': 'Free.', 'Besplatno': 'Free',
  'FLEXI paket, bez doplate': 'FLEXI package, no extra charge',
  // buttons
  'Dodaj u Google kalendar': 'Add to Google Calendar', 'Apple / Outlook': 'Apple / Outlook', 'Otkaži rezervaciju': 'Cancel booking',
  'Otkaži zahtjev': 'Cancel request', 'Odaberi novi termin': 'Choose a new time', 'Odaberi drugi termin': 'Choose another time',
  'Rezerviši ponovo': 'Book again', 'Ne mogu doći, otkaži': 'Cannot make it, cancel',
  // reasons the owner can pick
  'Taj termin je već zauzet.': 'That slot is already taken.',
  'Prostor je tada zatvoren ili rezervisan za događaj.': 'The space is closed then or reserved for an event.',
  'Odabrana zona je u tom terminu popunjena.': 'The chosen zone is full at that time.',
  'Prostor je tog dana zatvoren ili rezervisan za događaj.': 'The space is closed that day or reserved for an event.',
  'Imamo tehnički problem u prostoru.': 'We have a technical issue in the space.',
  'Došlo je do preklapanja termina.': 'Two bookings overlapped.',
  // calendar file
  'SKRIPTA Coffice za 1 sat': 'SKRIPTA Coffice in 1 hour'
};

const RULES = [
  [/^(Focus|Lounge) zona(?:, (\d+) osob[ea])?$/, (m, z, n) => `${z} zone` + (n ? `, ${n} people` : '')],
  [/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}) do (\d{2}:\d{2})$/, (m, d, mo, y, a, b) => `${niceDate(d, mo, y)}, ${a} to ${b}`],
  [/^(\d{2}:\d{2}) do (\d{2}:\d{2})$/, (m, a, b) => `${a} to ${b}`],
  [/^([\d,]+) KM, plaćanje po dolasku\.?$/, (m, n) => `${n} KM, pay on arrival`],
  [/^(.+), (\d+)% popusta$/, (m, c, p) => `${c}, ${p}% off`],
  [/^Hvala, (.+)\. Termin je tvoj tek kad ti potvrdimo emailom\.$/, (m, n) => `Thanks, ${n}. The slot is yours only once we confirm by email.`],
  [/^Tvoja rezervacija je potvrđena, (.+)\.$/, (m, n) => `Your booking is confirmed, ${n}.`],
  [/^Žao nam je, (.+)\. Nažalost moramo otkazati tvoju rezervaciju\. Ispričavamo se zbog neugodnosti\.$/, (m, n) => `We are sorry, ${n}. Unfortunately we have to cancel your booking. We apologise for the inconvenience.`],
  [/^(.+), tvoja rezervacija je izmijenjena\. Novi termin je ispod\. Ako ti ne odgovara, otkaži je ili nam se javi na info@skripta\.ba\.$/, (m, n) => `${n}, your booking has been changed. The new time is below. If it does not suit you, cancel it or write to info@skripta.ba.`],
  [/^Hvala ti, (.+)\. Nadamo se da ti je u COFFICE-u bilo ugodno\.$/, (m, n) => `Thank you, ${n}. We hope you enjoyed COFFICE.`],
  [/^Podsjećamo te na rezervaciju, (.+)\.$/, (m, n) => `A reminder about your booking, ${n}.`],
  [/^Ostaješ do (\d{2}:\d{2})\.$/, (m, t) => `You can stay until ${t}.`],
  [/^Tvoj kod: (\d+)$/, (m, c) => `Your code: ${c}`],
  [/^(\[TEST\] )?Hvala na posjeti, SKRIPTA Coffice$/, (m, t) => `${t || ''}Thanks for visiting, SKRIPTA Coffice`],
  [/^(\[TEST\] )?Podsjetnik: tvoja rezervacija u (\d{2}:\d{2}), SKRIPTA Coffice$/, (m, t, h) => `${t || ''}Reminder: your booking at ${h}, SKRIPTA Coffice`],
  [/^Tvoj kod za prijavu: (\d+)$/, (m, c) => `Your sign-in code: ${c}`],
  [/^(.+), (\d{2}:\d{2}) do (\d{2}:\d{2})\. Kafa ili čaj su besplatni\. Pitanja: info@skripta\.ba$/, (m, z, a, b) => `${tr('en', z)}, ${a} to ${b}. Coffee or tea is free. Questions: info@skripta.ba`]
];

export function tr(lang, s) {
  if (lang !== 'en' || typeof s !== 'string' || !s) return s;
  if (EXACT[s] !== undefined) return EXACT[s];
  for (const [re, fn] of RULES) { const m = re.exec(s); if (m) return fn(...m); }
  for (const k of Object.keys(EXACT)) if (k.length > 20 && s.startsWith(k + ' ')) return EXACT[k] + s.slice(k.length); // preset reason plus the owner's own note
  return s;
}

export const cofficePage = (x) => (langOf(x) === 'en' ? 'coffice-en.html' : 'coffice.html');
export const racunPage = (x) => (langOf(x) === 'en' ? 'racun-en.html' : 'racun.html');
