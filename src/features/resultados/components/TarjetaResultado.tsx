import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type TarjetaResultadoProps = {
  titulo?: string;
  subtitulo?: string;
  variante?: 'normal' | 'verde' | 'amarilla' | 'alerta' | 'alertaNegativa';
  style?: any;
  children: React.ReactNode;
};

export function TarjetaResultado({
  titulo,
  subtitulo,
  variante = 'normal',
  style,
  children,
}: TarjetaResultadoProps) {
  const varianteStyle =
    variante === 'verde'
      ? styles.verde
      : variante === 'amarilla'
        ? styles.amarilla
        : variante === 'alerta'
          ? styles.alerta
          : variante === 'alertaNegativa'
            ? styles.alertaNegativa
            : styles.normal;

  return (
    <View style={[styles.base, varianteStyle, style]}>
      {!!titulo && <Text style={[styles.titulo, variante === 'verde' || variante === 'amarilla' ? styles.tituloClaro : undefined]}>{titulo}</Text>}
      {!!subtitulo && <Text style={styles.subtitulo}>{subtitulo}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  normal: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    elevation: 2,
  },
  verde: {
    backgroundColor: '#3b9f46',
  },
  amarilla: {
    backgroundColor: '#eab308',
  },
  alerta: {
    backgroundColor: '#eefbf2',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  alertaNegativa: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  tituloClaro: {
    color: '#ffffff',
  },
  subtitulo: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
});
