import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getDb } from '@/src/core/database/sqlite.config';
import {
  actualizarCostoLocal,
  eliminarCostoLocal,
  marcarCostoComoSincronizado,
  guardarBorradorProduccionLocal,
  guardarCostoLocal,
  obtenerBorradorProduccionLocal,
  obtenerCostosLocalesPorLote,
} from '@/src/modules/costos/costos.repository';
import { emitirEventoGastoActualizado } from '@/src/modules/gastos/gastos.events';
import { sincronizarSiembrasPendientes } from '@/src/modules/siembra/siembra.sync';
import {
  crearGastoApi,
  eliminarGastoApi,
  GastoApi,
  obtenerGastosPorLoteApi,
  actualizarGastoApi,
} from '@/src/core/network/api/gastos';
import { registrarProduccionLoteApi } from '@/src/core/network/api/produccion';
import { obtenerUltimaProduccionLoteApi } from '@/src/core/network/api/produccion';
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
  const [guardandoGasto, setGuardandoGasto] = useState(false);

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

  const mapearGastoLocal = (gasto: Awaited<ReturnType<typeof obtenerCostosLocalesPorLote>>[number]): Gasto => ({
    id: `local-${gasto.id_local}`,
    fase: inferirFaseDesdeCategoria(gasto.categoria, gasto.tipo_costo, estrategia.categoriasPorFase),
    categoria: gasto.categoria,
    descripcion: gasto.descripcion || '',
    cantidad: String(gasto.cantidad),
    monto: gasto.monto_total.toFixed(2),
    origen: 'LOCAL',
    idLocal: gasto.id_local,
    sincronizado: gasto.sincronizado,
  });

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
    // Si hay internet y idLoteServidor, jalamos los gastos del servidor y los escribimos en SQLite
    if (idLoteServidor) {
      try {
        const netState = await NetInfo.fetch();
        const hayInternet = Boolean(netState.isConnected) && netState.isInternetReachable !== false;
        if (hayInternet) {
          const serverGastos = await obtenerGastosPorLoteApi(idLoteServidor);
          if (Array.isArray(serverGastos)) {
            const db = await getDb();
            for (const sg of serverGastos) {
              const idGastoServidor = Number(sg.id_gasto);
              if (!idGastoServidor) continue;

              const gastoLocal = await db.getFirstAsync<any>(
                `SELECT id_local FROM gasto_lote WHERE id_gasto = ?`,
                idGastoServidor
              );

              if (!gastoLocal) {
                // Intentar asociar con un gasto local pendiente idéntico
                const gastoEquivalente = await db.getFirstAsync<any>(
                  `SELECT id_local FROM gasto_lote 
                   WHERE (id_lote_local = ? OR id_lote_servidor = ?) 
                     AND lower(categoria) = lower(?) 
                     AND cantidad = ? 
                     AND costo_unitario = ? 
                     AND sincronizado = 0`,
                  idLoteLocal ?? null,
                  idLoteServidor,
                  sg.categoria.trim(),
                  Number(sg.cantidad),
                  Number(sg.costo_unitario)
                );

                if (gastoEquivalente) {
                  await db.runAsync(
                    `UPDATE gasto_lote SET id_gasto = ?, sincronizado = 1, id_lote_servidor = ?, updated_at = ? WHERE id_local = ?`,
                    idGastoServidor,
                    idLoteServidor,
                    new Date().toISOString(),
                    gastoEquivalente.id_local
                  );
                } else {
                  // Si no existe localmente, insertarlo como sincronizado
                  const nowStr = new Date().toISOString();
                  await db.runAsync(
                    `INSERT INTO gasto_lote (
                      id_gasto,
                      id_lote_local,
                      id_lote_servidor,
                      categoria,
                      descripcion,
                      cantidad,
                      costo_unitario,
                      monto_total,
                      tipo_costo,
                      modalidad_pago,
                      fecha_gasto,
                      sincronizado,
                      created_at,
                      updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    idGastoServidor,
                    idLoteLocal ?? null,
                    idLoteServidor,
                    sg.categoria,
                    sg.descripcion || null,
                    Number(sg.cantidad),
                    Number(sg.costo_unitario),
                    Number(sg.monto_total || (Number(sg.cantidad) * Number(sg.costo_unitario))),
                    sg.tipo_costo || 'VARIABLE',
                    sg.modalidad_pago || 'NA',
                    sg.fecha_gasto || nowStr.split('T')[0],
                    1,
                    nowStr,
                    nowStr
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error sincronizando gastos al cargar:', error);
      }
    }

    // Single Source of Truth: Leer todo estrictamente desde la base de datos SQLite
    const gastosLocales = await obtenerCostosLocalesPorLote({ idLoteLocal, idLoteServidor }).catch(() => []);
    const gastosLocalesMapeados: Gasto[] = gastosLocales.map(mapearGastoLocal);
    setGastos(gastosLocalesMapeados);
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
    if (guardandoProduccion) return;
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
      if (idLoteLocal || idLoteServidor) {
        await exportarProduccionALoteLocal(cantidad, precio);
        Alert.alert('Listo', 'Datos de producción guardados.');
        
        // Ejecutar sincronización en background de forma centralizada y segura
        setTimeout(() => {
          sincronizarSiembrasPendientes().catch(() => {});
        }, 500);
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
    if (guardandoGasto) return;
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
    const costoUnitario = Number(formGasto.monto);
    if (!costoUnitario || costoUnitario <= 0) {
      Alert.alert('Datos inválidos', estrategia.usaValidacionCantidadPorCategoria ? 'El costo unitario debe ser mayor a cero.' : 'Cantidad y costo unitario deben ser mayores a cero.');
      return;
    }

    setGuardandoGasto(true);
    try {
      const montoTotal = costoUnitario * cantidad;
      const tipoCosto = fase === 'Siembra' ? 'FIJO' : 'VARIABLE';
      const tieneLoteLocal = typeof idLoteLocal === 'number' && idLoteLocal > 0;
      const tieneLoteServidor = typeof idLoteServidor === 'number' && idLoteServidor > 0;
      const tempId = `tmp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const gastoOptimista = crearGastoUi({
        id: tempId,
        categoria: formGasto.categoria,
        descripcion: formGasto.descripcion,
        cantidad,
        monto: montoTotal,
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

        // Ejecutar sincronización en background de forma centralizada y segura
        setTimeout(() => {
          sincronizarSiembrasPendientes().catch(() => {});
        }, 500);
      } catch (error) {
        if (estrategia.mensajeNoLoteSinError) {
          console.warn('No se pudo registrar gasto:', error);
        } else {
          console.warn('Error al guardar el gasto:', error);
        }
        setGastos((actuales) => actuales.filter((item) => item.id !== tempId));
        Alert.alert('Sin conexión', 'No se pudo guardar el gasto. Intenta nuevamente.');
      }
    } finally {
      setGuardandoGasto(false);
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
    const cantidadNum = Number(gasto.cantidad) || 1;
    const montoNum = Number(gasto.monto) || 0;
    const costoUnitarioTexto = cantidadNum > 0 ? (montoNum / cantidadNum).toFixed(2) : '0.00';
    setFormEdicion({
      categoria: gasto.categoria,
      descripcion: gasto.descripcion,
      cantidad: gasto.cantidad,
      monto: costoUnitarioTexto,
    });
    setModalEdicion(true);
  };

  const guardarEdicion = async () => {
    if (guardandoGasto) return;
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
    const costoUnitario = Number(formEdicion.monto);
    if (!costoUnitario || costoUnitario <= 0) {
      Alert.alert('Datos inválidos', estrategia.usaValidacionCantidadPorCategoria ? 'El costo unitario debe ser mayor a cero.' : 'Cantidad y costo unitario deben ser mayores a cero.');
      return;
    }

    setGuardandoGasto(true);
    try {
      const montoTotal = costoUnitario * cantidad;
      const tipoCosto = gastoEnEdicion.fase === 'Siembra' ? 'FIJO' : 'VARIABLE';
      const gastoId = gastoEnEdicion.id;
      const snapshot = [...gastos];
      const gastoEditadoUi = {
        categoria: formEdicion.categoria,
        descripcion: formEdicion.descripcion || '',
        cantidad: String(cantidad),
        monto: montoTotal.toFixed(2),
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
            monto_total: montoTotal,
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
    } finally {
      setGuardandoGasto(false);
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
    guardandoGasto,
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
