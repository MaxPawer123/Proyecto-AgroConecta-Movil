import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '../../core/database/sqlite.config';

let loteServerColumnCache: 'id_lote' | 'id_servidor' | null = null;

type Db = Awaited<ReturnType<typeof getDb>>;

async function getTableColumns(db: Db, tableName: string): Promise<Set<string>> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return new Set(columns.map((column) => column.name));
}

async function deleteFromTableWithAvailableColumns(
  db: Db,
  tableName: string,
  columnCandidates: string[],
  value: number
): Promise<void> {
  const columns = await getTableColumns(db, tableName);
  const activeColumns = columnCandidates.filter((column) => columns.has(column));

  if (activeColumns.length === 0) {
    return;
  }

  await db.runAsync(
    `DELETE FROM ${tableName} WHERE ${activeColumns.map((column) => `${column} = ?`).join(' OR ')}`,
    ...activeColumns.map(() => value)
  );
}

async function getCurrentProductorId(): Promise<number> {
  try {
    let idProductor = await AsyncStorage.getItem('@id_productor');

    if (!idProductor) {
      idProductor = await AsyncStorage.getItem('id_productor');
    }

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

export function determinarCategoriaCultivo(cultivo: string): 'QUINUA' | 'PAPA' | 'HORTALIZA' | '' {
  const nombre = String(cultivo ?? '').toLowerCase().trim();
  if (nombre.includes('quinua')) return 'QUINUA';
  if (
    nombre.includes('papa') ||
    nombre.includes('huaycha') ||
    nombre.includes('imilla') ||
    nombre.includes('desiree') ||
    nombre.includes('runa')
  ) {
    return 'PAPA';
  }
  const palabrasHortalizas = /cebolla|zanahoria|lechuga|tomate|pimiento|pepino|brocoli|brócoli|col|repollo|espinaca|betarraga|remolacha/i;
  if (palabrasHortalizas.test(nombre) || nombre.includes('hortaliza')) {
    return 'HORTALIZA';
  }
  return '';
}

export async function obtenerOInsertarProductoLocal(
  db: Db,
  nombre: string,
  rubro?: string
): Promise<number> {
  const nombreNormalizado = nombre.trim();
  if (!nombreNormalizado) {
    throw new Error('El nombre del producto no puede estar vacio.');
  }

  const rubroFinal = rubro && rubro !== 'General' ? rubro : determinarCategoriaCultivo(nombreNormalizado);

  const existente = await db.getFirstAsync<{ id_producto: number; rubro: string }>(
    `
      SELECT id_producto, rubro
      FROM PRODUCTO
      WHERE lower(nombre) = lower(?)
      LIMIT 1
    `,
    nombreNormalizado
  );

  if (existente?.id_producto) {
    const rubroActual = existente.rubro;
    if (rubroFinal && (!rubroActual || rubroActual === 'General' || rubroActual === '')) {
      await db.runAsync(
        `UPDATE PRODUCTO SET rubro = ?, sincronizado = 0 WHERE id_producto = ?`,
        rubroFinal,
        existente.id_producto
      );
    }
    return Number(existente.id_producto);
  }

  const result = await db.runAsync(
    'INSERT INTO PRODUCTO (nombre, rubro, sincronizado) VALUES (?, ?, 0)',
    nombreNormalizado,
    rubroFinal || ''
  );

  return Number(result.lastInsertRowId);
}

export async function getLoteServerColumn(): Promise<'id_lote' | 'id_servidor'> {
  if (loteServerColumnCache) return loteServerColumnCache;

  const db = await getDb();
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(lote)');
  const names = new Set(columns.map((column) => column.name));

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

export type LoteInsertInput = {
  id_servidor?: number | null;
  tipo_cultivo?: string;
  id_productos?: number[];
  nombre_lote: string;
  ubicacion?: string | null;
  superficie: number | null;
  fecha_siembra: string;
  fecha_cosecha_est: string;
  foto_siembra_uri_local?: string | null;
  sincronizado?: number;
};

export type LoteLocal = {
  id_local: number;
  id_productor: number;
  id_servidor: number | null;
  tipo_cultivo: string;
  cultivos_mostrados: string;
  rubros_mostrados: string;
  id_productos: number[];
  nombre_lote: string;
  ubicacion: string | null;
  superficie: number | null;
  fecha_siembra: string;
  fecha_cosecha_est: string;
  fecha_cosecha_real?: string | null;
  foto_siembra_uri_local: string | null;
  sincronizado: number;
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
  l.fecha_cosecha_real,
  l.foto_siembra_url,
  l.estado,
  l.sincronizado,
  l.created_at,
  l.updated_at
`;

function mapRowToLote(row: Record<string, unknown>): LoteLocal {
  const idServidorRaw = row.id_lote ?? row.id_servidor;
  const cultivosMostrados = String(row.cultivos_mostrados ?? '').trim();
  const rubrosMostrados = String(row.rubros_mostrados ?? '').trim();
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
    id_productor: Number(row.id_productor ?? 0),
    id_servidor: idServidorRaw === null || idServidorRaw === undefined ? null : Number(idServidorRaw),
    tipo_cultivo: cultivosVisuales,
    cultivos_mostrados: cultivosVisuales,
    rubros_mostrados: rubrosMostrados,
    id_productos: idProductos,
    nombre_lote: String(row.nombre_lote ?? ''),
    ubicacion: row.ubicacion === null || row.ubicacion === undefined ? null : String(row.ubicacion),
    superficie: row.superficie === null || row.superficie === undefined ? null : Number(row.superficie),
    fecha_siembra: String(row.fecha_siembra ?? ''),
    fecha_cosecha_est: String(row.fecha_cosecha_est ?? ''),
    fecha_cosecha_real: row.fecha_cosecha_real === null || row.fecha_cosecha_real === undefined ? null : String(row.fecha_cosecha_real),
    foto_siembra_uri_local: row.foto_siembra_url === null || row.foto_siembra_url === undefined ? null : String(row.foto_siembra_url),
    sincronizado: Number(row.sincronizado ?? 0),
    created_at: row.created_at === null || row.created_at === undefined ? undefined : String(row.created_at),
    updated_at: row.updated_at === null || row.updated_at === undefined ? undefined : String(row.updated_at),
  };
}

export async function obtenerLotesPendientesLocales(): Promise<LoteLocal[]> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  const idProductorActual = await getCurrentProductorId().catch(() => 0);
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
      SELECT
        ${LOTE_SELECT_FIELDS},
        COALESCE(GROUP_CONCAT(p.nombre, ', '), '') AS cultivos_mostrados,
        COALESCE(GROUP_CONCAT(p.rubro, ', '), '') AS rubros_mostrados,
        COALESCE(GROUP_CONCAT(lp.id_producto, ','), '') AS ids_productos_concat
      FROM lote l
      LEFT JOIN LOTE_PRODUCTO lp ON lp.id_lote = l.id_local
      LEFT JOIN PRODUCTO p ON p.id_producto = lp.id_producto
      WHERE (l.sincronizado = 0 OR l.${serverColumn} IS NULL)
        AND l.id_productor = ?
      GROUP BY l.id_local
      ORDER BY l.id_local DESC
    `,
    idProductorActual
  );

  return rows.map(mapRowToLote);
}

export async function marcarLoteComoSincronizado(idLocal: number, idServidor: number): Promise<void> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  await db.runAsync(
    `
      UPDATE lote
      SET ${serverColumn} = ?, sincronizado = 1, updated_at = ?
      WHERE id_local = ?
    `,
    idServidor,
    new Date().toISOString(),
    idLocal
  );
}

export async function insertarLoteLocal(loteData: LoteInsertInput): Promise<number> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  const now = new Date().toISOString();
  const idProductorActual = await getCurrentProductorId();

  const idProductosDirectos = Array.isArray(loteData.id_productos)
    ? loteData.id_productos.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)
    : [];

  const nombresCultivoCompat = dividirCultivosSeleccionados(loteData.tipo_cultivo ?? '');
  const idProductos: number[] = [];

  if (idProductosDirectos.length > 0) {
    idProductos.push(...idProductosDirectos);
  } else if (nombresCultivoCompat.length > 0) {
    for (const cultivo of nombresCultivoCompat) {
      const categoriaResuelta = determinarCategoriaCultivo(cultivo);
      const idProducto = await obtenerOInsertarProductoLocal(db, cultivo, categoriaResuelta);
      idProductos.push(idProducto);
    }
  }

  const loteSeleccionado = [...new Set(idProductos)].filter((item) => Number.isFinite(item) && item > 0);
  let idLoteLocalCreado = 0;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO lote (
        ${serverColumn},
        id_productor,
        nombre_lote,
        ubicacion,
        superficie,
        fecha_siembra,
        fecha_cosecha_est,
        foto_siembra_url,
        sincronizado,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      loteData.id_servidor ?? null,
      idProductorActual,
      loteData.nombre_lote,
      loteData.ubicacion ?? null,
      loteData.superficie ?? null,
      loteData.fecha_siembra,
      loteData.fecha_cosecha_est,
      loteData.foto_siembra_uri_local ?? null,
      loteData.sincronizado ?? 0,
      now,
      now
    );

    idLoteLocalCreado = Number(result.lastInsertRowId);

    for (const idProducto of loteSeleccionado) {
      await db.runAsync(
        'INSERT OR IGNORE INTO LOTE_PRODUCTO (id_lote, id_producto) VALUES (?, ?)',
        idLoteLocalCreado,
        idProducto
      );
    }
  });

  return idLoteLocalCreado;
}

export async function obtenerLotesLocales(rubro?: string): Promise<LoteLocal[]> {
  const db = await getDb();
  const idProductorActual = await getCurrentProductorId();

  let query: string;
  const params: (string | number)[] = [idProductorActual];

  if (rubro) {
    const rubroUpper = rubro.toUpperCase().trim();
    const rubroSingular = rubroUpper.endsWith('S') ? rubroUpper.slice(0, -1) : rubroUpper;
    const rubroPlural = rubroUpper.endsWith('S') ? rubroUpper : rubroUpper + 'S';

    query = `
      SELECT
        ${LOTE_SELECT_FIELDS},
        COALESCE(GROUP_CONCAT(p.nombre, ', '), '') AS cultivos_mostrados,
        COALESCE(GROUP_CONCAT(p.rubro, ', '), '') AS rubros_mostrados,
        COALESCE(GROUP_CONCAT(lp.id_producto, ','), '') AS ids_productos_concat
      FROM lote l
      INNER JOIN LOTE_PRODUCTO lp ON lp.id_lote = l.id_local
      INNER JOIN PRODUCTO p ON p.id_producto = lp.id_producto
      WHERE l.id_productor = ? AND l.estado = 'ACTIVO' AND (upper(p.rubro) = ? OR upper(p.rubro) = ?)
    `;
    params.push(rubroSingular, rubroPlural);
  } else {
    query = `
      SELECT
        ${LOTE_SELECT_FIELDS},
        COALESCE(GROUP_CONCAT(p.nombre, ', '), '') AS cultivos_mostrados,
        COALESCE(GROUP_CONCAT(p.rubro, ', '), '') AS rubros_mostrados,
        COALESCE(GROUP_CONCAT(lp.id_producto, ','), '') AS ids_productos_concat
      FROM lote l
      LEFT JOIN LOTE_PRODUCTO lp ON lp.id_lote = l.id_local
      LEFT JOIN PRODUCTO p ON p.id_producto = lp.id_producto
      WHERE l.id_productor = ? AND l.estado = 'ACTIVO'
    `;
  }

  query += `
    GROUP BY l.id_local
    ORDER BY l.id_local DESC
  `;

  const rows = await db.getAllAsync<Record<string, unknown>>(query, ...params);
  return rows.map(mapRowToLote);
}

export async function actualizarCultivosDeLote(
  idLoteLocal: number,
  nuevosCultivos: string[],
  rubro?: string
): Promise<void> {
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM LOTE_PRODUCTO WHERE id_lote = ?', idLoteLocal);

    for (const cultivo of nuevosCultivos) {
      const categoriaResuelta = rubro || determinarCategoriaCultivo(cultivo);
      const idProducto = await obtenerOInsertarProductoLocal(db, cultivo, categoriaResuelta);
      await db.runAsync('INSERT OR IGNORE INTO LOTE_PRODUCTO (id_lote, id_producto) VALUES (?, ?)', idLoteLocal, idProducto);
    }

    await db.runAsync('UPDATE lote SET updated_at = ? WHERE id_local = ?', new Date().toISOString(), idLoteLocal);
  });
}

export async function eliminarLoteLocal(idLocal: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE gasto_lote SET estado = 'INACTIVO' WHERE id_lote_local = ? OR id_lote_servidor = ?", idLocal, idLocal);
  await db.runAsync("UPDATE produccion_lote SET estado = 'INACTIVO' WHERE id_lote_local = ? OR id_lote = ?", idLocal, idLocal);
  await db.runAsync("UPDATE lote SET estado = 'INACTIVO' WHERE id_local = ?", idLocal);
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
    `UPDATE lote SET nombre_lote = ?, ubicacion = ?, superficie = ?, sincronizado = 1, updated_at = ? WHERE ${serverColumn} = ?`,
    cambios.nombre_lote ?? null,
    cambios.ubicacion ?? null,
    cambios.superficie ?? null,
    new Date().toISOString(),
    idServidor
  );
}

export async function actualizarLoteLocal(
  idLocal: number,
  cambios: Partial<Omit<LoteLocal, 'id_local'>>
): Promise<void> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();

  await db.runAsync(
    `UPDATE lote SET nombre_lote = ?, ubicacion = ?, superficie = ?, updated_at = ? WHERE id_local = ?`,
    cambios.nombre_lote ?? null,
    cambios.ubicacion ?? null,
    cambios.superficie ?? null,
    new Date().toISOString(),
    idLocal
  );

  if (Object.prototype.hasOwnProperty.call(cambios, 'id_servidor') && cambios.id_servidor !== undefined) {
    await db.runAsync(
      `UPDATE lote SET ${serverColumn} = ? WHERE id_local = ?`,
      cambios.id_servidor ?? null,
      idLocal
    );
  }
}

export async function eliminarLoteLocalPorServidor(idServidor: number): Promise<void> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  await db.runAsync("UPDATE gasto_lote SET estado = 'INACTIVO' WHERE id_lote_servidor = ?", idServidor);
  await db.runAsync("UPDATE produccion_lote SET estado = 'INACTIVO' WHERE id_lote = ?", idServidor);
  await db.runAsync(`UPDATE lote SET estado = 'INACTIVO' WHERE ${serverColumn} = ?`, idServidor);
}
