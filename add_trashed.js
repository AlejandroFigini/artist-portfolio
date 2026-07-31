const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/artistportfolio' });
async function run() {
  try {
    await pool.query('ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS is_trashed BOOLEAN DEFAULT false;');
    console.log('Column is_trashed added successfully.');
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
