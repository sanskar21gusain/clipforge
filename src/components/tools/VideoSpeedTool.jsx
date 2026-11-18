'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Gauge, Download, Loader2, RefreshCw, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { getFFmpeg, clearFFmpegProgress, fileToUint8Array, uint8ToBlob } from '../../lib/ffmpegClient';
import { formatBytes, downloadBlob, baseName } from '../../lib/format';

const MAX_VIDEO_BYTES = 350 * 1024 * 1024;
const MAX_REVERSE_BYTES = 80 * 1024 * 1024;

const SPEEDS = [
  { val: 0.25, label: '0.25×', sub: 'Super Slow' },
  { val: 0.5, label: '0.5×', sub: 'Slow-Mo' },
  { val: 1, label: '1×', sub: 'Normal' },
  { val: 1.5, label: '1.5×', sub: 'Brisk' },
  { val: 2, label: '2×', sub: 'Fast' },
  { val: 4, label: '4×', sub: 'Timelapse' },
];

function buildAtempoChain(speed) {
  if (speed === 0.25) return 'atempo=0.5,atempo=0.5';
  if (speed === 4) return 'atempo=2.0,atempo=2.0';
  if (speed === 1) return '';
  return `atempo=${speed}`;
}

export function VideoSpeedTool() {
  const runIdRef = useRef(0);
  const processingRef = useRef(false);

  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [speed, setSpeed] = useState(2);
  const [reverse, setReverse] = useState(false);
  const [muteAudio, setMuteAudio] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputBlob, setOutputBlob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFiles = (files) => {
    const f = files[0];
    if (!f) return;
    setError('');
    if (f.size === 0) {
      setError('This video file is empty (0 bytes).');
      return;
    }
    if (f.size > MAX_VIDEO_BYTES) {
      setError('Video exceeds 350 MB limit. Trim it first so your browser tab stays responsive.');
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setOutputBlob(null);
    setProgress(0);
  };

  const handleReset = () => {
    runIdRef.current += 1;
    processingRef.current = false;
    setProcessing(false);
    setProgress(0);
    setFile(null);
    setOutputBlob(null);
    setError('');
  };

  const handleProcess = async () => {
    if (!file || processingRef.current) return;
    if (speed === 1 && !reverse && !muteAudio) {
      setError('Pick a speed other than 1× or enable Reverse / Mute Audio.');
      return;
    }
    if (reverse && file.size > MAX_REVERSE_BYTES) {
      setError('Reverse mode buffers frames in browser memory and supports clips up to 80 MB. Trim your clip first.');
      return;
    }

    const runId = ++runIdRef.current;
    processingRef.current = true;
    setProcessing(true);
    setError('');
    setOutputBlob(null);
    setProgress(8);

    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const inputName = `speed_in.${ext}`;
    const outputName = 'speed_out.mp4';
    let ffmpeg = null;

    try {
      ffmpeg = await getFFmpeg((pct) => {
        if (runId === runIdRef.current) setProgress(Math.max(12, pct));
      });
      if (runId !== runIdRef.current) return;

      await ffmpeg.writeFile(inputName, await fileToUint8Array(file));
      if (runId !== runIdRef.current) return;

      const ptsFactor = (1 / speed).toFixed(4);
      const vParts = ['scale=trunc(iw/2)*2:trunc(ih/2)*2', `setpts=${ptsFactor}*PTS`];
      if (reverse) vParts.push('reverse');
      const vf = vParts.join(',');

      const aParts = [];
      const atempo = buildAtempoChain(speed);
      if (atempo) aParts.push(atempo);
      if (reverse) aParts.push('areverse');

      let exitCode = 1;
      if (!muteAudio) {
        const args = [
          '-i', inputName,
          '-vf', vf,
          ...(aParts.length > 0 ? ['-af', aParts.join(',')] : []),
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'veryfast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          outputName,
        ];
        exitCode = await ffmpeg.exec(args);
      }

      // Fallback cleanly for muted output or silent videos without an audio stream
      if (exitCode !== 0 && runId === runIdRef.current) {
        await ffmpeg.deleteFile(outputName).catch(() => {});
        exitCode = await ffmpeg.exec([
          '-i', inputName,
          '-vf', vf,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'veryfast',
          '-crf', '23',
          '-an',
          '-movflags', '+faststart',
          outputName,
        ]);
      }

      if (exitCode !== 0) {
        throw new Error(`FFmpeg speed filter exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outputName);
      if (runId !== runIdRef.current) return;
      setOutputBlob(uint8ToBlob(data, 'video/mp4'));
      setProgress(100);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      console.error(err);
      setError('Could not adjust video speed in browser. Try a shorter clip or disable Reverse.');
    } finally {
      if (ffmpeg) {
        await ffmpeg.deleteFile(inputName).catch(() => {});
        await ffmpeg.deleteFile(outputName).catch(() => {});
      }
      if (runId === runIdRef.current) {
        clearFFmpegProgress();
        processingRef.current = false;
        setProcessing(false);
      }
    }
  };

  if (!file) {
    return (
      <div className="flex flex-col gap-3">
        <Dropzone
          accept="video/*"
          onFiles={handleFiles}
          title="Drop a video to speed up, slow down, or reverse"
          subtitle="Create 0.25× slow-motion, 2×–4× timelapses, or reversed clips locally in your browser."
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
          <span className="rounded-md border border-canvas-300 bg-white px-2 py-0.5 text-xs font-mono text-ink-500">
            {formatBytes(file.size)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>{processing ? 'Cancel & Reset' : 'New Video'}</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-canvas-300 bg-ink-950 flex justify-center">
        <video src={videoUrl} controls className="max-h-[320px] w-full object-contain" />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-500 font-mono">
          Playback Speed
        </span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SPEEDS.map((s) => (
            <button
              key={s.val}
              type="button"
              disabled={processing}
              onClick={() => {
                setSpeed(s.val);
                setOutputBlob(null);
              }}
              className={`rounded-xl border p-2.5 text-center transition-all cursor-pointer disabled:opacity-50 ${
                speed === s.val
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-canvas-300 bg-white text-ink-700 hover:bg-canvas-100'
              }`}
            >
              <div className="text-sm font-extrabold font-mono">{s.label}</div>
              <div className="text-[10px] text-ink-500">{s.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-canvas-300 bg-canvas-100 p-4">
        <label className="inline-flex items-center gap-2 text-xs font-bold text-ink-800 cursor-pointer">
          <input
            type="checkbox"
            disabled={processing}
            checked={reverse}
            onChange={(e) => {
              setReverse(e.target.checked);
              setOutputBlob(null);
            }}
            className="h-4 w-4 accent-blue-600 cursor-pointer"
          />
          <RotateCcw size={14} className="text-blue-600" />
          <span>Reverse Playback (Backwards)</span>
        </label>

        <label className="inline-flex items-center gap-2 text-xs font-bold text-ink-800 cursor-pointer">
          <input
            type="checkbox"
            disabled={processing}
            checked={muteAudio}
            onChange={(e) => {
              setMuteAudio(e.target.checked);
              setOutputBlob(null);
            }}
            className="h-4 w-4 accent-blue-600 cursor-pointer"
          />
          <span>Mute Audio Track</span>
        </label>
      </div>

      {processing && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800">
          <Loader2 size={15} className="animate-spin" />
          <span>Rendering {speed}× {reverse ? 'reversed ' : ''}video ({progress}%)...</span>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {outputBlob ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>Ready ({formatBytes(outputBlob.size)})</span>
          </div>
        ) : (
          <span className="text-xs text-ink-500">Audio tempo adjusts automatically to stay in sync.</span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={processing}
            onClick={handleProcess}
            className="inline-flex items-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
          >
            {processing ? <Loader2 size={15} className="animate-spin" /> : <Gauge size={15} />}
            <span>{processing ? 'Rendering...' : `Render ${speed}×${reverse ? ' Reversed' : ''} MP4`}</span>
          </button>

          {outputBlob && (
            <button
              type="button"
              onClick={() =>
                downloadBlob(
                  outputBlob,
                  `${baseName(file.name)}-${speed}x${reverse ? '-rev' : ''}.mp4`
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
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
