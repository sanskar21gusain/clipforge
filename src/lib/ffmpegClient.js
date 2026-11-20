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
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFMPEG]', message);
      });
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

/**
 * Hard-terminates any running FFmpeg Web Worker instance to immediately abort
 * executing processes and release WebAssembly linear memory back to the browser.
 */
export async function terminateFFmpeg() {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate();
    } catch (_) {}
    ffmpegInstance = null;
  }
  loadPromise = null;
  activeProgressCallback = null;
}

/**
 * Probes the input video container and video streams using FFmpeg's built-in
 * demuxer. Returns:
 * - null: Keep source framerate (valid source <= 60 fps e.g. 24, 25, 30, 48, 50, 60 fps).
 * - 60: Clamp to 60 fps if source framerate exceeds 60 fps (e.g. 120 or 240 fps).
 * - 30: Clamp to 30 fps if framerate is missing, invalid (<= 0), or if 1000 tbr / 1k tbn
 *   WebM container timebase anomaly is detected.
 */
export async function probeVideoFramerate(ffmpeg, inputName) {
  let logText = '';
  const captureHandler = ({ message }) => {
    if (typeof message === 'string') {
      logText += message + '\n';
    }
  };

  ffmpeg.on('log', captureHandler);
  try {
    // Executing with just -i probes the container and stream headers
    await ffmpeg.exec(['-i', inputName]);
  } catch (_) {
    // Exit code 1 is expected because no output file was specified
  } finally {
    ffmpeg.off('log', captureHandler);
  }

  // Parse video stream line
  const lines = logText.split('\n');
  const videoLine = lines.find((l) => l.includes('Video:')) || '';

  // Extract fps (e.g. "24 fps", "29.97 fps", "60 fps")
  const fpsMatch = videoLine.match(/([\d.]+)\s*fps/i);
  const parsedFps = fpsMatch ? parseFloat(fpsMatch[1]) : null;

  // Extract tbr (e.g. "24 tbr", "1000 tbr", "1k tbr")
  const tbrMatch = videoLine.match(/([\d.]+|1k)\s*tbr/i);
  const tbrStr = tbrMatch ? tbrMatch[1].toLowerCase() : '';
  const is1kTbr = tbrStr === '1k' || (parseFloat(tbrStr) >= 900 && parseFloat(tbrStr) <= 1100);

  // Check 1k tbn (common 1000 Hz container timebase in WebM)
  const is1kTbn = videoLine.includes('1k tbn') || videoLine.includes('1000 tbn');

  // Case 1: 1000 tbr WebM anomaly (e.g. Chrome MediaRecorder recording without constant fps)
  if (is1kTbr || (is1kTbn && (!parsedFps || parsedFps > 60 || Number.isNaN(parsedFps)))) {
    return 30;
  }

  // Case 2: Missing or invalid framerate
  if (!parsedFps || Number.isNaN(parsedFps) || parsedFps <= 0) {
    return 30;
  }

  // Case 3: High framerate above 60 fps -> clamp to 60 fps
  if (parsedFps > 60) {
    return 60;
  }

  // Case 4: Valid source framerate at 24, 30, 60 or anything <= 60 fps
  // Return null so transcode keeps exact source frame rate!
  return null;
}

/**
 * Returns the exact FFmpeg CLI arguments needed for framerate handling:
 * - [] if keeping source frame rate
 * - ['-r', String(clampedFps)] if clamped to 30 or 60
 */
export async function getAdaptiveFramerateArgs(ffmpeg, inputName) {
  const target = await probeVideoFramerate(ffmpeg, inputName);
  return target === null ? [] : ['-r', String(target)];
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

if (typeof window !== 'undefined') {
  window.__ffmpegDebug = {
    getFFmpeg,
    terminateFFmpeg,
    probeVideoFramerate,
    getAdaptiveFramerateArgs,
    fileToUint8Array,
    uint8ToBlob,
  };
}

