import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OLAP Workspace',
  description: 'Espacio de trabajo OLAP de DSS.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body>{children}</body>
    </html>
  );
}
