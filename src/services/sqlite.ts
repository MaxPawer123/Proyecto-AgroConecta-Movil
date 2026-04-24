import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_NAME = 'agroconecta.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let loteServerColumnCache: 'id_lote' | 'id_servidor' | null = null;
let dbInitError: Error | null = null;

// ============================================
// FUNCIONES SEGURAS
// ============================================

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
      'duplicate table'
    ];
    
    if (ignorar.some(i => msg.toLowerCase().includes(i.toLowerCase()))) {
      return;
    }
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
        nombre TEXT,
        apellido TEXT,
        nombre_completo TEXT,
        email TEXT UNIQUE,
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
        rendimiento_estimado REAL,
        precio_venta_est REAL,
        rendimiento_real REAL,
        foto_siembra_url TEXT,
        foto_cosecha_url TEXT,
        estado TEXT NOT NULL DEFAULT 'ACTIVO',
        estado_sincronizacion TEXT NOT NULL DEFAULT 'PENDIENTE',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (id_productor) REFERENCES productor(id_productor) ON DELETE CASCADE
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
    'CREATE INDEX IF NOT EXISTS idx_lote_sync ON lote(estado_sincronizacion)',
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

// ============================================
// FUNCIONES DE AUTENTICACIÓN UNIFICADAS
// ============================================

export async function getCurrentProductorId(): Promise<number> {
  try {
    // 1. Buscar con clave con @ (formato de sqlite.ts)
    let idProductor = await AsyncStorage.getItem('@id_productor');
    
    // 2. Buscar con clave sin @ (formato de useAuthLocal)
    if (!idProductor) {
      idProductor = await AsyncStorage.getItem('id_productor');
    }
    
    // 3. Si no hay, intentar obtener por id_usuario
    if (!idProductor) {
      let idUsuario = await AsyncStorage.getItem('@id_usuario');
      if (!idUsuario) {
        idUsuario = await AsyncStorage.getItem('id_usuario');
      }
      
      if (idUsuario) {
        const db = await getDb();
        const productor = await db.getFirstAsync<{ id_productor: number }>(
          'SELECT id_productor FROM productor WHERE id_usuario = ?',
          parseInt(idUsuario, 10)
        );
        
        if (productor) {
          idProductor = String(productor.id_productor);
          // Guardar en ambos formatos para consistencia
          await AsyncStorage.setItem('@id_productor', idProductor);
          await AsyncStorage.setItem('id_productor', idProductor);
        }
      }
    }
    
    if (!idProductor) {
      throw new Error('No hay usuario logueado. Debe iniciar sesión primero.');
    }
    
    return parseInt(idProductor, 10);
  } catch (error) {
    console.error('Error obteniendo productor ID:', error);
    throw new Error('No hay usuario logueado. Debe iniciar sesión primero.');
  }
}

export async function getCurrentUsuarioId(): Promise<number> {
  let idUsuario = await AsyncStorage.getItem('@id_usuario');
  if (!idUsuario) {
    idUsuario = await AsyncStorage.getItem('id_usuario');
  }
  
  if (!idUsuario) {
    throw new Error('No hay usuario logueado');
  }
  
  return parseInt(idUsuario, 10);
}

export async function isUserLoggedIn(): Promise<boolean> {
  const logged = await AsyncStorage.getItem('@isLoggedIn');
  if (logged === 'true') return true;
  
  const loggedOld = await AsyncStorage.getItem('sesion_activa');
  return loggedOld === 'true';
}

export async function guardarSesion(idUsuario: number, idProductor: number, nombre: string, email: string): Promise<void> {
  await AsyncStorage.setItem('@id_usuario', String(idUsuario));
  await AsyncStorage.setItem('id_usuario', String(idUsuario));
  await AsyncStorage.setItem('@id_productor', String(idProductor));
  await AsyncStorage.setItem('id_productor', String(idProductor));
  await AsyncStorage.setItem('@isLoggedIn', 'true');
  await AsyncStorage.setItem('sesion_activa', 'true');
  await AsyncStorage.setItem('@user_name', nombre);
  await AsyncStorage.setItem('@user_email', email);
}

export async function cerrarSesionCompleta(): Promise<void> {
  await AsyncStorage.multiRemove([
    '@id_usuario',
    'id_usuario',
    '@id_productor',
    'id_productor',
    '@isLoggedIn',
    'sesion_activa',
    '@user_name',
    '@user_email'
  ]);
  
  const db = await getDb();
  await db.runAsync('DELETE FROM auth_sesion WHERE id = 1');
}

// ============================================
// REGISTRO DE USUARIO Y PRODUCTOR
// ============================================

export async function registrarUsuarioYProductor(
  nombre: string,
  apellido: string,
  telefono: string,
  departamento: string,
  municipio: string,
  comunidad: string
): Promise<{ id_usuario: number; id_productor: number }> {
  const db = await getDb();
  const tokenLocal = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const nombreCompleto = `${nombre} ${apellido}`.trim();
  const email = `${telefono}@agro.local`;
  
  try {
    let idUsuario = 0;
    let idProductor = 0;
    
    await db.withTransactionAsync(async () => {
      // Insertar usuario
      const resultUsuario = await db.runAsync(
        `INSERT INTO usuario (nombre, apellido, nombre_completo, email, password_hash, rol, telefono, fecha_registro, sincronizado)
         VALUES (?, ?, ?, ?, ?, 'PRODUCTOR', ?, datetime('now'), 0)`,
        nombre,
        apellido,
        nombreCompleto,
        email,
        tokenLocal,
        telefono
      );
      
      idUsuario = Number(resultUsuario.lastInsertRowId);
      
      // Insertar productor
      const resultProductor = await db.runAsync(
        `INSERT INTO productor (id_usuario, credencial_hash, credencial, departamento, municipio, comunidad, telefono, sincronizado)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        idUsuario,
        tokenLocal,
        tokenLocal,
        departamento,
        municipio,
        comunidad,
        telefono
      );
      
      idProductor = Number(resultProductor.lastInsertRowId);
      
      // Guardar sesión en ambos formatos
      await guardarSesion(idUsuario, idProductor, nombreCompleto, email);
    });
    
    console.log('✅ Usuario registrado:', { idUsuario, idProductor });
    return { id_usuario: idUsuario, id_productor: idProductor };
  } catch (error) {
    console.error('Error al registrar:', error);
    throw error;
  }
}

// ============================================
// REINICIO DE BASE DE DATOS
// ============================================

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
    loteServerColumnCache = null;
    dbInitError = null;
    console.log('Base de datos eliminada correctamente');
  } catch (error) {
    console.error('Error al eliminar BD:', error);
    throw error;
  }
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

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
        
        loteServerColumnCache = 'id_lote';
        return db;
      } catch (error: any) {
        console.error('Error al inicializar BD:', error);
        dbPromise = null;
        dbInitError = error;
        
        if (error?.message?.includes('NullPointer') || 
            error?.message?.includes('prepareAsync') ||
            error?.message?.includes('corrupt')) {
          await resetDatabase();
          
          try {
            const db = await SQLite.openDatabaseAsync(DB_NAME);
            await db.execAsync('SELECT 1');
            await createBaseSchema(db);
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

// ============================================
// FUNCIÓN DE VERIFICACIÓN DE COLUMNA SERVIDOR
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

  loteServerColumnCache = 'id_lote';
  return loteServerColumnCache;
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

  const existente = await db.getFirstAsync<{ id_producto: number }>(
    `
      SELECT id_producto
      FROM PRODUCTO
      WHERE lower(nombre) = lower(?) AND lower(COALESCE(variedad, '')) = lower(?)
      LIMIT 1
    `,
    nombreNormalizado,
    variedad || ''
  );

  if (existente?.id_producto) {
    return Number(existente.id_producto);
  }

  const result = await db.runAsync(
    'INSERT INTO PRODUCTO (nombre, variedad, categoria) VALUES (?, ?, ?)',
    nombreNormalizado,
    variedad || 'General',
    categoria || 'General'
  );

  return Number(result.lastInsertRowId);
}

// ============================================
// FUNCIONES PARA LOTES
// ============================================

export type LoteInsertInput = {
  id_servidor?: number | null;
  tipo_cultivo?: string;
  id_productos?: number[];
  nombre_lote: string;
  ubicacion?: string | null;
  superficie: number | null;
  fecha_siembra: string;
  fecha_cosecha_est: string;
  rendimiento_estimado: number | null;
  precio_venta_est: number | null;
  foto_siembra_uri_local?: string | null;
  estado_sincronizacion?: 'PENDIENTE' | 'SINCRONIZADO';
};

export type LoteLocal = {
  id_local: number;
  id_servidor: number | null;
  tipo_cultivo: string;
  variedad?: string;
  cultivos_mostrados: string;
  id_productos: number[];
  nombre_lote: string;
  ubicacion: string | null;
  superficie: number | null;
  fecha_siembra: string;
  fecha_cosecha_est: string;
  rendimiento_estimado: number | null;
  precio_venta_est: number | null;
  foto_siembra_uri_local: string | null;
  estado_sincronizacion: string;
  created_at?: string;
  updated_at?: string;
};

const LOTE_SELECT_FIELDS = `
  l.id_local,
  l.id_lote,
  l.id_productor,
  l.nombre_lote,
  l.ubicacion,
  l.superficie,
  l.fecha_siembra,
  l.fecha_cosecha_est,
  l.fecha_cierre_real,
  l.rendimiento_estimado,
  l.precio_venta_est,
  l.rendimiento_real,
  l.foto_siembra_url,
  l.foto_cosecha_url,
  l.estado,
  l.estado_sincronizacion,
  l.created_at,
  l.updated_at
`;

function mapRowToLote(row: Record<string, unknown>): LoteLocal {
  const idServidorRaw = row.id_lote ?? row.id_servidor;
  const cultivosMostrados = String(row.cultivos_mostrados ?? '').trim();
  const cultivosVisuales = cultivosMostrados || 'Sin cultivo';
  const idsProductosConcat = String(row.ids_productos_concat ?? '').trim();
  
  const idProductos = idsProductosConcat
    ? idsProductosConcat
        .split(',')
        .map((item) => Number(String(item).trim()))
        .filter((id) => Number.isFinite(id) && id > 0)
    : [];
    
  return {
    id_local: Number(row.id_local),
    id_servidor: idServidorRaw === null || idServidorRaw === undefined ? null : Number(idServidorRaw),
    tipo_cultivo: cultivosVisuales,
    variedad: cultivosVisuales,
    cultivos_mostrados: cultivosVisuales,
    id_productos: idProductos,
    nombre_lote: String(row.nombre_lote ?? ''),
    ubicacion: row.ubicacion === null || row.ubicacion === undefined ? null : String(row.ubicacion),
    superficie: row.superficie === null || row.superficie === undefined ? null : Number(row.superficie),
    fecha_siembra: String(row.fecha_siembra ?? ''),
    fecha_cosecha_est: String(row.fecha_cosecha_est ?? ''),
    rendimiento_estimado: row.rendimiento_estimado === null || row.rendimiento_estimado === undefined ? null : Number(row.rendimiento_estimado),
    precio_venta_est: row.precio_venta_est === null || row.precio_venta_est === undefined ? null : Number(row.precio_venta_est),
    foto_siembra_uri_local: row.foto_siembra_url === null || row.foto_siembra_url === undefined ? null : String(row.foto_siembra_url),
    estado_sincronizacion: String(row.estado_sincronizacion ?? 'PENDIENTE'),
    created_at: row.created_at === null || row.created_at === undefined ? undefined : String(row.created_at),
    updated_at: row.updated_at === null || row.updated_at === undefined ? undefined : String(row.updated_at),
  };
}

export async function insertarLoteLocal(loteData: LoteInsertInput): Promise<number> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  const now = new Date().toISOString();
  
  const idProductorActual = await getCurrentProductorId();
  
  const idProductosDirectos = Array.isArray(loteData.id_productos)
    ? loteData.id_productos
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
    : [];

  const nombresCultivoCompat = dividirCultivosSeleccionados(loteData.tipo_cultivo ?? '');
  
  let idLoteLocalCreado = 0;

  await db.withTransactionAsync(async () => {
    const idsProductoCompat: number[] = [];

    if (idProductosDirectos.length === 0 && nombresCultivoCompat.length > 0) {
      for (const cultivo of nombresCultivoCompat) {
        const idProducto = await obtenerOInsertarProductoLocal(db, cultivo, 'General', 'General');
        idsProductoCompat.push(idProducto);
      }
    }

    const idProductos = [...new Set([...idProductosDirectos, ...idsProductoCompat])];

    const insertLote = await db.runAsync(
      `
        INSERT INTO lote (
          ${serverColumn},
          id_productor,
          nombre_lote,
          ubicacion,
          superficie,
          fecha_siembra,
          fecha_cosecha_est,
          rendimiento_estimado,
          precio_venta_est,
          foto_siembra_url,
          estado_sincronizacion,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      loteData.id_servidor ?? null,
      idProductorActual,
      loteData.nombre_lote,
      loteData.ubicacion ?? null,
      loteData.superficie ?? null,
      loteData.fecha_siembra,
      loteData.fecha_cosecha_est,
      loteData.rendimiento_estimado ?? null,
      loteData.precio_venta_est ?? null,
      loteData.foto_siembra_uri_local ?? null,
      loteData.estado_sincronizacion ?? 'PENDIENTE',
      now,
      now
    );

    idLoteLocalCreado = Number(insertLote.lastInsertRowId);

    for (const idProducto of idProductos) {
      await db.runAsync(
        'INSERT OR IGNORE INTO LOTE_PRODUCTO (id_lote, id_producto) VALUES (?, ?)',
        idLoteLocalCreado,
        idProducto
      );
    }
  });

  return idLoteLocalCreado;
}

export async function obtenerLotesLocales(): Promise<LoteLocal[]> {
  const db = await getDb();
  const idProductorActual = await getCurrentProductorId();
  
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
      SELECT
        ${LOTE_SELECT_FIELDS},
        COALESCE(GROUP_CONCAT(p.nombre, ', '), '') AS cultivos_mostrados,
        COALESCE(GROUP_CONCAT(lp.id_producto, ','), '') AS ids_productos_concat
      FROM lote l
      LEFT JOIN LOTE_PRODUCTO lp ON lp.id_lote = l.id_local
      LEFT JOIN PRODUCTO p ON p.id_producto = lp.id_producto
      WHERE l.id_productor = ?
      GROUP BY l.id_local
      ORDER BY l.id_local DESC
    `,
    idProductorActual
  );

  return rows.map(mapRowToLote);
}

export async function actualizarCultivosDeLote(
  idLoteLocal: number,
  nuevosCultivos: string[]
): Promise<void> {
  const db = await getDb();
  
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM LOTE_PRODUCTO WHERE id_lote = ?', idLoteLocal);
    
    for (const cultivo of nuevosCultivos) {
      const idProducto = await obtenerOInsertarProductoLocal(db, cultivo, 'General', 'General');
      await db.runAsync(
        'INSERT OR IGNORE INTO LOTE_PRODUCTO (id_lote, id_producto) VALUES (?, ?)',
        idLoteLocal,
        idProducto
      );
    }

    await db.runAsync(
      'UPDATE lote SET updated_at = ? WHERE id_local = ?',
      new Date().toISOString(),
      idLoteLocal
    );
  });
}

export async function eliminarLoteLocal(idLocal: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM gasto_lote WHERE id_lote_local = ? OR id_lote = ?', idLocal, idLocal);
  await db.runAsync('DELETE FROM produccion_lote WHERE id_lote_local = ? OR id_lote = ?', idLocal, idLocal);
  await db.runAsync('DELETE FROM lote WHERE id_local = ?', idLocal);
}

export async function guardarLoteLocal(datos: LoteInsertInput): Promise<number> {
  return insertarLoteLocal(datos);
}

export async function actualizarLoteLocalPorServidor(
  idServidor: number,
  cambios: Partial<Omit<LoteLocal, 'id_local'>>
): Promise<void> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  
  await db.runAsync(
    `UPDATE lote SET nombre_lote = ?, ubicacion = ?, superficie = ?, updated_at = ? WHERE ${serverColumn} = ?`,
    cambios.nombre_lote ?? null,
    cambios.ubicacion ?? null,
    cambios.superficie ?? null,
    new Date().toISOString(),
    idServidor
  );
}