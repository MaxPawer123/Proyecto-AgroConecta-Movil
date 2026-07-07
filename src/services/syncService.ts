import NetInfo from '@react-native-community/netinfo';
import { supabase, obtenerSesionValida, isSupabaseConfigured } from '../core/supabase/supabaseClient';
import {
  obtenerLotesPendientesLocales,
  marcarLoteComoSincronizado,
  insertarLoteLocal,
  obtenerOInsertarProductoLocal,
  resolverIdLoteProductoServidor,
  getLoteServerColumn,
  actualizarFotoSiembraLocal,
} from '../modules/siembra/siembra.repository';
import { getDb } from '../core/database/sqlite.config';

// Estrategia de fotos: Subida directa a Cloudinary (Offline-First)

/**
 * Sube una imagen local (file://) a Cloudinary de manera directa usando FormData.
 * @param uriLocal URI de archivo local.
 * @returns La URL pública (secure_url) de Cloudinary o null si falla.
 */
async function subirFotoACloudinary(uriLocal: string): Promise<string | null> {
  try {
    const cloudName = 'dgdn58hpw';
    const apiKey = '272864567725746';
    const uploadPreset = 'ml_default'; // Preset unsigned por defecto en Cloudinary

    const fileName = uriLocal.split('/').pop() || `siembra_${Date.now()}.jpg`;

    const formData = new FormData();
    formData.append('file', {
      uri: uriLocal,
      type: 'image/jpeg',
      name: fileName,
    } as any);

    formData.append('upload_preset', uploadPreset);
    formData.append('api_key', apiKey);

    console.log(`📸 [Cloudinary] Subiendo imagen a Cloudinary: ${fileName}...`);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`📸 [Cloudinary] Error en respuesta (status ${response.status}): ${errorText}`);
      return null;
    }

    const data = await response.json();
    if (data && data.secure_url) {
      console.log(`📸 [Cloudinary] ¡Subida exitosa! URL: ${data.secure_url}`);
      return data.secure_url;
    }

    console.warn(`📸 [Cloudinary] No se recibió secure_url en los datos de respuesta.`);
    return null;
  } catch (error) {
    console.warn(`📸 [Cloudinary] Excepción al subir imagen:`, error);
    return null;
  }
}

// ─── Estado del servicio ─────────────────────────────────────────────────────
let sincronizando = false;

/** Razón por la que la última sincronización fue detenida (para diagnóstico). */
export type RazonDetencion =
  | 'sin_conexion'
  | 'sin_sesion'
  | 'error_401'
  | 'supabase_no_configurado'
  | 'ya_en_curso'
  | 'sin_pendientes'
  | 'error_inesperado'
  | null;

let _ultimaRazonDetencion: RazonDetencion = null;

export function getUltimaRazonDetencion(): RazonDetencion {
  return _ultimaRazonDetencion;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface LocalDataInput {
  rubro: 'QUINUA' | 'HORTALIZA' | 'PAPA';
  nombreLote: string;
  tipoCultivo: string;
  cultivos: string[];
  ubicacion: string;
  superficie: number;
  fechaSiembraIso: string;
  fechaCosechaIso: string;
  fotoTerrenoUri?: string | null;
}

export interface SyncResult {
  exitoso: boolean;
  procesados: number;
  razonDetencion: RazonDetencion;
}
// 💾  PASO 1: Guardar localmente (siempre, sin internet, sin sesión)
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Guarda cualquier registro de lote/siembra directamente en SQLite local.
 *
 * Garantías:
 *  - NO requiere internet.
 *  - NO requiere sesión de Supabase.
 *  - Marca el registro con sincronizado=0 para sincronización posterior.
 *  - NUNCA lanza excepciones hacia la UI: envuelve todo en try/catch.
 *
 * @returns ID local del registro insertado, o null si hubo error de BD.
 */
export async function saveDataLocally(input: LocalDataInput): Promise<number | null> {
  try {
    const db = await getDb();

    // 1. Obtener o insertar productos en el catálogo local
    const idProductos: number[] = [];
    for (const cultivo of input.cultivos) {
      const idProducto = await obtenerOInsertarProductoLocal(db, cultivo, input.rubro);
      idProductos.push(idProducto);
    }

    // 2. Insertar el lote con sincronizado = 0 (pendiente de sync remota)
    const idLocal = await insertarLoteLocal({
      id_servidor: null,
      id_productos: idProductos,
      tipo_cultivo: input.tipoCultivo,
      nombre_lote: input.nombreLote,
      ubicacion: input.ubicacion,
      superficie: input.superficie,
      fecha_siembra: input.fechaSiembraIso,
      fecha_cosecha_est: input.fechaCosechaIso,
      foto_siembra_uri_local: input.fotoTerrenoUri ?? null,
      sincronizado: 0, // Marcado para sync posterior
    });

    console.log(
      `💾 [SyncService] Lote guardado localmente. ID local: ${idLocal}. ` +
      'Estado: pendiente de sincronización (sincronizado=0).'
    );

    return idLocal;
  } catch (error: unknown) {
    // Error en SQLite — informar pero NO crashear la app
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[SyncService] ❌ Error al guardar localmente en SQLite: ${msg}`);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ☁️  PASO 2: Sincronizar con Supabase (solo con conexión y sesión válidas)
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Intenta sincronizar registros locales pendientes (sincronizado=0) con Supabase.
 *
 * Flujo de decisión:
 *  ┌─ ¿Ya hay sincronización en curso?  → detiene (razon: 'ya_en_curso')
 *  ├─ ¿NetInfo confirma conexión?       → si no, detiene (razon: 'sin_conexion')
 *  ├─ ¿Supabase configurado?            → si no, detiene (razon: 'supabase_no_configurado')
 *  ├─ ¿Sesión JWT válida?               → si no, detiene (razon: 'sin_sesion')
 *  ├─ ¿Hay registros pendientes?        → si no, finaliza (razon: 'sin_pendientes')
 *  └─ Por cada lote pendiente:
 *      ├─ Éxito → marca sincronizado=1
 *      ├─ Error 401 → marca como 'PENDIENTE_SESION', detiene loop (razon: 'error_401')
 *      └─ Otro error → registra en log, continúa con el siguiente
 *
 * @returns SyncResult con resultado y razón de detención (para diagnóstico en UI).
 */
export async function syncLocalDataToCloud(): Promise<SyncResult> {
  // ── Guardia de re-entrada ────────────────────────────────────────────────
  if (sincronizando) {
    console.log('[SyncService] Sincronización ya en curso. Omitiendo.');
    _ultimaRazonDetencion = 'ya_en_curso';
    return { exitoso: false, procesados: 0, razonDetencion: 'ya_en_curso' };
  }

  sincronizando = true;
  _ultimaRazonDetencion = null;
  let procesados = 0;

  try {
    // ── 1. Verificar conexión con NetInfo ────────────────────────────────────
    let hayConexion = false;
    try {
      const estadoRed = await NetInfo.fetch();
      hayConexion = Boolean(estadoRed.isConnected && estadoRed.isInternetReachable !== false);
    } catch {
      // NetInfo falló — asumimos sin conexión para evitar intentos fallidos
      hayConexion = false;
    }

    if (!hayConexion) {
      console.log('[SyncService] 📵 Sin conexión a internet. Sincronización pospuesta.');
      _ultimaRazonDetencion = 'sin_conexion';
      return { exitoso: false, procesados: 0, razonDetencion: 'sin_conexion' };
    }

    // ── 2. Verificar que Supabase esté configurado ───────────────────────────
    if (!isSupabaseConfigured()) {
      console.log('[SyncService] ⚠️  Supabase no configurado. Sincronización no disponible.');
      _ultimaRazonDetencion = 'supabase_no_configurado';
      return { exitoso: false, procesados: 0, razonDetencion: 'supabase_no_configurado' };
    }

    // ── 3. Obtener sesión válida (sin lanzar excepciones) ────────────────────
    let sesion = null;
    try {
      sesion = await obtenerSesionValida();
    } catch {
      // obtenerSesionValida() nunca debería lanzar, pero por si acaso
      sesion = null;
    }

    if (!sesion) {
      console.log(
        '[SyncService] 🔒 Sin sesión válida. Los registros permanecen locales ' +
        'hasta que el usuario inicie sesión.'
      );
      _ultimaRazonDetencion = 'sin_sesion';
      return { exitoso: false, procesados: 0, razonDetencion: 'sin_sesion' };
    }

    // ── 4. Obtener registros pendientes de SQLite ────────────────────────────
    let lotesPendientes: Awaited<ReturnType<typeof obtenerLotesPendientesLocales>> = [];
    try {
      lotesPendientes = await obtenerLotesPendientesLocales();
    } catch (dbError: unknown) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(`[SyncService] Error al leer SQLite: ${msg}`);
      _ultimaRazonDetencion = 'error_inesperado';
      return { exitoso: false, procesados: 0, razonDetencion: 'error_inesperado' };
    }

    if (lotesPendientes.length === 0) {
      console.log('[SyncService] ✅ No hay lotes pendientes de sincronización.');
      _ultimaRazonDetencion = 'sin_pendientes';
      return { exitoso: true, procesados: 0, razonDetencion: 'sin_pendientes' };
    }

    console.log(`[SyncService] 🔄 Iniciando sync de ${lotesPendientes.length} lote(s)...`);

    // ── 5. Iterar y sincronizar cada lote ────────────────────────────────────
    let detenerPorAuth = false;

    for (const lote of lotesPendientes) {
      if (detenerPorAuth) break; // 401 detectado en iteración anterior

      try {
        // ── 5a. Foto — estrategia Cloudinary (Offline-First) ──────────────────
        let fotoUrlParaPayload = lote.foto_siembra_uri_local;
        const esFotoLocal =
          fotoUrlParaPayload !== null &&
          fotoUrlParaPayload !== undefined &&
          fotoUrlParaPayload.startsWith('file://');

        if (esFotoLocal && fotoUrlParaPayload) {
          try {
            console.log(`📸 [SyncService] Subiendo foto local de lote ${lote.id_local} a Cloudinary...`);
            const secureUrl = await subirFotoACloudinary(fotoUrlParaPayload);
            if (secureUrl) {
              fotoUrlParaPayload = secureUrl;

              // Actualizamos localmente para persistir el avance de inmediato
              const db = await getDb();
              await db.runAsync(
                'UPDATE lote SET foto_siembra_url = ? WHERE id_local = ?',
                secureUrl,
                lote.id_local
              );
              console.log(`📸 [SyncService] Foto subida y guardada localmente para lote ${lote.id_local}: ${secureUrl}`);
            } else {
              console.warn(`📸 [SyncService] No se pudo subir la foto del lote ${lote.id_local} a Cloudinary. Sincronización de este lote pospuesta.`);
              continue; // ⚠️ NO enviar el lote a Supabase si falla la subida de la foto
            }
          } catch (errorFoto: unknown) {
            console.error(`📸 [SyncService] Error al subir foto de lote ${lote.id_local} a Cloudinary. Sincronización pospuesta:`, errorFoto);
            continue; // ⚠️ NO enviar el lote a Supabase si falla la subida de la foto
          }
        }

        const payload = {
          id_productor: lote.id_productor,
          nombre_lote: lote.nombre_lote,
          superficie: lote.superficie,
          fecha_siembra: lote.fecha_siembra,
          fecha_cosecha_est: lote.fecha_cosecha_est,
          fecha_cosecha_real: lote.fecha_cosecha_real,
          foto_siembra_url: fotoUrlParaPayload, // URL de Cloudinary o null

          ubicacion: lote.ubicacion || 'No especificada',
          estado: 'ACTIVO',
          id_usuario: lote.id_productor,
          updated_at: new Date().toISOString(),
        };

        // ── Upsert vs Insert según si ya tiene id_servidor ─────────────────
        const operacion = lote.id_servidor
          ? supabase
            .from('lote')
            .upsert({ id_lote: lote.id_servidor, ...payload })
            .select('id_lote')
            .single()
          : supabase
            .from('lote')
            .insert(payload)
            .select('id_lote')
            .single();

        const { data: dataResult, error: queryError } = await operacion;

        // ── Manejo de error de Supabase ────────────────────────────────────
        if (queryError) {
          const esError401 =
            (queryError as any)?.status === 401 ||
            queryError.message?.toLowerCase().includes('jwt') ||
            queryError.message?.toLowerCase().includes('invalid token') ||
            queryError.message?.toLowerCase().includes('unauthorized') ||
            queryError.message?.toLowerCase().includes('not authenticated') ||
            queryError.code === 'PGRST301'; // PostgREST: JWT expired

          if (esError401) {
            console.error(
              `[SyncService] 🔒 Error 401/JWT al sincronizar lote ${lote.id_local}. ` +
              'El registro permanece pendiente hasta que el usuario re-autentique. ' +
              `Detalle: ${queryError.message}`
            );
            detenerPorAuth = true;
            _ultimaRazonDetencion = 'error_401';
            break;
          }

          console.warn(
            `[SyncService] ⚠️  Error al sincronizar lote ${lote.id_local}: ` +
            `${queryError.message}. Reintentando en el próximo ciclo.`
          );
          continue; // Siguiente lote
        }

        // ── Éxito: marcar sincronización en SQLite ────────────────────────────
        if (dataResult) {
          const idServidor = (dataResult as { id_lote: number }).id_lote;

          // Todo exitoso (incluyendo foto), marcar como sincronizado en SQLite
          await marcarLoteComoSincronizado(lote.id_local, idServidor);
          console.log(
            `[SyncService] ✅ Lote local ${lote.id_local} sincronizado completamente ` +
            `con ID servidor: ${idServidor}`
          );

          procesados++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const esError401 =
          msg.toLowerCase().includes('401') ||
          msg.toLowerCase().includes('jwt') ||
          msg.toLowerCase().includes('unauthorized');

        if (esError401) {
          console.error(
            `[SyncService] 🔒 Excepción 401/JWT en lote ${lote.id_local}. ` +
            'Deteniendo sync. El usuario debe re-autenticarse.'
          );
          detenerPorAuth = true;
          _ultimaRazonDetencion = 'error_401';
          break;
        }

        console.warn(
          `[SyncService] ⚠️  Excepción en lote ${lote.id_local}: ${msg}. ` +
          'El registro permanece pendiente para el próximo ciclo.'
        );
      }
    }

    // ── 6. Resultado final ───────────────────────────────────────────────────
    const exitoso = !detenerPorAuth;
    if (!_ultimaRazonDetencion) {
      _ultimaRazonDetencion = procesados > 0 ? null : 'sin_pendientes';
    }

    console.log(
      `[SyncService] Ciclo completado. Procesados: ${procesados}/${lotesPendientes.length}. ` +
      `Razón de parada: ${_ultimaRazonDetencion ?? 'completado_ok'}`
    );

    return { exitoso, procesados, razonDetencion: _ultimaRazonDetencion };

  } catch (errorGeneral: unknown) {
    const msg = errorGeneral instanceof Error ? errorGeneral.message : String(errorGeneral);
    console.error(`[SyncService] ❌ Error general inesperado en syncLocalDataToCloud: ${msg}`);
    _ultimaRazonDetencion = 'error_inesperado';
    return { exitoso: false, procesados, razonDetencion: 'error_inesperado' };

  } finally {
    sincronizando = false;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 🌐 Sync de productos pendientes con traducción de IDs (Offline-First)
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Sincroniza el catálogo de productos pendientes (sincronizado = 0) con el
 * backend, resolviendo previamente el mapeo de IDs locales a IDs servidor.
 *
 * Problema resuelto:
 *   En modo offline, LOTE_PRODUCTO se crea con un id_lote_producto local
 *   (ej. 5). Al sincronizar, Supabase genera su propio ID (ej. 104). Sin esta
 *   función, el backend recibiría el ID local 5, que no existe en Supabase y
 *   rompería la FK `fk_producto_lote_producto`.
 *
 * Modo seguro:
 *   Si `resolverIdLoteProductoServidor` devuelve null (lote aún no
 *   sincronizado), el producto se envía con `id_lote_producto: null`.
 *   El backend acepta NULL gracias a `ON DELETE SET NULL` en el esquema.
 *
 * @param token - JWT de sesión para autorizar la petición al backend.
 */
export async function syncProductosPendientes(token: string): Promise<void> {
  try {
    const db = await getDb();

    // Obtener productos aún no sincronizados con el servidor
    const productosPendientes = await db.getAllAsync<{
      id_producto: number;
      nombre: string;
      rubro: string;
      id_lote_producto: number | null;
      estado: string;
    }>(
      `SELECT id_producto, nombre, rubro, id_lote_producto, estado
       FROM PRODUCTO
       WHERE sincronizado = 0`
    );

    if (productosPendientes.length === 0) {
      console.log('[SyncService] ✅ No hay productos pendientes de sincronización.');
      return;
    }

    console.log(
      `[SyncService] 🔄 Sincronizando ${productosPendientes.length} producto(s) pendientes...`
    );

    // ── Traducción de IDs: local → servidor ───────────────────────────────────
    const productosConIdsMapeados = await Promise.all(
      productosPendientes.map(async (producto) => {
        // Resuelve el id_lote_producto local al ID real de Supabase.
        // Si el lote_producto aún no se sincronizó, devuelve null (modo seguro).
        const idLoteProductoServidor = await resolverIdLoteProductoServidor(
          producto.id_lote_producto
        );

        return {
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          rubro: producto.rubro,
          estado: producto.estado ?? 'ACTIVO',
          sincronizado: true,
          // null si la relación aún no tiene ID servidor → el backend acepta NULL
          id_lote_producto: idLoteProductoServidor,
        };
      })
    );

    // ── POST al backend ─────────────────────────────────────────────────────
    const { sincronizarProductosApi } = await import(
      '../core/network/api/productos'
    );
    const respuesta = await sincronizarProductosApi(productosConIdsMapeados);

    if (!respuesta?.success) {
      console.warn('[SyncService] ⚠️  El backend no confirmó la sincronización de productos.');
      return;
    }

    // ── Marcar como sincronizados en SQLite ─────────────────────────────────
    const idsLocales = productosPendientes.map((p) => p.id_producto);
    if (idsLocales.length > 0) {
      const placeholders = idsLocales.map(() => '?').join(', ');
      await db.runAsync(
        `UPDATE PRODUCTO SET sincronizado = 1 WHERE id_producto IN (${placeholders})`,
        ...idsLocales
      );
    }

    console.log(
      `[SyncService] ✅ ${productosPendientes.length} producto(s) sincronizados correctamente.`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SyncService] ⚠️  Error en syncProductosPendientes (no crítico): ${msg}`);
    // No relanzamos — la sincronización principal no debe crashear por esto.
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 🎯 Helper: Estado de sesión para la UI
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Devuelve si el SyncService está bloqueado esperando re-autenticación.
 * La UI puede usar esto para mostrar un banner "Inicia sesión para sincronizar".
 */
export function syncBloqueadoPorAuth(): boolean {
  return _ultimaRazonDetencion === 'error_401' || _ultimaRazonDetencion === 'sin_sesion';
}
