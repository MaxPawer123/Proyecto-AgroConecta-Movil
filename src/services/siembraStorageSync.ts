import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { crearLoteApi, obtenerLotesPorProductoApi, subirFotoSiembraApi } from '@/src/services/api';
import { insertarLoteLocal } from '@/src/services/database';
import { getDb, getLoteServerColumn } from './sqlite';

const SYNC_INTERVAL_MS = 10000;
const MAX_ITEMS_PER_SYNC = 6;

type EstadoCola = 'PENDIENTE' | 'COMPLETADO';

type LotePendiente = {
  idLocal: number;
  idServidor: number | null;
  idProducto: number;
  nombreLote: string;
  ubicacion: string;
  tipoCultivo: string;
  superficie: number;
  fechaSiembraIso: string;
  fechaCosechaIso: string;
  rendimientoEstimado: number;
  precioVentaEstimado: number;
  fotoSiembraUrl: string | null;
};

export type RegistrarSiembraInput = {
  rubro: 'QUINUA' | 'HORTALIZA';
  categoriaProducto: string;
  productoDefaultId: number;
  nombreLote: string;
  tipoCultivo: string;
  ubicacion: string;
  superficie: number;
  fechaSiembraIso: string;
  fechaCosechaIso: string;
  rendimientoEstimado: number;
  precioVentaEstimado: number;
  fotoTerrenoUri?: string | null;
};

export type RegistrarSiembraResultado = {
  estado: EstadoCola;
  idLocal: number;
};

export type EventoSincronizacionSiembra =
  | { tipo: 'LOTE_SINCRONIZADO'; idLocal: number; idServidor: number }
  | { tipo: 'SINCRONIZACION_COMPLETADA'; procesados: number; sincronizados: number };

let syncTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let netInfoUnsubscribe: (() => void) | null = null;
let syncEnCurso = false;
const listenersSincronizacion = new Set<(evento: EventoSincronizacionSiembra) => void>();

function emitirEventoSincronizacion(evento: EventoSincronizacionSiembra): void {
  for (const listener of listenersSincronizacion) {
    try {
      listener(evento);
    } catch (error) {
      console.warn('Listener de sincronizacion de siembras fallo:', error);
    }
  }
}

export function suscribirEventosSincronizacionSiembras(
  listener: (evento: EventoSincronizacionSiembra) => void
): () => void {
  listenersSincronizacion.add(listener);
  return () => {
    listenersSincronizacion.delete(listener);
  };
}

async function hayConexionDisponible(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

function mapRowToPendiente(row: Record<string, unknown>): LotePendiente {
  const idServidorRaw = row.id_lote ?? row.id_servidor;

  return {
    idLocal: Number(row.id_local),
    idServidor: idServidorRaw === null || idServidorRaw === undefined ? null : Number(idServidorRaw),
    idProducto: Number(row.id_producto),
    nombreLote: String(row.nombre_lote ?? ''),
    ubicacion: String(row.ubicacion ?? ''),
    tipoCultivo: String(row.variedad ?? ''),
    superficie: Number(row.superficie ?? 0),
    fechaSiembraIso: String(row.fecha_siembra ?? ''),
    fechaCosechaIso: String(row.fecha_cosecha_est ?? ''),
    rendimientoEstimado: Number(row.rendimiento_estimado ?? 0),
    precioVentaEstimado: Number(row.precio_venta_est ?? 0),
    fotoSiembraUrl: row.foto_siembra_url ? String(row.foto_siembra_url) : null,
  };
}

async function obtenerLotesPendientes(): Promise<LotePendiente[]> {
  const db = await getDb();
  const serverColumn = await getLoteServerColumn();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
      SELECT *
      FROM lote
      WHERE estado_sincronizacion <> 'SINCRONIZADO' OR ${serverColumn} IS NULL
      ORDER BY id_local DESC
      LIMIT ?
    `,
    MAX_ITEMS_PER_SYNC
  );

  return rows.map(mapRowToPendiente);
}

async function marcarLoteSincronizado(idLocal: number, idServidor: number): Promise<void> {
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

async function marcarLotePendienteConError(idLocal: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `
      UPDATE lote
      SET estado_sincronizacion = 'PENDIENTE', updated_at = ?
      WHERE id_local = ?
    `,
    new Date().toISOString(),
    idLocal
  );
}

function normalizarTexto(valor: string | null | undefined): string {
  return String(valor ?? '').trim().toLowerCase();
}

function sonNumerosCercanos(a: number, b: number): boolean {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 0.0001;
}

async function buscarLoteServidorExistente(item: LotePendiente): Promise<number | null> {
  try {
    const lotesServidor = await obtenerLotesPorProductoApi(item.idProducto);
    const encontrado = lotesServidor.find((lote) => {
      const coincideNombre = normalizarTexto(lote.nombre_lote) === normalizarTexto(item.nombreLote);
      const coincideVariedad = normalizarTexto(lote.variedad) === normalizarTexto(item.tipoCultivo);
      const coincideSiembra = normalizarTexto(lote.fecha_siembra) === normalizarTexto(item.fechaSiembraIso);
      const coincideCosecha = normalizarTexto(lote.fecha_cosecha_est) === normalizarTexto(item.fechaCosechaIso);
      const coincideSuperficie = sonNumerosCercanos(Number(lote.superficie), Number(item.superficie));
      return coincideNombre && coincideVariedad && coincideSiembra && coincideCosecha && coincideSuperficie;
    });

    if (!encontrado) return null;
    const id = Number(encontrado.id_lote);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function sincronizarLote(item: LotePendiente): Promise<number> {
  let fotoSiembraUrl = item.fotoSiembraUrl;
  if (fotoSiembraUrl && !fotoSiembraUrl.startsWith('http')) {
    try {
      fotoSiembraUrl = await subirFotoSiembraApi(fotoSiembraUrl);
    } catch {
      // Si el lote tiene foto local, no se crea en backend hasta subir la foto correctamente.
      throw new Error('No se pudo subir la foto local del lote. Se mantiene pendiente.');
    }
  }

  const idExistente = await buscarLoteServidorExistente(item);
  if (idExistente) {
    return idExistente;
  }

  const loteServidor = await crearLoteApi({
    id_productor: 1,
    id_producto: item.idProducto,
    nombre_lote: item.nombreLote,
    superficie: item.superficie,
    fecha_siembra: item.fechaSiembraIso,
    fecha_cosecha_est: item.fechaCosechaIso,
    rendimiento_estimado: item.rendimientoEstimado,
    precio_venta_est: item.precioVentaEstimado,
    foto_siembra_url: fotoSiembraUrl,
    ubicacion: item.ubicacion || 'No especificada',
    variedad: item.tipoCultivo || null,
  });

  const idServidor = Number(loteServidor.id_lote);
  if (!Number.isFinite(idServidor) || idServidor <= 0) {
    throw new Error('El backend no devolvio un id_lote valido.');
  }

  return idServidor;
}

export async function sincronizarSiembrasPendientes(): Promise<{
  procesados: number;
  sincronizados: number;
}> {
  if (syncEnCurso) {
    return { procesados: 0, sincronizados: 0 };
  }

  if (!(await hayConexionDisponible())) {
    return { procesados: 0, sincronizados: 0 };
  }

  syncEnCurso = true;

  try {
    const pendientes = await obtenerLotesPendientes();
    let sincronizados = 0;

    for (const item of pendientes) {
      try {
        const idServidor = await sincronizarLote(item);
        await marcarLoteSincronizado(item.idLocal, idServidor);
        sincronizados += 1;
        emitirEventoSincronizacion({
          tipo: 'LOTE_SINCRONIZADO',
          idLocal: item.idLocal,
          idServidor,
        });
      } catch {
        await marcarLotePendienteConError(item.idLocal);
      }
    }

    emitirEventoSincronizacion({
      tipo: 'SINCRONIZACION_COMPLETADA',
      procesados: pendientes.length,
      sincronizados,
    });

    return { procesados: pendientes.length, sincronizados };
  } finally {
    syncEnCurso = false;
  }
}

export async function registrarSiembraOfflineFirst(
  input: RegistrarSiembraInput
): Promise<RegistrarSiembraResultado> {
  const idLocal = await insertarLoteLocal({
    id_servidor: null,
    id_producto: input.productoDefaultId,
    nombre_lote: input.nombreLote,
    ubicacion: input.ubicacion,
    variedad: input.tipoCultivo,
    superficie: input.superficie,
    fecha_siembra: input.fechaSiembraIso,
    fecha_cosecha_est: input.fechaCosechaIso,
    rendimiento_estimado: input.rendimientoEstimado,
    precio_venta_est: input.precioVentaEstimado,
    foto_siembra_uri_local: input.fotoTerrenoUri ?? null,
    estado_sincronizacion: 'PENDIENTE',
  });

  void sincronizarSiembrasPendientes().catch((error) => {
    console.warn('No se pudo iniciar la sincronizacion en segundo plano:', error);
  });

  return {
    estado: 'PENDIENTE',
    idLocal,
  };
}

function manejarCambioAppState(nextState: AppStateStatus): void {
  if (nextState === 'active') {
    sincronizarSiembrasPendientes().catch((error) => {
      console.warn('Error al sincronizar siembras al volver a la app:', error);
    });
  }
}

export function iniciarSincronizacionAutomaticaSiembras(): void {
  if (!syncTimer) {
    syncTimer = setInterval(() => {
      sincronizarSiembrasPendientes().catch((error) => {
        console.warn('Error de sincronizacion periodica de siembras:', error);
      });
    }, SYNC_INTERVAL_MS);
  }

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', manejarCambioAppState);
  }

  if (!netInfoUnsubscribe) {
    netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        sincronizarSiembrasPendientes().catch((error) => {
          console.warn('Error al sincronizar siembras al volver internet:', error);
        });
      }
    });
  }

  sincronizarSiembrasPendientes().catch((error) => {
    console.warn('Error en sincronizacion inicial de siembras:', error);
  });
}

export function detenerSincronizacionAutomaticaSiembras(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
    netInfoUnsubscribe = null;
  }
}
