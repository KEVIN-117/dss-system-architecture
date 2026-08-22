-- ============================================================
-- DIMENSIÓN: ESTUDIANTE
-- ============================================================

CREATE TABLE dim_estudiante (
    id_estudiante_sk BIGSERIAL PRIMARY KEY,

    -- Natural Key proveniente del sistema origen
    id_alumno VARCHAR(50) NOT NULL,

    genero VARCHAR(30),
    estado_civil VARCHAR(50),
    nacionalidad VARCHAR(100),
    colegio_origen VARCHAR(200),
    tipo_colegio VARCHAR(50),
    localidad VARCHAR(150),
    sede_universitaria VARCHAR(150),
    nivel_academico VARCHAR(100),
    tipo_alumno VARCHAR(50),

    CONSTRAINT uq_dim_estudiante_id_alumno
        UNIQUE (id_alumno)
);


-- ============================================================
-- DIMENSIÓN: PROGRAMA
-- ============================================================

CREATE TABLE dim_programa (
    id_programa_sk BIGSERIAL PRIMARY KEY,

    -- Natural Key
    id_programa VARCHAR(50) NOT NULL,

    carrera VARCHAR(200),
    facultad VARCHAR(200),
    facultad_abrev VARCHAR(50),
    area_conocimiento VARCHAR(150),

    CONSTRAINT uq_dim_programa_id_programa
        UNIQUE (id_programa)
);


-- ============================================================
-- DIMENSIÓN: MATERIA
-- ============================================================

CREATE TABLE dim_materia (
    id_materia_sk BIGSERIAL PRIMARY KEY,

    -- Natural Key
    id_materia VARCHAR(50) NOT NULL,

    sigla VARCHAR(50),
    nombre_materia VARCHAR(200),

    CONSTRAINT uq_dim_materia_id_materia
        UNIQUE (id_materia)
);


-- ============================================================
-- DIMENSIÓN: ADMISIÓN
-- ============================================================

CREATE TABLE dim_admision (
    id_admision_sk BIGSERIAL PRIMARY KEY,

    -- Natural Key
    id_examen VARCHAR(50) NOT NULL,

    modalidad_ingreso VARCHAR(100),

    CONSTRAINT uq_dim_admision_id_examen
        UNIQUE (id_examen)
);


-- ============================================================
-- DIMENSIÓN: PERIODO ACADÉMICO
-- ============================================================

CREATE TABLE dim_periodo_academico (
    id_periodo_sk BIGSERIAL PRIMARY KEY,

    gestion INTEGER NOT NULL,
    periodo INTEGER NOT NULL,
    tipo_periodo VARCHAR(50),
    descripcion VARCHAR(200),

    CONSTRAINT uq_dim_periodo
        UNIQUE (gestion, periodo)
);


-- ============================================================
-- TABLA DE HECHOS: RENDIMIENTO ACADÉMICO
-- ============================================================

CREATE TABLE fact_rendimiento_academico (
    id_estudiante_sk BIGINT NOT NULL,
    id_programa_sk BIGINT NOT NULL,
    id_materia_sk BIGINT NOT NULL,
    id_periodo_sk BIGINT NOT NULL,
    id_admision_sk BIGINT NOT NULL,

    -- Métricas / indicadores
    postulante INTEGER DEFAULT 0,
    admitido INTEGER DEFAULT 0,

    nota_final NUMERIC(5,2),

    reprobado INTEGER DEFAULT 0,
    repitente INTEGER DEFAULT 0,
    desertor INTEGER DEFAULT 0,

    probabilidad_riesgo NUMERIC(6,5),
    alto_riesgo INTEGER DEFAULT 0,

    indice_dependencia INTEGER,
    demanda_proyectada INTEGER,

    importancia_variable NUMERIC(8,5),

    -- Clave primaria compuesta
    CONSTRAINT pk_fact_rendimiento_academico
        PRIMARY KEY (
            id_estudiante_sk,
            id_programa_sk,
            id_materia_sk,
            id_periodo_sk,
            id_admision_sk
    ),

    -- Foreign Keys
    CONSTRAINT fk_fact_estudiante
        FOREIGN KEY (id_estudiante_sk)
        REFERENCES dim_estudiante(id_estudiante_sk),

    CONSTRAINT fk_fact_programa
        FOREIGN KEY (id_programa_sk)
        REFERENCES dim_programa(id_programa_sk),

    CONSTRAINT fk_fact_materia
        FOREIGN KEY (id_materia_sk)
        REFERENCES dim_materia(id_materia_sk),

    CONSTRAINT fk_fact_periodo
        FOREIGN KEY (id_periodo_sk)
        REFERENCES dim_periodo_academico(id_periodo_sk),

    CONSTRAINT fk_fact_admision
        FOREIGN KEY (id_admision_sk)
        REFERENCES dim_admision(id_admision_sk)
);