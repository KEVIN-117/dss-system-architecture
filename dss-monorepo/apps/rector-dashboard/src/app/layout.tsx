import './global.css';
import { Providers } from './providers';
import { PortalBoundary } from './components/portal-frame';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Portal de Rectoría | DSS UATF',
  description: 'Analítica institucional agregada del rendimiento académico.',
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
    <html lang="es" data-theme="rector" className="dark">
      <body>
        <Providers bffBaseUrl={authConfig.bffBaseUrl}>
          <PortalBoundary>{children}</PortalBoundary>
        </Providers>
      </body>
    </html>
  );
}
