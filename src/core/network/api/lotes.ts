import { ejecutarConBaseUrls, fetchGetBackendConFallback, HttpStatusError, requestJson, type ApiResponse, type ListResponse } from '../http';

const UPLOAD_REQUEST_TIMEOUT_MS = 30000;
const REQUEST_TIMEOUT_MS = 10000;

export type CrearLotePayload = {
  id_productor: number;
  tipo_cultivo: string;
  nombre_lote: string;
  superficie: number;
  fecha_siembra: string;
  fecha_cosecha_est: string;
  rendimiento_estimado: number;
  precio_venta_est: number;
  foto_siembra_url?: string | null;
  ubicacion?: string | null;
};

export type ActualizarLotePayload = Partial<CrearLotePayload> & {
  estado?: string;
};

export type LoteApi = {
  id_lote: number;
  id_productor: number;
  tipo_cultivo: string;
  variedad?: string;
  nombre_producto?: string;
  nombre_lote: string;
  superficie: string;
  fecha_siembra: string;
  fecha_cosecha_est: string;
  rendimiento_estimado: string;
  precio_venta_est: string;
  foto_siembra_url?: string | null;
  ubicacion?: string | null;
  estado: string;
  created_at: string;
};

type UploadFotoResponse = {
  success: boolean;
  message?: string;
  data?: {
    url?: string;
    filename?: string;
    path?: string;
  };
};

function obtenerNombreArchivoDesdeUri(uri: string): string {
  const ultimoSegmento = uri.split('/').pop();
  if (!ultimoSegmento) return `siembra-${Date.now()}.jpg`;
  return ultimoSegmento.includes('.') ? ultimoSegmento : `${ultimoSegmento}.jpg`;
}

function obtenerMimeDesdeNombre(nombre: string): string {
  const lower = nombre.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpeg') || lower.endsWith('.jpg')) return 'image/jpeg';
  return 'image/jpeg';
}

export async function subirFotoSiembraApi(uriFoto: string): Promise<string> {
  if (!uriFoto) {
    throw new Error('No se recibio una URI de foto para subir.');
  }

  if (!uriFoto.startsWith('file://') && /^https?:\/\//i.test(uriFoto)) {
    return uriFoto;
  }

  const nombreArchivo = obtenerNombreArchivoDesdeUri(uriFoto);
  const tipoMime = obtenerMimeDesdeNombre(nombreArchivo);

  return ejecutarConBaseUrls<string>(async (baseUrl, signal) => {
    const formData = new FormData();
    formData.append('foto', {
      uri: uriFoto,
      name: nombreArchivo,
      type: tipoMime,
    } as unknown as Blob);

    const response = await fetch(`${baseUrl}/api/lotes/upload/siembra`, {
      method: 'POST',
      body: formData,
      signal,
    });

    let data: UploadFotoResponse | null = null;
    try {
      data = (await response.json()) as UploadFotoResponse;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const mensaje = data?.message || `Error HTTP ${response.status}`;
      throw new HttpStatusError(mensaje, response.status);
    }

    const url = data?.data?.url;
    if (!url) {
      throw new Error('El backend no devolvio la URL de la imagen subida.');
    }

    return url;
  }, REQUEST_TIMEOUT_MS);
}

export async function crearLoteApi(payload: CrearLotePayload): Promise<LoteApi> {
  const response = await requestJson<ApiResponse<LoteApi>>('/api/lotes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo crear el lote en el servidor');
  }

  return response.data;
}

export async function obtenerLotesPorProductoApi(idProducto: number): Promise<LoteApi[]> {
  const mapaTipoCultivo: Record<number, string> = {
    1: 'quinua',
    2: 'hortaliza',
    3: 'haba',
  };
  const tipoCultivoCompat = mapaTipoCultivo[idProducto] ?? String(idProducto);
  const response = await fetchGetBackendConFallback<ListResponse<LoteApi>>(
    `/api/lotes/tipo-cultivo/${encodeURIComponent(tipoCultivoCompat)}`,
    () => ({ success: true, data: [], count: 0, message: 'Fallback local por error de red' })
  );

  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error(response?.message || 'No se pudieron obtener lotes por producto desde el servidor');
  }

  return response.data;
}

export async function obtenerLotesPorTipoCultivoApi(tipoCultivo: string): Promise<LoteApi[]> {
  const tipoCultivoSeguro = encodeURIComponent(tipoCultivo);
  const response = await fetchGetBackendConFallback<ListResponse<LoteApi>>(
    `/api/lotes/tipo-cultivo/${tipoCultivoSeguro}`,
    () => ({ success: true, data: [], count: 0, message: 'Fallback local por error de red' })
  );

  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error(response?.message || 'No se pudieron obtener lotes por tipo de cultivo desde el servidor');
  }

  return response.data;
}

export async function actualizarLoteApi(idLote: number, payload: ActualizarLotePayload): Promise<LoteApi> {
  const response = await requestJson<ApiResponse<LoteApi>>(`/api/lotes/${idLote}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo actualizar el lote en el servidor');
  }

  return response.data;
}

export async function eliminarLoteApi(idLote: number): Promise<void> {
  const response = await requestJson<ApiResponse<null>>(`/api/lotes/${idLote}`, {
    method: 'DELETE',
  });

  if (!response?.success) {
    throw new Error(response?.message || 'No se pudo eliminar el lote en el servidor');
  }
}
