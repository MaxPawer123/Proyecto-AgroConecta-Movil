import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  obtenerGastosPorLoteApi,
  obtenerUltimaProduccionLoteApi,
} from '@/src/services/api';

const KG_POR_QUINTAL = 46;

type Gasto = {
  id: string;
  fase: string;
  categoria: string;
  descripcion: string;
  cantidad: string;
  monto: string;
};

export default function ResultadosHortalizas() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const idLote = typeof params.idLote === 'string' ? parseInt(params.idLote, 10) : (Array.isArray(params.idLote) ? parseInt(params.idLote[0], 10) : 1);

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [produccion, setProduccion] = useState({
    cantidad: '',
    precio: '',
  });
  const [unidadCantidad, setUnidadCantidad] = useState<'kg' | 'qq'>('qq');
  const [unidadPrecio, setUnidadPrecio] = useState<'bskg' | 'bsqq'>('bsqq');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, [idLote]);

  const cargarDatos = async () => {
    try {
      const gastosApi = await obtenerGastosPorLoteApi(idLote);
      const gastoParcial: Gasto[] = (gastosApi || []).map((g: any, idx: number) => ({
        id: String(idx),
        fase: g.tipo_costo || 'Desconocida',
        categoria: g.categoria || 'Sin categoría',
        descripcion: g.descripcion || '',
        cantidad: String(g.cantidad || 0),
        monto: String((g.cantidad * g.costo_unitario) || 0),
      }));
      setGastos(gastoParcial);

      const produccionApi = await obtenerUltimaProduccionLoteApi(idLote);
      if (produccionApi) {
        const cantidadKg = parseFloat(produccionApi.cantidad_obtenida) || 0;
        const precioKg = parseFloat(produccionApi.precio_venta) || 0;
        const cantidadQq = cantidadKg > 0 ? cantidadKg / KG_POR_QUINTAL : 0;
        const precioQq = precioKg > 0 ? precioKg * KG_POR_QUINTAL : 0;

        setProduccion({
          cantidad: cantidadQq > 0 ? cantidadQq.toFixed(2) : '',
          precio: precioQq > 0 ? precioQq.toFixed(2) : '',
        });
      }
    } catch (error) {
      console.warn('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos de resultados');
    } finally {
      setLoading(false);
    }
  };

  // CÁLCULOS
  const qtyProducidaQq = parseFloat(produccion.cantidad) || 0;
  const precioVentaQq = parseFloat(produccion.precio) || 0;
  const qtyProducidaKg = qtyProducidaQq * KG_POR_QUINTAL;
  const precioVentaKg = precioVentaQq / KG_POR_QUINTAL;

  const totalCostos = gastos.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);
  const costoPorKg = qtyProducidaKg > 0 ? totalCostos / qtyProducidaKg : 0;
  const ingresosTotales = qtyProducidaKg * precioVentaKg;
  const gananciaNeta = ingresosTotales - totalCostos;
  const margenGanancia = ingresosTotales > 0 ? (gananciaNeta / ingresosTotales) * 100 : 0;
  const puntoEquilibrio = precioVentaKg > 0 ? totalCostos / precioVentaKg : 0;
  const puntoEquilibrioKg = Math.ceil(puntoEquilibrio);
  const esRentable = gananciaNeta >= 0;

  const escenarios = [
    {
      nombre: 'Pesimista',
      ingresos: ingresosTotales * 0.7,
      costos: totalCostos,
      ganancia: (ingresosTotales * 0.7) - totalCostos,
    },
    {
      nombre: 'Realista',
      ingresos: ingresosTotales,
      costos: totalCostos,
      ganancia: gananciaNeta,
    },
    {
      nombre: 'Optimista',
      ingresos: ingresosTotales * 1.3,
      costos: totalCostos,
      ganancia: (ingresosTotales * 1.3) - totalCostos,
    },
  ];

  const maxGrafico = Math.max(...escenarios.map(s => Math.max(s.ingresos, s.costos, Math.max(s.ganancia, 0))), 100);

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
        {/* HEADER */}
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
              <Text style={styles.title}>Resultados Hortalizas</Text>
              <Text style={styles.subtitle}>Análisis financiero de tu lote</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* GASTOS TOTALES */}
          <View style={styles.greenCard}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="receipt-outline" size={18} color="#ecfdf5" />
              <Text style={styles.cardHeaderTitle}>Gastos totales</Text>
            </View>
            <View style={styles.statsRow}>
              <View>
                <Text style={styles.statLabel}>Total Costos</Text>
                <Text style={styles.statValue}>Bs {totalCostos.toFixed(2)}</Text>
              </View>
              <View style={styles.divider} />
              <View>
                <Text style={styles.statLabel}>Costo por Kilogramo</Text>
                <Text style={styles.statValue}>Bs {costoPorKg.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* INGRESOS TOTALES */}
          <View style={styles.yellowCard}>
            <View style={styles.statsRow}>
              <View>
                <Text style={styles.statLabelYellow}>Ingresos Totales</Text>
                <Text style={styles.statValue}>Bs {ingresosTotales.toFixed(2)}</Text>
              </View>
              <View style={styles.dividerYellow} />
              <View>
                <Text style={styles.statLabelYellow}>Ganancia Neta</Text>
                <View style={styles.rowCenter}>
                  <Text style={styles.statValue}>Bs {gananciaNeta.toFixed(2)}</Text>
                  {gananciaNeta > 0 && <Ionicons name="trending-up" size={20} color="#fff" style={{ marginLeft: 5 }} />}
                </View>
              </View>
            </View>
          </View>

          {/* RECOMENDACIÓN */}
          <View style={[
            styles.recommendationCard,
            !esRentable && styles.recommendationCardRed
          ]}>
            <View style={styles.recommendationHeader}>
              <Ionicons
                name={esRentable ? 'happy-outline' : 'alert-circle-outline'}
                size={24}
                color={esRentable ? '#16a34a' : '#dc2626'}
              />
              <Text style={[styles.recommendationTitle, !esRentable && styles.recommendationTitleRed]}>
                {esRentable ? '¡Excelente! Te conviene vender' : 'Atención: revisa tu precio de venta'}
              </Text>
            </View>

            <Text style={[styles.recommendationText, !esRentable && styles.recommendationTextRed]}>
              {esRentable
                ? 'Tu precio de venta cubre muy bien tus gastos de producción. ¡Vas a ganar bien!'
                : 'Con el precio actual no alcanzas a cubrir los costos. Sube el precio o reduce gastos.'}
            </Text>

            <View style={[styles.recommendationInfoBox, !esRentable && styles.recommendationInfoBoxRed]}>
              <Text style={styles.recommendationInfoText}>
                💡 <Text style={styles.recommendationInfoStrong}>¡Buenas noticias!</Text>{' '}
                Solo necesitas vender{' '}
                <Text style={styles.recommendationInfoStrong}>{puntoEquilibrioKg} kg</Text>{' '}
                para recuperar toda tu inversión.
                {esRentable ? ' ¡El resto es ganancia pura! 🎯' : ''}
              </Text>
            </View>
          </View>

          {/* MARGEN Y PUNTO DE EQUILIBRIO */}
          <View style={styles.row}>
            <View style={[styles.card, { flex: 1, marginRight: 8, alignItems: 'center' }]}>
              <Text style={styles.cardSubtitle}>Margen Ganancia</Text>
              <Text style={[styles.statValue, { color: '#2eaa51', fontSize: 22 }]}>{margenGanancia.toFixed(1)}%</Text>
            </View>
            <View style={[styles.card, { flex: 1, marginLeft: 8, alignItems: 'center' }]}>
              <Text style={styles.cardSubtitle}>Punto Equilibrio</Text>
              <Text style={[styles.statValue, { color: '#1f2937', fontSize: 22 }]}>{Math.ceil(puntoEquilibrio)} kg</Text>
            </View>
          </View>

          {/* GRÁFICO DE PROYECCIÓN */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Proyección de Ingresos</Text>
            <Text style={styles.cardSubtitle}>Pesimista (70%) | Realista (100%) | Optimista (130%)</Text>

            <View style={styles.chartContainer}>
              {/* Eje Y */}
              <View style={styles.chartYAxis}>
                <Text style={styles.chartYText}>{Math.round(maxGrafico)}</Text>
                <Text style={styles.chartYText}>{Math.round(maxGrafico / 2)}</Text>
                <Text style={styles.chartYText}>0</Text>
              </View>

              {/* Barras */}
              <View style={styles.chartBarsContainer}>
                {escenarios.map((esc, index) => (
                  <View key={index} style={{ alignItems: 'center' }}>
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

            {/* Leyenda */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2eaa51' }]} /><Text style={styles.legendText}>Ingresos</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legendText}>Costos</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#fbbf24' }]} /><Text style={styles.legendText}>Ganancia Neta</Text></View>
            </View>
          </View>
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
  header: { marginBottom: 20, marginTop: 10, paddingHorizontal: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backButtonTouchable: { padding: 8, marginLeft: -8 },
  backText: { color: '#4b5563', fontSize: 14, fontWeight: '500', marginLeft: 6 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },

  // Tarjetas financieras
  greenCard: { backgroundColor: '#3b9f46', borderRadius: 16, padding: 20, marginBottom: 12 },
  yellowCard: { backgroundColor: '#eab308', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardHeaderTitle: { color: '#ecfdf5', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: '#bbf7d0', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statLabelYellow: { color: '#fef3c7', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statValue: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  divider: { width: 1, height: 40, backgroundColor: '#86efac', opacity: 0.5 },
  dividerYellow: { width: 1, height: 40, backgroundColor: '#fde68a', opacity: 0.5 },

  // Recomendación
  recommendationCard: {
    backgroundColor: '#eefbf2',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  recommendationCardRed: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
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

  // Tarjetas genéricas
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#f3f4f6', elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 16 },

  // Gráfico
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, marginBottom: 20 },
  chartYAxis: { justifyContent: 'space-between', height: 180, paddingRight: 10, width: 30 },
  chartYText: { fontSize: 10, color: '#9ca3af', fontWeight: '500' },
  chartBarsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', flex: 1, borderLeftWidth: 1, borderBottomWidth: 1, borderLeftColor: '#e5e7eb', borderBottomColor: '#e5e7eb', paddingLeft: 10, paddingBottom: 10 },
  chartGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bar: { width: 10, borderRadius: 3, marginHorizontal: 1 },
  chartLabel: { fontSize: 11, color: '#6b7280', marginTop: 12, fontWeight: '600', textAlign: 'center' },

  // Leyenda
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 12, height: 12, borderRadius: 2, marginRight: 6 },
  legendText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
});
