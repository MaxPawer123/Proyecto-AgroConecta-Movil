import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { TecladoPin } from '../components/TecladoPin';
import { useAuthLocal } from '../hooks/useAuthLocal';
import { SafeAreaView } from 'react-native-safe-area-context';

export function DesbloqueoScreen() {
  const router = useRouter();
  const { desbloquearApp } = useAuthLocal();

  const [pin, setPin] = useState('');
  const [mostrarTeclado, setMostrarTeclado] = useState(true); 
  const [intentandoHuella, setIntentandoHuella] = useState(false);

  const irMenu = () => {
    router.replace('/home' as any);
  };

  const intentarBiometria = async () => {
    setIntentandoHuella(true);
    try {
      const tieneHardware = await LocalAuthentication.hasHardwareAsync();
      const tieneBiometria = await LocalAuthentication.isEnrolledAsync();

      if (!tieneHardware || !tieneBiometria) {
        setMostrarTeclado(true);
        return;
      }

      const resultado = await desbloquearApp();
      if (resultado.desbloqueado) {
        irMenu();
        return;
      }
      setMostrarTeclado(true);
    } finally {
      setIntentandoHuella(false);
    }
  };

  useEffect(() => {
    void intentarBiometria();
  }, []);

  const onCompletarPin = async (pinIngresado: string) => {
    try {
      const resultado = await desbloquearApp(pinIngresado);
      if (resultado.desbloqueado) {
        irMenu();
        return;
      }
      Alert.alert('PIN incorrecto', 'Vuelve a intentar con tus 4 dígitos.');
      setPin('');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No fue posible validar tu PIN.';
      Alert.alert('Error de autenticación', mensaje);
      setPin('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.brand}>Yapu Aroma</Text>
          <Text style={styles.holaNuevo}>Hola de nuevo</Text>
        </View>

        {!mostrarTeclado ? (
          <View style={styles.huellaContainer}>
            <View style={styles.huellaIconBox}>
              <Ionicons name="finger-print" size={80} color="#2ba14a" />
            </View>
            <Text style={styles.huellaTexto}>
              {intentandoHuella ? 'Validando identidad...' : 'Toca el sensor para entrar'}
            </Text>
            <TouchableOpacity onPress={() => setMostrarTeclado(true)}>
              <Text style={styles.enlace}>Usar PIN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pinContainer}>
            <View style={styles.tecladoWrapper}>
              <TecladoPin
                valor={pin}
                onCambiar={setPin}
                onCompletar={(valor) => {
                  void onCompletarPin(valor);
                }}
                titulo="Ingresa tu PIN de seguridad"
              />
            </View>

            <View style={styles.linksContainer}>
              <TouchableOpacity onPress={() => Alert.alert('Recuperar', 'Lógica para recuperar PIN')}>
                <Text style={styles.olvidastePin}>¿Olvidaste tu PIN?</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.replace('/')}>
                <Text style={styles.regresarInicio}>← Volver al inicio</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 50, // Más espacio arriba para que no quede pegado
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brand: {
    color: '#2BA14A',
    fontSize: 28, // Tamaño idéntico al diseño
    fontWeight: '700',
    marginBottom: 8,
  },
  holaNuevo: {
    color: '#334155',
    fontSize: 18,
    fontWeight: '400',
  },
  pinContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tecladoWrapper: {
    flexGrow: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  huellaContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  huellaIconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  huellaTexto: {
    color: '#475569',
    fontSize: 16,
    marginBottom: 20,
  },
  enlace: {
    color: '#2BA14A',
    textDecorationLine: 'underline',
    fontSize: 16,
  },
  linksContainer: {
    alignItems: 'center',
    paddingBottom: 30, // Separación inferior
  },
  olvidastePin: {
    color: '#2BA14A',
    fontSize: 15,
    textDecorationLine: 'underline',
    marginBottom: 20,
  },
  regresarInicio: {
    color: '#64748B',
    fontSize: 14,
    textDecorationLine: 'underline', // Subrayado para igualar al diseño
  },
});