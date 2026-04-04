import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuthLocal } from '@/src/features/auth';
import { getDb } from '@/src/services/sqlite';
import { sincronizarProductosPendientes } from '@/src/services/offlineProductsSync';
import { sincronizarSiembrasPendientes } from '@/src/services/siembraStorageSync';

type PerfilProductor = {
  idUsuario: number;
  nombreCompleto: string;
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

export default function PerfilScreen() {
  const router = useRouter();
  const { cerrarSesion } = useAuthLocal();
  const [perfil, setPerfil] = useState<PerfilProductor | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const onCerrarSesion = async () => {
    try {
      await cerrarSesion();
      router.replace('/auth/desbloqueo' as any);
    } catch {
      Alert.alert('Error', 'No se pudo cerrar la sesion local.');
    }
  };

  const cargarPerfil = useCallback(async () => {
    try {
      const data = await obtenerPerfilProductor();
      setPerfil(data);
    } catch {
      setPerfil(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargarPerfil();
    }, [cargarPerfil])
  );

  const onSincronizar = async () => {
    if (sincronizando) return;

    try {
      setSincronizando(true);
      const [siembras, productos] = await Promise.all([
        sincronizarSiembrasPendientes(),
        sincronizarProductosPendientes(),
      ]);

      const totalSincronizado = siembras.sincronizados + productos.sincronizados;
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
  };

  const nombrePerfil = (perfil?.nombreCompleto ?? 'PRODUCTOR AGROCONECTA').toUpperCase();
  const ciPerfil = perfil?.idUsuario ? String(perfil.idUsuario) : '--';
  const ubicacionPerfil = [perfil?.departamento, perfil?.municipio, perfil?.comunidad]
    .filter((item) => item && item !== 'No registrado')
    .join('\n');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerArea}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.avatarWrap}>
              <Ionicons name="person-outline" size={38} color="#38a837" />
            </View>
            <Text style={styles.nombre}>{nombrePerfil}</Text>
            <Text style={styles.ci}>ID {ciPerfil}</Text>
          </View>

          <View style={styles.contentWrap}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Mi Informacion</Text>
                <TouchableOpacity activeOpacity={0.8}>
                  <Ionicons name="create-outline" size={20} color="#38a837" />
                </TouchableOpacity>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color="#38a837" />
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Ubicacion</Text>
                  <Text style={styles.infoValue}>{ubicacionPerfil || 'No registrado'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={20} color="#38a837" />
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Telefono</Text>
                  <Text style={styles.infoValue}>{perfil?.telefono ?? 'No registrado'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardAjustes}>
              <Text style={styles.cardTitle}>Ajustes</Text>

              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => router.push('/auth/cambiar-pin' as any)}
                activeOpacity={0.85}
              >
                <View style={styles.settingsLeft}>
                  <View style={[styles.roundIcon, { backgroundColor: '#e7f5e8' }]}>
                    <Ionicons name="lock-closed-outline" size={18} color="#38a837" />
                  </View>
                  <Text style={styles.settingsText}>Cambiar PIN de seguridad</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem} onPress={() => void onSincronizar()} activeOpacity={0.85}>
                <View style={styles.settingsLeft}>
                  <View style={[styles.roundIcon, { backgroundColor: '#e8f1ff' }]}>
                    <Ionicons
                      name={sincronizando ? 'sync-outline' : 'cloud-upload-outline'}
                      size={18}
                      color="#3b82f6"
                    />
                  </View>
                  <Text style={styles.settingsText}>Sincronizar datos al servidor</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem} onPress={() => void onCerrarSesion()} activeOpacity={0.85}>
                <View style={styles.settingsLeft}>
                  <View style={[styles.roundIcon, { backgroundColor: '#feecee' }]}>
                    <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                  </View>
                  <Text style={[styles.settingsText, styles.logoutText]}>Cerrar sesion</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#f87171" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#e9e9e9',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerArea: {
    backgroundColor: '#38a837',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 62,
  },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  nombre: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  ci: {
    fontSize: 19,
    color: '#ffffff',
    marginTop: 6,
    fontWeight: '600',
  },
  contentWrap: {
    marginTop: -48,
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#f3f3f3',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    columnGap: 10,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 19,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 21,
    color: '#0f172a',
    lineHeight: 28,
  },
  cardAjustes: {
    backgroundColor: '#f3f3f3',
    borderRadius: 14,
    paddingTop: 12,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  settingsItem: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  roundIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#0f172a',
    flexShrink: 1,
  },
  logoutText: {
    color: '#ef4444',
  },
});
