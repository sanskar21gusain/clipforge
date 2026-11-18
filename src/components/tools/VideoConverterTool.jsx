'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Repeat, Download, Loader2, RefreshCw, Crown, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { getFFmpeg, clearFFmpegProgress, fileToUint8Array, uint8ToBlob } from '../../lib/ffmpegClient';
import { formatBytes, downloadBlob, baseName } from '../../lib/format';
import { useStudio } from '../StudioProvider';

const MAX_FILE_BYTES = 400 * 1024 * 1024; // 400 MB browser WASM safety cap

const SOCIAL_PRESETS = [
  { id: 'original', label: 'Original Ratio', sub: 'Keep source aspect', hd: null, fhd: null },
  { id: '16:9', label: '16:9 Landscape', sub: 'YouTube, X, LinkedIn', hd: [1280, 720], fhd: [1920, 1080] },
  { id: '9:16', label: '9:16 Vertical', sub: 'Reels, Shorts, TikTok', hd: [720, 1280], fhd: [1080, 1920] },
  { id: '1:1', label: '1:1 Square', sub: 'Instagram & Feed', hd: [720, 720], fhd: [1080, 1080] },
];

export function VideoConverterTool() {
  const { isPro, openProModal, sendFileToTool } = useStudio();
  const runIdRef = useRef(0);
  const processingRef = useRef(false);

  const [file, setFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [preset, setPreset] = useState('original');
  const [fitMode, setFitMode] = useState('crop'); // 'crop' | 'pad'
  const [resolution, setResolution] = useState('720p'); // '720p' (free) | '1080p' (pro)
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
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
      setError('This video file is empty (0 bytes). Please choose a valid MOV, WebM, MKV, or MP4 file.');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError('This file exceeds 400 MB. Trim or shorten it first so your browser tab stays responsive.');
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
    setStatus('');
    setFile(null);
    setOutputBlob(null);
    setError('');
  };

  const handleSelectResolution = (resId) => {
    if (resId === '1080p' && !isPro) {
      openProModal('Full HD 1080p social conversion & high-bitrate MP4 export is unlocked with ClipForge Pro Annual ($29/year).');
      return;
    }
    setResolution(resId);
    setOutputBlob(null);
  };

  const handleConvert = async () => {
    if (!file || processingRef.current) return;
    if (resolution === '1080p' && !isPro) {
      openProModal('Full HD 1080p social conversion is unlocked with ClipForge Pro Annual ($29/year).');
      return;
    }

    const runId = ++runIdRef.current;
    processingRef.current = true;
    setProcessing(true);
    setError('');
    setOutputBlob(null);
    setProgress(8);
    setStatus('Loading FFmpeg engine in browser...');

    try {
      const ffmpeg = await getFFmpeg((pct) => {
        if (runId === runIdRef.current) setProgress(Math.max(12, pct));
      });
      if (runId !== runIdRef.current) return;

      setStatus('Converting to universal H.264 MP4...');
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mov';
      const inputName = `source.${ext}`;
      const outputName = 'converted.mp4';

      await ffmpeg.writeFile(inputName, await fileToUint8Array(file));
      if (runId !== runIdRef.current) {
        await ffmpeg.deleteFile(inputName).catch(() => {});
        return;
      }

      const chosen = SOCIAL_PRESETS.find((p) => p.id === preset) || SOCIAL_PRESETS[0];
      let vf = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';

      if (chosen.hd) {
        const [w, h] = resolution === '1080p' ? chosen.fhd : chosen.hd;
        vf =
          fitMode === 'crop'
            ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
            : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=#0f172a`;
      } else if (resolution === '720p') {
        vf = "scale='min(1280,iw)':-2,scale=trunc(iw/2)*2:trunc(ih/2)*2";
      }

      const crf = resolution === '1080p' ? '20' : '23';
      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-vf', vf,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', crf,
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputName,
      ]);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outputName);
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});

      if (runId !== runIdRef.current) return;
      const blob = uint8ToBlob(data, 'video/mp4');
      setOutputBlob(blob);
      setProgress(100);
      setStatus('Conversion complete!');
    } catch (err) {
      if (runId !== runIdRef.current) return;
      console.error(err);
      setError('Could not convert this video in browser. Ensure it is a valid MOV, WebM, MKV, or MP4 file.');
    } finally {
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
          title="Drop a MOV, WebM, MKV, or MP4 video to convert"
          subtitle="Convert to universal H.264 MP4 and optionally resize for 9:16 Reels, 1:1 Square, or 16:9 YouTube."
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

  const presetSlug = preset === 'original' ? 'mp4' : preset.replace(':', 'x');

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

      {/* Social Aspect Ratio Presets */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-500 font-mono">
          Social Aspect Ratio
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {SOCIAL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={processing}
              onClick={() => {
                setPreset(p.id);
                setOutputBlob(null);
              }}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer disabled:opacity-50 ${
                preset === p.id
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-canvas-300 bg-white text-ink-700 hover:bg-canvas-100'
              }`}
            >
              <div className="text-xs font-bold">{p.label}</div>
              <div className="mt-0.5 text-[11px] text-ink-500">{p.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Fit Mode + Resolution Tier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {preset !== 'original' && (
          <div className="rounded-2xl border border-canvas-300 bg-canvas-100 p-4 flex flex-col gap-2">
            <span className="text-xs font-bold text-ink-700">Framing Style</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'crop', label: 'Fill & Center Crop' },
                { id: 'pad', label: 'Fit with Borders' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={processing}
                  onClick={() => {
                    setFitMode(m.id);
                    setOutputBlob(null);
                  }}
                  className={`rounded-lg border py-2 px-2.5 text-xs font-bold cursor-pointer disabled:opacity-50 ${
                    fitMode === m.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-canvas-300 bg-white text-ink-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-canvas-300 bg-canvas-100 p-4 flex flex-col gap-2">
          <span className="text-xs font-bold text-ink-700">Output Quality</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={processing}
              onClick={() => handleSelectResolution('720p')}
              className={`rounded-lg border py-2 px-2.5 text-xs font-bold cursor-pointer disabled:opacity-50 ${
                resolution === '720p'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-canvas-300 bg-white text-ink-700'
              }`}
            >
              720p HD (Free)
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={() => handleSelectResolution('1080p')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 px-2.5 text-xs font-bold cursor-pointer disabled:opacity-50 ${
                resolution === '1080p'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-canvas-300 bg-white text-ink-700 hover:bg-canvas-100'
              }`}
            >
              <span>1080p Full HD</span>
              {!isPro && <Crown size={12} className="text-amber-500" />}
            </button>
          </div>
        </div>
      </div>

      {processing && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-blue-800">
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span>{status}</span>
            </span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
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
            <span>MP4 Ready ({formatBytes(outputBlob.size)})</span>
          </div>
        ) : (
          <span className="text-xs text-ink-500">Exports universal H.264 + AAC `.mp4` compatible with every device.</span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={processing}
            onClick={handleConvert}
            className="inline-flex items-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
          >
            {processing ? <Loader2 size={15} className="animate-spin" /> : <Repeat size={15} />}
            <span>{processing ? 'Converting...' : 'Convert to MP4'}</span>
          </button>

          {outputBlob && (
            <>
              <button
                type="button"
                onClick={() => downloadBlob(outputBlob, `${baseName(file.name)}-${presetSlug}.mp4`)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
              >
                <Download size={15} />
                <span>Download MP4</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  sendFileToTool({
                    blob: outputBlob,
                    filename: `${baseName(file.name)}-${presetSlug}.mp4`,
                    mimeType: 'video/mp4',
                    targetSlug: 'compress-video',
                    expectedType: 'video',
                    sourceLabel: 'MP4 Converter',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3.5 py-2.5 text-xs font-bold text-blue-700 cursor-pointer"
              >
                <span>Compress</span>
                <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
