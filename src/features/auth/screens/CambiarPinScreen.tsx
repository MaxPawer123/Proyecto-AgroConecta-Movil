import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { TecladoPin } from '../components/TecladoPin';
import { useAuthLocal } from '../hooks/useAuthLocal';

type Paso = 'actual' | 'nuevo' | 'confirmar';

export function CambiarPinScreen() {
  const router = useRouter();
  const { cambiarPin } = useAuthLocal();

  const [paso, setPaso] = useState<Paso>('actual');
  const [pinVisible, setPinVisible] = useState('');
  const [pinActual, setPinActual] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const textoPaso = {
    actual: {
      titulo: 'Ingresa tu PIN actual',
      subtitulo: 'Para continuar, valida tu PIN actual de 4 digitos',
    },
    nuevo: {
      titulo: 'Crea tu nuevo PIN',
      subtitulo: 'Ingresa un nuevo PIN de 4 digitos',
    },
    confirmar: {
      titulo: 'Confirma tu nuevo PIN',
      subtitulo: 'Vuelve a escribir el nuevo PIN',
    },
  }[paso];

  const resetearFlujo = () => {
    setPaso('actual');
    setPinVisible('');
    setPinActual('');
    setPinNuevo('');
  };

  const manejarPinCompleto = async (pin: string) => {
    if (paso === 'actual') {
      setPinActual(pin);
      setPaso('nuevo');
      setPinVisible('');
      return;
    }

    if (paso === 'nuevo') {
      setPinNuevo(pin);
      setPaso('confirmar');
      setPinVisible('');
      return;
    }

    if (pin !== pinNuevo) {
      Alert.alert('PIN no coincide', 'La confirmacion no coincide con el nuevo PIN. Intentalo nuevamente.');
      setPaso('nuevo');
      setPinVisible('');
      return;
    }

    setGuardando(true);

    try {
      await cambiarPin({ pinActual, pinNuevo: pin });
      Alert.alert('PIN actualizado', 'Tu PIN de seguridad fue actualizado correctamente.');
      router.replace('/(tabs)' as any);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No fue posible cambiar el PIN.';
      Alert.alert('Error', mensaje);
      resetearFlujo();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <Text style={styles.brand}>Yapu Aroma</Text>

        <TecladoPin
          valor={pinVisible}
          onCambiar={setPinVisible}
          onCompletar={(pin) => {
            if (!guardando) {
              void manejarPinCompleto(pin);
            }
          }}
          titulo={textoPaso.titulo}
          subtitulo={textoPaso.subtitulo}
        />

        <TouchableOpacity style={styles.ghostButton} onPress={resetearFlujo} disabled={guardando}>
          <Text style={styles.ghostButtonText}>Reiniciar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)' as any)} disabled={guardando}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f2f4f8',
    paddingHorizontal: 16,
    paddingTop: 58,
    paddingBottom: 22,
  },
  brand: {
    color: '#39a935',
    fontSize: 42,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  ghostButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#9ed59b',
    backgroundColor: '#ffffff',
  },
  ghostButtonText: {
    color: '#2e9c2a',
    fontSize: 17,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 12,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#6b7280',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
