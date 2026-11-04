import './global.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Documentación DSS · UATF',
  description:
    'Guías y referencias API del Sistema de Soporte a Decisiones de la UATF, organizadas por servicio y tarea.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
