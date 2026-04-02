import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormularioCostos } from '../components/FormularioCostos';
import { useCalculadoraCostos } from '../hooks/useCalculadoraCostos';
import { RubroCalculadora } from '../types';

type CalculadoraCostosScreenProps = {
  rubro?: RubroCalculadora;
  idLoteServidor?: number;
  idLoteLocal?: number;
  onBack?: () => void;
};

function parseParamToPositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function normalizarRubro(value: string | undefined): RubroCalculadora {
  if (value === 'quinua') return 'quinua';
  if (value === 'hortalizas') return 'hortalizas';
  return 'quinua';
}

export function CalculadoraCostosScreen({ rubro, idLoteServidor: idLoteServidorProp, idLoteLocal: idLoteLocalProp, onBack }: CalculadoraCostosScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    idLoteServidor?: string | string[];
    idLoteLocal?: string | string[];
    rubro?: string | string[];
  }>();

  const pickParam = (value?: string | string[]) =>
    typeof value === 'string' ? value : Array.isArray(value) ? value[0] : null;

  const rubroParam = pickParam(params.rubro) ?? rubro;
  const rubroFinal = normalizarRubro(rubroParam);
  const idLoteServidor = idLoteServidorProp ?? parseParamToPositiveInt(pickParam(params.idLoteServidor));
  const idLoteLocal = idLoteLocalProp ?? parseParamToPositiveInt(pickParam(params.idLoteLocal));

  const calculadora = useCalculadoraCostos({
    rubro: rubroFinal,
    idLoteServidor,
    idLoteLocal,
  });

  return (
    <FormularioCostos
      title={calculadora.estrategia.titulo}
      subtitle={calculadora.estrategia.subtitulo}
      onBack={onBack ?? (() => router.back())}
      onVerResultados={() => {
        router.push({
          pathname: calculadora.estrategia.rutaResultados,
          params: {
            idLoteServidor: idLoteServidor || '',
            idLoteLocal: idLoteLocal || '',
            rubro: rubroFinal,
          },
        });
      }}
      calculadora={calculadora}
    />
  );
}
