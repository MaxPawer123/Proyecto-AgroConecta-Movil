import { RubroConfig, RubroResultado } from '../types';

const RUBRO_CONFIG: Record<RubroResultado, RubroConfig> = {
  quinua: {
    title: 'Resultados Quinua',
    subtitle: 'Analisis financiero de tu parcela',
    accentColor: '#2eaa51',
  },
  hortalizas: {
    title: 'Resultados Hortalizas',
    subtitle: 'Analisis financiero de tu parcela',
    accentColor: '#2eaa51',
  },
  papa: {
    title: 'Resultados Papa',
    subtitle: 'Analisis financiero de tu parcela',
    accentColor: '#d97706',
  },
};

export function normalizarRubro(rubro: string | undefined): RubroResultado {
  const valor = rubro?.trim().toLowerCase();
  if (valor === 'quinua' || valor === 'hortalizas' || valor === 'papa') {
    return valor;
  }

  return 'hortalizas';
}

export function obtenerConfigRubro(rubro: RubroResultado): RubroConfig {
  return RUBRO_CONFIG[rubro];
}

export function formatearMoneda(valor: number): string {
  return `Bs ${valor.toFixed(2)}`;
}


