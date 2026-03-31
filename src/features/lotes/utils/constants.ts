import { RubroConfig, RubroType } from '../types';

const DEFAULT_CONFIG: RubroConfig = {
  rubro: 'quinua',
  routeParam: 'quinua',
  codePrefix: 'Q',
  title: 'Mis Lotes de Quinua',
  subtitle: 'Calcula tus cultivos de quinua, costos y proyecciones',
  productLabel: 'Variedad',
  defaultProductName: 'Quinua',
  defaultVariedad: 'Sin variedad',
  defaultImage: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800',
  fallbackProductoId: 1,
  quickSyncedLabel: 'SUBIENDO',
  quickPendingLabel: 'PENDIENTE',
  localSyncedLabel: 'En Crecimiento',
  localPendingLabel: 'Pendiente Sync',
  usesProductCatalogSync: true,
  stopAutoSyncOnUnmount: false,
};

export const RUBRO_CONFIG: Record<RubroType, RubroConfig> = {
  quinua: DEFAULT_CONFIG,
  hortalizas: {
    rubro: 'hortalizas',
    routeParam: 'hortalizas',
    codePrefix: 'H',
    title: 'Mis Lotes de Hortalizas',
    subtitle: 'Calcula tus cultivos de hortalizas, costos y proyecciones',
    productLabel: 'Tipo',
    defaultProductName: 'Hortalizas',
    defaultVariedad: 'Hortaliza',
    defaultImage: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800',
    fallbackProductoId: 2,
    quickSyncedLabel: 'SUBIENDO',
    quickPendingLabel: 'PENDIENTE',
    localSyncedLabel: 'En Crecimiento',
    localPendingLabel: 'Pendiente Sync',
    usesProductCatalogSync: false,
    stopAutoSyncOnUnmount: true,
  },
};

export const normalizeRubro = (value?: string | string[] | null): RubroType => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'hortalizas') return 'hortalizas';
  return 'quinua';
};
