'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AudioLines, Download, Loader2, RefreshCw, Volume2 } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { getFFmpeg, clearFFmpegProgress, fileToUint8Array, uint8ToBlob } from '../../lib/ffmpegClient';
import { formatBytes, formatTime, downloadBlob, baseName } from '../../lib/format';

export function AudioCutterTool() {
  const canvasRef = useRef(null);
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [peaks, setPeaks] = useState([]);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(10);
  const [volumePct, setVolumePct] = useState(100);
  const [fade, setFade] = useState(true);
  const [format, setFormat] = useState('mp3');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputBlob, setOutputBlob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const decodeWaveform = async (f) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = await ctx.decodeAudioData(await f.arrayBuffer());
      const channel = buf.getChannelData(0);
      const samples = 110;
      const step = Math.max(1, Math.floor(channel.length / samples));
      const arr = [];
      for (let i = 0; i < samples; i++) {
        let peak = 0;
        for (let j = 0; j < step; j++) {
          const val = Math.abs(channel[i * step + j] || 0);
          if (val > peak) peak = val;
        }
        arr.push(peak);
      }
      setPeaks(arr);
      setDuration(buf.duration);
      setStart(0);
      setEnd(Number(buf.duration.toFixed(1)));
      ctx.close();
    } catch (_) {
      setPeaks([]);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0 || duration <= 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const startRatio = start / duration;
    const endRatio = end / duration;
    const barW = w / peaks.length;

    peaks.forEach((p, idx) => {
      const ratio = idx / peaks.length;
      const inRange = ratio >= startRatio && ratio <= endRatio;
      const barH = Math.max(4, p * (h - 16));
      const x = idx * barW;
      const y = (h - barH) / 2;
      ctx.fillStyle = inRange ? '#2563eb' : '#cbd5e1';
      ctx.beginPath();
      ctx.roundRect(x + 1, y, Math.max(2, barW - 2.5), barH, 3);
      ctx.fill();
    });
  }, [peaks, start, end, duration]);

  const handleFiles = async (files) => {
    const f = files[0];
    if (!f) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(f);
    setAudioUrl(URL.createObjectURL(f));
    setOutputBlob(null);
    setError('');
    await decodeWaveform(f);
  };

  const handleProcess = async () => {
    if (!file || end <= start) return;
    setProcessing(true);
    setError('');
    setProgress(10);

    try {
      const ffmpeg = await getFFmpeg((pct) => setProgress(Math.max(15, pct)));
      const inExt = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const inName = `audio.${inExt}`;
      const outName = `edited.${format}`;
      await ffmpeg.writeFile(inName, await fileToUint8Array(file));

      const segDur = Math.max(0.2, end - start);
      const filters = [`volume=${(volumePct / 100).toFixed(2)}`];
      if (fade && segDur >= 1.2) {
        const fadeDur = Math.min(1, segDur / 4);
        filters.push(`afade=t=in:st=0:d=${fadeDur.toFixed(2)}`);
        filters.push(`afade=t=out:st=${(segDur - fadeDur).toFixed(2)}:d=${fadeDur.toFixed(2)}`);
      }

      const codecArgs =
        format === 'wav'
          ? ['-acodec', 'pcm_s16le']
          : ['-acodec', 'libmp3lame', '-b:a', '192k'];

      const exitCode = await ffmpeg.exec([
        '-ss', start.toFixed(2),
        '-t', segDur.toFixed(2),
        '-i', inName,
        '-af', filters.join(','),
        ...codecArgs,
        outName,
      ]);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outName);
      setOutputBlob(uint8ToBlob(data, format === 'wav' ? 'audio/wav' : 'audio/mpeg'));
      setProgress(100);

      await ffmpeg.deleteFile(inName).catch(() => {});
      await ffmpeg.deleteFile(outName).catch(() => {});
    } catch (err) {
      console.error(err);
      setError('Audio processing failed in browser. Try MP3 or WAV input.');
    } finally {
      clearFFmpegProgress();
      setProcessing(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="audio/*"
        onFiles={handleFiles}
        title="Drop an audio file to cut & boost volume"
        subtitle="MP3, WAV, M4A, OGG, or FLAC — visual waveform scrubber with fades and up to 300% volume boost."
        allowPaste={false}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-canvas-300 bg-canvas-100 px-4 py-3">
        <span className="truncate text-sm font-bold text-ink-900">
          {file.name} <span className="font-mono text-xs font-normal text-ink-500">({formatBytes(file.size)})</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setFile(null);
            setOutputBlob(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>New Audio</span>
        </button>
      </div>

      {/* Live Waveform Canvas */}
      <div className="rounded-2xl border border-canvas-300 bg-canvas-100 p-4 flex flex-col gap-3">
        <canvas ref={canvasRef} width={760} height={110} className="w-full h-24 rounded-lg" />
        <audio
          src={audioUrl}
          controls
          onLoadedMetadata={(e) => {
            if ((!duration || duration <= 0) && Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
              const d = e.currentTarget.duration;
              setDuration(d);
              setEnd(Number(d.toFixed(1)));
            }
          }}
          className="w-full"
        />
      </div>

      {/* Trim + Volume + Fade Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-canvas-300 bg-white p-4 flex flex-col gap-3">
          <div className="flex justify-between text-xs font-bold text-ink-700">
            <label htmlFor="aud-start">Start: {formatTime(start)}</label>
            <label htmlFor="aud-end">End: {formatTime(end)}</label>
          </div>
          <input
            id="aud-start"
            type="range"
            min="0"
            max={Math.max(0.1, duration)}
            step="0.1"
            value={start}
            onChange={(e) => setStart(Math.min(Number(e.target.value), Math.max(0, end - 0.2)))}
            className="accent-blue-600 cursor-pointer"
          />
          <input
            id="aud-end"
            type="range"
            min="0"
            max={Math.max(0.1, duration)}
            step="0.1"
            value={end}
            onChange={(e) => setEnd(Math.max(Number(e.target.value), Math.min(duration, start + 0.2)))}
            className="accent-blue-600 cursor-pointer"
          />
        </div>

        <div className="rounded-2xl border border-canvas-300 bg-white p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-bold text-ink-700">
            <label htmlFor="aud-vol" className="inline-flex items-center gap-1.5">
              <Volume2 size={14} className="text-blue-600" />
              <span>Volume Boost</span>
            </label>
            <span className="font-mono text-blue-600">{volumePct}%</span>
          </div>
          <input
            id="aud-vol"
            type="range"
            min="50"
            max="300"
            step="10"
            value={volumePct}
            onChange={(e) => setVolumePct(Number(e.target.value))}
            className="accent-blue-600 cursor-pointer"
          />

          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={fade}
                onChange={(e) => setFade(e.target.checked)}
                className="h-4 w-4 accent-blue-600 rounded cursor-pointer"
              />
              <span>Smooth Fade-In & Fade-Out</span>
            </label>

            <div className="flex gap-1">
              {['mp3', 'wav'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase font-mono cursor-pointer ${
                    format === fmt ? 'border-blue-600 bg-blue-600 text-white' : 'border-canvas-300 bg-canvas-100 text-ink-700'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={processing}
          onClick={handleProcess}
          className="inline-flex items-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
        >
          {processing ? <Loader2 size={15} className="animate-spin" /> : <AudioLines size={15} />}
          <span>{processing ? `Rendering (${progress}%)...` : `Export ${format.toUpperCase()}`}</span>
        </button>

        {outputBlob && (
          <button
            type="button"
            onClick={() => downloadBlob(outputBlob, `${baseName(file.name)}-cut.${format}`)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
          >
            <Download size={15} />
            <span>Download .{format.toUpperCase()} ({formatBytes(outputBlob.size)})</span>
          </button>
        )}
      </div>
    </div>
  );
}
