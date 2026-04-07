import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { TecladoPin } from '../components/TecladoPin';
import { useAuthLocal } from '../hooks/useAuthLocal';
import { limpiarRegistroPinDraft, obtenerRegistroPinDraft } from '../utils/registroPinDraft';

type PasoPin = 'crear' | 'confirmar';

export function CreacionPinScreen() {
  const router = useRouter();
  const { registrarProductor } = useAuthLocal();

  const [pasoPin, setPasoPin] = useState<PasoPin>('crear');
  const [pinVisible, setPinVisible] = useState('');
  const [pinCreado, setPinCreado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [tieneBorrador, setTieneBorrador] = useState(true);

  useEffect(() => {
    const borrador = obtenerRegistroPinDraft();
    if (!borrador) {
      setTieneBorrador(false);
    }
  }, []);

  const resetearPin = () => {
    setPasoPin('crear');
    setPinVisible('');
    setPinCreado('');
  };

  const validarPin = (valor: string) => /^\d{4}$/.test(valor);

  const guardarRegistro = async (pinFinal: string) => {
    const borrador = obtenerRegistroPinDraft();
    if (!borrador) {
      Alert.alert('Registro incompleto', 'Vuelve al registro para completar tus datos.');
      router.replace('/auth/registro' as any);
      return;
    }

    setGuardando(true);

    try {
      const resultadoRegistro = await registrarProductor({
        nombre: borrador.nombre,
        apellido: borrador.apellido,
        telefono: borrador.telefono,
        pin: pinFinal,
        departamento: borrador.departamento,
        municipio: borrador.municipio,
        comunidad: borrador.comunidad,
      });

      limpiarRegistroPinDraft();
      Alert.alert(
        'Registro completado',
        'Tu perfil se guardo localmente. La sincronizacion con el backend se ejecuta en segundo plano.'
      );
      router.replace('/(tabs)' as any);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No fue posible guardar tu perfil local.';
      Alert.alert('Error al registrar', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const manejarContinuar = async () => {
    if (guardando) return;

    const pinIngresado = pinVisible.replace(/\D+/g, '').slice(0, 4);
    if (!validarPin(pinIngresado)) {
      Alert.alert('Verifica tu PIN', 'Ingresa los 4 digitos antes de continuar.');
      return;
    }

    if (pasoPin === 'crear') {
      setPinCreado(pinIngresado);
      setPasoPin('confirmar');
      setPinVisible('');
      return;
    }

    if (pinCreado !== pinIngresado) {
      Alert.alert('PIN no coincide', 'La confirmacion no coincide con el PIN creado.');
      setPinVisible('');
      return;
    }

    await guardarRegistro(pinIngresado);
  };

  const textoPin = pasoPin === 'crear'
    ? {
        paso: 'Paso 1 de 2',
        titulo: 'Crea tu PIN de seguridad',
        subtitulo: 'Este PIN te permitira acceder a la aplicacion',
        boton: 'Continuar',
      }
    : {
        paso: 'Paso 2 de 2',
        titulo: 'Confirma tu PIN',
        subtitulo: 'Vuelve a ingresar tu PIN de 4 digitos',
        boton: 'Guardar y continuar',
      };

  if (!tieneBorrador) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.safeScreen}>
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>Falta completar el registro</Text>
            <Text style={styles.emptyStateText}>Primero llena tus datos personales y luego vuelve a crear tu PIN.</Text>

            <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/auth/registro' as any)}>
              <Text style={styles.primaryButtonText}>Volver al registro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.brand}>Yapu Aroma</Text>
          <Text style={styles.paso}>{textoPin.paso}</Text>
          <Text style={styles.title}>{textoPin.titulo}</Text>
          <Text style={styles.subtitle}>{textoPin.subtitulo}</Text>
        </View>

        <View style={styles.card}>
          <TecladoPin
            valor={pinVisible}
            onCambiar={setPinVisible}
            longitud={4}
            titulo=""
            subtitulo=""
            autoCompletar={false}
          />

          <TouchableOpacity
            style={[styles.primaryButton, guardando || pinVisible.length !== 4 ? styles.primaryButtonDisabled : null]}
            onPress={() => void manejarContinuar()}
            disabled={guardando || pinVisible.length !== 4}
          >
            <Text style={styles.primaryButtonText}>{guardando ? 'Guardando...' : textoPin.boton}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={resetearPin} disabled={guardando}>
            <Text style={styles.linkText}>Reiniciar PIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safeScreen: {
    flex: 1,
    backgroundColor: '#eef2f7',
    justifyContent: 'center',
    padding: 18,
  },
  emptyStateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#dfe4ec',
  },
  emptyStateTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: '#0f2342',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 18,
  },
  screen: {
    flex: 1,
    backgroundColor: '#eef2f7',
    paddingHorizontal: 18,
    paddingTop: 36,
    paddingBottom: 18,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  brand: {
    color: '#39a935',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 6,
  },
  paso: {
    color: '#39a935',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#0f2342',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dfe4ec',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#39a935',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 12,
  },
  linkText: {
    color: '#64748b',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});