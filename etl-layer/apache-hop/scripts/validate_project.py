"""Validate the checked-in Apache Hop project wiring without connecting to databases."""

from __future__ import annotations

import json
import hashlib
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1] / "projects" / "dss-uatf-etl"
EXPECTED_ENV = {
    "dev": {
        "DSS_DW_HOSTNAME": "host.docker.internal",
        "DSS_DW_PORT": "5434",
        "DSS_DW_DATABASE": "dss_dw",
        "OLTP_DB_HOSTNAME": "host.docker.internal",
        "OLTP_DB_PORT": "5432",
        "OLTP_DB_DATABASE": "jachasun",
    },
    "integration": {
        "DSS_DW_HOSTNAME": "${DB_DW_HOST}",
        "DSS_DW_PORT": "${DB_DW_PORT}",
        "DSS_DW_DATABASE": "${DB_DW_NAME}",
        "OLTP_DB_HOSTNAME": "${DB_TX_HOST}",
        "OLTP_DB_PORT": "${DB_TX_PORT}",
        "OLTP_DB_DATABASE": "${DB_TX_NAME}",
    },
    "prod": {
        "DSS_DW_HOSTNAME": "${DB_DW_HOST}",
        "DSS_DW_PORT": "${DB_DW_PORT}",
        "DSS_DW_DATABASE": "${DB_DW_NAME}",
        "OLTP_DB_HOSTNAME": "${DB_TX_HOST}",
        "OLTP_DB_PORT": "${DB_TX_PORT}",
        "OLTP_DB_DATABASE": "${DB_TX_NAME}",
    },
}
CONSISTENT_FINAL_VALUES = (
    "DSS_DW_USERNAME", "DSS_DW_PASSWORD", "DSS_DW_URL",
    "OLTP_DB_USERNAME", "OLTP_DB_PASSWORD", "OLTP_DB_URL",
)
CONNECTIONS = {
    "OLTP db": ("OLTP db.json", "OLTP_DB"),
    "DSS DW": ("DSS DW.json", "DSS_DW"),
}
REQUIRED_DIRS = (
    "metadata/rdbms",
    "environments",
    "workflows",
    "pipelines/control",
    "pipelines/source",
    "pipelines/source/sql",
    "pipelines/dimensions",
    "pipelines/facts",
    "pipelines/quality",
    "datasets",
)
SOURCE_QUERIES = {
    "public.uatf_datos": ("select_uatf_datos_vertical.sql", "id_ra ASC"),
    "academico.alumnos": ("select_alumnos.sql", "id_alumno ASC"),
    "public.postulantes": ("select_postulantes.sql", "id_gestion NULLS FIRST, id_periodo NULLS FIRST, id_alumno ASC"),
    "academico.alm_programas": ("select_programas.sql", "id_programa ASC"),
    "academico.pln_materias": ("select_materias.sql", "id_materia ASC"),
    "academico.notas_planilla": ("select_notas_planilla.sql", "id_gestion ASC, id_periodo ASC, id_matricula ASC"),
    "academico.alm_programas_facultades": ("select_facultades.sql", "id_facultad ASC"),
    "public.prs_colegios": ("select_colegios.sql", "id_colegio ASC"),
    "public.lugar_localidad": ("select_localidades.sql", "cod_loc ASC"),
}


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid or unreadable JSON: {path.relative_to(PROJECT)}") from exc


def validate() -> list[str]:
    errors: list[str] = []
    if not PROJECT.is_dir():
        return [f"Project directory not found: {PROJECT}"]

    project_config = load_json(PROJECT / "project-config.json")
    if project_config.get("enforcingExecutionInHome") is not True:
        errors.append("project-config.json must enforce execution under PROJECT_HOME")
    if project_config.get("metadataBaseFolder") != "${PROJECT_HOME}/metadata":
        errors.append("metadataBaseFolder must resolve to ${PROJECT_HOME}/metadata")

    for relative in REQUIRED_DIRS:
        if not (PROJECT / relative).is_dir():
            errors.append(f"Missing project directory: {relative}")

    environment_values: dict[str, dict[str, str]] = {}
    checked_runtime_environments: set[str] = set()
    expected_names = set(EXPECTED_ENV["dev"]) | set(CONSISTENT_FINAL_VALUES)
    for env_name in ("dev", "integration", "prod"):
        path = PROJECT / "environments" / f"{env_name}-env.json"
        is_example = False
        if not path.is_file():
            path = PROJECT / "environments" / f"{env_name}-env.example.json"
            is_example = True
            if not path.is_file():
                errors.append(f"Missing runtime or example environment file: {env_name}-env.json")
                continue
        variables = load_json(path).get("variables", [])
        actual = {item.get("name"): item.get("value") for item in variables}
        environment_values[env_name] = actual
        if set(actual) != expected_names or len(variables) != len(actual):
            missing = sorted(expected_names - set(actual))
            extra = sorted(set(actual) - expected_names)
            errors.append(f"{path.name}: variable names differ or contain duplicates (missing={missing}, extra={extra})")
        if is_example:
            for variable, value in actual.items():
                if not isinstance(value, str) or not (
                    value.startswith("REPLACE_WITH_")
                    or "REPLACE_WITH_" in value
                    or value == "INJECT_FROM_INTEGRATION_SECRET_STORE"
                    or value == "INJECT_FROM_PRODUCTION_SECRET_STORE"
                ):
                    errors.append(f"{path.name}: example value for {variable} must remain a non-secret placeholder")
        else:
            checked_runtime_environments.add(env_name)
            for variable, expected_value in EXPECTED_ENV[env_name].items():
                if actual.get(variable) != expected_value:
                    errors.append(f"{path.name}: {variable} must retain {expected_value}")

    if checked_runtime_environments == {"dev", "integration", "prod"}:
        for env_name in ("integration", "prod"):
            actual = environment_values[env_name]
            for variable in CONSISTENT_FINAL_VALUES:
                if actual.get(variable) != environment_values["dev"].get(variable):
                    errors.append(f"{env_name}-env.json: {variable} differs from the agreed dev value")

    for connection_name, (filename, source_suffix) in CONNECTIONS.items():
        path = PROJECT / "metadata" / "rdbms" / filename
        if not path.is_file():
            errors.append(f"Missing connection metadata: {filename}")
            continue
        connection = load_json(path)
        if connection.get("name") != connection_name:
            errors.append(f"{filename}: metadata name must be {connection_name!r}")
        fields = connection.get("rdbms", {}).get("POSTGRESQL", {})
        required_fields = {
            "hostname": f"{source_suffix}_HOSTNAME",
            "port": f"{source_suffix}_PORT",
            "databaseName": f"{source_suffix}_DATABASE",
            "username": f"{source_suffix}_USERNAME",
            "password": f"{source_suffix}_PASSWORD",
            "manualUrl": f"{source_suffix}_URL",
        }
        for field, variable in required_fields.items():
            if fields.get(field) != f"${{{variable}}}":
                errors.append(f"{filename}: {field} must reference ${{{variable}}}")

    # The isolated test environment is deliberately separate from the agreed runtime environments.
    test_env = PROJECT / "environments" / "integration-test.json"
    if test_env.is_file():
        test_values = {item.get("name"): item.get("value") for item in load_json(test_env).get("variables", [])}
        if test_values.get("DSS_DW_USERNAME") != "hop_vertical_test" \
                or test_values.get("OLTP_DB_USERNAME") != "dw_fixture_reader":
            errors.append("integration-test.json must use only the restricted synthetic DB principals")

    docker_test_env = PROJECT / "environments" / "integration-test.example.json"
    if not docker_test_env.is_file():
        errors.append("Missing versioned Docker integration environment: integration-test.example.json")
    else:
        docker_test_values = {
            item.get("name"): item.get("value")
            for item in load_json(docker_test_env).get("variables", [])
        }
        if docker_test_values.get("DSS_DW_HOSTNAME") != "postgres-dw" \
                or docker_test_values.get("DSS_DW_USERNAME") != "hop_vertical_test" \
                or docker_test_values.get("OLTP_DB_HOSTNAME") != "jachasun-fixture" \
                or docker_test_values.get("OLTP_DB_USERNAME") != "dw_fixture_reader":
            errors.append("Docker integration environment must target only the isolated fixture services")

    compose_path = PROJECT.parents[3] / "docker-compose.yml"
    if compose_path.is_file():
        compose = compose_path.read_text(encoding="utf-8")
        hop_service = compose.split("  hop-web:", 1)[-1].split("  # ====", 1)[0]
        if ":/files/project:rw" not in hop_service:
            errors.append("docker-compose.yml must mount the Hop project read-write")
        if "/files/scripts/start-hop-web.sh" not in hop_service:
            errors.append("docker-compose.yml must run the startup wrapper that selects the configured project/environment")
        if "HOP_OPTIONS:" not in hop_service or "-DDB_DW_HOST=" not in hop_service \
                or "-DDB_TX_HOST=" not in hop_service:
            errors.append("docker-compose.yml must pass DB endpoint variables as JVM properties for Hop resolution")

    startup_script = PROJECT.parents[1] / "scripts" / "start-hop-web.sh"
    if not startup_script.is_file():
        errors.append("Missing Hop Web startup wrapper: scripts/start-hop-web.sh")
    else:
        startup = startup_script.read_text(encoding="utf-8")
        if "--default-project=\"${HOP_PROJECT_NAME}\"" not in startup \
                or "--default-environment=\"${HOP_ENVIRONMENT_NAME}\"" not in startup:
            errors.append("Hop Web startup wrapper must select the configured project and lifecycle environment by default")

    # Parse every Hop artifact before publishing it to Hop Web or hop-run.
    for artifact in (*PROJECT.glob("workflows/**/*.hwf"), *PROJECT.glob("pipelines/**/*.hpl")):
        try:
            ET.parse(artifact)
        except (OSError, ET.ParseError) as exc:
            errors.append(f"Invalid Hop XML: {artifact.relative_to(PROJECT)} ({exc})")

    vertical_workflow = PROJECT / "workflows" / "wf_vertical_uatf_datos_smoke.hwf"
    source_pipeline = PROJECT / "pipelines" / "source" / "pl_source_uatf_datos_vertical.hpl"
    source_sql_path = PROJECT / "pipelines" / "source" / "sql" / "select_uatf_datos_vertical.sql"
    for required in (vertical_workflow, source_pipeline, source_sql_path):
        if not required.is_file():
            errors.append(f"Missing vertical-flow artifact: {required.relative_to(PROJECT)}")
    if source_pipeline.is_file() and source_sql_path.is_file():
        pipeline_root = ET.parse(source_pipeline).getroot()
        source_query = next(
            (item.findtext("sql", "") for item in pipeline_root.findall("transform")
             if item.findtext("name") == "Read UATF snapshot"),
            "",
        )
        canonical_query = source_sql_path.read_text(encoding="utf-8")
        normalize = lambda value: value.replace("\r\n", "\n").replace("\r", "\n")
        if normalize(source_query).strip() != normalize(canonical_query).strip():
            errors.append("The inline Hop Table Input query differs from the versioned source SQL")
        query_hash = hashlib.sha256(normalize(canonical_query).encode("utf-8")).hexdigest()
        if query_hash not in source_pipeline.read_text(encoding="utf-8"):
            errors.append("The UATF source manifest query hash does not match the canonical SQL")
        if re.search(r"\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER)\b", source_query, re.I):
            errors.append("The OLTP source query must remain read-only SELECT")
        if re.search(r"\bSELECT\s+\*", source_query, re.I):
            errors.append("The OLTP source query must declare its columns explicitly")
        if "ORDER BY id_ra ASC" not in source_query:
            errors.append("The UATF source snapshot must keep deterministic id_ra ordering")
    if source_pipeline.is_file():
        source_xml = source_pipeline.read_text(encoding="utf-8")
        if "<resultType>hexadecimal</resultType>" not in source_xml:
            errors.append("The source schema SHA-256 must be emitted as hexadecimal text")
        if re.search(
                r"count\s*\(\s*\*\s*\)\s*=\s*8\s+FROM\s+information_schema\.columns",
                source_xml,
                re.I,
        ):
            errors.append("The UATF contract must allow non-contractual columns in the OLTP table")
        if "Abort invalid contract" not in source_xml or "source_schema_sha256" not in source_xml:
            errors.append("The UATF vertical pipeline must block invalid schema and record its fingerprint")
        if "etl_control.register_etl_source_manifest" not in source_xml \
                or "etl_control.record_etl_execution_metric" not in source_xml \
                or "etl_control.register_etl_execution_step" not in source_xml:
            errors.append("The UATF vertical pipeline must audit via etl_control routines")
        if "TableOutput" in source_xml or "dw.fact_" in source_xml or "staging.raw_uatf_datos" in source_xml:
            errors.append("The first vertical source flow must not persist rows or publish DW data")

    # The second audited vertical source follows the same guarded contract and
    # keeps its executable query byte-for-byte aligned with the versioned SQL.
    alumnos_pipeline = PROJECT / "pipelines" / "source" / "pl_source_alumnos_vertical.hpl"
    alumnos_query_path = source_sql_dir = PROJECT / "pipelines" / "source" / "sql" / "select_alumnos.sql"
    if not alumnos_pipeline.is_file():
        errors.append("Missing audited source pipeline for academico.alumnos")
    elif not alumnos_query_path.is_file():
        errors.append("Missing canonical source SQL for academico.alumnos")
    else:
        alumnos_xml = ET.parse(alumnos_pipeline).getroot()
        inline_query = next(
            (item.findtext("sql", "") for item in alumnos_xml.findall("transform")
             if item.findtext("name") == "Read alumnos snapshot"),
            "",
        )
        canonical_query = alumnos_query_path.read_text(encoding="utf-8")
        canonical_select = re.sub(r"--.*?$", "", canonical_query, flags=re.M).strip().rstrip(";")
        expected_inline = re.sub(
            r"\nFROM\s+",
            ",\n    ?::char(64) AS source_schema_sha256\nFROM ",
            canonical_select,
            count=1,
            flags=re.I,
        ) + ";"
        if normalize(inline_query).strip() != normalize(expected_inline).strip():
            errors.append("The alumnos Hop Table Input query differs from its canonical SQL projection/order")
        query_hash = hashlib.sha256(normalize(canonical_query).encode("utf-8")).hexdigest()
        if query_hash not in Path(alumnos_pipeline).read_text(encoding="utf-8"):
            errors.append("The alumnos manifest query hash does not match the canonical SQL")
        for required_text in (
            "etl_control.register_etl_source_manifest",
            "etl_control.record_etl_execution_metric",
            "etl_control.register_etl_execution_step",
            "source_alumnos",
            "source_schema_sha256",
        ):
            if required_text not in Path(alumnos_pipeline).read_text(encoding="utf-8"):
                errors.append(f"The alumnos pipeline is missing required audit evidence: {required_text}")
        if re.search(r"\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER)\b", inline_query, re.I) \
                or re.search(r"\bSELECT\s+\*", inline_query, re.I):
            errors.append("The alumnos OLTP query must remain an explicit, read-only SELECT")

    faculties_pipeline = PROJECT / "pipelines" / "source" / "pl_source_facultades_vertical.hpl"
    faculties_query_path = PROJECT / "pipelines" / "source" / "sql" / "select_facultades.sql"
    if not faculties_pipeline.is_file():
        errors.append("Missing audited source pipeline for academico.alm_programas_facultades")
    elif not faculties_query_path.is_file():
        errors.append("Missing canonical source SQL for academico.alm_programas_facultades")
    else:
        faculties_xml = ET.parse(faculties_pipeline).getroot()
        inline_query = next(
            (item.findtext("sql", "") for item in faculties_xml.findall("transform")
             if item.findtext("name") == "Read facultades snapshot"),
            "",
        )
        canonical_query = faculties_query_path.read_text(encoding="utf-8")
        canonical_select = re.sub(r"--.*?$", "", canonical_query, flags=re.M).strip().rstrip(";")
        expected_inline = re.sub(
            r"\nFROM\s+",
            ",\n    ?::char(64) AS source_schema_sha256\nFROM ",
            canonical_select,
            count=1,
            flags=re.I,
        ) + ";"
        if normalize(inline_query).strip() != normalize(expected_inline).strip():
            errors.append("The faculties Hop Table Input query differs from its canonical SQL projection/order")
        query_hash = hashlib.sha256(normalize(canonical_query).encode("utf-8")).hexdigest()
        faculties_source = faculties_pipeline.read_text(encoding="utf-8")
        if query_hash not in faculties_source:
            errors.append("The faculties manifest query hash does not match the canonical SQL")
        for required_text in (
            "etl_control.register_etl_source_manifest",
            "etl_control.record_etl_execution_metric",
            "etl_control.register_etl_execution_step",
            "source_facultades",
            "source_schema_sha256",
        ):
            if required_text not in faculties_source:
                errors.append(f"The faculties pipeline is missing required audit evidence: {required_text}")
        if re.search(r"\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER)\b", inline_query, re.I) \
                or re.search(r"\bSELECT\s+\*", inline_query, re.I):
            errors.append("The faculties OLTP query must remain an explicit, read-only SELECT")
        workflow_text = vertical_workflow.read_text(encoding="utf-8") if vertical_workflow.is_file() else ""
        if "pl_source_facultades_vertical.hpl" not in workflow_text:
            errors.append("The vertical smoke workflow must execute the faculties source pipeline")

    # All nine contracted sources must be wired into the synthetic vertical
    # workflow and record control-plane evidence without persisting source rows.
    source_pipeline_names = {
        "public.uatf_datos": "pl_source_uatf_datos_vertical.hpl",
        "academico.alumnos": "pl_source_alumnos_vertical.hpl",
        "public.postulantes": "pl_source_postulantes_vertical.hpl",
        "academico.alm_programas": "pl_source_programas_vertical.hpl",
        "academico.pln_materias": "pl_source_materias_vertical.hpl",
        "academico.notas_planilla": "pl_source_notas_planilla_vertical.hpl",
        "academico.alm_programas_facultades": "pl_source_facultades_vertical.hpl",
        "public.prs_colegios": "pl_source_colegios_vertical.hpl",
        "public.lugar_localidad": "pl_source_localidades_vertical.hpl",
    }
    workflow_text = vertical_workflow.read_text(encoding="utf-8") if vertical_workflow.is_file() else ""
    for contract_id, pipeline_name in source_pipeline_names.items():
        pipeline_path = PROJECT / "pipelines" / "source" / pipeline_name
        if not pipeline_path.is_file():
            errors.append(f"Missing Hop extraction pipeline for {contract_id}: {pipeline_name}")
            continue
        pipeline_text = pipeline_path.read_text(encoding="utf-8")
        if pipeline_name not in workflow_text:
            errors.append(f"The vertical workflow does not execute {pipeline_name}")
        for audit_call in (
            "etl_control.register_etl_source_manifest",
            "etl_control.record_etl_execution_metric",
            "etl_control.register_etl_execution_step",
        ):
            if audit_call not in pipeline_text:
                errors.append(f"{pipeline_name} is missing control-plane call {audit_call}")
        query_filename = SOURCE_QUERIES[contract_id][0]
        canonical_query = (PROJECT / "pipelines" / "source" / "sql" / query_filename).read_text(encoding="utf-8")
        query_hash = hashlib.sha256(normalize(canonical_query).encode("utf-8")).hexdigest()
        if "source_schema_sha256" not in pipeline_text and "schema_sha256" not in pipeline_text:
            errors.append(f"{pipeline_name} must fingerprint its source schema")
        if query_hash not in pipeline_text:
            errors.append(f"{pipeline_name} query hash does not match {query_filename}")
        if "TableOutput" in pipeline_text or "staging.raw_" in pipeline_text or "dw.fact_" in pipeline_text:
            errors.append(f"{pipeline_name} must not persist source rows or write published DW tables")

    # Req. 6.3/6.4 prepare five dimensions in private publication staging. Key
    # resolution is mediated by a definer routine; Hop has no direct DW DML.
    for pipeline_name in (
        "pl_dim_programa_mvp.hpl",
        "pl_dim_materia_mvp.hpl",
        "pl_dim_periodo_academico_mvp.hpl",
        "pl_dim_admision_mvp.hpl",
        "pl_dim_estudiante_scd2_mvp.hpl",
    ):
        pipeline_path = PROJECT / "pipelines" / "dimensions" / pipeline_name
        if not pipeline_path.is_file():
            errors.append(f"Missing Req. 6.3 dimension pipeline: {pipeline_name}")
            continue
        pipeline_text = pipeline_path.read_text(encoding="utf-8")
        if pipeline_name not in workflow_text:
            errors.append(f"The vertical workflow does not execute {pipeline_name}")
        required_calls = (
            ("etl_control.prepare_hop_student_scd2", "etl_control.seal_hop_publication_batch")
            if pipeline_name == "pl_dim_estudiante_scd2_mvp.hpl"
            else ("etl_control.resolve_hop_dimension_key", "etl_control.stage_hop_publication_row",
                  "etl_control.seal_hop_publication_batch")
        )
        for required_call in required_calls:
            if required_call not in pipeline_text:
                errors.append(f"{pipeline_name} is missing required safe-staging call {required_call}")
        if "dw.dim_" in pipeline_text or "TableOutput" in pipeline_text:
            errors.append(f"{pipeline_name} must not write directly to published DW dimensions")

    # Req. 6.5 prepares the two approved MVP facts at their operational grains.
    fact_pipelines = {
        "pl_fact_admision_mvp.hpl": (
            "etl_control.stage_hop_fact_admission", "public.postulantes",
            "id_alumno", "FACT_ADMISION",
        ),
        "pl_fact_cursado_mvp.hpl": (
            "etl_control.stage_hop_fact_coursework", "academico.notas_planilla",
            "id_matricula", "FACT_CURSADO",
        ),
    }
    for pipeline_name, (stage_call, source_table, grain_column, target_code) in fact_pipelines.items():
        pipeline_path = PROJECT / "pipelines" / "facts" / pipeline_name
        if not pipeline_path.is_file():
            errors.append(f"Missing Req. 6.5 fact pipeline: {pipeline_name}")
            continue
        fact_text = pipeline_path.read_text(encoding="utf-8")
        if pipeline_name not in workflow_text:
            errors.append(f"The vertical workflow does not execute {pipeline_name}")
        for required_text in (stage_call, source_table, grain_column,
                              "etl_control.complete_hop_fact_batch", target_code,
                              "P_REQUESTED_GESTION", "P_REQUESTED_PERIODO"):
            if required_text not in fact_text:
                errors.append(f"{pipeline_name} is missing required fact-flow contract: {required_text}")
        if "TableOutput" in fact_text or re.search(
                r"\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+dw\.fact_(admision|cursado)\b",
                fact_text, re.I):
            errors.append(f"{pipeline_name} must stage privately and never write directly to a published fact")
    gate_pipeline = PROJECT / "pipelines" / "control" / "pl_hop_mark_vertical_incomplete.hpl"
    if gate_pipeline.is_file():
        gate_text = gate_pipeline.read_text(encoding="utf-8")
        for required_gate_value in ('"prepared_fact_batches":2', '"missing_target":"FACT_RETENCION_DESERCION"'):
            if required_gate_value not in gate_text:
                errors.append(f"The 6.5 incomplete-publication gate must report {required_gate_value}")

    # Every approved OLTP source must have a version-controlled, read-only query.
    # The source pipeline is still wired incrementally; these checks prevent the
    # contract SQL inventory from silently drifting while that wiring is built.
    source_sql_dir = PROJECT / "pipelines" / "source" / "sql"
    for contract_id, (filename, stable_order) in SOURCE_QUERIES.items():
        query_path = source_sql_dir / filename
        if not query_path.is_file():
            errors.append(f"Missing canonical source query for {contract_id}: {filename}")
            continue
        query = query_path.read_text(encoding="utf-8")
        normalized_query = re.sub(r"--.*?$", "", query, flags=re.M).strip()
        if not re.match(r"^SELECT\b", normalized_query, re.I):
            errors.append(f"{filename}: source query must begin with SELECT")
        if re.search(r"\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE)\b", normalized_query, re.I):
            errors.append(f"{filename}: OLTP source query must be read-only")
        if re.search(r"\bSELECT\s+\*", normalized_query, re.I):
            errors.append(f"{filename}: source query must declare columns explicitly")
        if re.search(r"\bJOIN\b", normalized_query, re.I):
            errors.append(f"{filename}: extraction query cannot contain analytical joins")
        if not re.search(r"\bFROM\s+" + re.escape(contract_id) + r"\b", normalized_query, re.I):
            errors.append(f"{filename}: query must read only its contracted source {contract_id}")
        if not re.search(r"\bORDER\s+BY\s+" + re.escape(stable_order) + r"\s*;?$", normalized_query, re.I):
            errors.append(f"{filename}: deterministic ordering must end with {stable_order}")

    return errors


def main() -> int:
    try:
        errors = validate()
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Apache Hop project wiring is valid (static checks only; no DB connection was attempted).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
