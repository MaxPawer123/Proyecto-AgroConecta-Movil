import { RubroConfig, RubroResultado } from '../types';

const RUBRO_CONFIG: Record<RubroResultado, RubroConfig> = {
  quinua: {
    title: 'Resultados Quinua',
    subtitle: 'Analisis financiero de tu lote',
    accentColor: '#2eaa51',
  },
  hortalizas: {
    title: 'Resultados Hortalizas',
    subtitle: 'Analisis financiero de tu lote',
    accentColor: '#2eaa51',
  },
};

export function normalizarRubro(rubro: string | undefined): RubroResultado {
  if (rubro === 'quinua' || rubro === 'hortalizas') {
    return rubro;
  }

  return 'hortalizas';
}

export function obtenerConfigRubro(rubro: RubroResultado): RubroConfig {
  return RUBRO_CONFIG[rubro];
}

export function formatearMoneda(valor: number): string {
  return `Bs ${valor.toFixed(2)}`;
}


