-- SQL Manager for PostgreSQL 6.5.1.57809
-- ---------------------------------------
-- Host      : 10.10.166.120
-- Database  : jachasun
-- Version   : PostgreSQL 9.3.15 on x86_64-unknown-linux-gnu, compiled by gcc (GCC) 4.1.2 20080704 (Red Hat 4.1.2-55), 64-bit



SET check_function_bodies = false;
--
-- Structure for table pln_materias (OID = 87995) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.pln_materias (
    id_materia integer DEFAULT nextval(('"pln_materias1_ne_id_materia_seq"'::text)::regclass) NOT NULL,
    sigla char(7) NOT NULL,
    materia varchar NOT NULL,
    hrs_teoricas smallint DEFAULT 0,
    hrs_practicas smallint DEFAULT 0,
    ciclo integer DEFAULT 0,
    id_dpto char(3) DEFAULT '1'::bpchar,
    hrs_laboratorio smallint DEFAULT 0,
    id_programa char(3),
    color char(7) DEFAULT '#000000'::bpchar,
    nivel_academico smallint,
    grupom varchar DEFAULT 'XXXX'::bpchar,
    mension integer DEFAULT (0)::bigint,
    control bigint DEFAULT 0,
    id_plan integer,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    nota_minima smallint DEFAULT 51 NOT NULL,
    tiene_viaje_practica boolean DEFAULT false,
    mostrarnotas boolean DEFAULT true,
    atributos varchar[],
    _obs varchar DEFAULT ''::character varying NOT NULL,
    _creditos smallint DEFAULT 0 NOT NULL,
    id_materia_padre integer,
    descripcion varchar,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    materia_graduacion char(2) DEFAULT 'NO'::bpchar,
    imprimir_certificado char(1) DEFAULT 'S'::bpchar NOT NULL,
    hrs_semana smallint,
    hrs_semestre smallint,
    creditos smallint,
    hrs_total smallint,
    porcentaje_evaluacion smallint
)
;
--
-- Structure for table bc_items_becas (OID = 88065) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.bc_items_becas (
    id_programa char(3) NOT NULL,
    id_items smallint,
    tipo_post char(1) NOT NULL,
    completas smallint DEFAULT 0,
    id_gestion smallint NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _graduacion smallint DEFAULT 0 NOT NULL,
    _ctrl_gestion smallint DEFAULT 2014 NOT NULL,
    _ctrl_periodo smallint DEFAULT 2 NOT NULL,
    cod_prg varchar(16),
    descripcion varchar(64),
    id serial NOT NULL,
    id_padre integer,
    id_items_old smallint DEFAULT 0 NOT NULL,
    _curr_id_gestion integer DEFAULT 2016 NOT NULL,
    _curr_id_periodo integer DEFAULT 1 NOT NULL,
    id_periodo smallint DEFAULT 1 NOT NULL,
    fec_ini_con timestamp(0) without time zone,
    fec_fin_con timestamp(0) without time zone,
    convocatoria smallint DEFAULT 1::smallint NOT NULL,
    estado_presentado varchar(15) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    usr_cre varchar DEFAULT now(),
    fec_cre timestamp(0) without time zone DEFAULT now(),
    fecha_limit_calif timestamp(0) without time zone,
    fecha_ini_recep timestamp(0) without time zone,
    fecha_fin_recep timestamp(0) without time zone
)
;
--
-- Structure for table alm_programas (OID = 88381) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.alm_programas (
    id_programa char(3) NOT NULL,
    programa varchar NOT NULL,
    id_facultad smallint NOT NULL,
    id_nivel smallint NOT NULL,
    titulo varchar(45) NOT NULL,
    activo varchar,
    nivel varchar(45),
    fec_creacion date,
    tipo varchar,
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
    num_2doturno_permitido integer,
    nota_min_paralela integer,
    escudo char(60),
    imagen char(60),
    id_plan smallint,
    id_materia_pre000 smallint,
    nota_minima integer DEFAULT 0,
    sede varchar(1),
    director integer,
    _tipo_academico char(3) DEFAULT 'CAR'::bpchar NOT NULL,
    _tiene_examen_mesa boolean DEFAULT false,
    id_programa_padre char(3),
    num_parc smallint DEFAULT 3 NOT NULL,
    moodle smallint,
    nota_2do_habilitacion smallint DEFAULT 25 NOT NULL,
    pabreviacion varchar,
    id_edificio smallint DEFAULT 1::smallint NOT NULL,
    nro_max_arrastres integer DEFAULT 2 NOT NULL,
    tipo_cobro varchar DEFAULT 'EFECTIVO'::character varying NOT NULL,
    documento bytea,
    clave_certificado char(2) DEFAULT 'NO'::bpchar NOT NULL,
    name_programa varchar(50),
    carnet_universitario char(2) DEFAULT 'SI'::bpchar,
    tiene_tramites char(2) DEFAULT 'SI'::bpchar,
    tiempo_estudio numeric,
    tipo_estadisticas integer DEFAULT 1
)
;
--
-- Structure for table 2do_turno_exceso (OID = 88648) : 
--
CREATE TABLE academico."2do_turno_exceso" (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo smallint,
    seg_turno smallint,
    materias varchar(100)
)
;
--
-- Structure for table alm_message (OID = 88653) : 
--
CREATE TABLE academico.alm_message (
    id integer DEFAULT nextval('acad_message_id_seq'::regclass) NOT NULL,
    useridfrom bigint DEFAULT 0 NOT NULL,
    useridto bigint DEFAULT 0 NOT NULL,
    subject text,
    fullmessage varchar,
    smallmessage varchar,
    notification smallint DEFAULT 0,
    blocked smallint DEFAULT 1,
    timecreated timestamp without time zone DEFAULT now() NOT NULL,
    state varchar DEFAULT 'A'::character varying NOT NULL
)
;
--
-- Structure for table alm_descripcion_grupos (OID = 88667) : 
--
CREATE TABLE academico.alm_descripcion_grupos (
    id serial NOT NULL,
    id_grupo smallint,
    descripcion varchar,
    txt_grupo varchar
)
;
--
-- Structure for table alm_metodos_grupos (OID = 88675) : 
--
CREATE TABLE academico.alm_metodos_grupos (
    id integer NOT NULL,
    funcion varchar(100),
    descripcion text
)
;
--
-- Structure for table alm_metodos_normales (OID = 88681) : 
--
CREATE TABLE academico.alm_metodos_normales (
    id integer NOT NULL,
    funcion varchar(100),
    descripcion text,
    tiene_parametros boolean DEFAULT false
)
;
--
-- Structure for table alm_metodos_validacion (OID = 88689) : 
--
CREATE TABLE academico.alm_metodos_validacion (
    id integer NOT NULL,
    funcion varchar(100),
    descripcion text
)
;
--
-- Structure for table alm_periodos (OID = 88695) : 
--
CREATE TABLE academico.alm_periodos (
    id_periodo smallint NOT NULL,
    descripcion varchar,
    id_periodo_relacion smallint NOT NULL
)
;
--
-- Structure for table alm_programaciones (OID = 88701) : 
--
CREATE TABLE academico.alm_programaciones (
    id_alumno integer NOT NULL,
    id_materia integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_grupo smallint DEFAULT 1,
    fecha timestamp without time zone DEFAULT now() NOT NULL,
    ult_usuario varchar(22) NOT NULL,
    estado char(1) DEFAULT 'A'::bpchar NOT NULL,
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
    tipo_prog char(1),
    id serial NOT NULL,
    metodo_programacion varchar(100) DEFAULT 'DESCONOCIDO'::character varying,
    _estado varchar DEFAULT 'REGISTRADO'::character varying NOT NULL,
    tipo_programacion varchar DEFAULT 'ESPECIAL'::character varying,
    fecha_creacion timestamp without time zone DEFAULT now(),
    id_sub_grupo smallint,
    fec_nota_lab timestamp without time zone,
    id_padre integer
)
;
--
-- Structure for table alm_programaciones_autorizaciones (OID = 88727) : 
--
CREATE TABLE academico.alm_programaciones_autorizaciones (
    id serial NOT NULL,
    id_alumno integer NOT NULL,
    id_gestion integer NOT NULL,
    id_periodo integer NOT NULL,
    fecha_limite timestamp without time zone NOT NULL,
    autorizacion varchar DEFAULT 'ADICIONAR'::character varying NOT NULL,
    responsable varchar NOT NULL,
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    estado varchar DEFAULT 'REGISTRADO'::character varying NOT NULL
)
;
--
-- Structure for table alm_programaciones_eliminados (OID = 88738) : 
--
CREATE TABLE academico.alm_programaciones_eliminados (
    eliminacion_id serial NOT NULL,
    eliminacion_fecha timestamp without time zone DEFAULT now(),
    eliminacion_razon text DEFAULT 'DESCONOCIDO'::text,
    eliminacion_usuario varchar DEFAULT 'DESCONOCIDO'::character varying,
    eliminacion_usuario_db varchar DEFAULT "current_user"(),
    id_alumno integer NOT NULL,
    id_materia integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_grupo smallint,
    fecha timestamp without time zone NOT NULL,
    ult_usuario varchar(22) NOT NULL,
    estado char(1) NOT NULL,
    marcador smallint,
    pparcial smallint,
    sparcial smallint,
    tparcial smallint,
    cparcial smallint,
    promparcial smallint,
    pract smallint,
    prompract smallint,
    lab smallint,
    promlab smallint,
    notapres smallint,
    exfinal smallint,
    promexfinal smallint,
    nota smallint,
    nota_2da smallint,
    nota_ex_mesa smallint,
    observacion char(2),
    num_2do_turno integer,
    tipo_prog char(1),
    id integer NOT NULL,
    metodo_programacion varchar(100),
    tipo_programacion varchar
)
;
--
-- Structure for table alm_programaciones_lab (OID = 88752) : 
--
CREATE TABLE academico.alm_programaciones_lab (
    id_alumno integer NOT NULL,
    id_materia integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_grupo smallint,
    fecha date DEFAULT now() NOT NULL,
    ult_usuario varchar(10) NOT NULL,
    estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    pparcial double precision DEFAULT 0.0,
    sparcial double precision DEFAULT 0.0,
    tparcial double precision DEFAULT 0.0,
    lab smallint DEFAULT (0)::smallint,
    observacion char(2) DEFAULT 'R'::bpchar,
    tipo_prog char(1),
    cparcial smallint DEFAULT 0,
    promparcial smallint DEFAULT 0,
    pract smallint DEFAULT 0,
    prompract smallint DEFAULT 0,
    promlab smallint DEFAULT 0,
    notapres smallint DEFAULT 0,
    exfinal smallint DEFAULT 0,
    promexfinal smallint DEFAULT 0,
    nota smallint DEFAULT 0,
    nota_2da smallint DEFAULT 0,
    nota_ex_mesa smallint DEFAULT 0,
    _nro_com varchar
)
;
--
-- Structure for table alm_programas_facultades (OID = 88762) : 
--
CREATE TABLE academico.alm_programas_facultades (
    id_facultad integer DEFAULT nextval(('"alm_programas_f_id_facultad_seq"'::text)::regclass) NOT NULL,
    facultad varchar(100) NOT NULL,
    direccion varchar(80),
    telefono varchar(10),
    estado char(1),
    fec_creacion date,
    facu_abre varchar(50),
    escudo char(60),
    imagen char(60),
    estadovirtual char(1),
    decano integer,
    web varchar(50),
    fax varchar(15),
    email varchar(45),
    proceso_historico text,
    vision text,
    mision text
)
;
--
-- Structure for table alm_programas_informacion (OID = 88774) : 
--
CREATE TABLE academico.alm_programas_informacion (
    id_programa varchar NOT NULL,
    fecha_fundacion timestamp without time zone,
    duracion_carrera varchar,
    diploma_academico varchar,
    titulo_provision_nacional varchar,
    modalidades_ingreso text[],
    direccion varchar,
    telefono varchar,
    correo_electronico varchar,
    mision text,
    vision text,
    objetivos text[],
    normas_titulacion text[],
    area_accion text[],
    perfil_profesional text[],
    tiempo_estudio smallint
)
;
--
-- Structure for table alm_programas_parametros (OID = 88780) : 
--
CREATE TABLE academico.alm_programas_parametros (
    id serial NOT NULL,
    id_programa varchar,
    id_gestion integer,
    id_periodo integer,
    fecha_limite_programacion date,
    controles integer[],
    fecha_inicio_reprogramacion timestamp without time zone,
    fecha_limite_reprogramacion timestamp without time zone,
    fi_planificacion_materias timestamp without time zone,
    ff_planificacion_materias timestamp without time zone,
    _modificaciones_fecha_limite_programacion date[],
    fecha1 date DEFAULT now() NOT NULL,
    fecha2 date DEFAULT now() NOT NULL,
    fecha3 date DEFAULT now() NOT NULL,
    fecha4 date DEFAULT now() NOT NULL,
    fechaf date DEFAULT now() NOT NULL,
    fechae date DEFAULT now() NOT NULL,
    fecha_viaje timestamp without time zone,
    necesario_certificado_notas char(2) DEFAULT 'SI'::bpchar,
    desprogramar char(2) DEFAULT 'SI'::bpchar
)
;
--
-- Structure for table alumnos (OID = 88796) : 
--
CREATE TABLE academico.alumnos (
    id_alumno integer DEFAULT nextval('public.alumnos_id_alumno_seq'::regclass) NOT NULL,
    id_programa char(3) NOT NULL,
    id_ra varchar(10),
    fec_inscripcion date DEFAULT now() NOT NULL,
    fec_egreso date DEFAULT now(),
    id_plan smallint,
    id_grado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_tipo_aprobacion_bk varchar,
    estado char(1) DEFAULT 'P'::bpchar NOT NULL,
    tipo_alumno char(1) DEFAULT 'A'::bpchar NOT NULL,
    observacion varchar,
    ult_usuario varchar(64),
    clave_cert varchar,
    carrera smallint,
    reprogramar char(1) DEFAULT 'N'::bpchar,
    id_tipo_aprobacion smallint,
    f_anula timestamp without time zone,
    _id_usuario_r varchar,
    bloqueado char(1),
    _id_modalidad integer,
    ssu char(1) DEFAULT 'S'::bpchar NOT NULL,
    _fecha_registro timestamp without time zone DEFAULT now(),
    id_postulante integer DEFAULT 0,
    id_mencion integer DEFAULT 0 NOT NULL,
    id_tipo_matricula char(4),
    nivel_acad smallint DEFAULT 0 NOT NULL
)
;
--
-- Structure for table alumnos_claves_certificado (OID = 88809) : 
--
CREATE TABLE academico.alumnos_claves_certificado (
    id serial NOT NULL,
    id_alumno integer,
    fecha_creacion timestamp without time zone DEFAULT now(),
    habilitado boolean DEFAULT true,
    crypto varchar,
    observacion varchar,
    usuario_db varchar DEFAULT "session_user"(),
    ip varchar DEFAULT inet_client_addr(),
    id_gestion smallint,
    id_periodo smallint
)
;
--
-- Structure for table alumnos_estados (OID = 88821) : 
--
CREATE TABLE academico.alumnos_estados (
    estado varchar(1) NOT NULL,
    descripcion varchar
)
;
--
-- Structure for table carreras_menciones (OID = 88827) : 
--
CREATE TABLE academico.carreras_menciones (
    id serial NOT NULL,
    id_programa varchar,
    id_plan integer,
    id_mencion integer,
    mencion varchar,
    descripcion varchar,
    tipo_carrera char(1) DEFAULT 'S'::bpchar,
    _nivel_academico varchar
)
;
--
-- Structure for table carreras_tipos (OID = 88835) : 
--
CREATE TABLE academico.carreras_tipos (
    tipo varchar(1) NOT NULL,
    descripcion varchar,
    semanas smallint
)
;
--
-- Structure for table carreras_universidades (OID = 88841) : 
--
CREATE TABLE academico.carreras_universidades (
    id_carrera serial NOT NULL,
    id_universidad integer,
    carrera varchar(80),
    estado varchar(1) DEFAULT 'A'::character varying
)
;
--
-- Structure for table dct_acceso_notas (OID = 88847) : 
--
CREATE TABLE academico.dct_acceso_notas (
    id_gestion smallint,
    id_periodo smallint,
    id_docente integer,
    id_materia integer,
    id_grupo smallint,
    fecha_acceso timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table dct_archivos_subidos (OID = 88851) : 
--
CREATE TABLE academico.dct_archivos_subidos (
    id serial NOT NULL,
    id_dct_asignaciones integer,
    id_docente integer,
    id_materia integer,
    id_grupo integer,
    id_gestion integer,
    id_periodo integer,
    nombre varchar,
    descripcion varchar,
    fecha_registro timestamp without time zone DEFAULT now(),
    id_archivo integer,
    _estado varchar DEFAULT 'A'::character varying NOT NULL
)
;
--
-- Structure for table dct_asignaciones (OID = 88861) : 
--
CREATE TABLE academico.dct_asignaciones (
    id_docente integer DEFAULT 0 NOT NULL,
    id_programa char(3) NOT NULL,
    id_materia integer NOT NULL,
    id_grupo smallint NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    fecha date,
    estado smallint,
    fec_registro timestamp with time zone DEFAULT now(),
    codse varchar(3),
    tipo_calificacion varchar(3) DEFAULT 'N'::character varying,
    finalizar char(1) DEFAULT 'N'::bpchar,
    se_elegido varchar(1) DEFAULT 'N'::character varying NOT NULL,
    cupo_max smallint DEFAULT 0,
    horario char(60),
    id_dct_asignaciones integer DEFAULT nextval(('"seq_id_dct_asignaciones"'::text)::regclass) NOT NULL,
    id_ayudante integer,
    id_horas varchar DEFAULT 'DESCONOCIDO'::character varying,
    tipo_horas varchar[],
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    observacion varchar,
    viaje_practica timestamp without time zone,
    estado_vicerectorado varchar(20),
    tipo_docente varchar,
    id_materia_moodle integer,
    estado_calificado char(1) DEFAULT 'P'::bpchar,
    fecha_designacion timestamp without time zone,
    cant_inc integer DEFAULT 5
)
;
--
-- Structure for table devaluacion (OID = 88875) : 
--
CREATE TABLE academico.devaluacion (
    id serial NOT NULL,
    codse varchar,
    sevaluacion varchar,
    sponderacion smallint,
    _estado varchar(1) DEFAULT 'A'::character varying NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    sevaabre varchar
)
;
--
-- Structure for table docentes (OID = 88886) : 
--
CREATE TABLE academico.docentes (
    id_docente integer NOT NULL,
    nombres varchar(25) NOT NULL,
    paterno varchar(20),
    materno varchar(20),
    clave varchar(50) NOT NULL,
    estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    ci varchar,
    fec_nac date,
    nro_cuenta varchar(64),
    isvalid varchar(64),
    nac_provincia varchar(2),
    direccion varchar,
    telefono varchar(10),
    xxx varchar(6) DEFAULT 'xxx'::bpchar,
    titulo varchar(40),
    cargo varchar(25),
    sexo varchar(1),
    mail varchar(40),
    mailp varchar(25),
    abre_titulo char(32),
    usuario varchar(30),
    foto varchar,
    id_programa char(3),
    password char(32),
    tiempo varchar(3),
    abre_titulo_a char(10),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    primer_logueo bit(1),
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    email varchar,
    id_pais integer,
    id_depto integer,
    id_prov integer,
    id_estado_civil smallint,
    lugar_nacimiento varchar,
    zona varchar,
    telefono_per varchar,
    website varchar,
    fecha_modificacion timestamp without time zone DEFAULT (now())::timestamp without time zone,
    sau char(1) DEFAULT 'N'::bpchar NOT NULL,
    img_firma bytea,
    modalidad varchar DEFAULT ''::character varying NOT NULL,
    designacion bytea,
    hash_docente varchar,
    fotografia varchar,
    cod_loc integer
)
;
--
-- Structure for table docentes_log (OID = 88900) : 
--
CREATE TABLE academico.docentes_log (
    id_docente integer NOT NULL,
    nombres varchar(25) NOT NULL,
    paterno varchar(20),
    materno varchar(20),
    clave varchar(50) NOT NULL,
    estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    ci varchar,
    fec_nac date,
    nro_cuenta varchar(64),
    isvalid varchar(64),
    nac_provincia varchar(2),
    direccion varchar,
    telefono varchar(10),
    xxx varchar(6) DEFAULT 'xxx'::bpchar,
    titulo varchar(40),
    cargo varchar(25),
    sexo varchar(1),
    mail varchar(40),
    mailp varchar(25),
    abre_titulo varchar,
    usuario varchar(30),
    foto varchar,
    id_programa char(3),
    password char(32),
    tiempo varchar(3),
    abre_titulo_a varchar,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    primer_logueo bit(1),
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    email varchar,
    id_pais integer,
    id_depto integer,
    id_prov integer,
    id_estado_civil smallint,
    lugar_nacimiento varchar,
    zona varchar,
    telefono_per varchar,
    website varchar
)
;
--
-- Structure for table docentes_tiempo (OID = 88910) : 
--
CREATE TABLE academico.docentes_tiempo (
    tiempo varchar NOT NULL,
    descripcion varchar,
    horas integer
)
;
--
-- Structure for table evaluacion (OID = 88916) : 
--
CREATE TABLE academico.evaluacion (
    parcial smallint,
    practicas smallint,
    laboratorio smallint,
    ex_final smallint,
    codse varchar(3) NOT NULL,
    _estado varchar(1) DEFAULT 'A'::character varying NOT NULL,
    descripcion varchar
)
;
--
-- Structure for table metodos_paralelas (OID = 88923) : 
--
CREATE TABLE academico.metodos_paralelas (
    id integer NOT NULL,
    funcion varchar(100),
    descripcion text
)
;
--
-- Structure for table notas_planilla (OID = 88929) : 
--
CREATE TABLE academico.notas_planilla (
    id_matricula integer DEFAULT nextval(('"public"."notas_planilla_id_matricula_seq"'::text)::regclass) NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_alumno integer NOT NULL,
    id_materia smallint NOT NULL,
    grupo smallint,
    nota numeric(5,2) DEFAULT 0,
    ult_usuario varchar NOT NULL,
    estado char(1) NOT NULL,
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
    _hash varchar
)
;
--
-- Structure for table planes (OID = 88953) : 
--
CREATE TABLE academico.planes (
    id_plan smallint NOT NULL,
    id_programa char(3) NOT NULL,
    corr0 timestamp with time zone DEFAULT now() NOT NULL,
    id_gestion smallint,
    id_materia_ant smallint NOT NULL,
    id_materia_eqv smallint NOT NULL,
    nivel_academico smallint,
    tipo char(1) NOT NULL,
    ctrlultsem smallint DEFAULT 0,
    id_mencion smallint DEFAULT 0 NOT NULL,
    prog bigint,
    id serial NOT NULL,
    observacion text,
    mencion_old smallint,
    id_materia_ant_array integer[],
    horas_asignable smallint DEFAULT 0
)
;
--
-- Structure for table pln_materias_parametros (OID = 88964) : 
--
CREATE TABLE academico.pln_materias_parametros (
    id serial NOT NULL,
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    metodo_normal integer DEFAULT 0,
    metodo_paralela integer DEFAULT 0,
    metodo_grupo integer DEFAULT 0,
    parametros_normal public.hstore,
    parametros_paralela public.hstore,
    __id_grupo smallint DEFAULT 1,
    __estado char(15) DEFAULT 'Solicitado'::bpchar,
    nro_estudiantes smallint DEFAULT 0
)
;
--
-- Structure for table pln_materias_parametros_borrador (OID = 88971) : 
--
CREATE TABLE academico.pln_materias_parametros_borrador (
    id serial NOT NULL,
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    metodo_normal integer,
    metodo_paralela integer,
    metodo_grupo integer
)
;
--
-- Structure for table sedes (OID = 88984) : 
--
CREATE TABLE academico.sedes (
    id_sede varchar NOT NULL,
    sede varchar
)
;
--
-- Structure for table sist_deva_carrera (OID = 88990) : 
--
CREATE TABLE academico.sist_deva_carrera (
    id serial NOT NULL,
    id_programa char(3) NOT NULL,
    id_devaluacion integer,
    tnombres varchar[],
    _estado varchar(1) DEFAULT 'A'::character varying NOT NULL,
    nroanulacion smallint
)
;
--
-- Structure for table sist_eva_carrera (OID = 88999) : 
--
CREATE TABLE academico.sist_eva_carrera (
    id_programa char(3) NOT NULL,
    codse varchar(3) NOT NULL,
    _estado varchar(1) DEFAULT 'A'::character varying NOT NULL
)
;
--
-- Structure for table tipo_programacion (OID = 89003) : 
--
CREATE TABLE academico.tipo_programacion (
    id_programa varchar(3) NOT NULL,
    tipo char(2),
    siguiente_nivel smallint,
    max_materias smallint,
    paralelas integer DEFAULT 1,
    maximo_materias_verano integer,
    max_mat_arrastre_nivel json,
    minimo_optativas integer,
    nro_max_mat_adelantar integer DEFAULT 1 NOT NULL
)
;
--
-- Structure for table universidades (OID = 89007) : 
--
CREATE TABLE academico.universidades (
    id_universidad serial NOT NULL,
    iniciales varchar(8),
    universidad varchar(50),
    depto varchar(15),
    tipo varchar(1),
    telefono varchar(30),
    fax varchar(30),
    direccion varchar(60),
    estado varchar(1) DEFAULT 'A'::character varying NOT NULL,
    fecha_limite date,
    jefe varchar(50),
    comentarios varchar(1000),
    cargo_encargado varchar(100)
)
;
--
-- Structure for table graduados (OID = 89016) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.graduados (
    id serial NOT NULL,
    id_alumno integer,
    titulo text,
    id_modalidad integer,
    fecha_graduacion date,
    id_gestion smallint,
    nota_graduacion numeric(10,2),
    id_nota_literal integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _id_usuario char(32),
    nro_dip char(32),
    id_programa char(3)
)
;
--
-- Structure for table modalidad_graduacion (OID = 89027) : 
--
CREATE TABLE actas_graduacion.modalidad_graduacion (
    id bigserial NOT NULL,
    titulo_graduacion varchar(255),
    id_gestion smallint,
    id_dar_cert_actas smallint
)
;
--
-- Structure for table notaliteral (OID = 89032) : 
--
CREATE TABLE actas_graduacion.notaliteral (
    id varchar(10) NOT NULL,
    literal char(255),
    rango_min smallint,
    rango_max smallint,
    gestion smallint
)
;
--
-- Structure for table h_acta_recomendaciones (OID = 89037) : 
--
SET search_path = actas_siagra, pg_catalog;
CREATE TABLE actas_siagra.h_acta_recomendaciones (
    cod_acta integer,
    cod_graduacion varchar(30),
    recom text
)
;
--
-- Structure for table h_alm_programas_graduacion (OID = 89043) : 
--
CREATE TABLE actas_siagra.h_alm_programas_graduacion (
    id_programa varchar(3),
    id_modalidad integer,
    id_gestion integer,
    id_periodo integer,
    id_materia integer,
    estado char(1),
    id_nivel integer DEFAULT 1,
    cod_sistema char(1),
    id_usuario integer
)
;
--
-- Structure for table h_asignar_fecha (OID = 89047) : 
--
CREATE TABLE actas_siagra.h_asignar_fecha (
    cod_graduacion varchar(35) NOT NULL,
    titulo_trabajo varchar(550),
    tipo_fecha char(30),
    fecha_grado date,
    fecha_grado2 date,
    hora_gradu time(0) without time zone,
    ambiente integer,
    fecha_registro date,
    fecha_asig date,
    estado char(1),
    hora_final time(0) without time zone,
    id_usuario varchar(15)
)
;
--
-- Structure for table h_asignar_folios (OID = 89053) : 
--
CREATE TABLE actas_siagra.h_asignar_folios (
    nro_folio integer,
    folio integer
)
;
--
-- Structure for table h_asignar_folios_libro (OID = 89056) : 
--
CREATE TABLE actas_siagra.h_asignar_folios_libro (
    nro_folio integer,
    cod_libro char(10),
    tipo char(3),
    estado char(1),
    id_usuario varchar(10),
    cod_acta integer
)
;
--
-- Structure for table h_asignar_libro (OID = 89059) : 
--
CREATE TABLE actas_siagra.h_asignar_libro (
    cod_libro char(10) NOT NULL,
    nombre_libro varchar(100),
    id_facultad integer,
    gestion integer,
    nro_folios integer,
    fecha_apertura date,
    fecha_registro timestamp(0) without time zone,
    id_usuario varchar(15)
)
;
--
-- Structure for table h_asignar_lugar (OID = 89062) : 
--
CREATE TABLE actas_siagra.h_asignar_lugar (
    cod_lugar integer NOT NULL,
    tipo char(1),
    lugar varchar(50)
)
;
--
-- Structure for table h_asignar_moda_carre (OID = 89065) : 
--
CREATE TABLE actas_siagra.h_asignar_moda_carre (
    cod_libro char(10),
    id_programa char(3),
    id_modalidad integer
)
;
--
-- Structure for table h_asignar_tribu (OID = 89068) : 
--
CREATE TABLE actas_siagra.h_asignar_tribu (
    cod_graduacion varchar(35),
    id_docente integer,
    id_rol integer,
    fecha_registro date,
    tipo_doc char(1)
)
;
--
-- Structure for table h_certi_tipo (OID = 89071) : 
--
CREATE TABLE actas_siagra.h_certi_tipo (
    id_tipo_certi integer NOT NULL,
    certificacion varchar(50),
    tipo char(1)
)
;
--
-- Structure for table h_certificar_acta (OID = 89074) : 
--
CREATE TABLE actas_siagra.h_certificar_acta (
    nro_certi integer NOT NULL,
    id_alumno integer,
    cod_acta integer,
    cod_graduacion varchar(30),
    id_modalidad integer,
    nro_sello integer,
    id_tipo_certi char(1),
    fecha_certi date,
    id_gestion integer,
    id_periodo integer,
    estado char(1),
    id_usuario varchar(15)
)
;
--
-- Structure for table h_crear_acta (OID = 89077) : 
--
CREATE TABLE actas_siagra.h_crear_acta (
    cod_acta integer NOT NULL,
    cod_graduacion varchar(35) NOT NULL,
    id_gestion integer,
    id_periodo integer,
    fecha_acta timestamp(0) without time zone,
    hora_acta char(15),
    hora_fin_acta char(15),
    cod_libro char(10),
    nro_acta integer,
    nro_folio varchar(10),
    recom char(1),
    fecha_registro date,
    sistema char(1),
    estado char(1),
    id_usuario varchar(15)
)
;
--
-- Structure for table h_crear_acta_alumno (OID = 89080) : 
--
CREATE TABLE actas_siagra.h_crear_acta_alumno (
    nro_registro integer NOT NULL,
    cod_acta integer,
    id_alumno integer,
    cod_graduacion varchar(35),
    nota1 real,
    nota2 integer,
    nota3 integer,
    nota4 integer,
    nota5 integer,
    nota real,
    observacion char(30),
    estado char(1)
)
;
--
-- Structure for table h_docentes_inv (OID = 89083) : 
--
CREATE TABLE actas_siagra.h_docentes_inv (
    cod_docente integer NOT NULL,
    cod_insti integer,
    titulo varchar(10),
    nro_ci varchar(10),
    nomape varchar(100),
    tipo_insti char(2),
    id_programa char(3),
    estado char(1),
    fecha_registro date,
    id_usuario integer
)
;
--
-- Structure for table h_instituciones (OID = 89086) : 
--
CREATE TABLE actas_siagra.h_instituciones (
    cod_insti integer NOT NULL,
    institucion varchar(250),
    descripcion varchar(200),
    tipo char(3),
    estado char(1),
    id_lugar integer
)
;
--
-- Structure for table h_lugar (OID = 89089) : 
--
CREATE TABLE actas_siagra.h_lugar (
    id_lugar integer NOT NULL,
    estado char(1),
    lugar varchar(50)
)
;
--
-- Structure for table h_modalidad_ebaluacion (OID = 89092) : 
--
CREATE TABLE actas_siagra.h_modalidad_ebaluacion (
    cod_ebaluacion char(3) NOT NULL,
    ebaluacion varchar(50),
    titulo varchar(30),
    estado char(1),
    nro_tribu integer
)
;
--
-- Structure for table h_modalidad_graduacion (OID = 89095) : 
--
CREATE TABLE actas_siagra.h_modalidad_graduacion (
    id_modalidad integer NOT NULL,
    modalidad varchar(55)
)
;
--
-- Structure for table h_rol_tribunal (OID = 89098) : 
--
CREATE TABLE actas_siagra.h_rol_tribunal (
    id_rol_tribunal integer NOT NULL,
    nombre varchar(30),
    tipo char(1)
)
;
--
-- Structure for table h_sistema_acta (OID = 89101) : 
--
CREATE TABLE actas_siagra.h_sistema_acta (
    cod_sistema char(1) NOT NULL,
    sistema varchar(100)
)
;
--
-- Structure for table h_solicitud_gradu_moda (OID = 89104) : 
--
CREATE TABLE actas_siagra.h_solicitud_gradu_moda (
    nro_solicitud integer DEFAULT 0 NOT NULL,
    id_alumno integer DEFAULT 0 NOT NULL,
    id_programa char(3),
    cod_grado integer,
    id_gestion integer,
    id_periodo integer,
    id_modalidad integer,
    cod_graduacion varchar(35),
    cod_tipo char(3),
    grupo integer,
    estado char(1)
)
;
--
-- Structure for table h_solicitud_internado (OID = 89109) : 
--
CREATE TABLE actas_siagra.h_solicitud_internado (
    nro_solicitud integer,
    id_alumno integer,
    cod_area integer,
    cod_insti integer,
    fecha_inicio date,
    fecha_final date,
    estado char(1),
    fecha_registro1 date,
    id_gestion integer,
    id_periodo integer,
    cerrado char(1),
    nota1 integer,
    nota2 integer,
    nota3 integer,
    nota4 integer,
    nota5 integer,
    nota6 integer,
    nota7 integer,
    nota8 integer,
    nota9 integer,
    nota10 integer,
    obs char(15),
    fecha_registro2 date,
    id_usuario1 varchar(30),
    id_usuario2 integer,
    cod_graduacion varchar(30)
)
;
--
-- Structure for table h_solicitud_titulacion (OID = 89112) : 
--
CREATE TABLE actas_siagra.h_solicitud_titulacion (
    nro_solicitud integer NOT NULL,
    id_alumno integer,
    id_modalidad integer,
    id_gestion integer,
    id_periodo integer,
    fecha_solicitud date,
    hora_solicitud time(0) without time zone,
    id_usuario varchar(15),
    fecha_registro timestamp(0) without time zone DEFAULT now()
)
;
--
-- Structure for table h_titulados (OID = 89116) : 
--
CREATE TABLE actas_siagra.h_titulados (
    nro_titulado integer NOT NULL,
    id_ra char(25),
    id_alumno integer,
    nro_dip char(15),
    id_nivel integer,
    id_facultad integer,
    id_programa char(3),
    paterno char(50),
    materno char(50),
    nombres char(60),
    fec_nacimiento date,
    edad integer,
    sexo char(1),
    titulo_trabajo varchar(650),
    id_modalidad integer,
    fecha_grado date,
    gestion integer,
    periodo integer,
    nota char(10),
    observacion char(35),
    ingreso integer,
    permanencia integer,
    estado char(1),
    tipo_persona char(1),
    canti_actas integer,
    cod_grado1 varchar(35),
    cod_grado2 varchar(35),
    id_usuario varchar(15)
)
;
--
-- Structure for table dct_ambientes (OID = 89122) : 
--
SET search_path = ambientes, pg_catalog;
CREATE TABLE ambientes.dct_ambientes (
    id_ambiente_old integer DEFAULT 0 NOT NULL,
    id_campus integer DEFAULT 0 NOT NULL,
    id_bloque_old integer DEFAULT 0 NOT NULL,
    nro_ambiente char(15),
    nro_piso integer DEFAULT (-1),
    img_campus char(60),
    img_bloque char(60),
    img_exterior char(60),
    img_interior char(60),
    capacidad integer DEFAULT (-1),
    tipo_pizarra varchar(32),
    obs varchar(40),
    tipo bigint DEFAULT (1)::bigint,
    id_bloque integer NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT '2014-05-30 16:55:12.501184'::timestamp without time zone NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_ambiente integer DEFAULT nextval('dct_ambientes_id_seq'::regclass) NOT NULL,
    pupitres smallint DEFAULT 0 NOT NULL
)
;
--
-- Structure for table dct_ambientes_carrera (OID = 89135) : 
--
CREATE TABLE ambientes.dct_ambientes_carrera (
    id_dct_ambientes_carrera_old integer DEFAULT nextval(('"seq_id_dct_ambientes_carrera"'::text)::regclass) NOT NULL,
    id_ambiente integer,
    id_programa char(3),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    id_dct_ambientes_carrera integer DEFAULT nextval('dct_ambientes_carrera_id_seq'::regclass) NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_gestion smallint DEFAULT 1969 NOT NULL,
    id_periodo smallint DEFAULT 1 NOT NULL
)
;
--
-- Structure for table dct_bloques (OID = 89147) : 
--
CREATE TABLE ambientes.dct_bloques (
    id_bloque_old integer,
    bloque varchar,
    id_campus integer,
    id_bloque integer DEFAULT nextval('dct_bloques_id_seq'::regclass) NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table dct_campus (OID = 89156) : 
--
CREATE TABLE ambientes.dct_campus (
    id_campus integer NOT NULL,
    campus varchar,
    direccion varchar,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table aux_asignaturas (OID = 89163) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE TABLE auxiliares.aux_asignaturas (
    id_asignatura serial NOT NULL,
    id_materia integer NOT NULL,
    id_gestion integer NOT NULL,
    id_periodo integer NOT NULL,
    nro_grupos smallint,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario varchar(20),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_docente integer,
    fecha_examen timestamp with time zone DEFAULT now(),
    id_materia_eqv integer DEFAULT 0,
    nro_convocatoria smallint DEFAULT 1,
    id_aux_programa integer
)
;
--
-- Structure for table aux_postulantes (OID = 89172) : 
--
CREATE TABLE auxiliares.aux_postulantes (
    id_postulante serial NOT NULL,
    id_alumno integer NOT NULL,
    id_materia integer NOT NULL,
    id_gestion integer NOT NULL,
    id_periodo integer NOT NULL,
    id_grupo smallint NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario char(20),
    _estado varchar(16) DEFAULT 'A'::bpchar NOT NULL,
    _tipo varchar(32) DEFAULT 'POSTULANTE'::character varying NOT NULL,
    _nota numeric(10,2) DEFAULT 0.00 NOT NULL,
    obs varchar DEFAULT ''::character varying NOT NULL,
    id_gestion_ant integer,
    id_periodo_ant integer,
    id_materia_asignado integer,
    materia_asignado varchar,
    obs_asignado varchar,
    nro_convocatoria smallint DEFAULT 1,
    id_aux_programa integer
)
;
--
-- Structure for table aux_programas (OID = 89182) : 
--
CREATE TABLE auxiliares.aux_programas (
    id serial NOT NULL,
    id_programa char(3) NOT NULL,
    cod_categoria_programatica char(16),
    id_gestion smallint NOT NULL,
    id_periodo smallint DEFAULT 1 NOT NULL,
    nro_pos smallint DEFAULT 0 NOT NULL,
    _estado char(1) DEFAULT 'V'::bpchar NOT NULL,
    _correlativo smallint DEFAULT 0 NOT NULL,
    id_materias_egr integer[],
    _periodos_egr smallint DEFAULT 0 NOT NULL,
    _fecha_programacion timestamp without time zone DEFAULT now() NOT NULL,
    _fecha_programacion_fin timestamp(0) without time zone DEFAULT now(),
    nro_dictamen_oferta_materias varchar,
    observaciones varchar,
    nro_items integer,
    _fecha_programacion_ini timestamp(0) without time zone,
    nro_convocatoria smallint DEFAULT 0,
    nro_dictamen_designacion_aux varchar,
    estado_designacion varchar DEFAULT 'PENDIENTE'::character varying,
    usuario varchar DEFAULT ''::character varying,
    id_apoyo integer
)
;
--
-- Structure for table datosparaelbanco (OID = 89195) : 
--
CREATE TABLE auxiliares.datosparaelbanco (
    id serial NOT NULL,
    nro_dip varchar(50),
    id_ra varchar(50),
    id_estado_civil integer,
    nombre_conyugue varchar(200),
    celular_conyugue varchar(200),
    numero_dependientes integer,
    domicilio varchar(200),
    celular varchar(200),
    referencia varchar(300),
    vivienda varchar(200),
    profesion varchar(200),
    nivel_estudio varchar(200),
    cargo varchar(200) DEFAULT 'BECARIO'::character varying,
    fecha_ingreso varchar(200),
    haber_basico varchar(200),
    unidad varchar(200),
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table datosparaelbanco_borrar (OID = 89202) : 
--
CREATE TABLE auxiliares.datosparaelbanco_borrar (
    id serial NOT NULL,
    nro_dip varchar(100),
    haber varchar(100),
    unidad varchar(100)
)
;
--
-- Structure for table bc_agenda (OID = 89209) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.bc_agenda (
    id serial NOT NULL,
    fecha date,
    de time without time zone,
    a time without time zone,
    id_alumno integer,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_puesto smallint,
    turno varchar
)
;
--
-- Structure for table bc_aprobados (OID = 89218) : 
--
CREATE TABLE balimentacion.bc_aprobados (
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    tipo_beca char(1),
    estado char(1),
    fecha date,
    id_usuario varchar(10),
    sit_social real,
    anios real,
    nivel varchar(3),
    obs text,
    sit_acad real,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'R'::bpchar NOT NULL
)
;
--
-- Structure for table bc_comision (OID = 89227) : 
--
CREATE TABLE balimentacion.bc_comision (
    id_gestion smallint,
    id_periodo smallint,
    cargo text,
    fecha date,
    nro_dip varchar(15)
)
;
--
-- Structure for table bc_configuracion (OID = 89233) : 
--
CREATE TABLE balimentacion.bc_configuracion (
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    fecha_inicial date,
    fecha_final date,
    tipo_post varchar(1),
    estado varchar(1)
)
;
--
-- Structure for table bc_descuento_estudiante (OID = 89236) : 
--
CREATE TABLE balimentacion.bc_descuento_estudiante (
    id_alumno integer,
    mes_decuento double precision,
    id_gestion smallint,
    id_periodo smallint,
    monto double precision
)
;
--
-- Structure for table bc_haber_basico_old (OID = 89239) : 
--
CREATE TABLE balimentacion.bc_haber_basico_old (
    id_haber_basico integer,
    tipo_beca char(1),
    haber_basico double precision,
    id_gestion integer,
    id_periodo integer,
    estado char(1),
    descripcion char(40),
    id bigint,
    obs char(20)
)
;
--
-- Structure for table bc_meses_pago (OID = 89244) : 
--
CREATE TABLE balimentacion.bc_meses_pago (
    id serial NOT NULL,
    id_tipo_beca integer,
    id_gestion smallint,
    nro_mes smallint,
    descripcion varchar(64),
    hbasico numeric(8,2),
    tipo_beca varchar(32),
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario varchar(32),
    _dias smallint DEFAULT 30 NOT NULL,
    id_periodo smallint DEFAULT 1 NOT NULL
)
;
--
-- Structure for table bc_pago (OID = 89254) : 
--
CREATE TABLE balimentacion.bc_pago (
    id serial NOT NULL,
    nro_dip char(32),
    id_programa char(3),
    id_alumno integer
)
;
--
-- Structure for table bc_planilla (OID = 89259) : 
--
CREATE TABLE balimentacion.bc_planilla (
    id serial NOT NULL,
    id_alumno integer,
    id_meses_pago integer,
    _dias_trabajados integer,
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario varchar(32),
    _peso numeric(4,2) DEFAULT 0.5 NOT NULL
)
;
--
-- Structure for table bc_planilla_old (OID = 89268) : 
--
CREATE TABLE balimentacion.bc_planilla_old (
    id_planilla integer DEFAULT nextval(('"bc_id_planilla_seq"'::text)::regclass),
    titulo varchar(150),
    id_alumno integer,
    id_haber_basico integer,
    descuento double precision,
    dias_trabajados integer,
    id_gestion integer,
    id_periodo integer,
    fecha date DEFAULT now(),
    id_programa char(3)
)
;
--
-- Structure for table bc_postulantes (OID = 89273) : 
--
CREATE TABLE balimentacion.bc_postulantes (
    id_alumno integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint,
    fecha date DEFAULT now(),
    tipo_post varchar(2) NOT NULL,
    sit_social real DEFAULT 0.00 NOT NULL,
    sit_acad real DEFAULT 0.00 NOT NULL,
    anios real,
    nivel varchar(3),
    obs text,
    familiar varchar(5) DEFAULT 0,
    economico varchar(5) DEFAULT 0,
    procedencia varchar(5) DEFAULT 0,
    fec_revision date,
    vivienda_familiar varchar(5) DEFAULT 0,
    vivienda_estudiante varchar(5) DEFAULT 0,
    revisado char(1),
    estado char(1),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'R'::bpchar NOT NULL,
    _ip_usuario varchar(32),
    _planilla boolean DEFAULT false NOT NULL,
    _isbeca char(1) DEFAULT 'N'::bpchar NOT NULL,
    tipo_beca varchar DEFAULT 'N'::bpchar NOT NULL,
    obs_old text,
    _2008 numeric(4,2) DEFAULT 0,
    _2009 numeric(4,2) DEFAULT 0,
    _2010 numeric(4,2) DEFAULT 0 NOT NULL,
    _2011 numeric(4,2) DEFAULT 0 NOT NULL,
    _2012 numeric(4,2) DEFAULT 0 NOT NULL,
    _2113 numeric(4,2) DEFAULT 0 NOT NULL,
    _2213 numeric(4,2) DEFAULT 0 NOT NULL,
    _2114 numeric(4,2) DEFAULT 0 NOT NULL,
    _2214 numeric(4,2) DEFAULT 0 NOT NULL,
    _anios numeric(10,4) DEFAULT 0 NOT NULL,
    help real,
    help2 real,
    help3 real,
    help4 real,
    help5 real,
    help6 real,
    gestion_calificacion smallint,
    periodo_calificacion smallint,
    gestion_evaluacion smallint,
    periodo_evaluacion smallint,
    fecha_calificacion timestamp(0) without time zone,
    estado_beca char(1) DEFAULT 'A'::bpchar,
    nro_convocatoria smallint DEFAULT 1::smallint,
    id_new_gestion integer DEFAULT 2019,
    invsocial boolean DEFAULT false,
    id serial NOT NULL,
    academico varchar(5),
    n_materias_aprobadas integer,
    id_tipo_beca smallint DEFAULT 0,
    usuario varchar(30),
    cal_sem_ant json,
    calif_historico json,
    id_familiar integer,
    id_economico integer,
    id_procedencia integer,
    id_vivienda_familiar integer,
    sit_total real,
    id_convocatoria integer DEFAULT 1,
    por_social smallint DEFAULT 0,
    por_acad_his smallint DEFAULT 0,
    por_acad_us smallint,
    id_oferta integer,
    tipo_verificado char(8)
)
;
ALTER TABLE ONLY balimentacion.bc_postulantes ALTER COLUMN id_convocatoria SET STATISTICS 100;
--
-- Structure for table bc_postulantes_2007 (OID = 89303) : 
--
CREATE TABLE balimentacion.bc_postulantes_2007 (
    id_alumno integer,
    id_gestion smallint,
    id_periodo smallint,
    fecha date DEFAULT now(),
    tipo_post varchar(2)
)
;
--
-- Structure for table bc_postulantes_2008 (OID = 89307) : 
--
CREATE TABLE balimentacion.bc_postulantes_2008 (
    id_alumno integer,
    id_gestion smallint,
    id_periodo smallint,
    fecha date DEFAULT now(),
    tipo_post varchar(2)
)
;
--
-- Structure for table bc_registro_pago (OID = 89311) : 
--
CREATE TABLE balimentacion.bc_registro_pago (
    cod_planilla varchar(10) NOT NULL,
    mes_incial smallint,
    mes_final smallint,
    id_gestion smallint,
    id_periodo smallint,
    fecha date,
    haber_basico double precision,
    tipo_pago varchar(1)
)
;
--
-- Structure for table bc_situacion_internado (OID = 89314) : 
--
CREATE TABLE balimentacion.bc_situacion_internado (
    id_ra varchar(10),
    id_alumno integer NOT NULL,
    id_gestion integer NOT NULL,
    id_periodo integer NOT NULL,
    sit_social real,
    sit_acad real,
    anios_beneficio smallint,
    nivel smallint,
    kardex char(1),
    alquiler integer,
    pieza smallint,
    direccion_ci varchar(55),
    fecha_ingreso date,
    estado char(1),
    id_usuario varchar(15),
    ci_garante varchar(10),
    garante varchar(40),
    _registrado timestamp without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table bc_suspendidos (OID = 89318) : 
--
CREATE TABLE balimentacion.bc_suspendidos (
    id_alumno integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint,
    tipo_post char(1) NOT NULL,
    id_usuario varchar(10),
    obs text,
    fec_suspencion date,
    id_ra varchar(10),
    cod_informe varchar(11),
    estado char(1)
)
;
ALTER TABLE ONLY balimentacion.bc_suspendidos ALTER COLUMN id_ra SET STATISTICS 0;
--
-- Structure for table borrar (OID = 89324) : 
--
CREATE TABLE balimentacion.borrar (
    id serial NOT NULL,
    a text,
    b text,
    c text,
    d text,
    e smallint DEFAULT 2013 NOT NULL,
    f smallint,
    g varchar
)
;
--
-- Structure for table borrar2 (OID = 89331) : 
--
CREATE TABLE balimentacion.borrar2 (
    a varchar,
    b varchar,
    c varchar,
    d varchar,
    e varchar,
    f varchar,
    g varchar,
    h varchar,
    i varchar,
    j integer DEFAULT 2216 NOT NULL,
    id serial NOT NULL
)
;
--
-- Structure for table dpersonal (OID = 89339) : 
--
CREATE TABLE balimentacion.dpersonal (
    nro_dip char(32),
    btipo char(32)
)
;
--
-- Structure for table o_bc_datos_familia (OID = 89342) : 
--
CREATE TABLE balimentacion.o_bc_datos_familia (
    id serial NOT NULL,
    id_ra varchar(16) NOT NULL,
    dir_fam varchar(60),
    localidad varchar(50),
    zona_fam varchar(50),
    tel_fam varchar(20),
    vivienda_fam varchar(60),
    t_vivienda_fam varchar(11),
    id_gestion smallint,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table o_bc_declaracion (OID = 89350) : 
--
CREATE TABLE balimentacion.o_bc_declaracion (
    id_ra varchar(10) NOT NULL,
    declaracion varchar,
    motivos varchar,
    obs varchar(1000),
    id_gestion integer NOT NULL,
    declaracion_vivienda varchar,
    declaracion_estudios varchar,
    _tipo_post char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_bc_postulante bigint
)
;
--
-- Structure for table o_bc_familia (OID = 89357) : 
--
CREATE TABLE balimentacion.o_bc_familia (
    ci_uatf varchar(15),
    id_ra varchar(16) NOT NULL,
    paterno varchar(20),
    materno varchar(20),
    nombres varchar(65),
    fech_nac date,
    parentesco varchar(15),
    grado_ins varchar(20),
    estado_civil smallint,
    id_gestion smallint NOT NULL,
    ocupacion varchar(60),
    curso varchar(50),
    establecimiento varchar(65),
    aportador bit(1),
    id_n numeric(2,0) NOT NULL,
    salario numeric(5,0),
    avance numeric(3,0),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id serial NOT NULL
)
;
--
-- Structure for table o_bc_gestion (OID = 89365) : 
--
CREATE TABLE balimentacion.o_bc_gestion (
    periodo smallint NOT NULL,
    id_gestion smallint NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table o_bc_ingreso (OID = 89369) : 
--
CREATE TABLE balimentacion.o_bc_ingreso (
    id_ra varchar(10) NOT NULL,
    beca varchar(12) NOT NULL,
    ingreso numeric(5,0) DEFAULT 0 NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint DEFAULT 1,
    revisado bit(1),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'R'::bpchar NOT NULL
)
;
--
-- Structure for table o_bc_persona (OID = 89377) : 
--
CREATE TABLE balimentacion.o_bc_persona (
    id_ra varchar(10) NOT NULL,
    nro_dip varchar(15),
    direccion varchar(60),
    telefono varchar(15),
    tel_per varchar(12),
    zona varchar(50),
    estado_civil smallint,
    email varchar(50),
    apellido_conyuge varchar(30),
    ci_conyuge varchar(15),
    t_vivienda_es varchar(11),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    t_viv_es smallint,
    id_gestion smallint DEFAULT 2015 NOT NULL,
    ubi_latitud numeric(12,9),
    ubi_longitud numeric(12,9)
)
;
--
-- Structure for table o_bc_puntaje_economico (OID = 89384) : 
--
CREATE TABLE balimentacion.o_bc_puntaje_economico (
    id_p_eco integer DEFAULT nextval('o_bc_puntaje_economico_java_id_p_eco_seq'::regclass) NOT NULL,
    rango_1 double precision,
    rango_2 double precision,
    puntaje double precision,
    id_gestion smallint NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_p_eco_old integer,
    usuario varchar,
    id_odiseo_e integer
)
;
--
-- Structure for table o_bc_puntaje_familiar (OID = 89390) : 
--
CREATE TABLE balimentacion.o_bc_puntaje_familiar (
    id_p_fam integer DEFAULT nextval('o_bc_puntaje_familiar_java_id_p_fam_seq'::regclass) NOT NULL,
    descripcion varchar(128),
    puntaje double precision,
    id_gestion smallint DEFAULT date_part('year'::text, now()) NOT NULL,
    id_puntaje_familiar integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _cell varchar DEFAULT '1'::character varying NOT NULL,
    usuario varchar,
    id_odiseo_f integer
)
;
--
-- Structure for table o_bc_puntaje_procedencia (OID = 89401) : 
--
CREATE TABLE balimentacion.o_bc_puntaje_procedencia (
    id_p_pro integer DEFAULT nextval('o_bc_puntaje_procedencia_java_id_p_pro_seq'::regclass) NOT NULL,
    procedencia varchar(128),
    puntaje double precision,
    id_gestion smallint NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_p_pro_old integer,
    usuario varchar,
    id_odiseo_p integer
)
;
--
-- Structure for table o_bc_puntaje_vivienda_estudiante (OID = 89407) : 
--
CREATE TABLE balimentacion.o_bc_puntaje_vivienda_estudiante (
    id_p_viv_e integer DEFAULT nextval('o_bc_puntaje_vivienda_estudiante_java_id_p_viv_e_seq'::regclass) NOT NULL,
    descripcion varchar(64),
    puntaje double precision,
    id_gestion smallint NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_p_viv_e_old integer,
    _abre varchar(16),
    descrip2 varchar(64),
    usuario varchar
)
;
--
-- Structure for table o_bc_puntaje_vivienda_familiar (OID = 89413) : 
--
CREATE TABLE balimentacion.o_bc_puntaje_vivienda_familiar (
    id_p_viv_f integer DEFAULT nextval('o_bc_puntaje_vivienda_familiar_java_id_p_viv_f_seq'::regclass) NOT NULL,
    descripcion varchar(64),
    puntaje double precision,
    id_gestion smallint NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_p_viv_f_old integer,
    _abre varchar(16),
    descrip2 varchar(64),
    usuario varchar,
    id_odiseo_v_f integer
)
;
--
-- Structure for table o_bc_revisado (OID = 89419) : 
--
CREATE TABLE balimentacion.o_bc_revisado (
    id_ra varchar(16) NOT NULL,
    id_usuario varchar(10) NOT NULL,
    fech_rev date DEFAULT now(),
    beca char(1) NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL
)
;
--
-- Structure for table bg_programas (OID = 89423) : 
--
SET search_path = bgraduacion, pg_catalog;
CREATE TABLE bgraduacion.bg_programas (
    id integer DEFAULT nextval('bg_items_becas_id_seq'::regclass) NOT NULL,
    id_programa char(3) NOT NULL,
    descripcion varchar(64),
    nro_items smallint,
    id_gestion smallint NOT NULL,
    id_periodo integer,
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario varchar(32),
    fecha_ini timestamp(0) without time zone,
    fecha_fin timestamp(0) without time zone
)
;
--
-- Structure for table bg_meses_pago (OID = 89431) : 
--
CREATE TABLE bgraduacion.bg_meses_pago (
    id serial NOT NULL,
    id_tipo_beca integer,
    nro_mes smallint,
    descripcion varchar(64),
    hbasico numeric(8,2),
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario varchar(32)
)
;
--
-- Structure for table bg_postulantes (OID = 89439) : 
--
CREATE TABLE bgraduacion.bg_postulantes (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion smallint,
    id_periodo smallint,
    obs varchar(64),
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario varchar(32),
    id_bg_programas integer,
    _nota integer DEFAULT 0,
    nota numeric DEFAULT 0,
    fecha_designacion date
)
;
--
-- Structure for table tmp (OID = 89447) : 
--
CREATE TABLE bgraduacion.tmp (
    a text,
    b text,
    c text,
    d text,
    e text,
    f text,
    g integer
)
;
--
-- Structure for table accesos (OID = 89453) : 
--
SET search_path = biblioteca, pg_catalog;
CREATE TABLE biblioteca.accesos (
    id_acceso integer DEFAULT nextval(('"biblioteca"."accesos_id_acceso_seq"'::text)::regclass) NOT NULL,
    id_usuario integer,
    fecha_ingreso timestamp with time zone,
    fecha_salida timestamp with time zone,
    modulo char(28)
)
;
--
-- Structure for table editorial (OID = 89459) : 
--
CREATE TABLE biblioteca.editorial (
    id_editorial serial NOT NULL,
    nombre_editorial varchar(350)
)
;
--
-- Structure for table lector (OID = 89464) : 
--
CREATE TABLE biblioteca.lector (
    id_lector integer DEFAULT nextval(('biblioteca.lector_id_lector_seq'::text)::regclass) NOT NULL,
    ci_lector varchar(20),
    id_gestion integer,
    garantia_lm integer,
    garantia_da integer,
    garantia_db integer,
    fecha_exp timestamp(0) with time zone,
    fecha_ven timestamp(0) with time zone,
    estado char(1),
    lector_lupdate timestamp(0) without time zone
)
;
--
-- Structure for table libro (OID = 89470) : 
--
CREATE TABLE biblioteca.libro (
    "Id_libro" integer DEFAULT nextval('llibro_id_libro_seq'::regclass) NOT NULL,
    registro varchar(20),
    signatura varchar(20),
    topografia varchar(20),
    id_unidad smallint,
    titulo varchar(300),
    autor varchar(300),
    id_editorial integer,
    id_lugar_edicion integer,
    anio_edicion integer,
    num_paginas integer,
    observaciones varchar(500),
    resumen varchar(500),
    id_ubicacion integer,
    prestado bit(1)
)
;
--
-- Structure for table libro_antes (OID = 89476) : 
--
CREATE TABLE biblioteca.libro_antes (
    registro_actual double precision,
    registro varchar(255),
    signatura varchar(255),
    fecha_ingreso timestamp with time zone,
    titulo varchar(255),
    autor varchar(255),
    topografica varchar(255),
    editorial varchar(255),
    isbn varchar(255),
    issn varchar(255),
    lugar_edicion varchar(255),
    anio_edicion double precision,
    num_edicion varchar(6),
    materia varchar(255),
    carrera varchar(255),
    tipo varchar(255),
    num_paginas varchar(255),
    copia varchar(4),
    tomo double precision,
    formato varchar(255),
    encuadernacion varchar(255),
    procedencia varchar(255),
    precio double precision,
    idioma varchar(255),
    cantidad double precision,
    incluye varchar(255),
    contenido text,
    observaciones varchar(255),
    biblio varchar(255),
    inventariado_por varchar(255),
    unidad varchar(255),
    prestado_devuelto char(1),
    subtitulo varchar(255),
    autor_secundario varchar(255),
    notas varchar(255)
)
;
--
-- Structure for table libro_original (OID = 89482) : 
--
CREATE TABLE biblioteca.libro_original (
    registro_actual double precision,
    registro varchar(255),
    signatura varchar(255),
    fecha_ingreso timestamp with time zone,
    titulo varchar(255),
    autor varchar(255),
    topografica varchar(255),
    editorial varchar(255),
    isbn varchar(255),
    issn varchar(255),
    lugar_edicion varchar(255),
    anio_edicion double precision,
    num_edicion varchar(6),
    materia varchar(255),
    carrera varchar(255),
    tipo varchar(255),
    num_paginas varchar(255),
    copia varchar(4),
    tomo double precision,
    formato varchar(255),
    encuadernacion varchar(255),
    procedencia varchar(255),
    precio double precision,
    idioma varchar(255),
    cantidad double precision,
    incluye varchar(255),
    contenido varchar(255),
    observaciones varchar(255),
    biblio varchar(255),
    inventariado_por varchar(255),
    unidad varchar(255),
    prestado_devuelto char(1),
    subtitulo varchar(255),
    autor_secundario varchar(255),
    notas varchar(255)
)
;
--
-- Structure for table lugar_edicion (OID = 89490) : 
--
CREATE TABLE biblioteca.lugar_edicion (
    id_lugar serial NOT NULL,
    lugar_nombre varchar(100),
    lugar_nombre_completo varchar(100)
)
;
--
-- Structure for table modulos (OID = 89495) : 
--
CREATE TABLE biblioteca.modulos (
    id_usuario varchar(10),
    modulo1 integer,
    modulo2 integer,
    modulo3 integer,
    modulo4 integer,
    modulo5 integer,
    modulo6 integer,
    modulo7 integer,
    modulo8 integer,
    estado char(1),
    fecha_inicio timestamp with time zone,
    fecha_fin timestamp with time zone,
    modulo9 integer
)
;
--
-- Structure for table prestamo_devolucion (OID = 89498) : 
--
CREATE TABLE biblioteca.prestamo_devolucion (
    id_prestamo integer DEFAULT nextval(('biblioteca.prestamo_devolucion_id_prestamo_seq'::text)::regclass) NOT NULL,
    id_lector integer NOT NULL,
    id_libro integer,
    id_usuario_prestamo integer,
    fecha_prestamo timestamp with time zone,
    fecha_devolucion_sistema timestamp with time zone,
    estado char(1),
    observacion text,
    tipo_prestamo char(1),
    cl char(1),
    ci char(1),
    cu char(1),
    fecha_devolucion_estudiante timestamp with time zone,
    observacion_devolucion text,
    id_usuario_devolucion integer
)
;
--
-- Structure for table reservas (OID = 89507) : 
--
CREATE TABLE biblioteca.reservas (
    id_reserva integer DEFAULT nextval(('biblioteca.reservas_id_reserva_seq'::text)::regclass) NOT NULL,
    reg_actual double precision,
    signatura varchar(25),
    topografica varchar(25),
    id_lector integer NOT NULL,
    fecha_reserva timestamp without time zone,
    estado char(1),
    fecha_prestamo timestamp(0) with time zone
)
;
--
-- Structure for table sancionados (OID = 89513) : 
--
CREATE TABLE biblioteca.sancionados (
    id_sancion integer DEFAULT nextval(('biblioteca.sancionados_id_sancion_seq'::text)::regclass) NOT NULL,
    id_lector integer,
    de_fecha timestamp with time zone,
    a_fecha timestamp with time zone,
    descripcion_sancion text,
    id_usuario integer,
    estado char(1)
)
;
--
-- Structure for table beca_investigador (OID = 89524) : 
--
SET search_path = binvestigacion, pg_catalog;
CREATE TABLE binvestigacion.beca_investigador (
    id serial NOT NULL,
    id_ra varchar(50),
    id_programa varchar(3),
    id_gestion integer,
    id_periodo integer,
    titulotema text,
    resumentema text,
    ubicacionpdf varchar(300),
    _estado varchar(50),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    nro_convocatoria integer,
    nota numeric DEFAULT 0,
    id_alumno integer,
    id_oferta integer,
    fecha_designacion date
)
;
--
-- Structure for table becas_por_carrera (OID = 89534) : 
--
CREATE TABLE binvestigacion.becas_por_carrera (
    id serial NOT NULL,
    id_programa varchar(3),
    id_gestion integer,
    id_periodo integer,
    cantidad integer,
    usuario varchar DEFAULT ''::character varying,
    estado varchar DEFAULT 'PENDIENTE'::character varying,
    fec_cre timestamp without time zone DEFAULT now(),
    fec_designacion timestamp without time zone,
    nro_dictamen varchar DEFAULT ''::character varying,
    id_convocatoria integer DEFAULT 1
)
;
--
-- Structure for table cronograma (OID = 89539) : 
--
CREATE TABLE binvestigacion.cronograma (
    id serial NOT NULL,
    id_beca_investigador integer,
    id_ra varchar(10),
    inicio date,
    fin date,
    descripcion text
)
;
--
-- Structure for table beca_trabajo (OID = 89547) : 
--
SET search_path = btrabajo, pg_catalog;
CREATE TABLE btrabajo.beca_trabajo (
    id serial NOT NULL,
    id_ra varchar(50),
    id_programa varchar(3),
    id_gestion integer,
    id_periodo integer,
    id_becasprograma integer,
    _estado varchar(50),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    id_alumno integer,
    obs varchar,
    estado varchar(30) DEFAULT 'REGISTRADO'::character varying,
    nota numeric DEFAULT 0,
    fecha_designacion date
)
;
--
-- Structure for table becasprograma (OID = 89554) : 
--
CREATE TABLE btrabajo.becasprograma (
    id serial NOT NULL,
    id_programa varchar(3),
    id_gestion integer,
    id_periodo integer,
    cantidad integer,
    descripcion varchar(150),
    nivel_minimo integer,
    fecha_ini timestamp(0) without time zone,
    fecha_fin timestamp(0) without time zone,
    convocatoria varchar,
    estado varchar(15)
)
;
--
-- Structure for table requisitos (OID = 89559) : 
--
CREATE TABLE btrabajo.requisitos (
    id serial NOT NULL,
    id_becasprograma integer,
    id_materia integer
)
;
--
-- Structure for table alumnos_materias (OID = 89564) : 
--
SET search_path = consola, pg_catalog;
CREATE TABLE consola.alumnos_materias (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    tipo_alumno varchar(10),
    tienep bit(1),
    generacion integer DEFAULT 1
)
;
--
-- Structure for table alumnos_materias_lista (OID = 89570) : 
--
CREATE TABLE consola.alumnos_materias_lista (
    id serial NOT NULL,
    id_alumnos_materias integer,
    id_materia integer,
    tipo varchar(20)
)
;
--
-- Structure for table docente_login (OID = 89575) : 
--
CREATE TABLE consola.docente_login (
    id serial NOT NULL,
    id_docente integer,
    usuario_docente varchar(100),
    fecha timestamp without time zone DEFAULT now(),
    ip varchar(50),
    estado varchar(20)
)
;
--
-- Structure for table estudiante_login (OID = 89581) : 
--
CREATE TABLE consola.estudiante_login (
    id serial NOT NULL,
    id_alumno integer,
    fecha timestamp without time zone DEFAULT now(),
    ip varchar(50),
    navegador text
)
;
--
-- Structure for table convenios (OID = 89590) : 
--
SET search_path = convocatorias, pg_catalog;
CREATE TABLE convocatorias.convenios (
    id serial NOT NULL,
    unidad varchar,
    contraparte varchar,
    objeto text,
    duracion varchar,
    id_db_archivo integer,
    fecha_registro timestamp without time zone DEFAULT now(),
    titulo varchar,
    numeracion varchar,
    tipo_convenio varchar
)
;
--
-- Structure for table convocatoria (OID = 89599) : 
--
CREATE TABLE convocatorias.convocatoria (
    id serial NOT NULL,
    titulo text,
    resumen text,
    fecha_publicacion date,
    fecha_entrega date,
    link text,
    tipo varchar(50),
    tipo_link varchar(16)
)
;
--
-- Structure for table convocatoriasicoes (OID = 89607) : 
--
CREATE TABLE convocatorias.convocatoriasicoes (
    id serial NOT NULL,
    cuce varchar(200),
    entidad varchar(200),
    modalidad varchar(200),
    nro_contr varchar(200),
    nro_conv varchar(200),
    objeto varchar(250),
    estado varchar(200),
    fecha_publicacion date,
    fecha_presentacion date,
    archivos text,
    formularios text
)
;
--
-- Structure for table categoria (OID = 89615) : 
--
SET search_path = curriculum, pg_catalog;
CREATE TABLE curriculum.categoria (
    id serial NOT NULL,
    descripcion varchar(300),
    id_sis integer DEFAULT 1 NOT NULL,
    max_rows integer DEFAULT 2 NOT NULL
)
;
--
-- Structure for table columna (OID = 89620) : 
--
CREATE TABLE curriculum.columna (
    id serial NOT NULL,
    posicion integer,
    descripcion varchar(300),
    tipo varchar(50),
    validador varchar(200),
    id_categoria integer,
    placeholder varchar,
    sizecell integer
)
;
--
-- Structure for table valores (OID = 89628) : 
--
CREATE TABLE curriculum.valores (
    id serial NOT NULL,
    id_columna integer,
    id_ra varchar(10),
    fila integer,
    valor text
)
;
--
-- Structure for table borrar (OID = 89636) : 
--
SET search_path = dep_titulos, pg_catalog;
CREATE TABLE dep_titulos.borrar (
    a text,
    b text,
    c text,
    d date,
    e date,
    f integer,
    g integer,
    h integer,
    i text,
    j integer,
    id_alumno integer,
    id_gestion smallint DEFAULT 2315,
    id serial NOT NULL,
    nro integer,
    ci varchar(40),
    k text,
    l text,
    m text,
    x text,
    o text
)
;
--
-- Structure for table clasiftra (OID = 89645) : 
--
CREATE TABLE dep_titulos.clasiftra (
    id serial NOT NULL,
    clasificasion char(32) NOT NULL,
    id_gestion smallint NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table tit_tramite (OID = 89651) : 
--
CREATE TABLE dep_titulos.tit_tramite (
    id serial NOT NULL,
    id_clasiftra integer,
    id_alumno integer,
    id_ra char(32),
    id_programa char(3),
    nro_doc integer,
    nro_foja integer,
    nro_libro integer,
    fec_emision date,
    nro_dip integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _id_usuario char(32),
    _id_nivel integer
)
;
--
-- Structure for table diu_impresion (OID = 89659) : 
--
SET search_path = diu, pg_catalog;
CREATE TABLE diu.diu_impresion (
    id serial NOT NULL,
    id_solicitud integer,
    fecha_impre date DEFAULT now() NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _id_usuario char(32),
    _qr char(32) DEFAULT ''::bpchar NOT NULL
)
;
--
-- Structure for table diu_solicitud (OID = 89669) : 
--
CREATE TABLE diu.diu_solicitud (
    id_solicitud integer DEFAULT nextval('diu_solicitud_id_seq'::regclass) NOT NULL,
    id_tipo_solicitud integer,
    fecha_solicitud date DEFAULT (now())::date,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado varchar(32) DEFAULT 'SOLICITADO'::bpchar NOT NULL,
    _id_usuario char(32),
    id_alumno integer,
    id_solicitud_padre integer DEFAULT 0 NOT NULL
)
;
--
-- Structure for table diu_tipo_solicitud (OID = 89679) : 
--
CREATE TABLE diu.diu_tipo_solicitud (
    id_tipo_solicitud integer DEFAULT nextval('diu_tipo_solicitud_id_seq'::regclass) NOT NULL,
    cod_solicitud char(64),
    descripcion char(255),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _candidatos (OID = 89685) : 
--
SET search_path = elecciones, pg_catalog;
CREATE TABLE elecciones._candidatos (
    id_candidato serial NOT NULL,
    acronimo varchar(32),
    nombres varchar(64),
    peso varchar(1),
    nro_vuelta smallint,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    _iscount boolean DEFAULT true NOT NULL,
    _isperson boolean,
    id_tipo_eleccion integer
)
;
--
-- Structure for table _elcciones_votos_rector (OID = 89692) : 
--
CREATE TABLE elecciones._elcciones_votos_rector (
    num_mesa integer NOT NULL,
    validos integer,
    blancos integer,
    nulos integer
)
;
--
-- Structure for table _elecciones (OID = 89695) : 
--
CREATE TABLE elecciones._elecciones (
    id integer NOT NULL,
    descripcion varchar(200),
    fecha timestamp(0) without time zone,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table _elecciones_designacion (OID = 89698) : 
--
CREATE TABLE elecciones._elecciones_designacion (
    id_designacion serial NOT NULL,
    num_mesa integer,
    apellidos_nombre varchar(250),
    cargo varchar(250)
)
;
--
-- Structure for table _elecciones_old (OID = 89708) : 
--
CREATE TABLE elecciones._elecciones_old (
    id_frente integer DEFAULT nextval(('elecciones._elecciones_id_frente_seq'::text)::regclass) NOT NULL,
    nom_frente varchar(50),
    color varchar(7),
    sigla varchar(10),
    candidato_rector char(1),
    candidato_vicerrector char(1)
)
;
--
-- Structure for table _elecciones_votantes (OID = 89712) : 
--
CREATE TABLE elecciones._elecciones_votantes (
    secuencia integer NOT NULL,
    id_ra varchar(10),
    ci varchar,
    nom_apellidos varchar(150),
    carrera varchar(150),
    facultad varchar(150),
    num_mesa integer,
    localizacion varchar(200)
)
;
--
-- Structure for table _elecciones_votos (OID = 89718) : 
--
CREATE TABLE elecciones._elecciones_votos (
    id_votos integer DEFAULT nextval(('elecciones._elecciones_votos_id_votos_seq'::text)::regclass) NOT NULL,
    id_frente integer NOT NULL,
    num_mesa varchar(3),
    votos integer NOT NULL
)
;
--
-- Structure for table _elecciones_votos_vice (OID = 89724) : 
--
CREATE TABLE elecciones._elecciones_votos_vice (
    num_mesa integer NOT NULL,
    validos_f1 integer,
    validos_f2 integer,
    blancos integer,
    nulos integer
)
;
--
-- Structure for table _elecciones_votos_vice_pri (OID = 89727) : 
--
CREATE TABLE elecciones._elecciones_votos_vice_pri (
    num_mesa integer NOT NULL,
    validos_f1 integer,
    validos_f2 integer,
    validos_f3 integer,
    validos_f4 integer,
    validos_f5 integer,
    blancos integer,
    nulos integer
)
;
--
-- Structure for table _elecciones_votos_vice_sv (OID = 89730) : 
--
CREATE TABLE elecciones._elecciones_votos_vice_sv (
    num_mesa integer NOT NULL,
    validos integer,
    blancos integer,
    nulos integer
)
;
--
-- Structure for table _mesas (OID = 89733) : 
--
CREATE TABLE elecciones._mesas (
    id integer DEFAULT nextval(('elecciones._mesas_id_mesa_seq'::text)::regclass) NOT NULL,
    nro_mesa varchar(16),
    ambiente varchar,
    cargo varchar(16),
    sede varchar(16),
    cantidad integer,
    _estado varchar(16),
    id_tipo_eleccion integer,
    id_mesa integer,
    id_tipo_elector char(1) DEFAULT 'E'::bpchar NOT NULL
)
;
--
-- Structure for table _posible_jurado (OID = 89739) : 
--
CREATE TABLE elecciones._posible_jurado (
    grupo integer,
    ci varchar(10),
    nombre_apellido varchar(255),
    cargo varchar(255),
    valor_cargo integer,
    antiguedad integer,
    sede varchar(1),
    designado varchar(1),
    num_mesa integer,
    cargo_mesa varchar(50),
    hubicacion varchar(100),
    id_eleccion integer,
    id serial NOT NULL,
    unidad varchar(128) DEFAULT ''::character varying NOT NULL,
    unidad2 varchar(100)
)
;
--
-- Structure for table antiguedadesborrador (OID = 89754) : 
--
CREATE TABLE elecciones.antiguedadesborrador (
    id serial NOT NULL,
    nro_dip varchar(20),
    antiguedad integer
)
;
--
-- Structure for table auxiliaresborrador (OID = 89759) : 
--
CREATE TABLE elecciones.auxiliaresborrador (
    id serial NOT NULL,
    nro_dip varchar(20),
    paterno varchar(200),
    materno varchar(200),
    nombres varchar(200),
    unidad varchar(200)
)
;
--
-- Structure for table auxiliaresborrador2 (OID = 89765) : 
--
CREATE TABLE elecciones.auxiliaresborrador2 (
    id serial NOT NULL,
    unidad varchar(100),
    nro_dip varchar(50),
    paterno varchar(50),
    materno varchar(50),
    nombres varchar(50),
    cargo varchar(50)
)
;
--
-- Structure for table cargos (OID = 89772) : 
--
CREATE TABLE elecciones.cargos (
    id serial NOT NULL,
    cargo varchar(50),
    valor integer
)
;
--
-- Structure for table est_central (OID = 89777) : 
--
CREATE TABLE elecciones.est_central (
    id_ra varchar(10),
    nro_dip varchar(15),
    apellidos_nombres text,
    id_alumno integer,
    id_programa bpchar,
    programa varchar(50),
    facultad varchar(100),
    sede varchar(1),
    matricula text,
    mesa text
)
;
--
-- Structure for table juradosborrador (OID = 89783) : 
--
CREATE TABLE elecciones.juradosborrador (
    id serial NOT NULL,
    nro_dip varchar(20),
    nombre_completo varchar(200),
    cargo varchar(100),
    unidad varchar(200),
    celular varchar(50),
    antiguedad integer
)
;
--
-- Structure for table juradosborrador2 (OID = 89789) : 
--
CREATE TABLE elecciones.juradosborrador2 (
    id serial NOT NULL,
    nro_dip varchar(50),
    nombre_completo varchar(100),
    cargo varchar(50),
    sede char(1),
    unidad varchar(100)
)
;
--
-- Structure for table mesas (OID = 89796) : 
--
CREATE TABLE elecciones.mesas (
    nro_mesa varchar(4) NOT NULL,
    sede varchar(20),
    cant_estudiantes integer,
    nro_de_registros varchar(20),
    apellidos_inicial varchar(80),
    apellidos_final varchar(80),
    ambiente varchar(80),
    tipo varchar(20)
)
;
--
-- Structure for table votantes (OID = 89801) : 
--
CREATE TABLE elecciones.votantes (
    id integer DEFAULT nextval('votantes_id_seq1'::regclass) NOT NULL,
    orden integer,
    id_ra varchar(10) NOT NULL,
    nro_dip varchar(15) NOT NULL,
    nombre_completo varchar(200),
    id_programa1 varchar(3),
    id_alumno1 integer,
    estado1 char(1),
    sede1 char(1),
    id_programa2 varchar(3),
    id_alumno2 integer,
    estado2 char(1),
    sede2 char(1),
    nro_mesa integer,
    id_eleccion integer,
    habilitado boolean
)
;
--
-- Structure for table votantes_17 (OID = 89804) : 
--
CREATE TABLE elecciones.votantes_17 (
    id integer DEFAULT nextval('votantes_id_seq'::regclass) NOT NULL,
    orden integer,
    id_ra varchar(10) NOT NULL,
    nro_dip varchar(15) NOT NULL,
    nombre_completo varchar(200),
    id_programa1 varchar(3),
    id_alumno1 integer,
    estado1 char(1),
    sede1 char(1),
    id_programa2 varchar(3),
    id_alumno2 integer,
    estado2 char(1),
    sede2 char(1),
    nro_mesa integer,
    id_eleccion integer,
    habilitado boolean
)
;
--
-- Structure for table votantesdocentes (OID = 89811) : 
--
CREATE TABLE elecciones.votantesdocentes (
    nro_dip varchar(50) NOT NULL,
    id_eleccion integer
)
;
--
-- Structure for table votantesmesas (OID = 89814) : 
--
CREATE TABLE elecciones.votantesmesas (
    id serial NOT NULL,
    nro_mesa integer,
    sede varchar(10),
    ambiente varchar(100),
    tipo varchar(50),
    sede_sigla varchar(1),
    id_eleccion integer DEFAULT 3 NOT NULL,
    _cantidad integer DEFAULT 0 NOT NULL,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL
)
;
--
-- Structure for table _diciplinas (OID = 89822) : 
--
SET search_path = extension, pg_catalog;
CREATE TABLE extension._diciplinas (
    id serial NOT NULL,
    diciplina varchar,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario smallint,
    _estado varchar DEFAULT 'A'::character varying NOT NULL
)
;
--
-- Structure for table _participantes (OID = 89833) : 
--
CREATE TABLE extension._participantes (
    id serial NOT NULL,
    id_alumno integer,
    id_diciplina integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado varchar DEFAULT 'A'::character varying NOT NULL,
    obs varchar
)
;
--
-- Structure for table _links (OID = 89844) : 
--
SET search_path = frida, pg_catalog;
CREATE TABLE frida._links (
    corr0 integer NOT NULL,
    orden char(3),
    nombre_link varchar(50),
    link varchar(100),
    tipo char(1),
    categoria varchar(15)
)
;
--
-- Structure for table _menus (OID = 89847) : 
--
CREATE TABLE frida._menus (
    corr0 integer NOT NULL,
    id_rol varchar(10) NOT NULL,
    id_modulo integer NOT NULL
)
;
--
-- Structure for table _menus_new (OID = 89850) : 
--
CREATE TABLE frida._menus_new (
    corr0 integer NOT NULL,
    id_rol varchar(10) NOT NULL,
    id_modulo integer NOT NULL
)
;
--
-- Structure for table _roles (OID = 89853) : 
--
CREATE TABLE frida._roles (
    id_rol char(4) NOT NULL,
    rol varchar(25),
    descripcion varchar(50)
)
;
--
-- Structure for table _tableros (OID = 89856) : 
--
CREATE TABLE frida._tableros (
    corr0 integer DEFAULT nextval(('"_tableros_corr0_seq"'::text)::regclass) NOT NULL,
    envia varchar(10),
    rol varchar(5),
    detalle varchar(25),
    cuerpo text,
    id_tipo_tablero char(1),
    id_tipo_aviso char(1),
    fecha date DEFAULT now(),
    estado char(1) DEFAULT 'S'::bpchar
)
;
--
-- Structure for table _usuarios (OID = 89865) : 
--
CREATE TABLE frida._usuarios (
    id serial NOT NULL,
    id_usuario varchar(15) NOT NULL,
    nombre varchar(45) NOT NULL,
    email varchar(35),
    recordatorio varchar(35),
    id_grupo varchar(10) NOT NULL,
    id_rol varchar(10),
    id_facultad smallint,
    id_sede smallint,
    inicial char(6),
    bibliotecas varchar(1),
    estado char(1) DEFAULT 'A'::bpchar,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario char(32),
    clave char(32),
    controlar_ip char(1) DEFAULT 'N'::bpchar NOT NULL,
    _ci varchar(16),
    _fec_nacimiento date,
    _pocupacion varchar(32),
    _direccion varchar(64)
)
;
--
-- Structure for table permisos (OID = 89875) : 
--
CREATE TABLE frida.permisos (
    id_menu integer NOT NULL,
    padre varchar,
    hijo varchar,
    detalle varchar,
    enlace varchar,
    icono varchar DEFAULT 'x'::character varying,
    tip_sis char(1),
    tip_menu char(1)
)
;
--
-- Structure for table seguro2014_borrar (OID = 89882) : 
--
SET search_path = herramientas, pg_catalog;
CREATE TABLE herramientas.seguro2014_borrar (
    id serial NOT NULL,
    id_ra varchar(50),
    id_alumno integer,
    nro_dip varchar(50),
    paterno varchar(100),
    materno varchar(100),
    nombres varchar(100),
    fecha_nacimiento date,
    id_carrera varchar(100),
    carrera varchar(100)
)
;
--
-- Structure for table alumnos_via (OID = 89890) : 
--
SET search_path = infraestructura, pg_catalog;
CREATE TABLE infraestructura.alumnos_via (
    id_a serial NOT NULL,
    id_alumno integer,
    id integer,
    estado varchar
)
;
--
-- Structure for table asig_auto_chofer (OID = 89898) : 
--
CREATE TABLE infraestructura.asig_auto_chofer (
    id_asig_ac serial NOT NULL,
    placa varchar(20),
    ci varchar(20),
    fecha_asig timestamp without time zone,
    estado char(1)
)
;
--
-- Structure for table asig_viaje_auto (OID = 89903) : 
--
CREATE TABLE infraestructura.asig_viaje_auto (
    id_asig_va serial NOT NULL,
    id_viaje integer,
    id_movil integer,
    id_gestion integer,
    id_periodo integer,
    asig_fecha time without time zone
)
;
--
-- Structure for table chofer (OID = 89908) : 
--
CREATE TABLE infraestructura.chofer (
    id_chofer serial NOT NULL,
    ci varchar(20),
    nombre varchar(50),
    app varchar(30),
    apm varchar(30),
    telf integer,
    cel integer,
    dir varchar(30)
)
;
--
-- Structure for table cronograma (OID = 89913) : 
--
CREATE TABLE infraestructura.cronograma (
    id_c serial NOT NULL,
    cronograma varchar(300),
    id integer,
    dia integer
)
;
--
-- Structure for table movilidad (OID = 89918) : 
--
CREATE TABLE infraestructura.movilidad (
    id_movil serial NOT NULL,
    placa varchar(20),
    marca varchar(50),
    tipo varchar(50),
    color varchar(20),
    descrip varchar(30),
    rendimiento integer,
    estado varchar(30),
    capacidad integer
)
;
--
-- Structure for table pasajero_extra (OID = 89923) : 
--
CREATE TABLE infraestructura.pasajero_extra (
    id_extra serial NOT NULL,
    id_viaje integer,
    nombre varchar(150),
    tipo varchar(1)
)
;
--
-- Structure for table salida_vehiculos (OID = 89928) : 
--
CREATE TABLE infraestructura.salida_vehiculos (
    id_salida serial NOT NULL,
    placa varchar(20),
    lugar varchar(20),
    motivo varchar(200),
    ci varchar(20),
    responsable varchar(50),
    hr_salida varchar(10),
    hr_retorno varchar(10),
    kilometraje integer,
    fecha_salida timestamp without time zone
)
;
--
-- Structure for table viajes (OID = 89933) : 
--
CREATE TABLE infraestructura.viajes (
    id_viaje integer DEFAULT nextval('viajes_id_seq'::regclass) NOT NULL,
    id_dct_asignaciones integer,
    lugar_prac varchar(130),
    obj_prac varchar(300),
    fecha_ini date,
    fecha_fin date,
    fecha_r_ini date,
    fecha_r_fin date,
    pasajeros smallint,
    pasajeros_r smallint,
    observaciones varchar(250),
    fecha_control_dir timestamp with time zone,
    aprobado_dir char(1),
    distancia integer,
    ciudad integer,
    provincia integer,
    frontera integer,
    fecha_control_doc timestamp without time zone,
    empresa char(1),
    crono char(1),
    horap varchar(15),
    horar varchar(15),
    obj_esp varchar(300),
    aprobado_dsa char(1),
    apro_infra char(1),
    fecha_dsa timestamp without time zone,
    obs_dsa varchar(250)
)
;
--
-- Structure for table caracteristicas (OID = 89941) : 
--
SET search_path = laptopsdocentes, pg_catalog;
CREATE TABLE laptopsdocentes.caracteristicas (
    id_caracteristica serial NOT NULL,
    id_serial integer,
    id_categoria integer,
    contador integer,
    caracteristica varchar(100),
    valor varchar(200)
)
;
--
-- Structure for table categorias (OID = 89946) : 
--
CREATE TABLE laptopsdocentes.categorias (
    id_categoria serial NOT NULL,
    categoria varchar(50),
    descripcion varchar(100)
)
;
--
-- Structure for table seriales (OID = 89951) : 
--
CREATE TABLE laptopsdocentes.seriales (
    id_serial serial NOT NULL,
    serial varchar(100),
    estado varchar(100)
)
;
--
-- Structure for table serialesexcel (OID = 89956) : 
--
CREATE TABLE laptopsdocentes.serialesexcel (
    serial varchar(100)
)
;
--
-- Structure for table serialesreenvio (OID = 89959) : 
--
CREATE TABLE laptopsdocentes.serialesreenvio (
    serial varchar(100)
)
;
--
-- Structure for table docente_cambios (OID = 89962) : 
--
SET search_path = log, pg_catalog;
CREATE TABLE log.docente_cambios (
    id serial NOT NULL,
    pold varchar(100),
    pnew varchar(100),
    fecha timestamp without time zone DEFAULT now(),
    id_docente integer,
    dbusuario varchar(100) DEFAULT "current_user"(),
    ip text DEFAULT (inet_client_addr())::text
)
;
--
-- Structure for table error_certificados (OID = 89973) : 
--
CREATE TABLE log.error_certificados (
    id serial NOT NULL,
    id_alumno integer,
    fecha timestamp without time zone DEFAULT now(),
    usuario_db varchar DEFAULT "session_user"(),
    ip varchar DEFAULT (inet_client_addr())::character varying
)
;
--
-- Structure for table log_tablas (OID = 89984) : 
--
CREATE TABLE log.log_tablas (
    id serial NOT NULL,
    esquema varchar NOT NULL,
    nombre varchar NOT NULL,
    theoid oid NOT NULL,
    estado varchar DEFAULT 'REGISTRADO'::character varying,
    primary_key varchar
)
;
--
-- Structure for table log_tablas_modificaciones (OID = 89993) : 
--
CREATE TABLE log.log_tablas_modificaciones (
    id serial NOT NULL,
    id_log_tablas bigint,
    tipo varchar,
    fecha timestamp without time zone DEFAULT now(),
    usuario_db varchar DEFAULT "current_user"(),
    usuario_sistema varchar DEFAULT 'DESCONOCIDO'::character varying,
    ip varchar DEFAULT (inet_client_addr())::text,
    cambios t_modificacion[],
    primary_key t_primary_key
)
;
--
-- Structure for table nxt_log_recuperar_clave (OID = 90005) : 
--
CREATE TABLE log.nxt_log_recuperar_clave (
    id serial NOT NULL,
    ci text,
    dia integer,
    mes integer,
    anho integer,
    ip text,
    fecha timestamp without time zone DEFAULT now(),
    email varchar
)
;
--
-- Structure for table uatf_datos_log (OID = 90014) : 
--
CREATE TABLE log.uatf_datos_log (
    id serial NOT NULL,
    id_ra varchar(10) NOT NULL,
    nro_dip varchar(15),
    paterno varchar(20),
    materno varchar(20),
    nombres varchar(65),
    id_sexo varchar(1),
    fec_nacimiento date,
    nac_pais integer,
    id_dep smallint,
    id_prov_original smallint,
    id_loc smallint,
    direccion varchar(60),
    telefono varchar(15),
    id_colegio smallint,
    egr_gestion smallint,
    id_calificacion varchar(1),
    tel_per varchar(12),
    tel_urg varchar(12),
    zona varchar(50),
    estado_civil smallint,
    egr_area varchar(1),
    dip_bach varchar(15),
    clave varchar(60),
    obs varchar(50),
    email varchar(50),
    id_prov_2 integer,
    id_estado_civil_2 smallint DEFAULT 1 NOT NULL,
    tipo_sanguineo smallint,
    id_prov integer,
    id_loc_3 integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    _id_usuario varchar(32)
)
;
--
-- Structure for table equipos_red (OID = 90026) : 
--
SET search_path = net_uatf, pg_catalog;
CREATE TABLE net_uatf.equipos_red (
    id_equipo serial NOT NULL,
    tipo integer NOT NULL,
    id_unidad char(3) NOT NULL,
    id_red integer NOT NULL,
    ip_equipo varchar(20),
    mac_equipo varchar(20),
    fecha_alta date DEFAULT now() NOT NULL,
    fecha_baja date DEFAULT now() NOT NULL,
    observacion varchar(30),
    _id_usuario char(20),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    responsable varchar(40),
    tipo_equipo char(1),
    caracteristicas text
)
;
--
-- Structure for table red (OID = 90037) : 
--
CREATE TABLE net_uatf.red (
    id_red serial NOT NULL,
    red integer NOT NULL,
    nombre_red varchar(40) NOT NULL
)
;
--
-- Structure for table tipo_equipo (OID = 90042) : 
--
CREATE TABLE net_uatf.tipo_equipo (
    id_tipo_equipo serial NOT NULL,
    tipo char(1) NOT NULL,
    tipo_descripcion varchar(40) NOT NULL
)
;
--
-- Structure for table unidades (OID = 90047) : 
--
CREATE TABLE net_uatf.unidades (
    id_unidad serial NOT NULL,
    cod_unidad char(3) NOT NULL,
    unidad char(30) NOT NULL,
    observacion varchar(30),
    _id_usuario char(20),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table borrar_migrar (OID = 90053) : 
--
SET search_path = personal, pg_catalog;
CREATE TABLE personal.borrar_migrar (
    id integer DEFAULT nextval('borrar_id_seq'::regclass) NOT NULL,
    categoria varchar,
    programa varchar,
    id_programa varchar
)
;
--
-- Structure for table categorias_programaticas (OID = 90061) : 
--
CREATE TABLE personal.categorias_programaticas (
    id serial NOT NULL,
    codigo varchar,
    descripcion varchar
)
;
--
-- Structure for table categorias_programaticas_programas (OID = 90069) : 
--
CREATE TABLE personal.categorias_programaticas_programas (
    id serial NOT NULL,
    id_programa varchar,
    id_categoria_programatica bigint
)
;
--
-- Structure for table designacion_beca_excelencia (OID = 90077) : 
--
CREATE TABLE personal.designacion_beca_excelencia (
    id serial NOT NULL,
    id_ra varchar,
    id_programa varchar,
    lugar integer,
    id_gestion integer,
    id_periodo integer,
    categoria_programatica varchar,
    fecha_registro timestamp without time zone DEFAULT now(),
    estado varchar DEFAULT 'REGISTRADO'::character varying
)
;
--
-- Structure for table parametros_beca_excelencia (OID = 90087) : 
--
CREATE TABLE personal.parametros_beca_excelencia (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    id_lugar integer,
    dias integer,
    monto numeric,
    cerrado boolean DEFAULT true,
    estado varchar DEFAULT 'REGISTRADO'::character varying
)
;
--
-- Structure for table pss_areas (OID = 90097) : 
--
CREATE TABLE personal.pss_areas (
    id_area serial NOT NULL,
    codigo_area text NOT NULL,
    area text NOT NULL,
    _registrado timestamp without time zone DEFAULT now(),
    _modificado timestamp without time zone DEFAULT now(),
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table pss_cargos (OID = 90108) : 
--
CREATE TABLE personal.pss_cargos (
    id_cargo serial NOT NULL,
    codigo_cargo text NOT NULL,
    cargo text NOT NULL,
    id_cargo_padre integer,
    _registrado timestamp without time zone DEFAULT now(),
    _modificado timestamp without time zone DEFAULT now(),
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table pss_categorias (OID = 90119) : 
--
CREATE TABLE personal.pss_categorias (
    id_categoria serial NOT NULL,
    codigo_categoria text NOT NULL,
    categoria text NOT NULL,
    _registrado timestamp without time zone DEFAULT now(),
    _modificado timestamp without time zone DEFAULT now(),
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table pss_items (OID = 90130) : 
--
CREATE TABLE personal.pss_items (
    id_item serial NOT NULL,
    id_tipo_item integer NOT NULL,
    id_persona integer,
    id_categoria integer NOT NULL,
    id_cargo integer NOT NULL,
    id_area integer NOT NULL,
    id_centro_costo integer NOT NULL,
    id_ubicacion_organica integer NOT NULL,
    id_ubicacion_geografica integer NOT NULL,
    clave text,
    codigo_item text NOT NULL,
    monto_mensual numeric(10,2) NOT NULL,
    saldo_anterior numeric(10,2) DEFAULT 0.00,
    nro_nua integer,
    sys_anios integer DEFAULT 0,
    sys_meses integer DEFAULT 0,
    sys_dias integer DEFAULT 0,
    quinquenio_pendiente integer,
    sindicalizado text,
    _registrado timestamp without time zone DEFAULT now(),
    _modificado timestamp without time zone DEFAULT now(),
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    funcion_actual text
)
;
--
-- Structure for table pss_items_asignaciones (OID = 90143) : 
--
CREATE TABLE personal.pss_items_asignaciones (
    id_item_asignacion serial NOT NULL,
    id_item integer NOT NULL,
    id_proyecto integer NOT NULL,
    id_programacion integer,
    porcentaje_asignacion numeric(5,2) DEFAULT 0.00 NOT NULL,
    fec_inicio_asignacion date NOT NULL,
    fec_fin_asignacion date NOT NULL,
    _registrado timestamp without time zone DEFAULT now(),
    _modificado timestamp without time zone DEFAULT now(),
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table pss_items_funciones (OID = 90152) : 
--
CREATE TABLE personal.pss_items_funciones (
    id_item_funcion serial NOT NULL,
    id_item integer NOT NULL,
    codigo_item_funcion text NOT NULL,
    item_funcion text NOT NULL,
    descripcion_funcion text NOT NULL,
    _registrado timestamp without time zone DEFAULT now(),
    _modificado timestamp without time zone DEFAULT now(),
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table pentaho (OID = 90165) : 
--
SET search_path = postgrado, pg_catalog;
CREATE TABLE postgrado.pentaho (
    id serial NOT NULL,
    id_alumno integer NOT NULL,
    _registrado timestamp without time zone DEFAULT '2014-05-19 18:29:38.583962'::timestamp without time zone NOT NULL
)
;
--
-- Structure for table universidades (OID = 90171) : 
--
CREATE TABLE postgrado.universidades (
    id serial NOT NULL,
    prefijo char(8) NOT NULL,
    nombre char(64) NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _apoderado (OID = 90177) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes._apoderado (
    id_apoderado serial NOT NULL,
    id_persona integer NOT NULL,
    paterno varchar(35) DEFAULT ''::character varying NOT NULL,
    materno varchar(35) DEFAULT ''::character varying NOT NULL,
    nombres varchar(35) DEFAULT ''::character varying NOT NULL,
    direccion varchar(60) DEFAULT ''::character varying NOT NULL,
    telefono varchar(15) DEFAULT 0 NOT NULL
)
;
--
-- Structure for table _borrar (OID = 90187) : 
--
CREATE TABLE postulantes._borrar (
    a text,
    b text,
    c text,
    d text
)
;
--
-- Structure for table _postulaciones (OID = 90193) : 
--
CREATE TABLE postulantes._postulaciones (
    id serial NOT NULL,
    id_postulante integer NOT NULL,
    id_programa char(3) NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_modalidad smallint NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _usuario_db varchar DEFAULT "current_user"(),
    _ip varchar DEFAULT inet_client_addr(),
    obs varchar,
    _hash varchar(60),
    _estado_confirmacion varchar DEFAULT 'PENDIENTE'::character varying
)
;
--
-- Structure for table _postulantes (OID = 90206) : 
--
CREATE TABLE postulantes._postulantes (
    id serial NOT NULL,
    rude varchar(32),
    _ci varchar(32) DEFAULT ''::character varying NOT NULL,
    paterno varchar(64),
    materno varchar(64),
    nombres varchar(64),
    fecha_nac date,
    id_sexo char(1),
    id_estado_civil smallint,
    id_gestion_egr smallint,
    zona varchar(64),
    direccion varchar(64),
    telf_fijo varchar(16),
    telf_movil varchar(16),
    email varchar(64),
    nro_db varchar,
    id_pais integer DEFAULT 0 NOT NULL,
    id_dep integer DEFAULT 0 NOT NULL,
    id_prov integer DEFAULT 0 NOT NULL,
    id_loc integer DEFAULT 0 NOT NULL,
    id_apoderado integer DEFAULT 0 NOT NULL,
    id_colegio integer DEFAULT 0,
    cod_col_tmp integer,
    id_postulacion integer DEFAULT 0 NOT NULL,
    tipo_pre smallint DEFAULT 0,
    tipo_nro_dip char(2),
    estado_envio varchar
)
;
--
-- Structure for table apoderado (OID = 90223) : 
--
CREATE TABLE postulantes.apoderado (
    nro_dip char(15),
    clave char(5),
    paterno varchar(35),
    materno varchar(35),
    nombres varchar(35),
    direccion varchar(60),
    telefono varchar(15),
    id_persona numeric
)
;
--
-- Structure for table apoderado12122012 (OID = 90229) : 
--
CREATE TABLE postulantes.apoderado12122012 (
    nro_dip char(15),
    clave char(5),
    paterno varchar(35),
    materno varchar(35),
    nombres varchar(35),
    direccion varchar(60),
    telefono varchar(15)
)
;
--
-- Structure for table borrar_ggg (OID = 90232) : 
--
CREATE TABLE postulantes.borrar_ggg (
    a varchar,
    b varchar,
    c varchar,
    d varchar,
    e varchar,
    f varchar,
    g date,
    h varchar,
    i integer,
    id serial NOT NULL
)
;
--
-- Structure for table colegios (OID = 90240) : 
--
CREATE TABLE postulantes.colegios (
    id_colegio smallint NOT NULL,
    colegio varchar(65) NOT NULL,
    tipo char(1) NOT NULL,
    turno char(1) NOT NULL,
    area char(1) NOT NULL,
    cod_dep smallint NOT NULL,
    cod_prov smallint NOT NULL,
    cod_loc smallint NOT NULL
)
;
--
-- Structure for table lugar_departamento (OID = 90243) : 
--
CREATE TABLE postulantes.lugar_departamento (
    cod_pais integer,
    cod_dep smallint NOT NULL,
    departamento varchar(15)
)
;
--
-- Structure for table lugar_localidad (OID = 90246) : 
--
CREATE TABLE postulantes.lugar_localidad (
    cod_pais integer,
    cod_dep smallint,
    cod_prov smallint,
    cod_loc smallint,
    localidad varchar(200)
)
;
--
-- Structure for table lugar_pais (OID = 90249) : 
--
CREATE TABLE postulantes.lugar_pais (
    id_pais smallint,
    pais varchar
)
;
--
-- Structure for table lugar_provincia (OID = 90255) : 
--
CREATE TABLE postulantes.lugar_provincia (
    cod_pais integer,
    cod_dep smallint,
    cod_prov smallint,
    provincia varchar(40)
)
;
--
-- Structure for table personas (OID = 90258) : 
--
CREATE TABLE postulantes.personas (
    nro_dip varchar(15),
    paterno varchar(20),
    materno varchar(20),
    nombres varchar(65) NOT NULL,
    id_sexo char(1) NOT NULL,
    fec_nacimiento date DEFAULT now(),
    direccion varchar(60),
    telefono varchar(15),
    id_colegio smallint,
    egr_turno smallint,
    egr_tipo smallint,
    egr_area char(1),
    egr_pais integer,
    egr_dep char(15),
    egr_prov char(15),
    egr_loc char(15),
    egr_gestion smallint,
    fec_registro date DEFAULT now(),
    id_calificacion char(1),
    id_pais smallint,
    id_dep smallint,
    id_prov smallint,
    id_loc smallint,
    tel_per char(12),
    tel_urg char(12),
    zona varchar(50),
    estado_civil smallint,
    identificador char(15),
    clave char(20) DEFAULT public.identificador('1'::character varying),
    id_programa char(3),
    id_programa_a char(3),
    dip_bach char(15),
    id_gestion smallint DEFAULT 2010,
    id_periodo smallint DEFAULT 1,
    tipo_sanguineo smallint,
    obs char(1),
    email char(50),
    id_expedidoen smallint,
    anular_otra_carrera char(2),
    id_examen integer,
    id_persona serial NOT NULL,
    _id_usuario char(20),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _tipo_academico char(3) DEFAULT 'NAN'::bpchar NOT NULL,
    password varchar(12)
)
;
--
-- Structure for table personas11122012 (OID = 90271) : 
--
CREATE TABLE postulantes.personas11122012 (
    nro_dip varchar(15),
    paterno varchar(20),
    materno varchar(20),
    nombres varchar(65) NOT NULL,
    id_sexo char(1) NOT NULL,
    fec_nacimiento date DEFAULT now(),
    nac_pais integer,
    nac_departamento char(15),
    nac_provincia char(15),
    nac_localidad char(15),
    direccion varchar(60),
    telefono varchar(15),
    id_colegio smallint,
    egr_turno smallint,
    egr_tipo smallint,
    egr_area char(1),
    egr_pais integer,
    egr_dep char(15),
    egr_prov char(15),
    egr_loc char(15),
    egr_gestion smallint,
    fec_registro date DEFAULT now(),
    id_calificacion char(1),
    id_pais smallint,
    id_dep smallint,
    id_prov smallint,
    id_loc smallint,
    tel_per char(12),
    tel_urg char(12),
    zona varchar(50),
    estado_civil smallint,
    identificador char(15),
    clave char(20) DEFAULT identificador('1'::character varying),
    id_programa char(3),
    id_programa_a char(3),
    dip_bach char(15),
    id_gestion smallint DEFAULT 2010,
    id_periodo smallint DEFAULT 1,
    tipo_sanguineo smallint,
    obs char(1),
    email char(50),
    anular_otra_carrera char(2) DEFAULT NULL::bpchar,
    "id_ExpedidoEn" smallint
)
;
--
-- Structure for table postulante (OID = 90285) : 
--
CREATE TABLE postulantes.postulante (
    nro_dip varchar(15),
    paterno varchar(20),
    materno varchar(20),
    nombres varchar(65) NOT NULL,
    id_sexo char(1) NOT NULL,
    fec_nacimiento date DEFAULT now(),
    direccion varchar(60),
    telefono varchar(15),
    id_colegio smallint,
    fec_registro date DEFAULT now(),
    id_pais smallint,
    id_dep smallint,
    id_prov smallint,
    id_loc smallint,
    tel_per char(12),
    tel_urg char(12),
    zona varchar(50),
    cod_rude varchar(50),
    estado_civil smallint,
    id_programa char(3),
    id_programa_a char(3),
    dip_bach char(15),
    obs char(1),
    email char(50),
    id_persona serial NOT NULL,
    _id_usuario char(20),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table postulantes (OID = 90293) : 
--
CREATE TABLE postulantes.postulantes (
    id_alumno serial NOT NULL,
    id_programa char(3) NOT NULL,
    id_ra varchar(10) NOT NULL,
    fec_inscripcion date DEFAULT now(),
    id_plan smallint,
    id_grado char(1) NOT NULL,
    estado char(1) DEFAULT 'P'::bpchar,
    id_calificacion char(1),
    promedio numeric(6,2),
    nro_dip varchar(15),
    examen char(2),
    id_acceso char(2),
    id_periodo smallint,
    id_gestion smallint,
    clave char(5),
    id_programa_a char(3),
    nota integer,
    obs char(1),
    anular_otra_carrera char(2) DEFAULT NULL::bpchar
)
;
--
-- Structure for table trabajadores2014 (OID = 91089) : 
--
SET search_path = recycler, pg_catalog;
CREATE TABLE recycler.trabajadores2014 (
    id serial NOT NULL,
    ci varchar(50),
    paterno varchar(50),
    materno varchar(50),
    nombres varchar(50),
    tipo varchar(100),
    unidad varchar(150)
)
;
--
-- Structure for table siap_meses (OID = 91117) : 
--
CREATE TABLE recycler.siap_meses (
    id_mes smallint,
    mes varchar,
    fec_ini date,
    fec_fin date
)
;
--
-- Structure for table impresion_planilla (OID = 91134) : 
--
CREATE TABLE recycler.impresion_planilla (
    id_planilla numeric,
    id_tip_pla smallint,
    gestion smallint,
    mes smallint,
    usuario varchar(15),
    fecha timestamp(0) without time zone,
    consulta text,
    estado char(1) DEFAULT 'S'::bpchar
)
;
--
-- Structure for table _usuarios_borrar (OID = 91185) : 
--
CREATE TABLE recycler._usuarios_borrar (
    id_usuario varchar(15) NOT NULL,
    nombre varchar(45) NOT NULL,
    clave varchar(15) NOT NULL,
    estado char(1) DEFAULT 'A'::bpchar,
    email varchar(35),
    recordatorio varchar(35),
    id_grupo varchar(10) NOT NULL,
    id_rol varchar(10),
    id_facultad smallint,
    id_sede smallint,
    inicial char(6),
    bibliotecas varchar(1)
)
;
--
-- Structure for table sis_autoridades (OID = 91189) : 
--
CREATE TABLE recycler.sis_autoridades (
    id_usuario varchar(15) NOT NULL,
    id_gestion smallint,
    id_periodo smallint,
    fecha_ini timestamp without time zone DEFAULT now(),
    fecha_fin timestamp without time zone,
    estado char(1) NOT NULL,
    tipo char(3) NOT NULL
)
;
--
-- Structure for table _categorias (OID = 91263) : 
--
CREATE TABLE recycler._categorias (
    id_categoria varchar(15),
    categoria varchar(35),
    imagen varchar(20)
)
;
--
-- Structure for table _id_gestion (OID = 91272) : 
--
CREATE TABLE recycler._id_gestion (
    id_gestion integer
)
;
--
-- Structure for table _o_usuarios (OID = 91296) : 
--
CREATE TABLE recycler._o_usuarios (
    id_usuario varchar(10),
    ci varchar(15) NOT NULL,
    nombres varchar(25),
    paterno varchar(20),
    materno varchar(20),
    estado varchar(1),
    fec_nac date,
    nac_pais integer,
    id_dep smallint,
    id_prov smallint,
    id_loc smallint,
    estado_civil smallint,
    id_sexo varchar(1),
    mail varchar(40),
    direccion varchar(40),
    telefono varchar(10)
)
;
--
-- Structure for table _record (OID = 91299) : 
--
CREATE TABLE recycler._record (
    category text,
    shortname text,
    fullname text,
    idnumber text,
    id_grupo text
)
;
--
-- Structure for table _tbl_sugerencias (OID = 91323) : 
--
CREATE TABLE recycler._tbl_sugerencias (
    id_sugerencia serial NOT NULL,
    ap_nombres varchar(120),
    email varchar(90),
    comentario varchar,
    fecha_registro timestamp without time zone,
    fecha_contestacion timestamp without time zone,
    contestado boolean
)
;
--
-- Structure for table _tbl_tipo_avisos (OID = 91331) : 
--
CREATE TABLE recycler._tbl_tipo_avisos (
    id_tipo_aviso char(1) NOT NULL,
    tipo_aviso varchar(35) NOT NULL
)
;
--
-- Structure for table _tbl_tipo_tableros (OID = 91334) : 
--
CREATE TABLE recycler._tbl_tipo_tableros (
    id_tipo_tablero varchar(1) NOT NULL,
    tipo_tablero varchar(35) NOT NULL
)
;
--
-- Structure for table actualizacion_postulantes (OID = 91337) : 
--
CREATE TABLE recycler.actualizacion_postulantes (
    nro_dip char(15) NOT NULL,
    fecha_actualizacion date DEFAULT now(),
    id integer DEFAULT nextval('public._id_post'::regclass) NOT NULL,
    certificado boolean DEFAULT false
)
;
--
-- Structure for table alm_carnets (OID = 91343) : 
--
CREATE TABLE recycler.alm_carnets (
    corr0 integer DEFAULT nextval(('"alm_carnets_corr0_seq"'::text)::regclass) NOT NULL,
    id_alumno integer NOT NULL,
    id_gestion smallint NOT NULL,
    fec_emision date NOT NULL,
    hora time without time zone NOT NULL,
    tipo varchar(1) NOT NULL,
    descripcion varchar(25) NOT NULL
)
;
--
-- Structure for table alm_deudas (OID = 91347) : 
--
CREATE TABLE recycler.alm_deudas (
    id_alumno integer NOT NULL,
    corr0 timestamp with time zone DEFAULT '2005-03-09 20:05:00.958207-04'::timestamp with time zone NOT NULL,
    id_gestion smallint,
    id_programa char(3),
    fec_registro date DEFAULT '2005-03-09'::date,
    id_tipo char(1) NOT NULL,
    obs varchar(50),
    ult_usuario varchar(10) NOT NULL,
    estado char(1) DEFAULT 'P'::bpchar NOT NULL,
    obs_modif varchar(50),
    fec_modif date,
    ult_usuario_modif varchar(10)
)
;
--
-- Structure for table alumnos_bloqueados (OID = 91353) : 
--
CREATE TABLE recycler.alumnos_bloqueados (
    id_bloqueado integer DEFAULT nextval('alumnos_bloqueados_id_bloqueado_seq1'::regclass) NOT NULL,
    id_alumno integer NOT NULL,
    id_programa char(3) NOT NULL,
    id_ra varchar(10),
    fecha_bloqueo date DEFAULT now() NOT NULL,
    observacion varchar(30),
    tipo_bloqueo char(1) NOT NULL,
    _id_usuario char(20),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table aud_link_archivos (OID = 91370) : 
--
CREATE TABLE recycler.aud_link_archivos (
    id_archivo integer DEFAULT nextval('aud_link_archivos_id_archivo_seq1'::regclass) NOT NULL,
    nombre_archivo varchar(300) NOT NULL,
    nombre_enlace varchar(300) NOT NULL,
    estado_archivo boolean DEFAULT true,
    id_tipo_doc integer,
    fecha_reg timestamp(0) without time zone,
    fecha_modif timestamp without time zone,
    id_usuario varchar(15)
)
;
ALTER TABLE ONLY recycler.aud_link_archivos ALTER COLUMN id_archivo SET STATISTICS 0;
ALTER TABLE ONLY recycler.aud_link_archivos ALTER COLUMN nombre_archivo SET STATISTICS 0;
--
-- Structure for table aud_tipo_doc (OID = 91379) : 
--
CREATE TABLE recycler.aud_tipo_doc (
    id_tipo_doc integer NOT NULL,
    nombre_tipo_doc varchar(80),
    estado_tipo_doc boolean DEFAULT true,
    fecha_reg timestamp without time zone,
    fecha_modif timestamp without time zone,
    id_usuario varchar(15) NOT NULL
)
;
--
-- Structure for table ayudantes (OID = 91383) : 
--
CREATE TABLE recycler.ayudantes (
    id_alumno integer,
    id_periodo smallint,
    id_gestion smallint,
    id_materia integer,
    id_grupo integer,
    estado char(1)
)
;
--
-- Structure for table beca_alberge (OID = 91386) : 
--
CREATE TABLE recycler.beca_alberge (
    "Nro" smallint,
    nro_dip varchar(15),
    "NOMBRES" varchar(255),
    "CARRERA" varchar(3)
)
;
--
-- Structure for table becarios2014 (OID = 91389) : 
--
CREATE TABLE recycler.becarios2014 (
    id serial NOT NULL,
    tipo varchar(200),
    cod_prog varchar(200),
    item varchar(200),
    descripcion varchar(300),
    ci varchar(50),
    nombre_completo varchar(300)
)
;
--
-- Structure for table borrador (OID = 91397) : 
--
CREATE TABLE recycler.borrador (
    numero integer NOT NULL,
    cadena varchar(50)
)
;
--
-- Structure for table borrar2 (OID = 91403) : 
--
CREATE TABLE recycler.borrar2 (
    a text,
    b text,
    c text,
    d text
)
;
--
-- Structure for table borrarx (OID = 91430) : 
--
CREATE TABLE recycler.borrarx (
    a text,
    b numeric,
    c numeric,
    d numeric,
    e numeric,
    f numeric
)
;
--
-- Structure for table bv_editorial (OID = 91436) : 
--
CREATE TABLE recycler.bv_editorial (
    id_editorial char(10) NOT NULL,
    editorial varchar(50)
)
;
--
-- Structure for table bv_encuadernacion (OID = 91439) : 
--
CREATE TABLE recycler.bv_encuadernacion (
    id_encuadernacion char(10) NOT NULL,
    encuadernacion varchar(50)
)
;
--
-- Structure for table bv_formato (OID = 91442) : 
--
CREATE TABLE recycler.bv_formato (
    id_formato char(10) NOT NULL,
    formato varchar(50)
)
;
--
-- Structure for table bv_libro (OID = 91445) : 
--
CREATE TABLE recycler.bv_libro (
    id_libro char(10) NOT NULL,
    fec_registro date,
    reg_anterior integer,
    reg_actual integer,
    signatura char(10),
    topografia char(5),
    cantidad integer,
    unidad char(50),
    autor char(50),
    titulo varchar(250),
    edicion char(50),
    id_editorial char(10),
    aeditorial integer,
    num_pag integer,
    id_formato char(10),
    id_encuadernacion char(10),
    id_procedencia char(10),
    precio_unit double precision,
    id_carrera char(10),
    contenido char(50),
    observacion varchar(250),
    inventariado char(50),
    id_ubicacion char(10),
    id_pais integer,
    CONSTRAINT bv_libro_check0 CHECK ((precio_unit > (10)::double precision))
)
;
--
-- Structure for table bv_procedencia (OID = 91452) : 
--
CREATE TABLE recycler.bv_procedencia (
    id_procedencia char(10) NOT NULL,
    procedencia varchar(50)
)
;
--
-- Structure for table bv_ubicacion (OID = 91455) : 
--
CREATE TABLE recycler.bv_ubicacion (
    id_ubicacion char(10) NOT NULL,
    nestante integer,
    nfila integer,
    ncolumna integer
)
;
--
-- Structure for table centra_2008 (OID = 91463) : 
--
CREATE TABLE recycler.centra_2008 (
    id_facultad numeric(3,0),
    id_programa char(3),
    "PSA" char(4),
    "AD" char(4),
    "PRE" char(4),
    "PD" char(4),
    "E" char(4),
    "X" char(4),
    "D" char(4),
    "O" char(4),
    "P" char(4),
    "C" char(4),
    "T" char(4),
    "F" char(4),
    "TOTAL" char(4)
)
;
--
-- Structure for table comunicado (OID = 91471) : 
--
CREATE TABLE recycler.comunicado (
    id integer,
    mensaje text,
    fecha_inicio date,
    fecha_fin date
)
;
--
-- Structure for table correcciones (OID = 91477) : 
--
CREATE TABLE recycler.correcciones (
    id_correccion integer,
    fecha_correcion timestamp with time zone,
    id_dct_asignaciones integer,
    nro_reposicion integer,
    motivo text,
    cuantas_veces integer,
    funcionario varchar(50)
)
;
--
-- Structure for table dct_cargo_tiempo (OID = 91483) : 
--
CREATE TABLE recycler.dct_cargo_tiempo (
    id_docente integer,
    id_cargo char(1),
    tiempo varchar(3),
    id_gestion smallint,
    id_periodo smallint,
    id_programa_item varchar(3),
    fecha_actualizacion timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table docente_inv (OID = 91492) : 
--
CREATE TABLE recycler.docente_inv (
    id_docente integer,
    id_gestion smallint,
    id_periodo smallint,
    estado char(1),
    obs char(68)
)
;
--
-- Structure for table elecciones_rector (OID = 91495) : 
--
CREATE TABLE recycler.elecciones_rector (
    id_ra varchar(10),
    nro_dip varchar(15),
    apellidos_nombres text,
    id_alumno integer,
    id_programa bpchar,
    programa varchar(50),
    facultad varchar(100)
)
;
--
-- Structure for table eliminar (OID = 91501) : 
--
CREATE TABLE recycler.eliminar (
    nro_dip varchar(15)
)
;
--
-- Structure for table evaluacion_academica (OID = 91504) : 
--
CREATE TABLE recycler.evaluacion_academica (
    id_docente integer,
    id_gestion integer,
    id_periodo integer,
    id_programa char(3),
    codigo_variable integer,
    fecha date,
    hora time(0) without time zone,
    valor integer
)
;
--
-- Structure for table g_actualiza_e (OID = 91507) : 
--
CREATE TABLE recycler.g_actualiza_e (
    id varchar(32) NOT NULL,
    id_programa varchar(3),
    id_docente smallint,
    sigla varchar(6),
    grupo smallint,
    ip varchar(15),
    fechan varchar(10),
    fechaa varchar(10),
    fechaactualizacion timestamp without time zone,
    descripcion varchar(150),
    tipo varchar(15),
    estado smallint
)
;
--
-- Structure for table g_bitacora (OID = 91510) : 
--
CREATE TABLE recycler.g_bitacora (
    id_comunicado serial NOT NULL,
    id_programa varchar(3),
    id_vista varchar(32),
    de varchar(30),
    fecha date,
    fecha_ingreso timestamp without time zone,
    valor varchar(1)
)
;
--
-- Structure for table g_calendario (OID = 91515) : 
--
CREATE TABLE recycler.g_calendario (
    id varchar(32) NOT NULL,
    id_programa varchar(3),
    mes varchar(10),
    cal_ini date,
    cal_fin date,
    cal_descripcion varchar(380),
    tipo_c varchar(1),
    parcial varchar(15),
    g_id_autor integer,
    gestion smallint,
    periodo smallint
)
;
--
-- Structure for table g_documentos (OID = 91518) : 
--
CREATE TABLE recycler.g_documentos (
    id_doc serial NOT NULL,
    id_programa varchar(3),
    id_docente integer,
    tipo varchar(24),
    expi varchar(20),
    ingreso varchar(20),
    file_name varchar(39),
    tamano_bytes integer,
    tamano_file varchar(25),
    materia varchar(25),
    grupo smallint,
    descripcion_doc varchar(150),
    icono varchar(25),
    estado smallint,
    gestion smallint,
    periodo smallint
)
;
--
-- Structure for table g_eventos (OID = 91523) : 
--
CREATE TABLE recycler.g_eventos (
    id_evento serial NOT NULL,
    id_docente integer,
    sigla varchar(6),
    id_programa varchar(3),
    fech_inicio varchar(10),
    fech_fin varchar(10),
    h_inicio varchar(10),
    h_fin varchar(10),
    tipo varchar(40),
    descripcion varchar(150)
)
;
--
-- Structure for table g_examenes (OID = 91528) : 
--
CREATE TABLE recycler.g_examenes (
    id varchar(32) NOT NULL,
    g_id_autor integer,
    id_programa varchar(3),
    sigla varchar(6),
    grupo varchar(6),
    tipo varchar(15),
    fecha_programacion varchar(19),
    fecha_examen varchar(10),
    hora_examen varchar(5),
    descripcion varchar(100),
    fech_ini varchar(10),
    fech_lim varchar(10),
    amb varchar(10),
    gestion smallint,
    periodo smallint,
    estado smallint
)
;
--
-- Structure for table g_gestion (OID = 91531) : 
--
CREATE TABLE recycler.g_gestion (
    id_gestion serial NOT NULL,
    id_programa varchar(3),
    gestion smallint,
    periodo smallint,
    pass varchar(32),
    valor smallint
)
;
--
-- Structure for table g_mi_carrera (OID = 91536) : 
--
CREATE TABLE recycler.g_mi_carrera (
    id_carrera serial NOT NULL,
    titulo_pagina varchar(250),
    icono varchar(100),
    titulo_bienvenida varchar(50),
    bienvenida varchar(2000),
    pie varchar(200),
    mision varchar(2000),
    vision varchar(2000),
    objetivos varchar(2000),
    normas varchar(2000),
    perfil varchar(2000),
    area varchar(2000),
    campo varchar(2000),
    id_programa varchar(3)
)
;
--
-- Structure for table g_noticias (OID = 91544) : 
--
CREATE TABLE recycler.g_noticias (
    id varchar(32) NOT NULL,
    g_titulo varchar(25),
    img varchar(36),
    contenido varchar(300),
    g_id_autor smallint,
    id_programa varchar(3),
    gestion smallint,
    periodo smallint
)
;
--
-- Structure for table g_paginas (OID = 91547) : 
--
CREATE TABLE recycler.g_paginas (
    id_pagina serial NOT NULL,
    id_programa varchar(3),
    direccion_web varchar(50),
    estado varchar(1) DEFAULT 'D'::character varying,
    fecha_creacion date
)
;
--
-- Structure for table g_perfiles (OID = 91553) : 
--
CREATE TABLE recycler.g_perfiles (
    id_perfil serial NOT NULL,
    tipo varchar(17),
    titulo varchar(50),
    autor varchar(60),
    tutor varchar(50),
    id_alumno varchar(6),
    especialidad varchar(35),
    fecha_defensa date,
    resumen varchar(500),
    id_programa varchar(3)
)
;
--
-- Structure for table g_reporte (OID = 91561) : 
--
CREATE TABLE recycler.g_reporte (
    id serial NOT NULL,
    id_docente smallint,
    id_programa varchar(3),
    sigla varchar(6),
    tipo varchar(25),
    gestion smallint,
    periodo smallint
)
;
--
-- Structure for table guia_telefonica (OID = 91566) : 
--
CREATE TABLE recycler.guia_telefonica (
    id integer NOT NULL,
    nombre_razonsocial varchar(50)[],
    telf_oficina varchar(15)[],
    telf_domicilio varchar(15)[],
    cel varchar(15)[]
)
;
--
-- Structure for table h_actas_graduacion (OID = 91572) : 
--
CREATE TABLE recycler.h_actas_graduacion (
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    titulo_trabajo varchar,
    fecha_graduac date,
    hora_graduac date,
    nota_numeral integer,
    nota_literal integer,
    observaciones char(80),
    hora_conclusion date,
    id_tribunal char(10),
    num_libro integer,
    num_folio char(5),
    usuario integer,
    id_modalidad integer,
    nro_sellado smallint
)
;
--
-- Structure for table h_alm_programas_graduacion (OID = 91578) : 
--
CREATE TABLE recycler.h_alm_programas_graduacion (
    id_programa varchar(3),
    id_modalidad integer,
    id_gestion integer,
    id_periodo integer,
    id_materia integer,
    estado char(1),
    id_nivel integer DEFAULT 1,
    cod_sistema char(1),
    id_usuario integer
)
;
--
-- Structure for table h_asignar_fecha (OID = 91582) : 
--
CREATE TABLE recycler.h_asignar_fecha (
    cod_graduacion varchar(35) NOT NULL,
    titulo_trabajo varchar(550),
    tipo_fecha char(30),
    fecha_grado date,
    fecha_grado2 date,
    hora_gradu time(0) without time zone,
    ambiente integer,
    fecha_registro date,
    fecha_asig date,
    estado char(1),
    hora_final time(0) without time zone,
    id_usuario varchar(15)
)
;
--
-- Structure for table h_asignar_folios (OID = 91588) : 
--
CREATE TABLE recycler.h_asignar_folios (
    nro_folio integer,
    folio integer
)
;
--
-- Structure for table h_asignar_folios_acta (OID = 91591) : 
--
CREATE TABLE recycler.h_asignar_folios_acta (
    cod_acta integer,
    cod_libro char(10),
    nro_registro integer,
    nro_folio integer,
    estado char(1),
    cod_graduacion varchar(30),
    tipo_folio char(3)
)
;
--
-- Structure for table h_asignar_folios_libro (OID = 91594) : 
--
CREATE TABLE recycler.h_asignar_folios_libro (
    cod_registro integer NOT NULL,
    cod_libro char(10),
    nro_folio integer,
    tipo char(3),
    estado char(1),
    fecha_registro char(15),
    fecha_asig char(15),
    cod_acta integer,
    id_usuario varchar(10)
)
;
--
-- Structure for table h_asignar_libro (OID = 91597) : 
--
CREATE TABLE recycler.h_asignar_libro (
    cod_libro char(10) NOT NULL,
    nombre_libro varchar(50),
    id_facultad integer,
    gestion integer,
    nro_folios integer,
    fecha_aper char(15),
    fecha_regis char(15),
    id_usuario varchar(15),
    folio_inicio integer,
    folio_final integer
)
;
--
-- Structure for table h_asignar_moda_carre (OID = 91600) : 
--
CREATE TABLE recycler.h_asignar_moda_carre (
    cod_libro char(10),
    id_programa char(3),
    id_modalidad integer
)
;
--
-- Structure for table h_asignar_tribu (OID = 91603) : 
--
CREATE TABLE recycler.h_asignar_tribu (
    cod_graduacion varchar(35),
    id_docente integer,
    id_rol integer,
    fecha_registro date
)
;
--
-- Structure for table h_certi_tipo (OID = 91606) : 
--
CREATE TABLE recycler.h_certi_tipo (
    id_tipo_certi integer NOT NULL,
    certificacion varchar(50),
    tipo char(1)
)
;
--
-- Structure for table h_certificar_acta (OID = 91609) : 
--
CREATE TABLE recycler.h_certificar_acta (
    nro_certi integer NOT NULL,
    id_alumno integer,
    cod_acta integer,
    cod_graduacion varchar(30),
    id_modalidad integer,
    nro_sello integer,
    id_tipo_certi char(1),
    fecha_certi date,
    id_gestion integer,
    id_periodo integer,
    estado char(1),
    id_usuario varchar(15)
)
;
--
-- Structure for table h_codigos_titulados (OID = 91612) : 
--
CREATE TABLE recycler.h_codigos_titulados (
    nro_titulado integer NOT NULL
)
;
--
-- Structure for table h_crear_acta (OID = 91615) : 
--
CREATE TABLE recycler.h_crear_acta (
    cod_acta integer NOT NULL,
    cod_graduacion varchar(35),
    id_gestion integer,
    id_periodo integer,
    fecha_acta timestamp(0) without time zone,
    hora_acta char(15),
    hora_fin_acta char(15),
    cod_libro char(10),
    nro_acta integer,
    nro_folio varchar(10),
    recom char(1),
    fecha_registro date,
    sistema char(1),
    estado char(1),
    id_usuario varchar(15)
)
;
--
-- Structure for table h_crear_acta_alumno (OID = 91618) : 
--
CREATE TABLE recycler.h_crear_acta_alumno (
    nro_registro integer NOT NULL,
    cod_acta integer,
    id_alumno integer,
    cod_graduacion varchar(35),
    infor integer,
    expo integer,
    defen integer,
    confe integer,
    prome integer,
    inter1 integer,
    inter2 integer,
    inter3 integer,
    inter4 integer,
    inter5 integer,
    nota integer,
    observacion char(30),
    estado char(1)
)
;
--
-- Structure for table h_crear_recom_acta (OID = 91621) : 
--
CREATE TABLE recycler.h_crear_recom_acta (
    cod_acta integer,
    cod_graduacion varchar(30),
    recom text
)
;
--
-- Structure for table h_crear_tipo_evalu (OID = 91627) : 
--
CREATE TABLE recycler.h_crear_tipo_evalu (
    cod_tipo char(3),
    evaluacion varchar(100),
    estado char(1)
)
;
--
-- Structure for table h_emitir_proveido (OID = 91630) : 
--
CREATE TABLE recycler.h_emitir_proveido (
    nro_proveido smallint NOT NULL,
    codigo varchar(20),
    tipo_tramite integer,
    id_programa char(3),
    id_facultad integer,
    nro_dip char(15),
    id_alumno integer,
    gestion integer,
    periodo integer,
    fecha_emision date,
    estado char(1),
    unidad integer,
    id_usuario integer
)
;
--
-- Structure for table h_historialper (OID = 91633) : 
--
CREATE TABLE recycler.h_historialper (
    nro_titulado integer,
    cod_acta integer,
    cod_libro char(10),
    cod_graduacion varchar(30),
    id_alumno integer,
    fecha_grado varchar(15),
    id_gestion integer,
    id_periodo integer,
    nota integer,
    estado char(1),
    cod_acta2 integer,
    cod_libro2 char(10),
    cod_graduacion2 varchar(30)
)
;
--
-- Structure for table h_instituciones (OID = 91636) : 
--
CREATE TABLE recycler.h_instituciones (
    cod_institucion integer,
    institucion char(100)
)
;
--
-- Structure for table h_materias_grado (OID = 91639) : 
--
CREATE TABLE recycler.h_materias_grado (
    id_programa char(3),
    cod_materia integer,
    id_gestion integer,
    id_periodo integer,
    estado char(1)
)
;
--
-- Structure for table h_modalidad_graduacion (OID = 91642) : 
--
CREATE TABLE recycler.h_modalidad_graduacion (
    id_modalidad integer,
    modalidad varchar(55)
)
;
--
-- Structure for table h_rol_tribunal (OID = 91645) : 
--
CREATE TABLE recycler.h_rol_tribunal (
    id_rol_tribunal integer,
    nombre varchar(30)
)
;
--
-- Structure for table h_sistema_acta (OID = 91648) : 
--
CREATE TABLE recycler.h_sistema_acta (
    cod_sistema char(1) NOT NULL,
    sistema varchar(100)
)
;
--
-- Structure for table h_solicitud_gradu_moda (OID = 91651) : 
--
CREATE TABLE recycler.h_solicitud_gradu_moda (
    nro_solicitud integer DEFAULT 0 NOT NULL,
    id_alumno integer DEFAULT 0 NOT NULL,
    id_programa char(3),
    cod_grado integer,
    id_gestion integer,
    id_periodo integer,
    id_modalidad integer,
    cod_graduacion varchar(35),
    cod_tipo char(3),
    grupo integer,
    estado char(1)
)
;
--
-- Structure for table h_solicitud_titulacion (OID = 91656) : 
--
CREATE TABLE recycler.h_solicitud_titulacion (
    nro_solicitud integer NOT NULL,
    id_alumno integer,
    id_modalidad integer,
    id_gestion integer,
    id_periodo integer,
    fecha_solicitud date,
    hora_solicitud time(0) without time zone,
    id_usuario varchar(15),
    fecha_registro timestamp(0) without time zone DEFAULT now()
)
;
--
-- Structure for table h_titulados (OID = 91660) : 
--
CREATE TABLE recycler.h_titulados (
    nro_titulado integer,
    id_ra char(25),
    id_alumno integer,
    nro_dip char(15),
    id_nivel integer,
    id_facultad integer,
    id_programa char(3),
    paterno char(50),
    materno char(50),
    nombres char(60),
    fec_nacimiento varchar(15),
    edad integer,
    sexo char(1),
    titulo_trabajo varchar(650),
    id_modalidad integer,
    fecha_registro varchar(15),
    fecha_acta varchar(15),
    gestion integer,
    periodo integer,
    nota char(10),
    observacion char(35),
    ingreso integer,
    permanencia integer,
    estado char(1),
    tipo_tribu char(10),
    hora_gradu varchar(15),
    hora_final varchar(15),
    cod_libro char(10),
    nro_folios varchar(15),
    presi integer,
    secre integer,
    vocal1 integer,
    vocal2 integer,
    coordi integer,
    jefe_inter integer,
    jefe_proc_inv integer,
    tribu1 integer,
    tribu2 integer,
    tribu3 integer,
    tribu4 integer,
    tribu5 integer
)
;
--
-- Structure for table h_titulados_2 (OID = 91666) : 
--
CREATE TABLE recycler.h_titulados_2 (
    nro_titulado integer NOT NULL,
    id_ra char(25),
    id_alumno integer,
    nro_dip char(15),
    id_nivel integer,
    id_facultad integer,
    id_programa char(3),
    paterno char(50),
    materno char(50),
    nombres char(60),
    fec_nacimiento varchar(15),
    edad integer,
    sexo char(1),
    titulo_trabajo varchar(650),
    id_modalidad integer,
    fecha_registro varchar(15),
    gestion integer,
    periodo integer,
    nota char(10),
    observacion char(35),
    ingreso integer,
    permanencia integer,
    estado char(1),
    tipo_perso char(1),
    canti_actas integer,
    cod_grado1 varchar(30),
    cod_grado2 varchar(30),
    id_usuario integer
)
;
--
-- Structure for table h_trabajo_actas (OID = 91672) : 
--
CREATE TABLE recycler.h_trabajo_actas (
    nro_solicitud integer,
    cod_graduacion varchar(30),
    titulo_trabajo char(500),
    id_programa char(3),
    id_modalidad integer,
    id_gestion integer,
    id_periodo integer,
    fecha_registro date
)
;
--
-- Structure for table h_tribunal_invitado (OID = 91678) : 
--
CREATE TABLE recycler.h_tribunal_invitado (
    cod_invitado integer,
    cod_acta integer,
    id_alumno integer,
    nombre_invitado char(150),
    institucion char(150),
    cod_ciudad integer
)
;
--
-- Structure for table h_tribunales_cambiados (OID = 91681) : 
--
CREATE TABLE recycler.h_tribunales_cambiados (
    id_alumno integer,
    id_tribunal_ti integer,
    id_programa char(3),
    id_tribunal_sus integer,
    rol_tribunal integer
)
;
--
-- Structure for table h_usuarios (OID = 91684) : 
--
CREATE TABLE recycler.h_usuarios (
    id_usuario integer,
    nombre char(30),
    paterno char(30),
    materno char(30),
    login char(10),
    clave char(10),
    direccion char(50),
    telefono integer,
    id_funciones_usuario char(5)
)
;
--
-- Structure for table ibba (OID = 91687) : 
--
CREATE TABLE recycler.ibba (
    id_ra varchar(10) NOT NULL,
    id_sanguineo smallint,
    hematocrito numeric(10,2),
    hemoglobina numeric(10,2),
    chagas varchar(1),
    vdrl varchar(1),
    fecha timestamp without time zone,
    obs varchar(50)
)
;
--
-- Structure for table jcm_anios_beneficio (OID = 91695) : 
--
CREATE TABLE recycler.jcm_anios_beneficio (
    max numeric(10,2)
)
;
--
-- Structure for table jcm_encrypt (OID = 91698) : 
--
CREATE TABLE recycler.jcm_encrypt (
    int4 integer
)
;
--
-- Structure for table jcm_id_gestion (OID = 91701) : 
--
CREATE TABLE recycler.jcm_id_gestion (
    id_gestion smallint
)
;
--
-- Structure for table jcm_id_solicitud (OID = 91704) : 
--
CREATE TABLE recycler.jcm_id_solicitud (
    _get_scendencia integer
)
;
--
-- Structure for table lista_enviada (OID = 91710) : 
--
CREATE TABLE recycler.lista_enviada (
    ci varchar(15) NOT NULL
)
;
--
-- Structure for table listados_adm (OID = 91713) : 
--
CREATE TABLE recycler.listados_adm (
    carnet varchar(10),
    ap_paterno varchar(20),
    ap_materno varchar(20),
    nombres varchar(65)
)
;
--
-- Structure for table m_informacion (OID = 91716) : 
--
CREATE TABLE recycler.m_informacion (
    titulo varchar(254),
    fecha varchar(254),
    descrip varchar(254),
    carrer varchar(254),
    clave varchar(254),
    claveca varchar(254),
    tipo varchar(254)
)
;
--
-- Structure for table medicina (OID = 91727) : 
--
CREATE TABLE recycler.medicina (
    nombrec varchar(254),
    ci varchar(50),
    obs varchar(254)
)
;
--
-- Structure for table medicina_primer (OID = 91733) : 
--
CREATE TABLE recycler.medicina_primer (
    nombrec varchar(254),
    ci double precision,
    "FIS" varchar(254),
    "Mat" double precision,
    "Quim" double precision,
    "NOTA FINAL" double precision,
    pond1 double precision,
    "Campo9" varchar(254)
)
;
--
-- Structure for table msc_avisos (OID = 91739) : 
--
CREATE TABLE recycler.msc_avisos (
    aviso_id serial NOT NULL,
    aviso_depto_public varchar(3),
    aviso_contenido varchar(5000),
    aviso_fecha_public date NOT NULL,
    aviso_fecha_lim_puclic date NOT NULL,
    aviso_vigente boolean NOT NULL
)
;
--
-- Structure for table msc_minerales (OID = 91747) : 
--
CREATE TABLE recycler.msc_minerales (
    mineral_id serial NOT NULL,
    mineral_descripcion varchar(20) NOT NULL,
    mineral_simbolo varchar(3),
    mineral_medida varchar(4),
    mineral_vigente boolean NOT NULL
)
;
ALTER TABLE ONLY recycler.msc_minerales ALTER COLUMN mineral_id SET STATISTICS 0;
ALTER TABLE ONLY recycler.msc_minerales ALTER COLUMN mineral_descripcion SET STATISTICS 0;
--
-- Structure for table msc_minerales_cotizacion (OID = 91750) : 
--
CREATE TABLE recycler.msc_minerales_cotizacion (
    cotizacion_id serial NOT NULL,
    mineral_id integer NOT NULL,
    cotizacion_fecha date NOT NULL,
    cotizacion_precio double precision
)
;
--
-- Structure for table notas_planilla_borrar (OID = 91757) : 
--
CREATE TABLE recycler.notas_planilla_borrar (
    id_matricula integer DEFAULT nextval('notas_planillax_id_matricula_seq'::regclass) NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_alumno integer NOT NULL,
    id_materia smallint NOT NULL,
    grupo smallint,
    nota numeric(5,2) DEFAULT 0,
    ult_usuario varchar(10) NOT NULL,
    estado char(1) NOT NULL,
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
    tipo varchar(1) DEFAULT 'N'::character varying
)
;
--
-- Structure for table nro_aleatorio (OID = 91781) : 
--
CREATE TABLE recycler.nro_aleatorio (
    id_aleatorio integer NOT NULL,
    nro_aleatorio integer,
    estado boolean
)
;
--
-- Structure for table organizacion (OID = 91789) : 
--
CREATE TABLE recycler.organizacion (
    id_org smallint,
    des_org varchar
)
;
--
-- Structure for table personal_2011_04_28 (OID = 91795) : 
--
CREATE TABLE recycler.personal_2011_04_28 (
    nro_dip varchar(15),
    paterno varchar(20),
    materno varchar(20),
    nombres varchar(65),
    fec_nacimiento date,
    tipo varchar(12)
)
;
--
-- Structure for table pg_history_log (OID = 91798) : 
--
CREATE TABLE recycler.pg_history_log (
    t text
)
;
--
-- Structure for table pga_diagrams (OID = 91804) : 
--
CREATE TABLE recycler.pga_diagrams (
    diagramname varchar(64) NOT NULL,
    diagramtables text,
    diagramlinks text
)
;
--
-- Structure for table pga_forms (OID = 91810) : 
--
CREATE TABLE recycler.pga_forms (
    formname varchar(64),
    formsource text
)
;
--
-- Structure for table pga_graphs (OID = 91816) : 
--
CREATE TABLE recycler.pga_graphs (
    graphname varchar(64) NOT NULL,
    graphsource text,
    graphcode text
)
;
--
-- Structure for table pga_images (OID = 91822) : 
--
CREATE TABLE recycler.pga_images (
    imagename varchar(64) NOT NULL,
    imagesource text
)
;
--
-- Structure for table pga_layout (OID = 91828) : 
--
CREATE TABLE recycler.pga_layout (
    tablename varchar(64) NOT NULL,
    nrcols smallint,
    colnames text,
    colwidth text
)
;
--
-- Structure for table pga_queries (OID = 91834) : 
--
CREATE TABLE recycler.pga_queries (
    queryname varchar(64),
    querytype char(1),
    querycommand text,
    querytables text,
    querylinks text,
    queryresults text,
    querycomments text
)
;
--
-- Structure for table pga_reports (OID = 91840) : 
--
CREATE TABLE recycler.pga_reports (
    reportname varchar(64),
    reportsource text,
    reportbody text,
    reportprocs text,
    reportoptions text
)
;
--
-- Structure for table pga_schema (OID = 91846) : 
--
CREATE TABLE recycler.pga_schema (
    schemaname varchar(64),
    schematables text,
    schemalinks text
)
;
--
-- Structure for table pga_scripts (OID = 91852) : 
--
CREATE TABLE recycler.pga_scripts (
    scriptname varchar(64),
    scriptsource text
)
;
--
-- Structure for table pgmreports (OID = 91858) : 
--
CREATE TABLE recycler.pgmreports (
    id serial NOT NULL,
    repalias varchar(100) NOT NULL,
    repname varchar(100) NOT NULL,
    source bytea NOT NULL
)
;
--
-- Structure for table pla_proyecto (OID = 91866) : 
--
CREATE TABLE recycler.pla_proyecto (
    id_proyecto integer NOT NULL,
    id_facultad integer,
    id_programa char(3),
    id_gestion integer,
    id_periodo integer,
    id_docente_dec integer,
    id_docente_dir integer,
    id_docente_resp integer,
    num_alumnos integer,
    num_docentes integer,
    proy_actual text,
    id_tipo_proyecto integer,
    modo_proy integer,
    titulo char(300),
    num_dictamenes integer,
    duracion_proy integer,
    necesidad text,
    resumen text,
    obj_general text,
    obj_especifico text,
    actividades text,
    recursos text,
    costo_idh double precision,
    contraparte double precision,
    costo_total double precision,
    justificacion text,
    aspectos_tecnicos text
)
;
--
-- Structure for table pla_proyecto_costos (OID = 91872) : 
--
CREATE TABLE recycler.pla_proyecto_costos (
    id_proyecto_costos bigint DEFAULT nextval(('"id_proyecto_costos_seq"'::text)::regclass) NOT NULL,
    id_proyecto integer,
    id_gestion smallint,
    id_periodo smallint,
    id_programa char(3),
    conceptos char(120),
    cantidad integer,
    precio_unitario double precision,
    idh double precision,
    recursos_propios double precision,
    costo_total double precision
)
;
ALTER TABLE ONLY recycler.pla_proyecto_costos ALTER COLUMN id_proyecto SET STATISTICS 0;
ALTER TABLE ONLY recycler.pla_proyecto_costos ALTER COLUMN id_gestion SET STATISTICS 0;
ALTER TABLE ONLY recycler.pla_proyecto_costos ALTER COLUMN id_periodo SET STATISTICS 0;
--
-- Structure for table pla_tipo_proyecto (OID = 91876) : 
--
CREATE TABLE recycler.pla_tipo_proyecto (
    id_tipo_proyecto integer NOT NULL,
    nombre_tipo char(20)
)
;
--
-- Structure for table plan_estudio (OID = 91879) : 
--
CREATE TABLE recycler.plan_estudio (
    id_materia serial NOT NULL,
    sigla char(6) NOT NULL,
    materia varchar(100) NOT NULL,
    hrs_teoricas smallint DEFAULT 0,
    hrs_practicas smallint DEFAULT 0,
    creditos smallint DEFAULT 0,
    id_dpto char(3) DEFAULT '1'::bpchar,
    hrs_laboratorio smallint DEFAULT 0,
    id_programa char(3),
    color char(7) DEFAULT '#000000'::bpchar,
    nivel_academico smallint,
    verano char(2),
    grupom char(4) DEFAULT 'XXXX'::bpchar,
    mension integer DEFAULT (0)::bigint,
    control bigint DEFAULT 0
)
;
--
-- Structure for table plan_requisito (OID = 91893) : 
--
CREATE TABLE recycler.plan_requisito (
    id_plan smallint NOT NULL,
    id_programa char(3) NOT NULL,
    corr0 timestamp with time zone DEFAULT '2005-03-09 20:04:59.94268-04'::timestamp with time zone NOT NULL,
    id_gestion smallint,
    id_materia_ant smallint NOT NULL,
    id_materia_eqv smallint NOT NULL,
    nivel_academico smallint,
    tipo char(1),
    ctrlultsem smallint DEFAULT 0,
    mension smallint DEFAULT 0
)
;
--
-- Structure for table planillitaciv (OID = 91899) : 
--
CREATE TABLE recycler.planillitaciv (
    id_matricula integer,
    id_gestion smallint,
    id_periodo smallint,
    id_alumno integer,
    id_materia smallint,
    grupo smallint,
    nota numeric(5,2),
    ult_usuario varchar(10),
    estado char(1),
    observacion varchar,
    nota_2da numeric,
    nota_ex_mesa numeric,
    pparcial numeric,
    sparcial numeric,
    tparcial numeric,
    cparcial numeric,
    promparcial numeric,
    pract numeric,
    prompract numeric,
    lab numeric,
    promlab numeric,
    notapres numeric,
    exfinal numeric,
    promexfinal numeric,
    tipo varchar(1)
)
;
--
-- Structure for table pln_materias_new (OID = 91905) : 
--
CREATE TABLE recycler.pln_materias_new (
    id_materia integer DEFAULT nextval(('"pln_materias1_ne_id_materia_seq"'::text)::regclass) NOT NULL,
    sigla char(6) NOT NULL,
    materia varchar(100) NOT NULL,
    hrs_teoricas smallint DEFAULT 0,
    hrs_practicas smallint DEFAULT 0,
    ciclo integer DEFAULT 0,
    id_dpto char(3) DEFAULT '1'::bpchar,
    hrs_laboratorio smallint DEFAULT 0,
    id_programa char(3),
    color char(7) DEFAULT '#000000'::bpchar,
    nivel_academico smallint,
    verano char(2),
    grupom char(4) DEFAULT 'XXXX'::bpchar,
    mension integer DEFAULT (0)::bigint,
    control bigint DEFAULT 0,
    id_plan integer,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    _requisito text,
    nota_minima smallint DEFAULT 51,
    metodo_paralela integer DEFAULT 1,
    metodo_normal integer DEFAULT 1,
    tiene_viaje_practica boolean DEFAULT false,
    mostrarnotas boolean DEFAULT true
)
;
--
-- Structure for table pln_mensiones (OID = 91927) : 
--
CREATE TABLE recycler.pln_mensiones (
    mension_id integer DEFAULT nextval('pln_mensiones_id_mension_seq'::regclass) NOT NULL,
    mension_desc varchar(80) NOT NULL
)
;
--
-- Structure for table postulante_e (OID = 91932) : 
--
CREATE TABLE recycler.postulante_e (
    id serial NOT NULL,
    clave varchar(32),
    nro_dip varchar(15),
    nombres varchar(25),
    paterno varchar(30),
    materno varchar(30),
    id_programa varchar(6)
)
;
--
-- Structure for table postulantes_antes (OID = 91937) : 
--
CREATE TABLE recycler.postulantes_antes (
    id_alumno serial NOT NULL,
    id_programa char(3) NOT NULL,
    id_ra varchar(10) NOT NULL,
    fec_inscripcion date DEFAULT now(),
    id_plan smallint,
    id_grado char(1) NOT NULL,
    estado char(1) DEFAULT 'P'::bpchar,
    id_calificacion char(1),
    promedio numeric(6,2),
    nro_dip varchar(15),
    examen char(2),
    id_acceso char(1),
    id_periodo smallint,
    id_gestion smallint,
    clave char(5),
    id_programa_a char(3),
    nota integer,
    obs char(1)
)
;
--
-- Structure for table postulantes_requisitos (OID = 91944) : 
--
CREATE TABLE recycler.postulantes_requisitos (
    id_programa char(3),
    id_gestion smallint,
    id_periodo smallint,
    estado char(1),
    requisitos text,
    contenidos text,
    id_ambiente integer,
    id_ambiente2 integer,
    id_ambiente3 integer,
    fecha varchar(10),
    hora varchar(8),
    usuario smallint,
    fecha_hora timestamp(0) with time zone DEFAULT now()
)
;
--
-- Structure for table prs_pais_antiguo (OID = 91951) : 
--
CREATE TABLE recycler.prs_pais_antiguo (
    id_pais integer NOT NULL,
    pais varchar,
    calificacion smallint,
    num_materias smallint
)
;
--
-- Structure for table sangre (OID = 91960) : 
--
CREATE TABLE recycler.sangre (
    nro_dip varchar(16),
    tipo varchar(4),
    id_gestion smallint DEFAULT 2014 NOT NULL,
    id serial NOT NULL
)
;
--
-- Structure for table servidor_publico (OID = 91983) : 
--
CREATE TABLE recycler.servidor_publico (
    ci_per integer NOT NULL,
    item integer,
    memorandum integer,
    id_planilla integer NOT NULL,
    id_dedicacion smallint NOT NULL
)
;
--
-- Structure for table siap_config (OID = 91986) : 
--
CREATE TABLE recycler.siap_config (
    id_config smallint,
    min_nac numeric(10,2),
    gestion smallint,
    estado char(1),
    imp_bono_te numeric(10,2)
)
;
--
-- Structure for table siap_imagenes (OID = 91989) : 
--
CREATE TABLE recycler.siap_imagenes (
    ci_per char(15),
    id_tip_doc integer,
    archivo varchar(100)
)
;
--
-- Structure for table siap_mod_usr (OID = 91992) : 
--
CREATE TABLE recycler.siap_mod_usr (
    id_menu integer,
    id_usuario integer
)
;
--
-- Structure for table siap_modulos (OID = 91995) : 
--
CREATE TABLE recycler.siap_modulos (
    id_menu integer,
    padre integer,
    detalle text,
    enlace text,
    icono text,
    tipo_sistema char(1),
    tipo_modulo varchar(1)
)
;
--
-- Structure for table siap_usuario (OID = 92001) : 
--
CREATE TABLE recycler.siap_usuario (
    id_usuario integer DEFAULT nextval(('"sec_siap_usuario"'::text)::regclass),
    ci_per char(15),
    usuario char(15),
    clave char(32),
    des_usuario varchar,
    priv_sel char(1),
    priv_ins char(1),
    priv_upd char(1),
    priv_del char(1),
    estado char(1)
)
;
--
-- Structure for table silveria (OID = 92008) : 
--
CREATE TABLE recycler.silveria (
    id serial NOT NULL,
    tipo_beca text,
    cod_prg text,
    item text,
    descripcion text,
    ci text,
    nombre_completo text,
    sigla text,
    ultima_matricula text,
    materias_programadas text,
    semestres text
)
;
--
-- Structure for table sox (OID = 92016) : 
--
CREATE TABLE recycler.sox (
    rows bigint
)
;
--
-- Structure for table testing_borrar (OID = 92025) : 
--
CREATE TABLE recycler.testing_borrar (
    a integer NOT NULL,
    b integer
)
;
--
-- Structure for table tit_lugares (OID = 92028) : 
--
CREATE TABLE recycler.tit_lugares (
    lugar_id serial NOT NULL,
    lugar_nombre varchar(50) NOT NULL,
    lugar_direccion varchar(50) NOT NULL,
    lugar_hrio_aten varchar(28),
    lugar_responsable varchar(40) NOT NULL,
    lugar_estado boolean DEFAULT true NOT NULL,
    id_usuario varchar(10),
    lugar_falta timestamp without time zone,
    lugar_lupdate timestamp without time zone
)
;
--
-- Structure for table tit_procesos (OID = 92034) : 
--
CREATE TABLE recycler.tit_procesos (
    proc_id serial NOT NULL,
    proc_desc varchar(80),
    proc_estado boolean NOT NULL,
    resp_id integer NOT NULL,
    dura_id integer NOT NULL,
    lugar_id integer NOT NULL,
    id_usuario varchar(10),
    proc_falta timestamp without time zone,
    proc_lupdate timestamp without time zone
)
;
--
-- Structure for table tit_procesos_duracion (OID = 92037) : 
--
CREATE TABLE recycler.tit_procesos_duracion (
    dura_id serial NOT NULL,
    dura_tiempo double precision NOT NULL,
    dura_unidad varchar(10),
    dura_estado boolean DEFAULT true NOT NULL,
    id_usuario varchar(10),
    dura_falta timestamp without time zone,
    dura_lupdate timestamp without time zone
)
;
--
-- Structure for table tit_procesos_resp (OID = 92045) : 
--
CREATE TABLE recycler.tit_procesos_resp (
    resp_id serial NOT NULL,
    resp_nombre varchar(50),
    resp_estado boolean DEFAULT true NOT NULL,
    id_usuario varchar(10),
    resp_falta timestamp without time zone,
    resp_lupdate timestamp without time zone
)
;
--
-- Structure for table tit_requisitos (OID = 92051) : 
--
CREATE TABLE recycler.tit_requisitos (
    req_id serial NOT NULL,
    req_desc varchar(70),
    req_indispensable boolean,
    req_costo double precision,
    req_estado boolean NOT NULL,
    id_usuario varchar(10),
    req_falta timestamp without time zone,
    req_lupdate timestamp without time zone
)
;
--
-- Structure for table tit_tramites (OID = 92056) : 
--
CREATE TABLE recycler.tit_tramites (
    tram_id serial NOT NULL,
    tram_desc varchar(50),
    tram_estado boolean DEFAULT true NOT NULL,
    id_usuario varchar(10),
    tram_falta timestamp without time zone,
    tram_lupdate timestamp without time zone
)
;
--
-- Structure for table tit_tramites_requisitos (OID = 92060) : 
--
CREATE TABLE recycler.tit_tramites_requisitos (
    tram_id integer NOT NULL,
    req_id integer NOT NULL,
    tram_req_secuencia integer,
    tram_req_estado boolean NOT NULL,
    id_usuario varchar(10),
    tram_req_falta timestamp(0) without time zone,
    tram_req_lupdate timestamp(0) without time zone
)
;
--
-- Structure for table variables_configuracion (OID = 92067) : 
--
CREATE TABLE recycler.variables_configuracion (
    id_variable integer DEFAULT nextval('public._id_variable'::regclass) NOT NULL,
    descripcion varchar(151)[],
    variable varchar(50)[],
    valor char(2)[]
)
;
--
-- Structure for table vs_database_diagrams (OID = 92074) : 
--
CREATE TABLE recycler.vs_database_diagrams (
    name varchar(80),
    diadata text,
    comment varchar(1022),
    preview text,
    lockinfo varchar(80),
    locktime timestamp with time zone,
    version varchar(80)
)
;
--
-- Structure for table listatrabajadores (OID = 92080) : 
--
SET search_path = reservar_campo, pg_catalog;
CREATE TABLE reservar_campo.listatrabajadores (
    id integer DEFAULT nextval('borrarlista_id_seq'::regclass) NOT NULL,
    nombrecompleto varchar,
    ci varchar,
    cargo varchar
)
;
--
-- Structure for table maraton (OID = 92088) : 
--
CREATE TABLE reservar_campo.maraton (
    id serial NOT NULL,
    id_gestion integer,
    descripcion varchar
)
;
--
-- Structure for table maraton_inscripcion (OID = 92096) : 
--
CREATE TABLE reservar_campo.maraton_inscripcion (
    id serial NOT NULL,
    ci varchar,
    id_externo varchar,
    tipo varchar,
    categoria varchar,
    id_maraton integer,
    fecha_registro timestamp without time zone DEFAULT now(),
    estado varchar DEFAULT 'REGISTRADO'::character varying
)
;
--
-- Structure for table programacion_semanal (OID = 92106) : 
--
CREATE TABLE reservar_campo.programacion_semanal (
    fecha date NOT NULL,
    nro_dia integer,
    semana integer,
    estado char(1),
    gestion integer,
    dia integer,
    mes integer,
    id_usuario integer
)
;
--
-- Structure for table reservar_hora (OID = 92109) : 
--
CREATE TABLE reservar_campo.reservar_hora (
    cod_tiempo char(15) NOT NULL,
    nro_registro integer DEFAULT 0 NOT NULL,
    nro_boleta integer DEFAULT 0 NOT NULL,
    cod_fecha date,
    semana integer,
    diasem integer,
    mesanio integer,
    hora integer,
    costohora integer,
    estado char(1),
    gestion integer,
    periodo integer,
    fecha_programa date,
    fecha_reserva date,
    id_usuario integer
)
;
--
-- Structure for table solicitud_reservar_hora (OID = 92114) : 
--
CREATE TABLE reservar_campo.solicitud_reservar_hora (
    nro_registro integer NOT NULL,
    nro_boleta integer,
    tipo_solicitud char(1),
    id_programa char(3),
    id_unidadexterna integer,
    id_facultad integer,
    tipo_uso char(1),
    total_horas integer,
    costo integer,
    pagado char(1),
    gestion integer,
    periodo integer,
    estado char(1),
    fecha_solicitud date,
    hora_solicitud time(0) without time zone,
    fecha_limite date,
    fecha_cancelado date,
    tipo_perso char(1),
    nro_codci varchar(15),
    id_usuario integer
)
;
--
-- Structure for table usuarios_coliseo (OID = 92117) : 
--
CREATE TABLE reservar_campo.usuarios_coliseo (
    nro_codci char(15) NOT NULL,
    nombres varchar(74),
    paterno varchar(65),
    materno varchar(65),
    estado char(1),
    fecha_regis date,
    id_usuario integer
)
;
--
-- Structure for table _bp_accesos (OID = 92120) : 
--
SET search_path = roles, pg_catalog;
CREATE TABLE roles._bp_accesos (
    id_acceso serial NOT NULL,
    id_opcion integer NOT NULL,
    id_rol integer NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer DEFAULT 1 NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _bp_grupos (OID = 92129) : 
--
CREATE TABLE roles._bp_grupos (
    id_grupo serial NOT NULL,
    id_sistema integer,
    grupo text NOT NULL,
    imagen text DEFAULT ''::text,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    orden smallint
)
;
--
-- Structure for table _bp_opciones (OID = 92141) : 
--
CREATE TABLE roles._bp_opciones (
    id_opcion serial NOT NULL,
    id_grupo integer NOT NULL,
    opcion text NOT NULL,
    contenido text DEFAULT ''::text,
    adicional text DEFAULT ''::text,
    orden integer NOT NULL,
    imagen text DEFAULT ''::text,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer DEFAULT 1 NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _bp_personas (OID = 92156) : 
--
CREATE TABLE roles._bp_personas (
    id_persona serial NOT NULL,
    id_estado_civil integer DEFAULT 1 NOT NULL,
    id_archivo_cv integer DEFAULT 1 NOT NULL,
    ci varchar NOT NULL,
    paterno text,
    materno text,
    nombres text NOT NULL,
    direccion text,
    direccion2 text DEFAULT ''::text,
    telefono text DEFAULT ''::text,
    telefono2 text DEFAULT ''::text,
    celular text DEFAULT ''::text,
    itemkey text DEFAULT ''::text,
    correo text DEFAULT ''::text,
    sexo char(1) DEFAULT 'N'::bpchar,
    fec_nacimiento timestamp without time zone,
    fec_ingreso date DEFAULT now() NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer DEFAULT 1 NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _bp_roles (OID = 92178) : 
--
CREATE TABLE roles._bp_roles (
    id_rol serial NOT NULL,
    rol text NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_sistema integer,
    _arwd varchar DEFAULT 'arwd'::character varying NOT NULL
)
;
--
-- Structure for table _bp_roles_usuarios (OID = 92190) : 
--
CREATE TABLE roles._bp_roles_usuarios (
    id serial NOT NULL,
    id_usuario integer DEFAULT 1 NOT NULL,
    id_rol integer DEFAULT 1 NOT NULL,
    fecha date DEFAULT now() NOT NULL,
    id_programa varchar NOT NULL,
    obs varchar,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer DEFAULT 1 NOT NULL,
    _estado varchar(32) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _bp_sistemas (OID = 92205) : 
--
CREATE TABLE roles._bp_sistemas (
    id_sistema integer DEFAULT nextval('_bp_sistemas_id_seq'::regclass) NOT NULL,
    sistema text NOT NULL,
    imagen text DEFAULT ''::text,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _path varchar
)
;
--
-- Structure for table _bp_tipos_calificaciones (OID = 92217) : 
--
CREATE TABLE roles._bp_tipos_calificaciones (
    id_tipo_calificacion serial NOT NULL,
    tipo_calificacion text NOT NULL,
    codigo_tipo_calificacion text NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _bp_ubicaciones_geograficas (OID = 92228) : 
--
CREATE TABLE roles._bp_ubicaciones_geograficas (
    id_ubicacion_geografica serial NOT NULL,
    id_ubicacion_geografica_padre integer,
    codigo_ubicacion_geografica text NOT NULL,
    ubicacion_geografica text NOT NULL,
    nivel integer NOT NULL,
    telefono text DEFAULT ''::text,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _bp_ubicaciones_organicas (OID = 92240) : 
--
CREATE TABLE roles._bp_ubicaciones_organicas (
    id_ubicacion_organica serial NOT NULL,
    id_ubicacion_organica_padre integer,
    id_tipo_calificacion integer NOT NULL,
    codigo_ubicacion_organica text NOT NULL,
    ubicacion_organica text NOT NULL,
    nivel integer NOT NULL,
    sector_economico integer,
    sub_sector_economico integer,
    actividad_economica integer,
    departamento integer,
    provincia integer,
    seccion_municipal integer,
    sisin text,
    pnd text,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _bp_usuarios (OID = 92251) : 
--
CREATE TABLE roles._bp_usuarios (
    id_usuario serial NOT NULL,
    id_persona integer DEFAULT 1 NOT NULL,
    usuario varchar(64) NOT NULL,
    clave varchar(32) NOT NULL,
    controlar_ip char(1) DEFAULT 'S'::bpchar NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer NOT NULL,
    _estado varchar(32) DEFAULT 'A'::bpchar NOT NULL,
    _tipo_usuario varchar(1) DEFAULT 'N'::character varying NOT NULL
)
;
--
-- Structure for table _bp_usuarios_ips (OID = 92261) : 
--
CREATE TABLE roles._bp_usuarios_ips (
    id_usuario_ip serial NOT NULL,
    id_usuario integer NOT NULL,
    ip varchar(16) NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _bp_usuarios_roles (OID = 92269) : 
--
CREATE TABLE roles._bp_usuarios_roles (
    id_usuario_rol serial NOT NULL,
    id_usuario integer NOT NULL,
    id_rol integer NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer DEFAULT 1 NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _crud varchar DEFAULT 'crud'::character varying NOT NULL
)
;
--
-- Structure for table tokens (OID = 92282) : 
--
SET search_path = security, pg_catalog;
CREATE TABLE security.tokens (
    id serial NOT NULL,
    usuario varchar,
    token varchar,
    sistema varchar,
    expiracion timestamp without time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado varchar DEFAULT 'REGISTRADO'::character varying NOT NULL,
    _rtipo varchar DEFAULT 'email'::character varying NOT NULL,
    _number smallint DEFAULT 1 NOT NULL
)
;
--
-- Structure for table administrativos (OID = 92296) : 
--
SET search_path = seguro, pg_catalog;
CREATE TABLE seguro.administrativos (
    ci varchar(100) NOT NULL,
    nombres varchar(200),
    tipo varchar(100)
)
;
--
-- Structure for table listas_estudiantes (OID = 92299) : 
--
CREATE TABLE seguro.listas_estudiantes (
    id serial NOT NULL,
    id_lista bigint,
    id_ra varchar,
    is_seguro boolean DEFAULT false NOT NULL
)
;
--
-- Structure for table listas_generadas (OID = 92308) : 
--
CREATE TABLE seguro.listas_generadas (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    fecha timestamp without time zone DEFAULT now(),
    titulo varchar,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    sede char(1),
    obs text,
    usuario varchar,
    tipo_lista varchar DEFAULT 'SEGURO'::character varying,
    id_control integer
)
;
--
-- Structure for table estudiante (OID = 92318) : 
--
SET search_path = sox, pg_catalog;
CREATE TABLE sox.estudiante (
    a text,
    b text,
    sox serial NOT NULL
)
;
--
-- Structure for table plan (OID = 92326) : 
--
CREATE TABLE sox.plan (
    a text NOT NULL,
    b text,
    c text,
    d text,
    e text,
    f text
)
;
--
-- Structure for table dgo_adm (OID = 92332) : 
--
SET search_path = webcienciaspuras, pg_catalog;
CREATE TABLE webcienciaspuras.dgo_adm (
    idadm serial NOT NULL,
    carreradm varchar(4),
    docid integer,
    nivel integer
)
;
--
-- Structure for table dgo_cole (OID = 92337) : 
--
CREATE TABLE webcienciaspuras.dgo_cole (
    id_cole serial NOT NULL,
    colegio varchar(60) NOT NULL,
    aniobach integer,
    idus integer,
    tipous integer
)
;
--
-- Structure for table dgo_cursos (OID = 92342) : 
--
CREATE TABLE webcienciaspuras.dgo_cursos (
    idcur serial NOT NULL,
    titulobt varchar(70) NOT NULL,
    insticur varchar(60),
    horasacad integer,
    aniocur integer,
    idus integer NOT NULL,
    tipous integer
)
;
--
-- Structure for table dgo_exp (OID = 92347) : 
--
CREATE TABLE webcienciaspuras.dgo_exp (
    idexp serial NOT NULL,
    cargoexp varchar(60) NOT NULL,
    institexp varchar(60),
    fec_ini_dia integer,
    fec_ini_mes integer,
    fec_ini_anio integer,
    fec_fin_dia integer,
    fec_fin_mes integer,
    fec_fin_anio integer,
    idus integer,
    tipous integer
)
;
--
-- Structure for table dgo_fotos (OID = 92352) : 
--
CREATE TABLE webcienciaspuras.dgo_fotos (
    idfoto serial NOT NULL,
    fecha date,
    rutaf varchar(50),
    carrera varchar(5),
    estado varchar(1) DEFAULT 1,
    idus integer NOT NULL
)
;
--
-- Structure for table dgo_hdv (OID = 92358) : 
--
CREATE TABLE webcienciaspuras.dgo_hdv (
    idhdv serial NOT NULL,
    fecha date NOT NULL,
    carrera varchar(3) NOT NULL,
    descripcion text,
    ruta varchar(60),
    estado smallint DEFAULT 1 NOT NULL,
    idus integer NOT NULL,
    tipohdv integer,
    tipous integer
)
;
--
-- Structure for table dgo_idiomas (OID = 92367) : 
--
CREATE TABLE webcienciaspuras.dgo_idiomas (
    idd serial NOT NULL,
    idioma varchar(30),
    idus integer,
    tipus integer,
    habla integer DEFAULT 0,
    escribe integer DEFAULT 0
)
;
ALTER TABLE ONLY webcienciaspuras.dgo_idiomas ALTER COLUMN habla SET STATISTICS 0;
ALTER TABLE ONLY webcienciaspuras.dgo_idiomas ALTER COLUMN escribe SET STATISTICS 0;
--
-- Structure for table dgo_informa (OID = 92374) : 
--
CREATE TABLE webcienciaspuras.dgo_informa (
    idinf serial NOT NULL,
    fecha date NOT NULL,
    titulo varchar(40) NOT NULL,
    descripcion text NOT NULL,
    tipoinf varchar(30) NOT NULL,
    carrera varchar(5) NOT NULL,
    quienus varchar(40) NOT NULL,
    ruta varchar(60),
    prio smallint DEFAULT 0 NOT NULL,
    estado varchar(1) DEFAULT 1 NOT NULL,
    peso varchar(15),
    unidad varchar(5),
    tipo varchar(5),
    idus integer NOT NULL
)
;
--
-- Structure for table dgo_news (OID = 92384) : 
--
CREATE TABLE webcienciaspuras.dgo_news (
    idn serial NOT NULL,
    carreran varchar(4),
    rutan varchar(50),
    titulon varchar(50) NOT NULL,
    descripcionn varchar(150),
    quienuser varchar(50) NOT NULL,
    fecha date,
    tipon varchar(4) NOT NULL,
    pagen varchar(3) NOT NULL
)
;
--
-- Structure for table dgo_noticias (OID = 92389) : 
--
CREATE TABLE webcienciaspuras.dgo_noticias (
    idn serial NOT NULL,
    fecha date NOT NULL,
    titulo varchar(40) NOT NULL,
    descripcion varchar(900) NOT NULL,
    breve varchar(310),
    tipoinf varchar(30) NOT NULL,
    carrera varchar(5) NOT NULL,
    autor varchar(40) NOT NULL,
    rutaimg varchar(60),
    estado varchar(1) DEFAULT 1 NOT NULL,
    idus integer NOT NULL
)
;
--
-- Structure for table dgo_superior (OID = 92398) : 
--
CREATE TABLE webcienciaspuras.dgo_superior (
    idsup serial NOT NULL,
    carreraa varchar(50) NOT NULL,
    instisup varchar(60),
    grado varchar(30),
    aniosup integer,
    idus integer NOT NULL,
    tipous integer
)
;
--
-- Structure for table dgo_userext (OID = 92403) : 
--
CREATE TABLE webcienciaspuras.dgo_userext (
    id_userext serial NOT NULL,
    nombres varchar(25),
    paterno varchar(20),
    materno varchar(20),
    usuario varchar(30) NOT NULL,
    clave varchar(50) NOT NULL,
    ci varchar(10),
    direccion varchar(40),
    telefono varchar(10),
    titulo varchar(40),
    email varchar(40),
    id_programa char(3),
    estado varchar(1) DEFAULT 1 NOT NULL,
    sexo varchar(1),
    fec_nac date,
    nac_pais varchar(20)
)
;
--
-- Structure for table postulante (OID = 8460460) : 
--
SET search_path = agenda_aux, pg_catalog;
CREATE TABLE agenda_aux.postulante (
    ru integer NOT NULL,
    ci varchar(12)
)
;
--
-- Structure for table trabajadorasocial (OID = 8460467) : 
--
CREATE TABLE agenda_aux.trabajadorasocial (
    idtrabajadorasocial serial NOT NULL,
    nombre varchar(100),
    estado char(1) DEFAULT 'A'::bpchar,
    lugar_mesa varchar
)
;
--
-- Structure for table agenda (OID = 8460496) : 
--
CREATE TABLE agenda_aux.agenda (
    idagenda serial NOT NULL,
    fecha date NOT NULL,
    turno varchar(10) NOT NULL,
    idtrabajadorasocial integer NOT NULL,
    ru integer NOT NULL,
    turnointernado varchar(10),
    fechainternado date,
    id_gestion smallint DEFAULT 2018 NOT NULL,
    id_periodo smallint DEFAULT 1::smallint,
    fec_cre_mod timestamp(0) without time zone DEFAULT now()
)
;
--
-- Structure for table reagenda (OID = 8585655) : 
--
CREATE TABLE agenda_aux.reagenda (
    idagenda serial NOT NULL,
    fecha date NOT NULL,
    turno varchar(10) NOT NULL,
    idtrabajadorasocial integer NOT NULL,
    ru integer NOT NULL
)
;
--
-- Structure for table tit_nivel (OID = 8651402) : 
--
SET search_path = dep_titulos, pg_catalog;
CREATE TABLE dep_titulos.tit_nivel (
    id serial NOT NULL,
    descripcion varchar NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table tit_programa_nivel (OID = 8652380) : 
--
CREATE TABLE dep_titulos.tit_programa_nivel (
    id integer DEFAULT nextval('tit_nivel_programa_id_seq'::regclass) NOT NULL,
    id_programa varchar NOT NULL,
    id_nivel integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table lista (OID = 9198380) : 
--
SET search_path = consola_datacenter, pg_catalog;
CREATE TABLE consola_datacenter.lista (
    tipo varchar,
    descripcion varchar,
    carrera varchar,
    ci varchar
)
;
--
-- Structure for table _bp_roles_new (OID = 9226948) : 
--
SET search_path = roles, pg_catalog;
CREATE TABLE roles._bp_roles_new (
    id_rol serial NOT NULL,
    rol text NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id_sistema integer,
    _arwd varchar DEFAULT 'arwd'::character varying NOT NULL
)
;
--
-- Structure for table convocatorias (OID = 9241359) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.convocatorias (
    id smallint,
    fecha date,
    obs text,
    id_gestion smallint,
    id_periodo smallint,
    fec_ini timestamp without time zone,
    fec_fin timestamp without time zone,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    tipo_beca char(1) DEFAULT 'A'::bpchar,
    usr_cre varchar(25),
    fec_cre timestamp(0) without time zone DEFAULT now(),
    ult_mod timestamp(0) without time zone DEFAULT now()
)
;
--
-- Structure for table personal_reporte (OID = 9245596) : 
--
CREATE TABLE balimentacion.personal_reporte (
    nro_dip char(25),
    nro_mes smallint,
    mes varchar,
    cod_prg char(10),
    tipo_beca char(25),
    carrera varchar,
    nombres_apellidos varchar,
    id_alumno integer,
    id_programa char(3),
    id_meses_pago smallint,
    id_gestion integer DEFAULT 2017 NOT NULL,
    id_periodo integer DEFAULT 2 NOT NULL
)
;
--
-- Structure for table estudiantes_2017 (OID = 9245733) : 
--
SET search_path = elecciones, pg_catalog;
CREATE TABLE elecciones.estudiantes_2017 (
    nro integer,
    nro_dip char(25),
    apellidos_nombres varchar,
    id_gestion smallint,
    id_periodo smallint,
    sede char(1),
    id_mesa char(5)
)
;
--
-- Structure for table estudiantes_comparar (OID = 9246081) : 
--
CREATE TABLE elecciones.estudiantes_comparar (
    nro integer,
    nro_dip char(25),
    apellidos_nombres varchar,
    id_gestion smallint,
    id_periodo smallint,
    sede char(1),
    id_mesa char(5)
)
;
--
-- Structure for table cajero_numeracion (OID = 9248762) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.cajero_numeracion (
    id serial NOT NULL,
    usuario varchar,
    num_actual numeric DEFAULT 0,
    num_ini numeric DEFAULT 0,
    num_fin numeric DEFAULT 0,
    id_gestion integer,
    id_periodo integer,
    fec_cre timestamp without time zone DEFAULT now(),
    fec_mod timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table medicina (OID = 9249836) : 
--
SET search_path = consola_datacenter, pg_catalog;
CREATE TABLE consola_datacenter.medicina (
    id integer,
    nro_dip varchar(25),
    nombres varchar,
    nota integer
)
;
--
-- Structure for table edi (OID = 9260017) : 
--
CREATE TABLE consola_datacenter.edi (
    nro_dip char(25),
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    id_materia integer,
    nombres_apellidos varchar,
    sigla varchar,
    id_alumno integer,
    id_matricula integer DEFAULT 0,
    id serial NOT NULL,
    id_programa char(3)
)
;
--
-- Structure for table dct_solicitudes (OID = 18682736) : 
--
SET search_path = solicitudes, pg_catalog;
CREATE TABLE solicitudes.dct_solicitudes (
    id serial NOT NULL,
    fecha_solicitud timestamp without time zone,
    id_programa char(3),
    id_docente integer,
    id_materia integer,
    fecha_inicial timestamp without time zone,
    fecha_final timestamp without time zone,
    obs text,
    estado char(15) DEFAULT 'Solicitado'::bpchar,
    usr_cre char(15)
)
;
--
-- Structure for table alm_desprogramaciones (OID = 18687664) : 
--
CREATE TABLE solicitudes.alm_desprogramaciones (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    id_materia integer,
    id_alumno integer,
    obs text,
    fecha timestamp without time zone,
    usr_cre char(15),
    estado char(15),
    tipo varchar
)
;
--
-- Structure for table prs_cumplidos (OID = 37734988) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.prs_cumplidos (
    id_ra varchar(10) NOT NULL,
    id_requisito smallint NOT NULL,
    cumplido char(1) NOT NULL,
    fec_registro date DEFAULT now() NOT NULL,
    documento varchar(32),
    ult_usuario varchar(64) NOT NULL,
    cn bit(1),
    ci bit(1),
    lcm bit(1),
    cpp bit(1),
    pale bit(1),
    fotos bit(1),
    obs varchar(60),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table periodos (OID = 37813773) : 
--
CREATE TABLE academico.periodos (
    id_periodo integer,
    des_periodo varchar,
    orden smallint,
    tipo char(1)[],
    certificado_des_periodo varchar
)
;
--
-- Structure for table valores (OID = 37824046) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.valores (
    id_cargo varchar(4) NOT NULL,
    cargo varchar NOT NULL,
    estado char(15) DEFAULT 'REGISTRADO'::bpchar,
    precio_unitario numeric(10,2),
    fecha_creacion timestamp(0) without time zone DEFAULT now(),
    usr_cre char(15),
    ip inet,
    obs text
)
;
--
-- Structure for table recaudaciones_detalles (OID = 37825301) : 
--
CREATE TABLE cajas.recaudaciones_detalles (
    id serial NOT NULL,
    id_recaudaciones integer,
    id_cargo varchar(4),
    pre_uni numeric(10,2),
    cantidad numeric(10,2),
    importe numeric(10,2),
    fec_cre timestamp without time zone DEFAULT now(),
    id_examen integer
)
;
--
-- Structure for table alumnos_obs (OID = 37827979) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.alumnos_obs (
    fecha timestamp with time zone,
    id_alumno integer,
    obs text
)
;
--
-- Structure for table observaciones (OID = 37853899) : 
--
CREATE TABLE academico.observaciones (
    id serial NOT NULL,
    id_alumno integer,
    obs text,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table alumnos_certificados (OID = 37854922) : 
--
CREATE TABLE academico.alumnos_certificados (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    certificado text,
    clave varchar,
    estado char(1) DEFAULT 'A'::bpchar,
    fecha timestamp(0) without time zone DEFAULT now()
)
;
--
-- Structure for table alm_programas_edificios (OID = 47610182) : 
--
CREATE TABLE academico.alm_programas_edificios (
    id_edificio smallint,
    edificio varchar
)
;
--
-- Structure for table tramites (OID = 47715015) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.tramites (
    id_tramite integer,
    tramite varchar,
    id_examen integer
)
;
--
-- Structure for table cargos (OID = 47715448) : 
--
CREATE TABLE cajas.cargos (
    id_cargo varchar(4),
    cargo varchar,
    id_examen integer
)
;
--
-- Structure for table tramite_cargos (OID = 47715461) : 
--
CREATE TABLE cajas.tramite_cargos (
    id_tramite_cargos serial NOT NULL,
    id_tramite integer,
    id_cargo integer
)
;
--
-- Structure for table recaudaciones (OID = 47717995) : 
--
CREATE TABLE cajas.recaudaciones (
    id_recaudaciones integer DEFAULT nextval('recaudaciones_id_seq'::regclass) NOT NULL,
    nro_dip char(20),
    descripcion varchar,
    id_programa char(3),
    tipo_transaccion smallint DEFAULT 1,
    importe numeric(10,2),
    usuario char(20),
    fecha timestamp without time zone DEFAULT now(),
    estado char(15) DEFAULT 'REGISTRADO'::bpchar,
    obs text,
    id_modalidad integer,
    id_postulacion integer,
    id_gestion integer,
    id_periodo integer,
    dir_ip cidr DEFAULT inet_client_addr(),
    tipo_pago varchar DEFAULT 'EFECTIVO'::character varying,
    nro_com varchar
)
;
--
-- Structure for table exi (OID = 67276510) : 
--
CREATE TABLE cajas.exi (
    id_exi serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    nombres varchar,
    nro_dip varchar,
    id_grupo integer,
    sigla varchar,
    id_alumno integer,
    estado varchar(1)
)
;
--
-- Structure for table tramites_cargos_carreras (OID = 67279831) : 
--
CREATE TABLE cajas.tramites_cargos_carreras (
    id serial NOT NULL,
    id_tramite integer,
    id_cargo integer,
    id_examen integer,
    id_programa char(3),
    importe numeric,
    fecha_emision timestamp without time zone,
    fecha_caducacion timestamp without time zone,
    usr_cre char(15),
    fec_cre timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table permanencias (OID = 67292388) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.permanencias (
    id_programa char(3),
    id_alumno integer,
    permanencia numeric,
    id_gestion integer DEFAULT 2017 NOT NULL
)
;
--
-- Structure for table carrera_permanencia (OID = 67292638) : 
--
CREATE TABLE estadisticas.carrera_permanencia (
    id_programa char(3),
    id_permanencia numeric,
    cantidad numeric,
    id_gestion integer DEFAULT 2017 NOT NULL
)
;
--
-- Structure for table importar (OID = 85201362) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.importar (
    id serial NOT NULL,
    id_programa char(3),
    nro_dip char(30),
    paterno varchar,
    materno varchar,
    nombres varchar,
    nota integer,
    nota_original numeric,
    tiempo varchar,
    id_modalidad integer DEFAULT 1 NOT NULL,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table bc_postulantes_1 (OID = 85215891) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.bc_postulantes_1 (
    id_alumno integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint,
    fecha date DEFAULT now(),
    tipo_post varchar(2) NOT NULL,
    sit_social real DEFAULT 0.00 NOT NULL,
    sit_acad real DEFAULT 0.00 NOT NULL,
    anios real,
    nivel varchar(3),
    obs text,
    familiar varchar(2) DEFAULT 0,
    economico varchar(2) DEFAULT 0,
    procedencia varchar(2) DEFAULT 0,
    fec_revision date,
    vivienda_familiar varchar(2) DEFAULT 0,
    vivienda_estudiante varchar(2) DEFAULT 0,
    revisado char(1),
    estado char(1),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'R'::bpchar NOT NULL,
    _ip_usuario varchar(32),
    _planilla boolean DEFAULT false NOT NULL,
    _isbeca char(1) DEFAULT 'N'::bpchar NOT NULL,
    tipo_beca varchar DEFAULT 'P'::bpchar NOT NULL,
    obs_old text,
    _2008 numeric(4,2) DEFAULT 0 NOT NULL,
    _2009 numeric(4,2) DEFAULT 0 NOT NULL,
    _2010 numeric(4,2) DEFAULT 0 NOT NULL,
    _2011 numeric(4,2) DEFAULT 0 NOT NULL,
    _2012 numeric(4,2) DEFAULT 0 NOT NULL,
    _2113 numeric(4,2) DEFAULT 0 NOT NULL,
    _2213 numeric(4,2) DEFAULT 0 NOT NULL,
    _2114 numeric(4,2) DEFAULT 0 NOT NULL,
    _2214 numeric(4,2) DEFAULT 0 NOT NULL,
    _anios numeric(10,4) DEFAULT 0 NOT NULL,
    help real,
    help2 real,
    help3 real,
    help4 real,
    help5 real,
    help6 real
)
;
--
-- Structure for table bc_items_becas_new (OID = 85256073) : 
--
CREATE TABLE balimentacion.bc_items_becas_new (
    id_programa char(3) NOT NULL,
    id_items smallint,
    tipo_post char(1) NOT NULL,
    completas smallint DEFAULT 0,
    id_gestion smallint NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _graduacion smallint DEFAULT 0 NOT NULL,
    _ctrl_gestion smallint DEFAULT 2014 NOT NULL,
    _ctrl_periodo smallint DEFAULT 2 NOT NULL,
    cod_prg varchar(16),
    descripcion varchar(64),
    id serial NOT NULL,
    id_padre integer,
    id_items_old smallint DEFAULT 0 NOT NULL,
    _curr_id_gestion integer DEFAULT 2016 NOT NULL,
    _curr_id_periodo integer DEFAULT 1 NOT NULL,
    id_periodo smallint DEFAULT 1 NOT NULL,
    fec_ini_con timestamp(0) without time zone,
    fec_fin_con timestamp(0) without time zone,
    convocatoria smallint DEFAULT (1)::smallint NOT NULL
)
;
--
-- Structure for table importar_bloqueados_med (OID = 85278508) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.importar_bloqueados_med (
    id integer DEFAULT nextval('importar_bloqueados_id_seq'::regclass) NOT NULL,
    nombres varchar,
    nro_dip varchar,
    gestion_ingreso integer,
    obs text,
    id_alumno integer,
    id_programa char(3)
)
;
--
-- Structure for table bc_postulantes_2 (OID = 85284593) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.bc_postulantes_2 (
    id_alumno integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint,
    fecha date DEFAULT now(),
    tipo_post varchar(2) NOT NULL,
    sit_social real DEFAULT 0.00 NOT NULL,
    sit_acad real DEFAULT 0.00 NOT NULL,
    anios real,
    nivel varchar(3),
    obs text,
    familiar varchar(2) DEFAULT 0,
    economico varchar(2) DEFAULT 0,
    procedencia varchar(2) DEFAULT 0,
    fec_revision date,
    vivienda_familiar varchar(2) DEFAULT 0,
    vivienda_estudiante varchar(2) DEFAULT 0,
    revisado char(1),
    estado char(1),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'R'::bpchar NOT NULL,
    _ip_usuario varchar(32),
    _planilla boolean DEFAULT false NOT NULL,
    _isbeca char(1) DEFAULT 'N'::bpchar NOT NULL,
    tipo_beca varchar DEFAULT 'P'::bpchar NOT NULL,
    obs_old text,
    _2008 numeric(4,2) DEFAULT 0 NOT NULL,
    _2009 numeric(4,2) DEFAULT 0 NOT NULL,
    _2010 numeric(4,2) DEFAULT 0 NOT NULL,
    _2011 numeric(4,2) DEFAULT 0 NOT NULL,
    _2012 numeric(4,2) DEFAULT 0 NOT NULL,
    _2113 numeric(4,2) DEFAULT 0 NOT NULL,
    _2213 numeric(4,2) DEFAULT 0 NOT NULL,
    _2114 numeric(4,2) DEFAULT 0 NOT NULL,
    _2214 numeric(4,2) DEFAULT 0 NOT NULL,
    _anios numeric(10,4) DEFAULT 0 NOT NULL,
    help real,
    help2 real,
    help3 real,
    help4 real,
    help5 real,
    help6 real,
    gestion_calificacion smallint,
    periodo_calificacion smallint,
    gestion_evaluacion smallint,
    periodo_evaluacion smallint,
    fecha_calificacion timestamp(0) without time zone,
    estado_beca char(1) DEFAULT 'A'::bpchar,
    nro_convocatoria smallint DEFAULT (1)::smallint
)
;
--
-- Structure for table o_bc_familia_new (OID = 85326057) : 
--
CREATE TABLE balimentacion.o_bc_familia_new (
    ci_uatf varchar(15),
    id_ra varchar(16) NOT NULL,
    paterno varchar(20),
    materno varchar(20),
    nombres varchar(65),
    fech_nac date,
    parentesco varchar(15),
    grado_ins varchar(15),
    estado_civil smallint,
    id_gestion smallint NOT NULL,
    ocupacion varchar(60),
    curso varchar(20),
    establecimiento varchar(65),
    aportador bit(1),
    id_n numeric(2,0) NOT NULL,
    salario numeric(5,0),
    avance numeric(3,0),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    id serial NOT NULL
)
;
--
-- Structure for table bc_postulantes_bck (OID = 85379866) : 
--
CREATE TABLE balimentacion.bc_postulantes_bck (
    id_alumno integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint,
    fecha date DEFAULT now(),
    tipo_post varchar(2) NOT NULL,
    sit_social real DEFAULT 0.00 NOT NULL,
    sit_acad real DEFAULT 0.00 NOT NULL,
    anios real,
    nivel varchar(3),
    obs text,
    familiar varchar(2) DEFAULT 0,
    economico varchar(2) DEFAULT 0,
    procedencia varchar(2) DEFAULT 0,
    fec_revision date,
    vivienda_familiar varchar(2) DEFAULT 0,
    vivienda_estudiante varchar(2) DEFAULT 0,
    revisado char(1),
    estado char(1),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'R'::bpchar NOT NULL,
    _ip_usuario varchar(32),
    _planilla boolean DEFAULT false NOT NULL,
    _isbeca char(1) DEFAULT 'N'::bpchar NOT NULL,
    tipo_beca varchar DEFAULT 'P'::bpchar NOT NULL,
    obs_old text,
    _2008 numeric(4,2) DEFAULT 0 NOT NULL,
    _2009 numeric(4,2) DEFAULT 0 NOT NULL,
    _2010 numeric(4,2) DEFAULT 0 NOT NULL,
    _2011 numeric(4,2) DEFAULT 0 NOT NULL,
    _2012 numeric(4,2) DEFAULT 0 NOT NULL,
    _2113 numeric(4,2) DEFAULT 0 NOT NULL,
    _2213 numeric(4,2) DEFAULT 0 NOT NULL,
    _2114 numeric(4,2) DEFAULT 0 NOT NULL,
    _2214 numeric(4,2) DEFAULT 0 NOT NULL,
    _anios numeric(10,4) DEFAULT 0 NOT NULL,
    help real,
    help2 real,
    help3 real,
    help4 real,
    help5 real,
    help6 real,
    gestion_calificacion smallint,
    periodo_calificacion smallint,
    gestion_evaluacion smallint,
    periodo_evaluacion smallint,
    fecha_calificacion timestamp(0) without time zone,
    estado_beca char(1) DEFAULT 'A'::bpchar,
    nro_convocatoria smallint DEFAULT (1)::smallint,
    id_new_gestion integer DEFAULT 2019
)
;
--
-- Structure for table agenda_personal (OID = 85690794) : 
--
CREATE TABLE balimentacion.agenda_personal (
    id_agenda serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    fec_ini_pro timestamp(0) without time zone DEFAULT now(),
    fec_fin_pro timestamp(0) without time zone DEFAULT now(),
    fecha_creacion timestamp without time zone DEFAULT now(),
    idtrabajadorasocial integer
)
;
--
-- Structure for table titulados (OID = 85770809) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.titulados (
    id_programa char(3),
    nro_dip char(15),
    id_gestion integer DEFAULT 2017 NOT NULL,
    id_alumno integer
)
;
--
-- Structure for table titulados_new (OID = 85776146) : 
--
CREATE TABLE estadisticas.titulados_new (
    id_programa char(3),
    nro_dip char(15),
    id_gestion integer DEFAULT 2017 NOT NULL,
    id_alumno integer,
    permanencia numeric(10,2),
    paterno varchar,
    materno varchar,
    nombres varchar
)
;
--
-- Structure for table apertura_planillas_reposicion (OID = 96085356) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.apertura_planillas_reposicion (
    fecha_apertura date,
    fecha_fin date,
    id serial NOT NULL,
    id_dct_asignacion integer,
    proveido_dsa varchar(40),
    fecha_creacion date DEFAULT now() NOT NULL,
    usuario varchar(25) NOT NULL,
    fecha_impresion_certificado date
)
;
--
-- Structure for table registro_excelencia (OID = 96259772) : 
--
CREATE TABLE academico.registro_excelencia (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    fecha timestamp without time zone,
    obs text,
    estado char(1) DEFAULT 'A'::bpchar
)
;
--
-- Structure for table reposiciones (OID = 96282856) : 
--
CREATE TABLE academico.reposiciones (
    id_reposicion serial NOT NULL,
    fecha timestamp without time zone DEFAULT now(),
    nro_com varchar,
    tipo varchar DEFAULT 'ST'::character varying,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    siglas varchar[],
    nota_anterior integer,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    sigla json,
    otro varchar[][],
    otro2 t_reposiciones[],
    operacion text,
    fecha_impresion timestamp without time zone,
    usuario varchar
)
;
--
-- Structure for table desprogramaciones (OID = 96296925) : 
--
CREATE TABLE academico.desprogramaciones (
    id_desprogramacion serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    id_materia integer,
    fecha_hora timestamp without time zone DEFAULT now(),
    operacion varchar DEFAULT 'CANCELAR'::character varying,
    fecha_hora_operacion timestamp(0) without time zone,
    _usr_operacion varchar,
    estado varchar DEFAULT 'PENDIENTE'::character varying,
    programado_para_fecha timestamp(0) without time zone
)
;
--
-- Structure for table users (OID = 96318593) : 
--
SET search_path = soporte, pg_catalog;
CREATE TABLE soporte.users (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table tipo_eleccion (OID = 96320728) : 
--
SET search_path = elecciones, pg_catalog;
CREATE TABLE elecciones.tipo_eleccion (
    id_tipo_eleccion smallint,
    descripcion_eleccion varchar,
    id_gestion integer,
    id_periodo integer,
    sede varchar(1),
    titulo1 text,
    titulo2 text,
    titulo3 text,
    titulo4 text,
    fecha timestamp without time zone,
    usuario varchar,
    id_programa char(3),
    tipo_eleccion varchar,
    tipo varchar
)
;
--
-- Structure for table estudiantes (OID = 96320822) : 
--
CREATE TABLE elecciones.estudiantes (
    id serial NOT NULL,
    id_ra varchar,
    nro_dip char(25),
    apellidos_nombres varchar,
    id_gestion smallint,
    id_periodo smallint,
    id_sede char(1),
    id_tipo_eleccion smallint DEFAULT (1)::smallint,
    habilitado boolean DEFAULT true NOT NULL,
    fecha timestamp without time zone,
    id_mesa integer
)
;
--
-- Structure for table electores (OID = 96323694) : 
--
CREATE TABLE elecciones.electores (
    id serial NOT NULL,
    id_ra varchar,
    nro_dip char(25),
    apellidos_nombres varchar,
    id_gestion smallint,
    id_periodo smallint,
    id_sede char(1),
    id_tipo_eleccion smallint DEFAULT (1)::smallint,
    habilitado boolean DEFAULT true NOT NULL,
    fecha timestamp without time zone DEFAULT now(),
    id_mesa integer,
    tipo_elector char(1) DEFAULT 'E'::bpchar,
    id_alumno integer,
    ult_prg_mat varchar,
    paterno varchar,
    materno varchar,
    nombres varchar,
    es_docente char(1) DEFAULT 'N'::bpchar NOT NULL,
    adicional char(1) DEFAULT 'N'::bpchar NOT NULL,
    nro_lista integer
)
;
--
-- Structure for table users (OID = 96335564) : 
--
CREATE TABLE elecciones.users (
    id bigint NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table electores_2019_09_16 (OID = 96337178) : 
--
CREATE TABLE elecciones.electores_2019_09_16 (
    id serial NOT NULL,
    id_ra varchar,
    nro_dip char(25),
    apellidos_nombres varchar,
    id_gestion smallint,
    id_periodo smallint,
    id_sede char(1),
    id_tipo_eleccion smallint DEFAULT (1)::smallint,
    habilitado boolean DEFAULT true NOT NULL,
    fecha timestamp without time zone,
    id_mesa integer,
    tipo_elector char(1) DEFAULT 'E'::bpchar
)
;
--
-- Structure for table _votos (OID = 96337242) : 
--
CREATE TABLE elecciones._votos (
    id_voto serial NOT NULL,
    id_mesa integer NOT NULL,
    id_candidato integer,
    candidato_1 integer,
    candidato_2 integer,
    candidato_3 integer,
    blancos integer,
    nulos integer,
    total integer,
    id_tipo_eleccion integer,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL
)
;
--
-- Structure for table _votos_1ra (OID = 117512464) : 
--
CREATE TABLE elecciones._votos_1ra (
    id_voto serial NOT NULL,
    id_mesa integer NOT NULL,
    id_candidato integer,
    candidato_1 integer,
    candidato_2 integer,
    candidato_3 integer,
    blancos integer,
    nulos integer,
    total integer,
    id_tipo_eleccion integer,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL
)
;
--
-- Structure for table cargos_programas_adicional (OID = 117519800) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.cargos_programas_adicional (
    id serial NOT NULL,
    id_modalidad integer[],
    id_programa varchar[],
    id_cargo char(4),
    importe numeric DEFAULT 0,
    id_gestion integer,
    id_periodo integer,
    estado varchar
)
;
--
-- Structure for table dct_asignaciones_detalles (OID = 117520315) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.dct_asignaciones_detalles (
    id_designacion serial NOT NULL,
    id_docente integer,
    id_gestion integer,
    id_periodo integer,
    cargo varchar,
    dedicacion varchar,
    id_programa varchar(3),
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table estudiantes_seguro (OID = 117534829) : 
--
SET search_path = seguro, pg_catalog;
CREATE TABLE seguro.estudiantes_seguro (
    id serial NOT NULL,
    id_alumno integer,
    id_lista integer,
    estado boolean,
    id_ra varchar
)
;
--
-- Structure for table listas_estudiantes_bk (OID = 128139480) : 
--
CREATE TABLE seguro.listas_estudiantes_bk (
    id integer,
    id_lista bigint,
    id_ra varchar,
    is_seguro boolean DEFAULT false NOT NULL
)
;
--
-- Structure for table becas_carreras (OID = 138777825) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.becas_carreras (
    id_programa char(3) NOT NULL,
    id_items smallint,
    tipo_post char(1) NOT NULL,
    completas smallint DEFAULT 0,
    id_gestion smallint NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _graduacion smallint DEFAULT 0 NOT NULL,
    _ctrl_gestion smallint DEFAULT 2014 NOT NULL,
    _ctrl_periodo smallint DEFAULT 2 NOT NULL,
    cod_prg varchar(16),
    descripcion varchar(64),
    id integer NOT NULL,
    id_padre integer,
    id_items_old smallint DEFAULT 0 NOT NULL,
    _curr_id_gestion integer DEFAULT 2016 NOT NULL,
    _curr_id_periodo integer DEFAULT 1 NOT NULL,
    id_periodo smallint DEFAULT 1 NOT NULL,
    fec_ini_con timestamp(0) without time zone,
    fec_fin_con timestamp(0) without time zone,
    convocatoria smallint DEFAULT (1)::smallint NOT NULL
)
;
--
-- Structure for table usuarios_programas (OID = 138805485) : 
--
SET search_path = roles, pg_catalog;
CREATE TABLE roles.usuarios_programas (
    id serial NOT NULL,
    usuario varchar,
    id_programa varchar[],
    id_gestion integer,
    id_periodo integer,
    estado varchar DEFAULT 'VALIDADO'::character varying
)
;
--
-- Structure for table becas (OID = 150077413) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.becas (
    id serial NOT NULL,
    id_programa varchar,
    programa varchar,
    cod_prg varchar,
    item varchar,
    ci varchar,
    personal varchar,
    sigla varchar,
    id_gestion integer,
    id_periodo integer,
    id_alumno integer
)
;
--
-- Structure for table det (OID = 161341034) : 
--
SET search_path = consola_datacenter, pg_catalog;
CREATE TABLE consola_datacenter.det (
    nro_dip char(25),
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    id_materia integer,
    nombres_apellidos varchar,
    sigla varchar,
    id_alumno integer
)
;
--
-- Structure for table mensajes (OID = 171903004) : 
--
SET search_path = msg, pg_catalog;
CREATE TABLE msg.mensajes (
    id serial NOT NULL,
    fecha timestamp without time zone DEFAULT now(),
    usuario varchar(15),
    mensaje text,
    id_programa char(3),
    id_responsable integer DEFAULT 0,
    id_padre integer DEFAULT 0,
    estado varchar DEFAULT 'ACTIVO'::character varying
)
;
--
-- Structure for table responsables (OID = 171903019) : 
--
CREATE TABLE msg.responsables (
    id_responsable serial NOT NULL,
    id_programa char(3),
    responsable varchar,
    para integer
)
;
--
-- Structure for table salas (OID = 171903275) : 
--
SET search_path = preguntas, pg_catalog;
CREATE TABLE preguntas.salas (
    id_sala serial NOT NULL,
    id_alumno integer,
    id_responsable integer DEFAULT 0,
    id_programa char(3),
    estado char(1) DEFAULT 'P'::bpchar,
    f_inicio timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table mensajes (OID = 171903325) : 
--
CREATE TABLE preguntas.mensajes (
    id_mensaje serial NOT NULL,
    texto text,
    f_envio timestamp without time zone DEFAULT now(),
    origen char(1) DEFAULT 'A'::bpchar,
    tipo char(1) DEFAULT 'R'::bpchar,
    id_sala integer
)
;
--
-- Structure for table solicitudes (OID = 171903464) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.solicitudes (
    id serial NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_alumno integer NOT NULL,
    clave varchar(10),
    fecha date DEFAULT now() NOT NULL,
    estado varchar(15) DEFAULT 'Solicitud'::character varying NOT NULL,
    carrera smallint,
    programacion char(1),
    tramite varchar(64) DEFAULT 'N'::bpchar NOT NULL,
    obs text DEFAULT ''::text,
    tipo char(1),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _ip_usuario varchar DEFAULT inet_server_addr(),
    tipo_verificado varchar(20),
    fec_cre timestamp without time zone DEFAULT now() NOT NULL,
    usr_solicitud varchar(15) NOT NULL,
    fec_solicitud timestamp without time zone DEFAULT now(),
    usr_pago varchar(15),
    fec_pago timestamp without time zone,
    usr_verificacion varchar(15),
    fec_verificacion timestamp without time zone,
    usr_impresion varchar(15),
    fec_impresion timestamp without time zone
)
;
--
-- Structure for table valores_detalles (OID = 171903524) : 
--
CREATE TABLE matriculas.valores_detalles (
    id integer DEFAULT nextval('cajas_transacciones_id_seq'::regclass) NOT NULL,
    id_ra varchar(10),
    id_alumno integer,
    id_gestion smallint,
    id_periodo smallint,
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
    nro_factura integer,
    alfanumerico varchar(10),
    a_nombre_de varchar(50),
    nit_factura varchar(10),
    id_trans integer,
    _id_usuario varchar(64),
    _fec_guia date,
    num_control varchar DEFAULT '-'::character varying
)
;
--
-- Structure for table valores (OID = 171903537) : 
--
CREATE TABLE matriculas.valores (
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
    id_caja_tran integer,
    id_valores serial NOT NULL
)
;
--
-- Structure for table telefonos (OID = 171906031) : 
--
SET search_path = preguntas, pg_catalog;
CREATE TABLE preguntas.telefonos (
    id_telefono serial NOT NULL,
    id_alumno integer,
    nro_telefono varchar,
    empresa varchar,
    operacion varchar
)
;
--
-- Structure for table migrations (OID = 171906174) : 
--
CREATE TABLE preguntas.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table users (OID = 171906182) : 
--
CREATE TABLE preguntas.users (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table password_resets (OID = 171906193) : 
--
CREATE TABLE preguntas.password_resets (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone
)
;
--
-- Structure for table failed_jobs (OID = 171906202) : 
--
CREATE TABLE preguntas.failed_jobs (
    id bigserial NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table costos (OID = 171927477) : 
--
CREATE TABLE preguntas.costos (
    id serial NOT NULL,
    id_carrera varchar,
    costo integer,
    tipo varchar DEFAULT 'PN'::character varying
)
;
--
-- Structure for table tramites (OID = 171927590) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.tramites (
    id integer,
    id_cargo integer,
    id_concepto integer,
    importe numeric,
    id_programa varchar(3),
    tipo varchar(2)
)
;
--
-- Structure for table pre_matriculas (OID = 171928185) : 
--
CREATE TABLE matriculas.pre_matriculas (
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    tipo varchar DEFAULT 'REGULAR'::character varying,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    clave varchar,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table exp_auxiliares (OID = 183099200) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE TABLE auxiliares.exp_auxiliares (
    id serial NOT NULL,
    cod_prg varchar,
    cat_des varchar,
    rep integer,
    ci varchar,
    paterno varchar,
    materno varchar,
    nombres varchar,
    sigla_dec varchar,
    id_alumno integer,
    id_programa varchar,
    detalle varchar,
    id_materia integer,
    sigla varchar,
    materia varchar,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer
)
;
--
-- Structure for table p1 (OID = 183102161) : 
--
SET search_path = sox, pg_catalog;
CREATE TABLE sox.p1 (
    id varchar,
    des varchar,
    abc varchar
)
;
--
-- Structure for table p2 (OID = 183102167) : 
--
CREATE TABLE sox.p2 (
    id_p1 varchar,
    id varchar,
    des varchar(1)
)
;
--
-- Structure for table p3 (OID = 183102197) : 
--
CREATE TABLE sox.p3 (
    id_p2 varchar,
    online smallint
)
;
--
-- Structure for table tipo_documento (OID = 183102614) : 
--
SET search_path = kardex, pg_catalog;
CREATE TABLE kardex.tipo_documento (
    id serial NOT NULL,
    documento varchar,
    tipo_sistema integer,
    estado varchar DEFAULT 'ACTIVO'::character varying
)
;
--
-- Structure for table imagenes (OID = 183102658) : 
--
CREATE TABLE kardex.imagenes (
    id serial NOT NULL,
    id_tipo_documento integer,
    id_alumno integer,
    img bytea,
    estado varchar(12) DEFAULT 'SOLICITADO'::character varying,
    usr_cre varchar,
    fec_cre timestamp without time zone DEFAULT now(),
    usr_ver varchar,
    fec_ver timestamp(1) without time zone,
    tipo_file varchar(3),
    obs varchar DEFAULT ''::character varying,
    id_tramites integer
)
;
--
-- Structure for table tramites (OID = 183103598) : 
--
CREATE TABLE kardex.tramites (
    id serial NOT NULL,
    id_alumno integer,
    usr_cre varchar,
    fec_cre timestamp without time zone DEFAULT now(),
    obs varchar
)
;
--
-- Structure for table tipo_matricula (OID = 183103916) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.tipo_matricula (
    id integer,
    id_tipo_matricula varchar(3),
    tipo_matricula varchar
)
;
--
-- Structure for table users (OID = 183103938) : 
--
SET search_path = kardex, pg_catalog;
CREATE TABLE kardex.users (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    username varchar(255),
    cargo varchar(50),
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table password_resets (OID = 183103951) : 
--
CREATE TABLE kardex.password_resets (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone
)
;
--
-- Structure for table failed_jobs (OID = 183103960) : 
--
CREATE TABLE kardex.failed_jobs (
    id bigserial NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table apertura_cierre (OID = 183123534) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.apertura_cierre (
    id serial NOT NULL,
    fecha date,
    usr_cre varchar,
    fec_cre timestamp without time zone DEFAULT now(),
    ip inet,
    estado varchar DEFAULT 'ABIERTO'::character varying,
    tipo varchar(1) DEFAULT 'MATRICULA'::character varying
)
;
--
-- Structure for table parametroinv (OID = 205447359) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.parametroinv (
    id serial NOT NULL,
    cod varchar,
    parametro varchar,
    estado varchar,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    deleted_at timestamp without time zone
)
;
--
-- Structure for table invsocial (OID = 205450080) : 
--
CREATE TABLE balimentacion.invsocial (
    id serial NOT NULL,
    id_alumno varchar(10),
    id_gestion smallint,
    id_trabsocial integer,
    sugerencia boolean,
    level smallint,
    cod varchar(100),
    motivo varchar,
    id_career char(3),
    eldated_at timestamp without time zone,
    updated_at timestamp without time zone,
    created_at timestamp without time zone,
    conclusion varchar
)
;
--
-- Structure for table detalleinv (OID = 205450093) : 
--
CREATE TABLE balimentacion.detalleinv (
    id serial NOT NULL,
    text varchar,
    id_parametro integer,
    id_invsocial integer,
    state boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)
;
--
-- Structure for table valores_cargos (OID = 205472575) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.valores_cargos (
    id_cargo varchar(4) NOT NULL,
    formulario char(3),
    estado char(2),
    id_gestion smallint,
    id_periodo smallint DEFAULT 1 NOT NULL,
    tipo_matricula char(2) DEFAULT 'ER'::bpchar NOT NULL,
    id_programa char(3)[],
    tipo_matricula_ varchar(4)[]
)
;
--
-- Structure for table agenda (OID = 216867524) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.agenda (
    id_agenda serial NOT NULL,
    id_postulante integer,
    id_caja integer,
    horario varchar,
    fecha date,
    id_gestion integer,
    id_periodo integer,
    _creado timestamp without time zone DEFAULT now(),
    id_horario integer,
    tipo_agenda varchar
)
;
--
-- Structure for table cajeros (OID = 216867650) : 
--
CREATE TABLE postulantes.cajeros (
    id_caja integer,
    cajero varchar,
    estado char(1),
    cant_hora integer,
    detallado varchar
)
;
--
-- Structure for table horarios (OID = 216867739) : 
--
CREATE TABLE postulantes.horarios (
    id_horario integer,
    horarios varchar,
    cantidad_maxima integer
)
;
--
-- Structure for table val_tra_dia (OID = 216869661) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.val_tra_dia (
    id_dia integer,
    id_tran integer NOT NULL,
    cod_val char(10),
    can_val numeric(8,0),
    pre_uni numeric(10,2),
    imp_val numeric(10,2),
    desde integer DEFAULT 0,
    hasta integer DEFAULT 0,
    fec_tra date,
    usr_cre varchar(15),
    fec_cre timestamp with time zone DEFAULT now(),
    nro_com char(20) DEFAULT ''::bpchar,
    ci_per varchar,
    des_per varchar(80),
    obs text,
    tip_tra smallint DEFAULT 0,
    tra_imp smallint DEFAULT 0,
    id_gestion smallint,
    tra_ver smallint DEFAULT 0,
    id_periodo integer,
    id serial NOT NULL,
    obs_matriculacion text,
    _id_gestion_matricula integer,
    _id_periodo_matricula integer,
    estado_matricula varchar DEFAULT 'PENDIENTE'::character varying,
    fecha timestamp(0) without time zone DEFAULT now(),
    id_materia integer,
    id_grupo integer,
    estado varchar DEFAULT 'PENDIENTE'::character varying NOT NULL
)
;
--
-- Structure for table val_tran_det (OID = 216869681) : 
--
CREATE TABLE cajas.val_tran_det (
    id_tran_det integer DEFAULT nextval(('"caja"."val_tran_det_id_tran_det_seq"'::text)::regclass) NOT NULL,
    id_tran integer,
    cod_val char(5) NOT NULL,
    can_val integer,
    pre_uni numeric(10,2) NOT NULL,
    imp_val numeric(10,2) NOT NULL,
    desde integer DEFAULT 0,
    hasta integer DEFAULT 0
)
;
--
-- Structure for table docentes_sau (OID = 216889850) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.docentes_sau (
    id serial NOT NULL,
    id_docente integer,
    id_gestion integer,
    id_periodo integer,
    id_modalidad integer,
    id_grupo integer
)
;
--
-- Structure for table materias (OID = 216901406) : 
--
CREATE TABLE postulantes.materias (
    id_materia serial NOT NULL,
    sigla char(15),
    materia varchar,
    id_programa char(3)[],
    id_gestion integer,
    id_periodo integer,
    id_modalidad integer,
    id_grupo integer
)
;
--
-- Structure for table sau_programaciones (OID = 216913073) : 
--
CREATE TABLE postulantes.sau_programaciones (
    id serial NOT NULL,
    id_materia integer,
    nro_dip varchar,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    id_modalidad integer,
    ult_usuario varchar
)
;
--
-- Structure for table preguntas (OID = 228288504) : 
--
SET search_path = encuestas, pg_catalog;
CREATE TABLE encuestas.preguntas (
    id serial NOT NULL,
    pregunta text,
    tipo varchar,
    tipo_usuario varchar DEFAULT 'AUXILIAR'::character varying,
    nro integer,
    habilitado varchar(1) DEFAULT 'S'::character varying
)
;
--
-- Structure for table respuestas (OID = 228288513) : 
--
CREATE TABLE encuestas.respuestas (
    id serial NOT NULL,
    id_pregunta integer,
    respuesta text,
    tipo varchar,
    v1 varchar,
    v2 varchar
)
;
--
-- Structure for table encuestado_respuesta (OID = 228288522) : 
--
CREATE TABLE encuestas.encuestado_respuesta (
    id serial NOT NULL,
    usuario varchar,
    id_respuesta integer,
    respuesta text,
    fecha timestamp(0) without time zone DEFAULT now(),
    tipo_usuario varchar DEFAULT 'AUXILIAR'::character varying,
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer
)
;
--
-- Structure for table tipo_beca (OID = 228308342) : 
--
SET search_path = becas, pg_catalog;
CREATE TABLE becas.tipo_beca (
    id serial NOT NULL,
    descripcion_beca varchar,
    estado char(1)
)
;
--
-- Structure for table postulantes (OID = 228308356) : 
--
CREATE TABLE becas.postulantes (
    id serial NOT NULL,
    id_alumno integer,
    id_tipo_beca integer,
    fecha timestamp without time zone,
    fecha_recepcion timestamp without time zone,
    fojas integer,
    id_gestion integer,
    id_periodo integer,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    usuario_recepcion varchar
)
;
--
-- Structure for table comissions (OID = 228322676) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.comissions (
    id bigserial NOT NULL,
    gestion integer NOT NULL,
    programa_id varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    id_dictamen integer,
    periodo integer,
    tipo_comision varchar
)
;
--
-- Structure for table miembros (OID = 228322705) : 
--
CREATE TABLE balimentacion.miembros (
    id bigint DEFAULT nextval('dicts_comissions_id_seq'::regclass) NOT NULL,
    tipo varchar(255) NOT NULL,
    comission_id integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    nro_dip varchar,
    cargo varchar
)
;
--
-- Structure for table calificacion_grupos (OID = 228322728) : 
--
CREATE TABLE balimentacion.calificacion_grupos (
    id bigint DEFAULT nextval('parameters_califs_id_seq'::regclass) NOT NULL,
    parameter varchar(255) NOT NULL,
    cod varchar(255) NOT NULL,
    deleted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    estado varchar DEFAULT 'ACTIVO'::character varying NOT NULL
)
;
--
-- Structure for table informs_alims (OID = 228322755) : 
--
CREATE TABLE balimentacion.informs_alims (
    id bigserial NOT NULL,
    motive varchar(255) NOT NULL,
    level integer NOT NULL,
    dictum_id integer,
    comission_id integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
)
;
--
-- Structure for table becas_personal (OID = 228387662) : 
--
SET search_path = becas, pg_catalog;
CREATE TABLE becas.becas_personal (
    id serial NOT NULL,
    tipo_beca varchar,
    id_programa varchar,
    carrera varchar,
    cod_prg varchar,
    nro_dip varchar,
    nombres_apellidos varchar,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table restringir (OID = 228403057) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.restringir (
    id serial NOT NULL,
    nro_dip varchar,
    id_alumno integer,
    paterno varchar,
    materno varchar,
    nombres varchar,
    sexo char(1),
    tipo char(1),
    obs varchar,
    fec_ingreso integer,
    cant_matri integer,
    _2021 varchar,
    id_gestion integer,
    id_periodo integer,
    estado varchar DEFAULT 'BLOQUEADO'::character varying NOT NULL
)
;
--
-- Structure for table mat_apoyo (OID = 228600970) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE TABLE auxiliares.mat_apoyo (
    id serial NOT NULL,
    id_programa_origen varchar,
    id_materia_origen integer,
    sigla_origen varchar,
    materia_origen varchar,
    id_programa_apoy varchar,
    id_materia_apoy integer,
    sigla_apoy varchar,
    materia_apoy varchar,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table presitemalims (OID = 228621920) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.presitemalims (
    id bigserial NOT NULL,
    "montoTot" varchar(255) NOT NULL,
    "montoPar" varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table items_alims (OID = 228621931) : 
--
CREATE TABLE balimentacion.items_alims (
    id bigserial NOT NULL,
    "cantTot" integer NOT NULL,
    "cantPar" integer NOT NULL,
    age integer NOT NULL,
    type varchar(255) NOT NULL,
    programa_id varchar(255) NOT NULL,
    "presItemAlim_id" integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table exa_mesa (OID = 228676690) : 
--
SET search_path = sis_kardex, pg_catalog;
CREATE TABLE sis_kardex.exa_mesa (
    id serial NOT NULL,
    ru varchar,
    sigla varchar,
    mat_codigo integer,
    id_gestion integer DEFAULT 2021 NOT NULL,
    id_periodo integer DEFAULT 1 NOT NULL,
    id_grupo integer DEFAULT 1 NOT NULL,
    id_programa varchar DEFAULT 'ELE'::character varying NOT NULL
)
;
--
-- Structure for table exa_mesa_nombres (OID = 228709552) : 
--
CREATE TABLE sis_kardex.exa_mesa_nombres (
    id serial NOT NULL,
    apellidos varchar(100),
    nombres varchar(100),
    sigla varchar(20)
)
;
ALTER TABLE ONLY sis_kardex.exa_mesa_nombres ALTER COLUMN nombres SET STATISTICS 0;
ALTER TABLE ONLY sis_kardex.exa_mesa_nombres ALTER COLUMN sigla SET STATISTICS 0;
--
-- Structure for table note_postulante (OID = 228756396) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.note_postulante (
    id bigserial NOT NULL,
    isbeca varchar(255) NOT NULL,
    obs text,
    sit_social double precision NOT NULL,
    sit_acad double precision NOT NULL,
    invest_soc boolean,
    inform_alim_id integer,
    bc_postulantes_id integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table califs (OID = 228756417) : 
--
CREATE TABLE balimentacion.califs (
    id bigserial NOT NULL,
    description_calif_id integer NOT NULL,
    note_postulante_id integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table cuentas_bancarias (OID = 240633555) : 
--
SET search_path = becas, pg_catalog;
CREATE TABLE becas.cuentas_bancarias (
    id serial NOT NULL,
    id_alumno integer NOT NULL,
    nro_cuenta varchar NOT NULL,
    id_gestion integer,
    id_periodo integer,
    id_banco integer,
    id_beca integer,
    estado varchar(20) DEFAULT 'PENDIENTE'::character varying,
    f_verificado timestamp(0) without time zone,
    fecha_creacion timestamp without time zone DEFAULT now(),
    observacion varchar
)
;
--
-- Structure for table bancos (OID = 240633565) : 
--
CREATE TABLE becas.bancos (
    id_banco integer,
    nombre_banco varchar,
    direccion varchar,
    sigla varchar,
    estado char(1)
)
;
--
-- Structure for table programacion (OID = 240702347) : 
--
SET search_path = jobs, pg_catalog;
CREATE TABLE jobs.programacion (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    estado varchar,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table migrations (OID = 240750787) : 
--
SET search_path = seguro, pg_catalog;
CREATE TABLE seguro.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table users (OID = 240750795) : 
--
CREATE TABLE seguro.users (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table password_resets (OID = 240750806) : 
--
CREATE TABLE seguro.password_resets (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone
)
;
--
-- Structure for table oauth_auth_codes (OID = 240750813) : 
--
CREATE TABLE seguro.oauth_auth_codes (
    id varchar(100) NOT NULL,
    user_id bigint NOT NULL,
    client_id bigint NOT NULL,
    scopes text,
    revoked boolean NOT NULL,
    expires_at timestamp(0) without time zone
)
;
--
-- Structure for table oauth_access_tokens (OID = 240750822) : 
--
CREATE TABLE seguro.oauth_access_tokens (
    id varchar(100) NOT NULL,
    user_id bigint,
    client_id bigint NOT NULL,
    name varchar(255),
    scopes text,
    revoked boolean NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone
)
;
--
-- Structure for table oauth_refresh_tokens (OID = 240750831) : 
--
CREATE TABLE seguro.oauth_refresh_tokens (
    id varchar(100) NOT NULL,
    access_token_id varchar(100) NOT NULL,
    revoked boolean NOT NULL,
    expires_at timestamp(0) without time zone
)
;
--
-- Structure for table oauth_clients (OID = 240750839) : 
--
CREATE TABLE seguro.oauth_clients (
    id bigserial NOT NULL,
    user_id bigint,
    name varchar(255) NOT NULL,
    secret varchar(100),
    provider varchar(255),
    redirect text NOT NULL,
    personal_access_client boolean NOT NULL,
    password_client boolean NOT NULL,
    revoked boolean NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table oauth_personal_access_clients (OID = 240750851) : 
--
CREATE TABLE seguro.oauth_personal_access_clients (
    id bigserial NOT NULL,
    client_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table failed_jobs (OID = 240750859) : 
--
CREATE TABLE seguro.failed_jobs (
    id bigserial NOT NULL,
    uuid varchar(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table projects (OID = 240750873) : 
--
CREATE TABLE seguro.projects (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    description text NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table ic_convocatorias (OID = 240765856) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.ic_convocatorias (
    id bigserial NOT NULL,
    age integer NOT NULL,
    state boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table calls_convs (OID = 240765865) : 
--
CREATE TABLE balimentacion.calls_convs (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    slug varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table details_conv (OID = 240765876) : 
--
CREATE TABLE balimentacion.details_conv (
    id bigserial NOT NULL,
    init date NOT NULL,
    "end" date NOT NULL,
    type varchar(255) NOT NULL,
    career_id varchar(255),
    convocatorias_id bigint NOT NULL,
    calls_convs_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table exceptional_conv (OID = 240767036) : 
--
CREATE TABLE balimentacion.exceptional_conv (
    id bigserial NOT NULL,
    init timestamp(0) without time zone NOT NULL,
    "end" timestamp(0) without time zone NOT NULL,
    motive varchar(255) NOT NULL,
    alumno_id integer NOT NULL,
    details_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table busquedas_idx (OID = 240768434) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.busquedas_idx (
    nro_dip varchar,
    id_alumno integer,
    idx tsvector
)
;
--
-- Structure for table datos_generales (OID = 240773098) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.datos_generales (
    id serial NOT NULL,
    id_programa char(3),
    id_gestion integer,
    id_periodo integer,
    fecha timestamp without time zone,
    estudiantes_matriculados numeric,
    docentes_designados numeric,
    docentes_tiempo_completo numeric,
    docentes_titulares numeric,
    docentes_maestria numeric,
    docentes_doctorado numeric,
    estudiantes_auxiliares integer,
    computadoras_adquiridas integer,
    metros_cuadrados_construidos integer,
    asignaturas_abandonadas integer,
    asignaturas_programadas integer,
    asignaturas_reprobadas integer,
    promedio_calificacion numeric,
    proporcion_estudiantes_titulados numeric,
    estudiantes_titulados integer,
    estudiantes_nuevos integer,
    docentes_grado integer,
    estado varchar DEFAULT 'SOLICTIADO'::character varying
)
;
--
-- Structure for table aux_2021 (OID = 240817447) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE TABLE auxiliares.aux_2021 (
    id serial NOT NULL,
    id_programa varchar,
    programa varchar,
    item varchar,
    nro_dip varchar,
    apellidos_nombres varchar,
    sigla varchar,
    materia varchar,
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    id_alumno integer
)
;
--
-- Structure for table verificar_programaciones (OID = 240818541) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.verificar_programaciones (
    nro_dip varchar,
    apellidos_nombres varchar,
    id_alumno integer,
    nro_materias_programadas integer,
    maerias_programadas text
)
;
--
-- Structure for table verificar_datos (OID = 240818588) : 
--
CREATE TABLE balimentacion.verificar_datos (
    nro integer,
    nro_dip varchar,
    id_alumno integer,
    nombres_apellidos varchar,
    programa varchar,
    sit_social numeric,
    sit_academica numeric,
    total numeric,
    obs varchar,
    revisado varchar,
    fecha_cancelacion date,
    nro_mat_prg integer,
    mat_prg text
)
;
--
-- Structure for table desprogramados (OID = 252738188) : 
--
SET search_path = planillas, pg_catalog;
CREATE TABLE planillas.desprogramados (
    id serial NOT NULL,
    id_alumno integer,
    id_materia integer[],
    id_gestion integer,
    id_periodo integer,
    tipo varchar DEFAULT 'BLOQUEADO'::character varying,
    fecha timestamp without time zone DEFAULT now(),
    usuario varchar
)
;
--
-- Structure for table estudiantes (OID = 252769627) : 
--
SET search_path = extension, pg_catalog;
CREATE TABLE extension.estudiantes (
    id serial NOT NULL,
    nro_dip varchar,
    id_ra varchar,
    usuario_confirmacion varchar,
    fecha_confirmacion timestamp without time zone,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    nro_com_pago varchar,
    confirmar_postulacion varchar,
    matricular_carrera varchar,
    fecha_matricula timestamp without time zone,
    usuario varchar,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table planificacion_postulantes (OID = 252770777) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.planificacion_postulantes (
    id serial NOT NULL,
    id_programa varchar,
    id_gestion integer,
    id_periodo integer,
    estado varchar,
    fecha timestamp without time zone DEFAULT now(),
    usuario varchar
)
;
--
-- Structure for table control_recepcion (OID = 252794101) : 
--
SET search_path = planillas, pg_catalog;
CREATE TABLE planillas.control_recepcion (
    id serial NOT NULL,
    id_programa varchar(3),
    tipo_planilla varchar DEFAULT 'CARRERA'::character varying,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    nro_hojas integer DEFAULT 0,
    nro_planillas integer DEFAULT 0,
    usuario_recepcion varchar,
    estado_recepcion varchar DEFAULT 'RECEPCIONADO'::character varying,
    obs_recepcion text,
    fecha_recepcion timestamp without time zone DEFAULT now(),
    validar varchar DEFAULT 'NO'::character varying,
    estado_validacion varchar DEFAULT 'RECEPCIONADO'::character varying,
    usuario_validacion varchar,
    obs_validacion text,
    fecha_validacion timestamp without time zone,
    programacion_automatica varchar DEFAULT 'NO'::character varying,
    usuario_programacion_automatica varchar,
    estado_programacion_automatica varchar DEFAULT 'PENDIENTE'::character varying,
    obs_programacion_automatica text,
    fecha_programacion_automatica timestamp without time zone,
    id_gestion_programacion integer,
    id_periodo_programacion integer,
    actualizar_kardex varchar DEFAULT 'NO'::character varying,
    usuario_actualizar_kardex varchar,
    estado_actualizar_kardex varchar DEFAULT 'PENDIENTE'::character varying,
    obs_actualizar_kardex text,
    fecha_actualizar_kardex timestamp without time zone,
    estado_impresion varchar DEFAULT 'PENDIENTE'::character varying,
    fecha_impresion timestamp without time zone DEFAULT now(),
    fecha_entrega timestamp without time zone,
    obs_entrega text,
    fecha_inicio_programacion timestamp without time zone DEFAULT now(),
    archivo_impreso bytea,
    id_dct_asignaciones integer[],
    certificado_notas varchar DEFAULT 'NO'::character varying,
    usuario_certificado_notas varchar,
    estado_certificado_notas varchar DEFAULT 'SOLICITADO'::character varying,
    fecha_certificado_notas timestamp without time zone,
    obs_certificado_notas text,
    descripcion varchar DEFAULT ''::character varying,
    id_alm_programas_parametros integer,
    cant_certificados integer,
    id_programas_parametros integer
)
;
--
-- Structure for table grupos_programacion (OID = 252814658) : 
--
SET search_path = consola, pg_catalog;
CREATE TABLE consola.grupos_programacion (
    id serial NOT NULL,
    id_programa varchar,
    id_gestion integer,
    id_periodo integer,
    cantidad_grupos integer DEFAULT 1,
    grupos json
)
;
--
-- Structure for table grupos (OID = 252814921) : 
--
CREATE TABLE consola.grupos (
    id_grupo integer,
    desde varchar,
    hasta varchar
)
;
--
-- Structure for table exq (OID = 252906896) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.exq (
    id serial NOT NULL,
    nro integer,
    nombres varchar,
    nro_dip varchar,
    telefono varchar,
    costo numeric,
    sigla varchar,
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    tipo char(15),
    id_alumno integer,
    estado varchar(1),
    id_programa char(3) NOT NULL
)
;
--
-- Structure for table offices (OID = 252913902) : 
--
SET search_path = hermes, pg_catalog;
CREATE TABLE hermes.offices (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    description varchar(255) NOT NULL,
    slug varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp without time zone
)
;
--
-- Structure for table correspondences (OID = 252913913) : 
--
CREATE TABLE hermes.correspondences (
    id bigserial NOT NULL,
    register varchar(255),
    type varchar(255) NOT NULL,
    cite varchar(255) NOT NULL,
    "dateCorresp" date NOT NULL,
    "senderOffice_id" bigint NOT NULL,
    "senderPerson" varchar(255) NOT NULL,
    "senderPost" varchar(255) NOT NULL,
    "receiverOffice_id" bigint NOT NULL,
    "receiverPerson" varchar(255) NOT NULL,
    reference varchar(255) NOT NULL,
    level varchar(255) NOT NULL,
    annexed varchar(255),
    "registerUser" bigint NOT NULL,
    "receiverUser" bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    "receiverPost" varchar
)
;
--
-- Structure for table derives (OID = 252913944) : 
--
CREATE TABLE hermes.derives (
    id bigserial NOT NULL,
    level varchar(255) NOT NULL,
    "receiverOffice_id" bigint NOT NULL,
    "receiverPerson" varchar(255) NOT NULL,
    derive varchar(255) NOT NULL,
    observation varchar(255) NOT NULL,
    "registerUser" bigint NOT NULL,
    "receiverUser" bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    datederive date
)
;
--
-- Structure for table user_offices (OID = 252913970) : 
--
CREATE TABLE hermes.user_offices (
    id bigserial NOT NULL,
    user_id bigint NOT NULL,
    office_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table derive_derives (OID = 252914014) : 
--
CREATE TABLE hermes.derive_derives (
    derive_id bigint
)
INHERITS (hermes.derives)
;
--
-- Structure for table corresp_derives (OID = 252914026) : 
--
CREATE TABLE hermes.corresp_derives (
    correspondence_id bigint,
    datederive date
)
INHERITS (hermes.derives)
;
--
-- Structure for table _solicitudes (OID = 252931091) : 
--
SET search_path = solicitudes, pg_catalog;
CREATE TABLE solicitudes._solicitudes (
    id serial NOT NULL,
    id_programa varchar,
    fecha timestamp without time zone DEFAULT now(),
    obs text,
    id_gestion integer,
    id_periodo integer,
    nro_dictamen varchar,
    estado varchar DEFAULT 'PENDIENTE'::character varying,
    id_tipo_solicitud integer DEFAULT 0,
    usuario varchar,
    fecha_validacion timestamp without time zone
)
;
--
-- Structure for table tipo_solicitud (OID = 252931111) : 
--
CREATE TABLE solicitudes.tipo_solicitud (
    id_tipo_solicitud integer,
    descripcion varchar,
    estado varchar
)
;
--
-- Structure for table solicitudes_detalle (OID = 252931124) : 
--
CREATE TABLE solicitudes.solicitudes_detalle (
    id serial NOT NULL,
    id_materia integer,
    id_alumno integer,
    id_solicitud integer,
    estado varchar,
    id_grupo integer
)
;
--
-- Structure for table civ (OID = 252971257) : 
--
SET search_path = consola_datacenter, pg_catalog;
CREATE TABLE consola_datacenter.civ (
    id serial NOT NULL,
    id_alumno integer,
    id_materia integer,
    id_grupo integer,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table val (OID = 252975625) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.val (
    id_dia integer,
    id_tran integer NOT NULL,
    cod_val char(5),
    can_val numeric(8,0),
    pre_uni numeric(10,2),
    imp_val numeric(10,2),
    desde integer DEFAULT 0,
    hasta integer DEFAULT 0,
    fec_tra date,
    usr_cre varchar(15),
    fec_cre timestamp with time zone DEFAULT now(),
    nro_com char(6) DEFAULT ''::bpchar,
    ci_per char(15),
    des_per varchar(80),
    obs text,
    tip_tra smallint DEFAULT 0,
    tra_imp smallint DEFAULT 0,
    id_gestion smallint,
    tra_ver smallint DEFAULT 0,
    id_periodo integer,
    id serial NOT NULL,
    obs_matriculacion text,
    _id_gestion_matricula integer,
    _id_periodo_matricula integer,
    estado_matricula varchar DEFAULT 'PENDIENTE'::character varying
)
;
--
-- Structure for table reposiciones (OID = 252981495) : 
--
SET search_path = planillas, pg_catalog;
CREATE TABLE planillas.reposiciones (
    id serial NOT NULL,
    id_materia integer,
    id_docente integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    fecha_registro timestamp without time zone DEFAULT now(),
    obs text,
    fecha_inicial timestamp without time zone DEFAULT now(),
    fecha_final timestamp without time zone,
    estado varchar DEFAULT 'PENDIENTE'::character varying,
    documento varchar
)
;
--
-- Structure for table arq (OID = 252987090) : 
--
SET search_path = consola_datacenter, pg_catalog;
CREATE TABLE consola_datacenter.arq (
    id_alumno integer,
    nombres_apellidos varchar,
    id_materia integer,
    sigla varchar,
    id_grupo integer,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table planes_curriculares (OID = 265063474) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.planes_curriculares (
    id serial NOT NULL,
    id_programa char(3),
    id_plan integer,
    obs varchar,
    fecha_registro timestamp without time zone,
    documento bytea,
    estado varchar,
    tipo_documento varchar,
    niveles_academicos smallint DEFAULT 0 NOT NULL
)
;
--
-- Structure for table materias_graduacion (OID = 265063493) : 
--
CREATE TABLE academico.materias_graduacion (
    id serial NOT NULL,
    id_programa char(3),
    id_plan integer,
    id_materias integer[],
    obs varchar,
    fecha timestamp without time zone DEFAULT now(),
    estado varchar DEFAULT 'A'::character varying
)
;
--
-- Structure for table civ_esp_2021_2 (OID = 265064427) : 
--
SET search_path = consola_datacenter, pg_catalog;
CREATE TABLE consola_datacenter.civ_esp_2021_2 (
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    id_materia integer,
    obs varchar,
    usuario varchar,
    id_grupo integer
)
;
--
-- Structure for table materias_agrupadas (OID = 265081276) : 
--
SET search_path = moodle, pg_catalog;
CREATE TABLE moodle.materias_agrupadas (
    id serial NOT NULL,
    id_designacion_padre integer,
    id_designacion_hijo integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer
)
;
--
-- Structure for table evaluaciones_detalles (OID = 277132571) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.evaluaciones_detalles (
    id serial NOT NULL,
    id_evaluacion integer,
    id_alumno integer,
    evaluacion_social json,
    evaluacion_academico json,
    fecha_registro timestamp without time zone DEFAULT now(),
    fecha_calificacion timestamp without time zone,
    materias_programadas integer,
    materias_aprobadas integer
)
;
--
-- Structure for table programas_habilitados (OID = 277133534) : 
--
SET search_path = seguro, pg_catalog;
CREATE TABLE seguro.programas_habilitados (
    id_programa char(4),
    estado char(1) DEFAULT 'S'::bpchar,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table lista_funsiones (OID = 277149555) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.lista_funsiones (
    id serial NOT NULL,
    funsion text,
    descripcion text,
    fecha timestamp without time zone
)
;
--
-- Structure for table tipos_estadisticas (OID = 277156179) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.tipos_estadisticas (
    id serial NOT NULL,
    descripcion varchar,
    estado varchar,
    str_sql text,
    parametros json
)
;
--
-- Structure for table estadisticas_generadas (OID = 277156194) : 
--
CREATE TABLE estadisticas.estadisticas_generadas (
    id serial NOT NULL,
    id_tipo_estadistica integer,
    datos json,
    fecha timestamp without time zone DEFAULT now(),
    id_gestion integer,
    id_periodo integer,
    usuario varchar,
    estado varchar DEFAULT 'VIGENTES'::character varying,
    str_sql text,
    descripcion text,
    id_programa char(4)
)
;
--
-- Structure for table alm_mat (OID = 277161621) : 
--
SET search_path = consola_datacenter, pg_catalog;
CREATE TABLE consola_datacenter.alm_mat (
    id_alumno integer,
    nombres_apellidos varchar,
    id_materia integer,
    sigla varchar,
    id_grupo integer,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table apertura_planilla (OID = 277161923) : 
--
SET search_path = planillas, pg_catalog;
CREATE TABLE planillas.apertura_planilla (
    id serial NOT NULL,
    id_materia integer,
    id_docente integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    fecha_registro timestamp without time zone DEFAULT now(),
    obs text,
    fecha_inicial timestamp without time zone DEFAULT now(),
    fecha_final timestamp without time zone,
    estado varchar DEFAULT 'PENDIENTE'::character varying,
    documento varchar
)
;
--
-- Structure for table users_od (OID = 277169280) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.users_od (
    id bigserial NOT NULL,
    username varchar(255) NOT NULL,
    password varchar(255) NOT NULL,
    remember_token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    nro_dip varchar
)
;
--
-- Structure for table sit (OID = 277170753) : 
--
SET search_path = consola_datacenter, pg_catalog;
CREATE TABLE consola_datacenter.sit (
    nro_dip char(25),
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    id_materia integer,
    nombres_apellidos varchar,
    sigla varchar,
    id_alumno integer,
    id_matricula integer DEFAULT 0,
    id serial NOT NULL
)
;
--
-- Structure for table actividades (OID = 277176185) : 
--
SET search_path = calendario, pg_catalog;
CREATE TABLE calendario.actividades (
    id integer DEFAULT nextval('activids_id_seq'::regclass) NOT NULL,
    categoria_id integer NOT NULL,
    nombre varchar(255) NOT NULL,
    estado varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table carrera (OID = 277176193) : 
--
CREATE TABLE calendario.carrera (
    id bigint DEFAULT nextval('carrera_id_seq'::regclass) NOT NULL,
    users_id integer NOT NULL,
    facultad_id integer NOT NULL,
    sigla varchar(255),
    tipo varchar(255) NOT NULL,
    nombre varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table carreras (OID = 277176201) : 
--
CREATE TABLE calendario.carreras (
    id_programa char(3) NOT NULL,
    programa varchar(50) NOT NULL,
    tipo varchar,
    director integer
)
;
--
-- Structure for table categoria (OID = 277176207) : 
--
CREATE TABLE calendario.categoria (
    id serial NOT NULL,
    nombre varchar(255) NOT NULL,
    estado varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table eventos (OID = 277176215) : 
--
CREATE TABLE calendario.eventos (
    id bigserial NOT NULL,
    title varchar(255),
    actividad varchar(255) NOT NULL,
    color varchar(20) NOT NULL,
    "textColor" varchar(20) NOT NULL,
    start timestamp(0) without time zone NOT NULL,
    "end" timestamp(0) without time zone NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table facultad (OID = 277176223) : 
--
CREATE TABLE calendario.facultad (
    id bigserial NOT NULL,
    nombre varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table failed_jobs (OID = 277176229) : 
--
CREATE TABLE calendario.failed_jobs (
    id bigserial NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table gestioncalendario (OID = 277176238) : 
--
CREATE TABLE calendario.gestioncalendario (
    id bigserial NOT NULL,
    categoria_id integer NOT NULL,
    actividades_id integer NOT NULL,
    fecha_inicio varchar(255) NOT NULL,
    fecha_final varchar(255) NOT NULL,
    gestion integer NOT NULL,
    periodo integer NOT NULL,
    tipo_carrera varchar(255) NOT NULL,
    color varchar(255),
    tipo varchar(255) DEFAULT 'academico'::character varying NOT NULL,
    estado varchar(255) DEFAULT 'programadas'::character varying NOT NULL,
    observacion text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT gestioncalendario_estado_check CHECK (((estado)::text = ANY (ARRAY[('programadas'::character varying)::text, ('aprobado'::character varying)::text, ('reprogramado'::character varying)::text, ('anulado'::character varying)::text, ('finalizado'::character varying)::text]))),
    CONSTRAINT gestioncalendario_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('academico'::character varying)::text, ('administrativo'::character varying)::text, ('ambos'::character varying)::text])))
)
;
--
-- Structure for table gestionrespaldo (OID = 277176250) : 
--
CREATE TABLE calendario.gestionrespaldo (
    id bigserial NOT NULL,
    users_id integer DEFAULT 1 NOT NULL,
    gestioncalendario_id integer NOT NULL,
    carrera_id integer NOT NULL,
    categoria_id integer NOT NULL,
    activids_id integer NOT NULL,
    fecha_inicio varchar(255) NOT NULL,
    fecha_final varchar(255) NOT NULL,
    gestion integer NOT NULL,
    periodo integer NOT NULL,
    tipo varchar(255) DEFAULT 'academico'::character varying NOT NULL,
    estado varchar(255) DEFAULT 'reprogramadas'::character varying NOT NULL,
    observacion text,
    estadogestion varchar(255) DEFAULT 'no_enviado'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    cuando varchar(255),
    CONSTRAINT gestionrespaldo_estado_check CHECK (((estado)::text = ANY (ARRAY[('programadas'::character varying)::text, ('enviado'::character varying)::text, ('reprogramadas'::character varying)::text, ('anulado'::character varying)::text]))),
    CONSTRAINT gestionrespaldo_estadogestion_check CHECK (((estadogestion)::text = ANY (ARRAY[('no_enviado'::character varying)::text, ('aprobado'::character varying)::text, ('rechazado'::character varying)::text, ('pendiente'::character varying)::text]))),
    CONSTRAINT gestionrespaldo_tipo_check CHECK (((tipo)::text = ANY (ARRAY[('academico'::character varying)::text, ('administrativo'::character varying)::text, ('ambos'::character varying)::text])))
)
;
--
-- Structure for table historicocarrera (OID = 277176265) : 
--
CREATE TABLE calendario.historicocarrera (
    id bigserial NOT NULL,
    users_id integer NOT NULL,
    actividades_id integer NOT NULL,
    fecha_inicio varchar(255) NOT NULL,
    fecha_final varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table jobs (OID = 277176273) : 
--
CREATE TABLE calendario.jobs (
    id bigserial NOT NULL,
    queue varchar(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
)
;
--
-- Structure for table migrations (OID = 277176281) : 
--
CREATE TABLE calendario.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table password_resets (OID = 277176286) : 
--
CREATE TABLE calendario.password_resets (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone
)
;
--
-- Structure for table pdfcalendario (OID = 277176292) : 
--
CREATE TABLE calendario.pdfcalendario (
    id bigserial NOT NULL,
    user_id integer NOT NULL,
    url varchar(255) NOT NULL,
    gestion varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    estado varchar(255)
)
;
--
-- Structure for table reportecarreras (OID = 277176300) : 
--
CREATE TABLE calendario.reportecarreras (
    id bigserial NOT NULL,
    carrera_id integer NOT NULL,
    users_id integer,
    gestion integer NOT NULL,
    periodo integer NOT NULL,
    fecha varchar(255) NOT NULL,
    path varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table respaldo (OID = 277176309) : 
--
CREATE TABLE calendario.respaldo (
    gestioncalendario_id integer,
    users_id integer,
    fecha date,
    estado text
)
;
--
-- Structure for table role_user (OID = 277176315) : 
--
CREATE TABLE calendario.role_user (
    user_id bigint NOT NULL,
    role_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table roles (OID = 277176318) : 
--
CREATE TABLE calendario.roles (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    label varchar(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table users (OID = 277176326) : 
--
CREATE TABLE calendario.users (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table bc_postulantes_bk (OID = 277176853) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.bc_postulantes_bk (
    id_alumno integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint,
    fecha date DEFAULT now(),
    tipo_post varchar(2) NOT NULL,
    sit_social real DEFAULT 0.00 NOT NULL,
    sit_acad real DEFAULT 0.00 NOT NULL,
    anios real,
    nivel varchar(3),
    obs text,
    familiar varchar(5) DEFAULT 0,
    economico varchar(5) DEFAULT 0,
    procedencia varchar(5) DEFAULT 0,
    fec_revision date,
    vivienda_familiar varchar(5) DEFAULT 0,
    vivienda_estudiante varchar(5) DEFAULT 0,
    revisado char(1),
    estado char(1),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario integer,
    _estado char(1) DEFAULT 'R'::bpchar NOT NULL,
    _ip_usuario varchar(32),
    _planilla boolean DEFAULT false NOT NULL,
    _isbeca char(1) DEFAULT 'N'::bpchar NOT NULL,
    tipo_beca varchar DEFAULT 'P'::bpchar NOT NULL,
    obs_old text,
    _2008 numeric(4,2) DEFAULT 0 NOT NULL,
    _2009 numeric(4,2) DEFAULT 0 NOT NULL,
    _2010 numeric(4,2) DEFAULT 0 NOT NULL,
    _2011 numeric(4,2) DEFAULT 0 NOT NULL,
    _2012 numeric(4,2) DEFAULT 0 NOT NULL,
    _2113 numeric(4,2) DEFAULT 0 NOT NULL,
    _2213 numeric(4,2) DEFAULT 0 NOT NULL,
    _2114 numeric(4,2) DEFAULT 0 NOT NULL,
    _2214 numeric(4,2) DEFAULT 0 NOT NULL,
    _anios numeric(10,4) DEFAULT 0 NOT NULL,
    help real,
    help2 real,
    help3 real,
    help4 real,
    help5 real,
    help6 real,
    gestion_calificacion smallint,
    periodo_calificacion smallint,
    gestion_evaluacion smallint,
    periodo_evaluacion smallint,
    fecha_calificacion timestamp(0) without time zone,
    estado_beca char(1) DEFAULT 'A'::bpchar,
    nro_convocatoria smallint DEFAULT (1)::smallint,
    id_new_gestion integer DEFAULT 2019,
    invsocial boolean DEFAULT false,
    id serial NOT NULL,
    paracademico varchar(5)
)
;
--
-- Structure for table directores_respuestas (OID = 277249469) : 
--
SET search_path = encuestas, pg_catalog;
CREATE TABLE encuestas.directores_respuestas (
    id serial NOT NULL,
    id_docente integer,
    id_gestion integer,
    id_periodo integer,
    fecha_creacion timestamp without time zone,
    fecha_modificacion timestamp without time zone,
    res_1 json,
    res_2 json,
    res_3 json,
    res_4 json,
    res_5 json,
    res_6 json,
    res_7 json,
    id_programa char(3)
)
;
--
-- Structure for table docentes_tramites (OID = 277266080) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.docentes_tramites (
    id serial NOT NULL,
    id_docente integer,
    id_gestion integer,
    id_periodo integer,
    id_materia integer,
    id_grupo integer,
    finalizado boolean DEFAULT false,
    evaluacion boolean DEFAULT false,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table exportar (OID = 277274373) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.exportar (
    id serial NOT NULL,
    nro_dip varchar,
    nombres varchar,
    nota numeric,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table sau_designaciones (OID = 289592032) : 
--
SET search_path = moodle, pg_catalog;
CREATE TABLE moodle.sau_designaciones (
    id_designacion serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    id_modalidad integer,
    id_docente integer,
    id_materia integer,
    id_programa varchar
)
;
--
-- Structure for table sau_materias (OID = 289682421) : 
--
CREATE TABLE moodle.sau_materias (
    id_materia integer,
    sigla varchar,
    materia varchar
)
;
--
-- Structure for table val_tram_actualizar (OID = 289692492) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.val_tram_actualizar (
    id serial NOT NULL,
    cod_val char(5),
    can_val smallint,
    gestion smallint,
    tipo varchar,
    orden smallint,
    req_val text,
    imp_val smallint,
    tra_val char(1)
)
;
--
-- Structure for table tra_dia_actualizado (OID = 289692520) : 
--
CREATE TABLE cajas.tra_dia_actualizado (
    id_dia integer,
    id_tran integer,
    cod_val text,
    can_val double precision,
    pre_uni double precision,
    imp_val double precision,
    desde integer,
    hasta integer,
    fec_tra date,
    usr_cre text,
    fec_cre text,
    nro_com text,
    ci_per text,
    des_per text,
    obs text,
    tip_tra integer,
    tra_imp integer,
    gestion integer,
    tra_ver integer
)
;
--
-- Structure for table alm_programaciones_simulacion (OID = 289739145) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.alm_programaciones_simulacion (
    id_alumno integer NOT NULL,
    id_materia integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_grupo smallint,
    fecha timestamp without time zone DEFAULT now() NOT NULL,
    ult_usuario varchar(22) NOT NULL,
    estado char(1) DEFAULT 'A'::bpchar NOT NULL,
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
    tipo_prog char(1),
    id serial NOT NULL,
    metodo_programacion varchar(100) DEFAULT 'DESCONOCIDO'::character varying,
    _estado varchar DEFAULT 'REGISTRADO'::character varying NOT NULL,
    tipo_programacion varchar DEFAULT 'ESPECIAL'::character varying
)
;
--
-- Structure for table importados (OID = 289794024) : 
--
SET search_path = extension, pg_catalog;
CREATE TABLE extension.importados (
    id serial NOT NULL,
    nro integer,
    nombres varchar,
    nro_dip varchar,
    telefono varchar,
    costo numeric,
    sigla varchar,
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    tipo char(15),
    id_alumno integer,
    estado varchar,
    id_programa char(3) NOT NULL
)
;
--
-- Structure for table der (OID = 289808020) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.der (
    id integer DEFAULT nextval('det_id_seq'::regclass) NOT NULL,
    id_programa char(3),
    nro_dip varchar,
    nombres varchar,
    nota integer,
    obs varchar,
    fecha timestamp(0) without time zone DEFAULT now(),
    modalidad integer
)
;
--
-- Structure for table importados (OID = 289810063) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE TABLE auxiliares.importados (
    id serial NOT NULL,
    inro integer,
    cnro varchar,
    prg_programa varchar,
    programa1 varchar,
    id_programa char(3),
    programa2 varchar,
    item varchar,
    id_alumno integer,
    nro_dip varchar,
    apellidos_nombres varchar,
    sigla char(7),
    id_materia integer,
    materia varchar,
    id_grupo integer
)
;
--
-- Structure for table niveles_programaciones (OID = 289924258) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.niveles_programaciones (
    id serial NOT NULL,
    id_programa char(3),
    nivel_academico integer,
    cantidad_materias_arrastre integer
)
;
--
-- Structure for table titulos_programas (OID = 302653471) : 
--
SET search_path = dep_titulos, pg_catalog;
CREATE TABLE dep_titulos.titulos_programas (
    id_programa char(3),
    programa varchar
)
;
--
-- Structure for table estudiantes (OID = 302655712) : 
--
SET search_path = log, pg_catalog;
CREATE TABLE log.estudiantes (
    id serial NOT NULL,
    id_alumno integer,
    fecha timestamp without time zone,
    operacion smallint
)
;
--
-- Structure for table _operacion (OID = 302655716) : 
--
CREATE TABLE log._operacion (
    id smallint,
    descripcion varchar
)
;
--
-- Structure for table tmp_materias (OID = 302659738) : 
--
SET search_path = moodle, pg_catalog;
CREATE TABLE moodle.tmp_materias (
    id_materia integer,
    materia varchar,
    programa varchar,
    id_grupo integer,
    id_gestion integer,
    id_periodo integer,
    tipo varchar
)
;
--
-- Structure for table tareas (OID = 302670163) : 
--
SET search_path = cron, pg_catalog;
CREATE TABLE cron.tareas (
    id serial NOT NULL,
    descripcion varchar,
    funsion varchar,
    estado char(1) DEFAULT 'A'::bpchar
)
;
--
-- Structure for table _votos_2da (OID = 315377703) : 
--
SET search_path = elecciones, pg_catalog;
CREATE TABLE elecciones._votos_2da (
    id_voto serial NOT NULL,
    id_mesa integer NOT NULL,
    id_candidato integer,
    candidato_1 integer,
    candidato_2 integer,
    candidato_3 integer,
    blancos integer,
    nulos integer,
    total integer,
    id_tipo_eleccion integer,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL
)
;
--
-- Structure for table lista_asegurados (OID = 315378655) : 
--
SET search_path = seguro, pg_catalog;
CREATE TABLE seguro.lista_asegurados (
    id serial NOT NULL,
    id_lista integer,
    id_gestion integer,
    id_periodo integer,
    id_ra varchar,
    id_programa varchar(3),
    nro_dip varchar,
    apellidos_nombres varchar,
    tipo_estudiante char(1),
    id_alumno integer,
    materias_programadas json,
    estado_alumno char(1) DEFAULT 'R'::bpchar,
    estado_matricula char(1),
    estado_programacion char(1),
    estado_no_profesional char(1) DEFAULT 'S'::bpchar,
    id_matricula integer,
    fecha timestamp without time zone,
    usuario varchar,
    tiene_seguro char(1),
    obs text,
    estado_seguro varchar DEFAULT 'PENDIENTE'::character varying
)
;
--
-- Structure for table avance_academico (OID = 315381644) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.avance_academico (
    id integer DEFAULT nextval('egresados_id_seq'::regclass) NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    avance_academico numeric
)
;
--
-- Structure for table estudiantes (OID = 315381675) : 
--
CREATE TABLE estadisticas.estudiantes (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    avance_academico numeric,
    permanencia numeric,
    materias_programadas integer,
    materias_aprobadas integer,
    num_materias_plan numeric,
    num_materias_graduarse numeric,
    porcentaje_avance numeric,
    es_graduado char(2)
)
;
--
-- Structure for table migrations (OID = 315386254) : 
--
SET search_path = conteo, pg_catalog;
CREATE TABLE conteo.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table users (OID = 315386262) : 
--
CREATE TABLE conteo.users (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table password_resets (OID = 315386273) : 
--
CREATE TABLE conteo.password_resets (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone
)
;
--
-- Structure for table failed_jobs (OID = 315386282) : 
--
CREATE TABLE conteo.failed_jobs (
    id bigserial NOT NULL,
    uuid varchar(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table personal_access_tokens (OID = 315386296) : 
--
CREATE TABLE conteo.personal_access_tokens (
    id bigserial NOT NULL,
    tokenable_type varchar(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name varchar(255) NOT NULL,
    token varchar(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table mesas (OID = 315386310) : 
--
CREATE TABLE conteo.mesas (
    id bigserial NOT NULL,
    nro integer NOT NULL,
    cant integer NOT NULL,
    tipo varchar(255) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table candidatos (OID = 315386319) : 
--
CREATE TABLE conteo.candidatos (
    id bigserial NOT NULL,
    nombre varchar(255) NOT NULL,
    color varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table votos (OID = 315386330) : 
--
CREATE TABLE conteo.votos (
    id bigserial NOT NULL,
    mesa_id bigint NOT NULL,
    candidato_id bigint NOT NULL,
    cant integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table hosts (OID = 315395636) : 
--
SET search_path = vm, pg_catalog;
CREATE TABLE vm.hosts (
    id serial NOT NULL,
    vm text,
    ip varchar,
    hostname varchar,
    sistema_operativo varchar,
    caracteristicas text,
    fecha_creacion text,
    autor text,
    servicios text,
    usuario_clave text,
    administrar text
)
;
--
-- Structure for table extension_carreras (OID = 315398412) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.extension_carreras (
    id_programa char(3),
    id_programas_ext char(3)[]
)
;
--
-- Structure for table programas_cuotas (OID = 343350996) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.programas_cuotas (
    id_programa char(3),
    nro_de_cuotas_maximas integer,
    costo_total_cuotas numeric,
    id_cargo_cuotas char(5),
    estado varchar DEFAULT 'VIGENTE'::character varying
)
;
--
-- Structure for table dct_asignaciones_extra (OID = 343351839) : 
--
SET search_path = sis_directores, pg_catalog;
CREATE TABLE sis_directores.dct_asignaciones_extra (
    id_docente integer NOT NULL,
    id_programa char(3) NOT NULL,
    id_materia integer NOT NULL,
    id_grupo smallint NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_dictamen integer,
    fecha_modificacion_dir timestamp(0) without time zone,
    fecha_registro_dir timestamp without time zone DEFAULT now(),
    id_dct_asignaciones serial NOT NULL,
    observaciones text,
    tipo_docente varchar,
    verificacion_estado char(2) DEFAULT 'N'::bpchar,
    fecha_validacion_vice timestamp(0) without time zone,
    fecha_modificacion_vice timestamp(0) without time zone
)
;
--
-- Structure for table dir_dictamen (OID = 343352654) : 
--
CREATE TABLE sis_directores.dir_dictamen (
    id_dictamen serial NOT NULL,
    id_programa varchar,
    obs text,
    numero integer,
    gestion integer,
    user_name varchar(20),
    fecha_reg timestamp(0) without time zone,
    fecha_mod timestamp(6) without time zone
)
;
ALTER TABLE ONLY sis_directores.dir_dictamen ALTER COLUMN id_dictamen SET STATISTICS 0;
ALTER TABLE ONLY sis_directores.dir_dictamen ALTER COLUMN numero SET STATISTICS 0;
ALTER TABLE ONLY sis_directores.dir_dictamen ALTER COLUMN gestion SET STATISTICS 0;
ALTER TABLE ONLY sis_directores.dir_dictamen ALTER COLUMN user_name SET STATISTICS 0;
ALTER TABLE ONLY sis_directores.dir_dictamen ALTER COLUMN fecha_mod SET STATISTICS 0;
--
-- Structure for table lista_elecciones (OID = 343355016) : 
--
SET search_path = elecciones, pg_catalog;
CREATE TABLE elecciones.lista_elecciones (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    tipo_eleccion varchar,
    detalle varchar,
    facultad_programa varchar,
    titulo1 text,
    titulo2 text,
    titulo3 text,
    fecha_generacion timestamp without time zone DEFAULT now(),
    estado public.enum_tipo,
    fecha_claustro date,
    titulo4 varchar,
    id_sede char(1) DEFAULT 'C'::bpchar,
    si_programados char(1) DEFAULT 'S'::bpchar NOT NULL,
    obs text,
    tipo_elector varchar DEFAULT 'ESTUDIANTES'::character varying,
    id_control integer,
    vuelta integer DEFAULT 1
)
;
--
-- Structure for table tipos_matriculas (OID = 343367584) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.tipos_matriculas (
    id integer,
    tipo_matricula varchar,
    id_cargo char(5),
    id_tipo_estudiante char(3)[]
)
;
--
-- Structure for table tipo_estudiante (OID = 343367603) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.tipo_estudiante (
    id_tipo_estudiante char(3),
    descripcion varchar,
    estado varchar
)
;
--
-- Structure for table valores_cargos_programas (OID = 343368818) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.valores_cargos_programas (
    id_cargo_programa serial NOT NULL,
    id_cargo varchar(5) NOT NULL,
    id_programa char(3),
    estado char(1) DEFAULT 'A'::bpchar,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table cargos (OID = 343409436) : 
--
CREATE TABLE matriculas.cargos (
    id_cargo varchar(5),
    cargo varchar,
    estado varchar,
    tipo_cargo char(10)
)
;
--
-- Structure for table alm_programaciones_fechas (OID = 356259730) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.alm_programaciones_fechas (
    id_gestion integer,
    id_periodo integer,
    id_materia integer,
    id_grupo integer,
    fecha_inicial date,
    fecha_final date,
    tipo varchar DEFAULT 'NOTA'::character varying NOT NULL
)
;
--
-- Structure for table calificacion_evaluacion_detalles (OID = 356262532) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.calificacion_evaluacion_detalles (
    id serial NOT NULL,
    id_calificacion integer,
    id_alumno integer,
    puntaje_social numeric DEFAULT 0,
    puntaje_academico numeric DEFAULT 0,
    puntaje_total numeric,
    social json,
    academico json,
    fecha_registro timestamp without time zone DEFAULT now(),
    fecha_calificacion timestamp without time zone,
    materias_programadas json,
    cm_programadas smallint DEFAULT 0,
    cm_aprobadas smallint DEFAULT 0,
    cm_rendimiento_academico varchar(10) DEFAULT ''::character varying,
    estado_c_e varchar DEFAULT ''::character varying,
    obs varchar,
    nro_beca integer,
    id_postulante integer,
    _isbeca char(1) DEFAULT ''::bpchar,
    _tipo_beca varchar,
    _tiene_beca_ant char(1) DEFAULT 'N'::bpchar,
    _tiene_beca_eva char(1) DEFAULT ''::bpchar,
    obs_cal varchar,
    estado_beca char(3),
    id_tipo_calificacion integer DEFAULT 0 NOT NULL,
    anios_becas numeric(8,2),
    item integer
)
;
--
-- Structure for table calificacion_evaluacion (OID = 356275052) : 
--
CREATE TABLE balimentacion.calificacion_evaluacion (
    id serial NOT NULL,
    id_programa char(3),
    id_tipo_beca char(1) DEFAULT 'A'::bpchar,
    id_gestion integer,
    id_periodo integer,
    tipo_calificacion char(1) DEFAULT 'C'::bpchar,
    fecha_registro timestamp without time zone DEFAULT now(),
    fecha_calificacion timestamp without time zone,
    fecha_inicio timestamp without time zone DEFAULT now(),
    estado varchar DEFAULT 'INICIADO'::character varying,
    detalle text,
    usr_cre varchar DEFAULT 'sistema'::character varying,
    fec_cre timestamp without time zone DEFAULT now(),
    usr_val varchar,
    fec_val timestamp without time zone,
    hash varchar,
    cant_folders_entregados integer DEFAULT 0,
    cant_folders_sistema integer DEFAULT 0
)
;
--
-- Structure for table dir_designaciones (OID = 356306349) : 
--
SET search_path = sis_odiseo, pg_catalog;
CREATE TABLE sis_odiseo.dir_designaciones (
    id_asignacion serial NOT NULL,
    id_programa varchar,
    id_gestion integer,
    id_periodo integer,
    dic_numero integer,
    dic_gestion integer,
    dic_obs text,
    user_name varchar(20) DEFAULT 'ODISEO'::character varying,
    fecha_reg timestamp(0) without time zone DEFAULT now(),
    fecha_mod timestamp(6) without time zone
)
;
ALTER TABLE ONLY sis_odiseo.dir_designaciones ALTER COLUMN id_asignacion SET STATISTICS 0;
ALTER TABLE ONLY sis_odiseo.dir_designaciones ALTER COLUMN dic_numero SET STATISTICS 0;
ALTER TABLE ONLY sis_odiseo.dir_designaciones ALTER COLUMN dic_gestion SET STATISTICS 0;
ALTER TABLE ONLY sis_odiseo.dir_designaciones ALTER COLUMN user_name SET STATISTICS 0;
ALTER TABLE ONLY sis_odiseo.dir_designaciones ALTER COLUMN fecha_mod SET STATISTICS 0;
--
-- Structure for table tipos_calificacion (OID = 356306423) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.tipos_calificacion (
    id_tipo_calificacion smallint,
    descripcion varchar,
    orden smallint
)
;
--
-- Structure for table dct_asignaciones_extra (OID = 356334226) : 
--
SET search_path = sis_odiseo, pg_catalog;
CREATE TABLE sis_odiseo.dct_asignaciones_extra (
    id_dct_asignaciones serial NOT NULL,
    id_docente integer NOT NULL,
    id_programa char(3) NOT NULL,
    id_materia integer NOT NULL,
    id_grupo smallint NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_asignacion integer,
    user_dir varchar(50) DEFAULT 'ODISEO'::character varying,
    fecha_modificacion_dir timestamp without time zone,
    fecha_registro_dir timestamp without time zone DEFAULT now(),
    observaciones text,
    tipo_docente varchar,
    verificacion_estado char(2) DEFAULT 'N'::bpchar,
    user_vice varchar(50) DEFAULT 'rossio_rogriguez'::character varying,
    fecha_validacion_vice timestamp(0) without time zone,
    fecha_modificacion_vice timestamp(0) without time zone
)
;
--
-- Structure for table programas (OID = 356351756) : 
--
SET search_path = consola_datacenter, pg_catalog;
CREATE TABLE consola_datacenter.programas (
    nro_dip char(25),
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    id_materia integer,
    nombres_apellidos varchar,
    sigla varchar,
    id_alumno integer,
    id_matricula integer DEFAULT 0,
    id serial NOT NULL
)
;
--
-- Structure for table certificados (OID = 356375148) : 
--
SET search_path = planillas, pg_catalog;
CREATE TABLE planillas.certificados (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    nro integer,
    id_alumno integer,
    clave_original char(10),
    clave_certificado varchar,
    fecha timestamp without time zone DEFAULT now(),
    id_control_recepcion integer,
    materias json,
    exceso_2do_turno char(1) DEFAULT 'N'::bpchar NOT NULL,
    estado t_e_certificados DEFAULT 'SOLICITADO'::t_e_certificados,
    usuario varchar(20),
    obs varchar DEFAULT 'A'::character varying,
    nro_com varchar(8),
    cat_imp smallint DEFAULT 1
)
;
--
-- Structure for table informacion (OID = 356375859) : 
--
SET search_path = _json, pg_catalog;
CREATE TABLE _json.informacion (
    id integer,
    titulo varchar(100),
    descripcion varchar(300),
    tipo integer,
    "strCategoryThumb" varchar(300)
)
;
--
-- Structure for table diccionario (OID = 356381070) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.diccionario (
    variable varchar,
    tipo_variable varchar,
    funsion_asociada varchar
)
;
--
-- Structure for table becas_importar (OID = 356389810) : 
--
SET search_path = becas, pg_catalog;
CREATE TABLE becas.becas_importar (
    id serial NOT NULL,
    nro varchar,
    nro_dip varchar,
    id_alumno integer,
    paterno varchar,
    materno varchar,
    nombres varchar,
    apellidos_nombres varchar,
    carrera varchar,
    id_programa char(3),
    id_gestion integer,
    id_periodo integer,
    tipo_beca varchar,
    programa_beca varchar,
    id_programa_beca char(3),
    item_beca char(5),
    id_cat_prg char(12)
)
;
--
-- Structure for table programas_examenes (OID = 356417372) : 
--
SET search_path = sau, pg_catalog;
CREATE TABLE sau.programas_examenes (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    id_programa char(3),
    fecha timestamp without time zone,
    usuario varchar,
    cantidad_preguntas integer,
    nota_aprobacion integer,
    estado varchar
)
;
--
-- Structure for table tipo_examen (OID = 356417506) : 
--
CREATE TABLE sau.tipo_examen (
    id_tipo_examen integer,
    examen varchar,
    estado varchar
)
;
--
-- Structure for table examenes (OID = 356417530) : 
--
CREATE TABLE sau.examenes (
    id_examenes integer DEFAULT nextval('examenes_id_examen_seq1'::regclass) NOT NULL,
    id_programa char(3),
    id_gestion integer,
    id_periodo integer,
    fecha timestamp without time zone DEFAULT now(),
    usuario varchar,
    id_tipo_examen integer DEFAULT 1,
    tiempo integer DEFAULT 30,
    fecha_inicio_examen timestamp without time zone,
    fecha_final_examen timestamp without time zone,
    orden char(1) DEFAULT 'R'::bpchar,
    estado varchar,
    id_modalidad integer,
    fecha_limite_revision timestamp without time zone,
    cantidad_preguntas integer DEFAULT 0
)
;
--
-- Structure for table preguntas (OID = 356420138) : 
--
CREATE TABLE sau.preguntas (
    id_pregunta integer DEFAULT nextval('preguntas_id_pregunta_seq'::regclass) NOT NULL,
    id_programa char(3) DEFAULT 'XXX'::bpchar,
    id_tipo_grupo integer,
    pregunta text,
    opcion1 text,
    opcion2 text,
    opcion3 text,
    opcion4 text,
    respuesta text,
    id_respuesta integer,
    estado varchar DEFAULT 'ACTIVO'::character varying,
    id_ref_pregunta integer,
    id_tipo_pregunta integer
)
;
--
-- Structure for table examen_postulante (OID = 356420744) : 
--
CREATE TABLE sau.examen_postulante (
    id_examen_postulante serial NOT NULL,
    id_postulante integer,
    nro_dip varchar,
    apellidos_nombres varchar,
    id_examenes integer,
    fecha_inicio timestamp without time zone,
    fecha_final timestamp without time zone,
    tiempo_restante integer,
    obs varchar,
    estado varchar DEFAULT 'INICIADO'::character varying,
    resultado varchar(1),
    orden char(1) DEFAULT 'R'::bpchar
)
;
--
-- Structure for table postulantes_preguntas (OID = 356420830) : 
--
CREATE TABLE sau.postulantes_preguntas (
    id_postulantes_preguntas serial NOT NULL,
    id_examen_postulante integer,
    id_pregunta integer,
    nro integer,
    id_respuesta integer,
    respuesta text,
    fecha_hora timestamp without time zone,
    ip inet,
    respuesta_correcta boolean DEFAULT false,
    nota_pregunta numeric DEFAULT 0,
    nota_respuesta numeric DEFAULT 0
)
;
--
-- Structure for table tipos_preguntas (OID = 356421506) : 
--
CREATE TABLE sau.tipos_preguntas (
    id_tipo_pregunta integer,
    tipo_pregunta varchar
)
;
--
-- Structure for table examen_tipo_pregunta (OID = 356421512) : 
--
CREATE TABLE sau.examen_tipo_pregunta (
    id_examenes integer,
    id_tipo_pregunta integer,
    cantidad_preguntas integer,
    porcentaje numeric(6,2)
)
;
--
-- Structure for table tipos_grupos (OID = 441639574) : 
--
CREATE TABLE sau.tipos_grupos (
    id_tipo_grupo integer,
    tipo_grupo varchar
)
;
--
-- Structure for table psa (OID = 369386572) : 
--
SET search_path = psa, pg_catalog;
CREATE TABLE psa.psa (
    nro integer,
    ci varchar,
    apellidos_nombres varchar,
    nota integer,
    id_modalidad integer
)
;
--
-- Structure for table initial (OID = 369390680) : 
--
SET search_path = bot, pg_catalog;
CREATE TABLE bot.initial (
    option_key varchar,
    keywords varchar,
    id serial NOT NULL
)
;
--
-- Structure for table response (OID = 369390691) : 
--
CREATE TABLE bot.response (
    id serial NOT NULL,
    option_key varchar,
    replymessage varchar,
    trigger varchar,
    media varchar
)
;
--
-- Structure for table messages (OID = 369390702) : 
--
CREATE TABLE bot.messages (
    date date NOT NULL,
    message varchar NOT NULL,
    trigger varchar,
    number varchar NOT NULL
)
;
--
-- Structure for table proyecto (OID = 369391681) : 
--
SET search_path = _json, pg_catalog;
CREATE TABLE _json.proyecto (
    auxiliar_docencia json
)
;
--
-- Structure for table parentesco (OID = 369401001) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.parentesco (
    id_parentesco integer,
    parentesco varchar,
    estado varchar DEFAULT 'A'::character varying
)
;
--
-- Structure for table grados_instruccion (OID = 369401008) : 
--
CREATE TABLE balimentacion.grados_instruccion (
    id_grado_instruccion integer,
    grado_instruccion varchar,
    estado char(1) DEFAULT 'A'::bpchar
)
;
--
-- Structure for table ru_habilitados (OID = 369404770) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.ru_habilitados (
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    estado char(1)
)
;
--
-- Structure for table log_svr2 (OID = 382685404) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.log_svr2 (
    id serial NOT NULL,
    ip varchar,
    usuario varchar,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table becas_investigacion (OID = 382814341) : 
--
SET search_path = becas, pg_catalog;
CREATE TABLE becas.becas_investigacion (
    id_proyecto serial NOT NULL,
    titulo_proyecto text,
    descripcion_proyecto text,
    id_alumno integer,
    estado_proyecto varchar(15) DEFAULT 'postulacion'::character varying,
    avance_proyecto integer,
    nota_postulante json DEFAULT '[{"meritos":"0","propuesta":"0","total":"0"}]'::json,
    cronograma_proyecto json,
    curriculum_postulante json,
    file_proyecto bytea,
    fecha_postulacion timestamp without time zone,
    nombre_archivo_postulacion varchar(100),
    fecha_modificacion timestamp(0) without time zone,
    nota_meritos numeric(3,2) DEFAULT 0,
    nota_propuesta numeric(3,2) DEFAULT 0,
    nota_total numeric(3,2) DEFAULT 0,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table calificacion_detalles (OID = 382838329) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.calificacion_detalles (
    id bigint DEFAULT nextval('descriptions_califs_id_seq'::regclass) NOT NULL,
    description varchar(255) NOT NULL,
    points varchar(255) NOT NULL,
    orden smallint,
    parameter_calif_id integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    estado varchar DEFAULT 'ACTIVO'::character varying
)
;
--
-- Structure for table planes_inf (OID = 382959814) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.planes_inf (
    id serial NOT NULL,
    id_plan smallint NOT NULL,
    id_programa char(3) NOT NULL,
    id_materia integer NOT NULL,
    nivel_academico smallint,
    tipo char(1) DEFAULT 'M'::bpchar NOT NULL,
    id_mencion smallint DEFAULT 0 NOT NULL,
    obs text,
    id_materia_convalidacion integer[],
    id_materia_prerrequisito integer[],
    id_materia_paralela integer[],
    estado char(1) DEFAULT 'V'::bpchar,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    usuario varchar
)
;
--
-- Structure for table investigacion_social (OID = 383062092) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.investigacion_social (
    id serial NOT NULL,
    id_alumno integer NOT NULL,
    id_trab_social integer NOT NULL,
    id_gestion integer NOT NULL,
    id_periodo integer DEFAULT 1 NOT NULL,
    motivo varchar,
    ref_caso text,
    ant_familia text,
    sit_act_estudiante text,
    concep_social text,
    conclusion text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    estado varchar DEFAULT 'PENDIENTE'::character varying,
    sugerencia varchar DEFAULT 'ACEPTADO'::character varying
)
;
--
-- Structure for table roles (OID = 383118640) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.roles (
    id serial NOT NULL,
    rol varchar,
    estado varchar,
    tipo_rol varchar(3)
)
;
--
-- Structure for table roles_tipo_estadisticas (OID = 383118655) : 
--
CREATE TABLE estadisticas.roles_tipo_estadisticas (
    id_rol integer,
    id_tipo_estadistica integer,
    estado varchar
)
;
--
-- Structure for table usuarios_roles (OID = 383118704) : 
--
CREATE TABLE estadisticas.usuarios_roles (
    user_id integer,
    role_id integer,
    estado varchar,
    id_programa char(3)
)
;
--
-- Structure for table inf_manuals (OID = 383127345) : 
--
SET search_path = sis_odiseo, pg_catalog;
CREATE TABLE sis_odiseo.inf_manuals (
    id serial NOT NULL,
    titulo text NOT NULL,
    descripcion text NOT NULL,
    documento bytea NOT NULL,
    roles varchar(255) NOT NULL,
    estado integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    reg_usuario varchar(20)
)
;
--
-- Structure for table inf_notificaciones (OID = 383127356) : 
--
CREATE TABLE sis_odiseo.inf_notificaciones (
    id serial NOT NULL,
    titulo text NOT NULL,
    descripcion text NOT NULL,
    documento bytea NOT NULL,
    imagen bytea,
    tipo varchar(255) NOT NULL,
    desde date NOT NULL,
    hasta date NOT NULL,
    roles varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    reg_usuario varchar(20)
)
;
--
-- Structure for table inf_procedimientos (OID = 383127368) : 
--
CREATE TABLE sis_odiseo.inf_procedimientos (
    id serial NOT NULL,
    titulo text NOT NULL,
    descripcion text NOT NULL,
    roles varchar(255) NOT NULL,
    estado integer NOT NULL,
    documento bytea NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    reg_usuario varchar(20)
)
;
--
-- Structure for table inf_reglamentos (OID = 383127380) : 
--
CREATE TABLE sis_odiseo.inf_reglamentos (
    id serial NOT NULL,
    titulo text NOT NULL,
    descripcion text NOT NULL,
    documento bytea NOT NULL,
    roles varchar(255) NOT NULL,
    estado integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    reg_usuario varchar(20)
)
;
--
-- Structure for table migrations (OID = 383134206) : 
--
SET search_path = sis_heracles, pg_catalog;
CREATE TABLE sis_heracles.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table beca_investigacion_ganadores (OID = 383145981) : 
--
CREATE TABLE sis_heracles.beca_investigacion_ganadores (
    id serial NOT NULL,
    nombres varchar(100),
    fecha date,
    nota numeric(20,2),
    conv varchar(10),
    id_alumno integer,
    id_ra varchar(12)
)
;
ALTER TABLE ONLY sis_heracles.beca_investigacion_ganadores ALTER COLUMN id SET STATISTICS 0;
ALTER TABLE ONLY sis_heracles.beca_investigacion_ganadores ALTER COLUMN nombres SET STATISTICS 0;
ALTER TABLE ONLY sis_heracles.beca_investigacion_ganadores ALTER COLUMN fecha SET STATISTICS 0;
ALTER TABLE ONLY sis_heracles.beca_investigacion_ganadores ALTER COLUMN nota SET STATISTICS 0;
ALTER TABLE ONLY sis_heracles.beca_investigacion_ganadores ALTER COLUMN conv SET STATISTICS 0;
--
-- Structure for table convocatorias (OID = 383146744) : 
--
SET search_path = becas, pg_catalog;
CREATE TABLE becas.convocatorias (
    id_convocatoria integer,
    descripcion varchar,
    estado varchar DEFAULT 'A'::character varying
)
;
--
-- Structure for table busquedas_idx (OID = 383147969) : 
--
SET search_path = binvestigacion, pg_catalog;
CREATE TABLE binvestigacion.busquedas_idx (
    nro_dip varchar,
    id_alumno integer,
    idx tsvector
)
;
--
-- Structure for table busquedas_idx (OID = 383156848) : 
--
SET search_path = becas, pg_catalog;
CREATE TABLE becas.busquedas_idx (
    id_tipo integer,
    id_idx varchar,
    idx tsvector
)
;
--
-- Structure for table busquedas_tipos (OID = 383156867) : 
--
CREATE TABLE becas.busquedas_tipos (
    "1" integer,
    descripcion varchar
)
;
--
-- Structure for table users (OID = 383158034) : 
--
SET search_path = sis_heracles, pg_catalog;
CREATE TABLE sis_heracles.users (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    user_name varchar(255) NOT NULL,
    user_doc varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    status char(2) DEFAULT 'X'::bpchar NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table password_resets (OID = 383158046) : 
--
CREATE TABLE sis_heracles.password_resets (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone
)
;
--
-- Structure for table failed_jobs (OID = 383158055) : 
--
CREATE TABLE sis_heracles.failed_jobs (
    id bigserial NOT NULL,
    uuid varchar(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table personal_access_tokens (OID = 383158069) : 
--
CREATE TABLE sis_heracles.personal_access_tokens (
    id bigserial NOT NULL,
    tokenable_type varchar(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name varchar(255) NOT NULL,
    token varchar(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table permissions (OID = 383158083) : 
--
CREATE TABLE sis_heracles.permissions (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    guard_name varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table roles (OID = 383158096) : 
--
CREATE TABLE sis_heracles.roles (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    guard_name varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table model_has_permissions (OID = 383158107) : 
--
CREATE TABLE sis_heracles.model_has_permissions (
    permission_id bigint NOT NULL,
    model_type varchar(255) NOT NULL,
    model_id bigint NOT NULL
)
;
--
-- Structure for table model_has_roles (OID = 383158118) : 
--
CREATE TABLE sis_heracles.model_has_roles (
    role_id bigint NOT NULL,
    model_type varchar(255) NOT NULL,
    model_id bigint NOT NULL
)
;
--
-- Structure for table role_has_permissions (OID = 383158129) : 
--
CREATE TABLE sis_heracles.role_has_permissions (
    permission_id bigint NOT NULL,
    role_id bigint NOT NULL
)
;
--
-- Structure for table diccionario_terminos (OID = 383174779) : 
--
SET search_path = miaa, pg_catalog;
CREATE TABLE miaa.diccionario_terminos (
    id serial NOT NULL,
    termino varchar,
    definicion text,
    fuente varchar,
    idx tsvector,
    updated_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone
)
;
--
-- Structure for table auxiliares (OID = 383178168) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE TABLE auxiliares.auxiliares (
    id serial NOT NULL,
    id_programa char(3),
    id_alumno integer,
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    tipo_auxiliar varchar DEFAULT 'TITULAR'::character varying,
    fecha_registro timestamp without time zone DEFAULT now(),
    estado varchar DEFAULT 'ACTIVO'::character varying,
    fecha_conclusion timestamp without time zone,
    nota double precision,
    id_oferta integer,
    usuario varchar(255),
    fecha_designacion date,
    id_materia_postulacion integer,
    id_materia_carrera integer,
    id_materia_reasignacion integer,
    id_materia_convalidacion integer,
    dia varchar,
    horario_desde varchar,
    horario_hasta varchar,
    ambiente varchar,
    sigla char(15)
)
;
--
-- Structure for table users (OID = 383179115) : 
--
SET search_path = dar, pg_catalog;
CREATE TABLE dar.users (
    id bigint DEFAULT nextval('users_id_seq'::regclass) NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    ci varchar(255) NOT NULL,
    nombres varchar(255) NOT NULL,
    ap_paterno varchar(30),
    ap_materno varchar(30),
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    estado varchar
)
;
--
-- Structure for table archivo_planillas (OID = 383179259) : 
--
CREATE TABLE dar.archivo_planillas (
    id bigserial NOT NULL,
    id_programa varchar(255) NOT NULL,
    sigla varchar(255) NOT NULL,
    id_gestion integer NOT NULL,
    id_periodo integer NOT NULL,
    id_grupo integer NOT NULL,
    archivo varchar(64) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    id_user bigint NOT NULL
)
;
--
-- Structure for table roles (OID = 383180132) : 
--
CREATE TABLE dar.roles (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    description varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table role_user (OID = 383180143) : 
--
CREATE TABLE dar.role_user (
    id bigserial NOT NULL,
    role_id bigint NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table matriculas_digitales (OID = 383195691) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.matriculas_digitales (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    importe numeric(10,2) DEFAULT 0,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    fecha_transaccion_bancaria date,
    nro_transaccion_bancaria varchar,
    importe_transaccion_bancaria numeric(10,2),
    img_deposito_bancario bytea,
    fecha_creacion timestamp without time zone DEFAULT now(),
    hash varchar,
    obs_conciliacion text,
    id_extracto_bancario integer,
    id_matricula integer,
    tipo_matricula integer DEFAULT 0,
    cpt varchar,
    id_cpt varchar,
    tramite_id varchar,
    fin_vigencia varchar,
    fecha_validez varchar,
    inicio_vigencia varchar,
    id_qr varchar,
    url varchar,
    metodo_pago char(5),
    codigo_transaccion varchar,
    fecha_transaccion timestamp(0) without time zone,
    id_tipo_tramite char(1) DEFAULT 'M'::bpchar,
    tipo_matricula_estudiante varchar DEFAULT 'ER'::character varying,
    codigo_orden varchar,
    qr text,
    agrupado char(1) DEFAULT 'N'::bpchar,
    fecha_pago timestamp without time zone,
    obs char(1),
    importe_original numeric
)
;
--
-- Structure for table extracto_bancario (OID = 383196020) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.extracto_bancario (
    id integer DEFAULT nextval('estracto_bancario_id_seq'::regclass) NOT NULL,
    fecha_movimiento date,
    agencia varchar,
    descripcion varchar,
    nro_documento varchar,
    monto numeric(10,2),
    saldo numeric(10,2),
    fec_crea timestamp without time zone,
    estado varchar DEFAULT 'PENDIENTE'::character varying,
    usr_conciliacion varchar,
    id_matricula_digital integer,
    importe_importacion varchar,
    id_extracto integer
)
;
--
-- Structure for table investigacion_social_2 (OID = 396749209) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TABLE balimentacion.investigacion_social_2 (
    id serial NOT NULL,
    id_alumno integer NOT NULL,
    id_trab_social integer NOT NULL,
    id_gestion integer NOT NULL,
    id_periodo integer DEFAULT 1 NOT NULL,
    motivo varchar(1),
    ref_caso text,
    ant_familia text,
    sit_act_estudiante text,
    concep_social text,
    conclusion text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    estado varchar DEFAULT 'PENDIENTE'::character varying,
    sugerencia varchar DEFAULT 'ACEPTADO'::character varying
)
;
--
-- Structure for table matriculas_digitales_detalles (OID = 396768329) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.matriculas_digitales_detalles (
    id integer DEFAULT nextval('matriculas_detalles_id_seq'::regclass) NOT NULL,
    id_matricula_digital integer,
    id_cargo varchar(4),
    id_concepto varchar(4),
    costo numeric(12,2)
)
;
--
-- Structure for table usuarios (OID = 396955075) : 
--
SET search_path = dar, pg_catalog;
CREATE TABLE dar.usuarios (
    id serial NOT NULL,
    nombres varchar(25) NOT NULL,
    ap_paterno varchar(25),
    ap_materno varchar(25),
    ci varchar(15),
    login varchar(15),
    password varchar(64),
    estado char(1),
    remember_token varchar(64),
    permisos json
)
;
--
-- Structure for table dar_documentos (OID = 396955090) : 
--
CREATE TABLE dar.dar_documentos (
    id_documento serial NOT NULL,
    id_alumno integer NOT NULL,
    documento char(1) NOT NULL,
    estado char(1) NOT NULL,
    observaciones text,
    id_usuario integer NOT NULL,
    id_ultimo_us integer,
    revisado timestamp(0) without time zone,
    decretado timestamp(0) without time zone,
    recibido timestamp(0) without time zone NOT NULL,
    k boolean DEFAULT false NOT NULL,
    id_us_revision integer
)
;
--
-- Structure for table dar_libros (OID = 396955114) : 
--
CREATE TABLE dar.dar_libros (
    id_registro serial NOT NULL,
    id_documento integer NOT NULL,
    fecha timestamp(0) without time zone DEFAULT now() NOT NULL,
    id_usuario integer NOT NULL,
    libro char(1)
)
;
--
-- Structure for table votacion (OID = 396962323) : 
--
SET search_path = elecciones, pg_catalog;
CREATE TABLE elecciones.votacion (
    id serial NOT NULL,
    fecha date,
    id_mesa integer,
    id_cand integer,
    votos integer,
    portotal numeric(10,2),
    porvalido numeric(10,2),
    estado varchar DEFAULT 'Solicitado'::character varying,
    fec_cre timestamp(0) without time zone DEFAULT now()
)
;
--
-- Structure for table pagos (OID = 396965855) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.pagos (
    id bigserial NOT NULL,
    id_tipo_tramite integer,
    id_usuario varchar,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    fecha_creacion timestamp without time zone DEFAULT (now())::timestamp without time zone,
    fecha_vencimiento timestamp(0) without time zone,
    codigo_orden varchar,
    codigo_ctp varchar,
    hash varchar
)
;
--
-- Structure for table tipo_tramite (OID = 396965887) : 
--
CREATE TABLE cajas.tipo_tramite (
    id serial NOT NULL,
    decripcion varchar,
    id_concepto varchar,
    estado varchar
)
;
--
-- Structure for table pagos_agetic (OID = 396985632) : 
--
CREATE TABLE cajas.pagos_agetic (
    id bigserial NOT NULL,
    id_pago bigint,
    fecha_creacion timestamp without time zone,
    fecha_vencimiento timestamp without time zone,
    codigo_orden varchar,
    codigo_cpt varchar
)
;
--
-- Structure for table pagos_deposito (OID = 396985641) : 
--
CREATE TABLE cajas.pagos_deposito (
    id bigserial NOT NULL,
    id_pago bigint,
    comprobante varchar,
    fecha_transaccion timestamp without time zone,
    importe numeric,
    imagen bytea
)
;
--
-- Structure for table migrations (OID = 397002576) : 
--
SET search_path = psa, pg_catalog;
CREATE TABLE psa.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table users (OID = 397002584) : 
--
CREATE TABLE psa.users (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table password_reset_tokens (OID = 397002595) : 
--
CREATE TABLE psa.password_reset_tokens (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone
)
;
--
-- Structure for table failed_jobs (OID = 397002605) : 
--
CREATE TABLE psa.failed_jobs (
    id bigserial NOT NULL,
    uuid varchar(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table personal_access_tokens (OID = 397002619) : 
--
CREATE TABLE psa.personal_access_tokens (
    id bigserial NOT NULL,
    tokenable_type varchar(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name varchar(255) NOT NULL,
    token varchar(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table suspensiones_readmisiones (OID = 397002830) : 
--
SET search_path = tramites, pg_catalog;
CREATE TABLE tramites.suspensiones_readmisiones (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    tiempo numeric,
    obs text,
    id_gestion_ini integer,
    id_gestion_fin integer,
    id_periodo_ini integer,
    id_periodo_fin integer,
    fecha_solicitud timestamp without time zone DEFAULT now(),
    fecha_aprobacion timestamp without time zone,
    usuario_aprobacion varchar,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    fecha_ingreso varchar,
    gestion_ingreso varchar,
    periodo_suspension varchar,
    desde varchar,
    hasta varchar,
    motivo varchar,
    tipo_tramite varchar(10) DEFAULT 'SR'::character varying
)
;
--
-- Structure for table nota_lugar (OID = 410783162) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.nota_lugar (
    id_alumno integer,
    lugar1 varchar(200),
    nota2 integer,
    nota3 integer,
    nota4 integer,
    nota5 integer,
    nota1 integer,
    lugar2 varchar(200),
    lugar3 varchar(200),
    lugar4 varchar(200),
    lugar5 varchar(200),
    id_nota integer DEFAULT nextval('nota_lugar_id_nota_seq'::regclass) NOT NULL,
    id_acta integer
)
;
--
-- Structure for table informacion_social (OID = 410915918) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.informacion_social (
    id serial NOT NULL,
    id_postulante integer,
    id_loc integer,
    tipo_vivienda varchar,
    id_estado_civil integer,
    lugar_trabajo varchar,
    profesion varchar,
    ingreso_monto numeric
)
;
--
-- Structure for table pagos_ppe_detalles (OID = 410920476) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.pagos_ppe_detalles (
    id serial NOT NULL,
    id_pagos_ppe integer,
    id_cargo varchar,
    id_concepto varchar,
    costo numeric
)
;
--
-- Structure for table pagos_ppe (OID = 410920532) : 
--
CREATE TABLE cajas.pagos_ppe (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    id_tipo_tramite integer,
    codigo_valor varchar,
    id_alumno integer,
    importe numeric(10,2) DEFAULT 0,
    estado varchar DEFAULT 'SOLICITADO'::character varying,
    fecha_creacion timestamp without time zone DEFAULT now(),
    fecha_vigencia timestamp without time zone,
    hash varchar,
    codigo_orden varchar,
    codigo_transaccion varchar,
    metodo_pago char(5),
    obs text,
    id_matricula integer,
    nro_dip varchar
)
;
--
-- Structure for table failed_jobs (OID = 425348793) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.failed_jobs (
    id bigserial NOT NULL,
    uuid varchar(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table migrations (OID = 425348805) : 
--
CREATE TABLE actas_graduacion.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table users (OID = 425348840) : 
--
CREATE TABLE actas_graduacion.users (
    id bigserial NOT NULL,
    nombrecompleto varchar(255) NOT NULL,
    usuario varchar(255) NOT NULL,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    sexo varchar(2),
    id_programa varchar(20),
    estado varchar(1)
)
;
--
-- Structure for table roles (OID = 425348866) : 
--
CREATE TABLE actas_graduacion.roles (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    guard_name varchar(255) NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)
;
--
-- Structure for table password_resets (OID = 425348877) : 
--
CREATE TABLE actas_graduacion.password_resets (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp without time zone
)
;
--
-- Structure for table password_reset_tokens (OID = 425348885) : 
--
CREATE TABLE actas_graduacion.password_reset_tokens (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp without time zone
)
;
--
-- Structure for table permissions (OID = 425348895) : 
--
CREATE TABLE actas_graduacion.permissions (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    guard_name varchar(255) NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)
;
--
-- Structure for table role_has_permissions (OID = 425348919) : 
--
CREATE TABLE actas_graduacion.role_has_permissions (
    permission_id bigint NOT NULL,
    role_id bigint NOT NULL
)
;
--
-- Structure for table model_has_roles (OID = 425348934) : 
--
CREATE TABLE actas_graduacion.model_has_roles (
    role_id bigint NOT NULL,
    model_type varchar(255) NOT NULL,
    model_id bigint NOT NULL
)
;
--
-- Structure for table model_has_permissions (OID = 425348944) : 
--
CREATE TABLE actas_graduacion.model_has_permissions (
    permission_id bigint NOT NULL,
    model_type varchar(255) NOT NULL,
    model_id bigint NOT NULL
)
;
--
-- Structure for table personal_access_tokens (OID = 425348984) : 
--
CREATE TABLE actas_graduacion.personal_access_tokens (
    id bigserial NOT NULL,
    tokenable_type varchar(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name varchar(255) NOT NULL,
    token varchar(64) NOT NULL,
    abilities text,
    last_used_at timestamp without time zone,
    expires_at timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)
;
--
-- Structure for table secretarias (OID = 425349201) : 
--
CREATE TABLE actas_graduacion.secretarias (
    id serial NOT NULL,
    id_usuario bigint NOT NULL,
    id_facultad bigint NOT NULL,
    sexo varchar(2),
    id_programa varchar(20)
)
;
--
-- Structure for table decanos (OID = 425349917) : 
--
CREATE TABLE actas_graduacion.decanos (
    id serial NOT NULL,
    id_docente bigint NOT NULL,
    id_facultad bigint NOT NULL,
    tipo_decano varchar(200) NOT NULL
)
;
--
-- Structure for table asignar_tipos_defensa_carrera (OID = 425349991) : 
--
CREATE TABLE actas_graduacion.asignar_tipos_defensa_carrera (
    id serial NOT NULL,
    id_carrera varchar(3) NOT NULL,
    id_modalidad bigint NOT NULL
)
;
--
-- Structure for table actas (OID = 425352694) : 
--
CREATE TABLE actas_graduacion.actas (
    id serial NOT NULL,
    id_alumno integer,
    id_carrera varchar(30),
    id_tipo_acta integer,
    estado varchar,
    titulo varchar(800),
    fecha_solicitud date,
    ambiente varchar(100),
    fecha_hora_inicio timestamp(0) without time zone,
    fecha_hora_fin time(0) without time zone,
    nota numeric(4,0),
    rango varchar(30),
    dictamen varchar(30),
    resolucion varchar(30),
    grupo varchar(50),
    memorial varchar(30),
    libro varchar(30),
    fojas varchar(30),
    id_nota integer,
    razon varchar(300),
    fecha_emision date,
    area varchar(100),
    fecha_juramento timestamp(0) without time zone,
    fecha_fin1 time(0) without time zone,
    rango2 varchar(50),
    fojas1 varchar(50),
    libro1 varchar(20),
    resoluciones varchar(50),
    fecha1 timestamp(0) without time zone,
    resolucion_ad varchar(30),
    id_tribunal integer,
    "id_grupoAuditorias" integer,
    id_grupocontable integer,
    id_grupo integer,
    nivel_academico varchar(50),
    id_grado_academico integer,
    area2 integer
)
;
--
-- Structure for table multas_matriculas (OID = 425580636) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.multas_matriculas (
    id_concepto varchar,
    importe numeric,
    fecha_ini timestamp without time zone,
    fecha_fin timestamp without time zone,
    id_gestion integer,
    id_periodo integer,
    estado varchar,
    id_programas varchar(3)[]
)
;
--
-- Structure for table extracto_ppe (OID = 439968639) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.extracto_ppe (
    id integer DEFAULT nextval('exrtacto_ppe_id_seq'::regclass) NOT NULL,
    codigo_transaccion varchar(15),
    codigo_orden varchar,
    fecha_pago date,
    nro_documento varchar,
    nombre_cliente varchar,
    tipo_pago varchar,
    monto numeric(10,2),
    fecha_creacion timestamp without time zone DEFAULT now(),
    obs varchar
)
;
--
-- Structure for table analisis_datos (OID = 440000202) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.analisis_datos (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    id_programa char(3),
    id_alumno integer,
    permanencia_periodos integer,
    permanencia_gestion numeric,
    promedio_aprobados numeric,
    promedio_general numeric,
    termino_malla varchar,
    cant_mat_sig_gestion integer,
    desertor char(1),
    abandono char(1),
    fecha_acta varchar,
    materias_programadas integer
)
;
--
-- Structure for table cargos_autoridades (OID = 440010911) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.cargos_autoridades (
    id_docente integer,
    id_programa char(3),
    cargo varchar,
    tipo integer,
    estado varchar,
    fecha_inicial timestamp without time zone DEFAULT now(),
    fecha_final timestamp without time zone
)
;
--
-- Structure for table datos_auditoria (OID = 440015576) : 
--
SET search_path = becas, pg_catalog;
CREATE TABLE becas.datos_auditoria (
    id serial NOT NULL,
    nro varchar,
    nro_dip varchar,
    nombres varchar,
    tipo_beca varchar,
    id_prorama varchar,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table libros_actas (OID = 440175096) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.libros_actas (
    id serial NOT NULL,
    id_programa varchar(20),
    numero_libro integer,
    cantidad_hojas_x_acta integer,
    estado varchar,
    numero_actual integer
)
;
--
-- Structure for table libros_actas_programas_tipos (OID = 440175178) : 
--
CREATE TABLE actas_graduacion.libros_actas_programas_tipos (
    id serial NOT NULL,
    id_libro_acta integer,
    id_programa char(3),
    id_tipo_acta smallint,
    cantidad_hojas_x_acta smallint
)
;
--
-- Structure for table actas_area (OID = 440184105) : 
--
CREATE TABLE actas_graduacion.actas_area (
    id_area integer,
    id_programa varchar(20),
    area varchar(100),
    materia varchar(70)
)
;
ALTER TABLE ONLY actas_graduacion.actas_area ALTER COLUMN id_area SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.actas_area ALTER COLUMN id_programa SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.actas_area ALTER COLUMN area SET STATISTICS 0;
--
-- Structure for table docentes_actas (OID = 440216819) : 
--
CREATE TABLE actas_graduacion.docentes_actas (
    id_tribunal serial NOT NULL,
    tribunal1 varchar(20),
    tribunal2 varchar(100),
    tribunal3 varchar(100),
    tribunal4 varchar(20),
    tribunal5 varchar(20),
    tribunal6 varchar(20),
    tribunal_juramento varchar(20),
    decano_ia varchar(20),
    director_ia varchar(20),
    decano varchar(20),
    director varchar(20),
    decano2 varchar(20),
    decano2_ia varchar(20),
    director2_ia integer
)
;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN id_tribunal SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN tribunal1 SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN tribunal2 SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN tribunal3 SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN tribunal4 SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN tribunal5 SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN tribunal6 SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN tribunal_juramento SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN decano_ia SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN director_ia SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN decano SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.docentes_actas ALTER COLUMN director SET STATISTICS 0;
--
-- Definition for foreign table tra_dia (OID = 440237873) : 
--
SET search_path = daf, pg_catalog;
CREATE FOREIGN TABLE daf.tra_dia (
    id_dia integer,
    id_tran integer DEFAULT nextval(('"daf"."tra_dia_id_tran_seq"'::text)::regclass) NOT NULL,
    cod_val char(5),
    can_val numeric(8,0),
    pre_uni numeric(10,2),
    imp_val numeric(10,2),
    desde integer DEFAULT 0,
    hasta integer DEFAULT 0,
    fec_tra date,
    usr_cre varchar(15),
    fec_cre timestamp with time zone DEFAULT now(),
    nro_com char(6) DEFAULT ''::bpchar,
    ci_per char(15),
    des_per varchar(80),
    obs text,
    tip_tra smallint DEFAULT 0,
    tra_imp smallint DEFAULT 0,
    gestion smallint,
    tra_ver smallint DEFAULT 0
)
SERVER server_daf
OPTIONS (
  schema_name 'val',
  table_name 'tra_dia');
--
-- Structure for table modalidad_especial (OID = 440250029) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.modalidad_especial (
    id_mod serial NOT NULL,
    estado varchar(20),
    id_tribunal varchar(20),
    tipo varchar(50),
    fecha_hora_inicio timestamp(0) without time zone,
    hora_fin time(0) without time zone,
    libro integer,
    fojas varchar(20),
    cantidad_hojas integer,
    id_programa varchar(10),
    categoria varchar(50)
)
;
ALTER TABLE ONLY actas_graduacion.modalidad_especial ALTER COLUMN id_mod SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.modalidad_especial ALTER COLUMN estado SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.modalidad_especial ALTER COLUMN id_tribunal SET STATISTICS 0;
ALTER TABLE ONLY actas_graduacion.modalidad_especial ALTER COLUMN tipo SET STATISTICS 0;
--
-- Structure for table soa (OID = 440260109) : 
--
SET search_path = calendario, pg_catalog;
CREATE TABLE calendario.soa (
    id integer DEFAULT nextval(('calendario.soa_id_seq'::text)::regclass) NOT NULL,
    id_padre integer,
    id_programa varchar,
    descripcion varchar,
    id_tipo_calendario char(1),
    estado varchar,
    id_programa_daf varchar,
    orden smallint
)
;
--
-- Structure for table tipo_calendario (OID = 440260121) : 
--
CREATE TABLE calendario.tipo_calendario (
    id char(1) NOT NULL,
    descripcion varchar,
    estado varchar DEFAULT 'VIGENTE'::character varying
)
;
--
-- Structure for table actividades_detalles (OID = 440260230) : 
--
CREATE TABLE calendario.actividades_detalles (
    id serial NOT NULL,
    id_soa integer,
    id_actividad integer,
    fecha_inicial timestamp without time zone,
    fecha_final timestamp without time zone,
    estado varchar
)
;
--
-- Structure for table datos_programa (OID = 440289209) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.datos_programa (
    id_programa varchar(20),
    nivel_tecnico varchar(50),
    programa varchar(50),
    grado_academico varchar(100),
    sede varchar(50),
    id_facultad integer,
    diploma_academico_m varchar(100),
    diploma_academico_f varchar(100),
    diploma_academico_tec varchar(100)
)
;
ALTER TABLE ONLY actas_graduacion.datos_programa ALTER COLUMN id_programa SET STATISTICS 0;
--
-- Structure for table asignaciones (OID = 440303821) : 
--
SET search_path = designaciones, pg_catalog;
CREATE TABLE designaciones.asignaciones (
    id serial NOT NULL,
    fecha timestamp without time zone,
    id_programa char(3),
    id_gestion integer,
    id_periodo integer,
    obs text,
    estado varchar DEFAULT 'SOLICITADO'::character varying
)
;
--
-- Structure for table asignaciones_detalles (OID = 440303830) : 
--
CREATE TABLE designaciones.asignaciones_detalles (
    id serial NOT NULL,
    id_asignaciones integer NOT NULL,
    id_materia integer,
    id_docente integer,
    id_grupo integer,
    fecha timestamp without time zone,
    habilitado boolean,
    fecha_aprovacion timestamp without time zone,
    usr_aprovacion varchar,
    estado varchar,
    id_dct_asignaciones integer
)
;
--
-- Structure for table parametros_ecp (OID = 440305022) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.parametros_ecp (
    total_materias integer,
    parametro_aprobados integer,
    parametro_abandono integer
)
;
--
-- Structure for table pos_colegios (OID = 440305521) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.pos_colegios (
    id serial NOT NULL,
    cod_dep varchar,
    departamento varchar,
    cod_prov varchar,
    provincia varchar,
    cod_sec_mun varchar,
    seccion_municipal varchar,
    cod_loc varchar,
    localidad varchar,
    cod_distrito varchar,
    distrito_educativo varchar,
    subsistema varchar,
    cod_dependencia varchar,
    dependencia varchar,
    nivel_ini varchar,
    nivel_pri varchar,
    nivel_sec varchar,
    codigo_edificio varchar,
    cod_ue varchar,
    unidad_educativa varchar,
    turno varchar,
    numero_bachilleres integer
)
;
--
-- Structure for table control_pagos (OID = 440308935) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.control_pagos (
    id serial NOT NULL,
    id_matricula_digital integer,
    nro_orden integer
)
;
--
-- Structure for table control_ejecucion (OID = 440308942) : 
--
CREATE TABLE matriculas.control_ejecucion (
    id serial NOT NULL,
    nro_ejecucion integer DEFAULT 1
)
;
--
-- Structure for table grado_academico (OID = 440339005) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.grado_academico (
    id_grado_academico integer,
    grado_academico varchar(100)
)
;
ALTER TABLE ONLY actas_graduacion.grado_academico ALTER COLUMN id_grado_academico SET STATISTICS 0;
--
-- Structure for table psa (OID = 440384257) : 
--
SET search_path = sau, pg_catalog;
CREATE TABLE sau.psa (
    id serial NOT NULL,
    nro_dip varchar,
    nota varchar,
    id_programa varchar(3),
    id_modalidad integer,
    id_gestion integer,
    id_periodo integer,
    paterno varchar,
    materno varchar,
    nombres varchar,
    obs varchar
)
;
--
-- Structure for table audits (OID = 440580456) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.audits (
    id serial NOT NULL,
    auditable_type varchar(255) NOT NULL,
    auditable_id bigint NOT NULL,
    event varchar(50) NOT NULL,
    old_values json,
    new_values json,
    user_id bigint,
    url varchar(2083),
    ip_address inet,
    user_agent text,
    tags varchar(255),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table cursos_moodle (OID = 440692784) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE TABLE auxiliares.cursos_moodle (
    id integer,
    sigla varchar,
    descripcion varchar,
    id_grupo integer,
    id_curso_moodle integer,
    link_whatsapp varchar,
    estado varchar,
    cantidad_actual integer DEFAULT 0,
    cantidad_maxima integer DEFAULT 250,
    id_gestion integer,
    id_periodo integer
)
;
--
-- Structure for table cargos_conceptos (OID = 440898809) : 
--
SET search_path = cajas, pg_catalog;
CREATE TABLE cajas.cargos_conceptos (
    id_cargo char(5),
    id_concepto char(5),
    importe numeric(8,2),
    estado varchar(1) DEFAULT 'V'::character varying,
    tipo e_cargos_conceptos DEFAULT 'CONCEPTOS'::e_cargos_conceptos
)
;
--
-- Structure for table aux_importados (OID = 441064991) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE TABLE auxiliares.aux_importados (
    nro integer,
    nro_dip varchar,
    apellidos_nombres varchar,
    sigla varchar,
    materia varchar,
    tipo_des varchar,
    carrera varchar,
    tipo char(1),
    id_grupo integer,
    id_programa varchar,
    id_alumno integer
)
;
--
-- Structure for table habilitados (OID = 441126226) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.habilitados (
    id_programa char(3),
    id_gestion integer,
    id_periodo integer,
    estado varchar DEFAULT 'VIGENTE'::character varying,
    fecha timestamp(0) without time zone DEFAULT now(),
    fecha_limite timestamp without time zone,
    estado_regulares varchar DEFAULT 'PENDIENTE'::character varying,
    fecha_regulares_ini timestamp without time zone DEFAULT now(),
    fecha_regulares_fin timestamp without time zone,
    multa_regulares char(1) DEFAULT 'N'::bpchar,
    estado_nuevos varchar DEFAULT 'PENDIENTE'::character varying,
    fecha_nuevos_ini timestamp without time zone DEFAULT now(),
    fecha_nuevos_fin timestamp without time zone,
    multa_nuevos char(1) DEFAULT 'N'::bpchar
)
;
--
-- Structure for table solicitudes_matriculas (OID = 441133916) : 
--
CREATE TABLE matriculas.solicitudes_matriculas (
    id integer DEFAULT nextval('solictudes_matriculas_id_seq'::regclass) NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    obs varchar,
    fecha timestamp without time zone DEFAULT now(),
    fecha_ini timestamp without time zone DEFAULT now(),
    fecha_fin timestamp without time zone,
    estado varchar DEFAULT 'SOLCITADO'::character varying,
    tipo_matricula varchar(4) DEFAULT 'N'::bpchar
)
;
--
-- Structure for table programas_matriculas (OID = 441151163) : 
--
CREATE TABLE matriculas.programas_matriculas (
    id_matricula varchar(5),
    id_programa varchar(3),
    id_valor varchar(4),
    tipo_estudiante varchar(2),
    estado varchar
)
;
--
-- Structure for table areas (OID = 441154169) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.areas (
    id serial NOT NULL,
    area varchar,
    descripcion text,
    estado varchar
)
;
--
-- Structure for table convocatorias_sau (OID = 441161648) : 
--
SET search_path = sau, pg_catalog;
CREATE TABLE sau.convocatorias_sau (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    obs varchar,
    documento bytea,
    estado varchar
)
;
--
-- Structure for table transacciones (OID = 441276245) : 
--
SET search_path = ppe, pg_catalog;
CREATE TABLE ppe.transacciones (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    importe numeric,
    estado varchar(1),
    codigo_orden varchar(15),
    codigo_transaccion varchar,
    tipo_transaccion char(2),
    fecha_transaccion timestamp without time zone,
    fecha_pago_ppe timestamp without time zone,
    url varchar,
    tipo_pago char(10),
    img bytea
)
;
--
-- Structure for table pln_materias_tmp (OID = 441477035) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.pln_materias_tmp (
    id_materia integer NOT NULL,
    sigla char(7) NOT NULL,
    materia varchar NOT NULL,
    hrs_teoricas smallint DEFAULT 0,
    hrs_practicas smallint DEFAULT 0,
    ciclo integer DEFAULT 0,
    id_dpto char(3) DEFAULT '1'::bpchar,
    hrs_laboratorio smallint DEFAULT 0,
    id_programa char(3),
    color char(7) DEFAULT '#000000'::bpchar,
    nivel_academico smallint,
    grupom varchar DEFAULT 'XXXX'::bpchar,
    mension integer DEFAULT (0)::bigint,
    control bigint DEFAULT 0,
    id_plan integer,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    nota_minima smallint DEFAULT 51 NOT NULL,
    tiene_viaje_practica boolean DEFAULT false,
    mostrarnotas boolean DEFAULT true,
    atributos varchar[],
    _obs varchar DEFAULT ''::character varying NOT NULL,
    _creditos smallint DEFAULT 0 NOT NULL,
    id_materia_padre integer,
    descripcion varchar,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    materia_graduacion char(2) DEFAULT 'NO'::bpchar,
    imprimir_certificado char(1) DEFAULT 'S'::bpchar NOT NULL,
    hrs_semana smallint,
    hrs_semestre smallint,
    creditos smallint
)
;
--
-- Structure for table datos_becas (OID = 441571704) : 
--
SET search_path = auditoria, pg_catalog;
CREATE TABLE auditoria.datos_becas (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    id_programa varchar,
    programa varchar,
    nro_dip varchar,
    apellidos_nombres varchar,
    id_alumno integer,
    tipo_beca varchar,
    estado varchar(1)
)
;
--
-- Structure for table becas_personal_2025 (OID = 441581778) : 
--
SET search_path = becas, pg_catalog;
CREATE TABLE becas.becas_personal_2025 (
    id serial NOT NULL,
    cat_des varchar,
    ci varchar,
    persona varchar,
    facultad varchar,
    id_programa char(3),
    programa varchar,
    id_alumno integer,
    sede varchar,
    descripcion varchar,
    id_tipo_beca integer,
    nombre_beca varchar,
    mes integer
)
;
--
-- Structure for table migrations (OID = 441583656) : 
--
SET search_path = b_investigacion, pg_catalog;
CREATE TABLE b_investigacion.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table users (OID = 441583845) : 
--
CREATE TABLE b_investigacion.users (
    id bigserial NOT NULL,
    ci varchar(255) NOT NULL,
    nombres varchar(255) NOT NULL,
    paterno varchar(255) NOT NULL,
    materno varchar(255) NOT NULL,
    username varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table password_reset_tokens (OID = 441583861) : 
--
CREATE TABLE b_investigacion.password_reset_tokens (
    email varchar(255) NOT NULL,
    token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone
)
;
--
-- Structure for table sessions (OID = 441583869) : 
--
CREATE TABLE b_investigacion.sessions (
    id varchar(255) NOT NULL,
    user_id bigint,
    ip_address varchar(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
)
;
--
-- Structure for table cache (OID = 441583879) : 
--
CREATE TABLE b_investigacion.cache (
    key varchar(255) NOT NULL,
    value text NOT NULL,
    expiration integer NOT NULL
)
;
--
-- Structure for table cache_locks (OID = 441583887) : 
--
CREATE TABLE b_investigacion.cache_locks (
    key varchar(255) NOT NULL,
    owner varchar(255) NOT NULL,
    expiration integer NOT NULL
)
;
--
-- Structure for table jobs (OID = 441583897) : 
--
CREATE TABLE b_investigacion.jobs (
    id bigserial NOT NULL,
    queue varchar(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
)
;
--
-- Structure for table job_batches (OID = 441583907) : 
--
CREATE TABLE b_investigacion.job_batches (
    id varchar(255) NOT NULL,
    name varchar(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
)
;
--
-- Structure for table failed_jobs (OID = 441583917) : 
--
CREATE TABLE b_investigacion.failed_jobs (
    id bigserial NOT NULL,
    uuid varchar(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table permissions (OID = 441583931) : 
--
CREATE TABLE b_investigacion.permissions (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    guard_name varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table roles (OID = 441583944) : 
--
CREATE TABLE b_investigacion.roles (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    guard_name varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table model_has_permissions (OID = 441583955) : 
--
CREATE TABLE b_investigacion.model_has_permissions (
    permission_id bigint NOT NULL,
    model_type varchar(255) NOT NULL,
    model_id bigint NOT NULL
)
;
--
-- Structure for table model_has_roles (OID = 441583966) : 
--
CREATE TABLE b_investigacion.model_has_roles (
    role_id bigint NOT NULL,
    model_type varchar(255) NOT NULL,
    model_id bigint NOT NULL
)
;
--
-- Structure for table role_has_permissions (OID = 441583977) : 
--
CREATE TABLE b_investigacion.role_has_permissions (
    permission_id bigint NOT NULL,
    role_id bigint NOT NULL
)
;
--
-- Structure for table users (OID = 441584070) : 
--
SET search_path = estudiantes, pg_catalog;
CREATE TABLE estudiantes.users (
    id integer DEFAULT nextval('users_id_seq1'::regclass) NOT NULL,
    username varchar(20),
    email varchar(100),
    password varchar(64) NOT NULL,
    first_name varchar(50) NOT NULL,
    last_name varchar(50) NOT NULL,
    remember_token varchar(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    id_unidad integer,
    id_estado integer DEFAULT 4 NOT NULL,
    last_name_m varchar(50),
    ci varchar(15),
    telefono numeric,
    clave varchar,
    _usuario varchar DEFAULT ''::character varying NOT NULL,
    tel_per varchar
)
;
--
-- Structure for table tipo_rol (OID = 441584239) : 
--
CREATE TABLE estudiantes.tipo_rol (
    id serial NOT NULL,
    nombre_tipo varchar(255),
    id_usuario integer,
    fecha_creacion timestamp without time zone DEFAULT now(),
    fecha_modificacion timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table roles (OID = 441584256) : 
--
CREATE TABLE estudiantes.roles (
    id serial NOT NULL,
    name varchar(255) NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    id_usuario integer,
    id_tipo integer
)
;
--
-- Structure for table assigned_roles (OID = 441584278) : 
--
CREATE TABLE estudiantes.assigned_roles (
    id serial NOT NULL,
    user_id integer NOT NULL,
    role_id integer NOT NULL
)
;
--
-- Structure for table notificaciones (OID = 441596423) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.notificaciones (
    id serial NOT NULL,
    finalizado boolean,
    fuente varchar,
    estado varchar,
    codigo_seguimiento varchar,
    fecha timestamp without time zone,
    mensaje varchar,
    fecha_registro timestamp without time zone DEFAULT now(),
    estado_operacion varchar(25),
    fecha_operacion timestamp without time zone,
    _obs char(1) DEFAULT 'N'::bpchar
)
;
--
-- Structure for table decretos (OID = 441610873) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.decretos (
    id bigserial NOT NULL,
    id_acta bigint NOT NULL,
    observacion text,
    usuario_id bigint,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)
;
--
-- Structure for table postulantes (OID = 441611248) : 
--
SET search_path = b_investigacion, pg_catalog;
CREATE TABLE b_investigacion.postulantes (
    id serial NOT NULL,
    id_convocatoria integer,
    id_alumno integer,
    titulotema text,
    resumentema text,
    ubicacionpdf varchar(300),
    _estado varchar(50),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    usuario char(15),
    id_documento integer
)
;
--
-- Structure for table convocatorias (OID = 441611267) : 
--
CREATE TABLE b_investigacion.convocatorias (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    descripcion varchar,
    fecha_inicial timestamp without time zone,
    fecha_final timestamp without time zone,
    estado varchar,
    documento bytea
)
;
--
-- Structure for table documentos (OID = 441611292) : 
--
CREATE TABLE b_investigacion.documentos (
    id serial NOT NULL,
    descripcion text,
    documento bytea,
    id_postulante integer
)
;
--
-- Structure for table actividades (OID = 441611307) : 
--
CREATE TABLE b_investigacion.actividades (
    id serial NOT NULL,
    id_becado integer,
    id_tipo_actividad integer,
    actividad varchar,
    fecha_inicial timestamp without time zone,
    fecha_final timestamp without time zone,
    porcentaje_avance numeric,
    id_documento integer
)
;
--
-- Structure for table becados (OID = 441611484) : 
--
CREATE TABLE b_investigacion.becados (
    id integer,
    id_postulacion integer,
    id_programa char(3),
    fecha_asignacion timestamp without time zone DEFAULT now(),
    nota_aprobacion numeric,
    id_docente integer,
    observacion text,
    estado varchar
)
;
--
-- Structure for table tipo_actividad (OID = 441611549) : 
--
CREATE TABLE b_investigacion.tipo_actividad (
    id_tipo_actividad integer,
    actividad varchar
)
;
--
-- Structure for table documentos (OID = 441614222) : 
--
SET search_path = saber, pg_catalog;
CREATE TABLE saber.documentos (
    id serial NOT NULL,
    fecha timestamp without time zone DEFAULT now(),
    descripcion varchar,
    archivo_pdf bytea,
    archivo_word bytea,
    archivo_txt text,
    resumen_txt text,
    estado varchar(15) DEFAULT 'PENDIENTE'::character varying
)
;
--
-- Structure for table busquedas_idx (OID = 441614234) : 
--
CREATE TABLE saber.busquedas_idx (
    id serial NOT NULL,
    id_trabajos integer,
    idx tsvector
)
;
--
-- Structure for table seguimiento_decretos (OID = 441617910) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TABLE actas_graduacion.seguimiento_decretos (
    id bigserial NOT NULL,
    id_acta bigint NOT NULL,
    ubicacion_actual varchar(255) DEFAULT 'facultad'::ubicacion_decreto NOT NULL,
    observacion text,
    usuario_id bigint,
    fecha_ingreso timestamp without time zone DEFAULT now() NOT NULL,
    fecha_salida timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table tipos_pago (OID = 441618929) : 
--
SET search_path = ppe, pg_catalog;
CREATE TABLE ppe.tipos_pago (
    id_tipo_pago char(10),
    descripcion varchar,
    obs varchar,
    estado char(10),
    costo numeric(5,2),
    credenciales varchar
)
;
--
-- Structure for table institutos (OID = 441620592) : 
--
SET search_path = b_investigacion, pg_catalog;
CREATE TABLE b_investigacion.institutos (
    id integer DEFAULT nextval('directores_id_seq'::regclass) NOT NULL,
    id_docente integer,
    id_gestion integer,
    id_periodo integer,
    tipo varchar(10) DEFAULT 'FACULTAD'::character varying,
    id_programa_facultad varchar(4)
)
;
--
-- Structure for table delegacion (OID = 441622215) : 
--
SET search_path = extension, pg_catalog;
CREATE TABLE extension.delegacion (
    id serial NOT NULL,
    nombres varchar,
    id_alumno integer,
    si_matricula varchar,
    cant_mat_prog integer,
    id_programa varchar,
    id_ra varchar,
    nro_dip varchar,
    nombres_reales varchar
)
;
--
-- Structure for table cambio_pago (OID = 441629795) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TABLE postulantes.cambio_pago (
    id serial NOT NULL,
    nro_dip varchar,
    id_postulacion_de integer,
    id_postulacion_a integer,
    id_modalidad_de integer,
    id_modalidad_a integer,
    obs text,
    usuario varchar
)
;
--
-- Structure for table examen_tipos_grupos (OID = 441639596) : 
--
SET search_path = sau, pg_catalog;
CREATE TABLE sau.examen_tipos_grupos (
    id_examenes integer,
    id_tipo_grupos integer,
    cantidad_preguntas integer,
    porcentaje numeric(6,2),
    nota_por_pregunta numeric DEFAULT 0
)
;
--
-- Structure for table actas (OID = 441644645) : 
--
SET search_path = estadisticas, pg_catalog;
CREATE TABLE estadisticas.actas (
    id_tramite integer,
    id_gestion integer,
    fecha date,
    id_alumno integer,
    nro_dip varchar,
    paterno varchar,
    materno varchar,
    nombres varchar,
    id_sexo char(1),
    id_programa varchar,
    programa varchar,
    desc_tramite integer,
    descripcion varchar,
    desc_tramite2 integer,
    descripcion2 varchar,
    veces_repite integer,
    nro_repeticion integer,
    nivel varchar
)
;
--
-- Structure for table programas_cargos (OID = 441720975) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TABLE matriculas.programas_cargos (
    id serial NOT NULL,
    id_programa char(3),
    id_cargo char(4),
    id_gestion integer,
    id_periodo integer,
    tipo_cargo char(10),
    estado char(1) DEFAULT 'A'::bpchar,
    fecha timestamp(0) without time zone DEFAULT now()
)
;
--
-- Structure for table categorias (OID = 441815485) : 
--
SET search_path = cronograma, pg_catalog;
CREATE TABLE cronograma.categorias (
    id_categoria serial NOT NULL,
    categoria varchar NOT NULL,
    descripcion text,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    estado varchar(1)
)
;
--
-- Structure for table actividades (OID = 441815510) : 
--
CREATE TABLE cronograma.actividades (
    id_actividad serial NOT NULL,
    actividad varchar NOT NULL,
    descripcion text,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    id_categoria integer NOT NULL,
    estado varchar
)
;
--
-- Structure for table pln_materias_resplado (OID = 442381048) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.pln_materias_resplado (
    id_materia integer DEFAULT nextval(('"pln_materias1_ne_id_materia_seq"'::text)::regclass) NOT NULL,
    sigla char(7) NOT NULL,
    materia varchar NOT NULL,
    hrs_teoricas smallint DEFAULT 0,
    hrs_practicas smallint DEFAULT 0,
    ciclo integer DEFAULT 0,
    id_dpto char(3) DEFAULT '1'::bpchar,
    hrs_laboratorio smallint DEFAULT 0,
    id_programa char(3),
    color char(7) DEFAULT '#000000'::bpchar,
    nivel_academico smallint,
    grupom varchar DEFAULT 'XXXX'::bpchar,
    mension integer DEFAULT (0)::bigint,
    control bigint DEFAULT 0,
    id_plan integer,
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    nota_minima smallint DEFAULT 51 NOT NULL,
    tiene_viaje_practica boolean DEFAULT false,
    mostrarnotas boolean DEFAULT true,
    atributos varchar[],
    _obs varchar DEFAULT ''::character varying NOT NULL,
    _creditos smallint DEFAULT 0 NOT NULL,
    id_materia_padre integer,
    descripcion varchar,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    materia_graduacion char(2) DEFAULT 'NO'::bpchar,
    imprimir_certificado char(1) DEFAULT 'S'::bpchar NOT NULL,
    hrs_semana smallint,
    hrs_semestre smallint,
    creditos smallint
)
;
--
-- Structure for table tipos_trabajo (OID = 442402519) : 
--
SET search_path = saber, pg_catalog;
CREATE TABLE saber.tipos_trabajo (
    id bigserial NOT NULL,
    nombre varchar(255) NOT NULL,
    nivel varchar(255) DEFAULT 'pregrado'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL
)
;
--
-- Structure for table trabajos (OID = 442403041) : 
--
CREATE TABLE saber.trabajos (
    id bigserial NOT NULL,
    titulo text NOT NULL,
    archivo_pdf varchar(255),
    estado varchar(255) DEFAULT 'BORRADOR'::character varying NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    observaciones text,
    id_materia integer,
    grupo_id integer,
    tutor varchar,
    gestion_publicacion integer,
    id_tipo_trabajo integer,
    fecha timestamp without time zone DEFAULT now(),
    autor varchar,
    id_programa char(3),
    id_documento integer,
    programa varchar,
    id_gestion integer,
    id_periodo integer DEFAULT 1,
    id_alumno integer DEFAULT 0,
    id_alm_programaciones integer,
    id_programacion integer,
    abstract_es text,
    abstract_en text,
    resumen text,
    id_docente integer,
    nivel varchar(255)
)
;
--
-- Structure for table sessions (OID = 442403266) : 
--
CREATE TABLE saber.sessions (
    id varchar(255) NOT NULL,
    user_id bigint,
    ip_address varchar(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
)
;
--
-- Structure for table auditorias (OID = 442403360) : 
--
CREATE TABLE saber.auditorias (
    id bigserial NOT NULL,
    user_id bigint NOT NULL,
    trabajo_id bigint NOT NULL,
    accion varchar(255) NOT NULL,
    descripcion text,
    ip varchar(255) DEFAULT NULL::character varying,
    user_agent varchar(255) DEFAULT NULL::character varying,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)
;
--
-- Structure for table users (OID = 442403435) : 
--
CREATE TABLE saber.users (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    password varchar(255) NOT NULL,
    remember_token varchar(100) DEFAULT NULL::character varying,
    created_at timestamp without time zone,
    update_at timestamp without time zone,
    role varchar(255) DEFAULT 'student'::character varying NOT NULL,
    ru varchar(255) DEFAULT NULL::character varying NOT NULL
)
;
--
-- Structure for table laboratorios (OID = 442404316) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.laboratorios (
    id_programa char(3),
    descripcion varchar,
    estado varchar
)
;
--
-- Structure for table horarios_materias (OID = 442429644) : 
--
SET search_path = lab, pg_catalog;
CREATE TABLE lab.horarios_materias (
    id serial NOT NULL,
    id_programa char(3),
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    id_dia integer,
    id_horas integer[],
    color char(7),
    cupo_maximo integer DEFAULT 0,
    estado char(1)
)
;
--
-- Structure for table colores (OID = 442429735) : 
--
CREATE TABLE lab.colores (
    id integer,
    color varchar,
    descripcion varchar
)
;
--
-- Structure for table materia_valores (OID = 442433449) : 
--
CREATE TABLE lab.materia_valores (
    id serial NOT NULL,
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    cod_val char(6),
    importe numeric(6,2),
    estado char(1)
)
;
--
-- Structure for table migrations (OID = 442453524) : 
--
SET search_path = saber, pg_catalog;
CREATE TABLE saber.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table observaciones (OID = 442453537) : 
--
CREATE TABLE saber.observaciones (
    id bigserial NOT NULL,
    trabajo_id bigint NOT NULL,
    descripcion text NOT NULL,
    fecha timestamp(0) without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table med (OID = 442492140) : 
--
SET search_path = prog, pg_catalog;
CREATE TABLE prog.med (
    id serial NOT NULL,
    id_materia integer,
    sigla varchar,
    materia varchar,
    id_alumno integer,
    paterno varchar,
    materno varchar,
    nombre varchar,
    id_grupo integer,
    id_sub_grupo integer,
    id_gestion integer,
    id_periodo integer,
    id_programa char(3)
)
;
--
-- Structure for table documentos_parrafos (OID = 442495054) : 
--
SET search_path = saber, pg_catalog;
CREATE TABLE saber.documentos_parrafos (
    id serial NOT NULL,
    id_documento integer,
    parrafo text
)
;
--
-- Structure for table trabajos_observaciones (OID = 442551433) : 
--
CREATE TABLE saber.trabajos_observaciones (
    id serial NOT NULL,
    id_trabajo integer,
    fecha timestamp without time zone,
    obs text,
    estado char(15),
    accion varchar(20)
)
;
--
-- Structure for table textos_preguntas (OID = 442551967) : 
--
CREATE TABLE saber.textos_preguntas (
    id serial NOT NULL,
    texto_orginal text,
    texto_corregido text,
    nro_tokens integer,
    es_spanish boolean,
    ip varchar
)
;
--
-- Structure for table grupo_modalidad (OID = 442553900) : 
--
SET search_path = academico, pg_catalog;
CREATE TABLE academico.grupo_modalidad (
    id_grupo_modalidad serial NOT NULL,
    orden integer,
    id_mod integer,
    cod varchar(20),
    modalidades1 varchar(255),
    modalidades varchar(255)
)
;
--
-- Definition for foreign table personas (OID = 442557238) : 
--
SET search_path = daf, pg_catalog;
CREATE FOREIGN TABLE daf.personas (
    id_ra varchar(10),
    nro_dip char(15) NOT NULL,
    paterno varchar(20),
    materno varchar(20),
    nombres varchar(65) NOT NULL,
    id_sexo char(1) NOT NULL,
    fec_nacimiento date DEFAULT now(),
    nac_pais integer,
    nac_departamento char(15),
    nac_provincia char(15),
    nac_localidad char(15),
    direccion varchar(60),
    telefono varchar(15),
    id_colegio smallint,
    egr_turno smallint,
    egr_tipo smallint,
    egr_gestion smallint,
    fec_registro timestamp(0) without time zone DEFAULT now(),
    tipo_sanguineo varchar(5),
    tel_per char(12),
    tel_urg char(12),
    zona varchar(50),
    est_civil varchar(15),
    clave varchar(60),
    tip_sis smallint,
    usuario char(15) DEFAULT ''::bpchar,
    usr char(20),
    idx tsvector,
    pass varchar,
    id_persona serial NOT NULL,
    correo varchar(100)
)
SERVER server_daf
OPTIONS (
  schema_name 'public',
  table_name 'personas');
--
-- Structure for table planes_programas (OID = 442557746) : 
--
SET search_path = plan, pg_catalog;
CREATE TABLE plan.planes_programas (
    id_programa char(3),
    id_plan smallint,
    tipo_programa char(1),
    tiempo_estudio real,
    clave_certificado char(2),
    cant_materias_aprobadas smallint,
    cant_materias_optativas smallint,
    cant_matriculas_x_gestion smallint,
    max_materias_programar smallint,
    max_materias_mesa smallint,
    max_materias_verano smallint,
    max_materias_arrastre smallint,
    max_materias_paralela smallint,
    max_materias_2do_turno smallint,
    nota_minima_aprobacion smallint,
    nota_minima_2do_turno smallint,
    nota_minima_verano smallint,
    nota_minima_paralela smallint,
    id_materia_pre000 integer,
    id_mencion smallint,
    estado varchar DEFAULT 'A'::character varying
)
;
--
-- Structure for table auditorias_administracion (OID = 442565569) : 
--
SET search_path = saber, pg_catalog;
CREATE TABLE saber.auditorias_administracion (
    id bigserial NOT NULL,
    accion varchar(255) NOT NULL,
    descripcion text,
    usuario varchar(255),
    ip varchar(255),
    user_agent varchar(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table configuraciones_sistema (OID = 442565575) : 
--
CREATE TABLE saber.configuraciones_sistema (
    id bigserial NOT NULL,
    clave varchar(255) NOT NULL,
    valor text,
    tipo varchar(255) DEFAULT 'string'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table facultades (OID = 442579820) : 
--
CREATE TABLE saber.facultades (
    id bigserial NOT NULL,
    nombre varchar(255) NOT NULL,
    sigla varchar(50),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)
;
--
-- Structure for table carreras (OID = 442579831) : 
--
CREATE TABLE saber.carreras (
    id bigserial NOT NULL,
    facultad_id bigint,
    nombre varchar(255) NOT NULL,
    sigla varchar(50),
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)
;
--
-- Structure for table migrations (OID = 442580152) : 
--
SET search_path = laboratorio, pg_catalog;
CREATE TABLE laboratorio.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table users (OID = 442580160) : 
--
CREATE TABLE laboratorio.users (
    id bigserial NOT NULL,
    username varchar(50) NOT NULL,
    password varchar(255) NOT NULL,
    name varchar(100) NOT NULL,
    last_name varchar(100),
    email varchar(255),
    phone varchar(255),
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp(0) without time zone,
    login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp(0) without time zone,
    remember_token varchar(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
)
;
--
-- Structure for table roles (OID = 442580177) : 
--
CREATE TABLE laboratorio.roles (
    id bigserial NOT NULL,
    name varchar(50) NOT NULL,
    display_name varchar(100) NOT NULL,
    description text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table user_roles (OID = 442580190) : 
--
CREATE TABLE laboratorio.user_roles (
    id bigserial NOT NULL,
    user_id bigint NOT NULL,
    role_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table sessions (OID = 442580208) : 
--
CREATE TABLE laboratorio.sessions (
    id varchar(255) NOT NULL,
    user_id bigint,
    ip_address varchar(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
)
;
--
-- Structure for table cache (OID = 442580218) : 
--
CREATE TABLE laboratorio.cache (
    key varchar(255) NOT NULL,
    value text NOT NULL,
    expiration integer NOT NULL
)
;
--
-- Structure for table cache_locks (OID = 442580226) : 
--
CREATE TABLE laboratorio.cache_locks (
    key varchar(255) NOT NULL,
    owner varchar(255) NOT NULL,
    expiration integer NOT NULL
)
;
--
-- Structure for table _bp_estados_civiles (OID = 468050404) : 
--
SET search_path = public, pg_catalog;
CREATE TABLE public._bp_estados_civiles (
    id_estado_civil serial NOT NULL,
    cod_estado_civil varchar(3),
    estado_civil char(50) NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario char(20),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _is2doa boolean
)
;
--
-- Structure for table prs_calificacion (OID = 468050441) : 
--
CREATE TABLE public.prs_calificacion (
    id_calificacion varchar(1) NOT NULL,
    calificacion varchar(20) NOT NULL
)
;
--
-- Structure for table alm_modalidad (OID = 474549403) : 
--
CREATE TABLE public.alm_modalidad (
    id_programa char(3) NOT NULL,
    id_examen integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    fecha date DEFAULT '2016-12-12'::date,
    ult_usuario integer,
    nro_postulantes integer DEFAULT 2000,
    nro_aceptados integer,
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    id_planificacion smallint DEFAULT 1 NOT NULL,
    id serial NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _weight integer DEFAULT 0 NOT NULL,
    importe numeric DEFAULT (0)::numeric,
    id_concepto varchar,
    id_planificacion_postulantes integer,
    usuario varchar,
    usuario_verificacion varchar,
    nota_aprobacion integer DEFAULT 51,
    fecha_verificacion timestamp without time zone,
    mostrar_nota boolean DEFAULT false,
    estado_verificacion varchar,
    _fec_ini timestamp without time zone DEFAULT now(),
    _fec_fin timestamp without time zone,
    _fec_examen timestamp without time zone
)
;
ALTER TABLE ONLY public.alm_modalidad ALTER COLUMN fecha_verificacion SET STATISTICS 100;
--
-- Structure for table cuentas_bancarias (OID = 474549423) : 
--
CREATE TABLE public.cuentas_bancarias (
    id serial NOT NULL,
    nro_dip varchar(50),
    id_ra varchar(50),
    id_estado_civil integer,
    nombre_conyugue varchar(200),
    celular_conyugue varchar(200),
    numero_dependientes integer,
    domicilio varchar(200),
    celular varchar(200),
    referencia varchar(300),
    vivienda varchar(200),
    profesion varchar(200),
    nivel_estudio varchar(200),
    cargo varchar(200) DEFAULT 'BECARIO'::character varying,
    fecha_ingreso varchar(200),
    haber_basico varchar(200),
    unidad varchar(200),
    id_gestion integer,
    id_periodo integer,
    nro_cuenta_bancaria varchar(25) DEFAULT '100000-00000000'::character varying,
    usuario varchar(25),
    fecha timestamp(0) without time zone DEFAULT now(),
    cuenta_bancaria_tmp varchar(20)
)
;
--
-- Structure for table fac_programas (OID = 474549434) : 
--
CREATE TABLE public.fac_programas (
    orden4 integer,
    id_facultad varchar,
    facultad_completo varchar,
    facultad varchar,
    orden5 integer,
    orden varchar,
    id_programa varchar,
    programa2 varchar,
    programa varchar,
    tipo_c varchar,
    lugar char(1),
    id_sede integer,
    activo char(1),
    tipo char(1),
    nivel varchar,
    c_area varchar,
    orden3 char(1),
    orden2 varchar,
    tiempo_estudio integer,
    area_conoc2 varchar,
    area_conoc varchar,
    sede varchar
)
;
--
-- Structure for table lugar_departamento (OID = 474549440) : 
--
CREATE TABLE public.lugar_departamento (
    cod_dep integer DEFAULT nextval('lugar_departamento_v2_cod_dep_seq'::regclass) NOT NULL,
    departamento char(15) NOT NULL,
    cod_pais integer NOT NULL,
    _registro timestamp without time zone DEFAULT now() NOT NULL,
    expedido varchar
)
;
--
-- Structure for table lugar_localidad (OID = 474549447) : 
--
CREATE TABLE public.lugar_localidad (
    cod_loc integer DEFAULT nextval('lugar_localidad_n_cod_loc_seq'::regclass) NOT NULL,
    cod_prov_original integer,
    cod_prov integer NOT NULL,
    cod_dep integer,
    cod_pais integer,
    localidad varchar(200),
    cod_prov_3 integer,
    cod_prov_2 integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _actualizado timestamp without time zone,
    id_procedencia integer DEFAULT 0
)
;
--
-- Structure for table lugar_provincia (OID = 474549453) : 
--
CREATE TABLE public.lugar_provincia (
    cod_dep smallint,
    cod_prov_original smallint,
    provincia varchar(40),
    cod_pais integer,
    cod_prov integer DEFAULT nextval('lugar_provincia_cod_prov_2_seq'::regclass) NOT NULL,
    cod_prov_2 integer
)
;
--
-- Structure for table matriculas (OID = 474549456) : 
--
CREATE TABLE public.matriculas (
    id_matricula integer DEFAULT nextval(('"matriculas_id_matricula_seq"'::text)::regclass) NOT NULL,
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
    niv_acad smallint DEFAULT 0
)
;
--
-- Structure for table prs_colegios (OID = 474549472) : 
--
CREATE TABLE public.prs_colegios (
    id_colegio_original smallint DEFAULT 0 NOT NULL,
    colegio varchar(65) NOT NULL,
    tipo char(1) DEFAULT 'F'::bpchar NOT NULL,
    turno char(1) DEFAULT 'D'::bpchar NOT NULL,
    area char(1) DEFAULT 'U'::bpchar NOT NULL,
    cod_dep smallint DEFAULT 5 NOT NULL,
    cod_prov smallint DEFAULT 1 NOT NULL,
    cod_loc smallint NOT NULL,
    cod_prov_2 integer DEFAULT 0 NOT NULL,
    id_pais smallint DEFAULT 27 NOT NULL,
    cod_ue varchar(16),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    cod_prov_original smallint,
    id_colegio integer DEFAULT nextval('prs_colegios_id_seq'::regclass) NOT NULL,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table prs_pais (OID = 474549485) : 
--
CREATE TABLE public.prs_pais (
    id_pais integer DEFAULT nextval('prs_pais_3_id_pais_seq'::regclass) NOT NULL,
    pais varchar(255),
    calificacion smallint,
    num_materias smallint,
    estado varchar(1)
)
;
--
-- Structure for table uatf_datos (OID = 474549488) : 
--
CREATE TABLE public.uatf_datos (
    id_ra varchar(10) NOT NULL,
    nro_dip varchar(15),
    paterno varchar(64),
    materno varchar(64),
    nombres varchar(128),
    id_sexo varchar(1),
    fec_nacimiento date,
    nac_pais integer,
    id_dep smallint,
    id_prov_original smallint,
    id_loc smallint,
    direccion varchar(60),
    telefono varchar(15),
    id_colegio smallint,
    egr_gestion smallint,
    fec_registro timestamp with time zone DEFAULT now() NOT NULL,
    id_calificacion varchar(1) DEFAULT '1'::character varying,
    tel_per varchar(12),
    tel_urg varchar(12),
    zona varchar(50),
    estado_civil smallint DEFAULT 1 NOT NULL,
    tdni varchar,
    dip_bach varchar,
    idfacebook varchar(64),
    obs varchar,
    email varchar(50),
    id_prov_2 integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    tipo_sanguineo smallint DEFAULT 0 NOT NULL,
    id_prov integer,
    id_loc_3 integer,
    estado_civil_original smallint,
    _id_usuario varchar(32) DEFAULT 'root'::character varying NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _tsidx tsvector,
    nacionalidad char(25) DEFAULT 'BOLIVIANO'::bpchar,
    tipo_nro_dip char(2) DEFAULT 'PT'::bpchar,
    tel_whatsapp varchar(20) DEFAULT ''::character varying,
    _fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    id_apoderado integer,
    id_colegio_sie varchar,
    estado_profesional char(2)
)
;
--
-- Structure for table valores_cargos (OID = 474549510) : 
--
CREATE TABLE public.valores_cargos (
    id_cargo varchar(4) NOT NULL,
    cargo varchar(50) NOT NULL,
    id_grado char(1),
    id_calificacion char(1),
    id_programa char(3),
    formulario char(3),
    estado char(2),
    id_gestion smallint,
    id_periodo smallint DEFAULT 1 NOT NULL,
    id_programa_new varchar[],
    tipo_matricula char(2) DEFAULT 'ER'::bpchar NOT NULL,
    id serial NOT NULL
)
;
--
-- Structure for table valores_cargos_detalles (OID = 474549518) : 
--
CREATE TABLE public.valores_cargos_detalles (
    id_cargo varchar(4) NOT NULL,
    corr0 timestamp with time zone DEFAULT now() NOT NULL,
    id_concepto varchar(4) NOT NULL,
    costo numeric(12,2),
    id_gestion smallint
)
;
--
-- Structure for table valores_cargos_detalles_concept (OID = 474549522) : 
--
CREATE TABLE public.valores_cargos_detalles_concept (
    id_concepto varchar(4) NOT NULL,
    concepto varchar(50) NOT NULL,
    estado bpchar,
    id_gestion smallint
)
;
--
-- Structure for table dar_cert_actas (OID = 474549528) : 
--
CREATE TABLE public.dar_cert_actas (
    cod integer NOT NULL,
    descripcion varchar(128),
    estado varchar(1),
    tema varchar(2),
    observ varchar(50)
)
;
--
-- Structure for table dar_tramites (OID = 474549531) : 
--
CREATE TABLE public.dar_tramites (
    id_tramite serial NOT NULL,
    nro_dip varchar(15) NOT NULL,
    id_alumno integer,
    fecha date DEFAULT now() NOT NULL,
    tipo_tramite varchar(1) NOT NULL,
    desc_tramite integer DEFAULT 0 NOT NULL,
    origen varchar(3),
    destino varchar(3),
    obs varchar(50),
    _id_usuario varchar,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado varchar DEFAULT 'A'::character varying,
    _dtunique integer DEFAULT 1 NOT NULL,
    desc_tramite2 integer DEFAULT 1,
    descripcion2 varchar,
    veces_repite integer,
    nro_repeticion integer,
    nivel varchar
)
;
--
-- Structure for table postulantes (OID = 474549544) : 
--
CREATE TABLE public.postulantes (
    id_alumno serial NOT NULL,
    id_programa char(3) NOT NULL,
    id_ra varchar(10) NOT NULL,
    fec_inscripcion date DEFAULT now(),
    hora timestamp(0) with time zone DEFAULT now(),
    id_plan smallint,
    id_grado char(1) NOT NULL,
    estado char(1) DEFAULT 'P'::bpchar,
    id_calificacion char(1),
    promedio numeric(6,2),
    nro_dip varchar(15),
    antes_examen_old varchar(2),
    examen integer,
    id_acceso char(2),
    id_periodo smallint,
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
    _usuario_guia varchar(15),
    _fecha_entrega_guia date,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    antes_examen smallint DEFAULT 0 NOT NULL,
    tipo_nro_dip varchar(2),
    nro_postulacion integer,
    sau_id_grupo integer,
    fec_calificacion timestamp without time zone,
    nro_impresiones smallint DEFAULT 0,
    recalificado integer DEFAULT 0,
    id_recaudaciones integer,
    id_postulaciones integer,
    estado_postulacion varchar DEFAULT 'PENDIENTE'::character varying,
    estado_envio_daf varchar
)
;
--
-- Structure for table prs_examen (OID = 474549565) : 
--
CREATE TABLE public.prs_examen (
    id_examen integer NOT NULL,
    examen varchar NOT NULL,
    costo integer,
    obs varchar(32),
    abreviacion varchar(25),
    _estado varchar(16) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    peso smallint,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    fecha_inicio date,
    fecha_fin date,
    planificacion smallint DEFAULT 0 NOT NULL,
    __tipo smallint DEFAULT 1 NOT NULL,
    _requisitos varchar[],
    _img varchar,
    _ncosto varchar,
    _form varchar,
    r_requisitos_b varchar[],
    _requisitos_anteriores_2021 text,
    modalidad varchar DEFAULT ''::character varying NOT NULL,
    tipo_postulacion varchar DEFAULT 'NORMAL'::character varying NOT NULL,
    id_concepto varchar,
    id_mod_grupo integer
)
;
--
-- Structure for table prs_area_colegio (OID = 474549577) : 
--
CREATE TABLE public.prs_area_colegio (
    id_area char(1),
    area varchar
)
;
--
-- Structure for table prs_tipo_colegio (OID = 474549583) : 
--
CREATE TABLE public.prs_tipo_colegio (
    id_tipo smallint NOT NULL,
    tipo varchar(15) NOT NULL,
    id_old char(1) DEFAULT 'F'::bpchar NOT NULL
)
;
--
-- Structure for table prs_turno_colegio (OID = 474549587) : 
--
CREATE TABLE public.prs_turno_colegio (
    id_turno smallint NOT NULL,
    turno varchar(15) NOT NULL,
    id_old char(1) DEFAULT 'D'::bpchar NOT NULL
)
;
--
-- Structure for table alm_programas_ingreso (OID = 474549596) : 
--
CREATE TABLE public.alm_programas_ingreso (
    id_programa char(3) NOT NULL,
    id_gestion smallint,
    id_periodo smallint,
    estado char(1),
    obs char(20),
    nota_minima smallint,
    _id_usuario varchar(32),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _estado varchar(32) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    id_examen smallint DEFAULT 0 NOT NULL,
    mostrar_nota boolean DEFAULT false
)
;
--
-- Structure for table cajas_transacciones (OID = 474549604) : 
--
CREATE TABLE public.cajas_transacciones (
    id_transaccion integer DEFAULT nextval(('cajas_transac_id_transaccio_seq'::text)::regclass) NOT NULL,
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
)
;
--
-- Structure for table valores_transacciones (OID = 474549622) : 
--
CREATE TABLE public.valores_transacciones (
    id_transaccion integer DEFAULT nextval(('valores_trans_id_trans_seq'::text)::regclass) NOT NULL,
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
)
;
--
-- Structure for table _bp_photos (OID = 474549632) : 
--
CREATE TABLE public._bp_photos (
    id_photo serial NOT NULL,
    id_alumno integer NOT NULL,
    photo bytea,
    extension char(50) NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario char(50),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table _bp_relaciones (OID = 474549643) : 
--
CREATE TABLE public._bp_relaciones (
    id_relacion serial NOT NULL,
    cod_relacion char(3),
    relacion char(50) NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario char(20),
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL
)
;
--
-- Structure for table academico_alm_programaciones (OID = 474549666) : 
--
CREATE TABLE public.academico_alm_programaciones (
    id_alumno integer,
    id_materia integer,
    id_gestion smallint,
    id_periodo smallint,
    id_grupo smallint,
    fecha timestamp with time zone,
    ult_usuario varchar(22),
    estado varchar(1),
    marcador smallint,
    pparcial smallint,
    sparcial smallint,
    tparcial smallint,
    cparcial smallint,
    promparcial smallint,
    pract smallint,
    prompract smallint,
    lab smallint,
    promlab smallint,
    notapres smallint,
    exfinal smallint,
    promexfinal smallint,
    nota smallint,
    nota_2da smallint,
    nota_ex_mesa smallint,
    observacion varchar(2),
    num_2do_turno integer,
    tipo_prog varchar(1),
    id integer,
    metodo_programacion varchar(100),
    _estado varchar(254),
    tipo_programacion varchar(254)
)
;
--
-- Structure for table administrador (OID = 474549672) : 
--
CREATE TABLE public.administrador (
    ci varchar,
    nombres varchar,
    paterno varchar,
    materno varchar,
    cargo varchar,
    titulo varchar,
    usuario varchar,
    clave varchar,
    estado varchar(1) DEFAULT 'A'::bpchar,
    id_administrador integer DEFAULT nextval(('public.administrador_id_administrador_seq'::text)::regclass) NOT NULL,
    _registrado timestamp without time zone DEFAULT now() NOT NULL
)
;
--
-- Structure for table alm_cursos (OID = 474549681) : 
--
CREATE TABLE public.alm_cursos (
    id_curso serial NOT NULL,
    id_programa char(3) NOT NULL,
    _registrado timestamp with time zone DEFAULT now() NOT NULL,
    _modificado timestamp with time zone DEFAULT now() NOT NULL,
    _id_usuario char(10) NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _ip_usuario char(32) NOT NULL,
    prefijo char(10),
    nombre char(100),
    id_facultad integer NOT NULL,
    _tipo_academico char(3) DEFAULT 'EXT'::bpchar NOT NULL
)
;
--
-- Structure for table alm_programas_calendario (OID = 474549692) : 
--
CREATE TABLE public.alm_programas_calendario (
    id_programa char(3),
    id_periodo smallint,
    id_gestion smallint,
    clases_fecha_ini date,
    clases_fecha_fin date,
    examen_1p_fecha_ini date,
    examen_1p_fecha_fin date,
    examen_2p_fecha_ini date,
    examen_2p_fecha_fin date,
    examen_3p_fecha_ini date,
    examen_3p_fecha_fin date,
    conclusion_fecha date,
    examen_f_fecha_ini date,
    examen_f_fecha_fin date,
    examen_s_fecha_ini date,
    examen_s_fecha_fin date,
    entrega_planillas date,
    usuario varchar(30)
)
;
--
-- Structure for table alm_programas_grados (OID = 474549695) : 
--
CREATE TABLE public.alm_programas_grados (
    id_grado char(1) NOT NULL,
    grado varchar(20) NOT NULL
)
;
--
-- Structure for table alm_programas_guia (OID = 474549698) : 
--
CREATE TABLE public.alm_programas_guia (
    id_programa char(3),
    id_gestion smallint,
    id_periodo smallint,
    nivel char(100),
    duracion char(100),
    modalidad_graduacion text,
    modalidad_admision text,
    diploma_academico char(999),
    titulo_provision_nacional char(999),
    objetivo_formativo text,
    perfil_profesional text,
    areas_ejercicio_profesional text
)
;
--
-- Structure for table alm_programas_num_mat_plan (OID = 474549704) : 
--
CREATE TABLE public.alm_programas_num_mat_plan (
    id_programa char(3),
    num_materias integer,
    id_gestion_inicio integer,
    id_gestion_final integer,
    estado char(1),
    id_plan integer
)
;
--
-- Structure for table alm_programas_postgrado (OID = 474549707) : 
--
CREATE TABLE public.alm_programas_postgrado (
    id_postgrado char(4) NOT NULL,
    id_programa char(3) NOT NULL,
    programa varchar(50) NOT NULL,
    id_facultad smallint NOT NULL,
    estado char(1),
    nivel varchar(45),
    tipo char(1),
    fecha1 date DEFAULT now(),
    fecha2 date DEFAULT now(),
    fecha3 date DEFAULT now(),
    fechaf date DEFAULT now(),
    fechae date DEFAULT now(),
    fecha_inicio_curso date,
    resolucion char(10),
    direccion char(30),
    telefono char(12),
    num_modulos integer,
    fecha_lim_prog date,
    id_plan smallint,
    id_materia_pre000 smallint DEFAULT (0)::smallint,
    nota_minima integer DEFAULT 0,
    sede varchar(1)
)
;
--
-- Structure for table alumnos_matricula_postgrado (OID = 474549717) : 
--
CREATE TABLE public.alumnos_matricula_postgrado (
    id_matricula integer,
    id_gestion smallint,
    id_periodo smallint,
    id_alumno integer,
    id_ra varchar(10),
    fec_registro date,
    ult_usuario varchar(10),
    id_programa varchar(3),
    id_postgrado char(4),
    estado char(1),
    id_plan smallint,
    clave varchar(10)
)
;
--
-- Structure for table apoderado (OID = 474549724) : 
--
CREATE TABLE public.apoderado (
    nro_dip varchar(15) NOT NULL,
    clave varchar NOT NULL,
    paterno varchar(35),
    materno varchar(35),
    nombres varchar(35),
    direccion varchar(60),
    telefono varchar(15),
    ida serial NOT NULL,
    fecha timestamp without time zone DEFAULT now()
)
;
--
-- Structure for table area (OID = 474549733) : 
--
CREATE TABLE public.area (
    codigo_sistema char(10),
    codigo_area integer,
    sigla_area char(10),
    nombre char(60),
    peso real
)
;
--
-- Structure for table area_nivel (OID = 474549736) : 
--
CREATE TABLE public.area_nivel (
    codigo_area integer,
    codigo_nivel integer
)
;
--
-- Structure for table auxiliares (OID = 474549739) : 
--
CREATE TABLE public.auxiliares (
    id serial NOT NULL,
    id_alumno integer,
    id_materia integer,
    id_gestion integer,
    id_periodo integer,
    id_grupo integer,
    tipo_auxiliar varchar DEFAULT 'TITULAR'::character varying,
    fecha_registro timestamp without time zone DEFAULT now(),
    estado varchar DEFAULT 'ACTIVO'::character varying,
    fecha_conclusion timestamp without time zone,
    nota double precision,
    id_oferta integer
)
;
--
-- Structure for table calendario_modalidades (OID = 474549750) : 
--
CREATE TABLE public.calendario_modalidades (
    id serial NOT NULL,
    id_gestion integer,
    id_periodo integer,
    id_modalidad integer[],
    no_id_programa char(3)[],
    fecha_inicio timestamp without time zone,
    fecha_final timestamp without time zone,
    estado char(10) DEFAULT 'ACTIVO'::bpchar NOT NULL,
    fecha_examen timestamp(0) without time zone
)
;
--
-- Structure for table carrera (OID = 474549759) : 
--
CREATE TABLE public.carrera (
    id_carrera integer NOT NULL,
    sigla varchar(10) NOT NULL,
    nombre_carrera varchar(100),
    id_facultad integer
)
;
--
-- Structure for table colegio_carrera_materia (OID = 474549762) : 
--
CREATE TABLE public.colegio_carrera_materia (
    id_programa varchar(3),
    id_materia smallint,
    id serial NOT NULL
)
;
--
-- Structure for table colegio_materia (OID = 474549767) : 
--
CREATE TABLE public.colegio_materia (
    id_materia smallint,
    des_materia varchar(20)
)
;
--
-- Structure for table colegio_materia_nota (OID = 474549770) : 
--
CREATE TABLE public.colegio_materia_nota (
    nro_dip char(15),
    clave char(5),
    id_curso smallint,
    id_materia smallint,
    nota numeric(7,2)
)
;
--
-- Structure for table colegio_nota (OID = 474549773) : 
--
CREATE TABLE public.colegio_nota (
    id serial NOT NULL,
    ci varchar(15),
    clave varchar(32),
    id_materia smallint,
    n1 smallint,
    n2 smallint,
    n3 smallint,
    n4 smallint,
    id_programa varchar(6)
)
;
--
-- Structure for table comisiones (OID = 474549778) : 
--
CREATE TABLE public.comisiones (
    id bigserial NOT NULL,
    id_gestion integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    id_dictamen integer,
    id_periodo integer,
    tipo_comision varchar,
    estado_comision varchar DEFAULT 'VIGENTE'::character varying
)
;
--
-- Structure for table configuraciones (OID = 474549787) : 
--
CREATE TABLE public.configuraciones (
    id_gestion integer,
    id_periodo integer,
    estado char(1),
    id_gestion_postulacion integer,
    id_periodo_postulacion integer,
    id_gestion_suspension integer,
    id_periodo_suspension integer,
    id_gestion_matricula_control integer,
    id_periodo_matricula_control integer,
    tipo_carrera char(1) DEFAULT ''::bpchar,
    id_gestion_beca_trabajo integer,
    id_periodo_beca_trabajo integer
)
;
--
-- Structure for table control (OID = 474549791) : 
--
CREATE TABLE public.control (
    id_programa char(3),
    id_gestion smallint DEFAULT 2010,
    id_periodo smallint DEFAULT 3,
    recepcion_planillas char(1),
    user_recepcion char(20),
    fecha_recepcion_plani timestamp without time zone,
    claves char(1),
    fecha_claves timestamp without time zone,
    user_claves char(20),
    imp_certificados char(1),
    fecha_imp_certificados timestamp without time zone,
    quien_imprimio varchar(20),
    fecha_entrega_certificados timestamp without time zone,
    quien_entrego_certificados char(20),
    entregado_a varchar(25),
    verano char(1) DEFAULT 'S'::bpchar,
    segturno char(1),
    estado char(1)
)
;
--
-- Structure for table cop_to_ctt (OID = 474549797) : 
--
CREATE TABLE public.cop_to_ctt (
    id_ctt integer,
    id_cop integer
)
;
--
-- Structure for table correlativo (OID = 474549800) : 
--
CREATE TABLE public.correlativo (
    id_cargo char(4),
    id_gestion smallint,
    id_periodo smallint,
    numero numeric(10,0),
    num_inicial numeric(10,0),
    usuario varchar[],
    id_programa varchar(3)[]
)
;
--
-- Structure for table correos (OID = 474549806) : 
--
CREATE TABLE public.correos (
    script varchar,
    ci varchar,
    usuario varchar,
    email varchar,
    clave varchar
)
;
--
-- Structure for table dar_anulaciones (OID = 474549814) : 
--
CREATE TABLE public.dar_anulaciones (
    id serial NOT NULL,
    id_alumno integer,
    id_gestion integer,
    id_periodo integer,
    fecha_registro timestamp without time zone DEFAULT now(),
    fecha_impresion timestamp without time zone,
    obs varchar,
    estado enum_tipo DEFAULT 'SOLICITADO'::enum_tipo
)
;
--
-- Structure for table dar_autoridades (OID = 474549824) : 
--
CREATE TABLE public.dar_autoridades (
    identificador serial NOT NULL,
    ci varchar(15),
    id_cargo varchar(5),
    abre_titulo varchar(10),
    nombres varchar(40),
    cargo varchar(100),
    estado varchar(1) DEFAULT 'A'::character varying,
    fecha_inicio date,
    fecha_fin date,
    obs varchar(30)
)
;
--
-- Structure for table dar_cambios_carrera (OID = 474549830) : 
--
CREATE TABLE public.dar_cambios_carrera (
    id_cambio serial NOT NULL,
    id_alumno integer,
    id_programao varchar(5),
    id_programad varchar(5),
    razones varchar(120),
    fecha_ini date,
    estado varchar(1) DEFAULT 'A'::character varying,
    convalidacion varchar(1),
    nrocambios integer DEFAULT 0,
    fecha_fin date,
    _registro timestamp without time zone DEFAULT now(),
    impresion integer DEFAULT 0,
    requisito1 varchar(1) DEFAULT 'S'::character varying,
    requisito2 varchar(1) DEFAULT 'S'::character varying,
    requisito3 varchar(1) DEFAULT 'S'::character varying,
    nro_dip varchar,
    id_gestion integer DEFAULT 2026,
    id_periodo integer DEFAULT 1
)
;
--
-- Structure for table dar_cert_notas (OID = 474549847) : 
--
CREATE TABLE public.dar_cert_notas (
    cod integer,
    descripcion varchar(50),
    estado varchar(1),
    observ varchar(50)
)
;
--
-- Structure for table dar_readmisiones (OID = 474549850) : 
--
CREATE TABLE public.dar_readmisiones (
    id_readmision serial NOT NULL,
    id_suspension integer,
    id_alumno integer,
    id_programa varchar(4),
    gestion_r integer,
    periodo_r integer,
    fecha_realizado date,
    tipo varchar(1),
    estado varchar(1) DEFAULT 'P'::character varying,
    _registro timestamp without time zone DEFAULT now(),
    fecha_fin date,
    impresion integer DEFAULT 0,
    nro_dip varchar
)
;
--
-- Structure for table dar_sis_activacion (OID = 474549861) : 
--
CREATE TABLE public.dar_sis_activacion (
    id_sis serial NOT NULL,
    nombresis varchar(3),
    fecha_ini_ac date,
    fecha_fin_ac date,
    estado varchar(1) DEFAULT 'A'::character varying,
    descripcion varchar(50),
    titulo varchar(30),
    enpantalla varchar(1)
)
;
--
-- Structure for table dar_suspensiones (OID = 474549867) : 
--
CREATE TABLE public.dar_suspensiones (
    id_suspension serial NOT NULL,
    id_alumno integer,
    id_programa varchar(5),
    gestion_ini_s integer,
    periodo_ini_s integer,
    gestion_fin_s integer,
    periodo_fin_s integer,
    fecha_realizado date,
    tiempo integer,
    tipo varchar(1),
    razones text,
    estado varchar(2) DEFAULT 'A'::character varying,
    fecha_fin date,
    _registro timestamp without time zone DEFAULT now(),
    impresion integer DEFAULT 0,
    editar varchar(1) DEFAULT 'N'::character varying,
    nro_dip varchar
)
;
--
-- Structure for table dar_transferencias (OID = 474549881) : 
--
CREATE TABLE public.dar_transferencias (
    id_transfer serial NOT NULL,
    id_alumno integer,
    id_programao varchar(5),
    id_programad varchar(5),
    razones varchar(120),
    fecha_ini date,
    estado varchar(1) DEFAULT 'A'::character varying,
    convalidacion varchar(1),
    nrocambios integer DEFAULT 0,
    fecha_fin date,
    _registro timestamp without time zone DEFAULT now(),
    impresion integer DEFAULT 0,
    requisito1 varchar(1) DEFAULT 'S'::character varying,
    requisito2 varchar(1) DEFAULT 'S'::character varying,
    requisito3 varchar(1) DEFAULT 'S'::character varying,
    nro_dip varchar,
    id_gestion integer DEFAULT 2025,
    id_periodo integer DEFAULT 1
)
;
--
-- Structure for table dar_traspasos (OID = 474549898) : 
--
CREATE TABLE public.dar_traspasos (
    id_tramite integer,
    id_universidad integer NOT NULL,
    id_carrera integer,
    id_alumno integer,
    dip_alumno varchar(12),
    fecha_limite date,
    estado varchar(1) DEFAULT 'A'::character varying NOT NULL,
    id_traspaso serial NOT NULL,
    razones text,
    fecha_ini date,
    fecha_fin date,
    impresiones integer DEFAULT 0,
    _registro timestamp without time zone DEFAULT now(),
    nro_dip varchar,
    req1 varchar(1) DEFAULT 't'::character varying,
    req2 varchar(1) DEFAULT 't'::character varying,
    motivos text
)
;
--
-- Structure for table data_notificaciones (OID = 474549911) : 
--
CREATE TABLE public.data_notificaciones (
    id bigserial NOT NULL,
    fecha timestamp without time zone DEFAULT now(),
    mensaje text,
    nro_dip varchar,
    tipo varchar(1) DEFAULT 'T'::character varying,
    id_programa char(3),
    fecha_caducidad timestamp without time zone,
    ipv4 inet DEFAULT inet_client_addr(),
    enviado char(1) DEFAULT 'N'::bpchar,
    usuario varchar DEFAULT 'sistema'::character varying
)
;
--
-- Structure for table datos (OID = 474549924) : 
--
CREATE TABLE public.datos (
    fec_ini_con timestamp(0) without time zone,
    fec_fin_con timestamp(0) without time zone
)
;
--
-- Structure for table dct_cargos (OID = 474549927) : 
--
CREATE TABLE public.dct_cargos (
    id_cargo char(1),
    cargo char(25)
)
;
--
-- Structure for table dct_horarios (OID = 474549930) : 
--
CREATE TABLE public.dct_horarios (
    id_horario integer DEFAULT nextval(('"seq_id_horario"'::text)::regclass) NOT NULL,
    dia integer,
    de_horas time without time zone,
    a_horas time without time zone,
    id_ambiente integer,
    id_dct_asignaciones integer,
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    _estado char(1) DEFAULT 'A'::bpchar NOT NULL,
    _modificado timestamp without time zone DEFAULT now() NOT NULL,
    _id_usuario varchar(32)
)
;
--
-- Structure for table dct_horas (OID = 474549937) : 
--
CREATE TABLE public.dct_horas (
    id serial NOT NULL,
    periodos char(17)
)
;
--
-- Structure for table dct_material_pea (OID = 474549942) : 
--
CREATE TABLE public.dct_material_pea (
    id_dct_asignaciones integer,
    fecha_publicacion timestamp without time zone DEFAULT now(),
    estado char(1),
    archivo varchar
)
;
--
-- Structure for table dedicacion (OID = 474549949) : 
--
CREATE TABLE public.dedicacion (
    id_dedicacion smallint DEFAULT nextval(('"dedicacion_sec"'::text)::regclass) NOT NULL,
    des_dedicacion varchar(20),
    bono_te char(1),
    iva char(1),
    estado char(1),
    gestion smallint
)
;
--
-- Structure for table deudas_solvencia (OID = 474549953) : 
--
CREATE TABLE public.deudas_solvencia (
    id_deuda serial NOT NULL,
    id_programa varchar(5),
    reparticion varchar(20),
    deuda text,
    estado varchar(1) DEFAULT 'A'::character varying,
    _registro timestamp without time zone DEFAULT now(),
    nro_dip varchar,
    _usuario varchar(64),
    fecha_ini date,
    fecha_fin date,
    tipo varchar(1),
    id_deuda_padre integer
)
;
--
-- Structure for table dictums (OID = 474549963) : 
--
CREATE TABLE public.dictums (
    id bigserial NOT NULL,
    name varchar(255) NOT NULL,
    date date NOT NULL,
    type varchar(255) NOT NULL,
    programa_id varchar(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
)
;
--
-- Structure for table e_tipo_legal (OID = 474549971) : 
--
CREATE TABLE public.e_tipo_legal (
    id_legal integer,
    legal varchar(35)
)
;
--
-- Structure for table e_tipo_tramites (OID = 474549974) : 
--
CREATE TABLE public.e_tipo_tramites (
    id_tipo_tramite integer NOT NULL,
    tramite varchar(70),
    estado char(1)
)
;
--
-- Structure for table e_tramites (OID = 474549977) : 
--
CREATE TABLE public.e_tramites (
    id_tramite integer,
    id_alumno integer,
    id_gestion smallint,
    id_periodo smallint,
    fecha timestamp without time zone,
    usuario varchar(30),
    id_tipo_tramite integer,
    observacion varchar(200),
    id_legal integer
)
;
--
-- Structure for table equivalencias (OID = 474549985) : 
--
CREATE TABLE public.equivalencias (
    id smallint,
    valor char(20),
    equiv char(20),
    tipo char(1)
)
;
--
-- Structure for table estructura_programa (OID = 474549988) : 
--
CREATE TABLE public.estructura_programa (
    id_pro char(2) NOT NULL,
    id_sub char(2) NOT NULL,
    id_pry char(2) NOT NULL,
    id_obr char(2) NOT NULL,
    des_prg char(60),
    gestion smallint NOT NULL,
    entidad smallint NOT NULL,
    cod_prg char(8) NOT NULL,
    estado char(1) NOT NULL,
    id_programa char(3),
    tipo char(1) DEFAULT 'P'::bpchar,
    id_est_prg integer DEFAULT nextval(('"_est_prg_sec"'::text)::regclass) NOT NULL,
    sigla char(3)
)
;
--
-- Structure for table estudiantes (OID = 474549993) : 
--
CREATE TABLE public.estudiantes (
    nro integer,
    nro_dip char(25),
    apellidos_nombres varchar,
    id_gestion smallint,
    id_periodo smallint,
    sede char(1),
    id_mesa char(5)
)
;
--
-- Structure for table ex_dir (OID = 474549999) : 
--
CREATE TABLE public.ex_dir (
    id_docente smallint,
    xxx varchar(6),
    _registrado timestamp without time zone DEFAULT now() NOT NULL,
    id serial NOT NULL,
    fecha date
)
;
--
-- Structure for table fec_reg (OID = 474550005) : 
--
CREATE TABLE public.fec_reg (
    fec_registro date
)
;
--
-- Structure for table gestion_periodo (OID = 474550008) : 
--
CREATE TABLE public.gestion_periodo (
    gestion smallint NOT NULL,
    periodo smallint NOT NULL,
    tipo varchar(1) NOT NULL,
    estado char(1),
    tipo_sistema char(1) NOT NULL,
    estado_sistema boolean DEFAULT false NOT NULL
)
;
--
-- Structure for table gestion_periodo_directores (OID = 474550012) : 
--
CREATE TABLE public.gestion_periodo_directores (
    id_programa char(3) NOT NULL,
    programa varchar(50),
    id_facultad integer,
    gestion integer NOT NULL,
    periodo integer NOT NULL,
    tipo char(1) NOT NULL,
    estado char(10)
)
;
--
-- Structure for table grupo_lab (OID = 474550015) : 
--
CREATE TABLE public.grupo_lab (
    id_materia bigint,
    id_grupo bigint,
    id_gestion bigint,
    id_periodo bigint,
    id_programa char(3)
)
;
--
-- Structure for table grupo_sanguineo (OID = 474550018) : 
--
CREATE TABLE public.grupo_sanguineo (
    id_sanguineo smallint,
    des_sanguineo varchar(15),
    estado char(1) DEFAULT 'A'::bpchar,
    factor varchar(1),
    migrar varchar(4),
    grupo varchar(2)
)
;
--
-- Definition for foreign table historial_tramite (OID = 474550027) : 
--
CREATE FOREIGN TABLE public.historial_tramite (
    id serial NOT NULL,
    cod_tramite varchar,
    tramite varchar,
    carrera varchar,
    ci varchar,
    nombres varchar,
    apellido_pat varchar,
    apellido_mat varchar,
    fecha_inicio timestamp without time zone DEFAULT now(),
    fecha_pago timestamp without time zone,
    fecha_finalizacion timestamp without time zone,
    fecha_entrega timestamp without time zone,
    nivel varchar,
    numero_carton varchar,
    carton varchar,
    ru integer
)
SERVER server_titulos
OPTIONS (table_name 'historial_tramite');
--
-- Structure for table item_percepciones_deducciones (OID = 474550033) : 
--
CREATE TABLE public.item_percepciones_deducciones (
    id_puesto_persona integer NOT NULL,
    id_per_ded integer NOT NULL,
    mes smallint,
    gestion smallint,
    importe numeric(15,2),
    fecha_act timestamp(0) without time zone DEFAULT now()
)
;
--
-- Structure for table lugar_localidad_old (OID = 474550041) : 
--
CREATE TABLE public.lugar_localidad_old (
    cod_pais integer,
    cod_dep smallint,
    cod_prov smallint,
    cod_loc smallint NOT NULL,
    localidad varchar(200),
    cod_prov_2 integer NOT NULL
)
;
--
-- Structure for table lugar_localidad_original (OID = 474550044) : 
--
CREATE TABLE public.lugar_localidad_original (
    cod_pais integer,
    cod_dep smallint,
    cod_prov smallint,
    cod_loc smallint,
    localidad varchar(40)
)
;
--
-- Structure for table m (OID = 474550049) : 
--
CREATE TABLE public.m (
    r_sigla varchar,
    r_materia varchar,
    r_nivel_academico integer,
    r_id_materia integer,
    regexp_split_to_array double precision[]
)
;
--
-- Structure for table m_claves_acceso (OID = 474550055) : 
--
CREATE TABLE public.m_claves_acceso (
    id integer,
    acceso char(8),
    estado char(1)
)
;
--
-- Structure for table m_colegios (OID = 474550058) : 
--
CREATE TABLE public.m_colegios (
    colegio varchar(254),
    tipo varchar(254),
    clavec varchar(254)
)
;
--
-- Structure for table m_correccion (OID = 474550064) : 
--
CREATE TABLE public.m_correccion (
    claveco varchar(254),
    claveu varchar(254),
    usuariou varchar(254),
    planv varchar(254),
    plan0 varchar(254),
    plan1 varchar(254),
    plan2 varchar(254),
    plan3 varchar(254),
    plan4 varchar(254),
    plan5 varchar(254),
    plan6 varchar(254),
    plan7 varchar(254),
    plan8 varchar(254),
    plan9 varchar(254),
    vale varchar(254),
    lin varchar(254)
)
;
--
-- Structure for table m_habilitaciones (OID = 474550070) : 
--
CREATE TABLE public.m_habilitaciones (
    clave integer,
    facultad char(50),
    carrera char(50),
    descrip char(800),
    clase char(25),
    tiempo integer,
    campo char(800),
    tipo integer,
    ingreso char(300),
    salida char(300)
)
;
--
-- Structure for table m_registro (OID = 474550076) : 
--
CREATE TABLE public.m_registro (
    establesimiento varchar(254),
    usuario varchar(254),
    sexo varchar(254),
    identidad varchar(254),
    appat varchar(254),
    apmat varchar(254),
    nombre varchar(254),
    clave varchar(254),
    egreso varchar(254),
    fecha varchar(254),
    curso varchar(254),
    grado varchar(254)
)
;
--
-- Structure for table m_resultados (OID = 474550082) : 
--
CREATE TABLE public.m_resultados (
    usuario varchar(254),
    clave varchar(254),
    result varchar(254),
    fecha varchar(254)
)
;
--
-- Structure for table m_usuarios (OID = 474550088) : 
--
CREATE TABLE public.m_usuarios (
    usuario varchar(254),
    clave varchar(254),
    tipo varchar(254),
    acceso char(8)
)
;
--
-- Structure for table materias_borradas (OID = 474550094) : 
--
CREATE TABLE public.materias_borradas (
    id_alumno integer,
    id_gestion smallint,
    id_periodo smallint,
    fecha timestamp(0) without time zone DEFAULT now(),
    id_materia integer,
    id_grupo smallint,
    id_usuario varchar(33)
)
;
--
-- Structure for table matri (OID = 474550098) : 
--
CREATE TABLE public.matri (
    id_alumno integer,
    clave text
)
;
--
-- Structure for table meses (OID = 474550104) : 
--
CREATE TABLE public.meses (
    id_mes smallint,
    mes varchar
)
;
--
-- Structure for table miembros (OID = 474550110) : 
--
CREATE TABLE public.miembros (
    id bigserial NOT NULL,
    tipo varchar(255) NOT NULL,
    id_comision integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    nro_dip varchar,
    cargo varchar,
    estado_miembro varchar DEFAULT 'VIGENTE'::character varying
)
;
--
-- Structure for table migrations (OID = 474550119) : 
--
CREATE TABLE public.migrations (
    id serial NOT NULL,
    migration varchar(255) NOT NULL,
    batch integer NOT NULL
)
;
--
-- Structure for table nivel (OID = 474550124) : 
--
CREATE TABLE public.nivel (
    codigo_nivel integer,
    sigla_nivel char(10),
    nombre char(60)
)
;
--
-- Structure for table nivel_salarial (OID = 474550127) : 
--
CREATE TABLE public.nivel_salarial (
    id_niv_sal integer NOT NULL,
    id_tip_pla integer NOT NULL,
    des_nivel varchar(50),
    haber_basico numeric(12,2),
    cantidad smallint,
    gestion smallint,
    estado char(1),
    fecha_ini date DEFAULT now(),
    fecha_fin date DEFAULT now()
)
;
--
-- Structure for table nivel_variable (OID = 474550132) : 
--
CREATE TABLE public.nivel_variable (
    codigo_nivel integer,
    codigo_variable integer
)
;
--
-- Structure for table notas_planilla_convalido (OID = 474550135) : 
--
CREATE TABLE public.notas_planilla_convalido (
    id_convalida integer DEFAULT nextval(('public.notas_planilla_convalido_id_convalida_seq'::text)::regclass) NOT NULL,
    id_matricula integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_alumno integer NOT NULL,
    id_materia smallint NOT NULL,
    id_materia_conv smallint NOT NULL
)
;
--
-- Structure for table notas_planilla_repetidos (OID = 474550139) : 
--
CREATE TABLE public.notas_planilla_repetidos (
    id_repetido serial NOT NULL,
    fecha_repetido timestamp without time zone,
    motivo_repetido text,
    id_matricula integer NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    id_alumno integer NOT NULL,
    id_materia smallint NOT NULL,
    grupo smallint,
    nota numeric(5,2) DEFAULT 0,
    ult_usuario varchar(10) NOT NULL,
    estado char(1) NOT NULL,
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
    tipo varchar(1),
    dictamen varchar(10),
    _fecha_creacion timestamp without time zone
)
;
--
-- Structure for table notass (OID = 474550162) : 
--
CREATE TABLE public.notass (
    r_sigla varchar,
    r_materia varchar,
    r_nivel_academico integer,
    r_id_materia integer,
    notas double precision[]
)
;
--
-- Structure for table numero (OID = 474550168) : 
--
CREATE TABLE public.numero (
    cod_nume smallint,
    nombre varchar(20) NOT NULL
)
;
--
-- Structure for table percepciones_deducciones (OID = 474550171) : 
--
CREATE TABLE public.percepciones_deducciones (
    id_per_ded integer NOT NULL,
    id_tip_pla integer NOT NULL,
    des_concepto varchar(40),
    des_titulo_planilla varchar(20),
    field char(20),
    operacion varchar,
    porcentaje numeric(12,5),
    gestion smallint,
    estado char(1),
    tip_hb_tg char(1),
    per_ded char(1),
    periodo char(1),
    tipo char(1),
    orden smallint
)
;
--
-- Structure for table permission_role (OID = 474550177) : 
--
CREATE TABLE public.permission_role (
    id serial NOT NULL,
    permission_id integer NOT NULL,
    role_id integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
)
;
--
-- Structure for table permission_user (OID = 474550182) : 
--
CREATE TABLE public.permission_user (
    id serial NOT NULL,
    permission_id integer NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
)
;
--
-- Structure for table permissions (OID = 474550187) : 
--
CREATE TABLE public.permissions (
    id serial NOT NULL,
    name varchar(255) NOT NULL,
    slug varchar(255) NOT NULL,
    description varchar(255),
    model varchar(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
)
;
--
-- Structure for table prs_pais_v2 (OID = 474550201) : 
--
CREATE TABLE public.prs_pais_v2 (
    id_pais integer DEFAULT nextval('prs_pais_2_id_pais_seq'::regclass) NOT NULL,
    pais char(255),
    calificacion smallint,
    num_materias smallint,
    estado varchar(1)
)
;
--
-- Structure for table persons (OID = 474550210) : 
--
CREATE TABLE public.persons (
    id varchar(255) NOT NULL,
    ci varchar(255) NOT NULL,
    firstname varchar(255),
    lastname varchar(255),
    name varchar(255) NOT NULL,
    "dateNac" date,
    "placeNac" varchar(255),
    sexo boolean NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    cargo varchar
)
;
--
-- Structure for table pln_subprogramas (OID = 474550218) : 
--
CREATE TABLE public.pln_subprogramas (
    subprograma_id serial NOT NULL,
    id_programa char(3) NOT NULL,
    subprograma_desc varchar(150),
    subprograma_vigente boolean NOT NULL,
    id_plan integer,
    id_subprograma char(3)
)
;
--
-- Structure for table pln_subprogramas_materias (OID = 474550221) : 
--
CREATE TABLE public.pln_subprogramas_materias (
    subprograma_id integer,
    id_materia integer,
    nivel integer
)
;
--
-- Structure for table poa_obj_met (OID = 474550226) : 
--
CREATE TABLE public.poa_obj_met (
    cod_prg char(8),
    cod_pry smallint,
    importe numeric,
    obj_gral text,
    tipo varchar(1),
    nro smallint,
    valor smallint,
    desviaciones text,
    problemas_ident text,
    correctivos_ejec text,
    fuentes_verif text,
    verificacion text,
    concluciones text,
    recomendaciones text,
    gestion smallint,
    fecha_verif date
)
;
--
-- Structure for table poa_responsable (OID = 474550237) : 
--
CREATE TABLE public.poa_responsable (
    cod_prg char(8),
    id_docente integer,
    gestion smallint
)
;
--
-- Structure for table poa_teo (OID = 474550240) : 
--
CREATE TABLE public.poa_teo (
    cod_grp char(8),
    cod_prg char(8),
    fecha timestamp with time zone,
    def_uf text,
    fun_bas text,
    est_org text,
    vision text,
    mision text,
    fod_for text,
    fod_deb text,
    fod_opo text,
    fod_ame text,
    obj_gral text,
    obj_esp1 text,
    met_esp1 text,
    obj_esp2 text,
    met_esp2 text,
    obj_esp3 text,
    met_esp3 text,
    sugerencia text,
    elp smallint,
    egp smallint
)
;
--
-- Structure for table prc_flujos (OID = 474550248) : 
--
CREATE TABLE public.prc_flujos (
    id_proceso integer NOT NULL,
    id_paso smallint NOT NULL,
    programa varchar(128) NOT NULL,
    instrucciones text NOT NULL,
    id_rol varchar(10) NOT NULL
)
;
--
-- Structure for table prc_tramites (OID = 474550254) : 
--
CREATE TABLE public.prc_tramites (
    id_tramite integer DEFAULT nextval(('"prc_tramites_id_tramite_seq"'::text)::regclass) NOT NULL,
    id_proceso integer NOT NULL,
    id_paso smallint NOT NULL,
    variables varchar(128) NOT NULL,
    estado char(1) NOT NULL,
    contenidos varchar(128),
    estatico varchar(128),
    ult_usuario varchar(10)
)
;
--
-- Structure for table preguntas__original (OID = 474550258) : 
--
CREATE TABLE public.preguntas__original (
    ref_pregunta varchar,
    id_programa char(3) DEFAULT 'DER'::bpchar,
    _1 varchar(255),
    "0" varchar(255),
    pregunta varchar,
    opcion1 varchar,
    opcion2 varchar,
    opcion3 varchar,
    opcion4 varchar,
    respuesta varchar,
    id_ref_pregunta integer,
    id_tipo_pregunta integer
)
;
--
-- Structure for table procedencia (OID = 474550265) : 
--
CREATE TABLE public.procedencia (
    id_procedencia integer,
    procedencia varchar
)
;
--
-- Structure for table procesos (OID = 474550271) : 
--
CREATE TABLE public.procesos (
    id_proceso integer DEFAULT nextval(('"procesos_id_proceso_seq"'::text)::regclass) NOT NULL,
    proceso varchar(128) NOT NULL,
    max_pasos smallint,
    estatico varchar(128)
)
;
--
-- Structure for table prs_acceso_calificacion (OID = 474550275) : 
--
CREATE TABLE public.prs_acceso_calificacion (
    id_calificacion char(1) NOT NULL,
    id_acceso char(1) NOT NULL,
    estado char(1) DEFAULT 'P'::bpchar
)
;
--
-- Structure for table prs_accesos (OID = 474550279) : 
--
CREATE TABLE public.prs_accesos (
    id_acceso varchar(1) NOT NULL,
    acceso varchar(20) NOT NULL,
    costo integer NOT NULL
)
;
--
-- Structure for table prs_autogenerado (OID = 474550282) : 
--
CREATE TABLE public.prs_autogenerado (
    corr0 integer DEFAULT nextval(('"prs_autogenerado_corr0_seq"'::text)::regclass) NOT NULL,
    ult_usuario varchar(10),
    fec_registro date DEFAULT now()
)
;
--
-- Structure for table prs_colegios_2 (OID = 474550287) : 
--
CREATE TABLE public.prs_colegios_2 (
    id_colegio smallint NOT NULL,
    colegio varchar(65) NOT NULL,
    tipo char(1) DEFAULT 'F'::bpchar NOT NULL,
    turno char(1) DEFAULT 'D'::bpchar NOT NULL,
    area char(1) DEFAULT 'U'::bpchar NOT NULL,
    cod_dep smallint DEFAULT 5 NOT NULL,
    cod_prov smallint DEFAULT 1 NOT NULL,
    cod_loc smallint DEFAULT 1494 NOT NULL
)
;
--
-- Structure for table prs_colegios_borrar (OID = 474550296) : 
--
CREATE TABLE public.prs_colegios_borrar (
    a varchar,
    b varchar,
    c varchar NOT NULL,
    d varchar,
    e varchar,
    f varchar,
    g varchar
)
;
--
-- Structure for table prs_dias (OID = 474550304) : 
--
CREATE TABLE public.prs_dias (
    id_dia smallint,
    dia varchar(20)
)
;
--
-- Structure for table prs_observaciones (OID = 474550307) : 
--
CREATE TABLE public.prs_observaciones (
    id_obs serial NOT NULL,
    nro_dip varchar(15) NOT NULL,
    id_gestion smallint,
    id_periodo smallint,
    detalle varchar(30),
    fecha date,
    tipo varchar(1),
    id_programa char(3),
    ult_usuario varchar(10),
    estado char(1),
    obs varchar(30)
)
;
--
-- Structure for table prs_procedencia (OID = 474550314) : 
--
CREATE TABLE public.prs_procedencia (
    id_procedencia integer,
    procedencia varchar
)
;
--
-- Structure for table prs_sexos (OID = 474550320) : 
--
CREATE TABLE public.prs_sexos (
    id_sexo bpchar,
    sexo varchar
)
;
--
-- Structure for table puesto (OID = 474550326) : 
--
CREATE TABLE public.puesto (
    item char(5),
    cod_prg char(8),
    des_pue varchar(80),
    horas_trabajo numeric(7,2),
    id_ubi_pue integer,
    id_niv_sal integer,
    id_tip_pla integer DEFAULT 1,
    id_dedicacion smallint DEFAULT 1 NOT NULL,
    id_puesto integer DEFAULT nextval(('"_puesto_sec"'::text)::regclass),
    gestion smallint,
    estado char(1),
    id_org smallint
)
;
--
-- Structure for table puesto_persona (OID = 474550332) : 
--
CREATE TABLE public.puesto_persona (
    id_puesto_persona integer DEFAULT nextval(('"_pue_per"'::text)::regclass) NOT NULL,
    id_puesto integer NOT NULL,
    ci_per char(15),
    fecha_inicio date,
    fecha_final date,
    grado_academico varchar,
    puntaje numeric(6,2)
)
;
--
-- Structure for table recibo_autogenerado (OID = 474550339) : 
--
CREATE TABLE public.recibo_autogenerado (
    corr0 integer DEFAULT nextval(('"recibo_autogenerado_corr0_seq"'::text)::regclass) NOT NULL,
    ult_usuario varchar(10),
    fec_registro date
)
;
--
-- Structure for table role_user (OID = 474550343) : 
--
CREATE TABLE public.role_user (
    id serial NOT NULL,
    role_id integer NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp(0) without time zone DEFAULT now(),
    updated_at timestamp(0) without time zone DEFAULT now(),
    deleted_at timestamp(0) without time zone
)
;
--
-- Structure for table roles (OID = 474550350) : 
--
CREATE TABLE public.roles (
    id serial NOT NULL,
    name varchar(255) NOT NULL,
    slug varchar(255) NOT NULL,
    description varchar(255),
    level integer DEFAULT 1 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
)
;
--
-- Structure for table servicios (OID = 474550359) : 
--
CREATE TABLE public.servicios (
    id_servicio varchar(10) NOT NULL,
    servicios varchar(50) NOT NULL,
    estado char(1)
)
;
--
-- Structure for table sessions (OID = 474550362) : 
--
CREATE TABLE public.sessions (
    id varchar(255) NOT NULL,
    user_id bigint,
    ip_address varchar(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
)
;
--
-- Structure for table tipo_planilla (OID = 474550376) : 
--
CREATE TABLE public.tipo_planilla (
    id_tip_pla integer DEFAULT nextval(('"_tip_pla_seq"'::text)::regclass) NOT NULL,
    des_pla varchar(50),
    informe varchar,
    titulo1 varchar(40),
    titulo2 varchar(40),
    gestion smallint,
    estado char(1),
    plantilla_frt oid,
    plantilla_frx oid
)
;
--
-- Structure for table sistemas (OID = 474550396) : 
--
CREATE TABLE public.sistemas (
    tipo_sistema integer NOT NULL,
    sistema varchar,
    estado varchar
)
;
--
-- Structure for table solvencias (OID = 474550402) : 
--
CREATE TABLE public.solvencias (
    id_solvencia serial NOT NULL,
    id_alumno integer,
    nro_dip integer,
    id_programa varchar(5),
    fecha_ini date,
    fecha_fin date,
    estado varchar(1) DEFAULT 'A'::character varying,
    _registro timestamp without time zone DEFAULT now(),
    impresion integer DEFAULT 0,
    cantidad integer DEFAULT 0,
    tipo varchar(1)
)
;
--
-- Structure for table tipo_matricula (OID = 474550411) : 
--
CREATE TABLE public.tipo_matricula (
    id_tipo_matricula integer,
    descripcion varchar,
    estado varchar
)
;
--
-- Structure for table tipo_sistema (OID = 474550417) : 
--
CREATE TABLE public.tipo_sistema (
    id_tipo_sistema char(1),
    sistema varchar,
    estado char(1)
)
;
--
-- Structure for table tipo_transacciones (OID = 474550423) : 
--
CREATE TABLE public.tipo_transacciones (
    id_tipo_transaccion integer NOT NULL,
    descripcion varchar(150)
)
;
--
-- Structure for table tramite (OID = 474550426) : 
--
CREATE TABLE public.tramite (
    id_tramite integer DEFAULT nextval('tramites_id_tramite_seq'::regclass) NOT NULL,
    tipo_tramite varchar(40),
    expedido_por varchar(40),
    ci_solicitante varchar(30),
    id_programa varchar(6),
    estado varchar(12),
    _registro timestamp without time zone DEFAULT now(),
    usuario text,
    id_usuario varchar(4),
    imprecion varchar(25),
    pase_a varchar(56),
    inicio date,
    fin date,
    tenor_tramite text,
    nombre_tramite text
)
;
--
-- Structure for table tramites (OID = 474550433) : 
--
CREATE TABLE public.tramites (
    id_tramite varchar NOT NULL,
    concepto varchar(50) NOT NULL
)
;
--
-- Structure for table uatf_datos_colegios (OID = 474550441) : 
--
CREATE TABLE public.uatf_datos_colegios (
    nro_dip varchar,
    cod_ue varchar
)
;
--
-- Structure for table users (OID = 474550447) : 
--
CREATE TABLE public.users (
    id bigint DEFAULT nextval('users_odiseo_id_seq'::regclass) NOT NULL,
    username varchar(255) NOT NULL,
    ci varchar(255) NOT NULL,
    nombres varchar(255),
    paterno varchar(255),
    materno varchar(255),
    email varchar(255),
    email_verified_at timestamp(0) without time zone,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    activated boolean DEFAULT false NOT NULL,
    token varchar(255) NOT NULL,
    signup_ip_address inet,
    signup_confirmation_ip_address inet,
    signup_sm_ip_address inet,
    admin_ip_address inet,
    updated_ip_address inet,
    deleted_ip_address inet,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    changed_password timestamp(0) without time zone
)
;
--
-- Structure for table users_od (OID = 474550454) : 
--
CREATE TABLE public.users_od (
    id bigserial NOT NULL,
    username varchar(255) NOT NULL,
    password varchar(255) NOT NULL,
    remember_token varchar(255) NOT NULL,
    created_at timestamp(0) without time zone DEFAULT now(),
    updated_at timestamp(0) without time zone DEFAULT now(),
    person_id integer NOT NULL
)
;
--
-- Structure for table valoracion (OID = 474550509) : 
--
CREATE TABLE public.valoracion (
    cod_valoracion integer,
    criterio varchar(50),
    color varchar(15),
    intervalo1 double precision,
    intervalo2 double precision,
    escala1 double precision,
    escala2 double precision,
    valoracion char(70)
)
;
--
-- Structure for table valores_cargos_adicionales (OID = 474550512) : 
--
CREATE TABLE public.valores_cargos_adicionales (
    id serial NOT NULL,
    id_conceptos integer,
    costo numeric,
    id_programa varchar,
    id_gestion integer,
    id_periodo integer,
    tipo_matricula varchar(1) DEFAULT 'N'::character varying,
    id_concepto varchar(4)
)
;
--
-- Structure for table valores_transacciones_postulant (OID = 474550523) : 
--
CREATE TABLE public.valores_transacciones_postulant (
    id_transaccion integer DEFAULT nextval(('"valores_trans_id_transaccio_seq"'::text)::regclass) NOT NULL,
    id_alumno integer NOT NULL,
    id_programa char(3) NOT NULL,
    id_cargo varchar(4),
    id_concepto varchar(4) NOT NULL,
    costo numeric(12,2) DEFAULT 0,
    fecha date DEFAULT now() NOT NULL,
    id_gestion smallint NOT NULL,
    id_periodo smallint NOT NULL,
    ult_usuario varchar(10),
    estado char(1),
    id_ra varchar(10),
    envia varchar(10),
    id_tipo_transaccion integer,
    sistema char(1)
)
;
--
-- Structure for table valores_transacciones_sau (OID = 474550529) : 
--
CREATE TABLE public.valores_transacciones_sau (
    id_transaccion serial NOT NULL,
    id_caja_tran integer NOT NULL,
    id_concepto varchar(4) NOT NULL,
    costo numeric(12,2) DEFAULT 0,
    fecha date DEFAULT now() NOT NULL,
    ult_usuario varchar(10)
)
;
--
-- Structure for table variables (OID = 474550536) : 
--
CREATE TABLE public.variables (
    codigo_variable integer,
    sigla_variable char(10),
    nombre char(200),
    exigencia_indicador text,
    descripcion char(50),
    id_gestion_creado integer,
    estado integer,
    escala_1 char(200),
    escala_2 char(200),
    escala_3 char(200),
    escala_4 char(200),
    escala_5 char(200)
)
;
--
-- Structure for table vl_avance (OID = 474550542) : 
--
CREATE TABLE public.vl_avance (
    round numeric
)
;
--
-- Structure for table vl_cuotas_pagadas (OID = 474550548) : 
--
CREATE TABLE public.vl_cuotas_pagadas (
    r_nro_cuota integer,
    r_id_cargo varchar,
    r_cargo varchar,
    r_id_gestion integer,
    r_id_periodo integer,
    r_tipo_pago varchar,
    r_costo numeric,
    r_nro_factura varchar,
    r_usuario varchar,
    r_fecha_pago timestamp without time zone
)
;
--
-- Structure for table vl_estado_presentado (OID = 474550554) : 
--
CREATE TABLE public.vl_estado_presentado (
    estado_presentado varchar(15)
)
;
--
-- Structure for table vl_id_materias (OID = 474550557) : 
--
CREATE TABLE public.vl_id_materias (
    array_agg smallint[]
)
;
--
-- Structure for table vl_id_periodo (OID = 474550563) : 
--
CREATE TABLE public.vl_id_periodo (
    iff numeric
)
;
--
-- Structure for table vl_id_readmision (OID = 474550569) : 
--
CREATE TABLE public.vl_id_readmision (
    id_readmision integer
)
;
--
-- Structure for table vl_importe_matricula (OID = 474550572) : 
--
CREATE TABLE public.vl_importe_matricula (
    sum numeric
)
;
--
-- Structure for table vl_importe_tramite (OID = 474550578) : 
--
CREATE TABLE public.vl_importe_tramite (
    sum numeric
)
;
--
-- Structure for table vl_json (OID = 474550584) : 
--
CREATE TABLE public.vl_json (
    oid oid,
    cal_sem_ant json
)
;
--
-- Structure for table vl_periodos (OID = 474550590) : 
--
CREATE TABLE public.vl_periodos (
    array_agg bpchar[]
)
;
--
-- Structure for table vl_permanencia (OID = 474550596) : 
--
CREATE TABLE public.vl_permanencia (
    count bigint
)
;
--
-- Definition for index alm_programaciones_alm_programaciones_new_id_alumn (OID = 8351365) : 
--
SET search_path = academico, pg_catalog;
CREATE UNIQUE INDEX alm_programaciones_alm_programaciones_new_id_alumn ON alm_programaciones USING btree (id_alumno, id_materia, id_gestion, id_periodo, id_grupo);
--
-- Definition for index alm_programaciones_id_alumno_id_gestion (OID = 8351366) : 
--
CREATE INDEX alm_programaciones_id_alumno_id_gestion ON alm_programaciones USING btree (id_alumno, id_gestion);
--
-- Definition for index alm_programaciones_id_gestion_id_periodo (OID = 8351368) : 
--
CREATE INDEX alm_programaciones_id_gestion_id_periodo ON alm_programaciones USING btree (id_gestion, id_periodo);
--
-- Definition for index alm_programaciones_id_materia_id_gestion_id_periodo_id_grupo (OID = 8351369) : 
--
CREATE INDEX alm_programaciones_id_materia_id_gestion_id_periodo_id_grupo ON alm_programaciones USING btree (id_materia, id_gestion, id_periodo, id_grupo);
--
-- Definition for index alm_programaciones_id_materia_id_grupo (OID = 8351376) : 
--
CREATE INDEX alm_programaciones_id_materia_id_grupo ON alm_programaciones USING btree (id_materia, id_grupo);
--
-- Definition for index alm_programaciones_lab_new_id_alumn (OID = 8351380) : 
--
CREATE UNIQUE INDEX alm_programaciones_lab_new_id_alumn ON alm_programaciones_lab USING btree (id_alumno, id_materia, id_gestion, id_periodo, id_grupo);
--
-- Definition for index alm_programaciones_new_index_id_alumno (OID = 8351381) : 
--
CREATE INDEX alm_programaciones_new_index_id_alumno ON alm_programaciones USING btree (id_alumno);
--
-- Definition for index alm_programaciones_new_index_id_gestion (OID = 8351382) : 
--
CREATE INDEX alm_programaciones_new_index_id_gestion ON alm_programaciones USING btree (id_periodo);
--
-- Definition for index alm_programaciones_new_index_id_periodo (OID = 8351386) : 
--
CREATE INDEX alm_programaciones_new_index_id_periodo ON alm_programaciones USING btree (id_periodo);
--
-- Definition for index alm_programaciones_new_index_materia (OID = 8351392) : 
--
CREATE INDEX alm_programaciones_new_index_materia ON alm_programaciones USING btree (id_materia);
--
-- Definition for index alumnos_alumnos_id_alumno (OID = 8351393) : 
--
CREATE INDEX alumnos_alumnos_id_alumno ON alumnos USING btree (id_alumno);
--
-- Definition for index alumnos_alumnos_new_new_index_id_ra (OID = 8351394) : 
--
CREATE INDEX alumnos_alumnos_new_new_index_id_ra ON alumnos USING btree (id_ra);
--
-- Definition for index dct_asignaciones_id_docente_id_ (OID = 8351395) : 
--
CREATE INDEX dct_asignaciones_id_docente_id_ ON dct_asignaciones USING btree (id_docente, id_programa, id_materia, id_grupo, id_gestion, id_periodo);
--
-- Definition for index dct_asingaciones_gestion_periodo_materia (OID = 8351396) : 
--
CREATE INDEX dct_asingaciones_gestion_periodo_materia ON dct_asignaciones USING btree (id_gestion, id_periodo, id_materia);
--
-- Definition for index fki_alumnos_prs_examen (OID = 8351397) : 
--
CREATE INDEX fki_alumnos_prs_examen ON alumnos USING btree (id_tipo_aprobacion);
--
-- Definition for index fki_fkey_alm_programas_sis_deva_carrera (OID = 8351398) : 
--
CREATE INDEX fki_fkey_alm_programas_sis_deva_carrera ON sist_deva_carrera USING btree (id_programa);
--
-- Definition for index fki_fkey_devaluacion_sis_deva_evaluacion (OID = 8351399) : 
--
CREATE INDEX fki_fkey_devaluacion_sis_deva_evaluacion ON sist_deva_carrera USING btree (id_devaluacion);
--
-- Definition for index fki_fkey_evaluacion_devaluacion (OID = 8351400) : 
--
CREATE INDEX fki_fkey_evaluacion_devaluacion ON devaluacion USING btree (codse);
--
-- Definition for index fki_foreign_key_alm_programas_alm_programas_facultades (OID = 8351401) : 
--
CREATE INDEX fki_foreign_key_alm_programas_alm_programas_facultades ON alm_programas USING btree (id_facultad);
--
-- Definition for index fki_foreign_key_alm_programas_carreras_tipos (OID = 8351402) : 
--
CREATE INDEX fki_foreign_key_alm_programas_carreras_tipos ON alm_programas USING btree (tipo);
--
-- Definition for index fki_foreign_key_alm_programas_sedes (OID = 8351403) : 
--
CREATE INDEX fki_foreign_key_alm_programas_sedes ON alm_programas USING btree (sede);
--
-- Definition for index fki_foreign_key_alumnos_alm_programas (OID = 8351404) : 
--
CREATE INDEX fki_foreign_key_alumnos_alm_programas ON alumnos USING btree (id_programa);
--
-- Definition for index fki_foreign_key_alumnos_alumnos_estados (OID = 8351405) : 
--
CREATE INDEX fki_foreign_key_alumnos_alumnos_estados ON alumnos USING btree (estado);
--
-- Definition for index fki_foreign_key_alumnos_uatf_datos (OID = 8351406) : 
--
CREATE INDEX fki_foreign_key_alumnos_uatf_datos ON alumnos USING btree (id_ra);
--
-- Definition for index fki_foreign_key_dct_asignaciones_alm_programas (OID = 8351407) : 
--
CREATE INDEX fki_foreign_key_dct_asignaciones_alm_programas ON dct_asignaciones USING btree (id_programa);
--
-- Definition for index fki_foreign_key_docentes_docentes_tiempo (OID = 8351408) : 
--
CREATE INDEX fki_foreign_key_docentes_docentes_tiempo ON docentes USING btree (tiempo);
--
-- Definition for index fki_foreign_key_planes_pln_materias_1 (OID = 8351409) : 
--
CREATE INDEX fki_foreign_key_planes_pln_materias_1 ON planes USING btree (id_materia_ant);
--
-- Definition for index fki_foreign_key_planes_pln_materias_2 (OID = 8351410) : 
--
CREATE INDEX fki_foreign_key_planes_pln_materias_2 ON planes USING btree (id_materia_eqv);
--
-- Definition for index idx_alm_programaciones_id_alumno_id_materia (OID = 8351411) : 
--
CREATE INDEX idx_alm_programaciones_id_alumno_id_materia ON alm_programaciones USING btree (id_alumno, id_materia);
--
-- Definition for index planes_id_plan_id_programa (OID = 8351421) : 
--
CREATE INDEX planes_id_plan_id_programa ON planes USING btree (id_plan, id_programa);
--
-- Definition for index planes_id_plan_id_programa_id_m (OID = 8351422) : 
--
CREATE INDEX planes_id_plan_id_programa_id_m ON planes USING btree (id_plan, id_programa, id_materia_eqv);
--
-- Definition for index uniq_dct_asignaciones_id_materia_id_grupo_id_gestion_id_periodo (OID = 8351423) : 
--
CREATE INDEX uniq_dct_asignaciones_id_materia_id_grupo_id_gestion_id_periodo ON dct_asignaciones USING btree (id_materia, id_grupo, id_gestion, id_periodo);
--
-- Definition for index uniq_id_alumno (OID = 8351424) : 
--
CREATE INDEX uniq_id_alumno ON notas_planilla USING btree (id_alumno);
--
-- Definition for index uniq_id_gestion_id_periodo (OID = 8351428) : 
--
CREATE INDEX uniq_id_gestion_id_periodo ON notas_planilla USING btree (id_gestion, id_periodo, id_materia);
--
-- Definition for index uniq_id_materia (OID = 8351441) : 
--
CREATE INDEX uniq_id_materia ON notas_planilla USING btree (id_materia);
--
-- Definition for index uniq_id_materia_id_grupo_id_gestion_id_periodo (OID = 8351459) : 
--
CREATE INDEX uniq_id_materia_id_grupo_id_gestion_id_periodo ON notas_planilla USING btree (id_materia, grupo, id_gestion, id_periodo);
--
-- Definition for index uniq_id_matricula_id_gestion (OID = 8351461) : 
--
CREATE INDEX uniq_id_matricula_id_gestion ON notas_planilla USING btree (id_matricula, id_gestion, id_periodo, id_materia, id_alumno);
--
-- Definition for index fki_aux_alumnos_fkey (OID = 8351465) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE INDEX fki_aux_alumnos_fkey ON aux_postulantes USING btree (id_alumno);
--
-- Definition for index fki_aux_asignaturas_fkey (OID = 8351466) : 
--
CREATE INDEX fki_aux_asignaturas_fkey ON aux_postulantes USING btree (id_materia);
--
-- Definition for index bc_postulantes_id_alumno_id_gestion_tipo_post_idx (OID = 8351469) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE INDEX bc_postulantes_id_alumno_id_gestion_tipo_post_idx ON bc_postulantes USING btree (id_alumno, id_gestion, tipo_post);
--
-- Definition for index fki_alumnos_materias_lista_fk (OID = 8351471) : 
--
SET search_path = consola, pg_catalog;
CREATE INDEX fki_alumnos_materias_lista_fk ON alumnos_materias_lista USING btree (id_alumnos_materias);
--
-- Definition for index fki_fkey_sol (OID = 8351472) : 
--
SET search_path = diu, pg_catalog;
CREATE INDEX fki_fkey_sol ON diu_impresion USING btree (id_solicitud);
--
-- Definition for index fki_fkey_ts (OID = 8351473) : 
--
CREATE INDEX fki_fkey_ts ON diu_solicitud USING btree (id_tipo_solicitud);
--
-- Definition for index _tableros_corr0_key (OID = 8351474) : 
--
SET search_path = frida, pg_catalog;
CREATE UNIQUE INDEX _tableros_corr0_key ON _tableros USING btree (corr0);
--
-- Definition for index fki_escp (OID = 8351475) : 
--
SET search_path = postulantes, pg_catalog;
CREATE INDEX fki_escp ON _postulantes USING btree (id_estado_civil);
--
-- Definition for index fki_id_persona (OID = 8351476) : 
--
CREATE INDEX fki_id_persona ON _apoderado USING btree (id_persona);
--
-- Definition for index new_index_ci (OID = 8351477) : 
--
CREATE INDEX new_index_ci ON personas11122012 USING btree (nro_dip);
--
-- Definition for index new_index_mat (OID = 8351479) : 
--
CREATE INDEX new_index_mat ON personas11122012 USING btree (materno);
--
-- Definition for index new_index_nom (OID = 8351480) : 
--
CREATE INDEX new_index_nom ON personas11122012 USING btree (nombres);
--
-- Definition for index new_index_pat (OID = 8351484) : 
--
CREATE INDEX new_index_pat ON personas11122012 USING btree (paterno);
--
-- Definition for index pkey (OID = 8351485) : 
--
CREATE INDEX pkey ON personas USING btree (id_persona);
--
-- Definition for index pkeypostulante (OID = 8351486) : 
--
CREATE INDEX pkeypostulante ON postulante USING btree (id_persona);
--
-- Definition for index postulantes_id_alumno_key (OID = 8351487) : 
--
CREATE UNIQUE INDEX postulantes_id_alumno_key ON postulantes USING btree (id_alumno);
--
-- Definition for index alm_carnets_corr0_key (OID = 8351545) : 
--
SET search_path = recycler, pg_catalog;
CREATE UNIQUE INDEX alm_carnets_corr0_key ON alm_carnets USING btree (corr0);
--
-- Definition for index pkey_bloqueados (OID = 8351546) : 
--
CREATE INDEX pkey_bloqueados ON alumnos_bloqueados USING btree (id_bloqueado);
--
-- Definition for index plan_requisito_id_plan_id_programa (OID = 8351547) : 
--
CREATE INDEX plan_requisito_id_plan_id_programa ON plan_requisito USING btree (id_plan, id_programa);
--
-- Definition for index plan_requisito_id_plan_id_programa_id_m (OID = 8351548) : 
--
CREATE INDEX plan_requisito_id_plan_id_programa_id_m ON plan_requisito USING btree (id_plan, id_programa, id_materia_eqv);
--
-- Definition for index postulantes_antes_id_alumno_key (OID = 8351549) : 
--
CREATE UNIQUE INDEX postulantes_antes_id_alumno_key ON postulantes_antes USING btree (id_alumno);
--
-- Definition for index fki_fk (OID = 8351550) : 
--
SET search_path = roles, pg_catalog;
CREATE INDEX fki_fk ON _bp_usuarios USING btree (id_persona);
--
-- Definition for index bc_postulantes_1_id_alumno_id_gestion_tipo_post_idx (OID = 85215923) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE INDEX bc_postulantes_1_id_alumno_id_gestion_tipo_post_idx ON bc_postulantes_1 USING btree (id_alumno, id_gestion, tipo_post);
--
-- Definition for index bc_postulantes_2_id_alumno_id_gestion_tipo_post_idx (OID = 85284627) : 
--
CREATE INDEX bc_postulantes_2_id_alumno_id_gestion_tipo_post_idx ON bc_postulantes_2 USING btree (id_alumno, id_gestion, tipo_post);
--
-- Definition for index bc_postulantes_bck_id_alumno_id_gestion_tipo_post_idx (OID = 85379901) : 
--
CREATE INDEX bc_postulantes_bck_id_alumno_id_gestion_tipo_post_idx ON bc_postulantes_bck USING btree (id_alumno, id_gestion, tipo_post);
--
-- Definition for index pk_id (OID = 96085389) : 
--
SET search_path = academico, pg_catalog;
CREATE INDEX pk_id ON apertura_planillas_reposicion USING btree (id);
--
-- Definition for index password_resets_email_index (OID = 171906199) : 
--
SET search_path = preguntas, pg_catalog;
CREATE INDEX password_resets_email_index ON password_resets USING btree (email);
--
-- Definition for index kardex_password_resets_email_index (OID = 183103957) : 
--
SET search_path = kardex, pg_catalog;
CREATE INDEX kardex_password_resets_email_index ON password_resets USING btree (email);
--
-- Definition for index encuestado_respuesta_idx (OID = 228479284) : 
--
SET search_path = encuestas, pg_catalog;
CREATE INDEX encuestado_respuesta_idx ON encuestado_respuesta USING btree (usuario, id_gestion, id_periodo, id_grupo, id_materia, id_respuesta);
--
-- Definition for index respuestas_idx (OID = 228479316) : 
--
CREATE INDEX respuestas_idx ON respuestas USING btree (id);
--
-- Definition for index password_resets_email_index (OID = 240750812) : 
--
SET search_path = seguro, pg_catalog;
CREATE INDEX password_resets_email_index ON password_resets USING btree (email);
--
-- Definition for index oauth_auth_codes_user_id_index (OID = 240750821) : 
--
CREATE INDEX oauth_auth_codes_user_id_index ON oauth_auth_codes USING btree (user_id);
--
-- Definition for index oauth_access_tokens_user_id_index (OID = 240750830) : 
--
CREATE INDEX oauth_access_tokens_user_id_index ON oauth_access_tokens USING btree (user_id);
--
-- Definition for index oauth_refresh_tokens_access_token_id_index (OID = 240750836) : 
--
CREATE INDEX oauth_refresh_tokens_access_token_id_index ON oauth_refresh_tokens USING btree (access_token_id);
--
-- Definition for index oauth_clients_user_id_index (OID = 240750848) : 
--
CREATE INDEX oauth_clients_user_id_index ON oauth_clients USING btree (user_id);
--
-- Definition for index busquedas_idx_idx (OID = 240768442) : 
--
SET search_path = academico, pg_catalog;
CREATE INDEX busquedas_idx_idx ON busquedas_idx USING gin (idx);
--
-- Definition for index users_od_nro_dip (OID = 277169490) : 
--
SET search_path = postulantes, pg_catalog;
CREATE INDEX users_od_nro_dip ON users_od USING btree (nro_dip);
--
-- Definition for index bc_postulantes_bk_id_alumno_id_gestion_tipo_post_idx (OID = 277176897) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE INDEX bc_postulantes_bk_id_alumno_id_gestion_tipo_post_idx ON bc_postulantes_bk USING btree (id_alumno, id_gestion, tipo_post);
--
-- Definition for index _postulaciones_idx_todo (OID = 277227989) : 
--
SET search_path = postulantes, pg_catalog;
CREATE INDEX _postulaciones_idx_todo ON _postulaciones USING btree (id_programa, id_gestion, id_periodo, id_modalidad);
--
-- Definition for index alm_programaciones_simulacion_alm_programaciones_new_id_alumn (OID = 289739185) : 
--
SET search_path = academico, pg_catalog;
CREATE UNIQUE INDEX alm_programaciones_simulacion_alm_programaciones_new_id_alumn ON alm_programaciones_simulacion USING btree (id_alumno, id_materia, id_gestion, id_periodo, id_grupo);
--
-- Definition for index alm_programaciones_simulacion_id_alumno_id_gestion (OID = 289739186) : 
--
CREATE INDEX alm_programaciones_simulacion_id_alumno_id_gestion ON alm_programaciones_simulacion USING btree (id_alumno, id_gestion);
--
-- Definition for index alm_programaciones_simulacion_id_gestion_id_periodo (OID = 289739187) : 
--
CREATE INDEX alm_programaciones_simulacion_id_gestion_id_periodo ON alm_programaciones_simulacion USING btree (id_gestion, id_periodo);
--
-- Definition for index alm_programaciones_simulacion_id_materia_id_gestion_id_periodo_ (OID = 289739188) : 
--
CREATE INDEX alm_programaciones_simulacion_id_materia_id_gestion_id_periodo_ ON alm_programaciones_simulacion USING btree (id_materia, id_gestion, id_periodo, id_grupo);
--
-- Definition for index alm_programaciones_simulacion_id_materia_id_grupo (OID = 289739189) : 
--
CREATE INDEX alm_programaciones_simulacion_id_materia_id_grupo ON alm_programaciones_simulacion USING btree (id_materia, id_grupo);
--
-- Definition for index alm_programaciones_simulacion_new_index_id_alumno (OID = 289739190) : 
--
CREATE INDEX alm_programaciones_simulacion_new_index_id_alumno ON alm_programaciones_simulacion USING btree (id_alumno);
--
-- Definition for index alm_programaciones_simulacion_new_index_id_gestion (OID = 289739191) : 
--
CREATE INDEX alm_programaciones_simulacion_new_index_id_gestion ON alm_programaciones_simulacion USING btree (id_periodo);
--
-- Definition for index alm_programaciones_simulacion_new_index_id_periodo (OID = 289739192) : 
--
CREATE INDEX alm_programaciones_simulacion_new_index_id_periodo ON alm_programaciones_simulacion USING btree (id_periodo);
--
-- Definition for index alm_programaciones_simulacion_new_index_materia (OID = 289739193) : 
--
CREATE INDEX alm_programaciones_simulacion_new_index_materia ON alm_programaciones_simulacion USING btree (id_materia);
--
-- Definition for index alm_programaciones_simulacion_idx_alm_programaciones_id_alumno_ (OID = 289739194) : 
--
CREATE INDEX alm_programaciones_simulacion_idx_alm_programaciones_id_alumno_ ON alm_programaciones_simulacion USING btree (id_alumno, id_materia);
--
-- Definition for index planes_idx (OID = 315381713) : 
--
CREATE INDEX planes_idx ON planes USING btree (id_plan, id_programa, id_materia_ant);
--
-- Definition for index notas_planilla_idx (OID = 315381716) : 
--
CREATE INDEX notas_planilla_idx ON notas_planilla USING btree (id_alumno, id_materia);
--
-- Definition for index password_resets_email_index (OID = 315386279) : 
--
SET search_path = conteo, pg_catalog;
CREATE INDEX password_resets_email_index ON password_resets USING btree (email);
--
-- Definition for index personal_access_tokens_tokenable_type_tokenable_id_index (OID = 315386305) : 
--
CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON personal_access_tokens USING btree (tokenable_type, tokenable_id);
--
-- Definition for index dct_asignaciones_extra_dct_asingaciones_gestion_periodo_materia (OID = 343351867) : 
--
SET search_path = sis_directores, pg_catalog;
CREATE INDEX dct_asignaciones_extra_dct_asingaciones_gestion_periodo_materia ON dct_asignaciones_extra USING btree (id_gestion, id_periodo, id_materia);
--
-- Definition for index dct_asignaciones_extra_fki_foreign_key_dct_asignaciones_alm_pro (OID = 343351868) : 
--
CREATE INDEX dct_asignaciones_extra_fki_foreign_key_dct_asignaciones_alm_pro ON dct_asignaciones_extra USING btree (id_programa);
--
-- Definition for index dct_asignaciones_extra_id_docente_id_ (OID = 343351869) : 
--
CREATE INDEX dct_asignaciones_extra_id_docente_id_ ON dct_asignaciones_extra USING btree (id_docente, id_programa, id_materia, id_grupo, id_gestion, id_periodo);
--
-- Definition for index dct_asignaciones_extra_uniq_dct_asignaciones_id_materia_id_grup (OID = 343351870) : 
--
CREATE INDEX dct_asignaciones_extra_uniq_dct_asignaciones_id_materia_id_grup ON dct_asignaciones_extra USING btree (id_materia, id_grupo, id_gestion, id_periodo);
--
-- Definition for index tipo_matricula_idx (OID = 343371632) : 
--
SET search_path = matriculas, pg_catalog;
CREATE INDEX tipo_matricula_idx ON tipo_matricula USING btree (id_tipo_matricula);
--
-- Definition for index dct_asignaciones_extra_dct_asingaciones_gestion_periodo_materia (OID = 356334254) : 
--
SET search_path = sis_odiseo, pg_catalog;
CREATE INDEX dct_asignaciones_extra_dct_asingaciones_gestion_periodo_materia ON dct_asignaciones_extra USING btree (id_gestion, id_periodo, id_materia);
--
-- Definition for index dct_asignaciones_extra_fki_foreign_key_dct_asignaciones_alm_pro (OID = 356334255) : 
--
CREATE INDEX dct_asignaciones_extra_fki_foreign_key_dct_asignaciones_alm_pro ON dct_asignaciones_extra USING btree (id_programa);
--
-- Definition for index dct_asignaciones_extra_id_docente_id_ (OID = 356334256) : 
--
CREATE INDEX dct_asignaciones_extra_id_docente_id_ ON dct_asignaciones_extra USING btree (id_docente, id_programa, id_materia, id_grupo, id_gestion, id_periodo);
--
-- Definition for index dct_asignaciones_extra_uniq_dct_asignaciones_id_materia_id_grup (OID = 356334257) : 
--
CREATE INDEX dct_asignaciones_extra_uniq_dct_asignaciones_id_materia_id_grup ON dct_asignaciones_extra USING btree (id_materia, id_grupo, id_gestion, id_periodo);
--
-- Definition for index planes_inf_fki_foreign_key_planes_pln_materias_1 (OID = 382959833) : 
--
SET search_path = academico, pg_catalog;
CREATE INDEX planes_inf_fki_foreign_key_planes_pln_materias_1 ON planes_inf USING btree (id_materia);
--
-- Definition for index planes_inf_id_plan_id_programa (OID = 382959834) : 
--
CREATE INDEX planes_inf_id_plan_id_programa ON planes_inf USING btree (id_plan, id_programa);
--
-- Definition for index planes_inf_idx (OID = 382959835) : 
--
CREATE INDEX planes_inf_idx ON planes_inf USING btree (id_plan, id_programa, id_materia);
--
-- Definition for index busquedas_idx_idx (OID = 383147975) : 
--
SET search_path = binvestigacion, pg_catalog;
CREATE INDEX busquedas_idx_idx ON busquedas_idx USING gin (idx);
--
-- Definition for index busquedas_idx_idx1 (OID = 383156866) : 
--
SET search_path = becas, pg_catalog;
CREATE INDEX busquedas_idx_idx1 ON busquedas_idx USING gin (idx);
--
-- Definition for index password_resets_email_index (OID = 383158052) : 
--
SET search_path = sis_heracles, pg_catalog;
CREATE INDEX password_resets_email_index ON password_resets USING btree (email);
--
-- Definition for index personal_access_tokens_tokenable_type_tokenable_id_index (OID = 383158078) : 
--
CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON personal_access_tokens USING btree (tokenable_type, tokenable_id);
--
-- Definition for index model_has_permissions_model_id_model_type_index (OID = 383158110) : 
--
CREATE INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions USING btree (model_id, model_type);
--
-- Definition for index model_has_roles_model_id_model_type_index (OID = 383158121) : 
--
CREATE INDEX model_has_roles_model_id_model_type_index ON model_has_roles USING btree (model_id, model_type);
--
-- Definition for index archivo_planillas_idx (OID = 383180197) : 
--
SET search_path = dar, pg_catalog;
CREATE UNIQUE INDEX archivo_planillas_idx ON archivo_planillas USING btree (id_programa, sigla, id_gestion, id_periodo, id_grupo);
--
-- Definition for index personal_access_tokens_tokenable_type_tokenable_id_index (OID = 397002628) : 
--
SET search_path = psa, pg_catalog;
CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON personal_access_tokens USING btree (tokenable_type, tokenable_id);
--
-- Definition for index soa_idx (OID = 440260147) : 
--
SET search_path = calendario, pg_catalog;
CREATE INDEX soa_idx ON soa USING btree (id_tipo_calendario);
--
-- Definition for index asignaciones_detalles_idx (OID = 440303839) : 
--
SET search_path = designaciones, pg_catalog;
CREATE INDEX asignaciones_detalles_idx ON asignaciones_detalles USING btree (id_asignaciones);
--
-- Definition for index idx_id_postulante (OID = 441157979) : 
--
SET search_path = academico, pg_catalog;
CREATE INDEX idx_id_postulante ON alumnos USING btree (id_postulante);
--
-- Definition for index idx_notas_alumno_materia (OID = 441365826) : 
--
CREATE INDEX idx_notas_alumno_materia ON notas_planilla USING btree (id_alumno, id_materia);
--
-- Definition for index idx_alumnos_id (OID = 441365827) : 
--
CREATE INDEX idx_alumnos_id ON alumnos USING btree (id_alumno);
--
-- Definition for index idx_pln_materias_id (OID = 441365838) : 
--
CREATE INDEX idx_pln_materias_id ON pln_materias USING btree (id_materia);
--
-- Definition for index idx_notas_alumno_materia_gestion_periodo (OID = 441365839) : 
--
CREATE INDEX idx_notas_alumno_materia_gestion_periodo ON notas_planilla USING btree (id_alumno, id_materia, id_gestion, id_periodo);
--
-- Definition for index idx_np_alumno_materia (OID = 441365853) : 
--
CREATE INDEX idx_np_alumno_materia ON notas_planilla USING btree (id_alumno, id_materia);
--
-- Definition for index idx_np_alumno_materia_gestion_periodo (OID = 441365854) : 
--
CREATE INDEX idx_np_alumno_materia_gestion_periodo ON notas_planilla USING btree (id_alumno, id_materia, id_gestion, id_periodo);
--
-- Definition for index pln_materias_tmp_idx_pln_materias_id (OID = 441477062) : 
--
CREATE INDEX pln_materias_tmp_idx_pln_materias_id ON pln_materias_tmp USING btree (id_materia);
--
-- Definition for index sessions_user_id_index (OID = 441583877) : 
--
SET search_path = b_investigacion, pg_catalog;
CREATE INDEX sessions_user_id_index ON sessions USING btree (user_id);
--
-- Definition for index sessions_last_activity_index (OID = 441583878) : 
--
CREATE INDEX sessions_last_activity_index ON sessions USING btree (last_activity);
--
-- Definition for index jobs_queue_index (OID = 441583906) : 
--
CREATE INDEX jobs_queue_index ON jobs USING btree (queue);
--
-- Definition for index model_has_permissions_model_id_model_type_index (OID = 441583958) : 
--
CREATE INDEX model_has_permissions_model_id_model_type_index ON model_has_permissions USING btree (model_id, model_type);
--
-- Definition for index model_has_roles_model_id_model_type_index (OID = 441583969) : 
--
CREATE INDEX model_has_roles_model_id_model_type_index ON model_has_roles USING btree (model_id, model_type);
--
-- Definition for index fki_id_unidad_user (OID = 441584211) : 
--
SET search_path = estudiantes, pg_catalog;
CREATE INDEX fki_id_unidad_user ON users USING btree (id_unidad);
--
-- Definition for index fki_id_users_estado (OID = 441584212) : 
--
CREATE INDEX fki_id_users_estado ON users USING btree (id_estado);
--
-- Definition for index fki_id_tipo_rol (OID = 441584252) : 
--
CREATE INDEX fki_id_tipo_rol ON tipo_rol USING btree (id_usuario);
--
-- Definition for index fki_id_roles (OID = 441584274) : 
--
CREATE INDEX fki_id_roles ON roles USING btree (id_tipo);
--
-- Definition for index fki_id_user_rol (OID = 441584275) : 
--
CREATE INDEX fki_id_user_rol ON roles USING btree (id_usuario);
--
-- Definition for index assigned_roles_idx (OID = 441584294) : 
--
CREATE INDEX assigned_roles_idx ON assigned_roles USING btree (user_id, role_id);
--
-- Definition for index idx_id_acta (OID = 441610882) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE INDEX idx_id_acta ON decretos USING btree (id_acta);
--
-- Definition for index idx_usuario_id (OID = 441610883) : 
--
CREATE INDEX idx_usuario_id ON decretos USING btree (usuario_id);
--
-- Definition for index idx_actas_estado (OID = 441611198) : 
--
CREATE INDEX idx_actas_estado ON actas USING btree (estado);
--
-- Definition for index idx_actas_carrera (OID = 441611199) : 
--
CREATE INDEX idx_actas_carrera ON actas USING btree (id_carrera);
--
-- Definition for index idx_decretos_acta (OID = 441611200) : 
--
CREATE INDEX idx_decretos_acta ON decretos USING btree (id_acta);
--
-- Definition for index idx_seguimiento_decreto_id (OID = 441617933) : 
--
CREATE INDEX idx_seguimiento_decreto_id ON seguimiento_decretos USING btree (id_acta);
--
-- Definition for index idx_seguimiento_fecha_ingreso (OID = 441617935) : 
--
CREATE INDEX idx_seguimiento_fecha_ingreso ON seguimiento_decretos USING btree (fecha_ingreso);
--
-- Definition for index idx_seguimiento_fecha_salida (OID = 441617936) : 
--
CREATE INDEX idx_seguimiento_fecha_salida ON seguimiento_decretos USING btree (fecha_salida);
--
-- Definition for index idx_seguimiento_ubicacion (OID = 441620117) : 
--
CREATE INDEX idx_seguimiento_ubicacion ON seguimiento_decretos USING btree (ubicacion_actual);
--
-- Definition for index pln_materias_resplado_idx_pln_materias_id (OID = 442381075) : 
--
SET search_path = academico, pg_catalog;
CREATE INDEX pln_materias_resplado_idx_pln_materias_id ON pln_materias_resplado USING btree (id_materia);
--
-- Definition for index alm_programaciones_idx (OID = 442438684) : 
--
CREATE INDEX alm_programaciones_idx ON alm_programaciones USING btree (metodo_programacion);
--
-- Definition for index laboratorio_users_username_index (OID = 442580171) : 
--
SET search_path = laboratorio, pg_catalog;
CREATE INDEX laboratorio_users_username_index ON users USING btree (username);
--
-- Definition for index laboratorio_users_is_active_index (OID = 442580172) : 
--
CREATE INDEX laboratorio_users_is_active_index ON users USING btree (is_active);
--
-- Definition for index laboratorio_sessions_user_id_index (OID = 442580216) : 
--
CREATE INDEX laboratorio_sessions_user_id_index ON sessions USING btree (user_id);
--
-- Definition for index laboratorio_sessions_last_activity_index (OID = 442580217) : 
--
CREATE INDEX laboratorio_sessions_last_activity_index ON sessions USING btree (last_activity);
--
-- Definition for index alm_programas_num_mat_plan_idx (OID = 481047502) : 
--
SET search_path = public, pg_catalog;
CREATE INDEX alm_programas_num_mat_plan_idx ON alm_programas_num_mat_plan USING btree (id_programa, id_plan);
--
-- Definition for index cajas_transacciones_id_alumno_id_gestion_fec_pago_idx (OID = 481047503) : 
--
CREATE INDEX cajas_transacciones_id_alumno_id_gestion_fec_pago_idx ON cajas_transacciones USING btree (id_alumno, id_gestion, fec_pago);
--
-- Definition for index cajas_transacciones_idx (OID = 481047504) : 
--
CREATE INDEX cajas_transacciones_idx ON cajas_transacciones USING btree (id_alumno);
--
-- Definition for index calendario_modalidades_gestion_periodo (OID = 481047505) : 
--
CREATE INDEX calendario_modalidades_gestion_periodo ON calendario_modalidades USING btree (id_gestion, id_periodo);
--
-- Definition for index cod_prg (OID = 481047506) : 
--
CREATE UNIQUE INDEX cod_prg ON estructura_programa USING btree (cod_prg, gestion);
--
-- Definition for index dedicacion_id_dedicacion_key (OID = 481047507) : 
--
CREATE UNIQUE INDEX dedicacion_id_dedicacion_key ON dedicacion USING btree (id_dedicacion);
--
-- Definition for index fki__bp_estados_civiles_uatf_datos (OID = 481047508) : 
--
CREATE INDEX fki__bp_estados_civiles_uatf_datos ON uatf_datos USING btree (estado_civil);
--
-- Definition for index fki_cod_dep (OID = 481047509) : 
--
CREATE INDEX fki_cod_dep ON lugar_localidad USING btree (cod_dep);
--
-- Definition for index fki_cod_pais (OID = 481047510) : 
--
CREATE INDEX fki_cod_pais ON lugar_localidad USING btree (cod_pais);
--
-- Definition for index fki_cod_prov (OID = 481047511) : 
--
CREATE INDEX fki_cod_prov ON lugar_localidad USING btree (cod_prov);
--
-- Definition for index fki_fk (OID = 481047512) : 
--
CREATE INDEX fki_fk ON dar_tramites USING btree (desc_tramite);
--
-- Definition for index fki_fki_cod_pais (OID = 481047513) : 
--
CREATE INDEX fki_fki_cod_pais ON lugar_localidad_old USING btree (cod_pais);
--
-- Definition for index fki_fki_cod_prov_2 (OID = 481047514) : 
--
CREATE INDEX fki_fki_cod_prov_2 ON lugar_localidad_old USING btree (cod_prov_2);
--
-- Definition for index fki_id_pais (OID = 481047515) : 
--
CREATE INDEX fki_id_pais ON lugar_departamento USING btree (cod_pais);
--
-- Definition for index fki_lugar_colegio (OID = 481047516) : 
--
CREATE INDEX fki_lugar_colegio ON prs_colegios USING btree (cod_loc);
--
-- Definition for index fki_pais (OID = 481047517) : 
--
CREATE INDEX fki_pais ON lugar_provincia USING btree (cod_pais);
--
-- Definition for index fki_prs_calificacion_uatf_datos (OID = 481047518) : 
--
CREATE INDEX fki_prs_calificacion_uatf_datos ON uatf_datos USING btree (id_calificacion);
--
-- Definition for index fki_uatf_datos_lugar_localidad (OID = 481047519) : 
--
CREATE INDEX fki_uatf_datos_lugar_localidad ON uatf_datos USING btree (id_loc);
--
-- Definition for index fki_uatf_datos_prs_colegios (OID = 481047520) : 
--
CREATE INDEX fki_uatf_datos_prs_colegios ON uatf_datos USING btree (id_colegio);
--
-- Definition for index hash_id_ra (OID = 481047521) : 
--
CREATE INDEX hash_id_ra ON uatf_datos USING hash (id_ra);
--
-- Definition for index hash_nro_dip (OID = 481047522) : 
--
CREATE INDEX hash_nro_dip ON uatf_datos USING hash (nro_dip);
--
-- Definition for index id_curso (OID = 481047523) : 
--
CREATE UNIQUE INDEX id_curso ON alm_cursos USING btree (id_curso);
--
-- Definition for index id_niv_sal (OID = 481047524) : 
--
CREATE INDEX id_niv_sal ON puesto USING btree (id_niv_sal);
ALTER TABLE puesto CLUSTER ON id_niv_sal;
--
-- Definition for index id_tip_pla (OID = 481047525) : 
--
CREATE INDEX id_tip_pla ON puesto USING btree (id_tip_pla);
--
-- Definition for index id_ubi_pue (OID = 481047526) : 
--
CREATE INDEX id_ubi_pue ON puesto USING btree (id_ubi_pue);
--
-- Definition for index idx_fac_programas_id (OID = 481047527) : 
--
CREATE INDEX idx_fac_programas_id ON fac_programas USING btree (id_programa);
--
-- Definition for index idx_key (OID = 481047528) : 
--
CREATE INDEX idx_key ON alm_modalidad USING btree (id_programa, id_gestion, id_periodo, id_examen);
--
-- Definition for index idx_provincia (OID = 481047529) : 
--
CREATE UNIQUE INDEX idx_provincia ON lugar_provincia USING btree (cod_dep, cod_prov_original);
--
-- Definition for index idx_ra (OID = 481047530) : 
--
CREATE INDEX idx_ra ON uatf_datos USING btree (id_ra);
--
-- Definition for index idxp_key (OID = 481047531) : 
--
CREATE INDEX idxp_key ON postulantes USING btree (id_programa, id_gestion, id_periodo, examen);
--
-- Definition for index index_vector (OID = 481047532) : 
--
CREATE INDEX index_vector ON uatf_datos USING gist (_tsidx);
--
-- Definition for index lugar_localidad_new_new_idx_prov (OID = 481047534) : 
--
CREATE INDEX lugar_localidad_new_new_idx_prov ON lugar_localidad_old USING btree (cod_dep, cod_prov);
--
-- Definition for index lugar_localidad_original_new_new_idx_prov (OID = 481047535) : 
--
CREATE INDEX lugar_localidad_original_new_new_idx_prov ON lugar_localidad_original USING btree (cod_dep, cod_prov);
--
-- Definition for index matriculas_id_matricula_id_gest (OID = 481047536) : 
--
CREATE UNIQUE INDEX matriculas_id_matricula_id_gest ON matriculas USING btree (id_matricula, id_gestion, id_periodo, id_alumno);
--
-- Definition for index matriculas_idx (OID = 481047537) : 
--
CREATE INDEX matriculas_idx ON matriculas USING btree (id_tipo_matricula);
--
-- Definition for index nivel_salarial_id_niv_sal_key (OID = 481047539) : 
--
CREATE UNIQUE INDEX nivel_salarial_id_niv_sal_key ON nivel_salarial USING btree (id_niv_sal);
--
-- Definition for index percepciones_deducciones_id_per (OID = 481047540) : 
--
CREATE UNIQUE INDEX percepciones_deducciones_id_per ON percepciones_deducciones USING btree (id_per_ded);
--
-- Definition for index permission_role_permission_id_index (OID = 481047541) : 
--
CREATE INDEX permission_role_permission_id_index ON permission_role USING btree (permission_id);
--
-- Definition for index permission_role_role_id_index (OID = 481047542) : 
--
CREATE INDEX permission_role_role_id_index ON permission_role USING btree (role_id);
--
-- Definition for index permission_user_permission_id_index (OID = 481047543) : 
--
CREATE INDEX permission_user_permission_id_index ON permission_user USING btree (permission_id);
--
-- Definition for index permission_user_user_id_index (OID = 481047544) : 
--
CREATE INDEX permission_user_user_id_index ON permission_user USING btree (user_id);
--
-- Definition for index prc_tramites_id_tramite_key (OID = 481047545) : 
--
CREATE UNIQUE INDEX prc_tramites_id_tramite_key ON prc_tramites USING btree (id_tramite);
--
-- Definition for index procesos_id_proceso_key (OID = 481047546) : 
--
CREATE UNIQUE INDEX procesos_id_proceso_key ON procesos USING btree (id_proceso);
--
-- Definition for index prs_autogenerado_corr0_key (OID = 481047547) : 
--
CREATE UNIQUE INDEX prs_autogenerado_corr0_key ON prs_autogenerado USING btree (corr0);
--
-- Definition for index puesto_id_puesto (OID = 481047548) : 
--
CREATE UNIQUE INDEX puesto_id_puesto ON puesto USING btree (id_puesto);
--
-- Definition for index puesto_persona_id_puesto_persona_key (OID = 481047549) : 
--
CREATE UNIQUE INDEX puesto_persona_id_puesto_persona_key ON puesto_persona USING btree (id_puesto_persona);
--
-- Definition for index role_user_role_id_index (OID = 481047550) : 
--
CREATE INDEX role_user_role_id_index ON role_user USING btree (role_id);
--
-- Definition for index role_user_user_id_index (OID = 481047551) : 
--
CREATE INDEX role_user_user_id_index ON role_user USING btree (user_id);
--
-- Definition for index seq_fec_registro (OID = 481047552) : 
--
CREATE INDEX seq_fec_registro ON matriculas USING btree (fec_registro);
--
-- Definition for index seq_id_alumno_id_gestion_id_periodo (OID = 481047553) : 
--
CREATE INDEX seq_id_alumno_id_gestion_id_periodo ON matriculas USING btree (id_alumno, id_gestion, id_periodo);
--
-- Definition for index sessions_last_activity_index (OID = 481047555) : 
--
CREATE INDEX sessions_last_activity_index ON sessions USING btree (last_activity);
--
-- Definition for index sessions_user_id_index (OID = 481047556) : 
--
CREATE INDEX sessions_user_id_index ON sessions USING btree (user_id);
--
-- Definition for index valores_cargos_idx (OID = 481047557) : 
--
CREATE INDEX valores_cargos_idx ON valores_cargos USING btree (id);
--
-- Definition for index valores_cargos_idx1 (OID = 481047558) : 
--
CREATE INDEX valores_cargos_idx1 ON valores_cargos USING btree (id_cargo, id_programa, tipo_matricula);
--
-- Definition for index valores_transacciones_idx (OID = 481047559) : 
--
CREATE INDEX valores_transacciones_idx ON valores_transacciones USING btree (id_caja_tran);
--
-- Definition for index valores_transacciones_idx1 (OID = 481047566) : 
--
CREATE INDEX valores_transacciones_idx1 ON valores_transacciones USING btree (id_cargo, id_concepto, id_gestion, id_periodo);
--
-- Definition for index valores_transacciones_idx2 (OID = 481047576) : 
--
CREATE INDEX valores_transacciones_idx2 ON valores_transacciones USING btree (id_concepto, id_cargo, id_alumno, id_gestion, id_periodo);
--
-- Definition for index valores_transacciones_idx3 (OID = 481047586) : 
--
CREATE INDEX valores_transacciones_idx3 ON valores_transacciones USING btree (id_alumno);
--
-- Definition for index 2do_turno_exceso_pkey (OID = 8350544) : 
--
SET search_path = academico, pg_catalog;
ALTER TABLE ONLY academico."2do_turno_exceso"
    ADD CONSTRAINT "2do_turno_exceso_pkey"
    PRIMARY KEY (id);
--
-- Definition for index alm_descripcion_grupos_id_grupo_key (OID = 8350546) : 
--
ALTER TABLE ONLY academico.alm_descripcion_grupos
    ADD CONSTRAINT alm_descripcion_grupos_id_grupo_key
    UNIQUE (id_grupo);
--
-- Definition for index alm_descripcion_grupos_pkey (OID = 8350548) : 
--
ALTER TABLE ONLY academico.alm_descripcion_grupos
    ADD CONSTRAINT alm_descripcion_grupos_pkey
    PRIMARY KEY (id);
--
-- Definition for index alm_message_pkey (OID = 8350550) : 
--
ALTER TABLE ONLY academico.alm_message
    ADD CONSTRAINT alm_message_pkey
    PRIMARY KEY (id);
--
-- Definition for index alm_metodos_grupos_pkey (OID = 8350552) : 
--
ALTER TABLE ONLY academico.alm_metodos_grupos
    ADD CONSTRAINT alm_metodos_grupos_pkey
    PRIMARY KEY (id);
--
-- Definition for index alm_metodos_normales_pkey (OID = 8350554) : 
--
ALTER TABLE ONLY academico.alm_metodos_normales
    ADD CONSTRAINT alm_metodos_normales_pkey
    PRIMARY KEY (id);
--
-- Definition for index alm_metodos_validacion_pkey (OID = 8350556) : 
--
ALTER TABLE ONLY academico.alm_metodos_validacion
    ADD CONSTRAINT alm_metodos_validacion_pkey
    PRIMARY KEY (id);
--
-- Definition for index alm_periodos_pkey (OID = 8350558) : 
--
ALTER TABLE ONLY academico.alm_periodos
    ADD CONSTRAINT alm_periodos_pkey
    PRIMARY KEY (id_periodo);
--
-- Definition for index alm_programaciones_autorizaciones_pkey (OID = 8350560) : 
--
ALTER TABLE ONLY academico.alm_programaciones_autorizaciones
    ADD CONSTRAINT alm_programaciones_autorizaciones_pkey
    PRIMARY KEY (id);
--
-- Definition for index alm_programaciones_eliminados_pkey (OID = 8350562) : 
--
ALTER TABLE ONLY academico.alm_programaciones_eliminados
    ADD CONSTRAINT alm_programaciones_eliminados_pkey
    PRIMARY KEY (eliminacion_id);
--
-- Definition for index alm_programas_facultades_pkey (OID = 8350564) : 
--
ALTER TABLE ONLY academico.alm_programas_facultades
    ADD CONSTRAINT alm_programas_facultades_pkey
    PRIMARY KEY (id_facultad);
--
-- Definition for index alm_programas_id_programa_key (OID = 8350566) : 
--
ALTER TABLE ONLY academico.alm_programas
    ADD CONSTRAINT alm_programas_id_programa_key
    UNIQUE (id_programa);
--
-- Definition for index alm_programas_informacion_pkey (OID = 8350568) : 
--
ALTER TABLE ONLY academico.alm_programas_informacion
    ADD CONSTRAINT alm_programas_informacion_pkey
    PRIMARY KEY (id_programa);
--
-- Definition for index alm_programas_new_pkey (OID = 8350570) : 
--
ALTER TABLE ONLY academico.alm_programas
    ADD CONSTRAINT alm_programas_new_pkey
    PRIMARY KEY (id_programa);
--
-- Definition for index alm_programas_parametros_id_programa_id_gestion_id_periodo_key (OID = 8350572) : 
--
ALTER TABLE ONLY academico.alm_programas_parametros
    ADD CONSTRAINT alm_programas_parametros_id_programa_id_gestion_id_periodo_key
    UNIQUE (id_programa, id_gestion, id_periodo);
--
-- Definition for index alm_programas_parametros_pkey (OID = 8350574) : 
--
ALTER TABLE ONLY academico.alm_programas_parametros
    ADD CONSTRAINT alm_programas_parametros_pkey
    PRIMARY KEY (id);
--
-- Definition for index alumnos_claves_certificado_pkey (OID = 8350576) : 
--
ALTER TABLE ONLY academico.alumnos_claves_certificado
    ADD CONSTRAINT alumnos_claves_certificado_pkey
    PRIMARY KEY (id);
--
-- Definition for index alumnos_estados_pkey (OID = 8350578) : 
--
ALTER TABLE ONLY academico.alumnos_estados
    ADD CONSTRAINT alumnos_estados_pkey
    PRIMARY KEY (estado);
--
-- Definition for index alumnos_pkey (OID = 8350580) : 
--
ALTER TABLE ONLY academico.alumnos
    ADD CONSTRAINT alumnos_pkey
    PRIMARY KEY (id_alumno);
--
-- Definition for index carreras_menciones_pkey (OID = 8350582) : 
--
ALTER TABLE ONLY academico.carreras_menciones
    ADD CONSTRAINT carreras_menciones_pkey
    PRIMARY KEY (id);
--
-- Definition for index carreras_tipos_pkey (OID = 8350584) : 
--
ALTER TABLE ONLY academico.carreras_tipos
    ADD CONSTRAINT carreras_tipos_pkey
    PRIMARY KEY (tipo);
--
-- Definition for index dct_archivos_subidos_pkey (OID = 8350586) : 
--
ALTER TABLE ONLY academico.dct_archivos_subidos
    ADD CONSTRAINT dct_archivos_subidos_pkey
    PRIMARY KEY (id);
--
-- Definition for index dct_asignaciones_id_programa_id_materia_id_grupo_id_gestion_key (OID = 8350588) : 
--
ALTER TABLE ONLY academico.dct_asignaciones
    ADD CONSTRAINT dct_asignaciones_id_programa_id_materia_id_grupo_id_gestion_key
    UNIQUE (id_programa, id_materia, id_grupo, id_gestion, id_periodo);
--
-- Definition for index dct_asignaciones_pkey (OID = 8350590) : 
--
ALTER TABLE ONLY academico.dct_asignaciones
    ADD CONSTRAINT dct_asignaciones_pkey
    PRIMARY KEY (id_dct_asignaciones);
--
-- Definition for index devaluacion_pkey (OID = 8350592) : 
--
ALTER TABLE ONLY academico.devaluacion
    ADD CONSTRAINT devaluacion_pkey
    PRIMARY KEY (id);
--
-- Definition for index docentes_email_key (OID = 8350594) : 
--
ALTER TABLE ONLY academico.docentes
    ADD CONSTRAINT docentes_email_key
    UNIQUE (email);
--
-- Definition for index docentes_log_pkey (OID = 8350596) : 
--
ALTER TABLE ONLY academico.docentes_log
    ADD CONSTRAINT docentes_log_pkey
    PRIMARY KEY (id_docente);
--
-- Definition for index docentes_log_usuario_key (OID = 8350598) : 
--
ALTER TABLE ONLY academico.docentes_log
    ADD CONSTRAINT docentes_log_usuario_key
    UNIQUE (usuario);
--
-- Definition for index docentes_pkey (OID = 8350600) : 
--
ALTER TABLE ONLY academico.docentes
    ADD CONSTRAINT docentes_pkey
    PRIMARY KEY (id_docente);
--
-- Definition for index docentes_telefono_per_inique (OID = 8350602) : 
--
ALTER TABLE ONLY academico.docentes
    ADD CONSTRAINT docentes_telefono_per_inique
    UNIQUE (telefono_per);
--
-- Definition for index docentes_tiempo_pkey (OID = 8350604) : 
--
ALTER TABLE ONLY academico.docentes_tiempo
    ADD CONSTRAINT docentes_tiempo_pkey
    PRIMARY KEY (tiempo);
--
-- Definition for index docentes_usuario_key (OID = 8350606) : 
--
ALTER TABLE ONLY academico.docentes
    ADD CONSTRAINT docentes_usuario_key
    UNIQUE (usuario);
--
-- Definition for index evaluacion_pkey (OID = 8350608) : 
--
ALTER TABLE ONLY academico.evaluacion
    ADD CONSTRAINT evaluacion_pkey
    PRIMARY KEY (codse);
--
-- Definition for index id_carrera (OID = 8350610) : 
--
ALTER TABLE ONLY academico.carreras_universidades
    ADD CONSTRAINT id_carrera
    PRIMARY KEY (id_carrera);
--
-- Definition for index metodos_paralelas_pkey (OID = 8350612) : 
--
ALTER TABLE ONLY academico.metodos_paralelas
    ADD CONSTRAINT metodos_paralelas_pkey
    PRIMARY KEY (id);
--
-- Definition for index notas_planilla_id_matricula_key1 (OID = 8350614) : 
--
ALTER TABLE ONLY academico.notas_planilla
    ADD CONSTRAINT notas_planilla_id_matricula_key1
    UNIQUE (id_matricula);
--
-- Definition for index notas_planilla_pkey (OID = 8350616) : 
--
ALTER TABLE ONLY academico.notas_planilla
    ADD CONSTRAINT notas_planilla_pkey
    PRIMARY KEY (id_matricula);
--
-- Definition for index pk_alm_prog (OID = 8350618) : 
--
ALTER TABLE ONLY academico.alm_programaciones
    ADD CONSTRAINT pk_alm_prog
    PRIMARY KEY (id);
--
-- Definition for index pln_materias1_new_pln_materias_ (OID = 8350620) : 
--
ALTER TABLE ONLY academico.pln_materias
    ADD CONSTRAINT pln_materias1_new_pln_materias_
    PRIMARY KEY (id_materia);
--
-- Definition for index pln_materias_parametros_no_repeat (OID = 8350622) : 
--
ALTER TABLE ONLY academico.pln_materias_parametros
    ADD CONSTRAINT pln_materias_parametros_no_repeat
    UNIQUE (id_materia, id_gestion, id_periodo);
--
-- Definition for index pln_materias_parametros_pkey (OID = 8350624) : 
--
ALTER TABLE ONLY academico.pln_materias_parametros
    ADD CONSTRAINT pln_materias_parametros_pkey
    PRIMARY KEY (id);
--
-- Definition for index primary_key_planes_id (OID = 8350626) : 
--
ALTER TABLE ONLY academico.planes
    ADD CONSTRAINT primary_key_planes_id
    PRIMARY KEY (id);
--
-- Definition for index sedes_pkey (OID = 8350632) : 
--
ALTER TABLE ONLY academico.sedes
    ADD CONSTRAINT sedes_pkey
    PRIMARY KEY (id_sede);
--
-- Definition for index sist_deva_carrera_pkey (OID = 8350634) : 
--
ALTER TABLE ONLY academico.sist_deva_carrera
    ADD CONSTRAINT sist_deva_carrera_pkey
    PRIMARY KEY (id);
--
-- Definition for index sist_ev_carrera_pkey (OID = 8350636) : 
--
ALTER TABLE ONLY academico.sist_eva_carrera
    ADD CONSTRAINT sist_ev_carrera_pkey
    PRIMARY KEY (id_programa, codse);
--
-- Definition for index tipo_programacion_pkey (OID = 8350638) : 
--
ALTER TABLE ONLY academico.tipo_programacion
    ADD CONSTRAINT tipo_programacion_pkey
    PRIMARY KEY (id_programa);
--
-- Definition for index universidades_pkey (OID = 8350640) : 
--
ALTER TABLE ONLY academico.universidades
    ADD CONSTRAINT universidades_pkey
    PRIMARY KEY (id_universidad);
--
-- Definition for index graduados_pkey (OID = 8350642) : 
--
SET search_path = actas_graduacion, pg_catalog;
ALTER TABLE ONLY actas_graduacion.graduados
    ADD CONSTRAINT graduados_pkey
    PRIMARY KEY (id);
--
-- Definition for index h_asignar_fecha_pkey (OID = 8350648) : 
--
SET search_path = actas_siagra, pg_catalog;
ALTER TABLE ONLY actas_siagra.h_asignar_fecha
    ADD CONSTRAINT h_asignar_fecha_pkey
    PRIMARY KEY (cod_graduacion);
--
-- Definition for index h_asignar_libro_pkey (OID = 8350650) : 
--
ALTER TABLE ONLY actas_siagra.h_asignar_libro
    ADD CONSTRAINT h_asignar_libro_pkey
    PRIMARY KEY (cod_libro);
--
-- Definition for index h_asignar_lugar_pkey (OID = 8350652) : 
--
ALTER TABLE ONLY actas_siagra.h_asignar_lugar
    ADD CONSTRAINT h_asignar_lugar_pkey
    PRIMARY KEY (cod_lugar);
--
-- Definition for index h_certi_tipo_pkey (OID = 8350654) : 
--
ALTER TABLE ONLY actas_siagra.h_certi_tipo
    ADD CONSTRAINT h_certi_tipo_pkey
    PRIMARY KEY (id_tipo_certi);
--
-- Definition for index h_certicar_acta_pkey (OID = 8350656) : 
--
ALTER TABLE ONLY actas_siagra.h_certificar_acta
    ADD CONSTRAINT h_certicar_acta_pkey
    PRIMARY KEY (nro_certi);
--
-- Definition for index h_crear_acta_alumno_pkey (OID = 8350658) : 
--
ALTER TABLE ONLY actas_siagra.h_crear_acta_alumno
    ADD CONSTRAINT h_crear_acta_alumno_pkey
    PRIMARY KEY (nro_registro);
--
-- Definition for index h_crear_acta_cod_graduacion_key (OID = 8350660) : 
--
ALTER TABLE ONLY actas_siagra.h_crear_acta
    ADD CONSTRAINT h_crear_acta_cod_graduacion_key
    UNIQUE (cod_graduacion);
--
-- Definition for index h_crear_acta_pkey (OID = 8350662) : 
--
ALTER TABLE ONLY actas_siagra.h_crear_acta
    ADD CONSTRAINT h_crear_acta_pkey
    PRIMARY KEY (cod_acta);
--
-- Definition for index h_docentes_inv_pkey (OID = 8350664) : 
--
ALTER TABLE ONLY actas_siagra.h_docentes_inv
    ADD CONSTRAINT h_docentes_inv_pkey
    PRIMARY KEY (cod_docente);
--
-- Definition for index h_instituciones_pkey (OID = 8350666) : 
--
ALTER TABLE ONLY actas_siagra.h_instituciones
    ADD CONSTRAINT h_instituciones_pkey
    PRIMARY KEY (cod_insti);
--
-- Definition for index h_lugar_pkey (OID = 8350668) : 
--
ALTER TABLE ONLY actas_siagra.h_lugar
    ADD CONSTRAINT h_lugar_pkey
    PRIMARY KEY (id_lugar);
--
-- Definition for index h_modalidad_ebaluacion_pkey (OID = 8350670) : 
--
ALTER TABLE ONLY actas_siagra.h_modalidad_ebaluacion
    ADD CONSTRAINT h_modalidad_ebaluacion_pkey
    PRIMARY KEY (cod_ebaluacion);
--
-- Definition for index h_modalidad_graduacion_pkey (OID = 8350672) : 
--
ALTER TABLE ONLY actas_siagra.h_modalidad_graduacion
    ADD CONSTRAINT h_modalidad_graduacion_pkey
    PRIMARY KEY (id_modalidad);
--
-- Definition for index h_rol_tribunal_pkey (OID = 8350674) : 
--
ALTER TABLE ONLY actas_siagra.h_rol_tribunal
    ADD CONSTRAINT h_rol_tribunal_pkey
    PRIMARY KEY (id_rol_tribunal);
--
-- Definition for index h_sistema_acta_pkey (OID = 8350676) : 
--
ALTER TABLE ONLY actas_siagra.h_sistema_acta
    ADD CONSTRAINT h_sistema_acta_pkey
    PRIMARY KEY (cod_sistema);
--
-- Definition for index h_solicitud_titulacion_pkey (OID = 8350678) : 
--
ALTER TABLE ONLY actas_siagra.h_solicitud_titulacion
    ADD CONSTRAINT h_solicitud_titulacion_pkey
    PRIMARY KEY (nro_solicitud);
--
-- Definition for index h_titulados_pkey (OID = 8350680) : 
--
ALTER TABLE ONLY actas_siagra.h_titulados
    ADD CONSTRAINT h_titulados_pkey
    PRIMARY KEY (nro_titulado);
--
-- Definition for index dct_ambientes_carrera_pkey (OID = 8350682) : 
--
SET search_path = ambientes, pg_catalog;
ALTER TABLE ONLY ambientes.dct_ambientes_carrera
    ADD CONSTRAINT dct_ambientes_carrera_pkey
    PRIMARY KEY (id_dct_ambientes_carrera);
--
-- Definition for index dct_ambientes_pkey (OID = 8350684) : 
--
ALTER TABLE ONLY ambientes.dct_ambientes
    ADD CONSTRAINT dct_ambientes_pkey
    PRIMARY KEY (id_ambiente);
--
-- Definition for index dct_bloques_pkey (OID = 8350686) : 
--
ALTER TABLE ONLY ambientes.dct_bloques
    ADD CONSTRAINT dct_bloques_pkey
    PRIMARY KEY (id_bloque);
--
-- Definition for index dct_campus_pkey (OID = 8350688) : 
--
ALTER TABLE ONLY ambientes.dct_campus
    ADD CONSTRAINT dct_campus_pkey
    PRIMARY KEY (id_campus);
--
-- Definition for index aux_asignaturas_pkey (OID = 8350690) : 
--
SET search_path = auxiliares, pg_catalog;
ALTER TABLE ONLY auxiliares.aux_asignaturas
    ADD CONSTRAINT aux_asignaturas_pkey
    PRIMARY KEY (id_asignatura);
--
-- Definition for index aux_postulantes_pkey (OID = 8350692) : 
--
ALTER TABLE ONLY auxiliares.aux_postulantes
    ADD CONSTRAINT aux_postulantes_pkey
    PRIMARY KEY (id_postulante);
--
-- Definition for index aux_programas_pkey (OID = 8350694) : 
--
ALTER TABLE ONLY auxiliares.aux_programas
    ADD CONSTRAINT aux_programas_pkey
    PRIMARY KEY (id);
--
-- Definition for index datosparaelbanco_borrar_pkey (OID = 8350696) : 
--
ALTER TABLE ONLY auxiliares.datosparaelbanco_borrar
    ADD CONSTRAINT datosparaelbanco_borrar_pkey
    PRIMARY KEY (id);
--
-- Definition for index datosparaelbanco_pkey (OID = 8350698) : 
--
ALTER TABLE ONLY auxiliares.datosparaelbanco
    ADD CONSTRAINT datosparaelbanco_pkey
    PRIMARY KEY (id);
--
-- Definition for index bc_agenda_pkey (OID = 8350700) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.bc_agenda
    ADD CONSTRAINT bc_agenda_pkey
    PRIMARY KEY (id);
--
-- Definition for index bc_configuracion_pkey (OID = 8350702) : 
--
ALTER TABLE ONLY balimentacion.bc_configuracion
    ADD CONSTRAINT bc_configuracion_pkey
    PRIMARY KEY (id_gestion, id_periodo);
--
-- Definition for index bc_items_becas_pkey (OID = 8350706) : 
--
ALTER TABLE ONLY balimentacion.bc_items_becas
    ADD CONSTRAINT bc_items_becas_pkey
    PRIMARY KEY (id);
--
-- Definition for index bc_meses_pago_id_gestion_nro_mes_tipo_beca_key (OID = 8350708) : 
--
ALTER TABLE ONLY balimentacion.bc_meses_pago
    ADD CONSTRAINT bc_meses_pago_id_gestion_nro_mes_tipo_beca_key
    UNIQUE (id_gestion, nro_mes, tipo_beca);
--
-- Definition for index bc_meses_pago_pkey (OID = 8350710) : 
--
ALTER TABLE ONLY balimentacion.bc_meses_pago
    ADD CONSTRAINT bc_meses_pago_pkey
    PRIMARY KEY (id);
--
-- Definition for index bc_pago_pkey (OID = 8350712) : 
--
ALTER TABLE ONLY balimentacion.bc_pago
    ADD CONSTRAINT bc_pago_pkey
    PRIMARY KEY (id);
--
-- Definition for index bc_planilla_pkey (OID = 8350714) : 
--
ALTER TABLE ONLY balimentacion.bc_planilla
    ADD CONSTRAINT bc_planilla_pkey
    PRIMARY KEY (id);
--
-- Definition for index bc_postulantes_pkey (OID = 8350716) : 
--
ALTER TABLE ONLY balimentacion.bc_postulantes
    ADD CONSTRAINT bc_postulantes_pkey
    PRIMARY KEY (id_alumno, id_gestion, tipo_post);
--
-- Definition for index bc_registro_pago_pkey (OID = 8350718) : 
--
ALTER TABLE ONLY balimentacion.bc_registro_pago
    ADD CONSTRAINT bc_registro_pago_pkey
    PRIMARY KEY (cod_planilla);
--
-- Definition for index bc_situacion_internado_pkey (OID = 8350720) : 
--
ALTER TABLE ONLY balimentacion.bc_situacion_internado
    ADD CONSTRAINT bc_situacion_internado_pkey
    PRIMARY KEY (id_alumno, id_gestion, id_periodo);
--
-- Definition for index bc_suspendidos_pkey (OID = 8350722) : 
--
ALTER TABLE ONLY balimentacion.bc_suspendidos
    ADD CONSTRAINT bc_suspendidos_pkey
    PRIMARY KEY (id_alumno, id_gestion, tipo_post);
--
-- Definition for index borrar_pkey (OID = 8350724) : 
--
ALTER TABLE ONLY balimentacion.borrar
    ADD CONSTRAINT borrar_pkey
    PRIMARY KEY (id);
--
-- Definition for index o_bc_datos_familia_pkey (OID = 8350726) : 
--
ALTER TABLE ONLY balimentacion.o_bc_datos_familia
    ADD CONSTRAINT o_bc_datos_familia_pkey
    PRIMARY KEY (id);
--
-- Definition for index o_bc_familia_id_ra_id_gestion_id_n_key (OID = 8350732) : 
--
ALTER TABLE ONLY balimentacion.o_bc_familia
    ADD CONSTRAINT o_bc_familia_id_ra_id_gestion_id_n_key
    UNIQUE (id_ra, id_gestion, id_n);
--
-- Definition for index o_bc_familia_pkey (OID = 8350734) : 
--
ALTER TABLE ONLY balimentacion.o_bc_familia
    ADD CONSTRAINT o_bc_familia_pkey
    PRIMARY KEY (id);
--
-- Definition for index o_bc_gestion_pkey (OID = 8350736) : 
--
ALTER TABLE ONLY balimentacion.o_bc_gestion
    ADD CONSTRAINT o_bc_gestion_pkey
    PRIMARY KEY (periodo, id_gestion);
--
-- Definition for index o_bc_ingreso_new_pkey (OID = 8350738) : 
--
ALTER TABLE ONLY balimentacion.o_bc_ingreso
    ADD CONSTRAINT o_bc_ingreso_new_pkey
    PRIMARY KEY (id_ra, id_gestion, beca);
--
-- Definition for index o_bc_persona_id_ra_key (OID = 8350740) : 
--
ALTER TABLE ONLY balimentacion.o_bc_persona
    ADD CONSTRAINT o_bc_persona_id_ra_key
    UNIQUE (id_ra);
--
-- Definition for index o_bc_persona_pkey (OID = 8350742) : 
--
ALTER TABLE ONLY balimentacion.o_bc_persona
    ADD CONSTRAINT o_bc_persona_pkey
    PRIMARY KEY (id_ra);
--
-- Definition for index o_bc_puntaje_economico_java_pkey (OID = 8350744) : 
--
ALTER TABLE ONLY balimentacion.o_bc_puntaje_economico
    ADD CONSTRAINT o_bc_puntaje_economico_java_pkey
    PRIMARY KEY (id_p_eco);
--
-- Definition for index o_bc_puntaje_familiar_java_pkey (OID = 8350746) : 
--
ALTER TABLE ONLY balimentacion.o_bc_puntaje_familiar
    ADD CONSTRAINT o_bc_puntaje_familiar_java_pkey
    PRIMARY KEY (id_p_fam);
--
-- Definition for index o_bc_puntaje_procedencia_java_pkey (OID = 8350748) : 
--
ALTER TABLE ONLY balimentacion.o_bc_puntaje_procedencia
    ADD CONSTRAINT o_bc_puntaje_procedencia_java_pkey
    PRIMARY KEY (id_p_pro);
--
-- Definition for index o_bc_puntaje_vivienda_estudiante_java_pkey (OID = 8350750) : 
--
ALTER TABLE ONLY balimentacion.o_bc_puntaje_vivienda_estudiante
    ADD CONSTRAINT o_bc_puntaje_vivienda_estudiante_java_pkey
    PRIMARY KEY (id_p_viv_e);
--
-- Definition for index o_bc_puntaje_vivienda_familiar_java_pkey (OID = 8350752) : 
--
ALTER TABLE ONLY balimentacion.o_bc_puntaje_vivienda_familiar
    ADD CONSTRAINT o_bc_puntaje_vivienda_familiar_java_pkey
    PRIMARY KEY (id_p_viv_f);
--
-- Definition for index o_bc_revisado_pkey (OID = 8350754) : 
--
ALTER TABLE ONLY balimentacion.o_bc_revisado
    ADD CONSTRAINT o_bc_revisado_pkey
    PRIMARY KEY (id_ra, id_usuario, beca, id_gestion);
--
-- Definition for index bg_items_becas_pkey (OID = 8350756) : 
--
SET search_path = bgraduacion, pg_catalog;
ALTER TABLE ONLY bgraduacion.bg_programas
    ADD CONSTRAINT bg_items_becas_pkey
    PRIMARY KEY (id);
--
-- Definition for index bg_meses_pago_pkey (OID = 8350758) : 
--
ALTER TABLE ONLY bgraduacion.bg_meses_pago
    ADD CONSTRAINT bg_meses_pago_pkey
    PRIMARY KEY (id);
--
-- Definition for index bg_postulantes_pkey (OID = 8350760) : 
--
ALTER TABLE ONLY bgraduacion.bg_postulantes
    ADD CONSTRAINT bg_postulantes_pkey
    PRIMARY KEY (id);
--
-- Definition for index editorial_pkey (OID = 8350762) : 
--
SET search_path = biblioteca, pg_catalog;
ALTER TABLE ONLY biblioteca.editorial
    ADD CONSTRAINT editorial_pkey
    PRIMARY KEY (id_editorial);
--
-- Definition for index lector_ci_lector_key (OID = 8350764) : 
--
ALTER TABLE ONLY biblioteca.lector
    ADD CONSTRAINT lector_ci_lector_key
    UNIQUE (ci_lector);
--
-- Definition for index lector_pkey (OID = 8350766) : 
--
ALTER TABLE ONLY biblioteca.lector
    ADD CONSTRAINT lector_pkey
    PRIMARY KEY (id_lector);
--
-- Definition for index llibro_pkey (OID = 8350768) : 
--
ALTER TABLE ONLY biblioteca.libro
    ADD CONSTRAINT llibro_pkey
    PRIMARY KEY ("Id_libro");
--
-- Definition for index lugar_edicion_pkey (OID = 8350770) : 
--
ALTER TABLE ONLY biblioteca.lugar_edicion
    ADD CONSTRAINT lugar_edicion_pkey
    PRIMARY KEY (id_lugar);
--
-- Definition for index prestamo_devolucion_pkey (OID = 8350772) : 
--
ALTER TABLE ONLY biblioteca.prestamo_devolucion
    ADD CONSTRAINT prestamo_devolucion_pkey
    PRIMARY KEY (id_prestamo);
--
-- Definition for index reservas_pkey (OID = 8350774) : 
--
ALTER TABLE ONLY biblioteca.reservas
    ADD CONSTRAINT reservas_pkey
    PRIMARY KEY (id_reserva);
--
-- Definition for index sancionados_pkey (OID = 8350776) : 
--
ALTER TABLE ONLY biblioteca.sancionados
    ADD CONSTRAINT sancionados_pkey
    PRIMARY KEY (id_sancion);
--
-- Definition for index beca_investigador_pkey (OID = 8350778) : 
--
SET search_path = binvestigacion, pg_catalog;
ALTER TABLE ONLY binvestigacion.beca_investigador
    ADD CONSTRAINT beca_investigador_pkey
    PRIMARY KEY (id);
--
-- Definition for index becas_por_carrera_pkey (OID = 8350780) : 
--
ALTER TABLE ONLY binvestigacion.becas_por_carrera
    ADD CONSTRAINT becas_por_carrera_pkey
    PRIMARY KEY (id);
--
-- Definition for index cronograma_pkey (OID = 8350782) : 
--
ALTER TABLE ONLY binvestigacion.cronograma
    ADD CONSTRAINT cronograma_pkey
    PRIMARY KEY (id);
--
-- Definition for index beca_trabajo_pkey (OID = 8350784) : 
--
SET search_path = btrabajo, pg_catalog;
ALTER TABLE ONLY btrabajo.beca_trabajo
    ADD CONSTRAINT beca_trabajo_pkey
    PRIMARY KEY (id);
--
-- Definition for index becasprograma_pkey (OID = 8350786) : 
--
ALTER TABLE ONLY btrabajo.becasprograma
    ADD CONSTRAINT becasprograma_pkey
    PRIMARY KEY (id);
--
-- Definition for index requisitos_pkey (OID = 8350788) : 
--
ALTER TABLE ONLY btrabajo.requisitos
    ADD CONSTRAINT requisitos_pkey
    PRIMARY KEY (id);
--
-- Definition for index alumnos_materias_lista_pkey (OID = 8350790) : 
--
SET search_path = consola, pg_catalog;
ALTER TABLE ONLY consola.alumnos_materias_lista
    ADD CONSTRAINT alumnos_materias_lista_pkey
    PRIMARY KEY (id);
--
-- Definition for index alumnos_materias_pkey (OID = 8350792) : 
--
ALTER TABLE ONLY consola.alumnos_materias
    ADD CONSTRAINT alumnos_materias_pkey
    PRIMARY KEY (id);
--
-- Definition for index consola_docente_login (OID = 8350794) : 
--
ALTER TABLE ONLY consola.docente_login
    ADD CONSTRAINT consola_docente_login
    PRIMARY KEY (id);
--
-- Definition for index estudiante_login_pkey (OID = 8350796) : 
--
ALTER TABLE ONLY consola.estudiante_login
    ADD CONSTRAINT estudiante_login_pkey
    PRIMARY KEY (id);
--
-- Definition for index convenios_pkey (OID = 8350801) : 
--
SET search_path = convocatorias, pg_catalog;
ALTER TABLE ONLY convocatorias.convenios
    ADD CONSTRAINT convenios_pkey
    PRIMARY KEY (id);
--
-- Definition for index convocatoria_pkey (OID = 8350803) : 
--
ALTER TABLE ONLY convocatorias.convocatoria
    ADD CONSTRAINT convocatoria_pkey
    PRIMARY KEY (id);
--
-- Definition for index convocatoriasicoes_pkey (OID = 8350805) : 
--
ALTER TABLE ONLY convocatorias.convocatoriasicoes
    ADD CONSTRAINT convocatoriasicoes_pkey
    PRIMARY KEY (id);
--
-- Definition for index categoria_pkey (OID = 8350807) : 
--
SET search_path = curriculum, pg_catalog;
ALTER TABLE ONLY curriculum.categoria
    ADD CONSTRAINT categoria_pkey
    PRIMARY KEY (id);
--
-- Definition for index columna_pkey (OID = 8350809) : 
--
ALTER TABLE ONLY curriculum.columna
    ADD CONSTRAINT columna_pkey
    PRIMARY KEY (id);
--
-- Definition for index valores_pkey (OID = 8350811) : 
--
ALTER TABLE ONLY curriculum.valores
    ADD CONSTRAINT valores_pkey
    PRIMARY KEY (id);
--
-- Definition for index borrar_pkey (OID = 8350813) : 
--
SET search_path = dep_titulos, pg_catalog;
ALTER TABLE ONLY dep_titulos.borrar
    ADD CONSTRAINT borrar_pkey
    PRIMARY KEY (id);
--
-- Definition for index clasiftra_pkey (OID = 8350815) : 
--
ALTER TABLE ONLY dep_titulos.clasiftra
    ADD CONSTRAINT clasiftra_pkey
    PRIMARY KEY (id);
--
-- Definition for index tit_tramite_pkey (OID = 8350817) : 
--
ALTER TABLE ONLY dep_titulos.tit_tramite
    ADD CONSTRAINT tit_tramite_pkey
    PRIMARY KEY (id);
--
-- Definition for index diu_impresion_id_solicitud_key (OID = 8350819) : 
--
SET search_path = diu, pg_catalog;
ALTER TABLE ONLY diu.diu_impresion
    ADD CONSTRAINT diu_impresion_id_solicitud_key
    UNIQUE (id_solicitud);
--
-- Definition for index diu_impresion_pkey (OID = 8350821) : 
--
ALTER TABLE ONLY diu.diu_impresion
    ADD CONSTRAINT diu_impresion_pkey
    PRIMARY KEY (id);
--
-- Definition for index diu_solicitud_pkey (OID = 8350823) : 
--
ALTER TABLE ONLY diu.diu_solicitud
    ADD CONSTRAINT diu_solicitud_pkey
    PRIMARY KEY (id_solicitud);
--
-- Definition for index diu_tipo_solicitud_pkey (OID = 8350825) : 
--
ALTER TABLE ONLY diu.diu_tipo_solicitud
    ADD CONSTRAINT diu_tipo_solicitud_pkey
    PRIMARY KEY (id_tipo_solicitud);
--
-- Definition for index _candidatos_pkey (OID = 8350827) : 
--
SET search_path = elecciones, pg_catalog;
ALTER TABLE ONLY elecciones._candidatos
    ADD CONSTRAINT _candidatos_pkey
    PRIMARY KEY (id_candidato);
--
-- Definition for index _elcciones_votos_rector_pkey (OID = 8350829) : 
--
ALTER TABLE ONLY elecciones._elcciones_votos_rector
    ADD CONSTRAINT _elcciones_votos_rector_pkey
    PRIMARY KEY (num_mesa);
--
-- Definition for index _elecciones_designacion_pkey (OID = 8350831) : 
--
ALTER TABLE ONLY elecciones._elecciones_designacion
    ADD CONSTRAINT _elecciones_designacion_pkey
    PRIMARY KEY (id_designacion);
--
-- Definition for index _elecciones_pkey (OID = 8350833) : 
--
ALTER TABLE ONLY elecciones._elecciones
    ADD CONSTRAINT _elecciones_pkey
    PRIMARY KEY (id);
--
-- Definition for index _elecciones_votos_pkey (OID = 8350835) : 
--
ALTER TABLE ONLY elecciones._elecciones_votos
    ADD CONSTRAINT _elecciones_votos_pkey
    PRIMARY KEY (id_votos);
--
-- Definition for index _elecciones_votos_vice_pkey (OID = 8350837) : 
--
ALTER TABLE ONLY elecciones._elecciones_votos_vice
    ADD CONSTRAINT _elecciones_votos_vice_pkey
    PRIMARY KEY (num_mesa);
--
-- Definition for index _elecciones_votos_vice_pri_pkey (OID = 8350839) : 
--
ALTER TABLE ONLY elecciones._elecciones_votos_vice_pri
    ADD CONSTRAINT _elecciones_votos_vice_pri_pkey
    PRIMARY KEY (num_mesa);
--
-- Definition for index _elecciones_votos_vice_sv_pkey (OID = 8350841) : 
--
ALTER TABLE ONLY elecciones._elecciones_votos_vice_sv
    ADD CONSTRAINT _elecciones_votos_vice_sv_pkey
    PRIMARY KEY (num_mesa);
--
-- Definition for index _mesas_pkey (OID = 8350843) : 
--
ALTER TABLE ONLY elecciones._mesas
    ADD CONSTRAINT _mesas_pkey
    PRIMARY KEY (id);
--
-- Definition for index antiguedadesborrador_pkey (OID = 8350847) : 
--
ALTER TABLE ONLY elecciones.antiguedadesborrador
    ADD CONSTRAINT antiguedadesborrador_pkey
    PRIMARY KEY (id);
--
-- Definition for index auxiliaresborrador2_pkey (OID = 8350849) : 
--
ALTER TABLE ONLY elecciones.auxiliaresborrador2
    ADD CONSTRAINT auxiliaresborrador2_pkey
    PRIMARY KEY (id);
--
-- Definition for index auxiliaresborrador_pkey (OID = 8350851) : 
--
ALTER TABLE ONLY elecciones.auxiliaresborrador
    ADD CONSTRAINT auxiliaresborrador_pkey
    PRIMARY KEY (id);
--
-- Definition for index cargos_pkey (OID = 8350853) : 
--
ALTER TABLE ONLY elecciones.cargos
    ADD CONSTRAINT cargos_pkey
    PRIMARY KEY (id);
--
-- Definition for index id_mesa (OID = 8350855) : 
--
ALTER TABLE ONLY elecciones.mesas
    ADD CONSTRAINT id_mesa
    PRIMARY KEY (nro_mesa);
--
-- Definition for index id_pkey (OID = 8350857) : 
--
ALTER TABLE ONLY elecciones._posible_jurado
    ADD CONSTRAINT id_pkey
    PRIMARY KEY (id);
--
-- Definition for index juradosborrador2_pkey (OID = 8350859) : 
--
ALTER TABLE ONLY elecciones.juradosborrador2
    ADD CONSTRAINT juradosborrador2_pkey
    PRIMARY KEY (id);
--
-- Definition for index juradosborrador_pkey (OID = 8350861) : 
--
ALTER TABLE ONLY elecciones.juradosborrador
    ADD CONSTRAINT juradosborrador_pkey
    PRIMARY KEY (id);
--
-- Definition for index tmpElecciones_pkey (OID = 8350863) : 
--
ALTER TABLE ONLY elecciones._elecciones_old
    ADD CONSTRAINT "tmpElecciones_pkey"
    PRIMARY KEY (id_frente);
--
-- Definition for index votantes_id_ra_key (OID = 8350865) : 
--
ALTER TABLE ONLY elecciones.votantes_17
    ADD CONSTRAINT votantes_id_ra_key
    UNIQUE (id_ra);
--
-- Definition for index votantes_id_ra_key1 (OID = 8350867) : 
--
ALTER TABLE ONLY elecciones.votantes
    ADD CONSTRAINT votantes_id_ra_key1
    UNIQUE (id_ra);
--
-- Definition for index votantes_nro_dip_key (OID = 8350869) : 
--
ALTER TABLE ONLY elecciones.votantes_17
    ADD CONSTRAINT votantes_nro_dip_key
    UNIQUE (nro_dip);
--
-- Definition for index votantes_nro_dip_key1 (OID = 8350871) : 
--
ALTER TABLE ONLY elecciones.votantes
    ADD CONSTRAINT votantes_nro_dip_key1
    UNIQUE (nro_dip);
--
-- Definition for index votantes_pkey (OID = 8350873) : 
--
ALTER TABLE ONLY elecciones.votantes_17
    ADD CONSTRAINT votantes_pkey
    PRIMARY KEY (id);
--
-- Definition for index votantes_pkey1 (OID = 8350875) : 
--
ALTER TABLE ONLY elecciones.votantes
    ADD CONSTRAINT votantes_pkey1
    PRIMARY KEY (id);
--
-- Definition for index votantesdocentes_pkey (OID = 8350877) : 
--
ALTER TABLE ONLY elecciones.votantesdocentes
    ADD CONSTRAINT votantesdocentes_pkey
    PRIMARY KEY (nro_dip);
--
-- Definition for index votantesmesas_pkey (OID = 8350879) : 
--
ALTER TABLE ONLY elecciones.votantesmesas
    ADD CONSTRAINT votantesmesas_pkey
    PRIMARY KEY (id);
--
-- Definition for index _diciplinas_pkey (OID = 8350881) : 
--
SET search_path = extension, pg_catalog;
ALTER TABLE ONLY extension._diciplinas
    ADD CONSTRAINT _diciplinas_pkey
    PRIMARY KEY (id);
--
-- Definition for index _participantes_pkey (OID = 8350883) : 
--
ALTER TABLE ONLY extension._participantes
    ADD CONSTRAINT _participantes_pkey
    PRIMARY KEY (id);
--
-- Definition for index _links_pkey (OID = 8350885) : 
--
SET search_path = frida, pg_catalog;
ALTER TABLE ONLY frida._links
    ADD CONSTRAINT _links_pkey
    PRIMARY KEY (corr0);
--
-- Definition for index _menus_new_pkey (OID = 8350887) : 
--
ALTER TABLE ONLY frida._menus_new
    ADD CONSTRAINT _menus_new_pkey
    PRIMARY KEY (corr0);
--
-- Definition for index _menus_pkey (OID = 8350889) : 
--
ALTER TABLE ONLY frida._menus
    ADD CONSTRAINT _menus_pkey
    PRIMARY KEY (corr0);
--
-- Definition for index _usuarios_id_usuario_key (OID = 8350891) : 
--
ALTER TABLE ONLY frida._usuarios
    ADD CONSTRAINT _usuarios_id_usuario_key
    UNIQUE (id_usuario);
--
-- Definition for index _usuarios_pkey1 (OID = 8350893) : 
--
ALTER TABLE ONLY frida._usuarios
    ADD CONSTRAINT _usuarios_pkey1
    PRIMARY KEY (id);
--
-- Definition for index permisos_pkey (OID = 8350895) : 
--
ALTER TABLE ONLY frida.permisos
    ADD CONSTRAINT permisos_pkey
    PRIMARY KEY (id_menu);
--
-- Definition for index seguro2014_borrar_pkey (OID = 8350897) : 
--
SET search_path = herramientas, pg_catalog;
ALTER TABLE ONLY herramientas.seguro2014_borrar
    ADD CONSTRAINT seguro2014_borrar_pkey
    PRIMARY KEY (id);
--
-- Definition for index alumnos_via_pkey (OID = 8350899) : 
--
SET search_path = infraestructura, pg_catalog;
ALTER TABLE ONLY infraestructura.alumnos_via
    ADD CONSTRAINT alumnos_via_pkey
    PRIMARY KEY (id_a);
--
-- Definition for index asig_auto_chofer_pkey (OID = 8350901) : 
--
ALTER TABLE ONLY infraestructura.asig_auto_chofer
    ADD CONSTRAINT asig_auto_chofer_pkey
    PRIMARY KEY (id_asig_ac);
--
-- Definition for index asig_viaje_auto_pkey (OID = 8350903) : 
--
ALTER TABLE ONLY infraestructura.asig_viaje_auto
    ADD CONSTRAINT asig_viaje_auto_pkey
    PRIMARY KEY (id_asig_va);
--
-- Definition for index chofer_pkey (OID = 8350905) : 
--
ALTER TABLE ONLY infraestructura.chofer
    ADD CONSTRAINT chofer_pkey
    PRIMARY KEY (id_chofer);
--
-- Definition for index cronograma_pkey (OID = 8350907) : 
--
ALTER TABLE ONLY infraestructura.cronograma
    ADD CONSTRAINT cronograma_pkey
    PRIMARY KEY (id_c);
--
-- Definition for index movilidad_pkey (OID = 8350909) : 
--
ALTER TABLE ONLY infraestructura.movilidad
    ADD CONSTRAINT movilidad_pkey
    PRIMARY KEY (id_movil);
--
-- Definition for index pasajero_extra_pkey (OID = 8350911) : 
--
ALTER TABLE ONLY infraestructura.pasajero_extra
    ADD CONSTRAINT pasajero_extra_pkey
    PRIMARY KEY (id_extra);
--
-- Definition for index salida_vehiculas_pkey (OID = 8350913) : 
--
ALTER TABLE ONLY infraestructura.salida_vehiculos
    ADD CONSTRAINT salida_vehiculas_pkey
    PRIMARY KEY (id_salida);
--
-- Definition for index viajes_pkey (OID = 8350915) : 
--
ALTER TABLE ONLY infraestructura.viajes
    ADD CONSTRAINT viajes_pkey
    PRIMARY KEY (id_viaje);
--
-- Definition for index caracteristicas_pkey (OID = 8350917) : 
--
SET search_path = laptopsdocentes, pg_catalog;
ALTER TABLE ONLY laptopsdocentes.caracteristicas
    ADD CONSTRAINT caracteristicas_pkey
    PRIMARY KEY (id_caracteristica);
--
-- Definition for index categorias_pkey (OID = 8350919) : 
--
ALTER TABLE ONLY laptopsdocentes.categorias
    ADD CONSTRAINT categorias_pkey
    PRIMARY KEY (id_categoria);
--
-- Definition for index seriales_pkey (OID = 8350921) : 
--
ALTER TABLE ONLY laptopsdocentes.seriales
    ADD CONSTRAINT seriales_pkey
    PRIMARY KEY (id_serial);
--
-- Definition for index docente_cambios_pkey (OID = 8350923) : 
--
SET search_path = log, pg_catalog;
ALTER TABLE ONLY log.docente_cambios
    ADD CONSTRAINT docente_cambios_pkey
    PRIMARY KEY (id);
--
-- Definition for index error_certificados_pkey (OID = 8350925) : 
--
ALTER TABLE ONLY log.error_certificados
    ADD CONSTRAINT error_certificados_pkey
    PRIMARY KEY (id);
--
-- Definition for index log_tablas_modificaciones_pkey (OID = 8350927) : 
--
ALTER TABLE ONLY log.log_tablas_modificaciones
    ADD CONSTRAINT log_tablas_modificaciones_pkey
    PRIMARY KEY (id);
--
-- Definition for index log_tablas_pkey (OID = 8350934) : 
--
ALTER TABLE ONLY log.log_tablas
    ADD CONSTRAINT log_tablas_pkey
    PRIMARY KEY (id);
--
-- Definition for index nxt_log_recuperar_clave_pkey (OID = 8350936) : 
--
ALTER TABLE ONLY log.nxt_log_recuperar_clave
    ADD CONSTRAINT nxt_log_recuperar_clave_pkey
    PRIMARY KEY (id);
--
-- Definition for index uatf_datos_log_pkey (OID = 8350938) : 
--
ALTER TABLE ONLY log.uatf_datos_log
    ADD CONSTRAINT uatf_datos_log_pkey
    PRIMARY KEY (id);
--
-- Definition for index equipo_red_pkey (OID = 8350940) : 
--
SET search_path = net_uatf, pg_catalog;
ALTER TABLE ONLY net_uatf.equipos_red
    ADD CONSTRAINT equipo_red_pkey
    PRIMARY KEY (id_equipo);
--
-- Definition for index red_pkey (OID = 8350942) : 
--
ALTER TABLE ONLY net_uatf.red
    ADD CONSTRAINT red_pkey
    PRIMARY KEY (id_red);
--
-- Definition for index tipo_equipo_pkey (OID = 8350944) : 
--
ALTER TABLE ONLY net_uatf.tipo_equipo
    ADD CONSTRAINT tipo_equipo_pkey
    PRIMARY KEY (id_tipo_equipo);
--
-- Definition for index unidad_pkey (OID = 8350946) : 
--
ALTER TABLE ONLY net_uatf.unidades
    ADD CONSTRAINT unidad_pkey
    PRIMARY KEY (id_unidad);
--
-- Definition for index borrar_pkey (OID = 8350948) : 
--
SET search_path = personal, pg_catalog;
ALTER TABLE ONLY personal.borrar_migrar
    ADD CONSTRAINT borrar_pkey
    PRIMARY KEY (id);
--
-- Definition for index categorias_programaticas_pkey (OID = 8350950) : 
--
ALTER TABLE ONLY personal.categorias_programaticas
    ADD CONSTRAINT categorias_programaticas_pkey
    PRIMARY KEY (id);
--
-- Definition for index categorias_programaticas_programas_pkey (OID = 8350952) : 
--
ALTER TABLE ONLY personal.categorias_programaticas_programas
    ADD CONSTRAINT categorias_programaticas_programas_pkey
    PRIMARY KEY (id);
--
-- Definition for index designacion_beca_excelencia_pkey (OID = 8350954) : 
--
ALTER TABLE ONLY personal.designacion_beca_excelencia
    ADD CONSTRAINT designacion_beca_excelencia_pkey
    PRIMARY KEY (id);
--
-- Definition for index parametros_beca_excelencia_pkey (OID = 8350956) : 
--
ALTER TABLE ONLY personal.parametros_beca_excelencia
    ADD CONSTRAINT parametros_beca_excelencia_pkey
    PRIMARY KEY (id);
--
-- Definition for index pss_areas_pkey (OID = 8350958) : 
--
ALTER TABLE ONLY personal.pss_areas
    ADD CONSTRAINT pss_areas_pkey
    PRIMARY KEY (id_area);
--
-- Definition for index pss_cargos_pkey (OID = 8350960) : 
--
ALTER TABLE ONLY personal.pss_cargos
    ADD CONSTRAINT pss_cargos_pkey
    PRIMARY KEY (id_cargo);
--
-- Definition for index pss_categorias_pkey (OID = 8350962) : 
--
ALTER TABLE ONLY personal.pss_categorias
    ADD CONSTRAINT pss_categorias_pkey
    PRIMARY KEY (id_categoria);
--
-- Definition for index pss_items_asignaciones_pkey (OID = 8350964) : 
--
ALTER TABLE ONLY personal.pss_items_asignaciones
    ADD CONSTRAINT pss_items_asignaciones_pkey
    PRIMARY KEY (id_item_asignacion);
--
-- Definition for index pss_items_funciones_pkey (OID = 8350966) : 
--
ALTER TABLE ONLY personal.pss_items_funciones
    ADD CONSTRAINT pss_items_funciones_pkey
    PRIMARY KEY (id_item_funcion);
--
-- Definition for index pss_items_pkey (OID = 8350968) : 
--
ALTER TABLE ONLY personal.pss_items
    ADD CONSTRAINT pss_items_pkey
    PRIMARY KEY (id_item);
--
-- Definition for index pentaho_pkey (OID = 8350973) : 
--
SET search_path = postgrado, pg_catalog;
ALTER TABLE ONLY postgrado.pentaho
    ADD CONSTRAINT pentaho_pkey
    PRIMARY KEY (id);
--
-- Definition for index universidades_pkey (OID = 8350975) : 
--
ALTER TABLE ONLY postgrado.universidades
    ADD CONSTRAINT universidades_pkey
    PRIMARY KEY (id);
--
-- Definition for index _apoderado_id_persona_key (OID = 8350977) : 
--
SET search_path = postulantes, pg_catalog;
ALTER TABLE ONLY postulantes._apoderado
    ADD CONSTRAINT _apoderado_id_persona_key
    UNIQUE (id_persona);
--
-- Definition for index _apoderado_pkey (OID = 8350979) : 
--
ALTER TABLE ONLY postulantes._apoderado
    ADD CONSTRAINT _apoderado_pkey
    PRIMARY KEY (id_apoderado);
--
-- Definition for index _postulaciones_pkey (OID = 8350981) : 
--
ALTER TABLE ONLY postulantes._postulaciones
    ADD CONSTRAINT _postulaciones_pkey
    PRIMARY KEY (id);
--
-- Definition for index _postulantes__ci_key (OID = 8350983) : 
--
ALTER TABLE ONLY postulantes._postulantes
    ADD CONSTRAINT _postulantes__ci_key
    UNIQUE (_ci);
--
-- Definition for index _postulantes_pkey (OID = 8350985) : 
--
ALTER TABLE ONLY postulantes._postulantes
    ADD CONSTRAINT _postulantes_pkey
    PRIMARY KEY (id);
--
-- Definition for index borrar_ggg_pkey (OID = 8350987) : 
--
ALTER TABLE ONLY postulantes.borrar_ggg
    ADD CONSTRAINT borrar_ggg_pkey
    PRIMARY KEY (id);
--
-- Definition for index personas_pkey (OID = 8350989) : 
--
ALTER TABLE ONLY postulantes.personas
    ADD CONSTRAINT personas_pkey
    PRIMARY KEY (id_persona);
--
-- Definition for index postulante_pkey (OID = 8350991) : 
--
ALTER TABLE ONLY postulantes.postulante
    ADD CONSTRAINT postulante_pkey
    PRIMARY KEY (id_persona);
--
-- Definition for index _o_usuarios_pkey (OID = 8351123) : 
--
SET search_path = recycler, pg_catalog;
ALTER TABLE ONLY recycler._o_usuarios
    ADD CONSTRAINT _o_usuarios_pkey
    PRIMARY KEY (ci);
--
-- Definition for index _tbl_sugerencias_pkey (OID = 8351125) : 
--
ALTER TABLE ONLY recycler._tbl_sugerencias
    ADD CONSTRAINT _tbl_sugerencias_pkey
    PRIMARY KEY (id_sugerencia);
--
-- Definition for index _tbl_tipo_avisos_pkey (OID = 8351127) : 
--
ALTER TABLE ONLY recycler._tbl_tipo_avisos
    ADD CONSTRAINT _tbl_tipo_avisos_pkey
    PRIMARY KEY (id_tipo_aviso);
--
-- Definition for index _tbl_tipo_tableros_pkey (OID = 8351129) : 
--
ALTER TABLE ONLY recycler._tbl_tipo_tableros
    ADD CONSTRAINT _tbl_tipo_tableros_pkey
    PRIMARY KEY (id_tipo_tablero);
--
-- Definition for index _usuarios_pkey (OID = 8351131) : 
--
ALTER TABLE ONLY recycler._usuarios_borrar
    ADD CONSTRAINT _usuarios_pkey
    PRIMARY KEY (id_usuario);
--
-- Definition for index a (OID = 8351133) : 
--
ALTER TABLE ONLY recycler.actualizacion_postulantes
    ADD CONSTRAINT a
    PRIMARY KEY (id);
--
-- Definition for index aleatorio (OID = 8351135) : 
--
ALTER TABLE ONLY recycler.nro_aleatorio
    ADD CONSTRAINT aleatorio
    PRIMARY KEY (id_aleatorio);
--
-- Definition for index alm_deudas_pkey (OID = 8351137) : 
--
ALTER TABLE ONLY recycler.alm_deudas
    ADD CONSTRAINT alm_deudas_pkey
    PRIMARY KEY (id_alumno, corr0);
--
-- Definition for index aud_link_archivos_pkey (OID = 8351139) : 
--
ALTER TABLE ONLY recycler.aud_link_archivos
    ADD CONSTRAINT aud_link_archivos_pkey
    PRIMARY KEY (id_archivo);
--
-- Definition for index aud_tipo_doc_pkey (OID = 8351141) : 
--
ALTER TABLE ONLY recycler.aud_tipo_doc
    ADD CONSTRAINT aud_tipo_doc_pkey
    PRIMARY KEY (id_tipo_doc);
--
-- Definition for index becarios2014_pkey (OID = 8351143) : 
--
ALTER TABLE ONLY recycler.becarios2014
    ADD CONSTRAINT becarios2014_pkey
    PRIMARY KEY (id);
--
-- Definition for index bloqueado_pkey (OID = 8351145) : 
--
ALTER TABLE ONLY recycler.alumnos_bloqueados
    ADD CONSTRAINT bloqueado_pkey
    PRIMARY KEY (id_bloqueado);
--
-- Definition for index borrador_pkey (OID = 8351147) : 
--
ALTER TABLE ONLY recycler.borrador
    ADD CONSTRAINT borrador_pkey
    PRIMARY KEY (numero);
--
-- Definition for index bv_encuadernacion_pkey (OID = 8351155) : 
--
ALTER TABLE ONLY recycler.bv_encuadernacion
    ADD CONSTRAINT bv_encuadernacion_pkey
    PRIMARY KEY (id_encuadernacion);
--
-- Definition for index bv_libro_pkey (OID = 8351157) : 
--
ALTER TABLE ONLY recycler.bv_libro
    ADD CONSTRAINT bv_libro_pkey
    PRIMARY KEY (id_libro);
--
-- Definition for index bv_procedencia_pkey (OID = 8351159) : 
--
ALTER TABLE ONLY recycler.bv_procedencia
    ADD CONSTRAINT bv_procedencia_pkey
    PRIMARY KEY (id_procedencia);
--
-- Definition for index bv_ubicacion_pkey (OID = 8351161) : 
--
ALTER TABLE ONLY recycler.bv_ubicacion
    ADD CONSTRAINT bv_ubicacion_pkey
    PRIMARY KEY (id_ubicacion);
--
-- Definition for index codigos_titulados_pkey (OID = 8351163) : 
--
ALTER TABLE ONLY recycler.h_codigos_titulados
    ADD CONSTRAINT codigos_titulados_pkey
    PRIMARY KEY (nro_titulado);
--
-- Definition for index g_actualiza_e_pkey (OID = 8351165) : 
--
ALTER TABLE ONLY recycler.g_actualiza_e
    ADD CONSTRAINT g_actualiza_e_pkey
    PRIMARY KEY (id);
--
-- Definition for index g_calendario_pkey (OID = 8351167) : 
--
ALTER TABLE ONLY recycler.g_calendario
    ADD CONSTRAINT g_calendario_pkey
    PRIMARY KEY (id);
--
-- Definition for index g_documentos_pkey (OID = 8351169) : 
--
ALTER TABLE ONLY recycler.g_documentos
    ADD CONSTRAINT g_documentos_pkey
    PRIMARY KEY (id_doc);
--
-- Definition for index g_eventos_pkey (OID = 8351171) : 
--
ALTER TABLE ONLY recycler.g_eventos
    ADD CONSTRAINT g_eventos_pkey
    PRIMARY KEY (id_evento);
--
-- Definition for index g_examenes_pkey (OID = 8351173) : 
--
ALTER TABLE ONLY recycler.g_examenes
    ADD CONSTRAINT g_examenes_pkey
    PRIMARY KEY (id);
--
-- Definition for index g_mi_carrera_pkey (OID = 8351175) : 
--
ALTER TABLE ONLY recycler.g_mi_carrera
    ADD CONSTRAINT g_mi_carrera_pkey
    PRIMARY KEY (id_carrera);
--
-- Definition for index g_noticias_pkey (OID = 8351177) : 
--
ALTER TABLE ONLY recycler.g_noticias
    ADD CONSTRAINT g_noticias_pkey
    PRIMARY KEY (id);
--
-- Definition for index g_paginas_pkey (OID = 8351179) : 
--
ALTER TABLE ONLY recycler.g_paginas
    ADD CONSTRAINT g_paginas_pkey
    PRIMARY KEY (id_pagina);
--
-- Definition for index g_perfiles_pkey (OID = 8351181) : 
--
ALTER TABLE ONLY recycler.g_perfiles
    ADD CONSTRAINT g_perfiles_pkey
    PRIMARY KEY (id_perfil);
--
-- Definition for index g_reporte_pkey (OID = 8351183) : 
--
ALTER TABLE ONLY recycler.g_reporte
    ADD CONSTRAINT g_reporte_pkey
    PRIMARY KEY (id);
--
-- Definition for index guia_telefonica_pkey (OID = 8351185) : 
--
ALTER TABLE ONLY recycler.guia_telefonica
    ADD CONSTRAINT guia_telefonica_pkey
    PRIMARY KEY (id);
--
-- Definition for index h_asignar_fecha_pkey (OID = 8351187) : 
--
ALTER TABLE ONLY recycler.h_asignar_fecha
    ADD CONSTRAINT h_asignar_fecha_pkey
    PRIMARY KEY (cod_graduacion);
--
-- Definition for index h_asignar_folios_libro_pkey (OID = 8351189) : 
--
ALTER TABLE ONLY recycler.h_asignar_folios_libro
    ADD CONSTRAINT h_asignar_folios_libro_pkey
    PRIMARY KEY (cod_registro);
--
-- Definition for index h_asignar_libro_pkey (OID = 8351191) : 
--
ALTER TABLE ONLY recycler.h_asignar_libro
    ADD CONSTRAINT h_asignar_libro_pkey
    PRIMARY KEY (cod_libro);
--
-- Definition for index h_certi_tipo_pkey (OID = 8351193) : 
--
ALTER TABLE ONLY recycler.h_certi_tipo
    ADD CONSTRAINT h_certi_tipo_pkey
    PRIMARY KEY (id_tipo_certi);
--
-- Definition for index h_certicar_acta_pkey (OID = 8351195) : 
--
ALTER TABLE ONLY recycler.h_certificar_acta
    ADD CONSTRAINT h_certicar_acta_pkey
    PRIMARY KEY (nro_certi);
--
-- Definition for index h_crear_acta_alumno_pkey (OID = 8351197) : 
--
ALTER TABLE ONLY recycler.h_crear_acta_alumno
    ADD CONSTRAINT h_crear_acta_alumno_pkey
    PRIMARY KEY (nro_registro);
--
-- Definition for index h_crear_acta_pkey (OID = 8351199) : 
--
ALTER TABLE ONLY recycler.h_crear_acta
    ADD CONSTRAINT h_crear_acta_pkey
    PRIMARY KEY (cod_acta);
--
-- Definition for index h_emitir_proveido_pkey (OID = 8351201) : 
--
ALTER TABLE ONLY recycler.h_emitir_proveido
    ADD CONSTRAINT h_emitir_proveido_pkey
    PRIMARY KEY (nro_proveido);
--
-- Definition for index h_sistema_acta_pkey (OID = 8351203) : 
--
ALTER TABLE ONLY recycler.h_sistema_acta
    ADD CONSTRAINT h_sistema_acta_pkey
    PRIMARY KEY (cod_sistema);
--
-- Definition for index h_solicitud_titulacion_pkey (OID = 8351205) : 
--
ALTER TABLE ONLY recycler.h_solicitud_titulacion
    ADD CONSTRAINT h_solicitud_titulacion_pkey
    PRIMARY KEY (nro_solicitud);
--
-- Definition for index h_titulados_2_pkey (OID = 8351207) : 
--
ALTER TABLE ONLY recycler.h_titulados_2
    ADD CONSTRAINT h_titulados_2_pkey
    PRIMARY KEY (nro_titulado);
--
-- Definition for index key_variable (OID = 8351211) : 
--
ALTER TABLE ONLY recycler.variables_configuracion
    ADD CONSTRAINT key_variable
    PRIMARY KEY (id_variable);
--
-- Definition for index lugares_pkey (OID = 8351213) : 
--
ALTER TABLE ONLY recycler.tit_lugares
    ADD CONSTRAINT lugares_pkey
    PRIMARY KEY (lugar_id);
--
-- Definition for index msc_avisos_pkey (OID = 8351215) : 
--
ALTER TABLE ONLY recycler.msc_avisos
    ADD CONSTRAINT msc_avisos_pkey
    PRIMARY KEY (aviso_id);
--
-- Definition for index msc_minerales_cotizacion_pkey (OID = 8351217) : 
--
ALTER TABLE ONLY recycler.msc_minerales_cotizacion
    ADD CONSTRAINT msc_minerales_cotizacion_pkey
    PRIMARY KEY (cotizacion_id);
--
-- Definition for index msc_minerales_pkey (OID = 8351219) : 
--
ALTER TABLE ONLY recycler.msc_minerales
    ADD CONSTRAINT msc_minerales_pkey
    PRIMARY KEY (mineral_id);
--
-- Definition for index notas_planillax_id_matricula_key (OID = 8351221) : 
--
ALTER TABLE ONLY recycler.notas_planilla_borrar
    ADD CONSTRAINT notas_planillax_id_matricula_key
    UNIQUE (id_matricula);
--
-- Definition for index pga_diagrams_pkey (OID = 8351223) : 
--
ALTER TABLE ONLY recycler.pga_diagrams
    ADD CONSTRAINT pga_diagrams_pkey
    PRIMARY KEY (diagramname);
--
-- Definition for index pga_graphs_pkey (OID = 8351225) : 
--
ALTER TABLE ONLY recycler.pga_graphs
    ADD CONSTRAINT pga_graphs_pkey
    PRIMARY KEY (graphname);
--
-- Definition for index pga_images_pkey (OID = 8351227) : 
--
ALTER TABLE ONLY recycler.pga_images
    ADD CONSTRAINT pga_images_pkey
    PRIMARY KEY (imagename);
--
-- Definition for index pga_layout_pkey (OID = 8351229) : 
--
ALTER TABLE ONLY recycler.pga_layout
    ADD CONSTRAINT pga_layout_pkey
    PRIMARY KEY (tablename);
--
-- Definition for index pgmreports_pkey (OID = 8351231) : 
--
ALTER TABLE ONLY recycler.pgmreports
    ADD CONSTRAINT pgmreports_pkey
    PRIMARY KEY (id);
--
-- Definition for index pgmreports_repname_key (OID = 8351233) : 
--
ALTER TABLE ONLY recycler.pgmreports
    ADD CONSTRAINT pgmreports_repname_key
    UNIQUE (repname);
--
-- Definition for index pla_proyecto_costos_pkey (OID = 8351235) : 
--
ALTER TABLE ONLY recycler.pla_proyecto_costos
    ADD CONSTRAINT pla_proyecto_costos_pkey
    PRIMARY KEY (id_proyecto_costos);
--
-- Definition for index pla_proyecto_pkey (OID = 8351237) : 
--
ALTER TABLE ONLY recycler.pla_proyecto
    ADD CONSTRAINT pla_proyecto_pkey
    PRIMARY KEY (id_proyecto);
--
-- Definition for index pla_tipo_proyecto_pkey (OID = 8351239) : 
--
ALTER TABLE ONLY recycler.pla_tipo_proyecto
    ADD CONSTRAINT pla_tipo_proyecto_pkey
    PRIMARY KEY (id_tipo_proyecto);
--
-- Definition for index plan_estudio1_new_pln_materias_ (OID = 8351241) : 
--
ALTER TABLE ONLY recycler.plan_estudio
    ADD CONSTRAINT plan_estudio1_new_pln_materias_
    PRIMARY KEY (id_materia);
--
-- Definition for index pln_materias_new1_new_pln_materias_ (OID = 8351243) : 
--
ALTER TABLE ONLY recycler.pln_materias_new
    ADD CONSTRAINT pln_materias_new1_new_pln_materias_
    PRIMARY KEY (id_materia);
--
-- Definition for index pln_mensiones_pkey (OID = 8351245) : 
--
ALTER TABLE ONLY recycler.pln_mensiones
    ADD CONSTRAINT pln_mensiones_pkey
    PRIMARY KEY (mension_id);
--
-- Definition for index postulante_e_pkey (OID = 8351247) : 
--
ALTER TABLE ONLY recycler.postulante_e
    ADD CONSTRAINT postulante_e_pkey
    PRIMARY KEY (id);
--
-- Definition for index prs_pais_pkey (OID = 8351249) : 
--
ALTER TABLE ONLY recycler.prs_pais_antiguo
    ADD CONSTRAINT prs_pais_pkey
    PRIMARY KEY (id_pais);
--
-- Definition for index sangre_pkey (OID = 8351251) : 
--
ALTER TABLE ONLY recycler.sangre
    ADD CONSTRAINT sangre_pkey
    PRIMARY KEY (id);
--
-- Definition for index servidor_publico_pkey (OID = 8351259) : 
--
ALTER TABLE ONLY recycler.servidor_publico
    ADD CONSTRAINT servidor_publico_pkey
    PRIMARY KEY (ci_per);
--
-- Definition for index silveria_pkey (OID = 8351261) : 
--
ALTER TABLE ONLY recycler.silveria
    ADD CONSTRAINT silveria_pkey
    PRIMARY KEY (id);
--
-- Definition for index sis_autoridades_pkey (OID = 8351263) : 
--
ALTER TABLE ONLY recycler.sis_autoridades
    ADD CONSTRAINT sis_autoridades_pkey
    PRIMARY KEY (id_usuario);
--
-- Definition for index tbl_editorial_pkey (OID = 8351265) : 
--
ALTER TABLE ONLY recycler.bv_editorial
    ADD CONSTRAINT tbl_editorial_pkey
    PRIMARY KEY (id_editorial);
--
-- Definition for index tbl_formato_pkey (OID = 8351267) : 
--
ALTER TABLE ONLY recycler.bv_formato
    ADD CONSTRAINT tbl_formato_pkey
    PRIMARY KEY (id_formato);
--
-- Definition for index testing_borrar_pkey (OID = 8351269) : 
--
ALTER TABLE ONLY recycler.testing_borrar
    ADD CONSTRAINT testing_borrar_pkey
    PRIMARY KEY (a);
--
-- Definition for index tit_procesos_duracion_pkey (OID = 8351271) : 
--
ALTER TABLE ONLY recycler.tit_procesos_duracion
    ADD CONSTRAINT tit_procesos_duracion_pkey
    PRIMARY KEY (dura_id);
--
-- Definition for index tit_procesos_pkey (OID = 8351273) : 
--
ALTER TABLE ONLY recycler.tit_procesos
    ADD CONSTRAINT tit_procesos_pkey
    PRIMARY KEY (proc_id);
--
-- Definition for index tit_procesos_resp_pkey (OID = 8351275) : 
--
ALTER TABLE ONLY recycler.tit_procesos_resp
    ADD CONSTRAINT tit_procesos_resp_pkey
    PRIMARY KEY (resp_id);
--
-- Definition for index tit_requisitos_pkey (OID = 8351277) : 
--
ALTER TABLE ONLY recycler.tit_requisitos
    ADD CONSTRAINT tit_requisitos_pkey
    PRIMARY KEY (req_id);
--
-- Definition for index tit_tramites_pkey (OID = 8351279) : 
--
ALTER TABLE ONLY recycler.tit_tramites
    ADD CONSTRAINT tit_tramites_pkey
    PRIMARY KEY (tram_id);
--
-- Definition for index tit_tramites_requisitos_pkey (OID = 8351281) : 
--
ALTER TABLE ONLY recycler.tit_tramites_requisitos
    ADD CONSTRAINT tit_tramites_requisitos_pkey
    PRIMARY KEY (tram_id, req_id);
--
-- Definition for index trabajadores2014_pkey (OID = 8351283) : 
--
ALTER TABLE ONLY recycler.trabajadores2014
    ADD CONSTRAINT trabajadores2014_pkey
    PRIMARY KEY (id);
--
-- Definition for index borrarlista_pkey (OID = 8351285) : 
--
SET search_path = reservar_campo, pg_catalog;
ALTER TABLE ONLY reservar_campo.listatrabajadores
    ADD CONSTRAINT borrarlista_pkey
    PRIMARY KEY (id);
--
-- Definition for index maraton_inscripcion_pkey (OID = 8351287) : 
--
ALTER TABLE ONLY reservar_campo.maraton_inscripcion
    ADD CONSTRAINT maraton_inscripcion_pkey
    PRIMARY KEY (id);
--
-- Definition for index maraton_pkey (OID = 8351289) : 
--
ALTER TABLE ONLY reservar_campo.maraton
    ADD CONSTRAINT maraton_pkey
    PRIMARY KEY (id);
--
-- Definition for index progra_semanal_pkey (OID = 8351291) : 
--
ALTER TABLE ONLY reservar_campo.programacion_semanal
    ADD CONSTRAINT progra_semanal_pkey
    PRIMARY KEY (fecha);
--
-- Definition for index reservar_hora_pkey (OID = 8351293) : 
--
ALTER TABLE ONLY reservar_campo.reservar_hora
    ADD CONSTRAINT reservar_hora_pkey
    PRIMARY KEY (cod_tiempo);
--
-- Definition for index responsable_pkey (OID = 8351295) : 
--
ALTER TABLE ONLY reservar_campo.usuarios_coliseo
    ADD CONSTRAINT responsable_pkey
    PRIMARY KEY (nro_codci);
--
-- Definition for index solicitud_hora_pkey (OID = 8351297) : 
--
ALTER TABLE ONLY reservar_campo.solicitud_reservar_hora
    ADD CONSTRAINT solicitud_hora_pkey
    PRIMARY KEY (nro_registro);
--
-- Definition for index _bp_accesos_pkey (OID = 8351299) : 
--
SET search_path = roles, pg_catalog;
ALTER TABLE ONLY roles._bp_accesos
    ADD CONSTRAINT _bp_accesos_pkey
    PRIMARY KEY (id_acceso);
--
-- Definition for index _bp_grupos_pkey (OID = 8351301) : 
--
ALTER TABLE ONLY roles._bp_grupos
    ADD CONSTRAINT _bp_grupos_pkey
    PRIMARY KEY (id_grupo);
--
-- Definition for index _bp_opciones_pkey (OID = 8351303) : 
--
ALTER TABLE ONLY roles._bp_opciones
    ADD CONSTRAINT _bp_opciones_pkey
    PRIMARY KEY (id_opcion);
--
-- Definition for index _bp_personas_id_archivo_cv_ci_key (OID = 8351305) : 
--
ALTER TABLE ONLY roles._bp_personas
    ADD CONSTRAINT _bp_personas_id_archivo_cv_ci_key
    UNIQUE (id_archivo_cv, ci);
--
-- Definition for index _bp_personas_pkey (OID = 8351307) : 
--
ALTER TABLE ONLY roles._bp_personas
    ADD CONSTRAINT _bp_personas_pkey
    PRIMARY KEY (id_persona);
--
-- Definition for index _bp_roles_pkey (OID = 8351309) : 
--
ALTER TABLE ONLY roles._bp_roles
    ADD CONSTRAINT _bp_roles_pkey
    PRIMARY KEY (id_rol);
--
-- Definition for index _bp_roles_usuarios_pkey (OID = 8351311) : 
--
ALTER TABLE ONLY roles._bp_roles_usuarios
    ADD CONSTRAINT _bp_roles_usuarios_pkey
    PRIMARY KEY (id);
--
-- Definition for index _bp_sistemas_pkey (OID = 8351313) : 
--
ALTER TABLE ONLY roles._bp_sistemas
    ADD CONSTRAINT _bp_sistemas_pkey
    PRIMARY KEY (id_sistema);
--
-- Definition for index _bp_tipos_calificaciones_pkey (OID = 8351315) : 
--
ALTER TABLE ONLY roles._bp_tipos_calificaciones
    ADD CONSTRAINT _bp_tipos_calificaciones_pkey
    PRIMARY KEY (id_tipo_calificacion);
--
-- Definition for index _bp_ubicaciones_geograficas_pkey (OID = 8351317) : 
--
ALTER TABLE ONLY roles._bp_ubicaciones_geograficas
    ADD CONSTRAINT _bp_ubicaciones_geograficas_pkey
    PRIMARY KEY (id_ubicacion_geografica);
--
-- Definition for index _bp_ubicaciones_organicas_pkey (OID = 8351319) : 
--
ALTER TABLE ONLY roles._bp_ubicaciones_organicas
    ADD CONSTRAINT _bp_ubicaciones_organicas_pkey
    PRIMARY KEY (id_ubicacion_organica);
--
-- Definition for index _bp_usuarios_ips_pkey (OID = 8351321) : 
--
ALTER TABLE ONLY roles._bp_usuarios_ips
    ADD CONSTRAINT _bp_usuarios_ips_pkey
    PRIMARY KEY (id_usuario_ip);
--
-- Definition for index _bp_usuarios_pkey (OID = 8351323) : 
--
ALTER TABLE ONLY roles._bp_usuarios
    ADD CONSTRAINT _bp_usuarios_pkey
    PRIMARY KEY (id_usuario);
--
-- Definition for index _bp_usuarios_roles_pkey (OID = 8351325) : 
--
ALTER TABLE ONLY roles._bp_usuarios_roles
    ADD CONSTRAINT _bp_usuarios_roles_pkey
    PRIMARY KEY (id_usuario_rol);
--
-- Definition for index tokens_pkey (OID = 8351327) : 
--
SET search_path = security, pg_catalog;
ALTER TABLE ONLY security.tokens
    ADD CONSTRAINT tokens_pkey
    PRIMARY KEY (id);
--
-- Definition for index administrativos_pkey (OID = 8351329) : 
--
SET search_path = seguro, pg_catalog;
ALTER TABLE ONLY seguro.administrativos
    ADD CONSTRAINT administrativos_pkey
    PRIMARY KEY (ci);
--
-- Definition for index listas_estudiantes_pkey (OID = 8351331) : 
--
ALTER TABLE ONLY seguro.listas_estudiantes
    ADD CONSTRAINT listas_estudiantes_pkey
    PRIMARY KEY (id);
--
-- Definition for index listas_generadas_pkey (OID = 8351333) : 
--
ALTER TABLE ONLY seguro.listas_generadas
    ADD CONSTRAINT listas_generadas_pkey
    PRIMARY KEY (id);
--
-- Definition for index estudiante_pkey (OID = 8351335) : 
--
SET search_path = sox, pg_catalog;
ALTER TABLE ONLY sox.estudiante
    ADD CONSTRAINT estudiante_pkey
    PRIMARY KEY (sox);
--
-- Definition for index plan_pkey (OID = 8351337) : 
--
ALTER TABLE ONLY sox.plan
    ADD CONSTRAINT plan_pkey
    PRIMARY KEY (a);
--
-- Definition for index dgo_adm_pkey (OID = 8351339) : 
--
SET search_path = webcienciaspuras, pg_catalog;
ALTER TABLE ONLY webcienciaspuras.dgo_adm
    ADD CONSTRAINT dgo_adm_pkey
    PRIMARY KEY (idadm);
--
-- Definition for index dgo_cole_pkey (OID = 8351341) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_cole
    ADD CONSTRAINT dgo_cole_pkey
    PRIMARY KEY (id_cole);
--
-- Definition for index dgo_cursos_pkey (OID = 8351343) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_cursos
    ADD CONSTRAINT dgo_cursos_pkey
    PRIMARY KEY (idcur);
--
-- Definition for index dgo_exp_pkey (OID = 8351345) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_exp
    ADD CONSTRAINT dgo_exp_pkey
    PRIMARY KEY (idexp);
--
-- Definition for index dgo_fotos_pkey (OID = 8351347) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_fotos
    ADD CONSTRAINT dgo_fotos_pkey
    PRIMARY KEY (idfoto);
--
-- Definition for index dgo_hdv_pkey (OID = 8351349) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_hdv
    ADD CONSTRAINT dgo_hdv_pkey
    PRIMARY KEY (idhdv);
--
-- Definition for index dgo_idiomas_pkey (OID = 8351351) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_idiomas
    ADD CONSTRAINT dgo_idiomas_pkey
    PRIMARY KEY (idd);
--
-- Definition for index dgo_informa_pkey (OID = 8351353) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_informa
    ADD CONSTRAINT dgo_informa_pkey
    PRIMARY KEY (idinf);
--
-- Definition for index dgo_news_pkey (OID = 8351355) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_news
    ADD CONSTRAINT dgo_news_pkey
    PRIMARY KEY (idn);
--
-- Definition for index dgo_noticias_pkey (OID = 8351357) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_noticias
    ADD CONSTRAINT dgo_noticias_pkey
    PRIMARY KEY (idn);
--
-- Definition for index dgo_superior_pkey (OID = 8351359) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_superior
    ADD CONSTRAINT dgo_superior_pkey
    PRIMARY KEY (idsup);
--
-- Definition for index dgo_userext_pkey (OID = 8351361) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_userext
    ADD CONSTRAINT dgo_userext_pkey
    PRIMARY KEY (id_userext);
--
-- Definition for index dgo_userext_usuario_key (OID = 8351363) : 
--
ALTER TABLE ONLY webcienciaspuras.dgo_userext
    ADD CONSTRAINT dgo_userext_usuario_key
    UNIQUE (usuario);
--
-- Definition for index fkey_alm_programas_sis_deva_carrera (OID = 8351598) : 
--
SET search_path = academico, pg_catalog;
ALTER TABLE ONLY academico.sist_deva_carrera
    ADD CONSTRAINT fkey_alm_programas_sis_deva_carrera
    FOREIGN KEY (id_programa) REFERENCES alm_programas(id_programa);
--
-- Definition for index fkey_devaluacion_sis_deva_evaluacion (OID = 8351603) : 
--
ALTER TABLE ONLY academico.sist_deva_carrera
    ADD CONSTRAINT fkey_devaluacion_sis_deva_evaluacion
    FOREIGN KEY (id_devaluacion) REFERENCES devaluacion(id);
--
-- Definition for index fkey_evaluacion_devaluacion (OID = 8351608) : 
--
ALTER TABLE ONLY academico.devaluacion
    ADD CONSTRAINT fkey_evaluacion_devaluacion
    FOREIGN KEY (codse) REFERENCES evaluacion(codse);
--
-- Definition for index foreign_key_alm_programaciones_alumnos (OID = 8351613) : 
--
ALTER TABLE ONLY academico.alm_programaciones
    ADD CONSTRAINT foreign_key_alm_programaciones_alumnos
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno);
--
-- Definition for index foreign_key_alm_programaciones_pln_materias (OID = 8351618) : 
--
ALTER TABLE ONLY academico.alm_programaciones
    ADD CONSTRAINT foreign_key_alm_programaciones_pln_materias
    FOREIGN KEY (id_materia) REFERENCES pln_materias(id_materia);
--
-- Definition for index foreign_key_alm_programas_alm_programas_facultades (OID = 8351623) : 
--
ALTER TABLE ONLY academico.alm_programas
    ADD CONSTRAINT foreign_key_alm_programas_alm_programas_facultades
    FOREIGN KEY (id_facultad) REFERENCES alm_programas_facultades(id_facultad);
--
-- Definition for index foreign_key_alm_programas_alm_programas_informacion (OID = 8351628) : 
--
ALTER TABLE ONLY academico.alm_programas_informacion
    ADD CONSTRAINT foreign_key_alm_programas_alm_programas_informacion
    FOREIGN KEY (id_programa) REFERENCES alm_programas(id_programa);
--
-- Definition for index foreign_key_alm_programas_carreras_tipos (OID = 8351633) : 
--
ALTER TABLE ONLY academico.alm_programas
    ADD CONSTRAINT foreign_key_alm_programas_carreras_tipos
    FOREIGN KEY (tipo) REFERENCES carreras_tipos(tipo);
--
-- Definition for index foreign_key_alm_programas_sedes (OID = 8351638) : 
--
ALTER TABLE ONLY academico.alm_programas
    ADD CONSTRAINT foreign_key_alm_programas_sedes
    FOREIGN KEY (sede) REFERENCES sedes(id_sede);
--
-- Definition for index foreign_key_alumnos_alm_programas (OID = 8351643) : 
--
ALTER TABLE ONLY academico.alumnos
    ADD CONSTRAINT foreign_key_alumnos_alm_programas
    FOREIGN KEY (id_programa) REFERENCES alm_programas(id_programa);
--
-- Definition for index foreign_key_alumnos_alumnos_estados (OID = 8351648) : 
--
ALTER TABLE ONLY academico.alumnos
    ADD CONSTRAINT foreign_key_alumnos_alumnos_estados
    FOREIGN KEY (estado) REFERENCES alumnos_estados(estado);
--
-- Definition for index foreign_key_dct_asignaciones_alm_programas (OID = 8351658) : 
--
ALTER TABLE ONLY academico.dct_asignaciones
    ADD CONSTRAINT foreign_key_dct_asignaciones_alm_programas
    FOREIGN KEY (id_programa) REFERENCES alm_programas(id_programa);
--
-- Definition for index foreign_key_dct_asignaciones_docentes (OID = 8351663) : 
--
ALTER TABLE ONLY academico.dct_asignaciones
    ADD CONSTRAINT foreign_key_dct_asignaciones_docentes
    FOREIGN KEY (id_docente) REFERENCES docentes(id_docente);
--
-- Definition for index foreign_key_dct_asignaciones_pln_materias (OID = 8351668) : 
--
ALTER TABLE ONLY academico.dct_asignaciones
    ADD CONSTRAINT foreign_key_dct_asignaciones_pln_materias
    FOREIGN KEY (id_materia) REFERENCES pln_materias(id_materia);
--
-- Definition for index foreign_key_docentes_docentes_tiempo (OID = 8351673) : 
--
ALTER TABLE ONLY academico.docentes
    ADD CONSTRAINT foreign_key_docentes_docentes_tiempo
    FOREIGN KEY (tiempo) REFERENCES docentes_tiempo(tiempo);
--
-- Definition for index foreign_key_notas_planilla_alumnos (OID = 8351678) : 
--
ALTER TABLE ONLY academico.notas_planilla
    ADD CONSTRAINT foreign_key_notas_planilla_alumnos
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno);
--
-- Definition for index foreign_key_notas_planilla_pln_materias (OID = 8351683) : 
--
ALTER TABLE ONLY academico.notas_planilla
    ADD CONSTRAINT foreign_key_notas_planilla_pln_materias
    FOREIGN KEY (id_materia) REFERENCES pln_materias(id_materia);
--
-- Definition for index foreign_key_planes_pln_materias_1 (OID = 8351688) : 
--
ALTER TABLE ONLY academico.planes
    ADD CONSTRAINT foreign_key_planes_pln_materias_1
    FOREIGN KEY (id_materia_ant) REFERENCES pln_materias(id_materia);
--
-- Definition for index foreign_key_planes_pln_materias_2 (OID = 8351693) : 
--
ALTER TABLE ONLY academico.planes
    ADD CONSTRAINT foreign_key_planes_pln_materias_2
    FOREIGN KEY (id_materia_eqv) REFERENCES pln_materias(id_materia);
--
-- Definition for index aux_alumnos_fkey (OID = 8351698) : 
--
SET search_path = auxiliares, pg_catalog;
ALTER TABLE ONLY auxiliares.aux_postulantes
    ADD CONSTRAINT aux_alumnos_fkey
    FOREIGN KEY (id_alumno) REFERENCES academico.alumnos(id_alumno);
--
-- Definition for index aux_materias_fkey (OID = 8351703) : 
--
ALTER TABLE ONLY auxiliares.aux_asignaturas
    ADD CONSTRAINT aux_materias_fkey
    FOREIGN KEY (id_materia) REFERENCES academico.pln_materias(id_materia);
--
-- Definition for index prestamo_devolucion_lector_fk (OID = 8351708) : 
--
SET search_path = biblioteca, pg_catalog;
ALTER TABLE ONLY biblioteca.prestamo_devolucion
    ADD CONSTRAINT prestamo_devolucion_lector_fk
    FOREIGN KEY (id_lector) REFERENCES lector(id_lector);
--
-- Definition for index reservas_fk (OID = 8351713) : 
--
ALTER TABLE ONLY biblioteca.reservas
    ADD CONSTRAINT reservas_fk
    FOREIGN KEY (id_lector) REFERENCES lector(id_lector);
--
-- Definition for index sancionados_fk (OID = 8351718) : 
--
ALTER TABLE ONLY biblioteca.sancionados
    ADD CONSTRAINT sancionados_fk
    FOREIGN KEY (id_lector) REFERENCES lector(id_lector);
--
-- Definition for index cronograma_id_beca_investigador_fkey (OID = 8351723) : 
--
SET search_path = binvestigacion, pg_catalog;
ALTER TABLE ONLY binvestigacion.cronograma
    ADD CONSTRAINT cronograma_id_beca_investigador_fkey
    FOREIGN KEY (id_beca_investigador) REFERENCES beca_investigador(id) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index requisitos_id_becasprograma_fkey (OID = 8351728) : 
--
SET search_path = btrabajo, pg_catalog;
ALTER TABLE ONLY btrabajo.requisitos
    ADD CONSTRAINT requisitos_id_becasprograma_fkey
    FOREIGN KEY (id_becasprograma) REFERENCES becasprograma(id);
--
-- Definition for index alumnos_materias_lista_fk (OID = 8351733) : 
--
SET search_path = consola, pg_catalog;
ALTER TABLE ONLY consola.alumnos_materias_lista
    ADD CONSTRAINT alumnos_materias_lista_fk
    FOREIGN KEY (id_alumnos_materias) REFERENCES alumnos_materias(id) ON DELETE CASCADE;
--
-- Definition for index columna_id_categoria_fkey (OID = 8351738) : 
--
SET search_path = curriculum, pg_catalog;
ALTER TABLE ONLY curriculum.columna
    ADD CONSTRAINT columna_id_categoria_fkey
    FOREIGN KEY (id_categoria) REFERENCES categoria(id);
--
-- Definition for index valores_id_columna_fkey (OID = 8351743) : 
--
ALTER TABLE ONLY curriculum.valores
    ADD CONSTRAINT valores_id_columna_fkey
    FOREIGN KEY (id_columna) REFERENCES columna(id);
--
-- Definition for index fkey_sol (OID = 8351748) : 
--
SET search_path = diu, pg_catalog;
ALTER TABLE ONLY diu.diu_impresion
    ADD CONSTRAINT fkey_sol
    FOREIGN KEY (id_solicitud) REFERENCES diu_solicitud(id_solicitud);
--
-- Definition for index fkey_ts (OID = 8351753) : 
--
ALTER TABLE ONLY diu.diu_solicitud
    ADD CONSTRAINT fkey_ts
    FOREIGN KEY (id_tipo_solicitud) REFERENCES diu_tipo_solicitud(id_tipo_solicitud);
--
-- Definition for index _elecciones_votos_fk (OID = 8351758) : 
--
SET search_path = elecciones, pg_catalog;
ALTER TABLE ONLY elecciones._elecciones_votos
    ADD CONSTRAINT _elecciones_votos_fk
    FOREIGN KEY (id_frente) REFERENCES _elecciones_old(id_frente) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index alumnos_via_id_fkey (OID = 8351763) : 
--
SET search_path = infraestructura, pg_catalog;
ALTER TABLE ONLY infraestructura.alumnos_via
    ADD CONSTRAINT alumnos_via_id_fkey
    FOREIGN KEY (id) REFERENCES viajes(id_viaje);
--
-- Definition for index cronograma_id_fkey (OID = 8351768) : 
--
ALTER TABLE ONLY infraestructura.cronograma
    ADD CONSTRAINT cronograma_id_fkey
    FOREIGN KEY (id) REFERENCES viajes(id_viaje);
--
-- Definition for index caracteristicas_id_categoria_fkey (OID = 8351773) : 
--
SET search_path = laptopsdocentes, pg_catalog;
ALTER TABLE ONLY laptopsdocentes.caracteristicas
    ADD CONSTRAINT caracteristicas_id_categoria_fkey
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria);
--
-- Definition for index caracteristicas_id_serial_fkey (OID = 8351778) : 
--
ALTER TABLE ONLY laptopsdocentes.caracteristicas
    ADD CONSTRAINT caracteristicas_id_serial_fkey
    FOREIGN KEY (id_serial) REFERENCES seriales(id_serial);
--
-- Definition for index log_tablas_modificaciones_id_log_tablas_fkey (OID = 8351783) : 
--
SET search_path = log, pg_catalog;
ALTER TABLE ONLY log.log_tablas_modificaciones
    ADD CONSTRAINT log_tablas_modificaciones_id_log_tablas_fkey
    FOREIGN KEY (id_log_tablas) REFERENCES log_tablas(id);
--
-- Definition for index fk_id_persona (OID = 8351793) : 
--
SET search_path = postulantes, pg_catalog;
ALTER TABLE ONLY postulantes._apoderado
    ADD CONSTRAINT fk_id_persona
    FOREIGN KEY (id_persona) REFERENCES _postulantes(id);
--
-- Definition for index aud_link_archivos_fk (OID = 8351938) : 
--
SET search_path = recycler, pg_catalog;
ALTER TABLE ONLY recycler.aud_link_archivos
    ADD CONSTRAINT aud_link_archivos_fk
    FOREIGN KEY (id_tipo_doc) REFERENCES aud_tipo_doc(id_tipo_doc) ON UPDATE CASCADE DEFERRABLE;
--
-- Definition for index aud_tipo_doc_fk (OID = 8351943) : 
--
ALTER TABLE ONLY recycler.aud_tipo_doc
    ADD CONSTRAINT aud_tipo_doc_fk
    FOREIGN KEY (id_usuario) REFERENCES _usuarios_borrar(id_usuario) ON UPDATE CASCADE DEFERRABLE;
--
-- Definition for index bv_libro_id_editorial_fkey (OID = 8351948) : 
--
ALTER TABLE ONLY recycler.bv_libro
    ADD CONSTRAINT bv_libro_id_editorial_fkey
    FOREIGN KEY (id_editorial) REFERENCES bv_editorial(id_editorial) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index bv_libro_id_encuadernacion_fkey (OID = 8351953) : 
--
ALTER TABLE ONLY recycler.bv_libro
    ADD CONSTRAINT bv_libro_id_encuadernacion_fkey
    FOREIGN KEY (id_encuadernacion) REFERENCES bv_encuadernacion(id_encuadernacion) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index bv_libro_id_formato_fkey (OID = 8351958) : 
--
ALTER TABLE ONLY recycler.bv_libro
    ADD CONSTRAINT bv_libro_id_formato_fkey
    FOREIGN KEY (id_formato) REFERENCES bv_formato(id_formato) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index bv_libro_id_procedencia_fkey (OID = 8351963) : 
--
ALTER TABLE ONLY recycler.bv_libro
    ADD CONSTRAINT bv_libro_id_procedencia_fkey
    FOREIGN KEY (id_procedencia) REFERENCES bv_procedencia(id_procedencia) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index bv_libro_id_ubicacion_fkey (OID = 8351968) : 
--
ALTER TABLE ONLY recycler.bv_libro
    ADD CONSTRAINT bv_libro_id_ubicacion_fkey
    FOREIGN KEY (id_ubicacion) REFERENCES bv_ubicacion(id_ubicacion);
--
-- Definition for index msc_minerales_cotizacion_fk (OID = 8351973) : 
--
ALTER TABLE ONLY recycler.msc_minerales_cotizacion
    ADD CONSTRAINT msc_minerales_cotizacion_fk
    FOREIGN KEY (mineral_id) REFERENCES msc_minerales(mineral_id) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index tit_procesos_fk (OID = 8351978) : 
--
ALTER TABLE ONLY recycler.tit_procesos
    ADD CONSTRAINT tit_procesos_fk
    FOREIGN KEY (lugar_id) REFERENCES tit_lugares(lugar_id) MATCH FULL ON UPDATE CASCADE;
--
-- Definition for index tit_procesos_fk1 (OID = 8351983) : 
--
ALTER TABLE ONLY recycler.tit_procesos
    ADD CONSTRAINT tit_procesos_fk1
    FOREIGN KEY (resp_id) REFERENCES tit_procesos_resp(resp_id) MATCH FULL ON UPDATE CASCADE;
--
-- Definition for index tit_procesos_fk2 (OID = 8351988) : 
--
ALTER TABLE ONLY recycler.tit_procesos
    ADD CONSTRAINT tit_procesos_fk2
    FOREIGN KEY (dura_id) REFERENCES tit_procesos_duracion(dura_id) MATCH FULL ON UPDATE CASCADE;
--
-- Definition for index tit_tramites_requisitos_fk (OID = 8351993) : 
--
ALTER TABLE ONLY recycler.tit_tramites_requisitos
    ADD CONSTRAINT tit_tramites_requisitos_fk
    FOREIGN KEY (tram_id) REFERENCES tit_tramites(tram_id) MATCH FULL ON UPDATE CASCADE;
--
-- Definition for index tit_tramites_requisitos_fk1 (OID = 8351998) : 
--
ALTER TABLE ONLY recycler.tit_tramites_requisitos
    ADD CONSTRAINT tit_tramites_requisitos_fk1
    FOREIGN KEY (req_id) REFERENCES tit_requisitos(req_id) MATCH FULL ON UPDATE CASCADE;
--
-- Definition for index _bp_accesos_id_opcion_fkey (OID = 8352003) : 
--
SET search_path = roles, pg_catalog;
ALTER TABLE ONLY roles._bp_accesos
    ADD CONSTRAINT _bp_accesos_id_opcion_fkey
    FOREIGN KEY (id_opcion) REFERENCES _bp_opciones(id_opcion);
--
-- Definition for index _bp_accesos_id_rol_fkey (OID = 8352008) : 
--
ALTER TABLE ONLY roles._bp_accesos
    ADD CONSTRAINT _bp_accesos_id_rol_fkey
    FOREIGN KEY (id_rol) REFERENCES _bp_roles(id_rol);
--
-- Definition for index _bp_ubicaciones_organicas_id_tipo_calificacion_fkey (OID = 8352018) : 
--
ALTER TABLE ONLY roles._bp_ubicaciones_organicas
    ADD CONSTRAINT _bp_ubicaciones_organicas_id_tipo_calificacion_fkey
    FOREIGN KEY (id_tipo_calificacion) REFERENCES _bp_tipos_calificaciones(id_tipo_calificacion);
--
-- Definition for index _bp_ubicaciones_organicas_id_ubicacion_organica_padre_fkey (OID = 8352023) : 
--
ALTER TABLE ONLY roles._bp_ubicaciones_organicas
    ADD CONSTRAINT _bp_ubicaciones_organicas_id_ubicacion_organica_padre_fkey
    FOREIGN KEY (id_ubicacion_organica_padre) REFERENCES _bp_ubicaciones_organicas(id_ubicacion_organica);
--
-- Definition for index _bp_usuarios_roles_id_rol_fkey (OID = 8352028) : 
--
ALTER TABLE ONLY roles._bp_usuarios_roles
    ADD CONSTRAINT _bp_usuarios_roles_id_rol_fkey
    FOREIGN KEY (id_rol) REFERENCES _bp_roles(id_rol);
--
-- Definition for index _bp_usuarios_roles_id_usuario_fkey (OID = 8352033) : 
--
ALTER TABLE ONLY roles._bp_usuarios_roles
    ADD CONSTRAINT _bp_usuarios_roles_id_usuario_fkey
    FOREIGN KEY (id_usuario) REFERENCES _bp_usuarios(id_usuario);
--
-- Definition for index fk (OID = 8352038) : 
--
ALTER TABLE ONLY roles._bp_usuarios
    ADD CONSTRAINT fk
    FOREIGN KEY (id_persona) REFERENCES _bp_personas(id_persona);
--
-- Definition for index listas_estudiantes_id_lista_fkey (OID = 8352043) : 
--
SET search_path = seguro, pg_catalog;
ALTER TABLE ONLY seguro.listas_estudiantes
    ADD CONSTRAINT listas_estudiantes_id_lista_fkey
    FOREIGN KEY (id_lista) REFERENCES listas_generadas(id);
--
-- Definition for index postulante_pkey (OID = 8460463) : 
--
SET search_path = agenda_aux, pg_catalog;
ALTER TABLE ONLY agenda_aux.postulante
    ADD CONSTRAINT postulante_pkey
    PRIMARY KEY (ru);
--
-- Definition for index trabajadorasocial_pkey (OID = 8460471) : 
--
ALTER TABLE ONLY agenda_aux.trabajadorasocial
    ADD CONSTRAINT trabajadorasocial_pkey
    PRIMARY KEY (idtrabajadorasocial);
--
-- Definition for index agenda_pkey (OID = 8460500) : 
--
ALTER TABLE ONLY agenda_aux.agenda
    ADD CONSTRAINT agenda_pkey
    PRIMARY KEY (idagenda);
--
-- Definition for index agenda_idtrabajadorasocial_fkey (OID = 8460502) : 
--
ALTER TABLE ONLY agenda_aux.agenda
    ADD CONSTRAINT agenda_idtrabajadorasocial_fkey
    FOREIGN KEY (idtrabajadorasocial) REFERENCES trabajadorasocial(idtrabajadorasocial);
--
-- Definition for index agenda_ru_fkey (OID = 8460507) : 
--
ALTER TABLE ONLY agenda_aux.agenda
    ADD CONSTRAINT agenda_ru_fkey
    FOREIGN KEY (ru) REFERENCES postulante(ru);
--
-- Definition for index borrar2_pkey (OID = 8468267) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.borrar2
    ADD CONSTRAINT borrar2_pkey
    PRIMARY KEY (id);
--
-- Definition for index notas_planilla_id_gestion_id_periodo_id_alumno_id_materia_g_key (OID = 8548798) : 
--
SET search_path = academico, pg_catalog;
ALTER TABLE ONLY academico.notas_planilla
    ADD CONSTRAINT notas_planilla_id_gestion_id_periodo_id_alumno_id_materia_g_key
    UNIQUE (id_gestion, id_periodo, id_alumno, id_materia, grupo, _unique);
--
-- Definition for index reagenda_pkey (OID = 8585659) : 
--
SET search_path = agenda_aux, pg_catalog;
ALTER TABLE ONLY agenda_aux.reagenda
    ADD CONSTRAINT reagenda_pkey
    PRIMARY KEY (idagenda);
--
-- Definition for index reagenda_idtrabajadorasocial_fkey (OID = 8585661) : 
--
ALTER TABLE ONLY agenda_aux.reagenda
    ADD CONSTRAINT reagenda_idtrabajadorasocial_fkey
    FOREIGN KEY (idtrabajadorasocial) REFERENCES trabajadorasocial(idtrabajadorasocial);
--
-- Definition for index reagenda_ru_fkey (OID = 8585666) : 
--
ALTER TABLE ONLY agenda_aux.reagenda
    ADD CONSTRAINT reagenda_ru_fkey
    FOREIGN KEY (ru) REFERENCES postulante(ru);
--
-- Definition for index tit_nivel_pkey (OID = 8651410) : 
--
SET search_path = dep_titulos, pg_catalog;
ALTER TABLE ONLY dep_titulos.tit_nivel
    ADD CONSTRAINT tit_nivel_pkey
    PRIMARY KEY (id);
--
-- Definition for index tit_tit_nivel_programa_pkey (OID = 8652388) : 
--
ALTER TABLE ONLY dep_titulos.tit_programa_nivel
    ADD CONSTRAINT tit_tit_nivel_programa_pkey
    PRIMARY KEY (id);
--
-- Definition for index _bp_roles_new_pkey (OID = 9226959) : 
--
SET search_path = roles, pg_catalog;
ALTER TABLE ONLY roles._bp_roles_new
    ADD CONSTRAINT _bp_roles_new_pkey
    PRIMARY KEY (id_rol);
--
-- Definition for index cajero_numeracion_pkey (OID = 9248774) : 
--
SET search_path = cajas, pg_catalog;
ALTER TABLE ONLY cajas.cajero_numeracion
    ADD CONSTRAINT cajero_numeracion_pkey
    PRIMARY KEY (id);
--
-- Definition for index prs_cumplidos1_pkey (OID = 37734994) : 
--
SET search_path = academico, pg_catalog;
ALTER TABLE ONLY academico.prs_cumplidos
    ADD CONSTRAINT prs_cumplidos1_pkey
    PRIMARY KEY (id_ra, id_requisito);
--
-- Definition for index prs_cumplidos1_id_ra_key (OID = 37734996) : 
--
ALTER TABLE ONLY academico.prs_cumplidos
    ADD CONSTRAINT prs_cumplidos1_id_ra_key
    UNIQUE (id_ra);
--
-- Definition for index valores_pkey (OID = 37824053) : 
--
SET search_path = cajas, pg_catalog;
ALTER TABLE ONLY cajas.valores
    ADD CONSTRAINT valores_pkey
    PRIMARY KEY (id_cargo);
--
-- Definition for index bc_postulantes_1_pkey (OID = 85215921) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.bc_postulantes_1
    ADD CONSTRAINT bc_postulantes_1_pkey
    PRIMARY KEY (id_alumno, id_gestion, tipo_post);
--
-- Definition for index bc_items_becas_new_pkey (OID = 85256087) : 
--
ALTER TABLE ONLY balimentacion.bc_items_becas_new
    ADD CONSTRAINT bc_items_becas_new_pkey
    PRIMARY KEY (id);
--
-- Definition for index bc_items_becas_new_id_programa_tipo_post_id_gestion_key (OID = 85256089) : 
--
ALTER TABLE ONLY balimentacion.bc_items_becas_new
    ADD CONSTRAINT bc_items_becas_new_id_programa_tipo_post_id_gestion_key
    UNIQUE (id_programa, tipo_post, id_gestion, _estado);
--
-- Definition for index bc_postulantes_2_pkey (OID = 85284625) : 
--
ALTER TABLE ONLY balimentacion.bc_postulantes_2
    ADD CONSTRAINT bc_postulantes_2_pkey
    PRIMARY KEY (id_alumno, id_gestion, tipo_post);
--
-- Definition for index o_bc_familia_new_pkey (OID = 85326064) : 
--
ALTER TABLE ONLY balimentacion.o_bc_familia_new
    ADD CONSTRAINT o_bc_familia_new_pkey
    PRIMARY KEY (id);
--
-- Definition for index o_bc_familia_new_id_ra_id_gestion_id_n_key (OID = 85326066) : 
--
ALTER TABLE ONLY balimentacion.o_bc_familia_new
    ADD CONSTRAINT o_bc_familia_new_id_ra_id_gestion_id_n_key
    UNIQUE (id_ra, id_gestion, id_n);
--
-- Definition for index bc_postulantes_bck_pkey (OID = 85379899) : 
--
ALTER TABLE ONLY balimentacion.bc_postulantes_bck
    ADD CONSTRAINT bc_postulantes_bck_pkey
    PRIMARY KEY (id_alumno, id_gestion, tipo_post);
--
-- Definition for index tramites_cargos_carreras_idx (OID = 85552098) : 
--
SET search_path = cajas, pg_catalog;
ALTER TABLE ONLY cajas.tramites_cargos_carreras
    ADD CONSTRAINT tramites_cargos_carreras_idx
    UNIQUE (id_tramite, id_cargo, id_examen, id_programa, importe);
--
-- Definition for index apertura_planillas_reposicion_pkey (OID = 96085385) : 
--
SET search_path = academico, pg_catalog;
ALTER TABLE ONLY academico.apertura_planillas_reposicion
    ADD CONSTRAINT apertura_planillas_reposicion_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 96318600) : 
--
SET search_path = soporte, pg_catalog;
ALTER TABLE ONLY soporte.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_email_unique (OID = 96318602) : 
--
ALTER TABLE ONLY soporte.users
    ADD CONSTRAINT users_email_unique
    UNIQUE (email);
--
-- Definition for index users_pkey (OID = 96335571) : 
--
SET search_path = elecciones, pg_catalog;
ALTER TABLE ONLY elecciones.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_email_unique (OID = 96335573) : 
--
ALTER TABLE ONLY elecciones.users
    ADD CONSTRAINT users_email_unique
    UNIQUE (email);
--
-- Definition for index _votos_pkey (OID = 96337247) : 
--
ALTER TABLE ONLY elecciones._votos
    ADD CONSTRAINT _votos_pkey
    PRIMARY KEY (id_voto);
--
-- Definition for index _votos_1ra_pkey (OID = 117512469) : 
--
ALTER TABLE ONLY elecciones._votos_1ra
    ADD CONSTRAINT _votos_1ra_pkey
    PRIMARY KEY (id_voto);
--
-- Definition for index becas_carreras_id_programa_tipo_post_id_gestion_key (OID = 138777841) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.becas_carreras
    ADD CONSTRAINT becas_carreras_id_programa_tipo_post_id_gestion_key
    UNIQUE (id_programa, tipo_post, id_gestion, _estado);
--
-- Definition for index responsables_pkey (OID = 171903026) : 
--
SET search_path = msg, pg_catalog;
ALTER TABLE ONLY msg.responsables
    ADD CONSTRAINT responsables_pkey
    PRIMARY KEY (id_responsable);
--
-- Definition for index salas_pkey (OID = 171903282) : 
--
SET search_path = preguntas, pg_catalog;
ALTER TABLE ONLY preguntas.salas
    ADD CONSTRAINT salas_pkey
    PRIMARY KEY (id_sala);
--
-- Definition for index mensajes_pkey (OID = 171903335) : 
--
ALTER TABLE ONLY preguntas.mensajes
    ADD CONSTRAINT mensajes_pkey
    PRIMARY KEY (id_mensaje);
--
-- Definition for index telefonos_pkey (OID = 171906038) : 
--
ALTER TABLE ONLY preguntas.telefonos
    ADD CONSTRAINT telefonos_pkey
    PRIMARY KEY (id_telefono);
--
-- Definition for index migrations_pkey (OID = 171906178) : 
--
ALTER TABLE ONLY preguntas.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 171906189) : 
--
ALTER TABLE ONLY preguntas.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_email_unique (OID = 171906191) : 
--
ALTER TABLE ONLY preguntas.users
    ADD CONSTRAINT users_email_unique
    UNIQUE (email);
--
-- Definition for index failed_jobs_pkey (OID = 171906210) : 
--
ALTER TABLE ONLY preguntas.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey
    PRIMARY KEY (id);
--
-- Definition for index costos_pkey (OID = 171927485) : 
--
ALTER TABLE ONLY preguntas.costos
    ADD CONSTRAINT costos_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 183103945) : 
--
SET search_path = kardex, pg_catalog;
ALTER TABLE ONLY kardex.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index kardex_users_email_unique (OID = 183103947) : 
--
ALTER TABLE ONLY kardex.users
    ADD CONSTRAINT kardex_users_email_unique
    UNIQUE (email);
--
-- Definition for index failed_jobs_pkey (OID = 183103968) : 
--
ALTER TABLE ONLY kardex.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey
    PRIMARY KEY (id);
--
-- Definition for index parametroinv_pkey (OID = 205447366) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.parametroinv
    ADD CONSTRAINT parametroinv_pkey
    PRIMARY KEY (id);
--
-- Definition for index invsocial_pkey (OID = 205450087) : 
--
ALTER TABLE ONLY balimentacion.invsocial
    ADD CONSTRAINT invsocial_pkey
    PRIMARY KEY (id);
--
-- Definition for index detalleinv_pkey (OID = 205450100) : 
--
ALTER TABLE ONLY balimentacion.detalleinv
    ADD CONSTRAINT detalleinv_pkey
    PRIMARY KEY (id);
--
-- Definition for index detalleinv_id_parametro_fkey (OID = 205450102) : 
--
ALTER TABLE ONLY balimentacion.detalleinv
    ADD CONSTRAINT detalleinv_id_parametro_fkey
    FOREIGN KEY (id_parametro) REFERENCES parametroinv(id);
--
-- Definition for index detalleinv_id_invsocial_fkey (OID = 205450107) : 
--
ALTER TABLE ONLY balimentacion.detalleinv
    ADD CONSTRAINT detalleinv_id_invsocial_fkey
    FOREIGN KEY (id_invsocial) REFERENCES invsocial(id);
--
-- Definition for index fk_career (OID = 216890924) : 
--
ALTER TABLE ONLY balimentacion.invsocial
    ADD CONSTRAINT fk_career
    FOREIGN KEY (id_career) REFERENCES academico.alm_programas(id_programa) ON DELETE CASCADE;
--
-- Definition for index o_bc_declaracion_id_ra_id_gestion__tipo_post_key (OID = 216916533) : 
--
ALTER TABLE ONLY balimentacion.o_bc_declaracion
    ADD CONSTRAINT o_bc_declaracion_id_ra_id_gestion__tipo_post_key
    UNIQUE (id_ra, id_gestion, _tipo_post);
--
-- Definition for index bc_postulantes_unique (OID = 228312613) : 
--
ALTER TABLE ONLY balimentacion.bc_postulantes
    ADD CONSTRAINT bc_postulantes_unique
    UNIQUE (id);
--
-- Definition for index comissions_pkey (OID = 228322680) : 
--
ALTER TABLE ONLY balimentacion.comissions
    ADD CONSTRAINT comissions_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_comissions_programa_id_foreign (OID = 228322682) : 
--
ALTER TABLE ONLY balimentacion.comissions
    ADD CONSTRAINT balimentacion_comissions_programa_id_foreign
    FOREIGN KEY (programa_id) REFERENCES academico.alm_programas(id_programa);
--
-- Definition for index dicts_comissions_pkey (OID = 228322709) : 
--
ALTER TABLE ONLY balimentacion.miembros
    ADD CONSTRAINT dicts_comissions_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_dicts_comissions_comission_id_foreign (OID = 228322721) : 
--
ALTER TABLE ONLY balimentacion.miembros
    ADD CONSTRAINT balimentacion_dicts_comissions_comission_id_foreign
    FOREIGN KEY (comission_id) REFERENCES comissions(id);
--
-- Definition for index parameters_califs_pkey (OID = 228322735) : 
--
ALTER TABLE ONLY balimentacion.calificacion_grupos
    ADD CONSTRAINT parameters_califs_pkey
    PRIMARY KEY (id);
--
-- Definition for index informs_alims_pkey (OID = 228322759) : 
--
ALTER TABLE ONLY balimentacion.informs_alims
    ADD CONSTRAINT informs_alims_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_informs_alims_comission_id_foreign (OID = 228322761) : 
--
ALTER TABLE ONLY balimentacion.informs_alims
    ADD CONSTRAINT balimentacion_informs_alims_comission_id_foreign
    FOREIGN KEY (comission_id) REFERENCES comissions(id);
--
-- Definition for index mat_apoyo_pkey (OID = 228600977) : 
--
SET search_path = auxiliares, pg_catalog;
ALTER TABLE ONLY auxiliares.mat_apoyo
    ADD CONSTRAINT mat_apoyo_pkey
    PRIMARY KEY (id);
--
-- Definition for index presItemAlims_pkey (OID = 228621927) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.presitemalims
    ADD CONSTRAINT "presItemAlims_pkey"
    PRIMARY KEY (id);
--
-- Definition for index items_alims_pkey (OID = 228621938) : 
--
ALTER TABLE ONLY balimentacion.items_alims
    ADD CONSTRAINT items_alims_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_items_alims_programa_id_foreign (OID = 228621940) : 
--
ALTER TABLE ONLY balimentacion.items_alims
    ADD CONSTRAINT balimentacion_items_alims_programa_id_foreign
    FOREIGN KEY (programa_id) REFERENCES academico.alm_programas(id_programa);
--
-- Definition for index balimentacion_items_alims_presitemalim_id_foreign (OID = 228621945) : 
--
ALTER TABLE ONLY balimentacion.items_alims
    ADD CONSTRAINT balimentacion_items_alims_presitemalim_id_foreign
    FOREIGN KEY ("presItemAlim_id") REFERENCES presitemalims(id);
--
-- Definition for index exa_mesa_pkey (OID = 228676697) : 
--
SET search_path = sis_kardex, pg_catalog;
ALTER TABLE ONLY sis_kardex.exa_mesa
    ADD CONSTRAINT exa_mesa_pkey
    PRIMARY KEY (id);
--
-- Definition for index note_postulante_pkey (OID = 228756403) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.note_postulante
    ADD CONSTRAINT note_postulante_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_note_postulante_inform_alim_id_foreign (OID = 228756405) : 
--
ALTER TABLE ONLY balimentacion.note_postulante
    ADD CONSTRAINT balimentacion_note_postulante_inform_alim_id_foreign
    FOREIGN KEY (inform_alim_id) REFERENCES informs_alims(id);
--
-- Definition for index balimentacion_note_postulante_bc_postulantes_id_foreign (OID = 228756410) : 
--
ALTER TABLE ONLY balimentacion.note_postulante
    ADD CONSTRAINT balimentacion_note_postulante_bc_postulantes_id_foreign
    FOREIGN KEY (bc_postulantes_id) REFERENCES bc_postulantes(id);
--
-- Definition for index califs_pkey (OID = 228756421) : 
--
ALTER TABLE ONLY balimentacion.califs
    ADD CONSTRAINT califs_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_califs_note_postulante_id_foreign (OID = 228756428) : 
--
ALTER TABLE ONLY balimentacion.califs
    ADD CONSTRAINT balimentacion_califs_note_postulante_id_foreign
    FOREIGN KEY (note_postulante_id) REFERENCES note_postulante(id);
--
-- Definition for index cuentas_bancarias_pkey (OID = 240633562) : 
--
SET search_path = becas, pg_catalog;
ALTER TABLE ONLY becas.cuentas_bancarias
    ADD CONSTRAINT cuentas_bancarias_pkey
    PRIMARY KEY (id);
--
-- Definition for index migrations_pkey (OID = 240750791) : 
--
SET search_path = seguro, pg_catalog;
ALTER TABLE ONLY seguro.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 240750802) : 
--
ALTER TABLE ONLY seguro.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_email_unique (OID = 240750804) : 
--
ALTER TABLE ONLY seguro.users
    ADD CONSTRAINT users_email_unique
    UNIQUE (email);
--
-- Definition for index oauth_auth_codes_pkey (OID = 240750819) : 
--
ALTER TABLE ONLY seguro.oauth_auth_codes
    ADD CONSTRAINT oauth_auth_codes_pkey
    PRIMARY KEY (id);
--
-- Definition for index oauth_access_tokens_pkey (OID = 240750828) : 
--
ALTER TABLE ONLY seguro.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_pkey
    PRIMARY KEY (id);
--
-- Definition for index oauth_refresh_tokens_pkey (OID = 240750834) : 
--
ALTER TABLE ONLY seguro.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_pkey
    PRIMARY KEY (id);
--
-- Definition for index oauth_clients_pkey (OID = 240750846) : 
--
ALTER TABLE ONLY seguro.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey
    PRIMARY KEY (id);
--
-- Definition for index oauth_personal_access_clients_pkey (OID = 240750855) : 
--
ALTER TABLE ONLY seguro.oauth_personal_access_clients
    ADD CONSTRAINT oauth_personal_access_clients_pkey
    PRIMARY KEY (id);
--
-- Definition for index failed_jobs_pkey (OID = 240750867) : 
--
ALTER TABLE ONLY seguro.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey
    PRIMARY KEY (id);
--
-- Definition for index failed_jobs_uuid_unique (OID = 240750869) : 
--
ALTER TABLE ONLY seguro.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique
    UNIQUE (uuid);
--
-- Definition for index projects_pkey (OID = 240750880) : 
--
ALTER TABLE ONLY seguro.projects
    ADD CONSTRAINT projects_pkey
    PRIMARY KEY (id);
--
-- Definition for index id_alumno_foreignkey (OID = 240765431) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.bc_postulantes
    ADD CONSTRAINT id_alumno_foreignkey
    FOREIGN KEY (id_alumno) REFERENCES academico.alumnos(id_alumno) NOT VALID;
--
-- Definition for index ic_convocatorias_pkey (OID = 240765861) : 
--
ALTER TABLE ONLY balimentacion.ic_convocatorias
    ADD CONSTRAINT ic_convocatorias_pkey
    PRIMARY KEY (id);
--
-- Definition for index calls_convs_pkey (OID = 240765872) : 
--
ALTER TABLE ONLY balimentacion.calls_convs
    ADD CONSTRAINT calls_convs_pkey
    PRIMARY KEY (id);
--
-- Definition for index details_conv_pkey (OID = 240765883) : 
--
ALTER TABLE ONLY balimentacion.details_conv
    ADD CONSTRAINT details_conv_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_details_conv_career_id_foreign (OID = 240765885) : 
--
ALTER TABLE ONLY balimentacion.details_conv
    ADD CONSTRAINT balimentacion_details_conv_career_id_foreign
    FOREIGN KEY (career_id) REFERENCES academico.alm_programas(id_programa);
--
-- Definition for index balimentacion_details_conv_convocatorias_id_foreign (OID = 240765890) : 
--
ALTER TABLE ONLY balimentacion.details_conv
    ADD CONSTRAINT balimentacion_details_conv_convocatorias_id_foreign
    FOREIGN KEY (convocatorias_id) REFERENCES ic_convocatorias(id);
--
-- Definition for index balimentacion_details_conv_calls_convs_id_foreign (OID = 240765895) : 
--
ALTER TABLE ONLY balimentacion.details_conv
    ADD CONSTRAINT balimentacion_details_conv_calls_convs_id_foreign
    FOREIGN KEY (calls_convs_id) REFERENCES calls_convs(id);
--
-- Definition for index exceptional_conv_pkey (OID = 240767040) : 
--
ALTER TABLE ONLY balimentacion.exceptional_conv
    ADD CONSTRAINT exceptional_conv_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_exceptional_conv_alumno_id_foreign (OID = 240767042) : 
--
ALTER TABLE ONLY balimentacion.exceptional_conv
    ADD CONSTRAINT balimentacion_exceptional_conv_alumno_id_foreign
    FOREIGN KEY (alumno_id) REFERENCES academico.alumnos(id_alumno);
--
-- Definition for index fk_bc_postulante (OID = 240768335) : 
--
ALTER TABLE ONLY balimentacion.o_bc_declaracion
    ADD CONSTRAINT fk_bc_postulante
    FOREIGN KEY (id_bc_postulante) REFERENCES bc_postulantes(id) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index offices_pkey (OID = 252913909) : 
--
SET search_path = hermes, pg_catalog;
ALTER TABLE ONLY hermes.offices
    ADD CONSTRAINT offices_pkey
    PRIMARY KEY (id);
--
-- Definition for index correspondences_pkey (OID = 252913920) : 
--
ALTER TABLE ONLY hermes.correspondences
    ADD CONSTRAINT correspondences_pkey
    PRIMARY KEY (id);
--
-- Definition for index hermes_correspondences_receiveroffice_id_foreign (OID = 252913932) : 
--
ALTER TABLE ONLY hermes.correspondences
    ADD CONSTRAINT hermes_correspondences_receiveroffice_id_foreign
    FOREIGN KEY ("receiverOffice_id") REFERENCES offices(id);
--
-- Definition for index hermes_correspondences_senderoffice_id_foreign (OID = 252913937) : 
--
ALTER TABLE ONLY hermes.correspondences
    ADD CONSTRAINT hermes_correspondences_senderoffice_id_foreign
    FOREIGN KEY ("senderOffice_id") REFERENCES offices(id);
--
-- Definition for index derives_pkey (OID = 252913951) : 
--
ALTER TABLE ONLY hermes.derives
    ADD CONSTRAINT derives_pkey
    PRIMARY KEY (id);
--
-- Definition for index hermes_derives_receiveroffice_id_foreign (OID = 252913963) : 
--
ALTER TABLE ONLY hermes.derives
    ADD CONSTRAINT hermes_derives_receiveroffice_id_foreign
    FOREIGN KEY ("receiverOffice_id") REFERENCES offices(id);
--
-- Definition for index user_offices_pkey (OID = 252913974) : 
--
ALTER TABLE ONLY hermes.user_offices
    ADD CONSTRAINT user_offices_pkey
    PRIMARY KEY (id);
--
-- Definition for index hermes_user_offices_office_id_foreign (OID = 252913981) : 
--
ALTER TABLE ONLY hermes.user_offices
    ADD CONSTRAINT hermes_user_offices_office_id_foreign
    FOREIGN KEY (office_id) REFERENCES offices(id);
--
-- Definition for index fk_derive (OID = 252914021) : 
--
ALTER TABLE ONLY hermes.derive_derives
    ADD CONSTRAINT fk_derive
    FOREIGN KEY (derive_id) REFERENCES derives(id);
--
-- Definition for index fk_derive (OID = 252914033) : 
--
ALTER TABLE ONLY hermes.corresp_derives
    ADD CONSTRAINT fk_derive
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id);
--
-- Definition for index users_od_pkey (OID = 277169287) : 
--
SET search_path = postulantes, pg_catalog;
ALTER TABLE ONLY postulantes.users_od
    ADD CONSTRAINT users_od_pkey
    PRIMARY KEY (id);
--
-- Definition for index bc_postulantes_bk_pkey (OID = 277176888) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.bc_postulantes_bk
    ADD CONSTRAINT bc_postulantes_bk_pkey
    PRIMARY KEY (id_alumno, id_gestion, tipo_post);
--
-- Definition for index bc_postulantes_bk_unique (OID = 277176890) : 
--
ALTER TABLE ONLY balimentacion.bc_postulantes_bk
    ADD CONSTRAINT bc_postulantes_bk_unique
    UNIQUE (id);
--
-- Definition for index id_alumno_foreignkey (OID = 277176892) : 
--
ALTER TABLE ONLY balimentacion.bc_postulantes_bk
    ADD CONSTRAINT id_alumno_foreignkey
    FOREIGN KEY (id_alumno) REFERENCES academico.alumnos(id_alumno);
--
-- Definition for index alm_programaciones_simulacion_pk_alm_prog (OID = 289739173) : 
--
SET search_path = academico, pg_catalog;
ALTER TABLE ONLY academico.alm_programaciones_simulacion
    ADD CONSTRAINT alm_programaciones_simulacion_pk_alm_prog
    PRIMARY KEY (id);
--
-- Definition for index foreign_key_alm_programaciones_alumnos (OID = 289739175) : 
--
ALTER TABLE ONLY academico.alm_programaciones_simulacion
    ADD CONSTRAINT foreign_key_alm_programaciones_alumnos
    FOREIGN KEY (id_alumno) REFERENCES alumnos(id_alumno);
--
-- Definition for index foreign_key_alm_programaciones_pln_materias (OID = 289739180) : 
--
ALTER TABLE ONLY academico.alm_programaciones_simulacion
    ADD CONSTRAINT foreign_key_alm_programaciones_pln_materias
    FOREIGN KEY (id_materia) REFERENCES pln_materias(id_materia);
--
-- Definition for index categoria_nombre_key (OID = 302661610) : 
--
SET search_path = calendario, pg_catalog;
ALTER TABLE ONLY calendario.categoria
    ADD CONSTRAINT categoria_nombre_key
    UNIQUE (nombre);
--
-- Definition for index _votos_2da_pkey (OID = 315377708) : 
--
SET search_path = elecciones, pg_catalog;
ALTER TABLE ONLY elecciones._votos_2da
    ADD CONSTRAINT _votos_2da_pkey
    PRIMARY KEY (id_voto);
--
-- Definition for index migrations_pkey (OID = 315386258) : 
--
SET search_path = conteo, pg_catalog;
ALTER TABLE ONLY conteo.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 315386269) : 
--
ALTER TABLE ONLY conteo.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_email_unique (OID = 315386271) : 
--
ALTER TABLE ONLY conteo.users
    ADD CONSTRAINT users_email_unique
    UNIQUE (email);
--
-- Definition for index failed_jobs_pkey (OID = 315386290) : 
--
ALTER TABLE ONLY conteo.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey
    PRIMARY KEY (id);
--
-- Definition for index failed_jobs_uuid_unique (OID = 315386292) : 
--
ALTER TABLE ONLY conteo.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique
    UNIQUE (uuid);
--
-- Definition for index personal_access_tokens_pkey (OID = 315386303) : 
--
ALTER TABLE ONLY conteo.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey
    PRIMARY KEY (id);
--
-- Definition for index personal_access_tokens_token_unique (OID = 315386306) : 
--
ALTER TABLE ONLY conteo.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique
    UNIQUE (token);
--
-- Definition for index mesas_pkey (OID = 315386315) : 
--
ALTER TABLE ONLY conteo.mesas
    ADD CONSTRAINT mesas_pkey
    PRIMARY KEY (id);
--
-- Definition for index candidatos_pkey (OID = 315386326) : 
--
ALTER TABLE ONLY conteo.candidatos
    ADD CONSTRAINT candidatos_pkey
    PRIMARY KEY (id);
--
-- Definition for index votos_pkey (OID = 315386334) : 
--
ALTER TABLE ONLY conteo.votos
    ADD CONSTRAINT votos_pkey
    PRIMARY KEY (id);
--
-- Definition for index dct_asignaciones_extra_pkey (OID = 343351848) : 
--
SET search_path = sis_directores, pg_catalog;
ALTER TABLE ONLY sis_directores.dct_asignaciones_extra
    ADD CONSTRAINT dct_asignaciones_extra_pkey
    PRIMARY KEY (id_dct_asignaciones);
--
-- Definition for index dct_asignaciones_extra_id_programa_id_materia_id_grupo_id_gesti (OID = 343351850) : 
--
ALTER TABLE ONLY sis_directores.dct_asignaciones_extra
    ADD CONSTRAINT dct_asignaciones_extra_id_programa_id_materia_id_grupo_id_gesti
    UNIQUE (id_programa, id_materia, id_grupo, id_gestion, id_periodo);
--
-- Definition for index foreign_key_dct_asignaciones_alm_programas (OID = 343351852) : 
--
ALTER TABLE ONLY sis_directores.dct_asignaciones_extra
    ADD CONSTRAINT foreign_key_dct_asignaciones_alm_programas
    FOREIGN KEY (id_programa) REFERENCES academico.alm_programas(id_programa);
--
-- Definition for index foreign_key_dct_asignaciones_docentes (OID = 343351857) : 
--
ALTER TABLE ONLY sis_directores.dct_asignaciones_extra
    ADD CONSTRAINT foreign_key_dct_asignaciones_docentes
    FOREIGN KEY (id_docente) REFERENCES academico.docentes(id_docente);
--
-- Definition for index foreign_key_dct_asignaciones_pln_materias (OID = 343351862) : 
--
ALTER TABLE ONLY sis_directores.dct_asignaciones_extra
    ADD CONSTRAINT foreign_key_dct_asignaciones_pln_materias
    FOREIGN KEY (id_materia) REFERENCES academico.pln_materias(id_materia);
--
-- Definition for index dir_dictamen_pkey (OID = 343352661) : 
--
ALTER TABLE ONLY sis_directores.dir_dictamen
    ADD CONSTRAINT dir_dictamen_pkey
    PRIMARY KEY (id_dictamen);
--
-- Definition for index valores_cargos_programas_idx (OID = 343368934) : 
--
SET search_path = matriculas, pg_catalog;
ALTER TABLE ONLY matriculas.valores_cargos_programas
    ADD CONSTRAINT valores_cargos_programas_idx
    UNIQUE (id_cargo, id_programa);
--
-- Definition for index dir_designaciones_dir_asignaciones_pkey (OID = 356306356) : 
--
SET search_path = sis_odiseo, pg_catalog;
ALTER TABLE ONLY sis_odiseo.dir_designaciones
    ADD CONSTRAINT dir_designaciones_dir_asignaciones_pkey
    PRIMARY KEY (id_asignacion);
--
-- Definition for index dct_asignaciones_extra_pkey (OID = 356334235) : 
--
ALTER TABLE ONLY sis_odiseo.dct_asignaciones_extra
    ADD CONSTRAINT dct_asignaciones_extra_pkey
    PRIMARY KEY (id_dct_asignaciones);
--
-- Definition for index foreign_key_dct_asignaciones_alm_programas (OID = 356334239) : 
--
ALTER TABLE ONLY sis_odiseo.dct_asignaciones_extra
    ADD CONSTRAINT foreign_key_dct_asignaciones_alm_programas
    FOREIGN KEY (id_programa) REFERENCES academico.alm_programas(id_programa);
--
-- Definition for index foreign_key_dct_asignaciones_docentes (OID = 356334244) : 
--
ALTER TABLE ONLY sis_odiseo.dct_asignaciones_extra
    ADD CONSTRAINT foreign_key_dct_asignaciones_docentes
    FOREIGN KEY (id_docente) REFERENCES academico.docentes(id_docente);
--
-- Definition for index foreign_key_dct_asignaciones_pln_materias (OID = 356334249) : 
--
ALTER TABLE ONLY sis_odiseo.dct_asignaciones_extra
    ADD CONSTRAINT foreign_key_dct_asignaciones_pln_materias
    FOREIGN KEY (id_materia) REFERENCES academico.pln_materias(id_materia);
--
-- Definition for index dct_asignaciones_extra_id_programa_id_materia_id_grupo_id_gesti (OID = 356350720) : 
--
ALTER TABLE ONLY sis_odiseo.dct_asignaciones_extra
    ADD CONSTRAINT dct_asignaciones_extra_id_programa_id_materia_id_grupo_id_gesti
    UNIQUE (id_programa, id_materia, id_grupo, id_gestion, id_periodo, id_docente);
--
-- Definition for index initial_pkey (OID = 369390687) : 
--
SET search_path = bot, pg_catalog;
ALTER TABLE ONLY bot.initial
    ADD CONSTRAINT initial_pkey
    PRIMARY KEY (id);
--
-- Definition for index response_pkey (OID = 369390698) : 
--
ALTER TABLE ONLY bot.response
    ADD CONSTRAINT response_pkey
    PRIMARY KEY (id);
--
-- Definition for index proyecto_investigacion_pkey (OID = 382814353) : 
--
SET search_path = becas, pg_catalog;
ALTER TABLE ONLY becas.becas_investigacion
    ADD CONSTRAINT proyecto_investigacion_pkey
    PRIMARY KEY (id_proyecto);
--
-- Definition for index proyecto_investigacion_id_estudiante_fkey (OID = 382814355) : 
--
ALTER TABLE ONLY becas.becas_investigacion
    ADD CONSTRAINT proyecto_investigacion_id_estudiante_fkey
    FOREIGN KEY (id_alumno) REFERENCES academico.alumnos(id_alumno);
--
-- Definition for index descriptions_califs_pkey (OID = 382838337) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.calificacion_detalles
    ADD CONSTRAINT descriptions_califs_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_descriptions_califs_parameter_calif_id_foreign (OID = 382838339) : 
--
ALTER TABLE ONLY balimentacion.calificacion_detalles
    ADD CONSTRAINT balimentacion_descriptions_califs_parameter_calif_id_foreign
    FOREIGN KEY (parameter_calif_id) REFERENCES calificacion_grupos(id);
--
-- Definition for index balimentacion_califs_description_calif_id_foreign (OID = 382838344) : 
--
ALTER TABLE ONLY balimentacion.califs
    ADD CONSTRAINT balimentacion_califs_description_calif_id_foreign
    FOREIGN KEY (description_calif_id) REFERENCES calificacion_detalles(id);
--
-- Definition for index planes_inf_primary_key_planes_id (OID = 382959826) : 
--
SET search_path = academico, pg_catalog;
ALTER TABLE ONLY academico.planes_inf
    ADD CONSTRAINT planes_inf_primary_key_planes_id
    PRIMARY KEY (id);
--
-- Definition for index foreign_key_planes_pln_materias_1 (OID = 382959828) : 
--
ALTER TABLE ONLY academico.planes_inf
    ADD CONSTRAINT foreign_key_planes_pln_materias_1
    FOREIGN KEY (id_materia) REFERENCES pln_materias(id_materia);
--
-- Definition for index investigacion_social_pkey (OID = 383062096) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.investigacion_social
    ADD CONSTRAINT investigacion_social_pkey
    PRIMARY KEY (id);
--
-- Definition for index manuals_pkey (OID = 383127352) : 
--
SET search_path = sis_odiseo, pg_catalog;
ALTER TABLE ONLY sis_odiseo.inf_manuals
    ADD CONSTRAINT manuals_pkey
    PRIMARY KEY (id);
--
-- Definition for index notificaciones_pkey (OID = 383127363) : 
--
ALTER TABLE ONLY sis_odiseo.inf_notificaciones
    ADD CONSTRAINT notificaciones_pkey
    PRIMARY KEY (id);
--
-- Definition for index procedimientos_pkey (OID = 383127375) : 
--
ALTER TABLE ONLY sis_odiseo.inf_procedimientos
    ADD CONSTRAINT procedimientos_pkey
    PRIMARY KEY (id);
--
-- Definition for index reglamentos_pkey (OID = 383127387) : 
--
ALTER TABLE ONLY sis_odiseo.inf_reglamentos
    ADD CONSTRAINT reglamentos_pkey
    PRIMARY KEY (id);
--
-- Definition for index migrations_pkey (OID = 383134210) : 
--
SET search_path = sis_heracles, pg_catalog;
ALTER TABLE ONLY sis_heracles.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 383158042) : 
--
ALTER TABLE ONLY sis_heracles.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_email_unique (OID = 383158044) : 
--
ALTER TABLE ONLY sis_heracles.users
    ADD CONSTRAINT users_email_unique
    UNIQUE (email);
--
-- Definition for index failed_jobs_pkey (OID = 383158063) : 
--
ALTER TABLE ONLY sis_heracles.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey
    PRIMARY KEY (id);
--
-- Definition for index failed_jobs_uuid_unique (OID = 383158065) : 
--
ALTER TABLE ONLY sis_heracles.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique
    UNIQUE (uuid);
--
-- Definition for index personal_access_tokens_pkey (OID = 383158076) : 
--
ALTER TABLE ONLY sis_heracles.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey
    PRIMARY KEY (id);
--
-- Definition for index personal_access_tokens_token_unique (OID = 383158079) : 
--
ALTER TABLE ONLY sis_heracles.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique
    UNIQUE (token);
--
-- Definition for index permissions_pkey (OID = 383158090) : 
--
ALTER TABLE ONLY sis_heracles.permissions
    ADD CONSTRAINT permissions_pkey
    PRIMARY KEY (id);
--
-- Definition for index permissions_name_guard_name_unique (OID = 383158092) : 
--
ALTER TABLE ONLY sis_heracles.permissions
    ADD CONSTRAINT permissions_name_guard_name_unique
    UNIQUE (name, guard_name);
--
-- Definition for index roles_pkey (OID = 383158103) : 
--
ALTER TABLE ONLY sis_heracles.roles
    ADD CONSTRAINT roles_pkey
    PRIMARY KEY (id);
--
-- Definition for index roles_name_guard_name_unique (OID = 383158105) : 
--
ALTER TABLE ONLY sis_heracles.roles
    ADD CONSTRAINT roles_name_guard_name_unique
    UNIQUE (name, guard_name);
--
-- Definition for index model_has_permissions_permission_id_foreign (OID = 383158111) : 
--
ALTER TABLE ONLY sis_heracles.model_has_permissions
    ADD CONSTRAINT model_has_permissions_permission_id_foreign
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
--
-- Definition for index model_has_permissions_pkey (OID = 383158116) : 
--
ALTER TABLE ONLY sis_heracles.model_has_permissions
    ADD CONSTRAINT model_has_permissions_pkey
    PRIMARY KEY (permission_id, model_id, model_type);
--
-- Definition for index model_has_roles_role_id_foreign (OID = 383158122) : 
--
ALTER TABLE ONLY sis_heracles.model_has_roles
    ADD CONSTRAINT model_has_roles_role_id_foreign
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
--
-- Definition for index model_has_roles_pkey (OID = 383158127) : 
--
ALTER TABLE ONLY sis_heracles.model_has_roles
    ADD CONSTRAINT model_has_roles_pkey
    PRIMARY KEY (role_id, model_id, model_type);
--
-- Definition for index role_has_permissions_permission_id_foreign (OID = 383158132) : 
--
ALTER TABLE ONLY sis_heracles.role_has_permissions
    ADD CONSTRAINT role_has_permissions_permission_id_foreign
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
--
-- Definition for index role_has_permissions_role_id_foreign (OID = 383158137) : 
--
ALTER TABLE ONLY sis_heracles.role_has_permissions
    ADD CONSTRAINT role_has_permissions_role_id_foreign
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
--
-- Definition for index role_has_permissions_pkey (OID = 383158142) : 
--
ALTER TABLE ONLY sis_heracles.role_has_permissions
    ADD CONSTRAINT role_has_permissions_pkey
    PRIMARY KEY (permission_id, role_id);
--
-- Definition for index users_pkey (OID = 383179122) : 
--
SET search_path = dar, pg_catalog;
ALTER TABLE ONLY dar.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_ci_unique (OID = 383179124) : 
--
ALTER TABLE ONLY dar.users
    ADD CONSTRAINT users_ci_unique
    UNIQUE (ci);
--
-- Definition for index users_email_unique (OID = 383179126) : 
--
ALTER TABLE ONLY dar.users
    ADD CONSTRAINT users_email_unique
    UNIQUE (email);
--
-- Definition for index archivo_planillas_pkey (OID = 383179266) : 
--
ALTER TABLE ONLY dar.archivo_planillas
    ADD CONSTRAINT archivo_planillas_pkey
    PRIMARY KEY (id);
--
-- Definition for index roles_pkey (OID = 383180139) : 
--
ALTER TABLE ONLY dar.roles
    ADD CONSTRAINT roles_pkey
    PRIMARY KEY (id);
--
-- Definition for index role_user_pkey (OID = 383180147) : 
--
ALTER TABLE ONLY dar.role_user
    ADD CONSTRAINT role_user_pkey
    PRIMARY KEY (id);
--
-- Definition for index bc_items_becas_id_programa_tipo_post_id_gestion_key (OID = 383191931) : 
--
SET search_path = balimentacion, pg_catalog;
ALTER TABLE ONLY balimentacion.bc_items_becas
    ADD CONSTRAINT bc_items_becas_id_programa_tipo_post_id_gestion_key
    UNIQUE (id_programa, tipo_post, id_gestion, _estado, convocatoria);
--
-- Definition for index investigacion_social_2_pkey (OID = 396749219) : 
--
ALTER TABLE ONLY balimentacion.investigacion_social_2
    ADD CONSTRAINT investigacion_social_2_pkey
    PRIMARY KEY (id);
--
-- Definition for index balimentacion_exceptional_conv_bc_items_becas_id_foreign (OID = 396950118) : 
--
ALTER TABLE ONLY balimentacion.exceptional_conv
    ADD CONSTRAINT balimentacion_exceptional_conv_bc_items_becas_id_foreign
    FOREIGN KEY (details_id) REFERENCES bc_items_becas(id);
--
-- Definition for index usuarios_pkey (OID = 396955082) : 
--
SET search_path = dar, pg_catalog;
ALTER TABLE ONLY dar.usuarios
    ADD CONSTRAINT usuarios_pkey
    PRIMARY KEY (id);
--
-- Definition for index dar_documentos_documentos_pkey (OID = 396955098) : 
--
ALTER TABLE ONLY dar.dar_documentos
    ADD CONSTRAINT dar_documentos_documentos_pkey
    PRIMARY KEY (id_documento);
--
-- Definition for index dar_documentos_fk_ult_usuario (OID = 396955100) : 
--
ALTER TABLE ONLY dar.dar_documentos
    ADD CONSTRAINT dar_documentos_fk_ult_usuario
    FOREIGN KEY (id_ultimo_us) REFERENCES usuarios(id);
--
-- Definition for index dar_documentos_fk_usuario (OID = 396955105) : 
--
ALTER TABLE ONLY dar.dar_documentos
    ADD CONSTRAINT dar_documentos_fk_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id);
--
-- Definition for index dar_libros_pkey (OID = 396955119) : 
--
ALTER TABLE ONLY dar.dar_libros
    ADD CONSTRAINT dar_libros_pkey
    PRIMARY KEY (id_registro);
--
-- Definition for index foreign_key_dar_libros_dar_documentos (OID = 396955121) : 
--
ALTER TABLE ONLY dar.dar_libros
    ADD CONSTRAINT foreign_key_dar_libros_dar_documentos
    FOREIGN KEY (id_documento) REFERENCES dar_documentos(id_documento);
--
-- Definition for index foreign_key_dar_libros_usuarios (OID = 396955126) : 
--
ALTER TABLE ONLY dar.dar_libros
    ADD CONSTRAINT foreign_key_dar_libros_usuarios
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id);
--
-- Definition for index migrations_pkey (OID = 397002580) : 
--
SET search_path = psa, pg_catalog;
ALTER TABLE ONLY psa.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 397002591) : 
--
ALTER TABLE ONLY psa.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_email_unique (OID = 397002593) : 
--
ALTER TABLE ONLY psa.users
    ADD CONSTRAINT users_email_unique
    UNIQUE (email);
--
-- Definition for index password_reset_tokens_pkey (OID = 397002601) : 
--
ALTER TABLE ONLY psa.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey
    PRIMARY KEY (email);
--
-- Definition for index failed_jobs_pkey (OID = 397002613) : 
--
ALTER TABLE ONLY psa.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey
    PRIMARY KEY (id);
--
-- Definition for index failed_jobs_uuid_unique (OID = 397002615) : 
--
ALTER TABLE ONLY psa.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique
    UNIQUE (uuid);
--
-- Definition for index personal_access_tokens_pkey (OID = 397002626) : 
--
ALTER TABLE ONLY psa.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey
    PRIMARY KEY (id);
--
-- Definition for index personal_access_tokens_token_unique (OID = 397002629) : 
--
ALTER TABLE ONLY psa.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique
    UNIQUE (token);
--
-- Definition for index failed_jobs_pkey (OID = 425348801) : 
--
SET search_path = actas_graduacion, pg_catalog;
ALTER TABLE ONLY actas_graduacion.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey
    PRIMARY KEY (id);
--
-- Definition for index migrations_pkey (OID = 425348809) : 
--
ALTER TABLE ONLY actas_graduacion.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 425348847) : 
--
ALTER TABLE ONLY actas_graduacion.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_usuario_key (OID = 425348849) : 
--
ALTER TABLE ONLY actas_graduacion.users
    ADD CONSTRAINT users_usuario_key
    UNIQUE (usuario);
--
-- Definition for index roles_pkey (OID = 425348873) : 
--
ALTER TABLE ONLY actas_graduacion.roles
    ADD CONSTRAINT roles_pkey
    PRIMARY KEY (id);
--
-- Definition for index roles_name_guard_name_key (OID = 425348875) : 
--
ALTER TABLE ONLY actas_graduacion.roles
    ADD CONSTRAINT roles_name_guard_name_key
    UNIQUE (name, guard_name);
--
-- Definition for index password_resets_pkey (OID = 425348883) : 
--
ALTER TABLE ONLY actas_graduacion.password_resets
    ADD CONSTRAINT password_resets_pkey
    PRIMARY KEY (email);
--
-- Definition for index password_reset_tokens_pkey (OID = 425348891) : 
--
ALTER TABLE ONLY actas_graduacion.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey
    PRIMARY KEY (email);
--
-- Definition for index permissions_pkey (OID = 425348902) : 
--
ALTER TABLE ONLY actas_graduacion.permissions
    ADD CONSTRAINT permissions_pkey
    PRIMARY KEY (id);
--
-- Definition for index permissions_name_guard_name_key (OID = 425348904) : 
--
ALTER TABLE ONLY actas_graduacion.permissions
    ADD CONSTRAINT permissions_name_guard_name_key
    UNIQUE (name, guard_name);
--
-- Definition for index role_has_permissions_pkey (OID = 425348922) : 
--
ALTER TABLE ONLY actas_graduacion.role_has_permissions
    ADD CONSTRAINT role_has_permissions_pkey
    PRIMARY KEY (permission_id, role_id);
--
-- Definition for index fk_permission_id (OID = 425348924) : 
--
ALTER TABLE ONLY actas_graduacion.role_has_permissions
    ADD CONSTRAINT fk_permission_id
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
--
-- Definition for index fk_role_id (OID = 425348929) : 
--
ALTER TABLE ONLY actas_graduacion.role_has_permissions
    ADD CONSTRAINT fk_role_id
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
--
-- Definition for index model_has_roles_pkey (OID = 425348937) : 
--
ALTER TABLE ONLY actas_graduacion.model_has_roles
    ADD CONSTRAINT model_has_roles_pkey
    PRIMARY KEY (role_id, model_id, model_type);
--
-- Definition for index fk_role_id (OID = 425348939) : 
--
ALTER TABLE ONLY actas_graduacion.model_has_roles
    ADD CONSTRAINT fk_role_id
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
--
-- Definition for index model_has_permissions_pkey (OID = 425348947) : 
--
ALTER TABLE ONLY actas_graduacion.model_has_permissions
    ADD CONSTRAINT model_has_permissions_pkey
    PRIMARY KEY (permission_id, model_id, model_type);
--
-- Definition for index fk_permission_id (OID = 425348949) : 
--
ALTER TABLE ONLY actas_graduacion.model_has_permissions
    ADD CONSTRAINT fk_permission_id
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
--
-- Definition for index personal_access_tokens_pkey (OID = 425348991) : 
--
ALTER TABLE ONLY actas_graduacion.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey
    PRIMARY KEY (id);
--
-- Definition for index personal_access_tokens_token_key (OID = 425348993) : 
--
ALTER TABLE ONLY actas_graduacion.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_key
    UNIQUE (token);
--
-- Definition for index fk_tokenable (OID = 425348995) : 
--
ALTER TABLE ONLY actas_graduacion.personal_access_tokens
    ADD CONSTRAINT fk_tokenable
    FOREIGN KEY (tokenable_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- Definition for index modalidad_graduacion_pkey (OID = 425349152) : 
--
ALTER TABLE ONLY actas_graduacion.modalidad_graduacion
    ADD CONSTRAINT modalidad_graduacion_pkey
    PRIMARY KEY (id);
--
-- Definition for index secretarias_pkey (OID = 425349205) : 
--
ALTER TABLE ONLY actas_graduacion.secretarias
    ADD CONSTRAINT secretarias_pkey
    PRIMARY KEY (id);
--
-- Definition for index secretarias_id_usuario_fkey (OID = 425349207) : 
--
ALTER TABLE ONLY actas_graduacion.secretarias
    ADD CONSTRAINT secretarias_id_usuario_fkey
    FOREIGN KEY (id_usuario) REFERENCES users(id);
--
-- Definition for index secretarias_id_facultad_fkey (OID = 425349212) : 
--
ALTER TABLE ONLY actas_graduacion.secretarias
    ADD CONSTRAINT secretarias_id_facultad_fkey
    FOREIGN KEY (id_facultad) REFERENCES academico.alm_programas_facultades(id_facultad);
--
-- Definition for index decanos_pkey (OID = 425349921) : 
--
ALTER TABLE ONLY actas_graduacion.decanos
    ADD CONSTRAINT decanos_pkey
    PRIMARY KEY (id);
--
-- Definition for index decanos_id_docente_fkey (OID = 425349923) : 
--
ALTER TABLE ONLY actas_graduacion.decanos
    ADD CONSTRAINT decanos_id_docente_fkey
    FOREIGN KEY (id_docente) REFERENCES academico.docentes(id_docente);
--
-- Definition for index decanos_id_facultad_fkey (OID = 425349928) : 
--
ALTER TABLE ONLY actas_graduacion.decanos
    ADD CONSTRAINT decanos_id_facultad_fkey
    FOREIGN KEY (id_facultad) REFERENCES academico.alm_programas_facultades(id_facultad);
--
-- Definition for index asignar_tipos_defensa_carrera_pkey (OID = 425349995) : 
--
ALTER TABLE ONLY actas_graduacion.asignar_tipos_defensa_carrera
    ADD CONSTRAINT asignar_tipos_defensa_carrera_pkey
    PRIMARY KEY (id);
--
-- Definition for index asignar_tipos_defensa_carrera_id_modalidad_fkey (OID = 425349997) : 
--
ALTER TABLE ONLY actas_graduacion.asignar_tipos_defensa_carrera
    ADD CONSTRAINT asignar_tipos_defensa_carrera_id_modalidad_fkey
    FOREIGN KEY (id_modalidad) REFERENCES modalidad_graduacion(id);
--
-- Definition for index docentes_actas_id_tribunal_key (OID = 440232109) : 
--
ALTER TABLE ONLY actas_graduacion.docentes_actas
    ADD CONSTRAINT docentes_actas_id_tribunal_key
    UNIQUE (id_tribunal);
--
-- Definition for index soa_id_key (OID = 440260118) : 
--
SET search_path = calendario, pg_catalog;
ALTER TABLE ONLY calendario.soa
    ADD CONSTRAINT soa_id_key
    UNIQUE (id);
--
-- Definition for index tipo_calendario_pkey (OID = 440260145) : 
--
ALTER TABLE ONLY calendario.tipo_calendario
    ADD CONSTRAINT tipo_calendario_pkey
    PRIMARY KEY (id);
--
-- Definition for index soa_fk (OID = 440260202) : 
--
ALTER TABLE ONLY calendario.soa
    ADD CONSTRAINT soa_fk
    FOREIGN KEY (id_tipo_calendario) REFERENCES tipo_calendario(id);
--
-- Definition for index asignaciones_pkey (OID = 440303837) : 
--
SET search_path = designaciones, pg_catalog;
ALTER TABLE ONLY designaciones.asignaciones
    ADD CONSTRAINT asignaciones_pkey
    PRIMARY KEY (id);
--
-- Definition for index asignaciones_detalles_fk (OID = 440303840) : 
--
ALTER TABLE ONLY designaciones.asignaciones_detalles
    ADD CONSTRAINT asignaciones_detalles_fk
    FOREIGN KEY (id_asignaciones) REFERENCES asignaciones(id);
--
-- Definition for index audits_pkey (OID = 440580464) : 
--
SET search_path = actas_graduacion, pg_catalog;
ALTER TABLE ONLY actas_graduacion.audits
    ADD CONSTRAINT audits_pkey
    PRIMARY KEY (id);
--
-- Definition for index migrations_pkey (OID = 441583660) : 
--
SET search_path = b_investigacion, pg_catalog;
ALTER TABLE ONLY b_investigacion.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 441583853) : 
--
ALTER TABLE ONLY b_investigacion.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_ci_unique (OID = 441583855) : 
--
ALTER TABLE ONLY b_investigacion.users
    ADD CONSTRAINT users_ci_unique
    UNIQUE (ci);
--
-- Definition for index users_username_unique (OID = 441583857) : 
--
ALTER TABLE ONLY b_investigacion.users
    ADD CONSTRAINT users_username_unique
    UNIQUE (username);
--
-- Definition for index users_email_unique (OID = 441583859) : 
--
ALTER TABLE ONLY b_investigacion.users
    ADD CONSTRAINT users_email_unique
    UNIQUE (email);
--
-- Definition for index password_reset_tokens_pkey (OID = 441583867) : 
--
ALTER TABLE ONLY b_investigacion.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey
    PRIMARY KEY (email);
--
-- Definition for index sessions_pkey (OID = 441583875) : 
--
ALTER TABLE ONLY b_investigacion.sessions
    ADD CONSTRAINT sessions_pkey
    PRIMARY KEY (id);
--
-- Definition for index cache_pkey (OID = 441583885) : 
--
ALTER TABLE ONLY b_investigacion.cache
    ADD CONSTRAINT cache_pkey
    PRIMARY KEY (key);
--
-- Definition for index cache_locks_pkey (OID = 441583893) : 
--
ALTER TABLE ONLY b_investigacion.cache_locks
    ADD CONSTRAINT cache_locks_pkey
    PRIMARY KEY (key);
--
-- Definition for index jobs_pkey (OID = 441583904) : 
--
ALTER TABLE ONLY b_investigacion.jobs
    ADD CONSTRAINT jobs_pkey
    PRIMARY KEY (id);
--
-- Definition for index job_batches_pkey (OID = 441583913) : 
--
ALTER TABLE ONLY b_investigacion.job_batches
    ADD CONSTRAINT job_batches_pkey
    PRIMARY KEY (id);
--
-- Definition for index failed_jobs_pkey (OID = 441583925) : 
--
ALTER TABLE ONLY b_investigacion.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey
    PRIMARY KEY (id);
--
-- Definition for index failed_jobs_uuid_unique (OID = 441583927) : 
--
ALTER TABLE ONLY b_investigacion.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique
    UNIQUE (uuid);
--
-- Definition for index permissions_pkey (OID = 441583938) : 
--
ALTER TABLE ONLY b_investigacion.permissions
    ADD CONSTRAINT permissions_pkey
    PRIMARY KEY (id);
--
-- Definition for index permissions_name_guard_name_unique (OID = 441583940) : 
--
ALTER TABLE ONLY b_investigacion.permissions
    ADD CONSTRAINT permissions_name_guard_name_unique
    UNIQUE (name, guard_name);
--
-- Definition for index roles_pkey (OID = 441583951) : 
--
ALTER TABLE ONLY b_investigacion.roles
    ADD CONSTRAINT roles_pkey
    PRIMARY KEY (id);
--
-- Definition for index roles_name_guard_name_unique (OID = 441583953) : 
--
ALTER TABLE ONLY b_investigacion.roles
    ADD CONSTRAINT roles_name_guard_name_unique
    UNIQUE (name, guard_name);
--
-- Definition for index model_has_permissions_permission_id_foreign (OID = 441583959) : 
--
ALTER TABLE ONLY b_investigacion.model_has_permissions
    ADD CONSTRAINT model_has_permissions_permission_id_foreign
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
--
-- Definition for index model_has_permissions_pkey (OID = 441583964) : 
--
ALTER TABLE ONLY b_investigacion.model_has_permissions
    ADD CONSTRAINT model_has_permissions_pkey
    PRIMARY KEY (permission_id, model_id, model_type);
--
-- Definition for index model_has_roles_role_id_foreign (OID = 441583970) : 
--
ALTER TABLE ONLY b_investigacion.model_has_roles
    ADD CONSTRAINT model_has_roles_role_id_foreign
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
--
-- Definition for index model_has_roles_pkey (OID = 441583975) : 
--
ALTER TABLE ONLY b_investigacion.model_has_roles
    ADD CONSTRAINT model_has_roles_pkey
    PRIMARY KEY (role_id, model_id, model_type);
--
-- Definition for index role_has_permissions_permission_id_foreign (OID = 441583980) : 
--
ALTER TABLE ONLY b_investigacion.role_has_permissions
    ADD CONSTRAINT role_has_permissions_permission_id_foreign
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
--
-- Definition for index role_has_permissions_role_id_foreign (OID = 441583985) : 
--
ALTER TABLE ONLY b_investigacion.role_has_permissions
    ADD CONSTRAINT role_has_permissions_role_id_foreign
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
--
-- Definition for index role_has_permissions_pkey (OID = 441583990) : 
--
ALTER TABLE ONLY b_investigacion.role_has_permissions
    ADD CONSTRAINT role_has_permissions_pkey
    PRIMARY KEY (permission_id, role_id);
--
-- Definition for index users_pkey (OID = 441584235) : 
--
SET search_path = estudiantes, pg_catalog;
ALTER TABLE ONLY estudiantes.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index tipo_rol_pkey (OID = 441584245) : 
--
ALTER TABLE ONLY estudiantes.tipo_rol
    ADD CONSTRAINT tipo_rol_pkey
    PRIMARY KEY (id);
--
-- Definition for index id_tipo_rol (OID = 441584247) : 
--
ALTER TABLE ONLY estudiantes.tipo_rol
    ADD CONSTRAINT id_tipo_rol
    FOREIGN KEY (id_usuario) REFERENCES users(id);
--
-- Definition for index roles_pkey (OID = 441584260) : 
--
ALTER TABLE ONLY estudiantes.roles
    ADD CONSTRAINT roles_pkey
    PRIMARY KEY (id);
--
-- Definition for index roles_name_unique (OID = 441584262) : 
--
ALTER TABLE ONLY estudiantes.roles
    ADD CONSTRAINT roles_name_unique
    UNIQUE (name);
--
-- Definition for index id_roles (OID = 441584264) : 
--
ALTER TABLE ONLY estudiantes.roles
    ADD CONSTRAINT id_roles
    FOREIGN KEY (id_tipo) REFERENCES tipo_rol(id);
--
-- Definition for index id_user_rol (OID = 441584269) : 
--
ALTER TABLE ONLY estudiantes.roles
    ADD CONSTRAINT id_user_rol
    FOREIGN KEY (id_usuario) REFERENCES users(id);
--
-- Definition for index assigned_roles_pkey (OID = 441584282) : 
--
ALTER TABLE ONLY estudiantes.assigned_roles
    ADD CONSTRAINT assigned_roles_pkey
    PRIMARY KEY (id);
--
-- Definition for index assigned_roles_role_id_foreign (OID = 441584284) : 
--
ALTER TABLE ONLY estudiantes.assigned_roles
    ADD CONSTRAINT assigned_roles_role_id_foreign
    FOREIGN KEY (role_id) REFERENCES roles(id);
--
-- Definition for index assigned_roles_user_id_foreign (OID = 441584289) : 
--
ALTER TABLE ONLY estudiantes.assigned_roles
    ADD CONSTRAINT assigned_roles_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index decretos_pkey (OID = 441610880) : 
--
SET search_path = actas_graduacion, pg_catalog;
ALTER TABLE ONLY actas_graduacion.decretos
    ADD CONSTRAINT decretos_pkey
    PRIMARY KEY (id);
--
-- Definition for index seguimiento_decretos_pkey (OID = 441617921) : 
--
ALTER TABLE ONLY actas_graduacion.seguimiento_decretos
    ADD CONSTRAINT seguimiento_decretos_pkey
    PRIMARY KEY (id);
--
-- Definition for index categorias_pkey (OID = 441815493) : 
--
SET search_path = cronograma, pg_catalog;
ALTER TABLE ONLY cronograma.categorias
    ADD CONSTRAINT categorias_pkey
    PRIMARY KEY (id_categoria);
--
-- Definition for index actividades_pkey (OID = 441815518) : 
--
ALTER TABLE ONLY cronograma.actividades
    ADD CONSTRAINT actividades_pkey
    PRIMARY KEY (id_actividad);
--
-- Definition for index pln_materias_resplado1_new_pln_materias_ (OID = 442381073) : 
--
SET search_path = academico, pg_catalog;
ALTER TABLE ONLY academico.pln_materias_resplado
    ADD CONSTRAINT pln_materias_resplado1_new_pln_materias_
    PRIMARY KEY (id_materia);
--
-- Definition for index tipos_trabajo_pkey (OID = 442402539) : 
--
SET search_path = saber, pg_catalog;
ALTER TABLE ONLY saber.tipos_trabajo
    ADD CONSTRAINT tipos_trabajo_pkey
    PRIMARY KEY (id);
--
-- Definition for index trabajos_pkey (OID = 442403049) : 
--
ALTER TABLE ONLY saber.trabajos
    ADD CONSTRAINT trabajos_pkey
    PRIMARY KEY (id);
--
-- Definition for index sessions_pkey (OID = 442403272) : 
--
ALTER TABLE ONLY saber.sessions
    ADD CONSTRAINT sessions_pkey
    PRIMARY KEY (id);
--
-- Definition for index auditorias_pkey (OID = 442403369) : 
--
ALTER TABLE ONLY saber.auditorias
    ADD CONSTRAINT auditorias_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 442403445) : 
--
ALTER TABLE ONLY saber.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id, ru);
--
-- Definition for index migrations_pkey (OID = 442453528) : 
--
ALTER TABLE ONLY saber.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index observaciones_pkey (OID = 442453545) : 
--
ALTER TABLE ONLY saber.observaciones
    ADD CONSTRAINT observaciones_pkey
    PRIMARY KEY (id);
--
-- Definition for index observaciones_trabajo_id_foreign (OID = 442453547) : 
--
ALTER TABLE ONLY saber.observaciones
    ADD CONSTRAINT observaciones_trabajo_id_foreign
    FOREIGN KEY (trabajo_id) REFERENCES trabajos(id) ON DELETE CASCADE;
--
-- Definition for index grupo_modalidad_pkey (OID = 442553907) : 
--
SET search_path = academico, pg_catalog;
ALTER TABLE ONLY academico.grupo_modalidad
    ADD CONSTRAINT grupo_modalidad_pkey
    PRIMARY KEY (id_grupo_modalidad);
--
-- Definition for index auditorias_administracion_pkey (OID = 442565587) : 
--
SET search_path = saber, pg_catalog;
ALTER TABLE ONLY saber.auditorias_administracion
    ADD CONSTRAINT auditorias_administracion_pkey
    PRIMARY KEY (id);
--
-- Definition for index configuraciones_sistema_pkey (OID = 442565589) : 
--
ALTER TABLE ONLY saber.configuraciones_sistema
    ADD CONSTRAINT configuraciones_sistema_pkey
    PRIMARY KEY (id);
--
-- Definition for index configuraciones_sistema_clave_unique (OID = 442565601) : 
--
ALTER TABLE ONLY saber.configuraciones_sistema
    ADD CONSTRAINT configuraciones_sistema_clave_unique
    UNIQUE (clave);
--
-- Definition for index facultades_pkey (OID = 442579825) : 
--
ALTER TABLE ONLY saber.facultades
    ADD CONSTRAINT facultades_pkey
    PRIMARY KEY (id);
--
-- Definition for index facultades_nombre_key (OID = 442579827) : 
--
ALTER TABLE ONLY saber.facultades
    ADD CONSTRAINT facultades_nombre_key
    UNIQUE (nombre);
--
-- Definition for index carreras_pkey (OID = 442579836) : 
--
ALTER TABLE ONLY saber.carreras
    ADD CONSTRAINT carreras_pkey
    PRIMARY KEY (id);
--
-- Definition for index carreras_facultad_nombre_unique (OID = 442579838) : 
--
ALTER TABLE ONLY saber.carreras
    ADD CONSTRAINT carreras_facultad_nombre_unique
    UNIQUE (facultad_id, nombre);
--
-- Definition for index carreras_facultad_id_fkey (OID = 442579840) : 
--
ALTER TABLE ONLY saber.carreras
    ADD CONSTRAINT carreras_facultad_id_fkey
    FOREIGN KEY (facultad_id) REFERENCES facultades(id) ON DELETE SET NULL;
--
-- Definition for index migrations_pkey (OID = 442580156) : 
--
SET search_path = laboratorio, pg_catalog;
ALTER TABLE ONLY laboratorio.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_pkey (OID = 442580169) : 
--
ALTER TABLE ONLY laboratorio.users
    ADD CONSTRAINT users_pkey
    PRIMARY KEY (id);
--
-- Definition for index laboratorio_users_username_unique (OID = 442580173) : 
--
ALTER TABLE ONLY laboratorio.users
    ADD CONSTRAINT laboratorio_users_username_unique
    UNIQUE (username);
--
-- Definition for index roles_pkey (OID = 442580184) : 
--
ALTER TABLE ONLY laboratorio.roles
    ADD CONSTRAINT roles_pkey
    PRIMARY KEY (id);
--
-- Definition for index laboratorio_roles_name_unique (OID = 442580186) : 
--
ALTER TABLE ONLY laboratorio.roles
    ADD CONSTRAINT laboratorio_roles_name_unique
    UNIQUE (name);
--
-- Definition for index user_roles_pkey (OID = 442580194) : 
--
ALTER TABLE ONLY laboratorio.user_roles
    ADD CONSTRAINT user_roles_pkey
    PRIMARY KEY (id);
--
-- Definition for index laboratorio_user_roles_user_id_role_id_unique (OID = 442580196) : 
--
ALTER TABLE ONLY laboratorio.user_roles
    ADD CONSTRAINT laboratorio_user_roles_user_id_role_id_unique
    UNIQUE (user_id, role_id);
--
-- Definition for index laboratorio_user_roles_user_id_foreign (OID = 442580198) : 
--
ALTER TABLE ONLY laboratorio.user_roles
    ADD CONSTRAINT laboratorio_user_roles_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- Definition for index laboratorio_user_roles_role_id_foreign (OID = 442580203) : 
--
ALTER TABLE ONLY laboratorio.user_roles
    ADD CONSTRAINT laboratorio_user_roles_role_id_foreign
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
--
-- Definition for index sessions_pkey (OID = 442580214) : 
--
ALTER TABLE ONLY laboratorio.sessions
    ADD CONSTRAINT sessions_pkey
    PRIMARY KEY (id);
--
-- Definition for index cache_pkey (OID = 442580224) : 
--
ALTER TABLE ONLY laboratorio.cache
    ADD CONSTRAINT cache_pkey
    PRIMARY KEY (key);
--
-- Definition for index cache_locks_pkey (OID = 442580232) : 
--
ALTER TABLE ONLY laboratorio.cache_locks
    ADD CONSTRAINT cache_locks_pkey
    PRIMARY KEY (key);
--
-- Definition for index _bp_estados_civiles_pkey (OID = 468050411) : 
--
SET search_path = public, pg_catalog;
ALTER TABLE ONLY public._bp_estados_civiles
    ADD CONSTRAINT _bp_estados_civiles_pkey
    PRIMARY KEY (id_estado_civil);
--
-- Definition for index prs_calificacion_pkey (OID = 468050444) : 
--
ALTER TABLE ONLY public.prs_calificacion
    ADD CONSTRAINT prs_calificacion_pkey
    PRIMARY KEY (id_calificacion);
--
-- Definition for index _bp_photos_id_alumno_key (OID = 481047331) : 
--
ALTER TABLE ONLY public._bp_photos
    ADD CONSTRAINT _bp_photos_id_alumno_key
    UNIQUE (id_alumno);
--
-- Definition for index _bp_photos_pkey (OID = 481047333) : 
--
ALTER TABLE ONLY public._bp_photos
    ADD CONSTRAINT _bp_photos_pkey
    PRIMARY KEY (id_photo);
--
-- Definition for index _bp_relaciones_pkey (OID = 481047335) : 
--
ALTER TABLE ONLY public._bp_relaciones
    ADD CONSTRAINT _bp_relaciones_pkey
    PRIMARY KEY (id_relacion);
--
-- Definition for index administrador_pkey (OID = 481047337) : 
--
ALTER TABLE ONLY public.administrador
    ADD CONSTRAINT administrador_pkey
    PRIMARY KEY (id_administrador);
--
-- Definition for index alm_cursos_pkey (OID = 481047339) : 
--
ALTER TABLE ONLY public.alm_cursos
    ADD CONSTRAINT alm_cursos_pkey
    PRIMARY KEY (id_curso);
--
-- Definition for index alm_modalidad_pkey (OID = 481047341) : 
--
ALTER TABLE ONLY public.alm_modalidad
    ADD CONSTRAINT alm_modalidad_pkey
    PRIMARY KEY (id);
--
-- Definition for index alm_programas_grados_pkey (OID = 481047343) : 
--
ALTER TABLE ONLY public.alm_programas_grados
    ADD CONSTRAINT alm_programas_grados_pkey
    PRIMARY KEY (id_grado);
--
-- Definition for index alm_programas_ingreso_id_programa_id_gestion_id_periodo_id__key (OID = 481047345) : 
--
ALTER TABLE ONLY public.alm_programas_ingreso
    ADD CONSTRAINT alm_programas_ingreso_id_programa_id_gestion_id_periodo_id__key
    UNIQUE (id_programa, id_gestion, id_periodo, id_examen);
--
-- Definition for index alm_programas_postgrado_pkey (OID = 481047347) : 
--
ALTER TABLE ONLY public.alm_programas_postgrado
    ADD CONSTRAINT alm_programas_postgrado_pkey
    PRIMARY KEY (id_postgrado);
--
-- Definition for index apoderado_nro_dip_clave_key (OID = 481047349) : 
--
ALTER TABLE ONLY public.apoderado
    ADD CONSTRAINT apoderado_nro_dip_clave_key
    UNIQUE (nro_dip, clave);
--
-- Definition for index apoderado_pkey (OID = 481047351) : 
--
ALTER TABLE ONLY public.apoderado
    ADD CONSTRAINT apoderado_pkey
    PRIMARY KEY (ida);
--
-- Definition for index cajas_transacciones_pkey (OID = 481047353) : 
--
ALTER TABLE ONLY public.cajas_transacciones
    ADD CONSTRAINT cajas_transacciones_pkey
    PRIMARY KEY (id_transaccion);
--
-- Definition for index colegio_carrera_materia_pkey (OID = 481047355) : 
--
ALTER TABLE ONLY public.colegio_carrera_materia
    ADD CONSTRAINT colegio_carrera_materia_pkey
    PRIMARY KEY (id);
--
-- Definition for index colegio_nota_pkey (OID = 481047357) : 
--
ALTER TABLE ONLY public.colegio_nota
    ADD CONSTRAINT colegio_nota_pkey
    PRIMARY KEY (id);
--
-- Definition for index comissions_pkey (OID = 481047359) : 
--
ALTER TABLE ONLY public.comisiones
    ADD CONSTRAINT comissions_pkey
    PRIMARY KEY (id);
--
-- Definition for index cuentas_bancarias_pkey (OID = 481047361) : 
--
ALTER TABLE ONLY public.cuentas_bancarias
    ADD CONSTRAINT cuentas_bancarias_pkey
    PRIMARY KEY (id);
--
-- Definition for index dar_tramites_nro_dip_id_alumno_tipo_tramite_desc_tramite__d_key (OID = 481047363) : 
--
ALTER TABLE ONLY public.dar_tramites
    ADD CONSTRAINT dar_tramites_nro_dip_id_alumno_tipo_tramite_desc_tramite__d_key
    UNIQUE (nro_dip, id_alumno, tipo_tramite, desc_tramite, fecha, _dtunique);
--
-- Definition for index dar_tramites_pkey (OID = 481047365) : 
--
ALTER TABLE ONLY public.dar_tramites
    ADD CONSTRAINT dar_tramites_pkey
    PRIMARY KEY (id_tramite);
--
-- Definition for index data_notificaciones_id_key (OID = 481047367) : 
--
ALTER TABLE ONLY public.data_notificaciones
    ADD CONSTRAINT data_notificaciones_id_key
    UNIQUE (id);
--
-- Definition for index dct_horarios_pkey (OID = 481047369) : 
--
ALTER TABLE ONLY public.dct_horarios
    ADD CONSTRAINT dct_horarios_pkey
    PRIMARY KEY (id_horario);
--
-- Definition for index dicts_comisiones_pkey (OID = 481047371) : 
--
ALTER TABLE ONLY public.miembros
    ADD CONSTRAINT dicts_comisiones_pkey
    PRIMARY KEY (id);
--
-- Definition for index dictums_pkey (OID = 481047373) : 
--
ALTER TABLE ONLY public.dictums
    ADD CONSTRAINT dictums_pkey
    PRIMARY KEY (id);
--
-- Definition for index e_tipo_tramites_pkey (OID = 481047375) : 
--
ALTER TABLE ONLY public.e_tipo_tramites
    ADD CONSTRAINT e_tipo_tramites_pkey
    PRIMARY KEY (id_tipo_tramite);
--
-- Definition for index estructura_programa_pkey (OID = 481047377) : 
--
ALTER TABLE ONLY public.estructura_programa
    ADD CONSTRAINT estructura_programa_pkey
    PRIMARY KEY (id_est_prg);
--
-- Definition for index ex_dir_pkey (OID = 481047379) : 
--
ALTER TABLE ONLY public.ex_dir
    ADD CONSTRAINT ex_dir_pkey
    PRIMARY KEY (id);
--
-- Definition for index gestion_periodo_directores_pkey (OID = 481047381) : 
--
ALTER TABLE ONLY public.gestion_periodo_directores
    ADD CONSTRAINT gestion_periodo_directores_pkey
    PRIMARY KEY (id_programa);
--
-- Definition for index gestion_pkey (OID = 481047383) : 
--
ALTER TABLE ONLY public.gestion_periodo
    ADD CONSTRAINT gestion_pkey
    PRIMARY KEY (gestion, periodo, tipo, tipo_sistema);
--
-- Definition for index id_cambio (OID = 481047385) : 
--
ALTER TABLE ONLY public.dar_cambios_carrera
    ADD CONSTRAINT id_cambio
    PRIMARY KEY (id_cambio);
--
-- Definition for index id_deuda (OID = 481047387) : 
--
ALTER TABLE ONLY public.deudas_solvencia
    ADD CONSTRAINT id_deuda
    PRIMARY KEY (id_deuda);
--
-- Definition for index id_readmision (OID = 481047389) : 
--
ALTER TABLE ONLY public.dar_readmisiones
    ADD CONSTRAINT id_readmision
    PRIMARY KEY (id_readmision);
--
-- Definition for index id_sis (OID = 481047391) : 
--
ALTER TABLE ONLY public.dar_sis_activacion
    ADD CONSTRAINT id_sis
    PRIMARY KEY (id_sis);
--
-- Definition for index id_solvencia (OID = 481047393) : 
--
ALTER TABLE ONLY public.solvencias
    ADD CONSTRAINT id_solvencia
    PRIMARY KEY (id_solvencia);
--
-- Definition for index id_suspension (OID = 481047395) : 
--
ALTER TABLE ONLY public.dar_suspensiones
    ADD CONSTRAINT id_suspension
    PRIMARY KEY (id_suspension);
--
-- Definition for index id_transfer (OID = 481047397) : 
--
ALTER TABLE ONLY public.dar_transferencias
    ADD CONSTRAINT id_transfer
    PRIMARY KEY (id_transfer);
--
-- Definition for index id_traspaso (OID = 481047399) : 
--
ALTER TABLE ONLY public.dar_traspasos
    ADD CONSTRAINT id_traspaso
    PRIMARY KEY (id_traspaso);
--
-- Definition for index lugar_departamento_v2_pkey (OID = 481047401) : 
--
ALTER TABLE ONLY public.lugar_departamento
    ADD CONSTRAINT lugar_departamento_v2_pkey
    PRIMARY KEY (cod_dep);
--
-- Definition for index lugar_localidad_n_pkey (OID = 481047403) : 
--
ALTER TABLE ONLY public.lugar_localidad
    ADD CONSTRAINT lugar_localidad_n_pkey
    PRIMARY KEY (cod_loc);
--
-- Definition for index lugar_localidad_pkey (OID = 481047405) : 
--
ALTER TABLE ONLY public.lugar_localidad_old
    ADD CONSTRAINT lugar_localidad_pkey
    PRIMARY KEY (cod_loc);
--
-- Definition for index lugar_provincia_pkey (OID = 481047407) : 
--
ALTER TABLE ONLY public.lugar_provincia
    ADD CONSTRAINT lugar_provincia_pkey
    PRIMARY KEY (cod_prov);
--
-- Definition for index matriculas_id_gestion_id_periodo_id_alumno_fec_registro_key (OID = 481047409) : 
--
ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matriculas_id_gestion_id_periodo_id_alumno_fec_registro_key
    UNIQUE (id_gestion, id_periodo, id_alumno, fec_registro);
--
-- Definition for index matriculas_pkey (OID = 481047411) : 
--
ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT matriculas_pkey
    PRIMARY KEY (id_matricula);
--
-- Definition for index migrations_pkey (OID = 481047413) : 
--
ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey
    PRIMARY KEY (id);
--
-- Definition for index notas_planilla_convalido_pkey (OID = 481047415) : 
--
ALTER TABLE ONLY public.notas_planilla_convalido
    ADD CONSTRAINT notas_planilla_convalido_pkey
    PRIMARY KEY (id_convalida);
--
-- Definition for index notas_planilla_repetidos_pkey (OID = 481047417) : 
--
ALTER TABLE ONLY public.notas_planilla_repetidos
    ADD CONSTRAINT notas_planilla_repetidos_pkey
    PRIMARY KEY (id_repetido);
--
-- Definition for index permission_role_pkey (OID = 481047419) : 
--
ALTER TABLE ONLY public.permission_role
    ADD CONSTRAINT permission_role_pkey
    PRIMARY KEY (id);
--
-- Definition for index permission_user_pkey (OID = 481047421) : 
--
ALTER TABLE ONLY public.permission_user
    ADD CONSTRAINT permission_user_pkey
    PRIMARY KEY (id);
--
-- Definition for index permissions_pkey (OID = 481047423) : 
--
ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey
    PRIMARY KEY (id);
--
-- Definition for index permissions_slug_unique (OID = 481047425) : 
--
ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_slug_unique
    UNIQUE (slug);
--
-- Definition for index personal_pkey (OID = 481047427) : 
--
ALTER TABLE ONLY public.tramite
    ADD CONSTRAINT personal_pkey
    PRIMARY KEY (id_tramite);
--
-- Definition for index persons_ci_unique (OID = 481047429) : 
--
ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_ci_unique
    UNIQUE (ci);
--
-- Definition for index persons_pkey (OID = 481047432) : 
--
ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey
    PRIMARY KEY (id);
--
-- Definition for index pln_subprogramas_pkey (OID = 481047434) : 
--
ALTER TABLE ONLY public.pln_subprogramas
    ADD CONSTRAINT pln_subprogramas_pkey
    PRIMARY KEY (subprograma_id);
--
-- Definition for index postulantes_id_alumno_key (OID = 481047436) : 
--
ALTER TABLE ONLY public.postulantes
    ADD CONSTRAINT postulantes_id_alumno_key
    UNIQUE (id_alumno);
--
-- Definition for index prc_flujos_pkey (OID = 481047438) : 
--
ALTER TABLE ONLY public.prc_flujos
    ADD CONSTRAINT prc_flujos_pkey
    PRIMARY KEY (id_proceso, id_paso);
--
-- Definition for index prc_tramites_pkey (OID = 481047440) : 
--
ALTER TABLE ONLY public.prc_tramites
    ADD CONSTRAINT prc_tramites_pkey
    PRIMARY KEY (id_tramite);
--
-- Definition for index procesos_pkey (OID = 481047442) : 
--
ALTER TABLE ONLY public.procesos
    ADD CONSTRAINT procesos_pkey
    PRIMARY KEY (id_proceso);
--
-- Definition for index prs_colegios_pkey (OID = 481047444) : 
--
ALTER TABLE ONLY public.prs_colegios_2
    ADD CONSTRAINT prs_colegios_pkey
    PRIMARY KEY (id_colegio);
--
-- Definition for index prs_colegios_pkey1 (OID = 481047446) : 
--
ALTER TABLE ONLY public.prs_colegios
    ADD CONSTRAINT prs_colegios_pkey1
    PRIMARY KEY (id_colegio);
--
-- Definition for index prs_examen_pkey (OID = 481047448) : 
--
ALTER TABLE ONLY public.prs_examen
    ADD CONSTRAINT prs_examen_pkey
    PRIMARY KEY (id_examen);
--
-- Definition for index prs_observaciones_pkey (OID = 481047450) : 
--
ALTER TABLE ONLY public.prs_observaciones
    ADD CONSTRAINT prs_observaciones_pkey
    PRIMARY KEY (id_obs);
--
-- Definition for index prs_pais_2_pkey (OID = 481047452) : 
--
ALTER TABLE ONLY public.prs_pais_v2
    ADD CONSTRAINT prs_pais_2_pkey
    PRIMARY KEY (id_pais);
--
-- Definition for index prs_pais_3_pkey (OID = 481047454) : 
--
ALTER TABLE ONLY public.prs_pais
    ADD CONSTRAINT prs_pais_3_pkey
    PRIMARY KEY (id_pais);
--
-- Definition for index recibo_autogenerado_pkey (OID = 481047456) : 
--
ALTER TABLE ONLY public.recibo_autogenerado
    ADD CONSTRAINT recibo_autogenerado_pkey
    PRIMARY KEY (corr0);
--
-- Definition for index role_user_pkey (OID = 481047458) : 
--
ALTER TABLE ONLY public.role_user
    ADD CONSTRAINT role_user_pkey
    PRIMARY KEY (id);
--
-- Definition for index roles_pkey (OID = 481047460) : 
--
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey
    PRIMARY KEY (id);
--
-- Definition for index roles_slug_unique (OID = 481047462) : 
--
ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_slug_unique
    UNIQUE (slug);
--
-- Definition for index servicios_pkey (OID = 481047464) : 
--
ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_pkey
    PRIMARY KEY (id_servicio);
--
-- Definition for index sessions_pkey (OID = 481047466) : 
--
ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey
    PRIMARY KEY (id);
--
-- Definition for index sistemas_pkey (OID = 481047468) : 
--
ALTER TABLE ONLY public.sistemas
    ADD CONSTRAINT sistemas_pkey
    PRIMARY KEY (tipo_sistema);
--
-- Definition for index tipo_planilla_pkey (OID = 481047470) : 
--
ALTER TABLE ONLY public.tipo_planilla
    ADD CONSTRAINT tipo_planilla_pkey
    PRIMARY KEY (id_tip_pla);
--
-- Definition for index tipo_transacciones_pkey (OID = 481047472) : 
--
ALTER TABLE ONLY public.tipo_transacciones
    ADD CONSTRAINT tipo_transacciones_pkey
    PRIMARY KEY (id_tipo_transaccion);
--
-- Definition for index tramites_pkey (OID = 481047474) : 
--
ALTER TABLE ONLY public.tramites
    ADD CONSTRAINT tramites_pkey
    PRIMARY KEY (id_tramite);
--
-- Definition for index uatf_datos_idfacebook_key (OID = 481047476) : 
--
ALTER TABLE ONLY public.uatf_datos
    ADD CONSTRAINT uatf_datos_idfacebook_key
    UNIQUE (idfacebook);
--
-- Definition for index uatf_datos_nro_dip_key (OID = 481047478) : 
--
ALTER TABLE ONLY public.uatf_datos
    ADD CONSTRAINT uatf_datos_nro_dip_key
    UNIQUE (nro_dip);
--
-- Definition for index uatf_datos_pkey (OID = 481047480) : 
--
ALTER TABLE ONLY public.uatf_datos
    ADD CONSTRAINT uatf_datos_pkey
    PRIMARY KEY (id_ra);
--
-- Definition for index uni_key (OID = 481047482) : 
--
ALTER TABLE ONLY public.matriculas
    ADD CONSTRAINT uni_key
    UNIQUE (id_gestion, id_periodo, id_alumno);
--
-- Definition for index users__pkey (OID = 481047484) : 
--
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users__pkey
    PRIMARY KEY (id);
--
-- Definition for index users_ci_unique (OID = 481047486) : 
--
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_ci_unique
    UNIQUE (ci);
--
-- Definition for index users_od_pkey (OID = 481047488) : 
--
ALTER TABLE ONLY public.users_od
    ADD CONSTRAINT users_od_pkey
    PRIMARY KEY (id);
--
-- Definition for index users_username_unique (OID = 481047490) : 
--
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique
    UNIQUE (username);
--
-- Definition for index val_tran_pos_pkey (OID = 481047492) : 
--
ALTER TABLE ONLY public.valores_transacciones_postulant
    ADD CONSTRAINT val_tran_pos_pkey
    PRIMARY KEY (id_transaccion);
--
-- Definition for index valores_cargos_detalles_co_pkey (OID = 481047494) : 
--
ALTER TABLE ONLY public.valores_cargos_detalles_concept
    ADD CONSTRAINT valores_cargos_detalles_co_pkey
    PRIMARY KEY (id_concepto);
--
-- Definition for index valores_cargos_detalles_pkey (OID = 481047496) : 
--
ALTER TABLE ONLY public.valores_cargos_detalles
    ADD CONSTRAINT valores_cargos_detalles_pkey
    PRIMARY KEY (id_cargo, corr0);
--
-- Definition for index valores_transacciones_pkey (OID = 481047498) : 
--
ALTER TABLE ONLY public.valores_transacciones
    ADD CONSTRAINT valores_transacciones_pkey
    PRIMARY KEY (id_transaccion);
--
-- Definition for index valores_transacciones_sau_val_tran_pos_pkey (OID = 481047500) : 
--
ALTER TABLE ONLY public.valores_transacciones_sau
    ADD CONSTRAINT valores_transacciones_sau_val_tran_pos_pkey
    PRIMARY KEY (id_transaccion);
--
-- Definition for index $1 (OID = 481047607) : 
--
ALTER TABLE ONLY public.nivel_salarial
    ADD CONSTRAINT "$1"
    FOREIGN KEY (id_tip_pla) REFERENCES tipo_planilla(id_tip_pla);
--
-- Definition for index _bp_estados_civiles_uatf_datos (OID = 481047612) : 
--
ALTER TABLE ONLY public.uatf_datos
    ADD CONSTRAINT _bp_estados_civiles_uatf_datos
    FOREIGN KEY (estado_civil) REFERENCES _bp_estados_civiles(id_estado_civil);
--
-- Definition for index comissions_fk (OID = 481047617) : 
--
ALTER TABLE ONLY public.comisiones
    ADD CONSTRAINT comissions_fk
    FOREIGN KEY (id_dictamen) REFERENCES dictums(id);
--
-- Definition for index dicts_comisiones_comision_id_foreign (OID = 481047622) : 
--
ALTER TABLE ONLY public.miembros
    ADD CONSTRAINT dicts_comisiones_comision_id_foreign
    FOREIGN KEY (id_comision) REFERENCES comisiones(id);
--
-- Definition for index dicts_comisiones_uatfdatos_nro_dip_foreign (OID = 481047627) : 
--
ALTER TABLE ONLY public.miembros
    ADD CONSTRAINT dicts_comisiones_uatfdatos_nro_dip_foreign
    FOREIGN KEY (nro_dip) REFERENCES uatf_datos(nro_dip);
--
-- Definition for index dictums_programa_id_foreign (OID = 481047632) : 
--
ALTER TABLE ONLY public.dictums
    ADD CONSTRAINT dictums_programa_id_foreign
    FOREIGN KEY (programa_id) REFERENCES academico.alm_programas(id_programa);
--
-- Definition for index fk (OID = 481047637) : 
--
ALTER TABLE ONLY public.dar_tramites
    ADD CONSTRAINT fk
    FOREIGN KEY (desc_tramite) REFERENCES e_tipo_tramites(id_tipo_tramite);
--
-- Definition for index fk_cod_dep (OID = 481047642) : 
--
ALTER TABLE ONLY public.lugar_localidad
    ADD CONSTRAINT fk_cod_dep
    FOREIGN KEY (cod_dep) REFERENCES lugar_departamento(cod_dep);
--
-- Definition for index fk_cod_pais (OID = 481047647) : 
--
ALTER TABLE ONLY public.lugar_localidad
    ADD CONSTRAINT fk_cod_pais
    FOREIGN KEY (cod_pais) REFERENCES prs_pais_v2(id_pais);
--
-- Definition for index fk_cod_prov (OID = 481047652) : 
--
ALTER TABLE ONLY public.lugar_localidad
    ADD CONSTRAINT fk_cod_prov
    FOREIGN KEY (cod_prov) REFERENCES lugar_provincia(cod_prov);
--
-- Definition for index fk_depto (OID = 481047657) : 
--
ALTER TABLE ONLY public.lugar_provincia
    ADD CONSTRAINT fk_depto
    FOREIGN KEY (cod_dep) REFERENCES lugar_departamento(cod_dep);
--
-- Definition for index fk_id_pais (OID = 481047662) : 
--
ALTER TABLE ONLY public.lugar_departamento
    ADD CONSTRAINT fk_id_pais
    FOREIGN KEY (cod_pais) REFERENCES prs_pais_v2(id_pais);
--
-- Definition for index fk_lugar_colegio (OID = 481047667) : 
--
ALTER TABLE ONLY public.prs_colegios
    ADD CONSTRAINT fk_lugar_colegio
    FOREIGN KEY (cod_loc) REFERENCES lugar_localidad(cod_loc);
--
-- Definition for index fk_pais (OID = 481047672) : 
--
ALTER TABLE ONLY public.lugar_provincia
    ADD CONSTRAINT fk_pais
    FOREIGN KEY (cod_pais) REFERENCES prs_pais_v2(id_pais);
--
-- Definition for index fki_cod_pais (OID = 481047677) : 
--
ALTER TABLE ONLY public.lugar_localidad_old
    ADD CONSTRAINT fki_cod_pais
    FOREIGN KEY (cod_pais) REFERENCES prs_pais_v2(id_pais);
--
-- Definition for index fki_cod_prov_2 (OID = 481047682) : 
--
ALTER TABLE ONLY public.lugar_localidad_old
    ADD CONSTRAINT fki_cod_prov_2
    FOREIGN KEY (cod_prov_2) REFERENCES lugar_provincia(cod_prov);
--
-- Definition for index item_percepciones_deducciones_id_per_ded_fkey (OID = 481047687) : 
--
ALTER TABLE ONLY public.item_percepciones_deducciones
    ADD CONSTRAINT item_percepciones_deducciones_id_per_ded_fkey
    FOREIGN KEY (id_per_ded) REFERENCES percepciones_deducciones(id_per_ded);
--
-- Definition for index item_percepciones_deducciones_id_puesto_persona_fkey (OID = 481047692) : 
--
ALTER TABLE ONLY public.item_percepciones_deducciones
    ADD CONSTRAINT item_percepciones_deducciones_id_puesto_persona_fkey
    FOREIGN KEY (id_puesto_persona) REFERENCES puesto_persona(id_puesto_persona);
--
-- Definition for index lugar_localidad_new_new_cod_dep_fkey (OID = 481047697) : 
--
ALTER TABLE ONLY public.lugar_localidad_old
    ADD CONSTRAINT lugar_localidad_new_new_cod_dep_fkey
    FOREIGN KEY (cod_dep, cod_prov) REFERENCES lugar_provincia(cod_dep, cod_prov_original);
--
-- Definition for index nivel_salarial_id_tip_pla_fkey (OID = 481047702) : 
--
ALTER TABLE ONLY public.nivel_salarial
    ADD CONSTRAINT nivel_salarial_id_tip_pla_fkey
    FOREIGN KEY (id_tip_pla) REFERENCES tipo_planilla(id_tip_pla);
--
-- Definition for index notas_planilla_convalido_fk (OID = 481047707) : 
--
ALTER TABLE ONLY public.notas_planilla_convalido
    ADD CONSTRAINT notas_planilla_convalido_fk
    FOREIGN KEY (id_matricula) REFERENCES academico.notas_planilla(id_matricula);
--
-- Definition for index percepciones_deducciones_id_tip_pla_fkey (OID = 481047712) : 
--
ALTER TABLE ONLY public.percepciones_deducciones
    ADD CONSTRAINT percepciones_deducciones_id_tip_pla_fkey
    FOREIGN KEY (id_tip_pla) REFERENCES tipo_planilla(id_tip_pla);
--
-- Definition for index permission_role_permission_id_foreign (OID = 481047717) : 
--
ALTER TABLE ONLY public.permission_role
    ADD CONSTRAINT permission_role_permission_id_foreign
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
--
-- Definition for index permission_role_role_id_foreign (OID = 481047722) : 
--
ALTER TABLE ONLY public.permission_role
    ADD CONSTRAINT permission_role_role_id_foreign
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
--
-- Definition for index permission_user_permission_id_foreign (OID = 481047727) : 
--
ALTER TABLE ONLY public.permission_user
    ADD CONSTRAINT permission_user_permission_id_foreign
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
--
-- Definition for index permission_user_user_id_foreign (OID = 481047732) : 
--
ALTER TABLE ONLY public.permission_user
    ADD CONSTRAINT permission_user_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- Definition for index pln_subprogramas_fk (OID = 481047737) : 
--
ALTER TABLE ONLY public.pln_subprogramas
    ADD CONSTRAINT pln_subprogramas_fk
    FOREIGN KEY (id_programa) REFERENCES academico.alm_programas(id_programa) ON UPDATE CASCADE ON DELETE CASCADE;
--
-- Definition for index pln_subprogramas_materias_fk (OID = 481047742) : 
--
ALTER TABLE ONLY public.pln_subprogramas_materias
    ADD CONSTRAINT pln_subprogramas_materias_fk
    FOREIGN KEY (subprograma_id) REFERENCES pln_subprogramas(subprograma_id) ON UPDATE CASCADE;
--
-- Definition for index pln_subprogramas_materias_fk1 (OID = 481047747) : 
--
ALTER TABLE ONLY public.pln_subprogramas_materias
    ADD CONSTRAINT pln_subprogramas_materias_fk1
    FOREIGN KEY (id_materia) REFERENCES academico.pln_materias(id_materia) ON UPDATE CASCADE;
--
-- Definition for index prs_calificacion_uatf_datos (OID = 481047752) : 
--
ALTER TABLE ONLY public.uatf_datos
    ADD CONSTRAINT prs_calificacion_uatf_datos
    FOREIGN KEY (id_calificacion) REFERENCES prs_calificacion(id_calificacion);
--
-- Definition for index puesto_id_dedicacion_fkey (OID = 481047757) : 
--
ALTER TABLE ONLY public.puesto
    ADD CONSTRAINT puesto_id_dedicacion_fkey
    FOREIGN KEY (id_dedicacion) REFERENCES dedicacion(id_dedicacion);
--
-- Definition for index puesto_id_niv_sal_fkey (OID = 481047762) : 
--
ALTER TABLE ONLY public.puesto
    ADD CONSTRAINT puesto_id_niv_sal_fkey
    FOREIGN KEY (id_niv_sal) REFERENCES nivel_salarial(id_niv_sal);
--
-- Definition for index puesto_id_tip_pla_fkey (OID = 481047767) : 
--
ALTER TABLE ONLY public.puesto
    ADD CONSTRAINT puesto_id_tip_pla_fkey
    FOREIGN KEY (id_tip_pla) REFERENCES tipo_planilla(id_tip_pla);
--
-- Definition for index puesto_persona_id_puesto_fkey (OID = 481047772) : 
--
ALTER TABLE ONLY public.puesto_persona
    ADD CONSTRAINT puesto_persona_id_puesto_fkey
    FOREIGN KEY (id_puesto) REFERENCES puesto(id_puesto);
--
-- Definition for index role_user_role_id_foreign (OID = 481047777) : 
--
ALTER TABLE ONLY public.role_user
    ADD CONSTRAINT role_user_role_id_foreign
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
--
-- Definition for index role_user_user_id_foreign (OID = 481047782) : 
--
ALTER TABLE ONLY public.role_user
    ADD CONSTRAINT role_user_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- Definition for index uatf_datos_lugar_localidad (OID = 481047787) : 
--
ALTER TABLE ONLY public.uatf_datos
    ADD CONSTRAINT uatf_datos_lugar_localidad
    FOREIGN KEY (id_loc) REFERENCES lugar_localidad(cod_loc);
--
-- Definition for index uatf_datos_prs_colegios (OID = 481047792) : 
--
ALTER TABLE ONLY public.uatf_datos
    ADD CONSTRAINT uatf_datos_prs_colegios
    FOREIGN KEY (id_colegio) REFERENCES prs_colegios(id_colegio);
--
-- Definition for index users_ci_foreign (OID = 481047797) : 
--
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_ci_foreign
    FOREIGN KEY (ci) REFERENCES uatf_datos(nro_dip);
--
-- Definition for trigger _hrs_tipox (OID = 8351557) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER _hrs_tipox
    BEFORE INSERT OR UPDATE ON academico.dct_asignaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public._set_hrs_tipo ();
--
-- Definition for trigger dct_change_password (OID = 8351558) : 
--
CREATE TRIGGER dct_change_password
    AFTER UPDATE ON academico.docentes
    FOR EACH ROW
    WHEN (old.clave::text IS DISTINCT FROM new.clave::text)
    EXECUTE PROCEDURE public._dct_change_password ();
--
-- Definition for trigger docentes_log_tr (OID = 8351559) : 
--
CREATE TRIGGER docentes_log_tr
    AFTER UPDATE ON academico.docentes_log
    FOR EACH ROW
    EXECUTE PROCEDURE public.tr_log_docentes ();
--
-- Definition for trigger log_log (OID = 8351560) : 
--
CREATE TRIGGER log_log
    BEFORE UPDATE ON academico.notas_planilla
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger log_log (OID = 8351561) : 
--
CREATE TRIGGER log_log
    BEFORE UPDATE ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger log_log (OID = 8351562) : 
--
CREATE TRIGGER log_log
    AFTER UPDATE ON academico.alm_programas
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger log_log (OID = 8351563) : 
--
CREATE TRIGGER log_log
    AFTER UPDATE ON academico.alumnos
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger log_log (OID = 8351564) : 
--
CREATE TRIGGER log_log
    BEFORE UPDATE ON academico.dct_asignaciones
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger log_log_delete (OID = 8351565) : 
--
CREATE TRIGGER log_log_delete
    AFTER DELETE ON academico.dct_asignaciones
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger tr_diu (OID = 8351566) : 
--
CREATE TRIGGER tr_diu
    AFTER INSERT ON academico.alumnos
    FOR EACH ROW
    EXECUTE PROCEDURE public.fun_diu ();
--
-- Definition for trigger tr_set_plan_alumnos (OID = 8351567) : 
--
CREATE TRIGGER tr_set_plan_alumnos
    BEFORE INSERT ON academico.alumnos
    FOR EACH ROW
    EXECUTE PROCEDURE public._set_plan_alumnos ();
--
-- Definition for trigger trigg_calificar_aud050 (OID = 8351568) : 
--
CREATE TRIGGER trigg_calificar_aud050
    AFTER UPDATE ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.fn_calificar_aud050 ();
--
-- Definition for trigger trigg_delete_alm_programaciones (OID = 8351569) : 
--
CREATE TRIGGER trigg_delete_alm_programaciones
    AFTER DELETE ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.trigg_delete_alm_programaciones_proc ();
--
-- Definition for trigger trigg_programar_aud050 (OID = 8351570) : 
--
CREATE TRIGGER trigg_programar_aud050
    BEFORE INSERT OR DELETE ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.fn_programar_aud050 ();
--
-- Definition for trigger trigger_fechas_limite (OID = 8351572) : 
--
CREATE TRIGGER trigger_fechas_limite
    AFTER UPDATE ON academico.alm_programas_parametros
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_fechas ();
--
-- Definition for trigger trg_lector_ultima_actualizacion (OID = 8351573) : 
--
SET search_path = biblioteca, pg_catalog;
CREATE TRIGGER trg_lector_ultima_actualizacion
    BEFORE UPDATE ON biblioteca.lector
    FOR EACH ROW
    EXECUTE PROCEDURE fn_lector_ultima_actualizacion ();
--
-- Definition for trigger tit_tramite_tr (OID = 8351574) : 
--
SET search_path = dep_titulos, pg_catalog;
CREATE TRIGGER tit_tramite_tr
    AFTER INSERT OR UPDATE ON dep_titulos.tit_tramite
    FOR EACH ROW
    EXECUTE PROCEDURE public.tit_tramite_fun ();
--
-- Definition for trigger tr_impresion_ins_upd (OID = 8351575) : 
--
SET search_path = diu, pg_catalog;
CREATE TRIGGER tr_impresion_ins_upd
    BEFORE INSERT OR UPDATE ON diu.diu_impresion
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_impresion_ins_upd ();
--
-- Definition for trigger tr_solicitud_ins_upd (OID = 8351576) : 
--
CREATE TRIGGER tr_solicitud_ins_upd
    AFTER INSERT OR UPDATE ON diu.diu_solicitud
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_solicitud_ins_upd ();
--
-- Definition for trigger _postulaciones_tr_update (OID = 8351578) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TRIGGER _postulaciones_tr_update
    BEFORE UPDATE ON postulantes._postulaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public._postulaciones_update ();

ALTER TABLE postulantes._postulaciones
  DISABLE TRIGGER _postulaciones_tr_update;
--
-- Definition for trigger _postulantes_tr (OID = 8351579) : 
--
CREATE TRIGGER _postulantes_tr
    BEFORE UPDATE ON postulantes._postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE public._update_ci ();

ALTER TABLE postulantes._postulantes
  DISABLE TRIGGER _postulantes_tr;
--
-- Definition for trigger log_log (OID = 8351580) : 
--
CREATE TRIGGER log_log
    BEFORE DELETE OR UPDATE ON postulantes._postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger log_log (OID = 8351581) : 
--
CREATE TRIGGER log_log
    BEFORE DELETE OR UPDATE ON postulantes._postulaciones
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger postulantes_trigger_liberacion (OID = 8351582) : 
--
CREATE TRIGGER postulantes_trigger_liberacion
    AFTER UPDATE ON postulantes._postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE proc_liberacion ();
--
-- Definition for trigger aud_tipo_doc_tr (OID = 8351590) : 
--
SET search_path = recycler, pg_catalog;
CREATE TRIGGER aud_tipo_doc_tr
    BEFORE INSERT OR UPDATE ON recycler.aud_tipo_doc
    FOR EACH ROW
    EXECUTE PROCEDURE public.trgg_lupdate ();
--
-- Definition for trigger tr_log_tablas_modificaciones (OID = 9219431) : 
--
SET search_path = log, pg_catalog;
CREATE TRIGGER tr_log_tablas_modificaciones
    BEFORE DELETE ON log.log_tablas_modificaciones
    FOR EACH ROW
    EXECUTE PROCEDURE f_no_delete ();
--
-- Definition for trigger tr_alm_programaciones (OID = 9219511) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_alm_programaciones
    BEFORE DELETE ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE f_alm_programaciones_delete ();
--
-- Definition for trigger bc_postulantes_tr (OID = 9225160) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TRIGGER bc_postulantes_tr
    AFTER INSERT ON balimentacion.bc_postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_convocataria_evaluacion ();

ALTER TABLE balimentacion.bc_postulantes
  DISABLE TRIGGER bc_postulantes_tr;
--
-- Definition for trigger tr_pln_materias_parametros_up (OID = 9261163) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_pln_materias_parametros_up
    AFTER UPDATE OF __estado ON academico.pln_materias_parametros
    FOR EACH ROW
    EXECUTE PROCEDURE f_tr_pln_materias_parametros_up ();
--
-- Definition for trigger tr_agenda (OID = 18511999) : 
--
SET search_path = agenda_aux, pg_catalog;
CREATE TRIGGER tr_agenda
    AFTER UPDATE ON agenda_aux.agenda
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_update_agenda ();

ALTER TABLE agenda_aux.agenda
  DISABLE TRIGGER tr_agenda;
--
-- Definition for trigger tr_alm_programaciones_programaciones (OID = 18682259) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_alm_programaciones_programaciones
    BEFORE INSERT OR DELETE OR UPDATE ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_alm_programaciones_programaciones ();
--
-- Definition for trigger _postulaciones_tr_verificacion_modalidad (OID = 37838077) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TRIGGER _postulaciones_tr_verificacion_modalidad
    BEFORE INSERT OR DELETE OR UPDATE OF id ON postulantes._postulaciones
    FOR EACH STATEMENT
    EXECUTE PROCEDURE public.f_tri_verificacion_modalidad ();
--
-- Definition for trigger tr_alumnos_obs (OID = 37854899) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_alumnos_obs
    BEFORE INSERT OR DELETE OR UPDATE OF estado, observacion ON academico.alumnos
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tri_observaciones ();
--
-- Definition for trigger tr_postulantes_insert (OID = 67293290) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TRIGGER tr_postulantes_insert
    AFTER INSERT ON postulantes._postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE public.tr_postulantes_insert ();

ALTER TABLE postulantes._postulantes
  DISABLE TRIGGER tr_postulantes_insert;
--
-- Definition for trigger bc_postulantes_2_tr (OID = 85284628) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TRIGGER bc_postulantes_2_tr
    AFTER INSERT ON balimentacion.bc_postulantes_2
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_convocataria_evaluacion ();

ALTER TABLE balimentacion.bc_postulantes_2
  DISABLE TRIGGER bc_postulantes_2_tr;
--
-- Definition for trigger bc_postulantes_bck_tr (OID = 85379902) : 
--
CREATE TRIGGER bc_postulantes_bck_tr
    AFTER INSERT ON balimentacion.bc_postulantes_bck
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_convocataria_evaluacion ();

ALTER TABLE balimentacion.bc_postulantes_bck
  DISABLE TRIGGER bc_postulantes_bck_tr;
--
-- Definition for trigger tri_notificaciones (OID = 85865177) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tri_notificaciones
    AFTER INSERT OR UPDATE ON academico.alm_programas_parametros
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tri_notificaciones ();

ALTER TABLE academico.alm_programas_parametros
  DISABLE TRIGGER tri_notificaciones;
--
-- Definition for trigger alumnos_tr_notifications (OID = 96086992) : 
--
CREATE TRIGGER alumnos_tr_notifications
    AFTER INSERT OR UPDATE ON academico.alumnos
    FOR EACH ROW
    EXECUTE PROCEDURE public.notifications_alumnos ();
--
-- Definition for trigger b_t_notifications (OID = 96087223) : 
--
CREATE TRIGGER b_t_notifications
    AFTER INSERT OR UPDATE ON academico.alm_programas_parametros
    FOR EACH ROW
    EXECUTE PROCEDURE public.notification_alm_programas_parametros ();

ALTER TABLE academico.alm_programas_parametros
  DISABLE TRIGGER b_t_notifications;
--
-- Definition for trigger alm_programaciones_eliminados_tr_notifications (OID = 96087570) : 
--
CREATE TRIGGER alm_programaciones_eliminados_tr_notifications
    AFTER INSERT ON academico.alm_programaciones_eliminados
    FOR EACH ROW
    EXECUTE PROCEDURE public.notifications_alm_programaciones_eliminadas ();
--
-- Definition for trigger alm_programaciones_tr_notifications (OID = 96087585) : 
--
CREATE TRIGGER alm_programaciones_tr_notifications
    AFTER INSERT OR UPDATE ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.notifications_alm_programaciones ();

ALTER TABLE academico.alm_programaciones
  DISABLE TRIGGER alm_programaciones_tr_notifications;
--
-- Definition for trigger desprogramaciones_tr (OID = 96297125) : 
--
CREATE TRIGGER desprogramaciones_tr
    AFTER INSERT OR UPDATE OF fecha_hora, operacion ON academico.desprogramaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tri_operaciones ();

ALTER TABLE academico.desprogramaciones
  DISABLE TRIGGER desprogramaciones_tr;
--
-- Definition for trigger trigger_clave_certificado (OID = 96299040) : 
--
CREATE TRIGGER trigger_clave_certificado
    BEFORE UPDATE ON academico.alumnos
    FOR EACH ROW
    EXECUTE PROCEDURE public.proc_trigger_clave_certificado ();
--
-- Definition for trigger tr_aux_postulantes (OID = 138906856) : 
--
SET search_path = auxiliares, pg_catalog;
CREATE TRIGGER tr_aux_postulantes
    BEFORE INSERT ON auxiliares.aux_postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_aux_postulantes ();
--
-- Definition for trigger tr_agendar (OID = 216869289) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TRIGGER tr_agendar
    AFTER INSERT OR UPDATE ON postulantes._postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_agendar ();
--
-- Definition for trigger reposiciones_tr (OID = 228635823) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER reposiciones_tr
    BEFORE UPDATE OF estado ON academico.reposiciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tri_reposicion ();
--
-- Definition for trigger notas_planilla_tr (OID = 240584911) : 
--
CREATE TRIGGER notas_planilla_tr
    BEFORE DELETE OR UPDATE ON academico.notas_planilla
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_notas_planilla ();

ALTER TABLE academico.notas_planilla
  DISABLE TRIGGER notas_planilla_tr;
--
-- Definition for trigger tr_uatf_datos_log (OID = 240751044) : 
--
SET search_path = log, pg_catalog;
CREATE TRIGGER tr_uatf_datos_log
    AFTER UPDATE ON log.uatf_datos_log
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_uatf_datos_log ();
--
-- Definition for trigger alm_programaciones_eliminados_tr (OID = 277130117) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER alm_programaciones_eliminados_tr
    BEFORE DELETE ON academico.alm_programaciones_eliminados
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_proteger_datos ();
--
-- Definition for trigger _postulaciones_status_tg (OID = 277176392) : 
--
SET search_path = postulantes, pg_catalog;
CREATE TRIGGER _postulaciones_status_tg
    AFTER INSERT ON postulantes._postulaciones
    FOR EACH ROW
    EXECUTE PROCEDURE _postulaciones_status_fn ();
--
-- Definition for trigger bc_postulantes_bk_tr (OID = 277176898) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TRIGGER bc_postulantes_bk_tr
    AFTER INSERT ON balimentacion.bc_postulantes_bk
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_convocataria_evaluacion ();

ALTER TABLE balimentacion.bc_postulantes_bk
  DISABLE TRIGGER bc_postulantes_bk_tr;
--
-- Definition for trigger tr_docentes_tramites (OID = 277266090) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_docentes_tramites
    AFTER INSERT OR UPDATE ON academico.docentes_tramites
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_docentes_tramites ();
--
-- Definition for trigger alm_programaciones_simulacion_tr_notifications (OID = 289739195) : 
--
CREATE TRIGGER alm_programaciones_simulacion_tr_notifications
    AFTER INSERT OR UPDATE ON academico.alm_programaciones_simulacion
    FOR EACH ROW
    EXECUTE PROCEDURE public.notifications_alm_programaciones ();

ALTER TABLE academico.alm_programaciones_simulacion
  DISABLE TRIGGER alm_programaciones_simulacion_tr_notifications;
--
-- Definition for trigger log_log (OID = 289739196) : 
--
CREATE TRIGGER log_log
    BEFORE UPDATE ON academico.alm_programaciones_simulacion
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger tr_alm_programaciones (OID = 289739197) : 
--
CREATE TRIGGER tr_alm_programaciones
    BEFORE DELETE ON academico.alm_programaciones_simulacion
    FOR EACH ROW
    EXECUTE PROCEDURE f_alm_programaciones_delete ();
--
-- Definition for trigger tr_alm_programaciones_programaciones (OID = 289739198) : 
--
CREATE TRIGGER tr_alm_programaciones_programaciones
    BEFORE INSERT OR DELETE OR UPDATE ON academico.alm_programaciones_simulacion
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_alm_programaciones_programaciones ();
--
-- Definition for trigger trigg_calificar_aud050 (OID = 289739199) : 
--
CREATE TRIGGER trigg_calificar_aud050
    AFTER UPDATE ON academico.alm_programaciones_simulacion
    FOR EACH ROW
    EXECUTE PROCEDURE public.fn_calificar_aud050 ();
--
-- Definition for trigger trigg_delete_alm_programaciones (OID = 289739200) : 
--
CREATE TRIGGER trigg_delete_alm_programaciones
    AFTER DELETE ON academico.alm_programaciones_simulacion
    FOR EACH ROW
    EXECUTE PROCEDURE public.trigg_delete_alm_programaciones_proc ();
--
-- Definition for trigger trigg_programar_aud050 (OID = 289739201) : 
--
CREATE TRIGGER trigg_programar_aud050
    BEFORE INSERT OR DELETE ON academico.alm_programaciones_simulacion
    FOR EACH ROW
    EXECUTE PROCEDURE public.fn_programar_aud050 ();
--
-- Definition for trigger alm_programaciones_tr (OID = 315378543) : 
--
CREATE TRIGGER alm_programaciones_tr
    AFTER INSERT ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_no_programar_doble ();

ALTER TABLE academico.alm_programaciones
  DISABLE TRIGGER alm_programaciones_tr;
--
-- Definition for trigger tr_calificacion_evaluacion_ (OID = 356304121) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TRIGGER tr_calificacion_evaluacion_
    AFTER INSERT OR UPDATE ON balimentacion.calificacion_evaluacion
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_calificacion_evaluacion ();
--
-- Definition for trigger tr_actualizar_uatf_datos (OID = 356324157) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_actualizar_uatf_datos
    AFTER INSERT OR UPDATE ON academico.docentes
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_actualizar_uatf_datos ();

ALTER TABLE academico.docentes
  DISABLE TRIGGER tr_actualizar_uatf_datos;
--
-- Definition for trigger tr_dct_asignaciones_extra (OID = 356343152) : 
--
SET search_path = sis_odiseo, pg_catalog;
CREATE TRIGGER tr_dct_asignaciones_extra
    AFTER UPDATE OF verificacion_estado ON sis_odiseo.dct_asignaciones_extra
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_dct_asignaciones_extra ();
--
-- Definition for trigger tr_solicitudes (OID = 356352300) : 
--
SET search_path = solicitudes, pg_catalog;
CREATE TRIGGER tr_solicitudes
    BEFORE UPDATE OF estado ON solicitudes._solicitudes
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_solicitudes ();
--
-- Definition for trigger tr_cambiar_estado_odiseo (OID = 356357438) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_cambiar_estado_odiseo
    AFTER UPDATE ON academico.docentes
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_actualizar_estado_users ();
--
-- Definition for trigger tr_alm_programaciones_matricula (OID = 356374804) : 
--
CREATE TRIGGER tr_alm_programaciones_matricula
    BEFORE INSERT OR UPDATE ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_alm_programaciones_matricula ();

ALTER TABLE academico.alm_programaciones
  DISABLE TRIGGER tr_alm_programaciones_matricula;
--
-- Definition for trigger tr_solicitudes_detalle (OID = 356381737) : 
--
SET search_path = solicitudes, pg_catalog;
CREATE TRIGGER tr_solicitudes_detalle
    BEFORE UPDATE ON solicitudes.solicitudes_detalle
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_solicitudes_detalle ();
--
-- Definition for trigger tr_lista_elecciones (OID = 356381867) : 
--
SET search_path = elecciones, pg_catalog;
CREATE TRIGGER tr_lista_elecciones
    BEFORE UPDATE OF estado ON elecciones.lista_elecciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_lista_elecciones ();
--
-- Definition for trigger tr_control_recepcion (OID = 356388946) : 
--
SET search_path = planillas, pg_catalog;
CREATE TRIGGER tr_control_recepcion
    BEFORE UPDATE OF estado_recepcion, estado_validacion, estado_programacion_automatica, estado_actualizar_kardex, estado_certificado_notas ON planillas.control_recepcion
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_control_recepcion ();
--
-- Definition for trigger tr_dct_asignaciones_desasignar (OID = 356390239) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_dct_asignaciones_desasignar
    BEFORE DELETE OR UPDATE ON academico.dct_asignaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_dct_asignaciones_desasignar ();

ALTER TABLE academico.dct_asignaciones
  DISABLE TRIGGER tr_dct_asignaciones_desasignar;
--
-- Definition for trigger tr_bc_postulantes_presentado (OID = 382782920) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TRIGGER tr_bc_postulantes_presentado
    BEFORE UPDATE ON balimentacion.bc_postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_bc_postulantes_presentado ();
--
-- Definition for trigger tr_listas_generadas (OID = 383165037) : 
--
SET search_path = seguro, pg_catalog;
CREATE TRIGGER tr_listas_generadas
    BEFORE UPDATE OF estado ON seguro.listas_generadas
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_listas_generadas ();
--
-- Definition for trigger tri_alm_programaciones_lab (OID = 383175938) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tri_alm_programaciones_lab
    BEFORE INSERT OR UPDATE OF observacion ON academico.alm_programaciones_lab
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tri_alm_programaciones_lab ();

ALTER TABLE academico.alm_programaciones_lab
  DISABLE TRIGGER tri_alm_programaciones_lab;
--
-- Definition for trigger tri_investigacion_social (OID = 383176345) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TRIGGER tri_investigacion_social
    BEFORE UPDATE OF estado ON balimentacion.investigacion_social
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tri_investigacion_social ();

ALTER TABLE balimentacion.investigacion_social
  DISABLE TRIGGER tri_investigacion_social;
--
-- Definition for trigger tr_matriculas_digitales (OID = 383195989) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TRIGGER tr_matriculas_digitales
    BEFORE UPDATE OF estado ON matriculas.matriculas_digitales
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_matriculas_digitales ();
--
-- Definition for trigger tri_investigacion_social (OID = 396749221) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE TRIGGER tri_investigacion_social
    BEFORE UPDATE OF estado ON balimentacion.investigacion_social_2
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tri_investigacion_social ();

ALTER TABLE balimentacion.investigacion_social_2
  DISABLE TRIGGER tri_investigacion_social;
--
-- Definition for trigger tr_pagos (OID = 396965923) : 
--
SET search_path = cajas, pg_catalog;
CREATE TRIGGER tr_pagos
    BEFORE INSERT OR UPDATE ON cajas.pagos
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_pagos ();
--
-- Definition for trigger tr_pagos_ppe (OID = 410920583) : 
--
CREATE TRIGGER tr_pagos_ppe
    BEFORE UPDATE OF estado ON cajas.pagos_ppe
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_pagos_ppe ();
--
-- Definition for trigger tr_dct_asignaciones_control (OID = 440008299) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_dct_asignaciones_control
    BEFORE DELETE OR UPDATE ON academico.dct_asignaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_dct_asignaciones_control ();

ALTER TABLE academico.dct_asignaciones
  DISABLE TRIGGER tr_dct_asignaciones_control;
--
-- Definition for trigger tr_alm_programaciones_control (OID = 440008370) : 
--
CREATE TRIGGER tr_alm_programaciones_control
    BEFORE UPDATE OF pparcial, sparcial, tparcial, cparcial, promparcial, pract, prompract, lab, promlab, notapres, exfinal, promexfinal, nota, nota_2da, nota_ex_mesa, observacion ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_alm_programaciones_control ();

ALTER TABLE academico.alm_programaciones
  DISABLE TRIGGER tr_alm_programaciones_control;
--
-- Definition for trigger tr_asignaciones (OID = 440303856) : 
--
SET search_path = designaciones, pg_catalog;
CREATE TRIGGER tr_asignaciones
    BEFORE UPDATE OF estado ON designaciones.asignaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_asignaciones ();
--
-- Definition for trigger tr_dct_asignaciones_del (OID = 441153827) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_dct_asignaciones_del
    BEFORE DELETE ON academico.dct_asignaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.tr_dct_asignaciones_del ();
--
-- Definition for trigger tr_solicitudes_matriculas_prea (OID = 441544012) : 
--
SET search_path = matriculas, pg_catalog;
CREATE TRIGGER tr_solicitudes_matriculas_prea
    AFTER UPDATE OF estado ON matriculas.solicitudes_matriculas
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_solicitudes_matriculas_prea ();

ALTER TABLE matriculas.solicitudes_matriculas
  DISABLE TRIGGER tr_solicitudes_matriculas_prea;
--
-- Definition for trigger tr_notificaciones (OID = 441597456) : 
--
CREATE TRIGGER tr_notificaciones
    BEFORE INSERT OR UPDATE OF _obs ON matriculas.notificaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_notificaciones ();
--
-- Definition for trigger trigger_update_seguimiento_timestamp (OID = 441617950) : 
--
SET search_path = actas_graduacion, pg_catalog;
CREATE TRIGGER trigger_update_seguimiento_timestamp
    BEFORE UPDATE ON actas_graduacion.seguimiento_decretos
    FOR EACH ROW
    EXECUTE PROCEDURE update_seguimiento_updated_at ();
--
-- Definition for trigger tr_lab_qmc (OID = 442571533) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER tr_lab_qmc
    BEFORE UPDATE OF nota ON academico.alm_programaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_tr_lab_qmc ();
--
-- Definition for trigger alm_programaciones_lab_tr (OID = 442580128) : 
--
CREATE TRIGGER alm_programaciones_lab_tr
    BEFORE INSERT OR UPDATE OF id_grupo, ult_usuario, lab, observacion, tipo_prog, promlab, notapres, exfinal, promexfinal, nota, nota_ex_mesa, _nro_com ON academico.alm_programaciones_lab
    FOR EACH ROW
    EXECUTE PROCEDURE public.f_alm_programaciones_lab_tr ();
--
-- Definition for trigger alm_modalidad_tr (OID = 481047589) : 
--
SET search_path = public, pg_catalog;
CREATE TRIGGER alm_modalidad_tr
    BEFORE UPDATE OF _estado ON public.alm_modalidad
    FOR EACH ROW
    EXECUTE PROCEDURE f_tr_am_modalidad ();
--
-- Definition for trigger dar_tr_transferencias (OID = 481047590) : 
--
CREATE TRIGGER dar_tr_transferencias
    BEFORE UPDATE ON public.dar_transferencias
    FOR EACH ROW
    EXECUTE PROCEDURE f_dar_tr_transferencias ();
--
-- Definition for trigger log_log (OID = 481047591) : 
--
CREATE TRIGGER log_log
    AFTER UPDATE ON public.uatf_datos
    FOR EACH ROW
    EXECUTE PROCEDURE log.dynamic_trigger ();
--
-- Definition for trigger matriculas_tr_clave (OID = 481047592) : 
--
CREATE TRIGGER matriculas_tr_clave
    AFTER INSERT OR UPDATE OF clave ON public.matriculas
    FOR EACH ROW
    EXECUTE PROCEDURE f_matriculas_tr_clave ();

ALTER TABLE public.matriculas
  DISABLE TRIGGER matriculas_tr_clave;
--
-- Definition for trigger notify_article (OID = 481047594) : 
--
CREATE TRIGGER notify_article
    AFTER INSERT OR UPDATE ON public.prs_sexos
    FOR EACH ROW
    EXECUTE PROCEDURE notify_article_insert ();
--
-- Definition for trigger postulantes_tr (OID = 481047595) : 
--
CREATE TRIGGER postulantes_tr
    BEFORE INSERT OR DELETE OR UPDATE ON public.postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE fn_modalidad ();
--
-- Definition for trigger tr_dar_cambios_carrera (OID = 481047596) : 
--
CREATE TRIGGER tr_dar_cambios_carrera
    BEFORE UPDATE OF estado ON public.dar_cambios_carrera
    FOR EACH ROW
    EXECUTE PROCEDURE f_tr_dar_cambios_carrera ();
--
-- Definition for trigger tr_data_notificaciones (OID = 481047597) : 
--
CREATE TRIGGER tr_data_notificaciones
    AFTER INSERT OR UPDATE OF enviado ON public.data_notificaciones
    FOR EACH ROW
    EXECUTE PROCEDURE f_tr_data_notificaciones ();

ALTER TABLE public.data_notificaciones
  DISABLE TRIGGER tr_data_notificaciones;
--
-- Definition for trigger tr_log (OID = 481047598) : 
--
CREATE TRIGGER tr_log
    BEFORE UPDATE ON public.postulantes
    FOR EACH ROW
    EXECUTE PROCEDURE f_tr_log ();
--
-- Definition for trigger tr_lugar_localidad (OID = 481047599) : 
--
CREATE TRIGGER tr_lugar_localidad
    BEFORE DELETE OR UPDATE ON public.lugar_localidad
    FOR EACH ROW
    EXECUTE PROCEDURE f_tr_lugar_localidad ();
--
-- Definition for trigger tr_matriculas_programar (OID = 481047600) : 
--
CREATE TRIGGER tr_matriculas_programar
    AFTER INSERT ON public.matriculas
    FOR EACH ROW
    EXECUTE PROCEDURE f_tr_programar_materias ();
--
-- Definition for trigger tr_uatf_datos_ins (OID = 481047601) : 
--
CREATE TRIGGER tr_uatf_datos_ins
    BEFORE INSERT ON public.uatf_datos
    FOR EACH ROW
    EXECUTE PROCEDURE fn_uatf_datos_ins ();
--
-- Definition for trigger trg_matriculas (OID = 481047602) : 
--
CREATE TRIGGER trg_matriculas
    BEFORE INSERT OR UPDATE OF id_matricula, carrera, programacion ON public.matriculas
    FOR EACH ROW
    EXECUTE PROCEDURE fn_matriculas ();
--
-- Definition for trigger tri_alm_programas_ingreso (OID = 481047603) : 
--
CREATE TRIGGER tri_alm_programas_ingreso
    AFTER UPDATE OF id_programa, id_gestion, id_periodo, estado, obs, nota_minima, _id_usuario, _registrado, _modificado, _estado, id_examen, mostrar_nota ON public.alm_programas_ingreso
    FOR EACH ROW
    EXECUTE PROCEDURE f_tri_alm_programas_ingreso ();
--
-- Definition for trigger trigg_cajas_trans (OID = 481047604) : 
--
CREATE TRIGGER trigg_cajas_trans
    BEFORE INSERT ON public.cajas_transacciones
    FOR EACH ROW
    EXECUTE PROCEDURE fun_matriculas ();
--
-- Definition for trigger trigg_item_percepciones_deducciones (OID = 481047605) : 
--
CREATE TRIGGER trigg_item_percepciones_deducciones
    AFTER INSERT OR DELETE OR UPDATE ON public.item_percepciones_deducciones
    FOR EACH ROW
    EXECUTE PROCEDURE fun_item_percepciones_deducciones ();
--
-- Definition for trigger uatf_datos_tr (OID = 481047606) : 
--
CREATE TRIGGER uatf_datos_tr
    AFTER UPDATE OF dip_bach ON public.uatf_datos
    FOR EACH ROW
    EXECUTE PROCEDURE uatf_datos_fn ();
--
-- Definition for trigger myapp_planes (OID = 481048244) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER myapp_planes
    AFTER INSERT OR DELETE OR UPDATE ON academico.planes
    FOR EACH ROW
    EXECUTE PROCEDURE public.livepg_myapp ();
--
-- Definition for trigger myapp_uatf_datos (OID = 481048245) : 
--
SET search_path = public, pg_catalog;
CREATE TRIGGER myapp_uatf_datos
    AFTER INSERT OR DELETE OR UPDATE ON public.uatf_datos
    FOR EACH ROW
    EXECUTE PROCEDURE livepg_myapp ();
--
-- Definition for trigger myapp_alumnos (OID = 481048246) : 
--
SET search_path = academico, pg_catalog;
CREATE TRIGGER myapp_alumnos
    AFTER INSERT OR DELETE OR UPDATE ON academico.alumnos
    FOR EACH ROW
    EXECUTE PROCEDURE public.livepg_myapp ();
--
-- Definition for trigger myapp_alm_programas (OID = 481048247) : 
--
CREATE TRIGGER myapp_alm_programas
    AFTER INSERT OR DELETE OR UPDATE ON academico.alm_programas
    FOR EACH ROW
    EXECUTE PROCEDURE public.livepg_myapp ();
--
-- Definition for trigger myapp_alm_programas_facultades (OID = 481048248) : 
--
CREATE TRIGGER myapp_alm_programas_facultades
    AFTER INSERT OR DELETE OR UPDATE ON academico.alm_programas_facultades
    FOR EACH ROW
    EXECUTE PROCEDURE public.livepg_myapp ();
--
-- Definition for rule _nins (OID = 8351552) : 
--
SET search_path = frida, pg_catalog;
CREATE RULE _nins AS
    ON DELETE TO _usuarios DO INSTEAD NOTHING;
--
-- Definition for rule no_borrar (OID = 8351553) : 
--
SET search_path = log, pg_catalog;
CREATE RULE no_borrar AS
    ON DELETE TO log_tablas_modificaciones DO INSTEAD NOTHING;
--
-- Definition for rule delete_rule_borrador (OID = 8351554) : 
--
SET search_path = recycler, pg_catalog;
CREATE RULE delete_rule_borrador AS
    ON DELETE TO borrador DO INSTEAD NOTHING;
--
-- Definition for rule insert_rule_borrador (OID = 8351555) : 
--
CREATE RULE insert_rule_borrador AS
    ON UPDATE TO borrador DO INSTEAD NOTHING;
--
-- Definition for rule update_rule_borrador (OID = 8351556) : 
--
CREATE RULE update_rule_borrador AS
    ON UPDATE TO borrador DO INSTEAD NOTHING;
--
-- Definition for rule NOUPDATE (OID = 85215924) : 
--
SET search_path = balimentacion, pg_catalog;
CREATE RULE "NOUPDATE" AS
    ON UPDATE TO bc_postulantes_1
   WHERE (old.* <> new.*) DO INSTEAD NOTHING;
--
-- Definition for rule NOUPDATE (OID = 85284629) : 
--
CREATE RULE "NOUPDATE" AS
    ON UPDATE TO bc_postulantes_2
   WHERE (old.* <> new.*) DO INSTEAD NOTHING;
--
-- Definition for rule NOUPDATE (OID = 85379918) : 
--
CREATE RULE "NOUPDATE" AS
    ON UPDATE TO bc_postulantes_bck
   WHERE (old.* <> new.*) DO NOTHING;
--
-- Definition for rule NOUPDATE (OID = 85379919) : 
--
CREATE RULE "NOUPDATE" AS
    ON UPDATE TO bc_postulantes
   WHERE (old.* <> new.*) DO NOTHING;
--
-- Definition for rule NOUPDATE (OID = 277176899) : 
--
CREATE RULE "NOUPDATE" AS
    ON UPDATE TO bc_postulantes_bk
   WHERE (old.* <> new.*) DO NOTHING;
--
-- Comments
--
SET search_path = academico, pg_catalog;
COMMENT ON COLUMN academico.pln_materias.id_dpto IS 'Indica el estado de la Materia
1=ACTIVO 0=DESACTIVADO';
COMMENT ON COLUMN academico.pln_materias.nivel_academico IS 'Nivel Academico de la Materia';
COMMENT ON COLUMN academico.pln_materias.grupom IS 'Contiene grupos de materias Ej. FIS,QMC,MAT';
COMMENT ON COLUMN academico.pln_materias.mension IS 'Si la materia OPTATIVA o SELECTIVA';
COMMENT ON COLUMN academico.pln_materias.nota_minima IS 'Nota minima de aprobacion, defecto 51 y en algunas materias de auditoria 56';
COMMENT ON COLUMN academico.pln_materias.imprimir_certificado IS '''S'': SI SE IMPRIME
''N'': NO SE IMPRIME';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.bc_items_becas._ctrl_gestion IS 'Ultimo Gestion/Periodo Realizado';
COMMENT ON COLUMN balimentacion.bc_items_becas.fec_ini_con IS 'Fecha Inicio de la Convocatoria';
COMMENT ON COLUMN balimentacion.bc_items_becas.fec_fin_con IS 'Fecha Final de la Convocatoria';
SET search_path = academico, pg_catalog;
COMMENT ON COLUMN academico.alm_programas.nota_minima IS 'nota minima de aprob de postulantes';
COMMENT ON COLUMN academico.alm_programas.director IS 'actual director';
COMMENT ON COLUMN academico.alm_programas._tipo_academico IS 'CARRERA = CAR
PROGRAMA = PRO
TECNICO MEDIO = TEM
TECNICO SUPERIOR = TES
EXTENSION LIBRE = EXT
CURSO = CUR';
COMMENT ON COLUMN academico.alm_programas._tiene_examen_mesa IS 'Para las carreras que tienen habilitado el examen de mesa';
COMMENT ON COLUMN academico.alm_programas.clave_certificado IS '''SI'': Si requiere CLAVE Certificado de Notas para Programar
''NO'': NO requiere CLAVE';
COMMENT ON COLUMN academico.alm_programas.carnet_universitario IS '''SI'' Tiene Carnet de Universitario
''NO'' No ptiene Carnet Universitario';
COMMENT ON COLUMN academico.alm_programas.tiene_tramites IS '''SI'' = SI tiene tramites para estudiantes nuevos
''NO'' = El costo de tramite es de 0';
COMMENT ON COLUMN academico.alm_programaciones.marcador IS '1=gracia
2=mesa';
COMMENT ON COLUMN academico.alm_programaciones._estado IS '--REGISTRADO
--ANULADO';
COMMENT ON COLUMN academico.alm_programaciones.tipo_programacion IS '''ESPECIAL'',
''NORMAL'',
''PARALELA''
''LABORATORIO''';
COMMENT ON COLUMN academico.alm_programaciones.id_padre IS 'NULL = Materia Principal
Numero = ID padre 
Se aplica a CPA050, CPA051, Laboratorios Quimica o Fisica';
COMMENT ON COLUMN academico.alm_programas_facultades.decano IS 'decano actual';
COMMENT ON COLUMN academico.alumnos.id_plan IS 'PLAN DE LA CARRERA POR GESTION';
COMMENT ON COLUMN academico.alumnos.id_grado IS 'Sirve para cancelar matricula 
A=Activo,B=Bloqueado';
COMMENT ON COLUMN academico.alumnos.estado IS 'P=Activo
B=Bloqueado
A=Profesional
X=Anulado
T=Titulado 
S=Simultanea';
COMMENT ON COLUMN academico.alumnos.tipo_alumno IS 'Tipo de estudiante
B = Boliviano
N = Nacionalizado
E = Extrangero';
COMMENT ON COLUMN academico.alumnos.carrera IS 'NRO DE CARRERAS';
COMMENT ON COLUMN academico.alumnos.reprogramar IS '''N''=No reprogramo
''S''=Si reprogramo';
COMMENT ON COLUMN academico.carreras_universidades.estado IS 'A=Activada, D=Desactivada';
COMMENT ON COLUMN academico.dct_asignaciones.fecha IS 'fecha de finalizacion de planilla';
COMMENT ON COLUMN academico.dct_asignaciones.estado IS 'borrar este campo';
COMMENT ON COLUMN academico.dct_asignaciones.tipo_calificacion IS 'N= no ponderado
s= si se pondera';
COMMENT ON COLUMN academico.dct_asignaciones.finalizar IS 'N= notas activas
S= bajar pdf';
COMMENT ON COLUMN academico.dct_asignaciones.se_elegido IS 'N=no eligio sistema de eval
S= si eligio';
COMMENT ON COLUMN academico.dct_asignaciones.horario IS 'este es para laborattorios Dia|Valor de Inicio(hr)|Valor final(hr)';
COMMENT ON COLUMN academico.dct_asignaciones.id_ayudante IS 'id_alumno del ayudante';
COMMENT ON COLUMN academico.dct_asignaciones.id_horas IS 'TEORICAS
LABORATORIO';
COMMENT ON COLUMN academico.dct_asignaciones.tipo_docente IS 'TH = Tiempo Horario
TC = Tiempo Completo';
COMMENT ON COLUMN academico.dct_asignaciones.estado_calificado IS 'P = Pendiente,
E = Entregado,
C = Cerrado (Procesado),
R = Reapertura'';';
COMMENT ON COLUMN academico.dct_asignaciones.cant_inc IS 'Cantidad de adicion par el nuevo cumpo maximo';
COMMENT ON COLUMN academico.docentes.cargo IS 'docente-director de carrera...';
COMMENT ON COLUMN academico.docentes.tiempo IS 'TH:tiempo horario
TC:tiempo completo
I:investigador
E:extraordinario';
COMMENT ON COLUMN academico.notas_planilla.observacion IS '"A " = APROBADO
"H"  = HOMOLOGADO
"S"  = COMPENSADO
"U"  = DESCONOCIDO
"C"  = CONVALIDADO
"D"  = DICTAMEN
"Z"  = DESCONOCIDO
"T"  = DESCONOCIDO
"R"  = REPROBADO

';
COMMENT ON COLUMN academico.notas_planilla._fecha_creacion IS '-Fecha de registro de la fila';
COMMENT ON COLUMN academico.notas_planilla.__estado IS '''A'' = Automatico
''R'' = Reposicion de planilla
''S'' = Segundos Turnos
''C'' = Convalidaciones';
COMMENT ON COLUMN academico.planes.nivel_academico IS '<30 = Niveles Academicos Normales
30  = Materia Optativa
100 = Materia de Apoyo';
COMMENT ON COLUMN academico.planes.tipo IS 'P = Principal o Convalidacion
C = Control (Prerequisito de Prerequisito)
N = Prerequisito
A = Apoyo
M = Matricial
X = DESCONOCIDO
H = HOMOLOGADO
M = COMPENSADO
V = CONVALIDADO';
COMMENT ON COLUMN academico.planes.prog IS 'para que salga en la programacion al estudiante';
COMMENT ON COLUMN academico.planes.id IS '--Llave primaria improvisada';
COMMENT ON COLUMN academico.planes.observacion IS '--Descripcion necesaria para recordar cambios';
COMMENT ON COLUMN academico.universidades.estado IS 'A=Activado, D=Desactivado';
COMMENT ON COLUMN academico.universidades.comentarios IS 'Descripcion de los requisitos de cada universidad para propositos informativos.';
SET search_path = ambientes, pg_catalog;
COMMENT ON COLUMN ambientes.dct_ambientes.tipo IS '1=Aula 0=Otro';
SET search_path = auxiliares, pg_catalog;
COMMENT ON COLUMN auxiliares.aux_postulantes._tipo IS 'ESTADO DE POSTULACION 
P, A  =  POSTULANTE
A      =  AUXILIAR 

';
COMMENT ON COLUMN auxiliares.aux_programas._estado IS 'A = Anulado
S = Solicitado
V = Vigente
F = Finalizado';
COMMENT ON COLUMN auxiliares.aux_programas._correlativo IS '_correlativo por periodos
';
COMMENT ON COLUMN auxiliares.aux_programas.estado_designacion IS 'VALIDADO
PENDIENTE
ANULADO';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.bc_aprobados.tipo_beca IS 'C = COMPLETA (MONTO TOTAL)
P = PARCIAL (MONTO TOTAL / 2)
';
COMMENT ON COLUMN balimentacion.bc_aprobados.anios IS 'años de beneficio';
COMMENT ON COLUMN balimentacion.bc_aprobados.nivel IS 'nivel academico';
COMMENT ON COLUMN balimentacion.bc_configuracion.tipo_post IS 'A =  ALIMENTACION 
I   =  INTERNADO
T  = TODOS';
COMMENT ON COLUMN balimentacion.bc_configuracion.estado IS 'A = ACTIVADO
D = DESACTIVADO';
COMMENT ON COLUMN balimentacion.bc_planilla._peso IS 'PESO EN AÑOS PARA BECA ALIMENTACION';
COMMENT ON COLUMN balimentacion.bc_postulantes.id_gestion IS 'Gestion de la convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes.id_periodo IS 'Periodo Convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes.tipo_post IS 'tipo de beca de postulacion, 
A = Comedor(Alimentacion); 
I = internado

P = PARCIALES';
COMMENT ON COLUMN balimentacion.bc_postulantes.revisado IS 'A =ACEPTADO 
N= NO ACEPTADO
T =SUSPENDIDO TEMPORALMENTE (NO SUMPLE REQUERIEMITOS)';
COMMENT ON COLUMN balimentacion.bc_postulantes.estado IS 'A = ACEPTADO 
R = RECHAZASO
I  = INTERNADO ROTATORIO = ENF INTERNADO EJ.
S = SUSPENDIDO DEFINIVO';
COMMENT ON COLUMN balimentacion.bc_postulantes._estado IS 'R: REGISTRADO 
E: ELIMINADO';
COMMENT ON COLUMN balimentacion.bc_postulantes._ip_usuario IS 'ALMACENA LA DIRECCION IP DEL USUARIO';
COMMENT ON COLUMN balimentacion.bc_postulantes.help5 IS 'CON VERANO';
COMMENT ON COLUMN balimentacion.bc_postulantes.help6 IS 'CON MESA';
COMMENT ON COLUMN balimentacion.bc_postulantes.gestion_calificacion IS 'Gestion con la que se califica
Este parametro debe ser puesto por Bienestar';
COMMENT ON COLUMN balimentacion.bc_postulantes.periodo_calificacion IS 'Parametro del periodo con la que se califica
Este parametro debe ser puesto por Bienestar';
COMMENT ON COLUMN balimentacion.bc_postulantes.gestion_evaluacion IS 'Gestion con la que se evalua';
COMMENT ON COLUMN balimentacion.bc_postulantes.periodo_evaluacion IS 'Periodo Evaluacion';
COMMENT ON COLUMN balimentacion.bc_postulantes.estado_beca IS '''A'' = ACTIVO
''X'' = CONCLUIDO';
COMMENT ON COLUMN balimentacion.bc_postulantes.nro_convocatoria IS 'Nro de convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes.por_social IS 'Porcentaje Situacion Social (Internado = 50%, Alimentacion = 70%)';
COMMENT ON COLUMN balimentacion.bc_postulantes.por_acad_his IS 'Porcentaje Historial (0-100;  )';
COMMENT ON COLUMN balimentacion.bc_postulantes.por_acad_us IS 'Porcentaje Academico del Ultimo Semestre (0-100)';
COMMENT ON COLUMN balimentacion.bc_postulantes.id_oferta IS 'balimentacion.bc_items_becas.id';
COMMENT ON COLUMN balimentacion.bc_postulantes_2007.tipo_post IS 'tipo de beca de postulacion, C=comedor; I= internado';
COMMENT ON COLUMN balimentacion.bc_postulantes_2008.tipo_post IS 'tipo de beca de postulacion, C=comedor; I= internado';
COMMENT ON COLUMN balimentacion.o_bc_declaracion.declaracion_vivienda IS 'declaracion de vivienda';
COMMENT ON COLUMN balimentacion.o_bc_persona.ubi_latitud IS 'ubicacion latitud';
COMMENT ON COLUMN balimentacion.o_bc_persona.ubi_longitud IS 'Ubicacion longitud';
SET search_path = biblioteca, pg_catalog;
COMMENT ON COLUMN biblioteca.modulos.modulo1 IS 'insertar usuario';
COMMENT ON COLUMN biblioteca.modulos.modulo2 IS 'insertar libro';
COMMENT ON COLUMN biblioteca.modulos.modulo3 IS 'inseertar lector';
COMMENT ON COLUMN biblioteca.modulos.modulo4 IS 'prestamos';
COMMENT ON COLUMN biblioteca.modulos.modulo5 IS 'devoluciones';
COMMENT ON COLUMN biblioteca.modulos.modulo6 IS 'reportes';
COMMENT ON COLUMN biblioteca.modulos.modulo7 IS 'suspender lector';
COMMENT ON COLUMN biblioteca.modulos.modulo8 IS 'buscar_alumno';
COMMENT ON COLUMN biblioteca.modulos.modulo9 IS 'historial inscripcion';
COMMENT ON COLUMN biblioteca.prestamo_devolucion.fecha_devolucion_sistema IS 'fecha tope de devolucion del libro que es fijado por el sistema';
COMMENT ON COLUMN biblioteca.prestamo_devolucion.cl IS 'carnet de lector';
COMMENT ON COLUMN biblioteca.prestamo_devolucion.ci IS 'carnet de identidad';
COMMENT ON COLUMN biblioteca.prestamo_devolucion.cu IS 'carnet universitario';
COMMENT ON COLUMN biblioteca.prestamo_devolucion.fecha_devolucion_estudiante IS 'fecha en que el estudiante devuelve el libro';
COMMENT ON COLUMN biblioteca.reservas.estado IS 'prestado o no prestado sigue en reserva';
SET search_path = dep_titulos, pg_catalog;
COMMENT ON TABLE dep_titulos.borrar IS '2215
f  no
g fojas
h libre

';
SET search_path = elecciones, pg_catalog;
COMMENT ON COLUMN elecciones._posible_jurado.id_eleccion IS 'id de la eleccion a la que corresponde...';
SET search_path = log, pg_catalog;
COMMENT ON TABLE log.log_tablas_modificaciones IS 'Hasta cierta fecha no se guardaban los cambios cuando no la columna OLD o NEW eran NULL gracias al comparador';
SET search_path = net_uatf, pg_catalog;
COMMENT ON COLUMN net_uatf.equipos_red.tipo IS '1=''CARRERA'', 2=''FACULTAD'',3=''UNIDAD''';
COMMENT ON COLUMN net_uatf.equipos_red._estado IS 'A=Activo
X=Anulado';
COMMENT ON COLUMN net_uatf.unidades._estado IS 'A=Activo
X=Anulado';
SET search_path = postulantes, pg_catalog;
COMMENT ON COLUMN postulantes._postulaciones._estado_confirmacion IS '''PENDIENTE''
''VERIFICADO''';
COMMENT ON COLUMN postulantes.colegios.tipo IS 'Fiscal, Particular y Convenio';
COMMENT ON COLUMN postulantes.colegios.turno IS 'Diurno, Vespertino, Nocturno';
COMMENT ON COLUMN postulantes.colegios.area IS 'Urbano, Rural y urbano Provincial';
COMMENT ON COLUMN postulantes.postulantes.nota IS 'Nota del examen o preuniv';
SET search_path = recycler, pg_catalog;
COMMENT ON COLUMN recycler.alumnos_bloqueados.tipo_bloqueo IS 'D=SIN DIPLOMA
E=EXCESO DE SEGUNDOS TURNOS';
COMMENT ON COLUMN recycler.alumnos_bloqueados._estado IS 'A=Activo
X=Anulado';
COMMENT ON TABLE recycler.aud_link_archivos IS 'Almacena el nombre de los archivos para su descarga posterior';
COMMENT ON COLUMN recycler.aud_link_archivos.estado_archivo IS 'Activo o inactivo';
COMMENT ON COLUMN recycler.dct_cargo_tiempo.id_cargo IS 'ejem: asistente, catedratico, adjunto,etc';
COMMENT ON COLUMN recycler.dct_cargo_tiempo.tiempo IS 'th= tiempo horario,tc= tiempo completo,etc';
COMMENT ON COLUMN recycler.dct_cargo_tiempo.id_programa_item IS 'carrera a la que pertenece el docente';
COMMENT ON TABLE recycler.pgmreports IS 'PostgreSQL Manager reports repository table. Please don''t modify this table and its subobjects.';
COMMENT ON COLUMN recycler.plan_estudio.id_dpto IS 'Indica el estado de ma Materia
1=ACTIVO 0=DESACTIVADO';
COMMENT ON COLUMN recycler.plan_estudio.nivel_academico IS 'Nivel Academico de la Materia';
COMMENT ON COLUMN recycler.plan_estudio.verano IS 'S= SI habilitado
N= no habilitado';
COMMENT ON COLUMN recycler.plan_estudio.grupom IS 'Contiene grupos de materias Ej. FIS,QMC,MAT';
COMMENT ON COLUMN recycler.plan_estudio.mension IS 'Si la materia OPTATIVA o SELECTIVA';
COMMENT ON COLUMN recycler.pln_materias_new.id_dpto IS 'Indica el estado de ma Materia
1=ACTIVO 0=DESACTIVADO';
COMMENT ON COLUMN recycler.pln_materias_new.nivel_academico IS 'Nivel Academico de la Materia';
COMMENT ON COLUMN recycler.pln_materias_new.verano IS 'S= SI habilitado
N= no habilitado';
COMMENT ON COLUMN recycler.pln_materias_new.grupom IS 'Contiene grupos de materias Ej. FIS,QMC,MAT';
COMMENT ON COLUMN recycler.pln_materias_new.mension IS 'Si la materia OPTATIVA o SELECTIVA';
COMMENT ON COLUMN recycler.pln_materias_new.nota_minima IS 'Nota minima de aprobacion, defecto 51 y en algunas materias de auditoria 56';
COMMENT ON COLUMN recycler.pln_materias_new.metodo_paralela IS 'enlace a academico.metodos_paralelas para decidir la funcion a usar...';
COMMENT ON COLUMN recycler.postulantes_antes.nota IS 'Nota del examen o preuniv';
COMMENT ON COLUMN recycler.tit_requisitos.req_indispensable IS 'Obligado u opcional';
COMMENT ON COLUMN recycler.tit_requisitos.req_costo IS 'Costo de requisito';
COMMENT ON COLUMN recycler.tit_requisitos.id_usuario IS 'Usuario que crea o modifica';
COMMENT ON TABLE recycler.tit_tramites_requisitos IS 'Requisitos exigidos para un trámite en particular';
SET search_path = roles, pg_catalog;
COMMENT ON TABLE roles._bp_roles_usuarios IS 'TABLA PARA SECRETARIAS DECANATURAS';
COMMENT ON COLUMN roles._bp_usuarios._tipo_usuario IS '''N'': Normal
''S'': Super Usuario
''C'': Usuario de Cajas';
SET search_path = seguro, pg_catalog;
COMMENT ON COLUMN seguro.listas_generadas.tipo_lista IS 'SEGURO = Lista generada del seguro Uiversitario
EVALUACION = Lista para la evaluacion de las listas generadas';
SET search_path = webcienciaspuras, pg_catalog;
COMMENT ON COLUMN webcienciaspuras.dgo_userext.usuario IS 'login de usuario';
COMMENT ON COLUMN webcienciaspuras.dgo_userext.id_programa IS 'equivalente a carrera';
COMMENT ON COLUMN webcienciaspuras.dgo_userext.estado IS '1=usuario activo; 0=usuario inactivo(eliminado de consultas)';
SET search_path = academico, pg_catalog;
COMMENT ON TRIGGER trigg_delete_alm_programaciones ON alm_programaciones IS 'Se ejecuta despues de Borrar el registro y guarda la informaicon en "alm_programaciones_eliminados"';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.convocatorias.tipo_beca IS '''A'' = Alimentacion
''I'' = Internado';
SET search_path = solicitudes, pg_catalog;
COMMENT ON COLUMN solicitudes.alm_desprogramaciones.estado IS 'Solicitado';
SET search_path = cajas, pg_catalog;
COMMENT ON COLUMN cajas.recaudaciones.tipo_pago IS 'EFECTIVO, DEPOSITO';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.bc_postulantes_1.tipo_post IS 'tipo de beca de postulacion, C=comedor; I= internado
C = COMPLETAS
P = PARCIALES';
COMMENT ON COLUMN balimentacion.bc_postulantes_1.revisado IS 'A =ACEPTADO 
N= NO ACEPTADO
T =SUSPENDIDO TEMPORALMENTE (NO SUMPLE REQUERIEMITOS)';
COMMENT ON COLUMN balimentacion.bc_postulantes_1.estado IS 'A = ACEPTADO 
R = RECHAZASO
I  = INTERNADO ROTATORIO = ENF INTERNADO EJ.
S = SUSPENDIDO DEFINIVO';
COMMENT ON COLUMN balimentacion.bc_postulantes_1._estado IS 'R: REGISTRADO 
E: ELIMINADO';
COMMENT ON COLUMN balimentacion.bc_postulantes_1._ip_usuario IS 'ALMACENA LA DIRECCION IP DEL USUARIO';
COMMENT ON COLUMN balimentacion.bc_postulantes_1.help5 IS 'CON VERANO';
COMMENT ON COLUMN balimentacion.bc_postulantes_1.help6 IS 'CON MESA';
COMMENT ON RULE "NOUPDATE" ON balimentacion.bc_postulantes_1 IS 'NOUPDATE';
COMMENT ON COLUMN balimentacion.bc_items_becas_new.fec_ini_con IS 'Fecha Inicio de la Convocatoria';
COMMENT ON COLUMN balimentacion.bc_items_becas_new.fec_fin_con IS 'Fecha Final de la Convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.id_gestion IS 'Gestion de la convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.id_periodo IS 'Periodo Convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.tipo_post IS 'tipo de beca de postulacion, C=comedor; I= internado
C = COMPLETAS
P = PARCIALES';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.revisado IS 'A =ACEPTADO 
N= NO ACEPTADO
T =SUSPENDIDO TEMPORALMENTE (NO SUMPLE REQUERIEMITOS)';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.estado IS 'A = ACEPTADO 
R = RECHAZASO
I  = INTERNADO ROTATORIO = ENF INTERNADO EJ.
S = SUSPENDIDO DEFINIVO';
COMMENT ON COLUMN balimentacion.bc_postulantes_2._estado IS 'R: REGISTRADO 
E: ELIMINADO';
COMMENT ON COLUMN balimentacion.bc_postulantes_2._ip_usuario IS 'ALMACENA LA DIRECCION IP DEL USUARIO';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.help5 IS 'CON VERANO';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.help6 IS 'CON MESA';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.gestion_calificacion IS 'Gestion con la que se califica
Este parametro debe ser puesto por Bienestar';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.periodo_calificacion IS 'Parametro del periodo con la que se califica
Este parametro debe ser puesto por Bienestar';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.gestion_evaluacion IS 'Gestion con la que se evalua';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.periodo_evaluacion IS 'Periodo Evaluacion';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.estado_beca IS '''A'' = ACTIVO
''X'' = CONCLUIDO';
COMMENT ON COLUMN balimentacion.bc_postulantes_2.nro_convocatoria IS 'Nro de convocatoria';
COMMENT ON RULE "NOUPDATE" ON balimentacion.bc_postulantes_2 IS 'NOUPDATE';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.id_gestion IS 'Gestion de la convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.id_periodo IS 'Periodo Convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.tipo_post IS 'tipo de beca de postulacion, C=comedor; I= internado
C = COMPLETAS
P = PARCIALES';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.revisado IS 'A =ACEPTADO 
N= NO ACEPTADO
T =SUSPENDIDO TEMPORALMENTE (NO SUMPLE REQUERIEMITOS)';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.estado IS 'A = ACEPTADO 
R = RECHAZASO
I  = INTERNADO ROTATORIO = ENF INTERNADO EJ.
S = SUSPENDIDO DEFINIVO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck._estado IS 'R: REGISTRADO 
E: ELIMINADO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck._ip_usuario IS 'ALMACENA LA DIRECCION IP DEL USUARIO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.help5 IS 'CON VERANO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.help6 IS 'CON MESA';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.gestion_calificacion IS 'Gestion con la que se califica
Este parametro debe ser puesto por Bienestar';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.periodo_calificacion IS 'Parametro del periodo con la que se califica
Este parametro debe ser puesto por Bienestar';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.gestion_evaluacion IS 'Gestion con la que se evalua';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.periodo_evaluacion IS 'Periodo Evaluacion';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.estado_beca IS '''A'' = ACTIVO
''X'' = CONCLUIDO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bck.nro_convocatoria IS 'Nro de convocatoria';
COMMENT ON RULE "NOUPDATE" ON balimentacion.bc_postulantes_bck IS 'NOUPDATE';
COMMENT ON RULE "NOUPDATE" ON balimentacion.bc_postulantes IS 'NOUPDATE';
COMMENT ON COLUMN balimentacion.agenda_personal.fec_ini_pro IS 'Fecha Inicio de la Prorroga';
COMMENT ON COLUMN balimentacion.agenda_personal.fec_fin_pro IS 'Fecha Final de la Prorroga';
SET search_path = academico, pg_catalog;
COMMENT ON COLUMN academico.reposiciones.tipo IS 'ST = Exceso de Segundos Turnos
RP = Reposicion de Planilla
CP = Copia';
SET search_path = elecciones, pg_catalog;
COMMENT ON COLUMN elecciones.electores.tipo_elector IS '''E'' = Estudiante
''D'' = Docente';
COMMENT ON COLUMN elecciones.electores_2019_09_16.tipo_elector IS '''E'' = Estudiante
''D'' = Docente';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.becas_carreras.fec_ini_con IS 'Fecha Inicio de la Convocatoria';
COMMENT ON COLUMN balimentacion.becas_carreras.fec_fin_con IS 'Fecha Final de la Convocatoria';
SET search_path = preguntas, pg_catalog;
COMMENT ON COLUMN preguntas.salas.estado IS 'P=Pendiente, A=Atendido, F=Finalizado';
COMMENT ON COLUMN preguntas.mensajes.origen IS 'A=Alumno, R=Responsable';
COMMENT ON COLUMN preguntas.mensajes.tipo IS 'P=pregunta, R=Respuesta';
SET search_path = matriculas, pg_catalog;
COMMENT ON COLUMN matriculas.solicitudes.estado IS '''Solicitado'', ''Pagado'', ''Matriculado''';
COMMENT ON COLUMN matriculas.solicitudes.carrera IS 'NIVEL = EXTENSION UNIV';
COMMENT ON COLUMN matriculas.solicitudes.programacion IS 'GRUPO EN EXTENSION';
COMMENT ON COLUMN matriculas.solicitudes.tramite IS '(R)eadmision
(C)ambio Nuevo
(A)nulación
Tras(F)erencia
Pr(O)fesional-Nuevo
(T)raspaso
R(E)ad. y Cambio
Rea(D). y Transferencia
(P)aralela
Re(I)ngresa Nuevo

';
COMMENT ON COLUMN matriculas.solicitudes.tipo IS 'A = ANTIGUO 
N = NUEVO';
COMMENT ON COLUMN matriculas.solicitudes.tipo_verificado IS 'NUEVO=PRIMERA MATRICULA REGISTRADA
ANTIGUOS=SIGUIENTES MATRICULAS REGISTRADAS';
SET search_path = kardex, pg_catalog;
COMMENT ON COLUMN kardex.imagenes.estado IS '''PENDIENTE'', ''REVISADO'', ''CONCLUIDO''';
COMMENT ON COLUMN kardex.imagenes.usr_cre IS 'Usuario que creo el registro';
COMMENT ON COLUMN kardex.imagenes.usr_ver IS 'Usuario de Verificacion del Documento';
COMMENT ON COLUMN kardex.tramites.usr_cre IS 'Usuario que creo el registro';
SET search_path = matriculas, pg_catalog;
COMMENT ON COLUMN matriculas.valores_cargos.tipo_matricula IS '''R'' = Regular, ''N'' = Nuevo, ''P'' = Profesional';
COMMENT ON COLUMN matriculas.valores_cargos.tipo_matricula_ IS '''R'' = Regular, ''N'' = Nuevo, ''P'' = Profesional';
SET search_path = cajas, pg_catalog;
COMMENT ON COLUMN cajas.val_tra_dia.estado_matricula IS '''PENDIENTE'', ''MATRICULADO'', ''ERROR''';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.calificacion_grupos.estado IS '''ACTIVO'', ''INACTIVO''';
SET search_path = matriculas, pg_catalog;
COMMENT ON COLUMN matriculas.restringir.estado IS 'BLOQUEADO, ACTIVO = Puede vender Matricula';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.note_postulante.isbeca IS '''R'': Rechazado
''P'': Parcial
''C'': Completa';
SET search_path = estadisticas, pg_catalog;
COMMENT ON COLUMN estadisticas.datos_generales.estado IS 'SOLICITADO
ANULADO
CONSOLIDADO';
SET search_path = planillas, pg_catalog;
COMMENT ON COLUMN planillas.desprogramados.tipo IS '''BLOQUEADO'', ''ESPECIAL''';
COMMENT ON COLUMN planillas.control_recepcion.tipo_planilla IS '''CARRERA'', ''MATERIA'', ''REPOSICION''';
COMMENT ON COLUMN planillas.control_recepcion.validar IS '''NO'', ''SI''';
COMMENT ON COLUMN planillas.control_recepcion.estado_validacion IS '''RECEPCIONADO'', ''VERIFICAR'', ''OBSERVADO'', ''REGRESADO''';
COMMENT ON COLUMN planillas.control_recepcion.programacion_automatica IS 'SI = Programar Automaticamente
NO = Programacion Manual';
COMMENT ON COLUMN planillas.control_recepcion.estado_programacion_automatica IS '''PENDIENTE'' = Pendiente de programacion
''EJECUTADO'' = Se relaizo la programacion
''ANULADO''   = Se anulo la programacion';
COMMENT ON COLUMN planillas.control_recepcion.actualizar_kardex IS '''SI''
''NO''';
COMMENT ON COLUMN planillas.control_recepcion.estado_actualizar_kardex IS '''PENDIENTE''
''ACTUALIZADO''
''ANULADO''';
COMMENT ON COLUMN planillas.control_recepcion.estado_impresion IS '''PENDIENTE'', ''IMPRESO''';
SET search_path = cajas, pg_catalog;
COMMENT ON COLUMN cajas.val.estado_matricula IS '''PENDIENTE'', ''MATRICULADO'', ''ERROR''';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.id_gestion IS 'Gestion de la convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.id_periodo IS 'Periodo Convocatoria';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.tipo_post IS 'tipo de beca de postulacion, C=comedor; I= internado
C = COMPLETAS
P = PARCIALES';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.revisado IS 'A =ACEPTADO 
N= NO ACEPTADO
T =SUSPENDIDO TEMPORALMENTE (NO SUMPLE REQUERIEMITOS)';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.estado IS 'A = ACEPTADO 
R = RECHAZASO
I  = INTERNADO ROTATORIO = ENF INTERNADO EJ.
S = SUSPENDIDO DEFINIVO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk._estado IS 'R: REGISTRADO 
E: ELIMINADO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk._ip_usuario IS 'ALMACENA LA DIRECCION IP DEL USUARIO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.help5 IS 'CON VERANO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.help6 IS 'CON MESA';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.gestion_calificacion IS 'Gestion con la que se califica
Este parametro debe ser puesto por Bienestar';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.periodo_calificacion IS 'Parametro del periodo con la que se califica
Este parametro debe ser puesto por Bienestar';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.gestion_evaluacion IS 'Gestion con la que se evalua';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.periodo_evaluacion IS 'Periodo Evaluacion';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.estado_beca IS '''A'' = ACTIVO
''X'' = CONCLUIDO';
COMMENT ON COLUMN balimentacion.bc_postulantes_bk.nro_convocatoria IS 'Nro de convocatoria';
COMMENT ON RULE "NOUPDATE" ON balimentacion.bc_postulantes_bk IS 'NOUPDATE';
SET search_path = academico, pg_catalog;
COMMENT ON COLUMN academico.alm_programaciones_simulacion.marcador IS '1=gracia
2=mesa';
COMMENT ON COLUMN academico.alm_programaciones_simulacion._estado IS '--REGISTRADO
--ANULADO';
COMMENT ON COLUMN academico.alm_programaciones_simulacion.tipo_programacion IS '''ESPECIAL'',
''NORMAL'',
''PARALELA''';
SET search_path = seguro, pg_catalog;
COMMENT ON COLUMN seguro.lista_asegurados.materias_programadas IS 'Listado de las materias programadas en formato json';
COMMENT ON COLUMN seguro.lista_asegurados.estado_alumno IS '''R'': Regular
''P'': Profesional
''X'': Anulado
''B'': Bloqueado
''S'': Carrera Simultanea';
COMMENT ON COLUMN seguro.lista_asegurados.estado_no_profesional IS '''S'': Profesional
''N'': Estudiante Regular';
COMMENT ON COLUMN seguro.lista_asegurados.estado_seguro IS 'PENDIENTE, BAJA, ALTA';
SET search_path = cajas, pg_catalog;
COMMENT ON COLUMN cajas.programas_cuotas.estado IS '''VIGENTE'', ''CONCLUIDO'', ''ANULADO''';
SET search_path = sis_directores, pg_catalog;
COMMENT ON COLUMN sis_directores.dct_asignaciones_extra.fecha_modificacion_dir IS 'fecha de finalizacion de planilla';
COMMENT ON COLUMN sis_directores.dct_asignaciones_extra.tipo_docente IS 'TH = Tiempo Horario
TC = Tiempo Completo';
COMMENT ON COLUMN sis_directores.dct_asignaciones_extra.verificacion_estado IS 'V: Verificado, N: Sin Verificar';
SET search_path = elecciones, pg_catalog;
COMMENT ON COLUMN elecciones.lista_elecciones.vuelta IS '1 = 1ra Vuelta
2 = 2da Vuelta';
SET search_path = matriculas, pg_catalog;
COMMENT ON COLUMN matriculas.valores_cargos_programas.estado IS 'A = Activo
X = Anulado';
COMMENT ON COLUMN matriculas.cargos.tipo_cargo IS '''M'': Matricula
''A'': Adicional
''T'': Tramite';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.calificacion_evaluacion_detalles.estado_c_e IS 'Estado Calificacion/Evaluacion';
COMMENT ON COLUMN balimentacion.calificacion_evaluacion.id_tipo_beca IS '''A'': Alimentacion
''I'': Internado
''T'': Trabajo';
COMMENT ON COLUMN balimentacion.calificacion_evaluacion.tipo_calificacion IS '''C'' = Califiacion''
''E'' = Evaluacion';
COMMENT ON COLUMN balimentacion.calificacion_evaluacion.estado IS '''INICIADO'' : Proceso de Calificacion en Proceso
''IMPRIMIR'' : En Revision
''VALIDADO'' : Revisado y Aprobado (Planilla)';
COMMENT ON COLUMN balimentacion.calificacion_evaluacion.hash IS 'Hash de Cierre';
SET search_path = sis_odiseo, pg_catalog;
COMMENT ON COLUMN sis_odiseo.dct_asignaciones_extra.fecha_modificacion_dir IS 'fecha de finalizacion de planilla';
COMMENT ON COLUMN sis_odiseo.dct_asignaciones_extra.tipo_docente IS 'TH = Tiempo Horario
TC = Tiempo Completo';
COMMENT ON COLUMN sis_odiseo.dct_asignaciones_extra.verificacion_estado IS 'V: Verificado, N: Sin Verificar';
SET search_path = planillas, pg_catalog;
COMMENT ON COLUMN planillas.certificados.exceso_2do_turno IS '''S'': Existe un exceso de 2dos turno
''N'': Sin excesos de segundos turno';
COMMENT ON COLUMN planillas.certificados.obs IS '''A'': Automatico
''RP'': Reposicion
''ST'': Excesos de Segundos Turnos
''RC'': Regularizacion de Certificado';
COMMENT ON COLUMN planillas.certificados.nro_com IS 'Nro de comprobante de caja';
COMMENT ON COLUMN planillas.certificados.cat_imp IS 'Cantidad de Impresiones';
SET search_path = sau, pg_catalog;
COMMENT ON COLUMN sau.examenes.tiempo IS 'Expresado en minutos';
COMMENT ON COLUMN sau.examenes.orden IS '1 = RANDOMICO
2 = MISMO ORDEN PARA TODOS';
COMMENT ON COLUMN sau.examen_postulante.estado IS '''INICIADO'' = Examen Iniciado
''FINALIZADO'' = Examen finalizado
''OBS'' = Examen Observado';
COMMENT ON COLUMN sau.examen_postulante.resultado IS 'NULL = Sin resultado
''ACEPTADO'' = Aceptado
''RECHAZADO'' = Not Insuficiente';
COMMENT ON COLUMN sau.examen_postulante.orden IS '''R'' = Randomico
''O'' = Orden';
COMMENT ON COLUMN sau.examen_tipo_pregunta.porcentaje IS '% de la prueba';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.grados_instruccion.estado IS 'A = ACTIVO
X = No Activo';
COMMENT ON COLUMN balimentacion.calificacion_detalles.estado IS '''VIGENTE'': Activo
''INACTIVO'': NO Activo';
SET search_path = academico, pg_catalog;
COMMENT ON COLUMN academico.planes_inf.id IS '--Llave primaria improvisada';
COMMENT ON COLUMN academico.planes_inf.nivel_academico IS '<30 = Niveles Academicos Normales
30  = Materia Optativa
100 = Materia de Apoyo';
COMMENT ON COLUMN academico.planes_inf.tipo IS '''P'' = Plan
''C'' = Control
A = Apoyo
M = Matricial
X = DESCONOCIDO
H = HOMOLOGADO
M = COMPENSADO
V = CONVALIDADO';
COMMENT ON COLUMN academico.planes_inf.obs IS '--Descripcion necesaria para recordar cambios';
COMMENT ON COLUMN academico.planes_inf.estado IS '''V'' = Vigente
''X'' = ANulado / No VIgente';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.investigacion_social.ref_caso IS 'REFERENCIA DEL CASO';
COMMENT ON COLUMN balimentacion.investigacion_social.ant_familia IS 'ANTECEDENTES DE LA FAMILIA';
COMMENT ON COLUMN balimentacion.investigacion_social.sit_act_estudiante IS 'SITUACION ACTUAL DEL UNIVERSITARIO';
COMMENT ON COLUMN balimentacion.investigacion_social.concep_social IS 'CONCEPTO SOCIAL';
COMMENT ON COLUMN balimentacion.investigacion_social.conclusion IS 'CONCLUCIONES';
SET search_path = auxiliares, pg_catalog;
COMMENT ON COLUMN auxiliares.auxiliares.id_programa IS 'Carrera que designa el ITEM de Auxiliatura';
COMMENT ON COLUMN auxiliares.auxiliares.tipo_auxiliar IS 'TITULAR
INVITADO
INVITADO ADHONOREM';
COMMENT ON COLUMN auxiliares.auxiliares.fecha_conclusion IS 'Fecha en la que dejo de ser ayudante';
COMMENT ON COLUMN auxiliares.auxiliares.id_materia_postulacion IS 'id_materia = Materia la cual se oferto puede ser de otras carrera';
COMMENT ON COLUMN auxiliares.auxiliares.id_materia_carrera IS 'id_materia= Materia de la cual aprobo en la carrera del estudiante';
SET search_path = matriculas, pg_catalog;
COMMENT ON COLUMN matriculas.matriculas_digitales.id_tipo_tramite IS '''M'' = Matricula
''C'' = Curso Auxiliatura';
COMMENT ON COLUMN matriculas.matriculas_digitales.tipo_matricula_estudiante IS 'ER = Estudiante Regular
EN = Estudiante Nuevo
PN = Profesional Nuevo
PR = Profesional Regular';
SET search_path = cajas, pg_catalog;
COMMENT ON COLUMN cajas.extracto_bancario.estado IS '''PENDIENTE'', ''CONCILIADO''';
SET search_path = balimentacion, pg_catalog;
COMMENT ON COLUMN balimentacion.investigacion_social_2.ref_caso IS 'REFERENCIA DEL CASO';
COMMENT ON COLUMN balimentacion.investigacion_social_2.ant_familia IS 'ANTECEDENTES DE LA FAMILIA';
COMMENT ON COLUMN balimentacion.investigacion_social_2.sit_act_estudiante IS 'SITUACION ACTUAL DEL UNIVERSITARIO';
COMMENT ON COLUMN balimentacion.investigacion_social_2.concep_social IS 'CONCEPTO SOCIAL';
COMMENT ON COLUMN balimentacion.investigacion_social_2.conclusion IS 'CONCLUCIONES';
SET search_path = dar, pg_catalog;
COMMENT ON COLUMN dar.usuarios.estado IS 'A=Activado; D= Desactivado';
COMMENT ON COLUMN dar.usuarios.permisos IS 'Permisos de usuario';
COMMENT ON COLUMN dar.dar_documentos.documento IS 'N = C. Notas; A = Actas;';
COMMENT ON COLUMN dar.dar_documentos.estado IS 'I = Inicio; R = Revisado; D = Decretado; A = DSA; V = Vicerrectorado;  F = Fin; X= Anulado';
COMMENT ON COLUMN dar.dar_documentos.revisado IS 'fecha revisado';
COMMENT ON COLUMN dar.dar_documentos.decretado IS 'fecha decretado';
COMMENT ON COLUMN dar.dar_documentos.recibido IS 'fecha recibido';
COMMENT ON COLUMN dar.dar_libros.fecha IS 'fecha registro';
COMMENT ON COLUMN dar.dar_libros.libro IS 'D = Devuelto; A = DSA; V = Vicerrectorado';
SET search_path = cajas, pg_catalog;
COMMENT ON COLUMN cajas.pagos.estado IS 'SOLICITADO, EN_PROCESO, PAGADO, ANULADO';
SET search_path = tramites, pg_catalog;
COMMENT ON COLUMN tramites.suspensiones_readmisiones.tipo_tramite IS '''SR'' = Suspension / Readmision
''PREA'' = Programa de Reincorporacion Estudiantil Academica';
SET search_path = cajas, pg_catalog;
COMMENT ON COLUMN cajas.pagos_ppe.id_alumno IS 'Valor contiene el id_alumno de alumnos, o id_alumno de postulantes';
COMMENT ON COLUMN cajas.pagos_ppe.estado IS '''SOLICITADO'' -> ''EN_PROCESO'' -> ''PAGADO''';
COMMENT ON COLUMN cajas.cargos_conceptos.estado IS '''V'' = VIgente
''X'' = No vigente';
SET search_path = matriculas, pg_catalog;
COMMENT ON COLUMN matriculas.habilitados.multa_nuevos IS '''S'' = Si Aplica Multas
''N'' = Sin multas';
COMMENT ON COLUMN matriculas.solicitudes_matriculas.tipo_matricula IS '''N'' = Nuevo
''R'' = Regualar
''PREA'' = Programa Retorno';
SET search_path = academico, pg_catalog;
COMMENT ON COLUMN academico.pln_materias_tmp.id_dpto IS 'Indica el estado de la Materia
1=ACTIVO 0=DESACTIVADO';
COMMENT ON COLUMN academico.pln_materias_tmp.nivel_academico IS 'Nivel Academico de la Materia';
COMMENT ON COLUMN academico.pln_materias_tmp.grupom IS 'Contiene grupos de materias Ej. FIS,QMC,MAT';
COMMENT ON COLUMN academico.pln_materias_tmp.mension IS 'Si la materia OPTATIVA o SELECTIVA';
COMMENT ON COLUMN academico.pln_materias_tmp.nota_minima IS 'Nota minima de aprobacion, defecto 51 y en algunas materias de auditoria 56';
COMMENT ON COLUMN academico.pln_materias_tmp.imprimir_certificado IS '''S'': SI SE IMPRIME
''N'': NO SE IMPRIME';
SET search_path = sau, pg_catalog;
COMMENT ON COLUMN sau.examen_tipos_grupos.porcentaje IS '% de la prueba';
SET search_path = matriculas, pg_catalog;
COMMENT ON COLUMN matriculas.programas_cargos.estado IS 'A=Activo, X=Anulado';
SET search_path = academico, pg_catalog;
COMMENT ON COLUMN academico.pln_materias_resplado.id_dpto IS 'Indica el estado de la Materia
1=ACTIVO 0=DESACTIVADO';
COMMENT ON COLUMN academico.pln_materias_resplado.nivel_academico IS 'Nivel Academico de la Materia';
COMMENT ON COLUMN academico.pln_materias_resplado.grupom IS 'Contiene grupos de materias Ej. FIS,QMC,MAT';
COMMENT ON COLUMN academico.pln_materias_resplado.mension IS 'Si la materia OPTATIVA o SELECTIVA';
COMMENT ON COLUMN academico.pln_materias_resplado.nota_minima IS 'Nota minima de aprobacion, defecto 51 y en algunas materias de auditoria 56';
COMMENT ON COLUMN academico.pln_materias_resplado.imprimir_certificado IS '''S'': SI SE IMPRIME
''N'': NO SE IMPRIME';
SET search_path = public, pg_catalog;
COMMENT ON COLUMN public.matriculas.estado IS 'A = ACTIVO
B = BLOQUEADO';
COMMENT ON COLUMN public.matriculas.carrera IS 'NIVEL = EXTENSION UNIV';
COMMENT ON COLUMN public.matriculas.programacion IS 'GRUPO EN EXTENSION';
COMMENT ON COLUMN public.matriculas.tramite IS '''REGULAR'', 
''READMISION'', 
''CANBIO DE CARREA'',
''EXTENSION''';
COMMENT ON COLUMN public.matriculas.tipo IS 'A = ANTIGUO 
N = NUEVO';
COMMENT ON COLUMN public.matriculas.tipo_verificado IS 'NUEVO=PRIMERA MATRICULA REGISTRADA
ANTIGUOS=SIGUIENTES MATRICULAS REGISTRADAS';
COMMENT ON COLUMN public.matriculas.id_tipo IS '''E'' = Estudiante
''P'' = Profesional
''EX'' = Estudiante Extranjero
''ET'' = Extension Libre Quechua Trabajo Social
''EQ'' = Extension LiBre Quechua';
COMMENT ON COLUMN public.matriculas.tipo_matricula IS 'R = Matricula Regular
D = Matricula Digital
C = Matricula Covid-19
A = Matricula Automatica (para dos semestres)';
COMMENT ON COLUMN public.prs_colegios.tipo IS 'Fiscal, Particular y Convenio';
COMMENT ON COLUMN public.prs_colegios.turno IS 'Diurno, Vespertino, Nocturno';
COMMENT ON COLUMN public.prs_colegios.area IS 'Urbano, Rural y urbano Provincial';
COMMENT ON COLUMN public.uatf_datos.id_calificacion IS '1 = FISCAL
2 = PARTICULAR
B = PROFESIONAL
X = EXTRANJERO';
COMMENT ON COLUMN public.valores_cargos.tipo_matricula IS '''R'' = Regular, ''N'' = Nuevo, ''P'' = Profesional';
COMMENT ON TABLE public.dar_tramites IS 'desc_tramite = ''6'' = ACTA - Proyecto de Grado ';
COMMENT ON COLUMN public.dar_tramites.tipo_tramite IS 'N=Provehido Notas
A=Provehido Actas
DESCONOCIDOS';
COMMENT ON COLUMN public.postulantes.estado IS 'P = ''EN CASO DE REPROBADOS''
A = ''EN CASO DE APROBADOS''
';
COMMENT ON COLUMN public.postulantes.nota IS 'Nota del examen o preuniv';
COMMENT ON COLUMN public.postulantes.nro_impresiones IS 'Cantidad de Impresiones de la Confirmacion';
COMMENT ON COLUMN public.postulantes.id_recaudaciones IS 'ID de la tabla de cajas.recaudaciones';
COMMENT ON COLUMN public.postulantes.id_postulaciones IS 'id tabla postulantes._postulaciones';
COMMENT ON COLUMN public.cajas_transacciones.id_trans IS 'NUEVOS REQUERIMIENTOS 2013 CON DAF';
COMMENT ON COLUMN public.cajas_transacciones.importe_deposito IS 'Importe del Deposito';
COMMENT ON TABLE public.alm_cursos IS 'Tabla para cursos de extesion libre u otros que las carreras la soliciten';
COMMENT ON COLUMN public.alm_cursos._estado IS 'A = ACTIVO
B = BLOQUEADO
E = ELIMINADO
V = VALIDADO';
COMMENT ON COLUMN public.alm_cursos._tipo_academico IS 'CARRERA = CAR
PROGRAMA = PRO
TECNICO MEDIO = TEM
TECNICO SUPERIOR = TES
EXTENSION LIBRE = EXT
CURSO = CUR';
COMMENT ON COLUMN public.alm_programas_postgrado.id_postgrado IS 'Codigo Postgrado - Carrera ej. PMED';
COMMENT ON COLUMN public.alm_programas_postgrado.estado IS 'A=Activo B=Bloqueado';
COMMENT ON COLUMN public.alm_programas_postgrado.nota_minima IS 'nota minima de aprob de postulantes';
COMMENT ON COLUMN public.auxiliares.tipo_auxiliar IS 'TITULAR
INVITADO
INVITADO ADHONOREM';
COMMENT ON COLUMN public.auxiliares.fecha_conclusion IS 'Fecha en la que dejo de ser ayudante';
COMMENT ON COLUMN public.comisiones.estado_comision IS '''VIGENTE'', '' SUSPENDIDO'', ''ANULADO''';
COMMENT ON TABLE public.correlativo IS '982: Cantidad de Personas por Periodo
981: Correlativo Numero Factura ';
COMMENT ON COLUMN public.dar_cambios_carrera.estado IS 'A=Activo
C=Aceptado
R=Rechazado
B=Bloqueado';
COMMENT ON COLUMN public.dar_cambios_carrera.convalidacion IS 'S=Con convalidacion
N=Sin convalidacion';
COMMENT ON COLUMN public.dar_cambios_carrera.requisito1 IS '50% de materias aprobadas
S=Si cumple
N=No cumple';
COMMENT ON COLUMN public.dar_cambios_carrera.requisito2 IS 'antiguedad de 1 anio
S=Si cumple
N=No cumple';
COMMENT ON COLUMN public.dar_cambios_carrera.requisito3 IS 'programacion el semestre o gestion anterior
S=Si cumple
N=No cumple';
COMMENT ON COLUMN public.dar_cambios_carrera.nro_dip IS 'numero de identificacion personal';
COMMENT ON COLUMN public.dar_readmisiones.tipo IS 'S=semestral
A=Anual';
COMMENT ON COLUMN public.dar_readmisiones.estado IS 'P = En proceso, Activo
R = Aceptado (Revisado) la readmision (Anulado)
T = Readmitido(Terminado)
F = Rechazado
X = Anulado
A = Aceptado a patir 2024';
COMMENT ON TABLE public.dar_sis_activacion IS 'tabla para guardar activacion de sistemas para DAR';
COMMENT ON COLUMN public.dar_sis_activacion.nombresis IS 'Sigla para el sistema';
COMMENT ON COLUMN public.dar_sis_activacion.estado IS 'A=Activado
D=Desactivado';
COMMENT ON COLUMN public.dar_sis_activacion.titulo IS 'titulo del sistema';
COMMENT ON COLUMN public.dar_sis_activacion.enpantalla IS 'S=SI
N=NO';
COMMENT ON TABLE public.dar_suspensiones IS 'tabla de suspension de estudios';
COMMENT ON COLUMN public.dar_suspensiones.fecha_realizado IS 'fecha de realizacion de la solicitud';
COMMENT ON COLUMN public.dar_suspensiones.tiempo IS 'tiempo calculado de la cantidad de gestiones o semestres';
COMMENT ON COLUMN public.dar_suspensiones.tipo IS 'A=Anual
S=Semestral';
COMMENT ON COLUMN public.dar_suspensiones.estado IS 'A=Activo
C=Aceptado
R=Rechazado
RP = Revisado Pendiente de Pago
B=Bloqueado';
COMMENT ON COLUMN public.dar_suspensiones.editar IS 'S=edicion permitida
N=edicion no permitida';
COMMENT ON COLUMN public.dar_transferencias.estado IS 'A=Activo
C=Aceptado
R=Rechazado
B=Bloqueado';
COMMENT ON COLUMN public.dar_transferencias.convalidacion IS 'S=Con convalidacion
N=Sin convalidacion';
COMMENT ON COLUMN public.dar_transferencias.requisito1 IS '50% de materias aprobadas
S=Si cumple
N=No cumple';
COMMENT ON COLUMN public.dar_transferencias.requisito2 IS 'Antiguedad de 1 anio en la carrera
S=Si cumple
N=No cumple';
COMMENT ON COLUMN public.dar_transferencias.requisito3 IS 'programacion de materias en la gestion o semestre anterior
S=Si cumple
N=No cumple';
COMMENT ON COLUMN public.dar_transferencias.nro_dip IS 'numero de documento de identidad personal';
COMMENT ON COLUMN public.dar_traspasos.estado IS 'A=Activo, C=CompletadoAceptado, R=CompletadoRechazado, B=ActivoBloqueado, K=Caducado';
COMMENT ON COLUMN public.dar_traspasos.req1 IS 't=cumple con requisito de materias programadas actuales';
COMMENT ON COLUMN public.dar_traspasos.req2 IS 't=cumple con requisito de 2 materias aprobadas para sistema anual o 4 materias aprobadas para sistema semestral';
COMMENT ON COLUMN public.dar_traspasos.motivos IS 'motivos de desbloqueo';
COMMENT ON COLUMN public.data_notificaciones.tipo IS 'Tipo de notificacion 
''T'' = Todos
''S'' = Secretarias';
COMMENT ON TABLE public.deudas_solvencia IS 'tabla de registro de deudores y deudas para la solvencia universitaria';
COMMENT ON COLUMN public.deudas_solvencia.estado IS 'A=Deuda Activa
D=Deuda Pagada
P=Deuda pagada parcialmente';
COMMENT ON COLUMN public.deudas_solvencia.tipo IS 'D=deuda
P=Pago Parcial
T=Pago Total';
COMMENT ON COLUMN public.deudas_solvencia.id_deuda_padre IS 'id_deuda relaciona el pago con la deuda';
COMMENT ON TABLE public.e_tipo_legal IS 'tramites vicerrectorado';
COMMENT ON COLUMN public.e_tramites.id_tipo_tramite IS 'segun el tipo de tramite puede ser certificacion de notas,acta de defensa,etc';
COMMENT ON COLUMN public.gestion_periodo.periodo IS 'si el tipo de sistema es 
1= perdios academicos
2= Meses de la planilla';
COMMENT ON COLUMN public.gestion_periodo.tipo_sistema IS '3 - Tramites (Suspensiones Readmisiones)
1 - ?';
COMMENT ON COLUMN public.m_claves_acceso.estado IS 'A= activado; B=Bloqueado';
COMMENT ON COLUMN public.miembros.estado_miembro IS '''VIGENTE'', ''SUSPENDIDO'', ''ANULADO''';
COMMENT ON TABLE public.nivel_salarial IS 'Niveles Salariales';
COMMENT ON COLUMN public.nivel_salarial.id_tip_pla IS 'Tipo de Planilla';
COMMENT ON COLUMN public.percepciones_deducciones.tipo IS 'A = item_percepciones_deducciones
F = Aplica la formula';
COMMENT ON COLUMN public.preguntas__original.ref_pregunta IS 'TRIAL';
COMMENT ON COLUMN public.preguntas__original._1 IS 'TRIAL';
COMMENT ON COLUMN public.preguntas__original."0" IS 'TRIAL';
COMMENT ON COLUMN public.preguntas__original.pregunta IS 'TRIAL';
COMMENT ON COLUMN public.preguntas__original.opcion1 IS 'TRIAL';
COMMENT ON COLUMN public.preguntas__original.opcion2 IS 'TRIAL';
COMMENT ON COLUMN public.preguntas__original.opcion3 IS 'TRIAL';
COMMENT ON COLUMN public.preguntas__original.opcion4 IS 'TRIAL';
COMMENT ON COLUMN public.preguntas__original.respuesta IS 'TRIAL';
COMMENT ON COLUMN public.prs_colegios_2.tipo IS 'Fiscal, Particular y Convenio';
COMMENT ON COLUMN public.prs_colegios_2.turno IS 'Diurno, Vespertino, Nocturno';
COMMENT ON COLUMN public.prs_colegios_2.area IS 'Urbano, Rural y urbano Provincial';
COMMENT ON COLUMN public.prs_observaciones.tipo IS 'Postulante, Nuevo, Regular, Docente, Administrativo';
COMMENT ON COLUMN public.solvencias.estado IS 'A=Activo
C=Completado
R=Rechazado
U=Caducado';
COMMENT ON COLUMN public.solvencias.tipo IS 'tipo de solvencia
A=defensa de tesis
B=Diploma Academico
C=Diploma en provision nacional
';
COMMENT ON COLUMN public.valores_cargos_adicionales.tipo_matricula IS '''R''=Regulares, ''N''=Nuevos';
COMMENT ON INDEX idx_ra IS 'INDEX ID_RA';
