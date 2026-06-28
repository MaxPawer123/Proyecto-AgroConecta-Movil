import { requestJson, esErrorDeConectividad, type ApiResponse, type ListResponse } from '../http';
import { obtenerGastosPorLoteLocal } from '../../../modules/gastos/gastos.repository';

export type CrearGastoPayload = {
  id_local?: number;
  id_lote: number;
  categoria: string;
  descripcion?: string;
  cantidad: number;
  costo_unitario: number;
  tipo_costo: 'FIJO' | 'VARIABLE';
  modalidad_pago?: 'CICLO' | 'ANUAL' | 'NA';
};

export type GastoApi = {
  id_gasto: number;
  id_lote: number;
  categoria: string;
  descripcion: string | null;
  cantidad: string;
  costo_unitario: string;
  monto_total: string;
  tipo_costo: 'FIJO' | 'VARIABLE';
  modalidad_pago: 'CICLO' | 'ANUAL' | 'NA';
  fecha_gasto: string;
};

export async function crearGastoApi(payload: CrearGastoPayload): Promise<GastoApi> {
  const response = await requestJson<ApiResponse<GastoApi>>('/api/gastos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo registrar el gasto en el servidor');
  }

  return response.data;
}

export async function obtenerGastosPorLoteApi(idLote: number): Promise<GastoApi[]> {
  const response = await requestJson<ListResponse<GastoApi>>(`/api/gastos/lote/${idLote}`, {
    method: 'GET',
  });

  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error(response?.message || 'No se pudieron obtener gastos del lote desde el servidor');
  }

  return response.data;
}

/**
 * Versión resiliente de `obtenerGastosPorLoteApi`.
 *
 * Flujo:
 *  1. Intenta obtener los gastos del servidor.
 *  2. Si la red falla (sin internet / timeout), lee directamente de SQLite local.
 *  3. NUNCA lanza excepciones ni muestra banners de error al productor.
 *
 * @param idLoteServidor - ID del lote en Supabase/backend para la petición remota.
 * @param idLoteLocal    - ID local (SQLite) del lote para el fallback offline.
 */
export async function obtenerGastosPorLoteApiConFallback(
  idLoteServidor: number,
  idLoteLocal: number
): Promise<GastoApi[]> {
  try {
    return await obtenerGastosPorLoteApi(idLoteServidor);
  } catch (error) {
    if (esErrorDeConectividad(error)) {
      console.log(
        `📡 [Gastos] Sin conexión al servidor (lote ${idLoteServidor}). ` +
        'Cargando gastos desde SQLite local...'
      );
      const gastosLocales = await obtenerGastosPorLoteLocal(idLoteLocal);
      // Mapear GastoLocal → GastoApi para mantener compatibilidad de tipos en la UI
      return gastosLocales.map((g) => ({
        id_gasto: g.id_gasto ?? 0,
        id_lote: g.id_lote_servidor ?? idLoteServidor,
        categoria: g.categoria,
        descripcion: g.descripcion ?? null,
        cantidad: String(g.cantidad),
        costo_unitario: String(g.costo_unitario),
        monto_total: String(g.monto_total),
        tipo_costo: g.tipo_costo,
        modalidad_pago: g.modalidad_pago ?? 'NA',
        fecha_gasto: g.fecha_gasto,
      }));
    }
    // Error de servidor (4xx/5xx) — propagar para que el llamador decida
    throw error;
  }
}

export async function actualizarGastoApi(idGasto: number, payload: Partial<CrearGastoPayload>): Promise<GastoApi> {
  const response = await requestJson<ApiResponse<GastoApi>>(`/api/gastos/${idGasto}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo actualizar el gasto en el servidor');
  }

  return response.data;
}

export async function eliminarGastoApi(idGasto: number): Promise<void> {
  const response = await requestJson<ApiResponse<null>>(`/api/gastos/${idGasto}`, {
    method: 'DELETE',
  });

  if (!response?.success) {
    throw new Error(response?.message || 'No se pudo eliminar el gasto en el servidor');
  }
}

