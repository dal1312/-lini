type TranslationProvider = 'google' | 'mymemory' | 'lingva';

interface TranslationOptions {
  onProgress?: (percent: number) => void;
}

const MAX_CHUNK_SIZE = 1400;

export async function translateText(
  text: string,
  from: string,
  to: string,
  options: TranslationOptions = {}
): Promise<string> {
  if (text.length === 0) return '';

  const chunks = splitIntoChunks(text, MAX_CHUNK_SIZE);
  let result = '';

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    let translated: string;

    try {
      translated = await tryProvidersInOrder(chunk, from, to);
    } catch (err) {
      throw new Error(`Tutti i provider hanno fallito: ${(err as Error).message}`);
    }

    result += translated + (i < chunks.length - 1 ? ' ' : '');

    if (options.onProgress) {
      options.onProgress(((i + 1) / chunks.length) * 100);
    }

    // Piccola pausa per non sovraccaricare
    await new Promise(r => setTimeout(r, 400));
  }

  return result.trim();
}

function splitIntoChunks(text: string, max: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + max;
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }
    // Cerca di non spezzare parole a metà
    while (end > start && !/\s/.test(text[end])) end--;
    if (end === start) end = start + max; // fallback
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

const providers: TranslationProvider[] = ['google', 'mymemory', 'lingva'];

async function tryProvidersInOrder(
  text: string,
  from: string,
  to: string
): Promise<string> {
  const sl = from === 'auto' ? 'auto' : from;
  const tl = to;

  for (const provider of providers) {
    try {
      switch (provider) {
        case 'google':
          return await googleTranslate(sl, tl, text);
        case 'mymemory':
          return await mymemoryTranslate(sl, tl, text);
        case 'lingva':
          return await lingvaTranslate(sl, tl, text);
      }
    } catch (e) {
      console.warn(`Provider ${provider} fallito:`, e);
      // continua con il prossimo
    }
  }

  throw new Error('Nessun provider disponibile');
}

// ────────────────────────────────────────────────
async function googleTranslate(sl: string, tl: string, q: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error('Google Translate HTTP ' + res.status);
  const json = await res.json();
  return json[0].map((x: any[]) => x[0]).join('');
}

async function mymemoryTranslate(sl: string, tl: string, q: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${sl}|${tl}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error('MyMemory HTTP ' + res.status);
  const json = await res.json();
  return json.responseData.translatedText;
}

async function lingvaTranslate(sl: string, tl: string, q: string): Promise<string> {
  const url = `https://lingva.ml/api/v1/${sl}/${tl}/${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error('Lingva HTTP ' + res.status);
  const json = await res.json();
  return json.translation;
}

// ────────────────────────────────────────────────
let currentAbortController: AbortController | null = null;

export function abortCurrentTranslation() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

// Nota: in performTranslation devi impostare currentAbortController = new AbortController();
// e passarlo alle fetch