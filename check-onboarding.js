import { Pool } from 'pg';
const pool = new Pool({ connectionString: 'postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution?sslmode=disable' });

async function main() {
  const user = await pool.query("SELECT id, email, tenant_id FROM users WHERE email = 'diego1@diego1.com'");
  console.log('User:', JSON.stringify(user.rows, null, 2));
  
  if (user.rows.length > 0) {
    const tenantId = user.rows[0].tenant_id;
    const session = await pool.query("SELECT * FROM onboarding_sessions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1", [tenantId]);
    console.log('\n=== Onboarding Session ===');
    console.log(JSON.stringify(session.rows, null, 2));
    
    const config = await pool.query("SELECT * FROM configuracoes_busca WHERE tenant_id = $1", [tenantId]);
    console.log('\n=== Configuracoes Busca ===');
    console.log(JSON.stringify(config.rows, null, 2));
    
    const keywords = await pool.query("SELECT * FROM palavras_chave WHERE tenant_id = $1", [tenantId]);
    console.log('\n=== Keywords ===');
    console.log(JSON.stringify(keywords.rows, null, 2));
    
    const tenant = await pool.query("SELECT id, nome, onboarding_completed, ai_config FROM tenants WHERE id = $1", [tenantId]);
    console.log('\n=== Tenant ===');
    console.log(JSON.stringify(tenant.rows, null, 2));
    
    const cron = await pool.query("SELECT * FROM cron_schedules WHERE tenant_id = $1", [tenantId]);
    console.log('\n=== Cron Schedules ===');
    console.log(JSON.stringify(cron.rows, null, 2));
  }
  
  await pool.end();
}

main();
