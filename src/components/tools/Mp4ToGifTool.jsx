'use client';

import React, { useState, useEffect } from 'react';
import { Film, Download, Loader2, RefreshCw } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { getFFmpeg, clearFFmpegProgress, fileToUint8Array, uint8ToBlob } from '../../lib/ffmpegClient';
import { formatBytes, formatTime, downloadBlob, baseName } from '../../lib/format';

export function Mp4ToGifTool() {
  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [lengthSec, setLengthSec] = useState(5);
  const [fps, setFps] = useState(15);
  const [width, setWidth] = useState(480);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifBlob, setGifBlob] = useState(null);
  const [gifUrl, setGifUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (gifUrl) URL.revokeObjectURL(gifUrl);
    };
  }, [videoUrl, gifUrl]);

  const handleFiles = (files) => {
    const f = files[0];
    if (!f) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setGifBlob(null);
    setGifUrl(null);
    setError('');
  };

  const handleConvert = async () => {
    if (!file) return;
    setProcessing(true);
    setError('');
    setProgress(10);

    try {
      const ffmpeg = await getFFmpeg((pct) => setProgress(Math.max(12, pct)));
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inputName = `clip.${ext}`;
      const outName = 'out.gif';

      await ffmpeg.writeFile(inputName, await fileToUint8Array(file));
      const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

      const exitCode = await ffmpeg.exec([
        '-ss', String(start),
        '-t', String(lengthSec),
        '-i', inputName,
        '-vf', filter,
        '-loop', '0',
        outName,
      ]);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outName);
      const blob = uint8ToBlob(data, 'image/gif');
      if (gifUrl) URL.revokeObjectURL(gifUrl);
      setGifBlob(blob);
      setGifUrl(URL.createObjectURL(blob));
      setProgress(100);

      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outName).catch(() => {});
    } catch (err) {
      console.error(err);
      setError('GIF rendering failed. Try a shorter duration (3–10 seconds) or 480px width.');
    } finally {
      clearFFmpegProgress();
      setProcessing(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="video/*"
        onFiles={handleFiles}
        title="Drop an MP4 or MOV clip to convert to GIF"
        subtitle="Two-pass custom color palette rendering directly in your browser — sharp gradients, zero watermarks."
        allowPaste={false}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-canvas-300 bg-canvas-100 px-4 py-3">
        <span className="truncate text-sm font-bold text-ink-900">
          {file.name} <span className="font-mono text-xs font-normal text-ink-500">({formatTime(duration)})</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setFile(null);
            setGifBlob(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>New Clip</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="overflow-hidden rounded-2xl border border-canvas-300 bg-ink-950 flex items-center justify-center">
          <video
            src={videoUrl}
            controls
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration || 5;
              setDuration(d);
              setLengthSec(Math.min(6, Math.max(1, Math.floor(d))));
            }}
            className="max-h-[300px] w-full object-contain"
          />
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-canvas-300 bg-canvas-100 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="gif-start" className="block text-xs font-semibold text-ink-700 mb-1">
                Start (seconds)
              </label>
              <input
                id="gif-start"
                type="number"
                min="0"
                max={Math.max(0, Math.floor(duration - 1))}
                step="0.5"
                value={start}
                onChange={(e) => setStart(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-lg border border-canvas-300 bg-white px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label htmlFor="gif-len" className="block text-xs font-semibold text-ink-700 mb-1">
                Duration (seconds)
              </label>
              <input
                id="gif-len"
                type="number"
                min="1"
                max="20"
                step="0.5"
                value={lengthSec}
                onChange={(e) => setLengthSec(Math.min(20, Math.max(1, Number(e.target.value))))}
                className="w-full rounded-lg border border-canvas-300 bg-white px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-ink-700 mb-1.5">Frame Rate (FPS)</span>
            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 24].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFps(v)}
                  className={`rounded-lg border py-1.5 text-xs font-bold font-mono cursor-pointer ${
                    fps === v ? 'border-blue-600 bg-blue-600 text-white' : 'border-canvas-300 bg-white text-ink-700'
                  }`}
                >
                  {v} FPS
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-ink-700 mb-1.5">Output Width</span>
            <div className="grid grid-cols-3 gap-2">
              {[360, 480, 640].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWidth(w)}
                  className={`rounded-lg border py-1.5 text-xs font-bold font-mono cursor-pointer ${
                    width === w ? 'border-blue-600 bg-blue-600 text-white' : 'border-canvas-300 bg-white text-ink-700'
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={handleConvert}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-2.5 text-sm font-bold text-white cursor-pointer"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
            <span>{processing ? `Rendering GIF (${progress}%)...` : 'Create High-Quality GIF'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {gifUrl && gifBlob && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 flex flex-col items-center gap-4">
          <img src={gifUrl} alt="Generated GIF preview" className="max-h-[340px] rounded-xl border border-canvas-300 shadow-card" />
          <button
            type="button"
            onClick={() => downloadBlob(gifBlob, `${baseName(file.name)}.gif`)}
            className="inline-flex items-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
          >
            <Download size={15} />
            <span>Download GIF ({formatBytes(gifBlob.size)})</span>
          </button>
        </div>
      )}
    </div>
  );
}
