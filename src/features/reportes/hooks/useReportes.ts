import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { obtenerCostosLocalesPorLote, obtenerLotesLocales } from '@/src/services/database';
import { obtenerGastosPorLoteApi, obtenerLotesPorTipoCultivoApi, type GastoApi, type LoteApi } from '@/src/services/api';
import { inferirFaseDesdeCategoria, obtenerEstrategiaCalculo, obtenerUnidadCategoria } from '../../calculadoraCostos/utils/estrategiasCalculo';

type CostosLocalesLote = Awaited<ReturnType<typeof obtenerCostosLocalesPorLote>>;

type ReporteLoteBase = {
  id: string;
  idLocal: number | null;
  idServidor: number | null;
  createdAtIso: string;
  tipoCultivo: string;
  nombre: string;
  variedad: string;
  fechaSiembra: string;
  fechaCosechaEst: string;
  superficie: number | null;
  origen: 'LOCAL' | 'BACKEND' | 'MIXTO';
  gastos: ReporteGasto[];
};

export type ReporteGasto = {
  id: string;
  nombre: string;
  descripcion: string;
  fase: 'Siembra' | 'Crecimiento' | 'Cosecha';
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  fechaGasto: string;
  origen: 'LOCAL' | 'BACKEND';
};

export type ReporteLote = ReporteLoteBase & {
  totalInvertido: number;
};

type EstadoReportes = {
  inversionTotalAcumulada: number;
  costosLocales: number;
  costosSubidos: number;
  cantidadLotes: number;
  lotes: ReporteLote[];
  loading: boolean;
  error: string | null;
  estaEnLinea: boolean;
  origenDatos: string[];
};

const estadoInicial: EstadoReportes = {
  inversionTotalAcumulada: 0,
  costosLocales: 0,
  costosSubidos: 0,
  cantidadLotes: 0,
  lotes: [],
  loading: true,
  error: null,
  estaEnLinea: false,
  origenDatos: [],
};

const TIPOS_CULTIVO_BASE = [
  'quinua',
  'grano',
  'hortaliza',
  'haba',
  'papa',
  'cebolla',
  'zanahoria',
  'beterraga',
  'nabo',
  'lechuga',
  'tuberculo',
];
const BACKEND_TIMEOUT_MS = 3500;

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

function obtenerTimestamp(iso: string): number {
  const valor = Date.parse(String(iso || '').trim());
  return Number.isFinite(valor) ? valor : 0;
}

function elegirCreatedAtMasReciente(a: string, b: string): string {
  return obtenerTimestamp(a) >= obtenerTimestamp(b) ? a : b;
}

function normalizarNumero(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function mapearGastoLocal(item: Awaited<ReturnType<typeof obtenerCostosLocalesPorLote>>[number]): ReporteGasto {
  const cantidad = normalizarNumero(item.cantidad);
  const precioUnitario = normalizarNumero(item.costo_unitario);
  const total = normalizarNumero(item.monto_total || cantidad * precioUnitario);
  const nombre = String(item.categoria ?? '').trim() || 'Gasto';
  const estrategia = obtenerEstrategiaCalculo('quinua');
  const fase = inferirFaseDesdeCategoria(item.categoria, item.tipo_costo, estrategia.categoriasPorFase);

  return {
    id: `local-${item.id_local}`,
    nombre,
    descripcion: String(item.descripcion ?? '').trim(),
    fase,
    unidad: obtenerUnidadCategoria(item.categoria),
    cantidad,
    precioUnitario,
    total,
    fechaGasto: String(item.fecha_gasto ?? ''),
    origen: 'LOCAL',
  };
}

function mapearGastoBackend(item: GastoApi): ReporteGasto {
  const cantidad = normalizarNumero(item.cantidad);
  const precioUnitario = normalizarNumero(item.costo_unitario);
  const total = normalizarNumero(item.monto_total || cantidad * precioUnitario);
  const nombre = String(item.categoria ?? '').trim() || 'Gasto';
  const estrategia = obtenerEstrategiaCalculo('quinua');
  const fase = inferirFaseDesdeCategoria(item.categoria, undefined, estrategia.categoriasPorFase);

  return {
    id: `backend-${item.id_gasto}`,
    nombre,
    descripcion: String(item.descripcion ?? '').trim(),
    fase,
    unidad: obtenerUnidadCategoria(item.categoria),
    cantidad,
    precioUnitario,
    total,
    fechaGasto: String(item.fecha_gasto ?? ''),
    origen: 'BACKEND',
  };
}

function firmaGasto(gasto: Pick<ReporteGasto, 'nombre' | 'unidad' | 'cantidad' | 'precioUnitario' | 'fechaGasto'>): string {
  return [
    normalizarTexto(gasto.nombre),
    normalizarTexto(gasto.unidad),
    gasto.cantidad.toFixed(4),
    gasto.precioUnitario.toFixed(4),
    normalizarTexto(gasto.fechaGasto),
  ].join('|');
}

function unirGastos(locales: ReporteGasto[], backend: ReporteGasto[]): ReporteGasto[] {
  const vistos = new Set<string>();
  const resultado: ReporteGasto[] = [];

  for (const gasto of backend) {
    const firma = firmaGasto(gasto);
    vistos.add(firma);
    resultado.push(gasto);
  }

  for (const gasto of locales) {
    const firma = firmaGasto(gasto);
    if (vistos.has(firma)) continue;
    resultado.push(gasto);
  }

  return resultado.sort((a, b) => obtenerTimestamp(b.fechaGasto) - obtenerTimestamp(a.fechaGasto));
}

function mapearLoteLocal(item: Awaited<ReturnType<typeof obtenerLotesLocales>>[number]): ReporteLoteBase {
  const idServidor = item.id_servidor ?? null;
  const createdAtIso = String(item.created_at ?? item.fecha_siembra ?? '');

  return {
    id: idServidor ? `server-${idServidor}` : `local-${item.id_local}`,
    idLocal: item.id_local,
    idServidor,
    createdAtIso,
    tipoCultivo: String(item.tipo_cultivo ?? item.variedad ?? ''),
    nombre: String(item.nombre_lote ?? '').trim() || `Lote ${item.id_local}`,
    variedad: String(item.tipo_cultivo ?? item.variedad ?? '').trim() || 'Sin variedad',
    fechaSiembra: String(item.fecha_siembra ?? ''),
    fechaCosechaEst: String(item.fecha_cosecha_est ?? ''),
    superficie: item.superficie,
    origen: idServidor ? 'MIXTO' : 'LOCAL',
    gastos: [],
  };
}

function mapearLoteBackend(item: LoteApi): ReporteLoteBase {
  const idServidor = Number(item.id_lote);
  const createdAtIso = String(item.created_at ?? item.fecha_siembra ?? '');

  return {
    id: `server-${idServidor}`,
    idLocal: null,
    idServidor: Number.isFinite(idServidor) && idServidor > 0 ? idServidor : null,
    createdAtIso,
    tipoCultivo: String(item.tipo_cultivo ?? item.variedad ?? ''),
    nombre: String(item.nombre_lote ?? '').trim() || `Lote ${item.id_lote}`,
    variedad: String(item.tipo_cultivo ?? item.variedad ?? '').trim() || 'Sin variedad',
    fechaSiembra: String(item.fecha_siembra ?? ''),
    fechaCosechaEst: String(item.fecha_cosecha_est ?? ''),
    superficie: Number(item.superficie ?? 0),
    origen: 'BACKEND',
    gastos: [],
  };
}

async function conTimeout<T>(promesa: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
  });

  const resultado = await Promise.race([promesa, timeoutPromise]);
  if (timeoutId) clearTimeout(timeoutId);
  return resultado;
}

function unirLotes(
  localesMapeados: ReporteLoteBase[],
  backendMapeados: ReporteLoteBase[]
): ReporteLoteBase[] {
  const indicesPorServidor = new Map<number, number>();
  const combinados: ReporteLoteBase[] = [];

  for (const lote of localesMapeados) {
    const indice = combinados.push(lote) - 1;
    if (lote.idServidor !== null) {
      indicesPorServidor.set(lote.idServidor, indice);
    }
  }

  for (const loteBackend of backendMapeados) {
    const indiceCoincidencia =
      loteBackend.idServidor !== null ? indicesPorServidor.get(loteBackend.idServidor) : undefined;

    if (indiceCoincidencia !== undefined) {
      const coincidencia = combinados[indiceCoincidencia];
      const actualizado: ReporteLoteBase = {
        ...coincidencia,
        id: loteBackend.idServidor ? `server-${loteBackend.idServidor}` : coincidencia.id,
        idServidor: loteBackend.idServidor ?? coincidencia.idServidor,
        createdAtIso: elegirCreatedAtMasReciente(coincidencia.createdAtIso, loteBackend.createdAtIso),
        tipoCultivo: coincidencia.tipoCultivo || loteBackend.tipoCultivo,
        nombre: coincidencia.nombre || loteBackend.nombre,
        variedad: coincidencia.variedad || loteBackend.variedad,
        fechaSiembra: coincidencia.fechaSiembra || loteBackend.fechaSiembra,
        fechaCosechaEst: coincidencia.fechaCosechaEst || loteBackend.fechaCosechaEst,
        superficie: coincidencia.superficie ?? loteBackend.superficie,
        origen: coincidencia.idServidor || loteBackend.idServidor ? 'MIXTO' : 'LOCAL',
        gastos: coincidencia.gastos.length > 0 ? coincidencia.gastos : loteBackend.gastos,
      };

      combinados[indiceCoincidencia] = actualizado;
      if (actualizado.idServidor !== null) {
        indicesPorServidor.set(actualizado.idServidor, indiceCoincidencia);
      }
    } else {
      const nuevoIndice = combinados.push(loteBackend) - 1;
      if (loteBackend.idServidor !== null) {
        indicesPorServidor.set(loteBackend.idServidor, nuevoIndice);
      }
    }
  }

  return combinados;
}

async function calcularInversionPorLotes(
  lotesBase: ReporteLoteBase[],
  incluirGastosBackend: boolean
): Promise<ReporteLote[]> {
  const lotesConInversion = await Promise.all(
    lotesBase.map(async (lote) => {
      const gastosLocales = await obtenerCostosLocalesPorLote({
        idLoteLocal: lote.idLocal ?? undefined,
        idLoteServidor: lote.idServidor ?? undefined,
      }).catch(() => [] as CostosLocalesLote);

      let gastosBackend: GastoApi[] = [];
      let remotoDisponible = false;

      if (incluirGastosBackend && lote.idServidor) {
        gastosBackend = await conTimeout(
          obtenerGastosPorLoteApi(lote.idServidor).catch(() => []),
          BACKEND_TIMEOUT_MS,
          []
        );
        remotoDisponible = gastosBackend.length > 0;
      }

      const gastosLocalesMapeados = gastosLocales.map(mapearGastoLocal);
      const gastosBackendMapeados = gastosBackend.map(mapearGastoBackend);
      const gastosUnificados = remotoDisponible
        ? unirGastos(gastosLocalesMapeados, gastosBackendMapeados)
        : gastosLocalesMapeados;
      const totalInvertido = gastosUnificados.reduce((acc, gasto) => acc + Number(gasto.total || 0), 0);

      return {
        ...lote,
        totalInvertido,
        gastos: gastosUnificados,
      };
    })
  );

  return lotesConInversion.sort((a, b) => {
    const timestampA = obtenerTimestamp(a.createdAtIso);
    const timestampB = obtenerTimestamp(b.createdAtIso);
    if (timestampA !== timestampB) return timestampB - timestampA;

    const servidorA = a.idServidor ?? 0;
    const servidorB = b.idServidor ?? 0;
    if (servidorA !== servidorB) return servidorB - servidorA;

    const localA = a.idLocal ?? 0;
    const localB = b.idLocal ?? 0;
    return localB - localA;
  });
}

export function useReportes() {
  const [estado, setEstado] = useState<EstadoReportes>(estadoInicial);
  const [refreshToken, setRefreshToken] = useState(0);

  const recargar = useCallback(() => {
    setRefreshToken((valor) => valor + 1);
  }, []);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      setEstado((actual) => ({ ...actual, loading: true, error: null }));

      try {
        const lotesLocalesRaw = await obtenerLotesLocales().catch(() => [] as Awaited<ReturnType<typeof obtenerLotesLocales>>);
        const localesMapeados = lotesLocalesRaw.map(mapearLoteLocal);
        const lotesLocalesConInversion = await calcularInversionPorLotes(localesMapeados, false);
        const inversionLocal = lotesLocalesConInversion.reduce(
          (total, lote) => total + Number(lote.totalInvertido || 0),
          0
        );

        if (!activo) return;

        setEstado({
          inversionTotalAcumulada: inversionLocal,
          costosLocales: inversionLocal,
          costosSubidos: 0,
          cantidadLotes: lotesLocalesConInversion.length,
          lotes: lotesLocalesConInversion,
          loading: false,
          error: null,
          estaEnLinea: false,
          origenDatos: [`SQLite: ${lotesLocalesConInversion.length}`],
        });

        const netState = await NetInfo.fetch();
        const hayInternet = Boolean(netState.isConnected) && netState.isInternetReachable !== false;

        if (!hayInternet || !activo) {
          setEstado((actual) => ({ ...actual, estaEnLinea: false }));
          return;
        }

        const tiposCultivo = new Set<string>([
          ...TIPOS_CULTIVO_BASE,
          ...lotesLocalesRaw
            .map((item) => String(item.tipo_cultivo ?? item.variedad ?? '').trim().toLowerCase())
            .filter(Boolean),
        ]);

        const lotesBackendResultados = await Promise.allSettled(
          [...tiposCultivo].map((tipo) => conTimeout(obtenerLotesPorTipoCultivoApi(tipo), BACKEND_TIMEOUT_MS, []))
        );
        const lotesBackend = lotesBackendResultados.flatMap((resultado) =>
          resultado.status === 'fulfilled' ? resultado.value : []
        );

        const backendMapeados = lotesBackend.map(mapearLoteBackend);
        const lotesCombinados = unirLotes(localesMapeados, backendMapeados);
        const lotesMixtosConInversion = await calcularInversionPorLotes(lotesCombinados, true);
        const inversionTotalAcumulada = lotesMixtosConInversion.reduce(
          (total, lote) => total + Number(lote.totalInvertido || 0),
          0
        );
        const costosLocales = lotesMixtosConInversion.reduce(
          (total, lote) => total + lote.gastos.reduce((acc, gasto) => acc + (gasto.origen === 'LOCAL' ? Number(gasto.total || 0) : 0), 0),
          0
        );
        const costosSubidos = lotesMixtosConInversion.reduce(
          (total, lote) => total + lote.gastos.reduce((acc, gasto) => acc + (gasto.origen === 'BACKEND' ? Number(gasto.total || 0) : 0), 0),
          0
        );

        if (!activo) return;

        setEstado({
          inversionTotalAcumulada,
          costosLocales,
          costosSubidos,
          cantidadLotes: lotesMixtosConInversion.length,
          lotes: lotesMixtosConInversion,
          loading: false,
          error: null,
          estaEnLinea: true,
          origenDatos: [`SQLite: ${localesMapeados.length}`, `Backend: ${backendMapeados.length}`],
        });
      } catch (error) {
        if (!activo) return;

        setEstado({
          inversionTotalAcumulada: 0,
          costosLocales: 0,
          costosSubidos: 0,
          cantidadLotes: 0,
          lotes: [],
          loading: false,
          error: error instanceof Error ? error.message : 'No se pudieron cargar los reportes.',
          estaEnLinea: false,
          origenDatos: [],
        });
      }
    };

    void cargar();

    return () => {
      activo = false;
    };
  }, [refreshToken]);

  return {
    ...estado,
    recargar,
  };
}