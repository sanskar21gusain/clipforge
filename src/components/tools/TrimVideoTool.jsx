'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Scissors, Download, Loader2, RefreshCw, Zap, Target } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { getFFmpeg, fileToUint8Array } from '../../lib/ffmpegClient';
import { formatBytes, formatTime, downloadBlob, baseName } from '../../lib/format';

export function TrimVideoTool() {
  const videoRef = useRef(null);
  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(10);
  const [mode, setMode] = useState('fast'); // 'fast' (stream copy) or 'accurate' (re-encode)
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputBlob, setOutputBlob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFiles = (files) => {
    const f = files[0];
    if (!f) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setOutputBlob(null);
    setError('');
  };

  const handleTrim = async () => {
    if (!file) return;
    if (end <= start) {
      setError('End time must be greater than start time.');
      return;
    }

    setProcessing(true);
    setError('');
    setProgress(8);
    setOutputBlob(null);

    try {
      const ffmpeg = await getFFmpeg((pct) => setProgress(Math.max(10, pct)));
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inputName = `in.${ext}`;
      const outputName = 'trimmed.mp4';

      await ffmpeg.writeFile(inputName, await fileToUint8Array(file));
      const clipDuration = (end - start).toFixed(2);

      const args =
        mode === 'fast'
          ? ['-ss', start.toFixed(2), '-i', inputName, '-t', clipDuration, '-c', 'copy', outputName]
          : ['-ss', start.toFixed(2), '-i', inputName, '-t', clipDuration, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', outputName];

      await ffmpeg.exec(args);
      const data = await ffmpeg.readFile(outputName);
      setOutputBlob(new Blob([data.buffer], { type: 'video/mp4' }));
      setProgress(100);

      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
    } catch (err) {
      console.error(err);
      setError('Could not trim this clip. Try Accurate Re-Encode mode if Fast Copy fails on this codec.');
    } finally {
      setProcessing(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="video/*"
        onFiles={handleFiles}
        title="Drop a video to trim cleanly"
        subtitle="Instant lossless stream-copy or frame-accurate H.264 re-encoding directly in your browser."
        allowPaste={false}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-canvas-300 bg-canvas-100 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate text-sm font-bold text-ink-900">{file.name}</span>
          <span className="rounded-md border border-canvas-300 bg-white px-2 py-0.5 text-xs font-mono text-ink-500">
            {formatBytes(file.size)} · {formatTime(duration)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setFile(null);
            setOutputBlob(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>New Video</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-canvas-300 bg-ink-950">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration || 0;
            setDuration(d);
            setStart(0);
            setEnd(Number(d.toFixed(1)));
          }}
          className="max-h-[360px] w-full object-contain"
        />
      </div>

      {/* Trim Range Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-canvas-300 bg-canvas-100 p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="trim-start" className="text-xs font-bold text-ink-700">
              Start Time ({formatTime(start)})
            </label>
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) setStart(Number(videoRef.current.currentTime.toFixed(1)));
              }}
              className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Use Current Time
            </button>
          </div>
          <input
            id="trim-start"
            type="range"
            min="0"
            max={Math.max(0.1, duration)}
            step="0.1"
            value={start}
            onChange={(e) => setStart(Math.min(Number(e.target.value), Math.max(0, end - 0.2)))}
            className="accent-blue-600 cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="trim-end" className="text-xs font-bold text-ink-700">
              End Time ({formatTime(end)})
            </label>
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) setEnd(Number(videoRef.current.currentTime.toFixed(1)));
              }}
              className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Use Current Time
            </button>
          </div>
          <input
            id="trim-end"
            type="range"
            min="0"
            max={Math.max(0.1, duration)}
            step="0.1"
            value={end}
            onChange={(e) => setEnd(Math.max(Number(e.target.value), Math.min(duration, start + 0.2)))}
            className="accent-blue-600 cursor-pointer"
          />
        </div>
      </div>

      {/* Mode Switch */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode('fast')}
          className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
            mode === 'fast'
              ? 'border-blue-600 bg-blue-50/70'
              : 'border-canvas-300 bg-white hover:bg-canvas-100'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-ink-900">
            <Zap size={14} className="text-blue-600" />
            <span>Fast Lossless Copy (Instant)</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            Zero re-encoding, preserves 100% original video quality at nearest keyframe.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode('accurate')}
          className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
            mode === 'accurate'
              ? 'border-blue-600 bg-blue-50/70'
              : 'border-canvas-300 bg-white hover:bg-canvas-100'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-ink-900">
            <Target size={14} className="text-blue-600" />
            <span>Frame-Accurate Re-Encode</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            Cuts on the exact millisecond with clean H.264/AAC MP4 output.
          </p>
        </button>
      </div>

      {processing && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800">
          <Loader2 size={15} className="animate-spin" />
          <span>Trimming clip locally ({progress}%)...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-mono text-ink-500">
          Selected clip length: <strong className="text-ink-900">{formatTime(Math.max(0, end - start))}</strong>
        </span>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={processing}
            onClick={handleTrim}
            className="inline-flex items-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
          >
            <Scissors size={15} />
            <span>{processing ? 'Trimming...' : 'Trim Video'}</span>
          </button>

          {outputBlob && (
            <button
              type="button"
              onClick={() => downloadBlob(outputBlob, `${baseName(file.name)}-trimmed.mp4`)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
            >
              <Download size={15} />
              <span>Download ({formatBytes(outputBlob.size)})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
