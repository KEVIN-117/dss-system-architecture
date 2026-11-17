import type { ReactNode } from 'react';
import Script from 'next/script';
import './global.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Administración DSS | UATF',
  description: 'Portal de administración del DSS académico de la Universidad Autónoma Tomás Frías.',
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
      data-theme="admin"
      className="dark"
      suppressHydrationWarning
    >
      <head>
        <Script id="dss-theme-init" strategy="beforeInteractive">
          {`try { document.documentElement.classList.toggle('dark', localStorage.getItem('dss-theme-mode') !== 'light'); } catch {}`}
        </Script>
      </head>
      <body>
        <Providers bffBaseUrl={authConfig.bffBaseUrl}>{children}</Providers>
      </body>
    </html>
  );
}
