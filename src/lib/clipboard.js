'use client';

async function convertBlobToPng(blob) {
  if (blob.type === 'image/png') return blob;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 1;
    canvas.height = img.naturalHeight || 1;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) throw new Error('PNG conversion failed');
    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Copies an image Blob to the OS clipboard as PNG using the Async Clipboard API.
 * Never throws; always returns { ok: true } or { ok: false, reason: string }.
 */
export async function copyImageBlobToClipboard(blob) {
  if (!blob) {
    return { ok: false, reason: 'No image available to copy yet.' };
  }

  if (
    typeof window === 'undefined' ||
    !navigator?.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof window.ClipboardItem === 'undefined'
  ) {
    return {
      ok: false,
      reason:
        'Image clipboard copy is not supported in this browser or context. Please use the Download button instead.',
    };
  }

  try {
    const pngBlob = await convertBlobToPng(blob);
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngBlob })]);
    return { ok: true };
  } catch (err) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return {
        ok: false,
        reason:
          'Clipboard access was blocked by your browser permissions. Allow clipboard access or use Download instead.',
      };
    }
    return {
      ok: false,
      reason: 'Could not copy image to clipboard in this browser. Please use the Download button instead.',
    };
  }
}
