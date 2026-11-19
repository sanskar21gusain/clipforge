'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download, Archive, RefreshCw, Loader2, Check, Crown, Images, Copy } from 'lucide-react';
import { Dropzone } from '../Dropzone';
import { formatBytes, downloadBlob, baseName } from '../../lib/format';
import { copyImageBlobToClipboard } from '../../lib/clipboard';
import { useStudio } from '../StudioProvider';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MB in-browser safety limit

async function encodeCanvasToTargetKb(img, mime, maxWidth, exactKb, quality) {
  let width = img.naturalWidth;
  let height = img.naturalHeight;
  const safeMaxWidth = Number.isFinite(maxWidth) && maxWidth > 0 ? Math.max(16, Math.min(16384, maxWidth)) : 0;
  if (safeMaxWidth && width > safeMaxWidth) {
    height = Math.max(1, Math.round((height * safeMaxWidth) / width));
    width = safeMaxWidth;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const renderAt = (w, h, q) =>
    new Promise((resolve) => {
      canvas.width = Math.max(1, Math.round(w));
      canvas.height = Math.max(1, Math.round(h));
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), mime, q);
    });

  if (!exactKb) {
    return renderAt(width, height, quality / 100);
  }

  const targetBytes = exactKb * 1024;
  // Binary search quality first
  let low = 0.08;
  let high = 0.96;
  let best = await renderAt(width, height, 0.8);

  for (let i = 0; i < 7; i++) {
    const mid = (low + high) / 2;
    const candidate = await renderAt(width, height, mid);
    if (!candidate) break;
    if (candidate.size <= targetBytes) {
      best = candidate;
      low = mid;
    } else {
      high = mid;
    }
  }

  // If still above target, scale down gradually
  let scale = 0.85;
  while (best && best.size > targetBytes && scale >= 0.1) {
    best = await renderAt(width * scale, height * scale, 0.65);
    scale -= 0.15;
  }

  return best;
}

export function ImageStudioTool() {
  const { isPro, openProModal } = useStudio();
  const [items, setItems] = useState([]);
  const [format, setFormat] = useState('image/webp');
  const [quality, setQuality] = useState(82);
  const [exactKbMode, setExactKbMode] = useState(false);
  const [targetKb, setTargetKb] = useState(100);
  const [maxWidth, setMaxWidth] = useState('');
  const [processing, setProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [copyMsg, setCopyMsg] = useState('');
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyItem = async (item) => {
    if (!item?.outBlob) return;
    setCopyMsg('');
    const res = await copyImageBlobToClipboard(item.outBlob);
    if (res.ok) {
      setCopiedId(item.id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopyMsg(res.reason);
    }
  };

  const extFor = (m) => (m === 'image/png' ? 'png' : m === 'image/jpeg' ? 'jpg' : 'webp');

  const handleFiles = (files) => {
    const valid = files.filter((f) => f.size > 0 && f.size <= MAX_IMAGE_BYTES);
    if (valid.length < files.length) {
      setCopyMsg(`Skipped ${files.length - valid.length} file(s) that were empty or exceeded 50 MB.`);
    }
    const mapped = valid.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      outBlob: null,
      outExt: extFor(format),
    }));
    setItems((prev) => [...prev, ...mapped]);
  };

  const processAll = async () => {
    if (items.length === 0) return;
    if (items.length > 5 && !isPro) {
      openProModal('Batch processing more than 5 images at once is unlocked with ClipForge Pro Annual ($29/year).');
      return;
    }

    setProcessing(true);
    const updated = [];
    const targetMime = exactKbMode && format === 'image/png' ? 'image/jpeg' : format;
    const parsedMaxWidth = Number(maxWidth);
    const safeMaxWidth = Number.isFinite(parsedMaxWidth) && parsedMaxWidth > 0 ? parsedMaxWidth : 0;
    const safeTargetKb = Number.isFinite(targetKb) && targetKb >= 10 ? Math.min(5000, targetKb) : 100;

    for (const item of items) {
      const url = URL.createObjectURL(item.file);
      try {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        const blob = await encodeCanvasToTargetKb(
          img,
          targetMime,
          safeMaxWidth,
          exactKbMode ? safeTargetKb : 0,
          quality
        );
        if (!blob) throw new Error('Failed to encode image');
        updated.push({ ...item, outBlob: blob, outExt: extFor(targetMime), failed: false });
      } catch (_) {
        updated.push({ ...item, outBlob: null, failed: true });
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    setItems(updated);
    setProcessing(false);
  };

  const downloadZip = async () => {
    const ready = items.filter((i) => i.outBlob);
    if (ready.length === 0) return;
    if (ready.length > 3 && !isPro) {
      openProModal('Downloading bulk ZIP bundles (4+ files) is unlocked with ClipForge Pro Annual ($29/year).');
      return;
    }
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const usedNames = new Map();
    ready.forEach((it) => {
      const stem = `${baseName(it.file.name)}-optimized`;
      const key = `${stem}.${it.outExt}`.toLowerCase();
      const count = (usedNames.get(key) || 0) + 1;
      usedNames.set(key, count);
      const uniqueName = count === 1 ? `${stem}.${it.outExt}` : `${stem}-${count}.${it.outExt}`;
      zip.file(uniqueName, it.outBlob);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    downloadBlob(content, 'clipforge-images.zip');
  };

  return (
    <div className="flex flex-col gap-6">
      <Dropzone
        accept="image/*"
        multiple
        onFiles={handleFiles}
        title="Drop one or multiple photos to compress & convert"
        subtitle="Batch JPG, PNG, WebP converter + Exact KB target mode (50KB, 100KB, 200KB). EXIF/GPS stripped automatically."
      />

      {items.length > 0 && (
        <>
          {/* Settings Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl border border-canvas-300 bg-canvas-100 p-4">
            <div>
              <span className="block text-xs font-bold text-ink-700 mb-1.5">Output Format</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { mime: 'image/webp', label: 'WebP' },
                  { mime: 'image/jpeg', label: 'JPG' },
                  { mime: 'image/png', label: 'PNG' },
                ].map((f) => (
                  <button
                    key={f.mime}
                    type="button"
                    onClick={() => setFormat(f.mime)}
                    className={`rounded-lg border py-1.5 text-xs font-bold cursor-pointer ${
                      format === f.mime ? 'border-blue-600 bg-blue-600 text-white' : 'border-canvas-300 bg-white text-ink-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exactKbMode}
                    onChange={(e) => setExactKbMode(e.target.checked)}
                    className="h-4 w-4 accent-blue-600 cursor-pointer"
                  />
                  <span>Target Exact KB</span>
                </label>
                {!exactKbMode && <span className="text-xs font-mono font-bold text-blue-600">{quality}%</span>}
              </div>

              {exactKbMode ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={targetKb}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) setTargetKb(Math.min(5000, Math.max(10, n)));
                    }}
                    aria-label="Target file size in kilobytes"
                    className="w-24 rounded-lg border border-canvas-300 bg-white px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                  {[50, 100, 200].map((kb) => (
                    <button
                      key={kb}
                      type="button"
                      onClick={() => setTargetKb(kb)}
                      className="rounded-md border border-canvas-300 bg-white px-2 py-1 text-[11px] font-mono font-semibold text-ink-600 hover:border-blue-400 cursor-pointer"
                    >
                      {kb}KB
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="range"
                  min="20"
                  max="98"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  aria-label="Compression quality"
                  className="w-full accent-blue-600 cursor-pointer"
                />
              )}
            </div>

            <div>
              <label htmlFor="img-max-w" className="block text-xs font-bold text-ink-700 mb-1.5">
                Max Width (px, optional)
              </label>
              <input
                id="img-max-w"
                type="number"
                min="16"
                max="16384"
                placeholder="Keep original"
                value={maxWidth}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setMaxWidth('');
                    return;
                  }
                  const n = Number(raw);
                  if (Number.isFinite(n) && n >= 0) setMaxWidth(String(Math.min(16384, Math.floor(n))));
                }}
                className="w-full rounded-lg border border-canvas-300 bg-white px-3 py-1.5 text-xs font-mono text-ink-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* File Queue */}
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const saved = item.outBlob
                ? Math.max(0, Math.round((1 - item.outBlob.size / item.file.size) * 100))
                : null;
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-canvas-300 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Images size={16} className="text-blue-600 shrink-0" />
                    <span className="truncate text-sm font-semibold text-ink-900">{item.file.name}</span>
                    <span className="text-xs font-mono text-ink-500">{formatBytes(item.file.size)}</span>
                    {item.outBlob && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-mono font-bold text-emerald-700">
                        <Check size={12} /> {formatBytes(item.outBlob.size)} (-{saved}%)
                      </span>
                    )}
                    {item.failed && (
                      <span className="inline-flex items-center rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        Unsupported / corrupt image
                      </span>
                    )}
                  </div>

                  {item.outBlob && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyItem(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-canvas-300 bg-white hover:bg-canvas-100 px-2.5 py-1.5 text-xs font-bold text-ink-700 cursor-pointer"
                      >
                        {copiedId === item.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadBlob(item.outBlob, `${baseName(item.file.name)}.${item.outExt}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-300 bg-canvas-100 hover:bg-canvas-200 px-3 py-1.5 text-xs font-bold text-ink-800 cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Save .{item.outExt}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          {copyMsg && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
              {copyMsg}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={processing}
              onClick={() => setItems([])}
              className="inline-flex items-center gap-1.5 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-100 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-ink-600 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Clear List</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={processing}
                onClick={processAll}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white shadow-sm cursor-pointer"
              >
                {processing && <Loader2 size={15} className="animate-spin" />}
                <span>{processing ? 'Optimizing...' : `Optimize ${items.length} Image${items.length > 1 ? 's' : ''}`}</span>
              </button>

              {items.some((i) => i.outBlob) && (
                <button
                  type="button"
                  onClick={downloadZip}
                  className="inline-flex items-center gap-2 rounded-xl bg-ink-900 hover:bg-ink-700 px-5 py-2.5 text-sm font-bold text-white cursor-pointer"
                >
                  <Archive size={15} />
                  <span>Download ZIP</span>
                  {items.length > 3 && !isPro && <Crown size={13} className="text-amber-400" />}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
