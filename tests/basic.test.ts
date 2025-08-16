import { describe, it, expect } from 'vitest';
import { formatJalaliDate, toJalali } from '../src/index';

describe('mini-jalali-date', () => {
  it('formats ISO date to long fa by default', () => {
    const out = formatJalaliDate('2025-08-16');
    expect(out).toMatch(/مرداد/);
  });

  it('returns expected jalali parts for 2025-08-16 (UTC)', () => {
    const { jy, jm, jd } = toJalali('2025-08-16T00:00:00Z');
    expect(jy).toBe(1404);
    expect(jm).toBe(5); // Mordad
    expect(jd).toBeGreaterThanOrEqual(1);
  });

  it('supports short format and en digits', () => {
    const out = formatJalaliDate('2025-08-16', { format: 'short', digits: 'en' });
    expect(out).toMatch(/1404\/0?5\//);
  });
});
