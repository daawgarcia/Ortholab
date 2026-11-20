#!/usr/bin/env python3
"""
Cadastra os serviços e a tabela de preços oficial da Esthetic Aligner no Ortholab 2.
Idempotente: só grava um preço novo quando o valor mudou (o histórico de preços fica guardado).

Parcelado = valor da PARCELA (o sistema multiplica pelo nº de parcelas).
Faixas do desconto progressivo (2º caso do mês -10%, 3º em diante -15%) com os valores
exatos da tabela comercial: groupId "<grupo>:D10" / "<grupo>:D15".
Unidade = preço por alinhador (quantidade vem do planejamento 3D), sem desconto progressivo.
EA AIR² e EA MIO ficam fora do desconto progressivo.
Checagem Virtual 3D: inclusa se aprovada em até 30 dias; depois, R$ 320.
"""
import os
import uuid

import psycopg2

SERVICOS = [
    {"name": "EA Unidade", "type": "UNIDADE", "description": "R$ 95,00 por alinhador (quantidade definida pelo planejamento 3D). Checagem Virtual 3D inclusa*",
     "prices": {"CASH": 95}},  # sem desconto progressivo
    {"name": "EA MID", "type": "MID", "description": "Até 40 alinhadores • Refinamento de até 6 alinhadores por arcada • Checagem Virtual 3D inclusa*",
     "prices": {"CASH": 3800, "INSTALLMENT_6": 718, "INSTALLMENT_12": 384,
                "CASH:D10": 3420, "INSTALLMENT_6:D10": 646, "INSTALLMENT_12:D10": 346,
                "CASH:D15": 3230, "INSTALLMENT_6:D15": 611, "INSTALLMENT_12:D15": 327}},
    {"name": "EA FULL", "type": "FULL", "description": "Alinhadores para as etapas planejadas • Refinamento ilimitado • Guias de attachments inclusos • Checagem Virtual 3D inclusa*",
     "prices": {"CASH": 4999, "INSTALLMENT_6": 940, "INSTALLMENT_12": 498, "INSTALLMENT_21": 311,
                "CASH:D10": 4499, "INSTALLMENT_6:D10": 846, "INSTALLMENT_12:D10": 448, "INSTALLMENT_21:D10": 280,
                "CASH:D15": 4249, "INSTALLMENT_6:D15": 799, "INSTALLMENT_12:D15": 423, "INSTALLMENT_21:D15": 265}},
    {"name": "EA AIR² — 3 placas superiores + 3 inferiores", "type": "AIR", "description": "Aparelho para ronco e apneia 3D printed", "prices": {"CASH": 540}},
    {"name": "EA AIR² — 6 placas superiores + 6 inferiores", "type": "AIR", "description": "Aparelho para ronco e apneia 3D printed", "prices": {"CASH": 840}},
    {"name": "EA AIR² — 12 placas superiores + 12 inferiores", "type": "AIR", "description": "Aparelho para ronco e apneia 3D printed", "prices": {"CASH": 1240}},
    {"name": "EA MIO — Placa Miorrelaxante", "type": "OTHER", "description": "Placa miorrelaxante 3D printed (DTM)", "prices": {"CASH": 375}},
    {"name": "Checagem Virtual 3D (aprovação após 30 dias)", "type": "CHECAGEM", "description": "Cobrada quando o caso é aprovado depois de 30 dias do envio da checagem", "prices": {"CASH": 320}},
]

# serviços de exemplo do seed inicial — ficam inativos (mantidos por histórico)
DEMO = ["Alinhadores Full", "Alinhadores Express", "Refinamento", "Contencao", "Unidade"]


def main():
    pg = psycopg2.connect(os.environ["PG_DSN"])
    p = pg.cursor()
    for s in SERVICOS:
        p.execute('SELECT id FROM "Service" WHERE name = %s', (s["name"],))
        row = p.fetchone()
        if row:
            sid = row[0]
            p.execute('UPDATE "Service" SET type=%s, description=%s, active=true, "updatedAt"=now() WHERE id=%s',
                      (s["type"], s["description"], sid))
        else:
            sid = str(uuid.uuid4())
            p.execute('INSERT INTO "Service" (id, name, description, type, active, "createdAt", "updatedAt") '
                      'VALUES (%s,%s,%s,%s,true,now(),now())', (sid, s["name"], s["description"], s["type"]))
        novos = 0
        for grupo, valor in s["prices"].items():
            p.execute('SELECT price FROM "Price" WHERE "serviceId"=%s AND "groupId"=%s AND "dentistId" IS NULL '
                      'ORDER BY "validFrom" DESC LIMIT 1', (sid, grupo))
            atual = p.fetchone()
            if atual is None or float(atual[0]) != float(valor):
                p.execute('INSERT INTO "Price" (id, "serviceId", price, "groupId", "validFrom", "createdAt") '
                          'VALUES (%s,%s,%s,%s,now(),now())', (str(uuid.uuid4()), sid, valor, grupo))
                novos += 1
        # remove faixas que não existem mais na tabela (ex.: desconto progressivo da Unidade)
        p.execute('DELETE FROM "Price" WHERE "serviceId"=%s AND "dentistId" IS NULL AND NOT ("groupId" = ANY(%s))',
                  (sid, list(s["prices"].keys())))
        print(f"{s['name']}: {novos} preço(s) gravado(s), {p.rowcount} faixa(s) antiga(s) removida(s)")
    p.execute('UPDATE "Service" SET active=false WHERE name = ANY(%s)', (DEMO,))
    print(f"Serviços de exemplo desativados: {p.rowcount}")
    pg.commit()


if __name__ == "__main__":
    main()
