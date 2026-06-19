import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { verificarBackendActivo } from '../network/apiClient';

type AutoSyncFn = () => Promise<void> | void;

type UseAutoSyncOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

const DEFAULT_INTERVAL_MS = 30000;

export function useAutoSync(syncFn: AutoSyncFn, options: UseAutoSyncOptions = {}): void {
  const { enabled = true, intervalMs = DEFAULT_INTERVAL_MS } = options;
  const syncFnRef = useRef(syncFn);
  const syncEnCursoRef = useRef(false);

  useEffect(() => {
    syncFnRef.current = syncFn;
  }, [syncFn]);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const ejecutarSync = async (): Promise<void> => {
      if (syncEnCursoRef.current) return;
      syncEnCursoRef.current = true;

      try {
        const backendActivo = await verificarBackendActivo();
        if (!backendActivo || !mounted) {
          return;
        }

        await syncFnRef.current();
      } catch {
        // Sincronizacion silenciosa: si el backend no responde, se reintenta luego.
      } finally {
        syncEnCursoRef.current = false;
      }
    };

    const manejarCambioAppState = (nextState: AppStateStatus): void => {
      if (nextState === 'active') {
        void ejecutarSync();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', manejarCambioAppState);

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === true && state.isInternetReachable !== false) {
        void ejecutarSync();
      }
    });

    const intervalId =
      intervalMs > 0
        ? setInterval(() => {
            void ejecutarSync();
          }, intervalMs)
        : null;

    void ejecutarSync();

    return () => {
      mounted = false;
      appStateSubscription.remove();
      netInfoUnsubscribe();

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [enabled, intervalMs]);
}