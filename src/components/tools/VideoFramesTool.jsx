'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Download, Archive, RefreshCw, Loader2, Crown, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { formatBytes, formatTime, downloadBlob, baseName } from '../../lib/format';
import { copyImageBlobToClipboard } from '../../lib/clipboard';
import { useStudio } from '../StudioProvider';

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_BATCH_FRAMES = 60;

export function VideoFramesTool() {
  const { isPro, openProModal } = useStudio();
  const videoRef = useRef(null);
  const runIdRef = useRef(0);
  const copyTimerRef = useRef(null);

  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [hasFiniteDuration, setHasFiniteDuration] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [intervalSec, setIntervalSec] = useState(2);
  const [batching, setBatching] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [videoUrl, capturedUrl]);

  const handleFiles = (files) => {
    const f = files[0];
    if (!f) return;
    setError('');
    setCopyMsg('');
    if (f.size === 0) {
      setError('This video file is empty (0 bytes).');
      return;
    }
    if (f.size > MAX_VIDEO_BYTES) {
      setError('Video exceeds 500 MB limit.');
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setCapturedBlob(null);
    setCapturedUrl(null);
    setDuration(0);
    setHasFiniteDuration(false);
    setCurrentTime(0);
    setDims({ w: 0, h: 0 });
  };

  const handleReset = () => {
    runIdRef.current += 1;
    setBatching(false);
    setBatchProgress('');
    setFile(null);
    setCapturedBlob(null);
    setError('');
  };

  const seekTo = (t) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(hasFiniteDuration ? duration : Math.max(10, t), t));
    v.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const captureCurrentFrame = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) {
      setError('Video frame is not ready yet. Play or scrub slightly first.');
      return;
    }
    setError('');
    setCopyMsg('');
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      setError('Could not encode video frame to PNG.');
      return;
    }
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(blob);
    setCapturedUrl(URL.createObjectURL(blob));
  };

  const handleCopyFrame = async () => {
    if (!capturedBlob) return;
    setCopyMsg('');
    const res = await copyImageBlobToClipboard(capturedBlob);
    if (res.ok) {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyMsg(res.reason);
    }
  };

  const handleBatchZip = async () => {
    if (!file || batching) return;
    if (!isPro) {
      openProModal('Batch extracting video frames every N seconds as a ZIP is unlocked with ClipForge Pro Annual ($29/year).');
      return;
    }
    if (!hasFiniteDuration || duration <= 0) {
      setError('Cannot determine exact video duration for batch extraction. Use single-frame capture instead.');
      return;
    }

    const safeInterval = Number.isFinite(intervalSec) ? Math.min(60, Math.max(0.5, intervalSec)) : 2;
    const timestamps = [];
    for (let t = 0; t <= duration && timestamps.length < MAX_BATCH_FRAMES; t += safeInterval) {
      timestamps.push(Number(t.toFixed(2)));
    }
    if (timestamps.length === 0) timestamps.push(0);

    const runId = ++runIdRef.current;
    setBatching(true);
    setError('');
    setBatchProgress(`Preparing ${timestamps.length} frames...`);

    const tempUrl = URL.createObjectURL(file);
    try {
      const hiddenVideo = document.createElement('video');
      hiddenVideo.muted = true;
      hiddenVideo.playsInline = true;
      hiddenVideo.preload = 'auto';
      hiddenVideo.src = tempUrl;

      await new Promise((resolve, reject) => {
        hiddenVideo.onloadeddata = resolve;
        hiddenVideo.onerror = () => reject(new Error('Could not decode video'));
      });

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const canvas = document.createElement('canvas');
      canvas.width = hiddenVideo.videoWidth;
      canvas.height = hiddenVideo.videoHeight;
      const ctx = canvas.getContext('2d');

      for (let i = 0; i < timestamps.length; i++) {
        if (runId !== runIdRef.current) return;
        const ts = timestamps[i];
        setBatchProgress(`Extracting frame ${i + 1} / ${timestamps.length} (${formatTime(ts)})...`);
        await new Promise((resolve) => {
          const onSeeked = () => {
            hiddenVideo.removeEventListener('seeked', onSeeked);
            resolve();
          };
          hiddenVideo.addEventListener('seeked', onSeeked);
          hiddenVideo.currentTime = Math.min(ts, Math.max(0, hiddenVideo.duration - 0.02));
        });
        ctx.drawImage(hiddenVideo, 0, 0, canvas.width, canvas.height);
        const frameBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (frameBlob) {
          const padded = String(i + 1).padStart(3, '0');
          zip.file(`${baseName(file.name)}-frame-${padded}-${ts}s.png`, frameBlob);
        }
      }

      if (runId !== runIdRef.current) return;
      setBatchProgress('Building ZIP archive...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${baseName(file.name)}-frames.zip`);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      console.error(err);
      setError('Batch frame extraction failed on this video format.');
    } finally {
      URL.revokeObjectURL(tempUrl);
      if (runId === runIdRef.current) {
        setBatching(false);
        setBatchProgress('');
      }
    }
  };

  if (!file) {
    return (
      <div className="flex flex-col gap-3">
        <Dropzone
          accept="video/*"
          onFiles={handleFiles}
          title="Drop a video to extract full-resolution frames & thumbnails"
          subtitle="Scrub to any millisecond and export crisp full-resolution PNG frames instantly."
          allowPaste={false}
        />
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-canvas-300 bg-canvas-100 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate text-sm font-bold text-ink-900">{file.name}</span>
          {dims.w > 0 && (
            <span className="rounded-md border border-canvas-300 bg-white px-2 py-0.5 text-xs font-mono text-ink-500">
              {dims.w}×{dims.h}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>{batching ? 'Cancel & Reset' : 'New Video'}</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-canvas-300 bg-ink-950 flex justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDims({ w: v.videoWidth || 0, h: v.videoHeight || 0 });
            if (Number.isFinite(v.duration) && v.duration > 0) {
              setDuration(v.duration);
              setHasFiniteDuration(true);
            } else {
              setDuration(10);
              setHasFiniteDuration(false);
            }
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
          onError={() => setError('Could not play this video codec in your browser.')}
          className="max-h-[360px] w-full object-contain"
        />
      </div>

      {/* Precision Scrubber + Capture */}
      <div className="rounded-2xl border border-canvas-300 bg-canvas-100 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="frame-scrubber" className="text-xs font-bold text-ink-700">
            Exact Frame Time: <span className="font-mono text-blue-600">{formatTime(currentTime)}</span>
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => seekTo(currentTime - 0.1)}
              className="inline-flex items-center gap-1 rounded-lg border border-canvas-300 bg-white hover:bg-canvas-200 px-2.5 py-1 text-xs font-bold text-ink-700 cursor-pointer"
            >
              <ChevronLeft size={13} />
              <span>-0.1s</span>
            </button>
            <button
              type="button"
              onClick={() => seekTo(currentTime + 0.1)}
              className="inline-flex items-center gap-1 rounded-lg border border-canvas-300 bg-white hover:bg-canvas-200 px-2.5 py-1 text-xs font-bold text-ink-700 cursor-pointer"
            >
              <span>+0.1s</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        <input
          id="frame-scrubber"
          type="range"
          min="0"
          max={Math.max(0.1, duration)}
          step="0.05"
          value={Math.min(currentTime, Math.max(0.1, duration))}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="w-full accent-blue-600 cursor-pointer"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={captureCurrentFrame}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
          >
            <Camera size={16} />
            <span>Capture Full-Res PNG</span>
          </button>

          {/* Pro Batch ZIP Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="batch-interval" className="text-xs font-semibold text-ink-700">
              Every (sec):
            </label>
            <input
              id="batch-interval"
              type="number"
              min="0.5"
              max="60"
              step="0.5"
              disabled={batching}
              value={intervalSec}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setIntervalSec(Math.min(60, Math.max(0.5, n)));
              }}
              className="w-20 rounded-lg border border-canvas-300 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-ink-900"
            />
            <button
              type="button"
              disabled={batching}
              onClick={handleBatchZip}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white cursor-pointer"
            >
              {batching ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
              <span>{batching ? batchProgress : 'Batch Extract ZIP'}</span>
              {!isPro && !batching && <Crown size={12} className="text-amber-400" />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {capturedUrl && capturedBlob && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 flex flex-col items-center gap-4">
          <img
            src={capturedUrl}
            alt="Extracted full-resolution video frame"
            className="max-h-[340px] rounded-xl border border-canvas-300 shadow-card bg-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyFrame}
              className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-100 px-4 py-2.5 text-sm font-bold text-ink-800 cursor-pointer"
            >
              {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              <span>{copied ? 'Copied!' : 'Copy PNG'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadBlob(capturedBlob, `${baseName(file.name)}-frame-${currentTime.toFixed(1)}s.png`)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
            >
              <Download size={15} />
              <span>Download PNG ({formatBytes(capturedBlob.size)})</span>
            </button>
          </div>
          {copyMsg && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
              {copyMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
