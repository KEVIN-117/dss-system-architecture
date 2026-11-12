import type { ComponentType } from 'react';
import Access from './acceso-al-sistema.mdx';
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
import Rector from './guia-rectorado.mdx';
import Dean from './guia-decanato.mdx';
import Director from './guia-direccion-de-carrera.mdx';
import OlapWorkspace from './guia-olap-workspace.mdx';
import AdminPortal from './guia-portal-administracion.mdx';

/** MDX component per slug. Metadata lives in `catalog.ts`. */
export const components: Record<string, ComponentType> = {
  'primeros-pasos': Start,
  'acceso-al-sistema': Access,
  'resumen-ejecutivo': Executive,
  'guia-rectorado': Rector,
  'guia-decanato': Dean,
  'guia-direccion-de-carrera': Director,
  'guia-olap-workspace': OlapWorkspace,
  'guia-portal-administracion': AdminPortal,
  arquitectura: Architecture,
  'identidad-y-acceso': Identity,
  'integracion-de-datos': Data,
  'analisis-olap': Olap,
  prediccion: Prediction,
  'puesta-en-marcha': Setup,
  'inventario-de-apis': Inventory,
  diagnostico: Diagnostics,
};
