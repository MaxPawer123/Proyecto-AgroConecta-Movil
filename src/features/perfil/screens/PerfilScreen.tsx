import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { PerfilInfoRow } from '../components/PerfilInfoRow';
import { usePerfil } from '../hooks/usePerfil';
import { styles } from './PerfilScreen.styles';

export function PerfilScreen() {
  const { perfil, sincronizando, nombrePerfil, ubicacionPerfil, onSincronizar, confirmarCierreSesion } = usePerfil();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerArea}>
            <View style={styles.avatarWrap}>
              <Ionicons name="person-outline" size={38} color="#38a837" />
            </View>
            <Text style={styles.nombre}>{nombrePerfil}</Text>
          </View>

          <View style={styles.contentWrap}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Mi Informacion</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => Alert.alert('Informacion', 'Actualiza tus datos desde el modulo de registro.')}
                >
                  <Ionicons name="create-outline" size={20} color="#38a837" />
                </TouchableOpacity>
              </View>

              <PerfilInfoRow
                icon="location-outline"
                label="Ubicacion"
                value={ubicacionPerfil || 'No registrado'}
              />

              <PerfilInfoRow
                icon="call-outline"
                label="Telefono"
                value={perfil?.telefono ?? 'No registrado'}
              />
            </View>

            <View style={styles.cardAjustes}>
              <Text style={styles.cardTitle}>Ajustes</Text>

              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => Alert.alert('Funcion deshabilitada', 'La configuracion de seguridad personalizada fue desactivada.')}
                activeOpacity={0.85}
              >
                <View style={styles.settingsLeft}>
                  <View style={[styles.roundIcon, { backgroundColor: '#e7f5e8' }]}>
                    <Ionicons name="lock-closed-outline" size={18} color="#38a837" />
                  </View>
                  <Text style={styles.settingsText}>Seguridad de la cuenta</Text>
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

              <TouchableOpacity style={styles.settingsItem} onPress={confirmarCierreSesion} activeOpacity={0.85}>
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
