import React from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Fase } from '../types';
import { useCalculadoraCostos } from '../hooks/useCalculadoraCostos';

type FormularioCostosProps = {
  title: string;
  subtitle: string;
  onBack?: () => void;
  onVerResultados: () => void;
  calculadora: ReturnType<typeof useCalculadoraCostos>;
};

export function FormularioCostos({
  title,
  subtitle,
  onBack,
  onVerResultados,
  calculadora,
}: FormularioCostosProps) {
  const {
    estrategia,
    fase,
    gastos,
    formGasto,
    produccion,
    unidadCantidad,
    unidadPrecio,
    guardandoProduccion,
    modalCategoria,
    modalUnidadCantidad,
    modalUnidadPrecio,
    modalEdicion,
    gastoEnEdicion,
    formEdicion,
    unidadCantidadForm,
    unidadCantidadEdicion,
    equivalenciaTexto,
    equivalenciaPrecioTexto,
    cambiarFase,
    setFormGasto,
    setProduccion,
    setUnidadCantidad,
    setUnidadPrecio,
    setModalCategoria,
    setModalUnidadCantidad,
    setModalUnidadPrecio,
    setModalEdicion,
    setFormEdicion,
    agregarGasto,
    eliminarGasto,
    editarGasto,
    guardarEdicion,
    guardarDatosProduccion,
    seleccionarCategoria,
    sanitizarCantidadFormulario,
    sanitizarCantidadFormularioEdicion,
  } = calculadora;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color="#4b5563" />
            <Text style={styles.backText}>Volver a Lotes</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.resultsButton} onPress={onVerResultados}>
          <Ionicons name="bar-chart-outline" size={20} color="#fff" />
          <Text style={styles.resultsButtonText}>Ver Resultados Detallados</Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Registrar Gastos</Text>
          <Text style={styles.cardSubtitle}>Organiza tus gastos por fase del cultivo</Text>

          <View style={styles.phaseContainer}>
            {(['Siembra', 'Crecimiento', 'Cosecha'] as Fase[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.phaseBtn, fase === f && styles.phaseBtnActive]}
                onPress={() => cambiarFase(f)}
              >
                <MaterialCommunityIcons
                  name={f === 'Siembra' ? 'sprout' : f === 'Crecimiento' ? 'trending-up' : 'basket-outline'}
                  size={24}
                  color={fase === f ? '#2eaa51' : '#9ca3af'}
                />
                <Text style={[styles.phaseText, fase === f && styles.phaseTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Categoría</Text>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setModalCategoria(true)}>
            <Text style={{ color: formGasto.categoria ? '#1f2937' : '#9ca3af' }}>
              {formGasto.categoria || 'Selecciona una categoría'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Descripción (Opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder={estrategia.placeholderDescripcion}
            value={formGasto.descripcion}
            onChangeText={(t) => setFormGasto({ ...formGasto, descripcion: t })}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.inputLabel}>
                Cantidad{estrategia.usaValidacionCantidadPorCategoria ? ` (${unidadCantidadForm})` : ''}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={
                  estrategia.usaValidacionCantidadPorCategoria
                    ? estrategia.categoriasCantidadEntera.has(formGasto.categoria)
                      ? '0'
                      : '0.00'
                    : '0'
                }
                keyboardType="numeric"
                value={formGasto.cantidad}
                onChangeText={(t) => setFormGasto({ ...formGasto, cantidad: sanitizarCantidadFormulario(t) })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Monto (Bs)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={formGasto.monto}
                onChangeText={(t) => setFormGasto({ ...formGasto, monto: t })}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={agregarGasto}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Agregar Gasto</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lista de Gastos</Text>
          <Text style={styles.cardSubtitle}>{gastos.length} gastos registrados</Text>

          {gastos.length === 0 && <Text style={styles.emptyText}>No hay gastos aún.</Text>}

          {gastos.map((gasto, index) => (
            <View key={gasto.id}>
              <View style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <View style={styles.tagGreenInlineTop}>
                    <Text style={styles.tagTextGreen}>{gasto.fase}</Text>
                  </View>
                  <Text style={styles.itemTitle}>{gasto.categoria}</Text>
                  {gasto.descripcion ? <Text style={styles.itemSub}>{gasto.descripcion}</Text> : null}
                  {estrategia.mostrarPendienteOffline && gasto.origen === 'LOCAL' && !gasto.sincronizado && (
                    <Text style={styles.pendienteLabel}>Pendiente offline</Text>
                  )}
                </View>
                <Text style={styles.itemPrice}>Bs {parseFloat(gasto.monto).toFixed(2)}</Text>
                <TouchableOpacity style={styles.editBtn} onPress={() => editarGasto(gasto)}>
                  <Ionicons name="pencil-outline" size={18} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => eliminarGasto(gasto)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
              {index < gastos.length - 1 && <View style={styles.listDivider} />}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos de Producción</Text>
          <View style={{ marginTop: 10 }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.inputLabel}>Cantidad Producida</Text>
              <View style={styles.inputWithUnitRow}>
                <TextInput
                  style={[styles.input, styles.inputCompact]}
                  keyboardType="numeric"
                  value={produccion.cantidad}
                  onChangeText={(t) => setProduccion({ ...produccion, cantidad: t })}
                />
                <TouchableOpacity style={styles.unitPickerBtn} onPress={() => setModalUnidadCantidad(true)}>
                  <Text style={styles.unitPickerText}>{unidadCantidad}</Text>
                  <Ionicons name="chevron-down" size={10} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              <Text style={styles.equivalenceText}>{equivalenciaTexto}</Text>
            </View>

            <View>
              <Text style={styles.inputLabel}>Precio de Venta</Text>
              <View style={styles.inputWithUnitRow}>
                <TextInput
                  style={[styles.input, styles.inputCompact]}
                  keyboardType="numeric"
                  value={produccion.precio}
                  onChangeText={(t) => setProduccion({ ...produccion, precio: t })}
                />
                <TouchableOpacity style={styles.unitPickerBtnWide} onPress={() => setModalUnidadPrecio(true)}>
                  <Text style={styles.unitPickerText}>{unidadPrecio === 'bskg' ? 'Bs/kg' : 'Bs/qq'}</Text>
                  <Ionicons name="chevron-down" size={10} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              <Text style={styles.equivalenceText}>{equivalenciaPrecioTexto}</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={guardarDatosProduccion}
              disabled={guardandoProduccion}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>
                {guardandoProduccion ? 'Guardando...' : 'Guardar Datos de Producción'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={modalCategoria} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona una Categoría</Text>
            <Text style={styles.modalSub}>Fase actual: {fase}</Text>
            <FlatList
              data={estrategia.categoriasPorFase[fase]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => seleccionarCategoria(item)}>
                  {estrategia.usaValidacionCantidadPorCategoria ? (
                    <View style={styles.modalItemRow}>
                      <Text style={styles.modalItemText}>{item}</Text>
                      <Text style={styles.modalItemUnit}>{estrategia.unidadPorCategoria[item] || 'unidad'}</Text>
                    </View>
                  ) : (
                    <Text style={styles.modalItemText}>{item}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalCategoria(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalUnidadCantidad} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.unitModalContent}>
            <Text style={styles.modalTitle}>Unidad de cantidad</Text>
            <TouchableOpacity
              style={styles.unitOptionBtn}
              onPress={() => {
                setUnidadCantidad('kg');
                setModalUnidadCantidad(false);
              }}
            >
              <Text style={styles.unitOptionText}>kg</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.unitOptionBtn}
              onPress={() => {
                setUnidadCantidad('qq');
                setModalUnidadCantidad(false);
              }}
            >
              <Text style={styles.unitOptionText}>qq</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalUnidadCantidad(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalUnidadPrecio} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.unitModalContent}>
            <Text style={styles.modalTitle}>Unidad de precio</Text>
            <TouchableOpacity
              style={styles.unitOptionBtn}
              onPress={() => {
                setUnidadPrecio('bskg');
                setModalUnidadPrecio(false);
              }}
            >
              <Text style={styles.unitOptionText}>Bs/kg</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.unitOptionBtn}
              onPress={() => {
                setUnidadPrecio('bsqq');
                setModalUnidadPrecio(false);
              }}
            >
              <Text style={styles.unitOptionText}>Bs/qq</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalUnidadPrecio(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalEdicion} animationType="slide" transparent>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalEdicion(false)}>
                <Ionicons name="arrow-back" size={24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Editar Gasto</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
              {gastoEnEdicion && (
                <View style={styles.card}>
                  <Text style={styles.inputLabel}>Categoría</Text>
                  <TouchableOpacity style={styles.dropdownButton} onPress={() => setModalCategoria(true)}>
                    <Text style={{ color: formEdicion.categoria ? '#1f2937' : '#9ca3af' }}>
                      {formEdicion.categoria || 'Selecciona una categoría'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#9ca3af" />
                  </TouchableOpacity>

                  {estrategia.usaValidacionCantidadPorCategoria && (
                    <>
                      <Text style={styles.inputLabel}>Descripción (Opcional)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ingrese una descripción para este gasto"
                        value={formEdicion.descripcion}
                        onChangeText={(t) => setFormEdicion({ ...formEdicion, descripcion: t })}
                      />
                    </>
                  )}

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.inputLabel}>
                        Cantidad{estrategia.usaValidacionCantidadPorCategoria ? ` (${unidadCantidadEdicion})` : ''}
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder={
                          estrategia.usaValidacionCantidadPorCategoria
                            ? estrategia.categoriasCantidadEntera.has(formEdicion.categoria)
                              ? '0'
                              : '0.00'
                            : '0'
                        }
                        keyboardType="numeric"
                        value={formEdicion.cantidad}
                        onChangeText={(t) =>
                          setFormEdicion({
                            ...formEdicion,
                            cantidad: sanitizarCantidadFormularioEdicion(t),
                          })
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Monto (Bs)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={formEdicion.monto}
                        onChangeText={(t) => setFormEdicion({ ...formEdicion, monto: t })}
                      />
                    </View>
                  </View>

                  <TouchableOpacity style={styles.primaryButton} onPress={guardarEdicion}>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.primaryButtonText}>Guardar Cambios</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafafc' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { marginBottom: 20, marginTop: 10 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { color: '#4b5563', fontSize: 14, fontWeight: '500', marginLeft: 6 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2, marginBottom: 16 },

  phaseContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  phaseBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginHorizontal: 4,
    backgroundColor: '#fff',
  },
  phaseBtnActive: { borderColor: '#2eaa51', backgroundColor: '#f0fdf4' },
  phaseText: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginTop: 4 },
  phaseTextActive: { color: '#2eaa51' },

  inputLabel: { fontSize: 12, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 16,
  },
  inputCompact: { marginBottom: 0, flex: 1 },
  inputWithUnitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitPickerBtn: {
    width: 78,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitPickerBtnWide: {
    width: 96,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitPickerText: { color: '#1f2937', fontSize: 14, fontWeight: '500' },
  equivalenceText: { marginTop: 8, fontSize: 14, color: '#6b7280' },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#2eaa51',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  resultsButton: {
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  resultsButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  listDivider: { height: 1, backgroundColor: '#f3f4f6' },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  itemSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  pendienteLabel: { fontSize: 12, color: '#f97316', marginTop: 2, fontWeight: '600' },
  itemPrice: { fontSize: 14, fontWeight: 'bold', color: '#2eaa51', marginRight: 12 },
  editBtn: { padding: 6, backgroundColor: '#dbeafe', borderRadius: 6, marginRight: 8 },
  deleteBtn: { padding: 6, backgroundColor: '#fef2f2', borderRadius: 6 },
  tagGreenInlineTop: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  tagTextGreen: { color: '#166534', fontSize: 10, fontWeight: 'bold' },
  emptyText: { color: '#9ca3af', textAlign: 'center' },

  chartContainer: {
    flexDirection: 'row',
    height: 180,
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  chartYAxis: {
    justifyContent: 'space-between',
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    paddingBottom: 20,
  },
  chartYText: { fontSize: 10, color: '#9ca3af' },
  chartBarsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 20,
  },
  chartGroup: { flexDirection: 'row', alignItems: 'flex-end', width: 60, justifyContent: 'center' },
  bar: { width: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3, marginHorizontal: 1 },
  chartLabel: {
    position: 'absolute',
    bottom: -20,
    fontSize: 10,
    color: '#6b7280',
    width: 80,
    textAlign: 'center',
  },
  legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 2, marginRight: 4 },
  legendText: { fontSize: 11, color: '#4b5563' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  unitModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  unitOptionBtn: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  unitOptionText: { fontSize: 16, color: '#1f2937', fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#2eaa51', fontWeight: '600', marginBottom: 16 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalItemText: { fontSize: 16, color: '#4b5563' },
  modalItemUnit: { fontSize: 12, color: '#2eaa51', fontWeight: '700', textTransform: 'uppercase' },
  modalCloseBtn: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 16, fontWeight: 'bold', color: '#4b5563' },
});
