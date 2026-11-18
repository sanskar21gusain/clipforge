'use client';

import React, { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';

/**
 * Privacy-first cookieless Vercel Web Analytics wrapper.
 * - Only mounts on deployed hosts (skips localhost/127.0.0.1 where Vercel's
 *   edge-injected /_vercel/insights/script.js is absent and would 404).
 * - Strips query parameters and hashes via beforeSend so no tokens,
 *   filenames, or sensitive URL fragments can ever be transmitted.
 */
export function AnalyticsClient() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isLocal) {
      setEnabled(true);
    }
  }, []);

  if (!enabled) return null;

  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const parsed = new URL(event.url);
          return {
            ...event,
            url: `${parsed.origin}${parsed.pathname}`,
          };
        } catch (_) {
          return event;
        }
      }}
    />
  );
}
