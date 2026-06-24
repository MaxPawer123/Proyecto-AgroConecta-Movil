import * as SQLite from 'expo-sqlite';

const DB_NAME = '   ';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbInitError: Error | null = null;

async function runSafe(db: SQLite.SQLiteDatabase, sql: string, ...params: (string | number | null)[]): Promise<void> {
  try {
    await db.runAsync(sql, ...params);
  } catch (error: any) {
    const msg = String(error?.message || '');
    const ignorar = [
      'duplicate column name',
      'already exists',
      'no such column',
      'duplicate index',
      'duplicate table',
    ];

    if (ignorar.some((item) => msg.toLowerCase().includes(item.toLowerCase()))) {
      return;
    }

    throw error;
  }
}

async function getTableColumns(db: SQLite.SQLiteDatabase, tableName: string): Promise<Set<string>> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return new Set(columns.map((column) => column.name));
}

async function createBaseSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  const statements = [
    'PRAGMA journal_mode = WAL',
    'PRAGMA foreign_keys = ON',
    `
      CREATE TABLE IF NOT EXISTS usuario (
        id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        apellido TEXT,
        nombre_completo TEXT,
        password_hash TEXT,
        rol TEXT NOT NULL DEFAULT 'PRODUCTOR',
        estado TEXT DEFAULT 'activo',
        telefono TEXT UNIQUE,
        fecha_registro TEXT NOT NULL DEFAULT (datetime('now')),
        sincronizado INTEGER NOT NULL DEFAULT 0
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS productor (
        id_productor INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario INTEGER NOT NULL,
        credencial_hash TEXT,
        credencial TEXT,
        departamento TEXT NOT NULL,
        municipio TEXT NOT NULL,
        comunidad TEXT NOT NULL,
        telefono TEXT,
        sincronizado INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS lote (
        id_local INTEGER PRIMARY KEY AUTOINCREMENT,
        id_lote INTEGER,
        id_productor INTEGER NOT NULL,
        nombre_lote TEXT NOT NULL,
        ubicacion TEXT,
        superficie REAL,
        fecha_siembra TEXT NOT NULL,
        fecha_cosecha_est TEXT NOT NULL,
        fecha_cierre_real TEXT,
        foto_siembra_url TEXT,
        estado TEXT NOT NULL DEFAULT 'ACTIVO',
        sincronizado INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (id_productor) REFERENCES productor(id_productor) ON DELETE CASCADE
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS PRODUCTO (
        id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        rubro TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'ACTIVO',
        sincronizado INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS LOTE_PRODUCTO (
        id_lote_producto INTEGER PRIMARY KEY AUTOINCREMENT,
        id_lote INTEGER,
        id_producto INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (id_lote) REFERENCES lote(id_local) ON DELETE CASCADE,
        FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto) ON DELETE CASCADE,
        UNIQUE(id_lote, id_producto)
      )
    `,
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_lote_id_lote ON lote(id_lote)',
    'CREATE INDEX IF NOT EXISTS idx_lote_sync ON lote(sincronizado)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_lote_producto_rel ON LOTE_PRODUCTO(id_lote, id_producto)',
    `
      CREATE TABLE IF NOT EXISTS gasto_lote (
        id_local INTEGER PRIMARY KEY AUTOINCREMENT,
        id_gasto INTEGER,
        id_lote_local INTEGER,
        id_lote_servidor INTEGER,
        categoria TEXT NOT NULL,
        descripcion TEXT,
        cantidad REAL NOT NULL DEFAULT 1,
        costo_unitario REAL NOT NULL,
        monto_total REAL NOT NULL,
        tipo_costo TEXT NOT NULL DEFAULT 'VARIABLE',
        modalidad_pago TEXT NOT NULL DEFAULT 'NA',
        fecha_gasto TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'ACTIVO',
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
        estado TEXT NOT NULL DEFAULT 'ACTIVO',
        sincronizado INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_produccion_lote_id_produccion ON produccion_lote(id_produccion)',
    'CREATE INDEX IF NOT EXISTS idx_gasto_sync ON gasto_lote(sincronizado)',
    'CREATE INDEX IF NOT EXISTS idx_produccion_sync ON produccion_lote(sincronizado)',
    `
      CREATE TABLE IF NOT EXISTS auth_sesion (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        id_usuario INTEGER,
        activa INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
  ];

  for (const statement of statements) {
    await runSafe(db, statement);
  }
}

async function asegurarColumnasGastoLote(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await getTableColumns(db, 'gasto_lote');

  if (!columns.has('id_lote_local')) {
    await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN id_lote_local INTEGER');
  }

  if (!columns.has('id_lote_servidor')) {
    await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN id_lote_servidor INTEGER');
  }

  if (!columns.has('id_gasto')) {
    await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN id_gasto INTEGER');
  }

  if (!columns.has('sincronizado')) {
    await runSafe(db, 'ALTER TABLE gasto_lote ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 0');
  }

  if (!columns.has('estado')) {
    await runSafe(db, "ALTER TABLE gasto_lote ADD COLUMN estado TEXT NOT NULL DEFAULT 'ACTIVO'");
  }
}

async function asegurarColumnasProduccionLote(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await getTableColumns(db, 'produccion_lote');

  if (!columns.has('sincronizado')) {
    await runSafe(db, 'ALTER TABLE produccion_lote ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 0');
  }

  if (!columns.has('estado')) {
    await runSafe(db, "ALTER TABLE produccion_lote ADD COLUMN estado TEXT NOT NULL DEFAULT 'ACTIVO'");
  }
}

async function asegurarColumnasProducto(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await getTableColumns(db, 'PRODUCTO');

  // Si no tiene la columna 'rubro', la agregamos
  if (!columns.has('rubro')) {
    await runSafe(db, "ALTER TABLE PRODUCTO ADD COLUMN rubro TEXT NOT NULL DEFAULT ''");
  }

  // Refrescar las columnas después de la posible adición
  const currentColumns = await getTableColumns(db, 'PRODUCTO');

  // Si existen ambas columnas, migramos los datos de 'categoria' a 'rubro' y eliminamos 'categoria'
  if (currentColumns.has('categoria') && currentColumns.has('rubro')) {
    await runSafe(db, "UPDATE PRODUCTO SET rubro = categoria WHERE rubro = '' OR rubro IS NULL");
    await runSafe(db, "ALTER TABLE PRODUCTO DROP COLUMN categoria");
  }

  if (!currentColumns.has('sincronizado')) {
    await runSafe(db, "ALTER TABLE PRODUCTO ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 1");
  }

  if (!currentColumns.has('estado')) {
    await runSafe(db, "ALTER TABLE PRODUCTO ADD COLUMN estado TEXT NOT NULL DEFAULT 'ACTIVO'");
  }
}

async function aplicarMigraciones(db: SQLite.SQLiteDatabase): Promise<void> {
  await asegurarColumnasGastoLote(db);
  await asegurarColumnasProduccionLote(db);
  await asegurarColumnasProducto(db);
}

export async function resetDatabase(): Promise<void> {
  try {
    if (dbPromise) {
      const db = await dbPromise.catch(() => null);
      if (db) {
        await db.closeAsync().catch(() => {});
      }
      dbPromise = null;
    }

    await SQLite.deleteDatabaseAsync(DB_NAME);
    dbInitError = null;
    console.log('Base de datos eliminada correctamente');
  } catch (error) {
    console.error('Error al eliminar BD:', error);
    throw error;
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInitError) {
    dbPromise = null;
    dbInitError = null;
    await resetDatabase().catch(() => {});
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        await db.execAsync('SELECT 1');
        await createBaseSchema(db);
        await aplicarMigraciones(db);
        return db;
      } catch (error: any) {
        console.error('Error al inicializar BD:', error);
        dbPromise = null;
        dbInitError = error;

        if (
          error?.message?.includes('NullPointer') ||
          error?.message?.includes('prepareAsync') ||
          error?.message?.includes('corrupt')
        ) {
          await resetDatabase();

          try {
            const db = await SQLite.openDatabaseAsync(DB_NAME);
            await db.execAsync('SELECT 1');
            await createBaseSchema(db);
            await aplicarMigraciones(db);
            dbInitError = null;
            return db;
          } catch (retryError) {
            dbPromise = null;
            throw retryError;
          }
        }

        throw error;
      }
    })();
  }

  return dbPromise;
}
