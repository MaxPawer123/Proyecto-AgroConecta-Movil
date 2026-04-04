import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { guardarRegistroPinDraft } from '../utils/registroPinDraft';

type FormRegistro = {
  nombre: string;
  apellido: string;
  telefono: string;
  departamento: string;
  municipio: string;
  comunidad: string;
  pin: string;
  pinConfirmacion: string;
};

type UbicacionData = {
  label: string;
  municipios: Record<string, { label: string; comunidades: string[] }>;
};

const UBICACIONES: Record<string, UbicacionData> = {
  LaPaz: {
    label: 'La Paz',
    municipios: {
      SicaSica: {
        label: 'Sica Sica',
        comunidades: ['Tarija', 'Ayo Ayo', 'Malla', 'Calacoto'],
      },
      Viacha: {
        label: 'Viacha',
        comunidades: ['Chonchocoro', 'Jalsuri', 'Contorno'],
      },
      Coroico: {
        label: 'Coroico',
        comunidades: ['Cruz Loma', 'Yolosa', 'Mururata', 'Suapi'],
      },
    },
  },
  Oruro: {
    label: 'Oruro',
    municipios: {
      Challapata: {
        label: 'Challapata',
        comunidades: ['Tolapalca', 'Aguas Calientes', 'Ancacato'],
      },
      Huanuni: {
        label: 'Huanuni',
        comunidades: ['Bombo', 'Morococala', 'Venta y Media'],
      },
      SalinasDeGarciMendoza: {
        label: 'Salinas de Garci Mendoza',
        comunidades: ['Jirira', 'Tahua', 'Alcaya'],
      },
    },
  },
  Cochabamba: {
    label: 'Cochabamba',
    municipios: {
      Cliza: {
        label: 'Cliza',
        comunidades: ['Ucureña', 'Chullpas', 'Queraya'],
      },
      Punata: {
        label: 'Punata',
        comunidades: ['San Benito', 'Villa Rivero', 'Arani'],
      },
      Tiquipaya: {
        label: 'Tiquipaya',
        comunidades: ['Apote', 'Linde', 'Cuatro Esquinas'],
      },
    },
  },
  Potosi: {
    label: 'Potosí',
    municipios: {
      Uyuni: {
        label: 'Uyuni',
        comunidades: ['Colchani', 'Pulacayo', 'Coroma', 'Chita'],
      },
      Tupiza: {
        label: 'Tupiza',
        comunidades: ['Palquiza', 'Suipacha', 'Peña Blanca'],
      },
      Villazon: {
        label: 'Villazón',
        comunidades: ['Mojo', 'Moraya', 'Casira', 'Yura'],
      },
    },
  },
  Chuquisaca: {
    label: 'Chuquisaca',
    municipios: {
      Sucre: {
        label: 'Sucre',
        comunidades: ['Potolo', 'Maragua', 'Quila Quila', 'Chaunaca'],
      },
      Tarabuco: {
        label: 'Tarabuco',
        comunidades: ['Candelaria', 'Pisili', 'Morado K\'asa'],
      },
      Camargo: {
        label: 'Camargo',
        comunidades: ['Villa Abecia', 'Las Carreras', 'Tacaquira'],
      },
    },
  },
  Tarija: {
    label: 'Tarija',
    municipios: {
      Uriondo: {
        label: 'Uriondo',
        comunidades: ['Calamuchita', 'Valle de Concepción', 'Muturayo', 'Juntas'],
      },
      SanLorenzo: {
        label: 'San Lorenzo',
        comunidades: ['Tomatitas', 'Sella', 'Canasmoro', 'Coimata'],
      },
      Padcaya: {
        label: 'Padcaya',
        comunidades: ['Chaguaya', 'Rosillas', 'Mecoya'],
      },
    },
  },
  SantaCruz: {
    label: 'Santa Cruz',
    municipios: {
      Samaipata: {
        label: 'Samaipata',
        comunidades: ['Achira', 'Cuevas', 'Bermejo', 'Mairana'],
      },
      Montero: {
        label: 'Montero',
        comunidades: ['Guabirá', 'Muyurina', 'Naicó'],
      },
      ElTorno: {
        label: 'El Torno',
        comunidades: ['Limoncito', 'Jorochito', 'Tarumá'],
      },
    },
  },
  Beni: {
    label: 'Beni',
    municipios: {
      Trinidad: {
        label: 'Trinidad',
        comunidades: ['Casarabe', 'Loma Suárez', 'Puerto Almacén', 'Puerto Ballivián'],
      },
      SanBorja: {
        label: 'San Borja',
        comunidades: ['Yucumo', 'Galilea', 'San Antonio'],
      },
      Rurrenabaque: {
        label: 'Rurrenabaque',
        comunidades: ['Villa Alcira', 'Carmen del Emero', 'El Real'],
      },
    },
  },
  Pando: {
    label: 'Pando',
    municipios: {
      Cobija: {
        label: 'Cobija',
        comunidades: ['Villa Busch', 'Bajo Virtudes', 'Bella Vista'],
      },
      Porvenir: {
        label: 'Porvenir',
        comunidades: ['Cachuelita', 'San Luis', 'Mukden'],
      },
      PuertoRico: {
        label: 'Puerto Rico',
        comunidades: ['Conquista', 'El Carmen', 'Santa Victoria'],
      },
    },
  },
};

type SelectorProps = {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
};

function SelectorCampo({ label, value, placeholder, options, onSelect, disabled }: SelectorProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.campoContainer}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.selectorInput, disabled ? styles.selectorInputDisabled : null]}
        onPress={() => {
          if (!disabled) setVisible(true);
        }}
        activeOpacity={0.9}
      >
        <Text style={value ? styles.selectorValor : styles.selectorPlaceholder}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>{label}</Text>

            <ScrollView style={styles.modalLista}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.modalOpcion}
                  onPress={() => {
                    onSelect(option);
                    setVisible(false);
                  }}
                >
                  <Text style={styles.modalOpcionTexto}>{option}</Text>
                  {value === option ? <Ionicons name="checkmark" size={18} color="#39a935" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalCerrarBtn} onPress={() => setVisible(false)}>
              <Text style={styles.modalCerrarTexto}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const formInicial: FormRegistro = {
  nombre: '',
  apellido: '',
  telefono: '',
  departamento: '',
  municipio: '',
  comunidad: '',
  pin: '',
  pinConfirmacion: '',
};

export function RegistroScreen() {
  const router = useRouter();
  const [form, setForm] = useState<FormRegistro>(formInicial);
  const [guardando, setGuardando] = useState(false);

  const departamentos = useMemo(() => Object.values(UBICACIONES).map((item) => item.label), []);

  const claveDepartamento = useMemo<string | null>(() => {
    const entrada = Object.entries(UBICACIONES).find(([, valor]) => valor.label === form.departamento);
    return entrada?.[0] ?? null;
  }, [form.departamento]);

  const municipios = useMemo(() => {
    if (!claveDepartamento) return [];
    return Object.values(UBICACIONES[claveDepartamento].municipios).map((item) => item.label);
  }, [claveDepartamento]);

  const claveMunicipio = useMemo<string | null>(() => {
    if (!claveDepartamento) return null;

    const entrada = Object.entries(UBICACIONES[claveDepartamento].municipios).find(([, valor]) => valor.label === form.municipio);
    return entrada?.[0] ?? null;
  }, [claveDepartamento, form.municipio]);

  const comunidades = useMemo<string[]>(() => {
    if (!claveDepartamento || !claveMunicipio) return [];
    return UBICACIONES[claveDepartamento].municipios[claveMunicipio].comunidades;
  }, [claveDepartamento, claveMunicipio]);

  const actualizar = (campo: keyof FormRegistro, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const cambiarDepartamento = (departamento: string) => {
    setForm((prev) => ({
      ...prev,
      departamento,
      municipio: '',
      comunidad: '',
    }));
  };

  const cambiarMunicipio = (municipio: string) => {
    setForm((prev) => ({
      ...prev,
      municipio,
      comunidad: '',
    }));
  };

  const validar = (datos: FormRegistro): string | null => {
    if (!datos.nombre.trim()) return 'Ingresa tus nombres.';
    if (!datos.apellido.trim()) return 'Ingresa tus apellidos.';
    if (!/^\d{7,10}$/.test(datos.telefono.trim())) return 'El telefono debe tener entre 7 y 10 digitos.';
    if (!datos.departamento) return 'Selecciona un departamento.';
    if (!datos.municipio) return 'Selecciona un municipio.';
    if (!datos.comunidad.trim()) return 'Selecciona o ingresa una comunidad.';
    return null;
  };

  const irCreacionPin = () => {
    const error = validar(form);
    if (error) {
      Alert.alert('Verifica tus datos', error);
      return;
    }

    guardarRegistroPinDraft({
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      telefono: form.telefono.trim(),
      departamento: form.departamento,
      municipio: form.municipio,
      comunidad: form.comunidad.trim(),
    });

    router.push('/auth/creacion-pin' as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/' as any)}>
            <Ionicons name="arrow-back" size={18} color="#38a933" />
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>

          <Text style={styles.brand}>Yapu Aroma</Text>
          <Text style={styles.title}>Crea tu perfil de Productor</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Nombres *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Juan Carlos"
              value={form.nombre}
              onChangeText={(valor) => actualizar('nombre', valor)}
              placeholderTextColor="#98a2b3"
            />

            <Text style={styles.label}>Apellidos *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Mamani Quispe"
              value={form.apellido}
              onChangeText={(valor) => actualizar('apellido', valor)}
              placeholderTextColor="#98a2b3"
            />

            <Text style={styles.label}>Telefono *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 71234567"
              value={form.telefono}
              onChangeText={(valor) => actualizar('telefono', valor.replace(/\D+/g, ''))}
              keyboardType="number-pad"
              maxLength={10}
              placeholderTextColor="#98a2b3"
            />
          </View>

          <View style={styles.card}>
            <SelectorCampo
              label="Departamento *"
              value={form.departamento}
              placeholder="Selecciona tu departamento"
              options={departamentos}
              onSelect={cambiarDepartamento}
            />

            <SelectorCampo
              label="Municipio *"
              value={form.municipio}
              placeholder="Selecciona tu municipio"
              options={municipios}
              onSelect={cambiarMunicipio}
              disabled={!claveDepartamento}
            />

            <View style={styles.campoContainer}>
              <Text style={styles.label}>Comunidad *</Text>
              <TextInput
                style={styles.input}
                placeholder={comunidades.length ? 'Selecciona o escribe tu comunidad' : 'Primero selecciona departamento y municipio'}
                value={form.comunidad}
                onChangeText={(valor) => actualizar('comunidad', valor)}
                placeholderTextColor="#98a2b3"
              />

              {comunidades.length ? (
                <View style={styles.tagsContainer}>
                  {comunidades.map((item) => (
                    <TouchableOpacity key={item} style={styles.tag} onPress={() => actualizar('comunidad', item)}>
                      <Text style={styles.tagText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity style={[styles.submitBtn, guardando ? styles.submitBtnDisabled : null]} onPress={() => void irCreacionPin()} disabled={guardando}>
            <Text style={styles.submitBtnText}>Continuar con PIN</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef2f7',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  backText: {
    marginLeft: 6,
    color: '#38a933',
    fontSize: 14,
    fontWeight: '500',
  },
  brand: {
    color: '#39a935',
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 4,
  },
  title: {
    color: '#0f2342',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#dfe4ec',
  },
  campoContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#122644',
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c3ccd8',
    backgroundColor: '#f9fbfd',
    paddingHorizontal: 12,
    color: '#122644',
    fontSize: 14,
    marginBottom: 12,
  },
  selectorInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c3ccd8',
    backgroundColor: '#f9fbfd',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorInputDisabled: {
    opacity: 0.6,
  },
  selectorPlaceholder: {
    fontSize: 14,
    color: '#98a2b3',
  },
  selectorValor: {
    fontSize: 14,
    color: '#122644',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    rowGap: 8,
    columnGap: 8,
  },
  tag: {
    backgroundColor: '#eaf6ea',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#cae8ca',
  },
  tagText: {
    color: '#277a24',
    fontSize: 12,
    fontWeight: '500',
  },
  submitBtn: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#39a935',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitulo: {
    color: '#122644',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalLista: {
    maxHeight: 280,
  },
  modalOpcion: {
    minHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOpcionTexto: {
    color: '#122644',
    fontSize: 14,
  },
  modalCerrarBtn: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#39a935',
  },
  modalCerrarTexto: {
    color: '#39a935',
    fontSize: 14,
    fontWeight: '600',
  },
});
