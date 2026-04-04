import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useDashboard } from '../hooks/useDashboard';
import { sincronizarProductosPendientes } from '@/src/services/offlineProductsSync';
import { sincronizarSiembrasPendientes } from '@/src/services/siembraStorageSync';

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accentColor: string;
  iconBackground: string;
};

type QuickActionProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: 'primary' | 'secondary';
  onPress: () => void;
};

export function DashboardScreen() {
  const router = useRouter();
  const { nombreUsuario, estadisticas, lotesRecientes, loading, error, origenDatos, actualizar } = useDashboard();
  const [sincronizando, setSincronizando] = useState(false);

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
        'Sincronización completa',
        totalSincronizado > 0
          ? `Se sincronizaron ${totalSincronizado} registros.`
          : 'No hubo registros pendientes para sincronizar.'
      );
      await actualizar();
    } catch {
      Alert.alert('Sin conexión', 'No se pudo sincronizar. Revisa tu conexión e intenta nuevamente.');
    } finally {
      setSincronizando(false);
    }
  };

  const renderStatCard = ({ icon, label, value, accentColor, iconBackground }: StatCardProps) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={20} color={accentColor} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accentColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );

  const renderQuickAction = ({ label, icon, variant, onPress }: QuickActionProps) => {
    const isPrimary = variant === 'primary';

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        style={[styles.quickActionButton, isPrimary ? styles.quickActionPrimary : styles.quickActionSecondary]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={isPrimary ? '#FFFFFF' : '#2BA14A'}
          style={styles.quickActionIcon}
        />
        <Text style={[styles.quickActionText, isPrimary ? styles.quickActionTextPrimary : styles.quickActionTextSecondary]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerCard}>
      <View style={styles.headerTextArea}>
        <Text style={styles.greeting}>Hola, {nombreUsuario}</Text>
        <View style={styles.statusBadge}>
          <Ionicons name="cloud-offline-outline" size={13} color="#B7791F" />
          <Text style={styles.statusBadgeText}>Modo Offline</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.avatarButton}
        activeOpacity={0.88}
        onPress={() => router.push('/perfil' as any)}
      >
        <View style={styles.avatarCircle}>
          <Ionicons name="person-outline" size={28} color="#2BA14A" />
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderStats = () => (
    <View style={styles.statsGrid}>
      {renderStatCard({
        icon: 'leaf-outline',
        label: 'Lotes activos',
        value: String(estadisticas.lotesActivos),
        accentColor: '#2BA14A',
        iconBackground: '#EAF8EE',
      })}
      {renderStatCard({
        icon: 'map-outline',
        label: 'Área total',
        value: `${estadisticas.areaTotal.toFixed(1)} ha`,
        accentColor: '#0F172A',
        iconBackground: '#FFF3E4',
      })}
      {renderStatCard({
        icon: 'cash-outline',
        label: 'Inversión',
        value: `Bs. ${estadisticas.inversion.toLocaleString('es-BO')}`,
        accentColor: '#0F172A',
        iconBackground: '#EEF4FF',
      })}
      {renderStatCard({
        icon: 'sync-outline',
        label: 'Pendiente sync',
        value: String(estadisticas.pendientesSync),
        accentColor: '#B7791F',
        iconBackground: '#FFF7DB',
      })}
    </View>
  );

  const renderRecentLots = () => (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Lotes Recientes</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/menu' as any)}>
          <Text style={styles.sectionAction}>Ver todos</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentList}>
        {lotesRecientes.map((lote) => (
          <View key={lote.id} style={styles.lotCard}>
            <View style={styles.lotInfo}>
              <Text style={styles.lotName}>{lote.nombre}</Text>
              <Text style={styles.lotVariety}>{lote.variedad}</Text>
              <View style={styles.lotStatusChip}>
                <Text style={styles.lotStatusText}>{lote.estado}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderHeader()}

          <View style={styles.contentShell}>
            <Text style={styles.metaText}>{origenDatos.join(' · ')}</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {loading && lotesRecientes.length === 0 ? (
              <Text style={styles.loadingText}>Cargando datos locales y del backend...</Text>
            ) : null}

            {renderStats()}

            <View style={styles.actionsRow}>
              {renderQuickAction({
                label: '+ Nuevo Lote',
                icon: 'add',
                variant: 'primary',
                onPress: () => router.push('/seleccionar-rubro' as any),
              })}
              {renderQuickAction({
                label: sincronizando ? 'Sincronizando...' : 'Sincronizar',
                icon: sincronizando ? 'sync-outline' : 'cloud-upload-outline',
                variant: 'secondary',
                onPress: () => void onSincronizar(),
              })}
            </View>

            {renderRecentLots()}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const shadowCard: ViewStyle = {
  shadowColor: '#000000',
  shadowOpacity: 0.06,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerCard: {
    backgroundColor: '#2BA14A',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextArea: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4CC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: '#8A5A00',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  avatarButton: {
    borderRadius: 26,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentShell: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  metaText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 10,
  },
  errorText: {
    color: '#B45309',
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '48%',
    minHeight: 128,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    ...shadowCard,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  quickActionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  quickActionPrimary: {
    backgroundColor: '#2BA14A',
    ...shadowCard,
  },
  quickActionSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2BA14A',
    ...shadowCard,
  },
  quickActionIcon: {
    marginRight: 8,
  },
  quickActionText: {
    fontSize: 15,
    fontWeight: '800',
  },
  quickActionTextPrimary: {
    color: '#FFFFFF',
  },
  quickActionTextSecondary: {
    color: '#2BA14A',
  },
  sectionBlock: {
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionAction: {
    color: '#2BA14A',
    fontSize: 14,
    fontWeight: '700',
  },
  recentList: {
    gap: 12,
  },
  lotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadowCard,
  },
  lotInfo: {
    flex: 1,
    paddingRight: 12,
  },
  lotName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  lotVariety: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 3,
  },
  lotStatusChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#EAF8EE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  lotStatusText: {
    color: '#2BA14A',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default DashboardScreen;
