// src/history.ts
import { loadHistory, saveToHistory } from './storage';
import { updateStatus } from './ui';

interface HistoryEntry {
  id?: number;
  original: string;
  translated: string;
  from: string;
  to: string;
  timestamp: number;
}

let historyCache: HistoryEntry[] = [];

export async function initHistory(): Promise<void> {
  await reloadHistory();
}

export async function reloadHistory(): Promise<void> {
  historyCache = await loadHistory(30); // ultimi 30 per performance
  renderHistoryList();
}

async function renderHistoryList(): Promise<void> {
  const container = document.getElementById('historyList');
  if (!container) return;

  container.innerHTML = '';

  if (historyCache.length === 0) {
    container.innerHTML = '<li>Nessuna traduzione salvata</li>';
    return;
  }

  historyCache.forEach((entry) => {
    const date = new Date(entry.timestamp).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="history-item">
        <small>${date} • ${entry.from} → ${entry.to}</small>
        <div class="preview">
          ${escapeHTML(entry.original.substring(0, 60))}${entry.original.length > 60 ? '...' : ''}
          <br>↓
          <br>
          ${escapeHTML(entry.translated.substring(0, 60))}${entry.translated.length > 60 ? '...' : ''}
        </div>
      </div>
    `;

    li.addEventListener('click', () => {
      const input = document.getElementById('input') as HTMLTextAreaElement;
      const output = document.getElementById('output') as HTMLTextAreaElement;
      if (input && output) {
        input.value = entry.original;
        output.value = entry.translated;
        input.dispatchEvent(new Event('input'));
        updateStatus(document.getElementById('status')!, 'Traduzione caricata dalla cronologia');
      }
    });

    container.appendChild(li);
  });
}

function escapeHTML(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
}

// Da chiamare dopo ogni traduzione riuscita
export async function addToHistory(
  original: string,
  translated: string,
  from: string,
  to: string
): Promise<void> {
  await saveToHistory(original, translated, from, to);
  await reloadHistory();
}

// Opzionale: pulsante pulisci cronologia
export async function clearHistory(): Promise<void> {
  if (!confirm('Vuoi davvero eliminare tutta la cronologia?')) return;

  const db = await initStorage();
  const tx = db.transaction('history', 'readwrite');
  await tx.objectStore('history').clear();
  await tx.done;

  historyCache = [];
  renderHistoryList();
  updateStatus(document.getElementById('status')!, 'Cronologia azzerata');
}