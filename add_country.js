const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/artistportfolio' });
async function run() {
  try {
    await pool.query('ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS country VARCHAR(100);');
    console.log('Column country added successfully.');
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
