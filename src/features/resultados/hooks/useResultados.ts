import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getDb } from '@/src/core/database/sqlite.config';
import { obtenerCostosLocalesPorLote, obtenerBorradorProduccionLocal } from '@/src/modules/costos/costos.repository';
import { obtenerGastosPorLoteApi } from '@/src/core/network/api/gastos';
import { obtenerUltimaProduccionLoteApi } from '@/src/core/network/api/produccion';
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
      // 1. Mostrar de inmediato los datos locales
      const gastosLocalesRaw = await withTimeout(
        obtenerCostosLocalesPorLote({
          idLoteLocal,
          idLoteServidor,
        }),
        []
      );
      const gastosLocalesMapeados: Gasto[] = gastosLocalesRaw.map((gasto) => ({
        id: `local-${gasto.id_local}`,
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

      setLoading(false);

      // 2. Si hay idLoteServidor e internet, descargar gastos del servidor a SQLite y luego refrescar desde SQLite
      if (idLoteServidor) {
        try {
          const netState = await NetInfo.fetch();
          const hayInternet = Boolean(netState.isConnected) && netState.isInternetReachable !== false;
          if (hayInternet) {
            const serverGastos = await obtenerGastosPorLoteApi(idLoteServidor);
            if (Array.isArray(serverGastos) && serverGastos.length > 0) {
              const db = await getDb();
              for (const sg of serverGastos) {
                const idGastoServidor = Number(sg.id_gasto);
                if (!idGastoServidor) continue;

                const gastoLocal = await db.getFirstAsync<any>(
                  `SELECT id_local FROM gasto_lote WHERE id_gasto = ?`,
                  idGastoServidor
                );

                if (!gastoLocal) {
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

              // Refrescar desde SQLite (Single Source of Truth)
              const gastosLocalesActualizados = await obtenerCostosLocalesPorLote({
                idLoteLocal,
                idLoteServidor,
              }).catch(() => []);
              
              const gastosMapeadosActualizados: Gasto[] = gastosLocalesActualizados.map((gasto) => ({
                id: `local-${gasto.id_local}`,
                fase: gasto.tipo_costo || 'Desconocida',
                categoria: gasto.categoria || 'Sin categoría',
                descripcion: gasto.descripcion || '',
                cantidad: String(gasto.cantidad),
                monto: String(gasto.monto_total ?? (gasto.costo_unitario * gasto.cantidad)),
                origen: 'LOCAL',
              }));

              setGastos(gastosMapeadosActualizados);
            }

            const produccionApi = await obtenerUltimaProduccionLoteApi(idLoteServidor).catch(() => null);
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
          }
        } catch (remoteError) {
          console.warn('No se pudo cargar datos remotos, se usan datos locales:', remoteError);
        }
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
