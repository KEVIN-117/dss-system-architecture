import './global.css';
import { Providers } from './providers';
import { PortalBoundary } from './components/portal-frame';
import type { ReactNode } from 'react';
import Script from 'next/script';

export const metadata = {
  title: 'Analítica de facultad | DSS UATF',
  description: 'Indicadores académicos del contexto asignado al Decano.',
};

function requiredAuthEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Admin portal is missing ${name} authentication configuration`,
    );
  }
  return value;
}

const authConfig = { bffBaseUrl: requiredAuthEnv('NEXT_PUBLIC_BFF_URL') };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      data-theme="decano"
      className="dark"
      suppressHydrationWarning
    >
      <head>
        <Script id="dss-theme-init" strategy="beforeInteractive">
          {`try { document.documentElement.classList.toggle('dark', localStorage.getItem('dss-theme-mode') !== 'light'); } catch {}`}
        </Script>
      </head>
      <body>
        <Providers bffBaseUrl={authConfig.bffBaseUrl}>
          <PortalBoundary>{children}</PortalBoundary>
        </Providers>
      </body>
    </html>
  );
}
