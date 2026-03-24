import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'agroconecta_lotes';
const LEGACY_WEB_KEY = 'agroconecta_web_lotes';

type LoteInsertInput = {
  id_servidor?: number | null;
  id_producto: number;
  nombre_lote: string;
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
  variedad: string | null;
  superficie: number | null;
  fecha_siembra: string;
  fecha_cosecha_est: string;
  rendimiento_estimado: number | null;
  precio_venta_est: number | null;
  foto_siembra_uri_local: string | null;
  estado_sincronizacion: string;
};

export async function obtenerLotesPendientesLocales(): Promise<LoteLocal[]> {
  const lotes = await leerLotes();
  return lotes.filter((lote) => lote.estado_sincronizacion !== 'SINCRONIZADO' || !lote.id_servidor);
}

export async function marcarLoteComoSincronizado(idLocal: number, idServidor: number): Promise<void> {
  const lotes = await leerLotes();
  const actualizados = lotes.map((lote) => {
    if (lote.id_local !== idLocal) return lote;
    return {
      ...lote,
      id_servidor: idServidor,
      estado_sincronizacion: 'SINCRONIZADO',
    };
  });

  await guardarLotes(actualizados);
}

async function leerLotes(): Promise<LoteLocal[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  if (json) {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? (parsed as LoteLocal[]) : [];
    } catch {
      return [];
    }
  }

  // Migracion simple para conservar datos creados previamente en web.
  const legacy = await AsyncStorage.getItem(LEGACY_WEB_KEY);
  if (!legacy) return [];

  try {
    const parsedLegacy = JSON.parse(legacy);
    const lotes = Array.isArray(parsedLegacy) ? (parsedLegacy as LoteLocal[]) : [];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lotes));
    return lotes;
  } catch {
    return [];
  }
}

async function guardarLotes(lotes: LoteLocal[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lotes));
}

export async function insertarLoteLocal(loteData: LoteInsertInput): Promise<number> {
  const lotes = await leerLotes();
  const siguienteId = lotes.length > 0 ? Math.max(...lotes.map((l) => l.id_local)) + 1 : 1;

  const nuevoLote: LoteLocal = {
    id_local: siguienteId,
    id_servidor: loteData.id_servidor ?? null,
    id_producto: loteData.id_producto,
    nombre_lote: loteData.nombre_lote,
    variedad: loteData.variedad ?? null,
    superficie: loteData.superficie,
    fecha_siembra: loteData.fecha_siembra,
    fecha_cosecha_est: loteData.fecha_cosecha_est,
    rendimiento_estimado: loteData.rendimiento_estimado,
    precio_venta_est: loteData.precio_venta_est,
    foto_siembra_uri_local: loteData.foto_siembra_uri_local ?? null,
    estado_sincronizacion: loteData.estado_sincronizacion ?? 'PENDIENTE',
  };

  await guardarLotes([nuevoLote, ...lotes]);
  return siguienteId;
}

export async function obtenerLotesLocales(): Promise<LoteLocal[]> {
  return leerLotes();
}

export async function actualizarLoteLocal(
  idLocal: number,
  cambios: Partial<Omit<LoteLocal, 'id_local'>>
): Promise<void> {
  const lotes = await leerLotes();
  const actualizados = lotes.map((lote) => {
    if (lote.id_local !== idLocal) return lote;
    return {
      ...lote,
      ...cambios,
    };
  });

  await guardarLotes(actualizados);
}

export async function actualizarLoteLocalPorServidor(
  idServidor: number,
  cambios: Partial<Omit<LoteLocal, 'id_local'>>
): Promise<void> {
  const lotes = await leerLotes();
  const actualizados = lotes.map((lote) => {
    if (lote.id_servidor !== idServidor) return lote;
    return {
      ...lote,
      ...cambios,
    };
  });

  await guardarLotes(actualizados);
}

export async function eliminarLoteLocal(idLocal: number): Promise<void> {
  const lotes = await leerLotes();
  const filtrados = lotes.filter((lote) => lote.id_local !== idLocal);
  await guardarLotes(filtrados);
}

export async function eliminarLoteLocalPorServidor(idServidor: number): Promise<void> {
  const lotes = await leerLotes();
  const filtrados = lotes.filter((lote) => lote.id_servidor !== idServidor);
  await guardarLotes(filtrados);
}
