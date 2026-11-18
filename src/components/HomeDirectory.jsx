'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ShieldCheck,
  Zap,
  Cpu,
  ArrowRight,
  Crown,
  Eraser,
  Minimize2,
  Scissors,
  Film,
  VolumeX,
  AudioLines,
  Radio,
  Images,
  IdCard,
  Repeat,
  EyeOff,
  Camera,
  Combine,
  Sparkles,
  Check,
} from 'lucide-react';
import { TOOLS, TOOL_CATEGORIES } from '../lib/tools';
import { useStudio } from './StudioProvider';

const ICONS = {
  Eraser,
  Minimize2,
  Scissors,
  Film,
  Repeat,
  Camera,
  Combine,
  VolumeX,
  AudioLines,
  Radio,
  Images,
  IdCard,
  EyeOff,
};

export function HomeDirectory() {
  const { isPro, openProModal } = useStudio();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredTools = TOOLS.filter((tool) => {
    const matchesCat = activeCategory === 'all' || tool.category === activeCategory;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      tool.name.toLowerCase().includes(q) ||
      tool.tagline.toLowerCase().includes(q) ||
      tool.category.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="flex flex-col gap-12">
      {/* Bright Daylight Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-canvas-300 bg-white p-7 sm:p-11 shadow-card">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl"
        />

        <div className="relative z-10 flex flex-col gap-5 max-w-3xl">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>100% On-Device Processing · Zero Uploads · No Sign-Up</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-ink-900 leading-[1.1]">
            Fast, Private Video, Audio &amp; Photo Tools —{' '}
            <span className="text-blue-600">Right in Your Browser.</span>
          </h1>

          <p className="text-base sm:text-lg text-ink-500 leading-relaxed max-w-2xl">
            Remove photo backgrounds with local AI, compress videos to exact megabytes, trim clips losslessly, convert podcasts into waveform videos, and format passport sheets—without uploading a single file.
          </p>

          {/* Instant Tool Search + Category Pills */}
          <div className="mt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                id="tool-search"
                name="tool-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools (e.g. background, 10MB, GIF, passport)..."
                aria-label="Search ClipForge tools"
                className="w-full rounded-xl border border-canvas-300 bg-canvas-100 pl-10 pr-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[{ id: 'all', label: `All (${TOOLS.length})` }, ...TOOL_CATEGORIES].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-canvas-300 bg-white text-ink-700 hover:bg-canvas-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tool Grid */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink-900">
            {activeCategory === 'all'
              ? 'All Studio Utilities'
              : TOOL_CATEGORIES.find((c) => c.id === activeCategory)?.label}
          </h2>
          <span className="text-xs font-mono text-ink-500">
            {filteredTools.length} tool{filteredTools.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredTools.length === 0 ? (
          <div className="rounded-2xl border border-canvas-300 bg-white p-8 sm:p-10 text-center shadow-card flex flex-col items-center gap-3">
            <p className="text-sm font-bold text-ink-900">
              No tools match &ldquo;{query.trim()}&rdquo;
            </p>
            <p className="text-xs text-ink-500 max-w-sm">
              Try searching for keywords like background, video, GIF, audio, KB, or passport.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveCategory('all');
              }}
              className="mt-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
            >
              Reset Search &amp; Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => {
              const Icon = ICONS[tool.icon] || Sparkles;
              const cat = TOOL_CATEGORIES.find((c) => c.id === tool.category);
              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group rounded-2xl border border-canvas-300 bg-white p-5 shadow-card hover:border-blue-300 hover:shadow-card-hover transition-all flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-canvas-300 bg-canvas-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors">
                        <Icon size={20} />
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase ${cat?.accent || ''}`}>
                        {tool.badge || tool.category}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-ink-900 group-hover:text-blue-600 transition-colors">
                        {tool.name}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">
                        {tool.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-canvas-200 text-xs font-bold text-blue-600">
                    <span>Open Studio Tool</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Why On-Device Trust Strip */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: ShieldCheck,
            title: 'Your Files Stay Private',
            body: 'FFmpeg WebAssembly, Web Audio, Canvas, and on-device ONNX models execute directly inside your browser tab.',
          },
          {
            icon: Zap,
            title: 'Zero Upload Wait Times',
            body: 'Skip slow 500MB cloud uploads and download queues. Trim, mute, compress, and resize immediately.',
          },
          {
            icon: Cpu,
            title: 'No Account Required',
            body: 'Open any tool and export immediately. Pro Annual activates cleanly via an email license key.',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-2xl border border-canvas-300 bg-white p-5 shadow-card flex flex-col gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Icon size={18} />
              </div>
              <h3 className="text-sm font-bold text-ink-900">{item.title}</h3>
              <p className="text-xs leading-relaxed text-ink-500">{item.body}</p>
            </div>
          );
        })}
      </section>

      {/* Annual-Only Pricing CTA Banner */}
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50/70 p-6 sm:p-9 shadow-card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-2.5 max-w-xl">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white font-mono">
            <Crown size={12} />
            <span>CLIPFORGE PRO · ANNUAL PLAN</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900">
            Unlock the full studio for $29/year
          </h2>
          <p className="text-sm text-ink-600 leading-relaxed">
            One transparent yearly subscription—no confusing tiers, no credit packs. Unlock unlimited batch image ZIPs, 4K exports, watermark-free waveform videos, and 300 DPI printable passport sheets.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1 text-xs font-semibold text-ink-700">
            {['Billed once yearly ($2.42/mo)', 'Cancel anytime', 'Instant email license key'].map((perk) => (
              <span key={perk} className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-emerald-600" />
                <span>{perk}</span>
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openProModal()}
          className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors cursor-pointer"
        >
          <Crown size={16} />
          <span>{isPro ? 'Manage Pro Annual' : 'Get Pro Yearly — $29/yr'}</span>
          <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}
