import React from 'react';
import Link from 'next/link';
import { ChevronRight, ShieldCheck, CheckCircle2, HelpCircle } from 'lucide-react';
import { TOOLS } from '../lib/tools';

export function ToolPageLayout({ tool, children }) {
  const related = TOOLS.filter((t) => t.slug !== tool.slug).slice(0, 4);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: tool.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  };

  return (
    <div className="flex flex-col gap-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Breadcrumb & Header */}
      <header className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
          <ChevronRight size={13} />
          <span className="capitalize">{tool.category} Tools</span>
          <ChevronRight size={13} />
          <span className="text-ink-900 font-semibold">{tool.shortName}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink-900">
            {tool.name}
          </h1>
          {tool.badge && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 font-mono">
              {tool.badge}
            </span>
          )}
        </div>

        <p className="max-w-2xl text-base text-ink-500 leading-relaxed">
          {tool.tagline}
        </p>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>{tool.privacyNote}</span>
        </div>
      </header>

      {/* Main Tool Workbench Surface */}
      <section className="rounded-3xl border border-canvas-300 bg-white p-5 sm:p-8 shadow-card">
        {children}
      </section>

      {/* How It Works (SEO & User Clarity) */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-ink-900">How to use {tool.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tool.steps.map((step, idx) => (
            <div
              key={step.title}
              className="rounded-2xl border border-canvas-300 bg-white p-5 shadow-card flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 text-xs font-bold font-mono text-blue-600">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 border border-blue-200">
                  {idx + 1}
                </span>
                <span>STEP {idx + 1}</span>
              </div>
              <h3 className="text-sm font-bold text-ink-900">{step.title}</h3>
              <p className="text-xs leading-relaxed text-ink-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <HelpCircle size={18} className="text-blue-600" />
          <h2 className="text-xl font-bold text-ink-900">Frequently Asked Questions</h2>
        </div>
        <div className="flex flex-col gap-3">
          {tool.faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-canvas-300 bg-white p-4 sm:p-5 shadow-card"
            >
              <summary className="cursor-pointer list-none font-semibold text-sm text-ink-900 flex items-center justify-between gap-4">
                <span>{faq.q}</span>
                <span className="text-ink-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-500">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Related Tools Internal Linking */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink-900">More Free On-Device Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {related.map((r) => (
            <Link
              key={r.slug}
              href={`/tools/${r.slug}`}
              className="rounded-2xl border border-canvas-300 bg-white p-4 hover:border-blue-300 hover:shadow-card-hover transition-all flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink-900">{r.shortName}</span>
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              </div>
              <p className="text-xs text-ink-500 line-clamp-2">{r.tagline}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
