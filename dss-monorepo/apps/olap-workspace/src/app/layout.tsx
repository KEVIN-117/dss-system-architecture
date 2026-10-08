import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'OLAP Workspace | DSS',
    template: '%s | OLAP Workspace',
  },
  description:
    'Espacio de análisis OLAP para explorar cubos, dashboards y aplicaciones.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body>
        <Providers bffBaseUrl={process.env.NEXT_PUBLIC_BFF_URL ?? ''}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
