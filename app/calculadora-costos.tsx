import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CalculadoraCostosScreen } from '@/src/features/calculadoraCostos/screens/CalculadoraCostosScreen';
import { RubroCalculadora } from '@/src/features/calculadoraCostos/types';

export default function CalculadoraCostosRoute() {
  const params = useLocalSearchParams<{
    idLoteServidor?: string;
    idLoteLocal?: string;
    rubro?: string;
  }>();

  function normalizarRubro(value: string | undefined): RubroCalculadora {
    if (value === 'quinua') return 'quinua';
    if (value === 'hortalizas') return 'hortalizas';
    return 'quinua'; // valor por defecto
  }

  function parseParamToPositiveInt(value: string | null): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return parsed;
  }

  const rubroFinal = normalizarRubro(typeof params.rubro === 'string' ? params.rubro : params.rubro?.[0]);
  const idLoteServidor = parseParamToPositiveInt(
    typeof params.idLoteServidor === 'string' ? params.idLoteServidor : params.idLoteServidor?.[0] ?? null
  );
  const idLoteLocal = parseParamToPositiveInt(
    typeof params.idLoteLocal === 'string' ? params.idLoteLocal : params.idLoteLocal?.[0] ?? null
  );

  return (
    <CalculadoraCostosScreen
      rubro={rubroFinal}
      idLoteServidor={idLoteServidor}
      idLoteLocal={idLoteLocal}
    />
  );
}
