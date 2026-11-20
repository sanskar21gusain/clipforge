'use client';

import React, { useState, useEffect } from 'react';
import { Download, Loader2, RefreshCw, Minimize2, CheckCircle2 } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { getFFmpeg, clearFFmpegProgress, terminateFFmpeg, getAdaptiveFramerateArgs, fileToUint8Array, uint8ToBlob } from '../../lib/ffmpegClient';
import { formatBytes, downloadBlob, baseName } from '../../lib/format';
import { useStudio } from '../StudioProvider';

const MAX_VIDEO_BYTES = 400 * 1024 * 1024; // 400 MB in-browser safety limit

const PRESETS = [
  { id: 'discord', label: 'Discord (8 MB)', mb: 8 },
  { id: 'whatsapp', label: 'WhatsApp (16 MB)', mb: 16 },
  { id: 'email', label: 'Email (25 MB)', mb: 25 },
  { id: 'custom', label: 'Custom MB', mb: 10 },
];

export function CompressVideoTool() {
  const { consumeHandoff } = useStudio();
  const [file, setFile] = useState(null);
  const [handoffSource, setHandoffSource] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [preset, setPreset] = useState('discord');
  const [targetMb, setTargetMb] = useState(8);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [outputBlob, setOutputBlob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const incoming = consumeHandoff('compress-video', 'video');
    if (incoming?.file) {
      setHandoffSource(incoming.sourceLabel || 'ClipForge');
      setFile(incoming.file);
      setVideoUrl(URL.createObjectURL(incoming.file));
      setOutputBlob(null);
      setError('');
      setProgress(0);
    }
  }, [consumeHandoff]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFiles = (files) => {
    const f = files[0];
    if (!f) return;
    setError('');
    if (f.size === 0) {
      setError('This video file is empty (0 bytes). Please choose a valid video file.');
      return;
    }
    if (f.size > MAX_VIDEO_BYTES) {
      setError('This file exceeds 400 MB. Browser WebAssembly memory safely compresses videos up to 400 MB locally without cloud uploads. Please select a smaller file.');
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setOutputBlob(null);
    setProgress(0);
  };

  const handleCompress = async () => {
    if (!file) return;
    setProcessing(true);
    setError('');
    setOutputBlob(null);
    setProgress(5);
    setStatus('Preparing video...');

    try {
      const ffmpeg = await getFFmpeg((pct) => {
        setProgress(Math.max(10, pct));
      });
      setStatus('Analyzing video framerate & container...');

      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inputName = `input.${ext}`;
      const outputName = 'compressed.mp4';

      await ffmpeg.writeFile(inputName, await fileToUint8Array(file));

      const rArgs = await getAdaptiveFramerateArgs(ffmpeg, inputName);
      setStatus('Encoding video to target size...');

      const dur = Number.isFinite(duration) && duration > 0 ? Math.max(1, duration) : 15;
      const safeMb = Number.isFinite(targetMb) ? Math.min(500, Math.max(1, targetMb)) : 8;
      // Target total kilobits with 12% container headroom
      const totalKbps = Math.floor(((safeMb * 0.88) * 8192) / dur);
      const audioKbps = totalKbps < 350 ? 64 : 96;
      const videoKbps = Math.max(150, totalKbps - audioKbps);

      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        ...rArgs,
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-b:v', `${videoKbps}k`,
        '-maxrate', `${Math.round(videoKbps * 1.25)}k`,
        '-bufsize', `${Math.round(videoKbps * 2)}k`,
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-b:a', `${audioKbps}k`,
        '-movflags', '+faststart',
        outputName,
      ]);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outputName);
      const blob = uint8ToBlob(data, 'video/mp4');
      setOutputBlob(blob);
      setProgress(100);
      setStatus('Compression complete!');

      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
    } catch (err) {
      console.error(err);
      setError('Compression failed or was stopped. Try a shorter MP4/WebM file under 250 MB.');
    } finally {
      clearFFmpegProgress();
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    await terminateFFmpeg();
    setProcessing(false);
    setProgress(0);
    setStatus('');
    setError('Compression cancelled. Memory freed.');
  };

  if (!file) {
    return (
      <Dropzone
        accept="video/*"
        onFiles={handleFiles}
        title="Drop a video to compress to exact size"
        subtitle="MP4, MOV, or WebM — hit Discord (8MB), WhatsApp (16MB), Email (25MB), or custom MB."
        allowPaste={false}
      />
    );
  }

  const savingsPct = outputBlob
    ? Math.max(0, Math.round((1 - outputBlob.size / file.size) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-canvas-300 bg-canvas-100 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate text-sm font-bold text-ink-900">{file.name}</span>
          <span className="rounded-md border border-canvas-300 bg-white px-2 py-0.5 text-xs font-mono text-ink-500">
            Original: {formatBytes(file.size)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setFile(null);
            setOutputBlob(null);
            setHandoffSource('');
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Change Video</span>
        </button>
      </div>

      {handoffSource && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
          Loaded directly from {handoffSource} (in-memory)
        </div>
      )}

      {/* Preview Player */}
      <div className="overflow-hidden rounded-2xl border border-canvas-300 bg-ink-950 flex justify-center">
        <video
          src={videoUrl}
          controls
          onLoadedMetadata={(e) => {
            const raw = e.currentTarget.duration;
            setDuration(Number.isFinite(raw) && raw > 0 ? raw : 0);
          }}
          className="max-h-[340px] w-full object-contain"
        />
      </div>

      {/* Target Size Selector */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-500 font-mono">
          Choose Target File Size
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPreset(p.id);
                setTargetMb(p.mb);
              }}
              className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                preset === p.id
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-canvas-300 bg-white text-ink-700 hover:bg-canvas-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-3 mt-1">
            <label htmlFor="target-mb-input" className="text-xs font-semibold text-ink-700">
              Target Size (MB):
            </label>
            <input
              id="target-mb-input"
              type="number"
              min="1"
              max="500"
              value={targetMb}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setTargetMb(Math.min(500, Math.max(1, n)));
              }}
              className="w-28 rounded-lg border border-canvas-300 bg-white px-3 py-1.5 text-sm font-mono font-bold text-ink-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Progress Bar with Cancel Button */}
      {processing && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-blue-800">
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span>{status}</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono">{progress}%</span>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg bg-white border border-rose-200 hover:bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 cursor-pointer shadow-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Action / Download */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {outputBlob ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>
              Output: {formatBytes(outputBlob.size)} ({savingsPct}% smaller)
            </span>
          </div>
        ) : (
          <p className="text-xs text-ink-500">
            Calculated bitrate adapts automatically to your clip length.
          </p>
        )}

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={processing}
            onClick={handleCompress}
            className="inline-flex items-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition-colors cursor-pointer"
          >
            <Minimize2 size={15} />
            <span>{processing ? 'Compressing...' : `Compress to ${targetMb} MB`}</span>
          </button>

          {outputBlob && (
            <button
              type="button"
              onClick={() => downloadBlob(outputBlob, `${baseName(file.name)}-${targetMb}mb.mp4`)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors cursor-pointer"
            >
              <Download size={15} />
              <span>Download MP4</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
