# mini-jalali-date

Lightweight, dependency-free Jalali (Persian) date formatter for JS/TS/React/Next.

- Zero dependencies
- ESM + CJS, TypeScript types
- Uses Intl Persian calendar when available, falls back to precise algorithm

## Install

```bash
npm i mini-jalali-date
```

## Usage

```ts
import { formatJalaliDate, toJalali, getMonthName } from 'mini-jalali-date';

formatJalaliDate('2025-08-16');
// => "۲۵ مرداد ۱۴۰۴"

formatJalaliDate('2025-08-16', { format: 'short', digits: 'en' });
// => "1404/05/25"

const { jy, jm, jd } = toJalali('2025-08-16');
// => { jy: 1404, jm: 5, jd: 25 }

getMonthName(5); // => "مرداد"
```

## API

- `formatJalaliDate(input, options?) => string`
  - `input: Date | string | number`
  - `options.digits`: `'fa' | 'en'` (default `'fa'`)
  - `options.format`: `'long' | 'short' | 'weekday'` (default `'long'`)
- `toJalali(input) => { jy, jm, jd }`
- `getMonthName(jm, locale='fa')`

## Compatibility

- Browser modern + Node >= 16
- Uses `Intl.DateTimeFormat('fa-IR-u-ca-persian')` if available; otherwise uses internal fallback.

## License

MIT
