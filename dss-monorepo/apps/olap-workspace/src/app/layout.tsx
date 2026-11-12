import type { Metadata } from 'next';
import Script from 'next/script';
import { Providers } from './providers';
import { getBffBaseUrl } from '../lib/auth-config';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'OLAP Workspace | DSS',
    template: '%s | OLAP Workspace',
  },
  description:
    'Espacio de análisis OLAP para explorar cubos, dashboards y aplicaciones.',
};

const bffBaseUrl = getBffBaseUrl();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <Script id="dss-theme-init" strategy="beforeInteractive">
          {`try { document.documentElement.classList.toggle('dark', localStorage.getItem('dss-theme-mode') !== 'light'); } catch {}`}
        </Script>
      </head>
      <body>
        <Providers bffBaseUrl={bffBaseUrl}>{children}</Providers>
      </body>
    </html>
  );
}
