import { updateStatus } from './ui';

type FileHandlerResult = { text: string; filename: string } | { error: string };

export async function handleFiles(
  e: Event,
  dom: any,
  autoTranslate: boolean,
  afterLoadCallback: () => void
) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;

  updateStatus(dom.status, `Caricamento di ${input.files.length} file…`);

  for (const file of Array.from(input.files)) {
    try {
      const result = await processSingleFile(file);
      if ('error' in result) {
        updateStatus(dom.status, `Errore ${file.name}: ${result.error}`, 'error');
        continue;
      }
      dom.input.value += `\n\n[${file.name}]\n${result.text}`;
    } catch (err) {
      updateStatus(dom.status, `Fallito ${file.name}: ${(err as Error).message}`, 'error');
    }
  }

  dom.input.dispatchEvent(new Event('input'));
  afterLoadCallback();
}

export function handleDrop(
  e: DragEvent,
  dom: any,
  autoTranslate: boolean,
  afterLoadCallback: () => void
) {
  e.preventDefault();
  dom.dropZone.classList.remove('dragover');

  const items = e.dataTransfer?.items;
  if (!items) return;

  const promises: Promise<void>[] = [];

  for (const item of items) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        promises.push(processEntry(entry, dom.input));
      } else {
        const file = item.getAsFile();
        if (file) promises.push(processFile(file, dom.input));
      }
    }
  }

  Promise.all(promises).then(() => {
    dom.input.dispatchEvent(new Event('input'));
    afterLoadCallback();
  });
}

export function handleDragOver(e: DragEvent) {
  e.preventDefault();
  (e.currentTarget as HTMLElement).classList.add('dragover');
}

// ────────────────────────────────────────────────
async function processEntry(entry: FileSystemEntry, target: HTMLTextAreaElement) {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) => (entry as FileSystemFileEntry).file(resolve));
    await processFile(file, target);
  } else if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve) =>
      dirReader.readEntries(resolve)
    );
    for (const sub of entries) {
      await processEntry(sub, target);
    }
  }
}

async function processFile(file: File, target: HTMLTextAreaElement) {
  const result = await processSingleFile(file);
  if ('error' in result) {
    console.warn(result.error);
    return;
  }
  target.value += `\n\n[${file.name}]\n${result.text}`;
}

// ────────────────────────────────────────────────
async function processSingleFile(file: File): Promise<FileHandlerResult> {
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith('.txt')) {
      return { text: await file.text(), filename: file.name };
    }

    if (name.endsWith('.pdf')) {
      const { getPDFText } = await import('./pdf-reader'); // lazy
      const text = await getPDFText(file);
      return { text, filename: file.name };
    }

    if (name.endsWith('.docx')) {
      const { getDOCXText } = await import('./docx-reader'); // lazy
      const text = await getDOCXText(file);
      return { text, filename: file.name };
    }

    if (/\.(jpe?g|png|webp|bmp)$/i.test(name)) {
      const { ocrImage } = await import('./ocr'); // lazy
      const text = await ocrImage(file);
      return { text, filename: file.name };
    }

    return { error: 'Formato non supportato' };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { error: errorMessage };
  }
}