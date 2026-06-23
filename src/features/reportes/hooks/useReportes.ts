import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { obtenerCostosLocalesPorLote, obtenerLotesLocales } from '@/src/modules/costos/costos.repository';
import { descargarDatosServidorALocal } from '@/src/modules/siembra/siembra.sync';
import { suscribirEventosGastos } from '@/src/modules/gastos/gastos.events';
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
  'otros',
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


async function calcularInversionPorLotes(
  lotesBase: ReporteLoteBase[]
): Promise<ReporteLote[]> {
  const lotesConInversion = await Promise.all(
    lotesBase.map(async (lote) => {
      const gastosLocales = await obtenerCostosLocalesPorLote({
        idLoteLocal: lote.idLocal ?? undefined,
        idLoteServidor: lote.idServidor ?? undefined,
      }).catch(() => [] as CostosLocalesLote);

      const gastosLocalesMapeados = gastosLocales.map(mapearGastoLocal);
      const totalInvertido = gastosLocalesMapeados.reduce((acc, gasto) => acc + Number(gasto.total || 0), 0);

      return {
        ...lote,
        totalInvertido,
        gastos: gastosLocalesMapeados,
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
        const netState = await NetInfo.fetch();
        const hayInternet = Boolean(netState.isConnected) && netState.isInternetReachable !== false;

        if (hayInternet) {
          try {
            await descargarDatosServidorALocal();
          } catch (e) {
            console.warn('Error al descargar datos del servidor:', e);
          }
        }

        const lotesLocalesRaw = await obtenerLotesLocales().catch(() => [] as Awaited<ReturnType<typeof obtenerLotesLocales>>);
        const localesMapeados = lotesLocalesRaw.map(mapearLoteLocal);
        const lotesLocalesConInversion = await calcularInversionPorLotes(localesMapeados);
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
          estaEnLinea: hayInternet,
          origenDatos: [`SQLite: ${lotesLocalesConInversion.length}`],
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

  useEffect(() => {
    const unsubscribe = suscribirEventosGastos(() => {
      setRefreshToken((valor) => valor + 1);
    });

    return unsubscribe;
  }, []);

  return {
    ...estado,
    recargar,
  };
}