'use client';

import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Loader2, Sparkles, Check } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { downloadBlob, formatBytes, baseName } from '../../lib/format';

const BACKDROPS = [
  { id: 'transparent', label: 'Transparent', className: 'bg-checkerboard', fill: null },
  { id: 'white', label: 'Pure White', className: 'bg-white', fill: '#ffffff' },
  { id: 'sky', label: 'Daylight Blue', className: 'bg-gradient-to-br from-blue-100 to-indigo-100', fill: '#dbeafe' },
  { id: 'warm', label: 'Warm Studio', className: 'bg-gradient-to-br from-amber-50 to-rose-100', fill: '#ffe4e6' },
];

export function BackgroundRemoverTool() {
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState(null);
  const [resultBlob, setResultBlob] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [backdrop, setBackdrop] = useState(BACKDROPS[0]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [sourceUrl, resultUrl]);

  const handleFiles = async (files) => {
    const file = files[0];
    if (!file) return;
    setError('');
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);

    const nextSource = URL.createObjectURL(file);
    setSourceFile(file);
    setSourceUrl(nextSource);
    setResultBlob(null);
    setResultUrl(null);
    setShowOriginal(false);
    setProcessing(true);
    setStatusText('Loading on-device AI model...');

    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(file, {
        progress: (key, current, total) => {
          if (total > 0) {
            const pct = Math.min(100, Math.round((current / total) * 100));
            setStatusText(
              key.includes('fetch')
                ? `Caching on-device AI weights (${pct}%)...`
                : `Removing background locally (${pct}%)...`
            );
          }
        },
      });
      const outUrl = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(outUrl);
    } catch (err) {
      console.error(err);
      setError('Could not process this image locally. Try a standard JPG, PNG, or WebP photo.');
    } finally {
      setProcessing(false);
      setStatusText('');
    }
  };

  const handleDownload = async () => {
    if (!resultBlob || !sourceFile) return;
    if (!backdrop.fill) {
      downloadBlob(resultBlob, `${baseName(sourceFile.name)}-nobg.png`);
      return;
    }

    // Composite onto selected solid studio backdrop
    const img = new Image();
    img.src = resultUrl;
    await new Promise((resolve) => { img.onload = resolve; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = backdrop.fill;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((composited) => {
      if (composited) {
        downloadBlob(composited, `${baseName(sourceFile.name)}-${backdrop.id}.png`);
      }
    }, 'image/png');
  };

  if (!sourceFile) {
    return (
      <Dropzone
        accept="image/jpeg,image/png,image/webp"
        onFiles={handleFiles}
        title="Drop a photo to remove its background"
        subtitle="JPG, PNG, or WebP — On-device neural segmentation with instant transparent PNG export."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top File Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-canvas-300 bg-canvas-100 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate text-sm font-bold text-ink-900">{sourceFile.name}</span>
          <span className="rounded-md bg-white border border-canvas-300 px-2 py-0.5 text-xs font-mono text-ink-500">
            {formatBytes(sourceFile.size)}
          </span>
          {resultBlob && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <Check size={12} /> Ready ({formatBytes(resultBlob.size)})
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setSourceFile(null);
            setResultBlob(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>New Photo</span>
        </button>
      </div>

      {/* Preview Stage */}
      <div
        className={`relative flex min-h-[340px] max-h-[520px] items-center justify-center overflow-hidden rounded-2xl border border-canvas-300 p-4 ${
          showOriginal ? 'bg-canvas-200' : backdrop.className
        }`}
      >
        <img
          src={showOriginal || !resultUrl ? sourceUrl : resultUrl}
          alt={showOriginal ? 'Original uploaded photo' : 'Background removed preview'}
          className="max-h-[460px] w-auto object-contain rounded-lg"
        />

        {processing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur-sm p-6 text-center">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <div className="text-sm font-bold text-ink-900">{statusText || 'Running local AI...'}</div>
            <p className="max-w-sm text-xs text-ink-500">
              First run caches the on-device neural model locally in your browser. Subsequent photos finish in seconds.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Controls & Download */}
      {resultBlob && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-500 mr-1">Backdrop:</span>
            {BACKDROPS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setShowOriginal(false);
                  setBackdrop(b);
                }}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  !showOriginal && backdrop.id === b.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-canvas-300 bg-white text-ink-700 hover:bg-canvas-100'
                }`}
              >
                {b.label}
              </button>
            ))}

            <button
              type="button"
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onMouseLeave={() => setShowOriginal(false)}
              onClick={() => setShowOriginal((v) => !v)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                showOriginal
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-canvas-300 bg-canvas-100 text-ink-700 hover:bg-canvas-200'
              }`}
            >
              {showOriginal ? 'Showing Original' : 'Compare Original'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors cursor-pointer"
          >
            <Download size={16} />
            <span>Download PNG</span>
          </button>
        </div>
      )}
    </div>
  );
}
