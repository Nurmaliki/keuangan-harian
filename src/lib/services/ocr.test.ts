import { describe, expect, it } from 'vitest';
import { parseReceiptText } from './ocr';

describe('receipt parser', () => {
  it('memprioritaskan grand total di atas subtotal', () => {
    const result = parseReceiptText('TOKO MAJU\nSubtotal Rp 90.000\nGrand Total Rp 99.000\n11/09/2026', 88);
    expect(result.amount).toBe(99_000); expect(result.merchant).toBe('TOKO MAJU'); expect(result.date).toBe('11/09/2026'); expect(result.confidence).toBe(88);
  });
  it('mendukung tanggal Indonesia berbentuk nama bulan', () => { expect(parseReceiptText('TOKO\nTotal 25.000\n11 September 2026').date).toBe('11 September 2026'); });
});
