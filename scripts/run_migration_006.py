#!/usr/bin/env python3
"""Script para executar a migration 006_onboarding.sql"""

import os
import sys
from pathlib import Path

# Adicionar o diretório raiz ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import psycopg2
    from dotenv import load_dotenv
except ImportError:
    print("Instalando dependências...")
    os.system(f"{sys.executable} -m pip install psycopg2-binary python-dotenv")
    import psycopg2
    from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv(Path(__file__).parent.parent / ".env.local")

# Tentar DATABASE_URL primeiro, depois STRING_CONEXAO_BANCO_DADOS
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("STRING_CONEXAO_BANCO_DADOS")

if not DATABASE_URL:
    print("❌ DATABASE_URL ou STRING_CONEXAO_BANCO_DADOS não encontrada no .env.local")
    sys.exit(1)

def run_migration():
    """Executa a migration 006_onboarding.sql"""
    
    migration_path = Path(__file__).parent.parent / "licitacao-saas" / "database" / "migrations" / "006_onboarding.sql"
    
    if not migration_path.exists():
        print(f"❌ Arquivo de migration não encontrado: {migration_path}")
        sys.exit(1)
    
    print(f"📄 Lendo migration: {migration_path}")
    
    with open(migration_path, "r", encoding="utf-8") as f:
        sql = f.read()
    
    print("🔌 Conectando ao banco de dados...")
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        
        cur = conn.cursor()
        
        print("🚀 Executando migration 006_onboarding.sql...")
        
        cur.execute(sql)
        
        conn.commit()
        
        print("✅ Migration 006 executada com sucesso!")
        
        # Verificar se a tabela foi criada
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'onboarding_sessions'
            ORDER BY ordinal_position
        """)
        
        columns = cur.fetchall()
        print("\n📋 Colunas da tabela onboarding_sessions:")
        for col, dtype in columns:
            print(f"  - {col}: {dtype}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erro ao executar migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
