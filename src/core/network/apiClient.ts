import { requestJson } from './http';

export * from './http';
export * from './api/auth';
export * from './api/lotes';
export * from './api/gastos';
export * from './api/produccion';

// La baseURL configurada en la capa HTTP debe apuntar a la IP LAN del equipo
// (por ejemplo: http://192.168.x.x:3000). Nunca uses localhost en un dispositivo físico.
export async function verificarBackendActivo(): Promise<boolean> {
	try {
		await requestJson<unknown>('/health', { method: 'GET' }, 3000);
		return true;
	} catch {
		return false;
	}
}
