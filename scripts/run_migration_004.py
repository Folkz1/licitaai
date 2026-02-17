import psycopg2

DATABASE_URL = "postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution"

migration_sql = open(r"d:\projetos\licitação 2k\licitacao-saas\database\migrations\004_api_keys_and_billing.sql", "r", encoding="utf-8").read()

try:
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=15, options="-c statement_timeout=30000")
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(migration_sql)
    print("Migration 004 executed successfully!")
    
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('api_keys', 'api_usage', 'api_credits', 'api_pricing')
        ORDER BY table_name
    """)
    tables = cur.fetchall()
    print(f"Tables created: {[t[0] for t in tables]}")
    
    cur.execute("SELECT endpoint_pattern, credits_per_call FROM api_pricing ORDER BY credits_per_call")
    pricing = cur.fetchall()
    print(f"Pricing: {len(pricing)} entries")
    for p in pricing:
        print(f"  {p[0]:45} => {p[1]} credits")
    
    cur.execute("SELECT COUNT(*) FROM api_credits")
    cnt = cur.fetchone()
    print(f"Credits granted to {cnt[0]} tenants")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
