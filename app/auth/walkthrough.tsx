import React, { useMemo, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';

type WalkthroughStep = {
  id: number;
  titulo: string;
  mensaje: string;
  imageSource: number;
  cta: string;
};

export default function WalkthroughScreen() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);

  const pasos = useMemo<WalkthroughStep[]>(
    () => [
      {
        id: 1,
        titulo: 'SIEMBRA CON CONFIANZA',
        mensaje:
          '¡Yapu Aroma te guía desde la siembra! Registra tus lotes y sigue el crecimiento de tu quinua.',
        imageSource: require('../../assets/images/quinua 1.png'),
        cta: 'Siguiente',
      },
      {
        id: 2,
        titulo: 'CONTROLA TUS COSTOS EN CAMPO',
        mensaje:
          'Calcula tus costos al instante en el campo, ¡offline! Mantén tus finanzas al día.',
        imageSource: require('../../assets/images/quinua 2.jpeg'),
        cta: 'Siguiente',
      },
      {
        id: 3,
        titulo: 'GENERA REPORTES PARA FINANCIARTE',
        mensaje:
          'Genera reportes PDF profesionales para bancos y cooperativas. ¡Asegura tu financiamiento!',
        imageSource: require('../../assets/images/quinua 3.png'),
        cta: 'Empezar Registro',
      },
    ],
    []
  );

  const pasoActual = pasos[paso - 1];

  const avanzar = () => {
    if (paso < 3) {
      setPaso((prev) => prev + 1);
      return;
    }

    router.replace('/auth/registro' as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#EFEFEF" />

        <View style={styles.progresoWrap} accessibilityLabel={`Paso ${paso} de 3`}>
          {pasos.map((item) => (
            <View
              key={item.id}
              style={[
                styles.segmento,
                item.id === paso ? styles.puntoActivo : styles.puntoInactivo,
              ]}
            />
          ))}
        </View>

        <View style={styles.contenidoWrap}>
          <Image
            source={pasoActual.imageSource}
            style={styles.imagen}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            accessibilityLabel={`Imagen de quinua para el paso ${paso}`}
          />

          <Text style={styles.titulo} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            {pasoActual.titulo}
          </Text>

          <Text style={styles.comentario} maxFontSizeMultiplier={1.6}>
            {pasoActual.mensaje}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.boton, pressed && styles.botonPresionado]}
          onPress={avanzar}
          accessibilityRole="button"
          accessibilityLabel={paso === 3 ? 'Empezar Registro' : 'Siguiente paso'}
        >
          <Text style={styles.botonTexto}>{pasoActual.cta}</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFEFEF',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 30,
  },
  progresoWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 12,
    width: '100%',
    marginTop: 8,
  },
  segmento: {
    flex: 1,
    height: 6,
    borderRadius: 4,
  },
  puntoActivo: {
    backgroundColor: '#76D777',
  },
  puntoInactivo: {
    backgroundColor: '#CFCFCF',
  },
  contenidoWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 14,
    flex: 1,
    justifyContent: 'center',
  },
  imagen: {
    width: '100%',
    height: 370,
    borderRadius: 26,
    marginBottom: 28,
    backgroundColor: '#E8E8E8',
  },
  titulo: {
    color: '#0D6B53',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  comentario: {
    fontSize: 13,
    color: '#8A8E94',
    textAlign: 'center',
    lineHeight: 32,
    paddingHorizontal: 10,
    fontWeight: '400',
  },
  boton: {
    width: '100%',
    backgroundColor: '#1F8A3A',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 22,
  },
  botonPresionado: {
    opacity: 0.86,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
});
