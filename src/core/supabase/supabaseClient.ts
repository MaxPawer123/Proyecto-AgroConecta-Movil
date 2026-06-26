import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// URL y Anon Key de Supabase para el cliente frontend
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wlhvobcwwbsdtybmeqoq.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Intenta obtener la sesión actual de Supabase de forma segura.
 * Si el JWT ha expirado, el cliente intentará renovarlo automáticamente en silencio
 * utilizando el refresh token almacenado.
 * Si la sesión es totalmente inválida o expiró de forma definitiva, retorna null.
 */
export async function obtenerSesionValida() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    if (!session) {
      console.log('[Supabase Client] No hay sesión activa en Supabase.');
      return null;
    }
    
    // Validar si el token expira pronto (ej. menos de 30 segundos) para forzar refresco preventivo
    const expiraEnMs = session.expires_at ? (session.expires_at * 1000 - Date.now()) : 0;
    if (expiraEnMs < 30000) {
      console.log('[Supabase Client] El token expira pronto. Refrescando sesión...');
      const { data: { session: sesionRefrescada }, error: refreshError } = 
        await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.warn('[Supabase Client] Falló refresco silencioso:', refreshError.message);
        return null;
      }
      return sesionRefrescada;
    }

    return session;
  } catch (error) {
    console.error('[Supabase Client] Error al validar sesión:', error);
    return null;
  }
}
