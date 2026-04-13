import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  obtenerGastosPorLoteApi,
  obtenerUltimaProduccionLoteApi,
} from '@/src/services/api';
import {
  obtenerCostosLocalesPorLote,
  obtenerBorradorProduccionLocal,
} from '@/src/services/database';
import { Gasto, ResultadoCalculos, RubroResultado } from '../types';

const KG_POR_QUINTAL = 46;
const DB_READ_TIMEOUT_MS = 4000;

type UseResultadosOptions = {
  idLoteServidor?: number;
  idLoteLocal?: number;
};

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

function firmaGasto(gasto: Pick<Gasto, 'categoria' | 'descripcion' | 'cantidad' | 'monto'>): string {
  return [
    normalizarTexto(gasto.categoria),
    normalizarTexto(gasto.descripcion),
    normalizarTexto(gasto.cantidad),
    normalizarTexto(gasto.monto),
  ].join('|');
}

function unirGastosSinDuplicar(gastosApi: Gasto[], gastosLocales: Gasto[]): Gasto[] {
  const vistos = new Set<string>();
  const resultado: Gasto[] = [];

  for (const gasto of gastosApi) {
    const firma = firmaGasto(gasto);
    if (vistos.has(firma)) continue;
    vistos.add(firma);
    resultado.push(gasto);
  }

  for (const gasto of gastosLocales) {
    const firma = firmaGasto(gasto);
    if (vistos.has(firma)) continue;
    vistos.add(firma);
    resultado.push(gasto);
  }

  return resultado;
}

export function useResultados(
  idLote: number | undefined,
  rubro: RubroResultado,
  options?: UseResultadosOptions
) {
  const idLoteServidorRaw = options?.idLoteServidor;
  const idLoteLocalRaw = options?.idLoteLocal ?? (options?.idLoteServidor ? undefined : idLote);
  const idLoteServidor = typeof idLoteServidorRaw === 'number' && Number.isFinite(idLoteServidorRaw) && idLoteServidorRaw > 0
    ? idLoteServidorRaw
    : undefined;
  const idLoteLocal = typeof idLoteLocalRaw === 'number' && Number.isFinite(idLoteLocalRaw) && idLoteLocalRaw > 0
    ? idLoteLocalRaw
    : undefined;

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [produccion, setProduccion] = useState({
    cantidad: '',
    precio: '',
  });
  const [unidadCantidad, setUnidadCantidad] = useState<'kg' | 'qq'>('qq');
  const [unidadPrecio, setUnidadPrecio] = useState<'bskg' | 'bsqq'>('bsqq');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void cargarDatos();
  }, [idLoteServidor, idLoteLocal]);

  const withTimeout = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
    const timeoutPromise = new Promise<T>((resolve) => {
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        resolve(fallback);
      }, DB_READ_TIMEOUT_MS);
    });

    return Promise.race([promise, timeoutPromise]);
  };

  const cargarDatos = async () => {
    if (!idLoteServidor && !idLoteLocal) {
      setGastos([]);
      setProduccion({ cantidad: '', precio: '' });
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const gastosLocalesRaw = await withTimeout(
        obtenerCostosLocalesPorLote({
          idLoteLocal,
          idLoteServidor,
        }),
        []
      );
      const gastosLocalesMapeados: Gasto[] = gastosLocalesRaw.map((gasto, idx) => ({
        id: `local-${idx}`,
        fase: gasto.tipo_costo || 'Desconocida',
        categoria: gasto.categoria || 'Sin categoría',
        descripcion: gasto.descripcion || '',
        cantidad: String(gasto.cantidad),
        monto: String(gasto.monto_total ?? (gasto.costo_unitario * gasto.cantidad)),
        origen: 'LOCAL',
      }));

      setGastos(gastosLocalesMapeados);

      const borradorLocal = await withTimeout(
        obtenerBorradorProduccionLocal({
          idLoteLocal,
          idLoteServidor,
        }),
        null
      );

      if (borradorLocal) {
        const cantidadKg = Number(borradorLocal.cantidad_obtenida) || 0;
        const precioKg = Number(borradorLocal.precio_venta) || 0;
        const cantidadQq = cantidadKg > 0 ? cantidadKg / KG_POR_QUINTAL : 0;
        const precioQq = precioKg > 0 ? precioKg * KG_POR_QUINTAL : 0;

        setProduccion({
          cantidad: cantidadQq > 0 ? cantidadQq.toFixed(2) : '',
          precio: precioQq > 0 ? precioQq.toFixed(2) : '',
        });
      } else {
        setProduccion({ cantidad: '', precio: '' });
      }

      // En modo local mostramos resultados de inmediato, sin esperar llamadas remotas.
      setLoading(false);

      if (idLoteServidor) {
        void (async () => {
          try {
            const [gastosRemote, produccionApi] = await Promise.all([
              obtenerGastosPorLoteApi(idLoteServidor),
              obtenerUltimaProduccionLoteApi(idLoteServidor),
            ]);

            const gastosApi: Gasto[] = gastosRemote.map((g: any, idx: number) => ({
              id: `api-${idx}`,
              fase: g.tipo_costo || 'Desconocida',
              categoria: g.categoria || 'Sin categoría',
              descripcion: g.descripcion || '',
              cantidad: String(g.cantidad || 0),
              monto: String(g.monto_total ?? ((g.cantidad * g.costo_unitario) || 0)),
              origen: 'API',
            }));

            setGastos(unirGastosSinDuplicar(gastosApi, gastosLocalesMapeados));

            if (produccionApi) {
              const cantidadKg = parseFloat(produccionApi.cantidad_obtenida) || 0;
              const precioKg = parseFloat(produccionApi.precio_venta) || 0;
              const cantidadQq = cantidadKg > 0 ? cantidadKg / KG_POR_QUINTAL : 0;
              const precioQq = precioKg > 0 ? precioKg * KG_POR_QUINTAL : 0;

              setProduccion({
                cantidad: cantidadQq > 0 ? cantidadQq.toFixed(2) : '',
                precio: precioQq > 0 ? precioQq.toFixed(2) : '',
              });
            }
          } catch (remoteError) {
            console.warn('No se pudo cargar datos remotos, se usan datos locales:', remoteError);
          }
        })();
      }
    } catch (error) {
      console.warn('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos de resultados');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const calculos = useMemo<ResultadoCalculos>(() => {
    const qtyProducidaQq = parseFloat(produccion.cantidad) || 0;
    const precioVentaQq = parseFloat(produccion.precio) || 0;
    const qtyProducidaKg = qtyProducidaQq * KG_POR_QUINTAL;
    const precioVentaKg = precioVentaQq / KG_POR_QUINTAL;

    const totalCostos = gastos.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);
    const costoPorKg = qtyProducidaKg > 0 ? totalCostos / qtyProducidaKg : 0;
    const ingresosTotales = qtyProducidaKg * precioVentaKg;
    const gananciaNeta = ingresosTotales - totalCostos;
    const margenGanancia = ingresosTotales > 0 ? (gananciaNeta / ingresosTotales) * 100 : 0;
    const puntoEquilibrio = precioVentaKg > 0 ? totalCostos / precioVentaKg : 0;
    const puntoEquilibrioKg = Math.ceil(puntoEquilibrio);
    const esRentable = gananciaNeta >= 0;

    const escenarios = [
      {
        nombre: 'Pesimista' as const,
        ingresos: ingresosTotales * 0.7,
        costos: totalCostos,
        ganancia: (ingresosTotales * 0.7) - totalCostos,
      },
      {
        nombre: 'Realista' as const,
        ingresos: ingresosTotales,
        costos: totalCostos,
        ganancia: gananciaNeta,
      },
      {
        nombre: 'Optimista' as const,
        ingresos: ingresosTotales * 1.3,
        costos: totalCostos,
        ganancia: (ingresosTotales * 1.3) - totalCostos,
      },
    ];

    const maxGrafico = Math.max(
      ...escenarios.map((s) => Math.max(s.ingresos, s.costos, Math.max(s.ganancia, 0))),
      100
    );

    return {
      qtyProducidaQq,
      precioVentaQq,
      qtyProducidaKg,
      precioVentaKg,
      totalCostos,
      costoPorKg,
      ingresosTotales,
      gananciaNeta,
      margenGanancia,
      puntoEquilibrio,
      puntoEquilibrioKg,
      esRentable,
      escenarios,
      maxGrafico,
    };
  }, [gastos, produccion]);

  return {
    rubro,
    gastos,
    produccion,
    setProduccion,
    unidadCantidad,
    setUnidadCantidad,
    unidadPrecio,
    setUnidadPrecio,
    loading,
    recargarDatos: cargarDatos,
    ...calculos,
  };
}
