import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { crearLoteApi, obtenerOCrearProductoApi, subirFotoSiembraApi } from '@/src/services/api';
import { actualizarLoteLocal, insertarLoteLocal } from '@/src/services/database';

const STORAGE_QUEUE_KEY = 'agroconecta_siembras_queue_v1';
const SYNC_INTERVAL_MS = 25000;

type EstadoCola = 'PENDIENTE' | 'COMPLETADO';

type SiembraQueueItem = {
  id: string;
  idLocal: number;
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
  fotoTerrenoUri: string | null;
  estado: EstadoCola;
  intentos: number;
  ultimoError: string | null;
  createdAt: string;
  updatedAt: string;
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

let syncTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let syncEnCurso = false;

function crearIdCola(): string {
  return `siembra-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function leerColaSiembras(): Promise<SiembraQueueItem[]> {
  const contenido = await AsyncStorage.getItem(STORAGE_QUEUE_KEY);
  if (!contenido) return [];

  try {
    const parsed = JSON.parse(contenido);
    return Array.isArray(parsed) ? (parsed as SiembraQueueItem[]) : [];
  } catch {
    return [];
  }
}

async function guardarColaSiembras(items: SiembraQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(items));
}

async function agregarItemCola(item: SiembraQueueItem): Promise<void> {
  const cola = await leerColaSiembras();
  await guardarColaSiembras([item, ...cola]);
}

async function actualizarItemCola(id: string, cambios: Partial<SiembraQueueItem>): Promise<void> {
  const cola = await leerColaSiembras();
  const actualizada = cola.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      ...cambios,
      updatedAt: new Date().toISOString(),
    };
  });

  await guardarColaSiembras(actualizada);
}

async function prepararDatosServidor(item: SiembraQueueItem): Promise<{
  idProducto: number;
  fotoSiembraUrl: string | null;
}> {
  let idProducto = item.productoDefaultId;
  let fotoSiembraUrl: string | null = null;

  if (item.fotoTerrenoUri) {
    try {
      fotoSiembraUrl = await subirFotoSiembraApi(item.fotoTerrenoUri);
    } catch (error) {
      console.warn('No se pudo subir foto, se sincroniza el lote sin foto:', error);
    }
  }

  try {
    const producto = await obtenerOCrearProductoApi({
      nombre: item.tipoCultivo,
      categoria: item.categoriaProducto,
    });
    idProducto = producto.id_producto;
  } catch (error) {
    console.warn('No se pudo obtener/crear producto, se usa producto por defecto:', error);
  }

  return { idProducto, fotoSiembraUrl };
}

async function sincronizarItem(item: SiembraQueueItem): Promise<boolean> {
  try {
    const { idProducto, fotoSiembraUrl } = await prepararDatosServidor(item);

    const loteServidor = await crearLoteApi({
      id_productor: 1,
      id_producto: idProducto,
      nombre_lote: item.nombreLote,
      superficie: item.superficie,
      fecha_siembra: item.fechaSiembraIso,
      fecha_cosecha_est: item.fechaCosechaIso,
      rendimiento_estimado: item.rendimientoEstimado,
      precio_venta_est: item.precioVentaEstimado,
      foto_siembra_url: fotoSiembraUrl,
      ubicacion: item.ubicacion,
      variedad: item.tipoCultivo,
    });

    await actualizarLoteLocal(item.idLocal, {
      id_servidor: loteServidor.id_lote,
      id_producto: idProducto,
      estado_sincronizacion: 'SINCRONIZADO',
    });

    await actualizarItemCola(item.id, {
      estado: 'COMPLETADO',
      intentos: item.intentos + 1,
      ultimoError: null,
    });

    return true;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    await actualizarItemCola(item.id, {
      estado: 'PENDIENTE',
      intentos: item.intentos + 1,
      ultimoError: mensaje,
    });
    return false;
  }
}

export async function sincronizarSiembrasPendientes(): Promise<{
  procesados: number;
  sincronizados: number;
}> {
  if (syncEnCurso) {
    return { procesados: 0, sincronizados: 0 };
  }

  syncEnCurso = true;

  try {
    const cola = await leerColaSiembras();
    const pendientes = cola.filter((item) => item.estado === 'PENDIENTE');
    let sincronizados = 0;

    for (const item of pendientes) {
      const ok = await sincronizarItem(item);
      if (ok) sincronizados += 1;
    }

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
    variedad: input.tipoCultivo,
    superficie: input.superficie,
    fecha_siembra: input.fechaSiembraIso,
    fecha_cosecha_est: input.fechaCosechaIso,
    rendimiento_estimado: input.rendimientoEstimado,
    precio_venta_est: input.precioVentaEstimado,
    foto_siembra_uri_local: input.fotoTerrenoUri ?? null,
    estado_sincronizacion: 'PENDIENTE',
  });

  const ahora = new Date().toISOString();
  const itemCola: SiembraQueueItem = {
    id: crearIdCola(),
    idLocal,
    rubro: input.rubro,
    categoriaProducto: input.categoriaProducto,
    productoDefaultId: input.productoDefaultId,
    nombreLote: input.nombreLote,
    tipoCultivo: input.tipoCultivo,
    ubicacion: input.ubicacion,
    superficie: input.superficie,
    fechaSiembraIso: input.fechaSiembraIso,
    fechaCosechaIso: input.fechaCosechaIso,
    rendimientoEstimado: input.rendimientoEstimado,
    precioVentaEstimado: input.precioVentaEstimado,
    fotoTerrenoUri: input.fotoTerrenoUri ?? null,
    estado: 'PENDIENTE',
    intentos: 0,
    ultimoError: null,
    createdAt: ahora,
    updatedAt: ahora,
  };

  await agregarItemCola(itemCola);
  const sincronizado = await sincronizarItem(itemCola);

  return {
    estado: sincronizado ? 'COMPLETADO' : 'PENDIENTE',
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
}
