import React from 'react';
import { notFound } from 'next/navigation';
import { TOOLS, getToolBySlug } from '../../../lib/tools';
import { ToolPageLayout } from '../../../components/ToolPageLayout';
import { ToolRenderer } from '../../../components/tools/ToolRenderer';

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return {};

  return {
    title: tool.seoTitle,
    description: tool.seoDescription,
    alternates: {
      canonical: `/tools/${tool.slug}`,
    },
    openGraph: {
      title: tool.seoTitle,
      description: tool.seoDescription,
      url: `https://www.clipforge.cv/tools/${tool.slug}`,
      siteName: 'ClipForge',
      type: 'website',
      images: [
        {
          url: 'https://www.clipforge.cv/opengraph-image',
          width: 1200,
          height: 630,
          alt: tool.seoTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: tool.seoTitle,
      description: tool.seoDescription,
      images: ['https://www.clipforge.cv/opengraph-image'],
    },
  };
}

export default async function ToolPage({ params }) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  return (
    <ToolPageLayout tool={tool}>
      <ToolRenderer slug={tool.slug} />
    </ToolPageLayout>
  );
}
