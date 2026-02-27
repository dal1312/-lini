// src/glossary.ts
import { initStorage, saveToGlossary, loadGlossary } from './storage';
import { updateStatus } from './ui';

interface GlossaryEntry {
  id?: number;
  term: string;
  translation: string;
  targetLang: string;
}

let glossaryCache: GlossaryEntry[] = [];

export async function initGlossary(): Promise<void> {
  await initStorage();
  await reloadGlossary();
}

export async function reloadGlossary(): Promise<void> {
  glossaryCache = await loadGlossary();
  renderGlossaryList();
}

async function renderGlossaryList(): Promise<void> {
  const container = document.getElementById('glossaryList');
  if (!container) return;

  container.innerHTML = '';

  if (glossaryCache.length === 0) {
    container.innerHTML = '<li>Nessun termine nel glossario</li>';
    return;
  }

  glossaryCache.forEach((entry) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${escapeHTML(entry.term)}</strong> →
      ${escapeHTML(entry.translation)}
      <span style="color: #888; font-size: 0.85em;">(${entry.targetLang})</span>
      <button data-action="edit" data-id="${entry.id}">✏️</button>
      <button data-action="delete" data-id="${entry.id}">🗑️</button>
    `;
    container.appendChild(li);
  });

  // Delegazione eventi
  container.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    const id = Number(target.dataset.id);

    if (!action || isNaN(id)) return;

    if (action === 'delete') {
      if (!confirm('Vuoi davvero eliminare questo termine?')) return;
      await deleteGlossaryEntry(id);
      await reloadGlossary();
      updateStatus(document.getElementById('status')!, 'Termine eliminato');
    } else if (action === 'edit') {
      openEditGlossaryDialog(id);
    }
  });
}

function escapeHTML(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
}

async function deleteGlossaryEntry(id: number): Promise<void> {
  const db = await initStorage();
  const tx = db.transaction('glossary', 'readwrite');
  await tx.objectStore('glossary').delete(id);
  await tx.done;
}

function openEditGlossaryDialog(id?: number): void {
  const dialog = document.getElementById('glossaryDialog') as HTMLDialogElement;
  if (!dialog) return;

  const content = document.getElementById('glossaryContent');
  if (!content) return;

  let entry: GlossaryEntry | undefined;
  if (id) {
    entry = glossaryCache.find(e => e.id === id);
  }

  content.innerHTML = `
    <label>Termine:
      <input type="text" id="glossTerm" value="${entry?.term || ''}">
    </label>
    <label>Traduzione:
      <input type="text" id="glossTranslation" value="${entry?.translation || ''}">
    </label>
    <label>Lingua destinazione:
      <input type="text" id="glossLang" value="${entry?.targetLang || 'it'}" placeholder="es: it, en, fr">
    </label>
    <button id="saveGlossBtn">${id ? 'Aggiorna' : 'Aggiungi'}</button>
  `;

  dialog.showModal();

  document.getElementById('saveGlossBtn')?.addEventListener('click', async () => {
    const term = (document.getElementById('glossTerm') as HTMLInputElement).value.trim();
    const translation = (document.getElementById('glossTranslation') as HTMLInputElement).value.trim();
    const lang = (document.getElementById('glossLang') as HTMLInputElement).value.trim();

    if (!term || !translation || !lang) {
      alert('Tutti i campi sono obbligatori');
      return;
    }

    if (id) {
      // update
      const db = await initStorage();
      const tx = db.transaction('glossary', 'readwrite');
      await tx.objectStore('glossary').put({ id, term, translation, targetLang: lang });
      await tx.done;
    } else {
      await saveToGlossary({ term, translation, targetLang: lang });
    }

    dialog.close();
    await reloadGlossary();
    updateStatus(document.getElementById('status')!, 'Glossario aggiornato');
  });
}

// Da chiamare quando si vuole applicare il glossario al testo tradotto
export async function applyGlossary(text: string, targetLang: string): Promise<string> {
  const entries = await loadGlossary(targetLang);
  let result = text;

  for (const entry of entries) {
    const regex = new RegExp(`\\b${escapeRegExp(entry.term)}\\b`, 'gi');
    result = result.replace(regex, entry.translation);
  }

  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}