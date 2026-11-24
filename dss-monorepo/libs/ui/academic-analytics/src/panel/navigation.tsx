import type { ReactNode } from 'react';
import {
  Activity,
  Building2,
  Calculator,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Layers,
  Library,
  MapPin,
  Repeat,
  School,
  TrendingDown,
  TriangleAlert,
  UserCheck,
  UserRound,
  UsersRound,
  Venus,
} from 'lucide-react';
import type { AcademicScopeKind } from './rendimiento-data';

interface NavItem {
  title: string;
  href: string;
  icon: ReactNode;
  isActive: boolean;
}

export interface AnalyticsNavGroup {
  title: string;
  items: NavItem[];
}

const icon = (Icon: typeof ChartColumn) => <Icon aria-hidden="true" />;

/**
 * Sidebar groups for the Admisión, Matrícula, Rendimiento and Permanencia panels, shared by the rector,
 * decano and director portals. Scoped portals call the faculty ranking
 * "Carreras" because the panel ranks careers directly for them.
 */
export function analyticsNavigation(pathname: string, scope: AcademicScopeKind = 'global'): AnalyticsNavGroup[] {
  const item = (title: string, href: string, glyph: ReactNode): NavItem => ({
    title,
    href,
    icon: glyph,
    isActive: pathname === href,
  });
  return [
    {
      title: 'Admisión académica',
      items: [
        item('Resumen', '/reportes/admision', icon(GraduationCap)),
        item('Por sexo', '/reportes/admision/sexo', icon(Venus)),
        item('Área de conocimiento', '/reportes/admision/area-conocimiento', icon(Library)),
        item(scope === 'global' ? 'Facultad y carrera' : 'Carreras', '/reportes/admision/facultades', icon(Building2)),
        item('Central y sedes', '/reportes/admision/sedes', icon(MapPin)),
        item('Procedencia y nacimiento', '/reportes/admision/procedencia', icon(MapPin)),
        item('Tipo de colegio', '/reportes/admision/tipo-colegio', icon(School)),
        item('Modalidad de ingreso', '/reportes/admision/modalidad', icon(DoorOpen)),
      ],
    },
    {
      title: 'Matrícula',
      items: [
        item('Resumen', '/reportes/matricula', icon(ClipboardList)),
        item(scope === 'global' ? 'Facultad y carrera' : 'Carreras', '/reportes/matricula/facultades', icon(Building2)),
        item('Nuevos y antiguos', '/reportes/matricula/tipo-estudiante', icon(UsersRound)),
        item('Por cohorte de ingreso', '/reportes/matricula/cohortes', icon(Layers)),
        item('Perfil del estudiante', '/reportes/matricula/perfil', icon(UserRound)),
        item('Procedencia', '/reportes/matricula/procedencia', icon(MapPin)),
        item('Central y sedes', '/reportes/matricula/sedes', icon(Building2)),
      ],
    },
    {
      title: 'Rendimiento académico',
      items: [
        item('Resumen', '/reportes/rendimiento', icon(ChartColumn)),
        item('Evaluación de materias', '/reportes/rendimiento/materias', icon(ClipboardCheck)),
        item('Evaluación de estudiantes', '/reportes/rendimiento/estudiantes', icon(UserCheck)),
        item('Promedio de notas (PN)', '/reportes/rendimiento/promedio-notas', icon(Calculator)),
        item('Repitencia (IRE e IRM)', '/reportes/rendimiento/repitencia', icon(Repeat)),
        item('Retención y deserción', '/reportes/rendimiento/retencion', icon(TrendingDown)),
      ],
    },
    {
      title: 'Permanencia académica',
      items: [
        item('Resumen', '/reportes/permanencia', icon(Activity)),
        item('Por cohorte de ingreso', '/reportes/permanencia/cohortes', icon(Layers)),
        item('Nuevos y antiguos', '/reportes/permanencia/tipo-estudiante', icon(UsersRound)),
        item('Perfil del estudiante', '/reportes/permanencia/perfil', icon(UserRound)),
        item('Procedencia', '/reportes/permanencia/procedencia', icon(MapPin)),
        item('Central y sedes', '/reportes/permanencia/sedes', icon(Building2)),
        item('Situación académica', '/reportes/permanencia/situacion-academica', icon(TriangleAlert)),
      ],
    },
  ];
}
