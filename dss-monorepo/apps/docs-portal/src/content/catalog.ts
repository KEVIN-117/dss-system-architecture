/**
 * Single source of the portal navigation. Every guide is declared once here;
 * the sidebar, home page, search index, previous/next links and static params
 * are all derived from this list. Restricted guides keep their text out of the
 * search index and are rendered only after the BFF verifies the role.
 */
export type Classification = 'public' | 'public-summary' | 'restricted';

export type GroupId = 'empezar' | 'guias-de-uso' | 'plataforma' | 'desarrolladores';

export type DocMeta = {
  slug: string;
  title: string;
  summary: string;
  group: GroupId;
  source: string;
  audience: string[];
  classification: Classification;
  requiredRoles?: readonly string[];
};

export const groups: Array<{ id: GroupId; title: string; description: string }> = [
  {
    id: 'empezar',
    title: 'Empezar',
    description: 'Qué es el DSS, cómo ingresar y dónde encontrar cada tema.',
  },
  {
    id: 'guias-de-uso',
    title: 'Guías de uso',
    description: 'Manual paso a paso para rectorado, decanatos, direcciones de carrera y administración.',
  },
  {
    id: 'plataforma',
    title: 'Plataforma',
    description: 'Cómo funcionan la identidad, los datos, el análisis OLAP y la predicción.',
  },
  {
    id: 'desarrolladores',
    title: 'Desarrolladores',
    description: 'Entorno local, contratos de API y diagnóstico.',
  },
];

export const docs: DocMeta[] = [
  {
    slug: 'primeros-pasos',
    title: 'Primeros pasos',
    summary: 'Cómo orientarse en la documentación del DSS.',
    group: 'empezar',
    source: 'primeros-pasos.mdx',
    audience: ['directivos', 'desarrolladores', 'administradores'],
    classification: 'public',
  },
  {
    slug: 'acceso-al-sistema',
    title: 'Ingresar al sistema',
    summary: 'Inicio de sesión institucional, portales por rol y cierre de sesión.',
    group: 'empezar',
    source: 'acceso-al-sistema.mdx',
    audience: ['directivos', 'administradores'],
    classification: 'public',
  },
  {
    slug: 'resumen-ejecutivo',
    title: 'Resumen ejecutivo',
    summary: 'Capacidades, estado y responsabilidades institucionales.',
    group: 'empezar',
    source: 'resumen-ejecutivo.mdx',
    audience: ['directivos'],
    classification: 'public',
  },
  {
    slug: 'guia-rectorado',
    title: 'Tablero de Rectorado',
    summary: 'Indicadores institucionales, reportes por facultad y publicación de predicciones.',
    group: 'guias-de-uso',
    source: 'guia-rectorado.mdx',
    audience: ['rector'],
    classification: 'public-summary',
  },
  {
    slug: 'guia-decanato',
    title: 'Tablero de Decanato',
    summary: 'Resumen de la facultad, rendimiento, admisión y permanencia.',
    group: 'guias-de-uso',
    source: 'guia-decanato.mdx',
    audience: ['decanos'],
    classification: 'public-summary',
  },
  {
    slug: 'guia-direccion-de-carrera',
    title: 'Tablero de Dirección de carrera',
    summary: 'Indicadores de la carrera asignada por periodo académico.',
    group: 'guias-de-uso',
    source: 'guia-direccion-de-carrera.mdx',
    audience: ['directores'],
    classification: 'public-summary',
  },
  {
    slug: 'guia-olap-workspace',
    title: 'OLAP Workspace',
    summary: 'Explorar cubos, armar consultas, ver gráficos y exportar a CSV.',
    group: 'guias-de-uso',
    source: 'guia-olap-workspace.mdx',
    audience: ['rector', 'decanos', 'directores', 'administradores'],
    classification: 'public-summary',
  },
  {
    slug: 'guia-portal-administracion',
    title: 'Portal de administración',
    summary: 'Usuarios, cierres académicos, ETL, conexiones, esquemas y operaciones ML.',
    group: 'guias-de-uso',
    source: 'guia-portal-administracion.mdx',
    audience: ['administradores'],
    classification: 'restricted',
    requiredRoles: ['SUPERADMIN'],
  },
  {
    slug: 'arquitectura',
    title: 'Arquitectura',
    summary: 'Capacidades del DSS y estado de sus componentes.',
    group: 'plataforma',
    source: 'arquitectura.mdx',
    audience: ['directivos', 'desarrolladores'],
    classification: 'public',
  },
  {
    slug: 'identidad-y-acceso',
    title: 'Identidad y acceso',
    summary: 'Cómo se gestionan la sesión, los perfiles y los permisos.',
    group: 'plataforma',
    source: 'identidad-y-acceso.mdx',
    audience: ['desarrolladores', 'administradores'],
    classification: 'public-summary',
  },
  {
    slug: 'integracion-de-datos',
    title: 'Integración de datos',
    summary: 'Flujo actual de extracción, transformación y publicación.',
    group: 'plataforma',
    source: 'integracion-de-datos.mdx',
    audience: ['desarrolladores', 'administradores'],
    classification: 'public-summary',
  },
  {
    slug: 'analisis-olap',
    title: 'Análisis OLAP',
    summary: 'Consultas multidimensionales y límites conocidos.',
    group: 'plataforma',
    source: 'analisis-olap.mdx',
    audience: ['desarrolladores', 'analistas'],
    classification: 'public-summary',
  },
  {
    slug: 'prediccion',
    title: 'Motor predictivo',
    summary: 'Capacidades implementadas y condiciones de uso.',
    group: 'plataforma',
    source: 'prediccion.mdx',
    audience: ['directivos', 'desarrolladores'],
    classification: 'public-summary',
  },
  {
    slug: 'puesta-en-marcha',
    title: 'Puesta en marcha local',
    summary: 'Preparar y arrancar el entorno de desarrollo.',
    group: 'desarrolladores',
    source: 'puesta-en-marcha.mdx',
    audience: ['desarrolladores'],
    classification: 'public',
  },
  {
    slug: 'inventario-de-apis',
    title: 'Inventario de APIs',
    summary: 'Contratos disponibles y cómo se mantienen.',
    group: 'desarrolladores',
    source: 'api-inventory.mdx',
    audience: ['directivos', 'desarrolladores', 'administradores'],
    classification: 'public',
  },
  {
    slug: 'diagnostico',
    title: 'Diagnóstico inicial',
    summary: 'Comprobaciones seguras para incidencias frecuentes.',
    group: 'desarrolladores',
    source: 'diagnostico.mdx',
    audience: ['desarrolladores', 'administradores'],
    classification: 'public-summary',
  },
];

export function findDoc(slug: string): DocMeta | undefined {
  return docs.find((doc) => doc.slug === slug);
}

export function groupTitle(id: GroupId): string {
  return groups.find((group) => group.id === id)?.title ?? id;
}
