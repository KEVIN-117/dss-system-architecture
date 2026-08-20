import re
import sys
import json
import base64
import random
import datetime
import argparse
import subprocess
from urllib.request import Request, urlopen
from urllib.error import URLError
from concurrent.futures import ThreadPoolExecutor

# Neo4j configuration
NEO4J_URL = "http://localhost:7474/db/neo4j/tx/commit"
NEO4J_AUTH = base64.b64encode(b"neo4j:1234567890").decode("ascii")

# DB execution helper using docker container
def execute_sql(sql_content):
    full_content = "SET session_replication_role = 'replica';\n" + sql_content
    p = subprocess.Popen(
        ['docker', 'exec', '-i', 'postgres', 'psql', '-U', 'postgres', '-d', 'jachasun'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8'
    )
    stdout, stderr = p.communicate(input=full_content)
    if p.returncode != 0:
        return False, stderr
    return True, stdout

def run_query(sql_query):
    p = subprocess.Popen(
        ['docker', 'exec', '-i', 'postgres', 'psql', '-U', 'postgres', '-d', 'jachasun', '-A', '-F', ',', '-c', sql_query],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8'
    )
    stdout, stderr = p.communicate()
    if p.returncode != 0:
        return None
    return stdout

# Helper to run Neo4j statements
def execute_cypher(statements):
    payload = {
        "statements": [{"statement": stmt, "parameters": params} for stmt, params in statements]
    }
    req = Request(NEO4J_URL, data=json.dumps(payload).encode('utf-8'))
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Basic {NEO4J_AUTH}")
    try:
        with urlopen(req) as res:
            res_data = json.loads(res.read().decode('utf-8'))
            if res_data.get('errors'):
                print("Neo4j Errors:", res_data['errors'])
                return False
            return True
    except URLError as e:
        print("Neo4j URL Error:", e)
        return False

# Faculties and Careers definition
faculties = [
    (1, "Facultad de Ciencias Puras", "FCP"),
    (2, "Facultad de Tecnología", "FTEC"),
    (3, "Facultad de Ingeniería Minera", "FMIN"),
    (4, "Facultad de Ciencias Económicas, Financieras y Administrativas", "FCEFA"),
    (5, "Facultad de Medicina", "FMED")
]

# Modalities: 'SEM' (semestral), 'ANU' (anual)
careers = [
    ('SIS', "Ingeniería de Sistemas", 2, "S", "Licenciado en Ingeniería de Sistemas", "Licenciatura"),
    ('CIV', "Ingeniería Civil", 2, "S", "Licenciado en Ingeniería Civil", "Licenciatura"),
    ('AUT', "Ingeniería de Autotrónica", 2, "S", "Licenciado en Ingeniería de Autotrónica", "Licenciatura"),
    ('MIN', "Ingeniería de Minas", 3, "S", "Licenciado en Ingeniería de Minas", "Licenciatura"),
    ('ADM', "Administración de Empresas", 4, "S", "Licenciado en Administración de Empresas", "Licenciatura"),
    ('AUD', "Auditoría", 4, "S", "Licenciado en Auditoría", "Licenciatura"),
    ('QUI', "Química", 1, "S", "Licenciado en Ciencias Químicas", "Licenciatura"),
    ('MED', "Medicina", 5, "A", "Médico Cirujano", "Licenciatura"),
    ('DER', "Derecho", 4, "A", "Licenciado en Ciencias Jurídicas y Políticas", "Licenciatura"),
    ('ENF', "Enfermería", 5, "A", "Licenciado en Enfermería", "Licenciatura")
]

# Course template mapping
subject_templates = {
    'MED': {
        1: ["Anatomía Humana I", "Histología", "Embriología", "Bioquímica Médica", "Salud Pública I"],
        2: ["Anatomía Humana II", "Fisiología", "Microbiología y Parasitología", "Patología General", "Salud Pública II"],
        3: ["Farmacología", "Semiología Médica", "Fisiopatología", "Epidemiología", "Nutrición Médica"],
        4: ["Medicina Interna I", "Cirugía General I", "Pediatría I", "Ginecología", "Salud Pública III"],
        5: ["Medicina Interna II", "Cirugía General II", "Pediatría II", "Obstetricia", "Medicina Legal y Ética"]
    },
    'DER': {
        1: ["Introducción al Derecho", "Derecho Civil I (Personas)", "Derecho Constitucional", "Historia del Derecho", "Sociología Jurídica"],
        2: ["Derecho Civil II (Bienes)", "Derecho Penal I", "Derecho Romano", "Oratoria Forense", "Criminología"],
        3: ["Derecho Civil III (Obligaciones)", "Derecho Penal II", "Derecho Internacional Público", "Derecho Administrativo", "Derecho de Familia"],
        4: ["Derecho Civil IV (Contratos)", "Derecho Procesal Civil I", "Derecho Procesal Penal", "Derecho Laboral", "Filosofía del Derecho"],
        5: ["Derecho de Sucesiones", "Derecho Procesal Civil II", "Derecho Internacional Privado", "Práctica Forense", "Ética Profesional"]
    },
    'ENF': {
        1: ["Fundamentos de Enfermería", "Anatomía y Fisiología", "Psicología Evolutiva", "Nutrición y Dietética", "Primeros Auxilios"],
        2: ["Enfermería Médico-Quirúrgica I", "Farmacología Clínica", "Microbiología Aplicada", "Epidemiología de Campo", "Salud Comunitaria I"],
        3: ["Enfermería Médico-Quirúrgica II", "Enfermería Materno-Infantil", "Gestión de Servicios de Enfermería", "Salud Comunitaria II", "Ética y Deontología"],
        4: ["Enfermería Pediátrica", "Salud Mental y Psiquiatría", "Investigación en Enfermería", "Enfermería Geriátrica", "Prácticas Clínicas Integradas I"],
        5: ["Enfermería de Urgencias y Emergencias", "Cuidados Paliativos", "Gestión Hospitalaria", "Prácticas Clínicas Integradas II", "Trabajo de Grado"]
    },
    'SIS': {
        1: ["Álgebra Lineal", "Cálculo I", "Introducción a la Programación", "Física I"],
        2: ["Cálculo II", "Estructuras de Datos", "Física II", "Programación Orientada a Objetos"],
        3: ["Cálculo III", "Base de Datos I", "Programación Web", "Arquitectura de Computadoras"],
        4: ["Base de Datos II", "Ingeniería de Software I", "Redes de Computadoras I", "Sistemas Operativos"],
        5: ["Ingeniería de Software II", "Redes de Computadoras II", "Inteligencia Artificial", "Teoría de Sistemas"],
        6: ["Gestión de Software", "Auditoría de Sistemas", "Seguridad Informática", "Sistemas Distribuidos"],
        7: ["Modelos y Simulación", "Inteligencia de Negocios", "Taller de Grado I", "Gestión Estratégica"],
        8: ["Taller de Grado II", "Práctica Profesional", "Ética en Sistemas", "Calidad de Software"],
        9: ["Big Data y Analítica", "Security Information", "Electiva I", "Electiva II"],
        10: ["Tesis de Grado", "Proyecto de Fin de Carrera", "Electiva III", "Electiva IV"]
    },
    'CIV': {
        1: ["Cálculo I", "Álgebra Lineal", "Geometría Descriptiva", "Química Tecnológica"],
        2: ["Cálculo II", "Física I", "Topografía I", "Dibujo Técnico en CAD"],
        3: ["Cálculo III", "Física II", "Topografía II", "Resistencia de Materiales I"],
        4: ["Resistencia de Materiales II", "Hidráulica I", "Mecánica de Suelos I", "Materiales de Construcción"],
        5: ["Hidráulica II", "Mecánica de Suelos II", "Análisis Estructural I", "Tecnología del Hormigón"],
        6: ["Análisis Estructural II", "Hidrología Aplicada", "Diseño de Hormigón Armado I", "Carreteras II"],
        7: ["Diseño de Hormigón Armado II", "Ingeniería Sanitaria I", "Puentes", "Fundaciones y Cimientos"],
        8: ["Estructuras Metálicas", "Ingeniería Sanitaria II", "Taller de Grado I", "Presupuestos y Costos"],
        9: ["Obras Hidráulicas", "Vías de Comunicación", "Taller de Grado II", "Electiva I"],
        10: ["Trabajo de Grado", "Proyecto de Ingeniería", "Electiva II", "Electiva III"]
    },
    'AUT': {
        1: ["Cálculo I", "Física I", "Química General", "Álgebra Lineal"],
        2: ["Cálculo II", "Física II", "Circuitos Eléctricos I", "Termodinámica"],
        3: ["Circuitos Eléctricos II", "Electrónica Analógica", "Estructura del Automóvil", "Metrología"],
        4: ["Electrónica Digital", "Motores de Combustión I", "Sistemas de Transmisión", "Autotrónica I"],
        5: ["Microcontroladores", "Motores de Combustión II", "Inyección Electrónica Gasolina", "Autotrónica II"],
        6: ["Seguridad Activa y Pasiva", "Sensores y Actuadores", "Inyección Electrónica Diésel", "Redes de Comunicación CAN"],
        7: ["Sistemas Híbridos y Eléctricos", "Diagnóstico OBD", "Gestión de Talleres", "Taller de Grado I"],
        8: ["Electromovilidad", "Sistemas ADAS", "Taller de Grado II", "Práctica Profesional"],
        9: ["Energías Alternativas", "Diseño Asistido CAE", "Electiva I", "Electiva II"],
        10: ["Trabajo de Grado", "Proyecto Final Autotrónica", "Electiva III", "Electiva IV"]
    },
    'MIN': {
        1: ["Cálculo I", "Física I", "Química General", "Introducción a la Minería"],
        2: ["Cálculo II", "Física II", "Cristalografía y Mineralogía", "Geología General"],
        3: ["Mineralogía Óptica", "Geología Estructural", "Mecánica de Fluidos", "Topografía Subterránea"],
        4: ["Yacimientos Minerales", "Mecánica de Rocas I", "Perforación y Voladura", "Transporte Minero"],
        5: ["Mecánica de Rocas II", "Métodos Explotación Subterránea", "Ventilación de Minas", "Seguridad Minera"],
        6: ["Métodos Explotación Superficial", "Fortificación de Minas", "Metalurgia Extractiva", "Economía Minera"],
        7: ["Diseño de Minas", "Maquinaria Minera", "Taller de Grado I", "Legislación Minera"],
        8: ["Automatización Minera", "Cierre de Minas", "Taller de Grado II", "Práctica Industrial"],
        9: ["Geoestadística", "Simulación Operaciones", "Electiva I", "Electiva II"],
        10: ["Trabajo de Grado", "Proyecto Final Minería", "Electiva III", "Electiva IV"]
    },
    'ADM': {
        1: ["Introducción a la Administración", "Fundamentos de Economía", "Contabilidad General", "Matemáticas Financieras"],
        2: ["Proceso Administrativo", "Microeconomía", "Contabilidad de Costos", "Estadística Descriptiva"],
        3: ["Recursos Humanos I", "Macroeconomía", "Presupuestos", "Estadística Inferencial"],
        4: ["Recursos Humanos II", "Marketing I", "Administración Financiera I", "Investigación de Operaciones"],
        5: ["Comportamiento Organizacional", "Marketing II", "Administración Financiera II", "Planificación Estratégica"],
        6: ["Gestión de Operaciones", "Investigación de Mercados", "Finanzas Corporativas", "Organización y Métodos"],
        7: ["Dirección y Liderazgo", "Formulación de Proyectos", "Toma de Decisiones", "Taller de Grado I"],
        8: ["Evaluación de Proyectos", "Gestión de la Calidad", "Taller de Grado II", "Emprendimiento"],
        9: ["Consultoría Organizacional", "Gestión del Cambio", "Electiva I", "Electiva II"],
        10: ["Trabajo de Grado", "Proyecto Fin de Carrera", "Electiva III", "Electiva IV"]
    },
    'QUI': {
        1: ["Química General I", "Cálculo I", "Física General I", "Introducción al Laboratorio"],
        2: ["Química General II", "Cálculo II", "Física General II", "Química Orgánica I"],
        3: ["Química Orgánica II", "Química Analítica Cuantitativa", "Fisicoquímica I", "Física General III"],
        4: ["Química Orgánica III", "Análisis Instrumental I", "Fisicoquímica II", "Química Inorgánica I"],
        5: ["Bioquímica General", "Análisis Instrumental II", "Fisicoquímica III", "Operaciones Unitarias I"],
        6: ["Química Industrial", "Bioquímica Aplicada", "Química Ambiental", "Operaciones Unitarias II"],
        7: ["Química de Alimentos", "Control de Calidad", "Química Tecnológica", "Taller de Grado I"],
        8: ["Gestión de Residuos", "Síntesis Química", "Taller de Grado II", "Práctica Profesional"],
        9: ["Química del Estado Sólido", "Química de Polímeros", "Electiva I", "Electiva II"],
        10: ["Trabajo de Grado", "Proyecto de Grado Química", "Electiva III", "Electiva IV"]
    },
    'AUD': {
        1: ["Contabilidad Básica", "Introducción a la Economía", "Matemáticas para Auditores", "Metodología de Trabajo"],
        2: ["Contabilidad Intermedia", "Microeconomía", "Contabilidad Costos I", "Derecho Tributario I"],
        3: ["Contabilidad Costos II", "Contabilidad Cooperativas", "Administración General", "Derecho Tributario II"],
        4: ["Contabilidad Sociedades", "Contabilidad Gubernamental I", "Introducción a la Auditoría", "Sistemas Contables"],
        5: ["Contabilidad Agropecuaria", "Contabilidad Gubernamental II", "Auditoría Financiera I", "Auditoría Interna"],
        6: ["Contabilidad Bancaria", "Auditoría Financiera II", "Auditoría Gubernamental I", "Finanzas de Empresas"],
        7: ["Auditoría Gubernamental II", "Auditoría Tributaria", "Auditoría de Sistemas", "Taller de Grado I"],
        8: ["Auditoría Operativa", "Auditoría Forense", "Taller de Grado II", "Práctica Profesional"],
        9: ["Control de Gestión", "Auditoría de Gestión", "Electiva I", "Electiva II"],
        10: ["Trabajo de Grado", "Proyecto Final Auditoría", "Electiva III", "Electiva IV"]
    }
}

first_names = ['Juan', 'Maria', 'Jose', 'Ana', 'Luis', 'Carlos', 'Laura', 'Pedro', 'Sofia', 'Miguel', 'Elena', 'Jorge', 'Lucia', 'David', 'Carmen', 'Francisco', 'Isabel', 'Antonio', 'Paula', 'Manuel', 'Ramon', 'Beatriz', 'Diego', 'Patricia', 'Fernando', 'Teresa', 'Hugo', 'Gabriel', 'Alejandro', 'Valentina', 'Andrea', 'Mateo', 'Camila', 'Santiago', 'Mariana', 'Lucas', 'Natalia', 'Daniel', 'Victoria', 'Sebastian']
last_names = ['Gomez', 'Rodriguez', 'Gonzalez', 'Fernandez', 'Lopez', 'Diaz', 'Martinez', 'Perez', 'Garcia', 'Sanchez', 'Romero', 'Torres', 'Ruiz', 'Ramirez', 'Flores', 'Acosta', 'Benitez', 'Medina', 'Herrera', 'Castro', 'Vargas', 'Rios', 'Guzman', 'Mendoza', 'Soto', 'Silva', 'Suarez', 'Delgado', 'Pena', 'Cruz', 'Ortiz', 'Morales', 'Jimenez', 'Alvarez', 'Rojas', 'Salazar', 'Gimenez', 'Duarte', 'Miranda', 'Ramos']

# Stage 1: Cleanup and recreate lookup tables
def do_cleanup():
    print("Truncating existing data tables...")
    truncate_sql = """
    TRUNCATE TABLE academico.notas_planilla CASCADE;
    TRUNCATE TABLE academico.alm_programaciones CASCADE;
    TRUNCATE TABLE academico.alumnos CASCADE;
    TRUNCATE TABLE public.uatf_datos CASCADE;
    TRUNCATE TABLE academico.docentes CASCADE;
    TRUNCATE TABLE academico.dct_asignaciones CASCADE;
    TRUNCATE TABLE academico.pln_materias CASCADE;
    """
    success, err = execute_sql(truncate_sql)
    if not success:
        print("Truncation failed:", err)
        sys.exit(1)
        
    print("Inserting lookup prerequisite tables data...")
    prereq_sql = """
    INSERT INTO _bp_estados_civiles(id_estado_civil, estado_civil, _registrado, _modificado, _estado) VALUES 
    (1, 'S', now(), now(), 'A'),
    (2, 'C', now(), now(), 'A'),
    (3, 'D', now(), now(), 'A'),
    (4, 'V', now(), now(), 'A')
    ON CONFLICT (id_estado_civil) DO NOTHING;

    INSERT INTO prs_calificacion(id_calificacion, calificacion) VALUES 
    ('1', 'Regular'),
    ('2', 'Excelente')
    ON CONFLICT (id_calificacion) DO NOTHING;

    INSERT INTO lugar_localidad(cod_loc, cod_prov, _registrado, _estado, localidad) VALUES 
    (1, 1, now(), 'A', 'Potosí'),
    (2, 1, now(), 'A', 'Uyuni')
    ON CONFLICT (cod_loc, cod_prov) DO NOTHING;

    INSERT INTO prs_colegios(id_colegio, id_colegio_original, colegio, tipo, turno, area, cod_dep, cod_prov, cod_loc, cod_prov_2, id_pais, _estado) VALUES 
    (1, 1, 'Colegio Pichincha', 'U', 'M', 'U', 1, 1, 1, 1, 1, 'A'),
    (2, 2, 'Colegio Calero', 'U', 'T', 'U', 1, 1, 1, 1, 1, 'A')
    ON CONFLICT (id_colegio) DO NOTHING;

    INSERT INTO academico.alumnos_estados(estado, descripcion) VALUES 
    ('P', 'Regular/Activo'),
    ('A', 'Anulado'),
    ('E', 'Egresado')
    ON CONFLICT (estado) DO NOTHING;

    INSERT INTO academico.carreras_tipos(tipo, descripcion, semanas) VALUES 
    ('S', 'Semestral', 20),
    ('A', 'Anual', 40)
    ON CONFLICT (tipo) DO NOTHING;

    INSERT INTO academico.sedes(id_sede, sede) VALUES 
    ('P', 'Potosí'),
    ('U', 'Uyuni')
    ON CONFLICT (id_sede) DO NOTHING;

    INSERT INTO academico.alm_periodos(id_periodo, descripcion, id_periodo_relacion) VALUES 
    (1, 'Primer Semestre', 1),
    (2, 'Segundo Semestre', 2),
    (3, 'Anual', 3)
    ON CONFLICT (id_periodo) DO NOTHING;
    """
    success, err = execute_sql(prereq_sql)
    if not success:
        print("Lookup SQL execution failed:", err)
        sys.exit(1)

    print("Inserting Faculties and Careers...")
    fac_sql = []
    for fid, fname, fabre in faculties:
        fac_sql.append(f"INSERT INTO academico.alm_programas_facultades (id_facultad, facultad, facu_abre, estado) VALUES ({fid}, '{fname}', '{fabre}', 'A') ON CONFLICT (id_facultad) DO NOTHING;")

    car_sql = []
    for cid, cname, fid, ctype, ctitle, cnivel in careers:
        car_sql.append(f"INSERT INTO academico.alm_programas (id_programa, programa, id_facultad, tipo, titulo, activo, nivel, sede, id_nivel) VALUES ('{cid}', '{cname}', {fid}, '{ctype}', '{ctitle}', 'SI', '{cnivel}', 'P', 1) ON CONFLICT (id_programa) DO NOTHING;")

    execute_sql("\n".join(fac_sql))
    execute_sql("\n".join(car_sql))

    print("Inserting subjects (pln_materias)...")
    subj_sql = []
    for program_id, levels in subject_templates.items():
        for lvl, subj_list in levels.items():
            for idx, sub_name in enumerate(subj_list, 1):
                sigla = f"{program_id}-{lvl}{idx:02d}"
                subj_sql.append(
                    f"INSERT INTO academico.pln_materias (sigla, materia, id_programa, nivel_academico, _estado) VALUES "
                    f"('{sigla}', '{sub_name}', '{program_id}', {lvl}, 'REGISTRADO') ON CONFLICT DO NOTHING;"
                )
    execute_sql("\n".join(subj_sql))
    print("Cleanup and lookup table setup complete.")

# Stage 2: Generate personal profiles (Students and Teachers)
def do_personal():
    print("Generating 2500 students and 150 teachers...")
    
    # 1. Teachers
    docentes_sql = []
    for idx in range(1, 151):
        fname = random.choice(first_names)
        paterno = random.choice(last_names)
        materno = random.choice(last_names)
        ci = f"{1000000 + idx}"
        email = f"{fname.lower()}.{paterno.lower()}@docente.uatf.edu.bo"
        phone = f"{random.randint(60000000, 79999999)}"
        gender = random.choice(['M', 'F'])
        bdate = f"{random.randint(1960, 1990)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
        
        # Pick one random program as teaching home base
        prog = random.choice(careers)[0]
        
        docentes_sql.append(
            f"INSERT INTO academico.docentes (id_docente, nombres, paterno, materno, clave, estado, ci, fec_nac, email, usuario, telefono_per, id_programa, sexo, sau) "
            f"VALUES ({idx}, '{fname}', '{paterno}', '{materno}', '1234567890', 'A', '{ci}', '{bdate}', '{email}', 'doc_{idx}', '{phone}', '{prog}', '{gender}', 'N') "
            f"ON CONFLICT (id_docente) DO NOTHING;"
        )
    print("Inserting teachers...")
    success, err = execute_sql("\n".join(docentes_sql))
    if not success:
        print("Failed to insert teachers:", err[:200])

    # 2. Students
    uatf_inserts = []
    alumnos_inserts = []
    
    for idx in range(1, 2501):
        id_ra = f"RA-{10000 + idx}"
        nro_dip = f"{5000000 + idx}"
        fname = random.choice(first_names)
        paterno = random.choice(last_names)
        materno = random.choice(last_names)
        gender = random.choice(['M', 'F'])
        # Age distribution: 18 to 35
        birth_year = random.choice(range(1991, 2008))
        bdate = f"{birth_year}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
        email = f"{fname.lower()}.{paterno.lower()}{idx}@uatf.edu.bo"
        phone = f"{random.randint(60000000, 79999999)}"
        
        uatf_inserts.append(
            f"INSERT INTO public.uatf_datos (id_ra, nro_dip, paterno, materno, nombres, id_sexo, fec_nacimiento, id_loc, id_colegio, email, telefono, estado_civil, _registrado, _modificado) "
            f"VALUES ('{id_ra}', '{nro_dip}', '{paterno}', '{materno}', '{fname}', '{gender}', '{bdate}', 1, 1, '{email}', '{phone}', 1, now(), now()) ON CONFLICT (id_ra) DO NOTHING;"
        )
        
        prog_id = random.choice(careers)[0]
        # Distribute admission date
        enroll_year = random.choice(range(2018, 2026))
        enroll_date = f"{enroll_year}-02-15"
        
        # Decide status based on admission year
        years_in_uni = 2026 - enroll_year
        if years_in_uni >= 5:
            status = random.choices(['E', 'P', 'A'], weights=[0.7, 0.2, 0.1])[0]
        else:
            status = random.choices(['P', 'A'], weights=[0.9, 0.1])[0]
            
        alumnos_inserts.append(
            f"INSERT INTO academico.alumnos (id_alumno, id_programa, id_ra, id_grado, estado, tipo_alumno, ssu, id_mencion, nivel_acad, fec_inscripcion) "
            f"VALUES ({idx}, '{prog_id}', '{id_ra}', 'A', '{status}', 'A', 'S', 0, 1, '{enroll_date}') ON CONFLICT (id_alumno) DO NOTHING;"
        )
        
    print("Inserting student personal details...")
    for chunk in range(0, len(uatf_inserts), 500):
        execute_sql("\n".join(uatf_inserts[chunk:chunk+500]))
        
    print("Inserting student academic records...")
    for chunk in range(0, len(alumnos_inserts), 500):
        execute_sql("\n".join(alumnos_inserts[chunk:chunk+500]))
        
    print("Personal profiles generation complete.")

# Stage 3: Generate Academic History (Grades & Teacher Assignments)
def do_academic(career_filter=None):
    print("Querying reference maps from database...")
    # Query subject map
    mapping_str = run_query("SELECT sigla, id_materia, id_programa FROM academico.pln_materias;")
    sigla_to_id = {}
    materia_by_program = {}
    if mapping_str:
        for line in mapping_str.strip().split('\n'):
            if ',' in line:
                parts = line.split(',')
                if len(parts) == 3:
                    sigla, mid, pid = parts[0].strip(), parts[1].strip(), parts[2].strip()
                    try:
                        mid_int = int(mid)
                        sigla_to_id[sigla] = mid_int
                        if pid not in materia_by_program:
                            materia_by_program[pid] = []
                        materia_by_program[pid].append((sigla, mid_int))
                    except ValueError:
                        pass
                        
    # Query student map
    student_list_str = run_query("SELECT id_alumno, id_programa, EXTRACT(YEAR FROM fec_inscripcion), estado FROM academico.alumnos;")
    students = []
    if student_list_str:
        for line in student_list_str.strip().split('\n'):
            if ',' in line:
                parts = line.split(',')
                try:
                    sid = int(parts[0])
                    pid = parts[1].strip()
                    start_yr = int(float(parts[2]))
                    status = parts[3].strip()
                    if career_filter is None or pid in career_filter:
                        students.append((sid, pid, start_yr, status))
                except ValueError:
                    pass

    # Query teachers
    teacher_str = run_query("SELECT id_docente FROM academico.docentes;")
    docente_ids = []
    if teacher_str:
        for line in teacher_str.strip().split('\n'):
            if line.strip().isdigit():
                docente_ids.append(int(line.strip()))
    if not docente_ids:
        docente_ids = list(range(1, 151))

    print(f"Loaded {len(sigla_to_id)} subjects and {len(students)} students in career scope.")
    
    # 1. Generate Teacher Assignments (dct_asignaciones) for 2018-2026
    print("Generating Teacher Assignments...")
    asignaciones_sql = []
    unique_assignments = set()
    
    for yr in range(2018, 2027):
        for pid, sub_list in materia_by_program.items():
            if career_filter is not None and pid not in career_filter:
                continue
            is_anual = (pid in ['MED', 'DER', 'ENF'])
            periods = [3] if is_anual else [1, 2]
            
            for p in periods:
                for sigla, mid in sub_list:
                    doc_id = random.choice(docente_ids)
                    key = (pid, mid, 1, yr, p)
                    if key not in unique_assignments:
                        unique_assignments.add(key)
                        asignaciones_sql.append(
                            f"INSERT INTO academico.dct_asignaciones (id_docente, id_programa, id_materia, id_grupo, id_gestion, id_periodo, fecha, _estado) "
                            f"VALUES ({doc_id}, '{pid}', {mid}, 1, {yr}, {p}, '{yr}-03-01', 'A') ON CONFLICT DO NOTHING;"
                        )
                        
    print(f"Inserting {len(asignaciones_sql)} teacher assignments...")
    for chunk in range(0, len(asignaciones_sql), 500):
        execute_sql("\n".join(asignaciones_sql[chunk:chunk+500]))

    # 2. Generate Student Academic History (Grades)
    print("Simulating student history parallelly...")
    
    def simulate_student(student_info):
        sid, pid, start_yr, final_status = student_info
        levels = subject_templates[pid]
        is_anual = (pid in ['MED', 'DER', 'ENF'])
        student_sql = []
        
        max_lvl = len(levels)
        
        if final_status == 'E':
            lvl_limit = max_lvl
        elif final_status == 'A':
            lvl_limit = random.randint(1, max(1, max_lvl // 2))
        else:
            lvl_limit = random.randint(1, max_lvl)
            
        current_year = start_yr
        current_period = 1 if not is_anual else 3
        
        failed_subjects = []
        
        for lvl in range(1, lvl_limit + 1):
            subjects_to_take = levels[lvl].copy()
            
            for fs in failed_subjects[:2]:
                subjects_to_take.append(fs)
                failed_subjects.remove(fs)
                
            for sub_name in subjects_to_take:
                if '-' in sub_name:
                    sigla = sub_name
                else:
                    sigla = f"{pid}-{lvl}{levels[lvl].index(sub_name)+1:02d}"
                    
                mid = sigla_to_id.get(sigla, 0)
                if mid == 0:
                    continue
                
                is_active_enrollment = False
                if current_year > 2026:
                    continue
                elif current_year == 2026:
                    if is_anual:
                        is_active_enrollment = True
                    elif current_period == 2:
                        is_active_enrollment = True
                
                outcome = random.choices(['pass', 'fail', 'drop'], weights=[0.75, 0.20, 0.05])[0]
                
                if outcome == 'pass':
                    nota = random.randint(51, 100)
                    estado = 'A'
                elif outcome == 'fail':
                    nota = random.randint(25, 50)
                    estado = 'R'
                    failed_subjects.append(sigla)
                else:
                    nota = 0
                    estado = 'I'
                    failed_subjects.append(sigla)
                
                pp = int(nota * 0.3) if nota > 0 else 0
                sp = int(nota * 0.3) if nota > 0 else 0
                tp = int(nota * 0.2) if nota > 0 else 0
                ex = int(nota * 0.2) if nota > 0 else 0
                
                if is_active_enrollment:
                    student_sql.append(
                        f"INSERT INTO academico.alm_programaciones (id_alumno, id_materia, id_gestion, id_periodo, id_grupo, nota, estado, _estado, pparcial, sparcial, tparcial, exfinal, ult_usuario) "
                        f"VALUES ({sid}, {mid}, {current_year}, {current_period}, 1, {nota}, '{estado}', 'REGISTRADO', {pp}, {sp}, {tp}, {ex}, 'system') ON CONFLICT DO NOTHING;"
                    )
                else:
                    student_sql.append(
                        f"INSERT INTO academico.notas_planilla (id_gestion, id_periodo, id_alumno, id_materia, grupo, nota, ult_usuario, estado, pparcial, sparcial, tparcial, exfinal, _unique) "
                        f"VALUES ({current_year}, {current_period}, {sid}, {mid}, 1, {nota}, 'system', '{estado}', {pp}, {sp}, {tp}, {ex}, 1) ON CONFLICT DO NOTHING;"
                    )
            
            if is_anual:
                current_year += 1
            else:
                if current_period == 1:
                    current_period = 2
                else:
                    current_period = 1
                    current_year += 1
                    
        return student_sql

    all_academic_sql = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(simulate_student, students))
        for res in results:
            all_academic_sql.extend(res)

    print(f"Generated {len(all_academic_sql)} academic transactions. Inserting in parallel batches...")
    
    chunk_size = (len(all_academic_sql) + 7) // 8
    chunks = [all_academic_sql[i:i+chunk_size] for i in range(0, len(all_academic_sql), chunk_size)]

    def insert_chunk(chunk_idx, sql_chunk):
        print(f"Worker {chunk_idx}: Loading {len(sql_chunk)} records...")
        sql_text = "\n".join(sql_chunk)
        success, err = execute_sql(sql_text)
        if not success:
            print(f"Worker {chunk_idx} failed: {err[:250]}")
        else:
            print(f"Worker {chunk_idx} completed successfully.")

    with ThreadPoolExecutor(max_workers=8) as executor:
        for idx, chunk in enumerate(chunks, 1):
            if chunk:
                executor.submit(insert_chunk, idx, chunk)
                
    print("Academic history load complete.")

# Stage 4: Sync PostgreSQL to Neo4j Graph
def do_neo4j():
    print("Preparing Neo4j graph nodes and relationships...")
    
    print("Reading Faculties & Programs from PG...")
    fac_str = run_query("SELECT id_facultad, facultad, facu_abre FROM academico.alm_programas_facultades;")
    prog_str = run_query("SELECT id_programa, programa, id_facultad, tipo FROM academico.alm_programas;")
    subj_str = run_query("SELECT id_materia, sigla, materia, id_programa, nivel_academico FROM academico.pln_materias;")
    teach_str = run_query("SELECT id_docente, nombres, paterno, materno, email FROM academico.docentes;")
    stud_str = run_query("SELECT a.id_alumno, d.nombres, d.paterno, d.materno, a.estado, a.id_programa, a.id_ra, EXTRACT(YEAR FROM a.fec_inscripcion) FROM academico.alumnos a JOIN public.uatf_datos d ON a.id_ra = d.id_ra;")
    
    faculties_list = []
    if fac_str:
        for line in fac_str.strip().split('\n')[1:]:
            parts = line.split(',')
            if len(parts) >= 2:
                try:
                    faculties_list.append((int(parts[0]), parts[1].strip(), parts[2].strip() if len(parts) > 2 else ""))
                except ValueError: pass

    programs_list = []
    if prog_str:
        for line in prog_str.strip().split('\n')[1:]:
            parts = line.split(',')
            if len(parts) >= 3:
                try:
                    programs_list.append((parts[0].strip(), parts[1].strip(), int(parts[2]), parts[3].strip()))
                except ValueError: pass

    subjects_list = []
    if subj_str:
        for line in subj_str.strip().split('\n')[1:]:
            parts = line.split(',')
            if len(parts) >= 4:
                try:
                    subjects_list.append((int(parts[0]), parts[1].strip(), parts[2].strip(), parts[3].strip(), int(parts[4])))
                except ValueError: pass

    teachers_list = []
    if teach_str:
        for line in teach_str.strip().split('\n')[1:]:
            parts = line.split(',')
            if len(parts) >= 4:
                try:
                    teachers_list.append((int(parts[0]), parts[1].strip(), parts[2].strip(), parts[3].strip(), parts[4].strip() if len(parts) > 4 else ""))
                except ValueError: pass

    students_list = []
    if stud_str:
        for line in stud_str.strip().split('\n')[1:]:
            parts = line.split(',')
            if len(parts) >= 8:
                try:
                    students_list.append((int(parts[0]), parts[1].strip(), parts[2].strip(), parts[3].strip(), parts[4].strip(), parts[5].strip(), parts[6].strip(), int(float(parts[7]))))
                except ValueError: pass

    print("Clearing Neo4j Graph...")
    execute_cypher([("MATCH (n) DETACH DELETE n", {})])

    cypher_statements = []

    cypher_statements.append(("CREATE CONSTRAINT IF NOT EXISTS FOR (f:Facultad) REQUIRE f.id IS UNIQUE", {}))
    cypher_statements.append(("CREATE CONSTRAINT IF NOT EXISTS FOR (c:Carrera) REQUIRE c.id IS UNIQUE", {}))
    cypher_statements.append(("CREATE CONSTRAINT IF NOT EXISTS FOR (m:Materia) REQUIRE m.id IS UNIQUE", {}))
    cypher_statements.append(("CREATE CONSTRAINT IF NOT EXISTS FOR (d:Docente) REQUIRE d.id IS UNIQUE", {}))
    cypher_statements.append(("CREATE CONSTRAINT IF NOT EXISTS FOR (e:Estudiante) REQUIRE e.id IS UNIQUE", {}))
    cypher_statements.append(("CREATE CONSTRAINT IF NOT EXISTS FOR (s:Semestre) REQUIRE s.id IS UNIQUE", {}))
    
    execute_cypher(cypher_statements)
    cypher_statements = []

    for fid, fname, fabre in faculties_list:
        cypher_statements.append((
            "CREATE (f:Facultad {id: $id, nombre: $nombre, abreviacion: $abreviacion, ubicación: 'Campus Central'})",
            {"id": fid, "nombre": fname, "abreviacion": fabre}
        ))

    for cid, cname, fid, ctype in programs_list:
        duracion = "10 Semestres" if ctype == "S" else "5 Años"
        cypher_statements.append((
            "CREATE (c:Carrera {id: $id, nombre: $nombre, duración: $duracion})",
            {"id": cid, "nombre": cname, "duracion": duracion}
        ))
        cypher_statements.append((
            "MATCH (c:Carrera {id: $cid}), (f:Facultad {id: $fid}) CREATE (f)-[:OFRECE]->(c)",
            {"cid": cid, "fid": fid}
        ))

    for mid, sigla, mname, pid, lvl in subjects_list:
        cypher_statements.append((
            "CREATE (m:Materia {id: $id, código: $sigla, nombre: $nombre, nivel: $nivel, créditos: 5})",
            {"id": mid, "sigla": sigla, "nombre": mname, "nivel": lvl}
        ))
        cypher_statements.append((
            "MATCH (m:Materia {id: $mid}), (c:Carrera {id: $cid}) CREATE (c)-[:INCLUYE]->(m)",
            {"mid": mid, "cid": pid}
        ))

    for cid, levels in subject_templates.items():
        for lvl in range(2, len(levels) + 1):
            for idx, sub_name in enumerate(levels[lvl], 1):
                sigla = f"{cid}-{lvl}{idx:02d}"
                prev_lvl = lvl - 1
                prev_idx = min(idx, len(levels[prev_lvl]))
                prev_sigla = f"{cid}-{prev_lvl}{prev_idx:02d}"
                
                cypher_statements.append((
                    "MATCH (m2:Materia {código: $sigla}), (m1:Materia {código: $prev_sigla}) "
                    "CREATE (m1)-[:REQUISITO_DE]->(m2)",
                    {"sigla": sigla, "prev_sigla": prev_sigla}
                ))

    for tid, fname, pat, mat, email in teachers_list:
        fullname = f"{fname} {pat} {mat}"
        cypher_statements.append((
            "CREATE (d:Docente {id: $id, nombre: $nombre, email: $email, especialidad: 'Docencia Universitaria'})",
            {"id": tid, "nombre": fullname, "email": email}
        ))

    for sid, fname, pat, mat, status, pid, mat_id, yr_ing in students_list:
        fullname = f"{fname} {pat} {mat}"
        cypher_statements.append((
            "CREATE (e:Estudiante {id: $id, nombre: $nombre, estado: $estado, matrícula: $matricula, año_ingreso: $anio})",
            {"id": sid, "nombre": fullname, "estado": status, "matricula": mat_id, "anio": yr_ing}
        ))
        cypher_statements.append((
            "MATCH (e:Estudiante {id: $sid}), (c:Carrera {id: $cid}) CREATE (e)-[:PERTENECE_A]->(c)",
            {"sid": sid, "cid": pid}
        ))

    print(f"Submitting base structure to Neo4j...")
    batch_size = 200
    for i in range(0, len(cypher_statements), batch_size):
        execute_cypher(cypher_statements[i:i+batch_size])
    cypher_statements = []

    print("Reading assignments and grades history to generate graph edges...")
    asg_str = run_query("SELECT id_docente, id_materia, id_gestion, id_periodo, id_grupo FROM academico.dct_asignaciones;")
    grd_str = run_query("SELECT id_alumno, id_materia, id_gestion, id_periodo, nota, estado FROM academico.notas_planilla;")
    curr_str = run_query("SELECT id_alumno, id_materia, id_gestion, id_periodo, nota, estado FROM academico.alm_programaciones;")

    if asg_str:
        for line in asg_str.strip().split('\n')[1:]:
            parts = line.split(',')
            if len(parts) >= 5:
                try:
                    tid, mid, gest, pd, gp = int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4])
                    cypher_statements.append((
                        "MERGE (s:Semestre {id: $sid}) ON CREATE SET s.nombre = $sname, s.año = $gest",
                        {"sid": f"{gest}-{pd}", "sname": f"Semestre {pd} - {gest}", "gest": gest}
                    ))
                    cypher_statements.append((
                        "MATCH (m:Materia {id: $mid}), (s:Semestre {id: $sid}) MERGE (m)-[:SE_DICTA_EN]->(s)",
                        {"mid": mid, "sid": f"{gest}-{pd}"}
                    ))
                    cypher_statements.append((
                        "MATCH (d:Docente {id: $tid}), (m:Materia {id: $mid}) "
                        "CREATE (d)-[:DICTA {gestion: $gest, periodo: $pd, grupo: $gp}]->(m)",
                        {"tid": tid, "mid": mid, "gest": gest, "pd": pd, "gp": gp}
                    ))
                except ValueError: pass

    if grd_str:
        for line in grd_str.strip().split('\n')[1:]:
            parts = line.split(',')
            if len(parts) >= 6:
                try:
                    sid, mid, gest, pd, nota, estado = int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3]), int(float(parts[4])), parts[5].strip()
                    cypher_statements.append((
                        "MATCH (e:Estudiante {id: $sid}), (m:Materia {id: $mid}) "
                        "CREATE (e)-[:CURSA {gestion: $gest, periodo: $pd, nota: $nota, estado: $estado, tipo: 'Histórico'}]->(m)",
                        {"sid": sid, "mid": mid, "gest": gest, "pd": pd, "nota": nota, "estado": estado}
                    ))
                except ValueError: pass

    if curr_str:
        for line in curr_str.strip().split('\n')[1:]:
            parts = line.split(',')
            if len(parts) >= 6:
                try:
                    sid, mid, gest, pd, nota, estado = int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3]), int(float(parts[4])), parts[5].strip()
                    cypher_statements.append((
                        "MATCH (e:Estudiante {id: $sid}), (m:Materia {id: $mid}) "
                        "CREATE (e)-[:CURSA {gestion: $gest, periodo: $pd, nota: $nota, estado: $estado, tipo: 'Actual'}]->(m)",
                        {"sid": sid, "mid": mid, "gest": gest, "pd": pd, "nota": nota, "estado": estado}
                    ))
                except ValueError: pass

    print(f"Submitting {len(cypher_statements)} relationships to Neo4j...")
    for i in range(0, len(cypher_statements), batch_size):
        success = execute_cypher(cypher_statements[i:i+batch_size])
        if not success:
            print(f"Failed loading cypher relations batch starting at index {i}")

    print("Neo4j database loading complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UATF DSS Rich Historical Data Generator")
    parser.add_argument("--stage", required=True, choices=["cleanup", "personal", "academic", "neo4j"], help="Stage to execute")
    parser.add_argument("--careers", help="Comma-separated career IDs to restrict academic stage execution")
    args = parser.parse_args()

    if args.stage == "cleanup":
        do_cleanup()
    elif args.stage == "personal":
        do_personal()
    elif args.stage == "academic":
        cf = [c.strip() for c in args.careers.split(",")] if args.careers else None
        do_academic(career_filter=cf)
    elif args.stage == "neo4j":
        do_neo4j()
