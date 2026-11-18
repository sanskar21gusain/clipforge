import React from 'react';
import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-canvas-300 bg-white p-8 sm:p-12 text-center shadow-card flex flex-col items-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600">
        <SearchX size={26} />
      </div>
      <div className="inline-flex rounded-full border border-canvas-300 bg-canvas-100 px-3 py-1 text-xs font-bold font-mono text-ink-700">
        404 · PAGE NOT FOUND
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900">
        This studio tool or page doesn&apos;t exist
      </h1>
      <p className="text-sm text-ink-500 leading-relaxed max-w-md">
        The link may be outdated or misspelled. Head back to the ClipForge studio directory to launch any video, audio, or photo utility.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Back to All Tools</span>
      </Link>
    </section>
  );
}
