import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { insertarLoteLocal } from '@/src/services/database';

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  NuevaSiembra: undefined;
};

type NuevaSiembraScreenProps = NativeStackScreenProps<RootStackParamList, 'NuevaSiembra'>;

type Rubro = {
  id_producto: number;
  label: string;
};

type FormNuevaSiembra = {
  id_producto: number;
  nombre_lote: string;
  superficie: string;
  fecha_siembra: string;
  fecha_cosecha_est: string;
  rendimiento_estimado: string;
  precio_venta_est: string;
};

const RUBROS: Rubro[] = [
  { id_producto: 1, label: 'Quinua' },
  { id_producto: 2, label: 'Papa' },
];

export default function NuevaSiembraScreen({ navigation }: NuevaSiembraScreenProps) {
  const [form, setForm] = useState<FormNuevaSiembra>({
    id_producto: 1,
    nombre_lote: '',
    superficie: '',
    fecha_siembra: '',
    fecha_cosecha_est: '',
    rendimiento_estimado: '',
    precio_venta_est: '',
  });
  const [guardando, setGuardando] = useState(false);

  const actualizarCampo = <K extends keyof FormNuevaSiembra>(campo: K, valor: FormNuevaSiembra[K]) => {
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  };

  const guardarLote = async () => {
    try {
      setGuardando(true);

      const datos = {
        id_producto: form.id_producto,
        nombre_lote: form.nombre_lote.trim(),
        superficie: form.superficie === '' ? null : Number(form.superficie),
        fecha_siembra: form.fecha_siembra.trim(),
        fecha_cosecha_est: form.fecha_cosecha_est.trim(),
        rendimiento_estimado:
          form.rendimiento_estimado === '' ? null : Number(form.rendimiento_estimado),
        precio_venta_est: form.precio_venta_est === '' ? null : Number(form.precio_venta_est),
      };

      await insertarLoteLocal(datos);

      Alert.alert('Exito', 'Lote guardado correctamente en el celular');
      navigation.goBack();
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo guardar el lote localmente';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Nueva Siembra</Text>
        <Text style={styles.subtitle}>Registra tu cultivo en modo offline</Text>

        <Text style={styles.label}>Seleccionar Rubro</Text>
        <View style={styles.rubroRow}>
          {RUBROS.map((rubro) => {
            const seleccionado = form.id_producto === rubro.id_producto;
            return (
              <TouchableOpacity
                key={rubro.id_producto}
                style={[styles.rubroButton, seleccionado && styles.rubroButtonSelected]}
                onPress={() => actualizarCampo('id_producto', rubro.id_producto)}
                activeOpacity={0.9}
              >
                <Text style={[styles.rubroButtonText, seleccionado && styles.rubroButtonTextSelected]}>
                  {rubro.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Nombre del Lote</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. Lote Norte"
          placeholderTextColor="#9CA3AF"
          value={form.nombre_lote}
          onChangeText={(texto) => actualizarCampo('nombre_lote', texto)}
        />

        <Text style={styles.label}>Superficie (Ha)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. 2.5"
          placeholderTextColor="#9CA3AF"
          value={form.superficie}
          onChangeText={(texto) => actualizarCampo('superficie', texto)}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Fecha de Siembra</Text>
        <TextInput
          style={styles.input}
          placeholder="2025-10-15"
          placeholderTextColor="#9CA3AF"
          value={form.fecha_siembra}
          onChangeText={(texto) => actualizarCampo('fecha_siembra', texto)}
        />

        <Text style={styles.label}>Fecha Estimada de Cosecha</Text>
        <TextInput
          style={styles.input}
          placeholder="2026-04-01"
          placeholderTextColor="#9CA3AF"
          value={form.fecha_cosecha_est}
          onChangeText={(texto) => actualizarCampo('fecha_cosecha_est', texto)}
        />

        <Text style={styles.label}>Rendimiento Esperado (Kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. 800"
          placeholderTextColor="#9CA3AF"
          value={form.rendimiento_estimado}
          onChangeText={(texto) => actualizarCampo('rendimiento_estimado', texto)}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Precio de Venta Estimado (Bs/Kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. 15"
          placeholderTextColor="#9CA3AF"
          value={form.precio_venta_est}
          onChangeText={(texto) => actualizarCampo('precio_venta_est', texto)}
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[styles.saveButton, guardando && styles.saveButtonDisabled]}
          onPress={guardarLote}
          disabled={guardando}
          activeOpacity={0.9}
        >
          <Text style={styles.saveButtonText}>
            {guardando ? 'Guardando...' : 'Guardar Lote Localmente'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14,
    color: '#6B7280',
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  rubroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  rubroButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rubroButtonSelected: {
    borderColor: '#28A745',
    backgroundColor: '#EAF8ED',
  },
  rubroButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  rubroButtonTextSelected: {
    color: '#1F7A34',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#28A745',
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
