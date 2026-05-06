import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePerfil } from '../hooks/usePerfil';
import { UBICACIONES } from '@/src/features/auth/screens/RegistroScreen';

const SelectorCampo = ({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}) => {
  const [visible, setVisible] = React.useState(false);
  const sinOpciones = options.length === 0;

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.selectorInput, disabled || sinOpciones ? styles.selectorInputDisabled : null]}
        onPress={() => {
          if (!disabled && !sinOpciones) setVisible(true);
        }}
        activeOpacity={0.9}
        disabled={disabled || sinOpciones}
      >
        <Text style={value ? styles.selectorValue : styles.selectorPlaceholder}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color="#64748b" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.modalOption}
                  onPress={() => {
                    onSelect(option);
                    setVisible(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{option}</Text>
                  {value === option ? <Ionicons name="checkmark" size={18} color="#2BA14A" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setVisible(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const normalizarClave = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');

const departamentosDisponibles = Object.values(UBICACIONES).map((item) => item.label);

const obtenerClaveDepartamento = (valor: string) =>
  Object.entries(UBICACIONES).find(([, item]) => item.label === valor)?.[0] ?? null;

const obtenerClaveMunicipio = (claveDepartamento: string | null, valor: string) => {
  if (!claveDepartamento) return null;
  return (
    Object.entries(UBICACIONES[claveDepartamento].municipios).find(([, item]) => item.label === valor)?.[0] ?? null
  );
};

export function EditarPerfilScreen() {
  const router = useRouter();
  const { perfil, perfilEdicion, setPerfilEdicion, guardandoPerfil, guardarPerfilLocal } = usePerfil();

  const claveDepartamento = React.useMemo(() => obtenerClaveDepartamento(perfilEdicion.departamento), [perfilEdicion.departamento]);
  const municipios = React.useMemo(() => {
    if (!claveDepartamento) return [];
    return Object.values(UBICACIONES[claveDepartamento].municipios).map((item) => item.label);
  }, [claveDepartamento]);
  const claveMunicipio = React.useMemo(
    () => obtenerClaveMunicipio(claveDepartamento, perfilEdicion.municipio),
    [claveDepartamento, perfilEdicion.municipio]
  );
  const comunidades = React.useMemo(() => {
    if (!claveDepartamento || !claveMunicipio) return [];
    return UBICACIONES[claveDepartamento].municipios[claveMunicipio].comunidades;
  }, [claveDepartamento, claveMunicipio]);

  const sugerenciasComunidad = React.useMemo(() => {
    const base = comunidades.length > 0 ? comunidades : claveDepartamento ? Object.values(UBICACIONES[claveDepartamento].municipios).flatMap((item) => item.comunidades) : [];
    const filtro = perfilEdicion.comunidad.trim().toLowerCase();
    if (!filtro) return base.slice(0, 8);
    return base.filter((item) => item.toLowerCase().includes(filtro)).slice(0, 8);
  }, [claveDepartamento, comunidades, perfilEdicion.comunidad]);

  const cambiarDepartamento = (departamento: string) => {
    setPerfilEdicion((actual) => ({
      ...actual,
      departamento,
      municipio: '',
      comunidad: '',
    }));
  };

  const cambiarMunicipio = (municipio: string) => {
    setPerfilEdicion((actual) => ({
      ...actual,
      municipio,
      comunidad: '',
    }));
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <View style={styles.heroTopRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
                  <Ionicons name="arrow-back" size={18} color="#14532d" />
                </TouchableOpacity>
              </View>

              <View style={styles.heroMain}>
                <View style={styles.avatarWrap}>
                  <Ionicons name="person-circle-outline" size={42} color="#ffffff" />
                </View>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.title}>Editar perfil</Text>
                  <Text style={styles.subtitle}>Actualiza tus datos guardados en este dispositivo.</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Identidad</Text>

              <View style={styles.row}>
                <View style={[styles.fieldWrap, styles.fieldHalf]}>
                  <Text style={styles.label}>Nombre</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre"
                    value={perfilEdicion.nombre}
                    onChangeText={(text) => setPerfilEdicion({ ...perfilEdicion, nombre: text })}
                  />
                </View>
                <View style={[styles.fieldWrap, styles.fieldHalf]}>
                  <Text style={styles.label}>Apellido</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Apellido"
                    value={perfilEdicion.apellido}
                    onChangeText={(text) => setPerfilEdicion({ ...perfilEdicion, apellido: text })}
                  />
                </View>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Número de contacto"
                  keyboardType="phone-pad"
                  value={perfilEdicion.telefono}
                  onChangeText={(text) => setPerfilEdicion({ ...perfilEdicion, telefono: text })}
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ubicación</Text>

              <SelectorCampo
                label="Departamento"
                value={perfilEdicion.departamento}
                placeholder="Selecciona tu departamento"
                options={departamentosDisponibles}
                onSelect={cambiarDepartamento}
              />

              <View style={styles.row}>
                <View style={[styles.fieldWrap, styles.fieldHalf]}>
                  <SelectorCampo
                    label="Municipio"
                    value={perfilEdicion.municipio}
                    placeholder="Selecciona tu municipio"
                    options={municipios}
                    onSelect={cambiarMunicipio}
                    disabled={!claveDepartamento}
                  />
                </View>
                <View style={[styles.fieldWrap, styles.fieldHalf]}>
                  <Text style={styles.label}>Comunidad</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Comunidad"
                    value={perfilEdicion.comunidad}
                    onChangeText={(text) => setPerfilEdicion({ ...perfilEdicion, comunidad: text })}
                  />
                  {!!claveDepartamento && !!claveMunicipio && sugerenciasComunidad.length > 0 ? (
                    <View style={styles.sugerenciasWrap}>
                      <Text style={styles.sugerenciasTitulo}>Comunidades sugeridas</Text>
                      {sugerenciasComunidad.map((sugerida) => (
                        <TouchableOpacity
                          key={sugerida}
                          style={styles.sugerenciaItem}
                          onPress={() => setPerfilEdicion({ ...perfilEdicion, comunidad: sugerida })}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.sugerenciaTexto}>{sugerida}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
              <TouchableOpacity
              style={[styles.saveButton, guardandoPerfil && styles.saveButtonDisabled]}
              onPress={guardarPerfilLocal}
              disabled={guardandoPerfil}
              activeOpacity={0.9}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>{guardandoPerfil ? 'Guardando...' : 'Guardar cambios '}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: '#f3fbf5',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  hero: {
    backgroundColor: '#166534',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#14532d',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
  },
  localChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  localChipText: {
    color: '#f0fdf4',
    fontSize: 11,
    fontWeight: '700',
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  selectorInput: {
    borderWidth: 1,
    borderColor: '#dbe5dc',
    borderRadius: 14,
    backgroundColor: '#f8fbf8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 15,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorInputDisabled: {
    backgroundColor: '#f1f5f1',
    opacity: 0.7,
  },
  selectorValue: {
    color: '#0f172a',
    fontSize: 15,
    flex: 1,
    paddingRight: 10,
  },
  selectorPlaceholder: {
    color: '#94a3b8',
    fontSize: 15,
    flex: 1,
    paddingRight: 10,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dbe5dc',
    borderRadius: 14,
    backgroundColor: '#f8fbf8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 15,
  },
  sugerenciasWrap: {
    marginTop: 8,
    gap: 8,
  },
  sugerenciasTitulo: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  sugerenciaItem: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sugerenciaTexto: {
    color: '#14532d',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    maxHeight: '76%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalList: {
    marginBottom: 10,
  },
  modalOption: {
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
    paddingRight: 10,
  },
  modalCloseButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 15,
  },
  previewCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 4,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  previewText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  previewHint: {
    marginTop: 6,
    fontSize: 11,
    color: '#166534',
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#2BA14A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2BA14A',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
