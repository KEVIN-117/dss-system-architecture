import { describe, expect, it } from 'vitest';
import { formatValue, readLabel, readNumber, YEAR_AXIS } from './rendimiento-data';
import { RENDIMIENTO_VIEWS, findView } from './rendimiento-views';

describe('Rendimiento data mapping', () => {
  it('reads Saiku record cells by name, tolerating accents and value wrappers', () => {
    const row = { 'Gestión': '2019', 'Porcentaje de aprobados': { value: 0.5625 }, 'Estudiantes programados': 21521, Facultad: '#null' };
    expect(readLabel(row, 'Gestión')).toBe('2019');
    expect(readLabel(row, 'Facultad')).toBe('Sin dato');
    expect(readNumber(row, 'Porcentaje de aprobados')).toBe(0.5625);
    expect(readNumber(row, 'Estudiantes programados')).toBe(21521);
    expect(readNumber(row, 'Medida ausente')).toBeNull();
    expect(readNumber({ 'Promedio de notas': { value: '' } }, 'Promedio de notas')).toBeNull();
  });

  it('formats counts, decimals and percentages in Bolivian Spanish', () => {
    expect(formatValue(21521, 'count')).toBe('21.521');
    expect(formatValue(36.98, 'decimal')).toBe('37');
    expect(formatValue(0.5625, 'percent')).toMatch(/56,3\s?%/);
    expect(formatValue(null, 'percent')).toBe('—');
  });

  it('queries students by gestión and coursework by period', () => {
    expect(YEAR_AXIS['Rendimiento estudiantil']).toEqual({ dimension: 'Gestión', hierarchy: 'Gestión', level: 'Gestión' });
    expect(YEAR_AXIS['Rendimiento académico'].dimension).toBe('Periodo');
  });
});

describe('Rendimiento views', () => {
  it('defines the bulletin sections with unique slugs and a published headline', () => {
    expect(RENDIMIENTO_VIEWS.map((view) => view.slug)).toEqual([
      'resumen', 'materias', 'estudiantes', 'promedio-notas', 'repitencia', 'retencion',
    ]);
    for (const view of RENDIMIENTO_VIEWS) {
      expect(view.measures.some((measure) => measure.name === view.headline)).toBe(true);
      for (const part of view.stack ?? []) expect(view.measures.some((m) => m.name === part.name)).toBe(true);
      expect(new Set(view.measures.map((m) => m.name)).size).toBe(view.measures.length);
    }
    expect(findView('materias')?.measures.map((m) => m.label)).toContain('Abandono (AB)');
    expect(findView('no-existe')).toBeUndefined();
  });

  it('never shows the old "cursados" wording', () => {
    const text = JSON.stringify(RENDIMIENTO_VIEWS).toLocaleLowerCase('es');
    expect(text).not.toContain('cursados');
  });
});
