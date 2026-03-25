import { getDb, getLoteServerColumn } from './sqlite';

type LoteInsertInput = {
  id_servidor?: number | null;
  id_producto: number;
  nombre_lote: string;
  ubicacion?: string | null;
  variedad?: string | null;
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
  id_producto: number;
  nombre_lote: string;
  ubicacion: string | null;
  variedad: string | null;
  superficie: number | null;
  fecha_siembra: string;
  fecha_cosecha_est: string;
  rendimiento_estimado: number | null;
  precio_venta_est: number | null;
  foto_siembra_uri_local: string | null;
  estado_sincronizacion: string;
};

type CostoLocal = {
  id_local: number;
  id_servidor: number | null;
  id_lote_local: number | null;
  id_lote_servidor: number | null;
  concepto: string;
  cantidad: number;
  costo_unitario: number;
  tipo_costo: 'FIJO' | 'VARIABLE';
  fecha_costo_iso: string;
  sincronizado: boolean;
  ultimo_error: string | null;
};

function mapRowToLote(row: Record<string, unknown>): LoteLocal {
  const idServidorRaw = row.id_lote ?? row.id_servidor;

  return {
    id_local: Number(row.id_local),
    id_servidor: idServidorRaw === null || idServidorRaw === undefined ? null : Number(idServidorRaw),
    id_producto: Number(row.id_producto),
    nombre_lote: String(row.nombre_lote ?? ''),
    ubicacion: row.ubicacion === null || row.ubicacion === undefined ? null : String(row.ubicacion),
    variedad: row.variedad === null || row.variedad === undefined ? null : String(row.variedad),
    superficie: row.superficie === null || row.superficie === undefined ? null : Number(row.superficie),
    fecha_siembra: String(row.fecha_siembra ?? ''),
    fecha_cosecha_est: String(row.fecha_cosecha_est ?? ''),
    rendimiento_estimado:
      row.rendimiento_estimado === null || row.rendimiento_estimado === undefined ? null : Number(row.rendimiento_estimado),
    precio_venta_est: row.precio_venta_est === null || row.precio_venta_est === undefined ? null : Number(row.precio_venta_est),
    foto_siembra_uri_local: row.foto_siembra_url === null || row.foto_siembra_url === undefined ? null : String(row.foto_siembra_url),
    estado_sincronizacion: String(row.estado_sincronizacion ?? 'PENDIENTE'),
  };
}

export async function obtenerLotesPendientesLocales(): Promise<LoteLocal[]> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
      SELECT *
      FROM lote
      WHERE estado_sincronizacion <> 'SINCRONIZADO' OR ${serverColumn} IS NULL
      ORDER BY id_local DESC
    `
  );

  return rows.map(mapRowToLote);
}

export async function marcarLoteComoSincronizado(idLocal: number, idServidor: number): Promise<void> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  await db.runAsync(
    `
      UPDATE lote
      SET ${serverColumn} = ?, estado_sincronizacion = 'SINCRONIZADO', updated_at = ?
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

  const result = await db.runAsync(
    `
      INSERT INTO lote (
        ${serverColumn},
        id_productor,
        id_producto,
        nombre_lote,
        ubicacion,
        variedad,
        superficie,
        fecha_siembra,
        fecha_cosecha_est,
        rendimiento_estimado,
        precio_venta_est,
        foto_siembra_url,
        estado_sincronizacion,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    loteData.id_servidor ?? null,
    1,
    loteData.id_producto,
    loteData.nombre_lote,
    loteData.ubicacion ?? null,
    loteData.variedad ?? null,
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

  return Number(result.lastInsertRowId);
}

export async function obtenerLotesLocales(): Promise<LoteLocal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
      SELECT *
      FROM lote
      ORDER BY id_local DESC
    `
  );

  return rows.map(mapRowToLote);
}

const columnasActualizables: Record<string, string> = {
  id_lote: 'id_lote',
  id_servidor: 'id_servidor',
  id_producto: 'id_producto',
  nombre_lote: 'nombre_lote',
  ubicacion: 'ubicacion',
  variedad: 'variedad',
  superficie: 'superficie',
  fecha_siembra: 'fecha_siembra',
  fecha_cosecha_est: 'fecha_cosecha_est',
  rendimiento_estimado: 'rendimiento_estimado',
  precio_venta_est: 'precio_venta_est',
  foto_siembra_uri_local: 'foto_siembra_url',
  estado_sincronizacion: 'estado_sincronizacion',
};

function construirUpdateSql(cambios: Partial<Omit<LoteLocal, 'id_local'>>): {
  setSql: string;
  values: (string | number | null)[];
} {
  const entries = Object.entries(cambios).filter(([key]) => key in columnasActualizables);
  const setParts: string[] = [];
  const values: (string | number |  null)[] = [];

  for (const [key, value] of entries) {
    setParts.push(`${columnasActualizables[key]} = ?`);
    values.push(value as string | number | null);
  }

  setParts.push('updated_at = ?');
  values.push(new Date().toISOString());

  return {
    setSql: setParts.join(', '),
    values,
  };
}

export async function actualizarLoteLocal(
  idLocal: number,
  cambios: Partial<Omit<LoteLocal, 'id_local'>>
): Promise<void> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  const cambiosNormalizados: Partial<Omit<LoteLocal, 'id_local'>> = { ...cambios };
  if (Object.prototype.hasOwnProperty.call(cambios, 'id_servidor')) {
    delete (cambiosNormalizados as Record<string, unknown>).id_servidor;
    (cambiosNormalizados as Record<string, unknown>)[serverColumn] = cambios.id_servidor ?? null;
  }
  const { setSql, values } = construirUpdateSql(cambiosNormalizados);

  if (!setSql) return;

  await db.runAsync(`UPDATE lote SET ${setSql} WHERE id_local = ?`, ...values, idLocal);
}

export async function actualizarLoteLocalPorServidor(
  idServidor: number,
  cambios: Partial<Omit<LoteLocal, 'id_local'>>
): Promise<void> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  const cambiosNormalizados: Partial<Omit<LoteLocal, 'id_local'>> = { ...cambios };
  if (Object.prototype.hasOwnProperty.call(cambios, 'id_servidor')) {
    delete (cambiosNormalizados as Record<string, unknown>).id_servidor;
    (cambiosNormalizados as Record<string, unknown>)[serverColumn] = cambios.id_servidor ?? null;
  }
  const { setSql, values } = construirUpdateSql(cambiosNormalizados);

  if (!setSql) return;

  await db.runAsync(`UPDATE lote SET ${setSql} WHERE ${serverColumn} = ?`, ...values, idServidor);
}

export async function eliminarLoteLocal(idLocal: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM lote WHERE id_local = ?', idLocal);
}

export async function eliminarLoteLocalPorServidor(idServidor: number): Promise<void> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  await db.runAsync(`DELETE FROM lote WHERE ${serverColumn} = ?`, idServidor);
}

// Funciones equivalentes para costos locales (tabla requerida para offline-first).
export async function guardarCostoLocal(input: Omit<CostoLocal, 'id_local'>): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `
      INSERT INTO gasto_lote (
        id_gasto,
        id_lote_local,
        id_lote_servidor,
        id_lote,
        categoria,
        descripcion,
        cantidad,
        costo_unitario,
        monto_total,
        tipo_costo,
        modalidad_pago,
        fecha_gasto,
        sincronizado,
        ultimo_error,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    input.id_servidor ?? null,
    input.id_lote_local ?? null,
    input.id_lote_servidor ?? null,
    input.id_lote_servidor ?? null,
    input.concepto,
    null,
    input.cantidad,
    input.costo_unitario,
    input.cantidad * input.costo_unitario,
    input.tipo_costo,
    'NA',
    input.fecha_costo_iso,
    input.sincronizado ? 1 : 0,
    input.ultimo_error ?? null,
    now,
    now
  );

  return Number(result.lastInsertRowId);
}

export async function obtenerCostosLocalesPorLote(params: {
  idLoteLocal?: number;
  idLoteServidor?: number;
}): Promise<CostoLocal[]> {
  const db = await getDb();
  const where: string[] = [];
  const values: number[] = [];

  if (typeof params.idLoteLocal === 'number') {
    where.push('id_lote_local = ?');
    values.push(params.idLoteLocal);
  }

  if (typeof params.idLoteServidor === 'number') {
    where.push('id_lote_servidor = ?');
    values.push(params.idLoteServidor);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' OR ')}` : '';
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM gasto_lote ${whereSql} ORDER BY id_local DESC`,
    ...values
  );

  return rows.map((row: Record<string, unknown>) => ({
    id_local: Number(row.id_local),
    id_servidor: row.id_gasto === null || row.id_gasto === undefined ? null : Number(row.id_gasto),
    id_lote_local: row.id_lote_local === null || row.id_lote_local === undefined ? null : Number(row.id_lote_local),
    id_lote_servidor:
      row.id_lote_servidor === null || row.id_lote_servidor === undefined ? null : Number(row.id_lote_servidor),
    concepto: String(row.categoria ?? ''),
    cantidad: Number(row.cantidad ?? 0),
    costo_unitario: Number(row.costo_unitario ?? 0),
    tipo_costo: (String(row.tipo_costo ?? 'VARIABLE') as 'FIJO' | 'VARIABLE'),
    fecha_costo_iso: String(row.fecha_gasto ?? ''),
    sincronizado: Number(row.sincronizado ?? 0) === 1,
    ultimo_error: row.ultimo_error ? String(row.ultimo_error) : null,
  }));
}

export async function actualizarCostoLocal(
  idLocal: number,
  cambios: Partial<Omit<CostoLocal, 'id_local'>>
): Promise<void> {
  const db = await getDb();
  const columnas: Record<string, string> = {
    id_servidor: 'id_gasto',
    id_lote_local: 'id_lote_local',
    id_lote_servidor: 'id_lote_servidor',
    concepto: 'categoria',
    cantidad: 'cantidad',
    costo_unitario: 'costo_unitario',
    tipo_costo: 'tipo_costo',
    fecha_costo_iso: 'fecha_gasto',
    sincronizado: 'sincronizado',
    ultimo_error: 'ultimo_error',
  };

  const entries = Object.entries(cambios).filter(([key]) => key in columnas);
  if (entries.length === 0) return;

  const setSql = entries
    .map(([key]) => `${columnas[key]} = ?`)
    .concat('updated_at = ?')
    .join(', ');

  const values = entries.map(([key, value]) => {
    if (key === 'sincronizado') return value ? 1 : 0;
    return (value ?? null) as string | number | null;
  });

  values.push(new Date().toISOString());

  await db.runAsync(`UPDATE gasto_lote SET ${setSql} WHERE id_local = ?`, ...values, idLocal);
}

export async function marcarCostoComoSincronizado(idLocal: number, idServidor: number): Promise<void> {
  await actualizarCostoLocal(idLocal, {
    id_servidor: idServidor,
    sincronizado: true,
    ultimo_error: null,
  });
}
