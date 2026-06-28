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
      ssl: needsSsl(dbUrl) ? { rejectUnauthorized: false } : false,
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
]

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
    })().catch((err) => {
      // permitir reintento en la próxima request si falló la conexión inicial
      initPromise = null
      throw err
    })
  }
  return initPromise
}
