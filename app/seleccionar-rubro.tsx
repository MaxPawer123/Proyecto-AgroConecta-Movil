import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

export default function SeleccionarRubro() {
  const router = useRouter();

  // Función para ir a la pantalla de lotes pasando el rubro elegido
  const irALotes = (rubroSeleccionado: string) => {
    // Redirige a la pantalla correspondiente según el rubro seleccionado
    const ruta = rubroSeleccionado === 'Quinua' ? '/lotes_quinua' : '/lotes_hortalizas';
    // Usamos la forma objeto y casteamos a any para evitar restricciones de tipos rígidas
    router.push({ pathname: ruta, params: { rubro: rubroSeleccionado } } as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>¿Qué cultivo deseas calcular hoy?</Text>
        <Text style={styles.subtitle}>Selecciona el rubro para ver tus parcelas o parcelas específicos.</Text>

        <View style={styles.cardsContainer}>
          
          {/* TARJETA QUINUA */}
          <TouchableOpacity 
            style={[styles.card, { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }]}
            onPress={() => irALotes('Quinua')}
          >
            <View style={styles.iconContainerGreen}>
              <MaterialCommunityIcons name="barley" size={40} color="#2eaa51" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Parcelas de Quinua</Text>
              <Text style={styles.cardDesc}>Calcula la siembra de Quinua Real, Roja y Negra.</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#2eaa51" />
          </TouchableOpacity>

          {/* TARJETA HORTALIZAS */}
          <TouchableOpacity 
            style={[styles.card, { borderColor: '#fed7aa', backgroundColor: '#fff7ed' }]}
            onPress={() => irALotes('Hortalizas')}
          >
            <View style={styles.iconContainerOrange}>
              <MaterialCommunityIcons name="carrot" size={40} color="#f97316" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Parcelas de Hortalizas</Text>
              <Text style={styles.cardDesc}>Calcula la siembra de hortalizas como papa, cebolla, zanahoria, etc.</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#f97316" />
          </TouchableOpacity>

        </View>
      </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  content: { flex: 1, padding: 20, paddingTop: 30 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 30 },
  cardsContainer: { gap: 16 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, borderWidth: 2 },
  iconContainerGreen: { width: 64, height: 64, backgroundColor: '#dcfce7', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  iconContainerOrange: { width: 64, height: 64, backgroundColor: '#ffedd5', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#4b5563', lineHeight: 18 },
});