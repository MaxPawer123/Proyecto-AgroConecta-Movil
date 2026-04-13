import React, { useEffect, useRef } from 'react';
import {
  Animated,
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
  const logosArribaOpacity = useRef(new Animated.Value(0)).current;
  const contenidoOpacity = useRef(new Animated.Value(0)).current;
  const contenidoTranslate = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    let activo = true;

    Animated.sequence([
      Animated.timing(logosArribaOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(contenidoOpacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(contenidoTranslate, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

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
          router.replace('/(tabs)' as any); //'/(tabs)'
          return;
        }

        router.replace('/auth/walkthrough' as any);
      }, 5000);
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
        <StatusBar barStyle="dark-content" />
    
        <Animated.View style={[styles.badgesContainer, { opacity: logosArribaOpacity }]}> 
          <Image source={require('../assets/images/umsamejor.png')} style={styles.badgePrincipal} />
          <Image source={require('../assets/images/logoquinueros.png')} style={styles.badgeSecundario} />
        </Animated.View>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: contenidoOpacity,
              transform: [{ translateY: contenidoTranslate }],
            },
          ]}
        >
          <Image source={require('../assets/images/yapu_aroma.png')} style={styles.logo} />
          <Text style={styles.title}>Yapu Aroma</Text>
          <Text style={styles.educativo}>
            Gestiona tus cultivos de quinua y calcula tus costos.
          </Text>
        </Animated.View>

        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#2BA14A" />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: 5,
    paddingBottom: 48,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgesContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  badgePrincipal: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
  },
  badgeSecundario: {
    width: 160,
    height: 95,
    resizeMode: 'contain',
  },
  logo: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#1D7F39',
    textAlign: 'center',
  },
  educativo: {
    marginTop: 18,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
    color: '#1D7F39',
    textAlign: 'center',
    maxWidth: 360,
  },
  loaderContainer: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});