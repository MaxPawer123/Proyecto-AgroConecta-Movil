import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthLocal } from '../hooks/useAuthLocal';

type FormRegistro = {
  nombre: string;
  apellido: string;
  telefono: string;
  departamento: string;
  municipio: string;
  comunidad: string;
};

type UbicacionData = {
  label: string;
  municipios: Record<string, { label: string; comunidades: string[] }>;
};

const normalizarClave = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');

const crearMunicipios = (
  labels: string[],
  comunidadesPorMunicipio: Record<string, string[]> = {}
) => {
  const data: Record<string, { label: string; comunidades: string[] }> = {};

  labels.forEach((label) => {
    data[normalizarClave(label)] = {
      label,
      comunidades: comunidadesPorMunicipio[label] ?? [],
    };
  });

  return data;
};

const UBICACIONES: Record<string, UbicacionData> = {
  LaPaz: {
    label: 'La Paz',
    municipios: crearMunicipios(
      [
        'La Paz',
        'El Alto',
        'Achocalla',
        'Viacha',
        'Laja',
        'Pucarani',
        'Sica Sica',
        'Patacamaya',
        'Coroico',
        'Coro Coro',
        'Achacachi',
        'Copacabana',
        'Sorata',
        'Palca',
        'Mecapaca',
        'Chulumani',
        'Irupana',
        'Calamarca',
        'Colquencha',
        'Umala',
        'Ayo Ayo',
        'Collana',
      ],
      {
        'Sica Sica': ['Milla Milla', 'Lahuachaca', 'Taruca', 'Imilla Imilla'],
        'Patacamaya': ['Calacoto', 'Umala', 'Ayo Ayo', 'Viscachani'],
        'Viacha': ['Jalsuri', 'Contorno'],
        'Coroico': ['Cruz Loma', 'Yolosa', 'Mururata', 'Suapi'],
        'Achacachi': ['Santiago de Huata', 'Huarina', 'Ancoraimes'],
      }
    ),
  },
  Oruro: {
    label: 'Oruro',
    municipios: crearMunicipios(
      [
        'Oruro',
        'Caracollo',
        'Paria',
        'Huanuni',
        'Poopo',
        'Machacamarca',
        'Challapata',
        'Pampa Aullagas',
        'Salinas de Garci Mendoza',
        'Huari',
        'Curahuara de Carangas',
        'Turco',
        'Sabaya',
        'Toledo',
      ],
      {
        'Challapata': ['Tolapalca', 'Aguas Calientes', 'Ancacato'],
        'Huanuni': ['Bombo', 'Morococala', 'Venta y Media'],
        'Salinas de Garci Mendoza': ['Jirira', 'Tahua', 'Alcaya'],
      }
    ),
  },
  Cochabamba: {
    label: 'Cochabamba',
    municipios: crearMunicipios(
      [
        'Cochabamba',
        'Sacaba',
        'Quillacollo',
        'Tiquipaya',
        'Colcapirhua',
        'Vinto',
        'Sipe Sipe',
        'Cliza',
        'Punata',
        'San Benito',
        'Arani',
        'Tarata',
        'Tolata',
        'Arbieto',
        'Capinota',
        'Santivañez',
        'Mizque',
        'Aiquile',
        'Totora',
      ],
      {
        'Cliza': ['Ucureña', 'Chullpas', 'Queraya'],
        'Punata': ['San Benito', 'Villa Rivero', 'Arani'],
        'Tiquipaya': ['Apote', 'Linde', 'Cuatro Esquinas'],
      }
    ),
  },
  Potosi: {
    label: 'Potosí',
    municipios: crearMunicipios(
      [
        'Potosí',
        'Uyuni',
        'Tupiza',
        'Villazón',
        'Cotagaita',
        'Colcha K',
        'Tomave',
        'Porco',
        'Yocalla',
        'Betanzos',
        'Llallagua',
        'Uncía',
      ],
      {
        'Uyuni': ['Colchani', 'Pulacayo', 'Coroma', 'Chita'],
        'Tupiza': ['Palquiza', 'Suipacha', 'Peña Blanca'],
        'Villazón': ['Mojo', 'Moraya', 'Casira', 'Yura'],
      }
    ),
  },
  Chuquisaca: {
    label: 'Chuquisaca',
    municipios: crearMunicipios(
      [
        'Sucre',
        'Yotala',
        'Poroma',
        'Tarabuco',
        'Yamparáez',
        'Zudáñez',
        'Monteagudo',
        'Padilla',
        'Camargo',
        'Culpina',
        'Villa Abecia',
        'Incahuasi',
      ],
      {
        'Sucre': ['Potolo', 'Maragua', 'Quila Quila', 'Chaunaca'],
        'Tarabuco': ['Candelaria', 'Pisili', "Morado K'asa"],
        'Camargo': ['Villa Abecia', 'Las Carreras', 'Tacaquira'],
      }
    ),
  },
  Tarija: {
    label: 'Tarija',
    municipios: crearMunicipios(
      [
        'Tarija',
        'San Lorenzo',
        'Uriondo',
        'Padcaya',
        'Bermejo',
        'Yacuiba',
        'Caraparí',
        'Villamontes',
        'Entre Ríos',
        'El Puente',
      ],
      {
        'Uriondo': ['Calamuchita', 'Valle de Concepción', 'Muturayo', 'Juntas'],
        'San Lorenzo': ['Tomatitas', 'Sella', 'Canasmoro', 'Coimata'],
        'Padcaya': ['Chaguaya', 'Rosillas', 'Mecoya'],
      }
    ),
  },
  SantaCruz: {
    label: 'Santa Cruz',
    municipios: crearMunicipios(
      [
        'Santa Cruz de la Sierra',
        'Cotoca',
        'Warnes',
        'Montero',
        'Portachuelo',
        'Mineros',
        'La Guardia',
        'El Torno',
        'Samaipata',
        'Mairana',
        'Vallegrande',
        'Camiri',
        'Charagua',
        'Puerto Suárez',
        'Roboré',
        'San José de Chiquitos',
        'Yapacaní',
        'San Julián',
      ],
      {
        'Samaipata': ['Achira', 'Cuevas', 'Bermejo', 'Mairana'],
        'Montero': ['Guabirá', 'Muyurina', 'Naicó'],
        'El Torno': ['Limoncito', 'Jorochito', 'Tarumá'],
      }
    ),
  },
  Beni: {
    label: 'Beni',
    municipios: crearMunicipios(
      [
        'Trinidad',
        'San Javier',
        'Loreto',
        'San Andrés',
        'Riberalta',
        'Guayaramerín',
        'Rurrenabaque',
        'San Borja',
        'Reyes',
        'Santa Ana del Yacuma',
        'Exaltación',
        'Magdalena',
      ],
      {
        'Trinidad': ['Casarabe', 'Loma Suárez', 'Puerto Almacén', 'Puerto Ballivián'],
        'San Borja': ['Yucumo', 'Galilea', 'San Antonio'],
        'Rurrenabaque': ['Villa Alcira', 'Carmen del Emero', 'El Real'],
      }
    ),
  },
  Pando: {
    label: 'Pando',
    municipios: crearMunicipios(
      [
        'Cobija',
        'Porvenir',
        'Bella Flor',
        'Bolpebra',
        'Puerto Rico',
        'Filadelfia',
        'Santos Mercado',
        'San Pedro',
        'Nueva Esperanza',
        'El Sena',
        'Ingavi',
      ],
      {
        'Cobija': ['Villa Busch', 'Bajo Virtudes', 'Bella Vista'],
        'Porvenir': ['Cachuelita', 'San Luis', 'Mukden'],
        'Puerto Rico': ['Conquista', 'El Carmen', 'Santa Victoria'],
      }
    ),
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
  const sinOpciones = options.length === 0;

  return (
    <View style={styles.campoContainer}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.selectorInput, disabled || sinOpciones ? styles.selectorInputDisabled : null]}
        onPress={() => {
          if (!disabled && !sinOpciones) setVisible(true);
        }}
        activeOpacity={0.9}
        disabled={disabled || sinOpciones}
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
                  {value === option ? <Ionicons name="checkmark" size={18} color="#2BA14A" /> : null}
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
};

type PasoWizard = 1 | 2 | 3;

export function RegistroScreen() {
  const router = useRouter();
  const { registrarProductor } = useAuthLocal();
  const [form, setForm] = useState<FormRegistro>(formInicial);
  const [pasoActual, setPasoActual] = useState<PasoWizard>(1);
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

  const comunidadesDepartamento = useMemo<string[]>(() => {
    if (!claveDepartamento) return [];

    const unicas = new Set<string>();
    Object.values(UBICACIONES[claveDepartamento].municipios).forEach((municipioData) => {
      municipioData.comunidades.forEach((comunidad) => {
        unicas.add(comunidad);
      });
    });

    return Array.from(unicas);
  }, [claveDepartamento]);

  const sugerenciasComunidad = useMemo<string[]>(() => {
    const base = comunidades.length > 0 ? comunidades : comunidadesDepartamento;
    if (base.length === 0) return [];

    const filtro = form.comunidad.trim().toLowerCase();
    if (!filtro) return base.slice(0, 8);

    return base
      .filter((item) => item.toLowerCase().includes(filtro))
      .slice(0, 8);
  }, [comunidades, comunidadesDepartamento, form.comunidad]);

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

  const validarPaso1 = (datos: FormRegistro): string | null => {
    if (!datos.nombre.trim()) return 'Ingresa tus nombres.';
    if (!datos.apellido.trim()) return 'Ingresa tus apellidos.';
    if (!/^[\d]{7,10}$/.test(datos.telefono.trim())) return 'El telefono debe tener entre 7 y 10 digitos.';
    return null;
  };

  const validarPaso2 = (datos: FormRegistro): string | null => {
    if (!datos.departamento) return 'Selecciona un departamento.';
    if (!datos.municipio) return 'Selecciona un municipio.';
    if (!datos.comunidad.trim()) return 'Ingresa tu comunidad.';
    return null;
  };

  const irSiguiente = () => {
    const error = validarPaso1(form);
    if (error) {
      Alert.alert('Verifica tus datos', error);
      return;
    }

    setPasoActual(2);
  };

  const completarRegistro = async () => {
    const error = validarPaso2(form);
    if (error) {
      Alert.alert('Verifica tus datos', error);
      return;
    }

    if (guardando) return;

    setGuardando(true);

    try {
      await registrarProductor({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.trim(),
        departamento: form.departamento,
        municipio: form.municipio,
        comunidad: form.comunidad.trim(),
      });
      setPasoActual(3);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No fue posible completar el registro.';
      Alert.alert('Error al registrar', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const irAtras = () => {
    if (pasoActual === 2) {
      setPasoActual(1);
      return;
    }

    router.replace('/' as any);
  };

  const renderBarraProgreso = () => (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pasoActual === 1 ? 50 : 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{pasoActual === 1 ? 'Paso 1 de 2' : 'Paso 2 de 2'}</Text>
    </View>
  );

  const renderPaso1 = () => (
    <View style={styles.card}>
      <Text style={styles.title}>¡Conozcámonos!</Text>
      <Text style={styles.subtitle}>Ingresa tus datos básicos para empezar.</Text>

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

      <Text style={styles.label}>Teléfono *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 71234567"
        value={form.telefono}
        onChangeText={(valor) => actualizar('telefono', valor.replace(/\D+/g, ''))}
        keyboardType="number-pad"
        maxLength={10}
        placeholderTextColor="#98a2b3"
      />

      <TouchableOpacity style={styles.primaryButton} onPress={irSiguiente} disabled={guardando} activeOpacity={0.9}>
        <Text style={styles.primaryButtonText}>Siguiente</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPaso2 = () => (
    <View style={styles.card}>
      <Text style={styles.title}>¿De dónde eres?</Text>
      <Text style={styles.subtitle}>Ayúdanos a ubicar tu zona productiva.</Text>

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
          style={[styles.input, !claveDepartamento || !claveMunicipio ? styles.selectorInputDisabled : null]}
          placeholder="Escribe tu comunidad"
          value={form.comunidad}
          onChangeText={(valor) => actualizar('comunidad', valor)}
          placeholderTextColor="#98a2b3"
          editable={!!claveDepartamento && !!claveMunicipio}
        />

        {!!claveDepartamento && !!claveMunicipio && sugerenciasComunidad.length > 0 ? (
          <View style={styles.sugerenciasWrap}>
            <Text style={styles.sugerenciasTitulo}>Comunidades sugeridas</Text>
            {sugerenciasComunidad.map((sugerida) => (
              <TouchableOpacity
                key={sugerida}
                style={styles.sugerenciaItem}
                onPress={() => actualizar('comunidad', sugerida)}
                activeOpacity={0.85}
              >
                <Text style={styles.sugerenciaTexto}>{sugerida}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity style={[styles.secondaryButton, styles.buttonFlex]} onPress={irAtras} disabled={guardando} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>Atrás</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.buttonFlex, guardando ? styles.primaryButtonDisabled : null]}
          onPress={() => void completarRegistro()}
          disabled={guardando}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>{guardando ? 'Guardando...' : 'Completar Registro'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPaso3 = () => (
    <View style={styles.successWrap}>
      <View style={styles.successIconOuter}>
        <View style={styles.successIconInner}>
          <Ionicons name="checkmark" size={54} color="#ffffff" />
        </View>
      </View>

      <Text style={styles.successTitle}>¡Cuenta Creada Exitosamente!</Text>
      <Text style={styles.successSubtitle}>
        Tu perfil está listo. Ya puedes empezar a registrar tus lotes y calcular tus costos.
      </Text>

      <View style={styles.benefitsCard}>
        <View style={styles.benefitRow}>
          <View style={styles.benefitIcon}>
            <Ionicons name="leaf-outline" size={18} color="#2BA14A" />
          </View>
          <View style={styles.benefitTextWrap}>
            <Text style={styles.benefitTitle}>Gestiona tus Lotes</Text>
            <Text style={styles.benefitText}>Registra y organiza tus parcelas productivas.</Text>
          </View>
        </View>

        <View style={styles.benefitRow}>
          <View style={styles.benefitIcon}>
            <Ionicons name="calculator-outline" size={18} color="#2BA14A" />
          </View>
          <View style={styles.benefitTextWrap}>
            <Text style={styles.benefitTitle}>Calcula tus Costos</Text>
            <Text style={styles.benefitText}>Controla cada gasto de producción.</Text>
          </View>
        </View>

        <View style={styles.benefitRow}>
          <View style={styles.benefitIcon}>
            <Ionicons name="bar-chart-outline" size={18} color="#2BA14A" />
          </View>
          <View style={styles.benefitTextWrap}>
            <Text style={styles.benefitTitle}>Genera Reportes</Text>
            <Text style={styles.benefitText}>Crea PDFs profesionales para el banco.</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.9}>
        <Text style={styles.primaryButtonText}>Ir a mi panel</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backBtn} onPress={irAtras} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={18} color="#2BA14A" />
            <Text style={styles.backText}>{pasoActual === 1 ? 'Volver' : 'Atrás'}</Text>
          </TouchableOpacity>

          {pasoActual < 3 ? renderBarraProgreso() : null}
          {pasoActual === 1 ? renderPaso1() : null}
          {pasoActual === 2 ? renderPaso2() : null}
          {pasoActual === 3 ? renderPaso3() : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 28,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 12,
  },
  backText: {
    marginLeft: 6,
    color: '#29425E',
    fontSize: 14,
    fontWeight: '600',
  },
  progressWrap: {
    marginBottom: 18,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E4E7EC',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2BA14A',
  },
  progressText: {
    marginTop: 8,
    alignSelf: 'flex-end',
    color: '#29425E',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  title: {
    color: '#0F2342',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#122644',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFD8E3',
    backgroundColor: '#FBFCFD',
    paddingHorizontal: 14,
    color: '#122644',
    fontSize: 15,
    marginBottom: 12,
  },
  campoContainer: {
    marginBottom: 12,
  },
  selectorInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFD8E3',
    backgroundColor: '#FBFCFD',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectorInputDisabled: {
    opacity: 0.55,
  },
  selectorPlaceholder: {
    color: '#9AA4B2',
    fontSize: 15,
  },
  selectorValor: {
    color: '#122644',
    fontSize: 15,
    fontWeight: '500',
  },
  sugerenciasWrap: {
    marginTop: -2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },
  sugerenciasTitulo: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  sugerenciaItem: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sugerenciaTexto: {
    color: '#122644',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    maxHeight: '70%',
  },
  modalTitulo: {
    color: '#0F2342',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalLista: {
    marginBottom: 12,
  },
  modalOpcion: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOpcionTexto: {
    color: '#122644',
    fontSize: 15,
    flex: 1,
    paddingRight: 12,
  },
  modalCerrarBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#2BA14A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCerrarTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonFlex: {
    flex: 1,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 161, 74, 0.08)',
    marginRight: 12,
  },
  secondaryButtonText: {
    color: '#2BA14A',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2BA14A',
    shadowColor: '#2BA14A',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  successWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  successIconOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(43, 161, 74, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successIconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2BA14A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    color: '#0F2342',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 22,
  },
  benefitsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(43, 161, 74, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    color: '#0F2342',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitText: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 19,
  },
});
