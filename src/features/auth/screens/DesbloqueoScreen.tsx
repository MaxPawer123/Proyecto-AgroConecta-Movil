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
  const [mostrarTeclado, setMostrarTeclado] = useState(false);
  const [intentandoHuella, setIntentandoHuella] = useState(false);

  const irMenu = () => {
    router.replace('/menu');
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

      <View style={styles.container}>
        {/* Header con espaciado mejorado */}
        <View style={styles.header}>
          <Text style={styles.brand}>Yapu Aroma</Text>
          <Text style={styles.greeting}>Hola de nuevo</Text>
        </View>

        {!mostrarTeclado ? (
          <View style={styles.huellaContainer}>
            <View style={styles.huellaIconBox}>
              <Ionicons name="finger-print" size={70} color="#2b9b3c" />
            </View>
            <Text style={styles.huellaTexto}>
              {intentandoHuella ? 'Validando identidad...' : 'Toca el sensor para entrar'}
            </Text>
            <TouchableOpacity onPress={() => setMostrarTeclado(true)} style={styles.btnPinSecundario}>
              <Text style={styles.enlace}>Usar PIN de seguridad</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pinContent}>
            <View style={styles.tecladoWrapper}>
              <TecladoPin
                valor={pin}
                onCambiar={setPin}
                onCompletar={(valor) => {
                  void onCompletarPin(valor);
                }}
                titulo="Ingresa tu PIN de seguridad"
                // Asegúrate de que tu componente TecladoPin use círculos perfectos
              />
            </View>

            <View style={styles.footer}>
              <TouchableOpacity 
                onPress={() => Alert.alert('Recuperar', 'Lógica para recuperar PIN')}
                style={styles.footerBtn}
              >
                <Text style={styles.olvidastePin}>¿Olvidaste tu PIN?</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.replace('/')}
                style={styles.footerBtn}
              >
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
  container: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  brand: {
    color: '#2b9b3c',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  greeting: {
    color: '#64748b',
    fontSize: 18,
    marginTop: 5,
  },
  huellaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  huellaIconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  huellaTexto: {
    color: '#475569',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  pinContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
  },
  tecladoWrapper: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -20, // Ajuste para centrar visualmente
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerBtn: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  olvidastePin: {
    color: '#2b9b3c',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  regresarInicio: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 10,
  },
  enlace: {
    color: '#2b9b3c',
    fontSize: 16,
    fontWeight: '600',
  },
  btnPinSecundario: {
    padding: 10,
  }
});