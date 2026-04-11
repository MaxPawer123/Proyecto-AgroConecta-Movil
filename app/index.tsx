import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { getDb } from '@/src/services/sqlite';

export default function Inicio() {
  const router = useRouter();

  useEffect(() => {
    let activo = true;

    const verificarEstadoProductor = async () => {
      let existeCuenta = false;

      try {
        const db = await getDb();
        const resultado = await db.getFirstAsync<{ total: number }>(
          'SELECT COUNT(1) as total FROM productor'
        );

        existeCuenta = (resultado?.total ?? 0) > 0;
      } catch {
        existeCuenta = false;
      }

      setTimeout(() => {
        if (!activo) return;

        if (existeCuenta) {
          router.replace('/(tabs)' as any);
          return;
        }

        router.replace('/auth/registro' as any);
      }, 2000);
    };

    void verificarEstadoProductor();

    return () => {
      activo = false;
    };
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.logoContainer}>
          <Image source={require('../assets/images/yapu_aroma.png')} style={styles.logo} />
          <Text style={styles.title}>Yapu Aroma</Text>
          <Text style={styles.educativo}>
            Yapu Aroma: Gestiona tus cultivos de quinua y calcula tus costos, ¡offline!
          </Text>
        </View>

        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2BA14A',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 220,
    height: 220,
    resizeMode: 'contain',
    marginBottom: 18,
  },
  title: {
    fontSize: 50,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  educativo: {
    marginTop: 18,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    maxWidth: 360,
  },
  loaderContainer: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});