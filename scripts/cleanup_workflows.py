import psycopg2

DATABASE_URL = "postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution?sslmode=disable"

try:
    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()

    print("Executing cleanup query...")
    cur.execute("""
        UPDATE workflow_executions 
        SET status = 'CANCELLED', 
            finished_at = NOW(), 
            error_message = 'Finalizado manualmente via CLI' 
        WHERE status IN ('RUNNING', 'PENDING')
    """)
    
    rows_affected = cur.rowcount
    print(f"Cleanup finished. {rows_affected} workflows were cancelled.")

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error during cleanup: {e}")
