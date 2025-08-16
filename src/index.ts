/*
  mini-jalali-date
  Lightweight Jalali (Persian) date formatter with zero dependencies.
  - Uses Intl.DateTimeFormat('fa-IR-u-ca-persian') when available
  - Falls back to a precise internal Gregorian -> Jalali conversion
*/

export type Digits = 'fa' | 'en';
export type Format = 'long' | 'short' | 'weekday';

export interface FormatOptions {
  digits?: Digits; // default 'fa'
  format?: Format; // default 'long'
}

const faMonthNames = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const enMonthNames = [
  'Farvardin',
  'Ordibehesht',
  'Khordad',
  'Tir',
  'Mordad',
  'Shahrivar',
  'Mehr',
  'Aban',
  'Azar',
  'Dey',
  'Bahman',
  'Esfand',
] as const;

const faDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

function toFaDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => faDigits[Number(d)]);
}

function toEnDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(faDigits.indexOf(d)));
}

function normalizeToDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  // try ISO or parseable string
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date input');
  }
  return d;
}

function hasIntlPersian(): boolean {
  try {
    const dtf = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    // basic smoke test
    const s = dtf.format(new Date('2020-03-20T00:00:00Z'));
    return typeof s === 'string' && s.length > 0;
  } catch {
    return false;
  }
}

export function getMonthName(jm: number, locale: 'fa' | 'en' = 'fa'): string {
  const idx = jm - 1;
  if (idx < 0 || idx > 11) throw new Error('Invalid Jalali month');
  return locale === 'fa' ? faMonthNames[idx] : enMonthNames[idx];
}

export interface JalaliDateParts { jy: number; jm: number; jd: number }

export function toJalali(input: Date | string | number): JalaliDateParts {
  const d = normalizeToDate(input);
  const gy = d.getUTCFullYear();
  const gm = d.getUTCMonth() + 1; // 1-12
  const gd = d.getUTCDate();
  // Prefer Intl Persian calendar for highest accuracy if available
  if (hasIntlPersian()) {
    const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(d);
    const y = toEnDigits(parts.find(p => p.type === 'year')?.value || '');
    const m = toEnDigits(parts.find(p => p.type === 'month')?.value || '');
    const dd = toEnDigits(parts.find(p => p.type === 'day')?.value || '');
    const jy = Number(y);
    const jm = Number(m);
    const jd = Number(dd);
    if (Number.isFinite(jy) && Number.isFinite(jm) && Number.isFinite(jd)) {
      return { jy, jm, jd };
    }
    // fall through to algorithm if parsing failed
  }
  // Fallback: robust JDN-based conversion
  return d2j(g2d(gy, gm, gd));
}

export function formatJalaliDate(
  input: Date | string | number,
  options: FormatOptions = {}
): string {
  const { digits = 'fa', format = 'long' } = options;
  const date = normalizeToDate(input);

  if (hasIntlPersian()) {
    // Force UTC to keep calendar day stable across environments/timezones
    const intlOptions: Intl.DateTimeFormatOptions =
      format === 'short'
        ? { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }
        : format === 'weekday'
        ? { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }
        : { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };

    const s = new Intl.DateTimeFormat('fa-IR-u-ca-persian', intlOptions).format(date);
    return digits === 'fa' ? s : toEnDigits(s);
  }

  // Fallback path
  const { jy, jm, jd } = toJalali(date);

  if (format === 'short') {
    const out = `${pad(jy, 4)}/${pad(jm, 2)}/${pad(jd, 2)}`;
    return digits === 'fa' ? toFaDigits(out) : out;
  }

  const monthName = getMonthName(jm, 'fa');
  const base = `${jd} ${monthName} ${jy}`;
  // simple weekday support in fallback (Gregorian weekday mapped)
  if (format === 'weekday') {
    const weekdayFa = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
    const w = weekdayFa[date.getUTCDay()];
    const out = `${w} ${base}`;
    return digits === 'fa' ? toFaDigits(out) : toEnDigits(out);
  }
  return digits === 'fa' ? toFaDigits(base) : toEnDigits(base);
}

function pad(n: number, width: number): string {
  const s = String(n);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

// ---- Precise Gregorian <-> Jalali conversion (algorithmic, no deps) ----
// The implementation follows well-known astronomical algorithms using JDN as an intermediate.
// Works for a wide modern range (e.g., years 1600..2500)

function g2j(gy: number, gm: number, gd: number): JalaliDateParts {
  const jdn = gregorianToJdn(gy, gm, gd);
  return jdnToJalali(jdn);
}

function gregorianToJdn(y: number, m: number, d: number): number {
  // Algorithm from astronomical calculations (proleptic Gregorian)
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

function jdnToGregorian(jdn: number): { gy: number; gm: number; gd: number } {
  let j = jdn + 32044;
  const g = Math.floor(j / 146097);
  j %= 146097;
  const dg = Math.floor(j / 36524);
  j %= 36524;
  const c = Math.floor((dg + 1) * 3 / 4);
  j = j - c * 36524;
  const b = Math.floor(j / 1461);
  j %= 1461;
  const db = Math.floor(j / 365);
  const a = Math.floor((db + 1) * 3 / 4);
  const y = b * 4 + a;
  const day = j - a * 365 + 1;
  const m = Math.floor((5 * day - 3) / 153);
  const d = day - Math.floor((153 * m + 3) / 5);
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = y - 4800 + Math.floor(m / 10);
  return { gy: year, gm: month, gd: d };
}

function jalaliToJdn(jy: number, jm: number, jd: number): number {
  // Based on the algorithmic cycle of 2820 years
  jy = jy - (jy >= 0 ? 474 : 473);
  const cycle = mod(jy, 2820);
  const jdn = jd
    + (jm <= 7 ? (jm - 1) * 31 : (6 * 31 + (jm - 7) * 30))
    + Math.floor((cycle * 682 - 110) / 2816)
    + (cycle - 1) * 365
    + 1948320.5 - 1; // epoch of Jalali (March 19, 622 Julian)
  return Math.floor(jdn);
}

function jdnToJalali(jdn: number): JalaliDateParts {
  const { gy, gm, gd } = jdnToGregorian(jdn);
  const { jy } = gyToJalaliYear(gy, gm, gd);
  const jalaliNewYearJdn = jalaliNewYear(jy);
  let dayOfYear = jdn - jalaliNewYearJdn + 1;
  let jm: number, jd: number;
  if (dayOfYear <= 186) {
    jm = Math.ceil(dayOfYear / 31);
    jd = mod(dayOfYear - (jm - 1) * 31, 31);
    if (jd === 0) jd = 31;
  } else {
    dayOfYear -= 186;
    jm = Math.ceil(dayOfYear / 30) + 6;
    jd = mod(dayOfYear - (jm - 7) * 30, 30);
    if (jd === 0) jd = 30;
  }
  return { jy, jm, jd };
}

function gyToJalaliYear(gy: number, gm: number, gd: number): { jy: number } {
  const gJdn = gregorianToJdn(gy, gm, gd);
  let jy = gy - 621;
  const marchJdn = jalaliNewYear(jy);
  if (gJdn >= marchJdn) return { jy };
  return { jy: jy - 1 };
}

function jalaliNewYear(jy: number): number {
  // Computes JDN of Farvardin 1 for Jalali year jy
  const gy = jy + 621;
  const march = marchDay(jy);
  return gregorianToJdn(gy, 3, march);
}

function marchDay(jy: number): number {
  // Deterministic calculation of the March day of Nowruz for year jy
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let bl = breaks.length;
  let gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm: number, jump: number;
  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += Math.floor(jump / 33) * 8 + Math.floor(mod(jump, 33) / 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += Math.floor(n / 33) * 8 + Math.floor(mod(n, 33) + 3) / 4;
  if (mod(jump!, 33) === 4 && jump! - n === 4) leapJ += 1;
  const leapG = Math.floor(gy / 4) - Math.floor((Math.floor(gy / 100) + 1) * 3 / 4) - 150;
  const march = 20 + leapJ - leapG;
  return march;
}

function mod(a: number, b: number): number { return a - b * Math.floor(a / b); }

// ---- Robust JDN-based conversion helpers (lightweight, no deps) ----
function div(a: number, b: number): number { return Math.trunc(a / b); }

function g2d(gy: number, gm: number, gd: number): number {
  // Gregorian date to JDN
  const a = div(14 - gm, 12);
  gy = gy + 4800 - a;
  gm = gm + 12 * a - 3;
  return gd + div(153 * gm + 2, 5) + 365 * gy + div(gy, 4) - div(gy, 100) + div(gy, 400) - 32045;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  // JDN to Gregorian date
  let a = jdn + 32044;
  const b = div(4 * a + 3, 146097);
  a = a - div(146097 * b, 4);
  const c = div(4 * a + 3, 1461);
  a = a - div(1461 * c, 4);
  const d = div(5 * a + 2, 153);
  const day = a - div(153 * d + 2, 5) + 1;
  const month = d + 3 - 12 * div(d, 10);
  const year = 100 * b + c - 4800 + div(d, 10);
  return { gy: year, gm: month, gd: day };
}

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  // Calculates leap status and March day of Farvardin 1 for Jalali year
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let bl = breaks.length;
  let gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < bl; i++) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div(div(gy, 100) + 1, 25) - 150;
  const march = 20 + leapJ - leapG;
  const leap = (mod(n + 1, 33) - 1) % 4;
  return { leap, gy, march };
}

function j2d(jy: number, jm: number, jd: number): number {
  // Jalali date to JDN
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDateParts {
  // JDN to Jalali date
  const g = d2g(jdn);
  let jy = g.gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(g.gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm: number;
  let jd: number;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    const r2 = jalCal(jy);
    k += 179 + (r2.leap === 1 ? 1 : 0);
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}
