'use client';

import React, { useRef, useState, useEffect, useCallback, useId } from 'react';
import { UploadCloud, ShieldCheck, Clipboard } from 'lucide-react';
import { formatBytes } from '../lib/format';

function matchesAccept(file, accept) {
  if (!accept) return true;
  const rules = accept
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;

  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  return rules.some((rule) => {
    if (rule === '*/*') return true;
    if (rule.endsWith('/*')) {
      const prefix = rule.slice(0, -1); // e.g. 'image/'
      if (mime.startsWith(prefix)) return true;
      // Fallback for OSes that omit MIME on some media extensions
      if (prefix === 'video/' && /\.(mp4|mov|webm|mkv|avi|m4v)$/.test(name)) return true;
      if (prefix === 'audio/' && /\.(mp3|wav|m4a|ogg|flac|aac|opus)$/.test(name)) return true;
      if (prefix === 'image/' && /\.(jpe?g|png|webp|gif|bmp|avif)$/.test(name)) return true;
      return false;
    }
    if (rule.startsWith('.')) {
      return name.endsWith(rule);
    }
    return mime === rule;
  });
}

function getDefaultMaxBytes(accept) {
  const acc = (accept || '').toLowerCase();
  if (acc.includes('video')) return 400 * 1024 * 1024; // 400 MB
  if (acc.includes('audio')) return 100 * 1024 * 1024; // 100 MB
  if (acc.includes('image')) return 50 * 1024 * 1024;  // 50 MB
  return 400 * 1024 * 1024;
}

export function Dropzone({
  accept,
  multiple = false,
  maxBytes,
  onFiles,
  title = 'Select or drop your file',
  subtitle = 'Processed locally inside your browser — nothing is uploaded',
  hint = 'Click, drop, or paste (Ctrl+V)',
  allowPaste = true,
}) {
  const inputRef = useRef(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [rejectError, setRejectError] = useState('');

  const handleIncoming = useCallback(
    (rawFiles) => {
      const list = Array.from(rawFiles || []);
      if (list.length === 0) return;

      const valid = list.filter((f) => matchesAccept(f, accept));
      if (valid.length === 0) {
        setRejectError(
          `Unsupported file type. Please choose a valid ${accept ? accept.replace(/\/\*/g, '') : 'media'} file.`
        );
        return;
      }

      // Check for empty files (0 bytes)
      const emptyFiles = valid.filter((f) => f.size === 0);
      if (emptyFiles.length > 0) {
        setRejectError('The selected file is empty (0 bytes). Please choose a valid file.');
        return;
      }

      // Check for oversized files beyond in-browser memory budget
      const limit = maxBytes || getDefaultMaxBytes(accept);
      const oversizeFiles = valid.filter((f) => f.size > limit);
      if (oversizeFiles.length > 0) {
        const fileNames = oversizeFiles.map((f) => `${f.name} (${formatBytes(f.size)})`).join(', ');
        setRejectError(
          `File exceeds the ${formatBytes(limit)} in-browser limit: ${fileNames}. Please choose a smaller file so your browser tab stays fast and responsive.`
        );
        return;
      }

      if (valid.length < list.length) {
        setRejectError(
          `Skipped ${list.length - valid.length} unsupported file${list.length - valid.length > 1 ? 's' : ''}.`
        );
      } else {
        setRejectError('');
      }

      onFiles(multiple ? valid : [valid[0]]);
    },
    [accept, multiple, maxBytes, onFiles]
  );

  useEffect(() => {
    if (!allowPaste) return;
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.files || []);
      if (items.length > 0) {
        handleIncoming(items);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [allowPaste, handleIncoming]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleIncoming(e.dataTransfer?.files);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`group relative rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
          dragging
            ? 'border-blue-600 bg-blue-50/70 scale-[1.005]'
            : 'border-canvas-400 bg-canvas-100/70 hover:border-blue-500 hover:bg-blue-50/30'
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          name="file-upload"
          data-testid="dropzone-file-input"
          aria-label={title}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            handleIncoming(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-canvas-300 bg-white text-blue-600 shadow-card group-hover:scale-105 transition-transform">
          <UploadCloud size={26} />
        </div>

        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">{subtitle}</p>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm group-hover:bg-blue-700 transition-colors">
          <Clipboard size={13} />
          <span>{hint}</span>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>Your file never leaves your device</span>
        </div>
      </div>

      {rejectError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700"
        >
          {rejectError}
        </div>
      )}
    </div>
  );
}
