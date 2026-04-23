import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  actualizarGastoApi,
  crearGastoApi,
  eliminarGastoApi,
  GastoApi,
  obtenerGastosPorLoteApi,
  obtenerUltimaProduccionLoteApi,
  registrarProduccionLoteApi,
} from '@/src/services/api';
import {
  actualizarCostoLocal,
  eliminarCostoLocal,
  guardarBorradorProduccionLocal,
  guardarCostoLocal,
  obtenerBorradorProduccionLocal,
  obtenerCostosLocalesPorLote,
} from '@/src/services/database';
import {
  Escenario,
  Fase,
  FormGasto,
  Gasto,
  GastoEnEdicion,
  RubroCalculadora,
  UnidadCantidad,
  UnidadPrecio,
} from '../types';
import {
  inferirFaseDesdeCategoria,
  obtenerEstrategiaCalculo,
  obtenerUnidadCategoria,
  sanitizarCantidadPorCategoria,
  validarCantidadPorCategoria,
} from '../utils/estrategiasCalculo';
import { emitirEventoGastoActualizado } from '@/src/services/gastosStorageEvents';

const KG_POR_QUINTAL = 46;

type UseCalculadoraCostosParams = {
  rubro: RubroCalculadora;
  idLoteServidor?: number;
  idLoteLocal?: number;
};

export function useCalculadoraCostos({ rubro, idLoteServidor, idLoteLocal }: UseCalculadoraCostosParams) {
  const estrategia = useMemo(() => obtenerEstrategiaCalculo(rubro), [rubro]);

  const [fase, setFase] = useState<Fase>('Siembra');
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [modalCategoria, setModalCategoria] = useState(false);

  const [formGasto, setFormGasto] = useState<FormGasto>({
    categoria: '',
    descripcion: '',
    cantidad: '',
    monto: '',
  });    

  const [produccion, setProduccion] = useState({ cantidad: '', precio: '' });
  const [unidadCantidad,     setUnidadCantidad] = useState<UnidadCantidad>('qq');
  const [unidadPrecio, setUnidadPrecio] = useState<UnidadPrecio>('bsqq');
  const [modalUnidadCantidad, setModalUnidadCantidad] = useState(false);
  const [modalUnidadPrecio, setModalUnidadPrecio] = useState(false);
  const [guardandoProduccion, setGuardandoProduccion] = useState(false);

  const [modalEdicion, setModalEdicion] = useState(false);
  const [gastoEnEdicion, setGastoEnEdicion] = useState<GastoEnEdicion | null>(null);
  const [formEdicion, setFormEdicion] = useState<FormGasto>({
    categoria: '',
    descripcion: '',
    cantidad: '',
    monto: '',
  });

  const unidadCantidadForm = obtenerUnidadCategoria(formGasto.categoria);
  const unidadCantidadEdicion = obtenerUnidadCategoria(formEdicion.categoria);

  const totalCostos = gastos.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);
  const qtyIngresada = parseFloat(produccion.cantidad) || 0;
  const precioIngresado = parseFloat(produccion.precio) || 0;

  const qtyProducidaKg = unidadCantidad === 'kg' ? qtyIngresada : qtyIngresada * KG_POR_QUINTAL;
  const precioVentaKg = unidadPrecio === 'bskg' ? precioIngresado : precioIngresado / KG_POR_QUINTAL;
//
    const equivalenciaTexto =
    unidadCantidad === 'qq' ? `= ${(qtyProducidaKg || 0).toFixed(2)} kg` : `= ${((qtyProducidaKg || 0) / KG_POR_QUINTAL).toFixed(2)} qq`;
  const equivalenciaPrecioTexto =
    unidadPrecio === 'bskg'
      ? `= ${((precioVentaKg || 0) * KG_POR_QUINTAL).toFixed(2)} Bs/qq`
      : `= ${(precioVentaKg || 0).toFixed(2)} Bs/kg`;

  const costoPorKg = qtyProducidaKg > 0 ? totalCostos / qtyProducidaKg : 0;
  const ingresosTotales = qtyProducidaKg * precioVentaKg;
  const gananciaNeta = ingresosTotales - totalCostos;
  const margenGanancia = ingresosTotales > 0 ? (gananciaNeta / ingresosTotales) * 100 : 0;
  const puntoEquilibrio = precioVentaKg > 0 ? totalCostos / precioVentaKg : 0;
  const puntoEquilibrioKg = Math.ceil(puntoEquilibrio);
  const puntoEquilibrioQq = Math.ceil((puntoEquilibrio / KG_POR_QUINTAL) * 10) / 10;
  const puntoEquilibrioMostrado = estrategia.mostrarPuntoEquilibrioEnUnidadSeleccionada
    ? (unidadCantidad === 'qq' ? puntoEquilibrioQq : puntoEquilibrioKg)
    : puntoEquilibrioKg;
  const unidadMostrada = estrategia.mostrarPuntoEquilibrioEnUnidadSeleccionada
    ? (unidadCantidad === 'qq' ? 'qq' : 'kg')
    : 'kg';
  const esRentable = gananciaNeta >= 0;

  const escenarios: Escenario[] = [
    {
      nombre: 'Pesimista',
      ingresos: ingresosTotales * 0.7,
      costos: totalCostos,
      ganancia: ingresosTotales * 0.7 - totalCostos,
    },
    {
      nombre: 'Realista',
      ingresos: ingresosTotales,
      costos: totalCostos,
      ganancia: gananciaNeta,
    },
    {
      nombre: 'Optimista',
      ingresos: ingresosTotales * 1.3,
      costos: totalCostos,
      ganancia: ingresosTotales * 1.3 - totalCostos,
    },
  ];
  const maxGrafico = Math.max(ingresosTotales * 1.3, totalCostos, 100);

  const inferirFaseDesdeApi = (gasto: GastoApi): Fase =>
    inferirFaseDesdeCategoria(gasto.categoria, gasto.tipo_costo, estrategia.categoriasPorFase);

  const crearGastoUi = (input: {
    id: string;
    categoria: string;
    descripcion?: string;
    cantidad: number;
    monto: number;
    fase: Fase;
    origen: 'API' | 'LOCAL';
    idLocal?: number;
    sincronizado?: boolean;
  }): Gasto => ({
    id: input.id,
    fase: input.fase,
    categoria: input.categoria,
    descripcion: input.descripcion || '',
    cantidad: String(input.cantidad),
    monto: input.monto.toFixed(2),
    origen: input.origen,
    idLocal: input.idLocal,
    sincronizado: input.sincronizado,
  });

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
    const borrador = await obtenerBorradorProduccionLocal({ idLoteLocal, idLoteServidor });
    if (!borrador) return false;

    const cantidadKg = Number(borrador.cantidad_obtenida || 0);
    const precioKg = Number(borrador.precio_venta || 0);

    if (cantidadKg <= 0 || precioKg <= 0) return false;

    aplicarProduccionEnPantalla(cantidadKg, precioKg);
    return true;
  };

  const persistirBorradorProduccionLocal = async () => {
    if (!idLoteLocal && !idLoteServidor) return;

    const cantidadKg =
      unidadCantidad === 'kg'
        ? parseFloat(produccion.cantidad) || 0
        : (parseFloat(produccion.cantidad) || 0) * KG_POR_QUINTAL;

    const precioKg =
      unidadPrecio === 'bskg'
        ? parseFloat(produccion.precio) || 0
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
    const gastosLocales = await obtenerCostosLocalesPorLote({ idLoteLocal, idLoteServidor }).catch(() => []);
    const gastosLocalesPendientes = gastosLocales.filter((gasto) => !gasto.sincronizado);
    const gastosLocalesMapeados: Gasto[] = gastosLocalesPendientes.map((gasto) => ({
      id: `local-${gasto.id_local}`,
      fase: inferirFaseDesdeCategoria(gasto.categoria, gasto.tipo_costo, estrategia.categoriasPorFase),
      categoria: gasto.categoria,
      descripcion: gasto.descripcion || '',
      cantidad: String(gasto.cantidad),
      monto: gasto.monto_total.toFixed(2),
      origen: 'LOCAL',
      idLocal: gasto.id_local,
      sincronizado: gasto.sincronizado,
    }));

    // Primero pintamos locales para no bloquear la UI en modo offline.
    setGastos(gastosLocalesMapeados);

    if (!idLoteServidor) {
      return;
    }

    try {
      const gastosRemote = await obtenerGastosPorLoteApi(idLoteServidor);
      const gastosApi: Gasto[] = gastosRemote.map((gasto) => ({
        id: String(gasto.id_gasto),
        fase: inferirFaseDesdeApi(gasto),
        categoria: gasto.categoria,
        descripcion: gasto.descripcion || '',
        cantidad: String(gasto.cantidad ?? ''),
        monto: String(gasto.monto_total ?? 0),
        origen: 'API',
      }));

      setGastos([...gastosApi, ...gastosLocalesMapeados]);
    } catch (error) {
      console.warn('No se pudieron cargar gastos remotos, se muestran locales:', error);
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

  useEffect(() => {
    cargarGastosDelLote();
    cargarUltimaProduccionDelLote();

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

    const cantidad =
      unidadCantidad === 'kg'
        ? parseFloat(produccion.cantidad) || 0
        : (parseFloat(produccion.cantidad) || 0) * KG_POR_QUINTAL;

    const precio =
      unidadPrecio === 'bskg'
        ? parseFloat(produccion.precio) || 0
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
          Alert.alert('Listo', 'Datos de producción subidos.');
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
        Alert.alert('Listo', 'Datos de producción guardados.');
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo guardar la producción';
      if (estrategia.mensajeErrorGuardarProduccionConDetalle) {
        Alert.alert('Error', mensaje);
      } else {
        Alert.alert('Sin conexión', 'No se pudo guardar la producción. Intenta nuevamente.');
      }
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

  const cambiarFase = (nuevaFase: Fase) => {
    setFase(nuevaFase);
    setModalCategoria(true);
    setFormGasto((actual) =>
      estrategia.usaValidacionCantidadPorCategoria
        ? { ...actual, categoria: '', cantidad: '' }
        : { ...actual, categoria: '' },
    );
  };

  const agregarGasto = async () => {
    if (!formGasto.categoria || !formGasto.monto) {
      Alert.alert('Datos incompletos', 'Por favor selecciona una categoría e ingresa un monto.');
      return;
    }

    const validacionCantidad = validarCantidadPorCategoria(formGasto.categoria, formGasto.cantidad, rubro);
    if (!validacionCantidad.esValida || !validacionCantidad.cantidad) {
      Alert.alert('Cantidad inválida', validacionCantidad.mensaje || 'Verifica la cantidad ingresada.');
      return;
    }

    const cantidad = validacionCantidad.cantidad;
    const monto = Number(formGasto.monto);
    if (!monto || monto <= 0) {
      Alert.alert('Datos inválidos', estrategia.usaValidacionCantidadPorCategoria ? 'El monto debe ser mayor a cero.' : 'Cantidad y monto deben ser mayores a cero.');
      return;
    }

    const costoUnitario = monto / cantidad;
    const tipoCosto = fase === 'Siembra' ? 'FIJO' : 'VARIABLE';
    const tieneLoteLocal = typeof idLoteLocal === 'number' && idLoteLocal > 0;
    const tieneLoteServidor = typeof idLoteServidor === 'number' && idLoteServidor > 0;
    const tempId = `tmp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const gastoOptimista = crearGastoUi({
      id: tempId,
      categoria: formGasto.categoria,
      descripcion: formGasto.descripcion,
      cantidad,
      monto,
      fase,
      origen: 'LOCAL',
      sincronizado: false,
    });

    setGastos((actuales) => [gastoOptimista, ...actuales]);
    setFormGasto({ categoria: '', descripcion: '', cantidad: '', monto: '' });

    try {
      if (!tieneLoteLocal && !tieneLoteServidor) {
        if (estrategia.mensajeNoLoteSinError) {
          Alert.alert('Lote no disponible', 'Sin identificador del lote no se puede registrar el gasto.');
          return;
        }
        throw new Error('No hay ID de lote válido para registrar el gasto.');
      }

      void (async () => {
        if (tieneLoteLocal && !tieneLoteServidor) {
          const idLocalCreado = await guardarCostoLocal({
            id_lote_local: idLoteLocal,
            id_lote_servidor: null,
            categoria: gastoOptimista.categoria,
            descripcion: gastoOptimista.descripcion || null,
            cantidad,
            costo_unitario: costoUnitario,
            tipo_costo: tipoCosto,
            modalidad_pago: 'CICLO',
            sincronizado: false,
          });

          setGastos((actuales) =>
            actuales.map((item) =>
              item.id === tempId
                ? { ...item, id: `local-${idLocalCreado}`, idLocal: idLocalCreado, sincronizado: false, origen: 'LOCAL' }
                : item
            )
          );
          emitirEventoGastoActualizado({ idLoteLocal, idLoteServidor });
          return;
        }

        if (tieneLoteServidor) {
          try {
            const creado = await crearGastoApi({
              id_lote: idLoteServidor,
              categoria: gastoOptimista.categoria,
              descripcion: gastoOptimista.descripcion,
              cantidad,
              costo_unitario: costoUnitario,
              tipo_costo: tipoCosto,
              modalidad_pago: 'CICLO',
            });

            const montoApi = Number(creado.monto_total ?? cantidad * costoUnitario);
            const faseApi = inferirFaseDesdeApi(creado);

            setGastos((actuales) =>
              actuales.map((item) =>
                item.id === tempId
                  ? crearGastoUi({
                    id: String(creado.id_gasto),
                    categoria: creado.categoria,
                    descripcion: creado.descripcion || '',
                    cantidad: Number(creado.cantidad ?? cantidad),
                    monto: montoApi,
                    fase: faseApi,
                    origen: 'API',
                  })
                  : item
              )
            );
            emitirEventoGastoActualizado({ idLoteLocal, idLoteServidor });
          } catch (apiError) {
            console.warn('Fallo API al agregar gasto, guardando localmente:', apiError);
            const idLocalCreado = await guardarCostoLocal({
              id_lote_local: tieneLoteLocal ? idLoteLocal : null,
              id_lote_servidor: tieneLoteServidor ? idLoteServidor : null,
              categoria: gastoOptimista.categoria,
              descripcion: gastoOptimista.descripcion || null,
              cantidad,
              costo_unitario: costoUnitario,
              tipo_costo: tipoCosto,
              modalidad_pago: 'CICLO',
              sincronizado: false,
            });

            setGastos((actuales) =>
              actuales.map((item) =>
                item.id === tempId
                  ? { ...item, id: `local-${idLocalCreado}`, idLocal: idLocalCreado, sincronizado: false, origen: 'LOCAL' }
                  : item
              )
            );
            emitirEventoGastoActualizado({ idLoteLocal, idLoteServidor });
          }
        }
      })().catch((error) => {
        console.warn('Error al persistir gasto optimista:', error);
        setGastos((actuales) => actuales.filter((item) => item.id !== tempId));
        Alert.alert('Sin conexión', 'No se pudo guardar el gasto. Intenta nuevamente.');
      });
    } catch (error) {
      if (estrategia.mensajeNoLoteSinError) {
        console.warn('No se pudo registrar gasto:', error);
      } else {
        console.warn('Error al guardar el gasto:', error);
      }
      setGastos((actuales) => actuales.filter((item) => item.id !== tempId));
      Alert.alert('Sin conexión', 'No se pudo guardar el gasto. Intenta nuevamente.');
    }
  };

  const eliminarGasto = async (gasto: Gasto) => {
    Alert.alert('Eliminar Gasto', '¿Estás seguro que quieres eliminar este gasto?', [
      { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
      {
        text: 'Eliminar',
        onPress: () => {
          const snapshot = [...gastos];
          setGastos((actuales) => actuales.filter((item) => item.id !== gasto.id));

          void (async () => {
            try {
              if (gasto.origen === 'LOCAL' && gasto.idLocal) {
                await eliminarCostoLocal(gasto.idLocal);
              } else {
                const idGastoNum = parseInt(gasto.id, 10);
                if (!Number.isNaN(idGastoNum)) {
                  await eliminarGastoApi(idGastoNum);
                }
              }
              emitirEventoGastoActualizado({ idLoteLocal, idLoteServidor });
            } catch (error) {
              console.warn('Error al eliminar gasto:', error);
              setGastos(snapshot);
              Alert.alert('Error', estrategia.rubro === 'quinua' ? 'No se pudo eliminar el gasto de la base de datos.' : 'No se pudo eliminar el gasto.');
            }
          })();
        },
        style: 'destructive',
      },
    ]);
  };

  const editarGasto = (gasto: Gasto) => {
    setGastoEnEdicion(gasto as GastoEnEdicion);
    setFormEdicion({
      categoria: gasto.categoria,
      descripcion: gasto.descripcion,
      cantidad: gasto.cantidad,
      monto: gasto.monto,
    });
    setModalEdicion(true);
  };

  const guardarEdicion = async () => {
    if (!formEdicion.categoria || !formEdicion.monto || !gastoEnEdicion) {
      Alert.alert('Datos incompletos', 'Por favor completa todos los campos obligatorios.');
      return;
    }

    const validacionCantidad = validarCantidadPorCategoria(formEdicion.categoria, formEdicion.cantidad, rubro);
    if (!validacionCantidad.esValida || !validacionCantidad.cantidad) {
      Alert.alert('Cantidad inválida', validacionCantidad.mensaje || 'Verifica la cantidad ingresada.');
      return;
    }

    const cantidad = validacionCantidad.cantidad;
    const monto = Number(formEdicion.monto);
    if (!monto || monto <= 0) {
      Alert.alert('Datos inválidos', estrategia.usaValidacionCantidadPorCategoria ? 'El monto debe ser mayor a cero.' : 'Cantidad y monto deben ser mayores a cero.');
      return;
    }

    const costoUnitario = monto / cantidad;
    const tipoCosto = gastoEnEdicion.fase === 'Siembra' ? 'FIJO' : 'VARIABLE';
    const gastoId = gastoEnEdicion.id;
    const snapshot = [...gastos];
    const gastoEditadoUi = {
      categoria: formEdicion.categoria,
      descripcion: formEdicion.descripcion || '',
      cantidad: String(cantidad),
      monto: monto.toFixed(2),
    };

    setModalEdicion(false);
    setGastoEnEdicion(null);
    setGastos((actuales) =>
      actuales.map((item) =>
        item.id === gastoId
          ? {
            ...item,
            ...gastoEditadoUi,
            sincronizado: item.origen === 'LOCAL' ? false : item.sincronizado,
          }
          : item
      )
    );

    try {
      if (gastoEnEdicion.origen === 'LOCAL' && gastoEnEdicion.idLocal) {
        await actualizarCostoLocal(gastoEnEdicion.idLocal, {
          categoria: formEdicion.categoria,
          descripcion: formEdicion.descripcion || null,
          cantidad,
          costo_unitario: costoUnitario,
          monto_total: monto,
          tipo_costo: tipoCosto,
          modalidad_pago: 'CICLO',
          sincronizado: false,
        });
      } else {
        const idGastoNum = parseInt(gastoEnEdicion.id, 10);
        if (!Number.isNaN(idGastoNum)) {
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

      void cargarGastosDelLote();
      emitirEventoGastoActualizado({ idLoteLocal, idLoteServidor });
    } catch (error) {
      console.warn('Error al actualizar gasto:', error);
      setGastos(snapshot);
      Alert.alert(
        estrategia.rubro === 'quinua' ? 'Sin conexión' : 'Error',
        estrategia.rubro === 'quinua'
          ? 'No se pudo actualizar el gasto. Intenta nuevamente.'
          : 'No se pudo actualizar el gasto. Intenta nuevamente.',
      );
    }
  };

  const seleccionarCategoria = (categoria: string) => {
    if (estrategia.usaValidacionCantidadPorCategoria) {
      setFormGasto({
        ...formGasto,
        categoria,
        cantidad: sanitizarCantidadPorCategoria(categoria, formGasto.cantidad, rubro),
      });
    } else {
      setFormGasto({ ...formGasto, categoria });
    }
    setModalCategoria(false);
  };

  const sanitizarCantidadFormulario = (texto: string) =>
    sanitizarCantidadPorCategoria(formGasto.categoria, texto, rubro);

  const sanitizarCantidadFormularioEdicion = (texto: string) =>
    sanitizarCantidadPorCategoria(formEdicion.categoria, texto, rubro);

  return {
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
    totalCostos,
    costoPorKg,
    ingresosTotales,
    gananciaNeta,
    margenGanancia,
    puntoEquilibrio,
    puntoEquilibrioMostrado,
    unidadMostrada,
    puntoEquilibrioKg,
    esRentable,
    equivalenciaTexto,
    equivalenciaPrecioTexto,
    escenarios,
    maxGrafico,
    setFase,
    setFormGasto,
    setProduccion,
    setUnidadCantidad,
    setUnidadPrecio,
    setModalCategoria,
    setModalUnidadCantidad,
    setModalUnidadPrecio,
    setModalEdicion,
    setFormEdicion,
    cambiarFase,
    agregarGasto,
    eliminarGasto,
    editarGasto,
    guardarEdicion,
    guardarDatosProduccion,
    seleccionarCategoria,
    sanitizarCantidadFormulario,
    sanitizarCantidadFormularioEdicion,
  };
}
