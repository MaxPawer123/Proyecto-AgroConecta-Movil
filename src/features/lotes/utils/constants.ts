import { Image } from 'react-native';
import { RubroConfig, RubroType } from '../types';

const QUINUA_DEFAULT_IMAGE = Image.resolveAssetSource(
  require('../../../../assets/images/quinua_parcela.jpg')
).uri ?? '';

const HORTALIZAS_DEFAULT_IMAGE = Image.resolveAssetSource(
  require('../../../../assets/images/hortalizas_parcela.jpg')
).uri ?? '';

const PAPA_DEFAULT_IMAGE = Image.resolveAssetSource(
  require('../../../../assets/images/papa1.webp')
).uri ?? '';

const DEFAULT_CONFIG: RubroConfig = {
  rubro: 'quinua',
  routeParam: 'quinua',
  codePrefix: 'Q',
  title: 'Mis Parcelas de Quinua',
  subtitle: 'Calcula tus cultivos de quinua, costos y proyecciones',
  productLabel: 'Cultivo',
  defaultProductName: 'Quinua',
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
    productLabel: 'Cultivo',
    defaultProductName: 'Hortalizas',
    defaultImage: HORTALIZAS_DEFAULT_IMAGE,
    fallbackProductoId: 2,
    quickSyncedLabel: 'SINCRONIZADO',
    quickPendingLabel: 'P',
    localSyncedLabel: 'SUBIENDO',
    localPendingLabel: 'PS',
    usesProductCatalogSync: false,
    stopAutoSyncOnUnmount: true,
  },
  papa: {
    rubro: 'papa',
    routeParam: 'papa',
    codePrefix: 'P',
    title: 'Mis Parcelas de Papa',
    subtitle: 'Calcula tus cultivos de papa, costos y proyecciones',
    productLabel: 'Cultivo',
    defaultProductName: 'Papa',
    defaultImage: PAPA_DEFAULT_IMAGE,
    fallbackProductoId: 3,
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
  if (raw?.trim().toLowerCase() === 'papa') return 'papa';
  if (raw?.trim().toLowerCase() === 'hortalizas') return 'hortalizas';
  return 'quinua';
};
