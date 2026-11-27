import { TOOLS } from '../lib/tools';

export default function sitemap() {
  const baseUrl = 'https://www.clipforge.cv';
  const now = new Date();

  const toolEntries = TOOLS.map((tool) => ({
    url: `${baseUrl}/tools/${tool.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...toolEntries,
  ];
}
