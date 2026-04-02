import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TarjetaResultado } from '../components/TarjetaResultado';
import { useResultados } from '../hooks/useResultados';
import { RubroResultado } from '../types';
import { formatearMoneda, normalizarRubro, obtenerConfigRubro } from '../utils/formateadores';

type ResultadosScreenProps = {
  rubroOverride?: RubroResultado;
};

function parseParamToPositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function ResultadosScreen({ rubroOverride }: ResultadosScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    idLote?: string | string[];
    idLoteServidor?: string | string[];
    idLoteLocal?: string | string[];
    id?: string | string[];
    loteId?: string | string[];
    id_lote?: string | string[];
    id_lote_local?: string | string[];
    id_lote_servidor?: string | string[];
    rubro?: string | string[];
  }>();

  const pickParam = (value?: string | string[]) =>
    typeof value === 'string' ? value : (Array.isArray(value) ? value[0] : null);

  const idLoteStr = pickParam(params.idLote)
    ?? pickParam(params.id)
    ?? pickParam(params.loteId)
    ?? pickParam(params.id_lote);
  const idLoteServidorStr = pickParam(params.idLoteServidor)
    ?? pickParam(params.id_lote_servidor);
  const idLoteLocalStr = pickParam(params.idLoteLocal)
    ?? pickParam(params.id_lote_local);
  const rubroRaw = typeof params.rubro === 'string' ? params.rubro : (Array.isArray(params.rubro) ? params.rubro[0] : undefined);

  const idLote = parseParamToPositiveInt(idLoteStr)
    ?? parseParamToPositiveInt(idLoteServidorStr)
    ?? parseParamToPositiveInt(idLoteLocalStr);
  const idLoteServidor = parseParamToPositiveInt(idLoteServidorStr);
  const idLoteLocal = parseParamToPositiveInt(idLoteLocalStr);
  const rubro: RubroResultado = rubroOverride ?? normalizarRubro(rubroRaw);
  const configRubro = obtenerConfigRubro(rubro);

  const {
    loading,
    totalCostos,
    costoPorKg,
    ingresosTotales,
    gananciaNeta,
    margenGanancia,
    puntoEquilibrio,
    puntoEquilibrioKg,
    esRentable,
    escenarios,
    maxGrafico,
    gastos,
  } = useResultados(idLote, rubro, {
    idLoteServidor,
    idLoteLocal,
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text>Cargando resultados...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.backButton}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButtonTouchable}
            >
              <Ionicons name="arrow-back" size={24} color="#4b5563" />
            </TouchableOpacity>
            <Text style={styles.backText}>Volver</Text>
          </View>
          <View style={styles.headerTitleRow}>
            <View>
              <Text style={styles.title}>{configRubro.title}</Text>
              <Text style={styles.subtitle}>{configRubro.subtitle}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <TarjetaResultado variante="verde" style={styles.greenCardCustom}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="receipt-outline" size={18} color="#ecfdf5" />
              <Text style={styles.cardHeaderTitle}>Gastos totales</Text>
            </View>
            <View style={styles.statsRow}>
              <View>
                <Text style={styles.statLabel}>Total Costos</Text>
                <Text style={styles.statValue}>{formatearMoneda(totalCostos)}</Text>
              </View>
              <View style={styles.divider} />
              <View>
                <Text style={styles.statLabel}>Costo por Kilogramo</Text>
                <Text style={styles.statValue}>{formatearMoneda(costoPorKg)}</Text>
              </View>
            </View>
          </TarjetaResultado>

          <TarjetaResultado variante="amarilla" style={styles.yellowCardCustom}>
            <View style={styles.statsRow}>
              <View>
                <Text style={styles.statLabelYellow}>Ingresos Totales</Text>
                <Text style={styles.statValue}>{formatearMoneda(ingresosTotales)}</Text>
              </View>
              <View style={styles.dividerYellow} />
              <View>
                <Text style={styles.statLabelYellow}>Ganancia Neta</Text>
                <View style={styles.rowCenter}>
                  <Text style={styles.statValue}>{formatearMoneda(gananciaNeta)}</Text>
                  {gananciaNeta > 0 && <Ionicons name="trending-up" size={20} color="#fff" style={{ marginLeft: 5 }} />}
                </View>
              </View>
            </View>
          </TarjetaResultado>

          <TarjetaResultado variante={esRentable ? 'alerta' : 'alertaNegativa'}>
            <View style={styles.recommendationHeader}>
              <Ionicons
                name={esRentable ? 'happy-outline' : 'alert-circle-outline'}
                size={24}
                color={esRentable ? '#16a34a' : '#dc2626'}
              />
              <Text style={[styles.recommendationTitle, !esRentable && styles.recommendationTitleRed]}>
                {esRentable ? 'Excelente! Te conviene vender' : 'Atencion: revisa tu precio de venta'}
              </Text>
            </View>

            <Text style={[styles.recommendationText, !esRentable && styles.recommendationTextRed]}>
              {esRentable
                ? 'Tu precio de venta cubre muy bien tus gastos de produccion. Vas a ganar bien!'
                : 'Con el precio actual no alcanzas a cubrir los costos. Sube el precio o reduce gastos.'}
            </Text>

            <View style={[styles.recommendationInfoBox, !esRentable && styles.recommendationInfoBoxRed]}>
              <Text style={styles.recommendationInfoText}>
                Solo necesitas vender <Text style={styles.recommendationInfoStrong}>{puntoEquilibrioKg} kg</Text> para recuperar toda tu inversion.
                {esRentable ? ' El resto es ganancia pura.' : ''}
              </Text>
            </View>
          </TarjetaResultado>

          {rubro === 'hortalizas' && (
            <TarjetaResultado
              titulo="Gastos locales pendientes"
              subtitulo="Solo visible para hortalizas"
            >
              <Text style={styles.extraInfoText}>
                API: {gastos.filter((item) => item.origen === 'API').length} | LOCAL: {gastos.filter((item) => item.origen === 'LOCAL').length}
              </Text>
            </TarjetaResultado>
          )}

          <View style={styles.row}>
            <View style={styles.cardHalfLeft}>
              <TarjetaResultado>
                <Text style={[styles.cardSubtitle, styles.centerText]}>Margen Ganancia</Text>
                <Text style={[styles.statValue, styles.centerText, { color: '#2eaa51', fontSize: 22 }]}>{margenGanancia.toFixed(1)}%</Text>
              </TarjetaResultado>
            </View>
            <View style={styles.cardHalfRight}>
              <TarjetaResultado>
                <Text style={[styles.cardSubtitle, styles.centerText]}>Punto Equilibrio</Text>
                <Text style={[styles.statValue, styles.centerText, { color: '#1f2937', fontSize: 22 }]}>{Math.ceil(puntoEquilibrio)} kg</Text>
              </TarjetaResultado>
            </View>
          </View>

          <TarjetaResultado style={styles.card}>
            <Text style={styles.cardTitle}>Proyeccion de Ingresos</Text>
            <Text style={styles.cardSubtitle}>Pesimista (70%) | Realista (100%) | Optimista (130%)</Text>

            <View style={styles.chartContainer}>
              <View style={styles.chartYAxis}>
                <Text style={styles.chartYText}>{Math.round(maxGrafico)}</Text>
                <Text style={styles.chartYText}>{Math.round(maxGrafico / 2)}</Text>
                <Text style={styles.chartYText}>0</Text>
              </View>

              <View style={styles.chartBarsContainer}>
                {escenarios.map((esc, index) => (
                  <View key={index} style={styles.chartColumn}>
                    <View style={styles.chartGroup}>
                      <View style={[styles.bar, { height: (esc.costos / maxGrafico) * 150, backgroundColor: '#ef4444' }]} />
                      <View style={[styles.bar, { height: (Math.max(esc.ganancia, 0) / maxGrafico) * 150, backgroundColor: '#fbbf24' }]} />
                      <View style={[styles.bar, { height: (esc.ingresos / maxGrafico) * 150, backgroundColor: '#2eaa51' }]} />
                    </View>
                    <Text style={styles.chartLabel}>{esc.nombre}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2eaa51' }]} /><Text style={styles.legendText}>Ingresos</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legendText}>Costos</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#fbbf24' }]} /><Text style={styles.legendText}>Ganancia Neta</Text></View>
            </View>
          </TarjetaResultado>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafafc' },
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  centerText: { textAlign: 'center' },

  header: { marginBottom: 20, marginTop: 10, paddingHorizontal: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backButtonTouchable: { padding: 8, marginLeft: -8 },
  backText: { color: '#4b5563', fontSize: 14, fontWeight: '500', marginLeft: 6 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },

  greenCardCustom: { marginBottom: 12 },
  yellowCardCustom: { marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardHeaderTitle: { color: '#ecfdf5', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: '#bbf7d0', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statLabelYellow: { color: '#fef3c7', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statValue: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  divider: { width: 1, height: 40, backgroundColor: '#86efac', opacity: 0.5 },
  dividerYellow: { width: 1, height: 40, backgroundColor: '#fde68a', opacity: 0.5 },

  recommendationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  recommendationTitle: {
    marginLeft: 10,
    fontSize: 24,
    fontWeight: '800',
    color: '#06603a',
    flexShrink: 1,
  },
  recommendationTitleRed: {
    color: '#b91c1c',
  },
  recommendationText: {
    fontSize: 18,
    lineHeight: 27,
    color: '#055b36',
    marginBottom: 12,
  },
  recommendationTextRed: {
    color: '#7f1d1d',
  },
  recommendationInfoBox: {
    backgroundColor: '#ddeaff',
    borderWidth: 1,
    borderColor: '#b9cfff',
    borderRadius: 12,
    padding: 12,
  },
  recommendationInfoBoxRed: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  recommendationInfoText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1e3a8a',
  },
  recommendationInfoStrong: {
    fontWeight: '700',
    color: '#1d4ed8',
  },

  extraInfoText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    elevation: 2,
  },
  cardHalfLeft: {
    flex: 1,
    marginRight: 8,
  },
  cardHalfRight: {
    flex: 1,
    marginLeft: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 16 },

  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, marginBottom: 20 },
  chartYAxis: { justifyContent: 'space-between', height: 180, paddingRight: 10, width: 30 },
  chartYText: { fontSize: 10, color: '#9ca3af', fontWeight: '500' },
  chartBarsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', flex: 1, borderLeftWidth: 1, borderBottomWidth: 1, borderLeftColor: '#e5e7eb', borderBottomColor: '#e5e7eb', paddingLeft: 10, paddingBottom: 10 },
  chartColumn: { alignItems: 'center' },
  chartGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bar: { width: 10, borderRadius: 3, marginHorizontal: 1 },
  chartLabel: { fontSize: 10, color: '#6b7280', marginTop: 8, fontWeight: '500' },

  legendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 2, marginRight: 6 },
  legendText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
});
