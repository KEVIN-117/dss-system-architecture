import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './global.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DSS Académico | Universidad Autónoma Tomás Frías',
  description:
    'Sistema de Apoyo a la Decisión de la UATF: Data Warehouse, cubos OLAP, machine learning e IA para anticipar el rendimiento y la deserción estudiantil.',
};

/** Aplica el tema guardado (o el del sistema) antes de pintar. */
const themeInit = `(function(){try{var d=document.documentElement;var s=localStorage.getItem('uatf-landing-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;d.classList.toggle('dark',s?s==='dark':m);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-theme="dsa"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
