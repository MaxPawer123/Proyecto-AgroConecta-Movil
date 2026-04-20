export type RubroCalculadora = 'quinua' | 'hortalizas';

export type Fase = 'Siembra' | 'Crecimiento' | 'Cosecha';
export type UnidadCantidad = 'kg' | 'qq';
export type UnidadPrecio = 'bskg' | 'bsqq';
export type UnidadCategoria = 'ha' | 'kg' | 'hora' | 'jornal' | 'unidad' | 'viaje' | 'litro' ;

export type GastoOrigen = 'API' | 'LOCAL';

export type Gasto = {
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

export type FormGasto = {
  categoria: string;
  descripcion: string;
  cantidad: string;
  monto: string;
};

export type GastoEnEdicion = Gasto & { id_gasto?: number };

export type ProduccionForm = {
  cantidad: string;
  precio: string;
};

export type Escenario = {
  nombre: 'Pesimista' | 'Realista' | 'Optimista';
  ingresos: number;
  costos: number;
  ganancia: number;
};

export type ValidacionCantidad = {
  esValida: boolean;
  mensaje?: string;
  cantidad?: number;
};

export type RubroStrategy = {
  rubro: RubroCalculadora;
  titulo: string;
  subtitulo: string;
  rutaResultados: '/resultados_quinua' | '/resultados_hortalizas';
  categoriasPorFase: Record<Fase, string[]>;
  mostrarPendienteOffline: boolean;
  usaValidacionCantidadPorCategoria: boolean;
  mostrarPuntoEquilibrioEnUnidadSeleccionada: boolean;
  mensajeErrorGuardarProduccionConDetalle: boolean;
  mensajeNoLoteSinError: boolean;
  unidadPorCategoria: Record<string, UnidadCategoria>;
  categoriasCantidadEntera: Set<string>;
  placeholderDescripcion: string;
};
