#!/usr/bin/env python3
"""
Importação Ortholab 1 -> Ortholab 2, fase 2 (depois de importar_ol1.py):
fotos, fotos privadas, modelos STL, arquivos de trabalho (PDF do planejamento),
fichas de planejamento / finalização / novos produtos, prontuário clínico e histórico do workflow.

Idempotente (upsert por legacyKey) — é a mesma rotina usada na sincronização de hora em hora.
Os arquivos ficam no bucket novo em ortholab1-arquivos/uploads/... (mesmo caminho do Carrierwave).
"""
import json
import os
import re
import sys
import uuid
from datetime import date, datetime, time, timezone
from urllib.parse import quote
from zoneinfo import ZoneInfo

import psycopg2
import psycopg2.extras
import pymysql

SP = ZoneInfo("America/Sao_Paulo")
BASE_URL = "https://ortholab2-arquivos-ea.s3.sa-east-1.amazonaws.com/ortholab1-arquivos/uploads/"
now = datetime.now(timezone.utc).replace(tzinfo=None)

# etapas do workflow do Ortholab 2 (workflow.routes.ts)
STAGE = {
    "receipt_of_models": (1, "Recebimento dos modelos"),
    "preparing_models": (2, "Preparo dos modelos"),
    "movement": (3, "Movimento"),
    "not_approved_by_responsible_for_lab": (3, "Não aprovado pelo responsável do laboratório"),
    "approval_setup_sent": (4, "Status de aprovação enviado"),
    "change_requests": (4, "Solicitação de alteração do dentista"),
    "approved_case_for_production": (5, "Caso aprovado para produção"),
    "printing_3d": (7, "Impressão 3D"),
    "confection": (8, "Recorte acabamento"),
    "aligners_shipping": (9, "Postagem dos alinhadores"),
}


def log(m):
    print(f"[{datetime.now():%H:%M:%S}] {m}", flush=True)


def utc(v):
    if isinstance(v, datetime):
        return (v if v.tzinfo else v.replace(tzinfo=SP)).astimezone(timezone.utc).replace(tzinfo=None)
    if isinstance(v, date):
        return utc(datetime.combine(v, time(12, 0)))
    return v


def clean(s):
    if s is None:
        return None
    s = str(s).strip()
    return s or None


def url(path):
    return BASE_URL + quote(path)


def main():
    my = pymysql.connect(host=os.environ.get("MYSQL_HOST", "127.0.0.1"), port=int(os.environ.get("MYSQL_PORT", "3307")),
                         user=os.environ.get("MYSQL_USER", "root"), password=os.environ.get("MYSQL_PASSWORD", ""),
                         database=os.environ.get("MYSQL_DB", "ol1"), charset="utf8",
                         cursorclass=pymysql.cursors.SSDictCursor, autocommit=True)
    pg = psycopg2.connect(os.environ["PG_DSN"])
    p = pg.cursor()

    def q(sql):
        c = my.cursor()
        c.execute(sql)
        for r in c:
            yield r
        c.close()

    # pacientes anonimizados (LGPD) ficam de fora: fotos e arquivos não são reimportados
    p.execute('SELECT "legacyId", id, "dentistId" FROM "Patient" WHERE "legacyId" IS NOT NULL '
              "AND name NOT LIKE 'Paciente anonimizado %%'")
    pat = {r[0]: (r[1], r[2]) for r in p.fetchall()}
    p.execute('SELECT "legacyId", id FROM "Case" WHERE "legacyId" IS NOT NULL')
    case_by_order = dict(p.fetchall())
    p.execute('SELECT "legacyUserId", id FROM "User" WHERE "legacyUserId" IS NOT NULL')
    user_by_legacy = dict(p.fetchall())
    p.execute('SELECT "legacyDentistId", id FROM "User" WHERE "legacyDentistId" IS NOT NULL')
    dent_by_legacy = dict(p.fetchall())

    def upsert(table, rows, casts=None):
        if not rows:
            return 0
        casts = casts or {}
        cols = list(rows[0].keys())
        upd = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in ("id", "legacyKey"))
        tmpl = "(" + ", ".join(f"%({c})s{casts.get(c, '')}" for c in cols) + ")"
        total = 0
        for i in range(0, len(rows), 5000):
            psycopg2.extras.execute_values(
                p, f'INSERT INTO "{table}" ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES %s '
                   f'ON CONFLICT ("legacyKey") DO UPDATE SET {upd}',
                rows[i:i + 5000], template=tmpl, page_size=5000)
            total += len(rows[i:i + 5000])
        pg.commit()
        return total

    # ------------------------------------------------------------ fotos
    rows = []
    for r in q("SELECT id, image, patient_id, NULL AS created_at FROM photos WHERE image IS NOT NULL"):
        pt = pat.get(r["patient_id"])
        if pt:
            rows.append({"id": str(uuid.uuid4()), "legacyKey": f"ol1-photo-{r['id']}", "patientId": pt[0],
                         "url": url(f"photo/image/{r['id']}/{r['image']}"), "filename": r["image"],
                         "isPrivate": False, "createdAt": now})
    for r in q("SELECT id, image, patient_id, created_at FROM private_photos WHERE image IS NOT NULL"):
        pt = pat.get(r["patient_id"])
        if pt:
            rows.append({"id": str(uuid.uuid4()), "legacyKey": f"ol1-private_photo-{r['id']}", "patientId": pt[0],
                         "url": url(f"private_photo/image/{r['id']}/{r['image']}"), "filename": r["image"],
                         "isPrivate": True, "createdAt": utc(r["created_at"]) or now})
    log(f"Fotos: {upsert('Photo', rows)}")

    # ------------------------------------------------------------ modelos STL
    rows = []
    for tabela, kind in (("stl_upper_digital_models", "upper"), ("stl_lower_digital_models", "lower")):
        pasta = "upper_digital_model" if kind == "upper" else "lower_digital_model"
        for r in q(f"SELECT id, file, patient_id, created_at FROM {tabela} WHERE file IS NOT NULL"):
            pt = pat.get(r["patient_id"])
            if pt:
                rows.append({"id": str(uuid.uuid4()), "legacyKey": f"ol1-stl-{kind}-{r['id']}", "patientId": pt[0],
                             "url": url(f"stl/{pasta}/file/{r['id']}/{r['file']}"), "filename": r["file"],
                             "kind": kind, "createdAt": utc(r["created_at"]) or now})
    log(f"Modelos STL: {upsert('DigitalModel', rows)}")

    # ------------------------------------------------------------ arquivos de trabalho (PDF do planejamento etc.)
    rows = []
    for r in q("SELECT id, file, patient_id, created_at FROM v2_works WHERE file IS NOT NULL"):
        pt = pat.get(r["patient_id"])
        if pt:
            rows.append({"id": str(uuid.uuid4()), "legacyKey": f"ol1-v2work-{r['id']}", "patientId": pt[0],
                         "url": url(f"v2_work/file/{r['id']}/{r['file']}"), "filename": r["file"],
                         "createdAt": utc(r["created_at"]) or now})
    log(f"Arquivos de trabalho: {upsert('WorkFile', rows)}")

    # ------------------------------------------------------------ fichas
    rows = []
    for r in q("SELECT * FROM plans"):
        pt = pat.get(r["patient_id"])
        if not pt:
            continue
        dados = {k: (str(v) if isinstance(v, (datetime, date)) else v) for k, v in r.items()
                 if k not in ("id", "patient_id", "created_at", "updated_at") and v not in (None, "")}
        dados["origem"] = "ortholab1"
        rows.append({"id": str(uuid.uuid4()), "legacyKey": f"ol1-plan-{r['id']}", "patientId": pt[0], "dentistId": pt[1],
                     "formData": json.dumps(dados, ensure_ascii=False),
                     "createdAt": utc(r["created_at"]) or now, "updatedAt": utc(r["updated_at"]) or now})
    log(f"Fichas de planejamento: {upsert('PlanningForm', rows, {'formData': '::jsonb'})}")

    def to_int(v):
        m = re.search(r"\d+", str(v or ""))
        return int(m.group()) if m else None

    rows = []
    for r in q("SELECT * FROM completion_forms"):
        pt = pat.get(r["patient_id"])
        if not pt:
            continue
        rows.append({"id": str(uuid.uuid4()), "legacyKey": f"ol1-completion-{r['id']}", "patientId": pt[0], "dentistId": pt[1],
                     "formData": json.dumps({"contencaoSuperior": r["contention_upper_amount"],
                                             "contencaoInferior": r["contention_lower_amount"],
                                             "origem": "ortholab1"}, ensure_ascii=False),
                     "contentionUpper": to_int(r["contention_upper_amount"]),
                     "contentionLower": to_int(r["contention_lower_amount"]),
                     "observations": clean(r["observations"]),
                     "createdAt": utc(r["created_at"]) or now, "updatedAt": utc(r["updated_at"]) or now})
    log(f"Fichas de finalização: {upsert('CompletionForm', rows, {'formData': '::jsonb'})}")

    rows = []
    for r in q("SELECT * FROM other_services_forms"):
        pt = pat.get(r["patient_id"])
        if not pt:
            continue
        rows.append({"id": str(uuid.uuid4()), "legacyKey": f"ol1-otherservices-{r['id']}", "patientId": pt[0], "dentistId": pt[1],
                     "eaGuard": bool(r["ea_guard"]), "eaSplint": bool(r["ea_splint"]), "eaMio": clean(r["ea_mio"]),
                     "eaAir": bool(r["ea_air"]), "observations": clean(r["observations"]),
                     "createdAt": utc(r["created_at"]) or now, "updatedAt": utc(r["updated_at"]) or now})
    log(f"Fichas de novos produtos: {upsert('OtherServicesForm', rows)}")

    # ------------------------------------------------------------ prontuário clínico
    avaliacoes = {r["id"]: r["name"] for r in q("SELECT id, name FROM clinical_record_evaluations")}
    atividades = {str(r["id"]): r["name"] for r in q("SELECT id, name FROM clinical_record_activities")}
    rows = []
    for r in q("SELECT * FROM clinical_record_clinical_records"):
        pt = pat.get(r["patient_id"])
        if not pt:
            continue
        brutas = re.findall(r"\d+", r["activities"] or "")
        acts = [atividades.get(a, a) for a in brutas] if brutas else ([r["activities"]] if clean(r["activities"]) else [])
        rows.append({"id": str(uuid.uuid4()), "legacyKey": f"ol1-clinical-{r['id']}", "patientId": pt[0],
                     "dentistId": dent_by_legacy.get(r["dentist_id"]) or pt[1],
                     "consultationAt": utc(r["consultation_at"]) or utc(r["created_at"]) or now,
                     "evaluation": avaliacoes.get(r["evaluation_id"]) or "-",
                     "activities": acts, "observations": clean(r["observations"]),
                     "createdAt": utc(r["created_at"]) or now, "updatedAt": utc(r["updated_at"]) or now})
    log(f"Prontuário clínico: {upsert('ClinicalRecord', rows)}")

    # ------------------------------------------------------------ histórico do workflow
    rows = []
    for r in q("SELECT id, order_id, user_id, name, details, created_at, "
               "CONCAT(IFNULL(date_of_event, DATE(created_at)), ' ', IFNULL(TIME(created_at), '12:00:00')) AS quando "
               "FROM workflow_events"):
        cid = case_by_order.get(r["order_id"])
        if not cid:
            continue
        stage, nome = STAGE.get(r["name"], (0, r["name"] or "Evento"))
        try:
            quando = utc(datetime.strptime(str(r["quando"])[:19], "%Y-%m-%d %H:%M:%S"))
        except Exception:
            quando = utc(r["created_at"]) or now
        rows.append({"id": str(uuid.uuid4()), "legacyKey": f"ol1-event-{r['id']}", "caseId": cid, "stage": stage,
                     "stageName": nome, "performedBy": user_by_legacy.get(r["user_id"]),
                     "notes": clean(r["details"]), "createdAt": quando})
    log(f"Eventos do workflow: {upsert('WorkflowEvent', rows)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"ERRO fase 2: {e}")
        raise
