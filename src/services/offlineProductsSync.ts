import NetInfo from '@react-native-community/netinfo';
import { getDb } from './sqlite';
import { obtenerProductosPorCategoriaApi, type ProductoApi } from './api';

const DEFAULT_INTERVAL_MS = 10000;

type ProductoInput = {
  nombre: string;
  categoria: string;
  id_lote?: number | null;
  id_productor?: number | null;
};

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

let timer: ReturnType<typeof setInterval> | null = null;
let netListenerUnsubscribe: (() => void) | null = null;
const CATEGORIAS_SYNC = ['Quinua', 'Grano', 'Hortaliza', 'Tuberculo'] as const;

function mapProducto(row: Record<string, unknown>): ProductoOffline {
  const now = new Date().toISOString();
  const idLote = row.id_lote == null ? null : Number(row.id_lote);
  const idProductor = row.id_productor == null ? null : Number(row.id_productor);
  return {
    idLocal: String(row.id_producto ?? ''),
    idLote: Number.isFinite(idLote) ? idLote : null,
    idProductor: Number.isFinite(idProductor) ? idProductor : null,
    nombre: String(row.nombre ?? ''),
    categoria: String(row.categoria ?? ''),
    synced: true,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  };
}

async function hasInternetConnection(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export async function guardarProductoLocal(input: ProductoInput): Promise<ProductoOffline> {
  const nombre = input.nombre.trim();
  const categoria = input.categoria.trim();

  if (!nombre || !categoria) {
    throw new Error('Nombre y categoria son obligatorios.');
  }

  const db = await getDb();
  await db.runAsync(
    `
      INSERT INTO producto (id_lote, id_productor, nombre, categoria, unidad_medida_base)
      VALUES (?, ?, ?, ?, ?)
    `,
    input.id_lote ?? null,
    input.id_productor ?? null,
    nombre,
    categoria,
    'Kg'
  );

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `
      SELECT *
      FROM producto
      WHERE nombre = ? AND categoria = ?
      ORDER BY id_producto DESC
      LIMIT 1
    `,
    nombre,
    categoria
  );

  return mapProducto(row ?? { nombre, categoria, id_producto: '' });
}

export async function listarProductosLocales(): Promise<ProductoOffline[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM producto ORDER BY id_producto DESC'
  );

  return rows.map(mapProducto);
}

// Sin tabla de cola de productos, no hay pendientes que sincronizar localmente.
export async function sincronizarProductosPendientes(): Promise<SyncResult> {
  if (!(await hasInternetConnection())) {
    return { procesados: 0, sincronizados: 0 };
  }

  const resultados = await Promise.allSettled(
    CATEGORIAS_SYNC.map((categoria) => obtenerProductosPorCategoriaApi(categoria))
  );

  const productos = new Map<number, ProductoApi>();
  for (const resultado of resultados) {
    if (resultado.status !== 'fulfilled' || !Array.isArray(resultado.value)) continue;
    for (const producto of resultado.value) {
      const id = Number(producto.id_producto);
      if (!id || !producto.nombre) continue;
      productos.set(id, producto);
    }
  }

  if (productos.size === 0) {
    return { procesados: 0, sincronizados: 0 };
  }

  const db = await getDb();
  let sincronizados = 0;

  for (const producto of productos.values()) {
    await db.runAsync(
      `
        INSERT INTO producto (id_producto, id_lote, id_productor, nombre, categoria, unidad_medida_base)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_producto) DO UPDATE SET
          id_lote = excluded.id_lote,
          id_productor = excluded.id_productor,
          nombre = excluded.nombre,
          categoria = excluded.categoria,
          unidad_medida_base = excluded.unidad_medida_base
      `,
      producto.id_producto,
      producto.id_lote ?? null,
      producto.id_productor ?? null,
      producto.nombre,
      producto.categoria ?? '',
      'Kg'
    );
    sincronizados += 1;
  }

  return { procesados: productos.size, sincronizados };
}

export function iniciarAutoSyncProductos(params: {
  backendUrl: string;
  endpoint?: string;
  intervalMs?: number;
}): void {
  const intervalMs = params.intervalMs ?? DEFAULT_INTERVAL_MS;

  if (!timer) {
    timer = setInterval(() => {
      sincronizarProductosPendientes().catch((error) => {
        console.warn('AutoSync productos fallo:', error);
      });
    }, intervalMs);
  }

  if (!netListenerUnsubscribe) {
    netListenerUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        sincronizarProductosPendientes().catch((error) => {
          console.warn('Sync productos al volver internet fallo:', error);
        });
      }
    });
  }

  void sincronizarProductosPendientes().catch((error) => {
    console.warn('Sync inicial de productos fallo:', error);
  });
}

export function detenerAutoSyncProductos(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (netListenerUnsubscribe) {
    netListenerUnsubscribe();
    netListenerUnsubscribe = null;
  }
}

export async function ejemploGuardarProductoYSync(): Promise<void> {
  await guardarProductoLocal({
    nombre: 'Quinua Real',
    categoria: 'Grano',
  });

  await sincronizarProductosPendientes();
}
