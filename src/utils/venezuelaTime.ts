export const VENEZUELA_TIMEZONE = 'America/Caracas';
export const VENEZUELA_LOCALE = 'es-VE';

/**
 * Returns YYYY-MM-DD in Venezuela local time (America/Caracas, UTC-4).
 * Prevents after-8PM Caracas transactions from rolling onto tomorrow's UTC date.
 */
export function getCaracasDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: VENEZUELA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    const caracasOffsetMs = -4 * 60 * 60 * 1000;
    return new Date(date.getTime() + caracasOffsetMs).toISOString().split('T')[0];
  }
}

/**
 * Returns yesterday's YYYY-MM-DD in Venezuela local time (America/Caracas).
 */
export function getCaracasYesterdayDateString(date: Date = new Date()): string {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getCaracasDateString(yesterday);
}

/**
 * Returns 'YYYY-MM-DD HH:mm' in Venezuela local time (America/Caracas, UTC-4).
 */
export function getCaracasDateTimeStamp(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: VENEZUELA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const lookup = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value || '';
    const rawHour = lookup('hour');
    const hour = rawHour === '24' ? '00' : rawHour;
    return `${lookup('year')}-${lookup('month')}-${lookup('day')} ${hour}:${lookup('minute')}`;
  } catch {
    const caracasOffsetMs = -4 * 60 * 60 * 1000;
    return new Date(date.getTime() + caracasOffsetMs)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 16);
  }
}

/**
 * Formats a Date or ISO timestamp for display in Venezuela (America/Caracas).
 */
export function formatCaracasDateTime(
  input: Date | string = new Date(),
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(d.getTime())) return 'Hoy';
    return d.toLocaleString(VENEZUELA_LOCALE, {
      timeZone: VENEZUELA_TIMEZONE,
      ...options,
    });
  } catch {
    return 'Hoy';
  }
}

/**
 * Normalizes any Venezuelan mobile/landline format into canonical WhatsApp wa.me digits (58XXXXXXXXXX).
 * Handles: 0414-1234567, 0424..., 0412..., 0416..., 0426..., 0422..., +58 414..., 0058..., 414..., 0212...
 */
export function normalizeVenezuelanPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';

  // Strip international prefix 00
  const stripped = digits.startsWith('00') ? digits.slice(2) : digits;

  // Already has 58 country code
  if (stripped.startsWith('58')) {
    // Handle accidental 580414... -> 58414...
    if (stripped.startsWith('580') && stripped.length >= 12) {
      return `58${stripped.slice(3)}`;
    }
    return stripped;
  }

  // National Venezuelan trunk format 0414..., 0424..., 0412..., 0416..., 0426..., 0422..., 0212...
  if (stripped.startsWith('0') && stripped.length >= 10 && stripped.length <= 11) {
    return `58${stripped.slice(1)}`;
  }

  // 10-digit Venezuelan subscriber without leading 0 (e.g. 4141234567 or 2125551234)
  if (/^(412|414|424|416|426|422|2\d{2})\d{7}$/.test(stripped)) {
    return `58${stripped}`;
  }

  return stripped;
}

/**
 * Formats Bolívares amount consistently in es-VE locale.
 */
export function formatBolivares(amountBs: number): string {
  return `${Number(amountBs || 0).toLocaleString(VENEZUELA_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Bs.`;
}
