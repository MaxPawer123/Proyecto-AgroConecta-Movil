import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  crearLoteApi,
  crearGastoApi,
  obtenerLotesPorTipoCultivoApi,
  subirFotoSiembraApi,
} from '@/src/services/api';
import {
  insertarLoteLocal,
  obtenerGastosPendientesPorLoteLocal,
  marcarGastoComoSincronizado,
  actualizarCostoLocal,
} from '@/src/services/sqlite';
import {
  dividirCultivosSeleccionados,
  getDb,
  getLoteServerColumn,
  obtenerOInsertarProductoLocal,
  getCurrentProductorId,
} from './sqlite';

const SYNC_INTERVAL_MS = 30000;
const MAX_ITEMS_PER_SYNC = 10;

type EstadoCola = 'PENDIENTE' | 'COMPLETADO';

type LotePendiente = {
  idLocal: number;
  idServidor: number | null;
  idProductor: number;
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
  nombreLote: string;
  tipoCultivo: string;
  cultivos?: string[];
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
let conexionEstablecida = false;
const listenersSincronizacion = new Set<(evento: EventoSincronizacionSiembra) => void>();

function emitirEventoSincronizacion(evento: EventoSincronizacionSiembra): void {
  for (const listener of listenersSincronizacion) {
    try {
      listener(evento);
    } catch (error) {
      console.warn('Listener de sincronizacion fallo:', error);
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

async function verificarBackendDisponible(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    if (!state.isConnected || state.isInternetReachable === false) {
      return false;
    }
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!baseUrl) return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  } catch {
    return false;
  }
}

async function hayConexionDisponible(): Promise<boolean> {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected === true && netInfo.isInternetReachable === true;
}

function mapRowToPendiente(row: Record<string, unknown>): LotePendiente {
  const idServidorRaw = row.id_lote ?? row.id_servidor;
  const tipoCultivoRelacional = String(row.tipo_cultivo_rel ?? '').trim();
  const idProductorRaw = Number(row.id_productor);
  return {
    idLocal: Number(row.id_local),
    idServidor: idServidorRaw === null || idServidorRaw === undefined ? null : Number(idServidorRaw),
    idProductor: idProductorRaw > 0 ? idProductorRaw : 1,
    nombreLote: String(row.nombre_lote ?? ''),
    ubicacion: String(row.ubicacion ?? ''),
    tipoCultivo: tipoCultivoRelacional,
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
  const idProductorActual = await getCurrentProductorId().catch(() => 0);
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
      SELECT
        l.*, 
        COALESCE(
          (
            SELECT GROUP_CONCAT(p.nombre, ', ')
            FROM LOTE_PRODUCTO lp
            JOIN PRODUCTO p ON p.id_producto = lp.id_producto
            WHERE lp.id_lote = l.id_local
          ),
          ''
        ) AS tipo_cultivo_rel
      FROM lote l
      WHERE (estado_sincronizacion <> 'SINCRONIZADO' OR ${serverColumn} IS NULL)
        AND l.id_productor = ?
      ORDER BY id_local ASC
      LIMIT ?
    `,
    idProductorActual,
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

async function buscarLoteServidorExistente(item: LotePendiente): Promise<number | null> {
  try {
    const lotesServidor = await obtenerLotesPorTipoCultivoApi(item.tipoCultivo);
    const encontrado = lotesServidor.find((lote: any) => {
      const coincideNombre = (lote.nombre_lote || '').toLowerCase() === item.nombreLote.toLowerCase();
      const coincideSuperficie = Math.abs(Number(lote.superficie) - Number(item.superficie)) < 0.01;
      return coincideNombre && coincideSuperficie;
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
    } catch (error) {
      throw new Error('No se pudo subir la foto local del lote.');
    }
  }
  const idExistente = await buscarLoteServidorExistente(item);
  if (idExistente) {
    return idExistente;
  }
  const loteServidor = await crearLoteApi({
    id_productor: item.idProductor,
    tipo_cultivo: item.tipoCultivo,
    nombre_lote: item.nombreLote,
    superficie: item.superficie,
    fecha_siembra: item.fechaSiembraIso,
    fecha_cosecha_est: item.fechaCosechaIso,
    rendimiento_estimado: item.rendimientoEstimado,
    precio_venta_est: item.precioVentaEstimado,
    foto_siembra_url: fotoSiembraUrl,
    ubicacion: item.ubicacion || 'No especificada',
  });
  const idServidor = Number(loteServidor.id_lote);
  if (!Number.isFinite(idServidor) || idServidor <= 0) {
    throw new Error('El backend no devolvio un id_lote valido.');
  }
  return idServidor;
}

// ============================================
// SINCRONIZAR GASTOS PENDIENTES DE UN LOTE
// ============================================
async function sincronizarGastosLocales(idLocal: number, idServidor: number): Promise<void> {
  const gastosPendientes = await obtenerGastosPendientesPorLoteLocal(idLocal);
  if (gastosPendientes.length === 0) return;

  console.log(`💰 Sincronizando ${gastosPendientes.length} gastos del lote ${idLocal}...`);

  for (const gasto of gastosPendientes) {
    try {
      const nuevoGasto = await crearGastoApi({
        id_lote: idServidor,
        categoria: gasto.categoria,
        descripcion: gasto.descripcion ?? undefined,
        cantidad: gasto.cantidad,
        costo_unitario: gasto.costo_unitario,
        tipo_costo: gasto.tipo_costo,
        modalidad_pago: gasto.modalidad_pago,
      });

      const idGasto = Number(nuevoGasto.id_gasto);
      if (!Number.isFinite(idGasto) || idGasto <= 0) {
        throw new Error('El backend devolvió un id_gasto inválido.');
      }

      await marcarGastoComoSincronizado(gasto.id_local, idGasto);
      console.log(`✅ Gasto ${gasto.id_local} sincronizado → ID servidor: ${idGasto}`);
    } catch (error) {
      console.warn(`❌ Error sincronizando gasto ${gasto.id_local}:`, error);
      await actualizarCostoLocal(gasto.id_local, {
        ultimo_error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function sincronizarSiembrasPendientes(): Promise<{
  procesados: number;
  sincronizados: number;
}> {
  const hayConexion = await hayConexionDisponible();
  if (!hayConexion) {
    if (!conexionEstablecida) {
      console.log('📡 Sin conexión a internet. Los lotes se guardarán localmente y se sincronizarán cuando haya red.');
    }
    conexionEstablecida = false;
    return { procesados: 0, sincronizados: 0 };
  }

  const backendActivo = await verificarBackendDisponible();
  if (!backendActivo) {
    console.log('🖥️ Backend no disponible. Los lotes se sincronizarán cuando el servidor esté activo.');
    return { procesados: 0, sincronizados: 0 };
  }

  if (!conexionEstablecida) {
    console.log('✅ Conexión a internet y backend detectados. Iniciando sincronización...');
    conexionEstablecida = true;
  }

  if (syncEnCurso) return { procesados: 0, sincronizados: 0 };
  syncEnCurso = true;

  try {
    const pendientes = await obtenerLotesPendientes();
    if (pendientes.length === 0) return { procesados: 0, sincronizados: 0 };

    console.log(`🔄 Sincronizando ${pendientes.length} lotes pendientes...`);
    let sincronizados = 0;

    for (const item of pendientes) {
      try {
        console.log(`📤 Subiendo lote ${item.idLocal}...`);
        const idServidor = await sincronizarLote(item);
        await marcarLoteSincronizado(item.idLocal, idServidor);

        // Sincronizar gastos asociados
        try {
          await sincronizarGastosLocales(item.idLocal, idServidor);
        } catch (error) {
          console.warn('Error al sincronizar gastos del lote:', error);
        }

        sincronizados++;
        console.log(`✅ Lote ${item.idLocal} sincronizado → ID servidor: ${idServidor}`);
        emitirEventoSincronizacion({
          tipo: 'LOTE_SINCRONIZADO',
          idLocal: item.idLocal,
          idServidor,
        });
      } catch (error) {
        console.warn(`⚠️ Error en lote ${item.idLocal}:`, error);
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
  const db = await getDb();
  const idProductorActual = await getCurrentProductorId();

  const cultivos = Array.isArray(input.cultivos) && input.cultivos.length > 0
    ? input.cultivos
    : dividirCultivosSeleccionados(input.tipoCultivo);

  const idProductos: number[] = [];
  for (const cultivo of cultivos) {
    const idProducto = await obtenerOInsertarProductoLocal(db, cultivo, 'General', input.rubro);
    idProductos.push(idProducto);
  }

  const idLocal = await insertarLoteLocal({
    id_servidor: null,
    id_productos: idProductos,
    nombre_lote: input.nombreLote,
    ubicacion: input.ubicacion,
    superficie: input.superficie,
    fecha_siembra: input.fechaSiembraIso,
    fecha_cosecha_est: input.fechaCosechaIso,
    rendimiento_estimado: input.rendimientoEstimado,
    precio_venta_est: input.precioVentaEstimado,
    foto_siembra_uri_local: input.fotoTerrenoUri ?? null,
    estado_sincronizacion: 'PENDIENTE',
  });

  console.log(`💾 Lote guardado LOCALMENTE con ID: ${idLocal} (Productor: ${idProductorActual})`);

  const hayConexion = await hayConexionDisponible();
  if (hayConexion) {
    setTimeout(() => {
      sincronizarSiembrasPendientes().catch(() => {});
    }, 1000);
  } else {
    console.log('📡 Sin conexión. El lote se sincronizará automáticamente cuando haya internet.');
  }

  return {
    estado: 'PENDIENTE',
    idLocal,
  };
}

function manejarCambioAppState(nextState: AppStateStatus): void {
  if (nextState === 'active') {
    sincronizarSiembrasPendientes().catch(() => {});
  }
}

export function iniciarSincronizacionAutomaticaSiembras(): void {
  if (!syncTimer) {
    syncTimer = setInterval(() => {
      sincronizarSiembrasPendientes().catch(() => {});
    }, SYNC_INTERVAL_MS);
  }

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', manejarCambioAppState);
  }

  if (!netInfoUnsubscribe) {
    netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('🌐 Conexión a internet detectada. Sincronizando...');
        sincronizarSiembrasPendientes().catch(() => {});
      } else {
        console.log('📡 Sin conexión a internet. Esperando...');
      }
    });
  }

  sincronizarSiembrasPendientes().catch(() => {});
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