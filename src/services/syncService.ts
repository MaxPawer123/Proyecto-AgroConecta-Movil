import NetInfo from '@react-native-community/netinfo';
import { supabase, obtenerSesionValida } from '../core/supabase/supabaseClient';
import { obtenerLotesPendientesLocales, marcarLoteComoSincronizado } from '../modules/siembra/siembra.repository';

let sincronizando = false;

/**
 * Servicio central para sincronizar los lotes y registros locales pendientes
 * con las tablas remotas de Supabase.
 */
export async function syncLocalDataToCloud(): Promise<{ exitoso: boolean; procesados: number }> {
  if (sincronizando) {
    console.log('[Sync Service] Sincronización en curso. Omitiendo ejecución.');
    return { exitoso: false, procesados: 0 };
  }

  sincronizando = true;
  let procesados = 0;

  try {
    // 1. Detectar conexión activa a internet
    const estadoRed = await NetInfo.fetch();
    if (!estadoRed.isConnected || !estadoRed.isInternetReachable) {
      console.log('[Sync Service] Dispositivo sin internet. Esperando conexión.');
      sincronizando = false;
      return { exitoso: false, procesados: 0 };
    }

    // 2. Verificar/renovar silenciosamente la sesión con el refresh token
    const sesion = await obtenerSesionValida();
    if (!sesion) {
      console.log('[Sync Service] Sesión expirada y no se pudo renovar en silencio. Sincronización detenida sin alterar datos locales.');
      sincronizando = false;
      return { exitoso: false, procesados: 0 };
    }

    console.log('[Sync Service] Sesión válida obtenida. Buscando lotes locales pendientes...');

    // 3. Obtener registros no sincronizados de SQLite
    const lotesPendientes = await obtenerLotesPendientesLocales();
    if (lotesPendientes.length === 0) {
      console.log('[Sync Service] No hay lotes pendientes de sincronización.');
      sincronizando = false;
      return { exitoso: true, procesados: 0 };
    }

    console.log(`[Sync Service] Subiendo ${lotesPendientes.length} lotes pendientes a Supabase...`);

    for (const lote of lotesPendientes) {
      try {
        // Mapear los campos del lote a la estructura esperada por la tabla remota en Supabase
        const payload = {
          id_productor: lote.id_productor,
          nombre_lote: lote.nombre_lote,
          superficie: lote.superficie,
          fecha_siembra: lote.fecha_siembra,
          fecha_cosecha_est: lote.fecha_cosecha_est,
          fecha_cosecha_real: lote.fecha_cosecha_real,
          foto_siembra_url: lote.foto_siembra_uri_local,
          ubicacion: lote.ubicacion || 'No especificada',
          estado: 'ACTIVO',
          id_usuario: lote.id_productor, // O sesion.user.id si coincide el ID del auth de Supabase
          updated_at: new Date().toISOString(),
        };

        let queryError = null;
        let dataResult = null;

        // Upsert / Insert
        if (lote.id_servidor) {
          // Si ya tiene ID del servidor, actualizamos
          const { data, error } = await supabase
            .from('lote')
            .upsert({ id_lote: lote.id_servidor, ...payload })
            .select('id_lote')
            .single();
          queryError = error;
          dataResult = data;
        } else {
          // Si es un lote nuevo creado offline, insertamos
          const { data, error } = await supabase
            .from('lote')
            .insert(payload)
            .select('id_lote')
            .single();
          queryError = error;
          dataResult = data;
        }

        if (queryError) {
          throw queryError;
        }

        if (dataResult) {
          const idServidor = dataResult.id_lote;
          // 4. Actualizar bandera local 'sincronizado' a 1 (true) y guardar ID de servidor
          await marcarLoteComoSincronizado(lote.id_local, idServidor);
          procesados++;
          console.log(`[Sync Service] Lote local ${lote.id_local} sincronizado exitosamente con ID Servidor: ${idServidor}`);
        }
      } catch (err: any) {
        console.error(`[Sync Service] Error al sincronizar el lote local ${lote.id_local}:`, err?.message || err);
      }
    }

    sincronizando = false;
    return { exitoso: true, procesados };

  } catch (error) {
    console.error('[Sync Service] Error general en syncLocalDataToCloud:', error);
    sincronizando = false;
    return { exitoso: false, procesados };
  }
}
