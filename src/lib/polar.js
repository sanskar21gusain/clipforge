import { createPolar } from '@polar-sh/sdk/2026-10';

let client = null;

export function getPolar() {
  if (client) return client;

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('POLAR_ACCESS_TOKEN environment variable is required');
  }

  const environment = process.env.POLAR_SERVER === 'sandbox' ? 'sandbox' : 'production';

  client = createPolar({
    accessToken,
    environment,
  });

  return client;
}
