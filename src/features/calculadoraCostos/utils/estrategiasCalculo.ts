import {
  Fase,
  RubroCalculadora,
  RubroStrategy,
  UnidadCategoria,
  ValidacionCantidad,
} from '../types';

const CATEGORIAS_POR_FASE_QUINUA: Record<Fase, string[]> = {
  Siembra: [
    'Alquiler de Terreno',
    'Maquinaria para roturar',
    'Maquinaria para Siembra',
    'Mano de obra para siembra',
    'Semillas',
    'Abono',
    'Agua/Riego',
    'Refrigerio',
    'Otros',
  ],
  Crecimiento: [
    'Pesticidas',
    'Mano de obra para persticidas',
    'Fertilizantes',
    'Mano de obra para fertilizantes',
    'Agua/Riego',
    'Refrigerio',
    'Otros',
  ],
  Cosecha: [
    'Maquinaria para trillado',
    'Mano de obra para trillado',
    'Mano de obra para venteado',
    'Transporte',
    'Refrigerio',
    'Otros',
  ],
};
const UNIDAD_POR_CATEGORIA_QUINUA: Record<string, UnidadCategoria> = {
  'Alquiler de Terreno': 'ha',
  'Maquinaria para roturar': 'ha',
  'Maquinaria para Siembra': 'ha',
  'Mano de obra para siembra': 'jornal',
  'Semillas': 'kg',
  'Agua/Riego': 'hora',
  'Abonos': 'kg',
  'Pesticidas': 'litro',
  'Mano de obra para persticidas': 'jornal',
  'Fertilizantes': 'litro',
  'Mano de obra para fertilizantes': 'jornal',
  'Refrigerio': 'unidad',
  'Maquinaria para trillado': 'ha',
  'Mano de obra para trillado': 'jornal',
  'Mano de obra para venteado': 'jornal',
  'Transporte': 'viaje',
  'Herramientas': 'unidad',
  'Otros': 'unidad',
};

const CATEGORIAS_POR_FASE_HORTALIZAS: Record<Fase, string[]> = {
Siembra: [
    'Alquiler de Terreno',
    'Maquinaria para roturar',
    'Mano de obra para aradura',
    'Maquinaria para rastreo "barbecho"',
    'Mano de obra para rastreo',
    'Mano de obra para Colocación de paja',
    'Maquinaria para Siembra',
    'Mano de obra para siembra',
    'Mano de obra para Surcado manual',
    'Abono',
    'Mano de obra para el abono',
    'Semillas',
   
    'Refrigerio',
    'Otros',
  ],
  Crecimiento: [
    'Herbicidas',
    'Mano de obra para Herbicidas',
    'Mano de obra para Deshierbe',
    'Fertilizantes',
    'Mano de obra para fertilizantes',   
    'Riego (cinta de lluvia)',
    'Mano de obra para Riego',
    'Mano de obra para carpida',
    'Refrigerio',
    'Otros',
  ],
  Cosecha: [
    'Maquinaria para lavadora',
    'Mano de obra para lavadora',
    'Mano de obra para enbolsado',
    'Transporte',
    'Refrigerio',
    'Otros',
  ],
};

const UNIDAD_POR_CATEGORIA_HORTALIZAS: Record<string, UnidadCategoria> = {
  //siembra
  'Alquiler de Terreno': 'hora',
  'Maquinaria para roturar': 'ha',
  'Mano de obra para aradura': 'jornal',
  'Maquinaria para rastreo "barbecho"': 'ha',
  'Mano de obra para rastreo': 'jornal',
  'Mano de obra para Colocación de paja': 'jornal',
  'Maquinaria para Siembra': 'ha',
  'Mano de obra para siembra': 'jornal',
  'Mano de obra para Surcado manual': 'ha',
  'Abono': 'kg',
  'Mano de obra para el abono': 'ha',
  'Semillas': 'kg',
  
  //crecimiento
  'Herbicidas': 'litro',
  'Mano de obra para Herbicidas': 'jornal',
  'Mano de obra para Deshierbe': 'jornal',
  'Fertilizantes': 'litro',
  'Mano de obra para fertilizantes': 'jornal',
  'Riego (cinta de lluvia)': 'rollo',
  'Mano de obra para Riego': 'jornal',
  'Mano de obra para carpida': 'jornal',
  
  //cosecha
  'Maquinaria para lavadora': 'ha',
  'Mano de obra para lavadora': 'jornal',
  'Mano de obra para enbolsado': 'jornal',
  'Transporte': 'viaje',
  'Refrigerio': 'unidad',
  'Herramientas': 'unidad',
  'Otros': 'unidad',
};

const CATEGORIAS_CANTIDAD_ENTERA_QUINUA = new Set<string>(['Herramientas', 'Transporte', 'Otros']);
const CATEGORIAS_CANTIDAD_ENTERA_HORTALIZAS = new Set<string>(['Herramientas', 'Transporte', 'Otros']);

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
  if (rubro === 'quinua' || rubro === 'hortalizas') {
    if (CATEGORIAS_CANTIDAD_ENTERA_QUINUA.has(categoria)) {
      return texto.replace(/\D/g, '');
    }
    return sanitizarDecimal(texto);
  }

  if (CATEGORIAS_CANTIDAD_ENTERA_HORTALIZAS.has(categoria)) {
      return texto.replace(/\D/g, '');
    }

  return texto;
};

export const validarCantidadPorCategoria = (
  categoria: string,
  cantidadTexto: string,
  rubro: RubroCalculadora,
): ValidacionCantidad => {
  if (rubro === 'quinua' || rubro === 'hortalizas') {
    const cantidadLimpia = cantidadTexto.trim();
    const unidad = obtenerUnidadCategoria(categoria);

    if (!cantidadLimpia) {
      return { esValida: false, mensaje: `Ingresa una cantidad en ${unidad}.` };
    }

    const cantidad = Number(cantidadLimpia);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      return { esValida: false, mensaje: `La cantidad en ${unidad} debe ser mayor a cero.` };
    }

    if (CATEGORIAS_CANTIDAD_ENTERA_QUINUA.has(categoria) && !Number.isInteger(cantidad)) {
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
  UNIDAD_POR_CATEGORIA_QUINUA[categoria] || UNIDAD_POR_CATEGORIA_HORTALIZAS[categoria] || 'unidad';

export const estrategiasCalculo: Record<RubroCalculadora, RubroStrategy> = {
  quinua: {
    rubro: 'quinua',
    titulo: 'Calculadora de Costos de Quinua',
    subtitulo: 'Calcula tus gastos, ganancias y punto de equilibrio',
    rutaResultados: '/resultados_quinua',
    categoriasPorFase: CATEGORIAS_POR_FASE_QUINUA,
    mostrarPendienteOffline: true,
    usaValidacionCantidadPorCategoria: true,
    mostrarPuntoEquilibrioEnUnidadSeleccionada: true,
    mensajeErrorGuardarProduccionConDetalle: true,
    mensajeNoLoteSinError: true,
    unidadPorCategoria: UNIDAD_POR_CATEGORIA_QUINUA,
    categoriasCantidadEntera: CATEGORIAS_CANTIDAD_ENTERA_QUINUA,
    placeholderDescripcion: '',
  },
  hortalizas: {
    rubro: 'hortalizas',
    titulo: 'Calculadora de Costos de Hortalizas',
    subtitulo: 'Calcula tus gastos, ganancias y punto de equilibrio',
    rutaResultados: '/resultados_hortalizas',
    categoriasPorFase: CATEGORIAS_POR_FASE_HORTALIZAS,
    mostrarPendienteOffline: true,
    usaValidacionCantidadPorCategoria: true,
    mostrarPuntoEquilibrioEnUnidadSeleccionada: true,
    mensajeErrorGuardarProduccionConDetalle: true,
    mensajeNoLoteSinError: true,
    unidadPorCategoria: UNIDAD_POR_CATEGORIA_HORTALIZAS,
    categoriasCantidadEntera: CATEGORIAS_CANTIDAD_ENTERA_HORTALIZAS,
    placeholderDescripcion: '',
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