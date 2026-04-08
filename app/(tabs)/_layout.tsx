import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthLocal } from '@/src/features/auth';

type RouteDestino = '/auth/registro' | '/auth/desbloqueo' | '/(tabs)' | null;

export default function TabLayout() {
  const router = useRouter();
  const { resolverRutaInicial } = useAuthLocal();
  const [destino, setDestino] = useState<RouteDestino>(null);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    let activo = true;

    const validarAcceso = async () => {
      try {
        const rutaInicial = await resolverRutaInicial();
        if (!activo) return;

        setDestino(rutaInicial === '/(tabs)' ? null : rutaInicial);
      } catch {
        if (!activo) return;

        setDestino('/auth/desbloqueo');
      } finally {
        if (activo) {
          setVerificando(false);
        }
      }
    };

    void validarAcceso();

    return () => {
      activo = false;
    };
  }, [resolverRutaInicial]);

  useEffect(() => {
    if (destino) {
      router.replace(destino as any);
    }
  }, [destino, router]);

  if (verificando) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2BA14A" />
      </SafeAreaView>
    );
  }

  if (destino) {
    return null;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2BA14A',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          if (route.name === 'rubros') {
            iconName = focused ? 'leaf' : 'leaf-outline';
          } else if (route.name === 'reportes') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'creditos') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = focused ? 'home' : 'home-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
        }}
      />
      <Tabs.Screen
        name="rubros"
        options={{
          title: 'Rubros',
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: 'Reportes',
        }}
      />
      <Tabs.Screen
        name="creditos"
        options={{
          title: 'Perfil',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    height: 70,
    paddingTop: 2,
    paddingBottom: 18,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabItem: {
    paddingVertical: 0,
  },
});