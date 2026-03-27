import React, { useEffect, useState } from 'react';
import { 
  Alert,
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  crearGastoApi,
  GastoApi,
  obtenerGastosPorLoteApi,
  actualizarGastoApi,
  eliminarGastoApi,
  registrarProduccionLoteApi,
  obtenerUltimaProduccionLoteApi,
} from '@/src/services/api';
import {
  guardarCostoLocal,
  obtenerCostosLocalesPorLote,
  eliminarCostoLocal,
  actualizarCostoLocal,
  guardarBorradorProduccionLocal,
  obtenerBorradorProduccionLocal,
} from '@/src/services/database';

type Fase = 'Siembra' | 'Crecimiento' | 'Cosecha';
type UnidadCantidad = 'kg' | 'qq';
type UnidadPrecio = 'bskg' | 'bsqq';
type UnidadCategoria = 'ha' | 'kg' | 'hora' | 'jornal' | 'unidad' | 'viaje';

const KG_POR_QUINTAL = 46;

type GastoOrigen = 'API' | 'LOCAL';

type Gasto = {
  id: string;
  fase: Fase;
  categoria: string;
  descripcion: string;
  cantidad: string;
  monto: string;
  origen?: GastoOrigen;
  idLocal?: number;
  sincronizado?: boolean;
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

const UNIDAD_POR_CATEGORIA: Record<string, UnidadCategoria> = {
  'Alquiler de Terreno': 'ha',
  'Semillas': 'kg',
  'Maquinaria para Roturar': 'hora',
  'Maquinaria para Siembra': 'hora',
  'Mano de obra para roturar': 'jornal',
  'Mano de obra para siembra': 'jornal',
  'Abonos': 'kg',
  'Pesticidas': 'kg',
  'Agua/Riego': 'hora',
  'Fertilizantes químicos': 'kg',
  'Fertilizantes orgánicos': 'kg',
  'Mano de obra para labores culturales': 'jornal',
  'Maquinaria para Cosecha': 'hora',
  'Mano de obra para cosecha': 'jornal',
  'Transporte': 'viaje',
  'Herramientas': 'unidad',
  'Otros': 'unidad',
};

const CATEGORIAS_CANTIDAD_ENTERA = new Set<string>(['Herramientas', 'Transporte', 'Otros']);

const obtenerUnidadCategoria = (categoria: string): UnidadCategoria =>
  UNIDAD_POR_CATEGORIA[categoria] || 'unidad';

const sanitizarDecimal = (texto: string): string => {
  const conPunto = texto.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const partes = conPunto.split('.');
  if (partes.length <= 1) return partes[0];
  return `${partes[0]}.${partes.slice(1).join('')}`;
};

const sanitizarCantidadPorCategoria = (categoria: string, texto: string): string => {
  if (CATEGORIAS_CANTIDAD_ENTERA.has(categoria)) {
    return texto.replace(/\D/g, '');
  }
  return sanitizarDecimal(texto);
};

const validarCantidadPorCategoria = (
  categoria: string,
  cantidadTexto: string,
): { esValida: boolean; mensaje?: string; cantidad?: number } => {
  const cantidadLimpia = cantidadTexto.trim();
  const unidad = obtenerUnidadCategoria(categoria);

  if (!cantidadLimpia) {
    return { esValida: false, mensaje: `Ingresa una cantidad en ${unidad}.` };
  }

  const cantidad = Number(cantidadLimpia);
  if (Number.isNaN(cantidad) || cantidad <= 0) {
    return { esValida: false, mensaje: `La cantidad en ${unidad} debe ser mayor a cero.` };
  }

  if (CATEGORIAS_CANTIDAD_ENTERA.has(categoria) && !Number.isInteger(cantidad)) {
    return { esValida: false, mensaje: `La categoria ${categoria} solo permite cantidades enteras.` };
  }

  return { esValida: true, cantidad };
};

type CalculadoraCostosProps = {
  onBack?: () => void;
  idLoteServidor?: number;
  idLoteLocal?: number;
};

export default function CalculadoraCostos_Quinua({ onBack, idLoteServidor, idLoteLocal }: CalculadoraCostosProps) {
  const router = useRouter();

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
    cantidad: '', precio: ''
  });
  const [unidadCantidad, setUnidadCantidad] = useState<UnidadCantidad>('qq');
  const [unidadPrecio, setUnidadPrecio] = useState<UnidadPrecio>('bsqq');
  const [modalUnidadCantidad, setModalUnidadCantidad] = useState(false);
  const [modalUnidadPrecio, setModalUnidadPrecio] = useState(false);
  const [guardandoProduccion, setGuardandoProduccion] = useState(false);

  // Modal de edición
  const [modalEdicion, setModalEdicion] = useState(false);
  const [gastoEnEdicion, setGastoEnEdicion] = useState<GastoEnEdicion | null>(null);
  const [formEdicion, setFormEdicion] = useState<FormGasto>({
    categoria: '', descripcion: '', cantidad: '', monto: ''
  });

  const unidadCantidadForm = obtenerUnidadCategoria(formGasto.categoria);
  const unidadCantidadEdicion = obtenerUnidadCategoria(formEdicion.categoria);

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
  const equivalenciaPrecioTexto = unidadPrecio === 'bskg'
    ? `= ${((precioVentaKg || 0) * KG_POR_QUINTAL).toFixed(2)} Bs/qq`
    : `= ${(precioVentaKg || 0).toFixed(2)} Bs/kg`;
  
  const costoPorKg = qtyProducidaKg > 0 ? totalCostos / qtyProducidaKg : 0;
  const ingresosTotales = qtyProducidaKg * precioVentaKg;
  const gananciaNeta = ingresosTotales - totalCostos;
  const margenGanancia = ingresosTotales > 0 ? (gananciaNeta / ingresosTotales) * 100 : 0;
  const puntoEquilibrio = precioVentaKg > 0 ? totalCostos / precioVentaKg : 0;
  const puntoEquilibrioKg = Math.ceil(puntoEquilibrio);
  const puntoEquilibrioQq = Math.ceil(puntoEquilibrio / KG_POR_QUINTAL * 10) / 10;
  const puntoEquilibrioMostrado = unidadCantidad === 'qq' ? puntoEquilibrioQq : puntoEquilibrioKg;
  const unidadMostrada = unidadCantidad === 'qq' ? 'qq' : 'kg';
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

  const inferirFaseDesdeCategoria = (categoria: string, tipoCosto?: 'FIJO' | 'VARIABLE'): Fase => {
    if (CATEGORIAS_POR_FASE.Cosecha.includes(categoria)) return 'Cosecha';
    if (CATEGORIAS_POR_FASE.Crecimiento.includes(categoria)) return 'Crecimiento';
    if (CATEGORIAS_POR_FASE.Siembra.includes(categoria)) return 'Siembra';
    return tipoCosto === 'FIJO' ? 'Siembra' : 'Crecimiento';
  };

  const inferirFaseDesdeApi = (gasto: GastoApi): Fase =>
    inferirFaseDesdeCategoria(gasto.categoria, gasto.tipo_costo);

  const aplicarProduccionEnPantalla = (cantidadKg: number, precioKg: number) => {
    const cantidadQq = cantidadKg > 0 ? cantidadKg / KG_POR_QUINTAL : 0;
    const precioQq = precioKg > 0 ? precioKg * KG_POR_QUINTAL : 0;

    setProduccion({
      cantidad: cantidadQq > 0 ? cantidadQq.toFixed(2) : '',
      precio: precioQq > 0 ? precioQq.toFixed(2) : '',
    });
    setUnidadCantidad('qq');
    setUnidadPrecio('bsqq');
  };

  const cargarProduccionDesdeLoteLocal = async (): Promise<boolean> => {
    const borrador = await obtenerBorradorProduccionLocal({
      idLoteLocal,
      idLoteServidor,
    });
    if (!borrador) return false;

    const cantidadKg = Number(borrador.cantidad_obtenida || 0);
    const precioKg = Number(borrador.precio_venta || 0);

    if (cantidadKg <= 0 || precioKg <= 0) return false;

    aplicarProduccionEnPantalla(cantidadKg, precioKg);
    return true;
  };

  const persistirBorradorProduccionLocal = async () => {
    if (!idLoteLocal && !idLoteServidor) return;

    const cantidadKg = unidadCantidad === 'kg'
      ? (parseFloat(produccion.cantidad) || 0)
      : (parseFloat(produccion.cantidad) || 0) * KG_POR_QUINTAL;

    const precioKg = unidadPrecio === 'bskg'
      ? (parseFloat(produccion.precio) || 0)
      : (parseFloat(produccion.precio) || 0) / KG_POR_QUINTAL;

    if (cantidadKg <= 0 || precioKg <= 0) return;

    await guardarBorradorProduccionLocal({
      idLoteLocal,
      idLoteServidor,
      cantidadObtenida: cantidadKg,
      precioVenta: precioKg,
    });
  };

  const cargarGastosDelLote = async () => {
    try {
      const gastosRemote = idLoteServidor ? await obtenerGastosPorLoteApi(idLoteServidor) : [];
      const gastosApi: Gasto[] = gastosRemote.map((gasto) => ({
        id: String(gasto.id_gasto),
        fase: inferirFaseDesdeApi(gasto),
        categoria: gasto.categoria,
        descripcion: gasto.descripcion || '',
        cantidad: String(gasto.cantidad ?? ''),
        monto: String(gasto.monto_total ?? 0),
        origen: 'API',
      }));

      const gastosLocales = await obtenerCostosLocalesPorLote({
        idLoteLocal,
        idLoteServidor,
      });

      const gastosLocalesPendientes = gastosLocales.filter((gasto) => !gasto.sincronizado);
      const gastosLocalesMapeados: Gasto[] = gastosLocalesPendientes.map((gasto) => ({
        id: `local-${gasto.id_local}`,
        fase: inferirFaseDesdeCategoria(gasto.categoria, gasto.tipo_costo),
        categoria: gasto.categoria,
        descripcion: gasto.descripcion || '',
        cantidad: String(gasto.cantidad),
        monto: gasto.monto_total.toFixed(2),
        origen: 'LOCAL',
        idLocal: gasto.id_local,
        sincronizado: gasto.sincronizado,
      }));

      setGastos([...gastosApi, ...gastosLocalesMapeados]);
    } catch (error) {
      console.warn('No se pudieron cargar gastos del lote:', error);
      setGastos([]);
    }
  };

  const cargarUltimaProduccionDelLote = async () => {
    try {
      if (idLoteServidor) {
        const ultimaProduccion = await obtenerUltimaProduccionLoteApi(idLoteServidor);
        if (ultimaProduccion) {
          const cantidadKg = Number(ultimaProduccion.cantidad_obtenida) || 0;
          const precioKg = Number(ultimaProduccion.precio_venta) || 0;

          if (cantidadKg > 0 && precioKg > 0) {
            aplicarProduccionEnPantalla(cantidadKg, precioKg);
            return;
          }
        }
      }

      const cargadoLocal = await cargarProduccionDesdeLoteLocal();
      if (!cargadoLocal) {
        setProduccion({ cantidad: '', precio: '' });
        setUnidadCantidad('qq');
        setUnidadPrecio('bsqq');
      }
    } catch (error) {
      console.warn('No se pudo cargar la ultima produccion del lote:', error);
      const cargadoLocal = await cargarProduccionDesdeLoteLocal();
      if (!cargadoLocal) {
        setProduccion({ cantidad: '', precio: '' });
        setUnidadCantidad('qq');
        setUnidadPrecio('bsqq');
      }
    }
  };

  // Cargar gastos al iniciar y guardar automático al desmontar
  useEffect(() => {
    cargarGastosDelLote();
    cargarUltimaProduccionDelLote();
    
    // Cleanup: guardar cuando se sale de la pantalla
    return () => {
      console.log('Pantalla de calculadora cerrándose - gastos sincronizados con BD');
    };
  }, [idLoteServidor, idLoteLocal]);

  useEffect(() => {
    const timer = setTimeout(() => {
      persistirBorradorProduccionLocal().catch((error) => {
        console.warn('No se pudo guardar borrador local de produccion:', error);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [produccion.cantidad, produccion.precio, unidadCantidad, unidadPrecio, idLoteLocal, idLoteServidor]);

  const guardarDatosProduccion = async () => {
    if (!idLoteServidor && !idLoteLocal) {
      Alert.alert('Lote inválido', 'No se encontró el lote para guardar los datos de producción.');
      return;
    }

    const cantidad = unidadCantidad === 'kg'
      ? (parseFloat(produccion.cantidad) || 0)
      : (parseFloat(produccion.cantidad) || 0) * KG_POR_QUINTAL;

    const precio = unidadPrecio === 'bskg'
      ? (parseFloat(produccion.precio) || 0)
      : (parseFloat(produccion.precio) || 0) / KG_POR_QUINTAL;

    if (cantidad <= 0 || precio <= 0) {
      Alert.alert('Datos inválidos', 'La cantidad producida y el precio de venta deben ser mayores a cero.');
      return;
    }

    setGuardandoProduccion(true);
    try {
      if (idLoteServidor) {
        try {
          await registrarProduccionLoteApi({
            id_lote: idLoteServidor,
            fecha_registro: new Date().toISOString().split('T')[0],
            cantidad_obtenida: cantidad,
            precio_venta: precio,
          });
          Alert.alert('Listo', 'Datos de producción guardados en la base de datos.');
        } catch (apiError) {
          console.warn('API error al guardar producción, guardando localmente...', apiError);
          if (idLoteLocal || idLoteServidor) {
            await exportarProduccionALoteLocal(cantidad, precio);
            Alert.alert('Guardado localmente', 'Se guardará en el servidor al sincronizar.');
          } else {
             throw apiError;
          }
        }
      } else if (idLoteLocal || idLoteServidor) {
        await exportarProduccionALoteLocal(cantidad, precio);
        Alert.alert('Listo', 'Datos de producción guardados localmente.');
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo guardar la producción';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardandoProduccion(false);
    }
  };

  const exportarProduccionALoteLocal = async (cant: number, prec: number) => {
    await guardarBorradorProduccionLocal({
      idLoteLocal,
      idLoteServidor,
      cantidadObtenida: cant,
      precioVenta: prec,
    });
  };

  // --- FUNCIONES ---
  const cambiarFase = (nuevaFase: Fase) => {
    setFase(nuevaFase);
    setFormGasto({ ...formGasto, categoria: '', cantidad: '' }); // Resetear categoría y cantidad al cambiar fase
  };

  const agregarGasto = async () => {
    if (!formGasto.categoria || !formGasto.monto) {
      Alert.alert('Datos incompletos', 'Por favor selecciona una categoría e ingresa un monto.');
      return;
    }

    const validacionCantidad = validarCantidadPorCategoria(formGasto.categoria, formGasto.cantidad);
    if (!validacionCantidad.esValida || !validacionCantidad.cantidad) {
      Alert.alert('Cantidad inválida', validacionCantidad.mensaje || 'Verifica la cantidad ingresada.');
      return;
    }

    const cantidad = validacionCantidad.cantidad;
    const monto = Number(formGasto.monto);
    if (!monto || monto <= 0) {
      Alert.alert('Datos inválidos', 'El monto debe ser mayor a cero.');
      return;
    }

    const costoUnitario = monto / cantidad;
    const tipoCosto = fase === 'Siembra' ? 'FIJO' : 'VARIABLE';
    const tieneLoteLocal = typeof idLoteLocal === 'number' && idLoteLocal > 0;
    const tieneLoteServidor = typeof idLoteServidor === 'number' && idLoteServidor > 0;

    try {
      if (tieneLoteLocal && !tieneLoteServidor) {
        await guardarCostoLocal({
          id_lote_local: idLoteLocal,
          id_lote_servidor: null,
          categoria: formGasto.categoria,
          descripcion: formGasto.descripcion || null,
          cantidad,
          costo_unitario: costoUnitario,
          tipo_costo: tipoCosto,
          modalidad_pago: 'CICLO',
          sincronizado: false,
        });
        Alert.alert('Listo', 'Gasto guardado localmente y se enviará cuando sincronices el lote.');
      } else if (tieneLoteServidor) {
        try {
          await crearGastoApi({
            id_lote: idLoteServidor,
            categoria: formGasto.categoria,
            descripcion: formGasto.descripcion,
            cantidad,
            costo_unitario: costoUnitario,
            tipo_costo: tipoCosto,
            modalidad_pago: 'CICLO',
          });
          Alert.alert('Listo', 'Gasto registrado y guardado en la base de datos.');
        } catch (apiError) {
          console.warn('Fallo API al agregar gasto, intentando guardar localmente:', apiError);
          if (tieneLoteLocal || tieneLoteServidor) {
            await guardarCostoLocal({
              id_lote_local: tieneLoteLocal ? idLoteLocal : null,
              id_lote_servidor: tieneLoteServidor ? idLoteServidor : null,
              categoria: formGasto.categoria,
              descripcion: formGasto.descripcion || null,
              cantidad,
              costo_unitario: costoUnitario,
              tipo_costo: tipoCosto,
              modalidad_pago: 'CICLO',
              sincronizado: false,
            });
            Alert.alert('Guardado Offline', 'Gasto guardado localmente por falta de conexión.');
          } else {
             throw apiError;
          }
        }
      } else {
        Alert.alert('Lote no disponible', 'Sin identificador del lote no se puede registrar el gasto.');
        return;
      }

      setFormGasto({ categoria: '', descripcion: '', cantidad: '', monto: '' });
      await cargarGastosDelLote();
    } catch (error) {
      console.warn('No se pudo registrar gasto:', error);
      Alert.alert('Sin conexión', 'No se pudo guardar el gasto. Intenta nuevamente.');
    }
  };

  const eliminarGasto = async (gasto: Gasto) => {
    Alert.alert(
      'Eliminar Gasto',
      '¿Estás seguro que quieres eliminar este gasto?',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Eliminar',
          onPress: async () => {
            try {
              if (gasto.origen === 'LOCAL' && gasto.idLocal) {
                await eliminarCostoLocal(gasto.idLocal);
              } else {
                const idGastoNum = parseInt(gasto.id);
                if (!isNaN(idGastoNum)) {
                  await eliminarGastoApi(idGastoNum);
                }
              }
              await cargarGastosDelLote();
              Alert.alert('Eliminado', 'Gasto eliminado de la base de datos.');
            } catch (error) {
              console.warn('Error al eliminar gasto:', error);
              Alert.alert('Error', 'No se pudo eliminar el gasto de la base de datos.');
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

    const validacionCantidad = validarCantidadPorCategoria(formEdicion.categoria, formEdicion.cantidad);
    if (!validacionCantidad.esValida || !validacionCantidad.cantidad) {
      Alert.alert('Cantidad inválida', validacionCantidad.mensaje || 'Verifica la cantidad ingresada.');
      return;
    }

    const cantidad = validacionCantidad.cantidad;
    const monto = Number(formEdicion.monto);
    if (!monto || monto <= 0) {
      Alert.alert('Datos inválidos', 'El monto debe ser mayor a cero.');
      return;
    }

    const costoUnitario = monto / cantidad;
    const tipoCosto = gastoEnEdicion.fase === 'Siembra' ? 'FIJO' : 'VARIABLE';

    try {
      if (gastoEnEdicion.origen === 'LOCAL' && gastoEnEdicion.idLocal) {
        await actualizarCostoLocal(gastoEnEdicion.idLocal, {
          categoria: formEdicion.categoria,
          descripcion: formEdicion.descripcion || null,
          cantidad: cantidad,
          costo_unitario: costoUnitario,
          monto_total: monto,
          tipo_costo: tipoCosto,
          modalidad_pago: 'CICLO',
          sincronizado: false,
        });
      } else {
        const idGastoNum = parseInt(gastoEnEdicion.id);
        if (!isNaN(idGastoNum)) {
          await actualizarGastoApi(idGastoNum, {
            categoria: formEdicion.categoria,
            descripcion: formEdicion.descripcion,
            cantidad,
            costo_unitario: costoUnitario,
            tipo_costo: tipoCosto,
            modalidad_pago: 'CICLO',
          });
        }
      }
      
      setModalEdicion(false);
      setGastoEnEdicion(null);
      await cargarGastosDelLote();
      Alert.alert('Actualizado', 'Gasto actualizado correctamente.');
    } catch (error) {
      console.warn('Error al actualizar gasto:', error);
      Alert.alert('Sin conexión', 'No se pudo actualizar el gasto. Intenta nuevamente.');
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
              <Text style={styles.title}>Calculadora de Costos de Quinua</Text>
              <Text style={styles.subtitle}>Calcula tus gastos, ganancias y punto de equilibrio</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Q-2025</Text></View>
          </View>
        </View>

        {/* BOTÓN VER RESULTADOS */}
        <TouchableOpacity 
          style={styles.resultsButton}
          onPress={() => {
            // Nota: Si se abre desde una modal, podrías cerrar primero
            // Aquí navegamos directamente a la página de resultados
            router.push({
              pathname: '/resultados_quinua',
              params: { 
                idLoteServidor: idLoteServidor || '', 
                idLoteLocal: idLoteLocal || '' 
              }
            });
          }}
        >
          <Ionicons name="bar-chart-outline" size={20} color="#fff" />
          <Text style={styles.resultsButtonText}>Ver Resultados Detallados</Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
              
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
            placeholder="" 
            value={formGasto.descripcion}
            onChangeText={(t) => setFormGasto({...formGasto, descripcion: t})}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.inputLabel}>Cantidad ({unidadCantidadForm})</Text>
              <TextInput 
                style={styles.input} placeholder={CATEGORIAS_CANTIDAD_ENTERA.has(formGasto.categoria) ? '0' : '0.00'} keyboardType="numeric" 
                value={formGasto.cantidad}
                onChangeText={(t) =>
                  setFormGasto({
                    ...formGasto,
                    cantidad: sanitizarCantidadPorCategoria(formGasto.categoria, t),
                  })
                }
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
                  <View style={styles.tagGreenInlineTop}>
                    <Text style={styles.tagTextGreen}>{gasto.fase}</Text>
                  </View>
                  <Text style={styles.itemTitle}>{gasto.categoria}</Text>
                  {gasto.descripcion ? <Text style={styles.itemSub}>{gasto.descripcion}</Text> : null}
                  {gasto.origen === 'LOCAL' && !gasto.sincronizado && (
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
                    setFormGasto({
                      ...formGasto,
                      categoria: item,
                      cantidad: sanitizarCantidadPorCategoria(item, formGasto.cantidad),
                    });
                    setModalCategoria(false);
                  }}
                >
                  <View style={styles.modalItemRow}>
                    <Text style={styles.modalItemText}>{item}</Text>
                    <Text style={styles.modalItemUnit}>{obtenerUnidadCategoria(item)}</Text>
                  </View>
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

                    <Text style={styles.inputLabel}>Descripción (Opcional)</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="" 
                      value={formEdicion.descripcion}
                      onChangeText={(t) => setFormEdicion({...formEdicion, descripcion: t})}
                    />

                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.inputLabel}>Cantidad ({unidadCantidadEdicion})</Text>
                        <TextInput 
                          style={styles.input} placeholder={CATEGORIAS_CANTIDAD_ENTERA.has(formEdicion.categoria) ? '0' : '0.00'} keyboardType="numeric" 
                          value={formEdicion.cantidad}
                          onChangeText={(t) =>
                            setFormEdicion({
                              ...formEdicion,
                              cantidad: sanitizarCantidadPorCategoria(formEdicion.categoria, t),
                            })
                          }
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
  resultsButton: { backgroundColor: '#8b5cf6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, marginBottom: 20, gap: 10 },
  resultsButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  // Lista de gastos
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  listDivider: { height: 1, backgroundColor: '#f3f4f6' },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  itemSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  pendienteLabel: { fontSize: 12, color: '#f97316', marginTop: 2, fontWeight: '600' },
  itemPrice: { fontSize: 14, fontWeight: 'bold', color: '#2eaa51', marginRight: 12 },
  editBtn: { padding: 6, backgroundColor: '#dbeafe', borderRadius: 6, marginRight: 8 },
  deleteBtn: { padding: 6, backgroundColor: '#fef2f2', borderRadius: 6 },
  tagGreen: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  tagGreenInlineTop: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6 },
  tagTextGreen: { color: '#166534', fontSize: 10, fontWeight: 'bold' },

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
  modalItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalItemText: { fontSize: 16, color: '#4b5563' },
  modalItemUnit: { fontSize: 12, color: '#2eaa51', fontWeight: '700', textTransform: 'uppercase' },
  modalCloseBtn: { marginTop: 20, padding: 14, backgroundColor: '#f3f4f6', borderRadius: 10, alignItems: 'center' },
  modalCloseText: { fontSize: 16, fontWeight: 'bold', color: '#4b5563' }
});
