import React, { useEffect, useState } from 'react';
import {
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRegistroSiembra } from '../hooks/useRegistroSiembra';
import { configuracionCamposPorRubro } from '../utils/configuracionCampos';
import { CampoFormularioConfig, ModalRegistroSiembraProps } from '../types';

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

const METROS_CUADRADOS_POR_HECTAREA = 10000;
const OPCION_TIPO_CULTIVO_OTROS = 'Otros';

const formatearSuperficieEquivalente = (valor: string, unidad: 'ha' | 'm2'): string | null => {
  const numero = Number(valor.trim().replace(',', '.'));

  if (!Number.isFinite(numero) || numero <= 0) {
    return null;
  }

  const equivalente = unidad === 'ha' ? numero * METROS_CUADRADOS_POR_HECTAREA : numero / METROS_CUADRADOS_POR_HECTAREA;

  if (unidad === 'ha') {
    return `${equivalente.toLocaleString('es-BO', { maximumFractionDigits: 2 })} m2`;
  }

  return `${equivalente.toLocaleString('es-BO', { maximumFractionDigits: 4 })} ha`;
};

export function ModalRegistroSiembra({
  visible,
  onClose,
  onGuardarExitoso,
  rubro,
}: ModalRegistroSiembraProps) {
  const [modalUnidadSuperficieOpen, setModalUnidadSuperficieOpen] = useState(false);
  const [mostrarTipoCultivoPersonalizado, setMostrarTipoCultivoPersonalizado] = useState(false);
  const insets = useSafeAreaInsets();
  const configuracion = configuracionCamposPorRubro[rubro];
  const {
    form,
    superficieUnidad,
    fotoTerreno,
    fotoPendienteCamara,
    guardando,
    cargandoUbicacionGps,
    errorUbicacionGps,
    modalOpcionesOpen,
    modalCalendarioOpen,
    modalCultivosOpen,
    cultivosSeleccionados,
    variedadOtro,
    campoFechaActivo,
    campoOpcionesActivo,
    actualizarCampo,
    actualizarSuperficieUnidad,
    capturarUbicacionGps,
    abrirSelectorOpciones,
    cerrarSelectorOpciones,
    abrirSelectorCultivos,
    cerrarSelectorCultivos,
    toggleCultivoSeleccionado,
    actualizarVariedadOtro,
    confirmarSeleccionCultivos,
    removerCultivoSeleccionado,
    abrirSelectorFecha,
    cerrarSelectorFecha,
    seleccionarFecha,
    seleccionarImagen,
    guardarFotoPendiente,
    descartarFotoPendiente,
    fechaSeleccionadaISO,
    crearLote,
  } = useRegistroSiembra({
    visible,
    onClose,
    onGuardarExitoso,
    rubro,
  });

  const campoOpciones = configuracion.secciones
    .flatMap((seccion) => seccion.columnas)
    .find((campo) => campo.key === campoOpcionesActivo);

  const opcionesCultivosMultiSelect =
    configuracion.secciones
      .flatMap((seccion) => seccion.columnas)
      .find((campo) => campo.key === 'tipoCultivo')
      ?.opciones ?? [];

  const placeholderOtro =
    rubro === 'hortalizas' ? 'Escribe otra variedad de hortaliza' : 'Escribe otra variedad de quinua';

  useEffect(() => {
    if (!visible) {
      setMostrarTipoCultivoPersonalizado(false);
    }
  }, [visible]);

  const renderCampo = (campo: CampoFormularioConfig, posicion: 'izquierda' | 'derecha' | 'completo') => {
    const esMitad = posicion !== 'completo';
    const wrapperStyle = [
      styles.fieldContainer,
      esMitad && posicion === 'izquierda' ? styles.fieldHalfLeft : null,
      esMitad && posicion === 'derecha' ? styles.fieldHalfRight : null,
    ];

    if (campo.tipo === 'photo') {
      return (
        <View key={campo.key} style={wrapperStyle}>
          <Text style={styles.label}>{campo.label}</Text>
          <TouchableOpacity style={styles.photoUploadArea} onPress={() => void seleccionarImagen('gallery')}>
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
            <TouchableOpacity style={styles.photoActionButton} onPress={() => void seleccionarImagen('camera')}>
              <Ionicons name="camera" size={16} color="#2eaa51" />
              <Text style={styles.photoActionText}>Camara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoActionButton} onPress={() => void seleccionarImagen('gallery')}>
              <Ionicons name="images-outline" size={16} color="#2eaa51" />
              <Text style={styles.photoActionText}>Galeria</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (campo.tipo === 'select') {
      const valorActual = form[campo.key as keyof typeof form] as string;

      if (campo.key === 'tipoCultivo') {
        return (
          <View key={campo.key} style={wrapperStyle}>
            <Text style={styles.label}>{campo.label}</Text>
            <TouchableOpacity style={styles.selectInput} onPress={abrirSelectorCultivos}>
              <Text style={cultivosSeleccionados.length > 0 ? styles.selectValue : styles.selectPlaceholder}>
                {cultivosSeleccionados.length > 0
                  ? `${cultivosSeleccionados.length} cultivo(s) seleccionado(s)`
                  : 'Seleccionar tipos de cultivo...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#6b7280" />
            </TouchableOpacity>

            <View style={styles.chipsContainer}>
              {cultivosSeleccionados.map((cultivo) => (
                <View key={cultivo} style={styles.chip}>
                  <Text style={styles.chipText}>{cultivo}</Text>
                  <TouchableOpacity
                    style={styles.chipRemoveButton}
                    onPress={() => removerCultivoSeleccionado(cultivo)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Ionicons name="close" size={14} color="#2BA14A" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        );
      }

      return (
        <View key={campo.key} style={wrapperStyle}>
          <Text style={styles.label}>{campo.label}</Text>
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => abrirSelectorOpciones(campo.key as 'tipoCultivo' | 'ubicacion')}
          >
            <Text style={valorActual ? styles.selectValue : styles.selectPlaceholder}>
              {valorActual || campo.placeholder}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
      );
    }

    if (campo.tipo === 'gps') {
      const valorActual = form[campo.key as keyof typeof form] as string;
      return (
        <View key={campo.key} style={wrapperStyle}>
          <Text style={styles.label}>{campo.label}</Text>
          <TouchableOpacity
            style={[styles.gpsInput, cargandoUbicacionGps && styles.gpsInputDisabled]}
            onPress={() => void capturarUbicacionGps()}
            activeOpacity={0.9}
            disabled={cargandoUbicacionGps}
          >
            <Ionicons name="location-outline" size={20} color="#2eaa51" />
            <View style={styles.gpsInputContent}>
              <Text style={valorActual ? styles.selectValue : styles.selectPlaceholder} numberOfLines={2}>
                {cargandoUbicacionGps ? 'Capturando GPS...' : valorActual || campo.placeholder}
              </Text>
              <Text style={styles.gpsInputSubtext} numberOfLines={2}>
                {valorActual
                  ? 'Guardado localmente. Se sincroniza automaticamente cuando vuelve internet.'
                  : 'Toca para registrar la ubicacion GPS del lote.'}
              </Text>
            </View>
            <Ionicons name={cargandoUbicacionGps ? 'sync' : 'refresh'} size={18} color="#6b7280" />
          </TouchableOpacity>
          {errorUbicacionGps ? <Text style={styles.gpsError}>{errorUbicacionGps}</Text> : null}
          {campo.hint ? <Text style={styles.hint}>{campo.hint}</Text> : null}
        </View>
      );
    }

    if (campo.tipo === 'date') {
      const valorActual = form[campo.key as keyof typeof form] as string;
      return (
        <View key={campo.key} style={wrapperStyle}>
          <Text style={[styles.label, styles.dateLabel]}>{campo.label}</Text>
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => abrirSelectorFecha(campo.key as 'fechaSiembra' | 'fechaCosecha')}
          >
            <Text style={valorActual ? styles.selectValue : styles.selectPlaceholder}>
              {valorActual || campo.placeholder}
            </Text>
            <Ionicons name="calendar-outline" size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>
      );
    }

    if (campo.tipo === 'number') {
      const valorActual = form[campo.key as keyof typeof form] as string;
      const superficieEquivalente = formatearSuperficieEquivalente(valorActual, superficieUnidad);
      return (
        <View key={campo.key} style={wrapperStyle}>
          <Text style={styles.label}>{campo.label}</Text>
          {campo.key === 'superficie' ? (
            <>
              <View style={styles.inputWithUnitRow}>
                <TextInput
                  style={[styles.input, styles.inputCompact]}
                  placeholder={superficieUnidad === 'ha' ? '2.5' : '2500'}
                  keyboardType="numeric"
                  value={valorActual}
                  onChangeText={(texto) => actualizarCampo(campo.key as keyof typeof form, texto)}
                />
                <TouchableOpacity style={styles.unitPickerBtn} onPress={() => setModalUnidadSuperficieOpen(true)}>
                  <Text style={styles.unitPickerText}>{superficieUnidad}</Text>
                  <Ionicons name="chevron-down" size={10} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              {superficieEquivalente ? (
                <Text style={styles.equivalentText}>= {superficieEquivalente}</Text>
              ) : null}
            </>
          ) : (
            <View style={styles.inputWithSuffix}>
              <TextInput
                style={[styles.input, styles.inputNoBorder]}
                placeholder={campo.placeholder}
                keyboardType="numeric"
                value={valorActual}
                onChangeText={(texto) => actualizarCampo(campo.key as keyof typeof form, texto)}
              />
              <Text style={styles.suffixText}>{campo.sufijo}</Text>
            </View>
          )}
          {campo.hint ? <Text style={styles.hint}>{campo.hint}</Text> : null}
        </View>
      );
    }

    const valorActual = form[campo.key as keyof typeof form] as string;
    return (
      <View key={campo.key} style={wrapperStyle}>
        <Text style={styles.label}>{campo.label}</Text>
        <TextInput
          style={styles.input}
          placeholder={campo.placeholder}
          placeholderTextColor="#9ca3af"
          value={valorActual}
          onChangeText={(texto) => actualizarCampo(campo.key as keyof typeof form, texto)}
        />
        {campo.hint ? <Text style={styles.hint}>{campo.hint}</Text> : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="seed-outline" size={24} color="#2eaa51" />
              <Text style={styles.headerTitle}>Nueva Siembra / Iniciar la Parcela</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {configuracion.secciones.map((seccion) => {
              if (seccion.columnas.length === 2) {
                return (
                  <View key={seccion.id} style={styles.row}>
                    {renderCampo(seccion.columnas[0], 'izquierda')}
                    {renderCampo(seccion.columnas[1], 'derecha')}
                  </View>
                );
              }

              return renderCampo(seccion.columnas[0], 'completo');
            })}

            <View style={styles.bottomSpacer} />
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, guardando && styles.submitBtnDisabled]}
              onPress={() => void crearLote()}
              disabled={guardando}
            >
              <MaterialCommunityIcons name="star-four-points" size={16} color="#fff" />
              <Text style={styles.submitBtnText}>{guardando ? 'Guardando...' : configuracion.mensajeBotonGuardar}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={modalUnidadSuperficieOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalUnidadSuperficieOpen(false)}
      >
        <View style={styles.selectorOverlay}>
          <View style={styles.selectorModal}>
            <Text style={styles.selectorTitle}>Unidad de superficie</Text>
            <TouchableOpacity
              style={styles.selectorOption}
              onPress={() => {
                actualizarSuperficieUnidad('ha');
                setModalUnidadSuperficieOpen(false);
              }}
            >
              <Text style={styles.selectorOptionText}>ha</Text>
              {superficieUnidad === 'ha' ? <Ionicons name="checkmark" size={18} color="#2eaa51" /> : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectorOption}
              onPress={() => {
                actualizarSuperficieUnidad('m2');
                setModalUnidadSuperficieOpen(false);
              }}
            >
              <Text style={styles.selectorOptionText}>m2</Text>
              {superficieUnidad === 'm2' ? <Ionicons name="checkmark" size={18} color="#2eaa51" /> : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectorCancel} onPress={() => setModalUnidadSuperficieOpen(false)}>
              <Text style={styles.selectorCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalOpcionesOpen} transparent animationType="fade" onRequestClose={cerrarSelectorOpciones}>
        <View style={styles.selectorOverlay}>
          <View style={styles.selectorModal}>
            <Text style={styles.selectorTitle}>{campoOpciones?.tituloSelector ?? 'Selecciona una opcion'}</Text>
            {(campoOpciones?.opciones ?? []).map((opcion) => (
              <TouchableOpacity
                key={opcion}
                style={styles.selectorOption}
                onPress={() => {
                  if (campoOpcionesActivo) {
                    if (campoOpcionesActivo === 'tipoCultivo' && opcion === OPCION_TIPO_CULTIVO_OTROS) {
                      setMostrarTipoCultivoPersonalizado(true);
                      actualizarCampo('tipoCultivo', '');
                    } else {
                      if (campoOpcionesActivo === 'tipoCultivo') {
                        setMostrarTipoCultivoPersonalizado(false);
                      }
                      actualizarCampo(campoOpcionesActivo, opcion);
                    }
                  }
                  cerrarSelectorOpciones();
                }}
              >
                <Text style={styles.selectorOptionText}>{opcion}</Text>
                {campoOpcionesActivo &&
                ((campoOpcionesActivo === 'tipoCultivo' &&
                  opcion === OPCION_TIPO_CULTIVO_OTROS &&
                  mostrarTipoCultivoPersonalizado) ||
                  form[campoOpcionesActivo] === opcion) ? (
                  <Ionicons name="checkmark" size={18} color="#2eaa51" />
                ) : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.selectorCancel} onPress={cerrarSelectorOpciones}>
              <Text style={styles.selectorCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalCultivosOpen} transparent animationType="fade" onRequestClose={cerrarSelectorCultivos}>
        <View style={styles.selectorOverlay}>
          <View style={styles.selectorModal}>
            <Text style={styles.selectorTitle}>Selecciona uno o varios cultivos</Text>
            {(opcionesCultivosMultiSelect ?? []).map((opcion) => {
              const seleccionado = cultivosSeleccionados.includes(opcion);
              return (
                <TouchableOpacity key={opcion} style={styles.selectorOption} onPress={() => toggleCultivoSeleccionado(opcion)}>
                  <Text style={styles.selectorOptionText}>{opcion}</Text>
                  <Ionicons
                    name={seleccionado ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={seleccionado ? '#2BA14A' : '#9ca3af'}
                  />
                </TouchableOpacity>
              );
            })}

            {cultivosSeleccionados.includes(OPCION_TIPO_CULTIVO_OTROS) ? (
              <TextInput
                style={[styles.input, styles.otrosVariedadInput]}
                placeholder={placeholderOtro}
                placeholderTextColor="#9ca3af"
                value={variedadOtro}
                onChangeText={actualizarVariedadOtro}
              />
            ) : null}

            <TouchableOpacity style={styles.confirmSelectionButton} onPress={confirmarSeleccionCultivos}>
              <Text style={styles.confirmSelectionButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalCalendarioOpen} transparent animationType="fade" onRequestClose={cerrarSelectorFecha}>
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

            <TouchableOpacity style={styles.selectorCancel} onPress={cerrarSelectorFecha}>
              <Text style={styles.selectorCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(fotoPendienteCamara)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={descartarFotoPendiente}
      >
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Previsualizacion de foto</Text>
            <Text style={styles.previewSubtitle}>Confirma si deseas guardar esta imagen del parcela.</Text>
          </View>

          {fotoPendienteCamara ? (
            <Image source={{ uri: fotoPendienteCamara }} style={styles.previewImage} resizeMode="cover" />
          ) : null}

          <View style={[styles.previewFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity
              style={styles.previewRetryBtn}
              onPress={() => {
                descartarFotoPendiente();
                void seleccionarImagen('camera');
              }}
            >
              <Text style={styles.previewRetryText}>Repetir</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.previewSaveBtn} onPress={guardarFotoPendiente}>
              <Text style={styles.previewSaveText}>Guardar Foto</Text>
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
  dateLabel: {
    minHeight: 52,
    lineHeight: 26,
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
  customTypeInput: {
    marginTop: 10,
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 8,
  },
  chipText: {
    color: '#2BA14A',
    fontSize: 12,
    fontWeight: '600',
  },
  chipRemoveButton: {
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otrosVariedadInput: {
    marginTop: 10,
    borderColor: '#bbf7d0',
    backgroundColor: '#f9fffb',
  },
  gpsInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsInputDisabled: {
    opacity: 0.75,
  },
  gpsInputContent: {
    flex: 1,
    marginHorizontal: 10,
  },
  gpsInputSubtext: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 3,
  },
  gpsError: {
    fontSize: 11,
    color: '#b91c1c',
    marginTop: 4,
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
  inputWithUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputCompact: {
    flex: 1,
    marginBottom: 0,
  },
  unitPickerBtn: {
    minWidth: 90,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  unitPickerText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  unitSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  unitSelectorButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  unitSelectorButtonActive: {
    borderColor: '#2eaa51',
    backgroundColor: '#ecfdf3',
  },
  unitSelectorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
  },
  unitSelectorTextActive: {
    color: '#1f7a3a',
  },
  equivalentText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
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
  confirmSelectionButton: {
    marginTop: 14,
    backgroundColor: '#2eaa51',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmSelectionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  previewHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: '#111827',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f9fafb',
  },
  previewSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#cbd5e1',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  previewFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#111827',
  },
  previewRetryBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: '#1f2937',
  },
  previewRetryText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '700',
  },
  previewSaveBtn: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: '#16a34a',
  },
  previewSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
