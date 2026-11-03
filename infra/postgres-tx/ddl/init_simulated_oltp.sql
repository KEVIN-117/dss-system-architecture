-- ============================================================================
-- DDL AUTORITATIVO PARA LA BASE DE DATOS OPERACIONAL (OLTP) SIMULADA
-- Proyecto: UATF Academic DSS-DW-ML (DATA-001 / Issue #206)
-- Esquema: Jachasun (PostgreSQL 14.2+)
-- Fuente de Referencia: DataGrip Project 'jachasum' & ddl_jachasun.sql auditado
-- ============================================================================

-- Configuración de sesión y codificación
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

-- ============================================================================
-- 1. ESQUEMAS Y EXTENSIONES
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS academico;
CREATE SCHEMA IF NOT EXISTS actas_graduacion;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. SECUENCIAS
-- ============================================================================

-- Secuencias en esquema public
CREATE SEQUENCE IF NOT EXISTS public.prs_pais_2_id_pais_seq START WITH 100 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.lugar_departamento_v2_cod_dep_seq START WITH 20 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.lugar_provincia_cod_prov_2_seq START WITH 50 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.lugar_localidad_n_cod_loc_seq START WITH 100 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.prs_colegios_id_seq START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_postulantes_id START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.notas_planilla_id_matricula_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.matriculas_id_matricula_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.cajas_transac_id_transaccio_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.valores_trans_id_trans_seq START WITH 1 INCREMENT BY 1;

-- Secuencias en esquema academico
CREATE SEQUENCE IF NOT EXISTS academico.alm_programas_f_id_facultad_seq START WITH 20 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS academico.pln_materias1_ne_id_materia_seq START WITH 1000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS academico.alumnos_id_alumno_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS academico.alm_programaciones_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS academico.seq_id_dct_asignaciones START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS academico.planes_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS academico.carreras_menciones_id_seq START WITH 1 INCREMENT BY 1;

-- Secuencias en esquema actas_graduacion
CREATE SEQUENCE IF NOT EXISTS actas_graduacion.graduados_id_seq START WITH 1 INCREMENT BY 1;

-- ============================================================================
-- 3. NIVEL 0: CATÁLOGOS RAÍZ INDEPENDIENTES (Sin FKs salientes)
-- ============================================================================

-- 3.1. Países
CREATE TABLE IF NOT EXISTS public.prs_pais_v2 (
    id_pais integer DEFAULT nextval('public.prs_pais_2_id_pais_seq'::regclass) NOT NULL PRIMARY KEY,
    cod_pais char(2),
    pais varchar(255),
    sigla varchar(10),
    nacionalidad varchar(50),
    cod_numerico integer,
    calificacion smallint,
    num_materias smallint,
    estado varchar(1) DEFAULT 'A',
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
);

-- 3.2. Estados Civiles
CREATE TABLE IF NOT EXISTS public._bp_estados_civiles (
    id_estado_civil serial NOT NULL PRIMARY KEY,
    cod_estado_civil varchar(3),
    estado_civil varchar(50) NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario varchar(20),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _is2doa boolean
);

-- 3.3. Tipo de Calificación de Colegio (Fiscal / Particular / Convenio)
CREATE TABLE IF NOT EXISTS public.prs_calificacion (
    id_calificacion varchar(1) NOT NULL PRIMARY KEY,
    calificacion varchar(20) NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
);

-- 3.4. Modalidades de Examen / Admisión
CREATE TABLE IF NOT EXISTS public.prs_examen (
    id_examen integer NOT NULL PRIMARY KEY,
    examen varchar NOT NULL,
    costo integer,
    obs varchar(32),
    abreviacion varchar(25),
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    peso smallint,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    fecha_inicio date,
    fecha_fin date
);

-- 3.5. Facultades UATF
CREATE TABLE IF NOT EXISTS academico.alm_programas_facultades (
    id_facultad integer DEFAULT nextval('academico.alm_programas_f_id_facultad_seq'::regclass) NOT NULL PRIMARY KEY,
    facultad varchar(100) NOT NULL,
    direccion varchar(80),
    telefono varchar(10),
    estado char DEFAULT 'A',
    fec_creacion date,
    facu_abre varchar(50),
    escudo char(60),
    imagen char(60),
    estadovirtual char,
    decano integer,
    web varchar(50),
    fax varchar(15),
    email varchar(45),
    sigla varchar(20)
);

-- 3.6. Tipos de Carrera (Semestral / Anual / Programa)
CREATE TABLE IF NOT EXISTS academico.carreras_tipos (
    tipo_c varchar(1) NOT NULL PRIMARY KEY,
    tipo varchar(20),
    descripcion varchar,
    semanas smallint
);

-- 3.7. Sedes Universitarias (Central Potosí y Sub-sedes provinciales)
CREATE TABLE IF NOT EXISTS academico.sedes (
    id_sede varchar(5) NOT NULL PRIMARY KEY,
    sede varchar(50),
    tipo varchar(1) DEFAULT 'C',
    nom_sede varchar(50)
);

-- 3.8. Estados Académicos de Alumnos (P=Regular, A=Egresado, T=Titulado, etc.)
CREATE TABLE IF NOT EXISTS academico.alumnos_estados (
    estado varchar(1) NOT NULL PRIMARY KEY,
    descripcion varchar(50),
    visible boolean DEFAULT true,
    estado_original varchar(10)
);

-- 3.9. Períodos Académicos del Sistema (0=Verano, 1=Semestre I, 2=Semestre II, 3=Anual)
CREATE TABLE IF NOT EXISTS academico.periodos (
    id_periodo integer NOT NULL PRIMARY KEY,
    periodo varchar(50),
    des_periodo varchar(50),
    orden smallint,
    tipo char[]
);

-- 3.10. Régimen de Dedicación Docente (TC, MT, TH)
CREATE TABLE IF NOT EXISTS academico.docentes_tiempo (
    tiempo varchar(5) NOT NULL PRIMARY KEY,
    descripcion varchar(50),
    horas integer
);

-- 3.11. Edificios e Infraestructura
CREATE TABLE IF NOT EXISTS academico.alm_programas_edificios (
    id_edificio smallint NOT NULL PRIMARY KEY,
    edificio varchar(100)
);

-- ============================================================================
-- 4. NIVEL 1: DEPARTAMENTOS, PERIODOS REFLEXIVOS Y PROGRAMAS ACADÉMICOS
-- ============================================================================

-- 4.1. Departamentos Geográficos de Bolivia
CREATE TABLE IF NOT EXISTS public.lugar_departamento (
    cod_dep integer DEFAULT nextval('public.lugar_departamento_v2_cod_dep_seq'::regclass) NOT NULL PRIMARY KEY,
    departamento varchar(50) NOT NULL,
    sigla varchar(5),
    cod_pais integer REFERENCES public.prs_pais_v2(id_pais),
    _registro timestamp without time zone DEFAULT now() NOT NULL,
    expedido varchar(5)
);

-- 4.2. Períodos Operacionales (con auto-referencia id_periodo_relacion)
CREATE TABLE IF NOT EXISTS academico.alm_periodos (
    id_periodo smallint NOT NULL PRIMARY KEY,
    periodo varchar(50),
    descripcion varchar,
    id_periodo_relacion smallint NOT NULL,
    _unique integer DEFAULT 1,
    CONSTRAINT fk_alm_periodos_relacion FOREIGN KEY (id_periodo_relacion) REFERENCES academico.alm_periodos(id_periodo)
);

-- 4.3. Programas Académicos / Carreras (Esquema canónico auditado de 42 columnas)
CREATE TABLE IF NOT EXISTS academico.alm_programas (
    id_programa char(3) NOT NULL PRIMARY KEY,
    programa varchar(50) NOT NULL,
    id_facultad smallint NOT NULL REFERENCES academico.alm_programas_facultades(id_facultad),
    facultad integer REFERENCES academico.alm_programas_facultades(id_facultad),
    id_nivel smallint DEFAULT 1 NOT NULL,
    titulo varchar(60) DEFAULT '' NOT NULL,
    activo varchar DEFAULT 'A',
    nivel varchar(45) DEFAULT 'LIC',
    fec_creacion date,
    tipo varchar REFERENCES academico.carreras_tipos(tipo_c),
    anulacion_parc varchar(2),
    fecha_aprob_curriculo date,
    fecha_creacion date,
    resol_hcu char(10),
    resol_dsa char(10),
    resol_hcf char(10),
    cert_ceub char(10),
    direccion char(75),
    fax char(75),
    telefono char(12),
    casilla char(12),
    email char(50),
    web char(50),
    num_2doturno_permitido integer DEFAULT 2,
    nota_min_paralela integer DEFAULT 51,
    escudo char(60),
    imagen char(60),
    id_plan smallint DEFAULT 2018,
    id_materia_pre000 smallint,
    nota_minima integer DEFAULT 51,
    sede varchar(1) REFERENCES academico.sedes(id_sede),
    director integer,
    _tipo_academico char(3) DEFAULT 'CAR'::bpchar NOT NULL,
    _tiene_examen_mesa boolean DEFAULT true,
    id_programa_padre char(3),
    num_parc smallint DEFAULT 4 NOT NULL,
    moodle smallint DEFAULT 1,
    nota_2do_habilitacion smallint DEFAULT 40 NOT NULL,
    pabreviacion varchar,
    id_edificio smallint DEFAULT 1 NOT NULL,
    nro_max_arrastres integer DEFAULT 2 NOT NULL,
    tipo_cobro varchar DEFAULT 'NORMAL' NOT NULL,
    documento bytea
);

-- ============================================================================
-- 5. NIVEL 2: PROVINCIAS, PROGRAMAS COMPLEMENTARIOS, DOCENTES Y MATERIAS
-- ============================================================================

-- 5.1. Provincias
CREATE TABLE IF NOT EXISTS public.lugar_provincia (
    cod_prov integer DEFAULT nextval('public.lugar_provincia_cod_prov_2_seq'::regclass) NOT NULL PRIMARY KEY,
    cod_dep smallint REFERENCES public.lugar_departamento(cod_dep),
    cod_prov_original smallint,
    provincia varchar(40),
    cod_pais integer REFERENCES public.prs_pais_v2(id_pais),
    cod_prov_2 integer
);

-- 5.2. Catálogo Desnormalizado de Programas
CREATE TABLE IF NOT EXISTS public.fac_programas (
    id_programa varchar(3) NOT NULL PRIMARY KEY,
    programa varchar NOT NULL,
    id_facultad varchar NOT NULL,
    tipo_c varchar(1) NOT NULL,
    tiempo_estudio smallint,
    activo varchar(1) DEFAULT 'A',
    id_sede integer DEFAULT 1,
    facultad_completo varchar,
    facultad varchar,
    orden varchar,
    lugar char(1)
);

-- 5.3. Docentes Universitarios
CREATE TABLE IF NOT EXISTS academico.docentes (
    id_docente integer NOT NULL PRIMARY KEY,
    nombres varchar(50) NOT NULL,
    paterno varchar(50),
    materno varchar(50),
    clave varchar(100) NOT NULL,
    estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    ci varchar,
    fec_nac date,
    id_programa char(3) REFERENCES academico.alm_programas(id_programa),
    tiempo varchar(5) REFERENCES academico.docentes_tiempo(tiempo),
    usuario varchar(30) UNIQUE,
    mail varchar(50),
    sexo varchar(1),
    telefono varchar(15),
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL
);

-- 5.4. Malla Curricular y Asignaturas (Con crédito oficial y compatibilidad hacia DW)
CREATE TABLE IF NOT EXISTS academico.pln_materias (
    id_materia integer DEFAULT nextval('academico.pln_materias1_ne_id_materia_seq'::regclass) NOT NULL PRIMARY KEY,
    sigla char(7) NOT NULL,
    materia varchar NOT NULL,
    hrs_teoricas smallint DEFAULT 0,
    hrs_practicas smallint DEFAULT 0,
    ciclo integer DEFAULT 1,
    id_dpto char(3) DEFAULT '1'::bpchar,
    hrs_laboratorio smallint DEFAULT 0,
    id_programa char(3) REFERENCES academico.alm_programas(id_programa),
    color char(7) DEFAULT '#000000'::bpchar,
    nivel_academico smallint DEFAULT 1,
    grupom varchar DEFAULT 'XXXX',
    mension integer DEFAULT 0,
    control bigint DEFAULT 0,
    id_plan integer DEFAULT 2018,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    nota_minima smallint DEFAULT 51 NOT NULL,
    tiene_viaje_practica boolean DEFAULT false,
    mostrarnotas boolean DEFAULT true,
    atributos varchar[],
    _obs varchar DEFAULT ''::character varying NOT NULL,
    _creditos smallint DEFAULT 4 NOT NULL,
    creditos smallint GENERATED ALWAYS AS (_creditos) STORED,
    id_materia_padre integer REFERENCES academico.pln_materias(id_materia),
    descripcion varchar,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    materia_graduacion char(2) DEFAULT 'NO'::bpchar
);

-- 5.5. Menciones Curriculares
CREATE TABLE IF NOT EXISTS academico.carreras_menciones (
    id integer DEFAULT nextval('academico.carreras_menciones_id_seq'::regclass) NOT NULL PRIMARY KEY,
    id_programa varchar(3) REFERENCES academico.alm_programas(id_programa),
    id_plan integer,
    id_mencion integer,
    mencion varchar(100),
    descripcion varchar(200)
);

-- ============================================================================
-- 6. NIVEL 3: LOCALIDADES Y CONVALIDACIONES
-- ============================================================================

-- 6.1. Localidades Geográficas
CREATE TABLE IF NOT EXISTS public.lugar_localidad (
    cod_loc integer DEFAULT nextval('public.lugar_localidad_n_cod_loc_seq'::regclass) NOT NULL PRIMARY KEY,
    cod_prov integer NOT NULL REFERENCES public.lugar_provincia(cod_prov),
    cod_dep integer REFERENCES public.lugar_departamento(cod_dep),
    cod_pais integer REFERENCES public.prs_pais_v2(id_pais),
    localidad varchar(200),
    cod_prov_original integer,
    cod_prov_2 integer,
    cod_prov_3 integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
);

-- 6.2. Equivalencias y Prerrequisitos Curriculares (Planes)
CREATE TABLE IF NOT EXISTS academico.planes (
    id integer DEFAULT nextval('academico.planes_id_seq'::regclass) NOT NULL PRIMARY KEY,
    id_plan smallint NOT NULL,
    id_programa char(3) NOT NULL REFERENCES academico.alm_programas(id_programa),
    corr0 timestamp with time zone DEFAULT now() NOT NULL,
    id_gestion smallint,
    id_materia_ant smallint NOT NULL REFERENCES academico.pln_materias(id_materia),
    id_materia_eqv smallint NOT NULL REFERENCES academico.pln_materias(id_materia),
    nivel_academico smallint,
    tipo char NOT NULL,
    ctrlultsem smallint DEFAULT 0,
    id_mencion smallint DEFAULT 0 NOT NULL,
    prog bigint,
    observacion text,
    mencion_old smallint,
    id_materia_ant_array integer[]
);

-- ============================================================================
-- 7. NIVEL 4: COLEGIOS Y ASIGNACIÓN DOCENTE
-- ============================================================================

-- 7.1. Unidades Educativas / Colegios de Bachillerato
CREATE TABLE IF NOT EXISTS public.prs_colegios (
    id_colegio integer DEFAULT nextval('public.prs_colegios_id_seq'::regclass) NOT NULL PRIMARY KEY,
    id_colegio_original smallint DEFAULT 0 NOT NULL,
    colegio varchar(65) NOT NULL,
    tipo char(1) DEFAULT 'F'::bpchar NOT NULL,
    turno char(1) DEFAULT 'M'::bpchar NOT NULL,
    area char(1) DEFAULT 'U'::bpchar NOT NULL,
    cod_dep smallint DEFAULT 5 NOT NULL,
    cod_prov smallint DEFAULT 1 NOT NULL,
    cod_loc smallint NOT NULL REFERENCES public.lugar_localidad(cod_loc),
    cod_prov_2 integer DEFAULT 0 NOT NULL,
    id_pais smallint DEFAULT 27 NOT NULL,
    cod_ue varchar(16),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    cod_prov_original smallint,
    fecha timestamp without time zone DEFAULT now()
);

-- 7.2. Asignaciones Docentes por Gestión, Período y Grupo
CREATE TABLE IF NOT EXISTS academico.dct_asignaciones (
    id_dct_asignaciones integer DEFAULT nextval('academico.seq_id_dct_asignaciones'::regclass) NOT NULL PRIMARY KEY,
    id_docente integer NOT NULL REFERENCES academico.docentes(id_docente),
    id_programa char(3) NOT NULL REFERENCES academico.alm_programas(id_programa),
    id_materia integer NOT NULL REFERENCES academico.pln_materias(id_materia),
    id_grupo smallint DEFAULT 1 NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    fecha date,
    tipo_calificacion varchar(3) DEFAULT 'N'::character varying,
    se_elegido varchar(1) DEFAULT 'N'::character varying NOT NULL,
    cupo_max smallint DEFAULT 60,
    _estado char DEFAULT 'A'::bpchar NOT NULL,
    observacion varchar,
    fec_registro timestamp with time zone DEFAULT now(),
    CONSTRAINT dct_asignaciones_unique UNIQUE (id_programa, id_materia, id_grupo, id_gestion, id_periodo)
);

-- ============================================================================
-- 8. NIVEL 5: PADRÓN CIVIL Y DEMOGRÁFICO MAESTRO
-- ============================================================================

-- 8.1. Padrón Demográfico Único de Personas / Estudiantes
CREATE TABLE IF NOT EXISTS public.uatf_datos (
    id_ra varchar(10) NOT NULL PRIMARY KEY,
    nro_dip varchar(15) UNIQUE,
    paterno varchar(64),
    materno varchar(64),
    nombres varchar(128),
    id_sexo varchar(1),
    fec_nacimiento date,
    nac_pais integer REFERENCES public.prs_pais_v2(id_pais),
    id_dep smallint REFERENCES public.lugar_departamento(cod_dep),
    id_prov_original smallint,
    id_loc smallint REFERENCES public.lugar_localidad(cod_loc),
    direccion varchar(60),
    telefono varchar(15),
    id_colegio smallint REFERENCES public.prs_colegios(id_colegio),
    egr_gestion smallint,
    fec_registro timestamp with time zone DEFAULT now() NOT NULL,
    id_calificacion varchar(1) DEFAULT '1'::character varying REFERENCES public.prs_calificacion(id_calificacion),
    tel_per varchar(15),
    tel_urg varchar(15),
    tel_whatsapp varchar(20) DEFAULT ''::character varying,
    zona varchar(50),
    estado_civil smallint DEFAULT 1 NOT NULL REFERENCES public._bp_estados_civiles(id_estado_civil),
    tdni varchar DEFAULT 'CI',
    dip_bach varchar,
    idfacebook varchar(64),
    obs varchar,
    email varchar(50),
    id_prov_2 integer,
    id_prov integer,
    id_loc_3 integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    tipo_sanguineo smallint DEFAULT 0 NOT NULL,
    estado_civil_original smallint,
    _id_usuario varchar(32) DEFAULT 'root'::character varying NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _tsidx tsvector,
    nacionalidad char(25) DEFAULT 'BOLIVIANO'::bpchar,
    tipo_nro_dip char(2) DEFAULT 'PT'::bpchar,
    _fecha_registro timestamp without time zone DEFAULT now() NOT NULL
);

-- ============================================================================
-- 9. NIVEL 6: POSTULANTES Y ALUMNOS MATRICULADOS
-- ============================================================================

-- 9.1. Intentos de Admisión
CREATE TABLE IF NOT EXISTS public.postulantes (
    id_alumno integer DEFAULT nextval('public.seq_postulantes_id'::regclass) NOT NULL PRIMARY KEY UNIQUE,
    id_programa char(3) NOT NULL REFERENCES academico.alm_programas(id_programa),
    id_ra varchar(10) NOT NULL REFERENCES public.uatf_datos(id_ra),
    fec_inscripcion date DEFAULT now(),
    hora timestamp(0) with time zone DEFAULT now(),
    id_plan smallint DEFAULT 2018,
    id_grado char(1) DEFAULT 'A'::bpchar NOT NULL,
    estado char(1) DEFAULT 'P'::bpchar,
    id_calificacion char(1),
    promedio numeric(6,2),
    nro_dip varchar(15),
    antes_examen_old varchar(2),
    examen integer REFERENCES public.prs_examen(id_examen),
    id_acceso char(2),
    id_periodo smallint DEFAULT 1,
    id_gestion smallint,
    clave varchar,
    id_programa_a char(3),
    nota integer DEFAULT 0,
    obs char(1),
    observacion varchar(50),
    anular_otra_carrera char(2) DEFAULT NULL::bpchar,
    guia boolean DEFAULT false NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    fecha_aprobacion date,
    _ult_usuario integer DEFAULT 0 NOT NULL,
    _id_usuario varchar(16) DEFAULT ''::character varying NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    antes_examen smallint DEFAULT 0 NOT NULL,
    tipo_nro_dip varchar(2),
    nro_postulacion integer,
    sau_id_grupo integer,
    fec_calificacion timestamp without time zone
);

-- 9.2. Estudiantes Regulares Matriculados
CREATE TABLE IF NOT EXISTS academico.alumnos (
    id_alumno integer DEFAULT nextval('academico.alumnos_id_alumno_seq'::regclass) NOT NULL PRIMARY KEY,
    id_programa char(3) NOT NULL REFERENCES academico.alm_programas(id_programa),
    id_ra varchar(10) REFERENCES public.uatf_datos(id_ra),
    fec_inscripcion date DEFAULT now() NOT NULL,
    fec_egreso date DEFAULT now(),
    id_plan smallint DEFAULT 2018,
    id_grado char DEFAULT 'A'::bpchar NOT NULL,
    id_tipo_aprobacion_bk varchar,
    estado char DEFAULT 'P'::bpchar NOT NULL REFERENCES academico.alumnos_estados(estado),
    tipo_alumno char DEFAULT 'B'::bpchar NOT NULL,
    observacion varchar,
    ult_usuario varchar(64),
    clave_cert varchar,
    carrera smallint DEFAULT 1,
    reprogramar char DEFAULT 'N'::bpchar,
    id_tipo_aprobacion smallint REFERENCES public.prs_examen(id_examen),
    f_anula timestamp without time zone,
    _id_usuario_r varchar,
    bloqueado char,
    _id_modalidad integer,
    ssu char DEFAULT 'S'::bpchar NOT NULL,
    _fecha_registro timestamp without time zone DEFAULT now(),
    id_postulante integer DEFAULT 0,
    id_mencion integer DEFAULT 0 NOT NULL
);

-- ============================================================================
-- 10. NIVEL 7: MATRÍCULAS, CALIFICACIONES Y TITULACIÓN
-- ============================================================================

-- 10.0. Matrícula administrativa por alumno, gestión y período
-- Se conservan las dos claves únicas observadas en el DDL OLTP de referencia.
CREATE TABLE IF NOT EXISTS public.matriculas (
    id_matricula integer DEFAULT nextval('public.matriculas_id_matricula_seq'::regclass) NOT NULL PRIMARY KEY,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_alumno integer NOT NULL,
    clave varchar(10),
    fec_registro date DEFAULT now() NOT NULL,
    ult_usuario varchar(64) NOT NULL,
    estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    carrera smallint,
    programacion char(1),
    tramite varchar(64) DEFAULT 'REGULAR'::character varying NOT NULL,
    tipo char(1),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _ip_usuario varchar,
    tipo_verificado varchar(20),
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    id_tipo_matricula varchar(3) DEFAULT 'ER'::character varying,
    _costo numeric,
    id_tipo_mat varchar,
    id_tipo varchar DEFAULT 'E'::character varying,
    tipo_matricula char(1) DEFAULT 'R'::bpchar,
    _id_tipo_matricula integer,
    fecha_pago_pasarela timestamp without time zone,
    niv_acad smallint DEFAULT 0,
    CONSTRAINT uq_public_matricula_gestion_periodo_alumno
        UNIQUE (id_gestion, id_periodo, id_alumno),
    CONSTRAINT uq_public_matricula_gestion_periodo_alumno_fecha
        UNIQUE (id_gestion, id_periodo, id_alumno, fec_registro)
);

-- 10.0.1. Transacciones de caja; id_transaccion identifica un evento de compra.
CREATE TABLE IF NOT EXISTS public.cajas_transacciones (
    id_transaccion integer DEFAULT nextval('public.cajas_transac_id_transaccio_seq'::regclass) NOT NULL PRIMARY KEY,
    id_ra varchar(10),
    id_alumno integer,
    id_cargo varchar(4) NOT NULL,
    fec_transaccion date DEFAULT now() NOT NULL,
    cajero varchar,
    envia varchar NOT NULL,
    id_tipo_transaccion integer DEFAULT (-1) NOT NULL,
    estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    fec_pago timestamp(0) without time zone DEFAULT now() NOT NULL,
    costo numeric(12,2) DEFAULT 0,
    id_recibo varchar(10),
    hora varchar(10),
    nro_pago varchar(3),
    fec_ult_cancelacion timestamp(0) without time zone,
    fec_prox_cancelacion date,
    monto_prox_cuota numeric(7,2),
    cuotas_canceladas varchar(300),
    estado_credito varchar(15),
    saldo_ant_pago numeric(7,2),
    saldo_actual numeric(7,2),
    tc numeric(5,2),
    montobs numeric(7,2),
    id_sede smallint,
    nit varchar(10),
    nro_orden varchar(15),
    nro_factura varchar,
    alfanumerico varchar(10),
    a_nombre_de varchar(50),
    nit_factura varchar(10),
    id_gestion smallint,
    id_periodo smallint,
    id_trans integer,
    _id_usuario varchar(64),
    _fec_guia date,
    num_control varchar DEFAULT '-'::character varying,
    tipo_alumno varchar DEFAULT 'ER'::character varying,
    importe_deposito numeric DEFAULT 0,
    comprobante_deposito varchar DEFAULT ''::character varying,
    tipo_pago varchar DEFAULT 'EFECTIVO'::character varying NOT NULL,
    id_matricula integer,
    nro_cuota smallint DEFAULT 1 NOT NULL
);

-- 10.0.2. Detalle de cargos y conceptos, vinculado con caja por id_caja_tran.
CREATE TABLE IF NOT EXISTS public.valores_transacciones (
    id_transaccion integer DEFAULT nextval('public.valores_trans_id_trans_seq'::regclass) NOT NULL PRIMARY KEY,
    id_alumno integer NOT NULL,
    id_programa char(3) NOT NULL,
    id_cargo varchar(4),
    id_concepto varchar(4) NOT NULL,
    costo numeric(12,2) DEFAULT 0,
    fecha date DEFAULT now() NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    ult_usuario varchar(64),
    estado char(1),
    id_ra varchar(10),
    envia varchar(64),
    id_tipo_transaccion integer,
    sistema char(1),
    id_caja_tran integer
);

-- 10.1. Programaciones / Inscripciones a Materias
CREATE TABLE IF NOT EXISTS academico.alm_programaciones (
    id integer DEFAULT nextval('academico.alm_programaciones_id_seq'::regclass) NOT NULL PRIMARY KEY,
    id_alumno integer NOT NULL REFERENCES academico.alumnos(id_alumno),
    id_materia integer NOT NULL REFERENCES academico.pln_materias(id_materia),
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL REFERENCES academico.alm_periodos(id_periodo),
    id_grupo smallint DEFAULT 1,
    fecha timestamp without time zone DEFAULT now() NOT NULL,
    ult_usuario varchar(22) NOT NULL,
    estado char DEFAULT 'A'::bpchar NOT NULL,
    marcador smallint,
    pparcial smallint DEFAULT (0)::smallint,
    sparcial smallint DEFAULT (0)::smallint,
    tparcial smallint DEFAULT (0)::smallint,
    cparcial smallint DEFAULT (0)::smallint,
    promparcial smallint DEFAULT (0)::smallint,
    pract smallint DEFAULT (0)::smallint,
    prompract smallint DEFAULT (0)::smallint,
    lab smallint DEFAULT (0)::smallint,
    promlab smallint DEFAULT (0)::smallint,
    notapres smallint DEFAULT (0)::smallint,
    exfinal smallint DEFAULT (0)::smallint,
    promexfinal smallint DEFAULT (0)::smallint,
    nota smallint DEFAULT (0)::smallint,
    nota_2da smallint DEFAULT (0)::smallint,
    nota_ex_mesa smallint DEFAULT (0)::smallint,
    observacion char(2) DEFAULT 'R'::bpchar,
    num_2do_turno integer,
    tipo_prog char,
    metodo_programacion varchar(100) DEFAULT 'DESCONOCIDO'::character varying,
    _estado varchar DEFAULT 'REGISTRADO'::character varying NOT NULL,
    tipo_programacion varchar DEFAULT 'NORMAL'::character varying,
    CONSTRAINT alm_programaciones_unique UNIQUE (id_alumno, id_materia, id_gestion, id_periodo, id_grupo)
);

-- 10.2. Actas de Calificación Consolidada (Fuente de dw.fact_cursado)
CREATE TABLE IF NOT EXISTS academico.notas_planilla (
    id_matricula integer DEFAULT nextval('public.notas_planilla_id_matricula_seq'::regclass) NOT NULL PRIMARY KEY UNIQUE,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_alumno integer NOT NULL REFERENCES academico.alumnos(id_alumno),
    id_materia smallint NOT NULL REFERENCES academico.pln_materias(id_materia),
    grupo smallint DEFAULT 1,
    nota numeric(5,2) DEFAULT 0,
    ult_usuario varchar NOT NULL,
    estado char NOT NULL,
    observacion varchar,
    nota_2da numeric DEFAULT 0,
    nota_ex_mesa numeric DEFAULT 0,
    pparcial numeric DEFAULT 0,
    sparcial numeric DEFAULT 0,
    tparcial numeric DEFAULT 0,
    cparcial numeric DEFAULT 0,
    promparcial numeric DEFAULT 0,
    pract numeric DEFAULT 0,
    prompract numeric DEFAULT 0,
    lab numeric DEFAULT 0,
    promlab numeric DEFAULT 0,
    notapres numeric DEFAULT 0,
    exfinal numeric DEFAULT 0,
    promexfinal numeric DEFAULT 0,
    tipo varchar(1) DEFAULT 'N'::character varying,
    dictamen varchar,
    _fecha_creacion timestamp without time zone DEFAULT now(),
    id_materia_cnv integer[],
    _unique integer DEFAULT 1 NOT NULL,
    __estado varchar DEFAULT 'A'::character varying NOT NULL,
    __obsv varchar DEFAULT ''::character varying,
    _hash varchar(64) DEFAULT ''::character varying,
    CONSTRAINT notas_planilla_unique UNIQUE (id_gestion, id_periodo, id_alumno, id_materia, grupo, _unique)
);

-- 10.3. Actas de Graduación y Titulación
CREATE TABLE IF NOT EXISTS actas_graduacion.graduados (
    id integer DEFAULT nextval('actas_graduacion.graduados_id_seq'::regclass) NOT NULL PRIMARY KEY,
    id_alumno integer REFERENCES academico.alumnos(id_alumno),
    titulo text,
    id_modalidad integer,
    fecha_graduacion date,
    id_gestion smallint,
    nota_graduacion numeric(10,2),
    id_nota_literal integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char DEFAULT 'A'::bpchar NOT NULL,
    _id_usuario char(32),
    nro_dip char(32),
    id_programa char(3) REFERENCES academico.alm_programas(id_programa)
);

-- ============================================================================
-- 11. ÍNDICES DE RENDIMIENTO PARA EXTRACCIÓN ETL (Apache Hop)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_uatf_datos_id_ra ON public.uatf_datos (id_ra);
CREATE INDEX IF NOT EXISTS idx_uatf_datos_nro_dip ON public.uatf_datos (nro_dip);

CREATE INDEX IF NOT EXISTS idx_postulantes_gestion_periodo ON public.postulantes (id_gestion, id_periodo, id_alumno);
CREATE INDEX IF NOT EXISTS idx_postulantes_ra ON public.postulantes (id_ra);

CREATE INDEX IF NOT EXISTS idx_alumnos_programa ON academico.alumnos (id_programa);
CREATE INDEX IF NOT EXISTS idx_alumnos_ra ON academico.alumnos (id_ra);

CREATE INDEX IF NOT EXISTS idx_pln_materias_programa ON academico.pln_materias (id_programa, ciclo);
CREATE INDEX IF NOT EXISTS idx_pln_materias_padre ON academico.pln_materias (id_materia_padre);

CREATE INDEX IF NOT EXISTS idx_alm_programaciones_alumno ON academico.alm_programaciones (id_alumno, id_gestion);
CREATE INDEX IF NOT EXISTS idx_alm_programaciones_materia ON academico.alm_programaciones (id_materia, id_gestion, id_periodo);

CREATE INDEX IF NOT EXISTS idx_notas_planilla_gestion_periodo ON academico.notas_planilla (id_gestion, id_periodo, id_alumno);
CREATE INDEX IF NOT EXISTS idx_notas_planilla_materia ON academico.notas_planilla (id_materia, estado);

CREATE INDEX IF NOT EXISTS idx_cajas_transacciones_student_period
    ON public.cajas_transacciones (id_alumno, id_gestion, id_periodo);
CREATE INDEX IF NOT EXISTS idx_cajas_transacciones_type_status
    ON public.cajas_transacciones (id_tipo_transaccion, estado, id_gestion, id_periodo);
CREATE INDEX IF NOT EXISTS idx_valores_transacciones_caja
    ON public.valores_transacciones (id_caja_tran);
CREATE INDEX IF NOT EXISTS idx_valores_transacciones_student_period
    ON public.valores_transacciones (id_alumno, id_gestion, id_periodo);
CREATE INDEX IF NOT EXISTS idx_matriculas_student_period_timestamp
    ON public.matriculas (id_alumno, id_gestion, _registrado);

CREATE INDEX IF NOT EXISTS idx_graduados_alumno ON actas_graduacion.graduados (id_alumno);
CREATE INDEX IF NOT EXISTS idx_graduados_programa ON actas_graduacion.graduados (id_programa, id_gestion);
