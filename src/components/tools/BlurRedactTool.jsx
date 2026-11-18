'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EyeOff, Undo2, Trash2, Download, RefreshCw, Copy, Check, ShieldCheck } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { downloadBlob, formatBytes, baseName } from '../../lib/format';
import { copyImageBlobToClipboard } from '../../lib/clipboard';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MB safe canvas limit

const MODES = [
  { id: 'box', label: 'Solid Black Box', desc: '100% opaque redaction' },
  { id: 'pixelate', label: 'Pixelate Mosaic', desc: 'Heavy mosaic blocks' },
  { id: 'blur', label: 'Heavy Blur', desc: 'Irreversible pixel blur' },
];

/**
 * Permanently applies a redaction region onto a CanvasRenderingContext2D.
 * Pixel data inside the region is irreversibly overwritten (no reversible layers).
 */
function applyRegionIrreversibly(ctx, img, region) {
  const rx = Math.max(0, Math.floor(region.x));
  const ry = Math.max(0, Math.floor(region.y));
  const rw = Math.min(ctx.canvas.width - rx, Math.ceil(region.w));
  const rh = Math.min(ctx.canvas.height - ry, Math.ceil(region.h));
  if (rw < 2 || rh < 2) return;

  if (region.mode === 'box') {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();
    return;
  }

  // Pixelate & Blur both downscale into a tiny offscreen buffer so original pixel detail is destroyed
  const factor = Math.max(6, Math.min(48, region.strength || 18));
  const smallW = Math.max(1, Math.round(rw / factor));
  const smallH = Math.max(1, Math.round(rh / factor));
  const tmp = document.createElement('canvas');
  tmp.width = smallW;
  tmp.height = smallH;
  const tctx = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(img, rx, ry, rw, rh, 0, 0, smallW, smallH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();

  if (region.mode === 'pixelate') {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, smallW, smallH, rx, ry, rw, rh);
  } else {
    // Heavy blur: smooth upscale from heavily downscaled buffer + optional blur filter
    ctx.imageSmoothingEnabled = true;
    if ('filter' in ctx) {
      ctx.filter = `blur(${Math.max(4, Math.round(factor / 2))}px)`;
    }
    ctx.drawImage(tmp, 0, 0, smallW, smallH, rx - factor, ry - factor, rw + factor * 2, rh + factor * 2);
    if ('filter' in ctx) ctx.filter = 'none';
  }
  ctx.restore();
}

export function BlurRedactTool() {
  const canvasRef = useRef(null);
  const copyTimerRef = useRef(null);
  const draftRef = useRef(null);

  const [file, setFile] = useState(null);
  const [imgObj, setImgObj] = useState(null);
  const [mode, setMode] = useState('box');
  const [strength, setStrength] = useState(18);
  const [exportFormat, setExportFormat] = useState('image/png');
  const [regions, setRegions] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleFiles = (files) => {
    const f = files[0];
    if (!f) return;
    setError('');
    setCopyMsg('');
    if (f.size === 0) {
      setError('This image file is empty (0 bytes).');
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError('Image exceeds 50 MB limit. Compress or resize it first in Image Studio.');
      return;
    }

    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setFile(f);
      setImgObj(img);
      setRegions([]);
      setDraft(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Could not decode this image file. Please try a valid JPG, PNG, or WebP photo.');
    };
    img.src = url;
  };

  const renderComposite = useCallback(
    (canvas, includeDraft) => {
      if (!canvas || !imgObj) return;
      canvas.width = imgObj.naturalWidth;
      canvas.height = imgObj.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgObj, 0, 0);

      for (const r of regions) {
        applyRegionIrreversibly(ctx, imgObj, r);
      }

      if (includeDraft && draft) {
        applyRegionIrreversibly(ctx, imgObj, draft);
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = Math.max(2, Math.round(Math.max(canvas.width, canvas.height) / 350));
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(draft.x, draft.y, draft.w, draft.h);
        ctx.restore();
      }
    },
    [imgObj, regions, draft]
  );

  useEffect(() => {
    if (canvasRef.current && imgObj) {
      renderComposite(canvasRef.current, true);
    }
  }, [imgObj, regions, draft, renderComposite]);

  const toImageCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY)),
    };
  };

  const onPointerDown = (e) => {
    if (!canvasRef.current || !imgObj) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    const pt = toImageCoords(e);
    const nextDraft = {
      startX: pt.x,
      startY: pt.y,
      x: pt.x,
      y: pt.y,
      w: 0,
      h: 0,
      mode,
      strength,
    };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  };

  const onPointerMove = (e) => {
    const cur = draftRef.current;
    if (!cur) return;
    const pt = toImageCoords(e);
    const x = Math.min(cur.startX, pt.x);
    const y = Math.min(cur.startY, pt.y);
    const w = Math.abs(pt.x - cur.startX);
    const h = Math.abs(pt.y - cur.startY);
    const updated = { ...cur, x, y, w, h };
    draftRef.current = updated;
    setDraft(updated);
  };

  const onPointerUp = () => {
    const cur = draftRef.current;
    if (!cur) return;
    draftRef.current = null;
    if (cur.w >= 4 && cur.h >= 4) {
      const { startX, startY, ...finalRegion } = cur;
      setRegions((prev) => [...prev, finalRegion]);
    }
    setDraft(null);
  };

  const buildFlattenedBlob = (mime = exportFormat) => {
    const out = document.createElement('canvas');
    renderComposite(out, false);
    if (mime === 'image/jpeg') {
      // Composite white backdrop for JPEG so transparent areas never turn black
      const jpgCanvas = document.createElement('canvas');
      jpgCanvas.width = out.width;
      jpgCanvas.height = out.height;
      const jctx = jpgCanvas.getContext('2d');
      jctx.fillStyle = '#ffffff';
      jctx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
      jctx.drawImage(out, 0, 0);
      return new Promise((resolve) => jpgCanvas.toBlob(resolve, 'image/jpeg', 0.94));
    }
    return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  };

  const handleDownload = async () => {
    if (!imgObj || !file) return;
    const blob = await buildFlattenedBlob(exportFormat);
    if (!blob) return;
    const ext = exportFormat === 'image/jpeg' ? 'jpg' : 'png';
    downloadBlob(blob, `${baseName(file.name)}-redacted.${ext}`);
  };

  const handleCopy = async () => {
    if (!imgObj) return;
    setCopyMsg('');
    const blob = await buildFlattenedBlob('image/png');
    const res = await copyImageBlobToClipboard(blob);
    if (res.ok) {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyMsg(res.reason);
    }
  };

  if (!imgObj) {
    return (
      <div className="flex flex-col gap-3">
        <Dropzone
          accept="image/*"
          onFiles={handleFiles}
          title="Drop a photo or screenshot to blur or redact"
          subtitle="Draw over faces, license plates, emails, or API keys — exported flat with irreversible pixel destruction and EXIF/GPS stripped."
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
            {imgObj.naturalWidth}×{imgObj.naturalHeight} · {formatBytes(file.size)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setImgObj(null);
            setFile(null);
            setRegions([]);
            setDraft(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 px-3 py-1.5 text-xs font-semibold text-ink-700 cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>New Image</span>
        </button>
      </div>

      {/* Mode + Strength Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-2xl border border-canvas-300 bg-canvas-100 p-4 items-center">
        <div className="md:col-span-7 grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer ${
                mode === m.id
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-canvas-300 bg-white text-ink-700 hover:bg-canvas-200/50'
              }`}
            >
              <div className="text-xs font-bold">{m.label}</div>
              <div className="text-[10px] text-ink-500 hidden sm:block">{m.desc}</div>
            </button>
          ))}
        </div>

        <div className="md:col-span-5 flex flex-col gap-1.5">
          {mode !== 'box' ? (
            <>
              <div className="flex items-center justify-between text-xs font-bold text-ink-700">
                <label htmlFor="redact-strength">Intensity</label>
                <span className="font-mono text-blue-600">{strength}px</span>
              </div>
              <input
                id="redact-strength"
                type="range"
                min="8"
                max="40"
                step="2"
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                className="accent-blue-600 cursor-pointer"
              />
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              <span>Solid black box permanently overwrites pixels.</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Canvas Stage */}
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-canvas-300 bg-canvas-200/70 p-3 sm:p-5">
        <p className="text-xs font-medium text-ink-600">
          Click and drag directly on the image to redact sensitive areas ({regions.length} region{regions.length === 1 ? '' : 's'} drawn)
        </p>
        <canvas
          ref={canvasRef}
          data-testid="redact-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="max-h-[480px] max-w-full w-auto h-auto rounded-lg border border-canvas-300 bg-white shadow-card cursor-crosshair touch-none"
        />
      </div>

      {/* Undo / Clear / Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={regions.length === 0}
            onClick={() => setRegions((prev) => prev.slice(0, -1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-100 disabled:opacity-40 px-3 py-2 text-xs font-bold text-ink-700 cursor-pointer"
          >
            <Undo2 size={14} />
            <span>Undo</span>
          </button>
          <button
            type="button"
            disabled={regions.length === 0}
            onClick={() => setRegions([])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-100 disabled:opacity-40 px-3 py-2 text-xs font-bold text-ink-700 cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Clear All</span>
          </button>
          <div className="flex gap-1 ml-1">
            {[
              { mime: 'image/png', label: 'PNG' },
              { mime: 'image/jpeg', label: 'JPG' },
            ].map((fmt) => (
              <button
                key={fmt.mime}
                type="button"
                onClick={() => setExportFormat(fmt.mime)}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold font-mono cursor-pointer ${
                  exportFormat === fmt.mime
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-canvas-300 bg-white text-ink-700'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-100 px-4 py-2.5 text-sm font-bold text-ink-800 cursor-pointer"
          >
            {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
            <span>{copied ? 'Copied!' : 'Copy PNG'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
          >
            <Download size={15} />
            <span>Download Clean {exportFormat === 'image/jpeg' ? 'JPG' : 'PNG'}</span>
          </button>
        </div>
      </div>

      {copyMsg && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
          {copyMsg}
        </div>
      )}
    </div>
  );
}
