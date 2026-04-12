import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useDashboard } from '../hooks/useDashboard';
import { RubroCalculadora } from '@/src/features/calculadoraCostos/types';
import { ResumenCard, LoteCard } from '../components';

type QuickActionProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: 'primary' | 'secondary';
  onPress: () => void;
};

function normalizarRubro(tipoCultivo?: string): RubroCalculadora {
  if (!tipoCultivo) return 'quinua';
  const lower = tipoCultivo.toLowerCase();
  if (lower.includes('hortaliza')) return 'hortalizas';
  if (lower.includes('quinua')) return 'quinua';
  if (lower.includes('haba')) return 'hortalizas'; // mapear haba a hortalizas por defecto
  return 'quinua'; // defecto
}

export function DashboardScreen() {
  const router = useRouter();
  const { nombreUsuario, estadisticas, lotesRecientes, loading, error, origenDatos, actualizar } = useDashboard();
  const [sincronizando, setSincronizando] = useState(false);

  const onSincronizar = async () => {
    if (sincronizando) return;

    try {
      setSincronizando(true);
       await actualizar();
    } catch {
      Alert.alert('Sin conexión', 'No se pudo sincronizar. Revisa tu conexión e intenta nuevamente.');
    } finally {
      setSincronizando(false);
    }
  };

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
        <Text style={styles.greeting}>¡Bienvenido Productor, {nombreUsuario}!</Text>
      </View>

      <View style={styles.headerIconsContainer}>
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
    </View>
  );

  const renderResumenFinanciero = () => (
    <ResumenCard
      costoTotal={estadisticas.inversion}
      cantidadLotes={estadisticas.lotesActivos}
      onPress={() => router.push('/calculadora-costos' as any)}
    />
  );

  const renderTusLotes = () => (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Tus Lotes</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/seleccionar-rubro' as any)}>
          <Text style={styles.sectionAction}>Ver todos  {'>'}</Text>
        </TouchableOpacity>
      </View>

      {lotesRecientes.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={styles.lotesScrollContent}
        >
          {lotesRecientes.map((lote) => (
            <View key={lote.id} style={styles.loteCardWrapper}>
              <LoteCard
                nombre={lote.nombre}
                variedad={lote.variedad}
                estado={lote.estado}
                area={lote.area ?? 0}
                onPress={() => {
                  router.push({
                    pathname: '/calculadora-costos' as any,
                    params: {
                      idLoteServidor: String(lote.id),
                      rubro: normalizarRubro(lote.tipoCultivo),
                    },
                  });
                }}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyLotesContainer}>
          <Text style={styles.emptyLotesText}>No hay lotes registrados</Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        {renderQuickAction({
          label: 'Registrar Lote Nuevo',
          icon: 'add',
          variant: 'primary',
          onPress: () => router.push('/seleccionar-rubro' as any),
        })}
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
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2BA14A" />
                <Text style={styles.loadingText}>Cargando datos locales...</Text>
              </View>
            ) : (
              <>
                {renderResumenFinanciero()}

                {renderTusLotes()}
              </>
            )}
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
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginLeft: 4,
  },
  statusBadgeText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  headerIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: 8,
  },
  avatarButton: {
    marginLeft: 4,
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
  lotesScrollContent: {
    paddingRight: 16,
    gap: 12,
  },
  loteCardWrapper: {
    marginRight: 0,
  },
  emptyLotesContainer: {
    paddingVertical: 20,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyLotesText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
