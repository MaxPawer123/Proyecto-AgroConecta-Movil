import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const [isLogged, setIsLogged] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const validarSesion = async () => {
      try {
        const session = await AsyncStorage.getItem('sesion_activa');

        if (!mounted) {
          return;
        }

        setIsLogged(session === 'true');
      } catch {
        if (mounted) {
          setIsLogged(false);
        }
      } finally {
        if (mounted) {
          await SplashScreen.hideAsync();
        }
      }
    };

    void validarSesion();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLogged === null) {
      return;
    }

    router.replace(isLogged ? '/(tabs)' : '/');
  }, [isLogged, router]);

  if (isLogged === null) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} initialRouteName="index" />;
}
