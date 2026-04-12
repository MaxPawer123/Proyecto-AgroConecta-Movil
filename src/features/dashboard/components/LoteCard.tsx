import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LoteCardProps {
  nombre: string;
  variedad: string;
  estado: string;
  area: number;
  onPress?: () => void;
}

const shadowCard: ViewStyle = {
  shadowColor: '#000000',
  shadowOpacity: 0.06,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 8,
  elevation: 2,
};

function getEstadoColor(estado: string): string {
  const estadoLower = estado.toLowerCase();
  
  if (estadoLower.includes('crecimiento') || estadoLower.includes('siembra')) {
    return '#2BA14A'; // Verde para siembra y crecimiento
  } else if (estadoLower.includes('cosecha')) {
    return '#D97706'; // Naranja para cosecha
  } else if (estadoLower.includes('vendido') || estadoLower.includes('cierre')) {
    return '#1E40AF'; // Azul para vendido
  } else if (estadoLower.includes('activo')) {
    return '#2BA14A'; // Verde para activo
  }
  
  return '#64748B'; // Gris por defecto
}

export function LoteCard({ nombre, variedad, estado, area, onPress }: LoteCardProps) {
  const estadoColor = getEstadoColor(estado);
  
  return (
    <TouchableOpacity
      style={[styles.card, shadowCard]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.headerRow}>
        <View style={styles.nameContainer}>
          <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
          <Text style={styles.variedad} numberOfLines={1}>{variedad}</Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: estadoColor }]} />
          <Text style={styles.estadoText} numberOfLines={1}>{estado}</Text>
        </View>

        <Text style={styles.areaText}>{area.toFixed(2)} ha</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 200,
    justifyContent: 'space-between',
    ...shadowCard,
  },
  headerRow: {
    marginBottom: 10,
  },
  nameContainer: {
    flex: 1,
  },
  nombre: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  variedad: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  estadoText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  areaText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
  },
});
