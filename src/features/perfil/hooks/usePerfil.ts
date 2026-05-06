import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthLocal } from '@/src/features/auth/hooks/useAuthLocal';
import { getDb } from '@/src/services/shared';
import { sincronizarSiembrasPendientes } from '@/src/services/siembra';

export type PerfilProductor = {
  idUsuario: number;
  idProductor: number;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  telefono: string;
  departamento: string;
  municipio: string;
  comunidad: string;
};

export type PerfilEdicionForm = {
  nombre: string;
  apellido: string;
  telefono: string;
  departamento: string;
  municipio: string;
  comunidad: string;
};

type ColumnInfo = {
  name: string;
};

async function existeTabla(db: Awaited<ReturnType<typeof getDb>>, tabla: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ existe: number }>(
    'SELECT COUNT(*) as existe FROM sqlite_master WHERE type = ? AND name = ?',
    'table',
    tabla
  );
  return Number(row?.existe ?? 0) > 0;
}

async function columnasTabla(db: Awaited<ReturnType<typeof getDb>>, tabla: string): Promise<Set<string>> {
  try {
    const columnas = await db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${tabla})`);
    return new Set(columnas.map((c) => c.name));
  } catch {
    return new Set();
  }
}

async function obtenerPerfilProductor(): Promise<PerfilProductor | null> {
  const db = await getDb();
  const tieneUsuario = await existeTabla(db, 'usuario');
  if (!tieneUsuario) return null;

  const tieneProductor = await existeTabla(db, 'productor');
  const tieneSesion = await existeTabla(db, 'auth_sesion');
  const columnasUsuario = await columnasTabla(db, 'usuario');
  const columnasProductor = tieneProductor ? await columnasTabla(db, 'productor') : new Set<string>();

  const nombreSql = columnasUsuario.has('nombre') ? 'u.nombre' : "''";
  const apellidoSql = columnasUsuario.has('apellido') ? 'u.apellido' : "''";
  const nombreCompletoSql = columnasUsuario.has('nombre_completo') ? 'u.nombre_completo' : "''";
  const telefonoUsuarioSql = columnasUsuario.has('telefono') ? 'u.telefono' : "''";

  const telefonoProductorSql =
    tieneProductor && columnasProductor.has('telefono') ? 'p.telefono' : "''";
  const departamentoSql =
    tieneProductor && columnasProductor.has('departamento') ? 'p.departamento' : "''";
  const municipioSql =
    tieneProductor && columnasProductor.has('municipio') ? 'p.municipio' : "''";
  const comunidadSql =
    tieneProductor && columnasProductor.has('comunidad') ? 'p.comunidad' : "''";

  const joinProductor = tieneProductor ? 'LEFT JOIN productor p ON p.id_usuario = u.id_usuario' : '';
  const joinSesion = tieneSesion ? 'LEFT JOIN auth_sesion s ON s.id_usuario = u.id_usuario' : '';
  const whereSesionActiva = tieneSesion ? 'WHERE s.id = 1 AND s.activa = 1' : '';

  const perfilActivo = await db.getFirstAsync<Record<string, unknown>>(
    `
      SELECT
        u.id_usuario,
        p.id_productor,
        TRIM(COALESCE(${nombreSql}, '')) as nombre,
        TRIM(COALESCE(${apellidoSql}, '')) as apellido,
        TRIM(COALESCE(${nombreCompletoSql}, '')) as nombre_completo,
        TRIM(COALESCE(${telefonoUsuarioSql}, '')) as telefono_usuario,
        TRIM(COALESCE(${telefonoProductorSql}, '')) as telefono_productor,
        TRIM(COALESCE(${departamentoSql}, '')) as departamento,
        TRIM(COALESCE(${municipioSql}, '')) as municipio,
        TRIM(COALESCE(${comunidadSql}, '')) as comunidad
      FROM usuario u
      ${joinProductor}
      ${joinSesion}
      ${whereSesionActiva}
      ORDER BY u.id_usuario DESC
      LIMIT 1
    `
  );

  const perfilFallback =
    perfilActivo ??
    (await db.getFirstAsync<Record<string, unknown>>(
      `
      SELECT
        u.id_usuario,
        p.id_productor,
        TRIM(COALESCE(${nombreSql}, '')) as nombre,
        TRIM(COALESCE(${apellidoSql}, '')) as apellido,
        TRIM(COALESCE(${nombreCompletoSql}, '')) as nombre_completo,
        TRIM(COALESCE(${telefonoUsuarioSql}, '')) as telefono_usuario,
        TRIM(COALESCE(${telefonoProductorSql}, '')) as telefono_productor,
        TRIM(COALESCE(${departamentoSql}, '')) as departamento,
        TRIM(COALESCE(${municipioSql}, '')) as municipio,
        TRIM(COALESCE(${comunidadSql}, '')) as comunidad
      FROM usuario u
      ${joinProductor}
      ORDER BY u.id_usuario DESC
      LIMIT 1
    `
    ));

  if (!perfilFallback?.id_usuario) {
    return null;
  }

  const nombre = String(perfilFallback.nombre ?? '').trim();
  const apellido = String(perfilFallback.apellido ?? '').trim();
  const nombreCompletoBase = String(perfilFallback.nombre_completo ?? '').trim();
  const nombreCompleto =
    nombreCompletoBase || `${nombre} ${apellido}`.trim() || 'PRODUCTOR AGROCONECTA';

  return {
    idUsuario: Number(perfilFallback.id_usuario),
    idProductor: Number(perfilFallback.id_productor ?? 0),
    nombre,
    apellido,
    nombreCompleto,
    telefono:
      String(perfilFallback.telefono_productor ?? '').trim() ||
      String(perfilFallback.telefono_usuario ?? '').trim() ||
      'No registrado',
    departamento: String(perfilFallback.departamento ?? '').trim() || 'No registrado',
    municipio: String(perfilFallback.municipio ?? '').trim() || 'No registrado',
    comunidad: String(perfilFallback.comunidad ?? '').trim() || 'No registrado',
  };
}

export function usePerfil() {
  const router = useRouter();
  const { cerrarSesionLocal } = useAuthLocal();
  const [perfil, setPerfil] = useState<PerfilProductor | null>(null);
  const [perfilEdicion, setPerfilEdicion] = useState<PerfilEdicionForm>({
    nombre: '',
    apellido: '',
    telefono: '',
    departamento: '',
    municipio: '',
    comunidad: '',
  });
  const [sincronizando, setSincronizando] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const cargarPerfil = useCallback(async () => {
    try {
      const data = await obtenerPerfilProductor();
      setPerfil(data);
      if (data) {
        setPerfilEdicion({
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono,
          departamento: data.departamento,
          municipio: data.municipio,
          comunidad: data.comunidad,
        });
      }
    } catch {
      setPerfil(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargarPerfil();
    }, [cargarPerfil])
  );

  const onCerrarSesion = useCallback(async () => {
    try {
      await cerrarSesionLocal();
      router.replace('/inicio' as any);
    } catch {
      Alert.alert('Error', 'No se pudo cerrar la sesion local.');
    }
  }, [cerrarSesionLocal, router]);

  const confirmarCierreSesion = useCallback(() => {
    Alert.alert(
      'Cerrar sesion',
      'Vas a salir de tu cuenta. Se borraran los datos locales de este dispositivo. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesion',
          style: 'destructive',
          onPress: () => {
            void onCerrarSesion();
          },
        },
      ]
    );
  }, [onCerrarSesion]);

  const onSincronizar = useCallback(async () => {
    if (sincronizando) return;

    try {
      setSincronizando(true);
      const siembras = await sincronizarSiembrasPendientes();
      const totalSincronizado = siembras.sincronizados;

      Alert.alert(
        'Sincronizacion completa',
        totalSincronizado > 0
          ? `Se sincronizaron ${totalSincronizado} registros al servidor.`
          : 'No hubo datos pendientes para sincronizar.'
      );
    } catch {
      Alert.alert('Sin conexion', 'No se pudo sincronizar. Verifica internet e intenta nuevamente.');
    } finally {
      setSincronizando(false);
    }
  }, [sincronizando]);

  const guardarPerfilLocal = useCallback(async () => {
    if (!perfil) {
      Alert.alert('Perfil no disponible', 'No se pudo encontrar el perfil local para editar.');
      return;
    }

    const nombre = perfilEdicion.nombre.trim();
    const apellido = perfilEdicion.apellido.trim();
    const telefono = perfilEdicion.telefono.trim();
    const departamento = perfilEdicion.departamento.trim();
    const municipio = perfilEdicion.municipio.trim();
    const comunidad = perfilEdicion.comunidad.trim();

    if (!nombre || !apellido || !telefono || !departamento || !municipio || !comunidad) {
      Alert.alert('Datos incompletos', 'Completa nombre, apellido, ubicación y teléfono antes de guardar.');
      return;
    }

    const nombreCompleto = `${nombre} ${apellido}`.trim();
    const db = await getDb();

    try {
      setGuardandoPerfil(true);
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `UPDATE usuario
           SET nombre = ?, apellido = ?, nombre_completo = ?, telefono = ?, sincronizado = 0
           WHERE id_usuario = ?`,
          nombre,
          apellido,
          nombreCompleto,
          telefono,
          perfil.idUsuario
        );

        await db.runAsync(
          `UPDATE productor
           SET departamento = ?, municipio = ?, comunidad = ?, telefono = ?, sincronizado = 0
           WHERE id_productor = ?`,
          departamento,
          municipio,
          comunidad,
          telefono,
          perfil.idProductor
        );
      });

      await cargarPerfil();
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron en este dispositivo.');
    } catch (error) {
      console.warn('No se pudo guardar el perfil local:', error);
      Alert.alert('Error', 'No se pudo guardar el perfil local. Intenta nuevamente.');
    } finally {
      setGuardandoPerfil(false);
    }
  }, [cargarPerfil, perfil, perfilEdicion]);

  const nombrePerfil = (perfil?.nombreCompleto ?? 'PRODUCTOR AGROCONECTA').toUpperCase();
  const ubicacionPerfil = [perfil?.departamento, perfil?.municipio, perfil?.comunidad]
    .filter((item) => item && item !== 'No registrado')
    .join('\n');

  return {
    perfil,
    perfilEdicion,
    guardandoPerfil,
    sincronizando,
    nombrePerfil,
    ubicacionPerfil,
    setPerfilEdicion,
    guardarPerfilLocal,
    onSincronizar,
    confirmarCierreSesion,
  };
}
