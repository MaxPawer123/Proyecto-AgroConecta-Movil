import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  NuevaSiembra: undefined;
};

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const manejarIngresoOffline = async () => {
    try {
      const sesionOffline = {
        loggedIn: true,
        modo: 'offline',
        fecha: new Date().toISOString(),
      };

      await AsyncStorage.setItem('agroconecta_sesion', JSON.stringify(sesionOffline));
      navigation.replace('Home');
    } catch (error: unknown) {
      console.error('Error al guardar la sesion offline:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>AG</Text>
          </View>
          <Text style={styles.title}>AgroConecta</Text>
          <Text style={styles.subtitle}>
            Gestiona tus cultivos aun sin conexion.
          </Text>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={manejarIngresoOffline} activeOpacity={0.9}>
          <Text style={styles.loginButtonText}>Ingresar (Modo Offline)</Text>
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
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 40,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#E7F6EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#B8E6C3',
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1E5F2D',
  },
  title: {
    marginTop: 18,
    fontSize: 34,
    fontWeight: '800',
    color: '#1E5F2D',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    color: '#4D6A54',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 24,
  },
  loginButton: {
    backgroundColor: '#28A745',
    minHeight: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A7C33',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
