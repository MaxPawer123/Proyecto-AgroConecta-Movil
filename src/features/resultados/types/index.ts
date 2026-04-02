export type RubroResultado = 'quinua' | 'hortalizas';

export type Gasto = {
  id: string;
  fase: string;
  categoria: string;
  descripcion: string;
  cantidad: string;
  monto: string;
  origen?: 'API' | 'LOCAL';
};

export type Produccion = {
  cantidad: string;
  precio: string;
};

export type Escenario = {
  nombre: 'Pesimista' | 'Realista' | 'Optimista';
  ingresos: number;
  costos: number;
  ganancia: number;
};

export type ResultadoCalculos = {
  qtyProducidaQq: number;
  precioVentaQq: number;
  qtyProducidaKg: number;
  precioVentaKg: number;
  totalCostos: number;
  costoPorKg: number;
  ingresosTotales: number;
  gananciaNeta: number;
  margenGanancia: number;
  puntoEquilibrio: number;
  puntoEquilibrioKg: number;
  esRentable: boolean;
  escenarios: Escenario[];
  maxGrafico: number;
};

export type RubroConfig = {
  title: string;
  subtitle: string;
  accentColor: string;
};
