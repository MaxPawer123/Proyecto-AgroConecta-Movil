import { requestJson, type ApiResponse, type ListResponse } from '../http';

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
