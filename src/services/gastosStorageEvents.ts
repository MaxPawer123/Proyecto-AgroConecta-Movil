export type EventoGastos = {
  tipo: 'GASTO_ACTUALIZADO';
  timestamp: number;
  idLoteLocal?: number | null;
  idLoteServidor?: number | null;
};

const listenersEventosGastos = new Set<(evento: EventoGastos) => void>();

export function emitirEventoGastoActualizado(payload?: {
  idLoteLocal?: number | null;
  idLoteServidor?: number | null;
}): void {
  const evento: EventoGastos = {
    tipo: 'GASTO_ACTUALIZADO',
    timestamp: Date.now(),
    idLoteLocal: payload?.idLoteLocal,
    idLoteServidor: payload?.idLoteServidor,
  };

  for (const listener of listenersEventosGastos) {
    try {
      listener(evento);
    } catch (error) {
      console.warn('Listener de gastos fallo:', error);
    }
  }
}

export function suscribirEventosGastos(listener: (evento: EventoGastos) => void): () => void {
  listenersEventosGastos.add(listener);
  return () => {
    listenersEventosGastos.delete(listener);
  };
}