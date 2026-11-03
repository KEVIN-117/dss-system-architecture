"""Build and train development-only PRED-006 event candidates from the Faker DW.

This script reads the local ``postgres-dw`` container in a read-only transaction,
hashes student/program identifiers before writing snapshots, separates annual
and semester cohorts, and writes candidates only below ``.test-tmp``. It never
promotes a model or marks synthetic evidence institutionally approved.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dataset_contract import compute_snapshot_digest
from evaluation.comparison import compare_artifacts
from preparation.pipeline import prepare_dataset, prepare_event_dataset
from training.artifact_writer import write_training_artifacts
from training.trainer import train_model


OUTPUT = ROOT / ".test-tmp" / "pred006_faker_targets_v2"
FEATURES_PROGRAM = ["materias_cursadas", "materias_aprobadas", "materias_reprobadas"]
FEATURES_COURSE = ["materia_ciclo", "materia_nivel", "prior_course_count", "prior_abandonment_count"]


COHORT_CTE = """
WITH coursework AS (
    SELECT e.id_alumno, p.id_programa, pa.gestion, pa.periodo,
           c.closure_id, c.effective_at
    FROM dw.fact_cursado fc
    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk
      AND e.member_type='STANDARD' AND e.id_alumno IS NOT NULL
    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk
      AND p.member_type='STANDARD' AND p.id_programa IS NOT NULL
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
    JOIN etl_control.academic_period_closure c ON c.closure_id=pa.closure_id
      AND c.status='PROCESADO' AND c.processed_at IS NOT NULL
    WHERE pa.periodo IN (1,2,3)
), cadence AS (
    SELECT id_alumno, id_programa,
           CASE WHEN bool_or(periodo=3) AND bool_or(periodo IN (1,2)) THEN 'MIXED'
                WHEN bool_or(periodo=3) THEN 'ANUAL' ELSE 'SEMESTRAL' END AS cadence
    FROM coursework GROUP BY id_alumno,id_programa
), starts AS (
    SELECT DISTINCT ON (id_alumno,id_programa)
           id_alumno,id_programa,gestion AS first_year,periodo AS first_period
    FROM coursework
    ORDER BY id_alumno,id_programa,gestion,
             CASE periodo WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 9 END,
             closure_id
)
"""


COURSE_SQL = COHORT_CTE + """
, history_by_cut AS (
    SELECT e.id_alumno,p.id_programa,c.closure_id,pa.gestion,pa.periodo,
           count(*)::integer AS attempts,
           count(*) FILTER (WHERE fc.es_abandono IS TRUE)::integer AS abandoned
    FROM dw.fact_cursado fc
    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk
      AND e.member_type='STANDARD' AND e.id_alumno IS NOT NULL
    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk
      AND p.member_type='STANDARD' AND p.id_programa IS NOT NULL
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
    JOIN etl_control.academic_period_closure c ON c.closure_id=pa.closure_id
      AND c.status='PROCESADO' AND c.processed_at IS NOT NULL
    WHERE pa.periodo IN (1,2,3)
    GROUP BY e.id_alumno,p.id_programa,c.closure_id,pa.gestion,pa.periodo
), prior_history AS (
    SELECT id_alumno,id_programa,closure_id,
           coalesce(sum(attempts) OVER history,0)::integer AS prior_course_count,
           coalesce(sum(abandoned) OVER history,0)::integer AS prior_abandonment_count
    FROM history_by_cut
    WINDOW history AS (
      PARTITION BY id_alumno,id_programa
      ORDER BY gestion,CASE periodo WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 9 END,closure_id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    )
)
, course_rows AS (
    SELECT e.id_alumno, p.id_programa, m.id_materia,
           m.ciclo::text AS materia_ciclo,
           m.nivel_academico::text AS materia_nivel,
           pa.gestion, pa.periodo, c.closure_id, c.effective_at, fc.run_id,
           fc.es_abandono,
           hist.prior_course_count, hist.prior_abandonment_count
    FROM dw.fact_cursado fc
    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk
      AND e.member_type='STANDARD' AND e.id_alumno IS NOT NULL
    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk
      AND p.member_type='STANDARD' AND p.id_programa IS NOT NULL
    JOIN dw.dim_materia m ON m.materia_sk=fc.materia_sk AND m.member_type='STANDARD'
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
    JOIN etl_control.academic_period_closure c ON c.closure_id=pa.closure_id
      AND c.status='PROCESADO' AND c.processed_at IS NOT NULL
    JOIN cadence cd ON cd.id_alumno=e.id_alumno AND cd.id_programa=p.id_programa
    JOIN starts st ON st.id_alumno=e.id_alumno AND st.id_programa=p.id_programa
    JOIN prior_history hist ON hist.id_alumno=e.id_alumno
      AND hist.id_programa=p.id_programa AND hist.closure_id=c.closure_id
    WHERE fc.es_abandono IS NOT NULL
      AND ((cd.cadence='ANUAL' AND pa.periodo=3
            AND (pa.gestion-st.first_year+1) BETWEEN 1 AND 3)
        OR (cd.cadence='SEMESTRAL' AND pa.periodo IN (1,2)
            AND ((pa.gestion-st.first_year)*2+pa.periodo-st.first_period+1) BETWEEN 1 AND 6))
)
SELECT jsonb_build_object(
  'student_id',id_alumno,'program_id',id_programa,'subject_id',id_materia,
  'materia_ciclo',materia_ciclo,'materia_nivel',materia_nivel,
  'academic_year',gestion,'academic_period',periodo,'cut_id',closure_id::text,
  'effective_at',effective_at,'source_run_id',run_id::text,
  'es_abandono',es_abandono,'prior_course_count',prior_course_count,
  'prior_abandonment_count',prior_abandonment_count,
  'cadence',cd.cadence
)::text
FROM course_rows
JOIN cadence cd USING (id_alumno,id_programa)
ORDER BY id_alumno,id_programa,id_materia,gestion,periodo;
"""


PROGRAM_SQL = COHORT_CTE + """
, program_rows AS (
    SELECT e.id_alumno,p.id_programa,pa.gestion,pa.periodo,c.closure_id,c.effective_at,
           f.run_id,f.resultado_retencion,f.es_desercion,f.conteo_snapshot,
           f.conteo_evaluable,f.conteo_desercion,f.materias_cursadas,
           f.materias_aprobadas,f.materias_reprobadas,cd.cadence
    FROM dw.fact_retencion_desercion f
    JOIN dw.dim_estudiante e ON e.estudiante_sk=f.estudiante_sk
      AND e.member_type='STANDARD' AND e.id_alumno IS NOT NULL
    JOIN dw.dim_programa p ON p.programa_sk=f.programa_sk
      AND p.member_type='STANDARD' AND p.id_programa IS NOT NULL
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=f.periodo_academico_sk
    JOIN etl_control.academic_period_closure c ON c.closure_id=f.closure_id
      AND c.status='PROCESADO' AND c.processed_at IS NOT NULL
    JOIN cadence cd ON cd.id_alumno=e.id_alumno AND cd.id_programa=p.id_programa
    JOIN starts st ON st.id_alumno=e.id_alumno AND st.id_programa=p.id_programa
    WHERE f.resultado_retencion IN ('RETENIDO','DESERTOR')
      AND ((cd.cadence='ANUAL' AND pa.periodo=3
            AND (pa.gestion-st.first_year+1) BETWEEN 1 AND 3)
        OR (cd.cadence='SEMESTRAL' AND pa.periodo IN (1,2)
            AND ((pa.gestion-st.first_year)*2+pa.periodo-st.first_period+1) BETWEEN 1 AND 6))
)
SELECT jsonb_build_object(
  'student_id',id_alumno,'program_id',id_programa,
  'academic_year',gestion,'academic_period',periodo,'cut_id',closure_id::text,
  'effective_at',effective_at,'source_run_id',run_id::text,
  'resultado_retencion',resultado_retencion,'es_desercion',es_desercion,
  'conteo_snapshot',conteo_snapshot,'conteo_evaluable',conteo_evaluable,
  'conteo_desercion',conteo_desercion,'materias_cursadas',materias_cursadas,
  'materias_aprobadas',materias_aprobadas,'materias_reprobadas',materias_reprobadas,
  'cadence',cadence
)::text
FROM program_rows
ORDER BY id_alumno,id_programa,gestion,periodo,closure_id;
"""


def _query(sql: str) -> list[dict[str, Any]]:
    wrapped = "BEGIN READ ONLY;\n" + sql + "\nROLLBACK;\n"
    result = subprocess.run(
        ["docker", "exec", "-i", "postgres-dw", "psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-U", "admin", "-d", "dss_dw"],
        input=wrapped.encode("utf-8"), capture_output=True, check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))
    records=[]
    for line in result.stdout.decode("utf-8").splitlines():
        line=line.strip()
        if line.startswith("{"):
            records.append(json.loads(line))
    return records


def _hash(value: Any, namespace: str) -> str:
    return hashlib.sha256(f"pred006-faker:{namespace}:{value}".encode("utf-8")).hexdigest()


def _decorate(rows: list[dict[str, Any]], objective: str) -> list[dict[str, Any]]:
    output=[]
    for source in rows:
        row=dict(source)
        row["student_ref"]=_hash(row.pop("student_id"),"student")
        row["program_ref"]=_hash(row.pop("program_id"),"program")
        if "subject_id" in row:
            row["subject_ref"]=_hash(row.pop("subject_id"),"subject")
        row["academic_year"]=int(row["academic_year"])
        row["academic_period"]=int(row["academic_period"])
        row["cut_id"]=str(row["cut_id"])
        row["population_status"]="ELIGIBLE"
        row["effective_at"]=str(row.pop("effective_at"))
        row["source_run_id"]=str(row["source_run_id"])
        if objective=="course_abandonment":
            row["target_class"]="RISK" if row["es_abandono"] else "NO_RISK"
        else:
            row["target_class"]="RISK" if row["resultado_retencion"]=="DESERTOR" else "NO_RISK"
        output.append(row)
    return output


def _fields(objective: str) -> tuple[list[str], list[dict[str, Any]]]:
    names=FEATURES_COURSE if objective=="course_abandonment" else FEATURES_PROGRAM
    types={"materia_ciclo":"category","materia_nivel":"category"}
    fields=[
        {"name":"student_ref","logical_type":"string","role":"identifier","nullable":False},
        {"name":"program_ref","logical_type":"string","role":"identifier","nullable":False},
        {"name":"cut_id","logical_type":"string","role":"identifier","nullable":False},
        {"name":"academic_year","logical_type":"integer","role":"audit","nullable":False},
        {"name":"academic_period","logical_type":"integer","role":"audit","nullable":False},
        {"name":"effective_at","logical_type":"datetime","role":"audit","nullable":False},
        {"name":"source_run_id","logical_type":"uuid","role":"audit","nullable":False},
        {"name":"population_status","logical_type":"category","role":"audit","nullable":False},
    ]
    if objective=="course_abandonment":
        fields += [
            {"name":"subject_ref","logical_type":"string","role":"identifier","nullable":False},
            {"name":"es_abandono","logical_type":"boolean","role":"audit","nullable":False},
            {"name":"materia_ciclo","logical_type":"category","role":"audit","nullable":True},
            {"name":"materia_nivel","logical_type":"category","role":"audit","nullable":True},
            {"name":"prior_course_count","logical_type":"integer","role":"audit","nullable":False},
            {"name":"prior_abandonment_count","logical_type":"integer","role":"audit","nullable":False},
        ]
    else:
        fields += [
            {"name":"resultado_retencion","logical_type":"category","role":"audit","nullable":False},
            {"name":"es_desercion","logical_type":"boolean","role":"audit","nullable":False},
            {"name":"conteo_snapshot","logical_type":"integer","role":"audit","nullable":False},
            {"name":"conteo_evaluable","logical_type":"integer","role":"audit","nullable":False},
            {"name":"conteo_desercion","logical_type":"integer","role":"audit","nullable":False},
        ]
    fields.extend({"name":name,"logical_type":types.get(name,"integer"),"role":"feature","nullable":types.get(name)=="category","available_at_cut":True} for name in names)
    fields.append({"name":"target_class","logical_type":"category","role":"target","nullable":False,"available_at_cut":False})
    return names,fields


def _snapshot(objective: str, cadence: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    if objective=="course_abandonment":
        grain="student_course_academic_period"
        target_ref="synthetic:faker:course-abandonment:source-es_abandono-v1"
        event="COURSE_ABANDONMENT"
        unit="student_course_academic_period"
    else:
        grain="student_program_academic_cut"
        target_ref="synthetic:faker:program-dropout:next-cadence-closure-v1"
        event="PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"
        unit="student_program_academic_cut"
    names,fields=_fields(objective)
    # A collapsed course grain must be unique before hashing or splitting.
    grain_keys=[(r["student_ref"],r["program_ref"],r.get("subject_ref",""),r["cut_id"]) for r in rows]
    if len(grain_keys)!=len(set(grain_keys)):
        raise ValueError(f"Duplicate {grain} rows detected; refusing to choose an ambiguous target.")
    rows.sort(key=lambda r:(r["student_ref"],r["program_ref"],r.get("subject_ref",""),r["cut_id"]))
    created=datetime.now(timezone.utc).isoformat()
    max_row=max(rows,key=lambda r:(r["academic_year"],r["academic_period"]))
    digest=compute_snapshot_digest(rows)
    manifest={
        "fixture_only":True,
        "warning":"Faker simulation only. Not institutional evidence, DSA approval, or deployment authorization.",
        "contract_version":"1.0","dataset_id":str(uuid.uuid4()),
        "snapshot_ref":f"synthetic:faker:pred006:{objective}:{cadence.lower()}:first-three-years",
        "source":{"system":"dw","contract_ref":"dw-faker-v1","run_id":None},
        "grain":grain,"evaluation_unit":unit,
        "academic_cut":{"closure_id":max_row["cut_id"],"status":"PROCESADO","effective_at":max_row["effective_at"]},
        "coverage":{"cadence":cadence,"scope":"first three academic years","rows":len(rows),
                    "periods":sorted({(r["academic_year"],r["academic_period"]) for r in rows}),
                    "features":"course target excludes current-course grades; only prior-course history and subject metadata" if objective=="course_abandonment" else "retention fact features at the observed cut"},
        "schema_version":"prepared-dataset-v1","created_at":created,"row_count":len(rows),
        "exclusions":{},"content_digest":digest,
        "population_definition_ref":f"synthetic:faker:program-first-three-academic-years:{cadence.lower()}",
        "target_definition_ref":target_ref,"eligibility_approved":True,"target_approved":True,
        "target_definition":{"positive_class":"RISK","negative_class":"NO_RISK","event_code":event,
            "horizon_ref":"same processed subject-period outcome" if objective=="course_abandonment" else "next expected processed closure for program cadence",
            "label_source":"dw.fact_cursado.es_abandono" if objective=="course_abandonment" else "dw.fact_retencion_desercion.resultado_retencion"},
        "target_field":"target_class","feature_fields":names,"fields":fields,
    }
    return manifest


def _run_pair(objective: str, cadence: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    if len(rows)<20:
        raise ValueError(f"Insufficient {objective}/{cadence} rows for a temporal grouped experiment: {len(rows)}")
    manifest=_snapshot(objective,cadence,rows)
    folder=OUTPUT/objective/cadence.lower()
    snapshot_dir=folder/"snapshot"
    snapshot_dir.mkdir(parents=True,exist_ok=True)
    (snapshot_dir/"manifest.json").write_text(json.dumps(manifest,indent=2,sort_keys=True,ensure_ascii=False)+"\n",encoding="utf-8")
    (snapshot_dir/"rows.jsonl").write_text("".join(json.dumps(row,sort_keys=True,separators=(",",":"),ensure_ascii=False)+"\n" for row in rows),encoding="utf-8")
    if objective=="course_abandonment":
        partition=prepare_event_dataset(manifest,rows,seed=42,test_ratio=0.2,apply_balancing=True)
    else:
        partition=prepare_dataset(manifest,rows,seed=42,test_ratio=0.2,apply_balancing=True)
    artifacts=[]
    summaries=[]
    for algorithm in ("random_forest","xgboost"):
        if algorithm=="random_forest":
            search={"n_estimators":[40,80],"max_depth":[6],"min_samples_split":[2]}
        else:
            search={"n_estimators":[40,80],"max_depth":[3],"learning_rate":[0.1]}
        result=train_model(partition,algorithm,config={"search_space":search},seed=42,cpu_limit=1,memory_limit_mb=2048,cv_splits=3)
        result.manifest["dataset_digest"]=manifest["content_digest"]
        job=f"{objective}-{cadence.lower()}-{algorithm}"
        artifact_dir=folder/"artifacts"
        dataset_ref={"dataset_ref":manifest["snapshot_ref"],"manifest_ref":manifest["dataset_id"],
            "dataset_id":manifest["dataset_id"],"dataset_digest":manifest["content_digest"],
            "snapshot_ref":manifest["snapshot_ref"],"target_definition_ref":manifest["target_definition_ref"],
            "population_definition_ref":manifest["population_definition_ref"],
            "partition_id":partition.partition_metadata["partition_id"],"fixture_only":True,
            "source":manifest["source"],"academic_cut":manifest["academic_cut"],"coverage":manifest["coverage"]}
        written=write_training_artifacts(job,artifact_dir,result.model,result.preprocessing_pipeline,
            result.manifest,result.metrics,result.training_config,result.balance_report,result.feature_names,
            result.dependency_lock,dataset_ref,feature_schema=[
                {"name":name,"logical_type":next(f["logical_type"] for f in manifest["fields"] if f["name"]==name),
                 "nullable":next(f["nullable"] for f in manifest["fields"] if f["name"]==name),"available_at_cut":True}
                for name in result.feature_names])
        artifacts.append(artifact_dir/job)
        summaries.append({"algorithm":algorithm,"artifact_digest":written["artifact_digest"],
            "duration_seconds":result.duration_seconds,"validation_recall":result.training_config["tuning"]["best_mean_recall"],
            "validation_f1":result.training_config["tuning"]["best_mean_f1"],"holdout_metrics":result.metrics,
            "partition":partition.partition_metadata})
    report=compare_artifacts(artifacts,folder/"comparison.json")
    return {"objective":objective,"cadence":cadence,"row_count":len(rows),
        "class_distribution":dict(Counter(row["target_class"] for row in rows)),
        "snapshot_ref":manifest["snapshot_ref"],"dataset_digest":manifest["content_digest"],
        "comparison_status":report["decision_status"],"validation_selection":report["candidate_selection_status"],
        "selected_candidate_by_validation":report["selected_candidate_by_validation"],
        "partition_id":partition.partition_metadata["partition_id"],"models":summaries}


def main() -> None:
    OUTPUT.mkdir(parents=True,exist_ok=True)
    raw_course=_query(COURSE_SQL)
    raw_program=_query(PROGRAM_SQL)
    result=[]
    for objective,raw in (("course_abandonment",raw_course),("program_dropout",raw_program)):
        decorated=_decorate(raw,objective)
        for cadence in ("SEMESTRAL","ANUAL"):
            cadence_rows=[dict(row) for row in decorated if row["cadence"]==cadence]
            for row in cadence_rows:
                row.pop("cadence",None)
            if not cadence_rows:
                continue
            result.append(_run_pair(objective,cadence,cadence_rows))
    summary={"scope":"synthetic_software_validation_only","institutional_decision":"EVIDENCIA_INSUFICIENTE",
        "promotion_allowed":False,"results":result}
    (OUTPUT/"summary.json").write_text(json.dumps(summary,indent=2,sort_keys=True,ensure_ascii=False,default=str)+"\n",encoding="utf-8")
    print(json.dumps({"summary":str(OUTPUT/"summary.json"),"experiments":len(result),
        "results":[{"objective":item["objective"],"cadence":item["cadence"],"rows":item["row_count"],
                     "classes":item["class_distribution"],"status":item["comparison_status"]} for item in result]},ensure_ascii=False))


if __name__=="__main__":
    main()
