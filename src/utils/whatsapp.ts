/** Same rules as the server: digits only, country code included (01012345678 -> 201012345678). */
export function normalizePhone(raw: string, countryCode = '20'): string | null {
  let d = (raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = countryCode + d.slice(1);
  return /^\d{8,15}$/.test(d) ? d : null;
}

/** Link that opens the WhatsApp chat with the student (the "شات الواتس" button). */
export function chatUrl(phone: string, text?: string): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
