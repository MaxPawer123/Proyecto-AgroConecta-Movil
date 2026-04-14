import { Image } from 'react-native';
import { RubroConfig, RubroType } from '../types';

const QUINUA_DEFAULT_IMAGE = Image.resolveAssetSource(
  require('../../../../assets/images/quinua_parcela.jpg')
).uri ?? '';

const HORTALIZAS_DEFAULT_IMAGE = Image.resolveAssetSource(
  require('../../../../assets/images/hortalizas_parcela.jpg')
).uri ?? '';

const DEFAULT_CONFIG: RubroConfig = {
  rubro: 'quinua',
  routeParam: 'quinua',
  codePrefix: 'Q',
  title: 'Mis Parcelas de Quinua',
  subtitle: 'Calcula tus cultivos de quinua, costos y proyecciones',
  productLabel: 'Variedad',
  defaultProductName: 'Quinua',
  defaultVariedad: 'Sin variedad',
  defaultImage: QUINUA_DEFAULT_IMAGE,
  fallbackProductoId: 1,
  quickSyncedLabel: 'SINCRONIZADO',
  quickPendingLabel: 'P',
  localSyncedLabel: 'SUBIENDO',
  localPendingLabel: 'PS',
  usesProductCatalogSync: true,
  stopAutoSyncOnUnmount: false,
};

export const RUBRO_CONFIG: Record<RubroType, RubroConfig> = {
  quinua: DEFAULT_CONFIG,
  hortalizas: {
    rubro: 'hortalizas',
    routeParam: 'hortalizas',
    codePrefix: 'H',
    title: 'Mis Parcelas de Hortalizas',
    subtitle: 'Calcula tus cultivos de hortalizas, costos y proyecciones',
    productLabel: 'Tipo',
    defaultProductName: 'Hortalizas',
    defaultVariedad: 'Hortaliza',
    defaultImage: HORTALIZAS_DEFAULT_IMAGE,
    fallbackProductoId: 2,
    quickSyncedLabel: 'SINCRONIZADO',
    quickPendingLabel: 'P',
    localSyncedLabel: 'SUBIENDO',
    localPendingLabel: 'PS',
    usesProductCatalogSync: false,
    stopAutoSyncOnUnmount: true,
  },
};

export const normalizeRubro = (value?: string | string[] | null): RubroType => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'hortalizas') return 'hortalizas';
  return 'quinua';
};
