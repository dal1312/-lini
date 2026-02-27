// src/ui.ts
// Raccolta di funzioni helper per manipolare l'interfaccia utente
// (status, contatori, errori, animazioni minime, ecc.)

export interface DomElements {
  input: HTMLTextAreaElement;
  output: HTMLTextAreaElement;
  status: HTMLElement;
  progress: HTMLProgressElement;
  inputStats: HTMLElement;
  outputStats: HTMLElement;
  [key: string]: HTMLElement | HTMLInputElement | HTMLSelectElement | HTMLButtonElement;
}

/**
 * Aggiorna il testo del contatore caratteri/parole
 */
export function updateCounters(els: DomElements): void {
  const inputText = els.input.value;
  const outputText = els.output.value;

  const inChars = inputText.length;
  const inWords = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  els.inputStats.textContent = `${inChars} caratteri · ${inWords} parole`;

  const outChars = outputText.length;
  const outWords = outputText.trim() ? outputText.trim().split(/\s+/).length : 0;
  els.outputStats.textContent = `${outChars} caratteri · ${outWords} parole`;
}

/**
 * Aggiorna il messaggio di stato (con icona/colorazione opzionale)
 */
export function updateStatus(
  el: HTMLElement,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  let icon = 'info';
  let color = 'var(--text-dim)';

  switch (type) {
    case 'success':
      icon = 'check_circle';
      color = '#4ade80';
      break;
    case 'warning':
      icon = 'warning';
      color = '#fbbf24';
      break;
    case 'error':
      icon = 'error';
      color = '#f87171';
      break;
  }

  el.innerHTML = `<span style="color:${color}">●</span> ${message}`;
  el.style.color = color;
}

/**
 * Mostra messaggio di errore temporaneo (rosso, sparisce dopo 4s)
 */
export function showError(el: HTMLElement, message: string, timeoutMs = 4000): void {
  updateStatus(el, message, 'error');

  setTimeout(() => {
    if (el.textContent?.includes(message)) {
      updateStatus(el, 'Pronto');
    }
  }, timeoutMs);
}

/**
 * Inizializza comportamenti base dell'interfaccia
 * (swap lingue, tema, immersive mode, ecc.)
 */
export function initUI(els: DomElements): void {
  // Swap lingue
  const swapBtn = document.getElementById('swapLang') as HTMLButtonElement;
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      [els.fromLang.value, els.toLang.value] = [els.toLang.value, els.fromLang.value];
      // Se c'è già output, scambia anche input/output
      if (els.output.value.trim()) {
        [els.input.value, els.output.value] = [els.output.value, els.input.value];
      }
      els.input.dispatchEvent(new Event('input'));
      updateStatus(els.status, 'Lingue invertite');
    });
  }

  // Pulsante pulisci tutto
  els.clearBtn?.addEventListener('click', () => {
    els.input.value = '';
    els.output.value = '';
    updateCounters(els);
    updateStatus(els.status, 'Tutto pulito');
  });

  // Pulsante annulla (visibilità gestita altrove)
  els.abortBtn.hidden = true;

  // Tema chiaro/scuro (opzionale – se vuoi tenerlo)
  const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      localStorage.setItem('npc_theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });
  }

  // Modalità immersiva (nasconde controlli secondari)
  const immersiveToggle = document.getElementById('immersiveToggle') as HTMLButtonElement;
  if (immersiveToggle) {
    immersiveToggle.addEventListener('click', () => {
      document.body.classList.toggle('immersive-mode');
      immersiveToggle.textContent = document.body.classList.contains('immersive-mode') ? '◀' : '▶';
    });
  }

  // Inizializza contatori
  updateCounters(els);
}

/**
 * Helper per copiare testo negli appunti
 */
export async function copyToClipboard(text: string, statusEl?: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    if (statusEl) {
      updateStatus(statusEl, 'Copiato negli appunti ✓', 'success');
      setTimeout(() => updateStatus(statusEl, 'Pronto'), 2200);
    }
  } catch (err) {
    console.error('Errore copia', err);
    if (statusEl) {
      updateStatus(statusEl, 'Impossibile copiare (permesso negato?)', 'error');
    }
  }
}