import './global.css';
import { Providers } from './providers';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Welcome to Decano DSS Dashboard',
  description: 'Decano DSS Dashboard',
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

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" data-theme="decano" className="dark">
      <body>
        <Providers bffBaseUrl={authConfig.bffBaseUrl}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
