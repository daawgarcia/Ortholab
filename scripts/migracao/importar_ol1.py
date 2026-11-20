#!/usr/bin/env python3
"""
Importador Ortholab 1 (MySQL 5.5, banco `ol1`) -> Ortholab 2 (PostgreSQL / Prisma).

Fase 1: usuários da equipe, dentistas, pacientes e casos (workflow_orders).
Pode rodar quantas vezes quiser: cada registro guarda o id antigo (legacy*) e é
atualizado em vez de duplicado. É a base da sincronização de hora em hora.

Uso (no servidor):
  PG_DSN=postgresql://ortholab:<senha>@127.0.0.1:5433/ortholab_db \
  MYSQL_HOST=127.0.0.1 MYSQL_PORT=3307 python3 importar_ol1.py
"""
import json
import os
import secrets
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone

import bcrypt
import psycopg2
import psycopg2.extras
import pymysql

PLACEHOLDER_DOMAIN = "sem-email.ortholab2.local"

# Papéis do Ortholab 1 -> Role do Ortholab 2
ROLE_MAP = {
    "admin": "ADMIN",
    "worker": "LAB_TECH",
    "worker_pt": "LAB_TECH",
    "worker_co": "LAB_TECH",
    "worker_mx": "LAB_TECH",
    "worker_pe": "LAB_TECH",
    "dentist": "DENTIST",
    "blocked": None,  # vira status INACTIVE
}

# Último evento do workflow (Ortholab 1) -> CaseStatus (Ortholab 2)
EVENT_STATUS = {
    "receipt_of_models": "SUBMITTED",
    "preparing_models": "IN_PLANNING",
    "movement": "IN_MOVEMENT",
    "not_approved_by_responsible_for_lab": "LAB_APPROVAL",
    "approval_setup_sent": "WAITING_APPROVAL",
    "change_requests": "REVISION_REQUESTED",
    "approved_case_for_production": "APPROVED",
    "printing_3d": "PRINTING_3D",
    "confection": "LABORATORY",
    "aligners_shipping": "SHIPPED",
}

now = datetime.now(timezone.utc).replace(tzinfo=None)
stats = Counter()


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def clean(s):
    if s is None:
        return None
    s = str(s).strip()
    return s or None


_UNUSABLE = None


def unusable_password():
    # Hash bcrypt válido de um segredo aleatório descartado: a conta existe, mas ninguém entra com ela.
    global _UNUSABLE
    if _UNUSABLE is None:
        _UNUSABLE = bcrypt.hashpw(secrets.token_urlsafe(32).encode(), bcrypt.gensalt(rounds=10)).decode()
    return _UNUSABLE


def main():
    my = pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
        port=int(os.environ.get("MYSQL_PORT", "3307")),
        user=os.environ.get("MYSQL_USER", "root"),
        password=os.environ.get("MYSQL_PASSWORD", ""),
        database=os.environ.get("MYSQL_DB", "ol1"),
        charset="utf8",
        cursorclass=pymysql.cursors.DictCursor,
    )
    pg = psycopg2.connect(os.environ["PG_DSN"])
    pg.autocommit = False
    m = my.cursor()
    p = pg.cursor()

    def q(sql):
        m.execute(sql)
        return m.fetchall()

    # ------------------------------------------------------------------ dados base
    roles = {r["id"]: r["name"] for r in q("SELECT id, name FROM roles")}
    user_roles = {}
    for r in q("SELECT user_id, role_id FROM roles_users"):
        user_roles.setdefault(r["user_id"], set()).add(roles.get(r["role_id"]))
    users = {u["id"]: u for u in q("SELECT * FROM users")}
    for u in users.values():
        if u.get("role_id"):
            user_roles.setdefault(u["id"], set()).add(roles.get(u["role_id"]))
    link_by_dentist = {}
    linked_users = set()
    for r in q("SELECT user_id, dentist_id FROM users_dentists ORDER BY id"):
        link_by_dentist.setdefault(r["dentist_id"], r["user_id"])
        linked_users.add(r["user_id"])
    addresses = {}
    for a in q("SELECT * FROM addresses ORDER BY id"):
        if a.get("dentist_id"):
            addresses[a["dentist_id"]] = a  # fica o mais recente
    protheus = {}
    for c in q("SELECT * FROM protheus_clientes WHERE IFNULL(excluido,0)=0 ORDER BY id"):
        protheus[c["dentist_id"]] = c

    # e-mails já usados no Ortholab 2 por quem NÃO veio do Ortholab 1 (ex.: admin do seed)
    p.execute('SELECT lower(email) FROM "User" WHERE "legacyDentistId" IS NULL AND "legacyUserId" IS NULL')
    used_emails = {r[0] for r in p.fetchall()}

    def take_email(candidate, fallback_key):
        e = (clean(candidate) or "").lower()
        if e and "@" in e and e not in used_emails:
            used_emails.add(e)
            return e
        stats["email_placeholder"] += 1
        e = f"{fallback_key}@{PLACEHOLDER_DOMAIN}"
        used_emails.add(e)
        return e

    def upsert_users(rows, key):
        cols = list(rows[0].keys())
        updates = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in ("id", key, "createdAt"))
        sql = (
            f'INSERT INTO "User" ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES %s '
            f'ON CONFLICT ("{key}") DO UPDATE SET {updates}'
        )
        tmpl = "(" + ", ".join(
            f"%({c})s::\"Role\"" if c == "role" else f"%({c})s::\"UserStatus\"" if c == "status" else f"%({c})s"
            for c in cols
        ) + ")"
        psycopg2.extras.execute_values(p, sql, rows, template=tmpl, page_size=500)

    # ------------------------------------------------------------------ dentistas
    dentists = q("SELECT * FROM dentists ORDER BY id")
    rows = []
    for d in dentists:
        uid = link_by_dentist.get(d["id"])
        u = users.get(uid) if uid else None
        rset = user_roles.get(uid, set()) if uid else set()
        blocked = "blocked" in rset
        a = addresses.get(d["id"]) or {}
        c = protheus.get(d["id"]) or {}
        street = " ".join(x for x in [clean(a.get("street")), clean(a.get("number")), clean(a.get("additional_information"))] if x)
        rows.append({
            "id": str(uuid.uuid4()),
            "legacyDentistId": d["id"],
            "legacyUserId": uid,
            # Nome igual ao que o Ortholab 1 exibe: fantasia do TOTVS -> cadastro do dentista
            # -> login (nome + sobrenome) -> razão social do TOTVS
            "name": (
                clean(c.get("fantasia"))
                or clean(d["name"])
                or " ".join(x for x in [clean((u or {}).get("name")), clean((u or {}).get("last_name"))] if x)
                or clean(c.get("nome"))
                or f"Dentista {d['id']} (sem nome no Ortholab 1)"
            ),
            "email": take_email((u or {}).get("email") or d.get("email"), f"dentista-{d['id']}"),
            "password": (u or {}).get("encrypted_password") or unusable_password(),
            "role": "DENTIST",
            "status": "ACTIVE" if (u and not blocked) else "INACTIVE",
            "cro": clean(d.get("cro")),
            "cpf": clean(d.get("cpf")),
            "phone": clean(a.get("mobile_phone")) or clean(a.get("business_phone")),
            "address": street or None,
            "city": clean(a.get("city")),
            "state": clean(a.get("state")),
            "zipCode": clean(a.get("zip")),
            "country": clean(d.get("country")) or "BR",
            "totvsCode": clean(c.get("codigo")),
            "totvsLoja": clean(c.get("loja")),
            "totvsChave": clean(c.get("chave")),
            "emailVerified": bool(u and u.get("confirmed_at")),
            "createdAt": d.get("created_at") or now,
            "updatedAt": d.get("updated_at") or now,
        })
    upsert_users(rows, "legacyDentistId")
    stats["dentistas"] = len(rows)
    stats["dentistas_com_login"] = sum(1 for r in rows if r["status"] == "ACTIVE")
    log(f"Dentistas: {len(rows)} (com login ativo: {stats['dentistas_com_login']})")

    # ------------------------------------------------------------------ equipe (usuários sem dentista)
    rows = []
    for uid, u in sorted(users.items()):
        if uid in linked_users:
            continue
        rset = user_roles.get(uid, set())
        role = next((ROLE_MAP[r] for r in ("admin", "worker", "worker_pt", "worker_co", "worker_mx", "worker_pe", "dentist") if r in rset), None)
        # Sem papel conhecido no Ortholab 1: entra como dentista INATIVO (sem acesso) até alguém revisar.
        no_role = role is None
        if no_role:
            role = "DENTIST"
            stats["usuarios_sem_papel"] += 1
        name = " ".join(x for x in [clean(u.get("name")), clean(u.get("last_name"))] if x) or (u.get("email") or f"Usuário {uid}")
        rows.append({
            "id": str(uuid.uuid4()),
            "legacyUserId": uid,
            "name": name,
            "email": take_email(u.get("email"), f"usuario-{uid}"),
            "password": u.get("encrypted_password") or unusable_password(),
            "role": role,
            "status": "INACTIVE" if ("blocked" in rset or no_role) else "ACTIVE",
            "emailVerified": bool(u.get("confirmed_at")),
            "createdAt": u.get("created_at") or now,
            "updatedAt": u.get("updated_at") or now,
        })
    if rows:
        upsert_users(rows, "legacyUserId")
    stats["equipe"] = len(rows)
    log(f"Equipe e outros usuários: {len(rows)}")
    pg.commit()

    p.execute('SELECT "legacyDentistId", id FROM "User" WHERE "legacyDentistId" IS NOT NULL')
    dentist_uuid = dict(p.fetchall())

    # ------------------------------------------------------------------ pacientes
    rows = []
    for pt in q("SELECT * FROM patients ORDER BY id"):
        did = dentist_uuid.get(pt["dentist_id"])
        if not did:
            stats["pacientes_sem_dentista"] += 1
            continue
        rows.append({
            "id": str(uuid.uuid4()),
            "legacyId": pt["id"],
            "name": clean(pt["name"]) or f"Paciente {pt['id']}",
            "gender": clean(pt.get("gender")),
            "dob": pt.get("birthday"),
            "dentistId": did,
            "active": bool(pt.get("active", 1)),
            "boxNumber": clean(pt.get("box_number")),
            "createdAt": pt.get("created_at") or now,
            "updatedAt": pt.get("updated_at") or now,
        })
    cols = list(rows[0].keys())
    updates = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in ("id", "legacyId", "createdAt"))
    psycopg2.extras.execute_values(
        p,
        f'INSERT INTO "Patient" ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES %s ON CONFLICT ("legacyId") DO UPDATE SET {updates}',
        rows, template="(" + ", ".join(f"%({c})s" for c in cols) + ")", page_size=1000,
    )
    stats["pacientes"] = len(rows)
    log(f"Pacientes: {len(rows)} (sem dentista: {stats['pacientes_sem_dentista']})")
    pg.commit()

    p.execute('SELECT "legacyId", id, "dentistId", name, dob, gender FROM "Patient" WHERE "legacyId" IS NOT NULL')
    patient_by_legacy = {r[0]: r[1:] for r in p.fetchall()}

    # ------------------------------------------------------------------ casos (workflow_orders)
    last_event = {
        r["order_id"]: r["name"]
        for r in q("SELECT e.order_id, e.name FROM workflow_events e JOIN "
                   "(SELECT order_id, MAX(id) mid FROM workflow_events GROUP BY order_id) x ON x.mid = e.id")
    }
    try:
        canceled = {r["order_id"] for r in q("SELECT order_id FROM workflow_canceled_orders")}
    except Exception:
        canceled = set()
    rows = []
    for o in q("SELECT * FROM workflow_orders ORDER BY id"):
        pt = patient_by_legacy.get(o["patient_id"])
        if not pt:
            stats["casos_sem_paciente"] += 1
            continue
        patient_id, dentist_id, pname, pdob, pgender = pt
        ev = last_event.get(o["id"])
        status = EVENT_STATUS.get(ev, "SUBMITTED")
        notes = clean(o.get("details"))
        if o["id"] in canceled:
            stats["casos_cancelados"] += 1
            notes = ("[Cancelado no Ortholab 1] " + (notes or "")).strip()
        elif status == "SHIPPED" and not o.get("in_progress"):
            status = "COMPLETED"
        stats[f"status_{status}"] += 1
        rows.append({
            "id": str(uuid.uuid4()),
            "legacyId": o["id"],
            "caseNumber": o["id"],
            "dentistId": dentist_id,
            "patientId": patient_id,
            "productType": "ALINHADORES",
            "patientName": pname,
            "patientDob": pdob,
            "gender": pgender,
            "notes": notes,
            "planningFormData": json.dumps({
                "origem": "ortholab1",
                "ultimoEventoWorkflow": ev,
                "alinhadoresSuperiores": o.get("amount_of_upper_aligners"),
                "alinhadoresInferiores": o.get("amount_of_lower_aligners"),
                "guiaAttachments": o.get("amount_of_attachments_guide"),
                "contencoes": o.get("amount_of_retainers"),
                "opcoesPack": clean(o.get("pack_billing_options")),
            }, default=str),
            "status": status,
            "billingType": clean(o.get("billing_type")),
            "installmentOption": clean(o.get("installment")),
            "dropoutInsurance": bool(o.get("has_dropout_insurance")),
            "discountCoupon": clean(o.get("discount_coupon")),
            "packActive": bool(o.get("active_pack")),
            "createdAt": o.get("created_at") or now,
            "updatedAt": o.get("updated_at") or now,
        })
    cols = list(rows[0].keys())
    updates = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in ("id", "legacyId", "createdAt"))
    tmpl = "(" + ", ".join(
        f'%({c})s::"CaseStatus"' if c == "status" else f'%({c})s::"ProductType"' if c == "productType"
        else f"%({c})s::jsonb" if c == "planningFormData" else f"%({c})s" for c in cols
    ) + ")"
    psycopg2.extras.execute_values(
        p,
        f'INSERT INTO "Case" ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES %s ON CONFLICT ("legacyId") DO UPDATE SET {updates}',
        rows, template=tmpl, page_size=1000,
    )
    # próximos casos criados no Ortholab 2 continuam a numeração do Ortholab 1
    p.execute("""SELECT setval(pg_get_serial_sequence('"Case"', 'caseNumber'), (SELECT MAX("caseNumber") FROM "Case"))""")
    stats["casos"] = len(rows)
    pg.commit()
    log(f"Casos: {len(rows)} (sem paciente: {stats['casos_sem_paciente']}, cancelados: {stats['casos_cancelados']})")

    # ------------------------------------------------------------------ entradas (igual ao Ortholab 1)
    # Mesma regra do entries_controller#pending_entries do Ortholab 1: paciente cujo último envio
    # (STL sup/inf, ficha de planejamento, ficha de finalização ou outros serviços) é >= 01/01/2026,
    # sem pedido de workflow criado depois do envio e sem pedido ativo no momento do envio.
    # Só envios a partir de 01/01/2026 importam: se o último envio do paciente é >= essa data,
    # ele está entre estes registros (equivale ao MAX + filtro do Ortholab 1, mas sem varrer tudo).
    MIN_ENVIO = "2026-01-01 00:00:00"
    ultimo = {}  # patient_id -> (data, origem)
    for tabela, origem in (("stl_upper_digital_models", "STL_FILE"), ("stl_lower_digital_models", "STL_FILE"),
                           ("plans", "PLANNING_FORM"), ("completion_forms", "COMPLETION_FORM"),
                           ("other_services_forms", "OTHER_SERVICES_FORM")):
        for r in q(f"SELECT patient_id, created_at FROM {tabela} WHERE created_at >= '{MIN_ENVIO}' AND patient_id IS NOT NULL"):
            atual = ultimo.get(r["patient_id"])
            if atual is None or r["created_at"] > atual[0]:
                ultimo[r["patient_id"]] = (r["created_at"], origem)
    pedidos = {}
    if ultimo:
        ids = ",".join(str(int(i)) for i in ultimo)
        for o in q(f"""SELECT o.id, o.patient_id, o.created_at, o.updated_at, o.in_progress,
                              (SELECT MAX(c.created_at) FROM workflow_canceled_orders c WHERE c.order_id = o.id) AS canceled_at
                       FROM workflow_orders o WHERE o.patient_id IN ({ids})"""):
            pedidos.setdefault(o["patient_id"], []).append(o)
    box = {}
    if ultimo:
        for r in q(f"SELECT id, box_number FROM patients WHERE id IN ({ids})"):
            box[r["id"]] = r["box_number"]
    pend = []
    for pid, (envio, origem) in ultimo.items():
        bloqueado = False
        for o in pedidos.get(pid, []):
            ca, ua = o["created_at"], o["updated_at"]
            if ca and ca >= envio:  # pedido criado depois do envio
                bloqueado = True
                break
            if ca and ca <= envio and (o["in_progress"] == 1 or (ua and ua > envio)
                                       or (o["canceled_at"] and o["canceled_at"] > envio)):
                bloqueado = True  # pedido ativo no momento do envio
                break
        if not bloqueado:
            pend.append({"patient_id": pid, "box_number": box.get(pid), "last_submission_at": envio, "origem": origem})
    pend.sort(key=lambda e: e["last_submission_at"])
    rows = []
    for e in pend:
        pt = patient_by_legacy.get(e["patient_id"])
        if not pt:
            continue
        rows.append({
            "id": str(uuid.uuid4()),
            "legacyKey": f"ol1-paciente-{e['patient_id']}",
            "patientId": pt[0],
            "dentistId": pt[1],
            "entryType": e["origem"] or "STL_FILE",
            "sourceType": "ortholab1",
            "boxNumber": clean(e.get("box_number")),
            "lastStlDate": e["last_submission_at"],
            "status": "PENDING",
            "createdAt": e["last_submission_at"] or now,
            "updatedAt": now,
        })
    keys = [r["legacyKey"] for r in rows]
    if rows:
        cols = list(rows[0].keys())
        updates = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in cols if c not in ("id", "legacyKey"))
        tmpl = "(" + ", ".join(
            f'%({c})s::"EntryType"' if c == "entryType" else f'%({c})s::"EntryStatus"' if c == "status"
            else f"%({c})s" for c in cols
        ) + ")"
        psycopg2.extras.execute_values(
            p,
            f'INSERT INTO "Entry" ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES %s '
            f'ON CONFLICT ("legacyKey") DO UPDATE SET {updates}',
            rows, template=tmpl, page_size=1000,
        )
    # o que saiu da lista no Ortholab 1 (virou workflow) sai da lista no Ortholab 2
    p.execute(
        """UPDATE "Entry" SET status = 'COMPLETED', "processedAt" = now(), "updatedAt" = now()
           WHERE "legacyKey" IS NOT NULL AND status = 'PENDING' AND NOT ("legacyKey" = ANY(%s))""",
        (keys,),
    )
    stats["entradas_pendentes"] = len(rows)
    stats["entradas_concluidas_agora"] = p.rowcount
    pg.commit()
    log(f"Entradas pendentes: {len(rows)}")

    log("Resumo: " + json.dumps(dict(sorted(stats.items())), ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa
        log(f"ERRO: {e}")
        raise
