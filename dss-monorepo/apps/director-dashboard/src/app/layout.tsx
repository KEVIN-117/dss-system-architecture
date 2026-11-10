import './global.css';
import { Providers } from './providers';
import { PortalBoundary } from './components/portal-frame';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Rendimiento de carrera | DSS',
  description: 'Indicadores académicos del contexto asignado al Director.',
};

function requiredAuthEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Director dashboard is missing ${name} authentication configuration`,
    );
  }
  return value;
}

const authConfig = { bffBaseUrl: requiredAuthEnv('NEXT_PUBLIC_BFF_URL') };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" data-theme="director" className="dark">
      <body>
        <Providers bffBaseUrl={authConfig.bffBaseUrl}>
          <PortalBoundary>{children}</PortalBoundary>
        </Providers>
      </body>
    </html>
  );
}
