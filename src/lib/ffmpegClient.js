'use client';

let ffmpegInstance = null;
let loadPromise = null;
let activeProgressCallback = null;

const CORE_CDNS = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
];

/**
 * Lazily loads single-threaded FFmpeg.wasm with CDN fallback and a single
 * reusable progress listener so switching tools never leaks callbacks.
 */
export async function getFFmpeg(onProgress) {
  activeProgressCallback = typeof onProgress === 'function' ? onProgress : null;

  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ]);

      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }) => {
        if (activeProgressCallback && Number.isFinite(progress)) {
          activeProgressCallback(Math.max(0, Math.min(100, Math.round(progress * 100))));
        }
      });

      let lastErr = null;
      for (const baseURL of CORE_CDNS) {
        try {
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
          ffmpegInstance = ffmpeg;
          return ffmpeg;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error('Failed to load FFmpeg WebAssembly core');
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }

  return loadPromise;
}

export function clearFFmpegProgress() {
  activeProgressCallback = null;
}

export async function fileToUint8Array(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Safely copies FFmpeg readFile output into an isolated Blob so Shared/WASM
 * heap buffers never leak extra trailing bytes.
 */
export function uint8ToBlob(data, mimeType) {
  const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data.buffer || data);
  return new Blob([bytes], { type: mimeType });
}
