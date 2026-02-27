interface HistoryEntry {
  id?: number;
  original: string;
  translated: string;
  from: string;
  to: string;
  timestamp: number;
}

interface GlossaryEntry {
  id?: number;
  term: string;
  translation: string;
  targetLang: string;
}

const DB_NAME = 'NPCTranslator';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export async function initStorage() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);

    req.onsuccess = () => resolve(req.result);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('history')) {
        const store = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('glossary')) {
        const store = db.createObjectStore('glossary', { keyPath: 'id', autoIncrement: true });
        store.createIndex('targetLang', 'targetLang', { unique: false });
        store.createIndex('term', 'term');
      }
    };
  });

  return dbPromise;
}

export async function saveToHistory(
  original: string,
  translated: string,
  from: string,
  to: string
): Promise<void> {
  const db = await initStorage();
  const tx = db.transaction('history', 'readwrite');
  const store = tx.objectStore('history');
  await store.add({
    original,
    translated,
    from,
    to,
    timestamp: Date.now(),
  });
  await tx.done;
}

export async function loadHistory(limit = 50): Promise<HistoryEntry[]> {
  const db = await initStorage();
  const tx = db.transaction('history', 'readonly');
  const store = tx.objectStore('history');
  const req = store.index('timestamp').getAll(undefined, limit);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result.reverse());
    req.onerror = () => reject(req.error);
  });
}

// ────────────────────────────────────────────────
// Glossario (implementazione simile – semplificata qui)

export async function saveToGlossary(entry: Omit<GlossaryEntry, 'id'>): Promise<void> {
  const db = await initStorage();
  const tx = db.transaction('glossary', 'readwrite');
  tx.objectStore('glossary').add(entry);
  await tx.done;
}

export async function loadGlossary(lang?: string): Promise<GlossaryEntry[]> {
  const db = await initStorage();
  const tx = db.transaction('glossary', 'readonly');
  const store = tx.objectStore('glossary');

  if (lang) {
    const idx = store.index('targetLang');
    return new Promise((r) => {
      const req = idx.getAll(lang);
      req.onsuccess = () => r(req.result);
    });
  }

  const req = store.getAll();
  return new Promise((r) => {
    req.onsuccess = () => r(req.result);
  });
}

// Nota: aggiungere delete, update, search...