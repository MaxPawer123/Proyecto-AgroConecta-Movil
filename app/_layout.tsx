import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    const inicializarSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Ignora errores de ocultado de splash para no bloquear el arranque.
      }
    };

    void inicializarSplash();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} initialRouteName="index" />;
}
