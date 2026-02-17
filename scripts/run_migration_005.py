import psycopg2

DATABASE_URL = "postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution"

sql = open(r"d:\projetos\licitação 2k\licitacao-saas\database\migrations\005_workflow_executions.sql", "r", encoding="utf-8").read()

try:
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    print("Migration 005 executed successfully!")
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'workflow_executions' ORDER BY ordinal_position")
    cols = [c[0] for c in cur.fetchall()]
    print(f"Columns: {cols}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
