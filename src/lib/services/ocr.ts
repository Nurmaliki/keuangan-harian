import { createWorker } from 'tesseract.js';

export interface ParsedReceipt {
  rawText: string;
  merchant: string;
  amount: number;
  date?: string;
}

function normalizeNumber(text: string) {
  return Number(text.replace(/[^0-9]/g, '')) || 0;
}

export async function scanReceipt(file: File, onProgress?: (progress: number) => void): Promise<ParsedReceipt> {
  const worker = await createWorker('eng+ind', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round((m.progress || 0) * 100));
    }
  });

  try {
    const result = await worker.recognize(file);
    const text = result.data.text || '';
    const lines = text.split('\n').map((x) => x.trim()).filter(Boolean);

    const amountCandidates: number[] = [];
    for (const line of lines) {
      if (/total|grand total|jumlah|amount/i.test(line)) {
        const matches = line.match(/[\d.,]{3,}/g) || [];
        matches.forEach((m) => amountCandidates.push(normalizeNumber(m)));
      }
    }
    if (!amountCandidates.length) {
      const matches = text.match(/(?:rp\.?\s*)?[\d.,]{4,}/gi) || [];
      matches.forEach((m) => amountCandidates.push(normalizeNumber(m)));
    }

    const dateMatch = text.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/);
    return {
      rawText: text,
      merchant: lines[0]?.slice(0, 80) || '',
      amount: Math.max(...amountCandidates, 0),
      date: dateMatch?.[1]
    };
  } finally {
    await worker.terminate();
  }
}
