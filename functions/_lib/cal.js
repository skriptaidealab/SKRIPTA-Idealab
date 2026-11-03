// "Add to calendar" helpers for confirmation mails: a Google Calendar link and an .ics file (Apple, Outlook, others).
import { NAMES, fmt } from './rules.js';

const PLACE = 'SKRIPTA IdeaLab, Emerika Bluma 9, Sarajevo';
const TZ = 'Europe/Sarajevo';
const pad = (n) => String(n).padStart(2, '0');
const local = (date, min) => date.replace(/-/g, '') + 'T' + pad(Math.floor(min / 60)) + pad(min % 60) + '00';

// Sarajevo wall clock to UTC, DST aware (the offset is looked up for that exact moment).
function offsetMs(utcMs) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000;
}
function utcStamp(date, min) {
  const wall = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 0, min);
  let utc = wall - offsetMs(wall);
  utc = wall - offsetMs(utc);
  return new Date(utc).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
const title = (b) => `SKRIPTA Coffice: ${NAMES[b.zone]}`;
const details = (b) => `${NAMES[b.zone]}, ${fmt(b.start_min)} do ${fmt(b.start_min + b.dur_h * 60)}. Kafa ili čaj su besplatni. Pitanja: info@skripta.ba`;

export function googleUrl(b) {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title(b), dates: `${local(b.date, b.start_min)}/${local(b.date, b.start_min + b.dur_h * 60)}`, ctz: TZ, details: details(b), location: PLACE });
  return 'https://calendar.google.com/calendar/render?' + q.toString().replace('%2F', '/');
}

const ics = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
export function icsFile(b, cancelUrl) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SKRIPTA//Coffice//BS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${b.id}@skripta.ba`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${utcStamp(b.date, b.start_min)}`, `DTEND:${utcStamp(b.date, b.start_min + b.dur_h * 60)}`,
    `SUMMARY:${ics(title(b))}`, `LOCATION:${ics(PLACE)}`, `DESCRIPTION:${ics(details(b) + (cancelUrl ? '\nOtkaži: ' + cancelUrl : ''))}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:SKRIPTA Coffice za 1 sat', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  return lines.join('\r\n') + '\r\n';
}
