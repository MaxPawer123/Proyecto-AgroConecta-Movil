import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getDb } from '../../core/database/sqlite.config';
import { verificarBackendActivo } from '../../core/network/apiClient';
import {
  actualizarCostoLocal,
  marcarGastoComoSincronizado,
  obtenerGastosPendientesPorLoteLocal,
  obtenerGastosHuérfanosPendientes,
} from '../gastos/gastos.repository';
import {
  crearLoteApi,
  obtenerLotesPorTipoCultivoApi,
  subirFotoSiembraApi,
} from '../../core/network/api/lotes';
import { sincronizarProductosApi } from '../../core/network/api/productos';
import { crearGastoApi, obtenerGastosPorLoteApi } from '../../core/network/api/gastos';
import { registrarProduccionLoteApi } from '../../core/network/api/produccion';
import {
  obtenerBorradorProduccionLocal,
  marcarProduccionComoSincronizada,
  obtenerProduccionesHuerfanasPendientes,
} from '../costos/costos.repository';
import {
  determinarCategoriaCultivo,
  dividirCultivosSeleccionados,
  getLoteServerColumn,
  insertarLoteLocal,
  marcarLoteComoSincronizado,
  obtenerLotesPendientesLocales,
  obtenerOInsertarProductoLocal,
  type LoteLocal,
} from './siembra.repository';
import { getCurrentProductorId, sincronizarUsuarioYProductorBackend } from '../auth/auth.repository';
import { syncLocalDataToCloud } from '../../services/syncService';

const SYNC_INTERVAL_MS = 30000;
const MAX_ITEMS_PER_SYNC = 10;

type EstadoCola = 'PENDIENTE' | 'COMPLETADO';

export type RegistrarSiembraInput = {
  rubro: 'QUINUA' | 'HORTALIZA' | 'PAPA';
  nombreLote: string;
  tipoCultivo: string;
  cultivos?: string[];
  ubicacion: string;
  superficie: number;
  fechaSiembraIso: string;
  fechaCosechaIso: string;
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
const produccionesEnSync = new Set<number>();

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

async function hayConexionDisponible(): Promise<boolean> {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected === true && netInfo.isInternetReachable === true;
}

function mapRowToPendiente(row: LoteLocal): LoteLocal {
  return row;
}

async function obtenerLotesPendientes(): Promise<LoteLocal[]> {
  const rows = await obtenerLotesPendientesLocales();
  return rows.slice(0, MAX_ITEMS_PER_SYNC).map(mapRowToPendiente);
}

async function marcarLoteSincronizado(idLocal: number, idServidor: number): Promise<void> {
  await marcarLoteComoSincronizado(idLocal, idServidor);
}

async function buscarLoteServidorExistente(item: LoteLocal): Promise<number | null> {
  try {
    const lotesServidor = await obtenerLotesPorTipoCultivoApi(item.tipo_cultivo);
    const encontrado = lotesServidor.find((lote: any) => {
      const coincideNombre = (lote.nombre_lote || '').toLowerCase() === item.nombre_lote.toLowerCase();
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

async function sincronizarLote(item: LoteLocal, idProductorRecuperado: number): Promise<number> {
  let fotoSiembraUrl = item.foto_siembra_uri_local;
  if (fotoSiembraUrl && !fotoSiembraUrl.startsWith('http')) {
    try {
      fotoSiembraUrl = await subirFotoSiembraApi(fotoSiembraUrl);
    } catch {
      throw new Error('No se pudo subir la foto local del lote.');
    }
  }

  const idExistente = await buscarLoteServidorExistente(item);
  if (idExistente) {
    return idExistente;
  }

  // Consulta adicional a SQLite para obtener los productos_ids
  const db = await getDb();
  const rows = await db.getAllAsync<{ id_producto: number; nombre: string; rubro: string }>(
    `SELECT p.id_producto, p.nombre, p.rubro 
     FROM LOTE_PRODUCTO lp 
     JOIN PRODUCTO p ON lp.id_producto = p.id_producto 
     WHERE lp.id_lote = ?`,
    item.id_local
  );
  const productos_ids = rows.map((row) => Number(row.id_producto));
  const productos = rows.map((row) => {
    let rubroFinal = row.rubro;
    if (!rubroFinal || rubroFinal === 'General' || rubroFinal === '') {
      const resolved = determinarCategoriaCultivo(item.tipo_cultivo) || determinarCategoriaCultivo(row.nombre);
      if (resolved) {
        rubroFinal = resolved;
      }
    }
    return {
      nombre: row.nombre,
      rubro: rubroFinal || 'QUINUA',
    };
  });

  const payload = {
    id_productor: idProductorRecuperado,
    tipo_cultivo: item.tipo_cultivo,
    nombre_lote: item.nombre_lote,
    superficie: item.superficie ?? 0,
    fecha_siembra: item.fecha_siembra,
    fecha_cosecha_est: item.fecha_cosecha_est,
    fecha_cosecha_real: item.fecha_cosecha_real,
    foto_siembra_url: fotoSiembraUrl,
    ubicacion: item.ubicacion || 'No especificada',
    productos_ids,
    productos,
  };

  console.log('[API Lotes] Payload a enviar...', JSON.stringify(payload, null, 2));

  const loteServidor = await crearLoteApi(payload);

  const idServidor = Number(loteServidor.id_lote);
  if (!Number.isFinite(idServidor) || idServidor <= 0) {
    throw new Error('El backend no devolvio un id_lote valido.');
  }

  return idServidor;
}

async function sincronizarGastosLocales(idLocal: number, idServidor: number): Promise<void> {
  const gastosPendientes = await obtenerGastosPendientesPorLoteLocal(idLocal);
  if (gastosPendientes.length === 0) return;

  console.log(`💰 Sincronizando ${gastosPendientes.length} gastos del lote ${idLocal}...`);

  for (const gasto of gastosPendientes) {
    try {
      const nuevoGasto = await crearGastoApi({
        id_local: gasto.id_local,
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

      await marcarGastoComoSincronizado(gasto.id_local, idGasto, idServidor);
      console.log(`✅ Gasto ${gasto.id_local} sincronizado → ID servidor: ${idGasto}`);
    } catch (error) {
      console.warn(`❌ Error sincronizando gasto ${gasto.id_local}:`, error);
      await actualizarCostoLocal(gasto.id_local, {
        ultimo_error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function sincronizarProduccionLocal(idLoteLocal: number, idLoteServidor: number): Promise<void> {
  const produccionLocal = await obtenerBorradorProduccionLocal({ idLoteLocal });
  if (!produccionLocal) return;

  if (produccionLocal.sincronizado || produccionLocal.id_produccion) {
    return;
  }

  // Prevenir envío doble si ya está en vuelo
  if (produccionesEnSync.has(produccionLocal.id_local)) {
    console.log(`⚠️ Producción local ${produccionLocal.id_local} ya está en sincronización.`);
    return;
  }

  produccionesEnSync.add(produccionLocal.id_local);

  try {
    console.log(`🌾 Sincronizando produccion del lote local ${idLoteLocal}...`);

    const resultado = await registrarProduccionLoteApi({
      id_local: produccionLocal.id_local,
      id_lote: idLoteServidor,
      fecha_registro: produccionLocal.fecha_registro,
      cantidad_obtenida: produccionLocal.cantidad_obtenida,
      precio_venta: produccionLocal.precio_venta,
    });

    const idProduccion = Number(resultado.id_produccion);
    if (!Number.isFinite(idProduccion) || idProduccion <= 0) {
      throw new Error('El backend devolvio un id_produccion invalido.');
    }

    await marcarProduccionComoSincronizada(produccionLocal.id_local, idProduccion);
    console.log(`✅ Produccion del lote local ${idLoteLocal} sincronizada → ID servidor: ${idProduccion}`);
  } catch (error) {
    console.error(`❌ Error al sincronizar producción local ${produccionLocal.id_local}:`, error);
    throw error;
  } finally {
    produccionesEnSync.delete(produccionLocal.id_local);
  }
}

async function sincronizarGastosHuerfanosLocales(): Promise<void> {
  const huerfanos = await obtenerGastosHuérfanosPendientes();
  if (huerfanos.length === 0) return;

  console.log(`💰 Sincronizando ${huerfanos.length} gastos huérfanos...`);

  for (const { gasto, idLoteServidor } of huerfanos) {
    if (!idLoteServidor) continue;
    try {
      const nuevoGasto = await crearGastoApi({
        id_local: gasto.id_local,
        id_lote: idLoteServidor,
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

      await marcarGastoComoSincronizado(gasto.id_local, idGasto, idLoteServidor);
      console.log(`✅ Gasto huérfano ${gasto.id_local} sincronizado → ID servidor: ${idGasto}`);
    } catch (error) {
      console.warn(`❌ Error sincronizando gasto huérfano ${gasto.id_local}:`, error);
      await actualizarCostoLocal(gasto.id_local, {
        ultimo_error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function sincronizarProduccionesHuerfanasLocales(): Promise<void> {
  const huerfanas = await obtenerProduccionesHuerfanasPendientes();
  if (huerfanas.length === 0) return;

  console.log(`🌾 Sincronizando ${huerfanas.length} producciones huérfanas...`);

  for (const { produccion, idLoteServidor } of huerfanas) {
    if (!idLoteServidor) continue;
    if (produccion.sincronizado || produccion.id_produccion) continue;

    // Prevenir envío doble si ya está en vuelo
    if (produccionesEnSync.has(produccion.id_local)) {
      console.log(`⚠️ Producción huérfana ${produccion.id_local} ya está en sincronización.`);
      continue;
    }

    produccionesEnSync.add(produccion.id_local);

    try {
      const resultado = await registrarProduccionLoteApi({
        id_local: produccion.id_local,
        id_lote: idLoteServidor,
        fecha_registro: produccion.fecha_registro,
        cantidad_obtenida: produccion.cantidad_obtenida,
        precio_venta: produccion.precio_venta,
      });

      const idProduccion = Number(resultado.id_produccion);
      if (!Number.isFinite(idProduccion) || idProduccion <= 0) {
        throw new Error('El backend devolvió un id_produccion inválido.');
      }

      await marcarProduccionComoSincronizada(produccion.id_local, idProduccion);
      console.log(`✅ Producción huérfana ${produccion.id_local} sincronizada → ID servidor: ${idProduccion}`);
    } catch (error) {
      console.warn(`❌ Error sincronizando producción huérfana ${produccion.id_local}:`, error);
    } finally {
      produccionesEnSync.delete(produccion.id_local);
    }
  }
}

export async function sincronizarCatálogoProductos(): Promise<void> {
  try {
    const db = await getDb();
    // Leer TODOS los registros de la tabla local PRODUCTO en SQLite
    const localProductos = await db.getAllAsync<{
      id_producto: number;
      nombre: string;
      rubro: string;
      sincronizado: number;
    }>('SELECT id_producto, nombre, rubro, sincronizado FROM PRODUCTO');

    if (localProductos.length === 0) {
      console.log('📦 El catálogo de productos local está vacío. No hay nada que sincronizar.');
      return;
    }

    const productosParaSincronizar = localProductos.map((p) => {
      let rubroFinal = p.rubro;
      if (!rubroFinal || rubroFinal === 'General' || rubroFinal === '') {
        const resolved = determinarCategoriaCultivo(p.nombre);
        if (resolved) {
          rubroFinal = resolved;
        }
      }
      return {
        id_producto: Number(p.id_producto),
        nombre: p.nombre,
        rubro: rubroFinal || '',
        sincronizado: p.sincronizado === 1,
      };
    });

    console.log(`📤 Sincronizando catálogo local de ${productosParaSincronizar.length} productos con el servidor...`);
    await sincronizarProductosApi(productosParaSincronizar);
    console.log('✅ Catálogo de productos sincronizado exitosamente.');
  } catch (error) {
    console.error('❌ Error al sincronizar el catálogo de productos:', error);
    throw error;
  }
}

export async function sincronizarSiembrasPendientes(): Promise<{
  procesados: number;
  sincronizados: number;
}> {
  if (syncEnCurso) return { procesados: 0, sincronizados: 0 };
  syncEnCurso = true;

  try {
    const hayConexion = await hayConexionDisponible();
    if (!hayConexion) {
      if (conexionEstablecida) {
        console.log('📡 Sin conexión a internet. Los lotes se guardarán localmente y se sincronizarán cuando haya red.');
      }
      conexionEstablecida = false;
      return { procesados: 0, sincronizados: 0 };
    }

    const backendActivo = await verificarBackendActivo();
    if (!backendActivo) {
      console.log('🖥️ Backend no disponible. Los lotes se sincronizarán cuando el servidor esté activo.');
      return { procesados: 0, sincronizados: 0 };
    }

    if (!conexionEstablecida) {
      console.log('✅ Conexión a internet y backend detectados. Iniciando sincronización...');
      conexionEstablecida = true;
    }

    // 0. Sincronizar catálogo de productos ANTES de lotes, gastos o producciones
    try {
      await sincronizarCatálogoProductos();
    } catch (error) {
      console.warn('⚠️ Sincronización de catálogo falló. Abortando sincronización de siembras para evitar errores de llave foránea.');
      return { procesados: 0, sincronizados: 0 };
    }

    // 1. Sincronizar usuario local si no está sincronizado
    try {
      await sincronizarUsuarioYProductorBackend();
    } catch (error) {
      console.warn('⚠️ Error intentando sincronizar usuario con el servidor:', error);
    }

    // RECUPERAR EL ID DEL PRODUCTOR / COMPROBAR SESION ACTIVA
    let idProductorRecuperado: number | null = null;
    try {
      idProductorRecuperado = await getCurrentProductorId();
    } catch (error) {
      console.log('Sincronización abortada silenciosamente: no hay sesión activa');
      return { procesados: 0, sincronizados: 0 };
    }

    if (!idProductorRecuperado) {
      console.log('Sincronización abortada silenciosamente: id_productor es nulo');
      return { procesados: 0, sincronizados: 0 };
    }

    const pendientes = await obtenerLotesPendientes();
    let sincronizados = 0;

    if (pendientes.length > 0) {
      console.log(`🔄 Sincronizando ${pendientes.length} lotes pendientes...`);
      for (const item of pendientes) {
        try {
          console.log(`📤 Subiendo lote ${item.id_local}...`);
          const idServidor = await sincronizarLote(item, idProductorRecuperado);
          await marcarLoteSincronizado(item.id_local, idServidor);

          try {
            await sincronizarGastosLocales(item.id_local, idServidor);
          } catch (error) {
            console.warn('Error al sincronizar gastos del lote:', error);
          }

          try {
            await sincronizarProduccionLocal(item.id_local, idServidor);
          } catch (error) {
            console.warn('Error al sincronizar produccion del lote:', error);
          }

          sincronizados++;
          console.log(`✅ Lote ${item.id_local} sincronizado → ID servidor: ${idServidor}`);
          emitirEventoSincronizacion({
            tipo: 'LOTE_SINCRONIZADO',
            idLocal: item.id_local,
            idServidor,
          });
        } catch (error) {
          console.warn(`⚠️ Error en lote ${item.id_local}:`, error);
        }
      }
    }

    // Sincronizar gastos y producciones huérfanas
    try {
      await sincronizarGastosHuerfanosLocales();
    } catch (error) {
      console.warn('Error al sincronizar gastos huérfanos:', error);
    }

    try {
      await sincronizarProduccionesHuerfanasLocales();
    } catch (error) {
      console.warn('Error al sincronizar producciones huérfanas:', error);
    }

    if (pendientes.length > 0 || sincronizados > 0) {
      emitirEventoSincronizacion({
        tipo: 'SINCRONIZACION_COMPLETADA',
        procesados: pendientes.length,
        sincronizados,
      });
    }

    return { procesados: pendientes.length, sincronizados };
  } finally {
    syncEnCurso = false;
  }
}


export async function registrarSiembraOfflineFirst(
  input: RegistrarSiembraInput
): Promise<RegistrarSiembraResultado> {
  const db = await getDb();
  const cultivos = Array.isArray(input.cultivos) && input.cultivos.length > 0
    ? input.cultivos
    : dividirCultivosSeleccionados(input.tipoCultivo);

  const idProductos: number[] = [];
  for (const cultivo of cultivos) {
    const idProducto = await obtenerOInsertarProductoLocal(db, cultivo, input.rubro);
    idProductos.push(idProducto);
  }

  const idLocal = await insertarLoteLocal({
    id_servidor: null,
    id_productos: idProductos,
    tipo_cultivo: input.tipoCultivo,
    nombre_lote: input.nombreLote,
    ubicacion: input.ubicacion,
    superficie: input.superficie,
    fecha_siembra: input.fechaSiembraIso,
    fecha_cosecha_est: input.fechaCosechaIso,
    foto_siembra_uri_local: input.fotoTerrenoUri ?? null,
    sincronizado: 0,
  });

  console.log(`💾 Lote guardado LOCALMENTE con ID: ${idLocal}`);

  // Disparar sincronizaciones en segundo plano de manera no bloqueante
  setTimeout(() => {
    sincronizarSiembrasPendientes().catch(() => {});
    syncLocalDataToCloud().catch(() => {});
  }, 1000);

  return {
    estado: 'PENDIENTE',
    idLocal,
  };
}

function manejarCambioAppState(nextState: AppStateStatus): void {
  if (nextState === 'active') {
    sincronizarSiembrasPendientes().catch(() => {});
    syncLocalDataToCloud().catch(() => {});
  }
}

export function iniciarSincronizacionAutomaticaSiembras(): void {
  if (!syncTimer) {
    syncTimer = setInterval(() => {
      sincronizarSiembrasPendientes().catch(() => {});
      syncLocalDataToCloud().catch(() => {});
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
        syncLocalDataToCloud().catch(() => {});
      } else {
        console.log('📡 Sin conexión a internet. Esperando...');
      }
    });
  }

  sincronizarSiembrasPendientes().catch(() => {});
  syncLocalDataToCloud().catch(() => {});
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

export async function descargarDatosServidorALocal(): Promise<void> {
  const hayConexion = await hayConexionDisponible();
  if (!hayConexion) return;

  const backendActivo = await verificarBackendActivo();
  if (!backendActivo) return;

  const db = await getDb();
  let idProductor: number | null = null;
  try {
    idProductor = await getCurrentProductorId();
  } catch {
    return;
  }
  if (!idProductor) return;

  const tiposCultivo = ['QUINUA', 'PAPA', 'HORTALIZA'];
  const serverLotes: any[] = [];
  
  for (const tipo of tiposCultivo) {
    try {
      const lotes = await obtenerLotesPorTipoCultivoApi(tipo);
      if (Array.isArray(lotes)) {
        serverLotes.push(...lotes.map((l: any) => ({ ...l, rubro_categoria: tipo })));
      }
    } catch (e) {
      console.warn(`No se pudieron obtener lotes para el tipo ${tipo}:`, e);
    }
  }

  const serverColumn = await getLoteServerColumn();

  for (const sl of serverLotes) {
    const idLoteServidor = Number(sl.id_lote);
    if (!idLoteServidor) continue;

    const loteLocalExistente = await db.getFirstAsync<any>(
      `SELECT id_local FROM lote WHERE ${serverColumn} = ?`,
      idLoteServidor
    );

    let idLoteLocal = loteLocalExistente?.id_local;

    if (!idLoteLocal) {
      const lotePorNombre = await db.getFirstAsync<any>(
        `SELECT id_local FROM lote WHERE lower(nombre_lote) = lower(?) AND id_productor = ? AND ${serverColumn} IS NULL`,
        sl.nombre_lote.trim(),
        idProductor
      );

      if (lotePorNombre) {
        idLoteLocal = lotePorNombre.id_local;
        await db.runAsync(
          `UPDATE lote SET ${serverColumn} = ?, sincronizado = 1 WHERE id_local = ?`,
          idLoteServidor,
          idLoteLocal
        );
      } else {
        const resultInsert = await db.runAsync(
          `INSERT INTO lote (
            ${serverColumn},
            id_productor,
            nombre_lote,
            ubicacion,
            superficie,
            fecha_siembra,
            fecha_cosecha_est,
            fecha_cosecha_real,
            sincronizado,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          idLoteServidor,
          idProductor,
          sl.nombre_lote,
          sl.ubicacion || null,
          sl.superficie || null,
          sl.fecha_siembra || new Date().toISOString(),
          sl.fecha_cosecha_est || null,
          sl.fecha_cosecha_real || null,
          1,
          sl.created_at || new Date().toISOString(),
          sl.updated_at || new Date().toISOString()
        );
        idLoteLocal = Number(resultInsert.lastInsertRowId);

        const cultivos = dividirCultivosSeleccionados(sl.tipo_cultivo || '');
        for (const cultivo of cultivos) {
          const categoriaResuelta = sl.rubro_categoria || determinarCategoriaCultivo(cultivo);
          const idProducto = await obtenerOInsertarProductoLocal(db, cultivo, categoriaResuelta);
          await db.runAsync(
            'INSERT OR IGNORE INTO LOTE_PRODUCTO (id_lote, id_producto) VALUES (?, ?)',
            idLoteLocal,
            idProducto
          );
        }
      }
    }

    try {
      const serverGastos = await obtenerGastosPorLoteApi(idLoteServidor);
      if (Array.isArray(serverGastos)) {
        for (const sg of serverGastos) {
          const idGastoServidor = Number(sg.id_gasto);
          if (!idGastoServidor) continue;

          const gastoLocal = await db.getFirstAsync<any>(
            `SELECT id_local FROM gasto_lote WHERE id_gasto = ?`,
            idGastoServidor
          );

          if (!gastoLocal) {
            const gastoEquivalente = await db.getFirstAsync<any>(
              `SELECT id_local FROM gasto_lote 
               WHERE (id_lote_local = ? OR id_lote_servidor = ?) 
                 AND lower(categoria) = lower(?) 
                 AND cantidad = ? 
                 AND costo_unitario = ? 
                 AND sincronizado = 0`,
              idLoteLocal,
              idLoteServidor,
              sg.categoria.trim(),
              Number(sg.cantidad),
              Number(sg.costo_unitario)
            );

            if (gastoEquivalente) {
              await db.runAsync(
                `UPDATE gasto_lote SET id_gasto = ?, sincronizado = 1, id_lote_servidor = ?, updated_at = ? WHERE id_local = ?`,
                idGastoServidor,
                idLoteServidor,
                new Date().toISOString(),
                gastoEquivalente.id_local
              );
            } else {
              const nowStr = new Date().toISOString();
              await db.runAsync(
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
                  created_at,
                  updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                idGastoServidor,
                idLoteLocal,
                idLoteServidor,
                sg.categoria,
                sg.descripcion || null,
                Number(sg.cantidad),
                Number(sg.costo_unitario),
                Number(sg.monto_total || (Number(sg.cantidad) * Number(sg.costo_unitario))),
                sg.tipo_costo || 'VARIABLE',
                sg.modalidad_pago || 'NA',
                sg.fecha_gasto || nowStr.split('T')[0],
                1,
                nowStr,
                nowStr
              );
            }
          }
        }
      }
    } catch (e) {
      console.warn(`No se pudieron obtener gastos para el lote ${idLoteServidor}:`, e);
    }
  }
}
