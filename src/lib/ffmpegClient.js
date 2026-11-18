'use client';

let ffmpegInstance = null;
let loadPromise = null;

/**
 * Lazily loads single-threaded FFmpeg.wasm from jsDelivr/unpkg so it works cleanly
 * in all browsers without requiring SharedArrayBuffer COOP/COEP headers.
 */
export async function getFFmpeg(onProgress) {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    if (onProgress) {
      ffmpegInstance.on('progress', ({ progress }) => {
        if (Number.isFinite(progress)) {
          onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
        }
      });
    }
    return ffmpegInstance;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ]);

      const ffmpeg = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

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

  const ffmpeg = await loadPromise;
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      if (Number.isFinite(progress)) {
        onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
      }
    });
  }
  return ffmpeg;
}

export async function fileToUint8Array(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}
