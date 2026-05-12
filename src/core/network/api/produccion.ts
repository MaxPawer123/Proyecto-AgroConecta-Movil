import { HttpStatusError, requestJson, type ApiResponse } from '../http';

export type ProduccionApi = {
  id_produccion: number;
  id_lote: number;
  fecha_registro: string;
  cantidad_obtenida: string;
  precio_venta: string;
  estado_sincronizacion: string;
  created_at: string;
};

export async function registrarProduccionLoteApi(payload: {
  id_lote: number;
  fecha_registro: string;
  cantidad_obtenida: number;
  precio_venta: number;
  estado_sincronizacion?: string;
}): Promise<ProduccionApi> {
  const response = await requestJson<ApiResponse<ProduccionApi>>('/api/produccion', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo registrar la produccion en el servidor');
  }

  return response.data;
}

export async function obtenerUltimaProduccionLoteApi(idLote: number): Promise<ProduccionApi | null> {
  try {
    const response = await requestJson<ApiResponse<ProduccionApi>>(`/api/produccion/lote/${idLote}/ultima`, {
      method: 'GET',
    });

    if (!response?.success || !response.data) {
      return null;
    }

    return response.data;
  } catch (error) {
    if (error instanceof HttpStatusError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
