import React, { useEffect, useState } from 'react';
import { 
  Alert,
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ModalRegistrarSiembra from './_components/ModalRegistrarSiembra_Quinua';
import CalculadoraCostos from './_components/CalculadoraCostos_quinua';
import {
  actualizarLoteLocal,
  actualizarLoteLocalPorServidor,
  eliminarLoteLocal,
  eliminarLoteLocalPorServidor,
  marcarLoteComoSincronizado,
  obtenerLotesLocales,
  obtenerLotesPendientesLocales,
} from '@/src/services/database';
import {
  actualizarLoteApi,
  crearLoteApi,
  eliminarLoteApi,
  obtenerGastosPorLoteApi,
  obtenerLotesPorProductoApi,
  subirFotoSiembraApi,
} from '@/src/services/api';

const formatearFecha = (iso) => {
  if (!iso) return 'N/D';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString('es-BO');
};

const calcularProgresoYCiclo = (fechaSiembraIso, fechaCosechaIso) => {
  const inicio = new Date(fechaSiembraIso);
  const fin = new Date(fechaCosechaIso);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio) {
    return { progreso: 45, faseActual: 'Crecimiento' };
  }

  const ahora = new Date();
  const total = fin.getTime() - inicio.getTime();
  const transcurrido = Math.min(Math.max(ahora.getTime() - inicio.getTime(), 0), total);

  let progreso = Math.round((transcurrido / total) * 100);
  progreso = Math.max(10, Math.min(progreso, 100));

  let faseActual = 'Siembra';
  if (progreso >= 70) faseActual = 'Cosecha';
  else if (progreso >= 35) faseActual = 'Crecimiento';

  return { progreso, faseActual };
};

export default function MisLotes_Quinua() {
  const [modalOpen, setModalOpen] = useState(false);
  const [mostrarCalculadora, setMostrarCalculadora] = useState(false);
  const [loteSeleccionadoId, setLoteSeleccionadoId] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [loteEditando, setLoteEditando] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [formEdicion, setFormEdicion] = useState({
    nombre: '',
    superficie: '',
  });

  const sincronizarLotesPendientes = async () => {
    const pendientes = await obtenerLotesPendientesLocales();
    if (!pendientes.length) return;

    for (const lote of pendientes) {
      try {
        const superficie = Number(lote.superficie || 0);
        const rendimiento = Number(lote.rendimiento_estimado || 0);
        const precio = Number(lote.precio_venta_est || 0);
        let fotoSiembraUrl = null;
        if (lote.foto_siembra_uri_local) {
          try {
            fotoSiembraUrl = await subirFotoSiembraApi(lote.foto_siembra_uri_local);
          } catch (errorFoto) {
            console.warn('No se pudo sincronizar foto de lote quinua, se sincroniza solo datos:', errorFoto);
          }
        }

        const loteServidor = await crearLoteApi({
          id_productor: 1,
          id_producto: lote.id_producto,
          nombre_lote: lote.nombre_lote,
          superficie: superficie > 0 ? superficie : 1,
          fecha_siembra: lote.fecha_siembra,
          fecha_cosecha_est: lote.fecha_cosecha_est,
          rendimiento_estimado: rendimiento > 0 ? rendimiento : 1,
          precio_venta_est: precio > 0 ? precio : 1,
          foto_siembra_url: fotoSiembraUrl,
          ubicacion: null,
          variedad: lote.variedad,
        });

        await marcarLoteComoSincronizado(lote.id_local, loteServidor.id_lote);
      } catch {
        // Si sigue sin red, se mantiene pendiente para el siguiente intento.
      }
    }
  };

  const cargarLotesLocales = async () => {
    const mapearLoteLocal = (item) => {
      const superficie = Number(item.superficie || 0);
      const rendimiento = Number(item.rendimiento_estimado || 0);
      const precio = Number(item.precio_venta_est || 0);
      const ingresoEstimado = rendimiento * precio;
      const { progreso, faseActual } = calcularProgresoYCiclo(item.fecha_siembra, item.fecha_cosecha_est);

      return {
        key: item.id_servidor ? `srv-${item.id_servidor}` : `local-${item.id_local}`,
        id: item.id_servidor || item.id_local,
        idLocal: item.id_local,
        idServidor: item.id_servidor,
        idProducto: item.id_producto,
        codigo: item.id_servidor ? `Q-BD-${item.id_servidor}` : `Q-LOCAL-${item.id_local}`,
        nombre: item.nombre_lote || `Lote ${item.id_local}`,
        producto: 'Quinua',
        tipoProducto: item.variedad || 'Quinua Real',
        imagen: item.foto_siembra_uri_local || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800',
        imagenRemota: item.foto_siembra_uri_local || null,
        area: superficie,
        comunidad: 'Comunidad registrada',
        fechaSiembra: formatearFecha(item.fecha_siembra),
        cosechaEstimada: formatearFecha(item.fecha_cosecha_est),
        fechaSiembraIso: item.fecha_siembra,
        fechaCosechaIso: item.fecha_cosecha_est,
        rendimientoEstimado: rendimiento > 0 ? rendimiento : 1,
        precioVentaEst: precio > 0 ? precio : 1,
        progreso,
        estado: item.estado_sincronizacion === 'SINCRONIZADO' ? 'En Crecimiento' : 'Pendiente Sync',
        estadoColor: item.estado_sincronizacion === 'SINCRONIZADO' ? '#2eaa51' : '#f59e0b',
        faseActual,
        estadoRaw: item.estado_sincronizacion === 'SINCRONIZADO' ? 'ACTIVO' : 'ACTIVO',
        inversion: 0,
        ingresoEstimado,
        proyeccion: ingresoEstimado,
        mostrarCosecha: false,
      };
    };

    const mapearLoteBackend = (item) => {
      const superficie = Number(item.superficie || 0);
      const rendimiento = Number(item.rendimiento_estimado || 0);
      const precio = Number(item.precio_venta_est || 0);
      const ingresoEstimado = rendimiento * precio;
      const { progreso, faseActual } = calcularProgresoYCiclo(item.fecha_siembra, item.fecha_cosecha_est);

      return {
        key: `srv-${item.id_lote}`,
        id: item.id_lote,
        idLocal: null,
        idServidor: item.id_lote,
        idProducto: item.id_producto,
        codigo: `Q-BD-${item.id_lote}`,
        nombre: item.nombre_lote || `Lote ${item.id_lote}`,
        producto: 'Quinua',
        tipoProducto: item.variedad || 'Quinua Real',
        imagen: item.foto_siembra_url || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800',
        imagenRemota: item.foto_siembra_url || null,
        area: superficie,
        comunidad: item.ubicacion || 'Comunidad registrada',
        fechaSiembra: formatearFecha(item.fecha_siembra),
        cosechaEstimada: formatearFecha(item.fecha_cosecha_est),
        fechaSiembraIso: item.fecha_siembra,
        fechaCosechaIso: item.fecha_cosecha_est,
        rendimientoEstimado: rendimiento > 0 ? rendimiento : 1,
        precioVentaEst: precio > 0 ? precio : 1,
        progreso,
        estado: item.estado || 'En Crecimiento',
        estadoColor: '#2eaa51',
        faseActual,
        estadoRaw: item.estado || 'ACTIVO',
        inversion: 0,
        ingresoEstimado,
        proyeccion: ingresoEstimado,
        mostrarCosecha: false,
      };
    };

    const enriquecerConGastos = async (lotesBase) => {
      return Promise.all(
        lotesBase.map(async (lote) => {
          if (!lote.idServidor) return lote;

          try {
            const gastos = await obtenerGastosPorLoteApi(lote.idServidor);
            const inversion = gastos.reduce((acc, gasto) => acc + (Number(gasto.monto_total) || 0), 0);
            return {
              ...lote,
              inversion,
              proyeccion: (lote.ingresoEstimado || 0) - inversion,
            };
          } catch {
            return lote;
          }
        })
      );
    };

    try {
      await sincronizarLotesPendientes();

      const [datosLocales, datosBackend] = await Promise.all([
        obtenerLotesLocales(),
        obtenerLotesPorProductoApi(1),
      ]);

      const locales = Array.isArray(datosLocales)
        ? datosLocales.filter((item) => item.id_producto === 1)
        : [];

      const remotos = Array.isArray(datosBackend) ? datosBackend : [];
      const idsRemotos = new Set(remotos.map((item) => item.id_lote));
      const localesSinDuplicado = locales.filter((item) => !item.id_servidor || !idsRemotos.has(item.id_servidor));

      const combinados = [...remotos.map(mapearLoteBackend), ...localesSinDuplicado.map(mapearLoteLocal)];
      const combinadosConGastos = await enriquecerConGastos(combinados);
      setLotes(combinadosConGastos);
    } catch (error) {
      console.warn('No se pudieron cargar lotes de quinua desde backend, usando local:', error);

      try {
        const datosLocales = await obtenerLotesLocales();
        const locales = Array.isArray(datosLocales)
          ? datosLocales.filter((item) => item.id_producto === 1)
          : [];
        const localesMapeados = locales.map(mapearLoteLocal);
        const localesConGastos = await enriquecerConGastos(localesMapeados);
        setLotes(localesConGastos);
      } catch (localError) {
        console.warn('No se pudieron cargar lotes locales de quinua:', localError);
        setLotes([]);
      }
    }
  };

  useEffect(() => {
    cargarLotesLocales();
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      cargarLotesLocales();
    }
  }, [modalOpen]);

  const manejarCreacionLote = async () => {
    await cargarLotesLocales();
  };

  const abrirModalEdicion = (lote) => {
    setLoteEditando(lote);
    setFormEdicion({
      nombre: lote.nombre || '',
      superficie: String(lote.area || ''),
    });
    setModalEditarOpen(true);
  };

  const guardarEdicionLote = async () => {
    if (!loteEditando) return;

    const nombre = formEdicion.nombre.trim();
    const superficie = Number(formEdicion.superficie);
    if (!nombre || !superficie || superficie <= 0) {
      Alert.alert('Datos inválidos', 'Ingresa nombre y superficie válida.');
      return;
    }

    setGuardandoEdicion(true);
    try {
      if (loteEditando.idServidor) {
        await actualizarLoteApi(loteEditando.idServidor, {
          nombre_lote: nombre,
          superficie,
          fecha_siembra: loteEditando.fechaSiembraIso,
          fecha_cosecha_est: loteEditando.fechaCosechaIso,
          rendimiento_estimado: loteEditando.rendimientoEstimado,
          precio_venta_est: loteEditando.precioVentaEst,
          estado: loteEditando.estadoRaw || 'ACTIVO',
          foto_siembra_url: loteEditando.imagenRemota,
          ubicacion: loteEditando.comunidad === 'Comunidad registrada' ? null : loteEditando.comunidad,
          variedad: loteEditando.tipoProducto,
          id_productor: 1,
          id_producto: loteEditando.idProducto || 1,
        });
      }

      if (loteEditando.idLocal) {
        await actualizarLoteLocal(loteEditando.idLocal, {
          nombre_lote: nombre,
          superficie,
        });
      } else if (loteEditando.idServidor) {
        await actualizarLoteLocalPorServidor(loteEditando.idServidor, {
          nombre_lote: nombre,
          superficie,
        });
      }

      setModalEditarOpen(false);
      setLoteEditando(null);
      await cargarLotesLocales();
      Alert.alert('Listo', 'Lote actualizado correctamente.');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo actualizar el lote';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const eliminarLote = (lote) => {
    Alert.alert('Eliminar lote', `¿Seguro que quieres eliminar "${lote.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            if (lote.idServidor) {
              await eliminarLoteApi(lote.idServidor);
            }

            if (lote.idLocal) {
              await eliminarLoteLocal(lote.idLocal);
            } else if (lote.idServidor) {
              await eliminarLoteLocalPorServidor(lote.idServidor);
            }

            await cargarLotesLocales();
            Alert.alert('Listo', 'Lote eliminado correctamente.');
          } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'No se pudo eliminar el lote';
            Alert.alert('Error', mensaje);
          }
        },
      },
    ]);
  };

  const stats = {
    lotesActivos: lotes.length,
    areaTotal: lotes.reduce((acc, lote) => acc + Number(lote.area || 0), 0),
    inversionTotal: lotes.reduce((acc, lote) => acc + Number(lote.inversion || 0), 0),
    ingresosProyectados: lotes.reduce((acc, lote) => acc + Number(lote.proyeccion || 0), 0),
  };

  if (mostrarCalculadora) {
    return (
      <CalculadoraCostos
        idLote={loteSeleccionadoId ?? undefined}
        onBack={async () => {
          setMostrarCalculadora(false);
          await cargarLotesLocales();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Mis Lotes de Quinua</Text>
            <Text style={styles.subtitle}>Gestiona tus cultivos de quinua, costos y proyecciones</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => setModalOpen(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Registrar Siembra</Text>
          </TouchableOpacity>
        </View>

        {/* KPI CARDS (2x2 Grid) */}
        <View style={styles.kpiGrid}>
          {/* Lotes Activos */}
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
              <Text style={[styles.kpiFooterText, { color: '#2eaa51' }]}>En producción</Text>
            </View>
          </View>

          {/* Área Total */}
          <View style={[styles.kpiCard, { backgroundColor: '#eef4ff', borderColor: '#dbeafe' }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>Área Total</Text>
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

          {/* Inversión Total */}
          <View style={[styles.kpiCard, { backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>Inversión Total</Text>
              <View style={[styles.kpiIcon, { backgroundColor: '#ffedd5' }]}>
                <Ionicons name="wallet-outline" size={18} color="#f97316" />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: '#f97316', fontSize: 18 }]}>Bs {stats.inversionTotal.toLocaleString('es-BO')}</Text>
            <View style={styles.kpiFooter}>
              <Text style={[styles.kpiFooterText, { color: '#f97316' }]}>Gastos acumulados</Text>
            </View>
          </View>

          {/* Ingresos Proyectados */}
          <View style={[styles.kpiCard, { backgroundColor: '#f5f3ff', borderColor: '#ede9fe' }]}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiLabel}>Proyectado</Text>
              <View style={[styles.kpiIcon, { backgroundColor: '#ede9fe' }]}>
                <Ionicons name="cash-outline" size={18} color="#8b5cf6" />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: '#8b5cf6', fontSize: 18 }]}>Bs {stats.ingresosProyectados.toLocaleString('es-BO')}</Text>
            <View style={styles.kpiFooter}>
              <Text style={[styles.kpiFooterText, { color: '#8b5cf6' }]}>Estimación total</Text>
            </View>
          </View>
        </View>

        {/* LISTA DE LOTES */}
        {lotes.map((lote) => (
          <View key={lote.key} style={styles.loteCard}>
            
            {/* Imagen Header */}
            <View style={styles.loteImageContainer}>
              <Image source={{ uri: lote.imagen }} style={styles.loteImage} />
              <View style={styles.loteImageOverlay} />
              
              <View style={[styles.badge, { backgroundColor: lote.estadoColor }]}>
                <Text style={styles.badgeText}>{lote.estado}</Text>
              </View>
              
              <View style={styles.codigoContainer}>
                <Text style={styles.codigoText}>{lote.codigo}</Text>
              </View>
            </View>

            {/* Contenido Lote */}
            <View style={styles.loteContent}>
              <Text style={styles.loteNombre}>{lote.nombre}</Text>
              <Text style={styles.loteCultivo}>Producto: {lote.producto}</Text>
              <Text style={styles.loteCultivo}>Tipo: {lote.tipoProducto}</Text>

              <View style={styles.detallesGrid}>
                <View style={styles.detalleRow}>
                  <Ionicons name="share-social-outline" size={14} color="#3b82f6" />
                  <Text style={styles.detalleText}>Área: {lote.area} Ha</Text>
                </View>
                <View style={styles.detalleRow}>
                  <Ionicons name="location-outline" size={14} color="#2eaa51" />
                  <Text style={styles.detalleText}>{lote.comunidad}</Text>
                </View>
                <View style={styles.detalleRow}>
                  <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
                  <Text style={styles.detalleText}>Siembra: {lote.fechaSiembra}</Text>
                </View>
                <View style={styles.detalleRow}>
                  <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
                  <Text style={styles.detalleText}>Cosecha est: {lote.cosechaEstimada}</Text>
                </View>
              </View>

              <View style={styles.progresoContainer}>
                <View style={styles.progresoHeader}>
                  <Text style={styles.progresoLabel}>Progreso del Ciclo</Text>
                  <Text style={[styles.progresoPorcentaje, { color: lote.estadoColor }]}>{lote.progreso}%</Text>
                </View>
                <View style={styles.progresoBarBg}>
                  <View style={[styles.progresoBarFill, { width: `${lote.progreso}%`, backgroundColor: lote.estadoColor }]} />
                </View>
                <Text style={styles.faseText}>Fase actual: {lote.faseActual}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.finanzasRow}>
                <View>
                  <Text style={styles.finanzasLabel}>Inversión</Text>
                  <Text style={styles.finanzasInversion}>Bs {lote.inversion.toLocaleString('es-BO')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.finanzasLabel}>Proyección</Text>
                  <Text style={styles.finanzasProyeccion}>Bs {lote.proyeccion.toLocaleString('es-BO')}</Text>
                </View>
              </View>

              {/* BOTONES DE ACCIÓN */}
              <View style={styles.accionesContainer}>
                <TouchableOpacity 
                  style={styles.btnGestionar}
                  onPress={() => {
                    if (!lote.idServidor) {
                      Alert.alert(
                        'Lote pendiente',
                        'Este lote aún no está sincronizado con backend. Sincroniza primero para ver gastos por lote.'
                      );
                      return;
                    }
                    setLoteSeleccionadoId(lote.idServidor);
                    setMostrarCalculadora(true);
                  }}
                >
                  <Ionicons name="share-social-outline" size={16} color="#fff" />
                  <Text style={styles.btnGestionarText}>Calcular</Text>
                </TouchableOpacity>

                <View style={styles.accionesSecundariasRow}>
                  <TouchableOpacity style={styles.btnEditar} onPress={() => abrirModalEdicion(lote)}>
                    <Ionicons name="create-outline" size={16} color="#2563eb" />
                    <Text style={styles.btnEditarText}>Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.btnEliminar} onPress={() => eliminarLote(lote)}>
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    <Text style={styles.btnEliminarText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>

                {lote.mostrarCosecha && (
                  <TouchableOpacity style={styles.btnCosecha}>
                    <Ionicons name="pencil" size={16} color="#fff" />
                    <Text style={styles.btnCosechaText}>Registrar Cosecha</Text>
                  </TouchableOpacity>
                )}
              </View>

            </View>
          </View>
        ))}

        <ModalRegistrarSiembra
          visible={modalOpen}
          onClose={() => {
            setModalOpen(false);
            cargarLotesLocales();
          }}
          onCreated={manejarCreacionLote}
        />

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

              <Text style={styles.modalLabel}>Superficie (Ha)</Text>
              <TextInput
                style={styles.modalInput}
                value={formEdicion.superficie}
                onChangeText={(t) => setFormEdicion({ ...formEdicion, superficie: t })}
                keyboardType="numeric"
                placeholder="0"
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
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fafafc' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20, marginTop: 10 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1f2937', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 16 },
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
  loteCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden', elevation: 2 },
  loteImageContainer: { height: 150, width: '100%', position: 'relative' },
  loteImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  loteImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  badge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  codigoContainer: { position: 'absolute', bottom: 12, left: 12 },
  codigoText: { color: '#fff', fontSize: 12, fontWeight: '600', textShadow: '-1px 1px 10px rgba(0, 0, 0, 0.75)' },
  loteContent: { padding: 16 },
  loteNombre: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 2 },
  loteCultivo: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  detallesGrid: { marginBottom: 16 },
  detalleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detalleText: { fontSize: 12, color: '#4b5563', marginLeft: 8 },
  progresoContainer: { marginBottom: 16 },
  progresoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progresoLabel: { fontSize: 12, color: '#4b5563' },
  progresoPorcentaje: { fontSize: 12, fontWeight: 'bold' },
  progresoBarBg: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, width: '100%', overflow: 'hidden' },
  progresoBarFill: { height: '100%', borderRadius: 3 },
  faseText: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 16 },
  finanzasRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  finanzasLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  finanzasInversion: { fontSize: 15, fontWeight: 'bold', color: '#ef4444' },
  finanzasProyeccion: { fontSize: 15, fontWeight: 'bold', color: '#2eaa51' },
  accionesContainer: { gap: 8 },
  accionesSecundariasRow: { flexDirection: 'row', gap: 8 },
  btnGestionar: { backgroundColor: '#2eaa51', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  btnGestionarText: { color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 6 },
  btnEditar: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnEditarText: { color: '#2563eb', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  btnEliminar: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnEliminarText: { color: '#dc2626', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  btnCosecha: { backgroundColor: '#f59e0b', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  btnCosechaText: { color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 6 },
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
});