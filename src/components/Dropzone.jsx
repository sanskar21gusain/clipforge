'use client';

import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, ShieldCheck, Clipboard } from 'lucide-react';

export function Dropzone({
  accept,
  multiple = false,
  onFiles,
  title = 'Select or drop your file',
  subtitle = 'Processed locally inside your browser — nothing is uploaded',
  hint = 'Click, drop, or paste (Ctrl+V)',
  allowPaste = true,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!allowPaste) return;
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.files || []);
      if (items.length > 0) {
        onFiles(multiple ? items : [items[0]]);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [allowPaste, multiple, onFiles]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      onFiles(multiple ? files : [files[0]]);
    }
  };

  return (
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
        id="dropzone-file-input"
        name="file-upload"
        aria-label={title}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            onFiles(multiple ? files : [files[0]]);
          }
          e.target.value = '';
        }}
      />

      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-canvas-300 bg-white text-blue-600 shadow-card group-hover:scale-105 transition-transform">
        <UploadCloud size={26} />
      </div>

      <h3 className="text-lg font-bold text-ink-900">{title}</h3>
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
  );
}
