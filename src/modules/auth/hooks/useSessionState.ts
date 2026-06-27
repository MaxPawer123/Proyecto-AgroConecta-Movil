/**
 * useSessionState.ts — Hook de Gestión de Sesión con soporte Offline/Invitado
 *
 * Maneja tres modos de operación sin forzar un login bloqueante:
 *
 *  📡 'autenticado' — Usuario tiene sesión válida (Supabase + JWT backend)
 *  👤 'invitado'    — No hay sesión pero Supabase está configurado
 *  📴 'offline'     — Supabase no disponible o sin internet al iniciar
 *
 * Uso:
 *  const { modo, cargando, iniciarSesion, salirSesion, continuarComoInvitado } = useSessionState();
 *
 *  // En la UI:
 *  if (cargando) return <Spinner />;
 *  if (modo === 'autenticado') return <AppPrincipal />;
 *  return <PantallaLogin onInvitado={continuarComoInvitado} />;
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  supabase,
  obtenerSesionValida,
  isSupabaseConfigured,
  isOfflineMode,
  activarModoInvitado,
  getSessionState,
  setSessionState,
  type ModoApp,
} from '../../../core/supabase/supabaseClient';

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface UseSessionStateResult {
  /** Modo actual de la app */
  modo: ModoApp;
  /** true mientras se verifica la sesión inicial */
  cargando: boolean;
  /** true si hay un error de autenticación que necesita atención */
  necesitaReautenticacion: boolean;
  /** ID del usuario autenticado (null si es invitado/offline) */
  userId: string | null;
  /**
   * Intenta iniciar sesión con credenciales.
   * Retorna true si tuvo éxito, false si falló (sin crashear).
   */
  iniciarSesion: (email: string, password: string) => Promise<boolean>;
  /**
   * Cierra la sesión y activa modo Invitado.
   * Los datos locales permanecen intactos.
   */
  salirSesion: () => Promise<void>;
  /**
   * Activa modo Invitado sin requerir credenciales.
   * La app funciona completamente con datos locales.
   */
  continuarComoInvitado: () => void;
  /** Último mensaje de error de autenticación (para mostrar en UI) */
  errorAuth: string | null;
}

// ─── Hook principal ──────────────────────────────────────────────────────────
export function useSessionState(): UseSessionStateResult {
  const [modo, setModo] = useState<ModoApp>('offline');
  const [cargando, setCargando] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorAuth, setErrorAuth] = useState<string | null>(null);
  const [necesitaReautenticacion, setNecesitaReautenticacion] = useState(false);
  const inicializado = useRef(false);

  // ── Verificación de sesión al montar el componente ───────────────────────
  useEffect(() => {
    if (inicializado.current) return;
    inicializado.current = true;

    void verificarSesionInicial();
  }, []);

  // ── Suscripción a cambios de sesión de Supabase ──────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setModo('autenticado');
          setUserId(session.user?.id ?? null);
          setNecesitaReautenticacion(false);
          setErrorAuth(null);
          setSessionState({ modo: 'autenticado', userId: session.user?.id ?? null, accessToken: session.access_token });
        } else {
          // Sesión cerrada o expirada
          const nuevoModo: ModoApp = isOfflineMode() ? 'offline' : 'invitado';
          setModo(nuevoModo);
          setUserId(null);
          setSessionState({ modo: nuevoModo, userId: null, accessToken: null });
        }
      }
    );

    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);

  // ── Verificación de sesión inicial ───────────────────────────────────────
  const verificarSesionInicial = async (): Promise<void> => {
    try {
      setCargando(true);

      // Caso 1: Supabase no disponible → modo offline directamente
      if (!isSupabaseConfigured() || isOfflineMode()) {
        console.log('[useSessionState] Supabase no configurado. Modo offline activado.');
        setModo('offline');
        setUserId(null);
        return;
      }

      // Caso 2: Verificar si hay sesión previa (login persistido en AsyncStorage)
      const sesion = await obtenerSesionValida();

      if (sesion) {
        setModo('autenticado');
        setUserId(sesion.user?.id ?? null);
        setNecesitaReautenticacion(false);
        console.log(`[useSessionState] ✅ Sesión restaurada. Usuario: ${sesion.user?.email}`);
        return;
      }

      // Caso 3: No hay sesión → verificar si había un login previo (para mostrar relogin)
      const hayLoginPrevio = await verificarLoginPrevioLocalStorage();
      if (hayLoginPrevio) {
        // El usuario inició sesión antes pero el token expiró
        setNecesitaReautenticacion(true);
        console.log('[useSessionState] 🔒 Sesión expirada. Se requiere re-autenticación.');
      }

      // En cualquier caso sin sesión → modo invitado (no bloquear la app)
      setModo('invitado');
      setUserId(null);
      activarModoInvitado();

    } catch (error: unknown) {
      // Nunca debe llegar aquí, pero si llega → modo offline seguro
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[useSessionState] Error inesperado verificando sesión: ${msg}. Activando modo offline.`);
      setModo('offline');
      setUserId(null);
    } finally {
      setCargando(false);
    }
  };

  // ── Verificar si había un login previo guardado ──────────────────────────
  const verificarLoginPrevioLocalStorage = async (): Promise<boolean> => {
    try {
      const loggedIn = await AsyncStorage.getItem('@isLoggedIn');
      if (loggedIn === 'true') return true;
      const token = await AsyncStorage.getItem('@jwt_token');
      return Boolean(token);
    } catch {
      return false;
    }
  };

  // ── Iniciar sesión ───────────────────────────────────────────────────────
  const iniciarSesion = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      setErrorAuth('Supabase no disponible. Comprueba tu conexión o configuración.');
      return false;
    }

    setErrorAuth(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const msg = error.message ?? 'Error de autenticación desconocido.';
        setErrorAuth(msg);
        console.warn(`[useSessionState] Login fallido: ${msg}`);
        return false;
      }

      if (data?.session) {
        setModo('autenticado');
        setUserId(data.session.user?.id ?? null);
        setNecesitaReautenticacion(false);
        setErrorAuth(null);
        // Persistir flag de login para detectar re-autenticación futura
        await AsyncStorage.setItem('@isLoggedIn', 'true').catch(() => {});
        console.log(`[useSessionState] ✅ Login exitoso. Usuario: ${data.session.user?.email}`);
        return true;
      }

      setErrorAuth('Respuesta inesperada del servidor. Intenta de nuevo.');
      return false;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al iniciar sesión.';
      setErrorAuth(msg);
      console.error(`[useSessionState] Excepción en iniciarSesion: ${msg}`);
      return false;
    }
  }, []);

  // ── Cerrar sesión ────────────────────────────────────────────────────────
  const salirSesion = useCallback(async (): Promise<void> => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (err: unknown) {
      // Si signOut falla, continuamos de todas formas
      console.warn('[useSessionState] Error en signOut (continuando de todas formas):', err);
    }

    // Limpiar datos de sesión locales
    try {
      await AsyncStorage.multiRemove([
        '@isLoggedIn', '@jwt_token', 'jwt_token',
        '@id_usuario', 'id_usuario',
        '@id_productor', 'id_productor',
      ]);
    } catch {
      // No crítico si falla la limpieza de AsyncStorage
    }

    setModo('invitado');
    setUserId(null);
    setNecesitaReautenticacion(false);
    setErrorAuth(null);
    activarModoInvitado();

    console.log('[useSessionState] 👤 Sesión cerrada. Modo Invitado activado.');
  }, []);

  // ── Modo invitado ────────────────────────────────────────────────────────
  const continuarComoInvitado = useCallback((): void => {
    setModo('invitado');
    setUserId(null);
    setNecesitaReautenticacion(false);
    setErrorAuth(null);
    activarModoInvitado();
    console.log('[useSessionState] 👤 Usuario eligió continuar como invitado.');
  }, []);

  return {
    modo,
    cargando,
    necesitaReautenticacion,
    userId,
    iniciarSesion,
    salirSesion,
    continuarComoInvitado,
    errorAuth,
  };
}
