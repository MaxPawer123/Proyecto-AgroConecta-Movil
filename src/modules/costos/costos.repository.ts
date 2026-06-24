import { getDb } from '../../core/database/sqlite.config';
import {
  actualizarCultivosDeLote,
  eliminarLoteLocal,
  obtenerLotesLocales,
  type LoteLocal,
} from '../siembra/siembra.repository';

type ModalidadPago = 'CICLO' | 'ANUAL' | 'NA';

export type CostoLocal = {
  id_local: number;
  id_servidor: number | null;
  id_lote_local: number | null;
  id_lote_servidor: number | null;
  categoria: string;
  descripcion: string | null;
  cantidad: number;
  costo_unitario: number;
  monto_total: number;
  tipo_costo: 'FIJO' | 'VARIABLE';
  modalidad_pago: ModalidadPago;
  fecha_gasto: string;
  sincronizado: boolean;
  ultimo_error: string | null;
};

export type GuardarCostoLocalInput = {
  id_lote_local?: number | null;
  id_lote_servidor?: number | null;
  categoria: string;
  descripcion?: string | null;
  cantidad: number;
  costo_unitario: number;
  tipo_costo?: 'FIJO' | 'VARIABLE';
  modalidad_pago?: ModalidadPago;
  fecha_gasto?: string;
  sincronizado?: boolean;
  ultimo_error?: string | null;
};

type ProduccionLocal = {
  id_local: number;
  id_produccion: number | null;
  id_lote_local: number | null;
  id_lote_servidor: number | null;
  fecha_registro: string;
  cantidad_obtenida: number;
  precio_venta: number;
  sincronizado: boolean;
};

async function getTableColumns(db: Awaited<ReturnType<typeof getDb>>, tableName: string): Promise<Set<string>> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return new Set(columns.map((column) => column.name));
}

function mapRowToCostoLocal(row: Record<string, unknown>): CostoLocal {
  return {
    id_local: Number(row.id_local),
    id_servidor: row.id_gasto === null || row.id_gasto === undefined ? null : Number(row.id_gasto),
    id_lote_local: row.id_lote_local === null || row.id_lote_local === undefined ? null : Number(row.id_lote_local),
    id_lote_servidor:
      row.id_lote_servidor === null || row.id_lote_servidor === undefined ? null : Number(row.id_lote_servidor),
    categoria: String(row.categoria ?? ''),
    descripcion: row.descripcion ? String(row.descripcion) : null,
    cantidad: Number(row.cantidad ?? 0),
    costo_unitario: Number(row.costo_unitario ?? 0),
    monto_total: Number(row.monto_total ?? 0),
    tipo_costo: (String(row.tipo_costo ?? 'VARIABLE') as 'FIJO' | 'VARIABLE'),
    modalidad_pago: (String(row.modalidad_pago ?? 'NA') as ModalidadPago),
    fecha_gasto: String(row.fecha_gasto ?? ''),
    sincronizado: Number(row.sincronizado ?? 0) === 1,
    ultimo_error: row.ultimo_error ? String(row.ultimo_error) : null,
  };
}

function mapRowToProduccionLocal(row: Record<string, unknown>): ProduccionLocal {
  return {
    id_local: Number(row.id_local),
    id_produccion: row.id_produccion === null || row.id_produccion === undefined ? null : Number(row.id_produccion),
    id_lote_local: row.id_lote_local === null || row.id_lote_local === undefined ? null : Number(row.id_lote_local),
    id_lote_servidor: row.id_lote === null || row.id_lote === undefined ? null : Number(row.id_lote),
    fecha_registro: String(row.fecha_registro ?? ''),
    cantidad_obtenida: Number(row.cantidad_obtenida ?? 0),
    precio_venta: Number(row.precio_venta ?? 0),
    sincronizado: Number(row.sincronizado ?? 0) === 1,
  };
}

export {
  actualizarCultivosDeLote,
  eliminarLoteLocal,
  obtenerLotesLocales,
  type LoteLocal,
};

export async function guardarCostoLocal(input: GuardarCostoLocalInput): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const fechaGasto = input.fecha_gasto ?? new Date().toISOString();
  const tipoCosto = input.tipo_costo ?? 'VARIABLE';
  const modalidad = input.modalidad_pago ?? 'NA';
  const montoTotal = input.cantidad * input.costo_unitario;

  const columnas = await getTableColumns(db, 'gasto_lote');
  const columnasInsertables: Array<{ nombre: string; valor: string | number | null }> = [
    { nombre: 'id_gasto', valor: null },
    { nombre: 'id_lote_local', valor: input.id_lote_local ?? null },
    { nombre: 'id_lote_servidor', valor: input.id_lote_servidor ?? null },
    { nombre: 'categoria', valor: input.categoria },
    { nombre: 'descripcion', valor: input.descripcion ?? null },
    { nombre: 'cantidad', valor: input.cantidad },
    { nombre: 'costo_unitario', valor: input.costo_unitario },
    { nombre: 'monto_total', valor: montoTotal },
    { nombre: 'tipo_costo', valor: tipoCosto },
    { nombre: 'modalidad_pago', valor: modalidad },
    { nombre: 'fecha_gasto', valor: fechaGasto },
    { nombre: 'sincronizado', valor: input.sincronizado ? 1 : 0 },
    { nombre: 'ultimo_error', valor: input.ultimo_error ?? null },
    { nombre: 'created_at', valor: now },
    { nombre: 'updated_at', valor: now },
  ].filter((item) => columnas.has(item.nombre));

  if (columnasInsertables.length === 0) {
    throw new Error('La tabla gasto_lote no tiene columnas insertables.');
  }

  const nombresColumnas = columnasInsertables.map((item) => item.nombre).join(', ');
  const placeholders = columnasInsertables.map(() => '?').join(', ');
  const valores = columnasInsertables.map((item) => item.valor);

  const result = await db.runAsync(`INSERT INTO gasto_lote (${nombresColumnas}) VALUES (${placeholders})`, ...valores);
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

  const whereSql = where.length > 0 ? `WHERE (${where.join(' OR ')}) AND estado = 'ACTIVO'` : "WHERE estado = 'ACTIVO'";
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM gasto_lote ${whereSql} ORDER BY id_local DESC`,
    ...values
  );

  return rows.map(mapRowToCostoLocal);
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
    categoria: 'categoria',
    descripcion: 'descripcion',
    cantidad: 'cantidad',
    costo_unitario: 'costo_unitario',
    monto_total: 'monto_total',
    tipo_costo: 'tipo_costo',
    modalidad_pago: 'modalidad_pago',
    fecha_gasto: 'fecha_gasto',
    sincronizado: 'sincronizado',
    ultimo_error: 'ultimo_error',
  };

  const entries = Object.entries(cambios).filter(([key]) => key in columnas);
  if (entries.length === 0) return;

  const setSql = entries.map(([key]) => `${columnas[key]} = ?`).concat('updated_at = ?').join(', ');
  const values = entries.map(([key, value]) => (key === 'sincronizado' ? (value ? 1 : 0) : ((value ?? null) as string | number | null)));
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

export async function obtenerGastosPendientesPorLoteLocal(idLoteLocal: number): Promise<CostoLocal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
      SELECT *
      FROM gasto_lote
      WHERE (id_lote_local = ? OR id_lote_servidor = ?) AND sincronizado = 0
      ORDER BY id_local DESC
    `,
    idLoteLocal,
    idLoteLocal
  );

  return rows.map(mapRowToCostoLocal);
}

export async function eliminarCostoLocal(idLocal: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE gasto_lote SET estado = 'INACTIVO' WHERE id_local = ?", idLocal);
}

export async function guardarBorradorProduccionLocal(input: {
  idLoteLocal?: number | null;
  idLoteServidor?: number | null;
  cantidadObtenida: number;
  precioVenta: number;
}): Promise<void> {
  if ((!input.idLoteLocal || input.idLoteLocal <= 0) && (!input.idLoteServidor || input.idLoteServidor <= 0)) {
    return;
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const fechaRegistro = now.split('T')[0];

  const where: string[] = [];
  const values: number[] = [];

  if (typeof input.idLoteLocal === 'number' && input.idLoteLocal > 0) {
    where.push('id_lote_local = ?');
    values.push(input.idLoteLocal);
  }

  if (typeof input.idLoteServidor === 'number' && input.idLoteServidor > 0) {
    where.push('id_lote = ?');
    values.push(input.idLoteServidor);
  }

  const whereSql = where.length > 0 ? `WHERE (${where.join(' OR ')}) AND estado = 'ACTIVO'` : "WHERE estado = 'ACTIVO'";
  const existente = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT id_local FROM produccion_lote ${whereSql} ORDER BY id_local DESC LIMIT 1`,
    ...values
  );

  if (existente?.id_local !== undefined && existente?.id_local !== null) {
    await db.runAsync(
      `
        UPDATE produccion_lote
        SET
          id_lote_local = ?,
          id_lote = ?,
          fecha_registro = ?,
          cantidad_obtenida = ?,
          precio_venta = ?,
          sincronizado = 0,
          updated_at = ?
        WHERE id_local = ?
      `,
      input.idLoteLocal ?? null,
      input.idLoteServidor ?? null,
      fechaRegistro,
      input.cantidadObtenida,
      input.precioVenta,
      now,
      Number(existente.id_local)
    );
    return;
  }

  await db.runAsync(
    `
      INSERT INTO produccion_lote (
        id_produccion,
        id_lote_local,
        id_lote,
        fecha_registro,
        cantidad_obtenida,
        precio_venta,
        sincronizado,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    null,
    input.idLoteLocal ?? null,
    input.idLoteServidor ?? null,
    fechaRegistro,
    input.cantidadObtenida,
    input.precioVenta,
    0,
    now,
    now
  );
}

export async function obtenerBorradorProduccionLocal(params: {
  idLoteLocal?: number;
  idLoteServidor?: number;
}): Promise<ProduccionLocal | null> {
  const db = await getDb();
  const where: string[] = [];
  const values: number[] = [];

  if (typeof params.idLoteLocal === 'number' && params.idLoteLocal > 0) {
    where.push('id_lote_local = ?');
    values.push(params.idLoteLocal);
  }

  if (typeof params.idLoteServidor === 'number' && params.idLoteServidor > 0) {
    where.push('id_lote = ?');
    values.push(params.idLoteServidor);
  }

  if (where.length === 0) return null;

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM produccion_lote WHERE (${where.join(' OR ')}) AND estado = 'ACTIVO' ORDER BY id_local DESC LIMIT 1`,
    ...values
  );

  if (!row) return null;
  return {
    id_local: Number(row.id_local),
    id_produccion: row.id_produccion === null || row.id_produccion === undefined ? null : Number(row.id_produccion),
    id_lote_local: row.id_lote_local === null || row.id_lote_local === undefined ? null : Number(row.id_lote_local),
    id_lote_servidor: row.id_lote === null || row.id_lote === undefined ? null : Number(row.id_lote),
    fecha_registro: String(row.fecha_registro ?? ''),
    cantidad_obtenida: Number(row.cantidad_obtenida ?? 0),
    precio_venta: Number(row.precio_venta ?? 0),
    sincronizado: Number(row.sincronizado ?? 0) === 1,
  };
}

export async function marcarProduccionComoSincronizada(idLocal: number, idProduccion: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE produccion_lote 
     SET id_produccion = ?, sincronizado = 1, updated_at = ? 
     WHERE id_local = ?`,
    idProduccion,
    new Date().toISOString(),
    idLocal
  );
}

export async function obtenerProduccionesHuerfanasPendientes(): Promise<{ produccion: ProduccionLocal; idLoteServidor: number }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT p.*, l.id_lote AS server_lote_id
     FROM produccion_lote p
     LEFT JOIN lote l ON p.id_lote_local = l.id_local
     WHERE p.sincronizado = 0 AND (l.id_lote IS NOT NULL OR p.id_lote IS NOT NULL)
     ORDER BY p.id_local ASC`
  );

  return rows.map((row) => ({
    produccion: {
      id_local: row.id_local,
      id_produccion: row.id_produccion,
      id_lote_local: row.id_lote_local,
      id_lote_servidor: row.id_lote ?? row.server_lote_id,
      fecha_registro: row.fecha_registro,
      cantidad_obtenida: row.cantidad_obtenida,
      precio_venta: row.precio_venta,
      sincronizado: Number(row.sincronizado ?? 0) === 1,
    },
    idLoteServidor: row.id_lote ?? row.server_lote_id,
  }));
}
