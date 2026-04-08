import * as SQLite from 'expo-sqlite';

const DB_NAME = 'agroconecta.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let loteServerColumnCache: 'id_lote' | 'id_servidor' | null = null;

async function runSafe(db: SQLite.SQLiteDatabase, sql: string, ...params: (string | number | null)[]): Promise<void> {
  try {
    await db.runAsync(sql, ...params);
  } catch {
    // Ignora migraciones ya aplicadas o incompatibles con versiones antiguas.
  }
}

async function createBaseSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  const statements = [
    'PRAGMA journal_mode = WAL',
    'PRAGMA foreign_keys = ON',
    `
      CREATE TABLE IF NOT EXISTS usuario (
        id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_completo TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'PRODUCTOR',
        fecha_registro TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS productor (
        id_productor INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario INTEGER NOT NULL,
        comunidad TEXT NOT NULL,
        municipio TEXT NOT NULL,
        telefono TEXT,
        FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS lote (
        id_local INTEGER PRIMARY KEY AUTOINCREMENT,
        id_lote INTEGER,
        id_productor INTEGER NOT NULL DEFAULT 1,
        tipo_cultivo TEXT NOT NULL,
        nombre_lote TEXT NOT NULL,
        ubicacion TEXT,
        superficie REAL,
        fecha_siembra TEXT NOT NULL,
        fecha_cosecha_est TEXT NOT NULL,
        fecha_cierre_real TEXT,
        rendimiento_estimado REAL,
        precio_venta_est REAL,
        rendimiento_real REAL,
        foto_siembra_url TEXT,
        foto_cosecha_url TEXT,
        estado TEXT NOT NULL DEFAULT 'ACTIVO',
        estado_sincronizacion TEXT NOT NULL DEFAULT 'PENDIENTE',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_lote_id_lote ON lote(id_lote)',
    `
      CREATE TABLE IF NOT EXISTS gasto_lote (
        id_local INTEGER PRIMARY KEY AUTOINCREMENT,
        id_gasto INTEGER,
        id_lote_local INTEGER,
        id_lote_servidor INTEGER,
        id_lote INTEGER,
        categoria TEXT NOT NULL,
        descripcion TEXT,
        cantidad REAL NOT NULL DEFAULT 1,
        costo_unitario REAL NOT NULL,
        monto_total REAL NOT NULL,
        tipo_costo TEXT NOT NULL DEFAULT 'VARIABLE',
        modalidad_pago TEXT NOT NULL DEFAULT 'NA',
        fecha_gasto TEXT NOT NULL,
        sincronizado INTEGER NOT NULL DEFAULT 0,
        ultimo_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_gasto_lote_id_gasto ON gasto_lote(id_gasto)',
    `
      CREATE TABLE IF NOT EXISTS produccion_lote (
        id_local INTEGER PRIMARY KEY AUTOINCREMENT,
        id_produccion INTEGER,
        id_lote_local INTEGER,
        id_lote INTEGER,
        fecha_registro TEXT NOT NULL,
        cantidad_obtenida REAL NOT NULL,
        precio_venta REAL NOT NULL,
        estado_sincronizacion TEXT NOT NULL DEFAULT 'PENDIENTE',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_produccion_lote_id_produccion ON produccion_lote(id_produccion)',
    'CREATE INDEX IF NOT EXISTS idx_lote_tipo_cultivo ON lote(tipo_cultivo)',
    'CREATE INDEX IF NOT EXISTS idx_lote_servidor ON lote(id_lote)',
    'CREATE INDEX IF NOT EXISTS idx_lote_sync ON lote(estado_sincronizacion)',
    'CREATE INDEX IF NOT EXISTS idx_gasto_sync ON gasto_lote(sincronizado)',
    'CREATE INDEX IF NOT EXISTS idx_produccion_sync ON produccion_lote(estado_sincronizacion)',
  ];

  for (const statement of statements) {
    await runSafe(db, statement);
  }

}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await runSafe(db, 'ALTER TABLE lote ADD COLUMN id_lote INTEGER');
  await runSafe(db, 'ALTER TABLE lote ADD COLUMN id_productor INTEGER NOT NULL DEFAULT 1');
  await runSafe(db, 'ALTER TABLE lote ADD COLUMN tipo_cultivo TEXT');
  await runSafe(db, 'ALTER TABLE lote ADD COLUMN ubicacion TEXT');
  await runSafe(db, 'ALTER TABLE lote ADD COLUMN fecha_cierre_real TEXT');
  await runSafe(db, 'ALTER TABLE lote ADD COLUMN rendimiento_real REAL');
  await runSafe(db, 'ALTER TABLE lote ADD COLUMN foto_siembra_url TEXT');
  await runSafe(db, 'ALTER TABLE lote ADD COLUMN foto_cosecha_url TEXT');
  await runSafe(db, "ALTER TABLE lote ADD COLUMN estado TEXT NOT NULL DEFAULT 'ACTIVO'");
  await runSafe(db, "ALTER TABLE lote ADD COLUMN estado_sincronizacion TEXT NOT NULL DEFAULT 'PENDIENTE'");
  await runSafe(db, "ALTER TABLE lote ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))");
  await runSafe(db, "ALTER TABLE lote ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))");

  await runSafe(db, 'UPDATE lote SET id_lote = id_servidor WHERE id_lote IS NULL AND id_servidor IS NOT NULL');
  await runSafe(
    db,
    "UPDATE lote SET foto_siembra_url = foto_siembra_uri_local WHERE (foto_siembra_url IS NULL OR foto_siembra_url = '') AND foto_siembra_uri_local IS NOT NULL"
  );

  await runSafe(
    db,
    "UPDATE lote SET tipo_cultivo = COALESCE(tipo_cultivo, variedad, 'Sin especificar') WHERE tipo_cultivo IS NULL OR TRIM(tipo_cultivo) = ''"
  );

  await runSafe(
    db,
    `
      INSERT INTO lote (
        id_local,
        id_lote,
        id_productor,
        tipo_cultivo,
        nombre_lote,
        superficie,
        fecha_siembra,
        fecha_cosecha_est,
        rendimiento_estimado,
        precio_venta_est,
        foto_siembra_url,
        estado_sincronizacion,
        created_at,
        updated_at
      )
      SELECT
        id_local,
        id_servidor,
        1,
        COALESCE(variedad, 'Sin especificar'),
        nombre_lote,
        superficie,
        fecha_siembra,
        fecha_cosecha_est,
        rendimiento_estimado,
        precio_venta_est,
        foto_siembra_uri_local,
        estado_sincronizacion,
        created_at,
        updated_at
      FROM lotes
      WHERE NOT EXISTS (SELECT 1 FROM lote WHERE lote.id_local = lotes.id_local)
    `
  );

  await runSafe(db, 'DROP TABLE IF EXISTS lotes');
  await runSafe(db, 'DROP TABLE IF EXISTS costos');
  await runSafe(db, 'DROP TABLE IF EXISTS siembras_queue');
  await runSafe(db, 'DROP TABLE IF EXISTS productos_offline');
  await runSafe(db, 'DROP TABLE IF EXISTS producto');

  // Compatibilidad con bases locales antiguas que no tienen todas las columnas offline.
  await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN id_gasto INTEGER');
  await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN id_lote_local INTEGER');
  await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN id_lote_servidor INTEGER');
  await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN id_lote INTEGER');
  await runSafe(db, "ALTER TABLE gasto_lote ADD COLUMN tipo_costo TEXT NOT NULL DEFAULT 'VARIABLE'");
  await runSafe(db, "ALTER TABLE gasto_lote ADD COLUMN modalidad_pago TEXT NOT NULL DEFAULT 'NA'");
  await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN fecha_gasto TEXT');
  await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 0');
  await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN ultimo_error TEXT');
  await runSafe(db, "ALTER TABLE gasto_lote ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))");
  await runSafe(db, "ALTER TABLE gasto_lote ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
  await runSafe(db, "UPDATE gasto_lote SET fecha_gasto = datetime('now') WHERE fecha_gasto IS NULL OR fecha_gasto = ''");

  await runSafe(db, 'ALTER TABLE produccion_lote ADD COLUMN id_produccion INTEGER');
  await runSafe(db, 'ALTER TABLE produccion_lote ADD COLUMN id_lote_local INTEGER');
  await runSafe(db, 'ALTER TABLE produccion_lote ADD COLUMN id_lote INTEGER');
  await runSafe(db, "ALTER TABLE produccion_lote ADD COLUMN estado_sincronizacion TEXT NOT NULL DEFAULT 'PENDIENTE'");
  await runSafe(db, "ALTER TABLE produccion_lote ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))");
  await runSafe(db, "ALTER TABLE produccion_lote ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))");

}

export async function getLoteServerColumn(): Promise<'id_lote' | 'id_servidor'> {
  if (loteServerColumnCache) return loteServerColumnCache;

  const db = await getDb();
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(lote)');
  const names = new Set(columns.map((c) => c.name));

  if (names.has('id_lote')) {
    loteServerColumnCache = 'id_lote';
    return loteServerColumnCache;
  }

  if (names.has('id_servidor')) {
    loteServerColumnCache = 'id_servidor';
    return loteServerColumnCache;
  }

  await runSafe(db, 'ALTER TABLE lote ADD COLUMN id_lote INTEGER');
  loteServerColumnCache = 'id_lote';
  return loteServerColumnCache;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await createBaseSchema(db);
      await runMigrations(db);
      return db;
    })();
  }

  return dbPromise;
}
