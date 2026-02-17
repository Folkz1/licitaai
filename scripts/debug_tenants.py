import psycopg2

DATABASE_URL = "postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution"

try:
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()

    # Check tenants table columns
    cur.execute("""
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'tenants' 
        ORDER BY ordinal_position
    """)
    print("=== TENANTS TABLE COLUMNS ===")
    for col in cur.fetchall():
        print(f"  {col[0]:30} {col[1]:20} nullable={col[2]}")

    # Check plans table
    cur.execute("SELECT * FROM plans LIMIT 5")
    cols = [d[0] for d in cur.description]
    print(f"\n=== PLANS TABLE ({cols}) ===")
    for row in cur.fetchall():
        print(f"  {row}")

    # Check subscriptions table
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        ORDER BY ordinal_position
    """)
    print("\n=== SUBSCRIPTIONS TABLE COLUMNS ===")
    for col in cur.fetchall():
        print(f"  {col[0]:30} {col[1]}")

    # Try a test insert into tenants
    print("\n=== TEST INSERT ===")
    try:
        cur.execute("""
            INSERT INTO tenants (nome, segmento, config) 
            VALUES ('__test_debug__', 'teste', '{}') 
            RETURNING id, nome
        """)
        result = cur.fetchone()
        print(f"  Insert OK: {result}")
        # Clean up
        cur.execute("DELETE FROM tenants WHERE nome = '__test_debug__'")
        print("  Cleanup OK")
    except Exception as e:
        print(f"  Insert FAILED: {e}")

    cur.close()
    conn.close()
except Exception as e:
    print(f"Connection error: {e}")
