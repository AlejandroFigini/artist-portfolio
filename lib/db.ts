import 'server-only'
import { Pool } from 'pg'

/* Capa de base de datos (Postgres) para las route handlers de Next.
   - Prod (Railway): DATABASE_URL público/interno → SSL automático.
   - Local: DATABASE_URL a tu Postgres local (localhost) → sin SSL.
   - Sin DATABASE_URL: modo mock (la API degrada; el front usa localStorage). */

const dbUrl = process.env.DATABASE_URL || ''
export const hasDb = !!dbUrl

// SSL: requerido para Postgres remoto (Railway público). No para hosts internos
// de Railway ni para Postgres local.
function needsSsl(url: string): boolean {
  if (!url) return false
  if (url.includes('railway.internal')) return false
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false
  return true
}

// Pool singleton. En dev, Next puede recargar el módulo (HMR) → lo guardamos en
// globalThis para no abrir un pool nuevo en cada recarga.
const g = globalThis as unknown as { _pgPool?: Pool }

export function getPool(): Pool | null {
  if (!hasDb) return null
  if (!g._pgPool) {
    g._pgPool = new Pool({
      connectionString: dbUrl,
      ssl: needsSsl(dbUrl) ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
      max: 5,
    })
  }
  return g._pgPool
}

// ----- Esquema + migraciones --------------------------------------------------

// Migraciones idempotentes: agregá entradas acá cuando cambie el esquema. Se
// aplican en orden al bootear (CREATE/ALTER ... IF (NOT) EXISTS), una sola vez,
// registradas en `_migrations`. Así la ESTRUCTURA viaja con el commit: al
// deployar, prod corre las migraciones pendientes solo. Los DATOS no migran.
const MIGRATIONS: { id: string; sql: string }[] = [
  // Ejemplo (futuro):
  // { id: '2026_07_add_alt_to_multimedia', sql: 'ALTER TABLE multimedia ADD COLUMN IF NOT EXISTS alt TEXT' },
  {
    id: '2026_07_users_sessions',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        totp_secret TEXT,
        totp_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(128) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    id: '2026_07_users_last_login',
    sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP',
  },
  {
    id: '2026_07_cms_state',
    sql: `
      CREATE TABLE IF NOT EXISTS cms_state (
        key VARCHAR(128) PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    id: '2026_07_failed_logins',
    sql: `
      CREATE TABLE IF NOT EXISTS failed_logins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(64),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    id: '2026_07_users_role',
    sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'owner'",
  },
  {
    id: '2026_07_users_needs_setup',
    sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_setup BOOLEAN DEFAULT FALSE",
  },
  {
    id: '2026_07_users_adv_mgmt',
    sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS session_ttl_minutes INTEGER",
  },
  {
    id: '2026_07_contact_messages',
    sql: `
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        sender_name VARCHAR(100) NOT NULL,
        sender_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) DEFAULT '',
        message TEXT NOT NULL,
        ip_address VARCHAR(45),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    id: '2026_07_contact_messages_additions',
    sql: `
      ALTER TABLE contact_messages
      ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_trashed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS country VARCHAR(100);
    `,
  },
  {
    /* No había ni un índice secundario en toda la base: solo las PK. Estas tres
       consultas hacían seq scan sobre tablas que crecen sin techo.
       - contact_messages: el rate limit del formulario, en CADA envío
       - failed_logins: el panel de analítica
       - sessions: revocación al cambiar contraseña + el ON DELETE CASCADE */
    id: '2026_08_indices_consultas_calientes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_contact_messages_ip_created
        ON contact_messages (ip_address, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_failed_logins_created
        ON failed_logins (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_user
        ON sessions (user_id);
    `,
  },
  {
    /* Estado de entrega de la notificación por mail de cada mensaje. Antes un
       fallo de Resend solo dejaba un console.error: el mensaje quedaba en la
       tabla y nadie se enteraba de que nunca salió.
       NULL = desconocido (filas anteriores a esta migración), TRUE = entregado,
       FALSE = falló y `email_error` dice por qué. Por eso la columna NO lleva
       DEFAULT: un default marcaría el histórico como fallido. */
    id: '2026_08_contact_messages_delivery',
    sql: `
      ALTER TABLE contact_messages
      ADD COLUMN IF NOT EXISTS email_sent BOOLEAN,
      ADD COLUMN IF NOT EXISTS email_error TEXT;
    `,
  },
  {
    /* El default 'owner' de la columna role era un footgun: cualquier INSERT
       que olvidara `role` creaba un owner. El único insert legítimo sin role
       explícito es el seed, que ahora lo setea a mano. Bajar el default a
       'demo' (least-privilege) no toca las filas existentes. */
    id: '2026_08_users_role_default_demo',
    sql: "ALTER TABLE users ALTER COLUMN role SET DEFAULT 'demo'",
  },
  {
    /* Secreto TOTP pendiente de confirmación (setup). Separado de totp_secret
       para que regenerar el QR no apague ni pise el 2FA activo hasta que el
       usuario verifique el primer código (enable). */
    id: '2026_08_users_totp_pending',
    sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_secret TEXT',
  },
  {
    /* Auto-bloqueo recurrente del usuario demo (independiente del TTL de sesión):
       - demo_lock_interval_minutes: cada cuánto se bloquea (null/0 = desactivado).
       - demo_lock_at: instante ABSOLUTO en que el auto-bloqueo se dispara
         (anclaje + intervalo). Se recalcula al setear el intervalo y al desbloquear.
       El bloqueo se materializa de forma perezosa (login + GET /api/users). */
    id: '2026_08_users_demo_autolock',
    sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_lock_interval_minutes INTEGER, ADD COLUMN IF NOT EXISTS demo_lock_at TIMESTAMP',
  },
  {
    /* Al demo nunca se le pide cambiar la contraseña: limpiar el needs_setup de
       cualquier demo ya sembrado antes de esta regla. */
    id: '2026_08_users_demo_no_setup',
    sql: "UPDATE users SET needs_setup = FALSE WHERE role = 'demo' AND needs_setup = TRUE",
  },
]

/* Seed de usuarios: corre en boot si la tabla está vacía. Credenciales
   INICIALES desde env (USER1_NAME/USER1_PASS, USER2_NAME/USER2_PASS);
   después cada usuario las cambia desde la UI y viven solo en DB. */
async function seedUsers(pool: Pool): Promise<void> {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users')
  if (rows[0].n > 0) return
  const bcrypt = (await import('bcryptjs')).default
  const seeds = [
    { name: process.env.USER1_NAME, pass: process.env.USER1_PASS },
    { name: process.env.USER2_NAME, pass: process.env.USER2_PASS },
  ]
  for (const s of seeds) {
    if (!s.name || !s.pass) continue
    await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'owner') ON CONFLICT (username) DO NOTHING",
      [s.name, await bcrypt.hash(s.pass, 12)],
    )
  }
}

async function createBaseTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cms_data (
      id SERIAL PRIMARY KEY,
      key VARCHAR(255) UNIQUE NOT NULL,
      value TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'text',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS multimedia (
      id SERIAL PRIMARY KEY,
      public_id VARCHAR(255) UNIQUE NOT NULL,
      url TEXT NOT NULL,
      format VARCHAR(10),
      type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  // Traducciones del contenido: una fila por (contenedor, idioma destino).
  // El base (es) NO vive acá — vive en cms_data. Acá solo en/pt/fr.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cms_translations (
      key VARCHAR(255) NOT NULL,
      lang VARCHAR(5) NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (key, lang)
    );
  `)
}

async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  const applied = new Set(
    (await pool.query('SELECT id FROM _migrations')).rows.map((r: { id: string }) => r.id),
  )
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue
    await pool.query(m.sql)
    await pool.query('INSERT INTO _migrations (id) VALUES ($1)', [m.id])
  }
}

// Init perezoso y memoizado: se corre una vez por proceso, en la primera request.
let initPromise: Promise<void> | null = null
export function ensureDb(): Promise<void> {
  if (!hasDb) return Promise.resolve()
  if (!initPromise) {
    const pool = getPool()!
    initPromise = (async () => {
      await createBaseTables(pool)
      await runMigrations(pool)
      await seedUsers(pool)
    })().catch((err) => {
      // permitir reintento en la próxima request si falló la conexión inicial
      initPromise = null
      throw err
    })
  }
  return initPromise
}
