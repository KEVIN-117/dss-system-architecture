-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Create Dummy Foreign Servers for FDW
CREATE SERVER IF NOT EXISTS server_daf
FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (host 'localhost', dbname 'jachasun', port '5432');

CREATE SERVER IF NOT EXISTS server_titulos
FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (host 'localhost', dbname 'jachasun', port '5432');

-- Create Functions in public schema
CREATE OR REPLACE FUNCTION public.identificador(val character varying)
RETURNS varchar AS $$
BEGIN
    RETURN val;
END;
$$ LANGUAGE plpgsql;

-- Create Types in public schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 't_modificacion') THEN
        CREATE TYPE public.t_modificacion AS (
            columna varchar,
            antes varchar,
            despues varchar
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 't_primary_key') THEN
        CREATE TYPE public.t_primary_key AS (
            columna varchar,
            valor varchar
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 't_reposiciones') THEN
        CREATE TYPE public.t_reposiciones AS (
            sigla varchar,
            nota integer
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 't_e_certificados') THEN
        CREATE TYPE public.t_e_certificados AS ENUM ('SOLICITADO', 'IMPRESO', 'ENTREGADO', 'ANULADO', 'PROCESO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_tipo') THEN
        CREATE TYPE public.enum_tipo AS ENUM ('SOLICITADO', 'ACTIVO', 'INACTIVO', 'PROCESO', 'ANULADO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'e_cargos_conceptos') THEN
        CREATE TYPE public.e_cargos_conceptos AS ENUM ('CONCEPTOS', 'CARGOS', 'OTROS');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ubicacion_decreto') THEN
        CREATE TYPE public.ubicacion_decreto AS ENUM ('facultad', 'rectorado', 'archivo', 'proceso');
    END IF;
END$$;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS _json;
CREATE SCHEMA IF NOT EXISTS academico;
CREATE SCHEMA IF NOT EXISTS actas_graduacion;
CREATE SCHEMA IF NOT EXISTS actas_siagra;
CREATE SCHEMA IF NOT EXISTS agenda_aux;
CREATE SCHEMA IF NOT EXISTS ambientes;
CREATE SCHEMA IF NOT EXISTS auditoria;
CREATE SCHEMA IF NOT EXISTS auxiliares;
CREATE SCHEMA IF NOT EXISTS b_investigacion;
CREATE SCHEMA IF NOT EXISTS balimentacion;
CREATE SCHEMA IF NOT EXISTS becas;
CREATE SCHEMA IF NOT EXISTS bgraduacion;
CREATE SCHEMA IF NOT EXISTS biblioteca;
CREATE SCHEMA IF NOT EXISTS binvestigacion;
CREATE SCHEMA IF NOT EXISTS bot;
CREATE SCHEMA IF NOT EXISTS btrabajo;
CREATE SCHEMA IF NOT EXISTS cajas;
CREATE SCHEMA IF NOT EXISTS calendario;
CREATE SCHEMA IF NOT EXISTS consola;
CREATE SCHEMA IF NOT EXISTS consola_datacenter;
CREATE SCHEMA IF NOT EXISTS conteo;
CREATE SCHEMA IF NOT EXISTS convocatorias;
CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS cronograma;
CREATE SCHEMA IF NOT EXISTS curriculum;
CREATE SCHEMA IF NOT EXISTS daf;
CREATE SCHEMA IF NOT EXISTS dar;
CREATE SCHEMA IF NOT EXISTS dep_titulos;
CREATE SCHEMA IF NOT EXISTS designaciones;
CREATE SCHEMA IF NOT EXISTS diu;
CREATE SCHEMA IF NOT EXISTS elecciones;
CREATE SCHEMA IF NOT EXISTS encuestas;
CREATE SCHEMA IF NOT EXISTS estadisticas;
CREATE SCHEMA IF NOT EXISTS estudiantes;
CREATE SCHEMA IF NOT EXISTS extension;
CREATE SCHEMA IF NOT EXISTS frida;
CREATE SCHEMA IF NOT EXISTS hermes;
CREATE SCHEMA IF NOT EXISTS herramientas;
CREATE SCHEMA IF NOT EXISTS infraestructura;
CREATE SCHEMA IF NOT EXISTS jobs;
CREATE SCHEMA IF NOT EXISTS kardex;
CREATE SCHEMA IF NOT EXISTS lab;
CREATE SCHEMA IF NOT EXISTS laboratorio;
CREATE SCHEMA IF NOT EXISTS laptopsdocentes;
CREATE SCHEMA IF NOT EXISTS log;
CREATE SCHEMA IF NOT EXISTS matriculas;
CREATE SCHEMA IF NOT EXISTS miaa;
CREATE SCHEMA IF NOT EXISTS moodle;
CREATE SCHEMA IF NOT EXISTS msg;
CREATE SCHEMA IF NOT EXISTS net_uatf;
CREATE SCHEMA IF NOT EXISTS personal;
CREATE SCHEMA IF NOT EXISTS plan;
CREATE SCHEMA IF NOT EXISTS planillas;
CREATE SCHEMA IF NOT EXISTS postgrado;
CREATE SCHEMA IF NOT EXISTS postulantes;
CREATE SCHEMA IF NOT EXISTS ppe;
CREATE SCHEMA IF NOT EXISTS preguntas;
CREATE SCHEMA IF NOT EXISTS prog;
CREATE SCHEMA IF NOT EXISTS psa;
CREATE SCHEMA IF NOT EXISTS recycler;
CREATE SCHEMA IF NOT EXISTS reservar_campo;
CREATE SCHEMA IF NOT EXISTS roles;
CREATE SCHEMA IF NOT EXISTS saber;
CREATE SCHEMA IF NOT EXISTS sau;
CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS seguro;
CREATE SCHEMA IF NOT EXISTS sis_directores;
CREATE SCHEMA IF NOT EXISTS sis_heracles;
CREATE SCHEMA IF NOT EXISTS sis_kardex;
CREATE SCHEMA IF NOT EXISTS sis_odiseo;
CREATE SCHEMA IF NOT EXISTS solicitudes;
CREATE SCHEMA IF NOT EXISTS soporte;
CREATE SCHEMA IF NOT EXISTS sox;
CREATE SCHEMA IF NOT EXISTS tramites;
CREATE SCHEMA IF NOT EXISTS vm;
CREATE SCHEMA IF NOT EXISTS webcienciaspuras;

-- Create Functions in postulantes schema (since postulantes is the active search path when table is created)
CREATE OR REPLACE FUNCTION postulantes.identificador(val character varying)
RETURNS varchar AS $$
BEGIN
    RETURN val;
END;
$$ LANGUAGE plpgsql;

-- Create Types in schemas (needed since schemas don't inherit public types automatically in custom search paths)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 't_modificacion' AND n.nspname = 'log') THEN
        CREATE TYPE log.t_modificacion AS (
            columna varchar,
            antes varchar,
            despues varchar
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 't_primary_key' AND n.nspname = 'log') THEN
        CREATE TYPE log.t_primary_key AS (
            columna varchar,
            valor varchar
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 't_reposiciones' AND n.nspname = 'academico') THEN
        CREATE TYPE academico.t_reposiciones AS (
            sigla varchar,
            nota integer
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 't_e_certificados' AND n.nspname = 'dep_titulos') THEN
        CREATE TYPE dep_titulos.t_e_certificados AS ENUM ('SOLICITADO', 'IMPRESO', 'ENTREGADO', 'ANULADO', 'PROCESO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 't_e_certificados' AND n.nspname = 'planillas') THEN
        CREATE TYPE planillas.t_e_certificados AS ENUM ('SOLICITADO', 'IMPRESO', 'ENTREGADO', 'ANULADO', 'PROCESO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'enum_tipo' AND n.nspname = 'solicitudes') THEN
        CREATE TYPE solicitudes.enum_tipo AS ENUM ('SOLICITADO', 'ACTIVO', 'INACTIVO', 'PROCESO', 'ANULADO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'e_cargos_conceptos' AND n.nspname = 'cajas') THEN
        CREATE TYPE cajas.e_cargos_conceptos AS ENUM ('CONCEPTOS', 'CARGOS', 'OTROS');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'ubicacion_decreto' AND n.nspname = 'actas_graduacion') THEN
        CREATE TYPE actas_graduacion.ubicacion_decreto AS ENUM ('facultad', 'rectorado', 'archivo', 'proceso');
    END IF;
END$$;

-- Create sequences
CREATE SEQUENCE IF NOT EXISTS academico.acad_message_id_seq;
CREATE SEQUENCE IF NOT EXISTS academico.importar_bloqueados_id_seq;
CREATE SEQUENCE IF NOT EXISTS actas_graduacion.nota_lugar_id_nota_seq;
CREATE SEQUENCE IF NOT EXISTS ambientes.dct_ambientes_carrera_id_seq;
CREATE SEQUENCE IF NOT EXISTS ambientes.dct_ambientes_id_seq;
CREATE SEQUENCE IF NOT EXISTS ambientes.dct_bloques_id_seq;
CREATE SEQUENCE IF NOT EXISTS b_investigacion.directores_id_seq;
CREATE SEQUENCE IF NOT EXISTS balimentacion.descriptions_califs_id_seq;
CREATE SEQUENCE IF NOT EXISTS balimentacion.dicts_comissions_id_seq;
CREATE SEQUENCE IF NOT EXISTS balimentacion.o_bc_puntaje_economico_java_id_p_eco_seq;
CREATE SEQUENCE IF NOT EXISTS balimentacion.o_bc_puntaje_familiar_java_id_p_fam_seq;
CREATE SEQUENCE IF NOT EXISTS balimentacion.o_bc_puntaje_procedencia_java_id_p_pro_seq;
CREATE SEQUENCE IF NOT EXISTS balimentacion.o_bc_puntaje_vivienda_estudiante_java_id_p_viv_e_seq;
CREATE SEQUENCE IF NOT EXISTS balimentacion.o_bc_puntaje_vivienda_familiar_java_id_p_viv_f_seq;
CREATE SEQUENCE IF NOT EXISTS balimentacion.parameters_califs_id_seq;
CREATE SEQUENCE IF NOT EXISTS bgraduacion.bg_items_becas_id_seq;
CREATE SEQUENCE IF NOT EXISTS biblioteca.llibro_id_libro_seq;
CREATE SEQUENCE IF NOT EXISTS cajas.estracto_bancario_id_seq;
CREATE SEQUENCE IF NOT EXISTS cajas.exrtacto_ppe_id_seq;
CREATE SEQUENCE IF NOT EXISTS cajas.recaudaciones_id_seq;
CREATE SEQUENCE IF NOT EXISTS calendario.activids_id_seq;
CREATE SEQUENCE IF NOT EXISTS calendario.carrera_id_seq;
CREATE SEQUENCE IF NOT EXISTS dar.users_id_seq;
CREATE SEQUENCE IF NOT EXISTS dep_titulos.tit_nivel_programa_id_seq;
CREATE SEQUENCE IF NOT EXISTS diu.diu_solicitud_id_seq;
CREATE SEQUENCE IF NOT EXISTS diu.diu_tipo_solicitud_id_seq;
CREATE SEQUENCE IF NOT EXISTS elecciones.votantes_id_seq;
CREATE SEQUENCE IF NOT EXISTS elecciones.votantes_id_seq1;
CREATE SEQUENCE IF NOT EXISTS estadisticas.egresados_id_seq;
CREATE SEQUENCE IF NOT EXISTS estudiantes.users_id_seq1;
CREATE SEQUENCE IF NOT EXISTS infraestructura.viajes_id_seq;
CREATE SEQUENCE IF NOT EXISTS matriculas.cajas_transacciones_id_seq;
CREATE SEQUENCE IF NOT EXISTS matriculas.matriculas_detalles_id_seq;
CREATE SEQUENCE IF NOT EXISTS matriculas.solictudes_matriculas_id_seq;
CREATE SEQUENCE IF NOT EXISTS personal.borrar_id_seq;
CREATE SEQUENCE IF NOT EXISTS postulantes.det_id_seq;
CREATE SEQUENCE IF NOT EXISTS public._id_post;
CREATE SEQUENCE IF NOT EXISTS public._id_variable;
CREATE SEQUENCE IF NOT EXISTS public.alumnos_id_alumno_seq;
CREATE SEQUENCE IF NOT EXISTS public.lugar_departamento_v2_cod_dep_seq;
CREATE SEQUENCE IF NOT EXISTS public.lugar_localidad_n_cod_loc_seq;
CREATE SEQUENCE IF NOT EXISTS public.lugar_provincia_cod_prov_2_seq;
CREATE SEQUENCE IF NOT EXISTS public.prs_colegios_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.prs_pais_2_id_pais_seq;
CREATE SEQUENCE IF NOT EXISTS public.prs_pais_3_id_pais_seq;
CREATE SEQUENCE IF NOT EXISTS public.tramites_id_tramite_seq;
CREATE SEQUENCE IF NOT EXISTS public.users_odiseo_id_seq;
CREATE SEQUENCE IF NOT EXISTS recycler.alumnos_bloqueados_id_bloqueado_seq1;
CREATE SEQUENCE IF NOT EXISTS recycler.aud_link_archivos_id_archivo_seq1;
CREATE SEQUENCE IF NOT EXISTS recycler.notas_planillax_id_matricula_seq;
CREATE SEQUENCE IF NOT EXISTS recycler.pln_mensiones_id_mension_seq;
CREATE SEQUENCE IF NOT EXISTS reservar_campo.borrarlista_id_seq;
CREATE SEQUENCE IF NOT EXISTS roles._bp_sistemas_id_seq;
CREATE SEQUENCE IF NOT EXISTS sau.examenes_id_examen_seq1;
CREATE SEQUENCE IF NOT EXISTS sau.preguntas_id_pregunta_seq;


-- Mock Trigger Functions

CREATE OR REPLACE FUNCTION academico.f_alm_programaciones_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION academico.f_tr_pln_materias_parametros_up()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION academico.trigger_fechas()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION actas_graduacion.update_seguimiento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION biblioteca.fn_lector_ultima_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log.dynamic_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log.f_no_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION postulantes._postulaciones_status_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION postulantes.proc_liberacion()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._dct_change_password()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._postulaciones_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._set_hrs_tipo()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._set_plan_alumnos()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public._update_ci()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_alm_programaciones_lab_tr()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_dar_tr_transferencias()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_impresion_ins_upd()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_matriculas_tr_clave()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_solicitud_ins_upd()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_actualizar_estado_users()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_actualizar_uatf_datos()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_agendar()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_alm_programaciones_control()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_alm_programaciones_matricula()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_alm_programaciones_programaciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_am_modalidad()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_asignaciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_aux_postulantes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_bc_postulantes_presentado()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_calificacion_evaluacion()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_control_recepcion()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_convocataria_evaluacion()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_dar_cambios_carrera()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_data_notificaciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_dct_asignaciones_control()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_dct_asignaciones_desasignar()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_dct_asignaciones_extra()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_docentes_tramites()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_lab_qmc()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_lista_elecciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_listas_generadas()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_lugar_localidad()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_matriculas_digitales()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_no_programar_doble()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_notas_planilla()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_notificaciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_pagos()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_pagos_ppe()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_programar_materias()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_proteger_datos()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_solicitudes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_solicitudes_detalle()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_solicitudes_matriculas_prea()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_uatf_datos_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tr_update_agenda()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tri_alm_programaciones_lab()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tri_alm_programas_ingreso()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tri_investigacion_social()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tri_notificaciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tri_observaciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tri_operaciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tri_reposicion()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.f_tri_verificacion_modalidad()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_calificar_aud050()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_matriculas()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_modalidad()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_programar_aud050()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_uatf_datos_ins()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fun_diu()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fun_item_percepciones_deducciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fun_matriculas()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.livepg_myapp()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notification_alm_programas_parametros()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notifications_alm_programaciones()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notifications_alm_programaciones_eliminadas()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notifications_alumnos()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.notify_article_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.proc_trigger_clave_certificado()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.tit_tramite_fun()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.tr_dct_asignaciones_del()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.tr_log_docentes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.tr_postulantes_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trgg_lupdate()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trigg_delete_alm_programaciones_proc()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.uatf_datos_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
