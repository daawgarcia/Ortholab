"""Diagnóstico (só leitura) da cópia do Ortholab 1: como o financeiro marca casos a faturar."""
import pymysql

m = pymysql.connect(host="127.0.0.1", port=3307, user="root", database="ol1",
                    cursorclass=pymysql.cursors.DictCursor).cursor()


def q(sql):
    m.execute(sql)
    return m.fetchall()


tabelas = [list(r.values())[0] for r in q("SHOW TABLES")]
print("TABELAS:", " ".join(tabelas))
for t in tabelas:
    cols = [c["Field"] for c in q(f"SHOW COLUMNS FROM `{t}`")]
    alvo = [c for c in cols if any(k in c.lower() for k in
            ("financ", "bill", "invoice", "fatur", "nf", "paid", "payment", "pagament", "protheus", "charge"))]
    if alvo or any(k in t.lower() for k in ("financ", "bill", "invoice", "payment", "protheus", "charge")):
        print(f"\n== {t}: {', '.join(cols)}")
for t in tabelas:
    if any(k in t.lower() for k in ("financ", "bill", "invoice", "payment", "charge")):
        print(f"\n-- {t} amostra / contagem")
        print(q(f"SELECT COUNT(*) n FROM `{t}`"))
        for r in q(f"SELECT * FROM `{t}` ORDER BY id DESC LIMIT 3"):
            print({k: (str(v)[:60] if v is not None else None) for k, v in r.items()})
print("\n-- eventos de workflow (tipos)")
for r in q("SELECT name, COUNT(*) n FROM workflow_events GROUP BY name ORDER BY n DESC"):
    print(r)
