const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/artistportfolio' });
async function run() {
  try {
    await pool.query("INSERT INTO contact_messages (sender_name, sender_email, country, subject, message, ip_address) VALUES ('John Doe', 'john.doe@example.com', 'Canada', 'Greetings from Canada!', 'This is a test message to see how the country field looks in the admin panel.', '192.168.1.100')");
    console.log('Record inserted successfully.');
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
