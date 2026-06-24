import { requestJson, type ApiResponse } from '../http';

export type ProductoSyncItem = {
  id_producto: number;
  nombre: string;
  rubro: string;
  sincronizado: boolean;
};

export async function sincronizarProductosApi(productos: ProductoSyncItem[]): Promise<ApiResponse<ProductoSyncItem[]>> {
  const response = await requestJson<ApiResponse<ProductoSyncItem[]>>('/api/productos/sync', {
    method: 'POST',
    body: JSON.stringify({ productos }),
  });

  if (!response?.success) {
    throw new Error(response?.message || 'No se pudo sincronizar el catálogo de productos');
  }

  return response;
}
