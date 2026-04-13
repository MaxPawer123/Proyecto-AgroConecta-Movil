import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ResumenCardProps {
  costoTotal: number;
  costosLocales?: number;
  costosSubidos?: number;
  cantidadLotes: number;
  onPress?: () => void;
}

const shadowCard: ViewStyle = {
  shadowColor: '#000000',
  shadowOpacity: 0.12,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 12,
  elevation: 5,
};

export function ResumenCard({ costoTotal, costosLocales, costosSubidos, cantidadLotes, onPress }: ResumenCardProps) {
  const mostrarDesglose = costosLocales !== undefined && costosSubidos !== undefined;

  return (
    <TouchableOpacity
      style={[styles.card, shadowCard]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={styles.contentContainer}>
        <View style={styles.textSection}>
          <Text style={styles.title}>Costos Totales de Producción</Text>
          <View style={styles.costContainer}>
            <Text style={styles.costValue}>Bs. {costoTotal.toLocaleString('es-BO')}</Text>
          </View>
          
          {mostrarDesglose && (
            <View style={styles.desglose}>
              <Text style={styles.desgloseText}>📱 Locales: Bs. {costosLocales!.toLocaleString('es-BO')}</Text>
              <Text style={styles.desgloseText}>☁️ Subidos: Bs. {costosSubidos!.toLocaleString('es-BO')}</Text>
            </View>
          )}
          
          <Text style={styles.subtitle}>{cantidadLotes} {cantidadLotes === 1 ? 'parcela' : 'parcelas'} registrados</Text>
        </View>

        <View style={styles.arrowButton}>
          <Ionicons name="arrow-forward-circle" size={32} color="#FFFFFF" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2BA14A',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 24,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textSection: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.95,
    marginBottom: 8,
  },
  costContainer: {
    marginVertical: 8,
  },
  costValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 44,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
    marginTop: 4,
  },
  desglose: {
    marginVertical: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  desgloseText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginVertical: 2,
    opacity: 0.85,
  },
  arrowButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
