import re
import sys
import json
import base64
import random
import datetime
import subprocess
from urllib.request import Request, urlopen
from urllib.error import URLError
from concurrent.futures import ThreadPoolExecutor

# Neo4j configuration
NEO4J_URL = "http://localhost:7474/db/neo4j/tx/commit"
NEO4J_AUTH = base64.b64encode(b"neo4j:1234567890").decode("ascii")

# DB execution helper using docker container
def execute_sql(sql_content):
    # Prepend replica role to bypass foreign key checks for mock dataset loading
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

# Generate Mock Data
print("Generating prerequisite lookup tables data...")

prereq_sql = """
-- Prerequisite lookup tables
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
('SEM', 'Semestral', 20),
('ANU', 'Anual', 40)
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
    print("Prerequisites SQL execution failed:", err)
    sys.exit(1)
print("Prerequisite tables created and populated successfully.")

# Define faculties and programs
faculties = [
    (1, "Facultad de Ciencias Puras", "FCP"),
    (2, "Facultad de Tecnología", "FTEC"),
    (3, "Facultad de Ingeniería Minera", "FMIN"),
    (4, "Facultad de Ciencias Económicas, Financieras y Administrativas", "FCEFA"),
    (5, "Facultad de Medicina", "FMED")
]

# Modalities: 'SEM' (semestral), 'ANU' (anual)
careers = [
    # (id_programa, programa, id_facultad, tipo, titulo, nivel)
    ('SIS', "Ingeniería de Sistemas", 2, "SEM", "Licenciado en Ingeniería de Sistemas", "Licenciatura"),
    ('CIV', "Ingeniería Civil", 2, "SEM", "Licenciado en Ingeniería Civil", "Licenciatura"),
    ('AUT', "Ingeniería de Autotrónica", 2, "SEM", "Licenciado en Ingeniería de Autotrónica", "Licenciatura"),
    ('MIN', "Ingeniería de Minas", 3, "SEM", "Licenciado en Ingeniería de Minas", "Licenciatura"),
    ('ADM', "Administración de Empresas", 4, "SEM", "Licenciado en Administración de Empresas", "Licenciatura"),
    ('AUD', "Auditoría", 4, "SEM", "Licenciado en Auditoría", "Licenciatura"),
    ('QUI', "Química", 1, "SEM", "Licenciado en Ciencias Químicas", "Licenciatura"),
    ('MED', "Medicina", 5, "ANU", "Médico Cirujano", "Licenciatura"),
    ('DER', "Derecho", 4, "ANU", "Licenciado en Ciencias Jurídicas y Políticas", "Licenciatura"),
    ('ENF', "Enfermería", 5, "ANU", "Licenciado en Enfermería", "Licenciatura")
]

print("Inserting Faculties and Careers...")
fac_sql = []
for fid, fname, fabre in faculties:
    fac_sql.append(f"INSERT INTO academico.alm_programas_facultades (id_facultad, facultad, facu_abre, estado) VALUES ({fid}, '{fname}', '{fabre}', 'A') ON CONFLICT (id_facultad) DO NOTHING;")

car_sql = []
for cid, cname, fid, ctype, ctitle, cnivel in careers:
    car_sql.append(f"INSERT INTO academico.alm_programas (id_programa, programa, id_facultad, tipo, titulo, activo, nivel, sede) VALUES ('{cid}', '{cname}', {fid}, '{ctype}', '{ctitle}', 'SI', '{cnivel}', 'P') ON CONFLICT (id_programa) DO NOTHING;")

execute_sql("\n".join(fac_sql))
execute_sql("\n".join(car_sql))

# Subject Curricula template
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
    }
}

# Add default template for AUD if missing from template list (just to prevent any key issue)
subject_templates['AUD'] = {
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

print("Inserting subjects (pln_materias) in PostgreSQL...")
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
print("Subjects inserted.")

# Query generated subject mappings from postgres
print("Mapping subjects...")
mapping_str = run_query("SELECT sigla, id_materia FROM academico.pln_materias;")
sigla_to_id = {}
if mapping_str:
    for line in mapping_str.strip().split('\n'):
        if ',' in line:
            sigla, mid = line.split(',')
            try:
                sigla_to_id[sigla.strip()] = int(mid)
            except ValueError:
                pass

print(f"Mapped {len(sigla_to_id)} subjects.")

# Connect and write mock nodes to Neo4j
print("Creating Neo4j graph nodes and relations...")
cypher_statements = []

# Clear database
cypher_statements.append(("MATCH (n) DETACH DELETE n", {}))

# Create Faculties
for fid, fname, fabre in faculties:
    cypher_statements.append((
        "CREATE (f:Facultad {id: $id, nombre: $nombre, abreviacion: $abreviacion})",
        {"id": fid, "nombre": fname, "abreviacion": fabre}
    ))

# Create Careers (contemplating annual and semestral modalities)
for cid, cname, fid, ctype, _, _ in careers:
    modalidad = "semestral" if ctype == "SEM" else "anual"
    cypher_statements.append((
        "CREATE (c:Carrera {id: $id, nombre: $nombre, modalidad: $modalidad})",
        {"id": cid, "nombre": cname, "modalidad": modalidad}
    ))
    cypher_statements.append((
        "MATCH (c:Carrera {id: $cid}), (f:Facultad {id: $fid}) CREATE (c)-[:PERTENECE_A]->(f)",
        {"cid": cid, "fid": fid}
    ))

# Create Subject nodes in Neo4j
for program_id, levels in subject_templates.items():
    for lvl, subj_list in levels.items():
        for idx, sub_name in enumerate(subj_list, 1):
            sigla = f"{program_id}-{lvl}{idx:02d}"
            mid = sigla_to_id.get(sigla, 0)
            cypher_statements.append((
                "CREATE (m:Materia {id_materia: $id_materia, sigla: $sigla, nombre: $nombre, nivel: $nivel})",
                {"id_materia": mid, "sigla": sigla, "nombre": sub_name, "nivel": lvl}
            ))
            cypher_statements.append((
                "MATCH (m:Materia {sigla: $sigla}), (c:Carrera {id: $cid}) CREATE (m)-[:PERTENECE_A]->(c)",
                {"sigla": sigla, "cid": program_id}
            ))

# Create Prerequisites relationships in Neo4j
for program_id, levels in subject_templates.items():
    for lvl in range(2, len(levels) + 1):
        for idx, sub_name in enumerate(levels[lvl], 1):
            sigla = f"{program_id}-{lvl}{idx:02d}"
            # Prerequisite is Level N-1, same subject index if exists
            prev_lvl = lvl - 1
            prev_idx = min(idx, len(levels[prev_lvl]))
            prev_sigla = f"{program_id}-{prev_lvl}{prev_idx:02d}"
            
            cypher_statements.append((
                "MATCH (m2:Materia {sigla: $sigla}), (m1:Materia {sigla: $prev_sigla}) "
                "CREATE (m2)-[:PRERREQUISITO]->(m1)",
                {"sigla": sigla, "prev_sigla": prev_sigla}
            ))

# Executing in batches of 100 to avoid timeouts
batch_size = 100
for i in range(0, len(cypher_statements), batch_size):
    execute_cypher(cypher_statements[i:i+batch_size])
print("Neo4j database loaded successfully.")

# Generating 500 detailed students in PostgreSQL
print("Generating 500 detailed student records...")
first_names = ['Juan', 'Maria', 'Jose', 'Ana', 'Luis', 'Carlos', 'Laura', 'Pedro', 'Sofia', 'Miguel', 'Elena', 'Jorge', 'Lucia', 'David', 'Carmen', 'Francisco', 'Isabel', 'Antonio', 'Paula', 'Manuel']
last_names = ['Gomez', 'Rodriguez', 'Gonzalez', 'Fernandez', 'Lopez', 'Diaz', 'Martinez', 'Perez', 'Garcia', 'Sanchez', 'Romero', 'Torres', 'Ruiz', 'Ramirez', 'Flores', 'Acosta', 'Benitez', 'Medina', 'Herrera', 'Castro']

uatf_inserts = []
alumnos_inserts = []

for i in range(1, 501):
    id_ra = f"RA-{10000 + i}"
    nro_dip = f"{5000000 + i}"
    fname = random.choice(first_names)
    lname1 = random.choice(last_names)
    lname2 = random.choice(last_names)
    gender = random.choice(['M', 'F'])
    bdate = f"{random.randint(1995, 2005)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}"
    email = f"{fname.lower()}.{lname1.lower()}{i}@uatf.edu.bo"
    phone = f"{random.randint(60000000, 79999999)}"
    
    uatf_inserts.append(
        f"INSERT INTO public.uatf_datos (id_ra, nro_dip, paterno, materno, nombres, id_sexo, fec_nacimiento, id_loc, id_colegio, email, telefono, estado_civil, _registrado, _modificado) "
        f"VALUES ('{id_ra}', '{nro_dip}', '{lname1}', '{lname2}', '{fname}', '{gender}', '{bdate}', 1, 1, '{email}', '{phone}', 1, now(), now()) ON CONFLICT DO NOTHING;"
    )
    
    # Assign student randomly to one of the 10 programs
    prog_id = random.choice(list(subject_templates.keys()))
    alumnos_inserts.append(
        f"INSERT INTO academico.alumnos (id_alumno, id_programa, id_ra, id_grado, estado, tipo_alumno, ssu, id_mencion, nivel_acad) "
        f"VALUES ({i}, '{prog_id}', '{id_ra}', 'A', 'P', 'A', 'S', 0, 1) ON CONFLICT DO NOTHING;"
    )

print("Inserting student personal details...")
execute_sql("\n".join(uatf_inserts))
print("Inserting academic students records...")
execute_sql("\n".join(alumnos_inserts))

# Generate grades/enrollments for students concurrently (Multi-threaded agents)
print("Generating academic grades history parallelly...")

def populate_student_grades(student_id, prog_id):
    # Determine levels & subjects
    levels = subject_templates[prog_id]
    is_anual = (prog_id in ['MED', 'DER', 'ENF'])
    
    grades_sql = []
    
    # Let's simulate student progressing through terms
    # Randomly assign starting year: 2023 or 2024
    start_year = random.choice([2023, 2024])
    
    # Randomly choose current level (e.g. from 1 to max level)
    max_lvl = len(levels)
    current_lvl = random.randint(1, max_lvl)
    
    # Loop levels from 1 to current_lvl
    for lvl in range(1, current_lvl + 1):
        if is_anual:
            gestions = [start_year + lvl - 1]
            periods = [3]  # Anual period
        else:
            # Semestral: Level 1 in sem 1, Level 2 in sem 2
            year = start_year + (lvl - 1) // 2
            period = 1 if (lvl % 2 != 0) else 2
            gestions = [year]
            periods = [period]
            
        for g, p in zip(gestions, periods):
            for sub_name in levels[lvl]:
                sigla = f"{prog_id}-{lvl}{levels[lvl].index(sub_name)+1:02d}"
                mid = sigla_to_id.get(sigla, 0)
                if mid == 0:
                    continue
                
                # Grade model: high probability of passing, some failing/drops
                outcome = random.choices(['pass', 'fail', 'drop'], weights=[0.8, 0.15, 0.05])[0]
                if outcome == 'pass':
                    nota = random.randint(51, 100)
                    estado = 'A'
                elif outcome == 'fail':
                    nota = random.randint(20, 50)
                    estado = 'R'
                else:
                    nota = 0
                    estado = 'I'
                    
                grades_sql.append(
                    f"INSERT INTO academico.notas_planilla (id_gestion, id_periodo, id_alumno, id_materia, grupo, nota, ult_usuario, estado, _unique) "
                    f"VALUES ({g}, {p}, {student_id}, {mid}, 1, {nota}, 'system', '{estado}', 1) "
                    f"ON CONFLICT DO NOTHING;"
                )
    return grades_sql

# Query student program mapping to feed generator
student_list_str = run_query("SELECT id_alumno, id_programa FROM academico.alumnos;")
student_prog_map = []
if student_list_str:
    for line in student_list_str.strip().split('\n')[1:]:
        if ',' in line:
            sid, pid = line.split(',')
            try:
                student_prog_map.append((int(sid), pid.strip()))
            except ValueError:
                pass

# Parallelize the generation of grades strings
all_grades_sql = []
with ThreadPoolExecutor(max_workers=8) as executor:
    futures = [executor.submit(populate_student_grades, sid, pid) for sid, pid in student_prog_map]
    for fut in futures:
        all_grades_sql.extend(fut.result())

print(f"Generated {len(all_grades_sql)} SQL insertions for student academic history.")

if all_grades_sql:
    # Parallel insertions into PostgreSQL by splitting the list into 8 chunks
    chunk_size = (len(all_grades_sql) + 7) // 8
    chunks = [all_grades_sql[i:i+chunk_size] for i in range(0, len(all_grades_sql), chunk_size)]

    def insert_chunk(chunk_idx, sql_chunk):
        print(f"Thread {chunk_idx}: Inserting {len(sql_chunk)} rows...")
        sql_text = "\n".join(sql_chunk)
        success, err = execute_sql(sql_text)
        if not success:
            print(f"Thread {chunk_idx} failed: {err[:200]}...")
        else:
            print(f"Thread {chunk_idx}: Done.")

    print("Launching 8 parallel db insert agents...")
    with ThreadPoolExecutor(max_workers=8) as executor:
        for idx, chunk in enumerate(chunks, 1):
            executor.submit(insert_chunk, idx, chunk)
else:
    print("Warning: No academic grades were generated.")

print("Dataset generated and loaded successfully into both databases!")
