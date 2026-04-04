import React from 'react';
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

export function ModalRegistroSiembra({
  visible,
  onClose,
  onGuardarExitoso,
  rubro,
}: ModalRegistroSiembraProps) {
  const insets = useSafeAreaInsets();
  const configuracion = configuracionCamposPorRubro[rubro];
  const {
    form,
    fotoTerreno,
    guardando,
    cargandoUbicacionGps,
    errorUbicacionGps,
    modalOpcionesOpen,
    modalCalendarioOpen,
    campoFechaActivo,
    campoOpcionesActivo,
    actualizarCampo,
    capturarUbicacionGps,
    abrirSelectorOpciones,
    cerrarSelectorOpciones,
    abrirSelectorFecha,
    cerrarSelectorFecha,
    seleccionarFecha,
    seleccionarImagen,
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
          <Text style={styles.label}>{campo.label}</Text>
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
      return (
        <View key={campo.key} style={wrapperStyle}>
          <Text style={styles.label}>{campo.label}</Text>
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
              <Text style={styles.headerTitle}>Nueva Siembra / Iniciar Lote</Text>
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
                    actualizarCampo(campoOpcionesActivo, opcion);
                  }
                  cerrarSelectorOpciones();
                }}
              >
                <Text style={styles.selectorOptionText}>{opcion}</Text>
                {campoOpcionesActivo && form[campoOpcionesActivo] === opcion ? (
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
