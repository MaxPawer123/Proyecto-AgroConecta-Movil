import { useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '@/src/core/database/sqlite.config';
import { registrarProductorApi, iniciarSesionApi } from '@/src/core/network/api/auth';

type RegistroProductorInput = {
  nombre: string;
  apellido: string;
  telefono: string;
  departamento: string;
  municipio: string;
  comunidad: string;
};

type RegistroProductorResult = {
  idUsuario: number;
  idProductor: number;
};

type DesbloqueoResult = {
  desbloqueado: boolean;
  metodo: 'biometria' | 'ninguno';
  idUsuario?: number;
};

type SesionLocal = {
  activa: boolean;
  idUsuario: number | null;
};

type ColumnInfo = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

const TABLAS_USUARIO = ['usuario', 'usuarios'];
const TABLAS_PRODUCTOR = ['productor', 'productores'];

async function columnasTabla(db: Awaited<ReturnType<typeof getDb>>, tabla: string): Promise<ColumnInfo[]> {
  try {
    return await db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${tabla})`);
  } catch {
    return [];
  }
}

async function existeTabla(db: Awaited<ReturnType<typeof getDb>>, tabla: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ existe: number }>(
    'SELECT COUNT(*) as existe FROM sqlite_master WHERE type = ? AND name = ?',
    'table',
    tabla
  );

  return Number(row?.existe ?? 0) > 0;
}

async function resolverTabla(db: Awaited<ReturnType<typeof getDb>>, candidatas: string[]): Promise<string> {
  for (const tabla of candidatas) {
    if (await existeTabla(db, tabla)) {
      return tabla;
    }
  }

  return candidatas[0];
}

async function asegurarEsquemaAuth(db: Awaited<ReturnType<typeof getDb>>): Promise<{ tablaUsuario: string; tablaProductor: string }> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS usuario (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'productor',
      estado TEXT DEFAULT 'activo',
      telefono TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      fecha_registro TEXT NOT NULL DEFAULT (datetime('now')),
      sincronizado INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS productor (
      id_productor INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER UNIQUE NOT NULL,
      pin TEXT,
      departamento TEXT NOT NULL,
      municipio TEXT NOT NULL,
      comunidad TEXT NOT NULL,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auth_sesion (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      id_usuario INTEGER,
      activa INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const tablaUsuario = await resolverTabla(db, TABLAS_USUARIO);
  const tablaProductor = await resolverTabla(db, TABLAS_PRODUCTOR);

  const migracionesUsuario = [
    `ALTER TABLE ${tablaUsuario} ADD COLUMN nombre TEXT`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN apellido TEXT`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN rol TEXT NOT NULL DEFAULT 'productor'`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN estado TEXT DEFAULT 'activo'`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN telefono TEXT`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN password_hash TEXT`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN fecha_registro TEXT`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 0`,
  ];

  const migracionesProductor = [
    `ALTER TABLE ${tablaProductor} ADD COLUMN pin TEXT`,
    `ALTER TABLE ${tablaProductor} ADD COLUMN departamento TEXT`,
    `ALTER TABLE ${tablaProductor} ADD COLUMN municipio TEXT`,
    `ALTER TABLE ${tablaProductor} ADD COLUMN comunidad TEXT`,
    `ALTER TABLE ${tablaProductor} ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 0`,
  ];

  for (const sql of [...migracionesUsuario, ...migracionesProductor]) {
    try {
      await db.runAsync(sql);
    } catch {
      // Ignora cuando la columna ya existe o la migracion no aplica en una base previa.
    }
  }

  for (const indice of [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_telefono ON ${tablaUsuario}(telefono)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_productor_id_usuario ON ${tablaProductor}(id_usuario)`,
  ]) {
    try {
      await db.runAsync(indice);
    } catch {
      // Si hay datos heredados duplicados, se mantiene el acceso al esquema sin bloquear el login.
    }
  }

  return { tablaUsuario, tablaProductor };
}

function generarTokenLocal(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function valorRequeridoUsuario(columna: string, input: RegistroProductorInput, tokenLocal: string): string | number | null | undefined {
  const nombreCompleto = `${input.nombre.trim()} ${input.apellido.trim()}`.trim();

  switch (columna) {
    case 'nombre':
      return input.nombre.trim();
    case 'apellido':
      return input.apellido.trim();
    case 'nombre_completo':
      return nombreCompleto;
    case 'rol':
      return 'productor';
    case 'estado':
      return 'activo';
    case 'telefono':
      return input.telefono.trim();
    case 'password_hash':
      return tokenLocal;
    case 'fecha_registro':
      return new Date().toISOString();
    case 'sincronizado':
      return 0;
    default:
      return undefined;
  }
}

function valorRequeridoProductor(columna: string, input: RegistroProductorInput, tokenLocal: string, idUsuario: number): string | number | null | undefined {
  switch (columna) {
    case 'id_usuario':
      return idUsuario;
    case 'pin':
      return tokenLocal;
    case 'departamento':
      return input.departamento.trim();
    case 'municipio':
      return input.municipio.trim();
    case 'comunidad':
      return input.comunidad.trim();
    case 'telefono':
      return input.telefono.trim();
    case 'sincronizado':
      return 0;
    default:
      return undefined;
  }
}

function armarInsertDinamico(
  columnas: ColumnInfo[],
  resolverValor: (nombreColumna: string) => string | number | null | undefined
): { columnasSql: string[]; valoresSql: Array<string | number | null> } {
  const columnasSql: string[] = [];
  const valoresSql: Array<string | number | null> = [];

  for (const columna of columnas) {
    if (columna.pk === 1) continue;

    const valor = resolverValor(columna.name);
    const tieneDefault = columna.dflt_value !== null;

    if (valor !== undefined) {
      columnasSql.push(columna.name);
      valoresSql.push(valor);
      continue;
    }

    if (columna.notnull === 1 && !tieneDefault) {
      throw new Error(`No se pudo resolver el valor obligatorio de la columna ${columna.name}.`);
    }
  }

  return { columnasSql, valoresSql };
}

async function limpiarDatosAuthLocal(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  const { tablaUsuario, tablaProductor } = await asegurarEsquemaAuth(db);

  await db.runAsync(`DELETE FROM ${tablaProductor}`);
  await db.runAsync(`DELETE FROM ${tablaUsuario}`);
  await db.runAsync('DELETE FROM auth_sesion WHERE id = 1');
}

async function abrirSesionLocal(db: Awaited<ReturnType<typeof getDb>>, idUsuario: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO auth_sesion (id, id_usuario, activa, updated_at)
     VALUES (1, ?, 1, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       id_usuario = excluded.id_usuario,
       activa = excluded.activa,
       updated_at = excluded.updated_at`,
    idUsuario
  );

  await AsyncStorage.setItem('sesion_activa', 'true');
  await AsyncStorage.setItem('id_usuario', idUsuario.toString());
}

async function marcarSesionLocalCerrada(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  await asegurarEsquemaAuth(db);
  await db.runAsync(
    `INSERT INTO auth_sesion (id, id_usuario, activa, updated_at)
     VALUES (1, NULL, 0, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       id_usuario = excluded.id_usuario,
       activa = excluded.activa,
       updated_at = excluded.updated_at`
  );
}

async function obtenerSesionLocal(db: Awaited<ReturnType<typeof getDb>>): Promise<SesionLocal> {
  await asegurarEsquemaAuth(db);

  const row = await db.getFirstAsync<{ id_usuario: number | null; activa: number }>(
    'SELECT id_usuario, activa FROM auth_sesion WHERE id = 1'
  );

  return {
    activa: Number(row?.activa ?? 0) === 1,
    idUsuario: row?.id_usuario !== null && row?.id_usuario !== undefined ? Number(row.id_usuario) : null,
  };
}

/**
 * Registra al productor en el servidor y devuelve el token JWT si el servidor lo proporciona.
 * Devuelve null si falla la red o el servidor no devuelve token.
 */
async function sincronizarRegistroEnBackend(
  input: RegistroProductorInput
): Promise<{ token: string; idUsuario: number; idProductor: number } | null> {
  try {
    const resServer = await registrarProductorApi({
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim(),
      telefono: input.telefono.trim(),
      departamento: input.departamento.trim(),
      municipio: input.municipio.trim(),
      comunidad: input.comunidad.trim(),
    });

    if (resServer?.token && resServer?.data?.id_usuario) {
      return {
        token: resServer.token,
        idUsuario: Number(resServer.data.id_usuario),
        idProductor: Number(resServer.data.id_productor),
      };
    }

    return null;
  } catch (error) {
    console.warn('No se pudo sincronizar el registro con el backend:', error);
    return null;
  }
}

// ─── Login con teléfono + PIN (⚡ persiste el JWT inmediatamente) ─────────────
/**
 * Autentica al usuario usando teléfono + PIN contra el backend.
 * Al éxito, guarda el token JWT en AsyncStorage con AMBAS claves
 * (@jwt_token  y  jwt_token) para que el interceptor HTTP lo encuentre
 * sin importar qué clave busque primero.
 *
 * @throws Error si las credenciales son inválidas o no hay conexión.
 */
async function loginConTelefonoYPin(
  telefono: string,
  pin: string
): Promise<{ token: string; idUsuario: number; idProductor: number }> {
  const response = await iniciarSesionApi({ telefono: telefono.trim(), pin: pin.trim() });

  // — Persistir el JWT — ésta es la clave para que el interceptor HTTP lo encuentre
  await AsyncStorage.multiSet([
    ['@jwt_token',    response.token],
    ['jwt_token',     response.token],    // clave de compatibilidad (api.js legado)
    ['@id_usuario',   String(response.data.id_usuario)],
    ['id_usuario',    String(response.data.id_usuario)],
    ['@id_productor', String(response.data.id_productor)],
    ['id_productor',  String(response.data.id_productor)],
    ['@isLoggedIn',   'true'],
    ['sesion_activa', 'true'],
    ['@user_name',    `${response.data.nombre} ${response.data.apellido}`.trim()],
  ]);

  console.log(
    '✅ [useAuthLocal] JWT guardado en AsyncStorage.\n' +
    `   Usuario: ${response.data.nombre} ${response.data.apellido}\n` +
    `   id_usuario: ${response.data.id_usuario} | id_productor: ${response.data.id_productor}\n` +
    `   Token (primeros 30 chars): ${response.token.slice(0, 30)}...`
  );

  return {
    token:       response.token,
    idUsuario:   Number(response.data.id_usuario),
    idProductor: Number(response.data.id_productor),
  };
}

export function useAuthLocal() {
  const verificarCuentaExistente = useCallback(async (): Promise<boolean> => {
    const db = await getDb();
    const { tablaUsuario } = await asegurarEsquemaAuth(db);

    const row = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) as total FROM ${tablaUsuario}`);
    return Number(row?.total ?? 0) > 0;
  }, []);

  const registrarProductor = useCallback(async (input: RegistroProductorInput): Promise<RegistroProductorResult> => {
    const nombre = input.nombre.trim();
    const apellido = input.apellido.trim();
    const telefono = input.telefono.trim();
    const departamento = input.departamento.trim();
    const municipio = input.municipio.trim();
    const comunidad = input.comunidad.trim();
    const tokenLocal = generarTokenLocal();

    if (!nombre || !apellido || !telefono || !departamento || !municipio || !comunidad) {
      throw new Error('Completa todos los campos obligatorios para registrar al productor.');
    }

    const db = await getDb();
    const { tablaUsuario, tablaProductor } = await asegurarEsquemaAuth(db);
    const columnasUsuario = await columnasTabla(db, tablaUsuario);
    const columnasProductor = await columnasTabla(db, tablaProductor);

    let idUsuario = 0;
    let idProductor = 0;

    await db.withTransactionAsync(async () => {
      const insertUsuario = armarInsertDinamico(columnasUsuario, (nombreColumna) =>
        valorRequeridoUsuario(nombreColumna, input, tokenLocal)
      );

      const resultUsuario = await db.runAsync(
        `INSERT INTO ${tablaUsuario} (${insertUsuario.columnasSql.join(', ')}) VALUES (${insertUsuario.columnasSql
          .map(() => '?')
          .join(', ')})`,
        ...insertUsuario.valoresSql
      );

      idUsuario = Number(resultUsuario.lastInsertRowId);
      if (!idUsuario) {
        throw new Error('No se pudo obtener el ID del usuario registrado.');
      }

      const insertProductor = armarInsertDinamico(columnasProductor, (nombreColumna) =>
        valorRequeridoProductor(nombreColumna, input, tokenLocal, idUsuario)
      );

      const resultProductor = await db.runAsync(
        `INSERT INTO ${tablaProductor} (${insertProductor.columnasSql.join(', ')}) VALUES (${insertProductor.columnasSql
          .map(() => '?')
          .join(', ')})`,
        ...insertProductor.valoresSql
      );

      idProductor = Number(resultProductor.lastInsertRowId);
      if (!idProductor) {
        throw new Error('No se pudo obtener el ID del perfil de productor.');
      }

      await abrirSesionLocal(db, idUsuario);
    });

    // ✅ CORRECCIÓN CRÍTICA: Esperar la respuesta del servidor para guardar el token JWT.
    // Antes se usaba void (fire-and-forget), descartando el token y causando
    // "Token no proporcionado" en todas las peticiones protegidas posteriores.
    try {
      const resServidor = await sincronizarRegistroEnBackend({
        nombre,
        apellido,
        telefono,
        departamento,
        municipio,
        comunidad,
      });

      if (resServidor?.token) {
        // ✅ Guardar el JWT del servidor + IDs reales en AsyncStorage
        await AsyncStorage.multiSet([
          ['@jwt_token',    resServidor.token],
          ['jwt_token',     resServidor.token],   // compatibilidad con api.js
          ['@id_usuario',   String(resServidor.idUsuario)],
          ['id_usuario',    String(resServidor.idUsuario)],
          ['@id_productor', String(resServidor.idProductor)],
          ['id_productor',  String(resServidor.idProductor)],
          ['@isLoggedIn',   'true'],
          ['sesion_activa', 'true'],
          ['@user_name',    `${nombre} ${apellido}`.trim()],
        ]);

        // Actualizar IDs reales en SQLite (sin perder FKs)
        await db.execAsync('PRAGMA foreign_keys = OFF');
        try {
          await db.runAsync(
            'UPDATE usuario SET id_usuario = ?, sincronizado = 1 WHERE id_usuario = ?',
            resServidor.idUsuario, idUsuario
          );
          await db.runAsync(
            'UPDATE productor SET id_productor = ?, id_usuario = ?, sincronizado = 1 WHERE id_productor = ?',
            resServidor.idProductor, resServidor.idUsuario, idProductor
          );
          await db.runAsync(
            'UPDATE auth_sesion SET id_usuario = ? WHERE id_usuario = ?',
            resServidor.idUsuario, idUsuario
          );
        } finally {
          await db.execAsync('PRAGMA foreign_keys = ON');
        }

        console.log('✅ [useAuthLocal] JWT guardado. El productor puede sincronizar de inmediato.');
        return { idUsuario: resServidor.idUsuario, idProductor: resServidor.idProductor };
      } else {
        // Sin conexión: guardar solo las claves de sesión local (sin JWT)
        await AsyncStorage.multiSet([
          ['@id_usuario',   String(idUsuario)],
          ['id_usuario',    String(idUsuario)],
          ['@id_productor', String(idProductor)],
          ['id_productor',  String(idProductor)],
          ['@isLoggedIn',   'true'],
          ['@user_name',    `${nombre} ${apellido}`.trim()],
        ]);
        console.warn('⚠️ [useAuthLocal] Registro offline. JWT pendiente hasta la próxima sincronización.');
      }
    } catch (syncError) {
      console.warn('⚠️ [useAuthLocal] Error en sincronización post-registro:', syncError);
    }

    return { idUsuario, idProductor };
  }, []);

  const desbloquearApp = useCallback(async (): Promise<DesbloqueoResult> => {
    const db = await getDb();
    const { tablaUsuario } = await asegurarEsquemaAuth(db);
    const sesion = await obtenerSesionLocal(db);

    if (sesion.activa && sesion.idUsuario) {
      return { desbloqueado: true, metodo: 'ninguno', idUsuario: sesion.idUsuario };
    }

    const tieneHardware = await LocalAuthentication.hasHardwareAsync();
    const tieneBiometriaRegistrada = await LocalAuthentication.isEnrolledAsync();

    if (!tieneHardware || !tieneBiometriaRegistrada) {
      return { desbloqueado: false, metodo: 'ninguno' };
    }

    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear AgroConecta',
      disableDeviceFallback: true,
    });

    if (!auth.success) {
      return { desbloqueado: false, metodo: 'biometria' };
    }

    const row = await db.getFirstAsync<{ id_usuario: number }>(`SELECT id_usuario FROM ${tablaUsuario} ORDER BY id_usuario DESC LIMIT 1`);
    if (row?.id_usuario) {
      await abrirSesionLocal(db, Number(row.id_usuario));
      return { desbloqueado: true, metodo: 'biometria', idUsuario: Number(row.id_usuario) };
    }

    return { desbloqueado: false, metodo: 'biometria' };
  }, []);

  const cerrarSesionLocal = useCallback(async (): Promise<void> => {
    const db = await getDb();
    await asegurarEsquemaAuth(db);
    try {
      await limpiarDatosAuthLocal(db);
      await marcarSesionLocalCerrada(db);
    } finally {
      // ✅ Limpiar TODAS las claves de sesión, incluyendo el token JWT
      await AsyncStorage.multiRemove([
        'sesion_activa',
        'id_usuario',
        '@jwt_token',
        'jwt_token',
        '@id_usuario',
        '@id_productor',
        'id_productor',
        '@isLoggedIn',
        '@user_name',
      ]);
    }
  }, []);

  const cerrarSesion = useCallback(async (): Promise<void> => {
    await cerrarSesionLocal();
  }, [cerrarSesionLocal]);

  const resolverRutaInicial = useCallback(async (): Promise<'/auth/registro' | '/(tabs)'> => {
    const db = await getDb();

    const sesion = await obtenerSesionLocal(db);
    if (sesion.activa && sesion.idUsuario) {
      return '/(tabs)';
    }

    return '/auth/registro';
  }, []);

  const iniciarSesion = useCallback(async (
    telefono: string,
    pin: string
  ): Promise<{ token: string; idUsuario: number; idProductor: number }> => {
    const db = await getDb();
    const resultado = await loginConTelefonoYPin(telefono, pin);

    // Actualizar sesión local en SQLite para que resolverRutaInicial funcione
    await abrirSesionLocal(db, resultado.idUsuario);

    return resultado;
  }, []);

  return {
    registrarProductor,
    iniciarSesion,
    desbloquearApp,
    verificarCuentaExistente,
    cerrarSesionLocal,
    cerrarSesion,
    resolverRutaInicial,
  };
}

export type { RegistroProductorInput, RegistroProductorResult, DesbloqueoResult, SesionLocal };
