'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Combine,
  Download,
  Loader2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Trash2,
  Crown,
  CheckCircle2,
  ArrowRight,
  Film,
} from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { getFFmpeg, clearFFmpegProgress, fileToUint8Array, uint8ToBlob } from '../../lib/ffmpegClient';
import { formatBytes, downloadBlob } from '../../lib/format';
import { useStudio } from '../StudioProvider';

const MAX_TOTAL_BYTES = 450 * 1024 * 1024;
const FREE_CLIP_LIMIT = 2;

const OUTPUT_FORMATS = [
  { id: '720p', label: '16:9 HD (1280×720)', w: 1280, h: 720, pro: false },
  { id: '9x16', label: '9:16 Vertical (720×1280)', w: 720, h: 1280, pro: false },
  { id: '1080p', label: '16:9 Full HD (1920×1080)', w: 1920, h: 1080, pro: true },
];

export function MergeVideosTool() {
  const { isPro, openProModal, sendFileToTool } = useStudio();
  const runIdRef = useRef(0);
  const processingRef = useRef(false);

  const [clips, setClips] = useState([]);
  const [outFormat, setOutFormat] = useState('720p');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [outputBlob, setOutputBlob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
    };
  }, []);

  const handleFiles = (files) => {
    setError('');
    const valid = [];
    let currentTotal = clips.reduce((acc, c) => acc + c.file.size, 0);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f || f.size === 0) {
        setError('Skipped an empty (0 byte) video file.');
        continue;
      }
      if (currentTotal + f.size > MAX_TOTAL_BYTES) {
        setError('Combined clip size exceeds 450 MB browser limit. Try shorter clips.');
        break;
      }
      currentTotal += f.size;
      valid.push({ id: `${Date.now()}-${i}-${f.name}`, file: f });
    }

    if (valid.length > 0) {
      setClips((prev) => [...prev, ...valid]);
      setOutputBlob(null);
    }
  };

  const moveClip = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= clips.length) return;
    setClips((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
    setOutputBlob(null);
  };

  const removeClip = (id) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setOutputBlob(null);
  };

  const handleReset = () => {
    runIdRef.current += 1;
    processingRef.current = false;
    setProcessing(false);
    setProgress(0);
    setStatus('');
    setClips([]);
    setOutputBlob(null);
    setError('');
  };

  const handleMerge = async () => {
    if (clips.length < 2 || processingRef.current) {
      if (clips.length < 2) setError('Add at least 2 video clips to merge.');
      return;
    }
    if (clips.length > FREE_CLIP_LIMIT && !isPro) {
      openProModal('Merging 3 or more video clips into one video is unlocked with ClipForge Pro Annual ($29/year).');
      return;
    }
    const fmt = OUTPUT_FORMATS.find((o) => o.id === outFormat) || OUTPUT_FORMATS[0];
    if (fmt.pro && !isPro) {
      openProModal('Full HD 1080p video merging is unlocked with ClipForge Pro Annual ($29/year).');
      return;
    }

    const runId = ++runIdRef.current;
    processingRef.current = true;
    setProcessing(true);
    setError('');
    setOutputBlob(null);
    setProgress(8);
    setStatus('Loading FFmpeg engine in browser...');

    const writtenNames = [];
    const outputName = 'merged.mp4';
    let ffmpeg = null;

    try {
      ffmpeg = await getFFmpeg((pct) => {
        if (runId === runIdRef.current) setProgress(Math.max(12, pct));
      });
      if (runId !== runIdRef.current) return;

      setStatus(`Preparing ${clips.length} video clips...`);
      const inputArgs = [];
      for (let i = 0; i < clips.length; i++) {
        const f = clips[i].file;
        const ext = f.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
        const name = `clip_${i}.${ext}`;
        writtenNames.push(name);
        await ffmpeg.writeFile(name, await fileToUint8Array(f));
        if (runId !== runIdRef.current) return;
        inputArgs.push('-i', name);
      }

      setStatus('Normalizing & stitching clips into MP4...');
      const n = clips.length;
      const vFilters = [];
      const aFilters = [];
      const avConcatInputs = [];
      const vOnlyConcatInputs = [];

      for (let i = 0; i < n; i++) {
        vFilters.push(
          `[${i}:v]scale=${fmt.w}:${fmt.h}:force_original_aspect_ratio=decrease,pad=${fmt.w}:${fmt.h}:(ow-iw)/2:(oh-ih)/2:color=#0f172a,setsar=1,fps=30,format=yuv420p[v${i}]`
        );
        aFilters.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=stereo[a${i}]`);
        avConcatInputs.push(`[v${i}][a${i}]`);
        vOnlyConcatInputs.push(`[v${i}]`);
      }

      // First try video+audio concat; if any clip lacks an audio stream, fall back seamlessly to video-only concat.
      const avFilterComplex = `${vFilters.join(';')};${aFilters.join(';')};${avConcatInputs.join('')}concat=n=${n}:v=1:a=1[vout][aout]`;
      let exitCode = await ffmpeg.exec([
        ...inputArgs,
        '-filter_complex', avFilterComplex,
        '-map', '[vout]',
        '-map', '[aout]',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputName,
      ]);

      if (exitCode !== 0 && runId === runIdRef.current) {
        await ffmpeg.deleteFile(outputName).catch(() => {});
        const vOnlyFilterComplex = `${vFilters.join(';')};${vOnlyConcatInputs.join('')}concat=n=${n}:v=1:a=0[vout]`;
        exitCode = await ffmpeg.exec([
          ...inputArgs,
          '-filter_complex', vOnlyFilterComplex,
          '-map', '[vout]',
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
        throw new Error(`FFmpeg merge exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outputName);
      if (runId !== runIdRef.current) return;
      setOutputBlob(uint8ToBlob(data, 'video/mp4'));
      setProgress(100);
      setStatus('Videos merged successfully!');
    } catch (err) {
      if (runId !== runIdRef.current) return;
      console.error(err);
      setError('Could not merge these clips in browser. Ensure all files are valid MP4, MOV, or WebM videos.');
    } finally {
      if (ffmpeg) {
        for (const name of writtenNames) {
          await ffmpeg.deleteFile(name).catch(() => {});
        }
        await ffmpeg.deleteFile(outputName).catch(() => {});
      }
      if (runId === runIdRef.current) {
        clearFFmpegProgress();
        processingRef.current = false;
        setProcessing(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Dropzone
        accept="video/*"
        multiple
        onFiles={handleFiles}
        title="Drop 2 or more video clips to merge in order"
        subtitle="Free for up to 2 clips — reorder freely and stitch into one seamless MP4 locally."
        allowPaste={false}
      />

      {clips.length > 0 && (
        <>
          {/* Format Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500 font-mono">
              Merged Video Resolution
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {OUTPUT_FORMATS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={processing}
                  onClick={() => {
                    if (o.pro && !isPro) {
                      openProModal('Full HD 1080p video merging is unlocked with ClipForge Pro Annual ($29/year).');
                      return;
                    }
                    setOutFormat(o.id);
                    setOutputBlob(null);
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-50 ${
                    outFormat === o.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-canvas-300 bg-white text-ink-700 hover:bg-canvas-100'
                  }`}
                >
                  <span>{o.label}</span>
                  {o.pro && !isPro && <Crown size={12} className="text-amber-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* Reorderable Clip Queue */}
          <div className="flex flex-col gap-2">
            {clips.map((c, idx) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-canvas-300 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-xs font-bold font-mono text-blue-700">
                    {idx + 1}
                  </span>
                  <Film size={15} className="text-ink-500 shrink-0" />
                  <span className="truncate text-sm font-semibold text-ink-900">{c.file.name}</span>
                  <span className="text-xs font-mono text-ink-500">{formatBytes(c.file.size)}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={processing || idx === 0}
                    onClick={() => moveClip(idx, -1)}
                    aria-label={`Move ${c.file.name} up`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-canvas-300 bg-canvas-100 hover:bg-canvas-200 disabled:opacity-40 text-ink-700 cursor-pointer"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={processing || idx === clips.length - 1}
                    onClick={() => moveClip(idx, 1)}
                    aria-label={`Move ${c.file.name} down`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-canvas-300 bg-canvas-100 hover:bg-canvas-200 disabled:opacity-40 text-ink-700 cursor-pointer"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => removeClip(c.id)}
                    aria-label={`Remove ${c.file.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-canvas-300 bg-white hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 text-ink-600 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
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
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-100 px-3.5 py-2 text-xs font-semibold text-ink-600 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>{processing ? 'Cancel & Clear' : 'Clear Clips'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={processing || clips.length < 2}
                onClick={handleMerge}
                className="inline-flex items-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
              >
                {processing ? <Loader2 size={15} className="animate-spin" /> : <Combine size={15} />}
                <span>{processing ? 'Merging...' : `Merge ${clips.length} Clips`}</span>
                {clips.length > FREE_CLIP_LIMIT && !isPro && <Crown size={13} className="text-amber-400" />}
              </button>

              {outputBlob && (
                <>
                  <button
                    type="button"
                    onClick={() => downloadBlob(outputBlob, 'clipforge-merged.mp4')}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
                  >
                    <Download size={15} />
                    <span>Download MP4 ({formatBytes(outputBlob.size)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendFileToTool({
                        blob: outputBlob,
                        filename: 'clipforge-merged.mp4',
                        mimeType: 'video/mp4',
                        targetSlug: 'compress-video',
                        expectedType: 'video',
                        sourceLabel: 'Merge Videos',
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

          {outputBlob && (
            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>Merged {clips.length} clips cleanly into universal MP4!</span>
            </div>
          )}
        </>
      )}

      {clips.length === 0 && error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
