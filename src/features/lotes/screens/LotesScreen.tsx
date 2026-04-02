import React, { useCallback } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ModalRegistrarSiembraHortalizas from '@/app/_components/ModalRegistrarSiembra_Hortalizas';
import ModalRegistrarSiembraQuinua from '@/app/_components/ModalRegistrarSiembra_Quinua';
import { CalculadoraCostosScreen } from '@/src/features/calculadoraCostos';
import { LoteItem } from '../components/LoteItem';
import { RubroType } from '../types';
import { useLotes } from '../hooks/useLotes';
import { normalizeRubro } from '../utils/constants';

type LotesScreenProps = {
  rubro?: RubroType;
};

export function LotesScreen({ rubro }: LotesScreenProps) {
  const params = useLocalSearchParams<{ rubro?: string | string[] }>();
  const rubroResuelto = rubro || normalizeRubro(params.rubro);

  const {
    lotes,
    stats,
    rubroConfig,
    modalOpen,
    setModalOpen,
    mostrarCalculadora,
    setMostrarCalculadora,
    loteSeleccionadoIdServidor,
    loteSeleccionadoIdLocal,
    setLoteSeleccionadoIdServidor,
    setLoteSeleccionadoIdLocal,
    modalEditarOpen,
    setModalEditarOpen,
    guardandoEdicion,
    formEdicion,
    setFormEdicion,
    abrirModalEdicion,
    guardarEdicionLote,
    eliminarLote,
    cargarLotesLocalesInmediato,
    cargarLotesLocales,
    manejarCreacionLote,
    diagnosticoCarga,
    mensajeSync,
    modalFotoVisible,
    fotoSeleccionada,
    abrirVistaFoto,
    cerrarVistaFoto,
  } = useLotes(rubroResuelto);

  useFocusEffect(
    useCallback(() => {
      void cargarLotesLocalesInmediato();
      void cargarLotesLocales();
    }, [cargarLotesLocales, cargarLotesLocalesInmediato])
  );

  if (mostrarCalculadora) {
    return (
      <CalculadoraCostosScreen
        rubro={rubroResuelto}
        idLoteServidor={loteSeleccionadoIdServidor ?? undefined}
        idLoteLocal={loteSeleccionadoIdLocal ?? undefined}
        onBack={async () => {
          setMostrarCalculadora(false);
          await cargarLotesLocales();
        }}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{rubroConfig.title}</Text>
              <Text style={styles.subtitle}>{rubroConfig.subtitle}</Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => setModalOpen(true)}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Registrar Siembra</Text>
            </TouchableOpacity>
          </View>

          {!!mensajeSync && <Text style={styles.syncText}>{mensajeSync}</Text>}
          {!!diagnosticoCarga && <Text style={styles.debugText}>{diagnosticoCarga}</Text>}

          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: '#eefcf2', borderColor: '#dcfce7' }]}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>Lotes Activos</Text>
                <View style={[styles.kpiIcon, { backgroundColor: '#dcfce7' }]}>
                  <MaterialCommunityIcons name="sprout" size={18} color="#2eaa51" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: '#2eaa51' }]}>{stats.lotesActivos} Lotes</Text>
              <View style={styles.kpiFooter}>
                <Ionicons name="trending-up" size={12} color="#2eaa51" />
                <Text style={[styles.kpiFooterText, { color: '#2eaa51' }]}>En produccion</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: '#eef4ff', borderColor: '#dbeafe' }]}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>Area Total</Text>
                <View style={[styles.kpiIcon, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="grid-outline" size={18} color="#3b82f6" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: '#3b82f6' }]}>{stats.areaTotal.toFixed(1)} Ha</Text>
              <View style={styles.kpiFooter}>
                <Ionicons name="location-outline" size={12} color="#3b82f6" />
                <Text style={[styles.kpiFooterText, { color: '#3b82f6' }]}>Bajo cultivo</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>Inversion Total</Text>
                <View style={[styles.kpiIcon, { backgroundColor: '#ffedd5' }]}>
                  <Ionicons name="wallet-outline" size={18} color="#f97316" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: '#f97316', fontSize: 18 }]}>Bs {stats.inversionTotal.toLocaleString('es-BO')}</Text>
              <View style={styles.kpiFooter}>
                <Text style={[styles.kpiFooterText, { color: '#f97316' }]}>Gastos acumulados</Text>
              </View>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: '#f5f3ff', borderColor: '#ede9fe' }]}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>Proyectado</Text>
                <View style={[styles.kpiIcon, { backgroundColor: '#ede9fe' }]}>
                  <Ionicons name="cash-outline" size={18} color="#8b5cf6" />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: '#8b5cf6', fontSize: 18 }]}>Bs {stats.ingresosProyectados.toLocaleString('es-BO')}</Text>
              <View style={styles.kpiFooter}>
                <Text style={[styles.kpiFooterText, { color: '#8b5cf6' }]}>Estimacion total</Text>
              </View>
            </View>
          </View>

          {lotes.map((lote) => (
            <LoteItem
              key={lote.key}
              lote={lote}
              productLabel={rubroConfig.productLabel}
              onOpenPhoto={abrirVistaFoto}
              onCalcular={(item) => {
                setLoteSeleccionadoIdServidor(item.idServidor);
                setLoteSeleccionadoIdLocal(item.idLocal);
                setMostrarCalculadora(true);
              }}
              onEditar={abrirModalEdicion}
              onEliminar={eliminarLote}
            />
          ))}

          {rubroResuelto === 'hortalizas' ? (
            <ModalRegistrarSiembraHortalizas
              visible={modalOpen}
              onClose={() => {
                setModalOpen(false);
              }}
              onCreated={manejarCreacionLote}
            />
          ) : (
            <ModalRegistrarSiembraQuinua
              visible={modalOpen}
              onClose={() => {
                setModalOpen(false);
                void cargarLotesLocales();
              }}
              onCreated={manejarCreacionLote}
            />
          )}

          <Modal visible={modalFotoVisible} transparent animationType="fade" onRequestClose={cerrarVistaFoto}>
            <View style={styles.photoModalOverlay}>
              <TouchableOpacity style={styles.photoCloseButton} onPress={cerrarVistaFoto}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBackdrop} activeOpacity={1} onPress={cerrarVistaFoto}>
                {fotoSeleccionada ? <Image source={{ uri: fotoSeleccionada }} style={styles.photoModalImage} /> : null}
              </TouchableOpacity>
            </View>
          </Modal>

          <Modal visible={modalEditarOpen} transparent animationType="fade" onRequestClose={() => setModalEditarOpen(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Editar Lote</Text>

                <Text style={styles.modalLabel}>Nombre del lote</Text>
                <TextInput
                  style={styles.modalInput}
                  value={formEdicion.nombre}
                  onChangeText={(t) => setFormEdicion({ ...formEdicion, nombre: t })}
                  placeholder="Nombre"
                />

                <Text style={styles.modalLabel}>Tipo / Variedad</Text>
                <TextInput
                  style={styles.modalInput}
                  value={formEdicion.tipoCultivo}
                  onChangeText={(t) => setFormEdicion({ ...formEdicion, tipoCultivo: t })}
                  placeholder="Ej: Quinua Jacha Grano / Haba"
                />

                <Text style={styles.modalLabel}>Ubicacion</Text>
                <TextInput
                  style={styles.modalInput}
                  value={formEdicion.ubicacion}
                  onChangeText={(t) => setFormEdicion({ ...formEdicion, ubicacion: t })}
                  placeholder="Comunidad"
                />

                <Text style={styles.modalLabel}>Superficie (Ha)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={formEdicion.superficie}
                  onChangeText={(t) => setFormEdicion({ ...formEdicion, superficie: t })}
                  keyboardType="numeric"
                  placeholder="0"
                />

                <Text style={styles.modalLabel}>Fecha siembra (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={formEdicion.fechaSiembraIso}
                  onChangeText={(t) => setFormEdicion({ ...formEdicion, fechaSiembraIso: t })}
                  placeholder="2026-03-27"
                />

                <Text style={styles.modalLabel}>Fecha cosecha estimada (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={formEdicion.fechaCosechaIso}
                  onChangeText={(t) => setFormEdicion({ ...formEdicion, fechaCosechaIso: t })}
                  placeholder="2026-04-02"
                />

                <Text style={styles.modalLabel}>Foto siembra (URI o URL)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={formEdicion.fotoSiembra}
                  onChangeText={(t) => setFormEdicion({ ...formEdicion, fotoSiembra: t })}
                  placeholder="https://... o file:///..."
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalEditarOpen(false)}>
                    <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSave} onPress={guardarEdicionLote} disabled={guardandoEdicion}>
                    <Text style={styles.modalBtnSaveText}>{guardandoEdicion ? 'Guardando...' : 'Guardar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafafc' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
  header: { marginBottom: 20, marginTop: 0 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1f2937', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 16 },
  syncText: { fontSize: 11, color: '#b45309', marginTop: -10, marginBottom: 6, fontWeight: '600' },
  debugText: { fontSize: 11, color: '#2563eb', marginTop: -4, marginBottom: 8 },
  primaryButton: { backgroundColor: '#2eaa51', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, elevation: 2 },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 6 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  kpiCard: { width: '48%', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1 },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  kpiLabel: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  kpiIcon: { padding: 4, borderRadius: 6 },
  kpiValue: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  kpiFooter: { flexDirection: 'row', alignItems: 'center' },
  kpiFooterText: { fontSize: 10, marginLeft: 4, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: '#111827',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  modalBtnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  modalBtnCancelText: { color: '#374151', fontWeight: '600' },
  modalBtnSave: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  modalBtnSaveText: { color: '#fff', fontWeight: '600' },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  photoBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  photoModalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  photoCloseButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
