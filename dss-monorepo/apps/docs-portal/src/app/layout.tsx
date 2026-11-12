import './global.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Shell, { type NavData } from '../components/shell';
import { docs, groups } from '../content/catalog';
import { getApiCatalog } from '../lib/api-catalog';
import { buildSearchIndex } from '../lib/content';

export const metadata: Metadata = {
  title: { default: 'Documentación DSS · UATF', template: '%s · Documentación DSS' },
  description:
    'Manual de uso y referencia técnica del Sistema de Soporte a Decisiones de la UATF.',
};

// Applies the saved or system theme before the first paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('dss-docs-theme');if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var d=document.documentElement;d.dataset.docsTheme=t;d.style.colorScheme=t}catch(e){}})();`;

function navigation(): NavData {
  return {
    groups: groups.map((group) => ({
      id: group.id,
      title: group.title,
      items: docs
        .filter((doc) => doc.group === group.id)
        .map((doc) => ({ href: `/docs/${doc.slug}`, title: doc.title, restricted: doc.classification === 'restricted' })),
    })),
    services: getApiCatalog().map((service) => ({
      id: service.id,
      name: service.name,
      href: `/reference/${service.id}`,
      operations: service.operations.map((operation) => ({
        href: `/reference/${service.id}/${operation.referenceSlug}`,
        method: operation.method,
        title: operation.summary,
      })),
    })),
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Shell nav={navigation()} index={buildSearchIndex()}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
