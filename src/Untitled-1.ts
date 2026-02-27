// src/voice.ts
import { updateStatus } from './ui';

interface VoiceState {
  recognition: SpeechRecognition | null;
  synth: SpeechSynthesis;
  voices: SpeechSynthesisVoice[];
  currentUtterance: SpeechSynthesisUtterance | null;
}

const voiceState: VoiceState = {
  recognition: null,
  synth: window.speechSynthesis,
  voices: [],
  currentUtterance: null,
};

let recognitionActive = false;

// ────────────────────────────────────────────────
// Inizializzazione
// ────────────────────────────────────────────────
export async function initVoiceRecognition(
  micButton: HTMLButtonElement,
  onResult: (text: string) => void
): Promise<void> {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    updateStatus(document.getElementById('status')!, 'Riconoscimento vocale non supportato dal browser', 'error');
    micButton.disabled = true;
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  voiceState.recognition = new SpeechRecognition();

  voiceState.recognition.continuous = false;
  voiceState.recognition.interimResults = true;
  voiceState.recognition.lang = 'it-IT'; // default – può essere cambiato dinamicamente

  voiceState.recognition.onresult = (event: SpeechRecognitionEvent) => {
    const transcript = Array.from(event.results)
      .map(result => result[0])
      .map(result => result.transcript)
      .join('');

    const isFinal = event.results[0].isFinal;

    if (isFinal) {
      onResult(transcript.trim());
      recognitionActive = false;
      micButton.classList.remove('active');
    }
  };

  voiceState.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    console.error('Speech recognition error', event.error);
    updateStatus(document.getElementById('status')!, `Errore dettatura: ${event.error}`, 'error');
    recognitionActive = false;
    micButton.classList.remove('active');
  };

  voiceState.recognition.onend = () => {
    recognitionActive = false;
    micButton.classList.remove('active');
  };

  // Toggle dettatura al click
  micButton.addEventListener('click', () => {
    if (recognitionActive) {
      voiceState.recognition?.stop();
      recognitionActive = false;
      micButton.classList.remove('active');
    } else {
      voiceState.recognition!.start();
      recognitionActive = true;
      micButton.classList.add('active');
      updateStatus(document.getElementById('status')!, 'Ascolto in corso… (parla ora)', 'info');
    }
  });
}

// ────────────────────────────────────────────────
// Sintesi vocale
// ────────────────────────────────────────────────
export function initSpeechSynthesis(): void {
  // Carica voci (asincrono su molti browser)
  if (voiceState.synth.onvoiceschanged !== undefined) {
    voiceState.synth.onvoiceschanged = loadVoices;
  }
  loadVoices(); // tentativo sincrono iniziale
}

function loadVoices(): void {
  voiceState.voices = voiceState.synth.getVoices();

  if (voiceState.voices.length === 0) return;

  const voiceSelect = document.getElementById('voiceSelect') as HTMLSelectElement;
  if (!voiceSelect) return;

  voiceSelect.innerHTML = '';

  // Aggiungiamo una voce di default
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Voce predefinita del sistema';
  voiceSelect.appendChild(defaultOption);

  voiceState.voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — predefinita' : ''}`;
    voiceSelect.appendChild(option);
  });

  // Se c'è una preferenza salvata
  const savedVoiceIndex = localStorage.getItem('npc_voice_index');
  if (savedVoiceIndex) voiceSelect.value = savedVoiceIndex;
}

export function speakText(text: string, lang: string = 'it-IT'): void {
  if (!text.trim()) return;

  // Ferma eventuali riproduzioni precedenti
  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  const rate = Number((document.getElementById('rateSlider') as HTMLInputElement)?.value) || 1;
  const pitch = Number((document.getElementById('pitchSlider') as HTMLInputElement)?.value) || 1;

  utterance.rate = rate;
  utterance.pitch = pitch;

  const voiceSelect = document.getElementById('voiceSelect') as HTMLSelectElement;
  const selectedIndex = voiceSelect?.value;

  if (selectedIndex && voiceState.voices[Number(selectedIndex)]) {
    utterance.voice = voiceState.voices[Number(selectedIndex)];
    localStorage.setItem('npc_voice_index', selectedIndex);
  }

  utterance.onend = () => {
    voiceState.currentUtterance = null;
    updateStatus(document.getElementById('status')!, 'Lettura terminata');
  };

  utterance.onerror = (e) => {
    console.error('Speech synthesis error', e);
    updateStatus(document.getElementById('status')!, 'Errore durante la lettura', 'error');
  };

  voiceState.currentUtterance = utterance;
  voiceState.synth.speak(utterance);
  updateStatus(document.getElementById('status')!, 'Lettura in corso…');
}

export function stopSpeaking(): void {
  if (voiceState.currentUtterance) {
    voiceState.synth.cancel();
    voiceState.currentUtterance = null;
    updateStatus(document.getElementById('status')!, 'Lettura interrotta');
  }
}