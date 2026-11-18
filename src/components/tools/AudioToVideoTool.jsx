'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Radio, Play, Square, Download, RefreshCw, Crown } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { downloadBlob, formatBytes, baseName } from '../../lib/format';
import { useStudio } from '../StudioProvider';

const THEMES = [
  { id: 'daylight', label: 'Daylight Sky', c1: '#eff6ff', c2: '#dbeafe', bar: '#2563eb', text: '#0f172a', sub: '#475569' },
  { id: 'sunrise', label: 'Warm Editorial', c1: '#fffbeb', c2: '#ffe4e6', bar: '#e11d48', text: '#0f172a', sub: '#475569' },
  { id: 'mint', label: 'Fresh Porcelain', c1: '#ecfdf5', c2: '#e0f2fe', bar: '#059669', text: '#0f172a', sub: '#475569' },
  { id: 'obsidian', label: 'Studio Slate', c1: '#0f172a', c2: '#1e293b', bar: '#60a5fa', text: '#ffffff', sub: '#94a3b8' },
];

const RATIOS = [
  { id: '16:9', label: '16:9 Landscape', w: 960, h: 540 },
  { id: '1:1', label: '1:1 Square', w: 720, h: 720 },
  { id: '9:16', label: '9:16 Reels/Shorts', w: 540, h: 960 },
];

export function AudioToVideoTool() {
  const { isPro, openProModal } = useStudio();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('Episode 12 · Building in Public');
  const [subtitle, setSubtitle] = useState('Audio Highlight · ClipForge Studio');
  const [theme, setTheme] = useState(THEMES[0]);
  const [ratio, setRatio] = useState(RATIOS[0]);
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalSec, setTotalSec] = useState(0);
  const [videoBlob, setVideoBlob] = useState(null);
  const [error, setError] = useState('');

  // Draw static preview whenever settings change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawFrame(canvas, null, theme, title, subtitle, !isPro);
  }, [theme, ratio, title, subtitle, isPro, file]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { sourceNodeRef.current?.stop(); } catch (_) {}
      if (recorderRef.current?.state === 'recording') {
        try { recorderRef.current.stop(); } catch (_) {}
      }
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  function drawFrame(canvas, freqData, activeTheme, heading, sub, showWatermark) {
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, activeTheme.c1);
    grad.addColorStop(1, activeTheme.c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle glass inner frame
    const pad = Math.min(w, h) * 0.08;
    ctx.fillStyle = activeTheme.id === 'obsidian' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)';
    ctx.strokeStyle = activeTheme.id === 'obsidian' ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, 28);
    ctx.fill();
    ctx.stroke();

    // Title & subtitle
    ctx.textAlign = 'center';
    ctx.fillStyle = activeTheme.text;
    ctx.font = `800 ${Math.round(Math.min(w, h) * 0.052)}px Inter, system-ui, sans-serif`;
    ctx.fillText(heading || 'Audio Clip', w / 2, pad + h * 0.22, w - pad * 3);

    ctx.fillStyle = activeTheme.sub;
    ctx.font = `500 ${Math.round(Math.min(w, h) * 0.028)}px Inter, system-ui, sans-serif`;
    ctx.fillText(sub || '', w / 2, pad + h * 0.29, w - pad * 3);

    // Animated waveform bars
    const barCount = 44;
    const waveW = w - pad * 3.4;
    const startX = (w - waveW) / 2;
    const centerY = h * 0.62;
    const maxBarH = h * 0.28;
    const slotW = waveW / barCount;

    ctx.fillStyle = activeTheme.bar;
    for (let i = 0; i < barCount; i++) {
      const level = freqData
        ? freqData[Math.floor((i / barCount) * (freqData.length * 0.7))] / 255
        : 0.25 + 0.45 * Math.abs(Math.sin(i * 0.45 + 0.5));
      const bh = Math.max(10, level * maxBarH);
      const x = startX + i * slotW;
      ctx.beginPath();
      ctx.roundRect(x + 2, centerY - bh / 2, Math.max(4, slotW - 5), bh, 999);
      ctx.fill();
    }

    if (showWatermark) {
      ctx.fillStyle = activeTheme.sub;
      ctx.font = `600 13px ui-monospace, monospace`;
      ctx.textAlign = 'right';
      ctx.fillText('Made with ClipForge', w - pad - 18, h - pad - 16);
    }
  }

  const startRecording = async () => {
    if (!file || !canvasRef.current) return;
    setError('');
    setVideoBlob(null);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const decoded = await audioCtx.decodeAudioData(await file.arrayBuffer());
      setTotalSec(decoded.duration || 0);
      setElapsedSec(0);
      const startTimestamp = performance.now();

      const source = audioCtx.createBufferSource();
      source.buffer = decoded;
      sourceNodeRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const dest = audioCtx.createMediaStreamDestination();
      source.connect(analyser);
      analyser.connect(dest);
      analyser.connect(audioCtx.destination);

      const canvasStream = canvasRef.current.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const chunks = [];
      const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 3_500_000 });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setRecording(false);
        setVideoBlob(new Blob(chunks, { type: mimeType }));
        audioCtx.close().catch(() => {});
      };

      const renderLoop = () => {
        analyser.getByteFrequencyData(freqData);
        setElapsedSec(Math.min(decoded.duration || 0, (performance.now() - startTimestamp) / 1000));
        if (canvasRef.current) {
          drawFrame(canvasRef.current, freqData, theme, title, subtitle, !isPro);
        }
        rafRef.current = requestAnimationFrame(renderLoop);
      };

      setRecording(true);
      recorder.start();
      renderLoop();
      source.start(0);
      source.onended = () => {
        if (recorder.state === 'recording') recorder.stop();
      };
    } catch (err) {
      console.error(err);
      setRecording(false);
      setError('Could not record audiogram in this browser. Try Chrome or Edge with an MP3/WAV file.');
    }
  };

  const stopRecording = () => {
    try {
      sourceNodeRef.current?.stop();
    } catch (_) {}
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="audio/*"
        onFiles={(files) => {
          setFile(files[0]);
          setVideoBlob(null);
        }}
        title="Drop an audio clip to turn into a waveform video"
        subtitle="Podcast highlights, voice notes, or music snippets rendered into crisp 16:9, 1:1, or 9:16 videos."
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
          disabled={recording}
          onClick={() => {
            setFile(null);
            setVideoBlob(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Change Audio</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Live Canvas Preview */}
        <div className="lg:col-span-7 flex items-center justify-center rounded-2xl border border-canvas-300 bg-canvas-200/70 p-4">
          <canvas
            ref={canvasRef}
            width={ratio.w}
            height={ratio.h}
            className="max-h-[420px] max-w-full rounded-xl shadow-card object-contain"
          />
        </div>

        {/* Customization Controls */}
        <div className="lg:col-span-5 flex flex-col gap-4 rounded-2xl border border-canvas-300 bg-canvas-100 p-4">
          <div>
            <label htmlFor="av-title" className="block text-xs font-bold text-ink-700 mb-1">
              Headline
            </label>
            <input
              id="av-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-canvas-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="av-sub" className="block text-xs font-bold text-ink-700 mb-1">
              Subtitle / Author
            </label>
            <input
              id="av-sub"
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-lg border border-canvas-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-bold text-ink-700 mb-1.5">Aspect Ratio</span>
            <div className="grid grid-cols-3 gap-1.5">
              {RATIOS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={recording}
                  onClick={() => setRatio(r)}
                  className={`rounded-lg border py-1.5 text-[11px] font-bold cursor-pointer ${
                    ratio.id === r.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-canvas-300 bg-white text-ink-700'
                  }`}
                >
                  {r.id}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-ink-700 mb-1.5">Studio Palette</span>
            <div className="grid grid-cols-2 gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={recording}
                  onClick={() => setTheme(t)}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                    theme.id === t.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-canvas-300 bg-white text-ink-700'
                  }`}
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: t.bar }} />
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {!isPro && (
            <button
              type="button"
              onClick={() => openProModal('Remove the corner watermark on animated waveform videos with ClipForge Pro Annual ($29/year).')}
              className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-left text-xs font-semibold text-blue-800 flex items-center justify-between cursor-pointer hover:bg-blue-50"
            >
              <span className="inline-flex items-center gap-1.5">
                <Crown size={13} />
                <span>Remove watermark with Pro Annual</span>
              </span>
              <span className="font-mono text-[11px] font-bold">$29/yr</span>
            </button>
          )}

          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

          <div className="flex flex-col gap-2 pt-1">
            {!recording ? (
              <button
                type="button"
                onClick={startRecording}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
              >
                <Play size={15} />
                <span>Render Live Waveform Video</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-sm font-bold text-white cursor-pointer"
              >
                <Square size={14} />
                <span>
                  Stop &amp; Save ({elapsedSec.toFixed(1)}s / {totalSec.toFixed(1)}s)
                </span>
              </button>
            )}

            {videoBlob && (
              <button
                type="button"
                onClick={() => downloadBlob(videoBlob, `${baseName(file.name)}-waveform.webm`)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 py-2.5 text-sm font-bold text-white cursor-pointer"
              >
                <Download size={15} />
                <span>Download Video ({formatBytes(videoBlob.size)})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
