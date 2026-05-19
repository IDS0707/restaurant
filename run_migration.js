const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'localhost',
  port: 5433,
  database: 'youit_cafe',
  user: 'youit_user',
  password: 'youit_pass_2024',
});

async function run() {
  await client.connect();
  console.log('Connected to DB');

  // Check current state
  const colRes = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='menu_items' ORDER BY ordinal_position"
  );
  console.log('menu_items columns before:', colRes.rows.map(r => r.column_name));

  const sql = fs.readFileSync('migration_inventory.sql', 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await client.query(stmt);
      console.log('OK:', stmt.slice(0, 70));
    } catch (e) {
      console.log('SKIP:', e.message.split('\n')[0], '|', stmt.slice(0, 50));
    }
  }

  const colRes2 = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='menu_items' ORDER BY ordinal_position"
  );
  console.log('\nmenu_items columns after:', colRes2.rows.map(r => r.column_name));

  const tabRes = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('All tables:', tabRes.rows.map(r => r.table_name));

  await client.end();
  console.log('\nMigration done!');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
