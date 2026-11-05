import Architecture from './arquitectura.mdx';
import Identity from './identidad-y-acceso.mdx';
import Data from './integracion-de-datos.mdx';
import Olap from './analisis-olap.mdx';
import Prediction from './prediccion.mdx';
import Start from './primeros-pasos.mdx';
import Executive from './resumen-ejecutivo.mdx';
import Inventory from './api-inventory.mdx';
import Setup from './puesta-en-marcha.mdx';
import Diagnostics from './diagnostico.mdx';
import Administration from './administracion.mdx';

export const documents = [
  { slug: 'primeros-pasos', title: 'Primeros pasos', source: 'primeros-pasos.mdx', Component: Start, classification: 'public' },
  { slug: 'resumen-ejecutivo', title: 'Resumen ejecutivo', source: 'resumen-ejecutivo.mdx', Component: Executive, classification: 'public' },
  { slug: 'arquitectura', title: 'Arquitectura', source: 'arquitectura.mdx', Component: Architecture, classification: 'public' },
  { slug: 'identidad-y-acceso', title: 'Identidad y acceso', source: 'identidad-y-acceso.mdx', Component: Identity, classification: 'public-summary' },
  { slug: 'integracion-de-datos', title: 'Integración de datos', source: 'integracion-de-datos.mdx', Component: Data, classification: 'public-summary' },
  { slug: 'analisis-olap', title: 'Análisis OLAP', source: 'analisis-olap.mdx', Component: Olap, classification: 'public-summary' },
  { slug: 'prediccion', title: 'Motor predictivo', source: 'prediccion.mdx', Component: Prediction, classification: 'public-summary' },
  { slug: 'inventario-de-apis', title: 'Inventario de APIs', source: 'api-inventory.mdx', Component: Inventory, classification: 'public' },
  { slug: 'puesta-en-marcha', title: 'Puesta en marcha local', source: 'puesta-en-marcha.mdx', Component: Setup, classification: 'public' },
  { slug: 'diagnostico', title: 'Diagnóstico inicial', source: 'diagnostico.mdx', Component: Diagnostics, classification: 'public-summary' },
  { slug: 'administracion', title: 'Administración del portal', source: 'administracion.mdx', Component: Administration, classification: 'restricted', requiredRoles: ['SUPERADMIN'] },
] as const;

export type DocumentationEntry = (typeof documents)[number];
