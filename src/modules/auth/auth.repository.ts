import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '../../core/database/sqlite.config';

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

export async function guardarSesion(idUsuario: number, idProductor: number, nombre: string, email: string): Promise<void> {
  await AsyncStorage.setItem('@id_usuario', String(idUsuario));
  await AsyncStorage.setItem('id_usuario', String(idUsuario));
  await AsyncStorage.setItem('@id_productor', String(idProductor));
  await AsyncStorage.setItem('id_productor', String(idProductor));
  await AsyncStorage.setItem('@isLoggedIn', 'true');
  await AsyncStorage.setItem('sesion_activa', 'true');
  await AsyncStorage.setItem('@user_name', nombre);
  await AsyncStorage.setItem('@user_email', email);
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
  comunidad: string
): Promise<{ id_usuario: number; id_productor: number }> {
  const db = await getDb();
  const tokenLocal = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const nombreCompleto = `${nombre} ${apellido}`.trim();
  const email = `${telefono}@agro.local`;

  try {
    let idUsuario = 0;
    let idProductor = 0;

    await db.withTransactionAsync(async () => {
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

      idUsuario = Number(resultUsuario.lastInsertRowId);

      const resultProductor = await db.runAsync(
        `INSERT INTO productor (id_usuario, credencial_hash, credencial, departamento, municipio, comunidad, telefono, sincronizado)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        idUsuario,
        tokenLocal,
        tokenLocal,
        departamento,
        municipio,
        comunidad,
        telefono
      );

      idProductor = Number(resultProductor.lastInsertRowId);
      await guardarSesion(idUsuario, idProductor, nombreCompleto, email);
    });

    console.log('✅ Usuario registrado:', { idUsuario, idProductor });
    return { id_usuario: idUsuario, id_productor: idProductor };
  } catch (error) {
    console.error('Error al registrar:', error);
    throw error;
  }
}
