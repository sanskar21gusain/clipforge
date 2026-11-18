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
    openGraph: {
      title: tool.seoTitle,
      description: tool.seoDescription,
      type: 'website',
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
