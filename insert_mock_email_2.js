const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/artistportfolio' });
async function run() {
  try {
    await pool.query("INSERT INTO contact_messages (sender_name, sender_email, country, subject, message, ip_address) VALUES ('María López', 'maria.lopez@example.com', 'Mexico', 'Consulta sobre comisiones', 'Hola, me encanta tu estilo de arte. Quisiera saber cuáles son tus precios actuales. Saludos!', '192.168.1.101')");
    console.log('Record inserted successfully.');
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
