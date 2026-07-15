import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePerfil } from '../hooks/usePerfil';
import { PerfilInfoRow } from '../components/PerfilInfoRow';

export function PerfilScreen() {
  const router = useRouter();
  const { nombrePerfil, perfil } = usePerfil();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.bgCircleOne} />
          <View style={styles.bgCircleTwo} />
          <View style={styles.headerArea}>
            <View style={styles.avatarWrap}>
              <Ionicons name="person-outline" size={38} color="#2BA14A" />
            </View>
            <Text style={styles.nombre}>{nombrePerfil}</Text>
            <Text style={styles.headerSubtitle}>PERFIL DEL PRODUCTOR</Text>
          </View>

          <View style={styles.contentWrap}>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Mi Información</Text>
                <View style={styles.localBadge}>
                </View>
              </View>

              <PerfilInfoRow icon="person-outline" label="Nombre" value={perfil?.nombre || 'No registrado'} />
              <PerfilInfoRow icon="text-outline" label="Apellido" value={perfil?.apellido || 'No registrado'} />
              <PerfilInfoRow icon="location-outline" label="Departamento" value={perfil?.departamento || 'No registrado'} />
              <PerfilInfoRow icon="map-outline" label="Municipio" value={perfil?.municipio || 'No registrado'} />
              <PerfilInfoRow icon="home-outline" label="Comunidad" value={perfil?.comunidad || 'No registrado'} />
              <PerfilInfoRow icon="call-outline" label="Teléfono" value={perfil?.telefono ?? 'No registrado'} />
            </View>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/editar-perfil' as any)}
              activeOpacity={0.88}
            >
              <View style={styles.editButtonLeft}>
                <View style={styles.editButtonIconWrap}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={styles.editButtonTitle}>Editar perfil</Text>
                  <Text style={styles.editButtonSubtitle}>Actualizar datos guardados en este dispositivo</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ffffff" />
            </TouchableOpacity>

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

            <TouchableOpacity
              style={styles.apoyoButton}
              onPress={() => router.push('/con-el-apoyo-de' as any)}
              activeOpacity={0.85}
            >
              <View style={styles.teamButtonLeft}>
                <Ionicons name="heart-outline" size={18} color="#166534" />
                <Text style={styles.teamButtonText}>Con el apoyo de</Text>
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
    backgroundColor: '#eef7f0',
  },
  scrollContent: {
    paddingBottom: 32,
    position: 'relative',
  },
  bgCircleOne: {
    position: 'absolute',
    top: 26,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(43, 161, 74, 0.12)',
  },
  bgCircleTwo: {
    position: 'absolute',
    top: 180,
    left: -70,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(20, 184, 129, 0.08)',
  },
  headerArea: {
    backgroundColor: '#166534',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 66,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  nombre: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  contentWrap: {
    marginTop: -48,
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#dcfce7',
    borderRadius: 999,
  },
  localBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  editButton: {
    minHeight: 72,
    backgroundColor: '#2BA14A',
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#2BA14A',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 5,
  },
  editButtonLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  editButtonIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  editButtonTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  editButtonSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    maxWidth: 230,
  },
  teamButton: {
    minHeight: 62,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
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
  apoyoButton: {
    minHeight: 62,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 3,
  },
});
