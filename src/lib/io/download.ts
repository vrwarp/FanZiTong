/** Trigger a client-side file download of a blob. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trigger a client-side file download of text content. */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  downloadBlob(filename, new Blob([content], { type: `${mimeType};charset=utf-8` }));
}

/**
 * Gzip text with the browser's own CompressionStream. Null where the browser
 * has none, so the caller can fall back to the plain file.
 */
export async function gzipText(content: string): Promise<Blob | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const input = new Response(content).body;
  if (!input) return null;
  const compressed = await new Response(
    input.pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  return new Blob([compressed], { type: 'application/gzip' });
}

export function timestampForFilename(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}
