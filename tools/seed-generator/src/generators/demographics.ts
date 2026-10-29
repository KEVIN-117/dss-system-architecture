import { fakerES as faker } from '@faker-js/faker';
import type {
  EntityUatfDatos,
  WeightedItem,
} from '../types/index.js';
import { sampleWeighted, sampleUniform, randomInt, chance } from '../utils/discrete-cdf.js';

export interface GeneratedPerson {
  nombres: string;
  paterno: string;
  materno: string;
  nro_dip: string;
  tipo_nro_dip: string;
  id_sexo: 'M' | 'F';
  fec_nacimiento: string;
  direccion: string;
  zona: string;
  telefono: string;
  email: string;
  estado_civil: number;
  cod_dep: number;
  cod_prov: number;
  cod_loc: number;
}

export class DemographicGenerator {
  private surnameWeights: WeightedItem<string>[];
  private extensionWeights: WeightedItem<string>[];
  private maritalStatusWeights: WeightedItem<number>[];
  private departmentWeights: WeightedItem<number>[];

  constructor(
    private demographicCatalog: any,
    private geographicCatalog: any
  ) {
    // 1. Pesos de apellidos empíricos
    this.surnameWeights = this.demographicCatalog.surnames.empirical_top_100.map((s: any) => ({
      item: s.surname,
      weight: s.frequency_percentage,
    }));

    // 2. Pesos de extensiones CI
    this.extensionWeights = Object.entries(
      this.demographicCatalog.document_identification.ci_dip.extension_distribution
    ).map(([ext, weight]) => ({
      item: ext,
      weight: weight as number,
    }));

    // 3. Pesos de estados civiles (códigos 1 a 4)
    this.maritalStatusWeights = Object.entries(
      this.demographicCatalog.demographic_parameters.marital_status
    ).map(([idStr, val]: [string, any]) => ({
      item: parseInt(idStr, 10),
      weight: val.weight,
    }));

    // 4. Departamentos
    this.departmentWeights = this.geographicCatalog.departments.map((d: any) => ({
      item: d.cod_dep,
      weight: d.admission_quota_weight || d.peso_admision || 0.1,
    }));
  }

  /**
   * Genera una persona ficticia con datos demográficos plausibles del altiplano y valles bolivianos.
   * @param gender 'M' o 'F'
   * @param admissionYear Año de postulación para calcular fecha de nacimiento coherente (17 a 25 años)
   */
  public generatePerson(gender: 'M' | 'F', admissionYear = 2020): GeneratedPerson {
    const nameConfig =
      gender === 'M'
        ? this.demographicCatalog.first_names.male
        : this.demographicCatalog.first_names.female;

    // 1. Nombres (simples o compuestos)
    const isComposite = chance(nameConfig.composite_rate);
    const candidateNames: string[] = nameConfig.top_names
      .filter((n: any) => n.is_composite === isComposite)
      .map((n: any) => String(n.name));
    const allNames: string[] = nameConfig.top_names.map((n: any) => String(n.name));
    const nombres: string =
      candidateNames.length > 0
        ? sampleUniform(candidateNames)
        : sampleUniform(allNames);

    // 2. Apellidos paterno y materno
    // Muestreo independiente que preserva la tasa empírica natural de homonimia (~1.07% Mamani Mamani, etc.)
    const paterno = sampleWeighted(this.surnameWeights);
    const materno = sampleWeighted(this.surnameWeights);

    // 3. Cédula de Identidad (DIP) con complementos
    const ciConfig = this.demographicCatalog.document_identification.ci_dip;
    const baseDip = randomInt(ciConfig.min_number, ciConfig.max_number);
    const tipoNroDip = sampleWeighted(this.extensionWeights); // ~70% 'PT'
    const hasComplement = chance(ciConfig.complement_probability);
    const nroDip = hasComplement
      ? `${baseDip}-${randomInt(1, 9)}A`
      : baseDip.toString();

    // 4. Fecha de nacimiento coherente (edad entre 17 y 25 años al postular)
    const age = randomInt(17, 24);
    const birthYear = admissionYear - age;
    const birthMonth = randomInt(1, 12).toString().padStart(2, '0');
    const birthDay = randomInt(1, 28).toString().padStart(2, '0');
    const fecNacimiento = `${birthYear}-${birthMonth}-${birthDay}`;

    // 5. Ubicación y domicilio en Potosí
    const urban = this.geographicCatalog.urban_potosi;
    const neighborhood = sampleUniform(urban.neighborhoods as string[]);
    const street = sampleUniform(urban.streets_and_avenues as string[]);
    const houseNumber = randomInt(12, 950);

    const patternIndex = randomInt(1, 4);
    let direccion: string;
    switch (patternIndex) {
      case 1:
        direccion = `${street} Nº ${houseNumber}, Zona ${neighborhood}`;
        break;
      case 2:
        direccion = `${street} Nº ${houseNumber}, Barrio ${neighborhood}`;
        break;
      case 3:
        direccion = `${street} s/n, ${neighborhood}`;
        break;
      default:
        direccion = `${neighborhood}, ${street} Nº ${houseNumber}`;
        break;
    }

    // 6. Teléfono seguro y correo bajo dominio reservado (.test)
    const phonePrefix = sampleUniform(['718', '724', '738', '687', '679', '757']);
    const phoneSuffix = randomInt(10000, 99999).toString();
    const telefono = `${phonePrefix}${phoneSuffix}`;

    const cleanName = nombres.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
    const cleanSurname = paterno.toLowerCase().replace(/[^a-z]/g, '');
    const email = `${cleanName}.${cleanSurname}${randomInt(10, 99)}@est.uatf.test`;

    // 7. Estado civil (1 a 4)
    const estadoCivil = sampleWeighted(this.maritalStatusWeights);

    // 8. Localidad y procedencia
    let codDep = 5; // Potosí por defecto
    let codProv = 1; // Tomás Frías
    let codLoc = 1; // Potosí Capital

    if (chance(0.25)) {
      // Procedencia de otra provincia de Potosí o departamento
      codDep = sampleWeighted(this.departmentWeights);
      if (codDep === 5) {
        const provs = this.geographicCatalog.potosi_provinces;
        if (provs && provs.length > 0) {
          const prov = sampleUniform(provs) as any;
          codProv = prov.cod_prov || 1;
        }
      }
    }

    return {
      nombres,
      paterno,
      materno,
      nro_dip: nroDip,
      tipo_nro_dip: tipoNroDip,
      id_sexo: gender,
      fec_nacimiento: fecNacimiento,
      direccion,
      zona: neighborhood,
      telefono,
      email,
      estado_civil: estadoCivil,
      cod_dep: codDep,
      cod_prov: codProv,
      cod_loc: codLoc,
    };
  }

  /**
   * Genera un identificador de Registro Académico (id_ra) secuencial único.
   */
  public generateIdRa(index: number): string {
    return `RA-${index.toString().padStart(6, '0')}`;
  }

  /**
   * Convierte a la entidad public.uatf_datos del OLTP
   */
  public toUatfDatosEntity(
    idRa: string,
    person: GeneratedPerson,
    idColegio: number,
    egrGestion: number
  ): EntityUatfDatos {
    return {
      id_ra: idRa,
      nro_dip: person.nro_dip,
      paterno: person.paterno,
      materno: person.materno,
      nombres: person.nombres,
      id_sexo: person.id_sexo,
      fec_nacimiento: person.fec_nacimiento,
      nac_pais: 27, // Bolivia
      id_dep: person.cod_dep,
      id_prov_original: person.cod_prov,
      id_loc: person.cod_loc,
      direccion: person.direccion.substring(0, 60),
      telefono: person.telefono,
      id_colegio: idColegio,
      egr_gestion: egrGestion,
      fec_registro: `${egrGestion + 1}-01-15 08:30:00`,
      id_calificacion: '1', // 1=Fiscal
      tel_per: person.telefono,
      tel_urg: person.telefono,
      tel_whatsapp: person.telefono,
      zona: person.zona.substring(0, 50),
      estado_civil: person.estado_civil,
      tdni: 'CI',
      email: person.email.substring(0, 50),
      nacionalidad: 'BOLIVIANO',
      tipo_nro_dip: person.tipo_nro_dip,
    };
  }
}
