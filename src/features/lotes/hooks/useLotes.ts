import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  insertarLoteLocal,
  actualizarLoteLocal,
  actualizarLoteLocalPorServidor,
  eliminarLoteLocal,
  eliminarLoteLocalPorServidor,
  obtenerLotesLocales,
} from '@/src/services/database';
import {
  actualizarLoteApi,
  eliminarLoteApi,
  obtenerGastosPorLoteApi,
  obtenerLotesPorProductoApi,
  obtenerProductosPorCategoriaApi,
} from '@/src/services/api';
import { listarProductosLocales, sincronizarProductosPendientes } from '@/src/services/offlineProductsSync';
import {
  iniciarSincronizacionAutomaticaSiembras,
  detenerSincronizacionAutomaticaSiembras,
  sincronizarSiembrasPendientes,
  suscribirEventosSincronizacionSiembras,
} from '@/src/services/siembraStorageSync';
import { RUBRO_CONFIG } from '../utils/constants';
import { FormEdicionLote, LoteViewModel, RubroType, UseLotesResult } from '../types';

const formatearFecha = (iso: string) => {
  if (!iso) return 'N/D';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString('es-BO');
};

const calcularProgresoYCiclo = (fechaSiembraIso: string, fechaCosechaIso: string) => {
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

const normalizarBaseApi = () => {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL_LAN || '').trim();
  return base ? base.replace(/\/$/, '') : '';
};

const resolverUriImagen = (uri?: string | null, fallback = '') => {
  const valor = String(uri || '').trim();
  if (!valor) return fallback;

  if (/^(https?:\/\/|file:\/\/|content:\/\/|data:)/i.test(valor)) {
    return valor;
  }

  const baseApi = normalizarBaseApi();
  if (baseApi && valor.startsWith('/')) {
    return `${baseApi}${valor}`;
  }

  return valor;
};

const normalizarIdServidor = (valor: unknown): number | null => {
  const id = Number(valor);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
};

const normalizarTextoFirma = (valor: unknown): string => String(valor ?? '').trim().toLowerCase();

const normalizarSuperficieFirma = (valor: unknown): string => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '0';
  return numero.toFixed(4);
};

const construirFirmaLoteRaw = (item: any): string => {
  const nombre = normalizarTextoFirma(item?.nombre_lote);
  const variedad = normalizarTextoFirma(item?.variedad);
  const fechaSiembra = normalizarTextoFirma(item?.fecha_siembra);
  const fechaCosecha = normalizarTextoFirma(item?.fecha_cosecha_est);
  const superficie = normalizarSuperficieFirma(item?.superficie);
  return `${nombre}|${variedad}|${fechaSiembra}|${fechaCosecha}|${superficie}`;
};

const deduplicarRemotosPorId = (remotos: any[]): any[] => {
  const vistos = new Set<number>();
  const resultado: any[] = [];

  for (const item of remotos) {
    const idServidor = normalizarIdServidor(item?.id_lote);
    if (!idServidor) {
      resultado.push(item);
      continue;
    }
    if (vistos.has(idServidor)) continue;
    vistos.add(idServidor);
    resultado.push(item);
  }

  return resultado;
};

const filtrarLocalesNoDuplicados = (locales: any[], remotos: any[]): any[] => {
  const idsRemotos = new Set(
    remotos
      .map((item) => normalizarIdServidor(item?.id_lote))
      .filter((id): id is number => id !== null)
  );
  const firmasRemotas = new Set(remotos.map((item) => construirFirmaLoteRaw(item)));

  return locales.filter((item) => {
    const idServidorLocal = normalizarIdServidor(item?.id_servidor);
    if (idServidorLocal && idsRemotos.has(idServidorLocal)) return false;

    const firmaLocal = construirFirmaLoteRaw(item);
    if (firmaLocal && firmasRemotas.has(firmaLocal)) return false;

    return true;
  });
};

const normalizarNumero = (valor: unknown): number | null => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return numero;
};

const esErrorUniqueIdLote = (error: unknown): boolean => {
  const mensaje = error instanceof Error ? error.message : String(error);
  return /UNIQUE\s+constraint\s+failed:\s*lote\.id_lote/i.test(mensaje);
};

export function useLotes(rubro: RubroType): UseLotesResult {
  const rubroConfig = RUBRO_CONFIG[rubro];

  const [modalOpen, setModalOpen] = useState(false);
  const [mostrarCalculadora, setMostrarCalculadora] = useState(false);
  const [loteSeleccionadoIdServidor, setLoteSeleccionadoIdServidor] = useState<number | null>(null);
  const [loteSeleccionadoIdLocal, setLoteSeleccionadoIdLocal] = useState<number | null>(null);
  const [lotes, setLotes] = useState<LoteViewModel[]>([]);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [loteEditando, setLoteEditando] = useState<LoteViewModel | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [formEdicion, setFormEdicionState] = useState<FormEdicionLote>({
    nombre: '',
    tipoCultivo: '',
    ubicacion: '',
    superficie: '',
    fechaSiembraIso: '',
    fechaCosechaIso: '',
    fotoSiembra: '',
  });
  const [diagnosticoCarga, setDiagnosticoCarga] = useState('');
  const [mensajeSync, setMensajeSync] = useState('');
  const [modalFotoVisible, setModalFotoVisible] = useState(false);
  const [fotoSeleccionada, setFotoSeleccionada] = useState('');


  ///ORDENAR DE MANERA QUE LOS LOCALES RECIENTES APAREZCAN PRIMERO, 
  // Y SI HAY LOCALES SIN ID_SERVIDOR, ORDENAR ESOS POR FECHA SIEMBRA O ID LOCAL
const ordenarLotesPorRecencia = useCallback((items: LoteViewModel[]) => {
  return [...items].sort((a, b) => {
    const idLocalA = a.idLocal ?? 0;
    const idLocalB = b.idLocal ?? 0;
    if (idLocalA !== idLocalB) {
      return idLocalB - idLocalA; // prioridad principal
    }
    const idServidorA = a.idServidor ?? 0;
    const idServidorB = b.idServidor ?? 0;

    return idServidorB - idServidorA; // desempate
  });
}, []);

  const setLotesOrdenados = useCallback(
    (items: LoteViewModel[]) => {
      setLotes(ordenarLotesPorRecencia(items));
    },
    [ordenarLotesPorRecencia]
  );

  const setFormEdicion = useCallback((value: FormEdicionLote) => {
    setFormEdicionState(value);
  }, []);

  const abrirVistaFoto = useCallback((uri: string) => {
    const uriResuelta = resolverUriImagen(uri);
    if (!uriResuelta) return;
    setFotoSeleccionada(uriResuelta);
    setModalFotoVisible(true);
  }, []);

  const cerrarVistaFoto = useCallback(() => {
    setModalFotoVisible(false);
    setFotoSeleccionada('');
  }, []);

  const cargarLotesLocalesInmediato = useCallback(async () => {
    const esLoteQuinua = (item: any) => {
      const idProducto = Number(item.id_producto || 0);
      if (idProducto === 1) return true;
      const variedad = String(item.variedad ?? '').toLowerCase();
      const nombre = String(item.nombre_lote ?? '').toLowerCase();
      return variedad.includes('quinua') || nombre.includes('quinua');
    };

    const esLoteHortaliza = (item: any) => {
      const idProducto = Number(item.id_producto || 0);
      if (idProducto === 2 || idProducto === 3) return true;
      const variedad = String(item.variedad ?? '').toLowerCase();
      const nombre = String(item.nombre_lote ?? '').toLowerCase();
      return variedad.includes('hortaliza') || nombre.includes('hortaliza') || variedad.includes('haba') || nombre.includes('haba');
    };

    const mapearRapido = (item: any): LoteViewModel => {
      const superficie = Number(item.superficie || 0);
      const rendimiento = Number(item.rendimiento_estimado || 0);
      const precio = Number(item.precio_venta_est || 0);
      const ingresoEstimado = rendimiento * precio;
      const { progreso, faseActual } = calcularProgresoYCiclo(item.fecha_siembra, item.fecha_cosecha_est);

      const defaultVariedad = rubro === 'quinua'
        ? rubroConfig.defaultVariedad
        : (item.id_producto === 3 ? 'Haba' : rubroConfig.defaultVariedad);

      return {
        key: `local-${item.id_local}`,
        id: item.id_servidor || item.id_local,
        idLocal: item.id_local,
        idServidor: item.id_servidor,
        idProducto: item.id_producto,
        codigo: item.id_servidor
          ? `${rubroConfig.codePrefix}-BD-${item.id_servidor}`
          : `${rubroConfig.codePrefix}-LOCAL-${item.id_local}`,
        nombre: item.nombre_lote || `Lote ${item.id_local}`,
        producto: rubroConfig.defaultProductName,
        tipoProducto: item.variedad || defaultVariedad,
        imagen: resolverUriImagen(item.foto_siembra_uri_local || item.foto_siembra_url, rubroConfig.defaultImage),
        imagenRemota: resolverUriImagen(item.foto_siembra_url || item.foto_siembra_uri_local) || null,
        area: superficie,
        comunidad: item.ubicacion || 'No especificada',
        fechaSiembra: formatearFecha(item.fecha_siembra),
        cosechaEstimada: formatearFecha(item.fecha_cosecha_est),
        fechaSiembraIso: item.fecha_siembra,
        fechaCosechaIso: item.fecha_cosecha_est,
        rendimientoEstimado: rendimiento > 0 ? rendimiento : 1,
        precioVentaEst: precio > 0 ? precio : 1,
        progreso,
        estado: item.estado_sincronizacion === 'SINCRONIZADO' ? rubroConfig.quickSyncedLabel : rubroConfig.quickPendingLabel,
        estadoColor: item.estado_sincronizacion === 'SINCRONIZADO' ? '#2eaa51' : '#f59e0b',
        faseActual,
        estadoRaw: item.estado_sincronizacion === 'SINCRONIZADO' ? 'ACTIVO' : 'ACTIVO',
        inversion: 0,
        ingresoEstimado,
        proyeccion: ingresoEstimado,
        mostrarCosecha: false,
      };
    };

    const datosLocales = await obtenerLotesLocales();
    const filtro = rubro === 'quinua' ? esLoteQuinua : esLoteHortaliza;
    const filtrados = Array.isArray(datosLocales) ? datosLocales.filter(filtro) : [];
    const visibles = filtrados.length > 0 ? filtrados : (Array.isArray(datosLocales) ? datosLocales : []);
    const mapeados = visibles.map(mapearRapido);
    setLotesOrdenados(mapeados);
    setDiagnosticoCarga(`Carga rapida local: ${mapeados.length}`);
  }, [rubro, rubroConfig]);

  const cargarLotesLocales = useCallback(async () => {
    const sincronizarCacheLocalConRemotos = async (remotos: any[], localesActuales: any[]) => {
      const idsLocalesServidor = new Set(
        (Array.isArray(localesActuales) ? localesActuales : [])
          .map((item) => normalizarIdServidor(item?.id_servidor))
          .filter((id): id is number => id !== null)
      );

      for (const remoto of remotos) {
        const idServidor = normalizarIdServidor(remoto?.id_lote);
        if (!idServidor) continue;

        const payload = {
          id_servidor: idServidor,
          id_producto: Number(remoto?.id_producto ?? rubroConfig.fallbackProductoId),
          nombre_lote: String(remoto?.nombre_lote ?? `Lote ${idServidor}`),
          ubicacion: remoto?.ubicacion ? String(remoto.ubicacion) : null,
          variedad: remoto?.variedad ? String(remoto.variedad) : null,
          superficie: normalizarNumero(remoto?.superficie),
          fecha_siembra: String(remoto?.fecha_siembra ?? ''),
          fecha_cosecha_est: String(remoto?.fecha_cosecha_est ?? ''),
          rendimiento_estimado: normalizarNumero(remoto?.rendimiento_estimado),
          precio_venta_est: normalizarNumero(remoto?.precio_venta_est),
          foto_siembra_uri_local: remoto?.foto_siembra_url ? String(remoto.foto_siembra_url) : null,
          estado_sincronizacion: 'SINCRONIZADO' as const,
        };

        if (idsLocalesServidor.has(idServidor)) {
          await actualizarLoteLocalPorServidor(idServidor, payload);
          continue;
        }

        try {
          await insertarLoteLocal(payload);
          idsLocalesServidor.add(idServidor);
        } catch (error) {
          if (esErrorUniqueIdLote(error)) {
            await actualizarLoteLocalPorServidor(idServidor, payload);
            idsLocalesServidor.add(idServidor);
            continue;
          }
          throw error;
        }
      }
    };

    const enriquecerConGastos = async (lotesBase: LoteViewModel[]) => {
      return Promise.all(
        lotesBase.map(async (lote) => {
          if (!lote.idServidor) return lote;

          try {
            const gastos = await obtenerGastosPorLoteApi(lote.idServidor);
            const inversion = gastos.reduce((acc: number, gasto: any) => acc + (Number(gasto.monto_total) || 0), 0);
            return {
              ...lote,
              inversion,
              proyeccion: (lote.ingresoEstimado || 0) - inversion,
            };
          } catch (error) {
            if (rubro === 'quinua') {
              console.warn(`No se pudieron cargar gastos del lote ${lote.idServidor}:`, error);
            }
            return lote;
          }
        })
      );
    };

    if (rubro === 'hortalizas') {
      const mapearLoteLocal = (item: any): LoteViewModel => {
        const superficie = Number(item.superficie || 0);
        const rendimiento = Number(item.rendimiento_estimado || 0);
        const precio = Number(item.precio_venta_est || 0);
        const ingresoEstimado = rendimiento * precio;
        const { progreso, faseActual } = calcularProgresoYCiclo(item.fecha_siembra, item.fecha_cosecha_est);

        return {
          key: `local-${item.id_local}`,
          id: item.id_servidor || item.id_local,
          idLocal: item.id_local,
          idServidor: item.id_servidor,
          idProducto: item.id_producto,
          codigo: item.id_servidor ? `H-BD-${item.id_servidor}` : `H-LOCAL-${item.id_local}`,
          nombre: item.nombre_lote || `Lote ${item.id_local}`,
          producto: 'Hortalizas',
          tipoProducto: item.variedad || (item.id_producto === 3 ? 'Haba' : 'Hortaliza'),
          imagen: resolverUriImagen(item.foto_siembra_uri_local || item.foto_siembra_url, 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800'),
          imagenRemota: resolverUriImagen(item.foto_siembra_url || item.foto_siembra_uri_local) || null,
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

      const mapearLoteBackend = (item: any): LoteViewModel => {
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
          codigo: `H-BD-${item.id_lote}`,
          nombre: item.nombre_lote || `Lote ${item.id_lote}`,
          producto: 'Hortalizas',
          tipoProducto: item.variedad || (item.id_producto === 3 ? 'Haba' : 'Hortaliza'),
          imagen: resolverUriImagen(item.foto_siembra_url, 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800'),
          imagenRemota: resolverUriImagen(item.foto_siembra_url) || null,
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

      const cargarVistaLocalRapida = async () => {
        try {
          const datosLocales = await obtenerLotesLocales();
          const locales = Array.isArray(datosLocales)
            ? datosLocales.filter((item: any) => item.id_producto === 2 || item.id_producto === 3)
            : [];
          const localesMapeados = locales.map(mapearLoteLocal);
          const localesConGastos = await enriquecerConGastos(localesMapeados);
          setLotesOrdenados(localesConGastos);
        } catch (errorLocal) {
          console.warn('No se pudieron cargar lotes locales rapidos de hortalizas:', errorLocal);
        }
      };

      await cargarVistaLocalRapida();

      try {
        await sincronizarSiembrasPendientes();
      } catch {
        // Si no hay red o backend disponible, se mantiene fallback local.
      }

      try {
        const [datosLocales, productosHortalizasNuevos, productosHortalizaLegacy, productosTuberculoLegacy] = await Promise.all([
          obtenerLotesLocales(),
          obtenerProductosPorCategoriaApi('Hortalizas'),
          obtenerProductosPorCategoriaApi('Hortaliza'),
          obtenerProductosPorCategoriaApi('Tuberculo'),
        ]);

        const idsProductoHortalizas = new Set<number>([
          2,
          3,
          ...(Array.isArray(productosHortalizasNuevos) ? productosHortalizasNuevos : []).map((producto: any) => producto.id_producto),
          ...(Array.isArray(productosHortalizaLegacy) ? productosHortalizaLegacy : []).map((producto: any) => producto.id_producto),
          ...(Array.isArray(productosTuberculoLegacy) ? productosTuberculoLegacy : []).map((producto: any) => producto.id_producto),
        ]);

        const lotesPorProducto = await Promise.all([...idsProductoHortalizas].map((idProducto) => obtenerLotesPorProductoApi(idProducto)));

        const locales = Array.isArray(datosLocales)
          ? datosLocales.filter((item: any) => idsProductoHortalizas.has(item.id_producto))
          : [];

        const remotos = deduplicarRemotosPorId(lotesPorProducto.flat());
        await sincronizarCacheLocalConRemotos(remotos, Array.isArray(datosLocales) ? datosLocales : []);

        const combinados = [...remotos.map(mapearLoteBackend)];

        const localesPendientes = filtrarLocalesNoDuplicados(locales, remotos);
        combinados.push(...localesPendientes.map(mapearLoteLocal));
        const combinadosConGastos = await enriquecerConGastos(combinados);
        setLotesOrdenados(combinadosConGastos);
      } catch (error) {
        console.warn('No se pudieron cargar lotes de hortalizas desde backend, usando local:', error);

        try {
          const datosLocales = await obtenerLotesLocales();
          const locales = Array.isArray(datosLocales)
            ? datosLocales.filter((item: any) => item.id_producto === 2 || item.id_producto === 3)
            : [];
          const localesMapeados = locales.map(mapearLoteLocal);
          const localesConGastos = await enriquecerConGastos(localesMapeados);
          setLotesOrdenados(localesConGastos);
        } catch (localError) {
          console.warn('No se pudieron cargar lotes locales de hortalizas:', localError);
          setLotes([]);
        }
      }

      return;
    }

    const categoriasQuinua = new Set(['quinua', 'grano']);
    const nombresQuinua = ['quinua'];

    const extraerIdProducto = (producto: any) => Number(producto.id_producto ?? producto.idLocal ?? 0);
    const extraerNombreProducto = (producto: any) => String(producto.nombre ?? '').trim();
    const extraerCategoriaProducto = (producto: any) => String(producto.categoria ?? '').trim();

    const esProductoQuinua = (producto: any) => {
      const categoria = extraerCategoriaProducto(producto).toLowerCase();
      const nombre = extraerNombreProducto(producto).toLowerCase();
      if (categoriasQuinua.has(categoria)) return true;
      return nombresQuinua.some((token) => nombre.includes(token));
    };

    const construirCatalogo = (productos: any[]) => {
      const mapaNombre = new Map<number, string>();
      const idsQuinua = new Set<number>();

      for (const producto of productos) {
        const id = extraerIdProducto(producto);
        if (!id) continue;

        const nombre = extraerNombreProducto(producto);
        if (nombre) {
          mapaNombre.set(id, nombre);
        }

        if (esProductoQuinua(producto)) {
          idsQuinua.add(id);
        }
      }

      idsQuinua.add(1);

      return { mapaNombre, idsQuinua };
    };

    const resolverNombreProducto = (idProducto: number, mapaNombre: Map<number, string>) => {
      const id = Number(idProducto || 0);
      if (!id) return 'Quinua';
      return mapaNombre.get(id) || 'Quinua';
    };

    const esLoteQuinuaFlexible = (item: any, idsProductoQuinua: Set<number>) => {
      const idProducto = Number(item.id_producto || 0);
      if (idsProductoQuinua.has(idProducto)) return true;

      const variedad = String(item.variedad ?? '').toLowerCase();
      const nombre = String(item.nombre_lote ?? '').toLowerCase();
      return variedad.includes('quinua') || nombre.includes('quinua');
    };

    const mapearLoteLocal = (item: any, mapaNombre: Map<number, string>): LoteViewModel => {
      const superficie = Number(item.superficie || 0);
      const rendimiento = Number(item.rendimiento_estimado || 0);
      const precio = Number(item.precio_venta_est || 0);
      const ingresoEstimado = rendimiento * precio;
      const { progreso, faseActual } = calcularProgresoYCiclo(item.fecha_siembra, item.fecha_cosecha_est);

      return {
        key: `local-${item.id_local}`,
        id: item.id_servidor || item.id_local,
        idLocal: item.id_local,
        idServidor: item.id_servidor,
        idProducto: item.id_producto,
        codigo: item.id_servidor ? `Q-BD-${item.id_servidor}` : `Q-LOCAL-${item.id_local}`,
        nombre: item.nombre_lote || `Lote ${item.id_local}`,
        producto: resolverNombreProducto(item.id_producto, mapaNombre),
        tipoProducto: item.variedad || 'Sin variedad',
        imagen: resolverUriImagen(item.foto_siembra_uri_local || item.foto_siembra_url, 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800'),
        imagenRemota: resolverUriImagen(item.foto_siembra_url || item.foto_siembra_uri_local) || null,
        area: superficie,
        comunidad: item.ubicacion || 'No especificada',
        fechaSiembra: formatearFecha(item.fecha_siembra),
        cosechaEstimada: formatearFecha(item.fecha_cosecha_est),
        fechaSiembraIso: item.fecha_siembra,
        fechaCosechaIso: item.fecha_cosecha_est,
        rendimientoEstimado: rendimiento > 0 ? rendimiento : 1,
        precioVentaEst: precio > 0 ? precio : 1,
        progreso,
        estado: item.estado_sincronizacion === 'SINCRONIZADO' ? 'Subiendo' : 'Pendiente Sync',
        estadoColor: item.estado_sincronizacion === 'SINCRONIZADO' ? '#2eaa51' : '#f59e0b',
        faseActual,
        estadoRaw: item.estado_sincronizacion === 'SINCRONIZADO' ? 'ACTIVO' : 'ACTIVO',
        inversion: 0,
        ingresoEstimado,
        proyeccion: ingresoEstimado,
        mostrarCosecha: false,
      };
    };

    const mapearLoteBackend = (item: any, mapaNombre: Map<number, string>): LoteViewModel => {
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
        producto: resolverNombreProducto(item.id_producto, mapaNombre),
        tipoProducto: item.variedad || 'Sin variedad',
        imagen: resolverUriImagen(item.foto_siembra_url, 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800'),
        imagenRemota: resolverUriImagen(item.foto_siembra_url) || null,
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

    const mapearTodosLocalesSinFiltro = (datosLocales: any[], mapaNombre: Map<number, string>) => {
      const origen = Array.isArray(datosLocales) ? datosLocales : [];
      return origen.map((item) => mapearLoteLocal(item, mapaNombre));
    };

    const cargarSoloLocales = async () => {
      const datosLocales = await obtenerLotesLocales();
      const idsBase = new Set([1]);
      const mapaNombreVacio = new Map<number, string>();
      const localesFiltradosBase = Array.isArray(datosLocales)
        ? datosLocales.filter((item: any) => esLoteQuinuaFlexible(item, idsBase))
        : [];
      const localesFiltrados = localesFiltradosBase.length > 0
        ? localesFiltradosBase
        : (Array.isArray(datosLocales) ? datosLocales : []);
      const localesMapeados = localesFiltrados.map((item) => mapearLoteLocal(item, mapaNombreVacio));
      return enriquecerConGastos(localesMapeados);
    };

    const cargarVistaLocalRapida = async (idsProductoQuinua: Set<number>, mapaNombre: Map<number, string>) => {
      try {
        const datosLocales = await obtenerLotesLocales();
        const localesFiltradosBase = Array.isArray(datosLocales)
          ? datosLocales.filter((item: any) => esLoteQuinuaFlexible(item, idsProductoQuinua))
          : [];
        const locales = localesFiltradosBase.length > 0
          ? localesFiltradosBase
          : (Array.isArray(datosLocales) ? datosLocales : []);
        const localesMapeados = locales.map((item) => mapearLoteLocal(item, mapaNombre));
        const localesConGastos = await enriquecerConGastos(localesMapeados);
        setDiagnosticoCarga(`SQLite local: ${Array.isArray(datosLocales) ? datosLocales.length : 0} | visibles: ${localesConGastos.length}`);
        setLotesOrdenados(localesConGastos);
      } catch (errorLocal) {
        console.warn('No se pudieron cargar lotes locales rapidos de quinua:', errorLocal);
        setDiagnosticoCarga('Error cargando SQLite local rapido');
      }
    };

    let lotesLocalesBootstrap: LoteViewModel[] = [];
    try {
      lotesLocalesBootstrap = await cargarSoloLocales();
      if (lotesLocalesBootstrap.length > 0) {
        setDiagnosticoCarga(`Bootstrap local visibles: ${lotesLocalesBootstrap.length}`);
        setLotesOrdenados(lotesLocalesBootstrap);
      } else {
        setDiagnosticoCarga('Bootstrap local sin lotes visibles');
      }
    } catch (errorLocalInicial) {
      console.warn('No se pudieron cargar lotes locales iniciales de quinua:', errorLocalInicial);
      setDiagnosticoCarga('Error en bootstrap local');
    }

    await sincronizarProductosPendientes().catch(() => {
      // Si falla la sincronizacion de catalogo, continuamos con datos locales.
    });

    try {
      const [datosLocales, productosLocales, productosQuinuaNuevos, productosQuinuaLegacy] = await Promise.all([
        obtenerLotesLocales(),
        listarProductosLocales(),
        obtenerProductosPorCategoriaApi('Quinua'),
        obtenerProductosPorCategoriaApi('Grano'),
      ]);

      const catalogo = construirCatalogo([
        ...(Array.isArray(productosLocales) ? productosLocales : []),
        ...(Array.isArray(productosQuinuaNuevos) ? productosQuinuaNuevos : []),
        ...(Array.isArray(productosQuinuaLegacy) ? productosQuinuaLegacy : []),
      ]);

      await cargarVistaLocalRapida(catalogo.idsQuinua, catalogo.mapaNombre);

      const lotesPorProducto = await Promise.all([...catalogo.idsQuinua].map((idProducto) => obtenerLotesPorProductoApi(idProducto)));

      const datosBackend = lotesPorProducto.flat();

      const locales = Array.isArray(datosLocales)
        ? datosLocales.filter((item: any) => esLoteQuinuaFlexible(item, catalogo.idsQuinua))
        : [];
      const localesFinales = locales.length > 0 ? locales : (Array.isArray(datosLocales) ? datosLocales : []);

      const remotos = deduplicarRemotosPorId(Array.isArray(datosBackend) ? datosBackend : []);
      await sincronizarCacheLocalConRemotos(remotos, Array.isArray(datosLocales) ? datosLocales : []);

      const combinados = [...remotos.map((item: any) => mapearLoteBackend(item, catalogo.mapaNombre))];

      const localesPendientes = filtrarLocalesNoDuplicados(localesFinales, remotos);
      combinados.push(...localesPendientes.map((item: any) => mapearLoteLocal(item, catalogo.mapaNombre)));
      const combinadosConGastos = await enriquecerConGastos(combinados);
      if (combinadosConGastos.length > 0) {
        setDiagnosticoCarga(`Remotos: ${remotos.length} | locales usados: ${localesPendientes.length} | visibles: ${combinadosConGastos.length}`);
        setLotesOrdenados(combinadosConGastos);
      } else {
        const todosLocalesMapeados = mapearTodosLocalesSinFiltro(datosLocales, catalogo.mapaNombre);
        const todosLocalesConGastos = await enriquecerConGastos(todosLocalesMapeados);
        setDiagnosticoCarga(`Fallback total SQLite: ${todosLocalesConGastos.length}`);
        setLotesOrdenados(todosLocalesConGastos);
      }
    } catch (error) {
      console.warn('No se pudieron cargar lotes de quinua desde backend, usando local:', error);

      try {
        const [datosLocales, productosLocales] = await Promise.all([
          obtenerLotesLocales(),
          listarProductosLocales(),
        ]);

        const catalogo = construirCatalogo(Array.isArray(productosLocales) ? productosLocales : []);
        const localesFiltradosBase = Array.isArray(datosLocales)
          ? datosLocales.filter((item: any) => esLoteQuinuaFlexible(item, catalogo.idsQuinua))
          : [];
        const locales = localesFiltradosBase.length > 0
          ? localesFiltradosBase
          : (Array.isArray(datosLocales) ? datosLocales : []);
        const localesMapeados = locales.map((item) => mapearLoteLocal(item, catalogo.mapaNombre));
        const localesConGastos = await enriquecerConGastos(localesMapeados);
        if (localesConGastos.length > 0) {
          setDiagnosticoCarga(`Fallback local visibles: ${localesConGastos.length}`);
          setLotesOrdenados(localesConGastos);
        } else {
          const todosLocalesMapeados = mapearTodosLocalesSinFiltro(datosLocales, catalogo.mapaNombre);
          const todosLocalesConGastos = await enriquecerConGastos(todosLocalesMapeados);
          setDiagnosticoCarga(`Fallback total SQLite: ${todosLocalesConGastos.length}`);
          setLotesOrdenados(todosLocalesConGastos);
        }
      } catch (localError) {
        console.warn('No se pudieron cargar lotes locales de quinua:', localError);
        if (lotesLocalesBootstrap.length > 0) {
          setDiagnosticoCarga(`Se mantiene bootstrap: ${lotesLocalesBootstrap.length}`);
          setLotesOrdenados(lotesLocalesBootstrap);
        } else {
          setDiagnosticoCarga('Sin datos para mostrar');
        }
      }
    }
  }, [rubro]);

  useEffect(() => {
    iniciarSincronizacionAutomaticaSiembras();
    void cargarLotesLocalesInmediato();
    void cargarLotesLocales();

    if (rubroConfig.stopAutoSyncOnUnmount) {
      return () => {
        detenerSincronizacionAutomaticaSiembras();
      };
    }

    return;
  }, [cargarLotesLocales, cargarLotesLocalesInmediato, rubroConfig.stopAutoSyncOnUnmount]);

  useEffect(() => {
    if (!modalOpen) {
      void cargarLotesLocalesInmediato();
      void cargarLotesLocales();
    }
  }, [modalOpen, cargarLotesLocales, cargarLotesLocalesInmediato]);

  useEffect(() => {
    const unsubscribe = suscribirEventosSincronizacionSiembras((evento: any) => {
      if (evento.tipo === 'LOTE_SINCRONIZADO') {
        setMensajeSync(`Lote ${evento.idLocal} sincronizado con backend.`);
      }

      if (evento.tipo === 'SINCRONIZACION_COMPLETADA' && evento.sincronizados > 0) {
        setMensajeSync(`Sincronizacion completada: ${evento.sincronizados}/${evento.procesados} lote(s).`);
        void cargarLotesLocales();
      }
    });

    return unsubscribe;
  }, [cargarLotesLocales]);

  const manejarCreacionLote = useCallback(async () => {
    setMensajeSync('Siembra creada en PENDIENTE. Se subira cuando haya conexion con backend.');
    await cargarLotesLocalesInmediato();

    void sincronizarSiembrasPendientes().catch(() => {
      // Si falla backend/red, queda pendiente para reintento automatico.
    });

    void cargarLotesLocales();
  }, [cargarLotesLocales, cargarLotesLocalesInmediato]);

  const abrirModalEdicion = useCallback((lote: LoteViewModel) => {
    setLoteEditando(lote);
    setFormEdicionState({
      nombre: lote.nombre || '',
      tipoCultivo: lote.tipoProducto || '',
      ubicacion: lote.comunidad === 'Comunidad registrada' ? '' : (lote.comunidad || ''),
      superficie: String(lote.area || ''),
      fechaSiembraIso: lote.fechaSiembraIso || '',
      fechaCosechaIso: lote.fechaCosechaIso || '',
      fotoSiembra: lote.imagenRemota || lote.imagen || '',
    });
    setModalEditarOpen(true);
  }, []);

  const guardarEdicionLote = useCallback(async () => {
    if (!loteEditando) return;

    const nombre = formEdicion.nombre.trim();
    const tipoCultivo = formEdicion.tipoCultivo.trim();
    const ubicacion = formEdicion.ubicacion.trim();
    const superficie = Number(formEdicion.superficie);
    const fechaSiembraIso = formEdicion.fechaSiembraIso.trim();
    const fechaCosechaIso = formEdicion.fechaCosechaIso.trim();
    const fotoSiembra = formEdicion.fotoSiembra.trim();

    if (!nombre || !tipoCultivo || !ubicacion || !superficie || superficie <= 0 || !fechaSiembraIso || !fechaCosechaIso) {
      Alert.alert('Datos invalidos', 'Completa nombre, tipo, ubicacion, superficie y fechas validas.');
      return;
    }

    setGuardandoEdicion(true);
    try {
      if (loteEditando.idLocal) {
        await actualizarLoteLocal(loteEditando.idLocal, {
          nombre_lote: nombre,
          variedad: tipoCultivo,
          ubicacion,
          superficie,
          fecha_siembra: fechaSiembraIso,
          fecha_cosecha_est: fechaCosechaIso,
          foto_siembra_uri_local: fotoSiembra || null,
        });
      } else if (loteEditando.idServidor) {
        await actualizarLoteLocalPorServidor(loteEditando.idServidor, {
          nombre_lote: nombre,
          variedad: tipoCultivo,
          ubicacion,
          superficie,
          fecha_siembra: fechaSiembraIso,
          fecha_cosecha_est: fechaCosechaIso,
          foto_siembra_uri_local: fotoSiembra || null,
        });
      }

      setLotes((actuales) =>
        ordenarLotesPorRecencia(
          actuales.map((item) =>
          item.key === loteEditando.key
            ? {
                ...item,
                nombre,
                tipoProducto: tipoCultivo,
                comunidad: ubicacion,
                area: superficie,
                fechaSiembraIso,
                fechaCosechaIso,
                fechaSiembra: formatearFecha(fechaSiembraIso),
                cosechaEstimada: formatearFecha(fechaCosechaIso),
                imagen: resolverUriImagen(fotoSiembra, item.imagen),
                imagenRemota: fotoSiembra || null,
              }
            : item
          )
        )
      );

      setModalEditarOpen(false);
      setLoteEditando(null);
      Alert.alert('Listo', 'Lote actualizado correctamente.');

      if (loteEditando.idServidor) {
        void actualizarLoteApi(loteEditando.idServidor, {
          nombre_lote: nombre,
          superficie,
          fecha_siembra: fechaSiembraIso,
          fecha_cosecha_est: fechaCosechaIso,
          rendimiento_estimado: loteEditando.rendimientoEstimado,
          precio_venta_est: loteEditando.precioVentaEst,
          estado: loteEditando.estadoRaw || 'ACTIVO',
          foto_siembra_url: fotoSiembra || null,
          ubicacion: ubicacion || null,
          variedad: tipoCultivo,
          id_productor: 1,
          id_producto: loteEditando.idProducto || rubroConfig.fallbackProductoId,
        })
          .then(() => {
            void cargarLotesLocales();
          })
          .catch((error) => {
            const mensaje = error instanceof Error ? error.message : 'No se pudo sincronizar la edición en backend';
            setMensajeSync(`Edicion guardada localmente. Pendiente backend: ${mensaje}`);
          });
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo actualizar el lote';
      Alert.alert('Error', mensaje);
    } finally {
      setGuardandoEdicion(false);
    }
  }, [cargarLotesLocales, formEdicion.nombre, formEdicion.superficie, loteEditando, ordenarLotesPorRecencia, rubroConfig.fallbackProductoId]);

  const eliminarLote = useCallback((lote: LoteViewModel) => {
    Alert.alert('Eliminar lote', `¿Seguro que quieres eliminar "${lote.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            setLotes((actuales) => actuales.filter((item) => item.key !== lote.key));

            if (lote.idLocal) {
              await eliminarLoteLocal(lote.idLocal);
            } else if (lote.idServidor) {
              await eliminarLoteLocalPorServidor(lote.idServidor);
            }

            Alert.alert('Listo', 'Lote eliminado correctamente.');

            if (lote.idServidor) {
              void eliminarLoteApi(lote.idServidor)
                .then(() => {
                  void cargarLotesLocales();
                })
                .catch((error) => {
                  const mensaje = error instanceof Error ? error.message : 'No se pudo sincronizar la eliminación en backend';
                  setMensajeSync(`Eliminado localmente. Pendiente backend: ${mensaje}`);
                });
            }
          } catch (error) {
            void cargarLotesLocales();
            const mensaje = error instanceof Error ? error.message : 'No se pudo eliminar el lote';
            Alert.alert('Error', mensaje);
          }
        },
      },
    ]);
  }, [cargarLotesLocales]);

  const stats = {
    lotesActivos: lotes.length,
    areaTotal: lotes.reduce((acc, lote) => acc + Number(lote.area || 0), 0),
    inversionTotal: lotes.reduce((acc, lote) => acc + Number(lote.inversion || 0), 0),
    ingresosProyectados: lotes.reduce((acc, lote) => acc + Number(lote.proyeccion || 0), 0),
  };

  return {
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
  };
}
