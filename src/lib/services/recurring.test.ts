import { describe, expect, it } from 'vitest';
import { nextMonthlyDate } from './recurring';

describe('jadwal bulanan', () => {
  it('menjaga tanggal asal setelah bulan pendek', () => {
    expect(nextMonthlyDate('2026-01-31', 31)).toBe('2026-02-28');
    expect(nextMonthlyDate('2026-02-28', 31)).toBe('2026-03-31');
  });
});
