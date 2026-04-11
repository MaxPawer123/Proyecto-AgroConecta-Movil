import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../screens/PerfilScreen.styles';

type PerfilInfoRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

export function PerfilInfoRow({ icon, label, value }: PerfilInfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color="#38a837" />
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}
