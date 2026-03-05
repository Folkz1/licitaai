const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:6e0c28919d0e71a5d464@jz9bd8.easypanel.host:5000/evolution?sslmode=disable' });

const tenantId = '5d9b7245-d875-428d-9d62-3a302494753f';

async function main() {
  try {
    // Check if schedules exist
    const existing = await pool.query(
      "SELECT id FROM cron_schedules WHERE tenant_id = $1",
      [tenantId]
    );
    
    if (existing.rows.length === 0) {
      // Create Busca schedule
      await pool.query(
        `INSERT INTO cron_schedules (tenant_id, workflow, frequency, hour, minute, days_of_week, params)
         VALUES ($1, 'BUSCA_PNCP', 'DAILY', 6, 0, '{1,2,3,4,5}', $2)`,
        [tenantId, '{"force": false}']
      );
      
      // Create Analise schedule
      await pool.query(
        `INSERT INTO cron_schedules (tenant_id, workflow, frequency, hour, minute, days_of_week, params)
         VALUES ($1, 'ANALISE_EDITAIS', 'DAILY', 8, 0, '{1,2,3,4,5}', $2)`,
        [tenantId, '{"max_licitacoes": 10}']
      );
      
      console.log('Cron schedules created!');
    } else {
      console.log('Schedules already exist');
    }
    
    // Show current schedules
    const schedules = await pool.query(
      "SELECT * FROM cron_schedules WHERE tenant_id = $1",
      [tenantId]
    );
    console.log('Current schedules:', JSON.stringify(schedules.rows, null, 2));
    
  } catch (e) {
    console.log('Error:', e.message);
  }
  await pool.end();
}

main();
