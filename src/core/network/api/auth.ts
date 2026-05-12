import { requestJson, type ApiResponse } from '../http';

export type AuthRegisterPayload = {
  nombre: string;
  apellido: string;
  telefono: string;
  departamento: string;
  municipio: string;
  comunidad: string;
};

export type AuthUserApi = {
  id_usuario: number;
  id_productor: number;
  nombre: string;
  apellido: string;
  telefono: string;
  rol: string;
  estado: string;
  departamento: string;
  municipio: string;
  comunidad: string;
  fecha_registro: string;
};

export async function registrarProductorApi(payload: AuthRegisterPayload): Promise<AuthUserApi> {
  const response = await requestJson<ApiResponse<AuthUserApi>>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'No se pudo registrar el productor en el servidor');
  }

  return response.data;
}
