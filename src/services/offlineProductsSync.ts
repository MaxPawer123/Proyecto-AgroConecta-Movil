import NetInfo from '@react-native-community/netinfo';

// DEPRECATED: Tabla de productos ya no se usa. Funciones mantienen interfaz para compatibilidad.

export type ProductoOffline = {
  idLocal: string;
  idLote: number | null;
  idProductor: number | null;
  nombre: string;
  categoria: string;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
};

export type SyncResult = {
  procesados: number;
  sincronizados: number;
};

async function hasInternetConnection(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

// No-op: tabla producto ya no existe
export async function guardarProductoLocal(): Promise<ProductoOffline> {
  const now = new Date().toISOString();
  return {
    idLocal: '',
    idLote: null,
    idProductor: null,
    nombre: '',
    categoria: '',
    synced: true,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  };
}

// No-op: tabla producto ya no existe
export async function listarProductosLocales(): Promise<ProductoOffline[]> {
  return [];
}

// No-op: tabla producto ya no existe
export async function sincronizarProductosPendientes(): Promise<SyncResult> {
  if (!(await hasInternetConnection())) {
    return { procesados: 0, sincronizados: 0 };
  }
  return { procesados: 0, sincronizados: 0 };
}

// No-op: tabla producto ya no existe
export function iniciarAutoSyncProductos(): void {
  // Deprecated - tabla producto no existe
}

// No-op: tabla producto ya no existe
export function detenerAutoSyncProductos(): void {
  // Deprecated - tabla producto no existe
}

// No-op: tabla producto ya no existe
export async function ejemploGuardarProductoYSync(): Promise<void> {
  // Deprecated - tabla producto no existe
}
