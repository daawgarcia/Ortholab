"""Sincronização só do que mudou.

Cada linha que a importação gravaria ganha uma "impressão digital" (hash do conteúdo).
Se a impressão é igual à da última sincronização, a linha não é regravada no Ortholab 2.
Uma vez por dia (03h de Brasília) ou com SYNC_COMPLETO=1 grava tudo de novo, como rede de segurança.
"""
import hashlib
import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import psycopg2.extras


def sincronizacao_completa():
    if os.environ.get("SYNC_COMPLETO") == "1":
        return True
    return datetime.now(ZoneInfo("America/Sao_Paulo")).hour == 3


def _impressao(row, ignorar, agora):
    base = {k: v for k, v in row.items() if k not in ignorar and not (agora is not None and v == agora)}
    return hashlib.md5(json.dumps(base, sort_keys=True, default=str).encode()).hexdigest()[:20]


def filtrar(p, tabela, rows, chave, ignorar=("id",), agora=None):
    """Devolve (linhas que mudaram, impressões novas para gravar depois)."""
    novas = []
    for r in rows:
        novas.append((tabela, str(r[chave]), _impressao(r, ignorar, agora)))
    if sincronizacao_completa():
        return list(rows), novas
    p.execute('SELECT chave, hash FROM "SyncHash" WHERE tabela = %s', (tabela,))
    anteriores = dict(p.fetchall())
    mudou, imp = [], []
    for r, n in zip(rows, novas):
        if anteriores.get(n[1]) != n[2]:
            mudou.append(r)
            imp.append(n)
    return mudou, imp


def gravar(p, impressoes):
    """Grava as impressões na mesma transação da importação (só valem se ela for confirmada)."""
    for i in range(0, len(impressoes), 5000):
        psycopg2.extras.execute_values(
            p,
            'INSERT INTO "SyncHash" (tabela, chave, hash) VALUES %s '
            'ON CONFLICT (tabela, chave) DO UPDATE SET hash = EXCLUDED.hash',
            impressoes[i:i + 5000], page_size=5000,
        )
