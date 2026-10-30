import type { SchoolCatalogItem, WeightedItem } from '../types/index.js';
import { sampleWeighted, sampleUniform } from '../utils/discrete-cdf.js';

export class SchoolGenerator {
  private schoolList: SchoolCatalogItem[] = [];
  private typeWeights: WeightedItem<'F' | 'P' | 'C'>[] = [
    { item: 'F', weight: 80.7 },
    { item: 'P', weight: 9.9 },
    { item: 'C', weight: 9.4 },
  ];

  constructor(private schoolsCatalog: any) {
    let currentId = 1;

    // 1. Cargar colegios icónicos de Potosí
    if (this.schoolsCatalog.iconic_potosi_schools) {
      for (const s of this.schoolsCatalog.iconic_potosi_schools) {
        this.schoolList.push({
          id_colegio: currentId++,
          colegio: s.name,
          tipo: (s.type === 'Particular' ? 'P' : s.type === 'Convenio' ? 'C' : 'F'),
          turno: (s.shift === 'Tarde' ? 'T' : s.shift === 'Noche' ? 'N' : 'M'),
          area: 'U',
          cod_dep: 5, // Potosí
          cod_prov: 1, // Tomás Frías
          cod_loc: 1, // Potosí
          cod_ue: s.cod_ue?.toString(),
          dependency: s.type,
        });
      }
    }

    // 2. Cargar colegios de subsedes provinciales
    if (this.schoolsCatalog.provincial_sub_sede_schools) {
      for (const s of this.schoolsCatalog.provincial_sub_sede_schools) {
        this.schoolList.push({
          id_colegio: currentId++,
          colegio: s.name,
          tipo: (s.type === 'Particular' ? 'P' : s.type === 'Convenio' ? 'C' : 'F'),
          turno: 'M',
          area: 'P',
          cod_dep: 5,
          cod_prov: s.cod_prov || 1,
          cod_loc: s.cod_loc || 1,
          cod_ue: s.cod_ue?.toString(),
          dependency: s.type,
        });
      }
    }

    // 3. Cargar muestra ampliada si existe
    if (this.schoolsCatalog.potosi_schools_catalog_sample) {
      for (const s of this.schoolsCatalog.potosi_schools_catalog_sample) {
        this.schoolList.push({
          id_colegio: currentId++,
          colegio: s.name || s.colegio,
          tipo: (s.type === 'Particular' ? 'P' : s.type === 'Convenio' ? 'C' : 'F'),
          turno: 'M',
          area: 'U',
          cod_dep: 5,
          cod_prov: 1,
          cod_loc: 1,
          cod_ue: s.cod_ue?.toString(),
          dependency: s.type,
        });
      }
    }

    // Fallback de seguridad si no hay colegios cargados
    if (this.schoolList.length === 0) {
      this.schoolList.push({
        id_colegio: 1,
        colegio: 'COLEGIO NACIONAL PICHINCHA',
        tipo: 'F',
        turno: 'M',
        area: 'U',
        cod_dep: 5,
        cod_prov: 1,
        cod_loc: 1,
        cod_ue: '81980001',
        dependency: 'Fiscal',
      });
    }
  }

  public getAllSchools(): SchoolCatalogItem[] {
    return this.schoolList;
  }

  /**
   * Selecciona un colegio respetando la ponderación institucional (Fiscal 80.7%, Particular 9.9%, Convenio 9.4%)
   */
  public sampleSchool(): SchoolCatalogItem {
    const targetType = sampleWeighted(this.typeWeights);
    const candidates = this.schoolList.filter((s) => s.tipo === targetType);
    if (candidates.length > 0) {
      return sampleUniform(candidates);
    }
    return sampleUniform(this.schoolList);
  }
}
