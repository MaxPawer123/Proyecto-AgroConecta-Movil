import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// 📡 CLIENTE DE API CENTRALIZADO — AgroConecta
// ─────────────────────────────────────────────────────────────────────────────
// Lee la URL del backend desde las variables de entorno de Expo.
// En producción (Vercel) usa EXPO_PUBLIC_API_URL.
const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

if (!API_URL) {
  console.warn(
    '⚠️ [api.js] EXPO_PUBLIC_API_URL no está definida. ' +
    'Las peticiones fallarán en producción.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 Helper: obtener el token JWT desde AsyncStorage
// ─────────────────────────────────────────────────────────────────────────────
// Intenta leer el token con ambas claves (@jwt_token y jwt_token)
// para compatibilidad con código heredado.
async function obtenerToken() {
  try {
    const token =
      (await AsyncStorage.getItem('@jwt_token')) ||
      (await AsyncStorage.getItem('jwt_token'));

    if (!token) {
      console.warn(
        '🔐 [api.js] ADVERTENCIA: No se encontró JWT en AsyncStorage. ' +
        'La petición se enviará SIN Authorization header. ' +
        'Asegúrate de haber llamado a guardarSesion() tras el login/registro.'
      );
    }
    return token;
  } catch (err) {
    console.error('❌ [api.js] Error al leer token de AsyncStorage:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 👤 Helper: obtener el id_usuario desde AsyncStorage
// ─────────────────────────────────────────────────────────────────────────────
async function obtenerIdUsuario() {
  try {
    return (
      (await AsyncStorage.getItem('@id_usuario')) ||
      (await AsyncStorage.getItem('id_usuario')) ||
      null
    );
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏗️ Helper: construir headers con token inyectado automáticamente
// ─────────────────────────────────────────────────────────────────────────────
async function construirHeaders(headersExtra = {}) {
  const token = await obtenerToken();
  const idUsuario = await obtenerIdUsuario();

  return {
    'Content-Type': 'application/json',
    // ✅ ESTÁNDAR RFC 6750 — Bearer Token Authentication
    // authMiddleware.js en el backend hace:
    //   const token = req.headers.authorization.split(' ')[1];
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idUsuario ? { 'id_usuario': idUsuario, 'x-user-id': idUsuario } : {}),
    ...headersExtra,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 Función principal de petición
// ─────────────────────────────────────────────────────────────────────────────
async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const { headers: headersExtra, ...restOptions } = options;

  // ⬇️ El token se inyecta AQUÍ, antes de cada petición
  const headers = await construirHeaders(headersExtra);

  const config = { ...restOptions, headers };

  console.log(
    `📤 [api.js] ${config.method || 'GET'} → ${url}`,
    '| Auth:', headers.Authorization ? '✅ Bearer OK' : '❌ SIN TOKEN'
  );

  try {
    const response = await fetch(url, config);

    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    }

    if (response.status === 401) {
      console.error(
        '🔴 [api.js] 401 Unauthorized. El servidor rechazó la petición. ' +
        'El token no fue enviado, está expirado o es inválido.'
      );
    }

    if (!response.ok) {
      const error = new Error(
        data?.message || `Error HTTP ${response.status} en ${endpoint}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`🔴 [api.js] Error en [${config.method || 'GET'}] ${endpoint}:`, error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 📦 API pública
// ─────────────────────────────────────────────────────────────────────────────
const api = {
  /** GET con token automático */
  get: (endpoint, options = {}) =>
    request(endpoint, { ...options, method: 'GET' }),

  /** POST con token automático */
  post: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),

  /** PUT con token automático */
  put: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),

  /** DELETE con token automático */
  delete: (endpoint, options = {}) =>
    request(endpoint, { ...options, method: 'DELETE' }),

  // ── Helpers de sesión ─────────────────────────────────────────────────────

  /**
   * ✅ GUARDAR SESIÓN — Llama esto justo después del login o registro exitoso.
   *
   * @param {string} token       JWT recibido del backend en res.token
   * @param {number} idUsuario   ID del usuario (res.data.id_usuario)
   * @param {number} idProductor ID del productor (res.data.id_productor)
   * @param {string} nombre      Nombre completo para mostrar en la UI
   *
   * @example
   *   const res = await api.post('/api/auth/login', { telefono, pin });
   *   await api.guardarSesion(res.token, res.data.id_usuario, res.data.id_productor, res.data.nombre);
   */
  guardarSesion: async (token, idUsuario, idProductor, nombre = '') => {
    await AsyncStorage.multiSet([
      ['@jwt_token',    token],
      ['jwt_token',     token],          // compatibilidad con código heredado
      ['@id_usuario',   String(idUsuario)],
      ['id_usuario',    String(idUsuario)],
      ['@id_productor', String(idProductor)],
      ['id_productor',  String(idProductor)],
      ['@isLoggedIn',   'true'],
      ['sesion_activa', 'true'],
      ['@user_name',    nombre],
    ]);
    console.log('✅ [api.js] Sesión guardada. JWT disponible para próximas peticiones.');
  },

  /**
   * 🔓 CERRAR SESIÓN — Elimina el token y todos los datos de sesión.
   */
  cerrarSesion: async () => {
    await AsyncStorage.multiRemove([
      '@jwt_token', 'jwt_token',
      '@id_usuario', 'id_usuario',
      '@id_productor', 'id_productor',
      '@isLoggedIn', 'sesion_activa', '@user_name',
    ]);
    console.log('🔓 [api.js] Sesión cerrada. Token eliminado.');
  },

  /** Verifica si hay un token activo en AsyncStorage */
  estaAutenticado: async () => Boolean(await obtenerToken()),
};

export default api;
