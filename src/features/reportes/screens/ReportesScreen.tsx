import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, ListRenderItem, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ReporteCard } from '../components/ReporteCard';
import { ReporteLote, useReportes } from '../hooks';

function formatearMoneda(valor: number) {
  return `Bs. ${valor}`;
}

const renderItem: ListRenderItem<ReporteLote> = ({ item }) => <ReporteCard lote={item} />;

export function ReportesScreen() {
  const { inversionTotalAcumulada, cantidadLotes, lotes, loading, error, estaEnLinea, origenDatos, recargar } = useReportes();

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.titulo}>Mis Reportes</Text>
          <Text style={styles.subtitulo}>Resumen de inversión por parcela</Text>
        </View>

        <FlatList
          data={lotes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#2BA14A" />
                  <Text style={styles.emptyText}>Cargando reportes...</Text>
                </>
              ) : error ? (
                <Text style={styles.emptyText}>{error}</Text>
              ) : (
                <Text style={styles.emptyText}>No hay lotes registrados.</Text>
              )}
            </View>
          )}
          ListHeaderComponent={(
            <View style={styles.headerContent}>
              <View style={styles.globalCard}>
                <View style={styles.globalTopRow}>
                  <View style={styles.globalTextColumn}>
                    <Text style={styles.globalLabel}>Inversión Total Acumulada</Text>
                    <Text style={styles.globalAmount}>{formatearMoneda(inversionTotalAcumulada)}</Text>
                  </View>

                  <View style={styles.iconCircle}>
                    <Ionicons name="trending-up" size={28} color="#FFFFFF" />
                  </View>
                </View>

                <View style={styles.globalDivider} />

                <Text style={styles.globalFooter}>{cantidadLotes} lotes registrados</Text>
              </View>

              <Text style={styles.sectionTitle}>Reportes por Lote</Text>
              <Text style={styles.dataSourceText}>
                {estaEnLinea ? 'En linea' : 'Modo local'}
                {origenDatos.length > 0 ? ` • ${origenDatos.join(' | ')}` : ''}
              </Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#2BA14A',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 28,
  },
  titulo: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitulo: {
    color: '#ECFDF5',
    fontSize: 16,
    marginTop: 8,
    fontWeight: '400',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  emptyState: {
    paddingTop: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
  headerContent: {
    marginTop: -22,
  },
  globalCard: {
    backgroundColor: '#2BA14A',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  globalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  globalTextColumn: {
    flex: 1,
    paddingRight: 16,
  },
  globalLabel: {
    color: '#EAF7EE',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  globalAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#5DC56F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginTop: 16,
    marginBottom: 14,
  },
  globalFooter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 6,
  },
  dataSourceText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 12,
  },
});