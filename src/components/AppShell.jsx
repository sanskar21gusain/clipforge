'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Crown,
  Menu,
  X,
  Eraser,
  Minimize2,
  Scissors,
  Film,
  VolumeX,
  AudioLines,
  Radio,
  Images,
  IdCard,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { TOOL_CATEGORIES, getToolsByCategory } from '../lib/tools';
import { useStudio } from './StudioProvider';

const ICONS = {
  Eraser,
  Minimize2,
  Scissors,
  Film,
  VolumeX,
  AudioLines,
  Radio,
  Images,
  IdCard,
};

export function AppShell({ children }) {
  const pathname = usePathname();
  const { isPro, openProModal } = useStudio();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col gap-5 p-4">
      {/* Brand */}
      <div className="flex items-center justify-between px-1">
        <Link
          href="/"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-2.5 group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm group-hover:bg-blue-700 transition-colors">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-base font-extrabold tracking-tight text-ink-900 leading-none">
              Clip<span className="text-blue-600">Forge</span>
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-ink-400">
              On-Device Media Studio
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-canvas-300 bg-white text-ink-600"
        >
          <X size={18} />
        </button>
      </div>

      {/* Home + Annual Pro Card */}
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          onClick={() => setMobileNavOpen(false)}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
            pathname === '/'
              ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
              : 'text-ink-700 hover:bg-canvas-200/70'
          }`}
        >
          <Home size={16} />
          <span>All Tools</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            setMobileNavOpen(false);
            openProModal();
          }}
          className={`rounded-2xl border p-3 text-left transition-all cursor-pointer ${
            isPro
              ? 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50'
              : 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50/70 hover:border-blue-300 shadow-card'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-900">
              <Crown size={13} className={isPro ? 'text-emerald-600' : 'text-blue-600'} />
              <span>{isPro ? 'Pro Annual Active' : 'Go Pro Yearly'}</span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono ${
                isPro ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}
            >
              {isPro ? 'ACTIVE' : '$29/YR'}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-ink-500">
            {isPro
              ? 'Batch exports, 4K video & 300 DPI sheets unlocked.'
              : 'Batch ZIPs, 4K exports & clean audiograms. Billed yearly.'}
          </p>
        </button>
      </div>

      {/* Categorized Tool Links */}
      <nav aria-label="Media tools" className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5">
        {TOOL_CATEGORIES.map((cat) => {
          const items = getToolsByCategory(cat.id);
          return (
            <div key={cat.id} className="flex flex-col gap-1">
              <div className="px-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-400 font-mono">
                {cat.label}
              </div>
              {items.map((tool) => {
                const Icon = ICONS[tool.icon] || Sparkles;
                const active = pathname === `/tools/${tool.slug}`;
                return (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-ink-700 hover:bg-canvas-200/80 hover:text-ink-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon size={15} className={active ? 'text-white' : 'text-ink-500'} />
                      <span className="truncate">{tool.shortName}</span>
                    </span>
                    {tool.badge && (
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold font-mono ${
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-canvas-200 text-ink-500'
                        }`}
                      >
                        {tool.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Privacy Footer */}
      <div className="rounded-xl border border-canvas-300 bg-canvas-100 p-3 text-[11px] text-ink-500 flex items-center gap-2">
        <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
        <span className="leading-snug">Zero cloud uploads. Files process locally in your browser.</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas-100 text-ink-900 flex flex-col">
      {/* Top Promo & Quick Bar */}
      <div className="sticky top-0 z-30 border-b border-canvas-300 bg-white/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open tool navigation"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-canvas-300 bg-white text-ink-700 hover:bg-canvas-100 cursor-pointer"
            >
              <Menu size={18} />
            </button>

            <Link href="/" className="lg:hidden flex items-center gap-2 font-extrabold text-ink-900">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Sparkles size={14} />
              </span>
              <span>
                Clip<span className="text-blue-600">Forge</span>
              </span>
            </Link>

            <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-ink-500">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>100% Client-Side Engine</span>
              <span className="text-canvas-400">·</span>
              <span>No Sign-Up · No File Uploads</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!isPro ? (
              <button
                type="button"
                onClick={() => openProModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
              >
                <Crown size={13} />
                <span>Pro Yearly · $29/yr</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openProModal()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 cursor-pointer"
              >
                <Crown size={13} />
                <span>Pro Annual Active</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Flex Body */}
      <div className="flex flex-1 min-w-0">
        {/* Desktop Persistent Sidebar */}
        <aside className="hidden lg:block w-68 xl:w-72 shrink-0 border-r border-canvas-300 bg-white sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden">
          {renderSidebarContent()}
        </aside>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-ink-900/35 backdrop-blur-xs"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative z-10 w-72 max-w-[85vw] bg-white h-full shadow-2xl">
              {renderSidebarContent()}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>

          {/* Clean Footer */}
          <footer className="mx-auto mt-16 max-w-5xl border-t border-canvas-300 pt-6 pb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-500">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>ClipForge · Fast, Private Browser Media Studio</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="hover:text-ink-900 transition-colors">All Tools</Link>
              <button
                type="button"
                onClick={() => openProModal()}
                className="hover:text-ink-900 transition-colors cursor-pointer"
              >
                Annual Pro ($29/yr)
              </button>
              <a href="/llms.txt" className="hover:text-ink-900 transition-colors">llms.txt</a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
