import { useCallback, useEffect, useState } from 'react';
import { getDb } from '@/src/services/sqlite';
import { obtenerLotesLocales } from '@/src/services/database';
import { obtenerLotesPorProductoApi, type LoteApi } from '@/src/services/api';

export type EstadisticasDashboard = {
  lotesActivos: number;
  areaTotal: number;
  inversion: number;
  pendientesSync: number;
};

export type LoteRecienteDashboard = {
  id: number;
  nombre: string;
  variedad: string;
  estado: string;
};

export type DashboardData = {
  nombreUsuario: string;
  estadisticas: EstadisticasDashboard;
  lotesRecientes: LoteRecienteDashboard[];
  loading: boolean;
  error: string | null;
  origenDatos: string[];
  actualizar: () => Promise<void>;
};

type UsuarioResumen = {
  nombreUsuario: string;
};

type LoteResumido = {
  id: string;
  idServidor: number | null;
  nombre: string;
  variedad: string;
  estado: string;
  area: number;
  orderKey: number;
};

const estadoInicial: Omit<DashboardData, 'actualizar'> = {
  nombreUsuario: 'Productor',
  estadisticas: {
    lotesActivos: 0,
    areaTotal: 0,
    inversion: 0,
    pendientesSync: 0,
  },
  lotesRecientes: [],
  loading: true,
  error: null,
  origenDatos: [],
};

async function obtenerUsuarioLocal(): Promise<UsuarioResumen> {
  const db = await getDb();

  const existeTabla = async (tabla: string): Promise<boolean> => {
    const row = await db.getFirstAsync<{ existe: number }>(
      'SELECT COUNT(*) as existe FROM sqlite_master WHERE type = ? AND name = ?',
      'table',
      tabla
    );

    return Number(row?.existe ?? 0) > 0;
  };

  const columnasTabla = async (tabla: string): Promise<Set<string>> => {
    try {
      const columnas = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tabla})`);
      return new Set(columnas.map((item) => item.name));
    } catch {
      return new Set();
    }
  };

  const columnasUsuario = await columnasTabla('usuario');
  const columnasProductor = await columnasTabla('productor');
  const tieneSesion = await existeTabla('auth_sesion');

  const nombreCompletoSql = columnasUsuario.has('nombre_completo') ? 'u.nombre_completo' : "''";
  const nombreSql = columnasUsuario.has('nombre') ? 'u.nombre' : "''";
  const apellidoSql = columnasUsuario.has('apellido') ? 'u.apellido' : "''";

  const nombreCompletoProductorSql = columnasProductor.has('nombre_completo') ? 'p.nombre_completo' : "''";
  const nombreProductorSql = columnasProductor.has('nombre') ? 'p.nombre' : "''";
  const apellidoProductorSql = columnasProductor.has('apellido') ? 'p.apellido' : "''";

  const joinSesion = tieneSesion ? 'LEFT JOIN auth_sesion s ON s.id_usuario = u.id_usuario' : '';
  const whereSesion = tieneSesion ? 'WHERE s.id = 1 AND s.activa = 1' : '';

  const fila = await db.getFirstAsync<Record<string, unknown>>(
    `
      SELECT
        TRIM(COALESCE(${nombreCompletoSql}, '')) as nombre_completo,
        TRIM(COALESCE(${nombreSql}, '')) as nombre,
        TRIM(COALESCE(${apellidoSql}, '')) as apellido,
        TRIM(COALESCE(${nombreCompletoProductorSql}, '')) as nombre_completo_productor,
        TRIM(COALESCE(${nombreProductorSql}, '')) as nombre_productor,
        TRIM(COALESCE(${apellidoProductorSql}, '')) as apellido_productor
      FROM usuario u
      LEFT JOIN productor p ON p.id_usuario = u.id_usuario
      ${joinSesion}
      ${whereSesion}
      ORDER BY u.id_usuario DESC
      LIMIT 1
    `
  );

  const filaFallback =
    fila ??
    (await db.getFirstAsync<Record<string, unknown>>(
      `
        SELECT
            TRIM(COALESCE(${nombreCompletoSql}, '')) as nombre_completo,
            TRIM(COALESCE(${nombreSql}, '')) as nombre,
            TRIM(COALESCE(${apellidoSql}, '')) as apellido,
            TRIM(COALESCE(${nombreCompletoProductorSql}, '')) as nombre_completo_productor,
            TRIM(COALESCE(${nombreProductorSql}, '')) as nombre_productor,
            TRIM(COALESCE(${apellidoProductorSql}, '')) as apellido_productor
        FROM usuario u
        LEFT JOIN productor p ON p.id_usuario = u.id_usuario
        ORDER BY u.id_usuario DESC
        LIMIT 1
      `
    ));

  const nombreCompletoBase = String(
    filaFallback?.nombre_completo ?? filaFallback?.nombre_completo_productor ?? ''
  ).trim();
  const nombreBase = String(filaFallback?.nombre ?? filaFallback?.nombre_productor ?? '').trim();
  const apellidoBase = String(filaFallback?.apellido ?? filaFallback?.apellido_productor ?? '').trim();

  const nombreCompleto = nombreCompletoBase || `${nombreBase} ${apellidoBase}`.trim() || 'PRODUCTOR';
  return { nombreUsuario: nombreCompleto.split(/\s+/)[0] || nombreCompleto };
}

function mapearLoteLocal(item: Awaited<ReturnType<typeof obtenerLotesLocales>>[number]): LoteResumido {
  const nombre = String(item.nombre_lote ?? '').trim() || `Lote ${item.id_local}`;
  const variedad = String(item.variedad ?? '').trim() || 'Sin variedad';

  return {
    id: `local-${item.id_local}`,
    idServidor: item.id_servidor ?? null,
    nombre,
    variedad,
    estado: item.estado_sincronizacion === 'SINCRONIZADO' ? 'Sincronizado' : 'Pendiente de sync',
    area: Number(item.superficie ?? 0),
    orderKey: item.id_local,
  };
}

function mapearLoteBackend(item: LoteApi): LoteResumido {
  const nombre = String(item.nombre_lote ?? '').trim() || `Lote ${item.id_lote}`;
  const variedad = String(item.variedad ?? '').trim() || String(item.nombre_producto ?? 'Sin variedad').trim();

  return {
    id: `server-${item.id_lote}`,
    idServidor: item.id_lote,
    nombre,
    variedad,
    estado: String(item.estado ?? 'Activo'),
    area: Number(item.superficie ?? 0),
    orderKey: item.id_lote,
  };
}

function deduplicarLotes(lotes: LoteResumido[]): LoteResumido[] {
  const vistos = new Set<string>();
  const resultado: LoteResumido[] = [];

  for (const lote of lotes) {
    const firma = `${lote.idServidor ?? lote.id}|${lote.nombre.trim().toLowerCase()}|${lote.variedad.trim().toLowerCase()}`;
    if (vistos.has(firma)) continue;
    vistos.add(firma);
    resultado.push(lote);
  }

  return resultado.sort((a, b) => b.orderKey - a.orderKey);
}

async function cargarDashboardLocal(): Promise<Omit<DashboardData, 'loading' | 'error' | 'actualizar'>> {
  // Cargar SOLO datos locales (muy rápido)
  const [usuario, lotesLocales, inversionTotal] = await Promise.all([
    obtenerUsuarioLocal().catch(() => ({ nombreUsuario: 'Productor' })),
    obtenerLotesLocales().catch(() => []),
    getDb()
      .then((db) => db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(monto_total), 0) as total FROM gasto_lote'))
      .then((row) => Number(row?.total ?? 0))
      .catch(() => 0),
  ]);

  const lotesCombinados = deduplicarLotes(lotesLocales.map(mapearLoteLocal));

  const pendientesSync = lotesLocales.filter(
    (item) => String(item.estado_sincronizacion ?? '').toUpperCase() !== 'SINCRONIZADO'
  ).length;

  const areaTotal = lotesCombinados.reduce(
    (acc, lote) => acc + (Number.isFinite(lote.area) ? lote.area : 0),
    0
  );

  return {
    nombreUsuario: usuario.nombreUsuario,
    estadisticas: {
      lotesActivos: lotesCombinados.length,
      areaTotal,
      inversion: inversionTotal,
      pendientesSync,
    },
    lotesRecientes: lotesCombinados.slice(0, 5).map((item) => ({
      id: Number(item.idServidor ?? item.orderKey),
      nombre: item.nombre,
      variedad: item.variedad,
      estado: item.estado,
    })),
    origenDatos: [`SQLite: ${lotesCombinados.length}`],
  };
}

async function cargarBackendConTimeout(): Promise<Omit<DashboardData, 'loading' | 'error' | 'actualizar'> | null> {
  // Cargar backend CON TIMEOUT de 3 segundos
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));

  const cargar = async () => {
    try {
      const [lotesBackendResultados, lotesLocales] = await Promise.all([
        Promise.allSettled([1, 2, 3].map((idProducto) => obtenerLotesPorProductoApi(idProducto))),
        obtenerLotesLocales().catch(() => []),
      ]);

      const lotesBackend = lotesBackendResultados.flatMap((resultado) =>
        resultado.status === 'fulfilled' ? resultado.value.map(mapearLoteBackend) : []
      );

      if (lotesBackend.length === 0) return null;

      const lotesCombinados = deduplicarLotes([
        ...lotesLocales.map(mapearLoteLocal),
        ...lotesBackend,
      ]);

      const usuario = await obtenerUsuarioLocal().catch(() => ({ nombreUsuario: 'Productor' }));

      const inversionTotal = await getDb()
        .then((db) => db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(monto_total), 0) as total FROM gasto_lote'))
        .then((row) => Number(row?.total ?? 0))
        .catch(() => 0);

      const pendientesSync = lotesLocales.filter(
        (item) => String(item.estado_sincronizacion ?? '').toUpperCase() !== 'SINCRONIZADO'
      ).length;

      const areaTotal = lotesCombinados.reduce(
        (acc, lote) => acc + (Number.isFinite(lote.area) ? lote.area : 0),
        0
      );

      return {
        nombreUsuario: usuario.nombreUsuario,
        estadisticas: {
          lotesActivos: lotesCombinados.length,
          areaTotal,
          inversion: inversionTotal,
          pendientesSync,
        },
        lotesRecientes: lotesCombinados.slice(0, 5).map((item) => ({
          id: Number(item.idServidor ?? item.orderKey),
          nombre: item.nombre,
          variedad: item.variedad,
          estado: item.estado,
        })),
        origenDatos: [`SQLite: ${lotesLocales.length}`, `Backend: ${lotesBackend.length}`],
      };
    } catch {
      return null;
    }
  };

  // Corre timeout y cargar en paralelo, retorna lo que termine primero
  return Promise.race([timeout, cargar()]);
}

async function cargarDashboard(): Promise<Omit<DashboardData, 'loading' | 'error' | 'actualizar'>> {
  // Cargar datos locales PRIMERO (muestra rápido)
  const datosLocal = await cargarDashboardLocal();
  return datosLocal;
}

export function useDashboard(): DashboardData {
  const [estado, setEstado] = useState<Omit<DashboardData, 'actualizar'>>(estadoInicial);

  const actualizar = useCallback(async () => {
    setEstado((actual) => ({ ...actual, loading: true, error: null }));

    try {
      // Cargar datos locales (rápido, ~200ms)
      const datosLocal = await cargarDashboardLocal();
      setEstado({ ...datosLocal, loading: false, error: null });

      // Luego intentar cargar backend en background (sin bloquear UI)
      const datosBackend = await cargarBackendConTimeout();
      if (datosBackend && datosBackend.origenDatos[1]) {
        // Solo actualiza si backend trajo datos nuevos
        setEstado({ ...datosBackend, loading: false, error: null });
      }
    } catch (error) {
      setEstado((actual) => ({
        ...actual,
        loading: false,
        error: error instanceof Error ? error.message : 'No se pudo cargar el dashboard.',
      }));
    }
  }, []);

  useEffect(() => {
    void actualizar();
  }, [actualizar]);

  return {
    ...estado,
    actualizar,
  };
}
