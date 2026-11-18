'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('ClipForge route error:', error);
  }, [error]);

  return (
    <section
      role="alert"
      className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 sm:p-12 text-center shadow-card flex flex-col items-center gap-4"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600">
        <AlertTriangle size={26} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900">
        Something went wrong in the studio
      </h1>
      <p className="text-sm text-ink-500 leading-relaxed max-w-md">
        An unexpected browser error interrupted this view. Your media files never left your device—try reloading this tool below.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw size={15} />
          <span>Try Again</span>
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-canvas-300 bg-white hover:bg-canvas-100 px-5 py-2.5 text-sm font-bold text-ink-700 transition-colors"
        >
          <Home size={15} />
          <span>All Tools</span>
        </Link>
      </div>
    </section>
  );
}
