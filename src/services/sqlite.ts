import * as SQLite from 'expo-sqlite';

const DB_NAME = 'agroconecta.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let loteServerColumnCache: 'id_lote' | 'id_servidor' | null = null;

// ============================================
// FUNCIONES SEGURAS (CORREGIDAS)
// ============================================

async function runSafe(db: SQLite.SQLiteDatabase, sql: string, ...params: (string | number | null)[]): Promise<void> {
  try {
    await db.runAsync(sql, ...params);
  } catch (error: any) {
    // Solo ignorar errores de columna/tabla ya existente
    const msg = String(error?.message || '');
    if (
      msg.includes('duplicate column name') ||
      msg.includes('already exists') ||
      msg.includes('no such column')
    ) {
      // Ignorar estos errores comunes en migraciones
      return;
    }
    // Relanzar otros errores
    throw error;
  }
}

// ============================================
// ESQUEMA BASE
// ============================================

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
        id_productor INTEGER NOT NULL REFERENCES productor(id_productor),
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
        tipo_cultivo TEXT,
        variedad TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS PRODUCTO (
        id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        variedad TEXT,
        categoria TEXT NOT NULL,
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
    'CREATE INDEX IF NOT EXISTS idx_lote_servidor ON lote(id_lote)',
    'CREATE INDEX IF NOT EXISTS idx_lote_sync ON lote(estado_sincronizacion)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_lote_producto_rel ON LOTE_PRODUCTO(id_lote, id_producto)',
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
    'CREATE INDEX IF NOT EXISTS idx_gasto_sync ON gasto_lote(sincronizado)',
    'CREATE INDEX IF NOT EXISTS idx_produccion_sync ON produccion_lote(estado_sincronizacion)',
  ];

  for (const statement of statements) {
    await runSafe(db, statement);
  }
}

// ============================================
// MIGRACIONES SIMPLIFICADAS (SIN DROP PELIGROSO)
// ============================================

async function ensureProductoTables(db: SQLite.SQLiteDatabase): Promise<void> {
  // Verificar si PRODUCTO existe
  const existeProducto = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='PRODUCTO'"
  );
  
  if (!existeProducto || existeProducto.count === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS PRODUCTO (
        id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        variedad TEXT,
        categoria TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  
  // Verificar si LOTE_PRODUCTO existe
  const existeLoteProducto = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='LOTE_PRODUCTO'"
  );
  
  if (!existeLoteProducto || existeLoteProducto.count === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS LOTE_PRODUCTO (
        id_lote_producto INTEGER PRIMARY KEY AUTOINCREMENT,
        id_lote INTEGER,
        id_producto INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (id_lote) REFERENCES lote(id_local) ON DELETE CASCADE,
        FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto) ON DELETE CASCADE,
        UNIQUE(id_lote, id_producto)
      )
    `);
    
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_lote_producto_lote ON LOTE_PRODUCTO(id_lote);
      CREATE INDEX IF NOT EXISTS idx_lote_producto_producto ON LOTE_PRODUCTO(id_producto);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_lote_producto_rel ON LOTE_PRODUCTO(id_lote, id_producto);
    `);
  }
}

async function reconstruirTablaLoteSinForeignKeyProductor(db: SQLite.SQLiteDatabase): Promise<void> {
  const foreignKeys = await db.getAllAsync<{ table: string; from: string }>('PRAGMA foreign_key_list(lote)');
  const tieneFkProductor = foreignKeys.some((fk) => fk.table === 'productor' && fk.from === 'id_productor');

  if (!tieneFkProductor) {
    return;
  }

  const columnasLote = await db.getAllAsync<{ name: string }>('PRAGMA table_info(lote)');
  const nombres = new Set(columnasLote.map((c) => c.name));
  const expresionIdLote = nombres.has('id_lote')
    ? (nombres.has('id_servidor') ? 'COALESCE(id_lote, id_servidor)' : 'id_lote')
    : (nombres.has('id_servidor') ? 'id_servidor' : 'NULL');

  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.execAsync('ALTER TABLE lote RENAME TO lote_old_fk');

    await db.execAsync(`
      CREATE TABLE lote (
        id_local INTEGER PRIMARY KEY AUTOINCREMENT,
        id_lote INTEGER,
        id_productor INTEGER NOT NULL,
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
        tipo_cultivo TEXT,
        variedad TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await db.execAsync(`
      INSERT INTO lote (
        id_local,
        id_lote,
        id_productor,
        nombre_lote,
        ubicacion,
        superficie,
        fecha_siembra,
        fecha_cosecha_est,
        fecha_cierre_real,
        rendimiento_estimado,
        precio_venta_est,
        rendimiento_real,
        foto_siembra_url,
        foto_cosecha_url,
        estado,
        estado_sincronizacion,
        created_at,
        updated_at
      )
      SELECT
        id_local,
        ${expresionIdLote} AS id_lote,
        COALESCE(id_productor, 1) AS id_productor,
        nombre_lote,
        ubicacion,
        superficie,
        fecha_siembra,
        fecha_cosecha_est,
        fecha_cierre_real,
        rendimiento_estimado,
        precio_venta_est,
        rendimiento_real,
        foto_siembra_url,
        foto_cosecha_url,
        COALESCE(estado, 'ACTIVO') AS estado,
        COALESCE(estado_sincronizacion, 'PENDIENTE') AS estado_sincronizacion,
        COALESCE(created_at, datetime('now')) AS created_at,
        COALESCE(updated_at, datetime('now')) AS updated_at
      FROM lote_old_fk
    `);

    await db.execAsync('DROP TABLE lote_old_fk');
    await runSafe(db, 'CREATE UNIQUE INDEX IF NOT EXISTS uq_lote_id_lote ON lote(id_lote)');
    await runSafe(db, 'CREATE INDEX IF NOT EXISTS idx_lote_servidor ON lote(id_lote)');
    await runSafe(db, 'CREATE INDEX IF NOT EXISTS idx_lote_sync ON lote(estado_sincronizacion)');
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
}

async function migrarCultivosExistentes(db: SQLite.SQLiteDatabase): Promise<void> {
  // Verificar si hay datos que migrar
  const tieneTipoCultivo = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM lote WHERE tipo_cultivo IS NOT NULL AND tipo_cultivo != ''"
  );
  
  const tieneVariedad = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM lote WHERE variedad IS NOT NULL AND variedad != ''"
  );
  
  const tieneLotes = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM lote"
  );
  
  // Verificar si ya hay relaciones
  const tieneRelaciones = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM LOTE_PRODUCTO"
  );
  
  // Si no hay lotes o ya hay relaciones, no migrar
  if ((!tieneLotes || tieneLotes.count === 0) || (tieneRelaciones && tieneRelaciones.count > 0)) {
    return;
  }
  
  if ((tieneTipoCultivo && tieneTipoCultivo.count > 0) || (tieneVariedad && tieneVariedad.count > 0)) {
    await db.withTransactionAsync(async () => {
      // Insertar cultivos únicos en PRODUCTO
      await db.execAsync(`
        INSERT OR IGNORE INTO PRODUCTO (nombre, variedad, categoria)
        SELECT DISTINCT 
          COALESCE(tipo_cultivo, variedad, 'Sin cultivo'),
          'General',
          'General'
        FROM lote
        WHERE tipo_cultivo IS NOT NULL OR variedad IS NOT NULL
      `);
      
      // Crear relaciones LOTE_PRODUCTO
      await db.execAsync(`
        INSERT OR IGNORE INTO LOTE_PRODUCTO (id_lote, id_producto)
        SELECT 
          l.id_local,
          p.id_producto
        FROM lote l
        JOIN PRODUCTO p ON p.nombre = COALESCE(l.tipo_cultivo, l.variedad, 'Sin cultivo')
        WHERE l.tipo_cultivo IS NOT NULL OR l.variedad IS NOT NULL
      `);
    });
  }
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Agregar columnas faltantes a lote (si no existen)
  const columnasLote = await db.getAllAsync<{ name: string }>('PRAGMA table_info(lote)');
  const nombresColumnas = new Set(columnasLote.map(c => c.name));
  
  const columnasAAgregar = [
    { nombre: 'id_lote', tipo: 'INTEGER' },
    { nombre: 'id_productor', tipo: 'INTEGER NOT NULL DEFAULT 1' },
    { nombre: 'ubicacion', tipo: 'TEXT' },
    { nombre: 'fecha_cierre_real', tipo: 'TEXT' },
    { nombre: 'rendimiento_real', tipo: 'REAL' },
    { nombre: 'foto_siembra_url', tipo: 'TEXT' },
    { nombre: 'foto_cosecha_url', tipo: 'TEXT' },
    { nombre: 'estado', tipo: "TEXT NOT NULL DEFAULT 'ACTIVO'" },
    { nombre: 'estado_sincronizacion', tipo: "TEXT NOT NULL DEFAULT 'PENDIENTE'" },
    { nombre: 'tipo_cultivo', tipo: 'TEXT' },
    { nombre: 'variedad', tipo: 'TEXT' },
    { nombre: 'created_at', tipo: "TEXT NOT NULL DEFAULT (datetime('now'))" },
    { nombre: 'updated_at', tipo: "TEXT NOT NULL DEFAULT (datetime('now'))" },
  ];
  
  for (const col of columnasAAgregar) {
    if (!nombresColumnas.has(col.nombre)) {
      await runSafe(db, `ALTER TABLE lote ADD COLUMN ${col.nombre} ${col.tipo}`);
    }
  }
  
  // Asegurar tablas de productos
  await ensureProductoTables(db);

  // Rehacer lote si la base vieja todavía trae la FK a productor.
  await reconstruirTablaLoteSinForeignKeyProductor(db);
  
  // Migrar cultivos existentes
  await migrarCultivosExistentes(db);
  
  // Agregar columnas a gasto_lote
  const columnasGasto = await db.getAllAsync<{ name: string }>('PRAGMA table_info(gasto_lote)');
  const nombresGasto = new Set(columnasGasto.map(c => c.name));
  
  const columnasGastoAAgregar = [
    { nombre: 'id_gasto', tipo: 'INTEGER' },
    { nombre: 'id_lote_local', tipo: 'INTEGER' },
    { nombre: 'id_lote_servidor', tipo: 'INTEGER' },
    { nombre: 'id_lote', tipo: 'INTEGER' },
    { nombre: 'tipo_costo', tipo: "TEXT NOT NULL DEFAULT 'VARIABLE'" },
    { nombre: 'modalidad_pago', tipo: "TEXT NOT NULL DEFAULT 'NA'" },
    { nombre: 'fecha_gasto', tipo: 'TEXT' },
    { nombre: 'sincronizado', tipo: 'INTEGER NOT NULL DEFAULT 0' },
    { nombre: 'ultimo_error', tipo: 'TEXT' },
    { nombre: 'created_at', tipo: "TEXT NOT NULL DEFAULT (datetime('now'))" },
    { nombre: 'updated_at', tipo: "TEXT NOT NULL DEFAULT (datetime('now'))" },
  ];
  
  for (const col of columnasGastoAAgregar) {
    if (!nombresGasto.has(col.nombre)) {
      await runSafe(db, `ALTER TABLE gasto_lote ADD COLUMN ${col.nombre} ${col.tipo}`);
    }
  }
  
  // Actualizar fechas_gasto nulas
  await runSafe(db, "UPDATE gasto_lote SET fecha_gasto = datetime('now') WHERE fecha_gasto IS NULL OR fecha_gasto = ''");
  
  // Agregar columnas a produccion_lote
  const columnasProduccion = await db.getAllAsync<{ name: string }>('PRAGMA table_info(produccion_lote)');
  const nombresProduccion = new Set(columnasProduccion.map(c => c.name));
  
  const columnasProduccionAAgregar = [
    { nombre: 'id_produccion', tipo: 'INTEGER' },
    { nombre: 'id_lote_local', tipo: 'INTEGER' },
    { nombre: 'id_lote', tipo: 'INTEGER' },
    { nombre: 'estado_sincronizacion', tipo: "TEXT NOT NULL DEFAULT 'PENDIENTE'" },
    { nombre: 'created_at', tipo: "TEXT NOT NULL DEFAULT (datetime('now'))" },
    { nombre: 'updated_at', tipo: "TEXT NOT NULL DEFAULT (datetime('now'))" },
  ];
  
  for (const col of columnasProduccionAAgregar) {
    if (!nombresProduccion.has(col.nombre)) {
      await runSafe(db, `ALTER TABLE produccion_lote ADD COLUMN ${col.nombre} ${col.tipo}`);
    }
  }
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

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
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        await createBaseSchema(db);
        await runMigrations(db);
        return db;
      } catch (error) {
        dbPromise = null;
        throw error;
      }
    })();
  }

  return dbPromise;
}

// ============================================
// FUNCIONES PARA MANEJO DE PRODUCTOS
// ============================================

export function dividirCultivosSeleccionados(valor: string): string[] {
  const vistos = new Set<string>();
  const cultivos: string[] = [];

  for (const parte of String(valor ?? '').split(',')) {
    const cultivo = parte.trim();
    if (!cultivo) continue;

    const llave = cultivo.toLowerCase();
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    cultivos.push(cultivo);
  }

  return cultivos;
}

// Función CORREGIDA - sin error de sintaxis SQL
export async function obtenerOInsertarProductoLocal(
  db: SQLite.SQLiteDatabase,
  nombre: string,
  variedad = 'General',
  categoria = 'General'
): Promise<number> {
  const nombreNormalizado = nombre.trim();
  if (!nombreNormalizado) {
    throw new Error('El nombre del producto no puede estar vacio.');
  }

  // Buscar producto existente (CORREGIDO)
  const existente = await db.getFirstAsync<{ id_producto: number }>(
    `
      SELECT id_producto
      FROM PRODUCTO
      WHERE lower(nombre) = lower(?)
        AND lower(COALESCE(variedad, '')) = lower(?)
      LIMIT 1
    `,
    nombreNormalizado,
    variedad || ''
  );

  if (existente?.id_producto) {
    return Number(existente.id_producto);
  }

  // Insertar nuevo producto
  const result = await db.runAsync(
    'INSERT INTO PRODUCTO (nombre, variedad, categoria) VALUES (?, ?, ?)',
    nombreNormalizado,
    variedad || 'General',
    categoria || 'General'
  );

  return Number(result.lastInsertRowId);
}

export async function vincularLoteConCultivosLocal(
  db: SQLite.SQLiteDatabase,
  idLote: number,
  cultivos: string[]
): Promise<void> {
  for (const cultivo of cultivos) {
    let idProducto = await obtenerOInsertarProductoLocal(db, cultivo);
    
    // Verificar si la relación ya existe
    const existe = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM LOTE_PRODUCTO WHERE id_lote = ? AND id_producto = ?',
      idLote,
      idProducto
    );
    
    if (!existe || existe.count === 0) {
      await db.runAsync(
        'INSERT INTO LOTE_PRODUCTO (id_lote, id_producto) VALUES (?, ?)',
        idLote,
        idProducto
      );
    }
  }
}

export async function obtenerProductosDeLote(
  db: SQLite.SQLiteDatabase,
  idLote: number
): Promise<{ id_producto: number; nombre: string; variedad: string; categoria: string }[]> {
  const productos = await db.getAllAsync<{ id_producto: number; nombre: string; variedad: string; categoria: string }>(
    `
      SELECT p.id_producto, p.nombre, p.variedad, p.categoria
      FROM PRODUCTO p
      JOIN LOTE_PRODUCTO lp ON p.id_producto = lp.id_producto
      WHERE lp.id_lote = ?
      ORDER BY p.nombre
    `,
    idLote
  );
  
  return productos;
}

// ============================================
// FUNCIÓN DE VERIFICACIÓN
// ============================================

export async function verificarEstadoBaseDatos(): Promise<{
  tieneTablaProducto: boolean;
  tieneTablaLoteProducto: boolean;
  totalProductos: number;
  totalRelaciones: number;
  lotesConMultiplesCultivos: number;
}> {
  const db = await getDb();
  
  const existeProducto = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='PRODUCTO'"
  );
  
  const existeLoteProducto = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='LOTE_PRODUCTO'"
  );
  
  const totalProductos = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM PRODUCTO'
  );
  
  const totalRelaciones = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM LOTE_PRODUCTO'
  );
  
  const lotesMultiples = await db.getFirstAsync<{ count: number }>(
    `
      SELECT COUNT(*) as count
      FROM (
        SELECT id_lote, COUNT(*) as total
        FROM LOTE_PRODUCTO
        GROUP BY id_lote
        HAVING COUNT(*) > 1
      )
    `
  );
  
  return {
    tieneTablaProducto: existeProducto?.count === 1,
    tieneTablaLoteProducto: existeLoteProducto?.count === 1,
    totalProductos: totalProductos?.count || 0,
    totalRelaciones: totalRelaciones?.count || 0,
    lotesConMultiplesCultivos: lotesMultiples?.count || 0,
  };
}

// ============================================
// FUNCIONES DE RESPALDO (OPCIONALES)
// ============================================

export async function limpiarProductosSinRelacion(): Promise<number> {
  const db = await getDb();
  
  // Verificar si las tablas existen
  const existeProducto = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='PRODUCTO'"
  );
  const existeLoteProducto = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='LOTE_PRODUCTO'"
  );
  
  if (!existeProducto || !existeLoteProducto) {
    return 0;
  }
  
  const result = await db.runAsync(
    `
      DELETE FROM PRODUCTO
      WHERE id_producto NOT IN (
        SELECT DISTINCT id_producto
        FROM LOTE_PRODUCTO
        WHERE id_producto IS NOT NULL
      )
      AND id_producto NOT IN (
        SELECT DISTINCT id_producto FROM (
          SELECT lp.id_producto
          FROM LOTE_PRODUCTO lp
          WHERE lp.id_producto IS NOT NULL
        )
      )
    `
  );
  
  return result.changes || 0;
}