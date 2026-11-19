'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Download, Grid2X2, RefreshCw, ZoomIn, Crown, Copy, Check } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { downloadBlob } from '../../lib/format';
import { copyImageBlobToClipboard } from '../../lib/clipboard';
import { useStudio } from '../StudioProvider';

const COUNTRIES = [
  { id: 'in', label: 'India / EU / UK (35×45mm)', wPx: 413, hPx: 531, cols: 4, rows: 2, gap: 24 },
  { id: 'us', label: 'United States (2×2 in)', wPx: 600, hPx: 600, cols: 3, rows: 2, gap: 0 },
  { id: 'ca', label: 'Canada (50×70mm)', wPx: 590, hPx: 827, cols: 2, rows: 1, gap: 24 },
];

const BG_TINTS = [
  { id: 'white', label: 'Pure White', hex: '#ffffff' },
  { id: 'offwhite', label: 'Soft Studio White', hex: '#f8fafc' },
  { id: 'light-blue', label: 'Visa Light Blue', hex: '#e0f2fe' },
];

const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MB in-browser safety limit

export function PassportPhotoTool() {
  const { isPro, openProModal, consumeHandoff } = useStudio();
  const previewCanvasRef = useRef(null);
  const [imgObj, setImgObj] = useState(null);
  const [handoffSource, setHandoffSource] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [bgTint, setBgTint] = useState(BG_TINTS[0]);
  const [zoom, setZoom] = useState(1.1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const copyTimerRef = useRef(null);

  useEffect(() => {
    const incoming = consumeHandoff('passport-photo', 'image');
    if (incoming?.file) {
      setHandoffSource(incoming.sourceLabel || 'ClipForge');
      handleFiles([incoming.file]);
    }
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [consumeHandoff]);

  const handleFiles = (files) => {
    const f = files[0];
    if (!f) return;
    setError('');
    if (f.size === 0) {
      setError('This photo file is empty (0 bytes). Please choose a valid portrait photo.');
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError('This photo exceeds 50 MB. Choose a smaller image so your browser tab stays responsive.');
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setImgObj(img);
      setZoom(1.1);
      setOffsetX(0);
      setOffsetY(0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Could not read this image file. Please try a valid JPG, PNG, or WebP portrait photo.');
    };
    img.src = url;
  };

  const renderPhotoToCanvas = (canvas, includeGuide) => {
    if (!canvas || !imgObj) return;
    const ctx = canvas.getContext('2d');
    const w = country.wPx;
    const h = country.hPx;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = bgTint.hex;
    ctx.fillRect(0, 0, w, h);

    const coverScale = Math.max(w / imgObj.naturalWidth, h / imgObj.naturalHeight) * zoom;
    const drawW = imgObj.naturalWidth * coverScale;
    const drawH = imgObj.naturalHeight * coverScale;
    const dx = (w - drawW) / 2 + offsetX;
    const dy = (h - drawH) / 2 + offsetY;
    ctx.drawImage(imgObj, dx, dy, drawW, drawH);

    if (includeGuide) {
      ctx.save();
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.75)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.44, w * 0.27, h * 0.29, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Eye line
      ctx.strokeStyle = 'rgba(5, 150, 105, 0.7)';
      ctx.beginPath();
      ctx.moveTo(w * 0.15, h * 0.42);
      ctx.lineTo(w * 0.85, h * 0.42);
      ctx.stroke();
      ctx.restore();
    }
  };

  useEffect(() => {
    if (previewCanvasRef.current && imgObj) {
      renderPhotoToCanvas(previewCanvasRef.current, showGuide);
    }
  }, [imgObj, country, bgTint, zoom, offsetX, offsetY, showGuide]);

  const exportSingle = () => {
    const out = document.createElement('canvas');
    renderPhotoToCanvas(out, false);
    out.toBlob((blob) => {
      if (blob) downloadBlob(blob, `passport-photo-${country.id}-300dpi.jpg`);
    }, 'image/jpeg', 0.96);
  };

  const copySingle = async () => {
    setCopyMsg('');
    const out = document.createElement('canvas');
    renderPhotoToCanvas(out, false);
    const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
    const res = await copyImageBlobToClipboard(blob);
    if (res.ok) {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyMsg(res.reason);
    }
  };

  const exportPrintSheet = () => {
    if (!isPro) {
      openProModal('Generating ready-to-print 300 DPI 4×6 inch photo sheets is unlocked with ClipForge Pro Annual ($29/year).');
      return;
    }
    const single = document.createElement('canvas');
    renderPhotoToCanvas(single, false);

    // 6x4 inch landscape at 300 DPI = 1800 x 1200 px
    const sheet = document.createElement('canvas');
    sheet.width = 1800;
    sheet.height = 1200;
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheet.width, sheet.height);

    const gap = country.gap ?? 24;
    const totalW = country.cols * country.wPx + (country.cols - 1) * gap;
    const totalH = country.rows * country.hPx + (country.rows - 1) * gap;
    const startX = Math.max(0, Math.floor((sheet.width - totalW) / 2));
    const startY = Math.max(0, Math.floor((sheet.height - totalH) / 2));

    for (let r = 0; r < country.rows; r++) {
      for (let c = 0; c < country.cols; c++) {
        const x = startX + c * (country.wPx + gap);
        const y = startY + r * (country.hPx + gap);
        ctx.drawImage(single, x, y);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, country.wPx, country.hPx);
      }
    }

    sheet.toBlob((blob) => {
      if (blob) downloadBlob(blob, `passport-4x6-sheet-${country.id}-300dpi.jpg`);
    }, 'image/jpeg', 0.96);
  };

  if (!imgObj) {
    return (
      <div className="flex flex-col gap-3">
        <Dropzone
          accept="image/*"
          onFiles={handleFiles}
          title="Drop a portrait photo for Passport / Visa ID"
          subtitle="Official India, US, UK, EU & Canada 300 DPI sizing with face alignment guide and 4×6 print sheet."
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-6 flex flex-col items-center gap-3 rounded-2xl border border-canvas-300 bg-canvas-100 p-6">
        <canvas
          ref={previewCanvasRef}
          className="max-h-[380px] w-auto rounded-lg border border-canvas-300 shadow-card bg-white"
        />
        <span className="text-[11px] font-mono text-ink-500">
          {country.wPx} × {country.hPx} px (300 DPI Print Standard)
        </span>
      </div>

      <div className="lg:col-span-6 flex flex-col gap-4 rounded-2xl border border-canvas-300 bg-canvas-100 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500 font-mono">
            Country & Alignment
          </span>
          <button
            type="button"
            onClick={() => {
              setImgObj(null);
              setHandoffSource('');
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-600 hover:text-ink-900 cursor-pointer"
          >
            <RefreshCw size={12} />
            <span>New Photo</span>
          </button>
        </div>

        {handoffSource && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            Loaded directly from {handoffSource} (in-memory)
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {COUNTRIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCountry(c)}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-bold cursor-pointer ${
                country.id === c.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-canvas-300 bg-white text-ink-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {BG_TINTS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setBgTint(t)}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold cursor-pointer ${
                bgTint.id === t.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-canvas-300 bg-white text-ink-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-700">
            <label htmlFor="pp-zoom" className="inline-flex items-center gap-1"><ZoomIn size={13} /> Zoom</label>
            <span className="font-mono">{Math.round(zoom * 100)}%</span>
          </div>
          <input id="pp-zoom" type="range" min="0.8" max="2.5" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="accent-blue-600 cursor-pointer" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pp-x" className="block text-[11px] font-semibold text-ink-600 mb-1">Horizontal Shift</label>
              <input id="pp-x" type="range" min="-200" max="200" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
            </div>
            <div>
              <label htmlFor="pp-y" className="block text-[11px] font-semibold text-ink-600 mb-1">Vertical Shift</label>
              <input id="pp-y" type="range" min="-200" max="200" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-700 cursor-pointer">
            <input type="checkbox" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} className="h-4 w-4 accent-blue-600 cursor-pointer" />
            <span>Show Face &amp; Eye Alignment Guide</span>
          </label>

          <Link
            href="/tools/background-remover"
            className="text-xs font-semibold text-blue-600 hover:underline w-fit"
          >
            Need a clean white background first? Open Background Remover &rarr;
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={exportSingle}
            className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 px-4 text-xs font-bold text-white shadow-sm cursor-pointer"
          >
            <Download size={14} />
            <span>Download Single</span>
          </button>

          <button
            type="button"
            onClick={copySingle}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-200 py-2.5 px-3.5 text-xs font-bold text-ink-800 cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={exportPrintSheet}
            className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 py-2.5 px-4 text-xs font-bold text-white cursor-pointer"
          >
            <Grid2X2 size={14} />
            <span>4×6 Print Sheet</span>
            {!isPro && <Crown size={12} className="text-amber-400" />}
          </button>
        </div>

        {copyMsg && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800">
            {copyMsg}
          </div>
        )}
      </div>
    </div>
  );
}
