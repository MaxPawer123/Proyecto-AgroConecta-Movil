import {
  Fase,
  RubroCalculadora,
  RubroStrategy,
  UnidadCategoria,
  ValidacionCantidad,
} from '../types';

const CATEGORIAS_POR_FASE_BASE: Record<Fase, string[]> = {
  Siembra: [
    'Alquiler de Terreno',
    'Maquinaria para Roturar',
    'Semillas',
    'Abonos',
    'Agua/Riego',
    'Maquinaria para Siembra',
    'Mano de obra para roturar',
    'Mano de obra para siembra',
    'Refrigerio',
    'Herramientas',
    'Otros',
  ],
  Crecimiento: [
    'Pesticidas',
    'Agua/Riego',
    'Fertilizantes químicos',
    'Fertilizantes orgánicos',
    'Mano de obra para labores culturales',
    'Refrigerio',
    'Herramientas',
    'Otros',
  ],
  Cosecha: [
    'Maquinaria para Cosecha',
    'Mano de obra para cosecha',
    'Transporte',
    'Refrigerio',
    'Herramientas',
    'Otros',
  ],
};

const UNIDAD_POR_CATEGORIA: Record<string, UnidadCategoria> = {
  'Alquiler de Terreno': 'ha',
  'Semillas': 'kg',
  'Maquinaria para Roturar': 'ha',
  'Maquinaria para Siembra': 'ha',
  'Mano de obra para roturar': 'jornal',
  'Mano de obra para siembra': 'jornal',
  'Abonos': 'kg',
  'Pesticidas': 'kg',
  'Agua/Riego': 'hora',
  'Fertilizantes químicos': 'litro',
  'Fertilizantes orgánicos': 'litro',
  'Mano de obra para labores culturales': 'jornal',
  'Maquinaria para Cosecha': 'ha',
  'Mano de obra para cosecha': 'jornal',
  'Transporte': 'viaje',
  'Refrigerio': 'unidad',
  'Herramientas': 'unidad',
  'Otros': 'unidad',
};

const CATEGORIAS_CANTIDAD_ENTERA = new Set<string>(['Herramientas', 'Transporte', 'Otros']);

const sanitizarDecimal = (texto: string): string => {
  const conPunto = texto.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const partes = conPunto.split('.');
  if (partes.length <= 1) return partes[0];
  return `${partes[0]}.${partes.slice(1).join('')}`;
};

export const sanitizarCantidadPorCategoria = (
  categoria: string,
  texto: string,
  rubro: RubroCalculadora,
): string => {
  if (rubro === 'quinua') {
    if (CATEGORIAS_CANTIDAD_ENTERA.has(categoria)) {
      return texto.replace(/\D/g, '');
    }
    return sanitizarDecimal(texto);
  }

  return texto;
};

export const validarCantidadPorCategoria = (
  categoria: string,
  cantidadTexto: string,
  rubro: RubroCalculadora,
): ValidacionCantidad => {
  if (rubro === 'quinua') {
    const cantidadLimpia = cantidadTexto.trim();
    const unidad = obtenerUnidadCategoria(categoria);

    if (!cantidadLimpia) {
      return { esValida: false, mensaje: `Ingresa una cantidad en ${unidad}.` };
    }

    const cantidad = Number(cantidadLimpia);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      return { esValida: false, mensaje: `La cantidad en ${unidad} debe ser mayor a cero.` };
    }

    if (CATEGORIAS_CANTIDAD_ENTERA.has(categoria) && !Number.isInteger(cantidad)) {
      return { esValida: false, mensaje: `La categoria ${categoria} solo permite cantidades enteras.` };
    }

    return { esValida: true, cantidad };
  }

  const cantidad = Number(cantidadTexto || '1');
  if (!cantidad || cantidad <= 0) {
    return { esValida: false, mensaje: 'Cantidad y monto deben ser mayores a cero.' };
  }

  return { esValida: true, cantidad };
};

export const obtenerUnidadCategoria = (categoria: string): UnidadCategoria =>
  UNIDAD_POR_CATEGORIA[categoria] || 'unidad';

export const estrategiasCalculo: Record<RubroCalculadora, RubroStrategy> = {
  quinua: {
    rubro: 'quinua',
    titulo: 'Calculadora de Costos de Quinua',
    subtitulo: 'Calcula tus gastos, ganancias y punto de equilibrio',
    rutaResultados: '/resultados_quinua',
    categoriasPorFase: CATEGORIAS_POR_FASE_BASE,
    mostrarPendienteOffline: true,
    usaValidacionCantidadPorCategoria: true,
    mostrarPuntoEquilibrioEnUnidadSeleccionada: true,
    mensajeErrorGuardarProduccionConDetalle: true,
    mensajeNoLoteSinError: true,
    unidadPorCategoria: UNIDAD_POR_CATEGORIA,
    categoriasCantidadEntera: CATEGORIAS_CANTIDAD_ENTERA,
    placeholderDescripcion: '',
  },
  hortalizas: {
    rubro: 'hortalizas',
    titulo: 'Calculadora de Costos de Hortalizas',
    subtitulo: 'Calcula tus gastos, ganancias y punto de equilibrio',
    rutaResultados: '/resultados_hortalizas',
    categoriasPorFase: CATEGORIAS_POR_FASE_BASE,
    mostrarPendienteOffline: false,
    usaValidacionCantidadPorCategoria: false,
    mostrarPuntoEquilibrioEnUnidadSeleccionada: false,
    mensajeErrorGuardarProduccionConDetalle: false,
    mensajeNoLoteSinError: false,
    unidadPorCategoria: UNIDAD_POR_CATEGORIA,
    categoriasCantidadEntera: CATEGORIAS_CANTIDAD_ENTERA,
    placeholderDescripcion: 'sfasdfdas',
  },
};

export const obtenerEstrategiaCalculo = (rubro: RubroCalculadora): RubroStrategy =>
  estrategiasCalculo[rubro];

export const inferirFaseDesdeCategoria = (
  categoria: string,
  tipoCosto: 'FIJO' | 'VARIABLE' | undefined,
  categoriasPorFase: Record<Fase, string[]>,
): Fase => {
  if (categoriasPorFase.Cosecha.includes(categoria)) return 'Cosecha';
  if (categoriasPorFase.Crecimiento.includes(categoria)) return 'Crecimiento';
  if (categoriasPorFase.Siembra.includes(categoria)) return 'Siembra';
  return tipoCosto === 'FIJO' ? 'Siembra' : 'Crecimiento';
};
