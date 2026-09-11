import { createWorker, type Worker } from 'tesseract.js';

export interface ParsedReceipt {
  rawText: string;
  merchant: string;
  amount: number;
  date?: string;
  confidence: number;
}

let workerPromise: Promise<Worker> | null = null;

function getWorker(onProgress?: (progress: number) => void) {
  if (!workerPromise) workerPromise = createWorker('eng+ind', 1, { logger: (message) => { if (message.status === 'recognizing text') onProgress?.(Math.round((message.progress || 0) * 100)); } });
  return workerPromise;
}

function normalizeNumber(text: string) {
  return Number(text.replace(/[^0-9]/g, '')) || 0;
}

export async function scanReceipt(file: File, onProgress?: (progress: number) => void): Promise<ParsedReceipt> {
  const worker = await getWorker(onProgress);
  try {
    const image = await optimizeReceiptImage(file);
    const result = await worker.recognize(image);
    return parseReceiptText(result.data.text || '', Math.round(result.data.confidence || 0));
  } catch (error) {
    workerPromise = null;
    await worker.terminate();
    throw error;
  }
}

export function parseReceiptText(text: string, confidence = 0): ParsedReceipt {
    const lines = text.split('\n').map((x) => x.trim()).filter(Boolean);

    const amountCandidates: { amount: number; priority: number }[] = [];
    for (const [index, line] of lines.entries()) {
      if (/grand\s*total|total\s*(bayar|payment)|jumlah\s*(bayar|akhir)/i.test(line)) {
        const matches = line.match(/[\d.,]{3,}/g) || [];
        matches.forEach((m) => amountCandidates.push({ amount: normalizeNumber(m), priority: 3_000 - index }));
      } else if (/\btotal|jumlah|amount/i.test(line) && !/sub\s*total/i.test(line)) {
        const matches = line.match(/[\d.,]{3,}/g) || [];
        matches.forEach((m) => amountCandidates.push({ amount: normalizeNumber(m), priority: 2_000 - index }));
      }
    }
    if (!amountCandidates.length) {
      const matches = text.match(/(?:rp\.?\s*)?[\d.,]{4,}/gi) || [];
      matches.forEach((m) => amountCandidates.push({ amount: normalizeNumber(m), priority: 1_000 }));
    }

    const selected = amountCandidates.sort((a, b) => b.priority - a.priority || b.amount - a.amount)[0];
    const dateMatch = text.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/) || text.match(/\b(\d{1,2}\s+(?:jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)\s+\d{2,4})\b/i);
    return {
      rawText: text,
      merchant: lines[0]?.slice(0, 80) || '',
      amount: selected?.amount || 0,
      date: dateMatch?.[1],
      confidence
    };
}

export async function optimizeReceiptImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
    pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = contrasted;
  }
  context.putImageData(pixels, 0, 0);
  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.86));
}
