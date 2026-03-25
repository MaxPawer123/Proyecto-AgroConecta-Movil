import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import {
  iniciarSincronizacionAutomaticaSiembras,
  registrarSiembraOfflineFirst,
} from '@/src/services/siembraStorageSync';
import { obtenerProductosPorCategoriaApi } from '@/src/services/api';
import { listarProductosLocales, sincronizarProductosPendientes } from '@/src/services/offlineProductsSync';

LocaleConfig.locales.es = {
  monthNames: [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

const TIPOS_QUINUA = [
  'Quinua Real Blanca',
  'Quinua Roja Pasankalla',
  'Quinua Negra Collana',
  'Quinua Toledo',
  'Quinua Jacha Grano',
  'Quinua Pandela',
];

const COMUNIDADES = [
 'Patacamaya - Centro',
  'Sica Sica - Milla Milla',
  'Sica Sica - Imilla  Imilla',
  'Sica Sica - Taruca',
  'Patacamaya - Colchani',
  'Patacamaya - Viscachani',
  'Patacamaya - Collani',
];

const CATEGORIA_QUINUA = 'Quinua';

const formatearFecha = (fechaIso) => {
  if (!fechaIso) return '';
  const [anio, mes, dia] = fechaIso.split('-');
  if (!anio || !mes || !dia) return '';
  return `${dia}/${mes}/${anio}`;
};

const parsearFecha = (valor) => {
  if (!valor) return '';
  const partes = valor.split('/');
  if (partes.length !== 3) return '';

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const anio = Number(partes[2]);

  if (!dia || !mes || !anio) return '';
  return `${anio}-${`${mes}`.padStart(2, '0')}-${`${dia}`.padStart(2, '0')}`;
};

export default function ModalRegistrarSiembra_Quinua({ visible, onClose, onCreated }) {
  const [form, setForm] = useState({
    nombre: '',
    tipoCultivo: '',
    ubicacion: '',
    superficie: '',
    fechaSiembra: '',
    fechaCosecha: '',
  });
  const [fotoTerreno, setFotoTerreno] = useState(null);
  const [modalComunidadOpen, setModalComunidadOpen] = useState(false);
  const [modalTipoOpen, setModalTipoOpen] = useState(false);
  const [modalCalendarioOpen, setModalCalendarioOpen] = useState(false);
  const [campoFechaActivo, setCampoFechaActivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [idProductoQuinua, setIdProductoQuinua] = useState(1);

  useEffect(() => {
    iniciarSincronizacionAutomaticaSiembras();
  }, []);

  useEffect(() => {
    if (!visible) return;

    const resolverProductoQuinua = async () => {
      await sincronizarProductosPendientes().catch(() => {
        // Si no hay internet, usamos catalogo local.
      });

      const [locales, apiQuinua, apiGrano] = await Promise.all([
        listarProductosLocales(),
        obtenerProductosPorCategoriaApi('Quinua').catch(() => []),
        obtenerProductosPorCategoriaApi('Grano').catch(() => []),
      ]);

      const catalogo = [
        ...(Array.isArray(locales) ? locales : []),
        ...(Array.isArray(apiQuinua) ? apiQuinua : []),
        ...(Array.isArray(apiGrano) ? apiGrano : []),
      ];

      const encontradoPorNombre = catalogo.find((producto) =>
        String(producto.nombre ?? '').toLowerCase().includes('quinua')
      );

      const encontradoPorCategoria = catalogo.find((producto) => {
        const categoria = String(producto.categoria ?? '').toLowerCase();
        return categoria === 'quinua' || categoria === 'grano';
      });

      const candidato = encontradoPorNombre || encontradoPorCategoria;
      const id = Number(candidato?.id_producto ?? candidato?.idLocal ?? 1);
      setIdProductoQuinua(id > 0 ? id : 1);
    };

    void resolverProductoQuinua();
  }, [visible]);

  const actualizarCampo = (campo, valor) => {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const seleccionarImagen = async (origen) => {
    const permiso =
      origen === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permiso.granted) {
      Alert.alert(
        'Permiso requerido',
        origen === 'camera'
          ? 'Necesitas permitir acceso a la camara para tomar una foto.'
          : 'Necesitas permitir acceso a la galeria para elegir una imagen.'
      );
      return;
    }

    const resultado =
      origen === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          });

    if (!resultado.canceled && resultado.assets && resultado.assets.length > 0) {
      setFotoTerreno(resultado.assets[0].uri);
    }
  };

  const abrirSelectorFecha = (campo) => {
    setCampoFechaActivo(campo);
    setModalCalendarioOpen(true);
  };

  const seleccionarFecha = (dateString) => {
    if (!campoFechaActivo) return;
    actualizarCampo(campoFechaActivo, formatearFecha(dateString));
    setModalCalendarioOpen(false);
  };

  const fechaSeleccionadaISO = campoFechaActivo ? parsearFecha(form[campoFechaActivo]) : '';

  const limpiarFormulario = () => {
    setForm({
      nombre: '',
      tipoCultivo: '',
      ubicacion: '',
      superficie: '',
      fechaSiembra: '',
      fechaCosecha: '',
    });
    setFotoTerreno(null);
  };

  const crearLote = async () => {
    const nombre = form.nombre.trim();
    const superficie = Number(form.superficie);
    const fechaSiembraIso = parsearFecha(form.fechaSiembra);
    const fechaCosechaIso = parsearFecha(form.fechaCosecha);

    if (!nombre || !form.tipoCultivo || !form.ubicacion || !superficie || !fechaSiembraIso || !fechaCosechaIso) {
      Alert.alert('Datos incompletos', 'Completa nombre, tipo, ubicacion, superficie y fechas.');
      return;
    }

    setGuardando(true);

    try {
      const resultado = await registrarSiembraOfflineFirst({
        rubro: 'QUINUA',
        categoriaProducto: CATEGORIA_QUINUA,
        productoDefaultId: idProductoQuinua,
        nombreLote: nombre,
        tipoCultivo: form.tipoCultivo,
        ubicacion: form.ubicacion,
        superficie,
        fechaSiembraIso,
        fechaCosechaIso,
        rendimientoEstimado: Math.max(1, superficie * 300),
        precioVentaEstimado: 12,
        fotoTerrenoUri: fotoTerreno,
      });

      const mensaje =
        resultado.estado === 'COMPLETADO'
          ? `Lote #${resultado.idLocal} guardado y sincronizado con backend.`
          : `Lote #${resultado.idLocal} guardado en estado PENDIENTE. Se subira automaticamente cuando haya conexion con backend.`;

      Alert.alert('Listo', mensaje);
      limpiarFormulario();
      if (onCreated) {
        void onCreated();
      }
      onClose();
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo guardar la siembra';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="seed-outline" size={24} color="#2eaa51" />
              <Text style={styles.headerTitle}>Nueva Siembra / Iniciar Lote</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Nombre/Codigo del Lote</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Lote 1 - Quinua Real"
                placeholderTextColor="#9ca3af"
                value={form.nombre}
                onChangeText={(texto) => actualizarCampo('nombre', texto)}
              />
              <Text style={styles.hint}>Identificador unico para tu lote</Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Tipo de Quinua</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setModalTipoOpen(true)}>
                <Text style={form.tipoCultivo ? styles.selectValue : styles.selectPlaceholder}>
                  {form.tipoCultivo || 'Selecciona el tipo de quinua'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Ubicacion</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setModalComunidadOpen(true)}>
                <Text style={form.ubicacion ? styles.selectValue : styles.selectPlaceholder}>
                  {form.ubicacion || 'Selecciona una comunidad (Patacamaya o Sica Sica)'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Foto del Terreno / Inicio (Opcional)</Text>
              <TouchableOpacity style={styles.photoUploadArea} onPress={() => seleccionarImagen('gallery')}>
                {fotoTerreno ? (
                  <View style={styles.photoContent}>
                    <Image source={{ uri: fotoTerreno }} style={styles.photoPreview} />
                    <Text style={styles.photoUploadText}>Foto cargada correctamente</Text>
                    <Text style={styles.photoUploadSub}>Toca para reemplazar desde galeria</Text>
                  </View>
                ) : (
                  <View style={styles.photoContent}>
                    <Ionicons name="camera-outline" size={32} color="#2eaa51" style={styles.photoIcon} />
                    <Text style={styles.photoUploadText}>Tomar foto o subir evidencia del inicio</Text>
                    <Text style={styles.photoUploadSub}>Captura el estado inicial de tu terreno</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.photoActionsRow}>
                <TouchableOpacity style={styles.photoActionButton} onPress={() => seleccionarImagen('camera')}>
                  <Ionicons name="camera" size={16} color="#2eaa51" />
                  <Text style={styles.photoActionText}>Camara</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoActionButton} onPress={() => seleccionarImagen('gallery')}>
                  <Ionicons name="images-outline" size={16} color="#2eaa51" />
                  <Text style={styles.photoActionText}>Galeria</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldContainer, styles.fieldHalfLeft]}>
                <Text style={styles.label}>Superficie</Text>
                <View style={styles.inputWithSuffix}>
                  <TextInput
                    style={[styles.input, styles.inputNoBorder]}
                    placeholder="2.5"
                    keyboardType="numeric"
                    value={form.superficie}
                    onChangeText={(texto) => actualizarCampo('superficie', texto)}
                  />
                  <Text style={styles.suffixText}>Ha</Text>
                </View>
              </View>

              <View style={[styles.fieldContainer, styles.fieldHalfRight]}>
                <Text style={styles.label}>Fecha de Siembra</Text>
                <TouchableOpacity style={styles.selectInput} onPress={() => abrirSelectorFecha('fechaSiembra')}>
                  <Text style={form.fechaSiembra ? styles.selectValue : styles.selectPlaceholder}>
                    {form.fechaSiembra || 'dd/mm/aaaa'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Fecha Estimada de Cosecha</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => abrirSelectorFecha('fechaCosecha')}>
                <Text style={form.fechaCosecha ? styles.selectValue : styles.selectPlaceholder}>
                  {form.fechaCosecha || 'dd/mm/aaaa'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, guardando && styles.submitBtnDisabled]}
              onPress={crearLote}
              disabled={guardando}
            >
              <MaterialCommunityIcons name="star-four-points" size={16} color="#fff" />
              <Text style={styles.submitBtnText}>{guardando ? 'Guardando...' : 'Crear Lote y Comenzar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={modalTipoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalTipoOpen(false)}
      >
        <View style={styles.selectorOverlay}>
          <View style={styles.selectorModal}>
            <Text style={styles.selectorTitle}>Tipo de Quinua</Text>
            {TIPOS_QUINUA.map((tipo) => (
              <TouchableOpacity
                key={tipo}
                style={styles.selectorOption}
                onPress={() => {
                  actualizarCampo('tipoCultivo', tipo);
                  setModalTipoOpen(false);
                }}
              >
                <Text style={styles.selectorOptionText}>{tipo}</Text>
                {form.tipoCultivo === tipo && <Ionicons name="checkmark" size={18} color="#2eaa51" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.selectorCancel} onPress={() => setModalTipoOpen(false)}>
              <Text style={styles.selectorCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalComunidadOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalComunidadOpen(false)}
      >
        <View style={styles.selectorOverlay}>
          <View style={styles.selectorModal}>
            <Text style={styles.selectorTitle}>Selecciona una comunidad</Text>
            {COMUNIDADES.map((comunidad) => (
              <TouchableOpacity
                key={comunidad}
                style={styles.selectorOption}
                onPress={() => {
                  actualizarCampo('ubicacion', comunidad);
                  setModalComunidadOpen(false);
                }}
              >
                <Text style={styles.selectorOptionText}>{comunidad}</Text>
                {form.ubicacion === comunidad && <Ionicons name="checkmark" size={18} color="#2eaa51" />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.selectorCancel} onPress={() => setModalComunidadOpen(false)}>
              <Text style={styles.selectorCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalCalendarioOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalCalendarioOpen(false)}
      >
        <View style={styles.selectorOverlay}>
          <View style={styles.selectorModal}>
            <Text style={styles.selectorTitle}>Selecciona una fecha</Text>
            <Calendar
              current={fechaSeleccionadaISO || undefined}
              markedDates={
                fechaSeleccionadaISO
                  ? {
                      [fechaSeleccionadaISO]: {
                        selected: true,
                        selectedColor: '#2eaa51',
                      },
                    }
                  : undefined
              }
              onDayPress={(day) => seleccionarFecha(day.dateString)}
              theme={{
                todayTextColor: '#2eaa51',
                arrowColor: '#2eaa51',
                selectedDayBackgroundColor: '#2eaa51',
              }}
            />

            <TouchableOpacity style={styles.selectorCancel} onPress={() => setModalCalendarioOpen(false)}>
              <Text style={styles.selectorCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginLeft: 10,
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldHalfLeft: {
    flex: 1,
    marginRight: 8,
  },
  fieldHalfRight: {
    flex: 1,
    marginLeft: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  hint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  selectInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  selectPlaceholder: {
    fontSize: 14,
    color: '#9ca3af',
    flex: 1,
    marginRight: 8,
  },
  inputWithSuffix: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
  },
  inputNoBorder: {
    flex: 1,
    borderWidth: 0,
    marginBottom: 0,
  },
  suffixText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  photoUploadArea: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  photoContent: {
    width: '100%',
    alignItems: 'center',
  },
  photoIcon: {
    marginBottom: 8,
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  photoUploadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  photoUploadSub: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  photoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    paddingVertical: 12,
  },
  photoActionText: {
    marginLeft: 6,
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginRight: 12,
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#4b5563',
    fontWeight: 'bold',
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#2eaa51',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  selectorModal: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10,
  },
  selectorOption: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectorOptionText: {
    color: '#374151',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  selectorCancel: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  selectorCancelText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
});

