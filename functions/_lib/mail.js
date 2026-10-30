// Shared HTML e-mail layout in the SKRIPTA look: white page, big black type, flat colour blocks.
// Table based with inline styles so it renders the same in Outlook, Gmail and Apple Mail.
import { esc } from './util.js';

export const C = { ink: '#1A1A1A', grey: '#414141', soft: '#F4F3EF', line: '#DDDBD3', teal: '#5A837B', mustard: '#DCA402', rose: '#A95457', purple: '#5B4E93' };
const FONT = "Helvetica Neue,Helvetica,Arial,sans-serif";

const chipStyle = { wait: `background:${C.mustard};color:${C.ink}`, ok: `background:${C.teal};color:#ffffff`, no: `background:${C.rose};color:#ffffff`, info: `background:${C.ink};color:#ffffff` };

function button(b) {
  const solid = b.kind !== 'ghost';
  const st = solid ? `background:${C.purple};color:#ffffff;border:2px solid ${C.purple}` : `background:#ffffff;color:${C.ink};border:2px solid ${C.ink}`;
  return `<a href="${b.href}" style="display:inline-block;${st};font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:13px 22px;margin:0 10px 10px 0">${esc(b.label)}</a>`;
}

// title, lead and note are HTML (escape dynamic parts with esc). rows: [[label, value], ...] values are escaped here.
export function mail({ brand = 'SKRIPTA Coffice', accent = C.mustard, chip, tone = 'info', title, lead = '', rows = [], buttons = [], note = '' }) {
  const rowHtml = rows.filter((r) => r && r[1] !== '' && r[1] != null).map(([l, v], i, a) =>
    `<tr><td style="padding:12px 0;${i < a.length - 1 ? `border-bottom:1px solid ${C.line};` : ''}width:120px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.grey};vertical-align:top">${esc(l)}</td><td style="padding:12px 0;${i < a.length - 1 ? `border-bottom:1px solid ${C.line};` : ''}font-family:${FONT};font-size:16px;font-weight:700;color:${C.ink};vertical-align:top">${esc(v)}</td></tr>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:0"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="background:${accent};height:14px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 0"><span style="font-family:${FONT};font-size:13px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${C.ink}">${esc(brand)}</span>${chip ? `<span style="display:inline-block;margin-left:12px;padding:5px 10px;${chipStyle[tone] || chipStyle.info};font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${esc(chip)}</span>` : ''}</td></tr>
<tr><td style="padding:22px 28px 0;font-family:${FONT};font-size:38px;line-height:1.02;font-weight:900;letter-spacing:-1.5px;color:${C.ink}">${title}</td></tr>
${lead ? `<tr><td style="padding:16px 28px 0;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.grey}">${lead}</td></tr>` : ''}
${rowHtml ? `<tr><td style="padding:24px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-left:6px solid ${accent}"><tr><td style="padding:10px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}</table></td></tr></table></td></tr>` : ''}
${buttons.length ? `<tr><td style="padding:26px 28px 0">${buttons.map(button).join('')}</td></tr>` : ''}
${note ? `<tr><td style="padding:14px 28px 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.grey}">${note}</td></tr>` : ''}
<tr><td style="padding:34px 28px 36px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${C.line};padding-top:16px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.grey}"><b style="color:${C.ink}">SKRIPTA</b> · Emerika Bluma 9, Sarajevo<br><a href="mailto:info@skripta.ba" style="color:${C.grey}">info@skripta.ba</a> · +387 62 307 885 · <a href="https://www.skripta.ba" style="color:${C.grey}">skripta.ba</a></td></tr></table></td></tr>
</table></td></tr></table></body></html>`;
}
