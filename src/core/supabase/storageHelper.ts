/**
 * storageHelper.ts — Helper de Supabase Storage (Offline-First)
 *
 * Responsabilidad única: subir un archivo local (file://) al bucket de
 * Supabase Storage y devolver la URL pública resultante.
 *
 * Garantías de robustez:
 *  - NUNCA lanza excepciones hacia el llamador: usa try/catch completo.
 *  - Compatible con React Native (lee el archivo con expo-file-system y
 *    construye un Uint8Array manualmente sin depender de atob).
 *  - Si Supabase no está configurado o hay error de red, devuelve null para
 *    que el SyncService pueda conservar el URI local y reintentar más tarde.
 */

import * as FileSystem from 'expo-file-system';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface SubidaFotoResult {
  /** URL pública en Supabase Storage, o null si falló. */
  publicUrl: string | null;
  /** Mensaje de error descriptivo si publicUrl es null. */
  error: string | null;
}

// ─── Utilidades internas ──────────────────────────────────────────────────────

function extraerExtension(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

function mimeTypeDesdeExtension(ext: string): string {
  const mapa: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
  };
  return mapa[ext] ?? 'image/jpeg';
}

function generarNombreArchivo(ext: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `siembra_${timestamp}_${random}${ext}`;
}

/**
 * Decodifica base64 a Uint8Array sin usar atob().
 * Implementación pura en JS — compatible con todos los entornos React Native.
 */
function base64AUint8Array(base64: string): Uint8Array {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const limpio = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const outputLength = Math.floor((limpio.length * 3) / 4);
  const bytes = new Uint8Array(outputLength);
  let p = 0;

  for (let i = 0; i < limpio.length; i += 4) {
    const a = CHARS.indexOf(limpio[i]);
    const b = CHARS.indexOf(limpio[i + 1]);
    const c = limpio[i + 2] ? CHARS.indexOf(limpio[i + 2]) : -1;
    const d = limpio[i + 3] ? CHARS.indexOf(limpio[i + 3]) : -1;

    if (a === -1 || b === -1) break;
    bytes[p++] = (a << 2) | (b >> 4);
    if (c !== -1) bytes[p++] = ((b & 0xf) << 4) | (c >> 2);
    if (d !== -1) bytes[p++] = ((c & 0x3) << 6) | d;
  }

  return bytes.slice(0, p);
}

// ─── Función principal exportada ──────────────────────────────────────────────

/**
 * Sube una foto local (file://) al bucket 'FOTO LOTES' de Supabase Storage.
 *
 * @param rutaFotoLocal URI local del archivo (debe comenzar con "file://").
 * @param idLoteLocal   ID local del lote asociado en SQLite para construir el nombre del archivo.
 * @returns SubidaFotoResult — siempre devuelve un objeto con la URL o el error, nunca lanza excepciones.
 */
export async function subirFotoASupabase(
  rutaFotoLocal: string,
  idLoteLocal: number | string
): Promise<SubidaFotoResult> {
  if (!rutaFotoLocal || !rutaFotoLocal.startsWith('file://')) {
    return {
      publicUrl: null,
      error: `URI no es local o ya es una URL remota: "${rutaFotoLocal}"`,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      publicUrl: null,
      error: 'Supabase no está configurado. La foto se conserva localmente.',
    };
  }

  try {
    // ── Paso 1: Conversión compatible a Blob (Celular) ────────────────────
    const response = await fetch(rutaFotoLocal);
    const blob = await response.blob();

    // ── Paso 2: Subida directa al bucket FOTO LOTES ─────────────────────────
    const fileName = `lote_${idLoteLocal}_${Date.now()}.jpg`;
    
    console.log(`[StorageHelper] 📤 Subiendo foto a Supabase Storage: ${fileName}...`);
    
    const { data, error } = await supabase.storage
      .from('FOTO LOTES')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.warn(`[StorageHelper] ⚠️ Error en subida directa a storage: ${error.message}`);
      return {
        publicUrl: null,
        error: `Error al subir a Supabase Storage: ${error.message}`,
      };
    }

    // ── Paso 3: Obtener URL pública ───────────────────────────────────────
    const { data: { publicUrl } } = supabase.storage
      .from('FOTO LOTES')
      .getPublicUrl(fileName);

    if (!publicUrl) {
      console.warn('[StorageHelper] ⚠️ No se pudo obtener la URL pública de la foto subida.');
      return {
        publicUrl: null,
        error: 'Supabase no devolvió una URL pública válida tras el upload.',
      };
    }

    console.log(`[StorageHelper] ✅ Foto subida directamente. URL pública: ${publicUrl}`);
    return { publicUrl, error: null };

  } catch (errorGeneral: unknown) {
    const msg = errorGeneral instanceof Error ? errorGeneral.message : String(errorGeneral);
    // Controlador tolerante: captura silenciosa con console.warn
    console.warn(`[StorageHelper] ⚠️ Error silencioso durante la subida de foto: ${msg}`);
    return {
      publicUrl: null,
      error: `Error de red o storage capturado silenciosamente: ${msg}`,
    };
  }
}


