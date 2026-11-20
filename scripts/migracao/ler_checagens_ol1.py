#!/usr/bin/env python3
"""
Lê a indicação da Checagem Virtual 3D no PDF do planejamento (v2_works do Ortholab 1)
para os casos que estão "Aguardando aprovação" no Ortholab 2 e grava em Case.checagem.

- Só LÊ o Ortholab 1 (MySQL da cópia + bucket S3); nada é alterado lá.
- Idempotente: se o caso já tem leitura do mesmo arquivo, pula.
- Mesma regra de leitura do backend (packages/backend/src/modules/checagem/checagem.ts).
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

import psycopg2
import pymysql

BUCKET_NOVO = "s3://ortholab2-arquivos-ea/ortholab1-arquivos/uploads/v2_work/file"
BUCKET_ANTIGO = "s3://ortholab/uploads/v2_work/file"
STATUS = tuple((os.environ.get("CHECAGEM_STATUS") or "WAITING_APPROVAL").split(","))

SUP = re.compile(r"Arcada\s+Superior\)?\s*:?\s*(\d{1,3})\s*(?:-|–|a|até)\s*(\d{1,3})\s*s[ée]ries", re.I)
INF = re.compile(r"Arcada\s+Inferior\)?\s*:?\s*(\d{1,3})\s*(?:-|–|a|até)\s*(\d{1,3})\s*s[ée]ries", re.I)
# variante sem arcada: "Estimativa aproximada de movimentação: 11 - 15 séries" (vale para o caso todo)
GERAL = re.compile(r"movimenta[çc][ãa]o\s*:\s*(\d{1,3})\s*(?:-|–|a|até)\s*(\d{1,3})\s*s[ée]ries", re.I)
VERSAO_LEITURA = 2
PROD = re.compile(r"produ[çc][ãa]o\s+de\s+(.{0,120}?)\s+para\s+esta\s+fase", re.I)
FS = re.compile(r"(\d{1,3})\s*s[ée]ries?\s+superiores?", re.I)
FI = re.compile(r"(\d{1,3})\s*s[ée]ries?\s+inferiores?", re.I)


def log(m):
    print(f"[{datetime.now():%H:%M:%S}] {m}", flush=True)


def interpretar(texto):
    t = re.sub(r"\s+", " ", texto)
    out = {}
    if (m := SUP.search(t)):
        out["estimativaSuperior"] = {"min": int(m[1]), "max": int(m[2])}
    if (m := INF.search(t)):
        out["estimativaInferior"] = {"min": int(m[1]), "max": int(m[2])}
    if "estimativaSuperior" not in out and "estimativaInferior" not in out and (m := GERAL.search(t)):
        out["estimativaGeral"] = {"min": int(m[1]), "max": int(m[2])}
    p = PROD.search(t)
    trecho = p[1] if p else t
    if (m := FS.search(trecho)):
        out["seriesFaseSuperior"] = int(m[1])
    if (m := FI.search(trecho)):
        out["seriesFaseInferior"] = int(m[1])
    return out or None


def ler_pdf(caminho):
    txt = subprocess.run(["pdftotext", "-layout", caminho, "-"], capture_output=True, text=True).stdout
    paginas = txt.split("\f")
    while paginas and not paginas[-1].strip():
        paginas.pop()
    n = len(paginas)
    ordem = [i for i in [n - 2, n - 1] + list(range(n - 3, -1, -1)) if 0 <= i < n]
    for i in ordem:
        r = interpretar(paginas[i])
        if r:
            r["pagina"] = i + 1
            return r
    return None


def baixar(work_id, nome, destino):
    for base in (BUCKET_NOVO, BUCKET_ANTIGO):
        r = subprocess.run(["aws", "s3", "cp", f"{base}/{work_id}/{nome}", destino, "--only-show-errors"],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return True
    return False


def main():
    my = pymysql.connect(host=os.environ.get("MYSQL_HOST", "127.0.0.1"), port=int(os.environ.get("MYSQL_PORT", "3307")),
                         user=os.environ.get("MYSQL_USER", "root"), password=os.environ.get("MYSQL_PASSWORD", ""),
                         database=os.environ.get("MYSQL_DB", "ol1"), charset="utf8", cursorclass=pymysql.cursors.DictCursor)
    pg = psycopg2.connect(os.environ["PG_DSN"])
    p = pg.cursor()
    p.execute('''SELECT c.id, c."legacyId", pt."legacyId", c.checagem
                 FROM "Case" c JOIN "Patient" pt ON pt.id = c."patientId"
                 WHERE c.status::text IN %s AND pt."legacyId" IS NOT NULL''', (STATUS,))
    casos = p.fetchall()
    log(f"Casos para ler checagem: {len(casos)}")
    m = my.cursor()
    lidos = pulados = sem_pdf = sem_dado = 0
    for case_id, order_id, patient_legacy, atual in casos:
        m.execute("SELECT id, file FROM v2_works WHERE patient_id=%s AND LOWER(file) LIKE '%%.pdf' ORDER BY id DESC LIMIT 1",
                  (patient_legacy,))
        w = m.fetchone()
        if not w:
            sem_pdf += 1
            continue
        chave = f"ol1-v2work-{w['id']}"
        if atual and atual.get("arquivoId") == chave and atual.get("versao") == VERSAO_LEITURA:
            pulados += 1
            continue
        with tempfile.TemporaryDirectory() as d:
            arq = os.path.join(d, "p.pdf")
            if not baixar(w["id"], w["file"], arq):
                sem_pdf += 1
                continue
            r = ler_pdf(arq)
        if not r:
            sem_dado += 1
            r = {}
        r.update({"arquivo": w["file"], "arquivoId": chave, "versao": VERSAO_LEITURA,
                  "lidoEm": datetime.now(timezone.utc).isoformat()})
        p.execute('UPDATE "Case" SET checagem = %s::jsonb WHERE id = %s', (json.dumps(r), case_id))
        pg.commit()
        lidos += 1
        if lidos % 10 == 0:
            log(f"... {lidos} lidos")
    log(f"Checagens: lidas {lidos}, já estavam lidas {pulados}, sem PDF {sem_pdf}, PDF sem o bloco {sem_dado}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"ERRO: {e}")
        sys.exit(1)
