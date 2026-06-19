import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '../../core/database/sqlite.config';
import { registrarProductorApi } from '../../core/network/api/auth';

export async function getCurrentProductorId(): Promise<number> {
  try {
    let idProductor = await AsyncStorage.getItem('@id_productor');

    if (!idProductor) {
      idProductor = await AsyncStorage.getItem('id_productor');
    }

    if (!idProductor) {
      let idUsuario = await AsyncStorage.getItem('@id_usuario');
      if (!idUsuario) {
        idUsuario = await AsyncStorage.getItem('id_usuario');
      }

      if (idUsuario) {
        const db = await getDb();
        const productor = await db.getFirstAsync<{ id_productor: number }>(
          'SELECT id_productor FROM productor WHERE id_usuario = ?',
          parseInt(idUsuario, 10)
        );

        if (productor) {
          idProductor = String(productor.id_productor);
          await AsyncStorage.setItem('@id_productor', idProductor);
          await AsyncStorage.setItem('id_productor', idProductor);
        }
      }
    }

    if (!idProductor) {
      throw new Error('No hay usuario logueado. Debe iniciar sesión primero.');
    }

    return parseInt(idProductor, 10);
  } catch (error) {
    console.error('Error obteniendo productor ID:', error);
    throw new Error('No hay usuario logueado. Debe iniciar sesión primero.');
  }
}

export async function getCurrentUsuarioId(): Promise<number> {
  let idUsuario = await AsyncStorage.getItem('@id_usuario');
  if (!idUsuario) {
    idUsuario = await AsyncStorage.getItem('id_usuario');
  }

  if (!idUsuario) {
    throw new Error('No hay usuario logueado');
  }

  return parseInt(idUsuario, 10);
}

export async function isUserLoggedIn(): Promise<boolean> {
  const logged = await AsyncStorage.getItem('@isLoggedIn');
  if (logged === 'true') return true;

  const loggedOld = await AsyncStorage.getItem('sesion_activa');
  return loggedOld === 'true';
}

export async function guardarSesion(idUsuario: number, idProductor: number, nombre: string, email: string, token?: string): Promise<void> {
  await AsyncStorage.setItem('@id_usuario', String(idUsuario));
  await AsyncStorage.setItem('id_usuario', String(idUsuario));
  await AsyncStorage.setItem('@id_productor', String(idProductor));
  await AsyncStorage.setItem('id_productor', String(idProductor));
  await AsyncStorage.setItem('@isLoggedIn', 'true');
  await AsyncStorage.setItem('sesion_activa', 'true');
  await AsyncStorage.setItem('@user_name', nombre);
  await AsyncStorage.setItem('@user_email', email);
  if (token) {
    await AsyncStorage.setItem('@jwt_token', token);
    await AsyncStorage.setItem('jwt_token', token);
  }

  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO auth_sesion (id, id_usuario, activa, updated_at)
       VALUES (1, ?, 1, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         id_usuario = excluded.id_usuario,
         activa = excluded.activa,
         updated_at = excluded.updated_at`,
      idUsuario
    );
  } catch (error) {
    console.error('Error al guardar sesión en SQLite auth_sesion:', error);
  }
}

export async function cerrarSesionCompleta(): Promise<void> {
  await AsyncStorage.multiRemove([
    '@id_usuario',
    'id_usuario',
    '@id_productor',
    'id_productor',
    '@isLoggedIn',
    'sesion_activa',
    '@user_name',
    '@user_email',
    '@jwt_token',
    'jwt_token',
  ]);

  const db = await getDb();
  await db.runAsync('DELETE FROM auth_sesion WHERE id = 1');
}

export async function registrarUsuarioYProductor(
  nombre: string,
  apellido: string,
  telefono: string,
  departamento: string,
  municipio: string,
  comunidad: string,
  pin: string = '1234'
): Promise<{ id_usuario: number; id_productor: number }> {
  const db = await getDb();
  const tokenLocal = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const nombreCompleto = `${nombre} ${apellido}`.trim();
  const email = `${telefono}@agro.local`;

  let idUsuarioLocal = 0;
  let idProductorLocal = 0;

  // === PASO 1: INSERT local en SQLite (Offline-First) ===
  try {
    await db.withTransactionAsync(async () => {
      // Registrar usuario localmente con sincronizado = 0
      const resultUsuario = await db.runAsync(
        `INSERT INTO usuario (nombre, apellido, nombre_completo, email, password_hash, rol, telefono, fecha_registro, sincronizado)
         VALUES (?, ?, ?, ?, ?, 'PRODUCTOR', ?, datetime('now'), 0)`,
        nombre,
        apellido,
        nombreCompleto,
        email,
        tokenLocal,
        telefono
      );

      idUsuarioLocal = Number(resultUsuario.lastInsertRowId);

      // Registrar productor localmente con sincronizado = 0
      const resultProductor = await db.runAsync(
        `INSERT INTO productor (id_usuario, credencial_hash, credencial, departamento, municipio, comunidad, telefono, sincronizado)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        idUsuarioLocal,
        tokenLocal,
        tokenLocal,
        departamento,
        municipio,
        comunidad,
        telefono
      );

      idProductorLocal = Number(resultProductor.lastInsertRowId);
    });

    // Guardar sesión local por defecto
    await guardarSesion(idUsuarioLocal, idProductorLocal, nombreCompleto, email);
    console.log('💾 Registro guardado localmente en SQLite:', { idUsuarioLocal, idProductorLocal });
  } catch (error) {
    console.error('❌ Error en el registro local:', error);
    throw error;
  }

  // === PASO 2: Petición POST al backend (Sincronización online inmediata) ===
  try {
    const resServer = await registrarProductorApi({
      nombre,
      apellido,
      telefono,
      departamento,
      municipio,
      comunidad,
      pin,
    });

    if (resServer && resServer.data && resServer.token) {
      const serverIdUsuario = Number(resServer.data.id_usuario);
      const serverIdProductor = Number(resServer.data.id_productor);
      const token = resServer.token;

      console.log('📡 Registro exitoso en servidor backend, actualizando localmente:', { serverIdUsuario, serverIdProductor });

      // === PASO 3: UPDATE en SQLite con IDs reales y sincronizado = 1 ===
      await db.execAsync('PRAGMA foreign_keys = OFF');
      try {
        await db.runAsync(
          'UPDATE usuario SET id_usuario = ?, sincronizado = 1 WHERE id_usuario = ?',
          serverIdUsuario,
          idUsuarioLocal
        );

        await db.runAsync(
          'UPDATE productor SET id_productor = ?, id_usuario = ?, sincronizado = 1 WHERE id_productor = ?',
          serverIdProductor,
          serverIdUsuario,
          idProductorLocal
        );

        await db.runAsync(
          'UPDATE lote SET id_productor = ? WHERE id_productor = ?',
          serverIdProductor,
          idProductorLocal
        );

        await db.runAsync(
          'UPDATE auth_sesion SET id_usuario = ? WHERE id_usuario = ?',
          serverIdUsuario,
          idUsuarioLocal
        );
      } finally {
        await db.execAsync('PRAGMA foreign_keys = ON');
      }

      // Guardar sesión actualizada con el Token del servidor
      await guardarSesion(serverIdUsuario, serverIdProductor, nombreCompleto, email, token);
      console.log('✅ Sesión actualizada con Token JWT e IDs reales del servidor.');
      
      return { id_usuario: serverIdUsuario, id_productor: serverIdProductor };
    }
  } catch (error) {
    console.warn('⚠️ No se pudo registrar en el servidor en este momento. Se mantiene el registro local (Offline):', error);
  }

  return { id_usuario: idUsuarioLocal, id_productor: idProductorLocal };
}

export async function sincronizarUsuarioYProductorBackend(): Promise<boolean> {
  const db = await getDb();

  // Buscar el productor/usuario local que no esté sincronizado
  const unsynced = await db.getFirstAsync<{
    id_usuario: number;
    id_productor: number;
    nombre: string;
    apellido: string;
    telefono: string;
    departamento: string;
    municipio: string;
    comunidad: string;
  }>(
    `SELECT u.id_usuario, p.id_productor, u.nombre, u.apellido, u.telefono, p.departamento, p.municipio, p.comunidad
     FROM usuario u
     INNER JOIN productor p ON p.id_usuario = u.id_usuario
     WHERE u.sincronizado = 0 OR p.sincronizado = 0
     ORDER BY u.id_usuario DESC LIMIT 1`
  );

  if (!unsynced) {
    return false;
  }

  console.log(`🔄 Sincronizando usuario local "${unsynced.nombre} ${unsynced.apellido}" con el servidor...`);

  try {
    const resServer = await registrarProductorApi({
      nombre: unsynced.nombre,
      apellido: unsynced.apellido,
      telefono: unsynced.telefono,
      departamento: unsynced.departamento,
      municipio: unsynced.municipio,
      comunidad: unsynced.comunidad,
    });

    if (resServer && resServer.data && resServer.token) {
      const serverIdUsuario = Number(resServer.data.id_usuario);
      const serverIdProductor = Number(resServer.data.id_productor);
      const token = resServer.token;

      console.log('📡 Usuario registrado con éxito en el servidor. Nuevos IDs:', { serverIdUsuario, serverIdProductor });

      // Desactivar temporalmente las llaves foráneas para poder hacer la actualización en cascada manual de las llaves primarias
      await db.execAsync('PRAGMA foreign_keys = OFF');

      try {
        // Actualizar usuario
        await db.runAsync(
          'UPDATE usuario SET id_usuario = ?, sincronizado = 1 WHERE id_usuario = ?',
          serverIdUsuario,
          unsynced.id_usuario
        );

        // Actualizar productor (actualizando también id_usuario para enlazarlo con el nuevo ID de usuario)
        await db.runAsync(
          'UPDATE productor SET id_productor = ?, id_usuario = ?, sincronizado = 1 WHERE id_productor = ?',
          serverIdProductor,
          serverIdUsuario,
          unsynced.id_productor
        );

        // Actualizar lotes asociados
        await db.runAsync(
          'UPDATE lote SET id_productor = ? WHERE id_productor = ?',
          serverIdProductor,
          unsynced.id_productor
        );

        // Actualizar sesión activa
        await db.runAsync(
          'UPDATE auth_sesion SET id_usuario = ? WHERE id_usuario = ?',
          serverIdUsuario,
          unsynced.id_usuario
        );
      } finally {
        await db.execAsync('PRAGMA foreign_keys = ON');
      }

      // Guardar nueva sesión con los datos y el token del servidor en AsyncStorage y SQLite
      await guardarSesion(
        serverIdUsuario,
        serverIdProductor,
        `${unsynced.nombre} ${unsynced.apellido}`.trim(),
        `${unsynced.telefono}@agro.local`,
        token
      );

      console.log('✅ Base de datos local y sesión de almacenamiento actualizadas con el token del servidor.');
      return true;
    }
  } catch (error) {
    console.warn('⚠️ Error al intentar sincronizar el usuario con el servidor:', error);
  }

  return false;
}
