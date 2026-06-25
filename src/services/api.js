import AsyncStorage from '@react-native-async-storage/async-storage';

// Leer dinámicamente la URL base de la variable de entorno
const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  console.warn(
    '⚠️ Advertencia: EXPO_PUBLIC_API_URL no está definida en las variables de entorno.'
  );
}

/**
 * Cliente de API centralizado
 */
const api = {
  /**
   * Método auxiliar para realizar peticiones HTTP genéricas con fetch
   */
  request: async (endpoint, options = {}) => {
    const url = `${API_URL}${endpoint}`;

    // Obtener token de autenticación
    let token = await AsyncStorage.getItem('@jwt_token').catch(() => null);
    if (!token) {
      token = await AsyncStorage.getItem('jwt_token').catch(() => null);
    }

    // Leer el id_usuario guardado localmente para inyectarlo en los headers
    // y que el backend pueda filtrar los datos del usuario correcto.
    let idUsuario = await AsyncStorage.getItem('@id_usuario').catch(() => null);
    if (!idUsuario) {
      idUsuario = await AsyncStorage.getItem('id_usuario').catch(() => null);
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      // Inyectar id_usuario para el aislamiento de datos por usuario
      ...(idUsuario ? { 'id_usuario': idUsuario, 'x-user-id': idUsuario } : {}),
      ...(options.headers || {}),
    };

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      // Parsear respuesta a JSON
      let data = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }

      if (!response.ok) {
        const error = new Error(
          data?.message || `Error en la petición: ${response.status}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`🔴 Error en API [${options.method || 'GET'}] ${endpoint}:`, error);
      throw error;
    }
  },

  get: (endpoint, options = {}) => {
    return api.request(endpoint, { ...options, method: 'GET' });
  },

  post: (endpoint, body, options = {}) => {
    return api.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put: (endpoint, body, options = {}) => {
    return api.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete: (endpoint, options = {}) => {
    return api.request(endpoint, { ...options, method: 'DELETE' });
  },
};

export default api;
