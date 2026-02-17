import psycopg2

DATABASE_URL = "postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution?sslmode=disable"

try:
    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()

    print("Fetching workflow_executions...")
    cur.execute("SELECT id, workflow_type, status, started_at, error_message FROM workflow_executions ORDER BY started_at DESC LIMIT 20")
    
    rows = cur.fetchall()
    print(f"Found {len(rows)} rows:")
    for row in rows:
        print(row)

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
