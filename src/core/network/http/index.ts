import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ────────────────────────────────────────────────────────────────────────────────
// ⚙️  CONFIGURACIÓN PRINCIPAL
// ────────────────────────────────────────────────────────────────────────────────
// 🌐 URL DE PRODUCCIÓN (Vercel) — prioridad absoluta.
// Cámbiala solo si cambias de dominio en Vercel.
const VERCEL_URL = 'https://proyecto-agro-conecta-backend.vercel.app';

// 🏠 IP LAN para desarrollo local (solo se usa si EXPO_PUBLIC_USE_LAN=true en .env)
// Actualiza BACKEND_IP si tu router le asigna otra IP a tu PC.
const BACKEND_IP   = '192.168.0.8';
const BACKEND_PORT = 3000;
const LAN_URL      = `http://${BACKEND_IP}:${BACKEND_PORT}`;

// La URL activa se determina así:
//  1. Si EXPO_PUBLIC_API_URL está definida en .env → la usa (útil para CI/CD)
//  2. Si EXPO_PUBLIC_USE_LAN=true → usa la IP LAN (solo para desarrollo interno)
//  3. En todos los demás casos → Vercel (producción)
const BASE_URL_FIJA = (() => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl;
  if (process.env.EXPO_PUBLIC_USE_LAN === 'true') return LAN_URL;
  return VERCEL_URL;
})();

const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_TIMEOUT_MS = 30000;

// ────────────────────────────────────────────────────────────────────────────────
// Tipos de respuesta
// ────────────────────────────────────────────────────────────────────────────────
export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type ListResponse<T> = {
  success: boolean;
  message?: string;
  count?: number;
  data: T[];
};

// ────────────────────────────────────────────────────────────────────────────────
// Error HTTP personalizado
// ────────────────────────────────────────────────────────────────────────────────
class HttpStatusError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 🔍 Interceptor inteligente de errores de red
// ────────────────────────────────────────────────────────────────────────────────
function interceptarErrorDeRed(error: unknown, urlIntentada: string): void {
  if (error instanceof HttpStatusError) {
    // El servidor SÍ respondió pero con un status code de error — no es un problema de red.
    return;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    const esErrorDeRed =
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('network error') ||
      msg.includes('cleartext') ||
      msg.includes('timeout') ||
      error.name === 'AbortError';

    if (esErrorDeRed) {
      console.error(
        '\n' +
        '╔══════════════════════════════════════════════════════════════════╗\n' +
        '║  ❌ Error Crítico de Red                                        ║\n' +
        '╠══════════════════════════════════════════════════════════════════╣\n' +
        '║  El celular NO alcanza al servidor backend.                     ║\n' +
        '║                                                                 ║\n' +
        `║  URL intentada: ${urlIntentada.padEnd(46)}║\n` +
        '║                                                                 ║\n' +
        '║  🔎 Checklist de diagnóstico:                                   ║\n' +
        '║  1. ¿El celular y la PC están en el MISMO Wi-Fi?                ║\n' +
        '║  2. ¿El backend está corriendo? (npm start en Backend/)         ║\n' +
        '║  3. ¿El Firewall de Windows bloquea el puerto 3000?             ║\n' +
        '║     → Panel de control > Firewall > Permitir app >              ║\n' +
        '║       Agregar regla de entrada TCP puerto 3000                  ║\n' +
        '║  4. ¿La IP configurada (192.168.0.8) sigue siendo correcta?    ║\n' +
        '║     → En CMD ejecuta: ipconfig | findstr IPv4                   ║\n' +
        '╚══════════════════════════════════════════════════════════════════╝\n' +
        `  Error original: ${error.message}\n`
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Cache de la última URL que funcionó
// ────────────────────────────────────────────────────────────────────────────────
let baseUrlActiva: string | null = null;

// ────────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ────────────────────────────────────────────────────────────────────────────────
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
  return host.startsWith('192.168.') || host.startsWith('10.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

function prioridadBaseUrl(url: string, baseUrlPrincipal: string | null): number {
  if (baseUrlPrincipal && url === baseUrlPrincipal) return 0;

  const host = extraerHostDesdeUrl(url);

  // ✅ HTTPS (Vercel/producción) → máxima prioridad después de la URL principal
  if (url.startsWith('https://')) return 1;

  // IP LAN privada solo en segundo lugar (solo útil en desarrollo)
  if (esHostPrivado(host) && url.startsWith('http://')) return 2;

  // Emulador Android
  if (host === '10.0.2.2') return 3;

  // localhost / loopback — NUNCA deben ser usados en un celular físico
  if (host === 'localhost' || host === '127.0.0.1') return 9;

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
    process.env.EXPO_PUBLIC_API_URL,
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

function obtenerPuertoApi(): number {
  const valor = process.env.EXPO_PUBLIC_API_PORT;
  const numero = Number(valor);
  if (Number.isInteger(numero) && numero > 0 && numero <= 65535) {
    return numero;
  }
  return BACKEND_PORT;
}

// ────────────────────────────────────────────────────────────────────────────────
// 🏗️  Construcción de URLs candidatas (la URL fija SIEMPRE va primero)
// ────────────────────────────────────────────────────────────────────────────────
function construirBaseUrlsCandidatas(): string[] {
  const API_PORT = obtenerPuertoApi();
  const candidatas: string[] = [];

  // 🥇 Prioridad absoluta: la URL fija configurada manualmente
  candidatas.push(BASE_URL_FIJA);

  // Variables de entorno (por si se sobreescriben en el futuro)
  const baseUrlPrincipal = process.env.EXPO_PUBLIC_API_BASE_URL
    ? normalizarBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL)
    : null;

  const baseUrlLan = process.env.EXPO_PUBLIC_API_BASE_URL_LAN
    ? normalizarBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL_LAN)
    : null;

  if (baseUrlLan) candidatas.push(baseUrlLan);
  candidatas.push(...extraerUrlsConfiguradasDesdeEnv());

  // IP detectada por Expo (hostUri del dev server)
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

  // Emulador Android
  if (Platform.OS === 'android') {
    candidatas.push(`http://10.0.2.2:${API_PORT}`);
  }

  // Fallbacks de último recurso
  candidatas.push(`http://localhost:${API_PORT}`);
  candidatas.push(`http://127.0.0.1:${API_PORT}`);

  // Deduplicar y ordenar por prioridad
  return [...new Set(candidatas.map(normalizarBaseUrl))].sort((a, b) => {
    // La URL fija siempre queda primero
    if (a === BASE_URL_FIJA) return -1;
    if (b === BASE_URL_FIJA) return 1;

    const prioridadA = prioridadBaseUrl(a, baseUrlPrincipal);
    const prioridadB = prioridadBaseUrl(b, baseUrlPrincipal);
    if (prioridadA !== prioridadB) return prioridadA - prioridadB;
    return a.localeCompare(b);
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// Detección de errores de conexión recuperables
// ────────────────────────────────────────────────────────────────────────────────
function esErrorConexionRecuperable(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    // ✅ 401/403 son errores de autenticación definitivos — NO reintentar con
    // otra URL. Hacerlo causaría que la petición llegue a 127.0.0.1 (el celular
    // mismo) o a la IP LAN, produciendo errores de red confusos.
    if (error.status === 401 || error.status === 403) return false;
    // 400 Bad Request tampoco se recupera cambiando de URL
    if (error.status === 400) return false;
    // Errores de servidor o tasa de solicitudes sí pueden recuperarse con otra URL
    return [408, 429, 500, 502, 503, 504].includes(error.status);
  }
  // Errores de red (DNS, TCP, timeout) → intentar la siguiente URL candidata
  return true;
}

// ────────────────────────────────────────────────────────────────────────────────
// 🚀 Ejecución con failover sobre URLs candidatas
// ────────────────────────────────────────────────────────────────────────────────
export async function ejecutarConBaseUrls<T>(
  executor: (baseUrl: string, signal: AbortSignal) => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const baseUrls = construirBaseUrlsCandidatas();
  const orden = baseUrlActiva ? [baseUrlActiva, ...baseUrls.filter((url) => url !== baseUrlActiva)] : baseUrls;

  let ultimoError: Error | null = null;

  console.log(`🌐 Intentando conectar al backend. URLs candidatas: [${orden.join(', ')}]`);

  for (const baseUrl of orden) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resultado = await executor(baseUrl, controller.signal);
      if (baseUrlActiva !== baseUrl) {
        console.log(`✅ Conexión exitosa con: ${baseUrl}`);
      }
      baseUrlActiva = baseUrl;
      return resultado;
    } catch (error) {
      // 🔴 Interceptor inteligente de red
      interceptarErrorDeRed(error, baseUrl);

      if (error instanceof Error && error.name === 'AbortError') {
        ultimoError = new Error(
          `Tiempo de espera agotado al conectar con ${baseUrl}. Verifica que Backend este corriendo en puerto ${BACKEND_PORT}.`
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

  // Si todas fallaron, emitir un error final con el interceptor
  const errorFinal = new Error(
    `No se pudo conectar con el backend. URLs probadas: ${orden.join(', ')}. Ultimo error: ${ultimoError?.message || 'sin detalle'
    }`
  );
  interceptarErrorDeRed(errorFinal, orden[0] || BASE_URL_FIJA);
  throw errorFinal;
}

// ────────────────────────────────────────────────────────────────────────────────
// 📡 Petición JSON genérica
// ────────────────────────────────────────────────────────────────────────────────
export async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  return ejecutarConBaseUrls<T>(async (baseUrl, signal) => {
    // ── 1. Leer token JWT desde AsyncStorage ────────────────────────────────
    // Se intenta con ambas claves para compatibilidad con versiones anteriores.
    let token = await AsyncStorage.getItem('@jwt_token').catch(() => null);
    if (!token) {
      token = await AsyncStorage.getItem('jwt_token').catch(() => null);
    }

    const metodo = (init?.method || 'GET').toUpperCase();
    const esMutacion = ['PUT', 'POST', 'PATCH', 'DELETE'].includes(metodo);

    if (!token) {
      // ✅ Para peticiones que modifican datos (PUT/POST) no tiene sentido enviar
      // la solicitud sin credenciales — el servidor SIEMPRE responderá 401.
      // Lanzamos el error localmente para que usePerfil.guardarPerfilLocal()
      // lo capture de inmediato y muestre "Sesión requerida" sin tocar la red.
      if (esMutacion) {
        console.error(
          `🔴 [http] ${metodo} ${path} abortado: sin token JWT en AsyncStorage. ` +
          'El productor debe cerrar sesión y volver a registrarse/iniciar sesión ' +
          'para que el nuevo flujo guarde el JWT correctamente.'
        );
        throw new HttpStatusError('Token no proporcionado.', 401);
      }

      console.warn(
        `🔐 [http] ADVERTENCIA: GET ${path} sin token JWT. ` +
        'Las rutas públicas (GET lotes, tipos de cultivo) funcionarán igual. ' +
        'Las rutas protegidas responderán 401.'
      );
    }

    // ── 2. Leer id_usuario desde AsyncStorage ───────────────────────────────
    let idUsuario = await AsyncStorage.getItem('@id_usuario').catch(() => null);
    if (!idUsuario) {
      idUsuario = await AsyncStorage.getItem('id_usuario').catch(() => null);
    }

    // ── 3. Construir headers con el estándar Bearer Token (RFC 6750) ────────
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> || {}),
    };

    if (token) {
      // ✅ INYECCIÓN DEL TOKEN — authMiddleware.js lee exactamente este header:
      //   const authHeader = req.headers.authorization;  → "Bearer eyJhbG..."
      //   const token = authHeader.split(' ')[1];         → "eyJhbG..."
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Header auxiliar para rutas que filtran por usuario sin decodificar JWT
    if (idUsuario) {
      headers['id_usuario'] = idUsuario;
      headers['x-user-id'] = idUsuario;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal,
      headers,
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

    return data as T;
  }, timeoutMs);
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers de conveniencia
// ────────────────────────────────────────────────────────────────────────────────
export async function fetchGetBackend<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'GET' });
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

export { HttpStatusError };
