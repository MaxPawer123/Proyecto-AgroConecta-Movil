import React, { useCallback, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { obtenerLotesLocales } from '@/src/services/database';

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  NuevaSiembra: undefined;
};

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

type LoteLocal = {
  id_local?: number | null;
  nombre_lote?: string | null;
  superficie?: number | null;
  fecha_siembra?: string | null;
};

type LoteCardProps = {
  item: LoteLocal;
};

function LoteCard({ item }: LoteCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.nombre_lote || 'Lote sin nombre'}</Text>
      <Text style={styles.cardText}>Superficie: {item.superficie ?? 'N/D'} Ha</Text>
      <Text style={styles.cardText}>Fecha de siembra: {item.fecha_siembra || 'N/D'}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [lotes, setLotes] = useState<LoteLocal[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargarLotes = useCallback(async () => {
    try {
      setCargando(true);
      const datos = await obtenerLotesLocales();
      setLotes(Array.isArray(datos) ? (datos as LoteLocal[]) : []);
    } catch (error) {
      console.error('Error al cargar lotes locales:', error);
      setLotes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarLotes();
    }, [cargarLotes])
  );

  const renderItem = ({ item }: { item: LoteLocal }) => <LoteCard item={item} />;

  const renderEmptyState = () => {
    if (cargando) {
      return <Text style={styles.emptyText}>Cargando lotes locales...</Text>;
    }

    return (
      <Text style={styles.emptyText}>
        No tienes lotes registrados. Presiona el boton + para empezar.
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Mis Lotes</Text>

        <FlatList
          data={lotes}
          keyExtractor={(item, index) => String(item.id_local ?? `lote-${index}`)}
          renderItem={renderItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={lotes.length === 0 ? styles.emptyContainer : styles.listContainer}
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            navigation.navigate('NuevaSiembra');
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6FAF7',
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1F5E30',
    marginTop: 16,
    marginBottom: 14,
  },
  listContainer: {
    paddingBottom: 110,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DCEEDD',
    shadowColor: '#143A1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F5E30',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#435A49',
    marginBottom: 4,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 60,
  },
  emptyText: {
    textAlign: 'center',
    color: '#587161',
    fontSize: 16,
    lineHeight: 24,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#28A745',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A7C33',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 36,
    marginTop: -2,
    fontWeight: '500',
  },
});
