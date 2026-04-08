import { Platform } from 'react-native';
import Constants from 'expo-constants';

const REQUEST_TIMEOUT_MS = 10000;
const UPLOAD_REQUEST_TIMEOUT_MS = 30000;

function obtenerPuertoApi(): number {
  const valor = process.env.EXPO_PUBLIC_API_PORT;
  const numero = Number(valor);
  if (Number.isInteger(numero) && numero > 0 && numero <= 65535) {
    return numero;
  }
  return 3000;
}

const API_PORT = obtenerPuertoApi();

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

type ListResponse<T> = {
  success: boolean;
  message?: string;
  count?: number;
  data: T[];
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
  id_producto?: number;
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

export type ProduccionApi = {
  id_produccion: number;
  id_lote: number;
  fecha_registro: string;
  cantidad_obtenida: string;
  precio_venta: string;
  estado_sincronizacion: string;
  created_at: string;
};

export type CrearGastoPayload = {
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

export type ProductoApi = {
  id_producto: number;
  id_lote?: number | null;
  id_productor?: number | null;
  nombre: string;
  categoria: string;
  imagen_url?: string | null;
};

export type AuthRegisterPayload = {
  nombre: string;
  apellido: string;
  telefono: string;
  pin: string;
  departamento: string;
  municipio: string;
  comunidad: string;
};

export type AuthUserApi = {
  id_usuario: number;
  id_productor: number;
  nombre: string;
  apellido: string;
  telefono: string;
  rol: string;
  estado: string;
  departamento: string;
  municipio: string;
  comunidad: string;
  fecha_registro: string;
};

let baseUrlActiva: string | null = null;

class HttpStatusError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

function normalizarBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function extraerHostDesdeUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function esHostPrivado(host: string | null): boolean {
  if (!host) return false;
  return (
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function prioridadBaseUrl(url: string, baseUrlPrincipal: string | null): number {
  if (baseUrlPrincipal && url === baseUrlPrincipal) return 0;

  const host = extraerHostDesdeUrl(url);

  // Modo local/LAN: IP privada primero, luego alias de emulador/simulador.
  if (esHostPrivado(host) && url.startsWith('http://')) return 1;
  if (host === '10.0.2.2') return 2;
  if (host === 'localhost' || host === '127.0.0.1') return 3;
  if (url.startsWith('https://')) return 4;
  return 5;
}

function extraerHostDesdeUri(hostUri?: string | null): string | null {
  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  if (!host) return null;
  if (host.endsWith('.exp.direct') || host.endsWith('.expo.dev')) return null;
  return host;
}

function obtenerHostUriExpo(): string | null {
  const hostCandidates = [
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra
      ?.expoClient?.hostUri,
    Constants.expoConfig?.hostUri,
  ];

  return hostCandidates.find((hostUri) => Boolean(hostUri)) || null;
}

function extraerUrlsConfiguradasDesdeEnv(): string[] {
  const valores = [
    process.env.EXPO_PUBLIC_API_BASE_URL,
    process.env.EXPO_PUBLIC_API_BASE_URLS,
    process.env.EXPO_PUBLIC_API_BASE_URL_LAN,
  ];

  const urls: string[] = [];

  for (const valor of valores) {
    if (!valor) continue;

    for (const parte of valor.split(/[\s,;]+/)) {
      const url = parte.trim();
      if (!url) continue;
      if (!/^https?:\/\//i.test(url)) continue;
      urls.push(normalizarBaseUrl(url));
    }
  }

  return urls;
}

function construirBaseUrlsCandidatas(): string[] {
  const candidatas: string[] = [];
  const baseUrlPrincipal = process.env.EXPO_PUBLIC_API_BASE_URL
    ? normalizarBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL)
    : null;

  const baseUrlLan = process.env.EXPO_PUBLIC_API_BASE_URL_LAN
    ? normalizarBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL_LAN)
    : null;

  if (baseUrlLan) candidatas.push(baseUrlLan);

  candidatas.push(...extraerUrlsConfiguradasDesdeEnv());

  const hostExpo = extraerHostDesdeUri(obtenerHostUriExpo());
  if (hostExpo) {
    candidatas.push(`http://${hostExpo}:${API_PORT}`);
  }

  const hostCandidates = [
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra
      ?.expoClient?.hostUri,
    Constants.expoConfig?.hostUri,
  ];

  for (const hostUri of hostCandidates) {
    const host = extraerHostDesdeUri(hostUri);
    if (!host) continue;
    candidatas.push(`http://${host}:${API_PORT}`);
  }

  if (Platform.OS === 'android') {
    // Emulador Android
    candidatas.push(`http://10.0.2.2:${API_PORT}`);
  }

  candidatas.push(`http://localhost:${API_PORT}`);
  candidatas.push(`http://127.0.0.1:${API_PORT}`);

  return [...new Set(candidatas.map(normalizarBaseUrl))].sort((a, b) => {
    const prioridadA = prioridadBaseUrl(a, baseUrlPrincipal);
    const prioridadB = prioridadBaseUrl(b, baseUrlPrincipal);
    if (prioridadA !== prioridadB) return prioridadA - prioridadB;
    return a.localeCompare(b);
  });
}

function esErrorConexionRecuperable(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    // Permite fallback cuando un túnel o gateway externo falla temporalmente.
    return [408, 429, 500, 502, 503, 504].includes(error.status);
  }
  if (!(error instanceof Error)) return true;
  if (error.name === 'AbortError') return true;

  const msg = error.message.toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('cleartext') ||
    msg.includes('tiempo de espera agotado') ||
    msg.includes('network error')
  );
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrls = construirBaseUrlsCandidatas();
  const orden = baseUrlActiva
    ? [baseUrlActiva, ...baseUrls.filter((url) => url !== baseUrlActiva)]
    : baseUrls;

  let ultimoError: Error | null = null;

  for (const baseUrl of orden) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const mensaje =
          data && typeof data === 'object' && 'message' in data
            ? String((data as { message?: unknown }).message || `Error HTTP ${response.status}`)
            : `Error HTTP ${response.status}`;
        throw new HttpStatusError(mensaje, response.status);
      }

      baseUrlActiva = baseUrl;
      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        ultimoError = new Error(
          `Tiempo de espera agotado al conectar con ${baseUrl}. Verifica que Backend este corriendo en puerto ${API_PORT}.`
        );
      } else {
        ultimoError = error instanceof Error ? error : new Error(String(error));
      }

      if (!esErrorConexionRecuperable(error)) {
        throw ultimoError;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(
    `No se pudo conectar con el backend. URLs probadas: ${orden.join(', ')}. Ultimo error: ${
      ultimoError?.message || 'sin detalle'
    }`
  );
}

export async function fetchGetBackend<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'GET' });
}

export async function registrarProductorApi(payload: AuthRegisterPayload): Promise<AuthUserApi> {
  const response = await requestJson<ApiResponse<AuthUserApi>>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo registrar el productor en el servidor');
  }

  return response.data;
}

export async function recuperarPinApi(payload: {
  telefono: string;
  nuevo_pin: string;
}): Promise<void> {
  const response = await requestJson<ApiResponse<null>>('/api/auth/recover-pin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response?.success) {
    throw new Error(response?.message || 'No se pudo actualizar el PIN en el servidor');
  }
}

export async function fetchGetBackendConFallback<T>(
  path: string,
  obtenerFallback: () => Promise<T> | T
): Promise<T> {
  try {
    return await fetchGetBackend<T>(path);
  } catch (error) {
    if (!esErrorConexionRecuperable(error)) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const fallback = await Promise.resolve(obtenerFallback());
    console.warn(`Fallo GET ${path}. Se usa fallback local.`);
    return fallback;
  }
}

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

  const baseUrls = construirBaseUrlsCandidatas();
  const orden = baseUrlActiva
    ? [baseUrlActiva, ...baseUrls.filter((url) => url !== baseUrlActiva)]
    : baseUrls;

  let ultimoError: Error | null = null;

  const nombreArchivo = obtenerNombreArchivoDesdeUri(uriFoto);
  const tipoMime = obtenerMimeDesdeNombre(nombreArchivo);

  for (const baseUrl of orden) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const formData = new FormData();
      formData.append('foto', {
        uri: uriFoto,
        name: nombreArchivo,
        type: tipoMime,
      } as unknown as Blob);

      const response = await fetch(`${baseUrl}/api/lotes/upload/siembra`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
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

      baseUrlActiva = baseUrl;
      return url;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        ultimoError = new Error(`Tiempo de espera agotado al subir foto a ${baseUrl}.`);
      } else {
        ultimoError = error instanceof Error ? error : new Error(String(error));
      }

      if (!esErrorConexionRecuperable(error)) {
        throw ultimoError;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(
    `No se pudo subir la foto al backend. URLs probadas: ${orden.join(', ')}. Ultimo error: ${
      ultimoError?.message || 'sin detalle'
    }`
  );
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

export async function eliminarLoteApi(idLote: number): Promise<void> {
  const response = await requestJson<ApiResponse<null>>(`/api/lotes/${idLote}`, {
    method: 'DELETE',
  });

  if (!response?.success) {
    throw new Error(response?.message || 'No se pudo eliminar el lote en el servidor');
  }
}

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
    throw new Error(response?.message || 'No se pudo eliminar el gasto del servidor');
  }
}

export async function obtenerProductosPorCategoriaApi(categoria: string): Promise<ProductoApi[]> {
  const categoriaSegura = encodeURIComponent(categoria);
  const response = await fetchGetBackendConFallback<ListResponse<ProductoApi>>(
    `/api/productos/categoria/${categoriaSegura}`,
    () => ({ success: true, data: [], count: 0 })
  );

  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error(response?.message || 'No se pudieron obtener productos por categoría');
  }

  return response.data;
}

export async function crearProductoApi(payload: {
  nombre: string;
  categoria: string;
  id_lote?: number;
  id_productor?: number;
}): Promise<ProductoApi> {
  const response = await requestJson<ApiResponse<ProductoApi>>('/api/productos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo crear el producto en el servidor');
  }

  return response.data;
}

export async function obtenerOCrearProductoApi(payload: {
  nombre: string;
  categoria: string;
  id_lote?: number;
  id_productor?: number;
}): Promise<ProductoApi> {
  const productosCategoria = await obtenerProductosPorCategoriaApi(payload.categoria);
  const nombreNormalizado = payload.nombre.trim().toLowerCase();
  const encontrado = productosCategoria.find(
    (producto) => producto.nombre.trim().toLowerCase() === nombreNormalizado
  );

  if (encontrado) {
    return encontrado;
  }

  return crearProductoApi(payload);
}
