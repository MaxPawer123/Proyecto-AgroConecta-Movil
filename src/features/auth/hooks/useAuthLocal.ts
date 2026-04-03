import { useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { getDb } from '@/src/services/sqlite';
import { hashearPin } from '../utils/crypto';

type RegistroProductorInput = {
  nombre: string;
  apellido: string;
  telefono: string;
  pin: string;
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
  metodo: 'biometria' | 'pin' | 'ninguno';
  idUsuario?: number;
};

type CambiarPinInput = {
  pinActual: string;
  pinNuevo: string;
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
      correo TEXT UNIQUE,
      telefono TEXT UNIQUE NOT NULL,
      contrasena TEXT,
      fecha_registro TEXT NOT NULL DEFAULT (datetime('now')),
      sincronizado INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS productor (
      id_productor INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER UNIQUE NOT NULL,
      pin_hash TEXT NOT NULL,
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
    `ALTER TABLE ${tablaUsuario} ADD COLUMN correo TEXT UNIQUE`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN telefono TEXT UNIQUE`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN contrasena TEXT`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN fecha_registro TEXT`,
    `ALTER TABLE ${tablaUsuario} ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 0`,
  ];

  const migracionesProductor = [
    `ALTER TABLE ${tablaProductor} ADD COLUMN pin_hash TEXT`,
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

  return { tablaUsuario, tablaProductor };
}

function valorRequeridoUsuario(columna: string, input: RegistroProductorInput, pinHash: string): string | number | null | undefined {
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
    case 'correo':
    case 'email':
      return `${input.telefono.trim()}@agro.local`;
    case 'contrasena':
    case 'password_hash':
      return pinHash;
    case 'fecha_registro':
      return new Date().toISOString();
    case 'sincronizado':
      return 0;
    default:
      return undefined;
  }
}

function valorRequeridoProductor(columna: string, input: RegistroProductorInput, pinHash: string, idUsuario: number): string | number | null | undefined {
  switch (columna) {
    case 'id_usuario':
      return idUsuario;
    case 'pin_hash':
    case 'pin':
      return pinHash;
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

async function obtenerPinHashGuardado(db: Awaited<ReturnType<typeof getDb>>, tablaProductor: string): Promise<string | null> {
  const columnas = await columnasTabla(db, tablaProductor);
  const nombres = new Set(columnas.map((c) => c.name));

  const campoHash = nombres.has('pin_hash') ? 'pin_hash' : nombres.has('pin') ? 'pin' : null;
  if (!campoHash) return null;

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT ${campoHash} as pin_guardado FROM ${tablaProductor} WHERE ${campoHash} IS NOT NULL ORDER BY id_productor DESC LIMIT 1`
  );

  if (!row) return null;
  const valor = row.pin_guardado;
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

async function abrirSesionLocal(db: Awaited<ReturnType<typeof getDb>>, idUsuario: number): Promise<void> {
  await db.runAsync(
    `
      INSERT INTO auth_sesion (id, id_usuario, activa, updated_at)
      VALUES (1, ?, 1, ?)
      ON CONFLICT(id) DO UPDATE SET
        id_usuario = excluded.id_usuario,
        activa = excluded.activa,
        updated_at = excluded.updated_at
    `,
    idUsuario,
    new Date().toISOString()
  );
}

async function cerrarSesionLocal(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  await db.runAsync(
    `
      INSERT INTO auth_sesion (id, id_usuario, activa, updated_at)
      VALUES (1, NULL, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        id_usuario = excluded.id_usuario,
        activa = excluded.activa,
        updated_at = excluded.updated_at
    `,
    new Date().toISOString()
  );
}

async function obtenerSesionLocal(db: Awaited<ReturnType<typeof getDb>>): Promise<SesionLocal> {
  const row = await db.getFirstAsync<{ id_usuario: number | null; activa: number | null }>(
    'SELECT id_usuario, activa FROM auth_sesion WHERE id = 1 LIMIT 1'
  );

  return {
    idUsuario: row?.id_usuario ?? null,
    activa: Number(row?.activa ?? 0) === 1,
  };
}

async function obtenerCredencialesRecientes(
  db: Awaited<ReturnType<typeof getDb>>,
  tablaProductor: string
): Promise<{ idUsuario: number; pinHash: string } | null> {
  const columnas = await columnasTabla(db, tablaProductor);
  const nombres = new Set(columnas.map((c) => c.name));

  const campoHash = nombres.has('pin_hash') ? 'pin_hash' : nombres.has('pin') ? 'pin' : null;
  if (!campoHash) return null;

  const row = await db.getFirstAsync<{ id_usuario: number; pin_guardado: string }>(
    `
      SELECT id_usuario, ${campoHash} as pin_guardado
      FROM ${tablaProductor}
      WHERE ${campoHash} IS NOT NULL
      ORDER BY id_productor DESC
      LIMIT 1
    `
  );

  if (!row?.id_usuario || !row?.pin_guardado) return null;

  return {
    idUsuario: Number(row.id_usuario),
    pinHash: String(row.pin_guardado),
  };
}

export function useAuthLocal() {
  const registrarProductor = useCallback(async (input: RegistroProductorInput): Promise<RegistroProductorResult> => {
    const nombre = input.nombre.trim();
    const apellido = input.apellido.trim();
    const telefono = input.telefono.trim();
    const departamento = input.departamento.trim();
    const municipio = input.municipio.trim();
    const comunidad = input.comunidad.trim();

    if (!nombre || !apellido || !telefono || !departamento || !municipio || !comunidad) {
      throw new Error('Completa todos los campos obligatorios para registrar al productor.');
    }

    const pinHash = await hashearPin(input.pin);
    const db = await getDb();
    const { tablaUsuario, tablaProductor } = await asegurarEsquemaAuth(db);
    const columnasUsuario = await columnasTabla(db, tablaUsuario);
    const columnasProductor = await columnasTabla(db, tablaProductor);

    let idUsuario = 0;
    let idProductor = 0;

    await db.withTransactionAsync(async () => {
      const insertUsuario = armarInsertDinamico(columnasUsuario, (nombreColumna) =>
        valorRequeridoUsuario(nombreColumna, input, pinHash)
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
        valorRequeridoProductor(nombreColumna, input, pinHash, idUsuario)
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

    return { idUsuario, idProductor };
  }, []);

  const desbloquearApp = useCallback(async (pinIngresado?: string): Promise<DesbloqueoResult> => {
    const db = await getDb();
    const { tablaProductor } = await asegurarEsquemaAuth(db);
    const credenciales = await obtenerCredencialesRecientes(db, tablaProductor);

    const tieneHardware = await LocalAuthentication.hasHardwareAsync();
    const tieneBiometriaRegistrada = await LocalAuthentication.isEnrolledAsync();

    if (tieneHardware && tieneBiometriaRegistrada) {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear AgroConecta',
        cancelLabel: 'Usar PIN',
        disableDeviceFallback: true,
      });

      if (auth.success) {
        if (credenciales) {
          await abrirSesionLocal(db, credenciales.idUsuario);
        }
        return { desbloqueado: true, metodo: 'biometria', idUsuario: credenciales?.idUsuario };
      }
    }

    if (!pinIngresado) {
      return { desbloqueado: false, metodo: 'ninguno' };
    }

    const pinHashGuardado = credenciales?.pinHash ?? (await obtenerPinHashGuardado(db, tablaProductor));
    if (!pinHashGuardado) {
      return { desbloqueado: false, metodo: 'ninguno' };
    }

    const pinHashIngresado = await hashearPin(pinIngresado);

    if (pinHashIngresado === pinHashGuardado) {
      if (credenciales) {
        await abrirSesionLocal(db, credenciales.idUsuario);
      }
      return { desbloqueado: true, metodo: 'pin', idUsuario: credenciales?.idUsuario };
    }

    return { desbloqueado: false, metodo: 'pin' };
  }, []);

  const cerrarSesion = useCallback(async (): Promise<void> => {
    const db = await getDb();
    await asegurarEsquemaAuth(db);
    await cerrarSesionLocal(db);
  }, []);

  const resolverRutaInicial = useCallback(async (): Promise<'/auth/registro' | '/auth/desbloqueo' | '/menu'> => {
    const db = await getDb();
    const { tablaProductor } = await asegurarEsquemaAuth(db);

    const sesion = await obtenerSesionLocal(db);
    if (sesion.activa && sesion.idUsuario) {
      return '/menu';
    }

    const registro = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) as total FROM ${tablaProductor}`);
    const hayProductor = Number(registro?.total ?? 0) > 0;

    return hayProductor ? '/auth/desbloqueo' : '/auth/registro';
  }, []);

  const cambiarPin = useCallback(async (input: CambiarPinInput): Promise<void> => {
    const db = await getDb();
    const { tablaProductor } = await asegurarEsquemaAuth(db);

    const pinActualHash = await hashearPin(input.pinActual);
    const pinNuevoHash = await hashearPin(input.pinNuevo);

    const credenciales = await obtenerCredencialesRecientes(db, tablaProductor);
    if (!credenciales) {
      throw new Error('No existe un productor registrado para actualizar el PIN.');
    }

    if (pinActualHash !== credenciales.pinHash) {
      throw new Error('El PIN actual no es correcto.');
    }

    const columnas = await columnasTabla(db, tablaProductor);
    const nombres = new Set(columnas.map((columna) => columna.name));

    const setParts: string[] = [];
    const values: Array<string | number> = [];

    if (nombres.has('pin_hash')) {
      setParts.push('pin_hash = ?');
      values.push(pinNuevoHash);
    }

    if (nombres.has('pin')) {
      setParts.push('pin = ?');
      values.push(pinNuevoHash);
    }

    if (nombres.has('sincronizado')) {
      setParts.push('sincronizado = 0');
    }

    if (!setParts.length) {
      throw new Error('No se encontraron columnas de PIN en la tabla de productor.');
    }

    values.push(credenciales.idUsuario);

    await db.runAsync(
      `UPDATE ${tablaProductor} SET ${setParts.join(', ')} WHERE id_usuario = ?`,
      ...values
    );
  }, []);

  return {
    registrarProductor,
    desbloquearApp,
    cerrarSesion,
    resolverRutaInicial,
    cambiarPin,
  };
}

export type { RegistroProductorInput, RegistroProductorResult, DesbloqueoResult, SesionLocal, CambiarPinInput };
