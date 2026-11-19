'use client';

let ffmpegInstance = null;
let loadPromise = null;
let activeProgressCallback = null;

/**
 * Lazily loads single-threaded FFmpeg.wasm self-hosted directly from the app's
 * own origin (/ffmpeg/) and provides a single reusable progress listener so
 * switching tools never leaks callbacks.
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

      // Self-hosted from same origin under /ffmpeg/
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const baseURL = `${origin}/ffmpeg`;

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      ffmpegInstance = ffmpeg;
      return ffmpeg;
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
