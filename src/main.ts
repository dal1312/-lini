import { initUI, updateStatus, updateCounters, showError } from './ui';
import { translateText, abortCurrentTranslation } from './translator';
import { handleFiles, handleDrop, handleDragOver } from './file-handlers';
import { initVoiceRecognition, initSpeechSynthesis, speakText, stopSpeaking } from './voice';
import { initStorage, saveToHistory, loadHistory, saveToGlossary, loadGlossary } from './storage';
import { copyToClipboard } from './utils'; // helper semplice, lo puoi creare tu

// ────────────────────────────────────────────────
// Stato globale minimale (in produzione → Zustand / nanostores / signal)
let state = {
  isTranslating: false,
  liveTranslateEnabled: false,
  autoFileTranslate: false,
  abortController: null as AbortController | null,
  liveTimeout: null as NodeJS.Timeout | null,
};

// ────────────────────────────────────────────────
// Elementi DOM (cache iniziale)
const els = {
  input: document.getElementById('input') as HTMLTextAreaElement,
  output: document.getElementById('output') as HTMLTextAreaElement,
  fromLang: document.getElementById('fromLang') as HTMLSelectElement,
  toLang: document.getElementById('toLang') as HTMLSelectElement,
  translateBtn: document.getElementById('translateBtn') as HTMLButtonElement,
  abortBtn: document.getElementById('abortBtn') as HTMLButtonElement,
  clearBtn: document.getElementById('clearBtn') as HTMLButtonElement,
  liveCheckbox: document.getElementById('liveTranslate') as HTMLInputElement,
  autoFileCheckbox: document.getElementById('autoFileTranslate') as HTMLInputElement,
  micBtn: document.getElementById('micBtn') as HTMLButtonElement,
  ocrBtn: document.getElementById('ocrBtn') as HTMLButtonElement,
  speakBtn: document.getElementById('speakBtn') as HTMLButtonElement,
  stopSpeakBtn: document.getElementById('stopSpeakBtn') as HTMLButtonElement,
  copyBtn: document.getElementById('copyBtn') as HTMLButtonElement,
  dropZone: document.getElementById('dropZone') as HTMLDivElement,
  fileInput: document.getElementById('fileInput') as HTMLInputElement,
  progress: document.getElementById('progress') as HTMLProgressElement,
  status: document.getElementById('status') as HTMLDivElement,
};

// ────────────────────────────────────────────────
async function initApp() {
  // 1. Inizializza storage (IndexedDB)
  await initStorage();

  // 2. Carica preferenze salvate
  loadPreferences();

  // 3. Collega eventi UI di base
  initUI(els);

  // 4. Inizializza moduli voice
  await initVoiceRecognition(els.micBtn, (text: string) => {
    els.input.value += (els.input.value ? ' ' : '') + text;
    updateCounters(els);
    if (state.liveTranslateEnabled) triggerLiveTranslate();
  });

  initSpeechSynthesis();

  // 5. Event listeners principali

  // Traduci
  els.translateBtn.addEventListener('click', async () => {
    if (state.isTranslating) return;
    await performTranslation();
  });

  // Annulla
  els.abortBtn.addEventListener('click', () => {
    abortCurrentTranslation();
    state.isTranslating = false;
    els.abortBtn.hidden = true;
    els.translateBtn.disabled = false;
    updateStatus(els.status, 'Traduzione annullata', 'warning');
  });

  // Live translate toggle
  els.liveCheckbox.addEventListener('change', () => {
    state.liveTranslateEnabled = els.liveCheckbox.checked;
    localStorage.setItem('npc_live', String(state.liveTranslateEnabled));
  });

  // Auto traduci file toggle
  els.autoFileCheckbox.addEventListener('change', () => {
    state.autoFileTranslate = els.autoFileCheckbox.checked;
    localStorage.setItem('npc_auto_file', String(state.autoFileTranslate));
  });

  // Input change → live translate + autosave draft
  els.input.addEventListener('input', () => {
    updateCounters(els);
    if (state.liveTranslateEnabled) {
      clearTimeout(state.liveTimeout!);
      state.liveTimeout = setTimeout(triggerLiveTranslate, 900);
    }
    debounceSaveDraft(els.input.value);
  });

  // Pulsanti voice
  els.speakBtn.addEventListener('click', () => speakText(els.output.value, els.toLang.value));
  els.stopSpeakBtn.addEventListener('click', stopSpeaking);
  els.copyBtn.addEventListener('click', () => copyToClipboard(els.output.value, els.status));

  // File drop & click
  els.dropZone.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (e) => handleFiles(e, els, state.autoFileTranslate, afterFileLoad));
  els.dropZone.addEventListener('dragover', handleDragOver);
  els.dropZone.addEventListener('drop', (e) => handleDrop(e, els, state.autoFileTranslate, afterFileLoad));

  // Pulisci tutto
  els.clearBtn.addEventListener('click', () => {
    els.input.value = '';
    els.output.value = '';
    updateCounters(els);
    updateStatus(els.status, 'Area pulita');
  });

  // Avvio
  updateStatus(els.status, 'Applicazione caricata ✓');
  loadHistoryIntoUI(); // da implementare in history.ts
  loadGlossaryIntoUI(); // da implementare
}

// ────────────────────────────────────────────────
async function performTranslation() {
  const text = els.input.value.trim();
  if (!text) {
    showError(els.status, 'Inserire del testo da tradurre');
    return;
  }

  state.isTranslating = true;
  els.translateBtn.disabled = true;
  els.abortBtn.hidden = false;
  updateStatus(els.status, 'Traduzione in corso…');

  try {
    const result = await translateText(
      text,
      els.fromLang.value,
      els.toLang.value,
      (progress: number) => {
        els.progress.value = progress;
        els.progress.hidden = progress >= 100;
      }
    );

    els.output.value = result;
    updateCounters(els);
    saveToHistory(text, result, els.fromLang.value, els.toLang.value);
    updateStatus(els.status, 'Traduzione completata', 'success');
  } catch (err: any) {
    if (err.name === 'AbortError') {
      updateStatus(els.status, 'Traduzione interrotta', 'warning');
    } else {
      showError(els.status, err.message || 'Errore durante la traduzione');
    }
  } finally {
    state.isTranslating = false;
    els.translateBtn.disabled = false;
    els.abortBtn.hidden = true;
    els.progress.hidden = true;
  }
}

// ────────────────────────────────────────────────
function triggerLiveTranslate() {
  if (!state.liveTranslateEnabled || state.isTranslating) return;
  performTranslation();
}

// ────────────────────────────────────────────────
function afterFileLoad() {
  if (state.autoFileTranslate && els.input.value.trim()) {
    performTranslation();
  }
}

// ────────────────────────────────────────────────
function loadPreferences() {
  els.liveCheckbox.checked = localStorage.getItem('npc_live') === 'true';
  els.autoFileCheckbox.checked = localStorage.getItem('npc_auto_file') === 'true';
  state.liveTranslateEnabled = els.liveCheckbox.checked;
  state.autoFileTranslate = els.autoFileCheckbox.checked;

  const draft = localStorage.getItem('npc_draft');
  if (draft) els.input.value = draft;
}

// ────────────────────────────────────────────────
function debounceSaveDraft(text: string) {
  clearTimeout(window.debounceDraftTimer);
  window.debounceDraftTimer = setTimeout(() => {
    localStorage.setItem('npc_draft', text);
  }, 1800);
}

// Polyfill per timer globale (opzionale)
declare global {
  interface Window {
    debounceDraftTimer?: NodeJS.Timeout;
  }
}

// Avvia tutto
document.addEventListener('DOMContentLoaded', initApp);