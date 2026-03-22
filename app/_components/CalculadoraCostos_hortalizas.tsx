import React, { useEffect, useState } from 'react';
import { 
  Alert,
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, SafeAreaView,
  Modal,
  FlatList
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { crearGastoApi, GastoApi, obtenerGastosPorLoteApi, actualizarGastoApi, eliminarGastoApi } from '@/src/services/api';

type Fase = 'Siembra' | 'Crecimiento' | 'Cosecha';
type UnidadCantidad = 'kg' | 'qq';
type UnidadPrecio = 'bskg' | 'bsqq';

const KG_POR_QUINTAL = 46;

type Gasto = {
  id: string;
  fase: Fase;
  categoria: string;
  descripcion: string;
  cantidad: string;
  monto: string;
};

type FormGasto = {
  categoria: string;
  descripcion: string;
  cantidad: string;
  monto: string;
};

type GastoEnEdicion = Gasto & { id_gasto?: number };

// --- DATOS DE CATEGORÍAS SEGÚN FASE ---
const CATEGORIAS_POR_FASE: Record<Fase, string[]> = {
  Siembra: [
    'Alquiler de Terreno', 'Semillas', 'Maquinaria para Roturar', 
    'Maquinaria para Siembra', 'Mano de obra para roturar', 
    'Mano de obra para siembra', 'Herramientas', 'Otros'
  ],
  Crecimiento: [
    'Abonos', 'Pesticidas', 'Agua/Riego', 'Fertilizantes químicos', 
    'Fertilizantes orgánicos', 'Mano de obra para labores culturales', 
    'Herramientas', 'Otros'
  ],
  Cosecha: [
    'Maquinaria para Cosecha', 'Mano de obra para cosecha', 
    'Transporte', 'Herramientas', 'Otros'
  ]
};

type CalculadoraCostosProps = {
  onBack?: () => void;
  idLote?: number;
};

export default function CalculadoraCostos_Hortalizas({ onBack, idLote }: CalculadoraCostosProps) {

  //  ESTADOS -
  const [fase, setFase] = useState<Fase>('Siembra');
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [modalCategoria, setModalCategoria] = useState(false);
  
  // Estado del formulario de gastos
  const [formGasto, setFormGasto] = useState<FormGasto>({
    categoria: '', descripcion: '', cantidad: '', monto: ''
  });

  // Estado de producción editable
  const [produccion, setProduccion] = useState({
    cantidad: '0', precio: '0'
  });
  const [unidadCantidad, setUnidadCantidad] = useState<UnidadCantidad>('kg');
  const [unidadPrecio, setUnidadPrecio] = useState<UnidadPrecio>('bskg');
  const [modalUnidadCantidad, setModalUnidadCantidad] = useState(false);
  const [modalUnidadPrecio, setModalUnidadPrecio] = useState(false);

  // Modal de edición
  const [modalEdicion, setModalEdicion] = useState(false);
  const [gastoEnEdicion, setGastoEnEdicion] = useState<GastoEnEdicion | null>(null);
  const [formEdicion, setFormEdicion] = useState<FormGasto>({
    categoria: '', descripcion: '', cantidad: '', monto: ''
  });

  // --- CÁLCULOS EN TIEMPO REAL ---
  const totalCostos = gastos.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);
  const qtyIngresada = parseFloat(produccion.cantidad) || 0;
  const precioIngresado = parseFloat(produccion.precio) || 0;

  const qtyProducidaKg = unidadCantidad === 'kg'
    ? qtyIngresada
    : qtyIngresada * KG_POR_QUINTAL;
  const precioVentaKg = unidadPrecio === 'bskg'
    ? precioIngresado
    : precioIngresado / KG_POR_QUINTAL;

  const equivalenciaTexto = unidadCantidad === 'qq'
    ? `= ${(qtyProducidaKg || 0).toFixed(2)} kg`
    : `= ${((qtyProducidaKg || 0) / KG_POR_QUINTAL).toFixed(2)} qq`;
  
  const costoPorKg = qtyProducidaKg > 0 ? totalCostos / qtyProducidaKg : 0;
  const ingresosTotales = qtyProducidaKg * precioVentaKg;
  const gananciaNeta = ingresosTotales - totalCostos;
  const margenGanancia = ingresosTotales > 0 ? (gananciaNeta / ingresosTotales) * 100 : 0;
  const puntoEquilibrio = precioVentaKg > 0 ? totalCostos / precioVentaKg : 0;
  const puntoEquilibrioKg = Math.ceil(puntoEquilibrio);
  const esRentable = gananciaNeta >= 0;

  // Cálculos para el gráfico (Escenarios)
  const escenarios = [
    { 
      nombre: 'Pesimista', 
      ingresos: ingresosTotales * 0.7, 
      costos: totalCostos, 
      ganancia: (ingresosTotales * 0.7) - totalCostos 
    },
    { 
      nombre: 'Realista', 
      ingresos: ingresosTotales, 
      costos: totalCostos, 
      ganancia: gananciaNeta 
    },
    { 
      nombre: 'Optimista', 
      ingresos: ingresosTotales * 1.3, 
      costos: totalCostos, 
      ganancia: (ingresosTotales * 1.3) - totalCostos 
    }
  ];
  const maxGrafico = Math.max(ingresosTotales * 1.3, totalCostos, 100);

  const inferirFaseDesdeApi = (gasto: GastoApi): Fase => {
    if (CATEGORIAS_POR_FASE.Cosecha.includes(gasto.categoria)) return 'Cosecha';
    if (CATEGORIAS_POR_FASE.Crecimiento.includes(gasto.categoria)) return 'Crecimiento';
    if (CATEGORIAS_POR_FASE.Siembra.includes(gasto.categoria)) return 'Siembra';
    return gasto.tipo_costo === 'FIJO' ? 'Siembra' : 'Crecimiento';
  };

  const cargarGastosDelLote = async () => {
    const loteDestino = idLote ?? 1;
    try {
      const gastosApi = await obtenerGastosPorLoteApi(loteDestino);
      const gastosMapeados: Gasto[] = gastosApi.map((gasto) => ({
        id: String(gasto.id_gasto),
        fase: inferirFaseDesdeApi(gasto),
        categoria: gasto.categoria,
        descripcion: gasto.descripcion || '',
        cantidad: String(gasto.cantidad ?? ''),
        monto: String(gasto.monto_total ?? 0),
      }));
      setGastos(gastosMapeados);
    } catch (error) {
      console.warn('No se pudieron cargar gastos del lote desde backend:', error);
      setGastos([]);
    }
  };

  // Cargar gastos al iniciar y guardar automático al desmontar
  useEffect(() => {
    cargarGastosDelLote();
    
    // Cleanup: guardar cuando se sale de la pantalla
    return () => {
      console.log('Pantalla de calculadora cerrándose - gastos sincronizados con BD');
    };
  }, [idLote]);

  // FUNCIONES PARA MANEJO DE GASTOS -
  const cambiarFase = (nuevaFase: Fase) => {
    setFase(nuevaFase);
    setFormGasto({ ...formGasto, categoria: '' }); // Resetear categoría al cambiar fase
  };

  const agregarGasto = async () => {
    if (!formGasto.categoria || !formGasto.monto) {
      Alert.alert('Datos incompletos', 'Por favor selecciona una categoría e ingresa un monto.');
      return;
    }

    const cantidad = Number(formGasto.cantidad || '1');
    const monto = Number(formGasto.monto);
    if (!cantidad || cantidad <= 0 || !monto || monto <= 0) {
      Alert.alert('Datos inválidos', 'Cantidad y monto deben ser mayores a cero.');
      return;
    }

    const costoUnitario = monto / cantidad;
    const loteDestino = idLote ?? 1;

    try {
      await crearGastoApi({
        id_lote: loteDestino,
        categoria: formGasto.categoria,
        descripcion: formGasto.descripcion,
        cantidad,
        costo_unitario: costoUnitario,
        tipo_costo: fase === 'Siembra' ? 'FIJO' : 'VARIABLE',
        modalidad_pago: 'CICLO',
      });
      setFormGasto({ categoria: '', descripcion: '', cantidad: '', monto: '' });
      await cargarGastosDelLote();
      Alert.alert('Listo', 'Gasto registrado y guardado en la base de datos.');
    } catch (error) {
      console.warn('No se pudo registrar gasto en backend:', error);
      Alert.alert('Sin conexión', 'No se pudo guardar el gasto en la base de datos. Intenta nuevamente.');
    }
  };

  const eliminarGasto = async (id: string) => {
    Alert.alert(
      'Eliminar Gasto',
      '¿Estás seguro que quieres eliminar este gasto?',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Eliminar',
          onPress: async () => {
            try {
              const idGastoNum = parseInt(id);
              if (!isNaN(idGastoNum)) {
                await eliminarGastoApi(idGastoNum);
              }
              setGastos(gastos.filter(g => g.id !== id));
              Alert.alert('Eliminado', 'Gasto eliminado de la base de datos.');
              await cargarGastosDelLote();
            } catch (error) {
              console.warn('Error al eliminar gasto:', error);
              Alert.alert('Error', 'No se pudo eliminar el gasto de la base de datos.');
              setGastos(gastos.filter(g => g.id !== id));
              await cargarGastosDelLote();
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const editarGasto = (gasto: Gasto) => {
    setGastoEnEdicion(gasto as GastoEnEdicion);
    setFormEdicion({
      categoria: gasto.categoria,
      descripcion: gasto.descripcion,
      cantidad: gasto.cantidad,
      monto: gasto.monto
    });
    setModalEdicion(true);
  };

  const guardarEdicion = async () => {
    if (!formEdicion.categoria || !formEdicion.monto || !gastoEnEdicion) {
      Alert.alert('Datos incompletos', 'Por favor completa todos los campos obligatorios.');
      return;
    }

    const cantidad = Number(formEdicion.cantidad || '1');
    const monto = Number(formEdicion.monto);
    if (!cantidad || cantidad <= 0 || !monto || monto <= 0) {
      Alert.alert('Datos inválidos', 'Cantidad y monto deben ser mayores a cero.');
      return;
    }

    const costoUnitario = monto / cantidad;
    const idGastoNum = parseInt(gastoEnEdicion.id);

    try {
      if (!isNaN(idGastoNum)) {
        await actualizarGastoApi(idGastoNum, {
          categoria: formEdicion.categoria,
          descripcion: formEdicion.descripcion,
          cantidad,
          costo_unitario: costoUnitario,
          tipo_costo: gastoEnEdicion.fase === 'Siembra' ? 'FIJO' : 'VARIABLE',
          modalidad_pago: 'CICLO',
        });
      }
      
      setModalEdicion(false);
      setGastoEnEdicion(null);
      await cargarGastosDelLote();
      Alert.alert('Actualizado', 'Gasto actualizado correctamente en la base de datos.');
    } catch (error) {
      console.warn('Error al actualizar gasto:', error);
      Alert.alert('Sin conexión', 'No se pudo actualizar el gasto en la base de datos. Intenta nuevamente.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color="#4b5563" />
            <Text style={styles.backText}>Volver a Lotes</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Calculadora de Costos de Hortalizas</Text>
              <Text style={styles.subtitle}>Calcula tus gastos, ganancias y punto de equilibrio</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Q-2025</Text></View>
          </View>
        </View>

        {/* 1. TARJETAS DE RESULTADOS (KPIs) */}
        <View style={styles.greenCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="receipt-outline" size={18} color="#ecfdf5" />
            <Text style={styles.cardHeaderTitle}>Gastos totales</Text>
          </View>
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statLabel}>Total Costos</Text>
              <Text style={styles.statValue}>Bs {totalCostos.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View>
              <Text style={styles.statLabel}>Costo por Kilogramo</Text>
              <Text style={styles.statValue}>Bs {costoPorKg.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.yellowCard}>
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statLabelYellow}>Ingresos Totales</Text>
              <Text style={styles.statValue}>Bs {ingresosTotales.toFixed(2)}</Text>
            </View>
            <View style={styles.dividerYellow} />
            <View>
              <Text style={styles.statLabelYellow}>Ganancia Neta</Text>
              <View style={styles.rowCenter}>
                <Text style={styles.statValue}>Bs {gananciaNeta.toFixed(2)}</Text>
                {gananciaNeta > 0 && <Ionicons name="trending-up" size={20} color="#fff" style={{ marginLeft: 5 }} />}
              </View>
            </View>
          </View>
        </View>

        <View style={[
          styles.recommendationCard,
          !esRentable && styles.recommendationCardRed
        ]}>
          <View style={styles.recommendationHeader}>
            <Ionicons
              name={esRentable ? 'happy-outline' : 'alert-circle-outline'}
              size={24}
              color={esRentable ? '#16a34a' : '#dc2626'}
            />
            <Text style={[styles.recommendationTitle, !esRentable && styles.recommendationTitleRed]}>
              {esRentable ? '¡Excelente! Te conviene vender' : 'Atención: revisa tu precio de venta'}
            </Text>
          </View>

          <Text style={[styles.recommendationText, !esRentable && styles.recommendationTextRed]}>
            {esRentable
              ? 'Tu precio de venta cubre muy bien tus gastos de producción. ¡Vas a ganar bien!'
              : 'Con el precio actual no alcanzas a cubrir los costos. Sube el precio o reduce gastos.'}
          </Text>

          <View style={[styles.recommendationInfoBox, !esRentable && styles.recommendationInfoBoxRed]}>
            <Text style={styles.recommendationInfoText}>
              💡 <Text style={styles.recommendationInfoStrong}>¡Buenas noticias!</Text>{' '}
              Solo necesitas vender{' '}
              <Text style={styles.recommendationInfoStrong}>{puntoEquilibrioKg} kg</Text>{' '}
              para recuperar toda tu inversión.
              {esRentable ? ' ¡El resto es ganancia pura! 🎯' : ''}
            </Text>
          </View>
        </View>

        {/* MARGEN Y PUNTO DE EQUILIBRIO (Móvil) */}
        <View style={styles.row}>
          <View style={[styles.card, {flex: 1, marginRight: 8, alignItems: 'center'}]}>
            <Text style={styles.cardSubtitle}>Margen Ganancia</Text>
            <Text style={[styles.statValue, {color: '#2eaa51', fontSize: 22}]}>{margenGanancia.toFixed(1)}%</Text>
          </View>
          <View style={[styles.card, {flex: 1, marginLeft: 8, alignItems: 'center'}]}>
            <Text style={styles.cardSubtitle}>Punto Equilibrio</Text>
            <Text style={[styles.statValue, {color: '#1f2937', fontSize: 22}]}>{Math.ceil(puntoEquilibrio)} kg</Text>
          </View>
        </View>
              
        {/* 2. FORMULARIO REGISTRAR GASTOS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Registrar Gastos</Text>
          <Text style={styles.cardSubtitle}>Organiza tus gastos por fase del cultivo</Text>

          {/* Fases */}
          <View style={styles.phaseContainer}>
            {(['Siembra', 'Crecimiento', 'Cosecha'] as Fase[]).map((f) => (
              <TouchableOpacity 
                key={f}
                style={[styles.phaseBtn, fase === f && styles.phaseBtnActive]}
                onPress={() => cambiarFase(f)}
              >
                <MaterialCommunityIcons 
                  name={f === 'Siembra' ? 'sprout' : f === 'Crecimiento' ? 'trending-up' : 'basket-outline'} 
                  size={24} color={fase === f ? '#2eaa51' : '#9ca3af'} 
                />
                <Text style={[styles.phaseText, fase === f && styles.phaseTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Dropdown para Categoría */}
          <Text style={styles.inputLabel}>Categoría</Text>
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => setModalCategoria(true)}
          >
            <Text style={{color: formGasto.categoria ? '#1f2937' : '#9ca3af'}}>
              {formGasto.categoria || 'Selecciona una categoría'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Descripción (Opcional)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="sfasdfdas" 
            value={formGasto.descripcion}
            onChangeText={(t) => setFormGasto({...formGasto, descripcion: t})}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.inputLabel}>Cantidad</Text>
              <TextInput 
                style={styles.input} placeholder="0" keyboardType="numeric" 
                value={formGasto.cantidad}
                onChangeText={(t) => setFormGasto({...formGasto, cantidad: t})}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Monto (Bs)</Text>
              <TextInput 
                style={styles.input} placeholder="0.00" keyboardType="numeric" 
                value={formGasto.monto}
                onChangeText={(t) => setFormGasto({...formGasto, monto: t})}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={agregarGasto}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Agregar Gasto</Text>
          </TouchableOpacity>
        </View>

        {/* 3. LISTA DE GASTOS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lista de Gastos</Text>
          <Text style={styles.cardSubtitle}>{gastos.length} gastos registrados</Text>
          
          {gastos.length === 0 && <Text style={{color: '#9ca3af', textAlign: 'center'}}>No hay gastos aún.</Text>}

          {gastos.map((gasto, index) => (
            <View key={gasto.id}>
              <View style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowCenter}>
                    <Text style={styles.itemTitle}>{gasto.categoria}</Text>
                    <View style={styles.tagGreen}>
                      <Text style={styles.tagTextGreen}>{gasto.fase}</Text>
                    </View>
                  </View>
                  {gasto.descripcion ? <Text style={styles.itemSub}>{gasto.descripcion}</Text> : null}
                </View>
                <Text style={styles.itemPrice}>Bs {parseFloat(gasto.monto).toFixed(2)}</Text>
                <TouchableOpacity style={styles.editBtn} onPress={() => editarGasto(gasto)}>
                  <Ionicons name="pencil-outline" size={18} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => eliminarGasto(gasto.id)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
              {index < gastos.length - 1 && <View style={styles.listDivider} />}
            </View>
          ))}
        </View>

        {/* 4. DATOS DE PRODUCCIÓN */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos de Producción</Text>
          <View style={{ marginTop: 10 }}>
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.inputLabel}>Cantidad Producida</Text>
              <View style={styles.inputWithUnitRow}>
                <TextInput 
                  style={[styles.input, styles.inputCompact]} keyboardType="numeric"
                  value={produccion.cantidad}
                  onChangeText={(t) => setProduccion({...produccion, cantidad: t})}
                />
                <TouchableOpacity
                  style={styles.unitPickerBtn}
                  onPress={() => setModalUnidadCantidad(true)}
                >
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
                  style={[styles.input, styles.inputCompact]} keyboardType="numeric"
                  value={produccion.precio}
                  onChangeText={(t) => setProduccion({...produccion, precio: t})}
                />
                <TouchableOpacity
                  style={styles.unitPickerBtnWide}
                  onPress={() => setModalUnidadPrecio(true)}
                >
                  <Text style={styles.unitPickerText}>{unidadPrecio === 'bskg' ? 'Bs/kg' : 'Bs/qq'}</Text>
                  <Ionicons name="chevron-down" size={10} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* 5. GRÁFICO DE PROYECCIÓN DE INGRESOS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Proyección de Ingresos</Text>
          <Text style={styles.cardSubtitle}>Pesimista (70%) | Realista (100%) | Optimista (130%)</Text>
          
          <View style={styles.chartContainer}>
            {/* Eje Y simplificado */}
            <View style={styles.chartYAxis}>
              <Text style={styles.chartYText}>{Math.round(maxGrafico)}</Text>
              <Text style={styles.chartYText}>{Math.round(maxGrafico / 2)}</Text>
              <Text style={styles.chartYText}>0</Text>
            </View>
            
            {/* Barras */}
            <View style={styles.chartBarsContainer}>
              {escenarios.map((esc, index) => (
                <View key={index} style={styles.chartGroup}>
                  {/* Ingresos (Verde) */}
                  <View style={[styles.bar, {height: (esc.ingresos / maxGrafico) * 150, backgroundColor: '#2eaa51'}]} />
                  {/* Costos (Rojo) */}
                  <View style={[styles.bar, {height: (esc.costos / maxGrafico) * 150, backgroundColor: '#ef4444'}]} />
                  {/* Ganancia (Amarillo) */}
                  <View style={[styles.bar, {height: (Math.max(esc.ganancia, 0) / maxGrafico) * 150, backgroundColor: '#fbbf24'}]} />
                  
                  <Text style={styles.chartLabel}>{esc.nombre}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Leyenda */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#2eaa51'}]}/><Text style={styles.legendText}>Ingresos</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#ef4444'}]}/><Text style={styles.legendText}>Costos</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor: '#fbbf24'}]}/><Text style={styles.legendText}>Ganancia Neta</Text></View>
          </View>
        </View>

      </ScrollView>

      {/* MODAL PARA SELECCIONAR CATEGORÍA */}
      <Modal visible={modalCategoria} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona una Categoría</Text>
            <Text style={styles.modalSub}>Fase actual: {fase}</Text>
            <FlatList
              data={CATEGORIAS_POR_FASE[fase]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.modalItem}
                  onPress={() => {
                    setFormGasto({...formGasto, categoria: item});
                    setModalCategoria(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalCategoria(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalUnidadCantidad} animationType="fade" transparent={true}>
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

      <Modal visible={modalUnidadPrecio} animationType="fade" transparent={true}>
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

      {/* MODAL PARA EDITAR GASTO */}
      <Modal visible={modalEdicion} animationType="slide" transparent={true}>
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
                <>
                  <View style={styles.card}>
                    <Text style={styles.inputLabel}>Categoría</Text>
                    <TouchableOpacity 
                      style={styles.dropdownButton}
                      onPress={() => setModalCategoria(true)}
                    >
                      <Text style={{color: formEdicion.categoria ? '#1f2937' : '#9ca3af'}}>
                        {formEdicion.categoria || 'Selecciona una categoría'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#9ca3af" />
                    </TouchableOpacity>

                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.inputLabel}>Cantidad</Text>
                        <TextInput 
                          style={styles.input} placeholder="0" keyboardType="numeric" 
                          value={formEdicion.cantidad}
                          onChangeText={(t) => setFormEdicion({...formEdicion, cantidad: t})}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Monto (Bs)</Text>
                        <TextInput 
                          style={styles.input} placeholder="0.00" keyboardType="numeric" 
                          value={formEdicion.monto}
                          onChangeText={(t) => setFormEdicion({...formEdicion, monto: t})}
                        />
                      </View>
                    </View>

                    <TouchableOpacity style={styles.primaryButton} onPress={guardarEdicion}>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                      <Text style={styles.primaryButtonText}>Guardar Cambios</Text>
                    </TouchableOpacity>
                  </View>
                </>
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
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { marginBottom: 20, marginTop: 10 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { color: '#4b5563', fontSize: 14, fontWeight: '500', marginLeft: 6 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  badge: { backgroundColor: '#2eaa51', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  
  // Tarjetas financieras
  greenCard: { backgroundColor: '#3b9f46', borderRadius: 16, padding: 20, marginBottom: 12 },
  yellowCard: { backgroundColor: '#eab308', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardHeaderTitle: { color: '#ecfdf5', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: '#bbf7d0', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statLabelYellow: { color: '#fef3c7', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statValue: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  divider: { width: 1, height: 40, backgroundColor: '#86efac', opacity: 0.5 },
  dividerYellow: { width: 1, height: 40, backgroundColor: '#fde68a', opacity: 0.5 },

  // Tarjeta de recomendación
  recommendationCard: {
    backgroundColor: '#eefbf2',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  recommendationCardRed: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  recommendationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  recommendationTitle: {
    marginLeft: 10,
    fontSize: 24,
    fontWeight: '800',
    color: '#06603a',
    flexShrink: 1,
  },
  recommendationTitleRed: {
    color: '#b91c1c',
  },
  recommendationText: {
    fontSize: 18,
    lineHeight: 27,
    color: '#055b36',
    marginBottom: 12,
  },
  recommendationTextRed: {
    color: '#7f1d1d',
  },
  recommendationInfoBox: {
    backgroundColor: '#ddeaff',
    borderWidth: 1,
    borderColor: '#b9cfff',
    borderRadius: 12,
    padding: 12,
  },
  recommendationInfoBoxRed: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  recommendationInfoText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1e3a8a',
  },
  recommendationInfoStrong: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
  
  // Tarjetas genéricas
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#f3f4f6', elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2, marginBottom: 16 },
  
  // Fases
  phaseContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  phaseBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginHorizontal: 4, backgroundColor: '#fff' },
  phaseBtnActive: { borderColor: '#2eaa51', backgroundColor: '#f0fdf4' },
  phaseText: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginTop: 4 },
  phaseTextActive: { color: '#2eaa51' },
  
  // Inputs
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1f2937', marginBottom: 16 },
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
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 16 },
  primaryButton: { backgroundColor: '#2eaa51', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10, marginTop: 4 },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  
  // Lista de gastos
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  listDivider: { height: 1, backgroundColor: '#f3f4f6' },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  itemSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: 'bold', color: '#2eaa51', marginRight: 12 },
  deleteBtn: { padding: 6, backgroundColor: '#fef2f2', borderRadius: 6 },
  tagGreen: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  tagTextGreen: { color: '#166534', fontSize: 10, fontWeight: 'bold' },
  editBtn: { padding: 6, backgroundColor: '#dbeafe', borderRadius: 6, marginRight: 8 },

  // Gráfico Nativo
  chartContainer: { flexDirection: 'row', height: 180, marginTop: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  chartYAxis: { justifyContent: 'space-between', paddingRight: 8, borderRightWidth: 1, borderRightColor: '#e5e7eb', paddingBottom: 20 },
  chartYText: { fontSize: 10, color: '#9ca3af' },
  chartBarsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingBottom: 20 },
  chartGroup: { flexDirection: 'row', alignItems: 'flex-end', width: 60, justifyContent: 'center' },
  bar: { width: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3, marginHorizontal: 1 },
  chartLabel: { position: 'absolute', bottom: -20, fontSize: 10, color: '#6b7280', width: 80, textAlign: 'center' },
  legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 2, marginRight: 4 },
  legendText: { fontSize: 11, color: '#4b5563' },

  // Modal Categorías
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  unitModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  unitOptionBtn: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  unitOptionText: { fontSize: 16, color: '#1f2937', fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#2eaa51', fontWeight: '600', marginBottom: 16 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalItemText: { fontSize: 16, color: '#4b5563' },
  modalCloseBtn: { marginTop: 20, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 10, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: 'bold', color: '#4b5563' }
});