/**
 * useAuth.ts — Hook Unificado de Autenticación
 *
 * Propósito:
 *  - Verifica si hay un JWT en AsyncStorage al abrir la app.
 *  - Si hay token → modo 'autenticado', lo pone en estado global.
 *  - Si no hay → modo 'invitado' (la app funciona offline sin bloquear).
 *  - Expone iniciarSesion() que guarda el JWT y cambia el modo.
 *  - Expone cerrarSesion() que limpia el JWT y vuelve a 'invitado'.
 *
 * Este hook NO depende de Supabase: usa el backend propio (teléfono + PIN).
 * Úsalo en el Root Layout para proteger rutas:
 *
 *   const { modo, cargando, iniciarSesion, cerrarSesion, continuarComoInvitado } = useAuth();
 *
 *   if (cargando) return <SplashScreen />;
 *   if (modo === 'invitado') return <RegistroScreen onLogin={iniciarSesion} />;
 *   return <AppPrincipal />;
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthLocal } from './useAuthLocal';

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type ModoAuth = 'autenticado' | 'invitado';

export interface TokenInfo {
  token: string;
  idUsuario: number;
  idProductor: number;
  userName: string | null;
}

export interface UseAuthResult {
  /** Modo actual de la sesión */
  modo: ModoAuth;
  /** true mientras se verifica el token inicial en AsyncStorage */
  cargando: boolean;
  /** Datos del usuario autenticado (null si es invitado) */
  tokenInfo: TokenInfo | null;
  /**
   * Inicia sesión con teléfono + PIN.
   * Guarda el JWT automáticamente y cambia modo a 'autenticado'.
   * Devuelve true si tuvo éxito.
   */
  iniciarSesion: (telefono: string, pin: string) => Promise<boolean>;
  /**
   * Cierra la sesión: borra el JWT de AsyncStorage y pone modo 'invitado'.
   * Los datos locales en SQLite NO se borran.
   */
  cerrarSesion: () => Promise<void>;
  /**
   * Permite operar sin credenciales.
   * Todos los datos se guardan localmente hasta que el usuario inicie sesión.
   */
  continuarComoInvitado: () => void;
  /** Mensaje de error del último intento de login (null si no hay error) */
  errorLogin: string | null;
  /** Limpia el mensaje de error */
  limpiarErrorLogin: () => void;
}

// ─── Claves de AsyncStorage ──────────────────────────────────────────────────
const KEYS = {
  JWT_PRIMARY: '@jwt_token',
  JWT_COMPAT: 'jwt_token',
  ID_USUARIO: '@id_usuario',
  ID_PRODUCTOR: '@id_productor',
  IS_LOGGED_IN: '@isLoggedIn',
  USER_NAME: '@user_name',
  SESION_ACTIVA: 'sesion_activa',
  // Claves legado (api.js)
  ID_USUARIO_LEGACY: 'id_usuario',
  ID_PRODUCTOR_LEGACY: 'id_productor',
};

/** Todas las claves que deben limpiarse al cerrar sesión */
const TODAS_LAS_CLAVES = Object.values(KEYS);

// ─── Helper: leer token del storage ─────────────────────────────────────────
async function leerTokenDeStorage(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(KEYS.JWT_PRIMARY);
    if (token) return token;
    return await AsyncStorage.getItem(KEYS.JWT_COMPAT);
  } catch {
    return null;
  }
}

// ─── Helper: leer datos de sesión del storage ────────────────────────────────
async function leerDatosSesionDeStorage(): Promise<TokenInfo | null> {
  try {
    const [token, idUsuario, idProductor, userName] = await AsyncStorage.multiGet([
      KEYS.JWT_PRIMARY,
      KEYS.ID_USUARIO,
      KEYS.ID_PRODUCTOR,
      KEYS.USER_NAME,
    ]);

    const tokenValue = token[1] ?? null;
    const idUsuarioValue = idUsuario[1] ? Number(idUsuario[1]) : 0;
    const idProductorValue = idProductor[1] ? Number(idProductor[1]) : 0;

    if (!tokenValue || !idUsuarioValue) return null;

    return {
      token: tokenValue,
      idUsuario: idUsuarioValue,
      idProductor: idProductorValue,
      userName: userName[1] ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Hook principal ──────────────────────────────────────────────────────────
export function useAuth(): UseAuthResult {
  const [modo, setModo] = useState<ModoAuth>('invitado');
  const [cargando, setCargando] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [errorLogin, setErrorLogin] = useState<string | null>(null);
  const inicializado = useRef(false);

  const { iniciarSesion: loginLocal, cerrarSesionLocal } = useAuthLocal();

  // ── Verificación de token al montar (arranque de la app) ─────────────────
  useEffect(() => {
    if (inicializado.current) return;
    inicializado.current = true;
    void verificarTokenAlArrancar();
  }, []);

  const verificarTokenAlArrancar = async (): Promise<void> => {
    try {
      setCargando(true);

      const token = await leerTokenDeStorage();

      if (!token) {
        // ❌ Sin token — modo invitado, la app sigue funcionando offline
        console.log(
          '[useAuth] 👤 Sin JWT en AsyncStorage al arrancar. ' +
          'El usuario deberá iniciar sesión para sincronizar datos.'
        );
        setModo('invitado');
        setTokenInfo(null);
        return;
      }

      // ✅ Hay token — recuperar datos completos de sesión
      const datos = await leerDatosSesionDeStorage();
      if (datos) {
        setModo('autenticado');
        setTokenInfo(datos);
        console.log(
          `[useAuth] ✅ JWT encontrado al arrancar. Usuario ID: ${datos.idUsuario}. ` +
          `Token (primeros 20 chars): ${datos.token.slice(0, 20)}...`
        );
      } else {
        // Token presente pero sin metadatos completos (storage inconsistente)
        console.warn('[useAuth] ⚠️  JWT encontrado pero faltan metadatos de sesión. Modo invitado.');
        setModo('invitado');
        setTokenInfo(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[useAuth] Error inesperado verificando token: ${msg}`);
      setModo('invitado');
      setTokenInfo(null);
    } finally {
      setCargando(false);
    }
  };

  // ── Iniciar sesión ───────────────────────────────────────────────────────
  const iniciarSesion = useCallback(async (
    telefono: string,
    pin: string
  ): Promise<boolean> => {
    setErrorLogin(null);

    if (!telefono.trim() || !pin.trim()) {
      setErrorLogin('Ingresa tu teléfono y PIN para continuar.');
      return false;
    }

    try {
      // loginLocal llama a iniciarSesionApi() y guarda el JWT en AsyncStorage
      const resultado = await loginLocal(telefono, pin);

      // Leer el userName desde storage (loginLocal lo guardó)
      const userName = await AsyncStorage.getItem(KEYS.USER_NAME).catch(() => null);

      const info: TokenInfo = {
        token: resultado.token,
        idUsuario: resultado.idUsuario,
        idProductor: resultado.idProductor,
        userName,
      };

      setTokenInfo(info);
      setModo('autenticado');

      console.log(
        `[useAuth] 🔐 Login exitoso.\n` +
        `   🔑 JWT persistido en AsyncStorage[@jwt_token + jwt_token]\n` +
        `   👤 Usuario ID: ${resultado.idUsuario} | Productor ID: ${resultado.idProductor}`
      );

      return true;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión. Intenta de nuevo.';
      setErrorLogin(msg);
      console.error(`[useAuth] ❌ Login fallido: ${msg}`);
      return false;
    }
  }, [loginLocal]);

  // ── Cerrar sesión ────────────────────────────────────────────────────────
  const cerrarSesion = useCallback(async (): Promise<void> => {
    try {
      // Limpiar SQLite (tabla auth_sesion, usuario, productor)
      await cerrarSesionLocal();
    } catch (err: unknown) {
      console.warn('[useAuth] Error al limpiar sesión local:', err);
    }

    // Asegurar limpieza de AsyncStorage aunque cerrarSesionLocal falle
    try {
      await AsyncStorage.multiRemove(TODAS_LAS_CLAVES);
    } catch (err: unknown) {
      console.warn('[useAuth] Error al limpiar AsyncStorage:', err);
    }

    setTokenInfo(null);
    setModo('invitado');
    setErrorLogin(null);
    console.log('[useAuth] 👤 Sesión cerrada. Modo invitado activo.');
  }, [cerrarSesionLocal]);

  // ── Modo invitado ────────────────────────────────────────────────────────
  const continuarComoInvitado = useCallback((): void => {
    setModo('invitado');
    setTokenInfo(null);
    setErrorLogin(null);
    console.log('[useAuth] 👤 Usuario eligió continuar sin iniciar sesión.');
  }, []);

  const limpiarErrorLogin = useCallback((): void => {
    setErrorLogin(null);
  }, []);

  return {
    modo,
    cargando,
    tokenInfo,
    iniciarSesion,
    cerrarSesion,
    continuarComoInvitado,
    errorLogin,
    limpiarErrorLogin,
  };
}
