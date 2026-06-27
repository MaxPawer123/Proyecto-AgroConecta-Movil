/**
 * supabaseClient.ts — Cliente Supabase Resiliente con modo Offline/Invitado
 *
 * Arquitectura Offline-First:
 *  1. Verifica credenciales ANTES de inicializar.
 *  2. Si fallan o no existen → exporta un cliente "Nulo" mediante un Proxy
 *     recursivo que NUNCA lanza excepciones (devuelve Promises vacíos).
 *  3. Exporta `isSupabaseConfigured()` para que el resto del código sepa
 *     si puede intentar operaciones remotas.
 *  4. Exporta `SessionState` para gestionar modos Invitado / Autenticado / Offline.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Constantes de configuración ────────────────────────────────────────────
const SUPABASE_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();

const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

// URL de fallback hardcodeada — solo se usa si la variable de entorno no existe.
// Déjala vacía en producción si no quieres fallback.
const FALLBACK_URL = 'https://wlhvobcwwbsdtybmeqoq.supabase.co';

const urlFinal = SUPABASE_URL || FALLBACK_URL;
const keyFinal = SUPABASE_ANON_KEY;

// ─── Validación de credenciales ──────────────────────────────────────────────
const credencialesValidas = Boolean(
  urlFinal &&
  keyFinal &&
  /^https:\/\/.+\.supabase\.co/.test(urlFinal)
);

// ─── Estado de configuración ─────────────────────────────────────────────────
let _isConfigured = false;
let _isOfflineMode = true;

/** Devuelve true si Supabase fue inicializado correctamente. */
export function isSupabaseConfigured(): boolean {
  return _isConfigured;
}

/** Devuelve true si la app está en modo offline (sin Supabase). */
export function isOfflineMode(): boolean {
  return _isOfflineMode;
}

// ─── Estado de sesión ────────────────────────────────────────────────────────
export type ModoApp = 'autenticado' | 'invitado' | 'offline';

export interface SessionState {
  modo: ModoApp;
  userId: string | null;
  accessToken: string | null;
}

let _sessionState: SessionState = {
  modo: 'offline',
  userId: null,
  accessToken: null,
};

export function getSessionState(): SessionState {
  return { ..._sessionState };
}

export function setSessionState(state: Partial<SessionState>): void {
  _sessionState = { ..._sessionState, ...state };
}

// ─── Proxy recursivo "Nulo" para modo offline ────────────────────────────────
/**
 * Devuelve una respuesta Supabase vacía y segura (data: null, error: offline).
 */
const offlineResponse = {
  data: null,
  error: { message: 'Supabase no disponible (modo offline)', status: 0, code: 'OFFLINE' },
};

/**
 * Crea un Proxy recursivo que:
 *  - Permite encadenar CUALQUIER método/propiedad sin lanzar TypeError.
 *  - Al final de la cadena (await), devuelve `offlineResponse`.
 *
 * Esto cubre: .from('x').select('*').eq('id', 1).single()
 *             .from('x').insert({}).select().single()
 *             .auth.getSession()  etc.
 */
function crearProxyNull(): any {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      // Propiedades especiales de Promise — necesarias para que `await` funcione
      if (prop === 'then') {
        return (resolve: (v: any) => any) => Promise.resolve(offlineResponse).then(resolve);
      }
      if (prop === 'catch') {
        return (reject: (v: any) => any) => Promise.resolve(offlineResponse).catch(reject);
      }
      if (prop === 'finally') {
        return (fn: () => void) => Promise.resolve(offlineResponse).finally(fn);
      }

      // Atajos específicos del API de Supabase Auth
      if (prop === 'getSession') {
        return () => Promise.resolve({ data: { session: null }, error: null });
      }
      if (prop === 'getUser') {
        return () => Promise.resolve({ data: { user: null }, error: null });
      }
      if (prop === 'refreshSession') {
        return () => Promise.resolve({ data: { session: null }, error: null });
      }
      if (prop === 'onAuthStateChange') {
        return (_cb: any) => ({
          data: { subscription: { unsubscribe: () => {} } },
        });
      }
      if (prop === 'signOut') {
        return () => Promise.resolve({ error: null });
      }
      if (prop === 'signInWithPassword') {
        return () =>
          Promise.resolve({
            data: { user: null, session: null },
            error: { message: 'Sin conexión a Supabase', status: 0 },
          });
      }

      // Para cualquier otra propiedad → devuelve otro proxy recursivo (function + object)
      return new Proxy(function () {}, {
        apply() {
          return crearProxyNull();
        },
        get(_t, innerProp: string) {
          return crearProxyNull()[innerProp];
        },
      });
    },
    apply() {
      return crearProxyNull();
    },
  };

  return new Proxy({}, handler);
}

// ─── Inicialización del cliente real ─────────────────────────────────────────
let supabaseInstance: SupabaseClient | null = null;

if (!credencialesValidas) {
  console.warn(
    '[SupabaseClient] ⚠️  Credenciales inválidas o ausentes. ' +
    'Verifica EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en tu .env. ' +
    'La app continuará en modo Offline/Invitado.'
  );
} else {
  try {
    supabaseInstance = createClient(urlFinal, keyFinal, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    _isConfigured = true;
    _isOfflineMode = false;

    // Actualizar SessionState cuando cambia la sesión
    supabaseInstance.auth.onAuthStateChange((event, session) => {
      if (session) {
        _sessionState = {
          modo: 'autenticado',
          userId: session.user?.id ?? null,
          accessToken: session.access_token ?? null,
        };
        console.log(`[SupabaseClient] 🔐 Sesión activa. Usuario: ${session.user?.email}`);
      } else {
        _sessionState = {
          modo: _isOfflineMode ? 'offline' : 'invitado',
          userId: null,
          accessToken: null,
        };
        if (event === 'SIGNED_OUT') {
          console.log('[SupabaseClient] 👤 Sesión cerrada. Modo Invitado activado.');
        }
      }
    });

    console.log('[SupabaseClient] ✅ Supabase inicializado correctamente.');
  } catch (initError: unknown) {
    const msg = initError instanceof Error ? initError.message : String(initError);
    console.error(
      `[SupabaseClient] ❌ Error inesperado al inicializar Supabase: ${msg}. ` +
      'La app continuará en modo Offline.'
    );
    supabaseInstance = null;
    _isConfigured = false;
    _isOfflineMode = true;
  }
}

// ─── Export principal ────────────────────────────────────────────────────────
/**
 * Cliente Supabase. Si está en modo offline, todas las llamadas devuelven
 * { data: null, error: { message: 'Supabase no disponible...' } } sin lanzar excepciones.
 */
export const supabase: SupabaseClient = supabaseInstance ?? (crearProxyNull() as SupabaseClient);

// ─── Helper: Obtener sesión válida ───────────────────────────────────────────
/**
 * Obtiene la sesión actual de forma segura.
 * - Si está en modo offline → retorna null sin crashear.
 * - Si el token expira pronto → refresca silenciosamente.
 * - Si el refresco falla → retorna null (el usuario deberá re-iniciar sesión).
 *
 * NUNCA lanza excepciones: usa try/catch internamente.
 */
export async function obtenerSesionValida(): Promise<import('@supabase/supabase-js').Session | null> {
  // Modo offline: no intentamos nada con Supabase
  if (_isOfflineMode || !supabaseInstance) {
    console.log('[SupabaseClient] Modo offline activo — omitiendo verificación de sesión.');
    return null;
  }

  try {
    const { data: { session }, error } = await supabaseInstance.auth.getSession();

    if (error) {
      console.warn('[SupabaseClient] Error al obtener sesión:', error.message);
      return null;
    }

    if (!session) {
      console.log('[SupabaseClient] No hay sesión activa.');
      // Actualizar estado a invitado
      _sessionState = { modo: 'invitado', userId: null, accessToken: null };
      return null;
    }

    // Verificar si el token expira en menos de 60 segundos
    const expiraEnMs = session.expires_at
      ? session.expires_at * 1000 - Date.now()
      : Infinity;

    if (expiraEnMs < 60_000) {
      console.log('[SupabaseClient] Token próximo a expirar. Refrescando...');
      try {
        const { data: { session: sesionRefrescada }, error: refreshError } =
          await supabaseInstance.auth.refreshSession();

        if (refreshError || !sesionRefrescada) {
          console.warn('[SupabaseClient] Refresco fallido:', refreshError?.message ?? 'sin sesión');
          // El usuario necesita iniciar sesión de nuevo
          _sessionState = { modo: 'invitado', userId: null, accessToken: null };
          return null;
        }

        // Sesión refrescada exitosamente
        _sessionState = {
          modo: 'autenticado',
          userId: sesionRefrescada.user?.id ?? null,
          accessToken: sesionRefrescada.access_token ?? null,
        };
        return sesionRefrescada;
      } catch (refreshErr: unknown) {
        console.warn('[SupabaseClient] Excepción al refrescar sesión:', refreshErr);
        return null;
      }
    }

    return session;
  } catch (err: unknown) {
    // NUNCA dejar que un error de Supabase crashee la app
    console.error('[SupabaseClient] Error inesperado al validar sesión:', err);
    return null;
  }
}

/**
 * Intenta iniciar sesión en modo invitado (sin credenciales).
 * Actualiza el SessionState para que la UI pueda reaccionar.
 */
export function activarModoInvitado(): void {
  _sessionState = { modo: 'invitado', userId: null, accessToken: null };
  console.log('[SupabaseClient] 👤 Modo Invitado activado manualmente.');
}
