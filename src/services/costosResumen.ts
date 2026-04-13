import { getDb } from './sqlite';
import { obtenerGastosPorLoteApi, obtenerLotesPorTipoCultivoApi, type GastoApi, type LoteApi } from './api';

type LoteResumenApi = Pick<LoteApi, 'id_lote'>;

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

function sumarGastosApi(gastos: GastoApi[]): number {
  return gastos.reduce((total, gasto) => {
    const montoBase = gasto.monto_total ?? Number(gasto.cantidad) * Number(gasto.costo_unitario);
    return total + Number(montoBase ?? 0);
  }, 0);
}

function deduplicarIds(lotes: LoteResumenApi[]): number[] {
  const vistos = new Set<number>();
  const ids: number[] = [];

  for (const lote of lotes) {
    const id = Number(lote.id_lote);
    if (!Number.isFinite(id) || id <= 0 || vistos.has(id)) continue;
    vistos.add(id);
    ids.push(id);
  }

  return ids;
}

function obtenerIdLote(valor: number | string | null | undefined): number | null {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

export async function obtenerTotalGastosLocales(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(monto_total), 0) as total FROM gasto_lote'
  );

  return Number(row?.total ?? 0);
}

export async function obtenerTotalGastosSubidosDesdeLotes(lotes: LoteApi[]): Promise<number> {
  const idsUnicos = deduplicarIds(lotes.map((lote) => ({ id_lote: obtenerIdLote(lote.id_lote) ?? 0 })));

  if (idsUnicos.length === 0) {
    return 0;
  }

  const gastosPorLote = await Promise.all(
    idsUnicos.map((idLote) => obtenerGastosPorLoteApi(idLote).catch(() => []))
  );

  return gastosPorLote.reduce((total, gastos) => total + sumarGastosApi(gastos), 0);
}

export async function obtenerTotalGastosSubidosPorTipos(tiposCultivo: string[]): Promise<number> {
  const tiposNormalizados = Array.from(
    new Set(
      tiposCultivo
        .map((tipo) => normalizarTexto(tipo))
        .filter(Boolean)
    )
  );

  if (tiposNormalizados.length === 0) {
    return 0;
  }

  const lotesResultados = await Promise.allSettled(
    tiposNormalizados.map((tipo) => obtenerLotesPorTipoCultivoApi(tipo))
  );

  const lotesUnicos = deduplicarIds(
    lotesResultados.flatMap((resultado) => (resultado.status === 'fulfilled' ? resultado.value : []))
  );

  if (lotesUnicos.length === 0) {
    return 0;
  }

  const gastosPorLote = await Promise.all(lotesUnicos.map((idLote) => obtenerGastosPorLoteApi(idLote).catch(() => [])));

  return gastosPorLote.reduce((total, gastos) => total + sumarGastosApi(gastos), 0);
}

export async function obtenerTotalGastosLotesQuinuaYHortalizas(): Promise<number> {
  const [gastosLocales, gastosBackend] = await Promise.all([
    obtenerTotalGastosLocales().catch(() => 0),
    obtenerTotalGastosSubidosPorTipos(['quinua', 'hortaliza', 'hortalizas']).catch(() => 0),
  ]);

  return gastosLocales + gastosBackend;
}
