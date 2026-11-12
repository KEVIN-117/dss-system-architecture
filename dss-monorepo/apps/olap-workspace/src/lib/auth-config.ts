const LOCAL_BFF_BASE_URL = 'http://localhost:3006';

/** Resolves the browser-facing BFF origin used to start and end sessions. */
export function getBffBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_BFF_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  if (process.env.NODE_ENV !== 'production') return LOCAL_BFF_BASE_URL;

  throw new Error(
    'OLAP Workspace is missing NEXT_PUBLIC_BFF_URL authentication configuration',
  );
}
