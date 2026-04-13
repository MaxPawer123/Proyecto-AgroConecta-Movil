import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePerfil } from '../hooks/usePerfil';

export function PerfilScreen() {
  const router = useRouter();
  const { nombrePerfil, ubicacionPerfil, perfil } = usePerfil();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerArea}>
            <View style={styles.avatarWrap}>
              <Ionicons name="person-outline" size={38} color="#2BA14A" />
            </View>
            <Text style={styles.nombre}>{nombrePerfil}</Text>
          </View>

          <View style={styles.contentWrap}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mi Información</Text>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={19} color="#2BA14A" />
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Ubicación</Text>
                  <Text style={styles.infoValue}>{ubicacionPerfil || 'No registrado'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={19} color="#2BA14A" />
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Teléfono</Text>
                  <Text style={styles.infoValue}>{perfil?.telefono ?? 'No registrado'}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.teamButton}
              onPress={() => router.push('/nuestro-equipo' as any)}
              activeOpacity={0.85}
            >
              <View style={styles.teamButtonLeft}>
                <Ionicons name="people-outline" size={18} color="#166534" />
                <Text style={styles.teamButtonText}>Nuestro Equipo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#166534" />
            </TouchableOpacity>
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
    backgroundColor: '#2BA14A',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 62,
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
  cardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    columnGap: 10,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 17,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 20,
    color: '#0f172a',
    lineHeight: 28,
  },
  teamButton: {
    minHeight: 62,
    backgroundColor: '#f3f3f3',
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  teamButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#166534',
  },
});
