import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '../../core/database/sqlite.config';

export type GastoLocal = {
  id_local: number;
  id_gasto: number | null;
  id_lote_local: number | null;
  id_lote_servidor: number | null;
  categoria: string;
  descripcion: string | null;
  cantidad: number;
  costo_unitario: number;
  monto_total: number;
  tipo_costo: 'FIJO' | 'VARIABLE';
  modalidad_pago: 'CICLO' | 'ANUAL' | 'NA';
  fecha_gasto: string;
  sincronizado: boolean;
  ultimo_error: string | null;
  created_at: string;
  updated_at: string;
};

export type GuardarGastoInput = {
  id_lote_local?: number | null;
  id_lote_servidor?: number | null;
  categoria: string;
  descripcion?: string | null;
  cantidad: number;
  costo_unitario: number;
  tipo_costo?: 'FIJO' | 'VARIABLE';
  modalidad_pago?: 'CICLO' | 'ANUAL' | 'NA';
  fecha_gasto?: string;
};

async function getCurrentProductorId(): Promise<number> {
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
}

export async function guardarGastoLocal(input: GuardarGastoInput): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const fechaGasto = input.fecha_gasto ?? now.split('T')[0];
  const tipoCosto = input.tipo_costo ?? 'VARIABLE';
  const modalidad = input.modalidad_pago ?? 'NA';
  const montoTotal = input.cantidad * input.costo_unitario;

  const result = await db.runAsync(
    `INSERT INTO gasto_lote (
      id_gasto,
      id_lote_local,
      id_lote_servidor,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    null,
    input.id_lote_local ?? null,
    input.id_lote_servidor ?? null,
    input.categoria,
    input.descripcion ?? null,
    input.cantidad,
    input.costo_unitario,
    montoTotal,
    tipoCosto,
    modalidad,
    fechaGasto,
    0,
    null,
    now,
    now
  );

  return Number(result.lastInsertRowId);
}

export async function obtenerGastosPorLoteLocal(idLoteLocal: number): Promise<GastoLocal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM gasto_lote
     WHERE (id_lote_local = ? OR id_lote_servidor = ?) AND estado = 'ACTIVO'
     ORDER BY fecha_gasto DESC`,
    idLoteLocal,
    idLoteLocal
  );

  return rows.map((row) => ({
    id_local: row.id_local,
    id_gasto: row.id_gasto,
    id_lote_local: row.id_lote_local,
    id_lote_servidor: row.id_lote_servidor,
    categoria: row.categoria,
    descripcion: row.descripcion,
    cantidad: row.cantidad,
    costo_unitario: row.costo_unitario,
    monto_total: row.monto_total,
    tipo_costo: row.tipo_costo,
    modalidad_pago: row.modalidad_pago,
    fecha_gasto: row.fecha_gasto,
    sincronizado: row.sincronizado === 1,
    ultimo_error: row.ultimo_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function obtenerGastosPendientesPorLoteLocal(idLoteLocal: number): Promise<GastoLocal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM gasto_lote
     WHERE (id_lote_local = ? OR id_lote_servidor = ?) AND sincronizado = 0
     ORDER BY id_local ASC`,
    idLoteLocal,
    idLoteLocal
  );

  return rows.map((row) => ({
    id_local: row.id_local,
    id_gasto: row.id_gasto,
    id_lote_local: row.id_lote_local,
    id_lote_servidor: row.id_lote_servidor,
    categoria: row.categoria,
    descripcion: row.descripcion,
    cantidad: row.cantidad,
    costo_unitario: row.costo_unitario,
    monto_total: row.monto_total,
    tipo_costo: row.tipo_costo,
    modalidad_pago: row.modalidad_pago,
    fecha_gasto: row.fecha_gasto,
    sincronizado: row.sincronizado === 1,
    ultimo_error: row.ultimo_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function marcarGastoComoSincronizado(idLocal: number, idGasto: number, idLoteServidor?: number | null): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    if (idLoteServidor) {
      await db.runAsync(
        `UPDATE gasto_lote SET id_gasto = ?, sincronizado = 1, id_lote_servidor = ?, updated_at = ? WHERE id_local = ?`,
        idGasto,
        idLoteServidor,
        new Date().toISOString(),
        idLocal
      );
    } else {
      await db.runAsync(
        `UPDATE gasto_lote SET id_gasto = ?, sincronizado = 1, updated_at = ? WHERE id_local = ?`,
        idGasto,
        new Date().toISOString(),
        idLocal
      );
    }
  });
}

export async function eliminarGastoLocal(idLocal: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE gasto_lote SET estado = 'INACTIVO' WHERE id_local = ?", idLocal);
}

export async function actualizarCostoLocal(
  idLocal: number,
  data: { ultimo_error?: string | null }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE gasto_lote SET ultimo_error = ?, updated_at = ? WHERE id_local = ?`,
    data.ultimo_error ?? null,
    new Date().toISOString(),
    idLocal
  );
}

export async function obtenerGastosHuérfanosPendientes(): Promise<{ gasto: GastoLocal; idLoteServidor: number }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT g.*, l.id_lote AS server_lote_id
     FROM gasto_lote g
     LEFT JOIN lote l ON g.id_lote_local = l.id_local
     WHERE g.sincronizado = 0 AND (l.id_lote IS NOT NULL OR g.id_lote_servidor IS NOT NULL)
     ORDER BY g.id_local ASC`
  );

  return rows.map((row) => ({
    gasto: {
      id_local: row.id_local,
      id_gasto: row.id_gasto,
      id_lote_local: row.id_lote_local,
      id_lote_servidor: row.id_lote_servidor ?? row.server_lote_id,
      categoria: row.categoria,
      descripcion: row.descripcion,
      cantidad: row.cantidad,
      costo_unitario: row.costo_unitario,
      monto_total: row.monto_total,
      tipo_costo: row.tipo_costo,
      modalidad_pago: row.modalidad_pago,
      fecha_gasto: row.fecha_gasto,
      sincronizado: row.sincronizado === 1,
      ultimo_error: row.ultimo_error,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    idLoteServidor: row.id_lote_servidor ?? row.server_lote_id,
  }));
}

